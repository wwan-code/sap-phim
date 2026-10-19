/**
 * @file PlayerBottomSheet.jsx
 * @module Components/VideoPlayer/Components
 * @description Ngăn kéo cảm ứng đáy màn hình (Unified Bottom Sheet) dành riêng cho Mobile & Tablet-Portrait.
 * Tích hợp đa tab Cài đặt, Phụ đề, Tốc độ phát và Hẹn giờ đi ngủ chuẩn Aesthetic OS.
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Settings,
  Subtitles,
} from 'lucide-react';

import SubtitleCustomizationView from './SubtitleCustomizationView';
import { SLEEP_TIMER_OPTIONS } from '../hooks/use-sleep-timer';
import { DEFAULT_SUBTITLE_STYLES } from '../constants/subtitle-customization.constants';
import './player-bottom-sheet.scss';

const PLAYBACK_SPEEDS = [
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x (Chuẩn)' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
];

export const PlayerBottomSheet = ({
  isOpen = false,
  onClose,
  initialTab = 'settings',
  qualities = [],
  currentQualityIndex = -1,
  onSelectQuality,
  playbackRate = 1,
  onChangePlaybackRate,
  subtitles = [],
  currentSubtitleId = null,
  onSelectSubtitle,
  subtitleStyles = DEFAULT_SUBTITLE_STYLES,
  onChangeSubtitleStyles,
  sleepTimerOption = null,
  onSelectSleepTimer,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [subView, setSubView] = useState(null); // 'quality' | 'speed' | 'subtitle-custom' | 'sleep-timer'
  const sheetPanelRef = useRef(null);
  const dragStartYRef = useRef(0);
  const currentDragYRef = useRef(0);

  // Đồng bộ tab khi mở lại sheet
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSubView(null);
    }
  }, [isOpen, initialTab]);

  // Cử chỉ vuốt xuống trên handle bar để đóng sheet
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    dragStartYRef.current = e.touches[0].clientY;
    currentDragYRef.current = 0;
  };

  const handleTouchMove = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const deltaY = e.touches[0].clientY - dragStartYRef.current;
    if (deltaY > 0 && sheetPanelRef.current) {
      currentDragYRef.current = deltaY;
      sheetPanelRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (sheetPanelRef.current) {
      sheetPanelRef.current.style.transform = '';
    }
    // Nếu vuốt xuống hơn 80px -> Đóng sheet
    if (currentDragYRef.current > 80) {
      onClose?.();
    }
    currentDragYRef.current = 0;
  };

  // Tên chất lượng hiện tại
  const qualityLabel =
    currentQualityIndex === -1
      ? 'Tự động (Auto)'
      : qualities.find((q) => q.index === currentQualityIndex)?.name || 'Tự động';

  const speedLabel = playbackRate === 1 ? '1x (Chuẩn)' : `${playbackRate}x`;

  const sleepTimerLabel =
    sleepTimerOption === null || sleepTimerOption === undefined
      ? 'Tắt'
      : sleepTimerOption === 'end_of_episode'
        ? 'Khi hết tập'
        : `${sleepTimerOption} phút`;

  const getHeaderTitle = () => {
    if (subView === 'quality') return 'Chất lượng video';
    if (subView === 'speed') return 'Tốc độ phát';
    if (subView === 'subtitle-custom') return 'Tùy chỉnh phụ đề';
    if (subView === 'sleep-timer') return 'Hẹn giờ đi ngủ';
    return activeTab === 'settings' ? 'Cài đặt video' : 'Phụ đề video';
  };

  return (
    <div
      className={`player-bottom-sheet ${isOpen ? 'player-bottom-sheet--open' : ''}`}
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt và phụ đề video"
    >
      {/* Lớp phủ Backdrop mờ */}
      <div
        className="player-bottom-sheet__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Khung nội dung Bottom Sheet */}
      <div
        ref={sheetPanelRef}
        className="player-bottom-sheet__panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh nắm kéo (Drag Handle Bar) */}
        <div
          className="player-bottom-sheet__handle-bar"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="player-bottom-sheet__handle-indicator" />
        </div>

        {/* Header có nút Back hoặc Đóng */}
        <div className="player-bottom-sheet__header">
          <div className="player-bottom-sheet__header-left">
            {subView && (
              <button
                type="button"
                className="player-bottom-sheet__back-btn"
                onClick={() => setSubView(null)}
                aria-label="Quay lại"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            <span className="player-bottom-sheet__title">{getHeaderTitle()}</span>
          </div>

          <button
            type="button"
            className="player-bottom-sheet__close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs chuyển đổi giữa Cài đặt và Phụ đề khi không ở Subview */}
        {!subView && (
          <div className="player-bottom-sheet__tabs">
            <button
              type="button"
              className={`player-bottom-sheet__tab-btn ${activeTab === 'settings' ? 'player-bottom-sheet__tab-btn--active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={18} />
              <span>Cài đặt</span>
            </button>

            <button
              type="button"
              className={`player-bottom-sheet__tab-btn ${activeTab === 'subtitles' ? 'player-bottom-sheet__tab-btn--active' : ''}`}
              onClick={() => setActiveTab('subtitles')}
            >
              <Subtitles size={18} />
              <span>Phụ đề</span>
            </button>
          </div>
        )}

        {/* Thân nội dung Bottom Sheet */}
        <div className="player-bottom-sheet__content">
          {/* 1. Subview: Chọn chất lượng video */}
          {subView === 'quality' && (
            <div className="player-bottom-sheet__options">
              <button
                type="button"
                className={`player-bottom-sheet__option ${currentQualityIndex === -1 ? 'player-bottom-sheet__option--active' : ''}`}
                onClick={() => {
                  onSelectQuality?.(-1);
                  setSubView(null);
                  onClose?.();
                }}
              >
                <span>Tự động (Auto)</span>
                {currentQualityIndex === -1 && <Check size={18} />}
              </button>

              {qualities.map((q) => (
                <button
                  key={q.index}
                  type="button"
                  className={`player-bottom-sheet__option ${currentQualityIndex === q.index ? 'player-bottom-sheet__option--active' : ''}`}
                  onClick={() => {
                    onSelectQuality?.(q.index);
                    setSubView(null);
                    onClose?.();
                  }}
                >
                  <span>{q.name}</span>
                  {currentQualityIndex === q.index && <Check size={18} />}
                </button>
              ))}
            </div>
          )}

          {/* 2. Subview: Chọn tốc độ phát */}
          {subView === 'speed' && (
            <div className="player-bottom-sheet__options">
              {PLAYBACK_SPEEDS.map((s) => {
                const isSelected = playbackRate === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    className={`player-bottom-sheet__option ${isSelected ? 'player-bottom-sheet__option--active' : ''}`}
                    onClick={() => {
                      onChangePlaybackRate?.(s.value);
                      setSubView(null);
                      onClose?.();
                    }}
                  >
                    <span>{s.label}</span>
                    {isSelected && <Check size={18} />}
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Subview: Tuỳ chỉnh phụ đề chuyên sâu */}
          {subView === 'subtitle-custom' && (
            <SubtitleCustomizationView
              styles={subtitleStyles}
              onChangeStyles={onChangeSubtitleStyles}
              onBack={() => setSubView(null)}
            />
          )}

          {/* 4. Subview: Hẹn giờ đi ngủ */}
          {subView === 'sleep-timer' && (
            <div className="player-bottom-sheet__options">
              {SLEEP_TIMER_OPTIONS.map((opt) => {
                const isSelected = sleepTimerOption === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    className={`player-bottom-sheet__option ${isSelected ? 'player-bottom-sheet__option--active' : ''}`}
                    onClick={() => {
                      onSelectSleepTimer?.(opt.value);
                      setSubView(null);
                      onClose?.();
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={18} />}
                  </button>
                );
              })}
            </div>
          )}

          {/* 5. Tab chính: Cài đặt chung */}
          {!subView && activeTab === 'settings' && (
            <div className="player-bottom-sheet__list">
              <button
                type="button"
                className="player-bottom-sheet__item"
                onClick={() => setSubView('quality')}
              >
                <span className="player-bottom-sheet__item-label">Chất lượng video</span>
                <div className="player-bottom-sheet__item-right">
                  <span className="player-bottom-sheet__item-value">{qualityLabel}</span>
                  <ChevronRight size={18} />
                </div>
              </button>

              <button
                type="button"
                className="player-bottom-sheet__item"
                onClick={() => setSubView('speed')}
              >
                <span className="player-bottom-sheet__item-label">Tốc độ phát</span>
                <div className="player-bottom-sheet__item-right">
                  <span className="player-bottom-sheet__item-value">{speedLabel}</span>
                  <ChevronRight size={18} />
                </div>
              </button>

              <button
                type="button"
                className="player-bottom-sheet__item"
                onClick={() => setSubView('sleep-timer')}
              >
                <span className="player-bottom-sheet__item-label">Hẹn giờ đi ngủ</span>
                <div className="player-bottom-sheet__item-right">
                  <span className="player-bottom-sheet__item-value">{sleepTimerLabel}</span>
                  <ChevronRight size={18} />
                </div>
              </button>

              <button
                type="button"
                className="player-bottom-sheet__item"
                onClick={() => setActiveTab('subtitles')}
              >
                <span className="player-bottom-sheet__item-label">Phụ đề</span>
                <div className="player-bottom-sheet__item-right">
                  <span className="player-bottom-sheet__item-value">
                    {currentSubtitleId
                      ? subtitles.find((s) => (s.id || s.language) === currentSubtitleId)?.label || 'Bật'
                      : 'Tắt'}
                  </span>
                  <ChevronRight size={18} />
                </div>
              </button>
            </div>
          )}

          {/* 6. Tab chính: Phụ đề */}
          {!subView && activeTab === 'subtitles' && (
            <div className="player-bottom-sheet__options">
              {/* Tùy chọn Tắt */}
              <button
                type="button"
                className={`player-bottom-sheet__option ${!currentSubtitleId ? 'player-bottom-sheet__option--active' : ''}`}
                onClick={() => {
                  onSelectSubtitle?.(null);
                  onClose?.();
                }}
              >
                <span>Tắt phụ đề</span>
                {!currentSubtitleId && <Check size={18} />}
              </button>

              {/* Danh sách ngôn ngữ phụ đề */}
              {subtitles.map((sub) => {
                const subId = sub.id || sub.language;
                const isSelected = currentSubtitleId === subId;

                return (
                  <button
                    key={subId}
                    type="button"
                    className={`player-bottom-sheet__option ${isSelected ? 'player-bottom-sheet__option--active' : ''}`}
                    onClick={() => {
                      onSelectSubtitle?.(subId);
                      onClose?.();
                    }}
                  >
                    <span>{sub.label || sub.language?.toUpperCase()}</span>
                    {isSelected && <Check size={18} />}
                  </button>
                );
              })}

              <div className="player-bottom-sheet__divider" />

              {/* Nút chuyển sang tuỳ chỉnh giao diện phụ đề */}
              <button
                type="button"
                className="player-bottom-sheet__item"
                onClick={() => setSubView('subtitle-custom')}
              >
                <span className="player-bottom-sheet__item-label">Tùy chỉnh phụ đề</span>
                <div className="player-bottom-sheet__item-right">
                  <ChevronRight size={18} />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

PlayerBottomSheet.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  initialTab: PropTypes.oneOf(['settings', 'subtitles']),
  qualities: PropTypes.array,
  currentQualityIndex: PropTypes.number,
  onSelectQuality: PropTypes.func,
  playbackRate: PropTypes.number,
  onChangePlaybackRate: PropTypes.func,
  subtitles: PropTypes.array,
  currentSubtitleId: PropTypes.string,
  onSelectSubtitle: PropTypes.func,
  subtitleStyles: PropTypes.object,
  onChangeSubtitleStyles: PropTypes.func,
  sleepTimerOption: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelectSleepTimer: PropTypes.func,
};

export default PlayerBottomSheet;
