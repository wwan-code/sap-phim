/**
 * @file CountryListPage.jsx
 * @module Admin/Modules/Countries/Pages/CountryListPage
 * @description Quản lý quốc gia sản xuất (Country) cấp Production chuẩn Material 3 Expressive, tích hợp DataGrid, Server-side Pagination/Search/Sort/Filter, Flag Upload/Preview, Drawer Create/Update, Confirm Delete/Restore và TanStack Query.
 */

import React, { useState, useMemo, memo } from 'react';
import { Plus, Globe, Edit, Trash2, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/admin/shared/components/layout/page-header/PageHeader';
import { AdminFilterToolbar } from '@/admin/shared/components/layout/filter-toolbar';
import { DataGrid, useDataGridQuery } from '@/admin/shared/components/data-display/data-grid';
import { EntityFormDrawer } from '@/admin/shared/components/forms/entity-form-drawer/EntityFormDrawer';
import { ImageUploadField } from '@/admin/shared/components/forms/image-upload-field/ImageUploadField';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';
import IconButton from '@/shared/components/ui/icon-button';
import Button from '@/shared/components/ui/button';
import TextField from '@/shared/components/ui/text-field';
import Switch from '@/shared/components/ui/switch';
import Badge from '@/shared/components/ui/badge';

import countryService from '@/shared/services/country.service';
import { COUNTRY_QUERY_KEYS } from '@/hooks/queries/use-country.queries';
import {
  useAdminCreateCountryMutation,
  useAdminUpdateCountryMutation,
  useAdminDeleteCountryMutation,
  useAdminRestoreCountryMutation,
  useAdminBulkDeleteCountryMutation,
  useAdminBulkRestoreCountryMutation,
  useAdminForceDeleteCountryMutation,
  useAdminBulkForceDeleteCountryMutation,
  useAdminEmptyTrashCountryMutation,
} from '@/hooks/mutations/use-country.mutations';
import { countrySchema, countryDefaultValues } from '@/admin/schemas/country.schema';

const STATUS_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Hoạt động' },
  { id: 'inactive', label: 'Vô hiệu hóa' },
  { id: 'deleted', label: 'Thùng rác' },
];

