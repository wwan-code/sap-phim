/**
 * @file use-edit-media.js
 * @module Components/Common/EditMediaModal/Hooks/UseEditMedia
 * @description Custom hook quản lý trạng thái và xử lý cắt/xoay/lật hình ảnh (Crop/Zoom/Rotate/Flip) cho EditMediaModal.
 * @returns {object} Trạng thái hình ảnh và các handler tương tác canvas
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import toast from 'react-hot-toast';

import getCroppedImg from '@/shared/utils/canvas.util';
import {
  DEFAULT_MEDIA_OPTIONS,
  EDIT_MEDIA_CONSTANTS,
  ZOOM_LIMITS,
} from '../edit-media-modal.constants';

// ==========================================
// Initial State
// ==========================================

const INITIAL_STATE = {
  crop: { x: 0, y: 0 },
  zoom: ZOOM_LIMITS.MIN,
  rotation: 0,
  flip: { horizontal: false, vertical: false },
  isProcessing: false,
  error: null,
};

// ==========================================
// Reducer
// ==========================================

function editMediaReducer(state, action) {
  switch (action.type) {
    case 'SET_CROP':
      return { ...state, crop: action.payload, error: null };
    case 'SET_ZOOM':
      return {
        ...state,
        zoom: Math.max(ZOOM_LIMITS.MIN, Math.min(ZOOM_LIMITS.MAX, action.payload)),
        error: null,
      };
    case 'SET_ROTATION':
      return { ...state, rotation: (action.payload + 360) % 360, error: null };
    case 'SET_FLIP':
      return { ...state, flip: { ...state.flip, ...action.payload }, error: null };
    case 'TOGGLE_FLIP_H':
      return {
        ...state,
        flip: { ...state.flip, horizontal: !state.flip.horizontal },
        error: null,
      };
    case 'TOGGLE_FLIP_V':
      return {
        ...state,
        flip: { ...state.flip, vertical: !state.flip.vertical },
        error: null,
      };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isProcessing: false };
    case 'RESET':
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

// ==========================================
// Validation Helpers
// ==========================================

function isValidImageSrc(src) {
  return (
    typeof src === 'string' &&
    src.length > 0 &&
    (src.startsWith('http') ||
      src.startsWith('data:') ||
      src.startsWith('blob:'))
  );
}

function normalizeAspectRatio(ratio) {
  if (ratio === null || ratio === undefined || ratio === 'free') return null;
  const num = Number(ratio);
  return Number.isFinite(num) && num > 0 ? num : DEFAULT_MEDIA_OPTIONS.aspectRatio;
}

function clampZoom(zoom) {
  return Math.max(ZOOM_LIMITS.MIN, Math.min(ZOOM_LIMITS.MAX, Number(zoom) || ZOOM_LIMITS.MIN));
}

// ==========================================
// Main Hook
// ==========================================

/**
 * Hook quản lý logic cho component EditMediaModal
 *
 * @param {object} params
 * @param {string} params.imageSrc - URL ảnh gốc (http/data/blob)
 * @param {Function} params.onApply - Callback(file: File) khi áp dụng
 * @param {Function} params.onClose - Callback khi đóng modal
 * @param {number|null} [params.aspectRatio=1] - Tỷ lệ khung hình (width/height)
 * @param {object} [params.options] - Tùy chọn xuất file
 * @returns {object} { state, actions }
 */
