/**
 * @file episode.routes.js
 * @module Routes_Episode
 * @description Định nghĩa route danh sách tập, playback và quản trị episode.
 */

import express from "express";

import { episodeController } from "../controllers/episode.controller.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { verifyToken, optionalAuth, hasPermission } from "../../../middlewares/auth.middleware.js";
import { episodeValidator } from "../validators/episode.validator.js";
import multerLib from "multer";

const router = express.Router();

const uploadSubtitleFile = multerLib({
  storage: multerLib.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");

router.get("/movies/:movieId/episodes", episodeController.listByMovie);
router.get("/episodes/:id/playback", optionalAuth, episodeController.getPlayback);

router.get(
  "/admin/episodes",
  verifyToken,
  hasPermission("episodes.view"),
  episodeController.getAll,
);

router.post(
  "/admin/episodes",
  verifyToken,
  hasPermission("episodes.create"),
  validate(episodeValidator.create),
  episodeController.create,
);

router.post(
  "/admin/episodes/:id/upload-token",
  verifyToken,
  hasPermission("episodes.edit"),
  episodeController.requestUploadToken,
);

router.post(
  "/admin/episodes/:id/retry",
  verifyToken,
  hasPermission("episodes.edit"),
  episodeController.retryJob,
);

router.delete(
  "/admin/episodes/:id/video",
  verifyToken,
  hasPermission("episodes.edit"),
  episodeController.deleteVideoAsset,
);

router.get(
  "/admin/episodes/:id/subtitles",
  verifyToken,
  hasPermission("episodes.view"),
  episodeController.listSubtitles,
);

router.post(
  "/admin/episodes/:id/subtitles",
  verifyToken,
  hasPermission("episodes.edit"),
  uploadSubtitleFile,
  episodeController.uploadSubtitle,
);

router.delete(
  "/admin/episodes/:id/subtitles/:language",
  verifyToken,
  hasPermission("episodes.edit"),
  episodeController.deleteSubtitle,
);

router.patch(
  "/admin/episodes/:id",
  verifyToken,
  hasPermission("episodes.edit"),
  validate(episodeValidator.update),
  episodeController.update,
);
router.delete(
  "/admin/episodes/:id",
  verifyToken,
  hasPermission("episodes.delete"),
  episodeController.delete,
);

export default router;
