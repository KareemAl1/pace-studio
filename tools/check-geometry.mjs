import assert from 'node:assert/strict';
// A minimal Canvas mock exercises asset construction and generated map data.
// It does not emulate browser rasterization, shaders, lighting or visual realism.
globalThis.document={createElement:()=>{
  const canvas={width:0,height:0,pixels:null,paintStyles:[]};
  const context={
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData(image){canvas.pixels=image.data;},fillRect(){},
    fillText(){canvas.paintStyles.push(this.fillStyle);},
  };
  canvas.getContext=()=>context;
  return canvas;
}};
const {createPaceShoe}=await import('../src/shoe.js');
const shoe=createPaceShoe();
const meshes=[];shoe.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
const geometryRefs=meshes.map(o=>o.geometry);
const mapRefs=Object.values(shoe.materials).map(m=>[m.map,m.normalMap,m.roughnessMap]);
const palettes=[];
for(const mesh of meshes)for(const attr of Object.values(mesh.geometry.attributes))
  for(const value of attr.array)assert(Number.isFinite(value),'Geometry must contain finite values');
for(const color of shoe.info.colorways){
  shoe.setColorway(color);palettes.push(shoe.getPaletteSnapshot());
  meshes.forEach((mesh,i)=>assert.equal(mesh.geometry,geometryRefs[i],`${color}: geometry changed`));
  Object.values(shoe.materials).forEach((m,i)=>assert.deepEqual([m.map,m.normalMap,m.roughnessMap],mapRefs[i],`${color}: texture recreated`));
}
for(let i=0;i<palettes.length;i++)for(let j=i+1;j<palettes.length;j++)assert.notDeepEqual(palettes[i],palettes[j],'Finishes must have distinct material colours');
const upperPixels=shoe.materials.upper.map.image.pixels;
for(let i=0;i<upperPixels.length;i+=4){assert.equal(upperPixels[i],upperPixels[i+1],'Upper map must be neutral');assert.equal(upperPixels[i],upperPixels[i+2],'Baked blue must not contaminate finish colours');}
assert.deepEqual(shoe.materials.branding.map.image.paintStyles,['#ffffff'],'Logo mask must accept light and dark branding colours');
shoe.setColorway('volt');const from=shoe.getPaletteSnapshot();
shoe.blendColorway(from,'ice',.41);const interrupted=shoe.getPaletteSnapshot();
shoe.blendColorway(interrupted,'infrared',0);assert.deepEqual(shoe.getPaletteSnapshot(),interrupted,'Retargeting must preserve the current visible colour at t=0');
shoe.blendColorway(interrupted,'infrared',1);assert.deepEqual(shoe.getPaletteSnapshot(),shoe.getColorway('infrared'),'Transition must reach its final palette');
const detached=shoe.getPaletteSnapshot();detached.upper[0]=999;assert.notEqual(shoe.materials.upper.color.r,999,'Snapshots must be detached');
shoe.applyPalette(from);assert.deepEqual(shoe.getPaletteSnapshot(),from,'Snapshot restoration must be exact');
for(const[alias,target]of Object.entries({chalk:'ice',cobalt:'ice',acid:'volt'})){shoe.setColorway(alias);assert.deepEqual(shoe.getPaletteSnapshot(),shoe.getColorway(target),`${alias}: legacy palette mapping`);}
console.log(JSON.stringify({result:'passed',meshCount:meshes.length,colors:shoe.info.colorways,triangles:shoe.info.triangles,textures:shoe.info.textureCount,textureDimensions:shoe.info.textureDimensions,geometryReferencesPreserved:true,textureReferencesPreserved:true,finiteAttributes:true,neutralUpperMap:true,threeDistinctPalettes:true,interruptedTransitionContinuous:true,detachedSnapshots:true,legacyAliases:true}));
shoe.dispose();
