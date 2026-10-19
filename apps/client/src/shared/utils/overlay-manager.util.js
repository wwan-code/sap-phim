/**
 * @file overlay-manager.util.js
 * @module Shared/Utils/OverlayManager
 * @description Singleton utility quản lý stack z-index, thứ tự hiển thị và focus/Escape dismiss cho các Modal, OffCanvas Drawer, Bottom Sheet và Overlay instances mở đồng thời.
 */

const BASE_Z_INDEX = 1050;
const Z_INDEX_STEP = 10;

/**
 * Quản lý stack của các Modal / OffCanvas / Overlay
 */
const OverlayManager = (() => {
  const stack = [];

  return {
    /**
     * Đăng ký overlay instance vào stack, trả về z-index được cấp phát.
     * @param {string} id - Unique id của overlay instance
     * @returns {number} z-index cấp phát
     */
    push(id) {
      const zIndex = BASE_Z_INDEX + stack.length * Z_INDEX_STEP;
      stack.push({ id, zIndex });
      return zIndex;
    },

    /**
     * Gỡ overlay instance khỏi stack khi đóng.
     * @param {string} id - Unique id của overlay instance
     */
    pop(id) {
      const idx = stack.findIndex((item) => item.id === id);
      if (idx !== -1) stack.splice(idx, 1);
    },

    /**
     * Kiểm tra overlay có đang ở trên cùng của stack không (cho phép phím Escape đóng đúng tầng trên cùng).
     * @param {string} id - Unique id của overlay instance
     * @returns {boolean}
     */
    isTop(id) {
      if (stack.length === 0) return false;
      return stack[stack.length - 1].id === id;
    },

    /**
     * Alias tương thích ngược với isTop
     * @param {string} id - Unique id của overlay instance
     * @returns {boolean}
     */
    isTopModal(id) {
      return this.isTop(id);
    },

    /**
     * Lấy số lượng overlay đang mở
     * @type {number}
     */
    get count() {
      return stack.length;
    },
  };
})();

export { OverlayManager, OverlayManager as ModalManager };
export default OverlayManager;
