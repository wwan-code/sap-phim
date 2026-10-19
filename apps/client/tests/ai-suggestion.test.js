/**
 * @file ai-suggestion.test.js
 * @module Client/Tests
 * @description Offline regression tests for suggestion merge, ownership, hook state and generic job subscriptions.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as mapper from '../src/admin/modules/movies/mappers/ai-suggestion.mapper.js';
import { matchesAiJobTarget, recoverAiJob, getAiDraftId, retireAiDraft } from '../src/admin/modules/movies/utils/ai-job.util.js';
import { mapMovieToFormValues, buildMovieSubmission } from '../src/admin/modules/movies/mappers/movie-form.mapper.js';
import * as jobConstants from '../src/shared/constants/jobs.constants.js';
import * as reviewUtils from '../src/admin/modules/movies/utils/ai-review.util.js';
import { acceptsJobEvent, retainJobRoom, releaseJobRoom } from '../src/shared/utils/job-lifecycle.util.js';

/** @description Execute actual hook source with isolated React state/effect primitives and mocked I/O. */
const hookHarness = (relativePath, exportName, mocks, initialProps) => {
  const slots = [];
  let index = 0, dirty = false, currentProps = initialProps, output;
  const effects = [];
  const changed = (previous, next) => !previous || !next || previous.length !== next.length || previous.some((value, i) => !Object.is(value, next[i]));
  const runtime = {
    useState(initial) {
      const slot = index++;
      if (!slots[slot]) slots[slot] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[slot].value, (value) => { const next = typeof value === 'function' ? value(slots[slot].value) : value; if (!Object.is(next, slots[slot].value)) { slots[slot].value = next; dirty = true; } }];
    },
    useRef(initial) { const slot = index++; slots[slot] ||= { current: initial }; return slots[slot]; },
    useMemo(factory, deps) { const slot = index++; if (!slots[slot] || changed(slots[slot].deps, deps)) slots[slot] = { value: factory(), deps }; return slots[slot].value; },
    useCallback(callback, deps) { return runtime.useMemo(() => callback, deps); },
    useEffect(effect, deps) { const slot = index++; if (!slots[slot] || changed(slots[slot].deps, deps)) { const previous = slots[slot]; slots[slot] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[slot].cleanup = effect(); }); } },
  };
  const bindings = { ...runtime, ...reviewUtils, ...mocks };
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ').replace(/^export default .+;$/gm, '');
  const hook = new Function(...Object.keys(bindings), `${source}\nreturn ${exportName};`)(...Object.values(bindings));
  const render = (props = currentProps) => {
    currentProps = props;
    let iterations = 0;
    do { dirty = false; index = 0; output = hook(currentProps); while (effects.length) effects.shift()(); if (++iterations > 30) throw new Error('Hook render did not settle'); } while (dirty);
    return output;
  };
  return { render, unmount: () => slots.forEach((slot) => slot?.cleanup?.()), get value() { return output; }, initial: render() };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const silentToast = { success() {}, error() {} };
const target = { movieId: 'movie-a', draftId: null };
const job = { jobId: 'ai-job-a', ownerId: 'account-a', requestId: 'request-a', jobType: 'ai', target, status: 'completed', sequence: 5, result: { description: 'Verified description', confidence_score: 0 } };

test('fill-empty uses blank title placeholders consistently and does not invent related changes', () => {
  const data = { titles: [{ type: 'default', title: 'Movie A' }], type: 'movie', description: 'New', total_episodes: 12 };
  const currentValues = { titles: [{ type: 'default', title: '' }], title: '', type: 'series', description: 'User text', total_episodes: 0 };
  const keys = ['titles', 'type', 'description', 'total_episodes'];
  const preview = mapper.buildSuggestionMergePlan(keys, data, { currentValues });
  assert.equal(preview.appliedCount, 2);
  assert.equal(preview.skippedCount, 2);
  assert.deepEqual(preview.changes.map((change) => change.key), ['titles', 'total_episodes']);
  const writes = [];
  const applied = mapper.mergeSuggestionToForm(keys, data, (...args) => writes.push(args), { currentValues });
  assert.deepEqual(applied, preview);
  assert.deepEqual(writes.map(([key]) => key), ['titles', 'title', 'total_episodes']);
  const movieOnly = [];
  mapper.mergeSuggestionToForm(['type'], { type: 'movie' }, (key) => movieOnly.push(key));
  assert.deepEqual(movieOnly, ['type']);
});

test('shared merge plan rejects unknown fields, bad enums, fabricated dates, IDs and unmatched cast', () => {
  const bad = { is_published: true, type: 'unexpected', release_date: '2024-02-30', release_year: 9999, tmdb_id: 0, imdb_rating: 11, actor_cast: [{ actor_name: 'Not in DB' }], trailer_url: 'javascript:alert(1)' };
  assert.equal(mapper.buildSuggestionMergePlan(Object.keys(bad), bad).appliedCount, 0);
  assert.equal(mapper.normalizeSuggestionValue('release_date', '2024'), undefined);
  assert.equal(mapper.normalizeSuggestionValue('release_date', '2024-02-29'), '2024-02-29');
});

