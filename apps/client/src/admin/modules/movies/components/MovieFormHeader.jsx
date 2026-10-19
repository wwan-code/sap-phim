/**
 * @file MovieFormHeader.jsx
 * @module Admin/Modules/Movies/Components
 * @description Header cho trang Movie Form bao gồm tiêu đề, nút Back, nút Gọi AI, Hủy và Lưu.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { ROUTES } from '@/shared/constants/routes.constants';
import Button from '@/shared/components/ui/button/Button';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';

/** @component MovieFormHeader @description Render save and account-scoped suggestion actions. */
const MovieFormHeader = ({ mode, isSubmitting, isReadOnly, onOpenAiModal, onSubmit, hasAiResult = false, onOpenAiResult, activeAiJobId, activeAiJob, onOpenAiProgress }) => {
  const navigate = useNavigate();
  const isEdit = mode === 'edit';
  const isView = mode === 'view';

  const { watch } = useFormContext();
  const currentTitle = watch('title') || watch('titles.0.title');

  return (
    <div className="sp-movie-form__header">
      <div className="sp-movie-form__header-left">
        <Tooltip title="Quay lại danh sách phim" placement="right" arrow>
          <IconButton
            size="medium"
            variant="standard"
            aria-label="Quay lại danh sách phim"
            onClick={() => navigate(ROUTES.ADMIN.MOVIES)}
          >
            <ArrowLeft size={20} />
          </IconButton>
        </Tooltip>
        <div className="sp-movie-form__header-titles">
          <h2 className="sp-movie-form__title">
            {isView
              ? `Chi Tiết: ${currentTitle || 'Tác Phẩm'}`
              : isEdit
                ? `Chỉnh Sửa: ${currentTitle || 'Tác Phẩm'}`
                : 'Thêm Hồ Sơ Phim / Anime Mới'}
          </h2>
          <p className="sp-movie-form__subtitle">
            {isView
              ? 'Xem thông tin metadata, phân loại, media và danh sách diễn viên.'
              : 'Điền đầy đủ thông tin metadata, phân loại, media và danh sách diễn viên.'}
          </p>
        </div>
      </div>

      <div className="sp-movie-form__header-actions">
        {hasAiResult && <Button type="button" variant="tonal" onClick={onOpenAiResult}>Xem lại gợi ý</Button>}
        {activeAiJobId && <Button type="button" variant="tonal" startIcon={<Sparkles size={16} />} onClick={onOpenAiProgress}>{activeAiJob?.isReconnecting ? 'Kết nối lại tác vụ AI' : activeAiJob?.status === 'completed' ? 'Tải kết quả AI' : activeAiJob?.status === 'queued' ? 'AI đang chờ' : 'AI đang tổng hợp'}{typeof activeAiJob?.percent === 'number' && activeAiJob.status === 'processing' ? ' · ' + Math.round(activeAiJob.percent) + '%' : ''}</Button>}
        {!isReadOnly && (
          <Tooltip title='Gợi ý bằng AI' placement='bottom'>
            <IconButton
              size="medium"
              variant="tonal"
              aria-label="Gợi ý bằng AI"
              onClick={onOpenAiModal}
              color="secondary"
              tooltip="Gợi ý bằng AI"
            >
              <Sparkles size={20} />
            </IconButton></Tooltip>
        )}
        <Button
          type="button"
          variant="tonal"
          onClick={() => navigate(ROUTES.ADMIN.MOVIES)}
        >
          {isReadOnly ? 'Đóng' : 'Hủy bỏ'}
        </Button>
        {!isReadOnly && (
          <Button
            type="button"
            variant="filled"
            startIcon={<Save size={18} />}
            loading={isSubmitting}
            onClick={onSubmit}
          >
            {isEdit ? 'Lưu Thay Đổi' : 'Tạo Phim Mới'}
          </Button>
        )}
      </div>
    </div>
  );
};

MovieFormHeader.propTypes = {
  mode: PropTypes.oneOf(['create', 'edit', 'view']).isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  isReadOnly: PropTypes.bool.isRequired,
  onOpenAiModal: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  hasAiResult: PropTypes.bool,
  onOpenAiResult: PropTypes.func,
  activeAiJobId: PropTypes.string,
  activeAiJob: PropTypes.object,
  onOpenAiProgress: PropTypes.func,
};

export default memo(MovieFormHeader);
