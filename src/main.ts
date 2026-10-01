import './style.css';
import './integration.css';
import {installProfiler} from './profiler';
import type {createShoeStage} from './scene';

const root=document.documentElement;
const heroView=document.querySelector<HTMLElement>('#hero-view')!;
const detailView=document.querySelector<HTMLElement>('#detail-view')!;
const details=document.querySelector<HTMLElement>('#details')!;
const copies=[...document.querySelectorAll<HTMLElement>('.detail-copy')];
const views=[...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
const params=new URLSearchParams(location.search);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const shortViewport=matchMedia('(max-height: 599px), (max-width: 700px) and (max-height: 649px)');
const select=document.createElement('select');
select.id='motion-select';select.setAttribute('aria-label','Motion preference');
select.innerHTML='<option value="system">System motion</option><option value="reduce">Reduced motion</option><option value="full">Full motion</option>';
if(['full','reduce'].includes(params.get('motion')||''))select.value=params.get('motion')!;
const label=document.createElement('label');label.className='motion-control';label.innerHTML='<span>Motion</span>';label.append(select);document.querySelector('#motion-slot')!.append(label);
const layer=document.createElement('div');layer.id='product-layer';layer.setAttribute('aria-hidden','true');document.body.append(layer);
const status=document.createElement('span');status.className='sr-only';status.setAttribute('aria-live','polite');document.querySelector('.viewer-tools')!.append(status);
let stage:ReturnType<typeof createShoeStage>|undefined;
let pending:Promise<void>|undefined;
let staticOnly=params.get('view')==='static', raf=0, active=false, chapter=-1;
let yaw=0,pitch=0,zoom=1,openingStart=0,openingDone=false;
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const still=()=>staticOnly||shortViewport.matches||select.value==='reduce'||(select.value==='system'&&reduced.matches);
function setChapter(index:number){
 if(index===chapter)return;chapter=index;
 copies.forEach((copy,i)=>{copy.classList.toggle('is-active',i===index);copy.inert=i!==index;});
 views.forEach(button=>{const current=Number(button.dataset.view)===index;button.classList.toggle('is-active',current);if(current)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
 details.dataset.chapter=String(index+1);
}
function queue(){if(active&&!document.hidden&&!raf)raf=requestAnimationFrame(draw);}
function draw(now:number){
 raf=0;if(!active||!stage||document.hidden)return;
 const h=heroView.getBoundingClientRect(),d=detailView.getBoundingClientRect(),section=details.getBoundingClientRect();
 const visible=section.bottom>0&&h.top<innerHeight;
 layer.hidden=!visible;if(!visible){stage.setFrame({x:0,y:innerHeight+1,width:1,height:1});return;}
 const top=scrollY+section.top,travel=Math.max(1,section.height-innerHeight);
 const p=clamp((scrollY-top)/travel),entry=clamp((scrollY-(top-innerHeight*.78))/(innerHeight*.78));
 const ease=entry*entry*(3-2*entry);
 const frame=scrollY>=top?d:{x:h.x+(d.x-h.x)*ease,y:h.y+(d.y-h.y)*ease,width:h.width+(d.width-h.width)*ease,height:h.height+(d.height-h.height)*ease};
 stage.setFrame(frame);
 if(scrollY>=top)stage.setProgress(p);else stage.setEntry(entry);
 if(!openingDone&&scrollY<10){if(!openingStart)openingStart=now;const t=clamp((now-openingStart)/650);stage.opening(t);openingDone=t===1;}
 else openingDone=true;
 stage.setOrbit(yaw,pitch,zoom);if(stage.renderNow())root.dataset.render='webgl';
 setChapter(p<.25?0:p<.75?1:2);
 if(!openingDone)queue();
}
function fallback(){
 staticOnly=true;active=false;cancelAnimationFrame(raf);raf=0;
 stage?.dispose();stage=undefined;layer.hidden=true;root.dataset.render='fallback';root.dataset.motion='reduce';
}
async function configure(){
 active=!still();root.dataset.motion=active?'full':'reduce';root.dataset.render=active&&stage?'webgl':'static';
 if(!active){cancelAnimationFrame(raf);raf=0;layer.hidden=true;return;}
 if(!stage){
  if(!pending)pending=(async()=>{try{const {createShoeStage}=await import('./scene');if(still())return;stage=createShoeStage(layer,fallback,{overlay:true});}catch(error){console.warn('PACE: static product views are available.',error);fallback();}finally{pending=undefined;}})();
  await pending;
 }
 if(stage&&!still()){active=true;layer.hidden=false;stage.resize();cancelAnimationFrame(raf);raf=0;draw(performance.now());}
}
function adjust(action:string){
 openingDone=true;
 if(action==='left')yaw-=.18;if(action==='right')yaw+=.18;
 if(action==='up')pitch-=.08;if(action==='down')pitch+=.08;
 if(action==='zoom-in')zoom+=.1;if(action==='zoom-out')zoom-=.1;
 if(action==='reset'){yaw=0;pitch=0;zoom=1;}
 yaw=clamp(yaw,-Math.PI*.85,Math.PI*.85);pitch=clamp(pitch,-.35,.45);zoom=clamp(zoom,.8,1.4);
 detailView.dataset.orientation=`${yaw.toFixed(2)},${pitch.toFixed(2)},${zoom.toFixed(2)}`;
 status.textContent=action==='reset'?'View reset.':`View rotated ${Math.round(yaw*180/Math.PI)} degrees. Zoom ${Math.round(zoom*100)} percent.`;queue();
}
views.forEach(button=>button.addEventListener('click',()=>{
 const index=Number(button.dataset.view);openingDone=true;adjust('reset');setChapter(index);
 if(!active){document.querySelectorAll('.static-step')[index].scrollIntoView({block:'start',behavior:'instant'});setChapter(index);return;}
 const rect=details.getBoundingClientRect();window.scrollTo({top:scrollY+rect.top+Math.max(1,rect.height-innerHeight)*index/2,behavior:'instant'});queue();
}));
document.querySelectorAll<HTMLButtonElement>('[data-orbit]').forEach(button=>button.addEventListener('click',()=>adjust(button.dataset.orbit!)));
detailView.addEventListener('keydown',event=>{
 const action:Record<string,string>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down','+':'zoom-in','=':'zoom-in','-':'zoom-out',Home:'reset','0':'reset'};
 if(action[event.key]&&active){event.preventDefault();adjust(action[event.key]);}
});
let drag:{id:number;x:number;y:number;startYaw:number;startPitch:number;touch:boolean;accepted:boolean}|undefined;
detailView.addEventListener('pointerdown',event=>{
 if(!active||event.button!==0)return;
 openingDone=true;drag={id:event.pointerId,x:event.clientX,y:event.clientY,startYaw:yaw,startPitch:pitch,touch:event.pointerType==='touch',accepted:event.pointerType!=='touch'};
 if(!drag.touch){detailView.setPointerCapture(event.pointerId);detailView.focus({preventScroll:true});}
});
detailView.addEventListener('pointermove',event=>{
 if(!drag||drag.id!==event.pointerId)return;
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
 if(!drag.accepted){if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){drag=undefined;return;}if(Math.abs(dx)<8)return;drag.accepted=true;detailView.setPointerCapture(event.pointerId);}
 yaw=clamp(drag.startYaw+dx*.006,-Math.PI*.85,Math.PI*.85);pitch=clamp(drag.startPitch+(drag.touch?0:dy*.003),-.35,.45);
 detailView.dataset.orientation=`${yaw.toFixed(2)},${pitch.toFixed(2)},${zoom.toFixed(2)}`;queue();
});
const endDrag=()=>{drag=undefined;};detailView.addEventListener('pointerup',endDrag);detailView.addEventListener('pointercancel',endDrag);detailView.addEventListener('lostpointercapture',endDrag);
addEventListener('scroll',()=>{openingDone=true;queue();},{passive:true});
addEventListener('resize',()=>{stage?.resize();queue();},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else queue();});
select.addEventListener('change',configure);reduced.addEventListener('change',configure);shortViewport.addEventListener('change',configure);
new ResizeObserver(()=>{stage?.resize();queue();}).observe(document.querySelector('.hero')!);
document.fonts.ready.then(()=>{stage?.resize();queue();});
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link=>link.addEventListener('click',()=>{
 openingDone=true;const target=document.getElementById(link.hash.slice(1));if(target&&!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');requestAnimationFrame(()=>target?.focus({preventScroll:true}));
}));
installProfiler(()=>stage?.stats()??{renderer:'static'});
if(params.has('inspect')){
 const failure=document.createElement('button');failure.id='test-context-loss';failure.textContent='Test 3D fallback';failure.addEventListener('click',()=>stage?.renderer.forceContextLoss());document.body.append(failure);
}
setChapter(0);configure();
