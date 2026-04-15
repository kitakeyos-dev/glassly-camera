// WebGL beauty filter — high-pass skin smoothing ported from MagicCamera.
// Original GLSL ES shader: see
// https://github.com/wuhaoyu1990/MagicCamera (magicfilter/res/raw/beauty.glsl)
//
// Pipeline: offscreen <canvas> with a WebGL context, a 1x fullscreen quad,
// one fragment shader, and one reusable 2D texture that we re-upload the
// current video frame into on every call. applyBeautyFilter() returns the
// offscreen canvas so camera.js can drawImage() it into the main 2D canvas.

const BEAUTY_FRAG_SRC = `
    precision mediump float;
    varying mediump vec2 textureCoordinate;
    uniform sampler2D inputImageTexture;
    uniform vec2 singleStepOffset;
    uniform mediump float params;
    const highp vec3 W = vec3(0.299, 0.587, 0.114);
    vec2 blurCoordinates[20];

    float hardLight(float color) {
        if (color <= 0.5) return color * color * 2.0;
        return 1.0 - ((1.0 - color) * (1.0 - color) * 2.0);
    }

    void main() {
        vec3 centralColor = texture2D(inputImageTexture, textureCoordinate).rgb;
        blurCoordinates[0] = textureCoordinate.xy + singleStepOffset * vec2(0.0, -10.0);
        blurCoordinates[1] = textureCoordinate.xy + singleStepOffset * vec2(0.0, 10.0);
        blurCoordinates[2] = textureCoordinate.xy + singleStepOffset * vec2(-10.0, 0.0);
        blurCoordinates[3] = textureCoordinate.xy + singleStepOffset * vec2(10.0, 0.0);
        blurCoordinates[4] = textureCoordinate.xy + singleStepOffset * vec2(5.0, -8.0);
        blurCoordinates[5] = textureCoordinate.xy + singleStepOffset * vec2(5.0, 8.0);
        blurCoordinates[6] = textureCoordinate.xy + singleStepOffset * vec2(-5.0, 8.0);
        blurCoordinates[7] = textureCoordinate.xy + singleStepOffset * vec2(-5.0, -8.0);
        blurCoordinates[8] = textureCoordinate.xy + singleStepOffset * vec2(8.0, -5.0);
        blurCoordinates[9] = textureCoordinate.xy + singleStepOffset * vec2(8.0, 5.0);
        blurCoordinates[10] = textureCoordinate.xy + singleStepOffset * vec2(-8.0, 5.0);
        blurCoordinates[11] = textureCoordinate.xy + singleStepOffset * vec2(-8.0, -5.0);
        blurCoordinates[12] = textureCoordinate.xy + singleStepOffset * vec2(0.0, -6.0);
        blurCoordinates[13] = textureCoordinate.xy + singleStepOffset * vec2(0.0, 6.0);
        blurCoordinates[14] = textureCoordinate.xy + singleStepOffset * vec2(6.0, 0.0);
        blurCoordinates[15] = textureCoordinate.xy + singleStepOffset * vec2(-6.0, 0.0);
        blurCoordinates[16] = textureCoordinate.xy + singleStepOffset * vec2(-4.0, -4.0);
        blurCoordinates[17] = textureCoordinate.xy + singleStepOffset * vec2(-4.0, 4.0);
        blurCoordinates[18] = textureCoordinate.xy + singleStepOffset * vec2(4.0, -4.0);
        blurCoordinates[19] = textureCoordinate.xy + singleStepOffset * vec2(4.0, 4.0);

        float sampleColor = centralColor.g * 20.0;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[0]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[1]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[2]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[3]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[4]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[5]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[6]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[7]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[8]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[9]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[10]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[11]).g;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[12]).g * 2.0;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[13]).g * 2.0;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[14]).g * 2.0;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[15]).g * 2.0;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[16]).g * 2.0;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[17]).g * 2.0;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[18]).g * 2.0;
        sampleColor += texture2D(inputImageTexture, blurCoordinates[19]).g * 2.0;
        sampleColor = sampleColor / 48.0;

        float highPass = centralColor.g - sampleColor + 0.5;
        for (int i = 0; i < 5; i++) {
            highPass = hardLight(highPass);
        }
        float luminance = dot(centralColor, W);
        float alpha = pow(luminance, params);
        vec3 smoothColor = centralColor + (centralColor - vec3(highPass)) * alpha * 0.1;
        gl_FragColor = vec4(mix(smoothColor.rgb, max(smoothColor, centralColor), alpha), 1.0);
    }
`;

