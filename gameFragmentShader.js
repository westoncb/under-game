class GameFragmentShader {
	static getText() {
		return `

			precision highp float;

			uniform vec2 resolution;
			uniform float aspectRatio;
			uniform vec2 cameraPos;
			uniform float time;
			uniform mat4 wormData;
			uniform mat4 wormData2;
			uniform sampler2D topHeights;
			uniform sampler2D bottomHeights;
			uniform float wormDeathRebirthRatio;
			uniform float bgDeathRebirthRatio;
			uniform float caveShutDeathRebirthRatio;
			uniform float cavePatternDeathRebirthRatio;
			uniform float resetTransitionRatio;
			uniform float pointZoneHeight;
			uniform float pointZoneIntensity;

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
				return noise((uv * 10.)) / 2.;
			}

			vec4 bgColor(vec2 uv) {
				vec2 modifiedUV = uv + cameraPos * 0.25;
				float noise1 = coolWormNoise(modifiedUV * .5)*coolWormNoise(modifiedUV * 5.) * 2.5;

				float r = noise1 + noise1/3. * bgDeathRebirthRatio;
				float g = noise1 / 2.;
				float b = noise1 * 2.2 + ((sin(time / 2.) + 1.) / 2.) * 0.05;

				g = g + -g * bgDeathRebirthRatio;
				b = b + -b * bgDeathRebirthRatio;

				return vec4(r, g, b, 1.0);	
			}

			float wormDistance(vec2 uv) {
				float sideLength = 0.028;
				float cornerRadius = 0.014;
				vec2 boxSize = vec2(sideLength, sideLength);

				float x = noise(uv) * (sin(wormDeathRebirthRatio * PI / 4.));
				float y = noise(uv * (cos(wormDeathRebirthRatio * PI / 4.)) * 30.);
				vec2 deathAnimOffset = vec2(x, y) * 20. * wormDeathRebirthRatio;

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
				dist += 0.3 + (pointZoneIntensity * 0.1);
				float borderMod = smoothstep(0.1, 0.3, dist) / 4.5;
				float brighten = abs(-dist / 1.5) * (1. + pointZoneIntensity);

				float r = brighten + (borderMod * 3. * pointZoneIntensity);
				float g = brighten - (borderMod * 3. * pointZoneIntensity);
				float b = (cos(time) + 1.) * 0.2 + brighten*2. + borderMod * 3. - (borderMod * 3. * pointZoneIntensity);

				float c = coolWormNoise(uv + cameraPos * 0.25);

				g += c * 0.4;
				b += c * 0.8;

				// Change color for death animation
				r -= smoothstep(0., 1., wormDeathRebirthRatio);
				b += smoothstep(0., 1., wormDeathRebirthRatio) * 10.;

				return vec4(r, g, b, 1.);
			}

			vec4 getCaveWallColor(float dist, vec2 p) {
				float negDist = -dist;

				float glow = (1. - smoothstep(0., .04, negDist)) * 0.8;

				// Fade out glow during death
				glow += -glow * cavePatternDeathRebirthRatio;

				float resetScrollBack = smoothstep(0., 0.5, resetTransitionRatio) * cameraPos.x;
				float noise1 = fractalNoise(p + vec2(cameraPos.x / aspectRatio * 1.08 - resetScrollBack, cameraPos.y)) * 3.5;
				float steppedNoise = noise1 * (1. - smoothstep(0., .04, negDist));

				// Fade out noise glow during death
				steppedNoise += -steppedNoise * cavePatternDeathRebirthRatio;

				float deathAnimScale = (1. - cavePatternDeathRebirthRatio / 2.5);
				float distWithNoise = negDist + noise1 * deathAnimScale;
				float noise2 = noise(vec2(0., pModInterval1(distWithNoise, 0.05, 0., 13.)));


				float r = 0.2 - (glow * 0.2) + noise2 * 0.5;
				float g = 0.2 - (glow * 0.2) + noise2 * 0.5;
				float b = (glow + steppedNoise) / 3. + (0.25) + noise2 * (sin(time) + 2.) / 10. + 0.05;

				return vec4(r, g, b, 1.0);
			}

			float caveDistance(vec2 uv, vec2 p) {
				float topHeight = texture2D(topHeights, vec2(p.x, 0.)).a;
				float bottomHeight = texture2D(bottomHeights, vec2(p.x, 0.)).a;
				
				float caveShutDistance = caveShutDeathRebirthRatio * (topHeight - bottomHeight)/2.;
				float topDist = topHeight - caveShutDistance - uv.y;
				float bottomDist = uv.y - (bottomHeight + caveShutDistance);
				
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

				if (caveDist < 0.) {

					gl_FragColor = getCaveWallColor(caveDist, p);
				} else if (wormDist < 0.) {

					gl_FragColor = getWormColor(wormDist, uv);
				} else {
					float inZone = step(caveDist - pointZoneHeight, 0.) * step(wormDist - 7., 0.);

					float modPointZoneHeight = pointZoneHeight * (noise(uv * 5.) + 1.) / 2.;
					float diff = modPointZoneHeight - caveDist;
					float heightFactor = smoothstep(0.075, 1., diff / modPointZoneHeight);

					float flameR = 0.2 + heightFactor * 2.;
					float flameB = 0.5 - heightFactor / 4.;
					float flameA = heightFactor * smoothstep(5., 2., wormDist) * inZone;

					vec4 flameVec = vec4((flameR + flameA / 5.), 0., (flameB + flameA / 2.), 0.) * flameA;

					gl_FragColor = bgColor(uv) + flameVec;
				}
			}
		`;
	}
}

module.exports = GameFragmentShader;