const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

// LinkedIn 조직 페이지 게시용 자격증명
//   LINKEDIN_ACCESS_TOKEN : w_organization_social 권한의 액세스 토큰
//   LINKEDIN_ORG_URN      : 조직 URN (예: urn:li:organization:12345678)
// 두 시크릿이 없으면 게시를 건너뛰고 { skipped:true } 를 반환한다(체인 부분 성공).
const LINKEDIN_ACCESS_TOKEN = defineSecret('LINKEDIN_ACCESS_TOKEN');
const LINKEDIN_ORG_URN = defineSecret('LINKEDIN_ORG_URN');

const SUPER_ADMIN_EMAIL = 'tony@banya.ai';

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

// 커뮤니티 글을 LinkedIn 조직 페이지에 연쇄 게시한다.
//   · gdoc 수퍼관리자만 호출 가능
//   · 출처(링크)는 원문이 아니라 직전 체인 사이트(커뮤니티 글 URL)
//   · 자격증명 미설정 시 { skipped:true } 로 우아하게 종료
exports.publishToLinkedIn = onCall(
  {
    secrets: [LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORG_URN],
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    if (!(await isAuthorizedAdmin(request.auth))) {
      throw new HttpsError('permission-denied', '수퍼관리자만 게시할 수 있습니다.');
    }

    const { title, url } = request.data || {};
    if (!url || typeof url !== 'string') {
      throw new HttpsError('invalid-argument', 'url(커뮤니티 글 링크)이 필요합니다.');
    }

    const token = LINKEDIN_ACCESS_TOKEN.value();
    const orgUrn = LINKEDIN_ORG_URN.value();
    // 아직 자격증명이 없으면 체인을 막지 않고 건너뛴다. (Secret Manager는 빈 값을 허용하지
    // 않으므로 미설정 상태를 센티널 'UNSET' 으로 표현한다.)
    const unset = (v) => !v || v === 'UNSET';
    if (unset(token) || unset(orgUrn)) {
      return { skipped: true, reason: 'LinkedIn 자격증명(LINKEDIN_ACCESS_TOKEN/LINKEDIN_ORG_URN) 미설정' };
    }

    const commentary = `${(title || '새 글').slice(0, 180)}\n\n${url}`;

    // LinkedIn Posts API (조직 페이지 게시)
    let res, body;
    try {
      res = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202401',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: orgUrn,
          commentary,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      });
    } catch (err) {
      throw new HttpsError('internal', `LinkedIn 호출 실패: ${err.message}`);
    }

    if (res.status !== 201 && res.status !== 200) {
      body = await res.text().catch(() => '');
      throw new HttpsError('internal', `LinkedIn 게시 실패 (HTTP ${res.status}): ${body.slice(0, 300)}`);
    }

    // 생성된 게시물 URN → 피드 URL
    const postUrn = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || '';
    const postUrl = postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : 'https://www.linkedin.com/';
    return { url: postUrl, urn: postUrn };
  }
);
