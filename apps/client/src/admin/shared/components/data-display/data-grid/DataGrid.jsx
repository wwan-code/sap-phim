/**
 * @file DataGrid.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid
 * @description Component DataGrid trung tâm cấp Production cho Sạp Phim (The Aesthetic OS).
 * Kiến trúc Thẻ Đơn Khối Liền Mạch (Unified Surface Card), hỗ trợ Inline Row Editing (Input Pills),
 * Dải Icon Strip công cụ & Nút Add Record đồng thời, Hybrid Virtualization và Phân trang không viền.
 */

import React, { useState, useMemo, forwardRef, useImperativeHandle, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { useDeviceType } from '@/hooks/ui/use-device-type';
import { useDataGrid } from './hooks/use-data-grid';
import DataGridToolbar from './components/DataGridToolbar';
import DataGridHeader from './components/DataGridHeader';
import DataGridBody from './components/DataGridBody';
import DataGridPagination from './components/DataGridPagination';
import DataGridSelectionBar from './components/DataGridSelectionBar';
import DataGridMobileCard from './components/DataGridMobileCard';
import './data-grid.scss';

export const DataGrid = forwardRef((props, ref) => {
    const {
        rows = [],
        getRowId = (row) => row?.id ?? row?._id,
        loading = false,
        error = null,
        onRetry,
        isRefreshing = false,

        // Height & layout
        height,
        autoHeight = false,
        className = '',
        style,

        // Toolbar config
        toolbar = true,
        showQuickFilter = true,
        showColumnSelector = true,
        showFilterButton = true,
        showDensitySelector = false,
        showExportButton = true,
        showRefreshButton = false,
        onRefresh,
        quickFilterPlaceholder = 'Tìm kiếm nhanh...',
        title,
        actions,
        onAddRecord,
        addRecordLabel = 'Add Record',

        // Inline Editing handlers
        onRowEditSave,
        onRowEditCancel,
        onRowEditStart,
        onRowDelete,

        // Selection
        checkboxSelection = false,
        onBulkDelete,
        onBulkExport,
        customBulkActions,

        // Slots & SlotProps
        slots = {},
        slotProps = {},

        // Row events
        onRowClick,
        onRowDoubleClick,
        getRowClassName,

        // Mobile view override
        mobileMode = 'card', // 'card' | 'table' | 'auto'
    } = props;

    // 1. Nhận diện thiết bị thông minh theo 4 tầng
    const deviceInfo = useDeviceType();
    const isMobile = deviceInfo.isMobile;
    const isCardView = mobileMode === 'card' ? isMobile : mobileMode === 'auto' ? isMobile : false;

    // 2. Headless State Engine
    const gridState = useDataGrid(props);
    const {
        currentPageRows,
        getRowValue,
        columnsState,
        sortState,
        filterState,
        paginationState,
        selectionState,
        virtualizerState,
        keyboardState,
        density: activeDensity,
        setDensity: setActiveDensity,
        bodyScrollRef,
    } = gridState;

    // 3. Inline Row Editing State
    const [editRowId, setEditRowId] = useState(null);
    const [editRowData, setEditRowData] = useState({});

    const handleStartRowEdit = useCallback(
        (rowId, row) => {
            setEditRowId(rowId);
            setEditRowData({ ...row });
            onRowEditStart?.(rowId, row);
        },
        [onRowEditStart]
    );

    const handleEditChange = useCallback((field, value) => {
        setEditRowData((prev) => ({
            ...prev,
            [field]: value,
        }));
    }, []);

    const handleSaveRowEdit = useCallback(() => {
        if (editRowId !== null) {
            const originalRow = rows.find((r) => (getRowId ? getRowId(r) : r.id) === editRowId) || {};
            onRowEditSave?.(editRowData, originalRow);
            setEditRowId(null);
            setEditRowData({});
        }
    }, [editRowId, editRowData, rows, getRowId, onRowEditSave]);

    const handleCancelRowEdit = useCallback(() => {
        if (editRowId !== null) {
            onRowEditCancel?.(editRowId);
            setEditRowId(null);
            setEditRowData({});
        }
    }, [editRowId, onRowEditCancel]);

    const handleDeleteRow = useCallback(
        (rowId, row) => {
            onRowDelete?.(rowId, row);
        },
        [onRowDelete]
    );

    // 4. DataGrid Public API instance (cho useImperativeHandle / cell renderers)
    const api = useMemo(
        () => ({
            state: gridState,
            getSelectedRowIds: () => selectionState.rowSelectionModel,
            getSelectedRows: () => {
                const idSet = new Set(selectionState.rowSelectionModel);
                return rows.filter((r) => idSet.has(getRowId(r)));
            },
            clearSelection: selectionState.clearSelection,
            setSelection: selectionState.setRowSelectionModel,
            setPage: paginationState.handlePageChange,
            setPageSize: paginationState.handlePageSizeChange,
            setSortModel: sortState.setSortModel,
            setFilterModel: filterState.setFilterModel,
            setDensity: setActiveDensity,
            resetPreferences: gridState.resetPreferences,
            refresh: onRefresh,
            startRowEdit: handleStartRowEdit,
            saveRowEdit: handleSaveRowEdit,
            cancelRowEdit: handleCancelRowEdit,
        }),
        [
            gridState,
            selectionState,
            paginationState,
            sortState,
            filterState,
            setActiveDensity,
            rows,
            getRowId,
            onRefresh,
            handleStartRowEdit,
            handleSaveRowEdit,
            handleCancelRowEdit,
        ]
    );

    useImperativeHandle(ref, () => api, [api]);

    // 5. Scroll State Tracking (cho hiệu ứng Pinned Column Shadow chuẩn MUI X)
    const [scrolledLeft, setScrolledLeft] = useState(false);
    const [scrolledRight, setScrolledRight] = useState(false);

    const handleScroll = useCallback((e) => {
        const { scrollLeft, scrollWidth, clientWidth } = e.currentTarget;
        const isLeft = scrollLeft > 2;
        const isRight = scrollLeft + clientWidth < scrollWidth - 2;
        setScrolledLeft((prev) => (prev !== isLeft ? isLeft : prev));
        setScrolledRight((prev) => (prev !== isRight ? isRight : prev));
    }, []);

    // 6. BEM Root Modifiers
    const rootClasses = [
        'data-grid',
        `data-grid--density-${activeDensity || 'standard'}`,
        scrolledLeft ? 'data-grid--scrolled-left' : '',
        scrolledRight ? 'data-grid--scrolled-right' : '',
        isMobile ? 'data-grid--mobile' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const containerStyle = {
        ...style,
        ...(height && !autoHeight ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    };

    const ToolbarComponent = slots.toolbar || DataGridToolbar;
    const PaginationComponent = slots.pagination || DataGridPagination;

    const editingState = useMemo(
        () => ({
            editRowId,
            editRowData,
            onEditChange: handleEditChange,
            onSaveEdit: handleSaveRowEdit,
            onCancelEdit: handleCancelRowEdit,
            onStartEdit: handleStartRowEdit,
            onDeleteRow: handleDeleteRow,
        }),
        [
            editRowId,
            editRowData,
            handleEditChange,
            handleSaveRowEdit,
            handleCancelRowEdit,
            handleStartRowEdit,
            handleDeleteRow,
        ]
    );

    return (
        <div
            ref={keyboardState.gridContainerRef}
            className={rootClasses}
            style={containerStyle}
            role="grid"
            aria-label={title || 'Bảng dữ liệu'}
            aria-rowcount={paginationState.rowCount}
            aria-colcount={columnsState.visibleColumns.length}
            onKeyDown={keyboardState.handleKeyDown}
            tabIndex={0}
        >
            {/* 1. Toolbar: Title on left, Actions & Icon Strip on right */}
            {toolbar && (
                <ToolbarComponent
                    columnsState={columnsState}
                    filterState={filterState}
                    density={activeDensity}
                    setDensity={setActiveDensity}
                    rows={rows}
                    getRowValue={getRowValue}
                    showQuickFilter={showQuickFilter}
                    showColumnSelector={showColumnSelector}
                    showFilterButton={showFilterButton}
                    showDensitySelector={showDensitySelector}
                    showExportButton={showExportButton}
                    showRefreshButton={showRefreshButton}
                    onRefresh={onRefresh}
                    isRefreshing={isRefreshing}
                    quickFilterPlaceholder={quickFilterPlaceholder}
                    title={title}
                    actions={actions}
                    onAddRecord={onAddRecord}
                    addRecordLabel={addRecordLabel}
                    onResetDefaults={gridState.resetPreferences}
                    activePanel={gridState.activePanel}
                    setActivePanel={gridState.setActivePanel}
                    api={api}
                    {...slotProps.toolbar}
                />
            )}

            {/* 2. Main Body: Card View (Mobile) hoặc Table Grid View (Desktop/Tablet) */}
            {isCardView ? (
                <div className="data-grid__mobile-feed" role="feed" aria-busy={loading}>
                    {currentPageRows.map((row, index) => {
                        const rowId = getRowId ? getRowId(row) : (row.id ?? index);
                        const isRowSelected = selectionState.isSelected(rowId);
                        const MobileCardComponent = slots.mobileCard || DataGridMobileCard;

                        return (
                            <MobileCardComponent
                                key={rowId}
                                row={row}
                                rowIndex={index}
                                columns={columnsState.visibleColumns}
                                isSelected={isRowSelected}
                                onSelectRow={selectionState.toggleRowSelection}
                                getRowId={getRowId}
                                getRowValue={getRowValue}
                                checkboxSelection={checkboxSelection}
                                api={api}
                                {...slotProps.mobileCard}
                            />
                        );
                    })}
                </div>
            ) : (
                <div ref={bodyScrollRef} className="data-grid__container" onScroll={handleScroll}>
                    <div
                        className="data-grid__table"
                        style={{
                            width: '100%',
                            minWidth: columnsState.effectiveTotalWidth ? `${columnsState.effectiveTotalWidth}px` : '100%',
                        }}
                    >
                        <DataGridHeader
                            columnsState={columnsState}
                            sortState={sortState}
                            selectionState={selectionState}
                            currentPageRows={currentPageRows}
                            onOpenColumnsPanel={gridState.openColumnsPanel}
                            onOpenFilterPanel={gridState.openFilterPanel}
                            onPinColumn={columnsState.handlePinColumn}
                            {...slotProps.header}
                        />
                        <DataGridBody
                            rows={currentPageRows}
                            rawTotalRowsCount={rows.length}
                            columns={columnsState.visibleColumns}
                            effectiveTotalWidth={columnsState.effectiveTotalWidth}
                            loading={loading}
                            error={error}
                            onRetry={onRetry}
                            selectionState={selectionState}
                            virtualizerState={virtualizerState}
                            keyboardState={keyboardState}
                            editingState={editingState}
                            getRowId={getRowId}
                            getRowValue={getRowValue}
                            onRowClick={onRowClick}
                            onRowDoubleClick={onRowDoubleClick}
                            getRowClassName={getRowClassName}
                            slots={slots}
                            slotProps={slotProps}
                            api={api}
                        />
                    </div>
                </div>
            )}

            {/* 3. Pagination Footer */}
            <PaginationComponent
                paginationState={paginationState}
                selectionCount={selectionState.selectedCount}
                api={api}
                {...slotProps.pagination}
            />

            {/* 4. Floating Bulk Action Dock */}
            {checkboxSelection && (
                <DataGridSelectionBar
                    selectedCount={selectionState.selectedCount}
                    onClearSelection={selectionState.clearSelection}
                    onBulkDelete={onBulkDelete}
                    onBulkExport={onBulkExport}
                    bulkActionState={selectionState.bulkActionState}
                    customBulkActions={customBulkActions}
                    {...slotProps.selectionBar}
                />
            )}
        </div>
    );
});

DataGrid.displayName = 'DataGrid';

DataGrid.propTypes = {
    columns: PropTypes.arrayOf(
        PropTypes.shape({
            field: PropTypes.string.isRequired,
            headerName: PropTypes.string,
            width: PropTypes.number,
            minWidth: PropTypes.number,
            maxWidth: PropTypes.number,
            flex: PropTypes.number,
            sortable: PropTypes.bool,
            filterable: PropTypes.bool,
            resizable: PropTypes.bool,
            hideable: PropTypes.bool,
            editable: PropTypes.bool,
            type: PropTypes.string,
            valueOptions: PropTypes.array,
            align: PropTypes.oneOf(['left', 'center', 'right']),
            headerAlign: PropTypes.oneOf(['left', 'center', 'right']),
            renderCell: PropTypes.func,
            renderHeader: PropTypes.func,
            valueGetter: PropTypes.func,
            valueFormatter: PropTypes.func,
            cellClassName: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
        })
    ).isRequired,
    rows: PropTypes.array.isRequired,
    getRowId: PropTypes.func,
    loading: PropTypes.bool,
    error: PropTypes.any,
    onRetry: PropTypes.func,
    isRefreshing: PropTypes.bool,
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    autoHeight: PropTypes.bool,
    className: PropTypes.string,
    style: PropTypes.object,
    toolbar: PropTypes.bool,
    showQuickFilter: PropTypes.bool,
    showColumnSelector: PropTypes.bool,
    showFilterButton: PropTypes.bool,
    showDensitySelector: PropTypes.bool,
    showExportButton: PropTypes.bool,
    showRefreshButton: PropTypes.bool,
    onRefresh: PropTypes.func,
    quickFilterPlaceholder: PropTypes.string,
    title: PropTypes.node,
    actions: PropTypes.node,
    onAddRecord: PropTypes.func,
    addRecordLabel: PropTypes.string,
    onRowEditSave: PropTypes.func,
    onRowEditCancel: PropTypes.func,
    onRowEditStart: PropTypes.func,
    onRowDelete: PropTypes.func,
    checkboxSelection: PropTypes.bool,
    onBulkDelete: PropTypes.func,
    onBulkExport: PropTypes.func,
    customBulkActions: PropTypes.node,
    slots: PropTypes.object,
    slotProps: PropTypes.object,
    onRowClick: PropTypes.func,
    onRowDoubleClick: PropTypes.func,
    getRowClassName: PropTypes.func,
    mobileMode: PropTypes.oneOf(['card', 'table', 'auto']),
    storageKey: PropTypes.string,
    persistSettings: PropTypes.bool,
};

export default memo(DataGrid);

