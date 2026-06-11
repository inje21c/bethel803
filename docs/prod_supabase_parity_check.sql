-- Production Supabase parity check for bethel803.
-- Run this script in both staging/preview Supabase and production Supabase,
-- then compare the result sets before production cutover.
--
-- Notes:
-- - The SELECT sections are read-only.
-- - The DO block at the end only reads data and emits NOTICE lines.

-- 1. 021 SaaS church-scope schema objects
WITH expected_columns(table_name, column_name) AS (
  VALUES
    ('churches', 'id'),
    ('churches', 'slug'),
    ('churches', 'status'),
    ('churches', 'plan'),
    ('churches', 'billing_status'),
    ('districts', 'church_id'),
    ('users', 'church_id')
)
SELECT
  'expected_column' AS check_type,
  e.table_name,
  e.column_name,
  CASE WHEN c.column_name IS NULL THEN 'missing' ELSE 'ok' END AS status
FROM expected_columns e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name
ORDER BY e.table_name, e.column_name;

-- 2. Helper functions and RPCs used by the app
WITH expected_functions(function_name) AS (
  VALUES
    ('get_my_district_id'),
    ('get_my_church_id'),
    ('is_active'),
    ('is_church_master'),
    ('is_church_leader'),
    ('sync_user_church_from_district'),
    ('prevent_district_church_change_with_users'),
    ('enforce_user_scope_change_master_only'),
    ('enforce_role_change_master_only'),
    ('handle_new_user'),
    ('create_bible_study_from_source'),
    ('compute_weekly_report'),
    ('get_total_chapters'),
    ('get_bible_reading_summaries'),
    ('get_bible_reading_summaries_by_range'),
    ('get_qt_district_summary')
)
SELECT
  'expected_function' AS check_type,
  e.function_name,
  CASE WHEN p.proname IS NULL THEN 'missing' ELSE 'ok' END AS status
FROM expected_functions e
LEFT JOIN pg_proc p
  ON p.pronamespace = 'public'::regnamespace
 AND p.proname = e.function_name
GROUP BY e.function_name, p.proname
ORDER BY e.function_name;

-- 3. RLS policies that are most likely to cause preview/prod behavior differences
SELECT
  'rls_policy' AS check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'churches',
    'districts',
    'users',
    'bible_studies',
    'study_answers',
    'prayer_requests',
    'prayer_responses',
    'prayer_intercessions',
    'bible_reading_logs',
    'schedules',
    'attendances',
    'weekly_reports',
    'notifications'
  )
ORDER BY tablename, policyname;

-- 4. Triggers that keep church scope consistent
SELECT
  'trigger' AS check_type,
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'churches_updated_at',
    'sync_user_church',
    'prevent_district_church_change',
    'enforce_user_scope_change'
  )
ORDER BY table_name, trigger_name, event_manipulation;

-- 5. Constraints and indexes that affect inserts/updates
SELECT
  'constraint' AS check_type,
  conrelid::regclass::text AS table_name,
  conname,
  contype,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conname IN (
    'churches_status_check',
    'churches_plan_check',
    'churches_billing_status_check',
    'districts_church_id_fkey',
    'users_church_id_fkey'
  )
ORDER BY table_name, conname;

SELECT
  'index' AS check_type,
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'districts_church_name_unique',
    'districts_church_active_idx',
    'users_church_status_idx',
    'users_church_role_idx',
    'churches_status_idx'
  )
ORDER BY tablename, indexname;

-- 6. Data-shape checks. Counts may differ, but nulls/orphans should be zero in both envs.
DO $$
DECLARE
  v_count bigint;
  v_seed record;
BEGIN
  IF to_regclass('public.churches') IS NULL THEN
    RAISE NOTICE 'data_shape | churches table | missing';
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM public.churches;
  RAISE NOTICE 'data_shape | count_churches | %', v_count;

  SELECT count(*) INTO v_count FROM public.districts;
  RAISE NOTICE 'data_shape | count_districts | %', v_count;

  SELECT count(*) INTO v_count FROM public.users;
  RAISE NOTICE 'data_shape | count_users | %', v_count;

  SELECT count(*) INTO v_count FROM public.districts WHERE church_id IS NULL;
  RAISE NOTICE 'data_shape | districts_missing_church_id | %', v_count;

  SELECT count(*) INTO v_count FROM public.users WHERE church_id IS NULL;
  RAISE NOTICE 'data_shape | users_missing_church_id | %', v_count;

  SELECT count(*) INTO v_count
  FROM public.users u
  JOIN public.districts d ON d.id = u.district_id
  WHERE u.church_id IS DISTINCT FROM d.church_id;
  RAISE NOTICE 'data_shape | users_church_mismatch_district | %', v_count;

  SELECT count(*) INTO v_count
  FROM public.users u
  LEFT JOIN public.districts d ON d.id = u.district_id
  WHERE d.id IS NULL;
  RAISE NOTICE 'data_shape | users_orphan_district | %', v_count;

  SELECT count(*) INTO v_count
  FROM public.users
  WHERE role = 'master' AND status = 'active';
  RAISE NOTICE 'data_shape | active_master_users | %', v_count;

  -- Legacy Bethel church seed. Should be one row after 021 is applied.
  FOR v_seed IN
    SELECT id, name, slug, status, plan, billing_status
    FROM public.churches
    WHERE id = '00000000-0000-4100-a000-000000000001'
       OR slug = 'bethel'
    ORDER BY slug
  LOOP
    RAISE NOTICE
      'data_shape | bethel_church_seed | id=%, name=%, slug=%, status=%, plan=%, billing_status=%',
      v_seed.id,
      v_seed.name,
      v_seed.slug,
      v_seed.status,
      v_seed.plan,
      v_seed.billing_status;
  END LOOP;
END $$;
