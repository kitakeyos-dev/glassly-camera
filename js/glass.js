// 3D glass drawing + progress ring

function buildPath(glass) {
    ctx.beginPath();
    if (glass.type === 'triangle') {
        ctx.moveTo(glass.p1.x, glass.p1.y);
        ctx.lineTo(glass.p2.x, glass.p2.y);
        ctx.lineTo(glass.p3.x, glass.p3.y);
    } else if (glass.type === 'quad') {
        ctx.moveTo(glass.tl.x, glass.tl.y);
        ctx.lineTo(glass.tr.x, glass.tr.y);
        ctx.lineTo(glass.br.x, glass.br.y);
        ctx.lineTo(glass.bl.x, glass.bl.y);
    } else if (glass.type === 'circle') {
        ctx.ellipse(glass.cx, glass.cy, glass.rx, glass.ry, glass.angle, 0, Math.PI * 2);
    } else if (glass.type === 'star') {
        // Ngôi sao 5 cánh
        const { cx, cy } = glass;
        const outer = Math.max(glass.rx, glass.ry);
        const inner = outer * 0.42;
        const spikes = 5;
        let rot = -Math.PI / 2;
        const step = Math.PI / spikes;
        ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        for (let i = 0; i < spikes; i++) {
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        }
    } else if (glass.type === 'heart') {
        const { cx, cy, rx: w, ry: h } = glass;
        // Heart path via 2 bezier curves, cx/cy = visual center of heart.
        // Top dip sits above cy, bottom tip sits below cy.
        const topDipY   = cy - h * 0.25;
        const bottomY   = cy + h * 0.9;
        ctx.moveTo(cx, topDipY);
        ctx.bezierCurveTo(
            cx + w * 0.95, cy - h * 1.05,
            cx + w * 1.2,  cy + h * 0.25,
            cx,            bottomY
        );
        ctx.bezierCurveTo(
            cx - w * 1.2,  cy + h * 0.25,
            cx - w * 0.95, cy - h * 1.05,
            cx,            topDipY
        );
    }
    ctx.closePath();
}

function drawGlass3D(liveImage, glass, progress) {
    const isSnapped = progress >= 1;
    ctx.save();

    // Drop shadow (khi đã chụp)
    if (isSnapped) {
        buildPath(glass);
        ctx.save();
        ctx.shadowColor   = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur    = 40;
        ctx.shadowOffsetX = 18;
        ctx.shadowOffsetY = 18;
        ctx.fillStyle = 'black';
        ctx.fill();
        ctx.restore();
    }

    // Clip vùng hình
    buildPath(glass);
    ctx.clip();

    // Nội dung bên trong (zoom nhẹ tạo hiệu ứng khúc xạ khi snapped)
    const zoom = isSnapped ? 1.12 : 1.0;
    ctx.translate(glass.cx, glass.cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-glass.cx, -glass.cy);
    ctx.drawImage(liveImage, 0, 0, canvasEl.width, canvasEl.height);

    // Chromatic aberration khi snapped
    if (isSnapped) {
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.07;
        ctx.translate(4, 0);
        ctx.drawImage(liveImage, 0, 0, canvasEl.width, canvasEl.height);
        ctx.translate(-8, 0);
        ctx.globalAlpha = 0.05;
        ctx.drawImage(liveImage, 0, 0, canvasEl.width, canvasEl.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Iridescent shimmer bên trong khi snapped
    if (isSnapped) {
        ctx.save();
        buildPath(glass);
        ctx.clip();
        const shimmer = ctx.createLinearGradient(
            glass.cx - 150, glass.cy - 150,
            glass.cx + 150, glass.cy + 150
        );
        shimmer.addColorStop(0,   'rgba(180, 160, 255, 0.18)');
        shimmer.addColorStop(0.4, 'rgba(120, 220, 255, 0.08)');
        shimmer.addColorStop(0.7, 'rgba(255, 200, 220, 0.12)');
        shimmer.addColorStop(1,   'rgba(160, 255, 200, 0.06)');
        ctx.fillStyle = shimmer;
        ctx.fill();
        ctx.restore();
    }

    // Viền kính
    ctx.save();
    buildPath(glass);

    if (isSnapped) {
        const bevel = ctx.createLinearGradient(
            glass.cx - 120, glass.cy - 120,
            glass.cx + 120, glass.cy + 120
        );
        bevel.addColorStop(0,    'rgba(255,255,255,0.95)');
        bevel.addColorStop(0.45, 'rgba(255,255,255,0.15)');
        bevel.addColorStop(1,    'rgba(180,180,180,0.55)');
        ctx.lineWidth   = 9;
        ctx.strokeStyle = bevel;
        ctx.stroke();

        buildPath(glass);
        ctx.lineWidth   = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
    } else {
        const t = Math.max(0, Math.min(1, progress));
        const r = Math.round(255 - (255 - 99)  * t);
        const g = Math.round(255 - (255 - 102) * t);
        const b = Math.round(255 - (255 - 241) * t);
        ctx.lineWidth   = 3 + 5 * t;
        ctx.strokeStyle = `rgba(${r},${g},${b},0.85)`;
        ctx.setLineDash([]);
        ctx.stroke();
    }
    ctx.restore();

    if (!isSnapped && progress > 0.05) {
        drawProgressRing(glass, progress);
    }
}

// Vòng tiến trình dạng dashes quanh hình
function drawProgressRing(glass, progress) {
    ctx.save();

    let cx, cy, rx, ry;
    if (glass.type === 'circle') {
        cx = glass.cx; cy = glass.cy;
        rx = glass.rx * 1.25; ry = glass.ry * 1.25;
    } else if (glass.type === 'triangle') {
        cx = glass.cx; cy = glass.cy;
        const pts = [glass.p1, glass.p2, glass.p3];
        rx = ry = Math.max(...pts.map(p => Math.hypot(p.x - cx, p.y - cy))) * 1.2;
    } else if (glass.type === 'heart') {
        cx = glass.cx; cy = glass.cy;
        rx = ry = Math.max(glass.rx, glass.ry) * 1.45;
    } else if (glass.type === 'star') {
        cx = glass.cx; cy = glass.cy;
        rx = ry = Math.max(glass.rx, glass.ry) * 1.3;
    } else {
        cx = glass.cx; cy = glass.cy;
        const pts = [glass.tl, glass.tr, glass.br, glass.bl];
        rx = ry = Math.max(...pts.map(p => Math.hypot(p.x - cx, p.y - cy))) * 1.18;
    }

    const perim   = 2 * Math.PI * Math.max(rx, ry);
    const dashLen = perim / 24;
    ctx.setLineDash([dashLen * 0.6, dashLen * 0.4]);

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth   = 2;
    ctx.strokeStyle = 'rgba(99,102,241,0.25)';
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, -Math.PI / 2, 0, Math.PI * 2 * progress);
    ctx.lineWidth   = 3;
    ctx.strokeStyle = `rgba(139,92,246,${0.5 + 0.4 * progress})`;
    ctx.shadowColor = '#8b5cf6';
    ctx.shadowBlur  = 8;
    ctx.stroke();

    ctx.restore();
}

// Gesture detection
