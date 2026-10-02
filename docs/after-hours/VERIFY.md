# After Hours — local verification

Recorded October 1, 2026. Publishing remains paused. These results describe the After Hours campaign, not the earlier light design.

## Review

- Production preview: http://127.0.0.1:4180/
- Before/after gallery: http://127.0.0.1:4181/docs/after-hours/review.html
- Source: `C:\Users\karee_4m899us\Documents\Projects\pace-studio`
- Recoverable starting point: Git tag `checkpoint-before-after-hours-2026-10-01` at `2b80f3a2d3f4ec44ea27a8514b3869b8b9785754`, plus the source archive and previous build under `checkpoints/2026-10-01-before-after-hours/`.

Only PACE was changed. No pushes, deployments, public profile edits, purchases or third-party service integrations occurred. Git attribution remains `KareemAl1 <kareemalwan47@gmail.com>`.

## Browser and method

The available controlled browser was the Codex in-app Chromium browser on this Windows PC. Its WebGL report identified an NVIDIA GeForce RTX 5080 through ANGLE/D3D11. Standalone Chrome was requested earlier but was not exposed by the available browser tools. The following is not a Chrome or physical-phone certification.

Visual inspection used 1440 × 900, 390 × 844 and 360 × 640 CSS-pixel viewports, DPR 1, with reported visual viewport scale 1. Saved screenshots have different pixel dimensions because of the capture surface: desktop 1425 × 891, phone 375 × 812, short phone 345 × 613. The gallery uses the actual image dimensions and labels the tested viewport separately.

The opt-in profiler samples actual calls to the product renderer separately from browser rAF scheduling. CPU duration surrounds `renderer.render()` only. Input latency ends at CPU submission, not GPU completion or displayed pixels. The test uses native browser-tool input, with accepted interactions recorded by the app. Idle periods between deliberate actions remain in the data. Large idle submission gaps are not dropped-frame measurements.

## Measured results

| Sample | Duration | Actual render submissions | Render CPU p95 / maximum | Accepted input → submission p95 | Long tasks |
| --- | ---: | ---: | ---: | ---: | ---: |
| [Warm production desktop](live-desktop-production.json) | 45,147.4 ms | 1,016 | 0.2 / 0.5 ms | 3.9 ms | 0 |
| [Phone-sized viewport](live-phone-viewport.json) | 41,321.6 ms | 633 | 0.2 / 0.7 ms | 3.1 ms | 0 |
| [Cold development setup](live-desktop-cold-dev.json) | 50,134.9 ms | 61 | 0.3 / 45.5 ms | 2.3 ms | 1, lasting 122 ms |

Desktop scroll-event-to-submission p95 was 0.7 ms across 19 samples; phone viewport p95 was 0.5 ms across 20. Warm desktop rAF scheduling gaps had median 4.2 ms, p95 4.3 ms and maximum 8.4 ms. These are scheduling intervals, **not a sustained display-FPS result**. No GPU timer or presentation trace was collected.

The desktop warm sample exercised scrolling/reversal, dragging, zoom, presets, keyboard/reset and rapid finish changes. It accepted 19 control events, yielding 15 input-to-submission samples because events may share a render. The phone-sized timing sample accepted five keyboard/preset/reset events. Its profiler panel covered the finish dock: no phone drag or finish event was accepted in that timing sample. All three phone finishes were separately inspected outside the profiler. The first 12 seconds of the desktop sample also included live canvas recording overhead.

The final accessibility-only edits (descriptive hotspot labels and restoring chapter buttons to the Tab sequence) were checked after the recorded samples. No rendering code changed after these samples.

## Performance findings and changes

