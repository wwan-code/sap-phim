/**
 * @file MoviePage.jsx
 * @module Admin/Modules/Movies/Pages/MoviePage
 * @description Quản lý danh sách phim ảnh, anime cấp Production chuẩn Material 3 Expressive, tích hợp DataGrid, Server-side Pagination/Search/Sort/Filter, Tabs trạng thái (All, Published, Draft, Trash), Actions và TanStack Query.
 */

import React, { useState, useMemo, memo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Film,
  Plus,
  Edit,
  Trash2,
  Star,
  ExternalLink,
  CheckCircle2,
  Clock,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/admin/shared/components/layout/page-header/PageHeader';
import { AdminFilterToolbar } from '@/admin/shared/components/layout/filter-toolbar';
import { DataGrid, useDataGridQuery, formatDate, formatNumber } from '@/admin/shared/components/data-display/data-grid';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';
import IconButton from '@/shared/components/ui/icon-button';
import Button from '@/shared/components/ui/button';
import Select from '@/shared/components/ui/select';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';
import Badge from '@/shared/components/ui/badge';
import { ScheduleModal } from '@/admin/modules/calendar';

import { ROUTES } from '@/shared/constants/routes.constants';
import movieService from '@/shared/services/movie.service';
import broadcastService from '@/shared/services/broadcast.service';
import { MOVIE_QUERY_KEYS } from '@/hooks/queries/use-movie.queries';
import { useAdminCategoriesQuery } from '@/hooks/queries/use-category.queries';
import {
  useAdminDeleteMovieMutation,
  useAdminRestoreMovieMutation,
  useAdminForceDeleteMovieMutation,
  useAdminBulkRestoreMovieMutation,
  useAdminBulkForceDeleteMovieMutation,
  useAdminEmptyTrashMutation,
} from '@/hooks/mutations/use-movie.mutations';
import { useUpsertBroadcastScheduleMutation } from '@/hooks/mutations/use-broadcast.mutations';

import './movie-page.scss';

const STATUS_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'published', label: 'Đã xuất bản' },
  { id: 'draft', label: 'Bản nháp' },
  { id: 'trash', label: 'Thùng rác' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Tất cả định dạng' },
  { value: 'series', label: 'Phim bộ (Series)' },
  { value: 'movie', label: 'Phim lẻ (Movie)' },
  { value: 'ova', label: 'OVA' },
  { value: 'ona', label: 'ONA' },
  { value: 'tv', label: 'TV Series' },
  { value: 'special', label: 'Special' },
];

/**
 * @component MovieMediaCell
 * @description Hiển thị thumbnail poster, tiêu đề chính, tên phụ/quốc tế và metadata phim trong DataGrid chuẩn Material 3 Expressive.
 */
