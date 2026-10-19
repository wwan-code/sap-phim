/**
 * @file MembershipPlanFormDrawer.jsx
 * @module Admin/Modules/MembershipPlans/Components/MembershipPlanFormDrawer
 * @description Drawer tạo mới và cập nhật cấu hình Gói Hội Viên VIP chuẩn Material 3 Expressive, phân chia 3 Tabs chức năng tinh gọn.
 */

import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Crown,
  Sparkles,
  Gem,
  Info,
  Zap,
  Star,
  Tv,
  Users,
  Download,
  Headphones,
  Shield,
  Save,
  Layers,
  Palette,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';

import OffCanvas from '@/shared/components/ui/off-canvas';
import Button from '@/shared/components/ui/button';
import Switch from '@/shared/components/ui/switch';
import {
  useAdminCreatePlanMutation,
  useAdminUpdatePlanMutation,
} from '@/hooks/mutations/use-subscription.mutations';

import './membership-plan-form-drawer.scss';

// ── TIER PRESETS ──
const TIER_OPTIONS = [
  { value: 'free', label: 'Miễn phí (Free)', defaultLevel: 0, defaultColor: '#9E9E9E', defaultIcon: 'Info' },
  { value: 'plus', label: 'Gói Cơ bản (Plus)', defaultLevel: 1, defaultColor: '#4285F4', defaultIcon: 'Sparkles' },
  { value: 'pro', label: 'Gói Nâng cao (Pro)', defaultLevel: 2, defaultColor: '#FF6D00', defaultIcon: 'Crown' },
  { value: 'ultra', label: 'Gói Cao cấp (Ultra)', defaultLevel: 3, defaultColor: '#9C27B0', defaultIcon: 'Gem' },
];

// ── QUALITY PRESETS ──
const QUALITY_OPTIONS = [
  { value: 'sd', label: 'SD (480p)' },
  { value: 'hd', label: 'HD (720p)' },
  { value: 'full_hd', label: 'Full HD (1080p)' },
  { value: '2k', label: '2K QHD (1440p)' },
  { value: '4k', label: '4K Ultra HD (2160p)' },
];

// ── ICON PRESETS ──
const PRESET_ICONS = [
  { name: 'Crown', icon: Crown, label: 'Vương miện' },
  { name: 'Sparkles', icon: Sparkles, label: 'Lấp lánh' },
  { name: 'Gem', icon: Gem, label: 'Đá quý' },
  { name: 'Zap', icon: Zap, label: 'Tia chớp' },
  { name: 'Star', icon: Star, label: 'Ngôi sao' },
  { name: 'Info', icon: Info, label: 'Thông tin' },
];

// ── COLOR PRESETS ──
const PRESET_COLORS = [
  '#9E9E9E',
  '#4285F4',
  '#FF6D00',
  '#9C27B0',
  '#E50914',
  '#10B981',
  '#7C5DFA',
];

// ── TABS CONFIG ──
const FORM_TABS = [
  { id: 'info-pricing', label: 'Thông Tin & Giá', icon: DollarSign },
  { id: 'entitlements', label: 'Đặc Quyền & Giới Hạn', icon: Shield },
  { id: 'branding-display', label: 'Thương Hiệu & Hiển Thị', icon: Sparkles },
];

const DEFAULT_FORM_STATE = {
  tier: 'plus',
  tier_level: 1,
  name: '',
  slug: '',
  tagline: '',
  description: '',
  price_monthly: 49000,
  price_yearly: 490000,
  currency: 'VND',
  features: {
    max_quality: 'full_hd',
    max_devices: 2,
    watch_together_limit: 10,
    offline_download: true,
    priority_support: true,
    custom_avatar: true,
    custom_cover: false,
    permanent_storage: false,
    premium_name_effect: false,
    premium_avatar_frame: false,
  },
  display_order: 1,
  badge_color: '#4285F4',
  icon_name: 'Sparkles',
  is_popular: false,
  is_active: true,
};

/**
 * Format tiền tệ VND
 * @param {number} amount
 * @returns {string}
 */
const formatCurrency = (amount) => {
  if (amount === 0 || !amount) return '0 ₫';
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
};

