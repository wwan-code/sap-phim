/**
 * @file index.jsx
 * @module Root
 * @description Entry point của ứng dụng Sạp Phim, khởi tạo React DOM và Web Vitals
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app/App';
import '@/assets/styles/index.scss';

// --- Web Vitals (production & development) ------------------------------------

if (import.meta.env.PROD) {
  import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    const reportMetric = (metric) => {
      const payload = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
      });

      if (navigator.sendBeacon) {
        const body = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/analytics/vitals', body);
        return;
      }

      fetch('/api/v1/analytics/vitals', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    };

    [onCLS, onFCP, onINP, onLCP, onTTFB]
      .filter(Boolean)
      .forEach((observe) => observe(reportMetric));
  }).catch(() => {});
}

if (import.meta.env.DEV) {
  import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    const logMetric = ({ name, value, rating }) => {
      console.log(`[Performance][WebVital] ${name}: ${value.toFixed(1)} (${rating})`);
    };

    [onCLS, onFCP, onINP, onLCP, onTTFB]
      .filter(Boolean)
      .forEach((observe) => observe(logMetric));
  }).catch(() => {});
}

// --- App Render ---------------------------------------------------------------

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
