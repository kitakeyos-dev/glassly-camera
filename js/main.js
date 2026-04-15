// Event bindings and startup

const ONBOARDED_STORAGE_KEY = 'glassly-onboarded';

function clearFrozenFrame() {
    if (!frozenGlass && !isCooldown) return;
    frozenGlass = null;
    activeGlass = null;
    lastPos = null;
    snapTimer = 0;
    isCooldown = false;
    updateGestureTag(null);
}

canvasEl.addEventListener('click', clearFrozenFrame);
clearFrameBtnEl.addEventListener('click', clearFrozenFrame);

function openHelpSheet() {
    helpSheetEl.classList.add('visible');
    helpSheetEl.setAttribute('aria-hidden', 'false');
}
function closeHelpSheet() {
    helpSheetEl.classList.remove('visible');
    helpSheetEl.setAttribute('aria-hidden', 'true');
    // Mark the user as onboarded the first time they dismiss the help sheet,
    // regardless of whether we opened it automatically or they tapped the ? button.
    try { localStorage.setItem(ONBOARDED_STORAGE_KEY, '1'); } catch (_) {}
}
helpBtnEl.addEventListener('click', openHelpSheet);
helpCloseBtnEl.addEventListener('click', closeHelpSheet);
historyShortcutBtnEl.addEventListener('click', openHistoryDrawer);

// Effects overlay — floating palette + filter bars above the capture dock.
function openEffectsSheet() {
    effectsSheetEl.classList.add('visible');
    effectsSheetEl.setAttribute('aria-hidden', 'false');
    effectsBtnEl.classList.add('active');
}
function closeEffectsSheet() {
    effectsSheetEl.classList.remove('visible');
    effectsSheetEl.setAttribute('aria-hidden', 'true');
    effectsBtnEl.classList.remove('active');
}
effectsBtnEl.addEventListener('click', () => {
    if (effectsSheetEl.classList.contains('visible')) {
        closeEffectsSheet();
    } else {
        openEffectsSheet();
    }
});

// Beauty filter controls
function updateBeautyUI() {
    beautyToggleEl.textContent = beautyEnabled ? 'Bật' : 'Tắt';
    beautyToggleEl.classList.toggle('active', beautyEnabled);
    beautyToggleEl.setAttribute('aria-pressed', String(beautyEnabled));
    beautyStrengthEl.disabled = !beautyEnabled;
    beautyStrengthValueEl.textContent = String(beautyStrength);
}
beautyToggleEl.addEventListener('click', () => {
    beautyEnabled = !beautyEnabled;
    updateBeautyUI();
});
beautyStrengthEl.addEventListener('input', event => {
    beautyStrength = Number(event.target.value);
    beautyStrengthValueEl.textContent = String(beautyStrength);
});
updateBeautyUI();

// Skin whiten controls (paired with beauty above, same control layout).
function updateSkinWhitenUI() {
    skinWhitenToggleEl.textContent = skinWhitenEnabled ? 'Bật' : 'Tắt';
    skinWhitenToggleEl.classList.toggle('active', skinWhitenEnabled);
    skinWhitenToggleEl.setAttribute('aria-pressed', String(skinWhitenEnabled));
    skinWhitenStrengthEl.disabled = !skinWhitenEnabled;
    skinWhitenStrengthValueEl.textContent = String(skinWhitenStrength);
}
skinWhitenToggleEl.addEventListener('click', () => {
    skinWhitenEnabled = !skinWhitenEnabled;
    updateSkinWhitenUI();
});
skinWhitenStrengthEl.addEventListener('input', event => {
    skinWhitenStrength = Number(event.target.value);
    skinWhitenStrengthValueEl.textContent = String(skinWhitenStrength);
});
updateSkinWhitenUI();

historyUploadBtnEl.addEventListener('click', () => uploadHistoryInputEl.click());
uploadHistoryInputEl.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    await handleHistoryUpload(file);
});


stickerUploadBtnEl.addEventListener('click', () => uploadCustomStickerInputEl.click());
uploadCustomStickerInputEl.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    await addCustomUploadSticker(file);
});

document.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    saveCurrentFrame();
});

// Switch camera (front / back)
switchCameraBtnEl.addEventListener('click', () => {
    switchCamera().catch(() => {});
});

// Fullscreen toggle — uses the Fullscreen API on the document element so
// every overlay (effects sheet, history drawer, editor) inherits the
// fullscreen viewport. iOS Safari only supports this on 16.4+ and may
// silently reject, in which case we just leave the page in normal layout.
function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
function requestAppFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
        try { req.call(el); } catch (_) {}
    }
}
function exitAppFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) {
        try { exit.call(document); } catch (_) {}
    }
}
function updateFullscreenUI() {
    const active = isFullscreen();
    fullscreenBtnEl.classList.toggle('active', active);
    fullscreenBtnEl.setAttribute(
        'aria-label',
        active ? 'Thoat toan man hinh' : 'Toan man hinh'
    );
}
fullscreenBtnEl.addEventListener('click', () => {
    if (isFullscreen()) exitAppFullscreen();
    else requestAppFullscreen();
});
document.addEventListener('fullscreenchange', updateFullscreenUI);
document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
updateFullscreenUI();

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

