import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer from './slices/auth.slice';
import notificationReducer from './slices/notification.slice';

const rootReducer = combineReducers({
  auth: authReducer,
  notification: notificationReducer,
});

const persistConfig = {
  key: 'sap-phim-root',
  storage,
  whitelist: ['auth', 'notification'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: import.meta.env.DEV,
});

let resolveRehydration;
export const waitForRehydration = new Promise((resolve) => {
  resolveRehydration = resolve;
});

export const persistor = persistStore(store, null, () => {
  resolveRehydration(true);
});

export default store;
