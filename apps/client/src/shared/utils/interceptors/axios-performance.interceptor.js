/**
 * @file axios-performance.interceptor.js
 * @module Shared/Utils/Interceptors
 * @description Đo lường thời gian thực thi request Axios và cảnh báo request chậm trong môi trường DEV.
 */

export function applyPerformanceInterceptor(axiosInstance) {
  if (!import.meta.env.DEV) return;

  axiosInstance.interceptors.request.use((config) => {
    config._startTime = performance.now();
    return config;
  });

  axiosInstance.interceptors.response.use(
    (response) => {
      const startTime = response.config?._startTime;
      if (startTime) {
        const duration = performance.now() - startTime;
        if (duration > 1500) {
          console.warn(
            `[Performance] Slow request: ${response.config.method?.toUpperCase()} ${response.config.url} took ${duration.toFixed(2)}ms`,
          );
        }
      }
      return response;
    },
    (error) => {
      const startTime = error.config?._startTime;
      if (startTime) {
        const duration = performance.now() - startTime;
        if (duration > 1500) {
          console.warn(
            `[Performance] Slow failed request: ${error.config?.method?.toUpperCase()} ${error.config?.url} took ${duration.toFixed(2)}ms`,
          );
        }
      }
      return Promise.reject(error);
    },
  );
}

export default applyPerformanceInterceptor;
