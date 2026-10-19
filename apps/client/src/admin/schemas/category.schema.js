/**
 * @file category.schema.js
 * @module Admin/Schemas/CategorySchema
 * @description Yup validation schema cho thực thể Danh mục (Category), đối chiếu 1:1 với Joi backend.
 */

import * as yup from 'yup';

export const categorySchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Tên danh mục không được để trống')
    .min(2, 'Tên danh mục phải có ít nhất 2 ký tự')
    .max(150, 'Tên danh mục không được vượt quá 150 ký tự'),
  description: yup
    .string()
    .trim()
    .max(1000, 'Mô tả không được vượt quá 1000 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  order_num: yup
    .number()
    .typeError('Thứ tự sắp xếp phải là số')
    .integer('Thứ tự sắp xếp phải là số nguyên')
    .min(0, 'Thứ tự sắp xếp phải lớn hơn hoặc bằng 0')
    .default(0),
  is_active: yup
    .boolean()
    .default(true),
});

export const categoryDefaultValues = {
  name: '',
  description: '',
  order_num: 0,
  is_active: true,
};
