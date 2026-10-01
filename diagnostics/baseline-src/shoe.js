import * as THREE from 'three';

/* PACE / Forma 01. Original procedural last, panels, sole and textile.
 * Coordinates: toe +X, outer side +Z, sole around Y=0.
 * No downloaded geometry, scanned product or borrowed brand marks.
 */

const TAU = Math.PI * 2;
const profile = [
  [-2.15, .035, .15, .08], [-2.06, .28, .19, .39],
  [-1.87, .48, .22, .77], [-1.62, .55, .24, 1.01],
  [-1.30, .57, .245, 1.07], [-.95, .565, .24, 1.00],
  [-.60, .55, .225, .94], [-.25, .565, .20, .84],
  [.15, .615, .18, .72], [.55, .655, .18, .60],
  [.95, .65, .20, .48], [1.35, .60, .245, .35],
  [1.68, .485, .305, .24], [1.92, .31, .38, .14],
  [2.06, .10, .425, .045], [2.10, .005, .435, .006],
];

function interp(x, col) {
  let i = 0;
  while (i < profile.length - 2 && profile[i + 1][0] < x) i++;
  const p0 = profile[Math.max(0, i - 1)][col];
  const p1 = profile[i][col];
  const p2 = profile[i + 1][col];
  const p3 = profile[Math.min(profile.length - 1, i + 2)][col];
  const t = THREE.MathUtils.clamp((x - profile[i][0]) / (profile[i + 1][0] - profile[i][0]), 0, 1);
  return .5 * ((2 * p1) + (-p0 + p2) * t + (2*p0 - 5*p1 + 4*p2 - p3)*t*t + (-p0 + 3*p1 - 3*p2 + p3)*t*t*t);
}

function upperPoint(x, theta, offset = 0) {
  const w = interp(x, 1), base = interp(x, 2), h = interp(x, 3);
  const s = Math.max(0, Math.sin(theta));
  return new THREE.Vector3(x, base + h * Math.pow(s, .72) + offset * s, (w + offset) * Math.cos(theta));
}

function surfaceAtXZ(x, z, offset = 0) {
  const width = Math.max(.01, interp(x, 1));
  return upperPoint(x, Math.acos(THREE.MathUtils.clamp(z / width, -.999, .999)), offset);
}

function tonguePoint(x,z) {
  const u=THREE.MathUtils.clamp((x+.72)/1.65,0,1),width=.23+.045*Math.sin(u*Math.PI);
  const v=THREE.MathUtils.clamp((z/width+1)/2,0,1),t=THREE.MathUtils.clamp((1-u)/.16,0,1);
  const blend=t*t*(3-2*t),p=surfaceAtXZ(x,z);
  p.y+=(.027+.045*Math.pow(Math.sin(v*Math.PI),2)+.035*Math.pow(1-u,4))*blend-.006*(1-blend);
  return p;
}

function foamBottom(x) {
  return -.245 + .09 * Math.pow((x + 1.6)/3.6, 2) + .405 * Math.pow(Math.max(0, (x-.45)/1.67), 2);
}

function makeGeometry(positions, indices, uvs) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function mergedGeometry(geometries) {
  const pos = [], normals = [], uv = [];
  for (const geometry of geometries) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u?.getX(i) || 0, u?.getY(i) || 0);
    }
    if (g !== geometry) g.dispose();
    geometry.dispose();
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return result;
}

