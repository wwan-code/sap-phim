/**
 * @file 20260606180000-seed-roles-permissions.cjs
 * @module Seeders
 * @description Seeder khởi tạo danh sách vai trò (Roles), quyền hạn (Permissions) và mối quan hệ (RolePermissions).
 * Sử dụng cơ chế Upsert (ON CONFLICT) để chèn mới hoặc cập nhật nếu đã tồn tại mà không làm ảnh hưởng đến dữ liệu cũ.
 */

'use strict';

const { randomUUID: uuidv4 } = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Định nghĩa vai trò (Roles)
      const rolesData = [
        { name: "Boss/Chủ sở hữu", slug: "boss", priority: 5, description: "Vai trò tối cao, sở hữu toàn bộ quyền hạn hệ thống." },
        { name: "Quản trị viên", slug: "admin", priority: 4, description: "Quản trị viên hệ thống, có hầu hết các quyền quản lý." },
        { name: "Kiểm duyệt viên", slug: "moderator", priority: 3, description: "Kiểm duyệt nội dung, quản lý phim, bình luận." },
        { name: "Thành viên VIP", slug: "premium_user", priority: 2, description: "Người dùng trả phí VIP, được xem phim đặc quyền." },
        { name: "Thành viên thường", slug: "user", priority: 1, description: "Tài khoản người dùng đăng ký miễn phí cơ bản." }
      ];

      const roleIdsMap = {};

      for (const role of rolesData) {
        const generatedId = uuidv4();
        // Thực hiện Upsert cho Roles dựa trên 'slug'
        const [result] = await queryInterface.sequelize.query(
          `INSERT INTO roles (id, name, slug, priority, description, created_at, updated_at)
           VALUES (:id, :name, :slug, :priority, :description, NOW(), NOW())
           ON CONFLICT (slug)
           DO UPDATE SET name = EXCLUDED.name, priority = EXCLUDED.priority, description = EXCLUDED.description, updated_at = NOW()
           RETURNING id;`,
          {
            replacements: { id: generatedId, ...role },
            type: queryInterface.sequelize.QueryTypes.SELECT,
            transaction
          }
        );
        roleIdsMap[role.slug] = result.id;
      }

      // 2. Định nghĩa danh sách quyền hạn (Permissions)
      const permissionsData = [
        // Movies
        { slug: "movies.view", name: "Xem phim", description: "Cho phép xem thông tin và nội dung phim", module: "movies" },
        { slug: "movies.create", name: "Thêm phim mới", description: "Cho phép thêm mới phim vào hệ thống", module: "movies" },
        { slug: "movies.edit", name: "Chỉnh sửa phim", description: "Cho phép chỉnh sửa thông tin phim", module: "movies" },
        { slug: "movies.delete", name: "Xóa phim", description: "Cho phép xóa phim khỏi hệ thống", module: "movies" },
        { slug: "movies.feature", name: "Đặc quyền nổi bật phim", description: "Cho phép đặt phim làm tiêu điểm/nổi bật", module: "movies" },

        // Users
        { slug: "users.view", name: "Xem người dùng", description: "Cho phép xem danh sách và chi tiết thông tin người dùng", module: "users" },
        { slug: "users.edit", name: "Chỉnh sửa người dùng", description: "Cho phép cập nhật thông tin người dùng", module: "users" },
        { slug: "users.ban", name: "Khóa tài khoản", description: "Cho phép cấm hoặc mở khóa tài khoản người dùng", module: "users" },
        { slug: "users.delete", name: "Xóa người dùng", description: "Cho phép xóa tài khoản người dùng khỏi hệ thống", module: "users" },
        { slug: "users.assign_roles", name: "Gán vai trò", description: "Cho phép thay đổi vai trò (phân quyền) của người dùng", module: "users" },

        // Comments
        { slug: "comments.create", name: "Tạo bình luận", description: "Cho phép viết bình luận trong các bộ phim", module: "comments" },
        { slug: "comments.edit_own", name: "Chỉnh sửa bình luận cá nhân", description: "Cho phép tự chỉnh sửa bình luận của bản thân", module: "comments" },
        { slug: "comments.delete_any", name: "Xóa bình luận bất kỳ", description: "Cho phép kiểm duyệt và xóa bình luận của người khác", module: "comments" },
        { slug: "comments.pin", name: "Ghim bình luận", description: "Cho phép ghim bình luận nổi bật lên đầu danh sách", module: "comments" },

        // Series & Episodes
        { slug: "series.view", name: "Xem bộ phim/series", description: "Cho phép xem danh sách và chi tiết bộ phim dài tập", module: "series" },
        { slug: "series.create", name: "Tạo bộ phim/series", description: "Cho phép thêm mới bộ phim dài tập", module: "series" },
        { slug: "series.edit", name: "Chỉnh sửa bộ phim/series", description: "Cho phép chỉnh sửa thông tin bộ phim dài tập", module: "series" },
        { slug: "series.delete", name: "Xóa bộ phim/series", description: "Cho phép xóa bộ phim dài tập", module: "series" },
        { slug: "episodes.view", name: "Xem tập phim", description: "Cho phép xem danh sách và chi tiết tập phim", module: "episodes" },
        { slug: "episodes.create", name: "Tạo tập phim mới", description: "Cho phép thêm mới tập phim vào series", module: "episodes" },
        { slug: "episodes.edit", name: "Chỉnh sửa tập phim", description: "Cho phép cập nhật thông tin tập phim", module: "episodes" },
        { slug: "episodes.delete", name: "Xóa tập phim", description: "Cho phép xóa tập phim khỏi series", module: "episodes" },

        // Taxonomy
        { slug: "categories.manage", name: "Quản lý danh mục", description: "Cho phép thêm/sửa/xóa các danh mục phim", module: "taxonomy" },
        { slug: "countries.manage", name: "Quản lý quốc gia", description: "Cho phép quản lý danh mục quốc gia sản xuất phim", module: "taxonomy" },
        { slug: "genres.manage", name: "Quản lý thể loại", description: "Cho phép quản lý các thể loại phim", module: "taxonomy" },
        { slug: "topics.manage", name: "Quản lý chủ đề", description: "Cho phép quản lý các chủ đề phim", module: "taxonomy" },
        { slug: "collections.manage", name: "Quản lý bộ sưu tập", description: "Cho phép quản lý các bộ sưu tập phim nổi bật", module: "taxonomy" },
        { slug: "studios.manage", name: "Quản lý hãng sản xuất", description: "Cho phép quản lý thông tin hãng sản xuất (studio)", module: "taxonomy" },
        { slug: "actors.manage", name: "Quản lý diễn viên", description: "Cho phép quản lý danh sách diễn viên", module: "taxonomy" },

        // Ratings
        { slug: "ratings.create", name: "Đánh giá phim", description: "Cho phép gửi đánh giá và số sao cho phim", module: "ratings" },

        // Wallet
        { slug: "wallet.view", name: "Xem ví tiền", description: "Cho phép xem số dư ví cá nhân", module: "wallet" },
        { slug: "wallet.adjust", name: "Điều chỉnh ví tiền", description: "Cho phép Admin cộng/trừ tiền trong ví người dùng", module: "wallet" },
        { slug: "wallet.lock", name: "Khóa ví tiền", description: "Cho phép tạm khóa ví giao dịch của người dùng", module: "wallet" },
        { slug: "wallet.unlock", name: "Mở khóa ví tiền", description: "Cho phép mở khóa ví giao dịch của người dùng", module: "wallet" },

        // Payment Requests
        { slug: "payment.view", name: "Xem yêu cầu thanh toán", description: "Cho phép xem danh sách yêu cầu nạp tiền/rút tiền", module: "payment" },
        { slug: "payment.approve", name: "Duyệt thanh toán", description: "Cho phép phê duyệt yêu cầu nạp/rút tiền", module: "payment" },
        { slug: "payment.reject", name: "Từ chối thanh toán", description: "Cho phép từ chối yêu cầu nạp/rút tiền", module: "payment" },

        // Membership Plans
        { slug: "membership_plan.read", name: "Xem gói hội viên", description: "Cho phép xem thông tin các gói hội viên", module: "membership_plan" },
        { slug: "membership_plan.create", name: "Tạo gói hội viên", description: "Cho phép thêm mới gói dịch vụ/hội viên", module: "membership_plan" },
        { slug: "membership_plan.update", name: "Cập nhật gói hội viên", description: "Cho phép sửa đổi thông tin gói dịch vụ", module: "membership_plan" },
        { slug: "membership_plan.delete", name: "Xóa gói hội viên", description: "Cho phép xóa gói dịch vụ/hội viên", module: "membership_plan" },

        // Subscriptions
        { slug: "subscriptions.view", name: "Xem đăng ký dịch vụ", description: "Cho phép xem lịch sử đăng ký gói dịch vụ", module: "subscriptions" },
        { slug: "subscriptions.create", name: "Đăng ký dịch vụ", description: "Cho phép đăng ký mới gói dịch vụ", module: "subscriptions" },
        { slug: "subscriptions.edit", name: "Chỉnh sửa đăng ký dịch vụ", description: "Cho phép chỉnh sửa thông tin đăng ký dịch vụ của người dùng", module: "subscriptions" },
        { slug: "subscriptions.delete", name: "Xóa đăng ký dịch vụ", description: "Cho phép xóa lịch sử đăng ký dịch vụ của người dùng", module: "subscriptions" },
        { slug: "subscriptions.cancel", name: "Hủy đăng ký dịch vụ", description: "Cho phép hủy gói dịch vụ đang hoạt động", module: "subscriptions" },

        // Admin & System
        { slug: "ai.manage", name: "Quản lý AI", description: "Cho phép cấu hình các mô hình và tác vụ AI", module: "admin" },
        { slug: "notifications.manage", name: "Quản lý thông báo", description: "Cho phép gửi thông báo hệ thống cho toàn bộ người dùng", module: "admin" },
        { slug: "uploads.manage", name: "Quản lý tệp tải lên", description: "Cho phép dọn dẹp và quản lý tài nguyên lưu trữ", module: "admin" },
        { slug: "admin.access", name: "Truy cập Admin", description: "Quyền cơ bản để truy cập trang quản trị", module: "admin" },
        { slug: "admin.dashboard", name: "Xem bảng điều khiển", description: "Cho phép xem báo cáo và dashboard trang quản trị", module: "admin" },
        { slug: "admin.logs", name: "Xem log hệ thống", description: "Cho phép kiểm tra log kiểm toán và nhật ký hệ thống", module: "admin" },
        { slug: "admin.settings", name: "Cấu hình hệ thống", description: "Cho phép thay đổi cài đặt cốt lõi của hệ thống", module: "admin" }
      ];

      const permissionIdsMap = {};

      for (const perm of permissionsData) {
        const generatedId = uuidv4();
        // Thực hiện Upsert cho Permissions dựa trên 'slug' (Chỉ dùng created_at)
        const [result] = await queryInterface.sequelize.query(
          `INSERT INTO permissions (id, name, slug, description, module, created_at)
           VALUES (:id, :name, :slug, :description, :module, NOW())
           ON CONFLICT (slug)
           DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, module = EXCLUDED.module
           RETURNING id;`,
          {
            replacements: { id: generatedId, ...perm },
            type: queryInterface.sequelize.QueryTypes.SELECT,
            transaction
          }
        );
        permissionIdsMap[perm.slug] = result.id;
      }

      // 3. Xóa các liên kết RolePermission cũ của các Roles này để thiết lập lại chính xác
      const roleIds = Object.values(roleIdsMap);
      await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE role_id IN (:roleIds);`,
        {
          replacements: { roleIds },
          type: queryInterface.sequelize.QueryTypes.DELETE,
          transaction
        }
      );

      // 4. Ánh xạ Role - Permission
      const allPermissionSlugs = permissionsData.map(p => p.slug);
      const adminExcluded = ["admin.settings", "users.delete"];

      const rolePermissionsMapping = {
        boss: allPermissionSlugs,
        admin: allPermissionSlugs.filter(p => !adminExcluded.includes(p)),
        moderator: [
          "movies.view", "movies.edit", "series.view", "series.create", "series.edit", "episodes.view", "episodes.create", "episodes.edit",
          "categories.manage", "countries.manage", "genres.manage", "studios.manage", "actors.manage", "users.view", "users.ban", "comments.create",
          "comments.edit_own", "comments.delete_any", "comments.pin", "ratings.create", "wallet.view",
          "payment.view", "membership_plan.read", "subscriptions.view", "subscriptions.cancel", "admin.access",
          "admin.dashboard"
        ],
        premium_user: [
          "movies.view", "comments.create", "comments.edit_own", "ratings.create", "wallet.view",
          "membership_plan.read", "subscriptions.view", "subscriptions.cancel"
        ],
        user: [
          "movies.view", "comments.create", "comments.edit_own", "ratings.create", "wallet.view",
          "membership_plan.read", "subscriptions.view", "subscriptions.cancel"
        ]
      };

      const rolePermissionRecords = [];

      for (const [roleSlug, permSlugs] of Object.entries(rolePermissionsMapping)) {
        const roleId = roleIdsMap[roleSlug];
        if (!roleId) continue;

        for (const permSlug of permSlugs) {
          const permId = permissionIdsMap[permSlug];
          if (!permId) continue;

          rolePermissionRecords.push({
            role_id: roleId,
            permission_id: permId
          });
        }
      }

      // 5. Bulk insert vào bảng role_permissions
      if (rolePermissionRecords.length > 0) {
        await queryInterface.bulkInsert('role_permissions', rolePermissionRecords, { transaction });
      }

      await transaction.commit();
      console.log('Seeding Roles, Permissions and RolePermissions completed successfully.');
    } catch (error) {
      await transaction.rollback();
      console.error('Failed to seed Roles and Permissions:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const roleSlugs = ["boss", "admin", "moderator", "premium_user", "user"];

      // Xóa liên kết RolePermission của các roles trên
      await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE slug IN (:roleSlugs));`,
        {
          replacements: { roleSlugs },
          type: queryInterface.sequelize.QueryTypes.DELETE,
          transaction
        }
      );

      // Xóa toàn bộ các Permissions được định nghĩa
      await queryInterface.sequelize.query(
        `DELETE FROM permissions;`,
        {
          type: queryInterface.sequelize.QueryTypes.DELETE,
          transaction
        }
      );

      await transaction.commit();
      console.log('Rollback permissions and role mappings successfully.');
    } catch (error) {
      await transaction.rollback();
      console.error('Failed to rollback seed data:', error);
      throw error;
    }
  }
};
