const Util = require('./util.js');
const AppState = require('./appState.js');

const THREE = require('three');

class CaveGenerator {
	constructor() {
		this.junctures = [new THREE.Vector2(-100, 5)]; //(x,y) points each time path slope changes
	}

	getTopSurfaceY(x) {
		x = Util.toMeters(x);
		// const noise = Math.sin(x);
		const noise = 0;

		return this.getBasicTopSurfaceY(x) + noise;
	}

	getBottomSurfaceY(x) {
		x = Util.toMeters(x);
		const noise = blah(x);

		return this.getBasicBottomSurfaceY(x) - noise;
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

		return 10;
	}

	// These might also need to be functions of x like getApertureHeight(x)
	// minFlatLength, maxFlatLength, minSlantLength, maxSlantLength, minSlope, maxSlope
	
	getPathY(x) {
		// Find `nextJuncture` via:
		// Add up previous section lengths to see if x is in unexplored territory
		// 	If so, generate a new juncture point
		// 		Every other section is flat/slant, so base on index
		// 		xPos is based on min/maxLength params
		// 		yPos is based on a random slope via min/maxSlope params (and a global min/max Y)
		// 	If not grab pre-generated juncture point

		// Find the path height via linear interpolation from `previousJuncture` to `nextJuncture`

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