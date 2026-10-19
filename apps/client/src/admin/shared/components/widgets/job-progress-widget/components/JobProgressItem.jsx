/**
 * @file JobProgressItem.jsx
 * @module Widgets/JobProgressWidget/Components/JobProgressItem
 * @component JobProgressItem
 * @description Subcomponent Item: Hiển thị tiến trình chi tiết của 1 Job đơn lẻ.
 *              Tích hợp framer-motion cho thanh tiến trình mượt mà,
 *              Failure Inspector (cho lỗi) và Retry button.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { X, Sparkles } from 'lucide-react';
import classNames from 'classnames';

import { useJobProgress } from '../hooks/use-job-progress';
import JobProgressFailures from './JobProgressFailures';

const JobProgressItem = memo(({ job, onDismiss }) => {
  const {
    progress,
    display,
    isActive,
    isProcessing,
    isCompleted,
    isError,
    hasFailures,
    failureCount,
    isFailuresExpanded,
    copyFeedback,
    handleToggleFailures,
    handleCopyErrors,
    handleOpenAiResult,
  } = useJobProgress(job);

  const itemClasses = classNames(
    'job-progress-item',
    {
      'job-progress-item--active': isActive,
      'job-progress-item--processing': isProcessing,
      'job-progress-item--error': isError,
      'job-progress-item--completed': isCompleted,
    }
  );

  return (
    <div className={itemClasses}>
      {/* Meta: Title & Percentage */}
      <div className="job-progress-item__meta">
        <span className="job-progress-item__title" title={display.titleText}>
          {display.titleText}
        </span>
        <span className="job-progress-item__percentage">
          {display.percentText}
        </span>
      </div>

      <progress className="job-progress-item__native-progress" max={100} value={progress.percent} aria-label={display.titleText} />

      {/* Stage & Status Actions Row */}
      <div className="job-progress-item__footer">
        <span className="job-progress-item__stage" title={display.stageLabel}>
          {display.stageLabel || display.statusLabel}
        </span>

        <div className="job-progress-item__actions">
          {/* Action: Open AI Drawer if AI Job completed */}
          {progress.jobType === 'ai' && isCompleted && (
            <button
              type="button"
              className="job-progress-item__open-btn"
              onClick={handleOpenAiResult}
              aria-label="Xem kết quả gợi ý AI"
              title="Xem kết quả gợi ý AI"
            >
              <Sparkles size={12} aria-hidden="true" />
              <span>Xem kết quả</span>
            </button>
          )}

          {/* Action: Dismiss single job when completed/error */}
          {onDismiss && (isCompleted || isError || progress.status === 'cancelled') && (
            <button
              type="button"
              className="job-progress-item__dismiss-btn"
              onClick={() => onDismiss(progress.jobId)}
              aria-label="Xóa tác vụ"
              title="Xóa tác vụ"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {progress.error && <p className="job-progress-item__error-message" role="status">{progress.error}</p>}

      {/* Failures: Collapsible Failure Inspector */}
      {hasFailures && (
        <div className="job-progress-item__failures-wrap">
          <JobProgressFailures
            failures={progress.failures}
            failureCount={failureCount}
            isExpanded={isFailuresExpanded}
            onToggle={handleToggleFailures}
            onCopyErrors={handleCopyErrors}
            copyFeedback={copyFeedback}
          />
        </div>
      )}
    </div>
  );
});

JobProgressItem.displayName = 'JobProgressItem';

JobProgressItem.propTypes = {
  job: PropTypes.object.isRequired,
  onDismiss: PropTypes.func,
};

export default JobProgressItem;
