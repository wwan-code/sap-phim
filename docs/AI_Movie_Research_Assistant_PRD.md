# PRD: AI Movie Research Assistant
### Nâng cấp module AI Suggest Movie — từ Auto-Fill sang Research Assistant có căn cứ

**Trạng thái:** Draft v1
**Phạm vi hệ thống hiện tại đã đọc:** `evidence-collector.service.js`, `entity-matcher.service.js`, `ai-orchestrator.service.js`, `ai-pipeline.service.js`, `gemini.provider.js`, `openrouter.provider.js`, `movie-suggestion.prompt.js`, `audit.service.js`, `ai.controller.js`, `ai.worker.js`, `ai.validator.js`, `ai.constants.js`, `movie.model.js`, `env.config.js`

---

## 1. Problem Statement

Module AI Suggest Movie hiện tại (5 stage: Evidence Collection → Entity Matching → LLM Reasoning → Self-Audit → Completed) đã thu thập song song từ TMDB, AniList, Jikan/MAL, OMDb và giao toàn bộ "Evidence Snapshot" cho một lệnh gọi LLM duy nhất (Gemini hoặc OpenRouter) để tổng hợp. Vấn đề cốt lõi: **hệ thống hợp nhất dữ liệu theo kiểu "first-non-null-wins"** (`parsedData.director || evidenceSnapshot.anilist?.director || ...`) chứ không thực sự *đối chiếu*. Khi các nguồn mâu thuẫn nhau (ví dụ AniList báo 24 tập nhưng Jikan báo 26 tập, hoặc OMDb gán nhầm director là tác giả manga), hệ thống không phát hiện, không cảnh báo, và LLM tự chọn một giá trị trong im lặng.

Đồng thời, `confidence_score` và `field_provenance` trong kết quả hiện tại là **do LLM tự khai báo** (`parsedData.confidence_score || 0.90`), không phải con số được tính toán dựa trên bằng chứng thực tế (số nguồn đồng thuận, độ tin cậy từng nguồn, độ đầy đủ dữ liệu). Điều này khiến admin không có cơ sở thực sự để biết nên tin đến đâu vào một trường dữ liệu cụ thể — đặc biệt nghiêm trọng khi hệ thống bắt buộc chạy trên Gemini free-tier (pool 13 key, dễ bị rotate qua các model kém hơn khi rate-limit) và các model OpenRouter free (chất lượng suy luận thấp hơn, dễ hallucinate hơn model trả phí).

Hệ quả: Admin vẫn phải tự tay kiểm tra lại gần như toàn bộ output AI trước khi publish, làm giảm giá trị cốt lõi mà tính năng này hứa hẹn (tăng tốc độ nhập liệu phim/anime).

## 2. Goals

1. **Phát hiện mâu thuẫn dữ liệu**: Với ≥90% các trường hợp có mâu thuẫn thực sự giữa 2+ nguồn (đã biết trước trong tập test), hệ thống phải phát hiện và surface conflict thay vì âm thầm chọn 1 giá trị.
2. **Điểm tin cậy có căn cứ**: Thay `confidence_score` tự khai báo bằng công thức tính toán dựa trên: độ đồng thuận nguồn, trọng số tin cậy nguồn theo từng loại trường, độ đầy đủ evidence.
3. **Giảm hallucination có thể kiểm chứng được**: Bổ sung lớp validator hậu-LLM (schema + heuristic, ví dụ chặn nhầm lẫn Director ↔ Manga Author) chạy độc lập với việc LLM có tuân thủ system prompt hay không.
4. **Tôn trọng ràng buộc chi phí $0**: Toàn bộ tính năng mới phải vận hành ổn định trong giới hạn Gemini API Key free-tier (pool key hiện có) và danh sách model OpenRouter free — không giả định có ngân sách gọi model trả phí.
5. **Giảm thời gian admin xác minh thủ công**: Đo được qua tỷ lệ trường có confidence cao được admin publish không chỉnh sửa tăng lên so với baseline hiện tại.

## 3. Non-Goals

