# After Hours — engineering notes

This document describes the current local PACE campaign. Historical results in `docs/refinement/` belong to the preceding design; they are preserved, not relabeled as measurements of After Hours. Current browser measurements, interaction checks and limitations are recorded in [VERIFY.md](VERIFY.md).

## The interview explanation

PACE is a product-led frontend study built with TypeScript, Vite and Three.js. Native scrolling supplies the story position; one page controller schedules the work. The same original shoe moves through authored camera poses, then hands camera ownership to an explicit Explore mode. Finish changes update materials and lighting without replacing geometry. Complete still-image compositions cover reduced motion and unavailable WebGL.

There is no React render cycle, scroll replacement, physics spring or renderer-owned animation loop. GSAP remains in the historical baseline. Mediabunny belongs to the optional studio export tool, not the campaign runtime.

## Five moments and their responsibilities

| Moment | Behavior | Engineering decision |
| --- | --- | --- |
| Opening | Immediate headline and poster, then a two-second camera/light reveal with Skip and Replay | Lazy-load the scene, wait for fonts before framing, and compile the first render before starting the timed reveal. Native scrolling ends the reveal. Session storage remembers completion when available; storage failure is caught. |
| Product story | Four chapters: silhouette, knit, heel and sole | Derive normalized progress from the current section bounds and native scroll position. Interpolate authored poses directly in either direction. Chapter buttons jump to the same timeline; copy and active chapter update from that position. |
| Explore | Drag, keyboard rotation/zoom, camera presets and projected material hotspots | Explicit camera ownership prevents the scroll controller from overwriting manual inspection. Capture the displayed pose at handoff. Returning to the story targets its current scroll position, including scrolling during the transition. |
| Finish selection | Volt, Ice and Infrared change the shoe, lights, accent and selected-label state | Update controls immediately. Retarget a short transition from the current material/light snapshot, preserving the camera and geometry. Reduced motion commits endpoints immediately. |
| Closing | The same shoe enters a final campaign composition; Explore again and finish selection remain available | Reuse the scene and interpolate its visible frame into the final section instead of creating a second canvas or unrelated product render. |

## One rendering owner

`src/main.ts` owns the selected finish, motion preference, opening state, story/Explore mode, manual orbit and one pending `requestAnimationFrame` ID. Events request a frame; an existing request is reused. A frame reads the latest layout and input, updates the scene, renders if visible, and requests another only while a transition is active.

`src/scene.ts` owns geometry, lighting, camera interpolation and rendering resources. It exposes setters and `renderNow()` but does not start its own loop. A fixed transparent canvas uses viewport/scissor rectangles measured from the section hosts. This keeps one context while the product moves between compositions. The synchronous Explore handoff cancels an existing page frame before flushing the current pose.

Ordinary page scrolling stays native. Touch inspection accepts horizontal intent and leaves vertical panning available; there is no page-wide wheel interception. When the Explore product frame leaves the viewport, full-motion story ownership resumes. Camera presets capture the orbit-adjusted pose before neutralizing manual offsets, so their transition begins at the displayed angle.

## Interruption and state

A new finish samples the current linear-RGB material and light values before selecting its target. Repeated input therefore retargets the existing transition instead of queuing delayed animations or resetting to a previous finish. UI labels, radio state and the `finish` query parameter change immediately. The selected finish can be restored from a valid URL; it is not a shopping cart or account preference.

Story movement has no catch-up tween. The brief Explore exit blends toward a live story target, not a stale scroll value. Switching to reduced motion settles pending camera/material transitions and the page accent. Hidden documents cancel scheduled page frames; visibility restoration redraws the current state. Finite transitions may advance to their elapsed endpoint after suspension rather than replaying hidden motion.

## Original asset and poster pipeline

`src/shoe.js` creates one tapered procedural running-shoe form: fitted knit collar, integrated instep, asymmetric textile/support panels, sculpted foam rocker and restrained rubber pods. Fine woven detail comes from deterministic texture, normal and roughness maps; it is not thousands of modeled stitches. Geometry is grouped by material. Finish selection reuses geometry and textures.

- **Volt:** graphite knit, acid textile/support accents and pale foam.
- **Ice:** cobalt and icy-blue textile, pearl heel, black structure and a small pink accent.
- **Infrared:** dark graphite with coral textile/accent details and warm pale foam.

Neutral source textures accept each palette without a baked blue cast. Material snapshots are detached values; blending does not mutate a stored endpoint. The stage also blends its light palette so the material and campaign field remain coherent.

