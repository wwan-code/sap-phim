/**
 * @file EpisodeUploadModal.jsx
 * @module Admin/Modules/Episodes/Components/EpisodeUploadModal
 * @description Modal tải lên video chuẩn TUS Resumable Upload kết nối thời gian thực với Video Server và hiển thị tiến trình chuyển mã ABR.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import * as tus from 'tus-js-client';
import {
  Upload,
  Film,
  FileVideo,
  Pause,
  Play,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  HardDrive,
} from 'lucide-react';

import Modal from '@/shared/components/ui/modal/Modal';
import Button from '@/shared/components/ui/button/Button';
import Select from '@/shared/components/ui/select/Select';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import { useUploadTokenMutation, useCreateEpisodeMutation } from '@/hooks/mutations/use-episode.mutations';
import { useAdminMoviesQuery, useAdminMovieDetailQuery } from '@/hooks/queries/use-movie.queries';
import EpisodeTranscodeStatus from './EpisodeTranscodeStatus';
import './episode-upload-modal.scss';

const getMovieTitle = (movie) => {
  if (!movie) return '';
  if (typeof movie === 'string') return movie;
  if (movie.name) return movie.name;
  if (movie.title) return movie.title;
  if (Array.isArray(movie.titles) && movie.titles.length > 0) {
    const vi = movie.titles.find((t) => t.type === 'vietnamese');
    if (vi?.title) return vi.title;
    const def = movie.titles.find((t) => t.type === 'default');
    if (def?.title) return def.title;
    const en = movie.titles.find((t) => t.type === 'english');
    if (en?.title) return en.title;
    const native = movie.titles.find((t) => t.type === 'native');
    if (native?.title) return native.title;
    return movie.titles[0]?.title || `Phim #${movie.id?.slice(0, 8)}`;
  }
  return `Phim #${movie.id?.slice(0, 8) || 'N/A'}`;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const EpisodeUploadModal = ({
  open = false,
  onClose,
  initialMovieId = '',
  initialEpisode = null,
  onSuccess,
}) => {
  const [movieId, setMovieId] = useState(initialMovieId);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Trạng thái: 'idle' | 'preparing' | 'uploading' | 'paused' | 'transcoding' | 'completed' | 'error'
  const [uploadState, setUploadState] = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentEpisodeId, setCurrentEpisodeId] = useState(initialEpisode?.id || null);

  const tusUploadRef = useRef(null);
  const lastTimeRef = useRef(Date.now());
  const lastBytesRef = useRef(0);

  const { data: moviesData } = useAdminMoviesQuery({ limit: 100 }, { enabled: open });
  const movies = moviesData?.items || [];

  const { data: singleMovieData } = useAdminMovieDetailQuery(movieId, {
    enabled: Boolean(open && movieId && !movies.some((m) => m.id === movieId)),
  });

  const allMovies = useMemo(() => {
    const list = [...movies];
    if (initialEpisode?.movie && !list.some((m) => m.id === initialEpisode.movie.id)) {
      list.unshift(initialEpisode.movie);
    }
    const singleMovie = singleMovieData?.data || singleMovieData;
    if (singleMovie?.id && !list.some((m) => m.id === singleMovie.id)) {
      list.unshift(singleMovie);
    }
    return list;
  }, [movies, initialEpisode, singleMovieData]);

  const movieOptions = useMemo(() => {
    return allMovies.map((m) => ({
      value: m.id,
      label: getMovieTitle(m),
    }));
  }, [allMovies]);

  const uploadTokenMutation = useUploadTokenMutation();
  const createEpisodeMutation = useCreateEpisodeMutation();

  useEffect(() => {
    if (open) {
      if (initialEpisode) {
        setCurrentEpisodeId(initialEpisode.id);
        setMovieId(initialEpisode.movie_id || initialMovieId);
        setEpisodeNumber(initialEpisode.episode_number || 1);
        setTitle(initialEpisode.title || '');
      } else {
        setMovieId(initialMovieId);
        setEpisodeNumber(1);
        setTitle('');
        setCurrentEpisodeId(null);
      }
      setSelectedFile(null);
      setUploadState('idle');
      setUploadProgress(0);
      setUploadedBytes(0);
      setTotalBytes(0);
      setUploadSpeed('');
      setErrorMessage('');
    } else {
      // Hủy upload nếu người dùng đóng modal khi đang tải lên
      if (tusUploadRef.current && (uploadState === 'uploading' || uploadState === 'paused')) {
        tusUploadRef.current.abort();
        tusUploadRef.current = null;
      }
    }
  }, [open, initialEpisode, initialMovieId]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setTotalBytes(file.size);
      if (!title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setTitle(`Tập ${episodeNumber} - ${cleanName}`);
      }
    }
  };

  const startTusUpload = useCallback(async () => {
    if (!selectedFile) {
      setErrorMessage('Vui lòng chọn tệp video');
      return;
    }

    if (!movieId) {
      setErrorMessage('Vui lòng chọn bộ phim');
      return;
    }

    try {
      setUploadState('preparing');
      setErrorMessage('');

      let episodeId = currentEpisodeId;

      // 1. Nếu chưa có episode -> Tạo episode mới trong cơ sở dữ liệu
      if (!episodeId) {
        const created = await createEpisodeMutation.mutateAsync({
          movie_id: movieId,
          episode_number: parseInt(episodeNumber, 10),
          title: title.trim() || `Tập ${episodeNumber}`,
        });
        episodeId = created.id;
        setCurrentEpisodeId(episodeId);
      }

      // 2. Yêu cầu cấp TUS Upload Token từ Main Backend
      const tokenResult = await uploadTokenMutation.mutateAsync(episodeId);
      const { tus_url, upload_token } = tokenResult;

      // Chuẩn hóa Endpoint TUS
      const targetEndpoint = tus_url.startsWith('http')
        ? tus_url
        : `${window.location.origin}${tus_url}`;

      // 3. Khởi tạo TUS client
      const upload = new tus.Upload(selectedFile, {
        endpoint: targetEndpoint,
        retryDelays: [0, 1000, 3000, 5000],
        headers: {
          'X-Upload-Token': upload_token,
        },
        metadata: {
          filename: selectedFile.name,
          filetype: selectedFile.type || 'video/mp4',
          episode_id: episodeId,
          movie_id: movieId,
          token: upload_token,
        },
        onError: (err) => {
          setUploadState('error');
          setErrorMessage(err.message || 'Lỗi khi tải tệp lên qua TUS');
        },
        onProgress: (bytesSent, bytesTotal) => {
          const now = Date.now();
          const timeDiff = (now - lastTimeRef.current) / 1000;

          if (timeDiff >= 0.8) {
            const bytesDiff = bytesSent - lastBytesRef.current;
            const speed = bytesDiff / timeDiff;
            setUploadSpeed(`${formatFileSize(speed)}/s`);
            lastTimeRef.current = now;
            lastBytesRef.current = bytesSent;
          }

          const percent = ((bytesSent / bytesTotal) * 100).toFixed(1);
          setUploadProgress(parseFloat(percent));
          setUploadedBytes(bytesSent);
          setTotalBytes(bytesTotal);
        },
        onSuccess: () => {
          setUploadState('transcoding');
          onSuccess?.({ episodeId });
        },
      });

      tusUploadRef.current = upload;
      lastTimeRef.current = Date.now();
      lastBytesRef.current = 0;

      // Bắt đầu tải lên
      upload.start();
      setUploadState('uploading');
    } catch (err) {
      setUploadState('error');
      setErrorMessage(err.message || 'Không thể chuẩn bị tiến trình tải lên');
    }
  }, [selectedFile, movieId, currentEpisodeId, episodeNumber, title, createEpisodeMutation, uploadTokenMutation, onSuccess]);


  const handlePauseResume = () => {
    if (!tusUploadRef.current) return;

    if (uploadState === 'uploading') {
      tusUploadRef.current.abort();
      setUploadState('paused');
    } else if (uploadState === 'paused') {
      tusUploadRef.current.start();
      setUploadState('uploading');
    }
  };

  const handleCancel = () => {
    if (uploadProgress > 10) {
      if (!window.confirm('Bạn có chắc chắn muốn hủy bỏ tiến trình tải lên video này không?')) {
        return;
      }
    }
    if (tusUploadRef.current) {
      tusUploadRef.current.abort();
      tusUploadRef.current = null;
    }
    setUploadState('idle');
    setUploadProgress(0);
  };

  const handleTranscodeComplete = () => {
    setUploadState('completed');
    onSuccess?.({ episodeId: currentEpisodeId });
  };

  return (
    <Modal
      open={open}
      onClose={uploadState === 'uploading' ? undefined : onClose}
      size="large"
    >
      <Modal.Header
        title="Tải Lên Video Tập Phim (ABR Transcode)"
        subtitle="Hệ thống xử lý TUS Resumable Upload & giám sát tiến trình chuyển mã HLS"
        onClose={uploadState === 'uploading' ? undefined : onClose}
        showCloseButton={uploadState !== 'uploading'}
      />

      <Modal.Body>
        <div className="episode-upload-modal">
          {/* Form nhập thông tin nếu chưa upload */}
          {uploadState === 'idle' && (
            <div className="episode-upload-modal__form">
              <div className="episode-upload-modal__field">
                <label className="episode-upload-modal__label">Thuộc Bộ Phim *</label>
                <Select
                  value={movieId}
                  onChange={(e, val) => setMovieId(val !== undefined ? val : e?.target?.value)}
                  options={movieOptions}
                  placeholder="-- Chọn hoặc tìm kiếm bộ phim --"
                  searchable
                  size="medium"
                  disabled={Boolean(initialEpisode)}
                />
              </div>

              <div className="episode-upload-modal__row">
                <div className="episode-upload-modal__field">
                  <label className="episode-upload-modal__label">Số Tập *</label>
                  <input
                    type="number"
                    min="1"
                    className="episode-upload-modal__input"
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                    disabled={Boolean(initialEpisode)}
                  />
                </div>
                <div className="episode-upload-modal__field episode-upload-modal__field--grow">
                  <label className="episode-upload-modal__label">Tiêu Đề Tập</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Khởi Đầu Mới"
                    className="episode-upload-modal__input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>

              {/* Dropzone chọn video */}
              <div className="episode-upload-modal__dropzone">
                <input
                  type="file"
                  id="episode-video-file"
                  accept="video/mp4,video/mkv,video/webm,video/quicktime"
                  className="episode-upload-modal__file-input"
                  onChange={handleFileChange}
                />
                <label htmlFor="episode-video-file" className="episode-upload-modal__dropzone-content">
                  {selectedFile ? (
                    <div className="episode-upload-modal__file-info">
                      <FileVideo size={36} className="episode-upload-modal__file-icon" />
                      <span className="episode-upload-modal__file-name">{selectedFile.name}</span>
                      <span className="episode-upload-modal__file-size">{formatFileSize(selectedFile.size)}</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={36} className="episode-upload-modal__upload-icon" />
                      <span className="episode-upload-modal__dropzone-text">
                        Nhấp để chọn video hoặc kéo thả tệp vào đây
                      </span>
                      <span className="episode-upload-modal__dropzone-hint">
                        Định dạng hỗ trợ: MP4, MKV, WebM, MOV (Tối đa 20GB)
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Tiến trình Upload TUS */}
          {(uploadState === 'uploading' || uploadState === 'paused' || uploadState === 'preparing') && (
            <div className="episode-upload-modal__progress-section">
              <div className="episode-upload-modal__status-header">
                <div className="episode-upload-modal__status-title">
                  {uploadState === 'preparing' ? (
                    <>
                      <Loader2 size={16} className="episode-upload-modal__spinner" />
                      <span>Đang khởi tạo phiên TUS...</span>
                    </>
                  ) : (
                    <>
                      <HardDrive size={16} />
                      <span>
                        {uploadState === 'paused' ? 'Đã tạm dừng tải lên' : 'Đang tải video lên server...'}
                      </span>
                    </>
                  )}
                </div>
                <span className="episode-upload-modal__speed">{uploadSpeed}</span>
              </div>

              <div className="episode-upload-modal__track">
                <div
                  className="episode-upload-modal__bar"
                  style={{ width: `${Math.min(100, uploadProgress)}%` }}
                />
              </div>

              <div className="episode-upload-modal__stats">
                <span>{uploadProgress}%</span>
                <span>
                  {formatFileSize(uploadedBytes)} / {formatFileSize(totalBytes)}
                </span>
              </div>

              <div className="episode-upload-modal__actions">
                <Tooltip content={uploadState === 'paused' ? 'Tiếp tục tải lên' : 'Tạm dừng tải lên'}>
                  <Button
                    size="small"
                    variant="tonal"
                    color={uploadState === 'paused' ? 'primary' : 'secondary'}
                    onClick={handlePauseResume}
                    startIcon={uploadState === 'paused' ? <Play size={14} /> : <Pause size={14} />}
                  >
                    {uploadState === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
                  </Button>
                </Tooltip>
                <Tooltip content="Hủy tiến trình tải lên">
                  <Button
                    size="small"
                    variant="tonal"
                    color="error"
                    onClick={handleCancel}
                    startIcon={<X size={14} />}
                  >
                    Hủy
                  </Button>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Tiến trình Transcoding thời gian thực qua Socket.IO */}
          {uploadState === 'transcoding' && currentEpisodeId && (
            <div className="episode-upload-modal__transcoding-section">
              <div className="episode-upload-modal__transcode-box">
                <Film size={24} className="episode-upload-modal__transcode-icon" />
                <div className="episode-upload-modal__transcode-content">
                  <span className="episode-upload-modal__transcode-title">
                    Tải lên hoàn tất! Đang thực hiện chuyển mã HLS & Sprites...
                  </span>
                  <p className="episode-upload-modal__transcode-desc">
                    Hệ thống đang chạy FFmpeg tự động phân giải 4K/1080p/720p/480p và tạo lưới hình thu nhỏ.
                    Bạn có thể đóng cửa sổ này, tiến trình vẫn sẽ tiếp tục chạy ngầm.
                  </p>
                  <EpisodeTranscodeStatus
                    episodeId={currentEpisodeId}
                    status="processing"
                    onComplete={handleTranscodeComplete}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Trạng thái hoàn tất thành công */}
          {uploadState === 'completed' && (
            <div className="episode-upload-modal__success-section">
              <CheckCircle2 size={48} className="episode-upload-modal__success-icon" />
              <h3 className="episode-upload-modal__success-title">Video Đã Sẵn Sàng!</h3>
              <p className="episode-upload-modal__success-desc">
                Tập phim đã được mã hóa đầy đủ các luồng ABR fMP4, thumbnail và storyboard sprites.
              </p>
            </div>
          )}

          {/* Báo lỗi nếu có */}
          {errorMessage && (
            <div className="episode-upload-modal__error-box">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer align="end">
        {uploadState === 'idle' && (
          <>
            <Button
              variant="tonal"
              color="secondary"
              onClick={onClose}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="filled"
              color="primary"
              onClick={startTusUpload}
              disabled={!selectedFile || !movieId || createEpisodeMutation.isPending || uploadTokenMutation.isPending}
              loading={uploadState === 'preparing'}
              startIcon={<Upload size={16} />}
            >
              Bắt Đầu Tải Lên
            </Button>
          </>
        )}

        {(uploadState === 'transcoding' || uploadState === 'completed') && (
          <Button
            variant="filled"
            color="primary"
            onClick={onClose}
          >
            Đóng & Xem Danh Sách
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );

};

EpisodeUploadModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  initialMovieId: PropTypes.string,
  initialEpisode: PropTypes.shape({
    id: PropTypes.string,
    movie_id: PropTypes.string,
    episode_number: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
  }),
  onSuccess: PropTypes.func,
};

export default EpisodeUploadModal;

