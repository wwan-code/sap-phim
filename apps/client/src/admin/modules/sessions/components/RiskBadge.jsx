/**
 * @file RiskBadge.jsx
 * @module Admin/Modules/Sessions/Components/RiskBadge
 * @description Component hiển thị điểm rủi ro và các cờ bất thường chuẩn Material 3 Expressive.
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  Flame,
} from 'lucide-react';
import Badge from '@/shared/components/ui/badge';

const ANOMALY_LABELS = {
  NEW_COUNTRY: 'Quốc gia lạ',
  NEW_CONTINENT: 'Châu lục lạ',
  IMPOSSIBLE_TRAVEL: 'Vận tốc bất khả thi',
  DIFFERENT_REGION: 'Vùng miền khác',
  NEW_DEVICE: 'Thiết bị mới',
  NEW_BROWSER: 'Trình duyệt mới',
  NEW_OS: 'Hệ điều hành mới',
  BOT_USER_AGENT: 'Bot / Tool',
  NEW_IP_RANGE: 'Dải IP mới',
  TOR_EXIT_NODE: 'Mạng ẩn danh Tor',
  DATACENTER_IP: 'VPN / Datacenter',
  UNUSUAL_HOUR: 'Giờ bất thường',
  HIGH_FREQUENCY: 'Tần suất cao',
  AFTER_FAILED_ATTEMPTS: 'Sau chuỗi thất bại',
};

export const RiskBadge = memo(({ score = 0, anomalyFlags = [], showFlags = true }) => {
  const numericScore = Number(score) || 0;

  let variant = 'success';
  let label = 'An toàn';
  let Icon = ShieldCheck;
  let pulse = false;

  if (numericScore > 80) {
    variant = 'error';
    label = 'Nguy cấp';
    Icon = Flame;
    pulse = true;
  } else if (numericScore > 60) {
    variant = 'error';
    label = 'Rủi ro cao';
    Icon = AlertOctagon;
  } else if (numericScore > 40) {
    variant = 'warning';
    label = 'Rủi ro vừa';
    Icon = AlertTriangle;
  } else if (numericScore > 20) {
    variant = 'info';
    label = 'Rủi ro thấp';
    Icon = ShieldAlert;
  }

  const flags = Array.isArray(anomalyFlags) ? anomalyFlags : [];

  return (
    <div className="risk-badge-group">
      <div className="risk-badge-group__main">
        <Badge
          variant={variant}
          size="small"
          radius="full"
          pulse={pulse}
          icon={<Icon size={12} />}
        >
          {numericScore}/100 • {label}
        </Badge>
      </div>

      {showFlags && flags.length > 0 && (
        <div className="risk-badge-group__flags">
          {flags.map((flag, idx) => {
            const flagKey =
              typeof flag === 'object' && flag !== null
                ? flag.type || flag.name || JSON.stringify(flag)
                : String(flag);
            return (
              <span key={idx} className="risk-badge-group__flag-tag">
                {ANOMALY_LABELS[flagKey] || flagKey}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
});

RiskBadge.propTypes = {
  score: PropTypes.number,
  anomalyFlags: PropTypes.arrayOf(PropTypes.string),
  showFlags: PropTypes.bool,
};

export default RiskBadge;
