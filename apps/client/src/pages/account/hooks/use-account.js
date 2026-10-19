/**
 * @file use-account.js
 * @module Pages/Account/Hooks/UseAccount
 * @description Hook điều phối dữ liệu, trạng thái Tab, tìm kiếm thiết lập và các tác vụ Mutation cho trang Quản lý tài khoản (Account Page).
 */

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  useMyProfileQuery,
  useUserPreferencesQuery,
} from '@/hooks/queries/use-user.queries';
import {
  useUpdateProfileMutation,
  useUpdateAvatarMutation,
  useUpdateCoverMutation,
  useUpdatePrivacyMutation,
  useUpdatePreferencesMutation,
  useResetPreferencesMutation,
  useApplyPresetMutation,
  useDeleteAccountMutation,
} from '@/hooks/mutations/use-user.mutations';
import {
  useSessionsQuery,
} from '@/hooks/queries/use-auth.queries';
import {
  useChangePasswordMutation,
  useRevokeSessionMutation,
  useLogoutAllMutation,
} from '@/hooks/mutations/use-auth.mutations';
import { useAuth } from '@/hooks/use-auth';
import userService from '@/shared/services/user.service';

export const ACCOUNT_TABS = [
  {
    id: 'profile',
    label: 'Thông tin cá nhân',
    description: 'Họ tên, ảnh đại diện, ngày sinh và vị trí',
    icon: 'User',
    keywords: ['hồ sơ', 'avatar', 'ảnh đại diện', 'tên', 'email', 'ngày sinh', 'giới tính', 'bio', 'vị trí'],
  },
  {
    id: 'security',
    label: 'Bảo mật & Phiên',
    description: 'Đổi mật khẩu, 2FA và thiết bị đăng nhập',
    icon: 'ShieldCheck',
    keywords: ['mật khẩu', 'password', 'bảo mật', '2fa', 'mfa', 'thiết bị', 'phiên', 'session', 'đăng xuất'],
  },
  {
    id: 'privacy',
    label: 'Quyền riêng tư',
    description: 'Quản lý hiển thị thông tin công khai',
    icon: 'Lock',
    keywords: ['quyền riêng tư', 'privacy', 'ẩn email', 'ẩn ngày sinh', 'hoạt động xem', 'bạn bè'],
  },
  {
    id: 'preferences',
    label: 'Tùy chọn trải nghiệm',
    description: 'Cài đặt phát phim và nhận thông báo',
    icon: 'Sliders',
    keywords: ['cài đặt', 'preferences', 'tự động phát', 'chất lượng', 'phụ đề', 'thông báo', 'email'],
  },
  {
    id: 'danger-zone',
    label: 'Dữ liệu & Tài khoản',
    description: 'Xuất dữ liệu và xóa tài khoản vĩnh viễn',
    icon: 'AlertTriangle',
    keywords: ['dữ liệu', 'xuất dữ liệu', 'export', 'xóa tài khoản', 'hủy tài khoản', 'danger zone'],
  },
];

/**
 * @hook useAccount
 * @description Hook quản lý trạng thái toàn diện cho trang Account
 */
