/**
 * @file subtitle.util.js
 * @module VideoServer_Utils
 * @description Tiện ích chuẩn hóa, chuyển đổi và làm sạch tệp phụ đề (SRT sang WebVTT, xử lý UTF-8 BOM).
 */

/**
 * Làm sạch và chuẩn hóa nội dung phụ đề sang định dạng WebVTT hợp lệ.
 * - Loại bỏ UTF-8 Byte Order Mark (\uFEFF) nếu có
 * - Chuẩn hóa các dấu kết thúc dòng (CRLF/CR sang LF)
 * - Chuyển đổi timestamp dấu phẩy (00:00:00,000) kiểu SRT sang dấu chấm (00:00:00.000) kiểu WebVTT
 * - Đảm bảo header "WEBVTT" chuẩn ở đầu tệp
 *
 * @param {Buffer|string} input - Dữ liệu tệp phụ đề đầu vào (SRT hoặc VTT)
 * @returns {string} Chuỗi nội dung WebVTT chuẩn hóa
 */
export const cleanAndNormalizeVtt = (input) => {
  if (!input) return "WEBVTT\n\n";

  let content = Buffer.isBuffer(input) ? input.toString("utf-8") : String(input);

  // 1. Loại bỏ UTF-8 BOM ở đầu chuỗi nếu có
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  content = content.replace(/^\uFEFF/, "");

  // 2. Chuẩn hóa ký tự kết thúc dòng sang LF (\n)
  content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // 3. Kiểm tra xem đã có header WEBVTT chưa
  const hasVttHeader = content.startsWith("WEBVTT");

  if (!hasVttHeader) {
    // Chuyển đổi định dạng timestamp từ SRT (00:00:20,000) sang WebVTT (00:00:20.000)
    // Hỗ trợ cả định dạng mm:ss,xxx và hh:mm:ss,xxx
    content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
    content = content.replace(/(\d{2}:\d{2}),(\d{3})/g, "00:$1.$2");

    // Thêm header WEBVTT
    content = `WEBVTT\n\n${content}`;
  } else {
    // Nếu đã có WEBVTT nhưng vẫn còn timestamp kiểu SRT sót lại
    content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  }

  // 4. Chuẩn hóa khoảng cách giữa các cue block
  content = content.replace(/\n{3,}/g, "\n\n");

  return `${content}\n`;
};

export default {
  cleanAndNormalizeVtt,
};
