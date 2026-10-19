/**
 * @file subtitle-customization.constants.js
 * @module Components/VideoPlayer/Constants
 * @description Định nghĩa các hằng số, bảng màu và tùy chọn cấu hình giao diện phụ đề chuẩn Aesthetic OS.
 */

export const SUBTITLE_TEXT_COLORS = [
  { value: '#ffffff', label: 'Trắng', color: '#ffffff' },
  { value: '#ffeb3b', label: 'Vàng', color: '#ffeb3b' },
  { value: '#4caf50', label: 'Xanh lục', color: '#4caf50' },
  { value: '#2196f3', label: 'Xanh lam', color: '#2196f3' },
  { value: '#f44336', label: 'Đỏ', color: '#f44336' },
];

export const SUBTITLE_FONT_SIZES = [
  { value: 'small', label: 'Nhỏ (14px)' },
  { value: 'medium', label: 'Tiêu chuẩn (18px)' },
  { value: 'large', label: 'Lớn (22px)' },
  { value: 'xlarge', label: 'Rất lớn (28px)' },
];

export const SUBTITLE_TEXT_OPACITIES = [
  { value: 1, label: '100%' },
  { value: 0.75, label: '75%' },
  { value: 0.5, label: '50%' },
];

export const SUBTITLE_FONTS = [
  { value: 'default', label: 'Mặc định (Sora)' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Be Vietnam Pro', label: 'Be Vietnam Pro' },
  { value: 'monospace', label: 'Monospace' },
];

export const SUBTITLE_TEXT_EDGES = [
  { value: 'none', label: 'Không viền' },
  { value: 'subtle', label: 'Đổ bóng mờ' },
  { value: 'drop-shadow', label: 'Đổ bóng đậm' },
  { value: 'outline', label: 'Viền nét' },
];

export const SUBTITLE_BG_COLORS = [
  { value: '#07080a', label: 'Đen', color: '#07080a' },
  { value: '#ffffff', label: 'Trắng', color: '#ffffff' },
  { value: 'transparent', label: 'Không nền', color: 'transparent' },
];

export const SUBTITLE_BG_OPACITIES = [
  { value: 0, label: '0%' },
  { value: 0.25, label: '25%' },
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1, label: '100%' },
];

export const DEFAULT_SUBTITLE_STYLES = {
  textColor: '#ffffff',
  textSize: 'medium',
  textOpacity: 1,
  fontFamily: 'default',
  textEdge: 'subtle',
  bgColor: '#07080a',
  bgOpacity: 0.75,
};

export const SUBTITLE_STORAGE_KEY = 'sap-phim:player:subtitle-styles';
