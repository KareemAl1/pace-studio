import assert from 'node:assert/strict';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},fillText(){},
})})};
const {createPaceShoe}=await import('../src/shoe.js');
const shoe=createPaceShoe();
const meshes=[];shoe.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
const geometryRefs=meshes.map(o=>o.geometry);
for(const mesh of meshes)for(const attr of Object.values(mesh.geometry.attributes))
  for(const value of attr.array)assert(Number.isFinite(value),'Geometry must contain finite values');
for(const color of shoe.info.colorways){
  shoe.setColorway(color);
  meshes.forEach((mesh,i)=>assert.equal(mesh.geometry,geometryRefs[i],`${color}: geometry changed`));
}
console.log(JSON.stringify({result:'passed',meshCount:meshes.length,colors:shoe.info.colorways,triangles:shoe.info.triangles,geometryReferencesPreserved:true,finiteAttributes:true}));
shoe.dispose();
