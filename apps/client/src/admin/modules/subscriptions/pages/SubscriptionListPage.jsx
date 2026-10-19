/**
 * @file SubscriptionListPage.jsx
 * @module Admin/Modules/Subscriptions/Pages/SubscriptionListPage
 * @description Quản lý danh sách các thuê bao VIP, tình trạng gia hạn, thời hạn sử dụng và cấp/thu hồi gói VIP chuẩn Material 3 Expressive & Obsidian Cinema.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Crown,
  Sparkles,
  Gem,
  Zap,
  Clock,
  RotateCcw,
  Plus,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Calendar,
  Info,
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

import subscriptionService from '@/shared/services/subscription.service';
import {
  ADMIN_SUBSCRIPTION_QUERY_KEYS,
  useAdminSubscriptionStatsQuery,
} from '@/hooks/queries/use-subscription.queries';
import { useAdminRevokeSubscriptionMutation } from '@/hooks/mutations/use-subscription.mutations';

import { SubscriptionGrantDrawer, SubscriptionDetailDrawer } from '../components';
import './subscription-list-page.scss';

// ── Status Tabs ──
const STATUS_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang hiệu lực' },
  { id: 'grace_period', label: 'Đang ân hạn' },
  { id: 'pending', label: 'Chờ thanh toán' },
  { id: 'expired', label: 'Đã hết hạn' },
  { id: 'cancelled', label: 'Đã thu hồi' },
];

// ── Tier Filter Options ──
const TIER_OPTIONS = [
  { value: 'all', label: 'Tất cả cấp độ (Tier)' },
  { value: 'free', label: 'Miễn phí (Free)' },
  { value: 'plus', label: 'Gói Plus (Cơ bản)' },
  { value: 'pro', label: 'Gói Pro (Nâng cao)' },
  { value: 'ultra', label: 'Gói Ultra (Cao cấp)' },
];

// ── Cycle Filter Options ──
const CYCLE_OPTIONS = [
  { value: 'all', label: 'Tất cả chu kỳ' },
  { value: 'monthly', label: 'Theo Tháng (Monthly)' },
  { value: 'yearly', label: 'Theo Năm (Yearly)' },
];

// ── Status Badges Config ──
const STATUS_CONFIG = {
  active: { label: 'Đang hiệu lực', variant: 'success' },
  grace_period: { label: 'Đang ân hạn', variant: 'warning' },
  pending: { label: 'Chờ xử lý', variant: 'default' },
  expired: { label: 'Đã hết hạn', variant: 'neutral' },
  cancelled: { label: 'Đã thu hồi', variant: 'error' },
};

/**
 * Format tiền tệ VND
 */
const formatCurrency = (val) => {
  const num = Number(val);
  if (isNaN(num) || num <= 0) return '0 ₫';
  return `${new Intl.NumberFormat('vi-VN').format(num)} ₫`;
};

