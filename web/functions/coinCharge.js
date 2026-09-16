/**
 * 서버 측 코인 차감.
 *
 * 프론트의 chargeCoin 은 read-then-write 라 동시 호출에 취약하다(코드 주석에도 그 점이
 * 적혀 있다). API 는 외부 에이전트가 병렬로 두드릴 수 있으므로 **트랜잭션**으로 처리한다.
 * 잔액 확인과 차감이 한 원자 연산 안에서 일어나 음수 잔액이 생기지 않는다.
 *
 * 비용표는 프론트 UI 와 같은 파일(shared/actionCosts.mjs)을 본다. 프로필 화면의
 * "액션별 코인 비용" 표와 실제 차감이 어긋나지 않게 하기 위해서다.
 */
const admin = require('firebase-admin');

const db = () => admin.firestore();

class InsufficientCoin extends Error {
  constructor(have, need, action) {
    super(`코인이 부족합니다. 보유 ${have}, 필요 ${need} (${action})`);
    this.name = 'InsufficientCoin';
    this.have = have;
    this.need = need;
    this.action = action;
  }
}

async function costOf(action) {
  const { ACTION_COSTS } = await import('./shared/actionCosts.mjs');
  return ACTION_COSTS[action];
}

/**
 * 코인을 차감한다.
 *
 * @param {string|null} uid 사용자. null 이면(운영 공유 키) 차감하지 않는다.
 * @param {string} action shared/actionCosts.mjs 의 키
 * @returns {Promise<{charged: boolean, cost: number, balanceAfter?: number}>}
 * @throws {InsufficientCoin} 잔액 부족
 */
async function chargeCoin(uid, action) {
  if (!uid) return { charged: false, cost: 0 }; // 운영 공유 키

  const cost = await costOf(action);
  if (cost === undefined) {
    console.warn(`[coin] 알 수 없는 action: ${action} — 차감하지 않음`);
    return { charged: false, cost: 0 };
  }
  if (cost === 0) return { charged: false, cost: 0 }; // 무료 액션

  const ref = db().collection('userProfiles').doc(uid);

  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      // 프로필이 없으면 차감할 대상이 없다. 호출을 막기보다 통과시키고 기록만 남긴다.
      console.warn(`[coin] 프로필 없음: ${uid}`);
      return { charged: false, cost };
    }
    const balance = typeof snap.data().coinBalance === 'number' ? snap.data().coinBalance : 0;
    if (balance < cost) throw new InsufficientCoin(balance, cost, action);

    tx.update(ref, {
      coinBalance: admin.firestore.FieldValue.increment(-cost),
      coinSpent: admin.firestore.FieldValue.increment(cost),
      lastSpentAt: admin.firestore.FieldValue.serverTimestamp(),
      [`spendByAction.${action}`]: admin.firestore.FieldValue.increment(cost),
    });
    return { charged: true, cost, balanceAfter: balance - cost };
  });
}

/**
 * 차감을 되돌린다. 작업이 실패했는데 코인만 빠지는 일을 막는다.
 * 환불 실패가 원래 오류를 덮지 않도록 throw 하지 않는다.
 */
async function refundCoin(uid, action) {
  if (!uid) return;
  const cost = await costOf(action);
  if (!cost) return;
  try {
    await db().collection('userProfiles').doc(uid).update({
      coinBalance: admin.firestore.FieldValue.increment(cost),
      coinSpent: admin.firestore.FieldValue.increment(-cost),
      [`spendByAction.${action}`]: admin.firestore.FieldValue.increment(-cost),
    });
    console.log(`[coin] 환불 ${cost} (${action}) → ${uid}`);
  } catch (err) {
    console.error(`[coin] 환불 실패 ${action} ${uid}: ${err.message}`);
  }
}

/** 잔액 부족을 402 로 응답한다. 인증 실패(401)와 구분되어야 한다. */
function sendInsufficient(res, err) {
  res.status(402).json({
    ok: false,
    error: err.message,
    code: 'insufficient_coin',
    have: err.have,
    need: err.need,
    action: err.action,
    topUpUrl: 'https://docs.prototypebench.org/pricing',
  });
}

module.exports = { chargeCoin, refundCoin, InsufficientCoin, sendInsufficient };
