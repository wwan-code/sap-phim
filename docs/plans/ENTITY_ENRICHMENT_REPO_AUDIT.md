# Repository Audit — AI Suggestion Entity Enrichment
**Date:** 2026-10-20  
**Repository:** `sap-phim` (`d:\Project\ReactJS\sap-phim`)  
**Engineer:** Principal Fullstack Engineer + Database Reliability Engineer + Senior QA Engineer  

---

## 1. Confirmed Facts

### 1.1 Stack & Architecture
- **Runtime:** Node.js >= 22.15.0, ESM (`"type": "module"` in `apps/server/package.json`).
- **Framework:** Express 5.1.0, Sequelize 6.37.7 with PostgreSQL (`pg` 8.16.0), Redis (`ioredis` 5.8.2), BullMQ 5.80.10.
- **Testing:** Node.js native test runner (`node --test`), runner script at `apps/server/scripts/test-ai-platform.mjs`. All 51 existing AI tests pass in < 500ms.
- **Frontend:** React 18 / Vite with SCSS, BEM, and CSS custom properties (`--sp-*`). No Tailwind CSS. Admin module at `apps/client/src/admin/modules/movies/`.

### 1.2 Database Models & Schema
- **`Movie` (`movies`)**:
  - `director`: `STRING(255)`, `allowNull: true`.
  - Currently **no** `director_metadata` column.
  - Plural table name `movies`, `underscored: true`, paranoid with `deleted_at`.
- **`Actor` (`actors`)**:
  - `id`: `UUID` primary key (default UUIDV4).
  - `name`: `STRING(255)`, `allowNull: false`.
  - `slug`: `STRING(255)`, `allowNull: false`.
  - `image_url`: `TEXT`, `allowNull: true`.
  - `gender`: `STRING(20)`, enum: `['male', 'female', 'other', 'unknown']`.
  - `birth_date`: `DATEONLY`, `allowNull: true`.
  - `nationality`: `STRING(100)`, `allowNull: true`.
  - `biography`: `TEXT`, `allowNull: true`.
  - `description`: `TEXT`, `allowNull: true`.
  - `aliases`: `JSONB`, `defaultValue: []`.
  - `metadata`: `JSONB`, `defaultValue: {}`. Already in model and DB table!
  - `popularity_score`: `INTEGER`, default `0`.
  - `movies_count`: `INTEGER`, default `0`.
  - `is_active`: `BOOLEAN`, default `true`.
  - Indexes: partial unique on `slug` (`idx_actors_slug_active_unique` WHERE `deleted_at IS NULL`).
- **`Studio` (`studios`)**:
  - `id`: `UUID` primary key (default UUIDV4).
  - `name`: `STRING(255)`, `allowNull: false`.
  - `slug`: `STRING(255)`, `allowNull: false`.
  - `logo_url`: `TEXT`, `allowNull: true`.
  - `country`: `STRING(100)`, `allowNull: true`.
  - `description`: `TEXT`, `allowNull: true`.
  - `metadata`: `JSONB`, `defaultValue: {}`. Already in model and DB table!
  - `is_active`: `BOOLEAN`, default `true`.
  - Indexes: partial unique on `slug` (`idx_studios_slug_active_unique` WHERE `deleted_at IS NULL`).
- **`MovieActor` (`movie_actors`)**:
  - Links `movie_id` to `actor_id` with `character_name`, `role_name`, `character_image`, `cast_order`, `is_main_cast`.

### 1.3 AI Pipeline & Suggestion Flow
- Pipeline is asynchronous: client starts job via BullMQ queue, listens via WebSocket (`useJobSocket`).
- Pipeline flow:
  1. `EVIDENCE_COLLECTION`: `evidenceCollector.collectEvidence` (TMDB, AniList, Jikan, OMDb).
  2. `ENTITY_MATCHING`: `entityMatcher.matchRelationships` (genres, countries, studios, actors, series).
  3. `LLM_REASONING`: `aiOrchestrator.execute`.
  4. `SELF_AUDIT_VALIDATION`: `aiOutputValidator.validateAndSanitize`, `confidenceCalculator`.
  5. Suggestion completion: results stored in BullMQ job record. Suggestion does **not** create or modify `Movie` records in DB.
