/**
 * @file JobProgressFailures.jsx
 * @module Widgets/JobProgressWidget/Components/JobProgressFailures
 * @component JobProgressFailures
 * @description Subcomponent Collapsible Failure Inspector: hiển thị chi tiết danh sách
 *              các mục bị lỗi, hỗ trợ toggle accordion, nút Copy All Errors và từng dòng
 *              lỗi có icon riêng biệt. Đáp ứng chuẩn Accessibility (ARIA).
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, ChevronDown, ChevronUp, Copy, Check, X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const JobProgressFailures = memo(({
  failures,
  failureCount,
  isExpanded,
  onToggle,
  onCopyErrors,
  copyFeedback,
}) => {
  if (failureCount === 0) return null;

  const toggleIconNode = isExpanded
    ? <ChevronUp   size={14} aria-hidden="true" />
    : <ChevronDown size={14} aria-hidden="true" />;

  const copyIconNode = copyFeedback === 'success'
    ? <Check size={13} aria-hidden="true" />
    : <Copy  size={13} aria-hidden="true" />;

  return (
    <div className="job-progress-widget__failures">
      {/* Accordion Trigger */}
      <button
        type="button"
        className="job-progress-widget__failures-toggle"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls="job-progress-failures-list"
      >
        <AlertCircle size={14} aria-hidden="true" />
        <span>
          {failureCount} mục thất bại
        </span>
        {toggleIconNode}

        {/* Copy button (chỉ hiển thị khi đang mở rộng) */}
        {isExpanded && (
          <button
            type="button"
            className="job-progress-widget__copy-btn"
            onClick={(e) => { e.stopPropagation(); onCopyErrors(); }}
            aria-label={copyFeedback === 'success' ? 'Đã sao chép' : 'Sao chép tất cả lỗi'}
            title={copyFeedback === 'success' ? 'Đã sao chép' : 'Sao chép tất cả lỗi'}
          >
            {copyIconNode}
            <span className="job-progress-widget__copy-label">
              {copyFeedback === 'success' ? 'Đã sao chép' : 'Sao chép'}
            </span>
          </button>
        )}
      </button>

      {/* Collapsible List */}
      {isExpanded && (
        <ul
          id="job-progress-failures-list"
          className="job-progress-widget__failures-list"
          role="list"
          aria-label="Danh sách mục thất bại"
        >
          {failures.map((failure) => (
            <li
              key={failure.id}
              className="job-progress-widget__failure-item"
              role="listitem"
            >
              <X size={11} className="job-progress-widget__failure-item-icon" aria-hidden="true" />
              <div className="job-progress-widget__failure-item-content">
                <span className="job-progress-widget__failure-type">
                  {failure.type}
                </span>
                <span className="job-progress-widget__failure-message">
                  {failure.message}
                </span>
                {failure.file && (
                  <code className="job-progress-widget__failure-file">
                    {failure.file}
                  </code>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Copy feedback error message */}
      {copyFeedback === 'error' && (
        <p className="job-progress-widget__copy-error" role="alert">
          Không thể sao chép, vui lòng sao chép thủ công.
        </p>
      )}
    </div>
  );
});

JobProgressFailures.displayName = 'JobProgressFailures';

JobProgressFailures.propTypes = {
  failures: PropTypes.arrayOf(
    PropTypes.shape({
      id:      PropTypes.string.isRequired,
      type:    PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
      file:    PropTypes.string,
    })
  ).isRequired,
  failureCount: PropTypes.number.isRequired,
  isExpanded:   PropTypes.bool.isRequired,
  onToggle:     PropTypes.func.isRequired,
  onCopyErrors: PropTypes.func.isRequired,
  copyFeedback: PropTypes.oneOf(['success', 'error', null]),
};

export default JobProgressFailures;
