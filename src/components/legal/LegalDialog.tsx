import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TermsContent, PrivacyContent } from './LegalContents';

// 이용약관 / 개인정보처리방침을 모달로 띄운다.
// 네이티브 앱(WebView)에서 새 페이지로 이동하면 하드웨어 백 시 폼 상태가
// 날아가고 랜딩으로 튀는 문제가 있어, 이동 없이 모달로 보여준다.
export function LegalDialog({
  type,
  children,
}: {
  type: 'terms' | 'privacy';
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-primary underline underline-offset-2"
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {type === 'terms' ? '이용약관' : '개인정보처리방침'}
          </DialogTitle>
        </DialogHeader>
        {type === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </DialogContent>
    </Dialog>
  );
}
