/**
 * @file episode.validator.js
 * @module Validator_Episode
 * @description Xác thực dữ liệu đầu vào cho module tập phim.
 */

import Joi from "joi";

const sourceSchema = Joi.object({
  label: Joi.string().trim().max(100).required(),
  quality: Joi.string().trim().max(30).required(),
  url: Joi.string().trim().required(),
  type: Joi.string().trim().max(30).optional(),
  is_default: Joi.boolean().optional(),
});

const subtitleSchema = Joi.object({
  label: Joi.string().trim().max(100).required(),
  srclang: Joi.string().trim().max(10).required(),
  url: Joi.string().trim().required(),
  default: Joi.boolean().optional(),
});

export const episodeValidator = {
  create: Joi.object({
    movie_id: Joi.string().uuid().required(),
    episode_number: Joi.number().integer().min(0).required(),
    title: Joi.string().allow("", null).optional(),
    duration: Joi.number().integer().min(0).allow(null).default(null),
    video_sources: Joi.array().items(sourceSchema).default([]),
    thumbnail_url: Joi.string().allow("", null).optional(),
    sprite_url: Joi.string().allow("", null).optional(),
    vtt_url: Joi.string().allow("", null).optional(),
    subtitle_sources: Joi.array().items(subtitleSchema).default([]),
    audio_tracks: Joi.array().items(Joi.object().unknown(true)).default([]),
    status: Joi.string().valid("ready", "processing", "pending", "failed", "uploading", "uploaded").default("pending"),
    publish_state: Joi.string().valid("draft", "published", "private").default("draft"),
    published_at: Joi.date().iso().allow(null).optional(),
    scheduled_at: Joi.date().iso().allow(null).optional(),
    is_premium: Joi.boolean().default(false),
  })
    .custom((value, helpers) => {
      if (value.status === "ready" && (!value.video_sources || value.video_sources.length === 0)) {
        return helpers.message('"status" không thể là "ready" khi "video_sources" rỗng');
      }
      return value;
    }),

  update: Joi.object({
    movie_id: Joi.string().uuid().optional(),
    episode_number: Joi.number().integer().min(0).optional(),
    title: Joi.string().allow("", null).optional(),
    duration: Joi.number().integer().min(0).allow(null).optional(),
    video_sources: Joi.array().items(sourceSchema).optional(),
    thumbnail_url: Joi.string().allow("", null).optional(),
    sprite_url: Joi.string().allow("", null).optional(),
    vtt_url: Joi.string().allow("", null).optional(),
    subtitle_sources: Joi.array().items(subtitleSchema).optional(),
    audio_tracks: Joi.array().items(Joi.object().unknown(true)).optional(),
    status: Joi.string().valid("ready", "processing", "pending", "failed", "uploading", "uploaded").optional(),
    publish_state: Joi.string().valid("draft", "published", "private").optional(),
    published_at: Joi.date().iso().allow(null).optional(),
    scheduled_at: Joi.date().iso().allow(null).optional(),
    is_premium: Joi.boolean().optional(),
  })
    .custom((value, helpers) => {
      if (value.status === "ready" && Array.isArray(value.video_sources) && value.video_sources.length === 0) {
        return helpers.message('"status" không thể là "ready" khi "video_sources" rỗng');
      }
      return value;
    }),
};

export default episodeValidator;