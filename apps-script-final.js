const QUOTES_SHEET = 'الاقتباسات';
const BOOKS_SHEET = 'المكتبة';
const ARTICLES_SHEET = 'المقالات';
const BOOK_RATINGS_SHEET = 'تقييمات الكتب';
const LIBRARY_CATEGORIES_SHEET = 'تصنيفات المكتبة';
const JOIN_REQUESTS_SHEET = 'طلبات الانضمام';
const MEETINGS_SHEET = 'اللقاءات';
const RECORDED_MEETINGS_SHEET = 'اللقاءات المسجلة';
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

function getMeetingsSheet(ss) {
  let sheet = ss.getSheetByName(MEETINGS_SHEET);
  if (!sheet) sheet = ss.insertSheet(MEETINGS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'title', 'description', 'date', 'time', 'location', 'image', 'createdAt', 'createdBy']);
  }
  return sheet;
}

function getRecordedMeetingsSheet(ss) {
  let sheet = ss.getSheetByName(RECORDED_MEETINGS_SHEET);
  if (!sheet) sheet = ss.insertSheet(RECORDED_MEETINGS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'title', 'description', 'recordedAt', 'speaker', 'views', 'duration', 'videoUrl', 'image', 'createdAt', 'createdBy']);
  }
  return sheet;
}

function normalizeTabName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u0640]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function getDataSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    const target = normalizeTabName(name);
    sheet = ss.getSheets().find((item) => normalizeTabName(item.getName()) === target) || null;
  }
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function getArticlesSheet(ss) {
  return getDataSheet(ss, ARTICLES_SHEET, ['id', 'memberId', 'memberName', 'title', 'category', 'body', 'excerpt', 'read', 'createdAt']);
}

function getBookRatingsSheet(ss) {
  return getDataSheet(ss, BOOK_RATINGS_SHEET, ['id', 'bookId', 'memberId', 'memberName', 'rating', 'review', 'createdAt']);
}

function getLibraryCategoriesSheet(ss) {
  return getDataSheet(ss, LIBRARY_CATEGORIES_SHEET, ['category']);
}

function libraryBookSheets(ss) {
  return [ss.getSheetByName(BOOKS_SHEET), ss.getSheetById(OLD_BOOKS_SHEET_ID)]
    .filter((sheet, index, list) => sheet && list.indexOf(sheet) === index);
}

function getLibraryCategoryNames(ss) {
  const sheet = getDataSheet(ss, LIBRARY_CATEGORIES_SHEET, ['category']);
  const categories = [];
  const known = new Set();
  const add = (value) => {
    const name = String(value || '').trim();
    const key = normalizeTabName(name);
    if (!name || !key || known.has(key)) return false;
    known.add(key);
    categories.push(name);
    return true;
  };

  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().forEach(row => add(row[0]));
  }

  const missing = [];
  libraryBookSheets(ss).forEach(bookSheet => {
    const lastRow = bookSheet.getLastRow();
    if (lastRow < 2 || bookSheet.getLastColumn() < 6) return;
    bookSheet.getRange(2, 6, lastRow - 1, 1).getDisplayValues().forEach(row => {
      const name = String(row[0] || '').trim();
      if (add(name)) missing.push(name);
    });
  });
  if (missing.length) sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, 1).setValues(missing.map(name => [name]));
  return categories;
}

