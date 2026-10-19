/**
 * @file job.handler.js
 * @module Sockets_Job_Handlers
 * @description Guard xác thực job; AI luôn đọc chủ sở hữu và quyền từ canonical DB trước khi tham gia phòng.
 */

import { logger } from '../../utils/logger.js';
import { withAuth } from '../middlewares/socket-guard.middleware.js';
import { globalRateLimiter, withRateLimit } from '../middlewares/socket-rate-limit.middleware.js';
import {
  SOCKET_EVENTS,
  SOCKET_ERROR_CODES,
} from '../constants/socket-events.constants.js';
import { SOCKET_ROOMS } from '../constants/socket-rooms.constants.js';
import { ROLES } from '../../constants/roles.constant.js';
import { createJobSnapshotReader, normalizeJobStatusSnapshot } from '../utils/job-access.util.js';
import {
  validateJobSubscribe,
  validateJobUnsubscribe,
  validateJobStatus,
  validateJobSync,
} from '../validators/socket-payload.validator.js';

let progressServiceCache = null;

const AUTHENTICATED_JOB_ROLES = Object.values(ROLES);

const getProgressService = async () => {
  if (!progressServiceCache) {
    const { progressService } = await import('../../modules/jobs/services/progress.service.js');
    progressServiceCache = progressService;
  }
  return progressServiceCache;
};

const getJobSnapshot = createJobSnapshotReader({
  readAiJob: async (jobId, actor) => {
    const { aiJobService } = await import('../../modules/ai/services/ai-job.service.js');
    return aiJobService.get(jobId, actor);
  },
  readProgressJob: async (jobId) => (await getProgressService()).getJobStatus(jobId),
});

const callbackError = (callback, error) => {
  if (typeof callback !== 'function') return;
  callback({
    success: false,
    ok: false,
    error: error.code || SOCKET_ERROR_CODES.INTERNAL_ERROR,
    message: error.message || 'Realtime job command failed',
  });
};

const joinJobRoom = async (socket, jobId) => {
  await socket.join(SOCKET_ROOMS.job(jobId));
  const progressService = await getProgressService();
  progressService.trackSubscription(socket.id, jobId);
};

const leaveJobRoom = async (socket, jobId) => {
  await socket.leave(SOCKET_ROOMS.job(jobId));
  const progressService = await getProgressService();
  progressService.untrackSubscription(socket.id, jobId);
};

const subscribeToJob = async (socket, data, callback, sourceEvent = SOCKET_EVENTS.JOB_SUBSCRIBE) => {
  const { jobId, jobType: requestedJobType = 'movie' } = data;
  const snapshot = await getJobSnapshot(socket, jobId, requestedJobType);
  const jobType = snapshot?.jobType || requestedJobType;

  await joinJobRoom(socket, jobId);

  const ack = {
    success: true,
    ok: true,
    jobId,
    jobType,
    subscribed: true,
    snapshot,
  };

  if (typeof callback === 'function') callback(ack);

  socket.emit(SOCKET_EVENTS.JOB_SUBSCRIBED, {
    ...(snapshot || {}),
    jobId,
    jobType,
    subscribed: true,
    sourceEvent,
    emittedAt: new Date().toISOString(),
  });

  if (snapshot) {
    socket.emit(SOCKET_EVENTS.JOB_PROGRESS, snapshot);
  }

  logger.debug(
    `[SocketJob] subscribed socketId=${socket.id} userId=${socket.user?.id} jobId=${jobId} jobType=${jobType} traceId=${socket.traceId}`,
  );
};

const unsubscribeFromJob = async (socket, data, callback) => {
  const { jobId, jobType = 'movie' } = data;
  await leaveJobRoom(socket, jobId);

  const payload = {
    success: true,
    ok: true,
    jobId,
    jobType,
    unsubscribed: true,
    emittedAt: new Date().toISOString(),
  };

  if (typeof callback === 'function') callback(payload);
  socket.emit(SOCKET_EVENTS.JOB_UNSUBSCRIBED, payload);
};

