/**
 * @file ai-suggestion.mapper.js
 * @module Admin/Movies/Mappers
 * @description Shared, pure preview and application plan for verified suggestions.
 */
const GROUPS = [
  ['basic', 'Thông tin cơ bản', [['titles', 'Tiêu đề đa ngôn ngữ'], ['slug', 'Đường dẫn'], ['type', 'Định dạng'], ['status', 'Trạng thái'], ['description', 'Tóm tắt']]],
  ['metadata', 'Thông số tác phẩm', [['release_date', 'Ngày phát hành'], ['release_year', 'Năm phát hành'], ['quality', 'Chất lượng'], ['sub_dub_type', 'Ngôn ngữ'], ['source_type', 'Nguồn chuyển thể'], ['duration', 'Thời lượng (phút)'], ['total_episodes', 'Số tập'], ['season', 'Mùa'], ['season_number', 'Phần'], ['age_rating', 'Độ tuổi'], ['director', 'Đạo diễn'], ['trailer_url', 'Trailer'], ['imdb_id', 'IMDb'], ['imdb_rating', 'Điểm IMDb'], ['tmdb_id', 'TMDB'], ['mal_id', 'MyAnimeList'], ['anilist_id', 'AniList']]],
  ['relations', 'Liên kết dữ liệu đã đối soát', [['genre_ids', 'Thể loại'], ['country_id', 'Quốc gia'], ['studio_id', 'Studio'], ['studio_candidate', 'Studio mới (tạo khi lưu)'], ['series_id', 'Series'], ['category_id', 'Danh mục']]],
  ['cast', 'Diễn viên', [['actor_cast', 'Diễn viên và nhân vật']]],
  ['seo', 'SEO', [['seo_keywords', 'Từ khóa'], ['meta_title', 'Tiêu đề SEO'], ['meta_description', 'Mô tả SEO']]],
];
const FIELD_KEYS = new Set(GROUPS.flatMap(([, , fields]) => fields.map(([key]) => key)));
const NUMBER_KEYS = new Set(['release_year', 'duration', 'total_episodes', 'season_number', 'imdb_rating', 'tmdb_id', 'mal_id', 'anilist_id']);
const RELATIONS = { genre_ids: 'genres', country_id: 'countries', studio_id: 'studios', series_id: 'series', category_id: 'categories' };
const ENUMS = { type: ['movie', 'series', 'special', 'ova', 'ona', 'tv'], status: ['ongoing', 'completed', 'upcoming', 'cancelled', 'hiatus'], quality: ['HD', 'FHD', '2K', '4K', 'HDR', 'CAM'], sub_dub_type: ['sub', 'dub', 'both', 'raw'], season: ['spring', 'summer', 'fall', 'winter'] };
const TITLE_TYPES = ['default', 'vietnamese', 'romaji', 'english', 'native', 'synonym'];
const normalizedTitleKey = (title) => title.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();

/** Keep historical and fresh AI results to one observed name per role; manual form rows are untouched. */
const normalizeSuggestedTitles = (value) => {
  if (!Array.isArray(value)) return undefined;
  const candidates = value.flatMap((item) => {
    const type = item?.type == null || item.type === '' ? 'default' : item.type;
    if (!TITLE_TYPES.includes(type) || typeof item?.title !== 'string' || !item.title.trim()) return [];
    return [{ type, title: item.title.trim() }];
  });
  const titles = TITLE_TYPES.filter((type) => type !== 'synonym').flatMap((type) => {
    const selected = candidates.find((item) => item.type === type);
    return selected ? [selected] : [];
  });
  const mainNames = new Set(titles.map((item) => normalizedTitleKey(item.title)));
  const alias = candidates.find((item) => item.type === 'synonym' && !mainNames.has(normalizedTitleKey(item.title)));
  if (alias) titles.push(alias);
  return titles.length ? titles : undefined;
};