The local `/studio.html` uses this same asset, lights and camera presets. Export five poses (`hero`, `side`, `knit`, `heel`, `sole`) for each finish as transparent 1200 × 900 PNGs into `docs/after-hours/render-source/`. `python tools/optimize-posters.py` validates all 15 inputs before writing `public/renders/{finish}-{pose}.webp`, then verifies that alpha survives encoding. This optional tool requires Pillow. Poster images are asset evidence; they are not live performance measurements.

## Quality, fallback and access

The scene caps pixel ratio at 1 on viewports up to 700 CSS pixels and 1.5 above that. This is a fixed resolution policy, not an adaptive FPS system. Materials share small maps; textile maps are 512 × 512, foam grain is 128 × 128, and the wordmark is 512 × 128. Grounding uses an authored 256 × 128 contact gradient rather than a shadow-map pass. There is no postprocessing pipeline.

At rest the product does not continuously render. Rendering is skipped when its frame is offscreen or the document is hidden. The fixed finish dock may still animate its short color change when the product is offscreen because that UI remains visible.

HTML starts in the reduced/static composition. Reduced motion presents every chapter in normal document flow with finish-specific images, removes the pinned story height and suppresses decorative CSS motion. Users can explicitly enter Explore with immediate preset/finish changes. Forced static mode or WebGL failure retains the image story and disables unavailable 3D entry. The page does not require JavaScript to display its initial product story.

Controls use real buttons, labeled groups and a keyboard-operated finish radiogroup. The viewer supports arrow keys, `+`/`−`, Home/0 and Escape. Inactive story copy is inert. Skip navigation, visible focus, status announcements and focus transfer accompany explicit transitions. Reduced-mode story navigation targets visible articles. These mechanisms are source facts; screen-reader and physical-touch compatibility still require live testing.

## Verification boundary

Useful checks are `npm run check`, `npm run build`, `npm run build:review` and `node tools/check-geometry.mjs`. The geometry check covers finite attributes, stable geometry/texture references across finishes, distinct neutral-tinted palettes, detached snapshots and continuous interrupted color transitions. Its canvas mock does not validate shaders, lighting or realism.

The opt-in `?profile=1` tool records three different things: browser rAF scheduling, actual product-render submission intervals and CPU time around `renderer.render()`. It also records navigation timestamps/reversals, accepted drag/zoom/finish/preset events, visibility changes and supported long tasks. Samples and traces are bounded. An extra measurement rAF exists only during an explicit profiler sample and never drives the product.

CPU submission is not GPU completion or presented-pixel latency. On-demand idle gaps are not dropped frames. Trusted DOM events may come from UI automation. A phone-sized viewport is not a physical phone. The studio's live canvas capture does not record page scrolling; its offline video uses synthetic timestamps and proves neither live smoothness nor website FPS.

## Current measured evidence

The [verification report](VERIFY.md) records the complete checks and links the current raw samples. The warm production desktop sample used the in-app browser at 1440 × 900, DPR 1: 45,147.4 ms with 1,016 actual render submissions. CPU render duration was 0.1 ms median, 0.2 ms p95 and 0.5 ms maximum. Accepted-input-to-CPU-submission p95 was 3.9 ms; scroll-to-CPU-submission p95 was 0.7 ms. No long tasks were observed during that warm sample.

The 390 × 844 phone-viewport sample lasted 41,321.6 ms and recorded 633 render submissions, 0.2 ms p95 render CPU duration, 3.1 ms p95 accepted-input-to-CPU-submission latency and no observed long tasks. These are viewport tests in the in-app browser; a physical phone and standalone Chrome were unavailable. Neither sample measures displayed FPS, GPU completion or input-to-pixel latency.

The cold development sample did record a 122 ms setup long task. Warm render timing does not erase startup cost, and a development sample should not be treated as a production benchmark.

The [short live WebGL recording](live-canvas.webm) captures the actual campaign's WebGL canvas. Its 12-second wall-clock capture window yielded 2.01 seconds of encoded playback in this browser (reported metadata duration: 2.008041 seconds; 1425 × 900 pixels). The cause of that duration difference was not established. The clip excludes HTML, page background and controls; it is not a full-page recording or proof of sustained display frame rate or presentation timing. The review gallery provides playback and labels this boundary.

The earlier [raw sample](../refinement/after-iab.json) and [methodology](../refinement/ENGINEERING.md) remain historical evidence only. Do not carry their measurements or interaction results forward to this revision.