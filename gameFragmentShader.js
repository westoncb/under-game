class GameFragmentShader {
	static getText() {
		return `

			precision mediump float;

			uniform vec2 resolution;
			uniform float aspectRatio;
			uniform vec2 playerPos;
			uniform vec2 cameraPos;
			uniform float time;
			uniform mat4 wormData;
			uniform mat4 wormData2;
			uniform sampler2D caveHeights;
			uniform float caveAperture;

			#define PI 3.14159265

			float beat(float value, float intensity, float frequency) {
			  float v = atan(sin(value * PI * frequency) * intensity);
			  return (v + PI / 2.) / PI;
			}

			// Similar to fOpUnionRound, but more lipschitz-y at acute angles
			// (and less so at 90 degrees). Useful when fudging around too much
			// by MediaMolecule, from Alex Evans' siggraph slides
			// http://mercury.sexy/hg_sdf/
			float fOpUnionSoft(float a, float b, float r) {
				float e = max(r - abs(a - b), 0.);
				return min(a, b) - e*e*0.25/r;
			}

			// https://www.shadertoy.com/view/Msf3WH
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
			// http://mercury.sexy/hg_sdf/
			float udRoundBox( vec2 p, vec2 b, float r )
			{
			  	return length(max(abs(p)-b, 0.0))-r;
			}

			float coolWormNoise(vec2 uv) {
				// vec2 uv1 = vec2(uv.x + 1., uv.y);
				float noise1 = noise((uv * 10.));
				// vec2 uv2 = vec2(uv.x - 1., uv.y);
				// float noise2 = noise((uv2 * 10.));
				// vec2 uv3 = vec2(uv.x, uv.y + 1.);
				// float noise3 = noise((uv3 * 10.));
				// vec2 uv4 = vec2(uv.x, uv.y - 1.);
				// float noise4 = noise((uv4 * 10.));

				return noise1 / 2.;
			}

			vec4 bgColor(vec2 uv) {
				// float theNoise = noise(((uv + cameraPos * 0.25) * 25.));
				// float noise = (theNoise * theNoise) / 2. / 2.5;
				float noise2 = coolWormNoise((uv + cameraPos * 0.25) * .5)*coolWormNoise((uv + cameraPos * 0.25) * 5.) * 2.5;
				// noise += noise2;
				return vec4(noise2, noise2 / 2., noise2 * 2.2 + ((sin(time / 2.) + 1.) / 2.) * 0.05, 1.0);	
			}

			float wormDist(vec2 uv, vec2 boxSize, float cornerRadius) {
				float dist1 = udRoundBox(uv - wormData[0].xy, boxSize, cornerRadius);
				float dist2 = udRoundBox(uv - wormData[1].xy, boxSize, cornerRadius);
				float dist3 = udRoundBox(uv - wormData[2].xy, boxSize, cornerRadius);
				float dist4 = udRoundBox(uv - wormData[3].xy, boxSize, cornerRadius);
				float dist5 = udRoundBox(uv - wormData2[0].xy, boxSize, cornerRadius);
				float dist6 = udRoundBox(uv - wormData2[1].xy, boxSize, cornerRadius);

				float r = 0.078;

				float wormDataUnion = fOpUnionSoft(fOpUnionSoft(fOpUnionSoft(dist1, dist2, r), dist3, r), dist4, r);
				float wormData2Union = fOpUnionSoft(dist5, dist6, r);

				return fOpUnionSoft(wormDataUnion, wormData2Union, r);
			}

			vec4 getWormBlockColor(vec2 uv) {
				float sideLength = 0.028;
				float cornerRadius = 0.014;
				float dist = wormDist(uv, vec2(sideLength, sideLength), cornerRadius) / (sideLength + cornerRadius);

				if (dist < 0.3) {
					float borderMod = smoothstep(0.1, 0.3, dist) / 4.5;
					float brighten = abs(-dist / 1.5);

					float r = brighten;
					float g = brighten;
					float b = (cos(time) + 1.) * 0.2 + brighten*2. + borderMod * 3.;

					float c = coolWormNoise(uv + cameraPos * 0.25);

					return vec4(r, g + c * 0.4, b + c*0.8, 1.);
				} else {
					return vec4(0);
				}
			}

			vec4 getWormColor(vec2 uv) {
				vec4 color = getWormBlockColor(uv);

				if (length(color) > 0.) {
					return color;
				}

				return vec4(0);
			}

			// https://www.shadertoy.com/view/Msf3WH
			float fractalNoise(vec2 uv) {
				float f = 0.;
		        mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );
				f  = 0.5000*noise( uv ); uv = m*uv;
				f += 0.2500*noise( uv ); uv = m*uv;
				f += 0.1250*noise( uv ); uv = m*uv;
				f += 0.0625*noise( uv ); uv = m*uv;

				return f;
			}

			//From http://mercury.sexy/hg_sdf/
			//Repeat only a few times: from indices <start> to <stop> (similar to above, but more flexible)
			float pModInterval1(inout float p, float size, float start, float stop) {
			  float halfsize = size*0.5;
			  float c = floor((p + halfsize)/size);
			  p = mod(p+halfsize, size) - halfsize;
			  if (c > stop) { //yes, this might not be the best thing numerically.
			    p += size*(c - stop);
			    c = stop;
			  }
			  if (c < start) {
			    p += size*(c - start);
			    c = start;
			  }
			  return c;
			}


			vec4 getCaveWallColor(float dist, vec2 uv) {
				float glow = (1. - smoothstep(0., .04, dist)) * 0.8;
				float noise1 = fractalNoise(uv + vec2(cameraPos.x / aspectRatio * 1.08, cameraPos.y)) * 3.5;
				float steppedNoise = noise1 * (1. - smoothstep(0., .04, dist));
				float modDist = dist + noise1;
				float noise2 = noise(vec2(0., pModInterval1(modDist, 0.05, 0., 13.)));

				float r = 0.2 - (glow * 0.2) + noise2 * 0.5;
				float g = 0.2 - (glow * 0.2) + noise2 * 0.5;
				float b = (glow + steppedNoise) / 3. + (0.25) + noise2 * (sin(time) + 2.) / 10. + 0.05;

				return vec4(r, g, b, 1.0);
			}

			void main(void) {
				vec2 p = gl_FragCoord.xy / resolution.xy;
				vec2 uv = p * vec2(aspectRatio,1.0);

				vec4 wormColor = getWormColor(uv);

				if (length(wormColor) > 0.) {
					gl_FragColor = wormColor;
				}
				else {
					float height = texture2D(caveHeights, vec2(p.x, 0.)).a;
					float dist = uv.y - height;

					bool bottomCaveWall = uv.y < height - caveAperture;
					if (uv.y > height || bottomCaveWall) {
						if (bottomCaveWall) {
							dist = height - caveAperture - uv.y;
						}

						gl_FragColor = getCaveWallColor(dist, p);
					} else {
						gl_FragColor = bgColor(uv);
					}
				}
				
			}
		`;
	}
}

module.exports = GameFragmentShader;