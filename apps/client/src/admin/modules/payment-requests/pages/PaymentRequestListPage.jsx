/**
 * @file PaymentRequestListPage.jsx
 * @module Admin/Modules/PaymentRequests/Pages/PaymentRequestListPage
 * @description Quản lý hàng đợi phê duyệt nạp / rút tiền S-Coin, đối soát chuyển khoản ngân hàng chuẩn Material 3 Expressive & Obsidian Cinema.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Eye,
  RotateCcw,
  Search,
  SlidersHorizontal,
  XCircle,
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
import TextField from '@/shared/components/ui/text-field';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';

import paymentRequestService from '@/shared/services/payment-request.service';
import {
  ADMIN_PAYMENT_REQUEST_QUERY_KEYS,
  useAdminPaymentRequestStatsQuery,
} from '@/hooks/queries/use-payment-request.queries';
import { useAdminProcessPaymentRequestMutation } from '@/hooks/mutations/use-payment-request.mutations';

import { PaymentRequestDetailDrawer } from '../components';
import './payment-request-list-page.scss';

// ── Tỷ giá 1 S-Coin = 1,000 VND ──
const LCOIN_VND_RATE = 1000;

// ── Tabs Trạng Thái Yêu Cầu ──
const STATUS_TABS = [
  { id: 'pending', label: 'Chờ đối soát' },
  { id: 'approved', label: 'Đã phê duyệt' },
  { id: 'rejected', label: 'Đã từ chối' },
  { id: 'expired', label: 'Đã hết hạn' },
  { id: 'all', label: 'Tất cả lệnh' },
];

// ── Bộ Lọc Loại Yêu Cầu ──
const TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả loại giao dịch' },
  { value: 'topup', label: 'Nạp S-Coin (Topup)' },
  { value: 'withdrawal', label: 'Rút tiền (Withdrawal)' },
];

/**
 * Format tiền tệ VND
 * @param {number|string} vnd 
 * @returns {string}
 */
const formatVnd = (vnd) => {
  const num = Number(vnd) || 0;
  return `${new Intl.NumberFormat('vi-VN').format(num)} ₫`;
};

/**
 * Format số xu S-Coin
 * @param {number|string} coins 
 * @returns {string}
 */
const formatCoin = (coins) => {
  const num = Number(coins) || 0;
  return new Intl.NumberFormat('vi-VN').format(num);
};

