# 블로그 작성 에이전트 API

외부 시스템이 **Markdown 원고를 보내면** 기획안 작성 → 디자인 → 번역을 거쳐
[tech-blog](https://tony.banya.ai) 에 자동 게시한다. 옵션에 따라 커뮤니티(dev.prototypebench.org)와
LinkedIn 조직 페이지까지 연쇄 게시한다.

gdoc-fixer 프론트엔드에서 사람이 직접 기획안을 만들 때와 **완전히 같은 프롬프트**
(`functions/shared/planningPrompts.mjs`)를 쓰기 때문에, 어느 경로로 올라간 글이든 같은 디자인 규칙을 따른다.

---

## 엔드포인트

| 메서드 | 경로 | 용도 |
|--------|------|------|
| `POST` | `https://gdoc-fixer.web.app/api/blog/publish` | 원고 접수 |
| `GET`  | `https://gdoc-fixer.web.app/api/blog/jobs/{jobId}` | 진행 상황 조회 |

인증은 두 방식 모두 지원한다. 헤더에 키를 실어 보낸다.

```
x-api-key: <BLOG_AGENT_API_KEY>
# 또는
Authorization: Bearer <BLOG_AGENT_API_KEY>
```

## 접수 — POST /api/blog/publish

게시는 5~20분이 걸리는 반면 Firebase Hosting 을 경유한 호출은 60초에서 끊긴다.
그래서 접수와 처리를 분리했다. 이 엔드포인트는 job 을 만들고 워커를 깨운 뒤 응답을 기다리지 않고
**즉시 202** 로 답한다. 워커(`blogAgentWorker`)는 rewrite 에 걸려 있지 않은 별도 HTTP 함수이며
같은 API 키로 보호된다. queued → running 전환을 트랜잭션으로 선점하므로 호출이 겹쳐도 한 번만 실행된다.

### 요청

`Content-Type: application/json` 으로 보내는 것이 기본이다.

```json
{
  "markdown": "# 제목\n\n본문...",
  "title": "선택 — 생략하면 기획안이 뽑은 제목을 쓴다",
  "mode": "custom",
  "template": "custom",
  "generateImages": true,
  "chain": true,
  "tags": ["AI", "RAG"],
  "callbackUrl": "https://example.com/hooks/blog-published",
  "client": "my-writer-bot"
}
```

| 필드 | 기본값 | 설명 |
|------|--------|------|
| `markdown` | (필수) | 원고 본문. 마크다운 표·코드펜스·강조 모두 HTML 로 변환된다. 최대 400KB |
| `title` | 기획안 제목 | 제목을 직접 지정 |
| `mode` | `custom` | `custom` = 원문을 한 글자도 바꾸지 않고 디자인만 입힌다.<br>`research` = Google 검색으로 주제를 조사해 내용을 보강·재구성한다 |
| `template` | `custom` | `research` 모드의 문서 틀. `custom` / `business_plan` / `company_intro` / `product_intro` |
| `generateImages` | `true` | 기획안이 뽑은 이미지 설명으로 삽화를 생성해 본문에 배치한다. `false` 면 원고에 있는 이미지만 쓴다 |
| `chain` | `true` | tech-blog 게시 후 커뮤니티 → LinkedIn 까지 연쇄 게시 |
| `tags` | — | 커뮤니티 게시글 태그 (최대 10개) |
| `callbackUrl` | — | 완료·실패 시 결과를 POST 로 통지받을 https URL |
| `client` | `api` | 호출자 식별용 라벨. 게시 문서의 `publishedBy` 에 기록된다 |

원고만 통째로 보내는 것도 된다. 이때 옵션은 쿼리스트링으로 준다.

```bash
curl -X POST "https://gdoc-fixer.web.app/api/blog/publish?generateImages=false" \
  -H "x-api-key: $BLOG_AGENT_API_KEY" \
  -H "Content-Type: text/markdown" \
  --data-binary @article.md
```

### 응답 (202)

```json
{
  "ok": true,
  "jobId": "8fK2mQ...",
  "status": "queued",
  "statusUrl": "https://gdoc-fixer.web.app/api/blog/jobs/8fK2mQ...",
  "message": "접수되었습니다. 게시까지 보통 5~20분 걸립니다."
}
```

오류는 `400`(원고 누락/초과), `401`(인증 실패), `405`(POST 외 메서드)로 돌아온다.

## 상태 조회 — GET /api/blog/jobs/{jobId}

```bash
curl -H "x-api-key: $BLOG_AGENT_API_KEY" \
  https://gdoc-fixer.web.app/api/blog/jobs/8fK2mQ...
```

```json
{
  "ok": true,
  "jobId": "8fK2mQ...",
  "status": "succeeded",
  "step": "done",
  "result": {
    "techBlogId": "choosing-a-vector-database-a1b2c3",
    "techBlogUrl": "https://tony.banya.ai/report/choosing-a-vector-database-a1b2c3",
    "titles": { "ko": "벡터 데이터베이스 선택 가이드", "en": "Choosing a Vector Database" },
    "seoDispatched": true,
    "communityUrl": "https://dev.prototypebench.org/community/...",
    "linkedInUrl": null,
    "linkedInSkipped": true
  }
}
```

`status` 는 `queued` → `running` → `succeeded` | `failed` 로 흐른다.
`running` 동안 `step` 이 아래 순서로 바뀌므로 진행률 표시에 쓸 수 있다.

```
planning → generating-images → composing → uploading-images
  → inlining-styles → publishing-techblog → publishing-community → publishing-linkedin → done
```

`callbackUrl` 을 줬다면 완료 시 같은 형태의 JSON 이 그 URL 로 POST 된다.

## 처리 파이프라인

1. **기획안 작성** — `custom` 은 원문을 섹션으로만 정리하고, `research` 는 Google 검색으로 조사한다.
2. **이미지 생성** — 기획안이 뽑은 설명으로 삽화를 만든다(병렬, 실패분은 건너뛴다).
3. **HTML 조립** — 표지·목차·섹션 구분이 있는 문서로 디자인한다.
4. **이미지 업로드** — 생성된 data URI 를 GCS 로 옮긴다(Firestore 문서 한도 회피).
5. **스타일 인라인화** — Tailwind 클래스를 인라인 `style=""` 로 굽는다.
   tech-blog 와 커뮤니티는 class 와 `<style>` 을 제거하므로 이 단계가 없으면 디자인이 전부 사라진다.
6. **tech-blog 게시** — 영문 자동 번역 + 메타데이터 추출 + Firestore 저장 + SEO 정적 페이지 빌드 트리거.
7. **연쇄 게시** — 커뮤니티(출처=tech-blog 글) → LinkedIn(출처=커뮤니티 글).

6번까지 성공했다면 7번이 실패해도 job 은 `succeeded` 로 끝나고, 실패 사유가 `result.communityError` /
`result.linkedInError` 에 남는다. tech-blog 게시를 되돌리지 않기 위한 의도적인 설계다.

## 운영

### 시크릿

```bash
cd gdoc-fixer/web

# 외부 클라이언트 인증 키 — 쉼표로 여러 개를 넣으면 모두 허용된다(무중단 교체용)
npx firebase functions:secrets:set BLOG_AGENT_API_KEY

# 이미 쓰고 있는 것들 (에이전트도 같은 값을 쓴다)
#   GEMINI_API_KEY, TECH_BLOG_SERVICE_ACCOUNT, GITHUB_DISPATCH_TOKEN,
#   GCS_BUCKET, GCS_SA_EMAIL, GCS_PRIVATE_KEY,
#   AIDEV_COMMUNITY_URL, AIDEV_COMMUNITY_SECRET,
#   LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORG_URN
```

### 배포

```bash
cd gdoc-fixer/web
npx firebase deploy --only functions:blogAgentPublish,functions:blogAgentWorker,functions:blogAgentStatus
npx firebase deploy --only hosting    # /api/blog/* rewrite 반영
npx firebase deploy --only firestore:rules
```

### 제한

| 항목 | 값 |
|------|-----|
| 원고 크기 | 400KB |
| 게시 HTML | 1.5MB (초과 시 `invalid-argument`) |
| 워커 실행 시간 | 최대 60분 (2GiB, 동시 3건). 초과하면 job 이 `running` 인 채로 끊긴다 |
| 작업 큐 | Firestore `blogAgentJobs` — 원고 전문이 담기므로 클라이언트 접근 전면 차단 |

### 실패 시 확인 순서

1. `GET /api/blog/jobs/{jobId}` 의 `error` 와 마지막 `step`.
2. `step: planning` 실패 → 원고가 너무 길거나 JSON 파싱 실패. 원고를 줄여 재시도.
3. `step: publishing-techblog` 실패 → `TECH_BLOG_SERVICE_ACCOUNT` 권한 또는 문서 크기 한도.
4. `seoDispatched: false` → `GITHUB_DISPATCH_TOKEN` 미설정. Firestore 저장은 됐지만
   `dist/report/{id}/index.html` 이 갱신되지 않아 SNS 링크 프리뷰가 깨진다.
