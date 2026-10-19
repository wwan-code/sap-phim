/**
 * @file PlayerSkipIntro.jsx
 * @module Components/VideoPlayer/Components
 * @description Nút "Bỏ qua phần giới thiệu" (Skip Intro) đặc trưng chuẩn Netflix Web & Mobile.
 * Tự động hiển thị khi tiến trình phát nằm trong đoạn Intro và nhảy thẳng tới nội dung chính khi click.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { FastForward } from 'lucide-react';
import './player-skip-intro.scss';

export const PlayerSkipIntro = ({
  isVisible = false,
  isControlsVisible = true,
  onSkip,
  label = 'Bỏ qua phần giới thiệu',
}) => {
  if (!isVisible) return null;

  return (
    <div
      className={`player-skip-intro ${!isControlsVisible ? 'player-skip-intro--controls-hidden' : ''}`}
    >
      <button
        type="button"
        className="player-skip-intro__button"
        onClick={(e) => {
          e.stopPropagation();
          onSkip?.();
        }}
        title={label}
        aria-label={label}
      >
        <span className="player-skip-intro__icon">
          <FastForward size={16} />
        </span>
        <span className="player-skip-intro__text">{label}</span>
      </button>
    </div>
  );
};

PlayerSkipIntro.propTypes = {
  isVisible: PropTypes.bool,
  isControlsVisible: PropTypes.bool,
  onSkip: PropTypes.func,
  label: PropTypes.string,
};

export default PlayerSkipIntro;
