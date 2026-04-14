// Editor overlay, stickers, drag/eraser logic

function getEditorSelectedSticker() {
    return editorState.activeStickers.find(sticker => sticker.id === editorState.selectedStickerId) || null;
}

// Serialize the reversible parts of editorState into a plain object.
function snapshotEditorState() {
    return {
        selectedPhotoIds: [...editorState.selectedPhotoIds],
        collageLayout: editorState.collageLayout,
        frameStyle: editorState.frameStyle,
        activeStickers: editorState.activeStickers.map(s => ({
            id: s.id,
            label: s.label,
            src: s.src,
            kind: s.kind || 'image',
            textContent: s.textContent,
            textFontId: s.textFontId,
            textFontSize: s.textFontSize,
            textColor: s.textColor,
            width: s.width,
            height: s.height,
            x: s.x,
            y: s.y,
            scale: s.scale,
            rotation: s.rotation,
            flipX: s.flipX,
            flipY: s.flipY,
            renderCanvasData: s.renderCanvas ? s.renderCanvas.toDataURL('image/png') : null
        })),
        selectedStickerId: editorState.selectedStickerId
    };
}

function pushEditorHistory() {
    if (!editorState.isOpen) return;
    // Drop any forward history when a new action branches off.
    editorState.historyStack.length = editorState.historyIndex + 1;
    editorState.historyStack.push(snapshotEditorState());
    if (editorState.historyStack.length > EDITOR_HISTORY_MAX) {
        editorState.historyStack.shift();
    }
    editorState.historyIndex = editorState.historyStack.length - 1;
    updateHistoryButtons();
}

async function restoreEditorSnapshot(snapshot) {
    editorState.selectedPhotoIds = [...snapshot.selectedPhotoIds];
    editorState.collageLayout = snapshot.collageLayout;
    editorState.frameStyle = snapshot.frameStyle;

    editorState.activeStickers = await Promise.all(snapshot.activeStickers.map(async data => {
        const sticker = {
            id: data.id,
            label: data.label,
            src: data.src,
            kind: data.kind || 'image',
            textContent: data.textContent,
            textFontId: data.textFontId,
            textFontSize: data.textFontSize,
            textColor: data.textColor,
            width: data.width,
            height: data.height,
            x: data.x,
            y: data.y,
            scale: data.scale,
            rotation: data.rotation,
            flipX: data.flipX,
            flipY: data.flipY
        };
        if (data.renderCanvasData) {
            try {
                const img = await loadImageCached(data.renderCanvasData);
                const surface = createStickerRenderSurface(img, data.width, data.height);
                sticker.renderCanvas = surface.renderCanvas;
                sticker.renderCtx = surface.renderCtx;
            } catch (e) {
                if (sticker.kind === 'text' && data.textContent) {
                    const fontDef = TEXT_FONTS.find(f => f.id === data.textFontId) || TEXT_FONTS[0];
                    const surface = createTextRenderCanvas(data.textContent, data.textFontSize, fontDef.css, data.textColor);
                    sticker.renderCanvas = surface.canvas;
                    sticker.renderCtx = surface.canvas.getContext('2d');
                } else if (data.src) {
                    const fallback = await loadImageCached(data.src);
                    const surface = createStickerRenderSurface(fallback, data.width, data.height);
                    sticker.renderCanvas = surface.renderCanvas;
                    sticker.renderCtx = surface.renderCtx;
                }
            }
        }
        return sticker;
    }));

    editorState.selectedStickerId = snapshot.selectedStickerId || null;
    editorState.dragStickerId = null;
    editorState.erasingStickerId = null;
    editorState.eraseLastPoint = null;
    editorState.eraserEnabled = false;

    renderEditorPanels();
    renderEditorCanvas();
}

function canEditorUndo() { return editorState.historyIndex > 0; }
function canEditorRedo() { return editorState.historyIndex < editorState.historyStack.length - 1; }

function updateHistoryButtons() {
    if (!editorUndoBtnEl || !editorRedoBtnEl) return;
    editorUndoBtnEl.disabled = !canEditorUndo();
    editorRedoBtnEl.disabled = !canEditorRedo();
}

async function editorUndo() {
    if (!canEditorUndo()) return;
    editorState.historyIndex -= 1;
    await restoreEditorSnapshot(editorState.historyStack[editorState.historyIndex]);
    updateHistoryButtons();
}

async function editorRedo() {
    if (!canEditorRedo()) return;
    editorState.historyIndex += 1;
    await restoreEditorSnapshot(editorState.historyStack[editorState.historyIndex]);
    updateHistoryButtons();
}

