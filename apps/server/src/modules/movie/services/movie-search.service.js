/** Feature preflight keeps legacy search available until migration and backfill complete. */
import { sequelize } from '../../../config/database.config.js';
import { logger } from '../../../utils/logger.js';
import { buildSearchSql } from '../helpers/movie-search.helper.js';
let readiness = { expires: 0, ready: false };
export const getAdminSearch = async (query, field) => {
  if (!query || process.env.ADMIN_MOVIE_SEARCH_ENABLED !== 'true') return null;
  if (readiness.expires < Date.now()) {
    let ready = false;
    try {
      const [rows] = await sequelize.query("SELECT ready FROM movie_search_state WHERE id = 1");
      ready = rows[0]?.ready === true;
    } catch { logger.warn('[MovieSearch] Index not ready; using legacy search.'); }
    readiness = { ready, expires: Date.now() + 30000 };
  }
  return readiness.ready ? buildSearchSql({ query, field, escape: (value) => sequelize.escape(value) }) : null;
};
