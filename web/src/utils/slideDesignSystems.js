// 실제 구현은 functions/shared/slideDesignSystems.mjs 에 있다 (프론트 + Cloud Functions 공유).
// 순수 상수·함수라 Node 에서도 그대로 동작한다. 게시 API 가 디자인 규칙을 외부 AI 에게
// 내려주려면 서버에서도 같은 정의를 읽어야 하므로 옮겼다.
export * from '../../functions/shared/slideDesignSystems.mjs';
