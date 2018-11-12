const THREE = require('three');

class Util {
  static screenRectToWorldRect(x, y, width, height, worldZ, camera) {
      const leftScreenPoint = new THREE.Vector3( x, y + height/2);
      const rightScreenPoint = new THREE.Vector3( x + width, y + height/2);
      const topScreenPoint = new THREE.Vector3( x + width/2, y);
      const bottomScreenPoint = new THREE.Vector3( x + width/2, y + height);

      const leftPoint = Util.screenPointToWorldPoint(leftScreenPoint, worldZ, x + width, y + height, camera);
      const rightPoint = Util.screenPointToWorldPoint(rightScreenPoint, worldZ, x + width, y + height, camera);
      const worldWidth = rightPoint.clone().sub(leftPoint).length();

      const topPoint = Util.screenPointToWorldPoint(topScreenPoint, worldZ, x + width, y + height, camera);
      const bottomPoint = Util.screenPointToWorldPoint(bottomScreenPoint, worldZ, x + width, y + height, camera);
      const worldHeight = bottomPoint.clone().sub(topPoint).length();

      return {x: leftPoint.x, y: topPoint.y, width: worldWidth, height: worldHeight};
  }

  static screenPointToWorldPoint(screenPoint, worldZ, canvasWidth, canvasHeight, camera) {
      const worldPoint = new THREE.Vector3(
          ( screenPoint.x / canvasWidth ) * 2 - 1,
          - ( screenPoint.y / canvasHeight ) * 2 + 1,
          0.5);

      worldPoint.unproject( camera );

      var dir = camera.position.clone().sub( worldPoint ).normalize();

      var distance = worldZ / dir.z;

      const scaledVec = dir.multiplyScalar( distance );

      var pos = camera.position.clone().add( scaledVec );

      return pos;
  }

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

  static getTextSprite(text, fontSize, color = '#444444') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // setting canvas width/height before ctx draw, else canvas is empty
    const strWidth = ctx.measureText(text).width;
    canvas.width = strWidth;
    canvas.height = fontSize * 1.22;

    // after setting the canvas width/height we have to re-set font to apply!?! looks like ctx reset
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.fillText(text, canvas.width / 2, 0);

    const texture = new THREE.Texture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    const mainCanvasAspect = window.thingBrowserState.canvasWidth / window.thingBrowserState.canvasHeight;

    const width = strWidth / 100;
    const height = fontSize / 100;

    const geometry = new THREE.PlaneBufferGeometry(width, height, 1);

    const material = new THREE.MeshBasicMaterial({
      side: THREE.FrontSide,
      map: texture,
      transparent: true,
      depthTest: true,
    });

    const spriteMesh = new THREE.Mesh(geometry, material);

    spriteMesh.width = width;
    spriteMesh.height = height;
    spriteMesh.textSprite = true;

    return spriteMesh;
  }

  /*
    NDC = normalized device coordinates
  */
  static getNDCMousePosition(mousePos, canvasWidth, canvasHeight) {
    const ndcX = mousePos.x / canvasWidth * 2 - 1;
    const ndcY = -(mousePos.y / canvasHeight) * 2 + 1;
    const ndcMousePos = new THREE.Vector2(ndcX, ndcY);

    return ndcMousePos;
  }
}

module.exports = Util;