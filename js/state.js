// Mutable shared state across modules

let frozenGlass  = null;
let activeGlass  = null;
let snapTimer    = 0;
let lastPos      = null;
let isCooldown   = false;
let flashFrames  = 0;
let lastGesture  = null;
let currentMode = 'glasses';
let currentCameraFilter = 'none';
let frozenFilter = 'none';
let countdownDuration = 3;
let currentFacingMode = 'user';
let capturedPhotos = [];
let selectedHistoryPhotoId = null;
let selectedHistoryPhotoIds = [];
const imageCache = new Map();
