import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Link>
        <h1 className="font-display text-3xl font-bold mb-2">이용약관</h1>
        <p className="text-sm text-muted-foreground mb-8">최종 수정일: 2026년 6월 15일</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-2">제1조 (목적)</h2>
            <p className="text-muted-foreground leading-relaxed">
              이 약관은 벧엘구역 서비스(이하 "서비스")의 이용과 관련하여 서비스 제공자와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제2조 (서비스 내용)</h2>
            <p className="text-muted-foreground leading-relaxed">
              서비스는 교회 구역 모임의 기도제목 나눔, QT(말씀 묵상), 성경읽기 계획, 성경공부 자료 공유, 구성원 관리 등의 기능을 제공합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제3조 (회원 가입 및 계정)</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground leading-relaxed">
              <li>서비스 이용을 위해 이메일 주소와 비밀번호로 계정을 생성해야 합니다.</li>
              <li>계정 정보(이메일, 비밀번호)는 타인과 공유하지 않을 책임이 있습니다.</li>
              <li>허위 정보로 가입한 경우 서비스 이용이 제한될 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제4조 (교회 등록 및 무료 체험)</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground leading-relaxed">
              <li>교회 등록 후 30일간 무료 체험 기간이 제공됩니다.</li>
              <li>무료 체험 기간 중 신용카드 등 결제 정보는 요구하지 않습니다.</li>
              <li>무료 체험 종료 후 서비스 유지 여부는 추후 공지되는 플랜 정책에 따릅니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제5조 (이용자 의무)</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground leading-relaxed">
              <li>타인의 개인정보를 무단으로 수집하거나 이용하지 않습니다.</li>
              <li>서비스를 통해 불법·음란·허위 정보를 게시하지 않습니다.</li>
              <li>서비스의 정상적인 운영을 방해하는 행위를 하지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제6조 (서비스 제공 중단)</h2>
            <p className="text-muted-foreground leading-relaxed">
              시스템 점검, 장비 교체, 천재지변 등 불가항력적인 사유가 있는 경우 서비스 제공이 일시 중단될 수 있습니다. 이 경우 사전 공지를 원칙으로 하며, 부득이한 경우 사후 공지할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제7조 (면책 조항)</h2>
            <p className="text-muted-foreground leading-relaxed">
              서비스는 이용자가 서비스 내에서 게시한 내용(기도제목, 묵상 나눔 등)에 대한 법적 책임을 지지 않습니다. 이용자 간 발생하는 분쟁에 대해 서비스 제공자는 개입하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제8조 (약관 변경)</h2>
            <p className="text-muted-foreground leading-relaxed">
              약관이 변경되는 경우 서비스 내 공지 또는 이메일을 통해 7일 전 고지합니다. 변경 후에도 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 간주합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">제9조 (준거법 및 분쟁 해결)</h2>
            <p className="text-muted-foreground leading-relaxed">
              이 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련한 분쟁은 관할 법원에서 해결합니다.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t">
          <Link to="/privacy" className="text-sm text-primary hover:underline">개인정보처리방침 보기</Link>
        </div>
      </div>
    </div>
  );
}
