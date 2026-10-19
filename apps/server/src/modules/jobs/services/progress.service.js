/**
 * @file progress.service.js
 * @module Jobs_Progress_Service
 * @description Chuẩn hóa tiến trình realtime và snapshot; canonical AI job sở hữu quyền truy cập và trạng thái.
 *
 * This service only owns progress normalization, cache snapshots and
 * subscription bookkeeping. Socket command listeners live in the socket
 * gateway so every subscribe/status/sync path is guarded consistently.
 */

import { logger } from '../../../utils/logger.js';
import { cacheHelper } from '../../../config/redis.config.js';

export const PROGRESS_EVENTS = {
  UPLOAD_START: 'upload:start',
  UPLOAD_PROGRESS: 'upload:progress',
  UPLOAD_COMPLETE: 'upload:complete',
  UPLOAD_ERROR: 'upload:error',

  JOB_PROGRESS: 'job:progress',

  QUEUE_POSITION: 'queue:position',
  QUEUE_WAITING: 'queue:waiting',

  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
};

export const PROGRESS_STAGES = {
  ANALYZING: { name: 'ANALYZING', percent: 10, description: 'Analyzing image...' },
  PREPROCESSING: { name: 'PREPROCESSING', percent: 20, description: 'Preparing media...' },
  CROPPING: { name: 'CROPPING', percent: 35, description: 'Cropping image...' },
  UPSCALING: { name: 'UPSCALING', percent: 60, description: 'Upscaling image...' },
  ENHANCING: { name: 'ENHANCING', percent: 80, description: 'Enhancing quality...' },
  OPTIMIZING: { name: 'OPTIMIZING', percent: 95, description: 'Optimizing output...' },
  STORING: { name: 'STORING', percent: 100, description: 'Storing output...' },
  QUEUED: { name: 'QUEUED', percent: 0, description: 'Queued for processing...' },
  EVIDENCE_COLLECTION: { name: 'EVIDENCE_COLLECTION', percent: 15, description: 'Thu thập dữ liệu đa nguồn (TMDB, AniList, MAL, OMDb)...' },
  ENTITY_MATCHING: { name: 'ENTITY_MATCHING', percent: 35, description: 'Đối soát quan hệ thực thể với cơ sở dữ liệu...' },
  LLM_REASONING: { name: 'LLM_REASONING', percent: 65, description: 'Tổng hợp thông tin, phân giải xung đột và dịch thuật...' },
  SELF_AUDIT_VALIDATION: { name: 'SELF_AUDIT_VALIDATION', percent: 85, description: 'Tự kiểm toán, chấm điểm tin cậy và gắn nhãn nguồn gốc...' },
  PARTIAL_FAILURE: { name: 'PARTIAL_FAILURE', percent: 100, description: 'Partially completed' },
  FAILED: { name: 'FAILED', percent: 100, description: 'Failed' },
  COMPLETED: { name: 'COMPLETED', percent: 100, description: 'Completed' },
};

export const STAGE_LABELS = {
  VALIDATING: 'Validating data',
  CHECKING_DEDUP: 'Checking duplicates',
  CHECKING_SLUG: 'Checking slug',
  RESTORING: 'Restoring movie',
  VALIDATING_SCHEMA: 'Validating schema',
  SAVING_DATABASE: 'Saving database',
  SAVING_GENRES: 'Saving genres',
  COMMITTING: 'Committing transaction',
  PREPARING_IMAGES: 'Preparing images',
  UPDATING_DATABASE: 'Updating database',
  IMAGE_START: 'Starting image processing',
  IMAGE_DONE: 'Image processing completed',
  ANALYZING: 'Analyzing image',
  PREPROCESSING: 'Preprocessing',
  CROPPING: 'Cropping',
  UPSCALING: 'Upscaling',
  ENHANCING: 'Enhancing',
  OPTIMIZING: 'Optimizing',
  STORING: 'Storing',
  QUEUED: 'Queued',
  EVIDENCE_COLLECTION: 'Thu thập dữ liệu đa nguồn',
  ENTITY_MATCHING: 'Đối soát thực thể & quan hệ',
  LLM_REASONING: 'Tổng hợp AI & Dịch thuật',
  SELF_AUDIT_VALIDATION: 'Tự kiểm toán & Đánh giá',
  PARTIAL_FAILURE: 'Partially completed',
  FAILED: 'Failed',
  COMPLETED: 'Completed',
  DELETING: 'Deleting movie',
  INVALIDATING_CACHE: 'Invalidating cache',
};

