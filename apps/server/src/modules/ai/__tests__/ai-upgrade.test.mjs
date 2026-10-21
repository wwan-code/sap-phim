import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entityKey, validateApplication } from '../helpers/entity-identity.helper.js';
import { parseSourceQuery, buildSearchSql } from '../../movie/helpers/movie-search.helper.js';
import { createQuotaGovernor } from '../helpers/provider-quota.helper.js';
import { EvidenceCollectorService } from '../services/evidence-collector.service.js';
import { AIPipelineService, projectSuggestionScope } from '../services/ai.service.js';
import { isFreeOpenRouterModelId, isZeroPriceModel, runBudgetedRequest, createExecutionBudget } from '../helpers/ai-providers.helper.js';

test('source syntax disambiguates TMDB namespaces and never guesses bare numeric IDs', () => {
  assert.equal(parseSourceQuery('123'), null);
  assert.equal(parseSourceQuery('tmdb:123'), null);
  assert.equal(parseSourceQuery('tmdb:tv:123').mediaType, 'series');
  assert.equal(parseSourceQuery('tmdb:movie:123').mediaType, 'movie');
  assert.equal(parseSourceQuery('imdb:tt123456').id, 'tt123456');
  assert.equal(parseSourceQuery('mal:9999999999'), null);
  assert.throws(() => buildSearchSql({ query: 'x', field: 'title;DROP TABLE movies', escape: JSON.stringify }));
});
test('same-name people have different identities and unverified names have no key', () => {
  assert.notEqual(entityKey('actor', { source: 'tmdb', source_id: 1 }), entityKey('actor', { source: 'anilist', source_id: 1 }));
  assert.equal(entityKey('actor', { name: 'Example' }), null);
  assert.equal(entityKey('studio', { source: 'jikan', source_id: 1 }), null);
});
const key = 'tmdb:person:1';
const application = { job_id: 'job', candidate_id: 'candidate', draft_id: 'draft', entity_keys: [key] };
const job = { user_id: 'user', status: 'completed', target: { draftId: 'draft' }, request_payload: { selectedCandidate: { candidateId: 'candidate', sourceIds: { tmdb: 7 }, mediaType: 'movie' } },
  result: { entity_contract_version: 1, suggested_entities: { actors: [{ source: 'tmdb', source_id: '1', entity_key: key, match_status: 'new_verified' }] } } };
test('application rejects cross-owner, cross-target, unknown entities and legacy evidence', () => {
  assert.equal(validateApplication(job, application, { userId: 'user' }).length, 1);
  for (const context of [{ userId: 'other' }, { userId: 'user', movieId: 'other' }, { userId: 'user', data: { tmdb_id: 8 } }]) assert.throws(() => validateApplication(job, application, context));
  assert.throws(() => validateApplication(job, { ...application, entity_keys: ['tmdb:person:2'] }, { userId: 'user' }));
  assert.throws(() => validateApplication({ ...job, result: {} }, application, { userId: 'user' }));
});
test('quota absence, Redis outage and exhausted shared quota block outbound work', async () => {
  const config = { AI_GEMINI_RPM: 1, AI_GEMINI_RPD: 1 };
  await assert.rejects(createQuotaGovernor({ redis: {}, config: {} }).reserve('gemini'), { code: 'AI_QUOTA_UNCONFIGURED' });
  await assert.rejects(createQuotaGovernor({ redis: { eval: async () => { throw Error('offline'); } }, config }).reserve('gemini'), { code: 'AI_QUOTA_UNAVAILABLE' });
  const quota = createQuotaGovernor({ redis: { eval: async () => 1000 }, config });
  let called = false;
  await assert.rejects(runBudgetedRequest({ budget: createExecutionBudget(), governor: quota, provider: 'gemini' }, async () => { called = true; }));
  assert.equal(called, false);
});
test('free policy rejects unknown, paid and malformed prices', () => {
  assert.equal(isFreeOpenRouterModelId('vendor/paid'), false);
  assert.equal(isZeroPriceModel({}), false);
  assert.equal(isZeroPriceModel({ pricing: { prompt: '0', completion: '0', request: '0', image: '1' } }), false);
  assert.equal(isZeroPriceModel({ pricing: { prompt: '0', completion: '0', request: '0' } }), true);
});
test('enrichment runs at bounded concurrency and abort is not swallowed', async () => {
  const collector = new EvidenceCollectorService();
  let active = 0, max = 0;
  collector.fetchTMDBPerson = async () => { active++; max = Math.max(max, active); await new Promise((r) => setTimeout(r, 5)); active--; return {}; };
  const actors = Array.from({ length: 12 }, (_, i) => ({ source: 'tmdb', source_id: String(i + 1), is_new: true }));
  const result = await collector.enrichActorDetails(actors, { concurrency: 3 });
  assert.equal(max, 3); assert.equal(result.filter((r) => r.enrichment_status === 'enriched').length, 10);
  await assert.rejects(collector.enrichActorDetails(actors, { signal: AbortSignal.abort() }));
});
test('metadata pipeline never calls LLM or entity writer and preserves additive contract in scopes', async () => {
  const snapshot = { source_presence: { tmdb: true }, tmdb: { id: 7, title: 'Example', release_date: '2020-01-01', media_type: 'movie' }, source_errors: [], visual_assets: {} };
  const pipeline = new AIPipelineService({ collector: { collectEvidence: async () => snapshot }, matcher: { commitEntities: () => assert.fail('suggestion wrote entities') }, orchestrator: { execute: () => assert.fail('metadata called LLM') } });
  pipeline.matchRelationships = async () => ({ matched_genre_ids: [], matched_actors: [], actors: [], labels: {} });
  const result = await pipeline.executePipeline({ title: 'Example', type: 'metadata', selectedCandidate: { candidateId: 'candidate' } });
  assert.equal(result.entity_contract_version, 1); assert.equal(result.candidate_id, 'candidate');
  assert.equal(projectSuggestionScope(result, 'cast').entity_contract_version, 1);
});
