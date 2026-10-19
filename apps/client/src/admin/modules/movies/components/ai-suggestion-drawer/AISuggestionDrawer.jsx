/**
 * @file AISuggestionDrawer.jsx
 * @module Admin/Movies/Components
 * @description Wide review workspace with real progress, field comparison and deliberate overwrite confirmation.
 */
import React, { useId } from 'react';
import PropTypes from 'prop-types';
import { Check, ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-react';

import OffCanvas from '@/shared/components/ui/off-canvas/OffCanvas';
import Button from '@/shared/components/ui/button/Button';

import { useAiDrawer } from '../../hooks/use-ai-drawer';
import AIReviewHeader from './AIReviewHeader';
import AIReviewToolbar from './AIReviewToolbar';
import AIFieldRow from './AIFieldRow';
import AIJobProgress from './AIJobProgress';
import AIReviewAssets from './AIReviewAssets';
import AIReviewConfirmation from './AIReviewConfirmation';
import './ai-suggestion-drawer.scss';

/** @component AISuggestionDrawer @description Present one viewed job; never create or save a movie from UI components. */
const AISuggestionDrawer = ({ isOpen, onClose, job, suggestionData, suggestionId, currentValues, formErrors, metadata, onApply, isReadOnly = false, onCancelJob, isCancelling = false, onRequestAgain, onRefresh, hasNewResult = false, onOpenLatest }) => {
  const panelId = useId();
  const view = useAiDrawer({ job, suggestionData, suggestionId, isOpen, currentValues, formErrors, metadata, onApply, isReadOnly });
  const { review, progress, ready, result } = view;
  if (!view.hasContent) return null;
  return (
    <OffCanvas className="sp-ai-drawer" aria-label={'Gợi ý thông tin: ' + view.title} open={isOpen} onClose={onClose} placement="right" size="large" swipeable={false}>
      <OffCanvas.Header onClose={onClose}><AIReviewHeader view={view} hasNewResult={hasNewResult} onOpenLatest={onOpenLatest} /></OffCanvas.Header>
      <OffCanvas.Body ref={review.scrollRef} className="sp-ai-drawer__scroll">
        {!ready ? <AIJobProgress progress={progress} /> : review.confirmationIsCurrent ? <AIReviewConfirmation review={review} /> : <div className="sp-ai-drawer__workspace">
          <div className="sp-ai-drawer__overview"><p><strong>{view.changedCount}</strong> trường có thay đổi<span> · </span>{view.attentionCount} cần kiểm tra</p><label className="sp-ai-drawer__merge">Áp dụng<select value={review.mergeMode} onChange={(event) => review.changeMode(event.target.value)} disabled={isReadOnly}><option value="fill_empty">Chỉ điền ô trống</option><option value="overwrite_all">Cho phép ghi đè</option></select></label></div>
          {(result.completeness === 'partial' || review.warnings.length > 0 || review.conflicts.length > 0) && <details className="sp-ai-drawer__notice"><summary><AlertTriangle size={16} aria-hidden="true" /><strong>{result.completeness === 'partial' ? 'Kết quả một phần' : 'Có thông tin cần đối chiếu'}</strong><span>Xem chi tiết</span></summary><div>{result.completeness === 'partial' && <p>{review.partialReason}</p>}{result.retryAfter > 0 && <p>Có thể tra cứu lại sau {result.retryAfter} giây.</p>}{review.warnings.length > 0 && <ul>{review.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}{review.conflicts.map((conflict, index) => <p key={index}><strong>{conflict.label}:</strong> {conflict.detail}</p>)}{onRequestAgain && !isReadOnly && <button type="button" onClick={onRequestAgain}>Tra cứu lại</button>}</div></details>}
          <AIReviewToolbar review={review} panelId={panelId} disabled={isReadOnly} />
          <section id={panelId} role="tabpanel" aria-labelledby={panelId + '-' + review.activeGroup} className="sp-ai-drawer__panel" tabIndex={0}>
            {review.activeGroup === 'assets' ? <AIReviewAssets assets={review.assets} copy={review.copy} copiedUrl={review.copiedUrl} /> : <>
              {review.visibleFields.length > 0 && <div className="sp-ai-drawer__table-head" aria-hidden="true"><span>Trường thông tin</span><span>Hiện tại</span><span>Gợi ý</span><span>Chứng cứ</span></div>}
              <div className="sp-ai-drawer__rows">{review.visibleFields.map((field) => <AIFieldRow key={field.key} field={field} selected={review.selectedKeys.includes(field.key)} onToggle={review.toggle} disabled={isReadOnly} mergeMode={review.mergeMode} metadata={metadata} />)}</div>
              {!review.visibleFields.length && <div className="sp-ai-drawer__empty"><Check size={25} aria-hidden="true" /><h3>{review.fields.length ? 'Không có trường phù hợp bộ lọc' : 'Chưa có dữ liệu hợp lệ để áp dụng'}</h3><p>{review.fields.length ? 'Các lựa chọn ở nhóm khác vẫn được giữ nguyên.' : 'Bạn có thể thử tên gốc, năm hoặc định dạng cụ thể hơn.'}</p>{review.fields.length ? <button type="button" onClick={() => { review.setFilter('all'); review.setSearch(''); }}>Xem tất cả trường trong nhóm</button> : onRequestAgain && !isReadOnly && <button type="button" onClick={onRequestAgain}>Tra cứu lại</button>}</div>}
            </>}
          </section>
          {review.citations.length > 0 && <details className="sp-ai-drawer__citations"><summary>Nguồn web có trích dẫn ({review.citations.length})</summary>{review.citations.map((item, index) => <a key={index} href={item.url} target="_blank" rel="noopener noreferrer">{item.title || item.url}<ExternalLink size={12} aria-hidden="true" /></a>)}</details>}
        </div>}
      </OffCanvas.Body>
      <OffCanvas.Footer className="sp-ai-drawer__footer" align="between">
        {ready ? <><div className="sp-ai-drawer__count" aria-live="polite"><strong>{review.plan.appliedCount} trường sẽ áp dụng</strong><span>{review.plan.skippedCount} bỏ qua · {review.selectedKeys.length} đã chọn trên tất cả nhóm</span><small>Chỉ cập nhật form. Bạn quyết định lưu phim.</small></div><div className="sp-ai-drawer__actions"><Button type="button" variant="tonal" startIcon={review.confirmationIsCurrent ? <ArrowLeft size={16} /> : undefined} onClick={review.confirmationIsCurrent ? review.cancelConfirmation : onClose}>{review.confirmationIsCurrent ? 'Quay lại duyệt' : 'Đóng'}</Button><Button ref={review.applyButtonRef} type="button" variant="filled" startIcon={<Check size={16} />} onClick={review.apply} disabled={isReadOnly || !review.plan.appliedCount}>{review.confirmationIsCurrent ? 'Xác nhận và áp dụng ' : 'Áp dụng '}{review.plan.appliedCount} trường</Button></div></> : <><p className="sp-ai-drawer__muted">{progress.failed || progress.cancelled ? 'Bạn có thể bắt đầu một yêu cầu mới.' : 'Có thể đóng bảng này và tiếp tục sửa form.'}</p><div className="sp-ai-drawer__actions"><Button type="button" variant="tonal" onClick={onClose}>Tiếp tục sửa form</Button>{progress.syncing && onRefresh ? <Button type="button" variant="filled" onClick={onRefresh}>Tải lại kết quả</Button> : progress.active && onCancelJob && !isReadOnly ? <Button type="button" variant="outlined" onClick={onCancelJob} loading={isCancelling}>Hủy tác vụ</Button> : onRequestAgain && !isReadOnly && <Button type="button" variant="filled" onClick={onRequestAgain}>Tra cứu lại</Button>}</div></>}
      </OffCanvas.Footer>
    </OffCanvas>
  );
};
AISuggestionDrawer.propTypes = { isOpen: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, job: PropTypes.object, suggestionData: PropTypes.object, suggestionId: PropTypes.string, currentValues: PropTypes.object, formErrors: PropTypes.object, metadata: PropTypes.object, onApply: PropTypes.func.isRequired, isReadOnly: PropTypes.bool, onCancelJob: PropTypes.func, isCancelling: PropTypes.bool, onRequestAgain: PropTypes.func, onRefresh: PropTypes.func, hasNewResult: PropTypes.bool, onOpenLatest: PropTypes.func };
export default AISuggestionDrawer;
