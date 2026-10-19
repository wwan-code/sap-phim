/**
 * @file ai-contract.test.mjs
 * @module AI_HTTP_Contract_Tests
 * @description Chạy Express thật với auth/service giả để kiểm tra DTO, validation và lỗi tập trung mà không dùng DB/provider.
 */

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { once } from 'node:events';
import { after, test } from 'node:test';

import express from 'express';

import { assertAiAccess, aiJobError } from '../services/ai-job-policy.js';

const owner = '2243d71c-816b-47c8-8954-b23c9b844226';
const draftId = 'ea0ca0f6-06ed-4c45-9333-d555a3bf41bc';
const jobId = 'ai-1910ec73-e005-42ad-b068-c8d5952abfc0';
const envelope = { jobId, requestId: '2cb2ac49-8ea5-4cca-ad5f-3bfb94d9d9ec', ownerId: owner,
  target: { movieId: null, draftId }, jobType: 'ai', status: 'queued', stage: 'QUEUED',
  progress: 0, percent: 0, attempt: 0, sequence: 1, result: null, error: null, terminal: false };
let submissions = 0;
let lastInput;
globalThis.__aiContract = {
  aiJobService: {
    async resolve(input, actor) { assertAiAccess(actor, { target: input.target }); lastInput = input; return { status: 'ambiguous', candidates: [], selectedCandidate: null }; },
    async submit(input, actor) { assertAiAccess(actor, { target: input.target }); lastInput = input; submissions++; return envelope; },
    async get(id, actor) { assertAiAccess(actor, { ownerId: owner, target: envelope.target }); if (id !== jobId) throw aiJobError('Missing', 404, 'AI_JOB_NOT_FOUND'); return envelope; },
    async list(input, actor) { assertAiAccess(actor, { target: { draftId: input.draftId } }); lastInput = input; return { items: [envelope], pagination: { page: input.page, limit: input.limit, total: 1 } }; },
    async cancel(id, actor) { await this.get(id, actor); return { ...envelope, status: 'cancelled', stage: 'CANCELLED', sequence: 2, terminal: true }; },
    async recordReview(id, input, actor) { await this.get(id, actor); lastInput = input; return { recorded: true }; },
  },
  async getAiAuditHistory(_input, actor) { assertAiAccess(actor, { manage: true }); return { items: [] }; },
  verifyToken(req, _res, next) {
    if (!req.headers['x-test-user']) return next(aiJobError('Unauthenticated', 401, 'UNAUTHENTICATED'));
    req.user = { id: req.headers['x-test-user'], roles: [], permissions: ['admin.access', 'movies.create'] };
    next();
  },
};
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  const source = specifier.endsWith('/ai-job.service.js')
    ? 'export const {aiJobService,getAiAuditHistory}=globalThis.__aiContract;'
    : specifier.endsWith('/auth.middleware.js') ? 'export const {verifyToken}=globalThis.__aiContract;' : null;
  return source ? { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true } : nextResolve(specifier, context);
} });
const { default: router } = await import('./ai.routes.js');
hooks.deregister();
const app = express();
app.use(express.json());
app.use('/ai', router);
app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ success: false, error: { code: error.code } }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}/ai`;
after(async () => { await new Promise((resolve) => server.close(resolve)); delete globalThis.__aiContract; });
const request = async (path, { body, user = owner, method = body ? 'POST' : 'GET' } = {}) => {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
};

test('REST accepts independent media format/scope, source context IDs and exact form identity', async () => {
  const resolved = await request('/resolve', { body: { title: 'Example', media_type: 'tv', target: { draftId } } });
  assert.equal(resolved.status, 200);
  const response = await request('/suggest', { body: { title: 'Example', type: 'cast', media_type: 'tv', target: { draftId },
    context: { tmdb_id: 123, mal_id: 456, anilist_id: 789, imdb_id: 'tt1234567' } } });
  assert.equal(response.status, 202);
  assert.deepEqual(response.body.data, envelope);
  assert.equal(lastInput.type, 'cast');
  assert.equal(lastInput.media_type, 'tv');
  assert.equal(lastInput.enable_web_search, false);
  assert.deepEqual(lastInput.context, { tmdb_id: 123, mal_id: 456, anilist_id: 789, imdb_id: 'tt1234567' });
});

test('queued restore/list/cancel are canonical REST reads and never re-submit synthesis', async () => {
  const before = submissions;
  const restored = await request('/jobs/' + jobId);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.sequence, 1);
  assert.equal(restored.body.data.progress, 0);
  const list = await request('/jobs?draftId=' + draftId + '&limit=2');
  assert.equal(list.body.data.items[0].jobId, jobId);
  assert.equal(lastInput.limit, 2);
  const cancel = await request('/jobs/' + jobId + '/cancel', { method: 'POST' });
  assert.equal(cancel.body.data.status, 'cancelled');
  assert.equal(submissions, before);
});

test('REST validates enums/UUIDs/target/pagination/review and forwards auth/access errors centrally', async () => {
  for (const body of [{ title: 'Example', mode: 'paid' }, { title: 'Example', target: {} },
    { title: 'Example', target: { movieId: draftId, draftId } }, { title: 'Example', candidateId: 'unbound' },
    { title: 'Example', context: { tmdb_id: -1 } }]) {
    assert.equal((await request('/suggest', { body })).status, 422);
  }
  assert.equal((await request('/jobs/invalid')).status, 422);
  assert.equal((await request('/jobs?limit=500')).status, 422);
  assert.equal((await request('/jobs/' + jobId, { user: null })).status, 401);
  assert.equal((await request('/jobs/' + jobId, { user: draftId })).status, 403);
  assert.equal((await request('/history')).status, 403);
  const invalid = await request('/jobs/' + jobId + '/review', { body: { appliedFields: ['title'], consideredCount: -1, skippedCount: 0 } });
  assert.equal(invalid.status, 422);
  const recorded = await request('/jobs/' + jobId + '/review', { body: { appliedFields: ['titles'], consideredCount: 1, skippedCount: 0 } });
  assert.deepEqual(recorded.body.data, { recorded: true });
});
