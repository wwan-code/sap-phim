/**
 * @file engagement.validator.js
 * @module Validator_Engagement
 * @description Xác thực dữ liệu rating và comment.
 */

import Joi from "joi";

export const engagementValidator = {
  rating: Joi.object({
    movie_id: Joi.string().uuid().required(),
    episode_id: Joi.string().uuid().allow(null).optional(),
    score: Joi.number().integer().min(1).max(10).required(),
    review: Joi.string().max(3000).allow("", null).optional(),
    is_spoiler: Joi.boolean().default(false),
  }),

  comment: Joi.object({
    movie_id: Joi.string().uuid().required(),
    episode_id: Joi.string().uuid().allow(null).optional(),
    parent_id: Joi.string().uuid().allow(null).optional(),
    content: Joi.string().trim().min(1).max(3000).required(),
    is_spoiler: Joi.boolean().default(false),
  }),
};

export default engagementValidator;
