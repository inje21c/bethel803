// 깊은 묵상 세션 시작용 AI 생성 (요약 + 질문 4개)
// 실패 시 항상 폴백으로 응답한다 — 이 함수가 죽어도 기능은 살아야 한다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_QUESTIONS = [
  '이 말씀에서 가장 인상 깊은 구절은 무엇인가요? 그 이유는?',
  '이 말씀에 등장하는 인물이나 사건에서 하나님의 성품을 어떻게 발견할 수 있나요?',
  '이 말씀이 오늘 나의 삶과 어떻게 연결되나요?',
  '이 말씀을 통해 오늘 하루 어떻게 살아야 할지 구체적으로 적어보세요.',
];

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function callOpenAI(prompt: string, maxTokens: number): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
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
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error('OpenAI error:', await res.text());
      return null;
    }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content as string) ?? null;
  } catch (e) {
    console.error('OpenAI call failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function generateSummary(
  title: string,
  scriptureRef: string,
  scriptureText: string,
): Promise<string | null> {
  const prompt = `성경 묵상을 돕기 위해 오늘의 말씀 내용을 요약해줘.

제목: ${title}
말씀: ${scriptureRef}

본문:
${scriptureText.slice(0, 2000)}

요약 기준:
- 핵심 사건 또는 가르침 2~3가지를 간결한 문장으로
- 경건하고 묵상적인 톤
- 300자 이내, 마크다운 없이 순수 텍스트로`;
  return callOpenAI(prompt, 500);
}

async function generateQuestions(
  title: string,
  scriptureRef: string,
  scriptureText: string,
  commentary: string,
): Promise<string[] | null> {
  const prompt = `오늘의 성경 묵상을 위한 질문 4개를 만들어줘.

제목: ${title}
말씀: ${scriptureRef}

[본문]
${scriptureText.slice(0, 600)}

[해설]
${commentary.slice(0, 600)}

질문 4개 기준 (각 1개씩):
1. 내용 파악 (본문에서 무엇을 발견했나?)
2. 신학적 의미 (이 말씀이 하나님에 대해 무엇을 말하나?)
3. 개인 적용 (나의 삶과 어떻게 연결되나?)
4. 실천 결단 (오늘 어떻게 행동할 것인가?)

JSON 배열만 반환: ["질문1", "질문2", "질문3", "질문4"]`;

  const raw = await callOpenAI(prompt, 600);
  if (!raw) return null;
  try {
    // 마크다운 코드펜스(```json ... ```) 제거 후 파싱
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(q => typeof q === 'string')) {
      return parsed as string[];
    }
    return null;
  } catch {
    console.error('question JSON parse failed:', raw.slice(0, 200));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 활성 사용자 검증
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { ok: false, error: '인증이 필요합니다.' });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authError || !user) {
    return jsonResponse(401, { ok: false, error: '인증이 필요합니다.' });
  }

  let date: string;
  try {
    const body = await req.json();
    date = (body.date as string) ?? '';
  } catch {
    date = '';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // KST 오늘 날짜
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    date = kst.toISOString().slice(0, 10);
  }

  const { data: qt, error: qtError } = await supabase
    .from('qt_contents')
    .select('*')
    .eq('date', date)
    .maybeSingle();

  if (qtError || !qt) {
    return jsonResponse(404, { ok: false, error: '해당 날짜의 QT 콘텐츠가 없습니다.' });
  }

  // 날짜별 캐시: 이미 생성된 요약/질문이 있으면 AI 호출 없이 반환
  const cachedSummary = (qt.deep_summary as string | null) ?? null;
  const cachedQuestions = Array.isArray(qt.deep_questions) ? (qt.deep_questions as string[]) : null;
  if (cachedSummary && cachedQuestions && cachedQuestions.length > 0) {
    return jsonResponse(200, {
      ok: true,
      date,
      summary: cachedSummary,
      questions: cachedQuestions,
      cached: true,
    });
  }

  const title = (qt.title as string) ?? '';
  const scriptureRef = (qt.scripture as string) ?? '';
  const scriptureText = (qt.scripture_text as string) ?? '';
  const commentary = (qt.summary as string) ?? '';

  const [aiSummary, aiQuestions] = await Promise.all([
    generateSummary(title, scriptureRef, scriptureText),
    generateQuestions(title, scriptureRef, scriptureText, commentary),
  ]);

  // 폴백: 요약은 기존 해설 요약 → 본문 앞 300자, 질문은 기본 4개
  const summary =
    aiSummary?.trim()
    || commentary.trim()
    || scriptureText.slice(0, 300)
    || '오늘의 말씀을 천천히 읽으며 묵상해보세요.';
  const questions = aiQuestions && aiQuestions.length > 0 ? aiQuestions : DEFAULT_QUESTIONS;

  // AI가 실제 생성한 경우에만 캐시 (폴백 결과는 캐시하지 않아 다음 호출에서 재시도)
  if (aiSummary && aiQuestions) {
    const { error: cacheError } = await supabase
      .from('qt_contents')
      .update({ deep_summary: summary, deep_questions: questions })
      .eq('date', date);
    if (cacheError) {
      // 026 마이그레이션 미적용 등 — 캐시 실패해도 응답은 정상 반환
      console.error('deep cache write failed:', cacheError.message);
    }
  }

  return jsonResponse(200, {
    ok: true,
    date,
    summary,
    questions,
    aiGenerated: { summary: !!aiSummary, questions: !!aiQuestions },
  });
});
