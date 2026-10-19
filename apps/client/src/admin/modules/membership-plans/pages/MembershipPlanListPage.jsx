/**
 * @file MembershipPlanListPage.jsx
 * @module Admin/Modules/MembershipPlans/Pages/MembershipPlanListPage
 * @description Quản lý bảng giá, thời hạn và quyền lợi các gói hội viên VIP chuẩn Material 3 Expressive & Obsidian Cinema.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Crown,
  Sparkles,
  Gem,
  Zap,
  Star,
  Info,
  Plus,
  RotateCcw,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Tv,
  Users,
  Download,
  Flame,
  Search,
  X,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/admin/shared/components/layout/page-header/PageHeader';
import { AdminFilterToolbar } from '@/admin/shared/components/layout/filter-toolbar';
import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import Badge from '@/shared/components/ui/badge';
import Switch from '@/shared/components/ui/switch';
import Select from '@/shared/components/ui/select';
import Tooltip from '@/shared/components/ui/tooltip';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';

import {
  useAdminMembershipPlansQuery,
  useAdminSubscriptionStatsQuery,
} from '@/hooks/queries/use-subscription.queries';
import {
  useAdminUpdatePlanMutation,
  useAdminDeletePlanMutation,
} from '@/hooks/mutations/use-subscription.mutations';

import { MembershipPlanFormDrawer } from '../components';
import './membership-plan-list-page.scss';

// ── Icon Map ──
const ICON_MAP = {
  Crown,
  Sparkles,
  Gem,
  Zap,
  Star,
  Info,
};

// ── Status Tabs ──
const STATUS_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang mở bán' },
  { id: 'inactive', label: 'Tạm ngưng' },
];

// ── Tier Filter Options ──
const TIER_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả cấp độ (Tier)' },
  { value: 'free', label: 'Miễn phí (Free)' },
  { value: 'plus', label: 'Gói Cơ bản (Plus)' },
  { value: 'pro', label: 'Gói Nâng cao (Pro)' },
  { value: 'ultra', label: 'Gói Cao cấp (Ultra)' },
];

// ── Quality Map ──
const QUALITY_MAP = {
  sd: 'SD (480p)',
  hd: 'HD (720p)',
  full_hd: 'Full HD (1080p)',
  '2k': '2K QHD (1440p)',
  '4k': '4K Ultra HD (2160p)',
};

/**
 * Format tiền tệ VND
 * @param {number|string} amount
 * @returns {string}
 */
const formatCurrency = (amount) => {
  const num = Number(amount);
  if (isNaN(num) || num <= 0) return '0 ₫';
  return `${new Intl.NumberFormat('vi-VN').format(num)} ₫`;
};

