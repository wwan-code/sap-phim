/**
 * @file CastSection.jsx
 * @module Admin/Modules/Movies/Components/FormSections
 * @description Section: Quản lý Diễn viên & Lồng tiếng (Cast & Crew) chuẩn Material 3 Expressive.
 */

import React, { useState, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { Search, Plus, ArrowUp, ArrowDown, Trash2, Star, Users } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import {
  useFloating,
  offset,
  flip,
  shift,
  size as floatingSize,
  autoUpdate,
  FloatingPortal,
} from '@floating-ui/react';

import { SectionCard } from '@/admin/shared/components/layout/section-card/SectionCard';
import TextField from '@/shared/components/ui/text-field/TextField';
import Button from '@/shared/components/ui/button/Button';
import Avatar from '@/shared/components/ui/avatar/Avatar';
import IconButton from '@/shared/components/ui/icon-button/IconButton';
import Tooltip from '@/shared/components/ui/tooltip/Tooltip';

const CastSection = ({ metadata, isReadOnly }) => {
  const { watch, setValue } = useFormContext();
  const currentCast = watch('actor_cast') || [];

  const [actorSearchQuery, setActorSearchQuery] = useState('');

  const actorsList = metadata?.actors || [];
  
  const filteredActors = useMemo(() => {
    if (!actorSearchQuery.trim()) return [];
    return actorsList
      .filter((a) =>
        a.name.toLowerCase().includes(actorSearchQuery.toLowerCase().trim())
      )
      .slice(0, 8);
  }, [actorsList, actorSearchQuery]);

  const isDropdownOpen = !isReadOnly && Boolean(actorSearchQuery.trim() && filteredActors.length > 0);

  const { x, y, refs, strategy } = useFloating({
    open: isDropdownOpen,
    placement: 'bottom-start',
    strategy: 'fixed',
    whileElementsMounted: (reference, floating, update) =>
      autoUpdate(reference, floating, update, { animationFrame: true }),
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      floatingSize({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: '260px',
          });
        },
      }),
    ],
  });

  const handleAddCastItem = (actor) => {
    if (isReadOnly) return;
    if (!actor) return;
    
    const exists = currentCast.some((c) => c.actor_id === actor.id);
    if (exists) {
      toast.error(`Diễn viên "${actor.name}" đã có trong danh sách.`);
      return;
    }

    const newCastItem = {
      actor_id: actor.id,
      actor_name: actor.name,
      actor_image_url: actor.image_url || '',
      character_name: '',
      role_name: 'Lồng tiếng',
      is_main_cast: currentCast.length === 0, // Mặc định diễn viên đầu tiên là main
      cast_order: currentCast.length,
      notes: '',
    };

    setValue('actor_cast', [...currentCast, newCastItem], {
      shouldValidate: true,
      shouldDirty: true,
    });
    setActorSearchQuery('');
  };

  const handleAddCustomActor = () => {
    if (isReadOnly) return;
    if (!actorSearchQuery.trim()) return;

    const newCastItem = {
      actor_id: null,
      actor_name: actorSearchQuery.trim(),
      actor_image_url: '',
      character_name: '',
      role_name: 'Lồng tiếng',
      is_main_cast: false,
      cast_order: currentCast.length,
      notes: '',
    };

    setValue('actor_cast', [...currentCast, newCastItem], {
      shouldValidate: true,
      shouldDirty: true,
    });
    setActorSearchQuery('');
  };

  const handleRemoveCastItem = (index) => {
    if (isReadOnly) return;
    const next = currentCast
      .filter((_, i) => i !== index)
      .map((item, idx) => ({ ...item, cast_order: idx }));
    setValue('actor_cast', next, { shouldValidate: true, shouldDirty: true });
  };

  const handleUpdateCastField = (index, field, value) => {
    if (isReadOnly) return;
    const next = [...currentCast];
    next[index] = { ...next[index], [field]: value };
    setValue('actor_cast', next, { shouldValidate: true, shouldDirty: true });
  };

  const handleMoveCastItem = (index, direction) => {
    if (isReadOnly) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentCast.length) return;

    const next = [...currentCast];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    // Cập nhật lại cast_order
    next.forEach((item, idx) => {
      item.cast_order = idx;
    });

    setValue('actor_cast', next, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <SectionCard
      title="4. Quản Lý Diễn Viên & Lồng Tiếng (Cast & Crew)"
      subtitle="Gán diễn viên, vai diễn nhân vật và thiết lập thứ tự hiển thị trên website."
      extra={
        <span className="sp-movie-page__tab-badge">
          {currentCast.length} diễn viên
        </span>
      }
    >
      <div className="sp-movie-form__cast-section">
        {/* Autocomplete Search Bar */}
        {!isReadOnly && (
          <div className="sp-movie-form__cast-search-row">
            <div ref={refs.setReference} className="sp-movie-form__cast-search-container">
              <TextField
                value={actorSearchQuery}
                onChange={(e) => setActorSearchQuery(e.target.value)}
                placeholder="Tìm kiếm diễn viên trong hệ thống..."
                InputProps={{ startAdornment: <Search size={16} /> }}
              />
            </div>

            {actorSearchQuery.trim() && filteredActors.length === 0 && (
              <Button
                type="button"
                variant="tonal"
                startIcon={<Plus size={16} />}
                onClick={handleAddCustomActor}
              >
                {`Thêm vai cho "${actorSearchQuery.trim()}"`}
              </Button>
            )}
          </div>
        )}

        {/* Floating Dropdown */}
        {isDropdownOpen && (
          <FloatingPortal>
            <div
              ref={refs.setFloating}
              style={{
                position: strategy,
                top: y ?? 0,
                left: x ?? 0,
                zIndex: 1300,
              }}
              className="sp-movie-form__cast-popover"
            >
              {filteredActors.map((actor) => (
                <div
                  key={actor.id}
                  className="sp-movie-form__cast-popover-item"
                  onMouseDown={() => handleAddCastItem(actor)}
                >
                  <Avatar
                    size="sm"
                    name={actor.name}
                    src={actor.image_url}
                  />
                  <div className="sp-movie-form__cast-popover-info">
                    <span className="sp-movie-form__cast-popover-name">
                      {actor.name}
                    </span>
                    {actor.original_name && (
                      <span className="sp-movie-form__cast-popover-sub">
                        {actor.original_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </FloatingPortal>
        )}

        {/* Modern Cast List */}
        <div className="sp-movie-form__cast-list">
          {currentCast.length === 0 ? (
            <div className="sp-movie-form__cast-empty">
              <Users size={32} className="sp-movie-form__cast-empty-icon" />
              <p className="sp-movie-form__cast-empty-title">Chưa có diễn viên nào trong danh sách</p>
              <p className="sp-movie-form__cast-empty-desc">
                Hãy tìm kiếm và thêm diễn viên hoặc lồng tiếng ở thanh tìm kiếm phía trên.
              </p>
            </div>
          ) : (
            currentCast.map((castItem, index) => {
              const isMain = Boolean(castItem.is_main_cast);

              return (
                <div
                  key={castItem.actor_id || `cast-${index}`}
                  className={`sp-movie-form__cast-row ${isMain ? 'sp-movie-form__cast-row--main' : ''}`}
                >
                  {/* Cột 1: Thứ tự + Diễn viên info */}
                  <div className="sp-movie-form__cast-actor-block">
                    <span className="sp-movie-form__cast-index">#{index + 1}</span>
                    <Avatar
                      size="sm"
                      name={castItem.actor_name}
                      src={castItem.actor_image_url}
                    />
                    <div className="sp-movie-form__cast-actor-meta">
                      <span className="sp-movie-form__cast-actor-name">{castItem.actor_name}</span>
                      {isMain && (
                        <span className="sp-movie-form__cast-main-badge">
                          <Star size={10} fill="currentColor" /> Vai chính
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cột 2: Ô nhập nhân vật & vai trò */}
                  <div className="sp-movie-form__cast-inputs-block">
                    <div className="sp-movie-form__cast-input-field">
                      <label className="sp-movie-form__cast-input-label">Tên nhân vật</label>
                      <input
                        type="text"
                        className="sp-movie-form__cast-inline-input"
                        value={castItem.character_name || ''}
                        onChange={(e) =>
                          handleUpdateCastField(index, 'character_name', e.target.value)
                        }
                        placeholder="VD: Sung Jin-Woo"
                        disabled={isReadOnly}
                      />
                    </div>

                    <div className="sp-movie-form__cast-input-field">
                      <label className="sp-movie-form__cast-input-label">Vai trò</label>
                      <input
                        type="text"
                        className="sp-movie-form__cast-inline-input"
                        value={castItem.role_name || 'Lồng tiếng'}
                        onChange={(e) =>
                          handleUpdateCastField(index, 'role_name', e.target.value)
                        }
                        placeholder="VD: Lồng tiếng chính"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>

                  {/* Cột 3: Nút Star Vai Chính + Actions */}
                  <div className="sp-movie-form__cast-actions-block">
                    <Tooltip
                      title={isMain ? "Bỏ đánh dấu vai chính" : "Đánh dấu là vai chính"}
                      placement="top"
                      arrow
                    >
                      <button
                        type="button"
                        className={`sp-movie-form__cast-star-btn ${isMain ? 'sp-movie-form__cast-star-btn--active' : ''}`}
                        onClick={() => handleUpdateCastField(index, 'is_main_cast', !isMain)}
                        disabled={isReadOnly}
                        aria-label="Đánh dấu vai chính"
                      >
                        <Star size={16} fill={isMain ? "currentColor" : "none"} />
                      </button>
                    </Tooltip>

                    {!isReadOnly && (
                      <div className="sp-movie-form__cast-reorder-group">
                        <Tooltip title="Đẩy lên trên" placement="top" arrow>
                          <IconButton
                            size="small"
                            variant="standard"
                            disabled={index === 0}
                            onClick={() => handleMoveCastItem(index, -1)}
                            aria-label="Đẩy lên trên"
                          >
                            <ArrowUp size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Đẩy xuống dưới" placement="top" arrow>
                          <IconButton
                            size="small"
                            variant="standard"
                            disabled={index === currentCast.length - 1}
                            onClick={() => handleMoveCastItem(index, 1)}
                            aria-label="Đẩy xuống dưới"
                          >
                            <ArrowDown size={14} />
                          </IconButton>
                        </Tooltip>
                      </div>
                    )}

                    {!isReadOnly && (
                      <Tooltip title="Xóa vai diễn" placement="top" arrow>
                        <IconButton
                          size="small"
                          variant="standard"
                          color="danger"
                          onClick={() => handleRemoveCastItem(index)}
                          aria-label="Xóa vai diễn"
                          className="sp-movie-form__cast-delete-btn"
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </SectionCard>
  );
};

CastSection.propTypes = {
  metadata: PropTypes.object,
  isReadOnly: PropTypes.bool,
};

export default memo(CastSection);
