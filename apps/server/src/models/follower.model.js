/**
 * @file follower.model.js
 * @module Model_Follower
 * @description Model Sequelize cho bảng followers.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model Follower
 *
 * @property {UUID} follower_id - ID người thực hiện hành động theo dõi
 * @property {UUID} following_id - ID người được theo dõi
 */
const Follower = sequelize.define(
  "Follower",
  {
    follower_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "users",
        key: "id",
      },
      comment: "ID người thực hiện theo dõi",
    },
    following_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "users",
        key: "id",
      },
      comment: "ID người được theo dõi",
    },
  },
  {
    tableName: "followers",
    timestamps: true,
    underscored: true,
    updatedAt: false,
    indexes: [{ fields: ["follower_id"] }, { fields: ["following_id"] }],
    validate: {
      /**
       * Kiểm tra ràng buộc không tự theo dõi chính mình
       */
      notSelf() {
        if (this.follower_id === this.following_id) {
          throw new Error("Không thể tự theo dõi chính mình");
        }
      },
    },
  },
);

export default Follower;

