/**
 * @file NotificationListPage.jsx
 * @module Admin/Modules/Notifications/Pages/NotificationListPage
 * @description Quản lý và phát thông báo hệ thống chuẩn Material 3 Expressive, tích hợp DataGrid, Drawer phát sóng, Drawer chi tiết và Socket Realtime.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  Eye,
  Trash2,
  Globe,
  Clock,
  RotateCcw,
  BellOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/admin/shared/components/layout/page-header/PageHeader';
import { AdminFilterToolbar } from '@/admin/shared/components/layout/filter-toolbar';
import { DataGrid, formatDate, useDataGridQuery } from '@/admin/shared/components/data-display/data-grid';
import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import Badge from '@/shared/components/ui/badge';
import Select from '@/shared/components/ui/select';
import Tooltip from '@/shared/components/ui/tooltip';
import Avatar from '@/shared/components/ui/avatar';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';

import notificationService from '@/shared/services/notification.service';
import {
  ADMIN_NOTIFICATION_QUERY_KEYS,
  useAdminNotificationStatsQuery,
} from '@/hooks/queries/use-notification.queries';
import {
  useAdminDeleteNotificationMutation,
  useAdminBulkDeleteNotificationsMutation,
} from '@/hooks/mutations/use-notification.mutations';
import { useSocketEvent } from '@/hooks/socket/use-socket';
import { SOCKET_EVENTS } from '@/shared/constants/socket-events.constants';

import {
  NotificationKpiStats,
  BroadcastNotificationDrawer,
  NotificationDetailDrawer,
} from '../components';

import './notification-list-page.scss';

// ── Dropdown Filter Options ──
const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả loại thông báo' },
  { value: 'system', label: 'Hệ thống (System)' },
  { value: 'admin', label: 'Ban quản trị (Admin)' },
  { value: 'movie_new', label: 'Phim mới' },
  { value: 'movie_update', label: 'Cập nhật phim' },
  { value: 'account_security', label: 'Bảo mật tài khoản' },
  { value: 'welcome', label: 'Chào mừng' },
];

const PRIORITY_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả mức ưu tiên' },
  { value: 'critical', label: 'Khẩn cấp (Critical)' },
  { value: 'high', label: 'Cao (High)' },
  { value: 'normal', label: 'Bình thường (Normal)' },
  { value: 'low', label: 'Thấp (Low)' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái đọc' },
  { value: 'read', label: 'Đã đọc' },
  { value: 'unread', label: 'Chưa đọc' },
];

export const NotificationListPage = () => {
  // ── States Bộ lọc ──
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterReadStatus, setFilterReadStatus] = useState('all');

  // ── States Drawers & Modals ──
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [detailNotification, setDetailNotification] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    singleId: null,
    isBulk: false,
  });

  // ── State Hàng được chọn trên DataGrid ──
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  // ── 1. Truy vấn thống kê KPI ──
  const {
    data: statsData,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useAdminNotificationStatsQuery();

  // ── 2. Tham số lọc tùy biến cho DataGrid ──
  const customParams = useMemo(() => {
    const params = {};
    if (filterType !== 'all') params.type = filterType;
    if (filterPriority !== 'all') params.priority = filterPriority;
    if (filterReadStatus === 'read') params.isRead = true;
    if (filterReadStatus === 'unread') params.isRead = false;
    return params;
  }, [filterType, filterPriority, filterReadStatus]);

  // ── 3. DataGrid TanStack Query tích hợp 2 chiều ──
  const {
    gridProps,
    refetch: refetchNotifications,
    isFetching,
  } = useDataGridQuery({
    queryKey: ADMIN_NOTIFICATION_QUERY_KEYS.list(customParams),
    queryFn: (params) => notificationService.listAdminNotifications(params),
    customParams,
    defaultSortModel: [{ field: 'created_at', sort: 'desc' }],
    defaultPageSize: 15,
    syncUrlParams: false,
  });

  // ── 4. Mutations Xóa đơn & Xóa hàng loạt ──
  const deleteSingleMutation = useAdminDeleteNotificationMutation({
    onSuccess: () => {
      toast.success('Đã xóa thông báo khỏi hệ thống thành công');
      setDeleteConfirm({ open: false, singleId: null, isBulk: false });
      if (detailNotification) setDetailNotification(null);
      refetchStats();
      refetchNotifications();
    },
    onError: (err) => {
      toast.error(err.message || 'Không thể xóa thông báo');
    },
  });

  const bulkDeleteMutation = useAdminBulkDeleteNotificationsMutation({
    onSuccess: (data) => {
      toast.success(`Đã xóa ${data?.deleted ?? selectedRowIds.length} thông báo thành công`);
      setSelectedRowIds([]);
      setDeleteConfirm({ open: false, singleId: null, isBulk: false });
      refetchStats();
      refetchNotifications();
    },
    onError: (err) => {
      toast.error(err.message || 'Lỗi khi xóa hàng loạt thông báo');
    },
  });

  // ── 5. Realtime Socket Sync ──
  useSocketEvent(SOCKET_EVENTS.NOTIFICATION_NEW, () => {
    refetchNotifications();
    refetchStats();
  });
  useSocketEvent(SOCKET_EVENTS.ADMIN_NOTIFICATION, () => {
    refetchNotifications();
    refetchStats();
  });
  useSocketEvent(SOCKET_EVENTS.NOTIFICATION_DELETED, () => {
    refetchNotifications();
    refetchStats();
  });

  // ── Handlers Thao tác ──
  const handleRefreshAll = useCallback(() => {
    refetchStats();
    refetchNotifications();
    toast.success('Đã làm mới danh sách thông báo');
  }, [refetchStats, refetchNotifications]);

  const handleResetFilters = useCallback(() => {
    setFilterType('all');
    setFilterPriority('all');
    setFilterReadStatus('all');
  }, []);

  const hasActiveFilters = filterType !== 'all' || filterPriority !== 'all' || filterReadStatus !== 'all';

  const handleOpenDeleteSingle = useCallback((id) => {
    setDeleteConfirm({ open: true, singleId: id, isBulk: false });
  }, []);

  const handleOpenBulkDelete = useCallback(() => {
    if (selectedRowIds.length === 0) return;
    setDeleteConfirm({ open: true, singleId: null, isBulk: true });
  }, [selectedRowIds]);

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirm.isBulk) {
      bulkDeleteMutation.mutate(selectedRowIds);
    } else if (deleteConfirm.singleId) {
      deleteSingleMutation.mutate(deleteConfirm.singleId);
    }
  }, [deleteConfirm, selectedRowIds, bulkDeleteMutation, deleteSingleMutation]);

  // ── Cột hiển thị DataGrid ──
  const columns = useMemo(
    () => [
      {
        field: 'title',
        headerName: 'Tiêu Đề Thông Báo',
        flex: 1.8,
        minWidth: 260,
        renderCell: ({ row }) => (
          <div className="notif-title-cell">
            <div className="notif-title-cell__icon">
              {row?.icon || '🔔'}
            </div>
            <div className="notif-title-cell__details">
              <span className="notif-title-cell__text" title={row?.title}>
                {row?.title || 'Không có tiêu đề'}
              </span>
              <span className="notif-title-cell__sub" title={row?.message}>
                {row?.message}
              </span>
            </div>
          </div>
        ),
      },
      {
        field: 'recipient',
        headerName: 'Người Nhận',
        width: 190,
        renderCell: ({ row }) => {
          const user = row?.user;
          if (user) {
            return (
              <div className="notif-user-cell">
                <Avatar
                  src={user.avatar_url}
                  name={user.username || user.full_name}
                  size="sm"
                />
                <div className="notif-user-cell__info">
                  <span className="notif-user-cell__name">
                    {user.full_name || user.username}
                  </span>
                  <span className="notif-user-cell__sub">
                    @{user.username}
                  </span>
                </div>
              </div>
            );
          }
          return (
            <span className="notif-broadcast-tag">
              <Globe size={12} />
              <span>Toàn bộ hệ thống</span>
            </span>
          );
        },
      },
      {
        field: 'type',
        headerName: 'Phân Loại',
        width: 140,
        renderCell: ({ row }) => {
          const type = row?.type || 'system';
          const typeVariantMap = {
            system: 'neutral',
            admin: 'primary',
            movie_new: 'accent',
            movie_update: 'info',
            account_security: 'danger',
            welcome: 'success',
          };
          return (
            <Badge
              variant={typeVariantMap[type] || 'neutral'}
              size="small"
              radius="full"
            >
              {type.toUpperCase()}
            </Badge>
          );
        },
      },
      {
        field: 'priority',
        headerName: 'Mức Ưu Tiên',
        width: 130,
        renderCell: ({ row }) => {
          const priority = row?.priority || 'normal';
          const variantMap = {
            critical: 'danger',
            high: 'warning',
            normal: 'primary',
            low: 'neutral',
          };
          return (
            <Badge
              variant={variantMap[priority] || 'primary'}
              size="small"
              radius="full"
            >
              {priority.toUpperCase()}
            </Badge>
          );
        },
      },
      {
        field: 'is_read',
        headerName: 'Trạng Thái',
        width: 120,
        renderCell: ({ row }) => {
          const isRead = Boolean(row?.is_read);
          return (
            <Badge
              variant={isRead ? 'success' : 'warning'}
              size="small"
              radius="full"
            >
              {isRead ? 'Đã đọc' : 'Chưa đọc'}
            </Badge>
          );
        },
      },
      {
        field: 'created_at',
        headerName: 'Thời Gian Phát',
        width: 165,
        renderCell: ({ row }) => (
          <div className="notif-time-cell">
            <Clock size={13} />
            <span>{row?.created_at ? formatDate(row.created_at, 'HH:mm - DD/MM/YYYY') : '—'}</span>
          </div>
        ),
      },
      {
        field: 'actions',
        headerName: 'Thao Tác',
        width: 100,
        pinned: 'right',
        lockPinned: true,
        renderCell: ({ row }) => (
          <div className="notif-actions-cell">
            <Tooltip content="Xem chi tiết" placement="top">
              <IconButton
                size="small"
                variant="standard"
                onClick={() => setDetailNotification(row)}
                aria-label="Xem chi tiết thông báo"
              >
                <Eye size={15} />
              </IconButton>
            </Tooltip>

            <Tooltip content="Xóa thông báo" placement="top">
              <IconButton
                size="small"
                variant="standard"
                color="danger"
                onClick={() => handleOpenDeleteSingle(row.id)}
                aria-label="Xóa thông báo"
              >
                <Trash2 size={15} />
              </IconButton>
            </Tooltip>
          </div>
        ),
      },
    ],
    [handleOpenDeleteSingle]
  );

  return (
    <div className="admin-page-container notification-admin-page">
      {/* ── 1. Page Header ── */}
      <PageHeader
        title="Quản Lý & Phát Thông Báo Hệ Thống"
        subtitle="Theo dõi lịch sử phát sóng, gửi cảnh báo tức thì và quản trị thông báo toàn hệ thống chuẩn Material 3."
        badge="Live Broadcast"
        badgeVariant="primary"
        actions={
          <div className="notification-admin-page__header-actions">
            <div className="notification-admin-page__pulse-badge">
              <span className="pulse-dot" />
              <span>Realtime Active</span>
            </div>

            <Button
              variant="tonal"
              size="small"
              startIcon={<RefreshCw size={14} className={isFetching ? 'app-header__search-spinner' : ''} />}
              onClick={handleRefreshAll}
              disabled={isFetching}
            >
              Làm Mới
            </Button>

            <Button
              variant="filled"
              size="small"
              startIcon={<Plus size={15} />}
              onClick={() => setIsBroadcastOpen(true)}
            >
              Tạo & Phát Thông Báo
            </Button>
          </div>
        }
      />

      {/* ── 2. Top KPI Stats ── */}
      <NotificationKpiStats
        stats={statsData}
        isLoading={isStatsLoading}
      />

      {/* ── 3. Filter Toolbar ── */}
      <AdminFilterToolbar>
        <Select
          size="small"
          value={filterType}
          onChange={(_e, val) => setFilterType(val)}
          options={TYPE_FILTER_OPTIONS}
          className="notif-filter-select"
        />

        <Select
          size="small"
          value={filterPriority}
          onChange={(_e, val) => setFilterPriority(val)}
          options={PRIORITY_FILTER_OPTIONS}
          className="notif-filter-select"
        />

        <Select
          size="small"
          value={filterReadStatus}
          onChange={(_e, val) => setFilterReadStatus(val)}
          options={STATUS_FILTER_OPTIONS}
          className="notif-filter-select"
        />

        {hasActiveFilters && (
          <Button
            variant="text"
            size="small"
            startIcon={<RotateCcw size={13} />}
            onClick={handleResetFilters}
          >
            Đặt lại bộ lọc
          </Button>
        )}
      </AdminFilterToolbar>

      {/* ── 4. Floating / Inline Bulk Selection Bar ── */}
      {selectedRowIds.length > 0 && (
        <div className="notification-admin-page__bulk-bar">
          <div className="notification-admin-page__bulk-info">
            <span className="notification-admin-page__bulk-count">
              {selectedRowIds.length}
            </span>
            <span>thông báo đang được chọn</span>
          </div>

          <div className="notification-admin-page__bulk-actions">
            <Button
              variant="text"
              size="small"
              onClick={() => setSelectedRowIds([])}
            >
              Bỏ chọn
            </Button>

            <Button
              variant="filled"
              size="small"
              color="danger"
              startIcon={<Trash2 size={14} />}
              onClick={handleOpenBulkDelete}
              loading={bulkDeleteMutation.isPending}
            >
              Xóa các mục đã chọn
            </Button>
          </div>
        </div>
      )}

      {/* ── 5. DataGrid Table ── */}
      <DataGrid
        title="Lịch Sử Thông Báo Hệ Thống"
        columns={columns}
        getRowId={(row) => row.id}
        toolbar
        showQuickFilter
        showColumnSelector
        showFilterButton
        quickFilterPlaceholder="Tìm kiếm tiêu đề hoặc nội dung thông báo..."
        density="standard"
        checkboxSelection
        selection={selectedRowIds}
        onSelectionChange={setSelectedRowIds}
        emptyState={{
          icon: BellOff,
          title: 'Không tìm thấy thông báo nào',
          description: 'Hệ thống chưa có thông báo nào khớp với điều kiện lọc hiện tại.',
        }}
        {...gridProps}
      />

      {/* ── 6. Drawer: Tạo & Phát Thông Báo Mới ── */}
      <BroadcastNotificationDrawer
        open={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
      />

      {/* ── 7. Drawer: Xem Chi Tiết Thông Báo ── */}
      <NotificationDetailDrawer
        open={Boolean(detailNotification)}
        notification={detailNotification}
        onClose={() => setDetailNotification(null)}
        onDelete={(notif) => handleOpenDeleteSingle(notif.id)}
      />

      {/* ── 8. Modal: Xác Nhận Xóa Đơn & Hàng Loạt ── */}
      <ConfirmModal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, singleId: null, isBulk: false })}
        onConfirm={handleConfirmDelete}
        title={deleteConfirm.isBulk ? 'Xóa Hàng Loạt Thông Báo' : 'Xóa Thông Báo Khỏi Hệ Thống'}
        confirmText={deleteConfirm.isBulk ? `Xóa ${selectedRowIds.length} mục` : 'Xác Nhận Xóa'}
        cancelText="Hủy bỏ"
        type="danger"
        variant="tonal"
        loading={deleteSingleMutation.isPending || bulkDeleteMutation.isPending}
      >
        <p className="notification-admin-page__confirm-text">
          {deleteConfirm.isBulk
            ? `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedRowIds.length} thông báo đã chọn? Hành động này sẽ loại bỏ thông báo khỏi hộp thư của tất cả người nhận liên quan.`
            : 'Bạn có chắc chắn muốn xóa thông báo này? Sau khi xóa, người dùng sẽ không còn thấy thông báo này trong hộp thư nữa.'}
        </p>
      </ConfirmModal>
    </div>
  );
};

export default NotificationListPage;
