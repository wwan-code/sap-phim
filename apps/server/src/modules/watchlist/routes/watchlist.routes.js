/**
 * @file watchlist.routes.js
 * @module Routes_Watchlist
 * @description Định nghĩa route watchlist cá nhân.
 */

import express from "express";

import { watchlistController } from "../controllers/watchlist.controller.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { verifyToken } from "../../../middlewares/auth.middleware.js";
import { watchlistValidator } from "../validators/watchlist.validator.js";

const router = express.Router();

router.get("/watchlist", verifyToken, watchlistController.listMine);
router.post("/watchlist", verifyToken, validate(watchlistValidator.upsert), watchlistController.upsert);
router.delete("/watchlist/:movieId", verifyToken, watchlistController.remove);

export default router;
