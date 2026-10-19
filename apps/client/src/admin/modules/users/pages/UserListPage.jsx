/**
 * @file UserListPage.jsx
 * @module Admin/Modules/Users/Pages/UserListPage
 * @description Quản lý người dùng hệ thống cấp Production chuẩn Material 3 Expressive, tích hợp DataGrid, Server-side Pagination/Search/Sort/Filter, Drawer Create/Update, Confirm Lock/Unlock/Restore và TanStack Query.
 */

import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  Plus,
  Lock,
  Unlock,
  Crown,
  Edit,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Shield,
  Award,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/admin/shared/components/layout/page-header/PageHeader';
import { AdminFilterToolbar } from '@/admin/shared/components/layout/filter-toolbar';
import { DataGrid, formatDate, useDataGridQuery } from '@/admin/shared/components/data-display/data-grid';
import { EntityFormDrawer } from '@/admin/shared/components/forms/entity-form-drawer/EntityFormDrawer';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';
import IconButton from '@/shared/components/ui/icon-button';
import Button from '@/shared/components/ui/button';
import TextField from '@/shared/components/ui/text-field';
import Select from '@/shared/components/ui/select';
import Switch from '@/shared/components/ui/switch';
import Badge from '@/shared/components/ui/badge';

import userService from '@/shared/services/user.service';
import { ADMIN_USER_QUERY_KEYS } from '@/hooks/queries/use-user.queries';
import {
  useAdminCreateUserMutation,
  useAdminUpdateUserMutation,
  useAdminUpdateLevelMutation,
  useAdminRestoreUserMutation,
  useAdminBulkStatusMutation,
} from '@/hooks/mutations/use-user.mutations';
import {
  userCreateSchema,
  userUpdateSchema,
  userDefaultValues,
} from '@/admin/schemas/user.schema';
import { ROLES } from '@/shared/constants/roles.constants';
import {
  MAX_LEVEL,
  getExpForLevel,
  getLevelFromExp,
  getRankByLevel,
} from '@/shared/constants/level.constants';
import { RankIcon } from '@/shared/components/icons/ranks';
import { useAuth } from '@/hooks/use-auth';

import './user-list-page.scss';

// ── Tab cấu hình trạng thái ──
const STATUS_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Hoạt động' },
  { id: 'banned', label: 'Bị khóa' },
  { id: 'inactive', label: 'Vô hiệu hóa' },
];

// ── Extra Filter Options ──
const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả vai trò' },
  { value: ROLES.BOSS, label: 'Boss (Tối cao)' },
  { value: ROLES.ADMIN, label: 'Admin (Quản trị)' },
  { value: ROLES.MODERATOR, label: 'Moderator (Kiểm duyệt)' },
  { value: ROLES.USER, label: 'Thành viên (User)' },
];

const MEMBERSHIP_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả hạng VIP' },
  { value: 'free', label: 'Thường (Free)' },
  { value: 'plus', label: 'VIP Plus' },
  { value: 'pro', label: 'VIP Pro' },
  { value: 'ultra', label: 'VIP Ultra' },
];

// ── Form Select Options ──
const FORM_ROLE_OPTIONS = [
  { value: 'user', label: 'Thành viên (User)' },
  { value: 'moderator', label: 'Kiểm duyệt viên (Moderator)' },
  { value: 'admin', label: 'Quản trị viên (Admin)' },
  { value: 'boss', label: 'Quản trị tối cao (Boss)' },
];

const FORM_STATUS_OPTIONS = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'banned', label: 'Bị khóa' },
  { value: 'inactive', label: 'Vô hiệu hóa' },
];

const FORM_MEMBERSHIP_OPTIONS = [
  { value: 'free', label: 'Thường (Free)' },
  { value: 'plus', label: 'VIP Plus' },
  { value: 'pro', label: 'VIP Pro' },
  { value: 'ultra', label: 'VIP Ultra' },
];

