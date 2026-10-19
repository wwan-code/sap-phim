/**
 * @file engagement.routes.js
 * @module Routes_Engagement
 * @description Định nghĩa route rating và comment cơ bản.
 */

import express from "express";

import { engagementController } from "../controllers/engagement.controller.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { verifyToken } from "../../../middlewares/auth.middleware.js";
import { engagementValidator } from "../validators/engagement.validator.js";

const router = express.Router();

router.get("/movies/:movieId/comments", engagementController.listComments);
router.post("/ratings", verifyToken, validate(engagementValidator.rating), engagementController.rate);
router.post("/comments", verifyToken, validate(engagementValidator.comment), engagementController.createComment);

export default router;
