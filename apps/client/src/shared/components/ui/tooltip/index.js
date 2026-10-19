/**
 * @file index.js
 * @module Components/UI/Tooltip
 * @description Barrel export file xuất bản Tooltip component và các utility liên quan cho UI module.
 */

export { default, TooltipGroup } from './Tooltip';
export { default as Tooltip } from './Tooltip';
export { usePopperTooltip as useTooltip, getTransformOrigin } from '@/hooks/ui/use-popper-tooltip';
