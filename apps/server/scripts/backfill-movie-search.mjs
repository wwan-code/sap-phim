/** Resume projection backfill after migration. Explicit maintenance command. */
import { sequelize } from '../src/config/database.config.js';
try {
  let done = false;
  while (!done) {
    await sequelize.transaction(async (transaction) => {
      const [state] = await sequelize.query('SELECT * FROM movie_search_state WHERE id=1 FOR UPDATE', { transaction });
      if (!state[0]) throw new Error('Run the search migration first.');
      const [rows] = await sequelize.query('SELECT id FROM movies WHERE (:last IS NULL OR id > CAST(:last AS uuid)) ORDER BY id LIMIT 100', { replacements: { last: state[0].last_id }, transaction });
      for (const row of rows) await sequelize.query('SELECT sp_refresh_movie_search(:id)', { replacements: { id: row.id }, transaction });
      done = rows.length < 100;
      await sequelize.query('UPDATE movie_search_state SET last_id=COALESCE(CAST(:last AS uuid),last_id),ready=:ready WHERE id=1', { replacements: { last: rows.at(-1)?.id || null, ready: done }, transaction });
      console.info(JSON.stringify({ processed: rows.length, ready: done }));
    });
  }
} finally { await sequelize.close(); }
