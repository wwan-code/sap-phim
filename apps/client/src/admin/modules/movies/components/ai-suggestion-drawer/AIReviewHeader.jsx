/**
 * @file AIReviewHeader.jsx
 * @module Admin/Movies/Components
 * @description Stable work identity, factual confidence and compact source summary.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

import AIWorkflowSteps from '../ai-suggestion-shared/AIWorkflowSteps';

/** @component AIReviewHeader @description Render the selected work and notify without replacing an open review. */
const AIReviewHeader = ({ view, hasNewResult, onOpenLatest }) => (
  <div className={'sp-ai-drawer__header' + (view.ready ? ' sp-ai-drawer__header--review' : '')}>
    <div className="sp-ai-drawer__heading-line"><span className="sp-ai-drawer__emblem"><Sparkles size={20} aria-hidden="true" /></span><div><h2 ref={view.headingRef} tabIndex={-1}>{view.title}</h2>{view.subtitle && <p className="sp-ai-drawer__muted">{view.subtitle}</p>}</div></div>
    <div className="sp-ai-drawer__header-bottom"><AIWorkflowSteps active={view.ready ? 2 : 1} />{view.ready && <div className="sp-ai-drawer__summary-chips"><span className="sp-ai-drawer__confidence"><ShieldCheck size={14} aria-hidden="true" />{view.review.sourceSummary.length ? 'Dữ liệu nguồn · cần duyệt' : 'Chưa đủ chứng cứ'}</span>{view.review.sourceSummary.map((source) => <span className="sp-ai-drawer__source-chip" key={source}>{source}</span>)}</div>}</div>
    {hasNewResult && <button type="button" className="sp-ai-drawer__new-result" onClick={onOpenLatest}>Có kết quả mới — mở để xem<ArrowRight size={14} aria-hidden="true" /></button>}
  </div>
);
AIReviewHeader.propTypes = { view: PropTypes.object.isRequired, hasNewResult: PropTypes.bool, onOpenLatest: PropTypes.func };
export default AIReviewHeader;
