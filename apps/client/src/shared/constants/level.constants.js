/**
 * @file level.constants.js
 * @module Constants/Level
 * @description Hằng số và hàm tiện ích cấp bậc (Level), kinh nghiệm (EXP), xếp hạng (Ranks) người dùng.
 */

import {
  KhanGiaIcon,
  MotPhimIcon,
  TinDoIcon,
  HauKyIcon,
  TuTruongIcon,
  ChienBinhIcon,
  HiepSiIcon,
  DaoDienIcon,
  NhaSanXuatIcon,
  SieuSaoIcon,
  BatTuIcon,
  HuyenThoaiIcon,
} from "../components/icons/ranks";

/**
 * Danh sách Xếp hạng (Ranks)
 *
 * @description Định nghĩa tên, biểu tượng SVG, dải cấp độ và màu sắc đặc trưng cho mỗi hạng.
 */
export const RANKS = Object.freeze([
  {
    id: "khan_gia",
    name: "Khán Giả",
    icon: KhanGiaIcon,
    minLevel: 1,
    maxLevel: 5,
    color: "#9E9E9E",
  },
  {
    id: "mot_phim",
    name: "Mọt Phim",
    icon: MotPhimIcon,
    minLevel: 6,
    maxLevel: 10,
    color: "#8D6E63",
  },
  {
    id: "tin_do",
    name: "Tín Đồ",
    icon: TinDoIcon,
    minLevel: 11,
    maxLevel: 15,
    color: "#42A5F5",
  },
  {
    id: "hau_ky",
    name: "Hậu Kỳ",
    icon: HauKyIcon,
    minLevel: 16,
    maxLevel: 22,
    color: "#66BB6A",
  },
  {
    id: "tu_truong",
    name: "Tư Trưởng",
    icon: TuTruongIcon,
    minLevel: 23,
    maxLevel: 30,
    color: "#AB47BC",
  },
  {
    id: "chien_binh",
    name: "Chiến Binh",
    icon: ChienBinhIcon,
    minLevel: 31,
    maxLevel: 38,
    color: "#EF5350",
  },
  {
    id: "hiep_si",
    name: "Hiệp Sĩ",
    icon: HiepSiIcon,
    minLevel: 39,
    maxLevel: 47,
    color: "#FF7043",
  },
  {
    id: "dao_dien",
    name: "Đạo Diễn",
    icon: DaoDienIcon,
    minLevel: 48,
    maxLevel: 57,
    color: "#26C6DA",
  },
  {
    id: "nha_san_xuat",
    name: "Nhà Sản Xuất",
    icon: NhaSanXuatIcon,
    minLevel: 58,
    maxLevel: 68,
    color: "#FFA726",
  },
  {
    id: "sieu_sao",
    name: "Siêu Sao",
    icon: SieuSaoIcon,
    minLevel: 69,
    maxLevel: 80,
    color: "#FFEE58",
  },
  {
    id: "bat_tu",
    name: "Bất Tử",
    icon: BatTuIcon,
    minLevel: 81,
    maxLevel: 95,
    color: "#7C4DFF",
  },
  {
    id: "huyen_thoai",
    name: "Huyền Thoại",
    icon: HuyenThoaiIcon,
    minLevel: 96,
    maxLevel: 100,
    color: "#FFD700",
  },
]);

/**
 * Cấp độ tối đa mà người dùng có thể đạt được
 */
export const MAX_LEVEL = 100;

/**
 * Định nghĩa phần thưởng EXP và Point cho các hành động
 */
export const EXP_REWARDS = Object.freeze({
  WATCH_COMPLETE: { exp: 15, point: 10, label: "Xem phim hoàn thành" },
  RATING: { exp: 8, point: 5, label: "Đánh giá phim" },
  COMMENT: { exp: 5, point: 3, label: "Bình luận" },
  FOLLOW: { exp: 2, point: 1, label: "Theo dõi người dùng" },
  DAILY_LOGIN: { exp: 3, point: 2, label: "Đăng nhập hàng ngày" },
});

