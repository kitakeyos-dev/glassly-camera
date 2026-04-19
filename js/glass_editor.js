// Glass-shape photo editor.
//
// Repurposes the freshly-frozen glass shape as a clip mask: the user can
// pick a photo from their history (or upload one), drag / pinch-zoom it
// inside the glass, then save the composition as a brand new capture.
// The outer area keeps the original frozen background (with all the beauty
// / LUT work baked in) and the glass stays styled with the current palette
// so the saved image looks like the camera captured the picked photo
// through the glass in one shot.

const glassEditorState = {
    isOpen: false,
    glass: null,
    backgroundCanvas: null,
    // Whichever camera produced the frozen frame. Front-camera captures
    // have the "mirror selfie" flip baked into their bitmap by
    // saveCurrentFrame(), so picked photos need to be drawn back through
    // the same flip to sit in the same coordinate space as the raw
    // frozenCanvas background.
    frozenFacingMode: 'user',
    innerPhoto: null,          // { image, id, label }
    innerX: 0,
    innerY: 0,
    innerScale: 1,
    // Pointer tracking for drag + pinch.
    pointers: new Map(),
    dragOffsetX: 0,
    dragOffsetY: 0,
    pinchInitialDist: 0,
    pinchInitialScale: 1
};

// Bounding box of the glass shape in canvas coordinates, used to compute
// the initial "cover" scale of a newly-loaded photo.
function getGlassBoundingBox(glass) {
    if (glass.type === 'triangle') {
        const xs = [glass.p1.x, glass.p2.x, glass.p3.x];
        const ys = [glass.p1.y, glass.p2.y, glass.p3.y];
        return {
            x: Math.min(...xs), y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys)
        };
    }
    if (glass.type === 'quad') {
        const xs = [glass.tl.x, glass.tr.x, glass.br.x, glass.bl.x];
        const ys = [glass.tl.y, glass.tr.y, glass.br.y, glass.bl.y];
        return {
            x: Math.min(...xs), y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys)
        };
    }
    if (glass.type === 'circle') {
        // Ellipse w/ rotation — use the AABB of the rotated rect.
        const cos = Math.abs(Math.cos(glass.angle || 0));
        const sin = Math.abs(Math.sin(glass.angle || 0));
        const halfW = glass.rx * cos + glass.ry * sin;
        const halfH = glass.rx * sin + glass.ry * cos;
        return { x: glass.cx - halfW, y: glass.cy - halfH, w: halfW * 2, h: halfH * 2 };
    }
    if (glass.type === 'heart') {
        const hw = glass.rx * 1.2;
        const hh = glass.ry * 1.15;
        return { x: glass.cx - hw, y: glass.cy - hh, w: hw * 2, h: hh * 2 };
    }
    return { x: 0, y: 0, w: glassEditorCanvasEl.width, h: glassEditorCanvasEl.height };
}

