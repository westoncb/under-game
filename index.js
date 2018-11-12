const THREE = require('three');
const Stats = require('stats-js');
const dat = require('dat.GUI');

window.onload = () => {
	const basicCanvas = new BasicCanvas('canvas-container');
};

class BasicCanvas {
	constructor(containerElementId) {
		this.containerElementId = containerElementId;
		const containerElement = document.getElementById(this.containerElementId);

		this.state = {};
		this.state.canvasWidth = containerElement.offsetWidth;
		this.state.canvasHeight = containerElement.offsetHeight;

		this.initThreeJS();
		this.initScene();

		this.animate();
	}

	initScene() {
		const geometry = new THREE.PlaneBufferGeometry(this.state.canvasWidth, this.state.canvasHeight);
		const material = new THREE.RawShaderMaterial( {

		    uniforms: {
		        time: { value: 1.0 },
		        resolution: { value: new THREE.Vector2(this.state.canvasWidth, this.state.canvasHeight) }
		    },
		    vertexShader: this.getVertexShader(),
		    fragmentShader: this.getFragmentShader(),

		} );
		this.mesh = new THREE.Mesh(geometry, material);
		this.scene.add(this.mesh);
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

	getFragmentShader() {
		const fs = `
			precision highp float;

			uniform vec2 resolution;
			uniform float time;

			void main(void) {
				vec2 coord = gl_FragCoord.xy;
				vec2 p = (-resolution.xy + 2.0*coord)/resolution.y;

			  	gl_FragColor = vec4(p.x, 0.0, 0.0, 1.0);
			}
		`;

		return fs;
	}

	initThreeJS() {
	    this.renderer = new THREE.WebGLRenderer( { antialias: false } );
	    this.renderer.setPixelRatio( window.devicePixelRatio );
	    this.renderer.setSize( this.state.canvasWidth, this.state.canvasHeight );
	    document.getElementById(this.containerElementId).appendChild( this.renderer.domElement );

	    this.stats = new Stats();
	    this.stats.setMode( 0 );
	    this.stats.domElement.style.position = 'absolute';
	    this.stats.domElement.style.left = '0px';
	    this.stats.domElement.style.top = '0px';
	    document.body.appendChild( this.stats.domElement );

	    this.scene = new THREE.Scene();
	    this.camera = new THREE.OrthographicCamera( this.state.canvasWidth / - 2, this.state.canvasWidth / 2, this.state.canvasHeight / 2, this.state.canvasHeight / - 2, 1, 2 );
	    this.scene.add(this.camera);

	    window.addEventListener( 'resize', this.onWindowResize.bind(this), false );

	    this.datgui = new dat.GUI( { width: 350 } );
	}

	animate(time) {
	    this.stats.begin();
	    
	    requestAnimationFrame( this.animate.bind(this) );

	    this.renderer.render( this.scene, this.camera );

	    this.stats.end();
	}

	onWindowResize( event ) {
	    const containerElement = document.getElementById(this.containerElementId);
	    this.state.canvasWidth = containerElement.offsetWidth;
	    this.state.canvasHeight = containerElement.offsetHeight;
	    this.renderer.setSize( this.state.canvasWidth, this.state.canvasHeight );
	    this.camera.aspect = this.state.canvasWidth / this.state.canvasHeight;
	    this.camera.updateProjectionMatrix();
	}
}