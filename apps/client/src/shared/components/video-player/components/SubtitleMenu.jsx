/**
 * @file SubtitleMenu.jsx
 * @module Components/VideoPlayer/Components/SubtitleMenu
 * @description Popover lựa chọn ngôn ngữ phụ đề và chuyển hướng sang màn hình tùy chỉnh giao diện phụ đề.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Check, ChevronRight } from 'lucide-react';

import { usePlayerPopover } from '../hooks/use-player-popover';
import { SubtitleCustomizationView } from './SubtitleCustomizationView';
import { DEFAULT_SUBTITLE_STYLES } from '../constants/subtitle-customization.constants';

/**
 * Biểu tượng Closed Captions (CC)
 */
export const CcIcon = ({ size = 22, className = '' }) => (
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
    <rect x="2" y="4" width="20" height="16" rx="3.5" />
    <path d="M10 9.2a2 2 0 0 0-2 2v1.6a2 2 0 0 0 2 2 1.8 1.8 0 0 0 1.5-1" />
    <path d="M17 9.2a2 2 0 0 0-2 2v1.6a2 2 0 0 0 2 2 1.8 1.8 0 0 0 1.5-1" />
  </svg>
);

CcIcon.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};

export const SubtitleMenu = ({
  subtitles = [],
  currentSubtitleId = null,
  onSelectSubtitle,
  subtitleStyles = DEFAULT_SUBTITLE_STYLES,
  onChangeSubtitleStyles,
}) => {
  const hasSubtitles = Array.isArray(subtitles) && subtitles.length > 0;

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
  } = usePlayerPopover({ initialView: 'list' });

  if (!hasSubtitles) return null;

  return (
    <div className="player-settings player-subtitle-menu">
      <button
        ref={refs.setReference}
        type="button"
        className={`player-controls__btn player-subtitle-menu__btn ${currentSubtitleId ? 'player-controls__btn--active player-controls__btn--sub-active' : ''} ${isOpen ? 'player-settings__btn--open' : ''}`}
        {...getReferenceProps()}
        title={currentSubtitleId ? 'Cài đặt phụ đề (C)' : 'Bật phụ đề (C)'}
        aria-label="Phụ đề video"
        aria-expanded={isOpen}
      >
        <CcIcon size={22} />
      </button>

      {isMounted && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps({
            className: `player-settings__popover player-subtitle-menu__popover player-settings__popover--${phase}`,
            role: 'dialog',
            'aria-label': 'Phụ đề',
          })}
        >
          {view === 'list' ? (
            <div className="player-settings__view player-settings__view--slide-forward">
                <div className="player-settings__header">
                  <span className="player-settings__title">Phụ đề</span>
                </div>

                <div className="player-settings__body">
                  <div className="player-settings__options">
                    {/* Tùy chọn Tắt */}
                    <button
                      type="button"
                      className={`player-settings__option ${!currentSubtitleId ? 'player-settings__option--active' : ''}`}
                      onClick={() => {
                        onSelectSubtitle?.(null);
                        setIsOpen(false);
                      }}
                    >
                      <span>Tắt</span>
                      {!currentSubtitleId && <Check size={15} />}
                    </button>

                    {/* Danh sách ngôn ngữ */}
                    {subtitles.map((sub) => {
                      const subId = sub.id || sub.language;
                      const isSelected = currentSubtitleId === subId;

                      return (
                        <button
                          key={subId}
                          type="button"
                          className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                          onClick={() => {
                            onSelectSubtitle?.(subId);
                            setIsOpen(false);
                          }}
                        >
                          <span>{sub.label || sub.language?.toUpperCase()}</span>
                          {isSelected && <Check size={15} />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="player-settings__section-divider" />

                  {/* Mục chuyển sang Tuỳ chỉnh */}
                  <button
                    type="button"
                    className="player-settings__item player-subtitle-menu__customize-item"
                    onClick={() => navigateToView('customize', 'forward')}
                  >
                    <span className="player-settings__item-label">Tùy chỉnh phụ đề</span>
                    <div className="player-settings__item-right">
                      <ChevronRight size={15} />
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <SubtitleCustomizationView
                styles={subtitleStyles}
                onChangeStyles={onChangeSubtitleStyles}
                onBack={() => navigateToView('list', 'backward')}
              />
            )}
        </div>
      )}
    </div>
  );
};

SubtitleMenu.propTypes = {
  subtitles: PropTypes.array,
  currentSubtitleId: PropTypes.string,
  onSelectSubtitle: PropTypes.func,
  subtitleStyles: PropTypes.object,
  onChangeSubtitleStyles: PropTypes.func,
};

export default SubtitleMenu;
