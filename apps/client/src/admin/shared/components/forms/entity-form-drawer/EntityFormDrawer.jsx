/**
 * @file EntityFormDrawer.jsx
 * @module Admin/Shared/Components/Forms/EntityFormDrawer
 * @component EntityFormDrawer
 * @description Component Slide-over Drawer trung tâm dùng chung cho toàn bộ Form CRUD Create/Update, tích hợp react-hook-form, yup validation, dirty tracking, error mapping và Material 3 Expressive.
 */

import React, { useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Loader2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

import OffCanvas from '@/shared/components/ui/off-canvas';
import Button from '@/shared/components/ui/button';
import './entity-form-drawer.scss';

export const EntityFormDrawer = memo(({
  open = false,
  onClose,
  title = 'Form Thông Tin',
  subtitle,
  size = 'medium', // 'medium' (480px) | 'large' (640px) | 'xlarge' (800px)
  schema,
  defaultValues = {},
  initialData = null,
  onSubmit,
  submitLabel,
  isEdit = false,
  children,
  className = '',
}) => {
  const formMethods = useForm({
    resolver: schema ? yupResolver(schema) : undefined,
    defaultValues: initialData || defaultValues,
    mode: 'onTouched',
  });

  const {
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = formMethods;

  // Đồng bộ lại form khi initialData hoặc open thay đổi
  useEffect(() => {
    if (open) {
      reset(initialData || defaultValues);
    }
  }, [open, initialData, defaultValues, reset]);

  const handleFormSubmit = useCallback(
    async (values) => {
      try {
        await onSubmit?.(values, formMethods);
      } catch (error) {
        // Map backend validation errors nếu có
        const backendErrors = error?.response?.data?.errors || error?.response?.data?.error?.details;
        if (Array.isArray(backendErrors)) {
          backendErrors.forEach((err) => {
            if (err.field || err.path) {
              setError(err.field || err.path, {
                type: 'server',
                message: err.message,
              });
            }
          });
        }
        const errMsg = error?.message || 'Có lỗi xảy ra khi lưu dữ liệu';
        toast.error(errMsg, { id: `m-err-${errMsg}` });
      }
    },
    [onSubmit, formMethods, setError]
  );

  const handleClose = () => {
    if (isSubmitting) return;
    onClose?.();
  };

  const finalSubmitLabel = submitLabel || (isEdit ? 'Lưu thay đổi' : 'Tạo mới');

  return (
    <OffCanvas
      open={open}
      onClose={handleClose}
      placement="right"
      size={size}
      className={classNames('entity-form-drawer', className)}
    >
      <OffCanvas.Header
        title={title}
        subtitle={subtitle}
        onClose={handleClose}
        showCloseButton={!isSubmitting}
      />

      <form onSubmit={handleSubmit(handleFormSubmit)} className="entity-form-drawer__form">
        <OffCanvas.Body className="entity-form-drawer__body">
          {typeof children === 'function' ? children(formMethods) : children}
        </OffCanvas.Body>

        <OffCanvas.Footer className="entity-form-drawer__footer">
          <Button
            type="button"
            variant="outlined"
            size="medium"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Hủy
          </Button>

          <Button
            type="submit"
            variant="filled"
            color="primary"
            size="medium"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <Loader2 size={16} className="entity-form-drawer__spinner" /> : <Save size={16} />}
          >
            {isSubmitting ? 'Đang lưu...' : finalSubmitLabel}
          </Button>
        </OffCanvas.Footer>
      </form>
    </OffCanvas>
  );
});

EntityFormDrawer.displayName = 'EntityFormDrawer';

EntityFormDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  subtitle: PropTypes.node,
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xlarge', 'full']),
  schema: PropTypes.object,
  defaultValues: PropTypes.object,
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.string,
  isEdit: PropTypes.bool,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  className: PropTypes.string,
};

export default EntityFormDrawer;
