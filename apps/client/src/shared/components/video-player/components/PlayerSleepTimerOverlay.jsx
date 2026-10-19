/**
 * @file PlayerSleepTimerOverlay.jsx
 * @module Components/VideoPlayer/Components
 * @description Màn hình thông báo tạm dừng khi hết giờ hẹn ngủ chuẩn Glass Hybrid & Invisible Interface.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Moon, Play, Power } from 'lucide-react';
import './player-sleep-timer-overlay.scss';

export const PlayerSleepTimerOverlay = memo(({
  isOpen = false,
  onWakeUp,
  onDismiss,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="player-sleep-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Thông báo hẹn giờ đi ngủ"
    >
      <div className="player-sleep-overlay__card">
        <div className="player-sleep-overlay__icon-wrap">
          <Moon size={32} />
        </div>

        <h2 className="player-sleep-overlay__title">Hẹn giờ đã kết thúc</h2>

        <p className="player-sleep-overlay__description">
          Video đã tạm dừng để bạn nghỉ ngơi. Bạn có muốn tiếp tục xem tiếp không?
        </p>

        <div className="player-sleep-overlay__actions">
          <button
            type="button"
            className="player-sleep-overlay__btn-resume"
            onClick={onWakeUp}
            autoFocus
          >
            <Play size={18} fill="currentColor" />
            <span>Tiếp tục xem</span>
          </button>

          <button
            type="button"
            className="player-sleep-overlay__btn-dismiss"
            onClick={onDismiss}
          >
            <Power size={16} />
            <span>Tắt màn hình / Nghỉ ngơi</span>
          </button>
        </div>
      </div>
    </div>
  );
});

PlayerSleepTimerOverlay.displayName = 'PlayerSleepTimerOverlay';

PlayerSleepTimerOverlay.propTypes = {
  isOpen: PropTypes.bool,
  onWakeUp: PropTypes.func,
  onDismiss: PropTypes.func,
};

export default PlayerSleepTimerOverlay;
