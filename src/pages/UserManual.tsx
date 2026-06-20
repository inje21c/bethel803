import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Home, MessageSquareHeart, BookMarked, CalendarDays,
  Settings, ChevronDown, ChevronRight, HelpCircle, UserCircle,
  Search, BookHeart, Crown, Star, Sparkles
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/lib/authContext';
import { useChurch } from '@/lib/churchContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface ManualItem {
  subtitle: string;
  text: string;
  isPremium?: boolean;
  uiBadges?: string[];
}

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: ManualItem[];
}

// ==========================================
// 1. 일반 구역원 통합 매뉴얼 데이터
// ==========================================
const getMemberSections = (): Section[] => [
  {
    id: 'start',
    title: '시작하기',
    icon: Home,
    content: [
      {
        subtitle: '앱 설치 — 홈 화면에 추가하기',
        text: '웹 앱이라 별도 설치 없이 바로 쓸 수 있지만, 홈 화면에 아이콘을 추가해 두면 훨씬 편리합니다. 아이폰(iOS): Safari 하단 공유 버튼 → "홈 화면에 추가". 안드로이드: 주소창 옆 점 세 개 메뉴 → "홈 화면에 추가".',
      },
      {
        subtitle: '가입 방법',
        text: '구역장님이 보내준 초대 링크를 누르면 우리 구역에 자동 연결됩니다. 이메일·구글·카카오 계정 중 편한 방법으로 가입하세요. 가입 후 구역장님이 승인하면 모든 기능을 사용할 수 있습니다.',
        uiBadges: ['[구글로 계속하기]', '[카카오로 계속하기]'],
      },
      {
        subtitle: '내 정보 변경',
        text: '하단 [나] 탭에서 이름·비밀번호를 변경하거나, 소셜 계정을 추가로 연결할 수 있습니다. 알림 설정과 다크 모드도 이 화면에서 조절합니다.',
        uiBadges: ['[나] 탭'],
      },
    ],
  },
  {
    id: 'home',
    title: '홈 화면',
    icon: Home,
    content: [
      {
        subtitle: '홈 화면 구성',
        text: '오늘의 QT 카드와 성경읽기 진도, 다가오는 일정, 구역 기도제목이 한눈에 모입니다. 가장 중요한 것부터 위에 배치되어 있으니 매일 홈에서 하루를 시작해 보세요.',
        uiBadges: ['[홈] 탭'],
      },
      {
        subtitle: '나의 성경읽기 진도',
        text: '홈 화면에서 올해 읽은 성경 장수와 전체 1189장 대비 진도를 확인할 수 있습니다. [이어 읽기 →]를 누르면 마지막으로 읽던 곳으로 바로 이동합니다.',
        uiBadges: ['[이어 읽기 →]'],
      },
    ],
  },
  {
    id: 'qt',
    title: 'QT — 오늘의 묵상',
    icon: BookHeart,
    content: [
      {
        subtitle: 'QT 흐름',
        text: '하단 [QT] 탭을 누르면 오늘의 말씀이 열립니다. 본문을 읽고 묵상 질문에 답한 뒤, 기도하기 화면에서 [오늘 QT 완료] 버튼을 누르면 완료 기록이 쌓입니다. 연속으로 쌓이면 불꽃 숫자가 올라갑니다.',
        uiBadges: ['[QT] 탭', '[오늘 QT 완료]'],
      },
      {
        subtitle: '앱 내 성경 본문 보기',
        text: '묵상 화면에서 바로 성경 본문을 읽을 수 있습니다. 성경책 없이도 정확한 본문을 앱 안에서 확인하세요.',
        isPremium: true,
      },
      {
        subtitle: 'AI 깊은 묵상 (4단계)',
        text: '묵상 화면 하단의 [깊은 묵상 시작하기]를 누르면 AI가 ①관찰 → ②연구·묵상 → ③느낌 → ④결단 4단계로 안내합니다. 각 단계별 질문에 답하며 말씀을 더 깊이 새길 수 있습니다.',
        isPremium: true,
        uiBadges: ['[깊은 묵상 시작하기]'],
      },
      {
        subtitle: '완료 캘린더',
        text: 'QT를 완료하면 달력에 기록이 표시됩니다. 지난 날짜를 눌러 그날의 묵상을 다시 볼 수 있습니다.',
      },
    ],
  },
  {
    id: 'community',
    title: '구역 — 4가지 기능',
    icon: MessageSquareHeart,
    content: [
      {
        subtitle: '성경공부',
        text: '구역장님이 올린 이번 주 성경공부 질문에 내 생각을 적어보세요. 내 답변은 나만 볼 수 있어 솔직하게 쓸 수 있습니다. [임시 저장] 후 나중에 이어 쓰는 것도 가능합니다.',
        uiBadges: ['[구역] → [성경공부]', '[임시 저장]', '[완료로 저장]'],
      },
      {
        subtitle: '기도제목',
        text: '내 기도제목을 나누고 구역 식구들의 기도제목에 하트로 함께 기도할 수 있습니다. 기도가 응답되면 [응답됨]을 눌러 기쁨을 나눠 보세요.',
        uiBadges: ['[구역] → [기도제목]', '[응답됨]'],
      },
      {
        subtitle: '일정',
        text: '구역 모임 일정을 확인하고 [참석] 또는 [불참]을 선택하면 구역장님께 인원이 자동으로 집계됩니다. 가까운 일정은 홈 화면에도 미리 표시됩니다.',
        uiBadges: ['[구역] → [일정]', '[참석]', '[불참]'],
      },
      {
        subtitle: '성경읽기',
        text: '오늘 읽은 성경 장수를 입력하면 올해 누적 진도가 쌓입니다. 구역원 전체의 합산 현황도 함께 볼 수 있어 함께하는 기쁨을 느낄 수 있습니다.',
        uiBadges: ['[구역] → [성경읽기]'],
      },
    ],
  },
  {
    id: 'profile',
    title: '나 — 내 기록과 설정',
    icon: UserCircle,
    content: [
      {
        subtitle: '나의 활동 기록',
        text: '[나] 탭 상단에서 올해 QT 일수·성경읽기 장수·기도 건수를 한눈에 볼 수 있습니다. 아래 활동 캘린더에서는 QT·성경읽기·일정 참여를 날짜별로 확인합니다.',
        uiBadges: ['[나] 탭'],
      },
      {
        subtitle: '설정 항목',
        text: '프로필 수정(이름·비밀번호), 다크 모드, 알림 설정, 사용 안내, 문의하기, 로그아웃, 회원 탈퇴가 설정 섹션에 있습니다.',
      },
    ],
  },
  {
    id: 'utils',
    title: '편리한 기능',
    icon: Search,
    content: [
      {
        subtitle: '통합 검색',
        text: '화면 상단 돋보기 아이콘을 누르면 성경공부 제목, 기도제목, 일정을 키워드로 검색할 수 있습니다.',
      },
      {
        subtitle: '알림',
        text: '상단 종 모양 아이콘으로 새 소식을 확인하세요. 읽지 않은 알림이 있으면 빨간 점이 표시됩니다.',
      },
      {
        subtitle: '다크 모드',
        text: '[나] 탭 설정에서 다크 모드를 켜고 끌 수 있습니다. 밤에 눈이 편합니다.',
      },
      {
        subtitle: '문의하기',
        text: '앱 사용 중 불편한 점이나 건의 사항이 있으면 [나] → [문의하기]로 알려주세요. 개발팀이 직접 답변 드립니다.',
        uiBadges: ['[나] → [문의하기]'],
      },
    ],
  },
];