const BEAUTY_VERT_SRC = `
    attribute vec2 aPos;
    attribute vec2 aTex;
    varying mediump vec2 textureCoordinate;
    void main() {
        gl_Position = vec4(aPos, 0.0, 1.0);
        textureCoordinate = aTex;
    }
`;

const beautyCanvas = document.createElement('canvas');
let beautyGL = null;
let beautyProgram = null;
let beautyTexture = null;
let beautyQuadBuffer = null;
let beautyPosAttr = -1;
let beautyTexAttr = -1;
let beautyInputLoc = null;
let beautyOffsetLoc = null;
let beautyParamsLoc = null;
let beautyInitFailed = false;

function compileBeautyShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Beauty shader compile failed:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function initBeautyGL() {
    if (beautyGL) return beautyGL;
    if (beautyInitFailed) return null;

    const gl = beautyCanvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        premultipliedAlpha: false
    }) || beautyCanvas.getContext('experimental-webgl');

    if (!gl) {
        beautyInitFailed = true;
        return null;
    }

    const vs = compileBeautyShader(gl, gl.VERTEX_SHADER, BEAUTY_VERT_SRC);
    const fs = compileBeautyShader(gl, gl.FRAGMENT_SHADER, BEAUTY_FRAG_SRC);
    if (!vs || !fs) {
        beautyInitFailed = true;
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('Beauty program link failed:', gl.getProgramInfoLog(program));
        beautyInitFailed = true;
        return null;
    }

    // Fullscreen quad. Texcoord Y is flipped because we use
    // UNPACK_FLIP_Y_WEBGL = true when uploading the video frame.
    const quad = new Float32Array([
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
         1,  1, 1, 1
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    beautyGL = gl;
    beautyProgram = program;
    beautyQuadBuffer = buffer;
    beautyTexture = texture;
    beautyPosAttr = gl.getAttribLocation(program, 'aPos');
    beautyTexAttr = gl.getAttribLocation(program, 'aTex');
    beautyInputLoc = gl.getUniformLocation(program, 'inputImageTexture');
    beautyOffsetLoc = gl.getUniformLocation(program, 'singleStepOffset');
    beautyParamsLoc = gl.getUniformLocation(program, 'params');

    return gl;
}

// Map a user-facing strength (0-100) to the shader's `params` uniform. Lower
// params means a larger alpha in the blend step, which means more smoothing.
function beautyStrengthToParams(strength) {
    const clamped = Math.max(0, Math.min(100, strength));
    return 5.0 - 4.5 * (clamped / 100);
}

// Runs the beauty shader over `source` (video element, image, or canvas) and
// returns the offscreen canvas containing the filtered frame. The caller is
// expected to drawImage() it immediately — the WebGL drawing buffer may be
// cleared by the compositor on the next tick.
function applyBeautyFilter(source, width, height, strength) {
    if (!width || !height) return null;
    const gl = initBeautyGL();
    if (!gl) return null;

    if (beautyCanvas.width !== width) beautyCanvas.width = width;
    if (beautyCanvas.height !== height) beautyCanvas.height = height;

    gl.viewport(0, 0, width, height);
    gl.useProgram(beautyProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, beautyTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch (err) {
        // CORS-tainted source, or an unsupported element type — fall back.
        return null;
    }
    gl.uniform1i(beautyInputLoc, 0);
    gl.uniform2f(beautyOffsetLoc, 1.0 / width, 1.0 / height);
    gl.uniform1f(beautyParamsLoc, beautyStrengthToParams(strength));

    gl.bindBuffer(gl.ARRAY_BUFFER, beautyQuadBuffer);
    gl.enableVertexAttribArray(beautyPosAttr);
    gl.vertexAttribPointer(beautyPosAttr, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(beautyTexAttr);
    gl.vertexAttribPointer(beautyTexAttr, 2, gl.FLOAT, false, 16, 8);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return beautyCanvas;
}
