/**
 * 사용자별 API 키 발급·조회·폐기.
 *
 * 외부 AI(Claude/ChatGPT/Gemini/Grok)가 사용자를 대신해 API 를 호출할 때 쓰는 자격증명이다.
 *
 * 저장 방식: 원본 키는 **어디에도 저장하지 않는다.** SHA-256 해시를 문서 ID 로 쓰고,
 * 발급 순간에만 원본을 돌려준다. DB 가 유출돼도 키를 복원할 수 없고,
 * 검증은 해시 한 번으로 끝나므로 조회도 빠르다(쿼리 없이 doc get).
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');

const COLLECTION = 'apiKeys';
const KEY_PREFIX = 'gdk_';
const MAX_KEYS_PER_USER = 10;

const db = () => admin.firestore();

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** 화면에 보여줄 식별용 조각. 원본을 되살릴 수는 없다. */
function maskOf(key) {
  return `${key.slice(0, 12)}…${key.slice(-4)}`;
}

function requireAuth(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

/**
 * 키를 검증해 소유자 uid 를 돌려준다. 다른 함수(HTTP 엔드포인트)가 쓴다.
 * @returns {Promise<{uid: string, keyHash: string, name: string} | null>}
 */
async function resolveApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;
  const keyHash = hashKey(rawKey);
  const snap = await db().collection(COLLECTION).doc(keyHash).get();
  if (!snap.exists) return null;
  const d = snap.data();
  if (d.revoked) return null;

  // 마지막 사용 시각 기록 — 실패해도 호출을 막지 않는다(부가 정보일 뿐).
  snap.ref
    .update({ lastUsedAt: admin.firestore.FieldValue.serverTimestamp() })
    .catch(() => {});

  return { uid: d.uid, keyHash, name: d.name || '' };
}

exports.resolveApiKey = resolveApiKey;

/** 새 API 키 발급 — 원본은 이 응답에서만 볼 수 있다. */
exports.createApiKey = onCall({ timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
  const uid = requireAuth(request);
  const name = String(request.data?.name || '').slice(0, 60) || '이름 없는 키';

  const existing = await db().collection(COLLECTION).where('uid', '==', uid).get();
  const active = existing.docs.filter((d) => !d.data().revoked);
  if (active.length >= MAX_KEYS_PER_USER) {
    throw new HttpsError(
      'resource-exhausted',
      `키는 최대 ${MAX_KEYS_PER_USER}개까지 만들 수 있습니다. 쓰지 않는 키를 폐기해주세요.`
    );
  }

  const key = KEY_PREFIX + crypto.randomBytes(24).toString('hex');
  const keyHash = hashKey(key);

  await db().collection(COLLECTION).doc(keyHash).set({
    uid,
    name,
    mask: maskOf(key),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsedAt: null,
    revoked: false,
  });

  console.log(`[apiKeys] 발급 uid=${uid} name=${name}`);
  // key 는 여기서만 노출된다. 다시 볼 수 없다고 클라이언트에 분명히 알린다.
  return { key, mask: maskOf(key), name, keyId: keyHash };
});

/** 내 키 목록 — 원본 키는 포함되지 않는다. */
exports.listApiKeys = onCall({ timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
  const uid = requireAuth(request);
  const snap = await db().collection(COLLECTION).where('uid', '==', uid).get();

  const keys = snap.docs
    .map((d) => {
      const v = d.data();
      return {
        keyId: d.id,
        name: v.name || '',
        mask: v.mask || '',
        revoked: !!v.revoked,
        createdAt: v.createdAt?.toMillis?.() ?? null,
        lastUsedAt: v.lastUsedAt?.toMillis?.() ?? null,
      };
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return { keys };
});

/** 키 폐기 — 되돌릴 수 없다. */
exports.revokeApiKey = onCall({ timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
  const uid = requireAuth(request);
  const keyId = String(request.data?.keyId || '');
  if (!keyId) throw new HttpsError('invalid-argument', 'keyId 가 필요합니다.');

  const ref = db().collection(COLLECTION).doc(keyId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '키를 찾을 수 없습니다.');
  // 남의 키를 지우지 못하게 소유자를 확인한다.
  if (snap.data().uid !== uid) {
    throw new HttpsError('permission-denied', '본인의 키만 폐기할 수 있습니다.');
  }

  await ref.update({
    revoked: true,
    revokedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`[apiKeys] 폐기 uid=${uid} keyId=${keyId.slice(0, 12)}…`);
  return { ok: true };
});