function createStickerRenderSurface(img, width, height) {
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = Math.max(1, Math.round(width));
    renderCanvas.height = Math.max(1, Math.round(height));
    const renderCtx = renderCanvas.getContext('2d', { willReadFrequently: true });
    renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
    renderCtx.drawImage(img, 0, 0, renderCanvas.width, renderCanvas.height);
    return { renderCanvas, renderCtx };
}

function getStickerCanvasCoordinates(sticker, stageX, stageY) {
    const dx = stageX - sticker.x;
    const dy = stageY - sticker.y;
    const cos = Math.cos(-sticker.rotation);
    const sin = Math.sin(-sticker.rotation);
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;
    const scaledX = rotatedX / (sticker.scale * sticker.flipX);
    const scaledY = rotatedY / (sticker.scale * sticker.flipY);
    const canvasX = scaledX + sticker.width / 2;
    const canvasY = scaledY + sticker.height / 2;
    return {
        canvasX,
        canvasY,
        inside: canvasX >= 0 && canvasX <= sticker.width && canvasY >= 0 && canvasY <= sticker.height
    };
}

function isStickerPixelVisible(sticker, canvasX, canvasY) {
    if (!sticker.renderCtx || !sticker.renderCanvas) return true;
    const px = Math.max(0, Math.min(sticker.renderCanvas.width - 1, Math.floor(canvasX)));
    const py = Math.max(0, Math.min(sticker.renderCanvas.height - 1, Math.floor(canvasY)));
    return sticker.renderCtx.getImageData(px, py, 1, 1).data[3] > 8;
}

function eraseStickerStroke(sticker, fromStagePoint, toStagePoint) {
    if (!sticker?.renderCtx) return;
    const from = getStickerCanvasCoordinates(sticker, fromStagePoint.x, fromStagePoint.y);
    const to = getStickerCanvasCoordinates(sticker, toStagePoint.x, toStagePoint.y);
    const brushRadius = editorState.eraserRadius / Math.max(0.01, sticker.scale);

    sticker.renderCtx.save();
    sticker.renderCtx.globalCompositeOperation = 'destination-out';
    sticker.renderCtx.lineCap = 'round';
    sticker.renderCtx.lineJoin = 'round';
    sticker.renderCtx.lineWidth = brushRadius * 2;
    sticker.renderCtx.beginPath();
    sticker.renderCtx.moveTo(from.canvasX, from.canvasY);
    sticker.renderCtx.lineTo(to.canvasX, to.canvasY);
    sticker.renderCtx.stroke();
    sticker.renderCtx.beginPath();
    sticker.renderCtx.arc(to.canvasX, to.canvasY, brushRadius, 0, Math.PI * 2);
    sticker.renderCtx.fill();
    sticker.renderCtx.restore();
}

function updateEraserCursor(point) {
    if (!editorState.eraserEnabled || !point) {
        editorState.eraserCursorVisible = false;
        return;
    }

    editorState.eraserCursorVisible = true;
    editorState.eraserCursorX = point.x;
    editorState.eraserCursorY = point.y;
}

function drawEraserCursor(targetCtx) {
    if (!editorState.eraserEnabled || !editorState.eraserCursorVisible) return;

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.arc(editorState.eraserCursorX, editorState.eraserCursorY, editorState.eraserRadius, 0, Math.PI * 2);
    targetCtx.fillStyle = 'rgba(255,255,255,0.12)';
    targetCtx.fill();
    targetCtx.lineWidth = 2;
    targetCtx.strokeStyle = 'rgba(255,255,255,0.98)';
    targetCtx.shadowColor = 'rgba(15,23,42,0.35)';
    targetCtx.shadowBlur = 6;
    targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.arc(editorState.eraserCursorX, editorState.eraserCursorY, 2.5, 0, Math.PI * 2);
    targetCtx.fillStyle = 'rgba(34,197,94,0.96)';
    targetCtx.fill();
    targetCtx.restore();
}

function getEditorSelectedPhotos() {
    return editorState.selectedPhotoIds
        .map(photoId => capturedPhotos.find(photo => photo.id === photoId))
        .filter(Boolean);
}

function renderEditorTabs() {
    editorTabButtons.forEach(btn => {
        const id = btn.dataset.editorTab;
        const tab = EDITOR_TABS.find(t => t.id === id);
        if (!tab) return;
        btn.innerHTML = `${icons[tab.icon]}<span>${tab.label}</span>`;
    });
}