const PROGRESS_CACHE_TTL_SECONDS = 6 * 3600;
const TERMINAL_STATUSES = new Set(['completed', 'partial_failure', 'failed', 'error', 'cancelled']);

const clampPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
};

const toStageName = (stage, fallback = null) => {
  if (!stage) return fallback;
  if (typeof stage === 'string') return stage;
  if (typeof stage === 'object') return stage.name || fallback;
  return fallback;
};

const normalizeStatus = (status, eventName) => {
  if (status === 'error') return 'failed';
  if (status) return status;

  switch (eventName) {
    case PROGRESS_EVENTS.UPLOAD_START:
      return 'started';
    case PROGRESS_EVENTS.UPLOAD_COMPLETE:
      return 'completed';
    case PROGRESS_EVENTS.UPLOAD_ERROR:
      return 'failed';
    case PROGRESS_EVENTS.QUEUE_POSITION:
    case PROGRESS_EVENTS.QUEUE_WAITING:
      return 'queued';
    default:
      return 'processing';
  }
};

const inferJobType = (payload, fallbackType = 'movie') => {
  if (payload.jobType) return payload.jobType;
  if (payload.type === 'upload') return 'upload';
  if (payload.operation === 'images' || payload.imageType) return 'image';
  if (typeof fallbackType === 'string' && fallbackType.startsWith('movie:')) return 'movie';
  return fallbackType || 'movie';
};

export class ProgressService {
  constructor(io = null) {
    this.io = io;
    this.activeRooms = new Map();
    this.subscriptions = new Map();
    this.sequenceByJob = new Map();
    this.jobMetadata = new Map();
  }

  initialize(io) {
    this.io = io;
    logger.info('[ProgressService] initialized as socket gateway backing service');
  }

  getNextSequence(jobId) {
    const current = this.sequenceByJob.get(jobId) || 0;
    const next = current + 1;
    this.sequenceByJob.set(jobId, next);
    return next;
  }

  trackSubscription(socketId, jobId) {
    if (!socketId || !jobId) return;

    if (!this.subscriptions.has(socketId)) {
      this.subscriptions.set(socketId, new Set());
    }
    this.subscriptions.get(socketId).add(jobId);

    if (!this.activeRooms.has(jobId)) {
      this.activeRooms.set(jobId, new Set());
    }
    this.activeRooms.get(jobId).add(socketId);
  }

  untrackSubscription(socketId, jobId) {
    if (!socketId || !jobId) return;

    const socketJobs = this.subscriptions.get(socketId);
    if (socketJobs) {
      socketJobs.delete(jobId);
      if (socketJobs.size === 0) {
        this.subscriptions.delete(socketId);
      }
    }

    const roomSockets = this.activeRooms.get(jobId);
    if (roomSockets) {
      roomSockets.delete(socketId);
      if (roomSockets.size === 0) {
        this.activeRooms.delete(jobId);
      }
    }
  }

  handleDisconnect(socket) {
    const socketId = socket?.id;
    const jobIds = this.subscriptions.get(socketId);
    if (!jobIds) return;

    for (const jobId of jobIds) {
      const roomSockets = this.activeRooms.get(jobId);
      if (!roomSockets) continue;
      roomSockets.delete(socketId);
      if (roomSockets.size === 0) {
        this.activeRooms.delete(jobId);
      }
    }

    this.subscriptions.delete(socketId);
    logger.debug(`[ProgressService] cleaned subscriptions for socketId=${socketId}`);
  }