- **Redesign giao diện Admin Panel**: Spec này chỉ định nghĩa hợp đồng API/dữ liệu mới (conflicts[], confidence breakdown, source badges). Việc dựng UI hiển thị diff/so sánh nguồn là một sáng kiến riêng, kế tiếp.
- **Sử dụng model LLM trả phí**: Không nằm trong phạm vi vì yêu cầu rõ ràng là phải chạy tốt trên Gemini free-tier + OpenRouter free models. Việc mở rộng sang model trả phí (nếu cần) là một quyết định kinh doanh riêng.
- **Workflow duyệt nhiều admin / multi-step approval**: Không có yêu cầu về việc nhiều admin cùng review một đề xuất AI trong phạm vi này.
- **Tự động publish không cần admin duyệt**: AI vẫn chỉ *đề xuất*; admin luôn là người quyết định publish cuối cùng.
- **Thêm nguồn dữ liệu ngoài phạm vi hợp lý cho MVP** (ví dụ AniDB, Letterboxd, Rotten Tomatoes): để dành cho P2, tránh việc thêm nguồn không kiểm soát được độ tin cậy ngay từ đầu.

## 4. User Stories

**Admin biên tập nội dung (persona chính):**
- Là admin, tôi muốn thấy rõ khi các nguồn dữ liệu mâu thuẫn nhau (VD: số tập, đạo diễn, năm phát hành) để tôi tự quyết định chọn giá trị nào thay vì bị AI âm thầm chọn hộ.
- Là admin, tôi muốn mỗi trường dữ liệu được đề xuất hiển thị (qua API, để UI sau này dùng) nguồn gốc cụ thể và một điểm tin cậy thực sự có căn cứ, để tôi biết trường nào cần kiểm tra kỹ, trường nào có thể tin tưởng ngay.
- Là admin, tôi muốn hệ thống tự động gắn cờ các trường có khả năng bị AI "bịa" (VD: gán nhầm tác giả manga vào trường đạo diễn) để tôi không phải tự tra cứu lại từ đầu.
- Là admin, tôi muốn điểm tin cậy tổng thể (`confidence_score`) phản ánh đúng chất lượng bằng chứng thu thập được, không phải chỉ là con số LLM tự đoán.

**System operator / kỹ sư vận hành:**
- Là operator, tôi muốn tính năng "deep research" (mở rộng tìm kiếm) chỉ kích hoạt khi thực sự cần (mâu thuẫn nghiêm trọng hoặc thiếu dữ liệu), để không làm cạn quota Gemini free-tier hay bị OpenRouter free model rate-limit trong ngày cao điểm.
- Là operator, tôi muốn bảng trọng số tin cậy nguồn (reliability matrix) được cấu hình tập trung (constants/config), để có thể tinh chỉnh khi phát hiện một nguồn nào đó kém tin cậy hơn dự kiến mà không cần sửa logic nghiệp vụ.

## 5. Requirements

### P0 — Must-Have

**5.1. Source Reliability Matrix (bảng trọng số tin cậy theo nguồn × loại trường)**
- Mô tả: Thêm cấu hình mới (ví dụ `AI_SOURCE_RELIABILITY_MATRIX` trong `ai.constants.js`) định nghĩa trọng số tin cậy (0.0–1.0) cho từng cặp (nguồn, nhóm trường). Ví dụ: AniList trọng số cao cho `season`/`episodes`/`studios` của anime; OMDb/IMDb trọng số cao cho `imdb_rating`/`runtime` của phim live-action; TMDB trọng số cao cho `poster`/`trailer`/`overview` tiếng Việt.
- Tiêu chí chấp nhận:
  - [ ] Tồn tại bảng cấu hình có thể đọc được bởi cả conflict detector và bộ tính confidence.
  - [ ] Mỗi cặp (nguồn, nhóm trường) có giá trị mặc định hợp lý, có comment giải thích lý do (bằng tiếng Việt, theo convention hiện tại).
  - [ ] Trường hợp nguồn không có trong bảng → dùng trọng số fallback trung tính (không được throw lỗi).

