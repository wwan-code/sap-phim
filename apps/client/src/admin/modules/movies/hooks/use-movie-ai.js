/**
 * @file use-movie-ai.js
 * @module Admin/Movies/Hooks
 * @description Own account-scoped suggestion jobs, exact GET recovery, cancellation and reviewed form changes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { useJobSocket } from '@/hooks/socket/use-job-socket';
import aiService from '@/shared/services/ai.service';
import { useJobStore } from '@/store/use-job-store';

import { buildSuggestionMergePlan, mergeSuggestionToForm } from '../mappers/ai-suggestion.mapper';
import { getAiDraftId, retireAiDraft, matchesAiJobTarget, recoverAiJob } from '../utils/ai-job.util';

/** @hook useMovieAi @description Keep suggestions attached to their immutable owner and form target. @param {object} options @returns {object} */
export const useMovieAi = ({ ownerId, movieId, isReadOnly, form, requestedJobId }) => {
  const target = useMemo(() => ({ movieId: movieId ? String(movieId) : null, draftId: movieId || !ownerId ? null : getAiDraftId(ownerId, window.sessionStorage) }), [ownerId, movieId]);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [suggestionJob, setSuggestionJob] = useState(null);
  const [viewedAiJobId, setViewedAiJobId] = useState(null);
  const [viewedSnapshot, setViewedSnapshot] = useState(null);
  const [newResultJobId, setNewResultJobId] = useState(null);
  const [latestCompletedJob, setLatestCompletedJob] = useState(null);
  const latestCompletedRef = useRef(null);
  const reviewContextRef = useRef(null);
  reviewContextRef.current = { modalOpen: isAiModalOpen, drawerOpen: isAiDrawerOpen, visibleJobId: viewedAiJobId || suggestionJob?.jobId };
  const [activeAiJobId, setActiveAiJobId] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiCancelling, setIsAiCancelling] = useState(false);
  const mounted = useRef(true);
  const bindingRef = useRef({ ownerId, target });
  bindingRef.current = { ownerId, target };
  const jobs = useJobStore((state) => state.jobs);
  const belongs = useCallback((job) => matchesAiJobTarget(job, ownerId, target), [ownerId, target]);

  const accept = useCallback((job, open = false, intent = 'background') => {
    if (!mounted.current || !matchesAiJobTarget(job, bindingRef.current.ownerId, bindingRef.current.target) || !belongs(job)) return;
    const store = useJobStore.getState();
    const existing = store.jobs[job.jobId];
    if ((existing?.sequence ?? -1) > job.sequence || (existing?.isTerminal && !['completed', 'failed', 'cancelled'].includes(job.status))) {
      // A delayed GET may open the latest retained snapshot, but cannot roll it back.
      if (intent === 'explicit' && belongs(existing)) {
        setViewedAiJobId(job.jobId); setViewedSnapshot(existing);
        setSuggestionJob((current) => current?.jobId === job.jobId ? current : null);
        setIsAiModalOpen(false);
        if (open) setIsAiDrawerOpen(true);
        if (['queued', 'processing', 'completed'].includes(existing.status)) setActiveAiJobId(job.jobId);
      }
      return;
    }
    store.registerJob(job.jobId, { jobType: 'ai', ownerId: job.ownerId, target: job.target, requestId: job.requestId, title: job.title || 'Gợi ý dữ liệu phim' });
    store.updateJobProgress({ ...job, jobType: 'ai' });
    if (job.status === 'completed' && job.result) {
      const explicit = intent === 'explicit';
      const latest = latestCompletedRef.current;
      const incomingTime = Date.parse(job.createdAt || job.updatedAt || '');
      const latestTime = Date.parse(latest?.createdAt || latest?.updatedAt || '');
      const comparable = Number.isFinite(incomingTime) && Number.isFinite(latestTime);
      const promoteLatest = !latest || latest.jobId === job.jobId || (comparable ? incomingTime >= latestTime : intent === 'background');
      if (promoteLatest) {
        latestCompletedRef.current = job;
        setLatestCompletedJob(job);
        if (intent === 'background' && reviewContextRef.current.visibleJobId && reviewContextRef.current.visibleJobId !== job.jobId) setNewResultJobId(job.jobId);
      }
      const context = reviewContextRef.current;
      const reviewingDifferentJob = context.drawerOpen && context.visibleJobId !== job.jobId;
      const preserveReview = !explicit && (context.modalOpen || reviewingDifferentJob);
      if (!preserveReview && (explicit || promoteLatest || context.visibleJobId === job.jobId)) {
        setSuggestionJob(job);
        setViewedAiJobId(job.jobId); setViewedSnapshot(job);
        if (open && (explicit || context.drawerOpen)) setIsAiDrawerOpen(true);
        if (explicit) setIsAiModalOpen(false);
        if (explicit && latestCompletedRef.current?.jobId === job.jobId) setNewResultJobId(null);
      }
      setActiveAiJobId((current) => current === job.jobId ? null : current);
    } else {
      const context = reviewContextRef.current;
      if (intent === 'explicit' || context.visibleJobId === job.jobId) {
        setViewedAiJobId(job.jobId); setViewedSnapshot(job);
        if (intent === 'explicit') { setSuggestionJob(null); setNewResultJobId(null); setIsAiModalOpen(false); if (open) setIsAiDrawerOpen(true); }
      }
      if (['queued', 'processing', 'completed'].includes(job.status)) setActiveAiJobId(job.jobId);
      else setActiveAiJobId((current) => current === job.jobId ? null : current);
    }
  }, [belongs]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    latestCompletedRef.current = null; setLatestCompletedJob(null);
    setSuggestionJob(null); setActiveAiJobId(null); setIsAiDrawerOpen(false); setIsAiModalOpen(false);
    setViewedAiJobId(null); setViewedSnapshot(null);
    setNewResultJobId(null);
    if (!ownerId) return;
    const restore = async () => {
      try {
        const response = await aiService.getJobs({ ...Object.fromEntries(Object.entries(target).filter(([, value]) => value)), limit: 20 });
        if (cancelled) return;
        const items = (response.items || []).filter(belongs);
        const active = items.find((job) => ['queued', 'processing'].includes(job.status));
        const completed = items.find((job) => job.status === 'completed' && job.result);
        if (completed) accept(completed, false, 'restore');
        if (active) accept(active);
      } catch (failure) { if (!cancelled) toast.error(failure?.message || 'Không thể khôi phục tác vụ AI.'); }
    };
    restore();
    return () => { cancelled = true; };
  }, [ownerId, target, belongs, accept]);

  const openResult = useCallback(async (jobId) => {
    const resultJobId = jobId || latestCompletedRef.current?.jobId;
    if (!resultJobId) return;
    try { accept(await recoverAiJob(aiService, resultJobId, ownerId, target), true, 'explicit'); }
    catch (failure) { toast.error(failure?.message || 'Không thể tải kết quả AI.'); }
  }, [accept, ownerId, target]);
  const openLatestResult = useCallback(() => openResult(), [openResult]);
  const openAiProgress = useCallback(() => openResult(activeAiJobId), [activeAiJobId, openResult]);
  const refreshViewedAiJob = useCallback(() => openResult(viewedAiJobId), [viewedAiJobId, openResult]);
  const openAiRequest = useCallback(() => { setIsAiDrawerOpen(false); setIsAiModalOpen(true); }, []);

  useEffect(() => { if (requestedJobId) openResult(requestedJobId); }, [requestedJobId, openResult]);
  useEffect(() => {
    const handler = (event) => { if (belongs(event.detail)) openResult(event.detail.jobId); };
    window.addEventListener('sap-phim:open-ai-drawer', handler);
    return () => window.removeEventListener('sap-phim:open-ai-drawer', handler);
  }, [belongs, openResult]);

  useEffect(() => {
    const matching = Object.values(jobs).filter((job) => job.jobType === 'ai' && belongs(job));
    const ongoing = matching.find((job) => job.isActive);
    if (ongoing) setActiveAiJobId(ongoing.jobId);
  }, [jobs, belongs]);

  useJobSocket(activeAiJobId, {
    jobType: 'ai',
    onComplete: async (job) => {
      if (!belongs(job)) return;
      try { accept(await recoverAiJob(aiService, job.jobId, ownerId, target), true); }
      catch (failure) { toast.error(failure?.message || 'Đã hoàn tất nhưng chưa thể tải kết quả; hãy xem lại sau.'); if (matchesAiJobTarget(job, bindingRef.current.ownerId, bindingRef.current.target)) setActiveAiJobId(job.jobId); }
    },
    onError: (job) => { if (belongs(job)) { accept(job); toast.error(job.error?.message || (typeof job.error === 'string' ? job.error : 'Tác vụ AI thất bại.')); } },
    onCancelled: (job) => { if (belongs(job)) accept(job); },
  });

  // REST polling recovers missed Socket packets and reconnects using the same persisted job.
  useEffect(() => {
    if (!activeAiJobId) return;
    let disposed = false;
    const poll = async () => {
      try {
        const job = await recoverAiJob(aiService, activeAiJobId, ownerId, target);
        if (!disposed) accept(job, job.status === 'completed');
      } catch { /* A temporary transport failure is retried by the next bounded poll. */ }
    };
    const timer = setInterval(poll, 5000);
    poll();
    return () => { disposed = true; clearInterval(timer); };
  }, [activeAiJobId, ownerId, target, accept]);

  const handleAiModalSubmit = async (payload) => {
    if (isReadOnly || !ownerId || isAiLoading) return;
    setIsAiLoading(true);
    const requestBinding = bindingRef.current;
    try {
      const job = await aiService.suggestMovie({ ...payload, target, requestId: crypto.randomUUID(), enable_web_search: false });
      if (requestBinding !== bindingRef.current && !matchesAiJobTarget(job, bindingRef.current.ownerId, bindingRef.current.target)) return;
      accept(job, true, 'explicit');
      setIsAiModalOpen(false);
    } finally { if (mounted.current) setIsAiLoading(false); }
  };

  const cancelAiJob = async (requestedId) => {
    const jobId = typeof requestedId === 'string' ? requestedId : activeAiJobId;
    if (!jobId || isAiCancelling || isReadOnly) return;
    setIsAiCancelling(true);
    try { accept(await aiService.cancelJob(jobId)); }
    catch (failure) { toast.error(failure?.message || 'Không thể hủy tác vụ.'); }
    finally { if (mounted.current) setIsAiCancelling(false); }
  };

  const handleApplyAiSuggestion = (selectedKeys, data, options = {}) => {
    if (isReadOnly || !belongs(suggestionJob) || data !== suggestionJob.result) return false;
    const plan = buildSuggestionMergePlan(selectedKeys, data, { ...options, currentValues: form.getValues() });
    if (plan.overwrites.length && options.confirmedPlan !== JSON.stringify(plan.changes)) return false;
    const applied = mergeSuggestionToForm(selectedKeys, data, form.setValue, { ...options, currentValues: form.getValues() });
    aiService.recordReview(suggestionJob.jobId, {
      appliedFields: applied.changes.map(({ key }) => key),
      skippedCount: applied.skippedCount,
      consideredCount: new Set(selectedKeys).size,
    }).catch(() => {});
    setIsAiDrawerOpen(false);
    toast.success(`Đã áp dụng ${applied.appliedCount} trường, bỏ qua ${applied.skippedCount} trường. Kiểm tra và lưu phim để hoàn tất.`);
    return true;
  };
  const activeAiJob = activeAiJobId && belongs(jobs[activeAiJobId]) ? jobs[activeAiJobId] : null;
  const viewedAiJob = useMemo(() => {
    const stored = jobs[viewedAiJobId];
    const snapshot = belongs(viewedSnapshot) ? viewedSnapshot : null;
    const live = belongs(stored) ? stored : null;
    if (!snapshot && !live) return null;
    const latest = (live?.sequence ?? -1) > (snapshot?.sequence ?? -1) ? { ...snapshot, ...live } : { ...live, ...snapshot };
    const result = suggestionJob?.jobId === viewedAiJobId ? suggestionJob.result : null;
    return { ...latest, result, outputs: result, isReconnecting: live?.isReconnecting, isStale: live?.isStale };
  }, [jobs, viewedAiJobId, viewedSnapshot, belongs, suggestionJob]);
  return { completeAiDraft: () => retireAiDraft(ownerId, target.draftId, window.sessionStorage), aiTarget: target,
    isAiModalOpen, setIsAiModalOpen, isAiDrawerOpen, setIsAiDrawerOpen, aiSuggestionData: suggestionJob?.result || null, aiSuggestionJobId: suggestionJob?.jobId,
    activeAiJobId, activeAiJob, viewedAiJob, openAiProgress, refreshViewedAiJob, openAiRequest,
    hasNewAiResult: Boolean(latestCompletedJob?.result && latestCompletedJob.jobId !== viewedAiJobId && (suggestionJob?.result || newResultJobId === latestCompletedJob.jobId)),
    isAiLoading, isAiCancelling, handleAiModalSubmit, handleApplyAiSuggestion, cancelAiJob, openAiResult: openLatestResult, hasAiResult: Boolean(latestCompletedJob?.result) };
};
