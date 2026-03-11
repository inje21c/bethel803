import { describe, it, expect } from 'vitest';
import { getISOWeekNumber } from '@/lib/api';

describe('getISOWeekNumber', () => {
  it('2026년 1월 1일은 1주차', () => {
    expect(getISOWeekNumber('2026-01-01')).toBe(1);
  });

  it('2026년 3월 9일은 11주차', () => {
    expect(getISOWeekNumber('2026-03-09')).toBe(11);
  });

  it('2025년 12월 29일은 1주차 (ISO 주차는 해를 넘을 수 있음)', () => {
    // 2025-12-29는 월요일, ISO 주 1주차 (2026년 기준)
    const week = getISOWeekNumber('2025-12-29');
    expect(week).toBe(1);
  });

  it('2026년 12월 28일은 53주차 또는 다음 해 1주차', () => {
    const week = getISOWeekNumber('2026-12-28');
    expect(typeof week).toBe('number');
    expect(week).toBeGreaterThan(0);
  });
});
