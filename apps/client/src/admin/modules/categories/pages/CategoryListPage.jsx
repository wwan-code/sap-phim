/**
 * @file CategoryListPage.jsx
 * @module Admin/Modules/Categories/Pages/CategoryListPage
 * @description Quản lý danh mục phim (Category) cấp Production chuẩn Material 3 Expressive, tích hợp DataGrid, Server-side Pagination/Search/Sort/Filter, Drawer Create/Update, Confirm Delete/Restore và TanStack Query.
 */

import React, { useState, useMemo, memo } from 'react';
import { Plus, FolderKanban, Edit, Trash2, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { PageHeader } from '@/admin/shared/components/layout/page-header/PageHeader';
import { AdminFilterToolbar } from '@/admin/shared/components/layout/filter-toolbar';
import { DataGrid, useDataGridQuery } from '@/admin/shared/components/data-display/data-grid';
import { EntityFormDrawer } from '@/admin/shared/components/forms/entity-form-drawer/EntityFormDrawer';
import ConfirmModal from '@/shared/components/ui/modal/ConfirmModal';
import IconButton from '@/shared/components/ui/icon-button';
import Button from '@/shared/components/ui/button';
import TextField from '@/shared/components/ui/text-field';
import Switch from '@/shared/components/ui/switch';
import Badge from '@/shared/components/ui/badge';

import categoryService from '@/shared/services/category.service';
import { CATEGORY_QUERY_KEYS } from '@/hooks/queries/use-category.queries';
import {
  useAdminCreateCategoryMutation,
  useAdminUpdateCategoryMutation,
  useAdminDeleteCategoryMutation,
  useAdminRestoreCategoryMutation,
  useAdminBulkDeleteCategoryMutation,
  useAdminBulkRestoreCategoryMutation,
  useAdminForceDeleteCategoryMutation,
  useAdminBulkForceDeleteCategoryMutation,
  useAdminEmptyTrashCategoryMutation,
} from '@/hooks/mutations/use-category.mutations';
import { categorySchema, categoryDefaultValues } from '@/admin/schemas/category.schema';

const STATUS_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Hoạt động' },
  { id: 'inactive', label: 'Vô hiệu hóa' },
  { id: 'deleted', label: 'Thùng rác' },
];

