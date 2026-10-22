import {createShoeStage} from './scene';
import type {PoseName, ColorwayName} from './scene';

const params=new URLSearchParams(location.search);
if(params.has('capture'))document.body.classList.add('capture');
const status=document.querySelector<HTMLElement>('#status')!;
const host=document.querySelector<HTMLElement>('#studio-view')!;
const select=document.querySelector<HTMLSelectElement>('#pose')!;
const finish=document.querySelector<HTMLSelectElement>('#finish')!;
const record=document.querySelector<HTMLButtonElement>('#record')!;
const download=document.querySelector<HTMLAnchorElement>('#download')!;
const header=document.querySelector('header')!;
const validPoses:PoseName[]=['hero','side','knit','heel','sole','threequarter','top'];
const validFinishes:ColorwayName[]=['volt','ice','infrared'];
const finishChoice=params.get('finish') as ColorwayName|null;
if(finishChoice&&validFinishes.includes(finishChoice))finish.value=finishChoice;
const rawChoice=params.get('pose');
const choice=(rawChoice==='macro'?'knit':rawChoice) as PoseName|null;
if(choice&&validPoses.includes(choice))select.value=choice;
const stage=createShoeStage(host,()=>{status.textContent='WebGL unavailable. Asset exports cannot continue.';});
let busy=false,resizePending=false,resizeFrame=0,recordingFrame=0;

const exportButton=document.createElement('button');exportButton.textContent='Prepare transparent poster';header.append(exportButton);
const exportLink=document.createElement('a');exportLink.id='poster-download';exportLink.hidden=true;exportLink.textContent='Download transparent poster';header.append(exportLink);
const sequenceButton=document.createElement('button');sequenceButton.textContent='Export offline 30 fps model sequence';header.append(sequenceButton);
const liveCaptureSupported='MediaRecorder' in window&&Boolean(HTMLCanvasElement.prototype.captureStream);
record.disabled=!liveCaptureSupported;

function apply(){
  stage.setColorway(finish.value as ColorwayName);
  stage.setPose(select.value as PoseName);document.body.dataset.pose=select.value;document.body.dataset.finish=finish.value;
  stage.renderNow();
}
function refreshSize(){
  resizeFrame=0;
  if(busy){resizePending=true;return;}
  stage.resize();stage.renderNow();
}
const observer=new ResizeObserver(()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(refreshSize);});observer.observe(host);
window.addEventListener('resize',()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(refreshSize);},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)refreshSize();});
function lock(value:boolean){
  busy=value;record.disabled=value||!liveCaptureSupported;select.disabled=value;finish.disabled=value;exportButton.disabled=value;sequenceButton.disabled=value;
  if(!value&&resizePending){resizePending=false;refreshSize();}
}
function restore(){
  stage.renderer.setClearColor(0x000000,0);
  stage.resize();apply();lock(false);
}
function selectionChanged(){exportLink.hidden=true;apply();status.textContent=finish.options[finish.selectedIndex].text+' / '+select.options[select.selectedIndex].text+'. Shared geometry; colors applied immediately.';}
select.addEventListener('change',selectionChanged);finish.addEventListener('change',selectionChanged);
apply();
status.textContent='Three finishes × five standard views share one original mesh. Poster exports are transparent 1200 × 900 PNGs named finish-view.png. Optional views are excluded from the production poster set.';
const statsTimer=setInterval(()=>document.querySelector('#stats')!.textContent=JSON.stringify(stage.stats(),null,2),800);

exportButton.addEventListener('click',()=>{
  if(busy)return;
  const previousStyle=host.style.cssText;
  try{
    // Export framing is fixed independently of the responsive authoring viewport.
    host.style.width='1200px';host.style.height='900px';host.style.maxWidth='none';
    stage.resize();stage.renderer.setPixelRatio(1);apply();
    const name=finish.value+'-'+select.value;
    exportLink.href=stage.snapshot('image/png');exportLink.download=name+'.png';exportLink.hidden=false;
    status.textContent='Transparent '+name+'.png ready: '+stage.renderer.domElement.width+' × '+stage.renderer.domElement.height+'. Actual final geometry and selected palette; save into assets/render-source/.';
  }catch(error){status.textContent='Poster export failed: '+String(error);exportLink.hidden=true;}
  finally{host.style.cssText=previousStyle;stage.resize();apply();}
});

