import { uploadFields } from "../../../middlewares/upload.middleware.js";
import fs from "fs/promises";

const MOVIE_IMAGE_FIELDS = [
  { name: "poster", maxCount: 1 },
  { name: "banner", maxCount: 1 },
  { name: "cover", maxCount: 1 },
  { name: "logo", maxCount: 1 },
];

const JSON_FIELDS = new Set([
  "titles",
  "genre_ids",
  "actor_ids",
  "actor_cast",
  "actors",
  "cast",
  "images",
  "seo_keywords",
  "meta_keywords",
  "marketing_content",
  "tags",
]);

const hasMovieFiles = (files = {}) =>
  ["poster", "banner", "cover", "logo"].some((field) => Boolean(files?.[field]?.[0]));

const cleanupMovieUploadFiles = async (files = {}) => {
  const paths = MOVIE_IMAGE_FIELDS
    .map(({ name }) => files?.[name]?.[0]?.path)
    .filter(Boolean);

  await Promise.all(
    paths.map((filePath) =>
      fs.unlink(filePath).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      }),
    ),
  );
};

const parseJsonValue = (value, fieldName) => {
  if (value === undefined || value === null || typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "null" || trimmed === "undefined") {
    return null;
  }

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const shouldParse =
    JSON_FIELDS.has(fieldName) ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (!shouldParse) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return trimmed;
  }
};

const normalizeMultipartBody = (req) => {
  const body = req.body || {};

  if (body.data) {
    const { data, ...rest } = body;
    const parsed = parseJsonValue(data, "data");
    req.body = {
      ...(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}),
      ...rest,
    };
  }

  req.body = Object.entries(req.body || {}).reduce((acc, [key, value]) => {
    acc[key] = parseJsonValue(value, key);
    return acc;
  }, {});
};

const handleUpload = ({ requireFiles = false } = {}) => (req, res, next) => {
  const upload = uploadFields(MOVIE_IMAGE_FIELDS);

  upload(req, res, (err) => {
    if (err) {
      cleanupMovieUploadFiles(req.files).catch(() => {});
      return res.status(err.statusCode || 400).json({
        success: false,
        message: `Image upload failed: ${err.message}`,
        code: err.errorCode || err.code || "UPLOAD_ERROR",
      });
    }

    req.cleanupUploadedFiles = () => cleanupMovieUploadFiles(req.files);

    if (requireFiles && !hasMovieFiles(req.files)) {
      return res.status(400).json({
        success: false,
        message: "At least one movie image file is required",
        code: "NO_FILES_PROVIDED",
      });
    }

    try {
      normalizeMultipartBody(req);
    } catch (parseError) {
      req.cleanupUploadedFiles?.().catch(() => {});
      return res.status(400).json({
        success: false,
        message: "Invalid JSON payload",
        code: "INVALID_JSON",
      });
    }

    next();
  });
};

export const movieImageUpload = handleUpload();
export const movieImageOnlyUpload = handleUpload({ requireFiles: true });

export default {
  movieImageUpload,
  movieImageOnlyUpload,
};
