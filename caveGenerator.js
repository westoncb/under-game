const Util = require('./util.js');
const AppState = require('./appState.js');

const THREE = require('three');

class CaveGenerator {
	constructor() {
		this.junctures = [new THREE.Vector2(-100, 5), new THREE.Vector2(100, 5)]; //(x,y) points each time path slope changes
		Util.newNoiseSeed();
	}

	getTopSurfaceY(x) {
		x = Util.toMeters(x);

		return this.getBasicTopSurfaceY(x) + this.noise(x);
	}

	noise(x) {
		return Util.noise1d(x / 3) ** 2 * 4
		       + Util.noise1d(x * 2.) / 2.5
		       + Util.noise1d(x * 8.) / 7.;
	}

	getBottomSurfaceY(x) {
		return this.getTopSurfaceY(x) - this.getApertureHeight(Util.toMeters(x));
	}

	getBasicTopSurfaceY(x) {
		const maxY = Util.toMeters(AppState.canvasHeight);
		const initialY = this.getPathY(x) + this.getApertureHeight(x) / 2.;
		const overhang = Math.max(initialY - maxY, 0);

		return initialY;// - overhang;
	}

	getBasicBottomSurfaceY(x) {
		return this.getBasicTopSurfaceY(x) - this.getApertureHeight(x);
	}

	getApertureHeight(x) {
		// could event just be linear if we wanted to be simple

		const ratio = Util.smoothstep(0, 100, x);
		return Util.toMeters(((1 - ratio) * 0.9 + ratio*0.4) * AppState.canvasHeight);
	}

	// These might also need to be functions of x like getApertureHeight(x)
	// minFlatLength, maxFlatLength, minSlantLength, maxSlantLength, minSlope, maxSlope
	
	getPathY(x) {
		const result = this.getPriorJunctureAndIndex(x);
		const priorJuncture = result.juncture;
		const followingJuncture = this.getFollowingJuncture(x, result.index);

		const pathProportion = (x - priorJuncture.x) / (followingJuncture.x - priorJuncture.x);
		const y = priorJuncture.y + (followingJuncture.y - priorJuncture.y) * pathProportion;

		return y;
	}

	getPriorJunctureAndIndex(x) {
		for (let i = this.junctures.length-1; i > -1; i--) {
			const juncture = this.junctures[i];

			if (x >= juncture.x) {
				return {juncture, index: i};
			}
		}

		console.error("Couldn't find prior juncture for x: ", x);
	}

	getFollowingJuncture(x, priorJunctureIndex) {
		let followingJuncture;

		for (let i = priorJunctureIndex + 1; i < this.junctures.length; i++) {
			const juncture = this.junctures[i];
			if (x <= juncture.x) {
				return juncture
			}
		}

		const lastJunctureIndex = this.junctures.length - 1;
		const lastJuncture = this.junctures[lastJunctureIndex];

		const newJuncture = this.generateJuncture(lastJuncture, lastJunctureIndex);
		this.junctures.push(newJuncture);

		return newJuncture;
	}

	generateJuncture(lastJuncture, index) {
		const length = Math.random() * 20 + 5;
		const angle = Math.random() * (Math.PI / 2) - (Math.PI / 4);
		const newJuncture = lastJuncture.clone().add(new THREE.Vector2(Math.cos(angle) * length, Math.sin(angle) * length));

		// newJuncture.y = Math.max(Math.min(newJuncture.y, Util.toMeters(AppState.canvasHeight)), 0);

		return newJuncture;
	}
}

module.exports = CaveGenerator;