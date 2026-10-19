/**
 * @file ai.controller.js
 * @module AI_Controller
 * @description Controller mỏng cho nhận diện tác phẩm và vòng đời job AI có thể khôi phục.
 */

import { aiJobService, getAiAuditHistory } from '../services/ai-job.service.js';

/** @controller resolveMovie @route POST /api/v1/ai/resolve @description Tìm ứng viên trước khi tổng hợp. */
export const resolveMovie = async (req, res, next) => {
  try { res.json({ success: true, data: await aiJobService.resolve(req.body, req.user) }); } catch (error) { next(error); }
};

/** @controller suggestMovie @route POST /api/v1/ai/suggest @description Tiếp nhận yêu cầu đã gắn form. */
export const suggestMovie = async (req, res, next) => {
  try {
    const data = await aiJobService.submit(req.body, req.user);
    res.status(data.terminal ? 200 : 202).json({ success: true, data });
  } catch (error) { next(error); }
};

/** @controller getJobStatus @route GET /api/v1/ai/jobs/:jobId @description Khôi phục job, không gọi lại AI. */
export const getJobStatus = async (req, res, next) => {
  try { res.json({ success: true, data: await aiJobService.get((req.validatedParams || req.params).jobId, req.user) }); } catch (error) { next(error); }
};

/** @controller listJobs @route GET /api/v1/ai/jobs @description Liệt kê job theo tài khoản và form. */
export const listJobs = async (req, res, next) => {
  try { res.json({ success: true, data: await aiJobService.list(req.validatedQuery || req.query, req.user) }); } catch (error) { next(error); }
};

/** @controller cancelJob @route POST /api/v1/ai/jobs/:jobId/cancel @description Hủy job thuộc quyền quản lý. */
export const cancelJob = async (req, res, next) => {
  try { res.json({ success: true, data: await aiJobService.cancel((req.validatedParams || req.params).jobId, req.user) }); } catch (error) { next(error); }
};

/** @controller reviewJob @route POST /api/v1/ai/jobs/:jobId/review @description Ghi thống kê chấp nhận, không lưu hay publish phim. */
export const reviewJob = async (req, res, next) => {
  try { res.json({ success: true, data: await aiJobService.recordReview((req.validatedParams || req.params).jobId, req.body, req.user) }); } catch (error) { next(error); }
};

/** @controller getAuditHistory @route GET /api/v1/ai/history @description Đọc kiểm toán đã phân trang. */
export const getAuditHistory = async (req, res, next) => {
  try { res.json({ success: true, data: await getAiAuditHistory(req.validatedQuery || req.query, req.user) }); } catch (error) { next(error); }
};

export default { resolveMovie, suggestMovie, getJobStatus, listJobs, cancelJob, reviewJob, getAuditHistory };
