/**
 * @file AdminWalletPage.jsx
 * @module Admin/Modules/Wallet/Pages/AdminWalletPage
 * @description Quản lý ví hệ thống, số dư thành viên, biến động dòng tiền tài chính và kiểm soát tài khoản ví chuẩn Material 3 Expressive & Obsidian Cinema.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Wallet,
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  Gift,
  Lock,
  Unlock,
  Eye,
  SlidersHorizontal,
  History,
  Copy,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
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

import walletService from '@/shared/services/wallet.service';
import {
  ADMIN_WALLET_QUERY_KEYS,
  useAdminWalletStatsQuery,
} from '@/hooks/queries/use-wallet.queries';
import {
  useAdminLockWalletMutation,
  useAdminUnlockWalletMutation,
} from '@/hooks/mutations/use-wallet.mutations';

import { WalletAdjustDrawer, WalletDetailDrawer } from '../components';
import './admin-wallet-page.scss';

// ── Tỷ giá 1 S-Coin = 1,000 VND ──
const LCOIN_VND_RATE = 1000;

// ── Tabs Trạng thái Ví ──
const WALLET_STATUS_TABS = [
  { id: 'all', label: 'Tất cả ví' },
  { id: 'active', label: 'Đang hoạt động' },
  { id: 'locked', label: 'Bị khóa' },
];

// ── Bộ lọc Loại Giao Dịch (Tab Dòng Tiền) ──
const TX_TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả loại giao dịch' },
  { value: 'deposit', label: 'Nạp tiền (Deposit)' },
  { value: 'purchase', label: 'Mua VIP / Phim (Purchase)' },
  { value: 'bonus', label: 'Tặng thưởng (Bonus)' },
  { value: 'admin_credit', label: 'Admin nạp bù (Credit)' },
  { value: 'admin_debit', label: 'Admin khấu trừ (Debit)' },
  { value: 'refund', label: 'Hoàn tiền (Refund)' },
  { value: 'withdrawal_complete', label: 'Rút tiền (Withdrawal)' },
];

// ── Bộ lọc Trạng thái Giao Dịch ──
const TX_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'completed', label: 'Hoàn tất (Completed)' },
  { value: 'pending', label: 'Đang chờ (Pending)' },
  { value: 'failed', label: 'Thất bại (Failed)' },
  { value: 'cancelled', label: 'Đã hủy (Cancelled)' },
];

// ── Cấu hình nhãn và badge loại giao dịch ──
const TRANSACTION_TYPE_CONFIG = {
  deposit: { label: 'Nạp tiền', variant: 'success', sign: '+' },
  purchase: { label: 'Mua VIP / Phim', variant: 'warning', sign: '-' },
  refund: { label: 'Hoàn tiền', variant: 'info', sign: '+' },
  bonus: { label: 'Tặng thưởng', variant: 'purple', sign: '+' },
  admin_credit: { label: 'Admin nạp', variant: 'success', sign: '+' },
  admin_debit: { label: 'Admin trừ', variant: 'error', sign: '-' },
  withdrawal_hold: { label: 'Tạm giữ rút', variant: 'warning', sign: '-' },
  withdrawal_complete: { label: 'Rút tiền', variant: 'error', sign: '-' },
  withdrawal_refund: { label: 'Hoàn tạm giữ', variant: 'info', sign: '+' },
};

/**
 * Format tiền tệ VND
 */
const formatVnd = (vnd) => {
  const num = Number(vnd) || 0;
  return `${new Intl.NumberFormat('vi-VN').format(num)} ₫`;
};

/**
 * Format số xu S-Coin
 */
const formatCoin = (coins) => {
  const num = Number(coins) || 0;
  return new Intl.NumberFormat('vi-VN').format(num);
};

