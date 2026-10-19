/**
 * @file use-subtitle-controller.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook quản lý phụ đề (Dual Subtitles: Custom Overlay + Native ::cue fallback Safari Fullscreen).
 * Tự động ghi nhớ ngôn ngữ phụ đề, kiểu dáng chữ tuỳ biến trong localStorage và đồng bộ TextTracks.
 */

import { useState, useEffect, useCallback } from 'react';

import {
  DEFAULT_SUBTITLE_STYLES,
  SUBTITLE_STORAGE_KEY,
} from '../constants/subtitle-customization.constants';

const SUBTITLE_LANG_KEY = 'sap-phim:player:subtitle-lang';
const SUBTITLE_DISABLED_KEY = 'sap-phim:player:subtitle-disabled';

/**
 * Hook điều khiển toàn bộ nghiệp vụ phụ đề của player
 *
 * @param {Object} params
 * @param {Array} params.subtitles - Danh sách phụ đề từ API
 * @param {HTMLVideoElement|null} params.videoElement - Thẻ HTML5 video
 * @param {React.RefObject} params.videoRef - Ref dự phòng tới thẻ video
 * @returns {Object} Subtitle state và handlers
 */
export function useSubtitleController({ subtitles = [], videoElement, videoRef }) {
  const [currentSubtitleId, setCurrentSubtitleId] = useState(null);
  const [activeTextTrack, setActiveTextTrack] = useState(null);
  const [subtitleStyles, setSubtitleStyles] = useState(() => {
    try {
      const saved = localStorage.getItem(SUBTITLE_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SUBTITLE_STYLES, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[SubtitleController] Load subtitle styles error:', e);
    }
    return DEFAULT_SUBTITLE_STYLES;
  });

  const handleChangeSubtitleStyles = useCallback((newStyles) => {
    setSubtitleStyles(newStyles);
    try {
      localStorage.setItem(SUBTITLE_STORAGE_KEY, JSON.stringify(newStyles));
    } catch (e) {
      console.warn('[SubtitleController] Save subtitle styles error:', e);
    }
  }, []);

  // 1. Tự động khởi tạo phụ đề từ danh sách subtitles và tùy chọn localStorage
  useEffect(() => {
    if (!subtitles || subtitles.length === 0) {
      setCurrentSubtitleId(null);
      return;
    }

    try {
      const isExplicitlyDisabled =
        localStorage.getItem(SUBTITLE_DISABLED_KEY) === 'true';
      if (isExplicitlyDisabled) {
        setCurrentSubtitleId(null);
        return;
      }

      const savedLang = localStorage.getItem(SUBTITLE_LANG_KEY);
      const matched = subtitles.find(
        (s) =>
          (s.id || s.language) === savedLang ||
          s.language === savedLang ||
          s.srclang === savedLang,
      );
      const defaultSub = subtitles.find((s) => s.isDefault) || subtitles[0];
      const targetSub = matched || defaultSub;

      if (targetSub) {
        setCurrentSubtitleId(targetSub.id || targetSub.language);
      }
    } catch {
      const defaultSub = subtitles.find((s) => s.isDefault) || subtitles[0];
      if (defaultSub) {
        setCurrentSubtitleId(defaultSub.id || defaultSub.language);
      }
    }
  }, [subtitles]);

  // 2. Chọn phụ đề cụ thể (null để tắt)
  const handleSelectSubtitle = useCallback((subId) => {
    setCurrentSubtitleId(subId);
    try {
      if (subId) {
        localStorage.removeItem(SUBTITLE_DISABLED_KEY);
        localStorage.setItem(SUBTITLE_LANG_KEY, subId);
      } else {
        localStorage.setItem(SUBTITLE_DISABLED_KEY, 'true');
      }
    } catch (e) {
      console.warn('[SubtitleController] Save subtitle preference error:', e);
    }
  }, []);

  // 3. Chuyển đổi bật/tắt nhanh phụ đề
  const toggleSubtitle = useCallback(() => {
    if (currentSubtitleId) {
      handleSelectSubtitle(null);
    } else {
      const defaultSub = subtitles.find((s) => s.isDefault) || subtitles[0];
      if (defaultSub) {
        handleSelectSubtitle(defaultSub.id || defaultSub.language);
      }
    }
  }, [currentSubtitleId, subtitles, handleSelectSubtitle]);

  // 4. Đồng bộ TextTrack trong thẻ <video>
  const syncTextTracks = useCallback(() => {
    const video = videoElement || videoRef?.current;
    if (!video || !video.textTracks) return;

    let foundActive = null;
    const currentSub = subtitles.find(
      (s) => (s.id || s.language) === currentSubtitleId,
    );

    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];
      const matches =
        currentSub &&
        (track.language === (currentSub.srclang || currentSub.language) ||
          track.label === currentSub.label);

      if (matches) {
        track.mode = 'hidden';
        foundActive = track;
      } else {
        track.mode = 'disabled';
      }
    }

    setActiveTextTrack(foundActive);
  }, [videoElement, videoRef, currentSubtitleId, subtitles]);

  useEffect(() => {
    syncTextTracks();
    const video = videoElement || videoRef?.current;
    if (!video || !video.textTracks) return;

    const handleTrackChange = () => syncTextTracks();
    if (video.textTracks.addEventListener) {
      video.textTracks.addEventListener('change', handleTrackChange);
    }

    return () => {
      if (video.textTracks?.removeEventListener) {
        video.textTracks.removeEventListener('change', handleTrackChange);
      }
    };
  }, [syncTextTracks, videoElement, videoRef]);

  // 5. Dự phòng cho Safari Fullscreen Native: chuyển mode sang 'showing' khi ở Safari Native Fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const video = videoElement || videoRef?.current;
      if (video && video.webkitDisplayingFullscreen) {
        if (activeTextTrack) {
          activeTextTrack.mode = 'showing';
        }
      } else if (activeTextTrack && activeTextTrack.mode === 'showing') {
        activeTextTrack.mode = 'hidden';
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    const video = videoElement || videoRef?.current;
    if (video) {
      video.addEventListener('webkitbeginfullscreen', handleFullscreenChange);
      video.addEventListener('webkitendfullscreen', handleFullscreenChange);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', handleFullscreenChange);
        video.removeEventListener('webkitendfullscreen', handleFullscreenChange);
      }
    };
  }, [videoElement, videoRef, activeTextTrack]);

  return {
    currentSubtitleId,
    activeTextTrack,
    subtitleStyles,
    handleSelectSubtitle,
    toggleSubtitle,
    handleChangeSubtitleStyles,
    syncTextTracks,
  };
}

export default useSubtitleController;
