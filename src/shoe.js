import * as THREE from 'three';

/* PACE / Drift 01 — original, deterministic procedural running-shoe asset.
 * Toe +X, outer side +Z, Y up. Geometry is shared by every camera and finish.
 * Textile is a small directional jacquard colour/normal pair, not modeled stitches.
 */
const PI = Math.PI, TAU = PI * 2, clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
// x, half-width, lower seam, upper height. A tapered toe and waist precede any detail.
const last = [
  [-2.14,.006,.20,.025],[-2.05,.24,.18,.39],[-1.88,.365,.17,.64],
  [-1.61,.415,.16,.75],[-1.30,.435,.15,.78],[-.94,.435,.14,.82],
  [-.57,.45,.13,.81],[-.20,.49,.125,.76],[.22,.535,.13,.68],
  [.63,.565,.15,.55],[1.05,.545,.185,.43],[1.42,.47,.235,.33],
  [1.75,.365,.265,.265],[1.94,.235,.300,.215],[2.055,.135,.316,.150],[2.12,.062,.322,.083],[2.15,.003,.327,.012],
];
function shape(x,c){
  let k=0; while(k<last.length-2 && last[k+1][0]<x) k++;
  const t=clamp((x-last[k][0])/(last[k+1][0]-last[k][0]),0,1);
  const a=last[Math.max(0,k-1)][c],b=last[k][c],d=last[k+1][c],e=last[Math.min(last.length-1,k+2)][c];
  return .5*((2*b)+(-a+d)*t+(2*a-5*b+4*d-e)*t*t+(-a+3*b-3*d+e)*t*t*t);
}
function skin(x,t,offset=0){
  const s=Math.max(0,Math.sin(t));
  // Flatter athletic vamp, rounded shoulder, and slight medial waist asymmetry.
  const w=shape(x,1)*(1+(Math.cos(t)<0?-.03:0)*Math.exp(-Math.pow((x+.45)/.9,2)));
  return new THREE.Vector3(x,shape(x,2)+shape(x,3)*Math.pow(s,.84)+offset*s,(w+offset)*Math.cos(t));
}
function normalAt(x,t){
  return new THREE.Vector3().crossVectors(skin(x+.0003,t).sub(skin(x-.0003,t)),skin(x,t+.0003).sub(skin(x,t-.0003))).normalize();
}
function geom(pos,uv,idx,normals){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  if(normals)g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));else g.computeVertexNormals();return g;
}
function merge(list){
  const pos=[],uv=[],normal=[];
  for(const source of list){const g=source.index?source.toNonIndexed():source,p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));normal.push(n.getX(i),n.getY(i),n.getZ(i));uv.push(u.getX(i),u.getY(i));}if(g!==source)g.dispose();source.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}