test('populated legacy title is protected and relations show names', () => {
  assert.equal(mapper.buildSuggestionMergePlan(['titles'], { titles: [{ title: 'New' }] }, { currentValues: { title: 'User title', titles: [] } }).appliedCount, 0);
  assert.equal(mapper.formatSuggestionValue(['g1'], 'genre_ids', { genres: [{ id: 'g1', name: 'Drama' }] }), 'Drama');
  assert.equal(mapper.formatSuggestionValue([{ actor_id: 'a1', actor_name: 'Actor', character_name: 'Hero' }], 'actor_cast'), 'Actor — Hero');
});

test('confidence zero, absent confidence and structured partial errors remain honest', () => {
  assert.equal(mapper.suggestionConfidencePercent(0), 0);
  assert.equal(mapper.suggestionConfidencePercent(undefined), null);
  assert.equal(mapper.suggestionConfidencePercent('0.9'), null);
  assert.equal(mapper.suggestionNotice({ code: 'RATE_LIMITED', message: 'Try later' }), 'Try later');
  assert.equal(mapper.suggestionNotice({ code: 'UNKNOWN' }, 'Missing evidence'), 'Missing evidence');
  assert.equal(mapper.safeSuggestionUrl('javascript:alert(1)'), null);
});

test('recovery calls only exact GET and rejects another account, movie, draft or unbound result', async () => {
  const calls = [];
  const reader = { getJobStatus: async (id) => { calls.push(id); return job; }, suggestMovie: () => assert.fail('Recovery must never submit a suggestion') };
  assert.equal(await recoverAiJob(reader, job.jobId, 'account-a', target), job);
  assert.deepEqual(calls, [job.jobId]);
  await assert.rejects(recoverAiJob(reader, 'a-different-job-id', 'account-a', target));
  await assert.rejects(recoverAiJob(reader, job.jobId, 'account-b', target));
  await assert.rejects(recoverAiJob(reader, job.jobId, 'account-a', { movieId: 'movie-b', draftId: null }));
  assert.equal(matchesAiJobTarget({ ...job, ownerId: undefined }, 'account-a', target), false);
  assert.equal(matchesAiJobTarget({ ...job, target: undefined }, 'account-a', target), false);
  assert.equal(matchesAiJobTarget(job, 'account-a', { movieId: null, draftId: 'draft-a' }), false);
});

test('draft identity is stable within each account and distinct across accounts', () => {
  const map = new Map();
  const storage = { getItem: (key) => map.get(key), setItem: (key, value) => map.set(key, value) };
  const first = getAiDraftId('a', storage);
  assert.equal(getAiDraftId('a', storage), first);
  assert.notEqual(getAiDraftId('b', storage), first);
  storage.removeItem = (key) => map.delete(key);
  retireAiDraft('a', first, storage);
  assert.notEqual(getAiDraftId('a', storage), first);
});

test('reference counts keep background AI, image and video rooms while any consumer remains', () => {
  for (const type of ['ai', 'movie', 'episode', 'video']) {
    const registry = new Map();
    assert.equal(retainJobRoom(registry, 'job-1', type), true);
    assert.equal(retainJobRoom(registry, 'job-1', type), false);
    assert.equal(registry.values().next().value.refs, 2);
    assert.equal(releaseJobRoom(registry, 'job-1', type), false);
    assert.equal(registry.size, 1);
    assert.equal(releaseJobRoom(registry, 'job-1', type), true);
    assert.equal(registry.size, 0);
    assert.equal(releaseJobRoom(registry, 'job-1', type), false);
  }
  const registry = new Map();
  retainJobRoom(registry, 'same-id', 'ai'); retainJobRoom(registry, 'same-id', 'movie');
  releaseJobRoom(registry, 'same-id', 'ai');
  assert.equal(registry.size, 1);
});

test('job events reject stale, duplicate, cross-target and terminal-regressing updates', () => {
  const current = { ...job, isTerminal: true };
  assert.equal(acceptsJobEvent(current, { ...job, sequence: 4 }), false);
  assert.equal(acceptsJobEvent(current, { ...job }), false);
  assert.equal(acceptsJobEvent(current, { ...job, sequence: 6, status: 'processing' }), false);
  assert.equal(acceptsJobEvent(current, { ...job, sequence: 6, ownerId: 'other' }), false);
  assert.equal(acceptsJobEvent(current, { ...job, sequence: 6, target: { movieId: 'other' } }), false);
  assert.equal(acceptsJobEvent(null, { ...job, ownerId: null }), false);
  assert.equal(acceptsJobEvent(current, { ...job, sequence: 6 }), true);
  assert.equal(acceptsJobEvent({ ...current, result: null }, job), true);
  assert.equal(acceptsJobEvent({ jobType: 'movie', sequence: 1 }, { status: 'processing', sequence: 2 }), true);
});

