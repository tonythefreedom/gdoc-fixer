const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

const FROM = 'GDoc Fixer <noreply@banya.ai>';
// 실 발송 도메인 인증이 완료될 때까지 sandbox 도메인을 fallback 으로 사용 가능.
// 도메인 검증 후 FROM 을 자기 도메인으로 변경.

const ALLOWED_ORIGINS = [
  'https://gdoc-fixer.web.app',
  'https://gdoc-fixer.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
];

function setCors(req, res) {
  const origin = req.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

async function verifyUser(req) {
  const authHeader = req.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Authorization header missing');
  const decoded = await admin.auth().verifyIdToken(match[1]);
  return decoded;
}

function welcomeHtml({ displayName, kind }) {
  const greeting = displayName ? `${displayName} 님` : '회원';
  const headline = kind === 'admin-approve'
    ? `${greeting}, 가입이 승인되었습니다!`
    : `${greeting}, GDoc Fixer 에 오신 것을 환영합니다!`;
  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,'Noto Sans KR',sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="padding:28px 32px 0;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#a855f7);"></div>
            <span style="font-weight:700;font-size:16px;color:#0f172a;">GDoc Fixer</span>
          </div>
          <h1 style="margin:20px 0 8px;font-size:22px;line-height:1.35;">${headline}</h1>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
            HTML 문서 편집 · AI 슬라이드 생성 · 한글(HWP) 작성 · 자동 번역 게시까지 한 곳에서.
            가입 보너스로 <strong>2,000 코인</strong>이 이미 지급되었습니다.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:12px;">
            <tr><td style="padding:18px;">
              <div style="font-size:12px;color:#4338ca;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">시작하기</div>
              <ul style="margin:10px 0 0;padding-left:18px;color:#1e293b;font-size:13px;line-height:1.7;">
                <li>「새 파일」 또는 「HWP 가져오기」 로 문서 시작</li>
                <li>채팅창에 자연어 지시 입력 → AI 자동 수정</li>
                <li>「슬라이드 생성」 → 16:9 슬라이드 deck 자동 변환</li>
                <li>「공유 링크」 → 인증 없이 외부 공유</li>
              </ul>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 28px;" align="center">
          <a href="https://gdoc-fixer.web.app" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
            지금 시작하기
          </a>
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#94a3b8;font-size:11px;line-height:1.6;">
          한국인공지능개발자 협동조합 · 서울시 강남구 삼성로 86길 16 덕산빌딩 5층<br>
          문의: <a href="mailto:tonymustbegreat@gmail.com" style="color:#6366f1;">tonymustbegreat@gmail.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

exports.welcomeEmail = onRequest(
  { secrets: [RESEND_API_KEY], cors: false },
  async (req, res) => {
    setCors(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const decoded = await verifyUser(req);
      const callerUid = decoded.uid;
      const callerEmail = decoded.email;
      const { kind = 'signup', targetUid, targetEmail, targetName } = req.body || {};

      // 수신자 결정
      let to;
      let displayName;
      if (kind === 'admin-approve') {
        // super_admin 만 호출 가능
        const callerProfile = await admin.firestore().collection('userProfiles').doc(callerUid).get();
        if (callerProfile.data()?.role !== 'super_admin') {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
        if (!targetEmail) {
          res.status(400).json({ error: 'targetEmail required' });
          return;
        }
        to = targetEmail;
        displayName = targetName || '';
      } else {
        // signup — 본인에게
        to = callerEmail;
        // 본인 프로필에서 displayName 가져옴
        const callerProfile = await admin.firestore().collection('userProfiles').doc(callerUid).get();
        displayName = callerProfile.data()?.displayName || '';
      }

      if (!to) {
        res.status(400).json({ error: 'recipient email missing' });
        return;
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY.value()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: [to],
          subject: kind === 'admin-approve'
            ? 'GDoc Fixer — 가입 승인 완료'
            : 'GDoc Fixer — 가입 환영',
          html: welcomeHtml({ displayName, kind }),
        }),
      });
      if (!resendRes.ok) {
        const text = await resendRes.text();
        console.error('Resend send failed:', resendRes.status, text);
        res.status(502).json({ error: `Resend failed (${resendRes.status})` });
        return;
      }
      const data = await resendRes.json();
      res.status(200).json({ ok: true, id: data.id });
    } catch (err) {
      console.error('welcomeEmail error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
);