- Movie creation/updating is initiated manually by the admin on `MovieFormPage` after reviewing suggestions in `AISuggestionDrawer`.

---

## 2. Conflicts in Plan v1 vs Real Code & Resolutions (v2)

| Issue | Plan v1 Assumption | Real Code Finding | Resolution in v2 |
|---|---|---|---|
| Double write | Auto-create in both `matchActors()` and `ai-pipeline` loop | Dual creates cause race conditions and duplicates | **Single writer**: `commitEntities()` runs once after successful output validation |
| Dirty DB on error | Auto-create during `matchRelationships()` before LLM reasoning | If LLM fails or job is cancelled, orphan DB records remain | Deferred commit: no writes if validation fails or job aborts |
| Concurrency / Slug collision | Checked slug or name only | Same name or slug conflict causes unhandled exception | Deterministic slug disambiguation + atomic `findOrCreate` on `(metadata->>'source', metadata->>'source_id')` |
| Anime Voice Actors | AniList Staff queried for actors | Staff contains production crew, voice actors are in `Media.characters.edges.voiceActors` | AniList anime query includes `characters { edges { node { id name } voiceActors(language: JAPANESE) { id name image } } }` |
| Director Role | AniList treated any staff as director | Anime staff has many roles (Episode Director, Key Animation, etc.) | Filter for `role === 'Director'` or `Chief Director` |
| Nationality | Deduced from TMDB `place_of_birth` or AniList `homeTown` / `languageV2` | Birthplace and language are not nationality; causes incorrect facts | Leave `nationality: null` unless explicit valid nationality is provided |
| Backward Compatibility | Changed `suggested_entities` schema completely | Frontend mapper expects `actor_names`, `studio_name`, `country_name` | Additive response: retain all legacy fields, add v2 extended objects |

---

## 3. Missing Fields & Migrations Needed

1. **`movies.director_metadata`**:
   - Migration required: `ALTER TABLE movies ADD COLUMN IF NOT EXISTS director_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`
   - Model update: `director_metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }` in `movie.model.js`.
   - Whitelist in `movie.service.js` and `movie.validator.js`.
2. **Actor & Studio Source Identity Indexes**:
   - Both models already have `metadata: JSONB`.
   - Add partial unique indexes for source identity to prevent duplicate auto-creation under concurrent requests:
     - `idx_actors_source_identity`: on `( (metadata->>'source'), (metadata->>'source_id') ) WHERE deleted_at IS NULL AND (metadata->>'source_id') IS NOT NULL`
     - `idx_studios_source_identity`: on `( (metadata->>'source'), (metadata->>'source_id') ) WHERE deleted_at IS NULL AND (metadata->>'source_id') IS NOT NULL`

---

## 4. Side Effects & Commit Point

- **Read-only stage:** During `EVIDENCE_COLLECTION` and `ENTITY_MATCHING`, only queries and external API lookups occur. NO DB INSERTS.
- **Validation gate:** `aiOutputValidator.validateAndSanitize()` runs. If it fails or if the request was cancelled, execution halts immediately with zero writes.
- **Commit point:** `commitEntities()` runs in `ai-pipeline.service.js` *only* when suggestion is valid and `AI_ENTITY_AUTOCREATE_ENABLED` (feature flag, default true or configurable) is active.
- **Auditing:** Auto-created records have `metadata: { auto_created: true, source, source_id, created_at }` and `created_by: userId`.

---

## 5. External Source Schemas & Quotas

- **TMDB Person API:** `GET /3/person/{id}?language=vi-VN&append_to_response=translations`
  - Fields: `id`, `name`, `gender` (0: unspec, 1: female, 2: male, 3: non-binary), `birthday` (YYYY-MM-DD), `biography`, `profile_path`, `also_known_as`.
- **AniList Staff Query:** `Staff(id: $id) { id name { full native alternative } image { large } description(asHtml:false) gender dateOfBirth { year month day } }`
- **Cache Policy:**
  - Key: `ai:v2:person:{source}:{id}:{locale}`
  - TTL positive: 604,800 seconds (7 days)
  - TTL negative (404/not found): 900 seconds (15 minutes)
- **Budget per request:**
  - Max 10 distinct actor detail calls
  - Max 1 director detail call
  - Max concurrency: 3 concurrent outbound requests
  - Timeout per call: 8,000ms; abortable with `signal`
