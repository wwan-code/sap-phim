/**
 * @file ai-review.util.js
 * @module Admin/Movies/Utils
 * @description Pure presentation helpers for filtering, readable evidence and real AI job progress.
 */

export const REVIEW_FILTERS = [
  { id: 'changed', label: 'Có thay đổi' },
  { id: 'all', label: 'Tất cả' },
  { id: 'empty', label: 'Ô trống' },
  { id: 'attention', label: 'Cần kiểm tra' },
  { id: 'selected', label: 'Đã chọn' },
];
export const REVIEW_GROUP_LABELS = { basic: 'Thông tin', metadata: 'Thông số', relations: 'Phân loại', cast: 'Diễn viên', seo: 'SEO', assets: 'Ảnh' };
export const TITLE_LABELS = { default: 'Tên hiển thị', native: 'Tên gốc', romaji: 'Phiên âm', english: 'Tên tiếng Anh', vietnamese: 'Tên tiếng Việt', synonym: 'Tên khác' };
export const SOURCE_LABELS = { tmdb: 'TMDB', tmdb_movie: 'TMDB (phim điện ảnh)', tmdb_tv: 'TMDB (truyền hình)', anilist: 'AniList', jikan: 'MyAnimeList', omdb: 'OMDb', database: 'Kho phim', catalog: 'Kho phim', search: 'nguồn bổ sung', database_match: 'Đối soát dữ liệu', derived_title: 'Từ tiêu đề nguồn', source_excerpt: 'Trích nội dung nguồn', derived_source_names: 'Từ tên và thể loại nguồn', derived_synopsis: 'Từ nội dung đã duyệt', ai_synthesis: 'AI tổng hợp', ai_translation: 'AI biên dịch' };
const VALUE_LABELS = {
  type: { movie: 'Phim điện ảnh', series: 'Phim bộ', tv: 'Phim truyền hình', ova: 'OVA', ona: 'ONA', special: 'Đặc biệt' },
  status: { ongoing: 'Đang phát hành', completed: 'Hoàn tất', upcoming: 'Sắp ra mắt', cancelled: 'Đã hủy', hiatus: 'Tạm ngừng' },
  season: { spring: 'Xuân', summer: 'Hạ', fall: 'Thu', winter: 'Đông' },
  sub_dub_type: { sub: 'Phụ đề', dub: 'Lồng tiếng', both: 'Phụ đề và lồng tiếng', raw: 'Bản gốc' },
};
const searchable = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

/** @description Filter without mutating selection or the shared application plan. */
export const filterReviewFields = (fields, { filter = 'changed', search = '', selectedKeys = [] } = {}) => fields.filter((field) => {
  if (search && !searchable(field.label).includes(searchable(search))) return false;
  if (filter === 'changed') return field.isDirty;
  if (filter === 'empty') return field.isSafe && field.isDirty;
  if (filter === 'attention') return field.hasError || field.conflicts?.length > 0 || field.confidence == null || field.confidence === 0;
  if (filter === 'selected') return selectedKeys.includes(field.key);
  return true;
});

/** @description Readable values for title/cast/source structures; never dump serialized JSON. */
export const readableEvidenceValue = (value, key = '', metadata = {}) => {
  if (value == null || value === '') return 'Chưa có';
  if (Array.isArray(value)) {
    const valid = value.map((item) => readableEvidenceValue(item, key, metadata)).filter((v) => v && v !== 'Chưa có');
    return valid.length ? valid.join(' · ') : 'Chưa có';
  }
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value !== 'object') {
    const relations = { genre_ids: 'genres', country_id: 'countries', studio_id: 'studios', series_id: 'series', category_id: 'categories' };
    return VALUE_LABELS[key]?.[value] || metadata[relations[key]]?.find((item) => String(item.id) === String(value))?.name || String(value);
  }
  if (value.title != null) {
    const text = String(value.title).trim();
    if (!text) return 'Chưa có';
    return (TITLE_LABELS[value.type] ? TITLE_LABELS[value.type] + ': ' : '') + text;
  }
  if (value.actor_name || value.character_name) return [value.actor_name || value.name, value.character_name].filter(Boolean).join(' — ');
  if (value.name || value.label) return value.name || value.label;
  if (value.value != null) return readableEvidenceValue(value.value, key, metadata);
  return Object.values(value).filter((item) => typeof item === 'string' || typeof item === 'number').map(String).join(' · ') || 'Chi tiết chưa được cung cấp';
};

export const sourceLabel = (value) => {
  if (!value) return 'Chưa có nguồn';
  if (Array.isArray(value)) return value.map(sourceLabel).join(', ');
  if (typeof value === 'object') return sourceLabel(value.sources || value.source || value.provider);
  return SOURCE_LABELS[value] || String(value).replace(/\b(database_match|ai_translation|source_excerpt|derived_source_names|derived_synopsis|derived_title|tmdb|anilist|jikan|omdb)\b/g, (name) => SOURCE_LABELS[name]);
};

