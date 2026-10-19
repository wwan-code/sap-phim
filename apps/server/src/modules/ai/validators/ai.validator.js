/**
 * @file ai.validator.js
 * @module AI_Validator
 * @description Schema giới hạn context, định danh form và tùy chọn dịch vụ miễn phí.
 */

import Joi from 'joi';

const title = Joi.string().trim().min(1).max(500).required();
const year = Joi.number().integer().min(1900).max(2100).allow(null, '').optional();
const target = Joi.object({ movieId: Joi.string().uuid().allow(null), draftId: Joi.string().uuid().allow(null) })
  .custom((value, helpers) => Boolean(value.movieId) === Boolean(value.draftId) ? helpers.error('any.invalid') : value);
const context = Joi.object({
  current_title: Joi.string().max(500).allow(''), romaji_title: Joi.string().max(500).allow(''),
  slug: Joi.string().max(500).allow(''), type: Joi.string().max(30).allow(''),
  release_date: Joi.string().max(30).allow(''), release_year: Joi.alternatives().try(Joi.string().max(4).allow(''), Joi.number().integer().min(1900).max(2100)),
  quality: Joi.string().max(30).allow(''), sub_dub_type: Joi.string().max(30).allow(''), source_type: Joi.string().max(50).allow(''),
  category_id: Joi.string().uuid().allow('', null), country_id: Joi.string().uuid().allow('', null), studio_id: Joi.string().uuid().allow('', null),
  genre_ids: Joi.array().items(Joi.string().uuid()).max(50),
  tmdb_id: Joi.number().integer().positive().allow(null, ''),
  mal_id: Joi.number().integer().positive().allow(null, ''),
  anilist_id: Joi.number().integer().positive().allow(null, ''),
  imdb_id: Joi.string().pattern(/^tt\d{7,12}$/).allow(null, ''),
}).default({});
const pagination = { page: Joi.number().integer().min(1).default(1), limit: Joi.number().integer().min(1).max(50).default(20) };

export const aiValidator = {
  resolve: Joi.object({ title, year, target, media_type: Joi.string().valid('all', 'movie', 'series', 'tv', 'ova', 'ona', 'special').default('all') }),
  suggest: Joi.object({
    title, year, target, requestId: Joi.string().uuid(), resolutionId: Joi.string().uuid(), candidateId: Joi.string().max(128),
    media_type: Joi.string().valid('all', 'movie', 'series', 'tv', 'ova', 'ona', 'special').default('all'),
    type: Joi.string().valid('all', 'movie', 'series', 'metadata', 'cast', 'synopsis', 'seo').default('all'),
    mode: Joi.string().valid('auto', 'fast', 'deep').default('auto'),
    force_refresh: Joi.boolean().default(false), enable_web_search: Joi.boolean().default(false), context,
  }).with('candidateId', 'resolutionId'),
  jobId: Joi.object({ jobId: Joi.string().pattern(/^ai-[0-9a-f-]{36}$/i).required() }),
  list: Joi.object({ ...pagination, movieId: Joi.string().uuid(), draftId: Joi.string().uuid(), status: Joi.string().valid('queued', 'processing', 'completed', 'failed', 'cancelled') }).oxor('movieId', 'draftId'),
  history: Joi.object(pagination),
  review: Joi.object({
    appliedFields: Joi.array().items(Joi.string().pattern(/^[a-z][a-z0-9_]{0,63}$/)).unique().max(100).required(),
    skippedCount: Joi.number().integer().min(0).max(100).required(),
    consideredCount: Joi.number().integer().min(0).max(100).required(),
  }),
};

export default aiValidator;
