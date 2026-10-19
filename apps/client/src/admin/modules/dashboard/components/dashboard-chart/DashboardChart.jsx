/**
 * @file DashboardChart.jsx
 * @module Admin/Modules/Dashboard/Components/DashboardChart
 * @description Biểu đồ phân tích chuỗi thời gian đa chiều (Doanh thu, Lượt xem, Người dùng) — Recharts Composed Area/Bar hỗ trợ Adaptive Light Mode & Dark Mode.
 */

import React, { useState, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  Users,
  Calendar,
  Layers,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { SectionCard } from '@admin/shared/components/layout/section-card/SectionCard';
import './dashboard-chart.scss';

const RANGES = [
  { id: '7d', label: '7 ngày' },
  { id: '30d', label: '30 ngày' },
  { id: '90d', label: '90 ngày' },
  { id: '1y', label: '1 năm' },
];

const METRICS = [
  { id: 'all', label: 'Tổng hợp', icon: Layers, color: 'var(--sys-color-primary, #ff7f24)' },
  { id: 'revenue', label: 'Doanh thu', icon: DollarSign, color: '#f59e0b' },
  { id: 'views', label: 'Lượt xem', icon: Eye, color: '#0ea5e9' },
  { id: 'users', label: 'Thành viên', icon: Users, color: '#10b981' },
];

const formatVND = (val) => {
  if (!val) return '0 ₫';
  const num = Number(val);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M ₫`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K ₫`;
  return `${num.toLocaleString('vi-VN')} ₫`;
};

const formatShortNum = (val) => {
  if (!val) return '0';
  const num = Number(val);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('vi-VN');
};

/**
 * Custom Rich Tooltip Component
 */
const CustomChartTooltip = ({ active, payload, label, activeMetric }) => {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload || {};

  return (
    <div className="dashboard-chart-tooltip" role="tooltip">
      <div className="dashboard-chart-tooltip__header">
        <Calendar size={13} />
        <span>{dataPoint.displayDate || label} ({dataPoint.date})</span>
      </div>

      <div className="dashboard-chart-tooltip__items">
        {(activeMetric === 'all' || activeMetric === 'revenue') && (
          <div className="dashboard-chart-tooltip__item dashboard-chart-tooltip__item--revenue">
            <span className="dashboard-chart-tooltip__dot" style={{ background: '#f59e0b' }} />
            <span className="dashboard-chart-tooltip__label">Doanh thu:</span>
            <span className="dashboard-chart-tooltip__val">{formatVND(dataPoint.revenue)}</span>
          </div>
        )}

        {(activeMetric === 'all' || activeMetric === 'views') && (
          <div className="dashboard-chart-tooltip__item dashboard-chart-tooltip__item--views">
            <span className="dashboard-chart-tooltip__dot" style={{ background: '#0ea5e9' }} />
            <span className="dashboard-chart-tooltip__label">Lượt xem:</span>
            <span className="dashboard-chart-tooltip__val">{formatShortNum(dataPoint.views)} view</span>
          </div>
        )}

        {(activeMetric === 'all' || activeMetric === 'users') && (
          <div className="dashboard-chart-tooltip__item dashboard-chart-tooltip__item--users">
            <span className="dashboard-chart-tooltip__dot" style={{ background: '#10b981' }} />
            <span className="dashboard-chart-tooltip__label">Đăng ký mới:</span>
            <span className="dashboard-chart-tooltip__val">+{dataPoint.users} user</span>
          </div>
        )}
      </div>
    </div>
  );
};

CustomChartTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
  activeMetric: PropTypes.string,
};

