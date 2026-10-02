// Opt-in diagnostics. This measurement rAF never drives the scene or changes scrolling.
type StatsGetter = () => Record<string, unknown>;
type LongTask = { startTime: number; duration: number };
export type InteractionKind = 'drag-start' | 'drag-move' | 'drag-end' | 'orbit-button' | 'orbit-key' | 'zoom-button' | 'zoom-key' | 'reset' | 'finish-change' | 'view';
type InteractionEntry = { atMs: number; kind: InteractionKind; source: 'trusted-event' | 'untrusted-event' | 'app'; detail: string };
type NavigationEntry = { atMs: number; kind: 'scroll' | 'wheel' | 'scroll-key'; scrollY: number; trusted: boolean; detail?: string; deltaY?: number };
const interactionKinds: InteractionKind[] = ['drag-start','drag-move','drag-end','orbit-button','orbit-key','zoom-button','zoom-key','reset','finish-change','view'];
const newInteractionCounts = () => Object.fromEntries(interactionKinds.map(kind => [kind, { total: 0, trusted: 0, untrusted: 0, app: 0 }])) as Record<InteractionKind, { total: number; trusted: number; untrusted: number; app: number }>;
const enabled = new URLSearchParams(location.search).get('profile') === '1';
const MAX_SAMPLES = 12000, MAX_INPUT_ENTRIES = 2000, MAX_LONG_TASKS = 1000, MAX_COUNT = 10000000;
const increment = (count: number) => Math.min(MAX_COUNT, count + 1);
let active = false, installed = false, raf = 0, stopTimer = 0, started = 0, previous = 0;
let lastScroll = 0, consumedScroll = 0, lastInteraction = 0, consumedInteraction = 0, previousRenderEnd = 0;
let gaps: number[] = [], cpu: number[] = [], latencies: number[] = [], interactionLatencies: number[] = [], renderGaps: number[] = [], renderEnds: number[] = [], longTasks: LongTask[] = [];
let events = { scroll: 0, trustedScroll: 0, wheel: 0, trustedWheel: 0, scrollKeys: 0, trustedScrollKeys: 0 };
let interactionCounts = newInteractionCounts(), interactionEntries: InteractionEntry[] = [];
let navigationEntries: NavigationEntry[] = [], droppedNavigationEntries = 0, previousScrollY = 0, previousDirection = 0, scrollDirectionChanges = 0;
let droppedRenderSamples = 0, droppedInputEntries = 0, longTaskCount = 0, longTaskTotalMs = 0;
let visibility: { atMs: number; hidden: boolean }[] = [];
let setups: number[] = [], lifetimeDraws = 0, intervalDraws = 0;
let readStats: StatsGetter = () => ({});
let output: HTMLPreElement | undefined, startButton: HTMLButtonElement | undefined, stopButton: HTMLButtonElement | undefined;
let startStats: Record<string, unknown> = {}, longObserver: PerformanceObserver | undefined, longTasksSupported = false;
const round = (value: number) => Math.round(value * 100) / 100;
const summary = (values: number[]) => {
  if (!values.length) return { count: 0, median: null, p95: null, max: null, mean: null };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return { count: values.length, median: round(percentile(.5)), p95: round(percentile(.95)), max: round(sorted[sorted.length - 1]), mean: round(values.reduce((a, b) => a + b, 0) / values.length) };
};
const collectLongTasks = (entries: PerformanceEntry[]) => {
  if (!active) return;
  for (const entry of entries) if (entry.startTime >= started) {
    longTaskCount = increment(longTaskCount); longTaskTotalMs += entry.duration;
    if (longTasks.length < MAX_LONG_TASKS) longTasks.push({ startTime: round(entry.startTime - started), duration: round(entry.duration) });
  }
};
function navigationTrace(kind: NavigationEntry['kind'], event: Event, detail?: string, deltaY?: number) {
  if (navigationEntries.length < MAX_INPUT_ENTRIES) navigationEntries.push({ atMs: round(performance.now() - started), kind, scrollY: round(scrollY), trusted: event.isTrusted, ...(detail ? {detail} : {}), ...(deltaY !== undefined && Number.isFinite(deltaY) ? {deltaY: round(deltaY)} : {}) });
  else droppedNavigationEntries = increment(droppedNavigationEntries);
}
export function recordSetup(ms: number) { if (enabled && Number.isFinite(ms) && ms >= 0 && setups.length < 64) setups.push(round(ms)); }
// Call from accepted interaction handlers, not from every pointermove or programmatic reset.
// Event.isTrusted distinguishes dispatched events, not a human from browser UI automation.
export function recordInteraction(kind: InteractionKind, event?: Pick<Event, 'isTrusted'>, detail = '') {
  if (!enabled || !active || !Object.hasOwn(interactionCounts, kind)) return;
  const now = performance.now(); lastInteraction = now;
  const count = interactionCounts[kind]; count.total = increment(count.total);
  const source = event ? (event.isTrusted ? 'trusted-event' : 'untrusted-event') : 'app';
  if (source === 'trusted-event') count.trusted = increment(count.trusted);
  else if (source === 'untrusted-event') count.untrusted = increment(count.untrusted);
  else count.app = increment(count.app);
  if (interactionEntries.length < MAX_INPUT_ENTRIES) interactionEntries.push({ atMs: round(now - started), kind, source, detail: detail.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 72) });
  else droppedInputEntries = increment(droppedInputEntries);
}
export function recordRender(ms: number) {
  if (!enabled || !Number.isFinite(ms) || ms < 0) return;
  lifetimeDraws = increment(lifetimeDraws);
  if (!active) return;
  const now = performance.now(); intervalDraws = increment(intervalDraws);
  if (cpu.length < MAX_SAMPLES) {
    cpu.push(ms); renderEnds.push(now - started);
    if (previousRenderEnd) renderGaps.push(now - previousRenderEnd);
  } else droppedRenderSamples = increment(droppedRenderSamples);
  previousRenderEnd = now;
  if (lastScroll > consumedScroll && lastScroll >= started) {
    if (latencies.length < MAX_SAMPLES) latencies.push(now - lastScroll);
    consumedScroll = lastScroll;
  }
  if (lastInteraction > consumedInteraction && lastInteraction >= started) {
    if (interactionLatencies.length < MAX_SAMPLES) interactionLatencies.push(now - lastInteraction);
    consumedInteraction = lastInteraction;
  }
}
function sample(now: number) {
  if (!active) return;
  if (previous) gaps.push(now - previous); // Retain every gap, including throttled or hidden-tab intervals.
  previous = now;
  if (gaps.length >= MAX_SAMPLES) { stop('sample-cap'); return; }
  raf = requestAnimationFrame(sample);
}
function stop(reason = 'user') {
  if (!active) return;
  if (longObserver) collectLongTasks(longObserver.takeRecords());
  const duration = performance.now() - started;
  active = false; cancelAnimationFrame(raf); clearTimeout(stopTimer);
  startButton!.disabled = false; stopButton!.disabled = true;
  const hidden = visibility.some(item => item.hidden);
  const interactionTotal = Object.values(interactionCounts).reduce((sum, item) => sum + item.total, 0);
  const result = {
    label: 'LIVE BROWSER SAMPLE — received scrolling and accepted product-control inputs; UI automation may be used',
    schemaVersion: 2,
    sampleId: new Date(performance.timeOrigin + started).toISOString(),
    sampleRange: { startMs: round(started), endMs: round(started + duration), timeOriginMs: performance.timeOrigin },
    url: location.pathname + location.search,
    stoppedBy: reason, durationMs: round(duration),
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    visibility, documentHiddenAtStop: document.hidden,
    events, navigation: { scrollDirectionChanges, entries: navigationEntries, droppedEntries: droppedNavigationEntries },
    interactions: { total: interactionTotal, byKind: interactionCounts, entries: interactionEntries, droppedEntries: droppedInputEntries },
    rendererDrawsDuringSample: intervalDraws, rendererDrawsLifetime: lifetimeDraws,
    setupMs: setups, frameGapsMs: summary(gaps),
    gapsOver33ms: gaps.filter(value => value > 33.34).length,
    gapsOver50ms: gaps.filter(value => value > 50).length,
    renderSubmissionGapsMs: summary(renderGaps),
    renderSubmissionGapsOver33ms: renderGaps.filter(value => value > 33.34).length,
    renderSubmissionGapsOver50ms: renderGaps.filter(value => value > 50).length,
    cpuRenderSubmissionMs: summary(cpu),
    scrollEventToRenderEndMs: summary(latencies),
    acceptedInteractionToRenderEndMs: summary(interactionLatencies),
    droppedRenderSamples,
    longTasks: { supported: longTasksSupported, count: longTaskCount, totalMs: round(longTaskTotalMs), entries: longTasks, droppedEntries: Math.max(0, longTaskCount - longTasks.length) },
    rendererAtStart: startStats, rendererAtStop: readStats(),
    caveats: [
      'rAF cadence includes ALL observed gaps. It measures browser scheduling, not product rendering, GPU execution or presentation.',
      'Actual render-submission gaps are measured independently at recordRender calls. They include intentional on-demand idle time; correlate their raw timestamps with the input timeline before interpreting stalls.',
      'The measurement rAF runs only during this explicit sample; it never updates or renders the product. Diagnostic collection overhead is included in the observed browser workload.',
      'CPU render timing and input-to-render-end latency measure submission, not presentation or GPU completion.',
      'Latency uses the latest received scroll event or accepted control input before a render; coalesced older inputs are not independent latency samples.',
      'Wheel/scroll/key counts reflect received events. Interaction counts require explicit calls from accepted application handlers. Counts prove input coverage, not a visible result.',
      'isTrusted does not establish human input: browser UI automation can produce trusted events. Inputs without an event are separately labelled app.',
      ...(gaps.length < 120 ? ['Small sample: fewer than 120 rAF intervals; sustained smoothness is not established.'] : []),
      ...(hidden ? ['Visibility changed or the page was hidden; this is not a foreground-only benchmark.'] : []),
      ...(events.scroll < 10 ? ['Fewer than 10 scroll events; this sample does not establish sustained live scrolling.'] : []),
      ...(intervalDraws < 10 ? ['Fewer than 10 product renders; rAF cadence alone is not evidence of product-motion smoothness.'] : []),
      ...(interactionTotal === 0 ? ['No accepted product-control inputs recorded; drag, finish and zoom behavior are unmeasured in this sample.'] : []),
      ...(droppedRenderSamples || droppedInputEntries || droppedNavigationEntries || longTaskCount > MAX_LONG_TASKS ? ['Bounded trace storage omitted later raw entries; dropped-entry counts are disclosed.'] : []),
      'Emulated viewport measurements are not physical-phone measurements.'
    ],
    rawFrameGapsMs: gaps.map(round), rawRenderSubmissionGapsMs: renderGaps.map(round), rawRenderEndOffsetsMs: renderEnds.map(round), rawCpuRenderMs: cpu.map(round), rawScrollLatencyMs: latencies.map(round), rawInteractionLatencyMs: interactionLatencies.map(round)
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
  for (const button of [startButton, stopButton]) Object.assign(button.style, {font:'12px system-ui', minHeight:'44px', background:'#ddff00', color:'#111', border:'0', padding:'8px 12px', cursor:'pointer'});
  output = document.createElement('pre'); output.id = 'profile-json';
  Object.assign(output.style, {maxHeight:'45vh', overflow:'auto', whiteSpace:'pre-wrap', margin:'10px 0 0', font:'10px/1.4 monospace'});
  output.textContent = 'Ready. Start, scroll down and back up, exercise product controls, then Stop. Maximum 90 seconds. Keep this tab visible.';
  controls.append(startButton, stopButton); panel.append(controls, output); document.body.append(panel);
  window.addEventListener('scroll', event => {
    if (!active) return;
    events.scroll = increment(events.scroll); lastScroll = performance.now();
    if (event.isTrusted) events.trustedScroll = increment(events.trustedScroll);
    const direction = Math.sign(scrollY - previousScrollY);
    if (direction && previousDirection && direction !== previousDirection) scrollDirectionChanges = increment(scrollDirectionChanges);
    if (direction) previousDirection = direction;
    previousScrollY = scrollY; navigationTrace('scroll', event);
  }, {passive:true});
  window.addEventListener('wheel', event => {
    if (!active || (event.target instanceof Element && event.target.closest('#live-profiler'))) return;
    events.wheel = increment(events.wheel); if (event.isTrusted) events.trustedWheel = increment(events.trustedWheel);
    navigationTrace('wheel', event, `deltaMode=${event.deltaMode}`, event.deltaY);
  }, {passive:true});
  window.addEventListener('keydown', event => {
    if (!active || event.defaultPrevented || (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true],button,a'))) return;
    if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) { events.scrollKeys = increment(events.scrollKeys); if (event.isTrusted) events.trustedScrollKeys = increment(events.trustedScrollKeys); navigationTrace('scroll-key', event, event.key); }
  });
  document.addEventListener('visibilitychange', () => { if (active && visibility.length < 256) visibility.push({atMs:round(performance.now() - started), hidden:document.hidden}); });
  try { if (PerformanceObserver.supportedEntryTypes.includes('longtask')) { longObserver = new PerformanceObserver(list => collectLongTasks(list.getEntries())); longObserver.observe({type:'longtask'}); longTasksSupported = true; } } catch { longObserver?.disconnect(); longObserver = undefined; }
  startButton.addEventListener('click', () => {
    if (active) return;
    longObserver?.takeRecords();
    gaps=[];cpu=[];latencies=[];interactionLatencies=[];renderGaps=[];renderEnds=[];longTasks=[];
    intervalDraws=0;previous=0;lastScroll=0;consumedScroll=0;lastInteraction=0;consumedInteraction=0;previousRenderEnd=0;
    interactionCounts=newInteractionCounts();interactionEntries=[];navigationEntries=[];droppedNavigationEntries=0;previousScrollY=scrollY;previousDirection=0;scrollDirectionChanges=0;droppedRenderSamples=0;droppedInputEntries=0;longTaskCount=0;longTaskTotalMs=0;
    events={scroll:0,trustedScroll:0,wheel:0,trustedWheel:0,scrollKeys:0,trustedScrollKeys:0};
    started=performance.now();visibility=[{atMs:0,hidden:document.hidden}];startStats=readStats();active=true;
    startButton!.disabled=true;stopButton!.disabled=false;
    output!.textContent='Sampling live browser. Scroll, reverse, and exercise product controls. This profiler does not simulate input or drive rendering.';
    raf=requestAnimationFrame(sample); stopTimer=window.setTimeout(() => stop('90-second-limit'),90000);
  });
  stopButton.addEventListener('click', () => stop());
}
