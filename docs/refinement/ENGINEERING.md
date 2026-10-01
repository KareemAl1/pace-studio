# PACE refinement: engineering and measurement notes

This document describes the local hero and single product-detail sequence. Shopping, additional products, payments, backend work and publishing remain outside this milestone. The preserved pre-redesign checkpoint is `checkpoints/2026-10-01-before-shoe-redesign/`; diagnostic copies are separate from that immutable checkpoint.

## What changed in the runtime

The production page uses TypeScript, Vite and Three.js. It does not use React, so React component updates during scroll are not applicable. The saved baseline used GSAP/ScrollTrigger; the current page controller uses native scroll events and one demand-driven render scheduler.

The old controller combined a 350 ms scrub tween with a second animation-frame request inside the renderer. That deliberately delayed the camera behind the latest scroll position. It also moved the canvas between hero and detail hosts and switched between their poses. These are source-confirmed sources of response delay and discontinuity, distinct from the browser scheduling limitation measured below.

The new controller in `src/main.ts` works as follows:

1. Passive native scroll events request a frame. A single pending-frame identifier coalesces repeated events.
2. That frame reads the current scroll position and current hero/detail bounds, rather than accumulating wheel deltas or pursuing an older target.
3. Section progress is a clamped function of scroll position: `(scrollY - sectionTop) / (sectionHeight - viewportHeight)`.
4. The scene receives the current framing, camera pose and user orbit state, then renders synchronously in that same callback. Scene setters do not request another frame.
5. No further frame is requested at rest. The short opening is the exception: it requests frames while its 650 ms progression is active, and native scrolling ends that opening.
6. Hidden documents cancel the pending frame. A product entirely outside the page's visible hero/detail area is not rendered. Visibility restoration, resize, fonts becoming ready or input requests a fresh view.

One fixed transparent canvas spans the viewport. Its WebGL viewport/scissor frames the shoe within the current composition. During entry, both the product rectangle and camera blend from hero to detail; the DOM canvas is not reparented. During the detail sequence, one deterministic pose path travels from side to three-quarter to macro. Reversing scroll evaluates the same path in reverse. This eliminates intentional scrub catch-up; it does not override browser scheduling or native scrolling.

The current product-detail section occupies 220 small viewport heights, with one sticky composition. Persistent product framing, chapter copy and perspective navigation replace the former three separate 100svh copy blocks. Reduced motion removes the scroll spacer and presents all three image/copy articles at their natural height.

## Interaction and accessibility

The visible viewer is focusable and has instructions. Mouse dragging rotates the shoe. Touch routing is implemented to preserve vertical native scrolling and accept horizontal rotation after an intent threshold. The viewer declares `touch-action: pan-y pinch-zoom`. This physical-touch behavior was reviewed in source; it was not tested on a real touch device.

Arrow keys rotate when the viewer itself has focus. Plus/minus zoom; Home or 0 resets. Separate labelled rotate, zoom and reset buttons expose the same actions without dragging. Rotation and zoom values are clamped. Perspective buttons move immediately to their corresponding native document positions and reset manual orientation.

The page provides a skip link, visible focus styles, semantic headings, native anchor links and a motion preference selector. The hidden live status announces button-driven orbit changes. Inactive animated copy is inert; the static sequence contains complete, readable descriptions and image alternatives.

The initial HTML is a complete static composition. System reduced-motion preference, an explicit Reduced choice, a desktop viewport shorter than 600 CSS pixels or a phone viewport (up to 700 CSS pixels wide) shorter than 650 CSS pixels, `?view=static`, an import/renderer failure or WebGL context loss uses the static sequence. The same authored asset supplies its still images. Switching motion off suspends rendering and retains an existing scene for later reuse rather than rebuilding geometry on every toggle.

The implementation descriptions above are distinct from the recorded browser checks below. Hidden-tab resume and physical touch were reviewed in source but were not verified live.

## Asset pipeline and rendering quality

`src/shoe.js` builds one original tapered last, fitted collar, integrated instep, asymmetric panels, foam rocker and shallow rubber pods. The supplied reference informed material relationships and silhouette direction; its photograph, logo and panel artwork are not website assets.

The geometry is shared by every camera view. The studio at `/studio.html` exposes Hero, Side, Three-quarter and Macro. `Prepare transparent poster` renders the current asset to a transparent PNG at pixel ratio 1. The PNG sources are saved in `docs/refinement/render-source/`; `tools/optimize-posters.py` uses Pillow to encode WebP outputs in `public/renders/`. Chromium direct-WebP alpha exhibited edge artifacts, so the PNG intermediate is intentional. All four delivered posters were regenerated from the frozen final asset after the insole correction. Future geometry, material, light or camera edits require regenerating them again so fallback images remain consistent with the live scene.

