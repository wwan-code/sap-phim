/**
 * @file evidence-collector.test.mjs
 * @module AI_Evidence_Collector_Tests
 * @description Unit tests for EvidenceCollectorService enrichment and aggregation.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { EvidenceCollectorService } from "../services/evidence-collector.service.js";

test("enrichActorDetails limits outbound requests to maxActors and prioritizes new main cast", async () => {
  const collector = new EvidenceCollectorService();
  const calls = [];
  collector.fetchTMDBPerson = async (id) => {
    calls.push(id);
    return { name: `Actor ${id}`, gender: "female", birth_date: "1995-01-01", image_url: `/img/${id}.jpg` };
  };

  const actors = [
    { actor_name: "A", source: "tmdb", source_id: "1", is_new: false, is_main_cast: false },
    { actor_name: "B", source: "tmdb", source_id: "2", is_new: true, is_main_cast: true }, // high priority (40)
    { actor_name: "C", source: "tmdb", source_id: "3", is_new: true, is_main_cast: false }, // med priority (30)
    { actor_name: "D", source: "tmdb", source_id: "4", is_new: false, is_main_cast: true }, // low-med (20)
    { actor_name: "E", source: "tmdb", source_id: "5", is_new: true, is_main_cast: true }, // high priority (40)
  ];

  // Limit to max 2 actors
  const enriched = await collector.enrichActorDetails(actors, { maxActors: 2 });
  assert.equal(calls.length, 2);
  assert.ok(calls.includes("2"));
  assert.ok(calls.includes("5"));

  const actorB = enriched.find((a) => a.source_id === "2");
  assert.equal(actorB.enrichment_status, "enriched");
  assert.equal(actorB.birth_date, "1995-01-01");

  const actorA = enriched.find((a) => a.source_id === "1");
  assert.equal(actorA.enrichment_status, "skipped");
});

test("enrichDirectorDetails formats canonical director_metadata", async () => {
  const collector = new EvidenceCollectorService();
  collector.fetchTMDBPerson = async () => ({
    name: "Christopher Nolan",
    gender: "male",
    birth_date: "1970-07-30",
    biography: "Acclaimed filmmaker.",
    image_url: "/nolan.jpg",
  });

  const metadata = await collector.enrichDirectorDetails({
    directorName: "Christopher Nolan",
    tmdbDirectorId: 525,
  });

  assert.equal(metadata.schema_version, 1);
  assert.equal(metadata.primary, "tmdb:person:525");
  assert.equal(metadata.people.length, 1);
  assert.equal(metadata.people[0].name, "Christopher Nolan");
  assert.equal(metadata.people[0].credit_role, "Director");
  assert.equal(metadata.people[0].birth_date, "1970-07-30");
});

test("extractVisualAssets groups posters, covers and banners with proper aspect ratios", () => {
  const collector = new EvidenceCollectorService();
  const tmdb = { poster_path: "/tmdb-p.jpg", backdrop_path: "/tmdb-b.jpg" };
  const anilist = { cover_image: "/ani-c.jpg", banner_image: "/ani-b.jpg" };
  const jikan = { image_url: "/mal-p.jpg" };

  const assets = collector.extractVisualAssets(tmdb, anilist, jikan);
  assert.equal(assets.posters.length, 3);
  assert.equal(assets.covers.length, 1);
  assert.equal(assets.banners.length, 1);
  assert.equal(assets.covers[0].ratio, "16:9");
  assert.equal(assets.banners[0].ratio, "21:9");
});
