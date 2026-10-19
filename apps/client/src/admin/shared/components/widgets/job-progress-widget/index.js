/**
 * @file index.js
 * @module Widgets/JobProgressWidget
 * @description Barrel export cho JobProgressWidget và useJobProgress hook.
 */

export { default } from './JobProgressWidget';
export { default as JobProgressWidget } from './JobProgressWidget';
export { useJobProgress } from './hooks/use-job-progress';
export { WIDGET_VARIANTS, JOB_STATUSES, JOB_STATUS_LABELS } from './job-progress-widget.constants';
