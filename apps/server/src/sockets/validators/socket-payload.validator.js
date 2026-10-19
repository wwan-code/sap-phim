/**
 * Payload validators for Socket.IO commands.
 */

const MAX_ID_LENGTH = 64;
const MAX_PRESENCE_QUERY = 200;
const MAX_JOB_SYNC = 50;

export const VALID_JOB_TYPES = ["movie", "suggest", "image", "episode", "upload", "ai"];

const isValidString = (value, maxLength = MAX_ID_LENGTH) => (
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maxLength
);

const sanitizeId = (value) => {
  /* eslint-disable-next-line no-control-regex */
  return value.trim().replace(/[\x00-\x1F\x7F]/g, "");
};

const normalizeJobType = (value) => {
  const jobType = typeof value === "string" && value.trim()
    ? value.trim()
    : "movie";
  return VALID_JOB_TYPES.includes(jobType) ? jobType : null;
};

const normalizeJobPayload = (data) => {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Payload must be an object" };
  }

  if (!isValidString(data.jobId)) {
    return { valid: false, error: "jobId must be a non-empty string" };
  }

  const jobType = normalizeJobType(data.jobType);
  if (!jobType) {
    return {
      valid: false,
      error: `jobType must be one of: ${VALID_JOB_TYPES.join(", ")}`,
    };
  }

  return {
    valid: true,
    data: {
      jobId: sanitizeId(data.jobId),
      jobType,
    },
  };
};

export const validatePresenceQuery = (data) => {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Payload must be an object" };
  }

  if (!Array.isArray(data.userIds)) {
    return { valid: false, error: "userIds must be an array" };
  }

  const sanitized = data.userIds
    .filter((id) => isValidString(id))
    .map(sanitizeId)
    .slice(0, MAX_PRESENCE_QUERY);

  if (sanitized.length === 0) {
    return { valid: false, error: "userIds does not contain valid ids" };
  }

  return { valid: true, data: { userIds: sanitized } };
};

export const validateJobSubscribe = (data) => normalizeJobPayload(data);

export const validateJobUnsubscribe = (data) => normalizeJobPayload(data);

export const validateJobStatus = (data) => normalizeJobPayload(data);

export const validateJobSync = (data) => {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Payload must be an object" };
  }

  const rawJobs = Array.isArray(data.jobs)
    ? data.jobs
    : Array.isArray(data.jobIds)
      ? data.jobIds.map((jobId) => ({ jobId, jobType: "movie" }))
      : [];

  if (rawJobs.length === 0) {
    return { valid: false, error: "jobs must contain at least one job" };
  }

  const jobs = [];
  const seen = new Set();

  for (const rawJob of rawJobs.slice(0, MAX_JOB_SYNC)) {
    const normalized = normalizeJobPayload(rawJob);
    if (!normalized.valid) continue;

    const key = `${normalized.data.jobType}:${normalized.data.jobId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push(normalized.data);
  }

  if (jobs.length === 0) {
    return { valid: false, error: "jobs does not contain valid jobs" };
  }

  return { valid: true, data: { jobs } };
};
