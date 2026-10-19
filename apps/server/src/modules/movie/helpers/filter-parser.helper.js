/**
 * Trình phân tích bộ lọc (Filter Parser Helper)
 *
 * @description Chuyển đổi các chuỗi lọc tùy chỉnh (DSL) thành các tùy chọn truy vấn của Sequelize.
 *
 * Định dạng bộ lọc: Relation|Field|Value|SortField|Limit|ExtraConditions
 *
 * Ví dụ:
 *   "country|name|Hàn Quốc|updatedAt|20|type!=movie,status!=upcoming"
 *   "|type|series|view_week|10"
 *   "category|slug|marvel|updatedAt"
 *   "genres|slug|action|createdAt|15"
 *   "regions|name|Âu Mỹ|updatedAt|20"
 *   "regions|name|Châu Á|view_week|10"
 */
import { Op } from "sequelize";
import { Country, Genre, Category, Series } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";

// ════════════════════════════════════════════════════════════════════════════
// DANH SÁCH CHO PHÉP (WHITELISTS - Đảm bảo bảo mật)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Bản đồ quan hệ: Tên quan hệ → { model, as, type }
 */
const RELATION_MAP = {
  country: { model: Country, as: "country", type: "belongsTo" },
  genres: { model: Genre, as: "genres", type: "belongsToMany" },
  category: { model: Category, as: "category", type: "belongsTo" },
  series: { model: Series, as: "series", type: "belongsTo" },
};

/**
 * Các trường được phép lọc trên các model quan hệ
 */
const RELATION_FIELD_WHITELIST = {
  country: ["name", "slug", "code"],
  genres: ["name", "slug"],
  category: ["name", "slug"],
  series: ["name", "slug"],
  regions: ["name"], // Chỉ hỗ trợ lọc theo tên vùng miền
};

/**
 * Bản đồ sắp xếp: Tên trường gửi lên → Tên cột thực tế trong DB
 */
const SORT_FIELD_MAP = {
  updatedAt: "updated_at",
  updated_at: "updated_at",
  createdAt: "created_at",
  created_at: "created_at",
  views: "views_count",
  view_week: "views_count",
  view_total: "views_count",
  views_count: "views_count",
  rating: "imdb_rating",
  imdb_rating: "imdb_rating",
  likes: "likes_count",
  likes_count: "likes_count",
  release_date: "release_date",
};

/**
 * Các trường của Movie được phép dùng trong điều kiện mở rộng (extras)
 */
const MOVIE_FIELD_WHITELIST = new Set([
  "type",
  "status",
  "is_featured",
  "is_trending",
  "is_premium",
  "age_rating",
  "tags",
]);

// ════════════════════════════════════════════════════════════════════════════
// BẢN ĐỒ VÙNG MIỀN (REGIONS MAP)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Bản đồ ánh xạ nhãn vùng miền → danh sách tên quốc gia tương ứng trong DB
 */
