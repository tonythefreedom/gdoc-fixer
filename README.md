# GDoc Fixer

HTML 문서를 AI 기반 프레젠테이션 슬라이드로 변환하고 편집하는 웹 애플리케이션.

## 기술 스택

- **Frontend**: React 19 + Vite 7, Tailwind CSS v4
- **상태관리**: Zustand
- **Backend**: Firebase (Auth, Firestore)
- **스토리지**: Google Cloud Storage (REST API + Service Account JWT)
- **AI**: Google Gemini API (Flash, Flash-Image, Pro 3-모델 파이프라인)

## 주요 기능

### HTML 편집
- 브라우저 기반 HTML 에디터 + 실시간 프리뷰
- Google 로그인으로 파일 관리 (Firestore 저장)

### AI 슬라이드 생성
- HTML 문서를 분석하여 프레젠테이션 슬라이드 자동 생성
- Gemini Flash로 콘텐츠 분석 → Flash-Image로 이미지 생성 → Pro로 HTML 슬라이드 조합
- 이미지 플레이스홀더 패턴 (`{{IMAGE_N}}`)으로 토큰 오버플로우 방지
- 배경이 아닌 이미지에 대해 Canvas Flood-fill BFS 기반 투명 배경 처리

### 슬라이드 편집
- 개별 슬라이드 AI 수정 (텍스트 + 이미지 생성 지원)
- **전체 슬라이드 일괄 수정** — 모든 슬라이드에 일관된 수정 적용 (배경색, 폰트 등)
- **비동기 백그라운드 수정** — 여러 슬라이드 동시 수정 가능, 수정 중에도 다른 슬라이드 탐색 가능
- **수정 중 지시 내용 실시간 표시** — 진행 중인 수정 작업의 지시 텍스트 확인
- **수정 이력 관리** — 각 슬라이드별 수정 이력 보기, 특정 버전으로 되돌리기, 개별 이력 삭제
- 슬라이드 좌우 화살표 네비게이션
- 키보드 좌우 화살표로 슬라이드 이동

### 프레젠테이션 프로젝트 관리
- 사이드바에서 프레젠테이션 프로젝트 목록 관리
- 프레젠테이션 이름 변경, 삭제
- Firestore에 자동 저장

### PDF 내보내기
- 슬라이드를 PDF 파일로 변환 및 다운로드

## 설정

### 환경 변수 (`web/.env`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_GEMINI_API_KEY=
VITE_GCS_BUCKET=
VITE_GCS_SA_EMAIL=
VITE_GCS_PRIVATE_KEY=
```

### 실행

```bash
cd web
npm install
npm run dev
```

### 빌드 및 배포

```bash
cd web
npm run build
npx firebase deploy --only hosting
```