function makeTextiles() {
  const size = 256;
  const diffuse = document.createElement('canvas'); diffuse.width = diffuse.height = size;
  const normal = document.createElement('canvas'); normal.width = normal.height = size;
  const rough = document.createElement('canvas'); rough.width = rough.height = size;
  const dc = diffuse.getContext('2d'), nc = normal.getContext('2d'), rc = rough.getContext('2d');
  const di = dc.createImageData(size,size), ni = nc.createImageData(size,size), ri = rc.createImageData(size,size);
  // An eight-pixel knit repeat, offset rows, filament substructure and deterministic fuzz.
  const height = (x,y) => {
    const row = Math.floor(y/8), sx = (x + (row % 2)*4) % 8, sy = y % 8;
    const loop = Math.exp(-Math.pow((sx - 4 - 2*Math.sin(sy/8*Math.PI))/1.65,2));
    const strand = .18*Math.sin((x+y)*Math.PI) + .15*Math.sin(x*2.13+y*1.91);
    return loop*.75 + strand*.18;
  };
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const idx=(y*size+x)*4, h=height(x,y);
    const noise = Math.sin(x*127.1+y*311.7)*43758.5453 % 1;
    const v = THREE.MathUtils.clamp(219 + h*29 + noise*5,0,255);
    di.data.set([v,v,v,255],idx);
    const dx=(height(x+1,y)-height(x-1,y))*.82, dy=(height(x,y+1)-height(x,y-1))*.82;
    const normalVec = new THREE.Vector3(-dx,-dy,1).normalize();
    ni.data.set([128+normalVec.x*127,128+normalVec.y*127,128+normalVec.z*127,255],idx);
    const r=THREE.MathUtils.clamp(212-h*24+noise*11,0,255); ri.data.set([r,r,r,255],idx);
  }
  dc.putImageData(di,0,0); nc.putImageData(ni,0,0); rc.putImageData(ri,0,0);
  const configure = (canvas, srgb=false) => {const t=new THREE.CanvasTexture(canvas); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,5); t.anisotropy=4; if(srgb)t.colorSpace=THREE.SRGBColorSpace; return t;};
  return {map:configure(diffuse,true), normalMap:configure(normal), roughnessMap:configure(rough)};
}

function makeGrain() {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'), data=ctx.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++) {
    const v=228+Math.sin(x*12.9898+y*78.233)*12+Math.sin(x*2.13+y*3.71)*7;
    data.data.set([v,v,v,255],(y*128+x)*4);
  }
  ctx.putImageData(data,0,0);
  const texture=new THREE.CanvasTexture(canvas); texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.repeat.set(10,3);
  return texture;
}

function upperGeometry() {
  const positions=[],uvs=[],indices=[],nx=120,nt=56;
  for(let i=0;i<=nx;i++)for(let j=0;j<=nt;j++) {
    const x=THREE.MathUtils.lerp(-2.15,2.10,i/nx),theta=j/nt*Math.PI,p=upperPoint(x,theta);
    positions.push(p.x,p.y,p.z);uvs.push(i/nx,j/nt);
  }
  const hole = (index) => {
    const x=positions[index*3],y=positions[index*3+1],z=positions[index*3+2];
    return ((x+1.17)/.635)**2 + (z/.365)**2 < 1 && y > .83;
  };
  for(let i=0;i<nx;i++)for(let j=0;j<nt;j++) {
    const a=i*(nt+1)+j,b=a+nt+1;
    if(!hole(a)&&!hole(b)&&!hole(a+1))indices.push(a,b,a+1);
    if(!hole(a+1)&&!hole(b)&&!hole(b+1))indices.push(a+1,b,b+1);
  }
  return makeGeometry(positions,indices,uvs);
}

function soleGeometry() {
  const positions=[],indices=[],uvs=[],nx=112,nt=28;
  for(let i=0;i<=nx;i++)for(let j=0;j<=nt;j++) {
    const x=THREE.MathUtils.lerp(-2.23,2.16,i/nx),px=THREE.MathUtils.clamp(x,-2.15,2.10);
    const edgeT=THREE.MathUtils.clamp(Math.min((x+2.23)/.23,(2.16-x)/.20),0,1);
    const endFalloff=Math.sqrt(1-(1-edgeT)*(1-edgeT));
    const w=(interp(px,1)+.068)*endFalloff;
    const top=interp(px,2)+.065,bottom=foamBottom(px),theta=j/nt*TAU;
    const z=w*Math.sign(Math.cos(theta))*Math.pow(Math.abs(Math.cos(theta)),.40);
    const y=(top+bottom)/2+(top-bottom)/2*endFalloff*Math.sign(Math.sin(theta))*Math.pow(Math.abs(Math.sin(theta)),.75);
    positions.push(x,y,z);uvs.push(i/nx,j/nt);
  }
  for(let i=0;i<nx;i++)for(let j=0;j<nt;j++) {const a=i*(nt+1)+j,b=a+nt+1;indices.push(a,b,a+1,a+1,b,b+1);}
  return makeGeometry(positions,indices,uvs);
}

function tube(points, radius=.018, segments=64, radial=6, closed=false) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,closed,'centripetal'),segments,radius,radial,closed);
}

