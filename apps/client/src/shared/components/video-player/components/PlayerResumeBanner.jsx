/**
 * @file PlayerResumeBanner.jsx
 * @module Components/VideoPlayer/Components
 * @description Thông báo tiếp tục xem phim (Playback Resume UI) chuẩn Compact Cinema Capsule & The Aesthetic OS.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { History, Play, X } from 'lucide-react';

import { formatTime } from '../utils/format-time';
import './player-resume-banner.scss';

export const PlayerResumeBanner = memo(({
  isOpen = false,
  savedTime = 0,
  onResume,
  onRestart,
  onClose,
  isControlsVisible = false,
}) => {
  if (!isOpen || !savedTime) {
    return null;
  }

  return (
    <div
      className={`player-resume-banner ${isControlsVisible ? 'player-resume-banner--controls-visible' : ''}`}
      role="status"
      aria-live="polite"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="player-resume-banner__content">
        <span className="player-resume-banner__icon-wrap">
          <History size={14} className="player-resume-banner__icon" />
        </span>
        <span className="player-resume-banner__text">
          Tiếp tục từ <strong className="player-resume-banner__time">{formatTime(savedTime)}</strong>?
        </span>
      </div>

      <div className="player-resume-banner__actions">
        <button
          type="button"
          className="player-resume-banner__btn-resume"
          onClick={onResume}
          title={`Tiếp tục xem từ ${formatTime(savedTime)}`}
          aria-label={`Tiếp tục xem từ ${formatTime(savedTime)}`}
        >
          <Play size={11} fill="currentColor" />
          <span>Tiếp tục</span>
        </button>

        <button
          type="button"
          className="player-resume-banner__btn-restart"
          onClick={onRestart}
          title="Xem lại từ đầu"
          aria-label="Xem lại từ đầu"
        >
          Từ đầu
        </button>

        <button
          type="button"
          className="player-resume-banner__btn-close"
          onClick={onClose}
          aria-label="Đóng thông báo"
          title="Đóng"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
});

PlayerResumeBanner.displayName = 'PlayerResumeBanner';

PlayerResumeBanner.propTypes = {
  isOpen: PropTypes.bool,
  savedTime: PropTypes.number,
  onResume: PropTypes.func,
  onRestart: PropTypes.func,
  onClose: PropTypes.func,
  isControlsVisible: PropTypes.bool,
};

export default PlayerResumeBanner;
