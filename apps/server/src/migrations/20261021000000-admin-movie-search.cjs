/** Additive indexed search projection. Backfill is explicit and resumable. */
'use strict';
module.exports = {
  async up(q) {
    await q.sequelize.transaction(async (transaction) => {
      const run = (sql) => q.sequelize.query(sql, { transaction });
      await run('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await run("CREATE COLLATION IF NOT EXISTS sp_search_unicode (provider = icu, locale = 'und', deterministic = true)");
      await run(`CREATE OR REPLACE FUNCTION sp_search_normalize(value text, fold boolean DEFAULT true) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
        SELECT trim(regexp_replace(CASE WHEN fold THEN translate(lower(normalize(coalesce(value,''), NFKC) COLLATE sp_search_unicode),
          'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
          repeat('a',17)||repeat('e',11)||repeat('i',5)||repeat('o',17)||repeat('u',11)||repeat('y',5)||'d')
          ELSE lower(normalize(coalesce(value,''), NFKC) COLLATE sp_search_unicode) END COLLATE sp_search_unicode, '[^[:alnum:]]+', ' ', 'g')) $$`);
      await run(`CREATE TABLE IF NOT EXISTS movie_search_state (id integer PRIMARY KEY CHECK(id=1), last_id uuid, ready boolean NOT NULL DEFAULT false);
        INSERT INTO movie_search_state(id) VALUES(1) ON CONFLICT DO NOTHING;
        CREATE TABLE IF NOT EXISTS movie_search_documents (
          movie_id uuid NOT NULL REFERENCES movies(id) ON DELETE CASCADE, field text NOT NULL,
          value text NOT NULL, normalized text COLLATE sp_search_unicode NOT NULL, folded text COLLATE sp_search_unicode NOT NULL, tokens tsvector NOT NULL);
        CREATE INDEX IF NOT EXISTS movie_search_owner ON movie_search_documents(movie_id,field);
        CREATE INDEX IF NOT EXISTS movie_search_exact ON movie_search_documents(folded);
        CREATE INDEX IF NOT EXISTS movie_search_fuzzy ON movie_search_documents USING gin(folded gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS movie_search_tokens ON movie_search_documents USING gin(tokens);`);
      await run(`CREATE OR REPLACE FUNCTION sp_refresh_movie_search(target uuid) RETURNS void LANGUAGE plpgsql AS $$
        BEGIN
          PERFORM pg_advisory_xact_lock(hashtextextended('search:'||target::text,0));
          DELETE FROM movie_search_documents WHERE movie_id=target;
          INSERT INTO movie_search_documents(movie_id,field,value,normalized,folded,tokens)
          SELECT target,field,value,sp_search_normalize(value,false),sp_search_normalize(value,true),
            to_tsvector('simple',sp_search_normalize(value,true)) FROM (
            SELECT 'title' AS field, t->>'title' AS value FROM movies m,
              jsonb_array_elements(CASE WHEN jsonb_typeof(m.titles)='array' THEN m.titles ELSE '[]'::jsonb END) t WHERE m.id=target
            UNION SELECT 'director',director FROM movies WHERE id=target
            UNION SELECT 'studio',s.name FROM movies m JOIN studios s ON s.id=m.studio_id AND s.deleted_at IS NULL WHERE m.id=target
            UNION SELECT 'actor',a.name FROM movie_actors ma JOIN actors a ON a.id=ma.actor_id AND a.deleted_at IS NULL WHERE ma.movie_id=target
            UNION SELECT 'actor',j.value FROM movie_actors ma JOIN actors a ON a.id=ma.actor_id AND a.deleted_at IS NULL,
              jsonb_array_elements_text(CASE WHEN jsonb_typeof(a.aliases)='array' THEN a.aliases ELSE '[]'::jsonb END) j WHERE ma.movie_id=target
          ) names WHERE value IS NOT NULL AND sp_search_normalize(value,true)<>'';
        END $$`);
      await run(`CREATE OR REPLACE FUNCTION sp_movie_search_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE target uuid;
        BEGIN
          IF TG_TABLE_NAME='movies' THEN PERFORM sp_refresh_movie_search(NEW.id);
          ELSIF TG_TABLE_NAME='movie_actors' THEN
            IF TG_OP<>'INSERT' THEN PERFORM sp_refresh_movie_search(OLD.movie_id); END IF;
            IF TG_OP<>'DELETE' THEN PERFORM sp_refresh_movie_search(NEW.movie_id); END IF;
          ELSIF TG_TABLE_NAME='actors' THEN
            FOR target IN SELECT movie_id FROM movie_actors WHERE actor_id=NEW.id ORDER BY movie_id LOOP PERFORM sp_refresh_movie_search(target); END LOOP;
          ELSIF TG_TABLE_NAME='studios' THEN
            FOR target IN SELECT id FROM movies WHERE studio_id=NEW.id ORDER BY id LOOP PERFORM sp_refresh_movie_search(target); END LOOP;
          END IF;
          RETURN NULL;
        END $$;
        CREATE TRIGGER movie_search_movie AFTER INSERT OR UPDATE OF titles,director,studio_id ON movies FOR EACH ROW EXECUTE FUNCTION sp_movie_search_trigger();
        CREATE TRIGGER movie_search_cast AFTER INSERT OR UPDATE OR DELETE ON movie_actors FOR EACH ROW EXECUTE FUNCTION sp_movie_search_trigger();
        CREATE TRIGGER movie_search_actor AFTER UPDATE OF name,aliases,deleted_at ON actors FOR EACH ROW EXECUTE FUNCTION sp_movie_search_trigger();
        CREATE TRIGGER movie_search_studio AFTER UPDATE OF name,deleted_at ON studios FOR EACH ROW EXECUTE FUNCTION sp_movie_search_trigger();`);
    });
  },
  async down(q) {
    await q.sequelize.transaction(async (transaction) => {
      await q.sequelize.query(`DROP TRIGGER IF EXISTS movie_search_movie ON movies; DROP TRIGGER IF EXISTS movie_search_cast ON movie_actors;
        DROP TRIGGER IF EXISTS movie_search_actor ON actors; DROP TRIGGER IF EXISTS movie_search_studio ON studios;
        DROP FUNCTION IF EXISTS sp_movie_search_trigger(); DROP FUNCTION IF EXISTS sp_refresh_movie_search(uuid);
        DROP TABLE IF EXISTS movie_search_documents; DROP TABLE IF EXISTS movie_search_state; DROP FUNCTION IF EXISTS sp_search_normalize(text,boolean); DROP COLLATION IF EXISTS sp_search_unicode;`, { transaction });
    });
  },
};
