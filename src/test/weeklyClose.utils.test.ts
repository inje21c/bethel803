import { describe, it, expect } from 'vitest';

// AdminDashboard의 getThisWeekStart 로직 테스트
function getThisWeekStart(now: Date): string {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kstNow.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(kstNow);
  monday.setUTCDate(kstNow.getUTCDate() - daysFromMonday);
  return monday.toISOString().slice(0, 10);
}

describe('getThisWeekStart', () => {
  it('월요일 기준 — 같은 날', () => {
    // 2026-03-09는 월요일
    const monday = new Date('2026-03-09T00:00:00Z');
    expect(getThisWeekStart(monday)).toBe('2026-03-09');
  });

  it('일요일 기준 — 전 주 월요일', () => {
    // 2026-03-15는 일요일 → 해당 주 월요일은 2026-03-09
    const sunday = new Date('2026-03-15T00:00:00Z');
    expect(getThisWeekStart(sunday)).toBe('2026-03-09');
  });

  it('수요일 기준 — 같은 주 월요일', () => {
    // 2026-03-11은 수요일 → 해당 주 월요일은 2026-03-09
    const wednesday = new Date('2026-03-11T00:00:00Z');
    expect(getThisWeekStart(wednesday)).toBe('2026-03-09');
  });

  it('반환값은 YYYY-MM-DD 형식', () => {
    const now = new Date('2026-01-05T12:00:00Z');
    const result = getThisWeekStart(now);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
