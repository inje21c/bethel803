// 이용약관 / 개인정보처리방침 본문.
// 전용 페이지(Terms.tsx, Privacy.tsx)와 모임 만들기 모달에서 공유한다.

export function TermsContent() {
  return (
    <div className="prose prose-sm max-w-none space-y-6 text-foreground break-keep">
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
  );
}

export function PrivacyContent() {
  return (
    <div className="space-y-6 text-foreground break-keep">
      <section>
        <h2 className="text-lg font-semibold mb-2">1. 수집하는 개인정보 항목</h2>
        <div className="space-y-2 text-muted-foreground leading-relaxed">
          <p><span className="font-medium text-foreground">필수:</span> 이메일 주소, 이름(닉네임), 교회명</p>
          <p><span className="font-medium text-foreground">선택:</span> 소셜 로그인(구글·카카오) 사용 시 해당 계정의 이름·이메일</p>
          <p><span className="font-medium text-foreground">자동 수집:</span> 서비스 이용 기록(로그인 일시, 기능 사용 기록), 기기 정보(웹푸시 구독 토큰)</p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">2. 개인정보 수집 및 이용 목적</h2>
        <ul className="list-disc list-inside space-y-1.5 text-muted-foreground leading-relaxed">
          <li>회원 가입 및 본인 확인</li>
          <li>서비스 제공 (구역 모임 관리, 기도제목 나눔, QT, 성경읽기 등)</li>
          <li>구성원 초대 및 구역 배정</li>
          <li>서비스 공지 및 알림 발송 (웹푸시)</li>
          <li>서비스 개선 및 통계 분석 (비식별 집계)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">3. 개인정보 보유 및 이용 기간</h2>
        <p className="text-muted-foreground leading-relaxed">
          회원 탈퇴 시 지체 없이 파기합니다. 단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground leading-relaxed">
          <li>계약·청약 철회 기록: 5년 (전자상거래법)</li>
          <li>소비자 불만·분쟁 처리 기록: 3년 (전자상거래법)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">4. 개인정보 제3자 제공</h2>
        <p className="text-muted-foreground leading-relaxed">
          수집한 개인정보는 원칙적으로 제3자에게 제공하지 않습니다. 단, 다음의 경우는 예외입니다.
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground leading-relaxed">
          <li>이용자의 사전 동의가 있는 경우</li>
          <li>법령에 따라 제공이 요구되는 경우</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">5. 개인정보 처리 위탁</h2>
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">수탁 업체</th>
                <th className="px-4 py-2.5 text-left font-medium">위탁 업무</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2.5 text-muted-foreground">Supabase Inc.</td>
                <td className="px-4 py-2.5 text-muted-foreground">인증 및 데이터베이스 저장</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-muted-foreground">Vercel Inc.</td>
                <td className="px-4 py-2.5 text-muted-foreground">웹 서비스 호스팅</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-muted-foreground">OpenAI Inc.</td>
                <td className="px-4 py-2.5 text-muted-foreground">AI 기능 처리 (QT 요약, 묵상 AI)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">6. 이용자의 권리</h2>
        <ul className="list-disc list-inside space-y-1.5 text-muted-foreground leading-relaxed">
          <li>본인의 개인정보 열람·수정·삭제를 요청할 권리</li>
          <li>개인정보 처리 정지를 요청할 권리</li>
          <li>서비스 내 '프로필' 메뉴 또는 '회원탈퇴'를 통해 직접 행사 가능</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">7. 쿠키 및 웹 저장소</h2>
        <p className="text-muted-foreground leading-relaxed">
          서비스는 로그인 상태 유지를 위해 브라우저 localStorage를 사용합니다. 이는 서비스 기능 제공에 필수적이며, 브라우저 설정에서 삭제할 수 있습니다(삭제 시 자동 로그아웃됩니다).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">8. 개인정보 보호 책임자</h2>
        <p className="text-muted-foreground leading-relaxed">
          개인정보 처리에 관한 문의는 서비스 내 문의 기능 또는 아래 이메일로 연락주세요.
        </p>
        <p className="mt-1.5 text-sm font-medium">이메일: cmhyun@gmail.com</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">9. 개인정보처리방침 변경</h2>
        <p className="text-muted-foreground leading-relaxed">
          이 방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스 내 공지 또는 이메일로 안내합니다.
        </p>
      </section>
    </div>
  );
}
