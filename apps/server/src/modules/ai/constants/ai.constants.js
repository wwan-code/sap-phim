/**
 * @file ai.constants.js
 * @module AI_Constants
 * @description Định nghĩa toàn bộ hằng số cho AI DataOps: Trạng thái Job, Stages, Providers, Cost Table, Prompt Versions.
 */

import crypto from "crypto";

export const AI_JOB_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  DLQ: "dlq",
};

/**
 * Chuẩn hóa khóa bộ đệm đồng nhất giữa API Controller và Worker Pipeline
 */
export const generateAiCacheKey = ({
  title,
  year,
  type = "all",
  mode = "auto",
  enable_web_search = false,
  context = {},
  ownerId = null,
  target = null,
  selectedCandidate = null,
}) => {
  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
    }
    return value ?? null;
  };
  const normalizedKey = JSON.stringify(canonicalize({
    version: 'v2', prompt: PROMPT_VERSIONS.MOVIE_SUGGESTION,
    title: (title || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '),
    year: year || null, type, mode, enable_web_search, context, ownerId, target, selectedCandidate,
  }));
  const hash = crypto.createHash("sha256").update(normalizedKey).digest("hex");
  return {
    hash,
    resultCacheKey: `ai:v2:result:${hash}`,
    lockKey: `ai:v2:enqueue:${hash}`,
  };
};

export const AI_JOB_STAGES = {
  QUEUED: { stage: "QUEUED", progress: 0, message: "Đang xếp hàng đợi xử lý..." },
  EVIDENCE_COLLECTION: { stage: "EVIDENCE_COLLECTION", progress: 15, message: "Đang thu thập dữ liệu đa nguồn (TMDB, AniList, MAL, OMDb)..." },
  ENTITY_MATCHING: { stage: "ENTITY_MATCHING", progress: 35, message: "Đang đối soát quan hệ thực thể với cơ sở dữ liệu..." },
  LLM_REASONING: { stage: "LLM_REASONING", progress: 50, message: "Đang tổng hợp thông tin, phân giải xung đột và dịch thuật..." },
  SECONDARY_EVIDENCE_SEARCH: { stage: "SECONDARY_EVIDENCE_SEARCH", progress: 65, message: "Đang tìm kiếm bổ sung trên AniList, Jikan, TMDB bằng tên quốc tế..." },
  LLM_REFINEMENT: { stage: "LLM_REFINEMENT", progress: 75, message: "Đang tái tổng hợp và hoàn thiện dữ liệu với bằng chứng mới..." },
  SELF_AUDIT_VALIDATION: { stage: "SELF_AUDIT_VALIDATION", progress: 85, message: "Đang tự kiểm toán, chấm điểm tin cậy và gắn nhãn nguồn gốc..." },
  COMPLETED: { stage: "COMPLETED", progress: 100, message: "Hoàn tất xử lý dữ liệu AI thành công!" },
  FAILED: { stage: "FAILED", progress: 100, message: "Quá trình xử lý AI thất bại." },
};

export const AI_PROVIDERS = {
  GEMINI: "gemini",
  OPENROUTER: "openrouter",
};

export const PROMPT_VERSIONS = {
  MOVIE_SUGGESTION: "v2.0.0",
};

export const AI_CONFIDENCE_LEVELS = {
  HIGH: 0.85,
  MEDIUM: 0.70,
  LOW: 0.0,
};

export const AI_TOKEN_COST_ESTIMATES = {
  "gemini-2.5-flash": { promptPer1k: 0.000075, completionPer1k: 0.0003 },
  "gemini-1.5-flash": { promptPer1k: 0.000075, completionPer1k: 0.0003 },
  "minimax/minimax-m3:free": { promptPer1k: 0.0, completionPer1k: 0.0 },
  "nvidia/nemotron-3-ultra-550b-a55b:free": { promptPer1k: 0.0, completionPer1k: 0.0 },
  "z-ai/glm-5.2:free": { promptPer1k: 0.0, completionPer1k: 0.0 },
  "default": { promptPer1k: 0.0001, completionPer1k: 0.0004 },
};

export const AI_CACHE_TTL = {
  EVIDENCE_SECONDS: 86400, // 24 giờ
  RESULT_SECONDS: 3600,     // 1 giờ
  IDEMPOTENCY_LOCK_SECONDS: 60,
};

/**
 * Bảng trọng số tin cậy theo nguồn × loại trường (Source Reliability Matrix)
 * Điểm từ 0.0 (hoàn toàn không tin cậy) đến 1.0 (chuẩn mực tham chiếu cao nhất)
 */
