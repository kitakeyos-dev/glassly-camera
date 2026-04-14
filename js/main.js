// Event bindings and startup

canvasEl.addEventListener('click', () => {
    if (!frozenGlass && !isCooldown) return;
    frozenGlass = null;
    activeGlass = null;
    lastPos = null;
    snapTimer = 0;
    isCooldown = false;
    updateGestureTag(null);
});

function openHelpSheet() {
    helpSheetEl.classList.add('visible');
    helpSheetEl.setAttribute('aria-hidden', 'false');
}
function closeHelpSheet() {
    helpSheetEl.classList.remove('visible');
    helpSheetEl.setAttribute('aria-hidden', 'true');
}
helpBtnEl.addEventListener('click', openHelpSheet);
helpCloseBtnEl.addEventListener('click', closeHelpSheet);
historyShortcutBtnEl.addEventListener('click', openHistoryDrawer);

document.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    saveCurrentFrame();
});

// Switch camera (front / back)
switchCameraBtnEl.addEventListener('click', () => {
    switchCamera().catch(() => {});
});

// Countdown timer toggle (cycles 0/3/5/10 seconds)
function updateTimerToggleLabel() {
    timerToggleLabelEl.textContent = countdownDuration > 0 ? `${countdownDuration}s` : 'Off';
    timerToggleEl.classList.toggle('off', countdownDuration === 0);
}
updateTimerToggleLabel();
timerToggleEl.addEventListener('click', () => {
    const idx = COUNTDOWN_OPTIONS.indexOf(countdownDuration);
    countdownDuration = COUNTDOWN_OPTIONS[(idx + 1) % COUNTDOWN_OPTIONS.length];
    updateTimerToggleLabel();
});

// Render filter chip bar
function renderFilterBar() {
    filterBarEl.innerHTML = CAMERA_FILTERS.map(f => `
        <button class="filter-chip${f.id === currentCameraFilter ? ' active' : ''}" type="button" data-filter-id="${f.id}">
            ${f.label}
        </button>
    `).join('');
}
renderFilterBar();
filterBarEl.addEventListener('click', event => {
    const btn = event.target.closest('[data-filter-id]');
    if (!btn) return;
    currentCameraFilter = btn.dataset.filterId;
    renderFilterBar();
});

// Burst mode: long-press capture → rapid shots. Short tap → countdown.
const BURST_HOLD_MS = 400;
const BURST_INTERVAL_MS = 420;
const BURST_MAX = 6;
let burstHoldTimer = null;
let burstIntervalId = null;
let burstFiredCount = 0;

function startBurst() {
    burstFiredCount = 1;
    saveCurrentFrame();
    burstIntervalId = setInterval(() => {
        if (burstFiredCount >= BURST_MAX) {
            stopBurst();
            return;
        }
        saveCurrentFrame();
        burstFiredCount += 1;
    }, BURST_INTERVAL_MS);
}

function stopBurst() {
    if (burstIntervalId) {
        clearInterval(burstIntervalId);
        burstIntervalId = null;
    }
}

captureBtnEl.addEventListener('pointerdown', event => {
    event.preventDefault();
    burstFiredCount = 0;
    burstHoldTimer = setTimeout(() => {
        burstHoldTimer = null;
        startBurst();
    }, BURST_HOLD_MS);
});

