/**
 * @file rrule-engine.util.js
 * @module Utils_RRuleEngine
 * @description Utility xử lý RFC 5545 Recurrence Rules cho Broadcast Scheduling.
 */

import rrulePkg from 'rrule';
import moment from 'moment-timezone';

import { logger } from '../../../utils/logger.js';

const { RRule, rrulestr } = rrulePkg.default || rrulePkg;

/** Map từ day_of_week số (0=Sun..6=Sat) sang RRule.Weekday */
const WEEKDAY_MAP = [
  RRule.SU, // 0 = Sunday
  RRule.MO, // 1 = Monday
  RRule.TU, // 2 = Tuesday
  RRule.WE, // 3 = Wednesday
  RRule.TH, // 4 = Thursday
  RRule.FR, // 5 = Friday
  RRule.SA, // 6 = Saturday
];

/** Map tiếng Việt cho ngày trong tuần */
const DAY_NAMES_VI = {
  MO: 'Thứ 2',
  TU: 'Thứ 3',
  WE: 'Thứ 4',
  TH: 'Thứ 5',
  FR: 'Thứ 6',
  SA: 'Thứ 7',
  SU: 'Chủ nhật',
};

/**
 * Phân giải quy tắc phát sóng (Dual-mode): Ưu tiên rrule_string RFC 5545, fallback sang legacy fields.
 * @param {Object} rule - Rule object
 * @param {Date|string} [dtstart] - Mốc ngày bắt đầu
 * @param {number} [count=52] - Số lần phát sóng tối đa
 * @param {string} [timezone='Asia/Ho_Chi_Minh'] - Múi giờ
 * @returns {string} Chuỗi RRULE hợp lệ
 */
export const resolveRuleToRRule = (rule, dtstart = new Date(), count = 52, timezone = 'Asia/Ho_Chi_Minh') => {
  if (rule?.rrule_string && typeof rule.rrule_string === 'string' && validateRRule(rule.rrule_string)) {
    return rule.rrule_string;
  }
  return legacyToRRule(rule, dtstart, count, timezone);
};

/**
 * Chuyển đổi legacy rule (type/day_of_week/release_time) sang chuẩn RFC 5545 RRULE string
 * @param {Object} rule - Legacy rule object
 * @param {Date|string} [dtstart] - Ngày bắt đầu
 * @param {number} [count=52] - Số lượng phát sóng mặc định
 * @param {string} [timezone='Asia/Ho_Chi_Minh'] - Múi giờ
 * @returns {string} RRULE string
 */
export const legacyToRRule = (rule, dtstart = new Date(), count = 52, timezone = 'Asia/Ho_Chi_Minh') => {
  if (rule?.rrule_string && validateRRule(rule.rrule_string)) {
    return rule.rrule_string;
  }

  const baseMoment = dtstart ? moment(dtstart).tz(timezone) : moment().tz(timezone);

  if (rule?.release_time) {
    const [h, m, s] = String(rule.release_time).split(':').map(Number);
    baseMoment.hours(h || 0).minutes(m || 0).seconds(s || 0).milliseconds(0);
  }

  const startDate = baseMoment.toDate();

  if (rule?.type === 'specific_date' && rule?.specific_date) {
    const specMoment = moment(rule.specific_date).tz(timezone);
    if (rule.release_time) {
      const [h, m, s] = String(rule.release_time).split(':').map(Number);
      specMoment.hours(h || 0).minutes(m || 0).seconds(s || 0).milliseconds(0);
    }
    const rruleObj = new RRule({
      freq: RRule.DAILY,
      dtstart: specMoment.toDate(),
      count: 1,
    });
    return rruleObj.toString();
  }

  if (rule?.type === 'daily') {
    const rruleObj = new RRule({
      freq: RRule.DAILY,
      dtstart: startDate,
      count,
    });
    return rruleObj.toString();
  }

  // Default: weekly
  const dow = typeof rule?.day_of_week === 'number' ? rule.day_of_week : startDate.getDay();
  const byweekday = WEEKDAY_MAP[dow] || RRule.MO;

  const rruleObj = new RRule({
    freq: RRule.WEEKLY,
    byweekday: [byweekday],
    dtstart: startDate,
    count,
  });

  return rruleObj.toString();
};

/**
 * Expand RRULE string thành danh sách các mốc thời gian UTC (Date objects)
 * @param {string} rruleString - Chuỗi RFC 5545 RRULE
 * @param {Date|string} [dtstart] - Đè ngày bắt đầu nếu có
 * @param {number} [limit=100] - Số lượng tối đa phát sinh
 * @returns {Array<Date>} Mảng các mốc ngày giờ UTC
 */
export const expandRRule = (rruleString, dtstart = null, limit = 100) => {
  if (!rruleString) return [];

  try {
    let rruleObj = rrulestr(rruleString);

    if (dtstart) {
      const startDate = new Date(dtstart);
      if (!isNaN(startDate.getTime())) {
        try {
          const options = { ...rruleObj.origOptions, dtstart: startDate };
          rruleObj = new RRule(options);
        } catch (_) {
          // Bỏ qua lỗi override dtstart nếu origOptions có thuộc tính không tương thích
        }
      }
    }

    const occurrences = rruleObj.all((date, i) => i < limit);
    return occurrences;
  } catch (error) {
    logger.error(`[RRuleEngine] Failed to expand RRULE: ${rruleString}`, error);
    try {
      const fallbackObj = rrulestr(rruleString);
      return fallbackObj.all((date, i) => i < limit);
    } catch (_) {
      return [];
    }
  }
};

/**
 * Kiểm tra tính hợp lệ của chuỗi RRULE
 * @param {string} rruleString 
 * @returns {boolean}
 */
export const validateRRule = (rruleString) => {
  if (!rruleString || typeof rruleString !== 'string') return false;
  try {
    rrulestr(rruleString);
    return true;
  } catch (_) {
    return false;
  }
};

/**
 * Sinh mô tả tiếng Việt thân thiện từ chuỗi RRULE
 * @param {string} rruleString 
 * @param {string} [timezone='Asia/Ho_Chi_Minh']
 * @returns {string} Mô tả tiếng Việt
 */
export const describeRRule = (rruleString, timezone = 'Asia/Ho_Chi_Minh') => {
  if (!rruleString) return 'Chưa thiết lập quy tắc';

  try {
    const rruleObj = rrulestr(rruleString);
    const options = rruleObj.options;
    const dtstart = options.dtstart ? moment(options.dtstart).tz(timezone) : null;
    const timeStr = dtstart ? dtstart.format('HH:mm') : '';

    if (options.freq === RRule.WEEKLY) {
      const weekdayKeys = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
      const days = (options.byweekday || [])
        .map((w) => {
          const idx = typeof w === 'number' ? w : (w.weekday !== undefined ? w.weekday : w);
          const dayKey = weekdayKeys[idx] || String(w);
          return DAY_NAMES_VI[dayKey] || dayKey;
        })
        .join(', ');
      return `Hàng tuần vào ${days || 'ngày mặc định'}${timeStr ? ` lúc ${timeStr}` : ''}`;
    }

    if (options.freq === RRule.DAILY) {
      return `Mỗi ngày${timeStr ? ` lúc ${timeStr}` : ''}`;
    }

    return rruleObj.toText();
  } catch (_) {
    return 'Quy tắc phát sóng';
  }
};

export default {
  legacyToRRule,
  expandRRule,
  validateRRule,
  describeRRule,
};
