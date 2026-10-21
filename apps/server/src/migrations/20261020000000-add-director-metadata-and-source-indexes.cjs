/**
 * @file 20261020000000-add-director-metadata-and-source-indexes.cjs
 * @module Migrations_DirectorMetadataAndSourceIndexes
 * @description Bổ sung cột director_metadata cho bảng movies và partial unique index định danh nguồn cho actors/studios.
 */

'use strict';

const getTable = async (queryInterface, tableName, transaction) => {
  try {
    return await queryInterface.describeTable(tableName, { transaction });
  } catch {
    return {};
  }
};

const run = (queryInterface, sql, transaction) => queryInterface.sequelize.query(sql, { transaction });

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const { DataTypes } = Sequelize;

      // 1. movies.director_metadata
      const moviesTable = await getTable(queryInterface, 'movies', transaction);
      if (!moviesTable.director_metadata) {
        await queryInterface.addColumn(
          'movies',
          'director_metadata',
          {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
            comment: 'Chi tiết metadata đạo diễn (TMDB/AniList)',
          },
          { transaction }
        );
      }

      // 2. Partial unique index on actors (source, source_id)
      await run(
        queryInterface,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_source_identity_unique
         ON actors ((metadata->>'source'), (metadata->>'source_id'))
         WHERE deleted_at IS NULL AND metadata->>'source_id' IS NOT NULL;`,
        transaction
      );

      // 3. Partial unique index on studios (source, source_id)
      await run(
        queryInterface,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_studios_source_identity_unique
         ON studios ((metadata->>'source'), (metadata->>'source_id'))
         WHERE deleted_at IS NULL AND metadata->>'source_id' IS NOT NULL;`,
        transaction
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await run(queryInterface, `DROP INDEX IF EXISTS idx_actors_source_identity_unique;`, transaction);
      await run(queryInterface, `DROP INDEX IF EXISTS idx_studios_source_identity_unique;`, transaction);

      const moviesTable = await getTable(queryInterface, 'movies', transaction);
      if (moviesTable.director_metadata) {
        await queryInterface.removeColumn('movies', 'director_metadata', { transaction });
      }
    });
  },
};
