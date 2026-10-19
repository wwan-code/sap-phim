/**
 * @file use-media-engine.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook quản lý lõi đa phương tiện (Media Engine) kết hợp HLS.js và HTML5 Video Element.
 * Điều khiển phát, tạm dừng, tua thời gian YouTube-model, đồng bộ hóa sự kiện video vào Zustand PlayerStore.
 */

import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

import { usePlayerStore } from './use-player-store';

const QUALITY_STORAGE_KEY = 'sap-phim:player:quality-pref';

/**
 * Hook quản lý toàn bộ tương tác trực tiếp với thẻ <video> và luồng HLS
 *
 * @param {Object} params
 * @param {string} params.src - Đường dẫn HLS playlist (.m3u8)
 * @param {React.RefObject} params.videoRef - Ref tới thẻ video
 * @param {HTMLVideoElement|null} params.videoElement - Thẻ video element
 * @param {boolean} params.autoPlay - Tự động phát khi tải xong manifest
 * @param {number} params.initialDuration - Thời lượng ban đầu từ metadata API
 * @param {Function} params.onEnded - Callback khi video kết thúc
 * @returns {Object} Imperative controls và refs
 */
export function useMediaEngine({
  src,
  videoRef,
  videoElement,
  autoPlay = false,
  initialDuration = 0,
  onEnded,
}) {
  const hlsRef = useRef(null);
  const hudTimerRef = useRef(null);
  const networkRetryCountRef = useRef(0);
  const mediaRetryCountRef = useRef(0);

  // Store actions
  const setStatus = usePlayerStore((s) => s.setStatus);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setIsBuffering = usePlayerStore((s) => s.setIsBuffering);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setBufferedEnd = usePlayerStore((s) => s.setBufferedEnd);
  const setStoreVolume = usePlayerStore((s) => s.setVolume);
  const setStoreMuted = usePlayerStore((s) => s.setIsMuted);
  const setStoreQualities = usePlayerStore((s) => s.setQualities);
  const setStoreQualityIndex = usePlayerStore((s) => s.setCurrentQualityIndex);
  const setHlsError = usePlayerStore((s) => s.setHlsError);
  const setHudAction = usePlayerStore((s) => s.setHudAction);
  const clearSeekCommit = usePlayerStore((s) => s.clearSeekCommit);
  const seekCommitTime = usePlayerStore((s) => s.seekCommitTime);
  const playbackRate = usePlayerStore((s) => s.playbackRate);

  // Helper kích hoạt HUD Feedback
  const triggerHud = useCallback(
    (type, value = null) => {
      if (hudTimerRef.current) {
        clearTimeout(hudTimerRef.current);
      }
      setHudAction({ id: Date.now() + Math.random(), type, value });
      hudTimerRef.current = setTimeout(() => {
        setHudAction(null);
      }, 850);
    },
    [setHudAction],
  );

  // ── Imperative Methods ──
  const play = useCallback(() => {
    const video = videoElement || videoRef?.current;
    if (!video) return Promise.resolve();

    const playPromise = video.play();
    if (playPromise !== undefined) {
      return playPromise
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
          triggerHud('play');
        })
        .catch((err) => {
          console.warn('[MediaEngine] Play prevented:', err.message);
        });
    }
    return Promise.resolve();
  }, [videoElement, videoRef, setIsPlaying, setIsBuffering, triggerHud]);

  const pause = useCallback(() => {
    const video = videoElement || videoRef?.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    triggerHud('pause');
  }, [videoElement, videoRef, setIsPlaying, triggerHud]);

  const togglePlay = useCallback(() => {
    const video = videoElement || videoRef?.current;
    if (!video) return;
    if (video.paused || video.ended) {
      play();
    } else {
      pause();
    }
  }, [videoElement, videoRef, play, pause]);

  const seek = useCallback(
    (targetTime) => {
      const video = videoElement || videoRef?.current;
      if (!video) return;

      const duration = video.duration || initialDuration || 0;
      const validTime =
        duration > 0
          ? Math.min(duration, Math.max(0, targetTime))
          : Math.max(0, targetTime);

      video.currentTime = validTime;
      setCurrentTime(validTime);
    },
    [videoElement, videoRef, initialDuration, setCurrentTime],
  );

  const seekRelative = useCallback(
    (seconds) => {
      const video = videoElement || videoRef?.current;
      if (!video) return;
      const newTime = (video.currentTime || 0) + seconds;
      seek(newTime);
      triggerHud(seconds < 0 ? 'seek-backward' : 'seek-forward', Math.abs(seconds));
    },
    [videoElement, videoRef, seek, triggerHud],
  );

  const changeVolume = useCallback(
    (newVolume) => {
      const video = videoElement || videoRef?.current;
      if (!video) return;
      const clamped = Math.min(1, Math.max(0, newVolume));
      video.volume = clamped;
      video.muted = clamped === 0;
      setStoreVolume(clamped);
      setStoreMuted(clamped === 0);
    },
    [videoElement, videoRef, setStoreVolume, setStoreMuted],
  );

  const toggleMute = useCallback(() => {
    const video = videoElement || videoRef?.current;
    if (!video) return;
    const nextMuted = !video.muted;
    if (!nextMuted && video.volume === 0) {
      video.volume = 1;
      setStoreVolume(1);
    }
    video.muted = nextMuted;
    setStoreMuted(nextMuted);
    triggerHud('volume', {
      percent: Math.round(video.volume * 100),
      isMuted: nextMuted,
    });
  }, [videoElement, videoRef, setStoreMuted, setStoreVolume, triggerHud]);

  const changeQuality = useCallback(
    (qualityIndex) => {
      if (!hlsRef.current) return;
      hlsRef.current.currentLevel = qualityIndex; // -1 cho Auto, hoặc 0..N
      setStoreQualityIndex(qualityIndex);

      try {
        if (qualityIndex === -1) {
          localStorage.setItem(QUALITY_STORAGE_KEY, 'auto');
        } else {
          const qualities = usePlayerStore.getState().qualities;
          const q = qualities.find((item) => item.index === qualityIndex);
          if (q?.name) {
            localStorage.setItem(QUALITY_STORAGE_KEY, q.name);
          }
        }
      } catch (e) {
        console.warn('[MediaEngine] Lưu tùy chọn chất lượng lỗi:', e);
      }
    },
    [setStoreQualityIndex],
  );

  // ── Lắng nghe seekCommitTime từ Zustand Store (YouTube Seek Model) ──
  useEffect(() => {
    if (seekCommitTime !== null) {
      seek(seekCommitTime);
      clearSeekCommit();
    }
  }, [seekCommitTime, seek, clearSeekCommit]);

  // ── Đồng bộ playbackRate từ Zustand Store vào HTML5 Video Element ──
  useEffect(() => {
    const video = videoElement || videoRef?.current;
    if (!video) return;
    if (video.playbackRate !== playbackRate) {
      video.playbackRate = playbackRate;
    }
  }, [videoElement, videoRef, playbackRate]);

  // ── Đồng bộ initialDuration khi có từ API metadata ──
  useEffect(() => {
    if (initialDuration > 0) {
      const currentDur = usePlayerStore.getState().duration;
      if (currentDur <= 0 || !isFinite(currentDur)) {
        setDuration(initialDuration);
      }
    }
  }, [initialDuration, setDuration]);

  // ── Khởi tạo HLS.js hoặc Native HLS ──
  useEffect(() => {
    const video = videoElement || videoRef?.current;
    if (!video || !src) return;

    setHlsError(null);
    setStatus('loading');
    networkRetryCountRef.current = 0;
    mediaRetryCountRef.current = 0;

    let isNativeHls = false;

    // Trường hợp 1: Trình duyệt hỗ trợ HLS.js
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        const levels = data.levels.map((lvl, index) => ({
          index,
          height: lvl.height,
          width: lvl.width,
          bitrate: lvl.bitrate,
          name: lvl.height ? `${lvl.height}p` : `Level ${index + 1}`,
          label: lvl.height ? `${lvl.height}p` : `Level ${index + 1}`,
        }));

        setStoreQualities(levels);
        setStatus('ready');

        // Khôi phục chất lượng đã lưu từ localStorage
        let targetIndex = -1;
        try {
          const savedQuality = localStorage.getItem(QUALITY_STORAGE_KEY);
          if (savedQuality && savedQuality !== 'auto') {
            const matched = levels.find(
              (l) =>
                l.name === savedQuality ||
                (l.height && `${l.height}p` === savedQuality),
            );
            if (matched) {
              targetIndex = matched.index;
              hls.currentLevel = targetIndex;
            }
          }
        } catch {
          // Ignore
        }

        setStoreQualityIndex(targetIndex);

        if (autoPlay) {
          play();
        }
      });

      hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
        networkRetryCountRef.current = 0;
        mediaRetryCountRef.current = 0;
        if (data?.details?.totalduration && isFinite(data.details.totalduration)) {
          setDuration(data.details.totalduration);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        if (hls.currentLevel !== -1) {
          setStoreQualityIndex(data.level);
        }
      });

      hls.on(Hls.Events.BUFFER_STALLED, () => {
        setIsBuffering(true);
      });

      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        setIsBuffering(false);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkRetryCountRef.current < 3) {
                networkRetryCountRef.current += 1;
                hls.startLoad();
              } else {
                setHlsError('Không thể kết nối máy chủ luồng phát video (Lỗi mạng).');
                setStatus('error');
                hls.destroy();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRetryCountRef.current < 3) {
                mediaRetryCountRef.current += 1;
                hls.recoverMediaError();
              } else {
                setHlsError('Lỗi phân giải luồng video đa phương tiện.');
                setStatus('error');
                hls.destroy();
              }
              break;
            default:
              setHlsError(data.details || 'Lỗi phát trực tuyến HLS.');
              setStatus('error');
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }
    // Trường hợp 2: Hỗ trợ Native HLS (Safari trên macOS/iOS)
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      isNativeHls = true;
      video.src = src;
      setStatus('ready');

      if (autoPlay) {
        play();
      }

      return () => {
        if (isNativeHls && video) {
          video.removeAttribute('src');
          video.load();
        }
      };
    } else {
      setHlsError('Trình duyệt không hỗ trợ phát luồng HLS.');
      setStatus('error');
    }
  }, [
    src,
    videoRef,
    videoElement,
    autoPlay,
    play,
    setStatus,
    setDuration,
    setStoreQualities,
    setStoreQualityIndex,
    setHlsError,
    setIsBuffering,
  ]);

  // ── Lắng nghe sự kiện HTML5 Video Element ──
  useEffect(() => {
    const video = videoElement || videoRef?.current;
    if (!video) return;

    // Khởi tạo trạng thái ban đầu
    if (!isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }
    setStoreVolume(video.volume);
    setStoreMuted(video.muted);
    setIsPlaying(!video.paused && !video.ended);

    const handlePlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleTimeUpdate = () => {
      // Khi đang kéo seekbar (YouTube preview model), không ghi đè currentTime để tránh giật UI
      const isSeeking = usePlayerStore.getState().isSeeking;
      if (!isSeeking) {
        setCurrentTime(video.currentTime || 0);
      }

      const d = video.duration;
      if (!isNaN(d) && isFinite(d) && d > 0) {
        setDuration(d);
      }

      // Cập nhật Buffered range
      if (video.buffered && video.buffered.length > 0) {
        for (let i = video.buffered.length - 1; i >= 0; i--) {
          if (video.buffered.start(i) <= video.currentTime) {
            setBufferedEnd(video.buffered.end(i));
            break;
          }
        }
      }
    };

    const handleDurationChange = () => {
      const d = video.duration;
      if (!isNaN(d) && isFinite(d) && d > 0) {
        setDuration(d);
      }
    };

    const handleLoadedMetadata = () => {
      const d = video.duration;
      if (!isNaN(d) && isFinite(d) && d > 0) {
        setDuration(d);
      }
      setStoreVolume(video.volume);
      setStoreMuted(video.muted);
    };

    const handleVolumeChange = () => {
      setStoreVolume(video.volume);
      setStoreMuted(video.muted);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setStatus('ended');
      onEnded?.();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ended', handleEnded);
    };
  }, [
    videoElement,
    videoRef,
    onEnded,
    setIsPlaying,
    setIsBuffering,
    setCurrentTime,
    setDuration,
    setBufferedEnd,
    setStoreVolume,
    setStoreMuted,
    setStatus,
  ]);

  // Dọn dẹp timer
  useEffect(() => {
    return () => {
      if (hudTimerRef.current) {
        clearTimeout(hudTimerRef.current);
      }
    };
  }, []);

  return {
    hls: hlsRef.current,
    play,
    pause,
    togglePlay,
    seek,
    seekRelative,
    changeVolume,
    toggleMute,
    changeQuality,
    triggerHud,
  };
}

export default useMediaEngine;
