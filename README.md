# Glassly

Ứng dụng camera PWA dùng cử chỉ tay để tạo khung kính 3D trực tiếp trên video, kèm trình chỉnh sửa ảnh với ghép collage, khung viền, sticker và chữ.

## Tính năng chính

- **Nhận diện cử chỉ tay** qua MediaPipe Hands: tam giác, tứ giác 3D (hai chữ L), vòng tròn (hai tay), trái tim, ngôi sao.
- **Khung kính 3D frosted** theo dõi bàn tay theo thời gian thực, có shimmer / bevel / chromatic aberration khi đứng yên đủ lâu thì tự "đóng băng".
- **Hiệu ứng camera** chạy trên WebGL một pass duy nhất: làm mịn da, làm trắng da, LUT màu, sketch, crayon.
- **Lịch sử ảnh** FIFO 10 tấm gần nhất, có thumbnail riêng để scroll mượt.
- **Editor ảnh**: ghép collage đến 4 ảnh, đổi khung kawaii, thêm sticker (có undo/redo, xoá cục bộ), thêm chữ với font + cỡ + màu.
- **Glass editor**: chèn ảnh khác vào đúng khung kính vừa đóng băng, kéo-thả và pinch-zoom.
- **Chụp ảnh**: tap nhanh = đếm ngược, giữ lâu = burst, phím `Space` = chụp ngay.
- **Đổi camera trước / sau**, toàn màn hình, PWA cài được ra màn hình chính (offline-ready qua service worker).
- Giao diện tiếng Việt.

## Chạy local

Camera API cần HTTPS hoặc `localhost`, không chạy được qua `file://`. Phục vụ thư mục này qua HTTP server bất kỳ:

```bash
python -m http.server 8000
```

Mở [http://localhost:8000/](http://localhost:8000/). Test từ điện thoại: dùng HTTPS hoặc forward cổng về `localhost`.

## Cấu trúc

- [index.html](index.html) — entry point, nạp trực tiếp các file JS theo thứ tự cố định (không bundler).
- [js/](js/) — 14 file JS chia sẻ chung một global scope (`camera.js`, `editor.js`, `glass.js`, `webgl_beauty.js`, ...).
- [css/style.css](css/style.css) — toàn bộ style.
- [assets/](assets/) — icon, frame, sticker, LUT PNG.
- [sw.js](sw.js) — service worker cache-first cho chế độ offline.
- [manifest.webmanifest](manifest.webmanifest) — PWA manifest.

Không có build step, không có package manager, không có test suite. Toàn bộ là HTML + CSS + JS thuần chạy thẳng trên trình duyệt.

Chi tiết kiến trúc xem [CLAUDE.md](CLAUDE.md).

## Công nghệ

- [MediaPipe Hands](https://github.com/google-ai-edge/mediapipe) — landmark 21 điểm / bàn tay.
- WebGL 1 — pipeline fragment shader cho beauty + LUT + filter.
- Canvas 2D — vẽ glass shape và toàn bộ editor.
- Service Worker — cache app shell + MediaPipe CDN để dùng offline.
