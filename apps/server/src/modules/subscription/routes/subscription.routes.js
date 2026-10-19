/**
 * @file subscription.routes.js
 * @module Modules_Subscription_Routes
 * @description Định tuyến API Gói thành viên & Đăng ký cho End-User.
 */

import express from "express";
import { subscriptionController } from "../controllers/subscription.controller.js";
import { verifyToken } from "../../../middlewares/auth.middleware.js";
import { validate, validateQuery } from "../../../middlewares/validator.middleware.js";
import { subscriptionValidator } from "../validators/subscription.validator.js";

const router = express.Router();

// Public route: Lấy danh sách gói hội viên không cần đăng nhập
router.get("/membership-plans", subscriptionController.getActivePlans);

// Protected routes: Yêu cầu đăng nhập JWT Token
router.use("/subscriptions", verifyToken);

router.get("/subscriptions/active", subscriptionController.getActiveSubscription);
router.get("/subscriptions/entitlements", subscriptionController.getMyEntitlements);
router.get("/subscriptions/history", subscriptionController.getSubscriptionHistory);
router.get("/subscriptions/proration-preview", subscriptionController.previewProration);

router.post(
  "/subscriptions/subscribe",
  validate(subscriptionValidator.subscribe),
  subscriptionController.subscribe,
);

router.patch(
  "/subscriptions/auto-renew",
  validate(subscriptionValidator.toggleAutoRenew),
  subscriptionController.toggleAutoRenew,
);

router.post(
  "/subscriptions/cancel",
  validate(subscriptionValidator.cancel),
  subscriptionController.cancelSubscription,
);

export default router;
