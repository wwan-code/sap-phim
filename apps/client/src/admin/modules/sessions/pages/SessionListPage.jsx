/**
 * @file SessionListPage.jsx
 * @module Admin/Modules/Sessions/Pages/SessionListPage
 * @description Quản lý các phiên đăng nhập và nhật ký bảo mật toàn hệ thống chuẩn Material 3 Expressive.
 * Tích hợp DataGrid, thống kê KPI an ninh, lọc rủi ro (Risk Score/Anomaly Flags), thu hồi phiên đơn lẻ & cưỡng chế đăng xuất qua WebSocket.
 */

import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Laptop,
  Tablet,
  LogOut,
  Eye,
  RefreshCw,
  Download,
  Filter,
  AlertTriangle,
  Globe,
  Clock,
  KeyRound,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/admin/shared/components/layout/page-header/PageHeader';
import { AdminFilterToolbar } from '@/admin/shared/components/layout/filter-toolbar';
import { DataGrid, formatDate, useDataGridQuery } from '@/admin/shared/components/data-display/data-grid';
import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import Select from '@/shared/components/ui/select';
import Badge from '@/shared/components/ui/badge';
import Tooltip from '@/shared/components/ui/tooltip';

import { useAuth } from '@/hooks/use-auth';
import { ROLES, ROLE_HIERARCHY } from '@/shared/constants/roles.constants';
import securityService from '@/shared/services/security.service';
import {
  ADMIN_SECURITY_QUERY_KEYS,
  useAdminSessionStatsQuery,
  useAdminAuditLogStatsQuery,
} from '@/hooks/queries/use-security.queries';
import {
  useAdminRevokeSessionMutation,
  useAdminRevokeUserAllSessionsMutation,
  useAdminExportAuditLogsMutation,
} from '@/hooks/mutations/use-security.mutations';

import {
  RiskBadge,
  SecurityKpiStats,
  SessionRevokeModal,
  AuditLogDetailDrawer,
} from '../components';
import {
  formatBrowserName,
  formatOsName,
  getDeviceCategory,
} from '../utils/session-format';

import './session-list-page.scss';

// ── Tab Cấu Hình ──
const MAIN_TABS = [
  { id: 'sessions', label: 'Phiên Hoạt Động', icon: <Laptop size={15} /> },
  { id: 'audit-logs', label: 'Nhật Ký Bảo Mật & Truy Vết', icon: <ShieldAlert size={15} /> },
];

const SESSION_STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'revoked', label: 'Đã thu hồi / Hết hạn' },
  { value: 'all', label: 'Tất cả trạng thái' },
];

const ROLE_OPTIONS = [
  { value: 'all', label: 'Tất cả vai trò' },
  { value: ROLES.BOSS, label: 'Quản trị tối cao (Boss)' },
  { value: ROLES.ADMIN, label: 'Quản trị viên (Admin)' },
  { value: ROLES.MODERATOR, label: 'Kiểm duyệt viên (Mod)' },
  { value: ROLES.USER, label: 'Người dùng (User)' },
];

