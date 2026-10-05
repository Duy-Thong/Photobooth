---
name: review-repo
description: >-
  Use this skill when the user asks to review, audit, or assess the repository
  from a production-readiness perspective. This skill runs a structured checklist
  covering code quality, security, performance, observability, CI/CD, dependency
  management, documentation, and deployment concerns. Activate when user says
  "review repo", "audit code", "production checklist", "kiểm tra repo", or similar.
---

# Production Repo Review Skill

Khi được kích hoạt, hãy thực hiện đánh giá toàn diện repo theo các hạng mục dưới đây.
Với mỗi hạng mục, hãy **chủ động đọc file thực tế** trong repo để đưa ra nhận xét cụ thể,
không nhận xét chung chung. Kết quả trả về dưới dạng **artifact Markdown** có cấu trúc rõ ràng.

---

## Quy trình thực hiện

### Bước 1 — Khám phá cấu trúc repo

```bash
# Xem cấu trúc thư mục gốc
ls / tree (tùy môi trường)
# Đọc README, package.json / pyproject.toml / go.mod / Cargo.toml / pom.xml
# Đọc .env.example, docker-compose.yml, Dockerfile nếu có
```

Mục đích: hiểu stack công nghệ, kiến trúc, điểm vào của ứng dụng.

### Bước 2 — Chạy các checklist theo hạng mục

Thực hiện lần lượt từng hạng mục trong [references/checklist.md](./references/checklist.md).
Với mỗi mục:
- Đọc file liên quan để kiểm tra thực tế.
- Đánh dấu **✅ Pass / ⚠️ Warning / ❌ Fail**.
- Ghi chú ngắn gọn lý do + dòng file cụ thể nếu có.

### Bước 3 — Tổng hợp kết quả

Tạo artifact `repo-review.md` với:
1. **Executive Summary** — điểm tổng thể (0–10), nhận xét 3 dòng.
2. **Kết quả từng hạng mục** — bảng Pass/Warning/Fail.
3. **Top 5 vấn đề ưu tiên** — mô tả vấn đề + đề xuất fix cụ thể.
4. **Quick Wins** — những thứ dễ fix ngay trong < 30 phút.
5. **Roadmap đề xuất** — chia 3 giai đoạn: Now / Next Sprint / Later.

### Bước 4 — Hỏi người dùng

Sau khi có artifact, hỏi người dùng muốn đi sâu vào hạng mục nào để fix ngay.

---

## Hướng dẫn chấm điểm

| Mức | Điều kiện |
|-----|-----------|
| ✅ Pass | Đáp ứng hoàn toàn tiêu chí |
| ⚠️ Warning | Có vấn đề nhưng không block production |
| ❌ Fail | Vi phạm nghiêm trọng, cần fix trước khi deploy |

> Tham khảo toàn bộ checklist chi tiết tại [references/checklist.md](./references/checklist.md)
