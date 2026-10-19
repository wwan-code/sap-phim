/**
 * @file DigitalClock.jsx
 * @module Components/UI/DateTimePicker/Components/DigitalClock
 * @component DigitalClock
 * @description Component chọn giờ số (Digital Clock) với cuộn Neural Expressive mượt mà.
 */

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { useTimePicker } from '../hooks/use-time-picker';
import '../digital-clock.scss';

/**
 * @component DigitalClock
 * @description Thành phần chọn giờ theo phong cách đồng hồ số (Digital Clock). Tự động cuộn Neural Expressive & hỗ trợ cuộn từng nấc chuẩn xác.
 */
const DigitalClock = (props) => {
  const {
    ampm = false,
    disableFuture,
    disablePast,
    maxDate,
    maxDateTime,
    maxTime,
    minDate,
    minDateTime,
    minTime,
    onChange,
    shouldDisableTime,
    value,
  } = props;

  const timePicker = useTimePicker({
    value,
    onChange,
    ampm,
    minTime,
    maxTime,
    shouldDisableTime,
    disablePast,
    disableFuture,
    minDateTime: minDateTime || minDate,
    maxDateTime: maxDateTime || maxDate,
  });

  const hours24 = Array.from({ length: 24 }, (_, i) => i);
  const hours12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const meridiem = ['AM', 'PM'];

  const hoursList = ampm ? hours12 : hours24;

  const hoursRef = useRef(null);
  const minutesRef = useRef(null);
  const ampmRef = useRef(null);

  /**
   * Tự động cuộn phần tử được chọn vào giữa danh sách
   */
  const scrollToCenter = (containerRef, selector) => {
    if (!containerRef.current) return;
    const active = containerRef.current.querySelector(selector);
    if (active) {
      containerRef.current.scrollTo({
        top: active.offsetTop - containerRef.current.offsetHeight / 2 + active.offsetHeight / 2,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    scrollToCenter(hoursRef, '.digital-clock__item--selected');
    scrollToCenter(minutesRef, '.digital-clock__item--selected');
    if (ampm) {
      scrollToCenter(ampmRef, '.digital-clock__item--selected');
    }
  }, [timePicker.selectedHour24, timePicker.selectedMinute, timePicker.selectedAmPm, ampm]);

  /**
   * Hook xử lý sự kiện cuộn (Wheel & Touch Scroll) giới hạn từng nấc chính xác
   */
  const useColumnScrollEffect = (containerRef, items, selectedValue, onSelect, type) => {
    const selectedValueRef = useRef(selectedValue);
    selectedValueRef.current = selectedValue;

    const itemsRef = useRef(items);
    itemsRef.current = items;

    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let lastWheelTime = 0;
      let scrollTimeout = null;

      // Xử lý cuộn con chuột (Wheel) - từng đơn vị một
      const handleWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const now = Date.now();
        if (now - lastWheelTime < 70) return; // Throttle 70ms cho mỗi nấc cuộn
        lastWheelTime = now;

        const curItems = itemsRef.current;
        const curVal = selectedValueRef.current;
        const currentIndex = curItems.indexOf(curVal);

        if (currentIndex === -1) return;

        let nextIndex = currentIndex;
        if (e.deltaY > 0) {
          nextIndex = Math.min(curItems.length - 1, currentIndex + 1);
        } else if (e.deltaY < 0) {
          nextIndex = Math.max(0, currentIndex - 1);
        }

        if (nextIndex !== currentIndex) {
          const nextItem = curItems[nextIndex];
          if (type !== 'ampm' && timePicker.isTimeDisabled(type, nextItem)) {
            return;
          }
          onSelectRef.current(nextItem);
        }
      };

      // Xử lý cuộn cảm ứng/vẫn tay (Touch / Manual Scroll Snap)
      const handleScroll = () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          const curItems = itemsRef.current;
          const curVal = selectedValueRef.current;
          const itemEl = container.querySelector('.digital-clock__item');
          const itemHeight = itemEl ? itemEl.offsetHeight : 40;
          const index = Math.round(container.scrollTop / itemHeight);
          const clampedIndex = Math.max(0, Math.min(curItems.length - 1, index));
          const targetItem = curItems[clampedIndex];

          if (targetItem !== undefined && targetItem !== curVal) {
            if (type !== 'ampm' && timePicker.isTimeDisabled(type, targetItem)) {
              return;
            }
            onSelectRef.current(targetItem);
          }
        }, 100);
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      container.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimeout) clearTimeout(scrollTimeout);
      };
    }, [containerRef, type]);
  };

  useColumnScrollEffect(
    hoursRef,
    hoursList,
    timePicker.currentHourDisplay,
    timePicker.handleHourSelect,
    'hour'
  );
  useColumnScrollEffect(
    minutesRef,
    minutes,
    timePicker.selectedMinute,
    timePicker.handleMinuteSelect,
    'minute'
  );
  if (ampm) {
    useColumnScrollEffect(
      ampmRef,
      meridiem,
      timePicker.selectedAmPm,
      timePicker.handleAmPmSelect,
      'ampm'
    );
  }

  /**
   * Render một cột danh sách (Giờ/Phút/AM-PM)
   */
  const renderList = (items, selectedValue, onSelect, type, ref) => (
    <div className="digital-clock__column" ref={ref} role="listbox">
      <div className="digital-clock__spacer" aria-hidden="true" />
      {items.map((item) => {
        const disabled = type !== 'ampm' ? timePicker.isTimeDisabled(type, item) : false;
        const selected = item === selectedValue;
        return (
          <button
            key={item}
            disabled={disabled}
            onClick={() => onSelect(item)}
            className={classNames('digital-clock__item', {
              'digital-clock__item--selected': selected,
              'digital-clock__item--disabled': disabled,
            })}
            aria-selected={selected}
            type="button"
            role="option"
          >
            {typeof item === 'number' ? item.toString().padStart(2, '0') : item}
            <span className="digital-clock__item-layer" aria-hidden="true" />
          </button>
        );
      })}
      <div className="digital-clock__spacer" aria-hidden="true" />
    </div>
  );

  return (
    <div className="digital-clock" aria-label="Bộ chọn giờ">
      {renderList(
        hoursList,
        timePicker.currentHourDisplay,
        timePicker.handleHourSelect,
        'hour',
        hoursRef
      )}

      <div className="digital-clock__separator" aria-hidden="true">
        :
      </div>

      {renderList(
        minutes,
        timePicker.selectedMinute,
        timePicker.handleMinuteSelect,
        'minute',
        minutesRef
      )}

      {ampm && (
        <React.Fragment>
          <div className="digital-clock__separator-gap" aria-hidden="true" />
          {renderList(
            meridiem,
            timePicker.selectedAmPm,
            timePicker.handleAmPmSelect,
            'ampm',
            ampmRef
          )}
        </React.Fragment>
      )}

      <div className="digital-clock__highlight-band" aria-hidden="true" />
    </div>
  );
};

