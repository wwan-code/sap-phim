/**
 * @file logger.js
 * @module VideoServer_Utils
 * @description Tiện ích ghi log định dạng chuẩn hệ thống cho Video Server.
 */

const formatTimestamp = () => new Date().toISOString();

export const logger = {
  info(message, meta) {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`[${formatTimestamp()}][INFO]${message}${metaStr}`);
  },
  warn(message, meta) {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.warn(`[${formatTimestamp()}][WARN]${message}${metaStr}`);
  },
  error(message, meta) {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.error(`[${formatTimestamp()}][ERROR]${message}${metaStr}`);
  },
  debug(message, meta) {
    if (process.env.NODE_ENV === "development") {
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
      console.debug(`[${formatTimestamp()}][DEBUG]${message}${metaStr}`);
    }
  },
};

export default logger;
