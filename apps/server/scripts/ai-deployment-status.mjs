/**
 * @file ai-deployment-status.mjs
 * @module Scripts_AI_Deployment
 * @description Kiểm tra chỉ đọc schema và queue trước khi triển khai AI; không xuất khóa hoặc thông tin kết nối.
 */

import dotenv from 'dotenv';
import pg from 'pg';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
const database = new pg.Client({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
const connection = new IORedis({
  host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  connectTimeout: 5000, commandTimeout: 5000, maxRetriesPerRequest: 1,
  retryStrategy: () => null,
});
connection.on('error', () => {});
const queue = new Queue('ai-queue', { connection });
try {
  await database.connect();
  const [{ rows: migrations }, { rows: tables }, counts] = await Promise.all([
    database.query('SELECT name FROM "SequelizeMeta" ORDER BY name'),
    database.query("SELECT to_regclass('public.ai_jobs') IS NOT NULL AS ai_jobs"),
    queue.getJobCounts('waiting', 'active', 'delayed', 'prioritized', 'waiting-children', 'paused'),
  ]);
  const inFlight = Object.values(counts).reduce((sum, count) => sum + count, 0);
  console.info('[Deploy][AI]', JSON.stringify({
    localDatabase: ['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST),
    schemaReady: tables[0].ai_jobs,
    lastMigration: migrations.at(-1)?.name,
    aiJobMigrationRecorded: migrations.some((row) => row.name === '20261019000000-create-ai-jobs.cjs'),
    queue: counts, drained: inFlight === 0,
  }));
} catch (error) {
  console.error('[Deploy][AI] Kiểm tra thất bại:', error.code || error.name);
  process.exitCode = 1;
} finally {
  await queue.close();
  connection.disconnect();
  await database.end();
}
