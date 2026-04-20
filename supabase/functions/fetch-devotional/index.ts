// Supabase Edge Function: fetch-devotional
// 매일 06:00 KST (21:00 UTC) 실행
// BodyMatterDetail + BodyBible 스크래핑 → qt_contents + daily_devotionals upsert

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SOURCE_URL = 'https://sum.su.or.kr:8888/bible/today';
const BASE_API = 'https://sum.su.or.kr:8888/Ajax/Bible';

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

    const [detail, scriptureText] = await Promise.all([
      fetchQTDetail(today),
      fetchScriptureText(today),
    ]);

    const [question, prayer, application] = await Promise.all([
      generateQuestion(detail.summary),
      generatePrayer(detail.summary),
      generateApplication(detail.summary),
    ]);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: qtError } = await supabase
      .from('qt_contents')
      .upsert(
        {
          date: today,
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
        { onConflict: 'date' }
      );
    if (qtError) throw qtError;

    const { error: devError } = await supabase
      .from('daily_devotionals')
      .upsert(
        {
          devotional_date: today,
          scripture: detail.scripture,
          content: detail.summary,
          summary: detail.summary,
          application_question: question,
          source_url: SOURCE_URL,
        },
        { onConflict: 'devotional_date' }
      );
    if (devError) console.error('daily_devotionals upsert error (non-fatal):', devError.message);

    return new Response(
      JSON.stringify({ ok: true, date: today, scripture: detail.scripture }),
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

async function postApi(endpoint: string, date: string): Promise<unknown> {
  const res = await fetch(`${BASE_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'Mozilla/5.0 (compatible; BethelBot/1.0)',
      'Referer': SOURCE_URL,
    },
    body: `{ 'qt_ty' : 'QT1' , 'Base_de' : '${date}'}`,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}`);

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') ?? '';
  const charset = /euc-kr/i.test(contentType) ? 'euc-kr' : 'utf-8';
  const text = new TextDecoder(charset, { fatal: false }).decode(buffer);
  return JSON.parse(text);
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
  } catch {
    return '';
  }

  if (!Array.isArray(data) || data.length === 0) return '';

  return (data as { Verse: string; Bible_Cn: string }[])
    .map((v) => `${v.Verse} ${v.Bible_Cn}`)
    .join('\n');
}

async function callOpenAI(prompt: string, fallback: string): Promise<string> {
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
    console.error('OpenAI error:', await res.text());
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