export const CategoryListPage = () => {
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
    queryKey: CATEGORY_QUERY_KEYS.adminList(customParams),
    queryFn: (params) => categoryService.getAll(params),
    customParams,
    defaultSortModel: [{ field: 'order_num', sort: 'asc' }],
    defaultPageSize: 20,
    syncUrlParams: false,
  });

  // Mutations
  const createMutation = useAdminCreateCategoryMutation();
  const updateMutation = useAdminUpdateCategoryMutation();
  const deleteMutation = useAdminDeleteCategoryMutation();
  const restoreMutation = useAdminRestoreCategoryMutation();
  const bulkDeleteMutation = useAdminBulkDeleteCategoryMutation();
  const bulkRestoreMutation = useAdminBulkRestoreCategoryMutation();
  const forceDeleteMutation = useAdminForceDeleteCategoryMutation();
  const bulkForceDeleteMutation = useAdminBulkForceDeleteCategoryMutation();
  const emptyTrashMutation = useAdminEmptyTrashCategoryMutation();

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
      toast.success('Cập nhật danh mục thành công!');
    } else {
      await createMutation.mutateAsync(formData);
      toast.success('Tạo mới danh mục thành công!');
    }
    setDrawerOpen(false);
    refetch();
  };

  // Xóa đơn lẻ
  const handleDeleteItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Xác nhận xóa danh mục',
      content: `Bạn có chắc chắn muốn xóa danh mục "${item.name}"? Dữ liệu sẽ được chuyển vào thùng rác.`,
      confirmText: 'Xóa danh mục',
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(item.id);
          toast.success('Đã chuyển danh mục vào thùng rác!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi xóa danh mục');
        }
      },
    });
  };

  // Khôi phục đơn lẻ
  const handleRestoreItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'primary',
      title: 'Khôi phục danh mục',
      content: `Bạn có muốn khôi phục danh mục "${item.name}" trở lại hoạt động?`,
      confirmText: 'Khôi phục',
      onConfirm: async () => {
        try {
          await restoreMutation.mutateAsync(item.id);
          toast.success('Khôi phục danh mục thành công!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi khôi phục danh mục');
        }
      },
    });
  };

  // Xóa vĩnh viễn đơn lẻ
  const handleForceDeleteItem = (item) => {
    setConfirmModal({
      open: true,
      type: 'danger',
      title: 'Xóa vĩnh viễn danh mục',
      content: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN danh mục "${item.name}"? Các phim liên kết sẽ được tự động gỡ phân loại và danh mục bị xóa hoàn toàn khỏi hệ thống!`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await forceDeleteMutation.mutateAsync(item.id);
          toast.success('Đã xóa vĩnh viễn danh mục khỏi hệ thống!');
          setConfirmModal((prev) => ({ ...prev, open: false }));
          refetch();
        } catch (err) {
          toast.error(err?.message || 'Lỗi khi xóa vĩnh viễn danh mục');
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
      content: `Bạn có chắc chắn muốn xóa ${selectedIds.length} danh mục đã chọn vào thùng rác?`,
      confirmText: 'Xóa tất cả',
      onConfirm: async () => {
        try {
          await bulkDeleteMutation.mutateAsync(selectedIds);
          toast.success(`Đã xóa ${selectedIds.length} danh mục!`);
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
      content: `Bạn có chắc chắn muốn khôi phục ${selectedIds.length} danh mục đã chọn?`,
      confirmText: 'Khôi phục tất cả',
      onConfirm: async () => {
        try {
          await bulkRestoreMutation.mutateAsync(selectedIds);
          toast.success(`Đã khôi phục ${selectedIds.length} danh mục!`);
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
      title: `Xóa vĩnh viễn ${selectedIds.length} danh mục`,
      content: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${selectedIds.length} danh mục đã chọn? Phim liên kết sẽ được tự động gỡ phân loại và danh mục bị xóa hoàn toàn khỏi hệ thống!`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await bulkForceDeleteMutation.mutateAsync(selectedIds);
          toast.success(`Đã xóa vĩnh viễn ${selectedIds.length} danh mục!`);
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
      content: `Bạn có chắc chắn muốn dọn sạch toàn bộ thùng rác (${counts?.deleted || 0} danh mục)? Toàn bộ danh mục trong thùng rác sẽ bị xóa vĩnh viễn không thể khôi phục!`,
      confirmText: 'Dọn sạch thùng rác',
      onConfirm: async () => {
        try {
          const res = await emptyTrashMutation.mutateAsync();
          toast.success(`Đã dọn sạch thùng rác (${res?.count || 0} danh mục đã xóa vĩnh viễn)!`);
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
        field: 'order_num',
        headerName: 'Thứ Tự',
        width: 100,
        minWidth: 70,
        type: 'number',
        renderCell: ({ value = 0 }) => (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--sp-radius-xs, 4px)',
              backgroundColor: 'var(--sp-color-surface-container-high)',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: 'var(--sp-color-text-secondary)',
            }}
          >
            #{value}
          </span>
        ),
      },
      {
        field: 'name',
        headerName: 'Tên Danh Mục',
        flex: 1.5,
        minWidth: 160,
        renderCell: ({ row }) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--sp-radius-sm, 6px)',
                backgroundColor: 'rgba(124, 93, 250, 0.15)',
                color: 'var(--sp-color-brand-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FolderKanban size={15} />
            </div>
            <strong style={{ color: 'var(--sp-color-text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.name}
            </strong>
          </div>
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
        field: 'description',
        headerName: 'Mô Tả',
        flex: 1.8,
        minWidth: 140,
        renderCell: ({ value }) => (
          <span style={{ color: 'var(--sp-color-text-secondary)', fontSize: '0.875rem' }}>
            {value || '—'}
          </span>
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
                  title="Khôi phục danh mục"
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
        title="Quản Lý Danh Mục"
        subtitle="Cấu hình các phân mục điều hướng chính và luồng nội dung trên nền tảng Sạp Phim."
        badge={
          activeTab === 'deleted'
            ? (counts?.deleted !== undefined ? `${counts.deleted} trong thùng rác` : undefined)
            : (counts?.all !== undefined ? `${counts.all} danh mục` : undefined)
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
              Thêm danh mục
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
        title="Danh Sách Danh Mục"
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
        title={editingItem ? 'Chỉnh Sửa Danh Mục' : 'Tạo Danh Mục Mới'}
        subtitle={editingItem ? `Cập nhật thông tin cho danh mục: ${editingItem.name}` : 'Nhập thông tin phân mục điều hướng mới.'}
        schema={categorySchema}
        defaultValues={categoryDefaultValues}
        initialData={editingItem}
        isEdit={Boolean(editingItem)}
        onSubmit={handleFormSubmit}
      >
        {({ register, formState: { errors }, setValue, watch }) => (
          <>
            <div className="entity-form-drawer__field-group">
              <TextField
                label="Tên danh mục"
                placeholder="Ví dụ: Anime Mùa, Phim Chiếu Rạp, Phim Bộ..."
                required
                error={errors.name?.message}
                {...register('name')}
              />
            </div>

            <div className="entity-form-drawer__field-group">
              <TextField
                label="Thứ tự hiển thị"
                type="number"
                placeholder="0"
                error={errors.order_num?.message}
                {...register('order_num')}
              />
            </div>

            <div className="entity-form-drawer__field-group">
              <TextField
                label="Mô tả danh mục"
                placeholder="Mô tả ngắn gọn về danh mục này..."
                multiline
                rows={3}
                error={errors.description?.message}
                {...register('description')}
              />
            </div>

            <div className="entity-form-drawer__switch-row">
              <div className="entity-form-drawer__switch-info">
                <span className="entity-form-drawer__switch-title">Trạng thái hoạt động</span>
                <span className="entity-form-drawer__switch-desc">Hiển thị danh mục trên thanh điều hướng người dùng</span>
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

export default memo(CategoryListPage);
