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

  sheet.appendRow([
    data.timestamp,
    data.orderNumber,
    data.paymentMethod,
    data.items,
    data.total
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
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
