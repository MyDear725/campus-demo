import * as THREE from 'three';

export function seededRandom(seed=7){return ()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);}
function texture(data,size,color=true){
  const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;
  t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;t.needsUpdate=true;return t;
}
export function surfaceTexture(kind){
  const size=256,data=new Uint8Array(size*size*4),random=seededRandom(123);
  const palette={grass:[89,107,62],asphalt:[73,77,77],paving:[167,162,145],stone:[150,151,137],bark:[91,79,61],rock:[119,123,109],soil:[103,97,71]};
  const base=palette[kind]||palette.stone;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let grain=(random()-.5)*(kind==='asphalt'?28:22),macro=Math.sin(x*.049)*Math.cos(y*.074)*6;
    if(kind==='grass'){macro=0;grain=(random()-.5)*22;}
    if(kind==='paving'){
      const row=Math.floor(y/32),seam=y%32<2||(x+(row%2)*32)%64<2;
      grain+=seam?-42:((row*31+Math.floor((x+row%2*32)/64)*17)%13)-6;
    }
    if(kind==='bark')grain+=Math.sin(x*.39+Math.sin(y*.05)*1.6)*18+Math.sin(x*1.1+y*.015)*10;
    if(kind==='asphalt'&&random()>.987)grain+=35;
    const i=(y*size+x)*4;for(let k=0;k<3;k++)data[i+k]=Math.max(0,Math.min(255,base[k]+grain+macro));data[i+3]=255;
  }
  return texture(data,size);
}

// Original cutout leaf sprig, rendered into a small reusable atlas in code.
export function leafTexture(){
  const size=128,data=new Uint8Array(size*size*4),random=seededRandom(511);
  for(let leaf=0;leaf<34;leaf++){
    const cx=15+random()*98,cy=12+random()*104,angle=random()*Math.PI*2;
    const rx=8+random()*8,ry=4+random()*4,co=Math.cos(angle),si=Math.sin(angle),shade=155+random()*90;
    for(let y=Math.max(0,Math.floor(cy-18));y<Math.min(size,cy+18);y++)for(let x=Math.max(0,Math.floor(cx-18));x<Math.min(size,cx+18);x++){
      const u=((x-cx)*co+(y-cy)*si)/rx,v=(-(x-cx)*si+(y-cy)*co)/ry;
      const radius=u*u+v*v,serration=1+.04*Math.sin(Math.atan2(v,u)*12);
      if(radius>serration)continue;
      const i=(y*size+x)*4,vein=Math.abs(v)<.065?18:0;
      const light=shade+(1-v)*8+vein;
      data[i]=Math.min(255,light);data[i+1]=Math.min(255,light+6);data[i+2]=Math.min(255,light-12);
      data[i+3]=Math.min(255,(serration-radius)*1500);
    }
  }
  const t=texture(data,size);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;
}

export function waterNormals(){
  const size=256,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
    const dx=.075*Math.cos(u*8+v*3)+.047*Math.cos(u*19-v*7)+.031*Math.cos(u*37+v*13);
    const dy=.073*Math.sin(v*9-u*2)+.044*Math.sin(v*23+u*5)+.027*Math.cos(v*41-u*17);
    const n=new THREE.Vector3(dx,dy,1).normalize(),i=(y*size+x)*4;
    data[i]=(n.x*.5+.5)*255;data[i+1]=(n.y*.5+.5)*255;data[i+2]=(n.z*.5+.5)*255;data[i+3]=255;
  }
  return texture(data,size,false);
}

export function createNatureMaterials(){
  const materials={};
  for(const kind of ['grass','asphalt','paving','stone','bark','rock','soil']){
    const map=surfaceTexture(kind);
    materials[kind]=new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:kind==='bark'?.13:kind==='grass'?.023:.028,roughness:kind==='asphalt'?.96:.88});
    materials[kind].name='nature-'+kind;
  }
  materials.paint=new THREE.MeshStandardMaterial({color:'#e3e0c8',roughness:.88});
  materials.steel=new THREE.MeshStandardMaterial({color:'#56646a',roughness:.42,metalness:.65});
  materials.wood=new THREE.MeshStandardMaterial({color:'#776245',map:materials.bark.map,roughness:.85});
  return materials;
}
