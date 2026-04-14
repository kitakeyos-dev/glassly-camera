// Layout / frame / sticker definitions + editor state + constants

const COLLAGE_LAYOUTS = [
    { id: 'single', label: '1 ảnh', hint: 'Toàn khung' },
    { id: 'split-v', label: 'Ngang 2', hint: 'Trái / phải' },
    { id: 'split-h', label: 'Dọc 2', hint: 'Trên / dưới' },
    { id: 'grid', label: 'Lưới 4', hint: 'Ghép nhiều ảnh' }
];
const FRAME_STYLES = [
    { id: 'none',         label: 'Tối giản',     hint: 'Không viền' },
    { id: 'classic',      label: 'Classic',      hint: 'Khung trắng' },
    { id: 'polaroid',     label: 'Polaroid',     hint: 'Mé dưới dày' },
    { id: 'neon',         label: 'Neon',         hint: 'Phát sáng' },
    { id: 'film',         label: 'Film',         hint: 'Dải phim' },
    { id: 'gauvamatong',  label: 'Gấu mật ong',  hint: 'Bear & honey',   src: 'assets/frames/gauvamatong.png' },
    { id: 'hoaanhdao',    label: 'Hoa anh đào',  hint: 'Sakura pastel',  src: 'assets/frames/hoaanhdao.png' },
    { id: 'mayvasao',     label: 'Mây & sao',    hint: 'Pastel dreamy',  src: 'assets/frames/mayvasao.png' },
    { id: 'muahevabien',  label: 'Mùa hè & biển', hint: 'Beach kawaii',  src: 'assets/frames/muahevabien.png' },
    { id: 'polaroid90s',  label: 'Polaroid 90s', hint: 'Retro memories', src: 'assets/frames/polaroid_retro_90s.png' },
    { id: 'scrapbooking', label: 'Scrapbook',    hint: 'Washi tape',     src: 'assets/frames/scrapbooking.png' }
];
const STICKER_LIBRARY = [
    '3d-glasses.png','angry.png','axolotl (1).png','axolotl (2).png','axolotl.png','beanie.png',
    'chef-hat.png','cherry-pie.png','cigarette.png','corgi.png','fire.png','frog (1).png','frog.png',
    'glasses.png','handcuff.png','happy.png','heart-glasses.png','hello.png','hipster.png',
    'necklace (1).png','necklace (2).png','necklace.png','paper-plane.png','party-hat.png','pendant.png',
    'proud.png','rainbow.png','read.png','relaxed.png','rose.png','sad.png','santa-hat.png',
    'smile.png','smoke.png','studying.png','sun.png','tired.png'
].map((name, index) => ({
    id: `sticker-def-${index}`,
    name,
    label: name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
    src: `assets/stickers/${encodeURIComponent(name)}`
}));
const editorState = {
    isOpen: false,
    activeTab: null,
    selectedPhotoIds: [],
    collageLayout: 'single',
    frameStyle: 'classic',
    activeStickers: [],
    selectedStickerId: null,
    stickerSearch: '',
    dragStickerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    eraserEnabled: false,
    eraserRadius: 24,
    erasingStickerId: null,
    eraseLastPoint: null,
    eraserCursorVisible: false,
    eraserCursorX: 0,
    eraserCursorY: 0,
    renderToken: 0
};

const EDITOR_TABS = [
    { id: 'photo',   label: 'Ảnh',    icon: 'photo',   title: 'Chọn ảnh ghép' },
    { id: 'layout',  label: 'Bố cục', icon: 'layout',  title: 'Bố cục ghép ảnh' },
    { id: 'frame',   label: 'Khung',  icon: 'frame',   title: 'Khung viền' },
    { id: 'sticker', label: 'Sticker', icon: 'sticker', title: 'Thư viện sticker' }
];

const STICKER_TOOLBAR_ACTIONS = [
    { id: 'scale-down',   icon: 'zoomOut',     label: 'Thu nhỏ' },
    { id: 'scale-up',     icon: 'zoomIn',      label: 'Phóng to' },
    { id: 'rotate-left',  icon: 'rotateLeft',  label: 'Xoay trái' },
    { id: 'rotate-right', icon: 'rotateRight', label: 'Xoay phải' },
    { id: 'flip-x',       icon: 'flipH',       label: 'Lật ngang' },
    { id: 'flip-y',       icon: 'flipV',       label: 'Lật dọc' },
    { id: 'eraser',       icon: 'eraser',      label: 'Gôm' },
    { id: 'delete',       icon: 'trash',       label: 'Xoá', danger: true }
];

