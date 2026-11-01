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
    const ss = SpreadsheetApp.openById('1s_7SIePvvoBHcZSlqNqtNH9g6IIOCcr7GIKf7hC-46g');

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

    if (action === 'saveJoinRequest') {
      const sheet = ss.getSheetByName(JOIN_REQUESTS_SHEET);
      if (!sheet) throw new Error('لم أجد تبويب طلبات الانضمام');

      sheet.appendRow([
        data.name || '',
        data.phone || '',
        data.note || '',
        data.ts || Date.now()
      ]);
      return output({ success: true, message: 'تم حفظ طلب الانضمام' });
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
              // تحديث صف موجود
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

    // حفظ الاقتباس (fallback)
    const sheet = ss.getSheetByName(QUOTES_SHEET);
    if (!sheet) throw new Error('لم أجد تبويب الاقتباسات');

    sheet.appendRow([
      data.created_at || new Date().toLocaleString('ar-SA'),
      data.author_name || '',
      data.page_number || data.page_numbe || '',
      data.book_title || '',
      data.quote_text || ''
    ]);
    return output({ status: 'success', message: 'تم حفظ الاقتباس' });
  } catch (error) {
    return output({ success: false, status: 'error', error: error.toString() });
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById('1s_7SIePvvoBHcZSlqNqtNH9g6IIOCcr7GIKf7hC-46g');
    const action = e && e.parameter ? e.parameter.action || '' : '';

    if (action === 'getClubBooks') {
      const sources = [
        ss.getSheetById(OLD_BOOKS_SHEET_ID),
        ss.getSheetByName(BOOKS_SHEET)
      ].filter((sheet, index, list) => sheet && list.indexOf(sheet) === index);

      const booksById = {};
      sources.forEach(sheet => {
        const rows = sheet.getDataRange().getValues();
        rows.slice(1).forEach((row, index) => {
          if (!row[3]) return;
          const id = String(row[0] || `legacy-${sheet.getSheetId()}-${index + 2}`);
          booksById[id] = {
            id, memberId: row[1], memberName: row[2], title: row[3],
            author: row[4], category: row[5], coverColor: row[6],
            report: row[7], pages: row[8], createdAt: row[9],
            coverImage: row[10] || ''
          };
        });
      });
      return output({ success: true, data: Object.values(booksById) });
    }

    if (action === 'getJoinRequests') {
      const sheet = ss.getSheetByName(JOIN_REQUESTS_SHEET);
      if (!sheet) throw new Error('لم أجد تبويب طلبات الانضمام');
      const rows = sheet.getDataRange().getValues();
      const requests = rows.slice(1).map(row => ({
        name: row[0], phone: row[1], note: row[2], ts: row[3]
      }));
      return output({ success: true, data: requests });
    }

    if (action === 'getArticles') {
      const sheet = ss.getSheetByName(ARTICLES_SHEET);
      if (!sheet) return output({ success: true, data: [] });
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      const articles = rows.map(row => ({
        id: row[0], memberId: row[1], memberName: row[2],
        title: row[3], category: row[4], body: row[5],
        excerpt: row[6], read: row[7], createdAt: row[8]
      })).filter(a => a.id);
      return output({ success: true, data: articles });
    }

    // قراءة الاقتباسات
    const sheet = ss.getSheetByName(QUOTES_SHEET);
    if (!sheet) throw new Error('لم أجد تبويب الاقتباسات');
    const rows = sheet.getDataRange().getValues();
    const quotes = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][4]) {
        quotes.push({
          id: 'sheet-' + i,
          created_at: rows[i][0],
          author_name: rows[i][1],
          page_number: rows[i][2],
          book_title: rows[i][3],
          quote_text: rows[i][4]
        });
      }
    }
    return output({ status: 'success', data: quotes });
  } catch (error) {
    return output({ success: false, status: 'error', error: error.toString() });
  }
}
