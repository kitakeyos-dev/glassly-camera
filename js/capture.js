// Save current frame to disk + history

let countdownActive = false;

// Reusable offscreen canvases — creating a new one per capture
// triggers large allocations and forces the GC while the camera loop runs.
const saveFrameCanvas = document.createElement('canvas');
const saveFrameCtx = saveFrameCanvas.getContext('2d');
const thumbFrameCanvas = document.createElement('canvas');
const thumbFrameCtx = thumbFrameCanvas.getContext('2d');
const HISTORY_THUMB_MAX = 320;

function saveCurrentFrame() {
    if (!canvasEl.width || !canvasEl.height) return;

    const w = canvasEl.width;
    const h = canvasEl.height;
    if (saveFrameCanvas.width !== w || saveFrameCanvas.height !== h) {
        saveFrameCanvas.width = w;
        saveFrameCanvas.height = h;
    }
    saveFrameCtx.setTransform(1, 0, 0, 1, 0, 0);
    saveFrameCtx.clearRect(0, 0, w, h);
    saveFrameCtx.translate(w, 0);
    saveFrameCtx.scale(-1, 1);
    saveFrameCtx.drawImage(canvasEl, 0, 0);

    // JPEG is ~5-10x smaller than PNG and much faster to encode/decode.
    const dataUrl = saveFrameCanvas.toDataURL('image/jpeg', 0.9);

    const thumbScale = Math.min(1, HISTORY_THUMB_MAX / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * thumbScale));
    const th = Math.max(1, Math.round(h * thumbScale));
    if (thumbFrameCanvas.width !== tw || thumbFrameCanvas.height !== th) {
        thumbFrameCanvas.width = tw;
        thumbFrameCanvas.height = th;
    }
    thumbFrameCtx.clearRect(0, 0, tw, th);
    thumbFrameCtx.drawImage(saveFrameCanvas, 0, 0, tw, th);
    const thumbUrl = thumbFrameCanvas.toDataURL('image/jpeg', 0.75);

    pushCapturedPhoto(dataUrl, thumbUrl);

    if (navigator.vibrate) navigator.vibrate(30);
    showToast('Đã lưu vào lịch sử.');
}

function runCountdownCapture() {
    if (countdownActive) return;
    if (!countdownDuration || countdownDuration <= 0) {
        saveCurrentFrame();
        return;
    }
    countdownActive = true;
    let remaining = countdownDuration;
    const showNumber = value => {
        countdownOverlayEl.textContent = String(value);
        countdownOverlayEl.classList.remove('pulse');
        void countdownOverlayEl.offsetWidth;
        countdownOverlayEl.classList.add('pulse');
    };
    countdownOverlayEl.classList.add('visible');
    showNumber(remaining);
    const tick = () => {
        remaining -= 1;
        if (remaining > 0) {
            showNumber(remaining);
            setTimeout(tick, 1000);
        } else {
            countdownOverlayEl.classList.remove('visible', 'pulse');
            countdownActive = false;
            saveCurrentFrame();
        }
    };
    setTimeout(tick, 1000);
}

async function handleHistoryUpload(file) {
    if (!file) return;
    try {
        const bitmap = await createImageBitmap(file);
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const cvs = document.createElement('canvas');
        cvs.width = w;
        cvs.height = h;
        const c = cvs.getContext('2d');
        c.imageSmoothingQuality = 'high';
        c.drawImage(bitmap, 0, 0, w, h);
        const dataUrl = cvs.toDataURL('image/jpeg', 0.88);

        const thumbScale = Math.min(1, HISTORY_THUMB_MAX / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * thumbScale));
        const th = Math.max(1, Math.round(h * thumbScale));
        const tcvs = document.createElement('canvas');
        tcvs.width = tw;
        tcvs.height = th;
        tcvs.getContext('2d').drawImage(cvs, 0, 0, tw, th);
        const thumbUrl = tcvs.toDataURL('image/jpeg', 0.75);

        if (bitmap.close) bitmap.close();
        pushCapturedPhoto(dataUrl, thumbUrl);
        showToast('Đã thêm ảnh!');
    } catch (error) {
        showToast('Không đọc được ảnh.', 2400);
    }
}

async function addCustomUploadSticker(file) {
    if (!file) return;
    try {
        const bitmap = await createImageBitmap(file);

        const raw = document.createElement('canvas');
        raw.width = bitmap.width;
        raw.height = bitmap.height;
        raw.getContext('2d').drawImage(bitmap, 0, 0);
        const dataUrl = raw.toDataURL('image/png');

        const longestSide = Math.max(bitmap.width, bitmap.height);
        const fitRatio = 320 / Math.max(1, longestSide);
        const sticker = {
            id: `user-sticker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label: file.name || 'Ảnh upload',
            src: dataUrl,
            kind: 'image',
            width: Math.round(bitmap.width * fitRatio),
            height: Math.round(bitmap.height * fitRatio),
            x: editorCanvasEl.width / 2,
            y: editorCanvasEl.height / 2,
            scale: 1,
            rotation: 0,
            flipX: 1,
            flipY: 1
        };
        const surface = createStickerRenderSurface(bitmap, sticker.width, sticker.height);
        sticker.renderCanvas = surface.renderCanvas;
        sticker.renderCtx = surface.renderCtx;

        editorState.activeStickers.push(sticker);
        editorState.selectedStickerId = sticker.id;
        syncStickerControls();
        renderEditorCanvas();
        pushEditorHistory();
        showToast('Đã thêm ảnh vào editor.');
    } catch (error) {
        showToast('Không đọc được ảnh.', 2400);
    }
}

async function shareCurrentFrame(photo) {
    try {
        const dataUrl = photo.renderedDataUrl || photo.dataUrl;
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `${photo.id}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: '3D Glass', text: photo.label });
        } else if (navigator.share) {
            await navigator.share({ title: '3D Glass', text: photo.label, url: dataUrl });
        } else {
            showToast('Thiết bị không hỗ trợ chia sẻ.', 2600);
        }
    } catch (error) {
        if (error && error.name !== 'AbortError') {
            showToast('Không thể chia sẻ ảnh.', 2400);
        }
    }
}
