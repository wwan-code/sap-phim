/**
 * @file job-access.test.mjs
 * @module Socket_Job_Access_Tests
 * @description Kiểm thử guard snapshot AI bằng canonical policy và cổng đọc giả, giữ hồi quy video/ảnh.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertAiAccess } from '../../modules/ai/helpers/ai-job.helper.js';
import { ROLES } from '../../constants/roles.constant.js';

import { createJobSnapshotReader, normalizeJobStatusSnapshot } from './job-access.util.js';

const socket = (id = 'owner', roles = [ROLES.ADMIN]) => ({ user: { id, roles } });
const account = (id, extra = []) => ({ id, roles: [], permissions: ['admin.access', 'movies.create', ...extra] });
const canonical = { jobId: 'ai-test', ownerId: 'owner', target: { draftId: 'draft-a' },
  jobType: 'ai', status: 'completed', result: { title: 'Example' }, sequence: 10, terminal: true };

test('AI prefix and AI type always read canonical service before room admission, including spoofed legacy type', async () => {
  const reads = [];
  const read = createJobSnapshotReader({
    readAiJob: async (jobId, actor) => { reads.push({ jobId, actor }); return canonical; },
    readProgressJob: async () => assert.fail('AI must not use a cached progress snapshot'),
  });
  assert.equal(await read(socket(), 'ai-test', 'movie'), canonical);
  assert.equal(await read(socket(), 'non-prefixed-id', 'ai'), canonical);
  assert.deepEqual(reads, [{ jobId: 'ai-test', actor: { id: 'owner' } },
    { jobId: 'non-prefixed-id', actor: { id: 'owner' } }]);
});

test('AI checks current canonical permissions and never trusts privileged roles cached on socket', async () => {
  const accounts = new Map([['owner', account('owner')], ['stranger', account('stranger')],
    ['manager', account('manager', ['ai.manage'])]]);
  const read = createJobSnapshotReader({ readAiJob: async (id, actor) => {
    assertAiAccess(accounts.get(actor.id), { ownerId: canonical.ownerId, target: canonical.target });
    return canonical;
  }, readProgressJob: async () => assert.fail('Canonical fallback is mandatory') });
  assert.equal((await read(socket('owner'), 'ai-test', 'ai')).ownerId, 'owner');
  await assert.rejects(read(socket('stranger', [ROLES.BOSS]), 'ai-test', 'ai'), { code: 'FORBIDDEN' });
  assert.equal((await read(socket('manager', []), 'ai-test', 'ai')).ownerId, 'owner');
  accounts.set('owner', { ...account('owner'), permissions: ['movies.create'] });
  await assert.rejects(read(socket('owner', [ROLES.BOSS]), 'ai-test', 'ai'), { code: 'FORBIDDEN' });
});

test('AI without verified owner and unauthenticated requests fail closed', async () => {
  for (const snapshot of [null, { ...canonical, ownerId: null }, { ...canonical, ownerId: undefined }]) {
    const read = createJobSnapshotReader({ readAiJob: async () => snapshot,
      readProgressJob: async () => assert.fail('Must not fall back') });
    await assert.rejects(read(socket('owner', [ROLES.BOSS]), 'ai-test', 'ai'), { code: 'FORBIDDEN' });
  }
  const read = createJobSnapshotReader({ readAiJob: async () => assert.fail('Must not read unauthenticated job') });
  await assert.rejects(read({ user: null }, 'ai-test', 'ai'), { code: 'UNAUTHORIZED' });
});

test('AI snapshot hidden behind non-AI ID/type cannot bypass canonical guard through progress service', async () => {
  const read = createJobSnapshotReader({ readProgressJob: async () => ({ ...canonical, jobId: 'legacy-id' }),
    readAiJob: async () => assert.fail('Legacy spoof must fail closed') });
  await assert.rejects(read(socket(), 'legacy-id', 'movie'), { code: 'FORBIDDEN' });
});

test('video and image jobs retain legacy owner checks, privileged access and unowned snapshots', async () => {
  let snapshot = { ownerId: 'owner', status: 'processing', percent: 42, jobType: 'movie', sequence: 2 };
  const read = createJobSnapshotReader({ readProgressJob: async () => snapshot,
    readAiJob: async () => assert.fail('Legacy jobs must keep progress service') });
  const result = await read(socket('owner', []), 'video-test', 'movie');
  assert.equal(result.percent, 42);
  assert.equal(result.sequence, 2);
  assert.equal(result.terminal, false);
  await assert.rejects(read(socket('stranger', []), 'video-test', 'movie'), { code: 'FORBIDDEN' });
  assert.equal((await read(socket('stranger', [ROLES.ADMIN]), 'video-test', 'movie')).percent, 42);
  snapshot = { state: 'completed', outputs: { images: ['poster.jpg'] }, jobType: 'movie' };
  assert.equal((await read(socket('stranger', []), 'image-test', 'movie')).terminal, true);
  snapshot = null;
  assert.equal(await read(socket(), 'missing-video', 'movie'), null);
});

test('snapshot normalization retains zero progress, failures, partial completion and cancelled terminal state', () => {
  assert.equal(normalizeJobStatusSnapshot('image', 'movie', { status: 'processing', percent: 0,
    progress: 50 }).percent, 0);
  const failed = normalizeJobStatusSnapshot('video', 'movie', { state: 'failed', failedReason: 'decode failed' });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.terminal, true);
  const partial = normalizeJobStatusSnapshot('image', 'movie', { state: 'completed',
    data: { status: 'partial_failure', images: [] } });
  assert.equal(partial.status, 'partial_failure');
  assert.equal(partial.result, partial.outputs);
  assert.equal(partial.terminal, true);
  assert.equal(normalizeJobStatusSnapshot('video', 'movie', { status: 'cancelled' }).terminal, true);
});