export const MembershipPlanFormDrawer = ({
  open = false,
  onClose,
  plan = null,
}) => {
  const isEdit = Boolean(plan?._id || plan?.id);
  const [activeTab, setActiveTab] = useState('info-pricing');
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);

  const createMutation = useAdminCreatePlanMutation({
    onSuccess: () => {
      onClose?.();
    },
  });

  const updateMutation = useAdminUpdatePlanMutation({
    onSuccess: () => {
      onClose?.();
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Khởi tạo / Đồng bộ dữ liệu vào Form
  useEffect(() => {
    if (plan && open) {
      setFormData({
        tier: plan.tier || 'plus',
        tier_level: plan.tier_level ?? 1,
        name: plan.name || '',
        slug: plan.slug || '',
        tagline: plan.tagline || '',
        description: plan.description || '',
        price_monthly: Number(plan.price_monthly) || 0,
        price_yearly: plan.price_yearly ? Number(plan.price_yearly) : null,
        currency: plan.currency || 'VND',
        features: {
          max_quality: plan.features?.max_quality || 'full_hd',
          max_devices: plan.features?.max_devices ?? 1,
          watch_together_limit: plan.features?.watch_together_limit ?? 2,
          offline_download: Boolean(plan.features?.offline_download),
          priority_support: Boolean(plan.features?.priority_support),
          custom_avatar: Boolean(plan.features?.custom_avatar),
          custom_cover: Boolean(plan.features?.custom_cover),
          permanent_storage: Boolean(plan.features?.permanent_storage),
          premium_name_effect: Boolean(plan.features?.premium_name_effect),
          premium_avatar_frame: Boolean(plan.features?.premium_avatar_frame),
        },
        display_order: plan.display_order ?? 0,
        badge_color: plan.badge_color || '#4285F4',
        icon_name: plan.icon_name || 'Sparkles',
        is_popular: Boolean(plan.is_popular),
        is_active: plan.is_active !== false,
      });
      setActiveTab('info-pricing');
    } else if (!plan && open) {
      setFormData(DEFAULT_FORM_STATE);
      setActiveTab('info-pricing');
    }
  }, [plan, open]);

  // Xử lý đổi Tier: Tự động cập nhật tier_level, badge_color và icon mặc định khi tạo mới
  const handleTierChange = (e) => {
    const nextTier = e.target.value;
    const tierConfig = TIER_OPTIONS.find((t) => t.value === nextTier);

    setFormData((prev) => ({
      ...prev,
      tier: nextTier,
      tier_level: tierConfig?.defaultLevel ?? prev.tier_level,
      badge_color: !isEdit && tierConfig?.defaultColor ? tierConfig.defaultColor : prev.badge_color,
      icon_name: !isEdit && tierConfig?.defaultIcon ? tierConfig.defaultIcon : prev.icon_name,
    }));
  };

  // Helper toggle tính năng boolean
  const handleToggleFeature = (key) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: !prev.features[key],
      },
    }));
  };

  // Tự động sinh SEO slug từ Tên gói
  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => {
      const updates = { name: val };
      if (!isEdit && (!prev.slug || prev.slug === slugify(prev.name))) {
        updates.slug = slugify(val);
      }
      return { ...prev, ...updates };
    });
  };

  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên gói hội viên');
      setActiveTab('info-pricing');
      return;
    }

    if (!formData.slug.trim()) {
      toast.error('Vui lòng nhập đường dẫn SEO slug');
      setActiveTab('info-pricing');
      return;
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      tagline: formData.tagline?.trim() || null,
      description: formData.description?.trim() || null,
      price_monthly: Number(formData.price_monthly),
      price_yearly: formData.price_yearly ? Number(formData.price_yearly) : null,
      tier_level: Number(formData.tier_level),
      display_order: Number(formData.display_order),
    };

    if (isEdit) {
      updateMutation.mutate({ id: plan._id || plan.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Tính phần trăm tiết kiệm gói năm
  const yearlySavings = useMemo(() => {
    const monthlyTotal = formData.price_monthly * 12;
    if (!formData.price_yearly || monthlyTotal <= 0) return 0;
    const diff = monthlyTotal - formData.price_yearly;
    return diff > 0 ? Math.round((diff / monthlyTotal) * 100) : 0;
  }, [formData.price_monthly, formData.price_yearly]);

  const yearlyDiffAmount = useMemo(() => {
    const monthlyTotal = formData.price_monthly * 12;
    if (!formData.price_yearly || monthlyTotal <= 0) return 0;
    return Math.max(0, monthlyTotal - formData.price_yearly);
  }, [formData.price_monthly, formData.price_yearly]);

  return (
    <OffCanvas
      open={open}
      onClose={onClose}
      placement="right"
      size="large"
      variant="tonal"
      className="plan-form-drawer"
    >
      <OffCanvas.Header
        title={isEdit ? `Chỉnh Sửa Gói: ${plan.name}` : 'Tạo Gói Hội Viên VIP Mới'}
        subtitle={
          isEdit
            ? 'Cập nhật bảng giá, cấp bậc, tính năng đặc quyền và hiển thị'
            : 'Thiết lập gói dịch vụ mới phục vụ đăng ký hội viên toàn hệ thống'
        }
        onClose={onClose}
        showCloseButton
      />

      <OffCanvas.Body className="plan-form-drawer__body">
        <form id="membership-plan-form" onSubmit={handleSubmit} className="plan-form-drawer__form">
          <div className="plan-form-drawer__layout">
            {/* Thanh Tab Chức Năng */}
            <nav className="plan-form-drawer__tabs-nav" role="tablist">
              {FORM_TABS.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`plan-form-drawer__tab-btn ${
                      isActive ? 'plan-form-drawer__tab-btn--active' : ''
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <TabIcon size={15} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* ── TAB 1: THÔNG TIN & BẢNG GIÁ ── */}
            {activeTab === 'info-pricing' && (
              <div className="plan-form-drawer__tab-content">
                {/* Nhóm 1: Định danh gói */}
                <div className="plan-form-drawer__section">
                  <div className="plan-form-drawer__section-header">
                    <Layers size={16} className="plan-form-drawer__section-icon" />
                    <h4 className="plan-form-drawer__section-title">1. Định danh & Cấp bậc gói</h4>
                  </div>

                  <div className="plan-form-drawer__row">
                    <div className="plan-form-drawer__field plan-form-drawer__field--half">
                      <label className="plan-form-drawer__label">
                        Cấp bậc (Tier) <span className="plan-form-drawer__required">*</span>
                      </label>
                      <select
                        className="plan-form-drawer__select"
                        value={formData.tier}
                        onChange={handleTierChange}
                        disabled={isEdit}
                      >
                        {TIER_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <span className="plan-form-drawer__hint">
                        {isEdit ? 'Không thể đổi Tier khi đã khởi tạo gói.' : 'Tier xác định quyền lợi nền tảng.'}
                      </span>
                    </div>

                    <div className="plan-form-drawer__field plan-form-drawer__field--half">
                      <label className="plan-form-drawer__label">
                        Thứ tự cấp bậc (Tier Level) <span className="plan-form-drawer__required">*</span>
                      </label>
                      <input
                        type="number"
                        className="plan-form-drawer__input"
                        value={formData.tier_level}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, tier_level: Number(e.target.value) }))
                        }
                        min={0}
                        max={10}
                        required
                      />
                      <span className="plan-form-drawer__hint">
                        0: Miễn phí, 1: Plus, 2: Pro, 3: Ultra.
                      </span>
                    </div>
                  </div>

                  <div className="plan-form-drawer__row">
                    <div className="plan-form-drawer__field plan-form-drawer__field--half">
                      <label className="plan-form-drawer__label">
                        Tên gói hiển thị <span className="plan-form-drawer__required">*</span>
                      </label>
                      <input
                        type="text"
                        className="plan-form-drawer__input"
                        placeholder="Ví dụ: Sạp Pro"
                        value={formData.name}
                        onChange={handleNameChange}
                        required
                      />
                    </div>

                    <div className="plan-form-drawer__field plan-form-drawer__field--half">
                      <label className="plan-form-drawer__label">
                        Đường dẫn SEO (Slug) <span className="plan-form-drawer__required">*</span>
                      </label>
                      <input
                        type="text"
                        className="plan-form-drawer__input"
                        placeholder="pro"
                        value={formData.slug}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, slug: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="plan-form-drawer__field">
                    <label className="plan-form-drawer__label">Khẩu hiệu ngắn (Tagline)</label>
                    <input
                      type="text"
                      className="plan-form-drawer__input"
                      placeholder="Ví dụ: Trải nghiệm đỉnh cao không giới hạn"
                      value={formData.tagline}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, tagline: e.target.value }))
                      }
                    />
                  </div>

                  <div className="plan-form-drawer__field">
                    <label className="plan-form-drawer__label">Mô tả chi tiết gói</label>
                    <textarea
                      className="plan-form-drawer__textarea"
                      rows={2}
                      placeholder="Mô tả các đặc quyền VIP nổi bật dành cho người dùng..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Nhóm 2: Chính sách giá */}
                <div className="plan-form-drawer__section">
                  <div className="plan-form-drawer__section-header">
                    <DollarSign size={16} className="plan-form-drawer__section-icon" />
                    <h4 className="plan-form-drawer__section-title">2. Chính sách giá & Chu kỳ thuê</h4>
                  </div>

                  <div className="plan-form-drawer__row">
                    <div className="plan-form-drawer__field plan-form-drawer__field--half">
                      <label className="plan-form-drawer__label">
                        Giá theo Tháng (VND) <span className="plan-form-drawer__required">*</span>
                      </label>
                      <input
                        type="number"
                        className="plan-form-drawer__input"
                        value={formData.price_monthly}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            price_monthly: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        min={0}
                        step={1000}
                        required
                      />
                      <span className="plan-form-drawer__hint">
                        {formatCurrency(formData.price_monthly)} / tháng
                      </span>
                    </div>

                    <div className="plan-form-drawer__field plan-form-drawer__field--half">
                      <label className="plan-form-drawer__label">Giá theo Năm (VND)</label>
                      <input
                        type="number"
                        className="plan-form-drawer__input"
                        placeholder="Để trống nếu không áp dụng"
                        value={formData.price_yearly || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            price_yearly: e.target.value ? Math.max(0, Number(e.target.value)) : null,
                          }))
                        }
                        min={0}
                        step={1000}
                      />
                      <span className="plan-form-drawer__hint">
                        {formData.price_yearly
                          ? `${formatCurrency(formData.price_yearly)} / năm`
                          : 'Chưa thiết lập gói năm'}
                      </span>
                    </div>
                  </div>

                  {/* Banner tính toán tiết kiệm */}
                  {Boolean(formData.price_yearly && yearlySavings > 0) && (
                    <div className="plan-form-drawer__savings-banner">
                      <span className="savings-label">
                        Đăng ký năm tiết kiệm: <strong>{formatCurrency(yearlyDiffAmount)}</strong> so với thanh toán từng tháng
                      </span>
                      <span className="savings-value">Tiết kiệm ~{yearlySavings}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 2: ĐẶC QUYỀN & GIỚI HẠN (DYNAMIC ENTITLEMENTS) ── */}
            {activeTab === 'entitlements' && (
              <div className="plan-form-drawer__tab-content">
                {/* Nhóm 1: Giới hạn tài nguyên */}
                <div className="plan-form-drawer__section">
                  <div className="plan-form-drawer__section-header">
                    <Tv size={16} className="plan-form-drawer__section-icon" />
                    <h4 className="plan-form-drawer__section-title">1. Giới hạn tài nguyên kỹ thuật</h4>
                  </div>

                  <div className="plan-form-drawer__row">
                    <div className="plan-form-drawer__field plan-form-drawer__field--third">
                      <label className="plan-form-drawer__label">Độ phân giải tối đa</label>
                      <select
                        className="plan-form-drawer__select"
                        value={formData.features.max_quality}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            features: { ...prev.features, max_quality: e.target.value },
                          }))
                        }
                      >
                        {QUALITY_OPTIONS.map((q) => (
                          <option key={q.value} value={q.value}>
                            {q.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="plan-form-drawer__field plan-form-drawer__field--third">
                      <label className="plan-form-drawer__label">Luồng xem đồng thời</label>
                      <input
                        type="number"
                        className="plan-form-drawer__input"
                        value={formData.features.max_devices}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            features: { ...prev.features, max_devices: Math.max(1, Number(e.target.value)) },
                          }))
                        }
                        min={1}
                        max={20}
                      />
                    </div>

                    <div className="plan-form-drawer__field plan-form-drawer__field--third">
                      <label className="plan-form-drawer__label">Khách Watch Together</label>
                      <input
                        type="number"
                        className="plan-form-drawer__input"
                        value={formData.features.watch_together_limit}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            features: {
                              ...prev.features,
                              watch_together_limit: Math.max(0, Number(e.target.value)),
                            },
                          }))
                        }
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>
                </div>

                {/* Nhóm 2: Danh sách đặc quyền VIP (List-based Rows) */}
                <div className="plan-form-drawer__section">
                  <div className="plan-form-drawer__section-header">
                    <Shield size={16} className="plan-form-drawer__section-icon" />
                    <h4 className="plan-form-drawer__section-title">2. Danh sách quyền lợi VIP đặc quyền</h4>
                  </div>

                  <div className="plan-form-drawer__entitlements-list">
                    {/* Item 1 */}
                    <div className={`plan-form-drawer__entitlement-item ${formData.features.offline_download ? 'plan-form-drawer__entitlement-item--active' : ''}`}>
                      <div className="plan-form-drawer__entitlement-left">
                        <div className="plan-form-drawer__entitlement-icon">
                          <Download size={18} />
                        </div>
                        <div className="plan-form-drawer__entitlement-meta">
                          <span className="plan-form-drawer__entitlement-title">Tải phim xem Offline</span>
                          <span className="plan-form-drawer__entitlement-desc">Cho phép tải phim chất lượng cao về thiết bị xem ngoại tuyến</span>
                        </div>
                      </div>
                      <Switch
                        checked={formData.features.offline_download}
                        onChange={() => handleToggleFeature('offline_download')}
                        size="small"
                      />
                    </div>

                    {/* Item 2 */}
                    <div className={`plan-form-drawer__entitlement-item ${formData.features.priority_support ? 'plan-form-drawer__entitlement-item--active' : ''}`}>
                      <div className="plan-form-drawer__entitlement-left">
                        <div className="plan-form-drawer__entitlement-icon">
                          <Headphones size={18} />
                        </div>
                        <div className="plan-form-drawer__entitlement-meta">
                          <span className="plan-form-drawer__entitlement-title">Ưu tiên hỗ trợ 24/7</span>
                          <span className="plan-form-drawer__entitlement-desc">Được chuyên viên VIP chăm sóc và giải đáp thắc mắc tức thì</span>
                        </div>
                      </div>
                      <Switch
                        checked={formData.features.priority_support}
                        onChange={() => handleToggleFeature('priority_support')}
                        size="small"
                      />
                    </div>

                    {/* Item 3 */}
                    <div className={`plan-form-drawer__entitlement-item ${formData.features.custom_avatar ? 'plan-form-drawer__entitlement-item--active' : ''}`}>
                      <div className="plan-form-drawer__entitlement-left">
                        <div className="plan-form-drawer__entitlement-icon">
                          <Star size={18} />
                        </div>
                        <div className="plan-form-drawer__entitlement-meta">
                          <span className="plan-form-drawer__entitlement-title">Avatar tùy biến cao cấp</span>
                          <span className="plan-form-drawer__entitlement-desc">Mở khóa kho ảnh đại diện động và huy hiệu VIP độc quyền</span>
                        </div>
                      </div>
                      <Switch
                        checked={formData.features.custom_avatar}
                        onChange={() => handleToggleFeature('custom_avatar')}
                        size="small"
                      />
                    </div>

                    {/* Item 4 */}
                    <div className={`plan-form-drawer__entitlement-item ${formData.features.custom_cover ? 'plan-form-drawer__entitlement-item--active' : ''}`}>
                      <div className="plan-form-drawer__entitlement-left">
                        <div className="plan-form-drawer__entitlement-icon">
                          <Palette size={18} />
                        </div>
                        <div className="plan-form-drawer__entitlement-meta">
                          <span className="plan-form-drawer__entitlement-title">Ảnh bìa profile tùy biến</span>
                          <span className="plan-form-drawer__entitlement-desc">Cá nhân hóa trang hồ sơ cá nhân với ảnh bìa điện ảnh phong cách</span>
                        </div>
                      </div>
                      <Switch
                        checked={formData.features.custom_cover}
                        onChange={() => handleToggleFeature('custom_cover')}
                        size="small"
                      />
                    </div>

                    {/* Item 5 */}
                    <div className={`plan-form-drawer__entitlement-item ${formData.features.permanent_storage ? 'plan-form-drawer__entitlement-item--active' : ''}`}>
                      <div className="plan-form-drawer__entitlement-left">
                        <div className="plan-form-drawer__entitlement-icon">
                          <Shield size={18} />
                        </div>
                        <div className="plan-form-drawer__entitlement-meta">
                          <span className="plan-form-drawer__entitlement-title">Lưu trữ phim vĩnh viễn</span>
                          <span className="plan-form-drawer__entitlement-desc">Danh sách phim yêu thích & xem sau không bao giờ bị giới hạn số lượng</span>
                        </div>
                      </div>
                      <Switch
                        checked={formData.features.permanent_storage}
                        onChange={() => handleToggleFeature('permanent_storage')}
                        size="small"
                      />
                    </div>

                    {/* Item 6 */}
                    <div className={`plan-form-drawer__entitlement-item ${formData.features.premium_name_effect ? 'plan-form-drawer__entitlement-item--active' : ''}`}>
                      <div className="plan-form-drawer__entitlement-left">
                        <div className="plan-form-drawer__entitlement-icon">
                          <Sparkles size={18} />
                        </div>
                        <div className="plan-form-drawer__entitlement-meta">
                          <span className="plan-form-drawer__entitlement-title">Hiệu ứng tên VIP phát sáng</span>
                          <span className="plan-form-drawer__entitlement-desc">Tên tài khoản hiển thị hiệu ứng gradient sáng động trong bình luận & chat</span>
                        </div>
                      </div>
                      <Switch
                        checked={formData.features.premium_name_effect}
                        onChange={() => handleToggleFeature('premium_name_effect')}
                        size="small"
                      />
                    </div>

                    {/* Item 7 */}
                    <div className={`plan-form-drawer__entitlement-item ${formData.features.premium_avatar_frame ? 'plan-form-drawer__entitlement-item--active' : ''}`}>
                      <div className="plan-form-drawer__entitlement-left">
                        <div className="plan-form-drawer__entitlement-icon">
                          <Crown size={18} />
                        </div>
                        <div className="plan-form-drawer__entitlement-meta">
                          <span className="plan-form-drawer__entitlement-title">Khung viền Avatar độc quyền</span>
                          <span className="plan-form-drawer__entitlement-desc">Khung viền mạ vàng vương miện bao quanh ảnh đại diện</span>
                        </div>
                      </div>
                      <Switch
                        checked={formData.features.premium_avatar_frame}
                        onChange={() => handleToggleFeature('premium_avatar_frame')}
                        size="small"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: THƯƠNG HIỆU & HIỂN THỊ ── */}
            {activeTab === 'branding-display' && (
              <div className="plan-form-drawer__tab-content">
                {/* Nhóm 1: Icon đại diện */}
                <div className="plan-form-drawer__section">
                  <div className="plan-form-drawer__section-header">
                    <Sparkles size={16} className="plan-form-drawer__section-icon" />
                    <h4 className="plan-form-drawer__section-title">1. Biểu tượng đại diện (Badge Icon)</h4>
                  </div>

                    <div className="plan-form-drawer__icon-grid">
                      {PRESET_ICONS.map((item) => {
                        const IconComponent = item.icon;
                        const isSelected = formData.icon_name === item.name;
                        return (
                          <button
                            key={item.name}
                            type="button"
                            className={`plan-form-drawer__icon-tile ${
                              isSelected ? 'plan-form-drawer__icon-tile--active' : ''
                            }`}
                            onClick={() =>
                              setFormData((prev) => ({ ...prev, icon_name: item.name }))
                            }
                          >
                            <IconComponent size={20} />
                            <span className="tile-label">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                </div>

                {/* Nhóm 2: Màu sắc thương hiệu */}
                <div className="plan-form-drawer__section">
                  <div className="plan-form-drawer__section-header">
                    <Palette size={16} className="plan-form-drawer__section-icon" />
                    <h4 className="plan-form-drawer__section-title">2. Màu sắc thương hiệu (Badge Color)</h4>
                  </div>

                  <div className="plan-form-drawer__color-row">
                    <div className="plan-form-drawer__color-swatches">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`plan-form-drawer__color-swatch ${
                            formData.badge_color.toUpperCase() === color.toUpperCase()
                              ? 'plan-form-drawer__color-swatch--active'
                              : ''
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, badge_color: color }))
                          }
                          title={color}
                        />
                      ))}
                    </div>

                    <div className="plan-form-drawer__color-hex-field">
                      <div
                        className="color-preview-circle"
                        style={{ backgroundColor: formData.badge_color }}
                      />
                      <input
                        type="text"
                        className="plan-form-drawer__input color-hex-input"
                        value={formData.badge_color}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, badge_color: e.target.value }))
                        }
                        maxLength={7}
                        placeholder="#FF6D00"
                      />
                    </div>
                  </div>
                </div>

                {/* Nhóm 3: Cài đặt hiển thị & Kinh doanh */}
                <div className="plan-form-drawer__section">
                  <div className="plan-form-drawer__section-header">
                    <Layers size={16} className="plan-form-drawer__section-icon" />
                    <h4 className="plan-form-drawer__section-title">3. Cài đặt hiển thị & Kinh doanh</h4>
                  </div>

                  <div className="plan-form-drawer__settings-list">
                    {/* Thứ tự hiển thị */}
                    <div className="plan-form-drawer__setting-row">
                      <div className="plan-form-drawer__setting-info">
                        <span className="plan-form-drawer__setting-title">Thứ tự hiển thị trên website</span>
                        <span className="plan-form-drawer__setting-desc">Số nhỏ hơn sẽ được ưu tiên xếp trước trong bảng giá</span>
                      </div>
                      <input
                        type="number"
                        className="plan-form-drawer__input"
                        style={{ width: 80, textAlign: 'center' }}
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            display_order: Number(e.target.value),
                          }))
                        }
                        min={0}
                      />
                    </div>

                    {/* Đánh dấu gói phổ biến */}
                    <div className="plan-form-drawer__setting-row">
                      <div className="plan-form-drawer__setting-info">
                        <span className="plan-form-drawer__setting-title">Gắn nhãn &quot;Gói Phổ Biến Nhất&quot;</span>
                        <span className="plan-form-drawer__setting-desc">Làm nổi bật thẻ giá với dải băng rôn vàng cam và viền phát sáng</span>
                      </div>
                      <Switch
                        checked={formData.is_popular}
                        onChange={() =>
                          setFormData((prev) => ({ ...prev, is_popular: !prev.is_popular }))
                        }
                        size="small"
                      />
                    </div>

                    {/* Mở bán gói */}
                    <div className="plan-form-drawer__setting-row">
                      <div className="plan-form-drawer__setting-info">
                        <span className="plan-form-drawer__setting-title">Mở bán gói (Kích hoạt)</span>
                        <span className="plan-form-drawer__setting-desc">Cho phép khách hàng nhìn thấy và đăng ký gói hội viên này</span>
                      </div>
                      <Switch
                        checked={formData.is_active}
                        onChange={() =>
                          setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))
                        }
                        size="small"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>
      </OffCanvas.Body>

      <OffCanvas.Footer className="plan-form-drawer__footer">
        <Button variant="outlined" size="medium" onClick={onClose} disabled={isSubmitting}>
          Hủy bỏ
        </Button>
        <Button
          variant="filled"
          size="medium"
          color="primary"
          form="membership-plan-form"
          type="submit"
          startIcon={<Save size={16} />}
          loading={isSubmitting}
        >
          {isEdit ? 'Lưu Thay Đổi' : 'Tạo Gói Mới'}
        </Button>
      </OffCanvas.Footer>
    </OffCanvas>
  );
};

MembershipPlanFormDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  plan: PropTypes.object,
};

export default MembershipPlanFormDrawer;
