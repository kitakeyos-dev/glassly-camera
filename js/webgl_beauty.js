// WebGL image pipeline — a single fragment shader that runs beauty
// smoothing and an optional per-channel LUT in one draw call, so the
// camera hot loop spends at most one texImage2D upload + one draw call
// per rendered frame regardless of how many effects are active.
//
// Beauty section: ported from wuhaoyu1990/MagicCamera beauty.glsl
// (20-tap green-channel blur + high-pass + 5x hard-light + luminance-
// weighted blend).
//
// LUT section: a 256-wide, 3-pixel-tall curve texture like MagicCamera's
// *map.png files. The three rows encode independent per-channel tone
// curves (R at y=0.166, G at y=0.5, B at y=0.833). At runtime we sample
// vec2(color.ch, rowY) and assign to the matching output channel, then
// blend with the original by uLutMix so the selected filter can be
// dialed down or off entirely.

const IMAGE_PIPELINE_FRAG_SRC = `
    precision mediump float;
    varying mediump vec2 textureCoordinate;

    uniform sampler2D uVideo;
    uniform sampler2D uLut;
    uniform vec2 uSingleStepOffset;
    uniform float uBeautyParams;
    uniform float uBeautyMix;
    uniform float uLutMix;

    const highp vec3 W = vec3(0.299, 0.587, 0.114);

    float hardLight(float color) {
        if (color <= 0.5) return color * color * 2.0;
        return 1.0 - ((1.0 - color) * (1.0 - color) * 2.0);
    }

    vec3 applyBeauty(vec3 centralColor) {
        vec2 blurCoordinates[20];
        blurCoordinates[0]  = textureCoordinate.xy + uSingleStepOffset * vec2(0.0, -10.0);
        blurCoordinates[1]  = textureCoordinate.xy + uSingleStepOffset * vec2(0.0, 10.0);
        blurCoordinates[2]  = textureCoordinate.xy + uSingleStepOffset * vec2(-10.0, 0.0);
        blurCoordinates[3]  = textureCoordinate.xy + uSingleStepOffset * vec2(10.0, 0.0);
        blurCoordinates[4]  = textureCoordinate.xy + uSingleStepOffset * vec2(5.0, -8.0);
        blurCoordinates[5]  = textureCoordinate.xy + uSingleStepOffset * vec2(5.0, 8.0);
        blurCoordinates[6]  = textureCoordinate.xy + uSingleStepOffset * vec2(-5.0, 8.0);
        blurCoordinates[7]  = textureCoordinate.xy + uSingleStepOffset * vec2(-5.0, -8.0);
        blurCoordinates[8]  = textureCoordinate.xy + uSingleStepOffset * vec2(8.0, -5.0);
        blurCoordinates[9]  = textureCoordinate.xy + uSingleStepOffset * vec2(8.0, 5.0);
        blurCoordinates[10] = textureCoordinate.xy + uSingleStepOffset * vec2(-8.0, 5.0);
        blurCoordinates[11] = textureCoordinate.xy + uSingleStepOffset * vec2(-8.0, -5.0);
        blurCoordinates[12] = textureCoordinate.xy + uSingleStepOffset * vec2(0.0, -6.0);
        blurCoordinates[13] = textureCoordinate.xy + uSingleStepOffset * vec2(0.0, 6.0);
        blurCoordinates[14] = textureCoordinate.xy + uSingleStepOffset * vec2(6.0, 0.0);
        blurCoordinates[15] = textureCoordinate.xy + uSingleStepOffset * vec2(-6.0, 0.0);
        blurCoordinates[16] = textureCoordinate.xy + uSingleStepOffset * vec2(-4.0, -4.0);
        blurCoordinates[17] = textureCoordinate.xy + uSingleStepOffset * vec2(-4.0, 4.0);
        blurCoordinates[18] = textureCoordinate.xy + uSingleStepOffset * vec2(4.0, -4.0);
        blurCoordinates[19] = textureCoordinate.xy + uSingleStepOffset * vec2(4.0, 4.0);

        float sampleColor = centralColor.g * 20.0;
        sampleColor += texture2D(uVideo, blurCoordinates[0]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[1]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[2]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[3]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[4]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[5]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[6]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[7]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[8]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[9]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[10]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[11]).g;
        sampleColor += texture2D(uVideo, blurCoordinates[12]).g * 2.0;
        sampleColor += texture2D(uVideo, blurCoordinates[13]).g * 2.0;
        sampleColor += texture2D(uVideo, blurCoordinates[14]).g * 2.0;
        sampleColor += texture2D(uVideo, blurCoordinates[15]).g * 2.0;
        sampleColor += texture2D(uVideo, blurCoordinates[16]).g * 2.0;
        sampleColor += texture2D(uVideo, blurCoordinates[17]).g * 2.0;
        sampleColor += texture2D(uVideo, blurCoordinates[18]).g * 2.0;
        sampleColor += texture2D(uVideo, blurCoordinates[19]).g * 2.0;
        sampleColor = sampleColor / 48.0;

        float highPass = centralColor.g - sampleColor + 0.5;
        for (int i = 0; i < 5; i++) {
            highPass = hardLight(highPass);
        }
        float luminance = dot(centralColor, W);
        float alpha = pow(luminance, uBeautyParams);
        vec3 smoothColor = centralColor + (centralColor - vec3(highPass)) * alpha * 0.1;
        return mix(smoothColor.rgb, max(smoothColor, centralColor), alpha);
    }

    vec3 applyLut(vec3 color) {
        vec3 mapped;
        mapped.r = texture2D(uLut, vec2(color.r, 0.16666)).r;
        mapped.g = texture2D(uLut, vec2(color.g, 0.5)).g;
        mapped.b = texture2D(uLut, vec2(color.b, 0.83333)).b;
        return mapped;
    }

    void main() {
        vec3 central = texture2D(uVideo, textureCoordinate).rgb;
        vec3 result = central;
        if (uBeautyMix > 0.0) {
            result = mix(central, applyBeauty(central), uBeautyMix);
        }
        if (uLutMix > 0.0) {
            result = mix(result, applyLut(result), uLutMix);
        }
        gl_FragColor = vec4(result, 1.0);
    }
`;

