/**
 * @file use-file-upload.js
 * @module Components/UI/FileUploadZone/Hooks/UseFileUpload
 * @description Hook quản lý logic nghiệp vụ, drag-and-drop, xác thực tệp, preview URLs và vòng đời tệp cho FileUploadZone.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_FILES,
} from '../file-upload-zone.constants';
import {
  formatFileSize,
  getFileCategory,
  validateFileType,
} from '../utils/file-upload-zone.util';

/**
 * @hook useFileUpload
 * @description Quản lý toàn bộ state, drag-and-drop và vòng đời tệp tin của FileUploadZone.
 *
 * @param {object} params - Cấu hình hook
 * @param {Function} [params.onFileDrop] - Callback tương thích cũ nhận file/danh sách file
 * @param {Function} [params.onChange] - Callback tiêu chuẩn khi danh sách tệp thay đổi
 * @param {Function} [params.onError] - Callback khi có lỗi xác thực
 * @param {number} [params.maxSize=DEFAULT_MAX_FILE_SIZE] - Giới hạn dung lượng mỗi tệp (bytes)
 * @param {number} [params.maxFiles=DEFAULT_MAX_FILES] - Giới hạn số lượng tệp tối đa (khi multiple = true)
 * @param {string} [params.accept] - Quy tắc định dạng tệp chấp nhận
 * @param {boolean} [params.multiple=false] - Cho phép chọn nhiều tệp
 * @param {boolean} [params.isUploading=false] - Đang trong tiến trình upload
 * @param {boolean} [params.disabled=false] - Vô hiệu hóa tương tác
 * @param {File|File[]|null} [params.value] - Giá trị controlled từ bên ngoài
 * @returns {object} Trạng thái và các hàm điều khiển
 */
