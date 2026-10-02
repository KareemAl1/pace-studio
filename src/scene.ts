import * as THREE from 'three';
import {createPaceShoe} from './shoe.js';
import {recordRender, recordSetup} from './profiler';

export type PoseName =
  | 'hero' | 'side' | 'threequarter' | 'top' | 'knit' | 'heel' | 'sole' | 'closing'
  | 'macro' | 'form' | 'texture' | 'contact';
export type ExploreView = 'side' | 'top' | 'sole' | 'threequarter' | 'knit' | 'heel';
export type ColorwayName = 'volt' | 'ice' | 'infrared';
type Triple = [number, number, number];
type Pose = {eye: Triple; target: Triple; rotation: Triple; zoom: number};
type Frame = {x: number; y: number; width: number; height: number};
type PaletteSnapshot = Record<string, number[]>;
type PaletteShoe = ReturnType<typeof createPaceShoe> & {
  getPaletteSnapshot?: () => PaletteSnapshot;
  getColorway?: (name: string) => PaletteSnapshot;
  blendColorway?: (from: PaletteSnapshot, name: string, progress: number) => void;
};
type PoseTransition = {from: Pose; to: Pose; started: number; duration: number};
type StoryReturn = {from: Pose; started: number; duration: number};
type LightChannel = 'sky' | 'ground' | 'key' | 'primaryRim' | 'secondaryRim' | 'fill';
type LightPalette = Record<LightChannel, Triple>;
type ColorTransition = {
  from: PaletteSnapshot; to: PaletteSnapshot; lightFrom: LightPalette; lightTo: LightPalette;
  name: string; started: number; duration: number;
};

const clamp = THREE.MathUtils.clamp;
const smooth = (value: number) => {const t = clamp(value, 0, 1); return t * t * (3 - 2 * t);};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clone = (pose: Pose): Pose => ({
  eye: [...pose.eye], target: [...pose.target], rotation: [...pose.rotation], zoom: pose.zoom
});
function mix(a: Pose, b: Pose, t: number): Pose {
  return {
    eye: a.eye.map((value, i) => lerp(value, b.eye[i], t)) as Triple,
    target: a.target.map((value, i) => lerp(value, b.target[i], t)) as Triple,
    rotation: a.rotation.map((value, i) => lerp(value, b.rotation[i], t)) as Triple,
    zoom: lerp(a.zoom, b.zoom, t)
  };
}

// All poses view the same unchanged geometry. Story progress is deterministic
// in both scroll directions; no camera spring chases an earlier scroll value.
const poses: Record<string, Pose> = {
  hero: {eye: [3.1, 2.0, 8], target: [0, .65, 0], rotation: [.025, -.16, -.065], zoom: 1.18},
  side: {eye: [.2, 1.3, 8], target: [0, .62, 0], rotation: [0, 0, 0], zoom: 1.17},
  threequarter: {eye: [-3.8, 2.9, 7.4], target: [-.1, .7, 0], rotation: [0, .08, 0], zoom: 1.12},
  top: {eye: [.2, 8, .3], target: [0, .55, 0], rotation: [0, 0, 0], zoom: 1.12},
  knit: {eye: [1.1, 2.5, 6], target: [-.35, .58, .15], rotation: [0, -.08, .035], zoom: 2.35},
  heel: {eye: [-4.4, 2.2, 6], target: [-1.45, .69, .08], rotation: [0, .1, .025], zoom: 2.22},
  sole: {eye: [1.2, -4.4, 7], target: [-.05, .22, 0], rotation: [.03, -.2, -.06], zoom: 1.17},
  closing: {eye: [-2.6, 1.95, 8], target: [0, .61, 0], rotation: [.025, .1, .13], zoom: 1.19}
};
const aliases: Record<string, string> = {macro: 'knit', form: 'side', texture: 'knit', contact: 'sole'};
const storyStops: {at: number; pose: Pose}[] = [
  {at: 0, pose: poses.hero}, {at: .16, pose: poses.side}, {at: .36, pose: poses.knit},
  {at: .56, pose: poses.heel}, {at: .76, pose: poses.sole}, {at: 1, pose: poses.closing}
];
const anchors: Record<string, Triple> = {
  knit: [.65, .57, .42], heel: [-1.72, .59, .38], sole: [.15, -.04, .54]
};
function storyPoseAt(progress: number): Pose {
  const p = clamp(progress, 0, 1);
  for (let i = 1; i < storyStops.length; i++) {
    const previous = storyStops[i - 1], next = storyStops[i];
    if (p <= next.at) return mix(previous.pose, next.pose, smooth((p - previous.at) / (next.at - previous.at)));
  }
  return clone(poses.closing);
}

