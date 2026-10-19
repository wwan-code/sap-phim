/**
 * @file broadcast.routes.js
 * @module Routes_Broadcast
 * @description Routing cho Broadcast Schedule API kèm tầng xác thực Joi Validation
 */

import { Router } from 'express';
import {
  getSchedule,
  upsertSchedule,
  deleteSchedule,
  getCalendarByDateRange,
  getWeeklySchedule,
  getPublicCalendar,
  overrideCalendar,
  restoreCalendar,
  batchOverrideCalendars,
  updateCalendarStatus,
  regenerateCalendar,
} from '../controllers/broadcast.controller.js';
import { broadcastValidator } from '../validators/broadcast.validator.js';
import { validate } from '../../../middlewares/validator.middleware.js';
import { authenticate, isModerator } from '../../../middlewares/auth.middleware.js';

const router = Router();

// ════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════
router.get(
  '/public/weekly',
  validate(broadcastValidator.weeklyScheduleQuery, 'query'),
  getWeeklySchedule
);

router.get(
  '/public/calendar',
  validate(broadcastValidator.calendarDateRangeQuery, 'query'),
  getPublicCalendar
);

// ════════════════════════════════════════
// ADMIN / MODERATOR ROUTES
// ════════════════════════════════════════
router.use(authenticate);
router.use(isModerator);

// Calendar specific routes first (tránh xung đột với :movieId)
router.patch(
  '/calendar/batch',
  validate(broadcastValidator.batchOverride),
  batchOverrideCalendars
);

router.patch(
  '/calendar/:calendarId/override',
  validate(broadcastValidator.overrideCalendar),
  overrideCalendar
);

router.patch(
  '/calendar/:calendarId/status',
  validate(broadcastValidator.updateCalendarStatus),
  updateCalendarStatus
);

router.post(
  '/calendar/:calendarId/restore',
  restoreCalendar
);

// Movie specific routes
router.post(
  '/:movieId/regenerate',
  regenerateCalendar
);

router.get(
  '/:movieId/calendar',
  validate(broadcastValidator.calendarDateRangeQuery, 'query'),
  getCalendarByDateRange
);

router.get(
  '/:movieId',
  getSchedule
);

router.post(
  '/:movieId',
  validate(broadcastValidator.upsertSchedule),
  upsertSchedule
);

router.delete(
  '/:movieId',
  deleteSchedule
);

export default router;
