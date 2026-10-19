/**
 * @file bull-board.config.js
 * @module Config_BullBoard
 * @description Cấu hình Bull Board Admin UI cho việc theo dõi các queues (Publish & Notification).
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { getPublishQueue, getNotificationQueue } from './queue.config.js';
import { authenticate, isModerator } from '../../../middlewares/auth.middleware.js';
import { logger } from '../../../utils/logger.js';

export const setupBullBoard = (app) => {
  try {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(getPublishQueue()),
        new BullMQAdapter(getNotificationQueue()),
      ],
      serverAdapter,
    });

    // Mount middleware với bảo vệ Admin / Moderator
    app.use('/admin/queues', authenticate, isModerator, serverAdapter.getRouter());
    logger.info('[BullBoard] Successfully mounted dashboard at /admin/queues');
  } catch (error) {
    logger.error('[BullBoard] Failed to mount dashboard:', error.message);
  }
};

export default setupBullBoard;
