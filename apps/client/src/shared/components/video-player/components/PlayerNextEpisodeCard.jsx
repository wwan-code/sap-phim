/**
 * @file PlayerNextEpisodeCard.jsx
 * @module Components/VideoPlayer/Components
 * @description Card đếm ngược phát tập tiếp theo (Next Episode Card) chuẩn Netflix Web & Mobile.
 * Tự động kích hoạt khi video phát đến 35s cuối cùng của tập phim, cho phép phát ngay hoặc đếm ngược 10 giây.
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Play, X } from 'lucide-react';
import './player-next-episode-card.scss';

export const PlayerNextEpisodeCard = ({
  isOpen = false,
  isControlsVisible = true,
  onPlayNext,
  onDismiss,
  nextEpisodeTitle = 'Tập tiếp theo',
  autoCountdownSeconds = 10,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(autoCountdownSeconds);

  // Đếm ngược tự động chuyển tập
  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(autoCountdownSeconds);
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onPlayNext?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, autoCountdownSeconds, onPlayNext]);

  if (!isOpen) return null;

  return (
    <div
      className={`player-next-episode-card ${!isControlsVisible ? 'player-next-episode-card--controls-hidden' : ''}`}
    >
      <div className="player-next-episode-card__header">
        <span className="player-next-episode-card__badge">Tập tiếp theo</span>
        <button
          type="button"
          className="player-next-episode-card__close-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss?.();
          }}
          title="Đóng thông báo"
          aria-label="Đóng thông báo tập tiếp theo"
        >
          <X size={16} />
        </button>
      </div>

      <div className="player-next-episode-card__content">
        <h4 className="player-next-episode-card__title">{nextEpisodeTitle}</h4>
        <span className="player-next-episode-card__countdown">
          Tự động phát sau {secondsRemaining} giây
        </span>
      </div>

      <div className="player-next-episode-card__actions">
        <button
          type="button"
          className="player-next-episode-card__play-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPlayNext?.();
          }}
          title="Phát tập tiếp theo ngay"
        >
          <Play size={16} fill="currentColor" />
          <span>Phát ngay</span>
        </button>
      </div>
    </div>
  );
};

PlayerNextEpisodeCard.propTypes = {
  isOpen: PropTypes.bool,
  isControlsVisible: PropTypes.bool,
  onPlayNext: PropTypes.func,
  onDismiss: PropTypes.func,
  nextEpisodeTitle: PropTypes.string,
  autoCountdownSeconds: PropTypes.number,
};

export default PlayerNextEpisodeCard;