function renderStickerToolbar() {
    stickerToolbarEl.innerHTML = STICKER_TOOLBAR_ACTIONS.map(action => `
        <button class="sticker-tool-btn${action.danger ? ' danger' : ''}" type="button" data-sticker-action="${action.id}" aria-label="${action.label}">
            ${icons[action.icon]}
        </button>
    `).join('');
}

function openEditorTab(tabId) {
    const tab = EDITOR_TABS.find(t => t.id === tabId);
    if (!tab) return;
    if (editorState.activeTab === tabId && editorBottomSheetEl.classList.contains('visible')) {
        closeEditorSheet();
        return;
    }
    editorState.activeTab = tabId;
    editorTabButtons.forEach(btn => {
        const isActive = btn.dataset.editorTab === tabId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
    });
    editorTabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.dataset.panel === tabId);
    });
    if (bottomSheetTitleEl) bottomSheetTitleEl.textContent = tab.title;
    editorBottomSheetEl.classList.add('visible');
    editorBottomSheetEl.setAttribute('aria-hidden', 'false');
}

function closeEditorSheet() {
    editorState.activeTab = null;
    editorBottomSheetEl.classList.remove('visible');
    editorBottomSheetEl.setAttribute('aria-hidden', 'true');
    editorTabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
}

function handleStickerToolbarAction(actionId) {
    const sticker = getEditorSelectedSticker();
    if (!sticker) return;
    switch (actionId) {
        case 'scale-down':
            sticker.scale = clamp(sticker.scale * 0.9, 0.3, 3);
            break;
        case 'scale-up':
            sticker.scale = clamp(sticker.scale * 1.1, 0.3, 3);
            break;
        case 'rotate-left':
            sticker.rotation -= 15 * Math.PI / 180;
            break;
        case 'rotate-right':
            sticker.rotation += 15 * Math.PI / 180;
            break;
        case 'flip-x':
            sticker.flipX *= -1;
            break;
        case 'flip-y':
            sticker.flipY *= -1;
            break;
        case 'eraser':
            editorState.eraserEnabled = !editorState.eraserEnabled;
            editorState.dragStickerId = null;
            editorState.erasingStickerId = null;
            editorState.eraseLastPoint = null;
            editorState.eraserCursorVisible = false;
            editorCanvasEl.classList.remove('dragging');
            break;
        case 'delete':
            editorState.activeStickers = editorState.activeStickers.filter(s => s.id !== sticker.id);
            editorState.selectedStickerId = null;
            break;
    }
    syncStickerControls();
    renderEditorCanvas();
    pushEditorHistory();
}

function syncStickerControls() {
    const sticker = getEditorSelectedSticker();

    if (!sticker) {
        editorState.eraserEnabled = false;
        editorState.erasingStickerId = null;
        editorState.eraseLastPoint = null;
        editorState.eraserCursorVisible = false;
        stickerToolbarEl.classList.remove('visible');
        stickerToolbarEl.setAttribute('aria-hidden', 'true');
        editorCanvasEl.classList.remove('eraser-active');
        if (editorSelectionNoteEl) editorSelectionNoteEl.classList.remove('hidden');
        return;
    }

    stickerToolbarEl.classList.add('visible');
    stickerToolbarEl.setAttribute('aria-hidden', 'false');
    stickerToolbarEl.querySelectorAll('[data-sticker-action="eraser"]').forEach(btn => {
        btn.classList.toggle('active', !!editorState.eraserEnabled);
    });
    editorCanvasEl.classList.toggle('eraser-active', !!editorState.eraserEnabled);
    if (editorSelectionNoteEl) editorSelectionNoteEl.classList.add('hidden');
}

function renderEditorLayoutOptions() {
    editorLayoutOptionsEl.innerHTML = COLLAGE_LAYOUTS.map(layout => `
        <button class="editor-option${layout.id === editorState.collageLayout ? ' selected' : ''}" type="button" data-layout-id="${layout.id}">
            <strong>${layout.label}</strong>
            <span>${layout.hint}</span>
        </button>
    `).join('');
}

function renderEditorFrameOptions() {
    editorFrameOptionsEl.innerHTML = FRAME_STYLES.map(frame => `
        <button class="editor-option${frame.id === editorState.frameStyle ? ' selected' : ''}" type="button" data-frame-id="${frame.id}">
            <strong>${frame.label}</strong>
            <span>${frame.hint}</span>
        </button>
    `).join('');
}

