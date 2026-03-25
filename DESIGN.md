# 📸 Sổ Media — Photobooth · Thiết Kế Hệ Thống

> Stack: Vite 6 + React 19 + TypeScript + Tailwind CSS 4 + Ant Design 6 + Firebase 12 + Zustand 5 + Vercel Analytics

---

## 1. Tổng Quan Hệ Thống

Web app Photobooth chạy hoàn toàn trên trình duyệt (serverless), hỗ trợ mọi thiết bị có camera. Người dùng chụp ảnh, chọn filter/effect, chọn khung trang trí, xem preview live, rồi tải về. Ảnh & video recap được upload lên Firebase Storage và đóng dấu QR để chia sẻ.

```
┌────────────────────────────────────────────────────────┐
│              SỔ MEDIA — PHOTOBOOTH WEB APP             │
│          (Serverless SPA — Vercel + Firebase)          │
├──────────────┬─────────────────────────────────────────┤
│   Frontend   │          Firebase Services              │
│  React + TS  │  Storage (ảnh + video recap)  │ Auth    │
└──────────────┴─────────────────────────────────────────┘
```

---

## 2. Sitemap & Routing

```
/                  → Trang chủ — Photobooth Studio (core feature)
/admin/login       → Đăng nhập Admin
/admin             → Admin Panel — quản lý media trên Firebase Storage
```

> Các trang `/feedbacks`, `/support`, `/community-contribution`, `/contact`, `/app-photobooth` **chưa implement**.

---

## 3. Các Trang & Tính Năng

### 3.1 Trang Chủ `/` — Photobooth Studio

Header nhỏ ở trên cùng, bên dưới chia 2 cột trên desktop:

```
┌────────────────────────────────────────────────────────┐
│                    Sổ Media · PHOTOBOOTH               │
├──────────────────────────────────────┬─────────────────┤
│  KHUNG: [🖼 Chọn khung]              │                 │
│  ĐẾM NGƯỢC: [3s] [5s] [10s]         │                 │
├──────────────────────────────────────┤  PHOTO STRIP    │
│                                      │  (live preview) │
│  [Camera Feed]                       │                 │
│  [Lật ngang]  [Device Selector ▼]   │  [mini slots]   │
│  [0 / 4]                             │  [0/4]          │
├──────────────────────────────────────┤  [Tạo Ảnh]     │
│  [Chụp]  [AUTO]  [Lại]              │  [Tải Về]       │
│  [Video Recap toggle] [Tải ảnh lên] │                 │
├──────────────────────────────────────┴─────────────────┤
│  BỘ LỌC MÀU   │   HIỆU ỨNG (sau khi chụp)             │
└────────────────────────────────────────────────────────┘
```

#### Thanh điều khiển trên cùng (TopControls)
| Thành phần | Loại | Mô tả |
|---|---|---|
| Chọn Khung | Button → Modal | Mở thư viện frame; khi đã chọn hiện "Đổi khung" + nút ✕ bỏ khung |
| Đếm Ngược | Pill buttons | 3s / 5s / 10s |

> **Không có Layout dropdown** — layout được tự động phát hiện từ frame khi chọn khung.

#### Camera Controls (CameraView + CaptureControls)
| Control | Mô tả |
|---|---|
| Lật ngang | Mirror camera theo chiều ngang |
| Device Selector | Dropdown chọn camera/webcam (nếu có nhiều thiết bị) |
| Bộ đếm `0 / 4` | Hiển thị số ảnh đã chụp / tổng slots |
| Chụp | Đếm ngược rồi chụp 1 ảnh (flash trắng + capture frame) |
| AUTO | Tự động chụp đủ số ảnh còn lại theo thứ tự |
| Lại | Reset toàn bộ ảnh, frame, video recap — bắt đầu lại |
| Video Recap | Toggle — ghi video từng slot trong khi chụp |
| Tải ảnh lên | Upload ảnh từ thiết bị vào slot trống tiếp theo |

#### Bộ Lọc Màu — áp dụng real-time lên camera (CSS filter)
| Filter | CSS |
|---|---|
| Bình Thường | `none` |
| Mono (Retro) | `sepia(0.8) contrast(1.1) saturate(0.7)` |
| Đen Trắng | `grayscale(1)` |
| Mềm Mại | `brightness(1.1) saturate(1.2) contrast(0.9)` |
| Dazz Classic | `sepia(0.4) contrast(1.15) saturate(1.3) hue-rotate(-10deg)` |
| Dazz Instant | `saturate(1.4) contrast(1.05) brightness(1.05) hue-rotate(5deg)` |

