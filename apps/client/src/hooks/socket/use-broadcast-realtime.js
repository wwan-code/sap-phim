/**
 * @file use-broadcast-realtime.js
 * @module Hooks/Socket/BroadcastRealtime
 * @description Hook lắng nghe các sự kiện socket realtime liên quan đến lịch phát sóng và âm thầm làm mới cache React Query.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from './use-socket';
import { SOCKET_EVENTS } from '@/shared/constants/socket-events.constants';
import { BROADCAST_QUERY_KEYS } from '@/hooks/queries/use-broadcast.queries';

/**
 * Hook tự động đồng bộ thời gian thực cho hệ thống lịch phát sóng (Silent Cache Invalidation)
 */
export function useBroadcastRealtime() {
  const queryClient = useQueryClient();

  const handleSilentInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: BROADCAST_QUERY_KEYS.all });
  }, [queryClient]);

  // Lắng nghe sự kiện tập phim phát hành tự động thành công
  useSocketEvent(SOCKET_EVENTS.BROADCAST_EPISODE_RELEASED, handleSilentInvalidate);

  // Lắng nghe sự kiện cấu hình lịch chiếu phim được tạo mới/cập nhật/xóa
  useSocketEvent(SOCKET_EVENTS.BROADCAST_SCHEDULE_UPDATED, handleSilentInvalidate);

  // Lắng nghe sự kiện một tập được ghi đè, khôi phục hoặc đổi trạng thái (hoãn/hủy)
  useSocketEvent(SOCKET_EVENTS.BROADCAST_CALENDAR_CHANGED, handleSilentInvalidate);
}

export default useBroadcastRealtime;
