class GameFragmentShader {
	static getText() {
		return `

			precision mediump float;

			uniform vec2 resolution;
			uniform float aspectRatio;
			uniform vec2 cameraPos;
			uniform float time;
			uniform mat4 wormData;
			uniform mat4 wormData2;
			uniform sampler2D caveHeights;
			uniform float caveAperture;
			uniform float wormDeathRatio;
			uniform float resetTransitionRatio;

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

				float deathAnimTime = smoothstep(0., 0.4, wormDeathRatio);
				float r = noise2 + noise2/3.*deathAnimTime;
				float g = noise2 / 2.;
				float b = noise2 * 2.2 + ((sin(time / 2.) + 1.) / 2.) * 0.05;

				g = g + -g * deathAnimTime;
				b = b + -b * deathAnimTime;

				return vec4(r, g, b, 1.0);	
			}

			float wormDistance(vec2 uv) {
				float sideLength = 0.028;
				float cornerRadius = 0.014;
				vec2 boxSize = vec2(sideLength, sideLength);

				float wormDeathMod = smoothstep(0., 0.35, wormDeathRatio);
				float x = noise(uv) * (sin(wormDeathMod * PI / 4.));
				float y = noise(uv * (cos(wormDeathMod * PI / 4.)) * 30.);
				vec2 deathAnimOffset = vec2(x, y) * 20. * wormDeathMod;

				uv += deathAnimOffset;

				float dist1 = udRoundBox(uv - wormData[0].xy, boxSize, cornerRadius);
				float dist2 = udRoundBox(uv - wormData[1].xy, boxSize, cornerRadius);
				float dist3 = udRoundBox(uv - wormData[2].xy, boxSize, cornerRadius);
				float dist4 = udRoundBox(uv - wormData[3].xy, boxSize, cornerRadius);
				float dist5 = udRoundBox(uv - wormData2[0].xy, boxSize, cornerRadius);
				float dist6 = udRoundBox(uv - wormData2[1].xy, boxSize, cornerRadius);

				float r = 0.078;

				float wormDataUnion = fOpUnionSoft(fOpUnionSoft(fOpUnionSoft(dist1, dist2, r), dist3, r), dist4, r);
				float wormData2Union = fOpUnionSoft(dist5, dist6, r);

				float dist = fOpUnionSoft(wormDataUnion, wormData2Union, r)  / (sideLength + cornerRadius) - 0.3;

				return dist;
			}

			vec4 getWormColor(float dist, vec2 uv) {
				dist += 0.3;
				float borderMod = smoothstep(0.1, 0.3, dist) / 4.5;
				float brighten = abs(-dist / 1.5);

				float r = brighten;
				float g = brighten;
				float b = (cos(time) + 1.) * 0.2 + brighten*2. + borderMod * 3.;

				float c = coolWormNoise(uv + cameraPos * 0.25);

				g += c * 0.4;
				b += c * 0.8;

				// Change color for death animation
				r -= smoothstep(0., 1., wormDeathRatio);
				b += smoothstep(0., 1., wormDeathRatio) * 10.;

				return vec4(r, g, b, 1.);
			}

			vec4 getCaveWallColor(float dist, vec2 p) {
				float negDist = -dist;

				float glow = (1. - smoothstep(0., .04, negDist)) * 0.8;

				// Fade out glow during death
				glow += -glow * wormDeathRatio;

				float resetScrollBack = resetTransitionRatio * cameraPos.x;
				float noise1 = fractalNoise(p + vec2(cameraPos.x / aspectRatio * 1.08 - resetScrollBack, cameraPos.y)) * 3.5;
				float steppedNoise = noise1 * (1. - smoothstep(0., .04, negDist));

				// Fade out noise glow during death
				steppedNoise += - steppedNoise * wormDeathRatio;

				float deathAnimScale = (1. - wormDeathRatio / 2.5);
				float distWithNoise = negDist + noise1 * deathAnimScale;
				float noise2 = noise(vec2(0., pModInterval1(distWithNoise, 0.05, 0., 13.)));


				float r = 0.2 - (glow * 0.2) + noise2 * 0.5;
				float g = 0.2 - (glow * 0.2) + noise2 * 0.5;
				float b = (glow + steppedNoise) / 3. + (0.25) + noise2 * (sin(time) + 2.) / 10. + 0.05;

				return vec4(r, g, b, 1.0);
			}

			float caveDistance(vec2 uv, vec2 p) {
				float height = texture2D(caveHeights, vec2(p.x, 0.)).a;
				float wormDeathMod = smoothstep(0., 0.4, pow(wormDeathRatio, 2.));
				
				float caveShutDistance = (wormDeathMod * caveAperture/2.);
				float topDist = height - caveShutDistance - uv.y;
				float bottomDist = uv.y - (height - caveAperture + caveShutDistance);
				
				return min(topDist, bottomDist);
			}

			float fOpIntersectionRound(float a, float b, float r) {
				vec2 u = max(vec2(r + a,r + b), vec2(0));
				return min(-r, max (a, b)) + length(u);
			}

			void main(void) {
				vec2 p = gl_FragCoord.xy / resolution.xy;
				vec2 uv = p * vec2(aspectRatio, 1.0);

				float wormDist = wormDistance(uv);
				float caveDist = caveDistance(uv, p);

				vec4 color;

				if (caveDist < 0.) {

					color = getCaveWallColor(caveDist, p);
				} else if (wormDist < 0.) {

					color = getWormColor(wormDist, uv);
				} else {

					color = bgColor(uv);
				}

				gl_FragColor = color;
			}
		`;
	}
}

module.exports = GameFragmentShader;