const REGION_MAP = {
  "âu mỹ": [
    "Mỹ",
    "Anh",
    "Pháp",
    "Đức",
    "Tây Ban Nha",
    "Ý",
    "Nga",
    "Canada",
    "Úc",
    "Hà Lan",
    "Bỉ",
    "Thụy Điển",
    "Na Uy",
    "Đan Mạch",
    "Phần Lan",
    "Thụy Sĩ",
    "Áo",
    "Ba Lan",
    "Bồ Đào Nha",
    "Hy Lạp",
    "Ireland",
    "New Zealand",
    "Mexico",
    "Brazil",
    "Argentina",
    "Colombia",
    "Chile",
    "Peru",
    "Venezuela",
    "Cuba",
    "Puerto Rico",
  ],
  "châu á": [
    "Hàn Quốc",
    "Nhật Bản",
    "Trung Quốc",
    "Việt Nam",
    "Thái Lan",
    "Đài Loan",
    "Hồng Kông",
    "Philippines",
    "Indonesia",
    "Malaysia",
    "Singapore",
    "Campuchia",
    "Lào",
    "Myanmar",
    "Brunei",
    "Ấn Độ",
    "Pakistan",
    "Bangladesh",
    "Sri Lanka",
    "Nepal",
    "Mông Cổ",
    "Kazakhstan",
    "Uzbekistan",
    "Thổ Nhĩ Kỳ",
    "Israel",
    "Ả Rập Xê Út",
    "Iran",
    "Iraq",
    "UAE",
  ],
  "đông nam á": [
    "Việt Nam",
    "Thái Lan",
    "Philippines",
    "Indonesia",
    "Malaysia",
    "Singapore",
    "Campuchia",
    "Lào",
    "Myanmar",
    "Brunei",
    "Đông Timor",
  ],
  "đông á": [
    "Hàn Quốc",
    "Nhật Bản",
    "Trung Quốc",
    "Đài Loan",
    "Hồng Kông",
    "Mông Cổ",
  ],
  "châu âu": [
    "Anh",
    "Pháp",
    "Đức",
    "Tây Ban Nha",
    "Ý",
    "Nga",
    "Hà Lan",
    "Bỉ",
    "Thụy Điển",
    "Na Uy",
    "Đan Mạch",
    "Phần Lan",
    "Thụy Sĩ",
    "Áo",
    "Ba Lan",
    "Bồ Đào Nha",
    "Hy Lạp",
    "Ireland",
    "Czech",
    "Hungary",
    "Romania",
    "Bulgaria",
    "Serbia",
    "Croatia",
    "Ukraina",
  ],
  "châu mỹ": [
    "Mỹ",
    "Canada",
    "Mexico",
    "Brazil",
    "Argentina",
    "Colombia",
    "Chile",
    "Peru",
    "Venezuela",
    "Cuba",
    "Puerto Rico",
    "Bolivia",
    "Paraguay",
    "Uruguay",
    "Ecuador",
  ],
  latin: [
    "Mexico",
    "Brazil",
    "Argentina",
    "Colombia",
    "Chile",
    "Peru",
    "Venezuela",
    "Cuba",
    "Bolivia",
    "Paraguay",
    "Uruguay",
    "Ecuador",
    "Costa Rica",
    "Panama",
    "Guatemala",
    "Honduras",
    "El Salvador",
    "Nicaragua",
    "Dominican Republic",
  ],
  "châu phi": [
    "Nam Phi",
    "Nigeria",
    "Kenya",
    "Ethiopia",
    "Ghana",
    "Tanzania",
    "Ai Cập",
    "Morocco",
    "Algeria",
    "Tunisia",
    "Angola",
    "Mozambique",
    "Cameroon",
    "Bờ Biển Ngà",
    "Senegal",
  ],
  "trung đông": [
    "Ả Rập Xê Út",
    "Iran",
    "Iraq",
    "UAE",
    "Israel",
    "Thổ Nhĩ Kỳ",
    "Kuwait",
    "Qatar",
    "Bahrain",
    "Jordan",
    "Lebanon",
    "Syria",
    "Yemen",
    "Oman",
  ],
};

/**
 * Phân giải nhãn vùng miền thành danh sách tên quốc gia
 * Hỗ trợ tìm kiếm không phân biệt hoa thường và khớp một phần.
 *
 * @param {string} regionLabel
 * @returns {string[]|null} Mảng tên quốc gia hoặc null nếu không tìm thấy
 */
const resolveRegion = (regionLabel) => {
  const normalized = regionLabel.trim().toLowerCase();

  // Tìm kiếm trực tiếp
  if (REGION_MAP[normalized]) {
    return REGION_MAP[normalized];
  }

  // Tìm kiếm gần đúng (fuzzy match)
  for (const [key, countries] of Object.entries(REGION_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return countries;
    }
  }

  return null;
};

