"use strict";

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

const addColumnIfMissing = async (queryInterface, Sequelize, tableName, columnName, definition) => {
  const table = await getTable(queryInterface, tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const changeColumnIfExists = async (queryInterface, Sequelize, tableName, columnName, definition) => {
  const table = await getTable(queryInterface, tableName);
  if (table[columnName]) {
    await queryInterface.changeColumn(tableName, columnName, definition);
  }
};

const run = (queryInterface, sql) => queryInterface.sequelize.query(sql);

const backfillSlug = async (queryInterface, tableName, prefix) => {
  await run(
    queryInterface,
    `
    WITH computed AS (
      SELECT
        id,
        NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(name, '')), '[^a-z0-9]+', '-', 'g')), '') AS base_slug
      FROM ${tableName}
      WHERE slug IS NULL OR slug = ''
    )
    UPDATE ${tableName} AS target
    SET slug = COALESCE(computed.base_slug, '${prefix}') || '-' || SUBSTRING(target.id::text, 1, 8)
    FROM computed
    WHERE target.id = computed.id;
    `,
  );
};

const createContentIndexes = async (queryInterface, tableName, name) => {
  await run(
    queryInterface,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_slug_active_unique ON ${tableName} (slug) WHERE deleted_at IS NULL;`,
  );
  await run(queryInterface, `CREATE INDEX IF NOT EXISTS idx_${tableName}_name_search ON ${tableName} (name);`);
  await run(queryInterface, `CREATE INDEX IF NOT EXISTS idx_${tableName}_is_active_filter ON ${tableName} (is_active);`);
  await run(queryInterface, `CREATE INDEX IF NOT EXISTS idx_${tableName}_deleted_at_filter ON ${tableName} (deleted_at);`);

  if (name === "actors") {
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_actors_nationality_filter ON actors (nationality);");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_actors_gender_filter ON actors (gender);");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_actors_aliases_gin ON actors USING GIN (aliases);");
    await run(
      queryInterface,
      "CREATE INDEX IF NOT EXISTS idx_actors_popularity_filter ON actors (popularity_score DESC);",
    );
  }

  if (name === "studios") {
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_studios_country_filter ON studios (country);");
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    if (await tableExists(queryInterface, "actors")) {
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "slug", {
        type: DataTypes.STRING(255),
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "nationality", {
        type: DataTypes.STRING(100),
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "biography", {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "aliases", {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "metadata", {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "popularity_score", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "movies_count", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "is_active", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "created_by", {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "updated_by", {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await addColumnIfMissing(queryInterface, Sequelize, "actors", "deleted_at", {
        type: DataTypes.DATE,
        allowNull: true,
      });

      const actorTable = await getTable(queryInterface, "actors");
      if (actorTable.description && actorTable.biography) {
        await run(queryInterface, "UPDATE actors SET biography = description WHERE biography IS NULL AND description IS NOT NULL;");
      }

      await backfillSlug(queryInterface, "actors", "actor");
      await run(
        queryInterface,
        `
        UPDATE actors
        SET movies_count = subquery.movies_count
        FROM (
          SELECT actor_id, COUNT(DISTINCT movie_id)::int AS movies_count
          FROM movie_actors
          GROUP BY actor_id
        ) AS subquery
        WHERE actors.id = subquery.actor_id;
        `,
      );
      await changeColumnIfExists(queryInterface, Sequelize, "actors", "slug", {
        type: DataTypes.STRING(255),
        allowNull: false,
      });
      await createContentIndexes(queryInterface, "actors", "actors");
    }

    if (await tableExists(queryInterface, "studios")) {
      await addColumnIfMissing(queryInterface, Sequelize, "studios", "slug", {
        type: DataTypes.STRING(255),
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "studios", "description", {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "studios", "metadata", {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      });
      await addColumnIfMissing(queryInterface, Sequelize, "studios", "is_active", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "studios", "created_by", {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await addColumnIfMissing(queryInterface, Sequelize, "studios", "updated_by", {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await addColumnIfMissing(queryInterface, Sequelize, "studios", "deleted_at", {
        type: DataTypes.DATE,
        allowNull: true,
      });
      await backfillSlug(queryInterface, "studios", "studio");
      await changeColumnIfExists(queryInterface, Sequelize, "studios", "slug", {
        type: DataTypes.STRING(255),
        allowNull: false,
      });
      await createContentIndexes(queryInterface, "studios", "studios");
    }

    if (await tableExists(queryInterface, "series")) {
      await addColumnIfMissing(queryInterface, Sequelize, "series", "total_movies", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "series", "is_active", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "series", "created_by", {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await addColumnIfMissing(queryInterface, Sequelize, "series", "updated_by", {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await addColumnIfMissing(queryInterface, Sequelize, "series", "deleted_at", {
        type: DataTypes.DATE,
        allowNull: true,
      });
      await backfillSlug(queryInterface, "series", "series");
      await run(
        queryInterface,
        `
        UPDATE series
        SET total_movies = subquery.total_movies
        FROM (
          SELECT series_id, COUNT(id)::int AS total_movies
          FROM movies
          WHERE series_id IS NOT NULL
          GROUP BY series_id
        ) AS subquery
        WHERE series.id = subquery.series_id;
        `,
      );
      await changeColumnIfExists(queryInterface, Sequelize, "series", "slug", {
        type: DataTypes.STRING(255),
        allowNull: false,
      });
      await createContentIndexes(queryInterface, "series", "series");
    }

    if (await tableExists(queryInterface, "movie_actors")) {
      await addColumnIfMissing(queryInterface, Sequelize, "movie_actors", "role_name", {
        type: DataTypes.STRING(100),
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "movie_actors", "character_name", {
        type: DataTypes.STRING(255),
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "movie_actors", "character_image", {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "movie_actors", "cast_order", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "movie_actors", "is_main_cast", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      await addColumnIfMissing(queryInterface, Sequelize, "movie_actors", "notes", {
        type: DataTypes.TEXT,
        allowNull: true,
      });

      const movieActorTable = await getTable(queryInterface, "movie_actors");
      if (movieActorTable.role && movieActorTable.role_name) {
        await run(queryInterface, "UPDATE movie_actors SET role_name = role WHERE role_name IS NULL AND role IS NOT NULL;");
      }

      await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_movie_actors_movie_id ON movie_actors (movie_id);");
      await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_movie_actors_actor_id ON movie_actors (actor_id);");
      await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_movie_actors_movie_actor ON movie_actors (movie_id, actor_id);");
      await run(
        queryInterface,
        "CREATE INDEX IF NOT EXISTS idx_movie_actors_movie_cast_order ON movie_actors (movie_id, cast_order);",
      );
      await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_movie_actors_main_cast ON movie_actors (is_main_cast);");
    }

    if (await tableExists(queryInterface, "movies")) {
      await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_movies_studio_id ON movies (studio_id);");
      await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_movies_series_id ON movies (series_id);");
    }
  },

  async down(queryInterface) {
    await run(queryInterface, "DROP INDEX IF EXISTS idx_movies_series_id;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_movies_studio_id;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_movie_actors_main_cast;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_movie_actors_movie_cast_order;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_movie_actors_movie_actor;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_movie_actors_actor_id;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_movie_actors_movie_id;");

    await run(queryInterface, "DROP INDEX IF EXISTS idx_series_deleted_at_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_series_is_active_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_series_name_search;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_series_slug_active_unique;");

    await run(queryInterface, "DROP INDEX IF EXISTS idx_studios_country_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_studios_deleted_at_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_studios_is_active_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_studios_name_search;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_studios_slug_active_unique;");

    await run(queryInterface, "DROP INDEX IF EXISTS idx_actors_popularity_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_actors_aliases_gin;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_actors_gender_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_actors_nationality_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_actors_deleted_at_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_actors_is_active_filter;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_actors_name_search;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_actors_slug_active_unique;");

    const dropColumnIfExists = async (tableName, columnName) => {
      const table = await getTable(queryInterface, tableName);
      if (table[columnName]) await queryInterface.removeColumn(tableName, columnName);
    };

    if (await tableExists(queryInterface, "movie_actors")) {
      await dropColumnIfExists("movie_actors", "notes");
      await dropColumnIfExists("movie_actors", "is_main_cast");
      await dropColumnIfExists("movie_actors", "cast_order");
      await dropColumnIfExists("movie_actors", "character_image");
      await dropColumnIfExists("movie_actors", "character_name");
      await dropColumnIfExists("movie_actors", "role_name");
    }

    if (await tableExists(queryInterface, "series")) {
      await dropColumnIfExists("series", "deleted_at");
      await dropColumnIfExists("series", "updated_by");
      await dropColumnIfExists("series", "created_by");
      await dropColumnIfExists("series", "is_active");
      await dropColumnIfExists("series", "total_movies");
    }

    if (await tableExists(queryInterface, "studios")) {
      await dropColumnIfExists("studios", "deleted_at");
      await dropColumnIfExists("studios", "updated_by");
      await dropColumnIfExists("studios", "created_by");
      await dropColumnIfExists("studios", "is_active");
      await dropColumnIfExists("studios", "metadata");
      await dropColumnIfExists("studios", "description");
      await dropColumnIfExists("studios", "slug");
    }

    if (await tableExists(queryInterface, "actors")) {
      await dropColumnIfExists("actors", "deleted_at");
      await dropColumnIfExists("actors", "updated_by");
      await dropColumnIfExists("actors", "created_by");
      await dropColumnIfExists("actors", "is_active");
      await dropColumnIfExists("actors", "movies_count");
      await dropColumnIfExists("actors", "popularity_score");
      await dropColumnIfExists("actors", "metadata");
      await dropColumnIfExists("actors", "aliases");
      await dropColumnIfExists("actors", "biography");
      await dropColumnIfExists("actors", "nationality");
      await dropColumnIfExists("actors", "slug");
    }
  },
};
