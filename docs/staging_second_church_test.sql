-- Staging-only smoke test helper for adding a second church.
-- Do not run this in production.
--
-- Flow:
-- 1. Run section 1 to create a test church and districts.
-- 2. Create test auth users from Supabase Auth UI with raw_user_meta_data:
--    {"name":"새교회 마스터","district_id":"<sae-1-district-id>"}
--    {"name":"새교회 리더","district_id":"<sae-1-district-id>"}
--    {"name":"새교회 멤버","district_id":"<sae-1-district-id>"}
-- 3. Promote/approve them with section 2 after replacing user emails.
-- 4. Run section 3 to verify data shape.
-- 5. Test in the preview app.

-- ============================================================
-- 1. Create a second church and a couple of districts
-- ============================================================

INSERT INTO public.churches (
  id,
  name,
  slug,
  status,
  plan,
  billing_status
) VALUES (
  '00000000-0000-4100-a000-000000000002',
  '새교회 테스트',
  'sae-test',
  'active',
  'free',
  'manual'
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  status = EXCLUDED.status,
  plan = EXCLUDED.plan,
  billing_status = EXCLUDED.billing_status;

INSERT INTO public.districts (
  id,
  church_id,
  name,
  description,
  is_active
) VALUES
  (
    '00000000-0000-4200-a000-000000000101',
    '00000000-0000-4100-a000-000000000002',
    '새교회 1구역',
    'SaaS 격리 테스트용 구역',
    true
  ),
  (
    '00000000-0000-4200-a000-000000000102',
    '00000000-0000-4100-a000-000000000002',
    '새교회 2구역',
    'SaaS 격리 테스트용 구역',
    true
  )
ON CONFLICT (church_id, name) DO UPDATE
SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

SELECT
  c.id AS church_id,
  c.name AS church_name,
  c.slug,
  d.id AS district_id,
  d.name AS district_name
FROM public.churches c
JOIN public.districts d ON d.church_id = c.id
WHERE c.slug = 'sae-test'
ORDER BY d.name;

-- ============================================================
-- 2. Promote/approve second-church test users after Auth signup
-- ============================================================
-- Replace these emails with the actual staging test emails.
-- The auth signup trigger should already set church_id from district_id.

-- UPDATE public.users u
-- SET role = 'master', status = 'active'
-- FROM auth.users au
-- WHERE au.id = u.id
--   AND au.email = 'sae-master@example.com'
--   AND u.church_id = '00000000-0000-4100-a000-000000000002';

-- UPDATE public.users u
-- SET role = 'leader', status = 'active'
-- FROM auth.users au
-- WHERE au.id = u.id
--   AND au.email = 'sae-leader@example.com'
--   AND u.church_id = '00000000-0000-4100-a000-000000000002';

-- UPDATE public.users u
-- SET role = 'member', status = 'active'
-- FROM auth.users au
-- WHERE au.id = u.id
--   AND au.email = 'sae-member@example.com'
--   AND u.church_id = '00000000-0000-4100-a000-000000000002';

-- ============================================================
-- 3. Verify second-church data shape
-- ============================================================

SELECT
  c.name AS church_name,
  c.slug,
  d.name AS district_name,
  count(u.id) AS user_count,
  count(u.id) FILTER (WHERE u.role = 'master') AS master_count,
  count(u.id) FILTER (WHERE u.role = 'leader') AS leader_count,
  count(u.id) FILTER (WHERE u.role = 'member') AS member_count
FROM public.churches c
JOIN public.districts d ON d.church_id = c.id
LEFT JOIN public.users u ON u.district_id = d.id
GROUP BY c.name, c.slug, d.name
ORDER BY c.slug, d.name;

SELECT
  'users_church_mismatch_district' AS check_name,
  count(*)::text AS result
FROM public.users u
JOIN public.districts d ON d.id = u.district_id
WHERE u.church_id IS DISTINCT FROM d.church_id
UNION ALL
SELECT
  'second_church_districts',
  count(*)::text
FROM public.districts
WHERE church_id = '00000000-0000-4100-a000-000000000002'
UNION ALL
SELECT
  'second_church_users',
  count(*)::text
FROM public.users
WHERE church_id = '00000000-0000-4100-a000-000000000002';
