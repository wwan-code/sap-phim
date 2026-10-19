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

    await createTableIfMissing(queryInterface, "broadcast_schedules", {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      movie_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "movies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        unique: true
      },
      timezone: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "UTC" },
      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "active",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await createTableIfMissing(queryInterface, "release_rules", {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      schedule_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "broadcast_schedules", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "weekly",
      },
      day_of_week: { type: DataTypes.INTEGER, allowNull: true },
      release_time: { type: DataTypes.TIME, allowNull: true },
      specific_date: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await createTableIfMissing(queryInterface, "broadcast_calendars", {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      schedule_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "broadcast_schedules", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "episodes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      episode_number: { type: DataTypes.INTEGER, allowNull: false },
      release_time: { type: DataTypes.DATE, allowNull: false },
      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "upcoming",
      },
      is_exception: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await run(queryInterface, "CREATE INDEX IF NOT EXISTS idx_broadcast_calendars_status_time ON broadcast_calendars (status, release_time);");
    await run(queryInterface, "CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_calendars_episode ON broadcast_calendars (episode_id) WHERE episode_id IS NOT NULL;");
  },

  async down(queryInterface) {
    await run(queryInterface, "DROP INDEX IF EXISTS idx_broadcast_calendars_episode;");
    await run(queryInterface, "DROP INDEX IF EXISTS idx_broadcast_calendars_status_time;");
    await queryInterface.dropTable("broadcast_calendars");
    await queryInterface.dropTable("release_rules");
    await queryInterface.dropTable("broadcast_schedules");
  },
};
