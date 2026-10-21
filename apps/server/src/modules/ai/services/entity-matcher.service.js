/** Read-only taxonomy and verified source identity matching. */
import { Op } from 'sequelize';
const loadModels = () => import('../../../models/index.js');
import { logger } from '../../../utils/logger.js';
import { normalizeTitle, normalizeTaxonomyName, matchGenreEvidence, matchCountryEvidence } from '../helpers/ai-metadata.helper.js';
import { entityKey, describeEntity } from '../helpers/entity-identity.helper.js';
export class EntityMatcherService {
  async loadDatabaseEntities() {
    const { Genre, Country, Category, Studio } = await loadModels();
    try {
      const [genres, countries, categories, studios] = await Promise.all([
        Genre.findAll({ attributes: ["id", "name", "slug"] }),
        Country.findAll({ attributes: ["id", "name", "slug", "code"] }),
        Category.findAll({ attributes: ["id", "name", "slug"] }),
        Studio.findAll({ attributes: ["id", "name", "slug", "metadata"] }),
      ]);
      return {
        genres: genres.map((g) => g.toJSON()),
        countries: countries.map((c) => c.toJSON()),
        categories: categories.map((c) => c.toJSON()),
        studios: studios.map((s) => s.toJSON()),
      };
    } catch (err) {
      logger.error(`[AI Matcher] Lỗi tải database entities: ${err.message}`);
      return { genres: [], countries: [], categories: [], studios: [] };
    }
  }

  matchGenres(rawGenres = [], dbGenres = []) {
    if (!Array.isArray(rawGenres) || !rawGenres.length) return [];
    const matchedIds = new Set();
    for (const raw of rawGenres) {
      const matched = matchGenreEvidence(raw, dbGenres);
      if (matched) matchedIds.add(matched.id);
    }
    return Array.from(matchedIds);
  }

  matchCountry(rawCountry, dbCountries = []) {
    if (!rawCountry) return null;
    const matched = matchCountryEvidence(rawCountry, dbCountries);
    return matched?.id || null;
  }

  matchStudio(rawStudios = [], dbStudios = []) {
    if (!Array.isArray(rawStudios) || !rawStudios.length) return null;
    for (const raw of rawStudios) {
      const norm = normalizeTaxonomyName(raw);
      const exact = dbStudios.find((s) => normalizeTaxonomyName(s.name) === norm || s.slug === norm);
      if (exact) return exact.id;
    }
    return null;
  }

  resolveStudioCandidate(rawStudioDetails = [], dbStudios = []) {
    const list = Array.isArray(rawStudioDetails) ? rawStudioDetails : [rawStudioDetails].filter(Boolean);
    if (!list.length) return null;
    const first = typeof list[0] === "string" ? { name: list[0] } : list[0];
    const key = entityKey('studio', first);
    const existing = key && dbStudios.find((row) => entityKey('studio', row.metadata) === key);
    return describeEntity('studio', { ...first, studio_id: existing?.id || null }, existing?.id);
  }

  async matchSeries(title, options = {}) {
    const { Series } = await loadModels();
    if (!title) return null;
    try {
      const norm = normalizeTitle(title);
      const series = await Series.findOne({
        where: { title: { [Op.iLike]: `%${norm}%` } },
        attributes: ["id", "title"],
      });
      if (!series) return null;
      return options.includeDetails ? { id: series.id, name: series.title } : series.id;
    } catch {
      return null;
    }
  }

  async matchActors(rawActors = []) {
    const { Actor, sequelize } = await loadModels();
    const identities = rawActors.filter((item) => entityKey('actor', item));
    if (!identities.length) return rawActors.map((item) => describeEntity('actor', { ...item, actor_id: null }));
    const existing = await Actor.findAll({ where: { [Op.or]: identities.map((item) => ({
      [Op.and]: [sequelize.where(sequelize.json('metadata.source'), item.source), sequelize.where(sequelize.json('metadata.source_id'), String(item.source_id))],
    })) }, attributes: ['id', 'name', 'image_url', 'metadata'] });
    return rawActors.map((item) => {
      const found = existing.find((row) => entityKey('actor', row.metadata) === entityKey('actor', item));
      return describeEntity('actor', { ...item, actor_name: item.actor_name || item.name,
        actor_id: found?.id || null, actor_image_url: found?.image_url || item.actor_image_url || null }, found?.id);
    });
  }
}
export const entityMatcher = new EntityMatcherService();
