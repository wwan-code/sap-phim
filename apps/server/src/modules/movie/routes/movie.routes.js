/**
 * @file movie.routes.js
 * @module Routes_Movie
 * @description Định nghĩa route catalog công khai và quản trị anime/movie.
 */

import express from "express";

import { movieController } from "../controllers/movie.controller.js";
import { validate } from "../../../middlewares/validator.middleware.js";
import { verifyToken, optionalAuth, hasPermission } from "../../../middlewares/auth.middleware.js";
import { movieValidator } from "../validators/movie.validator.js";
import {
  movieImageUpload,
  movieImageOnlyUpload,
} from "../middlewares/movie-upload.middleware.js";

const router = express.Router();

router.get("/movies/home", optionalAuth, movieController.homeSections);
router.get("/movies", validate(movieValidator.list, "query"), movieController.listPublic);
router.get("/movies/:slug", movieController.getBySlug);

router.post(
  "/admin/movies",
  verifyToken,
  hasPermission("movies.create"),
  movieImageUpload,
  validate(movieValidator.create),
  movieController.create,
);
router.get(
  "/admin/movies/metadata",
  verifyToken,
  hasPermission("movies.view"),
  movieController.getMetadata,
);
router.post(
  "/admin/movies/bulk-restore",
  verifyToken,
  hasPermission("movies.edit"),
  validate(movieValidator.bulkIds),
  movieController.bulkRestore,
);
router.post(
  "/admin/movies/bulk-force-delete",
  verifyToken,
  hasPermission("movies.delete"),
  validate(movieValidator.bulkIds),
  movieController.bulkForceDelete,
);
router.delete(
  "/admin/movies/empty-trash",
  verifyToken,
  hasPermission("movies.delete"),
  movieController.emptyTrash,
);
router.get(
  "/admin/movies",
  verifyToken,
  hasPermission("movies.view"),
  validate(movieValidator.adminList, "query"),
  movieController.listAdmin,
);
router.get(
  "/admin/movies/:id",
  verifyToken,
  hasPermission("movies.view"),
  movieController.getAdminById,
);
router.patch(
  "/admin/movies/:id/images",
  verifyToken,
  hasPermission("movies.edit"),
  movieImageOnlyUpload,
  validate(movieValidator.imageUpdate),
  movieController.updateImages,
);
router.patch(
  "/admin/movies/:id",
  verifyToken,
  hasPermission("movies.edit"),
  movieImageUpload,
  validate(movieValidator.update),
  movieController.update,
);
router.post(
  "/admin/movies/:id/restore",
  verifyToken,
  hasPermission("movies.edit"),
  movieController.restore,
);
router.delete(
  "/admin/movies/:id/force",
  verifyToken,
  hasPermission("movies.delete"),
  movieController.forceDelete,
);
router.delete(
  "/admin/movies/:id",
  verifyToken,
  hasPermission("movies.delete"),
  movieController.delete,
);

export default router;
