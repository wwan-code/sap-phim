/**
 * @file use-access-denied-fallback.js
 * @module Components/Common/AccessDeniedFallback/Hooks/UseAccessDeniedFallback
 * @description Custom hook quản lý logic điều hướng và xử lý thông tin vai trò/đặc quyền nâng cấp cho AccessDeniedFallback.
 * @returns {object} Trạng thái gói nâng cấp và các hàm điều khiển
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { UPGRADE_INFO_MAP } from '../access-denied-fallback.constants';

/**
 * Hook quản lý logic cho component AccessDeniedFallback
 * @param {object} params
 * @param {string} params.requiredRole - Vai trò yêu cầu
 * @param {boolean} params.showUpgrade - Có hiển thị nút nâng cấp không
 * @param {string} params.upgradeUrl - Link trang nâng cấp
 * @returns {object} { upgradeInfo, isPremiumGated, hasBenefits, handlers }
 */
export const useAccessDeniedFallback = ({ requiredRole, showUpgrade, upgradeUrl }) => {
  const navigate = useNavigate();

  // Lấy thông tin upgrade – fallback về premium_user nếu không khớp
  const upgradeInfo = useMemo(
    () => UPGRADE_INFO_MAP[requiredRole] ?? UPGRADE_INFO_MAP.premium_user,
    [requiredRole]
  );

  const isPremiumGated = useMemo(
    () => showUpgrade && requiredRole === 'premium_user',
    [showUpgrade, requiredRole]
  );

  const hasBenefits = useMemo(
    () => upgradeInfo.benefits.length > 0,
    [upgradeInfo.benefits.length]
  );

  // Memoize handlers để tránh tạo function mới mỗi render
  const handleNavigateBack = useCallback(() => navigate(-1), [navigate]);
  const handleNavigateHome = useCallback(() => navigate('/'), [navigate]);
  const handleNavigateUpgrade = useCallback(() => navigate(upgradeUrl), [navigate, upgradeUrl]);

  return {
    upgradeInfo,
    isPremiumGated,
    hasBenefits,
    handlers: {
      onBack: handleNavigateBack,
      onHome: handleNavigateHome,
      onUpgrade: handleNavigateUpgrade,
    },
  };
};
