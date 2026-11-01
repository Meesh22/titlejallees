const QUOTES_SHEET = 'الاقتباسات';
const BOOKS_SHEET = 'المكتبة';
const ARTICLES_SHEET = 'المقالات';
const JOIN_REQUESTS_SHEET = 'طلبات الانضمام';
const OLD_BOOKS_SHEET_ID = 1035156833;

function output(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function readData(e) {
  if (e && e.parameter && e.parameter.data) {
    return JSON.parse(e.parameter.data);
  }
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (error) {
      return (e && e.parameter) || {};
    }
  }
  return (e && e.parameter) || {};
}

function doPost(e) {
  try {
    const data = readData(e);
    const action = (e && e.parameter && e.parameter.action) || data.action || '';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'saveClubBook') {
      const sheet = ss.getSheetByName(BOOKS_SHEET);
      if (!sheet) throw new Error('لم أجد تبويب المكتبة');

      const bookId = String(data.id || '');
      const oldSheet = ss.getSheetById(OLD_BOOKS_SHEET_ID);
      const sources = [oldSheet, sheet]
        .filter((source, index, list) => source && list.indexOf(source) === index);

      for (const source of sources) {
        const lastRow = source.getLastRow();
        if (lastRow < 2 || !bookId) continue;
        const ids = source.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        if (ids.some(row => String(row[0]) === bookId)) {
          return output({ success: true, message: 'الكتاب موجود مسبقًا' });
        }
      }

      sheet.appendRow([
        data.id || '', data.memberId || '', data.memberName || '',
        data.title || '', data.author || '', data.category || '',
        data.coverColor || '', data.report || '', data.pages || 0,
        data.createdAt || Date.now(), data.coverImage || ''
      ]);
      return output({ success: true, message: 'تم حفظ الكتاب' });
    }

    if (action === 'saveArticle') {
      const sheet = ss.getSheetByName(ARTICLES_SHEET);
      if (!sheet) throw new Error('لم أجد تبويب المقالات');

      const articleId = String(data.id || '');
      if (articleId) {
        const lastRow = sheet.getLastRow();
        if (lastRow >= 2) {
          const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
          for (let i = 0; i < ids.length; i++) {
            if (String(ids[i][0]) === articleId) {
              // update existing row
              sheet.getRange(i + 2, 2).setValue(data.memberId || '');
              sheet.getRange(i + 2, 3).setValue(data.memberName || '');
              sheet.getRange(i + 2, 4).setValue(data.title || '');
              sheet.getRange(i + 2, 5).setValue(data.category || '');
              sheet.getRange(i + 2, 6).setValue(data.body || '');
              sheet.getRange(i + 2, 7).setValue(data.excerpt || '');
              sheet.getRange(i + 2, 8).setValue(data.read || 0);
              sheet.getRange(i + 2, 9).setValue(data.createdAt || Date.now());
              return output({ success: true, message: 'تم تحديث المقال' });
            }
          }
        }
      }

      sheet.appendRow([
        data.id || '', data.memberId || '', data.memberName || '',
        data.title || '', data.category || '', data.body || '',
        data.excerpt || '', data.read || 0, data.createdAt || Date.now()
      ]);
      return output({ success: true, message: 'تم حفظ المقال' });
    }

    if (action === 'deleteArticle') {
      const sheet = ss.getSheetByName(ARTICLES_SHEET);
      if (!sheet) throw new Error('لم أجد تبويب المقالات');
      const articleId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === articleId) {
            sheet.deleteRow(i + 2);
            return output({ success: true, message: 'تم حذف المقال' });
          }
        }
      }
      return output({ success: true, message: 'المقال غير موجود' });
    }

    if (action === 'saveJoinRequest') {
      const sheet = ss.getSheetByName(JOIN_REQUESTS_SHEET);
      if (!sheet) throw new Error('لم أجد تبويب طلبات الانضمام');
      sheet.appendRow([
        data.name || '', data.phone || '', data.note || '',
        data.createdAt || Date.now()
      ]);
      return output({ success: true, message: 'تم حفظ طلب الانضمام' });
    }

    // Fallback: forward to old member-data endpoint logic is not here;
    // this endpoint only handles club books/articles/join requests.
    return output({ success: false, message: 'action غير معروف: ' + action });
  } catch (error) {
    return output({ success: false, error: error.message });
  }
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'getClubBooks') {
      const sheet = ss.getSheetByName(BOOKS_SHEET);
      if (!sheet) return output({ success: true, data: [] });
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
      const data = rows.map((row) => ({
        id: row[0], memberId: row[1], memberName: row[2],
        title: row[3], author: row[4], category: row[5],
        coverColor: row[6], report: row[7], pages: row[8],
        createdAt: row[9], coverImage: row[10]
      })).filter((b) => b.id);
      return output({ success: true, data: data });
    }

    if (action === 'getArticles') {
      const sheet = ss.getSheetByName(ARTICLES_SHEET);
      if (!sheet) return output({ success: true, data: [] });
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      const data = rows.map((row) => ({
        id: row[0], memberId: row[1], memberName: row[2],
        title: row[3], category: row[4], body: row[5],
        excerpt: row[6], read: row[7], createdAt: row[8]
      })).filter((a) => a.id);
      return output({ success: true, data: data });
    }

    if (action === 'getJoinRequests') {
      const sheet = ss.getSheetByName(JOIN_REQUESTS_SHEET);
      if (!sheet) return output({ success: true, data: [] });
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      const data = rows.map((row) => ({
        name: row[0], phone: row[1], note: row[2], createdAt: row[3]
      })).filter((r) => r.name);
      // الأحدث أولاً
      data.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return output({ success: true, data: data });
    }

    if (action === 'getQuotes') {
      const sheet = ss.getSheetByName(QUOTES_SHEET);
      if (!sheet) return output({ success: true, data: [] });
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      const data = rows.map((row) => ({
        id: row[0],
        created_at: row[1],
        author_name: row[2],
        page_number: row[3],
        book_title: row[4],
        quote_text: row[5]
      })).filter((q) => q.quote_text);
      return output({ success: true, data: data });
    }

    return output({ success: false, message: 'action غير معروف' });
  } catch (error) {
    return output({ success: false, error: error.message });
  }
}
