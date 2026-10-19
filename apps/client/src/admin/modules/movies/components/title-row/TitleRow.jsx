/**
 * @file TitleRow.jsx
 * @module Admin/Modules/Movies/Components/TitleRow
 * @component TitleRow
 * @description Component quản lý danh sách đa tiêu đề động (Dynamic Multi-Title List) cho phim và anime chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import TextField from '@/shared/components/ui/text-field/TextField';
import Select from '@/shared/components/ui/select/Select';
import Button from '@/shared/components/ui/button/Button';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';

import './title-row.scss';

export const TITLE_TYPE_OPTIONS = [
  { value: 'default', label: 'Tiêu đề chính' },
  { value: 'vietnamese', label: 'Tiếng Việt' },
  { value: 'romaji', label: 'Tên Romaji' },
  { value: 'english', label: 'Tiếng Anh' },
  { value: 'native', label: 'Tên gốc (Native)' },
  { value: 'synonym', label: 'Tên phụ (Alias)' },
];

/**
 * Gợi ý placeholder theo ngữ cảnh ngôn ngữ/loại tiêu đề
 */
const getPlaceholderByType = (type) => {
  switch (type) {
    case 'default':
      return 'VD: Solo Leveling: Arise (Hiển thị chính)';
    case 'vietnamese':
      return 'VD: Tôi Thăng Cấp Một Mình';
    case 'romaji':
      return 'VD: Ore dake Level Up na Ken';
    case 'english':
      return 'VD: Only I Level Up';
    case 'native':
      return 'VD: 俺だけレベルアップな件 / 나 혼자만 레벨업';
    case 'synonym':
      return 'VD: I Alone Level Up';
    default:
      return 'Nhập tên tác phẩm...';
  }
};

/**
 * @component TitleRow
 * @description Quản lý thêm, sửa, xóa các dòng tiêu đề đa ngôn ngữ của tác phẩm.
 */
const TitleRow = ({
  name = 'titles',
  onTitleBlur,
}) => {
  const { control, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const handleAddRow = () => {
    append({ type: 'synonym', title: '' });
  };

  const titlesError = errors?.[name];
  const generalErrorMessage = typeof titlesError?.message === 'string' ? titlesError.message : undefined;

  const TYPE_LABELS = {
    default: 'Chính',
    vietnamese: 'VI',
    romaji: 'Romaji',
    english: 'EN',
    native: 'Native',
    synonym: 'Alias',
  };

  return (
    <div className="sp-title-list">
      <div className="sp-title-list__header">
        <label className="sp-title-list__label sp-title-list__label--required">
          Tiêu Đề & Tên Tác Phẩm
          <span className="sp-title-list__badge">{fields.length} tên</span>
        </label>
      </div>

      <div className="sp-title-list__items">
        {fields.map((fieldItem, index) => {
          const itemError = Array.isArray(titlesError) ? titlesError[index] : undefined;
          const isDefault = fieldItem.type === 'default' || index === 0;
          const typeKey = fieldItem.type || 'default';

          return (
            <div key={fieldItem.id} className={`sp-title-list__item${isDefault ? ' sp-title-list__item--primary' : ''}`}>
              {/* Cột 1: Select Loại Tiêu Đề */}
              <div className="sp-title-list__select-col">
                <Controller
                  name={`${name}.${index}.type`}
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Loại tiêu đề"
                      value={field.value || 'default'}
                      onChange={field.onChange}
                      options={TITLE_TYPE_OPTIONS}
                      error={Boolean(itemError?.type)}
                    />
                  )}
                />
              </div>

              {/* Cột 2: TextField Nhập Tiêu Đề */}
              <div className="sp-title-list__input-col">
                <Controller
                  name={`${name}.${index}.title`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={isDefault ? 'Tên hiển thị chính' : `Tên ${TYPE_LABELS[typeKey] || 'tác phẩm'}`}
                      required={isDefault}
                      placeholder={getPlaceholderByType(typeKey)}
                      error={Boolean(itemError?.title)}
                      helperText={itemError?.title?.message}
                      onBlur={(e) => {
                        field.onBlur();
                        if (isDefault) {
                          onTitleBlur?.(e.target.value);
                        }
                      }}
                    />
                  )}
                />
              </div>

              {/* Cột 3: Nút Xóa Dòng */}
              <div className="sp-title-list__action-col">
                <Tooltip
                  title={fields.length <= 1 ? 'Cần ít nhất 1 tiêu đề' : 'Xóa tên này'}
                  placement="top"
                  arrow
                >
                  <IconButton
                    type="button"
                    size="small"
                    variant="standard"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                    aria-label={`Xóa tiêu đề dòng ${index + 1}`}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>

      {generalErrorMessage && (
        <p className="sp-title-list__helper-error" role="alert">
          {generalErrorMessage}
        </p>
      )}

      <div className="sp-title-list__add-bar">
        <Button
          type="button"
          variant="tonal"
          size="small"
          startIcon={<Plus size={15} />}
          onClick={handleAddRow}
          className="sp-title-list__add-btn"
        >
          Thêm tên khác
        </Button>
      </div>
    </div>
  );
};

TitleRow.displayName = 'TitleRow';

TitleRow.propTypes = {
  /** Tên trường mảng trong form (mặc định: 'titles') */
  name: PropTypes.string,
  /** Callback khi tiêu đề chính blur (hỗ trợ tự sinh slug) */
  onTitleBlur: PropTypes.func,
};

export default memo(TitleRow);