const IMAGE_PIPELINE_VERT_SRC = `
    attribute vec2 aPos;
    attribute vec2 aTex;
    varying mediump vec2 textureCoordinate;
    void main() {
        gl_Position = vec4(aPos, 0.0, 1.0);
        textureCoordinate = aTex;
    }
`;

const pipelineCanvas = document.createElement('canvas');
let pipelineGL = null;
let pipelineProgram = null;
let pipelineQuadBuffer = null;
let pipelineVideoTexture = null;
let pipelinePosAttr = -1;
let pipelineTexAttr = -1;
let uVideoLoc = null;
let uLutLoc = null;
let uSingleStepOffsetLoc = null;
let uBeautyParamsLoc = null;
let uBeautyMixLoc = null;
let uLutMixLoc = null;
let pipelineInitFailed = false;

// Cache of LUT textures keyed by url. Each entry is either a fully-loaded
// WebGLTexture or a sentinel while the PNG is still in flight — the caller
// simply skips the LUT pass until loading completes.
const lutTextureCache = new Map();
// Placeholder 1x1 RGBA texture bound to sampler slot 1 whenever no LUT is
// selected, so the sampler stays complete and WebGL doesn't draw undefined
// garbage into every frame.
let pipelineNullLut = null;

function compilePipelineShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Image pipeline shader compile failed:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initPipelineGL() {
    if (pipelineGL) return pipelineGL;
    if (pipelineInitFailed) return null;

    const gl = pipelineCanvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        premultipliedAlpha: false
    }) || pipelineCanvas.getContext('experimental-webgl');

    if (!gl) {
        pipelineInitFailed = true;
        return null;
    }

    const vs = compilePipelineShader(gl, gl.VERTEX_SHADER, IMAGE_PIPELINE_VERT_SRC);
    const fs = compilePipelineShader(gl, gl.FRAGMENT_SHADER, IMAGE_PIPELINE_FRAG_SRC);
    if (!vs || !fs) {
        pipelineInitFailed = true;
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('Image pipeline program link failed:', gl.getProgramInfoLog(program));
        pipelineInitFailed = true;
        return null;
    }

    const quad = new Float32Array([
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
         1,  1, 1, 1
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const nullLut = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, nullLut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    pipelineGL = gl;
    pipelineProgram = program;
    pipelineQuadBuffer = buffer;
    pipelineVideoTexture = videoTexture;
    pipelineNullLut = nullLut;
    pipelinePosAttr = gl.getAttribLocation(program, 'aPos');
    pipelineTexAttr = gl.getAttribLocation(program, 'aTex');
    uVideoLoc = gl.getUniformLocation(program, 'uVideo');
    uLutLoc = gl.getUniformLocation(program, 'uLut');
    uSingleStepOffsetLoc = gl.getUniformLocation(program, 'uSingleStepOffset');
    uBeautyParamsLoc = gl.getUniformLocation(program, 'uBeautyParams');
    uBeautyMixLoc = gl.getUniformLocation(program, 'uBeautyMix');
    uLutMixLoc = gl.getUniformLocation(program, 'uLutMix');

    return gl;
}

function beautyStrengthToParams(strength) {
    const clamped = Math.max(0, Math.min(100, strength));
    return 5.0 - 4.5 * (clamped / 100);
}

// Kick off a lazy fetch of a LUT PNG and register the resulting texture in
// the cache. Subsequent calls return the same cached WebGLTexture once the
// PNG finishes decoding.
function getLutTexture(url) {
    const gl = pipelineGL;
    if (!gl || !url) return null;

    const cached = lutTextureCache.get(url);
    if (cached !== undefined) {
        return cached.texture || null;
    }

    const entry = { texture: null };
    lutTextureCache.set(url, entry);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        entry.texture = texture;
    };
    img.onerror = () => {
        lutTextureCache.delete(url);
    };
    img.src = url;
    return null;
}

