const QuadShaderCanvas = require('./quadShaderCanvas.js');
const StateTransformer = require('./StateTransformer.js');

class GameStateTransformer extends StateTransformer {
	setUp() {
		this.state = {};

		this.quadShaderCanvas = new QuadShaderCanvas('canvas-container', this.getFragmentShader());
	}

	getFragmentShader() {
		const fs = `
			precision highp float;

			uniform vec2 resolution;
			uniform float time;

			void main(void) {
				vec2 coord = gl_FragCoord.xy;
				vec2 p = (-resolution.xy + 2.0*coord)/resolution.y;

			  	gl_FragColor = vec4(0.0, p.x, (sin(time / 3000.) * 0.8 + 0.1 + 1.) / 2., 1.0);
			}
		`;

		return fs;
	}

	handleEvent(event) {}

	update(time, deltaTime) {
		this.quadShaderCanvas.uniforms.time.value = time;
	}

	render() {
		this.quadShaderCanvas.render();
	}

	tearDown() {}
}

module.exports = GameStateTransformer;