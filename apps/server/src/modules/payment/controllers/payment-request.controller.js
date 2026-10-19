/**
 * @file payment-request.controller.js
 * @module Modules_Payment_Controllers
 * @description Controller xử lý Yêu cầu Thanh toán của người dùng.
 */

import { paymentRequestService } from "../services/payment-request.service.js";
import { responseUtil } from "../../../utils/response.util.js";

/**
 * Tạo yêu cầu nạp tiền (VietQR / Gateway)
 * @route POST /api/v1/payment-requests/topup
 */
export const createTopupRequest = async (req, res, next) => {
  try {
    console.log(`[Ctrl][Payment] POST /payment-requests/topup - User: ${req.user.id}`);
    const result = await paymentRequestService.createTopupRequest(req.user.id, req.body);
    return responseUtil.success(res, result, "Tạo yêu cầu nạp tiền thành công", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách yêu cầu thanh toán cá nhân
 * @route GET /api/v1/payment-requests/me
 */
export const getMyPaymentRequests = async (req, res, next) => {
  try {
    console.log(`[Ctrl][Payment] GET /payment-requests/me - User: ${req.user.id}`);
    const result = await paymentRequestService.getUserPaymentRequests(req.user.id, req.query);
    return responseUtil.paginated(res, {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      message: "Lấy danh sách yêu cầu thanh toán thành công",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Hủy yêu cầu thanh toán
 * @route POST /api/v1/payment-requests/:id/cancel
 */
export const cancelPaymentRequest = async (req, res, next) => {
  try {
    console.log(`[Ctrl][Payment] POST /payment-requests/${req.params.id}/cancel`);
    const result = await paymentRequestService.cancelPaymentRequest(req.user.id, req.params.id);
    return responseUtil.success(res, result, "Hủy yêu cầu thanh toán thành công");
  } catch (error) {
    next(error);
  }
};
