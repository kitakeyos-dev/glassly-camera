// Save current frame to disk + history

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
