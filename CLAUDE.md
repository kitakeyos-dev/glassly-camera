# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Glassly (aka picai-clone) — a vanilla-JS web camera app that uses MediaPipe Hands to detect finger gestures and overlay a 3D "glass" shape on the live video, then lets the user edit captures with collage/frame/sticker/text tools.

No build step, no package manager, no test suite. The app is plain HTML + CSS + ES scripts loaded directly by the browser.

## Commands

**Run locally** — serve this directory over HTTP (camera APIs require a secure context; `file://` won't work). Any static server works:
```
python -m http.server 8000
```
Then open `http://localhost:8000/`. For remote testing from a phone, the site must be served over HTTPS or via `localhost`.

## Architecture

### Script loading and global scope
[index.html](index.html) loads the JS files as plain `<script defer>` tags (no modules, no bundler). Every file shares one global scope, so `let`/`const` declared at the top level of one file is visible to the others. The load order matters and is fixed:

```
icons → config → dom → state → utils → history → editor → glass → gestures → capture → webgl_beauty → camera → glass_editor → main
```

- [js/dom.js](js/dom.js) grabs every `document.getElementById` / canvas-context reference once, so all other files just use those globals.
- [js/state.js](js/state.js) holds all mutable shared state (`frozenGlass`, `activeGlass`, `capturedPhotos`, `currentCameraFilter`, `imageCache`, …). Any file can mutate these.
- [js/config.js](js/config.js) holds the constants and the `editorState` object, plus the declarative lists (`FRAME_STYLES`, `STICKER_LIBRARY`, `CAMERA_FILTERS`, `GLASS_PALETTES`, `COLLAGE_LAYOUTS`, `EDITOR_TABS`, `TEXT_FONTS`, `COUNTDOWN_OPTIONS`, `MAX_CAPTURE_HISTORY`, …).
- [js/main.js](js/main.js) wires up every DOM event listener and kicks off `startCamera()`. It is the last script to load.

Because everything is global, renaming a symbol requires updating every file that touches it. TypeScript "cannot find name" hints in the IDE are expected cross-file and not real errors.

### Camera / gesture / glass pipeline (hot path)
Driven by MediaPipe Hands, which pushes frames into [js/camera.js](js/camera.js) via `hands.onResults(onResults)`. Every video frame:

1. [js/camera.js](js/camera.js) receives `results` (image + landmarks), runs the gesture detectors from [js/gestures.js](js/gestures.js) to decide which shape (triangle / heart / two-hand heart / L-frame quad / stretch circle) is being formed, and computes the shape geometry from the landmark pixel positions.
2. A stability timer (`snapTimer` + `STABILITY_THRESHOLD` + `SNAP_DELAY` from [js/config.js](js/config.js)) waits until the shape holds still long enough, then "freezes" it — snapshotting `results.image` into `frozenCanvas` and entering cooldown until the user taps the output canvas to clear it.
3. [js/glass.js](js/glass.js) draws the frosted-glass look: `buildPath(glass)` emits the correct `Path2D` per shape, `drawGlass3D` clips to it, zooms/filters the inside, adds shimmer/bevel/chromatic aberration when snapped, and `drawProgressRing` animates the capture progress ring.
4. The main `canvasEl` is the live output. `frozenCanvas`, `saveFrameCanvas`, `thumbFrameCanvas`, `editorExportCanvas` are offscreen canvases created in [js/dom.js](js/dom.js) or [js/capture.js](js/capture.js) and reused across frames/captures — do not allocate new canvases inside `onResults` or `saveCurrentFrame`.

Before step 3 draws to `canvasEl`, [js/webgl_beauty.js](js/webgl_beauty.js) runs the "uber" fragment shader on `results.image` in a single draw: beauty smoothing + skin whitening + per-channel LUT (from [assets/luts/](assets/luts/)) + optional sketch/crayon. It does at most one `texImage2D` upload per frame regardless of how many effects are active. When adding a new camera-side filter, extend this shader rather than layering a second CPU pass in `onResults`.

This loop runs at camera framerate. Work added here is multiplied by ~30/sec, so prefer reusing buffers and avoid synchronous `toDataURL`, `getImageData`, or DOM writes in the loop.

### Capture → history → editor pipeline
- [js/capture.js](js/capture.js) `saveCurrentFrame()` mirrors the live canvas into the reusable `saveFrameCanvas`, encodes it as JPEG via `toDataURL('image/jpeg', 0.9)`, and also produces a small (≤320px) JPEG thumbnail in `thumbFrameCanvas`. Both are passed to `pushCapturedPhoto(dataUrl, thumbUrl)`.
- [js/history.js](js/history.js) owns `capturedPhotos` (FIFO, capped at `MAX_CAPTURE_HISTORY = 10`). `pushCapturedPhoto` **only** re-renders the drawer if it is currently visible — rebuilding the drawer when hidden forces the browser to decode every stored photo on every capture and was the cause of progressive post-capture lag. The history list uses `photo.thumbUrl` for list items and the full `photo.dataUrl` only for the preview pane.
- [js/editor.js](js/editor.js) implements the whole editor overlay: layout slot math (`getLayoutSlots`), frame rendering (`drawEditorFrame`), sticker/text drawing (`drawSticker`, `createTextRenderCanvas`), hit-testing on sticker alpha (`findStickerAtPoint` + `isStickerPixelVisible` using per-sticker `renderCanvas`/`renderCtx`), eraser (`eraseStickerStroke`, `destination-out` composite on `renderCtx`), undo/redo (`pushEditorHistory`/`snapshotEditorState`/`restoreEditorSnapshot`, capped at `EDITOR_HISTORY_MAX = 25`), and export (`saveEditorChanges` writes back into `photo.renderedDataUrl` + `photo.editorSnapshot`).
- The editor scene renders through a single token-guarded async function, `renderEditorScene(ctx, canvas, includeSelection, token)`. Every call to `renderEditorCanvas()` bumps `editorState.renderToken`; stale async renders check the token and bail. When adding async work to the editor render path, thread the token through and respect it.

### Glass-shape photo editor
[js/glass_editor.js](js/glass_editor.js) is a second, separate editor triggered by the "Chèn ảnh" button once a glass shape has frozen. It reuses `frozenGlass` + `frozenCanvas` as a clip mask: the user picks a photo from history (or uploads), drags / pinch-zooms it inside the glass, and saves — producing a brand-new capture that looks like the camera shot that photo through the glass. Because front-camera captures bake the mirror flip into `frozenCanvas` via `saveCurrentFrame`, `glassEditorState.frozenFacingMode` is tracked so picked photos get drawn through the same flip and stay in the same coordinate space as the background.

## Conventions worth knowing

- UI strings are Vietnamese. Keep new user-facing copy in Vietnamese.
- `loadImageCached(src)` in [js/utils.js](js/utils.js) intentionally **skips** `data:` URLs — caching them would pin every captured photo in memory forever. Pass HTTP(S) paths if you want caching.
- Camera resolution is chosen by `getPreferredCameraResolution()` (640×480 on low-power/small devices, 1280×720 otherwise). The output canvas is sized to `videoEl.videoWidth/Height` per frame, but only when those dimensions actually change — avoid unconditional `canvasEl.width = …` assignments because they reset the canvas bitmap and context state.
- The capture button supports short-tap (countdown) and long-press (burst) via `burstHoldTimer` / `burstIntervalId` in [js/main.js](js/main.js). Keyboard Space triggers an immediate save.
- Editor history stores sticker render canvases as base64 PNGs inside each snapshot (`snapshotEditorState`). This is memory-heavy; do not push editor history on high-frequency events (pointermove, wheel) — push on pointerup / discrete actions only, as `stopStickerDrag` / `handleStickerToolbarAction` already do.
