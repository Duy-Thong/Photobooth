# Production-Readiness Checklist

Đây là checklist đầy đủ dùng trong skill `review-repo`.
Mỗi hạng mục gồm các tiêu chí cụ thể cần kiểm tra trong repo thực tế.

---

## 1. 📁 Cấu trúc & Tổ chức code

- [ ] Có file `README.md` mô tả rõ: mục đích, cách cài đặt, cách chạy, cách contribute.
- [ ] Có file `.gitignore` phù hợp với stack (không commit `node_modules`, `.env`, build artifacts).
- [ ] Thư mục được tổ chức theo nguyên tắc nhất quán (feature-based hoặc layer-based).
- [ ] Không có file rác, dead code, commented-out code lớn còn tồn tại.
- [ ] Độ sâu thư mục hợp lý (tránh lồng quá 4–5 cấp không cần thiết).
- [ ] Có `CHANGELOG.md` hoặc release notes (nếu là library/service có versioning).

---

## 2. 🔐 Bảo mật (Security)

- [ ] **Không có secret/credential bị hardcode** trong source code hoặc lịch sử git.
  - Kiểm tra: `git log -S "password" --all`, tìm string như `api_key`, `secret`, `token`.
- [ ] Có file `.env.example` (không phải `.env`) được commit để hướng dẫn cấu hình.
- [ ] Biến môi trường nhạy cảm không được log ra stdout.
- [ ] Dependencies không có lỗ hổng bảo mật đã biết.
  - Kiểm tra: `npm audit`, `pip-audit`, `trivy`, `snyk`.
- [ ] Input người dùng được validate và sanitize trước khi xử lý.
- [ ] SQL queries dùng parameterized queries / ORM, không string concatenation.
- [ ] HTTP headers bảo mật được cấu hình (CORS, CSP, HSTS, X-Frame-Options).
- [ ] Authentication/Authorization được implement đúng (không bypass được).
- [ ] File upload được kiểm tra type, size, và không lưu trực tiếp vào webroot.
- [ ] Rate limiting được áp dụng cho API endpoints.

---

## 3. ⚡ Hiệu năng (Performance)

- [ ] Không có N+1 query trong database access.
- [ ] Index database được tạo cho các cột thường xuyên query/filter/sort.
- [ ] Caching được sử dụng ở những nơi phù hợp (Redis, in-memory, CDN).
- [ ] Ảnh/tài nguyên tĩnh được nén và tối ưu.
- [ ] Lazy loading được áp dụng cho các module/component nặng (frontend).
- [ ] Connection pooling được cấu hình cho database.
- [ ] Background jobs / async processing được dùng cho tác vụ nặng.
- [ ] Paginate các API trả về list (không fetch all).
- [ ] Bundle size được kiểm tra (frontend): không có dependency thừa.

---

## 4. 🧪 Testing

- [ ] Có unit tests với coverage ≥ 70% (hoặc theo chuẩn dự án).
- [ ] Có integration tests cho các luồng nghiệp vụ chính.
- [ ] Có end-to-end tests (nếu có UI).
- [ ] Tests có thể chạy độc lập, không phụ thuộc vào môi trường cụ thể.
- [ ] Test được chạy trong CI pipeline.
- [ ] Không có test bị skip vô lý (`it.skip`, `@pytest.mark.skip` không có lý do).
- [ ] Edge cases và error paths được test.
- [ ] Có test data / fixtures rõ ràng, không dùng production data.

---

## 5. 📋 Logging & Observability

- [ ] Logging được implement ở mức độ phù hợp (INFO, WARN, ERROR).
- [ ] Log format nhất quán (JSON structured logging được ưu tiên).
- [ ] Không log thông tin nhạy cảm (password, token, PII).
- [ ] Có tracing / correlation ID cho mỗi request.
- [ ] Error được log đầy đủ với stack trace.
- [ ] Metrics được expose (Prometheus, StatsD, hoặc tương đương).
- [ ] Health check endpoint (`/health`, `/readyz`, `/livez`) được implement.
- [ ] Alerting được cấu hình cho các lỗi critical.

---

## 6. 🚀 CI/CD Pipeline

- [ ] Có file cấu hình CI (`.github/workflows`, `.gitlab-ci.yml`, `Jenkinsfile`, v.v.).
- [ ] Pipeline bao gồm: lint → test → build → deploy.
- [ ] Build bị fail nếu test fail hoặc lint fail.
- [ ] Có deployment tách biệt cho staging và production.
- [ ] Có cơ chế rollback (blue-green, canary, hoặc manual rollback).
- [ ] Secrets trong CI được lưu qua secret manager, không hardcode trong file config.
- [ ] Docker image được scan lỗ hổng bảo mật trước khi push.
- [ ] Build artifacts được version/tag rõ ràng (không dùng `latest` trong production).

---

## 7. 🐳 Containerization & Infrastructure

