import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KakaoNoticeGenerator from '@/components/KakaoNoticeGenerator';

// navigator.clipboard mock
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// sonner toast mock
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('KakaoNoticeGenerator', () => {
  it('컴포넌트가 렌더링됨', () => {
    render(<KakaoNoticeGenerator />);
    // 입력 필드 또는 버튼이 있음을 확인
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