function renderEditorPhotoPicker() {
    if (!capturedPhotos.length) {
        editorPhotoPickerEl.innerHTML = '<div class="editor-empty">Chưa có ảnh nào để ghép.</div>';
        return;
    }

    editorPhotoPickerEl.innerHTML = capturedPhotos.map(photo => `
        <button class="editor-photo-chip${editorState.selectedPhotoIds.includes(photo.id) ? ' selected' : ''}" type="button" data-photo-id="${photo.id}">
            <img src="${photo.thumbUrl || photo.dataUrl}" alt="${photo.label}">
            <div class="editor-photo-chip-meta">
                <strong>${photo.label}</strong>
                <span>${formatCaptureTime(photo.createdAt)}</span>
            </div>
        </button>
    `).join('');
}

function renderStickerLibrary() {
    const keyword = editorState.stickerSearch.trim().toLowerCase();
    const filtered = STICKER_LIBRARY.filter(sticker => {
        if (!keyword) return true;
        return sticker.label.toLowerCase().includes(keyword) || sticker.name.toLowerCase().includes(keyword);
    });

    if (!filtered.length) {
        stickerListEl.innerHTML = '<div class="editor-empty">Không tìm thấy sticker phù hợp.</div>';
        return;
    }

    stickerListEl.innerHTML = filtered.map(sticker => `
        <button class="sticker-item" type="button" data-sticker-id="${sticker.id}">
            <img src="${sticker.src}" alt="${sticker.label}">
            <span>${sticker.label}</span>
        </button>
    `).join('');
}

function renderTextPanelStatic() {
    if (!textFontSelectEl || textFontSelectEl.options.length) return;
    textFontSelectEl.innerHTML = TEXT_FONTS.map(f =>
        `<option value="${f.id}">${f.label}</option>`
    ).join('');
    textColorRowEl.innerHTML = TEXT_PRESET_COLORS.map((c, i) =>
        `<button type="button" class="text-color-swatch${i === 0 ? ' active' : ''}" data-color="${c}" style="background:${c}" aria-label="Mau ${c}"></button>`
    ).join('');
}

function renderEditorPanels() {
    renderEditorTabs();
    renderStickerToolbar();
    renderEditorLayoutOptions();
    renderEditorFrameOptions();
    renderEditorPhotoPicker();
    renderStickerLibrary();
    renderTextPanelStatic();
    syncStickerControls();
}

function closeEditor() {
    if (!editorState.isOpen) return;
    closeEditorSheet();
    editorOverlayEl.classList.remove('visible');
    editorOverlayEl.setAttribute('aria-hidden', 'true');
    editorState.isOpen = false;
    editorState.dragStickerId = null;
    editorState.eraserEnabled = false;
    editorState.erasingStickerId = null;
    editorState.eraseLastPoint = null;
    editorState.eraserCursorVisible = false;
    editorCanvasEl.classList.remove('dragging');
    editorCanvasEl.classList.remove('eraser-active');
    stickerToolbarEl.classList.remove('visible');
    currentMode = 'glasses';
    startCamera().catch(() => {});
}

async function openEditorFromHistory() {
    const editorPhotos = getHistoryPhotosForEditor();
    if (!editorPhotos.length) {
        showToast('Hãy chọn một ảnh trong lịch sử trước.', 2200);
        return;
    }

    closeHistoryDrawer();
    stopCamera();
    editorState.isOpen = true;
    currentMode = 'editor';

    const primary = editorPhotos[0];
    const existingSnap = primary && primary.editorSnapshot;

    if (existingSnap) {
        await applySnapshotToState(existingSnap);
    } else {
        editorState.selectedPhotoIds = editorPhotos.map(photo => photo.id);
        editorState.collageLayout =
            editorPhotos.length >= 3 ? 'grid' :
            editorPhotos.length === 2 ? 'split-v' :
            'single';
        editorState.frameStyle = 'classic';
        editorState.activeStickers = [];
    }

    editorState.selectedStickerId = null;
    editorState.stickerSearch = '';
    editorState.dragStickerId = null;
    editorState.eraserEnabled = false;
    editorState.erasingStickerId = null;
    editorState.eraseLastPoint = null;
    editorState.eraserCursorVisible = false;
    editorState.historyStack = [];
    editorState.historyIndex = -1;
    stickerSearchInputEl.value = '';

    editorOverlayEl.classList.add('visible');
    editorOverlayEl.setAttribute('aria-hidden', 'false');
    renderEditorPanels();
    renderEditorCanvas();
    pushEditorHistory();
}

