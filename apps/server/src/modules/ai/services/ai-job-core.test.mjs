/**
 * @file ai-job-core.test.mjs
 * @module AI_Job_Core_Tests
 * @description Kiểm thử job AI bằng model/transaction/cache/queue giả lập, không kết nối DB hoặc Redis.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Op } from 'sequelize';

import { generateAiCacheKey } from '../constants/ai.constants.js';
import { createAiJobService } from './ai-job-core.service.js';
import { assertAiAccess, toAiJobDto } from './ai-job-policy.js';

const creator = { id: 'user-a', permissions: ['admin.access', 'movies.create'], roles: [] };
const editor = { id: 'user-a', permissions: ['admin.access', 'movies.edit'], roles: [] };
const admin = { id: 'user-a', permissions: ['admin.access', 'movies.create', 'movies.edit'], roles: [] };
const manager = { id: 'manager', permissions: ['admin.access', 'ai.manage'], roles: [] };
const baseInput = { title: 'Example', year: 2024, mode: 'auto', type: 'all',
  context: {}, target: { movieId: null, draftId: 'draft-a' } };
const candidate = { candidateId: 'tmdb:movie:100', title: 'Example', year: 2024,
  mediaType: 'movie', source: 'tmdb', sourceId: '100' };

/** Bộ đối chiếu where tối thiểu chỉ hỗ trợ các toán tử thực tế được service sử dụng. */
const matches = (record, where) => Object.entries(where).every(([key, expected]) => {
  if (expected && typeof expected === 'object') {
    if (expected[Op.in]) return expected[Op.in].includes(record[key]);
    if (expected[Op.contains]) return Object.entries(expected[Op.contains])
      .every(([field, value]) => record[key]?.[field] === value);
  }
  return record[key] === expected;
});

/** In-memory ports giữ unique constraint, transaction và thứ tự lưu-trước-publish. */
const fixture = (options = {}) => {
  const rows = [];
  const values = new Map();
  const locks = new Map();
  const queued = [];
  const events = [];
  const releases = [];
  let counter = 0;
  let transactionTail = Promise.resolve();
  const createRecord = (data) => {
    const row = { ...data, created_at: new Date('2026-10-19T00:00:00Z'),
      async update(patch) { Object.assign(this, patch); return this; },
      get() { return { ...this }; } };
    rows.push(row);
    return row;
  };
  const dependencies = {
    Job: {
      async findOne({ where }) { return rows.find((row) => matches(row, where)) || null; },
      async findAndCountAll({ where, offset, limit }) {
        const found = rows.filter((row) => matches(row, where));
        return { count: found.length, rows: found.slice(offset, offset + limit) };
      },
      async create(data) {
        // Cho hai submit cùng vượt kiểm tra active trước khi mô phỏng ràng buộc DB.
        await Promise.resolve();
        if (rows.some((row) => row.user_id === data.user_id && (
          row.request_id === data.request_id || (row.fingerprint === data.fingerprint
          && ['queued', 'processing'].includes(row.status))))) {
          throw Object.assign(new Error('unique constraint'), { name: 'SequelizeUniqueConstraintError' });
        }
        return createRecord(data);
      },
    },
    sequelize: { transaction(callback) {
      const result = transactionTail.then(() => callback({ LOCK: { UPDATE: 'UPDATE' } }));
      transactionTail = result.catch(() => {});
      return result;
    } },
    queue: {
      async add(name, data, config) {
        assert.ok(rows.some((row) => row.job_id === data.jobId && row.status === 'queued'),
          'DB row must exist in queued state before queue receives job');
        if (options.hangEnqueue) return new Promise(() => {});
        if (options.completeThenFailEnqueue) {
          Object.assign(rows.find((row) => row.job_id === data.jobId), { status: 'completed', sequence: 2, result: { title: 'Example' }, progress: 100 });
          throw new Error('lost queue acknowledgement');
        }
        if (options.failEnqueue) throw new Error('queue unavailable');
        queued.push({ name, data, config });
      },
      async getJob(id) { return options.queueJob?.(id) || null; },
    },
    cache: {
      async get(key) { return values.get(key) ?? null; },
      async set(key, value) {
        if (options.failCache && key.startsWith('ai:v2:result:')) throw new Error('cache unavailable');
        if (options.failResolutionCache && key.startsWith('ai:v2:resolution:')) return false;
        values.set(key, value); return true;
      },
    },
    resolver: { async resolve() { return { candidates: [candidate], selectedCandidate: candidate,
      requiresSelection: false, ...options.resolution }; } },
    movieExists: async (id) => id !== 'missing-movie',
    publish: async (dto) => {
      const stored = rows.find((row) => row.job_id === dto.jobId);
      assert.equal(dto.status, stored.status, 'Persist canonical status before publishing');
      assert.equal(dto.sequence, stored.sequence, 'Persist sequence before publishing');
      events.push(dto);
      if (options.failPublish) throw new Error('socket unavailable');
    },
    acquireLock: async (key, token) => {
      if (options.failLock) throw new Error('redis unavailable');
      if (options.bypassRedisLock) return true;
      if (locks.has(key)) return false;
      locks.set(key, token); return true;
    },
    releaseLock: async (key, token) => {
      releases.push({ key, token });
      if (locks.get(key) === token) locks.delete(key);
    },
    config: options.config || {}, metrics: options.metrics, uuid: () => 'id-' + (++counter),
    now: () => new Date('2026-10-19T00:01:00Z'),
  };
  return { service: createAiJobService(dependencies), rows, values, locks, queued, events, releases,
    createRecord, dependencies };
};