export const useFileUpload = ({
  accept,
  disabled = false,
  isUploading = false,
  maxFiles = DEFAULT_MAX_FILES,
  maxSize = DEFAULT_MAX_FILE_SIZE,
  multiple = false,
  onChange,
  onError,
  onFileDrop,
  value,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [internalError, setInternalError] = useState('');
  const [internalFiles, setInternalFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const previousPreviewsRef = useRef(previews);
  const internalFilesRef = useRef(internalFiles);

  useEffect(() => {
    internalFilesRef.current = internalFiles;
  }, [internalFiles]);

  // Lưu lại ref của previews để cleanup blob URL chính xác
  useEffect(() => {
    previousPreviewsRef.current = previews;
  }, [previews]);

  // Giải phóng toàn bộ Blob URL khi component unmount
  useEffect(() => {
    return () => {
      previousPreviewsRef.current.forEach((item) => {
        if (item.url && item.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, []);

  /**
   * Đồng bộ khi nhận value dạng Controlled từ bên ngoài
   */
  useEffect(() => {
    if (value === undefined) return;

    let incomingFiles = [];
    if (Array.isArray(value)) {
      incomingFiles = value.filter(Boolean);
    } else if (value instanceof File) {
      incomingFiles = [value];
    }

    internalFilesRef.current = incomingFiles;
    setInternalFiles(incomingFiles);

    // Cập nhật previews cho incomingFiles
    setPreviews((prev) => {
      // Thu hồi các blob url cũ không còn trong incoming
      prev.forEach((p) => {
        if (p.url && p.url.startsWith('blob:') && !incomingFiles.includes(p.file)) {
          URL.revokeObjectURL(p.url);
        }
      });

      return incomingFiles.map((file) => {
        const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(file.name);
        const existing = prev.find((p) => p.file === file);
        const url = existing?.url || (isImage ? URL.createObjectURL(file) : null);
        const category = getFileCategory(file);

        return {
          file,
          url,
          name: file.name,
          size: file.size,
          isImage,
          category,
        };
      });
    });
  }, [value]);

  /**
   * Thông báo thay đổi tệp ra ngoài thông qua cả onChange và onFileDrop
   */
  const emitFileChange = useCallback(
    (files) => {
      const payload = multiple ? files : files[0] || null;
      onChange?.(payload);
      onFileDrop?.(payload);
    },
    [multiple, onChange, onFileDrop]
  );

  /**
   * Báo lỗi xác thực
   */
  const emitError = useCallback(
    (errorMessage, rejectedFiles = []) => {
      setInternalError(errorMessage);
      onError?.(errorMessage, rejectedFiles);
    },
    [onError]
  );

  /**
   * Xử lý danh sách tệp được chọn hoặc kéo thả
   */
  const processFiles = useCallback(
    (fileList) => {
      if (disabled || isUploading || !fileList || fileList.length === 0) return;

      setInternalError('');
      let rawFiles = Array.from(fileList);
      const rejectedFiles = [];

      // 1. Kiểm tra số lượng tệp nếu không cho phép multiple
      if (!multiple && rawFiles.length > 1) {
        rejectedFiles.push(...rawFiles.slice(1));
        rawFiles = [rawFiles[0]];
        emitError('Chỉ được phép chọn 1 tệp duy nhất.', rejectedFiles);
      }

      // 2. Kiểm tra giới hạn maxFiles khi multiple
      if (multiple && maxFiles && rawFiles.length > maxFiles) {
        const overLimit = rawFiles.slice(maxFiles);
        rejectedFiles.push(...overLimit);
        rawFiles = rawFiles.slice(0, maxFiles);
        emitError(`Chỉ được phép tải lên tối đa ${maxFiles} tệp một lần.`, rejectedFiles);
      }

      // 3. Xác thực định dạng tệp (accept)
      if (accept) {
        const invalidTypeFiles = rawFiles.filter((f) => !validateFileType(f, accept));
        if (invalidTypeFiles.length > 0) {
          rejectedFiles.push(...invalidTypeFiles);
          rawFiles = rawFiles.filter((f) => validateFileType(f, accept));
          emitError(`Định dạng tệp không được hỗ trợ. Chấp nhận: ${accept}`, invalidTypeFiles);
        }
      }

      // 4. Xác thực kích thước từng tệp (maxSize)
      if (maxSize) {
        const oversizedFiles = rawFiles.filter((f) => f.size > maxSize);
        if (oversizedFiles.length > 0) {
          rejectedFiles.push(...oversizedFiles);
          rawFiles = rawFiles.filter((f) => f.size <= maxSize);
          emitError(
            `Tệp vượt quá dung lượng tối đa cho phép (${formatFileSize(maxSize)}).`,
            oversizedFiles
          );
        }
      }

      if (rawFiles.length === 0) return;

      // Xóa và giải phóng các preview cũ nếu là single mode
      setPreviews((prev) => {
        if (!multiple) {
          prev.forEach((p) => {
            if (p.url && p.url.startsWith('blob:')) {
              URL.revokeObjectURL(p.url);
            }
          });
          return [];
        }
        return prev;
      });

      // Tạo đối tượng preview mới
      const newPreviewItems = rawFiles.map((file) => {
        const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(file.name);
        const url = isImage ? URL.createObjectURL(file) : null;
        const category = getFileCategory(file);

        return {
          file,
          url,
          name: file.name,
          size: file.size,
          isImage,
          category,
        };
      });

      const currentFiles = internalFilesRef.current;
      const nextFiles = multiple ? [...currentFiles, ...rawFiles] : rawFiles;
      internalFilesRef.current = nextFiles;
      setInternalFiles(nextFiles);
      setPreviews((prev) => (multiple ? [...prev, ...newPreviewItems] : newPreviewItems));
      emitFileChange(nextFiles);
    },
    [accept, disabled, emitError, emitFileChange, isUploading, maxFiles, maxSize, multiple]
  );

  /**
   * Xóa một tệp theo vị trí index (hỗ trợ Multiple mode)
   */
  const removeFile = useCallback(
    (index) => {
      if (disabled || isUploading) return;

      setPreviews((prevPreviews) => {
        const target = prevPreviews[index];
        if (target && target.url && target.url.startsWith('blob:')) {
          URL.revokeObjectURL(target.url);
        }
        return prevPreviews.filter((_, i) => i !== index);
      });

      const currentFiles = internalFilesRef.current;
      const nextFiles = currentFiles.filter((_, i) => i !== index);
      internalFilesRef.current = nextFiles;
      setInternalFiles(nextFiles);
      setInternalError('');
      emitFileChange(nextFiles);
    },
    [disabled, emitFileChange, isUploading]
  );

  /**
   * Xóa toàn bộ tệp đã chọn
   */
  const clearFiles = useCallback(() => {
    if (disabled || isUploading) return;

    previews.forEach((p) => {
      if (p.url && p.url.startsWith('blob:')) {
        URL.revokeObjectURL(p.url);
      }
    });

    internalFilesRef.current = [];
    setInternalFiles([]);
    setPreviews([]);
    setInternalError('');
    emitFileChange([]);
  }, [disabled, emitFileChange, isUploading, previews]);

  /**
   * Cập nhật tệp sau khi crop/edit
   */
  const updateFileAt = useCallback(
    (index, newFile) => {
      if (!newFile) return;

      setPreviews((prev) => {
        const next = [...prev];
        const old = next[index];
        if (old?.url && old.url.startsWith('blob:')) {
          URL.revokeObjectURL(old.url);
        }

        const isImage = newFile.type?.startsWith('image/') || true;
        next[index] = {
          file: newFile,
          url: isImage ? URL.createObjectURL(newFile) : null,
          name: newFile.name || old?.name || 'edited-image.jpg',
          size: newFile.size || old?.size || 0,
          isImage,
          category: 'image',
        };
        return next;
      });

      const currentFiles = internalFilesRef.current;
      const next = [...currentFiles];
      next[index] = newFile;
      internalFilesRef.current = next;
      setInternalFiles(next);
      emitFileChange(next);
    },
    [emitFileChange]
  );

  // Drag-and-drop Event Handlers
  const handleDragEnter = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isUploading) return;

      dragCounter.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isUploading) return;

      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    },
    [disabled, isUploading]
  );

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isUploading) return;

      if (!isDragging) {
        setIsDragging(true);
      }
    },
    [disabled, isDragging, isUploading]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isUploading) return;

      dragCounter.current = 0;
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [disabled, isUploading, processFiles]
  );

  const openFileDialog = useCallback(() => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, isUploading]);

  const totalSize = useMemo(
    () => internalFiles.reduce((acc, f) => acc + (f.size || 0), 0),
    [internalFiles]
  );

  return {
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
    selectedFiles: internalFiles,
    setInternalError,
    totalSize,
    updateFileAt,
  };
};
