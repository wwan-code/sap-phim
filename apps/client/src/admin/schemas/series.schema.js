/**
 * @file series.schema.js
 * @module Admin/Schemas/SeriesSchema
 * @description Yup validation schema cho thực thể Series / Franchise, đối chiếu 1:1 với Joi backend.
 */

import * as yup from 'yup';

export const seriesSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Tên thương hiệu phim không được để trống')
    .min(2, 'Tên thương hiệu phim phải có ít nhất 2 ký tự')
    .max(255, 'Tên thương hiệu phim không được vượt quá 255 ký tự'),
  is_active: yup
    .boolean()
    .default(true),
});

export const seriesDefaultValues = {
  name: '',
  is_active: true,
};
