/**
 * @file AdminSettingsPage.jsx
 * @module Admin/Modules/Settings/Pages/AdminSettingsPage
 * @description Cài đặt hệ thống, SEO toàn trang, chế độ bảo trì và các thông số CDN / Storage.
 */

import React, { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { SectionCard } from '@/admin/shared/components/layout/section-card/SectionCard';

export const AdminSettingsPage = () => {
  const [settings, setSettings] = useState({
    siteName: 'Sạp Phim - Nền Tảng Xem Phim & Anime Trực Tuyến',
    siteDescription: 'Xem Anime Vietsub, Phim lẻ, Phim bộ chất lượng cao 4K UltraHD mượt mà không quảng cáo.',
    maintenanceMode: false,
    cdnEndpoint: 'https://cdn.sapphim.vn/hls/',
    allowRegistrations: true,
    requireEmailVerification: true,
  });

  const [saved, setSaved] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Cài Đặt Hệ Thống</h1>
          <p className="admin-page-subtitle">
            Cấu hình tham số toàn cục của ứng dụng, SEO, CDN và chế độ vận hành.
          </p>
        </div>
        <div className="admin-page-header-actions">
          <button type="button" className="admin-btn-primary" onClick={handleSubmit}>
            {saved ? <Check size={16} /> : <Save size={16} />}
            <span>{saved ? 'Đã lưu thành công!' : 'Lưu Cài Đặt'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SectionCard title="1. Cấu Hình Chung & SEO">
          <div className="admin-form-fields">
            <div className="admin-field-group">
              <label className="admin-label">Tên website (Site Title)</label>
              <input
                type="text"
                className="admin-input"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              />
            </div>

            <div className="admin-field-group">
              <label className="admin-label">Mô tả SEO mặc định (Meta Description)</label>
              <textarea
                rows={3}
                className="admin-textarea"
                value={settings.siteDescription}
                onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="2. Hệ Thống CDN & Media Storage">
          <div className="admin-form-fields">
            <div className="admin-field-group">
              <label className="admin-label">HLS CDN Endpoint URL</label>
              <input
                type="text"
                className="admin-input"
                value={settings.cdnEndpoint}
                onChange={(e) => setSettings({ ...settings, cdnEndpoint: e.target.value })}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="3. Chế Độ Bảo Trì & Đăng Ký">
          <div className="admin-form-fields">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <div>
                <strong>Cho phép người dùng mới đăng ký</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--sp-color-text-secondary)' }}>
                  Nếu tắt, chỉ có thể tạo tài khoản từ Admin portal.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowRegistrations}
                onChange={(e) => setSettings({ ...settings, allowRegistrations: e.target.checked })}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <strong>Bắt buộc xác thực Email khi đăng ký</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--sp-color-text-secondary)' }}>
                  Gửi mã OTP / Token kích hoạt tài khoản qua hòm thư.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.requireEmailVerification}
                onChange={(e) => setSettings({ ...settings, requireEmailVerification: e.target.checked })}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </div>
          </div>
        </SectionCard>
      </form>
    </div>
  );
};

export default AdminSettingsPage;
