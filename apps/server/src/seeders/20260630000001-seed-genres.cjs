'use strict';

const { randomUUID: uuidv4 } = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const genresData = [
        { name: "Hành Động", slug: "hanh-dong" },
        { name: "Phiêu Lưu", slug: "phieu-luu" },
        { name: "Hài Hước", slug: "hai-huoc" },
        { name: "Kịch Tính", slug: "kich-tinh" },
        { name: "Viễn Tưởng", slug: "vien-tuong" },
        { name: "Kinh Dị", slug: "kinh-di" },
        { name: "Lãng Mạn", slug: "lang-man" },
        { name: "Kỳ Ảo", slug: "ky-ao" },
        { name: "Đời Thường", slug: "doi-thuong" },
        { name: "Phép Thuật", slug: "phep-thuat" },
        { name: "Học Đường", slug: "hoc-duong" },
        { name: "Thế Giới Khác", slug: "the-gioi-khac" },
        { name: "Thể Thao", slug: "the-thao" },
        { name: "Siêu Nhiên", slug: "sieu-nhien" },
        { name: "Trinh Thám", slug: "trinh-tham" },
        { name: "Âm Nhạc", slug: "am-nhac" },
        { name: "Võ Thuật", slug: "vo-thuat" },
        { name: "Gia Đình", slug: "gia-dinh" },
        { name: "Cổ Trang", slug: "co-trang" },
        { name: "Bách Hợp", slug: "bach-hop" },
        { name: "Đam Mỹ", slug: "dam-my" },
        { name: "Mecha", slug: "mecha" },
        { name: "Lịch Sử", slug: "lich-su" },
        { name: "Tâm Lý", slug: "tam-ly" },
        { name: "Trò Chơi", slug: "tro-choi" }
      ];

      for (const genre of genresData) {
        const generatedId = uuidv4();
        await queryInterface.sequelize.query(
          `INSERT INTO genres (id, name, slug, description, is_active, movies_count, created_at, updated_at)
           VALUES (:id, :name, :slug, null, true, 0, NOW(), NOW())
           ON CONFLICT (slug)
           DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();`,
          {
            replacements: { id: generatedId, ...genre },
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
    await queryInterface.bulkDelete('genres', null, {});
  }
};
