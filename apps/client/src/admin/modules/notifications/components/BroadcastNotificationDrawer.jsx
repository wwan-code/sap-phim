/**
 * @file BroadcastNotificationDrawer.jsx
 * @module Admin/Modules/Notifications/Components/BroadcastNotificationDrawer
 * @description Drawer tạo và phát sóng thông báo hệ thống chuẩn Material 3 Expressive, tích hợp Live Preview và Preset Templates.
 */

import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Send,
  Sparkles,
  Globe,
  Users,
  User,
  Bell,
  AlertTriangle,
  Flame,
  Film,
  Shield,
  ExternalLink,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';

import OffCanvas from '@/shared/components/ui/off-canvas';
import Button from '@/shared/components/ui/button';
import Badge from '@/shared/components/ui/badge';
import { useCreateNotificationMutation } from '@/hooks/mutations/use-notification.mutations';
import { ROLES } from '@/shared/constants/roles.constants';

import './broadcast-notification-drawer.scss';

// ── Preset Templates ──
const NOTIFICATION_TEMPLATES = [
  {
    id: 'system_maintenance',
    name: 'Bảo trì hệ thống',
    icon: '🔧',
    type: 'system',
    priority: 'high',
    title: 'Bảo trì nâng cấp hệ thống máy chủ',
    message: 'Hệ thống Sạp Phim sẽ tạm dừng phục vụ trong 30 phút để nâng cấp hạ tầng mạng. Xin lỗi bạn vì sự bất tiện này.',
    actionUrl: '',
  },
  {
    id: 'movie_release',
    name: 'Phim mới lên sóng',
    icon: '🎬',
    type: 'movie_new',
    priority: 'normal',
    title: 'Phim bom tấn mới vừa cập bến!',
    message: 'Siêu phẩm mới đã có mặt với chất lượng 4K HDR cùng phụ đề độc quyền. Thưởng thức ngay hôm nay!',
    actionUrl: '/phim',
  },
  {
    id: 'vip_promotion',
    name: 'Khuyến mãi VIP',
    icon: '💎',
    type: 'admin',
    priority: 'normal',
    title: 'Ưu đãi nâng cấp tài khoản VIP',
    message: 'Nâng cấp gói thành viên VIP ngay để xem phim không giới hạn và mở khóa độ phân giải Ultra HD cao cấp nhất.',
    actionUrl: '/tai-khoan/goi-vip',
  },
  {
    id: 'security_alert',
    name: 'Cảnh báo bảo mật',
    icon: '🛡️',
    type: 'account_security',
    priority: 'critical',
    title: 'Khuyến cáo tăng cường an ninh tài khoản',
    message: 'Chúng tôi ghi nhận nhiều nỗ lực đăng nhập bất thường. Vui lòng kiểm tra lại thiết bị đã đăng nhập và kích hoạt bảo mật 2 lớp.',
    actionUrl: '/tai-khoan/bao-mat',
  },
];

const AUDIENCE_OPTIONS = [
  {
    id: 'all',
    label: 'Toàn bộ hệ thống',
    icon: Globe,
    desc: 'Gửi thông báo đẩy tức thì tới tất cả người dùng hoạt động trong hệ thống.',
  },
  {
    id: 'role',
    label: 'Theo vai trò',
    icon: Users,
    desc: 'Lọc và gửi thông báo tới các tài khoản thuộc nhóm vai trò được chọn bên dưới.',
  },
  {
    id: 'user',
    label: 'Người dùng cụ thể',
    icon: User,
    desc: 'Gửi thông báo riêng tư đích danh tới một tài khoản người dùng thông qua UUID.',
  },
];

const ROLE_TARGETS = [
  { value: ROLES.USER, label: 'Thành viên (User / Free & VIP)' },
  { value: ROLES.MODERATOR, label: 'Kiểm duyệt viên (Moderator)' },
  { value: ROLES.ADMIN, label: 'Quản trị viên (Admin)' },
  { value: ROLES.BOSS, label: 'Quản trị tối cao (Boss)' },
];

