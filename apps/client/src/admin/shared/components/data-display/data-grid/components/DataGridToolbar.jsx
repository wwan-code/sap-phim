/**
 * @file DataGridToolbar.jsx
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Components/DataGridToolbar
 * @description Toolbar chuẩn Mockup Gogo MUI-X: Tiêu đề bên trái,
 * Action Buttons (+ Add Record) kết hợp liền mạch cùng dải Minimalist Icon Strip bên phải
 * với Button, IconButton, Tooltip, TextField và FloatingPortal.
 */

import React, { useState, useRef, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import {
  Search,
  SlidersHorizontal,
  Filter,
  StretchHorizontal,
  RotateCcw,
  Download,
  FileSpreadsheet,
  FileCode,
  Undo2,
  Redo2,
  Plus,
  X,
} from 'lucide-react';
import { useFloating, offset, flip, shift, autoUpdate, FloatingPortal } from '@floating-ui/react';

import Button from '@/shared/components/ui/button';
import IconButton from '@/shared/components/ui/icon-button';
import Tooltip from '@/shared/components/ui/tooltip';

import DataGridColumnsPanel from './panels/DataGridColumnsPanel';
import DataGridFilterPanel from './panels/DataGridFilterPanel';
import DataGridDensityMenu from './panels/DataGridDensityMenu';
import { exportToCSV, exportToJSON } from '../utils/data-grid-export';
import { GRID_DENSITIES } from '../data-grid.constants';

export const DataGridToolbar = ({
  columnsState,
  filterState,
  density,
  setDensity,
  rows = [],
  getRowValue,
  showQuickFilter = true,
  showColumnSelector = true,
  showFilterButton = true,
  showDensitySelector = true,
  showExportButton = true,
  showRefreshButton = false,
  onRefresh,
  quickFilterPlaceholder = 'Tìm kiếm...',
  title = 'Overview',
  actions,
  onAddRecord,
  addRecordLabel = 'Add Record',
  onResetDefaults,
  activePanel: externalActivePanel,
  setActivePanel: externalSetActivePanel,
}) => {
  const { quickFilterText, setQuickFilterText } = filterState;

  // Expanding search pill state
  const [isSearchExpanded, setIsSearchExpanded] = useState(Boolean(quickFilterText));
  const searchInputRef = useRef(null);

  // Dedicated button anchor refs for stable Floating UI positioning
  const columnsBtnRef = useRef(null);
  const filterBtnRef = useRef(null);
  const densityBtnRef = useRef(null);
  const exportBtnRef = useRef(null);

  useEffect(() => {
    if (quickFilterText) {
      setIsSearchExpanded(true);
    }
  }, [quickFilterText]);

  // Floating Popover Menus state ('columns' | 'filter' | 'density' | 'export' | null)
  const [internalActivePanel, setInternalActivePanel] = useState(null);
  const activePanel = externalActivePanel !== undefined ? externalActivePanel : internalActivePanel;
  const setActivePanel = externalSetActivePanel || setInternalActivePanel;

  const { refs, floatingStyles } = useFloating({
    open: Boolean(activePanel),
    onOpenChange: (open) => {
      if (!open) setActivePanel(null);
    },
    middleware: [offset(8), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
    placement: 'bottom-end',
  });

  // Attach the active button DOM node to Floating UI reference
  useEffect(() => {
    if (activePanel === 'columns') refs.setReference(columnsBtnRef.current);
    else if (activePanel === 'filter') refs.setReference(filterBtnRef.current);
    else if (activePanel === 'density') refs.setReference(densityBtnRef.current);
    else if (activePanel === 'export') refs.setReference(exportBtnRef.current);
  }, [activePanel, refs]);

  // Click-outside listener for floating panels rendered via Portal
  useEffect(() => {
    if (!activePanel) return;

    const handlePointerDownOutside = (event) => {
      const refEl = refs.reference?.current;
      const floatEl = refs.floating?.current;

      // Click inside active trigger button
      if (refEl && refEl.contains(event.target)) return;
      // Click inside floating panel
      if (floatEl && floatEl.contains(event.target)) return;

      // Don't close if clicking other toolbar trigger buttons (let their click handler handle toggle)
      if (
        columnsBtnRef.current?.contains(event.target) ||
        filterBtnRef.current?.contains(event.target) ||
        densityBtnRef.current?.contains(event.target) ||
        exportBtnRef.current?.contains(event.target)
      ) {
        return;
      }

      // Don't close if clicking inside select portals, dropdowns, listboxes or tooltips
      if (
        event.target.closest?.('.select__dropdown') ||
        event.target.closest?.('.select__dropdown-list') ||
        event.target.closest?.('.select__dropdown-search') ||
        event.target.closest?.('[data-floating-ui-portal]') ||
        event.target.closest?.('[data-floating-scroll]') ||
        event.target.closest?.('[role="listbox"]') ||
        event.target.closest?.('[role="tooltip"]') ||
        event.target.closest?.('.tooltip') ||
        event.target.closest?.('.floating-portal')
      ) {
        return;
      }

      setActivePanel(null);
    };

    // Use tick delay to avoid immediate closure from the triggering click
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDownOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [activePanel, refs]);

  const togglePanel = (panelName) => {
    setActivePanel((prev) => {
      const next = prev === panelName ? null : panelName;
      if (next === 'columns') refs.setReference(columnsBtnRef.current);
      else if (next === 'filter') refs.setReference(filterBtnRef.current);
      else if (next === 'density') refs.setReference(densityBtnRef.current);
      else if (next === 'export') refs.setReference(exportBtnRef.current);
      return next;
    });
  };

  const handleExport = (format) => {
    const filename = `${title ? title.toLowerCase().replace(/\s+/g, '_') : 'data'}_export_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') {
      exportToCSV(rows, columnsState.visibleColumns, getRowValue, `${filename}.csv`);
    } else {
      exportToJSON(rows, columnsState.visibleColumns, getRowValue, `${filename}.json`);
    }
    setActivePanel(null);
  };

  const handleExpandSearch = () => {
    setIsSearchExpanded(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="data-grid__toolbar" role="toolbar" aria-label="Thanh công cụ DataGrid">
      {/* 1. Left Title */}
      <div className="data-grid__toolbar-left">
        {title && <h3 className="data-grid__toolbar-title">{title}</h3>}
      </div>

      {/* 2. Right: Action Buttons + Icon Strip có thể xuất hiện đồng thời */}
      <div className="data-grid__toolbar-right">
        {/* Custom Actions hoặc Nút Add Record chuẩn Mockup */}
        {actions}

        {onAddRecord && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Plus size={15} />}
            onClick={onAddRecord}
            className="data-grid__toolbar-add-btn"
            aria-label={addRecordLabel}
          >
            {addRecordLabel}
          </Button>
        )}

        {/* Dải Icon Strip công cụ */}
        <div className="data-grid__toolbar-icon-strip">
          {/* Undo & Redo (Muted Mockup Icons) */}
          <Tooltip title="Hoàn tác" disabled={Boolean(activePanel)}>
            <IconButton
              size="small"
              variant="standard"
              disabled
              aria-label="Hoàn tác"
            >
              <Undo2 size={16} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Làm lại" disabled={Boolean(activePanel)}>
            <IconButton
              size="small"
              variant="standard"
              disabled
              aria-label="Làm lại"
            >
              <Redo2 size={16} />
            </IconButton>
          </Tooltip>

          <div className="data-grid__toolbar-divider" />

          {/* Columns Selector */}
          {showColumnSelector && (
            <Tooltip title="Quản lý cột" disabled={Boolean(activePanel)}>
              <div
                ref={columnsBtnRef}
                style={{ display: 'inline-flex' }}
              >
                <IconButton
                  size="small"
                  variant={activePanel === 'columns' ? 'tonal' : 'standard'}
                  color={activePanel === 'columns' ? 'primary' : 'default'}
                  onClick={() => togglePanel('columns')}
                  aria-label="Quản lý cột hiển thị"
                >
                  <SlidersHorizontal size={16} />
                </IconButton>
              </div>
            </Tooltip>
          )}

          {/* Filter Popover Trigger */}
          {showFilterButton && (
            <Tooltip title="Bộ lọc dữ liệu" disabled={Boolean(activePanel)}>
              <div
                ref={filterBtnRef}
                style={{ display: 'inline-flex' }}
              >
                <IconButton
                  size="small"
                  variant={activePanel === 'filter' || filterState.activeFilterCount > 0 ? 'tonal' : 'standard'}
                  color={activePanel === 'filter' || filterState.activeFilterCount > 0 ? 'primary' : 'default'}
                  onClick={() => togglePanel('filter')}
                  aria-label="Bộ lọc dữ liệu"
                >
                  <Filter size={16} />
                </IconButton>
              </div>
            </Tooltip>
          )}

          {/* Density Switcher */}
          {showDensitySelector && (
            <Tooltip title="Độ giãn dòng" disabled={Boolean(activePanel)}>
              <div
                ref={densityBtnRef}
                style={{ display: 'inline-flex' }}
              >
                <IconButton
                  size="small"
                  variant={activePanel === 'density' || (density && density !== GRID_DENSITIES.STANDARD) ? 'tonal' : 'standard'}
                  color={activePanel === 'density' || (density && density !== GRID_DENSITIES.STANDARD) ? 'primary' : 'default'}
                  onClick={() => togglePanel('density')}
                  aria-label="Độ giãn dòng"
                >
                  <StretchHorizontal size={16} />
                </IconButton>
              </div>
            </Tooltip>
          )}

          <div className="data-grid__toolbar-divider" />

          {/* Export Button */}
          {showExportButton && (
            <Tooltip title="Xuất dữ liệu" disabled={Boolean(activePanel)}>
              <div
                ref={exportBtnRef}
                style={{ display: 'inline-flex' }}
              >
                <IconButton
                  size="small"
                  variant={activePanel === 'export' ? 'tonal' : 'standard'}
                  color={activePanel === 'export' ? 'primary' : 'default'}
                  onClick={() => togglePanel('export')}
                  aria-label="Xuất dữ liệu"
                >
                  <Download size={16} />
                </IconButton>
              </div>
            </Tooltip>
          )}

          {/* Expanding Search Pill with Seamless Neural Motion */}
          {showQuickFilter && (
            <div
              className={`data-grid__toolbar-search-morph ${
                isSearchExpanded || quickFilterText ? 'data-grid__toolbar-search-morph--expanded' : ''
              }`}
            >
              {!isSearchExpanded && !quickFilterText ? (
                <Tooltip title="Tìm kiếm" disabled={Boolean(activePanel)}>
                  <button
                    type="button"
                    className="data-grid__toolbar-search-icon-btn"
                    onClick={handleExpandSearch}
                    aria-label="Tìm kiếm"
                  >
                    <Search size={16} />
                  </button>
                </Tooltip>
              ) : (
                <button
                  type="button"
                  className="data-grid__toolbar-search-icon-btn"
                  onClick={() => searchInputRef.current?.focus()}
                  aria-label="Tìm kiếm"
                  tabIndex={-1}
                >
                  <Search size={16} />
                </button>
              )}

              <input
                ref={searchInputRef}
                type="text"
                className="data-grid__toolbar-search-input"
                placeholder={quickFilterPlaceholder}
                value={quickFilterText || ''}
                onChange={(e) => setQuickFilterText(e.target.value)}
                onFocus={() => setIsSearchExpanded(true)}
                onBlur={() => {
                  if (!quickFilterText) {
                    setIsSearchExpanded(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setQuickFilterText('');
                    setIsSearchExpanded(false);
                    searchInputRef.current?.blur();
                  }
                }}
                aria-label="Tìm kiếm nhanh"
                tabIndex={isSearchExpanded || quickFilterText ? 0 : -1}
              />

              {quickFilterText && (
                <button
                  type="button"
                  className="data-grid__toolbar-search-clear-btn"
                  onClick={() => {
                    setQuickFilterText('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Xóa tìm kiếm"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Popovers in Portal */}
      <FloatingPortal>
        {activePanel === 'columns' && (
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 1200, outline: 'none' }}
          >
            <DataGridColumnsPanel
              columns={columnsState.columns || columnsState.allColumns || []}
              columnVisibility={columnsState.columnVisibility}
              onToggleColumn={columnsState.handleToggleColumn || columnsState.toggleColumnVisibility}
              onSetAllColumnsVisibility={columnsState.setAllColumnsVisibility}
              onResetColumns={columnsState.resetColumns}
            />
          </div>
        )}

        {activePanel === 'filter' && (
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 1200, outline: 'none' }}
          >
            <DataGridFilterPanel
              filterState={filterState}
              columns={columnsState.visibleColumns}
              onClose={() => setActivePanel(null)}
            />
          </div>
        )}

        {activePanel === 'density' && (
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 1200, outline: 'none' }}
          >
            <DataGridDensityMenu
              density={density}
              onDensityChange={(d) => {
                setDensity(d);
                setActivePanel(null);
              }}
              onClose={() => setActivePanel(null)}
            />
          </div>
        )}

        {activePanel === 'export' && (
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 1200, outline: 'none' }}
            className="data-grid-panel"
          >
            <div className="data-grid-panel__header">
              <span>Xuất Dữ Liệu</span>
            </div>
            <Button
              variant="text"
              color="inherit"
              fullWidth
              startIcon={<FileSpreadsheet size={16} />}
              onClick={() => handleExport('csv')}
              style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 12px' }}
            >
              Xuất CSV (.csv)
            </Button>
            <Button
              variant="text"
              color="inherit"
              fullWidth
              startIcon={<FileCode size={16} />}
              onClick={() => handleExport('json')}
              style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 12px' }}
            >
              Xuất JSON (.json)
            </Button>
          </div>
        )}
      </FloatingPortal>
    </div>
  );
};

DataGridToolbar.propTypes = {
  columnsState: PropTypes.object.isRequired,
  filterState: PropTypes.object.isRequired,
  density: PropTypes.string.isRequired,
  setDensity: PropTypes.func.isRequired,
  rows: PropTypes.array,
  getRowValue: PropTypes.func,
  showQuickFilter: PropTypes.bool,
  showColumnSelector: PropTypes.bool,
  showFilterButton: PropTypes.bool,
  showDensitySelector: PropTypes.bool,
  showExportButton: PropTypes.bool,
  showRefreshButton: PropTypes.bool,
  onRefresh: PropTypes.func,
  quickFilterPlaceholder: PropTypes.string,
  title: PropTypes.string,
  actions: PropTypes.node,
  onAddRecord: PropTypes.func,
  addRecordLabel: PropTypes.string,
  onResetDefaults: PropTypes.func,
};

export default memo(DataGridToolbar);
