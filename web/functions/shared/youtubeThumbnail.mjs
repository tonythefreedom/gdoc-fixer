/**
 * YouTube의 maxresdefault.jpg 는 HD 영상에만 존재하므로 표준화질 영상에서 404 가 발생한다.
 * 모든 HTML 출력 경로(LLM 응답, Firestore 로드본, 미리보기 iframe srcDoc 등)에서
 * idempotent 하게 호출하여 <img onerror=...> fallback 을 자동 주입한다.
 *
 * - <img src="https://img.youtube.com/vi/{ID}/maxresdefault.jpg"> 패턴 매칭
 * - 이미 onerror 가 있으면 skip (idempotent)
 * - 문자열·배열 모두 지원
 */
export function patchYoutubeThumbnails(input) {
  if (Array.isArray(input)) return input.map(patchYoutubeThumbnails);
  if (typeof input !== 'string' || !input.includes('maxresdefault.jpg')) return input;
  return input.replace(
    /<img\b([^>]*?)\bsrc\s*=\s*(["'])(https?:\/\/img\.youtube\.com\/vi\/([A-Za-z0-9_-]+)\/maxresdefault\.jpg)\2([^>]*)>/gi,
    (match, before, q, fullUrl, videoId, after) => {
      if (/\bonerror\s*=/i.test(match)) return match;
      const fallback = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      return `<img${before}src=${q}${fullUrl}${q} onerror="this.onerror=null;this.src='${fallback}';"${after}>`;
    },
  );
}
