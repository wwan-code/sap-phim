/**
 * @file grant-boss-role.js
 * @module Scripts_Grant_Boss_Role
 * @description Kịch bản cấp vai trò Boss (Quản trị tối cao) cho người dùng theo email và dọn dẹp cache phiên.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { User, Role, sequelize } from "../src/models/index.js";
import { cacheHelper, cacheConfig, getRedisClient } from "../src/config/redis.config.js";
import { ROLES } from "../src/constants/roles.constant.js";

async function grantBossRole(email) {
  try {
    console.log(`[Script][BossGrant] Bắt đầu xử lý cấp vai trò Boss cho: ${email}`);

    const bossRole = await Role.findOne({ where: { slug: ROLES.BOSS } });
    if (!bossRole) {
      throw new Error(`[Script][BossGrant] Không tìm thấy vai trò '${ROLES.BOSS}' trong cơ sở dữ liệu!`);
    }

    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: "role" }],
    });

    if (!user) {
      throw new Error(`[Script][BossGrant] Không tìm thấy người dùng có email: ${email}`);
    }

    const previousRoleSlug = user.role?.slug || "none";
    const previousRoleName = user.role?.name || "Chưa có";

    console.log(
      `[Script][BossGrant] Người dùng: ${user.username} (ID: ${user.id}) | Vai trò hiện tại: ${previousRoleName} (${previousRoleSlug})`
    );

    if (user.role_id === bossRole.id) {
      console.log(`[Script][BossGrant] Tài khoản này đã sở hữu vai trò Boss từ trước. Không cần cập nhật.`);
    } else {
      const nextTokenVersion = (user.token_version || 1) + 1;

      await User.update(
        {
          role_id: bossRole.id,
          token_version: nextTokenVersion,
        },
        { where: { id: user.id } }
      );

      console.log(
        `[Script][BossGrant] Cập nhật thành công: role_id=${bossRole.id} (${bossRole.name}), token_version=${nextTokenVersion}`
      );
    }

    // Xóa sạch cache để hệ thống nhận diện vai trò mới ngay lập tức
    console.log(`[Script][BossGrant] Đang dọn dẹp cache Redis cho người dùng...`);
    const cacheKeys = [
      `${cacheConfig.prefix.user}${user.id}`,
      `${cacheConfig.prefix.profile}${user.id}`,
      `me:${user.id}`,
      `entitlement:${user.id}`,
    ];

    await Promise.all(cacheKeys.map((key) => cacheHelper.del(key).catch(() => {})));
    console.log(`[Script][BossGrant] Dọn dẹp cache hoàn tất.`);

    // Đọc lại để kiểm tra xác nhận
    const updatedUser = await User.findOne({
      where: { id: user.id },
      include: [{ model: Role, as: "role" }],
    });

    console.log(`[Script][BossGrant] XÁC NHẬN TRẠNG THÁI MỚI:`);
    console.log(` - User ID: ${updatedUser.id}`);
    console.log(` - Username: ${updatedUser.username}`);
    console.log(` - Email: ${updatedUser.email}`);
    console.log(` - Role ID: ${updatedUser.role_id}`);
    console.log(` - Role Name: ${updatedUser.role?.name}`);
    console.log(` - Role Slug: ${updatedUser.role?.slug}`);
    console.log(` - Token Version: ${updatedUser.token_version}`);
  } catch (error) {
    console.error(`[Script][BossGrant] Thao tác thất bại:`, error);
    process.exitCode = 1;
  } finally {
    try {
      const client = getRedisClient();
      await client.quit();
    } catch (_) {}
    await sequelize.close();
    process.exit(process.exitCode || 0);
  }
}

const targetEmail = process.argv[2] || "contact.wwan@gmail.com";
grantBossRole(targetEmail);