export function useEditMedia({
  aspectRatio = DEFAULT_MEDIA_OPTIONS.aspectRatio,
  imageSrc,
  onApply,
  onClose,
  options = {},
}) {
  const validatedImageSrc = isValidImageSrc(imageSrc) ? imageSrc : null;
  const validatedAspectRatio = normalizeAspectRatio(aspectRatio);
  const outputType = options.outputType ?? DEFAULT_MEDIA_OPTIONS.outputType;
  const outputQuality = Math.max(0, Math.min(1, options.quality ?? DEFAULT_MEDIA_OPTIONS.quality));
  const filename = options.filename ?? DEFAULT_MEDIA_OPTIONS.filename;

  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const cropPixelsRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const [state, dispatch] = useReducer(editMediaReducer, INITIAL_STATE);

  // ==========================================
  // Actions
  // ==========================================

  const setCrop = useCallback((crop) => {
    dispatch({ type: 'SET_CROP', payload: crop });
  }, []);

  const setZoom = useCallback((zoom) => {
    dispatch({ type: 'SET_ZOOM', payload: clampZoom(zoom) });
  }, []);

  const setRotation = useCallback((rotation) => {
    dispatch({ type: 'SET_ROTATION', payload: rotation });
  }, []);

  const rotateRight = useCallback(() => {
    dispatch({ type: 'SET_ROTATION', payload: (state.rotation + 90) % 360 });
  }, [state.rotation]);

  const rotateLeft = useCallback(() => {
    dispatch({ type: 'SET_ROTATION', payload: (state.rotation - 90 + 360) % 360 });
  }, [state.rotation]);

  const toggleFlipHorizontal = useCallback(() => {
    dispatch({ type: 'TOGGLE_FLIP_H' });
  }, []);

  const toggleFlipVertical = useCallback(() => {
    dispatch({ type: 'TOGGLE_FLIP_V' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    cropPixelsRef.current = null;
  }, []);

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    cropPixelsRef.current = pixels;
  }, []);

  // ==========================================
  // Apply Handler
  // ==========================================

  const apply = useCallback(async () => {
    if (!validatedImageSrc) {
      const err = 'Không có ảnh nguồn hợp lệ';
      dispatch({ type: 'SET_ERROR', payload: err });
      toast.error(err);
      return;
    }

    if (!cropPixelsRef.current) {
      const err = 'Chưa chọn vùng cắt. Vui lòng điều chỉnh khung cắt.';
      dispatch({ type: 'SET_ERROR', payload: err });
      toast.error(err);
      return;
    }

    if (state.isProcessing) return;

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    dispatch({ type: 'SET_PROCESSING', payload: true });

    try {
      const croppedImageBlob = await getCroppedImg(
        validatedImageSrc,
        cropPixelsRef.current,
        state.rotation,
        state.flip,
        {
          outputType,
          quality: outputQuality,
          filename,
          signal,
        }
      );

      if (!isMountedRef.current || signal.aborted) {
        return;
      }

      if (!croppedImageBlob) {
        throw new Error('Không thể xử lý tạo ảnh cắt');
      }

      const file = new File([croppedImageBlob], filename, {
        type: outputType,
        lastModified: Date.now(),
      });

      if (onApply) {
        await Promise.resolve(onApply(file));
      }
      if (onClose) {
        onClose();
      }

      reset();
    } catch (error) {
      if (error.name === 'AbortError' || signal.aborted) {
        return;
      }

      if (!isMountedRef.current) return;

      console.error('[EditMedia][Error] Lỗi khi xử lý cắt ảnh:', error);

      const errorMessage = error.message?.includes('canvas')
        ? 'Kích thước ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn.'
        : 'Không thể xử lý hình ảnh. Vui lòng thử lại.';

      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      toast.error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        dispatch({ type: 'SET_PROCESSING', payload: false });
      }
      abortControllerRef.current = null;
    }
  }, [
    validatedImageSrc,
    state.rotation,
    state.flip,
    state.isProcessing,
    onApply,
    onClose,
    outputType,
    outputQuality,
    filename,
    reset,
  ]);

  // ==========================================
  // Memoized Return
  // ==========================================

  const stateMemo = useMemo(
    () => ({
      crop: state.crop,
      zoom: state.zoom,
      rotation: state.rotation,
      flip: state.flip,
      isProcessing: state.isProcessing,
      error: state.error,
      aspectRatio: validatedAspectRatio,
    }),
    [
      state.crop,
      state.zoom,
      state.rotation,
      state.flip,
      state.isProcessing,
      state.error,
      validatedAspectRatio,
    ]
  );

  const actionsMemo = useMemo(
    () => ({
      setCrop,
      setZoom,
      setRotation,
      rotateRight,
      rotateLeft,
      toggleFlipHorizontal,
      toggleFlipVertical,
      reset,
      apply,
      onCropComplete,
    }),
    [
      setCrop,
      setZoom,
      setRotation,
      rotateRight,
      rotateLeft,
      toggleFlipHorizontal,
      toggleFlipVertical,
      reset,
      apply,
      onCropComplete,
    ]
  );

  return {
    state: stateMemo,
    actions: actionsMemo,
  };
}

export { EDIT_MEDIA_CONSTANTS };
