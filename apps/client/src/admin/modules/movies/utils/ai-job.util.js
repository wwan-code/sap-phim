/**
 * @file ai-job.util.js
 * @module Admin/Movies/Utils
 * @description Account and form identity checks for every suggestion job and recovery request.
 */

/** @description Compare immutable account and form ownership, rejecting incomplete packets. @param {object} job @param {*} ownerId @param {object} target @returns {boolean} */
export const matchesAiJobTarget = (job, ownerId, target) => Boolean(
  job?.jobId && ownerId && job.ownerId && String(job.ownerId) === String(ownerId) && job.target && target &&
  String(job.target.movieId || '') === String(target.movieId || '') &&
  String(job.target.draftId || '') === String(target.draftId || '') &&
  Boolean(target.movieId) !== Boolean(target.draftId)
);

/** @description Recover only the specified job; this interface intentionally has no creation method. @param {object} reader @param {string} jobId @param {*} ownerId @param {object} target @returns {Promise<object>} */
export const recoverAiJob = async (reader, jobId, ownerId, target) => {
  const job = await reader.getJobStatus(jobId);
  if (job?.jobId !== jobId || !matchesAiJobTarget(job, ownerId, target)) throw new Error('Kết quả không thuộc tài khoản hoặc tác phẩm hiện tại.');
  return job;
};

/** @description Keep one draft identity per signed-in account and browser session. @param {*} ownerId @param {Storage} storage @returns {string} */
export const getAiDraftId = (ownerId, storage) => {
  const key = `sap-phim:ai-draft:${ownerId}`;
  const existing = storage?.getItem(key);
  if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) return existing;
  const id = globalThis.crypto.randomUUID();
  storage?.setItem(key, id);
  return id;
};

/** @description Retire a saved form draft so the next new movie receives a distinct target. @param {*} ownerId @param {string|null} draftId @param {Storage} storage @returns {void} */
export const retireAiDraft = (ownerId, draftId, storage) => {
  const key = `sap-phim:ai-draft:${ownerId}`;
  if (draftId && storage?.getItem(key) === draftId) storage.removeItem(key);
};
