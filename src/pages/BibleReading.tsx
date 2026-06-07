import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import {
  addBibleBookmark,
  addBibleReadingLog,
  deleteBibleBookmark,
  deleteBibleReadingLog,
  getBibleBookmarks,
  getBibleBooks,
  getBibleChapter,
  getBibleReadingLogs,
  getCurrentLockStatus,
  getKSTDateString,
  updateBibleReadingLog,
  type BibleBookmark,
  type BibleBook,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/components/AppLayout';
import { toast } from 'sonner';

const FONT_SIZE_CLASSES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
const FONT_SIZE_LABELS = ['작게', '기본', '크게', '더 크게', '아주 크게'];

function buildVerseKey(bookId: number, chapter: number, verse: number) {
  return `${bookId}:${chapter}:${verse}`;
}

function findNextBook(books: BibleBook[], currentBookId: number, direction: -1 | 1) {
  const index = books.findIndex(book => book.id === currentBookId);
  if (index < 0) return null;
  return books[index + direction] ?? null;
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
  const [fontSizeLevel, setFontSizeLevel] = useState(() => {
    const saved = Number(localStorage.getItem('bethel_bible_font_level'));
    return Number.isInteger(saved) && saved >= 0 && saved <= 4 ? saved : 1;
  });

  const [chapters, setChapters] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editChapters, setEditChapters] = useState('');
  const target = 1189;

  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ['bible_books'],
    queryFn: getBibleBooks,
  });

  const selectedBook = books.find(book => book.id === selectedBookId) ?? books[0];
  const currentBookId = selectedBook?.id ?? 1;

  useEffect(() => {
    if (!selectedBookId && books.length > 0) {
      setSelectedBookId(books[0].id);
    }
  }, [books, selectedBookId]);

  useEffect(() => {
    localStorage.setItem('bethel_bible_font_level', String(fontSizeLevel));
  }, [fontSizeLevel]);

  const { data: verses = [], isLoading: chapterLoading } = useQuery({
    queryKey: ['bible_chapter', currentBookId, selectedChapter],
    queryFn: () => getBibleChapter(currentBookId, selectedChapter),
    enabled: !!selectedBook,
  });

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

  const { data: isLocked = false } = useQuery({
    queryKey: ['lock_status', currentDistrictId],
    queryFn: () => getCurrentLockStatus(currentDistrictId),
    enabled: !!currentDistrictId,
  });

  const bookmarkMap = useMemo(() => {
    return new Map(bookmarks.map(bookmark => [
      buildVerseKey(bookmark.bookId, bookmark.chapter, bookmark.verse),
      bookmark,
    ]));
  }, [bookmarks]);

  useEffect(() => {
    if (!pendingJumpVerse || chapterLoading || verses.length === 0) return;
    requestAnimationFrame(() => {
      verseRefs.current[pendingJumpVerse]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingJumpVerse(null);
    });
  }, [chapterLoading, pendingJumpVerse, verses]);

  const totalChapters = readings.reduce((sum, r) => sum + r.chapters, 0);
  const progress = Math.min((totalChapters / target) * 100, 100);

  const invalidateReadingQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['bible_reading_logs', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['total_chapters', user?.id] });
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

  const handleBookChange = (value: string) => {
    const book = books.find(item => item.id === Number(value));
    if (!book) return;
    setSelectedBookId(book.id);
    setSelectedChapter(1);
    setSelectedVerse(1);
  };

  const handleChapterChange = (value: string) => {
    setSelectedChapter(Number(value));
    setSelectedVerse(1);
  };

  const jumpToVerse = (verse: number) => {
    setSelectedVerse(verse);
    setActiveTab('reader');
    requestAnimationFrame(() => {
      verseRefs.current[verse]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleQuickOpen = () => {
    readerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    jumpToVerse(selectedVerse);
  };

  const moveChapter = (direction: -1 | 1) => {
    if (!selectedBook) return;
    if (direction === -1 && selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1);
      setSelectedVerse(1);
      return;
    }
    if (direction === 1 && selectedChapter < selectedBook.chapterCount) {
      setSelectedChapter(selectedChapter + 1);
      setSelectedVerse(1);
      return;
    }

    const nextBook = findNextBook(books, selectedBook.id, direction);
    if (!nextBook) return;
    setSelectedBookId(nextBook.id);
    setSelectedChapter(direction === -1 ? nextBook.chapterCount : 1);
    setSelectedVerse(1);
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

  const chapterOptions = Array.from({ length: selectedBook?.chapterCount ?? 1 }, (_, index) => index + 1);
  const verseOptions = verses.map(item => item.verse);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">성경 본문과 개인 북마크</p>
            <h1 className="font-display text-2xl font-bold">성경</h1>
          </div>
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
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="grid w-full grid-cols-3 md:w-[480px]">
            <TabsTrigger value="reader" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              본문 읽기
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-1.5">
              <Bookmark className="h-4 w-4" />
              북마크
            </TabsTrigger>
            <TabsTrigger value="log" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              읽기 기록
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reader" className="mt-0 space-y-5">
            <section className="rounded-lg border bg-card p-4">
              <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-end">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">성경 권</span>
                  <Select value={String(currentBookId)} onValueChange={handleBookChange} disabled={booksLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="성경 권 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {books.map(book => (
                        <SelectItem key={book.id} value={String(book.id)}>
                          {book.koreanName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">장</span>
                  <Select value={String(selectedChapter)} onValueChange={handleChapterChange} disabled={!selectedBook}>
                    <SelectTrigger>
                      <SelectValue placeholder="장 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {chapterOptions.map(chapter => (
                        <SelectItem key={chapter} value={String(chapter)}>
                          {chapter}장
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">절</span>
                  <Select value={String(selectedVerse)} onValueChange={(value) => setSelectedVerse(Number(value))} disabled={verseOptions.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder="절 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {verseOptions.map(verse => (
                        <SelectItem key={verse} value={String(verse)}>
                          {verse}절
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <Button onClick={handleQuickOpen} className="h-10 gap-1.5">
                  바로 보기
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <section ref={readerRef} className="min-w-0 rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => moveChapter(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                    이전
                  </Button>
                  <div className="text-center">
                    <h2 className="font-display text-lg font-semibold">
                      {selectedBook?.koreanName ?? '성경'} {selectedChapter}장
                    </h2>
                    <p className="text-xs text-muted-foreground">{verses.length}절</p>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => moveChapter(1)}>
                    다음
                    <ChevronRight className="h-4 w-4" />
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
                      return (
                        <div
                          key={key}
                          ref={node => {
                            verseRefs.current[item.verse] = node;
                          }}
                          className={`grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] gap-2 px-4 py-3 transition-colors ${
                            active ? 'bg-primary/10' : 'bg-card'
                          }`}
                        >
                          <button
                            type="button"
                            className="h-8 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted"
                            onClick={() => setSelectedVerse(item.verse)}
                          >
                            {item.verse}
                          </button>
                          <p className={`${FONT_SIZE_CLASSES[fontSizeLevel]} leading-relaxed`}>
                            {item.text}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={bookmarked ? 'text-primary' : 'text-muted-foreground'}
                            onClick={() => toggleBookmark(item.verse)}
                            disabled={bookmarkMutation.isPending || removeBookmarkMutation.isPending}
                            aria-label={bookmarked ? '북마크 해제' : '북마크 추가'}
                          >
                            {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
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

          <TabsContent value="log" className="mt-0">
            <div className="mx-auto max-w-2xl space-y-5">
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
                        <span className="text-sm text-muted-foreground">{reading.date}</span>
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
                            {!isLocked && (
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