  handleSubscribe(socket, data = {}) {
    const { jobId, jobType = 'movie' } = data;
    if (!socket || !jobId) return;

    socket.join(`job:${jobId}`);
    this.trackSubscription(socket.id, jobId);
    this.sendCurrentStatus(jobId, socket);
    socket.emit('subscribed', {
      jobId,
      jobType,
      timestamp: Date.now(),
    });
  }

  handleUnsubscribe(socket, data = {}) {
    const { jobId } = data;
    if (!socket || !jobId) return;

    socket.leave(`job:${jobId}`);
    this.untrackSubscription(socket.id, jobId);
  }

  async sendCurrentStatus(jobId, socket) {
    try {
      const status = await this.getJobStatus(jobId);
      if (status) {
        socket.emit(PROGRESS_EVENTS.JOB_PROGRESS, status);
      }
    } catch (error) {
      logger.warn(`[ProgressService] cannot read snapshot jobId=${jobId}: ${error.message}`);
    }
  }

  normalizeProgressPayload(jobId, eventName, payload = {}, fallbackType = 'movie') {
    const now = Date.now();
    const sequence = Number.isInteger(payload.sequence)
      ? payload.sequence
      : this.getNextSequence(jobId);
    const percent = clampPercent(
      payload.percent ?? payload.percentage ?? payload.progress ?? (payload.status === 'completed' ? 100 : 0),
    );
    const status = normalizeStatus(payload.status, eventName);
    const stage = toStageName(payload.stage, payload.stageName || status);
    const emittedAt = payload.emittedAt || new Date(now).toISOString();
    const jobType = inferJobType(payload, fallbackType);
    const traceId = payload.traceId || `${jobId}:${sequence}`;
    const eventId = payload.eventId || `${jobId}:${sequence}:${eventName}`;

    return {
      ...payload,
      jobId,
      jobType,
      eventId,
      traceId,
      sequence,
      status,
      rawStatus: payload.status && payload.status !== status ? payload.status : undefined,
      percent,
      progress: percent,
      percentage: percent,
      stage,
      emittedAt,
      timestamp: payload.timestamp || now,
      terminal: TERMINAL_STATUSES.has(status),
    };
  }

  broadcast(room, eventName, payload) {
    if (!this.io) return;
    this.io.to(room).emit(eventName, payload);
  }

  broadcastProgress(jobId, eventName, payload, fallbackType = 'movie') {
    const normalized = this.normalizeProgressPayload(jobId, eventName, payload, fallbackType);
    const room = `job:${jobId}`;

    this.broadcast(room, eventName, normalized);
    if (eventName !== PROGRESS_EVENTS.JOB_PROGRESS) {
      this.broadcast(room, PROGRESS_EVENTS.JOB_PROGRESS, normalized);
    }

    this.cacheProgress(jobId, normalized).catch(() => {});
    return normalized;
  }

  emitUploadProgress(jobId, data = {}) {
    const payload = this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.UPLOAD_PROGRESS,
      {
        type: 'upload',
        status: 'processing',
        percent: data.percent || 0,
        bytesUploaded: data.bytesUploaded || 0,
        totalBytes: data.totalBytes || 0,
        speed: data.speed || 0,
        ...data,
      },
      'upload',
    );

