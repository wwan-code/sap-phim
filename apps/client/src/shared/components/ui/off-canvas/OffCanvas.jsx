/**
 * @file OffCanvas.jsx
 * @module Components/UI/OffCanvas
 * @component OffCanvas
 * @description Component OffCanvas (Side Drawer, Slide-over Panel & Bottom Sheet) chuẩn Material 3 Expressive, hỗ trợ Gesture Swipe, Focus Trap, Scroll Lock, Responsive và Stack Management.
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
import { useFocusTrap } from '@/hooks/ui/use-focus-trap';
import { useLockBodyScroll } from '@/hooks/ui/use-lock-body-scroll';
import { usePortal } from '@/hooks/ui/use-portal';
import OverlayManager from '@/shared/utils/overlay-manager.util';

import './off-canvas.scss';

// ═══════════════════════════════════════════════════════════════════
// ANIMATION & DRAG CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════

const ANIMATION_VARIANTS = {
  left: {
    hidden: { opacity: 0, x: '-100%' },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: '-100%' },
  },
  right: {
    hidden: { opacity: 0, x: '100%' },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: '100%' },
  },
  top: {
    hidden: { opacity: 0, y: '-100%' },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: '-100%' },
  },
  bottom: {
    hidden: { opacity: 0, y: '100%' },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: '100%' },
  },
};

const TRANSITION_CONFIG = {
  duration: 0.28,
  ease: [0.16, 1, 0.3, 1],
};

const BACKDROP_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * OffCanvasHeader - Phần đầu trang của Drawer
 */
const OffCanvasHeader = memo(
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
        <div className="off-canvas__title-group">
          {title && <h3 className="off-canvas__title">{title}</h3>}
          {subtitle && <p className="off-canvas__subtitle">{subtitle}</p>}
        </div>
      );

      return (
        <div ref={ref} className={classNames('off-canvas__header', className)} {...props}>
          {typeof headerContent === 'string' ? (
            <h3 className="off-canvas__title">{headerContent}</h3>
          ) : (
            headerContent
          )}

          {showCloseButton && onClose && (
            <IconButton
              onClick={onClose}
              size="small"
              variant="standard"
              aria-label="Đóng bảng điều khiển"
            >
              <X size={18} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      );
    }
  )
);
OffCanvasHeader.displayName = 'OffCanvas.Header';

/**
 * OffCanvasBody - Nội dung cuộn chính của Drawer
 */
const OffCanvasBody = memo(
  forwardRef(({ children, className, ...props }, ref) => (
    <div ref={ref} className={classNames('off-canvas__body', className)} {...props}>
      {children}
    </div>
  ))
);
OffCanvasBody.displayName = 'OffCanvas.Body';

/**
 * OffCanvasFooter - Chân trang chứa các nút hành động
 */
