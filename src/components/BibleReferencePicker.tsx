import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { getBibleChapter, type BibleBook } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: BibleBook[];
  currentBookId: number;
  currentChapter: number;
  onSelect: (bookId: number, chapter: number, verse: number) => void;
}

type Step = 'book' | 'chapter' | 'verse';

const gridBtn =
  'flex h-10 items-center justify-center rounded-md border text-sm font-medium transition-colors hover:bg-muted active:scale-95';

// 표준 한글 성경 약어 (풀네임 기준 매핑 → 권 그리드를 짧게 표시)
const BOOK_ABBR: Record<string, string> = {
  창세기: '창', 출애굽기: '출', 레위기: '레', 민수기: '민', 신명기: '신',
  여호수아: '수', 사사기: '삿', 룻기: '룻', 사무엘상: '삼상', 사무엘하: '삼하',
  열왕기상: '왕상', 열왕기하: '왕하', 역대상: '대상', 역대하: '대하', 에스라: '스',
  느헤미야: '느', 에스더: '에', 욥기: '욥', 시편: '시', 잠언: '잠',
  전도서: '전', 아가: '아', 이사야: '사', 예레미야: '렘', 예레미야애가: '애',
  에스겔: '겔', 다니엘: '단', 호세아: '호', 요엘: '욜', 아모스: '암',
  오바댜: '옵', 요나: '욘', 미가: '미', 나훔: '나', 하박국: '합',
  스바냐: '습', 학개: '학', 스가랴: '슥', 말라기: '말',
  마태복음: '마', 마가복음: '막', 누가복음: '눅', 요한복음: '요', 사도행전: '행',
  로마서: '롬', 고린도전서: '고전', 고린도후서: '고후', 갈라디아서: '갈', 에베소서: '엡',
  빌립보서: '빌', 골로새서: '골', 데살로니가전서: '살전', 데살로니가후서: '살후',
  디모데전서: '딤전', 디모데후서: '딤후', 디도서: '딛', 빌레몬서: '몬', 히브리서: '히',
  야고보서: '약', 베드로전서: '벧전', 베드로후서: '벧후', 요한일서: '요일', 요한이서: '요이',
  요한삼서: '요삼', 유다서: '유', 요한계시록: '계',
};

function abbr(book: BibleBook) {
  return BOOK_ABBR[book.koreanName] ?? book.abbreviation ?? book.koreanName;
}

export default function BibleReferencePicker({
  open,
  onOpenChange,
  books,
  currentBookId,
  currentChapter,
  onSelect,
}: Props) {
  const [step, setStep] = useState<Step>('book');
  const [draftBookId, setDraftBookId] = useState(currentBookId);
  const [draftChapter, setDraftChapter] = useState(currentChapter);

  // 열릴 때마다 현재 위치로 초기화하고 권 선택부터 시작
  useEffect(() => {
    if (open) {
      setDraftBookId(currentBookId);
      setDraftChapter(currentChapter);
      setStep('book');
    }
  }, [open, currentBookId, currentChapter]);

  const draftBook = books.find(b => b.id === draftBookId);
  const oldBooks = books.filter(b => b.testament === 'old');
  const newBooks = books.filter(b => b.testament === 'new');
  const chapterNums = Array.from({ length: draftBook?.chapterCount ?? 1 }, (_, i) => i + 1);

  // 절 단계에서만 해당 장을 불러온다 (리더와 동일 캐시키 → 선택 시 본문 즉시 표시)
  const { data: verses = [], isLoading: versesLoading } = useQuery({
    queryKey: ['bible_chapter', draftBookId, draftChapter],
    queryFn: () => getBibleChapter(draftBookId, draftChapter),
    enabled: open && step === 'verse',
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const pickBook = (id: number) => { setDraftBookId(id); setStep('chapter'); };
  const pickChapter = (ch: number) => { setDraftChapter(ch); setStep('verse'); };
  const pickVerse = (v: number) => { onSelect(draftBookId, draftChapter, v); onOpenChange(false); };

  const goBack = () => setStep(step === 'verse' ? 'chapter' : 'book');

  const title =
    step === 'book'
      ? '성경 권 선택'
      : step === 'chapter'
        ? `${draftBook?.koreanName ?? ''} · 장 선택`
        : `${draftBook?.koreanName ?? ''} ${draftChapter}장 · 절 선택`;

  const renderBookGroup = (label: string, list: BibleBook[]) => (
    <div>
      <p className="mb-1.5 px-0.5 text-xs font-bold tracking-widest text-muted-foreground">{label}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {list.map(b => (
          <button
            key={b.id}
            type="button"
            onClick={() => pickBook(b.id)}
            className={`${gridBtn} ${b.id === currentBookId ? 'border-primary bg-primary/10 text-primary' : ''}`}
          >
            {abbr(b)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="flex-row items-center gap-2 space-y-0 border-b px-3 py-3">
          {step !== 'book' && (
            <button
              type="button"
              onClick={goBack}
              className="rounded-md p-1 hover:bg-muted"
              aria-label="뒤로"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          {step === 'book' && (
            <div className="space-y-4 p-4">
              {renderBookGroup('구약', oldBooks)}
              {renderBookGroup('신약', newBooks)}
            </div>
          )}

          {step === 'chapter' && (
            <div className="grid grid-cols-6 gap-1.5 p-4">
              {chapterNums.map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => pickChapter(ch)}
                  className={`${gridBtn} ${ch === currentChapter && draftBookId === currentBookId ? 'border-primary bg-primary/10 text-primary' : ''}`}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}

          {step === 'verse' && (
            versesLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-3 p-4">
                <button
                  type="button"
                  onClick={() => pickVerse(1)}
                  className="w-full rounded-md border border-primary/40 bg-primary/5 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  1절부터 보기
                </button>
                <div className="grid grid-cols-6 gap-1.5">
                  {verses.map(v => (
                    <button
                      key={v.verse}
                      type="button"
                      onClick={() => pickVerse(v.verse)}
                      className={gridBtn}
                    >
                      {v.verse}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
