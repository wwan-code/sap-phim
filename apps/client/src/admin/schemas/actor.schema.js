/**
 * @file actor.schema.js
 * @module Admin/Schemas/ActorSchema
 * @description Yup validation schema cho thực thể Diễn viên & Nghệ sĩ (Actor), đối chiếu 1:1 với Joi backend.
 */

import * as yup from 'yup';

export const actorSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Tên diễn viên không được để trống')
    .min(2, 'Tên diễn viên phải có ít nhất 2 ký tự')
    .max(255, 'Tên diễn viên không được vượt quá 255 ký tự'),
  image_url: yup
    .string()
    .trim()
    .url('Đường dẫn ảnh đại diện phải là một URL hợp lệ')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  gender: yup
    .string()
    .oneOf(['male', 'female', 'other', 'unknown'], 'Giới tính không hợp lệ')
    .default('unknown'),
  birth_date: yup
    .string()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  nationality: yup
    .string()
    .trim()
    .max(100, 'Quốc tịch không được vượt quá 100 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  biography: yup
    .string()
    .trim()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  description: yup
    .string()
    .trim()
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  aliases: yup
    .array()
    .of(yup.string().trim())
    .default([]),
  metadata: yup
    .object()
    .default({}),
  popularity_score: yup
    .number()
    .typeError('Điểm phổ biến phải là số')
    .integer('Điểm phổ biến phải là số nguyên')
    .min(0, 'Điểm phổ biến phải lớn hơn hoặc bằng 0')
    .default(0),
  is_active: yup
    .boolean()
    .default(true),
});

export const actorDefaultValues = {
  name: '',
  image_url: '',
  gender: 'unknown',
  birth_date: '',
  nationality: '',
  biography: '',
  description: '',
  aliases: [],
  metadata: {},
  popularity_score: 0,
  is_active: true,
};
