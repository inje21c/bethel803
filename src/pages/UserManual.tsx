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
    title: '🚀 시작하기',
    icon: Home,
    content: [
      {
        subtitle: '앱 설치하기 (홈 화면에 추가)',
        text: '앱처럼 홈 화면에 아이콘을 추가해 두면 훨씬 편리합니다. 아이폰(iOS): Safari 브라우저 하단의 공유 버튼을 누른 후 "홈 화면에 추가"를 선택하세요. 안드로이드: 주소창 옆의 점 세 개 메뉴를 누른 후 "홈 화면에 추가"를 선택하세요.',
      },
      {
        subtitle: '가입 및 로그인',
        text: '초대 링크를 받으셨다면 클릭만으로 우리 구역에 자동 연결됩니다. 직접 가입하실 때는 이메일, 이름, 비밀번호를 입력하고 구역을 선택하면 됩니다. 구글이나 카카오 계정으로 1초 만에 로그인할 수도 있습니다.',
        uiBadges: ['[구글로 계속하기]', '[카카오로 계속하기]']
      },
      {
        subtitle: '내 프로필 관리',
        text: '화면 맨 아래 메뉴에서 [더보기] > [내 프로필]로 들어가시면 이름, 비밀번호를 변경하거나 알림 설정을 켤 수 있습니다. 이미 이메일로 가입하셨더라도 나중에 소셜 계정을 연결할 수 있습니다.',
        uiBadges: ['[더보기]', '[내 프로필]']
      }
    ]
  },
  {
    id: 'devotion',
    title: '📖 경건 생활',
    icon: BookHeart,
    content: [
      {
        subtitle: '오늘의 말씀 묵상 (QT)',
        text: '매일 주어지는 오늘의 말씀을 읽고 묵상합니다. 질문에 대해 내 생각을 적고 "오늘 QT 완료" 버튼을 누르면 연속 기록(Streak)이 쌓입니다. 연속 기록이 쌓일수록 화면에 불꽃 아이콘이 강렬하게 표시됩니다.',
        uiBadges: ['[말씀 묵상하기]', '[오늘 QT 완료]']
      },
      {
        subtitle: '앱 내 성경 본문 읽기',
        text: '앱 안에서 그날의 묵상 본문을 바로 읽을 수 있습니다. 무겁게 성경책을 들고 다닐 필요 없이 출퇴근 길에서도 스마트폰 하나로 말씀을 깊이 묵상해 보세요.',
        isPremium: true
      },
      {
        subtitle: 'AI 깊은 묵상',
        text: '말씀 묵상 화면 하단의 "깊은 묵상" 버튼을 누르면 인공지능(AI)이 4단계(관찰, 질문, 느낌, 결단)에 걸쳐 말씀을 더 깊이 파고들 수 있도록 맞춤형 질문을 던져줍니다.',
        isPremium: true,
        uiBadges: ['[깊은 묵상 시작하기]']
      },
      {
        subtitle: '성경읽기 계획과 기록',
        text: '성경읽기 탭에서 1년 1독, 신약 통독 등 나만의 목표를 세울 수 있습니다. 오늘 읽은 장수를 입력하면 전체 구역원들의 누적 성경읽기 현황판에 합산되어 함께하는 기쁨을 누릴 수 있습니다.'
      }
    ]
  },
  {
    id: 'community',
    title: '🤝 구역 모임',
    icon: MessageSquareHeart,
    content: [
      {
        subtitle: '구역성경공부 답변 작성',
        text: '구역장님이 올려주신 이번 주 성경공부 질문에 내 생각을 적어보세요. 내 답변은 나만 볼 수 있어서 솔직하게 기록할 수 있습니다. 중간에 "임시 저장"을 해두고 나중에 이어 쓸 수도 있습니다.',
        uiBadges: ['[임시 저장]', '[완료로 저장]']
      },
      {
        subtitle: '기도제목 나누기',
        text: '내 기도제목을 올리고, 구역 식구들의 기도제목 옆에 있는 하트를 눌러 "함께 기도"에 동참해 보세요. 기도가 이루어졌다면 "응답됨" 버튼을 눌러 기쁨을 나눌 수 있습니다.',
        uiBadges: ['[응답됨]']
      },
      {
        subtitle: '주요 일정 확인',
        text: '가장 가까운 구역 모임 일정이 홈 화면에 미리보기로 뜹니다. 일정을 눌러 "참석" 또는 "불참"을 선택하면 구역장님께 참석 인원이 자동으로 집계됩니다.',
        uiBadges: ['[참석]', '[불참]']
      }
    ]
  },
  {
    id: 'utils',
    title: '💡 유용한 기능',
    icon: Search,
    content: [
      {
        subtitle: '통합 검색 (빠른 찾기)',
        text: '화면 위쪽 돋보기 아이콘을 누르면 앱의 모든 것을 찾을 수 있습니다. 성경공부 제목, 지난 기도제목, 일정 이름 등을 키워드로 단번에 검색하세요.',
        uiBadges: ['Ctrl + K', 'Cmd + K']
      },
      {
        subtitle: '알림 및 야간 모드',
        text: '종 모양 아이콘으로 읽지 않은 새 소식을 확인하세요. 밤에 눈이 부시지 않도록 화면 위쪽 해/달 모양 아이콘을 눌러 어두운 테마(야간 모드)로 전환할 수 있습니다.'
      }
    ]
  }
];

