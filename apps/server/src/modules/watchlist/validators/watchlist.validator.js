/**
 * @file watchlist.validator.js
 * @module Validator_Watchlist
 * @description Xác thực dữ liệu watchlist.
 */

import Joi from "joi";

export const watchlistValidator = {
  upsert: Joi.object({
    movie_id: Joi.string().uuid().required(),
    status: Joi.string().valid("planned", "watching", "completed", "favorite").default("planned"),
    is_public: Joi.boolean().default(false),
    note: Joi.string().max(500).allow("", null).optional(),
  }),
};

export default watchlistValidator;
