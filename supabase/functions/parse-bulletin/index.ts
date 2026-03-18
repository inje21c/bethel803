// Supabase Edge Function: parse-bulletin
// 매주 일요일 20:00 KST (11:00 UTC) 실행
// 벧엘교회 주보 PDF → gpt-4o 파싱 → bible_studies 등록 (published=false)
//
// 요청 형식: POST { pdf_url?: string }
// pdf_url 없으면 이번 주 일요일 날짜로 자동 생성

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const BULLETIN_BASE = 'http://bethel.or.kr/wp-content/uploads';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 수동 JWT 검증: leader 권한 체크
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
        if (!authError && user) {
          const { data: profile } = await supabaseAuth
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role !== 'leader' && profile?.role !== 'master') {
            return new Response(
              JSON.stringify({ ok: false, error: '권한 없음: 구역장만 사용할 수 있습니다.' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (e) {
        console.warn('Auth check skipped:', e);
      }
    }

    const body = await req.json().catch(() => ({}));
    const pdfUrl: string = body.pdf_url || getAutoUrl();

    // 1. PDF 다운로드
    const pdfBytes = await fetchPdfBytes(pdfUrl);

    // 2. OpenAI Files API 업로드 → file_id 취득
    const fileId = await uploadPdfToOpenAI(pdfBytes, 'bulletin.pdf');

    // 3. gpt-4o로 파싱
    const parsed = await parseBulletinWithGPT(fileId, pdfUrl);

    // 4. 파일 삭제 (스토리지 비용 절감)
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    }).catch(() => {}); // 실패해도 무시

    // 3. 모든 활성 구역에 bible_studies 등록 (published=false)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: districts, error: distErr } = await supabase
      .from('districts')
      .select('id')
      .eq('is_active', true);

    if (distErr) throw distErr;
    if (!districts || districts.length === 0) throw new Error('활성 구역이 없습니다.');

    const rows = districts.map((d: { id: string }) => ({
      week_number: parsed.weekNumber,
      study_date: parsed.date,
      title: parsed.title,
      scripture: parsed.scripture,
      introduction: parsed.introduction,
      questions: parsed.questions,
      published: false,
      source_pdf_url: pdfUrl,
      district_id: d.id,
    }));

    const { data, error } = await supabase
      .from('bible_studies')
      .insert(rows)
      .select('id');

    if (error) throw error;

    const ids = (data ?? []).map((r: { id: string }) => r.id);

    return new Response(
      JSON.stringify({ ok: true, ids, count: ids.length, title: parsed.title, pdfUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('parse-bulletin error:', msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/** 가장 최근 일요일 날짜로 URL 자동 생성 (CRON이 일요일 20:00 KST에 실행되므로 당일 기준) */
function getAutoUrl(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=일요일
  const daysBack = day === 0 ? 0 : day; // 직전 일요일까지 며칠 전
  const sunday = new Date(kst);
  sunday.setUTCDate(kst.getUTCDate() - daysBack);

  const yyyy = sunday.getUTCFullYear();
  const mm = String(sunday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(sunday.getUTCDate()).padStart(2, '0');
  const yy = String(yyyy).slice(2);

  return `${BULLETIN_BASE}/${yyyy}/${mm}/weekly${yy}${mm}${dd}.pdf`;
}

/** PDF 바이너리 다운로드 */
async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BethelBot/1.0)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`PDF 다운로드 실패 HTTP ${res.status}: ${url}`);
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

/** OpenAI Files API에 PDF 업로드 → file_id 반환 */
async function uploadPdfToOpenAI(bytes: Uint8Array, filename: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  formData.append('file', blob, filename);
  formData.append('purpose', 'user_data');

  const res = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI 파일 업로드 실패: ${err}`);
  }
  const data = await res.json();
  return data.id as string;
}

interface ParsedBulletin {
  weekNumber: number;
  date: string;
  title: string;
  scripture: string;
  introduction: string;
  questions: string[];
}

/** gpt-4o로 PDF 파싱 (file_id 사용) */
async function parseBulletinWithGPT(fileId: string, pdfUrl: string): Promise<ParsedBulletin> {
  // URL에서 날짜 추출 (예: weekly260308.pdf → 2026-03-08)
  const match = pdfUrl.match(/weekly(\d{2})(\d{2})(\d{2})\.pdf/);
  const dateHint = match
    ? `20${match[1]}-${match[2]}-${match[3]}`
    : new Date().toISOString().slice(0, 10);

  const prompt = `이 문서는 한국 교회의 주보(주간 예배 소식지) PDF입니다.
주보 안에 있는 구역 성경공부 자료를 찾아서 아래 JSON 형식으로 추출해 주세요.
날짜 힌트: ${dateHint}

반환 형식:
{
  "weekNumber": 11,
  "date": "2026-03-08",
  "title": "성경공부 제목",
  "scripture": "본문 성경 구절 (예: 마태복음 5:1-12)",
  "introduction": "도입 설명 또는 배경 (2~4문장)",
  "questions": [
    "첫 번째 질문",
    "두 번째 질문",
    "세 번째 질문"
  ]
}

- weekNumber: 해당 연도의 몇 주차인지 (없으면 날짜로 계산)
- questions: 성경공부 토론/묵상 질문 목록 (최대 10개)
- 구역 성경공부 항목이 없으면 설교 내용을 바탕으로 질문 3개를 직접 생성하세요`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'file',
              file: { file_id: fileId },
            },
          ],
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');

  const parsed = JSON.parse(raw) as ParsedBulletin;

  // 날짜/weekNumber 보정
  const finalDate = parsed.date || dateHint;
  const finalWeekNumber = parsed.weekNumber || getISOWeek(finalDate);

  return {
    weekNumber: finalWeekNumber,
    date: finalDate,
    title: parsed.title || '성경공부',
    scripture: parsed.scripture || '',
    introduction: parsed.introduction || '',
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
  };
}

function getISOWeek(dateStr: string): number {
  const date = new Date(dateStr);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
