-- ============================================================
-- 022: 구조화 성경 본문/개인 북마크
-- docs/bible_kr.json import 대상 스키마
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bible_books (
  id SMALLINT PRIMARY KEY,
  korean_name TEXT NOT NULL UNIQUE,
  abbreviation TEXT,
  testament TEXT NOT NULL CHECK (testament IN ('old', 'new')),
  book_order SMALLINT NOT NULL UNIQUE,
  chapter_count SMALLINT NOT NULL CHECK (chapter_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bible_verses (
  book_id SMALLINT NOT NULL REFERENCES public.bible_books(id) ON DELETE CASCADE,
  chapter SMALLINT NOT NULL CHECK (chapter > 0),
  verse SMALLINT NOT NULL CHECK (verse > 0),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, chapter, verse)
);

DROP TRIGGER IF EXISTS bible_verses_updated_at ON public.bible_verses;
CREATE TRIGGER bible_verses_updated_at
  BEFORE UPDATE ON public.bible_verses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.bible_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id SMALLINT NOT NULL,
  chapter SMALLINT NOT NULL,
  verse SMALLINT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id, chapter, verse),
  FOREIGN KEY (book_id, chapter, verse)
    REFERENCES public.bible_verses(book_id, chapter, verse)
    ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS bible_bookmarks_updated_at ON public.bible_bookmarks;
CREATE TRIGGER bible_bookmarks_updated_at
  BEFORE UPDATE ON public.bible_bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_bible_verses_chapter
  ON public.bible_verses(book_id, chapter, verse);

CREATE INDEX IF NOT EXISTS idx_bible_verses_text_ko
  ON public.bible_verses USING gin (to_tsvector('simple', text));

CREATE INDEX IF NOT EXISTS idx_bible_bookmarks_user_created
  ON public.bible_bookmarks(user_id, created_at DESC);

ALTER TABLE public.bible_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bible_books_authenticated_read" ON public.bible_books;
CREATE POLICY "bible_books_authenticated_read" ON public.bible_books
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "bible_verses_authenticated_read" ON public.bible_verses;
CREATE POLICY "bible_verses_authenticated_read" ON public.bible_verses
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "bible_bookmarks_own_select" ON public.bible_bookmarks;
CREATE POLICY "bible_bookmarks_own_select" ON public.bible_bookmarks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bible_bookmarks_own_insert" ON public.bible_bookmarks;
CREATE POLICY "bible_bookmarks_own_insert" ON public.bible_bookmarks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bible_bookmarks_own_update" ON public.bible_bookmarks;
CREATE POLICY "bible_bookmarks_own_update" ON public.bible_bookmarks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bible_bookmarks_own_delete" ON public.bible_bookmarks;
CREATE POLICY "bible_bookmarks_own_delete" ON public.bible_bookmarks
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
