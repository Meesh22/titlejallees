/* ==========================================================================
   جليس | Apps Script موحّد — نقطة نهاية واحدة لجميع البيانات
   ==========================================================================
   Sheets required (create these tabs in your Google Sheet):
     - الأعضاء      (profiles)
     - السجل        (entries)
     - مكتبتي       (myBooks)
     - المكتبة      (clubBooks)   columns: id, memberId, memberName, title, author, category, coverColor, report, pages, createdAt, coverImage
     - المقالات     (articles)    columns: id, memberId, memberName, title, category, body, excerpt, read, createdAt
     - طلبات الانضمام (joinRequests) columns: name, phone, note, createdAt
     - الاقتباسات   (quotes)      columns: id, created_at, author_name, page_number, book_title, quote_text

   After deploying, set BOTH in app.js:
     APPS_SCRIPT_URL = '<your-url>'
     CLUB_BOOKS_URL  = '<your-url>'
   and remove the routing split in cloudRequest (or keep it, both point to same URL).
   ========================================================================== */

const SHEET_PROFILES = 'الأعضاء';
const SHEET_ENTRIES = 'السجل';
const SHEET_MYBOOKS = 'مكتبتي';
const SHEET_CLUBBOOKS = 'المكتبة';
const SHEET_ARTICLES = 'المقالات';
const SHEET_JOIN = 'طلبات الانضمام';
const SHEET_QUOTES = 'الاقتباسات';
const OLD_BOOKS_SHEET_ID = 1035156833;

function output(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function readData(e) {
  if (e && e.parameter && e.parameter.data) {
    try { return JSON.parse(e.parameter.data); } catch (err) { /* fall through */ }
  }
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { /* fall through */ }
  }
  return (e && e.parameter) || {};
}

