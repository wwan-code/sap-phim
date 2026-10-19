/**
 * @file movie-actor.model.js
 * @module Model_MovieActor
 * @description Model Sequelize cho bảng movie_actors.
 */

import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.config.js";

const MovieActor = sequelize.define(
  "MovieActor",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    movie_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "movies",
        key: "id",
      },
    },
    actor_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "actors",
        key: "id",
      },
    },
    role: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    role_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    character_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    character_image: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cast_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_main_cast: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "movie_actors",
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    indexes: [
      { fields: ["movie_id"], name: "idx_movie_actors_movie_id" },
      { fields: ["actor_id"], name: "idx_movie_actors_actor_id" },
      { fields: ["movie_id", "actor_id"], name: "idx_movie_actors_movie_actor" },
      { fields: ["movie_id", "cast_order"], name: "idx_movie_actors_movie_cast_order" },
      { fields: ["is_main_cast"], name: "idx_movie_actors_is_main_cast" },
    ],
  },
);

export default MovieActor;
