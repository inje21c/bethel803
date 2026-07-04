\set ON_ERROR_STOP on

\if :{?supabase_url}
\else
\echo 'Usage: psql "$DB_URL" -v supabase_url=https://PROJECT_REF.supabase.co -f scripts/setup_fetch_devotional_cron.sql'
\quit 1
\endif

-- Supabase cron uses UTC.
-- 00:10 KST = 15:10 UTC on the previous day.
-- 06:00 KST = 21:00 UTC on the previous day.
--
-- The 06:00 KST job is intentionally kept as a backup retry. If the source
-- site is not ready at 00:10, fetch-devotional will try again in the morning.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY ARRAY[
    'fetch-devotional-daily',
    'fetch-devotional-0010-kst',
    'fetch-devotional-0600-kst'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
      PERFORM cron.unschedule(job_name);
    END IF;
  END LOOP;
END $$;

SELECT cron.schedule(
  'fetch-devotional-0010-kst',
  '10 15 * * *',
  format(
    $job$
      SELECT net.http_post(
        url := %L,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;
    $job$,
    :'supabase_url' || '/functions/v1/fetch-devotional'
  )
);

SELECT cron.schedule(
  'fetch-devotional-0600-kst',
  '0 21 * * *',
  format(
    $job$
      SELECT net.http_post(
        url := %L,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;
    $job$,
    :'supabase_url' || '/functions/v1/fetch-devotional'
  )
);

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'fetch-devotional%'
ORDER BY jobname;
