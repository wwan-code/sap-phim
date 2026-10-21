/** Canonical identities for verified source credits; names are never identity keys. */
export const entityKey = (kind, value = {}) => {
  const namespace = { actor: { tmdb: 'person', anilist: 'staff' }, studio: { tmdb: 'company', anilist: 'studio' } }[kind]?.[value.source];
  const id = String(value.source_id ?? '');
  return namespace && /^[1-9]\d{0,9}$/.test(id) && Number(id) <= 2147483647
    ? `${value.source}:${namespace}:${id}` : null;
};

export const describeEntity = (kind, value, existingId = null) => ({
  ...value,
  entity_key: entityKey(kind, value),
  match_status: existingId ? 'existing' : entityKey(kind, value) ? 'new_verified' : 'needs_review',
  is_new: !existingId,
});

/** Reject cross-account, cross-form and historical unverified applications before writing. */
export const validateApplication = (job, application, { userId, movieId = null, data = {} }) => {
  const fail = (code) => { const error = new Error('Gợi ý AI không còn phù hợp với phim này. Hãy tra cứu lại.'); Object.assign(error, { code, statusCode: 409, isOperational: true }); throw error; };
  if (!job || job.user_id !== userId) fail('AI_APPLICATION_FORBIDDEN');
  if (job.status !== 'completed' || !job.result || job.result.entity_contract_version !== 1) fail('AI_APPLICATION_UNVERIFIED');
  if ((job.target?.movieId || null) !== movieId || (!movieId && job.target?.draftId !== application.draft_id)) fail('AI_APPLICATION_TARGET_MISMATCH');
  const candidate = job.request_payload?.selectedCandidate;
  if (!candidate || candidate.candidateId !== application.candidate_id) fail('AI_APPLICATION_IDENTITY_MISMATCH');
  for (const [source, id] of Object.entries(candidate.sourceIds || {})) {
    if (data[`${source}_id`] != null && String(data[`${source}_id`]) !== String(id)) fail('AI_APPLICATION_IDENTITY_MISMATCH');
  }
  const type = (v) => v === 'tv' ? 'series' : v;
  if (data.type && candidate.mediaType && type(data.type) !== type(candidate.mediaType)) fail('AI_APPLICATION_IDENTITY_MISMATCH');
  const entities = [...(job.result.suggested_entities?.actors || []).map((value) => ({ kind: 'actor', value })),
    ...(job.result.suggested_entities?.studio ? [{ kind: 'studio', value: job.result.suggested_entities.studio }] : [])];
  return [...new Set(application.entity_keys)].map((key) => {
    const entity = entities.find(({ kind, value }) => entityKey(kind, value) === key && value.entity_key === key);
    if (!entity || !['existing', 'new_verified'].includes(entity.value.match_status)) fail('AI_APPLICATION_UNVERIFIED');
    return entity;
  }).sort((a, b) => a.value.entity_key.localeCompare(b.value.entity_key));
};
