/**
 * @file ai-job-processor.test.mjs
 * @module AI_Job_Processor_Tests
 * @description Kiểm thử processor với cổng DB/queue/provider giả lập và ngân sách job không reset qua retry.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AIProviderError, assertExecutionAvailable, consumeSynthesisPass,
  runBudgetedRequest } from '../providers/ai-provider-policy.js';
import { createAiJobProcessor, createAiJobFailureReconciler } from './ai-job-processor.js';

/** Một bản ghi canonical và audit port trong bộ nhớ, không tạo kết nối dịch vụ. */
const fixture = ({ execute, mode = 'auto', initial = {}, beforeUpdate } = {}) => {
  const record = { job_id: 'ai-test', user_id: 'owner', status: 'queued', stage: 'QUEUED',
    sequence: 1, provider_request_count: 0, provider_pass_count: 0, result: null,
    request_payload: { title: 'Example', year: 2024, type: 'all', mode, target: { draftId: 'draft' },
      context: { existingTitle: 'Example' }, selectedCandidate: { candidateId: 'tmdb:movie:1' } }, ...initial };
  const events = [];
  const audits = [];
  const observed = [];
  const logs = [];
  const terminal = ['completed', 'cancelled', 'failed'];
  const jobService = {
    async getRecord() { return { ...record }; },
    async update(id, patch) {
      beforeUpdate?.(record, patch);
      if (terminal.includes(record.status)) return { ...record };
      Object.assign(record, typeof patch === 'function' ? patch(record) : patch);
      record.sequence += 1;
      events.push({ ...record });
      return { ...record };
    },
    async complete(id, result) { return this.update(id, { status: 'completed', stage: 'COMPLETED',
      progress: 100, result, error: null }); },
  };
  const Audit = { async create(data) {
    const audit = { ...data, updates: [], async update(patch) {
      this.updates.push(patch); Object.assign(this, patch); return this;
    } };
    audits.push(audit); return audit;
  } };
  const pipeline = { async executePipeline(params) { observed.push(params); return execute(params, { record, jobService }); } };
  const processor = createAiJobProcessor({ jobService, pipeline, Audit,
    logger: { debug() {}, error(message) { logs.push(message); } } });
  const invoke = (attemptsMade = 0, attempts = 2) => processor({
    data: { jobId: record.job_id }, attemptsMade, opts: { attempts },
  });
  return { invoke, record, jobService, Audit, observed, events, audits, logs };
};

test('retry retains start time, request/pass counters, nonterminal progress and one audit per attempt', async () => {
  let attempt = 0;
  const f = fixture({ execute: async (params, { record }) => {
    attempt += 1;
    const budget = params.executionBudget;
    assert.equal(params.enableWebSearch, false);
    assert.equal(params.auditHandledExternally, true);
    await consumeSynthesisPass(budget, params.signal);
    await runBudgetedRequest({ budget, signal: params.signal }, async () => {
      assert.equal(record.provider_request_count, attempt, 'Counter must persist before inference HTTP');
      assert.equal(record.provider_pass_count, attempt);
    });
    if (attempt === 1) throw new AIProviderError('AI_PROVIDER_UNAVAILABLE', 'temporary', { retryable: true });
    return { title: 'Example', confidence_score: 0,
      _execution: { provider: 'test', model: 'test:free', usage: { totalTokens: 5 } } };
  } });
  await assert.rejects(f.invoke(0), { code: 'AI_PROVIDER_UNAVAILABLE' });
  assert.equal(f.record.status, 'queued');
  assert.equal(f.record.stage, 'RETRYING');
  assert.equal(f.events.some((event) => event.status === 'failed'), false);
  const originalStart = f.record.started_at;
  const result = await f.invoke(1);
  assert.equal(f.record.started_at, originalStart);
  assert.equal(f.record.provider_request_count, 2);
  assert.equal(f.record.provider_pass_count, 2);
  assert.equal(f.record.status, 'completed');
  assert.equal(result._execution, undefined);
  assert.equal(result.confidence_score, 0);
  assert.equal(f.audits.length, 2);
  assert.equal(f.audits[0].updates.length, 1);
  assert.equal(f.audits[1].updates.length, 1);
  assert.equal(f.audits[1].estimated_cost_usd, 0);
  assert.equal(f.events.at(-1).status, 'completed');
  assert.deepEqual(f.events.at(-1).result, result);
});