Fabric detail comes from deterministic directional colour and normal maps, not thousands of modelled stitches. The current source makes three 512×512 textile maps, a 128×128 foam texture and a 512×128 PACE label map. Meshes are combined by seven material groups. The captured refined renderer sample reports 12,838 drawn triangles and eight draw calls, including the scene contact-shadow plane. Actual counts can depend on view and transparent passes; material-group count alone is not a draw-call measurement.

`src/scene.ts` uses an orthographic camera, hemisphere and directional lighting, ACES filmic tone mapping and a transparent contact-shadow plane. The contact shadow is an authored 256×128 gradient, not a physically accurate moving shadow simulation. Shadow-map rendering is disabled. The previous runtime-generated RoomEnvironment/PMREM setup was removed.

Pixel ratio is recalculated on resize: at most 1 on viewports up to 700 CSS pixels wide, and at most 1.5 above that. Antialiasing remains enabled. Lower physical render resolution on phones is an intentional quality/performance tradeoff; emulated phone viewports cannot establish actual phone GPU performance.

The fixed full-viewport canvas prevents host swapping, but can contain more physical pixels than the old product-sized canvas. The new version still clears that canvas before drawing its scissored product. This is a tradeoff to measure, not an automatic performance win.

## Measuring live behavior

Profiling is opt-in:

- Saved baseline: `/baseline.html?motion=full&profile=1`.
- Current page: `/?motion=full&profile=1`.
- Explicit failure check: `/?motion=full&inspect=1`, then Test 3D fallback.
- Forced complete static page: `/?view=static`.

Start live sample, send native wheel or keyboard input down and back up, then Stop live sample. The profiler does not simulate scrolling. Input may be driven by browser UI automation; `isTrusted` means the browser generated the input event, not that a human personally operated the mouse.

`src/profiler.ts` creates its measurement rAF only during an explicit bounded sample. That callback counts browser scheduling intervals; it does not update or render the shoe. All observed intervals are retained, including gaps longer than 100 ms. Samples stop after 90 seconds or a bounded interval count. The JSON includes raw values, percentiles, input counts, visibility, long tasks, setup timing and renderer metadata.

Timing boundaries matter:

- Setup time covers construction inside `createShoeStage`; it excludes fetching and evaluating the lazy-loaded module.
- Render CPU time brackets `renderer.render(scene, camera)` in both baseline and current scene. It measures JavaScript/driver submission, not GPU completion or screen presentation.
- Scroll-to-render-end time is a submission-latency proxy from the latest observed scroll event.
- rAF gaps measure scheduling in this particular browser environment. Idle demand-render gaps are not converted into FPS.
- Long tasks are collected during the explicit sample. Zero long tasks during a warm scrolling sample does not imply that initialization had no long task.
- No GPU timer-query measurement or React profiling is claimed.

Use the same browser, viewport, DPR, visibility state and input path for before/after comparison. Keep warm scrolling results separate from initialization. Report sample counts and limitations alongside percentiles.

## Saved baseline: actual observations

Source: `docs/refinement/baseline-iab.json`. The raw file predates the clarified input-source label; despite its original label, the input was driven through browser UI automation. Raw measurements remain preserved.

| Observation | Recorded baseline |
| --- | ---: |
| Browser surface | Codex in-app browser |
| Viewport / device pixel ratio | 1280 × 800 / 1 |
| Sample duration | 59,091.8 ms |
| Visibility | `document.hidden=false`; no recorded change |
| Native wheel / scroll events | 20 / 14 |
| Sampled rAF intervals | 58 |
| rAF gap median / p95 / max | 1,000.1 / 1,004.3 / 1,004.4 ms |
| Render submissions during sample | 25 |
| Warm render CPU median / p95 / max | 0.3 / 0.6 / 0.7 ms |
| Constructor setup | 200.5 ms |
| Long tasks during warm sample | 0 |
| Draw calls / drawn triangles | 22 / 56,870 |
| Shadow maps | Disabled |

The browser reported an NVIDIA GeForce RTX 5080 through ANGLE/Direct3D11. Approximately one-second rAF cadence, despite sub-millisecond warm CPU submission and no measured warm long tasks, indicates browser/environment scheduling throttling. It does **not** establish GPU saturation or a one-second GPU render cost. The small cadence sample does not substantiate sustained smoothness.

Foreground Chrome was selected for a follow-up check, but Chrome automation was unavailable in this session. No Chrome test, physical-phone test, 60 fps claim, Lighthouse score or general hardware benchmark is implied.

## Refined runtime and repeated-baseline observations

The final asset's later insole adjustment was cosmetic; it did not change the captured draw/triangle counts. The runtime architecture was unchanged after this sample.