test('cache fingerprint includes owner, target, selected work, mode, search policy, scope and form context', () => {
  const base = { ...baseInput, ownerId: admin.id, selectedCandidate: candidate, enable_web_search: false };
  const fingerprint = generateAiCacheKey(base);
  assert.ok(fingerprint.resultCacheKey.startsWith('ai:v2:result:'));
  assert.ok(fingerprint.lockKey.startsWith('ai:v2:enqueue:'));
  for (const patch of [{ ownerId: 'user-b' }, { target: { draftId: 'draft-b' } },
    { selectedCandidate: { ...candidate, sourceId: '200' } }, { mode: 'deep' },
    { enable_web_search: true }, { type: 'cast' }, { context: { title: 'edited' } }, { year: 2025 }]) {
    assert.notEqual(generateAiCacheKey({ ...base, ...patch }).hash, fingerprint.hash);
  }
  assert.equal(generateAiCacheKey({ ...base, title: '  EXAMPLE  ',
    context: { b: 2, a: 1 } }).hash,
  generateAiCacheKey({ ...base, context: { a: 1, b: 2 } }).hash);
});

test('creation/editing permissions are separate and read/manage requires admin access', async () => {
  const draft = fixture();
  await draft.service.submit(baseInput, creator);
  await assert.rejects(fixture().service.submit({ ...baseInput, target: { movieId: 'movie-a' } }, creator),
    { code: 'AI_FORBIDDEN' });
  await fixture().service.submit({ ...baseInput, target: { movieId: 'movie-a' } }, editor);
  await assert.rejects(fixture().service.submit(baseInput, editor), { code: 'AI_FORBIDDEN' });
  assert.throws(() => assertAiAccess({ ...manager, permissions: ['ai.manage'] }, { manage: true }),
    { code: 'AI_FORBIDDEN' });
  assert.throws(() => assertAiAccess(null), { code: 'UNAUTHENTICATED' });
});

