/**
 * Excel 파일(.xlsx, .xlsm)을 파싱하여 시트별 텍스트 데이터로 변환.
 * SheetJS 라이브러리 사용. Gemini API에 텍스트로 전달하기 위한 용도.
 */

/**
 * Excel 파일을 파싱하여 시트별 데이터 반환.
 * @param {File} file - .xlsx 또는 .xlsm 파일
 * @returns {Promise<Array<{ name: string, csv: string, rowCount: number, colCount: number }>>}
 */
export async function parseExcelToSheets(file) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'));
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheets = [];
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    if (!csv.trim()) continue; // 빈 시트 제외

    const ref = ws['!ref'];
    let rowCount = 0, colCount = 0;
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      rowCount = range.e.r - range.s.r + 1;
      colCount = range.e.c - range.s.c + 1;
    }

    sheets.push({
      name: sheetName,
      csv,
      rowCount,
      colCount,
    });
  }

  return sheets;
}

/**
 * 파싱된 시트 데이터를 Gemini API 전달용 텍스트로 포맷.
 * @param {string} fileName - 원본 파일명
 * @param {Array<{ name: string, csv: string, rowCount: number, colCount: number }>} sheets
 * @returns {string} - Gemini 프롬프트에 포함할 텍스트
 */
export function formatSheetsForPrompt(fileName, sheets) {
  const parts = [`[첨부 Excel 파일: ${fileName}]`];
  parts.push(`시트 수: ${sheets.length}개\n`);

  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    parts.push(`── 시트 ${i + 1}: "${s.name}" (${s.rowCount}행 × ${s.colCount}열) ──`);
    parts.push(s.csv);
    parts.push(''); // blank line between sheets
  }

  return parts.join('\n');
}