export const PaymentRequestListPage = () => {
  // ── States ──
  const [activeStatusTab, setActiveStatusTab] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');

  // Detail Drawer State
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Modal Approve / Reject States
  const [approveModal, setApproveModal] = useState({ open: false, request: null });
  const [rejectModal, setRejectModal] = useState({ open: false, request: null, reason: '' });

  // ── Queries & Mutations ──
  const {
    data: statsData,
    refetch: refetchStats,
    isFetching: statsFetching,
  } = useAdminPaymentRequestStatsQuery();

  const processMutation = useAdminProcessPaymentRequestMutation();

  // Query Params cho DataGrid
  const queryParams = useMemo(() => {
    const params = {};
    if (activeStatusTab !== 'all') {
      params.status = activeStatusTab;
    }
    if (typeFilter !== 'all') {
      params.type = typeFilter;
    }
    return params;
  }, [activeStatusTab, typeFilter]);

  // DataGrid Query Hook
  const {
    counts,
    gridProps,
    refetch: refetchRequests,
  } = useDataGridQuery({
    queryKey: ADMIN_PAYMENT_REQUEST_QUERY_KEYS.list(queryParams),
    queryFn: (params) => paymentRequestService.adminGetPaymentRequests(params),
    customParams: queryParams,
    defaultSortModel: [{ field: 'created_at', sort: 'desc' }],
    defaultPageSize: 20,
    syncUrlParams: true,
  });

  // ── Handlers ──
  const handleOpenDetail = useCallback((request) => {
    setSelectedRequest(request);
    setDetailDrawerOpen(true);
  }, []);

  const handleOpenApprove = useCallback((request) => {
    setApproveModal({ open: true, request });
  }, []);

  const handleOpenReject = useCallback((request) => {
    setRejectModal({ open: true, request, reason: '' });
  }, []);

  const handleConfirmApprove = async () => {
    if (!approveModal.request) return;

    try {
      await processMutation.mutateAsync({
        id: approveModal.request.id,
        status: 'approved',
      });
      setApproveModal({ open: false, request: null });
      setDetailDrawerOpen(false);
      refetchRequests();
      refetchStats();
    } catch (err) {
      // toast error đã được hiển thị qua mutation hook
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModal.request) return;

    if (!rejectModal.reason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối yêu cầu thanh toán');
      return;
    }

    try {
      await processMutation.mutateAsync({
        id: rejectModal.request.id,
        status: 'rejected',
        rejection_reason: rejectModal.reason.trim(),
      });
      setRejectModal({ open: false, request: null, reason: '' });
      setDetailDrawerOpen(false);
      refetchRequests();
      refetchStats();
    } catch (err) {
      // toast error đã được hiển thị qua mutation hook
    }
  };

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  };

  const handleRefreshAll = () => {
    refetchStats();
    refetchRequests();
    toast.success('Đã làm mới dữ liệu hàng đợi thanh toán!');
  };

  // ── Columns Cấu hình DataGrid ──
  const columns = useMemo(() => [
    {
      field: 'transaction_code',
      headerName: 'Mã Giao Dịch',
      width: 150,
      minWidth: 140,
      renderCell: ({ value, row }) => {
        const code = value || row.id;
        return (
          <Tooltip content={`Click để sao chép: ${code}`} position="top">
            <span
              className="payment-request-page__code-pill"
              onClick={() => handleCopy(code, 'Mã giao dịch')}
            >
              {code}
            </span>
          </Tooltip>
        );
      },
    },
    {
      field: 'user',
      headerName: 'Người Dùng',
      flex: 2,
      minWidth: 220,
      renderCell: ({ row }) => {
        const user = row.user;
        const name = user?.full_name || user?.username || 'Ẩn danh';
        const initials = name.slice(0, 2).toUpperCase();

        return (
          <div className="payment-request-page__user-cell">
            <div className="payment-request-page__user-avatar-wrap">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={name}
                  className="payment-request-page__user-avatar"
                />
              ) : (
                <div className="payment-request-page__user-avatar-fallback">
                  {initials}
                </div>
              )}
            </div>
            <div className="payment-request-page__user-meta">
              <span className="user-name" title={name}>{name}</span>
              <span className="user-email" title={user?.email || 'N/A'}>
                {user?.email || 'Chưa có email'}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      field: 'type',
      headerName: 'Loại Lệnh',
      width: 140,
      minWidth: 130,
      renderCell: ({ value }) => {
        const isTopup = value === 'topup';
        return (
          <span className={`payment-type-badge payment-type-badge--${value}`}>
            {isTopup ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
            {isTopup ? 'Nạp S-Coin' : 'Rút tiền'}
          </span>
        );
      },
    },
    {
      field: 'amount',
      headerName: 'Số Tiền (VND)',
      width: 150,
      minWidth: 140,
      renderCell: ({ value, row }) => {
        const isTopup = row.type === 'topup';
        return (
          <span className={`payment-amount payment-amount--${isTopup ? 'positive' : 'negative'}`}>
            {isTopup ? '+' : '-'}{formatVnd(value)}
          </span>
        );
      },
    },
    {
      field: 'lcoin_amount',
      headerName: 'Quy Đổi (S-Coin)',
      width: 150,
      minWidth: 140,
      renderCell: ({ value, row }) => {
        const coins = value || Math.floor(Number(row.amount || 0) / LCOIN_VND_RATE);
        return (
          <span className="payment-coin-amount">
            <span className="coin-dot" />
            {formatCoin(coins)} S-Coin
          </span>
        );
      },
    },
    {
      field: 'bank_info',
      headerName: 'Ngân Hàng / STK',
      flex: 2,
      minWidth: 200,
      renderCell: ({ row }) => {
        return (
          <div className="payment-bank-cell">
            <span className="bank-name">{row.bank_name || row.bank_id || 'Ngân hàng'}</span>
            <div className="bank-account-row">
              <code className="bank-account">{row.account_number || 'N/A'}</code>
              {row.account_number && (
                <Tooltip content="Sao chép STK" position="top">
                  <button
                    type="button"
                    className="copy-btn-mini"
                    onClick={() => handleCopy(row.account_number, 'Số tài khoản')}
                    aria-label="Sao chép STK"
                  >
                    <Copy size={12} />
                  </button>
                </Tooltip>
              )}
            </div>
            {row.account_holder && (
              <span className="account-holder">{row.account_holder}</span>
            )}
          </div>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Trạng Thái',
      width: 130,
      minWidth: 120,
      renderCell: ({ value }) => {
        const statusMap = {
          approved: { label: 'Đã duyệt', variant: 'success' },
          pending: { label: 'Chờ duyệt', variant: 'warning' },
          created: { label: 'Chờ duyệt', variant: 'warning' },
          rejected: { label: 'Từ chối', variant: 'error' },
          cancelled: { label: 'Đã hủy', variant: 'neutral' },
          expired: { label: 'Hết hạn', variant: 'neutral' },
        };
        const cfg = statusMap[value] || { label: value, variant: 'default' };
        return (
          <Badge variant={cfg.variant} size="small">
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      field: 'created_at',
      headerName: 'Thời Gian',
      width: 150,
      minWidth: 140,
      renderCell: ({ value }) => <span>{formatDate(value, true)}</span>,
    },
    {
      field: 'actions',
      headerName: 'Thao Tác',
      width: 140,
      minWidth: 130,
      headerAlign: 'right',
      align: 'right',
      renderCell: ({ row }) => {
        const isPending = row.status === 'pending' || row.status === 'created';

        return (
          <div className="payment-request-page__actions-cell">
            <Tooltip content="Xem chi tiết & đối soát" position="top">
              <IconButton
                size="small"
                variant="standard"
                onClick={() => handleOpenDetail(row)}
                aria-label="Xem chi tiết"
              >
                <Eye size={16} />
              </IconButton>
            </Tooltip>

            {isPending && (
              <>
                <Tooltip content="Phê duyệt nhanh" position="top">
                  <IconButton
                    size="small"
                    variant="standard"
                    color="success"
                    onClick={() => handleOpenApprove(row)}
                    aria-label="Phê duyệt"
                  >
                    <CheckCircle2 size={16} />
                  </IconButton>
                </Tooltip>

                <Tooltip content="Từ chối yêu cầu" position="top">
                  <IconButton
                    size="small"
                    variant="standard"
                    color="error"
                    onClick={() => handleOpenReject(row)}
                    aria-label="Từ chối"
                  >
                    <XCircle size={16} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </div>
        );
      },
    },
  ], [handleOpenDetail, handleOpenApprove, handleOpenReject]);

  return (
    <div className="admin-page-container payment-request-page">
      {/* ── Page Header ── */}
      <PageHeader
        title="Hàng Đợi Phê Duyệt Thanh Toán"
        subtitle="Đối soát các lệnh chuyển khoản ngân hàng nạp S-Coin và xử lý yêu cầu rút tiền của hội viên toàn hệ thống."
        badge={
          statsData?.pending_count !== undefined
            ? `${statsData.pending_count} lệnh chờ xử lý`
            : undefined
        }
        badgeVariant={Number(statsData?.pending_count || 0) > 0 ? 'warning' : 'purple'}
        actions={
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<RotateCcw size={14} className={statsFetching ? 'icon-spin' : ''} />}
            onClick={handleRefreshAll}
          >
            Làm mới
          </Button>
        }
      />

      {/* ── 4 KPI Stats Cards ── */}
      <div className="payment-request-page__stats-grid">
        {/* Card 1: Lệnh đang chờ duyệt */}
        <div className="payment-request-page__stat-card">
          <div className="payment-request-page__stat-card-icon payment-request-page__stat-card-icon--pending">
            <Clock size={24} />
          </div>
          <div className="payment-request-page__stat-card-content">
            <span className="stat-label">Lệnh Đang Chờ Duyệt</span>
            <span className="stat-value">
              {Number(statsData?.pending_count || counts?.pending || 0).toLocaleString()} lệnh
            </span>
            <span className="stat-sub">Cần admin đối soát</span>
          </div>
        </div>

        {/* Card 2: Tiền nạp chờ đối soát */}
        <div className="payment-request-page__stat-card">
          <div className="payment-request-page__stat-card-icon payment-request-page__stat-card-icon--topup">
            <ArrowDownRight size={24} />
          </div>
          <div className="payment-request-page__stat-card-content">
            <span className="stat-label">Tiền Nạp Chờ Đối Soát</span>
            <span className="stat-value text-success">
              {formatVnd(statsData?.pending_topup_amount)}
            </span>
            <span className="stat-sub">Đang chờ cộng ví S-Coin</span>
          </div>
        </div>

        {/* Card 3: Tiền rút chờ chuyển khoản */}
        <div className="payment-request-page__stat-card">
          <div className="payment-request-page__stat-card-icon payment-request-page__stat-card-icon--withdrawal">
            <ArrowUpRight size={24} />
          </div>
          <div className="payment-request-page__stat-card-content">
            <span className="stat-label">Tiền Rút Chờ Chuyển</span>
            <span className="stat-value text-error">
              {formatVnd(statsData?.pending_withdrawal_amount)}
            </span>
            <span className="stat-sub">Cần chuyển khoản ngân hàng</span>
          </div>
        </div>

        {/* Card 4: Doanh số đã duyệt hôm nay */}
        <div className="payment-request-page__stat-card">
          <div className="payment-request-page__stat-card-icon payment-request-page__stat-card-icon--today">
            <CheckCircle2 size={24} />
          </div>
          <div className="payment-request-page__stat-card-content">
            <span className="stat-label">Doanh Số Đã Duyệt Hôm Nay</span>
            <span className="stat-value text-brand">
              {formatVnd(statsData?.today_approved_amount)}
            </span>
            <span className="stat-sub">Khởi tạo từ 00:00 hôm nay</span>
          </div>
        </div>
      </div>

      {/* ── Status Tabs & Filter Toolbar ── */}
      <AdminFilterToolbar
        tabs={STATUS_TABS}
        activeTab={activeStatusTab}
        counts={counts || {}}
        onTabChange={(tab) => setActiveStatusTab(tab)}
      >
        <Select
          className="payment-request-page__filter-select"
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={(val) => setTypeFilter(val)}
          size="small"
        />
      </AdminFilterToolbar>

      {/* ── DataGrid ── */}
      <DataGrid
        columns={columns}
        {...gridProps}
        emptyMessage="Không tìm thấy yêu cầu thanh toán nào trong hàng đợi"
      />

      {/* ── Drawer Xem Chi Tiết ── */}
      <PaymentRequestDetailDrawer
        open={detailDrawerOpen}
        request={selectedRequest}
        onClose={() => setDetailDrawerOpen(false)}
        onApprove={handleOpenApprove}
        onReject={handleOpenReject}
        isProcessing={processMutation.isPending}
      />

      {/* ── Modal Xác Nhận Phê Duyệt ── */}
      <ConfirmModal
        open={approveModal.open}
        onClose={() => setApproveModal({ open: false, request: null })}
        onConfirm={handleConfirmApprove}
        loading={processMutation.isPending}
        title="Xác Nhận Phê Duyệt Lệnh Thanh Toán"
        confirmText="Xác Nhận Duyệt"
        confirmVariant="filled"
        type="success"
        content={
          approveModal.request && (
            <div className="payment-confirm-modal-body">
              <p className="confirm-desc">
                Bạn có chắc chắn muốn phê duyệt lệnh{' '}
                <strong>{approveModal.request.transaction_code || approveModal.request.id}</strong>?
              </p>
              <div className="confirm-summary-box">
                <div className="summary-row">
                  <span className="label">Loại giao dịch:</span>
                  <span className="value">
                    {approveModal.request.type === 'topup' ? 'Nạp tiền vào ví' : 'Rút tiền về ngân hàng'}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="label">Người nhận/nạp:</span>
                  <span className="value font-semibold">
                    {approveModal.request.user?.full_name || approveModal.request.user?.username || 'Thành viên'}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="label">Số tiền thực tế:</span>
                  <span className="value text-success font-bold">
                    {formatVnd(approveModal.request.amount)}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="label">Quy đổi S-Coin:</span>
                  <span className="value text-gold font-bold">
                    {formatCoin(approveModal.request.lcoin_amount || Math.floor(Number(approveModal.request.amount || 0) / LCOIN_VND_RATE))} S-Coin
                  </span>
                </div>
              </div>
              <p className="confirm-note">
                Hệ thống sẽ ngay lập tức cộng số dư ví S-Coin hoặc hoàn tất giao dịch rút tiền cho thành viên.
              </p>
            </div>
          )
        }
      />

      {/* ── Modal Xác Nhận Từ Chối ── */}
      <ConfirmModal
        open={rejectModal.open}
        onClose={() => setRejectModal({ open: false, request: null, reason: '' })}
        onConfirm={handleConfirmReject}
        loading={processMutation.isPending}
        title="Từ Chối Yêu Cầu Thanh Toán"
        confirmText="Xác Nhận Từ Chối"
        confirmVariant="filled"
        type="danger"
        content={
          rejectModal.request && (
            <div className="payment-confirm-modal-body">
              <p className="confirm-desc">
                Bạn đang thực hiện từ chối lệnh thanh toán{' '}
                <strong>{rejectModal.request.transaction_code || rejectModal.request.id}</strong>.
              </p>

              <div className="reject-reason-input-group">
                <TextField
                  label="Lý do từ chối (Bắt buộc)"
                  placeholder="VD: Sai thông tin số tài khoản / Chưa nhận được tiền chuyển khoản..."
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                  multiline
                  rows={3}
                  fullWidth
                  required
                />
              </div>

              <p className="confirm-note text-warning">
                Lưu ý: Nếu đây là lệnh rút tiền, hệ thống sẽ tự động hoàn trả số dư S-Coin bị tạm giữ về lại ví của thành viên.
              </p>
            </div>
          )
        }
      />
    </div>
  );
};

export default PaymentRequestListPage;
