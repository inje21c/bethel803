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
        text: '구역 모임, 청년부, 성경학교 교사 모임, 교내 기독교 동아리 등 소모임을 위한 앱입니다. 매일 말씀 묵상(QT), 성경공부 답변 작성, 기도제목 나눔, 성경읽기 기록, 모임 일정 확인을 한 곳에서 할 수 있습니다. 따로 앱을 설치하지 않아도 스마트폰 인터넷 브라우저에서 바로 사용할 수 있습니다.',
      },
      {
        subtitle: '어떻게 가입하나요? — 초대 링크로 가입 (가장 쉬운 방법)',
        text: '구역장님께 초대 링크를 받아 클릭하면 가입 화면이 열립니다. 이메일과 비밀번호를 입력하거나, 구글 또는 카카오 계정으로 바로 가입할 수 있습니다. 초대 링크로 가입하면 구역에 자동으로 연결되어 승인 없이 바로 사용할 수 있습니다.',
      },
      {
        subtitle: '어떻게 가입하나요? — 직접 가입',
        text: '초대 링크가 없어도 가입할 수 있습니다. 로그인 화면에서 "회원가입" 버튼을 누른 후 이름, 이메일, 비밀번호를 입력하고 구역을 선택하세요. 이 방법으로 가입하면 구역장님의 승인이 필요합니다. 승인이 완료되면 자동으로 앱을 사용할 수 있게 됩니다.',
      },
      {
        subtitle: '구글 또는 카카오 계정으로 로그인하기',
        text: '이메일과 비밀번호를 기억하기 어려우시다면 구글 또는 카카오 계정으로 로그인할 수 있습니다. 로그인 화면에서 "구글로 계속하기" 또는 "카카오로 계속하기" 버튼을 누르면 됩니다. 단, 카카오톡 앱 안에서 링크를 열어 구글 로그인을 시도하면 안 될 수 있습니다. 그럴 때는 카카오톡을 닫고 Safari나 Chrome 같은 인터넷 브라우저에서 직접 접속해 주세요.',
      },
      {
        subtitle: '휴대폰 홈 화면에 추가하기 (권장)',
        text: '앱처럼 홈 화면에 아이콘을 추가해 두면 훨씬 편리합니다. 아이폰(iOS): Safari 브라우저 하단의 공유 버튼(네모에 화살표 모양)을 누른 후 "홈 화면에 추가"를 선택하세요. 안드로이드: 주소창 옆의 점 세 개 메뉴를 누른 후 "홈 화면에 추가"를 선택하세요.',
      },
    ],
  },
  {
    id: 'dashboard',
    title: '홈 화면',
    icon: Home,
    content: [
      {
        subtitle: '홈 화면이란?',
        text: '앱을 열면 가장 먼저 보이는 화면입니다. 오늘의 말씀 묵상, 성경읽기 현황, 이번 주 성경공부, 함께 기도하는 사람 수를 한눈에 볼 수 있습니다.',
      },
      {
        subtitle: '오늘의 말씀 묵상 카드',
        text: '화면 위쪽에 오늘의 말씀 묵상 카드가 있습니다. 아직 묵상을 하지 않았다면 오늘 말씀 제목과 구절이 보입니다. "말씀 묵상하기" 버튼을 누르면 바로 시작할 수 있습니다. 이미 완료했다면 몇 일 연속으로 묵상했는지 표시됩니다.',
      },
      {
        subtitle: '작은 요약 카드 4개',
        text: '홈 화면 중간에 작은 카드 4개가 있습니다. ① 말씀 묵상: 지금까지 며칠 연속으로 묵상했는지 보여줍니다. 3일 이상이면 주황색으로 강조됩니다. ② 성경읽기: 올해 총 몇 장을 읽었는지 보여줍니다. ③ 이번 주 공부: 이번 주 성경공부를 완료했으면 초록색, 아직이면 회색입니다. ④ 함께기도: 내가 같이 기도해주고 있는 기도제목이 몇 개인지 보여줍니다.',
      },
      {
        subtitle: '다가오는 일정과 기도제목',
        text: '홈 화면 아래쪽에 가장 가까운 모임 일정과 구역 식구들의 기도제목이 미리보기로 표시됩니다. 기도제목 옆의 하트를 누르면 "함께 기도합니다"에 참여할 수 있습니다.',
      },
    ],
  },
  {
    id: 'qt',
    title: '오늘의 QT (말씀 묵상)',
    icon: BookHeart,
    content: [
      {
        subtitle: 'QT가 뭔가요?',
        text: 'QT는 Quiet Time의 줄임말로, 매일 조용히 하나님의 말씀을 읽고 묵상하는 시간을 말합니다. 강제로 해야 하는 것이 아니라 스스로 꾸준히 하는 것입니다. 매일 묵상을 완료하면 며칠 연속으로 했는지 기록이 쌓여 서로 격려가 됩니다.',
      },
      {
        subtitle: '말씀 묵상 하는 순서',
        text: '① 오늘의 말씀 제목과 본문 구절을 확인합니다. ② 해설 요약을 읽습니다. ③ 원하시면 해설 음성을 들으실 수 있습니다. ④ 성경 본문을 읽습니다. ⑤ 오늘의 묵상 질문을 생각해 봅니다. ⑥ 느낀 점이 있으면 적어도 좋고, 적지 않아도 됩니다. ⑦ 마지막으로 "기도하기" 버튼을 눌러 기도 단계로 넘어갑니다.',
      },
      {
        subtitle: '깊은 묵상 — AI와 함께 더 깊이',
        text: '말씀 묵상 화면 아래쪽에 "깊은 묵상" 버튼이 있습니다. 이것을 누르면 AI(인공지능)가 4단계로 더 깊이 묵상할 수 있도록 도와줍니다. 관찰(말씀에서 무엇을 보았나요?) → 질문과 답변 → 느낌(마음에 어떻게 와닿았나요?) → 결단(어떻게 살아갈까요?) 순서로 진행됩니다. 각 단계에서 AI가 나에게 맞는 질문을 해 줍니다. 완료하면 기록이 저장됩니다.',
      },
      {
        subtitle: '기도 단계',
        text: '"기도하기" 버튼을 누르면 기도 화면으로 넘어갑니다. 구역장님이 추천한 찬송가 링크와 구역 식구들의 기도제목이 함께 보입니다. 기도를 마친 후 "오늘 QT 완료" 버튼을 누르면 오늘 묵상이 기록됩니다.',
      },
      {
        subtitle: '며칠 연속으로 했는지 확인하기',
        text: '매일 묵상을 완료하면 연속으로 한 날 수가 쌓입니다. 묵상 완료 화면에 이번 달 달력이 나오는데, 묵상을 한 날에 표시가 됩니다. 지난 날짜를 눌러 그날의 묵상 자료를 볼 수도 있습니다. 단, 지난 날짜 묵상을 완료해도 연속 기록에는 포함되지 않습니다.',
      },
    ],
  },
  {
    id: 'bible-study',
    title: '구역성경공부',
    icon: BookOpen,
    content: [
      {
        subtitle: '성경공부 자료 보기',
        text: '화면 아래쪽 메뉴에서 "공부"를 누르면 성경공부 목록이 나옵니다. 구역장님이 올려둔 이번 주 성경공부 자료를 클릭하면 내용과 질문들을 볼 수 있습니다.',
      },
      {
        subtitle: '답변 작성하기',
        text: '성경공부 화면에서 각 질문에 대한 내 생각을 적을 수 있습니다. 다 쓰지 않았다면 "임시 저장" 버튼을 눌러 두고 나중에 이어서 쓰세요. 다 완성했으면 "완료로 저장" 버튼을 누릅니다. 완료한 후에도 내용을 고치고 싶으면 "수정 저장" 버튼을 누르면 됩니다.',
      },
      {
        subtitle: '내 답변은 나만 볼 수 있어요',
        text: '내가 쓴 성경공부 답변은 오직 나 자신만 볼 수 있습니다. 구역장님이나 다른 구역원은 내가 완료했는지 안 했는지만 알 수 있고, 어떤 내용을 썼는지는 볼 수 없습니다. 마음 편하게 솔직하게 적어 주세요.',
      },
      {
        subtitle: '완료 여부 확인',
        text: '홈 화면의 "이번 주 공부" 카드와 성경공부 목록에서 내가 이번 주 성경공부를 완료했는지 바로 확인할 수 있습니다.',
      },
    ],
  },
  {
    id: 'prayer',
    title: '기도제목',
    icon: MessageSquareHeart,
    content: [
      {
        subtitle: '기도제목 화면 구성',
        text: '화면 아래쪽 메뉴에서 "기도"를 누르면 기도제목 화면이 열립니다. 위쪽에 "기도제목"과 "함께기도" 두 개의 버튼이 있습니다. "기도제목"에서는 내 기도제목을 올리고 구역 전체 기도제목을 볼 수 있고, "함께기도"에서는 내가 같이 기도해주고 있는 것들을 모아볼 수 있습니다.',
      },
      {
        subtitle: '기도제목 올리기',
        text: '기도제목 화면 위쪽의 입력창에 내용을 쓰고 "등록" 버튼을 누르면 됩니다. "구역장에게 공유" 스위치를 켜면 구역장님도 내 기도제목을 볼 수 있습니다. 스위치를 끄면 나만 볼 수 있습니다.',
      },
      {
        subtitle: '함께 기도해 주기',
        text: '구역 식구의 기도제목 옆에 있는 하트 아이콘을 누르면 "함께 기도합니다"에 참여하게 됩니다. 몇 명이 함께 기도하고 있는지 숫자로 표시되어 서로 힘이 됩니다.',
      },
      {
        subtitle: '기도 응답 표시하기',
        text: '기도가 응답되었을 때는 해당 기도제목을 눌러 상세 화면으로 들어간 다음 "응답됨" 버튼을 누르면 됩니다. 응답된 기도제목은 따로 구분되어 표시됩니다.',
      },
    ],
  },
  {
    id: 'bible-reading',
    title: '성경읽기',
    icon: BookMarked,
    content: [
      {
        subtitle: '성경읽기 화면 구성',
        text: '성경읽기 화면에는 세 가지 메뉴가 있습니다. "기록"에서 오늘 읽은 장수를 입력하고, "읽기 계획"에서 나만의 성경읽기 계획을 세울 수 있으며, "구역 현황"에서 구역 식구들이 얼마나 읽고 있는지 볼 수 있습니다.',
      },
      {
        subtitle: '읽은 장수 기록하기',
        text: '"기록" 메뉴에서 날짜를 선택하고 오늘 읽은 성경 장 수를 입력하면 됩니다. 예를 들어 창세기 1장~3장을 읽었다면 3을 입력합니다. 기록이 쌓이면 홈 화면의 "성경읽기" 카드에 총 몇 장을 읽었는지 표시됩니다.',
      },
      {
        subtitle: '성경읽기 계획 세우기',
        text: '"읽기 계획" 메뉴에서 1년 통독, 신약 읽기 등 여러 계획 중 하나를 골라 시작할 수 있습니다. 계획을 시작하면 오늘 읽을 분량이 안내되어 어디서부터 읽어야 할지 헷갈리지 않습니다.',
      },
      {
        subtitle: '구역 현황 보기',
        text: '"구역 현황" 메뉴에서 우리 구역 식구들이 각각 얼마나 성경을 읽었는지 확인할 수 있습니다. 서로 자극을 받으며 함께 읽어 나갈 수 있습니다.',
      },
    ],
  },
  {
    id: 'schedule',
    title: '주요 일정',
    icon: CalendarDays,
    content: [
      {
        subtitle: '일정 확인하기',
        text: '구역 모임, 교회 행사 등 주요 일정을 확인할 수 있습니다. 각 일정의 날짜, 시간, 장소가 표시됩니다. 홈 화면에도 가장 가까운 일정이 미리 보입니다.',
      },
      {
        subtitle: '참석 여부 답하기',
        text: '일부 일정에는 참석 여부를 답할 수 있는 기능이 있습니다. 해당 일정을 눌러 "참석" 또는 "불참"을 선택하면 구역장님께 자동으로 전달됩니다.',
      },
    ],
  },
  {
    id: 'search',
    title: '검색 / 알림',
    icon: Search,
    content: [
      {
        subtitle: '검색하기',
        text: '화면 위쪽의 돋보기 아이콘을 누르면 검색창이 열립니다. 성경공부 제목, 일정 이름, 기도제목 내용을 한꺼번에 찾을 수 있습니다. 컴퓨터에서는 Ctrl+K (맥은 Cmd+K)를 눌러도 열립니다.',
      },
      {
        subtitle: '알림 확인하기',
        text: '화면 위쪽의 종 모양 아이콘을 누르면 알림 목록을 볼 수 있습니다. 읽지 않은 알림이 있으면 아이콘에 빨간 점이 표시됩니다.',
      },
    ],
  },
  {
    id: 'profile',
    title: '내 정보 (프로필)',
    icon: UserCircle,
    content: [
      {
        subtitle: '내 정보 화면 열기',
        text: '화면 아래쪽 "더보기" 메뉴를 누른 후 "내 프로필"을 선택하거나, 화면 위쪽의 내 이름을 눌러도 됩니다. 이름 변경, 비밀번호 변경, 구글·카카오 계정 연결, 알림 설정을 여기서 할 수 있습니다.',
      },
      {
        subtitle: '이름 또는 비밀번호 바꾸기',
        text: '프로필 화면에서 표시되는 이름을 바꿀 수 있습니다. 비밀번호를 잊어버리셨거나 바꾸고 싶을 때도 이 화면에서 새 비밀번호를 설정할 수 있습니다.',
      },
      {
        subtitle: '구글 · 카카오 계정 연결하기',
        text: '이미 이메일로 가입하셨더라도 나중에 구글 또는 카카오 계정을 연결할 수 있습니다. 연결해 두면 다음에 로그인할 때 비밀번호 없이 구글이나 카카오로 간편하게 로그인할 수 있습니다.',
      },
      {
        subtitle: '휴대폰 알림 받기',
        text: '프로필 화면에서 "알림 받기" 설정을 켜두면 구역에 새 소식이 생겼을 때 휴대폰 알림으로 알려드립니다. 알림이 필요 없으시면 언제든지 끌 수 있습니다.',
      },
      {
        subtitle: '탈퇴하기',
        text: '앱을 더 이상 사용하지 않으시려면 프로필 화면 맨 아래쪽에서 탈퇴할 수 있습니다. "탈퇴"라고 직접 입력해야 탈퇴 버튼이 활성화됩니다. 탈퇴하면 내 모든 기록이 삭제되며 되돌릴 수 없으니 신중하게 결정해 주세요.',
      },
    ],
  },
  {
    id: 'admin',
    title: '구역장 관리 기능',
    icon: Settings,
    content: [
      {
        subtitle: '관리 화면 들어가기',
        text: '구역장 또는 관리자만 사용할 수 있는 기능입니다. 화면 아래쪽 "더보기" 메뉴 또는 화면 위쪽 메뉴에서 "관리자"를 선택하면 관리 화면으로 들어갑니다.',
      },
      {
        subtitle: '구역원 초대하기',
        text: '구성원 화면 위쪽의 "초대 링크 복사" 버튼을 누르면 우리 구역 전용 초대 링크가 복사됩니다. 이 링크를 카카오톡이나 문자로 전달하면 받은 사람이 링크를 눌러 바로 가입하고 우리 구역에 자동으로 들어오게 됩니다. 일일이 승인하지 않아도 되어 편리합니다.',
      },
      {
        subtitle: '가입 승인하기',
        text: '초대 링크가 아닌 직접 가입한 사람은 구역원 목록에 "대기 중"으로 표시됩니다. 승인 버튼을 눌러 가입을 확정해 주시면 해당 분이 앱을 사용할 수 있게 됩니다.',
      },
      {
        subtitle: '말씀 묵상 현황 보기',
        text: '오늘 구역원 중 누가 말씀 묵상을 완료했는지 한눈에 볼 수 있습니다. 며칠째 못 하고 있는 분도 표시되어 격려해 드릴 수 있습니다. 구역장 코멘트를 입력해 두면 다음 날 아침 알림에 포함됩니다.',
      },
      {
        subtitle: '성경공부 등록하기',
        text: '성경공부 자료를 직접 입력하거나 주보 PDF 파일에서 자동으로 불러올 수 있습니다. 등록 후 내용을 확인한 다음 "발행" 버튼을 누르면 구역원들에게 보입니다. 각 성경공부 항목 옆 아이콘을 누르면 누가 완료했는지 확인할 수 있습니다 (답변 내용은 볼 수 없고 완료 여부만 표시됩니다).',
      },
      {
        subtitle: '주간 현황 보기 및 내보내기',
        text: '주간 보고 화면에서 참석 인원, 성경읽기 합계, 성경공부 완료율 등을 확인할 수 있습니다. "내보내기" 버튼을 누르면 엑셀에서 열 수 있는 파일로 저장됩니다.',
      },
      {
        subtitle: '공지 문자 만들기',
        text: '일정이나 성경공부 안내 문자를 자동으로 만들어 주는 기능입니다. "복사" 버튼을 누른 다음 카카오톡 단체 채팅방에 붙여넣기 하면 됩니다.',
      },
    ],
  },
  {
    id: 'tips',
    title: '자주 묻는 질문 / 도움말',
    icon: HelpCircle,
    content: [
      {
        subtitle: '화면 이동은 어떻게 하나요?',
        text: '화면 맨 아래쪽에 있는 메뉴 버튼으로 이동합니다. 집 모양(홈), 하트(기도), 책(성경공부), 불꽃(QT 묵상), 점 세 개(더보기) 순서입니다.',
      },
      {
        subtitle: '밤에는 어두운 화면으로 바꿀 수 있나요?',
        text: '네, 가능합니다. 화면 위쪽의 해 또는 달 모양 아이콘을 누르거나, 더보기 메뉴에서 야간 모드를 켜고 끌 수 있습니다.',
      },
      {
        subtitle: '묵상 완료 기록이 안 쌓여요',
        text: '말씀 묵상 완료 기록은 "기도하기" 버튼을 누른 후 기도 화면에서 "오늘 QT 완료" 버튼까지 눌러야 기록됩니다. 중간에 나오면 기록이 저장되지 않습니다. 답변을 쓰지 않아도 완료 처리는 가능합니다.',
      },
      {
        subtitle: '인터넷이 없을 때도 쓸 수 있나요?',
        text: '인터넷이 끊기면 화면 위쪽에 안내 문구가 나타납니다. 이전에 본 내용 일부는 볼 수 있지만, 새 내용을 보거나 기록을 저장하려면 인터넷이 연결되어야 합니다.',
      },
      {
        subtitle: '화면이 이상하게 나와요',
        text: '먼저 화면을 아래로 당겨 새로고침 해보세요. 그래도 안 되면 브라우저를 완전히 닫고 다시 열어보세요. 계속 문제가 있으면 구역장님께 알려주세요.',
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
