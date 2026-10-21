/**
 * @file AIFieldRow.jsx
 * @module Admin/Movies/Components
 * @description One accessible field comparison with evidence disclosed on demand.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, AlertTriangle } from 'lucide-react';

import { readableEvidenceValue, sourceLabel } from '../../utils/ai-review.util';
import AIFieldValue from './AIFieldValue';

/** @component AIFieldRow @description Render current/proposed values and factual observations without raw JSON. */
const AIFieldRow = ({ field, selected, onToggle, disabled, mergeMode, metadata }) => (
  <article className={'sp-ai-drawer__row' + (selected ? ' sp-ai-drawer__row--selected' : '')}>
    <div className="sp-ai-drawer__row-main">
      <label className="sp-ai-drawer__field-name">
        <input type="checkbox" checked={selected} onChange={() => onToggle(field.key)} disabled={disabled || !field.isDirty} />
        <span><strong>{field.label}</strong><small>{!field.isDirty ? 'Không thay đổi' : field.isSafe ? 'Ô trống' : mergeMode === 'overwrite_all' ? 'Cần xác nhận ghi đè' : 'Giữ giá trị hiện tại'}</small></span>
      </label>
      <div className="sp-ai-drawer__value sp-ai-drawer__value--current">
        <span className="sp-ai-drawer__mobile-label">Hiện tại</span>
        <AIFieldValue fieldKey={field.key} rawValue={field.formValue} labelValue={field.currentLabel} metadata={metadata} isProposed={false} />
      </div>
      <div className="sp-ai-drawer__value sp-ai-drawer__value--proposed">
        <span className="sp-ai-drawer__mobile-label">Gợi ý</span>
        <AIFieldValue fieldKey={field.key} rawValue={field.aiValue} labelValue={field.proposedLabel} metadata={metadata} isProposed={true} />
      </div>
      <div className="sp-ai-drawer__field-status">
        <span className="sp-ai-drawer__score">{field.isAiTranslation ? 'AI biên dịch · cần duyệt' : field.observations.length ? 'Có dữ liệu nguồn · cần duyệt' : 'Cần đối chiếu nguồn'}</span>
        {(field.conflicts.length > 0 || field.hasError) && <span className="sp-ai-drawer__attention"><AlertTriangle size={13} aria-hidden="true" />Cần kiểm tra</span>}
      </div>
    </div>
    <details className="sp-ai-drawer__evidence-detail">
      <summary><ChevronDown size={13} aria-hidden="true" /><span>Chứng cứ cho {field.label.toLowerCase()}</span><span className="sp-ai-drawer__source-label">{sourceLabel(field.provenance)}</span></summary>
      <div className="sp-ai-drawer__evidence-content">
        {(field.currentLabel.length > 160 || field.proposedLabel.length > 160) && (
          <div className="sp-ai-drawer__full-values">
            <div>
              <strong>Hiện tại</strong>
              <AIFieldValue fieldKey={field.key} rawValue={field.formValue} labelValue={field.currentLabel} metadata={metadata} isProposed={false} />
            </div>
            <div>
              <strong>Gợi ý đầy đủ</strong>
              <AIFieldValue fieldKey={field.key} rawValue={field.aiValue} labelValue={field.proposedLabel} metadata={metadata} isProposed={true} />
            </div>
          </div>
        )}
        {field.hasError && <p className="sp-ai-drawer__attention">Giá trị trong form đang có lỗi cần kiểm tra.</p>}
        {!field.observations.length && <p>Chưa có giá trị nguồn chi tiết cho trường này.</p>}
        {field.observations.map((item, index) => <div className="sp-ai-drawer__observation" key={String(item.source) + index}><strong>{sourceLabel(item.source)}</strong><span>{readableEvidenceValue(item.value, field.key, metadata)}</span></div>)}
        {field.conflicts.map((conflict, index) => <div className="sp-ai-drawer__conflict" key={index}><strong>Nguồn chưa thống nhất</strong><p>{conflict.difference_summary || conflict.message || conflict.description || 'Hãy đối chiếu các giá trị trước khi áp dụng.'}</p>{(conflict.values || []).map((item, itemIndex) => <div className="sp-ai-drawer__observation" key={itemIndex}><strong>{sourceLabel(item.source)}</strong><span>{readableEvidenceValue(item.value, field.key, metadata)}</span></div>)}</div>)}
      </div>
    </details>
  </article>
);
AIFieldRow.propTypes = { field: PropTypes.object.isRequired, selected: PropTypes.bool.isRequired, onToggle: PropTypes.func.isRequired, disabled: PropTypes.bool, mergeMode: PropTypes.string, metadata: PropTypes.object };
export default AIFieldRow;
