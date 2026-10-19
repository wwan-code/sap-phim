/**
 * @file SpritePreviewCanvas.jsx
 * @module Components/VideoPlayer/Components
 * @description Component Canvas vẽ thumbnail preview thời gian thực từ Sprite Sheets và hiển thị tên Chapter khi rê chuột trên seekbar.
 */

import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

import { formatTime } from '../utils/format-time';
import './sprite-preview.scss';

export const SpritePreviewCanvas = ({
  hoverTime,
  hoverPercent,
  renderPreviewToCanvas,
  containerWidth = 800,
  chapterTitle = '',
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && renderPreviewToCanvas) {
      renderPreviewToCanvas(canvasRef.current, hoverTime);
    }
  }, [hoverTime, renderPreviewToCanvas]);

  // Giới hạn vị trí tooltip trong phạm vi khung hình (không bị tràn mép trái/phải)
  const previewWidth = 160;
  const halfWidth = previewWidth / 2;
  const targetX = (hoverPercent / 100) * containerWidth;
  const clampedX = Math.max(halfWidth + 8, Math.min(containerWidth - halfWidth - 8, targetX));

  return (
    <div
      className="sprite-preview"
      style={{
        left: `${clampedX}px`,
      }}
    >
      <div className="sprite-preview__canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={160}
          height={90}
          className="sprite-preview__canvas"
        />
      </div>
      {chapterTitle && (
        <span className="sprite-preview__chapter">{chapterTitle}</span>
      )}
      <span className="sprite-preview__time">{formatTime(hoverTime)}</span>
    </div>
  );
};

SpritePreviewCanvas.propTypes = {
  hoverTime: PropTypes.number.isRequired,
  hoverPercent: PropTypes.number.isRequired,
  renderPreviewToCanvas: PropTypes.func,
  containerWidth: PropTypes.number,
  chapterTitle: PropTypes.string,
};

export default SpritePreviewCanvas;
