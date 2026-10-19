/**
 * @file country.schema.js
 * @module Admin/Schemas/CountrySchema
 * @description Yup validation schema cho thực thể Quốc gia (Country), đối chiếu 1:1 với Joi backend.
 */

import * as yup from 'yup';

export const countrySchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Tên quốc gia không được để trống')
    .min(2, 'Tên quốc gia phải có ít nhất 2 ký tự')
    .max(150, 'Tên quốc gia không được vượt quá 150 ký tự'),
  code: yup
    .string()
    .trim()
    .required('Mã quốc gia ISO không được để trống')
    .length(2, 'Mã quốc gia phải có đúng 2 ký tự (ví dụ: JP, VN, US)')
    .transform((val) => (typeof val === 'string' ? val.toUpperCase() : val)),
  flag_url: yup
    .string()
    .trim()
    .url('Đường dẫn cờ quốc gia phải là một URL hợp lệ')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  is_active: yup
    .boolean()
    .default(true),
});

export const countryDefaultValues = {
  name: '',
  code: '',
  flag_url: '',
  is_active: true,
};
