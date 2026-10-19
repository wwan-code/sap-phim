/**
 * @file studio.schema.js
 * @module Admin/Schemas/StudioSchema
 * @description Yup validation schema cho thực thể Studio sản xuất, đối chiếu 1:1 với Joi backend.
 */

import * as yup from 'yup';

export const studioSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Tên hãng sản xuất không được để trống')
    .min(2, 'Tên hãng sản xuất phải có ít nhất 2 ký tự')
    .max(255, 'Tên hãng sản xuất không được vượt quá 255 ký tự'),
  logo_url: yup
    .string()
    .trim()
    .url('Đường dẫn logo phải là một URL hợp lệ')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  country: yup
    .string()
    .trim()
    .max(100, 'Tên quốc gia không được vượt quá 100 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  description: yup
    .string()
    .trim()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  metadata: yup
    .object()
    .default({}),
  is_active: yup
    .boolean()
    .default(true),
});

export const studioDefaultValues = {
  name: '',
  logo_url: '',
  country: '',
  description: '',
  metadata: {},
  is_active: true,
};
