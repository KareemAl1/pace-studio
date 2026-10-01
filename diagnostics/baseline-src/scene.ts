import { recordRender, recordSetup } from '../../src/profiler';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPaceShoe } from './shoe.js';

export type PoseName = 'hero' | 'form' | 'texture' | 'contact';
type Pose = {eye:number[];target:number[];rotation:number[];zoom:number};
// Every view uses the same mesh. No geometry changes between stages or colors.
const poses:Record<PoseName,Pose> = {
  hero:{eye:[.6,2.2,7],target:[0,.65,0],rotation:[0,-.2,.08],zoom:1.24},
  form:{eye:[2,2.3,8],target:[0,.7,0],rotation:[.02,.12,.06],zoom:1.14},
  texture:{eye:[1.0,4.5,5],target:[.2,.87,.12],rotation:[0,-.12,.02],zoom:2.8},
  contact:{eye:[3,-4.5,7],target:[0,.27,0],rotation:[.08,-.42,-.14],zoom:1.17},
};
const ease = (x:number) => x*x*(3-2*x);
const mix = (a:number,b:number,t:number) => a+(b-a)*t;
const mixPose = (a:Pose,b:Pose,t:number):Pose=>({eye:a.eye.map((v,i)=>mix(v,b.eye[i],t)),target:a.target.map((v,i)=>mix(v,b.target[i],t)),rotation:a.rotation.map((v,i)=>mix(v,b.rotation[i],t)),zoom:mix(a.zoom,b.zoom,t)});

export function createShoeStage(host:HTMLElement, onFailure:()=>void) {
  const setupStarted = performance.now();
  const renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.4:1.65));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.92;
  renderer.setClearColor(0x000000,0);
  renderer.domElement.setAttribute('aria-hidden','true');
  renderer.domElement.className='shoe-canvas';
  const scene = new THREE.Scene();
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(environment,.035);
  scene.environment=envTarget.texture;
  scene.environmentIntensity=.55;
  environment.dispose();pmrem.dispose();
  const hemi = new THREE.HemisphereLight(0xffffff,0x555a8a,.65);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff,1.8);key.position.set(2,5,5);scene.add(key);
  const rim = new THREE.DirectionalLight(0xbacbff,1.4);rim.position.set(-4,2,-4);scene.add(rim);
  const shoe=createPaceShoe();shoe.setColorway('chalk');scene.add(shoe.group);
  const camera=new THREE.OrthographicCamera(-3,3,3,-3,.05,80);
  let currentHost=host, pose=poses.hero, pending=0, disposed=false, draws=0, maxRenderMs=0, totalRenderMs=0;
  const onLost=(event:Event)=>{event.preventDefault();onFailure();};
  renderer.domElement.addEventListener('webglcontextlost',onLost);
  const target=new THREE.Vector3();
  function resize(){
    if(disposed)return;
    const {width,height}=currentHost.getBoundingClientRect();
    if(width<1||height<1)return;
    renderer.setSize(width,height,false);
    const aspect=width/height;
    // Framing keeps a complete shoe on narrow devices, with intentional macro crops.
    const halfHeight=Math.max(2.28,2.75/aspect);
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;
    camera.top=halfHeight;camera.bottom=-halfHeight;
    camera.updateProjectionMatrix();invalidate();
  }
  function draw(){
    pending=0;if(disposed||document.hidden)return;
    camera.position.set(pose.eye[0],pose.eye[1],pose.eye[2]);
    target.set(pose.target[0],pose.target[1],pose.target[2]);camera.lookAt(target);
    camera.zoom=pose.zoom;camera.updateProjectionMatrix();
    shoe.group.rotation.set(pose.rotation[0],pose.rotation[1],pose.rotation[2]);
    const start=performance.now();
    try{renderer.render(scene,camera);}catch{onFailure();return;}
    const cost=performance.now()-start; recordRender(cost);
    draws++;totalRenderMs+=cost;maxRenderMs=Math.max(maxRenderMs,cost);
    currentHost.classList.add('is-rendered');
  }
  function invalidate(){if(!pending&&!disposed)pending=requestAnimationFrame(draw);}
  const observer=new ResizeObserver(resize);observer.observe(host);host.append(renderer.domElement);resize();recordSetup(performance.now()-setupStarted);
  function setHost(next:HTMLElement){if(next===currentHost)return;observer.unobserve(currentHost);currentHost.classList.remove('is-rendered');currentHost=next;next.append(renderer.domElement);observer.observe(next);resize();}
  function setPose(name:PoseName){pose=poses[name];invalidate();}
  function setProgress(progress:number){
    const p=THREE.MathUtils.clamp(progress,0,1);
    if(p<.42) pose=mixPose(poses.form,poses.texture,ease(p/.42));
    else if(p<.58)pose=poses.texture;
    else pose=mixPose(poses.texture,poses.contact,ease((p-.58)/.42));
    invalidate();
  }
  function opening(t:number){pose=mixPose({...poses.hero,rotation:[-.1,-.8,-.26],zoom:.94},poses.hero,ease(t));invalidate();}
  // CPU submission duration only. This is not GPU frame time or an FPS benchmark.
  function stats(){
    const gl=renderer.getContext(), debug=gl.getExtension('WEBGL_debug_renderer_info');
    const textureRecords:Record<string,unknown>[]=[];const seen=new Set<THREE.Texture>();
    shoe.group.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(material))if(value instanceof THREE.Texture&&!seen.has(value)){seen.add(value);const img=value.image as {width?:number;height?:number}|undefined;textureRecords.push({width:img?.width??null,height:img?.height??null,anisotropy:value.anisotropy,mipmaps:value.generateMipmaps});}});
    return {draws,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,dpr:renderer.getPixelRatio(),physicalCanvas:[renderer.domElement.width,renderer.domElement.height],shadowMapEnabled:renderer.shadowMap.enabled,antialias:gl.getContextAttributes()?.antialias,gpuVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):'unavailable',gpuRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable',shoeTextures:textureRecords,meanCpuRenderMs:Number((totalRenderMs/Math.max(draws,1)).toFixed(2)),maxCpuRenderMs:Number(maxRenderMs.toFixed(2))};
  }
  const onVisibility=()=>{if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',onVisibility);
  function snapshot(){draw();return renderer.domElement.toDataURL('image/webp',.93);}
  return {renderer,shoe,setHost,setPose,setProgress,opening,resize,invalidate,stats,snapshot,renderNow:draw,dispose(){disposed=true;cancelAnimationFrame(pending);observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',onLost);document.removeEventListener('visibilitychange',onVisibility);shoe.dispose();envTarget.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();currentHost.classList.remove('is-rendered');}};
}
