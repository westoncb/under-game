const QuadShaderCanvas = require('./quadShaderCanvas.js');
const StateTransformer = require('./StateTransformer.js');
const THREE = require('three');
const AppState = require('./appState.js');

const Y_HISTORY_LENGTH = 10000;
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
					 velocityCap: new THREE.Vector2(12, 20),
					}, 
			camera: {position: new THREE.Vector2(),
					 velocity: new THREE.Vector2(),
					 activeForces: [],
					 mass: 2,
					 velocityCap: new THREE.Vector2(20, 60),
					},
			keyStates: {},
			playerYHistory: [],
			yHistoryIndex: 0,
		};

		const uniforms = {playerPos: {value: this.state.player.position}, cameraPos: {value: this.state.camera.position}, wormData: {value: new Float32Array(16)}, wormData2: {value: new Float32Array(16)}};

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
			if (entity === this.state.camera) {
				const target = this.state.player.position.clone().add(new THREE.Vector2(10, 0));
				entity.position.addScaledVector(target.sub(this.state.camera.position), 
												1 / 10);
			} else {
				const totalForce = new THREE.Vector2();
				entity.activeForces.forEach(force => {
					totalForce.add(force);
				});

				const acceleration = new THREE.Vector2(totalForce.x / entity.mass, totalForce.y / entity.mass);
				const velocity = entity.velocity;

				velocity.addScaledVector(acceleration, deltaTime);

				// Cap velocity
				velocity.x = Math.min(Math.abs(velocity.x), Math.abs(entity.velocityCap.x)) * ((velocity.x + 1) / Math.abs(velocity.x + 1));
				// velocity.y = Math.min(Math.abs(velocity.y), Math.abs(entity.velocityCap.y)) * ((velocity.y + 1) / Math.abs(velocity.y + 1));

				entity.position.addScaledVector(velocity, deltaTime);

				// console.log("force, acceleration, velocity, position", totalForce, acceleration, velocity, entity.position);
			}

			entity.activeForces.length = 0;
		});

		// this.state.player.position.y = Math.max(this.state.player.position.y, this.toMeters(AppState.canvasHeight/2));
	}

	assignEnvironmentalForces() {
		const player = this.state.player;
		const camera = this.state.camera;

		const gravityConstant = 6.673e-11;
		const earthMass = 5.98e24;
		const earthRadius = 6.38e6;
		const gravityForceMagnitude = (gravityConstant * earthMass * player.mass) / 6.38e6 ** 2;

		player.activeForces.push(new THREE.Vector2(0, -gravityForceMagnitude * 2));

		player.activeForces.push(new THREE.Vector2(80, 0));

		if (this.state.keyStates.ArrowUp) {
			player.activeForces.push(new THREE.Vector2(0, 500));			
		}

		// const c = 20;
		// const vec = player.position.clone().sub(camera.position);
		// const scale = this.smoothstep(this.toMeters(AppState.canvasWidth / 5), this.toMeters(AppState.canvasWidth), vec.length());
		
		// vec.normalize();
		// vec.multiplyScalar(1.1);
		// vec.multiplyScalar(vec.length() * vec.length() * c);
		
		// camera.activeForces.push(vec);
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

		this.quadShaderCanvas.uniforms.time.value = state.time / 1000;
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

		for (let i = 0; i < 8; i++) {
			const position = playerPos.clone().add(new THREE.Vector2(80 * -i, 0));
			position.y = this.getPastPlayerY(position.x);
			this.setWormPartData(position, 0, i);
		}
	}

	setWormPartData(position, rotation, index) {
		if (index < 4) {
			const i = index * 4;
			const wormData = this.quadShaderCanvas.uniforms.wormData;
			wormData.value[i + 0] = position.x;
			wormData.value[i + 1] = position.y;
			wormData.value[i + 2] = rotation;
		} else {
			const i = (index - 4) * 4;
			const wormData = this.quadShaderCanvas.uniforms.wormData2;
			wormData.value[i + 0] = position.x;
			wormData.value[i + 1] = position.y;
			wormData.value[i + 2] = rotation;
		}
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
			uniform mat4 wormData2;

			float beat(float value, float intensity, float frequency) {
			  float v = atan(sin(value * 3.145 * frequency) * intensity);
			  return (v + 3.145 / 2.) / 3.145;
			}

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

			// Similar to fOpUnionRound, but more lipschitz-y at acute angles
			// (and less so at 90 degrees). Useful when fudging around too much
			// by MediaMolecule, from Alex Evans' siggraph slides
			// http://mercury.sexy/hg_sdf/
			float fOpUnionSoft(float a, float b, float r) {
				float e = max(r - abs(a - b), 0.);
				return min(a, b) - e*e*0.25/r;
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
			// http://mercury.sexy/hg_sdf/
			float udRoundBox( vec2 p, vec2 b, float r )
			{
			  return length(max(abs(p)-b,0.0))-r;
			}

			float wormDist(vec2 coord, vec2 boxSize, float cornerRadius) {
				float dist1 = udRoundBox(coord - wormData[0].xy, boxSize, cornerRadius);
				float dist2 = udRoundBox(coord - wormData[1].xy, boxSize, cornerRadius);
				float dist3 = udRoundBox(coord - wormData[2].xy, boxSize, cornerRadius);
				float dist4 = udRoundBox(coord - wormData[3].xy, boxSize, cornerRadius);
				float dist5 = udRoundBox(coord - wormData2[0].xy, boxSize, cornerRadius);
				float dist6 = udRoundBox(coord - wormData2[1].xy, boxSize, cornerRadius);

				float radius = 80.;

				float wormDataUnion = fOpUnionSoft(fOpUnionSoft(fOpUnionSoft(dist1, dist2, radius), dist3, radius), dist4, radius);
				float wormData2Union = fOpUnionSoft(dist5, dist6, radius);

				return fOpUnionSoft(wormDataUnion, wormData2Union, radius);
			}

			vec4 getWormBlockColor(vec2 coord, vec2 uv) {
				float sideLength = 30.;
				float cornerRadius = 15.;
				float dist = wormDist(coord, vec2(sideLength, sideLength), cornerRadius) / (sideLength + cornerRadius);

				if (dist < 0.3) {
					vec2 uv1 = vec2(uv.x + 1., uv.y);
					float noise1 = noise((uv1 * 10.));
					vec2 uv2 = vec2(uv.x - 1., uv.y);
					float noise2 = noise((uv2 * 10.));
					vec2 uv3 = vec2(uv.x, uv.y + 1.);
					float noise3 = noise((uv3 * 10.));
					vec2 uv4 = vec2(uv.x, uv.y - 1.);
					float noise4 = noise((uv4 * 10.));

					float borderMod = smoothstep(0.15, 0.3, dist) / 2.;
					float brighten = -dist / 2. + borderMod;			

					float r = (noise1 + noise2 + noise3 + noise4) / 2. + brighten;
					float g = (sin(time) + 1.) / 2. * 0.2 + brighten;
					float b = (cos(time) + 1.) / 2. * 0.2 + brighten;

					return vec4(r, g, b, 1.0);	
				} else {
					return vec4(0);
				}
			}

			vec4 getWormColor(vec2 coord, vec2 uv) {
				vec4 color = getWormBlockColor(coord, uv);

				if (length(color) > 0.) {
					return color;
				}

				return vec4(0);
			}

			void main(void) {
				vec2 coord = gl_FragCoord.xy + (cameraPos.xy - (resolution.xy / 2.));
				vec2 p = coord.xy / resolution.xy;
				vec2 uv = p*vec2(resolution.x/resolution.y,1.0);

				float theNoise = noise((uv * 20.));

				vec4 wormColor = getWormColor(coord, uv);

				if (length(wormColor) > 0.) {
					gl_FragColor = wormColor;	
				} else {
					gl_FragColor = vec4(theNoise / 1.5, 0., 0.15, 1.0);
				}
				
			}
		`;

		return fs;
	}

	tearDown() {}
}

module.exports = GameStateTransformer;