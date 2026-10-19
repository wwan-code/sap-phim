/**
 * @file SubtitleCustomizationView.jsx
 * @module Components/VideoPlayer/Components/SubtitleCustomizationView
 * @description Màn hình tùy chỉnh giao diện phụ đề chuyên sâu (Màu chữ, Cỡ chữ, Độ trong, Font chữ, Viền chữ, Màu nền, Độ trong nền).
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight, Check, RotateCcw } from 'lucide-react';

import {
  SUBTITLE_TEXT_COLORS,
  SUBTITLE_FONT_SIZES,
  SUBTITLE_TEXT_OPACITIES,
  SUBTITLE_FONTS,
  SUBTITLE_TEXT_EDGES,
  SUBTITLE_BG_COLORS,
  SUBTITLE_BG_OPACITIES,
  DEFAULT_SUBTITLE_STYLES,
} from '../constants/subtitle-customization.constants';

export const SubtitleCustomizationView = ({
  styles = DEFAULT_SUBTITLE_STYLES,
  onChangeStyles,
  onBack,
}) => {
  // subView: 'menu' | 'textColor' | 'textSize' | 'textOpacity' | 'fontFamily' | 'textEdge' | 'bgColor' | 'bgOpacity'
  const [subView, setSubView] = useState('menu');

  const currentStyles = { ...DEFAULT_SUBTITLE_STYLES, ...styles };

  const handleUpdate = (key, value) => {
    const updated = { ...currentStyles, [key]: value };
    onChangeStyles?.(updated);
  };

  const handleReset = () => {
    onChangeStyles?.(DEFAULT_SUBTITLE_STYLES);
  };

  const getLabel = (options, value) => {
    const found = options.find((opt) => opt.value === value);
    return found ? found.label : value;
  };

  const getColor = (options, value) => {
    const found = options.find((opt) => opt.value === value);
    return found ? found.color : null;
  };

  // ── 1. Màn hình chi tiết: Màu chữ ──
  if (subView === 'textColor') {
    return (
      <div className="player-settings__view player-settings__view--slide-forward">
        <button
          type="button"
          className="player-settings__back-btn"
          onClick={() => setSubView('menu')}
        >
          <ChevronLeft size={16} />
          <span>Màu chữ</span>
        </button>
        <div className="player-settings__body">
          <div className="player-settings__options">
            {SUBTITLE_TEXT_COLORS.map((opt) => {
              const isSelected = currentStyles.textColor === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                  onClick={() => {
                    handleUpdate('textColor', opt.value);
                    setSubView('menu');
                  }}
                >
                  <div className="player-settings__option-content">
                    <span
                      className="player-settings__color-dot"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check size={15} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Màn hình chi tiết: Cỡ chữ ──
  if (subView === 'textSize') {
    return (
      <div className="player-settings__view player-settings__view--slide-forward">
        <button
          type="button"
          className="player-settings__back-btn"
          onClick={() => setSubView('menu')}
        >
          <ChevronLeft size={16} />
          <span>Cỡ chữ</span>
        </button>
        <div className="player-settings__body">
          <div className="player-settings__options">
            {SUBTITLE_FONT_SIZES.map((opt) => {
              const isSelected = currentStyles.textSize === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                  onClick={() => {
                    handleUpdate('textSize', opt.value);
                    setSubView('menu');
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
    );
  }

  // ── 3. Màn hình chi tiết: Độ trong chữ ──
  if (subView === 'textOpacity') {
    return (
      <div className="player-settings__view player-settings__view--slide-forward">
        <button
          type="button"
          className="player-settings__back-btn"
          onClick={() => setSubView('menu')}
        >
          <ChevronLeft size={16} />
          <span>Độ trong</span>
        </button>
        <div className="player-settings__body">
          <div className="player-settings__options">
            {SUBTITLE_TEXT_OPACITIES.map((opt) => {
              const isSelected = currentStyles.textOpacity === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                  onClick={() => {
                    handleUpdate('textOpacity', opt.value);
                    setSubView('menu');
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
    );
  }

  // ── 4. Màn hình chi tiết: Font chữ ──
  if (subView === 'fontFamily') {
    return (
      <div className="player-settings__view player-settings__view--slide-forward">
        <button
          type="button"
          className="player-settings__back-btn"
          onClick={() => setSubView('menu')}
        >
          <ChevronLeft size={16} />
          <span>Font chữ</span>
        </button>
        <div className="player-settings__body">
          <div className="player-settings__options">
            {SUBTITLE_FONTS.map((opt) => {
              const isSelected = currentStyles.fontFamily === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                  onClick={() => {
                    handleUpdate('fontFamily', opt.value);
                    setSubView('menu');
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
    );
  }

  // ── 5. Màn hình chi tiết: Viền chữ ──
  if (subView === 'textEdge') {
    return (
      <div className="player-settings__view player-settings__view--slide-forward">
        <button
          type="button"
          className="player-settings__back-btn"
          onClick={() => setSubView('menu')}
        >
          <ChevronLeft size={16} />
          <span>Viền chữ</span>
        </button>
        <div className="player-settings__body">
          <div className="player-settings__options">
            {SUBTITLE_TEXT_EDGES.map((opt) => {
              const isSelected = currentStyles.textEdge === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                  onClick={() => {
                    handleUpdate('textEdge', opt.value);
                    setSubView('menu');
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
    );
  }

  // ── 6. Màn hình chi tiết: Màu nền ──
  if (subView === 'bgColor') {
    return (
      <div className="player-settings__view player-settings__view--slide-forward">
        <button
          type="button"
          className="player-settings__back-btn"
          onClick={() => setSubView('menu')}
        >
          <ChevronLeft size={16} />
          <span>Màu nền</span>
        </button>
        <div className="player-settings__body">
          <div className="player-settings__options">
            {SUBTITLE_BG_COLORS.map((opt) => {
              const isSelected = currentStyles.bgColor === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                  onClick={() => {
                    handleUpdate('bgColor', opt.value);
                    setSubView('menu');
                  }}
                >
                  <div className="player-settings__option-content">
                    {opt.color !== 'transparent' && (
                      <span
                        className="player-settings__color-dot"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check size={15} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── 7. Màn hình chi tiết: Độ trong nền ──
  if (subView === 'bgOpacity') {
    return (
      <div className="player-settings__view player-settings__view--slide-forward">
        <button
          type="button"
          className="player-settings__back-btn"
          onClick={() => setSubView('menu')}
        >
          <ChevronLeft size={16} />
          <span>Độ trong nền</span>
        </button>
        <div className="player-settings__body">
          <div className="player-settings__options">
            {SUBTITLE_BG_OPACITIES.map((opt) => {
              const isSelected = currentStyles.bgOpacity === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`player-settings__option ${isSelected ? 'player-settings__option--active' : ''}`}
                  onClick={() => {
                    handleUpdate('bgOpacity', opt.value);
                    setSubView('menu');
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
    );
  }

  // ── Menu tổng: Danh sách các thuộc tính tùy chỉnh ──
  const textColorObj = SUBTITLE_TEXT_COLORS.find((o) => o.value === currentStyles.textColor);
  const bgColorObj = SUBTITLE_BG_COLORS.find((o) => o.value === currentStyles.bgColor);

  return (
    <div className="player-settings__view player-settings__view--slide-forward">
      <button
        type="button"
        className="player-settings__back-btn"
        onClick={onBack}
      >
        <ChevronLeft size={16} />
        <span>Tuỳ chỉnh</span>
      </button>

      <div className="player-settings__body">
        <div className="player-settings__section-title player-settings__section-title--sub">
          Phụ đề chính
        </div>

        <div className="player-settings__list">
          {/* Màu chữ */}
          <button
            type="button"
            className="player-settings__item"
            onClick={() => setSubView('textColor')}
          >
            <span className="player-settings__item-label">Màu chữ</span>
            <div className="player-settings__item-right">
              {textColorObj && (
                <span
                  className="player-settings__color-dot"
                  style={{ backgroundColor: textColorObj.color }}
                />
              )}
              <span className="player-settings__item-value">
                {textColorObj?.label || currentStyles.textColor}
              </span>
              <ChevronRight size={15} />
            </div>
          </button>

          {/* Cỡ chữ */}
          <button
            type="button"
            className="player-settings__item"
            onClick={() => setSubView('textSize')}
          >
            <span className="player-settings__item-label">Cỡ chữ</span>
            <div className="player-settings__item-right">
              <span className="player-settings__item-value">
                {getLabel(SUBTITLE_FONT_SIZES, currentStyles.textSize)}
              </span>
              <ChevronRight size={15} />
            </div>
          </button>

          {/* Độ trong */}
          <button
            type="button"
            className="player-settings__item"
            onClick={() => setSubView('textOpacity')}
          >
            <span className="player-settings__item-label">Độ trong</span>
            <div className="player-settings__item-right">
              <span className="player-settings__item-value">
                {getLabel(SUBTITLE_TEXT_OPACITIES, currentStyles.textOpacity)}
              </span>
              <ChevronRight size={15} />
            </div>
          </button>

          {/* Font chữ */}
          <button
            type="button"
            className="player-settings__item"
            onClick={() => setSubView('fontFamily')}
          >
            <span className="player-settings__item-label">Font chữ</span>
            <div className="player-settings__item-right">
              <span className="player-settings__item-value">
                {getLabel(SUBTITLE_FONTS, currentStyles.fontFamily)}
              </span>
              <ChevronRight size={15} />
            </div>
          </button>

          {/* Viền chữ */}
          <button
            type="button"
            className="player-settings__item"
            onClick={() => setSubView('textEdge')}
          >
            <span className="player-settings__item-label">Viền chữ</span>
            <div className="player-settings__item-right">
              <span className="player-settings__item-value">
                {getLabel(SUBTITLE_TEXT_EDGES, currentStyles.textEdge)}
              </span>
              <ChevronRight size={15} />
            </div>
          </button>

          {/* Màu nền */}
          <button
            type="button"
            className="player-settings__item"
            onClick={() => setSubView('bgColor')}
          >
            <span className="player-settings__item-label">Màu nền</span>
            <div className="player-settings__item-right">
              {bgColorObj && bgColorObj.color !== 'transparent' && (
                <span
                  className="player-settings__color-dot"
                  style={{ backgroundColor: bgColorObj.color }}
                />
              )}
              <span className="player-settings__item-value">
                {bgColorObj?.label || currentStyles.bgColor}
              </span>
              <ChevronRight size={15} />
            </div>
          </button>

          {/* Độ trong nền */}
          <button
            type="button"
            className="player-settings__item"
            onClick={() => setSubView('bgOpacity')}
          >
            <span className="player-settings__item-label">Độ trong nền</span>
            <div className="player-settings__item-right">
              <span className="player-settings__item-value">
                {getLabel(SUBTITLE_BG_OPACITIES, currentStyles.bgOpacity)}
              </span>
              <ChevronRight size={15} />
            </div>
          </button>
        </div>

        <div className="player-settings__section-divider" />

        {/* Nút đặt lại mặc định */}
        <button
          type="button"
          className="player-settings__reset-btn"
          onClick={handleReset}
        >
          <RotateCcw size={13} />
          <span>Đặt lại mặc định</span>
        </button>
      </div>
    </div>
  );
};

SubtitleCustomizationView.propTypes = {
  styles: PropTypes.object,
  onChangeStyles: PropTypes.func,
  onBack: PropTypes.func.isRequired,
};

export default SubtitleCustomizationView;