export const CountryListPage = () => {
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
    queryKey: COUNTRY_QUERY_KEYS.adminList(customParams),
    queryFn: (params) => countryService.getAll(params),
    customParams,
    defaultSortModel: [{ field: 'name', sort: 'asc' }],
    defaultPageSize: 20,
    syncUrlParams: false,
  });

  // Mutations
  const createMutation = useAdminCreateCountryMutation();
  const updateMutation = useAdminUpdateCountryMutation();
  const deleteMutation = useAdminDeleteCountryMutation();
  const restoreMutation = useAdminRestoreCountryMutation();
  const bulkDeleteMutation = useAdminBulkDeleteCountryMutation();
  const bulkRestoreMutation = useAdminBulkRestoreCountryMutation();
  const forceDeleteMutation = useAdminForceDeleteCountryMutation();
  const bulkForceDeleteMutation = useAdminBulkForceDeleteCountryMutation();
  const emptyTrashMutation = useAdminEmptyTrashCountryMutation();

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
      toast.success('Cập nhật quốc gia thành công!');
    } else {
      await createMutation.mutateAsync(formData);
      toast.success('Thêm quốc gia thành công!');
    }
    setDrawerOpen(false);
    refetch();
  };

  // Xóa đơn lẻ
  const handleDeleteItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Xác nhận xóa quốc gia',
      content: `Bạn có chắc chắn muốn xóa quốc gia "${item.name}"? Dữ liệu sẽ được chuyển vào thùng rác.`,
      confirmText: 'Xóa quốc gia',
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(item.id);
          toast.success('Đã chuyển quốc gia vào thùng rác!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi xóa quốc gia');
        }
      },
    });
  };

  // Khôi phục đơn lẻ
  const handleRestoreItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'primary',
      title: 'Khôi phục quốc gia',
      content: `Bạn có muốn khôi phục quốc gia "${item.name}" trở lại hoạt động?`,
      confirmText: 'Khôi phục',
      onConfirm: async () => {
        try {
          await restoreMutation.mutateAsync(item.id);
          toast.success('Khôi phục quốc gia thành công!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi khôi phục quốc gia');
        }
      },
    });
  };

  // Xóa vĩnh viễn đơn lẻ
  const handleForceDeleteItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Xóa vĩnh viễn quốc gia',
      content: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN quốc gia "${item.name}"? Toàn bộ các phim liên kết sẽ tự động gỡ quốc gia này và dữ liệu bị xóa hoàn toàn khỏi hệ thống!`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await forceDeleteMutation.mutateAsync(item.id);
          toast.success('Đã xóa vĩnh viễn quốc gia khỏi hệ thống!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi xóa vĩnh viễn quốc gia');
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
      content: `Bạn có chắc chắn muốn xóa ${selectedIds.length} quốc gia đã chọn vào thùng rác?`,
      confirmText: 'Xóa tất cả',
      onConfirm: async () => {
        try {
          await bulkDeleteMutation.mutateAsync(selectedIds);
          toast.success(`Đã xóa ${selectedIds.length} quốc gia!`);
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
      content: `Bạn có chắc chắn muốn khôi phục ${selectedIds.length} quốc gia đã chọn?`,
      confirmText: 'Khôi phục tất cả',
      onConfirm: async () => {
        try {
          await bulkRestoreMutation.mutateAsync(selectedIds);
          toast.success(`Đã khôi phục ${selectedIds.length} quốc gia!`);
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
      title: `Xóa vĩnh viễn ${selectedIds.length} quốc gia`,
      content: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${selectedIds.length} quốc gia đã chọn? Phim liên kết sẽ được tự động gỡ quốc gia và dữ liệu bị xóa hoàn toàn khỏi hệ thống!`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await bulkForceDeleteMutation.mutateAsync(selectedIds);
          toast.success(`Đã xóa vĩnh viễn ${selectedIds.length} quốc gia!`);
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
      content: `Bạn có chắc chắn muốn dọn sạch toàn bộ thùng rác (${counts?.deleted || 0} quốc gia)? Toàn bộ quốc gia trong thùng rác sẽ bị xóa vĩnh viễn khỏi hệ thống!`,
      confirmText: 'Dọn sạch thùng rác',
      onConfirm: async () => {
        try {
          const res = await emptyTrashMutation.mutateAsync();
          toast.success(`Đã dọn sạch thùng rác (${res?.count || 0} quốc gia đã xóa vĩnh viễn)!`);
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
        headerName: 'Tên Quốc Gia',
        flex: 1.5,
        minWidth: 160,
        renderCell: ({ row }) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
            {row.flag_url ? (
              <img
                src={row.flag_url}
                alt={row.name}
                style={{
                  width: 24,
                  height: 16,
                  borderRadius: 'var(--sp-radius-xs, 4px)',
                  objectFit: 'cover',
                  boxShadow: 'var(--sp-shadow-flat)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 24,
                  height: 16,
                  borderRadius: 'var(--sp-radius-xs, 4px)',
                  backgroundColor: 'rgba(124, 93, 250, 0.15)',
                  color: 'var(--sp-color-brand-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Globe size={12} />
              </div>
            )}
            <strong style={{ color: 'var(--sp-color-text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.name}
            </strong>
          </div>
        ),
      },
      {
        field: 'code',
        headerName: 'Mã ISO',
        width: 100,
        minWidth: 80,
        renderCell: ({ value }) => (
          <Badge variant="neutral" size="small">
            {value || '—'}
          </Badge>
        ),
      },
      {
        field: 'slug',
        headerName: 'Slug URL',
        flex: 1,
        minWidth: 110,
        renderCell: ({ value }) => (
          <code
            style={{
              padding: '2px 6px',
              backgroundColor: 'var(--sp-color-surface-container-high)',
              borderRadius: 'var(--sp-radius-xs, 4px)',
              fontSize: '0.75rem',
              color: 'var(--sp-color-brand-accent)',
            }}
          >
            /{value}
          </code>
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
                  title="Khôi phục quốc gia"
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
        title="Quản Lý Quốc Gia"
        subtitle="Cấu hình danh mục các quốc gia và khu vực sản xuất anime, phim ảnh."
        badge={
          activeTab === 'deleted'
            ? (counts?.deleted !== undefined ? `${counts.deleted} trong thùng rác` : undefined)
            : (counts?.all !== undefined ? `${counts.all} quốc gia` : undefined)
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
              Thêm quốc gia
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
        title="Danh Sách Quốc Gia"
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

      {/* 4. Slide-over Form Drawer */}
      <EntityFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingItem ? 'Chỉnh Sửa Quốc Gia' : 'Thêm Quốc Gia Mới'}
        subtitle={editingItem ? `Cập nhật thông tin: ${editingItem.name}` : 'Nhập thông tin quốc gia sản xuất mới.'}
        schema={countrySchema}
        defaultValues={countryDefaultValues}
        initialData={editingItem}
        isEdit={Boolean(editingItem)}
        onSubmit={handleFormSubmit}
      >
        {({ register, formState: { errors }, setValue, watch }) => (
          <>
            <div className="entity-form-drawer__field-group">
              <TextField
                label="Tên quốc gia"
                placeholder="Ví dụ: Nhật Bản, Hàn Quốc, Việt Nam, Âu Mỹ..."
                required
                error={errors.name?.message}
                {...register('name')}
              />
            </div>

            <div className="entity-form-drawer__field-group">
              <TextField
                label="Mã quốc gia ISO (2 ký tự)"
                placeholder="Ví dụ: JP, KR, VN, US, CN..."
                required
                error={errors.code?.message}
                {...register('code')}
              />
            </div>

            <div className="entity-form-drawer__field-group">
              <ImageUploadField
                label="Cờ quốc gia / Biểu trưng"
                aspectRatio="landscape"
                value={watch('flag_url')}
                onChange={(url) => setValue('flag_url', url, { shouldDirty: true })}
                error={errors.flag_url?.message}
              />
            </div>

            <div className="entity-form-drawer__switch-row">
              <div className="entity-form-drawer__switch-info">
                <span className="entity-form-drawer__switch-title">Trạng thái hoạt động</span>
                <span className="entity-form-drawer__switch-desc">Hiển thị trong bộ lọc tìm kiếm theo quốc gia</span>
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

export default memo(CountryListPage);
