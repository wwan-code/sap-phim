/**
 * @file use-ai-suggestion-review.js
 * @module Admin/Movies/Hooks
 * @description Review filters, scoped selection and exact overwrite confirmation over one shared merge plan.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { buildSuggestionMergePlan, createSuggestionDiff, isSuggestionFieldEmpty, safeSuggestionUrl, suggestionConfidencePercent, suggestionNotice } from '../mappers/ai-suggestion.mapper';
import { filterReviewFields, readableEvidenceValue, REVIEW_FILTERS, REVIEW_GROUP_LABELS, sourceDiagnostics, sourceLabel } from '../utils/ai-review.util';

const WARNING_LABELS = {
  POSSIBLE_DIRECTOR_AUTHOR_CONFUSION: 'Tên đạo diễn có thể bị nhầm với tác giả nguyên tác.',
  SEVERE_UNRESOLVED_CONFLICT: 'Còn mâu thuẫn quan trọng giữa các nguồn chưa được xác minh.',
  LOW_EVIDENCE_QUALITY: 'Chưa có đủ chứng cứ để xác nhận tác phẩm.',
  SUSPICIOUS_EPISODE_COUNT: 'Cần đối chiếu số tập với định dạng tác phẩm.',
  INVALID_RELEASE_DATE: 'Ngày phát hành không hợp lệ đã được loại khỏi gợi ý.',
  UNSUPPORTED_FIELD_REMOVED: 'Giá trị không khớp chứng cứ đã được loại khỏi gợi ý.',
  UNSUPPORTED_TITLE_TYPE_REMOVED: 'Loại tiêu đề không khớp nguồn đã được loại khỏi gợi ý.',
  LOCALIZATION_INCOMPLETE: 'Chưa có phần giới thiệu tiếng Việt đạt yêu cầu. Hãy bổ sung hoặc biên tập trước khi lưu phim.',
  VIETNAMESE_SYNOPSIS_REQUIRED: 'Chưa có phần giới thiệu tiếng Việt đạt yêu cầu. Hãy bổ sung hoặc biên tập trước khi lưu phim.',
  VIETNAMESE_TRANSLATION_MISSING: 'Chưa có bản giới thiệu tiếng Việt. Dữ liệu đã xác minh vẫn được giữ lại.',
};

/** @hook useAiSuggestionReview @description Preserve choices through filtering and background updates; confirm the exact current form. */
export const useAiSuggestionReview = ({ suggestionData, suggestionId, currentValues = {}, formErrors = {}, metadata = {}, onApply, isReadOnly }) => {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [mergeMode, setMergeMode] = useState('fill_empty');
  const [confirmation, setConfirmation] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [activeGroup, setActiveGroup] = useState('basic');
  const [filter, setFilter] = useState('changed');
  const [search, setSearch] = useState('');
  const initialisedResult = useRef(null);
  const confirmationRef = useRef(null);
  const scrollRef = useRef(null);
  const applyButtonRef = useRef(null);
  const previousConfirmation = useRef(false);
  const reviewScroll = useRef(0);
  const groupNavRef = useRef(null);
  const sections = useMemo(() => createSuggestionDiff(suggestionData, currentValues, formErrors, metadata).map((section) => ({
    ...section, label: REVIEW_GROUP_LABELS[section.id], fields: section.fields.map((field) => ({
      ...field,
      currentLabel: readableEvidenceValue(field.key === 'titles' && isSuggestionFieldEmpty(field.formValue, 'titles') && currentValues.title?.trim() ? [{ type: 'default', title: currentValues.title }] : field.formValue, field.key, metadata),
      proposedLabel: suggestionData.relationship_labels?.[field.key] ? field.proposedLabel : readableEvidenceValue(field.aiValue, field.key, metadata),
      conflicts: (suggestionData.conflicts || []).filter((conflict) => conflict.field === field.key),
    })),
  })), [suggestionData, currentValues, formErrors, metadata]);
  const fields = useMemo(() => sections.flatMap((section) => section.fields), [sections]);
  const identity = suggestionId || suggestionData;
  useEffect(() => {
    if (!suggestionData || initialisedResult.current === identity) return;
    initialisedResult.current = identity;
    setSelectedKeys(fields.filter((field) => field.isRecommended).map((field) => field.key));
    setMergeMode('fill_empty'); setConfirmation(null); setFilter('changed'); setSearch('');
    setActiveGroup(sections[0]?.id || 'assets');
  }, [identity, suggestionData, fields, sections]);
  const plan = useMemo(() => buildSuggestionMergePlan(selectedKeys, suggestionData || {}, { currentValues, mergeMode }), [selectedKeys, suggestionData, currentValues, mergeMode]);
  const signature = JSON.stringify({ changes: plan.changes, currentValues, selectedKeys, mergeMode });
  const confirmationIsCurrent = confirmation !== null && confirmation === signature;
  useEffect(() => {
    if (confirmation !== null && confirmation !== signature) setConfirmation(null);
  }, [confirmation, signature]);
  useEffect(() => {
    if (confirmationIsCurrent) {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      confirmationRef.current?.focus({ preventScroll: true });
    } else if (previousConfirmation.current) {
      if (scrollRef.current) scrollRef.current.scrollTop = reviewScroll.current;
      applyButtonRef.current?.focus({ preventScroll: true });
    }
    previousConfirmation.current = confirmationIsCurrent;
  }, [confirmationIsCurrent, signature]);
  const changeMode = (value) => { setMergeMode(value); setConfirmation(null); };
  const toggle = (key) => { setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]); setConfirmation(null); };
  const apply = () => {
    if (isReadOnly || !plan.appliedCount) return;
    if (plan.overwrites.length && !confirmationIsCurrent) {
      reviewScroll.current = scrollRef.current?.scrollTop || 0;
      setConfirmation(signature); return;
    }
    onApply(selectedKeys, suggestionData, { mergeMode, confirmedPlan: plan.overwrites.length ? JSON.stringify(plan.changes) : undefined });
  };
  const copy = async (url) => {
    try { await navigator.clipboard.writeText(url); setCopiedUrl(url); toast.success('Đã sao chép URL ảnh.'); }
    catch { toast.error('Không thể sao chép. Hãy mở ảnh và sao chép URL từ trình duyệt.'); }
  };
  const assets = Object.entries(suggestionData?.visual_assets || {}).filter(([kind]) => ['posters', 'covers', 'banners'].includes(kind)).map(([kind, items]) => ({ kind, label: ({ posters: 'Poster', covers: 'Ảnh ngang', banners: 'Banner' })[kind], items: (Array.isArray(items) ? items : []).filter((item) => safeSuggestionUrl(item.url)) })).filter((group) => group.items.length);
  const citations = (suggestionData?.web_citations || []).filter((item) => safeSuggestionUrl(item.url));
  const warnings = [...new Set([...(suggestionData?.flags || []), ...(suggestionData?.warnings || [])].map((item) => {
    const text = typeof item === 'string' ? item : item.message || item.code;
    return WARNING_LABELS[text] || (/^[A-Z][A-Z0-9_]+$/.test(text || '') ? 'Một giá trị chưa đủ chứng cứ cần được kiểm tra.' : text);
  }).filter(Boolean).concat(sourceDiagnostics(suggestionData?.evidence_summary?.source_errors || suggestionData?.source_errors)))];
  const partialReason = suggestionNotice(suggestionData?.partial_reason, 'Một số nguồn chưa đầy đủ. Kết quả giữ lại dữ liệu đã xác minh.');
  const conflicts = (suggestionData?.conflicts || []).map((item) => ({ ...item,
    label: fields.find((field) => field.key === item.field)?.label || 'Thông tin tác phẩm',
    detail: item.message || item.description || item.difference_summary || 'Các nguồn chưa thống nhất. Hãy đối chiếu trước khi áp dụng.',
  }));
  const sourceSummary = ['tmdb', 'anilist', 'jikan', 'omdb'].filter((source) => suggestionData?.evidence_summary?.['has_' + source]).map(sourceLabel);
  const groups = [...sections.map((section) => ({ id: section.id, label: section.label, count: section.fields.length })), ...(assets.length ? [{ id: 'assets', label: 'Ảnh', count: assets.reduce((sum, group) => sum + group.items.length, 0) }] : [])];
  const effectiveGroup = groups.some((group) => group.id === activeGroup) ? activeGroup : groups[0]?.id;
  const changeGroup = (id) => { setActiveGroup(id); if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  const onGroupKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(groupNavRef.current?.querySelectorAll('[role="tab"]') || []);
    const index = tabs.indexOf(event.target);
    if (index < 0 || !tabs.length) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    changeGroup(groups[next].id); tabs[next].focus();
  };
  const visibleFields = filterReviewFields(sections.find((section) => section.id === effectiveGroup)?.fields || [], { filter, search, selectedKeys });
  const visibleSelectable = visibleFields.filter((field) => field.isDirty);
  const selectVisible = () => { setSelectedKeys((current) => [...new Set([...current, ...visibleSelectable.map((field) => field.key)])]); setConfirmation(null); };
  const deselectVisible = () => { const keys = new Set(visibleFields.map((field) => field.key)); setSelectedKeys((current) => current.filter((key) => !keys.has(key))); setConfirmation(null); };
  const confirmationChanges = plan.overwrites.map((change) => ({ ...change, label: fields.find((field) => field.key === change.key)?.label || change.key,
    currentLabel: fields.find((field) => field.key === change.key)?.currentLabel || readableEvidenceValue(change.previousValue, change.key, metadata),
    proposedLabel: fields.find((field) => field.key === change.key)?.proposedLabel || readableEvidenceValue(change.value, change.key, metadata),
  }));
  return { confirmationRef, scrollRef, applyButtonRef, confirmationChanges, sourceSummary, partialReason, sections, fields, selectedKeys, mergeMode, changeMode, toggle,
    groups, groupNavRef, onGroupKeyDown, activeGroup: effectiveGroup, changeGroup, filter, setFilter, filters: REVIEW_FILTERS, search, setSearch, visibleFields,
    selectVisible, deselectVisible, visibleSelectableCount: visibleSelectable.length,
    selectAll: () => { setSelectedKeys(fields.filter((field) => field.isDirty).map((field) => field.key)); setConfirmation(null); }, deselectAll: () => { setSelectedKeys([]); setConfirmation(null); },
    plan, apply, confirmationIsCurrent, cancelConfirmation: () => setConfirmation(null), copiedUrl, copy, assets, citations, warnings, conflicts,
    confidence: suggestionConfidencePercent(suggestionData?.confidence_score), provenanceLabel: sourceLabel,
  };
};