export function createShoeStage(host: HTMLElement, onFailure: () => void, options: {overlay?: boolean} = {}) {
  const setupStarted = performance.now();
  const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, powerPreference: 'default'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .94;
  renderer.setClearColor(0, 0);
  renderer.autoClear = false;
  renderer.domElement.className = 'shoe-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const hemisphere = new THREE.HemisphereLight(0xa5bcff, 0x080912, 1.15);
  const key = new THREE.DirectionalLight(0xfffaf0, 5.1);
  key.position.set(-2.5, 5, 5);
  const cobaltRim = new THREE.DirectionalLight(0x3568ff, 3.2);
  cobaltRim.position.set(-3.5, 2.3, -4);
  const acidRim = new THREE.DirectionalLight(0xdeff63, 1.15);
  acidRim.position.set(3.6, 2.6, -2);
  const coralFill = new THREE.DirectionalLight(0xff675a, .38);
  coralFill.position.set(4, .65, 4.5);
  scene.add(hemisphere, key, cobaltRim, acidRim, coralFill);
  const lightChannels: Record<LightChannel, THREE.Color> = {
    sky: hemisphere.color, ground: hemisphere.groundColor, key: key.color,
    primaryRim: cobaltRim.color, secondaryRim: acidRim.color, fill: coralFill.color
  };
  const lightPalette = (values: Record<LightChannel, number>): LightPalette =>
    Object.fromEntries(Object.entries(values).map(([name, hex]) => [name, new THREE.Color(hex).toArray()])) as LightPalette;
  const lightPalettes: Record<ColorwayName, LightPalette> = {
    volt: lightPalette({sky: 0xb6c7dd, ground: 0x050709, key: 0xfff9ec, primaryRim: 0xe1ff8e, secondaryRim: 0x5472c8, fill: 0x7eaa81}),
    ice: lightPalette({sky: 0xc8e4ff, ground: 0x050917, key: 0xf8fcff, primaryRim: 0x739eff, secondaryRim: 0xa6dfff, fill: 0xc9e1ff}),
    infrared: lightPalette({sky: 0xcfbfd2, ground: 0x140609, key: 0xfff1e8, primaryRim: 0xff6d63, secondaryRim: 0xffa8a0, fill: 0xc4565e})
  };
  function captureLights(): LightPalette {
    return Object.fromEntries(Object.entries(lightChannels).map(([name, color]) => [name, color.toArray()])) as LightPalette;
  }
  function applyLights(from: LightPalette, to: LightPalette = from, progress = 1) {
    for (const name of Object.keys(lightChannels) as LightChannel[]) {
      const a = from[name], b = to[name];
      lightChannels[name].setRGB(lerp(a[0], b[0], progress), lerp(a[1], b[1], progress), lerp(a[2], b[2], progress));
    }
  }
  const canonicalColorway = (name: string): ColorwayName =>
    name === 'ice' || name === 'chalk' || name === 'cobalt' ? 'ice'
      : name === 'infrared' ? 'infrared' : 'volt';
  applyLights(lightPalettes.volt);

  const shoe = createPaceShoe() as PaletteShoe;
  shoe.setColorway('volt');
  scene.add(shoe.group);

  // A small authored contact gradient provides grounding with no shadow-map pass.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256; shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d')!;
  ctx.translate(128, 64); ctx.scale(1, .42);
  const gradient = ctx.createRadialGradient(0, 0, 6, 0, 0, 124);
  gradient.addColorStop(0, 'rgba(0,0,0,.72)');
  gradient.addColorStop(.52, 'rgba(0,0,0,.25)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(-128, -152, 256, 304);
  const shadowMap = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({map: shadowMap, transparent: true, depthWrite: false, opacity: .7});
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.55), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = new THREE.Box3().setFromObject(shoe.group).min.y - .008;
  scene.add(shadow);

  const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .05, 80);
  const cameraTarget = new THREE.Vector3();
  const projectedPoint = new THREE.Vector3();
  let frame: Frame = {x: 0, y: 0, width: 1, height: 1};
  let viewWidth = 1, viewHeight = 1, surfaceVisible = true, disposed = false;
  let storyProgress = 0, storyTarget = clone(poses.hero), currentPose = clone(poses.hero);
  let introProgress = 1;
  let exploring = false, exploreBase = clone(poses.hero);
  let viewTransition: PoseTransition | undefined, storyReturn: StoryReturn | undefined;
  let colorTransition: ColorTransition | undefined, currentColorway = 'volt';
  let yaw = 0, pitch = 0, userZoom = 1;
  let draws = 0, totalCpu = 0, maxCpu = 0, firstCpu = 0;

  const onLost = (event: Event) => {event.preventDefault(); if (!disposed) onFailure();};
  renderer.domElement.addEventListener('webglcontextlost', onLost);

  function resize() {
    if (disposed) return;
    const rect = host.getBoundingClientRect();
    viewWidth = options.overlay ? document.documentElement.clientWidth : rect.width;
    viewHeight = options.overlay ? innerHeight : rect.height;
    const pixelRatio = Math.min(devicePixelRatio, innerWidth <= 700 ? 1 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(Math.max(1, viewWidth), Math.max(1, viewHeight), false);
    if (!options.overlay) setFrame({x: 0, y: 0, width: viewWidth, height: viewHeight});
  }
  function setFrame(next: Frame) {
    frame = {x: next.x, y: next.y, width: next.width, height: next.height};
    surfaceVisible = frame.x < viewWidth && frame.x + frame.width > 0
      && frame.y < viewHeight && frame.y + frame.height > 0 && frame.width > 0 && frame.height > 0;
  }
  function setStory(progress: number) {
    storyProgress = clamp(progress, 0, 1);
    storyTarget = storyPoseAt(storyProgress);
  }
  function setIntro(progress: number) {introProgress = clamp(progress, 0, 1);}
  function orbitApplied(base: Pose): Pose {
    const result = clone(base);
    result.rotation[0] += pitch; result.rotation[1] += yaw; result.zoom *= userZoom;
    return result;
  }
  function orbitRemoved(displayed: Pose): Pose {
    const result = clone(displayed);
    result.rotation[0] -= pitch; result.rotation[1] -= yaw; result.zoom /= userZoom;
    return result;
  }
  function currentStoryPose(): Pose {
    if (introProgress >= 1) return storyTarget;
    const entrance = clone(storyTarget);
    entrance.eye = [3.8, 1.5, 8.8];
    entrance.rotation[1] -= .65; entrance.rotation[2] -= .12; entrance.zoom *= .95;
    return mix(entrance, storyTarget, smooth(introProgress));
  }
  function resolveCamera(now: number): boolean {
    let transitioning = false;
    if (exploring) {
      if (viewTransition) {
        const t = clamp((now - viewTransition.started) / viewTransition.duration, 0, 1);
        exploreBase = mix(viewTransition.from, viewTransition.to, smooth(t));
        if (t === 1) viewTransition = undefined; else transitioning = true;
      }
      currentPose = orbitApplied(exploreBase);
    } else if (storyReturn) {
      const t = clamp((now - storyReturn.started) / storyReturn.duration, 0, 1);
      // The target remains live: scrolling during exit never follows stale progress.
      currentPose = mix(storyReturn.from, currentStoryPose(), smooth(t));
      if (t === 1) storyReturn = undefined; else transitioning = true;
    } else {
      currentPose = clone(currentStoryPose());
    }
    return transitioning;
  }
  function setExplore(enabled: boolean, now = performance.now(), duration = 450) {
    if (enabled === exploring) return;
    resolveCamera(now);
    if (enabled) {
      // Retain exactly the displayed camera; retained user orbit values are
      // compensated in the base pose, rather than reset on mode entry.
      exploreBase = orbitRemoved(currentPose);
      exploring = true; storyReturn = undefined; viewTransition = undefined;
    } else {
      storyReturn = {from: clone(currentPose), started: now, duration: Math.max(1, duration)};
      exploring = false; viewTransition = undefined;
    }
    if (duration <= 0 && !enabled) {storyReturn = undefined; currentPose = clone(currentStoryPose());}
  }
  function setExploreView(name: ExploreView, now = performance.now(), duration = 500) {
    const target = poses[name];
    if (!target) return;
    if (!exploring) setExplore(true, now, duration);
    resolveCamera(now);
    // Capture the displayed, orbit-adjusted pose BEFORE neutralizing manual input.
    // Presets then blend from that exact view to their authored neutral framing.
    const from = clone(currentPose);
    yaw = 0; pitch = 0; userZoom = 1;
    exploreBase = clone(from);
    viewTransition = {from, to: clone(target), started: now, duration: Math.max(1, duration)};
    if (duration <= 0) {exploreBase = clone(target); viewTransition = undefined; currentPose = clone(target);}
  }
  function setOrbit(nextYaw: number, nextPitch: number, zoom: number) {
    yaw = clamp(nextYaw, -Math.PI * .85, Math.PI * .85);
    pitch = clamp(nextPitch, -.55, .65);
    userZoom = clamp(zoom, .8, 1.55);
  }

  function capturePalette(): PaletteSnapshot {
    if (shoe.getPaletteSnapshot) return shoe.getPaletteSnapshot();
    const snapshot: PaletteSnapshot = {};
    for (const [name, material] of Object.entries(shoe.materials)) snapshot[name] = material.color.toArray();
    return snapshot;
  }
  function applyPalette(snapshot: PaletteSnapshot) {
    for (const [name, rgb] of Object.entries(snapshot)) {
      const material = (shoe.materials as Record<string, THREE.MeshStandardMaterial>)[name];
      if (material) material.color.setRGB(rgb[0], rgb[1], rgb[2]);
    }
  }
  function transitionColorway(name: ColorwayName | string, now = performance.now(), duration = 450) {
    updateMaterials(now);
    const from = capturePalette();
    const lightFrom = captureLights(), lightTo = lightPalettes[canonicalColorway(name)];
    // New assets expose detached target snapshots. The fallback is for an older
    // local studio asset during development and still reuses existing materials.
    let to: PaletteSnapshot;
    if (shoe.getColorway) to = shoe.getColorway(name);
    else {shoe.setColorway(name); to = capturePalette(); applyPalette(from);}
    currentColorway = canonicalColorway(name);
    colorTransition = {from, to, lightFrom, lightTo, name, started: now, duration: Math.max(1, duration)};
    if (duration <= 0) {shoe.setColorway(name); applyLights(lightTo); colorTransition = undefined;}
  }
  function updateMaterials(now = performance.now()): boolean {
    if (!colorTransition) return false;
    const transition = colorTransition;
    const t = clamp((now - transition.started) / transition.duration, 0, 1);
    if (shoe.blendColorway) shoe.blendColorway(transition.from, transition.name, smooth(t));
    else {
      const amount = smooth(t);
      for (const [name, rgb] of Object.entries(transition.to)) {
        const material = (shoe.materials as Record<string, THREE.MeshStandardMaterial>)[name];
        const from = transition.from[name];
        if (material && from) material.color.setRGB(lerp(from[0], rgb[0], amount), lerp(from[1], rgb[1], amount), lerp(from[2], rgb[2], amount));
      }
    }
    // Lights capture the currently displayed linear RGB values on interruption,
    // so a rapid finish reversal never jumps to a previous finish's lighting.
    applyLights(transition.lightFrom, transition.lightTo, smooth(t));
    if (t === 1) {shoe.setColorway(transition.name); colorTransition = undefined;}
    return t < 1;
  }
  function update(now = performance.now()): boolean {
    const cameraMoving = resolveCamera(now);
    const colorMoving = updateMaterials(now);
    // Two-second opening choreography is driven by setIntro() from the owner.
    // Only light position/intensity changes: no real shadow or postprocessing pass.
    const sweep = smooth(introProgress);
    key.position.set(lerp(-7, -2.5, sweep), lerp(.8, 5, sweep), lerp(-1.5, 5, sweep));
    key.intensity = lerp(1.5, 5.1, sweep);
    cobaltRim.intensity = lerp(4.4, 3.2, sweep);
    acidRim.intensity = lerp(.45, 1.15, sweep);
    // Existing fill moves below the product for the outsole chapter; keeping
    // every light above the shoe would hide the tread against the dark scene.
    const underside = smooth(clamp((currentPose.target[1] - currentPose.eye[1]) / 3, 0, 1));
    coralFill.position.set(4, lerp(.65, -4, underside), 4.5);
    coralFill.intensity = lerp(.38, 1.65, underside);
    shadowMaterial.opacity = currentPose.eye[1] < currentPose.target[1] ? 0 : .7;
    return cameraMoving || colorMoving || introProgress < 1;
  }

  function settleTransitions() {
    // Reduced motion can commit the requested endpoints without a second loop,
    // an intermediate render, or a deferred completion callback.
    introProgress = 1;
    if (colorTransition) {
      shoe.setColorway(colorTransition.name);
      applyLights(colorTransition.lightTo);
      currentColorway = canonicalColorway(colorTransition.name);
      colorTransition = undefined;
    }
    if (viewTransition) {
      exploreBase = clone(viewTransition.to);
      viewTransition = undefined;
    }
    storyReturn = undefined;
    update(performance.now());
  }

  function draw(now = performance.now()) {
    if (disposed || document.hidden || !surfaceVisible) return false;
    update(now);
    const aspect = frame.width / frame.height;
    const halfHeight = Math.max(1.85, 2.85 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.position.set(...currentPose.eye); cameraTarget.set(...currentPose.target);
    camera.lookAt(cameraTarget); camera.zoom = currentPose.zoom; camera.updateProjectionMatrix();
    shoe.group.rotation.set(...currentPose.rotation);
    renderer.setScissorTest(false); renderer.clear();
    renderer.setViewport(frame.x, viewHeight - frame.y - frame.height, frame.width, frame.height);
    const left = Math.max(0, frame.x), bottom = Math.max(0, viewHeight - frame.y - frame.height);
    renderer.setScissor(left, bottom,
      Math.max(0, Math.min(viewWidth, frame.x + frame.width) - left),
      Math.max(0, Math.min(viewHeight, viewHeight - frame.y) - bottom));
    renderer.setScissorTest(true);
    const renderStarted = performance.now();
    try {renderer.render(scene, camera);} catch {onFailure(); return false;}
    const cpu = performance.now() - renderStarted;
    draws++; if (draws === 1) firstCpu = cpu;
    totalCpu += cpu; maxCpu = Math.max(maxCpu, cpu); recordRender(cpu);
    host.classList.add('is-rendered');
    return true;
  }

  function projectPoint(id: 'knit' | 'heel' | 'sole') {
    const point = anchors[id];
    if (!point) return {x: 0, y: 0, visible: false};
    shoe.group.updateWorldMatrix(true, false);
    projectedPoint.set(...point).applyMatrix4(shoe.group.matrixWorld).project(camera);
    return {
      x: frame.x + (projectedPoint.x + 1) * frame.width / 2,
      y: frame.y + (1 - projectedPoint.y) * frame.height / 2,
      visible: surfaceVisible && projectedPoint.z >= -1 && projectedPoint.z <= 1
        && Math.abs(projectedPoint.x) <= 1 && Math.abs(projectedPoint.y) <= 1,
      depth: projectedPoint.z
    };
  }
  function setPose(name: PoseName) {
    const pose = poses[aliases[name] || name];
    if (!pose) return;
    exploring = false; viewTransition = undefined; storyReturn = undefined; introProgress = 1;
    storyTarget = clone(pose); currentPose = clone(pose);
  }
  function setEntry(progress: number) {
    storyProgress = clamp(progress, 0, 1) * .16;
    storyTarget = mix(poses.hero, poses.side, smooth(progress));
  }
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const textureInfo: Record<string, {width: number; height: number}> = {};
  scene.traverse((object: THREE.Object3D) => {
    const material = (object as THREE.Mesh).material;
    if (!material) return;
    for (const item of Array.isArray(material) ? material : [material])
      for (const value of Object.values(item))
        if (value instanceof THREE.Texture && value.image) textureInfo[value.uuid] = {width: value.image.width, height: value.image.height};
  });
  function stats() {
    return {
      draws, triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls,
      dpr: renderer.getPixelRatio(), physicalCanvas: [renderer.domElement.width, renderer.domElement.height],
      textures: Object.values(textureInfo), shadowMapEnabled: renderer.shadowMap.enabled,
      renderLoops: 1, rendererOwnedLoops: 0, reactUpdates: 'not applicable: plain TypeScript',
      firstRenderCpuMs: +firstCpu.toFixed(2), meanCpuRenderMs: +(totalCpu / Math.max(draws, 1)).toFixed(2),
      maxCpuRenderMs: +maxCpu.toFixed(2),
      gpuRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      visible: surfaceVisible, documentHidden: document.hidden,
      storyProgress: +storyProgress.toFixed(3), exploring, colorway: currentColorway,
      introProgress: +introProgress.toFixed(4),
      camera: {position: camera.position.toArray(), target: [...currentPose.target], zoom: camera.zoom},
      modelRotation: [shoe.group.rotation.x, shoe.group.rotation.y, shoe.group.rotation.z],
      orbit: {yaw, pitch, zoom: userZoom},
      lightCount: 5,
      lightColors: Object.fromEntries(Object.entries(lightChannels).map(([name, color]) => [name, '#' + color.getHexString()])),
      lightIntensities: {hemisphere: hemisphere.intensity, key: key.intensity, primaryRim: cobaltRim.intensity, secondaryRim: acidRim.intensity, fill: coralFill.intensity},
      keyLightPosition: key.position.toArray(),
      activeCameraTransition: Boolean(viewTransition || storyReturn), activeColorTransition: Boolean(colorTransition)
    };
  }

  resize(); recordSetup(performance.now() - setupStarted);
  return {
    renderer, shoe, resize, setFrame, setStory, setIntro, setExplore, setExploreView, setOrbit,
    transitionColorway, updateMaterials, update, settleTransitions, projectPoint, setPose, setEntry,
    setProgress: setStory, opening: setIntro, renderNow: draw, invalidate: draw, stats,
    setColorway: (name: ColorwayName | string) => transitionColorway(name, performance.now(), 0),
    snapshot: (mime = 'image/webp') => {draw(); return renderer.domElement.toDataURL(mime, .94);},
    dispose() {
      disposed = true;
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      shoe.dispose(); shadow.geometry.dispose(); shadowMaterial.dispose(); shadowMap.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      host.classList.remove('is-rendered');
    }
  };
}
