const QuadShaderCanvas = require('./quadShaderCanvas.js');
const StateTransformer = require('./StateTransformer.js');
const THREE = require('three');
const AppState = require('./appState.js');

const Y_HISTORY_LENGTH = 1000;
const METERS_TO_PIXELS = 50;

class GameStateTransformer extends StateTransformer {
	setUp() {
		this.state = {
			time: 0,
			player: {position: new THREE.Vector2(),
					 velocity: new THREE.Vector2(),
					 rotation: 0,
					 mass: 10,
					 activeForces: [],
					 dying: false,
					 dead: false,
					 velocityCap: new THREE.Vector2(10, 2.5),
					}, 
			camera: {position: new THREE.Vector2(),
					 velocity: new THREE.Vector2(),
					 activeForces: [],
					 mass: 2,
					 velocityCap: new THREE.Vector2(10, 20),
					},
			keyStates: {},
			playerYHistory: [],
			yHistoryIndex: 0,
		};

		const uniforms = {playerPos: {value: this.state.player.position}, cameraPos: {value: this.state.camera.position}, wormData: {value: new Float32Array(16)}};

		this.quadShaderCanvas = new QuadShaderCanvas('canvas-container', this.getFragmentShader(), uniforms);

		this.state.player.position = this.toMetersV(new THREE.Vector2(AppState.canvasWidth * 0.1, AppState.canvasHeight / 2));
		this.state.camera.position = this.toMetersV(new THREE.Vector2(AppState.canvasWidth/2, AppState.canvasHeight/2));

		const canvas = this.quadShaderCanvas.renderer.domElement;
		canvas.tabIndex = 0;
		canvas.focus();
		canvas.style.outline = 'none';

		canvas.addEventListener('keydown', (e) => {
			this.state.keyStates[e.key] = true;
		});
		canvas.addEventListener('keyup', (e) => {
			this.state.keyStates[e.key] = false;
		});
	}

	handleEvent(event) {}

	update(time, deltaTime) {
		// update cave geometry
		// generate coins routine
		// general cleanup routine

		this.assignEnvironmentalForces();

		this.findCollisions().forEach(collisionEvent => EventQueue.push(collisionEvent));

		this.updateKinematics(deltaTime);

		this.state.time = time;

		this.mapStateToUniforms(this.state);
	}

	updateKinematics(deltaTime) {
		const entities = [this.state.player, this.state.camera];

		entities.forEach(entity => {
			entity.activeForces.forEach(force => {
				const a = new THREE.Vector2(force.x / entity.mass, force.y / entity.mass);
				const vol = entity.velocity;

				vol.addScaledVector(a, deltaTime);

				vol.x = Math.min(Math.abs(vol.x), Math.abs(entity.velocityCap.x)) * ((vol.x + 1) / Math.abs(vol.x + 1));
				vol.y = Math.min(Math.abs(vol.y), Math.abs(entity.velocityCap.y)) * ((vol.y + 1) / Math.abs(vol.y + 1));

				entity.position.addScaledVector(vol, deltaTime);
			});

			entity.activeForces.length = 0;
		});

		this.state.player.position.y = Math.max(this.state.player.position.y, AppState.canvasHeight/2 / METERS_TO_PIXELS);
	}

	assignEnvironmentalForces() {
		const player = this.state.player;
		const camera = this.state.camera;

		const gravityConstant = 6.673e-11;
		const earthMass = 5.98e24;
		const earthRadius = 6.38e6;
		const gravityForceMagnitude = (gravityConstant * earthMass * player.mass) / 6.38e6 ** 2;

		player.activeForces.push(new THREE.Vector2(0, -gravityForceMagnitude));

		player.activeForces.push(new THREE.Vector2(20, 0));

		if (this.state.keyStates.ArrowUp) {
			player.activeForces.push(new THREE.Vector2(0, 250));			
		}

		const c = 20;
		const vec = player.position.clone().sub(camera.position);
		const scale = this.smoothstep(this.toMeters(AppState.canvasWidth / 5), this.toMeters(AppState.canvasWidth), vec.length());
		
		vec.normalize();
		vec.multiplyScalar(1.1);
		vec.multiplyScalar(vec.length() * vec.length() * c);

		// console.log("camera force, player force", vec, player.activeForces[0], player.position);
		
		camera.activeForces.push(vec);
	}

	toPixels(scalar) {
		return scalar * METERS_TO_PIXELS;
	}

	toMeters(scalar) {
		return scalar / METERS_TO_PIXELS;
	}

	toPixelsV(vec) {
		return vec.clone().multiplyScalar(METERS_TO_PIXELS);
	}

	toMetersV(vec) {
		return vec.clone().multiplyScalar(1 / METERS_TO_PIXELS);
	}

	smoothstep (min, max, value) {
	  var x = Math.max(0, Math.min(1, (value-min)/(max-min)));
	  return x*x*(3 - 2*x);
	};

