/**
 * @file PlayerControls.jsx
 * @module Components/VideoPlayer/Components
 * @description Thanh công cụ điều khiển giao diện video player chuẩn YouTube 2025 & Aesthetic OS:
 * - SeekBar Full-width trên đỉnh
 * - Cụm trái: Play/Pause, Next (nếu có), Âm lượng mở rộng, Thời gian hiện tại / Tổng thời lượng
 * - Cụm phải: Phụ đề (CC), Cài đặt đa cấp, PiP, Rạp chiếu phim (Theater Mode), Toàn màn hình
 */

import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  SkipForward,
} from 'lucide-react';

import SeekBar from './SeekBar';
import SettingsMenu from './SettingsMenu';
import SubtitleMenu from './SubtitleMenu';
import { usePlayerStore, useShallow } from '../hooks/use-player-store';
import { formatTime } from '../utils/format-time';
import './player-controls.scss';

/**
 * Biểu tượng Picture-in-Picture chuẩn YouTube
 */
const PipIcon = ({ size = 22, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M19 9V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
    <rect x="12" y="11" width="10" height="7.5" rx="1.5" fill="currentColor" stroke="none" />
  </svg>
);

PipIcon.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};

/**
 * Biểu tượng Chế độ rạp chiếu phim (Theater Mode) chuẩn YouTube
 */
