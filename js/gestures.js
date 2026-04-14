// Hand gesture detection + HUD tag

function isFingerExtended(landmarks, tipIdx, pipIdx) {
    const wrist = landmarks[0];
    const tip   = landmarks[tipIdx];
    const pip   = landmarks[pipIdx];
    return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) >
           Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
}

// Tam giác: cái (4) + trỏ (8) + giữa (12), áp út gập
function checkTriangleGesture(lm) {
    return  isFingerExtended(lm,  4,  3) &&
            isFingerExtended(lm,  8,  6) &&
            isFingerExtended(lm, 12, 10) &&
           !isFingerExtended(lm, 16, 14) &&
           !isFingerExtended(lm, 20, 18);
}

// L-Frame: cái + trỏ, 3 ngón còn lại gập
function checkLFrameGesture(lm) {
    return  isFingerExtended(lm,  4,  3)  &&
            isFingerExtended(lm,  8,  6)  &&
           !isFingerExtended(lm, 12, 10) &&
           !isFingerExtended(lm, 16, 14) &&
           !isFingerExtended(lm, 20, 18);
}

// Finger heart (1 tay): ngón cái + trỏ đan chéo thành hình X, 3 ngón còn lại gập.
function checkFingerHeartGesture(lm) {
    if (isFingerExtended(lm, 12, 10)) return false;
    if (isFingerExtended(lm, 16, 14)) return false;
    if (isFingerExtended(lm, 20, 18)) return false;

    const wrist      = lm[0];
    const middleBase = lm[9];
    const handSize   = Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y);
    if (handSize < 1e-4) return false;

    const thumbTip = lm[4];
    const indexTip = lm[8];
    const distTips = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

    // Cái + trỏ phải gần nhau (đan chéo), nhưng không quá xa so với scale bàn tay.
    return distTips < handSize * 0.9;
}

// Vòng tròn kéo dãn: cái (4) + trỏ (8) + út (20), 2 tay
function checkStretchCircleGesture(h1, h2) {
    return  isFingerExtended(h1,  4,  3) && isFingerExtended(h2,  4,  3) &&
            isFingerExtended(h1,  8,  6) && isFingerExtended(h2,  8,  6) &&
           !isFingerExtended(h1, 12, 10) && !isFingerExtended(h2, 12, 10) &&
           !isFingerExtended(h1, 16, 14) && !isFingerExtended(h2, 16, 14) &&
            isFingerExtended(h1, 20, 18) && isFingerExtended(h2, 20, 18);
}

function updateGestureTag(name) {
    if (name !== lastGesture) {
        lastGesture = name;
        gestureTagEl.textContent = name || '';
        gestureTagEl.classList.toggle('visible', !!name);
    }
}

