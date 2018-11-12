const THREE = require('three');

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
}

module.exports = Util;