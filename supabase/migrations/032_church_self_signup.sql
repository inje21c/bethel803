-- ============================================================
-- 032: 교회 셀프가입 지원
-- - handle_new_user: metadata.church_name 있으면 새 교회 생성
-- - slug 생성 헬퍼 함수
-- - churches RLS: 자기 교회만 조회
-- ============================================================

-- ============================================================
-- 1. slug 생성 헬퍼 (한글 포함 입력 → 영문 slug 또는 uuid suffix)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_church_slug(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  -- 영문/숫자/하이픈만 남기고 소문자 변환
  base_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  -- 영문이 없으면 uuid 기반 slug
  IF base_slug = '' OR base_slug = '-' THEN
    base_slug := 'church-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;

  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.churches WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- ============================================================
-- 2. churches RLS — 자기 교회만 조회
-- ============================================================
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "churches_self_read" ON public.churches;
CREATE POLICY "churches_self_read" ON public.churches
  FOR SELECT USING (id = public.get_my_church_id());

-- ============================================================
-- 3. handle_new_user 확장: metadata.church_name → 교회 자동 생성
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_role TEXT;
  user_status TEXT;
  user_district_id UUID;
  user_church_id UUID;
  new_church_name TEXT;
  new_district_name TEXT;
  new_slug TEXT;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  new_church_name := NEW.raw_user_meta_data->>'church_name';

  -- 자가 가입: church_name이 있으면 새 교회 생성
  IF new_church_name IS NOT NULL AND trim(new_church_name) != '' THEN
    new_district_name := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'district_name'), ''),
      '1구역'
    );
    new_slug := public.generate_church_slug(new_church_name);

    INSERT INTO public.churches (name, slug, status, plan, billing_status, trial_ends_at)
    VALUES (
      trim(new_church_name),
      new_slug,
      'trialing',
      'free',
      'trialing',
      NOW() + INTERVAL '30 days'
    )
    RETURNING id INTO user_church_id;

    -- church_settings는 churches_default_settings 트리거가 자동 생성

    INSERT INTO public.districts (name, church_id, is_active)
    VALUES (new_district_name, user_church_id, true)
    RETURNING id INTO user_district_id;

    user_role := 'master';
    user_status := 'active';

  ELSE
    -- 기존 교회 합류: district_id 메타데이터 기반
    user_district_id := (NEW.raw_user_meta_data->>'district_id')::UUID;
    IF user_district_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.districts d
      JOIN public.churches c ON c.id = d.church_id
      WHERE d.id = user_district_id
        AND d.is_active = true
        AND c.status IN ('active', 'trialing')
    ) THEN
      SELECT d.id INTO user_district_id
      FROM public.districts d
      JOIN public.churches c ON c.id = d.church_id
      WHERE d.is_active = true
        AND c.status IN ('active', 'trialing')
      ORDER BY d.created_at
      LIMIT 1;
    END IF;

    SELECT church_id INTO user_church_id
    FROM public.districts
    WHERE id = user_district_id;

    IF user_church_id IS NULL THEN
      user_church_id := '00000000-0000-4100-a000-000000000001';
    END IF;

    IF NEW.email = 'cmhyun@gmail.com' THEN
      user_role := 'master';
      user_status := 'active';
    ELSIF NEW.email = 'bethel803leader@gmail.com' THEN
      user_role := 'leader';
      user_status := 'active';
    ELSIF NOT EXISTS (SELECT 1 FROM public.users WHERE church_id = user_church_id) THEN
      user_role := 'master';
      user_status := 'active';
    ELSE
      user_role := 'member';
      user_status := 'pending';
    END IF;
  END IF;

  INSERT INTO public.users (id, name, role, status, district_id, church_id)
  VALUES (NEW.id, user_name, user_role, user_status, user_district_id, user_church_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. 내 교회 정보 조회 RPC (프론트 trial 상태 확인용)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_church_info()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  status TEXT,
  plan TEXT,
  billing_status TEXT,
  trial_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.slug, c.status, c.plan, c.billing_status, c.trial_ends_at
  FROM public.churches c
  WHERE c.id = public.get_my_church_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_church_info() TO authenticated;
