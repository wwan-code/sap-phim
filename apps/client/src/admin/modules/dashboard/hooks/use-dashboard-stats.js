/**
 * @file use-dashboard-stats.js
 * @module Admin/Modules/Dashboard/Hooks/UseDashboardStats
 * @description Hook tổng hợp số liệu thống kê Dashboard Admin (Doanh thu, Người dùng, Lượt xem, Phim mới, Jobs transcode).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Mock/fallback data khi API chưa sẵn sàng hoặc đang dev
const generateMockChartData = (range) => {
  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 12 : 30;
  const series = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    if (range === '1y') {
      d.setMonth(d.getMonth() - i);
      series.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        displayDate: `T${d.getMonth() + 1}`,
        revenue: Math.floor(15000000 + Math.random() * 25000000),
        views: Math.floor(50000 + Math.random() * 80000),
        users: Math.floor(120 + Math.random() * 300),
      });
    } else {
      d.setDate(d.getDate() - i);
      series.push({
        date: d.toISOString().split('T')[0],
        displayDate: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: Math.floor(500000 + Math.random() * 2500000),
        views: Math.floor(1200 + Math.random() * 4500),
        users: Math.floor(10 + Math.random() * 50),
      });
    }
  }

  const totalRevenue = series.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalViews = series.reduce((acc, curr) => acc + curr.views, 0);
  const totalUsers = series.reduce((acc, curr) => acc + curr.users, 0);

  return {
    range,
    series,
    summary: {
      revenue: {
        total: totalRevenue,
        average: Math.floor(totalRevenue / days),
        growth: '+14.8%',
      },
      views: {
        total: totalViews,
        average: Math.floor(totalViews / days),
        growth: '+22.4%',
      },
      users: {
        total: totalUsers,
        average: Math.floor(totalUsers / days),
        growth: '+8.6%',
      },
    },
  };
};

export const useDashboardStats = () => {
  const [range, setRange] = useState('30d');

  const {
    data: chartData,
    isLoading: isChartLoading,
    isError: isChartError,
    refetch: refetchChart,
  } = useQuery({
    queryKey: ['admin', 'dashboard', 'chart-stats', range],
    queryFn: async () => {
      // Ở đây có thể gọi api/admin/stats?range=${range}
      return generateMockChartData(range);
    },
    staleTime: 60 * 1000,
  });

  const {
    data: overviewCards,
    isLoading: isCardsLoading,
    refetch: refetchCards,
  } = useQuery({
    queryKey: ['admin', 'dashboard', 'overview-metrics'],
    queryFn: async () => {
      return {
        totalMovies: 1248,
        moviesGrowth: '+12 phim tuần này',
        totalUsers: 84520,
        usersGrowth: '+340 user hôm nay',
        monthlyRevenue: 128500000,
        revenueGrowth: '+18.5% so với tháng trước',
        activeTranscodes: 3,
      };
    },
    staleTime: 60 * 1000,
  });

  const handleRefreshAll = () => {
    refetchChart();
    refetchCards();
  };

  return {
    range,
    setRange,
    chartData: chartData || generateMockChartData(range),
    overviewCards: overviewCards || {},
    isLoading: isChartLoading || isCardsLoading,
    isError: isChartError,
    onRetry: handleRefreshAll,
    onRefresh: handleRefreshAll,
  };
};

export default useDashboardStats;