| Observation | Original baseline | Baseline repeat | Refined runtime |
| --- | ---: | ---: | ---: |
| Evidence file | `baseline-iab.json` | `baseline-repeat-iab.json` | `after-iab.json` |
| Duration | 59,091.8 ms | 83,154.5 ms | 51,449.2 ms |
| Native wheel / scroll events | 20 / 14 | 24 / 22 | 20 / 10 |
| rAF intervals sampled | 58 | 89 | 2,922 |
| rAF gap median | 1,000.1 ms | 1,000.1 ms | 4.2 ms |
| rAF gap p95 | 1,004.3 ms | 1,004.2 ms | 8.2 ms |
| rAF gap maximum | 1,004.4 ms | 1,004.3 ms | 1,004.2 ms |
| Render submissions | 25 | 33 | 10 |
| Warm render CPU median | 0.3 ms | 0.3 ms | 0.2 ms |
| Warm render CPU p95 | 0.6 ms | 0.9 ms | 0.7 ms |
| Constructor setup | 200.5 ms | 179.4 ms | 202.1 ms |
| Long tasks during sample | 0 | 0 | 0 |
| Draw calls / drawn triangles | 22 / 56,870 | 22 / 56,870 | 8 / 12,838 |

All three samples used 1280×800 at DPR 1 in the in-app browser and reported no hidden-document transition. The refined run recorded a 0.3 ms median / 0.9 ms p95 scroll-event-to-render-end proxy. That is CPU submission latency, not input-to-presented-pixel latency.

The repeated baseline reproduces predominantly one-second cadence. The refined run contains long one-second gaps as well as dense short intervals. This points to browser/environment scheduling interacting with the source; it does not isolate a GPU bottleneck, demonstrate a controlled speedup, or justify converting the 4.2 ms median into a website FPS claim. The profiler's continuously sampled scheduling intervals are separate from the ten actual demand-driven product renders.

The captured scene workload is lower: eight draw calls and 12,838 drawn triangles. Warm CPU submissions remain below one millisecond in the measured samples. Constructor setup did not improve, and the refined first render recorded 72.7 ms. These limits must accompany any performance summary.

## Completed final browser checks

The final interface was inspected in the in-app browser at desktop 1280 × 800, phone-sized 390 × 844 and short 320 × 620 viewports. The short viewport deliberately used the full static composition. No horizontal overflow was observed.

| Check | Observed result |
| --- | --- |
| Mouse drag | Shoe orientation changed through the live viewer |
| Keyboard rotation, zoom and Home | Controls changed the view and Home reset it |
| Alternating orbit buttons | The final input state was retained |
| Rapid perspectives 2 → 3 → 1 | Settled on perspective 1 |
| Repeated Reduced → Full | Exactly one canvas remained |
| Actual WebGL context loss | All three static product posters loaded |
| Browser Back / Forward | Root and `#details` restored scroll positions 0 / 684; one canvas remained |
| Phone orbit controls | All measured 44 × 44 CSS pixels |
| Final console check | No errors reported |

These checks used browser UI automation and responsive viewport sizes. They do not establish Chrome or physical-device performance. Hidden-tab behavior and physical touch gestures were source-reviewed only, not verified live. Full-page live recording was unavailable.


## Real-time versus rendered delivery

Real-time rendering remains the current approach because it supports consistent camera movement, immediate reverse scrolling and manual inspection from the same asset. The existing baseline data does not show that geometry rendering saturated the GPU, so replacing it solely on that assumption would be unjustified.

A rendered sequence can bake more expensive lighting and materials, but introduces transfer, image decoding and frame-cache costs. For scale, 72 decoded 960×640 RGBA frames occupy about 177 MB before additional browser overhead. A rendered route would require an explicit resolution/frame/cache budget and live input tests. It has not been implemented as a performance claim.

The studio keeps two distinct exports:

- Live model-canvas capture records actual renderer updates and preserves any browser throttling. It is not a full-page live scrolling recording.
- Offline model sequence assigns deterministic timestamps to 240 rendered frames. It demonstrates the camera path and asset consistency only. It is not evidence of smooth website execution.

## Remaining limits

- Preserve all three measurement files and their caveats when presenting the comparison.
- Foreground Chrome automation, physical-phone testing and full-page live recording were unavailable.
- Hidden-tab resume and physical touch gestures were reviewed in source but were not verified live.
- Variable browser scheduling prevents an honest sustained-smoothness claim across devices. Offline exports do not close that verification gap.
- The contact shadow is an authored approximation. The shoe is an original visual concept, not manufacturing CAD or a substantiated performance product.

A useful interview explanation is: native scroll supplies the source of truth; one scheduled frame maps that position to a deterministic camera pose; the renderer performs no independent catch-up loop; still renders preserve the complete experience when motion or WebGL is unavailable. Profiling separates browser scheduling, CPU submission, setup and product quality instead of presenting a polished offline video as a benchmark.
