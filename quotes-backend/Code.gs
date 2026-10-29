/**
 * ================================================================
 *  خدمة نشر الاقتباسات المشتركة لنادي جليس القرائي
 *  Google Apps Script — يُربط بجدول Google Sheets
 * ================================================================
 *  الوظيفة:
 *   - doGet  : يرجع قائمة الاقتباسات (JSON) لعرضها في الموقع
 *   - doPost : يستقبل اقتباساً جديداً من الموقع ويخزنه في أعلى الجدول
 *
 *  يُخزن في الجدول: اسم العضو | عنوان الكتاب | نص الاقتباس | وقت النشر
 */

const SHEET_NAME = "Quotes";

/*
  معرّف الجدول (SHEET_ID):
  - إذا فتحت الكود من داخل الجدول (الإضافات ← برمجة التطبيقات): اتركه فارغاً "" كما هو.
  - إذا أنشأت المشروع مستقلاً من script.google.com مباشرة: ضع معرّف الجدول هنا.
    (المعرّف هو الجزء الممتد في رابط الجدول بين /d/ و /edit)
*/
const SHEET_ID = "";

function getSpreadsheet() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("SHEET_ID فارغ: افتح الكود من داخل الجدول، أو ضع معرّف الجدول في SHEET_ID أعلى الكود");
  }
  return ss;
}

function getSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["author", "book", "text", "date", "ts"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  const quotes = getQuotes();
  return json({ ok: true, quotes: quotes });
}

function doPost(e) {
  const p = e.parameter || {};
  const author = (p.author || "").toString().trim().slice(0, 80);
  const book = (p.book || "").toString().trim().slice(0, 120);
  const text = (p.text || "").toString().trim().slice(0, 800);

  if (!author || !text) {
    return json({ ok: false, error: "missing-fields" });
  }

  const now = new Date();
  const dateText = Utilities.formatDate(now, "Asia/Riyadh", "d/M/yyyy • HH:mm");
  const sheet = getSheet();

  /* الإدراج بعد صف العناوين مباشرة => الأحدث في الأعلى */
  sheet.insertRowAfter(1);
  sheet.getRange(2, 1, 1, 5).setValues([[author, book, text, dateText, now.getTime()]]);

  return json({ ok: true, quote: { author: author, book: book, text: text, date: dateText } });
}

function getQuotes() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  return values
    .filter(r => r[2])
    .map(r => {
      return {
        author: r[0],
        book: r[1],
        text: r[2],
        date: r[3],
        ts: r[4]
      };
    })
    .sort(function (a, b) { return b.ts - a.ts; }); /* الأحدث أولاً */
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ================================================================
 *  النسخ الاحتياطي اليومي التلقائي (حماية كاملة للاقتباسات)
 *  - makeDailyBackup  : ينشئ نسخة كاملة من الجدول في مجلد Google Drive
 *  - createBackupTrigger : تُشغَّل مرة واحدة يدوياً لتفعيل المؤقت اليومي
 * ================================================================ */

const BACKUP_FOLDER_NAME = "نسخ احتياطية - اقتباسات جليس";

function createBackupTrigger() {
  cleanupBackupTriggers();
  ScriptApp.newTrigger("makeDailyBackup").timeBased().everyDays(1).atHour(3).create();
  return "تم تفعيل النسخ الاحتياطي اليومي الساعة 3 صباحاً";
}

function cleanupBackupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "makeDailyBackup") {
      ScriptApp.deleteTrigger(t);
    }
  });
}

function makeDailyBackup() {
  const ss = getSpreadsheet();
  const dateText = Utilities.formatDate(new Date(), "Asia/Riyadh", "yyyy-MM-dd");
  const copyName = "اقتباسات جليس - نسخة " + dateText;

  let folder;
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(BACKUP_FOLDER_NAME);
  }

  DriveApp.getFileById(ss.getId()).makeCopy(copyName, folder);
}
