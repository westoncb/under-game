const Util = require('./util.js');
const AppState = require('./appState.js');

const THREE = require('three');

var Simple1DNoise = function() {
    var MAX_VERTICES = 256;
    var MAX_VERTICES_MASK = MAX_VERTICES -1;
    var amplitude = 1;
    var scale = 1;

    var r = [];

    for ( var i = 0; i < MAX_VERTICES; ++i ) {
        r.push(Math.random());
    }

    var getVal = function( x ){
        var scaledX = x * scale;
        var xFloor = Math.floor(scaledX);
        var t = scaledX - xFloor;
        var tRemapSmoothstep = t * t * ( 3 - 2 * t );

        /// Modulo using &
        var xMin = xFloor & MAX_VERTICES_MASK;
        var xMax = ( xMin + 1 ) & MAX_VERTICES_MASK;

        var y = lerp( r[ xMin ], r[ xMax ], tRemapSmoothstep );

        return y * amplitude;
    };

    /**
    * Linear interpolation function.
    * @param a The lower integer value
    * @param b The upper integer value
    * @param t The value between the two
    * @returns {number}
    */
    var lerp = function(a, b, t ) {
        return a * ( 1 - t ) + b * t;
    };

    // return the API
    return {
        getVal: getVal,
        setAmplitude: function(newAmplitude) {
            amplitude = newAmplitude;
        },
        setScale: function(newScale) {
            scale = newScale;
        }
    };
};

class CaveGenerator {
	constructor() {
		this.junctures = [new THREE.Vector2(-100, 5), new THREE.Vector2(100, 5)]; //(x,y) points each time path slope changes

		this.generator = new Simple1DNoise();
	}

	getTopSurfaceY(x) {
		x = Util.toMeters(x);
		// const noise = Math.sin(x);

		return this.getBasicTopSurfaceY(x) + this.noise(x);
	}

	noise(x) {
		return this.generator.getVal(x / 3) ** 2 * 4;
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