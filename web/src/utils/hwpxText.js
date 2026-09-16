// 실제 구현은 functions/shared/hwpxText.mjs 에 있다 (프론트 + Cloud Functions 공유).
// HWPX 단락 추출/교체는 JSZip 만 쓰고 DOM 에 의존하지 않아 Node 에서도 그대로 돈다.
// 기존 import 경로(`../utils/hwpxText`)를 유지하기 위한 re-export.
export {
  extractParagraphsFromHwpx,
  applyParagraphsToHwpx,
} from '../../functions/shared/hwpxText.mjs';
