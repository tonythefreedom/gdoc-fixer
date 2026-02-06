import os
import sys
import argparse
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def capture_html(html_path, width, height):
    """HTML 파일을 Playwright로 렌더링하여 스크린샷 캡처"""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": width, "height": height})
        
        # 파일 경로를 URL 형태로 변환
        abs_path = os.path.abspath(html_path)
        url = f"file://{abs_path}"
        
        print(f"URL 접속 중: {url}")
        await page.goto(url)
        # 페이지 로딩 대기
        await page.wait_for_load_state("networkidle")
        
        # 스크린샷을 메모리에 바이너리로 저장
        screenshot_bytes = await page.screenshot(full_page=False)
        await browser.close()
        return screenshot_bytes

async def main():
    parser = argparse.ArgumentParser(description="HTML 파일을 PNG로 변환합니다.")
    parser.add_argument("filename", help="html 디렉토리 내의 HTML 파일명 (예: draw.html)")
    parser.add_argument("--width", type=int, default=1080, help="출력 너비 (기본값: 1080)")
    parser.add_argument("--height", type=int, default=1080, help="출력 높이 (기본값: 1080)")
    parser.add_argument("--output", help="출력 파일명 (기본값: 파일명.png)")

    args = parser.parse_args()

    html_dir = Path("html")
    html_file = html_dir / args.filename

    if not html_file.exists():
        print(f"에러: 파일을 찾을 수 없습니다: {html_file}")
        sys.exit(1)

    # HTML 파일명으로 imgs 내에 서브 디렉토리 생성
    output_dir = Path("imgs") / html_file.stem
    output_dir.mkdir(parents=True, exist_ok=True)
    
    base_name = args.output if args.output else f"{html_file.stem}.png"
    output_path = output_dir / base_name

    # 기존 파일이 있으면 숫자 접미사 추가 (예: filename_001.png)
    if output_path.exists():
        stem = Path(base_name).stem
        ext = Path(base_name).suffix
        counter = 1
        while True:
            new_name = f"{stem}_{counter:03d}{ext}"
            new_path = output_dir / new_name
            if not new_path.exists():
                output_path = new_path
                break
            counter += 1

    try:
        # Playwright로 캡처
        print(f"캡처 시작: {args.width}x{args.height}")
        img_bytes = await capture_html(html_file, args.width, args.height)
        
        # 파일 저장
        with open(output_path, "wb") as f:
            f.write(img_bytes)
        print(f"저장 완료: {output_path}")

    except Exception as e:
        print(f"작업 중 오류 발생: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())


