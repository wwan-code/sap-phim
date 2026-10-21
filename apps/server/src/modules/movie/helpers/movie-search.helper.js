/** Shared source-ID syntax. A bare number is a title, never a guessed provider ID. */
export const parseSourceQuery = (input = '') => {
  const value = String(input).trim().toLowerCase();
  const match = /^(tmdb):(movie|tv):([1-9]\d{0,9})$/.exec(value);
  if (match && Number(match[3]) <= 2147483647) return { source: 'tmdb', id: Number(match[3]), mediaType: match[2] === 'tv' ? 'series' : 'movie' };
  const other = /^(anilist|mal):([1-9]\d{0,9})$/.exec(value);
  if (other && Number(other[2]) <= 2147483647) return { source: other[1], id: Number(other[2]), mediaType: null };
  const imdb = /^imdb:(tt\d{5,12})$/.exec(value);
  return imdb ? { source: 'imdb', id: imdb[1], mediaType: null } : null;
};

/** SQL fragments accept only an ORM-escaped string and allowlisted field names. */
export const buildSearchSql = ({ query, field = 'all', escape, alias = 'Movie' }) => {
  if (!['all', 'title', 'actor', 'director', 'studio'].includes(field)) throw new Error('Invalid search field');
  if (!['Movie', 'movies'].includes(alias)) throw new Error('Invalid search alias');
  const movie = `"${alias}"`;
  const source = parseSourceQuery(query);
  if (source) {
    const condition = `${movie}.${source.source}_id = ${escape(source.id)}` + (source.mediaType ? ` AND ${movie}.type ${source.mediaType === 'series' ? "IN ('series','tv')" : "= 'movie'"}` : '');
    return { condition: `(${condition})`, rank: '(100 + 0)', mode: 'source_id' };
  }
  const q = `sp_search_normalize(${escape(query)}, false)`, f = `sp_search_normalize(${escape(query)}, true)`;
  const match = `(d.normalized = ${q} OR d.folded = ${f} OR starts_with(d.folded, ${f}) OR d.tokens @@ plainto_tsquery('simple', ${f}) OR (length(${f}) >= 3 AND d.folded % ${f}))`;
  const filter = `d.movie_id = ${movie}.id${field === 'all' ? '' : ` AND d.field = ${escape(field)}`} AND ${f} <> '' AND ${match}`;
  const score = `CASE WHEN d.normalized = ${q} THEN 60 WHEN d.folded = ${f} THEN 50 WHEN starts_with(d.folded, ${f}) THEN 40 WHEN d.tokens @@ plainto_tsquery('simple', ${f}) THEN 30 ELSE 20 + similarity(d.folded, ${f}) END`;
  return { condition: `EXISTS (SELECT 1 FROM movie_search_documents d WHERE ${filter})`, rank: `(SELECT MAX(${score}) FROM movie_search_documents d WHERE ${filter})`, mode: 'indexed' };
};
