# 📸 Sổ Media Photobooth

Ứng dụng Photobooth chụp và in ảnh kỷ niệm trực tuyến của CLB Truyền thông Sổ Media (PTIT).

---

## 🛠️ Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **UI Components:** Ant Design (antd v6) + Ant Design Icons
- **State Management:** Zustand
- **Backend / Database:** Firebase Authentication, Cloud Firestore, Firebase Storage
- **Deployment:** Vercel

---

## 🚀 Tính năng chính

- 📷 **Chụp ảnh linh hoạt:** Hỗ trợ camera trước/sau, lật gương, hẹn giờ đếm ngược (0s, 3s, 5s, 10s), âm thanh trập máy.
- 🎞️ **Bố cục đa dạng:** Hỗ trợ nhiều layout (1×4, 2×2, 1×3, 2×3, 1×2, 1×1) và nhân đôi strip (x2).
- 🎬 **Video Recap:** Tự động ghi lại các khoảnh khắc ngắn trước mỗi lần bấm máy và ghép thành video recap phát đồng thời.
- 🖼️ **Khung ảnh (Frames):** Tự động phát hiện vị trí slot trong suốt trên khung PNG và khớp ảnh vào khung. Hỗ trợ người dùng đóng góp khung ảnh mới.
- 🖨️ **In ảnh chuẩn khổ:** Tích hợp in ảnh chuẩn khổ 4×6 inch (10×15 cm) trực tiếp từ trình duyệt cho 1 hoặc nhiều ảnh.
- 📱 **QR Code & Chia sẻ:** Tạo QR code để khách quét và tải ảnh/video trực tiếp về điện thoại hoặc chia sẻ qua Web Share API.
- 🛡️ **Admin Panel quản trị:** Quản lý kho ảnh, video, danh mục khung ảnh, duyệt đề xuất từ người dùng, quản trị tài khoản và phân quyền.

---

## 📦 Cài đặt & Khởi chạy

### 1. Yêu cầu môi trường
- Node.js >= 20.x
- npm >= 10.x

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env.local` dựa trên `.env.example`:
```bash
cp .env.example .env.local
```
Điền các thông tin cấu hình Firebase:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

VITE_ADMIN_EMAIL=admin@example.com
```

### 4. Chạy môi trường phát triển
```bash
npm run dev
```

### 5. Build production
```bash
npm run build
```

---

## 📁 Cấu trúc thư mục

```
src/
├── assets/          # Static assets (logos, images)
├── components/      # UI components
│   ├── admin/       # Components & Tabs cho Admin Panel
│   │   └── tabs/    # MediaTab, FramesTab, RequestsTab, FeedbackTab, AdminsTab
│   ├── feedback/    # Feedback bubble & modal
│   ├── layout/      # Layout chung
│   └── photobooth/  # CameraView, PhotoStrip, CaptureControls, Modals
├── hooks/           # Custom hooks (useCamera, useAdminAuth, useVideoRecap, ...)
├── lib/             # Services & Utilities (firebase, imageProcessing, printService, ...)
├── pages/           # Pages (HomePage, AdminPage, AdminLoginPage, SessionPage)
├── router/          # Cấu hình routes với Code-Splitting (React.lazy)
├── stores/          # Zustand stores (photoboothStore, themeStore)
└── types/           # TypeScript interfaces & types
```

---

## 📄 Bản quyền

© CLB Truyền thông Sổ Media - PTIT.
