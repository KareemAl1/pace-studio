# PACE reference audit

Research recorded October 1, 2026. This document distinguishes published descriptions, the root agent's live-browser observations, and proposed principles for PACE. No reference site's code, imagery, logo or layout is being reused.

## Destinations and evidence

| Requested reference | Destination linked by Awwwards | Evidence available in this research pass |
| --- | --- | --- |
| [Lusion v3](https://www.awwwards.com/sites/lusion-v3) | [lusion.co](https://lusion.co/) | Awwwards entry and current destination text retrieved. The 2023 award entry does not establish that today's site is the same revision. |
| [Finely Crafted](https://www.awwwards.com/sites/finely-crafted) | [finely-crafted.com](https://www.finely-crafted.com/) | Awwwards entry and element descriptions retrieved. Destination text extraction exposed only its title/shell. |
| [Nike PLAYlab](https://www.awwwards.com/sites/nike-playlab) | Originally `https://www.nikeplaylab.com/` | Awwwards entry and original archived element pages retrieved. The current destination is not the original experience in the root agent's browser inspection; use the archives below. |

## What the reference pages document

**Lusion v3:** the award entry specifically catalogs reactive cursor behavior and scroll animation, plus distinct home, project and about pages. Its palette is listed as blue and pale grey. These are the publisher's descriptions, not measurements or a claim that those interactions were successfully exercised here. [Award entry](https://www.awwwards.com/sites/lusion-v3), [cursor element](https://www.awwwards.com/inspiration/reactive-cursor-interaction), [scroll element](https://www.awwwards.com/inspiration/scroll-animation-3).

**Finely Crafted:** an immersive tour of the Shoe Surgeon's studio that presents the making of a collaboration sneaker. The published element list includes a menu transition and a 360-degree studio environment; the entry tags WebGL, GSAP and Vue. The tags are attribution from Awwwards, not an implementation audit. [Award entry](https://www.awwwards.com/sites/finely-crafted), [studio-tour element](https://www.awwwards.com/inspiration/finely-crafted-immersive-3d-tour-of-the-shoe-surgeons-la-studio), [menu-transition element](https://www.awwwards.com/inspiration/finely-crafted-explore-the-studio-floor).

**Nike PLAYlab:** an activity-led kids' challenge with sport invention, dance and a football-themed mode. Its original archive separates loading, challenge content, mobile home/gallery and desktop menu detail. The entry describes colorful interfaces and microinteractions. This is evidence about the original project, not the unrelated site now reached by its historical domain. [Award entry](https://www.awwwards.com/sites/nike-playlab), [loading archive](https://www.awwwards.com/inspiration/nike-playlab-loading), [challenge archive](https://www.awwwards.com/inspiration/nike-playlab-online-kids-challenge), [mobile home/gallery](https://www.awwwards.com/inspiration/mobile_thumbnail-nike-playlab), [desktop menu details](https://www.awwwards.com/inspiration/thumbnail-nike-playlab).

## Live-browser inspection boundary

The research agent retrieved text and links; it did not independently operate these websites. The following visual observations were supplied by the root agent's live CUA inspection, after the initial loading screens:

- **Lusion, current live site:** a pale violet field frames a rounded rectangular 3D stage with high-contrast black, white and saturated-blue jointed objects. Native wheel input visibly deformed the scene. The complete transition into projects was not inspected; the Awwwards catalog alone cannot verify that transition on the current revision. [Current destination](https://lusion.co/).
- **Finely Crafted, current live opening:** a black title screen, oversized cream lettering, three collaboration marks, a diagonal line-art shoe and an Enter control were visible. Entry was attempted, but the studio tour was not reached in this pass. No claim is made that its 360-degree controls were exercised. [Current destination](https://www.finely-crafted.com/).
- **Nike PLAYlab, archived Menu Details image:** the original archive was visually inspected. It shows large condensed black links stacked on a light-blue field, a bold purple frame, selective colored letters and 3D sports objects. This establishes the archived composition, not working animation or input behavior. The historical live destination now opens unrelated WordPress architecture/blog content; inspection of that content stopped. The original runtime was unavailable for verification. [Archived Menu Details](https://www.awwwards.com/inspiration/thumbnail-nike-playlab).

These are bounded observations from this browser pass. A text fetch returning an error or a JavaScript shell does not establish that a website is offline, and an archived still image is not proof of runtime quality.

## Principles to translate into PACE

These are design proposals inferred from the references, not descriptions of finished PACE behavior:

1. **Give 3D one coherent stage and keep its UI quiet.** Lusion's inspected hero makes the sculptural objects legible within a single visual field. For PACE, consistent light and camera framing should explain the shoe's silhouette, construction and knit; controls should remain easy to find without competing with the product.
2. **Make input visibly matter.** Drag, finish, zoom and camera-preset controls should have immediate, legible feedback. Preserve standard controls and a normal cursor so interaction does not depend on discovering a special gesture.
3. **Reveal the product deliberately.** Finely Crafted's inspected line-art shoe and title establish a product before its tour. Translate that principle into PACE's own short opening and continuous move toward material detail, keeping the same original geometry visible throughout.
4. **Make type and navigation expressive but legible.** Nike's archived menu gives condensed typography a clear hierarchy and uses selective color within a consistent field. PACE can use athletic type and restrained finish/navigation accents without copying its frame, letter treatments, branded objects or page arrangement.
5. **Keep the entrance short and useful.** PACE's content and controls must be available immediately. A long loader observed on another site is not a design requirement to reproduce.

## Live measurement contract

PACE's opt-in profiler must keep browser rAF cadence separate from actual product-render submission intervals. On-demand rendering intentionally leaves idle gaps; correlate render timestamps with accepted input events before interpreting a gap as a stall. CPU submission completion is not GPU completion or displayed-frame timing. Trusted DOM events may still originate from browser UI automation.

Report the input coverage actually recorded: scrolling and reversals, accepted drags, zooms, finish changes and camera presets. Zero counts leave that interaction untested. Keep hidden-tab intervals and trace truncation explicit, distinguish phone viewport emulation from physical devices, and never use an offline render or generated video as proof of live website smoothness.
