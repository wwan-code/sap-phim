/**
 * @file BenefitsList.jsx
 * @module Components/Common/AccessDeniedFallback/Components/BenefitsList
 * @component BenefitsList
 * @description Subcomponent hiển thị danh sách đặc quyền Premium/VIP với hiệu ứng framer-motion stagger.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

import { ANIMATION, getBenefitAnimation } from '../access-denied-fallback.constants';

import './benefits-list.scss';

/**
 * @component BenefitsList
 * @description Hiển thị danh sách lợi ích nâng cấp tài khoản dành cho người dùng bị giới hạn quyền truy cập
 */
const BenefitsList = memo(({ upgradeInfo }) => {
  if (!upgradeInfo?.benefits?.length) return null;

  return (
    <motion.div
      className="access-denied-benefits"
      {...ANIMATION.benefits}
    >
      <h3 className="access-denied-benefits__title">{upgradeInfo.title}</h3>
      <p className="access-denied-benefits__subtitle">{upgradeInfo.subtitle}</p>
      <ul className="access-denied-benefits__list" role="list">
        {upgradeInfo.benefits.map((benefit, index) => (
          <motion.li
            key={benefit}
            {...getBenefitAnimation(index)}
            className="access-denied-benefits__item"
          >
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{benefit}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
});

BenefitsList.displayName = 'BenefitsList';

BenefitsList.propTypes = {
  upgradeInfo: PropTypes.shape({
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string.isRequired,
    benefits: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
};

export default BenefitsList;