function panel(points, side=1, offset=.012, resolution=8) {
  // Triangulate the original panel outline in (x,theta), then subdivide each face
  // and map every point onto the same curved last. No floating flat decals.
  const outline=points.map(p=>new THREE.Vector2(p[0],p[1]));
  const faces=THREE.ShapeUtils.triangulateShape(outline,[]),pos=[],uv=[],idx=[],normals=[];
  for(const face of faces) {
    const a=outline[face[0]],b=outline[face[1]],c=outline[face[2]];
    const start=pos.length/3, rows=[];
    for(let i=0;i<=resolution;i++) {
      rows[i]=[];
      for(let j=0;j<=resolution-i;j++) {
        const u=i/resolution,v=j/resolution,x=a.x*(1-u-v)+b.x*u+c.x*v,t=a.y*(1-u-v)+b.y*u+c.y*v;
        const theta=side===1?t:Math.PI-t;
        const p=upperPoint(x,theta,offset);
        // Every panel vertex uses the underlying last's analytical normal. A
        // separately triangulated pattern must not light like disconnected shards.
        const tx=upperPoint(x+.0005,theta,offset).sub(upperPoint(x-.0005,theta,offset));
        const tt=upperPoint(x,theta+.0005,offset).sub(upperPoint(x,theta-.0005,offset));
        const normal=new THREE.Vector3().crossVectors(tx,tt).normalize();
        normals.push(normal.x,normal.y,normal.z);
        rows[i][j]=pos.length/3;pos.push(p.x,p.y,p.z);uv.push((x+2.15)/4.25,t/Math.PI);
      }
    }
    for(let i=0;i<resolution;i++)for(let j=0;j<resolution-i;j++) {
      idx.push(rows[i][j],rows[i+1][j],rows[i][j+1]);
      if(j<resolution-i-1)idx.push(rows[i+1][j],rows[i+1][j+1],rows[i][j+1]);
    }
    void start;
  }
  if(side===-1)for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
  const g=makeGeometry(pos,idx,uv);
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  return g;
}

function smoothOutline(points, count=42) {
  const curve=new THREE.CatmullRomCurve3(points.map(([x,t])=>new THREE.Vector3(x,t,0)),true,'centripetal');
  return Array.from({length:count},(_,i)=>{const p=curve.getPoint(i/count);return[p.x,p.y];});
}

