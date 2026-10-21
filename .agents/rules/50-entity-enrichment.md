---
trigger: model_decision
description: "Use when implementing or reviewing the AI Suggestion Movie Entity Enrichment feature, including Actor/Studio identity matching, TMDB/AniList evidence, Director metadata, database safety, and frontend suggestion output."
---

# Entity Enrichment — Repository Rule

- For AI Suggestion Entity Enrichment tasks, read the project plan `UPGRADE_PLAN_ENTITY_ENRICHMENT_V2.md` (at the location where it was installed) and inspect real repository files before coding.
- Keep the public `ENTITY_MATCHING` stage; enrich only on verified provider credits/IDs, never AI-invented identities.
- AniList voice actor = `Media.characters.edges.voiceActors`, not arbitrary `Media.staff`.
- Prevent duplicate Actor/Studio creation with source IDs and a tested atomic DB strategy; do not rely solely on slugs.
- Perform no Actor/Studio write until output validation succeeds; use one writer and one commit point.
- Existing Actor/Studio user-managed fields must not be overwritten by enrichment.
- Maintain legacy `suggested_entities` fields alongside v2 extensions.
- Preserve `Movie.director`, use additive `director_metadata` migration after DB validation.
- Cache positive person details for seven days; enforce 10 distinct actor enrich operations/request, bounded concurrency, timeout and abort.
- Do not synthesize nationality from birthplace, homeTown or language; preserve partial unknown data as null.
- Before completion, run actual tests/build/migrations possible in workspace and report precise evidence/limitations.
- Never run migrations or destructive actions against production without authorization.
