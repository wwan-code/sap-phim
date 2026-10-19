/**
 * @file ScheduleModal.jsx
 * @module Admin/Modules/Calendar/Components/ScheduleModal
 * @description Modal tạo mới hoặc chỉnh sửa cấu hình lịch phát sóng định kỳ (Dual-Mode: Đơn giản & Nâng cao) chuẩn The Aesthetic OS.
 * Tái sử dụng các component Design System: TextField, Select, DatePicker, Switch.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Film,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
} from 'lucide-react';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '@/shared/components/ui/modal/Modal';
import Button from '@/shared/components/ui/button/Button';
import TextField from '@/shared/components/ui/text-field';
import Select from '@/shared/components/ui/select';
import { DatePicker } from '@/shared/components/ui/date-time-picker';
import Switch from '@/shared/components/ui/switch';
import movieService from '@/shared/services/movie.service';
import './schedule-modal.scss';

const DAY_OPTIONS = [
  { dow: 1, label: 'Thứ 2', short: 'T2' },
  { dow: 2, label: 'Thứ 3', short: 'T3' },
  { dow: 3, label: 'Thứ 4', short: 'T4' },
  { dow: 4, label: 'Thứ 5', short: 'T5' },
  { dow: 5, label: 'Thứ 6', short: 'T6' },
  { dow: 6, label: 'Thứ 7', short: 'T7' },
  { dow: 0, label: 'Chủ Nhật', short: 'CN' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang phát hành (Active)' },
  { value: 'hiatus', label: 'Tạm ngưng (Hiatus)' },
  { value: 'ended', label: 'Đã kết thúc (Ended)' },
  { value: 'inactive', label: 'Tạm ẩn (Inactive)' },
];

const RULE_TYPE_OPTIONS = [
  { value: 'weekly', label: 'Hàng tuần' },
  { value: 'daily', label: 'Hàng ngày' },
];

/**
 * @component ScheduleModal
 * @description Hộp thoại cấu hình lịch phát sóng cho phim/anime
 * @param {Object} props
 * @param {boolean} props.isOpen - Trạng thái hiển thị modal
 * @param {Object|null} props.initialSchedule - Cấu hình lịch hiện tại nếu là chế độ sửa
 * @param {Function} props.onClose - Hàm đóng modal
 * @param {Function} props.onSave - Hàm submit dữ liệu { movieId, payload }
 * @param {boolean} props.loading - Trạng thái đang lưu API
 */
