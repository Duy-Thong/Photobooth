# Kế hoạch thương mại hóa — Multi-Studio Account System

> Mục tiêu: Chuyển Photobooth thành nền tảng B2B, mỗi studio có tài khoản riêng,
> chỉ xem được ảnh của studio mình. Superadmin quản lý tổng quát.

---

## Hiện trạng

| Thành phần | Trạng thái |
|---|---|
| Firebase Auth | ✅ Có, đang dùng cho admin |
| Sessions collection | ❌ Flat, không có `studioId` |
| Storage path | ❌ `sessions/{sessionId}/` — không phân studio |
| Photobooth | ❌ Open web, không cần đăng nhập |
| AdminPage | ⚠️ Permissions-based, chưa phân role |
| Firestore Rules | ❌ Sessions tạo/đọc public |

---

## Phase 1 — Data model (không breaking) ✅

**Mục tiêu:** Thêm `studioId` vào mọi session mới, không xóa dữ liệu cũ.

### 1.1 Types

```ts
// src/types/photobooth.ts — thêm
export interface StudioSession {
  studioId: string
}
```

### 1.2 SessionData

```ts
// src/lib/sessionService.ts
interface SessionData {
  // ... giữ nguyên
  studioId?: string   // ← thêm (optional để tương thích dữ liệu cũ)
}
```

### 1.3 Storage path

```
TRƯỚC: sessions/{sessionId}/strip.jpg
SAU:   sessions/{studioId}/{sessionId}/strip.jpg
```

### 1.4 AdminUser — thêm role

```ts
// src/types/admin.ts
interface AdminUser {
  // ... giữ nguyên
  role: 'superadmin' | 'studio'   // ← thêm
  studioName?: string              // ← thêm
}
```

**Files sửa:** `sessionService.ts`, `uploadService.ts`, `types/admin.ts`

---

## Phase 2 — Firestore Security Rules ✅

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSuperAdmin(uid) {
      return exists(/databases/$(database)/documents/admins/$(uid))
        && get(/databases/$(database)/documents/admins/$(uid)).data.role == 'superadmin';
    }

    match /sessions/{id} {
      // Guest có sessionId trực tiếp (từ QR) vẫn xem được
      allow get: if true;
      // Chỉ studio đã xác thực mới tạo, và phải gắn đúng uid của mình
      allow create: if request.auth != null
        && request.resource.data.studioId == request.auth.uid;
      // Studio chỉ list/xóa/update session của mình; superadmin xem tất cả
      allow list, delete, update: if request.auth != null
        && (resource.data.studioId == request.auth.uid || isSuperAdmin(request.auth.uid));
    }

    match /admins/{uid} {
      allow read: if request.auth != null
        && (request.auth.uid == uid || isSuperAdmin(request.auth.uid));
      allow write: if request.auth != null && isSuperAdmin(request.auth.uid);
    }

    // Frames: Giữ nguyên shared
    match /frames/{id} {
      allow read: if true;
      allow write: if request.auth != null && isSuperAdmin(request.auth.uid);
    }

    // Feedback & Requests: Giữ nguyên
    match /feedback/{id} {
      allow create: if true;
      allow read, delete: if request.auth != null;
    }
    match /frame_requests/{id} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

**Files sửa:** `firestore.rules`

---

## Phase 3 — Studio Auth Gate ✅

**Mục tiêu:** Photobooth yêu cầu login trước khi sử dụng.

### Router

```
/              → StudioLoginPage (nếu chưa login)
               → HomePage (nếu đã login là studio/admin)
/admin         → AdminPage (giữ nguyên, chỉ admin)
/session/:id   → SessionPage (public, không cần login)
```

### StudioLoginPage

- Tách riêng với AdminLoginPage (hoặc dùng chung, phân biệt bằng role sau login)
- Sau login thành công → redirect về `/`
- Logo + branding của studio (tuỳ chọn: lấy từ `adminUser.studioName`)

### useStudioAuth hook (mới)

```ts
// src/hooks/useStudioAuth.ts
// Tương tự useAdminAuth nhưng cho role 'studio'
// Expose: user, studioId, login, logout
```

### ProtectedRoute mở rộng

```tsx
// Hiện tại: chỉ check isAdmin
// Mới: check role — 'studio' hoặc 'superadmin' đều vào được HomePage
```

**Files thêm/sửa:** `router/index.tsx`, `hooks/useStudioAuth.ts`,
`pages/StudioLoginPage.tsx`, `components/admin/ProtectedRoute.tsx`

---

## Phase 4 — AdminPage phân quyền theo role ✅

**Mục tiêu:** Studio chỉ thấy sessions của mình. Superadmin thấy tất cả + quản lý studios.

### sessionService — filter theo studio

```ts
fetchSessions(studioId?: string): Promise<SessionData[]>
listenToSessions(callback, studioId?: string)
// Nếu studioId truyền vào → query where('studioId', '==', studioId)
// Nếu không → query all (superadmin)
```

### AdminPage — điều chỉnh tabs

| Tab | superadmin | studio |
|---|---|---|
| Ảnh | ✅ Tất cả studio | ✅ Chỉ của mình |
| Video | ✅ Tất cả studio | ✅ Chỉ của mình |
| Khung | ✅ Full CRUD | ❌ Ẩn |
| Yêu cầu | ✅ | ❌ Ẩn |
| Góp ý | ✅ | ❌ Ẩn |
| Studios | ✅ Quản lý tài khoản | ❌ Ẩn |

### Tab "Studios" mới (superadmin only)

- Danh sách tất cả studio (tên, email, ngày tạo, số session, trạng thái)
- Tạo tài khoản studio (email/password, tên studio)
- Khóa/mở khoá
- Xem session của từng studio

**Files sửa:** `sessionService.ts`, `AdminPage.tsx`  
**Files thêm:** (nếu tách) `pages/StudioDashboard.tsx`

---

## Phase 5 — Studio Dashboard (optional, v2) 🔮

Nếu muốn UX tốt hơn cho studio (không dùng AdminPage):

- `/studio/dashboard` — trang riêng cho studio
- Thống kê: số session hôm nay / tuần / tháng
- Gallery ảnh với filter ngày, tìm kiếm
- Nút print lại (đánh dấu đã in)
- Export CSV danh sách session

---

## Thứ tự thực hiện

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → (Phase 5 sau)
  1-2h      30ph      2-3h      2-3h
```

**Tổng ước tính: ~6-9h**

---

## Quyết định kỹ thuật quan trọng

| Câu hỏi | Quyết định |
|---|---|
| Studio có dùng HomePage không? | ✅ Có — giữ nguyên UX chụp ảnh |
| StudioLoginPage = AdminLoginPage? | Dùng chung, phân biệt role sau login |
| Session QR link có cần đăng nhập không? | ❌ Public (guest xem được) |
| Frames có phân theo studio không? | ❌ Shared — studio nào cũng dùng chung |
| Xóa dữ liệu session cũ (không có studioId)? | Giữ nguyên, superadmin vẫn thấy |
