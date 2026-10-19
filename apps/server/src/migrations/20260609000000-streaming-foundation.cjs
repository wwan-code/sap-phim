"use strict";

const tableExists = async (queryInterface, tableName) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const createTableIfMissing = async (queryInterface, tableName, definition, options = {}) => {
  if (!(await tableExists(queryInterface, tableName))) {
    await queryInterface.createTable(tableName, definition, options);
  }
};

const run = (queryInterface, sql) => queryInterface.sequelize.query(sql);

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    await createTableIfMissing(queryInterface, "watch_histories", {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      movie_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "movies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "episodes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      position_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      duration_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      progress_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      last_watched_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await createTableIfMissing(queryInterface, "watchlists", {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      movie_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "movies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: {
        type: DataTypes.ENUM("planned", "watching", "completed", "favorite"),
        allowNull: false,
        defaultValue: "planned",
      },
      is_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      note: { type: DataTypes.STRING(500), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await createTableIfMissing(queryInterface, "ratings", {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      movie_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "movies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "episodes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      score: { type: DataTypes.INTEGER, allowNull: false },
      review: { type: DataTypes.TEXT, allowNull: true },
      is_spoiler: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await createTableIfMissing(queryInterface, "comments", {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      movie_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "movies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "episodes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      parent_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "comments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      content: { type: DataTypes.TEXT, allowNull: false },
      is_spoiler: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      like_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("visible", "hidden", "deleted", "pending"),
        allowNull: false,
        defaultValue: "visible",
      },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await run(queryInterface, "CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_histories_user_episode ON watch_histories (user_id, episode_id);");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_watch_histories_user_recent ON watch_histories (user_id, last_watched_at DESC);");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_watch_histories_movie ON watch_histories (movie_id);");
    await run(queryInterface, "CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlists_user_movie ON watchlists (user_id, movie_id);");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_watchlists_user_status ON watchlists (user_id, status);");
    await run(queryInterface, "CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_user_movie_episode ON ratings (user_id, movie_id, COALESCE(episode_id, '00000000-0000-0000-0000-000000000000'::uuid));");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_ratings_movie ON ratings (movie_id);");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_comments_movie_created ON comments (movie_id, created_at DESC);");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_comments_episode_created ON comments (episode_id, created_at DESC);");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_movies_public_catalog ON movies (is_published, status, release_date DESC);");
    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_episodes_public_playback ON episodes (movie_id, publish_state, episode_number);");
  },

  async down(queryInterface) {
    await run(queryInterface, "DROP INDEX IF EXISTS idx_episodes_public_playback;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_movies_public_catalog;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_comments_episode_created;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_comments_movie_created;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_ratings_movie;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_ratings_user_movie_episode;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_watchlists_user_status;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_watchlists_user_movie;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_watch_histories_movie;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_watch_histories_user_recent;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_watch_histories_user_episode;");
    await queryInterface.dropTable("comments");
    await queryInterface.dropTable("ratings");
    await queryInterface.dropTable("watchlists");
    await queryInterface.dropTable("watch_histories");
    await run(queryInterface, "DROP TYPE IF EXISTS enum_comments_status;");
    await run(queryInterface, "DROP TYPE IF EXISTS enum_watchlists_status;");
  },
};
