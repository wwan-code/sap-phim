/**
 * @file PlayerSubtitles.jsx
 * @module Components/VideoPlayer/Components
 * @description Lớp hiển thị phụ đề nổi tuỳ biến cao cấp (Aesthetic OS Custom Subtitle Overlay) với cơ chế tự động tránh va chạm thanh điều khiển.
 */

import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_SUBTITLE_STYLES } from '../constants/subtitle-customization.constants';
import './player-subtitles.scss';

/**
 * Làm sạch và chuyển đổi văn bản WebVTT cue sang HTML an toàn.
 * Hỗ trợ thẻ in đậm, in nghiêng, gạch chân và ngắt dòng.
 *
 * @param {string} rawText
 * @returns {string}
 */
const formatCueText = (rawText) => {
  if (!rawText) return '';

  // Thoát các ký tự HTML nguy hiểm trước khi giữ lại các thẻ định dạng hợp lệ
  let safe = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Khôi phục các thẻ WebVTT cơ bản: <b>, <i>, <u>, <c>
  safe = safe
    .replace(/&lt;b&gt;/gi, '<b>')
    .replace(/&lt;\/b&gt;/gi, '</b>')
    .replace(/&lt;i&gt;/gi, '<i>')
    .replace(/&lt;\/i&gt;/gi, '</i>')
    .replace(/&lt;u&gt;/gi, '<u>')
    .replace(/&lt;\/u&gt;/gi, '</u>')
    .replace(/&lt;c(?:\.[a-z0-9_-]+)*&gt;/gi, '<span>')
    .replace(/&lt;\/c&gt;/gi, '</span>');

  // Chuyển ngắt dòng thành thẻ <br />
  safe = safe.replace(/\r?\n/g, '<br />');

  return safe;
};

/**
 * Chuyển đổi mã màu hex sang định dạng rgba
 */
const hexToRgba = (hex, alpha = 1) => {
  if (!hex || hex === 'transparent' || alpha === 0) return 'transparent';
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
};

/**
 * Tạo đổ bóng chữ theo tùy chọn viền
 */
const getTextShadow = (edge) => {
  switch (edge) {
    case 'none':
      return 'none';
    case 'drop-shadow':
      return '0 4px 8px rgba(0, 0, 0, 0.95), 0 2px 4px rgba(0, 0, 0, 0.9)';
    case 'outline':
      return '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0, 0, 0, 0.8)';
    case 'subtle':
    default:
      return '0 2px 4px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.8)';
  }
};

/**
 * Chuyển đổi font chữ sang css font-family
 */
const getFontFamily = (font) => {
  switch (font) {
    case 'Arial':
      return 'Arial, sans-serif';
    case 'Roboto':
      return 'Roboto, sans-serif';
    case 'Be Vietnam Pro':
      return '"Be Vietnam Pro", sans-serif';
    case 'monospace':
      return 'var(--sp-font-mono, "JetBrains Mono", monospace)';
    case 'default':
    default:
      return 'var(--sp-font-body, system-ui, sans-serif)';
  }
};

export const PlayerSubtitles = ({
  textTrack = null,
  videoElement = null,
  isControlsVisible = false,
  size = 'medium',
  styles = DEFAULT_SUBTITLE_STYLES,
}) => {
  const [activeCueText, setActiveCueText] = useState('');

  const currentStyles = useMemo(
    () => ({ ...DEFAULT_SUBTITLE_STYLES, ...styles }),
    [styles],
  );

  const effectiveSize = currentStyles.textSize || size || 'medium';

  const cssVariables = useMemo(() => {
    const isBgTransparent =
      currentStyles.bgColor === 'transparent' || currentStyles.bgOpacity === 0;

    return {
      '--sub-text-color': currentStyles.textColor || '#ffffff',
      '--sub-text-opacity': currentStyles.textOpacity ?? 1,
      '--sub-font-family': getFontFamily(currentStyles.fontFamily),
      '--sub-text-shadow': getTextShadow(currentStyles.textEdge),
      '--sub-bg-color': isBgTransparent
        ? 'transparent'
        : hexToRgba(currentStyles.bgColor, currentStyles.bgOpacity ?? 0.75),
      '--sub-backdrop-filter': isBgTransparent ? 'none' : 'blur(8px)',
      '--sub-border': isBgTransparent ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
      '--sub-box-shadow': isBgTransparent ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.5)',
    };
  }, [currentStyles]);

  useEffect(() => {
    if (!textTrack) {
      setActiveCueText('');
      return;
    }

    const updateCues = () => {
      const cues = textTrack.activeCues;
      if (cues && cues.length > 0) {
        const textParts = [];
        for (let i = 0; i < cues.length; i++) {
          if (cues[i].text) {
            textParts.push(cues[i].text);
          }
        }
        const nextText = textParts.join('\n');
        setActiveCueText((prev) => (prev === nextText ? prev : nextText));
      } else {
        setActiveCueText((prev) => (prev === '' ? prev : ''));
      }
    };

    // Gọi cập nhật ban đầu
    updateCues();

    // Lắng nghe sự kiện cuechange trên TextTrack
    textTrack.addEventListener('cuechange', updateCues);

    // Đồng thời lắng nghe timeupdate trên video để cập nhật mượt mà khi người dùng tua (scrub)
    if (videoElement) {
      videoElement.addEventListener('timeupdate', updateCues);
    }

    return () => {
      textTrack.removeEventListener('cuechange', updateCues);
      if (videoElement) {
        videoElement.removeEventListener('timeupdate', updateCues);
      }
    };
  }, [textTrack, videoElement]);

  if (!activeCueText) {
    return null;
  }

  const formattedHtml = formatCueText(activeCueText);

  return (
    <div
      className={`player-subtitles player-subtitles--size-${effectiveSize} ${isControlsVisible ? 'player-subtitles--controls-visible' : ''}`}
      style={cssVariables}
      aria-live="polite"
      role="region"
      aria-label="Phụ đề video"
    >
      <span
        className="player-subtitles__cue"
        dangerouslySetInnerHTML={{ __html: formattedHtml }}
      />
    </div>
  );
};

PlayerSubtitles.propTypes = {
  textTrack: PropTypes.object,
  videoElement: PropTypes.object,
  isControlsVisible: PropTypes.bool,
  size: PropTypes.string,
  styles: PropTypes.object,
};

export default PlayerSubtitles;
