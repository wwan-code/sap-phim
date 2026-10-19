/**
 * @file EpisodeListPage.jsx
 * @module Admin/Modules/Episodes/Pages/EpisodeListPage
 * @description Quản lý danh sách tập phim, tiến trình mã hóa video đa luồng (TUS Upload & FFmpeg ABR), phụ đề WebVTT và phát thử nghiệm Canvas Sprite Storyboard.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Film,
  Play,
  Trash2,
  Subtitles,
  Upload,
  RefreshCw,
  Clock,
  Layers,
  Calendar,
  CheckCircle2,
  Crown,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/admin/shared/components/layout/page-header/PageHeader';
import { AdminFilterToolbar } from '@/admin/shared/components/layout/filter-toolbar';
import { DataGrid, useDataGridQuery } from '@/admin/shared/components/data-display/data-grid';
import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import Badge from '@/shared/components/ui/badge';
import Select from '@/shared/components/ui/select';
import Tooltip from '@/shared/components/ui/tooltip';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';

import episodeService from '@/shared/services/episode.service';
import { EPISODE_QUERY_KEYS } from '@/hooks/queries/use-episode.queries';
import { useAdminMoviesQuery } from '@/hooks/queries/use-movie.queries';
import { useDeleteEpisodeMutation } from '@/hooks/mutations/use-episode.mutations';

import {
  EpisodeUploadModal,
  EpisodeTranscodeStatus,
  SubtitleManageModal,
  EpisodePreviewModal,
} from '../components';
import './episode-list-page.scss';

// ── Publish State Tabs ──
const PUBLISH_STATE_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'published', label: 'Đã xuất bản' },
  { id: 'draft', label: 'Bản nháp' },
  { id: 'scheduled', label: 'Đã lên lịch' },
];

// ── Transcode Status Options ──
const TRANSCODE_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái mã hóa' },
  { value: 'ready', label: 'Sẵn sàng (Ready)' },
  { value: 'processing', label: 'Đang mã hóa (Processing)' },
  { value: 'pending', label: 'Chờ tải lên (Pending)' },
  { value: 'failed', label: 'Lỗi mã hóa (Failed)' },
];

// ── Publish State Badges Config ──
const PUBLISH_STATE_CONFIG = {
  published: { label: 'Đã xuất bản', variant: 'success' },
  draft: { label: 'Bản nháp', variant: 'neutral' },
  scheduled: { label: 'Đã lên lịch', variant: 'info' },
};

/**
 * Trích xuất tiêu đề phim tiếng Việt hoặc mặc định từ movie object
 * @param {Object} movie
 * @returns {string}
 */
export const getMovieTitle = (movie) => {
  if (!movie) return 'Chưa liên kết';
  if (typeof movie.title === 'string' && movie.title.trim()) return movie.title;
  if (typeof movie.name === 'string' && movie.name.trim()) return movie.name;
  if (Array.isArray(movie.titles) && movie.titles.length > 0) {
    const vi = movie.titles.find((t) => t.type === 'vietnamese');
    if (vi?.title) return vi.title;
    const def = movie.titles.find((t) => t.type === 'default');
    if (def?.title) return def.title;
    const en = movie.titles.find((t) => t.type === 'english');
    if (en?.title) return en.title;
    return movie.titles[0]?.title || 'Chưa liên kết';
  }
  return 'Chưa liên kết';
};

/**
 * Trích xuất phụ đề (tiếng Anh hoặc Native) từ movie object
 * @param {Object} movie
 * @returns {string|null}
 */
export const getMovieSubTitle = (movie) => {
  if (!movie || !Array.isArray(movie.titles)) return null;
  const en = movie.titles.find((t) => t.type === 'english');
  if (en?.title) return en.title;
  const native = movie.titles.find((t) => t.type === 'native');
  if (native?.title) return native.title;
  return null;
};

/**
 * Format thời lượng video từ giây sang MM:SS hoặc HH:MM:SS
 * @param {number} seconds
 * @returns {string}
 */
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

