import './style.css';
import './integration.css';
import {installProfiler, recordInteraction} from './profiler';
import {installCanvasRecorder} from './recorder';
import type {createShoeStage, ColorwayName, ExploreView} from './scene';

type Frame = {x:number; y:number; width:number; height:number};
type Stage = ReturnType<typeof createShoeStage>;
const $ = <T extends HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
const root = document.documentElement;
const hero = $('#hero'), story = $('#story'), explorer = $('#explore'), closing = $('#closing');
const frames = {hero:$('#hero-view'), story:$('#story-view'), explore:$('#explore-view'), closing:$('#closing-view')};
const layer = $('#product-layer'), status = $('#live-status');
const motion = $<HTMLSelectElement>('#motion-select');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
const finishButtons = [...document.querySelectorAll<HTMLButtonElement>('.finish-options button[data-finish]')];
const copies = [...document.querySelectorAll<HTMLElement>('.story-copy')];
const chapterButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-chapter-go]')];
const cameraButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-camera]')];
const hotspotButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-hotspot]')];
const finishes:ColorwayName[] = ['volt','ice','infrared'];
const palettes:Record<ColorwayName,number[]> = {volt:[215,255,49],ice:[148,210,255],infrared:[255,111,96]};
const names:Record<ColorwayName,string> = {volt:'Volt',ice:'Ice',infrared:'Infrared'};
let finish:ColorwayName = finishes.includes(params.get('finish') as ColorwayName) ? params.get('finish') as ColorwayName : 'volt';
let stage:Stage|undefined, pending:Promise<void>|undefined, raf=0;
let fallbackOnly=params.get('view')==='static', exploring=false, currentChapter=-1;
let yaw=0,pitch=0,zoom=1, introStarted=0,introPlaying=false,introEligible=true;
let lastFrame:Frame|undefined, frameReturn:{from:Frame;started:number}|undefined;
let accent=palettes[finish].slice(), accentTransition:{from:number[];to:number[];started:number}|undefined;
let viewVisible=true;
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const mixFrame=(a:Frame,b:Frame,t:number):Frame=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,width:a.width+(b.width-a.width)*t,height:a.height+(b.height-a.height)*t});
const rect=(element:HTMLElement):Frame=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
const isReduced=()=>motion.value==='reduce'||(motion.value==='system'&&reduced.matches);
const staticStory=()=>isReduced()||fallbackOnly;
const duration=()=>isReduced()?0:460;
if(['full','reduce'].includes(params.get('motion')||''))motion.value=params.get('motion')!;
try{introEligible=sessionStorage.getItem('pace-after-hours-intro')!=='seen';}catch{/* Intro still works without storage. */}
if(scrollY>20||location.hash&&location.hash!=='#hero')introEligible=false;