// Render glass palette chip bar
function renderPaletteBar() {
    paletteBarEl.innerHTML = GLASS_PALETTES.map(p => `
        <button class="palette-chip${p.id === currentGlassPalette ? ' active' : ''}" type="button" data-palette-id="${p.id}">
            <span class="palette-swatch" style="background:${p.stroke}"></span>
            ${p.label}
        </button>
    `).join('');
}
renderPaletteBar();
paletteBarEl.addEventListener('click', event => {
    const btn = event.target.closest('[data-palette-id]');
    if (!btn) return;
    currentGlassPalette = btn.dataset.paletteId;
    renderPaletteBar();
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
historyCloseBtnEl.addEventListener('click', closeHistoryDrawer);
overlayBackdropEl.addEventListener('click', () => {
    closeHistoryDrawer();
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
    const dataUrl = photo.renderedDataUrl || photo.dataUrl;
    downloadDataUrl(dataUrl, `${photo.id}.png`);
    showToast('Đã tải ảnh.');
});
historyShareBtnEl.addEventListener('click', () => {
    const photo = getSelectedHistoryPhoto();
    if (!photo) return;
    shareCurrentFrame(photo);
});
historyDeleteBtnEl.addEventListener('click', () => {
    const photo = getSelectedHistoryPhoto();
    if (!photo) return;
    if (!confirm(`Xoá "${photo.label}" khỏi lịch sử?`)) return;
    removeCapturedPhoto(photo.id);
    showToast('Đã xoá ảnh.');
});
historyEditBtnEl.addEventListener('click', openEditorFromHistory);
historyClearSelectionBtnEl.addEventListener('click', clearHistoryPhotoSelection);
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeHistoryDrawer();
        closeEditor();
        closeHelpSheet();
        closeEffectsSheet();
        return;
    }
    if (!editorState.isOpen) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) editorRedo();
        else editorUndo();
        return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        editorRedo();
    }
});
editorCloseBtnEl.addEventListener('click', closeEditor);
editorDownloadBtnEl.addEventListener('click', saveEditorChanges);
editorUndoBtnEl.addEventListener('click', () => { editorUndo(); });
editorRedoBtnEl.addEventListener('click', () => { editorRedo(); });
editorLayoutOptionsEl.addEventListener('click', event => {
    const button = event.target.closest('[data-layout-id]');
    if (!button) return;
    if (editorState.collageLayout === button.dataset.layoutId) return;
    editorState.collageLayout = button.dataset.layoutId;
    syncEditorCanvasSize({ remapStickers: true });
    renderEditorLayoutOptions();
    renderEditorCanvas();
    pushEditorHistory();
});
editorFrameOptionsEl.addEventListener('click', event => {
    const button = event.target.closest('[data-frame-id]');
    if (!button) return;
    if (editorState.frameStyle === button.dataset.frameId) return;
    editorState.frameStyle = button.dataset.frameId;
    renderEditorFrameOptions();
    renderEditorCanvas();
    pushEditorHistory();
});
editorPhotoPickerEl.addEventListener('click', event => {
    const button = event.target.closest('[data-photo-id]');
    if (!button) return;
    toggleEditorPhotoSelection(button.dataset.photoId);
    pushEditorHistory();
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
// Text panel bindings
let selectedTextColor = TEXT_PRESET_COLORS[0];
textSizeRangeEl.addEventListener('input', event => {
    textSizeValueEl.textContent = event.target.value;
});
textColorRowEl.addEventListener('click', event => {
    const btn = event.target.closest('[data-color]');
    if (!btn) return;
    selectedTextColor = btn.dataset.color;
    textColorRowEl.querySelectorAll('.text-color-swatch').forEach(el => {
        el.classList.toggle('active', el === btn);
    });
});
textAddBtnEl.addEventListener('click', () => {
    const content = textInputEl.value;
    if (!content.trim()) {
        showToast('Nhập nội dung trước đã.', 2000);
        return;
    }
    addTextToEditor(content, {
        fontSize: Number(textSizeRangeEl.value),
        fontId: textFontSelectEl.value,
        color: selectedTextColor
    });
    textInputEl.value = '';
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
    ...STICKER_LIBRARY.map(s => s.src),
    // Prime the image decode cache for every LUT filter PNG so the first
    // time the user taps a LUT chip the WebGL pipeline can upload the
    // texture immediately instead of waiting on a fetch + decode.
    ...CAMERA_FILTERS.filter(f => f.kind === 'lut' && f.lut).map(f => f.lut)
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

// First-time onboarding — auto-open the help sheet on first visit so the user
// actually discovers the gesture system instead of staring at a camera feed.
try {
    if (!localStorage.getItem(ONBOARDED_STORAGE_KEY)) {
        openHelpSheet();
    }
} catch (_) {
    // localStorage can throw in private mode — skip onboarding silently.
}

// Register PWA service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
            .then(reg => {
                reg.update();
                // Poll for updates whenever the tab becomes visible again.
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) reg.update();
                });
                // Also poll on a timer so long-running foreground sessions
                // (especially on mobile where users rarely tab away) still
                // pick up fresh deploys without a manual refresh.
                setInterval(() => reg.update(), 5 * 60 * 1000);
                // When a new SW takes control, reload the page once so the
                // user immediately sees the latest HTML/CSS/JS.
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (refreshing) return;
                    refreshing = true;
                    window.location.reload();
                });
            })
            .catch(err => console.warn('SW registration failed:', err));
    });
}
