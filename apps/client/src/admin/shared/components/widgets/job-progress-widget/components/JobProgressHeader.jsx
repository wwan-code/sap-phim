/**
 * @file JobProgressHeader.jsx
 * @module Widgets/JobProgressWidget/Components/JobProgressHeader
 * @component JobProgressHeader
 * @description Subcomponent Header: Hiển thị tiêu đề chung (tổng số tác vụ),
 *              nút Thu nhỏ/Mở rộng và nút Đóng toàn bộ (nếu cần).
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import {
  WifiOff,
  Minus,
  Maximize2,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component JobProgressHeader
 * @description Header widget: title row, active job count, minimize action.
 */
const JobProgressHeader = memo(({
  jobCount = 0,
  isReconnecting,
  isFloating,
  isMinimized,
  onToggleMinimize,
}) => {
  return (
    <div className="job-progress-widget__header" onClick={onToggleMinimize} style={{ cursor: isFloating ? 'pointer' : 'default' }}>
      <div className="job-progress-widget__header-content">
        <div className="job-progress-widget__title-row">
          {/* Tương tự TranscodeJobsWidget pulse indicator */}
          <div className="job-progress-widget__pulse-indicator" aria-hidden="true" />
          <span className="job-progress-widget__title">
            Tiến trình xử lý ({jobCount})
          </span>
        </div>

        {isReconnecting && !isMinimized && (
          <div
            className="job-progress-widget__reconnect-notice"
            role="status"
            aria-live="polite"
          >
            <WifiOff size={12} aria-hidden="true" />
            <span>Đang kết nối lại thời gian thực...</span>
          </div>
        )}
      </div>

      <div className="job-progress-widget__header-actions">
        {/* Nút Thu nhỏ / Mở rộng (dành riêng cho Floating mode) */}
        {isFloating && onToggleMinimize && (
          <button
            type="button"
            className="job-progress-widget__action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMinimize();
            }}
            aria-label={isMinimized ? 'Mở rộng widget' : 'Thu nhỏ widget'}
            title={isMinimized ? 'Mở rộng widget' : 'Thu nhỏ widget'}
          >
            {isMinimized ? <Maximize2 size={13} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
});

JobProgressHeader.displayName = 'JobProgressHeader';

JobProgressHeader.propTypes = {
  jobCount: PropTypes.number,
  isReconnecting: PropTypes.bool,
  isFloating: PropTypes.bool,
  isMinimized: PropTypes.bool,
  onToggleMinimize: PropTypes.func,
};

export default JobProgressHeader;
