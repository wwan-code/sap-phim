/**
 * @file PlayerShortcutsOverlay.jsx
 * @module Components/VideoPlayer/Components
 * @description Bảng hướng dẫn phím tắt (Keyboard Shortcuts Modal) chuẩn YouTube Player & Accessible WCAG.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Keyboard, X } from 'lucide-react';

import { usePlayerStore } from '../hooks/use-player-store';
import './player-shortcuts-overlay.scss';

const SHORTCUTS_LIST = [
  { desc: 'Phát / Tạm dừng video', keys: ['Space', 'K'] },
  { desc: 'Tua lùi / Tua tới 10 giây', keys: ['J', 'L'] },
  { desc: 'Tua lùi / Tua tới 5 giây', keys: ['←', '→'] },
  { desc: 'Tăng / Giảm âm lượng 5%', keys: ['↑', '↓'] },
  { desc: 'Bật / Tắt tiếng (Mute)', keys: ['M'] },
  { desc: 'Bật / Tắt phụ đề (CC)', keys: ['C'] },
  { desc: 'Toàn màn hình (Fullscreen)', keys: ['F'] },
  { desc: 'Rạp chiếu phim (Theater Mode)', keys: ['T'] },
  { desc: 'Hình trong hình (PiP)', keys: ['I'] },
  { desc: 'Tua nhanh tới 0% - 90% thời lượng', keys: ['0..9'] },
  { desc: 'Từng khung hình (khi tạm dừng)', keys: [',', '.'] },
  { desc: 'Về đầu / Về cuối video', keys: ['Home', 'End'] },
  { desc: 'Mở / Đóng bảng phím tắt này', keys: ['?'] },
];

export const PlayerShortcutsOverlay = memo(({ isOpen: propIsOpen, onClose }) => {
  const storeIsOpen = usePlayerStore((s) => s.isShortcutsOpen);
  const setIsShortcutsOpen = usePlayerStore((s) => s.setIsShortcutsOpen);

  const isOpen = typeof propIsOpen === 'boolean' ? propIsOpen : storeIsOpen;

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsShortcutsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="player-shortcuts-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Danh sách phím tắt bàn phím"
      onClick={handleClose}
    >
      <div
        className="player-shortcuts-modal__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="player-shortcuts-modal__header">
          <h2 className="player-shortcuts-modal__title">
            <Keyboard size={20} />
            <span>Phím tắt bàn phím</span>
          </h2>
          <button
            type="button"
            className="player-shortcuts-modal__close-btn"
            onClick={handleClose}
            aria-label="Đóng bảng phím tắt"
            title="Đóng (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="player-shortcuts-modal__list">
          {SHORTCUTS_LIST.map((item, idx) => (
            <div key={idx} className="player-shortcuts-modal__item">
              <span className="player-shortcuts-modal__desc">{item.desc}</span>
              <div className="player-shortcuts-modal__keys">
                {item.keys.map((k, kIdx) => (
                  <React.Fragment key={kIdx}>
                    <kbd className="player-shortcuts-modal__key">{k}</kbd>
                    {kIdx < item.keys.length - 1 && (
                      <span className="player-shortcuts-modal__or">/</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

PlayerShortcutsOverlay.displayName = 'PlayerShortcutsOverlay';

PlayerShortcutsOverlay.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};

export default PlayerShortcutsOverlay;
