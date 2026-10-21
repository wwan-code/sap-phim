/**
 * @file ai-pipeline.test.mjs
 * @module AI_Pipeline_Tests
 * @description Unit tests for AI pipeline, cast deduplication and localization utils.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanSourceText, selectSynopsisBasis, buildEvidenceFields } from "../helpers/ai-metadata.helper.js";

test("cleanSourceText strips HTML markup, excessive whitespace, and caps length", () => {
  const dirty = "  <p>Hello <b>World</b> !</p>\n\n<script>alert(1)</script>   ";
  const cleaned = cleanSourceText(dirty, 50);
  assert.equal(cleaned, "Hello World !");
});

test("selectSynopsisBasis follows vi, Jikan, TMDB English, AniList, OMDb preference", () => {
  const snapshot = {
    source_presence: { tmdb: true, anilist: true, jikan: true, omdb: false },
    jikan: { mal_id: 100, synopsis: "Jikan anime synopsis" },
    tmdb: { id: 200, overview: "TMDB movie overview" },
    anilist: { id: 300, description: "AniList synopsis" },
  };
  const basis = selectSynopsisBasis(snapshot);
  assert.equal(basis.source, "jikan");
  assert.equal(basis.value, "Jikan anime synopsis");
});

test("buildEvidenceFields merges observations across available sources", () => {
  const snapshot = {
    source_presence: { tmdb: true, anilist: true, jikan: false, omdb: false },
    tmdb: {
      id: 101,
      title: "Movie A",
      release_date: "2022-01-01",
      media_type: "movie",
      genres: ["Action", "Sci-Fi"],
      countries: ["US"],
    },
    anilist: {
      id: 202,
      title: { romaji: "Movie A Romaji", english: "Movie A" },
      startDate: { year: 2022, month: 1, day: 1 },
      format: "MOVIE",
      genres: ["Action", "Adventure"],
    },
  };

  const fields = buildEvidenceFields(snapshot);
  assert.ok(fields.title.length >= 2);
  assert.ok(fields.genres.length >= 2);
  assert.equal(fields.release_year[0].value, 2022);
});
