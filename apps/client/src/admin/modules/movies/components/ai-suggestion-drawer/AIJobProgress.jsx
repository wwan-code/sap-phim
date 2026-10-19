/**
 * @file AIJobProgress.jsx
 * @module Admin/Movies/Components
 * @description Honest queued, processing, reconnecting and terminal job presentation.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Check, Circle, Clock, AlertTriangle } from 'lucide-react';

/** @component AIJobProgress @description Display server progress while allowing background work. */
const AIJobProgress = ({ progress }) => (
  <section className="sp-ai-drawer__progress" aria-label="Tiến trình tổng hợp">
    <div className={'sp-ai-drawer__progress-symbol' + (progress.failed ? ' sp-ai-drawer__progress-symbol--error' : '')}>{progress.failed ? <AlertTriangle size={28} /> : <Clock size={28} />}</div>
    <div className="sp-ai-drawer__progress-copy" role="status"><h3>{progress.title}</h3><p>{progress.message}</p></div>
    {!progress.failed && !progress.cancelled && <div className="sp-ai-drawer__progress-meter">
      <div><span>{progress.syncing ? 'Đang đồng bộ kết quả' : progress.waiting ? 'Tác vụ tiếp tục chạy ở nền' : 'Tiến trình đã ghi nhận'}</span>{progress.percent != null && !progress.waiting && <strong>{Math.round(progress.percent)}%</strong>}</div>
      <progress max="100" value={progress.waiting || progress.percent == null ? undefined : progress.percent} aria-label="Tiến trình từ máy chủ" />
    </div>}
    <ol className="sp-ai-drawer__progress-steps">{progress.steps.map((step, index) => <li key={step.label} className={(index === progress.currentStep && !progress.failed && !progress.cancelled ? 'sp-ai-drawer__progress-step--current' : '') + (index < progress.currentStep ? ' sp-ai-drawer__progress-step--done' : '')} aria-current={index === progress.currentStep ? 'step' : undefined}><span className="sp-ai-drawer__step-icon">{index < progress.currentStep ? <Check size={16} /> : <Circle size={16} />}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div></li>)}</ol>
  </section>
);
AIJobProgress.propTypes = { progress: PropTypes.object.isRequired };
export default AIJobProgress;