**5.2. Conflict Detection Service**
- Mô tả: Module mới (VD: `conflict-detector.service.js`) chạy **trước** khi build prompt LLM, so sánh giá trị cùng một trường ngữ nghĩa (director, episode count, release year, genres, studio, rating…) giữa các nguồn đã thu thập (`evidenceSnapshot`). Output là danh sách `conflicts[]`, mỗi phần tử gồm: `field`, `values: [{source, value}]`, `severity` (`low` | `medium` | `high`).
- Tiêu chí chấp nhận:
  - [ ] Given evidence có AniList báo 24 tập và Jikan báo 26 tập, When chạy conflict detection, Then `conflicts[]` chứa 1 entry cho `total_episodes` với cả 2 giá trị và nguồn.
  - [ ] Given tất cả nguồn đồng thuận (hoặc chỉ 1 nguồn có dữ liệu), When chạy, Then trường đó không xuất hiện trong `conflicts[]`.
  - [ ] Severity được tính dựa trên: mức chênh lệch (số/enum khác nhau hoàn toàn vs gần giống), và trọng số tin cậy tương đối của các nguồn liên quan (mâu thuẫn giữa 2 nguồn tin cậy cao = severity cao hơn).
  - [ ] Không throw lỗi khi một hoặc nhiều nguồn là `null` (nguồn không tìm thấy dữ liệu).

**5.3. Computed Confidence Score (thay thế LLM self-report)**
- Mô tả: Thay logic hiện tại (`parsedData.confidence_score || 0.90`) bằng công thức tính từ: (a) tỉ lệ trường có ≥2 nguồn đồng thuận, (b) trung bình trọng số tin cậy các nguồn đóng góp, (c) độ đầy đủ evidence (`source_presence` — bao nhiêu trong 4 nguồn trả về dữ liệu), (d) có/không có conflict nghiêm trọng chưa giải quyết (giảm điểm nếu có `severity: high` chưa được LLM giải thích rõ trong `field_provenance`).
- Tiêu chí chấp nhận:
  - [ ] Công thức tính là deterministic, có thể unit-test độc lập với LLM call.
  - [ ] `confidence_score` cuối cùng = kết hợp điểm computed (trọng số chính) với điểm LLM tự báo (trọng số phụ, dùng như tín hiệu bổ sung), không dùng 100% điểm LLM tự báo nữa.
  - [ ] Khi có conflict `severity: high` chưa giải thích, confidence tổng thể của kết quả không được vượt quá `AI_CONFIDENCE_LEVELS.MEDIUM` (0.70), bất kể LLM tự báo cao hơn.

**5.4. Field Provenance mở rộng kèm lý do chọn**
- Mô tả: Cập nhật schema output trong `movie-suggestion.prompt.js` để bắt buộc LLM trả về, với mỗi trường bị conflict, không chỉ nguồn được chọn mà cả *lý do loại các giá trị khác* (VD: "Chọn AniList (24 tập) vì phim đang airing, Jikan có thể chưa cập nhật"). Trường không bị conflict giữ nguyên format `field_provenance` hiện tại.
- Tiêu chí chấp nhận:
  - [ ] Với mỗi field trong `conflicts[]` được đưa vào prompt, response JSON có thêm `field_provenance_reasoning[field]` dạng string ngắn.
  - [ ] Pipeline không fail nếu LLM (đặc biệt các free model OpenRouter yếu hơn) bỏ sót trường reasoning này — fallback về provenance rút gọn, không throw lỗi.

**5.5. Truyền conflicts vào Prompt để LLM giải quyết có ý thức**
- Mô tả: `buildMovieSuggestionUserPrompt` nhận thêm tham số `conflicts` và render một khối "MÂU THUẪN DỮ LIỆU CẦN GIẢI QUYẾT" liệt kê rõ từng field và các giá trị tranh chấp kèm nguồn, yêu cầu LLM chọn 1 giá trị + giải thích thay vì tự ý chọn ngầm.
- Tiêu chí chấp nhận:
  - [ ] Khi `conflicts.length === 0`, khối này không xuất hiện trong prompt (tránh làm phình prompt không cần thiết — quan trọng vì free-tier model có giới hạn context/token).
  - [ ] Khi có conflict, system prompt hiện tại (`MOVIE_SUGGESTION_SYSTEM_PROMPT`) được bổ sung 1 quy tắc mới: "TUYỆT ĐỐI không được im lặng chọn 1 giá trị khi có mâu thuẫn — phải điền `field_provenance_reasoning`".