// ==========================================
// 2. 구역장 가이드 데이터 (조건별 분기)
// ==========================================
type LeaderType = 'bethel' | 'trial' | 'special';

const getLeaderSections = (type: LeaderType): Section[] => {
  const commonAdmin: Section = {
    id: 'admin_overview',
    title: '구역장 기본 관리',
    icon: Crown,
    content: [
      {
        subtitle: '구역원 초대',
        text: '관리자 화면 상단의 [초대 링크 복사]를 눌러 링크를 카카오톡으로 공유하세요. 링크를 통해 가입한 구역원은 우리 구역에 자동 연결됩니다. 가입 후 [구성원] 탭에서 승인하면 활성화됩니다.',
        uiBadges: ['[관리자]', '[초대 링크 복사]', '[구성원] 탭'],
      },
      {
        subtitle: '성경공부 등록·관리',
        text: '관리자 [성경공부] 탭에서 이번 주 본문과 질문을 등록합니다. 등록된 성경공부는 구역원의 [구역 → 성경공부]에 바로 표시됩니다. 구역원 답변은 완료 여부만 확인 가능하며 내용은 열람되지 않습니다.',
        uiBadges: ['[관리자] → [성경공부]'],
      },
      {
        subtitle: '일정 등록',
        text: '관리자 [일정] 탭에서 구역 모임 일정을 추가합니다. 제목·날짜·시간·장소를 입력하면 구역원 홈 화면과 [구역 → 일정]에 바로 표시됩니다. 구역원이 참석/불참을 선택하면 참석 현황이 자동 집계됩니다.',
        uiBadges: ['[관리자] → [일정]'],
      },
      {
        subtitle: '출석 체크',
        text: '관리자 [출석] 탭에서 구역원별 주일 출석을 기록합니다. 출석 데이터는 주간 보고서에 반영됩니다.',
        uiBadges: ['[관리자] → [출석]'],
      },
      {
        subtitle: '주간 보고서',
        text: '관리자 [보고서] 탭에서 이번 주 구역 활동(QT 완료율, 성경읽기 합계, 출석 현황)을 한눈에 보고 엑셀로 내보낼 수 있습니다.',
        uiBadges: ['[관리자] → [보고서]'],
      },
    ],
  };

  if (type === 'bethel') {
    return [
      commonAdmin,
      {
        id: 'admin_bethel',
        title: '벧엘교회 전용 자동화',
        icon: Sparkles,
        content: [
          {
            subtitle: '주보 PDF 자동 파싱',
            text: '관리자 [성경공부] 탭에서 주보 PDF를 업로드하면 AI가 이번 주 본문·제목·질문을 자동으로 추출합니다. 내용을 확인하고 [발행]을 누르면 바로 등록됩니다.',
            uiBadges: ['[관리자] → [성경공부] → [주보 파싱]'],
          },
          {
            subtitle: '공지 문자 자동 생성',
            text: '모임 일시·장소·QT 범위를 요약한 카카오톡 공지 문자를 한 번에 생성합니다. 복사해서 단톡방에 바로 붙여넣으세요.',
          },
        ],
      },
    ];
  }

  if (type === 'trial') {
    return [
      commonAdmin,
      {
        id: 'admin_trial',
        title: '체험판 안내',
        icon: Settings,
        content: [
          {
            subtitle: '성경공부는 직접 입력',
            text: '체험 기간에는 주보 자동 파싱 기능이 제공되지 않습니다. 관리자 [성경공부] → [새 성경공부 추가]에서 본문과 질문을 직접 입력해 주세요.',
            uiBadges: ['[새 성경공부 추가]'],
          },
          {
            subtitle: '정식 도입 문의',
            text: '주보 자동 파싱, 앱 내 성경 본문, AI 깊은 묵상 등 풀 기능은 정식 계약 후 활성화됩니다. [나] → [문의하기]로 연락주세요.',
            uiBadges: ['[나] → [문의하기]'],
          },
        ],
      },
    ];
  }

  // special
  return [
    commonAdmin,
    {
      id: 'admin_special',
      title: '고급 관리 기능',
      icon: Star,
      content: [
        {
          subtitle: '엑셀 보고서',
          text: '구역원별 QT 완료율, 성경읽기 진도, 성경공부 참여도, 출석 현황을 엑셀 파일로 다운로드할 수 있습니다. 정기 보고나 목장 보고서 작성에 활용하세요.',
          uiBadges: ['[관리자] → [보고서] → [엑셀 내보내기]'],
        },
        {
          subtitle: '마스터 권한 이관',
          text: '교회 전체 관리 권한(마스터)을 다른 구역원에게 넘길 수 있습니다. [나] → 프로필 수정 화면에서 이관할 수 있으며, 이름을 다시 입력해 확인하는 단계가 있습니다.',
        },
      ],
    },
  ];
};

