import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Home, MessageSquareHeart, BookMarked, CalendarDays, Settings, ChevronDown, ChevronRight, HelpCircle, UserCircle, Search } from 'lucide-react';
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
        subtitle: '벧엘교회 구역 앱이란?',
        text: '구역 모임을 위한 올인원 앱입니다. 성경공부, 기도제목, 성경읽기, 일정관리, 오늘의 묵상 등을 한곳에서 관리할 수 있습니다.',
      },
      {
        subtitle: '처음 사용하기',
        text: '회원가입 후 구역장의 승인을 받으면 모든 기능을 사용할 수 있습니다. 승인 대기 중에는 자동으로 대기 화면이 표시되며, 승인이 완료되면 대시보드로 이동합니다.',
      },
    ],
  },
  {
    id: 'dashboard',
    title: '대시보드',
    icon: Home,
    content: [
      {
        subtitle: '한눈에 보기',
        text: '로그인하면 대시보드가 표시됩니다. 이번 주 성경공부 완료 여부, 성경읽기 누적 장수, 기도제목 현황, 함께 기도 참여 수를 한눈에 확인할 수 있습니다.',
      },
      {
        subtitle: '오늘의 묵상',
        text: '매일 아침 6시에 자동 업데이트되는 오늘의 묵상을 확인할 수 있습니다. AI가 요약한 내용과 적용 질문이 제공됩니다.',
      },
      {
        subtitle: '중보기도',
        text: '다른 구역원의 기도제목에 "함께 기도합니다" 버튼을 눌러 중보기도에 참여할 수 있습니다.',
      },
      {
        subtitle: '다가오는 일정',
        text: '앞으로 2개월 이내의 일정이 표시됩니다. 처음 접속 시 팝업으로도 안내됩니다.',
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
        text: '성경공부 상세 페이지에서 각 질문에 대한 답변을 작성합니다. "임시 저장" 버튼으로 작성 중인 내용을 저장하고, "완료로 저장" 버튼으로 최종 완료 처리합니다. 완료 후에도 마감 전까지 "수정 저장"으로 내용을 변경할 수 있습니다.',
      },
      {
        subtitle: '완료 현황',
        text: '대시보드와 목록에서 각 성경공부의 완료 여부를 확인할 수 있습니다.',
      },
    ],
  },
  {
    id: 'prayer',
    title: '기도제목',
    icon: MessageSquareHeart,
    content: [
      {
        subtitle: '기도제목 등록',
        text: '"새 기도제목" 버튼을 눌러 기도제목을 등록합니다. 등록된 기도제목은 구역원 모두에게 공유됩니다.',
      },
      {
        subtitle: '응답 표시',
        text: '기도가 응답되었을 때 "응답됨" 체크를 할 수 있습니다. 응답된 기도제목은 별도로 표시됩니다.',
      },
      {
        subtitle: '함께 기도 (중보기도)',
        text: '다른 구역원의 기도제목에 하트 아이콘을 눌러 "함께 기도합니다"를 표시할 수 있습니다. 몇 명이 함께 기도하고 있는지 숫자로 표시됩니다.',
      },
    ],
  },
  {
    id: 'bible-reading',
    title: '성경읽기',
    icon: BookMarked,
    content: [
      {
        subtitle: '읽은 장수 기록',
        text: '날짜별로 읽은 성경 장수를 기록합니다. 매일의 기록이 누적되어 연간 총 장수가 계산됩니다.',
      },
      {
        subtitle: '기록 확인',
        text: '캘린더 형태로 날짜별 읽은 장수를 확인할 수 있습니다. 대시보드에서도 누적 장수를 확인할 수 있습니다.',
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
        text: '상단 헤더의 이름을 클릭하거나 모바일 메뉴의 "내 프로필"을 선택하면 프로필 페이지로 이동합니다.',
      },
      {
        subtitle: '이름 변경',
        text: '표시되는 이름을 변경할 수 있습니다.',
      },
      {
        subtitle: '비밀번호 변경',
        text: '현재 비밀번호 없이 새 비밀번호를 입력하여 변경할 수 있습니다.',
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
        text: '관리자 메뉴는 구역장(leader) 권한을 가진 사용자만 접근할 수 있습니다.',
      },
      {
        subtitle: '구역원 관리',
        text: '구역원 목록 확인, 가입 승인/거부, 역할 변경(구역장/구역원) 기능을 제공합니다.',
      },
      {
        subtitle: '성경공부 관리',
        text: '성경공부를 직접 생성하거나, 주보 PDF에서 자동 파싱하여 생성할 수 있습니다. 생성된 성경공부는 검토 후 발행하며, 각 공부 행의 사람 아이콘을 클릭하면 구역원별 답변 현황을 조회할 수 있습니다.',
      },
      {
        subtitle: '주간 보고',
        text: '주간 참석 인원, 성경읽기 합계, 공부 완료율 등의 통계를 확인하고 CSV로 내보낼 수 있습니다.',
      },
      {
        subtitle: '카카오톡 공지',
        text: '일정, 성경공부 등의 안내 메시지를 생성하여 클립보드로 복사할 수 있습니다. 복사한 내용을 카카오톡 그룹 채팅에 붙여넣기 하면 됩니다.',
      },
    ],
  },
  {
    id: 'tips',
    title: '유용한 팁',
    icon: HelpCircle,
    content: [
      {
        subtitle: '다크 모드',
        text: '상단 헤더의 해/달 아이콘을 클릭하면 다크 모드와 라이트 모드를 전환할 수 있습니다.',
      },
      {
        subtitle: '홈 화면 추가 (PWA)',
        text: '모바일 브라우저에서 "홈 화면에 추가"를 선택하면 앱처럼 사용할 수 있습니다. iOS: Safari 공유 버튼 > "홈 화면에 추가". Android: 주소창 옆 설치 아이콘 또는 메뉴 > "홈 화면에 추가".',
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
              벧엘교회 구역 앱 사용 안내
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