test('modal hook preserves edited inputs across background renders and requires ambiguous selection', async () => {
  let submitted, resolveCalls = 0;
  const props = { isOpen: true, isLoading: false, formValues: { title: 'Original' }, onSubmit: async (payload) => { submitted = payload; } };
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-ai-suggestion-request.js', 'useAiSuggestionRequest', { extractFormContextForAI: mapper.extractFormContextForAI, aiService: { resolveMovie: async () => { resolveCalls++; return { resolutionId: 'resolution-a', status: 'ambiguous', candidates: [{ candidateId: 'a' }, { candidateId: 'b' }] }; } } }, props);
  harness.value.update('title', 'Typed title'); harness.render({ ...props, formValues: { title: 'Changed in background' } });
  assert.equal(harness.value.values.title, 'Typed title');
  await harness.value.submit(); harness.render();
  assert.equal(submitted, undefined);
  assert.equal(harness.value.candidateId, '');
  harness.value.selectCandidate('b'); harness.render();
  await harness.value.submit(); harness.render();
  assert.equal(submitted.title, 'Typed title');
  assert.equal(submitted.candidateId, 'b');
  assert.equal(submitted.resolutionId, 'resolution-a');
  assert.equal(submitted.enable_web_search, false);
  assert.equal(resolveCalls, 1);
  harness.value.update('year', '2020'); harness.render();
  assert.equal(harness.value.resolution, null);
  harness.unmount();
});

test('drawer hook keeps choices on background updates and requires confirmation of exact overwrites', () => {
  const data = { description: 'Suggested', director: 'Director', confidence_score: 0, partial_reason: { message: 'Quota exhausted' } };
  const props = { suggestionData: data, suggestionId: 'job-a', currentValues: { description: 'User description', director: '' }, formErrors: {}, metadata: {}, onApply: (...args) => calls.push(args), isReadOnly: false };
  const calls = [];
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-ai-suggestion-review.js', 'useAiSuggestionReview', { ...mapper, toast: silentToast }, props);
  assert.deepEqual(harness.value.selectedKeys, ['director']);
  harness.value.deselectAll(); harness.render({ ...props, currentValues: { ...props.currentValues }, formErrors: { description: {} } });
  assert.deepEqual(harness.value.selectedKeys, []);
  harness.value.changeMode('overwrite_all'); harness.value.toggle('description'); harness.render();
  assert.equal(harness.value.plan.appliedCount, 1);
  harness.value.apply(); harness.render();
  assert.equal(calls.length, 0);
  assert.equal(harness.value.confirmationIsCurrent, true);
  harness.render({ ...props, currentValues: { description: 'Changed after confirmation', director: '' } });
  assert.equal(harness.value.confirmationIsCurrent, false);
  harness.value.apply(); harness.render(); harness.value.apply();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].confirmedPlan, JSON.stringify(harness.value.plan.changes));
  assert.equal(harness.value.confidence, 0);
  assert.equal(harness.value.partialReason, 'Quota exhausted');
  harness.render({ ...props, suggestionId: 'job-b' });
  assert.deepEqual(harness.value.selectedKeys, ['director']);
  harness.unmount();
});

test('movie AI hook restores only owned form results, uses GET on completed packet and records actual review counts', async () => {
  let completionCallback;
  const calls = [], writes = [];
  const state = { jobs: {}, registerJob(id, meta) { this.jobs[id] ||= { jobId: id, ...meta }; }, updateJobProgress(payload) { this.jobs[payload.jobId] = { ...this.jobs[payload.jobId], ...payload }; } };
  const useJobStore = (selector) => selector(state); useJobStore.getState = () => state;
  const service = { getJobs: async (query) => { calls.push(['list', query]); return { items: [{ ...job, jobId: 'wrong', ownerId: 'account-b', target: { movieId: 'movie-b', draftId: null } }, job] }; }, getJobStatus: async (id) => { calls.push(['get', id]); return job; }, suggestMovie: async () => assert.fail('Restoration must never POST'), recordReview: async (id, payload) => { calls.push(['review', id, payload]); } };
  const listeners = new Map();
  const props = { ownerId: 'account-a', movieId: 'movie-a', isReadOnly: false, form: { getValues: () => ({ description: '' }), setValue: (...args) => writes.push(args) } };
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-movie-ai.js', 'useMovieAi', { aiService: service, useJobStore, useJobSocket: (_id, opts) => { completionCallback = opts.onComplete; }, buildSuggestionMergePlan: mapper.buildSuggestionMergePlan, mergeSuggestionToForm: mapper.mergeSuggestionToForm, getAiDraftId, retireAiDraft, matchesAiJobTarget, recoverAiJob, toast: silentToast, window: { sessionStorage: {}, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) }, setInterval: () => 1, clearInterval() {} }, props);
  await tick(); harness.render();
  assert.equal(harness.value.aiSuggestionJobId, job.jobId);
  assert.equal(harness.value.hasAiResult, true);
  await completionCallback({ ...job, result: null }); harness.render();
  assert.ok(calls.some(([method, id]) => method === 'get' && id === job.jobId));
  assert.equal(harness.value.isAiDrawerOpen, false, 'A closed drawer must not interrupt form editing on background completion');
  assert.equal(harness.value.handleApplyAiSuggestion(['description', 'status'], job.result), true);
  assert.deepEqual(writes.map(([key]) => key), ['description']);
  assert.deepEqual(calls.find(([method]) => method === 'review')[2], { appliedFields: ['description'], skippedCount: 1, consideredCount: 2 });
  harness.render({ ...props, movieId: 'movie-b' }); await tick(); harness.render();
  assert.equal(harness.value.handleApplyAiSuggestion(['description'], job.result), false);
  assert.equal(harness.value.aiSuggestionJobId, undefined);
  harness.unmount();
});


