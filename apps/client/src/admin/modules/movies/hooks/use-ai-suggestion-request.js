/**
 * @file use-ai-suggestion-request.js
 * @module Admin/Movies/Hooks
 * @description Stable request draft and explicit catalog identity selection for the AI modal.
 */
import { useEffect, useRef, useState } from 'react';

import aiService from '@/shared/services/ai.service';

import { extractFormContextForAI } from '../mappers/ai-suggestion.mapper';

/** @hook useAiSuggestionRequest @description Preserve user input while resolving the intended work. @param {object} options @returns {object} */
export const useAiSuggestionRequest = ({ isOpen, formValues, onSubmit, isLoading, target }) => {
  const initialised = useRef(false);
  const inFlight = useRef(false);
  const valuesRef = useRef(formValues);
  const resolutionRef = useRef(null);
  valuesRef.current = formValues;
  const [values, setValues] = useState({ title: '', year: '', media_type: '', type: 'all', mode: 'auto', force_refresh: false });
  const [resolution, setResolution] = useState(null);
  const [candidateId, setCandidateId] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || initialised.current) return;
    initialised.current = true;
    const context = extractFormContextForAI(valuesRef.current);
    setValues((current) => ({ ...current, title: context.current_title, year: String(context.release_year || context.release_date?.slice(0, 4) || '') }));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && resolution && !isResolving) resolutionRef.current?.focus({ preventScroll: false });
  }, [isOpen, resolution, isResolving]);

  const update = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError('');
    if (['title', 'year', 'media_type'].includes(key)) { setResolution(null); setCandidateId(''); }
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    if (isLoading || isResolving || inFlight.current || !values.title.trim()) return;
    const year = values.year ? Number(values.year) : undefined;
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2100)) { setError('Năm phát hành phải từ 1900 đến 2100.'); return; }
    if (resolution?.candidates?.length && !candidateId) { setError('Chọn một tác phẩm để tạo gợi ý.'); return; }
    setError('');
    inFlight.current = true;
    try {
      if (!resolution || !candidateId) {
        setIsResolving(true);
        const result = await aiService.resolveMovie({ target, title: values.title.trim(), year, ...(values.media_type ? { media_type: values.media_type } : {}) });
        setResolution(result);
        if (result.status === 'matched') setCandidateId(result.selectedCandidate?.candidateId || result.candidates?.[0]?.candidateId || '');
        return;
      }
      await onSubmit({ ...Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== 'media_type' || value)), title: values.title.trim(), year, resolutionId: resolution.resolutionId, candidateId, enable_web_search: false, context: extractFormContextForAI(valuesRef.current) });
    } catch (failure) {
      if (['AI_RESOLUTION_EXPIRED', 'AI_RESOLUTION_MISMATCH', 'AI_IDENTITY_REQUIRED'].includes(failure?.code)) { setResolution(null); setCandidateId(''); }
      setError(failure?.message || 'Không thể tra cứu tác phẩm. Vui lòng thử lại.');
    }
    finally { inFlight.current = false; setIsResolving(false); }
  };
  return { values, update, resolution, resolutionRef, candidateId, selectCandidate: (id) => { setCandidateId(id); setError(''); }, busy: isLoading || isResolving, isResolving, error, submit };
};
