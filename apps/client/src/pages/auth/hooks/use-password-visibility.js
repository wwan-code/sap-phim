/**
 * @file use-password-visibility.js
 * @module Pages/Auth/Hooks/UsePasswordVisibility
 * @description Custom hook quản lý trạng thái ẩn/hiện mật khẩu trong các form xác thực Auth.
 * @returns {[boolean, () => void]} Tuple trạng thái hiển thị và hàm chuyển đổi toggle
 */

import { useState, useCallback } from 'react';

/**
 * @param {boolean} [initial=false] Trạng thái hiển thị ban đầu
 * @returns {[boolean, () => void]} [isVisible, toggleVisibility]
 */
export default function usePasswordVisibility(initial = false) {
    const [isVisible, setIsVisible] = useState(initial);

    const toggleVisibility = useCallback(() => {
        setIsVisible((prev) => !prev);
    }, []);

    return [isVisible, toggleVisibility];
}