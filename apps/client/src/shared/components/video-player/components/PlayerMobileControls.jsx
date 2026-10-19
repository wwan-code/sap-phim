/**
 * @file PlayerMobileControls.jsx
 * @module Components/VideoPlayer/Components
 * @description Bộ điều khiển chuyên biệt cho Mobile Cinema (Center Stage, Top Bar Truncated, Bottom Timeline Full-Width, Chapters).
 * Tích hợp nút Volume trên Top-bar với thanh trượt dọc dạng viên thuốc (Vertical Pill Slider) mượt mà, thay thế nút Speed.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize,
  Minimize,
  ArrowLeft,
  Settings,
  SkipForward,
  Lock,
  Volume2,
  Volume1,
  VolumeX,
} from 'lucide-react';

import SeekBar from './SeekBar';
import { CcIcon } from './SubtitleMenu';
import { usePlayerStore, useShallow } from '../hooks/use-player-store';
import { formatTime } from '../utils/format-time';
import './player-mobile-controls.scss';

export const PlayerMobileControls = ({
  isVisible: propIsVisible,
  isPlaying: propIsPlaying,
  isScreenLocked: propIsScreenLocked,
  currentTime: propCurrentTime,
  duration: propDuration,
  bufferedEnd: propBufferedEnd,
  playbackRate: propPlaybackRate,
  volume: propVolume,
  isMuted: propIsMuted,
  title = '',
  subtitle = '',
  onBack = null,
  isFullscreen: propIsFullscreen,
  isPip: propIsPip,
  hasStoryboard = false,
  chapters = [],
  currentSubtitleId = null,
  onTogglePlay,
  onSeek,
  onSeekRelative,
  onToggleFullscreen,
  onTogglePip,
  onChangeVolume,
  onToggleMute,
  onNextEpisode,
  onOpenSheet,
  onLockScreen,
  renderPreviewToCanvas,
}) => {
  const storeState = usePlayerStore(
    useShallow((s) => ({
      isVisible: s.isControlsVisible,
      isPlaying: s.isPlaying,
      isScreenLocked: s.isScreenLocked,
      currentTime: s.currentTime,
      duration: s.duration,
      bufferedEnd: s.bufferedEnd,
      playbackRate: s.playbackRate,
      volume: s.volume,
      isMuted: s.isMuted,
      isFullscreen: s.isFullscreen,
      isPip: s.isPip,
      setVolume: s.setVolume,
      toggleMute: s.toggleMute,
      activeMenu: s.activeMenu,
      setActiveMenu: s.setActiveMenu,
    })),
  );

  const isVisible =
    typeof propIsVisible === 'boolean' ? propIsVisible : storeState.isVisible;
  const isPlaying =
    typeof propIsPlaying === 'boolean' ? propIsPlaying : storeState.isPlaying;
  const isScreenLocked =
    typeof propIsScreenLocked === 'boolean'
      ? propIsScreenLocked
      : storeState.isScreenLocked;
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

  // ── Trạng thái thanh trượt Volume dọc (Vertical Pill Slider) ──
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const volumeWrapperRef = useRef(null);
  const volumeTrackRef = useRef(null);
  const autoCloseTimerRef = useRef(null);

  const effectiveVolume = isMuted ? 0 : volume;
  const volumePercent = Math.round(effectiveVolume * 100);
  const volumePercentRef = useRef(volumePercent);
  volumePercentRef.current = volumePercent;

  // Cập nhật vị trí fill và thumb thông qua CSS variable trên track ref
  useEffect(() => {
    if (isVolumeOpen && volumeTrackRef.current) {
      volumeTrackRef.current.style.setProperty(
        '--volume-vertical-percent',
        `${volumePercent}%`,
      );
    }
  }, [volumePercent, isVolumeOpen]);

  const setTrackRef = useCallback((node) => {
    volumeTrackRef.current = node;
    if (node) {
      node.style.setProperty(
        '--volume-vertical-percent',
        `${volumePercentRef.current}%`,
      );
    }
  }, []);

  // Click outside listener để đóng thanh volume
  useEffect(() => {
    if (!isVolumeOpen) return;

    const handleOutsideClick = (e) => {
      if (
        volumeWrapperRef.current &&
        !volumeWrapperRef.current.contains(e.target)
      ) {
        setIsVolumeOpen(false);
        if (storeState.activeMenu === 'mobile-volume') {
          storeState.setActiveMenu(null);
        }
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isVolumeOpen, storeState]);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // Tính toán âm lượng theo vị trí chạm trên track dọc (Đáy là 0%, Đỉnh là 100%)
  const updateVolumeFromPointer = useCallback(
    (clientY) => {
      const track = volumeTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const offsetY = rect.bottom - clientY;
      const ratio = Math.max(0, Math.min(1, offsetY / rect.height));

      // Cập nhật trực tiếp style để đạt phản hồi cảm ứng 60fps mượt mà
      track.style.setProperty(
        '--volume-vertical-percent',
        `${Math.round(ratio * 100)}%`,
      );

      if (onChangeVolume) {
        onChangeVolume(ratio);
      } else {
        storeState.setVolume(ratio);
      }
    },
    [onChangeVolume, storeState],
  );

  const handleTrackPointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsVolumeDragging(true);

    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    updateVolumeFromPointer(e.clientY);
  };

  const handleTrackPointerMove = (e) => {
    if (!isVolumeDragging) return;
    e.stopPropagation();
    e.preventDefault();
    updateVolumeFromPointer(e.clientY);
  };

  const handleTrackPointerUp = (e) => {
    if (!isVolumeDragging) return;
    e.stopPropagation();
    setIsVolumeDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    // Hẹn giờ 3s tự động đóng sau khi kéo xong
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
    autoCloseTimerRef.current = setTimeout(() => {
      setIsVolumeOpen(false);
      storeState.setActiveMenu(null);
    }, 3000);
  };

  // Hành vi khi nhấn nút Volume:
  // - Khi chưa mở: Mở thanh trượt dọc và giữ controls visible.
  // - Khi đã mở: Nhấn vào icon sẽ Bật/Tắt Mute nhanh.
  const handleVolumeBtnClick = (e) => {
    e.stopPropagation();
    if (!isVolumeOpen) {
      setIsVolumeOpen(true);
      storeState.setActiveMenu('mobile-volume');

      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      autoCloseTimerRef.current = setTimeout(() => {
        setIsVolumeOpen(false);
        storeState.setActiveMenu(null);
      }, 3000);
    } else {
      if (onToggleMute) {
        onToggleMute();
      } else {
        storeState.toggleMute();
      }

      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      autoCloseTimerRef.current = setTimeout(() => {
        setIsVolumeOpen(false);
        storeState.setActiveMenu(null);
      }, 3000);
    }
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX size={22} />;
    if (volume < 0.5) return <Volume1 size={22} />;
    return <Volume2 size={22} />;
  };

  // Khi màn hình đang bị khóa (Netflix Screen Lock), ẩn toàn bộ controls
  if (isScreenLocked) {
    return null;
  }

  return (
    <div
      className={`player-mobile-controls ${isVisible ? 'player-mobile-controls--visible' : 'player-mobile-controls--hidden'}`}
      aria-hidden={!isVisible}
    >
      {/* ── 1. TOP BAR MOBILE: BACK, TIÊU ĐỀ THU GỌN, VÀ NÚT VOLUME DROPDOWN ── */}
      <div className="player-mobile-controls__top-bar">
        <div className="player-mobile-controls__top-left">
          {onBack && (
            <button
              type="button"
              className="player-mobile-controls__back-btn"
              onClick={onBack}
              aria-label="Quay lại"
            >
              <ArrowLeft size={22} />
            </button>
          )}

          {(title || subtitle) && (
            <div className="player-mobile-controls__titles">
              {title && <span className="player-mobile-controls__title">{title}</span>}
              {subtitle && <span className="player-mobile-controls__subtitle">{subtitle}</span>}
            </div>
          )}
        </div>

        <div className="player-mobile-controls__top-right">
          {/* Nút Volume kèm Thanh trượt dọc Capsule Pill (thay thế nút Speed) */}
          <div
            ref={volumeWrapperRef}
            className="player-mobile-controls__volume-wrapper"
          >
            <button
              type="button"
              className={`player-mobile-controls__top-btn player-mobile-controls__volume-btn ${isVolumeOpen ? 'player-mobile-controls__volume-btn--open' : ''}`}
              onClick={handleVolumeBtnClick}
              title={isMuted ? 'Bật âm thanh' : 'Âm lượng'}
              aria-label="Âm lượng"
              aria-expanded={isVolumeOpen}
            >
              {getVolumeIcon()}
            </button>

            {/* Dropdown viên thuốc chứa thanh trượt dọc */}
            {isVolumeOpen && (
              <div
                className="player-mobile-controls__volume-dropdown"
                onPointerDown={handleTrackPointerDown}
                onPointerMove={handleTrackPointerMove}
                onPointerUp={handleTrackPointerUp}
                onPointerCancel={handleTrackPointerUp}
              >
                <div
                  ref={setTrackRef}
                  className="player-mobile-controls__volume-track"
                >
                  <div className="player-mobile-controls__volume-fill" />
                  <div className="player-mobile-controls__volume-thumb" />
                </div>
              </div>
            )}
          </div>

          {/* Nút bật/tắt phụ đề nhanh (CC) -> Mở tab phụ đề của Bottom Sheet */}
          <button
            type="button"
            className={`player-mobile-controls__top-btn ${currentSubtitleId ? 'player-mobile-controls__top-btn--active' : ''}`}
            onClick={() => onOpenSheet?.('subtitles')}
            title="Phụ đề"
            aria-label="Phụ đề"
          >
            <CcIcon size={22} />
          </button>

          {/* Nút Cài đặt (Bánh răng) -> Mở tab cài đặt của Bottom Sheet (chứa Tốc độ phát) */}
          <button
            type="button"
            className="player-mobile-controls__top-btn"
            onClick={() => onOpenSheet?.('settings')}
            title="Cài đặt"
            aria-label="Cài đặt video"
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* ── 2. CENTER STAGE CINEMA: TUA LÙI 10S - PLAY/PAUSE LỚN - TUA TỚI 10S ── */}
      <div className="player-mobile-controls__center-stage">
        <button
          type="button"
          className="player-mobile-controls__center-btn player-mobile-controls__center-btn--seek"
          onClick={(e) => {
            e.stopPropagation();
            onSeekRelative?.(-10);
          }}
          title="Tua lùi 10 giây"
          aria-label="Tua lùi 10 giây"
        >
          <RotateCcw size={26} />
          <span className="player-mobile-controls__center-btn-label">10</span>
        </button>

        <button
          type="button"
          className="player-mobile-controls__center-btn player-mobile-controls__center-btn--play"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay?.();
          }}
          title={isPlaying ? 'Tạm dừng' : 'Phát'}
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {isPlaying ? (
            <Pause size={34} />
          ) : (
            <Play size={34} fill="currentColor" className="player-mobile-controls__play-icon" />
          )}
        </button>

        <button
          type="button"
          className="player-mobile-controls__center-btn player-mobile-controls__center-btn--seek"
          onClick={(e) => {
            e.stopPropagation();
            onSeekRelative?.(10);
          }}
          title="Tua tới 10 giây"
          aria-label="Tua tới 10 giây"
        >
          <RotateCw size={26} />
          <span className="player-mobile-controls__center-btn-label">10</span>
        </button>
      </div>

      {/* ── 3. BOTTOM BAR MOBILE: SEEKBAR FULL-WIDTH & CÁC NÚT ĐIỀU HƯỚNG ── */}
      <div className="player-mobile-controls__bottom-bar">
        <div className="player-mobile-controls__seekbar-wrapper">
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

        <div className="player-mobile-controls__bottom-row">
          <div className="player-mobile-controls__bottom-left">
            <div className="player-mobile-controls__time-display">
              <span className="player-mobile-controls__time-current">{formatTime(currentTime)}</span>
              <span className="player-mobile-controls__time-separator">/</span>
              <span className="player-mobile-controls__time-duration">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-mobile-controls__bottom-actions">
            {/* Nút Khóa màn hình */}
            {onLockScreen && (
              <button
                type="button"
                className="player-mobile-controls__action-btn player-mobile-controls__lock-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onLockScreen();
                }}
                title="Khóa màn hình"
                aria-label="Khóa màn hình"
              >
                <Lock size={20} />
              </button>
            )}

            {onNextEpisode && (
              <button
                type="button"
                className="player-mobile-controls__action-btn"
                onClick={onNextEpisode}
                title="Tập tiếp theo"
                aria-label="Tập tiếp theo"
              >
                <SkipForward size={22} />
              </button>
            )}

            <button
              type="button"
              className="player-mobile-controls__action-btn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              aria-label={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

PlayerMobileControls.propTypes = {
  isVisible: PropTypes.bool,
  isPlaying: PropTypes.bool,
  isScreenLocked: PropTypes.bool,
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  bufferedEnd: PropTypes.number,
  playbackRate: PropTypes.number,
  volume: PropTypes.number,
  isMuted: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  onBack: PropTypes.func,
  isFullscreen: PropTypes.bool,
  isPip: PropTypes.bool,
  hasStoryboard: PropTypes.bool,
  chapters: PropTypes.array,
  currentSubtitleId: PropTypes.string,
  onTogglePlay: PropTypes.func,
  onSeek: PropTypes.func,
  onSeekRelative: PropTypes.func,
  onToggleFullscreen: PropTypes.func,
  onTogglePip: PropTypes.func,
  onChangeVolume: PropTypes.func,
  onToggleMute: PropTypes.func,
  onNextEpisode: PropTypes.func,
  onOpenSheet: PropTypes.func,
  onLockScreen: PropTypes.func,
  renderPreviewToCanvas: PropTypes.func,
};

export default PlayerMobileControls;
