/**
 * @file date-time.util.js
 * @module Components/UI/DateTimePicker/Utils
 * @description Hàm tiện ích xử lý Date native JS (Zero dependencies) cho DateTimePicker module.
 */

/**
 * Đặt thời gian của một ngày về 00:00:00:000
 * @param {Date|string|number} date
 * @returns {Date|null}
 */
export const startOfDay = (date) => {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Kiểm tra xem hai ngày có cùng ngày/tháng/năm hay không
 * @param {Date} d1
 * @param {Date} d2
 * @returns {boolean}
 */
export const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

/**
 * Kiểm tra xem hai ngày có cùng tháng/năm hay không
 * @param {Date} d1
 * @param {Date} d2
 * @returns {boolean}
 */
export const isSameMonth = (d1, d2) => {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
  );
};

/**
 * Kiểm tra một ngày có phải là hôm nay không
 * @param {Date} date
 * @returns {boolean}
 */
export const isToday = (date) => {
  return isSameDay(date, new Date());
};

/**
 * Kiểm tra d1 có đứng trước d2 không (chỉ tính ngày)
 * @param {Date} d1
 * @param {Date} d2
 * @returns {boolean}
 */
export const isBefore = (d1, d2) => {
  if (!d1 || !d2) return false;
  return startOfDay(d1).getTime() < startOfDay(d2).getTime();
};

/**
 * Kiểm tra d1 có đứng sau d2 không (chỉ tính ngày)
 * @param {Date} d1
 * @param {Date} d2
 * @returns {boolean}
 */
export const isAfter = (d1, d2) => {
  if (!d1 || !d2) return false;
  return startOfDay(d1).getTime() > startOfDay(d2).getTime();
};

/**
 * Thêm một số lượng tháng vào ngày
 * @param {Date} date
 * @param {number} amount
 * @returns {Date|null}
 */
export const addMonths = (date, amount) => {
  if (!date) return null;
  const d = new Date(date);
  d.setMonth(d.getMonth() + amount);
  return d;
};

/**
 * Thêm một số lượng năm vào ngày
 * @param {Date} date
 * @param {number} amount
 * @returns {Date|null}
 */
export const addYears = (date, amount) => {
  if (!date) return null;
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + amount);
  return d;
};

/**
 * Lấy số ngày trong tháng
 * @param {number} year
 * @param {number} month 0-indexed
 * @returns {number}
 */
export const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * Lấy chỉ số ngày đầu tiên của tháng (Thứ 2 = 0)
 * @param {number} year
 * @param {number} month 0-indexed
 * @returns {number}
 */
export const getFirstDayOfMonth = (year, month) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

/**
 * Tạo lưới lịch 6x7 cho một tháng cụ thể
 * @param {number} year
 * @param {number} month 0-indexed
 * @returns {Date[][]}
 */
export const getCalendarGrid = (year, month) => {
  const grid = [];
  let currentWeek = [];

  const daysInMonth = getDaysInMonth(year, month);
  let firstDayIndex = new Date(year, month, 1).getDay();
  // Điều chỉnh Thứ 2 = 0
  firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Các ngày của tháng trước
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    currentWeek.push(new Date(year, month - 1, prevMonthDays - i));
  }

  // Các ngày trong tháng hiện tại
  for (let i = 1; i <= daysInMonth; i++) {
    currentWeek.push(new Date(year, month, i));
    if (currentWeek.length === 7) {
      grid.push(currentWeek);
      currentWeek = [];
    }
  }

  // Các ngày của tháng sau để lấp đầy 6 hàng
  let nextMonthDay = 1;
  while (grid.length < 6 || currentWeek.length > 0) {
    if (currentWeek.length === 7) {
      grid.push(currentWeek);
      currentWeek = [];
      if (grid.length === 6) break;
    }
    currentWeek.push(new Date(year, month + 1, nextMonthDay++));
  }

  return grid;
};

/**
 * Phân tích chuỗi ngày tháng dựa trên định dạng
 * @param {string} str
 * @param {string} format
 * @returns {Date|null}
 */
