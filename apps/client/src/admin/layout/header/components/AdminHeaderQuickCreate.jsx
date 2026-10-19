/**
 * @file AdminHeaderQuickCreate.jsx
 * @module Admin/Layout/Header/Components/AdminHeaderQuickCreate
 * @component AdminHeaderQuickCreate
 * @description Subcomponent nút "Tạo mới" (Quick Create) dạng Pill Button kết hợp Floating UI Dropdown chuẩn Material 3 Expressive.
 */

import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clapperboard, Film, Tag, Users } from 'lucide-react';

import Button from '@/shared/components/ui/button/Button';
import { ROUTES } from '@/shared/constants/routes.constants';
import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';

const QUICK_ACTIONS = [
  {
    label: 'Phim mới',
    description: 'Thêm phim mới vào thư viện',
    path: ROUTES.ADMIN.MOVIE_CREATE,
    icon: Clapperboard,
    shortcut: 'N',
  },
  {
    label: 'Tập phim',
    description: 'Quản lý tập phim phát hành',
    path: ROUTES.ADMIN.EPISODES,
    icon: Film,
    shortcut: 'E',
  },
  {
    label: 'Thể loại',
    description: 'Quản lý danh mục & thể loại',
    path: ROUTES.ADMIN.GENRES,
    icon: Tag,
    shortcut: 'G',
  },
  {
    label: 'Diễn viên / Studio',
    description: 'Thêm hồ sơ nhân sự / studio',
    path: ROUTES.ADMIN.ACTORS,
    icon: Users,
    shortcut: 'A',
  },
];

/**
 * @component AdminHeaderQuickCreate
 * @description Quick Create Pill Button + Dropdown qua Floating UI (Dumb UI)
 */
const AdminHeaderQuickCreate = memo(() => {
  const navigate = useNavigate();

  const dropdown = useFloatingDropdown({
    placement: 'bottom-end',
    offset: 8,
    trigger: 'click',
    adaptToDevice: false,
    usePortal: true,
  });

  const {
    isOpen,
    isMounted,
    refs,
    context,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    setIsOpen,
    FloatingPortal,
    FloatingFocusManager,
    portalId,
    focusTrap,
  } = dropdown;

  const handleSelectAction = useCallback(
    (path) => {
      setIsOpen(false);
      if (path) {
        navigate(path);
      }
    },
    [navigate, setIsOpen]
  );

  return (
    <div className='admin-header-quick-create'>
      <Button
        ref={refs.setReference}
        {...getReferenceProps()}
        variant='filled'
        color='primary'
        size='medium'
        startIcon={<Plus size={16} aria-hidden='true' />}
        aria-expanded={isOpen}
        aria-haspopup='true'
        title='Tạo mới nhanh (Quick Actions)'
        className='admin-header__primary-action-btn'
      >
        Tạo mới
      </Button>

      {isMounted && (
        <FloatingPortal id={portalId}>
          <FloatingFocusManager context={context} modal={focusTrap}>
            <div
              ref={refs.setFloating}
              style={{
                ...floatingStyles,
                width: 280,
              }}
              {...getFloatingProps({
                className: 'admin-header-quick-create__dropdown',
                role: 'menu',
                'aria-label': 'Tạo mới nhanh',
              })}
            >
              <div className='admin-header-quick-create__header'>
                <span className='admin-header-quick-create__title'>Thao tác nhanh</span>
                <span className='admin-header-quick-create__badge'>Quick</span>
              </div>

              <div className='admin-header-quick-create__list' role='none'>
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.path}
                      type='button'
                      className='admin-header-quick-create__item'
                      role='menuitem'
                      onClick={() => handleSelectAction(action.path)}
                    >
                      <span className='admin-header-quick-create__item-icon'>
                        <Icon size={16} aria-hidden='true' />
                      </span>
                      <div className='admin-header-quick-create__item-text'>
                        <span className='admin-header-quick-create__item-label'>{action.label}</span>
                        <span className='admin-header-quick-create__item-desc'>{action.description}</span>
                      </div>
                      <kbd className='admin-header-quick-create__shortcut'>{action.shortcut}</kbd>
                    </button>
                  );
                })}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  );
});

AdminHeaderQuickCreate.displayName = 'AdminHeaderQuickCreate';

export default AdminHeaderQuickCreate;
