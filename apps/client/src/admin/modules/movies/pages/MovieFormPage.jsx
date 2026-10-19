/**
 * @file MovieFormPage.jsx
 * @module Admin/Modules/Movies/Pages
 * @description Trang Tạo / Chỉnh Sửa / Xem Chi Tiết Phim. Đã được tái cấu trúc thành các module nhỏ.
 */

import React, { useCallback } from 'react';
import { FormProvider, useWatch } from 'react-hook-form';
import { useLocation } from 'react-router-dom';

import UnsavedChangesModal from '@/admin/shared/components/feedback/unsaved-changes-modal/UnsavedChangesModal';

import { useMovieForm } from '../hooks/use-movie-form';
import { useUnsavedMovieGuard } from '../hooks/use-unsaved-movie-guard';

import MovieFormHeader from '../components/MovieFormHeader';
import MovieFormContent from '../components/MovieFormContent';
import AISuggestionModal from '../components/ai-suggestion-modal/AISuggestionModal';
import AISuggestionDrawer from '../components/ai-suggestion-drawer/AISuggestionDrawer';
import './movie-form-page.scss';

/**
 * @component MovieFormPageInner
 * @description Nội dung chính của MovieFormPage — được remount sạch khi key (pathname) thay đổi.
 */
const MovieFormPageInner = () => {
  const formManager = useMovieForm();
  
  const {
    mode,
    isReadOnly,
    form,
    onSubmit,
    isSubmitting,
    isDirty,
    metadata,
    imagePreviews,
    setImageFiles,
    setImagePreviews,
    isAiModalOpen,
    setIsAiModalOpen,
    isAiDrawerOpen,
    setIsAiDrawerOpen,
    aiSuggestionData,
    aiSuggestionJobId,
    aiTarget,
    hasAiResult,
    openAiResult,
    cancelAiJob,
    isAiCancelling,
    handleAiModalSubmit,
    handleApplyAiSuggestion,
    isAiLoading,
    activeAiJobId,
    activeAiJob,
    viewedAiJob,
    openAiProgress,
    refreshViewedAiJob,
    openAiRequest,
    hasNewAiResult,
    activeMediaJobId,
    slugManuallyEdited,
    allowNavigation,
    allowNavigationRef,
  } = formManager;

  const currentValues = useWatch({ control: form.control });

  // Unsaved Guard
  const { isBlocked, confirmNavigation, cancelNavigation } = useUnsavedMovieGuard({
    isDirty: isDirty,
    isJobRunning: Boolean(activeAiJobId) || Boolean(activeMediaJobId),
    allowNavigation: allowNavigationRef || allowNavigation,
  });

  const handleImageFileChange = useCallback(
    (type, file) => {
      if (isReadOnly) return;
      if (file) {
        const previewUrl = URL.createObjectURL(file);
        setImagePreviews((prev) => ({ ...prev, [type]: previewUrl }));
        setImageFiles((prev) => ({ ...prev, [type]: file }));
      }
    },
    [isReadOnly, setImageFiles, setImagePreviews]
  );

  const handleClearImage = useCallback(
    (type) => {
      if (isReadOnly) return;
      setImagePreviews((prev) => ({ ...prev, [type]: '' }));
      setImageFiles((prev) => ({ ...prev, [type]: null }));
    },
    [isReadOnly, setImageFiles, setImagePreviews]
  );

  return (
    <FormProvider {...form}>
      <div className="sp-movie-form">
        <MovieFormHeader
          mode={mode}
          isSubmitting={isSubmitting}
          isReadOnly={isReadOnly}
          onOpenAiModal={openAiRequest}
          hasAiResult={hasAiResult}
          onOpenAiResult={openAiResult}
          activeAiJobId={activeAiJobId}
          activeAiJob={activeAiJob}
          onOpenAiProgress={openAiProgress}
          onSubmit={onSubmit}
        />

        <MovieFormContent
          metadata={metadata}
          imagePreviews={imagePreviews}
          handleImageFileChange={handleImageFileChange}
          handleClearImage={handleClearImage}
          slugManuallyEdited={slugManuallyEdited}
          isReadOnly={isReadOnly}
          onSubmit={onSubmit}
        />

        <AISuggestionModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onSubmit={handleAiModalSubmit}
          isLoading={isAiLoading}
          formValues={{ ...currentValues, title: currentValues.title || viewedAiJob?.title || '' }}
          target={aiTarget}
        />

        <AISuggestionDrawer
          isOpen={isAiDrawerOpen}
          job={viewedAiJob}
          onClose={() => setIsAiDrawerOpen(false)}
          suggestionData={aiSuggestionData}
          suggestionId={aiSuggestionJobId}
          metadata={metadata}
          isReadOnly={isReadOnly}
          onApply={handleApplyAiSuggestion}
          currentValues={currentValues}
          formErrors={form.formState.errors}
          onCancelJob={() => cancelAiJob(viewedAiJob?.jobId)}
          isCancelling={isAiCancelling}
          onRequestAgain={openAiRequest}
          onRefresh={refreshViewedAiJob}
          hasNewResult={hasNewAiResult}
          onOpenLatest={openAiResult}
        />

        <UnsavedChangesModal
          isOpen={isBlocked}
          onConfirm={confirmNavigation}
          onCancel={cancelNavigation}
          isJobRunning={Boolean(activeAiJobId)}
        />
      </div>
    </FormProvider>
  );
};

/**
 * @component MovieFormPage
 * @description Wrapper đặt key={pathname} để React unmount/remount sạch MovieFormPageInner
 * khi chuyển đổi giữa Create ↔ Edit hoặc Edit A ↔ Edit B.
 */
const MovieFormPage = () => {
  const location = useLocation();
  return <MovieFormPageInner key={location.pathname} />;
};

export { MovieFormPage };
export default MovieFormPage;
