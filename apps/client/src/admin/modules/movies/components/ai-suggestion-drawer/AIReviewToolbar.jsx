/**
 * @file AIReviewToolbar.jsx
 * @module Admin/Movies/Components
 * @description Keyboard accessible groups and filters with visible-only selection controls.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Search, CheckCheck } from 'lucide-react';

/** @component AIReviewToolbar @description Render navigation and filters without changing hidden selections. */
const AIReviewToolbar = ({ review, panelId, disabled }) => (
  <div className="sp-ai-drawer__toolbar">
    <div ref={review.groupNavRef} className="sp-ai-drawer__tabs" role="tablist" aria-label="Nhóm thông tin" onKeyDown={review.onGroupKeyDown}>{review.groups.map((group) => <button type="button" role="tab" id={panelId + '-' + group.id} aria-controls={panelId} aria-selected={review.activeGroup === group.id} tabIndex={review.activeGroup === group.id ? 0 : -1} key={group.id} onClick={() => review.changeGroup(group.id)}>{group.label}<span>{group.count}</span></button>)}</div>
    {review.activeGroup !== 'assets' && <>
      <div className="sp-ai-drawer__filter-line"><div className="sp-ai-drawer__filters" role="group" aria-label="Lọc trường dữ liệu">{review.filters.map((filter) => <button type="button" key={filter.id} aria-pressed={review.filter === filter.id} onClick={() => review.setFilter(filter.id)}>{filter.label}</button>)}</div><label className="sp-ai-drawer__search"><Search size={15} aria-hidden="true" /><input type="search" value={review.search} onChange={(event) => review.setSearch(event.target.value)} placeholder="Tìm tên trường" aria-label="Tìm theo tên trường" /></label></div>
      <div className="sp-ai-drawer__selection-line"><span>{review.visibleFields.length} trường đang hiển thị</span><div><button type="button" disabled={disabled || !review.visibleSelectableCount} onClick={review.selectVisible}><CheckCheck size={14} aria-hidden="true" />Chọn đang hiển thị</button><button type="button" disabled={disabled || !review.visibleFields.some((field) => review.selectedKeys.includes(field.key))} onClick={review.deselectVisible}>Bỏ chọn đang hiển thị</button></div></div>
    </>}
  </div>
);
AIReviewToolbar.propTypes = { review: PropTypes.object.isRequired, panelId: PropTypes.string.isRequired, disabled: PropTypes.bool };
export default AIReviewToolbar;
