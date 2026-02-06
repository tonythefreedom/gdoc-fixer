# GDoc Fixer & Infographic Tool

이 프로젝트는 Google Docs의 텍스트 포맷을 자동으로 정리해주는 Google Apps Script와 기술 분석 인포그래픽을 생성하는 HTML 도구로 구성되어 있습니다.

## 1. Google Docs Fixer (Google Apps Script)

Google Docs에서 수식 치환, 볼드체 적용 등을 자동화합니다.

### 주요 기능
- **\*\* Bold 적용**: \`**텍스트**\` 형태의 문구에서 \`**\`를 제거하고 해당 텍스트를 굵게(Bold) 만듭니다.
- **Latex $ 치환**: 문서 내의 모든 \`$\`를 \`$$\`로 치환합니다. (수식 입력을 위한 준비)
- **$통화 보정**: \`$$100\`과 같이 잘못 치환된 통화 단위를 다시 \`$100\`으로 복구합니다.

### 사용 방법
1. 구글 문서에서 **확장 프로그램 > Apps Script**를 클릭합니다.
2. \`Code.gs\` 파일의 내용을 복사하여 붙여넣습니다.
3. 저장 후 문서를 새로고침하면 상단 메뉴에 **GDoc Fixer**가 나타납니다.
4. 원하는 기능을 선택하여 실행합니다.

---

## 2. DeepSeek vs Gemini 분석 인포그래픽 (\`draw.html\`)

DeepSeek의 MLA 아키텍처와 Gemini의 전략을 비교하는 현대적인 디자인의 인포그래픽 도구입니다.

### 특징
- Tailwind CSS 기반의 반응형 디자인
- DeepSeek의 128K 문맥 윈도우 및 MLA(Multi-Head Latent Attention) 기술 설명 포함

---

## 3. HTML to PNG 변환 도구 (\`html_to_png.py\`)

\`html\` 디렉토리 내의 HTML 파일을 지정한 해상도로 캡처하여 PNG 파일로 저장합니다.

### 사용 방법
1. \`html\` 디렉토리에 대상 HTML 파일을 넣습니다.
2. 아래 명령어를 실행합니다.

\`\`\`bash
# 기본 사용법 (1080x1080)
./venv/bin/python html_to_png.py [파일명]

# 해상도 및 출력 파일명 지정 예시
./venv/bin/python html_to_png.py draw.html --width 1080 --height 1080 --output my_draw.png
\`\`\`

### 주요 파라미터
- \`filename\`: \`html\` 디렉토리 내의 HTML 파일명
- \`--width\`: 출력 너비 (기본값: 1080)
- \`--height\`: 출력 높이 (기본값: 1080)
- \`--output\`: 저장될 파일명 (기본값: \`파일명.png\`, \`imgs/파일명/\` 디렉토리에 저장됨)

---

## 프로젝트 구조
- \`Code.gs\`: Google Apps Script 소스 코드
- \`html/\`: 인포그래픽 HTML 파일들이 위치하는 디렉토리
- \`imgs/\`: 생성된 이미지들이 저장되는 디렉토리
- \`venv/\`: Python 가상 환경 (Playwright 실행용)
