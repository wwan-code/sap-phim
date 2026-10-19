import { addJob, QUEUE_NAMES } from "../../../config/queue.config.js";

export const NOTIFICATION_QUEUE_JOBS = Object.freeze({
  CREATE: "notification:create",
  CREATE_FROM_TEMPLATE: "notification:create-from-template",
  BROADCAST: "notification:broadcast",
});

const DEFAULT_NOTIFICATION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 2000 },
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
};

const toQueuedResult = (job) => ({
  jobId: String(job.id),
  queue: QUEUE_NAMES.NOTIFICATION,
  status: "queued",
});

export const notificationQueueService = {
  async enqueueCreate(payload, options = {}) {
    const job = await addJob(
      QUEUE_NAMES.NOTIFICATION,
      NOTIFICATION_QUEUE_JOBS.CREATE,
      { payload },
      {
        ...DEFAULT_NOTIFICATION_JOB_OPTIONS,
        ...options,
      },
    );

    return toQueuedResult(job);
  },

  async enqueueFromTemplate(type, templateData, options = {}) {
    const job = await addJob(
      QUEUE_NAMES.NOTIFICATION,
      NOTIFICATION_QUEUE_JOBS.CREATE_FROM_TEMPLATE,
      { type, templateData },
      {
        ...DEFAULT_NOTIFICATION_JOB_OPTIONS,
        ...options,
      },
    );

    return toQueuedResult(job);
  },

  async enqueueBroadcast(payload, options = {}) {
    const { batchSize, ...jobOptions } = options;
    const job = await addJob(
      QUEUE_NAMES.NOTIFICATION,
      NOTIFICATION_QUEUE_JOBS.BROADCAST,
      { payload, batchSize },
      {
        ...DEFAULT_NOTIFICATION_JOB_OPTIONS,
        ...jobOptions,
      },
    );

    return toQueuedResult(job);
  },
};

export default notificationQueueService;
