/**
 * Google Apps Script — paste this into your Google Sheet's script editor.
 *
 * SETUP:
 * 1. Create a new Google Sheet
 * 2. Add headers in Row 1: Timestamp | Order ID | Payment | Items | Total
 * 3. Go to Extensions > Apps Script
 * 4. Paste this code, save
 * 5. Click Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the URL and paste it into index.html as GOOGLE_SCRIPT_URL
 */

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents || '{}');
  const action = data.action || 'new';

  if (action === 'new') {
    sheet.appendRow([
      data.timestamp,
      data.orderNumber,
      data.paymentMethod,
      data.items,
      data.total
    ]);
  } else if (action === 'update') {
    const row = findRowByOrderNumber(sheet, data.orderNumber);
    if (row) {
      const cell = sheet.getRange(row, 4);
      if (data.removedItems && data.removedItems.length > 0) {
        // Build rich text: strikethrough removed, then normal remaining
        const parts = [];
        data.removedItems.forEach(function(r) {
          parts.push({ text: r.qty + 'x ' + r.name, strike: true });
          if (r.remaining > 0) {
            parts.push({ text: ', ' + r.remaining + 'x ' + r.name, strike: false });
          }
        });
        // Add remaining items that weren't partially removed
        if (data.items) {
          const removedNames = data.removedItems.map(function(r) { return r.name; });
          const remainingItems = data.items.split(', ').filter(function(item) {
            const match = item.match(/^\d+x (.+)$/);
            return match && removedNames.indexOf(match[1]) === -1;
          });
          if (remainingItems.length > 0) {
            parts.push({ text: ', ' + remainingItems.join(', '), strike: false });
          }
        }

        var fullText = parts.map(function(p) { return p.text; }).join('');
        var builder = SpreadsheetApp.newRichTextValue().setText(fullText);
        var pos = 0;
        parts.forEach(function(p) {
          var style = SpreadsheetApp.newTextStyle();
          if (p.strike) style = style.setStrikethrough(true);
          builder.setTextStyle(pos, pos + p.text.length, style.build());
          pos += p.text.length;
        });
        cell.setRichTextValue(builder.build());
      } else {
        cell.setValue(data.items);
      }
      sheet.getRange(row, 5).setValue(data.total);
    }
  } else if (action === 'cancel') {
    const row = findRowByOrderNumber(sheet, data.orderNumber);
    if (row) {
      sheet.getRange(row, 5).setValue(0);
      sheet.getRange(row, 1, 1, 5).setFontLine('line-through');
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
