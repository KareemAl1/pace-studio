// Opt-in diagnostics. This measurement rAF never drives the scene or changes scrolling.
type StatsGetter = () => Record<string, unknown>;
type LongTask = { startTime: number; duration: number };
const enabled = new URLSearchParams(location.search).get('profile') === '1';
let active = false, installed = false, raf = 0, stopTimer = 0, started = 0, previous = 0;
let lastScroll = 0, consumedScroll = 0;
let gaps: number[] = [], cpu: number[] = [], latencies: number[] = [], longTasks: LongTask[] = [];
let events = { scroll: 0, trustedScroll: 0, wheel: 0, trustedWheel: 0, scrollKeys: 0 };
let visibility: { atMs: number; hidden: boolean }[] = [];
let setups: number[] = [], lifetimeDraws = 0, intervalDraws = 0;
let readStats: StatsGetter = () => ({});
let output: HTMLPreElement | undefined, startButton: HTMLButtonElement | undefined, stopButton: HTMLButtonElement | undefined;
let startStats: Record<string, unknown> = {}, longObserver: PerformanceObserver | undefined;
const round = (value: number) => Math.round(value * 100) / 100;
const summary = (values: number[]) => {
  if (!values.length) return { count: 0, median: null, p95: null, max: null, mean: null };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return { count: values.length, median: round(percentile(.5)), p95: round(percentile(.95)), max: round(sorted[sorted.length - 1]), mean: round(values.reduce((a, b) => a + b, 0) / values.length) };
};
const collectLongTasks = (entries: PerformanceEntry[]) => {
  if (!active) return;
  for (const entry of entries) if (entry.startTime >= started) longTasks.push({ startTime: round(entry.startTime - started), duration: round(entry.duration) });
};
export function recordSetup(ms: number) { if (enabled) setups.push(round(ms)); }
export function recordRender(ms: number) {
  if (!enabled) return;
  lifetimeDraws++;
  if (!active) return;
  intervalDraws++; cpu.push(ms);
  if (lastScroll > consumedScroll && lastScroll >= started) { latencies.push(performance.now() - lastScroll); consumedScroll = lastScroll; }
}
function sample(now: number) {
  if (!active) return;
  if (previous) gaps.push(now - previous); // Retain every gap, including throttled or hidden-tab intervals.
  previous = now;
  if (gaps.length >= 12000) { stop('sample-cap'); return; }
  raf = requestAnimationFrame(sample);
}
function stop(reason = 'user') {
  if (!active) return;
  if (longObserver) collectLongTasks(longObserver.takeRecords());
  const duration = performance.now() - started;
  active = false; cancelAnimationFrame(raf); clearTimeout(stopTimer);
  startButton!.disabled = false; stopButton!.disabled = true;
  const hidden = visibility.some(item => item.hidden);
  const result = {
    label: 'LIVE BROWSER SAMPLE — native wheel/keyboard events; may be driven by UI automation',
    sampleId: new Date(performance.timeOrigin + started).toISOString(),
    sampleRange: { startMs: round(started), endMs: round(started + duration), timeOriginMs: performance.timeOrigin },
    url: location.pathname + location.search,
    stoppedBy: reason, durationMs: round(duration),
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    visibility, documentHiddenAtStop: document.hidden,
    events, rendererDrawsDuringSample: intervalDraws, rendererDrawsLifetime: lifetimeDraws,
    setupMs: setups, frameGapsMs: summary(gaps),
    gapsOver33ms: gaps.filter(value => value > 33.34).length,
    gapsOver50ms: gaps.filter(value => value > 50).length,
    cpuRenderSubmissionMs: summary(cpu),
    scrollEventToRenderEndMs: summary(latencies),
    longTasks: { supported: Boolean(longObserver), count: longTasks.length, totalMs: round(longTasks.reduce((sum, task) => sum + task.duration, 0)), entries: longTasks },
    rendererAtStart: startStats, rendererAtStop: readStats(),
    caveats: [
      'rAF cadence includes ALL observed gaps. It measures this browser scheduling, not isolated GPU execution.',
      'The measurement rAF runs only during this explicit sample; it never updates or renders the product.',
      'CPU render timing and event-to-render-end latency measure submission, not presentation or GPU completion.',
      'Wheel/scroll/key counts reflect the actual events received. A zero-input sample does not establish scrolling smoothness.',
      ...(gaps.length < 120 ? ['Small sample: fewer than 120 frame intervals; sustained smoothness is not established.'] : []),
      ...(hidden ? ['Visibility changed or the page was hidden; this is not a foreground-only benchmark.'] : []),
      ...(events.scroll < 10 ? ['Fewer than 10 scroll events; this sample is not adequate evidence of sustained live scrolling.'] : []),
      'Emulated viewport measurements are not physical-phone measurements.'
    ],
    rawFrameGapsMs: gaps.map(round), rawCpuRenderMs: cpu.map(round), rawScrollLatencyMs: latencies.map(round)
  };
  output!.textContent = JSON.stringify(result, null, 2);
}
export function installProfiler(getStats: StatsGetter) {
  if (!enabled || installed) return;
  installed = true; readStats = getStats;
  const panel = document.createElement('aside'); panel.id = 'live-profiler'; panel.setAttribute('aria-label', 'Opt-in live browser profiler');
  Object.assign(panel.style, { position:'fixed', right:'12px', bottom:'12px', zIndex:'200', width:'min(390px, calc(100vw - 24px))', background:'#10131af2', color:'#eff1f5', padding:'12px', border:'1px solid #6b7796', font:'12px/1.4 monospace' });
  const controls = document.createElement('div'); Object.assign(controls.style, {display:'flex', gap:'8px', flexWrap:'wrap'});
  startButton = document.createElement('button'); startButton.textContent = 'Start live sample';
  stopButton = document.createElement('button'); stopButton.textContent = 'Stop live sample'; stopButton.disabled = true;
  for (const button of [startButton, stopButton]) Object.assign(button.style, {font:'12px system-ui', minHeight:'40px', background:'#ddff00', color:'#111', border:'0', padding:'8px 12px', cursor:'pointer'});
  output = document.createElement('pre'); output.id = 'profile-json';
  Object.assign(output.style, {maxHeight:'45vh', overflow:'auto', whiteSpace:'pre-wrap', margin:'10px 0 0', font:'10px/1.4 monospace'});
  output.textContent = 'Ready. Start, scroll normally down and back up, then Stop. Maximum 90 seconds. Keep this tab visible.';
  controls.append(startButton, stopButton); panel.append(controls, output); document.body.append(panel);
  const scroll = () => { if (active) { events.scroll++; lastScroll = performance.now(); } };
  window.addEventListener('scroll', event => { scroll(); if (active && event.isTrusted) events.trustedScroll++; }, {passive:true});
  window.addEventListener('wheel', event => { if (active) {events.wheel++; if (event.isTrusted) events.trustedWheel++;} }, {passive:true});
  window.addEventListener('keydown', event => { if (active && ['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) events.scrollKeys++; });
  document.addEventListener('visibilitychange', () => { if (active) visibility.push({atMs:round(performance.now() - started), hidden:document.hidden}); });
  try { longObserver = new PerformanceObserver(list => collectLongTasks(list.getEntries())); longObserver.observe({type:'longtask'}); } catch { /* Optional browser capability. */ }
  startButton.addEventListener('click', () => {
    if (active) return;
    gaps=[];cpu=[];latencies=[];longTasks=[];intervalDraws=0;previous=0;lastScroll=0;consumedScroll=0;
    events={scroll:0,trustedScroll:0,wheel:0,trustedWheel:0,scrollKeys:0};
    started=performance.now();visibility=[{atMs:0,hidden:document.hidden}];startStats=readStats();active=true;
    startButton!.disabled=true;stopButton!.disabled=false;
    output!.textContent='Sampling live browser. Scroll down, reverse direction, and stop. No scrolling is simulated by this profiler.';
    raf=requestAnimationFrame(sample); stopTimer=window.setTimeout(() => stop('90-second-limit'),90000);
  });
  stopButton.addEventListener('click', () => stop());
}
