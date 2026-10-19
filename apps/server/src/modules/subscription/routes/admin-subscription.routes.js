/**
 * @file admin-subscription.routes.js
 * @module Modules_Subscription_Routes
 * @description Định tuyến API Quản trị Subscriptions & MembershipPlans cho Admin Dashboard.
 */

import express from "express";
import { adminSubscriptionController } from "../controllers/admin-subscription.controller.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";
import { validate, validateQuery } from "../../../middlewares/validator.middleware.js";
import { subscriptionValidator } from "../validators/subscription.validator.js";

const router = express.Router();

// Bắt buộc xác thực Token + Quyền truy cập trang quản trị (First Gate)
router.use("/admin", verifyToken, hasPermission("admin.access"));

// ── SUBSCRIPTIONS MANAGEMENT ──────────────────────────────────────────
router.get(
  "/admin/subscriptions",
  hasPermission("subscriptions.view"),
  validateQuery(subscriptionValidator.adminQuery),
  adminSubscriptionController.getSubscriptionsAdmin,
);

router.get(
  "/admin/subscriptions/stats",
  hasPermission("subscriptions.view"),
  adminSubscriptionController.getStatsAdmin,
);

router.post(
  "/admin/subscriptions/grant",
  hasPermission("subscriptions.manage"),
  validate(subscriptionValidator.adminGrant),
  adminSubscriptionController.grantVipAdmin,
);

router.post(
  "/admin/subscriptions/:id/revoke",
  hasPermission("subscriptions.cancel"),
  adminSubscriptionController.revokeSubscriptionAdmin,
);

// ── MEMBERSHIP PLANS CRUD ────────────────────────────────────────────
router.get(
  "/admin/membership-plans",
  hasPermission("membership_plan.read"),
  adminSubscriptionController.getAllPlansAdmin,
);

router.post(
  "/admin/membership-plans",
  hasPermission("membership_plan.create"),
  validate(subscriptionValidator.createPlan),
  adminSubscriptionController.createPlanAdmin,
);

router.put(
  "/admin/membership-plans/:id",
  hasPermission("membership_plan.edit"),
  validate(subscriptionValidator.updatePlan),
  adminSubscriptionController.updatePlanAdmin,
);

router.delete(
  "/admin/membership-plans/:id",
  hasPermission("membership_plan.delete"),
  adminSubscriptionController.deletePlanAdmin,
);

export default router;
