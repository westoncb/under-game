const THREE = require('three');

const METERS_TO_PIXELS = 50;

// https://www.michaelbromley.co.uk/blog/simple-1d-noise-in-javascript/
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

const noiseGenerator1d = new Simple1DNoise();

class Util {
  // See https://hansmuller-webkit.blogspot.com/2013/02/where-is-mouse.html
  static canvasMousePos(event, canvas) {
    const style = document.defaultView.getComputedStyle(canvas, null);

    function styleValue(property) {
      return parseInt(style.getPropertyValue(property), 10) || 0; // '10' is for base 10
    }

    const scaleX = canvas.width / styleValue('width');
    const scaleY = canvas.height / styleValue('height');

    const canvasRect = canvas.getBoundingClientRect();
    const canvasX =
      scaleX *
      (event.clientX -
        canvasRect.left -
        canvas.clientLeft -
        styleValue('padding-left'));
    const canvasY =
      scaleY *
      (event.clientY -
        canvasRect.top -
        canvas.clientTop -
        styleValue('padding-top'));

    // Need to look into pixel scaling issues more closely, but things work correctly
    // on my retina display and non-scaled monitor with this.
    return {
      x: canvasX / window.devicePixelRatio,
      y: canvasY / window.devicePixelRatio,
    };
  }

  static toPixels(scalar) {
    return scalar * METERS_TO_PIXELS;
  }

  static toMeters(scalar) {
    return scalar / METERS_TO_PIXELS;
  }

  static toPixelsV(vec) {
    return vec.clone().multiplyScalar(METERS_TO_PIXELS);
  }

  static toMetersV(vec) {
    return vec.clone().multiplyScalar(1 / METERS_TO_PIXELS);
  }

  static noise1d(x) {
    return noiseGenerator1d.getVal(x);
  }

  static step(min, max, value) {
    if (value <= min)
      return 0;
    if (value >= max)
      return 1;
  }

  static smoothstep (min, max, value) {
    const x = Math.max(0, Math.min(1, (value-min)/(max-min)));
    return x*x*(3 - 2*x);
  };
}

module.exports = Util;