/**
 * @file ai-metrics.service.js
 * @module AI_Metrics
 * @description Chỉ số vận hành AI dùng nhãn hữu hạn; không ghi tiêu đề, tài khoản hoặc dữ liệu form.
 */

import client from 'prom-client';

import { register } from '../../../middlewares/monitoring.middleware.js';

const jobs = new client.Counter({
  name: 'ai_jobs_total', help: 'Số job AI kết thúc theo trạng thái và mức độ đầy đủ.',
  labelNames: ['status', 'partial'], registers: [register],
});
const duration = new client.Histogram({
  name: 'ai_job_duration_seconds', help: 'Thời gian xử lý job AI kể cả retry.',
  buckets: [1, 5, 15, 30, 60, 90, 120, 180], registers: [register],
});
const providerErrors = new client.Counter({
  name: 'ai_provider_errors_total', help: 'Job có giới hạn hoặc lỗi provider, bao gồm kết quả một phần.',
  labelNames: ['reason'], registers: [register],
});
const reviewed = new client.Counter({
  name: 'ai_review_fields_total', help: 'Số trường đã được admin duyệt theo quyết định.',
  labelNames: ['decision'], registers: [register],
});

/** Cổng quan sát best effort, được gọi sau persistence và không ảnh hưởng kết quả job. */
export const aiMetrics = {
  job(dto, record) {
    jobs.inc({ status: dto.status, partial: dto.result?.partial_reason ? 'true' : 'false' });
    if (record.started_at) duration.observe(Math.max(0, (Date.now() - new Date(record.started_at).getTime()) / 1000));
    const code = String(dto.result?.provider_error?.code || dto.result?.partial_reason?.code || dto.error?.code || '');
    if (code && code !== 'AI_CANCELLED') {
      const reason = /QUOTA|RATE_LIMIT|COOLDOWN/.test(code) ? 'quota'
        : /DEADLINE|TIMEOUT/.test(code) ? 'deadline'
          : /PROVIDER|MODEL/.test(code) ? 'provider' : 'other';
      providerErrors.inc({ reason });
    }
  },
  review({ appliedFields, skippedCount }) {
    reviewed.inc({ decision: 'applied' }, appliedFields.length);
    reviewed.inc({ decision: 'skipped' }, skippedCount);
  },
};
