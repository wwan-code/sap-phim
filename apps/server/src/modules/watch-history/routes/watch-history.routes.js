/**
 * @file watch-history.routes.js
 * @module Routes_WatchHistory
 * @description Định nghĩa route lưu tiến độ xem và xem tiếp.
 */

import express from "express";

import { watchHistoryController } from "../controllers/watch-history.controller.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { verifyToken } from "../../../middlewares/auth.middleware.js";
import { watchHistoryValidator } from "../validators/watch-history.validator.js";

const router = express.Router();

router.post(
  "/watch-history/progress",
  verifyToken,
  validate(watchHistoryValidator.progress),
  watchHistoryController.saveProgress,
);
router.get("/watch-history/continue", verifyToken, watchHistoryController.continueWatching);

export default router;
