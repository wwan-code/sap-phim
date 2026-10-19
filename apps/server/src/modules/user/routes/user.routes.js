/**
 * @file user.routes.js
 * @module Modules_User_Routes
 * @description Định tuyến các API dành cho thành viên liên quan đến hồ sơ, cài đặt và xã hội.
 */

import express from "express";
import { userController } from "../controllers/user.controller.js";
import { validate, validateQuery } from "../../../middlewares/validator.middleware.js";
import { verifyToken, optionalAuth } from "../../../middlewares/auth.middleware.js";
import {
  updateProfileSchema,
  updatePreferencesSchema,
  updatePrivacySchema,
  presetSchema,
  deleteAccountSchema,
} from "../validators/user.validator.js";

const router = express.Router();

// ── MEMBER ENDPOINTS (Yêu cầu đăng nhập) ──

const requireAuth = verifyToken;

// Profile cá nhân
router.get("/users/me", requireAuth, userController.getMyProfile);
router.patch("/users/me", requireAuth, validate(updateProfileSchema), userController.updateMyProfile);

// Preferences & Privacy
router.get("/users/me/preferences", requireAuth, userController.getPreferences);
router.patch("/users/me/preferences", requireAuth, validate(updatePreferencesSchema), userController.updatePreferences);
router.patch("/users/me/privacy", requireAuth, validate(updatePrivacySchema), userController.updatePrivacy);
router.post("/users/me/preferences/reset", requireAuth, userController.resetPreferences);
router.post("/users/me/preferences/preset", requireAuth, validate(presetSchema), userController.applyPreset);

// Account Actions
router.get("/users/me/stats", requireAuth, userController.getStats);
router.get("/users/me/export", requireAuth, userController.exportData);
router.delete("/users/me", requireAuth, validate(deleteAccountSchema), userController.deleteAccount);

// ── SOCIAL & PUBLIC ENDPOINTS ──

// Public profile (với tuỳ chọn Auth để nhận biết friend/self)
router.get("/users/:userId", optionalAuth, userController.getUserProfile);

// Follow actions
router.post("/users/:userId/follow", requireAuth, userController.follow);
router.delete("/users/:userId/follow", requireAuth, userController.unfollow);

// Danh sách follow (Public/Optional Auth)
router.get("/users/:userId/followers", optionalAuth, userController.getFollowers);
router.get("/users/:userId/following", optionalAuth, userController.getFollowing);

export default router;
