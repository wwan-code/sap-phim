/**
 * @file EpisodePreviewModal.jsx
 * @module Admin/Modules/Episodes/Components/EpisodePreviewModal
 * @description Modal xem trước video tập phim chuẩn Obsidian Cinema & The Aesthetic OS.
 * Tích hợp trình phát video HTML5 HLS, Canvas Storyboard và bảng thông số luồng phát ABR.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  MonitorPlay,
  Layers,
  Clapperboard,
  Info,
  Copy,
  Check,
  Subtitles,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Modal from '@/shared/components/ui/modal/Modal';
import Button from '@/shared/components/ui/button/Button';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import VideoPlayer from '@/shared/components/video-player/VideoPlayer';
import { formatDateTime } from '@/shared/utils/format.util';
import './episode-preview-modal.scss';

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const h = Math.floor(m / 60);
  if (h > 0) {
    const remM = m % 60;
    return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const TRANSCODE_STATUS_MAP = {
  ready: { label: 'Mã hóa hoàn tất', variant: 'success' },
  processing: { label: 'Đang mã hóa ABR', variant: 'warning' },
  pending: { label: 'Chờ tải lên', variant: 'neutral' },
  failed: { label: 'Lỗi mã hóa', variant: 'error' },
};

const PUBLISH_STATE_MAP = {
  published: { label: 'Đã xuất bản', variant: 'success' },
  draft: { label: 'Bản nháp', variant: 'neutral' },
  scheduled: { label: 'Đã lên lịch', variant: 'accent' },
};

export const EpisodePreviewModal = ({
  open = false,
  onClose,
  episode = null,
  movieTitle = '',
  onManageSubtitles,
}) => {
  const [copied, setCopied] = useState(false);

  if (!episode) return null;

  const episodeTitle = episode.title
    ? `Tập ${episode.episode_number}: ${episode.title}`
    : `Tập ${episode.episode_number}`;

  const transcodeStatus = TRANSCODE_STATUS_MAP[episode.status] || {
    label: episode.status,
    variant: 'neutral',
  };
  const publishState = PUBLISH_STATE_MAP[episode.publish_state] || {
    label: episode.publish_state,
    variant: 'neutral',
  };

  const sources = Array.isArray(episode.video_sources) ? episode.video_sources : [];
  const rawSubs = episode.subtitle_sources || episode.subtitles || [];
  const subtitleCount = Array.isArray(rawSubs) ? rawSubs.length : 0;
  const hasStoryboard = Boolean(episode.storyboard_url || episode.has_storyboard);

  const handleCopyId = () => {
    if (!episode.id) return;
    navigator.clipboard.writeText(episode.id);
    setCopied(true);
    toast.success('Đã sao chép mã tập phim!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xlarge"
      className="episode-preview-modal"
    >
      <Modal.Header onClose={onClose} showCloseButton>
        <div className="episode-preview-modal__header-wrapper">
          <div className="modal__title-group">
            <h3 className="modal__title">Xem Trước — {episodeTitle}</h3>
            <p className="modal__subtitle">
              {movieTitle ? `${movieTitle} • ` : ''}Thời lượng: {formatDuration(episode.duration)} • {Number(episode.view_count || 0).toLocaleString()} lượt xem
            </p>
          </div>
          <div className="episode-preview-modal__header-badges">
            <span className={`episode-preview-modal__badge episode-preview-modal__badge--${transcodeStatus.variant}`}>
              {episode.status === 'ready' && <CheckCircle2 size={12} />}
              {episode.status === 'processing' && <Sparkles size={12} />}
              {episode.status === 'failed' && <AlertTriangle size={12} />}
              {transcodeStatus.label}
            </span>
            <span className={`episode-preview-modal__badge episode-preview-modal__badge--${publishState.variant}`}>
              {publishState.label}
            </span>
            <span className="episode-preview-modal__badge episode-preview-modal__badge--accent">
              <Sparkles size={12} />
              HLS ABR Stream
            </span>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="episode-preview-modal__body">
          {/* 1. Khung phát video 16:9 Cinema */}
          <div className="episode-preview-modal__player-container">
            <VideoPlayer episodeId={episode.id} autoPlay />
          </div>

          {/* 2. Bảng thông số kỹ thuật (Stream Specs Grid) */}
          <div className="episode-preview-modal__specs-grid">
            {/* Card 1: Phân giải ABR */}
            <div className="episode-preview-modal__card">
              <div className="episode-preview-modal__card-header">
                <Layers size={16} className="episode-preview-modal__card-icon" />
                <h4 className="episode-preview-modal__card-title">Chất Lượng Stream (ABR)</h4>
              </div>
              <div className="episode-preview-modal__card-body">
                {sources.length > 0 ? (
                  <div className="episode-preview-modal__resolutions">
                    {sources.map((s, idx) => {
                      const q = s.quality || s.resolution || 'Auto';
                      const isHigh = q.includes('1080') || q.includes('4k') || q.includes('2k');
                      return (
                        <span
                          key={s.id || idx}
                          className={`episode-preview-modal__res-tag ${isHigh ? 'episode-preview-modal__res-tag--highlight' : ''}`}
                        >
                          {q}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="episode-preview-modal__spec-value">Đang cập nhật luồng phát</span>
                )}
                <div className="episode-preview-modal__spec-row">
                  <span className="episode-preview-modal__spec-label">Giao thức:</span>
                  <span className="episode-preview-modal__spec-value episode-preview-modal__spec-value--mono">
                    HLS (m3u8 + TS)
                  </span>
                </div>
                <div className="episode-preview-modal__spec-row">
                  <span className="episode-preview-modal__spec-label">Codec:</span>
                  <span className="episode-preview-modal__spec-value">H.264 / AAC Stereo</span>
                </div>
              </div>
            </div>

            {/* Card 2: Dữ liệu Đa Phương Tiện */}
            <div className="episode-preview-modal__card">
              <div className="episode-preview-modal__card-header">
                <Clapperboard size={16} className="episode-preview-modal__card-icon" />
                <h4 className="episode-preview-modal__card-title">Tài Nguyên Video</h4>
              </div>
              <div className="episode-preview-modal__card-body">
                <div className="episode-preview-modal__spec-row">
                  <span className="episode-preview-modal__spec-label">Storyboard Preview:</span>
                  <span className="episode-preview-modal__spec-value">
                    {hasStoryboard ? (
                      <span className="episode-preview-modal__badge episode-preview-modal__badge--success">
                        <CheckCircle2 size={11} /> Canvas 60fps
                      </span>
                    ) : (
                      <span className="episode-preview-modal__badge episode-preview-modal__badge--neutral">
                        Chưa tạo
                      </span>
                    )}
                  </span>
                </div>
                <div className="episode-preview-modal__spec-row">
                  <span className="episode-preview-modal__spec-label">Phụ đề WebVTT:</span>
                  <span className="episode-preview-modal__spec-value">
                    {subtitleCount > 0 ? `${subtitleCount} bản dịch` : 'Chưa có phụ đề'}
                  </span>
                </div>
                {onManageSubtitles && (
                  <Button
                    variant="outline"
                    size="small"
                    startIcon={<Subtitles size={14} />}
                    onClick={() => onManageSubtitles(episode)}
                  >
                    Quản lý phụ đề
                  </Button>
                )}
              </div>
            </div>

            {/* Card 3: Hồ sơ Quản trị */}
            <div className="episode-preview-modal__card">
              <div className="episode-preview-modal__card-header">
                <Info size={16} className="episode-preview-modal__card-icon" />
                <h4 className="episode-preview-modal__card-title">Hồ Sơ Tập Phim</h4>
              </div>
              <div className="episode-preview-modal__card-body">
                <div className="episode-preview-modal__spec-row">
                  <span className="episode-preview-modal__spec-label">Thời lượng:</span>
                  <span className="episode-preview-modal__spec-value">
                    {formatDuration(episode.duration)}
                  </span>
                </div>
                <div className="episode-preview-modal__spec-row">
                  <span className="episode-preview-modal__spec-label">Lượt xem:</span>
                  <span className="episode-preview-modal__spec-value">
                    {Number(episode.view_count || 0).toLocaleString()}
                  </span>
                </div>
                {episode.created_at && (
                  <div className="episode-preview-modal__spec-row">
                    <span className="episode-preview-modal__spec-label">Ngày tạo:</span>
                    <span className="episode-preview-modal__spec-value">
                      {formatDateTime(episode.created_at)}
                    </span>
                  </div>
                )}
                <div className="episode-preview-modal__id-row">
                  <span className="episode-preview-modal__id-text">{episode.id}</span>
                  <Tooltip content={copied ? 'Đã sao chép' : 'Sao chép ID'}>
                    <IconButton size="small" onClick={handleCopyId} aria-label="Sao chép ID">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="episode-preview-modal__footer">
          <span className="episode-preview-modal__footer-note">
            <MonitorPlay size={15} />
            Môi trường kiểm thử luồng HLS trực tiếp chuẩn Obsidian Cinema & The Aesthetic OS.
          </span>
          <div className="episode-preview-modal__footer-actions">
            {onManageSubtitles && (
              <Button
                variant="tonal"
                size="medium"
                startIcon={<Subtitles size={16} />}
                onClick={() => onManageSubtitles(episode)}
              >
                Quản lý Phụ đề
              </Button>
            )}
            <Button variant="filled" color="primary" size="medium" onClick={onClose}>
              Đóng Xem Trước
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

EpisodePreviewModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  episode: PropTypes.shape({
    id: PropTypes.string,
    movie_id: PropTypes.string,
    episode_number: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
    duration: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    status: PropTypes.string,
    publish_state: PropTypes.string,
    view_count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    video_sources: PropTypes.array,
    subtitles: PropTypes.array,
    storyboard_url: PropTypes.string,
    has_storyboard: PropTypes.bool,
    created_at: PropTypes.string,
  }),
  movieTitle: PropTypes.string,
  onManageSubtitles: PropTypes.func,
};

export default EpisodePreviewModal;
