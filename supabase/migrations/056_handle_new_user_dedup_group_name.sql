-- ============================================================
-- 056. handle_new_user 모임명 중복 회피 (커뮤니티 컨테이너)
-- ============================================================
-- 버그: districts_church_name_unique(021, church_id+name UNIQUE) 때문에,
--       모든 커뮤니티 모임이 한 컨테이너 교회를 공유하는 새 구조에서는
--       기본 모임명 "{이름}의 모임"이 동명이인끼리 충돌 → INSERT 실패 →
--       "Database error creating new user"로 가입 자체가 깨진다.
-- 조치: 분기 C에서 컨테이너 내 동일 이름이 있으면 " 2", " 3" … 접미사로 유일화.
--       (명시적 group_name도 동일하게 유일화 — 가입이 절대 실패하지 않게)
-- 053을 대체(CREATE OR REPLACE). 설계: docs/기능설계/모임우선_아키텍처_재설계.md
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
  base_group_name  TEXT;
  dup_n            INT;
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
        user_role := 'master'; user_status := 'active';
      ELSE
        user_role := 'member'; user_status := 'pending';
      END IF;

    ELSE
      -- (C) 기본: 커뮤니티 컨테이너에 "내 모임" 생성, 개설자=leader.
      new_group_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'group_name'), ''),
        user_name || '의 모임'
      );

      -- 컨테이너 내 모임명 유일화 (districts_church_name_unique 충돌 방지)
      base_group_name := new_group_name;
      dup_n := 1;
      WHILE EXISTS (
        SELECT 1 FROM public.districts
        WHERE church_id = c_community_id AND name = new_group_name
      ) LOOP
        dup_n := dup_n + 1;
        new_group_name := base_group_name || ' ' || dup_n;
      END LOOP;

      INSERT INTO public.districts (name, church_id, is_active)
      VALUES (new_group_name, c_community_id, true)
      RETURNING id INTO user_district_id;

      user_church_id := c_community_id;
      user_role      := 'leader';
      user_status    := 'active';
    END IF;
  END IF;

  INSERT INTO public.users (id, name, role, status, district_id, church_id)
  VALUES (NEW.id, user_name, user_role, user_status, user_district_id, user_church_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
