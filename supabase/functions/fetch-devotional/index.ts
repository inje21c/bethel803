// Supabase Edge Function: fetch-devotional
// 매일 06:00 KST (21:00 UTC) 실행
// BodyMatterDetail + BodyBible 스크래핑 → qt_contents + daily_devotionals upsert

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim() ?? '';
const SOURCE_URL = 'https://sum.su.or.kr:8888/bible/today';
const BASE_API = 'https://sum.su.or.kr:8888/Ajax/Bible';
const MAX_RANGE_DAYS = 14;
const SOURCE_API_RETRIES = 2;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const dates = await getRequestedDates(req);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results: { date: string; scripture: string }[] = [];

    for (const date of dates) {
      results.push(await fetchAndStoreQT(supabase, date));
    }

    const first = results[0];
    return new Response(
      JSON.stringify({
        ok: true,
        date: first?.date,
        scripture: first?.scripture,
        count: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('fetch-devotional error:', msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchAndStoreQT(
  supabase: ReturnType<typeof createClient>,
  date: string,
): Promise<{ date: string; scripture: string }> {
  // scraped 모드 교회 목록 동적 조회 (슈퍼어드민 허가 교회)
  const { data: settingsRows } = await supabase
    .from('church_settings')
    .select('church_id')
    .eq('qt_mode', 'scraped');

  const scrapedIds = (settingsRows ?? []).map((r) => r.church_id as string);

  // 이미 저장된 교회 확인: church_id IN (...) 필터로 maybeSingle 오류 방지
  if (scrapedIds.length > 0) {
    const { data: existing } = await supabase
      .from('qt_contents')
      .select('church_id, date, title, scripture, scripture_text, summary, question, prayer, application, audio_url, hymn_suggestions')
      .in('church_id', scrapedIds)
      .eq('date', date);

    const existingMap = new Map((existing ?? []).map((r) => [r.church_id as string, r]));

    if (existingMap.size === scrapedIds.length) {
      // 모든 scraped 교회에 데이터 있음 → 완전 캐시
      const first = existingMap.values().next().value;
      return { date, scripture: first.scripture as string };
    }

    if (existingMap.size > 0) {
      // 일부만 있음 (신규 교회 추가 등) → 기존 행에서 복사
      const template = existingMap.values().next().value;
      const missingIds = scrapedIds.filter((id) => !existingMap.has(id));
      for (const churchId of missingIds) {
        const { church_id: _cid, ...fields } = template as Record<string, unknown>;
        const { error } = await supabase
          .from('qt_contents')
          .upsert({ ...fields, church_id: churchId }, { onConflict: 'church_id,date' });
        if (error) console.error(`qt_contents copy upsert error for church ${churchId}:`, error.message);
      }
      return { date, scripture: template.scripture as string };
    }
  }

  // 스크래핑 필요
  let detail: QTDetail;
  let scriptureText = '';

  try {
    [detail, scriptureText] = await Promise.all([
      fetchQTDetail(date),
      fetchScriptureText(date),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.warn(`QT source fetch failed for ${date}: ${msg}`);

    // daily_devotionals fallback (스크래핑 실패 시)
    const { data: devFallback } = await supabase
      .from('daily_devotionals')
      .select('devotional_date, scripture')
      .eq('devotional_date', date)
      .maybeSingle();
    if (devFallback?.scripture) {
      return { date: devFallback.devotional_date as string, scripture: devFallback.scripture as string };
    }

    throw err;
  }

  const { question, prayer, application } = await generateAIFields(detail.summary);

  // daily_devotionals 저장 (non-fatal)
  const { error: devError } = await supabase
    .from('daily_devotionals')
    .upsert(
      {
        devotional_date: date,
        scripture: detail.scripture,
        content: detail.summary,
        summary: detail.summary,
        application_question: question,
        source_url: SOURCE_URL,
      },
      { onConflict: 'devotional_date' }
    );
  if (devError) console.error('daily_devotionals upsert error (non-fatal):', devError.message);

  // 모든 scraped 교회에 qt_contents 저장
  for (const churchId of scrapedIds) {
    const { error: qtError } = await supabase
      .from('qt_contents')
      .upsert(
        {
          church_id: churchId,
          date,
          title: detail.title,
          scripture: detail.scripture,
          scripture_text: scriptureText,
          summary: detail.summary,
          question,
          prayer,
          application,
          audio_url: detail.audioUrl,
          hymn_suggestions: detail.hymnSuggestions,
        },
        { onConflict: 'church_id,date' }
      );
    if (qtError) console.error(`qt_contents upsert error for church ${churchId}:`, qtError.message);
  }

  return { date, scripture: detail.scripture };
}

function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

async function getRequestedDates(req: Request): Promise<string[]> {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    return buildDateRange(
      url.searchParams.get('date') ?? undefined,
      url.searchParams.get('from') ?? undefined,
      url.searchParams.get('to') ?? undefined,
    );
  }

  const body = await req.json().catch(() => ({})) as {
    date?: string;
    from?: string;
    to?: string;
  };
  return buildDateRange(body.date, body.from, body.to);
}

function buildDateRange(date?: string, from?: string, to?: string): string[] {
  if (date) {
    assertDate(date, 'date');
    return [date];
  }

  if (!from && !to) return [getTodayKST()];
  const start = from ?? to;
  const end = to ?? from;
  assertDate(start, 'from');
  assertDate(end, 'to');

  const dates: string[] = [];
  const cursor = parseUTCDate(start);
  const last = parseUTCDate(end);
  if (cursor.getTime() > last.getTime()) throw new Error('from must be on or before to');

  while (cursor.getTime() <= last.getTime()) {
    if (dates.length >= MAX_RANGE_DAYS) {
      throw new Error(`date range is too large; maximum ${MAX_RANGE_DAYS} days`);
    }
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function assertDate(date: string | undefined, field: string): asserts date is string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${field} must be YYYY-MM-DD`);
  }
  const parsed = parseUTCDate(date);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${field} is not a valid date`);
  }
}

function parseUTCDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

async function postApi(endpoint: string, date: string): Promise<unknown> {
  const bodies = [
    JSON.stringify({ qt_ty: 'QT1', Base_de: date }),
    `{ 'qt_ty' : 'QT1' , 'Base_de' : '${date}'}`,
  ];
  let lastError = '';

  for (let attempt = 1; attempt <= SOURCE_API_RETRIES + 1; attempt += 1) {
    let shouldRetry = false;

    for (const body of bodies) {
      try {
        const res = await fetch(`${BASE_API}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'User-Agent': 'Mozilla/5.0 (compatible; BethelBot/1.0)',
            'Referer': SOURCE_URL,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body,
          signal: AbortSignal.timeout(15000),
        });

        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') ?? '';
        const charset = /euc-kr/i.test(contentType) ? 'euc-kr' : 'utf-8';
        const text = new TextDecoder(charset, { fatal: false }).decode(buffer);

        if (!res.ok) {
          lastError = `${endpoint} HTTP ${res.status}: ${text.slice(0, 200)}`;
          shouldRetry = isTransientStatus(res.status) || shouldRetry;
          continue;
        } else {
          try {
            return JSON.parse(text);
          } catch {
            lastError = `${endpoint} returned invalid JSON: ${text.slice(0, 200)}`;
            continue;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : JSON.stringify(err);
        lastError = `${endpoint} request error: ${msg}`;
        shouldRetry = true;
      }
    }

    if (!shouldRetry || attempt > SOURCE_API_RETRIES) {
      break;
    }

    const delayMs = 2000 * attempt;
    console.warn(`${endpoint} retry ${attempt}/${SOURCE_API_RETRIES} for ${date} after ${delayMs}ms: ${lastError}`);
    await delay(delayMs);
  }

  throw new Error(lastError || `${endpoint} request failed`);
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

interface QTDetail {
  title: string;
  scripture: string;
  summary: string;
  audioUrl: string;
  hymnSuggestions: { title: string; type: string; youtube_url: string }[];
}

async function fetchQTDetail(date: string): Promise<QTDetail> {
  const data = await postApi('BodyMatterDetail', date) as Record<string, unknown>;

  const bibleName = String(data.Bible_name ?? '').replace(/\(.*?\)/, '').trim();
  const bibleChapter = String(data.Bible_chapter ?? '').trim();
  const scripture = bibleName && bibleChapter ? `${bibleName} ${bibleChapter}` : '시편 119:105';

  const title = String(data.Qt_sj ?? '').trim() || '오늘의 묵상';

  const rawSummary = String(data.Qt_a2 ?? data.Qt_Brf ?? '');
  const summary = stripHtml(rawSummary) || '말씀으로 하루를 시작하는 은혜가 있기를 바랍니다.';

  const audioUrl = String(data.MediaFileUrl ?? '').trim();

  const hymnSuggestions: { title: string; type: string; youtube_url: string }[] = [];
  if (data.Bible_song) {
    hymnSuggestions.push({
      title: `찬송가 ${data.Bible_song}장`,
      type: '찬송가',
      youtube_url: `https://www.youtube.com/results?search_query=찬송가+${data.Bible_song}장`,
    });
  }
  if (data.New_song) {
    hymnSuggestions.push({
      title: `새찬송가 ${data.New_song}장`,
      type: '새찬송가',
      youtube_url: `https://www.youtube.com/results?search_query=새찬송가+${data.New_song}장`,
    });
  }

  return { title, scripture, summary, audioUrl, hymnSuggestions };
}

async function fetchScriptureText(date: string): Promise<string> {
  let data: unknown;
  try {
    data = await postApi('BodyBible', date);
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.warn(`BodyBible failed for ${date}; continuing without scripture text: ${msg}`);
    return '';
  }

  if (!Array.isArray(data) || data.length === 0) return '';

  return (data as { Verse: string; Bible_Cn: string }[])
    .map((v) => `${v.Verse} ${v.Bible_Cn}`)
    .join('\n');
}

async function callOpenAI(prompt: string, fallback: string): Promise<string> {
  if (openAIDisabled || !OPENAI_API_KEY) return fallback;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 401) {
        openAIDisabled = true;
        console.warn('OpenAI authentication failed; using QT fallback fields. Check OPENAI_API_KEY.');
      } else {
        console.error('OpenAI error:', err);
      }
      return fallback;
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    try {
      const parsed = JSON.parse(raw);
      return parsed.result || fallback;
    } catch {
      return fallback;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    if (msg.toLowerCase().includes('abort')) {
      console.warn('OpenAI request timed out; using QT fallback field.');
    } else {
      console.warn(`OpenAI request failed; using QT fallback field: ${msg}`);
    }
    return fallback;
  }
}

let openAIDisabled = false;

async function generateAIFields(summary: string): Promise<{
  question: string;
  prayer: string;
  application: string;
}> {
  const [question, prayer, application] = await Promise.all([
    generateQuestion(summary),
    generatePrayer(summary),
    generateApplication(summary),
  ]);
  return { question, prayer, application };
}

function generateQuestion(summary: string): Promise<string> {
  return callOpenAI(
    `다음 성경 묵상 해설을 읽고, 성찰 유도형 질문 1개만 생성하세요.
형식: "~한 순간이 있었나요?" 또는 "~할 때 어떻게 하시겠습니까?" 등 삶에 적용하는 질문.
"이 본문은 ~를 의미합니다" 형식 금지. JSON으로 { "result": "..." } 반환.

해설:
${summary.slice(0, 1500)}`,
    '오늘 하루 말씀을 어떻게 삶에 적용하시겠습니까?',
  );
}

function generatePrayer(summary: string): Promise<string> {
  return callOpenAI(
    `다음 성경 묵상 해설을 바탕으로 짧은 기도문을 1~2문장으로 작성하세요.
1인칭("주님, 저는..."), 고백과 간구 형식. "이 본문은" 형식 금지.
JSON으로 { "result": "..." } 반환.

해설:
${summary.slice(0, 1500)}`,
    '주님, 오늘 말씀 앞에 마음을 열고 주님의 뜻을 따르게 하소서.',
  );
}

function generateApplication(summary: string): Promise<string> {
  return callOpenAI(
    `다음 성경 묵상 해설을 바탕으로 오늘 하루 실천할 수 있는 구체적인 행동 한 가지를 제안하세요.
"오늘 ~해보세요" 또는 "오늘 ~를 시도해보세요" 형식. 1~2문장. 부담 없이 실천 가능한 것으로.
JSON으로 { "result": "..." } 반환.

해설:
${summary.slice(0, 1500)}`,
    '오늘 하루 말씀 한 구절을 마음에 품고 묵상해보세요.',
  );
}