function endCapturePress() {
    if (burstHoldTimer) {
        clearTimeout(burstHoldTimer);
        burstHoldTimer = null;
        // Short tap — trigger countdown
        runCountdownCapture();
    } else {
        stopBurst();
    }
    burstFiredCount = 0;
}
captureBtnEl.addEventListener('pointerup', endCapturePress);
captureBtnEl.addEventListener('pointercancel', () => {
    if (burstHoldTimer) {
        clearTimeout(burstHoldTimer);
        burstHoldTimer = null;
    }
    stopBurst();
    burstFiredCount = 0;
});
captureBtnEl.addEventListener('pointerleave', () => {
    if (burstIntervalId) stopBurst();
});
historyModeBtnEl.addEventListener('click', openHistoryDrawer);
photobookModeBtnEl.addEventListener('click', openResearchModal);
historyCloseBtnEl.addEventListener('click', closeHistoryDrawer);
researchCloseBtnEl.addEventListener('click', closeResearchModal);
overlayBackdropEl.addEventListener('click', () => {
    toggleModeMenu(false);
    closeHistoryDrawer();
    closeResearchModal();
});
historyListEl.addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggle-photo-id]');
    if (toggle) {
        toggleHistoryPhotoSelection(toggle.dataset.togglePhotoId);
        return;
    }

    const item = event.target.closest('.history-item');
    if (!item) return;
    selectedHistoryPhotoId = item.dataset.photoId;
    renderHistoryDrawer();
});
historyDownloadBtnEl.addEventListener('click', () => {
    const photo = getSelectedHistoryPhoto();
    if (!photo) return;
    downloadDataUrl(photo.dataUrl, `${photo.id}.png`);
    showToast('Đã tải lại ảnh đã chọn!');
});
historyShareBtnEl.addEventListener('click', () => {
    const photo = getSelectedHistoryPhoto();
    if (!photo) return;
    shareCurrentFrame(photo);
});
historyEditBtnEl.addEventListener('click', openEditorFromHistory);
historyClearSelectionBtnEl.addEventListener('click', clearHistoryPhotoSelection);
document.addEventListener('click', event => {
    if (!modeMenuEl.classList.contains('visible')) return;
    if (modeMenuEl.contains(event.target)) return;
    toggleModeMenu(false);
});
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    toggleModeMenu(false);
    closeHistoryDrawer();
    closeResearchModal();
    closeEditor();
    closeHelpSheet();
});
editorCloseBtnEl.addEventListener('click', closeEditor);
editorDownloadBtnEl.addEventListener('click', exportEditorImage);
editorLayoutOptionsEl.addEventListener('click', event => {
    const button = event.target.closest('[data-layout-id]');
    if (!button) return;
    editorState.collageLayout = button.dataset.layoutId;
    renderEditorLayoutOptions();
    renderEditorCanvas();
});
editorFrameOptionsEl.addEventListener('click', event => {
    const button = event.target.closest('[data-frame-id]');
    if (!button) return;
    editorState.frameStyle = button.dataset.frameId;
    renderEditorFrameOptions();
    renderEditorCanvas();
});
editorPhotoPickerEl.addEventListener('click', event => {
    const button = event.target.closest('[data-photo-id]');
    if (!button) return;
    toggleEditorPhotoSelection(button.dataset.photoId);
});
stickerSearchInputEl.addEventListener('input', event => {
    editorState.stickerSearch = event.target.value;
    renderStickerLibrary();
});
stickerListEl.addEventListener('click', event => {
    const button = event.target.closest('[data-sticker-id]');
    if (!button) return;
    addStickerToEditor(button.dataset.stickerId);
});
editorTabbarEl.addEventListener('click', event => {
    const button = event.target.closest('[data-editor-tab]');
    if (!button) return;
    openEditorTab(button.dataset.editorTab);
});
bottomSheetCloseBtnEl.addEventListener('click', closeEditorSheet);
stickerToolbarEl.addEventListener('click', event => {
    const button = event.target.closest('[data-sticker-action]');
    if (!button) return;
    handleStickerToolbarAction(button.dataset.stickerAction);
});
editorCanvasEl.addEventListener('pointerdown', event => {
    if (!editorState.isOpen) return;
    const point = getEditorCanvasPoint(event);
    updateEraserCursor(point);
    const sticker = findStickerAtPoint(point.x, point.y);

    if (editorState.eraserEnabled) {
        const targetSticker = sticker || getEditorSelectedSticker();
        if (!targetSticker) {
            editorState.selectedStickerId = null;
            editorState.erasingStickerId = null;
            renderEditorCanvas();
            return;
        }

        editorState.selectedStickerId = targetSticker.id;
        editorState.erasingStickerId = targetSticker.id;
        editorState.eraseLastPoint = point;
        eraseStickerStroke(targetSticker, point, point);
        editorCanvasEl.setPointerCapture(event.pointerId);
        renderEditorCanvas();
        return;
    }

    if (!sticker) {
        editorState.selectedStickerId = null;
        renderEditorCanvas();
        return;
    }

    editorState.selectedStickerId = sticker.id;
    editorState.dragStickerId = sticker.id;
    editorState.dragOffsetX = point.x - sticker.x;
    editorState.dragOffsetY = point.y - sticker.y;
    editorCanvasEl.setPointerCapture(event.pointerId);
    editorCanvasEl.classList.add('dragging');
    renderEditorCanvas();
});
editorCanvasEl.addEventListener('pointermove', event => {
    const point = getEditorCanvasPoint(event);
    if (editorState.eraserEnabled) {
        updateEraserCursor(point);
    }

    if (editorState.erasingStickerId) {
        const sticker = getEditorSelectedSticker();
        if (!sticker) return;
        eraseStickerStroke(sticker, editorState.eraseLastPoint || point, point);
        editorState.eraseLastPoint = point;
        renderEditorCanvas();
        return;
    }

    if (editorState.eraserEnabled) {
        renderEditorCanvas();
        return;
    }

    if (!editorState.dragStickerId) return;
    const sticker = getEditorSelectedSticker();
    if (!sticker) return;
    sticker.x = clamp(point.x - editorState.dragOffsetX, 0, editorCanvasEl.width);
    sticker.y = clamp(point.y - editorState.dragOffsetY, 0, editorCanvasEl.height);
    renderEditorCanvas();
});

