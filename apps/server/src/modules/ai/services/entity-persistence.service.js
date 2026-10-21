/** Apply trusted job credits inside the caller's movie transaction. No outbound I/O. */
import { Op } from 'sequelize';
import { slugify } from '../../../utils/slugify.util.js';
import { validateApplication } from '../helpers/entity-identity.helper.js';

export const createEntityPersistence = ({ AIJob, Actor, Studio, sequelize }) => async (data, { userId, movieId = null, transaction }) => {
  if (!data.ai_application) {
    if (data.actor_cast?.some((row) => row.entity_key)) throw Object.assign(new Error('Thiếu tham chiếu job AI.'), { statusCode: 400, code: 'AI_APPLICATION_REQUIRED' });
    return data;
  }
  if (process.env.AI_ENTITY_ENRICHMENT_ENABLED === 'false') throw Object.assign(new Error('Tính năng lưu thực thể AI đang tắt.'), { statusCode: 503, code: 'AI_ENRICHMENT_DISABLED' });
  const application = data.ai_application;
  const job = await AIJob.findOne({ where: { job_id: application.job_id }, transaction, lock: transaction.LOCK.UPDATE });
  const entities = validateApplication(job, application, { userId, movieId, data });
  const result = { ...data, actor_cast: data.actor_cast?.map((row) => ({ ...row })) };
  const actorKeys = new Set(entities.filter((e) => e.kind === 'actor').map((e) => e.value.entity_key));
  for (const row of result.actor_cast || []) if (row.entity_key && !actorKeys.has(row.entity_key)) {
    throw Object.assign(new Error('Diễn viên không thuộc gợi ý đã chọn.'), { statusCode: 409, code: 'AI_APPLICATION_UNVERIFIED' });
  }
  for (const { kind, value } of entities) {
    const row = kind === 'actor' ? result.actor_cast?.find((item) => item.entity_key === value.entity_key) : null;
    if (kind === 'actor' && !row) continue; // Removed in the editor after applying.
    const Model = kind === 'actor' ? Actor : Studio;
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtextextended(:identity, 0))', { replacements: { identity: value.entity_key }, transaction });
    const where = { [Op.and]: [sequelize.where(sequelize.json('metadata.source'), value.source), sequelize.where(sequelize.json('metadata.source_id'), String(value.source_id))] };
    let record = await Model.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
    const existingId = value.actor_id || value.id || value.studio_id;
    if (existingId && (!record || record.id !== existingId)) throw Object.assign(new Error('Định danh thực thể đã thay đổi; hãy tra cứu lại.'), { statusCode: 409, code: 'AI_ENTITY_CHANGED' });
    if (!record) {
      const name = kind === 'actor' ? value.actor_name : value.name;
      const metadata = { source: value.source, source_id: String(value.source_id), auto_created: true, ai_job_id: application.job_id };
      const fields = kind === 'actor'
        ? { image_url: value.actor_image_url, biography: value.biography, gender: value.gender, birth_date: value.birth_date, nationality: value.nationality, aliases: value.aliases || [] }
        : { logo_url: value.logo_url, country: value.country };
      record = await Model.create({ ...fields, name, slug: `${slugify(name).slice(0,180)}-${value.source}-${value.source_id}`, metadata, created_by: userId, updated_by: userId }, { transaction });
    }
    if (kind === 'studio') result.studio_id = record.id;
    else Object.assign(row, { actor_id: record.id, actor_name: record.name, actor_image_url: record.image_url, ai_verified: true });
  }
  return result;
};
