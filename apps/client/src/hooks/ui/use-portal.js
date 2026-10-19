/**
 * @file use-portal.js
 * @module Hooks/UI/UsePortal
 * @description Hook tạo hoặc tái sử dụng DOM node làm Portal để render overlay bên ngoài cây DOM thông thường.
 */

import { useEffect, useState } from "react";

/**
 * Hook tạo hoặc tái sử dụng DOM node làm cổng (Portal) cho React.
 *
 * @description
 * Hỗ trợ render Modal, Tooltip, hoặc Overlay ra ngoài hệ thống phân cấp DOM của React.
 * Tự động tạo thẻ div chứa nếu chưa tồn tại, và tự động xóa dọn dẹp khi thành phần unmount (nếu thẻ rỗng).
 *
 * @param {string} id - ID của phần tử chứa Portal
 * @returns {HTMLElement|null} - DOM Node mục tiêu để render Portal
 */
export const usePortal = (id = "modal-root") => {
  const [portalNode, setPortalNode] = useState(null);

  useEffect(() => {
    let node = document.getElementById(id);
    let isOwner = false;

    if (!node) {
      node = document.createElement("div");
      node.id = id;
      node.setAttribute("aria-live", "polite");
      document.body.appendChild(node);
      isOwner = true;
    }

    setPortalNode(node);

    return () => {
      // Chỉ xóa Node khỏi DOM nếu chúng ta là người tạo ra nó VÀ nó không chứa phần tử con nào khác
      if (isOwner && node.childNodes.length === 0) {
        node.remove();
      }
    };
  }, [id]);

  return portalNode;
};

// Exported as named export
