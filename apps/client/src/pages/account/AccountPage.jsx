/**
 * @file AccountPage.jsx
 * @module Pages/Account/AccountPage
 * @component AccountPage
 * @description Trang Cài đặt tài khoản (Account Settings) chuẩn Material 3 Expressive, tích hợp 5 nhóm chuyên mục: Profile, Security, Privacy, Preferences, Danger Zone.
 */

import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronRight, RefreshCw, Settings } from 'lucide-react';

import Seo from '@/shared/components/common/seo/Seo';
import Button from '@/shared/components/ui/button/Button';
import PageLoader from '@/shared/components/ui/page-loader/PageLoader';
import { ROUTES } from '@/shared/constants/routes.constants';

import AccountSidebar from './components/AccountSidebar';
import ProfileTab from './components/tabs/ProfileTab';
import SecurityTab from './components/tabs/SecurityTab';
import PrivacyTab from './components/tabs/PrivacyTab';
import PreferencesTab from './components/tabs/PreferencesTab';
import DangerZoneTab from './components/tabs/DangerZoneTab';
import { useAccount } from './hooks/use-account';

import './_account-page.scss';

/**
 * @component AccountPage
 */
export const AccountPage = () => {
  const {
    activeTab,
    setActiveTab,
    searchFilter,
    setSearchFilter,
    filteredTabs,
    profile,
    preferences,
    sessions,
    isInitialLoading,
    queryError,
    refetchProfile,
    // Actions
    handleUpdateProfile,
    handleUpdateAvatar,
    handleUpdateCover,
    handleUpdatePrivacy,
    handleUpdatePreferences,
    handleResetPreferences,
    handleApplyPreset,
    handleChangePassword,
    handleRevokeSession,
    handleLogoutAllSessions,
    handleExportData,
    handleDeleteAccount,
    // Loading States
    isUpdatingProfile,
    isUpdatingAvatar,
    isUpdatingCover,
    isUpdatingPrivacy,
    isUpdatingPreferences,
    isChangingPassword,
    isRevokingSession,
    isLoggingOutAll,
    isDeletingAccount,
  } = useAccount();

  if (isInitialLoading) {
    return (
      <div className="account-page">
        <Seo
          title="Cài đặt tài khoản"
          description="Quản lý thông tin cá nhân, bảo mật và tùy chọn trải nghiệm xem phim tại Sạp Phim."
          canonicalPath={ROUTES.ACCOUNT}
        />
        <div className="account-page__container">
          <div className="account-page__loading">
            <PageLoader size="large" text="Đang tải dữ liệu tài khoản..." />
          </div>
        </div>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="account-page">
        <Seo
          title="Lỗi tải dữ liệu tài khoản"
          canonicalPath={ROUTES.ACCOUNT}
          noIndex
        />
        <div className="account-page__container">
          <div className="account-page__error-card">
            <AlertCircle size={48} className="account-page__error-icon" aria-hidden="true" />
            <h2>Không thể tải thông tin tài khoản</h2>
            <p>Đã xảy ra lỗi khi kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng của bạn.</p>
            <Button
              variant="filled"
              color="primary"
              size="medium"
              onClick={() => refetchProfile()}
              startIcon={<RefreshCw size={16} />}
            >
              Thử lại
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <Seo
        title="Cài đặt tài khoản"
        description="Quản lý thông tin cá nhân, bảo mật, quyền riêng tư và tùy chọn trải nghiệm xem phim tại Sạp Phim."
        canonicalPath={ROUTES.ACCOUNT}
      />

      <div className="account-page__container">
        {/* Breadcrumb & Page Header */}
        <header className="account-page__header">
          <nav className="account-page__breadcrumb" aria-label="Đường dẫn trang">
            <Link to={ROUTES.HOME}>Trang chủ</Link>
            <ChevronRight size={14} className="account-page__breadcrumb-separator" aria-hidden="true" />
            <span>Tài khoản</span>
            <ChevronRight size={14} className="account-page__breadcrumb-separator" aria-hidden="true" />
            <span aria-current="page">Cài đặt</span>
          </nav>

          <div className="account-page__title-row">
            <h1 className="account-page__title">
              <Settings size={28} className="account-page__title-icon" aria-hidden="true" />
              Cài đặt tài khoản
            </h1>
          </div>
        </header>

        {/* Master-Detail / Split Content Layout */}
        <div className="account-page__layout">
          <AccountSidebar
            tabs={filteredTabs}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            searchQuery={searchFilter}
            onSearchChange={setSearchFilter}
          />

          <main className="account-page__content">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeTab === 'profile' && (
                  <ProfileTab
                    profile={profile}
                    onUpdateProfile={handleUpdateProfile}
                    onUpdateAvatar={handleUpdateAvatar}
                    onUpdateCover={handleUpdateCover}
                    isUpdatingProfile={isUpdatingProfile}
                    isUpdatingAvatar={isUpdatingAvatar}
                    isUpdatingCover={isUpdatingCover}
                  />
                )}

                {activeTab === 'security' && (
                  <SecurityTab
                    profile={profile}
                    sessions={sessions}
                    onChangePassword={handleChangePassword}
                    onRevokeSession={handleRevokeSession}
                    onLogoutAllSessions={handleLogoutAllSessions}
                    isChangingPassword={isChangingPassword}
                    isRevokingSession={isRevokingSession}
                    isLoggingOutAll={isLoggingOutAll}
                  />
                )}

                {activeTab === 'privacy' && (
                  <PrivacyTab
                    profile={profile}
                    onUpdatePrivacy={handleUpdatePrivacy}
                    onApplyPreset={handleApplyPreset}
                    isUpdatingPrivacy={isUpdatingPrivacy}
                  />
                )}

                {activeTab === 'preferences' && (
                  <PreferencesTab
                    preferences={preferences}
                    onUpdatePreferences={handleUpdatePreferences}
                    onResetPreferences={handleResetPreferences}
                    isUpdatingPreferences={isUpdatingPreferences}
                  />
                )}

                {activeTab === 'danger-zone' && (
                  <DangerZoneTab
                    profile={profile}
                    onExportData={handleExportData}
                    onDeleteAccount={handleDeleteAccount}
                    isDeletingAccount={isDeletingAccount}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
};

export default memo(AccountPage);