// ==========================================
// 2. 구역장 가이드 데이터 (조건별 분기)
// ==========================================
type LeaderType = 'bethel' | 'trial' | 'special';

const getLeaderSections = (type: LeaderType): Section[] => {
  const commonAdmin: Section = {
    id: 'admin_overview',
    title: '👑 구역 관리의 모든 것',
    icon: Crown,
    content: [
      {
        subtitle: '구역장 기능 개요',
        text: '구역장님, 수고 많으십니다! 관리자 메뉴에서는 [초대 링크 복사]를 통해 구역원을 손쉽게 초대하고, [주간 보고] 탭에서 구역의 모든 활동 현황(묵상, 성경읽기, 참석률)을 엑셀로 내보낼 수 있습니다.',
      },
      {
        subtitle: '상세 사용법은 어디에 있나요?',
        text: '기능이 매우 많아 이 페이지에 모두 담지 않았습니다. 관리자 메뉴(더보기 > 관리자)로 들어가시면 각 관리 화면(구성원, 성경공부, 보고서 등) 상단/하단에 상세한 도움말 팁이 배치되어 있습니다. 필요할 때 바로 확인해 보세요!',
        uiBadges: ['💡 관리자 각 탭의 상세 안내 패널 참고']
      }
    ]
  };

  if (type === 'bethel') {
    return [
      commonAdmin,
      {
        id: 'admin_bethel',
        title: '🌟 벧엘교회 전용 자동화 기능',
        icon: Sparkles,
        content: [
          {
            subtitle: '주보 PDF 자동 파싱',
            text: '교회 주보 PDF 파일을 업로드하기만 하면 인공지능이 이번 주 성경공부 본문, 제목, 질문들을 자동으로 추출하여 초안을 만들어 줍니다. 오타만 살짝 수정하고 "발행"을 누르세요.'
          },
          {
            subtitle: '공지 문자 원터치 생성',
            text: '모임 일시와 장소, 이번 주 QT 범위를 요약하여 카카오톡에 바로 붙여넣을 수 있는 "안내 문자"를 자동 생성합니다.'
          }
        ]
      }
    ];
  }

  if (type === 'trial') {
    return [
      commonAdmin,
      {
        id: 'admin_trial',
        title: '🌱 기본 체험판 안내',
        icon: Settings,
        content: [
          {
            subtitle: '성경공부 직접 등록하기',
            text: '현재는 기본 체험판을 사용 중이시므로, 성경공부 자료를 등록할 때 [새 성경공부 추가] 버튼을 눌러 질문과 본문을 직접 입력해 주셔야 합니다.'
          },
          {
            subtitle: '풀 기능 도입을 원하시나요?',
            text: '정식 버전을 도입하시면 주보 PDF 자동 파싱, 앱 내 개역개정 성경 본문 탑재, 공지 문자 자동 생성 등 구역장님의 수고를 덜어드리는 풀 자동화 기능이 활성화됩니다.'
          }
        ]
      }
    ];
  }

  // special
  return [
    commonAdmin,
    {
      id: 'admin_special',
      title: '💎 유료/특별 권한 관리 가이드',
      icon: Star,
      content: [
        {
          subtitle: '엑셀 보고서 및 상세 관리',
          text: '소속 교회의 설정에 따라 풀 패키지 기능이 제공됩니다. 구역원들의 QT 묵상율, 성경읽기 진도율, 성경공부 참여도를 엑셀 리포트로 다운로드하여 효과적으로 관리해 보세요.'
        },
        {
          subtitle: '권한 관련 참고사항',
          text: '일부 라이선스가 필요한 본문 데이터(예: 특정 번역본 성경)나 타 교회 전용 PDF 파싱 모듈은 제외되어 있을 수 있습니다. 제공된 권한 내에서 최대한의 편의 기능을 누려보세요.'
        }
      ]
    }
  ];
};

// ==========================================
// 3. FAQ 데이터
// ==========================================
const faqSections: Section[] = [
  {
    id: 'faq_general',
    title: '🤔 자주 묻는 질문',
    icon: HelpCircle,
    content: [
      {
        subtitle: '인터넷이 끊겨도 쓸 수 있나요?',
        text: '인터넷이 없으면 화면 위쪽에 오프라인 안내 문구가 뜹니다. 이전에 열어본 내용은 볼 수 있지만, 묵상 답변을 쓰거나 새 성경공부를 보려면 인터넷 연결이 필요합니다.'
      },
      {
        subtitle: '화면이 이상하거나 먹통이 됩니다',
        text: '화면을 아래로 쭉 당겨 새로고침을 해보세요. 그래도 안 되면 사용 중인 인터넷 브라우저 앱을 완전히 닫았다가 다시 열어보시기 바랍니다.'
      },
      {
        subtitle: '묵상 완료 기록이 왜 안 쌓이나요?',
        text: '말씀 묵상을 하신 후 맨 마지막 기도 화면에서 [오늘 QT 완료] 버튼까지 꼭 누르셔야 연속 기록이 올라갑니다. 중간에 창을 닫으면 저장되지 않습니다.'
      }
    ]
  }
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> 벧엘구역 이용안내
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
