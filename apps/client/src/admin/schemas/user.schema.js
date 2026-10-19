/**
 * @file user.schema.js
 * @module Admin/Schemas/UserSchema
 * @description Yup validation schema cho thực thể Người dùng (User), đối chiếu 1:1 với Joi backend.
 */

import * as yup from 'yup';

export const userCreateSchema = yup.object().shape({
  username: yup
    .string()
    .trim()
    .required('Tên đăng nhập không được để trống')
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .max(50, 'Tên đăng nhập không được vượt quá 50 ký tự')
    .matches(
      /^[a-zA-Z0-9_-]+$/,
      'Tên đăng nhập chỉ được chứa chữ cái, chữ số, dấu gạch ngang (-) và gạch dưới (_)'
    ),
  email: yup
    .string()
    .trim()
    .required('Email không được để trống')
    .email('Định dạng email không hợp lệ')
    .max(255, 'Email không được vượt quá 255 ký tự'),
  password: yup
    .string()
    .required('Mật khẩu không được để trống')
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
  full_name: yup
    .string()
    .trim()
    .max(255, 'Họ tên không được vượt quá 255 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  role_slug: yup
    .string()
    .required('Vui lòng chọn vai trò')
    .default('user'),
  membership_tier: yup
    .string()
    .default('free'),
  status: yup
    .string()
    .oneOf(['active', 'inactive', 'banned'], 'Trạng thái không hợp lệ')
    .default('active'),
  is_verified: yup
    .boolean()
    .transform((val) => Boolean(val && typeof val !== 'object'))
    .default(false),
  is_premium: yup
    .boolean()
    .transform((val) => Boolean(val && typeof val !== 'object'))
    .default(false),
  level: yup
    .number()
    .transform((val, orig) => (orig === '' || isNaN(val) ? 1 : val))
    .typeError('Cấp bậc phải là số')
    .integer('Cấp bậc phải là số nguyên')
    .min(1, 'Cấp bậc tối thiểu là 1')
    .max(100, 'Cấp bậc tối đa là 100')
    .default(1),
  exp: yup
    .number()
    .transform((val, orig) => (orig === '' || isNaN(val) ? 0 : val))
    .typeError('EXP phải là số')
    .integer('EXP phải là số nguyên')
    .min(0, 'EXP không được âm')
    .default(0),
  point: yup
    .number()
    .transform((val, orig) => (orig === '' || isNaN(val) ? 0 : val))
    .typeError('Point phải là số')
    .integer('Point phải là số nguyên')
    .min(0, 'Point không được âm')
    .default(0),
});

export const userUpdateSchema = yup.object().shape({
  username: yup
    .string()
    .nullable(),
  email: yup
    .string()
    .nullable(),
  full_name: yup
    .string()
    .trim()
    .max(255, 'Họ tên không được vượt quá 255 ký tự')
    .nullable()
    .transform((curr, orig) => (orig === '' ? null : curr)),
  role_slug: yup
    .string()
    .required('Vui lòng chọn vai trò'),
  membership_tier: yup
    .string()
    .default('free'),
  status: yup
    .string()
    .oneOf(['active', 'inactive', 'banned'], 'Trạng thái không hợp lệ')
    .default('active'),
  password: yup
    .string()
    .transform((curr, orig) => (orig === '' ? undefined : curr))
    .nullable()
    .test('password-min', 'Mật khẩu phải có ít nhất 8 ký tự', (val) => !val || val.length >= 8),
  is_verified: yup
    .boolean()
    .transform((val) => Boolean(val && typeof val !== 'object'))
    .default(false),
  is_premium: yup
    .boolean()
    .transform((val) => Boolean(val && typeof val !== 'object'))
    .default(false),
  level: yup
    .number()
    .transform((val, orig) => (orig === '' || isNaN(val) ? 1 : val))
    .typeError('Cấp bậc phải là số')
    .integer('Cấp bậc phải là số nguyên')
    .min(1, 'Cấp bậc tối thiểu là 1')
    .max(100, 'Cấp bậc tối đa là 100')
    .default(1),
  exp: yup
    .number()
    .transform((val, orig) => (orig === '' || isNaN(val) ? 0 : val))
    .typeError('EXP phải là số')
    .integer('EXP phải là số nguyên')
    .min(0, 'EXP không được âm')
    .default(0),
  point: yup
    .number()
    .transform((val, orig) => (orig === '' || isNaN(val) ? 0 : val))
    .typeError('Point phải là số')
    .integer('Point phải là số nguyên')
    .min(0, 'Point không được âm')
    .default(0),
});

export const userLevelSchema = yup.object().shape({
  level: yup
    .number()
    .typeError('Cấp bậc phải là số')
    .integer('Cấp bậc phải là số nguyên')
    .min(1, 'Cấp bậc tối thiểu là 1')
    .max(100, 'Cấp bậc tối đa là 100')
    .required('Vui lòng nhập cấp bậc'),
  exp: yup
    .number()
    .typeError('EXP phải là số')
    .integer('EXP phải là số nguyên')
    .min(0, 'EXP không được âm')
    .default(0),
  point: yup
    .number()
    .typeError('Point phải là số')
    .integer('Point phải là số nguyên')
    .min(0, 'Point không được âm')
    .default(0),
});

export const userDefaultValues = {
  username: '',
  email: '',
  password: '',
  full_name: '',
  role_slug: 'user',
  membership_tier: 'free',
  status: 'active',
  is_verified: false,
  is_premium: false,
  level: 1,
  exp: 0,
  point: 0,
};
