/**
 * @file job-lifecycle.util.js
 * @module Shared/Utils
 * @description Reference-counted room ownership and monotonic job event acceptance.
 */

/** @description Retain a typed job room and report whether a join is needed. @param {Map} registry @param {string} jobId @param {string} jobType @returns {boolean} */
export const retainJobRoom = (registry, jobId, jobType = 'movie') => {
  const key = `job:${jobType}:${jobId}`;
  const previous = registry.get(key);
  registry.set(key, { type: 'job', id: jobId, params: { jobType }, refs: (previous?.refs || 0) + 1 });
  return !previous;
};

/** @description Release only one consumer; leave the room after the final release. @param {Map} registry @param {string} jobId @param {string} jobType @returns {boolean} */
export const releaseJobRoom = (registry, jobId, jobType = 'movie') => {
  const key = `job:${jobType}:${jobId}`;
  const previous = registry.get(key);
  if (!previous) return false;
  if (previous.refs > 1) { registry.set(key, { ...previous, refs: previous.refs - 1 }); return false; }
  registry.delete(key);
  return true;
};

/** @description Drop duplicate, stale, unbound AI and regressing terminal packets. @param {object} current @param {object} payload @returns {boolean} */
export const acceptsJobEvent = (current, payload) => {
  const ai = payload?.jobType === 'ai' || current?.jobType === 'ai';
  if (ai && (!payload.ownerId || !payload.target || !(payload.target.movieId || payload.target.draftId))) return false;
  if (ai && current?.ownerId && String(current.ownerId) !== String(payload.ownerId)) return false;
  if (ai && current?.target && (String(current.target.movieId || '') !== String(payload.target.movieId || '') || String(current.target.draftId || '') !== String(payload.target.draftId || ''))) return false;
  if (!current) return true;
  if (current.isTerminal && !['completed', 'failed', 'cancelled', 'error', 'partial_failure'].includes(payload.status)) return false;
  if (payload.sequence != null && payload.sequence <= current.sequence) {
    return payload.sequence === current.sequence && !current.result && Boolean(payload.result) && payload.status === current.status;
  }
  return true;
};