// ════════════════════════════════════════════════════════════════════════════
// TRÌNH PHÂN TÍCH (PARSER)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Phân tích chuỗi điều kiện mở rộng thành mệnh đề 'where' của Sequelize
 * Định dạng: "field=value" hoặc "field!=value", ngăn cách bởi dấu phẩy
 *
 * @param {string} extrasStr - Chuỗi điều kiện (ví dụ: "type=series,is_featured=true")
 * @param {Object} result - Đối tượng chứa cấu trúc truy vấn Sequelize hiện tại
 */
const parseExtraConditions = (extrasStr, result) => {
  if (!extrasStr || !extrasStr.trim()) return;

  const conditions = extrasStr.split(",");

  for (const condition of conditions) {
    const trimmed = condition.trim();
    if (!trimmed) continue;

    let field, value, operator;

    // Kiểm tra toán tử != trước
    if (trimmed.includes("!=")) {
      const parts = trimmed.split("!=");
      if (parts.length !== 2) continue;
      field = parts[0].trim();
      value = parts[1].trim();
      operator = Op.ne;
    } else if (trimmed.includes("=")) {
      const parts = trimmed.split("=");
      if (parts.length !== 2) continue;
      field = parts[0].trim();
      value = parts[1].trim();
      operator = Op.eq;
    } else {
      continue;
    }

    // Chuyển đổi kiểu dữ liệu boolean từ chuỗi
    if (value === "true") value = true;
    else if (value === "false") value = false;

    // Hỗ trợ lọc trường quan hệ (ví dụ: category.slug!=anime)
    if (field.includes(".")) {
      const [relName, relField] = field.split(".");
      const relationConfig = RELATION_MAP[relName];
      const allowedFields = RELATION_FIELD_WHITELIST[relName];

      if (relationConfig && allowedFields?.includes(relField)) {
        let existingInclude = result.include.find(
          (inc) => inc.as === relationConfig.as,
        );

        if (!existingInclude) {
          existingInclude = {
            model: relationConfig.model,
            as: relationConfig.as,
            attributes: [],
            required: true,
          };
          if (relationConfig.type === "belongsToMany") {
            existingInclude.through = { attributes: [] };
          }
          result.include.push(existingInclude);
        }

        if (!existingInclude.where) existingInclude.where = {};

        if (existingInclude.where[relField]) {
          const current = existingInclude.where[relField];
          existingInclude.where[relField] = {
            [Op.and]: [
              typeof current === "object" ? current : { [Op.eq]: current },
              operator === Op.eq ? { [Op.eq]: value } : { [operator]: value },
            ],
          };
        } else {
          if (operator === Op.eq) {
            existingInclude.where[relField] = value;
          } else {
            existingInclude.where[relField] = { [operator]: value };
          }
        }
        continue;
      }
    }

    // Bảo mật: Chỉ cho phép các trường Movie đã được phê duyệt
    if (!MOVIE_FIELD_WHITELIST.has(field)) {
      logger.warn(
        `[FilterParser] Từ chối trường không xác định trong extras: "${field}"`,
      );
      continue;
    }

    // Áp dụng điều kiện lọc
    if (field === "tags") {
      const conditionExp =
        operator === Op.eq
          ? { [Op.contains]: [value] }
          : { [Op.not]: { [Op.contains]: [value] } };

      if (result.where[field]) {
        const current = result.where[field];
        result.where[field] = {
          [Op.and]: current[Op.and]
            ? [...current[Op.and], conditionExp]
            : [current, conditionExp],
        };
      } else {
        result.where[field] = conditionExp;
      }
    } else if (operator === Op.eq) {
      result.where[field] = value;
    } else {
      result.where[field] = { [operator]: value };
    }
  }
};

/**
 * Phân tích chuỗi bộ lọc DSL thành các tùy chọn truy vấn Sequelize
 *
 * @param {string} filterStr - Chuỗi bộ lọc: "Relation|Field|Value|Sort|Limit|Extras"
 * @returns {Object|null} Các tùy chọn truy vấn (where, include, order, limit) hoặc null nếu lỗi
 */