DigitalClock.propTypes = {
  /** Sử dụng định dạng 12 giờ (AM/PM) */
  ampm: PropTypes.bool,
  /** Vô hiệu hóa thời gian trong tương lai */
  disableFuture: PropTypes.bool,
  /** Vô hiệu hóa thời gian trong quá khứ */
  disablePast: PropTypes.bool,
  /** Ngày tối đa */
  maxDate: PropTypes.instanceOf(Date),
  /** Ngày giờ tối đa (Dùng cho DateTimePicker) */
  maxDateTime: PropTypes.instanceOf(Date),
  /** Giờ tối đa */
  maxTime: PropTypes.instanceOf(Date),
  /** Ngày tối thiểu */
  minDate: PropTypes.instanceOf(Date),
  /** Ngày giờ tối thiểu (Dùng cho DateTimePicker) */
  minDateTime: PropTypes.instanceOf(Date),
  /** Giờ tối thiểu */
  minTime: PropTypes.instanceOf(Date),
  /** Sự kiện khi thay đổi thời gian */
  onChange: PropTypes.func,
  /** Hàm tùy chỉnh để vô hiệu hóa một thời điểm */
  shouldDisableTime: PropTypes.func,
  /** Giá trị thời gian hiện tại */
  value: PropTypes.instanceOf(Date),
};

export default React.memo(DigitalClock);
