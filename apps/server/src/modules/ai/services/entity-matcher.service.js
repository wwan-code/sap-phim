/**
 * @file entity-matcher.service.js
 * @module AI_Entity_Matcher
 * @description Đối soát và liên kết thông minh các thực thể (Genres, Countries, Studios, Series, Actors) với PostgreSQL.
 */

import { Op } from "sequelize";
import { Genre, Country, Category, Studio, Series, Actor } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { normalizeTitle } from "./movie-identity.util.js";

// Bảng ánh xạ Thể loại tiếng Anh ↔ tiếng Việt
const GENRE_TRANSLATION_MAP = {
  action: "Hành Động",
  adventure: "Phiêu Lưu",
  animation: "Phim Hoạt Hình",
  anime: "Phim Hoạt Hình",
  comedy: "Hài Hước",
  crime: "Tội Phạm",
  documentary: "Tài Liệu",
  drama: "Tâm Lý / Chính Kịch",
  family: "Gia Đình",
  fantasy: "Kỳ Ảo",
  history: "Lịch Sử",
  horror: "Kinh Dị",
  music: "Âm Nhạc",
  mystery: "Bí Ẩn",
  romance: "Lãng Mạn / Tình Cảm",
  "sci-fi": "Khoa Học Viễn Tưởng",
  "science fiction": "Khoa Học Viễn Tưởng",
  supernatural: "Siêu Nhiên",
  thriller: "Gây Cấn",
  war: "Chiến Tranh",
  western: "Viễn Tây",
  "slice of life": "Đời Thường",
  shounen: "Thiếu Niên / Shounen",
  isekai: "Chuyển Sinh / Isekai",
  mecha: "Robot / Mecha",
  sports: "Thể Thao",
  twins: "Cặp Song Sinh",
};

// Bảng ánh xạ Quốc gia
const COUNTRY_MAP = {
  japan: "Nhật Bản",
  jp: "Nhật Bản",
  japanese: "Nhật Bản",
  "united states": "Mỹ",
  usa: "Mỹ",
  us: "Mỹ",
  korea: "Hàn Quốc",
  "south korea": "Hàn Quốc",
  kr: "Hàn Quốc",
  china: "Trung Quốc",
  cn: "Trung Quốc",
  vietnam: "Việt Nam",
  vn: "Việt Nam",
};

class EntityMatcherService {
  /**
   * Tải toàn bộ danh mục tham chiếu từ Database
   * @returns {Promise<Object>}
   */
  async loadDatabaseEntities() {
    try {
      const [genres, countries, categories, studios] = await Promise.all([
        Genre.findAll({ attributes: ["id", "name", "slug"] }),
        Country.findAll({ attributes: ["id", "name", "slug"] }),
        Category.findAll({ attributes: ["id", "name", "slug"] }),
        Studio.findAll({ attributes: ["id", "name", "slug"] }),
      ]);

      const result = {
        genres: genres.map((g) => g.toJSON()),
        countries: countries.map((c) => c.toJSON()),
        categories: categories.map((c) => c.toJSON()),
        studios: studios.map((s) => s.toJSON()),
      };

      logger.info(
        `[AI Matcher] Đã nạp CSDL tham chiếu: ${result.genres.length} Thể loại, ` +
        `${result.countries.length} Quốc gia, ${result.studios.length} Studios, ${result.categories.length} Danh mục`
      );

      return result;
    } catch (err) {
      logger.error(`[AI Matcher] Lỗi tải database entities: ${err.message}`);
      return { genres: [], countries: [], categories: [], studios: [] };
    }
  }

  /**
   * Khớp danh sách thể loại từ Evidence với Database genres
   *
   * @param {Array<string>} rawGenres
   * @param {Array<Object>} dbGenres
   * @returns {Array<string>} genre UUIDs
   */
  matchGenres(rawGenres = [], dbGenres = []) {
    if (!Array.isArray(rawGenres) || rawGenres.length === 0) return [];

    const matchedIds = new Set();
    const matchedNames = [];

    rawGenres.forEach((raw) => {
      if (typeof raw !== "string" || !raw.trim()) return;
      const normalizedRaw = raw.trim().toLowerCase();
      const viName = GENRE_TRANSLATION_MAP[normalizedRaw] || raw;

      const found = dbGenres.find(
        (g) =>
          normalizeTitle(g.name) === normalizeTitle(normalizedRaw) ||
          normalizeTitle(g.name) === normalizeTitle(viName) ||
          (g.slug && normalizeTitle(g.slug) === normalizeTitle(normalizedRaw))
      );

      if (found && !matchedIds.has(found.id)) {
        matchedIds.add(found.id);
        matchedNames.push(found.name);
      }
    });

    if (matchedNames.length > 0) {
      logger.info(`[AI Matcher] Khớp thành công ${matchedNames.length} Thể loại: [${matchedNames.join(", ")}]`);
    } else {
      logger.warn(`[AI Matcher] Không tìm thấy Thể loại phù hợp từ danh sách thô (${rawGenres.length} mục)`);
    }

    return Array.from(matchedIds);
  }