	mapStateToUniforms(state) {
		const playerPos = this.toPixelsV(this.state.player.position);
		const cameraPos = this.toPixelsV(this.state.camera.position);

		this.quadShaderCanvas.uniforms.time.value = state.time;
		this.quadShaderCanvas.uniforms.playerPos.value = playerPos;
		this.quadShaderCanvas.uniforms.cameraPos.value = cameraPos;

		const newYHistoryIndex = Math.floor(playerPos.x) % Y_HISTORY_LENGTH;
		if (this.state.yHistoryIndex > newYHistoryIndex) {
			for (let i = this.state.yHistoryIndex; i < this.state.playerYHistory.length; i++) {
				this.state.playerYHistory[i] = playerPos.y;
			}
			for (let i = 0; i <= newYHistoryIndex; i++) {
				this.state.playerYHistory[i] = playerPos.y;
			}
		} else {
			for (let i = this.state.yHistoryIndex; i <= newYHistoryIndex; i++) {
				this.state.playerYHistory[i] = playerPos.y;
			}
		}
		
		this.state.yHistoryIndex = newYHistoryIndex;

		for (let i = 0; i < 4; i++) {
			const position = playerPos.clone().add(new THREE.Vector2(100 * -i, 0));
			position.y = this.getPastPlayerY(position.x);
			this.setWormPartData(position, 0, i, this.quadShaderCanvas.uniforms.wormData);
		}
	}

	setWormPartData(position, rotation, index, wormData) {
		const i = index * 4;

		wormData.value[i + 0] = position.x;
		wormData.value[i + 1] = position.y;
		wormData.value[i + 2] = rotation;
	}

	getPastPlayerY(x) {
		const i = Math.floor(x) % Y_HISTORY_LENGTH;
		const y = this.state.playerYHistory[i];

		if (isNaN(y)) {
			return 0;
		} else {
			return y;
		}
	}

	findCollisions() {
		return [];
	}

	render() {
		this.quadShaderCanvas.render();
	}

	getFragmentShader() {
		const fs = `
			precision highp float;

			uniform vec2 resolution;
			uniform vec2 playerPos;
			uniform vec2 cameraPos;
			uniform float time;
			uniform mat4 wormData;

			// Maximum/minumum elements of a vector
			float vmax(vec2 v) {
				return max(v.x, v.y);
			}

			float fBox2Cheap(vec2 p, vec2 b) {
				return vmax(abs(p)-b);
			}

			vec2 hash( vec2 p ) {
			  p = vec2( dot(p,vec2(127.1,311.7)),
			        dot(p,vec2(269.5,183.3)) );

			  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
			}

			// Simplex noise from https://www.shadertoy.com/view/Msf3WH
			float noise( in vec2 p ) {
			  const float K1 = 0.366025404; // (sqrt(3)-1)/2;
			  const float K2 = 0.211324865; // (3-sqrt(3))/6;

			  vec2 i = floor( p + (p.x+p.y)*K1 );
			  
			  vec2 a = p - i + (i.x+i.y)*K2;
			  vec2 o = step(a.yx,a.xy);    
			  vec2 b = a - o + K2;
			  vec2 c = a - 1.0 + 2.0*K2;

			  vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );

			  vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));

			  return dot( n, vec3(70.0) );
			}

			// unsigned round box
			float udRoundBox( vec2 p, vec2 b, float r )
			{
			  return length(max(abs(p)-b,0.0))-r;
			}

			vec4 getWormBlockColor(vec2 pos, vec2 coord, vec2 uv) {
				float dist = udRoundBox(coord - pos, vec2(40, 40), 16.) / 48.;

				if (dist < 0.) {
					vec2 uv1 = vec2(uv.x + 1., uv.y);
					float noise1 = noise((uv1 * 20. + vec2(0.005 * time, 0.)));
					vec2 uv2 = vec2(uv.x - 1., uv.y);
					float noise2 = noise((uv2 * 20. + vec2(0.005 * time, 0.)));
					vec2 uv3 = vec2(uv.x, uv.y + 1.);
					float noise3 = noise((uv3 * 20. + vec2(0.005 * time, 0.)));
					vec2 uv4 = vec2(uv.x, uv.y - 1.);
					float noise4 = noise((uv4 * 20. + vec2(0.005 * time, 0.)));

					float brighten = -dist;
					return vec4((noise1 + noise2 + noise3 + noise4) + brighten, 0. + brighten, 0.15 + brighten, 1.0);	
				} else {
					return vec4(0);
				}
			}

			vec4 getWormColor(vec2 coord, vec2 uv) {
				for (int i = 0; i < 4; i++) {
					vec2 pos = wormData[i].xy;
					vec4 color = getWormBlockColor(pos, coord, uv);

					if (length(color) > 0.) {
						return color;
					}
				}

				return vec4(0);
			}

			void main(void) {
				vec2 coord = gl_FragCoord.xy + (cameraPos.xy - (resolution.xy / 2.));
				vec2 p = coord.xy / resolution.xy;
				vec2 uv = p*vec2(resolution.x/resolution.y,1.0);

				float theNoise = noise((uv * 20. + vec2(0.005, 0.)));

				vec4 wormColor = getWormColor(coord, uv);

				if (length(wormColor) > 0.) {
					gl_FragColor = wormColor;	
				} else {
					gl_FragColor = vec4(theNoise / 3.5, 0., 0.15, 1.0);
				}
				
			}
		`;

		return fs;
	}

	tearDown() {}
}

module.exports = GameStateTransformer;