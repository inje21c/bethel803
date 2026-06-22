-- ============================================================
-- 055. authenticated 구역 SELECT 스코프 축소 (구역명 열거 차단)
-- ============================================================
-- 문제: districts_select_active 정책이 authenticated 사용자에게
--       모든 활성 구역(전 교회)을 SELECT 허용 → 커뮤니티 컨테이너에서
--       리더 A가 리더 B의 모임 이름까지 열거 가능(구역명 누수).
--       (054는 anon만 차단했음. 콘텐츠/구성원은 leader-구역스코프로 이미 격리.)
-- 조치: 본인 구역만 + 교회 마스터는 자기 교회 전체.
--       - 본인 구역: authContext 프로필 조인(users→districts(name))에 필요.
--       - 마스터: districts_all_master(FOR ALL)와 함께 교회 전체 관리.
--       - 비마스터(리더/멤버)는 다른 구역을 더 이상 못 봄.
-- 영향 점검: getDistricts 호출은 districtContext(마스터 전용)·DistrictManagement
--           (마스터)·AdminDashboard/AdminMembersTab(리더=본인 구역만 필요)뿐.
-- 설계: docs/기능설계/모임우선_아키텍처_재설계.md (12.6 / 13)
-- ============================================================

DROP POLICY IF EXISTS "districts_select_active" ON public.districts;
CREATE POLICY "districts_select_own" ON public.districts
  FOR SELECT USING (
    id = public.get_my_district_id()
    OR public.is_church_master(church_id)
  );