  /**
   * Khớp Quốc gia từ Evidence với Database countries
   *
   * @param {string} rawCountry
   * @param {Array<Object>} dbCountries
   * @returns {string|null} country UUID
   */
  matchCountry(rawCountry = "", dbCountries = []) {
    if (typeof rawCountry !== "string" || !rawCountry.trim()) return null;
    const normalized = rawCountry.trim().toLowerCase();
    const mappedName = COUNTRY_MAP[normalized] || rawCountry;

    const found = dbCountries.find(
      (c) =>
        c.name.toLowerCase() === normalized ||
        c.name.toLowerCase() === mappedName.toLowerCase() ||
        (c.slug && normalizeTitle(normalized) === normalizeTitle(c.slug))
    );

    if (found) {
      logger.info(`[AI Matcher] Khớp Quốc gia: "${found.name}" (từ nguồn: "${rawCountry}")`);
      return found.id;
    }

    logger.warn(`[AI Matcher] Không thể khớp Quốc gia từ chuỗi: "${rawCountry}"`);
    return null;
  }

  /**
   * Khớp Studio từ Evidence với Database studios
   *
   * @param {Array<string>|string} rawStudios
   * @param {Array<Object>} dbStudios
   * @returns {string|null} studio UUID
   */
  matchStudio(rawStudios = [], dbStudios = []) {
    const list = Array.isArray(rawStudios) ? rawStudios : [rawStudios];
    for (const raw of list) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      const normalized = raw.trim().toLowerCase();
      const found = dbStudios.find(
        (s) =>
          normalizeTitle(s.name) === normalizeTitle(normalized)
      );
      if (found) {
        logger.info(`[AI Matcher] Khớp Studio: "${found.name}" (ID: ${found.id})`);
        return found.id;
      }
    }
    logger.info(`[AI][Matcher] Studio chưa có trong CSDL; giữ tên nguồn để quản trị viên kiểm tra.`);
    return null;
  }

  /**
   * Khớp danh sách diễn viên và nhân vật với bảng actors
   *
   * @param {Array<Object>} castList
   * @returns {Promise<Array<Object>>}
   */
  async matchActors(castList = []) {
    if (!Array.isArray(castList) || castList.length === 0) return [];

    const actorNames = castList
      .map((c) => (c.actor_name || c.name || "").trim())
      .filter(Boolean);

    if (actorNames.length === 0) return [];

    // Truy vấn tất cả diễn viên khớp tên trong DB
    const existingActors = await Actor.findAll({
      where: {
        [Op.or]: actorNames.map((name) => ({ name: { [Op.iLike]: name.replace(/[\\%_]/g, "\\$&") } })),
      },
      attributes: ["id", "name", "image_url"],
    });

    const actorMap = new Map();
    existingActors.forEach((a) => {
      actorMap.set(a.name.toLowerCase(), a);
    });

    let existingCount = 0;
    let newCount = 0;

    const mappedCast = castList.map((item, idx) => {
      const name = (item.actor_name || item.name || "").trim();
      const existing = actorMap.get(name.toLowerCase());
      if (existing) existingCount++;
      else newCount++;

      return {
        actor_id: existing ? existing.id : null,
        actor_name: name,
        actor_image_url: existing?.image_url || item.actor_image_url || item.image_url || null,
        character_name: (item.character_name || item.character || "").trim(),
        role_name: item.role_name || "Lồng tiếng",
        is_main_cast: Boolean(item.is_main_cast),
        cast_order: Number(item.cast_order ?? idx),
        is_new: !existing,
      };
    });

    logger.info(`[AI Matcher] Đối soát Diễn viên/Lồng tiếng: Khớp sẵn ${existingCount} diễn viên trong CSDL, ${newCount} diễn viên mới`);
    return mappedCast;
  }

  /**
   * Tìm kiếm Series cha dựa trên tiêu đề tác phẩm
   *
   * @param {string} title
   * @returns {Promise<string|null>} series UUID
   */
  async matchSeries(title = "", { includeDetails = false } = {}) {
    if (!title) return null;

    // Only an exact franchise name can create an automatic relationship.
    const cleanBaseName = title.trim();

    if (cleanBaseName.length < 3) return null;

    const series = await Series.findOne({
      where: {
        name: {
          [Op.iLike]: cleanBaseName.replace(/[\\%_]/g, "\\$&"),
        },
      },
      attributes: ["id", "name"],
    });

    if (series) {
      logger.info(`[AI Matcher] Phát hiện Series cha liên quan: "${series.name}" (ID: ${series.id})`);
      return includeDetails ? { id: series.id, name: series.name } : series.id;
    }

    logger.info(`[AI Matcher] Không tìm thấy Series cha (tác phẩm độc lập hoặc series mới)`);
    return null;
  }
}

export const entityMatcher = new EntityMatcherService();
export default entityMatcher;