editorCanvasEl.addEventListener('pointerup', event => stopStickerDrag(event.pointerId));
editorCanvasEl.addEventListener('pointercancel', event => stopStickerDrag(event.pointerId));
editorCanvasEl.addEventListener('pointerenter', event => {
    if (!editorState.eraserEnabled) return;
    updateEraserCursor(getEditorCanvasPoint(event));
    renderEditorCanvas();
});
editorCanvasEl.addEventListener('pointerleave', () => {
    if (!editorState.eraserEnabled) return;
    editorState.eraserCursorVisible = false;
    if (!editorState.erasingStickerId) {
        renderEditorCanvas();
    }
});
editorCanvasEl.addEventListener('wheel', event => {
    if (!editorState.isOpen) return;
    const sticker = getEditorSelectedSticker();
    if (!sticker) return;
    event.preventDefault();

    if (event.shiftKey) {
        sticker.rotation += event.deltaY < 0 ? 0.06 : -0.06;
    } else {
        const nextScale = sticker.scale * (event.deltaY < 0 ? 1.05 : 0.95);
        sticker.scale = clamp(nextScale, 0.4, 2.2);
    }

    renderEditorCanvas();
}, { passive: false });

// Preload frames + stickers with progress tracking.
// Progress 0-90% = asset downloads; 90-100% = camera + Hands init.
const preloadAssets = [
    ...FRAME_STYLES.filter(f => f.src).map(f => f.src),
    ...STICKER_LIBRARY.map(s => s.src)
];
const totalAssets = preloadAssets.length;
let loadedAssets = 0;

function setLoadingProgress(percent, subtitle) {
    if (!loadingProgressFillEl) return;
    loadingProgressFillEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (subtitle && loadingSubtitleEl) loadingSubtitleEl.textContent = subtitle;
}

function markAssetLoaded() {
    loadedAssets += 1;
    const pct = totalAssets ? (loadedAssets / totalAssets) * 90 : 90;
    setLoadingProgress(pct, `Đang tải tài nguyên ${loadedAssets}/${totalAssets}`);
    if (loadedAssets >= totalAssets) {
        setLoadingProgress(90, 'Đang khởi động camera...');
        if (loadingTitleEl) loadingTitleEl.textContent = 'Khởi động camera';
    }
}

if (totalAssets === 0) {
    setLoadingProgress(90, 'Đang khởi động camera...');
} else {
    setLoadingProgress(0, `Đang tải tài nguyên 0/${totalAssets}`);
    preloadAssets.forEach(src => {
        loadImageCached(src).then(markAssetLoaded, markAssetLoaded);
    });
}

startCamera().catch(() => {});
