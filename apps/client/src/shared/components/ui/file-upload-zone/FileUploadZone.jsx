/**
 * @file FileUploadZone.jsx
 * @module Components/UI/FileUploadZone
 * @component FileUploadZone
 * @description Component vùng tải lên tệp chuẩn Clean Architecture, Material 3 Expressive và hệ thống SCSS Tokens (--sp-*).
 */

import React, { forwardRef, memo, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { motion, AnimatePresence } from 'framer-motion';

import EditMediaModal from '@/shared/components/common/edit-media-modal/EditMediaModal';

import FileUploadIdle from './components/FileUploadIdle';
import FileUploadPreview from './components/FileUploadPreview';
import FileUploadUploading from './components/FileUploadUploading';
import {
    DEFAULT_MAX_FILE_SIZE,
    DEFAULT_MAX_FILES,
    FILE_UPLOAD_SIZES,
    FILE_UPLOAD_STATUS,
    FILE_UPLOAD_VARIANTS,
} from './file-upload-zone.constants';
import { formatFileSize, normalizeAspectRatio } from './utils/file-upload-zone.util';
import { useFileUpload } from './hooks/use-file-upload';

import './file-upload-zone.scss';

/**
 * @component FileUploadZone
 * @description Thành phần tải lên tệp hỗ trợ kéo thả trực quan, xem trước tệp đa dạng và tích hợp chỉnh sửa hình ảnh.
 */
const FileUploadZone = forwardRef((props, ref) => {
    const {
        // Core Props
        accept,
        aspectRatio,
        className,
        disabled = false,
        editable = true,
        error,
        errorMessage,
        helperText,
        icon: CustomIcon,
        maxFiles = DEFAULT_MAX_FILES,
        maxSize = DEFAULT_MAX_FILE_SIZE,
        multiple = false,
        onChange,
        onClearPreview,
        onEditPreview,
        onError,
        onFileDrop,
        // Preview & State Props
        previewUrl,
        progress = 0,
        size = FILE_UPLOAD_SIZES.MEDIUM,
        status = FILE_UPLOAD_STATUS.IDLE,
        style,
        value,
        variant = FILE_UPLOAD_VARIANTS.STANDARD,
        ...rest
    } = props;

    const isUploading = status === FILE_UPLOAD_STATUS.UPLOADING;
    const [editModalState, setEditModalState] = useState({
        isOpen: false,
        imageSrc: null,
        targetIndex: 0,
    });

    const {
        clearFiles,
        fileInputRef,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        internalError,
        isDragging,
        openFileDialog,
        previews,
        processFiles,
        removeFile,
        selectedFiles,
        totalSize,
        updateFileAt,
    } = useFileUpload({
        accept,
        disabled,
        isUploading,
        maxFiles,
        maxSize,
        multiple,
        onChange,
        onError,
        onFileDrop,
        value,
    });

    const activeErrorMessage = errorMessage || (typeof error === 'string' ? error : '') || internalError;
    const isErrorState = status === FILE_UPLOAD_STATUS.ERROR || Boolean(activeErrorMessage) || Boolean(error);
    const currentStatus = isErrorState
        ? FILE_UPLOAD_STATUS.ERROR
        : isUploading
            ? FILE_UPLOAD_STATUS.UPLOADING
            : status;

    const normalizedPreviewUrl = useMemo(() => {
        if (!previewUrl) return '';
        if (typeof previewUrl === 'string') return previewUrl;
        if (typeof previewUrl === 'object' && previewUrl !== null) {
            return previewUrl.url || previewUrl.path || '';
        }
        return '';
    }, [previewUrl]);

    const hasPreview = Boolean(normalizedPreviewUrl || (previews && previews.length > 0));

    // Nguồn ảnh xem trước đơn lẻ để mở EditMediaModal
    const previewSource = useMemo(() => {
        if (normalizedPreviewUrl) return normalizedPreviewUrl;
        if (previews.length > 0 && previews[0]?.isImage) return previews[0].url;
        return null;
    }, [normalizedPreviewUrl, previews]);

    const handleClearPreview = useCallback(() => {
        clearFiles();
        onClearPreview?.();
    }, [clearFiles, onClearPreview]);

    const handleKeyDown = useCallback(
        (e) => {
            if (disabled || isUploading || hasPreview) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFileDialog();
            }
        },
        [disabled, hasPreview, isUploading, openFileDialog]
    );

    const handleOpenEditModal = useCallback(
        (targetIndex = 0) => {
            if (disabled || isUploading) return;
            const targetSource =
                previews[targetIndex]?.url || (targetIndex === 0 ? previewSource : null);

            if (targetSource) {
                setEditModalState({
                    isOpen: true,
                    imageSrc: targetSource,
                    targetIndex,
                });
            }
        },
        [disabled, isUploading, previewSource, previews]
    );

    const handleCloseEditModal = useCallback(() => {
        setEditModalState({ isOpen: false, imageSrc: null, targetIndex: 0 });
    }, []);

    const handleEditApply = useCallback(
        (croppedFile) => {
            const { targetIndex } = editModalState;
            handleCloseEditModal();

            if (previews.length > 0) {
                updateFileAt(targetIndex, croppedFile);
            }

            onEditPreview?.(croppedFile);
        },
        [editModalState, handleCloseEditModal, onEditPreview, previews.length, updateFileAt]
    );

    const computedAspectRatio = normalizeAspectRatio(aspectRatio);
    const animationState = isDragging ? 'dragging' : currentStatus;

    const rootClasses = classNames(
        'file-upload-zone',
        `file-upload-zone--variant-${variant}`,
        `file-upload-zone--size-${size}`,
        className
    );

    const dropzoneClasses = classNames('file-upload-zone__dropzone', {
        'file-upload-zone__dropzone--is-dragging': isDragging,
        'file-upload-zone__dropzone--is-uploading': isUploading,
        'file-upload-zone__dropzone--is-success': currentStatus === FILE_UPLOAD_STATUS.SUCCESS,
        'file-upload-zone__dropzone--is-error': isErrorState,
        'file-upload-zone__dropzone--has-preview': hasPreview && !isUploading,
        'file-upload-zone__dropzone--disabled': disabled,
    });

    const numericAspectRatio = typeof aspectRatio === 'number' ? aspectRatio : 1;

    return (
        <div ref={ref} className={rootClasses} {...rest}>
            <motion.div
                className={dropzoneClasses}
                style={{
                    ...(computedAspectRatio ? { aspectRatio: computedAspectRatio } : {}),
                    ...style,
                }}
                initial="idle"
                animate={animationState}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={hasPreview || isUploading || disabled ? undefined : openFileDialog}
                tabIndex={disabled || isUploading || hasPreview ? -1 : 0}
                onKeyDown={handleKeyDown}
                role={hasPreview || isUploading ? 'region' : 'button'}
                aria-label="Khu vực tải lên tệp tin. Kéo thả hoặc nhấn để chọn tệp."
                aria-busy={isUploading}
                aria-disabled={disabled}
                aria-invalid={isErrorState}
                aria-describedby="file-upload-zone-helper"
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                        processFiles(e.target.files);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    accept={accept}
                    multiple={multiple}
                    disabled={disabled}
                    className="file-upload-zone__hidden-input"
                    tabIndex={-1}
                    aria-hidden="true"
                />

                <AnimatePresence mode="wait">
                    {hasPreview && !isUploading ? (
                        <FileUploadPreview
                            key="preview"
                            previewUrl={normalizedPreviewUrl}
                            previews={previews}
                            multiple={multiple}
                            variant={variant}
                            disabled={disabled}
                            editable={editable}
                            openFileDialog={openFileDialog}
                            onOpenEditModal={() => handleOpenEditModal(0)}
                            onClearPreview={handleClearPreview}
                            onRemoveFile={removeFile}
                        />
                    ) : isUploading ? (
                        <FileUploadUploading
                            key="uploading"
                            fileName={
                                selectedFiles.length > 0
                                    ? multiple
                                        ? `${selectedFiles.length} tệp`
                                        : selectedFiles[0].name
                                    : 'Đang tải lên...'
                            }
                            fileSizeText={formatFileSize(totalSize)}
                            progress={progress}
                            variant={variant}
                        />
                    ) : (
                        <FileUploadIdle
                            key="idle"
                            status={currentStatus}
                            isDragging={isDragging}
                            customIcon={CustomIcon}
                            internalError={internalError}
                            errorMessage={activeErrorMessage}
                            helperText={helperText}
                            maxSizeText={maxSize ? `Dung lượng tối đa: ${formatFileSize(maxSize)}` : ''}
                            selectedFiles={selectedFiles}
                            openFileDialog={openFileDialog}
                            multiple={multiple}
                            variant={variant}
                            size={size}
                            disabled={disabled}
                        />
                    )}
                </AnimatePresence>
            </motion.div>

            {editable && editModalState.isOpen && editModalState.imageSrc && (
                <EditMediaModal
                    open={editModalState.isOpen}
                    onClose={handleCloseEditModal}
                    imageSrc={editModalState.imageSrc}
                    onApply={handleEditApply}
                    aspectRatio={numericAspectRatio}
                    title="Chỉnh sửa hình ảnh"
                    showTransformTools
                />
            )}
        </div>
    );
});