**5.6. Post-LLM Output Validator (lớp kiểm định hậu suy luận)**
- Mô tả: Module mới (VD: `ai-output.validator.js`, khác với `ai.validator.js` hiện tại vốn chỉ validate request đầu vào của route) chạy sau khi nhận `parsedJson` từ orchestrator, trước khi build `finalResult`. Kiểm tra: (a) enum hợp lệ (`type`, `status`, `age_rating`, `season` đúng theo `movie.model.js`), (b) heuristic chống nhầm lẫn Director ↔ Manga Author (danh sách tác giả manga phổ biến đã biết, cảnh báo nếu `director` trùng khớp), (c) định dạng ngày `release_date`, (d) `confidence_score` LLM trả về nằm trong [0,1].
- Tiêu chí chấp nhận:
  - [ ] Given LLM trả về `type: "cartoon"` (không hợp lệ), When validator chạy, Then trường bị reset về giá trị suy luận từ evidence hoặc default, và sự kiện được ghi log cảnh báo + lưu vào audit record (không làm fail cả job).
  - [ ] Given `director` trùng tên trong danh sách tác giả manga đã biết (case-insensitive), When validator chạy, Then gắn cờ `flags: ["POSSIBLE_DIRECTOR_AUTHOR_CONFUSION"]` vào kết quả để admin thấy.
  - [ ] Validator không bao giờ throw exception làm crash pipeline — luôn trả về kết quả đã "làm sạch" + danh sách `flags[]`.

**5.7. Kiểm soát chi phí/quota cho free-tier**
- Mô tả: Mọi lệnh gọi LLM bổ sung (deep research pass, refinement pass ở P1) phải có điều kiện kích hoạt rõ ràng (không gọi vô điều kiện) và có giới hạn cứng số lần gọi thêm mỗi job (VD: tối đa 1 lần gọi bổ sung/job). Cấu hình giới hạn này để trong `ai.constants.js`.
- Tiêu chí chấp nhận:
  - [ ] Có config mới, ví dụ `AI_RESEARCH_LIMITS.MAX_EXTRA_LLM_CALLS_PER_JOB`.
  - [ ] `ai-orchestrator.service.js`/`ai-pipeline.service.js` tôn trọng giới hạn này kể cả khi nhiều trường có conflict cùng lúc (gộp tất cả conflict vào 1 lần gọi bổ sung, không gọi lặp theo từng field).

**5.8. Mở rộng hợp đồng API cho Admin Panel tiêu thụ**
- Mô tả: Response của `getJobStatus`/kết quả pipeline (`finalResult`) bổ sung: `conflicts[]`, `confidence_breakdown: { computed, llm_self_reported, final }`, `flags[]`. Không thay đổi các trường hiện có để tránh phá vỡ UI hiện tại.
- Tiêu chí chấp nhận:
  - [ ] Các field mới là optional/additive, admin panel cũ (nếu chưa cập nhật) vẫn hoạt động bình thường.
  - [ ] `audit.service.js` lưu thêm `conflicts` và `flags` vào `AIAuditLog` (cần xác nhận có cần migration thêm cột hay lưu chung trong `field_provenance`/`evidence_snapshot` JSONB hiện có — xem Open Questions).

### P1 — Nice-to-Have

1. **Deep Research mở rộng nguồn**: Tích hợp thêm 1 nguồn miễn phí (VD: Wikipedia tiếng Việt/tiếng Anh qua REST API công khai) vào `evidence-collector.service.js`, có trọng số riêng trong reliability matrix, chỉ gọi khi cần bổ sung ngữ cảnh (không gọi mặc định mọi request để tiết kiệm thời gian/băng thông).
2. **Refinement Pass có mục tiêu**: Nếu confidence tổng thể < ngưỡng (VD: 0.70) sau Stage 4, kích hoạt 1 lệnh gọi LLM bổ sung *chỉ hỏi lại các trường confidence thấp* (prompt nhỏ hơn, rẻ hơn) thay vì chạy lại toàn bộ pipeline.
3. **Feedback loop hiệu chỉnh reliability**: Ghi nhận khi admin sửa tay một trường AI đề xuất (cần model/bảng mới lưu correction), dùng để dần điều chỉnh trọng số trong reliability matrix theo thời gian (không cần ML, có thể bắt đầu bằng thống kê tần suất sai/nguồn).
4. **API quản trị reliability matrix**: Endpoint cho phép admin có quyền cao (Boss/Admin) xem và chỉnh trọng số nguồn mà không cần deploy lại code.

### P2 — Future Considerations

