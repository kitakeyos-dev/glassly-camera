// MediaPipe Hands + Camera lifecycle

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
        // Ngôi sao: 5 ngón xoè (1 tay)
        else if (checkStarGesture(hand1)) {
            const wrist      = { x: hand1[0].x * w, y: hand1[0].y * h };
            const middleBase = { x: hand1[9].x * w, y: hand1[9].y * h };
            const middleTip  = { x: hand1[12].x * w, y: hand1[12].y * h };
            const handSize   = Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y);
            // Tâm ngôi sao = giữa lòng bàn tay (trên cổ tay 1 chút về phía ngón giữa)
            const cx = (middleBase.x + middleTip.x) / 2;
            const cy = (middleBase.y + middleTip.y) / 2;
            const size = handSize * 1.8;
            currentGestureData = {
                type: 'star',
                cx, cy,
                rx: size,
                ry: size,
            };
            gestureName = 'NGÔI SAO';
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
                currentGestureData = { type: 'circle', cx, cy, rx, ry, angle, isResizable: true };
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
    const bgFilterDef = CAMERA_FILTERS.find(f => f.id === bgFilterId);
    const bgFilterCss = bgFilterDef ? bgFilterDef.css : 'none';

    ctx.save();
    ctx.filter = bgFilterCss;
    ctx.drawImage(usesFrozenBg ? frozenCanvas : results.image, 0, 0, w, h);
    ctx.restore();

    if (frozenGlass && !activeGlass) {
        drawGlass3D(results.image, frozenGlass, 1.0);
    }

    if (activeGlass && !isCooldown) {
        drawGlass3D(results.image, activeGlass, currentProgress);
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

function makeCamera() {
    return new Camera(videoEl, {
        onFrame: async () => { await hands.send({ image: videoEl }); },
        width: preferredCameraResolution.width,
        height: preferredCameraResolution.height,
        facingMode: currentFacingMode,
    });
}

let camera = makeCamera();

function handleCameraError(err) {
    console.error('Camera error:', err);
    loadingEl.style.display = 'none';
    errorEl.classList.add('visible');
    cameraRunning = false;
    resumeCameraAfterVisibility = false;
}

async function startCamera() {
    if (cameraRunning) return;
    if (cameraStartPromise) return cameraStartPromise;

    cameraStartPromise = camera.start()
        .then(() => {
            cameraRunning = true;
            resumeCameraAfterVisibility = true;
            errorEl.classList.remove('visible');
        })
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
    const prev = currentFacingMode;
    const next = prev === 'user' ? 'environment' : 'user';
    stopCamera();
    currentFacingMode = next;
    camera = makeCamera();
    try {
        await startCamera();
        canvasEl.classList.toggle('no-mirror', next === 'environment');
    } catch (error) {
        // Rollback if device doesn't have the requested camera
        currentFacingMode = prev;
        camera = makeCamera();
        await startCamera();
        canvasEl.classList.toggle('no-mirror', prev === 'environment');
        showToast('Không tìm thấy camera này.', 2400);
    }
}

function stopCamera() {
    try {
        camera.stop();
    } catch (error) {
        console.error('Camera stop error:', error);
    }
    cameraRunning = false;
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
