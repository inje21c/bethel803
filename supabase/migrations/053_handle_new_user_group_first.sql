-- ============================================================
-- 053. handle_new_user 재설계 — 모임우선(group-first)
-- ============================================================
-- 변경 핵심:
-- - 전역 "첫 활성 구역" fallback 영구 폐기 (어제 오유입 사고의 근본 원인).
-- - 비초대 가입의 기본 동작 = 커뮤니티 컨테이너(052) 밑에 "내 모임" 생성 + 개설자=leader.
-- - 초대(district_id 유효) 가입은 기존대로 합류(member/pending; 빈 교회 첫 사용자는 master).
-- - 교회 셀프가입(church_name)은 유지(B2B/슈퍼어드민 경유) — 새 교회 + master.
-- 의존: 052(커뮤니티 컨테이너 교회) 먼저 적용되어 있어야 함.
-- 설계: docs/기능설계/모임우선_아키텍처_재설계.md (4장)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  c_community_id   UUID := '00000000-0000-4100-a000-000000000002';
  user_name        TEXT;
  user_role        TEXT;
  user_status      TEXT;
  user_district_id UUID;
  user_church_id   UUID;
  new_church_name  TEXT;
  new_district_name TEXT;
  new_group_name   TEXT;
  new_slug         TEXT;
  v_valid_district BOOLEAN := false;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  new_church_name := NULLIF(trim(NEW.raw_user_meta_data->>'church_name'), '');

  IF new_church_name IS NOT NULL THEN
    -- (A) 교회 셀프가입(B2B/슈퍼어드민 경유): 새 교회 + 첫 구역 + master
    new_district_name := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'district_name'), ''),
      '1구역'
    );
    new_slug := public.generate_church_slug(new_church_name);

    INSERT INTO public.churches (name, slug, status, plan, billing_status, trial_ends_at)
    VALUES (new_church_name, new_slug, 'trialing', 'free', 'trialing', NOW() + INTERVAL '30 days')
    RETURNING id INTO user_church_id;

    INSERT INTO public.districts (name, church_id, is_active)
    VALUES (new_district_name, user_church_id, true)
    RETURNING id INTO user_district_id;

    user_role   := 'master';
    user_status := 'active';

  ELSE
    -- 초대 district_id 유효성 검사 (존재 + 활성 + 교회 활성/체험 + 미삭제)
    user_district_id := (NEW.raw_user_meta_data->>'district_id')::UUID;
    IF user_district_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.districts d
        JOIN public.churches c ON c.id = d.church_id
        WHERE d.id = user_district_id
          AND d.is_active = true
          AND c.status IN ('active', 'trialing')
          AND (c.deleted_at IS NULL OR c.deleted_at > NOW())
      ) INTO v_valid_district;
    END IF;

    IF v_valid_district THEN
      -- (B) 초대 링크: 기존 구역 합류
      SELECT church_id INTO user_church_id
      FROM public.districts WHERE id = user_district_id;

      IF NEW.email = 'cmhyun@gmail.com' THEN
        user_role := 'master'; user_status := 'active';
      ELSIF NEW.email = 'bethel803leader@gmail.com' THEN
        user_role := 'leader'; user_status := 'active';
      ELSIF NOT EXISTS (SELECT 1 FROM public.users WHERE church_id = user_church_id) THEN
        -- 슈퍼어드민이 미리 만든 빈 교회의 첫 사용자 → master
        user_role := 'master'; user_status := 'active';
      ELSE
        user_role := 'member'; user_status := 'pending';
      END IF;

    ELSE
      -- (C) 기본: 초대 없음 → 커뮤니티 컨테이너에 "내 모임" 생성, 개설자=leader.
      --     전역 첫 구역 fallback은 폐기되었다 (오유입 차단).
      new_group_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'group_name'), ''),
        user_name || '의 모임'
      );

      INSERT INTO public.districts (name, church_id, is_active)
      VALUES (new_group_name, c_community_id, true)
      RETURNING id INTO user_district_id;

      user_church_id := c_community_id;
      user_role      := 'leader';   -- 컨테이너에 master를 두지 않는다
      user_status    := 'active';
    END IF;
  END IF;

  INSERT INTO public.users (id, name, role, status, district_id, church_id)
  VALUES (NEW.id, user_name, user_role, user_status, user_district_id, user_church_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
