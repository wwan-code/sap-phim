/**
 * @file watch-history.validator.js
 * @module Validator_WatchHistory
 * @description Xác thực dữ liệu lưu tiến độ xem.
 */

import Joi from "joi";

export const watchHistoryValidator = {
  progress: Joi.object({
    episode_id: Joi.string().uuid().required(),
    position_seconds: Joi.number().integer().min(0).required(),
    duration_seconds: Joi.number().integer().min(0).optional(),
    is_completed: Joi.boolean().optional(),
    metadata: Joi.object().unknown(true).optional(),
  }),
};

export default watchHistoryValidator;
