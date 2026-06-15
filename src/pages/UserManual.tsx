import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Home, MessageSquareHeart, BookMarked, CalendarDays, Settings, ChevronDown, ChevronRight, HelpCircle, UserCircle, Search, BookHeart } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: { subtitle: string; text: string }[];
}

const sections: Section[] = [
  {
    id: 'overview',
    title: '앱 소개',
    icon: Home,
    content: [
      {
        subtitle: '벧엘구역 앱이란?',
        text: '소모임 커뮤니티를 위한 올인원 앱입니다. 매일의 QT(말씀 묵상), 구역성경공부, 기도제목 나눔, 성경읽기 기록, 주요 일정을 한곳에서 관리합니다. 구역 모임, 청년부, 성경학교 교사 모임, 교내 기독교 동아리 등 다양한 소모임에서 사용할 수 있습니다.',
      },
      {
        subtitle: '가입 방법 — 초대 링크',
        text: '구역장에게 초대 링크를 받아 가입하는 방법입니다. 링크를 클릭하면 이메일·비밀번호로 가입하거나 구글·카카오 계정으로 바로 가입할 수 있습니다. 초대 링크로 가입하면 구역이 자동으로 연결되어 바로 사용할 수 있습니다.',
      },
      {
        subtitle: '가입 방법 — 직접 가입',
        text: '초대 링크 없이 로그인 페이지의 회원가입 탭에서 가입할 수 있습니다. 이 경우 구역장의 승인이 필요하며, 승인 전까지 대기 화면이 표시됩니다.',
      },
      {
        subtitle: '소셜 로그인 (구글 · 카카오)',
        text: '이메일·비밀번호 없이 구글 또는 카카오 계정으로 로그인할 수 있습니다. 단, 카카오 인앱 브라우저(카톡 내 링크)에서는 구글 로그인이 차단될 수 있습니다. 이 경우 Safari나 Chrome 등 외부 브라우저를 이용해 주세요.',
      },
      {
        subtitle: '홈 화면에 설치하기 (권장)',
        text: '모바일 브라우저에서 홈 화면에 추가하면 앱처럼 빠르게 실행할 수 있습니다. iOS: Safari 하단 공유 버튼 → "홈 화면에 추가". Android: 주소창 옆 설치 아이콘 또는 메뉴 → "홈 화면에 추가".',
      },
    ],
  },
  {
    id: 'dashboard',
    title: '대시보드 (홈)',
    icon: Home,
    content: [
      {
        subtitle: '오늘의 QT 히어로 카드',
        text: '대시보드 최상단에 오늘의 QT 카드가 표시됩니다. 묵상을 완료하지 않은 경우 오늘 말씀 제목과 본문 구절이 미리보기로 나타나며 "말씀 묵상하기 →"를 눌러 바로 시작할 수 있습니다. 완료한 경우 연속 일수와 함께 완료 상태가 표시됩니다.',
      },
      {
        subtitle: '요약 카드',
        text: '① QT 챌린지: 연속 묵상 일수(스트릭). 3일 이상이면 주황색으로 강조됩니다. ② 성경읽기 챌린지: 누적 읽은 장수. ③ 이번 주 공부: 이번 주 성경공부 완료 여부. ④ 함께기도: 내가 중보기도에 참여 중인 건수.',
      },
      {
        subtitle: '다가오는 일정 · 중보기도',
        text: '가장 가까운 일정과 구역 식구의 기도제목 미리보기가 표시됩니다. 하트 아이콘을 눌러 대시보드에서 바로 함께기도에 참여할 수 있습니다.',
      },
    ],
  },
  {
    id: 'qt',
    title: '오늘의 QT',
    icon: BookHeart,
    content: [
      {
        subtitle: 'QT란?',
        text: '매일 말씀을 묵상하는 시간입니다. 강제 사항이 아닌 자율적 챌린지로, 꾸준히 이어갈수록 스트릭(연속 일수)이 쌓입니다. 교회 설정에 따라 매일성경 기반(scraped) 또는 시편 1편씩(simple) 방식으로 제공됩니다.',
      },
      {
        subtitle: 'QT 진행 순서',
        text: '① 본문 구절 확인 → ② 해설 요약 읽기 → ③ 해설 듣기(오디오, 선택) → ④ 성경 본문 읽기 → ⑤ QT 질문 묵상 → ⑥ 나눔 답변 작성(선택) → ⑦ "기도하기" 또는 "오늘 묵상 완료" 버튼으로 완료 처리.',
      },
      {
        subtitle: '깊은 묵상 (4단계)',
        text: 'QT 페이지 하단 "깊은 묵상" 버튼을 누르면 AI와 함께 4단계로 더 깊이 묵상할 수 있습니다. 관찰 → 질문/답변 → 느낌 → 결단 순서로 진행되며, 각 단계에서 AI가 맞춤 질문을 제시합니다. 완료 후 기록이 저장됩니다.',
      },
      {
        subtitle: '기도 단계',
        text: '기도하기 버튼을 누르면 기도 페이지로 이동합니다. 구역장 추천 찬송가(유튜브 링크)와 구역 기도제목 목록이 함께 제공됩니다. "오늘 QT 완료"를 누르면 스트릭이 반영됩니다.',
      },
      {
        subtitle: 'QT 스트릭 · 캘린더',
        text: '매일 QT를 완료하면 연속 일수(스트릭)가 쌓입니다. QT 완료 화면의 캘린더에서 이번 달 묵상 기록을 한눈에 볼 수 있습니다. 지난 날짜를 클릭하면 해당 날짜의 묵상 자료를 볼 수 있으나, 지난 날짜 완료는 스트릭에 반영되지 않습니다.',
      },
    ],
  },
  {
    id: 'bible-study',
    title: '구역성경공부',
    icon: BookOpen,
    content: [
      {
        subtitle: '성경공부 목록',
        text: '발행된 성경공부 목록을 확인할 수 있습니다. 각 항목을 클릭하면 상세 페이지로 이동합니다.',
      },
      {
        subtitle: '답변 작성',
        text: '성경공부 상세 페이지에서 각 질문에 대한 답변을 작성합니다. "임시 저장"으로 작성 중인 내용을 저장하고, "완료로 저장"으로 최종 완료 처리합니다. 완료 후에도 "수정 저장"으로 내용을 변경할 수 있습니다.',
      },
      {
        subtitle: '답변 비공개 정책',
        text: '내가 작성한 답변은 나만 볼 수 있습니다. 구역장·관리자도 다른 구역원의 답변 내용은 볼 수 없으며, 완료 여부(완료/미완료)만 확인할 수 있습니다.',
      },
      {
        subtitle: '완료 현황',
        text: '대시보드 "이번 주 공부" 카드와 성경공부 목록에서 나의 완료 여부를 확인할 수 있습니다.',
      },
    ],
  },
  {
    id: 'prayer',
    title: '기도제목',
    icon: MessageSquareHeart,
    content: [
      {
        subtitle: '탭 구조',
        text: '기도제목 페이지는 두 개의 탭으로 구성됩니다. ① 기도제목 탭: 내 기도제목 등록 및 구역 전체 기도제목 목록. ② 함께기도 탭: 내가 중보기도에 참여 중인 것과 아직 참여하지 않은 것을 구분해서 표시합니다.',
      },
      {
        subtitle: '기도제목 등록',
        text: '기도제목 탭 상단 입력창에 내용을 작성하고 "등록" 버튼을 누릅니다. "구역장에게 공유" 스위치를 켜면 구역장 관리 화면에서도 확인할 수 있습니다.',
      },
      {
        subtitle: '함께기도 참여',
        text: '구역 기도제목 목록에서 하트 아이콘을 눌러 "함께 기도합니다"에 참여할 수 있습니다. 몇 명이 함께 기도하고 있는지 숫자로 표시됩니다.',
      },
      {
        subtitle: '응답 표시',
        text: '기도가 응답되었을 때 기도제목 상세 페이지에서 "응답됨" 처리를 할 수 있습니다.',
      },
    ],
  },
  {
    id: 'bible-reading',
    title: '성경읽기',
    icon: BookMarked,
    content: [
      {
        subtitle: '성경읽기 탭 구조',
        text: '성경읽기 페이지는 세 개의 탭으로 구성됩니다. ① 기록: 날짜별 읽은 장수 입력. ② 읽기 플랜: 체계적인 성경읽기 계획 설정 및 관리. ③ 구역 현황: 구역 전체의 읽기 현황 비교.',
      },
      {
        subtitle: '읽은 장수 기록',
        text: '기록 탭에서 날짜를 선택하고 읽은 성경 장수를 입력합니다. 누적 장수가 대시보드 "성경읽기 챌린지" 카드에 표시됩니다.',
      },
      {
        subtitle: '읽기 플랜',
        text: '읽기 플랜 탭에서 1년 통독, 신약 읽기 등 다양한 계획 중 하나를 선택할 수 있습니다. 계획을 설정하면 오늘 읽을 분량이 안내되고, 일별 진도를 기록할 수 있습니다.',
      },
      {
        subtitle: '구역 현황',
        text: '구역 현황 탭에서 구역원들의 읽기 현황을 비교할 수 있습니다. 누가 얼마나 읽었는지 한눈에 파악할 수 있습니다.',
      },
    ],
  },
  {
    id: 'schedule',
    title: '주요일정',
    icon: CalendarDays,
    content: [
      {
        subtitle: '일정 확인',
        text: '구역 모임, 교회 행사 등 주요 일정을 확인할 수 있습니다. 날짜, 시간, 장소 정보가 표시됩니다.',
      },
      {
        subtitle: '출석 응답',
        text: '출석 체크가 활성화된 일정에서 참석/불참 여부를 응답할 수 있습니다.',
      },
    ],
  },
  {
    id: 'search',
    title: '검색 / 알림',
    icon: Search,
    content: [
      {
        subtitle: '전역 검색',
        text: '상단 헤더의 검색 아이콘을 클릭하거나 Ctrl+K (Mac: Cmd+K)를 눌러 검색창을 열 수 있습니다. 성경공부, 일정, 기도제목을 통합 검색하거나 메뉴로 바로 이동할 수 있습니다.',
      },
      {
        subtitle: '알림',
        text: '상단 헤더의 벨 아이콘을 클릭하면 알림 목록을 확인할 수 있습니다. 새 알림이 있으면 뱃지가 표시됩니다.',
      },
    ],
  },
  {
    id: 'profile',
    title: '내 프로필',
    icon: UserCircle,
    content: [
      {
        subtitle: '프로필 관리',
        text: '상단 헤더의 이름을 클릭하거나 더보기 메뉴의 "내 프로필"을 선택하면 프로필 페이지로 이동합니다. 이름 변경, 비밀번호 변경, 소셜 계정 연결을 할 수 있습니다.',
      },
      {
        subtitle: '소셜 계정 연결',
        text: '프로필 페이지에서 구글 또는 카카오 계정을 기존 계정에 연결할 수 있습니다. 연결 후에는 소셜 로그인으로도 로그인할 수 있습니다.',
      },
      {
        subtitle: '푸시 알림 설정',
        text: '프로필 페이지에서 웹 푸시 알림을 구독하거나 해지할 수 있습니다. 구독 시 구역 새 소식을 브라우저 알림으로 받을 수 있습니다.',
      },
      {
        subtitle: '회원탈퇴',
        text: '프로필 페이지 하단의 "회원탈퇴" 섹션에서 계정을 삭제할 수 있습니다. "탈퇴"를 직접 입력해야 삭제 버튼이 활성화됩니다. 탈퇴 시 내 데이터가 모두 삭제되며 복구할 수 없습니다. 교회의 마지막 관리자인 경우 교회 전체 데이터도 함께 삭제됩니다.',
      },
    ],
  },
  {
    id: 'admin',
    title: '관리자 기능 (구역장)',
    icon: Settings,
    content: [
      {
        subtitle: '접근 권한',
        text: '관리자 메뉴는 구역장(leader) 이상 권한을 가진 사용자만 접근할 수 있습니다. 하단 더보기 메뉴 또는 상단 네비게이션에서 "관리자"를 선택합니다.',
      },
      {
        subtitle: '구역원 관리 · 초대 링크',
        text: '구역원 목록 확인, 가입 승인/거부, 역할 변경 기능을 제공합니다. 구성원 탭 상단의 "초대 링크 복사" 버튼으로 구역 전용 초대 링크를 복사할 수 있습니다. 링크를 카카오톡이나 문자로 전달하면 상대방이 클릭 후 바로 가입하고 구역에 자동 배정됩니다.',
      },
      {
        subtitle: 'QT 현황 탭',
        text: '오늘 구역원의 QT 완료 현황을 확인할 수 있습니다. 완료/미완료 인원 수, 연속 미완료 위험 구역원이 표시됩니다. 구역장 코멘트를 작성하면 다음날 아침 푸시 알림에 포함됩니다.',
      },
      {
        subtitle: '성경공부 관리 탭',
        text: '성경공부를 직접 생성하거나 주보 PDF에서 자동 파싱하여 생성할 수 있습니다. 생성된 성경공부는 검토 후 발행합니다. 답변 현황 아이콘을 클릭하면 구역원별 완료/미완료 현황을 볼 수 있습니다(답변 내용은 비공개, 완료 여부만 표시).',
      },
      {
        subtitle: '주간 보고 탭',
        text: '주간 참석 인원, 성경읽기 합계, 공부 완료율 등의 통계를 확인하고 CSV로 내보낼 수 있습니다.',
      },
      {
        subtitle: '공지생성 탭',
        text: '일정, 성경공부 등의 안내 메시지를 자동 생성하여 클립보드로 복사할 수 있습니다. 복사한 내용을 카카오톡 그룹 채팅에 바로 붙여넣기 하면 됩니다.',
      },
    ],
  },
  {
    id: 'tips',
    title: '유용한 팁',
    icon: HelpCircle,
    content: [
      {
        subtitle: '하단 네비게이션',
        text: '화면 하단의 탭 바에서 홈, 기도, 공부, QT, 더보기 메뉴로 빠르게 이동할 수 있습니다.',
      },
      {
        subtitle: '다크 모드',
        text: '상단 헤더의 해/달 아이콘을 클릭하거나 더보기 메뉴에서 야간 모드를 전환할 수 있습니다.',
      },
      {
        subtitle: 'QT 스트릭을 지키려면',
        text: 'QT 완료는 "기도하기" → 기도 페이지 → "오늘 QT 완료" 버튼까지 눌러야 스트릭이 반영됩니다. 심플 모드의 경우 QT 페이지에서 "오늘 묵상 완료" 버튼 하나로 완료됩니다. 답변을 작성하지 않아도 완료 처리가 가능합니다.',
      },
      {
        subtitle: '오프라인 사용',
        text: '인터넷 연결이 끊기면 상단에 안내 배너가 표시됩니다. 일부 캐시된 데이터는 오프라인에서도 확인 가능하지만, 데이터 입력/수정은 온라인 상태에서만 가능합니다.',
      },
      {
        subtitle: '문제 해결',
        text: '화면이 정상적으로 표시되지 않을 때는 Ctrl+Shift+R (Mac: Cmd+Shift+R)로 하드 리프레시를 시도해 보세요. 그래도 해결되지 않으면 구역장에게 문의해 주세요.',
      },
    ],
  },
];

export default function UserManual() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['overview']));

  const toggle = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpenSections(new Set(sections.map(s => s.id)));
  const collapseAll = () => setOpenSections(new Set());

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-primary" /> 사용자 매뉴얼
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              벧엘구역 앱 사용 안내
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-primary font-medium hover:underline"
            >
              모두 펼치기
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-muted-foreground font-medium hover:underline"
            >
              모두 접기
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {sections.map((section, idx) => {
            const isOpen = openSections.has(section.id);
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="card-elevated overflow-hidden"
              >
                <button
                  onClick={() => toggle(section.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <Icon className="w-5 h-5 text-primary shrink-0" />
                  <span className="font-display font-semibold flex-1">{section.title}</span>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="border-t px-4 pb-4"
                  >
                    <div className="space-y-4 pt-3">
                      {section.content.map((item, i) => (
                        <div key={i}>
                          <h3 className="text-sm font-semibold mb-1">{item.subtitle}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
