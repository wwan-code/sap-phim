import test from 'node:test';
import assert from 'node:assert/strict';

import { ROUTES } from '../../shared/constants/routes.constants.js';
import { lazyRoute } from './utils/lazy-route.js';

test('ROUTES constants should provide valid paths and dynamic builders', () => {
  assert.equal(ROUTES.HOME, '/');
  assert.equal(ROUTES.CATALOG, '/catalog');
  assert.equal(ROUTES.MOVIE_DETAIL(), '/movie/:slug');
  assert.equal(ROUTES.MOVIE_DETAIL('interstellar'), '/movie/interstellar');
  assert.equal(ROUTES.WATCH('interstellar', 'ep-1'), '/watch/interstellar/ep-1');
  assert.equal(ROUTES.RESET_PW_TOKEN('token-xyz'), '/reset-password/token-xyz');
  assert.equal(ROUTES.VERIFY_EMAIL_TOKEN('token-abc'), '/verify-email/token-abc');
  assert.equal(ROUTES.ADMIN.ROOT, '/admin');
  assert.equal(ROUTES.ADMIN.DASHBOARD, '/admin/dashboard');
  assert.equal(ROUTES.ADMIN.BROADCAST_SCHEDULES, '/admin/broadcast-schedules');
  assert.equal(ROUTES.ADMIN.MOVIES, '/admin/movies');
  assert.equal(ROUTES.ADMIN.MOVIE, '/admin/movies');
  assert.equal(ROUTES.ADMIN.MOVIE_CREATE, '/admin/movies/create');
  assert.equal(ROUTES.ADMIN.MOVIE_EDIT('123'), '/admin/movies/edit/123');
  assert.equal(ROUTES.ADMIN.SESSIONS, '/admin/sessions');
});

test('lazyRoute should wrap import function and return component correctly', async () => {
  const dummyModule = { default: { name: 'DummyDefault' }, NamedComp: { name: 'DummyNamed' } };
  const mockImporter = async () => dummyModule;

  const defaultLoader = lazyRoute(mockImporter);
  assert.equal(typeof defaultLoader.lazy, 'function');
  const resDefault = await defaultLoader.lazy();
  assert.equal(resDefault.Component.name, 'DummyDefault');

  const namedLoader = lazyRoute(mockImporter, 'NamedComp');
  const resNamed = await namedLoader.lazy();
  assert.equal(resNamed.Component.name, 'DummyNamed');
});