test('queued GET returns canonical envelope without submitting a second request or exposing payload', async () => {
  const f = fixture();
  const submitted = await f.service.submit({ ...baseInput, requestId: 'client-request-1',
    context: { privateNote: 'secret' } }, creator);
  const restored = await f.service.get(submitted.jobId, creator);
  for (const field of ['jobId', 'requestId', 'ownerId', 'target', 'status', 'stage',
    'progress', 'attempt', 'sequence', 'result', 'error']) assert.ok(Object.hasOwn(restored, field));
  assert.equal(restored.status, 'queued');
  assert.equal(restored.terminal, false);
  assert.equal(restored.result, null);
  assert.equal(restored.request_payload, undefined);
  assert.equal(restored.context, undefined);
  assert.equal(f.queued.length, 1);
  assert.deepEqual(f.queued[0].data, { jobId: submitted.jobId });
  assert.deepEqual(toAiJobDto(f.rows[0]), restored);
  await assert.rejects(f.service.get('unknown', creator), { code: 'AI_JOB_NOT_FOUND' });
});

test('another owner cannot read/cancel a job while manager may; missing stored owner is rejected', async () => {
  const f = fixture();
  const job = await f.service.submit(baseInput, creator);
  const other = { ...admin, id: 'user-b' };
  await assert.rejects(f.service.get(job.jobId, other), { code: 'AI_FORBIDDEN' });
  await assert.rejects(f.service.cancel(job.jobId, other), { code: 'AI_FORBIDDEN' });
  assert.equal((await f.service.get(job.jobId, manager)).ownerId, creator.id);
  f.rows[0].user_id = undefined;
  await assert.rejects(f.service.get(job.jobId, admin), { code: 'AI_FORBIDDEN' });
  await assert.rejects(f.service.get(job.jobId, manager), { code: 'AI_FORBIDDEN' });
});

test('request IDs are idempotent for same intent and conflict when meaningful intent changes', async () => {
  const f = fixture();
  const original = { ...baseInput, requestId: 'same-request' };
  const first = await f.service.submit(original, admin);
  assert.equal((await f.service.submit(original, admin)).jobId, first.jobId);
  assert.equal(f.queued.length, 1);
  for (const patch of [{ title: 'Different' }, { year: 2025 }, { mode: 'deep' }, { type: 'cast' },
    { context: { overwritten: true } }, { target: { draftId: 'another' } }]) {
    await assert.rejects(f.service.submit({ ...original, ...patch }, admin), { code: 'AI_REQUEST_CONFLICT' });
  }
  assert.equal(f.queued.length, 1);
});

test('force refresh bypasses completed cache but cannot duplicate an active job', async () => {
  const f = fixture();
  const first = await f.service.submit(baseInput, creator);
  assert.equal((await f.service.submit({ ...baseInput, force_refresh: true }, creator)).jobId, first.jobId);
  await f.service.complete(first.jobId, { title: 'Example', field_confidence: { title: 0 } });
  const cached = await f.service.submit(baseInput, creator);
  assert.equal(cached.jobId, first.jobId);
  assert.equal(cached.from_cache, true);
  assert.equal(cached.result.field_confidence.title, 0);
  const fresh = await f.service.submit({ ...baseInput, force_refresh: true }, creator);
  assert.notEqual(fresh.jobId, first.jobId);
  assert.equal(f.queued.length, 2);
  const differentDraft = await f.service.submit({ ...baseInput, target: { draftId: 'different-draft' } }, creator);
  assert.notEqual(differentDraft.jobId, first.jobId);
});

test('DB uniqueness resolves simultaneous enqueue even when distributed Redis lock is bypassed', async () => {
  const f = fixture({ bypassRedisLock: true });
  const [left, right] = await Promise.all([
    f.service.submit({ ...baseInput, requestId: 'request-one' }, creator),
    f.service.submit({ ...baseInput, requestId: 'request-two' }, creator),
  ]);
  assert.equal(left.jobId, right.jobId);
  assert.equal(f.rows.length, 1);
  assert.equal(f.queued.length, 1);
  assert.equal(f.releases.length, 2);
});

