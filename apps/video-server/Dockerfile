# =============================================================
# Dockerfile: Sạp Phim Video Processing Server (Node.js + FFmpeg)
# =============================================================

FROM node:20-alpine

# Cài đặt FFmpeg và FFprobe từ Alpine package manager
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files và cài đặt dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy mã nguồn server
COPY . .

# Tạo thư mục lưu trữ uploads và media
RUN mkdir -p storage/uploads storage/media

EXPOSE 3002

ENV NODE_ENV=production
ENV PORT=3002

CMD ["node", "server.js"]