const RISK_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả mức rủi ro' },
  { value: '50', label: 'Rủi ro cao (≥ 50)' },
  { value: '70', label: 'Nguy hiểm (≥ 70)' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'Tất cả mức độ' },
  { value: 'info', label: 'Thông tin (Info)' },
  { value: 'warn', label: 'Cảnh báo (Warn)' },
  { value: 'error', label: 'Lỗi (Error)' },
  { value: 'critical', label: 'Nguy cấp (Critical)' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Tất cả danh mục' },
  { value: 'authentication', label: 'Xác thực (Auth)' },
  { value: 'security', label: 'Bảo mật (Security)' },
  { value: 'session', label: 'Phiên đăng nhập' },
  { value: 'user', label: 'Người dùng' },
  { value: 'admin', label: 'Quản trị hệ thống' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả kết quả' },
  { value: 'success', label: 'Thành công (Success)' },
  { value: 'failure', label: 'Thất bại (Failure)' },
  { value: 'blocked', label: 'Bị chặn (Blocked)' },
];

export const SessionListPage = () => {
  const { user: currentUser } = useAuth();

  // ── State Chuyển Tab Chính ──
  const [activeTab, setActiveTab] = useState('sessions');

  // ── State Bộ lọc Tab 1: Phiên Đăng Nhập ──
  const [sessionStatus, setSessionStatus] = useState('active');
  const [sessionRole, setSessionRole] = useState('all');
  const [sessionRisk, setSessionRisk] = useState('all');

  // ── State Bộ lọc Tab 2: Nhật Ký Bảo Mật ──
  const [auditSeverity, setAuditSeverity] = useState('all');
  const [auditCategory, setAuditCategory] = useState('all');
  const [auditStatus, setAuditStatus] = useState('all');

  // ── State Modal / Drawer ──
  const [revokeModal, setRevokeModal] = useState({
    open: false,
    mode: 'single',
    session: null,
    user: null,
    isCurrentSession: false,
  });

  const [detailDrawer, setDetailDrawer] = useState({
    open: false,
    log: null,
  });

  // ── Stats Queries (KPIs) ──
  const {
    data: sessionStats = {},
    isLoading: isSessionStatsLoading,
    refetch: refetchSessionStats,
  } = useAdminSessionStatsQuery();

  const {
    data: auditStats = {},
    isLoading: isAuditStatsLoading,
    refetch: refetchAuditStats,
  } = useAdminAuditLogStatsQuery();

  // ── Query Params cho Tab 1: Sessions ──
  const sessionQueryParams = useMemo(() => {
    const params = {
      status: sessionStatus,
    };
    if (sessionRole !== 'all') params.role = sessionRole;
    if (sessionRisk !== 'all') params.min_risk_score = sessionRisk;
    return params;
  }, [sessionStatus, sessionRole, sessionRisk]);

  // ── Query Params cho Tab 2: Audit Logs ──
  const auditQueryParams = useMemo(() => {
    const params = {};
    if (auditSeverity !== 'all') params.severity = auditSeverity;
    if (auditCategory !== 'all') params.event_category = auditCategory;
    if (auditStatus !== 'all') params.status = auditStatus;
    return params;
  }, [auditSeverity, auditCategory, auditStatus]);

  // ── DataGrid Query: Sessions ──
  const {
    gridProps: sessionGridProps,
    refetch: refetchSessions,
  } = useDataGridQuery({
    queryKey: ADMIN_SECURITY_QUERY_KEYS.sessions(sessionQueryParams),
    queryFn: (params) => securityService.getAdminSessions(params),
    customParams: sessionQueryParams,
    defaultSortModel: [{ field: 'last_used_at', sort: 'desc' }],
    defaultPageSize: 10,
    syncUrlParams: false,
  });

  // ── DataGrid Query: Audit Logs ──
  const {
    gridProps: auditGridProps,
    refetch: refetchAuditLogs,
  } = useDataGridQuery({
    queryKey: ADMIN_SECURITY_QUERY_KEYS.auditLogs(auditQueryParams),
    queryFn: (params) => securityService.getAdminAuditLogs(params),
    customParams: auditQueryParams,
    defaultSortModel: [{ field: 'created_at', sort: 'desc' }],
    defaultPageSize: 15,
    syncUrlParams: false,
  });

  // ── Mutations ──
  const revokeSessionMutation = useAdminRevokeSessionMutation();
  const revokeAllSessionsMutation = useAdminRevokeUserAllSessionsMutation();
  const exportAuditLogsMutation = useAdminExportAuditLogsMutation();

  // ── Kiểm tra phân cấp vai trò khi thực hiện thu hồi ──
  const canRevokeTarget = useCallback(
    (targetRoleSlug, targetUserId) => {
      if (!currentUser) return false;
      const actorRoleSlug = currentUser?.role?.slug || currentUser?.role;
      if (actorRoleSlug === ROLES.BOSS) return true;

      const isSelf = String(currentUser.id) === String(targetUserId);
      if (isSelf) return true;

      const actorPriority = ROLE_HIERARCHY[actorRoleSlug] || 0;
      const targetPriority = ROLE_HIERARCHY[targetRoleSlug] || 0;
      return actorPriority > targetPriority;
    },
    [currentUser]
  );

  // ── Xử lý Refresh thủ công toàn bộ dữ liệu ──
  const handleRefreshAll = useCallback(() => {
    refetchSessionStats();
    refetchAuditStats();
    if (activeTab === 'sessions') {
      refetchSessions();
    } else {
      refetchAuditLogs();
    }
    toast.success('Đã làm mới dữ liệu hệ thống');
  }, [
    refetchSessionStats,
    refetchAuditStats,
    refetchSessions,
    refetchAuditLogs,
    activeTab,
  ]);

  // ── Mở Modal thu hồi 1 phiên ──
  const handleOpenRevokeSingle = useCallback(
    (session) => {
      const isCurrent =
        String(session.user_id) === String(currentUser?.id) &&
        session.is_active;

      setRevokeModal({
        open: true,
        mode: 'single',
        session,
        user: session.user,
        isCurrentSession: isCurrent,
      });
    },
    [currentUser]
  );

  // ── Mở Modal cưỡng chế đăng xuất toàn bộ thiết bị của User ──
  const handleOpenRevokeAll = useCallback((user) => {
    setRevokeModal({
      open: true,
      mode: 'all',
      session: null,
      user,
      isCurrentSession: false,
    });
  }, []);

  // ── Xác nhận thu hồi từ Modal ──
  const handleConfirmRevoke = useCallback(
    async (payload) => {
      try {
        if (revokeModal.mode === 'all') {
          await revokeAllSessionsMutation.mutateAsync({
            userId: payload.userId,
            reason: payload.reason,
          });
        } else {
          await revokeSessionMutation.mutateAsync(payload.sessionId);
        }
        setRevokeModal((prev) => ({ ...prev, open: false }));
        refetchSessions();
        refetchSessionStats();
      } catch (err) {
        // Error notification handled by mutation
      }
    },
    [
      revokeModal.mode,
      revokeAllSessionsMutation,
      revokeSessionMutation,
      refetchSessions,
      refetchSessionStats,
    ]
  );

  // ── Xuất báo cáo CSV Audit Logs ──
  const handleExportAuditLogs = useCallback(async () => {
    try {
      const data = await exportAuditLogsMutation.mutateAsync(auditQueryParams);
      if (!data || data.length === 0) {
        toast.error('Không có dữ liệu nhật ký phù hợp để xuất');
        return;
      }

      const headers = [
        'ID',
        'Thời gian',
        'Loại sự kiện',
        'Danh mục',
        'Mức độ',
        'Kết quả',
        'Tài khoản',
        'Địa chỉ IP',
        'Mô tả',
        'Mã lỗi',
        'Chi tiết lỗi',
        'Request ID',
        'Thời gian xử lý (ms)',
      ];

      const rows = data.map((item) => [
        item.id,
        item.created_at,
        item.event_type,
        item.event_category,
        item.severity,
        item.status,
        item.user,
        item.ip_address,
        item.description?.replace(/(\r\n|\n|\r)/gm, ' ') || '',
        item.error_code || '',
        item.error_message?.replace(/(\r\n|\n|\r)/gm, ' ') || '',
        item.request_id || '',
        item.response_time_ms || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `sap-phim-security-audit-${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Handled in mutation
    }
  }, [exportAuditLogsMutation, auditQueryParams]);

  // ── Cột DataGrid Tab 1: Phiên Đăng Nhập ──
  const sessionColumns = useMemo(
    () => [
      {
        field: 'user',
        headerName: 'Tài Khoản & Người Dùng',
        flex: 1.4,
        minWidth: 220,
        renderCell: (params) => {
          const user = params.row?.user || {};
          const roleSlug = user.role?.slug || 'user';
          const roleName = user.role?.name || roleSlug;

          return (
            <div className="session-user-cell">
              <div className="session-user-cell__avatar-wrap">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username || 'User'}
                    className="session-user-cell__avatar"
                  />
                ) : (
                  <div className="session-user-cell__avatar-fallback">
                    {(user.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="session-user-cell__info">
                <div className="session-user-cell__name-row">
                  <span className="session-user-cell__username">
                    {user.username || 'Ẩn danh'}
                  </span>
                  <Badge
                    variant={
                      roleSlug === 'boss'
                        ? 'primary'
                        : roleSlug === 'admin'
                        ? 'info'
                        : roleSlug === 'moderator'
                        ? 'warning'
                        : 'default'
                    }
                    size="small"
                  >
                    {roleName}
                  </Badge>
                </div>
                {user.email && (
                  <span className="session-user-cell__email">{user.email}</span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'device',
        headerName: 'Thiết Bị & Trình Duyệt',
        flex: 1.3,
        minWidth: 200,
        sortable: false,
        renderCell: (params) => {
          const device = params.row?.device_info || {};
          const deviceCategory = getDeviceCategory(device);
          const DeviceIcon =
            deviceCategory === 'mobile'
              ? Smartphone
              : deviceCategory === 'tablet'
              ? Tablet
              : Laptop;
          const browserName = formatBrowserName(device.browser);
          const osName = formatOsName(device.os);

          return (
            <div className="session-device-cell">
              <div className="session-device-cell__icon">
                <DeviceIcon size={18} />
              </div>
              <div className="session-device-cell__text">
                <strong>
                  {browserName} / {osName}
                </strong>
                {params.row?.user_agent && (
                  <span
                    className="session-device-cell__ua"
                    title={params.row.user_agent}
                  >
                    {params.row.user_agent}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'ip_address',
        headerName: 'Địa Chỉ IP',
        width: 140,
        sortable: true,
        renderCell: (params) => (
          <code className="session-ip-code">
            {params.row?.ip_address || 'N/A'}
          </code>
        ),
      },
      {
        field: 'risk_score',
        headerName: 'Điểm Rủi Ro',
        flex: 1.2,
        minWidth: 180,
        sortable: true,
        renderCell: (params) => (
          <RiskBadge
            score={params.row?.risk_score || 0}
            anomalyFlags={params.row?.anomaly_flags || []}
          />
        ),
      },
      {
        field: 'last_used_at',
        headerName: 'Hoạt Động Gần Nhất',
        width: 170,
        sortable: true,
        renderCell: (params) => (
          <div className="session-timestamp-cell">
            <Clock size={13} color="var(--sp-color-text-muted)" />
            <span>{formatDate(params.row?.last_used_at)}</span>
          </div>
        ),
      },
      {
        field: 'status',
        headerName: 'Trạng Thái',
        width: 130,
        sortable: false,
        renderCell: (params) => {
          const row = params.row || {};
          const isSelf = String(row.user_id) === String(currentUser?.id);

          if (isSelf && row.is_active) {
            return (
              <span className="session-current-badge">
                <ShieldCheck size={12} />
                Phiên hiện tại
              </span>
            );
          }

          if (row.status === 'revoked') {
            return (
              <Badge variant="error" size="small">
                Đã thu hồi
              </Badge>
            );
          }

          if (row.status === 'expired') {
            return (
              <Badge variant="default" size="small">
                Hết hạn
              </Badge>
            );
          }

          return (
            <Badge variant="success" size="small">
              Đang kết nối
            </Badge>
          );
        },
      },
      {
        field: 'actions',
        headerName: 'Thao Tác',
        width: 170,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => {
          const row = params.row || {};
          const targetUser = row.user || {};
          const allowed = canRevokeTarget(targetUser.role?.slug, row.user_id);
          const isRevoked = row.status === 'revoked' || row.status === 'expired';

          return (
            <div className="session-actions-cell">
              <Tooltip
                content={
                  !allowed
                    ? 'Bạn không có quyền thao tác trên tài khoản cấp bậc này'
                    : isRevoked
                    ? 'Phiên này đã bị vô hiệu hóa'
                    : 'Thu hồi phiên thiết bị này'
                }
              >
                <span>
                  <IconButton
                    size="small"
                    variant="standard"
                    color="danger"
                    disabled={!allowed || isRevoked}
                    onClick={() => handleOpenRevokeSingle(row)}
                  >
                    <LogOut size={15} />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip
                content={
                  !allowed
                    ? 'Bạn không có quyền thao tác trên tài khoản cấp bậc này'
                    : 'Cưỡng chế đăng xuất tất cả thiết bị của tài khoản này'
                }
              >
                <span>
                  <IconButton
                    size="small"
                    variant="standard"
                    color="warning"
                    disabled={!allowed}
                    onClick={() => handleOpenRevokeAll(targetUser)}
                  >
                    <ShieldAlert size={15} />
                  </IconButton>
                </span>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [canRevokeTarget, currentUser, handleOpenRevokeSingle, handleOpenRevokeAll]
  );

  // ── Cột DataGrid Tab 2: Nhật Ký Bảo Mật ──
  const auditColumns = useMemo(
    () => [
      {
        field: 'created_at',
        headerName: 'Thời Gian',
        width: 170,
        renderCell: (params) => (
          <div className="session-timestamp-cell">
            <Clock size={13} color="var(--sp-color-text-muted)" />
            <span>{formatDate(params.row?.created_at)}</span>
          </div>
        ),
      },
      {
        field: 'event_type',
        headerName: 'Loại Sự Kiện',
        flex: 1.3,
        minWidth: 200,
        renderCell: (params) => (
          <div className="audit-event-cell">
            <code className="audit-event-cell__type">
              {params.row?.event_type}
            </code>
            <span className="audit-event-cell__category">
              {params.row?.event_category}
            </span>
          </div>
        ),
      },
      {
        field: 'severity',
        headerName: 'Mức Độ',
        width: 120,
        renderCell: (params) => {
          const sev = params.row?.severity || 'info';
          const variant =
            sev === 'critical'
              ? 'error'
              : sev === 'error'
              ? 'error'
              : sev === 'warn'
              ? 'warning'
              : 'info';

          return (
            <Badge variant={variant} size="small" radius="full">
              {sev.toUpperCase()}
            </Badge>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Kết Quả',
        width: 120,
        renderCell: (params) => {
          const st = params.row?.status || 'success';
          const variant =
            st === 'success' ? 'success' : st === 'blocked' ? 'error' : 'error';

          return (
            <Badge variant={variant} size="small" radius="full">
              {st.toUpperCase()}
            </Badge>
          );
        },
      },
      {
        field: 'user',
        headerName: 'Tài Khoản',
        flex: 1.1,
        minWidth: 160,
        renderCell: (params) => {
          const u = params.row?.username || params.row?.user?.username || params.row?.email;
          return (
            <div className="audit-user-cell">
              <span className="audit-user-cell__name">
                {u || 'Ẩn danh'}
              </span>
              {params.row?.email && params.row?.username && (
                <span className="audit-user-cell__email">
                  {params.row.email}
                </span>
              )}
            </div>
          );
        },
      },
      {
        field: 'ip_address',
        headerName: 'Địa Chỉ IP',
        width: 140,
        renderCell: (params) => (
          <code className="session-ip-code">
            {params.row?.ip_address || 'N/A'}
          </code>
        ),
      },
      {
        field: 'actions',
        headerName: 'Chi Tiết',
        width: 90,
        sortable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => (
          <Tooltip content="Xem toàn bộ hồ sơ kỹ thuật & JSON">
            <IconButton
              size="small"
              variant="standard"
              color="primary"
              onClick={() => setDetailDrawer({ open: true, log: params.row })}
            >
              <Eye size={16} />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    []
  );

  const tabCounts = useMemo(() => ({
    sessions: sessionStats?.total_active ?? 0,
    'audit-logs': auditStats?.total_events ?? 0,
  }), [sessionStats?.total_active, auditStats?.total_events]);

  return (
    <div className="admin-page-container session-page">
      {/* 1. Header Trang Quản Trị */}
      <PageHeader
        title="Quản Lý Phiên Đăng Nhập & Bảo Mật"
        subtitle="Giám sát thời gian thực phiên làm việc toàn hệ thống, điểm rủi ro AI, và truy vết kiểm toán an ninh mạng."
        badge={
          activeTab === 'sessions'
            ? `${(sessionStats?.total_active ?? 0).toLocaleString()} phiên hoạt động`
            : `${(auditStats?.total_events ?? 0).toLocaleString()} sự kiện ghi nhận`
        }
        badgeVariant={activeTab === 'sessions' ? 'primary' : 'info'}
        actions={
          <div className="session-page__header-actions">
            <div className="session-page__auto-refresh-tag">
              <span className="pulse-dot" />
              <span>Thời gian thực</span>
            </div>

            {activeTab === 'audit-logs' && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download size={14} />}
                loading={exportAuditLogsMutation.isPending}
                onClick={handleExportAuditLogs}
              >
                Xuất Báo Cáo CSV
              </Button>
            )}

            <Button
              variant="tonal"
              size="small"
              startIcon={<RefreshCw size={14} />}
              onClick={handleRefreshAll}
            >
              Làm Mới
            </Button>
          </div>
        }
      />

      {/* 2. Khối Thẻ Thống Kê KPI An Ninh */}
      <SecurityKpiStats
        sessionStats={sessionStats}
        auditStats={auditStats}
        isLoading={isSessionStatsLoading || isAuditStatsLoading}
        onRefresh={handleRefreshAll}
      />

      {/* 3. Thanh Công Cụ Lọc & Điều Hướng Tab Chính */}
      <AdminFilterToolbar
        tabs={MAIN_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
      >
        {activeTab === 'sessions' ? (
          <>
            <Select
              size="small"
              value={sessionStatus}
              onChange={(_e, val) => setSessionStatus(val)}
              options={SESSION_STATUS_OPTIONS}
              className="session-filter-select"
            />
            <Select
              size="small"
              value={sessionRole}
              onChange={(_e, val) => setSessionRole(val)}
              options={ROLE_OPTIONS}
              className="session-filter-select"
            />
            <Select
              size="small"
              value={sessionRisk}
              onChange={(_e, val) => setSessionRisk(val)}
              options={RISK_FILTER_OPTIONS}
              className="session-filter-select"
            />
          </>
        ) : (
          <>
            <Select
              size="small"
              value={auditSeverity}
              onChange={(_e, val) => setAuditSeverity(val)}
              options={SEVERITY_OPTIONS}
              className="session-filter-select session-filter-select--narrow"
            />
            <Select
              size="small"
              value={auditCategory}
              onChange={(_e, val) => setAuditCategory(val)}
              options={CATEGORY_OPTIONS}
              className="session-filter-select session-filter-select--wide"
            />
            <Select
              size="small"
              value={auditStatus}
              onChange={(_e, val) => setAuditStatus(val)}
              options={STATUS_OPTIONS}
              className="session-filter-select"
            />
          </>
        )}
      </AdminFilterToolbar>

      {/* 4. Nội Dung Bảng Dữ Liệu Theo Tab */}
      {activeTab === 'sessions' ? (
        <DataGrid
          title="Danh Sách Phiên Đăng Nhập Hệ Thống"
          columns={sessionColumns}
          getRowId={(row) => row.id}
          toolbar
          showQuickFilter
          showColumnSelector
          showFilterButton
          quickFilterPlaceholder="Tìm kiếm tài khoản, email, IP, User-Agent..."
          density="standard"
          {...sessionGridProps}
        />
      ) : (
        <DataGrid
          title="Nhật Ký Kiểm Toán & Truy Vết Bảo Mật (Audit Logs)"
          columns={auditColumns}
          getRowId={(row) => row.id}
          toolbar
          showQuickFilter
          showColumnSelector
          showFilterButton
          quickFilterPlaceholder="Tìm kiếm theo IP, Username, Email, Request ID..."
          density="compact"
          {...auditGridProps}
        />
      )}

      {/* 6. Modal Xác Nhận Thu Hồi Phiên / Cưỡng Chế Đăng Xuất */}
      <SessionRevokeModal
        open={revokeModal.open}
        onClose={() => setRevokeModal((prev) => ({ ...prev, open: false }))}
        mode={revokeModal.mode}
        session={revokeModal.session}
        user={revokeModal.user}
        isCurrentSession={revokeModal.isCurrentSession}
        onConfirm={handleConfirmRevoke}
        isSubmitting={
          revokeSessionMutation.isPending || revokeAllSessionsMutation.isPending
        }
      />

      {/* 7. Drawer Chi Tiết Sự Kiện Audit Log */}
      <AuditLogDetailDrawer
        open={detailDrawer.open}
        onClose={() => setDetailDrawer({ open: false, log: null })}
        log={detailDrawer.log}
      />
    </div>
  );
};

export default SessionListPage;