    logger.debug(`[ProgressService] upload progress jobId=${jobId} percent=${payload.percent}`);
  }

  emitUploadStart(jobId, data = {}) {
    this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.UPLOAD_START,
      {
        type: 'upload',
        status: 'started',
        filename: data.filename,
        fileSize: data.fileSize,
        ...data,
      },
      'upload',
    );

    logger.info(`[ProgressService] upload started jobId=${jobId} filename=${data.filename || 'unknown'}`);
  }

  emitUploadComplete(jobId, data = {}) {
    this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.UPLOAD_COMPLETE,
      {
        type: 'upload',
        status: 'completed',
        percent: 100,
        filename: data.filename,
        fileSize: data.fileSize,
        duration: data.duration,
        ...data,
      },
      'upload',
    );

    logger.info(`[ProgressService] upload completed jobId=${jobId}`);
  }

  emitUploadError(jobId, error) {
    this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.UPLOAD_ERROR,
      {
        type: 'upload',
        status: 'failed',
        percent: 100,
        error: error?.message || error,
        code: error?.code || 'UPLOAD_ERROR',
      },
      'upload',
    );

    logger.error(`[ProgressService] upload failed jobId=${jobId}: ${error?.message || error}`);
  }

  emitProcessingStart(jobId, data = {}) {
    this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.JOB_PROGRESS,
      {
        type: 'processing',
        status: 'started',
        stage: PROGRESS_STAGES.ANALYZING.name,
        stageLabel: STAGE_LABELS.ANALYZING,
        percent: 0,
        message: data.message || PROGRESS_STAGES.ANALYZING.description,
        pipeline: data.pipeline || [],
        ...data,
      },
      data.jobType || 'movie',
    );

    logger.info(`[ProgressService] processing started jobId=${jobId}`);
  }

  emitProcessingStage(jobId, stageName, data = {}) {
    const stage = PROGRESS_STAGES[stageName] || {
      name: stageName,
      percent: data.percent || 0,
      description: stageName,
    };

    this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.JOB_PROGRESS,
      {
        type: 'processing',
        status: 'processing',
        stage: stage.name || stageName,
        stageLabel: STAGE_LABELS[stageName] || data.message || stageName,
        percent: data.percent ?? stage.percent,
        message: data.message || stage.description || stageName,
        ...data,
      },
      data.jobType || 'movie',
    );

    logger.debug(`[ProgressService] processing stage jobId=${jobId} stage=${stageName}`);
  }

  emitProcessingProgress(jobId, percent, data = {}) {
    this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.JOB_PROGRESS,
      {
        type: 'processing',
        status: 'processing',
        percent,
        stage: data.stage || null,
        message: data.message || `Processing ${Math.round(percent)}%`,
        details: data.details || {},
        ...data,
      },
      data.jobType || 'movie',
    );
  }

  emitProcessingComplete(jobId, data = {}) {
    this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.JOB_PROGRESS,
      {
        type: 'processing',
        status: 'completed',
        stage: PROGRESS_STAGES.COMPLETED.name,
        stageLabel: STAGE_LABELS.COMPLETED,
        percent: 100,
        message: data.message || 'Completed',
        outputs: data.outputs || {},
        duration: data.duration,
        movieId: data.movieId,
        slug: data.slug,
        ...(data.imageCount !== undefined && { imageCount: data.imageCount }),
        ...(data.processedTypes !== undefined && { processedTypes: data.processedTypes }),
        ...(data.failures !== undefined && { failures: data.failures }),
        ...(data.warnings !== undefined && { warnings: data.warnings }),
        ...data,
      },
      data.jobType || 'movie',
    );

    logger.info(`[ProgressService] processing completed jobId=${jobId} duration=${data.duration || 'unknown'}ms`);
  }

  emitProcessingError(jobId, error, stage = null, data = {}) {
    this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.JOB_PROGRESS,
      {
        type: 'processing',
        status: 'failed',
        stage,
        percent: 100,
        error: error?.message || error,
        message: `Error: ${error?.message || error}`,
        code: error?.code || 'PROCESSING_ERROR',
        recoverable: error?.recoverable || false,
        ...data,
      },
      data.jobType || 'movie',
    );

    logger.error(`[ProgressService] processing failed jobId=${jobId}: ${error?.message || error}`);
  }

  emitQueuePosition(jobId, position, estimatedWait) {
    this.broadcastProgress(
      jobId,
      PROGRESS_EVENTS.QUEUE_POSITION,
      {
        type: 'queue',
        status: 'queued',
        stage: PROGRESS_STAGES.QUEUED.name,
        position,
        estimatedWait,
      },
      'movie',
    );
  }

  async cacheProgress(jobId, payload) {
    try {
      await cacheHelper.set(`progress:${jobId}`, payload, PROGRESS_CACHE_TTL_SECONDS);
    } catch (error) {
      logger.warn(`[ProgressService] cannot cache snapshot jobId=${jobId}: ${error.message}`);
    }
  }

  async getJobStatus(jobId) {
    try {
      const cached = await cacheHelper.get(`progress:${jobId}`);
      if (!cached) return null;
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    } catch (error) {
      logger.warn(`[ProgressService] cannot get snapshot jobId=${jobId}: ${error.message}`);
      return null;
    }
  }

  createTracker(jobId, type = 'upload', metadata = {}) {
    if (metadata && Object.keys(metadata).length > 0) {
      this.jobMetadata.set(jobId, { type, ...metadata });
    }

    return new JobProgressTracker(this, jobId, type, metadata);
  }

  getActiveRooms() {
    const rooms = {};
    for (const [jobId, sockets] of this.activeRooms) {
      rooms[jobId] = sockets.size;
    }
    return rooms;
  }

  async cleanupJob(jobId) {
    this.activeRooms.delete(jobId);
    this.jobMetadata.delete(jobId);
    this.sequenceByJob.delete(jobId);
    logger.debug(`[ProgressService] released in-memory state jobId=${jobId}`);
  }
}