export const ScheduleModal = ({
  isOpen,
  initialSchedule = null,
  onClose,
  onSave,
  loading = false,
}) => {
  const isEditMode = Boolean(initialSchedule?.movie_id);

  // Mode: 'simple' | 'advanced'
  const [mode, setMode] = useState('simple');

  // Movie search & selection
  const [movieSearch, setMovieSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);

  // Common Fields
  const [status, setStatus] = useState('active');
  const [autoPublish, setAutoPublish] = useState(true);
  const [anchorDate, setAnchorDate] = useState('');
  const [notes, setNotes] = useState('');

  // Simple Mode Fields
  const [selectedDays, setSelectedDays] = useState([1]); // Default Thứ 2
  const [simpleTime, setSimpleTime] = useState('20:00');

  // Advanced Mode Fields: danh sách rules
  const [advancedRules, setAdvancedRules] = useState([
    {
      type: 'weekly',
      day_of_week: 1,
      release_time: '20:00',
      rrule_string: '',
      description: 'Phát sóng Thứ 2 lúc 20:00',
    },
  ]);

  // Form error message
  const [formError, setFormError] = useState('');

  // Khi modal mở lên, load dữ liệu ban đầu
  useEffect(() => {
    if (!isOpen) {
      setFormError('');
      setMovieSearch('');
      setSearchResults([]);
      return;
    }

    if (initialSchedule) {
      setSelectedMovie(initialSchedule.movie || { id: initialSchedule.movie_id });
      setStatus(initialSchedule.status || 'active');
      setAutoPublish(initialSchedule.auto_publish ?? true);
      setNotes(initialSchedule.notes || '');

      if (initialSchedule.anchor_date) {
        const d = new Date(initialSchedule.anchor_date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setAnchorDate(`${yyyy}-${mm}-${dd}`);
      } else {
        setAnchorDate('');
      }

      const rules = initialSchedule.rules || [];
      if (rules.length > 0) {
        const days = rules
          .filter((r) => r.day_of_week !== null && r.day_of_week !== undefined)
          .map((r) => r.day_of_week);
        if (days.length > 0) {
          setSelectedDays(days);
        }

        const firstTime = rules[0]?.release_time?.substring(0, 5) || '20:00';
        setSimpleTime(firstTime);

        setAdvancedRules(
          rules.map((r) => ({
            id: r.id,
            type: r.type || 'weekly',
            day_of_week: r.day_of_week ?? 1,
            release_time: r.release_time?.substring(0, 5) || '20:00',
            rrule_string: r.rrule_string || '',
            description: r.description || '',
          }))
        );

        if (rules.length > 1 || rules.some((r) => r.rrule_string)) {
          setMode('advanced');
        } else {
          setMode('simple');
        }
      }
    } else {
      // Reset form cho chế độ tạo mới
      setSelectedMovie(null);
      setStatus('active');
      setAutoPublish(true);
      setNotes('');
      setMode('simple');
      setSelectedDays([1]);
      setSimpleTime('20:00');

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setAnchorDate(`${yyyy}-${mm}-${dd}`);

      setAdvancedRules([
        {
          type: 'weekly',
          day_of_week: 1,
          release_time: '20:00',
          rrule_string: '',
          description: 'Phát sóng Thứ 2 lúc 20:00',
        },
      ]);
    }
  }, [isOpen, initialSchedule]);

  // Tìm kiếm phim với debounce
  useEffect(() => {
    if (!movieSearch.trim() || isEditMode) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await movieService.getAll({
          search: movieSearch.trim(),
          limit: 6,
        });
        const items = Array.isArray(result) ? result : result?.items || [];
        setSearchResults(items);
      } catch (err) {
        console.error('[ScheduleModal] Lỗi tìm kiếm phim:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [movieSearch, isEditMode]);

  // Toggle ngày trong Simple Mode
  const handleToggleDay = (dow) => {
    if (selectedDays.includes(dow)) {
      if (selectedDays.length === 1) {
        return; // Ít nhất phải chọn 1 ngày
      }
      setSelectedDays(selectedDays.filter((d) => d !== dow));
    } else {
      setSelectedDays([...selectedDays, dow].sort());
    }
  };

  // Thêm rule trong Advanced Mode
  const handleAddAdvancedRule = () => {
    setAdvancedRules([
      ...advancedRules,
      {
        type: 'weekly',
        day_of_week: 1,
        release_time: '20:00',
        rrule_string: '',
        description: '',
      },
    ]);
  };

  // Xóa rule trong Advanced Mode
  const handleRemoveAdvancedRule = (index) => {
    if (advancedRules.length <= 1) return;
    setAdvancedRules(advancedRules.filter((_, i) => i !== index));
  };

  // Cập nhật rule trong Advanced Mode
  const handleUpdateAdvancedRule = (index, field, value) => {
    setAdvancedRules(
      advancedRules.map((rule, i) => {
        if (i !== index) return rule;
        return { ...rule, [field]: value };
      })
    );
  };

  // Xử lý lưu
  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    const targetMovieId = selectedMovie?.id || initialSchedule?.movie_id;
    if (!targetMovieId) {
      setFormError('Vui lòng chọn tác phẩm cần lên lịch phát sóng.');
      return;
    }

    let compiledRules = [];

    if (mode === 'simple') {
      if (selectedDays.length === 0) {
        setFormError('Vui lòng chọn ít nhất 1 ngày phát sóng trong tuần.');
        return;
      }
      if (!simpleTime) {
        setFormError('Vui lòng nhập khung giờ phát sóng (VD: 20:00).');
        return;
      }

      compiledRules = selectedDays.map((dow) => {
        const dayLabel = DAY_OPTIONS.find((d) => d.dow === dow)?.label || `Thứ ${dow + 1}`;
        return {
          type: 'weekly',
          day_of_week: dow,
          release_time: `${simpleTime}:00`,
          description: `Phát sóng ${dayLabel} hàng tuần lúc ${simpleTime}`,
        };
      });
    } else {
      if (advancedRules.length === 0) {
        setFormError('Vui lòng tạo ít nhất 1 quy tắc phát sóng.');
        return;
      }

      compiledRules = advancedRules.map((rule) => ({
        type: rule.type || 'weekly',
        day_of_week: Number(rule.day_of_week),
        release_time: rule.release_time ? `${rule.release_time}:00` : null,
        rrule_string: rule.rrule_string ? rule.rrule_string.trim() : null,
        description: rule.description?.trim() || null,
      }));
    }

    const payload = {
      timezone: 'Asia/Ho_Chi_Minh',
      status,
      auto_publish: autoPublish,
      notes: notes.trim() || null,
      anchor_date: anchorDate ? new Date(anchorDate).toISOString() : null,
      rules: compiledRules,
    };

    onSave({ movieId: targetMovieId, payload });
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="medium"
      variant="elevated"
      className="schedule-modal"
    >
      <ModalHeader showCloseButton onClose={onClose}>
        <div className="schedule-modal__header-content">
          <div className="schedule-modal__icon-badge">
            <Calendar size={20} />
          </div>
          <div className="schedule-modal__title-group">
            <h3 className="schedule-modal__title">
              {isEditMode ? 'Chỉnh Sửa Lịch Phát Sóng' : 'Thêm Lịch Phát Sóng Mới'}
            </h3>
            <p className="schedule-modal__subtitle">
              Cấu hình khung giờ và chu kỳ phát hành tập tự động cho anime hoặc phim bộ
            </p>
          </div>
        </div>
      </ModalHeader>

      <form onSubmit={handleSubmit} className="schedule-modal__form">
        <ModalBody>
          <div className="schedule-modal__body-stack">
            {/* Lỗi xác thực nếu có */}
            {formError && (
              <div className="schedule-modal__alert" role="alert">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {/* Chọn phim */}
            <div className="schedule-modal__section">
              <label className="schedule-modal__label">
                Tác phẩm <span className="schedule-modal__required">*</span>
              </label>

              {selectedMovie ? (
                <div className="schedule-modal__selected-movie">
                  {selectedMovie.images?.poster?.url || selectedMovie.images?.thumbnail?.url ? (
                    <img
                      src={selectedMovie.images?.poster?.url || selectedMovie.images?.thumbnail?.url}
                      alt={selectedMovie.title || selectedMovie.slug}
                      className="schedule-modal__movie-thumb"
                    />
                  ) : (
                    <div className="schedule-modal__movie-thumb schedule-modal__movie-thumb--empty">
                      <Film size={18} />
                    </div>
                  )}

                  <div className="schedule-modal__selected-movie-info">
                    <span className="schedule-modal__movie-name">
                      {selectedMovie.titles?.[0]?.title || selectedMovie.title || selectedMovie.slug || 'Tác phẩm'}
                    </span>
                    <span className="schedule-modal__movie-slug">{selectedMovie.slug}</span>
                  </div>

                  {!isEditMode && (
                    <button
                      type="button"
                      className="schedule-modal__change-btn"
                      onClick={() => {
                        setSelectedMovie(null);
                        setMovieSearch('');
                      }}
                    >
                      Đổi phim
                    </button>
                  )}
                </div>
              ) : (
                <div className="schedule-modal__search-box">
                  <TextField
                    fullWidth
                    placeholder="Tìm kiếm tác phẩm theo tên hoặc slug..."
                    value={movieSearch}
                    onChange={(e) => setMovieSearch(e.target.value)}
                    clearable
                    onClear={() => setMovieSearch('')}
                    InputProps={{
                      startAdornment: <Search size={16} />,
                    }}
                  />

                  {/* Kết quả tìm kiếm */}
                  {searchResults.length > 0 && (
                    <div className="schedule-modal__search-dropdown">
                      {searchResults.map((item) => {
                        const title = item.titles?.[0]?.title || item.title || item.slug;
                        const posterUrl = item.images?.poster?.url || item.images?.thumbnail?.url;
                        return (
                          <div
                            key={item.id}
                            className="schedule-modal__search-item"
                            onClick={() => {
                              setSelectedMovie(item);
                              setSearchResults([]);
                              setMovieSearch('');
                            }}
                          >
                            {posterUrl ? (
                              <img src={posterUrl} alt={title} className="schedule-modal__item-thumb" />
                            ) : (
                              <div className="schedule-modal__item-thumb schedule-modal__item-thumb--empty">
                                <Film size={14} />
                              </div>
                            )}
                            <div className="schedule-modal__item-meta">
                              <span className="schedule-modal__item-title">{title}</span>
                              <span className="schedule-modal__item-slug">{item.slug}</span>
                            </div>
                            <Check size={16} className="schedule-modal__item-check" />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isSearching && (
                    <p className="schedule-modal__search-hint">Đang tìm kiếm tác phẩm...</p>
                  )}
                </div>
              )}
            </div>

            {/* Chuyển đổi Chế độ (Mode Switcher) */}
            <div className="schedule-modal__mode-toggle">
              <button
                type="button"
                className={`schedule-modal__mode-btn ${
                  mode === 'simple' ? 'schedule-modal__mode-btn--active' : ''
                }`}
                onClick={() => setMode('simple')}
              >
                <Clock size={14} />
                <span>Thiết lập Đơn giản</span>
              </button>

              <button
                type="button"
                className={`schedule-modal__mode-btn ${
                  mode === 'advanced' ? 'schedule-modal__mode-btn--active' : ''
                }`}
                onClick={() => setMode('advanced')}
              >
                <Sliders size={14} />
                <span>Nâng cao (Đa quy tắc)</span>
              </button>
            </div>

            {/* SIMPLE MODE CONTENT */}
            {mode === 'simple' && (
              <div className="schedule-modal__simple-panel">
                <div className="schedule-modal__field-group">
                  <label className="schedule-modal__label">
                    Ngày phát sóng trong tuần <span className="schedule-modal__required">*</span>
                  </label>
                  <div className="schedule-modal__day-selector">
                    {DAY_OPTIONS.map((day) => {
                      const isSelected = selectedDays.includes(day.dow);
                      return (
                        <button
                          key={day.dow}
                          type="button"
                          className={`schedule-modal__day-pill ${
                            isSelected ? 'schedule-modal__day-pill--selected' : ''
                          }`}
                          onClick={() => handleToggleDay(day.dow)}
                        >
                          <span className="schedule-modal__day-short">{day.short}</span>
                          <span className="schedule-modal__day-full">{day.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="schedule-modal__hint">
                    Có thể chọn một hoặc nhiều ngày trong tuần (ví dụ: Thứ 2 & Thứ 6).
                  </p>
                </div>

                <div className="schedule-modal__field-group">
                  <TextField
                    type="time"
                    label="Khung giờ phát sóng"
                    value={simpleTime}
                    onChange={(e) => setSimpleTime(e.target.value)}
                    required
                    size="medium"
                    InputProps={{
                      startAdornment: <Clock size={16} />,
                    }}
                    helperText="Định dạng 24 giờ (VD: 20:00)"
                  />
                </div>
              </div>
            )}

            {/* ADVANCED MODE CONTENT */}
            {mode === 'advanced' && (
              <div className="schedule-modal__advanced-panel">
                <div className="schedule-modal__rules-header">
                  <span className="schedule-modal__label">Danh sách quy tắc phát sóng</span>
                  <Button
                    type="button"
                    variant="tonal"
                    size="small"
                    startIcon={<Plus size={14} />}
                    onClick={handleAddAdvancedRule}
                  >
                    Thêm quy tắc
                  </Button>
                </div>

                <div className="schedule-modal__rules-list">
                  {advancedRules.map((rule, idx) => (
                    <div key={idx} className="schedule-modal__rule-item">
                      <div className="schedule-modal__rule-row">
                        {/* Day of Week */}
                        <div className="schedule-modal__rule-field">
                          <Select
                            label="Thứ trong tuần"
                            value={rule.day_of_week}
                            onChange={(e) =>
                              handleUpdateAdvancedRule(idx, 'day_of_week', Number(e.target.value))
                            }
                            size="small"
                            options={DAY_OPTIONS.map((d) => ({ value: d.dow, label: d.label }))}
                          />
                        </div>

                        {/* Time */}
                        <div className="schedule-modal__rule-field">
                          <TextField
                            type="time"
                            label="Giờ phát"
                            value={rule.release_time}
                            onChange={(e) =>
                              handleUpdateAdvancedRule(idx, 'release_time', e.target.value)}
                            size="small"
                          />
                        </div>

                        {/* Type */}
                        <div className="schedule-modal__rule-field">
                          <Select
                            label="Chu kỳ"
                            value={rule.type}
                            onChange={(e) =>
                              handleUpdateAdvancedRule(idx, 'type', e.target.value)}
                            size="small"
                            options={RULE_TYPE_OPTIONS}
                          />
                        </div>

                        {/* Delete button */}
                        {advancedRules.length > 1 && (
                          <button
                            type="button"
                            className="schedule-modal__rule-delete"
                            onClick={() => handleRemoveAdvancedRule(idx)}
                            title="Xóa quy tắc này"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {/* Description / Custom RRULE */}
                      <div className="schedule-modal__rule-desc">
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Mô tả quy tắc (VD: Chiếu phụ đề lúc 20h)"
                          value={rule.description}
                          onChange={(e) =>
                            handleUpdateAdvancedRule(idx, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COMMON FIELDS: ANCHOR DATE, AUTO PUBLISH, STATUS */}
            <div className="schedule-modal__meta-grid">
              <div className="schedule-modal__field-group">
                <DatePicker
                  label="Ngày mốc phát sóng (Anchor Date)"
                  value={anchorDate ? new Date(anchorDate) : null}
                  onChange={(newDate) => {
                    if (newDate && !isNaN(newDate.getTime())) {
                      const yyyy = newDate.getFullYear();
                      const mm = String(newDate.getMonth() + 1).padStart(2, '0');
                      const dd = String(newDate.getDate()).padStart(2, '0');
                      setAnchorDate(`${yyyy}-${mm}-${dd}`);
                    } else {
                      setAnchorDate('');
                    }
                  }}
                  helperText="Mốc thời gian bắt đầu tính toán các tập"
                  fullWidth
                  size="medium"
                />
              </div>

              <div className="schedule-modal__field-group">
                <Select
                  label="Trạng thái lịch"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  fullWidth
                  size="medium"
                  options={STATUS_OPTIONS}
                />
              </div>
            </div>

            {/* TỰ ĐỘNG PHÁT HÀNH (AUTO PUBLISH) SỬ DỤNG SWITCH COMPONENT */}
            <div className="schedule-modal__switch-wrapper">
              <Switch
                checked={autoPublish}
                onChange={(e, checked) => setAutoPublish(checked)}
                label="Tự động công khai tập phim khi tới giờ"
                description="Hệ thống BullMQ Worker sẽ tự động chuyển trạng thái tập thành đã phát hành."
                color="primary"
              />
            </div>

            {/* GHI CHÚ NỘI BỘ (TEXTFIELD MULTILINE) */}
            <div className="schedule-modal__field-group">
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Ghi chú vận hành"
                placeholder="Ghi chú nội bộ cho ban biên tập (ví dụ: Nguồn phát bản quyền Muse VN)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </ModalBody>

        <ModalFooter align="end">
          <Button type="button" variant="tonal" onClick={onClose} disabled={loading}>
            Hủy bỏ
          </Button>

          <Button
            type="submit"
            variant="filled"
            startIcon={<CheckCircle2 size={16} />}
            loading={loading}
          >
            {isEditMode ? 'Cập Nhật Lịch Chiếu' : 'Lưu Lịch Chiếu Mới'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default ScheduleModal;