export const UserListPage = () => {
  // ── Current Auth User ──
  const { user: currentUser, isBoss } = useAuth();

  // ── States ──
  const [activeTab, setActiveTab] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [membershipFilter, setMembershipFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Kiểm tra nếu đang chỉnh sửa tài khoản của chính mình
  const isSelfEditing = useMemo(() => {
    if (!editingItem || !currentUser) return false;
    return (
      String(currentUser.id) === String(editingItem.id) ||
      currentUser.username === editingItem.username
    );
  }, [editingItem, currentUser]);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: 'danger',
    title: '',
    content: '',
    confirmText: 'Xác nhận',
    onConfirm: () => {},
  });

  // ── Query Parameters ──
  const customParams = useMemo(() => {
    const params = {};
    if (activeTab !== 'all') {
      params.status = activeTab;
    }
    if (roleFilter && roleFilter !== 'all') {
      params.role = roleFilter;
    }
    if (membershipFilter && membershipFilter !== 'all') {
      params.membership_tier = membershipFilter;
    }
    return params;
  }, [activeTab, roleFilter, membershipFilter]);

  // ── DataGrid Query Hook ──
  const { counts, gridProps, refetch } = useDataGridQuery({
    queryKey: ADMIN_USER_QUERY_KEYS.list(customParams),
    queryFn: (params) => userService.listUsers(params),
    customParams,
    defaultSortModel: [{ field: 'created_at', sort: 'desc' }],
    defaultPageSize: 20,
    syncUrlParams: false,
  });

  // ── Mutations ──
  const createMutation = useAdminCreateUserMutation();
  const updateMutation = useAdminUpdateUserMutation();
  const updateLevelMutation = useAdminUpdateLevelMutation();
  const restoreMutation = useAdminRestoreUserMutation();
  const bulkStatusMutation = useAdminBulkStatusMutation();

  // ── Handlers: Mở Drawer ──
  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setDrawerOpen(true);
  }, []);

  const handleOpenEdit = useCallback((user) => {
    const effectiveLevel = user.level_info?.level || user.level || 1;
    const effectiveExp = user.level_info?.exp !== undefined ? user.level_info.exp : (user.exp || 0);
    const effectivePoint = user.level_info?.point !== undefined ? user.level_info.point : (user.point || 0);

    setEditingItem({
      ...user,
      role_slug: user.role?.slug || user.role_slug || 'user',
      membership_tier: user.membership_tier || 'free',
      level: Number(effectiveLevel),
      exp: Number(effectiveExp),
      point: Number(effectivePoint),
      is_verified: Boolean(user.is_verified),
      is_premium: Boolean(user.is_premium),
      password: '',
    });
    setDrawerOpen(true);
  }, []);

  // ── Handler: Submit Drawer Form ──
  const handleFormSubmit = async (formData) => {
    if (editingItem) {
      // Chuẩn bị payload cập nhật user (bảo vệ không cho tự đổi vai trò/trạng thái nếu là tài khoản của mình)
      const updatePayload = {
        id: editingItem.id,
        role_slug: isSelfEditing ? editingItem.role_slug : formData.role_slug,
        status: isSelfEditing ? editingItem.status : formData.status,
        membership_tier: formData.membership_tier,
        full_name: formData.full_name || '',
        is_verified: Boolean(formData.is_verified),
        is_premium: Boolean(formData.is_premium),
      };

      if (formData.password && formData.password.trim().length >= 8) {
        updatePayload.password = formData.password.trim();
      }

      await updateMutation.mutateAsync(updatePayload);

      // Cập nhật level stats nếu có thay đổi
      const nextLevel = Number(formData.level || 1);
      const nextExp = Number(formData.exp || 0);
      const nextPoint = Number(formData.point || 0);
      const levelChanged =
        nextLevel !== Number(editingItem.level) ||
        nextExp !== Number(editingItem.exp) ||
        nextPoint !== Number(editingItem.point);

      if (levelChanged) {
        await updateLevelMutation.mutateAsync({
          id: editingItem.id,
          level: nextLevel,
          exp: nextExp,
          point: nextPoint,
        });
      }

      toast.success('Cập nhật người dùng thành công!');
    } else {
      await createMutation.mutateAsync({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role_slug: formData.role_slug,
        full_name: formData.full_name?.trim() || undefined,
        membership_tier: formData.membership_tier,
        level: formData.level !== undefined ? Number(formData.level) : 1,
        exp: formData.exp !== undefined ? Number(formData.exp) : 0,
        point: formData.point !== undefined ? Number(formData.point) : 0,
      });
      toast.success('Tạo tài khoản người dùng thành công!');
    }

    setDrawerOpen(false);
    refetch();
  };

  // ── Handlers: Khóa / Mở khóa / Khôi phục đơn lẻ ──
  const handleToggleLockUser = useCallback((user) => {
    const isLocking = user.status === 'active';
    const nextStatus = isLocking ? 'banned' : 'active';

    setConfirmModal({
      open: true,
      type: isLocking ? 'danger' : 'primary',
      title: isLocking ? 'Xác nhận khóa tài khoản' : 'Xác nhận mở khóa tài khoản',
      content: isLocking
        ? `Bạn có chắc chắn muốn KHÓA tài khoản của "${user.full_name || user.username}" (@${user.username})? Người dùng sẽ không thể đăng nhập hoặc xem nội dung.`
        : `Bạn có muốn MỞ KHÓA tài khoản của "${user.full_name || user.username}" (@${user.username}) trở lại hoạt động bình thường?`,
      confirmText: isLocking ? 'Khóa tài khoản' : 'Mở khóa',
      onConfirm: async () => {
        try {
          await updateMutation.mutateAsync({
            id: user.id,
            status: nextStatus,
          });
          toast.success(isLocking ? 'Đã khóa tài khoản thành công!' : 'Đã mở khóa tài khoản!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Có lỗi xảy ra khi thay đổi trạng thái');
        }
      },
    });
  }, [updateMutation, refetch]);

  const handleRestoreUser = useCallback((user) => {
    setConfirmModal({
      open: true,
      type: 'primary',
      title: 'Khôi phục tài khoản',
      content: `Bạn có muốn khôi phục tài khoản "${user.full_name || user.username}" (@${user.username}) từ trạng thái vô hiệu hóa?`,
      confirmText: 'Khôi phục tài khoản',
      onConfirm: async () => {
        try {
          await restoreMutation.mutateAsync(user.id);
          toast.success('Khôi phục tài khoản thành công!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi khôi phục tài khoản');
        }
      },
    });
  }, [restoreMutation, refetch]);

  // ── Handlers: Bulk Actions ──
  const handleBulkStatusChange = useCallback((targetStatus) => {
    if (selectedIds.length === 0) return;

    const actionText =
      targetStatus === 'banned'
        ? 'KHÓA'
        : targetStatus === 'active'
          ? 'MỞ KHÓA / KÍCH HOẠT'
          : 'VÔ HIỆU HÓA';

    setConfirmModal({
      open: true,
      type: targetStatus === 'banned' ? 'danger' : 'primary',
      title: `Xác nhận ${actionText} hàng loạt`,
      content: `Bạn có chắc chắn muốn ${actionText} ${selectedIds.length} tài khoản người dùng đã chọn?`,
      confirmText: `Xác nhận (${selectedIds.length})`,
      onConfirm: async () => {
        try {
          await bulkStatusMutation.mutateAsync({
            userIds: selectedIds,
            status: targetStatus,
          });
          toast.success(`Đã cập nhật trạng thái ${selectedIds.length} tài khoản!`);
          setSelectedIds([]);
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi cập nhật hàng loạt');
        }
      },
    });
  }, [selectedIds, bulkStatusMutation, refetch]);

  // ── DataGrid Columns ──
  const columns = useMemo(
    () => [
      {
        field: 'full_name',
        headerName: 'Thành Viên',
        flex: 2,
        minWidth: 260,
        renderCell: ({ row }) => {
          const displayName = row.full_name || row.username;
          const initials = (row.full_name || row.username || 'U').slice(0, 2).toUpperCase();

          return (
            <div className="user-list-page__member-cell">
              <div className="user-list-page__avatar">
                {row.avatar_url ? (
                  <img
                    src={row.avatar_url}
                    alt={displayName}
                    className="user-list-page__avatar-img"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="user-list-page__avatar-fallback">{initials}</span>
                )}
              </div>
              <div className="user-list-page__member-info">
                <span className="user-list-page__member-name">
                  {displayName}
                  {row.is_verified && (
                    <CheckCircle2 size={14} className="user-list-page__verified-badge" />
                  )}
                </span>
                <span className="user-list-page__member-sub">
                  @{row.username} • {row.email}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        field: 'role',
        headerName: 'Vai Trò',
        width: 140,
        minWidth: 120,
        renderCell: ({ row }) => {
          const roleSlug = row.role?.slug || row.role_slug || 'user';
          let modifier = 'user';
          let roleLabel = 'User';

          if (roleSlug === ROLES.BOSS) {
            modifier = 'boss';
            roleLabel = 'Boss';
          } else if (roleSlug === ROLES.ADMIN) {
            modifier = 'admin';
            roleLabel = 'Admin';
          } else if (roleSlug === ROLES.MODERATOR) {
            modifier = 'moderator';
            roleLabel = 'Mod';
          }

          return (
            <span className={`user-list-page__role-badge user-list-page__role-badge--${modifier}`}>
              {roleLabel}
            </span>
          );
        },
      },
      {
        field: 'level',
        headerName: 'Cấp Bậc',
        width: 150,
        minWidth: 130,
        renderCell: ({ row }) => {
          const effectiveLevel = row.level_info?.level || row.level || 1;
          const effectiveExp = row.level_info?.exp !== undefined ? row.level_info.exp : (row.exp || 0);
          const effectivePoint = row.level_info?.point !== undefined ? row.level_info.point : (row.point || 0);
          const rank = row.level_info?.rank || getRankByLevel(effectiveLevel);

          return (
            <div className="user-list-page__level-cell">
              <span
                className="user-list-page__level-badge"
                style={{ borderColor: `${rank.color}50`, color: rank.color }}
                title={`${rank.name} (Lv.${rank.minLevel} - ${rank.maxLevel})`}
              >
                <RankIcon rankId={rank.id} size={15} />
                Lv.{effectiveLevel}
              </span>
              <span className="user-list-page__level-sub">
                {Number(effectiveExp).toLocaleString()} EXP • {Number(effectivePoint).toLocaleString()} P
              </span>
            </div>
          );
        },
      },
      {
        field: 'membership_tier',
        headerName: 'Hạng VIP',
        width: 150,
        minWidth: 130,
        renderCell: ({ row }) => {
          const tier = (row.membership_tier || 'free').toLowerCase();
          if (tier === 'ultra') {
            return (
              <span className="user-list-page__vip-badge user-list-page__vip-badge--ultra">
                <Crown size={14} /> VIP Ultra
              </span>
            );
          }
          if (tier === 'pro') {
            return (
              <span className="user-list-page__vip-badge user-list-page__vip-badge--pro">
                <Crown size={14} /> VIP Pro
              </span>
            );
          }
          if (tier === 'plus') {
            return (
              <span className="user-list-page__vip-badge user-list-page__vip-badge--plus">
                <Crown size={14} /> VIP Plus
              </span>
            );
          }
          return (
            <span className="user-list-page__vip-badge user-list-page__vip-badge--free">
              Thường
            </span>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Trạng Thái',
        width: 140,
        minWidth: 120,
        renderCell: ({ row }) => {
          const status = row.status || 'active';
          if (status === 'banned') {
            return (
              <Badge variant="error" size="small" icon={<Lock size={13} />}>
                Bị khóa
              </Badge>
            );
          }
          if (status === 'inactive') {
            return (
              <Badge variant="muted" size="small" icon={<XCircle size={13} />}>
                Vô hiệu hóa
              </Badge>
            );
          }
          return (
            <Badge variant="success" size="small" icon={<CheckCircle2 size={13} />}>
              Hoạt động
            </Badge>
          );
        },
      },
      {
        field: 'created_at',
        headerName: 'Ngày Tham Gia',
        type: 'date',
        width: 140,
        minWidth: 120,
        valueFormatter: ({ value }) => formatDate(value, false),
      },
      {
        field: '__actions__',
        headerName: 'Thao Tác',
        width: 120,
        minWidth: 110,
        sortable: false,
        filterable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => {
          const isSelfRow =
            currentUser &&
            (String(row.id) === String(currentUser.id) || row.username === currentUser.username);
          const isTargetBoss = (row.role?.slug || row.role_slug) === ROLES.BOSS;
          const canManage = isBoss || (!isTargetBoss && !isSelfRow);

          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              <IconButton
                size="small"
                variant="standard"
                color="default"
                title="Chỉnh sửa hồ sơ"
                onClick={() => handleOpenEdit(row)}
                disabled={!isBoss && isTargetBoss && !isSelfRow}
              >
                <Edit size={16} />
              </IconButton>

              {!isSelfRow && canManage && (
                row.status === 'inactive' ? (
                  <IconButton
                    size="small"
                    variant="standard"
                    color="primary"
                    title="Khôi phục tài khoản"
                    onClick={() => handleRestoreUser(row)}
                  >
                    <RotateCcw size={16} />
                  </IconButton>
                ) : (
                  <IconButton
                    size="small"
                    variant="standard"
                    color={row.status === 'active' ? 'danger' : 'success'}
                    title={row.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                    onClick={() => handleToggleLockUser(row)}
                  >
                    {row.status === 'active' ? <Lock size={16} /> : <Unlock size={16} />}
                  </IconButton>
                )
              )}
            </div>
          );
        },
      },
    ],
    [handleOpenEdit, handleRestoreUser, handleToggleLockUser, currentUser, isBoss]
  );

  // ── Dynamic Page Header Badge ──
  const headerBadge = useMemo(() => {
    if (activeTab === 'banned') {
      return counts?.banned !== undefined ? `${counts.banned} bị khóa` : undefined;
    }
    if (activeTab === 'inactive') {
      return counts?.inactive !== undefined ? `${counts.inactive} vô hiệu hóa` : undefined;
    }
    if (activeTab === 'active') {
      return counts?.active !== undefined ? `${counts.active} đang hoạt động` : undefined;
    }
    return counts?.all !== undefined ? `${counts.all} thành viên` : undefined;
  }, [activeTab, counts]);

  const headerBadgeVariant = useMemo(() => {
    if (activeTab === 'banned' && (counts?.banned || 0) > 0) return 'error';
    if (activeTab === 'inactive' && (counts?.inactive || 0) > 0) return 'muted';
    return 'primary';
  }, [activeTab, counts]);

  return (
    <div className="admin-page-container user-list-page">
      {/* 1. Header */}
      <PageHeader
        title="Quản Lý Người Dùng & Phân Quyền"
        subtitle="Quản trị danh sách thành viên, cấp bậc Level/EXP, quyền hạn hệ thống và trạng thái VIP."
        badge={headerBadge}
        badgeVariant={headerBadgeVariant}
        actions={
          <Button
            variant="filled"
            color="primary"
            startIcon={<Plus size={16} />}
            onClick={handleOpenCreate}
          >
            Thêm Thành Viên
          </Button>
        }
      />

      {/* 2. Status Filter Tabs & Extra Filter Toolbar */}
      <AdminFilterToolbar
        tabs={STATUS_TABS}
        activeTab={activeTab}
        counts={counts || {}}
        onTabChange={(tabId) => {
          setActiveTab(tabId);
          setSelectedIds([]);
        }}
      >
        <Select
          size="small"
          value={roleFilter}
          onChange={(_e, val) => setRoleFilter(val)}
          options={ROLE_FILTER_OPTIONS}
          placeholder="Tất cả vai trò"
          className="user-list-page__filter-select"
        />
        <Select
          size="small"
          value={membershipFilter}
          onChange={(_e, val) => setMembershipFilter(val)}
          options={MEMBERSHIP_FILTER_OPTIONS}
          placeholder="Tất cả hạng VIP"
          className="user-list-page__filter-select"
        />
      </AdminFilterToolbar>

      {/* 3. Central DataGrid */}
      <DataGrid
        title="Danh Sách Thành Viên & Quản Trị"
        columns={columns}
        getRowId={(row) => row.id}
        checkboxSelection
        rowSelectionModel={selectedIds}
        onRowSelectionModelChange={setSelectedIds}
        customBulkActions={
          selectedIds.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {activeTab === 'banned' ? (
                <Button
                  size="small"
                  variant="tonal"
                  color="success"
                  startIcon={<Unlock size={14} />}
                  onClick={() => handleBulkStatusChange('active')}
                >
                  Mở khóa ({selectedIds.length})
                </Button>
              ) : activeTab === 'inactive' ? (
                <Button
                  size="small"
                  variant="tonal"
                  color="primary"
                  startIcon={<RotateCcw size={14} />}
                  onClick={() => handleBulkStatusChange('active')}
                >
                  Khôi phục ({selectedIds.length})
                </Button>
              ) : (
                <>
                  <Button
                    size="small"
                    variant="tonal"
                    color="error"
                    startIcon={<Lock size={14} />}
                    onClick={() => handleBulkStatusChange('banned')}
                  >
                    Khóa ({selectedIds.length})
                  </Button>
                  <Button
                    size="small"
                    variant="tonal"
                    color="success"
                    startIcon={<Unlock size={14} />}
                    onClick={() => handleBulkStatusChange('active')}
                  >
                    Kích hoạt ({selectedIds.length})
                  </Button>
                </>
              )}
            </div>
          ) : undefined
        }
        density="standard"
        toolbar
        showQuickFilter
        showColumnSelector
        showFilterButton
        showExportButton
        {...gridProps}
      />

      {/* 4. Slide-over Form Drawer */}
      <EntityFormDrawer
        key={editingItem ? `edit-${editingItem.id}` : 'create'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
        title={editingItem ? 'Chỉnh Sửa Người Dùng' : 'Thêm Thành Viên Mới'}
        subtitle={
          editingItem
            ? `Cập nhật thông tin cho @${editingItem.username}`
            : 'Tạo tài khoản người dùng hoặc quản trị viên mới.'
        }
        schema={editingItem ? userUpdateSchema : userCreateSchema}
        defaultValues={userDefaultValues}
        initialData={editingItem}
        isEdit={Boolean(editingItem)}
        onSubmit={handleFormSubmit}
      >
        {({ register, formState: { errors }, setValue, watch }) => (
          <>
            {/* Header tổng quan khi sửa */}
            {editingItem && (
              <div className="user-list-page__drawer-preview">
                <div className="user-list-page__drawer-preview-avatar">
                  {editingItem.avatar_url ? (
                    <img src={editingItem.avatar_url} alt={editingItem.username} />
                  ) : (
                    <span>{(editingItem.full_name || editingItem.username || 'U').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="user-list-page__drawer-preview-info">
                  <span className="user-list-page__drawer-preview-name">
                    {editingItem.full_name || editingItem.username}
                    {editingItem.is_verified && (
                      <CheckCircle2 size={15} className="user-list-page__verified-badge" />
                    )}
                  </span>
                  <span className="user-list-page__drawer-preview-sub">
                    @{editingItem.username} • {editingItem.email}
                  </span>
                  <div className="user-list-page__drawer-preview-badges">
                    <span className="user-list-page__level-badge">
                      <RankIcon level={editingItem.level_info?.level || editingItem.level || 1} size={15} />
                      Lv.{editingItem.level_info?.level || editingItem.level || 1}
                    </span>
                    <span className={`user-list-page__role-badge user-list-page__role-badge--${editingItem.role?.slug || editingItem.role_slug || 'user'}`}>
                      {editingItem.role?.name || editingItem.role?.slug || editingItem.role_slug || 'User'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Mục 1: Thông tin tài khoản */}
            <div className="user-list-page__drawer-section-title">
              <Shield size={14} /> Thông Tin Tài Khoản
            </div>

            <div className="entity-form-drawer__field-group">
              <TextField
                label="Họ và tên"
                placeholder="Ví dụ: Nguyễn Văn A..."
                error={errors.full_name?.message}
                {...register('full_name')}
              />
            </div>

            <div className="entity-form-drawer__row-2">
              <div className="entity-form-drawer__field-group">
                <TextField
                  label="Tên đăng nhập (Username)"
                  placeholder="Ví dụ: user_name99"
                  required={!editingItem}
                  disabled={Boolean(editingItem)}
                  error={errors.username?.message}
                  {...register('username')}
                />
              </div>

              <div className="entity-form-drawer__field-group">
                <TextField
                  label="Địa chỉ Email"
                  type="email"
                  placeholder="email@sapphim.vn"
                  required={!editingItem}
                  disabled={Boolean(editingItem)}
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>
            </div>

            <div className="entity-form-drawer__field-group">
              <TextField
                label={editingItem ? 'Mật khẩu mới (Tùy chọn)' : 'Mật khẩu khởi tạo'}
                type="password"
                placeholder={
                  editingItem ? 'Để trống nếu không muốn thay đổi...' : 'Tối thiểu 8 ký tự'
                }
                required={!editingItem}
                error={errors.password?.message}
                {...register('password')}
              />
            </div>

            <div className="entity-form-drawer__row-2">
              <div className="entity-form-drawer__field-group">
                <Select
                  label="Vai trò (Role)"
                  options={FORM_ROLE_OPTIONS}
                  value={watch('role_slug')}
                  onChange={(_e, val) => {
                    const v = typeof val !== 'undefined' ? val : _e?.target?.value;
                    setValue('role_slug', v, { shouldDirty: true, shouldValidate: true });
                  }}
                  disabled={isSelfEditing}
                  helperText={isSelfEditing ? 'Không thể tự thay đổi vai trò của chính mình' : undefined}
                  error={errors.role_slug?.message}
                  required
                />
              </div>

              <div className="entity-form-drawer__field-group">
                <Select
                  label="Trạng thái tài khoản"
                  options={FORM_STATUS_OPTIONS}
                  value={watch('status')}
                  onChange={(_e, val) => {
                    const v = typeof val !== 'undefined' ? val : _e?.target?.value;
                    setValue('status', v, { shouldDirty: true, shouldValidate: true });
                  }}
                  disabled={isSelfEditing}
                  helperText={isSelfEditing ? 'Không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình' : undefined}
                  error={errors.status?.message}
                />
              </div>
            </div>

            <div className="entity-form-drawer__field-group">
              <Select
                label="Hạng hội viên VIP"
                options={FORM_MEMBERSHIP_OPTIONS}
                value={watch('membership_tier')}
                onChange={(_e, val) => {
                  const v = typeof val !== 'undefined' ? val : _e?.target?.value;
                  setValue('membership_tier', v, { shouldDirty: true, shouldValidate: true });
                  setValue('is_premium', v !== 'free', { shouldDirty: true, shouldValidate: true });
                }}
                error={errors.membership_tier?.message}
              />
            </div>

            {/* Mục 2: Cấp bậc & Điểm thưởng */}
            <div className="user-list-page__drawer-section-title">
              <Award size={14} /> Cấp Bậc & Điểm Thưởng
            </div>

            <div className="user-list-page__stats-grid">
              <div className="entity-form-drawer__field-group">
                <TextField
                  label="Cấp bậc (Level 1-100)"
                  type="number"
                  placeholder="1"
                  error={errors.level?.message}
                  {...register('level', {
                    valueAsNumber: true,
                    onChange: (e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        const clamped = Math.max(1, Math.min(MAX_LEVEL, val));
                        setValue('exp', getExpForLevel(clamped), {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                    },
                  })}
                />
              </div>

              <div className="entity-form-drawer__field-group">
                <TextField
                  label="Điểm EXP"
                  type="number"
                  placeholder="0"
                  error={errors.exp?.message}
                  {...register('exp', {
                    valueAsNumber: true,
                    onChange: (e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        const safeExp = Math.max(0, val);
                        setValue('level', getLevelFromExp(safeExp), {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                    },
                  })}
                />
              </div>

              <div className="entity-form-drawer__field-group">
                <TextField
                  label="Điểm Point"
                  type="number"
                  placeholder="0"
                  error={errors.point?.message}
                  {...register('point', { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Rank info bar trực tiếp dưới form */}
            {(() => {
              const watchedLevel = Number(watch('level') || 1);
              const watchedExp = Number(watch('exp') || 0);
              const rank = getRankByLevel(watchedLevel);
              const expNeededForCurrent = getExpForLevel(watchedLevel);
              const expForNext = getExpForLevel(Math.min(MAX_LEVEL, watchedLevel + 1));

              return (
                <div className="user-list-page__rank-bar">
                  <div className="user-list-page__rank-bar-header">
                    <span className="user-list-page__rank-chip" style={{ borderColor: `${rank.color}60`, color: rank.color }}>
                      <RankIcon rankId={rank.id} size={16} />
                      {rank.name} (Lv.{rank.minLevel} - {rank.maxLevel})
                    </span>
                    <span className="user-list-page__rank-hint">
                      Tối thiểu: {expNeededForCurrent.toLocaleString()} EXP
                      {watchedLevel < MAX_LEVEL && ` • Lên cấp: ${expForNext.toLocaleString()} EXP`}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Mục 3: Tùy chọn nâng cao */}
            <div className="user-list-page__drawer-section-title">
              <Crown size={14} /> Đặc Quyền & Xác Minh
            </div>

            <div className="user-list-page__switch-row">
              <div className="user-list-page__switch-info">
                <span className="user-list-page__switch-title">Xác thực danh tính</span>
                <span className="user-list-page__switch-desc">
                  Hiển thị huy hiệu tích xanh xác thực cạnh tên người dùng
                </span>
              </div>
              <Switch
                checked={Boolean(watch('is_verified'))}
                onChange={(e, checked) => {
                  const v = typeof checked === 'boolean' ? checked : Boolean(e?.target?.checked);
                  setValue('is_verified', v, { shouldDirty: true, shouldValidate: true });
                }}
              />
            </div>

            <div className="user-list-page__switch-row">
              <div className="user-list-page__switch-info">
                <span className="user-list-page__switch-title">Tài khoản Premium</span>
                <span className="user-list-page__switch-desc">
                  Đánh dấu người dùng có quyền lợi tài khoản trả phí Premium
                </span>
              </div>
              <Switch
                checked={Boolean(watch('is_premium'))}
                onChange={(e, checked) => {
                  const v = typeof checked === 'boolean' ? checked : Boolean(e?.target?.checked);
                  setValue('is_premium', v, { shouldDirty: true, shouldValidate: true });
                  const currentTier = watch('membership_tier');
                  if (v && (!currentTier || currentTier === 'free')) {
                    setValue('membership_tier', 'plus', { shouldDirty: true, shouldValidate: true });
                  } else if (!v) {
                    setValue('membership_tier', 'free', { shouldDirty: true, shouldValidate: true });
                  }
                }}
              />
            </div>
          </>
        )}
      </EntityFormDrawer>

      {/* 5. Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        content={confirmModal.content}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
      />
    </div>
  );
};

export default memo(UserListPage);