const NOTIFICATION_TYPES = [
  { value: 'system', label: 'Hệ thống (System)' },
  { value: 'admin', label: 'Ban quản trị (Admin Alert)' },
  { value: 'movie_new', label: 'Phim mới (Movie New)' },
  { value: 'movie_update', label: 'Cập nhật phim (Movie Update)' },
  { value: 'account_security', label: 'Bảo mật tài khoản (Security)' },
  { value: 'welcome', label: 'Chào mừng (Welcome)' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Thấp (Low)' },
  { value: 'normal', label: 'Bình thường (Normal)' },
  { value: 'high', label: 'Cao (High)' },
  { value: 'critical', label: 'Khẩn cấp (Critical)' },
];

const DEFAULT_FORM_STATE = {
  targetType: 'all',
  targetRole: ROLES.USER,
  userId: '',
  title: '',
  message: '',
  type: 'system',
  priority: 'normal',
  icon: '🔔',
  actionUrl: '',
  expiresAt: '',
};

export const BroadcastNotificationDrawer = ({
  open = false,
  onClose,
  initialUserId = '',
}) => {
  const [formData, setFormData] = useState({
    ...DEFAULT_FORM_STATE,
    targetType: initialUserId ? 'user' : 'all',
    userId: initialUserId || '',
  });

  const { mutate: createNotification, isPending: isSubmitting } =
    useCreateNotificationMutation({
      onSuccess: () => {
        toast.success(
          formData.targetType === 'all'
            ? 'Đã phát sóng thông báo toàn hệ thống thành công!'
            : formData.targetType === 'role'
              ? `Đã gửi thông báo tới nhóm vai trò ${formData.targetRole}!`
              : 'Đã gửi thông báo tới người dùng thành công!'
        );
        handleReset();
        onClose?.();
      },
      onError: (err) => {
        toast.error(err.message || 'Lỗi khi phát thông báo');
      },
    });

  const handleApplyTemplate = useCallback((template) => {
    setFormData((prev) => ({
      ...prev,
      title: template.title,
      message: template.message,
      type: template.type,
      priority: template.priority,
      icon: template.icon,
      actionUrl: template.actionUrl || '',
    }));
    toast.success(`Đã áp dụng mẫu: "${template.name}"`);
  }, []);

  const handleReset = useCallback(() => {
    setFormData({
      ...DEFAULT_FORM_STATE,
      targetType: initialUserId ? 'user' : 'all',
      userId: initialUserId || '',
    });
  }, [initialUserId]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề thông báo');
      return;
    }
    if (!formData.message.trim()) {
      toast.error('Vui lòng nhập nội dung thông báo');
      return;
    }
    if (formData.targetType === 'user' && !formData.userId.trim()) {
      toast.error('Vui lòng nhập UUID người nhận');
      return;
    }

    const payload = {
      targetType: formData.targetType,
      targetRole: formData.targetType === 'role' ? formData.targetRole : undefined,
      userId: formData.targetType === 'user' ? formData.userId.trim() : undefined,
      title: formData.title.trim(),
      message: formData.message.trim(),
      type: formData.type,
      priority: formData.priority,
      icon: formData.icon.trim() || undefined,
      actionUrl: formData.actionUrl.trim() || undefined,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
    };

    createNotification(payload);
  };

  const selectedAudience = useMemo(() => {
    return AUDIENCE_OPTIONS.find((opt) => opt.id === formData.targetType) || AUDIENCE_OPTIONS[0];
  }, [formData.targetType]);

  const priorityBadgeVariant = useMemo(() => {
    switch (formData.priority) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'low':
        return 'neutral';
      default:
        return 'primary';
    }
  }, [formData.priority]);

  return (
    <OffCanvas
      open={open}
      onClose={onClose}
      placement="right"
      size="xlarge"
      variant="tonal"
      className="broadcast-drawer"
    >
      <OffCanvas.Header
        title="Tạo & Phát Thông Báo Hệ Thống"
        subtitle="Gửi thông báo đẩy tức thì (Push Broadcast) tới toàn thể hoặc phân nhóm người dùng"
        onClose={onClose}
        showCloseButton
      />

      <OffCanvas.Body className="broadcast-drawer__body">
        {/* ── 1. Preset Templates ── */}
        <div className="broadcast-drawer__section">
          <div className="broadcast-drawer__section-header">
            <Sparkles size={16} className="broadcast-drawer__section-icon" />
            <span className="broadcast-drawer__section-title">Mẫu thông báo thông dụng (1-Click Presets)</span>
          </div>
          <div className="broadcast-drawer__templates-grid">
            {NOTIFICATION_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                className="broadcast-drawer__template-chip"
                onClick={() => handleApplyTemplate(tmpl)}
              >
                <span className="broadcast-drawer__template-icon">{tmpl.icon}</span>
                <span className="broadcast-drawer__template-name">{tmpl.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── 2. Form Input ── */}
        <form id="broadcast-notification-form" onSubmit={handleSubmit} className="broadcast-drawer__form">
          {/* Target Audience Switcher (Segmented Control + Contextual Desc) */}
          <div className="broadcast-drawer__form-group">
            <label className="broadcast-drawer__label">Phạm vi người nhận (Target Audience)</label>
            <div className="broadcast-drawer__segmented-control" role="tablist">
              {AUDIENCE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = formData.targetType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`broadcast-drawer__segmented-btn ${isSelected ? 'broadcast-drawer__segmented-btn--active' : ''
                      }`}
                    onClick={() => setFormData({ ...formData, targetType: opt.id })}
                  >
                    <Icon size={16} className="broadcast-drawer__segmented-icon" />
                    <span className="broadcast-drawer__segmented-text">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="broadcast-drawer__audience-desc">
              <span className="broadcast-drawer__audience-desc-dot" />
              <span className="broadcast-drawer__audience-desc-text">{selectedAudience.desc}</span>
            </div>
          </div>

          {/* Conditional Target Input: Role Selector */}
          {formData.targetType === 'role' && (
            <div className="broadcast-drawer__form-group">
              <label className="broadcast-drawer__label" htmlFor="broadcast-target-role">
                Chọn vai trò nhận thông báo
              </label>
              <select
                id="broadcast-target-role"
                className="broadcast-drawer__select"
                value={formData.targetRole}
                onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
              >
                {ROLE_TARGETS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional Target Input: Specific User */}
          {formData.targetType === 'user' && (
            <div className="broadcast-drawer__form-group">
              <label className="broadcast-drawer__label" htmlFor="broadcast-target-user-id">
                UUID Người Dùng (User ID) <span className="broadcast-drawer__required">*</span>
              </label>
              <input
                id="broadcast-target-user-id"
                type="text"
                required
                className="broadcast-drawer__input"
                placeholder="Ví dụ: e3b89088-3486-4f40-a3e2-8ad6319808db"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              />
              <span className="broadcast-drawer__hint">
                Nhập UUID của người dùng cần gửi thông báo riêng biệt.
              </span>
            </div>
          )}

          {/* Title & Icon Row */}
          <div className="broadcast-drawer__form-row">
            <div className="broadcast-drawer__form-group broadcast-drawer__form-group--flex-3">
              <label className="broadcast-drawer__label" htmlFor="broadcast-title">
                Tiêu đề thông báo <span className="broadcast-drawer__required">*</span>
              </label>
              <input
                id="broadcast-title"
                type="text"
                required
                maxLength={255}
                className="broadcast-drawer__input"
                placeholder="Nhập tiêu đề thông báo..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="broadcast-drawer__form-group broadcast-drawer__form-group--flex-1">
              <label className="broadcast-drawer__label" htmlFor="broadcast-icon">
                Biểu tượng
              </label>
              <input
                id="broadcast-icon"
                type="text"
                maxLength={10}
                className="broadcast-drawer__input broadcast-drawer__input--center"
                placeholder="🔔"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              />
            </div>
          </div>

          {/* Message Textarea */}
          <div className="broadcast-drawer__form-group">
            <label className="broadcast-drawer__label" htmlFor="broadcast-message">
              Nội dung thông báo <span className="broadcast-drawer__required">*</span>
            </label>
            <textarea
              id="broadcast-message"
              required
              rows={4}
              maxLength={2000}
              className="broadcast-drawer__textarea"
              placeholder="Nhập chi tiết nội dung cần truyền tải tới người dùng..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            />
            <div className="broadcast-drawer__char-counter">
              {formData.message.length} / 2000 ký tự
            </div>
          </div>

          {/* Type & Priority Row */}
          <div className="broadcast-drawer__form-row">
            <div className="broadcast-drawer__form-group broadcast-drawer__form-group--flex-1">
              <label className="broadcast-drawer__label" htmlFor="broadcast-type">
                Loại thông báo (Type)
              </label>
              <select
                id="broadcast-type"
                className="broadcast-drawer__select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                {NOTIFICATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="broadcast-drawer__form-group broadcast-drawer__form-group--flex-1">
              <label className="broadcast-drawer__label" htmlFor="broadcast-priority">
                Mức độ ưu tiên (Priority)
              </label>
              <select
                id="broadcast-priority"
                className="broadcast-drawer__select"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action URL & Expiration Row */}
          <div className="broadcast-drawer__form-row">
            <div className="broadcast-drawer__form-group broadcast-drawer__form-group--flex-1">
              <label className="broadcast-drawer__label" htmlFor="broadcast-action-url">
                Đường dẫn liên kết (Action URL)
              </label>
              <input
                id="broadcast-action-url"
                type="text"
                className="broadcast-drawer__input"
                placeholder="Ví dụ: /phim hoặc /tai-khoan/goi-vip"
                value={formData.actionUrl}
                onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
              />
            </div>

            <div className="broadcast-drawer__form-group broadcast-drawer__form-group--flex-1">
              <label className="broadcast-drawer__label" htmlFor="broadcast-expires-at">
                Ngày hết hạn (Tuỳ chọn)
              </label>
              <input
                id="broadcast-expires-at"
                type="datetime-local"
                className="broadcast-drawer__input"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              />
            </div>
          </div>

          {/* ── 3. Live Preview Card ── */}
          <div className="broadcast-drawer__preview-section">
            <div className="broadcast-drawer__preview-title">
              <span>Xem trước trên giao diện người dùng (Live Preview)</span>
              <Badge variant={priorityBadgeVariant} size="sm">
                Ưu tiên: {formData.priority}
              </Badge>
            </div>

            <div className="broadcast-drawer__live-card">
              <div className="broadcast-drawer__live-card-icon">
                {formData.icon || '🔔'}
              </div>
              <div className="broadcast-drawer__live-card-content">
                <div className="broadcast-drawer__live-card-header">
                  <h4 className="broadcast-drawer__live-card-title">
                    {formData.title || 'Tiêu đề thông báo sẽ hiển thị ở đây'}
                  </h4>
                  <span className="broadcast-drawer__live-card-time">Vừa xong</span>
                </div>
                <p className="broadcast-drawer__live-card-message">
                  {formData.message || 'Nội dung chi tiết thông báo sẽ được trình bày tại đây theo chuẩn hiển thị giao diện người dùng Sạp Phim.'}
                </p>

                {formData.actionUrl && (
                  <div className="broadcast-drawer__live-card-link">
                    <ExternalLink size={12} />
                    <span>{formData.actionUrl}</span>
                  </div>
                )}
              </div>
              <div className="broadcast-drawer__live-card-unread-dot" />
            </div>
          </div>
        </form>
      </OffCanvas.Body>

      <OffCanvas.Footer align="between" className="broadcast-drawer__footer">
        <Button
          type="button"
          variant="outlined"
          onClick={handleReset}
          disabled={isSubmitting}
          icon={RotateCcw}
        >
          Đặt lại
        </Button>

        <div className="broadcast-drawer__footer-actions">
          <Button
            type="button"
            variant="text"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Đóng
          </Button>

          <Button
            type="submit"
            form="broadcast-notification-form"
            variant="filled"
            disabled={isSubmitting}
            icon={isSubmitting ? Loader2 : Send}
          >
            {isSubmitting ? 'Đang phát sóng...' : 'Gửi Thông Báo'}
          </Button>
        </div>
      </OffCanvas.Footer>
    </OffCanvas>
  );
};

BroadcastNotificationDrawer.propTypes = {
  initialUserId: PropTypes.string,
  onClose: PropTypes.func,
  open: PropTypes.bool,
};

export default BroadcastNotificationDrawer;
