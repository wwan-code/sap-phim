/**
 * Hỗ trợ cấu hình Trang chủ (Home Config Helper)
 * 
 * @description Chứa các hằng số, thuật toán xếp hạng và các hàm tiện ích để cấu hình trang chủ thông minh.
 * Hệ thống lấy cảm hứng từ cơ chế xếp hạng của Netflix và Bilibili.
 */

import { Op } from "sequelize";
import { Genre, Country } from "../../../models/index.js";

// ════════════════════════════════════════════════════════════════════════════
// HẰNG SỐ CẤU HÌNH
// ════════════════════════════════════════════════════════════════════════════

/**
 * HOME_CONFIG_RULES - Cấu hình tập trung cho toàn bộ trang chủ
 * Bao gồm các giới hạn, trọng số và ngưỡng tính toán.
 */
export const HOME_CONFIG_RULES = {
  // Giới hạn số lượng phim trong mỗi phần
  limits: {
    hero: 5,                // Số phim hiển thị trên biểu ngữ chính
    heroPool: 20,           // Số lượng ứng viên tối đa cho biểu ngữ chính
    topRanking: 10,         // Số phim hiển thị trong bảng xếp hạng
    topRankingPool: 30,     // Số lượng ứng viên tối đa cho bảng xếp hạng
    dailyWatch: 12,         // Số phim gợi ý hàng ngày
    dailyWatchPool: 50,     // Số lượng ứng viên tối đa cho gợi ý hàng ngày
    upcoming: 10,           // Số phim sắp ra mắt
    theater: 10,            // Số phim đang chiếu rạp
    perCountry: 12,         // Số phim hiển thị theo mỗi quốc gia
  },

  // Trọng số tính điểm thịnh hành (Tổng phải bằng 1.0)
  weights: {
    views: 0.35,            // Lượt xem (35%)
    rating: 0.3,            // Điểm đánh giá (30%)
    recency: 0.25,          // Độ mới (25%)
    favorites: 0.1,         // Lượt yêu thích (10%)
  },

  // Số lượng quốc gia nổi bật hiển thị trên trang chủ
  featuredCountriesCount: 5,

  // Cấu hình Cache
  cache: {
    primaryKey: "home:config",
    backupKey: "home:config:backup",
    defaultTTL: 300,        // 5 phút
    backupTTL: 3600,       // 1 giờ
  },

  // Khoảng thời gian tính độ mới (ngày)
  recencyWindowDays: 90,

  // Quy tắc đa dạng nội dung cho phần biểu ngữ (Hero section)
  diversity: {
    maxSameGenre: 2,        // Tối đa 2 phim cùng thể loại
    maxSameCountry: 3,      // Tối đa 3 phim cùng quốc gia
    requireCover: true,     // Ưu tiên phim có ảnh bìa chất lượng cao
  },
};

// ════════════════════════════════════════════════════════════════════════════
// TRÌNH XÂY DỰNG TRUY VẤN (QUERY BUILDERS)
// ════════════════════════════════════════════════════════════════════════════

export const THEATER_CATEGORY_SLUG = "phim-chieu-rap";

export const EMPTY_HOME_SECTIONS = {
  hero: [],
  topRanking: [],
  dailyWatch: [],
  upcoming: [],
  theater: [],
  byCountry: [],
};

export const buildUpcomingWhere = () => ({
  status: "upcoming",
  release_date: { [Op.gt]: new Date() },
});

/**
 * Xây dựng danh sách quan hệ tinh gọn cho phim
 * Tối ưu hóa hiệu năng (chỉ lấy các trường cần thiết cho card/list)
 */
export const buildLeanInclude = () => [
  {
    model: Genre,
    as: "genres",
    attributes: ["id", "name", "slug"],
    through: { attributes: [] },
  },
  {
    model: Country,
    as: "country",
    attributes: ["id", "name", "code"],
  },
];

/**
 * Xây dựng danh sách thuộc tính tinh gọn của phim
 */
export const buildLeanAttributes = () => [
  "id",
  "titles",
  "type",
  "status",
  "slug",
  "images",
  "age_rating",
  "total_episodes",
  "description",
  "imdb_rating",
  "rating_average",
  "rating_count",
  "total_views",
  "created_at",
  "release_date",
  "country_id",
  "trailer_url",
];

// ════════════════════════════════════════════════════════════════════════════
// THUẬT TOÁN TÍNH ĐIỂM THỊNH HÀNH (TRENDING SCORE)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Tính điểm thịnh hành cho một bộ phim
 * Xếp hạng đa yếu tố kết hợp mức độ phổ biến, chất lượng và độ mới.
 *
 * @param {Object} movie - Đối tượng phim kèm các chỉ số thống kê
 * @returns {number} Điểm số trong khoảng từ 0 đến 1
 */