if(!liveCaptureSupported)status.textContent+=' Live canvas recording is unavailable in this browser.';
record.addEventListener('click',()=>{
  if(record.disabled||busy)return;
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
  if(!mime){status.textContent='No supported WebM encoder.';return;}
  lock(true);download.hidden=true;
  stage.renderer.setClearColor(0xf8f8f1,1);stage.renderNow();
  const stream=stage.renderer.domElement.captureStream(30);
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4500000});
  const chunks:Blob[]=[];
  let frameCount=0;
  status.textContent='Capturing the live model canvas for 8 seconds. Browser throttling will remain visible; this does not record page scrolling.';
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onstop=()=>{
    cancelAnimationFrame(recordingFrame);
    const blob=new Blob(chunks,{type:mime});
    download.href=URL.createObjectURL(blob);download.download='pace-'+finish.value+'-live-model-canvas.webm';download.hidden=false;
    stream.getTracks().forEach(track=>track.stop());restore();
    status.textContent='Live canvas capture: '+frameCount+' rendering updates / '+(blob.size/1024/1024).toFixed(2)+' MB. Not a full-page recording or sustained-scroll benchmark.';
  };
  recorder.onerror=()=>{status.textContent='Live canvas recording failed. No performance conclusion can be drawn.';if(recorder.state!=='inactive')recorder.stop();};
  recorder.start();const start=performance.now();
  function frame(now:number){
    const t=Math.min((now-start)/8000,1);stage.setProgress(t);stage.renderNow();frameCount++;
    if(t<1&&recorder.state==='recording')recordingFrame=requestAnimationFrame(frame);
    else if(recorder.state!=='inactive')recorder.stop();
  }
  recordingFrame=requestAnimationFrame(frame);
});

// Deliberately offline export. Each model frame has a synthetic 1/30s timestamp.
// It documents the asset and camera path, never live browser smoothness.
sequenceButton.addEventListener('click',async()=>{
  if(busy)return;
  lock(true);download.hidden=true;
  try{
    const {Output,BufferTarget,CanvasSource,WebMOutputFormat}=await import('mediabunny');
    stage.resize();stage.renderer.setPixelRatio(1);stage.renderer.setClearColor(0xf8f8f1,1);
    const output=new Output({format:new WebMOutputFormat(),target:new BufferTarget()});
    const source=new CanvasSource(stage.renderer.domElement,{codec:'vp9',bitrate:4000000});
    output.addVideoTrack(source,{frameRate:30});await output.start();
    for(let frame=0;frame<240;frame++){
      stage.setProgress(frame/239);stage.renderNow();await source.add(frame/30,1/30);
      if(frame%30===0)status.textContent='Offline model sequence: '+Math.round(frame/240*100)+'%. This is not a live performance test.';
    }
    await output.finalize();
    const blob=new Blob([output.target.buffer!],{type:'video/webm'});
    const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
    download.href=dataUrl;download.download='pace-'+finish.value+'-offline-model-sequence.webm';download.hidden=false;
    status.textContent='Offline export: 8 seconds / 240 frames / '+(blob.size/1024/1024).toFixed(2)+' MB. Not a live page recording or evidence of browser performance.';
  }catch(error){status.textContent='Offline video export unavailable: '+String(error);}
  finally{restore();}
});
window.addEventListener('pagehide',event=>{if(event.persisted)return;observer.disconnect();clearInterval(statsTimer);cancelAnimationFrame(resizeFrame);cancelAnimationFrame(recordingFrame);stage.dispose();},{once:true});