test('original title preserves an explicit value and otherwise prefers native, romaji then English', () => {
  const titles = [{ type: 'default', title: 'Localized' }, { type: 'english', title: 'English' }, { type: 'romaji', title: 'Romaji' }, { type: 'native', title: 'Native' }];
  assert.equal(buildMovieSubmission({ titles }).payload.original_title, 'Native');
  assert.equal(buildMovieSubmission({ titles: titles.filter((item) => item.type !== 'native') }).payload.original_title, 'Romaji');
  assert.equal(buildMovieSubmission({ titles, original_title: 'Explicit' }).payload.original_title, 'Explicit');
  assert.equal(mapMovieToFormValues({ titles }).original_title, 'Native');
  assert.equal(mapMovieToFormValues({ titles, original_title: 'Explicit' }).original_title, 'Explicit');
});

test('request hook prevents rapid duplicate resolve calls and clears expired identity for retry', async () => {
  let resolveCalls = 0, finish;
  const deferred = new Promise((resolve) => { finish = resolve; });
  const props = { isOpen: true, isLoading: false, formValues: { title: 'Movie' }, target, onSubmit: async () => { throw Object.assign(new Error('Resolve again'), { code: 'AI_RESOLUTION_EXPIRED' }); } };
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-ai-suggestion-request.js', 'useAiSuggestionRequest', { extractFormContextForAI: mapper.extractFormContextForAI, aiService: { resolveMovie: () => { resolveCalls++; return deferred; } } }, props);
  const first = harness.value.submit();
  await harness.value.submit();
  assert.equal(resolveCalls, 1);
  finish({ resolutionId: 'r1', status: 'matched', candidates: [{ candidateId: 'c1' }] });
  await first; harness.render();
  assert.equal(harness.value.candidateId, 'c1');
  await harness.value.submit(); harness.render();
  assert.equal(harness.value.resolution, null);
  assert.equal(harness.value.candidateId, '');
  assert.equal(harness.value.error, 'Resolve again');
  harness.unmount();
});


test('widget hook preserves AI metadata, numeric progress, result and structured errors', () => {
  const harness = hookHarness('../src/admin/shared/components/widgets/job-progress-widget/hooks/use-job-progress.js', 'useJobProgress', { ...jobConstants, useNavigate: () => () => {} }, { ...job, progress: 63, error: { code: 'PARTIAL', message: 'Evidence only' } });
  assert.equal(harness.value.progress.percent, 63);
  assert.equal(harness.value.progress.jobType, 'ai');
  assert.equal(harness.value.progress.result, job.result);
  assert.deepEqual(harness.value.progress.target, target);
  assert.equal(harness.value.progress.error, 'Evidence only');
  harness.render({ ...job, progress: 100, error: { errors: ['No message'] } });
  assert.equal(typeof harness.value.progress.error, 'string');
  harness.unmount();
});

test('job socket hook resets completion per job and unmount releases only its own retained subscription', () => {
  const registry = new Map();
  const completed = [];
  const state = { jobs: { a: { ...job, jobId: 'a', isTerminal: true }, b: { ...job, jobId: 'b', isTerminal: true } } };
  const queryClient = { invalidateQueries() {} };
  retainJobRoom(registry, 'a', 'movie');
  const mocks = { ...jobConstants, useQueryClient: () => queryClient, useJobStore: (selector) => selector(state), socketClient: { subscribeJob: (id, type) => retainJobRoom(registry, id, type), unsubscribeJob: (id, type) => releaseJobRoom(registry, id, type) } };
  const options = { jobType: 'movie', onComplete: (value) => completed.push(value.jobId) };
  const harness = hookHarness('../src/hooks/socket/use-job-socket.js', '(props) => useJobSocket(props.jobId, props.options)', mocks, { jobId: 'a', options });
  assert.deepEqual(completed, ['a']);
  assert.equal(registry.get('job:movie:a').refs, 2);
  harness.render({ jobId: 'a', options });
  assert.deepEqual(completed, ['a']);
  harness.render({ jobId: 'b', options });
  assert.deepEqual(completed, ['a', 'b']);
  assert.equal(registry.get('job:movie:a').refs, 1);
  harness.unmount();
  assert.equal(registry.has('job:movie:b'), false);
  assert.equal(registry.get('job:movie:a').refs, 1);
});

