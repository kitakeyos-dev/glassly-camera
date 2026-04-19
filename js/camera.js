// MediaPipe Hands + Camera lifecycle

// Scratch objects reused across frames so the hot path doesn't allocate a
// new options tree on every render. Properties are overwritten before each
// applyImageFilters call.
const pipelineOptionsScratch = {
    beauty: { enabled: false, strength: 0 },
    skinWhiten: { enabled: false, strength: 0 },
    lut: { url: null, mix: 1.0 },
    shader: null
};
let lastFrozenBtnVisible = null;

function onResults(results) {
    if (!loadingEl.classList.contains('hidden')) {
        if (loadingProgressFillEl) loadingProgressFillEl.style.width = '100%';
        if (loadingSubtitleEl) loadingSubtitleEl.textContent = 'Sẵn sàng';
        loadingEl.classList.add('hidden');
        setTimeout(() => { loadingEl.style.display = 'none'; }, 600);
    }

    const w = videoEl.videoWidth  || 1280;
    const h = videoEl.videoHeight || 720;
    // Assigning to canvas.width/height always clears the bitmap and resets ctx
    // state — only do it when the size actually changes.
    if (canvasEl.width !== w) canvasEl.width = w;
    if (canvasEl.height !== h) canvasEl.height = h;

    if (frozenCanvas.width !== w || frozenCanvas.height !== h) {
        frozenCanvas.width = w; frozenCanvas.height = h;
    }

    let currentGestureData = null;
    let gestureName        = null;

    if (results.multiHandLandmarks?.length > 0) {
        const hand1 = results.multiHandLandmarks[0];

        // Tam giác: cái + trỏ + giữa (1 tay)
        if (checkTriangleGesture(hand1)) {
            const p1 = { x: hand1[4].x  * w, y: hand1[4].y  * h };
            const p2 = { x: hand1[8].x  * w, y: hand1[8].y  * h };
            const p3 = { x: hand1[12].x * w, y: hand1[12].y * h };
            currentGestureData = {
                type: 'triangle', p1, p2, p3,
                cx: (p1.x + p2.x + p3.x) / 3,
                cy: (p1.y + p2.y + p3.y) / 3,
            };
            gestureName = 'TAM GIÁC';
        }
        // Finger heart: cái + trỏ đan chéo thành X (1 tay)
        else if (checkFingerHeartGesture(hand1)) {
            const wrist      = { x: hand1[0].x * w, y: hand1[0].y * h };
            const middleBase = { x: hand1[9].x * w, y: hand1[9].y * h };
            const thumbTip   = { x: hand1[4].x * w, y: hand1[4].y * h };
            const indexTip   = { x: hand1[8].x * w, y: hand1[8].y * h };
            const handSize   = Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y);
            // Giao điểm đan chéo ≈ trung điểm 2 đầu ngón cái + trỏ → đáy trái tim.
            const bottomX = (thumbTip.x + indexTip.x) / 2;
            const bottomY = (thumbTip.y + indexTip.y) / 2;
            const size = handSize * 0.95;
            currentGestureData = {
                type: 'heart',
                // cx / cy = tâm hình học của heart, được tính từ bottomY.
                cx: bottomX,
                cy: bottomY - size * 0.9,
                rx: size,
                ry: size,
            };
            gestureName = 'TRÁI TIM';
        }

        if (results.multiHandLandmarks.length === 2) {
            const hand2     = results.multiHandLandmarks[1];
            const leftHand  = hand1[8].x < hand2[8].x ? hand1 : hand2;
            const rightHand = hand1[8].x < hand2[8].x ? hand2 : hand1;

            // Trái tim 2 tay: ưu tiên trước L-frame vì cùng config ngón
            if (checkTwoHandHeartGesture(hand1, hand2)) {
                const lThumb = { x: leftHand[4].x  * w, y: leftHand[4].y  * h };
                const rThumb = { x: rightHand[4].x * w, y: rightHand[4].y * h };
                const lIndex = { x: leftHand[8].x  * w, y: leftHand[8].y  * h };
                const rIndex = { x: rightHand[8].x * w, y: rightHand[8].y * h };
                const bottomX = (lThumb.x + rThumb.x) / 2;
                const bottomY = (lThumb.y + rThumb.y) / 2;
                const topX = (lIndex.x + rIndex.x) / 2;
                const topY = (lIndex.y + rIndex.y) / 2;
                const gestureH = Math.max(20, bottomY - topY);
                // buildPath uses cy +- ry so that bottom = cy + ry*0.9 and topDip = cy - ry*0.25
                const ry = gestureH / 1.15;
                const rx = ry;
                const cx = (bottomX + topX) / 2;
                const cy = topY + ry * 0.25;
                currentGestureData = { type: 'heart', cx, cy, rx, ry };
                gestureName = 'TRÁI TIM 2 TAY';
            }
            // Tứ giác 3D (L-Frame, 2 tay)
            else if (checkLFrameGesture(hand1) && checkLFrameGesture(hand2)) {
                const ex = 1.1;
                const tl = { x: leftHand[8].x  * w, y: leftHand[8].y  * h };
                const tr = { x: rightHand[8].x * w, y: rightHand[8].y * h };
                const br = { x: rightHand[4].x * w, y: rightHand[4].y * h };
                const bl = { x: leftHand[4].x  * w, y: leftHand[4].y  * h };
                const cx = (tl.x + tr.x + br.x + bl.x) / 4;
                const cy = (tl.y + tr.y + br.y + bl.y) / 4;
                const expand = p => ({ x: cx + (p.x - cx) * ex, y: cy + (p.y - cy) * ex });
                currentGestureData = { type: 'quad', tl: expand(tl), tr: expand(tr), br: expand(br), bl: expand(bl), cx, cy };
                gestureName = 'TỨ GIÁC 3D';
            }

            // Vòng tròn kéo dãn: cái + trỏ + út (2 tay)
            else if (checkStretchCircleGesture(hand1, hand2)) {
                const lIndex = { x: leftHand[8].x  * w, y: leftHand[8].y  * h };
                const rIndex = { x: rightHand[8].x * w, y: rightHand[8].y * h };
                const lThumb = { x: leftHand[4].x  * w, y: leftHand[4].y  * h };
                const rThumb = { x: rightHand[4].x * w, y: rightHand[4].y * h };
                const lPinky = { x: leftHand[20].x * w, y: leftHand[20].y * h };
                const rPinky = { x: rightHand[20].x* w, y: rightHand[20].y* h };
                // Tâm = trung điểm 2 cặp (trỏ+cái) của 2 tay
                const lAnchor = { x: (lIndex.x + lThumb.x) / 2, y: (lIndex.y + lThumb.y) / 2 };
                const rAnchor = { x: (rIndex.x + rThumb.x) / 2, y: (rIndex.y + rThumb.y) / 2 };
                const cx = (lAnchor.x + rAnchor.x) / 2;
                const cy = (lAnchor.y + rAnchor.y) / 2;
                // rx: kéo 2 tay ra xa/gần → thay đổi chiều ngang
                const rx = Math.hypot(lAnchor.x - rAnchor.x, lAnchor.y - rAnchor.y) / 2 * 1.1;
                // ry: nâng/hạ ngón út → thay đổi chiều dọc
                const pinkyMid = { x: (lPinky.x + rPinky.x) / 2, y: (lPinky.y + rPinky.y) / 2 };
                const ry = Math.hypot(pinkyMid.x - cx, pinkyMid.y - cy) * 1.15;
                const angle = Math.atan2(rAnchor.y - lAnchor.y, rAnchor.x - lAnchor.x);
                currentGestureData = { type: 'circle', cx, cy, rx, ry, angle };
                gestureName = 'VÒNG TRÒN';
            }
        }
    }

    let currentProgress = 0;
    const isFrameLocked = !!frozenGlass && isCooldown;

    if (isFrameLocked) {
        activeGlass = null;
        lastPos = null;
        snapTimer = 0;
    } else if (currentGestureData) {
        if (!isCooldown) {
            if (frozenGlass) frozenGlass = null;

            if (lastPos) {
                const dist = Math.hypot(lastPos.cx - currentGestureData.cx, lastPos.cy - currentGestureData.cy);
                if (dist < STABILITY_THRESHOLD) {
                    if (snapTimer === 0) snapTimer = Date.now();
                    currentProgress = (Date.now() - snapTimer) / SNAP_DELAY;
                    if (currentProgress >= 1) {
                        frozenGlass = currentGestureData;
                        frozenCtx.drawImage(results.image, 0, 0, w, h);
                        frozenFilter    = currentCameraFilter;
                        isCooldown      = true;
                        snapTimer       = 0;
                        currentProgress = 0;
                        flashFrames     = 10;
                    }
                } else {
                    snapTimer = 0;
                    lastPos   = currentGestureData;
                }
            } else {
                lastPos   = currentGestureData;
                snapTimer = Date.now();
            }
        }
        activeGlass = currentGestureData;
    } else {
        activeGlass = null;
        lastPos     = null;
        snapTimer   = 0;
        isCooldown  = false;
    }

    updateGestureTag(isFrameLocked ? lastGesture : gestureName);

    ctx.clearRect(0, 0, w, h);

    const usesFrozenBg = frozenGlass && !activeGlass;
    const bgFilterId = usesFrozenBg ? frozenFilter : currentCameraFilter;
    const bgFilterDef = CAMERA_FILTER_BY_ID.get(bgFilterId);
    const bgFilterKind = bgFilterDef ? bgFilterDef.kind : 'none';
    const bgFilterCss = bgFilterKind === 'css' ? bgFilterDef.css : 'none';
    const bgFilterLutUrl = bgFilterKind === 'lut' ? bgFilterDef.lut : null;
    const bgFilterShader = bgFilterKind === 'shader' ? bgFilterDef.shader : null;

    // Unified pipeline: the WebGL uber-shader runs beauty / skin-whiten /
    // LUT / sketch / crayon in a single draw when at least one is active.
    // CSS filters stay on ctx.filter because they're already GPU-accelerated
    // and don't need the WebGL round trip.
    const needsPipeline = beautyEnabled || skinWhitenEnabled || bgFilterLutUrl || bgFilterShader;
    let pipelineOptions = null;
    if (needsPipeline) {
        pipelineOptionsScratch.beauty.enabled = beautyEnabled;
        pipelineOptionsScratch.beauty.strength = beautyStrength;
        pipelineOptionsScratch.skinWhiten.enabled = skinWhitenEnabled;
        pipelineOptionsScratch.skinWhiten.strength = skinWhitenStrength;
        pipelineOptionsScratch.lut.url = bgFilterLutUrl;
        pipelineOptionsScratch.shader = bgFilterShader;
        pipelineOptions = pipelineOptionsScratch;
    }

    const rawBackgroundSource = usesFrozenBg ? frozenCanvas : results.image;
    let backgroundToDraw = rawBackgroundSource;
    if (pipelineOptions) {
        const filtered = applyImageFilters(rawBackgroundSource, w, h, pipelineOptions);
        if (filtered) backgroundToDraw = filtered;
    }

    ctx.save();
    ctx.filter = bgFilterCss;
    ctx.drawImage(backgroundToDraw, 0, 0, w, h);
    ctx.restore();

    let glassInteriorSource = results.image;
    if (pipelineOptions) {
        if (rawBackgroundSource === results.image) {
            glassInteriorSource = backgroundToDraw;
        } else {
            const filtered = applyImageFilters(results.image, w, h, pipelineOptions);
            if (filtered) glassInteriorSource = filtered;
        }
    }

    if (frozenGlass && !activeGlass) {
        drawGlass3D(glassInteriorSource, frozenGlass, 1.0);
    }

    if (activeGlass && !isCooldown) {
        drawGlass3D(glassInteriorSource, activeGlass, currentProgress);
    }

    if (results.multiHandLandmarks && !frozenGlass) {
        for (const hand of results.multiHandLandmarks) {
            drawConnectors(ctx, hand, HAND_CONNECTIONS, { color: 'rgba(255,255,255,0.1)', lineWidth: 2 });
            drawLandmarks(ctx, hand, { color: 'rgba(255,255,255,0.3)', lineWidth: 1, radius: 2 });
        }
    }

    if (flashFrames > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flashFrames * 0.09})`;
        ctx.fillRect(0, 0, w, h);
        flashFrames--;
    }

    // Surface dedicated controls while a glass is frozen — tapping the
    // canvas still clears, but the buttons make the interactions
    // discoverable and also let the user reuse the frame with a different
    // photo via the glass editor. State-diff so we don't touch classList
    // every single frame.
    const frozen = !!frozenGlass;
    if (frozen !== lastFrozenBtnVisible) {
        clearFrameBtnEl.classList.toggle('visible', frozen);
        insertPhotoBtnEl.classList.toggle('visible', frozen);
        lastFrozenBtnVisible = frozen;
    }
}

const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands:            2,
    modelComplexity:        1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
});

hands.onResults(onResults);

const preferredCameraResolution = getPreferredCameraResolution();
let cameraRunning = false;
let resumeCameraAfterVisibility = false;
let cameraStartPromise = null;
let cameraSwitching = false;

// We run our own capture loop instead of MediaPipe's Camera helper because
// that helper keeps an internal RAF recursion alive via captured closures
// even after stop(), so a front→back→front sequence quickly ends up with
// two or three overlapping `hands.send` streams queueing through the WASM
// backend, which is the observable lag. This loop owns a single token so
// stop() can cut the chain cleanly.
let captureLoopToken = 0;
let captureLoopInFlight = null;

function handleCameraError(err) {
    console.error('Camera error:', err);
    loadingEl.style.display = 'none';
    errorEl.classList.add('visible');
    cameraRunning = false;
    resumeCameraAfterVisibility = false;
}

async function openCameraStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: currentFacingMode,
            width: { ideal: preferredCameraResolution.width },
            height: { ideal: preferredCameraResolution.height }
        }
    });
    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.setAttribute('playsinline', '');
    // Wait for the first frame to land before kicking the capture loop so
    // hands.send doesn't see a 0x0 video element.
    if (videoEl.readyState < 2) {
        await new Promise((resolve, reject) => {
            const onReady = () => {
                videoEl.removeEventListener('loadeddata', onReady);
                videoEl.removeEventListener('error', onError);
                resolve();
            };
            const onError = e => {
                videoEl.removeEventListener('loadeddata', onReady);
                videoEl.removeEventListener('error', onError);
                reject(e);
            };
            videoEl.addEventListener('loadeddata', onReady, { once: true });
            videoEl.addEventListener('error', onError, { once: true });
        });
    }
    try { await videoEl.play(); } catch (_) {}
    return stream;
}

function runCaptureLoop(token) {
    const tick = async () => {
        if (token !== captureLoopToken) return;
        if (videoEl.videoWidth && videoEl.videoHeight) {
            try {
                captureLoopInFlight = hands.send({ image: videoEl });
                await captureLoopInFlight;
            } catch (err) {
                if (token !== captureLoopToken) return;
                console.warn('hands.send failed:', err);
            } finally {
                captureLoopInFlight = null;
            }
        }
        if (token !== captureLoopToken) return;
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

async function startCamera() {
    if (cameraRunning) return;
    if (cameraStartPromise) return cameraStartPromise;

    cameraStartPromise = (async () => {
        await openCameraStream();
        cameraRunning = true;
        resumeCameraAfterVisibility = true;
        errorEl.classList.remove('visible');
        const token = ++captureLoopToken;
        runCaptureLoop(token);
    })()
        .catch(err => {
            handleCameraError(err);
            throw err;
        })
        .finally(() => {
            cameraStartPromise = null;
        });

    return cameraStartPromise;
}

async function switchCamera() {
    if (cameraSwitching) return;
    cameraSwitching = true;
    const prev = currentFacingMode;
    const next = prev === 'user' ? 'environment' : 'user';
    try {
        await stopCamera();
        currentFacingMode = next;
        await startCamera();
        canvasEl.classList.toggle('no-mirror', next === 'environment');
    } catch (error) {
        // Rollback if the requested lens isn't available on this device.
        try { await stopCamera(); } catch (_) {}
        currentFacingMode = prev;
        try {
            await startCamera();
            canvasEl.classList.toggle('no-mirror', prev === 'environment');
        } catch (_) {}
        showToast('Không tìm thấy camera này.', 2400);
    } finally {
        cameraSwitching = false;
    }
}

// Fully release the camera: cut the capture loop, wait for any in-flight
// hands.send to drain, stop every MediaStreamTrack, and detach the video
// element. The 80ms tail gives mobile sensors a beat to actually release
// before the next getUserMedia picks up the other lens.
async function stopCamera() {
    captureLoopToken++;
    if (captureLoopInFlight) {
        try { await captureLoopInFlight; } catch (_) {}
    }
    const stream = videoEl.srcObject;
    if (stream && typeof stream.getTracks === 'function') {
        videoEl.srcObject = null;
        for (const track of stream.getTracks()) {
            try { track.stop(); } catch (_) {}
        }
    }
    cameraRunning = false;
    cameraStartPromise = null;
    await new Promise(resolve => setTimeout(resolve, 80));
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        resumeCameraAfterVisibility = cameraRunning;
        stopCamera();
        return;
    }

    if (resumeCameraAfterVisibility) {
        startCamera().catch(() => {});
    }
});

window.addEventListener('pagehide', () => {
    resumeCameraAfterVisibility = false;
    stopCamera();
});

window.addEventListener('beforeunload', () => {
    resumeCameraAfterVisibility = false;
    stopCamera();
});
