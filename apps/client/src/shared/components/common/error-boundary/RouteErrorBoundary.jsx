/**
 * @file RouteErrorBoundary.jsx
 * @module Components/Common/ErrorBoundary/RouteErrorBoundary
 * @component RouteErrorBoundary
 * @description Error Element chuyên dụng cho React Router v6.4+, bắt lỗi từ render, loader và action, tích hợp phân quyền và ErrorBoundary.
 */

import React from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import AccessDeniedFallback from '@/shared/components/common/access-denied-fallback';
import ErrorBoundary from './ErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chuyển đổi route error thành Error object chuẩn có gắn mã status để ErrorBoundary phân loại.
 * @param {unknown} error - Lỗi từ useRouteError()
 * @returns {Error} Đối tượng Error được chuẩn hóa
 */
const toRouteError = (error) => {
  if (isRouteErrorResponse(error)) {
    const err = new Error(error.statusText || error.data || `Lỗi định tuyến HTTP ${error.status}`);
    err.status = error.status;
    return err;
  }

  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  const err = new Error(error?.message || 'Lỗi định tuyến không xác định');
  if (error?.status) err.status = error.status;
  return err;
};

/**
 * Component helper — throw error để kích hoạt getDerivedStateFromError trong ErrorBoundary
 * @param {object} props
 * @param {Error} props.error - Lỗi cần ném ra
 */
const ThrowError = ({ error }) => {
  throw error;
};
ThrowError.displayName = 'ThrowError';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component RouteErrorBoundary
 * @description Error Element chuyên dụng cho React Router.
 * Xử lý 403 bằng AccessDeniedFallback, các lỗi 404/401/500/chunk/network chuyển sang ErrorBoundary.
 */
const RouteErrorBoundary = () => {
  const error = useRouteError();

  // Xử lý 403 Forbidden trực tiếp bằng AccessDeniedFallback
  if (isRouteErrorResponse(error) && error.status === 403) {
    return (
      <AccessDeniedFallback
        title="Không có quyền truy cập"
        message="Bạn không có đủ quyền hạn để truy cập vào khu vực này. Vui lòng liên hệ quản trị viên."
        showUpgrade={false}
      />
    );
  }

  return (
    <ErrorBoundary variant="fullscreen">
      <ThrowError error={toRouteError(error)} />
    </ErrorBoundary>
  );
};

RouteErrorBoundary.displayName = 'RouteErrorBoundary';

export default RouteErrorBoundary;
