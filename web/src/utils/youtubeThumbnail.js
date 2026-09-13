// 실제 구현은 functions/shared/youtubeThumbnail.mjs 에 있다 (프론트 + Cloud Functions 공유).
// 기존 import 경로(`./youtubeThumbnail`)를 유지하기 위한 re-export 셈.
export { patchYoutubeThumbnails } from '../../functions/shared/youtubeThumbnail.mjs';
