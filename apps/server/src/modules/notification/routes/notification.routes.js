import express from "express";
import { notificationController } from "../controllers/notification.controller.js";
import { verifyToken, hasPermission } from "../../../middlewares/auth.middleware.js";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../../middlewares/validator.middleware.js";
import { notificationValidator } from "../validators/notification.validator.js";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/",
  validateQuery(notificationValidator.getAll),
  notificationController.getAll,
);

router.get("/unread-count", notificationController.getUnreadCount);
router.get("/stats", notificationController.getStats);

router.patch("/read-all", notificationController.markAllAsRead);

router.patch(
  "/:id/read",
  validateParams(notificationValidator.paramId),
  notificationController.markAsRead,
);

router.patch(
  "/:id/unread",
  validateParams(notificationValidator.paramId),
  notificationController.markAsUnread,
);

router.delete(
  "/:id",
  validateParams(notificationValidator.paramId),
  notificationController.delete,
);

router.delete(
  "/",
  validate(notificationValidator.deleteAll),
  notificationController.deleteAll,
);

router.post(
  "/",
  hasPermission("notifications.manage"),
  validate(notificationValidator.create),
  notificationController.create,
);

export default router;
