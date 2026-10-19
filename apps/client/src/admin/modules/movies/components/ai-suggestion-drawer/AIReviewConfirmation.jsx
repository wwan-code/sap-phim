/**
 * @file AIReviewConfirmation.jsx
 * @module Admin/Movies/Components
 * @description Explicit current/proposed overwrite list before the form is modified.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle } from 'lucide-react';

/** @component AIReviewConfirmation @description Render the exact signed merge plan. */
const AIReviewConfirmation = ({ review }) => (
  <section ref={review.confirmationRef} tabIndex={-1} className="sp-ai-drawer__confirmation" aria-label="Danh sách trường sẽ bị ghi đè">
    <div className="sp-ai-drawer__confirmation-title"><AlertTriangle size={22} aria-hidden="true" /><div><h3>Xác nhận ghi đè {review.plan.overwrites.length} trường</h3><p>Kiểm tra các giá trị được thay thế trước khi áp dụng vào form.</p></div></div>
    <div className="sp-ai-drawer__comparison-head" aria-hidden="true"><span>Trường</span><span>Hiện tại</span><span>Sau khi áp dụng</span></div>
    {review.confirmationChanges.map((change) => <div className="sp-ai-drawer__confirmation-row" key={change.key}><strong>{change.label}</strong><div><span className="sp-ai-drawer__mobile-label">Hiện tại</span><p>{change.currentLabel}</p></div><div><span className="sp-ai-drawer__mobile-label">Sau khi áp dụng</span><p>{change.proposedLabel}</p></div></div>)}
    <p className="sp-ai-drawer__muted">{review.plan.appliedCount - review.plan.overwrites.length} trường còn trống cũng sẽ được điền. Sau đó bạn vẫn cần kiểm tra và lưu phim.</p>
  </section>
);
AIReviewConfirmation.propTypes = { review: PropTypes.object.isRequired };
export default AIReviewConfirmation;
