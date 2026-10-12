import * as THREE from 'three';
import { mergeGeometries } from './node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { leafTexture, seededRandom } from './nature-materials.js';

function branch(a,b,r0,r1){
  const g=new THREE.CylinderGeometry(r1,r0,a.distanceTo(b),6,1),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
  g.applyQuaternion(q);g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);return g;
}
function treeGeometry(type){
  const random=seededRandom(77+type*39),wood=[],leaves=[];
  const tall=type===2,evergreen=type===3,height=tall?10:8.2;
  const top=new THREE.Vector3(.15,height*.83,.1);
  wood.push(branch(new THREE.Vector3(),new THREE.Vector3(.03,3,0),.25,.16));
  wood.push(branch(new THREE.Vector3(.03,3,0),top,.16,.025));
  for(let k=0;k<13;k++){
    const angle=k*2.399+random()*.3,y=evergreen?2+k*.39:3.1+random()*2.5;
    const r=tall?.75+random()*.4:evergreen?2.4*(1-(y-2)/7):1.3+random()*1.2;
    const a=new THREE.Vector3(.03,y,0),b=new THREE.Vector3(Math.cos(angle)*r*.55,y+.55,Math.sin(angle)*r*.55),end=new THREE.Vector3(Math.cos(angle)*r,y+1.2,Math.sin(angle)*r);
    wood.push(branch(a,b,.075,.042),branch(b,end,.042,.012));
    for(let j=0;j<20;j++){
      const theta=random()*Math.PI*2,rad=Math.sqrt(random())*(tall?.68:1.1);
      const x=end.x+Math.cos(theta)*rad,z=end.z+Math.sin(theta)*rad,yy=end.y+(random()-.4)*(tall?1.9:1.4);
      const g=new THREE.PlaneGeometry((evergreen?.72:1.05)*( .75+random()*.6),(.75+random()*.65));
      g.rotateX(random()*Math.PI);g.rotateY(random()*Math.PI*2);g.rotateZ(random()*Math.PI);
      g.translate(x,yy,z);leaves.push(g);
    }
  }
  for(let j=0;j<45;j++){
    const a=random()*Math.PI*2,r=random()*(tall?.7:1.2),g=new THREE.PlaneGeometry(.9,1.05);
    g.rotateX(random()*Math.PI);g.rotateY(random()*Math.PI*2);g.translate(Math.cos(a)*r,height-.7+random(),Math.sin(a)*r);leaves.push(g);
  }
  const result={wood:mergeGeometries(wood),leaves:mergeGeometries(leaves)};wood.forEach(g=>g.dispose());leaves.forEach(g=>g.dispose());return result;
}

export function createForest(world,trees,materials){
  const atlas=leafTexture(),wind={value:0},strength={value:1},random=seededRandom(835),batches=[];
  const deform=shader=>{
    shader.uniforms.uWindTime=wind;shader.uniforms.uWindStrength=strength;
    shader.vertexShader='uniform float uWindTime;uniform float uWindStrength;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float windPhase=0.0;
      #ifdef USE_INSTANCING
        windPhase=instanceMatrix[3].x*.13+instanceMatrix[3].z*.11;
      #endif
      float sway=pow(max(position.y-2.0,0.0)/8.0,1.5)*uWindStrength;
      transformed.x+=sin(uWindTime*.9+windPhase+position.y*.45)*.085*sway;
      transformed.z+=cos(uWindTime*.7+windPhase+position.x)*.05*sway;`);
  };
  for(let type=0;type<4;type++){
    const group=trees.filter(t=>t.type===type);if(!group.length)continue;
    const geo=treeGeometry(type);
    const leafMat=new THREE.MeshStandardMaterial({map:atlas,alphaTest:.45,side:THREE.DoubleSide,roughness:.93,metalness:0});
    leafMat.name='foliage-'+type;leafMat.onBeforeCompile=deform;
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:atlas,alphaTest:.45,side:THREE.DoubleSide});depth.onBeforeCompile=deform;
    const leafMesh=new THREE.InstancedMesh(geo.leaves,leafMat,group.length),trunkMesh=new THREE.InstancedMesh(geo.wood,materials.bark,group.length);
    leafMesh.customDepthMaterial=depth;leafMesh.castShadow=trunkMesh.castShadow=true;leafMesh.receiveShadow=trunkMesh.receiveShadow=true;
    const dummy=new THREE.Object3D(),base=new THREE.Color(['#708444','#a39849','#718b50','#45624a'][type]);
    group.forEach((tree,i)=>{
      dummy.position.set(tree.x,tree.y||0,tree.z);dummy.rotation.set(0,tree.rotation,0);dummy.scale.set(tree.scale,tree.scale,tree.scale);dummy.updateMatrix();
      leafMesh.setMatrixAt(i,dummy.matrix);trunkMesh.setMatrixAt(i,dummy.matrix);
      leafMesh.setColorAt(i,base.clone().multiplyScalar(.8+random()*.35));
    });
    for(const mesh of [leafMesh,trunkMesh]){mesh.computeBoundingSphere();world.add(mesh);batches.push(mesh);}
  }
  return {treeCount:trees.length,update(time){wind.value=time;},setQuality(high){strength.value=high?1:.45;for(const b of batches)b.castShadow=high;}};
}
