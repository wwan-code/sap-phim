/**
 * @file index.js
 * @module Routes_Aggregator
 * @description Tổng hợp tất cả các modules routes chính của backend và xuất ra một router thống nhất.
 */

import express from "express";

import authRoutes from "../modules/auth/routes/auth.routes.js";
import uploadRoutes from "../modules/upload/routes/upload.routes.js";
import genreRoutes from "../modules/genre/routes/genre.routes.js";
import countryRoutes from "../modules/country/routes/country.routes.js";
import categoryRoutes from "../modules/category/routes/category.routes.js";
import actorRoutes from "../modules/actor/routes/actor.routes.js";
import studioRoutes from "../modules/studio/routes/studio.routes.js";
import seriesRoutes from "../modules/series/routes/series.routes.js";
import movieRoutes from "../modules/movie/routes/movie.routes.js";
import episodeRoutes from "../modules/episode/routes/episode.routes.js";
import watchHistoryRoutes from "../modules/watch-history/routes/watch-history.routes.js";
import watchlistRoutes from "../modules/watchlist/routes/watchlist.routes.js";
import engagementRoutes from "../modules/engagement/routes/engagement.routes.js";
import userRoutes from "../modules/user/routes/user.routes.js";
import adminUserRoutes from "../modules/user/routes/admin-user.routes.js";
import notificationRoutes from "../modules/notification/routes/notification.routes.js";
import adminNotificationRoutes from "../modules/notification/routes/admin-notification.routes.js";
import broadcastRoutes from "../modules/broadcast/routes/broadcast.routes.js";
import walletRoutes from "../modules/wallet/routes/wallet.routes.js";
import adminWalletRoutes from "../modules/wallet/routes/admin-wallet.routes.js";
import paymentRequestRoutes from "../modules/payment/routes/payment-request.routes.js";
import adminPaymentRequestRoutes from "../modules/payment/routes/admin-payment-request.routes.js";
import subscriptionRoutes from "../modules/subscription/routes/subscription.routes.js";
import adminSubscriptionRoutes from "../modules/subscription/routes/admin-subscription.routes.js";
import aiRoutes from "../modules/ai/routes/ai.routes.js";
import adminSecurityRoutes from "../modules/security/routes/admin-security.routes.js";

const router = express.Router();

// ════════════════════════════════════════
// ĐĂNG KÝ CÁC MODULE ROUTES
// ════════════════════════════════════════

// Modules cốt lõi (Core)
router.use("/auth", authRoutes);
router.use("/upload", uploadRoutes);
router.use("/ai", aiRoutes);

// Modules Ví & Thanh toán (Financial & Subscription Billing Domain)
router.use("/", walletRoutes);
router.use("/", adminWalletRoutes);
router.use("/", paymentRequestRoutes);
router.use("/", adminPaymentRequestRoutes);
router.use("/", subscriptionRoutes);
router.use("/", adminSubscriptionRoutes);

// Modules quản lý nội dung (Content Management)
router.use("/", genreRoutes);
router.use("/", countryRoutes);
router.use("/", categoryRoutes);
router.use("/", actorRoutes);
router.use("/", studioRoutes);
router.use("/", seriesRoutes);
router.use("/", episodeRoutes);
router.use("/", engagementRoutes);
router.use("/", movieRoutes);
router.use("/broadcast-schedules", broadcastRoutes);
router.use("/", watchHistoryRoutes);
router.use("/", watchlistRoutes);
router.use("/", userRoutes);
router.use("/", adminUserRoutes);
router.use("/", adminNotificationRoutes);
router.use("/", adminSecurityRoutes);
router.use("/notifications", notificationRoutes);

export default router;
