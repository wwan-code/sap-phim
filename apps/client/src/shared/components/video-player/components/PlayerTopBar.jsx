/**
 * @file PlayerTopBar.jsx
 * @module Components/VideoPlayer/Components
 * @description Thanh tiêu đề trên đỉnh video (Cinematic Top Bar) chuẩn Glass Hybrid & Invisible Interface.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft, Sparkles } from 'lucide-react';

import { usePlayerStore, useShallow } from '../hooks/use-player-store';
import './player-top-bar.scss';

export const PlayerTopBar = memo(({
  isVisible: propIsVisible,
  title = '',
  subtitle = '',
  onBack = null,
  currentQualityName = '',
  isFullscreen: propIsFullscreen,
}) => {
  const storeState = usePlayerStore(
    useShallow((s) => ({
      isControlsVisible: s.isControlsVisible,
      isFullscreen: s.isFullscreen,
    })),
  );

  const isVisible =
    typeof propIsVisible === 'boolean' ? propIsVisible : storeState.isControlsVisible;
  const isFullscreen =
    typeof propIsFullscreen === 'boolean' ? propIsFullscreen : storeState.isFullscreen;

  // Chỉ hiển thị nếu có nội dung hoặc đang ở chế độ Fullscreen
  if (!isFullscreen && !title && !onBack) {
    return null;
  }

  return (
    <div
      className={`player-top-bar ${isVisible ? 'player-top-bar--visible' : 'player-top-bar--hidden'}`}
    >
      <div className="player-top-bar__left">
        {onBack && (
          <button
            type="button"
            className="player-top-bar__back-btn"
            onClick={onBack}
            aria-label="Quay lại"
            title="Quay lại"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {(title || subtitle) && (
          <div className="player-top-bar__titles">
            {title && <span className="player-top-bar__title">{title}</span>}
            {subtitle && <span className="player-top-bar__subtitle">{subtitle}</span>}
          </div>
        )}
      </div>

      <div className="player-top-bar__right">
        {currentQualityName && (
          <div className="player-top-bar__badge">
            <Sparkles size={12} />
            <span>{currentQualityName}</span>
          </div>
        )}
      </div>
    </div>
  );
});

PlayerTopBar.displayName = 'PlayerTopBar';

PlayerTopBar.propTypes = {
  isVisible: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  onBack: PropTypes.func,
  currentQualityName: PropTypes.string,
  isFullscreen: PropTypes.bool,
};

export default PlayerTopBar;
