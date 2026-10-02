/**
 * Optional live WebGL-layer capture. It never drives the scene, scrolls the page,
 * requests animation frames, records a microphone, or captures other surfaces.
 */
export function installCanvasRecorder(getCanvas: () => HTMLCanvasElement | undefined) {
  if (new URLSearchParams(location.search).get('record') !== '1' || document.getElementById('live-canvas-recorder')) return;

  const panel = document.createElement('aside');
  panel.id = 'live-canvas-recorder';
  panel.setAttribute('aria-label', 'Live canvas recording');
  Object.assign(panel.style, {
    position: 'fixed', top: '120px', right: '20px', zIndex: '100',
    width: 'min(310px, calc(100vw - 40px))', padding: '12px',
    background: '#11151df2', color: '#f6f6ee', border: '1px solid #627089',
    font: '12px/1.5 system-ui'
  });
  const start = document.createElement('button');
  start.type = 'button'; start.textContent = 'Start live canvas recording';
  const stop = document.createElement('button');
  stop.type = 'button'; stop.textContent = 'Stop live canvas recording'; stop.hidden = true;
  for (const button of [start, stop]) {
    Object.assign(button.style, {
      minHeight: '44px', padding: '10px 12px', font: '600 12px system-ui',
      border: '1px solid #ddff70', background: '#ddff70', color: '#11151d', cursor: 'pointer'
    });
    button.addEventListener('focus', () => {button.style.outline = '3px solid #8bbaff'; button.style.outlineOffset = '3px';});
    button.addEventListener('blur', () => {button.style.outline = ''; button.style.outlineOffset = '';});
  }
  const status = document.createElement('p');
  status.id = 'live-recording-status'; status.setAttribute('role', 'status');
  status.style.margin = '10px 0 0';
  const notice = document.createElement('p');
  notice.textContent = 'Records only the live WebGL layer. DOM typography and page backgrounds are excluded. This is not a full-page recording or FPS proof.';
  Object.assign(notice.style, {margin: '10px 0 0', fontSize: '11px', color: '#c1c9d5'});
  const link = document.createElement('a');
  link.id = 'live-recording-download'; link.textContent = 'Download live canvas recording'; link.hidden = true;
  Object.assign(link.style, {color: '#ddff70', marginTop: '10px', overflowWrap: 'anywhere'});
  panel.append(start, stop, status, link, notice);
  document.body.append(panel);

  const supported = typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  if (!supported) {
    start.disabled = true;
    status.textContent = 'Live canvas recording is unavailable in this browser.';
    return;
  }
  status.textContent = 'Ready. Recording stops after approximately 12 seconds. Navigate and interact normally.';

  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let timer = 0;
  let reader: FileReader | undefined;
  let leaving = false;
  let session = 0;

  function releaseTracks() {
    const captured = stream;
    stream = undefined;
    captured?.getTracks().forEach(track => track.stop());
  }
  function idle() {
    clearTimeout(timer); timer = 0; recorder = undefined;
    if (!leaving) {start.disabled = false; stop.hidden = true; stop.disabled = false;}
  }
  function requestStop() {
    clearTimeout(timer); timer = 0;
    if (recorder && recorder.state !== 'inactive') {
      stop.disabled = true;
      if (!leaving) status.textContent = 'Finishing the live canvas file…';
      try {recorder.stop();} catch (error) {
        releaseTracks(); idle();
        if (!leaving) status.textContent = 'Recording could not finish: ' + String(error);
      }
    }
  }

  start.addEventListener('click', () => {
    if (start.disabled || leaving || recorder) return;
    const canvas = getCanvas();
    if (!canvas || !canvas.isConnected || canvas.width < 1 || canvas.height < 1 || canvas.getBoundingClientRect().width < 1) {
      status.textContent = 'The live WebGL canvas is not available. Enable full motion and wait for the shoe to appear, then retry.';
      return;
    }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(value => MediaRecorder.isTypeSupported(value));
    if (!mime) {status.textContent = 'This browser has no supported WebM recording encoder.'; return;}

    const own = ++session;
    const chunks: Blob[] = [];
    let errorMessage = '';
    let started = 0;
    link.hidden = true; link.removeAttribute('href');
    start.disabled = true; stop.hidden = false; stop.disabled = false;
    try {
      stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: 5000000});
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', requestStop, {once: true}));
      recorder.ondataavailable = event => {if (own === session && event.data.size) chunks.push(event.data);};
      recorder.onerror = event => {
        if (own !== session) return;
        errorMessage = 'The browser reported a live recording error: ' + event.type;
        requestStop();
        if (recorder?.state === 'inactive') {
          releaseTracks(); idle();
          if (!leaving) status.textContent = errorMessage;
        }
      };
      recorder.onstop = () => {
        if (own !== session) return;
        const elapsedSeconds = (performance.now() - started) / 1000;
        clearTimeout(timer); timer = 0; releaseTracks();
        if (leaving || own !== session) {idle(); return;}
        if (errorMessage) {idle(); status.textContent = errorMessage; return;}
        const blob = new Blob(chunks, {type: mime});
        if (!blob.size) {idle(); status.textContent = 'The browser returned no live video data. No recording is available.'; return;}
        status.textContent = 'Preparing the recorded file…';
        reader = new FileReader();
        reader.onload = () => {
          if (leaving || own !== session) return;
          if (typeof reader?.result !== 'string') {idle(); status.textContent = 'The recorded file could not be read.'; return;}
          link.href = reader.result;
          link.download = 'pace-after-hours-live-canvas.webm';
          link.hidden = false;
          status.textContent = 'Capture window: ' + elapsedSeconds.toFixed(1) + ' seconds (' + (blob.size / 1024 / 1024).toFixed(2) + ' MB). Encoded playback duration may differ; check the downloaded clip. This is not display-FPS evidence.';
          reader = undefined; idle();
        };
        reader.onerror = () => {
          reader = undefined; idle();
          if (!leaving) status.textContent = 'The browser could not prepare the recording for download.';
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      started = performance.now();
      status.textContent = 'Recording the live WebGL layer. Scroll and use the page normally; capture stops after approximately 12 seconds.';
      timer = window.setTimeout(requestStop, 12000);
    } catch (error) {
      releaseTracks(); idle();
      status.textContent = 'Live canvas recording is unavailable: ' + String(error);
    }
  });
  stop.addEventListener('click', requestStop);
  window.addEventListener('pagehide', () => {
    leaving = true; session++; clearTimeout(timer); timer = 0;
    if (reader?.readyState === FileReader.LOADING) reader.abort();
    reader = undefined; requestStop(); releaseTracks(); recorder = undefined;
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    leaving = false; idle();
    status.textContent = 'Ready. The previous capture was stopped when this page was left.';
  });
}
