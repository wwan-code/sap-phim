/**
 * @file Select.jsx
 * @module Components/UI/Select
 * @description Component bộ chọn (Select) chuẩn Material 3 Expressive, hỗ trợ single/multi-select, search, keyboard navigation, custom renderValue và Design Tokens (--sp-*).
 */

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  useFloating,
  offset,
  flip,
  shift,
  size as floatingSize,
  autoUpdate,
  FloatingPortal,
  FloatingFocusManager,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  useListNavigation,
  useTypeahead,
} from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Loader2 } from 'lucide-react';

import TextField from '@/shared/components/ui/text-field';

import { useSelectOptions, Option, OptGroup } from './hooks/use-select-options';
import { useSelectState } from './hooks/use-select-state';
import SelectChips from './components/SelectChips';
import SelectDropdown from './components/SelectDropdown';

import './select.scss';

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION TOKENS (Neural Motion)
// ─────────────────────────────────────────────────────────────────────────────

const menuAnimation = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
  },
  exit: { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.12 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @component Select
 * @description Component bộ chọn dropdown đa năng chuẩn Material 3 Expressive
 */
const Select = forwardRef((props, ref) => {
  const {
    autoWidth = false,
    children,
    className,
    defaultValue,
    disabled = false,
    error = false,
    helperText,
    id,
    InputProps = {},
    isLoading = false,
    label,
    maxDisplayChips = 3,
    multiple = false,
    name,
    onBlur,
    onChange,
    onFocus,
    onSearchChange,
    options,
    placeholder,
    renderValue,
    required = false,
    searchable = false,
    size = 'medium',
    value,
    variant = 'outlined',
    ...rest
  } = props;

  // ─────────────────────────────────────────────────────────────────────────
  // LOCAL STATE & REFS
  // ─────────────────────────────────────────────────────────────────────────

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(null);

  const isSearchable = searchable || Boolean(onSearchChange);

  const listboxRef = useRef(null);
  const listContentRef = useRef([]);

  // ─────────────────────────────────────────────────────────────────────────
  // HOOKS
  // ─────────────────────────────────────────────────────────────────────────

  const { parsedOptions, optionMap, filteredOptions } = useSelectOptions({
    children,
    options,
    searchTerm,
    searchable: isSearchable,
  });

  const {
    currentValue,
    selectedValues,
    getDisplayValue,
    handleSelect,
    handleSelectAll,
    handleClearAll,
    handleChipDelete,
  } = useSelectState({
    defaultValue,
    multiple,
    name,
    onChange,
    optionMap,
    parsedOptions,
    renderValue,
    setIsOpen,
    setSearchTerm,
    value,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FLOATING UI INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────

  const { x, y, refs, strategy, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
      if (!open) {
        setSearchTerm('');
        setActiveIndex(null);
        onBlur?.();
      } else {
        onFocus?.();
      }
    },
    placement: 'bottom-start',
    strategy: 'fixed',
    whileElementsMounted: (reference, floating, update) =>
      autoUpdate(reference, floating, update, { animationFrame: true }),
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      floatingSize({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            minWidth: `${rects.reference.width}px`,
            maxWidth: autoWidth ? 'none' : `${Math.max(rects.reference.width, 300)}px`,
            maxHeight: '320px',
          });
        },
      }),
    ],
  });

  const click = useClick(context, { enabled: !disabled });
  const dismiss = useDismiss(context, { outsidePress: false });
  const role = useRole(context, { role: 'listbox' });

  const listNav = useListNavigation(context, {
    listRef: listContentRef,
    activeIndex,
    onNavigate: setActiveIndex,
    virtual: true,
    loop: true,
  });

  const typeaheadListRef = useRef([]);
  typeaheadListRef.current = filteredOptions
    .filter((i) => i.type === 'option')
    .map((i) => (i.textLabel !== undefined ? String(i.textLabel) : String(i.label)));

  const typeahead = useTypeahead(context, {
    listRef: typeaheadListRef,
    activeIndex,
    onMatch: setActiveIndex,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    role,
    listNav,
    typeahead,
  ]);

  useImperativeHandle(ref, () => refs.reference.current);

  // Xử lý đóng dropdown khi nhấn chuột ra bên ngoài một cách an toàn
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event) => {
      const referenceEl = refs.reference.current;
      const floatingEl = refs.floating.current;

      if (!referenceEl || !floatingEl) return;

      if (referenceEl.contains(event.target) || floatingEl.contains(event.target)) {
        return;
      }

      setIsOpen(false);
      setSearchTerm('');
      setActiveIndex(null);
      onBlur?.();
    };

    document.addEventListener('pointerdown', handleOutsideClick, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick, true);
    };
  }, [isOpen, refs, onBlur]);

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    onSearchChange?.(val);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* 1. Trigger Box */}
      <div
        ref={refs.setReference}
        className={classNames(
          'select__trigger',
          {
            'select__trigger--open': isOpen,
            'select__trigger--disabled': disabled,
            'select__trigger--multiple': multiple,
          },
          className
        )}
        {...getReferenceProps()}
      >
        <TextField
          className="select__input-override"
          variant={variant}
          size={size}
          label={label}
          fullWidth
          error={error}
          helperText={helperText}
          disabled={disabled}
          required={required}
          id={id}
          readOnly
          tabIndex={-1}
          value={getDisplayValue()}
          placeholder={
            multiple && selectedValues.length === 0
              ? placeholder
              : !multiple && !getDisplayValue()
                ? placeholder
                : undefined
          }
          InputProps={{
            ...InputProps,
            startAdornment:
              multiple && selectedValues.length > 0 && typeof renderValue !== 'function' ? (
                <SelectChips
                  selectedValues={selectedValues}
                  optionMap={optionMap}
                  maxDisplayChips={maxDisplayChips}
                  onChipDelete={handleChipDelete}
                />
              ) : (
                InputProps.startAdornment
              ),
            endAdornment: (
              <div className="select__trigger-actions">
                {isLoading ? (
                  <Loader2 size={18} className="select__trigger-spinner" aria-hidden="true" />
                ) : (
                  <>
                    {multiple && selectedValues.length > 0 && !disabled && (
                      <button
                        type="button"
                        className="select__trigger-clear"
                        onClick={handleClearAll}
                        aria-label="Xóa tất cả tùy chọn đã chọn"
                        tabIndex={-1}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    )}
                    <ChevronDown
                      size={18}
                      className={classNames('select__trigger-icon', {
                        'select__trigger-icon--open': isOpen,
                      })}
                      aria-hidden="true"
                    />
                  </>
                )}
              </div>
            ),
          }}
          {...rest}
        />
      </div>

      {/* 2. Universal Popover Menu (FloatingPortal) */}
      <AnimatePresence>
        {isOpen && (
          <FloatingPortal>
            <FloatingFocusManager
              context={context}
              modal={false}
              initialFocus={isSearchable ? -1 : 0}
              returnFocus={refs.reference}
            >
              <motion.div
                ref={refs.setFloating}
                variants={menuAnimation}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{
                  position: strategy,
                  top: y ?? 0,
                  left: x ?? 0,
                  zIndex: 1300,
                  visibility: x == null ? 'hidden' : 'visible',
                }}
                className="select__dropdown"
                {...getFloatingProps()}
              >
                <SelectDropdown
                  activeIndex={activeIndex}
                  currentValue={currentValue}
                  filteredOptions={filteredOptions}
                  getItemProps={getItemProps}
                  isLoading={isLoading}
                  listboxRef={listboxRef}
                  listContentRef={listContentRef}
                  multiple={multiple}
                  onClearAll={handleClearAll}
                  onSearchChange={handleSearchChange}
                  onSelect={handleSelect}
                  onSelectAll={handleSelectAll}
                  searchable={isSearchable}
                  searchTerm={searchTerm}
                  selectedValues={selectedValues}
                />
              </motion.div>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </AnimatePresence>
    </>
  );
});

