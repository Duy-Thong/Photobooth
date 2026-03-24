# 📸 Photobooth — Thiết Kế Hệ Thống

> Tham khảo: [photo.freehihi.com](https://photo.freehihi.com/)  
> Stack: Vite + React + TypeScript + Tailwind CSS + Ant Design + Firebase (Serverless)

---

## 1. Tổng Quan Hệ Thống

Web app Photobooth chạy hoàn toàn trên trình duyệt (serverless), hỗ trợ mọi thiết bị có camera. Người dùng có thể chụp ảnh, áp dụng filter/effect, chọn khung trang trí và tải về.

```
┌─────────────────────────────────────────────────┐
│              PHOTOBOOTH WEB APP                 │
│         (Serverless SPA - Firebase Hosting)     │
├──────────────┬──────────────────────────────────┤
│   Frontend   │          Firebase Services        │
│  React + TS  │  Firestore │ Storage │ Auth       │
└──────────────┴──────────────────────────────────┘
```

---

## 2. Sitemap & Routing

```
/                         → Trang chủ — Chụp ảnh (core feature)
/feedbacks                → Bộ sưu tập ảnh cộng đồng
/support                  → Tải lên frame riêng (có phí)
/community-contribution   → Đóng góp frame miễn phí
/contact                  → Liên hệ
/app-photobooth           → Landing page giới thiệu app kinh doanh
/privateframe             → Hướng dẫn tạo frame PNG trong suốt
```

---

## 3. Các Trang & Tính Năng Chi Tiết

### 3.1 Trang Chủ `/` — Photobooth Studio

Màn hình chính chia 2 cột:

```
┌──────────────────────┬──────────────────┐
│   CAMERA / PREVIEW   │   PHOTO STRIP    │
│   (chiếm 65%)        │   (chiếm 35%)    │
│                      │  ┌────────────┐  │
│  [camera feed]       │  │  Slot 1    │  │
│                      │  └────────────┘  │
│  [Đã Chụp: 0/4]      │  ┌────────────┐  │
│                      │  │  Slot 2    │  │
├──────────────────────┤  └────────────┘  │
│  [Chụp tay] [AUTO]   │  ┌────────────┐  │
│  [Chụp Lại]          │  │  Slot 3    │  │
│  [Video Recap toggle]│  └────────────┘  │
│  [Tải ảnh lên]       │  ┌────────────┐  │
├──────────────────────┤  │  Slot 4    │  │
│  BỘ LỌC MÀU          │  └────────────┘  │
│  HIỆU ỨNG            │  [0/4]           │
└──────────────────────┴──────────────────┘
```

#### Thanh điều khiển trên cùng
| Thành phần | Loại | Mô tả |
|---|---|---|
| Layout Ảnh | Dropdown | 1x4 Strips, 2x2 Grid, v.v. |
| Đếm Ngược | Dropdown | 3s / 5s / 10s |
| Chọn Khung | Button → Modal | Mở thư viện frame |

#### Camera Controls
| Control | Mô tả |
|---|---|
| Flip/Mirror | Lật camera ngang |
| Flash | Bật/tắt hiệu ứng flash trắng khi chụp |
| Chụp tay | Chụp ngay lập tức |
| AUTO | Tự động chụp đủ số ảnh theo layout |
| Chụp Lại | Reset toàn bộ, chụp lại từ đầu |
| Video Recap | Toggle — Tạo video slideshow từ ảnh đã chụp |
| Tải ảnh lên | Upload ảnh có sẵn từ thiết bị |

#### Bộ Lọc Màu (áp dụng real-time lên camera)
| Filter | Mô tả |
|---|---|
| Bình thường | Không filter |
| Mono (Retro Effect) | Tông nâu vintage |
| Đen trắng | Grayscale |
| Mềm mại | Soft / warm tone |
| Dazz Classic | Phong cách film cổ điển |
| Dazz Instant | Phong cách Instax |

#### Hiệu Ứng (áp dụng sau khi chụp xong)
| Effect | Mô tả |
|---|---|
| 📅 TimeStamp | In ngày giờ lên ảnh |
| ☀️ Light Leak | Hiệu ứng rò sáng |
| 🌑 Vignette | Viền tối 4 góc |
| 🎞️ Grain | Hạt film |
| 🌈 Chromatic | Hiệu ứng aberration màu |

#### Photo Strip (cột phải)
- Hiển thị các ảnh đã chụp theo slot
- Mỗi slot có nút Upload để thay bằng ảnh từ máy
- Counter `0/4` theo dõi tiến độ
- Sau khi đủ ảnh → hiện nút **Tải Về** / **Chia Sẻ**

---

### 3.2 Trang Feedbacks `/feedbacks`

Gallery ảnh từ cộng đồng người dùng gửi về.

```
┌────────────────────────────────────────────┐
│  Bộ Sưu Tập Cộng Đồng                     │
│  "Khoảnh Khắc Của Bạn 💗"                  │
│                                            │
│  Stats: [🖼️ 0+ ảnh] [🔒 Bảo mật] [🆓 Free] │
│                                            │
│  [Masonry Grid / Waterfall layout]         │
│  ảnh 1  |  ảnh 2  |  ảnh 3               │
│    ảnh 4   |   ảnh 5   |  ảnh 6           │
│                                            │
│  [Gửi ảnh của bạn →] (link Google Form)   │
└────────────────────────────────────────────┘
```

- Ảnh được lưu trên Firebase Storage, metadata trên Firestore
- Website **không lưu ảnh người dùng** chụp (chỉ xử lý local)
- Người dùng tự nguyện gửi ảnh qua Google Form

---

### 3.3 Trang Tải Lên Frame Riêng `/support` (Premium)

Wizard 3 bước để upload frame cá nhân hoá:

```
Bước 1: Bản thiết kế
  └─ Upload file PNG trong suốt (max 10MB)

Bước 2: Cấu hình
  ├─ Chọn layout tương thích
  ├─ Đặt tên frame
  └─ Visibility: Chỉ mình tôi / Chia sẻ bằng mã

Bước 3: Thanh toán
  └─ Chọn gói thời hạn → thanh toán
```

**Quyền lợi gói trả phí:**
- ✨ Xuất hiện ngay sau khi thanh toán
- 🔑 Chia sẻ frame với người khác qua **mã frame**
- 🛡️ Lưu trữ an toàn trong suốt thời hạn gói

---

### 3.4 Trang Đóng Góp Frame `/community-contribution` (Free)

Dành cho nhà thiết kế muốn chia sẻ frame miễn phí cho cộng đồng.

```
┌────────────────────────────────────────┐
│  ✨ CHIA SẺ VÌ CỘNG ĐỒNG               │
│  "Đóng Góp Frame"                      │
│                                        │
│  [Mở Form Đóng Góp Ngay] → Google Form│
│                                        │
│  Yêu cầu:                              │
│  1. File PNG nền trong suốt            │
│  2. Đúng tỷ lệ dải ảnh photobooth     │
│  3. Không vi phạm bản quyền           │
│                                        │
│  Quy trình duyệt: 12-24h              │
└────────────────────────────────────────┘
```

---

## 4. Kiến Trúc Kỹ Thuật

### 4.1 Frontend Architecture

```
src/
├── components/
│   ├── layout/
│   │   └── MainLayout.tsx          # App shell + Navigation
│   ├── photobooth/
│   │   ├── CameraView.tsx          # Camera feed + WebRTC
│   │   ├── PhotoStrip.tsx          # Dải ảnh kết quả
│   │   ├── PhotoSlot.tsx           # 1 slot ảnh
│   │   ├── ControlBar.tsx          # Toolbar điều khiển
│   │   ├── FilterPanel.tsx         # Bộ lọc màu
│   │   ├── EffectPanel.tsx         # Hiệu ứng
│   │   ├── FrameSelector/
│   │   │   ├── FrameModal.tsx      # Modal chọn khung
│   │   │   ├── FrameCard.tsx       # 1 frame item
│   │   │   └── FrameSearch.tsx     # Tìm kiếm frame
│   │   └── DownloadPanel.tsx       # Tải về / chia sẻ
│   ├── feedback/
│   │   ├── FeedbackGallery.tsx     # Masonry grid
│   │   └── FeedbackCard.tsx
│   └── ui/                         # Shared UI components
│       ├── CountdownOverlay.tsx
│       └── FlashOverlay.tsx
├── pages/
│   ├── HomePage.tsx
│   ├── FeedbacksPage.tsx
│   ├── SupportPage.tsx
│   ├── ContributionPage.tsx
│   ├── ContactPage.tsx
│   └── AppLandingPage.tsx
├── hooks/
│   ├── useCamera.ts                # Camera stream, flip, flash
│   ├── usePhotoCapture.ts          # Logic chụp, đếm ngược
│   ├── useFilter.ts                # CSS filter real-time
│   ├── useCanvasEffect.ts          # Canvas post-effects
│   ├── usePhotoStrip.ts            # Ghép ảnh + frame → canvas
│   └── useVideoRecap.ts            # Tạo video từ ảnh
├── lib/
│   ├── firebase.ts                 # Firebase init
│   ├── imageProcessing.ts          # Canvas utilities
│   └── frameUtils.ts               # Frame PNG overlay
├── stores/
│   ├── photoboothStore.ts          # Zustand: trạng thái chụp
│   └── frameStore.ts               # Zustand: frame đã chọn
├── router/
│   └── index.tsx
└── types/
    ├── frame.ts
    └── photobooth.ts
```

### 4.2 Firebase Schema

#### Firestore Collections

**`frames`** — Thư viện khung ảnh công khai
```ts
{
  id: string
  name: string
  category: string           // "trending" | "holiday" | "cute" | ...
  thumbnailUrl: string       // Firebase Storage URL
  frameUrl: string           // PNG trong suốt, Firebase Storage
  layouts: LayoutType[]      // ["1x4", "2x2", ...]
  contributor?: string       // Tên người đóng góp
  isPublic: boolean
  downloadCount: number
  createdAt: Timestamp
  approvedAt?: Timestamp
  status: "pending" | "approved" | "rejected"
}
```

**`privateFrames`** — Frame trả phí của người dùng
```ts
{
  id: string
  ownerId: string            // Firebase Auth UID
  shareCode: string          // Random 6-char code để chia sẻ
  frameUrl: string
  thumbnailUrl: string
  layouts: LayoutType[]
  plan: "1month" | "3months" | "lifetime"
  expiresAt: Timestamp
  createdAt: Timestamp
}
```

**`feedbacks`** — Ảnh cộng đồng
```ts
{
  id: string
  imageUrl: string           // Firebase Storage
  caption?: string
  submittedAt: Timestamp
  approved: boolean
}
```

**`contributions`** — Frame đóng góp (queue duyệt)
```ts
{
  id: string
  uploaderEmail: string
  frameFileUrl: string       // Temp Storage, chờ duyệt
  message?: string
  submittedAt: Timestamp
  status: "pending" | "approved" | "rejected"
  reviewNote?: string
}
```

#### Firebase Storage Structure
```
/frames/
  public/{frameId}.png
  thumbnails/{frameId}.jpg
/privateFrames/
  {userId}/{frameId}.png
/feedbacks/
  {feedbackId}.jpg
```

### 4.3 State Management (Zustand)

**`photoboothStore`**
```ts
{
  // Camera
  stream: MediaStream | null
  isMirrored: boolean
  flashEnabled: boolean

  // Session
  layout: LayoutConfig       // { type: "1x4", slots: 4 }
  countdown: number          // 3 | 5 | 10
  capturedPhotos: string[]   // base64 ảnh đã chụp
  captureMode: "manual" | "auto"
  isCapturing: boolean

  // Frame & Filter
  selectedFrame: Frame | null
  activeFilter: FilterType
  activeEffects: EffectType[]

  // Output
  finalImageUrl: string | null
  videoRecapUrl: string | null
}
```

---

## 5. Các Layout Ảnh

| Layout | Slots | Tỷ lệ output | Mô tả |
|---|---|---|---|
| 1×4 Strips | 4 | ~2:7 | 4 ảnh dọc xếp chồng |
| 2×2 Grid | 4 | 1:1 | 2x2 ảnh vuông |
| 1×3 Strips | 3 | ~2:5 | 3 ảnh dọc |
| 1×2 Strips | 2 | ~2:3 | 2 ảnh dọc |
| Full | 1 | 4:3 / 1:1 | 1 ảnh toàn màn hình |

---

## 6. Luồng Xử Lý Ảnh (Image Pipeline)

```
Camera Stream (WebRTC)
        │
        ▼
  Apply CSS Filter (real-time preview)
        │
        ▼
  [Capture] → drawImage to Canvas
        │
        ├─ Crop to slot aspect ratio
        │
        ▼
  Apply Canvas Effects
  (TimeStamp / Grain / Vignette / LightLeak / Chromatic)
        │
        ▼
  Collect all slots
        │
        ▼
  Composite Strip Canvas
  ┌───────────────────┐
  │  Background color │
  │  Photo slot 1     │
  │  Photo slot 2     │
  │  Photo slot 3     │
  │  Photo slot 4     │
  │  Frame PNG overlay│ ← drawImage(frame, 0, 0, w, h)
  └───────────────────┘
        │
        ▼
  canvas.toBlob() → Blob URL
        │
        ├── Download as JPG/PNG
        └── (Optional) Upload to Firebase Storage
```

---

## 7. Tính Năng Premium — Frame Riêng

```
User Upload PNG
    │
    ▼
Validate (size, format, dimensions)
    │
    ▼
Preview + Configure (layout, name, visibility)
    │
    ▼
Payment (tích hợp cổng thanh toán VN)
    │
    ▼
Upload to Firebase Storage (/privateFrames/{uid}/)
    │
    ▼
Save to Firestore (privateFrames collection)
Generate shareCode (6 chars)
    │
    ▼
Frame xuất hiện trong Frame Selector của user
    │
    └── Chia sẻ qua shareCode → người khác nhập code để dùng
```

---

## 8. Navigation & Menu

```
[☰ Menu]
├── Trang Chủ              /
├── Xem Ảnh FeedBack       /feedbacks
├── Tải Lên Frame Riêng    /support      [Premium]
├── Đóng Góp Frame         /community-contribution
├── Liên Hệ               /contact
└── Tiện Ích Free Khác     [Dropdown external links]

--- Promo Banner ---
[DÀNH CHO CHỦ SHOP ✨ → /app-photobooth]
```

---

## 9. Responsive & UX

### Breakpoints
| Breakpoint | Layout |
|---|---|
| Mobile (`< 768px`) | Stack dọc: Camera trên, Strip dưới |
| Tablet (`768px–1024px`) | 2 cột, camera 55% / strip 45% |
| Desktop (`> 1024px`) | 2 cột, camera 65% / strip 35% |

### UX Notes
- Camera loading state: skeleton + "Đang khởi động camera..."
- Countdown overlay số lớn ở giữa màn hình
- Flash effect: full-screen white overlay khi chụp
- Nút Chụp tay / AUTO disable khi chưa đủ điều kiện
- Photo slot hover: show nút thay thế ảnh
- Frame Modal: lazy load, search, phân category

---

## 10. Màu Sắc & Design Token

Lấy cảm hứng từ UI gốc — tông hồng pastel, nhẹ nhàng:

```css
/* Primary palette */
--color-primary:        #F472B6   /* pink-400 */
--color-primary-light:  #FDF2F8   /* pink-50 */
--color-primary-dark:   #DB2777   /* pink-600 */

/* Background */
--color-bg:             #FDF2F8   /* Hồng rất nhạt */
--color-surface:        #FFFFFF
--color-border:         #FBCFE8   /* pink-200 */

/* Text */
--color-text:           #1F2937
--color-text-secondary: #6B7280

/* Font */
--font-display: 'Dancing Script', cursive   /* Logo */
--font-body:    'Inter', sans-serif
```

---

## 11. Firebase Security Rules

```
// Firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Frames: public read, admin write
    match /frames/{frameId} {
      allow read: if resource.data.isPublic == true;
      allow write: if request.auth.token.admin == true;
    }

    // Private frames: owner only
    match /privateFrames/{frameId} {
      allow read: if request.auth.uid == resource.data.ownerId
                  || request.resource.data.shareCode == resource.data.shareCode;
      allow write: if request.auth.uid == resource.data.ownerId;
    }

    // Feedbacks: public read, authenticated create
    match /feedbacks/{feedbackId} {
      allow read: if resource.data.approved == true;
      allow create: if request.auth != null;
    }
  }
}
```

---

## 12. Roadmap Tính Năng

### MVP (Phase 1)
- [x] Camera capture với WebRTC
- [x] Layout 1×4 Strips
- [x] CSS filters (6 bộ lọc)
- [x] Frame overlay (thư viện tĩnh)
- [x] Download ảnh
- [x] Upload ảnh từ máy

### Phase 2
- [ ] Thư viện frame từ Firestore (dynamic)
- [ ] Multiple layouts (2×2, 1×3, 1×2)
- [ ] Canvas post-effects (Grain, Vignette, v.v.)
- [ ] Video Recap feature
- [ ] Trang Feedbacks gallery

### Phase 3 (Premium)
- [ ] Auth (Google login / Zalo)
- [ ] Private frame upload + payment
- [ ] Share frame by code
- [ ] Admin dashboard duyệt frame
- [ ] Contribution flow

---

*Tài liệu được tạo ngày 24/03/2026 — tham khảo photo.freehihi.com*
