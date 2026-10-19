/**
 * @file AISuggestionModal.jsx
 * @module Admin/Movies/Components
 * @description Deliberate work selection with clear steps, compact configuration and preserved request input.
 */
import React, { useId } from 'react';
import PropTypes from 'prop-types';
import { Sparkles, Search, Check, Film, ChevronDown } from 'lucide-react';

import Modal from '@/shared/components/ui/modal/Modal';
import TextField from '@/shared/components/ui/text-field/TextField';
import Button from '@/shared/components/ui/button/Button';

import { useAiSuggestionRequest } from '../../hooks/use-ai-suggestion-request';
import { safeSuggestionUrl } from '../../mappers/ai-suggestion.mapper';
import { sourceLabel } from '../../utils/ai-review.util';
import AIWorkflowSteps from '../ai-suggestion-shared/AIWorkflowSteps';
import './ai-suggestion-modal.scss';

const SCOPE_OPTIONS = [{ value: 'all', label: 'Toàn bộ thông tin' }, { value: 'metadata', label: 'Thông tin và tiêu đề' }, { value: 'cast', label: 'Diễn viên và nhân vật' }, { value: 'seo', label: 'Tiêu đề và từ khóa SEO' }, { value: 'synopsis', label: 'Chỉ tóm tắt nội dung' }];
const FORMAT_OPTIONS = [{ value: '', label: 'Tất cả định dạng' }, { value: 'movie', label: 'Phim điện ảnh' }, { value: 'tv', label: 'Phim truyền hình' }, { value: 'series', label: 'Phim bộ' }, { value: 'ova', label: 'OVA' }, { value: 'ona', label: 'ONA' }, { value: 'special', label: 'Đặc biệt' }];
const MODES = [{ value: 'auto', label: 'Tự động', description: 'Đối chiếu và bổ sung khi thiếu chứng cứ.' }, { value: 'fast', label: 'Nhanh', description: 'Ưu tiên dữ liệu nguồn, một lượt tổng hợp.' }, { value: 'deep', label: 'Chuyên sâu', description: 'Thêm lượt tổng hợp khi có bằng chứng mới.' }];

