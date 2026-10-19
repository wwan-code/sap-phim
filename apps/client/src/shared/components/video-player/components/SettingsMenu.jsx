/**
 * @file SettingsMenu.jsx
 * @module Components/VideoPlayer/Components/SettingsMenu
 * @description Menu cài đặt video đa cấp (Chất lượng ABR, Phụ đề, Tốc độ phát, Hẹn giờ đi ngủ) chuẩn Aesthetic OS.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

import { usePlayerPopover } from '../hooks/use-player-popover';
import { SLEEP_TIMER_OPTIONS } from '../hooks/use-sleep-timer';
import { SubtitleCustomizationView } from './SubtitleCustomizationView';
import { DEFAULT_SUBTITLE_STYLES } from '../constants/subtitle-customization.constants';

const PLAYBACK_SPEEDS = [
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x (Chuẩn)' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
];

/**
 * Biểu tượng Hexagon Nut theo thiết kế mockup
 */
const HexSettingsIcon = ({ size = 22, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <circle cx="12" cy="12" r="3.2" strokeWidth="2.2" />
  </svg>
);

HexSettingsIcon.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};

/**
 * Rút gọn tên chất lượng video để hiển thị trên badge (Auto, 4K, 2K, FHD, HD, SD)
 */
const getQualityBadge = (currentQualityIndex, qualities) => {
  if (currentQualityIndex === -1) return 'Auto';
  const q = qualities.find((item) => item.index === currentQualityIndex);
  if (!q) return 'Auto';
  const name = (q.name || '').toLowerCase();
  if (name.includes('2160') || name.includes('4k')) return '4K';
  if (name.includes('1440') || name.includes('2k')) return '2K';
  if (name.includes('1080')) return 'FHD';
  if (name.includes('720')) return 'HD';
  if (name.includes('480')) return 'SD';
  if (name.includes('360')) return 'SD';
  return q.name || 'HD';
};

