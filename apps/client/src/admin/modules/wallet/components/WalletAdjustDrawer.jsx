/**
 * @file WalletAdjustDrawer.jsx
 * @module Admin/Modules/Wallet/Components/WalletAdjustDrawer
 * @description Drawer điều chỉnh số dư S-Coin cho thành viên (Cộng / Trừ / Tặng thưởng), hiển thị quy đổi VND và tính toán số dư sau điều chỉnh theo chuẩn Material 3 Expressive & Obsidian Cinema.
 */

import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Gift,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Sparkles,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

import OffCanvas from '@/shared/components/ui/off-canvas';
import Button from '@/shared/components/ui/button';
import TextField from '@/shared/components/ui/text-field';
import Badge from '@/shared/components/ui/badge';
import Avatar from '@/shared/components/ui/avatar';
import Tooltip from '@/shared/components/ui/tooltip';
import { useAdminAdjustBalanceMutation } from '@/hooks/mutations/use-wallet.mutations';

import './wallet-adjust-drawer.scss';

// ── Tỷ giá quy đổi cố định 1 S-Coin = 1,000 VND ──
const LCOIN_VND_RATE = 1000;

// ── Các hình thức điều chỉnh ──
const ADJUST_TYPES = [
  {
    id: 'admin_credit',
    label: 'Cộng Xu',
    description: 'Nạp bù lỗi hệ thống, bồi hoàn giao dịch hoặc thanh toán thủ công',
    icon: ArrowDownRight,
    colorVariant: 'credit',
  },
  {
    id: 'admin_debit',
    label: 'Khấu Trừ',
    description: 'Thu hồi xu cộng nhầm, thu hồi vi phạm hoặc điều chỉnh giảm',
    icon: ArrowUpRight,
    colorVariant: 'debit',
  },
  {
    id: 'bonus',
    label: 'Tặng Thưởng',
    description: 'Trao thưởng sự kiện, quà tri ân hoặc khuyến mãi đặc biệt',
    icon: Gift,
    colorVariant: 'bonus',
  },
];

// ── Gợi ý mức xu nhanh ──
const QUICK_COIN_PRESETS = [50, 100, 200, 500, 1000, 2000];

// ── Gợi ý lý do thông dụng ──
const REASON_PRESETS = [
  'Bồi hoàn lỗi trừ xu mua phim',
  'Thưởng sự kiện Mini-game Anime',
  'Cộng xu thanh toán chuyển khoản qua Admin',
  'Thu hồi xu do giao dịch bị hoàn lại',
  'Khấu trừ số dư do phát hiện gian lận',
];

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

