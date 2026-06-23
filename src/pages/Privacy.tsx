import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PrivacyContent } from '@/components/legal/LegalContents';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Link>
        <h1 className="font-display text-3xl font-bold mb-2">개인정보처리방침</h1>
        <p className="text-sm text-muted-foreground mb-8">최종 수정일: 2026년 6월 15일</p>

        <PrivacyContent />

        <div className="mt-10 pt-6 border-t">
          <Link to="/terms" className="text-sm text-primary hover:underline">이용약관 보기</Link>
        </div>
      </div>
    </div>
  );
}