// Run the combined pipeline. `options.beauty` = { enabled, strength }.
// `options.lut` = { url, mix } where mix is in [0,1] and url is one of the
// entries in assets/luts/. Returns the offscreen canvas if any effect ran,
// otherwise null so the caller can fall through to the raw source.
function applyImageFilters(source, width, height, options) {
    if (!width || !height) return null;
    const beauty = options && options.beauty;
    const lut = options && options.lut;
    const beautyOn = !!(beauty && beauty.enabled);
    const lutOn = !!(lut && lut.url && lut.mix > 0);
    if (!beautyOn && !lutOn) return null;

    const gl = initPipelineGL();
    if (!gl) return null;

    let lutTexture = null;
    if (lutOn) {
        lutTexture = getLutTexture(lut.url);
        if (!lutTexture && !beautyOn) {
            // LUT not decoded yet and nothing else to draw — skip this frame
            // and let the next frame try again.
            return null;
        }
    }

    if (pipelineCanvas.width !== width) pipelineCanvas.width = width;
    if (pipelineCanvas.height !== height) pipelineCanvas.height = height;

    gl.viewport(0, 0, width, height);
    gl.useProgram(pipelineProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pipelineVideoTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch (err) {
        return null;
    }
    gl.uniform1i(uVideoLoc, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lutTexture || pipelineNullLut);
    gl.uniform1i(uLutLoc, 1);

    gl.uniform2f(uSingleStepOffsetLoc, 1.0 / width, 1.0 / height);
    gl.uniform1f(
        uBeautyParamsLoc,
        beautyOn ? beautyStrengthToParams(beauty.strength) : 5.0
    );
    gl.uniform1f(uBeautyMixLoc, beautyOn ? 1.0 : 0.0);
    gl.uniform1f(uLutMixLoc, lutOn && lutTexture ? lut.mix : 0.0);

    gl.bindBuffer(gl.ARRAY_BUFFER, pipelineQuadBuffer);
    gl.enableVertexAttribArray(pipelinePosAttr);
    gl.vertexAttribPointer(pipelinePosAttr, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(pipelineTexAttr);
    gl.vertexAttribPointer(pipelineTexAttr, 2, gl.FLOAT, false, 16, 8);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return pipelineCanvas;
}

// Back-compat alias so any older call site keeps working; camera.js now
// calls applyImageFilters directly.
function applyBeautyFilter(source, width, height, strength) {
    return applyImageFilters(source, width, height, {
        beauty: { enabled: true, strength }
    });
}