const SNAP_DELAY          = 2000;
const STABILITY_THRESHOLD = 80;
const MAX_CAPTURE_HISTORY = 10;
const DEFAULT_SAVE_TOAST  = 'Đã lưu ảnh!';

const COUNTDOWN_OPTIONS = [0, 3, 5, 10];

const GLASS_PALETTES = [
    {
        id: 'clear',
        label: 'Trong suốt',
        shimmer: [
            'rgba(180, 160, 255, 0.18)',
            'rgba(120, 220, 255, 0.08)',
            'rgba(255, 200, 220, 0.12)',
            'rgba(160, 255, 200, 0.06)'
        ],
        bevel: ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.15)', 'rgba(180,180,180,0.55)'],
        stroke: 'rgba(255,255,255,0.9)',
        progressHue: [255, 255, 255, 99, 102, 241]
    },
    {
        id: 'ice',
        label: 'Băng',
        shimmer: [
            'rgba(165, 220, 255, 0.25)',
            'rgba(200, 240, 255, 0.12)',
            'rgba(140, 200, 240, 0.18)',
            'rgba(220, 250, 255, 0.08)'
        ],
        bevel: ['rgba(220, 240, 255, 0.95)', 'rgba(140, 200, 240, 0.18)', 'rgba(100, 170, 220, 0.6)'],
        stroke: 'rgba(200, 240, 255, 0.95)',
        progressHue: [200, 240, 255, 56, 189, 248]
    },
    {
        id: 'rose',
        label: 'Rose gold',
        shimmer: [
            'rgba(255, 200, 210, 0.22)',
            'rgba(255, 220, 200, 0.14)',
            'rgba(255, 180, 190, 0.18)',
            'rgba(255, 230, 220, 0.08)'
        ],
        bevel: ['rgba(255, 230, 220, 0.95)', 'rgba(255, 180, 180, 0.2)', 'rgba(210, 130, 140, 0.6)'],
        stroke: 'rgba(255, 210, 200, 0.95)',
        progressHue: [255, 220, 220, 244, 114, 182]
    },
    {
        id: 'neon',
        label: 'Neon',
        shimmer: [
            'rgba(120, 255, 220, 0.28)',
            'rgba(255, 120, 255, 0.16)',
            'rgba(120, 200, 255, 0.2)',
            'rgba(255, 255, 120, 0.12)'
        ],
        bevel: ['rgba(160, 255, 240, 0.95)', 'rgba(255, 120, 255, 0.25)', 'rgba(100, 240, 200, 0.6)'],
        stroke: 'rgba(180, 255, 220, 0.95)',
        progressHue: [180, 255, 220, 34, 211, 238]
    },
    {
        id: 'gold',
        label: 'Vàng',
        shimmer: [
            'rgba(255, 220, 140, 0.25)',
            'rgba(255, 200, 100, 0.16)',
            'rgba(255, 240, 180, 0.14)',
            'rgba(255, 180, 80, 0.1)'
        ],
        bevel: ['rgba(255, 240, 200, 0.95)', 'rgba(255, 200, 100, 0.22)', 'rgba(200, 150, 60, 0.6)'],
        stroke: 'rgba(255, 220, 140, 0.95)',
        progressHue: [255, 230, 160, 234, 179, 8]
    }
];

const CAMERA_FILTERS = [
    { id: 'none',    label: 'Gốc',    css: 'none' },
    { id: 'bw',      label: 'Trắng đen', css: 'grayscale(1) contrast(1.12)' },
    { id: 'sepia',   label: 'Sepia',  css: 'sepia(0.7) saturate(1.2) contrast(1.05)' },
    { id: 'vivid',   label: 'Rực rỡ', css: 'saturate(1.65) contrast(1.1) brightness(1.05)' },
    { id: 'cool',    label: 'Lạnh',   css: 'saturate(1.15) hue-rotate(-12deg) brightness(1.02)' },
    { id: 'warm',    label: 'Ấm',     css: 'saturate(1.2) hue-rotate(12deg) brightness(1.03)' },
    { id: 'dreamy',  label: 'Mơ màng', css: 'blur(0.4px) brightness(1.08) saturate(1.2)' },
    { id: 'noir',    label: 'Noir',   css: 'grayscale(1) contrast(1.4) brightness(0.92)' }
];
