<!--
@file ai-suggest-rollout.md
@module Docs_AI_Suggest
@description Hợp đồng, cấu hình miễn phí, kiểm thử và triển khai trợ lý thông tin phim v2.
-->

# AI Suggest Movie v2

Trợ lý chỉ cập nhật form sau khi admin duyệt. Việc lưu/publish phim vẫn dùng luồng quản trị hiện tại. Không tự tạo quan hệ, tải ảnh hoặc upload ảnh.

## Hợp đồng

1. `POST /api/v1/ai/resolve`: `{title,year?,media_type?,target}`. Trả `resolutionId`, `status`, `candidates`, `selectedCandidate`. Phải chọn ứng viên khi chưa chắc chắn. Resolution thuộc tài khoản, hết hạn sau 10 phút và gắn với tên/năm/định dạng đã tra cứu.
2. `POST /api/v1/ai/suggest`: giữ các tùy chọn cũ, thêm `{resolutionId,candidateId,target,requestId}`. `type` là phạm vi trích xuất; `media_type` là định dạng tác phẩm. `target` chứa đúng một UUID `movieId` hoặc `draftId`. Native Web Search luôn tắt.
3. `GET /api/v1/ai/jobs/:jobId`: trả cả queued/processing/completed. Khôi phục bằng GET, không gửi lại POST suggest. `GET /api/v1/ai/jobs?movieId=...` hoặc `draftId=...` trả danh sách của chính tài khoản, có phân trang và kết quả đầy đủ.
4. `POST /api/v1/ai/jobs/:jobId/cancel`: hủy job được phép. `POST .../review`: thống kê `{appliedFields,skippedCount,consideredCount}` sau áp dụng, không nhận giá trị form.

REST và Socket dùng cùng envelope: `jobId,requestId,ownerId,target,status,stage,progress,attempt,sequence,result,error`. Socket có thêm các trường tương thích video/ảnh. Bỏ qua event cũ/trùng theo sequence. PostgreSQL `ai_jobs` là nguồn chuẩn; chỉ phát hoàn tất sau khi commit kết quả. Audit lưu từng lượt thử. Job không có chủ sở hữu không được truy cập.

Quyền: `admin.access` cùng `movies.create` cho draft, `movies.edit` cho phim đã có; đọc/hủy job phải là chủ sở hữu hoặc có `ai.manage`. Vai trò boss giữ quyền quản trị theo chính sách hiện có. Socket tải quyền hiện tại từ DB trước khi subscribe/sync.

Cache namespace mới `ai:v2:*`, fingerprint gồm phiên bản prompt, tác phẩm, phạm vi, chế độ, chính sách tìm kiếm, context, chủ sở hữu và form. Force refresh bỏ qua cache kết quả, vẫn chống job hoạt động trùng bằng unique index DB và Redis NX token. Không dùng lại cache v1.

## Cấu hình miễn phí

Node.js từ 22.15 trở lên; môi trường local đã kiểm tra với Node 24.15.

```dotenv
AI_SUGGEST_ENABLED=true
AI_SUGGEST_ACCEPTING_JOBS=true
AI_SUGGEST_WORKER_ENABLED=true

# Mặc định false. Chỉ đổi true khi vận hành xác nhận project đang ở Free Tier.
GEMINI_FREE_TIER_CONFIRMED=false
GEMINI_FREE_MODELS=gemini-2.5-flash,gemini-2.5-flash-lite
# Dùng biến GEMINI_API_KEY / GEMINI_API_KEYS hiện có, không commit khóa.

# Có thể để trống để dùng bằng chứng nguồn khi chưa cấu hình provider.
OPENROUTER_MODEL=openrouter/free
# OPENROUTER_API_KEY=<secret>
```

