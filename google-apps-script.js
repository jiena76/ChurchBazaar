/**
 * Google Apps Script — paste this into your Google Sheet's script editor.
 *
 * SETUP:
 * 1. Create a new Google Sheet
 * 2. Add headers in Row 1: Timestamp | Order ID | Payment | Total | 닭곰탕 | 떡볶이 | 밀크티 | 밀크티 + 🍦 | 팡팡 스파클링 에이드 | 아메리카노 | 베이커리 1팩 | 베이커리 2팩 | 돈까스 | 닭갈비 | 밀키트 세트 할인
 * 3. Go to Extensions > Apps Script
 * 4. Paste this code, save
 * 5. Click Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the URL and paste it into index.html as GOOGLE_SCRIPT_URL
 */

const ITEM_COLUMNS = [
  '닭곰탕', '떡볶이', '밀크티', '밀크티 + 🍦',
  '팡팡 스파클링 에이드', '아메리카노', '베이커리 1팩', '베이커리 2팩',
  '돈까스', '닭갈비'
];

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents || '{}');
  const action = data.action || 'new';

  if (action === 'new') {
    const row = [
      data.timestamp,
      data.orderNumber,
      data.paymentMethod,
      data.total
    ];
    ITEM_COLUMNS.forEach(name => {
      row.push(data.quantities && data.quantities[name] ? data.quantities[name] : '');
    });
    row.push(data.discount || '');
    sheet.appendRow(row);
  } else if (action === 'update') {
    const row = findRowByOrderNumber(sheet, data.orderNumber);
    if (row) {
      sheet.getRange(row, 4).setValue(data.total);
      ITEM_COLUMNS.forEach((name, i) => {
        const col = 5 + i;
        const qty = data.quantities && data.quantities[name] ? data.quantities[name] : '';
        sheet.getRange(row, col).setValue(qty);
      });
      const discountCol = 5 + ITEM_COLUMNS.length;
      sheet.getRange(row, discountCol).setValue(data.discount || '');
    }
  } else if (action === 'cancel') {
    const row = findRowByOrderNumber(sheet, data.orderNumber);
    if (row) {
      sheet.getRange(row, 4).setValue(0);
      ITEM_COLUMNS.forEach((name, i) => {
        const col = 5 + i;
        if (sheet.getRange(row, col).getValue()) {
          sheet.getRange(row, col).setValue(0);
        }
      });
      const discountCol = 5 + ITEM_COLUMNS.length;
      if (sheet.getRange(row, discountCol).getValue()) {
        sheet.getRange(row, discountCol).setValue(0);
      }
      const lastCol = 5 + ITEM_COLUMNS.length;
      sheet.getRange(row, 1, 1, lastCol).setFontLine('line-through');
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function findRowByOrderNumber(sheet, orderNumber) {
  const data = sheet.getRange(1, 2, sheet.getLastRow(), 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === orderNumber) return i + 1;
  }
  return null;
}

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