const OffCanvasFooter = memo(
  forwardRef(({ align = 'end', children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={classNames('off-canvas__footer', `off-canvas__footer--align-${align}`, className)}
      {...props}
    >
      {children}
    </div>
  ))
);
OffCanvasFooter.displayName = 'OffCanvas.Footer';

// ═══════════════════════════════════════════════════════════════════
// CORE COMPONENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Component OffCanvas (Side Drawer & Bottom Sheet)
 */
const OffCanvas = forwardRef(
  (
    {
      'aria-describedby': ariaDescribedBy,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      backdrop = true,
      children,
      className,
      closeOnEscape = true,
      containerClassName,
      containerId = 'modal-root',
      initialFocus = true,
      keepMounted = false,
      onAnimationComplete,
      onClose,
      onCloseComplete,
      onOpenComplete,
      open = false,
      overlayClassName,
      placement = 'right',
      restoreFocus = true,
      role = 'dialog',
      size = 'medium',
      swipeable = true,
      variant = 'solid',
      ...props
    },
    externalRef
  ) => {
    const offCanvasId = useId();
    const prefersReducedMotion = useReducedMotion();
    const portalNode = usePortal(containerId);

    const [isMounted, setIsMounted] = useState(open);
    const [zIndex, setZIndex] = useState(null);

    // Chuẩn hóa placement (start -> left, end -> right)
    const normalizedPlacement =
      placement === 'start'
        ? 'left'
        : placement === 'end'
        ? 'right'
        : placement;

    // Quản lý z-index qua OverlayManager
    useEffect(() => {
      if (open) {
        setIsMounted(true);
        const z = OverlayManager.push(offCanvasId);
        setZIndex(z);
      } else {
        OverlayManager.pop(offCanvasId);
      }

      return () => {
        if (open) OverlayManager.pop(offCanvasId);
      };
    }, [open, offCanvasId]);

    // Khóa cuộn trang khi có backdrop
    useLockBodyScroll(open && backdrop !== false);

    // Focus Trap
    const trapRef = useFocusTrap(open && isMounted && Boolean(portalNode) && backdrop !== false, {
      autoFocus: initialFocus,
      restoreFocus,
    });

    // Xử lý phím ESC
    useEffect(() => {
      if (!open || !closeOnEscape) return;

      const handleKeyDown = (e) => {
        if (e.key !== 'Escape') return;
        if (!OverlayManager.isTop(offCanvasId)) return;
        e.stopPropagation();
        onClose?.();
      };

      document.addEventListener('keydown', handleKeyDown, { capture: true });
      return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [open, closeOnEscape, onClose, offCanvasId]);

    const handleBackdropClick = useCallback(() => {
      if (backdrop === 'static' || backdrop === false) return;
      onClose?.();
    }, [backdrop, onClose]);

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

    // Cấu hình cử chỉ vuốt kéo Drag Gesture
    const getDragProps = () => {
      if (!swipeable) return {};

      switch (normalizedPlacement) {
        case 'bottom':
          return {
            drag: 'y',
            dragConstraints: { top: 0 },
            dragElastic: { top: 0, bottom: 0.4 },
            onDragEnd: (e, { offset, velocity }) => {
              if (offset.y > 80 || velocity.y > 400) {
                onClose?.();
              }
            },
          };
        case 'left':
          return {
            drag: 'x',
            dragConstraints: { right: 0 },
            dragElastic: { left: 0.4, right: 0 },
            onDragEnd: (e, { offset, velocity }) => {
              if (offset.x < -80 || velocity.x < -400) {
                onClose?.();
              }
            },
          };
        case 'right':
          return {
            drag: 'x',
            dragConstraints: { left: 0 },
            dragElastic: { left: 0, right: 0.4 },
            onDragEnd: (e, { offset, velocity }) => {
              if (offset.x > 80 || velocity.x > 400) {
                onClose?.();
              }
            },
          };
        case 'top':
          return {
            drag: 'y',
            dragConstraints: { bottom: 0 },
            dragElastic: { top: 0.4, bottom: 0 },
            onDragEnd: (e, { offset, velocity }) => {
              if (offset.y < -80 || velocity.y < -400) {
                onClose?.();
              }
            },
          };
        default:
          return {};
      }
    };

    if (!isMounted || !portalNode) return null;

    const variants = ANIMATION_VARIANTS[normalizedPlacement] ?? ANIMATION_VARIANTS.right;

    const content = (
      <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
        {open && (
          <Fragment key={offCanvasId}>
            {/* Backdrop */}
            {backdrop && (
              <motion.div
                className={classNames('off-canvas__backdrop', overlayClassName)}
                variants={BACKDROP_VARIANTS}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={handleBackdropClick}
                style={{ zIndex: zIndex != null ? zIndex - 1 : undefined }}
                aria-hidden="true"
              />
            )}

            {/* Container */}
            <div
              className={classNames(
                'off-canvas__container',
                `off-canvas__container--placement-${normalizedPlacement}`,
                containerClassName
              )}
              style={{ zIndex }}
              role="presentation"
            >
              {/* Sliding Panel */}
              <motion.div
                ref={setRefs}
                role={role}
                aria-modal={backdrop !== false ? 'true' : undefined}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={prefersReducedMotion ? { duration: 0 } : TRANSITION_CONFIG}
                onAnimationComplete={handleAnimationCompleteInternal}
                className={classNames(
                  'off-canvas__panel',
                  `off-canvas__panel--size-${size}`,
                  `off-canvas__panel--placement-${normalizedPlacement}`,
                  `off-canvas__panel--variant-${variant}`,
                  className
                )}
                tabIndex={-1}
                {...getDragProps()}
                {...props}
              >
                {swipeable && normalizedPlacement === 'bottom' && (
                  <div className="off-canvas__drag-handle" aria-hidden="true" />
                )}
                {children}
              </motion.div>
            </div>
          </Fragment>
        )}
      </AnimatePresence>
    );

    return createPortal(content, portalNode);
  }
);

OffCanvas.displayName = 'OffCanvas';

OffCanvas.propTypes = {
  /** ID phần tử mô tả nội dung cho screen reader */
  'aria-describedby': PropTypes.string,
  /** Nhãn tiếp cận cho screen reader */
  'aria-label': PropTypes.string,
  /** ID phần tử tiêu đề cho screen reader */
  'aria-labelledby': PropTypes.string,
  /** Chế độ hiển thị Backdrop (true: có scrim và click để đóng, 'static': có scrim nhưng không đóng khi click, false: không có backdrop) */
  backdrop: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf(['static'])]),
  /** Nội dung bên trong OffCanvas */
  children: PropTypes.node,
  /** CSS class tùy biến cho panel */
  className: PropTypes.string,
  /** Cho phép bấm Escape để đóng */
  closeOnEscape: PropTypes.bool,
  /** CSS class tùy biến cho container */
  containerClassName: PropTypes.string,
  /** ID của Portal container node */
  containerId: PropTypes.string,
  /** Tự động focus phần tử đầu tiên khi mở */
  initialFocus: PropTypes.bool,
  /** Giữ nguyên component trong DOM khi đóng */
  keepMounted: PropTypes.bool,
  /** Callback kích hoạt khi animation hoàn thành */
  onAnimationComplete: PropTypes.func,
  /** Callback kích hoạt khi yêu cầu đóng */
  onClose: PropTypes.func,
  /** Callback kích hoạt khi animation đóng kết thúc */
  onCloseComplete: PropTypes.func,
  /** Callback kích hoạt khi animation mở kết thúc */
  onOpenComplete: PropTypes.func,
  /** Trạng thái đóng/mở */
  open: PropTypes.bool,
  /** CSS class tùy biến cho Backdrop overlay */
  overlayClassName: PropTypes.string,
  /** Vị trí trượt của OffCanvas */
  placement: PropTypes.oneOf([
    'left',
    'right',
    'top',
    'bottom',
    'start',
    'end',
  ]),
  /** Tự động khôi phục focus về phần tử trước đó khi đóng */
  restoreFocus: PropTypes.bool,
  /** ARIA role */
  role: PropTypes.string,
  /** 5 Kích thước chuẩn: small, medium, large, xlarge, fullscreen */
  size: PropTypes.oneOf([
    'small',
    'medium',
    'large',
    'xlarge',
    'fullscreen',
  ]),
  /** Cho phép cử chỉ vuốt kéo trên touch để đóng */
  swipeable: PropTypes.bool,
  /** Biến thể giao diện Tonal của OffCanvas */
  variant: PropTypes.oneOf(['solid', 'elevated', 'tonal']),
};

OffCanvasHeader.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  onClose: PropTypes.func,
  showCloseButton: PropTypes.bool,
  subtitle: PropTypes.node,
  title: PropTypes.node,
};

OffCanvasBody.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

OffCanvasFooter.propTypes = {
  align: PropTypes.oneOf(['start', 'center', 'end', 'between']),
  children: PropTypes.node,
  className: PropTypes.string,
};

const MemoizedOffCanvas = memo(OffCanvas);

MemoizedOffCanvas.Header = OffCanvasHeader;
MemoizedOffCanvas.Body = OffCanvasBody;
MemoizedOffCanvas.Footer = OffCanvasFooter;

export default MemoizedOffCanvas;
export { OffCanvasBody, OffCanvasFooter, OffCanvasHeader };