export const SettingsMenu = ({
  qualities = [],
  currentQualityIndex = -1,
  onSelectQuality,
  playbackRate = 1,
  onChangePlaybackRate,
  subtitleStyles = DEFAULT_SUBTITLE_STYLES,
  onChangeSubtitleStyles,
  sleepTimerOption = null,
  onSelectSleepTimer,
}) => {
  const {
    isOpen,
    setIsOpen,
    isMounted,
    phase,
    refs,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    view,
    navigateToView,
    slideDirection,
  } = usePlayerPopover({ initialView: 'main' });

  // Nhãn hiển thị hiện tại
  const qualityLabel =
    currentQualityIndex === -1
      ? 'Auto'
      : qualities.find((q) => q.index === currentQualityIndex)?.name || 'Auto';

  const speedLabel = playbackRate === 1 ? '1x' : `${playbackRate}x`;
  const badgeText = getQualityBadge(currentQualityIndex, qualities);

  const sleepTimerLabel =
    sleepTimerOption === null || sleepTimerOption === undefined
      ? 'Tắt'
      : sleepTimerOption === 'end_of_episode'
        ? 'Hết tập'
        : `${sleepTimerOption} phút`;

  return (
    <div className="player-settings">
      <button
        ref={refs.setReference}
        type="button"
        className={`player-controls__btn player-settings__btn ${isOpen ? 'player-controls__btn--active player-settings__btn--open' : ''}`}
        {...getReferenceProps()}
        title={`Cài đặt (${badgeText})`}
        aria-label="Cài đặt video"
        aria-expanded={isOpen}
      >
        <span className="player-settings__trigger-wrap">
          <HexSettingsIcon
            size={22}
            className={`player-settings__hex-icon ${isOpen ? 'player-settings__hex-icon--open' : ''}`}
          />
          <span className="player-settings__badge">{badgeText}</span>
        </span>
      </button>

      {isMounted && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps({
            className: `player-settings__popover player-settings__popover--${phase}`,
            role: 'dialog',
            'aria-label': 'Cài đặt',
          })}
        >
          {/* ── 1. MENU CHÍNH (MAIN VIEW) ── */}
          {view === 'main' && (
            <div
              key="main"
              className={`player-settings__view player-settings__view--slide-${slideDirection}`}
            >
              <div className="player-settings__header">
                <span className="player-settings__title">Cài đặt</span>
              </div>

              <div className="player-settings__body">
                <div className="player-settings__list">
                  {/* Mục Chất lượng */}
                  <button
                    type="button"
                    className="player-settings__item"
                    onClick={() => navigateToView('quality', 'forward')}
                  >
                    <span className="player-settings__item-label">Chất lượng</span>
                    <div className="player-settings__item-right">
                      <span className="player-settings__item-value">{qualityLabel}</span>
                      <ChevronRight size={16} />
                    </div>
                  </button>

                  {/* Mục Phụ đề (Mở thẳng tùy chỉnh) */}
                  <button
                    type="button"
                    className="player-settings__item"
                    onClick={() => navigateToView('subtitle-custom', 'forward')}
                  >
                    <span className="player-settings__item-label">Phụ đề</span>
                    <div className="player-settings__item-right">
                      <span className="player-settings__item-value">Tuỳ chỉnh</span>
                      <ChevronRight size={16} />
                    </div>
                  </button>

                  {/* Mục Tốc độ */}
                  <button
                    type="button"
                    className="player-settings__item"
                    onClick={() => navigateToView('speed', 'forward')}
                  >
                    <span className="player-settings__item-label">Tốc độ</span>
                    <div className="player-settings__item-right">
                      <span className="player-settings__item-value">{speedLabel}</span>
                      <ChevronRight size={16} />
                    </div>
                  </button>

                  {/* Mục Hẹn giờ đi ngủ */}
                  <button
                    type="button"
                    className="player-settings__item"
                    onClick={() => navigateToView('sleep-timer', 'forward')}
                  >
                    <span className="player-settings__item-label">Hẹn giờ đi ngủ</span>
                    <div className="player-settings__item-right">
                      <span className="player-settings__item-value">{sleepTimerLabel}</span>
                      <ChevronRight size={16} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 2. SUBMENU: CHẤT LƯỢNG (QUALITY) ── */}
          {view === 'quality' && (
            <div
              key="quality"
              className={`player-settings__view player-settings__view--slide-${slideDirection}`}
            >
              <button
                type="button"
                className="player-settings__back-btn"
                onClick={() => navigateToView('main', 'backward')}
              >
                <ChevronLeft size={16} />
                <span>Chất lượng</span>
              </button>

              <div className="player-settings__body">
                <div className="player-settings__options">
                  <button
                    type="button"
                    className={`player-settings__option ${currentQualityIndex === -1 ? 'player-settings__option--active' : ''}`}
                    onClick={() => {
                      onSelectQuality?.(-1);
                      setIsOpen(false);
                    }}
                  >
                    <span>Tự động (Auto)</span>
                    {currentQualityIndex === -1 && <Check size={15} />}
                  </button>

                  {qualities.map((q) => (
                    <button
                      key={q.index}
                      type="button"
                      className={`player-settings__option ${currentQualityIndex === q.index ? 'player-settings__option--active' : ''}`}
                      onClick={() => {
                        onSelectQuality?.(q.index);
                        setIsOpen(false);
                      }}
                    >
                      <span>{q.name}</span>
                      {currentQualityIndex === q.index && <Check size={15} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 3. SUBMENU: TÙY CHỈNH PHỤ ĐỀ (SUBTITLE CUSTOMIZATION) ── */}
          {view === 'subtitle-custom' && (
            <SubtitleCustomizationView
              styles={subtitleStyles}
              onChangeStyles={onChangeSubtitleStyles}
              onBack={() => navigateToView('main', 'backward')}
            />
          )}

          {/* ── 4. SUBMENU: TỐC ĐỘ PHÁT (SPEED) ── */}
          {view === 'speed' && (
            <div
              key="speed"
              className={`player-settings__view player-settings__view--slide-${slideDirection}`}
            >
              <button
                type="button"
                className="player-settings__back-btn"
                onClick={() => navigateToView('main', 'backward')}
              >
                <ChevronLeft size={16} />
                <span>Tốc độ phát</span>
              </button>

              <div className="player-settings__body">
                <div className="player-settings__options">
                  {PLAYBACK_SPEEDS.map((s) => {
                    const isSelected = playbackRate === s.value;

                    return (
                      <button
                        key={s.value}
                        type="button"
                        className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                        onClick={() => {
                          onChangePlaybackRate?.(s.value);
                          setIsOpen(false);
                        }}
                      >
                        <span>{s.label}</span>
                        {isSelected && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── 5. SUBMENU: HẸN GIỜ ĐI NGỦ (SLEEP TIMER) ── */}
          {view === 'sleep-timer' && (
            <div
              key="sleep-timer"
              className={`player-settings__view player-settings__view--slide-${slideDirection}`}
            >
              <button
                type="button"
                className="player-settings__back-btn"
                onClick={() => navigateToView('main', 'backward')}
              >
                <ChevronLeft size={16} />
                <span>Hẹn giờ đi ngủ</span>
              </button>

              <div className="player-settings__body">
                <div className="player-settings__options">
                  {SLEEP_TIMER_OPTIONS.map((opt) => {
                    const isSelected = sleepTimerOption === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                        onClick={() => {
                          onSelectSleepTimer?.(opt.value);
                          setIsOpen(false);
                        }}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

SettingsMenu.propTypes = {
  qualities: PropTypes.arrayOf(
    PropTypes.shape({
      index: PropTypes.number,
      name: PropTypes.string,
    }),
  ),
  currentQualityIndex: PropTypes.number,
  onSelectQuality: PropTypes.func,
  playbackRate: PropTypes.number,
  onChangePlaybackRate: PropTypes.func,
  subtitleStyles: PropTypes.object,
  onChangeSubtitleStyles: PropTypes.func,
  sleepTimerOption: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelectSleepTimer: PropTypes.func,
};

export default SettingsMenu;