Gemini dùng `@google/genai`, API Gemini trực tiếp, không Vertex. Allowlist còn phải giao với model thực sự có `generateContent`. Mọi key được coi là cùng project, không xoay key vượt quota. OpenRouter chỉ nhận model free có mọi loại giá bằng 0 và gửi giới hạn giá cứng bằng 0; không plugin hoặc fallback trả phí. Model không khả dụng sẽ trả dữ liệu nguồn đã xác minh kèm lý do thiếu. Tham khảo [SDK Google](https://ai.google.dev/gemini-api/docs/libraries), [giá Gemini](https://ai.google.dev/gemini-api/docs/pricing), [quota Gemini](https://ai.google.dev/gemini-api/docs/rate-limits) và [provider routing OpenRouter](https://openrouter.ai/docs/guides/routing/provider-selection).

| Chế độ | Deadline từ lúc bắt đầu xử lý | Lượt tổng hợp tối đa | Tổng HTTP provider tối đa |
| --- | --- | --- | --- |
| Fast | 30 giây | 1 | 2 |
| Auto | 90 giây | 2 | 4 |
| Deep | 120 giây | 2 | 4 |

Discovery, fallback và retry cùng tiêu ngân sách; bộ đếm/start time được lưu qua retry. Timeout/cancel hủy HTTP thật. Tôn trọng cooldown và Retry-After. Khi thiếu quota, deadline hoặc bằng chứng, kết quả có `completeness:'partial'`, `partial_reason`, `retryAfter`; confidence được tính từ chứng cứ, không từ điểm LLM tự khai. Không có chứng cứ thì bằng 0. Xung đột nghiêm trọng chưa được xác minh giới hạn tổng điểm ở 0,70.

## Kiểm tra và triển khai

Các test AI chạy provider, nguồn, queue và DB giả lập; không sửa schema/data hoặc gọi AI thật. Assertion thất bại trả exit code khác 0.

```powershell
npm run test:ai --workspace apps/server
npm run test:ai --workspace apps/client
npm run build
```

Chạy ESLint trên các file frontend đã đổi, gồm components, hooks, mapper, store, Socket, services và endpoint constants. Kiểm tra modal/drawer bằng fixture ngoại tuyến trên desktop/mobile: tác phẩm trùng tên, confidence 0, dữ liệu một phần, bàn phím, focus trap, giữ lựa chọn khi cập nhật nền, ghi đè có danh sách xác nhận và giảm chuyển động. Bộ test subscription bao gồm job ảnh/video hiện có.

Thứ tự triển khai:

1. Tạm dừng nhận job mới bằng `AI_SUGGEST_ACCEPTING_JOBS=false`, giữ worker cũ chạy đến khi hết waiting/active/delayed/prioritized. Nếu bản cũ chưa hỗ trợ cờ này, tạm khóa route suggest ở tầng triển khai trong thời gian drain.
2. Tại `apps/server`, chạy `node scripts/ai-deployment-status.mjs`. Yêu cầu `drained:true`. Script chỉ đọc schema/queue, không in thông tin kết nối hoặc khóa.
3. Sao lưu DB theo quy trình vận hành, chạy `npx sequelize-cli db:migrate --to 20261019000000-create-ai-jobs.cjs`. Migration bổ sung bảng/index trong transaction; cũng nhận diện schema mà dev `sync` đã tạo. Không xóa audit cũ.
4. Đổi worker/backend/frontend sau khi contract tests, lint và build đạt. Worker mới chỉ khởi chạy khi migration đã ghi trong SequelizeMeta. Có thể đặt `AI_SUGGEST_WORKER_ENABLED=false` khi chuẩn bị triển khai.
5. Bật worker rồi `AI_SUGGEST_ACCEPTING_JOBS=true`. `AI_SUGGEST_ENABLED=false` dừng tra cứu/yêu cầu mới; GET/list/cancel/review vẫn phục hồi được kết quả. Các biến môi trường có hiệu lực sau khi process nạp lại.

Worker đối soát event failed/stalled với canonical DB, chỉ đánh dấu thất bại khi BullMQ đã kết thúc retry. Khi khởi động, đối soát tối đa 100 job thất bại gần nhất. Nếu DB outage kéo dài vượt retry đối soát hoặc backlog lớn hơn 100, vận hành cần đối soát backlog còn lại trước khi nhận lại job; không xóa các row đang hoạt động để vượt unique constraint.

Rollback ứng dụng: dừng nhận job, drain worker hiện tại, tắt worker mới và triển khai lại bản trước. Giữ bảng `ai_jobs`, audit và cache namespace v2 để còn dữ liệu điều tra; không dùng migrate:undo trên dữ liệu job đã có. Không đưa job chỉ chứa canonical ID cho worker cũ.

## Theo dõi

Endpoint metrics hiện có xuất `ai_jobs_total{status,partial}`, `ai_job_duration_seconds`, `ai_provider_errors_total{reason}` và `ai_review_fields_total{decision}`. Nhãn hữu hạn, không chứa tên phim/tài khoản. Tỷ lệ trường được chấp nhận = applied / (applied + skipped). Mỗi row `ai_jobs.review` lưu tổng các lượt áp dụng và lần duyệt gần nhất để đối soát sau restart; đây là thống kê admin cập nhật form, không xác nhận phim đã lưu.

Metrics transport là best effort; DB là nguồn chuẩn. Giám sát tỷ lệ partial, quota/deadline/provider errors, độ trễ và backlog queued/processing lâu bất thường. Không tự bật Free Tier confirmation hoặc thực hiện tác vụ AI thật trong kiểm thử triển khai.

## Kiểm chứng local ngày 19/10/2026

- `npm test`: 72 test backend AI/REST/Socket và 18 test client (16 AI + 2 router) đạt; client production build đạt.
- ESLint của 23 file frontend production đã sửa và file test đạt, không cảnh báo. Kiểm tra cú pháp 42 file backend/Socket/scripts đạt; các thay đổi cuối được chạy lại test và kiểm tra cú pháp.
- Migration `20261019000000-create-ai-jobs.cjs` đã ghi trong SequelizeMeta local. Kiểm tra PostgreSQL thực xác nhận unique index job hoạt động và foreign key chủ sở hữu; mọi fixture SQL được rollback.
- Smoke đọc danh sách/404 dùng quyền DB hiện tại, HTTP health 200 và route không đăng nhập 401 đạt. Queue AI trống trước migration; worker mới đã khởi chạy sau migration.
- Kiểm tra UI ngoại tuyến trên desktop và iframe viewport 390px: chọn tác phẩm trùng tên, confidence 0, lỗi dạng object, giữ focus, Tab/Shift+Tab/Escape, hiển thị danh sách ghi đè trước xác nhận và nút mobile. Fixture tạm được xóa sau QA; ảnh kiểm chứng nằm tại `.codex-artifacts/ai-suggest-qa/`.
- Build còn cảnh báo kích thước bundle video hiện có (>500 kB). Không gọi LLM thật hoặc thay đổi dữ liệu phim trong lần kiểm chứng này.
