/**
 * @file VideoPlayer.jsx
 * @module Components/VideoPlayer
 * @description Trình phát video YouTube-grade cao cấp (HTML5 + HLS.js + Canvas Storyboard Preview + ABR Switcher) theo chuẩn Aesthetic OS.
 * Hỗ trợ Responsive 4 tầng thông minh qua useDeviceType, Chế độ rạp chiếu phim (Theater Mode), Mobile Gestures độc lập và Preview-only Seeking.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Loader2, AlertCircle } from 'lucide-react';

import { useDeviceType } from '@/hooks/ui/use-device-type';
import { useEpisodePlaybackQuery } from '@/hooks/queries/use-episode.queries';

import { usePlayerStore, useShallow } from './hooks/use-player-store';
import { useMediaEngine } from './hooks/use-media-engine';
import { useSubtitleController } from './hooks/use-subtitle-controller';
import { usePresentationMode } from './hooks/use-presentation-mode';
import { useControlsVisibility } from './hooks/use-controls-visibility';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { usePlayerGestures } from './hooks/use-player-gestures';
import { usePlaybackResume } from './hooks/use-playback-resume';
import { useSleepTimer } from './hooks/use-sleep-timer';
import { useSpritePreview } from './hooks/use-sprite-preview';

import PlayerControls from './components/PlayerControls';
import PlayerMobileControls from './components/PlayerMobileControls';
import PlayerBottomSheet from './components/PlayerBottomSheet';
import PlayerSubtitles from './components/PlayerSubtitles';
import PlayerTopBar from './components/PlayerTopBar';
import PlayerHudFeedback from './components/PlayerHudFeedback';
import PlayerResumeBanner from './components/PlayerResumeBanner';
import PlayerSleepTimerOverlay from './components/PlayerSleepTimerOverlay';
import PlayerShortcutsOverlay from './components/PlayerShortcutsOverlay';
import PlayerScreenLockOverlay from './components/PlayerScreenLockOverlay';
import PlayerSkipIntro from './components/PlayerSkipIntro';
import PlayerNextEpisodeCard from './components/PlayerNextEpisodeCard';

import './video-player.scss';

export const VideoPlayer = ({
  episodeId,
  playbackData: directPlaybackData = null,
  autoPlay = false,
  title = '',
  subtitle = '',
  onBack = null,
  onEnded,
  onNextEpisode,
  onTheaterChange,
}) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const lastTouchTimeRef = useRef(0);
  const [videoElement, setVideoElement] = useState(null);

  // 0. Nhận diện thiết bị và tầng responsive
  const {
    type: deviceType,
    isMobile,
    isTabletPortrait,
    orientation,
  } = useDeviceType();

  const isMobileLayout = isMobile || isTabletPortrait;

  // 1. Tải thông tin Playback nếu có episodeId
  const {
    data: queriedData,
    isLoading,
    error: queryError,
  } = useEpisodePlaybackQuery(episodeId, {
    enabled: Boolean(episodeId) && !directPlaybackData,
  });

  const playback = directPlaybackData || queriedData;
  const masterUrl = playback?.playbackUrl || '';
  const storyboard = playback?.storyboard || {};
  const subtitles = playback?.subtitles || [];
  const chapters = playback?.chapters || [];
  const initialDuration = playback?.episode?.duration || 0;

  // 2. Reset PlayerStore khi đổi episodeId hoặc unmount
  const resetPlayer = usePlayerStore((s) => s.resetPlayer);
  useEffect(() => {
    return () => {
      resetPlayer();
    };
  }, [episodeId, resetPlayer]);

  // 3. Media Engine: HLS.js + HTML5 Video element controls
  const {
    play,
    pause,
    togglePlay,
    seek,
    seekRelative,
    changeVolume,
    toggleMute,
    changeQuality,
    triggerHud,
  } = useMediaEngine({
    src: masterUrl,
    videoRef,
    videoElement,
    autoPlay,
    initialDuration,
    onEnded,
  });

  // 4. Subtitle Controller
  const {
    currentSubtitleId,
    activeTextTrack,
    subtitleStyles,
    handleSelectSubtitle,
    toggleSubtitle,
    handleChangeSubtitleStyles,
    syncTextTracks,
  } = useSubtitleController({
    subtitles,
    videoElement,
    videoRef,
  });

  // 5. Presentation Mode: Fullscreen, Theater Mode, PiP
  const {
    isFullscreen,
    isTheater,
    isPip,
    toggleFullscreen,
    toggleTheater,
    togglePip,
  } = usePresentationMode({
    containerRef,
    videoElement,
    videoRef,
    isMobile: isMobileLayout,
    onTheaterChange,
  });

  // 6. Controls Visibility
  const {
    isControlsVisible,
    showControlsTemporarily,
    toggleControlsVisibility,
    handleMouseMove,
    handleMouseLeave,
    isCursorHidden,
  } = useControlsVisibility({
    isMobile: isMobileLayout,
    lastTouchTimeRef,
  });

  // 7. Keyboard Shortcuts (YouTube-standard)
  useKeyboardShortcuts({
    togglePlay,
    seek,
    seekRelative,
    changeVolume,
    toggleMute,
    toggleSubtitle,
    toggleFullscreen,
    toggleTheater,
    togglePip,
    triggerHud,
    showControlsTemporarily,
  });

  // 8. Player Gestures (Touch Double-tap, Long-press 2x, Desktop Double-click)
  const { handleContainerClick, gestureHandlers } = usePlayerGestures({
    containerRef,
    isMobile: isMobileLayout,
    onToggleControls: toggleControlsVisibility,
    onTogglePlay: togglePlay,
    onSeekRelative: seekRelative,
    onSeek: seek,
    onChangeVolume: changeVolume,
    onToggleFullscreen: toggleFullscreen,
    triggerHud,
    showControlsTemporarily,
    lastTouchTimeRef,
  });

  // 9. Sprite Preview Canvas
  const { isLoaded: hasStoryboard, renderPreviewToCanvas } = useSpritePreview({
    vttUrl: storyboard?.vttUrl,
    defaultSpriteUrl: storyboard?.spriteUrl,
  });

  // 10. Playback Resume Banner
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const hlsError = usePlayerStore((s) => s.hlsError);
  const qualities = usePlayerStore((s) => s.qualities);
  const currentQualityIndex = usePlayerStore((s) => s.currentQualityIndex);
  const isScreenLocked = usePlayerStore((s) => s.isScreenLocked);
  const isShortcutsOpen = usePlayerStore((s) => s.isShortcutsOpen);
  const setIsShortcutsOpen = usePlayerStore((s) => s.setIsShortcutsOpen);

  const {
    isOpen: isResumeBannerOpen,
    savedTime: resumeSavedTime,
    handleResume,
    handleRestart,
    handleClose: handleCloseResume,
  } = usePlaybackResume({
    episodeId,
    currentTime,
    duration,
    isPlaying,
    onSeek: seek,
  });

  // 11. Sleep Timer
  const {
    sleepTimerOption,
    setSleepTimerOption,
    isSleepOverlayOpen,
    handleWakeUp,
    handleDismissSleepOverlay,
  } = useSleepTimer({
    isPlaying,
    currentTime,
    duration,
    onPause: pause,
    onPlay: play,
  });

  // 12. Skip Intro (Chapter detection)
  const introChapter = useMemo(() => {
    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) return null;
    return chapters.find((ch) => {
      if (ch.isIntro) return true;
      const titleLower = (ch.title || '').toLowerCase();
      return (
        titleLower.includes('intro') ||
        titleLower.includes('mở đầu') ||
        titleLower.includes('giới thiệu')
      );
    });
  }, [chapters]);

  const isIntroActive = Boolean(
    introChapter &&
      typeof introChapter.startTime === 'number' &&
      typeof introChapter.endTime === 'number' &&
      currentTime >= introChapter.startTime &&
      currentTime < introChapter.endTime - 1,
  );

  const handleSkipIntro = useCallback(() => {
    if (introChapter && typeof introChapter.endTime === 'number') {
      seek(introChapter.endTime);
    }
  }, [introChapter, seek]);

  // 13. Next Episode Card
  const [isNextEpisodeDismissed, setIsNextEpisodeDismissed] = useState(false);
  useEffect(() => {
    setIsNextEpisodeDismissed(false);
  }, [episodeId]);

  const isNextEpisodeCardOpen = Boolean(
    onNextEpisode &&
      duration > 60 &&
      currentTime > 20 &&
      duration - currentTime <= 35 &&
      !isNextEpisodeDismissed &&
      !isScreenLocked,
  );

  const handleDismissNextEpisodeCard = useCallback(() => {
    setIsNextEpisodeDismissed(true);
  }, []);

  // 14. Mobile Bottom Sheet State
  const [bottomSheetState, setBottomSheetState] = useState({
    isOpen: false,
    initialTab: 'settings', // 'settings' | 'subtitles'
  });

  const handleOpenSheet = useCallback((tab = 'settings') => {
    setBottomSheetState({ isOpen: true, initialTab: tab });
  }, []);

  const handleCloseSheet = useCallback(() => {
    setBottomSheetState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // ── Render Loading & Error States ──
  if (isLoading) {
    return (
      <div className="video-player video-player--loading">
        <Loader2 size={36} className="video-player__spinner" />
        <span className="video-player__loading-text">Đang tải luồng phát ABR HLS...</span>
      </div>
    );
  }

  if (queryError || (!playback && !isLoading)) {
    return (
      <div className="video-player video-player--error">
        <AlertCircle size={36} className="video-player__error-icon" />
        <span className="video-player__error-text">
          {queryError?.message || 'Không tìm thấy dữ liệu phát video của tập phim'}
        </span>
      </div>
    );
  }

  const effectiveTitle =
    title ||
    playback?.episode?.title ||
    (episodeId ? `Tập ${playback?.episode?.episodeNumber || ''}` : '');
  const effectiveSubtitle = subtitle || playback?.movie?.title || '';
  const currentQualityName =
    qualities?.[currentQualityIndex]?.label ||
    (currentQualityIndex === -1 ? 'Tự động' : '');

  const tierClass = `video-player--tier-${deviceType || 'desktop'}`;
  const orientationClass = `video-player--orientation-${orientation || 'landscape'}`;

  const containerEventProps = {
    onClick: handleContainerClick,
    ...(!isMobileLayout
      ? {
          onMouseMove: handleMouseMove,
          onMouseLeave: handleMouseLeave,
        }
      : {}),
    ...gestureHandlers,
  };

  return (
    <div
      ref={containerRef}
      className={`video-player ${tierClass} ${orientationClass} ${isFullscreen ? 'video-player--fullscreen' : ''} ${isTheater ? 'video-player--theater' : ''} ${isCursorHidden ? 'video-player--hide-cursor' : ''}`}
      {...containerEventProps}
    >
      {/* ── CINEMATIC TOP BAR (DESKTOP & TABLET-LANDSCAPE) ── */}
      {!isMobileLayout && (
        <PlayerTopBar
          isVisible={isControlsVisible}
          title={effectiveTitle}
          subtitle={effectiveSubtitle}
          onBack={onBack}
          currentQualityName={currentQualityName}
          isFullscreen={isFullscreen}
        />
      )}

      {/* ── HTML5 VIDEO ELEMENT ── */}
      <video
        ref={(node) => {
          videoRef.current = node;
          if (node && node !== videoElement) {
            setVideoElement(node);
          }
        }}
        className="video-player__element"
        playsInline
        crossOrigin="anonymous"
      >
        {subtitles.map((sub) => (
          <track
            key={sub.id || sub.language}
            kind="subtitles"
            label={sub.label}
            src={sub.src}
            srcLang={sub.srclang || sub.language}
            onLoad={syncTextTracks}
          />
        ))}
      </video>

      {/* ── PAUSE OVERLAY ANIMATION ── */}
      <div
        className={`video-player__pause-overlay ${!isPlaying && !isBuffering ? 'video-player__pause-overlay--visible' : ''}`}
        aria-hidden={isPlaying || isBuffering}
      />

      {/* ── HUD FEEDBACK ANIMATIONS ── */}
      <PlayerHudFeedback isMobile={isMobileLayout} />

      {/* ── RESUME BANNER ── */}
      <PlayerResumeBanner
        isOpen={isResumeBannerOpen}
        savedTime={resumeSavedTime}
        onResume={handleResume}
        onRestart={handleRestart}
        onClose={handleCloseResume}
        isControlsVisible={isControlsVisible}
      />

      {/* ── SLEEP TIMER OVERLAY ── */}
      <PlayerSleepTimerOverlay
        isOpen={isSleepOverlayOpen}
        onWakeUp={handleWakeUp}
        onDismiss={async () => {
          handleDismissSleepOverlay();
          if (document.fullscreenElement) {
            try {
              await document.exitFullscreen();
            } catch {}
          }
          if (onBack) {
            onBack();
          }
        }}
      />

      {/* ── KEYBOARD SHORTCUTS MODAL (?) ── */}
      <PlayerShortcutsOverlay
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* ── BUFFERING SPINNER ── */}
      {isBuffering && (
        <div className="video-player__buffering-overlay">
          <Loader2 size={44} className="video-player__spinner" />
        </div>
      )}

      {/* ── HLS STREAM ERROR ── */}
      {hlsError && (
        <div className="video-player__stream-error">
          <AlertCircle size={20} />
          <span>{hlsError}</span>
        </div>
      )}

      {/* ── CUSTOM SUBTITLES OVERLAY ── */}
      <PlayerSubtitles
        textTrack={activeTextTrack}
        videoElement={videoElement}
        isControlsVisible={isControlsVisible}
        styles={subtitleStyles}
      />

      {/* ── CONTROLS: MOBILE vs DESKTOP ── */}
      {isMobileLayout ? (
        <>
          <PlayerMobileControls
            title={effectiveTitle}
            subtitle={effectiveSubtitle}
            onBack={onBack}
            hasStoryboard={hasStoryboard}
            chapters={chapters}
            currentSubtitleId={currentSubtitleId}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onSeekRelative={seekRelative}
            onToggleFullscreen={toggleFullscreen}
            onTogglePip={togglePip}
            onChangeVolume={changeVolume}
            onToggleMute={toggleMute}
            onNextEpisode={onNextEpisode}
            onOpenSheet={handleOpenSheet}
            renderPreviewToCanvas={renderPreviewToCanvas}
          />

          <PlayerBottomSheet
            isOpen={bottomSheetState.isOpen}
            onClose={handleCloseSheet}
            initialTab={bottomSheetState.initialTab}
            qualities={qualities}
            currentQualityIndex={currentQualityIndex}
            onSelectQuality={changeQuality}
            playbackRate={usePlayerStore.getState().playbackRate}
            onChangePlaybackRate={(r) => usePlayerStore.getState().setPlaybackRate(r)}
            subtitles={subtitles}
            currentSubtitleId={currentSubtitleId}
            onSelectSubtitle={handleSelectSubtitle}
            subtitleStyles={subtitleStyles}
            onChangeSubtitleStyles={handleChangeSubtitleStyles}
            sleepTimerOption={sleepTimerOption}
            onSelectSleepTimer={setSleepTimerOption}
          />
        </>
      ) : (
        <PlayerControls
          subtitles={subtitles}
          currentSubtitleId={currentSubtitleId}
          subtitleStyles={subtitleStyles}
          onChangeSubtitleStyles={handleChangeSubtitleStyles}
          hasStoryboard={hasStoryboard}
          chapters={chapters}
          sleepTimerOption={sleepTimerOption}
          onSelectSleepTimer={setSleepTimerOption}
          onTogglePlay={togglePlay}
          onSeek={seek}
          onChangeVolume={changeVolume}
          onToggleMute={toggleMute}
          onToggleFullscreen={toggleFullscreen}
          onToggleTheater={toggleTheater}
          onTogglePip={togglePip}
          onChangePlaybackRate={(r) => usePlayerStore.getState().setPlaybackRate(r)}
          onSelectQuality={changeQuality}
          onSelectSubtitle={handleSelectSubtitle}
          onNextEpisode={onNextEpisode}
          renderPreviewToCanvas={renderPreviewToCanvas}
        />
      )}

      {/* ── SKIP INTRO ── */}
      <PlayerSkipIntro
        isVisible={isIntroActive && !isScreenLocked}
        isControlsVisible={isControlsVisible}
        onSkip={handleSkipIntro}
      />

      {/* ── NEXT EPISODE CARD ── */}
      <PlayerNextEpisodeCard
        isOpen={isNextEpisodeCardOpen}
        isControlsVisible={isControlsVisible}
        onPlayNext={onNextEpisode}
        onDismiss={handleDismissNextEpisodeCard}
        nextEpisodeTitle={playback?.nextEpisode?.title || 'Tập tiếp theo'}
      />

      {/* ── SCREEN LOCK OVERLAY ── */}
      <PlayerScreenLockOverlay />
    </div>
  );
};

VideoPlayer.propTypes = {
  episodeId: PropTypes.string,
  playbackData: PropTypes.object,
  autoPlay: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  onBack: PropTypes.func,
  onEnded: PropTypes.func,
  onNextEpisode: PropTypes.func,
  onTheaterChange: PropTypes.func,
};

export default VideoPlayer;
