/** Regression coverage for Vietnamese AI review and immutable catalog selections. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSuggestionMergePlan, createAiResolutionBinding, createSuggestionDiff, extractFormContextForAI, mergeSuggestionToForm, normalizeSuggestionValue, suggestionConfidencePercent, suggestionNotice } from '../src/admin/modules/movies/mappers/ai-suggestion.mapper.js';
import { candidateAliases, filterReviewFields, getAiProgressView, readableEvidenceValue, sourceDiagnostics, sourceLabel } from '../src/admin/modules/movies/utils/ai-review.util.js';

test('resolve context keeps Vietnamese title, romaji and source IDs without form prose', () => {
  const context = extractFormContextForAI({
    title: 'Tên cậu là gì?', titles: [{ type: 'default', title: 'Tên cậu là gì?' }, { type: 'romaji', title: 'Kimi no Na wa.' }],
    type: 'movie', release_year: 2016, tmdb_id: 372058, mal_id: 32281, anilist_id: 21519, imdb_id: 'tt5311514',
    description: 'Nội dung form chưa được xác minh', director: 'Dữ liệu chưa duyệt',
  });
  assert.equal(context.current_title, 'Tên cậu là gì?');
  assert.equal(context.romaji_title, 'Kimi no Na wa.');
  assert.equal(context.tmdb_id, 372058);
  assert.equal(context.imdb_id, 'tt5311514');
  assert.equal(context.type, 'movie');
  assert.equal('description' in context, false);
  assert.equal('director' in context, false);
});

test('catalog binding expires on query, release, format, form or source hint changes', () => {
  const query = { title: 'Ten cau la gi', year: '2016', media_type: 'movie', target: { movieId: 'movie-1' } };
  const context = { current_title: 'Tên cậu là gì?', tmdb_id: 372058 };
  const initial = createAiResolutionBinding(query, context);
  assert.equal(createAiResolutionBinding({ ...query, title: '  Ten cau la gi  ', year: 2016, target: { draftId: null, movieId: 'movie-1' } }, context), initial);
  for (const changed of [{ title: 'Tên cậu là gì?' }, { year: 2017 }, { media_type: 'series' }, { target: { movieId: 'movie-2' } }, { target: { draftId: 'draft-1' } }]) {
    assert.notEqual(createAiResolutionBinding({ ...query, ...changed }, context), initial);
  }
  for (const changed of [{ tmdb_id: 1 }, { current_title: 'Tên khác' }, { type: 'series' }, { release_date: '2016-08-26' }]) {
    assert.notEqual(createAiResolutionBinding(query, { ...context, ...changed }), initial);
  }
});

test('candidate aliases retain source spelling, seasons and Vietnamese diacritics', () => {
  assert.deepEqual(candidateAliases({ title: 'Tên cậu là gì?', titles: ['Tên cậu là gì?', ' Kimi no Na wa. ', 'Kimi no Na wa.', 'Ten cau la gi?'], aliases: [{ title: 'Your Name' }, { value: 'Your Name 2' }, ''] }),
    ['Kimi no Na wa.', 'Ten cau la gi?', 'Your Name', 'Your Name 2']);
  assert.deepEqual(candidateAliases(), []);
});

const historicalTitles = () => [
  { type: 'native', title: 'ブラッククローバー' },
  { type: 'synonym', title: ' BLACK CLOVER! ' },
  { type: 'english', title: 'Black Clover' },
  { type: 'default', title: 'Thế Giới Phép Thuật' },
  { type: 'romaji', title: 'Black Clover' },
  { type: 'vietnamese', title: 'Thế Giới Phép Thuật' },
  { type: 'synonym', title: 'Burakku Kurōbā' },
  ...Array.from({ length: 21 }, (_, index) => ({ type: 'synonym', title: `Tên phụ ${index + 1}` })),
];

test('historical 28-title AI results keep one name for each of the six supported roles', () => {
  const source = historicalTitles();
  assert.equal(source.length, 28);
  const titles = normalizeSuggestionValue('titles', source);
  assert.deepEqual(titles, [
    { type: 'default', title: 'Thế Giới Phép Thuật' },
    { type: 'vietnamese', title: 'Thế Giới Phép Thuật' },
    { type: 'romaji', title: 'Black Clover' },
    { type: 'english', title: 'Black Clover' },
    { type: 'native', title: 'ブラッククローバー' },
    { type: 'synonym', title: 'Burakku Kurōbā' },
  ]);
  assert.equal(source.length, 28);
});

test('AI alias cannot repeat a selected main name after Unicode, case and punctuation normalization', () => {
  const titles = normalizeSuggestionValue('titles', [
    { type: 'synonym', title: 'THẾ GIỚI PHÉP THUẬT!'.normalize('NFD') },
    { type: 'synonym', title: 'Ｂｌａｃｋ Ｃｌｏｖｅｒ' },
    { type: 'synonym', title: '  Burakku Kurōbā  ' },
    { type: 'default', title: 'Thế Giới Phép Thuật' },
    { type: 'english', title: 'Black Clover' },
  ]);
  assert.deepEqual(titles.at(-1), { type: 'synonym', title: 'Burakku Kurōbā' });
  assert.equal(titles.length, 3);
  assert.deepEqual(normalizeSuggestionValue('titles', [
    { type: 'synonym', title: 'Black Clover!' }, { type: 'english', title: 'Black Clover' },
  ]), [{ type: 'english', title: 'Black Clover' }]);
});

test('AI title filtering rejects malformed roles and values without inventing missing translations', () => {
  const titles = normalizeSuggestionValue('titles', [
    null, { type: 'unsupported', title: 'Không dùng' }, { type: 'english', title: 123 },
    { type: 'english', title: '  ' }, { title: '  Black Clover  ' },
    { type: 'default', title: 'Tên chính thứ hai' }, { type: 'native', title: 'ブラッククローバー' },
    { type: 'native', title: 'Tên gốc thứ hai' },
  ]);
  assert.deepEqual(titles, [
    { type: 'default', title: 'Black Clover' }, { type: 'native', title: 'ブラッククローバー' },
  ]);
  for (const value of [[], null, 'Black Clover', [{ type: 'unknown', title: 'Black Clover' }], [{ type: 'default', title: 1 }]]) {
    assert.equal(normalizeSuggestionValue('titles', value), undefined);
  }
});

test('preview and application both cap cached AI titles while retaining existing manual form rows', () => {
  const data = { titles: historicalTitles() };
  const currentValues = { titles: [{ type: 'default', title: 'Tên do biên tập viên chọn' }, ...historicalTitles()] };
  const existing = structuredClone(currentValues);
  const preview = createSuggestionDiff(data, currentValues).flatMap((section) => section.fields).find((field) => field.key === 'titles');
  assert.equal(preview.aiValue.length, 6);
  assert.deepEqual(preview.formValue, existing.titles);
  const safe = buildSuggestionMergePlan(['titles'], data, { currentValues });
  assert.deepEqual(safe.changes, []);
  assert.deepEqual(safe.skipped, [{ key: 'titles', reason: 'populated' }]);
  const writes = [];
  const plan = mergeSuggestionToForm(['titles'], data, (key, value) => writes.push([key, value]), { currentValues, mergeMode: 'overwrite_all' });
  assert.equal(plan.changes[0].value.length, 6);
  assert.deepEqual(writes, [['titles', preview.aiValue], ['title', 'Thế Giới Phép Thuật']]);
  assert.deepEqual(currentValues, existing);
  assert.equal(data.titles.length, 28);
});

test('translation observations keep source, locale and derivation without numeric translation certainty', () => {
  const observation = { source: 'jikan', sourceId: 32281, locale: 'en', value: 'Two teenagers exchange bodies.', derived: true };
  const sections = createSuggestionDiff({ description: 'Hai thiếu niên bất ngờ hoán đổi cơ thể.', field_confidence: { description: 0.99 }, field_provenance: { description: 'ai_translation (jikan)' }, field_evidence: { description: [observation] } });
  const field = sections.flatMap((section) => section.fields).find((item) => item.key === 'description');
  assert.equal(field.confidence, null);
  assert.equal(field.isAiTranslation, true);
  assert.deepEqual(field.observations, [observation]);
  assert.equal(sourceLabel(field.provenance), 'AI biên dịch (MyAnimeList)');
  assert.equal(filterReviewFields([field], { filter: 'attention' }).length, 1);
});

test('missing Vietnamese synopsis preserves verified metadata and never blanks existing form content', () => {
  const data = { description: null, titles: [{ type: 'default', title: 'Tên cậu là gì?' }, { type: 'vietnamese', title: 'Tên cậu là gì?' }], release_year: 2016, mal_id: 32281 };
  const plan = buildSuggestionMergePlan(['description', 'titles', 'release_year', 'mal_id'], data, { currentValues: { description: 'Giới thiệu do biên tập viên nhập' }, mergeMode: 'overwrite_all' });
  assert.deepEqual(plan.changes.map((item) => item.key), ['titles', 'release_year', 'mal_id']);
  assert.deepEqual(plan.skipped, [{ key: 'description', reason: 'invalid' }]);
  assert.match(suggestionNotice('LOCALIZATION_INCOMPLETE'), /tiếng Việt/);
  assert.equal(suggestionNotice({ code: 'UNKNOWN' }, 'Giữ dữ liệu nguồn.'), 'Giữ dữ liệu nguồn.');
});

test('source diagnostics explain partial failures without treating valid sources as unavailable', () => {
  const messages = sourceDiagnostics([{ source: 'tmdb_movie', code: 'TIMEOUT' }, { source: 'tmdb_movie', code: 'SOURCE_UNAVAILABLE' }, { source: 'anilist', code: 'TIMEOUT' }]);
  assert.equal(messages.length, 2);
  assert.match(messages[0], /TMDB \(phim điện ảnh\)/);
  assert.match(messages[1], /AniList/);
  assert.equal(messages.some((message) => /TIMEOUT|SOURCE_UNAVAILABLE/.test(message)), false);
  assert.deepEqual(sourceDiagnostics(null), []);
});

test('deterministic SEO and excerpt provenance stays readable with exact basis sources', () => {
  assert.equal(sourceLabel('source_excerpt (tmdb)'), 'Trích nội dung nguồn (TMDB)');
  assert.equal(sourceLabel('derived_source_names'), 'Từ tên và thể loại nguồn');
  assert.equal(sourceLabel('derived_synopsis (ai_translation (jikan))'), 'Từ nội dung đã duyệt (AI biên dịch (MyAnimeList))');
  assert.equal(sourceLabel({ source: 'source_excerpt (tmdb)' }), 'Trích nội dung nguồn (TMDB)');
  assert.match(sourceDiagnostics([{ source: 'catalog', code: 'CATALOG_UNAVAILABLE' }])[0], /Kho phim/);
  assert.match(sourceDiagnostics([{ source: 'search', code: 'SUPPLEMENTAL_TIMEOUT' }])[0], /nguồn bổ sung/);
  assert.match(sourceDiagnostics([{ source: 'tmdb', code: 'SOURCE_HINT_UNVERIFIED' }])[0], /Đầu mối TMDB.*chưa khớp/);
  assert.match(sourceDiagnostics([{ source: 'tmdb', code: 'SEARCH_REQUEST_LIMIT' }])[0], /giới hạn tra cứu TMDB/);
});

test('Vietnamese review search supports accent-free labels and preserves selection across filters', () => {
  const fields = [{ key: 'director', label: 'Đạo diễn', isDirty: true, isSafe: true, confidence: 90 }, { key: 'description', label: 'Tóm tắt', isDirty: true, isSafe: false, confidence: null }];
  const selectedKeys = ['description'];
  assert.deepEqual(filterReviewFields(fields, { search: 'dao dien' }).map((item) => item.key), ['director']);
  assert.deepEqual(filterReviewFields(fields, { filter: 'selected', selectedKeys }).map((item) => item.key), ['description']);
  assert.deepEqual(selectedKeys, ['description']);
  assert.equal(readableEvidenceValue([{ type: 'vietnamese', title: 'Tên cậu là gì?' }], 'titles'), 'Tên tiếng Việt: Tên cậu là gì?');
});

test('review plan protects populated Vietnamese title and description until overwrite is chosen', () => {
  const currentValues = { title: 'Tên do biên tập viên chọn', titles: [{ type: 'default', title: '' }], description: 'Giới thiệu hiện tại' };
  const data = { titles: [{ type: 'default', title: 'Tên cậu là gì?' }], description: 'Giới thiệu đã đối chiếu', release_year: 2016, tmdb_id: 0 };
  const safe = buildSuggestionMergePlan(['titles', 'description', 'release_year', 'tmdb_id'], data, { currentValues });
  assert.deepEqual(safe.changes.map((item) => item.key), ['release_year']);
  const overwrite = buildSuggestionMergePlan(['titles', 'description'], data, { currentValues, mergeMode: 'overwrite_all' });
  assert.deepEqual(overwrite.overwrites.map((item) => item.key), ['titles', 'description']);
  const writes = [];
  mergeSuggestionToForm(['titles'], data, (key, value) => writes.push([key, value]), { currentValues, mergeMode: 'overwrite_all' });
  assert.deepEqual(writes, [['titles', data.titles], ['title', 'Tên cậu là gì?']]);

  const directorWrites = [];
  const directorData = {
    director: 'Makoto Shinkai',
    director_metadata: { schema_version: 1, primary: { name: 'Makoto Shinkai', source: 'tmdb', source_id: 12345 }, people: [] },
  };
  mergeSuggestionToForm(['director'], directorData, (key, value) => directorWrites.push([key, value]), { currentValues: {} });
  assert.deepEqual(directorWrites, [
    ['director', 'Makoto Shinkai'],
    ['director_metadata', directorData.director_metadata],
  ]);
});

test('confidence preserves real zero and leaves absent values unknown', () => {
  assert.equal(suggestionConfidencePercent(0), 0);
  assert.equal(suggestionConfidencePercent(0.85), 85);
  for (const value of [undefined, null, NaN, '0.8', 2, -0.1]) assert.equal(suggestionConfidencePercent(value), null);
});

test('async review progress describes queued, reconnecting, failed and cancelled persisted states', () => {
  assert.equal(getAiProgressView({ status: 'queued' }).waiting, true);
  assert.equal(getAiProgressView({ status: 'processing', isStale: true }).title, 'Đang kết nối lại');
  assert.equal(getAiProgressView({ status: 'failed', error: { message: 'Nguồn tạm thời chưa khả dụng' } }).message, 'Nguồn tạm thời chưa khả dụng');
  assert.equal(getAiProgressView({ status: 'cancelled' }).active, false);
  assert.equal(getAiProgressView({ status: 'completed' }).syncing, true);
  assert.equal(getAiProgressView({ status: 'processing' }).percent, null);
});
