import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Lock,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useChurch } from '@/lib/churchContext';
import { useDistrict } from '@/lib/districtContext';
import {
  addBibleBookmark,
  addBibleReadingLog,
  completeCurrentBiblePlanChapter,
  completeBiblePlanDay,
  createBibleReadingPlan,
  deleteBibleBookmark,
  deleteBibleReadingLog,
  getBibleBookmarks,
  getBibleBooks,
  getBibleChapter,
  getBibleReadingLogs,
  getCurrentLockStatus,
  getKSTDateString,
  getPrimaryBibleReadingPlan,
  setBiblePlanItemCompleted,
  updateBibleReadingLog,
  updateBibleReadingPlan,
  type BibleBookmark,
  type BibleBook,
  type BibleReadingPlan,
  type BibleReadingPlanDay,
  type BibleReadingPlanItem,
  type BibleReadingPlanScope,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/components/AppLayout';
import CommunitySubNav from '@/components/CommunitySubNav';
import BibleReferencePicker from '@/components/BibleReferencePicker';
import { toast } from 'sonner';

const FONT_SIZE_CLASSES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
const FONT_SIZE_LABELS = ['작게', '기본', '크게', '더 크게', '아주 크게'];
const LAST_LOCATION_KEY_PREFIX = 'bethel_bible_last_location';
const PLAN_SCOPE_LABELS: Record<BibleReadingPlanScope, string> = {
  all: '성경 전체',
  old: '구약',
  new: '신약',
};

interface LastBibleLocation {
  bookId: number;
  chapter: number;
  verse: number;
}

function buildVerseKey(bookId: number, chapter: number, verse: number) {
  return `${bookId}:${chapter}:${verse}`;
}

function getLastLocationKey(userId?: string | null) {
  return `${LAST_LOCATION_KEY_PREFIX}:${userId ?? 'guest'}`;
}

function readLastLocation(userId?: string | null): LastBibleLocation | null {
  try {
    const raw = localStorage.getItem(getLastLocationKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastBibleLocation>;
    if (
      Number.isInteger(parsed.bookId) &&
      Number.isInteger(parsed.chapter) &&
      Number.isInteger(parsed.verse)
    ) {
      return {
        bookId: parsed.bookId!,
        chapter: parsed.chapter!,
        verse: parsed.verse!,
      };
    }
  } catch {
    localStorage.removeItem(getLastLocationKey(userId));
  }
  return null;
}

function findNextBook(books: BibleBook[], currentBookId: number, direction: -1 | 1) {
  const index = books.findIndex(book => book.id === currentBookId);
  if (index < 0) return null;
  return books[index + direction] ?? null;
}

function formatPlanItems(items: BibleReadingPlanItem[]) {
  if (items.length === 0) return '';
  const groups: { bookName: string; chapters: number[] }[] = [];

  items.forEach(item => {
    const last = groups[groups.length - 1];
    if (last?.bookName === item.bookName) {
      last.chapters.push(item.chapter);
      return;
    }
    groups.push({ bookName: item.bookName, chapters: [item.chapter] });
  });

  return groups.map(group => {
    const first = group.chapters[0];
    const last = group.chapters[group.chapters.length - 1];
    return `${group.bookName} ${first === last ? first : `${first}-${last}`}장`;
  }).join(', ');
}

function getPlanStats(plan: BibleReadingPlan | null | undefined) {
  const items = plan?.days.flatMap(day => day.items) ?? [];
  const completed = items.filter(item => item.completedAt).length;
  const total = plan?.totalChapters ?? 0;
  return {
    completed,
    total,
    percent: total > 0 ? Math.min((completed / total) * 100, 100) : 0,
  };
}

function getActivePlanDay(plan: BibleReadingPlan | null | undefined, today: string) {
  if (!plan) return null;
  return (
    plan.days.find(day => day.scheduledDate === today) ??
    plan.days.find(day => day.items.some(item => !item.completedAt)) ??
    plan.days[0] ??
    null
  );
}

export default function BibleReading() {
  const { user } = useAuth();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();
  const readerRef = useRef<HTMLDivElement | null>(null);
  const verseRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [activeTab, setActiveTab] = useState('reader');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVerse, setSelectedVerse] = useState(1);
  const [pendingJumpVerse, setPendingJumpVerse] = useState<number | null>(null);
  const [restoredLocationKey, setRestoredLocationKey] = useState<string | null>(null);
  const [fontSizeLevel, setFontSizeLevel] = useState(() => {
    const saved = Number(localStorage.getItem('bethel_bible_font_level'));
    return Number.isInteger(saved) && saved >= 0 && saved <= 4 ? saved : 1;
  });

  const [chapters, setChapters] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editChapters, setEditChapters] = useState('');
  const [planTitle, setPlanTitle] = useState('말씀을 읽는 기쁨');
  const [planScope, setPlanScope] = useState<BibleReadingPlanScope>('all');
  const [planDailyChapters, setPlanDailyChapters] = useState('3');
  const [editingPlan, setEditingPlan] = useState(false);
  const target = 1189;
  const today = getKSTDateString();

  const [pickerOpen, setPickerOpen] = useState(false);

  // 성경 권/본문은 불변 데이터 → 무기한 캐시 (세션 내 재조회 없음)
  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ['bible_books'],
    queryFn: getBibleBooks,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const selectedBook = books.find(book => book.id === selectedBookId) ?? books[0];
  const currentBookId = selectedBook?.id ?? 1;
  const lastLocationKey = getLastLocationKey(user?.id);

  useEffect(() => {
    if (books.length === 0 || restoredLocationKey === lastLocationKey) return;

    const savedLocation = readLastLocation(user?.id);
    const savedBook = savedLocation ? books.find(book => book.id === savedLocation.bookId) : null;

    if (savedLocation && savedBook) {
      setSelectedBookId(savedBook.id);
      setSelectedChapter(Math.min(Math.max(savedLocation.chapter, 1), savedBook.chapterCount));
      setSelectedVerse(Math.max(savedLocation.verse, 1));
    } else {
      setSelectedBookId(books[0].id);
      setSelectedChapter(1);
      setSelectedVerse(1);
    }

    setRestoredLocationKey(lastLocationKey);
  }, [books, lastLocationKey, restoredLocationKey, user?.id]);

  useEffect(() => {
    localStorage.setItem('bethel_bible_font_level', String(fontSizeLevel));
  }, [fontSizeLevel]);

  useEffect(() => {
    if (!selectedBook || restoredLocationKey !== lastLocationKey) return;

    localStorage.setItem(
      lastLocationKey,
      JSON.stringify({
        bookId: selectedBook.id,
        chapter: selectedChapter,
        verse: selectedVerse,
      })
    );
  }, [lastLocationKey, restoredLocationKey, selectedBook, selectedChapter, selectedVerse]);

  const { data: verses = [], isLoading: chapterLoading, isPlaceholderData: chapterStale } = useQuery({
    queryKey: ['bible_chapter', currentBookId, selectedChapter],
    queryFn: () => getBibleChapter(currentBookId, selectedChapter),
    enabled: !!selectedBook,
    staleTime: Infinity,
    gcTime: Infinity,
    placeholderData: (prev) => prev, // 장 전환 시 스피너 대신 이전 본문 유지 → 즉시 느낌
  });

  // 인접 장 미리 가져오기 → 이전/다음 이동 시 즉시 표시
  useEffect(() => {
    if (!selectedBook) return;
    const prefetch = (ch: number) => {
      queryClient.prefetchQuery({
        queryKey: ['bible_chapter', currentBookId, ch],
        queryFn: () => getBibleChapter(currentBookId, ch),
        staleTime: Infinity,
      });
    };
    if (selectedChapter < selectedBook.chapterCount) prefetch(selectedChapter + 1);
    if (selectedChapter > 1) prefetch(selectedChapter - 1);
  }, [currentBookId, selectedChapter, selectedBook, queryClient]);

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bible_bookmarks', user?.id],
    queryFn: () => getBibleBookmarks(user!.id),
    enabled: !!user,
  });

  const { data: readings = [], isLoading: readingsLoading } = useQuery({
    queryKey: ['bible_reading_logs', user?.id],
    queryFn: () => getBibleReadingLogs(user!.id),
    enabled: !!user,
  });

  const { data: readingPlan = null, isLoading: planLoading } = useQuery({
    queryKey: ['bible_reading_plan_primary', user?.id],
    queryFn: () => getPrimaryBibleReadingPlan(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!readingPlan || editingPlan) return;
    setPlanTitle(readingPlan.title);
    setPlanScope((readingPlan.scope === 'custom' ? 'all' : readingPlan.scope) as BibleReadingPlanScope);
    setPlanDailyChapters(String(readingPlan.dailyChapterTarget ?? 3));
  }, [editingPlan, readingPlan]);

  const { data: isLocked = false } = useQuery({
    queryKey: ['lock_status', currentDistrictId],
    queryFn: () => getCurrentLockStatus(currentDistrictId),
    enabled: !!currentDistrictId,
  });

  const { hasModule, isLoading: churchLoading } = useChurch();
  const hasBibleText = hasModule('bible_text');

  const bookmarkMap = useMemo(() => {
    return new Map(bookmarks.map(bookmark => [
      buildVerseKey(bookmark.bookId, bookmark.chapter, bookmark.verse),
      bookmark,
    ]));
  }, [bookmarks]);

  useEffect(() => {
    // 현재 선택 장의 본문이 실제로 준비됐을 때만 스크롤 (placeholder 단계 제외)
    if (!pendingJumpVerse || chapterStale || verses.length === 0) return;
    requestAnimationFrame(() => {
      verseRefs.current[pendingJumpVerse]?.scrollIntoView({
        behavior: 'smooth',
        block: pendingJumpVerse === 1 ? 'start' : 'center',
      });
      setPendingJumpVerse(null);
    });
  }, [chapterStale, pendingJumpVerse, verses]);

  useEffect(() => {
    if (chapterStale || verses.length === 0) return;
    const maxVerse = verses[verses.length - 1]?.verse ?? 1;
    if (selectedVerse > maxVerse) {
      setSelectedVerse(maxVerse);
    }
  }, [chapterStale, selectedVerse, verses]);

  const totalChapters = readings.reduce((sum, r) => sum + r.chapters, 0);
  const progress = Math.min((totalChapters / target) * 100, 100);

  const invalidateReadingQueries = () => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bible_reading_logs', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['total_chapters', user?.id] }),
    ]);
  };

  const invalidateBookmarkQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['bible_bookmarks', user?.id] });
  };

  const bookmarkMutation = useMutation({
    mutationFn: (params: { bookId: number; chapter: number; verse: number }) => addBibleBookmark({
      userId: user!.id,
      ...params,
    }),
    onSuccess: () => {
      invalidateBookmarkQueries();
      toast.success('북마크에 저장되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '북마크 저장에 실패했습니다.');
    },
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: deleteBibleBookmark,
    onSuccess: () => {
      invalidateBookmarkQueries();
      toast.success('북마크를 해제했습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '북마크 해제에 실패했습니다.');
    },
  });

  const addReadingMutation = useMutation({
    mutationFn: (num: number) => addBibleReadingLog({
      userId: user!.id,
      date: getKSTDateString(),
      chapters: num,
    }),
    onSuccess: (_, num) => {
      invalidateReadingQueries();
      setChapters('');
      toast.success(`${num}장이 기록되었습니다.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '기록에 실패했습니다.');
    },
  });

  const updateReadingMutation = useMutation({
    mutationFn: (params: { id: string; chapters: number }) => updateBibleReadingLog(params),
    onSuccess: () => {
      invalidateReadingQueries();
      setEditingId(null);
      toast.success('수정되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '수정에 실패했습니다.');
    },
  });

  const deleteReadingMutation = useMutation({
    mutationFn: deleteBibleReadingLog,
    onSuccess: () => {
      invalidateReadingQueries();
      toast.success('삭제되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    },
  });

  const invalidatePlanQueries = () => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bible_reading_plan_primary', user?.id] }),
      invalidateReadingQueries(),
    ]);
  };

  const createPlanMutation = useMutation({
    mutationFn: () => {
      const dailyChapters = parseInt(planDailyChapters, 10);
      if (!dailyChapters || dailyChapters <= 0) {
        throw new Error('하루에 읽을 장수를 입력해주세요.');
      }
      return createBibleReadingPlan({
        userId: user!.id,
        title: planTitle,
        scope: planScope,
        startDate: today,
        dailyChapterTarget: dailyChapters,
      });
    },
    onSuccess: (plan) => {
      queryClient.setQueryData(['bible_reading_plan_primary', user?.id], plan);
      toast.success('읽기표가 만들어졌습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '읽기표 생성에 실패했습니다.');
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: () => {
      if (!readingPlan) throw new Error('수정할 읽기표가 없습니다.');
      const dailyChapters = parseInt(planDailyChapters, 10);
      if (!dailyChapters || dailyChapters <= 0) {
        throw new Error('하루에 읽을 장수를 입력해주세요.');
      }
      return updateBibleReadingPlan({
        planId: readingPlan.id,
        userId: user!.id,
        title: planTitle,
        scope: planScope,
        startDate: today,
        dailyChapterTarget: dailyChapters,
      });
    },
    onSuccess: (plan) => {
      queryClient.setQueryData(['bible_reading_plan_primary', user?.id], plan);
      invalidateReadingQueries();
      setEditingPlan(false);
      toast.success('읽기표가 수정되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '읽기표 수정에 실패했습니다.');
    },
  });

  const completePlanDayMutation = useMutation({
    mutationFn: (day: BibleReadingPlanDay) => completeBiblePlanDay({
      planId: day.planId,
      planDayId: day.id,
    }),
    onSuccess: async () => {
      await invalidatePlanQueries();
      toast.success('오늘 분량을 기록했습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '읽기표 기록에 실패했습니다.');
    },
  });

  const togglePlanItemMutation = useMutation({
    mutationFn: (params: { item: BibleReadingPlanItem; completed: boolean }) => setBiblePlanItemCompleted({
      planId: params.item.planId,
      planDayId: params.item.planDayId,
      itemId: params.item.id,
      completed: params.completed,
    }),
    onSuccess: async () => {
      await invalidatePlanQueries();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '장 체크 변경에 실패했습니다.');
    },
  });

  const completeCurrentChapterMutation = useMutation({
    mutationFn: () => completeCurrentBiblePlanChapter({
      userId: user!.id,
      bookId: currentBookId,
      chapter: selectedChapter,
    }),
    onSuccess: async (result) => {
      await invalidatePlanQueries();
      const message = result.alreadyCompleted
        ? '이미 기록된 장입니다. 다음 장으로 이동합니다.'
        : '성경읽기 완료를 기록했습니다. 다음 장으로 이동합니다.';
      toast.success(message);
      moveChapter(1);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '성경읽기 완료 처리에 실패했습니다.');
    },
  });

  // 권/장/절 피커에서 선택 → 해당 위치로 이동 + 스크롤
  const applyReference = (bookId: number, chapter: number, verse: number) => {
    setSelectedBookId(bookId);
    setSelectedChapter(chapter);
    setSelectedVerse(verse);
    setActiveTab('reader');
    setPendingJumpVerse(verse);
    readerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const moveChapter = (direction: -1 | 1) => {
    if (!selectedBook) return;
    if (direction === -1 && selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1);
      setSelectedVerse(1);
      setPendingJumpVerse(1);
      return;
    }
    if (direction === 1 && selectedChapter < selectedBook.chapterCount) {
      setSelectedChapter(selectedChapter + 1);
      setSelectedVerse(1);
      setPendingJumpVerse(1);
      return;
    }

    const nextBook = findNextBook(books, selectedBook.id, direction);
    if (!nextBook) return;
    setSelectedBookId(nextBook.id);
    setSelectedChapter(direction === -1 ? nextBook.chapterCount : 1);
    setSelectedVerse(1);
    setPendingJumpVerse(1);
  };

  const toggleBookmark = (verse: number) => {
    const bookmark = bookmarkMap.get(buildVerseKey(currentBookId, selectedChapter, verse));
    if (bookmark) {
      removeBookmarkMutation.mutate(bookmark.id);
      return;
    }
    bookmarkMutation.mutate({ bookId: currentBookId, chapter: selectedChapter, verse });
  };

  const goToBookmark = (bookmark: BibleBookmark) => {
    setSelectedBookId(bookmark.bookId);
    setSelectedChapter(bookmark.chapter);
    setSelectedVerse(bookmark.verse);
    setActiveTab('reader');
    setPendingJumpVerse(bookmark.verse);
  };

  const goToPlanItem = (item: BibleReadingPlanItem) => {
    setSelectedBookId(item.bookId);
    setSelectedChapter(item.chapter);
    setSelectedVerse(1);
    setActiveTab('reader');
    setPendingJumpVerse(1);
  };

  const goToPlanDay = (day: BibleReadingPlanDay | null) => {
    const firstOpenItem = day?.items.find(item => !item.completedAt) ?? day?.items[0];
    if (firstOpenItem) goToPlanItem(firstOpenItem);
  };

  const handleAddReading = () => {
    const num = parseInt(chapters, 10);
    if (!num || num <= 0) {
      toast.error('읽은 장수를 입력해주세요.');
      return;
    }
    addReadingMutation.mutate(num);
  };

  const handleEditStart = (id: string, currentChapters: number) => {
    setEditingId(id);
    setEditChapters(String(currentChapters));
  };

  const handleEditSave = () => {
    if (!editingId) return;
    const num = parseInt(editChapters, 10);
    if (!num || num <= 0) {
      toast.error('1장 이상 입력해주세요.');
      return;
    }
    updateReadingMutation.mutate({ id: editingId, chapters: num });
  };

  const handleDeleteReading = (id: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    deleteReadingMutation.mutate(id);
  };

  const planStats = getPlanStats(readingPlan);
  const activePlanDay = getActivePlanDay(readingPlan, today);
  const activePlanItemsLabel = activePlanDay ? formatPlanItems(activePlanDay.items) : '';
  const planDayCompleted = activePlanDay?.items.every(item => item.completedAt) ?? false;

  // 읽기 현황: 연간 계획(약 400일)을 한 번에 펼치지 않고 월별로 접어서 표시
  const [openPlanMonth, setOpenPlanMonth] = useState<string | null>(null);
  const planMonthGroups = useMemo(() => {
    if (!readingPlan) return [];
    const groups = new Map<string, typeof readingPlan.days>();
    readingPlan.days.forEach(day => {
      const month = day.scheduledDate.slice(0, 7);
      const list = groups.get(month) ?? [];
      list.push(day);
      groups.set(month, list);
    });
    return Array.from(groups.entries());
  }, [readingPlan]);
  // 기본 펼침: 진행 중인 날이 속한 달
  const currentPlanMonth =
    openPlanMonth
    ?? activePlanDay?.scheduledDate.slice(0, 7)
    ?? planMonthGroups[0]?.[0]
    ?? null;
  const currentPlanItem = readingPlan?.days
    .flatMap(day => day.items)
    .find(item => item.bookId === currentBookId && item.chapter === selectedChapter);
  const currentChapterCompleted = !!currentPlanItem?.completedAt;

  return (
    <AppLayout>
      <div className="space-y-5">
        <CommunitySubNav />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">성경</h1>
            <p className="text-sm text-muted-foreground mt-1">성경 본문과 개인 북마크</p>
          </div>
          {activeTab === 'reader' && (
            <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
              <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">글자</span>
              <Slider
                min={0}
                max={4}
                step={1}
                value={[fontSizeLevel]}
                onValueChange={([value]) => setFontSizeLevel(value)}
                className="w-32"
              />
              <span className="w-16 text-right text-xs font-medium">{FONT_SIZE_LABELS[fontSizeLevel]}</span>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="reader" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              본문 읽기
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-1.5">
              <Bookmark className="h-4 w-4" />
              북마크
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-1.5">
              <ClipboardList className="h-4 w-4" />
              읽기표
            </TabsTrigger>
            <TabsTrigger value="log" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              읽기 기록
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reader" className="mt-0 space-y-5">
            {!hasBibleText && !churchLoading && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-5 text-center space-y-2">
                <p className="font-semibold text-amber-800 dark:text-amber-300">성경 본문은 제공되지 않습니다</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  라이센스 제한으로 이 교회에는 성경 본문 서비스가 제공되지 않습니다.
                </p>
                <a
                  href="https://www.bskorea.or.kr/bible/korbibReadpage.php"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-sm font-medium text-primary underline underline-offset-2"
                >
                  대한성서공회 온라인 성경 바로가기
                </a>
              </div>
            )}
            {hasBibleText && <>
            <BibleReferencePicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              books={books}
              currentBookId={currentBookId}
              currentChapter={selectedChapter}
              onSelect={applyReference}
            />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <section ref={readerRef} className="min-w-0 rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-2 py-2">
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => moveChapter(-1)} aria-label="이전 장">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    disabled={booksLoading}
                    className="flex flex-col items-center rounded-md px-3 py-1 transition-colors hover:bg-muted"
                  >
                    <span className="flex items-center gap-1 font-display text-lg font-semibold">
                      {selectedBook?.koreanName ?? '성경'} {selectedChapter}장
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <span className="text-xs text-muted-foreground">{verses.length}절 · 눌러서 이동</span>
                  </button>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => moveChapter(1)} aria-label="다음 장">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="divide-y">
                  {chapterLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : verses.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                      본문 데이터가 없습니다. `scripts/import_bible_kr.mjs`로 성경 데이터를 먼저 넣어주세요.
                    </p>
                  ) : (
                    verses.map(item => {
                      const key = buildVerseKey(item.bookId, item.chapter, item.verse);
                      const bookmarked = bookmarkMap.has(key);
                      const active = selectedVerse === item.verse;
                      const verseStateClass = bookmarked
                        ? active
                          ? 'bg-amber-100/80 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/20 dark:ring-amber-400/40'
                          : 'bg-amber-50/80 ring-1 ring-inset ring-amber-200/70 dark:bg-amber-500/10 dark:ring-amber-400/25'
                        : active
                          ? 'bg-primary/10'
                          : 'bg-card';

                      return (
                        <div
                          key={key}
                          ref={node => {
                            verseRefs.current[item.verse] = node;
                          }}
                          className={`flex scroll-mt-20 items-start gap-1.5 px-4 py-2 transition-colors ${verseStateClass}`}
                        >
                          <button
                            type="button"
                            className="mt-1 min-w-[1.5em] shrink-0 text-right text-xs font-semibold leading-none text-primary/50 tabular-nums hover:text-primary"
                            onClick={() => setSelectedVerse(item.verse)}
                          >
                            {item.verse}
                          </button>
                          <p className={`min-w-0 flex-1 leading-relaxed ${FONT_SIZE_CLASSES[fontSizeLevel]}`}>
                            <button
                              type="button"
                              className={`float-right ml-1.5 p-0.5 ${bookmarked ? 'text-primary' : 'text-muted-foreground/30'} hover:text-primary disabled:opacity-50`}
                              onClick={() => toggleBookmark(item.verse)}
                              disabled={bookmarkMutation.isPending || removeBookmarkMutation.isPending}
                              aria-label={bookmarked ? '북마크 해제' : '북마크 추가'}
                            >
                              {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                            </button>
                            {item.text}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {!chapterLoading && verses.length > 0 && (
                  <div className="space-y-3 border-t px-4 py-4">
                    {readingPlan && (
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">
                              {selectedBook?.koreanName ?? '성경'} {selectedChapter}장
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {currentPlanItem
                                ? currentChapterCompleted
                                  ? '이 장은 읽기표와 읽기 기록에 반영되어 있습니다.'
                                  : `${readingPlan.title} 읽기표에 체크하고 오늘 기록에 누적합니다.`
                                : '현재 장은 대표 읽기표에 포함되어 있지 않습니다.'}
                            </p>
                          </div>
                          <Button
                            type="button"
                            className="gap-1.5"
                            onClick={() => completeCurrentChapterMutation.mutate()}
                            disabled={!user || !currentPlanItem || completeCurrentChapterMutation.isPending}
                          >
                            {currentChapterCompleted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            {completeCurrentChapterMutation.isPending
                              ? '기록 중...'
                              : currentChapterCompleted
                                ? '기록됨'
                                : '성경읽기 완료'}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => moveChapter(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                        이전
                      </Button>
                      <div className="text-center text-xs font-medium text-muted-foreground">
                        {selectedBook?.koreanName ?? '성경'} {selectedChapter}장 끝
                      </div>
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => moveChapter(1)}>
                        다음
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <aside className="rounded-lg border bg-card p-4 lg:sticky lg:top-24 lg:self-start">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold">최근 북마크</h2>
                  <span className="text-xs text-muted-foreground">{bookmarks.length}개</span>
                </div>
                {bookmarks.length === 0 ? (
                  <p className="rounded-md bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
                    마음에 남는 절의 북마크 아이콘을 눌러 저장하세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bookmarks.slice(0, 5).map(bookmark => (
                      <div key={bookmark.id} className="rounded-md border p-3">
                        <button
                          type="button"
                          className="block w-full text-left text-sm font-semibold hover:text-primary"
                          onClick={() => goToBookmark(bookmark)}
                        >
                          {bookmark.bookName} {bookmark.chapter}:{bookmark.verse}
                        </button>
                        {bookmark.text && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {bookmark.text}
                          </p>
                        )}
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => removeBookmarkMutation.mutate(bookmark.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            삭제
                          </Button>
                        </div>
                      </div>
                    ))}
                    {bookmarks.length > 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setActiveTab('bookmarks')}
                      >
                        전체 북마크 보기
                      </Button>
                    )}
                  </div>
                )}
              </aside>
            </div>
            </>}
          </TabsContent>

          <TabsContent value="bookmarks" className="mt-0">
            <section className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">내 북마크</h2>
                  <p className="text-sm text-muted-foreground">저장한 절을 모아보고 바로 본문으로 이동합니다.</p>
                </div>
                <span className="text-sm font-medium text-muted-foreground">{bookmarks.length}개 저장됨</span>
              </div>

              {bookmarks.length === 0 ? (
                <div className="rounded-lg bg-muted/50 px-4 py-12 text-center">
                  <Bookmark className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">저장된 북마크가 없습니다.</p>
                  <p className="mt-1 text-sm text-muted-foreground">본문 읽기에서 절 옆 북마크 아이콘을 눌러 저장하세요.</p>
                  <Button className="mt-4" onClick={() => setActiveTab('reader')}>
                    본문 읽기로 이동
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {bookmarks.map(bookmark => (
                    <article key={bookmark.id} className="rounded-lg border p-4">
                      <button
                        type="button"
                        className="text-left font-display text-base font-semibold hover:text-primary"
                        onClick={() => goToBookmark(bookmark)}
                      >
                        {bookmark.bookName} {bookmark.chapter}:{bookmark.verse}
                      </button>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {bookmark.text || '본문을 불러오지 못했습니다.'}
                      </p>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => goToBookmark(bookmark)}>
                          보기
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeBookmarkMutation.mutate(bookmark.id)}
                          disabled={removeBookmarkMutation.isPending}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          삭제
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="plan" className="mt-0 space-y-5">
            {planLoading ? (
              <section className="rounded-lg border bg-card py-16">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </section>
            ) : !readingPlan ? (
              <section className="rounded-lg border bg-card p-5">
                <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
                  <div className="text-center lg:text-left">
                    <CalendarDays className="mx-auto mb-3 h-10 w-10 text-primary lg:mx-0" />
                    <h2 className="font-display text-xl font-bold">읽기표 만들기</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      수기 기록은 그대로 두고, 읽기표로 읽은 장수는 자동으로 합산됩니다.
                    </p>
                  </div>

                  <div className="grid gap-4 rounded-lg bg-muted/40 p-4">
                    <label className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">읽기표 이름</span>
                      <Input
                        value={planTitle}
                        onChange={event => setPlanTitle(event.target.value)}
                        maxLength={30}
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">읽을 범위</span>
                        <Select value={planScope} onValueChange={(value) => setPlanScope(value as BibleReadingPlanScope)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">성경 전체</SelectItem>
                            <SelectItem value="old">구약</SelectItem>
                            <SelectItem value="new">신약</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">하루 장수</span>
                        <Select value={planDailyChapters} onValueChange={setPlanDailyChapters}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3장씩</SelectItem>
                            <SelectItem value="5">5장씩</SelectItem>
                            <SelectItem value="7">7장씩</SelectItem>
                            <SelectItem value="10">10장씩</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                    </div>

                    <div className="grid gap-2 rounded-md bg-card p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">번역본</span>
                        <span className="font-medium">개역개정</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">시작일</span>
                        <span className="font-medium">{today}</span>
                      </div>
                    </div>

                    <Button
                      className="h-11"
                      onClick={() => createPlanMutation.mutate()}
                      disabled={createPlanMutation.isPending}
                    >
                      {createPlanMutation.isPending ? '만드는 중...' : '읽기표 시작하기'}
                    </Button>
                  </div>
                </div>
              </section>
            ) : (
              <>
                <section className="rounded-lg border bg-card p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {readingPlan.startDate} ~ {readingPlan.endDate}
                      </p>
                      <h2 className="font-display mt-1 text-xl font-bold">{readingPlan.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {PLAN_SCOPE_LABELS[readingPlan.scope as BibleReadingPlanScope] ?? '성경'} · {readingPlan.translation}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-medium text-primary">진행률 {Math.round(planStats.percent)}%</p>
                      <p className="text-sm text-muted-foreground">{planStats.completed} / {planStats.total}장</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setEditingPlan(value => !value)}
                      >
                        {editingPlan ? '수정 닫기' : '읽기표 수정'}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${planStats.percent}%` }}
                    />
                  </div>
                </section>

                {editingPlan && (
                  <section className="rounded-lg border bg-card p-5">
                    <div className="mb-4">
                      <h3 className="font-display text-lg font-semibold">읽기표 수정</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        이미 완료한 장과 자동 기록은 유지하고, 남은 장만 새 조건으로 다시 배치합니다.
                      </p>
                    </div>

                    <div className="grid gap-4">
                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">읽기표 이름</span>
                        <Input
                          value={planTitle}
                          onChange={event => setPlanTitle(event.target.value)}
                          maxLength={30}
                        />
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5">
                          <span className="text-xs font-medium text-muted-foreground">앞으로 읽을 범위</span>
                          <Select value={planScope} onValueChange={(value) => setPlanScope(value as BibleReadingPlanScope)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">성경 전체</SelectItem>
                              <SelectItem value="old">구약</SelectItem>
                              <SelectItem value="new">신약</SelectItem>
                            </SelectContent>
                          </Select>
                        </label>

                        <label className="space-y-1.5">
                          <span className="text-xs font-medium text-muted-foreground">앞으로 하루 장수</span>
                          <Select value={planDailyChapters} onValueChange={setPlanDailyChapters}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">3장씩</SelectItem>
                              <SelectItem value="5">5장씩</SelectItem>
                              <SelectItem value="7">7장씩</SelectItem>
                              <SelectItem value="10">10장씩</SelectItem>
                            </SelectContent>
                          </Select>
                        </label>
                      </div>

                      <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                        완료한 {planStats.completed}장은 그대로 보존됩니다. 수정 후 남은 분량은 오늘 이후 일정으로 다시 배치됩니다.
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingPlan(false);
                            setPlanTitle(readingPlan.title);
                            setPlanScope((readingPlan.scope === 'custom' ? 'all' : readingPlan.scope) as BibleReadingPlanScope);
                            setPlanDailyChapters(String(readingPlan.dailyChapterTarget ?? 3));
                          }}
                        >
                          취소
                        </Button>
                        <Button
                          type="button"
                          onClick={() => updatePlanMutation.mutate()}
                          disabled={updatePlanMutation.isPending}
                        >
                          {updatePlanMutation.isPending ? '수정 중...' : '수정 저장'}
                        </Button>
                      </div>
                    </div>
                  </section>
                )}

                <section className="rounded-lg border bg-card p-5">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {activePlanDay ? `${activePlanDay.dayNumber}일차` : '오늘 읽기'}
                        {activePlanDay?.scheduledDate === today ? ' TODAY' : ''}
                      </p>
                      <h3 className="font-display mt-1 text-lg font-semibold">
                        {activePlanItemsLabel || '읽을 분량이 없습니다.'}
                      </h3>
                    </div>
                    {planDayCompleted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        완료
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="gap-1.5"
                      onClick={() => goToPlanDay(activePlanDay)}
                      disabled={!activePlanDay}
                    >
                      <BookOpen className="h-4 w-4" />
                      본문에서 읽기
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => activePlanDay && completePlanDayMutation.mutate(activePlanDay)}
                      disabled={!activePlanDay || planDayCompleted || completePlanDayMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                      오늘 분량 완료
                    </Button>
                  </div>
                </section>

                <section className="rounded-lg border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-lg font-semibold">읽기 현황</h3>
                    <span className="text-sm text-muted-foreground">{readingPlan.days.length}일 계획</span>
                  </div>
                  <div className="space-y-2">
                    {planMonthGroups.map(([month, days]) => {
                      const [yyyy, mm] = month.split('-');
                      const monthDone = days.reduce((sum, d) => sum + d.items.filter(i => i.completedAt).length, 0);
                      const monthTotal = days.reduce((sum, d) => sum + d.items.length, 0);
                      const isOpen = month === currentPlanMonth;
                      const isActiveMonth = activePlanDay?.scheduledDate.slice(0, 7) === month;
                      return (
                        <div key={month} className="rounded-lg border">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 p-3 text-left"
                            onClick={() => setOpenPlanMonth(isOpen ? '' : month)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{yyyy}년 {Number(mm)}월</span>
                              {isActiveMonth && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">진행 중</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {days.length}일 · {monthDone}/{monthTotal}장
                              </span>
                              <ChevronDown
                                className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </div>
                          </button>
                          {isOpen && (
                            <div className="space-y-3 border-t p-3">
                    {days.map(day => {
                      const doneCount = day.items.filter(item => item.completedAt).length;
                      return (
                        <div key={day.id} className="rounded-lg border p-3">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <button
                              type="button"
                              className="text-left"
                              onClick={() => goToPlanDay(day)}
                            >
                              <span className="text-sm font-semibold">{day.dayNumber}일차</span>
                              <span className="ml-2 text-xs text-muted-foreground">{day.scheduledDate}</span>
                              <p className="mt-1 text-sm text-muted-foreground">{formatPlanItems(day.items)}</p>
                            </button>
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">
                              {doneCount}/{day.items.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {day.items.map(item => {
                              const done = !!item.completedAt;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`h-9 min-w-9 rounded-full border px-2 text-xs font-semibold transition-colors ${
                                    done
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-border bg-muted/40 text-foreground hover:border-primary'
                                  }`}
                                  onClick={() => togglePlanItemMutation.mutate({ item, completed: !done })}
                                  disabled={togglePlanItemMutation.isPending}
                                  title={`${item.bookName} ${item.chapter}장`}
                                >
                                  {done ? <Check className="mx-auto h-4 w-4" /> : item.chapter}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </TabsContent>

          <TabsContent value="log" className="mt-0">
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
              <div className="space-y-5">
              <div className="card-elevated p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">2026년 누적</p>
                    <p className="text-3xl font-bold">
                      {totalChapters}
                      <span className="ml-1 text-base font-normal text-muted-foreground">/ {target}장</span>
                    </p>
                  </div>
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-muted">
                    <svg className="absolute inset-0 h-16 w-16 -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="hsl(var(--gold))"
                        strokeWidth="4"
                        strokeDasharray={`${progress * 1.76} 176`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-xs font-bold">{Math.round(progress)}%</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: 'hsl(var(--gold))' }}
                  />
                </div>
              </div>

              <div className="card-elevated p-4">
                <h2 className="font-display mb-3 text-sm font-semibold">이번 주 읽은 장수 입력</h2>
                {isLocked ? (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                    <Lock className="h-4 w-4 shrink-0" />
                    이번 주 마감이 완료되어 기록을 추가할 수 없습니다.
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={chapters}
                      onChange={e => setChapters(e.target.value)}
                      placeholder="장수 입력"
                      min="1"
                      className="flex-1"
                      onKeyDown={e => e.key === 'Enter' && handleAddReading()}
                    />
                    <Button onClick={handleAddReading} className="gap-1" disabled={addReadingMutation.isPending}>
                      <Plus className="h-4 w-4" />
                      {addReadingMutation.isPending ? '기록 중...' : '기록'}
                    </Button>
                  </div>
                )}
              </div>
              </div>

              <div className="card-elevated p-4">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gold" />
                  <h2 className="font-display text-sm font-semibold">읽기 기록</h2>
                </div>
                {readingsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : readings.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">아직 기록이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {readings.map(reading => (
                      <div key={reading.id} className="flex items-center justify-between border-b py-2 last:border-0">
                        <div className="min-w-0">
                          <span className="text-sm text-muted-foreground">{reading.date}</span>
                          {reading.sourceType === 'plan' && reading.sourceLabel && (
                            <p className="truncate text-xs text-muted-foreground">{reading.sourceLabel}</p>
                          )}
                        </div>
                        {editingId === reading.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={editChapters}
                              onChange={e => setEditChapters(e.target.value)}
                              min="1"
                              className="h-8 w-20 text-sm"
                              onKeyDown={e => e.key === 'Enter' && handleEditSave()}
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleEditSave} disabled={updateReadingMutation.isPending}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{reading.chapters}장</span>
                            {reading.sourceType === 'plan' ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" aria-label="읽기표 자동 기록" />
                            ) : !isLocked && (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditStart(reading.id, reading.chapters)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeleteReading(reading.id)}
                                  disabled={deleteReadingMutation.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
