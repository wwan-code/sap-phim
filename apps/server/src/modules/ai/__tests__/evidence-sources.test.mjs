/**
 * @file evidence-sources.test.mjs
 * @module AI_Evidence_Sources_Tests
 * @description Isolated unit tests for modular evidence sources (TMDB, AniList, Jikan, OMDb).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fetchTMDBPerson,
  searchTMDB,
  fetchTMDB,
  fetchAniListStaff,
  searchAniList,
  fetchAniList,
  normalizeAnime,
  detectSourceType,
  JikanRateLimiter,
  normalizeJikan,
  searchJikan,
  fetchJikan,
  searchOMDb,
  fetchOMDb,
} from "../helpers/ai-sources.helper.js";

// --- TMDB Source Tests ---

test("fetchTMDBPerson normalizes genders and preserves strict dates without guessing nationality", async () => {
  const fakeHttp = {
    get: async () => ({
      data: {
        id: 999,
        name: "Test Person",
        gender: 1, // female
        birthday: "1990-05-12",
        biography: "A talented voice actress.",
        profile_path: "/test.jpg",
        also_known_as: ["Alias A", "Alias B"],
        place_of_birth: "Tokyo, Japan",
        known_for_department: "Acting",
      },
    }),
  };
  const fakeCache = {
    store: new Map(),
    get: async (k) => fakeCache.store.get(k),
    set: async (k, v) => fakeCache.store.set(k, v),
  };
  const config = {
    tmdb: { enabled: true, apiKey: "fake", baseUrl: "https://api.tmdb", imageBaseUrl: "https://image.tmdb" },
  };

  const person = await fetchTMDBPerson(fakeHttp, config, fakeCache, 999);
  assert.equal(person.name, "Test Person");
  assert.equal(person.gender, "female");
  assert.equal(person.birth_date, "1990-05-12");
  assert.equal(person.nationality, null); // Strictly never guessed
  assert.equal(person.image_url, "https://image.tmdb/w300/test.jpg");
  assert.deepEqual(person.aliases, ["Alias A", "Alias B"]);
});

test("fetchTMDBPerson caches negative result on 404", async () => {
  const fakeHttp = {
    get: async () => {
      const err = new Error("Not Found");
      err.response = { status: 404 };
      throw err;
    },
  };
  const fakeCache = {
    store: new Map(),
    get: async (k) => fakeCache.store.get(k),
    set: async (k, v) => fakeCache.store.set(k, v),
  };
  const config = {
    tmdb: { enabled: true, apiKey: "fake", baseUrl: "https://api.tmdb", imageBaseUrl: "https://image.tmdb" },
  };

  const result = await fetchTMDBPerson(fakeHttp, config, fakeCache, 40404);
  assert.equal(result, null);
  assert.equal(fakeCache.store.get("ai:v2:person:tmdb:40404:vi-VN")?.not_found, true);
});

// --- AniList Source Tests ---

test("fetchAniListStaff handles partial FuzzyDate, cleans description, and preserves null nationality", async () => {
  const fakeHttp = {
    post: async () => ({
      data: {
        data: {
          Staff: {
            id: 1234,
            name: { full: "Kana Hanazawa", native: "花澤香菜", alternative: ["HanaKana"] },
            gender: "Female",
            dateOfBirth: { year: 1989, month: 2, day: 25 },
            description: "<b>Kana Hanazawa</b> is a Japanese voice actress.",
            image: { large: "https://anilist.co/staff.jpg" },
            homeTown: "Tokyo",
          },
        },
      },
    }),
  };
  const fakeCache = {
    store: new Map(),
    get: async (k) => fakeCache.store.get(k),
    set: async (k, v) => fakeCache.store.set(k, v),
  };

  const staff = await fetchAniListStaff(fakeHttp, fakeCache, 1234);
  assert.equal(staff.name, "Kana Hanazawa");
  assert.equal(staff.gender, "female");
  assert.equal(staff.birth_date, "1989-02-25");
  assert.equal(staff.nationality, null);
  assert.equal(staff.biography, "Kana Hanazawa is a Japanese voice actress.");
  assert.deepEqual(staff.aliases, ["HanaKana", "花澤香菜"]);
});

test("detectSourceType maps known manga/light novel/original sources", () => {
  assert.equal(detectSourceType({ source: "MANGA" }), "manga");
  assert.equal(detectSourceType({ source: "LIGHT_NOVEL" }), "light_novel");
  assert.equal(detectSourceType({ source: "ORIGINAL" }), "original");
  assert.equal(detectSourceType({ source: "UNKNOWN_OTHER" }), null);
});

// --- Jikan Source Tests ---

test("JikanRateLimiter acquires sequentially within limit", async () => {
  const limiter = new JikanRateLimiter(10);
  assert.ok(limiter);
  await limiter.acquire();
  assert.ok(limiter.nextAt > 0);
});

test("normalizeJikan extracts large image url and cleans studios/genres", () => {
  const raw = {
    title: "Black Clover",
    genres: [{ name: "Action" }, { name: "Fantasy" }],
    studios: [{ name: "Studio Pierrot" }],
    images: { jpg: { large_image_url: "https://cdn.myanimelist.net/large.jpg" } },
  };
  const normalized = normalizeJikan(raw);
  assert.deepEqual(normalized.genres, ["Action", "Fantasy"]);
  assert.deepEqual(normalized.studios, ["Studio Pierrot"]);
  assert.equal(normalized.image_url, "https://cdn.myanimelist.net/large.jpg");
});

// --- OMDb Source Tests ---

test("searchOMDb returns empty array when omdb is disabled in config", async () => {
  const results = await searchOMDb({}, { omdb: { enabled: false } }, { title: "Avatar" });
  assert.deepEqual(results, []);
});