function curve(points,closed=false){return new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');}
function strand(points,r=.007,segments=32){return new THREE.TubeGeometry(curve(points),segments,r,4,false);}
function textureFrom(canvas,srgb=false,repeat=[1,1]){const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=4;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;}
function textile(){
  const size=512,color=document.createElement('canvas'),mono=document.createElement('canvas'),normal=document.createElement('canvas'),rough=document.createElement('canvas');
  for(const c of[color,mono,normal,rough])c.width=c.height=size;
  const cc=color.getContext('2d'),mc=mono.getContext('2d'),nc=normal.getContext('2d'),rc=rough.getContext('2d');
  const ci=cc.createImageData(size,size),mi=mc.createImageData(size,size),ni=nc.createImageData(size,size),ri=rc.createImageData(size,size);
  const heights=new Float32Array(size*size);
  // Paired yarn loops, offset courses and a slight diagonal warp; every component
  // tiles at 512px. Cache the height field once instead of re-evaluating it for
  // every neighbouring normal sample. Colour remains neutral for every finish.
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const row=Math.floor(y/8),sx=(x+y*.125+(row%2)*4)%8,sy=(y%8)/8;
    const yarn=Math.exp(-Math.pow((Math.abs(sx-4)-(1.08+1.26*Math.sin(sy*PI)))/.80,2));
    heights[y*size+x]=.62*yarn+.06*Math.sin((x+y)*PI/2)+.04*Math.sin(x*TAU/4+y*TAU/8);
  }
  const height=(x,y)=>heights[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,h=heights[y*size+x],fiber=Math.sin(x*TAU/4+y*TAU/8)*.5+Math.sin(x*TAU/16-y*TAU/8)*.5;
    const directional=.5+.5*Math.sin((x+y*.125)*TAU/32),v=199+h*39+fiber*4+directional*5,m=224+h*24+fiber*3;
    ci.data.set([v,v,v,255],i);mi.data.set([m,m,m,255],i);
    const dx=(height(x+1,y)-height(x-1,y))*.8,dy=(height(x,y+1)-height(x,y-1))*.8,inv=1/Math.sqrt(dx*dx+dy*dy+1);
    ni.data.set([128-dx*inv*127,128-dy*inv*127,128+inv*127,255],i);
    const r=235-h*32+fiber*5;ri.data.set([r,r,r,255],i);
  }
  cc.putImageData(ci,0,0);mc.putImageData(mi,0,0);nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);
  return{color:textureFrom(color,true,[3,1.8]),mono:textureFrom(mono,true,[3,1.8]),normal:textureFrom(normal,false,[3,1.8]),roughness:textureFrom(rough,false,[3,1.8])};
}
function foamTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const cx=c.getContext('2d'),im=cx.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){const grain=(Math.sin(x*12.9898+y*78.233)*43758.5453)%1,shade=239+grain*10;im.data.set([shade,shade,shade,255],(y*128+x)*4);}cx.putImageData(im,0,0);return textureFrom(c,true,[8,3]);
}
function collarBoundary(x,z){return ((x+1.32)/.56)**2+(z/.305)**2;}
function upperShellPoint(x,t){
  const p=skin(x,t),r=collarBoundary(x,p.z),blend=1-THREE.MathUtils.smoothstep(r,.70,1.21);
  // Keep a closed continuous shell, lowered beneath the fitted neck. Rejecting
  // coarse triangles here leaves a visible sawtooth edge at the collar junction.
  p.y=lerp(p.y,Math.min(p.y,.585+.075*Math.min(r,1)),blend);
  return p;
}
function upperShellNormal(x,t){
  return new THREE.Vector3().crossVectors(upperShellPoint(x+.0003,t).sub(upperShellPoint(x-.0003,t)),upperShellPoint(x,t+.0003).sub(upperShellPoint(x,t-.0003))).normalize();
}
function upperPart(rear){
  const pos=[],uv=[],idx=[],normals=[],nx=rear?18:42,nt=26;
  for(let i=0;i<=nx;i++)for(let j=0;j<=nt;j++){
    const t=j/nt*PI,boundary=-1.02+.16*Math.cos(t)+.11*Math.sin(t*2)+.40*Math.pow(Math.sin(t),2),u=(1-Math.cos(i/nx*PI))/2,x=rear?lerp(-2.14,boundary,u):lerp(boundary,2.15,u),p=upperShellPoint(x,t);pos.push(...p.toArray());uv.push((x+2.14)/4.29,t/PI);normals.push(...upperShellNormal(x,t).toArray());
  }
  for(let i=0;i<nx;i++)for(let j=0;j<nt;j++){const a=i*(nt+1)+j,b=a+nt+1;idx.push(a,b,a+1,a+1,b,b+1);}
  return geom(pos,uv,idx,normals);
}
function collar(inner=false){
  const pos=[],uv=[],idx=[],na=48,ny=7;
  for(let i=0;i<=na;i++)for(let j=0;j<=ny;j++){
    const a=i/na*TAU,v=inner?.34+.66*j/ny:j/ny,baseX=-1.32+Math.cos(a)*.60,baseZ=Math.sin(a)*.345;
    const base=upperShellPoint(baseX,Math.acos(clamp(baseZ/shape(baseX,1),-.999,.999)));
    const topX=-1.39+Math.cos(a)*.435,topZ=Math.sin(a)*.255;
    const topY=1.075+.065*Math.cos(a)+.090*Math.cos(a*2),bend=Math.sin(v*PI)*.028;
    const x=lerp(baseX,topX,v)+bend-(inner?.014:0)*Math.cos(a),z=lerp(baseZ,topZ,v)-(inner?.012:0)*Math.sin(a),y=lerp(base.y-.025,topY,v)-(inner?.015:0);
    pos.push(x,y,z);uv.push(i/na*.62,j/ny*.34);
  }
  for(let i=0;i<na;i++)for(let j=0;j<ny;j++){const a=i*(ny+1)+j,b=a+ny+1;if(inner)idx.push(a,b,a+1,a+1,b,b+1);else idx.push(a,a+1,b,a+1,b+1,b);}
  const g=geom(pos,uv,idx);
  if(!inner){const n=g.attributes.normal;for(let i=0;i<=na;i++)for(let j=0;j<=ny;j++){const v=j/ny;if(v>.43)continue;const a=i/na*TAU,x=-1.32+Math.cos(a)*.60,z=Math.sin(a)*.345,t=Math.acos(clamp(z/shape(x,1),-.999,.999)),base=normalAt(x,t),k=i*(ny+1)+j,current=new THREE.Vector3(n.getX(k),n.getY(k),n.getZ(k));current.lerp(base,(1-v/.43)*.84).normalize();n.setXYZ(k,current.x,current.y,current.z);}}
  return g;
}
function collarLip(){
  const pts=[];for(let i=0;i<=48;i++){const a=i/48*TAU;pts.push([-1.39+Math.cos(a)*.435,1.075+.065*Math.cos(a)+.090*Math.cos(a*2),Math.sin(a)*.255]);}
  return strand(pts,.009,48);
}
function patch(points,side=1,offset=.018,resolution=3){
  const outline=points.map(p=>new THREE.Vector2(...p)),faces=THREE.ShapeUtils.triangulateShape(outline,[]),pos=[],uv=[],idx=[],normals=[];
  for(const f of faces){const a=outline[f[0]],b=outline[f[1]],c=outline[f[2]],rows=[];for(let i=0;i<=resolution;i++){rows[i]=[];for(let j=0;j<=resolution-i;j++){const u=i/resolution,v=j/resolution,x=a.x*(1-u-v)+b.x*u+c.x*v,s=a.y*(1-u-v)+b.y*u+c.y*v,t=side===1?s:PI-s,p=skin(x,t,offset);rows[i][j]=pos.length/3;pos.push(...p.toArray());uv.push((x+2.14)/4.29,t/PI);normals.push(...normalAt(x,t).toArray());}}for(let i=0;i<resolution;i++)for(let j=0;j<resolution-i;j++){idx.push(rows[i][j],rows[i+1][j],rows[i][j+1]);if(j<resolution-i-1)idx.push(rows[i+1][j],rows[i+1][j+1],rows[i][j+1]);}}
  if(side===-1)for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];return geom(pos,uv,idx,normals);
}
function outline(points,count=24){const c=curve(points.map(p=>[p[0],p[1],0]),true);return Array.from({length:count},(_,i)=>{const p=c.getPoint(i/count);return[p.x,p.y];});}
function soleBottom(x){return -.245+.061*Math.exp(-Math.pow((x+.15)/.75,2))+.405*Math.pow(clamp((x-.48)/1.80,0,1),2);}
function solePoint(x,t,offset=0){
  const px=clamp(x,-2.14,2.15),end=clamp(Math.min((x+2.25)/.18,(2.23-x)/.15),0,1),fall=Math.sqrt(Math.max(0,1-(1-end)**2));
  const w=(shape(px,1)+.058)*fall*(1-.045*Math.exp(-Math.pow((x+.20)/.75,2))),top=shape(px,2)+.016,bottom=soleBottom(px),s=Math.sin(t),c=Math.cos(t);
  let z=w*Math.sign(c)*Math.pow(Math.abs(c),.42)*(1+.027*Math.sin(t*3))+(offset*Math.sign(c));
  const y=(top+bottom)/2+(top-bottom)/2*Math.sign(s)*Math.pow(Math.abs(s),.56)*fall;
  const v=clamp((y-bottom)/Math.max(.02,top-bottom),0,1),channels=foamChannels(x),envelope=Math.pow(Math.abs(c),3)*Math.pow(Math.sin(clamp((x+2.25)/4.48,0,1)*PI),.6);
  const recess=.016*Math.exp(-Math.pow((v-channels[0])/.033,2))+.013*Math.exp(-Math.pow((v-channels[1])/.032,2));
  z-=Math.sign(c)*recess*envelope;
  return new THREE.Vector3(x,y,z);
}
function foamChannels(x){return[.305+.037*Math.sin((x+1.8)*1.15),.645+.035*Math.sin(x*1.4+.4)];}
function sole(){
  const pos=[],uv=[],idx=[],nx=64,nt=32;
  for(let i=0;i<=nx;i++){const u=(1-Math.cos(i/nx*PI))/2,x=lerp(-2.25,2.23,u),[a,b]=foamChannels(x),levels=[0,.07,.16,a-.055,a-.023,a,a+.023,a+.055,.49,b-.055,b-.023,b,b+.023,b+.055,.86,.94,1];
    for(let j=0;j<=nt;j++){const v=j<=16?levels[j]:levels[32-j],s=Math.sign(v-.5)*Math.pow(Math.abs(v*2-1),1/.56),t=j<=16?Math.asin(s):PI-Math.asin(s),p=solePoint(x,t);pos.push(...p.toArray());uv.push(u,j/nt);}}
  for(let i=0;i<nx;i++)for(let j=0;j<nt;j++){const a=i*(nt+1)+j,b=a+nt+1;idx.push(a,b,a+1,a+1,b,b+1);}return geom(pos,uv,idx);
}
function rubberPatch(x0,x1,side){
  const pos=[],uv=[],idx=[],nx=5,nt=6;
  for(let i=0;i<=nx;i++)for(let j=0;j<=nt;j++){
    const u=i/nx,v=j/nt,x=lerp(x0,x1,u),round=Math.sin(u*PI)*.09,t=side===1?lerp(PI*1.53,PI*1.84-round,v):lerp(PI*1.16+round,PI*1.47,v),p=solePoint(x,t);p.y-=.006;pos.push(...p.toArray());uv.push(u,v);
  }
  for(let i=0;i<nx;i++)for(let j=0;j<nt;j++){const a=i*(nt+1)+j,b=a+nt+1;idx.push(a,b,a+1,a+1,b,b+1);}return geom(pos,uv,idx);
}
function throat(){
  const p=[],uv=[],idx=[],normals=[],nx=28,nz=10;
  for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
    // The fitted collar base ends at x=-.72. Begin just ahead of it so the
    // throat cannot cut through the lowered neck shell or its knit wall.
    const u=i/nx,v=j/nz,x=lerp(-.70,.45,u),width=.18*Math.pow(1-u,3)+.27*Math.pow(Math.sin(u*PI),.30)+.008,t=PI/2+(v*2-1)*width,point=skin(x,t,.007);
    p.push(...point.toArray());uv.push((x+2.14)/4.29,t/PI);normals.push(...normalAt(x,t).toArray());
  }
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=i*(nz+1)+j,b=a+nz+1;idx.push(a,b,a+1,a+1,b,b+1);}return geom(p,uv,idx,normals);
}
function edgeFinish(points,side,offset,width){
  const c=curve(points.map(p=>[p[0],p[1],0]),true),p=[],uv=[],idx=[],normals=[],count=40;
  for(let i=0;i<=count;i++){
    const q=c.getPoint((i%count)/count),next=c.getPoint(((i+.1)%count)/count),t=side===1?q.y:PI-q.y,nt=side===1?next.y:PI-next.y,n=normalAt(q.x,t),center=skin(q.x,t,offset),tangent=skin(next.x,nt,offset).sub(center).normalize(),across=new THREE.Vector3().crossVectors(n,tangent).normalize().multiplyScalar(width);
    const a=center.clone().add(across),b=center.clone().sub(across);p.push(...a.toArray(),...b.toArray());uv.push(i/count,0,i/count,1);normals.push(...n.toArray(),...n.toArray());
    if(i<count){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  return geom(p,uv,idx,normals);
}
function logo(){
  const c=document.createElement('canvas');c.width=512;c.height=128;const cx=c.getContext('2d');cx.fillStyle='#ffffff';cx.font='italic 900 82px Arial, sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText('PACE',252,61);const map=textureFrom(c,true);
  const p=[],uv=[],idx=[],nx=12,ny=3;for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){const pt=skin(lerp(-1.94,-1.40,i/nx),lerp(.37,.62,j/ny),.033);p.push(...pt.toArray());uv.push(i/nx,j/ny);}for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const a=i*(ny+1)+j,b=a+ny+1;idx.push(a,b,a+1,a+1,b,b+1);}return{map,geometry:geom(p,uv,idx)};
}
export function createPaceShoe(){
  const group=new THREE.Group();group.name='PACE Drift 01 — directional knit running shoe';
  const knit=textile(),grain=foamTexture(),mark=logo();
  const materials={
    upper:new THREE.MeshStandardMaterial({map:knit.color,normalMap:knit.normal,normalScale:new THREE.Vector2(.42,.42),roughnessMap:knit.roughness,roughness:.98,metalness:0,color:'#ffffff',side:THREE.DoubleSide}),
    pearl:new THREE.MeshStandardMaterial({map:knit.mono,normalMap:knit.normal,normalScale:new THREE.Vector2(.25,.25),roughnessMap:knit.roughness,color:'#eceef1',roughness:.96,side:THREE.DoubleSide}),
    ice:new THREE.MeshStandardMaterial({map:knit.mono,normalMap:knit.normal,normalScale:new THREE.Vector2(.32,.32),roughnessMap:knit.roughness,color:'#8dbed9',roughness:.98,side:THREE.DoubleSide}),
    foam:new THREE.MeshStandardMaterial({map:grain,color:'#e1e7e7',roughness:.81,metalness:0}),
    structure:new THREE.MeshStandardMaterial({map:knit.mono,normalMap:knit.normal,normalScale:new THREE.Vector2(.075,.075),color:'#101b28',roughness:.60,side:THREE.DoubleSide}),
    accent:new THREE.MeshStandardMaterial({color:'#ff2e92',roughness:.44}),
    branding:new THREE.MeshStandardMaterial({map:mark.map,transparent:true,forceSinglePass:true,roughness:.78,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}),
  };
  const buckets=Object.fromEntries(Object.keys(materials).map(k=>[k,[]]));
  buckets.upper.push(upperPart(false));buckets.pearl.push(upperPart(true),collar(),collarLip());buckets.pearl.push(collar(true));buckets.foam.push(sole());
  // Deep insole closes the genuine, thin-walled knit neck; no inflated torus padding.
  const inner=new THREE.SphereGeometry(1,16,6);inner.scale(.49,.025,.27);inner.translate(-1.34,.55,0);buckets.structure.push(inner);
  // The vamp's dark knitted cover integrates tongue and concealed fastening.
  buckets.structure.push(throat());
  for(const side of[1,-1]){
    // Asymmetric broad woven quarter panel — blunt-ended, never a borrowed mark.
    const ice=side===1?[[-1.20,.31],[-1.03,.60],[-.65,.81],[-.04,.79],[.47,.62],[.64,.41],[.20,.31],[-.31,.38],[-.83,.31]]:[[-1.24,.29],[-.99,.56],[-.53,.70],[.21,.68],[.69,.48],[.76,.31],[.26,.28],[-.39,.39],[-.93,.27]];
    buckets.ice.push(patch(outline(ice,20),side,.007,5));
    buckets.ice.push(edgeFinish(ice,side,.010,.0015));
    // Black bonded support traverses instep into midsole; subtle bonded seams replace laces.
    const band=side===1?[[-.98,.17],[-.72,.40],[-.52,.77],[-.33,1.16],[-.17,1.18],[-.20,.76],[-.38,.40],[-.72,.16]]:[[-.81,.18],[-.54,.44],[-.28,.75],[.06,1.12],[.22,1.09],[.10,.77],[-.23,.43],[-.62,.17]];
    buckets.structure.push(patch(outline(band,20),side,.013,5));
    buckets.structure.push(patch([[1.45,.075],[1.79,.14],[2.03,.32],[2.13,.22],[2.10,.06],[1.85,.05]],side,.006,4));
    // Thin outsole pods are bonded to the rocker, with open foam flex channels.
    for(const [a,b]of[[-2.06,-1.72],[-1.61,-1.28],[.31,.62],[.72,1.02],[1.12,1.42],[1.51,1.80]])buckets.structure.push(rubberPatch(a,b,side));
    // Shallow tooling line follows the foam waist and sweeps upward into the toe.
    // Flowing channels are recessed directly into solePoint; no raised decorative rails.
  }
  // Understated flat cable rungs only peek through the covered throat.
  for(let i=0;i<3;i++){const x=-.31+i*.20,pts=[];for(let j=0;j<=8;j++){const z=lerp(-.17,.17,j/8),t=Math.acos(z/shape(x,1)),p=skin(x,t,.012);pts.push(p.toArray());}buckets.structure.push(strand(pts,.0045,10));}
  // One small original pink tab, with no sports-brand symbol or copied panel art.
  // Small bonded heel marker follows the actual curved textile instead of a floating box.
  buckets.accent.push(patch(outline([[-1.99,.61],[-1.96,.67],[-1.84,.68],[-1.82,.63],[-1.85,.59],[-1.96,.57]],8),1,.006,2));
  buckets.accent.push(patch(outline([[-.92,.20],[-.77,.23],[-.65,.27],[-.65,.30],[-.79,.28],[-.94,.25]],12),1,.050,2));
  buckets.branding.push(mark.geometry);
  for(const[k,list]of Object.entries(buckets)){if(!list.length)continue;const mesh=new THREE.Mesh(merge(list),materials[k]);mesh.name=k==='upper'?'Neutral directional knit — palette-tinted':k==='pearl'?'Contrasting heel and fitted knit collar':k==='foam'?'Sculpted foam rocker':k==='ice'?'Asymmetric bonded textile panels':k==='structure'?'Bonded support, concealed fastening, restrained rubber':k;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  const palettes={
    volt:{upper:'#424847',pearl:'#313a38',ice:'#d8ef47',foam:'#dddeda',structure:'#141b1b',accent:'#d6ff39',branding:'#f0f6de'},
    ice:{upper:'#396ee0',pearl:'#edf0ed',ice:'#9fcfea',foam:'#e8eae3',structure:'#17242e',accent:'#ff518f',branding:'#172532'},
    infrared:{upper:'#383c42',pearl:'#292f34',ice:'#e26657',foam:'#e2ded6',structure:'#171d22',accent:'#ff785e',branding:'#fff0dc'},
  };
  const aliases={chalk:'ice',cobalt:'ice',acid:'volt'};
  const materialKeys=Object.keys(palettes.volt);
  // THREE.Color converts authored sRGB hex values once. Snapshots and blending
  // operate in linear RGB, so interrupted transitions never quantize through hex.
  const paletteColors=Object.fromEntries(Object.entries(palettes).map(([name,palette])=>[name,Object.fromEntries(Object.entries(palette).map(([key,value])=>[key,new THREE.Color(value)]))]));
  const resolveColorway=name=>Object.hasOwn(palettes,name)?name:(Object.hasOwn(aliases,name)?aliases[name]:'volt');
  const snapshotOf=colors=>Object.fromEntries(materialKeys.map(key=>[key,colors[key].toArray()]));
  function getPaletteSnapshot(){return Object.fromEntries(materialKeys.map(key=>[key,materials[key].color.toArray()]));}
  function getColorway(name='volt'){return snapshotOf(paletteColors[resolveColorway(name)]);}
  function applyPalette(snapshot){
    for(const key of materialKeys){const value=snapshot?.[key];if(Array.isArray(value)&&value.length===3&&value.every(Number.isFinite))materials[key].color.setRGB(value[0],value[1],value[2]);}
  }
  function setColorway(name='volt'){
    const resolved=resolveColorway(name);for(const key of materialKeys)materials[key].color.copy(paletteColors[resolved][key]);group.userData.colorway=resolved;
  }
  function blendColorway(fromSnapshot,toName,t){
    const resolved=resolveColorway(toName),target=paletteColors[resolved],amount=clamp(Number.isFinite(t)?t:0,0,1);
    for(const key of materialKeys){const from=fromSnapshot?.[key],to=target[key];if(Array.isArray(from)&&from.length===3&&from.every(Number.isFinite))materials[key].color.setRGB(lerp(from[0],to.r,amount),lerp(from[1],to.g,amount),lerp(from[2],to.b,amount));}
    group.userData.colorway=resolved;
  }
  setColorway('volt');
  const geometries=new Set(),allMaterials=new Set(),textures=new Set();let triangles=0,drawCalls=0;group.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;drawCalls++;allMaterials.add(o.material);for(const v of Object.values(o.material))if(v?.isTexture)textures.add(v);}});
  return{group,materials,setColorway,getPaletteSnapshot,getColorway,applyPalette,blendColorway,info:{name:'PACE Drift 01',geometry:'One original tapered procedural last, all views share this final geometry.',colorways:Object.keys(palettes),triangles,drawCalls,textureCount:textures.size,textureDimensions:[...textures].map(t=>[t.image.width,t.image.height]),bounds:new THREE.Box3().setFromObject(group),cameraHint:{position:[3,2.2,8],target:[0,.62,0]},macroHint:{position:[.6,2.5,4],target:[-.60,.85,.18]},provenance:'Original procedural geometry, deterministic neutral directional knit colour/normal/roughness maps, original panel shapes, PACE wordmark typeset in system Arial.'},dispose(){for(const g of geometries)g.dispose();for(const m of allMaterials)m.dispose();for(const t of textures)t.dispose();}};
}