export const SubscriptionListPage = () => {
  // ── States ──
  const [activeTab, setActiveTab] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [cycleFilter, setCycleFilter] = useState('all');

  // Drawers & Modals
  const [grantDrawerOpen, setGrantDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [revokeModal, setRevokeModal] = useState({
    open: false,
    subscription: null,
    reason: '',
  });

  // ── Params ──
  const queryParams = useMemo(() => {
    const params = {};
    if (activeTab !== 'all') params.status = activeTab;
    if (tierFilter !== 'all') params.tier = tierFilter;
    if (cycleFilter !== 'all') params.billing_cycle = cycleFilter;
    return params;
  }, [activeTab, tierFilter, cycleFilter]);

  // ── DataGrid Query Hook ──
  const {
    counts,
    gridProps,
    refetch,
  } = useDataGridQuery({
    queryKey: ADMIN_SUBSCRIPTION_QUERY_KEYS.list(queryParams),
    queryFn: (params) => subscriptionService.adminGetSubscriptions(params),
    customParams: queryParams,
    defaultSortModel: [{ field: 'created_at', sort: 'desc' }],
    defaultPageSize: 20,
    syncUrlParams: false,
  });

  // ── KPI Stats Query ──
  const { data: statsData } = useAdminSubscriptionStatsQuery();
  const revokeMutation = useAdminRevokeSubscriptionMutation();

  // Handlers
  const handleOpenDetail = useCallback((sub) => {
    setSelectedSub(sub);
    setDetailDrawerOpen(true);
  }, []);

  const handleOpenRevoke = useCallback((sub) => {
    setRevokeModal({
      open: true,
      subscription: sub,
      reason: '',
    });
  }, []);

  const handleConfirmRevoke = async () => {
    if (!revokeModal.subscription) return;
    try {
      await revokeMutation.mutateAsync({
        id: revokeModal.subscription.id,
        reason: revokeModal.reason?.trim() || 'Thu hồi bởi Quản trị viên',
      });
      setRevokeModal({ open: false, subscription: null, reason: '' });
      setDetailDrawerOpen(false);
      refetch();
    } catch (err) {
      // Đã có toast error từ mutation
    }
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success('Đã sao chép mã thuê bao!');
  };

  // ── DataGrid Columns ──
  const columns = useMemo(() => [
    {
      field: 'id',
      headerName: 'Mã Thuê Bao',
      width: 130,
      minWidth: 120,
      renderCell: ({ value }) => {
        const shortId = value ? `${value.slice(0, 8)}...` : 'N/A';
        return (
          <Tooltip content={`Click để chép mã: ${value}`} position="top">
            <span
              className="subscription-admin-page__code-pill"
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
      field: 'user',
      headerName: 'Thành Viên',
      flex: 2,
      minWidth: 230,
      renderCell: ({ row }) => {
        const user = row.user;
        const name = user?.full_name || user?.username || 'N/A';
        const initials = (user?.full_name || user?.username || 'U').slice(0, 2).toUpperCase();

        return (
          <div className="subscription-admin-page__member-cell">
            <div className="member-avatar">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={name}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="fallback">{initials}</span>
              )}
            </div>
            <div className="member-info">
              <span className="member-name">{name}</span>
              <span className="member-sub">
                @{user?.username} • {user?.email}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      field: 'plan',
      headerName: 'Gói VIP',
      width: 150,
      minWidth: 140,
      renderCell: ({ row }) => {
        const tier = (row.plan?.tier || row.tier || 'free').toLowerCase();
        const planName = row.plan?.name || (tier === 'free' ? 'Sạp Miễn phí' : `VIP ${tier.toUpperCase()}`);

        if (tier === 'free') {
          return (
            <span className="subscription-admin-page__plan-badge subscription-admin-page__plan-badge--free">
              <Info size={13} /> {planName}
            </span>
          );
        }

        let badgeClass = 'subscription-admin-page__plan-badge--plus';
        let IconComp = Sparkles;

        if (tier === 'ultra') {
          badgeClass = 'subscription-admin-page__plan-badge--ultra';
          IconComp = Crown;
        } else if (tier === 'pro') {
          badgeClass = 'subscription-admin-page__plan-badge--pro';
          IconComp = Crown;
        }

        return (
          <span className={`subscription-admin-page__plan-badge ${badgeClass}`}>
            <IconComp size={13} /> {planName}
          </span>
        );
      },
    },
    {
      field: 'amount_paid',
      headerName: 'Giá Tiền',
      width: 130,
      minWidth: 110,
      renderCell: ({ row }) => {
        if (row.tier === 'free' || row.payment_method === 'free') {
          return (
            <span className="subscription-admin-page__price-tag subscription-admin-page__price-tag--free">
              Miễn phí
            </span>
          );
        }
        if (row.payment_method === 'admin_grant') {
          return (
            <span className="subscription-admin-page__price-tag subscription-admin-page__price-tag--admin">
              Admin Cấp
            </span>
          );
        }
        const amount = Number(row.amount_paid ?? row.amount);
        return <span>{formatCurrency(amount)}</span>;
      },
    },
    {
      field: 'billing_cycle',
      headerName: 'Chu Kỳ',
      width: 120,
      minWidth: 100,
      renderCell: ({ value }) => (
        <span>{value === 'yearly' ? 'Theo năm' : 'Theo tháng'}</span>
      ),
    },
    {
      field: 'expires_at',
      headerName: 'Thời Hạn Còn Lại',
      width: 160,
      minWidth: 150,
      renderCell: ({ row }) => {
        const tier = (row.plan?.tier || row.tier || 'free').toLowerCase();
        const endDate = new Date(row.expires_at);
        const now = new Date();
        const diffMs = endDate.getTime() - now.getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const isExpired = diffMs <= 0;
        const isPermanent = tier === 'free' || days > 3650;

        if (isPermanent) {
          return (
            <div className="subscription-admin-page__remaining-cell">
              <span className="days-badge days-badge--permanent">
                <CheckCircle2 size={12} /> Không giới hạn
              </span>
              <span className="end-date">Vĩnh viễn</span>
            </div>
          );
        }

        let statusCls = 'days-badge--safe';
        let statusText = `Còn ${days} ngày`;

        if (isExpired) {
          statusCls = 'days-badge--expired';
          statusText = 'Hết hạn';
        } else if (days <= 3) {
          statusCls = 'days-badge--danger';
          statusText = `Sắp hết: ${days} ngày`;
        } else if (days <= 7) {
          statusCls = 'days-badge--warning';
        }

        return (
          <div className="subscription-admin-page__remaining-cell">
            <span className={`days-badge ${statusCls}`}>
              <Clock size={12} /> {statusText}
            </span>
            <span className="end-date">{formatDate(row.expires_at, false)}</span>
          </div>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Trạng Thái',
      width: 140,
      minWidth: 130,
      renderCell: ({ value }) => {
        const cfg = STATUS_CONFIG[value] || { label: value, variant: 'default' };
        return (
          <Badge variant={cfg.variant} size="small">
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      field: 'auto_renew',
      headerName: 'Tự Động Gia Hạn',
      width: 140,
      minWidth: 120,
      renderCell: ({ value }) => (
        <Badge variant={value ? 'success' : 'default'} size="small">
          {value ? 'Bật' : 'Tắt'}
        </Badge>
      ),
    },
    {
      field: '__actions__',
      headerName: 'Thao Tác',
      width: 110,
      minWidth: 100,
      sortable: false,
      filterable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: ({ row }) => {
        const canRevoke = row.status === 'active' || row.status === 'grace_period';

        return (
          <div className="subscription-admin-page__actions-cell">
            <Tooltip content="Xem chi tiết thuê bao" position="top">
              <IconButton
                size="small"
                variant="standard"
                color="default"
                onClick={() => handleOpenDetail(row)}
              >
                <Eye size={16} />
              </IconButton>
            </Tooltip>

            {canRevoke && (
              <Tooltip content="Thu hồi gói VIP" position="top">
                <IconButton
                  size="small"
                  variant="standard"
                  color="danger"
                  onClick={() => handleOpenRevoke(row)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ], [handleOpenDetail, handleOpenRevoke]);

  return (
    <div className="admin-page-container subscription-admin-page">
      {/* ── Page Header ── */}
      <PageHeader
        title="Quản Lý Thuê Bao VIP"
        subtitle="Theo dõi toàn bộ các thuê bao người dùng, tiến trình thời hạn, tình trạng gia hạn và quyền hạn cấp/thu hồi VIP."
        badge={
          statsData?.active_subscriptions !== undefined
            ? `${statsData.active_subscriptions} đang hiệu lực`
            : undefined
        }
        badgeVariant="success"
        actions={
          <Button
            variant="filled"
            color="primary"
            startIcon={<Plus size={16} />}
            onClick={() => setGrantDrawerOpen(true)}
          >
            Cấp Gói VIP
          </Button>
        }
      />

      {/* ── KPI Stats Cards ── */}
      <div className="subscription-admin-page__stats-grid">
        <div className="subscription-admin-page__stat-card">
          <div className="subscription-admin-page__stat-card-icon subscription-admin-page__stat-card-icon--total">
            <Crown size={24} />
          </div>
          <div className="subscription-admin-page__stat-card-content">
            <span className="stat-label">Tổng Lượt Đăng Ký</span>
            <span className="stat-value">
              {Number(statsData?.total_subscriptions || counts?.all || 0).toLocaleString()}
            </span>
            <span className="stat-sub">Toàn thời gian</span>
          </div>
        </div>

        <div className="subscription-admin-page__stat-card">
          <div className="subscription-admin-page__stat-card-icon subscription-admin-page__stat-card-icon--active">
            <Zap size={24} />
          </div>
          <div className="subscription-admin-page__stat-card-content">
            <span className="stat-label">Đang Hiệu Lực</span>
            <span className="stat-value">
              {Number(statsData?.active_subscriptions || counts?.active || 0).toLocaleString()}
            </span>
            <span className="stat-sub">Hội viên VIP hoạt động</span>
          </div>
        </div>

        <div className="subscription-admin-page__stat-card">
          <div className="subscription-admin-page__stat-card-icon subscription-admin-page__stat-card-icon--grace">
            <Clock size={24} />
          </div>
          <div className="subscription-admin-page__stat-card-content">
            <span className="stat-label">Đang Ân Hạn</span>
            <span className="stat-value">
              {Number(statsData?.grace_subscriptions || counts?.grace_period || 0).toLocaleString()}
            </span>
            <span className="stat-sub">Chờ gia hạn 3 ngày</span>
          </div>
        </div>

        <div className="subscription-admin-page__stat-card">
          <div className="subscription-admin-page__stat-card-icon subscription-admin-page__stat-card-icon--expired">
            <RotateCcw size={24} />
          </div>
          <div className="subscription-admin-page__stat-card-content">
            <span className="stat-label">Đã Hết Hạn / Hủy</span>
            <span className="stat-value">
              {Number(
                (statsData?.expired_subscriptions || 0) + (statsData?.cancelled_subscriptions || 0) ||
                (counts?.expired || 0) + (counts?.cancelled || 0) ||
                0
              ).toLocaleString()}
            </span>
            <span className="stat-sub">Không còn hiệu lực</span>
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <AdminFilterToolbar
        tabs={STATUS_TABS}
        activeTab={activeTab}
        counts={counts || {}}
        onTabChange={(t) => setActiveTab(t)}
      >
        <Select
          size="small"
          value={tierFilter}
          onChange={(_e, v) => setTierFilter(v)}
          options={TIER_OPTIONS}
          placeholder="Tất cả cấp độ"
          className="subscription-admin-page__filter-select"
        />

        <Select
          size="small"
          value={cycleFilter}
          onChange={(_e, v) => setCycleFilter(v)}
          options={CYCLE_OPTIONS}
          placeholder="Tất cả chu kỳ"
          className="subscription-admin-page__filter-select"
        />
      </AdminFilterToolbar>

      {/* ── DataGrid Table ── */}
      <DataGrid
        title="Danh Sách Thuê Bao VIP Hệ Thống"
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

      {/* ── Drawer: Cấp Gói VIP Thủ Công ── */}
      <SubscriptionGrantDrawer
        open={grantDrawerOpen}
        onClose={() => setGrantDrawerOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* ── Drawer: Chi Tiết Thuê Bao ── */}
      <SubscriptionDetailDrawer
        open={detailDrawerOpen}
        subscription={selectedSub}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedSub(null);
        }}
        onRevoke={(sub) => handleOpenRevoke(sub)}
      />

      {/* ── Modal Xác Nhận Thu Hồi VIP ── */}
      <ConfirmModal
        open={revokeModal.open}
        onClose={() => setRevokeModal({ open: false, subscription: null, reason: '' })}
        onConfirm={handleConfirmRevoke}
        title="Xác Nhận Thu Hồi Gói VIP"
        content={
          revokeModal.subscription
            ? `Bạn có chắc chắn muốn thu hồi gói VIP của "${revokeModal.subscription.user?.full_name || revokeModal.subscription.user?.username
            }" (@${revokeModal.subscription.user?.username})? Người dùng sẽ bị hạ quyền và không thể truy cập các đặc quyền VIP nữa.`
            : ''
        }
        type="danger"
        confirmText="Thu Hồi Gói"
      />
    </div>
  );
};

export default SubscriptionListPage;
