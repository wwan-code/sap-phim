/**
 * @file AIFieldValue.jsx
 * @module Admin/Movies/Components
 * @description Rich semantic rendering for review fields (Titles chips, Actor badges, Genre tags, etc.).
 */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { User } from 'lucide-react';

import { TITLE_LABELS } from '../../utils/ai-review.util';
import { isSuggestionFieldEmpty } from '../../mappers/ai-suggestion.mapper';

/**
 * Hiển thị giá trị trường dưới dạng Chip/Badge trực quan hoặc text thuần
 */
const AIFieldValue = ({ fieldKey, rawValue, labelValue, metadata = {}, isProposed = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. Kiểm tra trường trống
  if (isSuggestionFieldEmpty(rawValue, fieldKey) && isSuggestionFieldEmpty(labelValue, fieldKey)) {
    return <span className="sp-ai-drawer__empty-val">Chưa có</span>;
  }

  if (fieldKey === 'studio_candidate') return <span>{rawValue?.name || 'Chưa có'}{rawValue?.entity_key && <small> · sẽ tạo khi lưu phim</small>}</span>;

  // 2. Render Tiêu đề đa ngôn ngữ (Titles)
  if (fieldKey === 'titles') {
    const list = Array.isArray(rawValue) ? rawValue.filter((item) => Boolean(item?.title?.trim())) : [];
    if (!list.length) {
      return <span className="sp-ai-drawer__empty-val">Chưa có</span>;
    }

    const limit = 4;
    const hasMore = list.length > limit;
    const visibleList = isExpanded || !hasMore ? list : list.slice(0, limit);

    return (
      <div className="sp-ai-drawer__chips">
        {visibleList.map((item, index) => {
          const isPrimary = item.type === 'default';
          const typeLabel = TITLE_LABELS[item.type] || item.type;
          return (
            <span
              key={index}
              className={`sp-ai-drawer__chip sp-ai-drawer__chip--title ${isPrimary ? 'sp-ai-drawer__chip--primary' : ''}`}
            >
              <span className="sp-ai-drawer__chip-tag">{typeLabel}</span>
              <span className="sp-ai-drawer__chip-text">{item.title.trim()}</span>
            </span>
          );
        })}
        {hasMore && (
          <button
            type="button"
            className="sp-ai-drawer__chip sp-ai-drawer__chip--more"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? 'Thu gọn' : `+${list.length - limit} khác`}
          </button>
        )}
      </div>
    );
  }

  // 3. Render Diễn viên và Nhân vật (Actor Cast)
  if (fieldKey === 'actor_cast') {
    const rawList = Array.isArray(rawValue) ? rawValue.filter((item) => Boolean(item?.actor_name || item?.name || item?.actor_id)) : [];
    if (!rawList.length) {
      return <span className="sp-ai-drawer__empty-val">Chưa có</span>;
    }

    // Khử trùng lặp diễn viên / nhân vật và làm sạch hậu tố (voice)
    const seenChars = new Set();
    const seenNames = new Set();
    const list = rawList.filter((item) => {
      const name = (item.actor_name || item.name || metadata.actors?.find((a) => String(a.id) === String(item.actor_id))?.name || '').trim();
      const rawChar = (item.character_name || item.character || '').replace(/\s*\((voice|lồng tiếng)\)/gi, '').trim();
      const normName = item.entity_key || item.actor_id || name.toLowerCase();
      const normChar = rawChar.toLowerCase();

      if (normName && seenNames.has(normName)) return false;

      if (normName) seenNames.add(normName);
      if (normChar) seenChars.add(normChar);
      return true;
    });

    const limit = 4;
    const hasMore = list.length > limit;
    const visibleList = isExpanded || !hasMore ? list : list.slice(0, limit);

    return (
      <div className="sp-ai-drawer__chips">
        {visibleList.map((item, index) => {
          const name = item.actor_name || item.name || metadata.actors?.find((a) => String(a.id) === String(item.actor_id))?.name || `ID ${item.actor_id}`;
          const character = (item.character_name || item.character || '').replace(/\s*\((voice|lồng tiếng)\)/gi, '').trim();
          const imageUrl = item.actor_image_url || item.image_url;
          return (
            <span key={index} className="sp-ai-drawer__chip sp-ai-drawer__chip--actor">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="sp-ai-drawer__chip-avatar" />
              ) : (
                <span className="sp-ai-drawer__chip-avatar-placeholder" aria-hidden="true">
                  <User size={11} />
                </span>
              )}
              <span className="sp-ai-drawer__chip-text">{name}</span>
              {isProposed && item.entity_key && !item.actor_id && <small>Sẽ tạo khi lưu</small>}
              {character && <span className="sp-ai-drawer__chip-sub">({character})</span>}
            </span>
          );
        })}
        {hasMore && (
          <button
            type="button"
            className="sp-ai-drawer__chip sp-ai-drawer__chip--more"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? 'Thu gọn' : `+${list.length - limit} khác`}
          </button>
        )}
      </div>
    );
  }

  // 4. Render Thể loại (Genre IDs)
  if (fieldKey === 'genre_ids') {
    const list = Array.isArray(rawValue) ? rawValue : [];
    if (!list.length) {
      return <span className="sp-ai-drawer__empty-val">Chưa có</span>;
    }

    const limit = 5;
    const hasMore = list.length > limit;
    const visibleList = isExpanded || !hasMore ? list : list.slice(0, limit);

    return (
      <div className="sp-ai-drawer__chips">
        {visibleList.map((genreId, index) => {
          const genreName = metadata.genres?.find((g) => String(g.id) === String(genreId))?.name || `ID ${genreId}`;
          return (
            <span key={index} className="sp-ai-drawer__chip sp-ai-drawer__chip--genre">
              <span className="sp-ai-drawer__chip-text">{genreName}</span>
            </span>
          );
        })}
        {hasMore && (
          <button
            type="button"
            className="sp-ai-drawer__chip sp-ai-drawer__chip--more"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? 'Thu gọn' : `+${list.length - limit} khác`}
          </button>
        )}
      </div>
    );
  }

  // 5. Render Từ khóa SEO (SEO Keywords)
  if (fieldKey === 'seo_keywords') {
    const list = Array.isArray(rawValue) ? rawValue.filter(Boolean) : [];
    if (!list.length) {
      return <span className="sp-ai-drawer__empty-val">Chưa có</span>;
    }

    const limit = 5;
    const hasMore = list.length > limit;
    const visibleList = isExpanded || !hasMore ? list : list.slice(0, limit);

    return (
      <div className="sp-ai-drawer__chips">
        {visibleList.map((keyword, index) => (
          <span key={index} className="sp-ai-drawer__chip sp-ai-drawer__chip--tag">
            <span className="sp-ai-drawer__chip-tag">#</span>
            <span className="sp-ai-drawer__chip-text">{keyword}</span>
          </span>
        ))}
        {hasMore && (
          <button
            type="button"
            className="sp-ai-drawer__chip sp-ai-drawer__chip--more"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? 'Thu gọn' : `+${list.length - limit} khác`}
          </button>
        )}
      </div>
    );
  }

  // 6. Trường thông thường
  const text = labelValue != null && labelValue !== '' ? String(labelValue) : 'Chưa có';
  if (text === 'Chưa có') {
    return <span className="sp-ai-drawer__empty-val">Chưa có</span>;
  }

  return <p className="sp-ai-drawer__text-val">{text}</p>;
};

AIFieldValue.propTypes = {
  fieldKey: PropTypes.string.isRequired,
  rawValue: PropTypes.any,
  labelValue: PropTypes.any,
  metadata: PropTypes.object,
  isProposed: PropTypes.bool,
};

export default AIFieldValue;
