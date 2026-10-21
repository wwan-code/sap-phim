/** Atomic account/model budgets shared by API processes and workers. Fail closed. */
export const RESERVE_QUOTA_LUA = `
local cooldown=redis.call('PTTL',KEYS[1])
if cooldown>0 then return cooldown end
for i=2,#KEYS do
  if tonumber(redis.call('GET',KEYS[i]) or '0')>=tonumber(ARGV[(i-2)*2+1]) then
    return math.max(1,redis.call('PTTL',KEYS[i]))
  end
end
for i=2,#KEYS do
  local n=redis.call('INCR',KEYS[i])
  if n==1 then redis.call('PEXPIRE',KEYS[i],ARGV[(i-2)*2+2]) end
end
return 0`;
const failure = (code, retryAfterMs = 0) => Object.assign(new Error('Hạn mức miễn phí chưa khả dụng; sử dụng dữ liệu nguồn.'), { code, retryAfterMs, retryable: true });
export const createQuotaGovernor = ({ redis, config = process.env }) => ({
  async reserve(provider, model = 'all') {
    const prefix = provider.toUpperCase();
    const rpm = Number(config[`AI_${prefix}_RPM`]), rpd = Number(config[`AI_${prefix}_RPD`]);
    if (!Number.isInteger(rpm) || rpm < 1 || !Number.isInteger(rpd) || rpd < 1) throw failure('AI_QUOTA_UNCONFIGURED');
    const scope = config[`AI_${prefix}_QUOTA_SCOPE`] || provider;
    const key = `ai:quota:v1:${scope}`;
    try {
      const wait = Number(await redis.eval(RESERVE_QUOTA_LUA, 5,
        `${key}:cooldown`, `${key}:minute`, `${key}:day`, `${key}:${model}:minute`, `${key}:${model}:day`,
        rpm, 60000, rpd, 86400000, rpm, 60000, rpd, 86400000));
      if (wait > 0) throw failure('AI_QUOTA_EXHAUSTED', wait);
    } catch (error) {
      if (error.code === 'AI_QUOTA_EXHAUSTED') throw error;
      throw failure('AI_QUOTA_UNAVAILABLE');
    }
  },
  async cooldown(provider, milliseconds) {
    const key = `ai:quota:v1:${config[`AI_${provider.toUpperCase()}_QUOTA_SCOPE`] || provider}:cooldown`;
    // Extend, never shorten another worker's cooldown.
    try { await redis.eval("local t=redis.call('PTTL',KEYS[1]); if t<tonumber(ARGV[1]) then redis.call('SET',KEYS[1],'1','PX',ARGV[1]) end; return 1", 1, key, Math.max(60000, milliseconds || 0)); }
    catch { throw failure('AI_QUOTA_UNAVAILABLE'); }
  },
});
