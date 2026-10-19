/**
 * @file payment-request.routes.js
 * @module Modules_Payment_Routes
 * @description Định tuyến API Yêu cầu Thanh toán cho người dùng.
 */

import express from "express";
import {
  createTopupRequest,
  getMyPaymentRequests,
  cancelPaymentRequest,
} from "../controllers/payment-request.controller.js";
import { verifyToken } from "../../../middlewares/auth.middleware.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { createTopupRequestSchema } from "../validators/payment-request.validator.js";

const router = express.Router();

router.use("/payment-requests", verifyToken);

router.post("/payment-requests/topup", validate(createTopupRequestSchema), createTopupRequest);
router.get("/payment-requests/me", getMyPaymentRequests);
router.post("/payment-requests/:id/cancel", cancelPaymentRequest);

export default router;
