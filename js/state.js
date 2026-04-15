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
let currentGlassPalette = 'clear';
let countdownDuration = 3;
let currentFacingMode = 'user';
let capturedPhotos = [];
let selectedHistoryPhotoId = null;
let selectedHistoryPhotoIds = [];
let beautyEnabled = false;
let beautyStrength = 55;
let skinWhitenEnabled = false;
let skinWhitenStrength = 50;
const imageCache = new Map();
