// Supabase Edge Function: fetch-devotional
// 매일 06:00 KST (21:00 UTC) 실행
// sum.su.or.kr:8888/bible/today 스크래핑 → GPT-4o-mini → qt_contents + daily_devotionals upsert

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SOURCE_URL = 'https://sum.su.or.kr:8888/bible/today';

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
    const today = getTodayKST();
    const html = await fetchHtml(SOURCE_URL);
    const result = await extractQTContent(html, today);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // qt_contents upsert
    const { error: qtError } = await supabase
      .from('qt_contents')
      .upsert(
        {
          date: today,
          title: result.title,
          scripture: result.scripture,
          scripture_text: result.scriptureText,
          summary: result.summary,
          question: result.question,
          audio_url: buildAudioUrl(today),
          hymn_suggestions: result.hymnSuggestions,
        },
        { onConflict: 'date' }
      );
    if (qtError) throw qtError;

    // daily_devotionals backward compat
    const { error: devError } = await supabase
      .from('daily_devotionals')
      .upsert(
        {
          devotional_date: today,
          scripture: result.scripture,
          content: result.summary,
          summary: result.summary,
          application_question: result.question,
          source_url: SOURCE_URL,
        },
        { onConflict: 'devotional_date' }
      );
    if (devError) console.error('daily_devotionals upsert error (non-fatal):', devError.message);

    return new Response(
      JSON.stringify({ ok: true, date: today, scripture: result.scripture }),
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

function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function buildAudioUrl(date: string): string {
  const d = date.replace(/-/g, '');
  const yyyy = date.slice(0, 4);
  return `https://meditation.su.or.kr/meditation_mp3/${yyyy}/${d}.mp3`;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BethelBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);

  const buffer = await res.arrayBuffer();
  try {
    return new TextDecoder('euc-kr').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

interface QTResult {
  title: string;
  scripture: string;
  scriptureText: string;
  summary: string;
  question: string;
  hymnSuggestions: { title: string; type: string; youtube_url: string }[];
}

async function extractQTContent(html: string, date: string): Promise<QTResult> {
  // <div class="bible_text">에서 묵상 제목 직접 추출
  const bibleTextTitle = html.match(/<div[^>]*class=["'][^"']*bible_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    ?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 8000);

  const prompt = `다음은 ${date} 날짜의 매일성경 묵상 웹페이지 텍스트입니다.
오늘 묵상 제목(확정값, 반드시 이 값을 title 필드에 사용): "${bibleTextTitle}"
아래 JSON 형식으로 정보를 추출하세요.

규칙:
- summary: 해설 내용을 3~5문장으로 요약. "이 본문의 의미는~" 형식 금지. 사실과 문맥 중심으로 서술.
- question: 성찰 유도형 질문 1개. "~한 순간이 있었나요?" 또는 "~할 때 어떻게 하시겠습니까?" 형식.
  "이 본문은 ~를 의미합니다" 형식 금지.
- hymn_suggestions: 본문과 어울리는 찬송가 2~3개. youtube_url은 YouTube 검색 URL 형식.

{
  "title": "오늘 묵상 제목 (예: 믿음의 여정)",
  "scripture": "본문 구절 (예: 창세기 26:34 - 27:14)",
  "scripture_text": "성경 본문 전문 (개역개정, 절 번호 포함, 없으면 빈 문자열)",
  "summary": "해설 요약 3~5문장",
  "question": "성찰 질문 1개",
  "hymn_suggestions": [
    { "title": "찬송가 제목", "type": "찬송가", "youtube_url": "https://www.youtube.com/results?search_query=찬송가+제목" }
  ]
}

내용을 찾을 수 없으면 기본값으로:
{
  "title": "오늘의 묵상",
  "scripture": "시편 119:105",
  "scripture_text": "",
  "summary": "주의 말씀은 내 발에 등이요 내 길에 빛이니이다. 말씀은 우리가 걸어가야 할 길을 밝혀 주는 빛입니다.",
  "question": "오늘 하루 말씀의 빛을 따라 결단해야 할 일이 있다면 무엇인가요?",
  "hymn_suggestions": [
    { "title": "내 주를 가까이 하게 함은", "type": "찬송가", "youtube_url": "https://www.youtube.com/results?search_query=내+주를+가까이+하게+함은+찬송가" }
  ]
}

페이지 텍스트:
${stripped}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${await res.text()}`);

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');

  const parsed = JSON.parse(raw);
  return {
    title: bibleTextTitle || parsed.title || '오늘의 묵상',
    scripture: parsed.scripture || '시편 119:105',
    scriptureText: parsed.scripture_text || '',
    summary: parsed.summary || '말씀으로 하루를 시작하는 은혜가 있기를 바랍니다.',
    question: parsed.question || '오늘 하루 말씀을 어떻게 삶에 적용하시겠습니까?',
    hymnSuggestions: Array.isArray(parsed.hymn_suggestions) ? parsed.hymn_suggestions : [],
  };
}
