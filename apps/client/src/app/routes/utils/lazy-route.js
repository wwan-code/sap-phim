/**
 * @file lazy-route.js
 * @module Routes/Utils/LazyRoute
 * @description Utility wrapper chuan hoa co che code-splitting lazy load cua React Router v7 Data Router cho default va named exports.
 */

/**
 * Tao lazy route loader cho React Router (Data Router v6.4+ / v7)
 * @param {() => Promise<any>} importer - Ham dynamic import
 * @param {string} [exportName='default'] - Ten component duoc export tu module
 * @returns {{ lazy: () => Promise<{ Component: any }> }}
 */
export const lazyRoute = (importer, exportName = 'default') => ({
  lazy: async () => {
    const module = await importer();
    const Component = exportName === 'default' ? (module.default || module) : module[exportName];
    if (!Component) {
      throw new Error('LazyRoute Component not found');
    }
    return { Component };
  },
});

export default lazyRoute;