function toggleEditorPhotoSelection(photoId) {
    const exists = editorState.selectedPhotoIds.includes(photoId);

    if (exists) {
        if (editorState.selectedPhotoIds.length === 1) {
            showToast('Editor cần giữ ít nhất 1 ảnh.', 2200);
            return;
        }
        editorState.selectedPhotoIds = editorState.selectedPhotoIds.filter(id => id !== photoId);
    } else {
        if (editorState.selectedPhotoIds.length >= 4) {
            showToast('Ghép ảnh tối đa 4 tấm ở bước này.', 2200);
            return;
        }
        editorState.selectedPhotoIds = [...editorState.selectedPhotoIds, photoId];
    }

    renderEditorPhotoPicker();
    renderEditorCanvas();
}

function createTextRenderCanvas(content, fontSize, fontFamily, color) {
    const padding = Math.round(fontSize * 0.25);
    const lines = content.split('\n');

    // Measure
    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d');
    mCtx.font = `700 ${fontSize}px ${fontFamily}`;
    let maxWidth = 0;
    lines.forEach(line => {
        const w = mCtx.measureText(line).width;
        if (w > maxWidth) maxWidth = w;
    });
    const lineHeight = Math.round(fontSize * 1.2);
    const width = Math.max(1, Math.round(maxWidth + padding * 2));
    const height = Math.max(1, lineHeight * lines.length + padding * 2);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    c.font = `700 ${fontSize}px ${fontFamily}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = color;
    // Subtle shadow for readability on any background
    c.shadowColor = 'rgba(0,0,0,0.45)';
    c.shadowBlur = Math.round(fontSize * 0.1);
    c.shadowOffsetY = Math.round(fontSize * 0.06);
    lines.forEach((line, i) => {
        const y = padding + lineHeight * (i + 0.5);
        c.fillText(line, width / 2, y);
    });

    return { canvas, width, height };
}

function addTextToEditor(content, options) {
    const text = content.trim();
    if (!text) return;
    const fontSize = options.fontSize || 96;
    const fontDef = TEXT_FONTS.find(f => f.id === options.fontId) || TEXT_FONTS[0];
    const color = options.color || '#ffffff';

    const surface = createTextRenderCanvas(text, fontSize, fontDef.css, color);
    const sticker = {
        id: `active-text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: text.length > 20 ? text.slice(0, 20) + '…' : text,
        src: '',
        kind: 'text',
        textContent: text,
        textFontId: fontDef.id,
        textFontSize: fontSize,
        textColor: color,
        width: surface.width,
        height: surface.height,
        x: editorCanvasEl.width / 2,
        y: editorCanvasEl.height / 2,
        scale: 1,
        rotation: 0,
        flipX: 1,
        flipY: 1,
        renderCanvas: surface.canvas,
        renderCtx: surface.canvas.getContext('2d')
    };

    editorState.activeStickers.push(sticker);
    editorState.selectedStickerId = sticker.id;
    syncStickerControls();
    renderEditorCanvas();
    pushEditorHistory();
}