/** @component AISuggestionModal @description Render catalog identity and explicit request controls without creating jobs from components. */
const AISuggestionModal = ({ isOpen, onClose, onSubmit, isLoading = false, formValues = {}, target }) => {
  const fieldId = useId();
  const request = useAiSuggestionRequest({ isOpen, onSubmit, isLoading, formValues, target });
  const { values, update, resolution, resolutionRef, candidateId, selectCandidate, busy, error, submit, isResolving } = request;
  const mustSelect = resolution?.candidates?.length > 0 && !candidateId;
  return (
    <Modal className="sp-ai-modal" aria-label="Gợi ý thông tin phim" open={isOpen} onClose={onClose} size="large" disableBackdropClick={busy} disableEscapeKeyDown={busy}>
      <Modal.Header onClose={onClose} showCloseButton={!busy}><div className="sp-ai-modal__header"><div className="sp-ai-modal__heading"><span className="sp-ai-modal__emblem"><Sparkles size={22} aria-hidden="true" /></span><div><p>Trợ lý thông tin phim</p><h2>Bắt đầu từ đúng tác phẩm</h2></div></div><AIWorkflowSteps active={0} /></div></Modal.Header>
      <Modal.Body>
        <form className="sp-ai-modal__form" onSubmit={submit} aria-busy={busy}>
          <div className="sp-ai-modal__intro"><h3>Tìm phim hoặc anime</h3><p>Dùng tên gốc hoặc tên quốc tế để đối chiếu chính xác hơn.</p></div>
          <TextField id={fieldId + '-title'} label="Tên phim / Anime" placeholder="Ví dụ: Dune, Your Name…" required value={values.title} onChange={(event) => update('title', event.target.value)} disabled={busy} autoFocus fullWidth />
          <div className="sp-ai-modal__row"><TextField id={fieldId + '-year'} label="Năm phát hành (nếu biết)" type="number" min={1900} max={2100} value={values.year} onChange={(event) => update('year', event.target.value)} disabled={busy} fullWidth /><label className="sp-ai-modal__select"><span>Định dạng tác phẩm</span><select value={values.media_type} onChange={(event) => update('media_type', event.target.value)} disabled={busy}>{FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
          {error && <p className="sp-ai-modal__error" role="alert">{error}</p>}
          {isResolving && <p className="sp-ai-modal__lookup" role="status">Đang tra cứu các nguồn để nhận diện tác phẩm…</p>}
          {resolution && <fieldset ref={resolutionRef} tabIndex={-1} className="sp-ai-modal__candidates"><legend>{resolution.status === 'not_found' ? 'Chưa tìm thấy tác phẩm phù hợp' : resolution.status === 'ambiguous' ? 'Bạn muốn tra cứu tác phẩm nào?' : 'Tác phẩm đã được nhận diện'}</legend><p className="sp-ai-modal__hint">{resolution.status === 'not_found' ? 'Thử tên gốc, năm phát hành hoặc định dạng cụ thể hơn. Nội dung bạn nhập vẫn được giữ lại.' : 'Kiểm tra năm và định dạng trước khi tạo gợi ý.'}</p><div className="sp-ai-modal__candidate-grid">{(resolution.candidates || []).map((candidate) => <label key={candidate.candidateId} className={'sp-ai-modal__candidate' + (candidateId === candidate.candidateId ? ' sp-ai-modal__candidate--selected' : '')}><input type="radio" name="ai-candidate" value={candidate.candidateId} checked={candidateId === candidate.candidateId} onChange={() => selectCandidate(candidate.candidateId)} disabled={busy} /><span className="sp-ai-modal__poster">{safeSuggestionUrl(candidate.imageUrl) ? <img src={candidate.imageUrl} alt="" loading="lazy" /> : <Film size={24} aria-hidden="true" />}</span><span className="sp-ai-modal__candidate-copy"><strong>{candidate.title}</strong><span>{candidate.year || 'Chưa rõ năm'} · {FORMAT_OPTIONS.find((option) => option.value === candidate.mediaType)?.label || 'Chưa rõ định dạng'}</span><small>{(candidate.sources || Object.keys(candidate.sourceIds || {})).map((source) => sourceLabel(typeof source === 'string' ? source : source.name || source.source)).join(' · ')}</small></span>{candidateId === candidate.candidateId && <Check className="sp-ai-modal__candidate-check" size={16} aria-hidden="true" />}</label>)}</div></fieldset>}
          <details className="sp-ai-modal__advanced"><summary><span>Tùy chọn tổng hợp<small>{SCOPE_OPTIONS.find((option) => option.value === values.type)?.label} · {MODES.find((option) => option.value === values.mode)?.label}</small></span><ChevronDown size={16} aria-hidden="true" /></summary><div className="sp-ai-modal__advanced-body"><label className="sp-ai-modal__select"><span>Phạm vi trích xuất</span><select value={values.type} onChange={(event) => update('type', event.target.value)} disabled={busy}>{SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><fieldset className="sp-ai-modal__modes"><legend>Chế độ phân tích</legend>{MODES.map((option) => <label key={option.value} className={'sp-ai-modal__mode' + (values.mode === option.value ? ' sp-ai-modal__mode--selected' : '')}><input type="radio" name="ai-mode" checked={values.mode === option.value} onChange={() => update('mode', option.value)} disabled={busy} /><span><strong>{option.label}</strong><span>{option.description}</span></span></label>)}</fieldset><label className="sp-ai-modal__refresh"><input type="checkbox" checked={values.force_refresh} onChange={(event) => update('force_refresh', event.target.checked)} disabled={busy} /><span>Tra cứu mới, bỏ qua kết quả đã lưu</span></label><p className="sp-ai-modal__hint">Đối chiếu qua các API nguồn và provider miễn phí đã cấu hình. Tìm kiếm web gốc đang tắt.</p></div></details>
        </form>
      </Modal.Body>
      <Modal.Footer className="sp-ai-modal__footer" align="between"><span>Gợi ý sẽ được duyệt trước khi cập nhật form.</span><div><Button type="button" variant="tonal" onClick={onClose} disabled={busy}>Đóng</Button><Button type="button" variant="filled" startIcon={candidateId ? <Sparkles size={16} /> : <Search size={16} />} loadingPosition="start" loading={busy} disabled={!values.title.trim() || busy || mustSelect} onClick={submit}>{isResolving ? 'Đang tra cứu' : isLoading ? 'Đang gửi yêu cầu' : candidateId ? 'Tạo gợi ý' : 'Tra cứu tác phẩm'}</Button></div></Modal.Footer>
    </Modal>
  );
};
AISuggestionModal.propTypes = { isOpen: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onSubmit: PropTypes.func.isRequired, isLoading: PropTypes.bool, formValues: PropTypes.object, target: PropTypes.object };
export default AISuggestionModal;


