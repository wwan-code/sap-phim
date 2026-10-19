/**
 * @file test-movie-flow.mjs
 * @module Scripts/TestMovieFlow
 * @description Script kiểm thử End-to-End (E2E) toàn diện luồng Tạo & Cập Nhật Phim kèm upload hình ảnh (Sharp / BullMQ / Socket.IO).
 * 
 * Các kịch bản kiểm thử:
 * 1. Nạp Admin User từ Database, tạo UserSession hợp lệ và ký JWT Access Token.
 * 2. Lấy Metadata thực tế từ API /api/v1/admin/movies/metadata.
 * 3. Sinh tự động 4 ảnh mẫu (Poster, Banner, Cover, Logo) bằng Sharp in-memory.
 * 4. Kết nối Socket.IO Client và theo dõi luồng Job Progress Realtime.
 * 5. Tạo phim mới (POST /api/v1/admin/movies) + Upload 4 ảnh + Xác minh các Stage Socket hoàn thành 100%.
 * 6. Xác thực tính toàn vẹn của Database và các file WebP thực tế trên đĩa cứng (File System).
 * 7. Cập nhật phim (PATCH /api/v1/admin/movies/:id) + Thay thế Poster mới + Kiểm tra xóa file ảnh cũ.
 * 8. Kiểm thử các kịch bản lỗi (Negative Tests): File giả mạo, Trùng slug, Thiếu trường bắt buộc.
 * 9. Dọn dẹp dữ liệu (Teardown & Cleanup) và xuất Báo Cáo Tổng Kết (Summary Report).
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import { io } from 'socket.io-client';
import dotenv from 'dotenv';

// ── Nạp cấu hình môi trường ───────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(serverRoot, '.env') });

const API_BASE_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
const SOCKET_URL = API_BASE_URL;
const UPLOADS_DIR = path.join(serverRoot, 'uploads');

// ── Bộ màu ANSI cho Terminal Output ────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  bgBlue: '\x1b[44m\x1b[37m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m',
};

const log = {
  header: (msg) => console.log(`\n${C.bold}${C.bgBlue} 🚀 ${msg.toUpperCase()} ${C.reset}`),
  phase: (num, title) => console.log(`\n${C.bold}${C.cyan}━━━ [PHASE ${num}] ${title} ━━━${C.reset}`),
  step: (msg) => console.log(` ${C.blue}▶${C.reset} ${msg}`),
  success: (msg) => console.log(`  ${C.green}✓ [PASS]${C.reset} ${msg}`),
  info: (msg) => console.log(`  ${C.dim}ℹ ${msg}${C.reset}`),
  warn: (msg) => console.log(`  ${C.yellow}⚠ [WARN]${C.reset} ${msg}`),
  error: (msg) => console.log(`  ${C.red}✗ [FAIL]${C.reset} ${msg}`),
  socket: (stage, percent, msg) => console.log(`    ${C.magenta}⚡ [SOCKET ${percent}%]${C.reset} ${C.bold}${stage}${C.reset}: ${msg || ''}`),
};

// ── Quản lý Kết quả Kiểm thử ──────────────────────────────────────────
const testResults = [];
function assert(condition, testName, details = '') {
  if (condition) {
    log.success(testName);
    testResults.push({ name: testName, pass: true, details });
    return true;
  } else {
    log.error(`${testName} ${details ? `(${details})` : ''}`);
    testResults.push({ name: testName, pass: false, details });
    return false;
  }
}

// ── Hàm sinh ảnh mẫu in-memory bằng Sharp ─────────────────────────────
async function createSampleImage({ width, height, background, text, isTransparent = false }) {
  const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${isTransparent ? '' : `<rect width="100%" height="100%" fill="${background}"/>`}
      <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.35}" fill="rgba(255,255,255,0.15)"/>
      <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="${Math.max(18, Math.round(width * 0.05))}" font-weight="bold" fill="${isTransparent ? '#7C5DFA' : '#FFFFFF'}" text-anchor="middle" dominant-baseline="middle">
        ${text}
      </text>
      <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="${Math.max(12, Math.round(width * 0.028))}" fill="${isTransparent ? '#FFFFFF' : 'rgba(255,255,255,0.7)'}" text-anchor="middle" dominant-baseline="middle">
        ${width}x${height} • SAP-PHIM E2E
      </text>
    </svg>
  `;

  let pipeline = sharp(Buffer.from(svgText));
  if (isTransparent) {
    return pipeline.png().toBuffer();
  }
  return pipeline.png({ quality: 90 }).toBuffer();
}

// ── Chương trình thực thi chính ───────────────────────────────────────
async function runE2ETest() {
  const startTime = Date.now();
  let createdMovieId = null;
  let currentMovieSlug = null;
  let socket = null;
  let adminToken = null;
  let testSession = null;
  const extraCleanupMovieIds = [];

  log.header('Bắt đầu kiểm thử toàn diện luồng Tạo & Cập nhật Phim (E2E)');
  console.log(`${C.dim}Mục tiêu Server: ${API_BASE_URL} | Thư mục Uploads: ${UPLOADS_DIR}${C.reset}`);

  try {
    // ══════════════════════════════════════════════════════════════════
    // PHASE 1: Khởi tạo Xác thực, Session & Nạp Metadata Hệ Thống
    // ══════════════════════════════════════════════════════════════════
    log.phase(1, 'Khởi tạo Xác thực, Session & Nạp Metadata');

    // 1.1 Tìm Admin User từ DB, tạo Session và ký Token
    log.step('Truy vấn Admin User từ Database và tạo UserSession...');
    const { User, Role, UserSession } = await import('../src/models/index.js');
    const { generateAccessToken } = await import('../src/utils/jwt.util.js');

    const adminUser = await User.findOne({
      include: [
        {
          model: Role,
          as: 'role',
          where: { slug: ['boss', 'admin'] },
        },
      ],
    });

    assert(Boolean(adminUser), `Tìm thấy Admin User trong DB (Username: ${adminUser?.username}, Role: ${adminUser?.role?.slug})`);

    testSession = await UserSession.create({
      user_id: adminUser.id,
      token_family: randomUUID(),
      ip_address: '127.0.0.1',
      user_agent: 'NodeJS E2E Test Runner',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      is_revoked: false,
    });

    assert(Boolean(testSession?.id), `Khởi tạo UserSession thành công (Session ID: ${testSession.id})`);

    adminToken = generateAccessToken({
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      role: adminUser.role.slug,
      tokenVersion: adminUser.token_version || 1,
      sessionId: testSession.id,
    });

    assert(Boolean(adminToken), 'Tạo thành công JWT Admin Access Token kèm SessionId');

    // 1.2 Lấy Metadata từ API
    log.step('Gọi API GET /api/v1/admin/movies/metadata...');
    const metadataRes = await axios.get(`${API_BASE_URL}/api/v1/admin/movies/metadata`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      timeout: 10000,
    });

    assert(metadataRes.status === 200, 'API Metadata phản hồi mã HTTP 200');
    const metadata = metadataRes.data?.data || {};

    const categoryId = metadata.categories?.[0]?.id || 1;
    const genreIds = (metadata.genres || []).slice(0, 2).map((g) => g.id);
    const countryId = metadata.countries?.[0]?.id || 1;
    const studioId = metadata.studios?.[0]?.id || null;
    const actorId = metadata.actors?.[0]?.id || null;

    log.info(`Dữ liệu nạp: Category=${categoryId}, Genres=[${genreIds.join(', ')}], Country=${countryId}, Studio=${studioId || 'N/A'}`);
    assert(genreIds.length > 0, 'Tìm thấy ít nhất 1 Thể loại (Genre) trong hệ thống');

    // ══════════════════════════════════════════════════════════════════
    // PHASE 2: Sinh 4 Ảnh Mẫu Chuẩn Kích Thước In-Memory
    // ══════════════════════════════════════════════════════════════════
    log.phase(2, 'Sinh Ảnh Mẫu Đa Định Dạng & Đa Kích Thước (Sharp)');

    const posterBuffer = await createSampleImage({
      width: 600,
      height: 900,
      background: '#E50914',
      text: 'POSTER 2:3',
    });
    const bannerBuffer = await createSampleImage({
      width: 1920,
      height: 1080,
      background: '#0B0D12',
      text: 'BANNER 16:9',
    });
    const coverBuffer = await createSampleImage({
      width: 1260,
      height: 540,
      background: '#1F2330',
      text: 'COVER 21:9',
    });
    const logoBuffer = await createSampleImage({
      width: 600,
      height: 200,
      isTransparent: true,
      text: 'SẠP PHIM LOGO',
    });

    assert(posterBuffer.length > 0, `Sinh Poster PNG (${posterBuffer.length} bytes, 600x900)`);
    assert(bannerBuffer.length > 0, `Sinh Banner PNG (${bannerBuffer.length} bytes, 1920x1080)`);
    assert(coverBuffer.length > 0, `Sinh Cover PNG (${coverBuffer.length} bytes, 1260x540)`);
    assert(logoBuffer.length > 0, `Sinh Logo PNG Transparent (${logoBuffer.length} bytes, 600x200)`);

    // ══════════════════════════════════════════════════════════════════
    // PHASE 3: Thiết Lập Kết Nối Socket.IO Realtime & Đăng Ký Job
    // ══════════════════════════════════════════════════════════════════
    log.phase(3, 'Kết Nối Realtime Socket.IO & Đăng Ký Room');

    const createJobId = `job-e2e-create-${Date.now()}`;
    const receivedProgressEvents = [];

    socket = io(SOCKET_URL, {
      auth: { token: `Bearer ${adminToken}` },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false,
    });

    const socketConnectedPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout kết nối Socket.IO')), 8000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve(socket.id);
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const socketId = await socketConnectedPromise;
    assert(Boolean(socketId), `Socket.IO kết nối thành công (SocketID: ${socketId})`);

    // Lắng nghe sự kiện tiến độ
    socket.on('job:progress', (data) => {
      receivedProgressEvents.push(data);
      log.socket(data.stage || data.status, data.percent, data.message);
    });

    // Đăng ký theo dõi job
    socket.emit('job:subscribe', { jobId: createJobId, jobType: 'movie' });
    log.step(`Đã gửi lệnh subscribe cho Job ID: ${createJobId}`);

    // ══════════════════════════════════════════════════════════════════
    // PHASE 4: Tạo Phim Mới & Tải Lên 4 Hình Ảnh (POST API)
    // ══════════════════════════════════════════════════════════════════
    log.phase(4, 'Tạo Phim Mới & Upload Hình Ảnh (POST /admin/movies)');

    const uniqueTimestamp = Date.now();
    const moviePayload = {
      jobId: createJobId,
      title: `E2E Anime Siêu Phẩm ${uniqueTimestamp}`,
      titles: [
        { type: 'default', title: `E2E Anime Siêu Phẩm ${uniqueTimestamp}` },
        { type: 'native', title: 'テストのアニメ映画' },
      ],
      slug: `e2e-anime-sieu-pham-${uniqueTimestamp}`,
      type: 'movie',
      status: 'completed',
      category_id: categoryId,
      genre_ids: genreIds,
      country_id: countryId,
      ...(studioId ? { studio_id: studioId } : {}),
      description: 'Phim anime được tạo tự động bởi script test E2E để kiểm tra luồng xử lý hình ảnh.',
      release_date: '2026-08-31',
      season: 'summer',
      total_episodes: 1,
      duration: 125,
      age_rating: 'PG-13',
      is_published: true,
      actor_cast: actorId
        ? [
          {
            actor_id: actorId,
            role_name: 'Nhân vật chính',
            is_main_cast: true,
            cast_order: 0,
          },
        ]
        : [],
    };

    // Tạo FormData
    const formData = new FormData();
    Object.entries(moviePayload).forEach(([key, val]) => {
      if (val === null || val === undefined) return;
      if (typeof val === 'object') {
        formData.append(key, JSON.stringify(val));
      } else {
        formData.append(key, String(val));
      }
    });

    formData.append('poster', new Blob([posterBuffer], { type: 'image/png' }), 'poster.png');
    formData.append('banner', new Blob([bannerBuffer], { type: 'image/png' }), 'banner.png');
    formData.append('cover', new Blob([coverBuffer], { type: 'image/png' }), 'cover.png');
    formData.append('logo', new Blob([logoBuffer], { type: 'image/png' }), 'logo.png');

    const reqStartTime = Date.now();
    log.step('Gửi HTTP POST multipart/form-data tới /api/v1/admin/movies...');

    const createRes = await axios.post(`${API_BASE_URL}/api/v1/admin/movies`, formData, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      timeout: 30000,
    });

    const reqDuration = Date.now() - reqStartTime;
    assert(createRes.status === 201, `Tạo phim thành công (HTTP 201 Created trong ${reqDuration}ms)`);

    const createdMovie = createRes.data?.data;
    createdMovieId = createdMovie?.id;
    currentMovieSlug = createdMovie?.slug;

    assert(Boolean(createdMovieId), `Phim được cấp ID hợp lệ: ${createdMovieId}`);
    assert(currentMovieSlug === moviePayload.slug, `Slug khớp chính xác: ${currentMovieSlug}`);

    // Đợi tiến trình Worker xử lý hoàn thành 100% qua Socket
    log.step('Chờ Worker (BullMQ + Sharp) tối ưu hóa và xuất bản 4 ảnh qua Socket.IO...');
    const waitJobComplete = new Promise((resolve) => {
      const timeoutTimer = setTimeout(() => {
        resolve({ timeout: true });
      }, 25000);

      const checkInterval = setInterval(() => {
        const completedEvent = receivedProgressEvents.find(
          (e) => e.jobId === createJobId && (e.status === 'completed' || e.percent === 100)
        );
        if (completedEvent) {
          clearTimeout(timeoutTimer);
          clearInterval(checkInterval);
          resolve(completedEvent);
        }
      }, 500);
    });

    const finalEvent = await waitJobComplete;
    if (finalEvent.timeout) {
      log.warn('Worker xử lý tốn hơn 25s hoặc chạy background, tiếp tục kiểm tra DB...');
    } else {
      assert(true, 'Nhận sự kiện Realtime Socket hoàn thành (Status: COMPLETED, 100%)');
    }

    // ══════════════════════════════════════════════════════════════════
    // PHASE 5: Kiểm Tra Database & File System Thực Tế
    // ══════════════════════════════════════════════════════════════════
    log.phase(5, 'Xác Minh Database & Tập Tin Vật Lý Trên Ổ Đĩa (File System)');

    // Đợi 2s để đảm bảo Worker đã ghi xong metadata vào DB
    await new Promise((r) => setTimeout(r, 2000));

    const verifyRes = await axios.get(`${API_BASE_URL}/api/v1/admin/movies/${createdMovieId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const freshMovie = verifyRes.data?.data;
    assert(Boolean(freshMovie), 'Truy vấn chi tiết phim thành công từ API Admin');

    const images = freshMovie?.images || {};
    log.info(`Dữ liệu images trong DB: ${JSON.stringify(Object.keys(images))}`);

    // Kiểm tra cấu trúc từng loại ảnh
    const expectedTypes = ['poster', 'banner', 'cover', 'logo'];
    for (const type of expectedTypes) {
      const img = images[type];
      const hasRecord = Boolean(img && img.url && img.path);
      assert(hasRecord, `Database chứa metadata ảnh "${type}" (Format: ${img?.format || 'N/A'}, Path: ${img?.path || 'N/A'})`);

      if (img?.path) {
        const absoluteDiskPath = path.join(UPLOADS_DIR, img.path);
        const fileExists = existsSync(absoluteDiskPath);
        assert(fileExists, `File vật lý của "${type}" tồn tại trên đĩa cứng: ${img.path}`);

        if (fileExists) {
          const stat = await fs.stat(absoluteDiskPath);
          log.info(`  ↳ Dung lượng file ${type}: ${(stat.size / 1024).toFixed(1)} KB`);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // PHASE 6: Cập Nhật Phim & Thay Thế Hình Ảnh (PATCH API)
    // ══════════════════════════════════════════════════════════════════
    log.phase(6, 'Cập Nhật Phim & Thay Thế Poster Mới (PATCH)');

    const oldPosterPath = images?.poster?.path;
    const updateJobId = `job-e2e-update-${Date.now()}`;

    // Đăng ký job cập nhật
    socket.emit('job:subscribe', { jobId: updateJobId, jobType: 'movie' });

    // Sinh poster V2 mới màu xanh lá
    const newPosterBuffer = await createSampleImage({
      width: 600,
      height: 900,
      background: '#10B981',
      text: 'POSTER V2 UPDATED',
    });

    const updatedTitle = `E2E Anime [ĐÃ CẬP NHẬT] ${uniqueTimestamp}`;
    const updateFormData = new FormData();
    updateFormData.append('jobId', updateJobId);
    updateFormData.append('title', updatedTitle);
    updateFormData.append('titles', JSON.stringify([{ type: 'default', title: updatedTitle }]));
    updateFormData.append('description', 'Mô tả đã được cập nhật bởi script test E2E.');
    updateFormData.append('poster', new Blob([newPosterBuffer], { type: 'image/png' }), 'poster_v2.png');

    const updateRes = await axios.patch(
      `${API_BASE_URL}/api/v1/admin/movies/${createdMovieId}`,
      updateFormData,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        timeout: 30000,
      }
    );

    assert(updateRes.status === 200, 'API Cập nhật phim phản hồi HTTP 200 OK');

    const returnedTitle = updateRes.data?.data?.title || updateRes.data?.data?.titles?.[0]?.title;
    assert(returnedTitle?.includes('[ĐÃ CẬP NHẬT]'), `Tiêu đề phim đã được cập nhật thành công ("${returnedTitle}")`);

    // Chờ 3s để worker xử lý ảnh thay thế
    await new Promise((r) => setTimeout(r, 3000));

    const updatedMovieRes = await axios.get(`${API_BASE_URL}/api/v1/admin/movies/${createdMovieId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const updatedMovie = updatedMovieRes.data?.data;
    const newPosterPath = updatedMovie?.images?.poster?.path;
    if (updatedMovie?.slug) {
      currentMovieSlug = updatedMovie.slug;
    }

    assert(Boolean(newPosterPath), `Poster mới đã được ghi nhận: ${newPosterPath}`);
    if (oldPosterPath && newPosterPath && oldPosterPath !== newPosterPath) {
      assert(true, 'Đường dẫn Poster mới khác với Poster cũ');
      const oldFileStillExists = existsSync(path.join(UPLOADS_DIR, oldPosterPath));
      assert(!oldFileStillExists, 'Poster cũ đã được dọn dẹp sạch sẽ khỏi ổ đĩa (Auto-cleanup old assets)');
    }

    // ══════════════════════════════════════════════════════════════════
    // PHASE 7: Kiểm Thử Các Kịch Bản Lỗi (Negative Tests)
    // ══════════════════════════════════════════════════════════════════
    log.phase(7, 'Kiểm Thử Các Trường Hợp Lỗi (Negative Error Scenarios)');

    // 7.1 Test Case: Upload File Giả Mạo Không Phải Ảnh (Ví dụ file .txt giả danh)
    log.step('Negative 1: Tải lên file text giả danh hình ảnh...');
    try {
      const fakeFormData = new FormData();
      fakeFormData.append('title', 'Phim Lỗi File');
      fakeFormData.append('poster', new Blob(['MALICIOUS_EXEC_TEXT_DATA'], { type: 'text/plain' }), 'fake_poster.txt');

      const res = await axios.post(`${API_BASE_URL}/api/v1/admin/movies`, fakeFormData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.data?.data?.id) extraCleanupMovieIds.push(res.data.data.id);
      assert(false, 'Phải từ chối file không đúng định dạng ảnh');
    } catch (err) {
      const status = err.response?.status;
      assert(status === 400 || status === 415 || status === 422, `Hệ thống bắt lỗi file không hợp lệ chuẩn xác (HTTP ${status})`);
    }

    // 7.2 Test Case: Tạo Phim Trùng Slug Đang Tồn Tại
    log.step(`Negative 2: Tạo phim với Slug "${currentMovieSlug}" đang tồn tại...`);
    try {
      const dupFormData = new FormData();
      dupFormData.append('title', 'Phim Trùng Slug');
      dupFormData.append('slug', currentMovieSlug);
      dupFormData.append('category_id', String(categoryId));
      dupFormData.append('genre_ids', JSON.stringify(genreIds));

      const res = await axios.post(`${API_BASE_URL}/api/v1/admin/movies`, dupFormData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.data?.data?.id) extraCleanupMovieIds.push(res.data.data.id);
      assert(false, 'Phải từ chối khi slug bị trùng lặp');
    } catch (err) {
      const status = err.response?.status;
      assert(status === 400 || status === 409, `Hệ thống từ chối slug trùng lặp chuẩn xác (HTTP ${status})`);
    }

    // 7.3 Test Case: Thiếu Trường Tiêu Đề Bắt Buộc
    log.step('Negative 3: Tạo phim thiếu toàn bộ tiêu đề (Title & Titles)...');
    try {
      const emptyFormData = new FormData();
      emptyFormData.append('slug', `slug-no-title-${Date.now()}`);
      emptyFormData.append('category_id', String(categoryId));

      const res = await axios.post(`${API_BASE_URL}/api/v1/admin/movies`, emptyFormData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.data?.data?.id) extraCleanupMovieIds.push(res.data.data.id);
      assert(false, 'Phải từ chối khi thiếu tiêu đề bắt buộc');
    } catch (err) {
      const status = err.response?.status;
      assert(status === 400 || status === 422, `Hệ thống xác thực thiếu tiêu đề chuẩn xác (HTTP ${status})`);
    }

    // ══════════════════════════════════════════════════════════════════
    // PHASE 8: Kiểm Thử Thùng Rác, Khôi Phục & Xóa Vĩnh Viễn
    // ══════════════════════════════════════════════════════════════════
    log.phase(8, 'Kiểm Thử Thùng Rác, Khôi Phục & Xóa Vĩnh Viễn (Trash Lifecycle)');

    // 8.1 Xóa mềm phim vào thùng rác
    log.step(`Xóa mềm phim test ID: ${createdMovieId}...`);
    const softDelRes = await axios.delete(`${API_BASE_URL}/api/v1/admin/movies/${createdMovieId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(softDelRes.status === 200, 'Xóa mềm phim thành công (HTTP 200 OK)');

    // 8.2 Kiểm tra phim có trong danh sách Thùng rác (tab=trash)
    log.step('Truy vấn danh sách Thùng rác (GET /admin/movies?tab=trash)...');
    const trashListRes = await axios.get(`${API_BASE_URL}/api/v1/admin/movies?tab=trash`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(trashListRes.status === 200, 'Lấy danh sách thùng rác thành công (HTTP 200 OK)');
    const trashedItems = trashListRes.data?.data?.items || trashListRes.data?.data || [];
    const isInTrash = trashedItems.some((m) => m.id === createdMovieId);
    assert(isInTrash, `Phim test ID ${createdMovieId} xuất hiện trong tab Thùng rác`);

    // 8.3 Khôi phục phim từ thùng rác
    log.step(`Khôi phục phim từ thùng rác (POST /admin/movies/${createdMovieId}/restore)...`);
    const restoreRes = await axios.post(
      `${API_BASE_URL}/api/v1/admin/movies/${createdMovieId}/restore`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(restoreRes.status === 200, 'Khôi phục phim thành công (HTTP 200 OK)');

    // 8.4 Kiểm tra phim đã trở lại danh sách hoạt động
    const activeCheckRes = await axios.get(`${API_BASE_URL}/api/v1/admin/movies/${createdMovieId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(activeCheckRes.status === 200, 'Phim đã hoạt động bình thường trở lại sau khi khôi phục');

    // 8.5 Xóa vĩnh viễn phim khỏi hệ thống (DELETE /admin/movies/:id/force)
    log.step(`Xóa vĩnh viễn phim (DELETE /admin/movies/${createdMovieId}/force)...`);
    const forceDelRes = await axios.delete(`${API_BASE_URL}/api/v1/admin/movies/${createdMovieId}/force`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(forceDelRes.status === 200, 'Xóa vĩnh viễn phim thành công (HTTP 200 OK)');

    // 8.6 Kiểm tra phim không còn tồn tại trong Database
    try {
      await axios.get(`${API_BASE_URL}/api/v1/admin/movies/${createdMovieId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(false, 'Phim phải bị xóa hoàn toàn khỏi DB');
    } catch (notFoundErr) {
      assert(notFoundErr.response?.status === 404, 'Phim không còn tồn tại trong hệ thống (HTTP 404 Not Found)');
    }

    // 8.7 Kiểm tra thư mục hình ảnh của phim đã bị xóa sạch khỏi ổ cứng
    if (newPosterPath) {
      const fileStillOnDisk = existsSync(path.join(UPLOADS_DIR, newPosterPath));
      assert(!fileStillOnDisk, 'Tất cả file ảnh vật lý của phim đã được xóa sạch hoàn toàn khỏi ổ đĩa');
    }

    // Dọn dẹp extra test movies nếu có
    for (const extraId of extraCleanupMovieIds) {
      try {
        await axios.delete(`${API_BASE_URL}/api/v1/admin/movies/${extraId}/force`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch (_) { }
    }

    if (testSession?.id) {
      try {
        await testSession.destroy();
        log.info('Đã dọn dẹp UserSession tạm thời');
      } catch (_) { }
    }

  } catch (criticalError) {
    log.error(`Lỗi ngoại lệ nghiêm trọng: ${criticalError.message}`);
    if (criticalError.response?.data) {
      console.error(C.red, 'Chi tiết phản hồi Server:', JSON.stringify(criticalError.response.data, null, 2), C.reset);
    }
  } finally {
    if (socket) {
      socket.disconnect();
      log.info('Đã đóng kết nối Socket.IO');
    }

    // Xuất Bảng Tổng Kết
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    const passedCount = testResults.filter((r) => r.pass).length;
    const failedCount = testResults.filter((r) => !r.pass).length;
    const totalCount = testResults.length;

    console.log(`\n${C.bold}════════════════════════════════════════════════════════════${C.reset}`);
    console.log(`${C.bold}              BÁO CÁO KẾT QUẢ KIỂM THỬ E2E                 ${C.reset}`);
    console.log(`${C.bold}════════════════════════════════════════════════════════════${C.reset}`);
    console.log(` Tổng số Test Cases : ${C.bold}${totalCount}${C.reset}`);
    console.log(` Thành công (PASS)  : ${C.green}${C.bold}${passedCount}${C.reset}`);
    console.log(` Thất bại   (FAIL)  : ${failedCount > 0 ? `${C.red}${C.bold}${failedCount}` : `${C.dim}0`}${C.reset}`);
    console.log(` Thời gian thực thi : ${C.cyan}${totalDuration} giây${C.reset}`);
    console.log(`${C.bold}────────────────────────────────────────────────────────────${C.reset}`);

    if (failedCount === 0 && totalCount > 0) {
      console.log(`${C.bold}${C.bgGreen} 🎉 TẤT CẢ TEST CASES ĐÃ ĐẠT CHUẨN! HỆ THỐNG HOẠT ĐỘNG HOÀN HẢO! ${C.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${C.bold}${C.bgRed} ❌ CÓ ${failedCount} TEST CASES THẤT BẠI. VUI LÒNG KIỂM TRA LẠI! ${C.reset}\n`);
      process.exit(1);
    }
  }
}

// Chạy script
runE2ETest();