function ribbonBetween(pointsA,pointsB) {
  const pos=[],uv=[],idx=[];
  for(let i=0;i<pointsA.length;i++){pos.push(...pointsA[i].toArray(),...pointsB[i].toArray());uv.push(i/(pointsA.length-1),0,i/(pointsA.length-1),1);}
  for(let i=0;i<pointsA.length-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  return makeGeometry(pos,idx,uv);
}

function labelTexture(text, color='#143ffe', background='transparent') {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');
  if(background!=='transparent'){ctx.fillStyle=background;ctx.fillRect(0,0,512,128);}
  ctx.fillStyle=color;ctx.font='italic 900 100px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,68);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function createPaceShoe() {
  const group=new THREE.Group();group.name='PACE Forma 01 — original procedural running shoe';
  const textile=makeTextiles(),grain=makeGrain();
  const materials={
    upper:new THREE.MeshStandardMaterial({color:'#e2e0d7',...textile,roughness:.98,normalScale:new THREE.Vector2(.48,.48),side:THREE.DoubleSide}),
    foam:new THREE.MeshStandardMaterial({color:'#c8cbd1',roughness:.83,bumpMap:grain,bumpScale:.009}),
    structure:new THREE.MeshStandardMaterial({color:'#1f45e6',roughness:.46,metalness:.05,side:THREE.DoubleSide}),
    accent:new THREE.MeshStandardMaterial({color:'#dbfa37',roughness:.63}),
    outsole:new THREE.MeshStandardMaterial({color:'#202325',roughness:.91,bumpMap:grain,bumpScale:.012}),
    lining:new THREE.MeshStandardMaterial({color:'#14191d',roughness:.97,...textile,normalScale:new THREE.Vector2(.24,.24),side:THREE.DoubleSide}),
    laces:new THREE.MeshStandardMaterial({color:'#fffdf0',roughness:.84,bumpMap:grain,bumpScale:.009}),
    stitching:new THREE.MeshStandardMaterial({color:'#b8b9ad',roughness:.90}),
    eyelets:new THREE.MeshStandardMaterial({color:'#171d2b',roughness:.37,metalness:.15}),
  };
  const add=(g,m,name)=>{const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  add(soleGeometry(),materials.foam,'Sculpted rocker midsole');
  add(upperGeometry(),materials.upper,'Continuous woven upper with open collar');

  // Genuine opening: contoured padded rim, descending inner wall and deep insole.
  const rim=[],inner=[],bottom=[];
  for(let i=0;i<96;i++) {
    const a=i/96*TAU,x=-1.17+Math.cos(a)*.635,z=Math.sin(a)*.365;
    const p=surfaceAtXZ(x,z,.012);rim.push(p);
    inner.push(new THREE.Vector3(x,p.y-.08,z));
    bottom.push(new THREE.Vector3(-1.17+Math.cos(a)*.55,.65,Math.sin(a)*.295));
  }
  add(tube(rim,.093,128,10,true),materials.lining,'Padded textile collar');
  add(ribbonBetween([...inner,inner[0]],[...bottom,bottom[0]]),materials.lining,'Collar interior wall');
  const insole=new THREE.SphereGeometry(1,40,16);insole.scale(.62,.035,.36);insole.translate(-1.17,.66,0);
  add(insole,materials.lining,'Dark recessed insole');

  // Padded tongue follows the last and rolls up slightly at the collar.
  const tonguePos=[],tongueUv=[],tongueIdx=[],tx=30,tz=16;
  for(let i=0;i<=tx;i++)for(let j=0;j<=tz;j++) {
    const u=i/tx,v=j/tz,x=THREE.MathUtils.lerp(-.72,.93,u),width=.23+.045*Math.sin(u*Math.PI),z=(v-.5)*2*width;
    const p=tonguePoint(x,z);
    tonguePos.push(p.x,p.y,p.z);tongueUv.push(u*1.2,v*.4);
  }
  for(let i=0;i<tx;i++)for(let j=0;j<tz;j++){const a=i*(tz+1)+j,b=a+tz+1;tongueIdx.push(a,b,a+1,a+1,b,b+1);}
  add(makeGeometry(tonguePos,tongueIdx,tongueUv),materials.upper,'Padded woven tongue');
  const tongueSeams=[];
  for(const side of[-1,1]){const pts=[];for(let i=0;i<=28;i++){const u=i/28,x=THREE.MathUtils.lerp(-.72,.84,u),z=side*(.23+.045*Math.sin(u*Math.PI));const p=tonguePoint(x,z);p.y+=.007;pts.push(p);}tongueSeams.push(tube(pts,.006,48,5));}
  add(mergedGeometry(tongueSeams),materials.stitching,'Tongue perimeter seam');

  // One flowing saddle carries the eyestay into a rounded heel counter.
  const overlays=[],eyestays=[],stitches=[],seamDashes=[];
  const heelPanel=smoothOutline([[-2.04,.12],[-1.98,.48],[-1.75,.66],[-1.49,.68],[-1.23,.48],[-1.27,.17]]);
  const saddlePanel=smoothOutline([[-1.69,.18],[-1.69,.45],[-1.39,.65],[-.98,.72],[-.57,.87],[-.27,1.07],[.25,1.09],[.28,.96],[-.14,.82],[-.48,.63],[-.96,.41],[-1.24,.22]],56);
  const stay=smoothOutline([[-.63,1.03],[-.49,1.18],[.85,1.18],[.97,1.09],[.81,.98],[-.36,.96]],36);
  for(const side of[-1,1]) {
    for(const outline of[heelPanel,saddlePanel]) overlays.push(panel(outline,side,.037,8));
    eyestays.push(panel(stay,side,.054,8));
    // Sparse, real modeled saddle stitches along the toe boundary.
    for(let i=0;i<52;i++) {
      const x=THREE.MathUtils.lerp(-1.9,1.94,i/51),t=.15;
      const p=upperPoint(x,side===1?t:Math.PI-t,.024);
      const q=upperPoint(x+.035,side===1?t:Math.PI-t,.024);
      seamDashes.push(tube([p,q],.0046,1,4));
    }
    const seam=[];for(let i=0;i<=60;i++){const x=THREE.MathUtils.lerp(-1.97,1.98,i/60);seam.push(upperPoint(x,side===1?.105:Math.PI-.105,.01));}
    stitches.push(tube(seam,.011,90,5));
  }
  add(mergedGeometry(overlays),materials.structure,'Molded structural saddle panels');
  add(mergedGeometry(eyestays),materials.structure,'Reinforced lace eyestays');
  add(mergedGeometry(stitches),materials.stitching,'Upper to midsole seam');
  add(mergedGeometry(seamDashes),materials.stitching,'Individual upper stitch runs');

  // Eyelets orient perpendicular to their local last normal. Lace pairs cross with depth.
  const eyeletGeometries=[],laceGeometries=[],laceXs=[.79,.49,.17,-.15,-.47];
  const eyeLocations=[];
  for(let i=0;i<laceXs.length;i++) {
    const x=laceXs[i],pair=[];
    for(const side of[-1,1]) {
      const p=surfaceAtXZ(x,side*.28,.06);pair.push(p);
      const g=new THREE.TorusGeometry(.038,.011,6,12);
      // Torus starts with normal +Z; surface normal leans toward the lace edge.
      const n=new THREE.Vector3(0,.9,side*.44).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),n));g.translate(p.x,p.y,p.z);
      eyeletGeometries.push(g);
    }
    eyeLocations.push(pair);
  }
  const overTongue=(a,b,layer=0)=>{
    const points=[];
    for(let i=0;i<=16;i++){
      const t=i/16,p=a.clone().lerp(b,t),envelope=Math.sin(t*Math.PI);
      const top=tonguePoint(p.x,p.z).y;
      p.y=Math.max(p.y,top+(.035+layer)*envelope)+.018*envelope;
      points.push(p);
    }
    return tube(points,.024,32,7);
  };
  for(let i=0;i<eyeLocations.length-1;i++)for(let side=0;side<2;side++) {
    laceGeometries.push(overTongue(eyeLocations[i][side],eyeLocations[i+1][1-side],side*.056));
  }
  const first=eyeLocations[0];laceGeometries.push(overTongue(first[0],first[1]));
  const knot=tonguePoint(-.48,0);knot.y+=.058;
  for(const side of[-1,1]) {
    const loop=[knot.clone(),new THREE.Vector3(-.58,knot.y+.047,side*.16),new THREE.Vector3(-.70,knot.y+.038,side*.20),new THREE.Vector3(-.66,knot.y+.009,side*.10),knot.clone()];
    laceGeometries.push(tube(loop,.023,28,7));
    const tip=new THREE.Vector3(-.37,knot.y-.068,side*.36);
    laceGeometries.push(tube([knot.clone(),new THREE.Vector3(-.33,knot.y+.006,side*.20),tip],.023,18,7));
  }
  add(mergedGeometry(eyeletGeometries),materials.eyelets,'Ten recessed lace eyelets');
  add(mergedGeometry(laceGeometries),materials.laces,'Crossed round laces with tied loops');

  // Fine foam line and inset heel insert make the tooling legible in side light.
  const tooling=[],accentLines=[];
  for(const side of[-1,1]) {
    const line=[];
    for(let i=0;i<=58;i++){const x=THREE.MathUtils.lerp(-2.02,1.93,i/58),z=side*(interp(x,1)+.062),y=interp(x,2)-.135+.025*Math.sin((x+2)*3);line.push(new THREE.Vector3(x,y,z));}
    tooling.push(tube(line,.014,96,5));
    const accent=[];for(let i=0;i<=24;i++){const x=THREE.MathUtils.lerp(-1.94,-.72,i/24);accent.push(new THREE.Vector3(x,interp(x,2)-.067,side*(interp(x,1)+.068)));}
    accentLines.push(tube(accent,.027,36,6));
  }
  add(mergedGeometry(tooling),materials.stitching,'Recessed midsole tooling lines');
  add(mergedGeometry(accentLines),materials.accent,'Heel energy-color insert');

  // Individual rubber rails follow the rocker, leaving foam channels exposed.
  const treads=[],accentTreads=[];
  for(let i=0;i<16;i++) {
    const x=THREE.MathUtils.lerp(-2.00,1.99,i/15),width=interp(x,1)*.93;
    for(const side of[-1,1]) {
      const len=Math.max(.08,width-.085),shape=new THREE.Shape(),rw=.047,halfX=.078,halfZ=len/2;
      shape.moveTo(-halfX+rw,-halfZ);shape.lineTo(halfX-rw,-halfZ);shape.quadraticCurveTo(halfX,-halfZ,halfX,-halfZ+rw);shape.lineTo(halfX,halfZ-rw);shape.quadraticCurveTo(halfX,halfZ,halfX-rw,halfZ);shape.lineTo(-halfX+rw,halfZ);shape.quadraticCurveTo(-halfX,halfZ,-halfX,halfZ-rw);shape.lineTo(-halfX,-halfZ+rw);shape.quadraticCurveTo(-halfX,-halfZ,-halfX+rw,-halfZ);
      const g=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.008,bevelThickness:.008,curveSegments:3});
      g.rotateX(Math.PI/2);g.translate(x,foamBottom(x)-.002,side*(len/2+.055));
      (i===1||i===12?accentTreads:treads).push(g);
    }
  }
  add(mergedGeometry(treads),materials.outsole,'Segmented rubber outsole rails');
  add(mergedGeometry(accentTreads),materials.accent,'Acid outsole signature segments');

  // Heel pull loop: woven strip with two stitched edges, not a solid block.
  const pullA=[],pullB=[];
  // Both ends meet the actual heel skin below its collar, with one small loop.
  const pullPath=[[-1.995,.71],[-2.005,.94],[-1.91,1.12],[-1.80,1.14],[-1.75,1.03]];
  for(const [x,y]of pullPath){pullA.push(new THREE.Vector3(x,y,-.07));pullB.push(new THREE.Vector3(x,y,.07));}
  add(ribbonBetween(pullA,pullB),materials.accent,'Woven heel pull loop');

  const logoTexture=labelTexture('PACE','#eceede');
  const logoMat=new THREE.MeshStandardMaterial({map:logoTexture,transparent:true,roughness:.75,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
  const logoP=[],logoUV=[],logoI=[];
  for(let i=0;i<=16;i++)for(let j=0;j<=4;j++) {
    const p=upperPoint(THREE.MathUtils.lerp(-1.85,-1.40,i/16),THREE.MathUtils.lerp(.37,.52,j/4),.065);
    logoP.push(p.x,p.y,p.z);logoUV.push(i/16,j/4);
  }
  for(let i=0;i<16;i++)for(let j=0;j<4;j++){const a=i*5+j,b=a+5;logoI.push(a,b,a+1,a+1,b,b+1);}
  add(makeGeometry(logoP,logoI,logoUV),logoMat,'Original PACE wordmark following heel curvature');
  const numberTexture=labelTexture('01','#1f45e6');
  const numberMat=new THREE.MeshStandardMaterial({map:numberTexture,transparent:true,roughness:.8,depthWrite:false,side:THREE.DoubleSide});
  const number=add(new THREE.PlaneGeometry(.24,.075),numberMat,'Original model number');
  number.position.set(.20,.017,.706);

  const colorways={
    chalk:{upper:'#e2e0d7',foam:'#c8cbd1',structure:'#17399c',accent:'#d2ef31',laces:'#23365f',stitching:'#9b9f9a',outsole:'#202527'},
    cobalt:{upper:'#3151ed',foam:'#e9e8dd',structure:'#14298a',accent:'#dfff3b',laces:'#eaf0ff',stitching:'#99a6f0',outsole:'#1a1e26'},
    acid:{upper:'#dcf166',foam:'#f1eedb',structure:'#282e31',accent:'#204bed',laces:'#f4f7da',stitching:'#abbc56',outsole:'#222729'},
  };
  function setColorway(name='chalk') {const palette=colorways[name]||colorways.chalk;for(const[key,value]of Object.entries(palette))materials[key].color.set(value);group.userData.colorway=name in colorways?name:'chalk';}
  setColorway('chalk');
  const geometries=new Set(),allMaterials=new Set(),textures=new Set();let triangles=0,drawCalls=0;
  group.traverse(obj=>{if(obj.isMesh){geometries.add(obj.geometry);triangles+=(obj.geometry.index?.count||obj.geometry.attributes.position.count)/3;drawCalls++;for(const m of Array.isArray(obj.material)?obj.material:[obj.material]){allMaterials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}}});
  return {
    group,materials,setColorway,
    info:{name:'PACE Forma 01',geometry:'One original procedural last; all views and colorways share identical geometry.',colorways:Object.keys(colorways),triangles,drawCalls,textureCount:textures.size,bounds:new THREE.Box3().setFromObject(group),cameraHint:{position:[5,3,7],target:[0,.55,0]},macroHint:{position:[2.0,2.3,2.2],target:[.5,.65,.1]},provenance:'Authored procedural geometry and CanvasTextures; PACE wordmark typeset using system Arial.'},
    dispose(){for(const g of geometries)g.dispose();for(const m of allMaterials)m.dispose();for(const t of textures)t.dispose();},
  };
}