test('background results preserve an open review or request modal; reopening selects latest and explicit jobs stay exact', async () => {
  const first = { ...job, createdAt: '2026-10-19T00:00:00Z' };
  const second = { ...job, jobId: 'ai-job-b', createdAt: '2026-10-19T01:00:00Z', result: { description: 'Second result' } };
  const third = { ...job, jobId: 'ai-job-c', createdAt: '2026-10-19T02:00:00Z', result: { description: 'Third result' } };
  const catalog = new Map([first, second, third].map((item) => [item.jobId, item]));
  const calls = [], listeners = new Map();
  let onComplete;
  const state = { jobs: {}, registerJob(id, meta) { this.jobs[id] ||= { jobId: id, ...meta }; }, updateJobProgress(payload) { this.jobs[payload.jobId] = { ...this.jobs[payload.jobId], ...payload }; } };
  const useJobStore = (selector) => selector(state); useJobStore.getState = () => state;
  const service = { getJobs: async () => ({ items: [first] }), getJobStatus: async (id) => { calls.push(id); return catalog.get(id); } };
  const props = { ownerId: 'account-a', movieId: 'movie-a', isReadOnly: false, form: { getValues: () => ({ description: '' }), setValue() {} } };
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-movie-ai.js', 'useMovieAi', { aiService: service, useJobStore, useJobSocket: (_id, options) => { onComplete = options.onComplete; }, buildSuggestionMergePlan: mapper.buildSuggestionMergePlan, mergeSuggestionToForm: mapper.mergeSuggestionToForm, getAiDraftId, retireAiDraft, matchesAiJobTarget, recoverAiJob, toast: silentToast, window: { sessionStorage: {}, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) }, setInterval: () => 1, clearInterval() {} }, props);
  await tick(); harness.render();
  const stableOpen = harness.value.openAiResult;
  await harness.value.openAiResult(); harness.render();
  const reviewProps = { suggestionData: harness.value.aiSuggestionData, suggestionId: harness.value.aiSuggestionJobId, currentValues: { description: '' }, formErrors: {}, metadata: {}, onApply() {}, isReadOnly: false };
  const review = hookHarness('../src/admin/modules/movies/hooks/use-ai-suggestion-review.js', 'useAiSuggestionReview', { ...mapper, toast: silentToast }, reviewProps);
  review.value.deselectAll(); review.render();
  await onComplete(second); harness.render();
  review.render({ ...reviewProps, suggestionData: harness.value.aiSuggestionData, suggestionId: harness.value.aiSuggestionJobId });
  assert.equal(harness.value.aiSuggestionJobId, first.jobId);
  assert.deepEqual(review.value.selectedKeys, []);
  assert.equal(harness.value.isAiDrawerOpen, true);
  assert.equal(harness.value.openAiResult, stableOpen);
  harness.value.setIsAiDrawerOpen(false); harness.render();
  await harness.value.openAiResult(); harness.render();
  assert.equal(calls.at(-1), second.jobId);
  assert.equal(harness.value.aiSuggestionJobId, second.jobId);
  harness.value.setIsAiDrawerOpen(false); harness.value.setIsAiModalOpen(true); harness.render();
  await onComplete(third); harness.render();
  assert.equal(harness.value.isAiModalOpen, true);
  assert.equal(harness.value.isAiDrawerOpen, false);
  assert.equal(harness.value.aiSuggestionJobId, second.jobId);
  harness.value.setIsAiModalOpen(false); harness.render();
  await harness.value.openAiResult(); harness.render();
  assert.equal(harness.value.aiSuggestionJobId, third.jobId);
  listeners.get('sap-phim:open-ai-drawer')({ detail: first }); await tick(); harness.render();
  assert.equal(harness.value.aiSuggestionJobId, first.jobId);
  harness.value.setIsAiDrawerOpen(false); harness.render();
  await harness.value.openAiResult(); harness.render();
  assert.equal(harness.value.aiSuggestionJobId, third.jobId);
  harness.render({ ...props, requestedJobId: first.jobId }); await tick(); harness.render();
  assert.equal(harness.value.aiSuggestionJobId, first.jobId);
  harness.value.setIsAiDrawerOpen(false); harness.render(); await tick(); harness.render();
  assert.equal(harness.value.isAiDrawerOpen, false);
  assert.equal(harness.value.openAiResult, stableOpen);
  review.unmount(); harness.unmount();
});

