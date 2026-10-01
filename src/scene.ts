import * as THREE from 'three';
import {createPaceShoe} from './shoe.js';
import {recordRender,recordSetup} from './profiler';
export type PoseName='hero'|'side'|'threequarter'|'macro'|'form'|'texture'|'contact';
type Pose={eye:number[];target:number[];rotation:number[];zoom:number};
type Frame={x:number;y:number;width:number;height:number};
const poses:Record<string,Pose>={
 hero:{eye:[3.1,2.35,7.5],target:[0,.75,0],rotation:[0,-.12,-.015],zoom:1.18},
 side:{eye:[.25,1.6,8],target:[0,.75,0],rotation:[0,0,0],zoom:1.17},
 threequarter:{eye:[-3.8,2.9,7.4],target:[-.1,.85,0],rotation:[0,.08,0],zoom:1.12},
 macro:{eye:[1.1,2.5,6],target:[-.35,.58,.15],rotation:[0,-.08,.035],zoom:2.35},
};
const aliases:Record<string,string>={form:'side',texture:'macro',contact:'threequarter'};
const smooth=(t:number)=>t*t*(3-2*t);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const mix=(a:Pose,b:Pose,t:number):Pose=>({eye:a.eye.map((v,i)=>lerp(v,b.eye[i],t)),target:a.target.map((v,i)=>lerp(v,b.target[i],t)),rotation:a.rotation.map((v,i)=>lerp(v,b.rotation[i],t)),zoom:lerp(a.zoom,b.zoom,t)});
export function createShoeStage(host:HTMLElement,onFailure:()=>void,options:{overlay?:boolean}={}){
 const setupStart=performance.now();
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'default'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
 renderer.setClearColor(0,0);renderer.autoClear=false;renderer.domElement.className='shoe-canvas';renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xf1f7ff,0x657493,2.3));
 const key=new THREE.DirectionalLight(0xfff8ee,3.7);key.position.set(-2.5,5,5);scene.add(key);
 const fill=new THREE.DirectionalLight(0xc4deff,1.1);fill.position.set(4,1,3);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xffffff,3.3);rim.position.set(-3,3,-4);scene.add(rim);
 const shoe=createPaceShoe();scene.add(shoe.group);
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=128;
 const ctx=shadowCanvas.getContext('2d')!;ctx.translate(128,64);ctx.scale(1,.42);
 const halo=ctx.createRadialGradient(0,0,8,0,0,124);halo.addColorStop(0,'rgba(14,29,54,.42)');halo.addColorStop(.5,'rgba(14,29,54,.17)');halo.addColorStop(1,'rgba(14,29,54,0)');ctx.fillStyle=halo;ctx.fillRect(-128,-152,256,304);
 const shadowMap=new THREE.CanvasTexture(shadowCanvas);const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.68});
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(5.5,2.55),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.y=new THREE.Box3().setFromObject(shoe.group).min.y-.008;scene.add(shadow);
 const camera=new THREE.OrthographicCamera(-3,3,3,-3,.05,80);const target=new THREE.Vector3();
 let pose=poses.hero,frame:Frame={x:0,y:0,width:1,height:1},viewWidth=1,viewHeight=1;
 let yaw=0,pitch=0,userZoom=1,disposed=false,draws=0,totalCpu=0,maxCpu=0,firstCpu=0,surfaceVisible=true;
 const onLost=(e:Event)=>{e.preventDefault();if(!disposed)onFailure();};renderer.domElement.addEventListener('webglcontextlost',onLost);
 function resize(){if(disposed)return;const rect=host.getBoundingClientRect();viewWidth=options.overlay?document.documentElement.clientWidth:rect.width;viewHeight=options.overlay?innerHeight:rect.height;renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<=700?1:1.5));renderer.setSize(Math.max(1,viewWidth),Math.max(1,viewHeight),false);if(!options.overlay)frame={x:0,y:0,width:viewWidth,height:viewHeight};}
 function setFrame(rect:Frame){frame=rect;surfaceVisible=rect.y<viewHeight&&rect.y+rect.height>0&&rect.width>0&&rect.height>0;}
 function draw(){
  if(disposed||document.hidden||!surfaceVisible)return false;
  const aspect=frame.width/frame.height,halfHeight=Math.max(1.85,2.85/aspect);
  camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
  camera.position.set(...pose.eye as [number,number,number]);target.set(...pose.target as [number,number,number]);camera.lookAt(target);camera.zoom=pose.zoom*userZoom;camera.updateProjectionMatrix();
  shoe.group.rotation.set(pose.rotation[0]+pitch,pose.rotation[1]+yaw,pose.rotation[2]);
  renderer.setScissorTest(false);renderer.clear();renderer.setViewport(frame.x,viewHeight-frame.y-frame.height,frame.width,frame.height);
  renderer.setScissor(Math.max(0,frame.x),Math.max(0,viewHeight-frame.y-frame.height),Math.max(0,Math.min(viewWidth,frame.x+frame.width)-Math.max(0,frame.x)),Math.max(0,Math.min(viewHeight,viewHeight-frame.y)-Math.max(0,viewHeight-frame.y-frame.height)));renderer.setScissorTest(true);
  const start=performance.now();try{renderer.render(scene,camera);}catch{onFailure();return false;}
  const cost=performance.now()-start;draws++;if(draws===1)firstCpu=cost;totalCpu+=cost;maxCpu=Math.max(maxCpu,cost);recordRender(cost);host.classList.add('is-rendered');return true;
 }
 function setPose(name:PoseName){pose=poses[aliases[name]||name];}
 function setProgress(p:number){const t=THREE.MathUtils.clamp(p,0,1);pose=t<=.5?mix(poses.side,poses.threequarter,smooth(t*2)):mix(poses.threequarter,poses.macro,smooth((t-.5)*2));}
 function setEntry(t:number){pose=mix(poses.hero,poses.side,smooth(THREE.MathUtils.clamp(t,0,1)));}
 function setOrbit(nextYaw:number,nextPitch:number,zoom:number){yaw=THREE.MathUtils.clamp(nextYaw,-Math.PI*.85,Math.PI*.85);pitch=THREE.MathUtils.clamp(nextPitch,-.35,.45);userZoom=THREE.MathUtils.clamp(zoom,.8,1.4);}
 const gl=renderer.getContext();const debug=gl.getExtension('WEBGL_debug_renderer_info');const textureInfo:Record<string,{width:number;height:number}>={};
 shoe.group.traverse((obj:THREE.Object3D)=>{const material=(obj as THREE.Mesh).material;if(!material)return;for(const m of Array.isArray(material)?material:[material])for(const value of Object.values(m))if(value instanceof THREE.Texture&&value.image)textureInfo[value.uuid]={width:value.image.width,height:value.image.height};});
 function stats(){return{draws,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,dpr:renderer.getPixelRatio(),physicalCanvas:[renderer.domElement.width,renderer.domElement.height],textures:Object.values(textureInfo),shadowMapEnabled:renderer.shadowMap.enabled,renderLoops:1,reactUpdates:'not applicable: plain TypeScript',firstRenderCpuMs:+firstCpu.toFixed(2),meanCpuRenderMs:+(totalCpu/Math.max(draws,1)).toFixed(2),maxCpuRenderMs:+maxCpu.toFixed(2),gpuRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable',visible:surfaceVisible,documentHidden:document.hidden};}
 resize();recordSetup(performance.now()-setupStart);
 return{renderer,shoe,resize,setFrame,setPose,setProgress,setEntry,setOrbit,renderNow:draw,stats,invalidate:draw,
 opening:(t:number)=>{pose=mix({...poses.hero,rotation:[0,-.25,-.04]},poses.hero,smooth(t));},
 snapshot:(type='image/webp')=>{draw();return renderer.domElement.toDataURL(type,.94);},
 dispose(){disposed=true;renderer.domElement.removeEventListener('webglcontextlost',onLost);shoe.dispose();shadow.geometry.dispose();shadowMaterial.dispose();shadowMap.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();host.classList.remove('is-rendered');}
 };
}
