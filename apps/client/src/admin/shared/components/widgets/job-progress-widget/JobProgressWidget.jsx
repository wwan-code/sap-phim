/**
 * @file JobProgressWidget.jsx
 * @module Widgets/JobProgressWidget/JobProgressWidget
 * @component JobProgressWidget
 * @description Master Dumb UI Container cho widget hiển thị tiến trình background job xử lý phim.
 *              Được nâng cấp lên dạng Stacked List (giống TranscodeJobsWidget), 
 *              kết hợp trạng thái từ Global Store (Zustand + Socket).
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import CircularProgress from '@/shared/components/ui/circular-progress/CircularProgress';
import { useActiveJob } from '@/hooks/socket/use-job-socket';
import { WIDGET_VARIANTS } from './job-progress-widget.constants';
import JobProgressHeader from './components/JobProgressHeader';
import JobProgressItem from './components/JobProgressItem';

import './job-progress-widget.scss';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component JobProgressWidget
 * @description Widget hiển thị tiến trình tác vụ xử lý phim trong nền (Dumb UI).
 */
const JobProgressWidget = memo(({
  variant = WIDGET_VARIANTS.FLOATING,
  className,
}) => {
  // Đọc dữ liệu từ Global Store
  const {
    activeJobCount,
    allActiveJobs,
    isFloatingMinimized,
    dismissJob,
    toggleFloatingMinimized,
  } = useActiveJob();

  // Invisible Interface: Không render nếu không có job nào
  if (allActiveJobs.length === 0) {
    return null;
  }

  const isFloating = variant === WIDGET_VARIANTS.FLOATING;
  const isBanner = variant === WIDGET_VARIANTS.BANNER;

  const rootClasses = classNames(
    'job-progress-widget',
    `job-progress-widget--${variant}`,
    {
      'job-progress-widget--minimized': isFloating && isFloatingMinimized,
    },
    className,
  );

  // ─── 1. Banner Mode (Inline compact - Tương thích ngược) ──────────────────
  if (isBanner) {
    return (
      <div className={rootClasses} role="status" aria-live="polite">
        {allActiveJobs.map(job => (
          <JobProgressItem
            key={job.jobId}
            job={job}
            onDismiss={dismissJob}
          />
        ))}
      </div>
    );
  }

  // ─── 2. Floating Minimized Pill Mode ──────────────────────────────────────
  if (isFloating && isFloatingMinimized) {
    // Tìm phần trăm trung bình hoặc render trạng thái xoay vòng
    return (
      <div className={rootClasses} role="status" aria-live="polite" onClick={toggleFloatingMinimized} style={{ cursor: 'pointer' }}>
        <div className="job-progress-widget__minimized-row">
          <div className="job-progress-widget__minimized-left">
            <CircularProgress
              variant="indeterminate"
              size={20}
              color="primary"
            />
            <span className="job-progress-widget__minimized-title">
              Đang xử lý ({activeJobCount})
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── 3. Full Card & Floating Expanded Mode (Stacked List) ─────────────────
  const isReconnecting = allActiveJobs.some(j => j.isReconnecting);

  return (
    <div
      className={rootClasses}
      role="region"
      aria-live="polite"
      aria-label="Tiến trình xử lý nền"
    >
      {/* Header: Title, Active Job Count, Minimize */}
      <JobProgressHeader
        jobCount={allActiveJobs.length}
        isReconnecting={isReconnecting}
        isFloating={isFloating}
        isMinimized={isFloating && isFloatingMinimized}
        onToggleMinimize={toggleFloatingMinimized}
      />

      {/* Body: Stacked List of Jobs */}
      <div className="job-progress-widget__body">
        {allActiveJobs.map((job) => (
          <JobProgressItem
            key={job.jobId}
            job={job}
            onDismiss={dismissJob}
          />
        ))}
      </div>
    </div>
  );
});

JobProgressWidget.displayName = 'JobProgressWidget';

JobProgressWidget.propTypes = {
  variant: PropTypes.oneOf([
    WIDGET_VARIANTS.FLOATING,
    WIDGET_VARIANTS.CARD,
    WIDGET_VARIANTS.BANNER,
  ]),
  className: PropTypes.string,
};

export default JobProgressWidget;
