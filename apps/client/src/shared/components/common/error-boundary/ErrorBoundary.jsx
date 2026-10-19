/**
 * @file ErrorBoundary.jsx
 * @module Components/Common/ErrorBoundary/ErrorBoundary
 * @component ErrorBoundary
 * @description Component bắt lỗi toàn cục và theo khối (Global & Local Error Boundary) chuẩn Material 3 Expressive, bảo đảm không bị trắng trang khi xảy ra lỗi runtime.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  AlertTriangle,
  Compass,
  Home,
  LogIn,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';

import Button from '@/shared/components/ui/button';
import { ROUTES } from '@/shared/constants/routes.constants';

import './error-boundary.scss';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & Error Metadata Classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phân loại lỗi chi tiết theo loại, trả về thông tin metadata hiển thị UI
 * @param {Error|object} error - Đối tượng lỗi
 * @returns {object} Metadata gồm: type, code, title, description, icon, colorClass
 */
const getErrorMetadata = (error) => {
  const message = error?.message || (typeof error === 'string' ? error : '');
  const status = error?.status || error?.statusCode || null;

  // 1. Lỗi 404 Not Found
  if (
    status === 404 ||
    message.includes('404') ||
    message.toLowerCase().includes('not found') ||
    message.toLowerCase().includes('không tìm thấy')
  ) {
    return {
      type: 'NOT_FOUND',
      code: '404',
      title: 'Không tìm thấy trang',
      description: 'Đường dẫn bạn yêu cầu không tồn tại, đã bị đổi tên hoặc tạm thời không khả dụng.',
      icon: <Compass size={32} aria-hidden="true" />,
      colorClass: 'accent',
      primaryActionType: 'HOME',
      secondaryActionType: 'CATALOG',
    };
  }

  // 2. Lỗi 401 Unauthorized / Hết phiên đăng nhập
  if (
    status === 401 ||
    message.includes('401') ||
    message.toLowerCase().includes('unauthorized') ||
    message.toLowerCase().includes('chưa đăng nhập')
  ) {
    return {
      type: 'UNAUTHORIZED',
      code: '401',
      title: 'Phiên đăng nhập hết hạn',
      description: 'Phiên làm việc của bạn đã hết hạn hoặc bạn cần đăng nhập để tiếp tục truy cập.',
      icon: <ShieldAlert size={32} aria-hidden="true" />,
      colorClass: 'warning',
      primaryActionType: 'LOGIN',
      secondaryActionType: 'HOME',
    };
  }

  // 3. Lỗi nạp Chunk (Lazy load failure - thường do mạng hoặc deploy bản build mới)
  if (
    message.includes('Loading chunk') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading CSS chunk')
  ) {
    return {
      type: 'CHUNK_LOAD',
      code: 'UPDATE',
      title: 'Cập nhật phiên bản mới',
      description: 'Hệ thống vừa phát hành bản cập nhật mới. Vui lòng tải lại trang để đồng bộ phiên bản mới nhất.',
      icon: <RefreshCw size={32} aria-hidden="true" />,
      colorClass: 'warning',
      primaryActionType: 'RELOAD',
      secondaryActionType: 'HOME',
    };
  }

  // 4. Lỗi Mạng / Mất kết nối
  if (
    message.includes('Network Error') ||
    message.includes('Failed to fetch') ||
    message.includes('ERR_INTERNET_DISCONNECTED')
  ) {
    return {
      type: 'NETWORK',
      code: 'OFFLINE',
      title: 'Mất kết nối mạng',
      description: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại đường truyền Internet của bạn.',
      icon: <WifiOff size={32} aria-hidden="true" />,
      colorClass: 'warning',
      primaryActionType: 'RETRY',
      secondaryActionType: 'HOME',
    };
  }

  // 5. Lỗi Runtime / Generic Crash
  return {
    type: 'GENERIC',
    code: status ? String(status) : '500',
    title: 'Đã xảy ra sự cố',
    description: 'Hệ thống gặp sự cố không mong muốn trong quá trình xử lý. Mong bạn thông cảm vì sự bất tiện này.',
    icon: <AlertTriangle size={32} aria-hidden="true" />,
    colorClass: 'error',
    primaryActionType: 'RETRY',
    secondaryActionType: 'HOME',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component ErrorBoundary
 * @description Lớp bắt lỗi React cấp cao nhất hoặc theo khối component con.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary][Catch]', {
        message: error?.message,
        error,
        stack: errorInfo?.componentStack,
      });
    }
  }

  /** Reset trạng thái lỗi */
  handleReset = () => {
    const { onReset } = this.props;
    try {
      this.setState({ hasError: false, error: null, errorInfo: null });
      if (typeof onReset === 'function') {
        onReset();
      }
    } catch {
      window.location.reload();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign(ROUTES.HOME);
  };

  handleGoLogin = () => {
    window.location.assign(ROUTES.LOGIN);
  };

  handleGoCatalog = () => {
    window.location.assign(ROUTES.CATALOG);
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, className, variant = 'fullscreen' } = this.props;

    if (!hasError) {
      return children;
    }

    // Custom fallback từ props
    if (typeof fallback === 'function') {
      return fallback({ error, errorInfo, reset: this.handleReset });
    }

    if (fallback && React.isValidElement(fallback)) {
      return fallback;
    }

    const metadata = getErrorMetadata(error);

    return (
      <div
        className={classNames(
          'error-boundary',
          `error-boundary--${variant}`,
          className
        )}
        role="alert"
        aria-live="assertive"
      >
        <div className="error-boundary__card">
          {/* Icon Badge */}
          <div
            className={classNames(
              'error-boundary__icon-wrapper',
              `error-boundary__icon-wrapper--${metadata.colorClass}`
            )}
          >
            {metadata.icon}
          </div>

          {/* Status Code Badge */}
          {metadata.code && (
            <span className="error-boundary__code-tag">{metadata.code}</span>
          )}

          {/* Typography */}
          <h1 className="error-boundary__title">{metadata.title}</h1>
          <p className="error-boundary__description">{metadata.description}</p>

          {/* Actions Group */}
          <div className="error-boundary__actions" role="group" aria-label="Các hành động phục hồi">
            {metadata.primaryActionType === 'RELOAD' && (
              <Button
                variant="filled"
                color="primary"
                onClick={this.handleReload}
                startIcon={<RefreshCw size={16} aria-hidden="true" />}
              >
                Tải lại trang
              </Button>
            )}

            {metadata.primaryActionType === 'LOGIN' && (
              <Button
                variant="filled"
                color="primary"
                onClick={this.handleGoLogin}
                startIcon={<LogIn size={16} aria-hidden="true" />}
              >
                Đăng nhập lại
              </Button>
            )}

            {metadata.primaryActionType === 'HOME' && (
              <Button
                variant="filled"
                color="primary"
                onClick={this.handleGoHome}
                startIcon={<Home size={16} aria-hidden="true" />}
              >
                Về trang chủ
              </Button>
            )}

            {metadata.primaryActionType === 'RETRY' && (
              <Button
                variant="filled"
                color="primary"
                onClick={this.handleReset}
                startIcon={<RefreshCw size={16} aria-hidden="true" />}
              >
                Thử lại ngay
              </Button>
            )}

            {metadata.secondaryActionType === 'CATALOG' && (
              <Button
                variant="outlined"
                onClick={this.handleGoCatalog}
                startIcon={<Compass size={16} aria-hidden="true" />}
              >
                Khám phá phim
              </Button>
            )}

            {metadata.secondaryActionType === 'HOME' && metadata.primaryActionType !== 'HOME' && (
              <Button
                variant="outlined"
                onClick={this.handleGoHome}
                startIcon={<Home size={16} aria-hidden="true" />}
              >
                Về trang chủ
              </Button>
            )}
          </div>

          {/* Dev Mode Debug Info */}
          {import.meta.env.DEV && errorInfo?.componentStack && (
            <details className="error-boundary__details">
              <summary>
                <span>Chi tiết lỗi kỹ thuật (Dev Mode)</span>
              </summary>
              <div className="error-boundary__code-block">
                <pre className="error-boundary__error-message">{error?.toString()}</pre>
                <pre className="error-boundary__stack-trace">{errorInfo.componentStack}</pre>
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }
}

ErrorBoundary.propTypes = {
  /** Nội dung được bảo vệ */
  children: PropTypes.node.isRequired,
  /** Class CSS tùy biến bổ sung cho card */
  className: PropTypes.string,
  /** Giao diện thay thế khi lỗi (function hoặc element) */
  fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  /** Callback khi người dùng nhấn thử lại */
  onReset: PropTypes.func,
  /** Chế độ hiển thị: fullscreen (toàn màn hình) hoặc inline (trong component) */
  variant: PropTypes.oneOf(['fullscreen', 'inline']),
};

export default ErrorBoundary;