function queue(){if(!document.hidden&&!raf)raf=requestAnimationFrame(draw);}
// The chapter number rolls like a race clock: the old digits leave in the
// direction you scroll and the new ones arrive from the other side.
let numberRoll:Animation|undefined;
function rollChapterNumber(text:string,forward:boolean){
  const el=$('#chapter-number');
  numberRoll?.cancel();
  el.textContent=text;
  if(isReduced()||currentChapter<0)return;
  const from=forward?'60%':'-60%';
  numberRoll=el.animate([
    {transform:`translateY(${from})`,opacity:0,filter:'blur(6px)'},
    {transform:'none',opacity:1,filter:'blur(0)'},
  ],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'});
}
function chapter(index:number){
  if(index===currentChapter)return;
  const forward=index>currentChapter;
  rollChapterNumber(String(index+1).padStart(2,'0'),forward);
  currentChapter=index;
  copies.forEach((copy,i)=>{copy.classList.toggle('is-active',i===index);copy.inert=i!==index;});
  chapterButtons.forEach((button,i)=>i===index?button.setAttribute('aria-current','step'):button.removeAttribute('aria-current'));
  story.dataset.chapter=String(index+1);
}
function layout(){
  const vh=innerHeight,y=scrollY;
  const sr=story.getBoundingClientRect(),er=explorer.getBoundingClientRect(),cr=closing.getBoundingClientRect();
  const top=y+sr.top,end=top+sr.height-vh,exploreTop=y+er.top,closeTop=y+cr.top;
  const h=rect(frames.hero),s=rect(frames.story),e=rect(frames.explore),c=rect(frames.closing);
  if(staticStory())return {frame:e,progress:.9,visible:exploring&&er.bottom>0&&er.top<vh};
  if(exploring&&e.y+e.height>0&&e.y<vh)return {frame:e,progress:.9,visible:true};
  if(exploring)exitExplore(false,false);
  let frame:Frame,progress:number;
  if(y<top){const t=ease((y-(top-vh*.85))/(vh*.85));frame=mixFrame(h,s,t);progress=.16*t;}
  else if(y<=end){const p=clamp((y-top)/Math.max(1,end-top));frame=s;progress=.16+p*.60;chapter(Math.min(3,Math.floor(p*4)));story.style.setProperty('--story-progress',String(p));}
  else if(y<exploreTop){const t=ease((y-end)/Math.max(1,exploreTop-end));frame=mixFrame(s,e,t);progress=.76+t*.16;}
  else if(y<closeTop){const t=ease((y-(closeTop-vh*.8))/(vh*.8));frame=mixFrame(e,c,t);progress=.92+t*.08;}
  else{frame=c;progress=1;}
  return {frame,progress,visible:frame.y+frame.height>0&&frame.y<vh&&cr.bottom>0};
}
function updateAccent(now:number){
  if(!accentTransition)return false;
  const t=clamp((now-accentTransition.started)/460),p=ease(t);
  accent=accentTransition.from.map((v,i)=>v+(accentTransition!.to[i]-v)*p);
  applyAccent();if(t===1)accentTransition=undefined;return t<1;
}
function applyAccent(){const rgb=accent.map(Math.round);root.style.setProperty('--accent',`rgb(${rgb.join(',')})`);root.style.setProperty('--accent-rgb',rgb.join(','));}
function draw(now:number){
  raf=0;if(document.hidden)return;
  const accentMoving=updateAccent(now);
  const current=layout();viewVisible=current.visible;
  layer.hidden=!stage||!current.visible;
  if(!stage){if(accentMoving)queue();return;}
  let frame=current.frame;
  if(frameReturn){const t=clamp((now-frameReturn.started)/Math.max(1,duration()));frame=mixFrame(frameReturn.from,frame,ease(t));if(t===1)frameReturn=undefined;}
  stage.setFrame(frame);stage.setStory(current.progress);stage.setOrbit(yaw,pitch,zoom);
  if(introPlaying){
    const t=clamp((now-introStarted)/2000);stage.setIntro(t);
    if(t===1)finishIntro();
  }else stage.setIntro(1);
  const moving=stage.update(now);
  if(current.visible&&stage.renderNow(now)){root.dataset.render='webgl';lastFrame=frame;positionHotspots();}
  if(current.visible&&(moving||introPlaying||frameReturn)||accentMoving)queue();
}
function positionHotspots(){
  if(!exploring||!stage)return;
  const wrap=$('.explore-view-wrap').getBoundingClientRect();
  hotspotButtons.forEach(button=>{
    const p=stage!.projectPoint(button.dataset.hotspot as 'knit'|'heel'|'sole');
    button.hidden=!p.visible;
    button.style.left=`${p.x-wrap.x}px`;button.style.top=`${p.y-wrap.y}px`;
  });
}
function finishIntro(){
  introPlaying=false;introEligible=false;root.dataset.intro='done';$('#skip-intro').hidden=true;
  $('#intro-status').textContent='Opening complete.';stage?.setIntro(1);
  try{sessionStorage.setItem('pace-after-hours-intro','seen');}catch{/* No storage requirement. */}
}
function startIntro(){
  if(!stage||isReduced()||fallbackOnly){finishIntro();queue();return;}
  introStarted=performance.now();introPlaying=true;introEligible=false;
  root.dataset.intro='playing';$('#skip-intro').hidden=false;$('#intro-status').textContent='Opening reveal. Skip is available.';
  queue();
}
function fail(){
  const lostFocus=exploring;fallbackOnly=true;finishIntro();exploring=false;root.dataset.mode='story';root.dataset.motion='reduce';root.dataset.render='fallback';
  cancelAnimationFrame(raf);raf=0;stage?.dispose();stage=undefined;layer.hidden=true;
  $('#explore-controls').hidden=true;$('#hotspots').hidden=true;
  $<HTMLButtonElement>('#enter-explore').disabled=true;$('#enter-explore').textContent='3D unavailable';
  $('#viewer-status').textContent='All product views remain available above. Choose any finish below.';
  status.textContent='Interactive 3D is unavailable. The complete image story is available.';if(lostFocus){frames.explore.focus({preventScroll:true});}
}
async function ensureStage(){
  if(stage||fallbackOnly)return;
  if(!pending)pending=(async()=>{
    try{
      const [{createShoeStage}]=await Promise.all([import('./scene'),document.fonts.ready]);
      if(fallbackOnly)return;
      stage=createShoeStage(layer,fail,{overlay:true});
      stage.transitionColorway(finish,performance.now(),0);
      // Compile/render before starting the two-second reveal: no artificial delay.
      const first=layout();stage.setFrame(first.frame);stage.setStory(first.progress);stage.setIntro(1);stage.renderNow();
      if(introEligible&&!staticStory()&&scrollY<20)startIntro();
    }catch(error){console.warn('PACE: image story is available.',error);fail();}
    finally{pending=undefined;}
  })();
  await pending;
}
async function configure(){
  root.dataset.motion=staticStory()?'reduce':'full';
  if(staticStory()){finishIntro();stage?.settleTransitions();accent=palettes[finish].slice();accentTransition=undefined;applyAccent();if(!exploring)layer.hidden=true;}
  else await ensureStage();
  stage?.resize();queue();
}
function updateFinishUI(){
  root.dataset.finish=finish;
  finishButtons.forEach(button=>{
    const active=button.dataset.finish===finish;button.setAttribute('aria-checked',String(active));button.tabIndex=active?0:-1;
    button.querySelector('b')!.textContent=active?'Selected':'Select';
  });
  document.querySelectorAll('[data-finish-name]').forEach(el=>el.textContent=names[finish]);
  frames.hero.setAttribute('aria-label',`PACE 01 in ${names[finish]}, original running-shoe concept`);
  document.querySelectorAll<HTMLImageElement>('img[data-poster]').forEach(img=>{
    img.src=`/renders/${finish}-${img.dataset.poster}.webp`;
    img.alt=`PACE 01 in ${names[finish]} — ${img.dataset.poster==='hero'?'full shoe':img.dataset.poster+' detail'}`;
  });
}
function chooseFinish(name:ColorwayName,event?:Event){
  if(name===finish)return;finish=name;updateFinishUI();
  const now=performance.now();updateAccent(now);
  if(isReduced()){accent=palettes[name].slice();accentTransition=undefined;applyAccent();}
  else accentTransition={from:accent.slice(),to:palettes[name],started:now};
  stage?.transitionColorway(name,now,duration());
  const url=new URL(location.href);url.searchParams.set('finish',name);history.replaceState(null,'',url);
  recordInteraction('finish-change',event,name);status.textContent=`${names[name]} selected. Viewing angle preserved.`;queue();
}
finishButtons.forEach((button,i)=>{
  button.addEventListener('click',event=>chooseFinish(button.dataset.finish as ColorwayName,event));
  button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(i+(['ArrowRight','ArrowDown'].includes(event.key)?1:2))%3;
    finishButtons[next].focus();chooseFinish(finishes[next],event);
  });
});
function clearSelectedView(){cameraButtons.forEach(button=>button.setAttribute('aria-pressed','false'));}
async function enterExplore(){
  finishIntro();await ensureStage();if(!stage)return;
  // Draw the story's current framing first, then hand this exact camera to Explore.
  cancelAnimationFrame(raf);raf=0;draw(performance.now());exploring=true;root.dataset.mode='explore';
  stage.setExplore(true,performance.now(),duration());
  $('#explore-controls').hidden=false;$('#hotspots').hidden=false;clearSelectedView();
  frames.explore.focus({preventScroll:true});status.textContent='Explore active. Drag or use the camera controls. Vertical scrolling stays available.';queue();
}
function exitExplore(returnToStory=false,restoreFocus=true){
  if(!exploring)return;
  if(drag){if(frames.explore.hasPointerCapture(drag.id))frames.explore.releasePointerCapture(drag.id);drag=undefined;}
  const now=performance.now();exploring=false;root.dataset.mode='story';
  stage?.setExplore(false,now,duration());$('#explore-controls').hidden=true;$('#hotspots').hidden=true;$('#hotspot-note').hidden=true;
  if(lastFrame&&!isReduced())frameReturn={from:lastFrame,started:now};
  if(returnToStory){goChapter(Math.max(0,currentChapter));const focusTarget=staticStory()?document.querySelectorAll<HTMLElement>('.static-story article')[Math.max(0,currentChapter)]:chapterButtons[Math.max(0,currentChapter)];if(staticStory())focusTarget.tabIndex=-1;focusTarget.focus({preventScroll:true});}
  else if(restoreFocus)$('#enter-explore').focus({preventScroll:true});
  status.textContent='Story camera resumed.';queue();
}
$('#enter-explore').addEventListener('click',()=>void enterExplore());
$('#exit-explore').addEventListener('click',()=>exitExplore(true));
$('#explore-again').addEventListener('click',()=>{requestAnimationFrame(()=>void enterExplore());});
function goChapter(index:number){
  finishIntro();
  if(staticStory()){document.querySelectorAll<HTMLElement>('.static-story article')[index].scrollIntoView({block:'start',behavior:'instant'});return;}
  const top=scrollY+story.getBoundingClientRect().top,travel=story.offsetHeight-innerHeight;
  window.scrollTo({top:top+travel*index/3,behavior:'instant'});chapter(index);queue();
}
chapterButtons.forEach(button=>button.addEventListener('click',()=>{if(exploring)exitExplore();goChapter(Number(button.dataset.chapterGo));}));
function view(name:ExploreView,event?:Event){
  if(!exploring||!stage)return;
  stage.setExploreView(name,performance.now(),duration());yaw=0;pitch=0;zoom=1;
  cameraButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===name)));
  recordInteraction('view',event,name);status.textContent=`${name==='threequarter'?'Three-quarter':name} view selected.`;queue();
}
cameraButtons.forEach(button=>button.addEventListener('click',event=>view(button.dataset.camera as ExploreView,event)));
const hotspotCopy={knit:['01 / Directional knit','Follow the paired yarn pattern across the upper and into the fitted collar. Closely spaced ribs change direction around the foot.'],heel:['02 / Fitted heel','A thin knit neck flows into the rear textile panel. Bonded support wraps the foot without a thick padded opening.'],sole:['03 / Sculpted foam','Two recessed channels follow the foam rocker. Shallow rubber pods sit underfoot, leaving the sculpted profile visible.']};
hotspotButtons.forEach(button=>button.addEventListener('click',event=>{
  const name=button.dataset.hotspot as 'knit'|'heel'|'sole';view(name,event);$('#hotspot-note').hidden=false;$('#hotspot-label').textContent=hotspotCopy[name][0];$('#hotspot-description').textContent=hotspotCopy[name][1];
}));
$('#close-hotspot').addEventListener('click',()=>{$('#hotspot-note').hidden=true;frames.explore.focus({preventScroll:true});});
function adjust(action:string,event:Event){
  if(!exploring)return;clearSelectedView();
  if(action==='left')yaw-=.18;if(action==='right')yaw+=.18;
  if(action==='up')pitch-=.09;if(action==='down')pitch+=.09;
  if(action==='zoom-in')zoom+=.1;if(action==='zoom-out')zoom-=.1;
  if(action==='reset'){stage?.setExploreView('threequarter',performance.now(),duration());yaw=0;pitch=0;zoom=1;}
  yaw=clamp(yaw,-Math.PI*.85,Math.PI*.85);pitch=clamp(pitch,-.55,.65);zoom=clamp(zoom,.8,1.55);
  frames.explore.dataset.orientation=`${yaw.toFixed(2)},${pitch.toFixed(2)},${zoom.toFixed(2)}`;
  recordInteraction(action==='reset'?'reset':action.includes('zoom')?(event instanceof KeyboardEvent?'zoom-key':'zoom-button'):(event instanceof KeyboardEvent?'orbit-key':'orbit-button'),event,action);
  status.textContent=action==='reset'?'Three-quarter view reset.':`Rotation ${Math.round(yaw*180/Math.PI)} degrees. Zoom ${Math.round(zoom*100)} percent.`;queue();
}
document.querySelectorAll<HTMLButtonElement>('[data-orbit]').forEach(button=>button.addEventListener('click',event=>adjust(button.dataset.orbit!,event)));
frames.explore.addEventListener('keydown',event=>{
  if(event.key==='Escape'){exitExplore();return;}
  if(!exploring&&['Enter',' '].includes(event.key)){event.preventDefault();void enterExplore();return;}
  const action:Record<string,string>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down','+':'zoom-in','=':'zoom-in','-':'zoom-out',Home:'reset','0':'reset'};
  if(exploring&&action[event.key]){event.preventDefault();adjust(action[event.key],event);}
});
let drag:{id:number;x:number;y:number;yaw:number;pitch:number;touch:boolean;accepted:boolean}|undefined;
frames.explore.addEventListener('pointerdown',event=>{
  if(!exploring||event.button!==0)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw,pitch,touch:event.pointerType==='touch',accepted:event.pointerType!=='touch'};
  if(drag.accepted){frames.explore.setPointerCapture(event.pointerId);frames.explore.focus({preventScroll:true});recordInteraction('drag-start',event);}
});
frames.explore.addEventListener('pointermove',event=>{
  if(!drag||drag.id!==event.pointerId)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.accepted){if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){drag=undefined;return;}if(Math.abs(dx)<8)return;drag.accepted=true;frames.explore.setPointerCapture(event.pointerId);recordInteraction('drag-start',event);}
  yaw=clamp(drag.yaw+dx*.007,-Math.PI*.85,Math.PI*.85);pitch=clamp(drag.pitch+(drag.touch?0:dy*.004),-.55,.65);
  clearSelectedView();frames.explore.dataset.orientation=`${yaw.toFixed(2)},${pitch.toFixed(2)},${zoom.toFixed(2)}`;recordInteraction('drag-move',event);queue();
});
function endDrag(event:Event){if(drag?.accepted)recordInteraction('drag-end',event);drag=undefined;}
frames.explore.addEventListener('pointerup',endDrag);frames.explore.addEventListener('pointercancel',endDrag);frames.explore.addEventListener('lostpointercapture',endDrag);
$('#skip-intro').addEventListener('click',()=>{finishIntro();$('#replay-intro').focus({preventScroll:true});queue();});
$('#replay-intro').addEventListener('click',()=>{
  if(exploring)exitExplore();window.scrollTo({top:0,behavior:'instant'});startIntro();
});
$('#change-finish').addEventListener('click',()=>finishButtons[finishes.indexOf(finish)].focus({preventScroll:true}));
addEventListener('scroll',()=>{if(introPlaying&&scrollY>20)finishIntro();queue();},{passive:true});
addEventListener('resize',()=>{stage?.resize();queue();},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{if(introPlaying)finishIntro();queue();}});
motion.addEventListener('change',()=>void configure());reduced.addEventListener('change',()=>void configure());
new ResizeObserver(()=>{stage?.resize();queue();}).observe(hero);
document.fonts.ready.then(()=>{stage?.resize();queue();});
addEventListener('popstate',()=>{finishIntro();const name=(new URLSearchParams(location.search).get('finish')||'volt') as ColorwayName;if(finishes.includes(name)&&name!==finish){finish=name;updateFinishUI();stage?.transitionColorway(name,performance.now(),0);accent=palettes[name].slice();accentTransition=undefined;applyAccent();}queue();});
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
  finishIntro();if(exploring&&link.hash!=='#explore')exitExplore();
  if(link.hash==='#story'&&staticStory()){event.preventDefault();const article=$<HTMLElement>('.static-story article');article.tabIndex=-1;article.scrollIntoView({block:'start',behavior:'instant'});article.focus({preventScroll:true});queue();return;}
  if(link.id==='explore-again')return;
  const target=document.getElementById(link.hash.slice(1));if(target&&!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
  requestAnimationFrame(()=>{target?.focus({preventScroll:true});queue();});
}));
installProfiler(()=>({...stage?.stats(),mode:exploring?'explore':'story',introPlaying,scheduledPageFrame:raf!==0,viewVisible,selectedFinish:finish}));
if(params.has('inspect')){const button=document.createElement('button');button.id='test-context-loss';button.textContent='Test 3D fallback';button.addEventListener('click',()=>stage?.renderer.forceContextLoss());document.body.append(button);}
window.addEventListener('pagehide',event=>{if(!event.persisted){cancelAnimationFrame(raf);stage?.dispose();}},{once:true});
installCanvasRecorder(() => stage?.renderer.domElement);
applyAccent();updateFinishUI();chapter(0);if(fallbackOnly)fail();else void configure();
