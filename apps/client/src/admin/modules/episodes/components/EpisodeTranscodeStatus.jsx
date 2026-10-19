/**
 * @file EpisodeTranscodeStatus.jsx
 * @module Admin/Modules/Episodes/Components/EpisodeTranscodeStatus
 * @description Hiển thị trạng thái mã hóa video theo thời gian thực (Socket.IO), thanh tiến trình và nút thử lại nếu lỗi.
 */

import React from 'react';
import { RefreshCw, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';

import { useEpisodeProgress } from '@/hooks/socket/use-socket';
import { useRetryJobMutation } from '@/hooks/mutations/use-episode.mutations';
import './episode-transcode-status.scss';

/**
 * @component EpisodeTranscodeStatus
 * @param {Object} props
 * @param {string} props.episodeId - ID tập phim
 * @param {string} props.status - Trạng thái ban đầu ('pending' | 'uploading' | 'processing' | 'ready' | 'failed')
 * @param {number} [props.progress=0] - Tiến trình ban đầu (0 - 100)
 * @param {string} [props.stage] - Giai đoạn xử lý ban đầu
 * @param {string} [props.error] - Lỗi nếu có
 * @param {Function} [props.onComplete] - Callback khi hoàn tất
 */
export const EpisodeTranscodeStatus = ({
  episodeId,
  status: initialStatus,
  progress: initialProgress = 0,
  stage: initialStage = '',
  error: initialError = null,
  videoSources = [],
  onComplete,
}) => {
  const {
    progress: socketProgress,
    stage: socketStage,
    isCompleted,
    isFailed,
    error: socketError,
  } = useEpisodeProgress(episodeId, {
    onComplete,
  });

  const retryMutation = useRetryJobMutation();

  const isCurrentlyProcessing =
    ((initialStatus === 'processing' || initialStatus === 'queued') || socketProgress > 0) &&
    !isCompleted &&
    !isFailed;
  const currentProgress = isCurrentlyProcessing
    ? Math.max(initialProgress, socketProgress)
    : socketProgress || initialProgress;
  const currentStage = socketStage || initialStage || 'Đang xử lý...';
  const effectiveError = socketError || initialError;

  const handleRetry = (e) => {
    e.stopPropagation();
    retryMutation.mutate(episodeId);
  };

  const hasVideo = (Array.isArray(videoSources) && videoSources.length > 0) || isCompleted;

  if (initialStatus === 'ready' || isCompleted) {
    if (!hasVideo) {
      return (
        <div className="transcode-status transcode-status--pending">
          <Clock size={13} className="transcode-status__icon" />
          <span className="transcode-status__label">Chưa có video</span>
        </div>
      );
    }

    return (
      <div className="transcode-status transcode-status--ready">
        <CheckCircle2 size={13} className="transcode-status__icon" />
        <span className="transcode-status__label">Sẵn sàng</span>
      </div>
    );
  }

  if (initialStatus === 'failed' || isFailed) {
    return (
      <div className="transcode-status transcode-status--failed">
        <div className="transcode-status__info">
          <AlertCircle size={13} className="transcode-status__icon" />
          <span className="transcode-status__label" title={effectiveError || 'Mã hóa thất bại'}>
            Lỗi chuyển mã
          </span>
        </div>
        <button
          type="button"
          className="transcode-status__retry-btn"
          onClick={handleRetry}
          disabled={retryMutation.isPending}
          title="Thử lại tiến trình chuyển mã"
        >
          <RefreshCw
            size={12}
            className={retryMutation.isPending ? 'transcode-status__spinner' : ''}
          />
          <span>{retryMutation.isPending ? 'Đang thử...' : 'Thử lại'}</span>
        </button>
      </div>
    );
  }

  if (isCurrentlyProcessing) {
    return (
      <div className="transcode-status transcode-status--processing">
        <div className="transcode-status__header">
          <div className="transcode-status__stage-wrapper">
            <Loader2 size={12} className="transcode-status__spinner" />
            <span className="transcode-status__stage-text" title={currentStage}>
              {currentStage}
            </span>
          </div>
          <span className="transcode-status__percent">{Math.round(currentProgress)}%</span>
        </div>
        <div className="transcode-status__progress-track">
          <div
            className="transcode-status__progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, currentProgress))}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="transcode-status transcode-status--pending">
      <Clock size={13} className="transcode-status__icon" />
      <span className="transcode-status__label">Chờ tải lên</span>
    </div>
  );
};

export default EpisodeTranscodeStatus;