/** @description Test empty form values consistently, including blank title rows. @param {*} value @param {string} key @returns {boolean} */
export const isSuggestionFieldEmpty = (value, key = '') => {
  if (value == null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0 || (key === 'titles' && value.every((item) => !item?.title?.trim()));
  return key === 'total_episodes' && Number(value) === 0;
};

/** @description Extract context without conflating format and extraction scope. @param {object} values @returns {object} */
export const extractFormContextForAI = (values = {}) => ({
  current_title: values.titles?.find((item) => item.type === 'default')?.title || values.title || '',
  romaji_title: values.titles?.find((item) => item.type === 'romaji')?.title || '',
  ...Object.fromEntries(['slug', 'type', 'release_date', 'release_year', 'quality', 'sub_dub_type', 'source_type', 'category_id', 'country_id', 'studio_id', 'genre_ids', 'tmdb_id', 'mal_id', 'anilist_id', 'imdb_id'].filter((key) => values[key] != null).map((key) => [key, values[key]])),
});

/** @description Bind a catalog selection to the exact query, form and source hints that produced it. */
export const createAiResolutionBinding = ({ target, title, year, media_type }, context = {}) => JSON.stringify({
  target: { movieId: target?.movieId || null, draftId: target?.draftId || null },
  title: String(title || '').trim(), year: year ? Number(year) : null, media_type: media_type || 'all', context,
});

/** @description Permit only HTTP(S) evidence links. @param {*} value @returns {string|null} */
export const safeSuggestionUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};

/** @description Normalize known fields without invented fallbacks. @param {string} key @param {*} value @returns {*} */
export const normalizeSuggestionValue = (key, value) => {
  if (!FIELD_KEYS.has(key) || value == null || value === '') return undefined;
  if (ENUMS[key] && !ENUMS[key].includes(value)) return undefined;
  if (NUMBER_KEYS.has(key)) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || (key !== 'imdb_rating' && !Number.isInteger(number))) return undefined;
    if (key === 'release_year' && (number < 1900 || number > 2100)) return undefined;
    if (['tmdb_id', 'mal_id', 'anilist_id', 'season_number'].includes(key) && number < 1) return undefined;
    if (key === 'imdb_rating' && number > 10) return undefined;
    return number;
  }
  if (key === 'release_date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
  }
  if (key === 'titles') return normalizeSuggestedTitles(value);
  if (key === 'genre_ids') return Array.isArray(value) && value.length ? [...new Set(value.map(String))] : undefined;
  if (key === 'studio_candidate') return value?.entity_key && value?.name ? value : undefined;
  if (key === 'actor_cast') return Array.isArray(value) && value.length && value.every((item) => (item?.actor_id || item?.entity_key) && item?.actor_name) ? value : undefined;
  if (key === 'seo_keywords') return Array.isArray(value) && value.length ? value : undefined;
  if (RELATIONS[key]) return String(value);
  if (key === 'trailer_url') return safeSuggestionUrl(value) || undefined;
  return typeof value === 'string' ? value : undefined;
};

/** @description Resolve relation names and array contents into readable values. @param {*} value @param {string} key @param {object} metadata @returns {string} */
export const formatSuggestionValue = (value, key, metadata = {}) => {
  if (isSuggestionFieldEmpty(value, key)) return 'Chưa có';
  if (key === 'studio_candidate') return value.name + ' · sẽ tạo khi lưu';
  if (RELATIONS[key]) {
    const items = metadata[RELATIONS[key]] || [];
    return (Array.isArray(value) ? value : [value]).map((id) => items.find((item) => String(item.id) === String(id))?.name || `ID ${id}`).join(', ');
  }
  if (key === 'titles') {
    if (!Array.isArray(value)) return 'Chưa có';
    const valid = value.filter((item) => Boolean(item?.title?.trim()));
    return valid.length ? valid.map((item) => `${item.type}: ${item.title.trim()}`).join(' · ') : 'Chưa có';
  }
  if (key === 'actor_cast') return value.map((item) => `${item.actor_name || metadata.actors?.find((actor) => String(actor.id) === String(item.actor_id))?.name || item.actor_id}${item.character_name ? ` — ${item.character_name}` : ''}`).join(', ');
  return Array.isArray(value) ? value.join(', ') : String(value);
};

/** @description Build the sole merge plan for both preview and form writes. @param {string[]} keys @param {object} data @param {object} options @returns {object} */
export const buildSuggestionMergePlan = (keys, data = {}, { currentValues = {}, mergeMode = 'fill_empty' } = {}) => {
  const changes = [], skipped = [];
  [...new Set(keys || [])].forEach((key) => {
    const value = normalizeSuggestionValue(key, data[key]);
    const populated = !isSuggestionFieldEmpty(currentValues[key], key) || (key === 'titles' && Boolean(currentValues.title?.trim()));
    const equal = JSON.stringify(value) === JSON.stringify(currentValues[key]);
    if (value === undefined || equal || (mergeMode !== 'overwrite_all' && populated)) {
      skipped.push({ key, reason: value === undefined ? 'invalid' : equal ? 'unchanged' : 'populated' });
    } else changes.push({ key, value, previousValue: currentValues[key], overwrites: populated });
  });
  return { changes, skipped, overwrites: changes.filter((item) => item.overwrites), appliedCount: changes.length, skippedCount: skipped.length };
};

