import * as THREE from 'three';
import { Sky } from './node_modules/three/examples/jsm/objects/Sky.js';

// Scattered daylight and continuous clouds, with no mesh edges at the horizon.
export function createAtmosphere(scene,renderer){
  const sky=new Sky();sky.scale.setScalar(5000);sky.frustumCulled=false;
  sky.material.depthWrite=false;sky.renderOrder=-10;
  const uniforms=sky.material.uniforms;
  uniforms.turbidity.value=3.2;uniforms.rayleigh.value=1.7;
  uniforms.mieCoefficient.value=.004;uniforms.mieDirectionalG.value=.8;
  uniforms.sunPosition.value.set(-150,350,180);
  uniforms.cloudTime={value:0};
  sky.material.fragmentShader=sky.material.fragmentShader.replace('void main() {',`
    uniform float cloudTime;
    float cloudHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float cloudNoise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(cloudHash(i),cloudHash(i+vec2(1,0)),f.x),mix(cloudHash(i+vec2(0,1)),cloudHash(i+vec2(1,1)),f.x),f.y);
    }
    float cloudFbm(vec2 p){
      float value=0.0,amplitude=0.5;
      for(int i=0;i<5;i++){value+=amplitude*cloudNoise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+13.4;amplitude*=0.5;}
      return value;
    }
    void main() {
  `).replace('gl_FragColor = vec4( retColor, 1.0 );',`
    retColor*=0.42;
    if(direction.y>0.025){
      vec2 p=direction.xz/max(direction.y,0.03)*2.5+vec2(cloudTime*0.003,cloudTime*0.001);
      float detail=cloudFbm(p);
      float cloud=smoothstep(0.49,0.70,detail)*smoothstep(0.025,0.15,direction.y);
      float light=clamp(0.65+(cloudFbm(p+vec2(-0.18,0.24))-detail)*3.0,0.2,1.0);
      vec3 cloudColor=mix(vec3(0.73,0.83,0.94),vec3(1.7,1.68,1.57),light);
      retColor=mix(retColor,cloudColor,cloud*0.94);
    }
    gl_FragColor = vec4( retColor, 1.0 );
  `);
  scene.add(sky);scene.background=null;scene.fog=new THREE.Fog('#c3d3d9',320,1600);
  const environment=new THREE.Scene();environment.add(sky.clone());
  const generator=new THREE.PMREMGenerator(renderer);
  const target=generator.fromScene(environment,.04,.1,10000);
  scene.environment=target.texture;scene.environmentIntensity=.45;generator.dispose();
  return {sky,update(time){uniforms.cloudTime.value=time;}};
}
