/**
 * @file movie-form.mapper.js
 * @module Admin/Modules/Movies/Mappers
 * @description Các hàm biến đổi dữ liệu 2 chiều cho Movie Form.
 */

/**
 * Ánh xạ dữ liệu từ backend (DB) thành form values (React Hook Form).
 * @param {Object} item Dữ liệu trả về từ API /movies/:id
 * @returns {Object} Dữ liệu đã chuẩn hóa cho form
 */
export const mapMovieToFormValues = (item) => {
  if (!item) return {};

  // Map titles
  const rawTitles = Array.isArray(item.titles) ? item.titles : [];
  const mappedTitles = rawTitles.length > 0 ? rawTitles : [{ type: 'default', title: item.title || '' }];

  const primaryTitle =
    item.title ||
    mappedTitles.find((t) => t.type === 'default')?.title ||
    mappedTitles[0]?.title ||
    '';

  const originalTitle =
    item.original_title ||
    ['native', 'romaji', 'english'].map((type) => mappedTitles.find((title) => title.type === type)?.title).find(Boolean) ||
    '';

  // Map genre IDs
  const genreIds = (item.genres || []).map((g) => g.id || g);

  // Map Actor Cast
  const rawCast = item.actors || item.actor_cast || [];
  const actorCast = rawCast
    .map((a, index) => ({
      actor_id: a.id || a.actor_id || null,
      actor_name: a.name || a.actor_name || '',
      actor_image_url: a.image_url || a.actor_image_url || '',
      character_name: a.MovieActor?.character_name || a.character_name || '',
      role_name: a.MovieActor?.role_name || a.role_name || 'Lồng tiếng',
      is_main_cast: Boolean(a.MovieActor?.is_main_cast ?? a.is_main_cast),
      cast_order: a.MovieActor?.cast_order ?? a.cast_order ?? index,
      notes: a.MovieActor?.notes || a.notes || '',
    }))
    .sort((a, b) => (a.cast_order ?? 0) - (b.cast_order ?? 0));

  return {
    titles: mappedTitles,
    title: primaryTitle,
    original_title: originalTitle,
    slug: item.slug || '',
    type: item.type || 'series',
    status: item.status || 'ongoing',
    is_published: Boolean(item.is_published),
    is_premium: Boolean(item.is_premium),
    category_id: item.category_id || item.category?.id || '',
    country_id: item.country_id || item.country?.id || '',
    studio_id: item.studio_id || item.studio?.id || '',
    series_id: item.series_id || item.series?.id || '',
    genre_ids: genreIds,
    release_date: item.release_date ? item.release_date.split('T')[0] : '',
    release_year: item.release_year || '',
    quality: item.quality || 'FHD',
    sub_dub_type: item.sub_dub_type || 'sub',
    source_type: item.source_type || '',
    duration: item.duration || '',
    total_episodes: item.total_episodes || 0,
    season: item.season || '',
    season_number: item.season_number != null ? item.season_number : '',
    age_rating: item.age_rating || 'PG-13',
    director: item.director || '',
    director_metadata: item.director_metadata || {},
    trailer_url: item.trailer_url || '',
    description: item.description || '',
    seo_keywords: item.seo_keywords || [],
    meta_title: item.meta_title || '',
    meta_description: item.meta_description || '',
    actor_cast: actorCast,
    imdb_id: item.imdb_id || '',
    tmdb_id: item.tmdb_id || '',
    mal_id: item.mal_id || '',
    anilist_id: item.anilist_id || '',
    imdb_rating: item.imdb_rating || '',
  };
};

/**
 * Xử lý URL ảnh từ dữ liệu trả về
 * @param {Object} item Dữ liệu phim từ server
 * @returns {Object} Các url xem trước ảnh
 */
export const extractImagePreviews = (item) => {
  if (!item) return { poster: '', banner: '', cover: '', logo: '' };
  const imgs = item.images || {};
  const resolveImageUrl = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && field !== null) {
      return field.url || field.path || '';
    }
    return '';
  };

  return {
    poster: resolveImageUrl(imgs.poster) || resolveImageUrl(item.poster_url) || '',
    banner: resolveImageUrl(imgs.backdrop) || resolveImageUrl(imgs.banner) || '',
    cover: resolveImageUrl(imgs.cover) || '',
    logo: resolveImageUrl(imgs.logo) || '',
  };
};

/**
 * Ánh xạ form values thành payload gửi lên server (hỗ trợ cả FormData và JSON)
 * @param {Object} values Giá trị từ React Hook Form
 * @param {Object} imageFiles Trạng thái ảnh (File) upload
 * @param {String} jobId Job ID nếu có xử lý nền
 * @returns {{ payload: FormData|Object, isMultipart: boolean }}
 */