const TheaterIcon = ({ size = 22, isTheater = false, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {isTheater ? (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <rect x="6" y="8" width="12" height="8" rx="1" fill="currentColor" stroke="none" />
      </>
    ) : (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <line x1="2" y1="9" x2="22" y2="9" />
        <line x1="2" y1="15" x2="22" y2="15" />
      </>
    )}
  </svg>
);

TheaterIcon.propTypes = {
  size: PropTypes.number,
  isTheater: PropTypes.bool,
  className: PropTypes.string,
};

export const PlayerControls = ({
  isPlaying: propIsPlaying,
  currentTime: propCurrentTime,
  duration: propDuration,
  bufferedEnd: propBufferedEnd,
  volume: propVolume,
  isMuted: propIsMuted,
  isFullscreen: propIsFullscreen,
  isTheater: propIsTheater,
  playbackRate: propPlaybackRate,
  isPip: propIsPip,
  qualities: propQualities,
  currentQualityIndex: propCurrentQualityIndex,
  subtitles = [],
  currentSubtitleId = null,
  subtitleStyles,
  onChangeSubtitleStyles,
  hasStoryboard = false,
  chapters = [],
  sleepTimerOption = null,
  onSelectSleepTimer,
  isVisible: propIsVisible,
  onTogglePlay,
  onSeek,
  onChangeVolume,
  onToggleMute,
  onToggleFullscreen,
  onToggleTheater,
  onTogglePip,
  onChangePlaybackRate,
  onSelectQuality,
  onSelectSubtitle,
  onNextEpisode,
  renderPreviewToCanvas,
}) => {
  // Đọc state từ Zustand store
  const storeState = usePlayerStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      currentTime: s.currentTime,
      duration: s.duration,
      bufferedEnd: s.bufferedEnd,
      volume: s.volume,
      isMuted: s.isMuted,
      isFullscreen: s.isFullscreen,
      isTheater: s.isTheater,
      playbackRate: s.playbackRate,
      isPip: s.isPip,
      qualities: s.qualities,
      currentQualityIndex: s.currentQualityIndex,
      isControlsVisible: s.isControlsVisible,
      toggleTheater: s.toggleTheater,
    })),
  );

  const isPlaying =
    typeof propIsPlaying === 'boolean' ? propIsPlaying : storeState.isPlaying;
  const currentTime =
    typeof propCurrentTime === 'number' ? propCurrentTime : storeState.currentTime;
  const duration =
    typeof propDuration === 'number' ? propDuration : storeState.duration;
  const bufferedEnd =
    typeof propBufferedEnd === 'number' ? propBufferedEnd : storeState.bufferedEnd;
  const volume =
    typeof propVolume === 'number' ? propVolume : storeState.volume;
  const isMuted =
    typeof propIsMuted === 'boolean' ? propIsMuted : storeState.isMuted;
  const isFullscreen =
    typeof propIsFullscreen === 'boolean' ? propIsFullscreen : storeState.isFullscreen;
  const isTheater =
    typeof propIsTheater === 'boolean' ? propIsTheater : storeState.isTheater;
  const playbackRate =
    typeof propPlaybackRate === 'number' ? propPlaybackRate : storeState.playbackRate;
  const isPip =
    typeof propIsPip === 'boolean' ? propIsPip : storeState.isPip;
  const qualities = propQualities || storeState.qualities;
  const currentQualityIndex =
    typeof propCurrentQualityIndex === 'number'
      ? propCurrentQualityIndex
      : storeState.currentQualityIndex;
  const isVisible =
    typeof propIsVisible === 'boolean' ? propIsVisible : storeState.isControlsVisible;

  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const volumeSliderRef = useRef(null);

  const effectiveVolume = isMuted ? 0 : volume;
  const volumePercent = Math.round(effectiveVolume * 100);

  // Thiết lập biến CSS --volume-percent động qua ref thay vì React inline styles
  useEffect(() => {
    if (volumeSliderRef.current) {
      volumeSliderRef.current.style.setProperty(
        '--volume-percent',
        `${volumePercent}%`,
      );
    }
  }, [volumePercent]);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX size={22} />;
    if (volume < 0.5) return <Volume1 size={22} />;
    return <Volume2 size={22} />;
  };

  const handleTheaterToggle = onToggleTheater || storeState.toggleTheater;

  return (
    <div
      className={`player-controls ${isVisible ? 'player-controls--visible' : 'player-controls--hidden'}`}
    >
      {/* ── 1. FULL-WIDTH SEEKBAR TRÊN ĐỈNH THEO CHUẨN YOUTUBE ── */}
      <div className="player-controls__timeline">
        <div className="player-controls__seekbar-container">
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            bufferedEnd={bufferedEnd}
            onSeek={onSeek}
            renderPreviewToCanvas={renderPreviewToCanvas}
            hasStoryboard={hasStoryboard}
            chapters={chapters}
          />
        </div>
      </div>

      {/* ── 2. THANH CÁC NÚT ĐIỀU HƯỚNG BÊN DƯỚI ── */}
      <div className="player-controls__bar">
        {/* Cụm nút bên trái: Play/Pause, Next (nếu có), Âm lượng, Thời gian */}
        <div className="player-controls__group player-controls__group--left">
          <button
            type="button"
            className="player-controls__btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Tạm dừng (Space / K)' : 'Phát (Space / K)'}
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
          </button>

          {onNextEpisode && (
            <button
              type="button"
              className="player-controls__btn"
              onClick={onNextEpisode}
              title="Tập tiếp theo (Shift+N)"
              aria-label="Tập tiếp theo"
            >
              <SkipForward size={22} />
            </button>
          )}

          {/* Âm lượng & Thanh trượt */}
          <div
            className="player-controls__volume-wrapper"
            onMouseEnter={() => setIsVolumeHovered(true)}
            onMouseLeave={() => setIsVolumeHovered(false)}
          >
            <button
              type="button"
              className="player-controls__btn"
              onClick={onToggleMute}
              title={isMuted ? 'Bật âm thanh (M)' : 'Tắt âm thanh (M)'}
              aria-label="Âm lượng"
            >
              {getVolumeIcon()}
            </button>

            <div
              className={`player-controls__slider-wrapper ${isVolumeHovered || isVolumeDragging ? 'player-controls__slider-wrapper--open' : ''}`}
            >
              <input
                ref={volumeSliderRef}
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={effectiveVolume}
                onChange={(e) => onChangeVolume?.(parseFloat(e.target.value))}
                onMouseDown={() => setIsVolumeDragging(true)}
                onMouseUp={() => setIsVolumeDragging(false)}
                onTouchStart={() => setIsVolumeDragging(true)}
                onTouchEnd={() => setIsVolumeDragging(false)}
                className="player-controls__volume-slider"
                aria-label="Thanh trượt âm lượng"
              />
            </div>
          </div>

          {/* Hiển thị thời lượng kiểu YouTube: 00:31 / 20:19 */}
          <div className="player-controls__time-display">
            <span className="player-controls__time player-controls__time--current">
              {formatTime(currentTime)}
            </span>
            <span className="player-controls__time-separator">/</span>
            <span className="player-controls__time player-controls__time--duration">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Cụm nút bên phải: Phụ đề (CC), Settings, PiP, Theater Mode, Fullscreen */}
        <div className="player-controls__group player-controls__group--right">
          {/* Popover Phụ đề riêng biệt cho nút CC */}
          <SubtitleMenu
            subtitles={subtitles}
            currentSubtitleId={currentSubtitleId}
            onSelectSubtitle={onSelectSubtitle}
            subtitleStyles={subtitleStyles}
            onChangeSubtitleStyles={onChangeSubtitleStyles}
          />

          {/* Menu Cài đặt chung */}
          <SettingsMenu
            qualities={qualities}
            currentQualityIndex={currentQualityIndex}
            onSelectQuality={onSelectQuality}
            playbackRate={playbackRate}
            onChangePlaybackRate={onChangePlaybackRate}
            subtitleStyles={subtitleStyles}
            onChangeSubtitleStyles={onChangeSubtitleStyles}
            sleepTimerOption={sleepTimerOption}
            onSelectSleepTimer={onSelectSleepTimer}
          />

          {/* Hình trong hình (PiP) */}
          <button
            type="button"
            className={`player-controls__btn ${isPip ? 'player-controls__btn--active' : ''}`}
            onClick={onTogglePip}
            title="Hình trong hình (I)"
            aria-label="Hình trong hình"
          >
            <PipIcon size={22} />
          </button>

          {/* Chế độ Rạp chiếu phim (Theater Mode) */}
          <button
            type="button"
            className={`player-controls__btn player-controls__btn--theater ${isTheater ? 'player-controls__btn--active' : ''}`}
            onClick={handleTheaterToggle}
            title={isTheater ? 'Chế độ mặc định (T)' : 'Chế độ rạp chiếu phim (T)'}
            aria-label="Chế độ rạp chiếu phim"
          >
            <TheaterIcon size={22} isTheater={isTheater} />
          </button>

          {/* Toàn màn hình (Fullscreen) */}
          <button
            type="button"
            className="player-controls__btn"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ (F)' : 'Toàn màn hình (F)'}
            aria-label="Toàn màn hình"
          >
            {isFullscreen ? (
              <Minimize size={24} strokeWidth={2.1} />
            ) : (
              <Maximize size={24} strokeWidth={2.1} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

PlayerControls.propTypes = {
  isPlaying: PropTypes.bool,
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  bufferedEnd: PropTypes.number,
  volume: PropTypes.number,
  isMuted: PropTypes.bool,
  isFullscreen: PropTypes.bool,
  isTheater: PropTypes.bool,
  playbackRate: PropTypes.number,
  isPip: PropTypes.bool,
  qualities: PropTypes.array,
  currentQualityIndex: PropTypes.number,
  subtitles: PropTypes.array,
  currentSubtitleId: PropTypes.string,
  subtitleStyles: PropTypes.object,
  onChangeSubtitleStyles: PropTypes.func,
  hasStoryboard: PropTypes.bool,
  chapters: PropTypes.array,
  sleepTimerOption: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelectSleepTimer: PropTypes.func,
  isVisible: PropTypes.bool,
  onTogglePlay: PropTypes.func,
  onSeek: PropTypes.func,
  onChangeVolume: PropTypes.func,
  onToggleMute: PropTypes.func,
  onToggleFullscreen: PropTypes.func,
  onToggleTheater: PropTypes.func,
  onTogglePip: PropTypes.func,
  onChangePlaybackRate: PropTypes.func,
  onSelectQuality: PropTypes.func,
  onSelectSubtitle: PropTypes.func,
  onNextEpisode: PropTypes.func,
  renderPreviewToCanvas: PropTypes.func,
};

export default PlayerControls;