export const calculateTrendingScore = (movie) => {
  const {
    total_views = 0,
    rating_average = 0,
    imdb_rating = 0,
    created_at,
  } = movie;

  const w = HOME_CONFIG_RULES.weights;

  // 1. Điểm lượt xem (thang log để tránh các phim quá bùng nổ chiếm lĩnh hoàn toàn)
  // Quy đổi: log10(1) = 0, log10(10tr lượt xem) = 7
  const viewsScore = Math.log10(Math.max(total_views, 1)) / 7;

  // 2. Điểm đánh giá (ưu tiên IMDB nếu có, ngược lại dùng đánh giá người dùng)
  const rating = parseFloat(imdb_rating) || parseFloat(rating_average) || 0;
  const ratingScore = rating / 10;

  // 3. Điểm độ mới (phân rã lũy thừa - phim càng cũ điểm càng giảm)
  const createdDate = created_at ? new Date(created_at) : new Date();
  const daysSinceCreation = Math.max(
    0,
    (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const recencyScore = Math.exp(
    -daysSinceCreation / HOME_CONFIG_RULES.recencyWindowDays,
  );

  // Tổng hợp có trọng số
  const score =
    w.views * Math.min(viewsScore, 1) +
    w.rating * Math.min(ratingScore, 1) +
    w.recency * Math.min(recencyScore, 1);

  return score;
};

/**
 * Sắp xếp danh sách phim theo điểm thịnh hành (giảm dần)
 * @param {Array} movies - Mảng các đối tượng phim
 * @returns {Array} Danh sách phim đã sắp xếp kèm thuộc tính _trendingScore
 */
export const sortByTrendingScore = (movies) => {
  return movies
    .map((movie) => {
      const movieData = movie.toJSON ? movie.toJSON() : movie;
      return {
        ...movieData,
        _trendingScore: calculateTrendingScore(movieData),
      };
    })
    .sort((a, b) => b._trendingScore - a._trendingScore);
};

// ════════════════════════════════════════════════════════════════════════════
// TRỘN NGẪU NHIÊN THEO SEED (Đảm bảo tính nhất quán trong ngày)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Lấy giá trị seed dựa trên ngày hiện tại
 * Định dạng: YYYYMMDD dưới dạng số nguyên
 */
export const getDailySeed = () => {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
};

/**
 * Mulberry32 - Trình tạo số ngẫu nhiên nhanh có hỗ trợ seed
 */
const mulberry32 = (seed) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Trộn mảng Fisher-Yates bằng seed ngẫu nhiên
 * Cùng một seed sẽ luôn cho cùng một kết quả trộn.
 */
export const seededShuffle = (array, seed) => {
  const rand = mulberry32(seed);
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

// ════════════════════════════════════════════════════════════════════════════
// LOẠI BỎ TRÙNG LẶP (DEDUPLICATION)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Loại bỏ phim trùng lặp giữa các phần theo thứ tự ưu tiên
 * Phần có độ ưu tiên cao hơn sẽ giữ phim, phần thấp hơn sẽ loại bỏ nếu bị trùng.
 *
 * Thứ tự ưu tiên: hero > topRanking > dailyWatch > upcoming > theater > byCountry
 */
export const dedupeAcrossSections = (sections) => {
  const seenIds = new Set();
  const result = {};

  const priority = ["hero", "topRanking", "dailyWatch", "upcoming", "theater"];

  for (const sectionName of priority) {
    if (!sections[sectionName]) continue;

    result[sectionName] = sections[sectionName].filter((movie) => {
      const id = movie.id;
      if (seenIds.has(id)) {
        return false;
      }
      seenIds.add(id);
      return true;
    });
  }

  // Xử lý byCountry (độ ưu tiên thấp nhất)
  if (sections.byCountry) {
    result.byCountry = {};
    for (const [countrySlug, movies] of Object.entries(sections.byCountry)) {
      result.byCountry[countrySlug] = movies.filter((movie) => {
        const id = movie.id;
        if (seenIds.has(id)) {
          return false;
        }
        seenIds.add(id);
        return true;
      });
    }
  }

  return result;
};

// ════════════════════════════════════════════════════════════════════════════
// LỰA CHỌN BIỂU NGỮ (HERO SELECTION)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Lựa chọn phim biểu ngữ đa dạng từ danh sách ứng viên
 * Đảm bảo sự đa dạng về thể loại và quốc gia trong khi vẫn ưu tiên chất lượng.
 */
export const selectDiverseHero = (
  candidates,
  limit = HOME_CONFIG_RULES.limits.hero,
) => {
  const rules = HOME_CONFIG_RULES.diversity;
  const selected = [];
  const genreCount = {};
  const countryCount = {};

  for (const movie of candidates) {
    if (selected.length >= limit) break;

    const movieData = movie.toJSON ? movie.toJSON() : movie;

    // Yêu cầu phim phải có ảnh bìa chất lượng
    if (rules.requireCover) {
      const hasGoodImage =
        movieData.images?.cover ||
        movieData.images?.banner ||
        movieData.images?.logo;
      if (!hasGoodImage && candidates.length > limit) {
        continue;
      }
    }

    // Đảm bảo đa dạng thể loại
    const primaryGenre = movieData.genres?.[0]?.id;
    if (primaryGenre) {
      if ((genreCount[primaryGenre] || 0) >= rules.maxSameGenre) {
        continue;
      }
    }

    // Đảm bảo đa dạng quốc gia
    const countryId = movieData.country_id;
    if (countryId) {
      if ((countryCount[countryId] || 0) >= rules.maxSameCountry) {
        continue;
      }
    }

    selected.push(movieData);

    if (primaryGenre)
      genreCount[primaryGenre] = (genreCount[primaryGenre] || 0) + 1;
    if (countryId) countryCount[countryId] = (countryCount[countryId] || 0) + 1;
  }

  // Nếu không đủ số lượng do ràng buộc đa dạng, điền thêm phim từ danh sách còn lại
  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((m) => m.id));
    for (const movie of candidates) {
      if (selected.length >= limit) break;
      const movieData = movie.toJSON ? movie.toJSON() : movie;
      if (!selectedIds.has(movieData.id)) {
        selected.push(movieData);
      }
    }
  }

  return selected;
};

// ════════════════════════════════════════════════════════════════════════════
// CHUẨN HÓA KẾT QUẢ (NORMALIZATION)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Chuẩn hóa đối tượng phim cho phản hồi API
 * Loại bỏ các trường nội bộ và thêm các trường tổng hợp cho UI.
 */
export const normalizeMovies = (movies) => {
  return movies.map((movie) => {
    const movieData = movie.toJSON ? movie.toJSON() : movie;
    const { _trendingScore, ...cleanMovie } = movieData;

    if (cleanMovie.release_date) {
      cleanMovie.year = new Date(cleanMovie.release_date).getFullYear();
    }

    return cleanMovie;
  });
};

/**
 * Lấy danh sách quốc gia nổi bật
 */
export const getFeaturedCountries = (allCountries) => {
  return allCountries.slice(0, HOME_CONFIG_RULES.featuredCountriesCount);
};

// ════════════════════════════════════════════════════════════════════════════
// HỖ TRỢ CÔNG THỨC TRENDING TRONG SQL
// ════════════════════════════════════════════════════════════════════════════

export const TRENDING_WEIGHTS = {
  views: 30,       // Lượt xem
  engagement: 25,  // Tương tác (yêu thích + lượt đánh giá)
  freshness: 20,   // Độ mới (ngày tạo)
  quality: 15,     // Chất lượng (IMDB + điểm trung bình)
  velocity: 10,    // Tốc độ tăng trưởng lượt xem
};

export const getPeriodDecayAndDays = (period) => {
  let periodDays;
  let decayFactor;

  switch (period) {
    case "day":
      periodDays = 1;
      decayFactor = 0.5;
      break;
    case "week":
      periodDays = 7;
      decayFactor = 0.15;
      break;
    case "month":
      periodDays = 30;
      decayFactor = 0.05;
      break;
    case "all":
    default:
      periodDays = 365;
      decayFactor = 0.01;
  }

  return { periodDays, decayFactor };
};

export const getTrendingScoreFormula = (decayFactor, weights, periodDays) => `(
  -- Điểm lượt xem (có tính đến sự phân rã theo thời gian)
  (COALESCE("Movie"."total_views", 0) * EXP(-${decayFactor} * EXTRACT(EPOCH FROM (NOW() - COALESCE("Movie"."created_at", NOW()))) / 86400)) * ${weights.views / 100}
  
  -- Điểm độ mới (dựa trên thời điểm phim được tạo/cập nhật)
  + (100 - LEAST(100, EXTRACT(EPOCH FROM (NOW() - COALESCE("Movie"."created_at", NOW()))) / 86400 / ${periodDays} * 100)) * ${weights.freshness / 100}
  
  -- Điểm chất lượng (trung bình trọng số của các nguồn đánh giá)
  + (
      COALESCE("Movie"."imdb_rating", 0) * 8 
      + COALESCE("Movie"."rating_average", 0) * 10
  ) * ${weights.quality / 100}
  
  -- Điểm tăng trưởng lượt xem (lượt xem trung bình mỗi ngày từ khi phát hành)
  + LEAST(50, (
      CASE 
          WHEN EXTRACT(EPOCH FROM (NOW() - COALESCE("Movie"."created_at", NOW()))) / 86400 < 1 THEN COALESCE("Movie"."total_views", 0)
          ELSE COALESCE("Movie"."total_views", 0) / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - COALESCE("Movie"."created_at", NOW()))) / 86400)
      END
  )) * ${weights.velocity / 100}
)`;

export default {
  HOME_CONFIG_RULES,
  buildLeanInclude,
  buildLeanAttributes,
  calculateTrendingScore,
  sortByTrendingScore,
  getDailySeed,
  seededShuffle,
  dedupeAcrossSections,
  selectDiverseHero,
  normalizeMovies,
  getFeaturedCountries,
  getTrendingScoreFormula,
  getPeriodDecayAndDays,
  TRENDING_WEIGHTS,
  THEATER_CATEGORY_SLUG,
  EMPTY_HOME_SECTIONS,
  buildUpcomingWhere,
};
