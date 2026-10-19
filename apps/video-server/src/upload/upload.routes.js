/**
 * @file upload.routes.js
 * @module VideoServer_Upload
 * @description Định tuyến cho các yêu cầu TUS Resumable Upload.
 */

import express from "express";

import { tusServer } from "./tus-server.js";

const router = express.Router();

/**
 * Xử lý mọi method HTTP (HEAD, PATCH, POST, DELETE, OPTIONS) của giao thức TUS
 */
router.all(/^\/upload\/tus(\/.*)?$/, (req, res) => {
  return tusServer.handle(req, res);
});

export default router;