// ==========================================
// 3. FAQ 데이터
// ==========================================
const faqSections: Section[] = [
  {
    id: 'faq_general',
    title: '자주 묻는 질문',
    icon: HelpCircle,
    content: [
      {
        subtitle: 'QT 완료 기록이 왜 안 쌓이나요?',
        text: '[QT] 탭에서 말씀을 읽고 묵상 답변을 작성한 뒤, 마지막 기도하기 화면에서 [오늘 QT 완료] 버튼을 눌러야 기록이 저장됩니다. 중간에 앱을 닫으면 완료 처리가 되지 않습니다.',
        uiBadges: ['[오늘 QT 완료]'],
      },
      {
        subtitle: '인터넷이 끊겨도 쓸 수 있나요?',
        text: '오프라인에서는 화면 상단에 안내 문구가 표시됩니다. 이전에 열어 본 내용은 볼 수 있지만, 새 내용을 불러오거나 답변을 저장하려면 인터넷 연결이 필요합니다.',
      },
      {
        subtitle: '화면이 안 열리거나 멈춥니다',
        text: '화면을 아래로 당겨 새로고침해 보세요. 그래도 안 되면 브라우저를 완전히 닫았다가 다시 열어 주세요.',
      },
      {
        subtitle: '카카오로 로그인이 안 됩니다',
        text: '카카오 로그인은 카카오 인앱 브라우저에서 차단될 수 있습니다. 카카오톡으로 공유된 링크는 외부 브라우저(Safari, Chrome)로 열어서 로그인해 주세요.',
      },
      {
        subtitle: '가입했는데 구역에 들어갈 수 없어요',
        text: '가입 후 구역장님의 승인이 필요합니다. 구역장님께 승인 요청을 드리거나, 초대 링크를 다시 받아서 가입하면 자동 배정됩니다.',
      },
      {
        subtitle: '비밀번호를 잊어버렸어요',
        text: '로그인 화면에서 [비밀번호 찾기]를 누르면 가입한 이메일로 재설정 링크가 발송됩니다. 구글이나 카카오로 가입하셨다면 해당 계정으로 바로 로그인하세요.',
        uiBadges: ['[비밀번호 찾기]'],
      },
    ],
  },
];

