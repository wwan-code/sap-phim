/**
 * @file DataGridDensityMenu.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/Panels/DataGridDensityMenu
 * @description Floating Menu cho phép chuyển đổi chế độ giãn dòng (Compact, Standard, Comfortable)
 * tích hợp ButtonBase chuẩn Material 3 Expressive với TouchRipple.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { AlignJustify, StretchHorizontal, Rows3 } from 'lucide-react';

import ButtonBase from '@/shared/components/ui/button-base';

import { GRID_DENSITIES } from '../../data-grid.constants';

export const DataGridDensityMenu = ({ density, onDensityChange, onClose }) => {
  const options = [
    {
      id: GRID_DENSITIES.COMPACT,
      label: 'Nhỏ gọn',
      icon: Rows3,
      desc: 'Khoảng cách hẹp, hiển thị nhiều dữ liệu nhất',
    },
    {
      id: GRID_DENSITIES.STANDARD,
      label: 'Tiêu chuẩn',
      icon: StretchHorizontal,
      desc: 'Khoảng cách cân bằng, dễ đọc',
    },
    {
      id: GRID_DENSITIES.COMFORTABLE,
      label: 'Thoáng đãng',
      icon: AlignJustify,
      desc: 'Dòng cao, phù hợp có hình ảnh/badge',
    },
  ];

  const handleSelect = (selectedId) => {
    onDensityChange(selectedId);
    onClose?.();
  };

  return (
    <div className="data-grid-panel data-grid-density-panel-wrapper" role="menu" aria-label="Tùy chọn độ giãn dòng">
      <div className="data-grid-panel__header">
        <span>Độ giãn dòng</span>
      </div>

      <div className="data-grid-density-menu__list">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = density === opt.id;

          return (
            <ButtonBase
              key={opt.id}
              className={`data-grid-density-menu__item ${isSelected ? 'data-grid-density-menu__item--active' : ''}`}
              onClick={() => handleSelect(opt.id)}
              aria-label={opt.label}
              aria-pressed={isSelected}
            >
              <div className="data-grid-density-menu__item-icon">
                <Icon size={18} />
              </div>
              <div className="data-grid-density-menu__item-text">
                <span className="data-grid-density-menu__item-title">{opt.label}</span>
                <span className="data-grid-density-menu__item-desc">{opt.desc}</span>
              </div>
            </ButtonBase>
          );
        })}
      </div>
    </div>
  );
};

DataGridDensityMenu.propTypes = {
  density: PropTypes.string.isRequired,
  onDensityChange: PropTypes.func.isRequired,
  onClose: PropTypes.func,
};

export default memo(DataGridDensityMenu);




