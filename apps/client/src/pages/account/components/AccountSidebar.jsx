/**
 * @file AccountSidebar.jsx
 * @module Pages/Account/Components/AccountSidebar
 * @component AccountSidebar
 * @description Sidebar điều hướng danh mục cài đặt tài khoản (Desktop 2-column) và Swiper Chip Carousel (Mobile/Tablet < 1024px).
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Lock,
  Search,
  ShieldCheck,
  Sliders,
  User,
  X,
} from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';

import 'swiper/css';
import 'swiper/css/free-mode';

import TextField from '@/shared/components/ui/text-field/TextField';
import ButtonBase from '@/shared/components/ui/button-base/ButtonBase';

import './_account-sidebar.scss';

const ICON_MAP = {
  User: User,
  ShieldCheck: ShieldCheck,
  Lock: Lock,
  Sliders: Sliders,
  AlertTriangle: AlertTriangle,
};

/**
 * @component AccountSidebar
 */
export const AccountSidebar = ({
  tabs,
  activeTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
}) => {
  const swiperRef = useRef(null);
  const [showPrevBtn, setShowPrevBtn] = useState(false);
  const [showNextBtn, setShowNextBtn] = useState(false);

  const handleClearSearch = useCallback(() => {
    onSearchChange('');
  }, [onSearchChange]);

  const updateNavButtons = useCallback((swiper) => {
    if (!swiper) return;
    setShowPrevBtn(!swiper.isBeginning);
    setShowNextBtn(!swiper.isEnd);
  }, []);

  const handlePrev = useCallback(() => {
    if (swiperRef.current) {
      swiperRef.current.slidePrev();
    }
  }, []);

  const handleNext = useCallback(() => {
    if (swiperRef.current) {
      swiperRef.current.slideNext();
    }
  }, []);

  // Tự động cuộn tới tab đang kích hoạt khi thay đổi tab
  useEffect(() => {
    if (swiperRef.current) {
      const activeIndex = tabs.findIndex((t) => t.id === activeTab);
      if (activeIndex !== -1) {
        swiperRef.current.slideTo(activeIndex);
      }
      updateNavButtons(swiperRef.current);
    }
  }, [activeTab, tabs, updateNavButtons]);

  return (
    <aside className="account-sidebar" aria-label="Danh mục cài đặt tài khoản">
      {/* Search Header */}
      <div className="account-sidebar__search-box">
        <TextField
          placeholder="Tìm cài đặt..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          size="small"
          fullWidth
          variant="outlined"
          InputProps={{
            startAdornment: (
              <Search size={16} className="account-sidebar__search-icon" aria-hidden="true" />
            ),
            endAdornment: searchQuery ? (
              <button
                type="button"
                className="account-sidebar__clear-btn"
                onClick={handleClearSearch}
                aria-label="Xóa tìm kiếm"
              >
                <X size={14} />
              </button>
            ) : null,
          }}
        />
      </div>

      {/* 1. Desktop Navigation (>= 1024px) */}
      <nav className="account-sidebar__nav account-sidebar__nav--desktop" role="tablist" aria-orientation="vertical">
        {tabs.map((tab) => {
          const IconComponent = ICON_MAP[tab.icon] || User;
          const isActive = activeTab === tab.id;
          const isDanger = tab.id === 'danger-zone';

          return (
            <ButtonBase
              key={tab.id}
              role="tab"
              id={`account-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`account-panel-${tab.id}`}
              className={classNames('account-sidebar__item', {
                'account-sidebar__item--active': isActive,
                'account-sidebar__item--danger': isDanger,
              })}
              onClick={() => onSelectTab(tab.id)}
            >
              <div className="account-sidebar__item-icon-wrapper" aria-hidden="true">
                <IconComponent size={18} className="account-sidebar__item-icon" />
              </div>

              <div className="account-sidebar__item-content">
                <span className="account-sidebar__item-label">{tab.label}</span>
                <span className="account-sidebar__item-desc">{tab.description}</span>
              </div>

              {isActive && <span className="account-sidebar__active-pill" aria-hidden="true" />}
            </ButtonBase>
          );
        })}
      </nav>

      {/* 2. Mobile & Tablet Swiper Chips Navigation (< 1024px) */}
      <div className="account-sidebar__swiper-wrapper" role="tablist" aria-orientation="horizontal">
        {/* Left Arrow Scrim */}
        <div
          className={classNames('account-sidebar__nav-scrim account-sidebar__nav-scrim--left', {
            'account-sidebar__nav-scrim--visible': showPrevBtn,
          })}
        >
          {showPrevBtn && (
            <button
              type="button"
              className="account-sidebar__nav-btn account-sidebar__nav-btn--prev"
              onClick={handlePrev}
              aria-label="Cuộn sang trái"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* Swiper Slider */}
        <Swiper
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            updateNavButtons(swiper);
          }}
          onSlideChange={(swiper) => updateNavButtons(swiper)}
          onProgress={(swiper) => updateNavButtons(swiper)}
          onTouchEnd={(swiper) => updateNavButtons(swiper)}
          modules={[FreeMode]}
          freeMode={{
            enabled: true,
            sticky: false,
            momentumRatio: 0.7,
          }}
          slidesPerView="auto"
          spaceBetween={8}
          className="account-sidebar__swiper"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDanger = tab.id === 'danger-zone';

            return (
              <SwiperSlide key={tab.id} className="account-sidebar__swiper-slide">
                <button
                  type="button"
                  role="tab"
                  id={`account-tab-mobile-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`account-panel-${tab.id}`}
                  className={classNames('account-sidebar__chip', {
                    'account-sidebar__chip--active': isActive,
                    'account-sidebar__chip--danger': isDanger,
                  })}
                  onClick={() => onSelectTab(tab.id)}
                >
                  <span className="account-sidebar__chip-label">{tab.label}</span>
                </button>
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* Right Arrow Scrim */}
        <div
          className={classNames('account-sidebar__nav-scrim account-sidebar__nav-scrim--right', {
            'account-sidebar__nav-scrim--visible': showNextBtn,
          })}
        >
          {showNextBtn && (
            <button
              type="button"
              className="account-sidebar__nav-btn account-sidebar__nav-btn--next"
              onClick={handleNext}
              aria-label="Cuộn sang phải"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

AccountSidebar.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      description: PropTypes.string,
      icon: PropTypes.string,
    })
  ).isRequired,
  activeTab: PropTypes.string.isRequired,
  onSelectTab: PropTypes.func.isRequired,
  searchQuery: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
};

export default memo(AccountSidebar);