/**
 * Tính tổng EXP cần thiết để đạt đến một cấp độ cụ thể
 *
 * @description Sử dụng công thức: 50 * level * (level + 1)
 * @param {number} level - Cấp độ mục tiêu (1–100)
 * @returns {number} Tổng EXP tích lũy cần đạt
 */
export const getExpForLevel = (level) => {
  if (level <= 1) return 0;
  return 50 * level * (level + 1);
};

/**
 * Tính lượng EXP cần thiết để thăng lên cấp độ kế tiếp
 *
 * @param {number} level - Cấp độ hiện tại
 * @returns {number} Lượng EXP cần bổ sung
 */
export const getExpForNextLevel = (level) => {
  if (level >= MAX_LEVEL) return 0;
  return getExpForLevel(level + 1) - getExpForLevel(level);
};

/**
 * Xác định cấp độ hiện tại dựa trên tổng lượng EXP tích lũy
 *
 * @description Giải phương trình bậc hai rút gọn để tìm L (Cấp độ).
 * @param {number} totalExp - Tổng EXP người dùng hiện có
 * @returns {number} Cấp độ đạt được (1 đến 100)
 */
export const getLevelFromExp = (totalExp) => {
  if (totalExp <= 0) return 1;

  const level = Math.floor((-50 + Math.sqrt(2500 + 200 * totalExp)) / 100);
  return Math.max(1, Math.min(MAX_LEVEL, level));
};

/**
 * Lấy thông tin xếp hạng dựa trên cấp độ hiện tại
 *
 * @param {number} level - Cấp độ cần kiểm tra
 * @returns {Object} Đối tượng chứa thông tin xếp hạng
 */
export const getRankByLevel = (level) => {
  const clampedLevel = Math.max(1, Math.min(MAX_LEVEL, level));
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (clampedLevel >= RANKS[i].minLevel) {
      return RANKS[i];
    }
  }
  return RANKS[0];
};

/**
 * Lấy thông tin xếp hạng dựa trên ID của rank
 *
 * @param {string} rankId - ID xếp hạng (e.g. 'khan_gia', 'huyen_thoai')
 * @returns {Object} Đối tượng rank tương ứng kèm component icon SVG
 */
export const getRankById = (rankId) => {
  if (!rankId) return RANKS[0];
  return RANKS.find((r) => r.id === rankId) || RANKS[0];
};

/**
 * Lấy thông tin xếp hạng kế tiếp (nếu có)
 *
 * @param {number} level - Cấp độ hiện tại
 * @returns {Object|null} Thông tin hạng tiếp theo hoặc null nếu đã đạt Huyền Thoại
 */
export const getNextRank = (level) => {
  const currentRank = getRankByLevel(level);
  const currentIndex = RANKS.findIndex((r) => r.id === currentRank.id);
  return currentIndex < RANKS.length - 1 ? RANKS[currentIndex + 1] : null;
};

/**
 * Tính toán chi tiết tiến trình cấp độ (Progress) của người dùng
 *
 * @param {number} totalExp - Tổng EXP tích lũy của người dùng
 * @returns {Object} Bao gồm level, rank, tiến trình %, EXP cần để lên cấp
 */
export const getLevelProgress = (totalExp) => {
  const level = getLevelFromExp(totalExp);
  const currentLevelExp = getExpForLevel(level);
  const nextLevelExp = getExpForLevel(level + 1);
  const expInCurrentLevel = totalExp - currentLevelExp;
  const expNeeded = nextLevelExp - currentLevelExp;

  const progress =
    level >= MAX_LEVEL
      ? 100
      : Math.min(100, Math.round((expInCurrentLevel / expNeeded) * 100));

  return {
    level,
    currentLevelExp,
    nextLevelExp,
    expInCurrentLevel,
    expNeeded,
    progress,
    rank: getRankByLevel(level),
    nextRank: getNextRank(level),
  };
};
