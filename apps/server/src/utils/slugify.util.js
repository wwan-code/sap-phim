/**
 * @file slugify.util.js
 * @module Utils
 * @description Chuyển đổi chuỗi tiếng Việt có dấu thành slug không dấu dạng kebab-case.
 */

/**
 * Chuyển đổi chuỗi thành slug.
 * @param {string} text - Chuỗi cần chuyển đổi
 * @returns {string} Chuỗi slug kết quả
 */
export const slugify = (text) => {
  if (!text) return '';

  let str = text.toString().toLowerCase();

  // Thay thế ký tự tiếng Việt có dấu thành không dấu
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');

  // Loại bỏ ký tự đặc biệt khác ngoại trừ chữ cái, chữ số và dấu cách, dấu gạch ngang
  str = str.replace(/[^a-z0-9\s-]/g, '');

  // Thay thế nhiều khoảng trắng hoặc dấu gạch ngang thành một dấu gạch ngang
  str = str.replace(/[\s-]+/g, '-');

  // Loại bỏ khoảng trắng và dấu gạch ngang ở đầu và cuối chuỗi
  str = str.trim().replace(/^-+|-+$/g, '');

  return str;
};

export default slugify;
