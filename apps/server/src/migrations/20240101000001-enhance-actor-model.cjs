/**
 * @file 20240101000001-enhance-actor-model.cjs
 * @module Migrations_Actor
 * @description Migration nâng cấp bảng Actor với các trường mới, indexes và soft delete hỗ trợ idempotent.
 */

'use strict';

const tableExists = async (queryInterface, tableName) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const getTable = async (queryInterface, tableName) => {
  try {
    return await queryInterface.describeTable(tableName);
  } catch {
    return {};
  }
};

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition, transaction) => {
  const table = await getTable(queryInterface, tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition, { transaction });
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'actors'))) {
      console.log('[Migration] Bảng actors chưa tồn tại, bỏ qua enhance-actor-model.');
      return;
    }

    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Thêm các trường mới nếu chưa tồn tại
      await addColumnIfMissing(queryInterface, 'actors', 'slug', {
        type: Sequelize.STRING(255),
        allowNull: true,
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'nationality', {
        type: Sequelize.STRING(100),
        allowNull: true,
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'biography', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'aliases', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'metadata', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'popularity_score', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'movies_count', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'created_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'updated_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }, transaction);

      await addColumnIfMissing(queryInterface, 'actors', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      }, transaction);

      // 2. Chuyển đổi description sang biography nếu cần
      const currentTable = await getTable(queryInterface, 'actors');
      if (currentTable.description && currentTable.biography) {
        await queryInterface.sequelize.query(
          `UPDATE actors SET biography = description WHERE description IS NOT NULL AND biography IS NULL`,
          { transaction }
        );
      }

      // 3. Xử lý gender ENUM nếu cần
      await queryInterface.sequelize.query(
        `DO $$ BEGIN
          CREATE TYPE enum_actors_gender AS ENUM ('male', 'female', 'other', 'unknown');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;`,
        { transaction }
      );

      // 4. Backfill slug cho actors cũ nếu slug còn rỗng
      await queryInterface.sequelize.query(
        `UPDATE actors 
         SET slug = LOWER(REGEXP_REPLACE(
           REGEXP_REPLACE(name, '[^a-zA-Z0-9\\s-]', '', 'g'),
           '\\s+', '-', 'g'
         )) || '-' || SUBSTRING(CAST(id AS TEXT), 1, 8)
         WHERE slug IS NULL OR slug = ''`,
        { transaction }
      );

      // 5. Tạo indexes một cách an toàn (IF NOT EXISTS)
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_actors_name ON actors (name);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_slug_unique ON actors (slug) WHERE deleted_at IS NULL;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_actors_is_active ON actors (is_active);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_actors_deleted_at ON actors (deleted_at);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_actors_nationality ON actors (nationality);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_actors_gender ON actors (gender);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_actors_popularity_score ON actors (popularity_score DESC);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_actors_movies_count ON actors (movies_count DESC);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS idx_actors_created_at ON actors (created_at);`,
        { transaction }
      );

      await transaction.commit();
      console.log('[Migration] Hoàn tất nâng cấp Actor model an toàn.');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'actors'))) {
      return;
    }

    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_actors_name;', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_actors_slug_unique;', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_actors_is_active;', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_actors_deleted_at;', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_actors_nationality;', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_actors_gender;', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_actors_popularity_score;', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_actors_movies_count;', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_actors_created_at;', { transaction });

      const table = await getTable(queryInterface, 'actors');
      const columnsToRemove = [
        'slug', 'nationality', 'biography', 'aliases', 'metadata',
        'popularity_score', 'movies_count', 'is_active', 'created_by', 'updated_by', 'deleted_at'
      ];

      for (const col of columnsToRemove) {
        if (table[col]) {
          await queryInterface.removeColumn('actors', col, { transaction });
        }
      }

      await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_actors_gender;', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
