/**
 * @file friendship.model.js
 * @module Model_Friendship
 * @description Model Sequelize cho bảng friendships.
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model Friendship
 *
 * @property {UUID} id - ID duy nhất của bản ghi quan hệ
 * @property {UUID} requester_id - ID người gửi lời mời hoặc người thực hiện hành động chặn
 * @property {UUID} addressee_id - ID người nhận lời mời hoặc đối tượng bị chặn
 * @property {string} status - Trạng thái quan hệ (pending, accepted, rejected, blocked)
 * @property {UUID} blocker_id - ID người thực hiện hành động chặn (chỉ dùng khi status = blocked)
 * @property {string} message - Lời nhắn gửi kèm khi kết bạn (tối đa 200 ký tự)
 * @property {Date} accepted_at - Thời điểm chấp nhận kết bạn
 * @property {Date} rejected_at - Thời điểm từ chối lời mời
 * @property {Date} blocked_at - Thời điểm thực hiện hành động chặn
 */
const Friendship = sequelize.define(
  "Friendship",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Các trường dữ liệu cốt lõi
    requester_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      comment: "ID người khởi tạo mối quan hệ",
    },
    addressee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      comment: "ID đối tượng của mối quan hệ",
    },

    // Trạng thái quan hệ
    status: {
      type: DataTypes.ENUM("pending", "accepted", "rejected", "blocked"),
      defaultValue: "pending",
      allowNull: false,
      comment: "Trạng thái: pending, accepted, rejected, blocked",
    },

    // Theo dõi việc chặn
    blocker_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      comment: "ID người thực hiện hành động chặn",
    },

    // Lời nhắn đính kèm
    message: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "Lời nhắn gửi kèm lời mời kết bạn",
    },

    // Mốc thời gian (Milestones)
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Thời điểm trở thành bạn bè",
    },
    rejected_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Thời điểm từ chối lời mời",
    },
    blocked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Thời điểm thực hiện chặn",
    },
  },
  {
    tableName: "friendships",
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    paranoid: false, // Xóa cứng dữ liệu khi hủy kết bạn

    indexes: [
      { fields: ["requester_id"] },
      { fields: ["addressee_id"] },
      { fields: ["requester_id", "status"] },
      { fields: ["addressee_id", "status"] },
      { fields: ["blocker_id"] },
      /**
       * LƯU Ý: Ràng buộc duy nhất cho cặp (requester_id, addressee_id)
       * Cần được tạo trong Migration bằng SQL:
       * CREATE UNIQUE INDEX friendships_pair_unique ON friendships (
       *   LEAST(requester_id, addressee_id),
       *   GREATEST(requester_id, addressee_id)
       * );
       */
    ],

    validate: {
      /**
       * Kiểm tra ràng buộc không tự kết bạn với chính mình
       */
      notSelf() {
        if (this.requester_id === this.addressee_id) {
          throw new Error("Không thể kết bạn với chính mình");
        }
      },
    },
  },
);

// Sự kiện hệ thống (Hooks)

/**
 * Tự động cập nhật các mốc thời gian khi thay đổi trạng thái
 */
Friendship.beforeUpdate((friendship) => {
  if (friendship.changed("status")) {
    const now = new Date();
    switch (friendship.status) {
      case "accepted":
        friendship.accepted_at = now;
        break;
      case "rejected":
        friendship.rejected_at = now;
        friendship.message = null; // Xóa lời nhắn khi lời mời bị từ chối
        break;
      case "blocked":
        friendship.blocked_at = now;
        break;
    }
  }
});

// Phương thức tiện ích (Static Methods)

/**
 * Tạo mệnh đề WHERE để tìm quan hệ giữa hai người dùng bất kể vai trò gửi/nhận
 *
 * @param {UUID} userA - ID người dùng A
 * @param {UUID} userB - ID người dùng B
 * @param {Object} Op - Các toán tử Sequelize
 * @returns {Object} Mệnh đề where
 */
Friendship.pairWhere = function (userA, userB, Op) {
  return {
    [Op.or]: [
      { requester_id: userA, addressee_id: userB },
      { requester_id: userB, addressee_id: userA },
    ],
  };
};

/**
 * Kiểm tra xem quan hệ giữa hai người dùng có đang bị chặn hay không
 *
 * @param {UUID} viewerId - ID người xem
 * @param {UUID} targetId - ID đối tượng đích
 * @param {Object} Op - Các toán tử Sequelize
 * @returns {Promise<boolean>} True nếu một trong hai bên đã chặn bên kia
 */
Friendship.isBlocked = async function (viewerId, targetId, Op) {
  const row = await Friendship.findOne({
    where: {
      ...Friendship.pairWhere(viewerId, targetId, Op),
      status: "blocked",
    },
    attributes: ["id"],
  });
  return !!row;
};

export default Friendship;