/** @description Display source aliases without repeating the main title or losing Vietnamese accents. */
export const candidateAliases = (candidate = {}) => {
  const key = (value) => value.normalize('NFKC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
  const seen = new Set([key(String(candidate.title || ''))]);
  return [...(candidate.titles || []), ...(candidate.aliases || [])].flatMap((item) => {
    const title = typeof item === 'string' ? item.trim() : String(item?.title || item?.value || '').trim();
    if (!title || seen.has(key(title))) return [];
    seen.add(key(title)); return [title];
  });
};

/** @description Partial source failures are recoverable; do not expose provider error codes in the UI. */
export const sourceDiagnostics = (errors = []) => [...new Set((Array.isArray(errors) ? errors : [])
  .filter((item) => item?.source).map((item) => {
    const name = sourceLabel(item.source);
    if (item.code === 'SOURCE_DISABLED') return `${name} chưa được bật.`;
    if (['SOURCE_HINT_UNVERIFIED', 'SOURCE_HINT_NOT_FOUND'].includes(item.code)) return `Đầu mối ${name} trong form hoặc kho phim chưa khớp. Hãy kiểm tra tác phẩm được chọn.`;
    if (item.code === 'SEARCH_REQUEST_LIMIT') return `Đã đạt giới hạn tra cứu ${name}. Kết quả đã có vẫn được giữ lại.`;
    if (item.code === 'SUPPLEMENTAL_TIMEOUT') return 'Tra cứu nguồn bổ sung đã hết thời gian. Các ứng viên đã xác minh vẫn được giữ lại.';
    return `Chưa thể tra cứu ${name}. Kết quả từ các nguồn khác vẫn được giữ lại.`;
  }))];

export const AI_PROGRESS_STEPS = [
  { label: 'Đối chiếu nguồn', detail: 'Tìm dữ liệu cho đúng tác phẩm.' },
  { label: 'Đối soát dữ liệu', detail: 'Kiểm tra thể loại, studio và diễn viên đã có.' },
  { label: 'Tổng hợp thông tin', detail: 'Kết hợp và biên dịch các nguồn phù hợp.' },
  { label: 'Kiểm tra kết quả', detail: 'Đối chiếu giá trị và mức độ tin cậy.' },
];
const STAGES = { EVIDENCE_COLLECTION: 0, ENTITY_MATCHING: 1, LLM_REASONING: 2, SECONDARY_EVIDENCE_SEARCH: 2, LLM_REFINEMENT: 2, SELF_AUDIT_VALIDATION: 3, COMPLETED: 4 };

/** @description Derive status only from persisted job snapshots, without synthetic timers or progress. */
export const getAiProgressView = (job = {}) => {
  const waiting = job.status === 'queued' || job.stage === 'STARTED';
  const reconnecting = Boolean(job.isReconnecting || job.isStale || job.status === 'reconnecting');
  const failed = ['failed', 'error'].includes(job.status);
  const cancelled = job.status === 'cancelled';
  const syncing = job.status === 'completed' && !(job.result || job.outputs);
  const raw = job.percent ?? job.progress;
  const percent = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : null;
  const currentStep = STAGES[job.stage] ?? -1;
  const title = cancelled ? 'Đã hủy tác vụ' : failed ? 'Chưa thể hoàn tất gợi ý' : syncing ? 'Đang tải kết quả đã lưu' : reconnecting ? 'Đang kết nối lại' : waiting ? 'Đang chờ xử lý' : 'Đang tổng hợp thông tin';
  const message = cancelled ? 'Thông tin trong form được giữ nguyên. Bạn có thể tra cứu lại khi cần.'
    : failed ? (typeof job.error === 'string' ? job.error : job.error?.message) || 'Tác vụ chưa thể hoàn tất. Hãy kiểm tra kết nối hoặc tra cứu lại.'
      : syncing ? 'Tác vụ đã hoàn tất. Đang tải lại kết quả để bạn duyệt.'
        : reconnecting ? 'Tiến trình gần nhất được giữ lại. Bạn có thể tiếp tục sửa form.'
          : waiting ? (job.stage === 'RETRYING' ? 'Hệ thống đang chờ thử lại trong cùng tác vụ.' : 'Yêu cầu đã được tiếp nhận. Bạn có thể tiếp tục sửa form.')
            : AI_PROGRESS_STEPS[currentStep]?.detail || 'Đang chuẩn bị dữ liệu từ các nguồn đã cấu hình.';
  return { title, message, waiting, reconnecting, failed, cancelled, syncing, percent, currentStep, active: !failed && !cancelled && !syncing, steps: AI_PROGRESS_STEPS };
};