function renameLibraryCategoryInBooks(ss, oldName, newName) {
  const oldKey = normalizeTabName(oldName);
  let updated = 0;
  libraryBookSheets(ss).forEach(bookSheet => {
    const lastRow = bookSheet.getLastRow();
    if (lastRow < 2 || bookSheet.getLastColumn() < 6) return;
    const range = bookSheet.getRange(2, 6, lastRow - 1, 1);
    const values = range.getDisplayValues();
    let changed = false;
    values.forEach(row => {
      if (normalizeTabName(row[0]) === oldKey) {
        row[0] = newName;
        updated++;
        changed = true;
      }
    });
    if (changed) range.setValues(values);
  });
  return updated;
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

    if (action === 'addLibraryCategory') {
      const category = String(data.category || '').trim();
      if (!category) throw new Error('اسم التصنيف مطلوب');
      const existing = getLibraryCategoryNames(ss);
      if (existing.some(name => normalizeTabName(name) === normalizeTabName(category))) {
        return output({ success: true, message: 'التصنيف موجود مسبقًا', categories: existing });
      }
      getLibraryCategoriesSheet(ss).appendRow([category]);
      return output({ success: true, message: 'تمت إضافة التصنيف', categories: getLibraryCategoryNames(ss) });
    }

    if (action === 'renameLibraryCategory') {
      const oldCategory = String(data.oldCategory || '').trim();
      const category = String(data.category || '').trim();
      if (!oldCategory || !category) throw new Error('اسم التصنيف الجديد مطلوب');
      const current = getLibraryCategoryNames(ss);
      if (!current.some(name => normalizeTabName(name) === normalizeTabName(oldCategory))) {
        throw new Error('التصنيف الأصلي غير موجود');
      }
      if (current.some(name => normalizeTabName(name) === normalizeTabName(category)
        && normalizeTabName(name) !== normalizeTabName(oldCategory))) {
        throw new Error('يوجد تصنيف آخر بهذا الاسم');
      }

      const sheet = getLibraryCategoriesSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const names = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < names.length; i++) {
          if (normalizeTabName(names[i][0]) === normalizeTabName(oldCategory)) {
            sheet.getRange(i + 2, 1).setValue(category);
          }
        }
      }
      const booksUpdated = renameLibraryCategoryInBooks(ss, oldCategory, category);
      return output({ success: true, message: 'تم تعديل اسم التصنيف', booksUpdated, categories: getLibraryCategoryNames(ss) });
    }

    if (action === 'saveArticle') {
      const sheet = getArticlesSheet(ss);

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

    if (action === 'saveBookRating') {
      const sheet = getBookRatingsSheet(ss);
      const bookId = String(data.bookId || '');
      const memberId = String(data.memberId || '');
      const ratingValue = Number(data.rating);
      if (!bookId || !memberId) throw new Error('معرّف الكتاب والعضو مطلوبان للتقييم');
      if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        throw new Error('التقييم يجب أن يكون من نجمة إلى خمس نجوم');
      }

      const rowData = [
        data.id || `${bookId}:${memberId}`, bookId, memberId,
        data.memberName || '', ratingValue, data.review || '', data.createdAt || Date.now()
      ];
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i][1]) === bookId && String(rows[i][2]) === memberId) {
            sheet.getRange(i + 2, 1, 1, rowData.length).setValues([rowData]);
            return output({ success: true, message: 'تم تحديث تقييم الكتاب' });
          }
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'تم حفظ تقييم الكتاب' });
    }

    if (action === 'saveMeeting') {
      const sheet = getMeetingsSheet(ss);
      const meetingId = String(data.id || '');
      if (!meetingId) throw new Error('معرّف اللقاء مطلوب');
      if (String(data.image || '').length > 48000) {
        throw new Error('حجم صورة اللقاء أكبر من الحد المسموح');
      }

      const rowData = [
        meetingId, data.title || '', data.description || '', data.date || '',
        data.time || '', data.location || '', data.image || '',
        data.createdAt || Date.now(), data.createdBy || ''
      ];
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === meetingId) {
            sheet.getRange(i + 2, 1, 1, rowData.length).setValues([rowData]);
            return output({ success: true, message: 'تم تحديث اللقاء' });
          }
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'تم حفظ اللقاء' });
    }

    if (action === 'saveRecordedMeeting') {
      const sheet = getRecordedMeetingsSheet(ss);
      const recordId = String(data.id || '');
      if (!recordId) throw new Error('معرّف التسجيل مطلوب');
      if (String(data.image || '').length > 48000) throw new Error('حجم صورة اللقاء أكبر من الحد المسموح');

      const rowData = [
        recordId, data.title || '', data.description || '', data.recordedAt || '',
        data.speaker || '', Number(data.views) || 0, data.duration || '',
        data.videoUrl || '', data.image || '', data.createdAt || Date.now(), data.createdBy || ''
      ];
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === recordId) {
            sheet.getRange(i + 2, 1, 1, rowData.length).setValues([rowData]);
            return output({ success: true, message: 'تم تحديث التسجيل' });
          }
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'تم حفظ التسجيل' });
    }

    if (action === 'deleteRecordedMeeting') {
      const sheet = getRecordedMeetingsSheet(ss);
      const recordId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === recordId) {
            sheet.deleteRow(i + 2);
            return output({ success: true, message: 'تم حذف التسجيل' });
          }
        }
      }
      return output({ success: true, message: 'التسجيل غير موجود' });
    }

    if (action === 'deleteMeeting') {
      const sheet = getMeetingsSheet(ss);
      const meetingId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === meetingId) {
            sheet.deleteRow(i + 2);
            return output({ success: true, message: 'تم حذف اللقاء' });
          }
        }
      }
      return output({ success: true, message: 'اللقاء غير موجود' });
    }

    if (action === 'deleteArticle') {
      const sheet = getArticlesSheet(ss);
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

    if (action === 'getLibraryCategories') {
      return output({ success: true, data: getLibraryCategoryNames(ss) });
    }

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
      const sheet = getArticlesSheet(ss);
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

    if (action === 'getBookRatings') {
      const sheet = getBookRatingsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      const ratings = rows.map(row => ({
        id: row[0], bookId: row[1], memberId: row[2], memberName: row[3],
        rating: Number(row[4]) || 0, review: row[5] || '', createdAt: row[6]
      })).filter(item => item.bookId && item.memberId);
      return output({ success: true, data: ratings });
    }

    if (action === 'getMeetings') {
      const sheet = getMeetingsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      const meetings = rows.map(row => ({
        id: row[0], title: row[1], description: row[2], date: row[3],
        time: row[4], location: row[5], image: row[6],
        createdAt: row[7], createdBy: row[8]
      })).filter(meeting => meeting.id);
      meetings.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return output({ success: true, data: meetings });
    }

    if (action === 'getRecordedMeetings') {
      const sheet = getRecordedMeetingsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
      const recordings = rows.map(row => ({
        id: row[0], title: row[1], description: row[2], recordedAt: row[3],
        speaker: row[4], views: Number(row[5]) || 0, duration: row[6],
        videoUrl: row[7], image: row[8], createdAt: row[9], createdBy: row[10]
      })).filter(record => record.id);
      recordings.sort((a, b) => {
        const dateA = new Date(a.recordedAt || a.createdAt || 0).getTime() || 0;
        const dateB = new Date(b.recordedAt || b.createdAt || 0).getTime() || 0;
        return dateB - dateA;
      });
      return output({ success: true, data: recordings });
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