const MovieMediaCell = memo(({ row, isTrash = false }) => {
  const [imageError, setImageError] = useState(false);

  const resolveRawUrl = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) return val.url || val.path || '';
    return '';
  };

  const posterUrl =
    resolveRawUrl(row.images?.poster) ||
    resolveRawUrl(row.images?.thumbnail) ||
    resolveRawUrl(row.poster_url) ||
    resolveRawUrl(row.poster) ||
    (Array.isArray(row.images) && resolveRawUrl(row.images[0])) ||
    '';

  const titles = Array.isArray(row.titles) ? row.titles : [];
  const primaryTitle =
    row.title ||
    titles.find((t) => t.type === 'default')?.title ||
    titles.find((t) => t.type === 'vietnamese')?.title ||
    titles[0]?.title ||
    row.name ||
    row.slug ||
    'Không có tiêu đề';

  const normPrimary = primaryTitle.trim().toLowerCase();

  // Lọc các title khác với primaryTitle
  const distinctTitles = titles.filter(
    (t) => t.title && t.title.trim().toLowerCase() !== normPrimary
  );

  const altTitle =
    (row.original_title && row.original_title.trim().toLowerCase() !== normPrimary && row.original_title.trim()) ||
    (row.originalTitle && row.originalTitle.trim().toLowerCase() !== normPrimary && row.originalTitle.trim()) ||
    distinctTitles.find((t) => t.type === 'romaji')?.title?.trim() ||
    distinctTitles.find((t) => t.type === 'english')?.title?.trim() ||
    distinctTitles.find((t) => t.type === 'native')?.title?.trim() ||
    distinctTitles.find((t) => t.type === 'vietnamese')?.title?.trim() ||
    distinctTitles[0]?.title?.trim() ||
    '';

  let yearText = '';
  if (row.release_year) {
    yearText = String(row.release_year);
  } else if (row.release_date) {
    const d = new Date(row.release_date);
    if (!isNaN(d.getFullYear())) yearText = String(d.getFullYear());
  } else if (row.year) {
    yearText = String(row.year);
  }

  let episodeText = '';
  if (row.total_episodes && Number(row.total_episodes) > 0) {
    episodeText = `${row.total_episodes} tập`;
  }

  return (
    <div className="sp-movie-page__media-cell">
      <div className="sp-movie-page__media-thumb-container">
        {posterUrl && !imageError ? (
          <img
            src={posterUrl}
            alt={primaryTitle}
            className="sp-movie-page__media-thumb"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="sp-movie-page__media-thumb-placeholder">
            <Film size={15} />
          </div>
        )}
        {row.is_premium && (
          <div className="sp-movie-page__media-vip-badge">
            <Badge variant="premium" size="small" radius="rounded" tooltip="Tác phẩm VIP">
              VIP
            </Badge>
          </div>
        )}
      </div>

      <div className="sp-movie-page__media-info">
        <div className="sp-movie-page__media-title-wrap">
          {isTrash ? (
            <span className="sp-movie-page__media-title" title={primaryTitle}>
              {primaryTitle}
            </span>
          ) : (
            <Link
              to={ROUTES.ADMIN.MOVIE_EDIT(row.id)}
              className="sp-movie-page__media-title"
              title={primaryTitle}
            >
              {primaryTitle}
            </Link>
          )}
        </div>

        <div className="sp-movie-page__media-meta">
          {altTitle ? (
            <span className="sp-movie-page__media-alt-title" title={altTitle}>
              {altTitle}
            </span>
          ) : null}

          {altTitle && (yearText || episodeText) ? (
            <span className="sp-movie-page__media-dot">•</span>
          ) : null}

          {yearText ? (
            <span className="sp-movie-page__media-meta-item">{yearText}</span>
          ) : null}

          {yearText && episodeText ? (
            <span className="sp-movie-page__media-dot">•</span>
          ) : null}

          {episodeText ? (
            <span className="sp-movie-page__media-meta-item">{episodeText}</span>
          ) : null}

          {row.quality ? (
            <>
              <span className="sp-movie-page__media-dot">•</span>
              <Badge variant="outline" size="small" radius="rounded">
                {row.quality}
              </Badge>
            </>
          ) : null}

          {row.sub_dub_type ? (
            <>
              <span className="sp-movie-page__media-dot">•</span>
              <Badge
                variant={row.sub_dub_type === 'dub' ? 'info' : 'muted'}
                size="small"
                radius="rounded"
              >
                {row.sub_dub_type === 'dub'
                  ? 'Lồng tiếng'
                  : row.sub_dub_type === 'both'
                    ? 'Sub & Dub'
                    : 'Vietsub'}
              </Badge>
            </>
          ) : null}

          {!altTitle && !yearText && !episodeText && row.slug ? (
            <span className="sp-movie-page__media-slug" title={row.slug}>
              /{row.slug}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
});

MovieMediaCell.displayName = 'MovieMediaCell';

export const MoviePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab & Filters State đồng bộ 2 chiều qua URL
  const activeTab = searchParams.get('tab') || 'all';
  const typeFilter = searchParams.get('type') || '';
  const categoryFilter = searchParams.get('category') || '';
  const [selectedIds, setSelectedIds] = useState([]);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: 'danger',
    title: '',
    content: '',
    confirmText: 'Xác nhận',
    onConfirm: () => { },
  });

  // Query metadata danh mục để lọc
  const { data: categoriesData } = useAdminCategoriesQuery({ limit: 100 });
  const categoryOptions = useMemo(() => {
    const items = categoriesData?.items || categoriesData || [];
    return [
      { value: '', label: 'Tất cả danh mục' },
      ...items.map((cat) => ({ value: cat.id, label: cat.name })),
    ];
  }, [categoriesData]);

  // Tham số query tùy chỉnh theo Tab và Filter Dropdown
  const customParams = useMemo(() => {
    const params = {};
    if (activeTab === 'published') params.is_published = true;
    if (activeTab === 'draft') params.is_published = false;
    if (activeTab === 'trash') params.tab = 'trash';

    if (typeFilter) params.type = typeFilter;
    if (categoryFilter) params.category = categoryFilter;

    return params;
  }, [activeTab, typeFilter, categoryFilter]);

  // DataGrid Query Hook với URL SearchParams Sync
  const { gridProps, refetch, data, optimisticRemoveRow } = useDataGridQuery({
    queryKey: MOVIE_QUERY_KEYS.adminList(customParams),
    queryFn: (params) => movieService.getAll(params),
    customParams,
    defaultSortModel: [{ field: 'updated_at', sort: 'desc' }],
    defaultPageSize: 20,
    syncUrlParams: true,
  });

  // Đọc counts từ response backend
  const counts = data?.meta?.counts || {};
  const tabCounts = useMemo(() => ({
    all: counts.all,
    published: counts.published,
    draft: counts.drafts ?? counts.draft,
    trash: counts.trash,
  }), [counts]);

  // Mutations
  const deleteMutation = useAdminDeleteMovieMutation();
  const restoreMutation = useAdminRestoreMovieMutation();
  const forceDeleteMutation = useAdminForceDeleteMovieMutation();
  const bulkRestoreMutation = useAdminBulkRestoreMovieMutation();
  const bulkForceDeleteMutation = useAdminBulkForceDeleteMovieMutation();
  const emptyTrashMutation = useAdminEmptyTrashMutation();
  const upsertScheduleMutation = useUpsertBroadcastScheduleMutation();

  // Lịch phát sóng (Broadcast Schedule)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedScheduleData, setSelectedScheduleData] = useState(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);

  const handleOpenSchedule = async (movie) => {
    setIsScheduleLoading(true);
    try {
      const schedule = await broadcastService.getByMovieId(movie.id);
      if (schedule && schedule.movie_id) {
        setSelectedScheduleData(schedule);
      } else {
        setSelectedScheduleData({ movie_id: movie.id, movie });
      }
    } catch (_) {
      setSelectedScheduleData({ movie_id: movie.id, movie });
    } finally {
      setIsScheduleLoading(false);
      setIsScheduleModalOpen(true);
    }
  };

  const handleSaveSchedule = async ({ movieId, payload }) => {
    try {
      await upsertScheduleMutation.mutateAsync({ movieId, payload });
      toast.success('Cập nhật lịch phát sóng thành công!');
      setIsScheduleModalOpen(false);
      setSelectedScheduleData(null);
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi lưu lịch phát sóng');
    }
  };

  const handleCloseSchedule = () => {
    setIsScheduleModalOpen(false);
    setSelectedScheduleData(null);
  };

  // Handlers chuyển Tab và Bộ lọc kèm cập nhật URL SearchParams
  const handleTabChange = (tabId) => {
    setSelectedIds([]);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!tabId || tabId === 'all') {
        next.delete('tab');
      } else {
        next.set('tab', tabId);
      }
      next.set('page', '1');
      return next;
    }, { replace: true });
  };

  const handleTypeChange = (eventOrVal) => {
    const typeVal = eventOrVal?.target ? eventOrVal.target.value : eventOrVal;
    setSelectedIds([]);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!typeVal) {
        next.delete('type');
      } else {
        next.set('type', typeVal);
      }
      next.set('page', '1');
      return next;
    }, { replace: true });
  };

  const handleCategoryChange = (eventOrVal) => {
    const catVal = eventOrVal?.target ? eventOrVal.target.value : eventOrVal;
    setSelectedIds([]);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!catVal) {
        next.delete('category');
      } else {
        next.set('category', catVal);
      }
      next.set('page', '1');
      return next;
    }, { replace: true });
  };

  // 1. Xóa mềm đơn lẻ (Chuyển vào thùng rác) - Optimistic Update 0ms
  const handleDeleteItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Chuyển phim vào thùng rác',
      content: `Bạn có chắc chắn muốn chuyển tác phẩm "${item.title || item.slug}" vào thùng rác?`,
      confirmText: 'Chuyển vào thùng rác',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        const rollback = optimisticRemoveRow(item.id);
        try {
          await deleteMutation.mutateAsync(item.id);
          toast.success('Đã chuyển phim vào thùng rác!');
        } catch (err) {
          rollback();
          toast.error(err?.message || 'Lỗi khi xóa phim');
        }
      },
    });
  };

  // 2. Khôi phục phim đơn lẻ từ thùng rác - Optimistic Update 0ms
  const handleRestoreItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'primary',
      title: 'Khôi phục tác phẩm',
      content: `Bạn có muốn khôi phục tác phẩm "${item.title || item.slug}" trở lại danh sách quản lý?`,
      confirmText: 'Khôi phục',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        const rollback = optimisticRemoveRow(item.id);
        try {
          await restoreMutation.mutateAsync(item.id);
          toast.success('Khôi phục phim thành công!');
        } catch (err) {
          rollback();
          toast.error(err?.message || 'Lỗi khi khôi phục phim');
        }
      },
    });
  };

  // 3. Xóa vĩnh viễn phim đơn lẻ khỏi hệ thống - Optimistic Update 0ms
  const handleForceDeleteItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Xóa vĩnh viễn phim',
      content: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN tác phẩm "${item.title || item.slug}"? Toàn bộ dữ liệu và tập tin hình ảnh liên quan trên máy chủ sẽ bị xóa sạch. Không thể hoàn tác!`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        const rollback = optimisticRemoveRow(item.id);
        try {
          await forceDeleteMutation.mutateAsync(item.id);
          toast.success('Đã xóa vĩnh viễn tác phẩm khỏi hệ thống!');
        } catch (err) {
          rollback();
          toast.error(err?.message || 'Lỗi khi xóa vĩnh viễn phim');
        }
      },
    });
  };

  // 4. Khôi phục hàng loạt phim đã chọn - Optimistic Update 0ms
  const handleBulkRestore = () => {
    if (selectedIds.length === 0) return;
    const targetIds = [...selectedIds];
    setConfirmModal({
      open: true,
      type: 'primary',
      title: `Khôi phục ${targetIds.length} tác phẩm`,
      content: `Bạn có muốn khôi phục ${targetIds.length} tác phẩm đã chọn trở lại danh sách quản lý?`,
      confirmText: 'Khôi phục tất cả',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setSelectedIds([]);
        const rollback = optimisticRemoveRow(targetIds);
        try {
          const res = await bulkRestoreMutation.mutateAsync(targetIds);
          toast.success(`Đã khôi phục ${res?.count || targetIds.length} phim thành công!`);
        } catch (err) {
          rollback();
          toast.error(err?.message || 'Lỗi khi khôi phục phim hàng loạt');
        }
      },
    });
  };

  // 5. Xóa vĩnh viễn hàng loạt phim đã chọn - Optimistic Update 0ms
  const handleBulkForceDelete = () => {
    if (selectedIds.length === 0) return;
    const targetIds = [...selectedIds];
    setConfirmModal({
      open: true,
      type: 'danger',
      title: `Xóa vĩnh viễn ${targetIds.length} tác phẩm`,
      content: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${targetIds.length} tác phẩm đã chọn? Tất cả dữ liệu và tệp tin hình ảnh sẽ bị xóa hoàn toàn khỏi máy chủ!`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setSelectedIds([]);
        const rollback = optimisticRemoveRow(targetIds);
        try {
          const res = await bulkForceDeleteMutation.mutateAsync(targetIds);
          toast.success(`Đã xóa vĩnh viễn ${res?.count || targetIds.length} tác phẩm!`);
        } catch (err) {
          rollback();
          toast.error(err?.message || 'Lỗi khi xóa vĩnh viễn hàng loạt');
        }
      },
    });
  };

  // 6. Chuyển hàng loạt phim đã chọn vào thùng rác - Optimistic Update 0ms
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const targetIds = [...selectedIds];
    setConfirmModal({
      open: true,
      type: 'danger',
      title: `Chuyển ${targetIds.length} tác phẩm vào thùng rác`,
      content: `Bạn có chắc chắn muốn chuyển ${targetIds.length} tác phẩm đã chọn vào thùng rác?`,
      confirmText: 'Chuyển vào thùng rác',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setSelectedIds([]);
        const rollback = optimisticRemoveRow(targetIds);
        try {
          await Promise.all(targetIds.map((id) => deleteMutation.mutateAsync(id)));
          toast.success(`Đã chuyển ${targetIds.length} phim vào thùng rác!`);
        } catch (err) {
          rollback();
          toast.error(err?.message || 'Lỗi khi chuyển phim vào thùng rác');
        }
      },
    });
  };

  // 7. Dọn sạch toàn bộ thùng rác
  const handleEmptyTrash = () => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Dọn sạch thùng rác',
      content: `Bạn có chắc chắn muốn dọn sạch toàn bộ thùng rác (${counts.trash || 0} tác phẩm)? Toàn bộ dữ liệu và tệp tin hình ảnh sẽ bị xóa vĩnh viễn không thể khôi phục!`,
      confirmText: 'Dọn sạch thùng rác',
      onConfirm: async () => {
        try {
          const res = await emptyTrashMutation.mutateAsync();
          toast.success(`Đã dọn sạch thùng rác (${res?.count || 0} tác phẩm đã xóa vĩnh viễn)!`);
          setSelectedIds([]);
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi dọn sạch thùng rác');
        }
      },
    });
  };

  // Cột DataGrid chuẩn Material 3 Expressive
  const columns = useMemo(
    () => [
      {
        field: 'title',
        headerName: 'Tác Phẩm',
        flex: 2.5,
        minWidth: 280,
        valueGetter: ({ row }) => {
          if (!row) return '';
          return (
            row.title ||
            (Array.isArray(row.titles) && row.titles.find((t) => t.type === 'default')?.title) ||
            (Array.isArray(row.titles) && row.titles.find((t) => t.type === 'vietnamese')?.title) ||
            (Array.isArray(row.titles) && row.titles.find((t) => t.is_primary)?.title) ||
            (Array.isArray(row.titles) && row.titles[0]?.title) ||
            row.name ||
            row.slug ||
            ''
          );
        },
        renderCell: ({ row }) => (
          <MovieMediaCell row={row} isTrash={activeTab === 'trash'} />
        ),
      },
      {
        field: 'type',
        headerName: 'Định Dạng',
        width: 120,
        minWidth: 100,
        valueGetter: ({ row }) => row.type || 'series',
        renderCell: ({ value }) => {
          const type = (value || 'series').toLowerCase();
          const typeConfig = {
            series: { label: 'SERIES', variant: 'accent' },
            movie: { label: 'MOVIE', variant: 'info' },
            ova: { label: 'OVA', variant: 'warning' },
            ona: { label: 'ONA', variant: 'primary' },
            tv: { label: 'TV', variant: 'success' },
            special: { label: 'SPECIAL', variant: 'success' },
          };
          const config = typeConfig[type] || { label: type.toUpperCase(), variant: 'default' };
          return (
            <Badge variant={config.variant} size="small" radius="rounded">
              {config.label}
            </Badge>
          );
        },
      },
      {
        field: 'category',
        headerName: 'Danh Mục',
        width: 140,
        minWidth: 120,
        valueGetter: ({ row }) => row.category?.name || '',
        renderCell: ({ row }) => (
          <span className="sp-movie-page__category-name">
            {row.category?.name || '—'}
          </span>
        ),
      },
      {
        field: 'genres',
        headerName: 'Thể Loại',
        flex: 1.8,
        minWidth: 200,
        valueGetter: ({ row }) => (row.genres || []).map((g) => g.name).join(', '),
        renderCell: ({ row }) => {
          const genres = row.genres || [];
          if (!genres.length) return <span className="text-muted">—</span>;

          const firstLen = genres[0]?.name?.length || 0;
          const secondLen = genres[1]?.name?.length || 0;
          const showTwo = genres.length >= 2 && firstLen + secondLen <= 20;

          const visibleCount = showTwo ? 2 : 1;
          const visible = genres.slice(0, visibleCount);
          const remaining = genres.slice(visibleCount);

          return (
            <div className="sp-movie-page__tags-list">
              {visible.map((g) => (
                <Badge
                  key={g.id || g.slug}
                  variant="muted"
                  size="small"
                  radius="rounded"
                >
                  {g.name}
                </Badge>
              ))}
              {remaining.length > 0 && (
                <Badge
                  variant="neutral"
                  size="small"
                  radius="rounded"
                  tooltip={remaining.map((g) => g.name).join(', ')}
                >
                  +{remaining.length}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Trạng Thái',
        width: 150,
        minWidth: 140,
        valueGetter: ({ row }) => row.status || 'ongoing',
        renderCell: ({ value }) => {
          const status = (value || 'ongoing').toLowerCase();
          const statusConfig = {
            ongoing: { label: 'Đang phát sóng', variant: 'success' },
            completed: { label: 'Hoàn thành', variant: 'info' },
            upcoming: { label: 'Sắp chiếu', variant: 'warning' },
            hiatus: { label: 'Tạm ngưng', variant: 'warning' },
            cancelled: { label: 'Đã hủy', variant: 'error' },
          };
          const config = statusConfig[status] || { label: status, variant: 'neutral' };
          return (
            <Badge
              variant={config.variant}
              size="small"
              radius="full"
              icon={<span className={`sp-movie-page__status-dot sp-movie-page__status-dot--${config.variant}`} />}
            >
              {config.label}
            </Badge>
          );
        },
      },
      {
        field: 'is_published',
        headerName: 'Xuất Bản',
        width: 125,
        minWidth: 115,
        valueGetter: ({ row }) => (row.is_published ? 'Công khai' : 'Bản nháp'),
        renderCell: ({ value }) => (
          <Badge
            variant={value ? 'success' : 'muted'}
            size="small"
            radius="full"
            icon={value ? <CheckCircle2 size={12} /> : <Clock size={12} />}
          >
            {value ? 'Công khai' : 'Bản nháp'}
          </Badge>
        ),
      },
      {
        field: 'rating',
        headerName: 'Đánh Giá',
        width: 130,
        minWidth: 110,
        valueGetter: ({ row }) => row.rating_average ?? row.rating ?? 0,
        renderCell: ({ row }) => {
          const rating = row.rating_average ?? row.rating ?? 0;
          const views = row.view_count ?? row.total_views ?? row.views ?? 0;
          return (
            <div className="sp-movie-page__stats-cell">
              <div className="sp-movie-page__rating-row">
                <Star size={13} className="sp-movie-page__star-icon" fill="currentColor" />
                <span>{Number(rating).toFixed(1)}</span>
              </div>
              <span className="sp-movie-page__views-text">
                {formatNumber(views)} lượt xem
              </span>
            </div>
          );
        },
      },
      {
        field: 'updated_at',
        headerName: 'Cập Nhật',
        width: 130,
        minWidth: 110,
        valueGetter: ({ row }) => row.updated_at || row.updatedAt || row.created_at || '',
        renderCell: ({ value, row }) => (
          <span className="sp-movie-page__date-text">
            {formatDate(value || row.updatedAt || row.created_at)}
          </span>
        ),
      },
      {
        field: 'actions',
        headerName: 'Thao Tác',
        width: activeTab === 'trash' ? 100 : 155,
        minWidth: activeTab === 'trash' ? 100 : 155,
        sortable: false,
        renderCell: ({ row }) => (
          <div className="sp-movie-page__actions-group">
            {activeTab === 'trash' ? (
              <>
                <Tooltip title="Khôi phục tác phẩm" placement="top" arrow>
                  <IconButton
                    size="small"
                    variant="standard"
                    color="primary"
                    onClick={() => handleRestoreItem(row)}
                  >
                    <RotateCcw size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Xóa vĩnh viễn" placement="top" arrow>
                  <IconButton
                    size="small"
                    variant="standard"
                    color="danger"
                    onClick={() => handleForceDeleteItem(row)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                {row.slug && (
                  <Tooltip title="Xem trên web" placement="top" arrow>
                    <IconButton
                      size="small"
                      variant="standard"
                      onClick={() => window.open(ROUTES.MOVIE_DETAIL(row.slug), '_blank')}
                    >
                      <ExternalLink size={16} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Cấu hình lịch phát sóng" placement="top" arrow>
                  <IconButton
                    size="small"
                    variant="standard"
                    onClick={() => handleOpenSchedule(row)}
                    disabled={isScheduleLoading}
                  >
                    <Calendar size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Chỉnh sửa phim" placement="top" arrow>
                  <IconButton
                    size="small"
                    variant="standard"
                    onClick={() => navigate(ROUTES.ADMIN.MOVIE_EDIT(row.id))}
                  >
                    <Edit size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Chuyển vào thùng rác" placement="top" arrow>
                  <IconButton
                    size="small"
                    variant="standard"
                    color="danger"
                    onClick={() => handleDeleteItem(row)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </div>
        ),
      },
    ],
    [navigate, activeTab, isScheduleLoading]
  );

  return (
    <div className="sp-movie-page">
      {/* 1. Page Header */}
      <PageHeader
        title="Quản Lý Phim & Anime"
        description="Quản lý danh mục phim, anime, định dạng, trạng thái phát hành và phân loại nội dung."
        icon={Film}
        badge={counts.all ? `${formatNumber(counts.all)} tác phẩm` : undefined}
        badgeVariant="primary"
        actions={
          <div className="sp-movie-page__header-actions">
            {activeTab === 'trash' && Number(counts.trash || 0) > 0 && (
              <Button
                variant="outlined"
                color="danger"
                startIcon={<Trash2 size={16} />}
                onClick={handleEmptyTrash}
              >
                Dọn Sạch Thùng Rác
              </Button>
            )}
            <Button
              variant="filled"
              startIcon={<Plus size={18} />}
              onClick={() => navigate(ROUTES.ADMIN.MOVIE_CREATE)}
            >
              Thêm Phim Mới
            </Button>
          </div>
        }
      />

      {/* 2. Status Tabs & Extra Filter Toolbar */}
      <AdminFilterToolbar
        tabs={STATUS_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={tabCounts}
      >
        <Select
          size="small"
          value={typeFilter}
          onChange={handleTypeChange}
          options={TYPE_OPTIONS}
          placeholder="Tất cả định dạng"
          className="sp-movie-page__filter-select"
        />
        <Select
          size="small"
          value={categoryFilter}
          onChange={handleCategoryChange}
          options={categoryOptions}
          placeholder="Tất cả danh mục"
          className="sp-movie-page__filter-select"
        />
      </AdminFilterToolbar>

      {/* 3. Centralized DataGrid with Native Selection & Bulk Actions */}
      <DataGrid
        title="Danh Sách Phim & Anime"
        columns={columns}
        getRowId={(row) => row.id}
        checkboxSelection
        rowSelectionModel={selectedIds}
        onRowSelectionModelChange={setSelectedIds}
        customBulkActions={
          activeTab === 'trash' ? (
            <>
              <Button
                size="small"
                variant="tonal"
                startIcon={<RotateCcw size={14} />}
                onClick={handleBulkRestore}
              >
                Khôi phục ({selectedIds.length})
              </Button>
              <Button
                size="small"
                variant="filled"
                color="error"
                startIcon={<Trash2 size={14} />}
                onClick={handleBulkForceDelete}
              >
                Xóa vĩnh viễn ({selectedIds.length})
              </Button>
            </>
          ) : (
            <Button
              size="small"
              variant="filled"
              color="error"
              startIcon={<Trash2 size={14} />}
              onClick={handleBulkDelete}
            >
              Chuyển vào thùng rác ({selectedIds.length})
            </Button>
          )
        }
        density="standard"
        toolbar
        showQuickFilter
        showColumnSelector
        showFilterButton
        showExportButton
        quickFilterPlaceholder="Tìm kiếm theo tiêu đề, slug, mô tả..."
        onAddRecord={() => navigate(ROUTES.ADMIN.MOVIE_CREATE)}
        addRecordLabel="Thêm Phim Mới"
        emptyTitle={activeTab === 'trash' ? 'Thùng rác trống' : 'Chưa có tác phẩm nào'}
        emptyDescription={
          activeTab === 'trash'
            ? 'Không có tác phẩm nào trong thùng rác.'
            : 'Danh sách phim đang trống hoặc không có kết quả phù hợp với bộ lọc.'
        }
        {...gridProps}
      />

      {/* 4. Confirmation Modal */}
      <ConfirmModal
        open={confirmModal.open}
        type={confirmModal.type}
        title={confirmModal.title}
        content={confirmModal.content}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
      />

      {/* 5. Schedule Modal */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        initialSchedule={selectedScheduleData}
        onClose={handleCloseSchedule}
        onSave={handleSaveSchedule}
        loading={upsertScheduleMutation.isPending}
      />
    </div>
  );
};

export default memo(MoviePage);
