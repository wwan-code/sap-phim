/**
 * @file ActorListPage.jsx
 * @module Admin/Modules/Actors/Pages/ActorListPage
 * @description Quản lý hồ sơ diễn viên, đạo diễn, seiyuu (Actor) cấp Production chuẩn Material 3 Expressive, tích hợp DataGrid, Server-side Pagination/Search/Sort/Filter, Avatar Upload, Aliases Tagging, Metadata Builder, Drawer 640px Create/Update, Confirm Delete/Restore và TanStack Query.
 */

import React, { useState, useMemo, memo } from 'react';
import { Plus, Users2, Edit, Trash2, RotateCcw, CheckCircle2, XCircle, Star, User } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/admin/shared/components/layout/page-header/PageHeader';
import { AdminFilterToolbar } from '@/admin/shared/components/layout/filter-toolbar';
import { DataGrid, useDataGridQuery } from '@/admin/shared/components/data-display/data-grid';
import { EntityFormDrawer } from '@/admin/shared/components/forms/entity-form-drawer/EntityFormDrawer';
import { ImageUploadField } from '@/admin/shared/components/forms/image-upload-field/ImageUploadField';
import { TagInput } from '@/admin/shared/components/forms/tag-input/TagInput';
import { KeyValueBuilder } from '@/admin/shared/components/forms/key-value-builder/KeyValueBuilder';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';
import IconButton from '@/shared/components/ui/icon-button';
import Button from '@/shared/components/ui/button';
import TextField from '@/shared/components/ui/text-field';
import Select from '@/shared/components/ui/select';
import Switch from '@/shared/components/ui/switch';
import Badge from '@/shared/components/ui/badge';

import actorService from '@/shared/services/actor.service';
import { ACTOR_QUERY_KEYS } from '@/hooks/queries/use-actor.queries';
import {
  useAdminCreateActorMutation,
  useAdminUpdateActorMutation,
  useAdminDeleteActorMutation,
  useAdminRestoreActorMutation,
  useAdminBulkDeleteActorMutation,
  useAdminBulkRestoreActorMutation,
  useAdminForceDeleteActorMutation,
  useAdminBulkForceDeleteActorMutation,
  useAdminEmptyTrashActorMutation,
} from '@/hooks/mutations/use-actor.mutations';
import { actorSchema, actorDefaultValues } from '@/admin/schemas/actor.schema';

const STATUS_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Hoạt động' },
  { id: 'inactive', label: 'Vô hiệu hóa' },
  { id: 'deleted', label: 'Thùng rác' },
];