test('review filters search Vietnamese labels, distinguish zero/missing confidence and preserve hidden selections', () => {
  const fields = [
    { key: 'description', label: 'Tóm tắt', isDirty: true, isSafe: false, confidence: 80, conflicts: [] },
    { key: 'director', label: 'Đạo diễn', isDirty: true, isSafe: true, confidence: 0, conflicts: [] },
    { key: 'duration', label: 'Thời lượng', isDirty: false, isSafe: false, confidence: null, conflicts: [] },
    { key: 'release_date', label: 'Ngày phát hành', isDirty: true, isSafe: true, confidence: 90, conflicts: [{ field: 'release_date' }] },
  ];
  const filter = (options) => reviewUtils.filterReviewFields(fields, options).map((field) => field.key);
  assert.deepEqual(filter({ filter: 'changed' }), ['description', 'director', 'release_date']);
  assert.deepEqual(filter({ filter: 'empty' }), ['director', 'release_date']);
  assert.deepEqual(filter({ filter: 'attention' }), ['director', 'duration', 'release_date']);
  assert.deepEqual(filter({ filter: 'all', search: 'dao dien' }), ['director']);
  assert.deepEqual(filter({ filter: 'selected', selectedKeys: ['description', 'duration'] }), ['description', 'duration']);
  assert.equal(reviewUtils.readableEvidenceValue([{ type: 'native', title: '原題' }, { type: 'english', title: 'Example' }], 'titles'), 'Tên gốc: 原題 · Tên tiếng Anh: Example');
  assert.equal(reviewUtils.readableEvidenceValue([{ actor_name: 'Actor', character_name: 'Hero' }], 'actor_cast'), 'Actor — Hero');
  assert.equal(reviewUtils.readableEvidenceValue('country-a', 'country_id', { countries: [{ id: 'country-a', name: 'Việt Nam' }] }), 'Việt Nam');
  assert.equal(reviewUtils.readableEvidenceValue('movie', 'type'), 'Phim điện ảnh');
  assert.equal(reviewUtils.readableEvidenceValue('completed', 'status'), 'Hoàn tất');
});

test('review hook bulk selection is scoped to visible eligible rows, preserving groups, filters and global apply count', () => {
  const data = { description: 'Synopsis', director: 'Director', duration: 100, meta_title: 'SEO', field_confidence: { description: 0, director: 0.8 } };
  const props = { suggestionData: data, suggestionId: 'review-new', currentValues: { description: '', director: 'Director', duration: '', meta_title: '' }, metadata: {}, formErrors: {}, onApply() {} };
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-ai-suggestion-review.js', 'useAiSuggestionReview', { ...mapper, toast: silentToast }, props);
  harness.value.deselectAll(); harness.render();
  harness.value.selectVisible(); harness.render();
  assert.deepEqual(harness.value.selectedKeys, ['description']);
  harness.value.changeGroup('metadata'); harness.render();
  assert.deepEqual(harness.value.visibleFields.map((field) => field.key), ['duration']);
  harness.value.selectVisible(); harness.render();
  assert.deepEqual(harness.value.selectedKeys, ['description', 'duration']);
  assert.equal(harness.value.plan.appliedCount, 2);
  harness.value.setFilter('all'); harness.value.setSearch('dao dien'); harness.render();
  assert.deepEqual(harness.value.visibleFields.map((field) => field.key), ['director']);
  harness.value.selectVisible(); harness.render();
  assert.deepEqual(harness.value.selectedKeys, ['description', 'duration'], 'An unchanged row cannot be selected in bulk');
  harness.value.setSearch(''); harness.value.setFilter('selected'); harness.render();
  harness.value.deselectVisible(); harness.render();
  assert.deepEqual(harness.value.selectedKeys, ['description']);
  harness.value.changeGroup('basic'); harness.render({ ...props, currentValues: { ...props.currentValues } });
  assert.equal(harness.value.filter, 'selected');
  assert.deepEqual(harness.value.visibleFields.map((field) => field.key), ['description']);
  assert.equal(harness.value.plan.appliedCount, 1);
  harness.unmount();
});

test('confirmation returns to review scroll and invalidates when even an unselected form field changes', () => {
  const calls = [];
  const props = { suggestionId: 'confirmation-new', suggestionData: { description: 'New synopsis', director: 'New director' }, currentValues: { description: 'Edited synopsis', director: 'Existing director' }, onApply: (...args) => calls.push(args) };
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-ai-suggestion-review.js', 'useAiSuggestionReview', { ...mapper, toast: silentToast }, props);
  harness.value.scrollRef.current = { scrollTop: 340 };
  harness.value.confirmationRef.current = { focus() {} };
  harness.value.applyButtonRef.current = { focus() {} };
  harness.value.changeMode('overwrite_all'); harness.value.toggle('description'); harness.value.setSearch('tom'); harness.render();
  harness.value.apply(); harness.render();
  assert.equal(calls.length, 0);
  assert.equal(harness.value.confirmationIsCurrent, true);
  assert.equal(harness.value.scrollRef.current.scrollTop, 0);
  assert.deepEqual(harness.value.confirmationChanges.map((change) => [change.currentLabel, change.proposedLabel]), [['Edited synopsis', 'New synopsis']]);
  harness.value.cancelConfirmation(); harness.render();
  assert.equal(harness.value.scrollRef.current.scrollTop, 340);
  assert.equal(harness.value.search, 'tom');
  assert.deepEqual(harness.value.selectedKeys, ['description']);
  harness.value.apply(); harness.render();
  harness.render({ ...props, currentValues: { ...props.currentValues, director: 'Changed elsewhere' } });
  assert.equal(harness.value.confirmationIsCurrent, false);
  harness.render(props);
  assert.equal(harness.value.confirmationIsCurrent, false, 'Undoing the form edit must not revive an old confirmation');
  harness.value.apply(); harness.render(); harness.value.apply();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].confirmedPlan, JSON.stringify(harness.value.plan.changes));
  harness.unmount();
});