function loadImageFromSrc(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function renderGlassEditorPicker() {
    // Build the photo thumbnail list (history photos only — upload button
    // is a sibling, not part of this list so it always stays in view).
    if (!glassEditorPickerListEl) return;
    const activeId = glassEditorState.innerPhoto && glassEditorState.innerPhoto.id;
    if (!capturedPhotos.length) {
        glassEditorPickerListEl.innerHTML = '<div class="glass-editor-picker-empty">Chưa có ảnh trong lịch sử.</div>';
        return;
    }
    glassEditorPickerListEl.innerHTML = capturedPhotos.map(photo => {
        const thumb = photo.thumbUrl || photo.renderedDataUrl || photo.dataUrl;
        const isActive = photo.id === activeId;
        return `
            <button class="glass-editor-picker-item${isActive ? ' active' : ''}" type="button" data-photo-id="${photo.id}">
                <img src="${thumb}" alt="${photo.label || ''}">
            </button>
        `;
    }).join('');
}

async function setGlassEditorInnerPhoto(photo) {
    if (!photo) return;
    try {
        const src = photo.renderedDataUrl || photo.dataUrl;
        const image = await loadImageFromSrc(src);
        glassEditorState.innerPhoto = {
            image,
            id: photo.id,
            label: photo.label || ''
        };
        // Cover-fit the image to the glass bounding box so it fills the clip
        // area on first load. User can then pinch / wheel to zoom and drag to
        // reposition.
        const bbox = getGlassBoundingBox(glassEditorState.glass);
        const scaleX = bbox.w / image.naturalWidth;
        const scaleY = bbox.h / image.naturalHeight;
        glassEditorState.innerScale = Math.max(scaleX, scaleY) * 1.05;
        glassEditorState.innerX = glassEditorState.glass.cx;
        glassEditorState.innerY = glassEditorState.glass.cy;
        renderGlassEditorPicker();
        renderGlassEditor();
    } catch (_) {
        showToast('Không tải được ảnh.', 2200);
    }
}

async function setGlassEditorInnerFromFile(file) {
    if (!file) return;
    try {
        const bitmap = await createImageBitmap(file);
        // Draw the bitmap into a canvas-backed image so we can reuse the
        // same rendering code path as history photos.
        const tmp = document.createElement('canvas');
        tmp.width = bitmap.width;
        tmp.height = bitmap.height;
        tmp.getContext('2d').drawImage(bitmap, 0, 0);
        if (bitmap.close) bitmap.close();
        const image = await loadImageFromSrc(tmp.toDataURL('image/jpeg', 0.9));
        glassEditorState.innerPhoto = {
            image,
            id: `upload-${Date.now()}`,
            label: file.name || 'Ảnh tải lên'
        };
        const bbox = getGlassBoundingBox(glassEditorState.glass);
        const scaleX = bbox.w / image.naturalWidth;
        const scaleY = bbox.h / image.naturalHeight;
        glassEditorState.innerScale = Math.max(scaleX, scaleY) * 1.05;
        glassEditorState.innerX = glassEditorState.glass.cx;
        glassEditorState.innerY = glassEditorState.glass.cy;
        renderGlassEditorPicker();
        renderGlassEditor();
    } catch (_) {
        showToast('Không đọc được ảnh.', 2200);
    }
}

function drawGlassEditorScene(targetCtx, dimOutside) {
    if (!glassEditorState.isOpen || !glassEditorState.glass) return;
    const w = glassEditorCanvasEl.width;
    const h = glassEditorCanvasEl.height;
    const glass = glassEditorState.glass;
    const palette = GLASS_PALETTE_BY_ID.get(currentGlassPalette) || GLASS_PALETTES[0];

    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.clearRect(0, 0, w, h);

    // Background = the frozen camera frame we snapshotted at openGlassEditor.
    targetCtx.drawImage(glassEditorState.backgroundCanvas, 0, 0, w, h);
    if (dimOutside) {
        targetCtx.fillStyle = 'rgba(5, 8, 18, 0.55)';
        targetCtx.fillRect(0, 0, w, h);
    }

    // Inside the glass clip, draw the original background again so the
    // interior is bright regardless of the dim overlay, then overlay the
    // user's picked photo on top at its current transform.
    targetCtx.save();
    buildPath(glass, targetCtx);
    targetCtx.clip();
    targetCtx.drawImage(glassEditorState.backgroundCanvas, 0, 0, w, h);

    if (glassEditorState.innerPhoto) {
        targetCtx.translate(glassEditorState.innerX, glassEditorState.innerY);
        targetCtx.scale(glassEditorState.innerScale, glassEditorState.innerScale);
        // saveCurrentFrame flips captures from the front camera so the
        // history thumbnail matches the mirrored live preview. Undo that
        // flip here so the picked photo sits in the same raw orientation
        // as the frozenCanvas background we composite it onto.
        if (glassEditorState.frozenFacingMode === 'user') {
            targetCtx.scale(-1, 1);
        }
        const img = glassEditorState.innerPhoto.image;
        targetCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    } else if (dimOutside) {
        // Placeholder hint — only in interactive render, never in export.
        targetCtx.setTransform(1, 0, 0, 1, 0, 0);
        buildPath(glass, targetCtx);
        targetCtx.clip();
        targetCtx.fillStyle = 'rgba(255,255,255,0.12)';
        targetCtx.fillRect(0, 0, w, h);
        targetCtx.fillStyle = '#fff';
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'middle';
        targetCtx.font = '600 32px "Be Vietnam Pro", system-ui, sans-serif';
        // When the canvas itself is CSS-mirrored, the placeholder text
        // would otherwise render backwards — flip it in the bitmap so
        // the two transforms cancel and the string reads correctly.
        const canvasMirrored = glassEditorCanvasEl.classList.contains('mirrored');
        if (canvasMirrored) {
            targetCtx.save();
            targetCtx.translate(glass.cx, 0);
            targetCtx.scale(-1, 1);
            targetCtx.fillText('Chọn ảnh bên dưới', 0, glass.cy);
            targetCtx.restore();
        } else {
            targetCtx.fillText('Chọn ảnh bên dưới', glass.cx, glass.cy);
        }
    }
    targetCtx.restore();

    // Glass shimmer
    targetCtx.save();
    buildPath(glass, targetCtx);
    targetCtx.clip();
    const shimmer = targetCtx.createLinearGradient(
        glass.cx - 150, glass.cy - 150,
        glass.cx + 150, glass.cy + 150
    );
    shimmer.addColorStop(0, palette.shimmer[0]);
    shimmer.addColorStop(0.4, palette.shimmer[1]);
    shimmer.addColorStop(0.7, palette.shimmer[2]);
    shimmer.addColorStop(1, palette.shimmer[3]);
    targetCtx.fillStyle = shimmer;
    targetCtx.fill();
    targetCtx.restore();

    // Glass border + bevel.
    targetCtx.save();
    buildPath(glass, targetCtx);
    const bevel = targetCtx.createLinearGradient(
        glass.cx - 120, glass.cy - 120,
        glass.cx + 120, glass.cy + 120
    );
    bevel.addColorStop(0, palette.bevel[0]);
    bevel.addColorStop(0.45, palette.bevel[1]);
    bevel.addColorStop(1, palette.bevel[2]);
    targetCtx.lineWidth = 9;
    targetCtx.strokeStyle = bevel;
    targetCtx.stroke();

    buildPath(glass, targetCtx);
    targetCtx.lineWidth = 2;
    targetCtx.strokeStyle = palette.stroke;
    targetCtx.stroke();
    targetCtx.restore();
}

function renderGlassEditor() {
    drawGlassEditorScene(glassEditorCtx, true);
}

async function openGlassEditor() {
    if (!frozenGlass) {
        showToast('Chưa có khung kính. Hãy tạo khung bằng cử chỉ trước.', 2400);
        return;
    }

    // Snapshot glass + frozen background so the main camera loop can keep
    // living once it restarts without corrupting the editor state.
    glassEditorState.glass = JSON.parse(JSON.stringify(frozenGlass));
    glassEditorState.frozenFacingMode = currentFacingMode;
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = frozenCanvas.width;
    bgCanvas.height = frozenCanvas.height;
    bgCanvas.getContext('2d').drawImage(frozenCanvas, 0, 0);
    glassEditorState.backgroundCanvas = bgCanvas;

    glassEditorState.innerPhoto = null;
    glassEditorState.innerX = glassEditorState.glass.cx;
    glassEditorState.innerY = glassEditorState.glass.cy;
    glassEditorState.innerScale = 1;
    glassEditorState.pointers.clear();

    glassEditorCanvasEl.width = frozenCanvas.width;
    glassEditorCanvasEl.height = frozenCanvas.height;
    // Mirror the canvas display for front-camera captures so the editor
    // matches the "selfie" orientation the user saw in the live preview.
    // The inner drawing stays in raw sensor coordinates; the inserted
    // photo + placeholder text get counter-flipped inline so they still
    // read correctly after the CSS mirror is applied.
    glassEditorCanvasEl.classList.toggle(
        'mirrored',
        glassEditorState.frozenFacingMode === 'user'
    );
    glassEditorState.isOpen = true;

    stopCamera();

    glassEditorEl.classList.add('visible');
    glassEditorEl.setAttribute('aria-hidden', 'false');

    renderGlassEditorPicker();
    renderGlassEditor();
}

function closeGlassEditor() {
    if (!glassEditorState.isOpen) return;
    glassEditorState.isOpen = false;
    glassEditorState.innerPhoto = null;
    glassEditorState.backgroundCanvas = null;
    glassEditorState.glass = null;
    glassEditorState.pointers.clear();
    glassEditorCanvasEl.classList.remove('mirrored');
    glassEditorEl.classList.remove('visible');
    glassEditorEl.setAttribute('aria-hidden', 'true');
    startCamera().catch(() => {});
}

async function saveGlassEditorCapture() {
    if (!glassEditorState.isOpen) return;
    if (!glassEditorState.innerPhoto) {
        showToast('Chọn ảnh trước đã.', 2200);
        return;
    }
    // Export render without the dim overlay so the saved image is clean.
    drawGlassEditorScene(glassEditorCtx, false);

    const w = glassEditorCanvasEl.width;
    const h = glassEditorCanvasEl.height;

    // When the canvas is CSS-mirrored the user's viewport shows a flipped
    // image but the bitmap still contains raw pixels. Mirror once into a
    // staging canvas so the exported JPEG matches what they were looking
    // at — and lines up with every other front-camera capture in the
    // gallery (which are all saved pre-flipped by saveCurrentFrame).
    let exportCanvas = glassEditorCanvasEl;
    if (glassEditorCanvasEl.classList.contains('mirrored')) {
        const mirror = document.createElement('canvas');
        mirror.width = w;
        mirror.height = h;
        const mCtx = mirror.getContext('2d');
        mCtx.translate(w, 0);
        mCtx.scale(-1, 1);
        mCtx.drawImage(glassEditorCanvasEl, 0, 0);
        exportCanvas = mirror;
    }

    const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.9);

    const thumbScale = Math.min(1, 320 / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * thumbScale));
    const th = Math.max(1, Math.round(h * thumbScale));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = tw;
    thumbCanvas.height = th;
    thumbCanvas.getContext('2d').drawImage(exportCanvas, 0, 0, tw, th);
    const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.78);

    pushCapturedPhoto(dataUrl, thumbUrl);
    if (navigator.vibrate) navigator.vibrate(30);
    showToast('Đã lưu vào lịch sử.');

    // Clear the frozen glass so the user can frame a new shape afterwards.
    frozenGlass = null;
    activeGlass = null;
    lastPos = null;
    snapTimer = 0;
    isCooldown = false;
    updateGestureTag(null);

    closeGlassEditor();
}

function glassEditorClientToCanvas(event) {
    const rect = glassEditorCanvasEl.getBoundingClientRect();
    let x = (event.clientX - rect.left) * (glassEditorCanvasEl.width / rect.width);
    const y = (event.clientY - rect.top) * (glassEditorCanvasEl.height / rect.height);
    // With CSS transform: scaleX(-1) the display pixels run right-to-left
    // relative to the bitmap, so a drag at display x=100 actually wants
    // bitmap x = (width - 100).
    if (glassEditorCanvasEl.classList.contains('mirrored')) {
        x = glassEditorCanvasEl.width - x;
    }
    return { x, y };
}
