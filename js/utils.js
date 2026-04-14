// Utility helpers: toast, menu/modal, misc

let toastTimer = null;

function getPreferredCameraResolution() {
    const lowPowerCpu = Number(navigator.hardwareConcurrency || 8) <= 4;
    const lowMemoryDevice = Number(navigator.deviceMemory || 8) <= 4;

    if (lowPowerCpu || lowMemoryDevice) {
        return { width: 1280, height: 720 };
    }

    return { width: 1920, height: 1080 };
}

function setCaptureButtonFallback(isFallbackVisible) {
    captureBtnEl.classList.toggle('fallback-visible', isFallbackVisible);
}

if (captureBtnImgEl) {
    captureBtnImgEl.addEventListener('load', () => setCaptureButtonFallback(false));
    captureBtnImgEl.addEventListener('error', () => setCaptureButtonFallback(true));

    if (captureBtnImgEl.complete) {
        setCaptureButtonFallback(!(captureBtnImgEl.naturalWidth > 0));
    }
}

function showToast(message = DEFAULT_SAVE_TOAST, duration = 2200) {
    const span = document.createElement('span');
    span.textContent = message;
    saveToastEl.replaceChildren();
    saveToastEl.insertAdjacentHTML('beforeend', icons.check);
    saveToastEl.appendChild(span);
    saveToastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        saveToastEl.classList.remove('visible');
    }, duration);
}

function formatCaptureTime(timestamp) {
    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
    }).format(timestamp);
}


function downloadDataUrl(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
}

function updateOverlayBackdrop() {
    const visible =
        modeMenuEl.classList.contains('visible') ||
        historyDrawerEl.classList.contains('visible') ||
        researchModalEl.classList.contains('visible');

    overlayBackdropEl.classList.toggle('visible', visible);
}

function toggleModeMenu(force) {
    const shouldOpen = typeof force === 'boolean' ? force : !modeMenuEl.classList.contains('visible');
    modeMenuEl.classList.toggle('visible', shouldOpen);
    modeMenuEl.setAttribute('aria-hidden', String(!shouldOpen));
    updateOverlayBackdrop();
}

function closeResearchModal() {
    researchModalEl.classList.remove('visible');
    researchModalEl.setAttribute('aria-hidden', 'true');
    if (!historyDrawerEl.classList.contains('visible')) currentMode = 'glasses';
    updateOverlayBackdrop();
}

function openResearchModal() {
    currentMode = 'photobook';
    toggleModeMenu(false);
    researchModalEl.classList.add('visible');
    researchModalEl.setAttribute('aria-hidden', 'false');
    updateOverlayBackdrop();
}


function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function loadImageCached(src) {
    if (imageCache.has(src)) return imageCache.get(src);

    const imagePromise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

    imageCache.set(src, imagePromise);
    return imagePromise;
}

