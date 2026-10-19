/**
 * @file RankIcon.jsx
 * @module Components/Icons/Ranks
 * @description Component thông minh hiển thị biểu tượng SVG Cấp bậc (Ranks) theo rankId hoặc level.
 */

import React, { memo } from 'react';
import KhanGiaIcon from './KhanGiaIcon';
import MotPhimIcon from './MotPhimIcon';
import TinDoIcon from './TinDoIcon';
import HauKyIcon from './HauKyIcon';
import TuTruongIcon from './TuTruongIcon';
import ChienBinhIcon from './ChienBinhIcon';
import HiepSiIcon from './HiepSiIcon';
import DaoDienIcon from './DaoDienIcon';
import NhaSanXuatIcon from './NhaSanXuatIcon';
import SieuSaoIcon from './SieuSaoIcon';
import BatTuIcon from './BatTuIcon';
import HuyenThoaiIcon from './HuyenThoaiIcon';

export const RANK_ICON_MAP = {
  khan_gia: KhanGiaIcon,
  mot_phim: MotPhimIcon,
  tin_do: TinDoIcon,
  hau_ky: HauKyIcon,
  tu_truong: TuTruongIcon,
  chien_binh: ChienBinhIcon,
  hiep_si: HiepSiIcon,
  dao_dien: DaoDienIcon,
  nha_san_xuat: NhaSanXuatIcon,
  sieu_sao: SieuSaoIcon,
  bat_tu: BatTuIcon,
  huyen_thoai: HuyenThoaiIcon,
};

/**
 * Tìm rankId dựa trên cấp độ level (1 - 100)
 */
const getRankIdByLevel = (level) => {
  const lv = Number(level) || 1;
  if (lv >= 96) return 'huyen_thoai';
  if (lv >= 81) return 'bat_tu';
  if (lv >= 69) return 'sieu_sao';
  if (lv >= 58) return 'nha_san_xuat';
  if (lv >= 48) return 'dao_dien';
  if (lv >= 39) return 'hiep_si';
  if (lv >= 31) return 'chien_binh';
  if (lv >= 23) return 'tu_truong';
  if (lv >= 16) return 'hau_ky';
  if (lv >= 11) return 'tin_do';
  if (lv >= 6) return 'mot_phim';
  return 'khan_gia';
};

/**
 * Component RankIcon
 *
 * @param {string} [rankId] - ID của rank (ví dụ: 'khan_gia', 'huyen_thoai',...)
 * @param {number} [level] - Cấp độ (1 - 100), tự động chuyển đổi sang rankId nếu không truyền rankId
 * @param {number} [size=20] - Kích thước pixel
 * @param {string} [className] - Class CSS tùy biến
 * @param {object} [style] - Inline style
 */
export const RankIcon = memo(({ rankId, level, size = 20, className = '', style = {}, ...props }) => {
  const effectiveId = rankId || (level !== undefined ? getRankIdByLevel(level) : 'khan_gia');
  const IconComponent = RANK_ICON_MAP[effectiveId] || KhanGiaIcon;

  return <IconComponent size={size} className={className} style={style} {...props} />;
});

RankIcon.displayName = 'RankIcon';
export default RankIcon;
