/**
 * 약관·정책·요금·연락처 페이지.
 *
 * Paddle 은 라이브 계정 승인 때 결제가 붙은 사이트를 검토한다. 약관·환불정책·
 * 개인정보처리방침·연락처·공개된 가격이 없으면 거절 사유가 된다.
 *
 * /ai 와 같은 이유로 서버에서 렌더한다 — SPA 는 JS 를 실행해야 내용이 생기므로
 * 심사자나 크롤러가 가져가면 빈 껍데기만 받는다.
 *
 * 한국어를 본문으로 두고 영어를 함께 싣는다. 이용자는 한국어권이지만 Paddle 심사와
 * 해외 결제 고객은 영어를 읽는다.
 */
const { onRequest } = require('firebase-functions/v2/https');

const BASE = 'https://docs.prototypebench.org';

/**
 * 사업자 정보 — **승인 신청 전에 실제 값으로 채워야 한다.**
 * 법적 고지에 들어가는 값이라 추측해 넣지 않았다. 한 곳에 모아두었으니 여기만 고치면
 * 모든 페이지에 반영된다.
 */
const COMPANY = {
  serviceName: 'GDoc Fixer',
  legalName: '(상호를 입력하세요)',
  ceo: '(대표자명)',
  address: '(사업장 주소)',
  regNo: '(사업자등록번호)',
  mailOrderNo: '(통신판매업 신고번호)',
  email: 'tony@banya.ai',
  phone: '(연락처)',
  // 결제는 Paddle 이 판매자(Merchant of Record)로서 처리한다. 영수증·세금계산서·
  // 환불 실행이 Paddle 명의로 이루어지므로 약관에 명시해야 한다.
  merchantOfRecord: 'Paddle.com Market Ltd.',
};

const PAGES = {
  terms: { title: '이용약관', titleEn: 'Terms of Service' },
  refund: { title: '환불정책', titleEn: 'Refund Policy' },
  privacy: { title: '개인정보처리방침', titleEn: 'Privacy Policy' },
  pricing: { title: '요금 안내', titleEn: 'Pricing' },
  contact: { title: '연락처 · 사업자 정보', titleEn: 'Contact & Business Info' },
};

const CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0b0f14; color:#d7e0e8;
         font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',Segoe UI,sans-serif;
         line-height:1.8; }
  .wrap { max-width:780px; margin:0 auto; padding:48px 20px 96px; }
  nav { display:flex; flex-wrap:wrap; gap:14px; font-size:13px; margin-bottom:28px;
        padding-bottom:18px; border-bottom:1px solid #1b2530; }
  nav a { color:#7c8b9a; text-decoration:none; }
  nav a:hover, nav a.on { color:#6ea8fe; }
  h1 { font-size:27px; color:#f0f5f9; margin:.2em 0 .1em; }
  .sub { color:#7c8b9a; font-size:14px; margin:0 0 6px; }
  .updated { color:#5f6f7e; font-size:13px; margin-bottom:34px; }
  h2 { font-size:18px; color:#eaf1f7; margin:2em 0 .6em; padding-top:1em;
       border-top:1px solid #1b2530; }
  h3 { font-size:15px; color:#b9c8d6; margin:1.6em 0 .4em; }
  p, li { font-size:15px; color:#c4d0db; }
  ul, ol { padding-left:22px; }
  a { color:#6ea8fe; }
  table { width:100%; border-collapse:collapse; margin:1.2em 0; font-size:14px; }
  th,td { border:1px solid #1b2530; padding:10px 12px; text-align:left; }
  th { background:#131b24; color:#e3ecf4; }
  .en { margin-top:12px; padding:14px 16px; border-left:2px solid #24323d;
        color:#93a3b2; font-size:13.5px; line-height:1.7; }
  .en strong { color:#b9c8d6; }
  .todo { background:#2a1f10; border:1px solid #5a441c; color:#e8c98a;
          padding:14px 16px; border-radius:10px; font-size:14px; margin:20px 0; }
  footer { margin-top:56px; padding-top:20px; border-top:1px solid #1b2530;
           color:#5f6f7e; font-size:13px; }
`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const UPDATED = '2026-09-17';

/** 사업자 정보가 아직 플레이스홀더면 눈에 띄게 알린다(운영 전 확인용). */
function pendingNotice() {
  const unfilled = Object.entries(COMPANY).filter(([, v]) => String(v).startsWith('('));
  if (unfilled.length === 0) return '';
  return `<div class="todo">⚠ 사업자 정보가 아직 입력되지 않았습니다 (${unfilled.length}개 항목).
    결제 서비스 승인 신청 전에 <code>functions/legalPages.js</code> 의 <code>COMPANY</code> 를 채워 주세요.</div>`;
}

const BODY = {
  terms: () => `
${pendingNotice()}
<h2>제1조 (목적)</h2>
<p>이 약관은 ${esc(COMPANY.legalName)}(이하 "회사")가 제공하는 ${esc(COMPANY.serviceName)}(이하 "서비스")의 이용 조건과 절차, 회사와 이용자의 권리·의무를 정합니다.</p>

<h2>제2조 (서비스 내용)</h2>
<p>회사는 다음 기능을 제공합니다.</p>
<ul>
  <li>한글(HWP/HWPX) 양식 문서의 구조 분석 및 내용 자동 작성</li>
  <li>HTML 문서 편집 및 AI 기반 슬라이드 생성</li>
  <li>작성된 문서·슬라이드의 웹 게시(링크를 아는 사람만 열람)</li>
  <li>외부 AI 에이전트가 이용자를 대신해 위 기능을 호출할 수 있는 API</li>
</ul>

<h2>제3조 (회원가입)</h2>
<p>이용자는 Google 계정으로 로그인하여 서비스를 이용합니다. 가입 시 이메일, 이름, 프로필 사진이 수집됩니다. 회사는 서비스 운영을 방해하거나 약관을 위반한 계정의 이용을 제한할 수 있습니다.</p>

<h2>제4조 (코인)</h2>
<p>서비스의 AI 기능은 "코인"으로 이용합니다.</p>
<ul>
  <li>신규 가입 시 무료 코인이 지급됩니다.</li>
  <li>코인은 기능별로 정해진 양이 차감되며, 차감량은 <a href="${BASE}/pricing">요금 안내</a>에 공개합니다.</li>
  <li>회사의 장애로 기능이 실패한 경우 차감된 코인은 자동으로 환원됩니다.</li>
  <li>코인은 현금으로 환급되지 않으며, 환불은 <a href="${BASE}/refund">환불정책</a>을 따릅니다.</li>
</ul>

<h2>제5조 (결제)</h2>
<p>코인 결제는 ${esc(COMPANY.merchantOfRecord)}가 판매자(Merchant of Record)로서 처리합니다. 영수증 발행, 세금 처리, 환불 실행은 해당 사업자를 통해 이루어지며, 결제 시 해당 사업자의 약관이 함께 적용됩니다.</p>

<h2>제6조 (이용자의 콘텐츠)</h2>
<p>이용자가 업로드하거나 생성한 문서의 권리는 이용자에게 있습니다. 회사는 서비스 제공에 필요한 범위(저장, 변환, 게시)에서만 이를 처리하며, 이용자의 동의 없이 제3자에게 제공하거나 광고에 사용하지 않습니다.</p>
<p>이용자는 타인의 권리를 침해하거나 법령을 위반하는 내용을 업로드해서는 안 됩니다.</p>

<h2>제7조 (AI 생성 결과)</h2>
<p>서비스는 생성형 AI를 사용합니다. AI가 만든 문장·수치·형식은 부정확할 수 있으므로, 이용자는 <strong>제출·게시 전에 결과물을 직접 확인할 책임</strong>이 있습니다. 회사는 AI 생성 결과의 정확성을 보증하지 않습니다.</p>

<h2>제8조 (API 키)</h2>
<p>이용자는 외부 AI 에이전트 연동을 위해 API 키를 발급받을 수 있습니다. 키는 발급 시 1회만 표시되며 회사는 원본을 보관하지 않습니다. 키의 관리 책임은 이용자에게 있고, 유출이 의심되면 즉시 폐기해야 합니다. 키로 이루어진 호출은 이용자의 행위로 간주됩니다.</p>

<h2>제9조 (서비스 변경·중단)</h2>
<p>회사는 서비스 내용을 변경하거나 중단할 수 있으며, 중요한 변경은 사전에 공지합니다. 유료로 구매한 코인이 남은 상태에서 서비스가 종료되는 경우, 미사용 코인에 대해 환불합니다.</p>

<h2>제10조 (책임의 한계)</h2>
<p>회사는 천재지변, 외부 서비스(Google, AI 제공자, 결제사) 장애 등 회사의 통제를 벗어난 사유로 인한 손해에 책임지지 않습니다. 회사의 배상 책임은 해당 이용자가 최근 6개월간 지급한 금액을 한도로 합니다.</p>

<h2>제11조 (준거법·분쟁)</h2>
<p>이 약관은 대한민국 법을 따르며, 분쟁은 회사 소재지를 관할하는 법원을 제1심 관할로 합니다.</p>

<div class="en">
<strong>Summary (English).</strong> ${esc(COMPANY.serviceName)} fills Korean HWP form documents, edits HTML documents, generates slides, and publishes them to unlisted URLs. AI features are paid with "coins"; new accounts receive free coins. Payments are processed by ${esc(COMPANY.merchantOfRecord)} as Merchant of Record. You retain ownership of your documents. AI output may be inaccurate — verify before submitting. API keys are shown once and never stored; calls made with your key are treated as your actions. Governed by the laws of the Republic of Korea.
</div>`,

  refund: () => `
${pendingNotice()}
<p class="sub">디지털 재화인 코인의 환불 기준입니다. 결제는 ${esc(COMPANY.merchantOfRecord)}를 통해 이루어지므로, 환불도 해당 사업자를 통해 실행됩니다.</p>

<h2>1. 미사용 코인 — 14일 이내 전액 환불</h2>
<p>구매한 코인을 <strong>한 번도 사용하지 않은 경우</strong>, 결제일로부터 14일 이내에 요청하시면 전액 환불합니다. 별도의 사유를 밝히지 않으셔도 됩니다.</p>

<h2>2. 일부 사용한 경우</h2>
<p>코인을 일부 사용하셨다면 <strong>사용하지 않은 코인에 대해</strong> 결제일로부터 14일 이내에 비례 환불합니다. 이미 사용한 코인은 서비스가 제공된 것으로 보아 환불되지 않습니다.</p>
<table>
  <thead><tr><th>상황</th><th>환불 범위</th><th>기간</th></tr></thead>
  <tbody>
    <tr><td>전혀 사용하지 않음</td><td>전액</td><td>결제일로부터 14일</td></tr>
    <tr><td>일부 사용</td><td>미사용분 비례 환불</td><td>결제일로부터 14일</td></tr>
    <tr><td>전부 사용</td><td>환불 불가</td><td>—</td></tr>
    <tr><td>회사 장애로 기능 실패</td><td>차감 코인 자동 환원</td><td>즉시(자동)</td></tr>
    <tr><td>중복 결제·오결제</td><td>전액</td><td>기간 제한 없음</td></tr>
  </tbody>
</table>

<h2>3. 서비스 장애</h2>
<p>회사의 장애로 AI 기능이 실패한 경우, 차감된 코인은 <strong>자동으로 환원</strong>됩니다. 별도로 요청하지 않으셔도 됩니다. 환원이 되지 않았다면 아래 연락처로 알려주세요.</p>

<h2>4. 환불 요청 방법</h2>
<p><a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a> 로 결제하신 계정의 이메일 주소와 결제 일시를 알려주시면 됩니다. Paddle 결제 영수증에 있는 링크를 통해 직접 요청하실 수도 있습니다.</p>
<p>요청을 받은 날로부터 <strong>영업일 기준 5일 이내</strong>에 처리하며, 환불금은 결제 수단에 따라 추가로 5~10영업일이 소요될 수 있습니다.</p>

<h2>5. 서비스 종료 시</h2>
<p>회사 사정으로 서비스를 종료하는 경우, 남은 미사용 코인 전액을 환불합니다.</p>

<div class="en">
<strong>Refund Policy (English).</strong> Unused coins are fully refundable within 14 days of purchase, no reason required. If you have used some coins, the unused portion is refunded pro rata within the same period; consumed coins are not refundable as the service was delivered. Coins deducted for operations that failed due to our error are restored automatically. Duplicate or erroneous charges are refunded in full with no time limit. Requests: <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a>, or via the link on your Paddle receipt. Processed within 5 business days; funds may take a further 5–10 business days to appear.
</div>`,

  privacy: () => `
${pendingNotice()}
<h2>1. 수집하는 정보</h2>
<table>
  <thead><tr><th>구분</th><th>항목</th><th>수집 시점</th></tr></thead>
  <tbody>
    <tr><td>계정</td><td>이메일, 이름, 프로필 사진</td><td>Google 로그인 시</td></tr>
    <tr><td>이용 기록</td><td>기능별 사용 횟수, 코인 잔액·차감 내역, 마지막 접속일</td><td>서비스 이용 시</td></tr>
    <tr><td>콘텐츠</td><td>업로드한 문서, 생성된 문서·슬라이드</td><td>이용자가 저장·게시할 때</td></tr>
    <tr><td>결제</td><td>결제 금액, 결제 일시, 거래 ID</td><td>코인 구매 시</td></tr>
    <tr><td>API 키</td><td>키의 해시값, 이름, 마지막 사용 시각</td><td>키 발급 시</td></tr>
  </tbody>
</table>
<p>카드번호 등 결제 수단 정보는 회사가 수집하거나 보관하지 않습니다. 결제사(${esc(COMPANY.merchantOfRecord)})가 직접 처리합니다.</p>
<p>API 키는 <strong>원본을 저장하지 않고 해시값만</strong> 보관합니다. 데이터가 유출되더라도 키를 복원할 수 없습니다.</p>

<h2>2. 이용 목적</h2>
<ul>
  <li>서비스 제공 및 본인 확인</li>
  <li>코인 잔액 관리와 결제 처리</li>
  <li>장애 대응 및 이용 문의 응대</li>
  <li>부정 이용 방지</li>
</ul>

<h2>3. 제3자 제공 및 처리 위탁</h2>
<p>회사는 이용자의 개인정보를 판매하지 않습니다. 서비스 제공에 필요한 범위에서 다음 사업자에게 처리를 위탁합니다.</p>
<table>
  <thead><tr><th>수탁자</th><th>위탁 업무</th></tr></thead>
  <tbody>
    <tr><td>Google (Firebase, Cloud Storage)</td><td>인증, 데이터 저장, 서비스 운영</td></tr>
    <tr><td>Google (Gemini API)</td><td>AI 문서·슬라이드 생성</td></tr>
    <tr><td>${esc(COMPANY.merchantOfRecord)}</td><td>결제 처리, 영수증 발행, 환불</td></tr>
    <tr><td>Resend</td><td>안내 이메일 발송</td></tr>
  </tbody>
</table>
<p>이용자가 작성한 문서 내용은 AI 처리를 위해 Google Gemini API 로 전송됩니다. 전송된 내용은 응답 생성에만 사용됩니다.</p>

<h2>4. 보관 기간</h2>
<ul>
  <li>계정 정보: 회원 탈퇴 시까지</li>
  <li>문서·슬라이드: 이용자가 삭제할 때까지</li>
  <li>결제 기록: 관련 법령에 따라 5년</li>
  <li>API 키 해시: 폐기 또는 탈퇴 시까지</li>
</ul>

<h2>5. 이용자의 권리</h2>
<p>이용자는 자신의 개인정보 열람·정정·삭제·처리정지를 요구할 수 있습니다. 문서는 서비스 내에서 직접 삭제할 수 있고, 계정 삭제나 그 밖의 요청은 <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a> 로 알려주시면 처리합니다.</p>

<h2>6. 국외 이전</h2>
<p>서비스는 Google Cloud 의 미국 리전(us-central1)에서 운영됩니다. 위 항목들이 해당 지역에 저장·처리됩니다.</p>

<h2>7. 문의</h2>
<p>개인정보 관련 문의: <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a></p>

<div class="en">
<strong>Privacy Policy (English).</strong> We collect your Google account email, name and photo; usage records and coin balance; documents you save or publish; and payment metadata. We never see or store card details — ${esc(COMPANY.merchantOfRecord)} handles payments. API keys are stored as hashes only and cannot be recovered. Document content is sent to Google Gemini for AI processing and used only to generate the response. Processors: Google (Firebase/Cloud Storage/Gemini), ${esc(COMPANY.merchantOfRecord)}, Resend. Data is hosted in Google Cloud us-central1. You may request access, correction, deletion, or restriction at <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a>. We do not sell personal data.
</div>`,

  pricing: () => `
<p class="sub">가입하면 무료 코인이 지급됩니다. 코인이 떨어지면 필요한 만큼만 충전합니다. 구독이 아니라 <strong>일회성 결제</strong>입니다.</p>

<h2>코인 패키지</h2>
<table>
  <thead><tr><th>패키지</th><th>코인</th><th>가격 (USD)</th></tr></thead>
  <tbody>
    <tr><td>체험</td><td>1,000 coin</td><td>$10</td></tr>
    <tr><td>스타터</td><td>5,000 coin</td><td>$50</td></tr>
  </tbody>
</table>
<p>표시 가격에 부가세가 포함되지 않은 경우, 결제 시 거주 국가의 세율에 따라 추가될 수 있습니다. 정확한 금액은 결제창에서 확인하실 수 있습니다.</p>

<h2>무엇에 코인이 쓰이나</h2>
<p>AI 를 부르는 기능에만 코인이 차감됩니다. 문서 열람·편집·다운로드는 무료입니다.</p>
<ul>
  <li>AI 기획안 생성 · 문서 작성</li>
  <li>슬라이드 생성 및 수정</li>
  <li>한글 문서 AI 수정</li>
  <li>문서 공유 링크 생성</li>
</ul>
<p>기능별 정확한 차감량은 로그인 후 <strong>프로필 → 액션별 코인 비용 / 사용량</strong> 에서 확인할 수 있습니다. 회사의 장애로 기능이 실패하면 차감된 코인은 자동으로 환원됩니다.</p>

<h2>API 이용</h2>
<p>외부 AI 에이전트가 호출하는 <a href="${BASE}/ai">API</a> 도 같은 계정과 코인을 사용합니다. 별도 요금제가 없습니다.</p>

<h2>환불</h2>
<p>미사용 코인은 결제일로부터 14일 이내 전액 환불됩니다. 자세한 내용은 <a href="${BASE}/refund">환불정책</a>을 참고하세요.</p>

<div class="en">
<strong>Pricing (English).</strong> One-time purchases, not a subscription. Trial: 1,000 coins for $10. Starter: 5,000 coins for $50. New accounts receive free coins. Coins are consumed only by AI operations (planning, document and slide generation, HWP editing, share links); viewing, editing and downloading are free. Per-action costs are listed in your profile after signing in. Coins deducted for operations that failed on our side are restored automatically. Unused coins are fully refundable within 14 days — see <a href="${BASE}/refund">Refund Policy</a>. Taxes may be added at checkout based on your location.
</div>`,

  contact: () => `
${pendingNotice()}
<h2>사업자 정보</h2>
<table>
  <tbody>
    <tr><th>상호</th><td>${esc(COMPANY.legalName)}</td></tr>
    <tr><th>대표자</th><td>${esc(COMPANY.ceo)}</td></tr>
    <tr><th>사업장 주소</th><td>${esc(COMPANY.address)}</td></tr>
    <tr><th>사업자등록번호</th><td>${esc(COMPANY.regNo)}</td></tr>
    <tr><th>통신판매업 신고번호</th><td>${esc(COMPANY.mailOrderNo)}</td></tr>
    <tr><th>연락처</th><td>${esc(COMPANY.phone)}</td></tr>
    <tr><th>이메일</th><td><a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a></td></tr>
  </tbody>
</table>

<h2>문의</h2>
<p>이용 문의, 환불 요청, 개인정보 관련 문의는 모두 <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a> 로 보내주세요. 영업일 기준 2일 이내에 답변드립니다.</p>

<h2>결제 관련</h2>
<p>결제는 ${esc(COMPANY.merchantOfRecord)}가 판매자로서 처리합니다. 카드 명세서에는 해당 사업자명으로 표시될 수 있습니다. 영수증과 환불은 결제 시 받으신 이메일의 링크에서도 직접 처리하실 수 있습니다.</p>

<div class="en">
<strong>Contact (English).</strong> For support, refunds, or privacy requests, email <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a>. We reply within 2 business days. Payments are processed by ${esc(COMPANY.merchantOfRecord)} as Merchant of Record and may appear under that name on your statement.
</div>`,
};

function render(key) {
  const meta = PAGES[key];
  const nav = Object.entries(PAGES)
    .map(([k, v]) => `<a href="${BASE}/${k}"${k === key ? ' class="on"' : ''}>${v.title}</a>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)} · ${esc(COMPANY.serviceName)}</title>
<meta name="description" content="${esc(COMPANY.serviceName)} ${esc(meta.title)} (${esc(meta.titleEn)})">
<link rel="canonical" href="${BASE}/${key}">
<meta property="og:title" content="${esc(meta.title)} · ${esc(COMPANY.serviceName)}">
<meta property="og:url" content="${BASE}/${key}">
<meta property="og:type" content="article">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <nav><a href="${BASE}/">${esc(COMPANY.serviceName)}</a>${nav}</nav>
  <h1>${esc(meta.title)}</h1>
  <p class="sub">${esc(meta.titleEn)}</p>
  <p class="updated">최종 수정일 ${UPDATED}</p>
  ${BODY[key]()}
  <footer>
    ${esc(COMPANY.legalName)} · <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a><br>
    <a href="${BASE}/terms">이용약관</a> · <a href="${BASE}/refund">환불정책</a> ·
    <a href="${BASE}/privacy">개인정보처리방침</a> · <a href="${BASE}/pricing">요금</a> ·
    <a href="${BASE}/contact">연락처</a>
  </footer>
</div>
</body>
</html>`;
}

exports.legalPages = onRequest(
  { timeoutSeconds: 30, memory: '256MiB', cors: true },
  async (req, res) => {
    const key = (req.path.match(/\/(terms|refund|privacy|pricing|contact)\/?$/) || [])[1];
    if (!key) {
      res.status(404).send('Not found');
      return;
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600');
    res.status(200).send(render(key));
  }
);
