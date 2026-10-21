/** Shared metadata cache, single-flight locks and source budgets. No credential logging. */
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createQuotaGovernor } from './provider-quota.helper.js';

export const createSourceHttp = ({ http, redis, config = process.env }) => {
  const defaults = { tmdb: [60, 2000], anilist: [20, 500], jikan: [30, 500], omdb: [5, 100] };
  const call = async (method, url, body, options = {}) => {
    const host = new URL(url).hostname;
    const source = host.includes('themoviedb') ? 'tmdb' : host.includes('anilist') ? 'anilist' : host.includes('omdbapi') ? 'omdb' : 'jikan';
    const [rpm, rpd] = defaults[source];
    const governor = createQuotaGovernor({ redis, config: { [`AI_${source.toUpperCase()}_RPM`]: rpm, [`AI_${source.toUpperCase()}_RPD`]: rpd, ...config } });
    const hash = createHash('sha256').update(JSON.stringify([method, url, body, options.params])).digest('hex');
    const key = `ai:source:v1:${source}:${hash}`, lock = `${key}:lock`, token = randomUUID();
    const started = Date.now(), timeout = Math.min(options.timeout || 10000, 10000);
    while (Date.now() - started < timeout) {
      options.signal?.throwIfAborted();
      const cached = options.bypassCache ? null : await redis.get(key);
      if (cached) return { data: JSON.parse(cached) };
      if (await redis.set(lock, token, 'PX', timeout + 2000, 'NX') === 'OK') {
        try {
          await governor.reserve(source);
          options.signal?.throwIfAborted();
          const remaining = Math.max(1, timeout - (Date.now() - started));
          const response = await (method === 'get' ? http.get(url, { ...options, timeout: remaining }) : http.post(url, body, { ...options, timeout: remaining }));
          if (!response.data?.errors) await redis.set(key, JSON.stringify(response.data), 'EX', 300);
          return response;
        } catch (error) {
          if (error.response?.status === 429) await governor.cooldown(source, Number(error.response.headers?.['retry-after'] || 60) * 1000);
          throw error;
        } finally {
          await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, lock, token).catch(() => {});
        }
      }
      await delay(100, undefined, { signal: options.signal });
    }
    throw Object.assign(new Error('Source lookup deadline exceeded'), { code: 'SOURCE_TIMEOUT' });
  };
  return { get: (url, options) => call('get', url, null, options), post: (url, body, options) => call('post', url, body, options), fresh: () => ({ get: (url, options) => call('get', url, null, { ...options, bypassCache: true }), post: (url, body, options) => call('post', url, body, { ...options, bypassCache: true }) }) };
};