function getSheet(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function doPost(e) {
  try {
    const data = readData(e);
    const action = (e && e.parameter && e.parameter.action) || data.action || '';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    /* ---------- saveProfile ---------- */
    if (action === 'saveProfile') {
      const sh = getSheet(ss, SHEET_PROFILES);
      if (sh.getLastRow() === 0) {
        sh.appendRow(['memberId', 'name', 'role', 'joined', 'goal', 'lastWeekPages', 'notifications', 'updatedAt']);
      }
      const lastRow = sh.getLastRow();
      let found = -1;
      if (lastRow >= 2) {
        const ids = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(data.memberId)) { found = i + 2; break; }
        }
      }
      const row = [data.memberId, data.name, data.role, data.joined, data.goal, data.lastWeekPages, data.notifications, Date.now()];
      if (found > 0) sh.getRange(found, 1, 1, row.length).setValues([row]);
      else sh.appendRow(row);
      return output({ success: true, message: 'تم حفظ الملف' });
    }

    /* ---------- saveEntry ---------- */
    if (action === 'saveEntry') {
      const sh = getSheet(ss, SHEET_ENTRIES);
      if (sh.getLastRow() === 0) {
        sh.appendRow(['id', 'memberId', 'memberName', 'bookId', 'bookTitle', 'pages', 'date', 'createdAt']);
      }
      const lastRow = sh.getLastRow();
      if (lastRow >= 2) {
        const ids = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(data.id)) {
            return output({ success: true, message: 'السجل موجود مسبقًا' });
          }
        }
      }
      sh.appendRow([data.id, data.memberId, data.memberName, data.bookId || '', data.bookTitle || '', data.pages, data.date, data.createdAt || Date.now()]);
      return output({ success: true, message: 'تم حفظ السجل' });
    }

    /* ---------- saveMyBook ---------- */
    if (action === 'saveMyBook') {
      const sh = getSheet(ss, SHEET_MYBOOKS);
      if (sh.getLastRow() === 0) {
        sh.appendRow(['memberId', 'memberName', 'bookId', 'status', 'currentPage', 'updatedAt']);
      }
      const lastRow = sh.getLastRow();
      let found = -1;
      if (lastRow >= 2) {
        const rows = sh.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i][0]) === String(data.memberId) && String(rows[i][2]) === String(data.bookId)) {
            found = i + 2; break;
          }
        }
      }
      const row = [data.memberId, data.memberName, data.bookId, data.status, data.currentPage, Date.now()];
      if (found > 0) sh.getRange(found, 1, 1, row.length).setValues([row]);
      else sh.appendRow(row);
      return output({ success: true, message: 'تم حفظ كتابي' });
    }

    /* ---------- saveClubBook ---------- */
    if (action === 'saveClubBook') {
      const sh = getSheet(ss, SHEET_CLUBBOOKS);
      if (sh.getLastRow() === 0) {
        sh.appendRow(['id', 'memberId', 'memberName', 'title', 'author', 'category', 'coverColor', 'report', 'pages', 'createdAt', 'coverImage']);
      }
      const bookId = String(data.id || '');
      const oldSheet = ss.getSheetById(OLD_BOOKS_SHEET_ID);
      const sources = [oldSheet, sh].filter((s, i, l) => s && l.indexOf(s) === i);
      for (const source of sources) {
        const lr = source.getLastRow();
        if (lr < 2 || !bookId) continue;
        const ids = source.getRange(2, 1, lr - 1, 1).getDisplayValues();
        if (ids.some(r => String(r[0]) === bookId)) {
          return output({ success: true, message: 'الكتاب موجود مسبقًا' });
        }
      }
      sh.appendRow([
        data.id || '', data.memberId || '', data.memberName || '',
        data.title || '', data.author || '', data.category || '',
        data.coverColor || '', data.report || '', data.pages || 0,
        data.createdAt || Date.now(), data.coverImage || ''
      ]);
      return output({ success: true, message: 'تم حفظ الكتاب' });
    }

    /* ---------- saveArticle ---------- */
    if (action === 'saveArticle') {
      const sh = getSheet(ss, SHEET_ARTICLES);
      if (sh.getLastRow() === 0) {
        sh.appendRow(['id', 'memberId', 'memberName', 'title', 'category', 'body', 'excerpt', 'read', 'createdAt']);
      }
      const articleId = String(data.id || '');
      if (articleId) {
        const lastRow = sh.getLastRow();
        if (lastRow >= 2) {
          const ids = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
          for (let i = 0; i < ids.length; i++) {
            if (String(ids[i][0]) === articleId) {
              sh.getRange(i + 2, 2).setValue(data.memberId || '');
              sh.getRange(i + 2, 3).setValue(data.memberName || '');
              sh.getRange(i + 2, 4).setValue(data.title || '');
              sh.getRange(i + 2, 5).setValue(data.category || '');
              sh.getRange(i + 2, 6).setValue(data.body || '');
              sh.getRange(i + 2, 7).setValue(data.excerpt || '');
              sh.getRange(i + 2, 8).setValue(data.read || 0);
              sh.getRange(i + 2, 9).setValue(data.createdAt || Date.now());
              return output({ success: true, message: 'تم تحديث المقال' });
            }
          }
        }
      }
      sh.appendRow([
        data.id || '', data.memberId || '', data.memberName || '',
        data.title || '', data.category || '', data.body || '',
        data.excerpt || '', data.read || 0, data.createdAt || Date.now()
      ]);
      return output({ success: true, message: 'تم حفظ المقال' });
    }

    /* ---------- deleteArticle ---------- */
    if (action === 'deleteArticle') {
      const sh = getSheet(ss, SHEET_ARTICLES);
      const articleId = String(data.id || '');
      const lastRow = sh.getLastRow();
      if (lastRow >= 2) {
        const ids = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === articleId) {
            sh.deleteRow(i + 2);
            return output({ success: true, message: 'تم حذف المقال' });
          }
        }
      }
      return output({ success: true, message: 'المقال غير موجود' });
    }

    /* ---------- saveJoinRequest ---------- */
    if (action === 'saveJoinRequest') {
      const sh = getSheet(ss, SHEET_JOIN);
      if (sh.getLastRow() === 0) {
        sh.appendRow(['name', 'phone', 'note', 'createdAt']);
      }
      sh.appendRow([data.name || '', data.phone || '', data.note || '', data.createdAt || Date.now()]);
      return output({ success: true, message: 'تم حفظ طلب الانضمام' });
    }

    /* ---------- saveQuote ---------- */
    if (action === 'saveQuote') {
      const sh = getSheet(ss, SHEET_QUOTES);
      if (sh.getLastRow() === 0) {
        sh.appendRow(['id', 'created_at', 'author_name', 'page_number', 'book_title', 'quote_text']);
      }
      const qid = String(data.id || '');
      if (qid) {
        const lastRow = sh.getLastRow();
        if (lastRow >= 2) {
          const ids = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
          for (let i = 0; i < ids.length; i++) {
            if (String(ids[i][0]) === qid) {
              return output({ success: true, message: 'الاقتباس موجود مسبقًا' });
            }
          }
        }
      }
      sh.appendRow([
        data.id || `q-${Date.now()}`, data.created_at || new Date().toLocaleString('ar-SA'),
        data.author_name || '', data.page_number || '', data.book_title || '', data.quote_text || ''
      ]);
      return output({ success: true, message: 'تم حفظ الاقتباس' });
    }

    return output({ success: false, message: 'action غير معروف: ' + action });
  } catch (error) {
    return output({ success: false, error: error.message });
  }
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const memberId = e && e.parameter && e.parameter.memberId;

    /* ---------- getProfile ---------- */
    if (action === 'getProfile') {
      const sh = ss.getSheetByName(SHEET_PROFILES);
      if (!sh || sh.getLastRow() < 2) return output({ success: true, data: [] });
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
      const data = rows.map(r => ({
        memberId: r[0], name: r[1], role: r[2], joined: r[3],
        goal: r[4], lastWeekPages: r[5], notifications: r[6]
      })).filter(p => !memberId || String(p.memberId) === String(memberId));
      return output({ success: true, data: data });
    }

    /* ---------- getEntries ---------- */
    if (action === 'getEntries') {
      const sh = ss.getSheetByName(SHEET_ENTRIES);
      if (!sh || sh.getLastRow() < 2) return output({ success: true, data: [] });
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
      const data = rows.map(r => ({
        id: r[0], memberId: r[1], memberName: r[2], bookId: r[3],
        bookTitle: r[4], pages: r[5], date: r[6], createdAt: r[7]
      })).filter(e2 => !memberId || String(e2.memberId) === String(memberId));
      return output({ success: true, data: data });
    }

    /* ---------- getMyBooks ---------- */
    if (action === 'getMyBooks') {
      const sh = ss.getSheetByName(SHEET_MYBOOKS);
      if (!sh || sh.getLastRow() < 2) return output({ success: true, data: [] });
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
      const data = rows.map(r => ({
        memberId: r[0], memberName: r[1], bookId: r[2],
        status: r[3], currentPage: r[4]
      })).filter(b => !memberId || String(b.memberId) === String(memberId));
      return output({ success: true, data: data });
    }

    /* ---------- getClubBooks ---------- */
    if (action === 'getClubBooks') {
      const sh = ss.getSheetByName(SHEET_CLUBBOOKS);
      if (!sh || sh.getLastRow() < 2) return output({ success: true, data: [] });
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
      const data = rows.map(r => ({
        id: r[0], memberId: r[1], memberName: r[2], title: r[3],
        author: r[4], category: r[5], coverColor: r[6], report: r[7],
        pages: r[8], createdAt: r[9], coverImage: r[10]
      })).filter(b => b.id);
      return output({ success: true, data: data });
    }

    /* ---------- getArticles ---------- */
    if (action === 'getArticles') {
      const sh = ss.getSheetByName(SHEET_ARTICLES);
      if (!sh || sh.getLastRow() < 2) return output({ success: true, data: [] });
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
      const data = rows.map(r => ({
        id: r[0], memberId: r[1], memberName: r[2], title: r[3],
        category: r[4], body: r[5], excerpt: r[6], read: r[7], createdAt: r[8]
      })).filter(a => a.id);
      return output({ success: true, data: data });
    }

    /* ---------- getJoinRequests ---------- */
    if (action === 'getJoinRequests') {
      const sh = ss.getSheetByName(SHEET_JOIN);
      if (!sh || sh.getLastRow() < 2) return output({ success: true, data: [] });
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
      const data = rows.map(r => ({
        name: r[0], phone: r[1], note: r[2], createdAt: r[3]
      })).filter(r => r.name);
      data.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return output({ success: true, data: data });
    }

    /* ---------- getQuotes ---------- */
    if (action === 'getQuotes') {
      const sh = ss.getSheetByName(SHEET_QUOTES);
      if (!sh || sh.getLastRow() < 2) return output({ success: true, data: [] });
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
      const data = rows.map(r => ({
        id: r[0], created_at: r[1], author_name: r[2],
        page_number: r[3], book_title: r[4], quote_text: r[5]
      })).filter(q => q.quote_text);
      return output({ success: true, data: data });
    }

    return output({ success: false, message: 'action غير معروف' });
  } catch (error) {
    return output({ success: false, error: error.message });
  }
}
