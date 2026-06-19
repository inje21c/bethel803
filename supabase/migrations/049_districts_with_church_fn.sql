-- anon/authenticated 모두 구역+교회명 조회 가능한 SECURITY DEFINER 함수
-- (churches 테이블은 anon RLS 접근 불가여서 직접 JOIN 대신 RPC 경유)
CREATE OR REPLACE FUNCTION public.get_active_districts_with_church()
RETURNS TABLE(id uuid, name text, church_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name, c.name AS church_name
  FROM districts d
  JOIN churches c ON c.id = d.church_id
  WHERE d.is_active = true
    AND (c.deleted_at IS NULL OR c.deleted_at > NOW())
  ORDER BY c.name, d.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_districts_with_church() TO anon, authenticated;
