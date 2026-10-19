/**
 * @file SocketProvider.jsx
 * @module App/Providers/Socket
 * @description Quản lý phân phối Socket Context, đồng bộ hóa xác thực Redux với Socket Lifecycle Architecture và cung cấp Dual State Machine Telemetry.
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectAccessToken, selectIsAuthenticated } from '@/store/slices/auth.slice';
import socketClient from '@/shared/lib/socket-client';
import { CONNECTION_STATUS, CONNECTION_STATES, AUTH_STATES } from '@/shared/constants/socket-events.constants';

export const SocketContext = createContext({
  socket: null,
  socketClient: null,
  connectionState: CONNECTION_STATES.DISCONNECTED,
  authState: AUTH_STATES.ANONYMOUS,
  status: CONNECTION_STATUS.DISCONNECTED,
  isConnected: false,
  isAuthenticated: false,
  isGuest: false,
  isReady: false,
  latency: 0,
  getDiagnostics: () => ({}),
  subscribeJob: () => {},
  unsubscribeJob: () => {},
  subscribeEpisode: () => {},
  unsubscribeEpisode: () => {},
  emit: () => {},
  emitWithAck: () => Promise.reject(new Error('Socket chưa sẵn sàng')),
  on: () => () => {},
  off: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const accessToken = useSelector(selectAccessToken);

  const [socketState, setSocketState] = useState(() => ({
    connectionState: socketClient.connectionState,
    authState: socketClient.authState,
    status: socketClient.getStatus(),
    latency: socketClient.latency,
    isConnected: socketClient.isConnected(),
    isAuthenticated: socketClient.isAuthenticated(),
    isGuest: socketClient.isGuest(),
  }));

  // 1. Lắng nghe và đồng bộ trạng thái Dual State Machine từ SocketClient
  useEffect(() => {
    const unsub = socketClient.onStateChange((stateSnapshot) => {
      setSocketState((prev) => {
        if (
          prev.connectionState === stateSnapshot.connectionState &&
          prev.authState === stateSnapshot.authState &&
          prev.status === stateSnapshot.status &&
          prev.latency === stateSnapshot.latency &&
          prev.isConnected === stateSnapshot.isConnected &&
          prev.isAuthenticated === stateSnapshot.isAuthenticated &&
          prev.isGuest === stateSnapshot.isGuest
        ) {
          return prev;
        }
        return stateSnapshot;
      });
    });

    return () => {
      unsub();
    };
  }, []);

  // 2. Đồng bộ hóa xác thực động (Initial connect & Soft Re-auth) theo Redux Store
  useEffect(() => {
    socketClient.updateAuth(accessToken);
  }, [accessToken, isAuthenticated]);

  // 3. Khởi tạo Global Socket Listeners cho JobStore
  useEffect(() => {
    const store = import('@/store/use-job-store');
    store.then(({ useJobStore }) => {
      useJobStore.getState().initSocketListeners();
    });
  }, []);

  // 3. Các hàm trợ năng được memoize
  const subscribeJob = useCallback((jobId, jobType) => {
    socketClient.subscribeJob(jobId, jobType);
  }, []);

  const unsubscribeJob = useCallback((jobId, jobType) => {
    socketClient.unsubscribeJob(jobId, jobType);
  }, []);

  const subscribeEpisode = useCallback((episodeId) => {
    socketClient.subscribeEpisode(episodeId);
  }, []);

  const unsubscribeEpisode = useCallback((episodeId) => {
    socketClient.unsubscribeEpisode(episodeId);
  }, []);

  const emit = useCallback((event, data, callback) => {
    socketClient.emit(event, data, callback);
  }, []);

  const emitWithAck = useCallback((event, data, timeout) => {
    return socketClient.emitWithAck(event, data, timeout);
  }, []);

  const on = useCallback((event, handler) => {
    return socketClient.on(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketClient.off(event, handler);
  }, []);

  const getDiagnostics = useCallback(() => {
    return socketClient.getDiagnostics();
  }, []);

  const contextValue = useMemo(() => {
    const isConnected = socketState.connectionState === CONNECTION_STATES.CONNECTED;
    const isAuth = socketState.authState === AUTH_STATES.AUTHENTICATED;
    const isGuestUser = socketState.authState === AUTH_STATES.ANONYMOUS;
    const isReady = isConnected && (isAuth || isGuestUser);

    return {
      socket: socketClient.getSocket(),
      socketClient,
      connectionState: socketState.connectionState,
      authState: socketState.authState,
      status: socketState.status,
      isConnected,
      isAuthenticated: isAuth,
      isGuest: isGuestUser,
      isReady,
      latency: socketState.latency,
      getDiagnostics,
      subscribeJob,
      unsubscribeJob,
      subscribeEpisode,
      unsubscribeEpisode,
      emit,
      emitWithAck,
      on,
      off,
    };
  }, [
    socketState,
    getDiagnostics,
    subscribeJob,
    unsubscribeJob,
    subscribeEpisode,
    unsubscribeEpisode,
    emit,
    emitWithAck,
    on,
    off,
  ]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