export const useAccount = () => {
  const { user: authUser, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Quản lý Tab hoạt động từ Search Param URL (mặc định: 'profile')
  const activeTab = useMemo(() => {
    const tabParam = searchParams.get('tab');
    const isValid = ACCOUNT_TABS.some((t) => t.id === tabParam);
    return isValid ? tabParam : 'profile';
  }, [searchParams]);

  const setActiveTab = useCallback(
    (tabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', tabId);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // 2. React Queries
  const profileQuery = useMyProfileQuery();
  const preferencesQuery = useUserPreferencesQuery();
  const sessionsQuery = useSessionsQuery();

  const isInitialLoading =
    profileQuery.isLoading ||
    (preferencesQuery.isLoading && !preferencesQuery.data);

  const queryError = profileQuery.error || preferencesQuery.error;

  // 3. User & Profile Data
  const profile = useMemo(() => {
    return profileQuery.data || authUser || {};
  }, [profileQuery.data, authUser]);

  const preferences = useMemo(() => {
    return preferencesQuery.data || {};
  }, [preferencesQuery.data]);

  const sessions = useMemo(() => {
    return Array.isArray(sessionsQuery.data) ? sessionsQuery.data : [];
  }, [sessionsQuery.data]);

  // 4. Mutations
  const updateProfileMutation = useUpdateProfileMutation();
  const updateAvatarMutation = useUpdateAvatarMutation();
  const updateCoverMutation = useUpdateCoverMutation();
  const updatePrivacyMutation = useUpdatePrivacyMutation();
  const updatePreferencesMutation = useUpdatePreferencesMutation();
  const resetPreferencesMutation = useResetPreferencesMutation();
  const applyPresetMutation = useApplyPresetMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const revokeSessionMutation = useRevokeSessionMutation();
  const logoutAllMutation = useLogoutAllMutation();
  const deleteAccountMutation = useDeleteAccountMutation();

  // 5. Action Handlers
  const handleUpdateProfile = useCallback(
    async (payload) => {
      return new Promise((resolve, reject) => {
        updateProfileMutation.mutate(payload, {
          onSuccess: (data) => {
            toast.success('Đã lưu thông tin cá nhân thành công!');
            resolve(data);
          },
          onError: (err) => {
            const msg = err?.response?.data?.message || err?.message || 'Không thể cập nhật hồ sơ.';
            toast.error(msg);
            reject(err);
          },
        });
      });
    },
    [updateProfileMutation]
  );

  const handleUpdateAvatar = useCallback(
    async (fileOrFormData) => {
      return new Promise((resolve, reject) => {
        updateAvatarMutation.mutate(fileOrFormData, {
          onSuccess: (data) => {
            toast.success('Đã cập nhật ảnh đại diện mới!');
            resolve(data);
          },
          onError: (err) => {
            const msg = err?.response?.data?.message || err?.message || 'Không thể tải lên ảnh đại diện.';
            toast.error(msg);
            reject(err);
          },
        });
      });
    },
    [updateAvatarMutation]
  );

  const handleUpdateCover = useCallback(
    async (fileOrFormData) => {
      return new Promise((resolve, reject) => {
        updateCoverMutation.mutate(fileOrFormData, {
          onSuccess: (data) => {
            toast.success('Đã cập nhật ảnh bìa thành công!');
            resolve(data);
          },
          onError: (err) => {
            const msg = err?.response?.data?.message || err?.message || 'Không thể cập nhật ảnh bìa.';
            toast.error(msg);
            reject(err);
          },
        });
      });
    },
    [updateCoverMutation]
  );

  const handleUpdatePrivacy = useCallback(
    async (payload) => {
      return new Promise((resolve, reject) => {
        updatePrivacyMutation.mutate(payload, {
          onSuccess: (data) => {
            toast.success('Đã lưu thiết lập quyền riêng tư!');
            resolve(data);
          },
          onError: (err) => {
            const msg = err?.response?.data?.message || err?.message || 'Không thể lưu quyền riêng tư.';
            toast.error(msg);
            reject(err);
          },
        });
      });
    },
    [updatePrivacyMutation]
  );

  const handleUpdatePreferences = useCallback(
    async (payload) => {
      return new Promise((resolve, reject) => {
        updatePreferencesMutation.mutate(payload, {
          onSuccess: (data) => {
            toast.success('Đã lưu tùy chọn trải nghiệm thành công!');
            resolve(data);
          },
          onError: (err) => {
            const msg = err?.response?.data?.message || err?.message || 'Không thể lưu tùy chọn.';
            toast.error(msg);
            reject(err);
          },
        });
      });
    },
    [updatePreferencesMutation]
  );

  const handleResetPreferences = useCallback(async () => {
    return new Promise((resolve, reject) => {
      resetPreferencesMutation.mutate(undefined, {
        onSuccess: (data) => {
          toast.success('Đã khôi phục cài đặt mặc định!');
          resolve(data);
        },
        onError: (err) => {
          const msg = err?.response?.data?.message || err?.message || 'Không thể khôi phục cài đặt.';
          toast.error(msg);
          reject(err);
        },
      });
    });
  }, [resetPreferencesMutation]);

  const handleApplyPreset = useCallback(
    async (presetName) => {
      return new Promise((resolve, reject) => {
        applyPresetMutation.mutate(
          { preset: presetName },
          {
            onSuccess: (data) => {
              toast.success(`Đã áp dụng cấu hình "${presetName}"!`);
              resolve(data);
            },
            onError: (err) => {
              const msg = err?.response?.data?.message || err?.message || 'Không thể áp dụng preset.';
              toast.error(msg);
              reject(err);
            },
          }
        );
      });
    },
    [applyPresetMutation]
  );

  const handleChangePassword = useCallback(
    async (payload) => {
      return new Promise((resolve, reject) => {
        changePasswordMutation.mutate(payload, {
          onSuccess: (data) => {
            toast.success('Mật khẩu của bạn đã được thay đổi thành công!');
            resolve(data);
          },
          onError: (err) => {
            const msg = err?.response?.data?.message || err?.message || 'Đổi mật khẩu thất bại.';
            toast.error(msg);
            reject(err);
          },
        });
      });
    },
    [changePasswordMutation]
  );

  const handleRevokeSession = useCallback(
    async (sessionId) => {
      return new Promise((resolve, reject) => {
        revokeSessionMutation.mutate(sessionId, {
          onSuccess: (data) => {
            toast.success('Đã đăng xuất thiết bị thành công!');
            resolve(data);
          },
          onError: (err) => {
            const msg = err?.response?.data?.message || err?.message || 'Không thể thu hồi phiên đăng nhập.';
            toast.error(msg);
            reject(err);
          },
        });
      });
    },
    [revokeSessionMutation]
  );

  const handleLogoutAllSessions = useCallback(async () => {
    return new Promise((resolve, reject) => {
      logoutAllMutation.mutate(undefined, {
        onSuccess: (data) => {
          toast.success('Đã đăng xuất khỏi tất cả các thiết bị!');
          logout();
          resolve(data);
        },
        onError: (err) => {
          const msg = err?.response?.data?.message || err?.message || 'Không thể đăng xuất tất cả thiết bị.';
          toast.error(msg);
          reject(err);
        },
      });
    });
  }, [logoutAllMutation, logout]);

  const handleExportData = useCallback(async () => {
    try {
      toast.loading('Đang khởi tạo gói dữ liệu cá nhân...', { id: 'export-data' });
      const data = await userService.exportData();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sap-phim-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Dữ liệu đã được tải về thành công!', { id: 'export-data' });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể xuất dữ liệu lúc này.';
      toast.error(msg, { id: 'export-data' });
    }
  }, []);

  const handleDeleteAccount = useCallback(
    async (payload) => {
      return new Promise((resolve, reject) => {
        deleteAccountMutation.mutate(payload, {
          onSuccess: (data) => {
            toast.success('Tài khoản của bạn đã được xóa thành công.');
            resolve(data);
          },
          onError: (err) => {
            const msg = err?.response?.data?.message || err?.message || 'Không thể xóa tài khoản. Vui lòng kiểm tra mật khẩu.';
            toast.error(msg);
            reject(err);
          },
        });
      });
    },
    [deleteAccountMutation]
  );

  // 6. Filtered Tabs theo Search Input
  const filteredTabs = useMemo(() => {
    if (!searchFilter.trim()) return ACCOUNT_TABS;
    const query = searchFilter.toLowerCase().trim();
    return ACCOUNT_TABS.filter((tab) => {
      const matchLabel = tab.label.toLowerCase().includes(query);
      const matchDesc = tab.description.toLowerCase().includes(query);
      const matchKeywords = tab.keywords.some((k) => k.toLowerCase().includes(query));
      return matchLabel || matchDesc || matchKeywords;
    });
  }, [searchFilter]);

  return {
    activeTab,
    setActiveTab,
    searchFilter,
    setSearchFilter,
    tabs: ACCOUNT_TABS,
    filteredTabs,
    profile,
    preferences,
    sessions,
    isInitialLoading,
    queryError,
    refetchProfile: profileQuery.refetch,
    refetchPreferences: preferencesQuery.refetch,
    refetchSessions: sessionsQuery.refetch,
    // Action Handlers
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
    // Status states
    isUpdatingProfile: updateProfileMutation.isPending,
    isUpdatingAvatar: updateAvatarMutation.isPending,
    isUpdatingCover: updateCoverMutation.isPending,
    isUpdatingPrivacy: updatePrivacyMutation.isPending,
    isUpdatingPreferences: updatePreferencesMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    isRevokingSession: revokeSessionMutation.isPending,
    isLoggingOutAll: logoutAllMutation.isPending,
    isDeletingAccount: deleteAccountMutation.isPending,
  };
};

export default useAccount;
