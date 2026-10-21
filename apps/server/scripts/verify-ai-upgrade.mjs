/** PostgreSQL integration and 10k/5-client search benchmark. Requires a dedicated local test database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { writeFile } from 'node:fs/promises';
import { Sequelize, DataTypes } from 'sequelize';
import migration from '../src/migrations/20261021000000-admin-movie-search.cjs';
import identityMigration from '../src/migrations/20261020000000-add-director-metadata-and-source-indexes.cjs';
import { createEntityPersistence } from '../src/modules/ai/services/entity-persistence.service.js';
import { buildSearchSql } from '../src/modules/movie/helpers/movie-search.helper.js';
import { titles, queries } from './fixtures/movie-search.fixture.mjs';

const connection = process.env.AI_TEST_DATABASE_URL;
if (!connection) throw new Error('Set AI_TEST_DATABASE_URL to a dedicated local database named sap_phim_ai_test.');
const url = new URL(connection);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/sap_phim_ai_test') throw new Error('Refusing non-test database.');
const schema = `ai_test_${Date.now()}`;
const db = new Sequelize(connection, { logging: false, pool: { max: 5 }, dialectOptions: { options: `-c search_path=${schema},public` } });
const common = { id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 }, name: DataTypes.STRING, slug: DataTypes.STRING,
  metadata: { type: DataTypes.JSONB, defaultValue: {} }, deleted_at: DataTypes.DATE, created_by: DataTypes.UUID, updated_by: DataTypes.UUID };
const options = (tableName) => ({ tableName, timestamps: false, schema });
const Actor = db.define('Actor', { ...common, aliases: { type: DataTypes.JSONB, defaultValue: [] }, image_url: DataTypes.TEXT, biography: DataTypes.TEXT, gender: DataTypes.STRING, birth_date: DataTypes.DATEONLY, nationality: DataTypes.STRING }, options('actors'));
const Studio = db.define('Studio', { ...common, logo_url: DataTypes.TEXT, country: DataTypes.STRING }, options('studios'));
const Movie = db.define('Movie', { id: common.id, titles: DataTypes.JSONB, director: DataTypes.STRING, studio_id: DataTypes.UUID, type: DataTypes.STRING,
  tmdb_id: DataTypes.INTEGER, anilist_id: DataTypes.INTEGER, mal_id: DataTypes.INTEGER, imdb_id: DataTypes.STRING, release_year: DataTypes.INTEGER, deleted_at: DataTypes.DATE }, options('movies'));
const Cast = db.define('Cast', { id: common.id, movie_id: DataTypes.UUID, actor_id: DataTypes.UUID }, options('movie_actors'));
const AIJob = db.define('AIJob', { id: common.id, job_id: DataTypes.STRING, user_id: DataTypes.UUID, status: DataTypes.STRING, target: DataTypes.JSONB, request_payload: DataTypes.JSONB, result: DataTypes.JSONB }, options('ai_jobs'));
const apply = createEntityPersistence({ AIJob, Actor, Studio, sequelize: db });
const report = { at: new Date().toISOString(), schema, platform: os.platform(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, hostRamBytes: os.totalmem(), node: process.version, externalRequests: 0, integration: [] };
const checked = (name) => report.integration.push(name);
try {
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.sync();
  const qi = db.getQueryInterface();
  const scopedQi = Object.create(qi);
  scopedQi.describeTable = (table, opts) => qi.describeTable({ tableName: table, schema }, opts);
  scopedQi.addColumn = (table, name, attr, opts) => qi.addColumn({ tableName: table, schema }, name, attr, opts);
  await identityMigration.up(scopedQi, Sequelize);
  await migration.up(db.getQueryInterface());
  checked('additive migrations');
  const owner = randomUUID(), draft = randomUUID(), candidate = 'fixture-candidate';
  const entity = { actor_name: 'Same Name', source: 'tmdb', source_id: '700', entity_key: 'tmdb:person:700', match_status: 'new_verified', biography: 'Verified biography' };
  const job = await AIJob.create({ job_id: 'fixture-job', user_id: owner, status: 'completed', target: { draftId: draft }, request_payload: { selectedCandidate: { candidateId: candidate, sourceIds: {} } }, result: { entity_contract_version: 1, suggested_entities: { actors: [entity] } } });
  const payload = { actor_cast: [entity], ai_application: { job_id: job.job_id, candidate_id: candidate, draft_id: draft, entity_keys: [entity.entity_key] } };
  const save = () => db.transaction((transaction) => apply(payload, { userId: owner, transaction }));
  const [first, second] = await Promise.all([save(), save()]);
  assert.equal(first.actor_cast[0].actor_id, second.actor_cast[0].actor_id);
  assert.equal(await Actor.count(), 1); checked('concurrent source identity creates one actor');
  const record = await Actor.findByPk(first.actor_cast[0].actor_id);
  await record.update({ biography: 'Manual biography' }); await save();
  assert.equal((await record.reload()).biography, 'Manual biography'); checked('manual fields preserved');
  await assert.rejects(db.transaction((transaction) => apply(payload, { userId: randomUUID(), transaction }))); checked('cross-owner denied');
  const rollbackEntity = { ...entity, source_id: '701', entity_key: 'tmdb:person:701' };
  await job.update({ result: { ...job.result, suggested_entities: { actors: [rollbackEntity] } } });
  await assert.rejects(db.transaction(async (transaction) => {
    await apply({ actor_cast: [rollbackEntity], ai_application: { ...payload.ai_application, entity_keys: [rollbackEntity.entity_key] } }, { userId: owner, transaction });
    throw Error('movie validation failed');
  }));
  assert.equal(await Actor.count(), 1); checked('movie transaction rollback leaves no new actor');
  const fixtures = Array.from({ length: 10000 }, (_, i) => ({ id: randomUUID(), tmdb_id: i + 1, type: 'movie', release_year: 2000 + i % 25,
    titles: (titles[i] || [`Catalog fixture ${i + 1}`]).map((title) => ({ title })), director: `Đạo diễn ${i + 1} thử nghiệm` }));
  for (let start = 0; start < fixtures.length; start += 250) await Movie.bulkCreate(fixtures.slice(start, start + 250));
  await Movie.create({ id: randomUUID(), tmdb_id: 1, type: 'series', titles: [{ title: 'Namespace series fixture' }] });
  for (let i = 0; i < titles.length; i++) {
    const actor = await Actor.create({ name: `Diễn viên ${i + 1} thử nghiệm` });
    await Cast.create({ movie_id: fixtures[i].id, actor_id: actor.id });
  }
  await db.query('ANALYZE movies; ANALYZE movie_search_documents');
  const search = async ({ query, field = 'all' }) => {
    const sql = buildSearchSql({ query, field, escape: (v) => db.escape(v) });
    const [rows] = await db.query(`SELECT "Movie".id, "Movie".tmdb_id, "Movie".type FROM movies "Movie" WHERE "Movie".deleted_at IS NULL AND ${sql.condition} ORDER BY ${sql.rank} DESC, "Movie".id ASC LIMIT 5`);
    return rows.map((row) => row.type === 'series' ? 10000 + row.tmdb_id : row.tmdb_id);
  };
  const quality = {}, failures = [], cold = [];
  for (const query of queries) {
    const start = performance.now(); const results = await search(query); cold.push(performance.now() - start);
    const pass = query.expected == null ? results.length === 0 : query.group === 'typo' ? results.includes(query.expected) : results[0] === query.expected;
    quality[query.group] ||= { total: 0, passed: 0 }; quality[query.group].total++; quality[query.group].passed += Number(pass);
    if (!pass) failures.push({ ...query, actual: results });
  }
  const warm = []; let next = 0;
  await Promise.all(Array.from({ length: 5 }, async () => { while (next < queries.length * 3) {
    const query = queries[next++ % queries.length]; const start = performance.now(); await search(query); warm.push(performance.now() - start);
  } }));
  const percentile = (items, percent) => [...items].sort((a,b) => a-b)[Math.min(items.length - 1, Math.ceil(items.length * percent)-1)];
  report.search = { catalogSize: 10001, clients: 5, queries: queries.length, quality, failures, firstPass: { p50: percentile(cold,.5), p95: percentile(cold,.95), p99: percentile(cold,.99) }, warm: { p50: percentile(warm,.5), p95: percentile(warm,.95), p99: percentile(warm,.99) }, memory: process.memoryUsage(), note: 'SQL retrieval benchmark, first pass is not OS-cache eviction; excludes HTTP/auth and third-party latency.' };
  await Actor.update({ name: 'Renamed fixture actor' }, { where: { name: 'Diễn viên 1 thử nghiệm' } });
  assert.equal((await search({ query: 'Renamed fixture actor', field: 'actor' }))[0], 1); checked('actor rename refreshes projection');
  await Movie.update({ titles: [{ title: 'Changed fixture title' }] }, { where: { id: fixtures[0].id } });
  assert.equal((await search({ query: 'Changed fixture title' }))[0], 1); checked('movie update refreshes projection');
  report.passed = quality.id.passed === quality.id.total && (quality.exact.passed + quality.folded.passed)/(quality.exact.total + quality.folded.total) >= .98 && quality.typo.passed/quality.typo.total >= .9 && failures.filter((q) => !['typo','exact','folded'].includes(q.group)).length === 0 && report.search.warm.p95 <= 300 && report.search.firstPass.p95 <= 800;
  console.info(JSON.stringify(report, null, 2));
  if (process.env.AI_BENCHMARK_REPORT) await writeFile(process.env.AI_BENCHMARK_REPORT, JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  // Only this script's generated schema, in the strictly allowlisted test DB.
  await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.close();
}
