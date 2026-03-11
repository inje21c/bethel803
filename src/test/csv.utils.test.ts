import { describe, it, expect } from 'vitest';

// AdminDashboard의 exportCSV 로직 — CSV 문자열 생성 부분만 추출해서 테스트
function buildCSV(rows: (string | number)[][]): string {
  return '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

describe('buildCSV', () => {
  it('헤더 포함 CSV 생성', () => {
    const csv = buildCSV([['이름', '누적 장수'], ['홍길동', 50], ['김철수', 120]]);
    expect(csv).toContain('"이름","누적 장수"');
    expect(csv).toContain('"홍길동","50"');
    expect(csv).toContain('"김철수","120"');
  });

  it('큰따옴표 포함 값 이스케이프', () => {
    const csv = buildCSV([['제목', '내용'], ['테스트 "값"', '설명']]);
    expect(csv).toContain('"테스트 ""값"""');
  });

  it('BOM 헤더 포함 (한글 CSV)', () => {
    const csv = buildCSV([['이름']]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('빈 데이터도 처리', () => {
    const csv = buildCSV([]);
    expect(csv).toBe('\uFEFF');
  });
});