#### Hiệu Ứng — áp dụng lên canvas sau khi chụp
| Effect | Mô tả |
|---|---|
| 📅 TimeStamp | In ngày giờ lên ảnh |
| ☀️ Light Leak | Hiệu ứng rò sáng |
| 🌑 Vignette | Viền tối 4 góc |
| 🎞️ Grain | Hạt film |
| 🌈 Chromatic | Aberration màu |

#### Photo Strip (cột phải)
- **Live composite preview**: render ngay khi có ảnh/frame mới (dùng `useStripPreview`, debounce 80ms)
- **Mini slot thumbnails**: hàng dưới gồm các ô 32×32px, click để thay ảnh, hover để xóa slot
- Counter `0/4` và nút **Tạo Ảnh** (khi đủ ảnh)
- Sau khi build xong → hiện **Result Modal**

#### Result Modal (sau khi tạo ảnh)
Quy trình nhiều phase:
| Phase | Mô tả |
|---|---|
| `confirm` | Xem preview ảnh + strip video recap; chọn "Tải lên" hoặc bỏ qua |
| `uploading` | Upload ảnh lên `photobooth/` và strip video lên `recap/` (song song) |
| `stamping` | Đóng dấu QR code (`stampQrOnImage`) chứa link Firebase vào góc ảnh |
| `done` | Hiển thị ảnh hoàn chỉnh + QR code + nút Tải về / Chụp lại / Đổi khung |
| `error` | Thông báo lỗi upload |

---

### 3.2 Admin Panel `/admin`

Giao diện quản lý media upload trên Firebase Storage. Yêu cầu đăng nhập (`/admin/login`).

```
┌────────────────────────────────────────────────────────┐
│  Sổ Media · Admin Panel   [user@email]  [↻] [🕐] [🗑] [←]│
├────────────────────────────────────────────────────────┤
│  Ảnh (N)  │  Video (N)                                 │
├────────────────────────────────────────────────────────┤
│  Grid: ảnh 3:4  hoặc  video 16:9 + play icon          │
│  Hover: nút Xóa từng file                              │
│  Click: Modal preview (ảnh / video autoplay)           │
└────────────────────────────────────────────────────────┘
```

**Tính năng:**
- Tab **Ảnh** (`photobooth/`) và **Video** (`recap/`) tách biệt
- Xóa từng file (confirm dialog)
- **Xóa tất cả** trong tab hiện tại
- **Cũ > 7 ngày**: xóa đồng loạt ảnh + video cũ hơn 7 ngày
- Preview modal: ảnh full-width / video autoplay, nút "Mở link ↗" và "Xóa"
- Hiển thị ngày tạo + dung lượng mỗi file

---

## 4. Kiến Trúc Kỹ Thuật

### 4.1 Frontend Architecture (thực tế)

```
src/
├── components/
│   ├── admin/
│   │   └── ProtectedRoute.tsx        # Bảo vệ /admin
│   ├── layout/
│   │   ├── index.ts
│   │   └── MainLayout.tsx            # Ant Design Layout shell (chỉ <Outlet/>)
│   └── photobooth/
│       ├── CameraView.tsx            # Camera feed + mirror + device selector
│       ├── CaptureControls.tsx       # Chụp / AUTO / Lại / Video Recap / Upload
│       ├── FilterPanel.tsx           # Bộ lọc màu + hiệu ứng
│       ├── FrameModal.tsx            # Modal chọn khung (search, categories, slot filter)
│       ├── PhotoSlot.tsx             # Helper slot (dùng trong PhotoStrip)
│       ├── PhotoStrip.tsx            # Live preview + mini slots + nút build/download
│       ├── ResultModal.tsx           # Modal kết quả (confirm→upload→QR→done)
│       └── TopControls.tsx           # Chọn khung + đếm ngược
├── hooks/
│   ├── useAdminAuth.ts               # Firebase Auth login/logout
│   ├── useCamera.ts                  # WebRTC stream, mirror, device list, captureFrame
│   ├── useStripPreview.ts            # Debounced live composite preview (canvas → blob URL)
│   └── useVideoRecap.ts              # MediaRecorder per-slot, getVideoMimeType
├── lib/
│   ├── firebase.ts                   # Firebase app + storage init
│   ├── frames-static.ts              # STATIC_FRAMES[] — danh sách frame tĩnh
│   ├── frameService.ts               # fetchFrames(), fetchCategories(), frameImageUrl()
│   ├── imageProcessing.ts            # applyEffects, detectFrameSlots (DFS),
│   │                                 # buildStripImage, buildStripVideo, stampQrOnImage
│   └── uploadService.ts              # uploadPhotoToFirebase, uploadVideoToFirebase
├── pages/
│   ├── AdminLoginPage.tsx            # Form đăng nhập
│   ├── AdminPage.tsx                 # Media manager
│   └── HomePage.tsx                  # Photobooth studio
├── router/
│   └── index.tsx                     # createBrowserRouter: /, /admin/login, /admin
├── stores/
│   └── photoboothStore.ts            # Zustand: toàn bộ state photobooth
└── types/
    └── photobooth.ts                 # FilterType, EffectType, LayoutType, LAYOUTS, FILTERS, EFFECTS
```

