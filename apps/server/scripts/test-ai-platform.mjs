/**
 * @file test-ai-platform.mjs
 * @module Scripts_Test_AI_Platform
 * @description Chạy kiểm thử AI cô lập, không kết nối DB/Redis hoặc gọi nhà cung cấp thật; giữ mã lỗi của assertion.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../src/modules/ai/', import.meta.url);
const collectTests = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const location = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
  return entry.isDirectory() ? collectTests(location) : entry.name.endsWith('.test.mjs') ? [fileURLToPath(location)] : [];
});
const tests = [...collectTests(root), ...collectTests(new URL('../src/sockets/utils/', import.meta.url))].sort();
if (!tests.length) throw new Error('[Test][AI] Không tìm thấy kiểm thử cô lập.');
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
