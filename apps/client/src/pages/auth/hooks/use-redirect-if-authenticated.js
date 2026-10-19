/**
 * @file use-redirect-if-authenticated.js
 * @module Pages/Auth/Hooks/UseRedirectIfAuthenticated
 * @description Custom hook tự động điều hướng người dùng khỏi các trang Auth nếu đã hoàn tất đăng nhập.
 * @returns {boolean} Trạng thái đã đăng nhập của người dùng
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import useAuth from '@/hooks/use-auth';

/**
 * @param {string} [target='/'] Đường dẫn điều hướng đến khi đã xác thực
 * @returns {boolean} isAuthenticated - hữu ích nếu trang cần biết trạng thái này
 */
export default function useRedirectIfAuthenticated(target = '/') {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            navigate(target, { replace: true });
        }
    }, [isAuthenticated, navigate, target]);

    return isAuthenticated;
}