/**
 * @file HeaderSearch.jsx
 * @module Components/Layout/Header/Components/HeaderSearch
 * @component HeaderSearch
 * @description Subcomponent thanh tìm kiếm chính trên Header với gợi ý trực tiếp (Live Autocomplete) và lịch sử tìm kiếm theo chuẩn Material 3.
 */

import React, { memo, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import { Search, X, History, TrendingUp, Star, Loader2 } from 'lucide-react';

import IconButton from '@/shared/components/ui/icon-button/IconButton';
import { useFloatingDropdown } from '@/hooks/ui/use-floating-dropdown';
import api from '@/shared/services/api';
import { ROUTES } from '@/shared/constants/routes.constants';
import { FALLBACK_POSTER, resolveImage } from '@/shared/utils/asset.util';

const POPULAR_TAGS = ['Isekai', 'Học đường', 'Hành động', 'Chuyển sinh', 'Romance', 'Phiêu lưu'];

/**
 * @component SearchPopoverContent
 * @description Thành phần con hiển thị danh sách lịch sử và gợi ý tìm kiếm
 */
const SearchPopoverContent = memo(({
  query,
  suggestions,
  isLoading,
  recentSearches,
  popularTags,
  onDeleteRecent,
  onClearAllRecent,
  onSelectQuery,
  activeIndex,
  setActiveIndex,
  onSelectSuggestion,
}) => {
  // 1. Loading state
  if (isLoading) {
    return (
      <div className="app-header__search-state" role="status" aria-live="polite">
        <Loader2 size={18} className="app-header__search-spinner" />
        <span>Đang tìm kiếm anime...</span>
      </div>
    );
  }

  // 2. Suggestions state (query has text)
  if (query.trim()) {
    if (suggestions.length > 0) {
      return (
        <div className="app-header__search-suggestions">
          <h3 className="app-header__search-title">Kết quả gợi ý</h3>
          <ul className="app-header__search-list" role="listbox" aria-label="Gợi ý anime">
            {suggestions.map((movie, index) => {
              const active = activeIndex === index;
              const posterUrl = resolveImage(
                movie?.images?.poster || movie?.poster_url || movie?.images?.cover || movie?.poster,
                FALLBACK_POSTER
              );
              const title = movie?.title || movie?.name || 'Anime';
              const meta = [
                movie?.release_year || movie?.year,
                movie?.genres?.[0]?.name || movie?.type,
              ]
                .filter(Boolean)
                .join(' • ') || 'Sạp Phim';

              const rating = movie?.rating_average ? Number(movie.rating_average).toFixed(1) : null;

              return (
                <li
                  key={movie.id || movie.slug || index}
                  role="option"
                  aria-selected={active}
                  className={classNames('app-header__search-suggest-item', {
                    'app-header__search-suggest-item--focused': active,
                  })}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => onSelectSuggestion(movie)}
                >
                  <img
                    src={posterUrl}
                    alt={title}
                    className="app-header__search-suggest-poster"
                    loading="lazy"
                  />
                  <div className="app-header__search-suggest-info">
                    <span className="app-header__search-suggest-title">{title}</span>
                    <span className="app-header__search-suggest-meta">{meta}</span>
                  </div>
                  {rating && (
                    <span className="app-header__search-suggest-rating">
                      <Star size={12} fill="currentColor" />
                      {rating}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    return (
      <div className="app-header__search-state" role="status" aria-live="polite">
        <span>Không tìm thấy anime phù hợp với &ldquo;{query}&rdquo;.</span>
      </div>
    );
  }

  // 3. Static/History state (query is empty)
  const hasRecent = recentSearches.length > 0;

  return (
    <div className="app-header__search-suggestions">
      {hasRecent && (
        <div className="app-header__search-recent-section">
          <div className="app-header__search-title-row">
            <h3 className="app-header__search-title">
              <History size={14} /> Tìm kiếm gần đây
            </h3>
            <button
              type="button"
              className="app-header__search-clear-all"
              onClick={onClearAllRecent}
            >
              Xóa tất cả
            </button>
          </div>
          <ul className="app-header__search-list" role="listbox" aria-label="Tìm kiếm gần đây">
            {recentSearches.map((search, index) => {
              const active = activeIndex === index;
              return (
                <li
                  key={search}
                  role="option"
                  aria-selected={active}
                  className={classNames('app-header__search-recent-item', {
                    'app-header__search-recent-item--focused': active,
                  })}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <button
                    type="button"
                    className="app-header__search-recent-text"
                    onClick={() => onSelectQuery(search)}
                  >
                    {search}
                  </button>
                  <button
                    type="button"
                    className="app-header__search-recent-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRecent(search);
                    }}
                    aria-label={`Xóa ${search} khỏi lịch sử`}
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="app-header__search-popular-section">
        <h3 className="app-header__search-title">
          <TrendingUp size={14} /> Tìm kiếm phổ biến
        </h3>
        <div className="app-header__search-tags" role="listbox" aria-label="Tìm kiếm phổ biến">
          {popularTags.map((tag, index) => {
            const globalIndex = hasRecent ? recentSearches.length + index : index;
            const active = activeIndex === globalIndex;
            return (
              <button
                key={tag}
                type="button"
                role="option"
                aria-selected={active}
                className={classNames('app-header__search-tag', {
                  'app-header__search-tag--focused': active,
                })}
                onMouseEnter={() => setActiveIndex(globalIndex)}
                onClick={() => onSelectQuery(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

SearchPopoverContent.displayName = 'SearchPopoverContent';

SearchPopoverContent.propTypes = {
  query: PropTypes.string.isRequired,
  suggestions: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
  recentSearches: PropTypes.array.isRequired,
  popularTags: PropTypes.array.isRequired,
  onDeleteRecent: PropTypes.func.isRequired,
  onClearAllRecent: PropTypes.func.isRequired,
  onSelectQuery: PropTypes.func.isRequired,
  activeIndex: PropTypes.number.isRequired,
  setActiveIndex: PropTypes.func.isRequired,
  onSelectSuggestion: PropTypes.func.isRequired,
};

/**
 * @component HeaderSearch
 * @description Ô tìm kiếm chính của Header hỗ trợ chế độ compact (tablet) và thanh tìm kiếm mở rộng (desktop).
 */
const HeaderSearch = memo(({ compact = false }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Debounce searchQuery
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 280);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load recent searches on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch {
      // Bỏ qua lỗi truy cập localStorage
    }
  }, []);

  // API Suggestions query qua TanStack Query
  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ['header-search-suggestions', debouncedQuery.trim()],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const res = await api.get('/movies', {
        params: { search: debouncedQuery.trim(), limit: 5 },
      });
      return res?.data?.items || res?.data?.data?.items || res?.data?.data || res?.data || [];
    },
    enabled: Boolean(debouncedQuery.trim()),
    staleTime: 60 * 1000,
  });

  const suggestions = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    if (Array.isArray(searchData)) return searchData;
    if (Array.isArray(searchData?.items)) return searchData.items;
    return [];
  }, [searchData, debouncedQuery]);

  const dropdown = useFloatingDropdown({
    placement: compact ? 'bottom-end' : 'bottom-start',
    trigger: 'click',
    offset: 8,
    adaptToDevice: true,
  });

  const {
    isOpen,
    isMounted,
    floatingStyles,
    refs,
    context,
    getReferenceProps,
    getFloatingProps,
    FloatingPortal,
    FloatingFocusManager,
    portalId,
  } = dropdown;

  // Reset activeIndex when query changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [searchQuery]);

  // Helpers for history management
  const addRecentSearch = useCallback((query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 6);
      try {
        localStorage.setItem('recentSearches', JSON.stringify(next));
      } catch {
        // Bỏ qua lỗi quota localStorage
      }
      return next;
    });
  }, []);

  const deleteRecentSearch = useCallback((query) => {
    setRecentSearches((prev) => {
      const next = prev.filter((q) => q !== query);
      try {
        localStorage.setItem('recentSearches', JSON.stringify(next));
      } catch {
        // Bỏ qua lỗi quota localStorage
      }
      return next;
    });
  }, []);

  const clearAllRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('recentSearches');
    } catch {
      // Bỏ qua
    }
  }, []);

  // Actions
  const performSearch = useCallback(
    (query) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      addRecentSearch(trimmed);
      dropdown.setIsOpen(false);
      if (inputRef.current) inputRef.current.blur();
      navigate(`${ROUTES.CATALOG}?search=${encodeURIComponent(trimmed)}`);
    },
    [addRecentSearch, dropdown, navigate]
  );

  const handleSearchSubmit = useCallback(
    (e) => {
      e.preventDefault();
      performSearch(searchQuery);
    },
    [performSearch, searchQuery]
  );

  const handleInputChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleClearInput = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSelectQuery = useCallback(
    (query) => {
      setSearchQuery(query);
      performSearch(query);
    },
    [performSearch]
  );

  const handleSelectSuggestion = useCallback(
    (movie) => {
      const title = movie?.title || movie?.name || '';
      if (title) addRecentSearch(title);
      dropdown.setIsOpen(false);
      const targetSlug = movie?.slug || movie?.id;
      navigate(ROUTES.MOVIE_DETAIL(targetSlug));
    },
    [addRecentSearch, dropdown, navigate]
  );

  // Calculate keyboard items
  const totalItems = useMemo(() => {
    if (searchQuery.trim()) {
      return suggestions.length;
    }
    return recentSearches.length + POPULAR_TAGS.length;
  }, [searchQuery, suggestions, recentSearches]);

  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 < -1 ? totalItems - 1 : prev - 1));
      } else if (e.key === 'Escape') {
        dropdown.setIsOpen(false);
        if (inputRef.current) inputRef.current.blur();
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < totalItems) {
          e.preventDefault();
          if (searchQuery.trim()) {
            handleSelectSuggestion(suggestions[activeIndex]);
          } else if (activeIndex < recentSearches.length) {
            handleSelectQuery(recentSearches[activeIndex]);
          } else {
            handleSelectQuery(POPULAR_TAGS[activeIndex - recentSearches.length]);
          }
        }
      }
    },
    [
      isOpen,
      totalItems,
      dropdown,
      activeIndex,
      searchQuery,
      handleSelectSuggestion,
      suggestions,
      recentSearches,
      handleSelectQuery,
    ]
  );

  if (compact) {
    return (
      <div className="app-header__search-container app-header__search-container--compact">
        <IconButton
          ref={refs.setReference}
          variant="tonal"
          size="medium"
          {...getReferenceProps()}
          aria-label="Tìm kiếm phim"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={classNames('app-header__action-btn', {
            'app-header__action-btn--active': isOpen,
          })}
        >
          <Search size={18} />
        </IconButton>

        {isMounted && (
          <FloatingPortal id={portalId}>
            <FloatingFocusManager
              context={context}
              modal={false}
              initialFocus={inputRef}
              returnFocus={false}
            >
              <form
                ref={refs.setFloating}
                style={floatingStyles}
                {...getFloatingProps({ className: 'app-header__search-popover' })}
                onSubmit={handleSearchSubmit}
              >
                <div className="app-header__search app-header__search--in-popover">
                  <Search size={18} className="app-header__search-icon" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Tìm kiếm anime, diễn viên..."
                    className="app-header__search-input"
                    aria-label="Tìm kiếm phim"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="app-header__search-clear"
                      onClick={handleClearInput}
                      aria-label="Xóa nội dung tìm kiếm"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <SearchPopoverContent
                  query={searchQuery}
                  suggestions={suggestions}
                  isLoading={isSearching}
                  recentSearches={recentSearches}
                  popularTags={POPULAR_TAGS}
                  onDeleteRecent={deleteRecentSearch}
                  onClearAllRecent={clearAllRecentSearches}
                  onSelectQuery={handleSelectQuery}
                  activeIndex={activeIndex}
                  setActiveIndex={setActiveIndex}
                  onSelectSuggestion={handleSelectSuggestion}
                />
              </form>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </div>
    );
  }

  return (
    <div
      className={classNames('app-header__search-container', {
        'app-header__search-container--active': isOpen,
      })}
    >
      <form
        className="app-header__search"
        role="search"
        ref={refs.setReference}
        {...getReferenceProps()}
        onSubmit={handleSearchSubmit}
      >
        <Search size={18} className="app-header__search-icon" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Tìm kiếm anime..."
          className="app-header__search-input"
          aria-label="Tìm kiếm phim"
        />
        {searchQuery && (
          <button
            type="button"
            className="app-header__search-clear"
            onClick={handleClearInput}
            aria-label="Xóa nội dung tìm kiếm"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {isMounted && (
        <FloatingPortal id={portalId}>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps({ className: 'app-header__search-popover' })}
            >
              <SearchPopoverContent
                query={searchQuery}
                suggestions={suggestions}
                isLoading={isSearching}
                recentSearches={recentSearches}
                popularTags={POPULAR_TAGS}
                onDeleteRecent={deleteRecentSearch}
                onClearAllRecent={clearAllRecentSearches}
                onSelectQuery={handleSelectQuery}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                onSelectSuggestion={handleSelectSuggestion}
              />
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </div>
  );
});

HeaderSearch.displayName = 'HeaderSearch';

HeaderSearch.propTypes = {
  /** Chế độ compact dành cho tablet (icon trigger mở popover) */
  compact: PropTypes.bool,
};

export default HeaderSearch;