export const MembershipPlanListPage = () => {
  // ── Local State ──
  const [activeTab, setActiveTab] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedTier, setSelectedTier] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    content: '',
    confirmText: '',
    type: 'danger',
    onConfirm: () => {},
  });

  // ── Queries & Mutations ──
  const queryParams = useMemo(() => {
    const params = {};
    if (activeTab === 'active') params.is_active = true;
    if (activeTab === 'inactive') params.is_active = false;
    if (selectedTier !== 'all') params.tier = selectedTier;
    if (searchKeyword.trim()) params.search = searchKeyword.trim();
    return params;
  }, [activeTab, selectedTier, searchKeyword]);

  const {
    data: plansData,
    isLoading: isPlansLoading,
    isRefetching,
    refetch,
  } = useAdminMembershipPlansQuery(queryParams);

  const { data: statsData } = useAdminSubscriptionStatsQuery();

  const updatePlanMutation = useAdminUpdatePlanMutation();
  const deletePlanMutation = useAdminDeletePlanMutation();

  // ── Extracted Data ──
  const rawPlans = useMemo(() => {
    return plansData?.items || plansData?.data || (Array.isArray(plansData) ? plansData : []);
  }, [plansData]);

  const counts = useMemo(() => {
    if (plansData?.counts) return plansData.counts;
    const all = rawPlans.length;
    const active = rawPlans.filter((p) => p.is_active).length;
    const inactive = all - active;
    return { all, active, inactive };
  }, [plansData?.counts, rawPlans]);

  // Client search filter (nếu backend chưa search full text)
  const filteredPlans = useMemo(() => {
    let result = [...rawPlans];

    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(kw) ||
          p.tier?.toLowerCase().includes(kw) ||
          p.slug?.toLowerCase().includes(kw) ||
          p.description?.toLowerCase().includes(kw)
      );
    }

    if (selectedTier !== 'all') {
      result = result.filter((p) => p.tier === selectedTier);
    }

    if (activeTab === 'active') {
      result = result.filter((p) => p.is_active);
    } else if (activeTab === 'inactive') {
      result = result.filter((p) => !p.is_active);
    }

    return result;
  }, [rawPlans, searchKeyword, selectedTier, activeTab]);

  // ── Popular Plan Name for KPI ──
  const popularPlanName = useMemo(() => {
    const pop = rawPlans.find((p) => p.is_popular);
    return pop ? pop.name : 'Sạp Pro (Mặc định)';
  }, [rawPlans]);

  // ── Handlers ──
  const handleOpenCreate = () => {
    setEditingPlan(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (plan) => {
    setEditingPlan(plan);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingPlan(null);
  };

  const handleToggleActive = async (plan) => {
    const targetStatus = !plan.is_active;
    try {
      await updatePlanMutation.mutateAsync({
        id: plan._id || plan.id,
        data: { is_active: targetStatus },
      });
      toast.success(
        targetStatus
          ? `Đã mở bán gói "${plan.name}" thành công!`
          : `Đã tạm ngưng bán gói "${plan.name}"!`
      );
    } catch (error) {
      toast.error(error?.message || 'Không thể thay đổi trạng thái gói');
    }
  };

  const handleDeletePlan = (plan) => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Ngưng kinh doanh gói hội viên',
      content: `Bạn có chắc chắn muốn ngưng kinh doanh gói "${plan.name}"? Người dùng sẽ không thể đăng ký mới gói này, tuy nhiên người đang sở hữu vẫn sẽ được hưởng quyền lợi đến khi hết hạn.`,
      confirmText: 'Xác nhận ngưng bán',
      onConfirm: async () => {
        try {
          await deletePlanMutation.mutateAsync(plan._id || plan.id);
          toast.success(`Đã ngưng kinh doanh gói "${plan.name}"!`);
          setConfirmModal((prev) => ({ ...prev, open: false }));
        } catch (error) {
          toast.error(error?.message || 'Không thể ngưng kinh doanh gói');
        }
      },
    });
  };

  const handleRefresh = useCallback(() => {
    refetch();
    toast.success('Đã cập nhật danh sách gói hội viên!');
  }, [refetch]);

  return (
    <div className="membership-plan-admin-page">
      {/* 1. Page Header */}
      <PageHeader
        title="Quản Lý Gói Hội Viên VIP"
        subtitle="Cấu hình bảng giá, thời hạn, quyền lợi đặc quyền và quản lý mở bán các gói thành viên Sạp Phim."
        badge={`${counts.all || rawPlans.length} gói hội viên`}
        badgeVariant="primary"
        actions={
          <div className="membership-plan-admin-page__header-actions">
            <Tooltip content="Làm mới dữ liệu" position="bottom">
              <IconButton
                variant="outlined"
                color="default"
                size="medium"
                onClick={handleRefresh}
                loading={isRefetching}
              >
                <RotateCcw size={16} />
              </IconButton>
            </Tooltip>
            <Button
              variant="filled"
              color="primary"
              size="medium"
              startIcon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              Tạo Gói Mới
            </Button>
          </div>
        }
      />

      {/* 2. KPI Metrics Grid */}
      <div className="membership-plan-admin-page__kpi-grid">
        <div className="membership-plan-admin-page__kpi-card membership-plan-admin-page__kpi-card--primary">
          <div className="membership-plan-admin-page__kpi-icon">
            <Layers size={22} />
          </div>
          <div className="membership-plan-admin-page__kpi-info">
            <span className="membership-plan-admin-page__kpi-label">Tổng gói dịch vụ</span>
            <span className="membership-plan-admin-page__kpi-value">{counts.all}</span>
            <span className="membership-plan-admin-page__kpi-desc">Cấu hình phân cấp hội viên</span>
          </div>
        </div>

        <div className="membership-plan-admin-page__kpi-card membership-plan-admin-page__kpi-card--success">
          <div className="membership-plan-admin-page__kpi-icon">
            <CheckCircle2 size={22} />
          </div>
          <div className="membership-plan-admin-page__kpi-info">
            <span className="membership-plan-admin-page__kpi-label">Gói đang mở bán</span>
            <span className="membership-plan-admin-page__kpi-value">{counts.active}</span>
            <span className="membership-plan-admin-page__kpi-desc">Hiển thị cho khách hàng</span>
          </div>
        </div>

        <div className="membership-plan-admin-page__kpi-card membership-plan-admin-page__kpi-card--accent">
          <div className="membership-plan-admin-page__kpi-icon">
            <Users size={22} />
          </div>
          <div className="membership-plan-admin-page__kpi-info">
            <span className="membership-plan-admin-page__kpi-label">Thuê bao VIP Active</span>
            <span className="membership-plan-admin-page__kpi-value">
              {statsData?.active_subscriptions || 0}
            </span>
            <span className="membership-plan-admin-page__kpi-desc">Đang lưu hành</span>
          </div>
        </div>

        <div className="membership-plan-admin-page__kpi-card membership-plan-admin-page__kpi-card--warning">
          <div className="membership-plan-admin-page__kpi-icon">
            <Flame size={22} />
          </div>
          <div className="membership-plan-admin-page__kpi-info">
            <span className="membership-plan-admin-page__kpi-label">Gói phổ biến nhất</span>
            <span className="membership-plan-admin-page__kpi-value">{popularPlanName}</span>
            <span className="membership-plan-admin-page__kpi-desc">Được gắn nhãn Khuyên dùng</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar & Search */}
      <AdminFilterToolbar
        tabs={STATUS_TABS}
        activeTab={activeTab}
        counts={counts}
        onTabChange={setActiveTab}
      >
        <div className="membership-plan-admin-page__toolbar-filters">
          <div className="membership-plan-admin-page__search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm gói theo tên, slug, tier..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            {searchKeyword && (
              <button
                type="button"
                className="clear-btn"
                onClick={() => setSearchKeyword('')}
                title="Xóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <Select
            options={TIER_FILTER_OPTIONS}
            value={selectedTier}
            onChange={(val) => setSelectedTier(val)}
            placeholder="Lọc theo cấp độ"
            size="medium"
          />
        </div>
      </AdminFilterToolbar>

      {/* 4. Pricing Cards Grid */}
      {isPlansLoading ? (
        <div className="membership-plan-admin-page__pricing-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="membership-plan-admin-page__skeleton-card" />
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="membership-plan-admin-page__empty-state">
          <div className="empty-icon-wrapper">
            <Crown size={32} />
          </div>
          <h3 className="empty-title">Không tìm thấy gói hội viên nào</h3>
          <p className="empty-desc">
            Không có gói hội viên nào phù hợp với bộ lọc hiện tại. Bạn có thể thử tìm kiếm từ khóa
            khác hoặc tạo gói mới.
          </p>
          <Button
            variant="outlined"
            size="medium"
            onClick={() => {
              setActiveTab('all');
              setSearchKeyword('');
              setSelectedTier('all');
            }}
          >
            Đặt lại bộ lọc
          </Button>
        </div>
      ) : (
        <div className="membership-plan-admin-page__pricing-grid">
          {filteredPlans.map((plan) => {
            const planIconName = plan.icon_name || plan.badge_icon || 'Crown';
            const IconComponent = ICON_MAP[planIconName] || Crown;
            const badgeColor = plan.badge_color || '#FF6D00';
            const isPopular = Boolean(plan.is_popular);
            const monthlyPrice = Number(plan.price_monthly) || 0;
            const yearlyPrice = Number(plan.price_yearly) || 0;
            const isFree = plan.tier === 'free' || monthlyPrice === 0;

            const qualityText =
              QUALITY_MAP[plan.features?.max_quality] ||
              plan.features?.max_quality ||
              plan.max_resolution ||
              'Full HD (1080p)';
            const maxDevices = plan.features?.max_devices ?? plan.max_parallel_streams ?? 1;
            const allowDownload = Boolean(
              plan.features?.offline_download ?? plan.max_download_devices > 0
            );
            const hasAds = plan.tier === 'free' || plan.features?.has_ads === true;
            const watchLimit = plan.features?.watch_together_limit ?? 2;

            const yearlySavingsPercent =
              yearlyPrice > 0 && monthlyPrice > 0
                ? Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100)
                : 0;

            return (
              <div
                key={plan.id || plan._id}
                className={`membership-plan-admin-page__plan-card ${
                  isPopular ? 'membership-plan-admin-page__plan-card--popular' : ''
                } ${!plan.is_active ? 'membership-plan-admin-page__plan-card--inactive' : ''}`}
              >
                {/* Popular Ribbon */}
                {isPopular && (
                  <div className="membership-plan-admin-page__plan-popular-ribbon">
                    <Flame size={13} />
                    <span>Gói Khuyên Dùng • Phổ Biến Nhất</span>
                  </div>
                )}

                {/* Card Header */}
                <div className="membership-plan-admin-page__plan-header">
                  <div className="membership-plan-admin-page__plan-top-row">
                    <div
                      className="membership-plan-admin-page__plan-icon-wrapper"
                      style={{
                        backgroundColor: `${badgeColor}18`,
                        color: badgeColor,
                        borderColor: `${badgeColor}35`,
                      }}
                    >
                      <IconComponent size={22} />
                    </div>

                    <div className="membership-plan-admin-page__plan-badges">
                      {plan.is_active ? (
                        <Badge variant="success" size="small">
                          Đang mở bán
                        </Badge>
                      ) : (
                        <Badge variant="default" size="small">
                          Tạm ngưng
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="membership-plan-admin-page__plan-identity">
                    <span className="membership-plan-admin-page__plan-tier-code">
                      CẤP ĐỘ: {plan.tier}
                    </span>
                    <h3 className="membership-plan-admin-page__plan-title">{plan.name}</h3>
                  </div>

                  <p className="membership-plan-admin-page__plan-tagline">
                    {plan.tagline || plan.description || 'Trải nghiệm giải trí chuẩn điện ảnh cao cấp'}
                  </p>
                </div>

                {/* Card Price Block */}
                <div className="membership-plan-admin-page__plan-price-block">
                  <div className="membership-plan-admin-page__plan-price-row">
                    <span
                      className={`membership-plan-admin-page__plan-price-amount ${
                        isFree ? 'membership-plan-admin-page__plan-price-amount--free' : ''
                      }`}
                    >
                      {isFree ? 'Miễn phí' : formatCurrency(monthlyPrice)}
                    </span>
                    {!isFree && (
                      <span className="membership-plan-admin-page__plan-price-cycle">/ tháng</span>
                    )}
                  </div>

                  {!isFree && yearlyPrice > 0 && (
                    <div className="membership-plan-admin-page__plan-yearly-discount">
                      <span>Theo năm:</span>
                      <span className="yearly-price">{formatCurrency(yearlyPrice)}</span>
                      {yearlySavingsPercent > 0 && (
                        <span className="discount-pill">
                          Tiết kiệm {yearlySavingsPercent}%
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Body - Specs & Perks */}
                <div className="membership-plan-admin-page__plan-body">
                  <div className="membership-plan-admin-page__plan-specs-grid">
                    <div className="membership-plan-admin-page__plan-spec-item">
                      <Tv size={15} className="spec-icon" />
                      <div className="spec-text">
                        <span className="spec-title">Chất lượng tối đa</span>
                        <span className="spec-value">{qualityText}</span>
                      </div>
                    </div>

                    <div className="membership-plan-admin-page__plan-spec-item">
                      <Users size={15} className="spec-icon" />
                      <div className="spec-text">
                        <span className="spec-title">Xem đồng thời</span>
                        <span className="spec-value">
                          {maxDevices} thiết bị
                        </span>
                      </div>
                    </div>

                    <div className="membership-plan-admin-page__plan-spec-item">
                      <Download size={15} className="spec-icon" />
                      <div className="spec-text">
                        <span className="spec-title">Tải ngoại tuyến</span>
                        <span className="spec-value">
                          {allowDownload ? 'Hỗ trợ tải' : 'Không hỗ trợ'}
                        </span>
                      </div>
                    </div>

                    <div className="membership-plan-admin-page__plan-spec-item">
                      <Sparkles size={15} className="spec-icon" />
                      <div className="spec-text">
                        <span className="spec-title">Quảng cáo</span>
                        <span className="spec-value">
                          {hasAds ? 'Có quảng cáo' : 'Không quảng cáo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Danh sách đặc quyền căn cứ theo cấu hình features thực tế */}
                  <ul className="membership-plan-admin-page__plan-perks-list">
                    {isFree ? (
                      <>
                        <li className="membership-plan-admin-page__plan-perk-item">
                          <CheckCircle2 size={15} className="perk-check" />
                          <span>Xem toàn bộ phim cơ bản miễn phí</span>
                        </li>
                        <li className="membership-plan-admin-page__plan-perk-item">
                          <CheckCircle2 size={15} className="perk-check" />
                          <span>Phòng Watch Together tối đa {watchLimit} khách</span>
                        </li>
                        <li className="membership-plan-admin-page__plan-perk-item membership-plan-admin-page__plan-perk-item--disabled">
                          <XCircle size={15} className="perk-cross" />
                          <span>Không hỗ trợ tải phim xem Offline</span>
                        </li>
                        <li className="membership-plan-admin-page__plan-perk-item membership-plan-admin-page__plan-perk-item--disabled">
                          <XCircle size={15} className="perk-cross" />
                          <span>Có chèn quảng cáo trong khi phát phim</span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="membership-plan-admin-page__plan-perk-item">
                          <CheckCircle2 size={15} className="perk-check" />
                          <span>Xem toàn bộ kho phim bom tấn & VIP không quảng cáo</span>
                        </li>

                        {allowDownload && (
                          <li className="membership-plan-admin-page__plan-perk-item">
                            <CheckCircle2 size={15} className="perk-check" />
                            <span>Tải phim xem Offline mọi lúc, mọi nơi</span>
                          </li>
                        )}

                        {plan.features?.priority_support && (
                          <li className="membership-plan-admin-page__plan-perk-item">
                            <CheckCircle2 size={15} className="perk-check" />
                            <span>Hỗ trợ kỹ thuật VIP ưu tiên 24/7</span>
                          </li>
                        )}

                        {watchLimit > 0 && (
                          <li className="membership-plan-admin-page__plan-perk-item">
                            <CheckCircle2 size={15} className="perk-check" />
                            <span>Phòng Watch Together tối đa {watchLimit} người</span>
                          </li>
                        )}

                        {plan.features?.custom_avatar && (
                          <li className="membership-plan-admin-page__plan-perk-item">
                            <CheckCircle2 size={15} className="perk-check" />
                            <span>Mở khóa Avatar & biểu cảm độc quyền</span>
                          </li>
                        )}

                        {plan.features?.custom_cover && (
                          <li className="membership-plan-admin-page__plan-perk-item">
                            <CheckCircle2 size={15} className="perk-check" />
                            <span>Tùy biến ảnh bìa trang hồ sơ cá nhân</span>
                          </li>
                        )}

                        {plan.features?.permanent_storage && (
                          <li className="membership-plan-admin-page__plan-perk-item">
                            <CheckCircle2 size={15} className="perk-check" />
                            <span>Lưu trữ phim yêu thích vĩnh viễn</span>
                          </li>
                        )}

                        {plan.features?.premium_name_effect && (
                          <li className="membership-plan-admin-page__plan-perk-item">
                            <CheckCircle2 size={15} className="perk-check" />
                            <span>Tên VIP phát sáng neon trong bình luận</span>
                          </li>
                        )}

                        {plan.features?.premium_avatar_frame && (
                          <li className="membership-plan-admin-page__plan-perk-item">
                            <CheckCircle2 size={15} className="perk-check" />
                            <span>Khung viền mạ vàng độc quyền quanh avatar</span>
                          </li>
                        )}
                      </>
                    )}
                  </ul>
                </div>

                {/* Card Footer Actions */}
                <div className="membership-plan-admin-page__plan-footer">
                  <div className="membership-plan-admin-page__plan-switch-group">
                    <Switch
                      checked={Boolean(plan.is_active)}
                      onChange={() => handleToggleActive(plan)}
                      size="small"
                    />
                    <span className="switch-label">
                      {plan.is_active ? 'Đang bán' : 'Tạm tắt'}
                    </span>
                  </div>

                  <div className="membership-plan-admin-page__plan-actions">
                    <Tooltip content="Chỉnh sửa cấu hình gói" position="top">
                      <Button
                        variant="tonal"
                        size="small"
                        startIcon={<Edit size={14} />}
                        onClick={() => handleOpenEdit(plan)}
                      >
                        Sửa
                      </Button>
                    </Tooltip>

                    {plan.tier !== 'free' && (
                      <Tooltip content="Ngưng kinh doanh gói này" position="top">
                        <IconButton
                          variant="standard"
                          color="danger"
                          size="small"
                          onClick={() => handleDeletePlan(plan)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Create / Edit Form Drawer */}
      <MembershipPlanFormDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        plan={editingPlan}
      />

      {/* 6. Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        type={confirmModal.type}
        title={confirmModal.title}
        content={confirmModal.content}
        confirmText={confirmModal.confirmText}
        cancelText="Hủy bỏ"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};

export default MembershipPlanListPage;
