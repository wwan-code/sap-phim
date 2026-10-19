'use strict';

const { randomUUID: uuidv4 } = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const countriesData = [
        { name: "Nhật Bản", slug: "nhat-ban", code: "JP" },
        { name: "Hàn Quốc", slug: "han-quoc", code: "KR" },
        { name: "Trung Quốc", slug: "trung-quoc", code: "CN" },
        { name: "Hoa Kỳ", slug: "hoa-ky", code: "US" },
        { name: "Việt Nam", slug: "viet-nam", code: "VN" },
        { name: "Đài Loan", slug: "dai-loan", code: "TW" }
      ];

      for (const country of countriesData) {
        const generatedId = uuidv4();
        await queryInterface.sequelize.query(
          `INSERT INTO countries (id, name, slug, code, is_active, movies_count, created_at, updated_at)
           VALUES (:id, :name, :slug, :code, true, 0, NOW(), NOW())
           ON CONFLICT (slug)
           DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, updated_at = NOW();`,
          {
            replacements: { id: generatedId, ...country },
            type: queryInterface.sequelize.QueryTypes.UPSERT,
            transaction
          }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('countries', null, {});
  }
};