test('legacy title is visible in review and exact overwrite confirmation even without populated title rows', () => {
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-ai-suggestion-review.js', 'useAiSuggestionReview', { ...mapper, toast: silentToast }, { suggestionId: 'legacy-title', suggestionData: { titles: [{ type: 'default', title: 'New title' }] }, currentValues: { title: 'Existing title', titles: [{ type: 'default', title: '' }] }, onApply() {} });
  assert.equal(harness.value.fields[0].currentLabel, 'Tên hiển thị: Existing title');
  assert.equal(harness.value.plan.appliedCount, 0);
  harness.value.changeMode('overwrite_all'); harness.value.toggle('titles'); harness.render();
  harness.value.apply(); harness.render();
  assert.equal(harness.value.confirmationIsCurrent, true);
  assert.equal(harness.value.confirmationChanges[0].currentLabel, 'Tên hiển thị: Existing title');
  assert.equal(harness.value.confirmationChanges[0].proposedLabel, 'Tên hiển thị: New title');
  harness.unmount();
});

test('progress view renders real queued, retry, reconnect, complete-without-result and terminal snapshots honestly', () => {
  const queued = reviewUtils.getAiProgressView({ status: 'queued', stage: 'QUEUED', progress: 0 });
  assert.equal(queued.waiting, true); assert.equal(queued.percent, 0); assert.equal(queued.currentStep, -1);
  const running = reviewUtils.getAiProgressView({ status: 'processing', stage: 'LLM_REASONING', progress: 37 });
  assert.equal(running.percent, 37); assert.equal(running.currentStep, 2);
  const reconnect = reviewUtils.getAiProgressView({ status: 'processing', stage: 'ENTITY_MATCHING', percent: 22, isReconnecting: true });
  assert.equal(reconnect.reconnecting, true); assert.equal(reconnect.percent, 22);
  assert.match(reviewUtils.getAiProgressView({ status: 'queued', stage: 'RETRYING' }).message, /thử lại/);
  assert.equal(reviewUtils.getAiProgressView({ status: 'completed', percent: 100 }).syncing, true);
  assert.equal(reviewUtils.getAiProgressView({ status: 'completed', result: { completeness: 'partial' } }).syncing, false);
  const failed = reviewUtils.getAiProgressView({ status: 'failed', error: { message: 'Provider unavailable' } });
  assert.equal(failed.failed, true); assert.equal(failed.active, false); assert.equal(failed.message, 'Provider unavailable');
  const cancelled = reviewUtils.getAiProgressView({ status: 'cancelled' });
  assert.equal(cancelled.cancelled, true); assert.equal(cancelled.active, false);
  assert.equal(reviewUtils.getAiProgressView({ status: 'processing', progress: undefined }).percent, null);
});

