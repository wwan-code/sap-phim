/**
 * Lộ trình Module Upload (Upload Module Routes)
 *
 * @description Định nghĩa các điểm cuối (endpoints) để xử lý tải lên tệp tin và theo dõi tiến độ.
 */

import { Router } from "express";
import { uploadController } from "../controllers/upload.controller.js";
import {
  verifyToken,
  authorizeRoles,
} from "../../../middlewares/auth.middleware.js";
import {
  uploadMiddleware,
  uploadAvatar,
  uploadCover,
  handleUploadError,
} from "../../../middlewares/upload.middleware.js";


const router = Router();

// ════════════════════════════════════════
// LỘ TRÌNH TẢI LÊN (UPLOAD ROUTES)
// ════════════════════════════════════════

/**
 * [GET] /api/v1/upload/verify-upload-token
 * @description Internal endpoint cho Nginx xác thực Token TUS upload
 */
router.get("/verify-upload-token", uploadController.verifyUploadToken);

/**
 * [POST] /api/v1/upload/image
 * @description Tải lên một hình ảnh duy nhất (xử lý đồng bộ hoặc đẩy vào hàng đợi)
 */
router.post(
  "/image",
  verifyToken,
  uploadMiddleware.single("image"),
  handleUploadError,
  uploadController.uploadImage,
);

/**
 * [POST] /api/v1/upload/batch
 * @description Tải lên nhiều hình ảnh cùng lúc
 */
router.post(
  "/batch",
  verifyToken,
  uploadMiddleware.array("images", 10),
  handleUploadError,
  uploadController.batchUpload,
);

/**
 * [POST] /api/v1/upload/avatar
 * @description Tải lên ảnh đại diện
 */
router.post(
  "/avatar",
  verifyToken,
  uploadAvatar,
  handleUploadError,
  uploadController.uploadAvatar,
);

/**
 * [POST] /api/v1/upload/cover
 * @description Tải lên ảnh bìa
 */
router.post(
  "/cover",
  verifyToken,
  uploadCover,
  handleUploadError,
  uploadController.uploadCover,
);

/**
 * [DELETE] /api/v1/upload
 * @description Xóa tệp tin đã tải lên
 */
router.delete(
  "/",
  verifyToken,
  uploadController.deleteFile,
);

// ════════════════════════════════════════
// THEO DÕI TIẾN ĐỘ (PROGRESS TRACKING)
// ════════════════════════════════════════

/**
 * [GET] /api/v1/upload/status/:jobId
 * @description Lấy trạng thái hiện tại của một công việc xử lý ảnh
 */
router.get("/status/:jobId", verifyToken, uploadController.getJobStatus);

/**
 * [DELETE] /api/v1/upload/cancel/:jobId
 * @description Hủy một công việc đang xử lý
 */
router.delete("/cancel/:jobId", verifyToken, uploadController.cancelJob);

// ════════════════════════════════════════
// QUẢN TRỊ (ADMIN ONLY)
// ════════════════════════════════════════

/**
 * [GET] /api/v1/upload/admin/stats
 * @description Lấy thống kê hệ thống hàng đợi và lưu trữ
 */
router.get(
  "/admin/stats",
  verifyToken,
  authorizeRoles("admin"),
  uploadController.getStats,
);

export default router;
