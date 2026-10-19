/**
 * @file notification.model.js
 * @module Model_Notification
 * @description Model Sequelize cho bảng notifications.
 */

import { col, DataTypes, fn, Op, where } from "sequelize";
import sequelize from "../config/database.config.js";

/**
 * @model Notification
 *
 * @property {UUID} id - ID duy nhất của thông báo
 * @property {UUID} user_id - ID người dùng nhận thông báo
 * @property {string} type - Loại thông báo (ví dụ: new_follower, system...)
 * @property {string} title - Tiêu đề ngắn gọn của thông báo
 * @property {string} message - Nội dung chi tiết thông báo
 * @property {string} icon - Biểu tượng hiển thị (Emoji hoặc tên icon)
 * @property {string} action_url - Đường dẫn hành động khi người dùng nhấn vào
 * @property {Object} action_data - Dữ liệu bổ sung cho hành động xử lý ở Frontend (JSONB)
 * @property {string} entity_type - Loại thực thể liên quan (movie, user...)
 * @property {UUID} entity_id - ID của thực thể liên quan tương ứng
 * @property {UUID} actor_id - ID người gây ra hành động (người theo dõi, người thích...)
 * @property {string} priority - Mức độ ưu tiên (low, normal, high, critical)
 * @property {string} group_key - Khóa phân nhóm dùng để gộp các thông báo cùng loại
 * @property {boolean} is_read - Trạng thái đã đọc hay chưa
 * @property {Date} read_at - Thời điểm người dùng đọc thông báo
 * @property {Date} expires_at - Thời điểm thông báo tự động hết hiệu lực
 */
const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
      comment: "ID người dùng nhận thông báo",
    },

    // Nội dung thông báo
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Loại thông báo: new_follower, comment_reply, system...",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Tiêu đề thông báo",
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Nội dung chi tiết thông báo",
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Biểu tượng đại diện hiển thị",
    },

    // Trạng thái và phân nhóm
    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "normal",
      comment: "Mức độ ưu tiên: thấp, bình thường, cao, khẩn cấp",
    },
    group_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Khóa dùng để gộp các thông báo tương tự (tránh spam)",
    },

    // Tương tác và liên kết
    action_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Đường dẫn điều hướng khi nhấn vào thông báo",
    },
    action_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Dữ liệu cấu trúc bổ sung cho Frontend",
    },

    // Thực thể liên quan và Tác nhân
    entity_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Loại đối tượng liên quan (Ví dụ: Movie)",
    },
    entity_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "ID của đối tượng liên quan",
    },
    actor_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
      comment: "ID người thực hiện hành động tạo ra thông báo này",
    },

    // Trạng thái đọc
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Đánh dấu đã đọc",
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Thời điểm người dùng thực hiện đọc",
    },

    // Thời hạn hết hiệu lực
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Thời điểm thông báo tự động hết hiệu lực và có thể bị xóa",
    },
  },
  {
    tableName: "notifications",
    timestamps: true,
    underscored: true,
    updatedAt: false,

    // Chỉ mục tối ưu hóa truy vấn
    indexes: [
      { fields: ["user_id", "created_at"] },
      { fields: ["user_id", "is_read", "created_at"] },
      { fields: ["user_id", "type", "created_at"] },
      { fields: ["expires_at"], where: { expires_at: { [Op.ne]: null } } },
      {
        fields: ["user_id", "group_key"],
        where: { group_key: { [Op.ne]: null } },
      },
    ],

    // Phạm vi truy vấn (Scopes)
    scopes: {
      unread: {
        where: { is_read: false },
      },
      byType(type) {
        return { where: { type } };
      },
      recent(days = 30) {
        return {
          where: {
            created_at: {
              [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
            },
          },
        };
      },
      notExpired: {
        where: {
          [Op.or]: [
            { expires_at: null },
            where(col("expires_at"), Op.gt, fn("NOW")),
          ],
        },
      },
    },
  },
);

export default Notification;