/** @description Compare normalized values with the application emptiness rules. @param {object} data @param {object} currentValues @param {object} errors @param {object} metadata @returns {object[]} */
export const createSuggestionDiff = (data, currentValues = {}, errors = {}, metadata = {}) => GROUPS.map(([id, label, fields]) => ({
  id, label, fields: fields.flatMap(([key, fieldLabel]) => {
    const aiValue = normalizeSuggestionValue(key, data?.[key]);
    if (aiValue === undefined) return [];
    const relationshipLabel = data.relationship_labels?.[key];
    const proposedLabel = typeof relationshipLabel === 'string' ? relationshipLabel : Array.isArray(relationshipLabel) && relationshipLabel.every((item) => item?.name) ? relationshipLabel.map((item) => item.name).join(', ') : formatSuggestionValue(aiValue, key, metadata);
    const isSafe = isSuggestionFieldEmpty(currentValues[key], key) && (key !== 'titles' || !currentValues.title?.trim());
    const isDirty = JSON.stringify(aiValue) !== JSON.stringify(currentValues[key]);
    const provenance = data.field_provenance?.[key] || data.provenance?.[key] || null;
    const observations = Array.isArray(data.field_evidence?.[key]) ? data.field_evidence[key] : [];
    const isAiTranslation = /ai_translation/.test(JSON.stringify(provenance)) || observations.some((item) => item.derived === 'ai_translation' || item.derived?.type === 'ai_translation');
    return [{ key, confidence: isAiTranslation ? null : suggestionConfidencePercent(data.field_confidence?.[key]), isAiTranslation, label: fieldLabel, aiValue, formValue: currentValues[key], isSafe, isDirty, isRecommended: isSafe && isDirty, hasError: Boolean(errors[key]), proposedLabel, currentLabel: formatSuggestionValue(currentValues[key], key, metadata), provenance, observations }];
  }),
})).filter((section) => section.fields.length);

/** @description Apply only the reviewed plan and return actual counts. @param {string[]} keys @param {object} data @param {Function} setValue @param {object} options @returns {object} */
export const mergeSuggestionToForm = (keys, data, setValue, options = {}) => {
  const plan = buildSuggestionMergePlan(keys, data, options);
  plan.changes.forEach(({ key, value }) => {
    setValue(key, value, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
    if (key === 'titles') setValue('title', value.find((item) => item.type === 'default')?.title || value[0].title, { shouldDirty: true, shouldValidate: true });
    if (key === 'director' && data?.director_metadata) {
      setValue('director_metadata', data.director_metadata, { shouldDirty: true, shouldValidate: true });
    }
  });
  return plan;
};

/** @description Preserve zero; missing evidence never invents confidence. @param {*} score @returns {number|null} */
export const suggestionConfidencePercent = (score) => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1 ? Math.round(score * 100) : null;

/** @description Render structured provider/evidence errors as safe user-facing text. @param {*} value @param {string} fallback @returns {string} */
export const suggestionNotice = (value, fallback = '') => {
  const message = typeof value === 'string' ? value : typeof value?.message === 'string' ? value.message : '';
  return ({ LOCALIZATION_INCOMPLETE: 'Chưa có phần giới thiệu tiếng Việt đạt yêu cầu. Hãy bổ sung hoặc biên tập trước khi lưu phim.', VIETNAMESE_SYNOPSIS_REQUIRED: 'Chưa có phần giới thiệu tiếng Việt đạt yêu cầu. Hãy bổ sung hoặc biên tập trước khi lưu phim.', VIETNAMESE_TRANSLATION_MISSING: 'Chưa có bản giới thiệu tiếng Việt. Dữ liệu đã xác minh vẫn được giữ lại.' })[message] || (/^[A-Z][A-Z0-9_]+$/.test(message) ? fallback : message || fallback);
};
