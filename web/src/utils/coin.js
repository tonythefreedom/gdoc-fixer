import {
  doc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

// 액션별 코인 비용 — 한 곳에서만 정의해서 UI / 차감 로직이 동기화되게 함.
export const ACTION_COSTS = Object.freeze({
  createDoc: 10, // HTML 문서 신규 생성
  modifyDoc: 1, // HTML 문서 AI 업데이트
  shareDoc: 2, // HTML 문서 공유 링크 발급
  generateSlides: 20, // HTML → 슬라이드 deck 변환
  sharePresentation: 1, // 프리젠테이션 공유 링크 발급
  exportDoc: 2, // 어떤 형식이든 내보내기 (PDF/PPTX/DOCX/HTML)
});

export const ACTION_LABELS = Object.freeze({
  createDoc: 'HTML 문서 생성',
  modifyDoc: 'HTML 문서 업데이트',
  shareDoc: 'HTML 문서 공유',
  generateSlides: '프리젠테이션 변환',
  sharePresentation: '프리젠테이션 공유',
  exportDoc: '내보내기',
});

export const INITIAL_COIN_GRANT = 100;

export class InsufficientCoinError extends Error {
  constructor(have, need) {
    super(`코인이 부족합니다. (보유 ${have} / 필요 ${need})`);
    this.name = 'InsufficientCoinError';
    this.have = have;
    this.need = need;
  }
}

/**
 * 지정 action 의 코인을 사용자 프로필에서 차감하고 잔액 부족 시 throw.
 * - 잔액이 부족하면 InsufficientCoinError.
 * - 정상 차감 시 { cost, balanceAfter } 반환.
 * - uid 가 없으면 (인증 안 됨) silently skip — 호출측이 정상 흐름 진행.
 *
 * 주의: 클라이언트 측 차감이라 정밀하지는 않다. v2 에서 Cloud Function 으로
 * 옮겨 race condition / 위변조에 더 강하게 만들 여지가 있다.
 */
export async function chargeCoin(uid, action) {
  if (!uid) return null;
  const cost = ACTION_COSTS[action];
  if (cost === undefined) {
    console.warn(`[chargeCoin] unknown action: ${action}`);
    return null;
  }

  const profileRef = doc(db, 'userProfiles', uid);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) {
    console.warn('[chargeCoin] profile not found:', uid);
    return null;
  }
  const profile = snap.data();
  const balance = typeof profile.coinBalance === 'number' ? profile.coinBalance : 0;
  if (balance < cost) {
    throw new InsufficientCoinError(balance, cost);
  }

  await updateDoc(profileRef, {
    coinBalance: increment(-cost),
    coinSpent: increment(cost),
    lastSpentAt: serverTimestamp(),
    [`spendByAction.${action}`]: increment(cost),
  });
  return { cost, balanceAfter: balance - cost };
}

/**
 * 잔액만 빠르게 조회.
 */
export async function getCoinBalance(uid) {
  if (!uid) return 0;
  const snap = await getDoc(doc(db, 'userProfiles', uid));
  if (!snap.exists()) return 0;
  const d = snap.data();
  return typeof d.coinBalance === 'number' ? d.coinBalance : 0;
}

/**
 * 프로필 실시간 구독 — UI 잔액 표시 동기화용.
 */
export function subscribeProfile(uid, callback) {
  if (!uid) return () => {};
  const profileRef = doc(db, 'userProfiles', uid);
  return onSnapshot(
    profileRef,
    (snap) => {
      if (!snap.exists()) return;
      callback({ id: snap.id, ...snap.data() });
    },
    (err) => {
      console.error('[subscribeProfile] failed:', err);
    }
  );
}
