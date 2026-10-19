/**
 * @file PasswordStrengthBar.jsx
 * @module Pages/Auth/Components/PasswordStrengthBar
 * @component PasswordStrengthBar
 * @description Thanh đo độ mạnh mật khẩu thời gian thực (Real-time Password Strength) kết hợp checklist tiêu chí bảo mật chuẩn Material 3 Expressive.
 */

import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CheckCircle2, Circle } from 'lucide-react';

import { calculatePasswordStrength } from '../utils/auth-form.validator';

/**
 * @component PasswordStrengthBar
 * @description Hiển thị trực quan mức độ an toàn của mật khẩu và các tiêu chí đã đạt được.
 */
const PasswordStrengthBar = ({ password = '', showCriteria = true }) => {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  if (!password) {
    return null;
  }

  const { criteria, label, level, score } = strength;

  return (
    <div className="password-strength">
      <div className="password-strength__header">
        <span className="password-strength__title">Độ mạnh mật khẩu:</span>
        <span className={`password-strength__label password-strength__label--${level}`}>
          {label}
        </span>
      </div>

      <div className="password-strength__bar-wrapper">
        <div
          className={classNames('password-strength__bar', `password-strength__bar--${level}`)}
          style={{ width: `${Math.max(10, score)}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label={`Độ an toàn mật khẩu: ${label}`}
        />
      </div>

      {showCriteria && (
        <ul className="password-strength__criteria-list" aria-label="Tiêu chí bảo mật mật khẩu">
          <li
            className={classNames('password-strength__criterion', {
              'password-strength__criterion--met': criteria.hasMinLength,
            })}
          >
            {criteria.hasMinLength ? (
              <CheckCircle2 size={13} className="password-strength__icon password-strength__icon--success" aria-hidden="true" />
            ) : (
              <Circle size={13} className="password-strength__icon password-strength__icon--unmet" aria-hidden="true" />
            )}
            <span>Tối thiểu 8 ký tự</span>
          </li>

          <li
            className={classNames('password-strength__criterion', {
              'password-strength__criterion--met': criteria.hasLetter,
            })}
          >
            {criteria.hasLetter ? (
              <CheckCircle2 size={13} className="password-strength__icon password-strength__icon--success" aria-hidden="true" />
            ) : (
              <Circle size={13} className="password-strength__icon password-strength__icon--unmet" aria-hidden="true" />
            )}
            <span>Có ít nhất 1 chữ cái (a-z, A-Z)</span>
          </li>

          <li
            className={classNames('password-strength__criterion', {
              'password-strength__criterion--met': criteria.hasNumberOrSpecial,
            })}
          >
            {criteria.hasNumberOrSpecial ? (
              <CheckCircle2 size={13} className="password-strength__icon password-strength__icon--success" aria-hidden="true" />
            ) : (
              <Circle size={13} className="password-strength__icon password-strength__icon--unmet" aria-hidden="true" />
            )}
            <span>Có ít nhất 1 chữ số hoặc ký tự đặc biệt</span>
          </li>
        </ul>
      )}
    </div>
  );
};

PasswordStrengthBar.propTypes = {
  password: PropTypes.string,
  showCriteria: PropTypes.bool,
};

export default memo(PasswordStrengthBar);
