import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Plugin biến đổi các câu lệnh import từ 'lucide-react' thành direct subpath imports
 * giúp loại bỏ 1500+ icons thừa và triệt tiêu gói 1.46MB trong dev/prod.
 */
function lucideIconTransformPlugin() {
  const lucideRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/gs;

  const toKebab = (str) =>
    str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
      .toLowerCase();

  return {
    name: 'vite-plugin-lucide-transform',
    enforce: 'pre',
    transform(code, id) {
      if (!id.match(/\.[jt]sx?$/) || id.includes('node_modules')) {
        return null;
      }
      if (!code.includes('lucide-react')) {
        return null;
      }

      let hasMatch = false;
      const transformed = code.replace(lucideRegex, (match, importsStr) => {
        hasMatch = true;
        const imports = importsStr
          .split(',')
          .map((s) => s.trim().replace(/\/\/.*/, ''))
          .filter(Boolean);

        const transformedImports = imports.map((item) => {
          const parts = item.split(/\s+as\s+/);
          const iconName = parts[0].trim();
          const localName = parts[1] ? parts[1].trim() : iconName;
          const fileName = toKebab(iconName);
          return `import ${localName} from 'lucide-react/dist/esm/icons/${fileName}.mjs';`;
        });

        return transformedImports.join('\n');
      });

      return hasMatch ? { code: transformed, map: null } : null;
    },
  };
}

export default defineConfig({
  plugins: [lucideIconTransformPlugin(), react()],

  optimizeDeps: {
    exclude: ['lucide-react'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@admin': path.resolve(__dirname, './src/admin'),
      '@app': path.resolve(__dirname, './src/app'),
      '@components': path.resolve(__dirname, './src/shared/components'),
      '@constants': path.resolve(__dirname, './src/shared/constants'),
      '@utils': path.resolve(__dirname, './src/shared/utils'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@config': path.resolve(__dirname, './src/config'),
      '@store': path.resolve(__dirname, './src/store'),
      '@services': path.resolve(__dirname, './src/shared/services'),
      '@lib': path.resolve(__dirname, './src/shared/lib'),
      '@routes': path.resolve(__dirname, './src/app/routes'),
      '@styles': path.resolve(__dirname, './src/assets/styles'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[Vite Proxy] /api error:', err.message);
          });
        },
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[Vite Proxy] /uploads error:', err.message);
          });
        },
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[Vite Proxy] Socket.IO error:', err.message);
          });
        },
      },
      '/upload/tus': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        autoRewrite: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[Vite Proxy] /upload/tus error:', err.message);
          });
        },
      },
      '/media': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[Vite Proxy] /media error:', err.message);
          });
        },
      },
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: true,

    rollupOptions: {
      output: {
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',

        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          // 1. Admin Portal Modules (Tách riêng từng module theo thư mục)
          if (normalizedId.includes('/src/admin/modules/')) {
            const match = normalizedId.match(/\/src\/admin\/modules\/([^/]+)/);
            if (match && match[1]) {
              return `chunk-admin-${match[1]}`;
            }
            return 'chunk-admin-modules';
          }

          // 2. Admin Core Shell (Layout, Sidebar, Header, Router, Store)
          if (
            normalizedId.includes('/src/admin/layout/') ||
            normalizedId.includes('/src/admin/router/') ||
            normalizedId.includes('/src/admin/store/') ||
            normalizedId.includes('/src/admin/shared/hooks/') ||
            normalizedId.includes('/src/admin/shared/components/seo/')
          ) {
            return 'chunk-admin-core';
          }

          // 3. Auth Chunks
          if (normalizedId.includes('/pages/auth/') || normalizedId.includes('/components/feature/auth/')) {
            return 'chunk-auth';
          }

          // 3. Icons (lucide-react tách riêng tải song song)
          if (normalizedId.includes('node_modules/lucide-react/')) return 'vendor-icons';

          // 4. Vendors
          if (normalizedId.includes('node_modules/framer-motion')) return 'vendor-animation';
          if (normalizedId.includes('node_modules/hls.js')) return 'vendor-video';
          if (
            normalizedId.includes('node_modules/socket.io-client') ||
            normalizedId.includes('node_modules/engine.io-client') ||
            normalizedId.includes('node_modules/@socket.io/')
          ) return 'vendor-realtime';
          if (normalizedId.includes('node_modules/swiper/')) return 'vendor-swiper';
          if (normalizedId.includes('node_modules/@floating-ui/')) return 'vendor-floating';

          if (
            normalizedId.includes('node_modules/react/') ||
            normalizedId.includes('node_modules/react-dom/') ||
            normalizedId.includes('node_modules/react-router-dom/') ||
            normalizedId.includes('node_modules/scheduler/')
          ) return 'vendor-react';

          if (
            normalizedId.includes('node_modules/@reduxjs/toolkit') ||
            normalizedId.includes('node_modules/react-redux') ||
            normalizedId.includes('node_modules/redux-persist') ||
            normalizedId.includes('node_modules/redux/')
          ) return 'vendor-redux';

          if (normalizedId.includes('node_modules/@tanstack/')) return 'vendor-query';
          if (normalizedId.includes('node_modules/@dnd-kit/')) return 'vendor-ui';
          if (normalizedId.includes('node_modules/zustand')) return 'vendor-zustand';
          if (normalizedId.includes('node_modules/recharts')) return 'vendor-charts';
        },
      },
    },
  },
});

