/**
 * @file use-data-grid-query.js
 * @module Admin/Shared/Components/DataDisplay/DataGrid/Hooks/UseDataGridQuery
 * @description Companion Hook tích hợp 2 chiều với TanStack Query v5, tự động debounce search, prefetch trang kế tiếp và format params cho DataGrid.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

export const useDataGridQuery = ({
  queryKey,
  queryFn,
  defaultPage = 1,
  defaultPageSize = 20,
  defaultSortModel = [],
  defaultFilterModel = { items: [], quickFilterValues: [] },
  customParams = {},
  debounceMs = 300,
  syncUrlParams = false,
  enabled = true,
  staleTime = 1000 * 30, // 30s
  enablePrefetch = true,
}) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Khởi tạo state từ URL SearchParams nếu bật syncUrlParams
  const [paginationModel, setPaginationModel] = useState(() => {
    if (syncUrlParams) {
      const urlPage = parseInt(searchParams.get('page'), 10);
      const urlPageSize = parseInt(searchParams.get('limit') || searchParams.get('pageSize'), 10);
      return {
        page: !Number.isNaN(urlPage) && urlPage > 0 ? urlPage : defaultPage,
        pageSize: !Number.isNaN(urlPageSize) && urlPageSize > 0 ? urlPageSize : defaultPageSize,
      };
    }
    return { page: defaultPage, pageSize: defaultPageSize };
  });

  const [sortModel, setSortModel] = useState(() => {
    if (syncUrlParams) {
      const sortField = searchParams.get('sortBy') || searchParams.get('sortField');
      const sortOrder = searchParams.get('sortOrder') || searchParams.get('order');
      if (sortField && sortOrder) {
        return [{ field: sortField, sort: sortOrder }];
      }
    }
    return defaultSortModel;
  });

  const [filterModel, setFilterModel] = useState(() => {
    if (syncUrlParams) {
      const search = searchParams.get('q') || searchParams.get('search');
      if (search) {
        return { items: [], quickFilterValues: [search] };
      }
    }
    return defaultFilterModel;
  });

  // Debounced Quick Filter
  const [debouncedQuickFilter, setDebouncedQuickFilter] = useState(() => {
    return filterModel.quickFilterValues?.[0] || '';
  });

  const debounceTimerRef = useRef(null);

  useEffect(() => {
    const rawSearch = filterModel.quickFilterValues?.[0] || '';
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuickFilter(rawSearch);
      // Reset về trang 1 khi đổi tìm kiếm
      setPaginationModel((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filterModel.quickFilterValues, debounceMs]);

  // Đồng bộ ngược lại URL SearchParams nếu bật syncUrlParams
  useEffect(() => {
    if (!syncUrlParams) return;

    setSearchParams(
      (prevParams) => {
        const newParams = new URLSearchParams(prevParams);
        const currentPage = newParams.get('page');
        const currentLimit = newParams.get('limit');
        const currentQ = newParams.get('q') || '';
        const currentSortBy = newParams.get('sortBy');
        const currentSortOrder = newParams.get('sortOrder');

        const targetPage = String(paginationModel.page);
        const targetLimit = String(paginationModel.pageSize);
        const targetQ = debouncedQuickFilter || '';
        const targetSortBy = sortModel[0]?.field;
        const targetSortOrder = sortModel[0]?.sort;

        let isChanged = false;
        if (currentPage !== targetPage) {
          newParams.set('page', targetPage);
          isChanged = true;
        }
        if (currentLimit !== targetLimit) {
          newParams.set('limit', targetLimit);
          isChanged = true;
        }
        if (currentQ !== targetQ) {
          if (targetQ) newParams.set('q', targetQ);
          else newParams.delete('q');
          isChanged = true;
        }
        if (currentSortBy !== targetSortBy || currentSortOrder !== targetSortOrder) {
          if (targetSortBy && targetSortOrder) {
            newParams.set('sortBy', targetSortBy);
            newParams.set('sortOrder', targetSortOrder);
          } else {
            newParams.delete('sortBy');
            newParams.delete('sortOrder');
          }
          isChanged = true;
        }

        return isChanged ? newParams : prevParams;
      },
      { replace: true }
    );
  }, [
    paginationModel.page,
    paginationModel.pageSize,
    debouncedQuickFilter,
    sortModel,
    syncUrlParams,
    setSearchParams,
  ]);

  // Lắng nghe URL SearchParams thay đổi từ bên ngoài (nút Back/Forward trình duyệt)
  useEffect(() => {
    if (!syncUrlParams) return;

    const urlPage = parseInt(searchParams.get('page'), 10);
    const urlPageSize = parseInt(searchParams.get('limit') || searchParams.get('pageSize'), 10);
    const urlSearch = searchParams.get('q') || searchParams.get('search') || '';
    const urlSortField = searchParams.get('sortBy') || searchParams.get('sortField');
    const urlSortOrder = searchParams.get('sortOrder') || searchParams.get('order');

    if (!Number.isNaN(urlPage) && urlPage > 0 && urlPage !== paginationModel.page) {
      setPaginationModel((prev) => ({ ...prev, page: urlPage }));
    }
    if (!Number.isNaN(urlPageSize) && urlPageSize > 0 && urlPageSize !== paginationModel.pageSize) {
      setPaginationModel((prev) => ({ ...prev, pageSize: urlPageSize }));
    }
    if (urlSearch !== (filterModel.quickFilterValues?.[0] || '')) {
      setFilterModel((prev) => ({
        ...prev,
        quickFilterValues: urlSearch ? [urlSearch] : [],
      }));
    }
    if (urlSortField && urlSortOrder) {
      if (sortModel[0]?.field !== urlSortField || sortModel[0]?.sort !== urlSortOrder) {
        setSortModel([{ field: urlSortField, sort: urlSortOrder }]);
      }
    }
  }, [searchParams, syncUrlParams]);

  // Xây dựng params chuẩn cho QueryFn
  const queryParams = useMemo(() => {
    const params = {
      page: paginationModel.page,
      limit: paginationModel.pageSize,
      pageSize: paginationModel.pageSize,
      ...customParams,
    };

    if (debouncedQuickFilter) {
      params.q = debouncedQuickFilter;
      params.search = debouncedQuickFilter;
    }

    if (sortModel.length > 0) {
      params.sortBy = sortModel[0].field;
      params.sortOrder = sortModel[0].sort;
      params.sort = sortModel[0].sort.toUpperCase();
      params.order_by = sortModel[0].field;
    }

    if (filterModel.items?.length > 0) {
      filterModel.items.forEach((item) => {
        if (item.field && item.value !== undefined && item.value !== '') {
          params[`filter_${item.field}`] = item.value;
          params[`op_${item.field}`] = item.operator;
        }
      });
    }

    return params;
  }, [paginationModel.page, paginationModel.pageSize, debouncedQuickFilter, sortModel, filterModel.items, customParams]);

  // Tạo Stable Query Key
  const fullQueryKey = useMemo(() => {
    const baseKey = Array.isArray(queryKey) ? queryKey : [queryKey];
    return [...baseKey, queryParams];
  }, [queryKey, queryParams]);

  // Thực thi TanStack Query useQuery
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => queryFn(queryParams),
    enabled,
    staleTime,
  });

  // Trích xuất rows và total count từ nhiều định dạng API phổ biến
  const { rows, totalCount } = useMemo(() => {
    if (!data) return { rows: [], totalCount: 0 };

    // Format 1: { data: [...], total: 100 }
    if (Array.isArray(data.data)) {
      return {
        rows: data.data,
        totalCount: data.total ?? data.totalCount ?? data.pagination?.total ?? data.data.length,
      };
    }

    // Format 2: { items: [...], pagination: { total: 100 } }
    if (Array.isArray(data.items)) {
      return {
        rows: data.items,
        totalCount: data.pagination?.total ?? data.total ?? data.totalCount ?? data.items.length,
      };
    }

    // Format 3: Array trực tiếp
    if (Array.isArray(data)) {
      return { rows: data, totalCount: data.length };
    }

    return { rows: [], totalCount: 0 };
  }, [data]);

  // Trích xuất thống kê counts theo trạng thái (nếu có từ API response: data.meta.counts hoặc data.counts)
  const counts = useMemo(() => {
    return data?.meta?.counts ?? data?.counts ?? null;
  }, [data]);

  // Prefetch trang tiếp theo sử dụng queryClient.prefetchQuery
  useEffect(() => {
    if (!enablePrefetch || !data || !queryFn) return;
    const totalPages = Math.ceil(totalCount / paginationModel.pageSize);
    if (paginationModel.page < totalPages) {
      const nextPageParams = { ...queryParams, page: paginationModel.page + 1 };
      const nextKey = [...(Array.isArray(queryKey) ? queryKey : [queryKey]), nextPageParams];
      queryClient.prefetchQuery({
        queryKey: nextKey,
        queryFn: () => queryFn(nextPageParams),
        staleTime,
      }).catch(() => {});
    }
  }, [data, enablePrefetch, paginationModel.page, paginationModel.pageSize, totalCount, queryParams, queryKey, queryFn, queryClient, staleTime]);

  // Huỷ bỏ cache của các trang kế tiếp đã prefetch khi có thay đổi dữ liệu để tránh lệch offset
  const invalidatePrefetchedPages = useCallback(() => {
    const baseKey = Array.isArray(queryKey) ? queryKey : [queryKey];
    queryClient.invalidateQueries({
      predicate: (q) => {
        const qKey = q.queryKey;
        if (!Array.isArray(qKey) || qKey.length < baseKey.length) return false;
        const matchesBase = baseKey.every((part, i) => qKey[i] === part);
        if (!matchesBase) return false;
        const lastParam = qKey[qKey.length - 1];
        return Boolean(lastParam && typeof lastParam === 'object' && lastParam.page > paginationModel.page);
      },
    });
  }, [queryClient, queryKey, paginationModel.page]);

  // Cập nhật lạc quan: Xóa tức thì hàng khỏi Cache UI (0ms) với hàm rollback khi lỗi
  const optimisticRemoveRow = useCallback((ids, idField = 'id') => {
    const targetIds = new Set(Array.isArray(ids) ? ids.map(String) : [String(ids)]);
    if (targetIds.size === 0) return () => {};

    const previousCache = queryClient.getQueryData(fullQueryKey);
    if (!previousCache) return () => {};

    const removeCount = targetIds.size;
    let updatedCache = null;

    if (Array.isArray(previousCache.data)) {
      const filtered = previousCache.data.filter(
        (item) => !targetIds.has(String(item[idField] ?? item._id ?? item.id))
      );
      const totalKey = previousCache.total !== undefined ? 'total' : previousCache.totalCount !== undefined ? 'totalCount' : 'total';
      updatedCache = {
        ...previousCache,
        data: filtered,
        [totalKey]: Math.max(0, (previousCache[totalKey] || 0) - removeCount),
      };
    } else if (Array.isArray(previousCache.items)) {
      const filtered = previousCache.items.filter(
        (item) => !targetIds.has(String(item[idField] ?? item._id ?? item.id))
      );
      const total = previousCache.pagination?.total ?? previousCache.total ?? previousCache.totalCount ?? previousCache.items.length;
      updatedCache = {
        ...previousCache,
        items: filtered,
        total: Math.max(0, total - removeCount),
        ...(previousCache.pagination
          ? { pagination: { ...previousCache.pagination, total: Math.max(0, previousCache.pagination.total - removeCount) } }
          : {}),
      };
    } else if (Array.isArray(previousCache)) {
      updatedCache = previousCache.filter(
        (item) => !targetIds.has(String(item[idField] ?? item._id ?? item.id))
      );
    }

    if (updatedCache) {
      queryClient.setQueryData(fullQueryKey, updatedCache);
      invalidatePrefetchedPages();
    }

    return () => {
      queryClient.setQueryData(fullQueryKey, previousCache);
    };
  }, [queryClient, fullQueryKey, invalidatePrefetchedPages]);

  // Cập nhật lạc quan: Cập nhật tức thì dữ liệu hàng (0ms) với hàm rollback khi lỗi
  const optimisticUpdateRow = useCallback((id, patch, idField = 'id') => {
    const targetId = String(id);
    const previousCache = queryClient.getQueryData(fullQueryKey);
    if (!previousCache) return () => {};

    let updatedCache = null;
    const updateItem = (item) => {
      if (String(item[idField] ?? item._id ?? item.id) === targetId) {
        return typeof patch === 'function' ? patch(item) : { ...item, ...patch };
      }
      return item;
    };

    if (Array.isArray(previousCache.data)) {
      updatedCache = {
        ...previousCache,
        data: previousCache.data.map(updateItem),
      };
    } else if (Array.isArray(previousCache.items)) {
      updatedCache = {
        ...previousCache,
        items: previousCache.items.map(updateItem),
      };
    } else if (Array.isArray(previousCache)) {
      updatedCache = previousCache.map(updateItem);
    }

    if (updatedCache) {
      queryClient.setQueryData(fullQueryKey, updatedCache);
    }

    return () => {
      queryClient.setQueryData(fullQueryKey, previousCache);
    };
  }, [queryClient, fullQueryKey]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Props sẵn sàng truyền vào <DataGrid {...gridProps} />
  const gridProps = useMemo(() => ({
    rows,
    rowCount: totalCount,
    loading: isLoading || (isFetching && rows.length === 0),
    error: isError ? error : null,
    onRetry: refetch,
    
    // Server modes
    pagination: true,
    paginationMode: 'server',
    paginationModel,
    onPaginationModelChange: setPaginationModel,

    sortingMode: 'server',
    sortModel,
    onSortModelChange: setSortModel,

    filterMode: 'server',
    filterModel,
    onFilterModelChange: setFilterModel,

    onRefresh: handleRefresh,
  }), [
    rows,
    totalCount,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    paginationModel,
    sortModel,
    filterModel,
    handleRefresh,
  ]);

  return {
    ...gridProps,
    data,
    counts,
    rows,
    totalCount,
    fullQueryKey,
    isFetching,
    queryParams,
    setPaginationModel,
    setSortModel,
    setFilterModel,
    refetch,
    gridProps,
    optimisticRemoveRow,
    optimisticUpdateRow,
    invalidatePrefetchedPages,
  };
};