export const buildMovieSubmission = (values, imageFiles = {}, jobId = null) => {
  const hasNewFiles = Object.values(imageFiles).some(Boolean);
  const isMultipart = hasNewFiles;

  // Chuẩn hóa danh sách titles
  const rawTitles = Array.isArray(values.titles) ? values.titles : [];
  const cleanedTitles = rawTitles
    .map((t) => ({
      type: (t?.type || 'default').trim(),
      title: (t?.title || '').trim(),
    }))
    .filter((t) => Boolean(t.title));

  const primaryTitle =
    cleanedTitles.find((t) => t.type === 'default')?.title ||
    cleanedTitles[0]?.title ||
    (values.title || '').trim();

  const originalTitle =
    (values.original_title || '').trim() ||
    ['native', 'romaji', 'english'].map((type) => cleanedTitles.find((title) => title.type === type)?.title).find(Boolean) ||
    null;

  // Chuẩn hóa actor_cast
  const cleanedActorCast = Array.isArray(values.actor_cast)
    ? values.actor_cast
        .filter((a) => Boolean(a?.actor_name || a?.name || a?.actor_id))
        .map((a, idx) => ({
          ...(a.entity_key ? { entity_key: a.entity_key } : {}),
          actor_id: a.actor_id || null,
          actor_name: (a.actor_name || a.name || '').trim(),
          actor_image_url: a.actor_image_url || a.image_url || null,
          character_name: (a.character_name || '').trim() || null,
          role_name: (a.role_name || 'Lồng tiếng').trim(),
          is_main_cast: Boolean(a.is_main_cast),
          cast_order: Number(a.cast_order ?? idx),
          notes: (a.notes || '').trim() || null,
        }))
    : [];

  // Chuẩn hóa genre_ids
  const cleanedGenreIds = Array.isArray(values.genre_ids)
    ? values.genre_ids.filter((g) => Boolean(g))
    : [];

  const payloadData = {
    ...values,
    title: primaryTitle,
    titles: cleanedTitles.length > 0 ? cleanedTitles : [{ type: 'default', title: primaryTitle }],
    original_title: originalTitle,
    slug: (values.slug || '').trim() || undefined,
    type: values.type || 'series',
    status: values.status || 'ongoing',
    is_published: Boolean(values.is_published),
    is_premium: Boolean(values.is_premium),
    category_id: values.category_id ? String(values.category_id).trim() : null,
    country_id: values.country_id ? String(values.country_id).trim() : null,
    studio_id: values.studio_id ? String(values.studio_id).trim() : null,
    series_id: values.series_id ? String(values.series_id).trim() : null,
    genre_ids: cleanedGenreIds,
    actor_cast: cleanedActorCast,
    release_date: values.release_date ? String(values.release_date).trim() : null,
    release_year:
      values.release_year !== '' && values.release_year !== null && values.release_year !== undefined
        ? Number(values.release_year)
        : null,
    quality: values.quality || 'FHD',
    sub_dub_type: values.sub_dub_type || 'sub',
    source_type: values.source_type ? String(values.source_type).trim() : null,
    duration:
      values.duration !== '' && values.duration !== null && values.duration !== undefined
        ? Number(values.duration)
        : null,
    total_episodes:
      values.total_episodes !== '' &&
      values.total_episodes !== null &&
      values.total_episodes !== undefined
        ? Number(values.total_episodes)
        : 0,
    season: values.season ? String(values.season).trim() : null,
    season_number:
      values.season_number !== '' && values.season_number !== null && values.season_number !== undefined
        ? Number(values.season_number)
        : null,
    age_rating: values.age_rating || 'PG-13',
    director: (values.director || '').trim() || null,
    director_metadata: values.director_metadata || {},
    trailer_url: (values.trailer_url || '').trim() || null,
    description: (values.description || '').trim() || null,
    meta_title: (values.meta_title || '').trim() || null,
    meta_description: (values.meta_description || '').trim() || null,
    seo_keywords: Array.isArray(values.seo_keywords) ? values.seo_keywords : [],
    imdb_id: values.imdb_id ? String(values.imdb_id).trim() : null,
    tmdb_id: values.tmdb_id ? Number(values.tmdb_id) : null,
    mal_id: values.mal_id ? Number(values.mal_id) : null,
    anilist_id: values.anilist_id ? Number(values.anilist_id) : null,
    imdb_rating: values.imdb_rating ? Number(values.imdb_rating) : null,
  };

  if (values.ai_application) {
    const keys = cleanedActorCast.map((row) => row.entity_key).filter(Boolean);
    if (values.studio_candidate?.entity_key && !values.studio_id) keys.push(values.studio_candidate.entity_key);
    if (keys.length) payloadData.ai_application = { ...values.ai_application, entity_keys: [...new Set(keys)] };
    else delete payloadData.ai_application;
  }
  delete payloadData.studio_candidate;
  if (jobId) {
    payloadData.jobId = jobId;
  }

  // Nếu có upload ảnh thì dùng FormData
  if (isMultipart) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(payloadData));

    // Append binary files
    if (imageFiles.poster) formData.append('poster', imageFiles.poster);
    if (imageFiles.banner) formData.append('banner', imageFiles.banner);
    if (imageFiles.cover) formData.append('cover', imageFiles.cover);
    if (imageFiles.logo) formData.append('logo', imageFiles.logo);

    return { payload: formData, isMultipart: true, jobId, hasNewFiles, primaryTitle };
  }

  // Ngược lại trả về JSON thuần
  return { payload: payloadData, isMultipart: false, jobId, hasNewFiles, primaryTitle };
};