### 4.2 Firebase

**Storage paths thực tế:**
```
/photobooth/
  {timestamp}_{random}.jpg       ← ảnh strip upload từ ResultModal
/recap/
  {timestamp}_{random}.webm|mp4  ← strip video recap upload từ ResultModal
```

**Frame assets:** phục vụ tĩnh từ `/public/frames/*.png` — **không dùng Firebase Storage**.

**Auth:** Firebase Email/Password — chỉ dùng cho Admin Panel.

> **Firestore không được dùng** trong phiên bản hiện tại. Frame metadata lưu tĩnh trong `frames-static.ts`.

### 4.3 State Management (Zustand)

**`photoboothStore`** — single store duy nhất:
```ts
{
  // Layout & countdown
  layout: LayoutConfig          // default: LAYOUTS[0] = 1×4 Strips
  countdown: number             // 3 | 5 | 10
  setLayout(layout)             // reset capturedSlots
  setLayoutKeepPhotos(layout)   // chỉ đổi layout, giữ ảnh
  setCountdown(n)

  // Filter & effects
  activeFilter: FilterType
  activeEffects: EffectType[]
  setFilter(f)
  toggleEffect(e)

  // Captured photos
  capturedSlots: (CapturedSlot | null)[]
  addPhoto(dataUrl, fromCamera?)   // điền vào slot trống đầu tiên
  replaceSlot(index, dataUrl)
  resetPhotos()

  // Flow control
  isCapturing: boolean
  setIsCapturing(v)

  // Output
  finalImageUrl: string | null
  setFinalImageUrl(url)

  // Frame
  frameUrl: string | null
  setFrameUrl(url)
}
```

---

## 5. Các Layout Ảnh

| Layout | Type | Slots | Cols | Rows | Mô tả |
|---|---|---|---|---|---|
| 1×4 Strips | `1x4` | 4 | 1 | 4 | 4 ảnh dọc xếp chồng (default) |
| 2×2 Grid | `2x2` | 4 | 2 | 2 | 2×2 ảnh vuông |
| 1×3 Strips | `1x3` | 3 | 1 | 3 | 3 ảnh dọc |
| 2×3 Grid | `2x3` | 6 | 2 | 3 | 6 ảnh lưới lớn |
| 1×2 Strips | `1x2` | 2 | 1 | 2 | 2 ảnh dọc |
| 1×1 Full | `1x1` | 1 | 1 | 1 | 1 ảnh toàn màn hình |

> Layout **tự động thay đổi** khi chọn frame — `detectFrameSlots` quét vùng trong suốt (DFS) để xác định số slot và loại layout phù hợp.

---

## 6. Hệ Thống Frame

- Frame phục vụ tĩnh từ `/public/frames/*.png` (PNG trong suốt)
- Metadata trong `src/lib/frames-static.ts` — mảng `STATIC_FRAMES[]`
- Mỗi frame: `id, filename, name, frame ('square'|'bigrectangle'|'grid'), categoryId, categoryName, slots (3|4|6)`
- **Categories hiện có:** Frame Amazing ⭐️, Frame Cartoon, Frame Basic, Frame IDOL Hoạt Họa, Frame Chụp Cùng Idol, Frame Đại Học, Frame Sự Kiện
- **Frame Modal:** search theo tên, lọc theo số ảnh, lọc theo danh mục, preview → "Áp dụng"
- **Không có frame động từ Firestore / premium frame** trong phiên bản hiện tại

---

## 7. Luồng Xử Lý Ảnh (Image Pipeline)

```
Camera Stream (WebRTC)
        │
        ▼
  Apply CSS Filter (real-time preview trên <video>)
        │ [Chụp / AUTO — có countdown + flash white overlay]
        ▼
  captureFrame() → drawImage(<video>) → canvas.toDataURL()
        │
        ▼
  addPhoto(dataUrl) → capturedSlots[]
        │
        ▼
  useStripPreview (debounce 80ms)
  → buildStripImage (preview, không effect) → previewUrl
        │
  [Đủ slots → tự động build strip hoặc mở FrameModal]
        ▼
  buildStripImage(capturedSlots, layout, activeEffects, frameUrl)
  ┌─────────────────────────────────────────────┐
  │ 1. detectFrameSlots(frameUrl) → slot rects  │
  │ 2. Vẽ từng ảnh vào đúng slot rect           │
  │ 3. applyEffects (Grain/Vignette/LightLeak/  │
  │    Chromatic/TimeStamp) lên từng slot        │
  │ 4. Overlay frame PNG lên toàn canvas         │
  │    (hoặc fallback grid nếu không có frame)   │
  └─────────────────────────────────────────────┘
        │
        ▼
  canvas.toBlob() → blobURL → finalImageUrl
        │
        ▼
  ResultModal (confirm → upload → QR stamp → done)
        │
        ├── uploadPhotoToFirebase → photobooth/{name}.jpg
        ├── uploadVideoToFirebase → recap/{name}.webm|mp4  (nếu có video)
        ├── stampQrOnImage(blobUrl, firebaseUrl) → finalWithQr
        └── downloadImage(finalWithQr)
```

