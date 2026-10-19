/**
 * @file AIWorkflowSteps.jsx
 * @module Admin/Movies/Components
 * @description Compact, accessible navigation through the suggestion workflow.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Check } from 'lucide-react';

import './ai-workflow.scss';

/** @component AIWorkflowSteps @description Render actual request, processing and review stages. */
const AIWorkflowSteps = ({ active = 0 }) => (
  <ol className="sp-ai-flow" aria-label="Các bước gợi ý">
    {['Chọn tác phẩm', 'Tổng hợp', 'Duyệt dữ liệu'].map((label, index) => (
      <li key={label} className={'sp-ai-flow__step' + (index === active ? ' sp-ai-flow__step--current' : '') + (index < active ? ' sp-ai-flow__step--done' : '')} aria-current={index === active ? 'step' : undefined}>
        <span className="sp-ai-flow__number" aria-hidden="true">{index < active ? <Check size={12} /> : index + 1}</span>
        <span>{label}</span>
      </li>
    ))}
  </ol>
);
AIWorkflowSteps.propTypes = { active: PropTypes.number };
export default AIWorkflowSteps;