test('concurrent reuse of one request ID for different form context conflicts after DB uniqueness race', async () => {
  const f = fixture({ bypassRedisLock: true });
  const outcomes = await Promise.allSettled([
    f.service.submit({ ...baseInput, requestId: 'same-id', context: { current: 'one' } }, creator),
    f.service.submit({ ...baseInput, requestId: 'same-id', context: { current: 'two' } }, creator),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
  assert.equal(rejected?.reason.code, 'AI_REQUEST_CONFLICT');
  assert.equal(f.rows.length, 1);
  assert.equal(f.queued.length, 1);
});

test('enqueue failure marks durable job failed and releases token-owned lock', async () => {
  const f = fixture({ failEnqueue: true });
  await assert.rejects(f.service.submit(baseInput, creator), { code: 'AI_ENQUEUE_FAILED' });
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].status, 'failed');
  assert.equal(f.rows[0].error.code, 'AI_ENQUEUE_FAILED');
  assert.equal(f.rows[0].sequence, 2);
  assert.equal(f.events.at(-1).status, 'failed');
  assert.equal(f.locks.size, 0);
  assert.equal(f.releases.length, 1);
});

test('cancellation persists before publish, removes queued work and cannot be overwritten by late completion', async () => {
  let removed = 0;
  const f = fixture({ queueJob: () => ({ async getState() { return 'waiting'; }, async remove() { removed += 1; } }) });
  const job = await f.service.submit(baseInput, creator);
  const cancelled = await f.service.cancel(job.jobId, creator);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.terminal, true);
  assert.equal(cancelled.sequence, 2);
  assert.equal(removed, 1);
  const eventCount = f.events.length;
  const late = await f.service.complete(job.jobId, { title: 'Too late' });
  assert.equal(late.status, 'cancelled');
  assert.equal(late.result, null);
  assert.equal(late.sequence, 2);
  assert.equal(f.events.length, eventCount, 'Terminal jobs must not emit duplicate stale lifecycle events');
  assert.equal([...f.values.keys()].some((key) => key.startsWith('ai:v2:result:')), false);
});

test('durable completion survives Socket/cache failure and rejects late progress mutations', async () => {
  const f = fixture({ failPublish: true, failCache: true });
  const job = await f.service.submit(baseInput, creator);
  const result = { title: 'Example' };
  const completed = await f.service.complete(job.jobId, result);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.progress, 100);
  assert.equal(completed.sequence, 2);
  assert.deepEqual((await f.service.get(job.jobId, creator)).result, result);
  const stale = await f.service.update(job.jobId, { status: 'processing', progress: 20 });
  assert.equal(stale.status, 'completed');
  assert.equal(stale.sequence, 2);
});

test('resolved identity is tied to original title, year, format and account', async () => {
  const f = fixture();
  const resolved = await f.service.resolve({ ...baseInput, media_type: 'movie' }, creator);
  for (const patch of [{ title: 'Different' }, { year: 2025 }, { media_type: 'tv' }]) {
    await assert.rejects(f.service.submit({ ...baseInput, media_type: 'movie',
      resolutionId: resolved.resolutionId, ...patch }, creator), { code: 'AI_RESOLUTION_MISMATCH' });
  }
  await assert.rejects(f.service.submit({ ...baseInput, media_type: 'movie', resolutionId: resolved.resolutionId },
    { ...creator, id: 'user-b' }), { code: 'AI_RESOLUTION_EXPIRED' });
  await assert.rejects(f.service.submit({ ...baseInput, media_type: 'movie',
    resolutionId: resolved.resolutionId, candidateId: 'not-in-resolved-candidates' }, creator),
  { code: 'AI_IDENTITY_REQUIRED' });
  assert.equal(f.queued.length, 0);
});

test('list scopes draft/movie results to owner and clamps pagination', async () => {
  const f = fixture();
  await f.service.submit(baseInput, creator);
  await f.service.submit({ ...baseInput, target: { draftId: 'draft-b' } }, creator);
  await f.service.submit(baseInput, { ...creator, id: 'user-b' });
  const list = await f.service.list({ draftId: 'draft-a', page: -1, limit: 100 }, creator);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].target.draftId, 'draft-a');
  assert.deepEqual(list.pagination, { page: 1, limit: 50, total: 1, totalPages: 1 });
});

