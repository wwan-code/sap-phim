/**
 * @file Modal.jsx
 * @module Components/UI/Modal
 * @component Modal
 * @description Component Modal (Dialog & Bottom Sheet) chuẩn Material 3 Expressive, hỗ trợ Solid Tonal, Focus Trap, Scroll Lock, Responsive Sheet và Drawer Placements.
 */

import React, {
  forwardRef,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useId,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button';
import { useDeviceType } from '@/hooks/ui/use-device-type';
import { useFocusTrap } from '@/hooks/ui/use-focus-trap';
import { useLockBodyScroll } from '@/hooks/ui/use-lock-body-scroll';
import { usePortal } from '@/hooks/ui/use-portal';
import OverlayManager from '@/shared/utils/overlay-manager.util';

import './modal.scss';

// ═══════════════════════════════════════════════════════════════════
// ANIMATION CONFIGURATIONS (Neural Motion Tokens)
// ═══════════════════════════════════════════════════════════════════

const ANIMATION_VARIANTS = {
  center: {
    hidden: { opacity: 0, scale: 0.94, y: 12 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.94, y: 12 },
  },
  top: {
    hidden: { opacity: 0, y: -32 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -32 },
  },
  bottom: {
    hidden: { opacity: 0, y: '100%' },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: '100%' },
  },
  'drawer-right': {
    hidden: { opacity: 0, x: '100%' },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: '100%' },
  },
  'drawer-left': {
    hidden: { opacity: 0, x: '-100%' },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: '-100%' },
  },
};

