// Capture history drawer + selection

function getSelectedHistoryPhoto() {
    return capturedPhotos.find(photo => photo.id === selectedHistoryPhotoId) || null;
}

function getHistorySelectedPhotos() {
    return selectedHistoryPhotoIds
        .map(photoId => capturedPhotos.find(photo => photo.id === photoId))
        .filter(Boolean);
}

function getHistoryPhotosForEditor() {
    const selected = getHistorySelectedPhotos();
    if (selected.length) return selected;
    const focused = getSelectedHistoryPhoto();
    return focused ? [focused] : [];
}


function toggleHistoryPhotoSelection(photoId) {
    const exists = selectedHistoryPhotoIds.includes(photoId);

    if (exists) {
        selectedHistoryPhotoIds = selectedHistoryPhotoIds.filter(id => id !== photoId);
    } else {
        if (selectedHistoryPhotoIds.length >= 4) {
            showToast('Chỉ chọn tối đa 4 ảnh để ghép.', 2200);
            return;
        }
        selectedHistoryPhotoIds = [...selectedHistoryPhotoIds, photoId];
    }

    selectedHistoryPhotoId = photoId;
    renderHistoryDrawer();
}

function clearHistoryPhotoSelection() {
    selectedHistoryPhotoIds = [];
    renderHistoryDrawer();
}

function renderHistoryDrawer() {
    const hasPhotos = capturedPhotos.length > 0;
    historyEmptyEl.style.display = hasPhotos ? 'none' : 'block';
    historyListEl.innerHTML = '';

    if (!hasPhotos) {
        selectedHistoryPhotoId = null;
        selectedHistoryPhotoIds = [];
        historyPreviewEl.classList.remove('visible');
        return;
    }

    if (!getSelectedHistoryPhoto()) {
        selectedHistoryPhotoId = capturedPhotos[0].id;
    }

    selectedHistoryPhotoIds = selectedHistoryPhotoIds
        .filter(photoId => capturedPhotos.some(photo => photo.id === photoId))
        .slice(0, 4);

    for (const photo of capturedPhotos) {
        const item = document.createElement('button');
        item.type = 'button';
        const isFocused = photo.id === selectedHistoryPhotoId;
        const isSelected = selectedHistoryPhotoIds.includes(photo.id);
        item.className = `history-item${isFocused ? ' focused' : ''}${isSelected ? ' selected' : ''}`;
        item.dataset.photoId = photo.id;
        const thumbSrc = photo.renderedDataUrl || photo.dataUrl;
        item.innerHTML = `
            <span class="history-item-toggle" data-toggle-photo-id="${photo.id}" aria-label="${isSelected ? 'Bo chon anh' : 'Chon anh de ghep'}">${isSelected ? icons.check : icons.add}</span>
            <img src="${thumbSrc}" alt="${photo.label}">
            <div class="history-item-meta">
                <strong>${photo.label}</strong>
                <span>${formatCaptureTime(photo.createdAt)}</span>
            </div>
        `;
        historyListEl.appendChild(item);
    }

    const selected = getSelectedHistoryPhoto();
    historyPreviewEl.classList.toggle('visible', !!selected);
    if (!selected) return;

    historyPreviewImageEl.src = selected.renderedDataUrl || selected.dataUrl;
    historyPreviewTitleEl.textContent = selected.editorSnapshot
        ? `${selected.label} • đã chỉnh sửa`
        : selected.label;
    historyPreviewTimeEl.textContent = `Đã lưu lúc ${formatCaptureTime(selected.createdAt)}`;
    if (selectedHistoryPhotoIds.length) {
        historySelectionCountEl.textContent = `Đã chọn ${selectedHistoryPhotoIds.length}/4 ảnh để ghép trong editor.`;
    } else {
        historySelectionCountEl.textContent = 'Chưa chọn ảnh ghép. Nếu mở editor ngay, hệ thống sẽ dùng ảnh đang xem.';
    }
    const editorPhotos = getHistoryPhotosForEditor();
    historyEditBtnEl.textContent = editorPhotos.length > 1
        ? `Mở chỉnh sửa (${editorPhotos.length} ảnh)`
        : 'Mở chỉnh sửa';
    historyClearSelectionBtnEl.disabled = selectedHistoryPhotoIds.length === 0;
}

function openHistoryDrawer() {
    currentMode = 'history';
    toggleModeMenu(false);
    historyDrawerEl.classList.add('visible');
    historyDrawerEl.setAttribute('aria-hidden', 'false');
    renderHistoryDrawer();
    updateOverlayBackdrop();
}

function closeHistoryDrawer() {
    historyDrawerEl.classList.remove('visible');
    historyDrawerEl.setAttribute('aria-hidden', 'true');
    if (!researchModalEl.classList.contains('visible')) currentMode = 'glasses';
    updateOverlayBackdrop();
}

function pushCapturedPhoto(dataUrl) {
    const entry = {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dataUrl,
        createdAt: Date.now(),
        label: `Ảnh ${capturedPhotos.length + 1}`
    };

    capturedPhotos.unshift(entry);
    if (capturedPhotos.length > MAX_CAPTURE_HISTORY) {
        capturedPhotos = capturedPhotos.slice(0, MAX_CAPTURE_HISTORY);
    }
    selectedHistoryPhotoId = entry.id;
    selectedHistoryPhotoIds = [entry.id];
    renderHistoryDrawer();
}

