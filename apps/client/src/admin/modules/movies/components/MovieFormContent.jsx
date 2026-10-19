/**
 * @file MovieFormContent.jsx
 * @module Admin/Modules/Movies/Components
 * @description Lưới nội dung form (Form Grid) tổng hợp 6 section con của MovieForm.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useFormContext } from 'react-hook-form';
import { useDeviceType } from '@/hooks/ui/use-device-type';

import BasicSection from './form-sections/BasicSection';
import RelationsSection from './form-sections/RelationsSection';
import CastSection from './form-sections/CastSection';
import MediaSection from './form-sections/MediaSection';
import MetadataSection from './form-sections/MetadataSection';
import SeoSection from './form-sections/SeoSection';
import Button from '@/shared/components/ui/button/Button';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

const WIZARD_STEPS = [
  { id: 'basic', label: 'Thông tin cơ bản', fields: ['titles', 'slug', 'type', 'status', 'description'] },
  { id: 'media', label: 'Hình ảnh & Media', fields: [] },
  { id: 'relations', label: 'Phân loại', fields: ['category_id', 'country_id', 'studio_id', 'series_id', 'genre_ids'] },
  { id: 'metadata', label: 'Siêu dữ liệu', fields: ['release_date', 'release_year', 'quality', 'sub_dub_type', 'source_type', 'season', 'season_number', 'total_episodes', 'duration', 'age_rating', 'director', 'imdb_id', 'imdb_rating', 'tmdb_id', 'mal_id', 'anilist_id'] },
  { id: 'cast', label: 'Diễn viên & Đạo diễn', fields: ['actor_cast'] },
  { id: 'seo', label: 'SEO', fields: ['meta_title', 'meta_description', 'seo_keywords'] },
];

const MovieFormContent = ({
  metadata,
  imagePreviews,
  handleImageFileChange,
  handleClearImage,
  slugManuallyEdited,
  isReadOnly,
  onSubmit,
}) => {
  const { isMobile } = useDeviceType();
  const { trigger, handleSubmit } = useFormContext();
  const [currentStep, setCurrentStep] = useState(0);

  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  const handleNextStep = async () => {
    const stepFields = WIZARD_STEPS[currentStep].fields;
    if (stepFields.length > 0) {
      const isStepValid = await trigger(stepFields);
      if (!isStepValid) return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderSection = (stepId) => {
    switch (stepId) {
      case 'basic':
        return (
          <BasicSection
            slugManuallyEdited={slugManuallyEdited}
            isReadOnly={isReadOnly}
          />
        );
      case 'media':
        return (
          <MediaSection
            imagePreviews={imagePreviews}
            handleImageFileChange={handleImageFileChange}
            handleClearImage={handleClearImage}
            isReadOnly={isReadOnly}
          />
        );
      case 'relations':
        return <RelationsSection metadata={metadata} isReadOnly={isReadOnly} />;
      case 'metadata':
        return <MetadataSection isReadOnly={isReadOnly} />;
      case 'cast':
        return <CastSection metadata={metadata} isReadOnly={isReadOnly} />;
      case 'seo':
        return <SeoSection isReadOnly={isReadOnly} />;
      default:
        return null;
    }
  };

  // --- MOBILE WIZARD LAYOUT ---
  if (isMobile) {
    const currentStepConfig = WIZARD_STEPS[currentStep];
    const progressPercent = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

    return (
      <div className="sp-movie-form__wizard">
        <div className="sp-movie-form__wizard-progress">
          <div className="sp-movie-form__progress-header">
            <span>Bước {currentStep + 1} / {WIZARD_STEPS.length}: {currentStepConfig.label}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="sp-movie-form__progress-bar-bg">
            <div
              className="sp-movie-form__progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="sp-movie-form__wizard-content">
          {renderSection(currentStepConfig.id)}
        </div>

        <div className="sp-movie-form__wizard-actions">
          <Button
            type="button"
            variant="tonal"
            onClick={handlePrevStep}
            disabled={currentStep === 0 || isReadOnly}
            startIcon={<ArrowLeft size={18} />}
          >
            Quay lại
          </Button>
          
          {isLastStep ? (
            <Button
              type="button"
              variant="filled"
              onClick={handleSubmit(onSubmit)}
              disabled={isReadOnly}
              startIcon={<Check size={18} />}
            >
              Hoàn thành & Lưu
            </Button>
          ) : (
            <Button
              type="button"
              variant="filled"
              onClick={handleNextStep}
              disabled={isReadOnly}
              endIcon={<ArrowRight size={18} />}
            >
              Tiếp tục
            </Button>
          )}
        </div>
      </div>
    );
  }

  // --- DESKTOP GRID LAYOUT ---
  return (
    <form onSubmit={onSubmit} className="sp-movie-form__grid">
      {/* ── CỘT CHÍNH (MAIN COLUMN) ── */}
      <div className="sp-movie-form__col-main">
        {renderSection('basic')}
        {renderSection('relations')}
        {renderSection('metadata')}
        {renderSection('cast')}
        {renderSection('seo')}
      </div>

      {/* ── CỘT PHỤ (SIDEBAR) ── */}
      <div className="sp-movie-form__col-side">
        {renderSection('media')}
      </div>
    </form>
  );
};

MovieFormContent.propTypes = {
  metadata: PropTypes.object,
  imagePreviews: PropTypes.object.isRequired,
  handleImageFileChange: PropTypes.func.isRequired,
  handleClearImage: PropTypes.func.isRequired,
  slugManuallyEdited: PropTypes.object.isRequired,
  isReadOnly: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default MovieFormContent;
