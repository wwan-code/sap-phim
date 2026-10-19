<!--
@file README.md
@module Repository
@description Giới thiệu và hướng dẫn chạy dự án Sạp Phim.
-->

# Sạp Phim

Nền tảng phim/anime gồm website React, trang quản trị, API Express và dịch vụ xử lý video riêng. AI Suggest Movie đối chiếu thông tin tác phẩm, hiển thị nguồn/chứng cứ và để quản trị viên duyệt trước khi cập nhật form.

## Cấu trúc

| Thư mục | Chức năng |
| --- | --- |
| `apps/client` | React + Vite, website và giao diện quản trị |
| `apps/server` | Express, PostgreSQL/Sequelize, Redis, Socket.IO, AI Suggest |
| `apps/video-server` | Upload TUS, BullMQ và xử lý video bằng FFmpeg |
| `nginx` | Gateway cho video và upload |
| `docs` | Tài liệu triển khai tính năng |

## Chạy local

Cần Node.js **22.15 trở lên**, npm, PostgreSQL, Redis và FFmpeg/FFprobe cho xử lý video. Docker Compose cung cấp Redis, Jikan và các dịch vụ video/gateway; PostgreSQL cần được chuẩn bị riêng.

```bash
npm install
```

Sao chép các file mẫu sau và điền cấu hình riêng:

- `.env.example` → `.env` nếu dùng Docker Compose.
- `apps/client/.env.example` → `apps/client/.env`.
- `apps/server/.env.example` → `apps/server/.env`.
- `apps/video-server/.env.example` → `apps/video-server/.env`.

Tạo database PostgreSQL theo `DB_NAME`. Điền `DB_PASSWORD`, hai JWT secret khác nhau, khóa nội bộ video và upload secret. Redis password, khóa nội bộ và upload secret phải khớp giữa các dịch vụ như chú thích trong file mẫu. Có thể sinh một giá trị ngẫu nhiên bằng:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Nếu dùng Docker Redis:

```bash
docker compose up -d redis-server
```

Chạy migration và seed trên database local đã cấu hình:

```bash
npm run migrate --workspace=apps/server
npm run seed --workspace=apps/server
npm run dev:all
```

Frontend: `http://localhost:5173`. Backend: `http://localhost:5000`. Dịch vụ video: `http://localhost:3002`.

## Kiểm tra

```bash
npm test
npm run build
npm run lint --workspace=apps/client
```

Kiểm thử AI dùng provider/nguồn dữ liệu giả lập. Xem [AI Suggest Movie v2](docs/ai-suggest-rollout.md) để cấu hình provider miễn phí, chạy kiểm thử hợp đồng và triển khai worker.

## Cấu hình riêng

Các file `.env`, khóa riêng, `node_modules`, bản build, log, dữ liệu upload/video và artifact QA không được đưa lên Git. Chỉ các file `.env.example` với giá trị mẫu được quản lý trong repository. Các biến `VITE_*` được gửi xuống trình duyệt, vì vậy chỉ dùng cho cấu hình công khai.
