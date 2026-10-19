/**
 * @file use-admin-page-loading.js
 * @module Admin/Layout/Hooks
 * @description Theo dõi chuyển trang và dữ liệu đang tải lần đầu, bỏ qua prefetch và làm mới nền.
 */

import { useIsFetching } from '@tanstack/react-query';
import { useNavigation } from 'react-router-dom';

const isInitialVisibleQuery = (query) => (
  query.isActive()
  && query.state.status === 'pending'
  && query.state.data === undefined
);

/**
 * @hook useAdminPageLoading
 * @description Giữ thanh tải đến khi router và dữ liệu mới đang được hiển thị tải xong.
 * @returns {boolean} Có lượt chuyển trang, gửi biểu mẫu hoặc truy vấn mới đang chờ hay không.
 */
export const useAdminPageLoading = () => {
  const navigation = useNavigation();
  const initialQueryCount = useIsFetching({ predicate: isInitialVisibleQuery });

  return navigation.state !== 'idle' || initialQueryCount > 0;
};
