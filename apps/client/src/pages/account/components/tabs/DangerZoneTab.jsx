/**
 * @file DangerZoneTab.jsx
 * @module Pages/Account/Components/Tabs/DangerZoneTab
 * @component DangerZoneTab
 * @description Tab xuất dữ liệu cá nhân (GDPR) và Xóa tài khoản vĩnh viễn với Modal xác thực an toàn.
 */

import React, { memo, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import {
  AlertTriangle,
  Download,
  FileJson,
  Lock,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

import Button from '@/shared/components/ui/button/Button';
import Modal from '@/shared/components/ui/modal/Modal';
import TextField from '@/shared/components/ui/text-field/TextField';

import './_account-tabs.scss';

const CONFIRM_TEXT = 'XÓA TÀI KHOẢN';

/**
 * @component DangerZoneTab
 */
export const DangerZoneTab = ({
  profile,
  onExportData,
  onDeleteAccount,
  isDeletingAccount,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
    setPassword('');
    setConfirmInput('');
    setErrorMsg('');
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const isFormValid =
    password.trim().length > 0 &&
    confirmInput.trim().toUpperCase() === CONFIRM_TEXT;

  const handleConfirmDelete = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isFormValid || isDeletingAccount) return;

      try {
        await onDeleteAccount({
          password: password.trim(),
          confirmation: confirmInput.trim(),
        });
        setIsModalOpen(false);
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Mật khẩu xác nhận không chính xác.';
        setErrorMsg(msg);
      }
    },
    [confirmInput, isDeletingAccount, isFormValid, onDeleteAccount, password]
  );

  return (
    <div className="account-tab-panel" id="account-panel-danger-zone" role="tabpanel" aria-labelledby="account-tab-danger-zone">
      {/* Header */}
      <div className="account-tab-panel__header">
        <div>
          <h2 className="account-tab-panel__title account-tab-panel__title--danger">Dữ liệu &amp; Quản lý tài khoản</h2>
          <p className="account-tab-panel__subtitle">
            Tải về bản sao lưu dữ liệu cá nhân của bạn hoặc đóng vĩnh viễn tài khoản Sạp Phim.
          </p>
        </div>
      </div>

      {/* Card: Xuất dữ liệu */}
      <div className="account-card">
        <div className="account-card__header">
          <div className="account-card__header-icon-title">
            <FileJson size={20} className="account-card__header-icon" aria-hidden="true" />
            <div>
              <h3 className="account-card__title">Xuất dữ liệu cá nhân (Data Export)</h3>
              <p className="account-card__desc">
                Tải về tệp JSON chứa toàn bộ lịch sử xem phim, danh sách yêu thích, đánh giá và thông tin hồ sơ của bạn theo chuẩn GDPR.
              </p>
            </div>
          </div>
        </div>

        <div className="account-card__body">
          <Button
            type="button"
            variant="outlined"
            color="primary"
            size="medium"
            onClick={onExportData}
            startIcon={<Download size={16} />}
          >
            Tải về gói dữ liệu (.json)
          </Button>
        </div>
      </div>

      {/* Card: Xóa tài khoản vĩnh viễn (Danger Zone) */}
      <div className="account-card account-card--danger">
        <div className="account-card__header">
          <div className="account-card__header-icon-title">
            <AlertTriangle size={20} className="account-card__header-icon account-card__header-icon--danger" aria-hidden="true" />
            <div>
              <h3 className="account-card__title account-card__title--danger">Xóa tài khoản vĩnh viễn</h3>
              <p className="account-card__desc">
                Sau khi xóa, tất cả dữ liệu tài khoản, lịch sử xem, điểm thưởng và gói VIP sẽ bị hủy bỏ vĩnh viễn và không thể khôi phục.
              </p>
            </div>
          </div>
        </div>

        <div className="account-card__body">
          <div className="account-card__danger-warning">
            <ShieldAlert size={18} className="account-card__danger-icon" aria-hidden="true" />
            <span>
              Lưu ý quan trọng: Hành động này không thể hoàn tác. Mọi quyền lợi thành viên VIP và điểm tích lũy sẽ bị vô hiệu hóa ngay lập tức.
            </span>
          </div>

          <div style={{ marginTop: 'var(--sp-space-4)' }}>
            <Button
              type="button"
              variant="filled"
              color="error"
              size="medium"
              onClick={handleOpenModal}
              startIcon={<Trash2 size={16} />}
            >
              Xác nhận xóa tài khoản này
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title="Xóa tài khoản vĩnh viễn"
        description="Vui lòng xác thực mật khẩu để tiến hành xóa tài khoản của bạn khỏi hệ thống Sạp Phim."
        size="small"
      >
        <form onSubmit={handleConfirmDelete} noValidate className="account-delete-modal-form">
          {errorMsg && (
            <div className="account-card__banner-error" role="alert" style={{ marginBottom: 'var(--sp-space-4)' }}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-space-4)' }}>
            <TextField
              label="Mật khẩu của bạn"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu tài khoản"
              required
              fullWidth
              size="medium"
              variant="outlined"
              showPasswordToggle
              disabled={isDeletingAccount}
              autoComplete="current-password"
              InputProps={{
                startAdornment: <Lock size={18} className="account-form__input-icon" aria-hidden="true" />,
              }}
            />

            <div>
              <p className="account-delete-modal__instruction">
                Để xác nhận, vui lòng gõ chính xác chữ <strong>{CONFIRM_TEXT}</strong> vào ô bên dưới:
              </p>
              <TextField
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={CONFIRM_TEXT}
                required
                fullWidth
                size="medium"
                variant="outlined"
                disabled={isDeletingAccount}
              />
            </div>
          </div>

          <div className="account-delete-modal__actions">
            <Button
              type="button"
              variant="text"
              color="inherit"
              size="medium"
              onClick={handleCloseModal}
              disabled={isDeletingAccount}
            >
              Hủy bỏ
            </Button>

            <Button
              type="submit"
              variant="filled"
              color="error"
              size="medium"
              loading={isDeletingAccount}
              disabled={!isFormValid || isDeletingAccount}
              startIcon={<Trash2 size={16} />}
            >
              Xóa vĩnh viễn
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

DangerZoneTab.propTypes = {
  profile: PropTypes.object.isRequired,
  onExportData: PropTypes.func.isRequired,
  onDeleteAccount: PropTypes.func.isRequired,
  isDeletingAccount: PropTypes.bool,
};

export default memo(DangerZoneTab);
