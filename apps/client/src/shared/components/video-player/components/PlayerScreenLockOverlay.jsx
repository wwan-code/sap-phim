/**
 * @file PlayerScreenLockOverlay.jsx
 * @module Components/VideoPlayer/Components
 * @description Lớp phủ khóa màn hình chuẩn Netflix Mobile (Screen Lock).
 * Khi màn hình bị khóa, ẩn toàn bộ thanh điều khiển và chỉ hiển thị nút mở khóa khi người dùng chạm vào màn hình.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Lock } from 'lucide-react';

import { usePlayerStore, useShallow } from '../hooks/use-player-store';
import './player-screen-lock-overlay.scss';

export const PlayerScreenLockOverlay = ({
  isLocked: propIsLocked,
  isVisible: propIsVisible,
  onUnlock,
}) => {
  const storeState = usePlayerStore(
    useShallow((s) => ({
      isLocked: s.isScreenLocked,
      isVisible: s.isScreenLockPromptVisible,
      unlockScreen: s.unlockScreen,
    })),
  );

  const isLocked =
    typeof propIsLocked === 'boolean' ? propIsLocked : storeState.isLocked;
  const isVisible =
    typeof propIsVisible === 'boolean' ? propIsVisible : storeState.isVisible;

  const handleUnlock = onUnlock || storeState.unlockScreen;

  if (!isLocked) return null;

  return (
    <div
      className={`player-screen-lock-overlay ${isVisible ? 'player-screen-lock-overlay--visible' : 'player-screen-lock-overlay--hidden'}`}
      aria-hidden={!isVisible}
    >
      <button
        type="button"
        className="player-screen-lock-overlay__button"
        onClick={(e) => {
          e.stopPropagation();
          handleUnlock?.();
        }}
        title="Mở khóa màn hình"
        aria-label="Mở khóa màn hình"
      >
        <span className="player-screen-lock-overlay__icon">
          <Lock size={18} />
        </span>
        <span className="player-screen-lock-overlay__text">
          Màn hình đã khóa • Chạm để mở khóa
        </span>
      </button>
    </div>
  );
};

PlayerScreenLockOverlay.propTypes = {
  isLocked: PropTypes.bool,
  isVisible: PropTypes.bool,
  onUnlock: PropTypes.func,
};

export default PlayerScreenLockOverlay;