export default function UserManual() {
  const { user } = useAuth();
  const { settings, hasModule } = useChurch();

  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['start']));

  const isLeaderOrMaster = user?.role === 'leader' || user?.role === 'master';
  
  // 구역장 타입 결정
  const leaderType: LeaderType = useMemo(() => {
    if (settings?.plan === 'legacy') return 'bethel';
    if (settings?.isTrialing && settings?.uiMode === 'simple') return 'trial';
    return 'special';
  }, [settings]);

  const memberSections = useMemo(() => getMemberSections(), []);
  const leaderSections = useMemo(() => getLeaderSections(leaderType), [leaderType]);

  const hasBibleText = hasModule('bible_text');

  useEffect(() => {
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchedIds = new Set<string>();
      const allSecs = [...memberSections, ...leaderSections, ...faqSections];
      allSecs.forEach(sec => {
        if (sec.title.toLowerCase().includes(q)) {
          matchedIds.add(sec.id);
        } else if (sec.content.some(item => item.subtitle.toLowerCase().includes(q) || item.text.toLowerCase().includes(q))) {
          matchedIds.add(sec.id);
        }
      });
      setOpenSections(prev => new Set([...prev, ...matchedIds]));
    }
  }, [searchQuery, memberSections, leaderSections]);

  const toggle = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = (sections: Section[]) => setOpenSections(new Set(sections.map(s => s.id)));
  const collapseAll = () => setOpenSections(new Set());

  const filterSections = (sections: Section[]) => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    
    return sections.map(sec => {
      const filteredContent = sec.content.filter(
        item => item.subtitle.toLowerCase().includes(q) || item.text.toLowerCase().includes(q)
      );
      if (sec.title.toLowerCase().includes(q)) return sec;
      return filteredContent.length > 0 ? { ...sec, content: filteredContent } : null;
    }).filter(Boolean) as Section[];
  };

  const renderSections = (sections: Section[]) => {
    const filtered = filterSections(sections);

    if (filtered.length === 0) {
      return (
        <div className="py-12 text-center text-muted-foreground">
          검색 결과가 없습니다.
        </div>
      );
    }

    return (
      <div className="space-y-3 mt-4">
        <div className="flex justify-end gap-2 mb-2">
          <button onClick={() => expandAll(filtered)} className="text-xs text-primary font-medium hover:underline">
            모두 펼치기
          </button>
          <span className="text-muted-foreground">|</span>
          <button onClick={collapseAll} className="text-xs text-muted-foreground font-medium hover:underline">
            모두 접기
          </button>
        </div>
        
        <AnimatePresence>
          {filtered.map((section, idx) => {
            const isOpen = openSections.has(section.id);
            const Icon = section.icon;
            
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
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
                    <div className="space-y-6 pt-4">
                      {section.content.map((item, i) => (
                        <div key={i} className="space-y-2">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            {item.subtitle}
                            {item.isPremium && (
                              <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                                🌟 정식 서비스
                              </Badge>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed break-keep">
                            {item.text}
                          </p>
                          
                          {/* UI Badge (Menu/Button clicks) */}
                          {item.uiBadges && item.uiBadges.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {item.uiBadges.map((badge, bi) => (
                                <Badge key={bi} variant="secondary" className="font-mono text-xs text-foreground/80">
                                  {badge}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Premium Marketing CTA */}
                          {item.isPremium && !hasBibleText && (
                            <div className="mt-3 p-3 bg-amber-50/50 border border-amber-100 rounded-lg dark:bg-amber-900/10 dark:border-amber-900/30">
                              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                                {settings?.isTrialing
                                  ? "📣 현재 우리 구역은 기본 체험판을 사용 중이어서 앱 내 성경 본문 열람 및 AI 기능이 제한되어 있습니다. 더 편리하고 깊은 묵상을 위해 구역장님께 정식 버전 도입을 건의해 보세요!"
                                  : "📣 현재 우리 교회의 플랜에서는 앱 내 성경 본문 열람 및 AI 기능이 제한되어 있습니다. 더 편리하고 깊은 묵상을 위해 구역장님께 풀 패키지 도입을 건의해 보세요!"}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> 이용안내
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              더 쉽고 은혜로운 소모임을 위한 가이드
            </p>
          </div>
        </div>

        {/* 통합 검색창 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="궁금한 기능을 검색해보세요 (예: 기도제목, 비밀번호)"
            className="pl-9 h-11 bg-card border-muted/50 focus-visible:ring-primary/20"
          />
        </div>

        <Tabs defaultValue="member" className="w-full">
          <TabsList className={`grid w-full ${isLeaderOrMaster ? 'grid-cols-3' : 'grid-cols-2'} h-auto p-1 bg-muted/50`}>
            <TabsTrigger value="member" className="py-2.5 font-semibold">구역원 가이드</TabsTrigger>
            {isLeaderOrMaster && (
              <TabsTrigger value="leader" className="py-2.5 font-semibold text-primary data-[state=active]:text-primary">
                구역장 안내
              </TabsTrigger>
            )}
            <TabsTrigger value="faq" className="py-2.5 font-semibold">자주 묻는 질문</TabsTrigger>
          </TabsList>

          <TabsContent value="member" className="mt-4 focus-visible:outline-none">
            {renderSections(memberSections)}
          </TabsContent>

          {isLeaderOrMaster && (
            <TabsContent value="leader" className="mt-4 focus-visible:outline-none">
              {renderSections(leaderSections)}
            </TabsContent>
          )}

          <TabsContent value="faq" className="mt-4 focus-visible:outline-none">
            {renderSections(faqSections)}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
