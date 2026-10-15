export const noiseGLSL = /* glsl */ `
float hash3(vec3 p) {
  uvec3 q = uvec3(ivec3(p));
  uint h = q.x * 374761393u + q.y * 668265263u + q.z * 2147483647u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float(h ^ (h >> 16u)) / 4294967295.0;
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
                 mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                 mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float value = 0.0, amplitude = 0.5;
  for(int i = 0; i < 5; i++) {
    value += amplitude * noise3(p);
    p = p * 2.03 + vec3(13.7,9.2,17.4);
    amplitude *= 0.5;
  }
  return value;
}
`

export const sphereVertex = /* glsl */ `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vPosition = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const surfaceFragment = /* glsl */ `
precision highp float;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
uniform vec3 uSeed;
uniform float uWater;
uniform float uTemperature;
uniform float uVegetation;
uniform float uLife;
uniform float uCivilization;
uniform float uPollution;
uniform float uVolcanism;
uniform float uSolar;
uniform float uGravity;
uniform float uTime;
${noiseGLSL}
void main() {
  vec3 p = normalize(vPosition);
  vec3 seed = uSeed;
  float continental = fbm(p * 2.65 + seed);
  float detail = fbm(p * 24.0 + seed);
  float micro = noise3(p * 180.0 + seed);
  float elevation = continental + (detail - 0.5) * 0.075;
  float waterFraction = clamp(uWater, 0.0001, 0.9999);
  float seaLevel = 0.485 + 0.066 * log(waterFraction / (1.0 - waterFraction));
  float coast = smoothstep(seaLevel - 0.006, seaLevel + 0.006, elevation);
  float height = max(elevation - seaLevel, 0.0);
  float shore = (1.0 - smoothstep(0.0, 0.026, abs(elevation - seaLevel)));
  float latitude = abs(p.y);
  float dry = smoothstep(18.0, 55.0, uTemperature);
  float plantLife = uVegetation * smoothstep(0.03, 0.40, uLife);
  vec3 grass = mix(vec3(0.16,0.25,0.13), vec3(0.10,0.30,0.19), detail);
  grass = mix(grass, vec3(0.34,0.29,0.15), dry * 0.8);
  vec3 bare = mix(vec3(0.27,0.24,0.17), vec3(0.52,0.43,0.29), detail);
  vec3 land = mix(bare, grass, clamp(plantLife * 1.7, 0.0, 1.0));
  land *= 0.72 + detail * 0.64 + micro * 0.10;
  float ridges = pow(1.0 - abs(noise3(p * 39.0 + seed + vec3(31.0)) * 2.0 - 1.0),3.0);
  float mountain = smoothstep(0.04, 0.22, height) * smoothstep(0.38, 0.62, detail);
  land = mix(land, vec3(0.29,0.31,0.28) + vec3(0.10) * ridges, mountain * 0.8);
  land = mix(land, vec3(0.58,0.51,0.33), shore * 0.4);
  float iceLine = clamp(0.64 + uTemperature * 0.008 - max(0.0,-uTemperature-10.0)*0.012, -0.2, 1.15);
  float ice = smoothstep(iceLine - 0.035, iceLine + 0.045, latitude + (detail - 0.5) * 0.13);
  ice = max(ice, smoothstep(0.14,0.30,height) * (1.0 - smoothstep(4.0,34.0,uTemperature)));
  vec3 ocean = mix(vec3(0.012,0.045,0.095), vec3(0.018,0.14,0.20), clamp((elevation - seaLevel + 0.24) * 4.0,0.0,1.0));
  ocean = mix(ocean, vec3(0.025,0.32,0.32), shore * 0.65);
  ocean += vec3(0.0,0.012,0.018) * detail;
  vec3 albedo = mix(ocean, land, coast);
  albedo = mix(albedo, vec3(0.74,0.83,0.83) * (0.9 + detail * 0.15), ice);
  albedo = mix(albedo, vec3(0.21,0.18,0.12), uPollution * 0.28);
  vec3 n = normalize(vNormal);
  vec3 q0 = dFdx(vWorldPosition), q1 = dFdy(vWorldPosition);
  vec3 s = cross(q1,n), t = cross(n,q0);
  float determinant = dot(q0,s);
  float bump = (detail * 0.008 + ridges * mountain * 0.018 + micro * 0.0009) * coast * (1.0 - ice * 0.6);
  vec3 gradient = sign(determinant) * (dFdx(bump) * s + dFdy(bump) * t);
  n = normalize(abs(determinant) * n - gradient);
  vec3 sun = normalize(vec3(-0.9,0.7,1.05));
  vec3 view = normalize(cameraPosition - vWorldPosition);
  float diffuse = dot(n,sun);
  float day = smoothstep(-0.16,0.13,diffuse);
  float light = max(diffuse,0.0);
  vec3 color = albedo * (0.045 + pow(light,0.8) * (1.0 + uSolar * 0.0028));
  vec3 halfway = normalize(sun + view);
  float specular = pow(max(dot(n,halfway),0.0), 95.0) * (1.0 - coast) * (1.0 - ice);
  color += vec3(0.50,0.72,0.73) * specular * 0.36;
  float settlements = step(0.83, noise3(p * 175.0 + seed)) * step(0.48,detail) * coast * (1.0-ice);
  float city = settlements * smoothstep(0.02,0.85,uCivilization) * (1.0-day);
  color += vec3(1.0,0.61,0.20) * city * 0.85;
  float fissure = pow(1.0 - abs(noise3(p * 65.0 + seed)-0.5)*2.0,24.0);
  float lava = fissure * smoothstep(0.57,0.69,detail) * coast * uVolcanism;
  color += vec3(1.0,0.17,0.015) * lava * (0.7 + sin(uTime*0.45)*0.12);
  float rim = pow(1.0 - max(dot(normalize(vNormal),view),0.0),3.7);
  float atmosphere = clamp(uGravity,0.2,2.0);
  color += mix(vec3(0.025,0.16,0.22),vec3(0.10,0.55,0.66),day) * rim * 0.47 * atmosphere;
  gl_FragColor = vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const cloudFragment = /* glsl */ `
precision highp float;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
uniform vec3 uSeed;
uniform float uHumidity;
uniform float uTemperature;
uniform float uPollution;
uniform float uTime;
${noiseGLSL}
void main() {
  vec3 p = normalize(vPosition);
  float warp = noise3(p * 3.0 + uSeed);
  float wind = p.y * 2.6 + sin(p.y * 7.0) * 0.22 + warp * 0.35;
  vec3 flow = vec3(p.x * cos(wind) - p.z * sin(wind),p.y,p.x * sin(wind) + p.z * cos(wind));
  vec3 warped = flow * vec3(5.0,7.5,5.0) + vec3(warp * 1.4,warp * 0.5,0.0) + uSeed;
  float density = fbm(warped);
  float strands = fbm(p * 16.0 + uSeed);
  float threshold = mix(0.66,0.45,uHumidity);
  float clouds = smoothstep(threshold,threshold + 0.13,density + strands * 0.12);
  float wisps = smoothstep(0.59,0.74,strands) * smoothstep(threshold-0.11,threshold+0.02,density);
  clouds = max(clouds,wisps * 0.24);
  float daylight = max(dot(normalize(vNormal),normalize(vec3(-0.9,0.7,1.05))),0.0);
  vec3 color = mix(vec3(0.69,0.80,0.83),vec3(0.67,0.59,0.44),uPollution * 0.6);
  color *= 0.06 + daylight * 1.1;
  float alpha = clouds * (0.35 + uHumidity * 0.35) * (1.0 - smoothstep(70.0,110.0,uTemperature));
  gl_FragColor = vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const atmosphereFragment = /* glsl */ `
precision highp float;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
uniform float uGravity;
uniform float uPollution;
void main() {
  vec3 view = normalize(cameraPosition - vWorldPosition);
  vec3 n = normalize(vNormal);
  float rim = pow(1.0 - abs(dot(n,view)), 3.1);
  float sun = smoothstep(-0.3,0.8,dot(n,normalize(vec3(-0.9,0.7,1.05))));
  vec3 color = mix(vec3(0.055,0.34,0.48),vec3(0.16,0.68,0.78),sun);
  color = mix(color,vec3(0.45,0.33,0.18),uPollution * 0.6);
  gl_FragColor = vec4(color,rim * (0.15 + sun * 0.35) * clamp(uGravity,0.3,1.7));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
