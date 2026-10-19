/**
 * @file WalletDetailDrawer.jsx
 * @module Admin/Modules/Wallet/Components/WalletDetailDrawer
 * @description Drawer xem chi tiết ví người dùng, phân tích dòng tiền tài chính và bảng lịch sử giao dịch riêng của ví chuẩn Material 3 Expressive & Obsidian Cinema.
 */

import React, { memo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Wallet,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Gift,
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  Calendar,
  Copy,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';

import OffCanvas from '@/shared/components/ui/off-canvas';
import Button from '@/shared/components/ui/button';
import Badge from '@/shared/components/ui/badge';
import Tooltip from '@/shared/components/ui/tooltip';
import { useAdminUserWalletTransactionsQuery } from '@/hooks/queries/use-wallet.queries';
import { formatDate } from '@/admin/shared/components/data-display/data-grid';

import './wallet-detail-drawer.scss';

// ── Tỷ giá 1 S-Coin = 1,000 VND ──
const LCOIN_VND_RATE = 1000;

// ── Cấu hình nhãn và màu sắc loại giao dịch ──
const TRANSACTION_TYPE_CONFIG = {
  deposit: { label: 'Nạp tiền', variant: 'success', sign: '+' },
  purchase: { label: 'Mua VIP / Phim', variant: 'warning', sign: '-' },
  refund: { label: 'Hoàn tiền', variant: 'info', sign: '+' },
  bonus: { label: 'Tặng thưởng', variant: 'purple', sign: '+' },
  admin_credit: { label: 'Admin nạp', variant: 'success', sign: '+' },
  admin_debit: { label: 'Admin trừ', variant: 'error', sign: '-' },
  withdrawal_hold: { label: 'Tạm giữ rút', variant: 'warning', sign: '-' },
  withdrawal_complete: { label: 'Rút tiền hoàn tất', variant: 'error', sign: '-' },
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

export const WalletDetailDrawer = memo(({
  open = false,
  wallet = null,
  onClose,
  onAdjust,
  onLockToggle,
}) => {
  const [page, setPage] = useState(1);
  const limit = 10;

  // Lấy lịch sử giao dịch riêng của ví user
  const userId = wallet?.user_id || wallet?.user?.id;
  const {
    data: txData,
    isLoading: txLoading,
    isFetching: txFetching,
  } = useAdminUserWalletTransactionsQuery(userId, { page, limit }, { enabled: Boolean(open && userId) });

  if (!wallet) return null;

  const user = wallet.user;
  const displayName = user?.full_name || user?.username || 'Thành viên';
  const displayEmail = user?.email || `@${user?.username || 'user'}`;
  const balanceNum = Number(wallet.balance || 0);
  const holdBalanceNum = Number(wallet.hold_balance || 0);
  const depositedNum = Number(wallet.total_deposited || 0);
  const spentNum = Number(wallet.total_spent || 0);

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã chép ${label}!`);
  };

  const txItems = txData?.items || [];
  const totalTx = txData?.total || 0;
  const totalPages = Math.ceil(totalTx / limit) || 1;

  return (
    <OffCanvas
      open={open}
      onClose={onClose}
      placement="right"
      size="large"
      variant="tonal"
      className="wallet-detail-drawer"
    >
      <OffCanvas.Header
        title="Hồ Sơ & Lịch Sử Ví S-Coin"
        subtitle={`Chủ tài khoản: ${displayName}`}
        onClose={onClose}
        showCloseButton
      />

      <OffCanvas.Body className="wallet-detail-drawer__body">
        {/* ── 1. Thẻ Thành viên & Trạng thái Ví ── */}
        <div className="wallet-detail-drawer__member-card">
          <div className="member-avatar-wrap">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={displayName} className="member-avatar" />
            ) : (
              <div className="member-avatar-fallback">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div className="member-info">
            <div className="name-row">
              <span className="name" title={displayName}>{displayName}</span>
              <Badge variant={wallet.is_locked ? 'error' : 'success'} size="small">
                {wallet.is_locked ? 'Ví đang bị khóa' : 'Hoạt động bình thường'}
              </Badge>
            </div>
            <span className="email">{displayEmail}</span>
            <div className="meta-pills">
              <span className="meta-pill" onClick={() => handleCopy(wallet.id, 'Mã Ví')}>
                Mã ví: <code>{wallet.id.slice(0, 8)}...</code>
                <Copy size={12} />
              </span>
              <span className="meta-pill">
                Khởi tạo: {formatDate(wallet.created_at, false)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Thao tác nhanh (Quick Actions) ── */}
        <div className="wallet-detail-drawer__actions-row">
          <Button
            variant="filled"
            color="primary"
            startIcon={<SlidersHorizontal size={16} />}
            onClick={() => onAdjust?.(wallet)}
            fullWidth
          >
            Điều Chỉnh Số Dư S-Coin
          </Button>
          <Button
            variant="outlined"
            color={wallet.is_locked ? 'success' : 'error'}
            startIcon={wallet.is_locked ? <Unlock size={16} /> : <Lock size={16} />}
            onClick={() => onLockToggle?.(wallet)}
            fullWidth
          >
            {wallet.is_locked ? 'Mở Khóa Ví' : 'Khóa Ví Người Dùng'}
          </Button>
        </div>

        {/* ── Banner Cảnh Báo Khi Ví Bị Khóa ── */}
        {wallet.is_locked && (
          <div className="wallet-detail-drawer__lock-banner">
            <div className="banner-icon">
              <ShieldAlert size={20} />
            </div>
            <div className="banner-content">
              <span className="banner-title">Ví này đang bị khóa mọi giao dịch tài chính</span>
              <p className="banner-desc">
                <strong>Lý do:</strong> {wallet.locked_reason || 'Vi phạm chính sách hoặc quản trị viên tạm khóa'}
              </p>
              {wallet.locked_at && (
                <span className="banner-time">
                  Thời gian khóa: {formatDate(wallet.locked_at, true)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── 2. Bộ 4 Thẻ Chỉ Số Tài Chính ── */}
        <div className="wallet-detail-drawer__metrics-grid">
          <div className="metric-box metric-box--balance">
            <span className="metric-label">Số Dư Khả Dụng</span>
            <span className="metric-val">
              <Coins size={16} /> {formatCoin(balanceNum)} S-Coin
            </span>
            <span className="metric-sub">≈ {formatVnd(balanceNum * LCOIN_VND_RATE)}</span>
          </div>

          <div className="metric-box metric-box--hold">
            <span className="metric-label">Đang Tạm Giữ (Hold)</span>
            <span className="metric-val">{formatCoin(holdBalanceNum)} S-Coin</span>
            <span className="metric-sub">Lệnh rút hoặc đặt cọc</span>
          </div>

          <div className="metric-box metric-box--deposited">
            <span className="metric-label">Tổng Đã Nạp</span>
            <span className="metric-val metric-val--success">
              +{formatCoin(depositedNum)} S-Coin
            </span>
            <span className="metric-sub">≈ {formatVnd(depositedNum * LCOIN_VND_RATE)}</span>
          </div>

          <div className="metric-box metric-box--spent">
            <span className="metric-label">Tổng Chi Tiêu</span>
            <span className="metric-val metric-val--spent">
              -{formatCoin(spentNum)} S-Coin
            </span>
            <span className="metric-sub">Dịch vụ & Gói VIP</span>
          </div>
        </div>

        {/* ── 3. Bảng Lịch Sử Giao Dịch Riêng Của Ví ── */}
        <div className="wallet-detail-drawer__history-section">
          <div className="history-header">
            <div className="header-title-wrap">
              <span className="header-title">Lịch Sử Giao Dịch ({totalTx})</span>
              {txFetching && <span className="fetching-indicator">Đang tải...</span>}
            </div>
            {totalPages > 1 && (
              <div className="mini-pagination">
                <button
                  type="button"
                  className="page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="page-info">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="history-table-wrapper">
            {txLoading ? (
              <div className="history-loading">Đang tải lịch sử giao dịch...</div>
            ) : txItems.length === 0 ? (
              <div className="history-empty">Chưa có giao dịch phát sinh nào trong ví này.</div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Mã GD</th>
                    <th>Loại GD</th>
                    <th>Biến Động Xu</th>
                    <th>Số Dư Trước ➔ Sau</th>
                    <th>Thời Gian</th>
                    <th>Ghi Chú</th>
                  </tr>
                </thead>
                <tbody>
                  {txItems.map((tx) => {
                    const typeCfg = TRANSACTION_TYPE_CONFIG[tx.type] || {
                      label: tx.type,
                      variant: 'default',
                      sign: '',
                    };
                    const isCredit = typeCfg.sign === '+';

                    return (
                      <tr key={tx.id}>
                        <td>
                          <span
                            className="code-pill"
                            onClick={() => handleCopy(tx.id, 'Mã GD')}
                            title="Click để chép mã"
                          >
                            {tx.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td>
                          <Badge variant={typeCfg.variant} size="small">
                            {typeCfg.label}
                          </Badge>
                        </td>
                        <td>
                          <span
                            className={`amount-badge ${
                              isCredit ? 'amount-badge--credit' : 'amount-badge--debit'
                            }`}
                          >
                            {typeCfg.sign}{formatCoin(tx.amount)} S-Coin
                          </span>
                        </td>
                        <td>
                          <span className="balance-snapshot">
                            {formatCoin(tx.balance_before)} ➔ {formatCoin(tx.balance_after)}
                          </span>
                        </td>
                        <td>
                          <span className="tx-time">{formatDate(tx.created_at, true)}</span>
                        </td>
                        <td>
                          <span className="tx-desc" title={tx.description}>
                            {tx.description || 'Không có ghi chú'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </OffCanvas.Body>

      <OffCanvas.Footer className="wallet-detail-drawer__footer">
        <Button variant="outlined" onClick={onClose}>
          Đóng
        </Button>
      </OffCanvas.Footer>
    </OffCanvas>
  );
});

WalletDetailDrawer.displayName = 'WalletDetailDrawer';

WalletDetailDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  wallet: PropTypes.shape({
    id: PropTypes.string,
    user_id: PropTypes.string,
    balance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hold_balance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    total_deposited: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    total_spent: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    is_locked: PropTypes.bool,
    locked_reason: PropTypes.string,
    locked_at: PropTypes.string,
    created_at: PropTypes.string,
    user: PropTypes.shape({
      id: PropTypes.string,
      username: PropTypes.string,
      email: PropTypes.string,
      full_name: PropTypes.string,
      avatar_url: PropTypes.string,
    }),
  }),
  onClose: PropTypes.func.isRequired,
  onAdjust: PropTypes.func,
  onLockToggle: PropTypes.func,
};

export default WalletDetailDrawer;