const GENDER_OPTIONS = [
  { value: 'unknown', label: 'Chưa xác định' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
];

export const ActorListPage = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: 'danger',
    title: '',
    content: '',
    confirmText: 'Xác nhận',
    onConfirm: () => { },
  });

  // Tham số lọc theo Status Tab
  const customParams = useMemo(() => {
    if (activeTab === 'active') return { is_active: true };
    if (activeTab === 'inactive') return { is_active: false };
    if (activeTab === 'deleted') return { only_deleted: true };
    return {};
  }, [activeTab]);

  // DataGrid Server-side Query Hook
  const { counts, gridProps, refetch } = useDataGridQuery({
    queryKey: ACTOR_QUERY_KEYS.adminList(customParams),
    queryFn: (params) => actorService.getAll(params),
    customParams,
    defaultSortModel: [{ field: 'popularity_score', sort: 'desc' }],
    defaultPageSize: 20,
    syncUrlParams: false,
  });

  // Mutations
  const createMutation = useAdminCreateActorMutation();
  const updateMutation = useAdminUpdateActorMutation();
  const deleteMutation = useAdminDeleteActorMutation();
  const restoreMutation = useAdminRestoreActorMutation();
  const bulkDeleteMutation = useAdminBulkDeleteActorMutation();
  const bulkRestoreMutation = useAdminBulkRestoreActorMutation();
  const forceDeleteMutation = useAdminForceDeleteActorMutation();
  const bulkForceDeleteMutation = useAdminBulkForceDeleteActorMutation();
  const emptyTrashMutation = useAdminEmptyTrashActorMutation();

  // Mở drawer tạo mới
  const handleOpenCreate = () => {
    setEditingItem(null);
    setDrawerOpen(true);
  };

  // Mở drawer chỉnh sửa
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setDrawerOpen(true);
  };

  // Xử lý submit form (Create / Update)
  const handleFormSubmit = async (formData) => {
    if (editingItem) {
      await updateMutation.mutateAsync({
        id: editingItem.id,
        ...formData,
      });
      toast.success('Cập nhật nghệ sĩ thành công!');
    } else {
      await createMutation.mutateAsync(formData);
      toast.success('Thêm nghệ sĩ thành công!');
    }
    setDrawerOpen(false);
    refetch();
  };

  // Xóa đơn lẻ
  const handleDeleteItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Xác nhận xóa nghệ sĩ',
      content: `Bạn có chắc chắn muốn xóa nghệ sĩ "${item.name}"? Dữ liệu sẽ được chuyển vào thùng rác.`,
      confirmText: 'Xóa nghệ sĩ',
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(item.id);
          toast.success('Đã chuyển nghệ sĩ vào thùng rác!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi xóa nghệ sĩ');
        }
      },
    });
  };

  // Khôi phục đơn lẻ
  const handleRestoreItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'primary',
      title: 'Khôi phục nghệ sĩ',
      content: `Bạn có muốn khôi phục hồ sơ nghệ sĩ "${item.name}" trở lại hoạt động?`,
      confirmText: 'Khôi phục',
      onConfirm: async () => {
        try {
          await restoreMutation.mutateAsync(item.id);
          toast.success('Khôi phục nghệ sĩ thành công!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi khôi phục nghệ sĩ');
        }
      },
    });
  };

  // Xóa vĩnh viễn đơn lẻ
  const handleForceDeleteItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Xóa vĩnh viễn nghệ sĩ',
      content: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN nghệ sĩ "${item.name}"? Toàn bộ hồ sơ và dữ liệu liên quan sẽ bị xóa sạch khỏi hệ thống, không thể khôi phục!`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await forceDeleteMutation.mutateAsync(item.id);
          toast.success('Đã xóa vĩnh viễn nghệ sĩ khỏi hệ thống!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi xóa vĩnh viễn nghệ sĩ');
        }
      },
    });
  };

  // Xóa hàng loạt
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Xác nhận xóa hàng loạt',
      content: `Bạn có chắc chắn muốn xóa ${selectedIds.length} nghệ sĩ đã chọn vào thùng rác?`,
      confirmText: 'Xóa tất cả',
      onConfirm: async () => {
        try {
          await bulkDeleteMutation.mutateAsync(selectedIds);
          toast.success(`Đã xóa ${selectedIds.length} nghệ sĩ!`);
          setSelectedIds([]);
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi xóa hàng loạt');
        }
      },
    });
  };

  // Khôi phục hàng loạt
  const handleBulkRestore = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      open: true,
      type: 'primary',
      title: 'Khôi phục hàng loạt',
      content: `Bạn có chắc chắn muốn khôi phục ${selectedIds.length} nghệ sĩ đã chọn?`,
      confirmText: 'Khôi phục tất cả',
      onConfirm: async () => {
        try {
          await bulkRestoreMutation.mutateAsync(selectedIds);
          toast.success(`Đã khôi phục ${selectedIds.length} nghệ sĩ!`);
          setSelectedIds([]);
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi khôi phục hàng loạt');
        }
      },
    });
  };

  // Xóa vĩnh viễn hàng loạt
  const handleBulkForceDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      open: true,
      type: 'danger',
      title: `Xóa vĩnh viễn ${selectedIds.length} nghệ sĩ`,
      content: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${selectedIds.length} nghệ sĩ đã chọn? Toàn bộ dữ liệu liên quan sẽ bị xóa sạch khỏi hệ thống, không thể khôi phục!`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await bulkForceDeleteMutation.mutateAsync(selectedIds);
          toast.success(`Đã xóa vĩnh viễn ${selectedIds.length} nghệ sĩ!`);
          setSelectedIds([]);
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi xóa vĩnh viễn hàng loạt');
        }
      },
    });
  };

  // Dọn sạch toàn bộ thùng rác
  const handleEmptyTrash = () => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Dọn sạch thùng rác',
      content: `Bạn có chắc chắn muốn dọn sạch toàn bộ thùng rác (${counts?.deleted || 0} nghệ sĩ)? Tất cả nghệ sĩ trong thùng rác sẽ bị xóa vĩnh viễn khỏi hệ thống!`,
      confirmText: 'Dọn sạch thùng rác',
      onConfirm: async () => {
        try {
          const res = await emptyTrashMutation.mutateAsync();
          toast.success(`Đã dọn sạch thùng rác (${res?.count || 0} nghệ sĩ đã xóa vĩnh viễn)!`);
          setSelectedIds([]);
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi dọn sạch thùng rác');
        }
      },
    });
  };

  // Cấu hình cột DataGrid
  const columns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Nghệ Sĩ / Diễn Viên',
        flex: 1.8,
        minWidth: 160,
        renderCell: ({ row }) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
            {row.image_url ? (
              <img
                src={row.image_url}
                alt={row.name}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--sp-radius-full, 9999px)',
                  objectFit: 'cover',
                  boxShadow: 'var(--sp-shadow-flat)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--sp-radius-full, 9999px)',
                  backgroundColor: 'rgba(124, 93, 250, 0.15)',
                  color: 'var(--sp-color-brand-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <User size={16} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
              <strong style={{ color: 'var(--sp-color-text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.name}
              </strong>
              {row.nationality && (
                <span style={{ fontSize: '0.75rem', color: 'var(--sp-color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.nationality}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        field: 'gender',
        headerName: 'Giới Tính',
        width: 110,
        minWidth: 80,
        renderCell: ({ value }) => {
          const map = {
            male: { text: 'Nam', variant: 'info' },
            female: { text: 'Nữ', variant: 'primary' },
            other: { text: 'Khác', variant: 'accent' },
            unknown: { text: 'Chưa rõ', variant: 'neutral' },
          };
          const item = map[value] || map.unknown;
          return <Badge variant={item.variant} size="small">{item.text}</Badge>;
        },
      },
      {
        field: 'popularity_score',
        headerName: 'Độ Nổi Tiếng',
        type: 'number',
        width: 145,
        minWidth: 95,
        renderCell: ({ value = 0 }) => (
          <Badge variant="warning" size="small" icon={<Star size={12} fill="currentColor" />}>
            {value}
          </Badge>
        ),
      },
      {
        field: 'movies_count',
        headerName: 'Số Phim',
        type: 'number',
        width: 110,
        minWidth: 90,
        renderCell: ({ value = 0 }) => (
          <Badge variant="accent" size="small">
            {value} phim
          </Badge>
        ),
      },
      {
        field: 'is_active',
        headerName: 'Trạng Thái',
        width: 125,
        minWidth: 110,
        renderCell: ({ row }) => {
          if (row.deleted_at) {
            return (
              <Badge variant="error" size="small" icon={<XCircle size={13} />}>
                Đã xóa
              </Badge>
            );
          }
          return row.is_active ? (
            <Badge variant="success" size="small" icon={<CheckCircle2 size={13} />}>
              Hoạt động
            </Badge>
          ) : (
            <Badge variant="muted" size="small" icon={<XCircle size={13} />}>
              Đã ẩn
            </Badge>
          );
        },
      },
      {
        field: '__actions__',
        headerName: 'Thao Tác',
        width: 110,
        minWidth: 100,
        sortable: false,
        filterable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            {row.deleted_at ? (
              <>
                <IconButton
                  size="small"
                  variant="standard"
                  color="primary"
                  title="Khôi phục nghệ sĩ"
                  onClick={() => handleRestoreItem(row)}
                >
                  <RotateCcw size={16} />
                </IconButton>
                <IconButton
                  size="small"
                  variant="standard"
                  color="danger"
                  title="Xóa vĩnh viễn"
                  onClick={() => handleForceDeleteItem(row)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </>
            ) : (
              <>
                <IconButton
                  size="small"
                  variant="standard"
                  color="default"
                  title="Chỉnh sửa"
                  onClick={() => handleOpenEdit(row)}
                >
                  <Edit size={16} />
                </IconButton>
                <IconButton
                  size="small"
                  variant="standard"
                  color="danger"
                  title="Xóa vào thùng rác"
                  onClick={() => handleDeleteItem(row)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </>
            )}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="admin-page-container">
      {/* 1. Header */}
      <PageHeader
        title="Quản Lý Diễn Viên"
        subtitle="Hồ sơ nghệ sĩ, seiyuu lồng tiếng anime."
        badge={
          activeTab === 'deleted'
            ? (counts?.deleted !== undefined ? `${counts.deleted} trong thùng rác` : undefined)
            : (counts?.all !== undefined ? `${counts.all} diễn viên` : undefined)
        }
        badgeVariant={activeTab === 'deleted' && (counts?.deleted || 0) > 0 ? 'error' : 'primary'}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTab === 'deleted' && Number(counts?.deleted ?? gridProps.rowCount ?? 0) > 0 && (
              <Button
                variant="outlined"
                color="danger"
                startIcon={<Trash2 size={16} />}
                onClick={handleEmptyTrash}
              >
                Dọn Sạch Thùng Rác
              </Button>
            )}
            <Button
              variant="filled"
              color="primary"
              startIcon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              Thêm nghệ sĩ
            </Button>
          </div>
        }
      />

      {/* 2. Status Filter Tabs */}
      <AdminFilterToolbar
        tabs={STATUS_TABS}
        activeTab={activeTab}
        counts={counts || {}}
        onTabChange={(tabId) => {
          setActiveTab(tabId);
          setSelectedIds([]);
        }}
      />

      {/* 3. Central DataGrid */}
      <DataGrid
        title="Danh Sách Nghệ Sĩ & Diễn Viên"
        columns={columns}
        getRowId={(row) => row.id}
        checkboxSelection
        rowSelectionModel={selectedIds}
        onRowSelectionModelChange={setSelectedIds}
        onBulkDelete={activeTab === 'deleted' ? undefined : handleBulkDelete}
        customBulkActions={
          activeTab === 'deleted' ? (
            <>
              <Button
                size="small"
                variant="tonal"
                startIcon={<RotateCcw size={14} />}
                onClick={handleBulkRestore}
              >
                Khôi phục ({selectedIds.length})
              </Button>
              <Button
                size="small"
                variant="filled"
                color="error"
                startIcon={<Trash2 size={14} />}
                onClick={handleBulkForceDelete}
              >
                Xóa vĩnh viễn ({selectedIds.length})
              </Button>
            </>
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

      {/* 4. Slide-over Form Drawer (Size Large: 640px) */}
      <EntityFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
        title={editingItem ? 'Chỉnh Sửa Hồ Sơ Nghệ Sĩ' : 'Thêm Hồ Sơ Nghệ Sĩ Mới'}
        subtitle={editingItem ? `Cập nhật thông tin: ${editingItem.name}` : 'Nhập thông tin tiểu sử, ảnh đại diện và vai trò nghệ sĩ.'}
        schema={actorSchema}
        defaultValues={actorDefaultValues}
        initialData={editingItem}
        isEdit={Boolean(editingItem)}
        onSubmit={handleFormSubmit}
      >
        {({ register, formState: { errors }, setValue, watch }) => (
          <>
            {/* Ảnh đại diện */}
            <div className="entity-form-drawer__field-group">
              <ImageUploadField
                label="Ảnh đại diện (Avatar)"
                aspectRatio="square"
                value={watch('image_url')}
                onChange={(url) => setValue('image_url', url, { shouldDirty: true })}
                error={errors.image_url?.message}
              />
            </div>

            {/* Tên & Quốc tịch */}
            <div className="entity-form-drawer__row-2">
              <div className="entity-form-drawer__field-group">
                <TextField
                  label="Họ và tên nghệ sĩ"
                  placeholder="Ví dụ: Taito Ban, Makoto Shinkai..."
                  required
                  error={errors.name?.message}
                  {...register('name')}
                />
              </div>

              <div className="entity-form-drawer__field-group">
                <TextField
                  label="Quốc tịch"
                  placeholder="Ví dụ: Nhật Bản, Hàn Quốc, Mỹ..."
                  error={errors.nationality?.message}
                  {...register('nationality')}
                />
              </div>
            </div>

            {/* Giới tính & Ngày sinh */}
            <div className="entity-form-drawer__row-2">
              <div className="entity-form-drawer__field-group">
                <Select
                  label="Giới tính"
                  options={GENDER_OPTIONS}
                  value={watch('gender')}
                  onChange={(_event, val) => setValue('gender', val, { shouldDirty: true })}
                  error={errors.gender?.message}
                />
              </div>

              <div className="entity-form-drawer__field-group">
                <TextField
                  label="Ngày sinh"
                  type="date"
                  error={errors.birth_date?.message}
                  {...register('birth_date')}
                />
              </div>
            </div>

            {/* Điểm nổi tiếng */}
            <div className="entity-form-drawer__field-group">
              <TextField
                label="Điểm độ nổi tiếng (Popularity Score)"
                type="number"
                placeholder="0"
                error={errors.popularity_score?.message}
                {...register('popularity_score')}
              />
            </div>

            {/* Bí danh / Tên gọi khác (Aliases) */}
            <div className="entity-form-drawer__field-group">
              <TagInput
                label="Tên gọi khác / Bí danh (Aliases)"
                placeholder="Nhập tên gọi khác và nhấn Enter..."
                value={watch('aliases')}
                onChange={(tags) => setValue('aliases', tags, { shouldDirty: true })}
                helperText="Hỗ trợ tìm kiếm theo nhiều tên tiếng Nhật / Romaji / Hán Tự"
                error={errors.aliases?.message}
              />
            </div>

            {/* Tiểu sử */}
            <div className="entity-form-drawer__field-group">
              <TextField
                label="Tiểu sử / Giới thiệu chi tiết"
                placeholder="Thông tin sự nghiệp, giải thưởng, quá trình hoạt động nghệ thuật..."
                multiline
                rows={4}
                error={errors.biography?.message}
                {...register('biography')}
              />
            </div>

            {/* Metadata Builder */}
            <div className="entity-form-drawer__field-group">
              <KeyValueBuilder
                label="Thuộc tính bổ sung (Metadata JSONB)"
                value={watch('metadata')}
                onChange={(metaObj) => setValue('metadata', metaObj, { shouldDirty: true })}
                helperText="Các thông tin mạng xã hội, công ty quản lý, đại diện (Twitter, Instagram, Agency)..."
              />
            </div>

            {/* Switch Hoạt động */}
            <div className="entity-form-drawer__switch-row">
              <div className="entity-form-drawer__switch-info">
                <span className="entity-form-drawer__switch-title">Trạng thái hoạt động</span>
                <span className="entity-form-drawer__switch-desc">Hiển thị nghệ sĩ trong danh sách diễn viên và trang chi tiết phim</span>
              </div>
              <Switch
                checked={Boolean(watch('is_active'))}
                onChange={(e, checked) => setValue('is_active', typeof checked === 'boolean' ? checked : Boolean(e?.target?.checked), { shouldDirty: true })}
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

export default memo(ActorListPage);
