/**
 * @file sync-taxonomies-slugs.js
 * @module Scripts_Sync_Taxonomies_Slugs
 * @description Script quét và tự động chuẩn hóa slug cho Genre, Category, Country, Actor, Studio, Series khi slug bị lệch so với name.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Op } from "sequelize";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Genre, Category, Country, Actor, Studio, Series, sequelize } from "../src/models/index.js";
import { slugify } from "../src/utils/slugify.util.js";

async function generateUniqueFallbackSlug(Model, baseSlug, currentId) {
  let slug = baseSlug;
  let count = 0;
  while (true) {
    const existing = await Model.findOne({
      where: {
        slug,
        id: { [Op.ne]: currentId },
      },
      paranoid: false,
    });
    if (!existing) return slug;
    count += 1;
    slug = `${baseSlug}-${count}`;
  }
}

async function syncModelSlugs(Model, modelName) {
  console.log(`\n========================================`);
  console.log(`[Sync] Đang kiểm tra bảng: ${modelName}...`);
  console.log(`========================================`);

  const records = await Model.findAll({ paranoid: false });
  let fixedCount = 0;

  for (const record of records) {
    if (!record.name) continue;

    const expectedSlug = slugify(record.name);
    if (record.slug !== expectedSlug) {
      // Tìm slug duy nhất (phòng trường hợp trùng với bản ghi khác)
      const uniqueSlug = await generateUniqueFallbackSlug(Model, expectedSlug, record.id);

      console.log(
        `[${modelName}] Cập nhật ID: ${record.id} | Name: "${record.name}" | Cũ: "/${record.slug}" -> Mới: "/${uniqueSlug}"`
      );

      await record.update({ slug: uniqueSlug });
      fixedCount++;
    }
  }

  console.log(`=> Hoàn thành [${modelName}]: ${fixedCount}/${records.length} bản ghi đã được đồng bộ slug.`);
  return fixedCount;
}

async function main() {
  try {
    console.log("[Sync] Bắt đầu kiểm tra kết nối DB...");
    await sequelize.authenticate();
    console.log("[Sync] Kết nối DB thành công!");

    let totalFixed = 0;
    totalFixed += await syncModelSlugs(Genre, "Genre");
    totalFixed += await syncModelSlugs(Category, "Category");
    totalFixed += await syncModelSlugs(Country, "Country");
    totalFixed += await syncModelSlugs(Actor, "Actor");
    totalFixed += await syncModelSlugs(Studio, "Studio");
    totalFixed += await syncModelSlugs(Series, "Series");

    console.log(`\n🎉 TẤT CẢ ĐÃ HOÀN TẤT! Tổng cộng ${totalFixed} bản ghi đã được sửa slug.`);
  } catch (error) {
    console.error("[Sync] Lỗi trong quá trình đồng bộ:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
    console.log("[Sync] Đã đóng kết nối cơ sở dữ liệu.");
  }
}

main();