export const AdminWalletPage = () => {
  // ── Tab Chính: 'wallets' (Danh sách ví) | 'transactions' (Dòng tiền toàn hệ thống) ──
  const [activeMainTab, setActiveMainTab] = useState('wallets');

  // ── Bộ lọc cho Tab 1 (Ví thành viên) ──
  const [walletStatusTab, setWalletStatusTab] = useState('all');

  // ── Bộ lọc cho Tab 2 (Dòng tiền giao dịch) ──
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [txStatusFilter, setTxStatusFilter] = useState('all');

  // ── Drawers & Modals ──
  const [adjustDrawerOpen, setAdjustDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);

  // Modal Khóa / Mở khóa
  const [lockModal, setLockModal] = useState({
    open: false,
    wallet: null,
    isLocking: true, // true = Khóa, false = Mở khóa
    reason: '',
  });

  // ── KPI Stats Query ──
  const { data: statsData, refetch: refetchStats } = useAdminWalletStatsQuery();

  // ── Mutation Hooks ──
  const lockMutation = useAdminLockWalletMutation();
  const unlockMutation = useAdminUnlockWalletMutation();

  // ── Query Params cho Tab 1 (Ví thành viên) ──
  const walletQueryParams = useMemo(() => {
    const params = {};
    if (walletStatusTab === 'active') params.is_locked = 'false';
    if (walletStatusTab === 'locked') params.is_locked = 'true';
    return params;
  }, [walletStatusTab]);

  // DataGrid Hook cho Tab 1
  const {
    counts: walletCounts,
    gridProps: walletGridProps,
    refetch: refetchWallets,
  } = useDataGridQuery({
    queryKey: ADMIN_WALLET_QUERY_KEYS.list(walletQueryParams),
    queryFn: (params) => walletService.adminGetWallets(params),
    customParams: walletQueryParams,
    defaultSortModel: [{ field: 'balance', sort: 'desc' }],
    defaultPageSize: 20,
    syncUrlParams: false,
  });

  // ── Query Params cho Tab 2 (Dòng tiền giao dịch) ──
  const txQueryParams = useMemo(() => {
    const params = {};
    if (txTypeFilter !== 'all') params.type = txTypeFilter;
    if (txStatusFilter !== 'all') params.status = txStatusFilter;
    return params;
  }, [txTypeFilter, txStatusFilter]);

  // DataGrid Hook cho Tab 2
  const {
    counts: txCounts,
    gridProps: txGridProps,
    refetch: refetchTxs,
  } = useDataGridQuery({
    queryKey: ADMIN_WALLET_QUERY_KEYS.transactions(txQueryParams),
    queryFn: (params) => walletService.adminGetTransactions(params),
    customParams: txQueryParams,
    defaultSortModel: [{ field: 'created_at', sort: 'desc' }],
    defaultPageSize: 20,
    syncUrlParams: false,
  });

  // ── Handlers ──
  const handleOpenDetail = useCallback((wallet) => {
    setSelectedWallet(wallet);
    setDetailDrawerOpen(true);
  }, []);

  const handleOpenAdjust = useCallback((wallet) => {
    setSelectedWallet(wallet);
    setAdjustDrawerOpen(true);
  }, []);

  const handleOpenLockToggle = useCallback((wallet) => {
    setLockModal({
      open: true,
      wallet,
      isLocking: !wallet.is_locked,
      reason: '',
    });
  }, []);

  const handleConfirmLockToggle = async () => {
    if (!lockModal.wallet) return;

    try {
      const targetUserId = lockModal.wallet.user_id || lockModal.wallet.user?.id;
      if (lockModal.isLocking) {
        if (!lockModal.reason.trim()) {
          toast.error('Vui lòng nhập lý do khóa ví');
          return;
        }
        await lockMutation.mutateAsync({
          userId: targetUserId,
          reason: lockModal.reason.trim(),
        });
      } else {
        await unlockMutation.mutateAsync({
          userId: targetUserId,
        });
      }

      setLockModal({ open: false, wallet: null, isLocking: true, reason: '' });
      setDetailDrawerOpen(false);
      refetchWallets();
      refetchStats();
    } catch (err) {
      // toast error đã được hiển thị qua mutation hooks
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã chép ${label}!`);
  };

  // ── Columns Tab 1: Danh Sách Ví Người Dùng ──
  const walletColumns = useMemo(() => [
    {
      field: 'user',
      headerName: 'Thành Viên',
      flex: 2,
      minWidth: 240,
      renderCell: ({ row }) => {
        const user = row.user;
        const name = user?.full_name || user?.username || 'Thành viên';
        const initials = name.slice(0, 2).toUpperCase();

        return (
          <div className="wallet-admin-page__member-cell">
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
      field: 'balance',
      headerName: 'Số Dư Khả Dụng',
      width: 170,
      minWidth: 150,
      renderCell: ({ row }) => {
        const bal = Number(row.balance || 0);
        return (
          <div className="wallet-admin-page__balance-cell">
            <span className="coin-val">
              <Coins size={14} /> {formatCoin(bal)}
            </span>
            <span className="vnd-val">≈ {formatVnd(bal * LCOIN_VND_RATE)}</span>
          </div>
        );
      },
    },
    {
      field: 'hold_balance',
      headerName: 'Tạm Giữ (Hold)',
      width: 140,
      minWidth: 130,
      renderCell: ({ row }) => {
        const hold = Number(row.hold_balance || 0);
        return (
          <div className="wallet-admin-page__hold-cell">
            <span className="hold-val">{formatCoin(hold)} S-Coin</span>
          </div>
        );
      },
    },
    {
      field: 'total_deposited',
      headerName: 'Tổng Nạp',
      width: 150,
      minWidth: 130,
      renderCell: ({ row }) => {
        const dep = Number(row.total_deposited || 0);
        return <span>+{formatCoin(dep)} S-Coin</span>;
      },
    },
    {
      field: 'total_spent',
      headerName: 'Tổng Chi',
      width: 150,
      minWidth: 130,
      renderCell: ({ row }) => {
        const sp = Number(row.total_spent || 0);
        return <span>-{formatCoin(sp)} S-Coin</span>;
      },
    },
    {
      field: 'is_locked',
      headerName: 'Trạng Thái',
      width: 150,
      minWidth: 130,
      renderCell: ({ row }) => {
        if (row.is_locked) {
          return (
            <Tooltip content={row.locked_reason || 'Ví đang bị khóa'} position="top">
              <span style={{ display: 'inline-block' }}>
                <Badge variant="error" size="small">
                  Bị khóa
                </Badge>
              </span>
            </Tooltip>
          );
        }
        return (
          <Badge variant="success" size="small">
            Hoạt động
          </Badge>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Thao Tác',
      width: 160,
      minWidth: 140,
      sortable: false,
      renderCell: ({ row }) => {
        return (
          <div className="wallet-admin-page__actions-cell">
            <Tooltip content="Xem chi tiết & lịch sử ví" position="top">
              <IconButton
                size="small"
                variant="standard"
                onClick={() => handleOpenDetail(row)}
              >
                <Eye size={16} />
              </IconButton>
            </Tooltip>

            <Tooltip content="Điều chỉnh số dư S-Coin" position="top">
              <IconButton
                size="small"
                variant="standard"
                onClick={() => handleOpenAdjust(row)}
              >
                <SlidersHorizontal size={16} />
              </IconButton>
            </Tooltip>

            <Tooltip content={row.is_locked ? 'Mở khóa ví' : 'Khóa ví'} position="top">
              <IconButton
                size="small"
                variant="standard"
                color={row.is_locked ? 'success' : 'error'}
                onClick={() => handleOpenLockToggle(row)}
              >
                {row.is_locked ? <Unlock size={16} /> : <Lock size={16} />}
              </IconButton>
            </Tooltip>
          </div>
        );
      },
    },
  ], [handleOpenDetail, handleOpenAdjust, handleOpenLockToggle]);

  // ── Columns Tab 2: Dòng Tiền Giao Dịch Toàn Hệ Thống ──
  const txColumns = useMemo(() => [
    {
      field: 'id',
      headerName: 'Mã Giao Dịch',
      width: 130,
      minWidth: 120,
      renderCell: ({ value }) => {
        const shortId = value ? `${value.slice(0, 8)}...` : 'N/A';
        return (
          <Tooltip content={`Click để chép mã: ${value}`} position="top">
            <span
              className="wallet-admin-page__code-pill"
              onClick={() => handleCopy(value, 'Mã GD')}
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
      headerName: 'Người Dùng',
      flex: 2,
      minWidth: 200,
      renderCell: ({ row }) => {
        const user = row.user;
        const name = user?.full_name || user?.username || 'N/A';
        const initials = name.slice(0, 2).toUpperCase();

        return (
          <div className="wallet-admin-page__member-cell">
            <div className="member-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={name} />
              ) : (
                <span className="fallback">{initials}</span>
              )}
            </div>
            <div className="member-info">
              <span className="member-name">{name}</span>
              <span className="member-sub">@{user?.username}</span>
            </div>
          </div>
        );
      },
    },
    {
      field: 'type',
      headerName: 'Loại GD',
      width: 150,
      minWidth: 130,
      renderCell: ({ value }) => {
        const cfg = TRANSACTION_TYPE_CONFIG[value] || {
          label: value,
          variant: 'default',
        };
        return (
          <Badge variant={cfg.variant} size="small">
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      field: 'amount',
      headerName: 'Biến Động Xu',
      width: 160,
      minWidth: 140,
      renderCell: ({ row }) => {
        const cfg = TRANSACTION_TYPE_CONFIG[row.type] || { sign: '' };
        const isCredit = cfg.sign === '+';
        const num = Number(row.amount || 0);

        return (
          <div className="wallet-admin-page__amount-badge">
            <span
              className={`amount-val ${
                isCredit ? 'amount-val--credit' : 'amount-val--debit'
              }`}
            >
              {cfg.sign}{formatCoin(num)} S-Coin
            </span>
            <span className="amount-vnd">≈ {formatVnd(num * LCOIN_VND_RATE)}</span>
          </div>
        );
      },
    },
    {
      field: 'balance_snapshot',
      headerName: 'Trước ➔ Sau',
      width: 170,
      minWidth: 150,
      renderCell: ({ row }) => (
        <span className="wallet-admin-page__balance-snapshot">
          {formatCoin(row.balance_before)} <span className="arrow">➔</span> {formatCoin(row.balance_after)}
        </span>
      ),
    },
    {
      field: 'status',
      headerName: 'Trạng Thái',
      width: 130,
      minWidth: 120,
      renderCell: ({ value }) => {
        const statusMap = {
          completed: { label: 'Hoàn tất', variant: 'success' },
          pending: { label: 'Đang chờ', variant: 'warning' },
          failed: { label: 'Thất bại', variant: 'error' },
          cancelled: { label: 'Đã hủy', variant: 'neutral' },
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
      width: 160,
      minWidth: 140,
      renderCell: ({ value }) => <span>{formatDate(value, true)}</span>,
    },
    {
      field: 'description',
      headerName: 'Diễn Giải',
      flex: 2,
      minWidth: 200,
      renderCell: ({ value }) => (
        <span title={value} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || '—'}
        </span>
      ),
    },
  ], []);

  return (
    <div className="admin-page-container wallet-admin-page">
      {/* ── Page Header ── */}
      <PageHeader
        title="Quản Lý Ví & Dòng Tiền S-Coin"
        subtitle="Theo dõi tổng số dư tài chính, phân bổ S-Coin/VND, giao dịch dòng tiền và kiểm soát tài khoản ví thành viên."
        badge={
          statsData?.total_wallets !== undefined
            ? `${statsData.total_wallets} ví thành viên`
            : undefined
        }
        badgeVariant="purple"
      />

      {/* ── KPI Stats Cards ── */}
      <div className="wallet-admin-page__stats-grid">
        <div className="wallet-admin-page__stat-card">
          <div className="wallet-admin-page__stat-card-icon wallet-admin-page__stat-card-icon--balance">
            <Coins size={24} />
          </div>
          <div className="wallet-admin-page__stat-card-content">
            <span className="stat-label">Tổng Số Dư Khả Dụng</span>
            <span className="stat-value">
              {formatCoin(statsData?.total_balance)} S-Coin
            </span>
            <span className="stat-sub">
              ≈ {formatVnd(Number(statsData?.total_balance || 0) * LCOIN_VND_RATE)}
            </span>
          </div>
        </div>

        <div className="wallet-admin-page__stat-card">
          <div className="wallet-admin-page__stat-card-icon wallet-admin-page__stat-card-icon--deposited">
            <ArrowDownRight size={24} />
          </div>
          <div className="wallet-admin-page__stat-card-content">
            <span className="stat-label">Tổng Doanh Thu Nạp</span>
            <span className="stat-value">
              +{formatCoin(statsData?.total_deposited)} S-Coin
            </span>
            <span className="stat-sub">Toàn thời gian</span>
          </div>
        </div>

        <div className="wallet-admin-page__stat-card">
          <div className="wallet-admin-page__stat-card-icon wallet-admin-page__stat-card-icon--spent">
            <ArrowUpRight size={24} />
          </div>
          <div className="wallet-admin-page__stat-card-content">
            <span className="stat-label">Tổng Chi Tiêu Dịch Vụ</span>
            <span className="stat-value">
              -{formatCoin(statsData?.total_spent)} S-Coin
            </span>
            <span className="stat-sub">Mua VIP & Phim</span>
          </div>
        </div>

        <div className="wallet-admin-page__stat-card">
          <div className="wallet-admin-page__stat-card-icon wallet-admin-page__stat-card-icon--locked">
            <Lock size={24} />
          </div>
          <div className="wallet-admin-page__stat-card-content">
            <span className="stat-label">Ví Bị Khóa Giao Dịch</span>
            <span className="stat-value">
              {Number(statsData?.locked_wallets || 0).toLocaleString()} ví
            </span>
            <span className="stat-sub">Đang tạm khóa</span>
          </div>
        </div>
      </div>

      {/* ── Main Tab Switcher ── */}
      <div className="wallet-admin-page__main-tabs">
        <button
          type="button"
          className={`wallet-admin-page__main-tab-btn ${
            activeMainTab === 'wallets' ? 'wallet-admin-page__main-tab-btn--active' : ''
          }`}
          onClick={() => setActiveMainTab('wallets')}
        >
          <Wallet size={16} />
          Danh Sách Ví Thành Viên
          <span className="tab-badge">{statsData?.total_wallets || walletCounts?.all || 0}</span>
        </button>

        <button
          type="button"
          className={`wallet-admin-page__main-tab-btn ${
            activeMainTab === 'transactions' ? 'wallet-admin-page__main-tab-btn--active' : ''
          }`}
          onClick={() => setActiveMainTab('transactions')}
        >
          <History size={16} />
          Dòng Tiền Giao Dịch Toàn Hệ Thống
          <span className="tab-badge">{statsData?.total_transactions || txCounts?.all || 0}</span>
        </button>
      </div>

      {/* ── TAB 1: Danh Sách Ví Thành Viên ── */}
      {activeMainTab === 'wallets' && (
        <>
          <AdminFilterToolbar
            tabs={WALLET_STATUS_TABS}
            activeTab={walletStatusTab}
            counts={walletCounts || {}}
            onTabChange={(t) => setWalletStatusTab(t)}
          />

          <DataGrid
            columns={walletColumns}
            {...walletGridProps}
            emptyMessage="Không tìm thấy ví người dùng nào phù hợp"
          />
        </>
      )}

      {/* ── TAB 2: Dòng Tiền Giao Dịch Toàn Hệ Thống ── */}
      {activeMainTab === 'transactions' && (
        <>
          <AdminFilterToolbar
            tabs={[]}
            activeTab="all"
            counts={{}}
            onTabChange={() => {}}
          >
            <Select
              className="wallet-admin-page__filter-select"
              options={TX_TYPE_OPTIONS}
              value={txTypeFilter}
              onChange={(val) => setTxTypeFilter(val)}
              size="small"
            />
            <Select
              className="wallet-admin-page__filter-select"
              options={TX_STATUS_OPTIONS}
              value={txStatusFilter}
              onChange={(val) => setTxStatusFilter(val)}
              size="small"
            />
          </AdminFilterToolbar>

          <DataGrid
            columns={txColumns}
            {...txGridProps}
            emptyMessage="Không tìm thấy giao dịch dòng tiền nào"
          />
        </>
      )}

      {/* ── Drawer Điều Chỉnh Số Dư ── */}
      <WalletAdjustDrawer
        open={adjustDrawerOpen}
        wallet={selectedWallet}
        onClose={() => {
          setAdjustDrawerOpen(false);
          setSelectedWallet(null);
        }}
        onSuccess={() => {
          refetchWallets();
          refetchTxs();
          refetchStats();
        }}
      />

      {/* ── Drawer Xem Chi Tiết & Lịch Sử Ví ── */}
      <WalletDetailDrawer
        open={detailDrawerOpen}
        wallet={selectedWallet}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedWallet(null);
        }}
        onAdjust={(wallet) => {
          setDetailDrawerOpen(false);
          setSelectedWallet(wallet);
          setAdjustDrawerOpen(true);
        }}
        onLockToggle={(wallet) => {
          handleOpenLockToggle(wallet);
        }}
      />

      {/* ── ConfirmModal Khóa / Mở Khóa Ví ── */}
      <ConfirmModal
        open={lockModal.open}
        className="wallet-lock-modal"
        title={lockModal.isLocking ? 'Khóa Ví Người Dùng' : 'Mở Khóa Ví Người Dùng'}
        type={lockModal.isLocking ? 'error' : 'primary'}
        size="medium"
        content={
          lockModal.isLocking ? (
            <div className="wallet-lock-modal__body">
              <p className="wallet-lock-modal__desc">
                Bạn có chắc chắn muốn khóa ví của thành viên{' '}
                <strong className="wallet-lock-modal__highlight">
                  {lockModal.wallet?.user?.full_name || lockModal.wallet?.user?.username}
                </strong>
                ? Mọi giao dịch nạp, rút và thanh toán VIP qua ví này sẽ bị phong tỏa ngay lập tức.
              </p>
              <div className="wallet-lock-modal__form-group">
                <TextField
                  fullWidth
                  label="Lý do khóa ví"
                  required
                  placeholder="Nhập lý do khóa ví (VD: Nghi vấn gian lận nạp lậu, vi phạm điều khoản)..."
                  value={lockModal.reason}
                  onChange={(e) =>
                    setLockModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="wallet-lock-modal__body">
              <p className="wallet-lock-modal__desc">
                Bạn có chắc chắn muốn mở khóa ví cho thành viên{' '}
                <strong className="wallet-lock-modal__highlight">
                  {lockModal.wallet?.user?.full_name || lockModal.wallet?.user?.username}
                </strong>
                ? Thành viên sẽ có thể tiếp tục sử dụng số dư ví bình thường.
              </p>
            </div>
          )
        }
        confirmText={lockModal.isLocking ? 'Xác Nhận Khóa' : 'Mở Khóa Ví'}
        confirmColor={lockModal.isLocking ? 'error' : 'primary'}
        loading={lockMutation.isPending || unlockMutation.isPending}
        onConfirm={handleConfirmLockToggle}
        onClose={() =>
          setLockModal({ open: false, wallet: null, isLocking: true, reason: '' })
        }
      />
    </div>
  );
};

export default AdminWalletPage;