export const parseFilterString = (filterStr) => {
  try {
    if (!filterStr || typeof filterStr !== "string") {
      return null;
    }

    const parts = filterStr.split("|");

    const [
      relation = "",
      field = "",
      value = "",
      sortField = "",
      limitStr = "",
      extras = "",
    ] = parts;

    const trimmedRelation = relation.trim();
    const trimmedField = field.trim();
    const trimmedValue = value.trim();
    const trimmedSort = sortField.trim();
    const trimmedLimit = limitStr.trim();
    const trimmedExtras = extras.trim();

    const result = {
      where: {},
      include: [],
      order: [["updated_at", "DESC"]], // Sắp xếp mặc định
      limit: 20, // Giới hạn mặc định
    };

    // ── Truy vấn theo vùng miền (quan hệ ảo, ánh xạ tới model Country) ──
    if (trimmedRelation === "regions") {
      if (trimmedField && trimmedField !== "name") {
        logger.warn(
          `[FilterParser] Bộ lọc vùng miền chỉ hỗ trợ trường "name", nhận được "${trimmedField}"`,
        );
        return null;
      }

      const countryNames = resolveRegion(trimmedValue);
      if (!countryNames || countryNames.length === 0) {
        logger.warn(
          `[FilterParser] Vùng miền không xác định: "${trimmedValue}".`,
        );
        return null;
      }

      result.include.push({
        model: Country,
        as: "country",
        attributes: [],
        where: {
          name: { [Op.in]: countryNames },
        },
        required: true,
      });
    }
    // ── Truy vấn dựa trên quan hệ thực tế ──
    else if (trimmedRelation) {
      const relationConfig = RELATION_MAP[trimmedRelation];
      if (!relationConfig) {
        logger.warn(
          `[FilterParser] Quan hệ không xác định: "${trimmedRelation}"`,
        );
        return null;
      }

      // Kiểm tra trường lọc có nằm trong danh sách cho phép không
      const allowedFields = RELATION_FIELD_WHITELIST[trimmedRelation];
      if (trimmedField && !allowedFields?.includes(trimmedField)) {
        logger.warn(
          `[FilterParser] Trường "${trimmedField}" không được phép lọc cho quan hệ "${trimmedRelation}"`,
        );
        return null;
      }

      const includeEntry = {
        model: relationConfig.model,
        as: relationConfig.as,
        attributes: [],
      };

      if (trimmedField && trimmedValue) {
        includeEntry.where = { [trimmedField]: trimmedValue };
      }

      if (relationConfig.type === "belongsToMany") {
        includeEntry.through = { attributes: [] };
      }

      // required: true để lọc những phim CÓ quan hệ này
      includeEntry.required = true;

      result.include.push(includeEntry);
    }
    // ── Truy vấn trực tiếp trên các trường của Movie ──
    else if (trimmedField) {
      if (!MOVIE_FIELD_WHITELIST.has(trimmedField)) {
        logger.warn(
          `[FilterParser] Trường "${trimmedField}" không được phép lọc trên model Movie`,
        );
        return null;
      }

      if (trimmedValue) {
        if (trimmedField === "tags") {
          result.where[trimmedField] = { [Op.contains]: [trimmedValue] };
        } else {
          result.where[trimmedField] = trimmedValue;
        }
      }
    }

    // ── Sắp xếp ──
    if (trimmedSort) {
      const dbColumn = SORT_FIELD_MAP[trimmedSort];
      if (dbColumn) {
        result.order = [[dbColumn, "DESC"]];
      } else {
        logger.warn(
          `[FilterParser] Trường sắp xếp không xác định: "${trimmedSort}"`,
        );
      }
    }

    // ── Giới hạn số lượng ──
    if (trimmedLimit) {
      const parsedLimit = parseInt(trimmedLimit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        result.limit = parsedLimit;
      }
    }

    // ── Các điều kiện mở rộng ──
    if (trimmedExtras) {
      parseExtraConditions(trimmedExtras, result);
    }

    return result;
  } catch (error) {
    logger.warn("[FilterParser] Lỗi khi phân tích chuỗi lọc", {
      filterStr,
      error: error.message,
    });
    return null;
  }
};

export default parseFilterString;
