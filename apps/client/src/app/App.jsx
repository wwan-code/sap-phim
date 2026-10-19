/**
 * @file App.jsx
 * @module App
 * @description Top-level App Component kết nối toàn bộ hệ sinh thái Providers
 */

import React from 'react';
import AppProviders from './providers/AppProviders';

export const App = () => {
  return <AppProviders />;
};

export default App;