- The current steady scene is **8 draw calls / 12,850 triangles**, including its contact-shadow plane. The shoe alone is 7 material meshes / 12,848 triangles. There are seven renderer textures, including the contact gradient; the largest maps are 512 × 512.
- One on-demand page scheduler owns camera, lighting and material animation. The renderer has no separate loop. The explicit profiler's sampler is measurement-only and does not drive the scene. There is no React component tree or React update on scroll.
- Scroll progress directly selects authored poses. No delayed spring follows old scroll positions. Explore owns the camera until released; finish changes retarget current material/light values without resetting the view.
- Fixed quality caps are DPR 1 on phone widths and 1.5 on desktop widths. No shadow maps or postprocessing are used. A small contact gradient grounds the product. Hidden documents cancel scheduled page frames; product rendering is skipped offscreen. These visibility rules were source-inspected, not measured in a background-tab battery test.
- The measured startup bottleneck remains procedural asset/renderer initialization and first shader submission. Cold development setup recorded a 122 ms long task; warm per-render CPU cost was small. The two-second opening starts after the first warm render, while HTML and a poster remain visible. This does not remove startup work.
- The current production Three.js chunk is 549.81 KB minified / 138.04 KB gzip and triggers Vite's size warning. It is imported with the scene and is unnecessary for the static path. The 15 aligned fallback posters total 691,644 bytes; they are not a frame-by-frame animation sequence.

There is no controlled, same-input before/after presentation benchmark for this creative revision, so no percentage speedup or guaranteed 60 FPS is claimed. The previous simpler design's sample remains in `docs/refinement/`; it is not evidence for the restored choreography.

## Interaction and visual checks

| Area | Actual result |
| --- | --- |
| Opening | Replay entered its playing state at scroll position 0; native click on Skip immediately ended it and returned focus to Replay. The timed opening ends after two seconds. Back/forward did not replay it. |
| Story | Form, knit, heel and sole were inspected on desktop; phone knit/sole and the short-height composition were inspected. Fast forward and reverse native scrolling and viewport resize were exercised. Chapters remain composed instead of empty pinned space. |
| Colorways | Volt, Ice and Infrared were inspected on desktop and phone. Actual geometry, lighting and page accents change together. Rapid desktop changes roughly 25–33 ms apart were accepted without a queued backlog. Finish geometry/texture identities remain stable. |
| Explore | Native desktop dragging, zoom buttons, Side/Top/Sole/Three-quarter views, keyboard arrows, +/−, Home/reset and Escape were exercised. Closing “Explore again” focuses the viewer. “Find your finish” focuses the selected radio; arrow navigation changes it. |
| Hotspots and focus | Knit, heel and sole descriptions opened from the viewer. Close detail returns focus to the viewer. Back to story focuses the visible chapter and retains all four native chapter buttons at tabindex 0. Reduced mode focuses a visible static article. Hotspots now have descriptive accessible names even when their visual labels are hidden on narrow screens. |
| Reduced motion | Fresh reduced entry shows complete still chapters. Explicit manual Explore, rotation and Escape work. Switching from full settles transitions; Meet PACE targets visible content. |
| WebGL failure | Actual context-loss control switched to the full image story, removed the canvas and disabled unavailable 3D entry. Finish selection continued to work. Forced static mode was also visually inspected. |
| Navigation and loading | Browser back/forward and finish URL restoration checked. No broken loaded images were found in the final fallback review. No console errors were returned during the final reduced-mode interaction check. |
| Build and asset integrity | TypeScript/production build and geometry validation passed. Geometry validation covers finite attributes, stable shared references, distinct palettes and interruption continuity; it does not prove realism. |

## Evidence and remaining limitations

The [gallery](review.html) contains the preserved before design, 14 current browser screenshots, all three finishes, close-ups, exploration, closing and phone fallback. [The short live recording](live-canvas.webm) comes from the actual campaign WebGL canvas while the page was operated. The 12-second capture window produced an encoded playback duration of 2.008041 seconds in this browser (verified from the loaded video metadata). The cause of that duration discrepancy was not established. It excludes HTML typography, controls and page backgrounds. It is not an offline turntable, a full-page recording or proof of smooth presented frames.

The shoe remains an original procedural design study. Directional knit maps, refined collar geometry and material contrast improve coherence, but extreme close-ups still expose stylized panels, limited map resolution and some edge faceting. It should not be described as photoreal product photography.

Not performed: physical touch-device testing, standalone Chrome/Safari/Firefox certification, screen-reader testing, GPU/presented-frame profiling, a throttled-network audit, OS-level reduced-motion switching, a disabled-JavaScript browser run or a background-tab power test. No sales, shopping, backend or performance claims were added. The [reference audit](REFERENCES.md) distinguishes live observations from archived imagery and inaccessible interactions.
