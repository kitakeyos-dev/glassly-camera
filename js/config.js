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