test('ambiguous/expired resolution, missing movie, maintenance and unavailable resolution storage fail explicitly', async () => {
  await assert.rejects(fixture({ resolution: { requiresSelection: true, selectedCandidate: null } })
    .service.submit(baseInput, creator), { code: 'AI_IDENTITY_REQUIRED' });
  await assert.rejects(fixture().service.submit({ ...baseInput, resolutionId: 'expired' }, creator),
    { code: 'AI_RESOLUTION_EXPIRED' });
  await assert.rejects(fixture().service.submit({ ...baseInput, target: { movieId: 'missing-movie' } }, editor),
    { code: 'MOVIE_NOT_FOUND' });
  await assert.rejects(fixture({ config: { acceptingJobs: false } }).service.submit(baseInput, creator),
    { code: 'AI_DRAINING' });
  await assert.rejects(fixture({ failResolutionCache: true }).service.resolve(baseInput, creator),
    { code: 'AI_RESOLUTION_UNAVAILABLE' });
});

test('review stores counts without form values, enforces owner/readiness and records actual applied fields', async () => {
  const observed = [];
  const f = fixture({ metrics: { review: (event) => observed.push(event) } });
  const job = await f.service.submit(baseInput, creator);
  const review = { appliedFields: ['titles', 'release_year'], consideredCount: 3, skippedCount: 1 };
  await assert.rejects(f.service.recordReview(job.jobId, review, creator), { code: 'AI_REVIEW_NOT_READY' });
  await f.service.complete(job.jobId, { titles: [{ title: 'Example' }], release_year: 2024 });
  await assert.rejects(f.service.recordReview(job.jobId, review, { ...creator, id: 'other' }), { code: 'AI_FORBIDDEN' });
  await assert.rejects(f.service.recordReview(job.jobId, { ...review, consideredCount: 9 }, creator), { code: 'AI_REVIEW_INVALID' });
  assert.deepEqual(await f.service.recordReview(job.jobId, review, creator), { recorded: true });
  assert.equal(f.rows[0].review.appliedCount, 2);
  assert.equal(f.rows[0].review.consideredCount, 3);
  assert.equal(f.rows[0].review.eventsCount, 1);
  assert.deepEqual(f.rows[0].review.last.appliedFields, ['titles', 'release_year']);
  assert.equal(observed.length, 1);
  assert.equal(toAiJobDto(f.rows[0]).review, undefined);
});

test('feature pause blocks new work while preserving GET, cancel and review recovery', async () => {
  const config = { enabled: true };
  const f = fixture({ config });
  const job = await f.service.submit(baseInput, creator);
  config.enabled = false;
  await assert.rejects(f.service.submit(baseInput, creator), { code: 'AI_DISABLED' });
  await assert.rejects(f.service.resolve(baseInput, creator), { code: 'AI_DISABLED' });
  assert.equal((await f.service.get(job.jobId, creator)).status, 'queued');
  assert.equal((await f.service.list({ draftId: 'draft-a' }, creator)).items.length, 1);
  assert.equal((await f.service.cancel(job.jobId, creator)).status, 'cancelled');
});

test('unresponsive enqueue fails within bounded time, releases lock and cannot clobber completed work', async () => {
  const hanging = fixture({ hangEnqueue: true, config: { enqueueTimeoutMs: 10 } });
  await assert.rejects(hanging.service.submit(baseInput, creator), { code: 'AI_ENQUEUE_FAILED' });
  assert.equal(hanging.rows[0].status, 'failed');
  assert.equal(hanging.locks.size, 0);
  const lostAck = fixture({ completeThenFailEnqueue: true });
  const completed = await lostAck.service.submit(baseInput, creator);
  assert.equal(completed.status, 'completed');
  assert.deepEqual(completed.result, { title: 'Example' });
  assert.equal(lostAck.rows[0].sequence, 2);
  assert.equal(lostAck.locks.size, 0);
  await assert.rejects(fixture({ failLock: true }).service.submit(baseInput, creator), { code: 'AI_QUEUE_UNAVAILABLE' });
});