export const parseDate = (str, format = "DD/MM/YYYY") => {
  if (!str) return null;

  const hasTime = str.includes(" ");
  let datePart = str;
  let timePart = "";
  let ampmPart = "";

  if (hasTime) {
    const spaceSplits = str.split(" ");
    datePart = spaceSplits[0];
    timePart = spaceSplits[1];
    if (spaceSplits.length === 3) {
      ampmPart = spaceSplits[2].toLowerCase();
    }
  }

  let dayStr;
  let monthStr;
  let yearStr;

  const dateBaseFormat = format.split(" ")[0];
  if (dateBaseFormat === "DD/MM/YYYY") {
    const parts = datePart.split("/");
    if (parts.length !== 3) return null;
    dayStr = parts[0];
    monthStr = parts[1];
    yearStr = parts[2];
  } else if (dateBaseFormat === "MM/DD/YYYY") {
    const parts = datePart.split("/");
    if (parts.length !== 3) return null;
    monthStr = parts[0];
    dayStr = parts[1];
    yearStr = parts[2];
  } else if (dateBaseFormat === "YYYY-MM-DD") {
    const parts = datePart.split("-");
    if (parts.length !== 3) return null;
    yearStr = parts[0];
    monthStr = parts[1];
    dayStr = parts[2];
  } else {
    return null;
  }

  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const year = parseInt(yearStr, 10);

  let hours = 0;
  let minutes = 0;

  if (timePart) {
    const tParts = timePart.split(":");
    if (tParts.length >= 2) {
      hours = parseInt(tParts[0], 10);
      minutes = parseInt(tParts[1], 10);

      if (ampmPart === "pm" && hours < 12) {
        hours += 12;
      } else if (ampmPart === "am" && hours === 12) {
        hours = 0;
      }
    }
  }

  const date = new Date(year, month, day, hours, minutes);
  if (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes
  ) {
    return date;
  }
  return null;
};

const padTo2 = (num) => num.toString().padStart(2, "0");

/**
 * Định dạng đối tượng Date thành chuỗi dựa trên format
 * @param {Date} date
 * @param {string} format
 * @returns {string}
 */
export const formatDate = (date, format = "DD/MM/YYYY") => {
  if (!date || isNaN(date.getTime())) return "";

  const d = padTo2(date.getDate());
  const m = padTo2(date.getMonth() + 1);
  const y = date.getFullYear();

  const h24 = date.getHours();
  const mins = padTo2(date.getMinutes());

  let h12 = h24 % 12;
  h12 = h12 ? h12 : 12;
  const ampm = h24 >= 12 ? "PM" : "AM";

  const paddedH24 = padTo2(h24);
  const paddedH12 = padTo2(h12);

  let result = format
    .replace("DD", d)
    .replace("MM", m)
    .replace("YYYY", y)
    .replace("HH", paddedH24)
    .replace("hh", paddedH12)
    .replace("mm", mins);

  if (format.includes(" a")) {
    result = result.replace(" a", ` ${ampm.toLowerCase()}`);
  } else if (format.includes(" A")) {
    result = result.replace(" A", ` ${ampm}`);
  }

  return result;
};

/**
 * Hợp nhất phần ngày từ một Date và phần giờ từ một Date khác
 * @param {Date} dateComponent
 * @param {Date} timeComponent
 * @returns {Date|null}
 */
export const mergeDateAndTime = (dateComponent, timeComponent) => {
  if (!dateComponent) return null;
  const newDate = new Date(dateComponent);
  if (timeComponent) {
    newDate.setHours(
      timeComponent.getHours(),
      timeComponent.getMinutes(),
      0,
      0
    );
  }
  return newDate;
};

/**
 * So sánh phần thời gian của hai ngày
 * @param {Date} d1
 * @param {Date} d2
 * @returns {number}
 */
export const compareTimeOnly = (d1, d2) => {
  if (!d1 || !d2) return 0;
  const t1 = d1.getHours() * 60 + d1.getMinutes();
  const t2 = d2.getHours() * 60 + d2.getMinutes();
  return t1 - t2;
};

/** Lấy thời điểm bắt đầu của tháng */
export const getStartOfMonth = (year, month) => {
  return new Date(year, month, 1, 0, 0, 0, 0);
};

/** Lấy thời điểm kết thúc của tháng */
export const getEndOfMonth = (year, month) => {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
};

/** Lấy thời điểm bắt đầu của năm */
export const getStartOfYear = (year) => {
  return new Date(year, 0, 1, 0, 0, 0, 0);
};

/** Lấy thời điểm kết thúc của năm */
export const getEndOfYear = (year) => {
  return new Date(year, 11, 31, 23, 59, 59, 999);
};