### Video Recap Pipeline
```
[Chụp mỗi slot]
  → startRecording(30fps) — MediaRecorder ghi <video> stream
  → stopRecording() → blobUrl per clip → recapClips[]

[Sau khi có finalImageUrl]
  → buildStripVideo(recapClips, frameUrl, 24fps)
     - Decode từng clip frames lên canvas
     - Overlay frame PNG
     - Encode lại bằng MediaRecorder
  → recapStripUrl (combined strip video)

[Upload trong ResultModal]
  → uploadVideoToFirebase(recapStripUrl) → recap/{name}.webm|mp4
```

---

## 8. Responsive

| Breakpoint | Layout |
|---|---|
| Mobile (`< md`) | Stack dọc: camera + controls trên, photo strip dưới |
| Desktop (`≥ md`) | 2 cột: camera/controls bên trái (flex-1), photo strip bên phải (w-44/w-64 tùy layout) |

Photo strip width: `md:w-64 lg:w-72` khi layout 2 cột, `md:w-44 lg:w-48` khi layout 1 cột.

---

## 9. Màu Sắc & Design Token (Dark Theme)

App sử dụng theme **tối hoàn toàn**:

```css
/* Background layers */
--bg-app:       #0a0a0a   /* nền app chính */
--bg-surface:   #0d0d0d   /* card, strip container */
--bg-elevated:  #111111   /* modal body, admin bg */
--bg-panel:     #141414   /* header border, dividers */
--bg-item:      #1a1a1a   /* cards trong admin */
--bg-control:   #1e1e1e   /* buttons, inputs */

/* Border */
--border-subtle:  #141414
--border-default: #1e1e1e
--border-medium:  #2a2a2a
--border-active:  #3a3a3a / #444

/* Text */
--text-primary:   #ffffff
--text-secondary: #aaaaaa
--text-muted:     #666666
--text-dim:       #555555

/* Active state pills */
--pill-active-bg:    #ffffff
--pill-active-text:  #000000
```

Font: system-ui / sans-serif (không cấu hình font riêng hiện tại).

---

## 10. Firebase Security Rules

```js
// Storage — upload từ client được phép (ảnh strip + video recap)
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photobooth/{file} {
      allow read: if true;
      allow write: if true;
    }
    match /recap/{file} {
      allow read: if true;
      allow write: if true;
    }
    match /frames/{file} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

---

## 11. Roadmap / Trạng Thái Tính Năng

### ✅ Hoàn thành (MVP)
- [x] Camera capture với WebRTC (mirror, device selector)
- [x] Đếm ngược + flash overlay
- [x] Layout 1×4, 2×2, 1×3, 2×3, 1×2, 1×1
- [x] CSS filters real-time (6 bộ lọc)
- [x] Canvas post-effects (TimeStamp, Grain, Vignette, LightLeak, Chromatic)
- [x] Frame overlay — thư viện tĩnh với search + category + slot filter
- [x] Auto detect layout từ frame (DFS transparency scan)
- [x] Live composite preview (debounced canvas render)
- [x] Upload ảnh từ máy vào slot / replace / remove slot
- [x] Build & download ảnh strip
- [x] Video Recap per-slot + buildStripVideo với frame overlay
- [x] Result Modal: confirm → upload → QR stamp → done
- [x] Upload ảnh + video lên Firebase Storage
- [x] QR code stamping (link về Firebase URL)
- [x] Admin Panel: quản lý ảnh/video trên Storage (tab, preview, xóa)
- [x] Admin Auth (Firebase Email/Password + ProtectedRoute)
- [x] Xóa từng file / xóa tất cả / xóa cũ > 7 ngày

### 🔲 Chưa implement
- [ ] Trang Feedbacks gallery (`/feedbacks`)
- [ ] Trang Premium Frame upload (`/support`)
- [ ] Trang Community Contribution (`/community-contribution`)
- [ ] Trang Contact (`/contact`)
- [ ] Navigation menu
- [ ] Frame động từ Firestore
- [ ] Private frame + shareCode
- [ ] Payment integration
- [ ] Admin frame approval workflow

---

*Cập nhật: 25/03/2026 — phản ánh code thực tế đang chạy*