test('a restored expired deadline cannot be reset by a queue retry', async () => {
  const oldStart = new Date(Date.now() - 130000);
  let requestSent = false;
  const f = fixture({ mode: 'deep', initial: { started_at: oldStart, provider_request_count: 3 },
    execute: async ({ executionBudget, signal }) => {
      assertExecutionAvailable(executionBudget, signal);
      requestSent = true;
      return { title: 'Too late' };
    } });
  await assert.rejects(f.invoke(1), { name: 'UnrecoverableError', message: 'AI_DEADLINE_EXCEEDED' });
  assert.equal(f.record.started_at, oldStart);
  assert.equal(f.record.status, 'failed');
  assert.equal(requestSent, false);
});

test('exhausted synthesis pass prevents a useless retry even when HTTP budget remains', async () => {
  const f = fixture({ mode: 'fast', execute: async ({ executionBudget, signal }) => {
    await consumeSynthesisPass(executionBudget, signal);
    throw new AIProviderError('AI_PROVIDER_UNAVAILABLE', 'temporary', { retryable: true });
  } });
  await assert.rejects(f.invoke(), { name: 'UnrecoverableError' });
  assert.equal(f.record.status, 'failed');
  assert.equal(f.record.provider_pass_count, 1);
  assert.equal(f.record.provider_request_count, 0);
});

test('connection errors carried in error.code are retryable without requiring error.name to match', async () => {
  const f = fixture({ execute: async () => {
    throw Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
  } });
  await assert.rejects(f.invoke(), { code: 'ECONNRESET' });
  assert.equal(f.record.status, 'queued');
  assert.equal(f.record.stage, 'RETRYING');
});

test('a job cancelled during STARTED transition never invokes pipeline or creates an audit', async () => {
  const f = fixture({ beforeUpdate(record, patch) {
    if (patch.stage === 'STARTED') { record.status = 'cancelled'; record.result = null; }
  }, execute: async () => assert.fail('Cancelled work must not query sources or providers') });
  assert.equal(await f.invoke(), null);
  assert.equal(f.audits.length, 0);
  assert.equal(f.observed.length, 0);
});

test('cancelled inflight job aborts before next provider HTTP reservation and preserves terminal result', async () => {
  let sent = false;
  const f = fixture({ execute: async (params, { jobService }) => {
    await jobService.update('ai-test', { status: 'cancelled', error: { code: 'AI_CANCELLED' } });
    await runBudgetedRequest({ budget: params.executionBudget, signal: params.signal }, async () => {
      sent = true;
    });
    return { title: 'Cancelled' };
  } });
  assert.equal(await f.invoke(), null);
  assert.equal(f.record.status, 'cancelled');
  assert.equal(f.record.result, null);
  assert.equal(sent, false);
});

test('finished canonical jobs are restored without invoking pipeline or duplicating audit', async () => {
  for (const status of ['completed', 'cancelled', 'failed']) {
    const result = status === 'completed' ? { title: 'Already saved' } : null;
    const f = fixture({ initial: { status, result }, execute: async () => assert.fail('Terminal rerun') });
    assert.deepEqual(await f.invoke(), result);
    assert.equal(f.observed.length, 0);
    assert.equal(f.audits.length, 0);
  }
});

test('audit failure after durable completion cannot rerun or invalidate successful AI', async () => {
  const f = fixture({ execute: async () => ({ title: 'Saved' }) });
  const originalCreate = f.Audit.create;
  f.Audit.create = async (data) => {
    const row = await originalCreate(data);
    row.update = async () => { throw new Error('audit unavailable'); };
    return row;
  };
  assert.deepEqual(await f.invoke(), { title: 'Saved' });
  assert.equal(f.record.status, 'completed');
  assert.equal(f.logs.length, 1);
});