export const WalletAdjustDrawer = ({
  open = false,
  wallet = null,
  onClose,
  onSuccess,
}) => {
  const [adjustType, setAdjustType] = useState('admin_credit');
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});

  const adjustMutation = useAdminAdjustBalanceMutation();

  // Reset form khi mở drawer với ví mới
  useEffect(() => {
    if (open) {
      setAdjustType('admin_credit');
      setAmountInput('');
      setReason('');
      setErrors({});
    }
  }, [open, wallet]);

  const user = wallet?.user;
  const currentBalance = Number(wallet?.balance || 0);
  const parsedAmount = Number(amountInput) || 0;

  // Tính số dư sau điều chỉnh
  const nextBalance = useMemo(() => {
    if (adjustType === 'admin_debit') {
      return currentBalance - parsedAmount;
    }
    return currentBalance + parsedAmount;
  }, [currentBalance, parsedAmount, adjustType]);

  // Validation
  const validateForm = () => {
    const errs = {};
    if (!amountInput || parsedAmount <= 0) {
      errs.amount = 'Số xu điều chỉnh phải lớn hơn 0';
    } else if (!Number.isInteger(parsedAmount)) {
      errs.amount = 'Số xu phải là số nguyên';
    } else if (adjustType === 'admin_debit' && parsedAmount > currentBalance) {
      errs.amount = `Số dư hiện tại (${formatCoin(currentBalance)} S-Coin) không đủ để khấu trừ`;
    }

    if (!reason.trim()) {
      errs.reason = 'Vui lòng nhập lý do điều chỉnh để lưu vết lịch sử giao dịch';
    } else if (reason.trim().length < 5) {
      errs.reason = 'Lý do phải có ít nhất 5 ký tự';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validateForm() || !wallet) return;

    try {
      const targetUserId = wallet.user_id || wallet.user?.id;
      await adjustMutation.mutateAsync({
        user_id: targetUserId,
        userId: targetUserId,
        amount: parsedAmount,
        type: adjustType,
        description: reason.trim(),
        reason: reason.trim(),
      });

      onSuccess?.();
      onClose?.();
    } catch (err) {
      // toast error đã được xử lý bởi useAdminAdjustBalanceMutation
    }
  };

  if (!wallet) return null;

  const displayName = user?.full_name || user?.username || 'Thành viên';
  const displayEmail = user?.email || `@${user?.username || 'user'}`;
  const isDebit = adjustType === 'admin_debit';

  return (
    <OffCanvas
      open={open}
      onClose={onClose}
      placement="right"
      size="medium"
      variant="tonal"
      className="wallet-adjust-drawer"
    >
      <OffCanvas.Header
        title="Điều Chỉnh Số Dư S-Coin"
        subtitle={`Ví người dùng: ${displayName}`}
        onClose={onClose}
        showCloseButton
      />

      <OffCanvas.Body className="wallet-adjust-drawer__body">
        {/* ── 1. Thẻ thông tin Thành viên & Số dư hiện tại ── */}
        <div className="wallet-adjust-drawer__user-card">
          <div className="user-avatar-wrap">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={displayName} className="user-avatar" />
            ) : (
              <div className="user-avatar-fallback">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="user-meta">
            <span className="user-name">{displayName}</span>
            <span className="user-email">{displayEmail}</span>
            <div className="user-badges">
              {wallet.is_locked ? (
                <Badge variant="error" size="small">Ví đang bị khóa</Badge>
              ) : (
                <Badge variant="success" size="small">Ví hoạt động</Badge>
              )}
            </div>
          </div>
          <div className="balance-box">
            <span className="balance-label">Số Dư Hiện Tại</span>
            <span className="balance-coin">
              <Coins size={16} /> {formatCoin(currentBalance)} S-Coin
            </span>
            <span className="balance-vnd">≈ {formatVnd(currentBalance * LCOIN_VND_RATE)}</span>
          </div>
        </div>

        {/* ── 2. Chọn hình thức điều chỉnh ── */}
        <div className="wallet-adjust-drawer__section">
          <label className="section-label">
            Loại Điều Chỉnh <span className="required-mark">*</span>
          </label>
          <div className="adjust-type-grid">
            {ADJUST_TYPES.map((type) => {
              const IconComp = type.icon;
              const isSelected = adjustType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  className={`adjust-type-btn adjust-type-btn--${type.colorVariant} ${
                    isSelected ? 'adjust-type-btn--selected' : ''
                  }`}
                  onClick={() => {
                    setAdjustType(type.id);
                    setErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                >
                  <div className="type-icon-box">
                    <IconComp size={18} />
                  </div>
                  <div className="type-info">
                    <span className="type-title">{type.label}</span>
                    <span className="type-desc">{type.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3. Nhập số xu S-Coin & Presets ── */}
        <div className="wallet-adjust-drawer__section">
          <div className="section-label-row">
            <label className="section-label">
              Số Xu Điều Chỉnh (S-Coin) <span className="required-mark">*</span>
            </label>
            <span className="rate-hint">1 S-Coin = 1,000 VND</span>
          </div>

          <div className="coin-input-wrap">
            <TextField
              type="number"
              placeholder="Nhập số xu S-Coin (VD: 100)"
              value={amountInput}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setAmountInput(val);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              error={Boolean(errors.amount)}
              helperText={errors.amount}
              startAdornment={<Coins size={18} className="coin-input-icon" />}
              fullWidth
            />
          </div>

          {/* Quick presets */}
          <div className="preset-chips">
            {QUICK_COIN_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`preset-chip ${parsedAmount === preset ? 'preset-chip--active' : ''}`}
                onClick={() => {
                  setAmountInput(preset.toString());
                  if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                }}
              >
                {isDebit ? `-${formatCoin(preset)}` : `+${formatCoin(preset)}`} S-Coin
              </button>
            ))}
          </div>

          {/* Quy đổi VND tương đương */}
          {parsedAmount > 0 && (
            <div className="equivalent-box">
              <Sparkles size={16} />
              <span>Giá trị quy đổi tương đương:</span>
              <strong>{formatVnd(parsedAmount * LCOIN_VND_RATE)}</strong>
            </div>
          )}
        </div>

        {/* ── 4. Thẻ Xem Trước Biến Động Số Dư (Preview) ── */}
        <div className="wallet-adjust-drawer__preview-card">
          <div className="preview-row">
            <span className="preview-label">Số dư hiện tại:</span>
            <span className="preview-value">{formatCoin(currentBalance)} S-Coin</span>
          </div>
          <div className="preview-row">
            <span className="preview-label">
              {isDebit ? 'Khấu trừ:' : 'Cộng thêm:'}
            </span>
            <span
              className={`preview-value ${
                isDebit ? 'preview-value--debit' : 'preview-value--credit'
              }`}
            >
              {isDebit ? '-' : '+'}{formatCoin(parsedAmount)} S-Coin
            </span>
          </div>
          <div className="preview-divider" />
          <div className="preview-row preview-row--total">
            <span className="preview-label">Số dư sau điều chỉnh:</span>
            <span
              className={`preview-value preview-value--next ${
                nextBalance < 0 ? 'preview-value--danger' : ''
              }`}
            >
              {formatCoin(nextBalance)} S-Coin
              <span className="next-vnd">≈ {formatVnd(nextBalance * LCOIN_VND_RATE)}</span>
            </span>
          </div>
        </div>

        {/* ── 5. Lý do điều chỉnh (Bắt buộc) ── */}
        <div className="wallet-adjust-drawer__section">
          <label className="section-label">
            Lý Do Điều Chỉnh (Bắt buộc) <span className="required-mark">*</span>
          </label>
          <TextField
            multiline
            rows={3}
            placeholder="Ghi rõ lý do điều chỉnh số dư để phục vụ kiểm toán tài chính..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errors.reason) setErrors((prev) => ({ ...prev, reason: undefined }));
            }}
            error={Boolean(errors.reason)}
            helperText={errors.reason}
            fullWidth
          />

          {/* Quick reason suggestions */}
          <div className="reason-chips">
            {REASON_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                className="reason-chip"
                onClick={() => {
                  setReason(preset);
                  if (errors.reason) setErrors((prev) => ({ ...prev, reason: undefined }));
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </OffCanvas.Body>

      <OffCanvas.Footer className="wallet-adjust-drawer__footer">
        <Button variant="outlined" onClick={onClose} disabled={adjustMutation.isPending}>
          Hủy Bỏ
        </Button>
        <Button
          variant="filled"
          color={isDebit ? 'error' : 'primary'}
          onClick={handleSubmit}
          loading={adjustMutation.isPending}
          disabled={adjustMutation.isPending}
          startIcon={
            isDebit ? (
              <ArrowUpRight size={16} />
            ) : adjustType === 'bonus' ? (
              <Gift size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )
          }
        >
          {isDebit ? 'Xác Nhận Trừ Xu' : adjustType === 'bonus' ? 'Trao Thưởng S-Coin' : 'Xác Nhận Nạp Xu'}
        </Button>
      </OffCanvas.Footer>
    </OffCanvas>
  );
};

WalletAdjustDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  wallet: PropTypes.shape({
    id: PropTypes.string,
    user_id: PropTypes.string,
    balance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hold_balance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    is_locked: PropTypes.bool,
    user: PropTypes.shape({
      id: PropTypes.string,
      username: PropTypes.string,
      email: PropTypes.string,
      full_name: PropTypes.string,
      avatar_url: PropTypes.string,
    }),
  }),
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};

export default WalletAdjustDrawer;
