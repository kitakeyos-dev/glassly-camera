// Save current frame to disk + history

let countdownActive = false;

function saveCurrentFrame() {
    if (!canvasEl.width || !canvasEl.height) return;

    const save = document.createElement('canvas');
    save.width  = canvasEl.width;
    save.height = canvasEl.height;
    const sCtx = save.getContext('2d');
    sCtx.translate(save.width, 0);
    sCtx.scale(-1, 1);
    sCtx.drawImage(canvasEl, 0, 0);

    const filename = `glass-${Date.now()}.png`;
    const dataUrl = save.toDataURL('image/png');
    pushCapturedPhoto(dataUrl);
    downloadDataUrl(dataUrl, filename);

    if (navigator.vibrate) navigator.vibrate(30);
    showToast('Đã lưu ảnh!');
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

async function shareCurrentFrame(photo) {
    try {
        const res = await fetch(photo.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `${photo.id}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: '3D Glass', text: photo.label });
        } else if (navigator.share) {
            await navigator.share({ title: '3D Glass', text: photo.label, url: photo.dataUrl });
        } else {
            showToast('Thiết bị không hỗ trợ chia sẻ.', 2600);
        }
    } catch (error) {
        if (error && error.name !== 'AbortError') {
            showToast('Không thể chia sẻ ảnh.', 2400);
        }
    }
}
