const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

// aidev-home 커뮤니티 수신 Edge Function URL + 공유 시크릿
const AIDEV_COMMUNITY_URL = defineSecret('AIDEV_COMMUNITY_URL');
const AIDEV_COMMUNITY_SECRET = defineSecret('AIDEV_COMMUNITY_SECRET');

const SUPER_ADMIN_EMAIL = 'tony@banya.ai';
const MAX_INPUT_BYTES = 1500 * 1024;

// publishToTechBlog 과 동일한 수퍼관리자 검증
async function isAuthorizedAdmin(authCtx) {
  if (!authCtx) return false;
  if (authCtx.token?.email === SUPER_ADMIN_EMAIL) return true;
  try {
    const snap = await admin.firestore().collection('userProfiles').doc(authCtx.uid).get();
    const profile = snap.data();
    return !!profile && profile.role === 'super_admin' && profile.status === 'approved';
  } catch (err) {
    console.error('userProfiles lookup failed:', err);
    return false;
  }
}

// 한국인공지능개발자 협동조합 커뮤니티 게시판에 문서를 게시한다.
//   · gdoc 수퍼관리자만 호출 가능
//   · aidev-home Edge Function(external-post)으로 공유 시크릿과 함께 전달
//   · 본문 정규화(스타일/스크립트 제거)는 수신측(aidev)에서 처리
exports.publishToCommunity = onCall(
  {
    secrets: [AIDEV_COMMUNITY_URL, AIDEV_COMMUNITY_SECRET],
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    if (!(await isAuthorizedAdmin(request.auth))) {
      throw new HttpsError('permission-denied', '수퍼관리자만 커뮤니티에 게시할 수 있습니다.');
    }

    const { html, name, sourceUrl, tags } = request.data || {};
    if (!html || typeof html !== 'string') {
      throw new HttpsError('invalid-argument', 'html 문자열이 필요합니다.');
    }
    const inputBytes = Buffer.byteLength(html, 'utf-8');
    if (inputBytes > MAX_INPUT_BYTES) {
      throw new HttpsError('invalid-argument', `문서가 너무 큽니다 (현재 ${(inputBytes / 1024).toFixed(0)}KB, 한도 ${MAX_INPUT_BYTES / 1024}KB).`);
    }

    const url = AIDEV_COMMUNITY_URL.value();
    const secret = AIDEV_COMMUNITY_SECRET.value();
    if (!url || !secret) {
      throw new HttpsError('failed-precondition', 'AIDEV_COMMUNITY_URL / AIDEV_COMMUNITY_SECRET 시크릿이 설정되지 않았습니다.');
    }

    let res, data;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-external-secret': secret },
        body: JSON.stringify({
          title: (name || '제목 없음').slice(0, 200),
          html,
          category: 'AI/LLM',
          tags: Array.isArray(tags) ? tags : undefined,
          source_url: sourceUrl || undefined,
        }),
      });
      data = await res.json().catch(() => ({}));
    } catch (err) {
      throw new HttpsError('internal', `커뮤니티 서버 호출 실패: ${err.message}`);
    }
    if (!res.ok || !data.ok) {
      throw new HttpsError('internal', `커뮤니티 게시 실패: ${data.error || `HTTP ${res.status}`}`);
    }

    return { url: data.url, topicId: data.topic_id };
  }
);