test('transient DB failure before STARTED retries without leaving orphan audit or running inference', async () => {
  for (const failOn of ['getRecord', 'update']) {
    const f = fixture({ execute: async () => ({ title: 'Recovered' }) });
    const original = f.jobService[failOn];
    let failed = false;
    f.jobService[failOn] = async (...args) => {
      if (!failed) {
        failed = true;
        throw Object.assign(new Error('temporary persistence failure'), { name: 'SequelizeConnectionError' });
      }
      return original.apply(f.jobService, args);
    };
    await assert.rejects(f.invoke(), { name: 'SequelizeConnectionError' });
    assert.equal(f.record.status, 'queued');
    assert.equal(f.record.stage, 'RETRYING');
    assert.equal(f.audits.length, 0);
    assert.equal(f.observed.length, 0);
    assert.deepEqual(await f.invoke(1), { title: 'Recovered' });
    assert.equal(f.record.status, 'completed');
    assert.equal(f.audits.length, 1);
  }
});

test('invalid stored owner is unrecoverable and never calls pipeline', async () => {
  const f = fixture({ initial: { user_id: null }, execute: async () => assert.fail('Unowned inference') });
  await assert.rejects(f.invoke(), { name: 'UnrecoverableError', message: 'AI_INVALID_JOB' });
  assert.equal(f.record.status, 'failed');
  assert.equal(f.record.error.code, 'AI_INVALID_JOB');
  assert.equal(f.audits.length, 0);
});

test('failed listener reconciles pre-STARTED failures or stalled workers only after BullMQ is terminal', async () => {
  const f = fixture({ execute: async () => assert.fail('No inference for failed worker') });
  const reconcile = createAiJobFailureReconciler({ jobService: f.jobService });
  let state = 'delayed';
  const queueJob = { data: { jobId: f.record.job_id }, async getState() { return state; } };
  assert.equal(await reconcile(queueJob, new Error('temporary')), false);
  assert.equal(f.record.status, 'queued');
  state = 'failed';
  assert.equal(await reconcile(queueJob, new Error('stalled more than allowable limit')), true);
  assert.equal(f.record.status, 'failed');
  assert.equal(f.record.error.code, 'AI_WORKER_FAILED');
  assert.equal(f.events.at(-1).status, 'failed');
  const sequence = f.record.sequence;
  assert.equal(await reconcile(queueJob, new Error('duplicate failed notification')), false);
  assert.equal(f.record.sequence, sequence);
});

test('reconciliation retries persistence a bounded number of times and preserves safe terminal error codes', async () => {
  const f = fixture({ execute: async () => ({}) });
  const originalGet = f.jobService.getRecord;
  let reads = 0;
  f.jobService.getRecord = async (...args) => {
    if (++reads < 3) throw new Error('DB temporarily offline');
    return originalGet(...args);
  };
  const waits = [];
  const reconcile = createAiJobFailureReconciler({ jobService: f.jobService,
    wait: async (ms) => waits.push(ms) });
  const queueJob = { data: { jobId: f.record.job_id }, async getState() { return 'failed'; } };
  assert.equal(await reconcile(queueJob, { name: 'UnrecoverableError', message: 'AI_DEADLINE_EXCEEDED' }), true);
  assert.equal(reads, 3);
  assert.deepEqual(waits, [250, 500]);
  assert.equal(f.record.error.code, 'AI_DEADLINE_EXCEEDED');

  const logs = [];
  let attempts = 0;
  const unavailable = createAiJobFailureReconciler({
    jobService: { async getRecord() { attempts += 1; throw new Error('connection failed'); } },
    wait: async () => {}, logger: { error(message) { logs.push(message); } },
  });
  assert.equal(await unavailable(queueJob, new Error('https://example.invalid?api_key=private')), false);
  assert.equal(attempts, 3);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].includes('private'), false);
});

test('reconciliation cannot overwrite completed/cancelled jobs or act on missing queue metadata', async () => {
  for (const status of ['completed', 'cancelled']) {
    const f = fixture({ initial: { status, result: status === 'completed' ? { title: 'Saved' } : null },
      execute: async () => assert.fail('Terminal inference') });
    const reconcile = createAiJobFailureReconciler({ jobService: f.jobService });
    assert.equal(await reconcile({ data: { jobId: f.record.job_id }, async getState() { return 'failed'; } },
      new Error('late failure')), false);
    assert.equal(f.record.status, status);
    assert.equal(f.events.length, 0);
    assert.equal(await reconcile(undefined, new Error('missing queue job')), false);
  }
});