export class JobProgressTracker {
  constructor(service, jobId, type, metadata = {}) {
    this.service = service;
    this.jobId = jobId;
    this.type = type;
    this.metadata = metadata;
    this.startTime = Date.now();
    this.currentStage = null;
    this.stages = [];
  }

  withMetadata(data = {}) {
    return {
      jobType: this.metadata.jobType || (this.type === 'upload' ? 'upload' : 'movie'),
      operation: this.metadata.operation,
      ...this.metadata,
      ...data,
    };
  }

  start(data = {}) {
    const payload = this.withMetadata(data);
    if (this.type === 'upload') {
      this.service.emitUploadStart(this.jobId, payload);
    } else {
      this.service.emitProcessingStart(this.jobId, payload);
    }
  }

  progress(percent, data = {}) {
    const payload = this.withMetadata(data);
    if (this.type === 'upload') {
      this.service.emitUploadProgress(this.jobId, { percent, ...payload });
    } else {
      this.service.emitProcessingProgress(this.jobId, percent, payload);
    }
  }

  stage(stageName, data = {}) {
    this.currentStage = stageName;
    this.stages.push({
      name: stageName,
      startTime: Date.now(),
      data,
    });

    this.service.emitProcessingStage(this.jobId, stageName, this.withMetadata(data));
  }

  complete(data = {}) {
    const duration = Date.now() - this.startTime;
    const payload = this.withMetadata({ ...data, duration });

    if (this.type === 'upload') {
      this.service.emitUploadComplete(this.jobId, payload);
    } else {
      this.service.emitProcessingComplete(this.jobId, {
        warnings: data.warnings || [],
        ...payload,
      });
    }

    setTimeout(() => {
      this.service.cleanupJob(this.jobId);
    }, 60_000).unref?.();
  }

  error(err, recoverable = false) {
    const error = err instanceof Error ? err : new Error(err);
    error.recoverable = recoverable;

    if (this.type === 'upload') {
      this.service.emitUploadError(this.jobId, error);
    } else {
      this.service.emitProcessingError(this.jobId, error, this.currentStage, this.withMetadata());
    }
  }

  queuePosition(position, estimatedWait) {
    this.service.emitQueuePosition(this.jobId, position, estimatedWait);
  }
}

export const progressService = new ProgressService();

export const initializeProgressService = (io) => {
  progressService.initialize(io);
  return progressService;
};

export const createProgressTracker = (jobId, type, metadata = {}) => {
  return progressService.createTracker(jobId, type, metadata);
};

export default {
  ProgressService,
  progressService,
  JobProgressTracker,
  initializeProgressService,
  createProgressTracker,
  PROGRESS_EVENTS,
  PROGRESS_STAGES,
  STAGE_LABELS,
};
