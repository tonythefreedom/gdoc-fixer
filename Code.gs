function onOpen() {
  DocumentApp.getUi()
    .createMenu('GDoc Fixer')
    .addItem('** Bold 적용', 'runBoldFix')
    .addItem('Latex $ 치환', 'runLatexFix')
    .addItem('$통화 보정', 'runCurrencyFix')
    .addToUi();
}

/**
 * 각각의 기능을 독립적으로 실행하는 래퍼 함수들
 */
function runBoldFix() {
  const body = DocumentApp.getActiveDocument().getBody();
  processBold(body);
}

function runLatexFix() {
  const body = DocumentApp.getActiveDocument().getBody();
  processDollarSigns(body);
}

function runCurrencyFix() {
  const body = DocumentApp.getActiveDocument().getBody();
  processCurrencyFix(body);
}

function processBold(body) {
  let rangeElement = body.findText("\\*\\*[^\\*]+\\*\\*");
  
  while (rangeElement) {
    let element = rangeElement.getElement().asText();
    let startOffset = rangeElement.getStartOffset();
    let endOffset = rangeElement.getEndOffsetInclusive();
    
    // ** 를 제외한 텍스트에 bold 적용
    element.setBold(startOffset + 2, endOffset - 2, true);
    
    // 뒤의 ** 제거
    element.deleteText(endOffset - 1, endOffset);
    // 앞의 ** 제거
    element.deleteText(startOffset, startOffset + 1);
    
    // 다음 검색 (위치가 변경되었으므로 처음부터 다시 검색하거나 적절히 조절)
    // 간단하게 하기 위해 현재 위치 이후부터 검색
    rangeElement = body.findText("\\*\\*[^\\*]+\\*\\*", rangeElement);
  }
}

function processDollarSigns(body) {
  // 모든 $ 문자를 찾아 $$ 로 치환하는 가장 단순한 로직
  // pattern: "\\$" (literal $)
  // replacement: "$$$$" (Google Docs API에서 literal $$ 를 의미함)
  body.replaceText("\\$", "$$$$");
}

function processCurrencyFix(body) {
  // $$ 다음에 숫자가 오는 패턴($$100 등)을 찾아 $ 하나를 제거하여 $100으로 복구
  // pattern: "\\$\\$(\\d)" ($$와 뒤의 숫자 1개 캡처)
  // replacement: "$$1" (Google Docs API에서 literal $와 첫 번째 캡처 그룹을 의미함)
  body.replaceText("\\$\\$(\\d)", "$$1");
}