export const EpisodeListPage = () => {
  // ── States ──
  const [activeTab, setActiveTab] = useState('all');
  const [movieFilter, setMovieFilter] = useState('all');
  const [transcodeFilter, setTranscodeFilter] = useState('all');

  // Drawers & Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTargetEpisode, setUploadTargetEpisode] = useState(null);
  const [subtitleModalOpen, setSubtitleModalOpen] = useState(false);
  const [subtitleTargetEpisode, setSubtitleTargetEpisode] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewEpisode, setPreviewEpisode] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, episode: null });

  // ── Fetch Movies List for Filter Dropdown ──
  const { data: moviesData } = useAdminMoviesQuery({ limit: 100 });
  const movies = moviesData?.items || [];

  const movieOptions = useMemo(() => {
    const list = [{ value: 'all', label: 'Tất cả phim' }];
    if (Array.isArray(movies)) {
      movies.forEach((m) => {
        list.push({
          value: m.id,
          label: getMovieTitle(m),
        });
      });
    }
    return list;
  }, [movies]);

  // ── Query Params ──
  const queryParams = useMemo(() => {
    const params = {};
    if (activeTab !== 'all') params.publish_state = activeTab;
    if (movieFilter !== 'all') params.movie_id = movieFilter;
    if (transcodeFilter !== 'all') params.status = transcodeFilter;
    return params;
  }, [activeTab, movieFilter, transcodeFilter]);

  // ── DataGrid Query Hook ──
  const {
    counts,
    gridProps,
    refetch,
  } = useDataGridQuery({
    queryKey: EPISODE_QUERY_KEYS.list(queryParams),
    queryFn: (params) => episodeService.listAdmin(params),
    customParams: queryParams,
    defaultSortModel: [{ field: 'episode_number', sort: 'asc' }],
    defaultPageSize: 20,
    syncUrlParams: false,
  });

  // ── Delete Mutation ──
  const deleteMutation = useDeleteEpisodeMutation({
    onSuccess: () => {
      toast.success('Đã xóa tập phim thành công!');
      setDeleteModal({ open: false, episode: null });
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Lỗi khi xóa tập phim');
    },
  });

  // Handlers
  const handleOpenUploadModal = useCallback((episode = null) => {
    setUploadTargetEpisode(episode);
    setUploadModalOpen(true);
  }, []);

  const handleOpenSubtitleModal = useCallback((episode) => {
    setSubtitleTargetEpisode(episode);
    setSubtitleModalOpen(true);
  }, []);

  const handleOpenPreview = useCallback((episode) => {
    setPreviewEpisode(episode);
    setPreviewModalOpen(true);
  }, []);

  const handleOpenDelete = useCallback((episode) => {
    setDeleteModal({ open: true, episode });
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteModal.episode) return;
    deleteMutation.mutate(deleteModal.episode.id);
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success('Đã sao chép mã tập phim!');
  };

  // ── DataGrid Columns ──
  const columns = useMemo(() => [
    {
      field: 'id',
      headerName: 'Mã Tập',
      width: 120,
      minWidth: 110,
      renderCell: ({ value }) => {
        const shortId = value ? `${value.slice(0, 8)}...` : 'N/A';
        return (
          <Tooltip content={`Click để chép mã: ${value}`} position="top">
            <span
              className="episode-admin-page__code-pill"
              onClick={() => handleCopyId(value)}
              style={{ cursor: 'pointer' }}
            >
              {shortId}
            </span>
          </Tooltip>
        );
      },
    },
    {
      field: 'episode_number',
      headerName: 'Tập Số',
      width: 130,
      minWidth: 120,
      renderCell: ({ row }) => (
        <div className="episode-admin-page__number-cell">
          <span className="episode-admin-page__number-badge">
            Tập {row.episode_number}
          </span>
          {row.is_premium && (
            <Tooltip content="Yêu cầu tài khoản VIP để xem" position="top">
              <span className="episode-admin-page__vip-tag">
                <Crown size={11} /> VIP
              </span>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      field: 'movie',
      headerName: 'Thuộc Phim',
      flex: 1.8,
      minWidth: 230,
      renderCell: ({ row }) => {
        const movie = row.movie;
        const mainTitle = getMovieTitle(movie);
        const subTitle = getMovieSubTitle(movie);
        const isSeries = movie?.type === 'series';

        return (
          <div className="episode-admin-page__movie-cell">
            <div className="movie-icon-badge">
              <Film size={16} />
            </div>
            <div className="movie-info">
              <span className="movie-name" title={mainTitle}>
                {mainTitle}
              </span>
              <span className="movie-meta">
                {isSeries ? 'Phim bộ' : 'Phim lẻ'}
                {subTitle ? ` • ${subTitle}` : ''}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      field: 'title',
      headerName: 'Tiêu Đề Tập',
      flex: 2,
      minWidth: 200,
      renderCell: ({ row }) => (
        <div className="episode-admin-page__title-cell">
          <span className="episode-title">{row.title || `Tập ${row.episode_number}`}</span>
        </div>
      ),
    },
    {
      field: 'duration',
      headerName: 'Thời Lượng',
      width: 120,
      minWidth: 110,
      renderCell: ({ value }) => (
        <span className="episode-admin-page__duration-cell">
          <Clock size={13} />
          {formatDuration(value)}
        </span>
      ),
    },
    {
      field: 'status',
      headerName: 'Tiến Trình Chuyển Mã',
      width: 230,
      minWidth: 220,
      renderCell: ({ row }) => (
        <EpisodeTranscodeStatus
          episodeId={row.id}
          status={row.status}
          progress={row.processing_progress}
          stage={row.processing_stage}
          error={row.processing_error}
          videoSources={row.video_sources}
          onComplete={() => refetch()}
        />
      ),
    },
    {
      field: 'video_sources',
      headerName: 'Chất Lượng ABR',
      width: 170,
      minWidth: 150,
      renderCell: ({ value }) => {
        const sources = Array.isArray(value) ? value : [];
        if (sources.length === 0) {
          return <span className="episode-admin-page__empty-sources">--</span>;
        }
        return (
          <div className="episode-admin-page__qualities">
            {sources.map((s) => {
              const q = s.quality || '';
              let modifier = '';
              if (q.includes('2160') || q.toLowerCase().includes('4k')) modifier = 'episode-admin-page__quality-pill--4k';
              else if (q.includes('1440') || q.toLowerCase().includes('2k')) modifier = 'episode-admin-page__quality-pill--2k';
              else if (q.includes('1080')) modifier = 'episode-admin-page__quality-pill--1080p';
              else if (q.includes('720')) modifier = 'episode-admin-page__quality-pill--720p';

              return (
                <span
                  key={s.quality}
                  className={`episode-admin-page__quality-pill ${modifier}`}
                >
                  {s.quality}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      field: 'publish_state',
      headerName: 'Trạng Thái',
      width: 140,
      minWidth: 130,
      renderCell: ({ value }) => {
        const cfg = PUBLISH_STATE_CONFIG[value] || { label: value || 'Bản nháp', variant: 'neutral' };
        return (
          <Badge variant={cfg.variant} size="small">
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      field: 'view_count',
      headerName: 'Lượt Xem',
      width: 110,
      minWidth: 100,
      renderCell: ({ value }) => (
        <span className="episode-admin-page__view-count">
          {Number(value || 0).toLocaleString()}
        </span>
      ),
    },
    {
      field: '__actions__',
      headerName: 'Thao Tác',
      width: 160,
      minWidth: 150,
      sortable: false,
      filterable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: ({ row }) => {
        const hasVideo = Array.isArray(row.video_sources) && row.video_sources.length > 0;
        const canPlay = row.status === 'ready' && hasVideo;
        const isProcessing = row.status === 'processing';

        return (
          <div className="episode-admin-page__actions-cell">
            {canPlay && (
              <Tooltip content="Xem trước (Canvas Player)" position="top">
                <IconButton
                  size="small"
                  variant="standard"
                  color="primary"
                  onClick={() => handleOpenPreview(row)}
                >
                  <Play size={15} />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip content="Quản lý Phụ đề WebVTT" position="top">
              <IconButton
                size="small"
                variant="standard"
                color="default"
                onClick={() => handleOpenSubtitleModal(row)}
              >
                <Subtitles size={15} />
              </IconButton>
            </Tooltip>

            {!isProcessing && (
              <Tooltip content="Tải lên / Ghi đè Video" position="top">
                <IconButton
                  size="small"
                  variant="standard"
                  color="default"
                  onClick={() => handleOpenUploadModal(row)}
                >
                  <Upload size={15} />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip content="Xóa tập phim" position="top">
              <IconButton
                size="small"
                variant="standard"
                color="danger"
                onClick={() => handleOpenDelete(row)}
              >
                <Trash2 size={15} />
              </IconButton>
            </Tooltip>
          </div>
        );
      },
    },
  ], [handleOpenPreview, handleOpenSubtitleModal, handleOpenUploadModal, handleOpenDelete, refetch]);

  return (
    <div className="admin-page-container episode-admin-page">
      {/* ── Page Header ── */}
      <PageHeader
        title="Quản Lý Tập Phim"
        subtitle="Hệ thống xử lý TUS Upload, giám sát chuyển mã ABR đa luồng (4K/2K/1080p/720p/480p), phụ đề WebVTT và phân phối HLS."
        badge={
          counts?.published !== undefined
            ? `${counts.published} đã xuất bản`
            : undefined
        }
        badgeVariant="success"
        actions={
          <div className="episode-admin-page__header-actions">
            <Button
              variant="outlined"
              color="default"
              startIcon={<RefreshCw size={15} />}
              onClick={() => refetch()}
            >
              Làm mới
            </Button>
            <Button
              variant="filled"
              color="primary"
              startIcon={<Plus size={16} />}
              onClick={() => handleOpenUploadModal(null)}
            >
              Upload Tập Mới
            </Button>
          </div>
        }
      />

      {/* ── KPI Stats Cards ── */}
      <div className="episode-admin-page__stats-grid">
        <div className="episode-admin-page__stat-card">
          <div className="episode-admin-page__stat-card-icon episode-admin-page__stat-card-icon--total">
            <Film size={24} />
          </div>
          <div className="episode-admin-page__stat-card-content">
            <span className="stat-label">Tổng Số Tập Phim</span>
            <span className="stat-value">
              {Number(counts?.all ?? gridProps.rowCount ?? 0).toLocaleString()}
            </span>
            <span className="stat-sub">Toàn bộ hệ thống</span>
          </div>
        </div>

        <div className="episode-admin-page__stat-card">
          <div className="episode-admin-page__stat-card-icon episode-admin-page__stat-card-icon--published">
            <CheckCircle2 size={24} />
          </div>
          <div className="episode-admin-page__stat-card-content">
            <span className="stat-label">Đã Xuất Bản</span>
            <span className="stat-value">
              {Number(counts?.published || 0).toLocaleString()}
            </span>
            <span className="stat-sub">Sẵn sàng phục vụ khán giả</span>
          </div>
        </div>

        <div className="episode-admin-page__stat-card">
          <div className="episode-admin-page__stat-card-icon episode-admin-page__stat-card-icon--draft">
            <Layers size={24} />
          </div>
          <div className="episode-admin-page__stat-card-content">
            <span className="stat-label">Bản Nháp</span>
            <span className="stat-value">
              {Number(counts?.draft || 0).toLocaleString()}
            </span>
            <span className="stat-sub">Chưa công khai</span>
          </div>
        </div>

        <div className="episode-admin-page__stat-card">
          <div className="episode-admin-page__stat-card-icon episode-admin-page__stat-card-icon--scheduled">
            <Calendar size={24} />
          </div>
          <div className="episode-admin-page__stat-card-content">
            <span className="stat-label">Đã Lên Lịch</span>
            <span className="stat-value">
              {Number(counts?.scheduled || 0).toLocaleString()}
            </span>
            <span className="stat-sub">Hẹn giờ công chiếu</span>
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <AdminFilterToolbar
        tabs={PUBLISH_STATE_TABS}
        activeTab={activeTab}
        counts={counts || {}}
        onTabChange={(t) => setActiveTab(t)}
      >
        <Select
          size="small"
          value={movieFilter}
          onChange={(_e, v) => setMovieFilter(v)}
          options={movieOptions}
          placeholder="Tất cả phim"
          className="episode-admin-page__filter-select"
        />

        <Select
          size="small"
          value={transcodeFilter}
          onChange={(_e, v) => setTranscodeFilter(v)}
          options={TRANSCODE_STATUS_OPTIONS}
          placeholder="Tất cả trạng thái mã hóa"
          className="episode-admin-page__filter-select"
        />
      </AdminFilterToolbar>

      {/* ── DataGrid Table ── */}
      <DataGrid
        title="Danh Sách Tập Phim Hệ Thống"
        columns={columns}
        getRowId={(row) => row.id}
        density="standard"
        toolbar
        showQuickFilter
        showColumnSelector
        showFilterButton
        showExportButton
        {...gridProps}
      />

      {/* ── Modal Tải lên Video ── */}
      <EpisodeUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        initialMovieId={movieFilter !== 'all' ? movieFilter : ''}
        initialEpisode={uploadTargetEpisode}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* ── Modal Quản lý Phụ đề WebVTT ── */}
      <SubtitleManageModal
        open={subtitleModalOpen}
        onClose={() => setSubtitleModalOpen(false)}
        episode={subtitleTargetEpisode}
      />

      {/* ── Modal Xem trước Video (Canvas Sprite Storyboard + HLS) ── */}
      <EpisodePreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        episode={previewEpisode}
        movieTitle={previewEpisode ? getMovieTitle(movies.find((m) => m.id === previewEpisode.movie_id)) : ''}
        onManageSubtitles={(ep) => {
          setPreviewModalOpen(false);
          handleOpenSubtitleModal(ep);
        }}
      />

      {/* ── Modal Xác Nhận Xóa Tập Phim ── */}
      <ConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, episode: null })}
        onConfirm={handleConfirmDelete}
        title="Xác Nhận Xóa Tập Phim"
        content={
          deleteModal.episode
            ? `Bạn có chắc chắn muốn xóa Tập ${deleteModal.episode.episode_number} (${deleteModal.episode.title || 'Không tiêu đề'})? Toàn bộ tài nguyên video HLS, storyboard và phụ đề liên kết sẽ bị xóa vĩnh viễn.`
            : ''
        }
        type="danger"
        confirmText="Xóa Tập Phim"
        loading={deleteMutation.isPending}
      />
    </div>
  );
};

export default EpisodeListPage;
