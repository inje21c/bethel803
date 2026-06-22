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

const bookBtn =
  'flex h-11 items-center justify-center rounded-md border px-1 text-[13px] font-medium leading-tight transition-colors hover:bg-muted active:scale-95';

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
      <div className="grid grid-cols-3 gap-1.5">
        {list.map(b => (
          <button
            key={b.id}
            type="button"
            onClick={() => pickBook(b.id)}
            className={`${bookBtn} ${b.id === currentBookId ? 'border-primary bg-primary/10 text-primary' : ''}`}
          >
            {b.koreanName}
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