async function addStickerToEditor(stickerId) {
    const definition = STICKER_LIBRARY.find(sticker => sticker.id === stickerId);
    if (!definition) return;

    const img = await loadImageCached(definition.src);
    const longestSide = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const fitRatio = 190 / Math.max(1, longestSide);
    const sticker = {
        id: `active-sticker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: definition.label,
        src: definition.src,
        width: Math.round((img.naturalWidth || img.width) * fitRatio),
        height: Math.round((img.naturalHeight || img.height) * fitRatio),
        x: editorCanvasEl.width / 2,
        y: editorCanvasEl.height / 2,
        scale: 1,
        rotation: 0,
        flipX: 1,
        flipY: 1
    };
    const renderSurface = createStickerRenderSurface(img, sticker.width, sticker.height);
    sticker.renderCanvas = renderSurface.renderCanvas;
    sticker.renderCtx = renderSurface.renderCtx;

    editorState.activeStickers.push(sticker);
    editorState.selectedStickerId = sticker.id;
    syncStickerControls();
    renderEditorCanvas();
    pushEditorHistory();
}

function getEditorCanvasPoint(event) {
    const rect = editorCanvasEl.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (editorCanvasEl.width / rect.width),
        y: (event.clientY - rect.top) * (editorCanvasEl.height / rect.height)
    };
}

function findStickerAtPoint(x, y) {
    for (let i = editorState.activeStickers.length - 1; i >= 0; i--) {
        const sticker = editorState.activeStickers[i];
        const localPoint = getStickerCanvasCoordinates(sticker, x, y);
        if (!localPoint.inside) continue;
        if (!isStickerPixelVisible(sticker, localPoint.canvasX, localPoint.canvasY)) continue;
        return sticker;
    }
    return null;
}

function getLayoutSlots(layoutId, count, width, height) {
    const outer = 58;
    const gap = 18;
    const full = { x: outer, y: outer, w: width - outer * 2, h: height - outer * 2 };

    if (count <= 1 || layoutId === 'single') return [full];

    if (layoutId === 'split-v') {
        const slotWidth = (full.w - gap) / 2;
        return [
            { x: full.x, y: full.y, w: slotWidth, h: full.h },
            { x: full.x + slotWidth + gap, y: full.y, w: slotWidth, h: full.h }
        ];
    }

    if (layoutId === 'split-h') {
        const slotHeight = (full.h - gap) / 2;
        return [
            { x: full.x, y: full.y, w: full.w, h: slotHeight },
            { x: full.x, y: full.y + slotHeight + gap, w: full.w, h: slotHeight }
        ];
    }

    if (count === 2) {
        const slotWidth = (full.w - gap) / 2;
        return [
            { x: full.x, y: full.y, w: slotWidth, h: full.h },
            { x: full.x + slotWidth + gap, y: full.y, w: slotWidth, h: full.h }
        ];
    }

    if (count === 3) {
        const topHeight = (full.h - gap) * 0.48;
        const bottomHeight = full.h - gap - topHeight;
        const topWidth = (full.w - gap) / 2;
        return [
            { x: full.x, y: full.y, w: topWidth, h: topHeight },
            { x: full.x + topWidth + gap, y: full.y, w: topWidth, h: topHeight },
            { x: full.x, y: full.y + topHeight + gap, w: full.w, h: bottomHeight }
        ];
    }

    const slotWidth = (full.w - gap) / 2;
    const slotHeight = (full.h - gap) / 2;
    return [
        { x: full.x, y: full.y, w: slotWidth, h: slotHeight },
        { x: full.x + slotWidth + gap, y: full.y, w: slotWidth, h: slotHeight },
        { x: full.x, y: full.y + slotHeight + gap, w: slotWidth, h: slotHeight },
        { x: full.x + slotWidth + gap, y: full.y + slotHeight + gap, w: slotWidth, h: slotHeight }
    ];
}

function drawImageCover(targetCtx, image, slot) {
    const coverScale = Math.max(slot.w / image.width, slot.h / image.height);
    const coverWidth = image.width * coverScale;
    const coverHeight = image.height * coverScale;
    const coverX = slot.x + (slot.w - coverWidth) / 2;
    const coverY = slot.y + (slot.h - coverHeight) / 2;
    const fitScale = Math.min(slot.w / image.width, slot.h / image.height);
    const fitWidth = image.width * fitScale;
    const fitHeight = image.height * fitScale;
    const fitX = slot.x + (slot.w - fitWidth) / 2;
    const fitY = slot.y + (slot.h - fitHeight) / 2;
    const radius = 18;

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.roundRect(slot.x, slot.y, slot.w, slot.h, radius);
    targetCtx.clip();
    targetCtx.fillStyle = '#edf2f7';
    targetCtx.fillRect(slot.x, slot.y, slot.w, slot.h);

    targetCtx.save();
    targetCtx.globalAlpha = 0.22;
    targetCtx.filter = 'blur(18px) saturate(1.05)';
    targetCtx.drawImage(image, coverX, coverY, coverWidth, coverHeight);
    targetCtx.restore();

    const glow = targetCtx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
    glow.addColorStop(0, 'rgba(255,255,255,0.38)');
    glow.addColorStop(1, 'rgba(255,255,255,0.08)');
    targetCtx.fillStyle = glow;
    targetCtx.fillRect(slot.x, slot.y, slot.w, slot.h);

    targetCtx.drawImage(image, fitX, fitY, fitWidth, fitHeight);
    targetCtx.strokeStyle = 'rgba(255,255,255,0.82)';
    targetCtx.lineWidth = 1.5;
    targetCtx.strokeRect(slot.x + 0.75, slot.y + 0.75, slot.w - 1.5, slot.h - 1.5);
    targetCtx.restore();
}

function drawEditorFrame(targetCtx, width, height, frameImage) {
    const inset = 22;

    if (editorState.frameStyle === 'none') return;

    if (frameImage) {
        targetCtx.drawImage(frameImage, 0, 0, width, height);
        return;
    }

    if (editorState.frameStyle === 'classic') {
        targetCtx.save();
        targetCtx.lineWidth = 18;
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.shadowColor = 'rgba(15,23,42,0.25)';
        targetCtx.shadowBlur = 14;
        targetCtx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        targetCtx.restore();
        return;
    }

    if (editorState.frameStyle === 'polaroid') {
        targetCtx.save();
        targetCtx.fillStyle = '#fff';
        targetCtx.fillRect(18, 18, width - 36, 26);
        targetCtx.fillRect(18, 18, 26, height - 36);
        targetCtx.fillRect(width - 44, 18, 26, height - 36);
        targetCtx.fillRect(18, height - 118, width - 36, 100);
        targetCtx.restore();
        return;
    }

    if (editorState.frameStyle === 'neon') {
        const gradient = targetCtx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#22d3ee');
        gradient.addColorStop(0.5, '#818cf8');
        gradient.addColorStop(1, '#f472b6');
        targetCtx.save();
        targetCtx.strokeStyle = gradient;
        targetCtx.lineWidth = 14;
        targetCtx.shadowColor = 'rgba(129,140,248,0.5)';
        targetCtx.shadowBlur = 16;
        targetCtx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        targetCtx.restore();
        return;
    }

    if (editorState.frameStyle === 'film') {
        targetCtx.save();
        targetCtx.fillStyle = '#121212';
        targetCtx.fillRect(16, 16, width - 32, 34);
        targetCtx.fillRect(16, height - 50, width - 32, 34);
        targetCtx.fillRect(16, 16, 34, height - 32);
        targetCtx.fillRect(width - 50, 16, 34, height - 32);
        targetCtx.fillStyle = '#fef08a';
        for (let y = 74; y < height - 74; y += 62) {
            targetCtx.fillRect(24, y, 14, 28);
            targetCtx.fillRect(width - 38, y, 14, 28);
        }
        targetCtx.restore();
    }
}

function drawSticker(targetCtx, sticker, image, includeSelection) {
    const source = sticker.renderCanvas || image;
    if (!source) return;
    targetCtx.save();
    targetCtx.translate(sticker.x, sticker.y);
    targetCtx.rotate(sticker.rotation);
    targetCtx.scale(sticker.scale * sticker.flipX, sticker.scale * sticker.flipY);
    targetCtx.drawImage(source, -sticker.width / 2, -sticker.height / 2, sticker.width, sticker.height);

    if (includeSelection && sticker.id === editorState.selectedStickerId) {
        targetCtx.strokeStyle = 'rgba(34,197,94,0.95)';
        targetCtx.lineWidth = 3 / sticker.scale;
        targetCtx.setLineDash([10 / sticker.scale, 8 / sticker.scale]);
        targetCtx.strokeRect(-sticker.width / 2 - 10 / sticker.scale, -sticker.height / 2 - 10 / sticker.scale, sticker.width + 20 / sticker.scale, sticker.height + 20 / sticker.scale);
        targetCtx.setLineDash([]);
    }

    targetCtx.restore();
}

async function renderEditorScene(targetCtx, targetCanvas, includeSelection, token = editorState.renderToken) {
    const width = targetCanvas.width;
    const height = targetCanvas.height;
    const selectedPhotos = getEditorSelectedPhotos();
    const frameDef = FRAME_STYLES.find(f => f.id === editorState.frameStyle);
    const [photoImages, stickerImagesRaw, frameImage] = await Promise.all([
        Promise.all(selectedPhotos.map(photo => loadImageCached(photo.dataUrl))),
        Promise.all(editorState.activeStickers.map(sticker =>
            sticker.kind === 'text' || !sticker.src
                ? Promise.resolve(null)
                : loadImageCached(sticker.src).catch(() => null)
        )),
        frameDef && frameDef.src ? loadImageCached(frameDef.src).catch(() => null) : Promise.resolve(null)
    ]);
    const stickerSnapshot = editorState.activeStickers.map(sticker => ({ ...sticker }));
    const stickerImages = stickerImagesRaw;

    if (targetCtx === editorCtx && token !== editorState.renderToken) {
        return false;
    }

    targetCtx.clearRect(0, 0, width, height);
    targetCtx.fillStyle = '#f8fafc';
    targetCtx.fillRect(0, 0, width, height);
    targetCtx.fillStyle = '#e2e8f0';
    targetCtx.fillRect(42, 42, width - 84, height - 84);

    if (!photoImages.length) {
        targetCtx.fillStyle = '#0f172a';
        targetCtx.font = '600 34px Segoe UI';
        targetCtx.textAlign = 'center';
        targetCtx.fillText('Chưa có ảnh để chỉnh sửa', width / 2, height / 2);
    } else {
        const slots = getLayoutSlots(editorState.collageLayout, photoImages.length, width, height);
        photoImages.slice(0, slots.length).forEach((image, index) => {
            drawImageCover(targetCtx, image, slots[index]);
        });
    }

    drawEditorFrame(targetCtx, width, height, frameImage);
    stickerSnapshot.forEach((sticker, index) => drawSticker(targetCtx, sticker, stickerImages[index], includeSelection));
    return true;
}

async function renderEditorCanvas() {
    if (!editorState.isOpen) return;
    const token = ++editorState.renderToken;
    const rendered = await renderEditorScene(editorCtx, editorCanvasEl, true, token);
    if (!rendered || token !== editorState.renderToken) return;
    syncStickerControls();
    drawEraserCursor(editorCtx);
}

async function saveEditorChanges() {
    if (!editorState.isOpen) return;
    if (!editorState.selectedPhotoIds.length) {
        showToast('Chưa có ảnh để lưu.', 2400);
        return;
    }
    const primaryId = editorState.selectedPhotoIds[0];
    const photo = capturedPhotos.find(p => p.id === primaryId);
    if (!photo) {
        showToast('Không tìm thấy ảnh gốc.', 2400);
        return;
    }
    // Render the current scene once and cache it as the preview + download source.
    await renderEditorScene(editorExportCtx, editorExportCanvas, false, -1);
    photo.renderedDataUrl = editorExportCanvas.toDataURL('image/jpeg', 0.92);
    photo.editorSnapshot = snapshotEditorState();
    showToast('Đã lưu chỉnh sửa.');
    closeEditor();
    selectedHistoryPhotoId = photo.id;
    openHistoryDrawer();
}

async function applySnapshotToState(snapshot) {
    editorState.selectedPhotoIds = [...snapshot.selectedPhotoIds];
    editorState.collageLayout = snapshot.collageLayout;
    editorState.frameStyle = snapshot.frameStyle;
    editorState.activeStickers = await Promise.all(snapshot.activeStickers.map(async data => {
        const sticker = {
            id: data.id,
            label: data.label,
            src: data.src,
            kind: data.kind || 'image',
            textContent: data.textContent,
            textFontId: data.textFontId,
            textFontSize: data.textFontSize,
            textColor: data.textColor,
            width: data.width,
            height: data.height,
            x: data.x,
            y: data.y,
            scale: data.scale,
            rotation: data.rotation,
            flipX: data.flipX,
            flipY: data.flipY
        };
        if (data.renderCanvasData) {
            try {
                const img = await loadImageCached(data.renderCanvasData);
                const surface = createStickerRenderSurface(img, data.width, data.height);
                sticker.renderCanvas = surface.renderCanvas;
                sticker.renderCtx = surface.renderCtx;
            } catch (e) {
                if (sticker.kind === 'text' && data.textContent) {
                    const fontDef = TEXT_FONTS.find(f => f.id === data.textFontId) || TEXT_FONTS[0];
                    const surface = createTextRenderCanvas(data.textContent, data.textFontSize, fontDef.css, data.textColor);
                    sticker.renderCanvas = surface.canvas;
                    sticker.renderCtx = surface.canvas.getContext('2d');
                }
            }
        }
        return sticker;
    }));
    editorState.selectedStickerId = null;
}

async function renderPhotoToDataUrl(photo) {
    if (!photo) return null;
    if (!photo.editorSnapshot) return photo.dataUrl;

    // Save current editorState fields, swap in snapshot, render, then restore.
    const saved = {
        selectedPhotoIds: editorState.selectedPhotoIds,
        collageLayout: editorState.collageLayout,
        frameStyle: editorState.frameStyle,
        activeStickers: editorState.activeStickers,
        selectedStickerId: editorState.selectedStickerId
    };

    try {
        await applySnapshotToState(photo.editorSnapshot);
        await renderEditorScene(editorExportCtx, editorExportCanvas, false, -1);
        return editorExportCanvas.toDataURL('image/png');
    } finally {
        editorState.selectedPhotoIds = saved.selectedPhotoIds;
        editorState.collageLayout = saved.collageLayout;
        editorState.frameStyle = saved.frameStyle;
        editorState.activeStickers = saved.activeStickers;
        editorState.selectedStickerId = saved.selectedStickerId;
    }
}

function stopStickerDrag(pointerId) {
    const wasInteracting = !!(editorState.dragStickerId || editorState.erasingStickerId);
    editorState.dragStickerId = null;
    editorState.erasingStickerId = null;
    editorState.eraseLastPoint = null;
    editorCanvasEl.classList.remove('dragging');
    try {
        if (pointerId !== undefined) editorCanvasEl.releasePointerCapture(pointerId);
    } catch (error) {
        // ignore capture release failures
    }
    if (wasInteracting) pushEditorHistory();
}
