# GDoc Fixer

HTML 콘텐츠를 AI 기반으로 프레젠테이션 슬라이드로 변환하고 편집할 수 있는 웹 애플리케이션.

## 주요 기능

### HTML 편집기
- HTML 직접 작성 및 실시간 미리보기
- 파일 생성/삭제/이름변경
- Google 계정 기반 클라우드 저장 (Firestore)

### 프레젠테이션 생성
- HTML 콘텐츠를 Gemini 2.5 Pro로 16:9 슬라이드 자동 변환
- 사이드바에서 프레젠테이션 프로젝트 관리 (생성/삭제/이름변경)
- PDF 내보내기

### AI 슬라이드 수정
- 자연어 지시로 개별 슬라이드 수정 (Gemini 2.5 Pro)
- 수정 이력 관리 및 특정 버전으로 되돌리기

### AI 이미지 생성 및 삽입
- 슬라이드 수정 지시에 이미지 관련 키워드 포함 시 자동으로 이미지 생성
- 3단계 파이프라인:
  1. **Gemini 2.5 Flash** — 지시 분석, 생성할 이미지 목록 추출
  2. **Gemini 2.5 Flash (Image)** — 이미지 병렬 생성
  3. **Gemini 2.5 Pro** — 생성된 이미지를 포함하여 슬라이드 HTML 수정
- 비배경 이미지 자동 투명 배경 처리 (Canvas Flood-fill 기반, 이미지 크기로 배경/비배경 구분)
- 생성된 이미지는 Firebase Storage에 업로드 후 URL로 교체 (Firestore 1MB 제한 회피)

## 기술 스택

- **프론트엔드**: React 19 + Vite 7 + Tailwind CSS v4
- **상태 관리**: Zustand
- **백엔드**: Firebase (Auth, Firestore, Storage, Hosting)
- **AI**: Google Gemini API (2.5 Pro, 2.5 Flash, 2.5 Flash Image)

## 환경 변수

`.env` 파일에 다음 변수를 설정:

```
VITE_GEMINI_API_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

## 개발

```bash
npm install
npm run dev
```

## 빌드 및 배포

```bash
npm run build
firebase deploy --only hosting
```
