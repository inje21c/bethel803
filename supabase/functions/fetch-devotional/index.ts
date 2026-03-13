// Supabase Edge Function: fetch-devotional
// 매일 06:00 KST (21:00 UTC) 실행
// sum.su.or.kr:8888/bible/today 스크래핑 → GPT-4o-mini 요약 → daily_devotionals upsert

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

    // 1. HTML 스크래핑
    const html = await fetchHtml(SOURCE_URL);

    // 2. GPT-4o-mini로 묵상 내용 추출
    const devotional = await extractDevotional(html, today);

    // 3. Supabase upsert (실제 컬럼명 기준)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase
      .from('daily_devotionals')
      .upsert(
        {
          devotional_date: today,
          scripture: devotional.verse,
          content: devotional.content,
          summary: devotional.summary,
          application_question: devotional.applicationQuestion,
          source_url: SOURCE_URL,
        },
        { onConflict: 'devotional_date' }
      );

    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, date: today, scripture: devotional.verse }),
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

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** HTML 가져오기 (EUC-KR → UTF-8 변환 포함) */
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BethelBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);

  const buffer = await res.arrayBuffer();
  try {
    const decoder = new TextDecoder('euc-kr');
    return decoder.decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

interface DevotionalResult {
  verse: string;
  content: string;
  summary: string;
  applicationQuestion: string;
}

/** GPT-4o-mini로 HTML에서 묵상 내용 추출 */
async function extractDevotional(html: string, date: string): Promise<DevotionalResult> {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 6000);

  const prompt = `다음은 ${date} 날짜의 성경 묵상 웹페이지 텍스트입니다.
아래 JSON 형식으로 묵상 정보를 추출해 주세요.

{
  "verse": "본문 성경 구절 표기 (예: 요한복음 3:16, 빌립보서 4:6-7)",
  "content": "묵상 본문 내용 요약 (3~4문장, 한국어)",
  "summary": "핵심 한 줄 요약 (1문장)",
  "applicationQuestion": "삶에 적용할 질문 (1문장)"
}

내용을 찾을 수 없으면:
{
  "verse": "시편 119:105",
  "content": "주의 말씀은 내 발에 등이요 내 길에 빛이니이다. 말씀의 빛으로 오늘 하루를 걸어가는 은혜가 있기를 바랍니다.",
  "summary": "말씀이 우리의 길을 비추는 등불입니다.",
  "applicationQuestion": "오늘 하루 말씀을 어떻게 삶에 적용하시겠습니까?"
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');

  const parsed = JSON.parse(raw) as DevotionalResult;
  return {
    verse: parsed.verse || '시편 119:105',
    content: parsed.content || '말씀으로 하루를 시작하는 은혜가 있기를 바랍니다.',
    summary: parsed.summary || '말씀이 우리의 길을 비추는 등불입니다.',
    applicationQuestion: parsed.applicationQuestion || '오늘 하루 말씀을 어떻게 삶에 적용하시겠습니까?',
  };
}
