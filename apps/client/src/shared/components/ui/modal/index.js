/**
 * @file index.js
 * @module Components/UI/Modal
 * @description Barrel export file xuất bản Modal, ConfirmModal, OverlayManager và các sub-components cho UI module.
 */

export { default } from './Modal';
export { default as Modal, ModalBody, ModalFooter, ModalHeader } from './Modal';
export { default as ConfirmModal } from './ConfirmModal';
export { default as OverlayManager, ModalManager } from '@/shared/utils/overlay-manager.util';
