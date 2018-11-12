const THREE = require('three');
const Stats = require('stats-js');
const dat = require('dat.GUI');

class QuadShaderCanvas {
	constructor(containerElementId, fragmentShader) {
		this.containerElementId = containerElementId;
		const containerElement = document.getElementById(this.containerElementId);

		this.width = containerElement.offsetWidth;
		this.height = containerElement.offsetHeight;

		this.initThreeJS();
		this.initScene(fragmentShader);
	}

	initThreeJS() {
	    this.renderer = new THREE.WebGLRenderer( { antialias: false } );
	    this.renderer.setPixelRatio( window.devicePixelRatio );
	    this.renderer.setSize( this.width, this.height );
	    document.getElementById(this.containerElementId).appendChild( this.renderer.domElement );

	    this.stats = new Stats();
	    this.stats.setMode( 0 );
	    this.stats.domElement.style.position = 'absolute';
	    this.stats.domElement.style.left = '0px';
	    this.stats.domElement.style.top = '0px';
	    document.body.appendChild( this.stats.domElement );

	    this.scene = new THREE.Scene();
	    this.camera = new THREE.OrthographicCamera( this.width / - 2, this.width / 2, this.height / 2, this.height / - 2, 1, 2 );
	    this.scene.add(this.camera);

	    window.addEventListener( 'resize', this.onWindowResize.bind(this), false );

	    this.datgui = new dat.GUI( { width: 350 } );
	}

	initScene(fragmentShader) {
		const geometry = new THREE.PlaneBufferGeometry(this.width, this.height);
		const material = new THREE.RawShaderMaterial( {

		    uniforms: {
		        time: { value: 1.0 },
		        resolution: { value: new THREE.Vector2(this.width, this.height) }
		    },
		    vertexShader: this.getVertexShader(),
		    fragmentShader,

		} );
		this.mesh = new THREE.Mesh(geometry, material);
		this.scene.add(this.mesh);
		this.uniforms = material.uniforms;
	}

	getVertexShader() {
		const vs = `
			attribute vec3 position;

			void main(void) {
			  gl_Position = vec4(position, 1.0);
			}
		`;

		return vs;
	}

	render() {
	    this.stats.begin();

	    this.renderer.render( this.scene, this.camera );

	    this.stats.end();
	}

	onWindowResize( event ) {
	    const containerElement = document.getElementById(this.containerElementId);
	    this.width = containerElement.offsetWidth;
	    this.height = containerElement.offsetHeight;
	    this.renderer.setSize( this.width, this.height );
	    this.camera.updateProjectionMatrix();
	}
}

module.exports = QuadShaderCanvas;