import { installProfiler } from '../../src/profiler';
import './style.css';
import './integration.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { createShoeStage } from './scene';
gsap.registerPlugin(ScrollTrigger);
const hero=document.querySelector<HTMLElement>('#hero')!;
const heroView=document.querySelector<HTMLElement>('#hero-view')!;
const detailView=document.querySelector<HTMLElement>('#detail-view')!;
const details=document.querySelector<HTMLElement>('#details')!;
const steps=[...document.querySelectorAll<HTMLElement>('.detail-step')];
const params=new URLSearchParams(location.search);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const shortViewport=matchMedia('(max-width: 700px) and (max-height: 699px), (max-height: 599px)');
const motionSelect=document.createElement('select');motionSelect.id='motion-select';motionSelect.setAttribute('aria-label','Motion preference');
motionSelect.innerHTML='<option value="system">System motion</option><option value="reduce">Reduced motion</option><option value="full">Full motion</option>';
if(params.get('motion')==='full')motionSelect.value='full';
const motionLabel=document.createElement('label');motionLabel.className='motion-control';motionLabel.innerHTML='<span>Motion</span>';motionLabel.append(motionSelect);
(document.querySelector('footer')||document.body).append(motionLabel);
const formImages=['form','texture','contact'];
heroView.insertAdjacentHTML('afterbegin','<img class="shoe-poster" src="/diagnostics/baseline-renders/hero.webp" alt="PACE 01: original chalk running shoe with cobalt overlays, acid accents and sculpted sole" width="1100" height="850" fetchpriority="high">');
detailView.insertAdjacentHTML('afterbegin','<img class="shoe-poster" src="/diagnostics/baseline-renders/form.webp" alt="PACE 01 side profile" width="1100" height="850" loading="lazy">');
steps.forEach((step,i)=>step.insertAdjacentHTML('beforeend',`<img class="static-detail" src="/diagnostics/baseline-renders/${formImages[i]}.webp" alt="${['PACE 01 sculpted silhouette','Close view of the original woven upper and lacing','Underneath PACE 01, showing the segmented tread'][i]}" width="1100" height="850" loading="lazy">`));
let stage:ReturnType<typeof createShoeStage>|undefined;
let context:gsap.Context|undefined;
let generation=0, progress=0, staticView=params.get('view')==='static';
let measurements={lcpMs:0,cls:0,longTaskCount:0,longTaskTotalMs:0};
try{new PerformanceObserver(list=>{for(const e of list.getEntries())measurements.lcpMs=Math.round(e.startTime);}).observe({type:'largest-contentful-paint',buffered:true});
new PerformanceObserver(list=>{for(const e of list.getEntries()){const v=e as PerformanceEntry&{hadRecentInput:boolean;value:number};if(!v.hadRecentInput)measurements.cls+=v.value;}}).observe({type:'layout-shift',buffered:true});
new PerformanceObserver(list=>{for(const e of list.getEntries()){measurements.longTaskCount++;measurements.longTaskTotalMs+=e.duration;}}).observe({type:'longtask',buffered:true});}catch{/* Browser may not expose optional performance entries. */}
let statsPanel:HTMLElement|undefined;
if(params.has('inspect')){statsPanel=document.createElement('pre');statsPanel.id='pace-metrics';statsPanel.setAttribute('aria-label','Local performance observations');document.body.append(statsPanel);const failureButton=document.createElement('button');failureButton.textContent='Test 3D fallback';failureButton.id='test-context-loss';failureButton.addEventListener('click',()=>stage?.renderer.forceContextLoss());document.body.append(failureButton);setInterval(()=>{statsPanel!.textContent=JSON.stringify({mode:document.documentElement.dataset.motion,renderer:stage?'webgl':'static',...measurements,cls:Number(measurements.cls.toFixed(4)),viewport:[innerWidth,innerHeight],...stage?.stats()},null,2);},900);}
const mode=()=>motionSelect.value==='reduce'||(motionSelect.value==='system'&&reduced.matches);
function fail(){stage?.dispose();stage=undefined;staticView=true;document.documentElement.dataset.render='fallback';document.documentElement.dataset.motion='reduce';context?.revert();details.style.removeProperty('--sequence-progress');}
async function configure(){
  const own=++generation;context?.revert();stage?.dispose();stage=undefined;
  const still=mode()||staticView||shortViewport.matches;document.documentElement.dataset.motion=still?'reduce':'full';
  if(still){document.documentElement.dataset.render='static';return;}
  try{
    const {createShoeStage}=await import('./scene');if(own!==generation)return;
    stage=createShoeStage(heroView,fail);document.documentElement.dataset.render='webgl';
    context=gsap.context(()=>{
      // The text is readable in HTML before JS arrives. Only a short travel, never a loader.
      let openingTween:gsap.core.Tween|undefined;
      if(scrollY<80){gsap.from('.hero-title .word',{yPercent:12,rotation:1.5,stagger:.09,duration:.8,ease:'power3.out',clearProps:'transform'});const intro={t:0};openingTween=gsap.to(intro,{t:1,duration:1.25,ease:'power2.out',onUpdate:()=>stage?.opening(intro.t)});}
      const timeline={p:0};
      gsap.to(timeline,{p:1,ease:'none',scrollTrigger:{trigger:details,start:'top top',end:'bottom bottom',scrub:.35},onUpdate:()=>{progress=timeline.p;stage?.setProgress(progress);details.style.setProperty('--sequence-progress',String(progress));}});
      ScrollTrigger.create({trigger:details,start:'top 85%',end:'bottom top',onToggle:self=>{if(!stage)return;openingTween?.kill();stage.setHost(self.isActive?detailView:heroView);if(self.isActive)stage.setProgress(progress);else stage.setPose('hero');}});
      gsap.to('.hero-title',{yPercent:-8,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:.4}});
      steps.forEach(step=>gsap.from(step.querySelector('h2'),{y:28,rotation:1.2,duration:.7,ease:'power3.out',scrollTrigger:{trigger:step,start:'top 70%',toggleActions:'play none none reverse'}}));
      steps.forEach((step,i)=>ScrollTrigger.create({trigger:step,start:'top center',end:'bottom center',onToggle:self=>{if(self.isActive){details.dataset.chapter=String(i+1);document.querySelectorAll('[data-chapter-link]').forEach((a,n)=>a.setAttribute('aria-current',n===i?'step':'false'));}}}));
    });
    ScrollTrigger.refresh();
  }catch(error){if(own!==generation)return;console.warn('PACE: using the static product sequence.',error);fail();}
}
motionSelect.addEventListener('change',configure);reduced.addEventListener('change',configure);shortViewport.addEventListener('change',configure);
// Anchor navigation stays native and browser history remains meaningful.
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link=>link.addEventListener('click',()=>{const id=link.getAttribute('href')!.slice(1);const target=document.getElementById(id);if(target&&!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');requestAnimationFrame(()=>target?.focus({preventScroll:true}));}));
installProfiler(() => stage?.stats() ?? {renderer:'static'});
configure();
