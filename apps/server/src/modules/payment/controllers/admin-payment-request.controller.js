/**
 * @file admin-payment-request.controller.js
 * @module Modules_Payment_Controllers
 * @description Controller quản trị xử lý Yêu cầu Thanh toán (Phê duyệt / Từ chối).
 */

import { adminPaymentRequestService } from "../services/admin-payment-request.service.js";
import { responseUtil } from "../../../utils/response.util.js";

/**
 * Lấy danh sách yêu cầu thanh toán (Admin)
 * @route GET /api/v1/admin/payment-requests
 */
export const getPaymentRequestsAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminPayment] GET /admin/payment-requests`);
    const result = await adminPaymentRequestService.getPaymentRequestsAdmin(req.query);
    return responseUtil.paginated(res, {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      message: "Lấy danh sách yêu cầu thanh toán thành công",
      meta: { counts: result.counts },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Phê duyệt hoặc Từ chối yêu cầu thanh toán (Admin)
 * @route POST /api/v1/admin/payment-requests/:id/process
 */
export const processPaymentRequestAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminPayment] POST /admin/payment-requests/${req.params.id}/process`);
    const result = await adminPaymentRequestService.processPaymentRequestAdmin(
      req.user.id,
      req.params.id,
      req.body
    );
    return responseUtil.success(res, result, `Đã ${req.body.status === "approved" ? "phê duyệt" : "từ chối"} yêu cầu thanh toán`);
  } catch (error) {
    next(error);
  }
};

/**
 * Thống kê tài chính các yêu cầu thanh toán cho Admin Dashboard
 * @route GET /api/v1/admin/payment-requests/stats
 */
export const getPaymentRequestStatsAdmin = async (req, res, next) => {
  try {
    console.log(`[Ctrl][AdminPayment] GET /admin/payment-requests/stats`);
    const stats = await adminPaymentRequestService.getPaymentRequestStatsAdmin();
    return responseUtil.success(res, stats, "Lấy thống kê yêu cầu thanh toán thành công");
  } catch (error) {
    next(error);
  }
};