Select.displayName = 'Select';

Select.propTypes = {
  /** Tự động điều chỉnh chiều rộng dropdown */
  autoWidth: PropTypes.bool,
  /** Declarative options (Option / OptGroup) */
  children: PropTypes.node,
  /** CSS class tùy chỉnh */
  className: PropTypes.string,
  /** Giá trị mặc định (uncontrolled) */
  defaultValue: PropTypes.any,
  /** Trạng thái vô hiệu hóa */
  disabled: PropTypes.bool,
  /** Trạng thái lỗi (boolean hoặc string thông báo lỗi) */
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  /** Văn bản trợ giúp / mô tả lỗi */
  helperText: PropTypes.node,
  /** ID HTML */
  id: PropTypes.string,
  /** Props bổ sung truyền vào TextField bên dưới */
  InputProps: PropTypes.object,
  /** Trạng thái đang tải dữ liệu options */
  isLoading: PropTypes.bool,
  /** Nhãn hiển thị của Select */
  label: PropTypes.node,
  /** Số lượng thẻ chip tối đa hiển thị (khi multiple=true) */
  maxDisplayChips: PropTypes.number,
  /** Cho phép chọn nhiều tùy chọn */
  multiple: PropTypes.bool,
  /** Tên trường form */
  name: PropTypes.string,
  /** Callback khi blur */
  onBlur: PropTypes.func,
  /** Callback khi thay đổi giá trị lựa chọn */
  onChange: PropTypes.func,
  /** Callback khi focus */
  onFocus: PropTypes.func,
  /** Callback khi thay đổi từ khóa tìm kiếm */
  onSearchChange: PropTypes.func,
  /** Danh sách tùy chọn theo mảng (Imperative Array API) */
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.shape({
        disabled: PropTypes.bool,
        label: PropTypes.node,
        value: PropTypes.any.isRequired,
      }),
    ])
  ),
  /** Văn bản placeholder */
  placeholder: PropTypes.string,
  /** Hàm tùy biến render giá trị đã chọn */
  renderValue: PropTypes.func,
  /** Đánh dấu trường bắt buộc */
  required: PropTypes.bool,
  /** Cho phép tìm kiếm options trong dropdown */
  searchable: PropTypes.bool,
  /** Kích thước Select (small: 36px, medium: 48px, large: 56px) */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /** Giá trị lựa chọn (controlled) */
  value: PropTypes.any,
  /** Biến thể giao diện Material 3 Expressive */
  variant: PropTypes.oneOf(['outlined', 'filled', 'standard']),
};

// Gắn sub-components cho Declarative API
Select.Option = Option;
Select.OptGroup = OptGroup;

export default memo(Select);

export { Option, OptGroup };
export { Option as SelectOption, OptGroup as SelectOptGroup };
