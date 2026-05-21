/**
 * 텍스트 유사도 기반 검색.
 * - 4-gram 토큰화 + 코사인 유사도
 * - 짧은 쿼리(<4글자)는 n 을 자동 축소
 * - 부분 문자열 정확 매칭은 추가 boost
 *
 * 한국어 자모 결합 단위로도 동작하도록 NFC 정규화 후 처리한다.
 */

const N_DEFAULT = 4;

/**
 * 문자열을 정규화: 소문자화, NFC 결합, 공백 제거.
 */
function normalize(text) {
  if (typeof text !== 'string') return '';
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, '');
}

/**
 * n-gram 토큰 배열을 생성한다.
 * 텍스트 길이가 n 보다 짧으면 텍스트 전체를 단일 토큰으로 사용한다.
 */
export function ngrams(text, n = N_DEFAULT) {
  const t = normalize(text);
  if (t.length === 0) return [];
  if (t.length < n) return [t];
  const grams = [];
  for (let i = 0; i <= t.length - n; i++) {
    grams.push(t.slice(i, i + n));
  }
  return grams;
}

/**
 * n-gram 배열을 빈도 벡터(Map)로 변환.
 */
function toFreq(grams) {
  const m = new Map();
  for (const g of grams) m.set(g, (m.get(g) || 0) + 1);
  return m;
}

/**
 * 두 빈도 벡터의 코사인 유사도 (0..1).
 */
function cosineFromFreq(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let normA = 0;
  for (const [k, va] of a) {
    normA += va * va;
    const vb = b.get(k);
    if (vb !== undefined) dot += va * vb;
  }
  let normB = 0;
  for (const vb of b.values()) normB += vb * vb;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 쿼리와 대상 텍스트의 유사도 점수 (0..2 범위).
 * - 4-gram 코사인 유사도 (0..1)
 * - 정확한 부분 문자열 매칭 시 +1.0 boost (오타가 없을 때 우선)
 *
 * 쿼리 길이가 짧을 경우 n 을 자동 축소하여 매칭률을 높인다.
 */
export function similarityScore(query, target) {
  const q = normalize(query);
  const t = normalize(target);
  if (!q || !t) return 0;

  // 짧은 쿼리에 맞춰 n 축소 (1~4 사이)
  const n = Math.max(1, Math.min(N_DEFAULT, q.length));

  const qGrams = toFreq(ngrams(q, n));
  const tGrams = toFreq(ngrams(t, n));
  const cosine = cosineFromFreq(qGrams, tGrams);

  const substringBoost = t.includes(q) ? 1.0 : 0;
  return cosine + substringBoost;
}

/**
 * 항목 배열을 쿼리로 필터링·정렬한다.
 * @param items - 검색 대상 배열
 * @param query - 검색 키워드
 * @param getText - 각 item 에서 검색 대상 텍스트를 뽑는 함수
 * @param minScore - 이 점수 이하는 제외 (기본 0.05)
 */
export function filterAndRank(items, query, getText, minScore = 0.05) {
  const q = (query || '').trim();
  if (!q) return items.slice();
  const scored = items
    .map((item) => ({ item, score: similarityScore(q, getText(item)) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.item);
}
