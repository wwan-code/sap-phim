/**
 * @file admin-header.context.jsx
 * @module Admin/Layout/Header/Context
 * @description Context và Custom Hook quản trị cấu hình Header động cho Admin Portal (Title, Description, Icon, Primary Action).
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const AdminHeaderContext = createContext(null);

/**
 * Provider quản lý state cho AdminHeader
 */
export const AdminHeaderProvider = ({ children }) => {
  const [headerConfig, setHeaderConfigState] = useState(null);

  const setHeaderConfig = useCallback((config) => {
    setHeaderConfigState((prev) => {
      if (
        prev?.title === config?.title &&
        prev?.description === config?.description &&
        prev?.icon === config?.icon &&
        prev?.primaryAction?.label === config?.primaryAction?.label &&
        prev?.primaryAction?.icon === config?.primaryAction?.icon &&
        prev?.primaryAction?.disabled === config?.primaryAction?.disabled
      ) {
        return prev;
      }
      return config;
    });
  }, []);

  const resetHeaderConfig = useCallback(() => {
    setHeaderConfigState(null);
  }, []);

  return (
    <AdminHeaderContext.Provider
      value={{
        headerConfig,
        setHeaderConfig,
        resetHeaderConfig,
      }}
    >
      {children}
    </AdminHeaderContext.Provider>
  );
};

AdminHeaderProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * @hook useAdminHeaderContext
 * @description Lấy context điều khiển Header từ Provider
 */
export const useAdminHeaderContext = () => {
  const context = useContext(AdminHeaderContext);
  if (!context) {
    throw new Error('useAdminHeaderContext must be used within an AdminHeaderProvider');
  }
  return context;
};

/**
 * @hook useAdminPageHeader
 * @description Hook cho phép các trang con Admin (Movies, Users,...) đăng ký Title, Subtitle và Primary Action động lên AdminHeader.
 * @param {Object} config
 * @param {string} [config.title]
 * @param {string} [config.description]
 * @param {any} [config.icon]
 * @param {Object} [config.primaryAction] - { label: string, icon?: any, onClick: Function, disabled?: boolean }
 */
export const useAdminPageHeader = (config) => {
  const { setHeaderConfig, resetHeaderConfig } = useAdminHeaderContext();

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });

  const title = config?.title;
  const description = config?.description;
  const icon = config?.icon;
  const actionLabel = config?.primaryAction?.label;
  const actionIcon = config?.primaryAction?.icon;
  const actionDisabled = config?.primaryAction?.disabled;

  useEffect(() => {
    if (!title && !description && !actionLabel) return;

    setHeaderConfig({
      title,
      description,
      icon,
      primaryAction: actionLabel
        ? {
            label: actionLabel,
            icon: actionIcon,
            disabled: actionDisabled,
            onClick: (...args) => {
              if (configRef.current?.primaryAction?.onClick) {
                configRef.current.primaryAction.onClick(...args);
              }
            },
          }
        : null,
    });

    return () => {
      resetHeaderConfig();
    };
  }, [title, description, icon, actionLabel, actionIcon, actionDisabled, setHeaderConfig, resetHeaderConfig]);
};

// Alias thuận tiện
export const useAdminHeader = useAdminPageHeader;

export default AdminHeaderContext;
