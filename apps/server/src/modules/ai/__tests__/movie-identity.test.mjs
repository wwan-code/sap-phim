/**
 * @file movie-identity.test.mjs
 * @module AI_Movie_Identity_Tests
 * @description Unit tests for title folding, search ranking and identity matching utilities.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  foldSearchTitle,
  normalizeTitle,
  identityYear,
  normalizeMediaType,
  sameWork,
  selectUnambiguousCandidate,
} from "../helpers/ai-metadata.helper.js";

test("Vietnamese folding normalizes diacritics and casing for fuzzy lookup", () => {
  assert.equal(foldSearchTitle("Hắc Tứ Kỵ Sĩ"), "hac tu ky si");
  assert.equal(foldSearchTitle("Đại Chiến Titan"), "dai chien titan");
  assert.equal(foldSearchTitle("   Naruto: Shippūden  "), "naruto shippuden");
});

test("normalizeMediaType correctly maps alias formats", () => {
  assert.equal(normalizeMediaType("movie"), "movie");
  assert.equal(normalizeMediaType("TV"), "series");
  assert.equal(normalizeMediaType("TV_SHORT"), "series");
  assert.equal(normalizeMediaType("ova"), "ova");
  assert.equal(normalizeMediaType("ona"), "ona");
  assert.equal(normalizeMediaType("SPECIAL"), "special");
  assert.equal(normalizeMediaType("UNKNOWN"), null);
});

test("identityYear parses 4-digit years from ISO dates or strings", () => {
  assert.equal(identityYear("2017-10-03"), 2017);
  assert.equal(identityYear(2020), 2020);
  assert.equal(identityYear("2024"), 2024);
  assert.equal(identityYear("invalid"), null);
});

test("sameWork requires cross-source ID consensus or strong title+year match", () => {
  const candA = {
    title: "Black Clover",
    year: 2017,
    mediaType: "series",
    sourceIds: { anilist: 97940, mal: 34572 },
  };
  const candB = {
    title: "Black Clover",
    year: 2017,
    mediaType: "series",
    sourceIds: { mal: 34572 },
  };
  const candC = {
    title: "Black Clover: Sword of the Wizard King",
    year: 2023,
    mediaType: "movie",
    sourceIds: { anilist: 132473 },
  };

  assert.equal(sameWork(candA, candB), true); // Shared MAL ID
  assert.equal(sameWork(candA, candC), false); // Different work
});

test("selectUnambiguousCandidate picks the single exact match or null if ambiguous", () => {
  const candidates = [
    { title: "Solo Leveling", year: 2024, mediaType: "series" },
    { title: "Solo Leveling: ReAwakening", year: 2024, mediaType: "movie" },
  ];

  // Specific mediaType and year
  const picked = selectUnambiguousCandidate(candidates, {
    title: "Solo Leveling",
    year: 2024,
    mediaType: "series",
  });
  assert.equal(picked?.title, "Solo Leveling");
  assert.equal(picked?.mediaType, "series");
});
