/**
 * @file use-ai-suggestion-request.js
 * @module Admin/Movies/Hooks
 * @description Stable request draft and explicit catalog identity selection for the AI modal.
 */
import { useEffect, useRef, useState } from 'react';

import aiService from '@/shared/services/ai.service';

import { createAiResolutionBinding, extractFormContextForAI } from '../mappers/ai-suggestion.mapper';

/** @hook useAiSuggestionRequest @description Preserve user input while resolving the intended work. @param {object} options @returns {object} */
export const useAiSuggestionRequest = ({ isOpen, formValues, onSubmit, isLoading, target }) => {
  const initialised = useRef(false);
  const pending = useRef(null);
  const mounted = useRef(false);
  const openRef = useRef(isOpen);
  const bindingRef = useRef('');
  const valuesRef = useRef(formValues);
  const resolutionRef = useRef(null);
  valuesRef.current = formValues;
  const [values, setValues] = useState({ title: '', year: '', media_type: '', type: 'all', mode: 'auto', force_refresh: false });
  const [resolution, setResolution] = useState(null);
  const [candidateId, setCandidateId] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState('');
  const context = extractFormContextForAI(formValues);
  const binding = createAiResolutionBinding({ ...values, target }, context);
  bindingRef.current = binding;
  openRef.current = isOpen;
  const currentResolution = resolution?.binding === binding ? resolution.result : null;
  const currentCandidateId = currentResolution ? candidateId : '';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current?.controller.abort(); pending.current = null; };
  }, []);

  useEffect(() => {
    if (pending.current && (!isOpen || pending.current.binding !== binding)) {
      pending.current.controller.abort();
      pending.current = null;
      setIsResolving(false);
    }
    if (resolution && resolution.binding !== binding) {
      setResolution(null); setCandidateId(''); setError('');
    }
  }, [binding, isOpen, resolution]);

  useEffect(() => {
    if (!isOpen || initialised.current) return;
    initialised.current = true;
    const context = extractFormContextForAI(valuesRef.current);
    setValues((current) => ({ ...current, title: context.current_title, year: String(context.release_year || context.release_date?.slice(0, 4) || '') }));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && currentResolution && !isResolving) resolutionRef.current?.focus({ preventScroll: false });
  }, [isOpen, currentResolution, isResolving]);

  const update = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError('');
    if (['title', 'year', 'media_type'].includes(key)) { setResolution(null); setCandidateId(''); }
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    if (!isOpen || isLoading || isResolving || pending.current || !values.title.trim()) return;
    const year = values.year ? Number(values.year) : undefined;
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2100)) { setError('Năm phát hành phải từ 1900 đến 2100.'); return; }
    if (currentResolution?.candidates?.length && !currentCandidateId) { setError('Chọn một tác phẩm để tạo gợi ý.'); return; }
    setError('');
    const request = { binding, controller: new AbortController() };
    pending.current = request;
    const isCurrent = () => mounted.current && openRef.current && bindingRef.current === request.binding && pending.current === request;
    try {
      if (!currentResolution || !currentCandidateId) {
        setIsResolving(true);
        const result = await aiService.resolveMovie({ target, title: values.title.trim(), year, ...(values.media_type ? { media_type: values.media_type } : {}), context }, { signal: request.controller.signal });
        if (!isCurrent()) return;
        setResolution({ result, binding });
        if (result.status === 'matched') setCandidateId(result.selectedCandidate?.candidateId || result.candidates?.[0]?.candidateId || '');
        return;
      }
      await onSubmit({ ...Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== 'media_type' || value)), title: values.title.trim(), year, resolutionId: currentResolution.resolutionId, candidateId: currentCandidateId, enable_web_search: false, context });
    } catch (failure) {
      if (!isCurrent() || request.controller.signal.aborted) return;
      if (['AI_RESOLUTION_EXPIRED', 'AI_RESOLUTION_MISMATCH', 'AI_IDENTITY_REQUIRED'].includes(failure?.code)) { setResolution(null); setCandidateId(''); }
      setError(failure?.message || 'Không thể tra cứu tác phẩm. Vui lòng thử lại.');
    }
    finally {
      if (pending.current === request) {
        pending.current = null;
        if (mounted.current) setIsResolving(false);
      }
    }
  };
  return { values, update, resolution: currentResolution, resolutionRef, candidateId: currentCandidateId, selectCandidate: (id) => { if (currentResolution?.candidates?.some((candidate) => candidate.candidateId === id)) { setCandidateId(id); setError(''); } }, busy: isLoading || isResolving, isResolving, error, submit };
};
