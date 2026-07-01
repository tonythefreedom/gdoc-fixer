import {
  doc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

// 액션별 코인 비용 — 100 coin = $1. Gemini 2.5 Pro/Flash-Image API 실비
// 대비 약 2~3배 마진 (실비 변동/이미지 첨부 가변성 흡수).
export const ACTION_COSTS = Object.freeze({
  // LLM 없음 — UX 명목 비용
  createDoc: 1,             // HTML 문서 신규 생성
  shareDoc: 2,              // HTML 공유 링크 발급
  sharePresentation: 1,     // 프리젠테이션 공유 링크 발급
  exportDoc: 2,             // 내보내기 (PDF/PPTX/DOCX/HTML)

  // LLM 사용 — 실비 기반
  modifyDoc: 80,            // HTML 문서 AI 업데이트
  generateSlides: 350,      // HTML → 슬라이드 deck 변환
  modifySlide: 30,          // 슬라이드 1 장 AI 수정
  modifyAllSlides: 200,     // 슬라이드 deck 일괄 수정 (블릿 정렬 포함)
  insertSlide: 30,          // 슬라이드 앞/뒤 삽입
  fixSlideViewport: 15,     // 슬라이드 viewport 자동 수정
  modifyHwpText: 80,        // HWP 본문 AI 수정
  publishTechBlog: 600,     // tech-blog 자동 번역 게시
  researchAndPlan: 300,     // AI 기획안 생성
});

export const ACTION_LABELS = Object.freeze({
  createDoc: 'HTML 문서 생성',
  modifyDoc: 'HTML AI 수정',
  shareDoc: 'HTML 공유 링크',
  generateSlides: '슬라이드 deck 생성',
  sharePresentation: '슬라이드 공유 링크',
  exportDoc: '내보내기 (PDF/PPTX/DOCX/HTML)',
  modifySlide: '슬라이드 1 장 수정',
  modifyAllSlides: '슬라이드 deck 일괄 수정',
  insertSlide: '슬라이드 앞/뒤 삽입',
  fixSlideViewport: '슬라이드 viewport 자동 수정',
  modifyHwpText: 'HWP 본문 AI 수정',
  publishTechBlog: 'tech-blog 자동 번역 게시',
  researchAndPlan: 'AI 기획안 생성',
});

export const INITIAL_COIN_GRANT = 2000;

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
 * chargeCoin 의 역연산 — 작업 실패 시 차감된 코인을 사용자에게 환불.
 * coinBalance 증가 + coinSpent / spendByAction 감소.
 */
export async function refundCoin(uid, action) {
  if (!uid) return null;
  const cost = ACTION_COSTS[action];
  if (cost === undefined) {
    console.warn(`[refundCoin] unknown action: ${action}`);
    return null;
  }
  const profileRef = doc(db, 'userProfiles', uid);
  await updateDoc(profileRef, {
    coinBalance: increment(cost),
    coinSpent: increment(-cost),
    [`spendByAction.${action}`]: increment(-cost),
  });
  return { refunded: cost };
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
