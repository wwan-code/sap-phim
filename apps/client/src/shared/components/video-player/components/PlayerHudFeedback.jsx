/**
 * @file PlayerHudFeedback.jsx
 * @module Components/VideoPlayer/Components
 * @description HUD Phản hồi tương tác trực quan (Play/Pause, Tua ±10s, Âm lượng, Giữ tăng tốc 2x) chuẩn Neural Expressive & Glass Hybrid.
 */

import React, { memo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';

import { usePlayerStore } from '../hooks/use-player-store';
import './player-hud.scss';

export const PlayerHudFeedback = memo(({ hudAction: propHudAction, isMobile = false }) => {
  const storeHudAction = usePlayerStore((s) => s.hudAction);
  const hudAction = propHudAction || storeHudAction;

  const volumeFillRef = useRef(null);

  const fillPercent =
    hudAction?.type === 'volume'
      ? hudAction.value?.isMuted
        ? 0
        : hudAction.value?.percent ?? 100
      : 0;

  useEffect(() => {
    if (volumeFillRef.current) {
      volumeFillRef.current.style.width = `${fillPercent}%`;
    }
  }, [fillPercent]);

  if (!hudAction || !hudAction.type) {
    return null;
  }

  const { id, type, value } = hudAction;

  // Trên Mobile, Center Stage đã có nút Play/Pause lớn riêng biệt nên không cần HUD center pop đè lên
  const isCenterAction = type === 'play' || type === 'pause';
  if (isMobile && isCenterAction) {
    return null;
  }

  return (
    <div key={id} className="player-hud" aria-hidden="true">
      {/* 1. Center Play / Pause Icon Pop */}
      {type === 'play' && (
        <div className="player-hud__center-action">
          <Play size={34} fill="currentColor" />
        </div>
      )}

      {type === 'pause' && (
        <div className="player-hud__center-action">
          <Pause size={34} fill="currentColor" />
        </div>
      )}

      {/* 2. Double-Click Seek Ripple (±10s) */}
      {type === 'seek-backward' && (
        <div className="player-hud__seek-ripple player-hud__seek-ripple--left">
          <RotateCcw size={32} className="player-hud__seek-ripple-icon" />
          <span className="player-hud__seek-ripple-text">-10s</span>
        </div>
      )}

      {type === 'seek-forward' && (
        <div className="player-hud__seek-ripple player-hud__seek-ripple--right">
          <RotateCw size={32} className="player-hud__seek-ripple-icon" />
          <span className="player-hud__seek-ripple-text">+10s</span>
        </div>
      )}

      {/* 3. Top Volume Mini HUD */}
      {type === 'volume' && (
        <div className="player-hud__volume-hud">
          {value?.isMuted || value?.percent === 0 ? (
            <VolumeX size={18} />
          ) : (
            <Volume2 size={18} />
          )}
          <div className="player-hud__volume-track">
            <div ref={volumeFillRef} className="player-hud__volume-fill" />
          </div>
          <span className="player-hud__volume-text">
            {value?.isMuted ? 'Mute' : `${value?.percent ?? 100}%`}
          </span>
        </div>
      )}

      {/* 4. Top 2x Speed Badge (YouTube Long-Press Hold) */}
      {type === 'speed-2x' && (
        <div className="player-hud__speed-badge">
          <Play size={14} fill="currentColor" className="player-hud__speed-badge-icon" />
          <span>{value || '2x'}</span>
        </div>
      )}
    </div>
  );
});

PlayerHudFeedback.displayName = 'PlayerHudFeedback';

PlayerHudFeedback.propTypes = {
  isMobile: PropTypes.bool,
  hudAction: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    type: PropTypes.oneOf([
      'play',
      'pause',
      'seek-backward',
      'seek-forward',
      'volume',
      'speed-2x',
    ]),
    value: PropTypes.any,
  }),
};

export default PlayerHudFeedback;