1. UI đầy đủ hiển thị conflict diff / so sánh nguồn trong Admin Panel.
2. Tự động học trọng số reliability từ dữ liệu correction lịch sử (thay vì static config).
3. Bổ sung thêm nguồn có cấu trúc khác (AniDB, Rotten Tomatoes, Letterboxd) sau khi đã đánh giá độ tin cậy pháp lý/kỹ thuật.
4. Workflow duyệt nhiều cấp trước khi publish đề xuất AI.

## 6. Success Metrics

**Leading Indicators (đo được sau vài tuần):**
- Tỷ lệ job phát hiện đúng conflict khi có mâu thuẫn nguồn thực sự (đo trên tập test đã biết trước kết quả đúng): mục tiêu ≥ 90%.
- Tỷ lệ trường có `confidence_score` (computed) ≥ 0.85 được admin publish **không chỉnh sửa**: dùng làm chỉ số "precision" của điểm tin cậy mới — cần đo baseline hiện tại trước khi đặt target cứng.
- Số lệnh gọi LLM bổ sung trung bình/job: phải giữ ở mức thấp (mục tiêu ≤ 1 lệnh gọi thêm/job trung bình) để không đe dọa quota free-tier.

**Lagging Indicators (đo sau 1–3 tháng):**
- Giảm tỷ lệ dữ liệu phim bị sửa lại sau khi publish (post-publish edit rate) đối với các trường do AI đề xuất.
- Giảm thời gian trung bình admin xử lý 1 job AI Suggest từ lúc nhận kết quả đến lúc publish.

> **Lưu ý:** Vì đây là công cụ nội bộ (admin-only), chưa có số liệu baseline chính thức cho các chỉ số trên trong hệ thống hiện tại. Việc đầu tiên trước khi cam kết target cụ thể là đo baseline (xem Open Questions).

## 7. Open Questions

- Ngân sách/quota thực tế của pool 13 Gemini key (số request/ngày cộng dồn) là bao nhiêu, để định cỡ giới hạn `MAX_EXTRA_LLM_CALLS_PER_JOB` cho hợp lý? *(engineering/ops)*
- `conflicts[]` và `flags[]` nên lưu ở cột JSONB mới trong `AIAuditLog`, hay tái sử dụng cột `field_provenance`/`evidence_snapshot` hiện có? *(engineering)*
- Reliability matrix nên hard-code trong `ai.constants.js` ở phase này, hay cần DB-backed + admin-editable ngay từ P0? (ảnh hưởng độ phức tạp đáng kể) *(engineering/product)*
- Ngưỡng "confidence thấp cần refinement pass" (P1) nên là giá trị cố định hay có thể cấu hình theo `type` (anime vs phim lẻ vs phim bộ)? *(product)*
- Việc thêm Wikipedia (P1) có cần rà soát điều khoản sử dụng/robots.txt không, hay dùng API chính thức (Wikipedia REST API) là đủ an toàn? *(engineering/legal — nhẹ)*
- Danh sách "tác giả manga đã biết" dùng cho heuristic chống nhầm Director↔Author (5.6) sẽ được duy trì thủ công hay cần một nguồn dữ liệu tham chiếu? *(product/engineering)*

## 8. Timeline Considerations

Không có deadline hợp đồng/pháp lý ràng buộc được nêu trong yêu cầu ban đầu. Đề xuất phân kỳ:

- **Phase 1 (P0 — “Trustworthy Core”)**: Reliability Matrix, Conflict Detection, Computed Confidence, Post-LLM Validator, mở rộng prompt & API contract, cost/quota guardrail. Đây là phần thay đổi hành vi lõi của pipeline, nên làm trọn vẹn trước khi mở rộng thêm nguồn dữ liệu.
- **Phase 2 (P1 — “Deep Research”)**: Wikipedia integration, refinement pass có mục tiêu, feedback loop cơ bản, API quản trị reliability matrix. Phụ thuộc vào Phase 1 đã ổn định (đặc biệt là reliability matrix schema).
- **Phase 3 (P2)**: Cân nhắc sau khi có dữ liệu thực tế từ Phase 1–2 (UI diff, auto-learning weights, thêm nguồn mới).

---

*Tài liệu này tập trung vào phần backend/pipeline theo đúng phạm vi 15 file đã cung cấp. Không giả định về code phía Admin Panel (React) vì chưa được đính kèm — các thay đổi UI cần một spec riêng khi cần.*