- [ ] `Dockerfile` dùng base image chính thức, phiên bản cụ thể (không dùng `:latest`).
- [ ] Multi-stage build được sử dụng để giảm image size.
- [ ] Container không chạy với quyền root.
- [ ] `.dockerignore` tồn tại và exclude đúng file.
- [ ] `docker-compose.yml` (nếu có) không expose port database ra ngoài không cần thiết.
- [ ] Resource limits (CPU, memory) được cấu hình trong Kubernetes/compose.
- [ ] Liveness và Readiness probes được cấu hình (nếu dùng Kubernetes).
- [ ] Persistent volumes được dùng đúng cách cho stateful data.

---

## 8. 📦 Dependency Management

- [ ] File lock được commit (`package-lock.json`, `yarn.lock`, `poetry.lock`, `go.sum`).
- [ ] Không có dependency đã bị deprecated hoặc unmaintained (last release > 2 năm).
- [ ] Phiên bản dependency được pin hoặc có range hợp lý (không dùng `*`).
- [ ] Phân biệt rõ `devDependencies` và `dependencies` (Node.js) hoặc tương đương.
- [ ] Số lượng dependency hợp lý (tránh over-dependency).
- [ ] License của dependency tương thích với dự án.

---

## 9. ⚙️ Cấu hình & Môi trường

- [ ] Cấu hình được đọc từ environment variables, không hardcode.
- [ ] Có validation cho biến môi trường bắt buộc khi khởi động app.
- [ ] Cấu hình cho dev/staging/production được tách biệt rõ ràng.
- [ ] Timeout được cấu hình cho HTTP client, database connection.
- [ ] Graceful shutdown được implement (handle SIGTERM).
- [ ] App có thể chạy được hoàn toàn từ môi trường mới chỉ bằng `README.md`.

---

## 10. 📝 Code Quality

- [ ] Linter được cấu hình và integrate vào CI (ESLint, Pylint, golangci-lint, v.v.).
- [ ] Formatter được cấu hình (Prettier, Black, gofmt, v.v.).
- [ ] Không có magic numbers/strings, dùng constants/enums thay thế.
- [ ] Hàm/method có độ dài hợp lý (gợi ý: ≤ 50 dòng).
- [ ] Tên biến, hàm, class rõ ràng, mô tả đúng chức năng.
- [ ] Không có circular dependency giữa modules.
- [ ] Error handling nhất quán — không bỏ qua errors.
- [ ] Async/await hoặc Promise được handle đúng (không unhandled rejection).
- [ ] Code review được thực hiện (có PRs, không push thẳng vào main).

---

## 11. 🗄️ Database & Data

- [ ] Migration scripts được version và có thể rollback.
- [ ] Không có migration nào thay đổi dữ liệu không thể đảo ngược (irreversible).
- [ ] Backup strategy được document hoặc cấu hình.
- [ ] Sensitive data được mã hóa (at-rest và in-transit).
- [ ] Soft delete được sử dụng thay hard delete cho dữ liệu quan trọng.
- [ ] Foreign key constraints được định nghĩa đúng.
- [ ] Data retention policy được define.

---

## 12. 🌐 API Design (nếu có API)

- [ ] API versioning được áp dụng (`/api/v1/`).
- [ ] Response format nhất quán (cấu trúc `data`, `error`, `meta`).
- [ ] HTTP status codes được dùng đúng (200, 201, 400, 401, 403, 404, 500).
- [ ] API có documentation (OpenAPI/Swagger, Postman collection).
- [ ] Idempotent methods được implement đúng (PUT, DELETE).
- [ ] API trả về error message có thể đọc được nhưng không lộ stack trace ra client.

---

## 13. 🔄 Resilience & Fault Tolerance

- [ ] Retry logic được implement cho external calls (với exponential backoff).
- [ ] Circuit breaker được sử dụng cho calls đến service khác.
- [ ] Timeout được set cho tất cả external calls.
- [ ] App không crash khi một dependency ngoài bị down.
- [ ] Graceful degradation: app vẫn hoạt động (hạn chế) khi cache/queue bị lỗi.

---

## 14. 📄 Documentation

- [ ] API được document đầy đủ.
- [ ] Architecture decision records (ADR) tồn tại cho các quyết định quan trọng.
- [ ] Runbook / troubleshooting guide cho các lỗi thường gặp.
- [ ] Onboarding guide cho developer mới.
- [ ] Diagram kiến trúc hệ thống (nếu phức tạp).

---

## Tổng hợp điểm tham khảo

| Hạng mục | Trọng số |
|----------|----------|
| Bảo mật | Cao nhất — ❌ Fail là blocker |
| Testing | Cao |
| CI/CD | Cao |
| Code Quality | Trung bình |
| Observability | Trung bình |
| Documentation | Thấp–Trung bình |
| Performance | Tùy ngữ cảnh |

> **Lưu ý:** Bất kỳ mục nào đánh dấu ❌ Fail trong hạng mục **Bảo mật** phải được fix
> trước khi deploy lên production, bất kể tiến độ dự án.