const TRANSITION_CONFIG = {
  center: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  top: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  bottom: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  'drawer-right': { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  'drawer-left': { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
};

const BACKDROP_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const SIZE_MAP = {
  xs: 'small',
  sm: 'small',
  small: 'small',
  md: 'medium',
  medium: 'medium',
  lg: 'large',
  large: 'large',
  xl: 'xlarge',
  xlarge: 'xlarge',
  full: 'fullscreen',
  fullscreen: 'fullscreen',
};

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * ModalHeader - Phần đầu trang của Modal
 */
const ModalHeader = memo(
  forwardRef(
    (
      {
        children,
        className,
        onClose,
        showCloseButton = true,
        subtitle,
        title,
        ...props
      },
      ref
    ) => {
      const headerContent = children || (
        <div className="modal__title-group">
          {title && <h3 className="modal__title">{title}</h3>}
          {subtitle && <p className="modal__subtitle">{subtitle}</p>}
        </div>
      );

      return (
        <div ref={ref} className={classNames('modal__header', className)} {...props}>
          {typeof headerContent === 'string' ? (
            <h3 className="modal__title">{headerContent}</h3>
          ) : (
            headerContent
          )}

          {showCloseButton && onClose && (
            <IconButton
              onClick={onClose}
              size="small"
              variant="standard"
              aria-label="Đóng hộp thoại"
            >
              <X size={18} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      );
    }
  )
);
ModalHeader.displayName = 'Modal.Header';

/**
 * ModalBody - Nội dung chính của Modal
 */
const ModalBody = memo(
  forwardRef(({ children, className, ...props }, ref) => (
    <div ref={ref} className={classNames('modal__body', className)} {...props}>
      {children}
    </div>
  ))
);
ModalBody.displayName = 'Modal.Body';

/**
 * ModalFooter - Phần chân trang chứa các nút hành động
 */
const ModalFooter = memo(
  forwardRef(({ align = 'end', children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={classNames('modal__footer', `modal__footer--align-${align}`, className)}
      {...props}
    >
      {children}
    </div>
  ))
);
ModalFooter.displayName = 'Modal.Footer';

// ═══════════════════════════════════════════════════════════════════
// CORE COMPONENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Component Modal
 */
const Modal = forwardRef(
  (
    {
      'aria-describedby': ariaDescribedBy,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      children,
      className,
      containerClassName,
      containerId = 'modal-root',
      disableBackdropClick = false,
      disableEscapeKeyDown = false,
      initialFocus = true,
      keepMounted = false,
      mobilePlacement = 'bottom',
      onAnimationComplete,
      onClose,
      onCloseComplete,
      onOpenComplete,
      open: propOpen = false,
      isOpen = false,
      overlayClassName,
      placement = 'center',
      restoreFocus = true,
      role = 'dialog',
      size = 'medium',
      variant = 'solid',
      title,
      subtitle,
      showCloseButton = true,
      ...props
    },
    externalRef
  ) => {
    const open = Boolean(propOpen || isOpen);
    const modalId = useId();
    const prefersReducedMotion = useReducedMotion();
    const portalNode = usePortal(containerId);
    const { isMobile } = useDeviceType();

    const [isMounted, setIsMounted] = useState(open);
    const [zIndex, setZIndex] = useState(null);

    // Responsive placement: tự động chuyển Center sang Bottom Sheet trên Mobile
    const effectivePlacement =
      isMobile && placement === 'center' && mobilePlacement === 'bottom'
        ? 'bottom'
        : placement;

    // Quản lý z-index qua OverlayManager
    useEffect(() => {
      if (open) {
        setIsMounted(true);
        const z = OverlayManager.push(modalId);
        setZIndex(z);
      } else {
        OverlayManager.pop(modalId);
      }

      return () => {
        if (open) OverlayManager.pop(modalId);
      };
    }, [open, modalId]);

    // Khóa cuộn trang khi modal mở
    useLockBodyScroll(open);

    // Focus Trap
    const trapRef = useFocusTrap(open && isMounted && Boolean(portalNode), {
      autoFocus: initialFocus,
      restoreFocus,
    });

    // Xử lý phím ESC
    useEffect(() => {
      if (!open || disableEscapeKeyDown) return;

      const handleKeyDown = (e) => {
        if (e.key !== 'Escape') return;
        if (!OverlayManager.isTop(modalId)) return;
        e.stopPropagation();
        onClose?.();
      };

      document.addEventListener('keydown', handleKeyDown, { capture: true });
      return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [open, disableEscapeKeyDown, onClose, modalId]);

    const handleBackdropClick = useCallback(() => {
      if (disableBackdropClick) return;
      onClose?.();
    }, [disableBackdropClick, onClose]);

    const handleExitComplete = useCallback(() => {
      if (!keepMounted) {
        setIsMounted(false);
      }
      onCloseComplete?.();
    }, [keepMounted, onCloseComplete]);

    const handleAnimationCompleteInternal = useCallback(
      (definition) => {
        if (definition === 'visible') {
          onOpenComplete?.();
        }
        onAnimationComplete?.(definition);
      },
      [onOpenComplete, onAnimationComplete]
    );

    const setRefs = useCallback(
      (node) => {
        trapRef.current = node;
        if (externalRef) {
          if (typeof externalRef === 'function') externalRef(node);
          else externalRef.current = node;
        }
      },
      [externalRef, trapRef]
    );

    if (!isMounted || !portalNode) return null;

    const variants = ANIMATION_VARIANTS[effectivePlacement] ?? ANIMATION_VARIANTS.center;
    const transition = prefersReducedMotion ? { duration: 0 } : TRANSITION_CONFIG[effectivePlacement] ?? TRANSITION_CONFIG.center;

    const resolvedSize = SIZE_MAP[size] || 'medium';

    const hasExplicitHeader = React.Children.toArray(children).some(
      (child) =>
        React.isValidElement(child) &&
        (child.type === ModalHeader ||
          child.type?.displayName === 'Modal.Header' ||
          child.type?.displayName === 'ModalHeader')
    );

    const modalContent = (
      <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
        {open && (
          <Fragment key={modalId}>
            {/* Backdrop */}
            <motion.div
              className={classNames('modal__backdrop', overlayClassName)}
              variants={BACKDROP_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={handleBackdropClick}
              style={{ zIndex: zIndex != null ? zIndex - 1 : undefined }}
              aria-hidden="true"
            />

            {/* Container */}
            <div
              className={classNames(
                'modal__container',
                `modal__container--placement-${effectivePlacement}`,
                containerClassName
              )}
              style={{ zIndex }}
              role="presentation"
            >
              {/* Sliding Content */}
              <motion.div
                ref={setRefs}
                role={role}
                aria-modal="true"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={transition}
                onAnimationComplete={handleAnimationCompleteInternal}
                className={classNames(
                  'modal__content',
                  `modal__content--size-${resolvedSize}`,
                  `modal__content--placement-${effectivePlacement}`,
                  `modal__content--variant-${variant}`,
                  className
                )}
                tabIndex={-1}
                {...props}
              >
                {effectivePlacement === 'bottom' && (
                  <div className="modal__drag-handle" aria-hidden="true" />
                )}
                {title && !hasExplicitHeader && (
                  <ModalHeader
                    title={title}
                    subtitle={subtitle}
                    showCloseButton={showCloseButton && Boolean(onClose)}
                    onClose={onClose}
                  />
                )}
                {children}
              </motion.div>
            </div>
          </Fragment>
        )}
      </AnimatePresence>
    );

    return createPortal(modalContent, portalNode);
  }
);

Modal.displayName = 'Modal';

// PropTypes
Modal.propTypes = {
  /** ID phần tử mô tả nội dung cho screen reader */
  'aria-describedby': PropTypes.string,
  /** Nhãn tiếp cận cho screen reader */
  'aria-label': PropTypes.string,
  /** ID phần tử tiêu đề cho screen reader */
  'aria-labelledby': PropTypes.string,
  /** Nội dung bên trong Modal */
  children: PropTypes.node,
  /** CSS class tùy biến cho phần tử Modal Content */
  className: PropTypes.string,
  /** CSS class tùy biến cho phần tử Modal Container */
  containerClassName: PropTypes.string,
  /** ID của Portal container node */
  containerId: PropTypes.string,
  /** Vô hiệu hóa việc đóng modal khi click vào backdrop nền */
  disableBackdropClick: PropTypes.bool,
  /** Vô hiệu hóa việc đóng modal khi bấm phím Escape */
  disableEscapeKeyDown: PropTypes.bool,
  /** Tự động focus phần tử đầu tiên khi modal mở */
  initialFocus: PropTypes.bool,
  /** Trạng thái đóng/mở (alias của open) */
  isOpen: PropTypes.bool,
  /** Giữ nguyên component trong DOM khi đóng */
  keepMounted: PropTypes.bool,
  /** Vị trí hiển thị trên mobile (mặc định 'bottom' để tạo bottom-sheet) */
  mobilePlacement: PropTypes.oneOf(['bottom', 'center']),
  /** Callback kích hoạt khi animation hoàn thành */
  onAnimationComplete: PropTypes.func,
  /** Callback kích hoạt khi yêu cầu đóng modal */
  onClose: PropTypes.func,
  /** Callback kích hoạt khi animation đóng kết thúc */
  onCloseComplete: PropTypes.func,
  /** Callback kích hoạt khi animation mở kết thúc */
  onOpenComplete: PropTypes.func,
  /** Trạng thái đóng/mở */
  open: PropTypes.bool,
  /** CSS class tùy biến cho Backdrop overlay */
  overlayClassName: PropTypes.string,
  /** Vị trí hiển thị của Modal */
  placement: PropTypes.oneOf([
    'center',
    'top',
    'bottom',
    'drawer-left',
    'drawer-right',
  ]),
  /** Tự động khôi phục focus về phần tử trước đó khi modal đóng */
  restoreFocus: PropTypes.bool,
  /** ARIA role của Modal */
  role: PropTypes.string,
  /** 5 Kích thước Modal chuẩn (hỗ trợ alias sm, md, lg, xl, full) */
  size: PropTypes.oneOf([
    'small',
    'medium',
    'large',
    'xlarge',
    'fullscreen',
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
    'full',
  ]),
  /** Tiêu đề Modal (nếu truyền trực tiếp thay vì dùng Modal.Header) */
  title: PropTypes.node,
  /** Tiêu đề phụ (nếu truyền trực tiếp) */
  subtitle: PropTypes.node,
  /** Hiển thị nút đóng X khi dùng title trực tiếp */
  showCloseButton: PropTypes.bool,
  /** Biến thể giao diện Tonal của Modal */
  variant: PropTypes.oneOf(['solid', 'elevated', 'tonal']),
};

ModalHeader.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  onClose: PropTypes.func,
  showCloseButton: PropTypes.bool,
  subtitle: PropTypes.node,
  title: PropTypes.node,
};

ModalBody.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

ModalFooter.propTypes = {
  align: PropTypes.oneOf(['start', 'center', 'end', 'between']),
  children: PropTypes.node,
  className: PropTypes.string,
};

const MemoizedModal = memo(Modal);

MemoizedModal.Header = ModalHeader;
MemoizedModal.Body = ModalBody;
MemoizedModal.Footer = ModalFooter;

export default MemoizedModal;
export { ModalBody, ModalFooter, ModalHeader };
