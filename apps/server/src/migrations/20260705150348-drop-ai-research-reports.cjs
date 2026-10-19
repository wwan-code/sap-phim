"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS "ai_research_reports" CASCADE;');
  },

  async down(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Recreate the ai_research_reports table with complete original schema
    await queryInterface.createTable("ai_research_reports", {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      job_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      movie_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "movies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      search_title: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      search_year: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      search_type: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      field_reports: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      sources_used: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      conflicts: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      ai_conflicts: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      verification_flags: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      deep_research_summary: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      overall_confidence: {
        type: DataTypes.DECIMAL(4, 3),
        allowNull: true,
      },
      review_status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
      },
      reviewed_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    // Recreate all original indexes
    await queryInterface.addIndex("ai_research_reports", ["job_id"], { unique: true });
    await queryInterface.addIndex("ai_research_reports", ["movie_id"]);
    await queryInterface.addIndex("ai_research_reports", ["user_id"]);
    await queryInterface.addIndex("ai_research_reports", ["review_status"]);
    await queryInterface.addIndex("ai_research_reports", ["created_at"]);
  },
};
