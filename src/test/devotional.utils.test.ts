import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// getTodayDevotional에서 사용하는 날짜 계산 로직 테스트
function getKSTToday(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

describe('getKSTToday', () => {
  it('UTC 기준 자정 직후는 KST 오전 9시 — 같은 날', () => {
    // UTC 2026-03-09T00:00:00Z → KST 2026-03-09T09:00:00
    const utcMidnight = new Date('2026-03-09T00:00:00Z');
    expect(getKSTToday(utcMidnight)).toBe('2026-03-09');
  });

  it('UTC 기준 14:59는 KST 23:59 — 같은 날', () => {
    // UTC 2026-03-09T14:59:00Z → KST 2026-03-09T23:59:00
    const utcTime = new Date('2026-03-09T14:59:00Z');
    expect(getKSTToday(utcTime)).toBe('2026-03-09');
  });

  it('UTC 기준 15:00는 KST 다음날 자정 — 날짜 변경', () => {
    // UTC 2026-03-09T15:00:00Z → KST 2026-03-10T00:00:00
    const utcTime = new Date('2026-03-09T15:00:00Z');
    expect(getKSTToday(utcTime)).toBe('2026-03-10');
  });

  it('반환값은 YYYY-MM-DD 형식', () => {
    const now = new Date();
    const result = getKSTToday(now);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