test('submitted job opens live progress; closing keeps background work, GET reopens it and cancellation targets the viewed job', async () => {
  const queued = { ...job, jobId: 'ai-progress', status: 'queued', stage: 'QUEUED', progress: 0, percent: 0, sequence: 1, result: null, terminal: false };
  const second = { ...job, jobId: 'ai-other-result', sequence: 4, createdAt: '2026-10-19T04:00:00Z' };
  let current = queued, callbacks;
  const calls = [];
  const state = { jobs: {}, registerJob(id, meta) { this.jobs = { ...this.jobs, [id]: { ...this.jobs[id], jobId: id, ...meta } }; }, updateJobProgress(payload) { this.jobs = { ...this.jobs, [payload.jobId]: { ...this.jobs[payload.jobId], ...payload } }; } };
  const useJobStore = (selector) => selector(state); useJobStore.getState = () => state;
  const service = { getJobs: async () => ({ items: [] }), suggestMovie: async () => { calls.push('post'); return queued; }, getJobStatus: async (id) => { calls.push('get:' + id); return id === second.jobId ? second : current; }, cancelJob: async (id) => { calls.push('cancel:' + id); current = { ...current, status: 'cancelled', stage: 'CANCELLED', terminal: true, sequence: 8 }; return current; } };
  const props = { ownerId: 'account-a', movieId: 'movie-a', form: { getValues: () => ({}), setValue() {} } };
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-movie-ai.js', 'useMovieAi', { ...mapper, aiService: service, useJobStore, useJobSocket: (_id, options) => { callbacks = options; }, getAiDraftId, retireAiDraft, matchesAiJobTarget, recoverAiJob, toast: silentToast, window: { sessionStorage: {}, addEventListener() {}, removeEventListener() {} }, setInterval: () => 1, clearInterval() {} }, props);
  await tick(); harness.render();
  harness.value.setIsAiModalOpen(true); harness.render();
  await harness.value.handleAiModalSubmit({ title: 'Movie' }); harness.render();
  assert.equal(harness.value.isAiDrawerOpen, true);
  assert.equal(harness.value.isAiModalOpen, false);
  assert.equal(harness.value.viewedAiJob.status, 'queued');
  assert.equal(harness.value.viewedAiJob.result, null);
  harness.value.setIsAiDrawerOpen(false); harness.render();
  current = { ...queued, status: 'processing', stage: 'LLM_REASONING', percent: 37, progress: 37, sequence: 3 };
  state.updateJobProgress({ ...current, isReconnecting: true }); harness.render();
  assert.equal(harness.value.viewedAiJob.percent, 37);
  assert.equal(harness.value.viewedAiJob.isReconnecting, true);
  assert.equal(harness.value.isAiDrawerOpen, false);
  await harness.value.openAiProgress(); harness.render();
  assert.equal(harness.value.isAiDrawerOpen, true);
  assert.ok(calls.includes('get:' + queued.jobId));
  await callbacks.onComplete(second); harness.render();
  assert.equal(harness.value.viewedAiJob.jobId, queued.jobId);
  assert.equal(harness.value.hasNewAiResult, true);
  await harness.value.cancelAiJob(harness.value.viewedAiJob.jobId); harness.render();
  assert.equal(harness.value.viewedAiJob.status, 'cancelled');
  assert.ok(calls.includes('cancel:' + queued.jobId));
  assert.equal(calls.filter((method) => method === 'post').length, 1);
  harness.value.openAiRequest(); harness.render();
  assert.equal(harness.value.isAiModalOpen, true);
  assert.equal(harness.value.isAiDrawerOpen, false);
  assert.equal(calls.filter((method) => method === 'post').length, 1);
  harness.unmount();
});

test('missing Socket result remains recoverable and a delayed GET opens the latest snapshot without rolling it back', async () => {
  const queued = { ...job, status: 'queued', stage: 'QUEUED', percent: 0, sequence: 1, result: null };
  const running = { ...queued, status: 'processing', stage: 'LLM_REASONING', percent: 37, sequence: 3 };
  const complete = { ...job, stage: 'COMPLETED', percent: 100, sequence: 6 };
  let response = queued, unavailable = false, callbacks;
  const calls = [];
  const state = { jobs: {}, registerJob(id, meta) { this.jobs = { ...this.jobs, [id]: { ...this.jobs[id], jobId: id, ...meta } }; }, updateJobProgress(payload) { this.jobs = { ...this.jobs, [payload.jobId]: { ...this.jobs[payload.jobId], ...payload } }; } };
  const useJobStore = (selector) => selector(state); useJobStore.getState = () => state;
  const service = { getJobs: async () => ({ items: [] }), suggestMovie: async () => { calls.push('post'); return queued; }, getJobStatus: async (id) => { calls.push('get:' + id); if (unavailable) throw new Error('Offline'); return response; } };
  const harness = hookHarness('../src/admin/modules/movies/hooks/use-movie-ai.js', 'useMovieAi', { ...mapper, aiService: service, useJobStore, useJobSocket: (_id, options) => { callbacks = options; }, getAiDraftId, retireAiDraft, matchesAiJobTarget, recoverAiJob, toast: silentToast, window: { sessionStorage: {}, addEventListener() {}, removeEventListener() {} }, setInterval: () => 1, clearInterval() {} }, { ownerId: 'account-a', movieId: 'movie-a', form: { getValues: () => ({}), setValue() {} } });
  await tick(); harness.render();
  await harness.value.handleAiModalSubmit({ title: 'Movie' }); harness.render();
  state.updateJobProgress({ ...complete, result: null, isTerminal: true });
  unavailable = true;
  await callbacks.onComplete({ ...complete, result: null }); harness.render();
  assert.equal(harness.value.activeAiJobId, job.jobId);
  assert.equal(harness.value.viewedAiJob.status, 'completed');
  assert.equal(harness.value.viewedAiJob.result, null);
  assert.equal(reviewUtils.getAiProgressView(harness.value.viewedAiJob).syncing, true);
  harness.value.setIsAiDrawerOpen(false); harness.render();
  unavailable = false; response = running;
  await harness.value.openAiProgress(); harness.render();
  assert.equal(harness.value.isAiDrawerOpen, true);
  assert.equal(harness.value.viewedAiJob.sequence, 6);
  assert.equal(harness.value.viewedAiJob.result, null);
  response = complete;
  await harness.value.refreshViewedAiJob(); harness.render();
  assert.equal(harness.value.isAiDrawerOpen, true);
  assert.equal(harness.value.viewedAiJob.result, complete.result);
  assert.equal(harness.value.activeAiJobId, null);
  assert.equal(calls.filter((call) => call === 'post').length, 1);
  harness.unmount();
});