export const DashboardChart = memo(function DashboardChart({
  chartData = {},
  isLoading = false,
  isError = false,
  onRetry,
  range = '30d',
  onRangeChange,
}) {
  const [activeMetric, setActiveMetric] = useState('all');

  const series = chartData?.series || [];
  const summary = chartData?.summary || {};

  const activeSummary = useMemo(() => {
    if (activeMetric === 'revenue') return summary.revenue;
    if (activeMetric === 'views') return summary.views;
    if (activeMetric === 'users') return summary.users;
    return summary.revenue || summary.views || {};
  }, [summary, activeMetric]);

  const growth = activeSummary?.growth || '+0.0%';
  const isPositiveGrowth = !growth.startsWith('-');
  const GrowthIcon = isPositiveGrowth ? TrendingUp : TrendingDown;

  return (
    <SectionCard className="dashboard-chart-card">
      {/* 1. Header Toolbar */}
      <div className="dashboard-chart-card__header">
        <div className="dashboard-chart-card__title-group">
          <h3 className="dashboard-chart-card__title">Biểu đồ Phân tích & Tăng trưởng</h3>
          <div className="dashboard-chart-card__metric-tabs" role="tablist">
            {METRICS.map((m) => {
              const Icon = m.icon;
              const isSelected = activeMetric === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`dashboard-chart-card__metric-pill ${
                    isSelected ? 'dashboard-chart-card__metric-pill--active' : ''
                  }`}
                  onClick={() => setActiveMetric(m.id)}
                >
                  <Icon size={14} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Range Filters & Summary Badges */}
        <div className="dashboard-chart-card__controls">
          <div className="dashboard-chart-card__range-group">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`dashboard-chart-card__range-btn ${
                  range === r.id ? 'dashboard-chart-card__range-btn--active' : ''
                }`}
                onClick={() => onRangeChange && onRangeChange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {activeSummary?.total !== undefined && (
            <div
              className={`dashboard-chart-card__growth-tag ${
                isPositiveGrowth
                  ? 'dashboard-chart-card__growth-tag--positive'
                  : 'dashboard-chart-card__growth-tag--negative'
              }`}
              title="So sánh với chu kỳ trước"
            >
              <GrowthIcon size={13} />
              <span>{growth}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Chart Canvas Area */}
      <div className="dashboard-chart-card__canvas-container">
        {isLoading && (
          <div className="dashboard-chart-card__loading-overlay" aria-busy="true">
            <div className="dashboard-chart-card__spinner" />
            <span>Đang tổng hợp dữ liệu chuỗi thời gian...</span>
          </div>
        )}

        {isError && (
          <div className="dashboard-chart-card__error-state">
            <AlertCircle size={28} className="dashboard-chart-card__error-icon" />
            <p>Không thể tải dữ liệu biểu đồ phân tích</p>
            {onRetry && (
              <button
                type="button"
                className="dashboard-chart-card__retry-btn"
                onClick={onRetry}
              >
                <RefreshCw size={14} />
                <span>Thử lại</span>
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && series.length === 0 && (
          <div className="dashboard-chart-card__empty-state">
            <Calendar size={28} />
            <p>Chưa có dữ liệu giao dịch hoặc lượt xem trong khoảng thời gian này</p>
          </div>
        )}

        {!isError && series.length > 0 && (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={series}
              margin={{ top: 15, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                {/* Revenue Gradient */}
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>

                {/* Views Gradient */}
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                </linearGradient>

                {/* Users Gradient */}
                <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--sys-color-outline-variant)"
                strokeOpacity={0.7}
              />

              <XAxis
                dataKey="displayDate"
                stroke="var(--sys-color-on-surface-variant)"
                tick={{ fill: 'var(--sys-color-on-surface-variant)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--sys-color-outline-variant)' }}
                minTickGap={20}
              />

              <YAxis
                yAxisId="primary"
                stroke="var(--sys-color-on-surface-variant)"
                tick={{ fill: 'var(--sys-color-on-surface-variant)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                  if (activeMetric === 'revenue') return formatVND(val);
                  return formatShortNum(val);
                }}
              />

              {activeMetric === 'all' && (
                <YAxis
                  yAxisId="secondary"
                  orientation="right"
                  stroke="var(--sys-color-on-surface-variant)"
                  tick={{ fill: 'var(--sys-color-on-surface-variant)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => formatShortNum(val)}
                />
              )}

              <Tooltip
                content={<CustomChartTooltip activeMetric={activeMetric} />}
                cursor={{
                  stroke: 'var(--sys-color-outline)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />

              {/* RENDER DỰA TRÊN METRIC ĐANG CHỌN */}
              {(activeMetric === 'all' || activeMetric === 'revenue') && (
                <Area
                  yAxisId="primary"
                  type="monotone"
                  dataKey="revenue"
                  name="Doanh thu"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  activeDot={{ r: 5, stroke: '#f59e0b', strokeWidth: 2, fill: 'var(--sys-color-surface)' }}
                />
              )}

              {(activeMetric === 'all' || activeMetric === 'views') && (
                <Area
                  yAxisId={activeMetric === 'all' ? 'secondary' : 'primary'}
                  type="monotone"
                  dataKey="views"
                  name="Lượt xem"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#viewsGrad)"
                  activeDot={{ r: 5, stroke: '#0ea5e9', strokeWidth: 2, fill: 'var(--sys-color-surface)' }}
                />
              )}

              {activeMetric === 'users' && (
                <Bar
                  yAxisId="primary"
                  dataKey="users"
                  name="Đăng ký mới"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 3. Summary Footer Pills */}
      {!isLoading && !isError && summary && (
        <div className="dashboard-chart-card__footer">
          <div className="dashboard-chart-card__stat-pill">
            <span className="dashboard-chart-card__stat-label">Tổng trong kỳ:</span>
            <span className="dashboard-chart-card__stat-value">
              {activeMetric === 'revenue'
                ? formatVND(summary.revenue?.total)
                : activeMetric === 'views'
                ? `${formatShortNum(summary.views?.total)} views`
                : activeMetric === 'users'
                ? `${formatShortNum(summary.users?.total)} users`
                : `${formatVND(summary.revenue?.total)} • ${formatShortNum(summary.views?.total)} views`}
            </span>
          </div>

          <div className="dashboard-chart-card__stat-pill">
            <span className="dashboard-chart-card__stat-label">Trung bình/ngày:</span>
            <span className="dashboard-chart-card__stat-value">
              {activeMetric === 'revenue'
                ? formatVND(summary.revenue?.average)
                : activeMetric === 'views'
                ? `${formatShortNum(summary.views?.average)} views`
                : `${summary.users?.average || 0} users`}
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  );
});

DashboardChart.propTypes = {
  chartData: PropTypes.shape({
    range: PropTypes.string,
    metric: PropTypes.string,
    series: PropTypes.array,
    summary: PropTypes.object,
  }),
  isLoading: PropTypes.bool,
  isError: PropTypes.bool,
  onRetry: PropTypes.func,
  range: PropTypes.string,
  onRangeChange: PropTypes.func,
};

export default DashboardChart;