export const AI_SOURCE_RELIABILITY_MATRIX = {
  // 1. AniList: Rất mạnh về Anime TV/Movie, số tập, mùa phát sóng, studio anime, seiyuu
  anilist: {
    core_identifiers: 0.95, // title, native_title, romaji
    media_specs: 0.95,      // episodes, duration, season, status
    synopsis: 0.85,         // description (tiếng Anh)
    people: 0.90,           // voice actors/seiyuu, staff
    ratings: 0.80,          // community score
    taxonomies: 0.90,       // genres, tags, studios
    default: 0.85,
  },
  // 2. Jikan (MyAnimeList): Nguồn đối soát hàng đầu về Anime data, synopsis, manga authors
  jikan: {
    core_identifiers: 0.90,
    media_specs: 0.90,
    synopsis: 0.90,
    people: 0.85,
    ratings: 0.85,
    taxonomies: 0.85,
    default: 0.85,
  },
  // 3. TMDB: Nguồn chuẩn mực cho Phim chiếu rạp, Live Action, Poster, Trailer, Overview tiếng Việt
  tmdb: {
    core_identifiers: 0.95,
    media_specs: 0.85,
    synopsis: 0.90,
    people: 0.95,           // Đạo diễn live-action, diễn viên chính
    ratings: 0.80,
    taxonomies: 0.85,
    default: 0.85,
  },
  // 4. OMDb (IMDb): Chuẩn mực cho IMDb ID, IMDb Rating, Runtime, Box Office
  omdb: {
    core_identifiers: 0.80,
    media_specs: 0.75,
    synopsis: 0.70,
    people: 0.80,
    ratings: 0.98,          // IMDb Rating có độ uy tín quốc tế cao nhất
    taxonomies: 0.70,
    default: 0.75,
  },
  // 5. Google Search Grounding: Cập nhật thông tin bản quyền tiếng Việt và phát hành mới nhất
  web_search: {
    core_identifiers: 0.90,
    media_specs: 0.85,
    synopsis: 0.80,
    people: 0.80,
    ratings: 0.70,
    taxonomies: 0.80,
    default: 0.80,
  },
  // 6. AI Translation / Internal Synthesis
  ai_translation: {
    core_identifiers: 0.75,
    media_specs: 0.70,
    synopsis: 0.90,         // Dịch thuật tiếng Việt trau chuốt
    people: 0.65,
    ratings: 0.50,
    taxonomies: 0.75,
    default: 0.70,
  },
};

/**
 * Danh sách các tác giả Manga / Light Novel / Comic phổ biến
 * Dùng cho Heuristic Validator để phát hiện nhầm lẫn Director (Đạo diễn) ↔ Author (Tác giả gốc)
 */
export const AI_KNOWN_MANGA_AUTHORS = [
  "Akira Toriyama",
  "Eiichiro Oda",
  "Masashi Kishimoto",
  "Hiromu Arakawa",
  "Hajime Isayama",
  "Gege Akutami",
  "Tatsuke Fujimoto",
  "Tatsuki Fujimoto",
  "Tite Kubo",
  "Koyoharu Gotouge",
  "ONE",
  "Yusuke Murata",
  "Rumiko Takahashi",
  "Gosho Aoyama",
  "Kentaro Miura",
  "Yoshihiro Togashi",
  "Naoko Takeuchi",
  "Takehiko Inoue",
  "Hirohiko Araki",
  "Sui Ishida",
  "Kohei Horikoshi",
  "Ken Wakui",
  "Aka Akasaka",
  "Mengo Yokoyari",
  "Tappei Nagatsuki",
  "Rifujin na Magonote",
  "Fuse",
  "Kumo Kagyu",
  "Chugong",
  "SIU",
  "Reiji Miyajima",
  "Negi Haruba",
];

/**
 * Bộ mã cờ cảnh báo kiểm toán (Audit Flags)
 */
export const AI_AUDIT_FLAGS = {
  POSSIBLE_DIRECTOR_AUTHOR_CONFUSION: "POSSIBLE_DIRECTOR_AUTHOR_CONFUSION",
  INVALID_ENUM_FALLBACK: "INVALID_ENUM_FALLBACK",
  SEVERE_UNRESOLVED_CONFLICT: "SEVERE_UNRESOLVED_CONFLICT",
  LOW_EVIDENCE_QUALITY: "LOW_EVIDENCE_QUALITY",
  SUSPICIOUS_EPISODE_COUNT: "SUSPICIOUS_EPISODE_COUNT",
  DATE_FORMAT_CORRECTED: "DATE_FORMAT_CORRECTED",
  SECONDARY_SEARCH_ENRICHED: "SECONDARY_SEARCH_ENRICHED",
};

/**
 * Giới hạn tài nguyên nghiên cứu AI (Chi phí & Quota Guardrail)
 */
export const AI_RESEARCH_LIMITS = {
  MAX_EXTRA_LLM_CALLS_PER_JOB: 1,
  CONFLICT_CONFIDENCE_PENALTY_HIGH: 0.15,
  CONFLICT_CONFIDENCE_PENALTY_MEDIUM: 0.05,
};

export default {
  AI_JOB_STATUS,
  AI_JOB_STAGES,
  AI_PROVIDERS,
  PROMPT_VERSIONS,
  AI_CONFIDENCE_LEVELS,
  AI_TOKEN_COST_ESTIMATES,
  AI_CACHE_TTL,
  AI_SOURCE_RELIABILITY_MATRIX,
  AI_KNOWN_MANGA_AUTHORS,
  AI_AUDIT_FLAGS,
  AI_RESEARCH_LIMITS,
};
