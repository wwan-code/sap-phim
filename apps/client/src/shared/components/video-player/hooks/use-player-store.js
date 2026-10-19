/**
 * @file use-player-store.js
 * @module Components/VideoPlayer/Hooks
 * @description Trung tâm quản lý trạng thái (Zustand PlayerStore) cho Video Player chuẩn YouTube & Aesthetic OS.
 * Quản lý Playback State Machine, Media State, Preview-only Seek Model, Presentation Mode và Screen Lock.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

const PLAYBACK_SPEED_KEY = 'sap-phim:player:playback-speed';

/**
 * Lấy tốc độ phát đã lưu trong localStorage
 */
const getSavedPlaybackRate = () => {
  try {
    const saved = localStorage.getItem(PLAYBACK_SPEED_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.25 && parsed <= 3) {
        return parsed;
      }
    }
  } catch {
    // Ignore read error
  }
  return 1;
};

/**
 * Zustand Player Store
 */
export const usePlayerStore = create((set, get) => ({
  // ── 1. Playback State Machine ──
  // 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error'
  status: 'idle',
  isPlaying: false,
  isBuffering: false,

  // ── 2. Media State (Đồng bộ từ HTML5 Video Element) ──
  currentTime: 0,
  duration: 0,
  bufferedEnd: 0,
  volume: 1,
  isMuted: false,
  playbackRate: getSavedPlaybackRate(),
  originalPlaybackRate: 1, // Lưu tốc độ trước khi kích hoạt Long-Press 2x

  // ── 3. YouTube Seek Model (Transient Preview vs Final Commit) ──
  isSeeking: false,
  seekPreviewTime: null,
  seekPreviewPercent: null,
  seekCommitTime: null,

  // ── 4. Presentation & Window Modes ──
  isFullscreen: false,
  isTheater: false,
  isPip: false,

  // ── 5. Controls Visibility & Menus ──
  isControlsVisible: true,
  activeMenu: null, // 'settings' | 'subtitles' | 'speed' | 'quality' | null

  // ── 6. HUD Feedback ──
  hudAction: null,

  // ── 7. Screen Lock (Mobile Netflix-style) ──
  isScreenLocked: false,
  isScreenLockPromptVisible: false,

  // ── 8. Shortcuts Overlay & Misc ──
  isShortcutsOpen: false,

  // ── 9. HLS Stream Info ──
  qualities: [],
  currentQualityIndex: -1, // -1: Auto ABR
  hlsError: null,

  // ════════════════════════════════════════
  // ACTIONS
  // ════════════════════════════════════════

  // Playback state updates
  setStatus: (status) =>
    set((state) => ({
      status,
      isPlaying: status === 'playing',
      isBuffering: status === 'buffering' || status === 'loading',
    })),

  setIsPlaying: (isPlaying) =>
    set((state) => ({
      isPlaying,
      status: isPlaying ? 'playing' : state.status === 'ended' ? 'ended' : 'paused',
      isBuffering: isPlaying ? false : state.isBuffering,
    })),

  setIsBuffering: (isBuffering) =>
    set((state) => ({
      isBuffering,
      status: isBuffering ? 'buffering' : state.isPlaying ? 'playing' : 'paused',
    })),

  // Media sync updates
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setBufferedEnd: (bufferedEnd) => set({ bufferedEnd }),

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume));
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  setIsMuted: (isMuted) => set({ isMuted }),

  toggleMute: () =>
    set((state) => ({
      isMuted: !state.isMuted,
    })),

  setPlaybackRate: (playbackRate) => {
    try {
      localStorage.setItem(PLAYBACK_SPEED_KEY, playbackRate.toString());
    } catch {
      // Ignore
    }
    set({ playbackRate, originalPlaybackRate: playbackRate });
  },

  // Long-press 2x speed hold (YouTube Mobile feature)
  startSpeed2x: () => {
    const currentRate = get().playbackRate;
    set({
      originalPlaybackRate: currentRate,
      playbackRate: 2,
    });
  },

  stopSpeed2x: () => {
    const originalRate = get().originalPlaybackRate || 1;
    set({
      playbackRate: originalRate,
    });
  },

  // YouTube Seek Model: Start -> Preview -> Commit / Cancel
  seekStart: () =>
    set({
      isSeeking: true,
      seekCommitTime: null,
    }),

  seekPreview: (time, percent) =>
    set({
      isSeeking: true,
      seekPreviewTime: time,
      seekPreviewPercent: percent,
    }),

  seekCommit: (time) =>
    set({
      isSeeking: false,
      seekPreviewTime: null,
      seekPreviewPercent: null,
      seekCommitTime: time,
      currentTime: time,
    }),

  seekCancel: () =>
    set({
      isSeeking: false,
      seekPreviewTime: null,
      seekPreviewPercent: null,
      seekCommitTime: null,
    }),

  clearSeekCommit: () => set({ seekCommitTime: null }),

  // Presentation Mode
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  setIsTheater: (isTheater) => set({ isTheater }),
  toggleTheater: () => set((state) => ({ isTheater: !state.isTheater })),
  setIsPip: (isPip) => set({ isPip }),

  // Controls Visibility
  setIsControlsVisible: (isControlsVisible) => set({ isControlsVisible }),
  setActiveMenu: (activeMenu) => set({ activeMenu }),

  // HUD
  setHudAction: (hudAction) => set({ hudAction }),
  clearHud: () => set({ hudAction: null }),

  // Mobile Screen Lock
  setIsScreenLocked: (isScreenLocked) => set({ isScreenLocked }),
  setIsScreenLockPromptVisible: (isScreenLockPromptVisible) =>
    set({ isScreenLockPromptVisible }),
  lockScreen: () =>
    set({
      isScreenLocked: true,
      isControlsVisible: false,
      isScreenLockPromptVisible: true,
    }),
  unlockScreen: () =>
    set({
      isScreenLocked: false,
      isControlsVisible: true,
      isScreenLockPromptVisible: false,
    }),

  // Shortcuts Overlay
  setIsShortcutsOpen: (isShortcutsOpen) => set({ isShortcutsOpen }),
  toggleShortcutsOpen: () =>
    set((state) => ({ isShortcutsOpen: !state.isShortcutsOpen })),

  // HLS stream
  setQualities: (qualities) => set({ qualities }),
  setCurrentQualityIndex: (currentQualityIndex) => set({ currentQualityIndex }),
  setHlsError: (hlsError) => set({ hlsError }),

  // Reset store (khi đổi episodeId / unmount)
  resetPlayer: () =>
    set({
      status: 'idle',
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      bufferedEnd: 0,
      isSeeking: false,
      seekPreviewTime: null,
      seekPreviewPercent: null,
      seekCommitTime: null,
      isControlsVisible: true,
      activeMenu: null,
      hudAction: null,
      isScreenLocked: false,
      isScreenLockPromptVisible: false,
      isShortcutsOpen: false,
      hlsError: null,
    }),
}));

export { useShallow };
export default usePlayerStore;
