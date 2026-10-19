/**
 * @file SubscriptionGrantDrawer.jsx
 * @module Admin/Modules/Subscriptions/Components/SubscriptionGrantDrawer
 * @description Drawer cấp gói VIP thủ công cho thành viên, tích hợp tìm kiếm Async người dùng, chọn gói VIP, thời hạn và ghi chú audit.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import * as yup from 'yup';
import {
  Crown,
  Sparkles,
  Gem,
  Zap,
  Star,
  Info,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { EntityFormDrawer } from '@/admin/shared/components/forms/entity-form-drawer/EntityFormDrawer';
import TextField from '@/shared/components/ui/text-field';
import Select from '@/shared/components/ui/select';
import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import Avatar from '@/shared/components/ui/avatar';

import userService from '@/shared/services/user.service';
import { useAdminMembershipPlansQuery } from '@/hooks/queries/use-subscription.queries';
import { useAdminGrantVipMutation } from '@/hooks/mutations/use-subscription.mutations';

import './subscription-grant-drawer.scss';

// ── Icon mapping ──
const ICON_MAP = {
  Crown,
  Sparkles,
  Gem,
  Zap,
  Star,
  Info,
};

// ── Gợi ý số ngày cấp nhanh ──
const QUICK_DURATIONS = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày (1 tháng)' },
  { days: 90, label: '90 ngày (3 tháng)' },
  { days: 180, label: '180 ngày (6 tháng)' },
  { days: 365, label: '365 ngày (1 năm)' },
];

// ── Validation Schema ──
const grantVipSchema = yup.object().shape({
  user_id: yup.string().required('Vui lòng tìm và chọn người dùng nhận VIP'),
  plan_id: yup.string().required('Vui lòng chọn gói thành viên VIP'),
  billing_cycle: yup.string().oneOf(['monthly', 'yearly']).default('monthly'),
  duration_days: yup
    .number()
    .typeError('Số ngày phải là số')
    .integer('Số ngày phải là số nguyên')
    .min(1, 'Thời hạn tối thiểu là 1 ngày')
    .max(3650, 'Thời hạn tối đa là 10 năm')
    .required('Vui lòng chỉ định số ngày hiệu lực'),
  note: yup.string().max(255, 'Ghi chú tối đa 255 ký tự').nullable(),
});

export const SubscriptionGrantDrawer = ({ open = false, onClose, onSuccess }) => {
  // ── States ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // ── Queries & Mutations ──
  const { data: plansData } = useAdminMembershipPlansQuery({ is_active: true });
  const grantVipMutation = useAdminGrantVipMutation();

  // Lọc các gói trả phí (bỏ gói free nếu có)
  const vipPlans = useMemo(() => {
    const list = plansData?.items || plansData || [];
    return list.filter((p) => p.tier !== 'free' && Number(p.price_monthly) > 0);
  }, [plansData]);

  // Reset khi đóng mở drawer
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setShowDropdown(false);
    }
  }, [open]);

  // Debounced search người dùng
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await userService.listUsers({
          search: searchQuery.trim(),
          limit: 6,
          page: 1,
        });
        const users = res?.items || res?.data?.items || [];
        setSearchResults(users);
        setShowDropdown(true);
      } catch (err) {
        console.error('[SubscriptionGrantDrawer] Error searching users:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handler chọn user
  const handleSelectUser = (user, setValue) => {
    setSelectedUser(user);
    setValue('user_id', user.id, { shouldDirty: true, shouldValidate: true });
    setSearchQuery('');
    setShowDropdown(false);
  };

  // Handler bỏ chọn user
  const handleClearUser = (setValue) => {
    setSelectedUser(null);
    setValue('user_id', '', { shouldDirty: true, shouldValidate: true });
  };

  // Submit handler
  const handleSubmit = async (formData) => {
    try {
      await grantVipMutation.mutateAsync({
        user_id: formData.user_id,
        plan_id: formData.plan_id,
        billing_cycle: formData.billing_cycle || 'monthly',
        duration_days: Number(formData.duration_days) || 30,
        note: formData.note?.trim() || 'Cấp VIP từ Quản trị viên',
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      // Đã có toast trong mutation
    }
  };

  return (
    <EntityFormDrawer
      open={open}
      onClose={onClose}
      title="Cấp Gói VIP Thủ Công"
      subtitle="Trao đặc quyền hội viên VIP cho người dùng hệ thống không cần qua cổng thanh toán."
      size="large"
      schema={grantVipSchema}
      defaultValues={{
        user_id: '',
        plan_id: vipPlans[0]?.id || '',
        billing_cycle: 'monthly',
        duration_days: 30,
        note: '',
      }}
      onSubmit={handleSubmit}
      submitLabel="Xác Nhận Cấp VIP"
      className="subscription-grant-drawer"
    >
      {({ register, formState: { errors }, setValue, watch }) => {
        const selectedPlanId = watch('plan_id') || vipPlans[0]?.id;
        const currentDays = watch('duration_days') || 30;

        return (
          <>
            {/* ── BƯỚC 1: TÌM & CHỌN NGƯỜI DÙNG ── */}
            <div className="subscription-grant-drawer__section">
              <div className="subscription-grant-drawer__section-title">
                <User size={15} /> Người Dùng Nhận VIP
              </div>

              {selectedUser ? (
                <div className="subscription-grant-drawer__selected-user">
                  <div className="subscription-grant-drawer__selected-user-meta">
                    <Avatar
                      src={selectedUser.avatar_url}
                      alt={selectedUser.full_name || selectedUser.username}
                      size="medium"
                    />
                    <div className="subscription-grant-drawer__selected-user-info">
                      <span className="name">{selectedUser.full_name || selectedUser.username}</span>
                      <span className="sub">
                        @{selectedUser.username} • {selectedUser.email}
                      </span>
                    </div>
                  </div>
                  <IconButton
                    size="small"
                    variant="standard"
                    color="default"
                    onClick={() => handleClearUser(setValue)}
                    title="Bỏ chọn người dùng"
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              ) : (
                <div className="subscription-grant-drawer__user-search">
                  <TextField
                    placeholder="Tìm theo username, họ tên hoặc email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    startIcon={<Search size={16} />}
                    helperText={
                      errors.user_id?.message ||
                      'Gõ từ khóa để hệ thống tự động tìm kiếm thành viên.'
                    }
                    error={Boolean(errors.user_id?.message)}
                  />

                  {showDropdown && (
                    <div className="subscription-grant-drawer__user-search-dropdown">
                      {searching ? (
                        <div className="subscription-grant-drawer__user-search-empty">
                          Đang tìm kiếm...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="subscription-grant-drawer__user-search-empty">
                          Không tìm thấy người dùng phù hợp
                        </div>
                      ) : (
                        searchResults.map((u) => (
                          <div
                            key={u.id}
                            className="subscription-grant-drawer__user-search-item"
                            onClick={() => handleSelectUser(u, setValue)}
                          >
                            <Avatar
                              src={u.avatar_url}
                              alt={u.full_name || u.username}
                              size="small"
                            />
                            <div className="subscription-grant-drawer__user-search-info">
                              <span className="user-name">{u.full_name || u.username}</span>
                              <span className="user-sub">
                                @{u.username} • {u.email}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── BƯỚC 2: CHỌN GÓI THÀNH VIÊN VIP ── */}
            <div className="subscription-grant-drawer__section">
              <div className="subscription-grant-drawer__section-title">
                <Crown size={15} /> Gói VIP & Chu Kỳ
              </div>

              <div className="subscription-grant-drawer__plan-grid">
                {vipPlans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const IconComp = ICON_MAP[plan.icon_name] || Crown;
                  const color = plan.badge_color || '#FF6D00';

                  return (
                    <div
                      key={plan.id}
                      className={`subscription-grant-drawer__plan-card ${
                        isSelected ? 'subscription-grant-drawer__plan-card--selected' : ''
                      }`}
                      onClick={() =>
                        setValue('plan_id', plan.id, { shouldDirty: true, shouldValidate: true })
                      }
                    >
                      <div
                        className="subscription-grant-drawer__plan-card-icon"
                        style={{ backgroundColor: `${color}18`, color }}
                      >
                        <IconComp size={18} />
                      </div>
                      <div className="subscription-grant-drawer__plan-card-name">{plan.name}</div>
                      <div className="subscription-grant-drawer__plan-card-tier">{plan.tier}</div>
                    </div>
                  );
                })}
              </div>

              <Select
                label="Chu kỳ tương đương"
                options={[
                  { value: 'monthly', label: 'Theo Tháng (Monthly)' },
                  { value: 'yearly', label: 'Theo Năm (Yearly)' },
                ]}
                value={watch('billing_cycle') || 'monthly'}
                onChange={(_e, v) => setValue('billing_cycle', v, { shouldDirty: true })}
              />
            </div>

            {/* ── BƯỚC 3: THỜI HẠN HIỆU LỰC ── */}
            <div className="subscription-grant-drawer__section">
              <div className="subscription-grant-drawer__section-title">
                <Clock size={15} /> Thời Hạn Cấp VIP
              </div>

              <div className="subscription-grant-drawer__duration-chips">
                {QUICK_DURATIONS.map((item) => (
                  <button
                    key={item.days}
                    type="button"
                    className={`subscription-grant-drawer__duration-chip ${
                      Number(currentDays) === item.days
                        ? 'subscription-grant-drawer__duration-chip--active'
                        : ''
                    }`}
                    onClick={() =>
                      setValue('duration_days', item.days, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <TextField
                label="Hoặc nhập số ngày cụ thể"
                type="number"
                placeholder="Ví dụ: 30"
                error={errors.duration_days?.message}
                {...register('duration_days', { valueAsNumber: true })}
              />
            </div>

            {/* ── BƯỚC 4: GHI CHÚ AUDIT ── */}
            <div className="subscription-grant-drawer__section">
              <div className="subscription-grant-drawer__section-title">
                <FileText size={15} /> Ghi Chú Quản Trị
              </div>

              <TextField
                label="Lý do cấp VIP"
                placeholder="Ví dụ: Tặng hội viên đạt giải sự kiện, bù lỗi dịch vụ..."
                error={errors.note?.message}
                {...register('note')}
              />
            </div>

            {/* Thông báo chính sách */}
            <div className="subscription-grant-drawer__notice">
              <AlertCircle size={16} />
              <span>
                Nếu người dùng đang có gói VIP khác hoạt động, gói đó sẽ tự động được thay thế bằng
                gói mới và đặc quyền sẽ được kích hoạt tức thì qua Real-time Socket.
              </span>
            </div>
          </>
        );
      }}
    </EntityFormDrawer>
  );
};

SubscriptionGrantDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};

export default SubscriptionGrantDrawer;
