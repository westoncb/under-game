const Util = require('./util.js');
const AppState = require('./appState.js');

const THREE = require('three');

const MIN_APERTURE = 4; // meters;
const MAX_APERTURE = 8.5;

class CaveGenerator {
	constructor() {
		this.junctures = [new THREE.Vector2(-100, 5), new THREE.Vector2(100, 5)]; //(x,y) points each time path slope changes
		Util.newNoiseSeed();
	}

	getTopSurfaceY(x) {
		const smoothTopSurface = this.getPathY(x) + this.getApertureHeight(x) / 2.;

		return smoothTopSurface + this.noise(x);
	}

	noise(x) {
		return (Util.noise1d(x / 3) ** 2 * 4) * Util.mix(0.65, 1.2, Util.smoothstep(MIN_APERTURE, MAX_APERTURE, this.getApertureHeight(x)))
		       + Util.noise1d(x * 2.) / 2.5
		       + Util.noise1d(x * 8.) / 7.;
	}

	getBottomSurfaceY(x) {
		return this.getTopSurfaceY(x) - this.getApertureHeight(x);
	}

	getApertureHeight(x) {
		// could event just be linear if we wanted to be simple

		const repeatDist = 100;
		const scaledX = x / (repeatDist / Math.PI);
		const noise = Util.noise1d(x / 5) * 2;
		const ratio = Util.smoothstep(0, repeatDist, (Math.sin(scaledX) + 1) / 2 * repeatDist * noise);
		return ((1 - ratio)*MAX_APERTURE + ratio*MIN_APERTURE);
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
		const length = Math.random() * 15 + 5;
		const angle = Math.random() * (Math.PI / 2) - (Math.PI / 4);
		const newJuncture = lastJuncture.clone().add(new THREE.Vector2(Math.cos(angle) * length, Math.sin(angle) * length));

		return newJuncture;
	}
}

module.exports = CaveGenerator;