Bạn là **Senior Video Streaming Architect, Media Infrastructure & DevOps Engineer**.

### 1. Bối cảnh & Ràng buộc kiến trúc
Hãy rà soát toàn bộ codebase hiện tại của **Sạp Phim** (đặc biệt `Movie`, `Episode` với các trường `video_sources`, `status`, `processing_progress`, `sprite_url`, `vtt_url`), cơ chế Auth/RBAC, cấu hình Redis/BullMQ (`queue.config.js`, `redis.config.js`), Socket.IO và Video Player Client.
* **Nguyên tắc cốt lõi:** Không xây dựng hệ thống độc lập tách rời; phải tích hợp chặt chẽ vào hệ thống DB (PostgreSQL/Sequelize), Redis caching và Worker pool hiện hữu.

### 2. Thiết kế & Triển khai Video Processing Server chuyên trách
Xây dựng một Video Processing Server riêng biệt giao tiếp với Backend thông qua Event-driven & Internal API:

* **TUS Resumable Upload:**
  * Tiếp nhận file video dung lượng lớn qua chuẩn TUS protocol, hỗ trợ pause/resume, kiểm tra chunked checksum và timeout.
  * Tích hợp hook `onUploadFinish` để kích hoạt validation (ffprobe) và dispatch job vào BullMQ.

* **FFmpeg Adaptive Bitrate (ABR) HLS Pipeline:**
  * Transcode đa độ phân giải (4K, 2K, 1080p, 720p, 480p, 360p) chuẩn H.264/AAC với Closed GOP alignment (`-g 48 -keyint_min 48 -sc_threshold 0`).
  * Sinh HLS Master Playlist (`master.m3u8`) và các phân đoạn (`.ts`/`.m4s`, 4–6s).

* **Hệ thống Sprite Sheet Storyboard (Chuẩn YouTube Specification):**
  * **Dynamic Sampling & Grid Tiling:**
    * Tính toán khoảng thời gian lấy mẫu (interval) linh hoạt theo thời lượng phim (video ngắn: 1 frame/2s–5s; video dài: sample để đạt target ~100–150 frames toàn tập).
    * Resize chuẩn tỷ lệ 16:9 (kích thước mỗi thumbnail: `160x90` px).
    * Cơ chế **Multi-sheet Grids** (tối đa 5x5 hoặc 10x10 frames trên mỗi ảnh sprite) để hạn chế memory footprint và vượt quá giới hạn texture/canvas của trình duyệt. Xuất pattern: `storyboard_%03d.jpg` (chất lượng JPEG qscale=3-5 để tối ưu tải).
  * **WebVTT Media Fragments Parser:**
    * Tự động sinh file `storyboard.vtt` chứa cue time chuẩn xác kèm tọa độ fragment W3C Media Fragments URI:
      ```text
      WEBVTT

      00:00:00.000 --> 00:00:05.000
      storyboard_001.jpg#xywh=0,0,160,90

      00:00:05.000 --> 00:00:10.000
      storyboard_001.jpg#xywh=160,0,160,90
      ```
    * Tương thích hoàn toàn với cơ chế Seekbar Hover Preview của Video Player phía Client (Plyr, Video.js, hoặc Custom Canvas Scrubber).
  * Lưu trữ đường dẫn `vtt_url` và `sprite_url` trực tiếp vào model `Episode`.

* **Trạng thái & Realtime Feedback:**
  * Lắng nghe progress từ FFmpeg, chuẩn hóa 0–100% cho từng stage (`probing` -> `transcoding` -> `generating_sprites` -> `packaging`).
  * Webhook đồng bộ ngược lại Main Backend để lưu DB và phát sự kiện qua Socket.IO.

* **Phân phối & Nginx Proxy:**
  * Quy chuẩn đường dẫn lưu trữ tĩnh.
  * Cấu hình cache control tối ưu (`.m3u8` no-cache, `.ts` & `storyboard_*.jpg` immutable cache, hỗ trợ CORS & Byte-Range Requests).

### 3. Đầu ra yêu cầu
1. Kiến trúc luồng xử lý và sơ đồ sequence tương tác giữa các thành phần.
2. Mã nguồn hoàn chỉnh cho BullMQ Worker:
   * Thuật toán trích xuất frame + FFmpeg filter graph sinh multi-sheet grid.
   * Script sinh file WebVTT tọa độ xywh chuẩn xác.
3. Cấu hình Nginx reverse proxy và Docker Compose tích hợp vào hạ tầng hiện tại.