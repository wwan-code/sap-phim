/**
 * @file socket.config.js
 * @module Config
 * @description Quản lý thiết lập truyền thông thời gian thực, cấu hình kết nối Socket.IO giữa Server và Client.
 */

import { env } from "./env.config.js";

const allowedOrigins = env.allowedOrigins || [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5000",
];

/**
 * Cấu hình Instance Socket.IO
 */
export const socketConfig = {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  connectTimeout: 45000,
  allowEIO3: true,
  maxHttpBufferSize: 1e6, // 1MB
  allowUpgrades: true,
  transports: ["polling", "websocket"],
  perMessageDeflate: { threshold: 1024 },

  // Khôi phục trạng thái kết nối
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: false, // Bắt buộc re-auth khi reconnect để đảm bảo token chưa bị revoke
  },
  ackTimeout: 10000,
};

export default socketConfig;

