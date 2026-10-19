/**
 * @file asset.util.js
 * @module Utils/AssetUtil
 * @description Hàm tiện ích định dạng URL media, hình ảnh và đường dẫn video streaming.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL !== undefined ? import.meta.env.VITE_BACKEND_URL : "http://localhost:5000";

/**
 * Get full asset URL from relative path
 * @param {string} path - Relative path like /uploads/brands/xxx.webp
 * @returns {string} Full URL like http://localhost:5000/uploads/brands/xxx.webp
 */
export const getAssetUrl = (path) => {
  if (!path) return null;
  if (typeof path !== "string") return null;
  // If already a full URL or blob/data URI, return as-is
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  // Client public assets and proxied uploads are served same-origin.
  if (path.startsWith("/images") || path.startsWith("images/")) {
    return path.startsWith("/") ? path : `/${path}`;
  }
  if (path.startsWith("/uploads")) {
    return path;
  }
  // If the asset is a stream resource (like a thumbnail or sprite), use video server URL
  if (path.startsWith("/stream/") || path.startsWith("stream/")) {
    const videoServerUrl =
      import.meta.env.VITE_VIDEO_SERVER_URL || "http://localhost:3002";
    return `${videoServerUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  }
  // Prepend backend URL for other paths
  return `${BACKEND_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

/**
 * Format stream URL to use video server endpoint
 * Handles URLs starting with /stream/ by prepending the video server URL
 * @param {string} url - The URL to format
 * @returns {string} - Formatted URL
 */
export const getStreamUrl = (url) => {
  if (!url) return "";
  if (typeof url !== "string") return url;

  if (url.startsWith("/stream")) {
    const baseUrl =
      import.meta.env.VITE_VIDEO_SERVER_URL || "http://localhost:3002";
    return `${baseUrl}${url}`; // Token logic will be added here if needed
  }

  return url;
};

/**
 * Resolve an image field from the images JSONB
 * Handles both object format { original, webp, thumbnail } and plain string
 */
export const resolveImage = (imageField, fallback = null) => {
  if (!imageField) return fallback;
  if (typeof imageField === "string")
    return getAssetUrl(imageField) || fallback;
  if (Array.isArray(imageField)) {
    const src = imageField.map((item) => resolveImage(item, null)).find(Boolean);
    return src || fallback;
  }
  if (typeof imageField !== "object") return fallback;

  const src =
    imageField.url ??
    imageField.path ??
    imageField.single?.url ??
    imageField.single?.path ??
    imageField.original?.url ??
    imageField.original?.path ??
    imageField.webp ??
    imageField.primary;
  if (src && typeof src === "object") return resolveImage(src, fallback);
  return src ? getAssetUrl(src) || fallback : fallback;
};

// ──────────────────────────────────────────
// FALLBACK ASSETS
// ──────────────────────────────────────────
export const FALLBACK_POSTER = "/images/placeholder-poster.png";
export const FALLBACK_BANNER = "/images/placeholder-banner.png";
export const FALLBACK_COVER = "/images/placeholder-cover.png";

export default {
  getAssetUrl,
  getStreamUrl,
  resolveImage,
  FALLBACK_POSTER,
  FALLBACK_BANNER,
  FALLBACK_COVER,
};
