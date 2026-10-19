/**
 * @file ai.routes.js
 * @module Routes_AI
 * @description Route AI xác thực; quyền theo form và chủ sở hữu được kiểm tra tại service.
 */

import express from 'express';

import { validate } from '../../../middlewares/validator.middleware.js';
import { verifyToken } from '../../../middlewares/auth.middleware.js';
import { resolveMovie, suggestMovie, getJobStatus, listJobs, cancelJob, reviewJob, getAuditHistory } from '../controllers/ai.controller.js';
import { aiValidator } from '../validators/ai.validator.js';

const router = express.Router();
router.use(verifyToken);
router.post('/resolve', validate(aiValidator.resolve), resolveMovie);
router.post('/suggest', validate(aiValidator.suggest), suggestMovie);
router.get('/jobs', validate(aiValidator.list, 'query'), listJobs);
router.get('/jobs/:jobId', validate(aiValidator.jobId, 'params'), getJobStatus);
router.post('/jobs/:jobId/cancel', validate(aiValidator.jobId, 'params'), cancelJob);
router.post('/jobs/:jobId/review', validate(aiValidator.jobId, 'params'), validate(aiValidator.review), reviewJob);
router.get('/history', validate(aiValidator.history, 'query'), getAuditHistory);

export default router;
