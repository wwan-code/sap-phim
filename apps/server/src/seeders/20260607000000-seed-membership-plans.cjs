/**
 * @file 20260607000000-seed-membership-plans.cjs
 * @module Seeders
 * @description Seeder khởi tạo các gói hội viên (Membership Plans) bao gồm Plus, Pro và Ultra.
 * Sử dụng cơ chế Upsert (ON CONFLICT) để chèn mới hoặc cập nhật nếu gói đã tồn tại.
 */

'use strict';

const { randomUUID: uuidv4 } = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const membershipPlans = [
        {
          tier: "free",
          tier_level: 0,
          name: "Sạp Miễn phí",
          slug: "mien-phi",
          description: "Trải nghiệm xem phim cơ bản miễn phí.",
          tagline: "Trải nghiệm cơ bản",
          price_monthly: 0,
          price_yearly: 0,
          currency: "VND",
          features: JSON.stringify({
            max_quality: "full_hd",
            watch_together_limit: 2,
            offline_download: false,
            priority_support: false,
            max_devices: 1,
            custom_avatar: false,
            custom_cover: false,
            premium_avatar_frame: false,
            premium_name_effect: false,
            permanent_storage: false,
          }),
          display_order: 0,
          badge_color: "#9E9E9E",
          icon_name: "Info",
          is_popular: false,
          is_active: true,
        },
        {
          tier: "plus",
          tier_level: 1,
          name: "Sạp Plus",
          slug: "plus",
          description: "Nâng tầm trải nghiệm xem phim với chất lượng cao và tính năng mở rộng.",
          tagline: "Nâng tầm trải nghiệm",
          price_monthly: 49000,
          price_yearly: 490000,
          currency: "VND",
          features: JSON.stringify({
            max_quality: "2k",
            watch_together_limit: 10,
            offline_download: true,
            priority_support: true,
            max_devices: 2,
            custom_avatar: true,
            custom_cover: false,
            premium_avatar_frame: false,
            premium_name_effect: false,
            permanent_storage: false,
          }),
          display_order: 1,
          badge_color: "#4285F4",
          icon_name: "Sparkles",
          is_popular: false,
          is_active: true,
        },
        {
          tier: "pro",
          tier_level: 2,
          name: "Sạp Pro",
          slug: "pro",
          description: "Trải nghiệm đỉnh cao với 4K, Watch Together mở rộng và đặc quyền VIP.",
          tagline: "Trải nghiệm đỉnh cao",
          price_monthly: 99000,
          price_yearly: 990000,
          currency: "VND",
          features: JSON.stringify({
            max_quality: "4k",
            watch_together_limit: 18,
            offline_download: true,
            priority_support: true,
            max_devices: 4,
            custom_avatar: true,
            custom_cover: true,
            premium_avatar_frame: true,
            premium_name_effect: true,
            permanent_storage: false,
          }),
          display_order: 2,
          badge_color: "#FF6D00",
          icon_name: "Crown",
          is_popular: true,
          is_active: true,
        },
        {
          tier: "ultra",
          tier_level: 3,
          name: "Sạp Ultra",
          slug: "ultra",
          description: "Tận hưởng mọi đặc quyền cao cấp nhất — 4K HDR, 36 người Watch Together và nhiều hơn nữa.",
          tagline: "Không giới hạn",
          price_monthly: 199000,
          price_yearly: 1990000,
          currency: "VND",
          features: JSON.stringify({
            max_quality: "4k",
            watch_together_limit: 36,
            offline_download: true,
            priority_support: true,
            max_devices: 6,
            custom_avatar: true,
            custom_cover: true,
            premium_avatar_frame: true,
            premium_name_effect: true,
            permanent_storage: true,
          }),
          display_order: 3,
          badge_color: "#9C27B0",
          icon_name: "Gem",
          is_popular: false,
          is_active: true,
        },
      ];

      for (const plan of membershipPlans) {
        const generatedId = uuidv4();
        await queryInterface.sequelize.query(
          `INSERT INTO membership_plans (
            id, tier, tier_level, name, slug, description, tagline,
            price_monthly, price_yearly, currency, features,
            display_order, badge_color, icon_name, is_popular, is_active,
            created_at, updated_at
          ) VALUES (
            :id, :tier, :tier_level, :name, :slug, :description, :tagline,
            :price_monthly, :price_yearly, :currency, CAST(:features AS jsonb),
            :display_order, :badge_color, :icon_name, :is_popular, :is_active,
            NOW(), NOW()
          ) ON CONFLICT (tier) DO UPDATE SET
            tier_level = EXCLUDED.tier_level,
            name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            description = EXCLUDED.description,
            tagline = EXCLUDED.tagline,
            price_monthly = EXCLUDED.price_monthly,
            price_yearly = EXCLUDED.price_yearly,
            currency = EXCLUDED.currency,
            features = EXCLUDED.features,
            display_order = EXCLUDED.display_order,
            badge_color = EXCLUDED.badge_color,
            icon_name = EXCLUDED.icon_name,
            is_popular = EXCLUDED.is_popular,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();`,
          {
            replacements: { id: generatedId, ...plan },
            type: queryInterface.sequelize.QueryTypes.INSERT,
            transaction
          }
        );
      }

      await transaction.commit();
      console.log('Seed membership plans successfully.');
    } catch (error) {
      await transaction.rollback();
      console.error('Failed to seed membership plans:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `DELETE FROM membership_plans WHERE tier IN ('free', 'plus', 'pro', 'ultra');`,
        {
          type: queryInterface.sequelize.QueryTypes.DELETE,
          transaction
        }
      );
      await transaction.commit();
      console.log('Rollback membership plans successfully.');
    } catch (error) {
      await transaction.rollback();
      console.error('Failed to rollback membership plans:', error);
      throw error;
    }
  }
};