FileUploadZone.displayName = 'FileUploadZone';

FileUploadZone.propTypes = {
    /** Định dạng tệp chấp nhận (MIME types hoặc extensions ví dụ: 'image/*,.pdf') */
    accept: PropTypes.string,
    /** Tỷ lệ khung hình (VD: "16/9", "2/3", 1.77, 1) */
    aspectRatio: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    /** Class CSS bổ sung */
    className: PropTypes.string,
    /** Vô hiệu hóa toàn bộ tương tác */
    disabled: PropTypes.bool,
    /** Cho phép mở modal chỉnh sửa cắt/xoay ảnh */
    editable: PropTypes.bool,
    /** Trạng thái lỗi (boolean hoặc chuỗi thông báo lỗi) */
    error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    /** Chuỗi thông báo lỗi từ Form bên ngoài */
    errorMessage: PropTypes.string,
    /** Văn bản trợ giúp hiển thị dưới tiêu đề */
    helperText: PropTypes.string,
    /** Icon tùy chỉnh thay thế icon mặc định */
    icon: PropTypes.elementType,
    /** Số lượng tệp tối đa khi multiple = true */
    maxFiles: PropTypes.number,
    /** Dung lượng tối đa cho phép mỗi tệp (bytes) */
    maxSize: PropTypes.number,
    /** Cho phép chọn nhiều tệp cùng lúc */
    multiple: PropTypes.bool,
    /** Callback tiêu chuẩn khi danh sách tệp thay đổi (Controlled / Form) */
    onChange: PropTypes.func,
    /** Callback khi người dùng xóa ảnh/tệp preview */
    onClearPreview: PropTypes.func,
    /** Callback khi người dùng chỉnh sửa và áp dụng ảnh mới từ modal */
    onEditPreview: PropTypes.func,
    /** Callback khi có lỗi xảy ra trong quá trình chọn tệp */
    onError: PropTypes.func,
    /** Callback tương thích cũ khi thả hoặc chọn tệp */
    onFileDrop: PropTypes.func,
    /** URL ảnh xem trước từ server hoặc bên ngoài */
    previewUrl: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    /** Tiến trình tải lên tệp (0 - 100) */
    progress: PropTypes.number,
    /** Kích thước của Dropzone */
    size: PropTypes.oneOf(['small', 'medium', 'large']),
    /** Trạng thái hiện tại của component */
    status: PropTypes.oneOf(['idle', 'uploading', 'success', 'error']),
    /** Inline style tùy chỉnh */
    style: PropTypes.object,
    /** Giá trị controlled từ Form */
    value: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
    /** Biến thể giao diện */
    variant: PropTypes.oneOf(['standard', 'compact', 'avatar']),
};

export default memo(FileUploadZone);
