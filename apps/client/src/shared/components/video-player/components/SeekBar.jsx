/**
 * @file SeekBar.jsx
 * @module Components/VideoPlayer/Components
 * @description Thanh cuộn thời gian video tương tác (Seek Bar) theo chuẩn YouTube:
 * - Preview-only Seeking: Khi kéo thả (drag/scrub), chỉ cập nhật thumbnail và timeline UI mà KHÔNG làm giật video.currentTime.
 * - Single Commit: Chỉ xác nhận (commit) tua tới vị trí mới khi người dùng nhả chuột hoặc ngón tay.
 * - Hỗ trợ Storyboard Canvas Preview, Chapter Markers và chuẩn Accessible WCAG.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';

import SpritePreviewCanvas from './SpritePreviewCanvas';
import { usePlayerStore, useShallow } from '../hooks/use-player-store';
import { formatTime, formatAriaTime } from '../utils/format-time';

export const SeekBar = ({
  currentTime: propCurrentTime,
  duration: propDuration,
  bufferedEnd: propBufferedEnd,
  onSeek,
  renderPreviewToCanvas,
  hasStoryboard = false,
  chapters = [],
}) => {
  // Đọc state từ Zustand PlayerStore với selector tối ưu
  const storeState = usePlayerStore(
    useShallow((s) => ({
      currentTime: s.currentTime,
      duration: s.duration,
      bufferedEnd: s.bufferedEnd,
      isSeeking: s.isSeeking,
      seekStart: s.seekStart,
      seekPreview: s.seekPreview,
      seekCommit: s.seekCommit,
      seekCancel: s.seekCancel,
    })),
  );

  // Fallback sang props nếu có truyền từ parent
  const currentTime =
    typeof propCurrentTime === 'number' ? propCurrentTime : storeState.currentTime;
  const duration =
    typeof propDuration === 'number' ? propDuration : storeState.duration;
  const bufferedEnd =
    typeof propBufferedEnd === 'number' ? propBufferedEnd : storeState.bufferedEnd;

  const [isHovering, setIsHovering] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [hoverPercent, setHoverPercent] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState(0);
  const [dragTime, setDragTime] = useState(0);

  const trackRef = useRef(null);
  const cachedRectRef = useRef(null);
  const isDraggingRef = useRef(false);
  const latestSeekTimeRef = useRef(null);

  const playedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
  const displayPercent = isDragging ? dragPercent : playedPercent;

  // Lấy bounding rect có lưu cache để hạn chế reflow liên tục
  const getTrackRect = useCallback(() => {
    if (!cachedRectRef.current && trackRef.current) {
      cachedRectRef.current = trackRef.current.getBoundingClientRect();
    }
    return cachedRectRef.current;
  }, []);

  const calculatePosition = useCallback(
    (clientX) => {
      const rect = getTrackRect();
      if (!rect || duration <= 0) return { percent: 0, time: 0, width: 800 };

      const clickX = clientX - rect.left;
      const percent = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
      const time = (percent / 100) * duration;

      return { percent, time, width: rect.width };
    },
    [duration, getTrackRect],
  );

  const handleMouseEnter = () => {
    if (trackRef.current) {
      cachedRectRef.current = trackRef.current.getBoundingClientRect();
    }
  };

  const handleMouseMove = (e) => {
    if (isDraggingRef.current) return;
    const { percent, time } = calculatePosition(e.clientX);
    setHoverPercent(percent);
    setHoverTime(time);
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    if (!isDraggingRef.current) {
      setIsHovering(false);
      cachedRectRef.current = null;
    }
  };

  // 1. Bắt đầu tương tác Seek (MouseDown / TouchStart)
  const startDrag = useCallback(
    (clientX) => {
      if (trackRef.current) {
        cachedRectRef.current = trackRef.current.getBoundingClientRect();
      }
      isDraggingRef.current = true;
      setIsDragging(true);
      setIsHovering(true);

      const { percent, time } = calculatePosition(clientX);
      setDragPercent(percent);
      setDragTime(time);
      setHoverPercent(percent);
      setHoverTime(time);

      latestSeekTimeRef.current = time;

      // Kích hoạt YouTube seekStart & preview trong store
      storeState.seekStart();
      storeState.seekPreview(time, percent);
    },
    [calculatePosition, storeState],
  );

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(e.clientX);
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      startDrag(e.touches[0].clientX);
    }
  };

  // 2. Kéo thả (Window MouseMove / TouchMove) & Kết thúc (MouseUp / TouchEnd)
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const { percent, time } = calculatePosition(e.clientX);
      setDragPercent(percent);
      setDragTime(time);
      setHoverPercent(percent);
      setHoverTime(time);

      latestSeekTimeRef.current = time;

      // CHỈ cập nhật UI preview theo chuẩn YouTube (KHÔNG gọi onSeek hay video.currentTime)
      storeState.seekPreview(time, percent);
    };

    const handleWindowMouseUp = (e) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      setIsHovering(false);
      cachedRectRef.current = null;

      const { time } = calculatePosition(e.clientX);
      const finalTime = isFinite(time) ? time : latestSeekTimeRef.current || 0;

      // Commit duy nhất một lần khi người dùng nhả chuột
      storeState.seekCommit(finalTime);
      onSeek?.(finalTime);
    };

    const handleWindowTouchMove = (e) => {
      if (!isDraggingRef.current || !e.touches || e.touches.length === 0) return;
      const { percent, time } = calculatePosition(e.touches[0].clientX);
      setDragPercent(percent);
      setDragTime(time);
      setHoverPercent(percent);
      setHoverTime(time);

      latestSeekTimeRef.current = time;
      storeState.seekPreview(time, percent);
    };

    const handleWindowTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      setIsHovering(false);
      cachedRectRef.current = null;

      const finalTime = latestSeekTimeRef.current !== null ? latestSeekTimeRef.current : 0;
      storeState.seekCommit(finalTime);
      onSeek?.(finalTime);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', handleWindowTouchEnd);
    window.addEventListener('touchcancel', handleWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
    };
  }, [isDragging, calculatePosition, onSeek, storeState]);

  // 3. Phím tắt bàn phím khi SeekBar nhận focus
  const handleKeyDown = (e) => {
    if (duration <= 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const targetTime = Math.min(duration, currentTime + 5);
      storeState.seekCommit(targetTime);
      onSeek?.(targetTime);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const targetTime = Math.max(0, currentTime - 5);
      storeState.seekCommit(targetTime);
      onSeek?.(targetTime);
    } else if (e.key === 'Home') {
      e.preventDefault();
      storeState.seekCommit(0);
      onSeek?.(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      storeState.seekCommit(duration);
      onSeek?.(duration);
    }
  };

  // Xác định chapter hiện tại tại vị trí hover / drag
  const inspectTime = isDragging ? dragTime : hoverTime;
  const activeChapter =
    chapters && chapters.length > 0 && duration > 0
      ? [...chapters].reverse().find((c) => inspectTime >= c.time)
      : null;

  const displayTime = isDragging ? dragTime : currentTime;
  const ariaValueText = `${formatAriaTime(displayTime)} trên ${formatAriaTime(duration)}${
    activeChapter ? `, Phân đoạn: ${activeChapter.title}` : ''
  }`;

  return (
    <div
      ref={trackRef}
      className={`player-seekbar ${isDragging ? 'player-seekbar--dragging' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-label="Thanh tua thời gian"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(displayTime)}
      aria-valuetext={ariaValueText}
    >
      {/* 1. Tooltip Sprite Canvas Preview */}
      {(isHovering || isDragging) && hasStoryboard && duration > 0 && (
        <SpritePreviewCanvas
          hoverTime={inspectTime}
          hoverPercent={isDragging ? dragPercent : hoverPercent}
          renderPreviewToCanvas={renderPreviewToCanvas}
          containerWidth={trackRef.current?.getBoundingClientRect()?.width || 800}
          chapterTitle={activeChapter?.title}
        />
      )}

      {/* 2. Fallback Tooltip khi không có Storyboard */}
      {(isHovering || isDragging) && !hasStoryboard && duration > 0 && (
        <div
          className="player-seekbar__time-tooltip"
          style={{ left: `${isDragging ? dragPercent : hoverPercent}%` }}
        >
          {activeChapter && (
            <span className="player-seekbar__tooltip-chapter">{activeChapter.title}</span>
          )}
          <span className="player-seekbar__tooltip-time">{formatTime(inspectTime)}</span>
        </div>
      )}

      <div className="player-seekbar__track">
        {/* Thanh đệm tải trước (Buffered) */}
        <div
          className="player-seekbar__buffered"
          style={{ width: `${Math.min(100, bufferedPercent)}%` }}
        />

        {/* Thanh đã phát (Played) */}
        <div
          className="player-seekbar__played"
          style={{ width: `${Math.min(100, displayPercent)}%` }}
        >
          <div className="player-seekbar__thumb" />
        </div>

        {/* Các mốc đánh dấu Chapter (Chapter Markers) */}
        {chapters &&
          chapters.length > 0 &&
          duration > 0 &&
          chapters.map((chapter, index) => {
            if (chapter.time <= 0 || chapter.time >= duration) return null;
            const markerPercent = (chapter.time / duration) * 100;
            return (
              <div
                key={index}
                className="player-seekbar__chapter-marker"
                style={{ left: `${markerPercent}%` }}
                title={`${chapter.title} (${formatTime(chapter.time)})`}
              />
            );
          })}

        {/* Điểm hover vị trí chuột */}
        {isHovering && !isDragging && (
          <div
            className="player-seekbar__hover-indicator"
            style={{ left: `${hoverPercent}%` }}
          />
        )}
      </div>
    </div>
  );
};

SeekBar.propTypes = {
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  bufferedEnd: PropTypes.number,
  onSeek: PropTypes.func,
  renderPreviewToCanvas: PropTypes.func,
  hasStoryboard: PropTypes.bool,
  chapters: PropTypes.arrayOf(
    PropTypes.shape({
      time: PropTypes.number.isRequired,
      title: PropTypes.string.isRequired,
    }),
  ),
};

export default SeekBar;
