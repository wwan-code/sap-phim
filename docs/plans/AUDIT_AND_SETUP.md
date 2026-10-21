# Audit & Setup — AI Suggestion Entity Enrichment

## Tóm tắt

**Nguồn phân tích:** file `upgrade_plan.md` do người dùng cung cấp (256 dòng), có sáu phase, 8 quyết định và ước lượng 7 giờ. **Chưa được xem source code thực tế của dự án**.

### P0: phải giải quyết trước production

1. **Double write:** cùng logic Actor/Studio creation ở `entity-matcher` và `ai-pipeline`; chỉ một commit owner.
2. **Partial/failure DB pollution:** tạo bản ghi trong stage matching trước LLM/validator; hoãn commit đến khi request valid.
3. **Identity/race:** check slug/lowercase không đủ ngăn duplicates/homonyms; cần source IDs + DB uniqueness/transaction.
4. **Anime cast:** `AniList Staff` không tự chứng minh ai là voice actor của anime; dùng `Media.characters.edges.voiceActors`, production directors là `Media.staff.edges.role`.

### P1: bảo đảm đúng dữ liệu và vận hành

5. `nationality` không suy ra từ birthplace/hometown hoặc language.
6. AniList `dateOfBirth` là FuzzyDate; nullable nếu partial.
7. `isAnimation = !!anilist` không đủ; phải xác thực relation nguồn.
8. Cache 7 ngày phải version key/locale; negative cache khác TTL.
9. 10 actors + 1 director budget; bounded concurrency, retries, timeouts, abort.
10. Schema response additive, giữ `studio_name`/`actor_names`/`country_name`; version và frontend adapters.
11. Multi-director handling, studios phụ, dubs/ngôn ngữ.
12. Feature flags, tests, metrics, release rollback.

### Mâu thuẫn trong v1

- “Giữ DB schema” nhưng thêm `director_metadata JSONB`: v2 ghi rõ additive Movie migration; Actor/Studio chỉ giữ schema nếu khả thi với verified identity.
- Code gốc vừa cho `matchActors()` auto-create vừa cho pipeline loop `createActor` — bị lặp.
- `is_new=false` ngay khi create xóa dấu vết entity mới trong output; v2 giữ `is_new` legacy semantics cùng `auto_created_in_request`.
- `TMDB Person` lấy biography, birthplace, gender nhưng không có field nationality chuẩn; v2 không tự suy đoán.
- TTL 7 ngày không tự bảo đảm rate limit và tính mới; cần configurable limiter, timeout, retry.

## Tệp trong bộ này

| File | Dùng cho |
|---|---|
| `UPGRADE_PLAN_ENTITY_ENRICHMENT_V2.md` | GDD/TDD-like production implementation plan, data contracts, gate, tests, rollout |
| `ANTIGRAVITY_IMPLEMENTATION_PROMPT.md` | Prompt copy trực tiếp vào Antigravity Agent để sửa repo thật |
| `.agents/rules/50-entity-enrichment.md` | **Tùy chọn:** rule project-scoped khi đang làm Entity Enrichment |
| `AUDIT_AND_SETUP.md` | Audit và cách sử dụng |

## Cài vào Antigravity

1. Mở workspace thực tế của `sap-phim` trong Gemini Antigravity.
2. Sao chép `UPGRADE_PLAN_ENTITY_ENRICHMENT_V2.md` vào `docs/plans/` hoặc location tài liệu dự án đang dùng.
3. Mở `ANTIGRAVITY_IMPLEMENTATION_PROMPT.md`, dán nội dung vào Agent chat và tham chiếu chính xác plan vừa copy.
4. Optional: copy `.agents/rules/50-entity-enrichment.md` vào repo `.agents/rules/` **sau khi** đối chiếu rule hiện hữu để tránh xung đột. Rule có `trigger: model_decision` và valid YAML frontmatter.
5. Không copy plan dài vào `~/.gemini/GEMINI.md`: nó là project-specific technical plan, không phải Global Rules.
6. Nếu agent nhận task từ ChatGPT nhưng không có workspace local, chưa thể chứng minh kết quả chạy tests và migrations.

**Chú ý phiên bản:** Theo tài liệu Antigravity hiện hành, rule `AGENTS.md`/`GEMINI.md` và `.agents/rules/*.md` được hỗ trợ, modular rules cần YAML frontmatter hợp lệ. Workflows IDE cũ đã được thông báo dừng hoạt động từ ngày 19/10/2026, vì vậy bộ này không tạo `.agents/workflows` legacy.

## Nguồn kiểm chứng công khai

- [Google Antigravity Rules](https://antigravity.google/docs/rules/)
- [Antigravity IDE workflows deprecation](https://antigravity.google/docs/ide/workflows/)
- [TMDB Person Details](https://developer.themoviedb.org/reference/person-details)
- [TMDB Movie Credits](https://developer.themoviedb.org/reference/movie-credits)
- [TMDB image URL basics](https://developer.themoviedb.org/docs/image-basics)
- [AniList Staff](https://docs.anilist.co/reference/object/staff)
- [AniList GraphQL Connections](https://docs.anilist.co/guide/graphql/connections)
- [AniList Media](https://docs.anilist.co/reference/object/media)
- [AniList Studio](https://docs.anilist.co/reference/object/studio)
