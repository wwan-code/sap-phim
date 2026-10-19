/**
 * @file CalendarStatusBadge.jsx
 * @module Admin/Modules/Calendar/Components/CalendarStatusBadge
 * @description Dumb component hiển thị huy hiệu trạng thái lịch phát sóng (Upcoming / Released / Delayed / Cancelled).
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import './calendar-status-badge.scss';

const STATUS_CONFIG = {
  upcoming: {
    label: 'Sắp chiếu',
    icon: Clock,
    className: 'calendar-status-badge--upcoming',
  },
  released: {
    label: 'Đã phát sóng',
    icon: CheckCircle2,
    className: 'calendar-status-badge--released',
  },
  delayed: {
    label: 'Hoãn chiếu',
    icon: AlertTriangle,
    className: 'calendar-status-badge--delayed',
  },
  cancelled: {
    label: 'Hủy chiếu',
    icon: XCircle,
    className: 'calendar-status-badge--cancelled',
  },
};

export const CalendarStatusBadge = ({ status = 'upcoming', delayReason = null }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  const Icon = config.icon;

  return (
    <span
      className={`calendar-status-badge ${config.className}`}
      title={delayReason ? `Lý do: ${delayReason}` : config.label}
    >
      <Icon className="calendar-status-badge__icon" size={12} />
      <span className="calendar-status-badge__label">{config.label}</span>
      {delayReason && (
        <span className="calendar-status-badge__dot" title={`Lý do: ${delayReason}`} />
      )}
    </span>
  );
};

CalendarStatusBadge.propTypes = {
  status: PropTypes.oneOf(['upcoming', 'released', 'delayed', 'cancelled']),
  delayReason: PropTypes.string,
};

export default CalendarStatusBadge;