const getStatus = async (socket, data, callback) => {
  const { jobId, jobType: requestedJobType = 'movie' } = data;
  const snapshot = await getJobSnapshot(socket, jobId, requestedJobType);
  const jobType = snapshot?.jobType || requestedJobType;

  if (typeof callback === 'function') {
    callback({
      success: true,
      ok: true,
      jobId,
      jobType,
      status: snapshot || normalizeJobStatusSnapshot(jobId, jobType, null),
    });
  }
};

const syncJobs = async (socket, data, callback) => {
  const snapshots = [];
  const terminalJobs = [];
  const failed = [];

  for (const job of data.jobs) {
    try {
      const snapshot = await getJobSnapshot(socket, job.jobId, job.jobType);
      await joinJobRoom(socket, job.jobId);

      const normalized = snapshot || normalizeJobStatusSnapshot(job.jobId, job.jobType, null);
      snapshots.push(normalized);

      if (normalized.terminal) {
        terminalJobs.push(normalized);
      }
    } catch (error) {
      failed.push({
        jobId: job.jobId,
        jobType: job.jobType,
        error: error.code || SOCKET_ERROR_CODES.INTERNAL_ERROR,
        message: error.message,
      });
    }
  }

  const payload = {
    success: true,
    ok: true,
    jobs: snapshots,
    terminalJobs,
    completedJobIds: terminalJobs.map((job) => job.jobId),
    failed,
    emittedAt: new Date().toISOString(),
  };

  if (typeof callback === 'function') callback(payload);
  socket.emit(SOCKET_EVENTS.JOB_SYNCED, payload);

  logger.debug(
    `[SocketJob] synced socketId=${socket.id} userId=${socket.user?.id} jobs=${snapshots.length} failed=${failed.length}`,
  );
};

const withJobGuards = (socket, eventName, validator, handler) => (
  withRateLimit(
    socket,
    globalRateLimiter,
    withAuth(
      socket,
      AUTHENTICATED_JOB_ROLES,
      async (validatedData, callback) => {
        try {
          await handler(validatedData, callback);
        } catch (error) {
          logger.warn(
            `[SocketJob] command failed event=${eventName} socketId=${socket.id} userId=${socket.user?.id || 'guest'} traceId=${socket.traceId}: ${error.message}`,
          );
          callbackError(callback, error);
        }
      },
      eventName,
      validator,
    ),
    eventName,
  )
);

const withForcedJobType = (jobType, validator) => (data) => validator({ ...data, jobType });

export const registerJobHandlers = (io, socket) => {
  socket.on(
    SOCKET_EVENTS.JOB_SUBSCRIBE,
    withJobGuards(socket, SOCKET_EVENTS.JOB_SUBSCRIBE, validateJobSubscribe, (data, callback) =>
      subscribeToJob(socket, data, callback, SOCKET_EVENTS.JOB_SUBSCRIBE),
    ),
  );

  socket.on(
    PROGRESS_LEGACY_EVENTS.SUBSCRIBE,
    withJobGuards(socket, PROGRESS_LEGACY_EVENTS.SUBSCRIBE, validateJobSubscribe, (data, callback) =>
      subscribeToJob(socket, data, callback, PROGRESS_LEGACY_EVENTS.SUBSCRIBE),
    ),
  );


  socket.on(
    SOCKET_EVENTS.JOB_UNSUBSCRIBE,
    withJobGuards(socket, SOCKET_EVENTS.JOB_UNSUBSCRIBE, validateJobUnsubscribe, (data, callback) =>
      unsubscribeFromJob(socket, data, callback),
    ),
  );

  socket.on(
    PROGRESS_LEGACY_EVENTS.UNSUBSCRIBE,
    withJobGuards(socket, PROGRESS_LEGACY_EVENTS.UNSUBSCRIBE, validateJobUnsubscribe, (data, callback) =>
      unsubscribeFromJob(socket, data, callback),
    ),
  );


  socket.on(
    SOCKET_EVENTS.JOB_STATUS,
    withJobGuards(socket, SOCKET_EVENTS.JOB_STATUS, validateJobStatus, (data, callback) =>
      getStatus(socket, data, callback),
    ),
  );

  socket.on(
    SOCKET_EVENTS.JOB_SYNC,
    withJobGuards(socket, SOCKET_EVENTS.JOB_SYNC, validateJobSync, (data, callback) =>
      syncJobs(socket, data, callback),
    ),
  );
};

const PROGRESS_LEGACY_EVENTS = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
};
