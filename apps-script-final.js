const QUOTES_SHEET = 'الاقتباسات';
const CODE_VERSION = 'jalees-2026-11-14-r52';
const BOOKS_SHEET = 'المكتبة';
const ARTICLES_SHEET = 'المقالات';
const BOOK_RATINGS_SHEET = 'تقييمات الكتب';
const LIBRARY_CATEGORIES_SHEET = 'تصنيفات المكتبة';
const JOIN_REQUESTS_SHEET = 'طلبات الانضمام';
const MEETINGS_SHEET = 'اللقاءات';
const RECORDED_MEETINGS_SHEET = 'أرشيف النادي';
const READING_TIPS_SHEET = 'النوافذ القرائية';
const PROFILES_SHEET = 'الملفات الشخصية';
const ENTRIES_SHEET = 'سجلات القراءة';
const LIKES_SHEET = 'الإعجابات';
const PERSONAL_BOOKS_SHEET = 'كتبي الخاصة';
const READING_LISTS_SHEET = 'القوائم القرائية';
const SELECTION_QUOTES_SHEET = 'مختارات الاقتباسات';
const WEEKLY_REPORTS_SHEET = 'التقارير الأسبوعية';
const DELETED_LOG_SHEET = 'سجل المحذوفات';
const BOOK_SUMMARIES_SHEET = 'ملخصات الأعضاء';
const NOTIFICATIONS_SHEET = 'التنبيهات';

const SPREADSHEET_ID = '1s_7SIePvvoBHcZSlqNqtNH9g6IIOCcr7GIKf7hC-46g';

/* حماية شاملة: أي دالة ورقة تعمل حتى لو لم يُمرَّر لها ss */
function resolveSpreadsheet(ss) {
  if (ss && typeof ss.getSheetByName === 'function') return ss;
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/* ---- الصور: تُرفع إلى Drive ويُخزَّن رابط قصير في الشيت بدل النص الطويل ---- */
const IMAGE_FOLDER_NAME = 'جليس - صور الموقع';

function imageFolderId() {
  const props = PropertiesService.getScriptProperties();
  const saved = String(props.getProperty('JALEES_IMAGE_FOLDER_ID') || '');
  if (saved) {
    try { DriveApp.getFolderById(saved); return saved; } catch (error) { /* أُنشئ مجلدًا جديدًا */ }
  }
  const existing = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  const folder = existing.hasNext() ? existing.next() : DriveApp.createFolder(IMAGE_FOLDER_NAME);
  props.setProperty('JALEES_IMAGE_FOLDER_ID', folder.getId());
  return folder.getId();
}

function storeImage(value, prefix) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const match = raw.match(/^data:image\/(jpeg|jpg|png|webp);base64,([\s\S]+)$/i);
  if (!match) return '';
  const type = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  const blob = Utilities.newBlob(
    Utilities.base64Decode(match[2]),
    `image/${type}`,
    `${prefix || 'image'}-${Date.now()}.${type === 'jpeg' ? 'jpg' : type}`
  );
  const file = DriveApp.getFolderById(imageFolderId()).createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) { /* قد تمنع سياسة النطاق المشاركة العامة */ }
  return `https://lh3.googleusercontent.com/d/${file.getId()}=w800`;
}

/* ---- ملفات عامة (صور وملفات PDF): تُرفع إلى Drive ويُخزَّن رابط ---- */
function storeFile(value, prefix, mimeType, extension) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const match = raw.match(/^data:([\w.+-]+)\/([\w.+-]+);base64,([\s\S]+)$/i);
  if (!match) return '';
  const type = String(mimeType || match[1] || 'application/octet-stream').toLowerCase();
  const ext = String(extension || match[2] || 'bin').toLowerCase() === 'jpeg' ? 'jpg' : String(extension || match[2] || 'bin').toLowerCase();
  const blob = Utilities.newBlob(
    Utilities.base64Decode(match[3]),
    type,
    `${prefix || 'file'}-${Date.now()}.${ext}`
  );
  const file = DriveApp.getFolderById(imageFolderId()).createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) { /* قد تمنع سياسة النطاق المشاركة العامة */ }
  return file.getId();
}

/* رفع ملف PDF إلى Drive وإرجاع رابط العرض */
function storePdf(value, prefix) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const match = raw.match(/^data:application\/pdf;base64,([\s\S]+)$/i);
  if (!match) return '';
  const blob = Utilities.newBlob(
    Utilities.base64Decode(match[1]),
    'application/pdf',
    `${prefix || 'pdf'}-${Date.now()}.pdf`
  );
  const file = DriveApp.getFolderById(imageFolderId()).createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) { /* تجاهل */ }
  return `https://drive.google.com/file/d/${file.getId()}/view`;
}

/* رفع قائمة صور (معرض صور اللقاء) إلى Drive وإرجاع روابطها كـ JSON */
function storeImageList(list, prefix) {
  if (!Array.isArray(list) || !list.length) return '';
  const urls = [];
  list.slice(0, 12).forEach((value) => {
    try {
      const url = storeImage(value, prefix);
      if (url) urls.push(url);
    } catch (error) { /* تجاهل الصورة الفاشلة */ }
  });
  return urls.length ? JSON.stringify(urls) : '';
}

/* قراءة روابط معرض الصور من خلية JSON */
function parseImageList(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.charAt(0) === '[') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item) : [];
    } catch (error) { return []; }
  }
  return [raw];
}

/* تصغير روابط الصور القديمة (w1400 → w800) لتقليل حجم الشيت وسرعة التحميل */
function shrinkImageLinks() {
  const ss = resolveSpreadsheet();
  const report = { updated: 0, sheets: 0 };
  const jobs = [
    { sheet: getMembersSheet(ss), column: 13 },
    { sheet: ss.getSheetByName(BOOKS_SHEET), column: 11 },
    { sheet: getMeetingsSheet(ss), column: 7 },
    { sheet: getRecordedMeetingsSheet(ss), column: 9 },
    { sheet: getReadingTipsSheet(ss), column: 4 },
    { sheet: getPersonalBooksSheet(ss), column: 8 },
    { sheet: getSelectionQuotesSheet(ss), column: 10 },
    { sheet: getWeeklyReportsSheet(ss), column: 5 }
  ];
  jobs.forEach((job) => {
    const sheet = job.sheet;
    if (!sheet) return;
    report.sheets += 1;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const range = sheet.getRange(2, job.column, lastRow - 1, 1);
    const values = range.getValues();
    let changed = 0;
    values.forEach((row, index) => {
      const value = String(row[0] || '');
      if (!/lh3\.googleusercontent\.com\/d\/[^=]+=w1400/.test(value)) return;
      const next = value.replace(/=w1400$/, '=w800');
      range.getRange(index + 1, 1, 1, 1).setValue(next);
      changed += 1;
    });
    report.updated += changed;
  });
  Logger.log(`shrinkImageLinks: ${JSON.stringify(report)}`);
  return report;
}

/* ---- سجل المحذوفات: شاهد دائم للكتب المحذوفة (حتى لو ضاع صفها) ---- */
function getDeletedLogSheet(ss) {
  return getDataSheet(ss, DELETED_LOG_SHEET, ['id', 'type', 'title', 'author', 'deletedAt', 'deletedBy']);
}

function logDeletedItem(ss, id, type, title, author, by) {
  const sheet = getDeletedLogSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
    for (let i = 0; i < ids.length; i++) {
      /* موجود مسبقًا — لا نكتب شيئًا (حتى لا يتكرر التعديل) */
      if (String(ids[i][0] || '') === String(id) && String(ids[i][1] || '') === String(type)) return;
    }
  }
  sheet.appendRow([String(id || ''), String(type || ''), title || '', author || '', Date.now(), by || 'مشرف']);
}

function clearDeletedLog(ss, id, type) {
  const sheet = getDeletedLogSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const ids = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0] || '') === String(id) && (!type || String(ids[i][1] || '') === String(type))) {
      sheet.deleteRow(i + 2);
    }
  }
}

/* قائمة الكتب المحذوفة المسجّلة (بالمعرّف والمفتاح) */
function deletedBookRegistry(ss) {
  const sheet = getDeletedLogSheet(ss);
  const ids = new Set();
  const keys = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ids: ids, keys: keys };
  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  rows.forEach((row) => {
    const type = String(row[1] || '');
    if (type === 'bookkey') { if (row[0]) keys.add(String(row[0])); return; }
    if (type !== 'book') return;
    if (row[0]) ids.add(String(row[0]));
    const key = bookKey(row[2], row[3]);
    if (key && key !== '|') keys.add(key);
  });
  return { ids: ids, keys: keys };
}

/* ---- ملخصات الأعضاء للكتب التي قرؤوها ---- */
function getBookSummariesSheet(ss) {
  return getDataSheet(ss, BOOK_SUMMARIES_SHEET, [
    'id', 'memberId', 'memberName', 'bookTitle', 'bookAuthor', 'summary', 'createdAt', 'deletedAt', 'deletedBy'
  ]);
}

/* ---- اقتباسات اختارها المشرف لتظهر في «مختارات النادي» ---- */
function getSelectionQuotesSheet(ss) {
  const sheet = getDataSheet(ss, SELECTION_QUOTES_SHEET, [
    'id', 'text', 'book', 'bookAuthor', 'authorName', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy', 'image', 'quoteId'
  ]);
  if (sheet.getMaxColumns() < 11) sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 10).getValue()) sheet.getRange(1, 10).setValue('image');
  if (!sheet.getRange(1, 11).getValue()) sheet.getRange(1, 11).setValue('quoteId');
  return sheet;
}

/* ---- التقارير الأسبوعية: صورة لكل أسبوع يرفعها المشرف ---- */
function getWeeklyReportsSheet(ss) {
  const sheet = getDataSheet(ss, WEEKLY_REPORTS_SHEET, [
    'id', 'weekNo', 'weekStart', 'weekEnd', 'image', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy',
    'title', 'pages', 'participants', 'notes', 'images'
  ]);
  if (sheet.getMaxColumns() < 14) sheet.insertColumnsAfter(sheet.getMaxColumns(), 14 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 10).getValue()) sheet.getRange(1, 10).setValue('title');
  if (!sheet.getRange(1, 11).getValue()) sheet.getRange(1, 11).setValue('pages');
  if (!sheet.getRange(1, 12).getValue()) sheet.getRange(1, 12).setValue('participants');
  if (!sheet.getRange(1, 13).getValue()) sheet.getRange(1, 13).setValue('notes');
  if (!sheet.getRange(1, 14).getValue()) sheet.getRange(1, 14).setValue('images');
  return sheet;
}

/* Google Sheets قد يحوّل التاريخ النصي إلى تاريخ؛ نعيده إلى YYYY-MM-DD */
function dateKeyOf(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Riyadh', 'yyyy-MM-dd');
  return String(value || '').slice(0, 10);
}

/* ---- قوائم قرائية مختارة (مختارات النادي) ---- */
function getReadingListsSheet(ss) {
  return getDataSheet(ss, READING_LISTS_SHEET, [
    'id', 'title', 'description', 'books', 'cover', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy'
  ]);
}

/* ---- الإعجابات: جدول مشترك بين الاقتباسات والمقالات ---- */
function getLikesSheet(ss) {
  return getDataSheet(ss, LIKES_SHEET, ['type', 'targetId', 'memberId', 'memberName', 'createdAt']);
}

/* ---- كتب العضو الخاصة (تنتقل بين الأجهزة) ---- */
function getPersonalBooksSheet(ss) {
  const sheet = getDataSheet(ss, PERSONAL_BOOKS_SHEET, [
    'memberId', 'memberName', 'bookId', 'title', 'author', 'pages',
    'coverColor', 'pdfUrl', 'createdAt', 'coverColor2', 'coverImage'
  ]);
  if (sheet.getMaxColumns() < 11) sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 10).getValue()) sheet.getRange(1, 10).setValue('coverColor2');
  if (!sheet.getRange(1, 11).getValue()) sheet.getRange(1, 11).setValue('coverImage');
  return sheet;
}

/* ترحيل الصور القديمة المخزّنة كنص طويل (base64) إلى Drive — تُشغَّل يدويًا مرة واحدة */
function migrateImagesToDrive() {
  const ss = resolveSpreadsheet();
  const report = { members: 0, books: 0, meetings: 0, recordings: 0, tips: 0, errors: 0 };
  const jobs = [
    { sheet: getMembersSheet(ss), column: 13, prefix: 'member', key: 'members' },
    { sheet: ss.getSheetByName(BOOKS_SHEET), column: 11, prefix: 'book', key: 'books' },
    { sheet: getMeetingsSheet(ss), column: 7, prefix: 'meeting', key: 'meetings' },
    { sheet: getRecordedMeetingsSheet(ss), column: 9, prefix: 'recording', key: 'recordings' },
    { sheet: getReadingTipsSheet(ss), column: 4, prefix: 'tip', key: 'tips' }
  ];
  jobs.forEach((job) => {
    const sheet = job.sheet;
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    for (let row = 2; row <= lastRow; row++) {
      const cell = sheet.getRange(row, job.column);
      const value = String(cell.getValue() || '');
      if (!/^data:image\//i.test(value)) continue;
      try {
        const url = storeImage(value, job.prefix);
        if (url) {
          cell.setValue(url);
          report[job.key] += 1;
        }
      } catch (error) {
        report.errors += 1;
      }
    }
  });
  Logger.log(`migrateImagesToDrive: ${JSON.stringify(report)}`);
  return report;
}

function getProfilesSheet(ss) {
  return getDataSheet(resolveSpreadsheet(ss), PROFILES_SHEET, ['memberId', 'name', 'role', 'joined', 'goal', 'lastWeekPages', 'notifications']);
}
function getEntriesSheet(ss) {
  return getDataSheet(resolveSpreadsheet(ss), ENTRIES_SHEET, ['id', 'memberId', 'memberName', 'bookId', 'bookTitle', 'pages', 'date', 'createdAt']);
}

function getReadingTipsSheet(ss) {
  const target = resolveSpreadsheet(ss);
  let sheet = target.getSheetByName(READING_TIPS_SHEET);
  if (!sheet) sheet = target.insertSheet(READING_TIPS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'title', 'body', 'image', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy']);
  }
  return sheet;
}
const MEMBERS_SHEET = 'الأعضاء';
const CONSULTATIONS_SHEET = 'استشارات الأعضاء';
const OLD_BOOKS_SHEET_ID = 1035156833;
const SUPERVISOR_NAMES = ['مشعل عبدالرحمن الحفير', 'مشعل الحفير', 'محمد صالح الدبيخي', 'محمد الدبيخي'];
// تُضاف أسماء المستشارين المعتمدين هنا بعد استلامها؛ لا يُسمح بالإجابة قبل اعتماد الاسم.
const CONSULTANT_NAMES = [];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_ROUNDS = 10000;
const DEFAULT_LIBRARY_CATEGORIES = [
  'أدب', 'إدارة', 'اقتصاد', 'أسرة وطفولة', 'تاريخ', 'تاريخ إسلامي', 'تاريخ سعودي',
  'تربية', 'تنمية ذاتية', 'تراجم', 'تقنية', 'تعليم', 'تفسير وعلوم القرآن', 'ثقافة عامة',
  'جغرافيا ورحلات', 'حديث وسيرة نبوية', 'حكايات شعبية', 'رواية', 'رواية تاريخية',
  'رياضة', 'سيرة', 'سيرة ذاتية', 'شعر', 'صحة', 'علم اجتماع', 'علم نفس', 'علوم',
  'فكر', 'فكر وفلسفة', 'فن ومسرح', 'قصة قصيرة', 'قصص أطفال', 'لغة عربية', 'مذكرات',
  'مقالات', 'فنون', 'فقه', 'تطوير', 'تجارب', 'أخرى'
];

function output(data) {
  const payload = (data && typeof data === 'object') ? { ...data } : { data: data };
  payload.version = CODE_VERSION;
  return ContentService
    .createTextOutput(JSON.stringify(payload))
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
  const target = resolveSpreadsheet(ss);
  let sheet = target.getSheetByName(MEETINGS_SHEET);
  if (!sheet) sheet = target.insertSheet(MEETINGS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'title', 'description', 'date', 'time', 'location', 'image', 'createdAt', 'createdBy', 'imagePosX', 'imagePosY', 'imageScale']);
  } else {
    ensureMeetingCropColumns(sheet);
  }
  return sheet;
}

function ensureMeetingCropColumns(sheet) {
  if (!sheet) return;
  if (sheet.getMaxColumns() < 12) sheet.insertColumnsAfter(sheet.getMaxColumns(), 12 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 10).getValue()) sheet.getRange(1, 10).setValue('imagePosX');
  if (!sheet.getRange(1, 11).getValue()) sheet.getRange(1, 11).setValue('imagePosY');
  if (!sheet.getRange(1, 12).getValue()) sheet.getRange(1, 12).setValue('imageScale');
}

function getRecordedMeetingsSheet(ss) {
  const target = resolveSpreadsheet(ss);
  let sheet = target.getSheetByName(RECORDED_MEETINGS_SHEET);
  if (!sheet) sheet = target.insertSheet(RECORDED_MEETINGS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'title', 'description', 'recordedAt', 'speaker', 'views', 'duration', 'videoUrl', 'image', 'createdAt', 'createdBy', '', '', 'type', 'location', 'images']);
  }
  ensureRecordedMeetingDeleteColumns(sheet);
  if (sheet.getMaxColumns() < 16) sheet.insertColumnsAfter(sheet.getMaxColumns(), 16 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 14).getValue()) sheet.getRange(1, 14).setValue('type');
  if (!sheet.getRange(1, 15).getValue()) sheet.getRange(1, 15).setValue('location');
  if (!sheet.getRange(1, 16).getValue()) sheet.getRange(1, 16).setValue('images');
  return sheet;
}

function ensureQuoteDeleteColumns(sheet) {
  if (sheet.getMaxColumns() < 9) sheet.insertColumnsAfter(sheet.getMaxColumns(), 9 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 6).getValue()) sheet.getRange(1, 6).setValue('id');
  if (!sheet.getRange(1, 7).getValue()) sheet.getRange(1, 7).setValue('deletedAt');
  if (!sheet.getRange(1, 8).getValue()) sheet.getRange(1, 8).setValue('deletedBy');
  if (!sheet.getRange(1, 9).getValue()) sheet.getRange(1, 9).setValue('bookAuthor');
}

/* ---- الاقتباسات: تُنشأ تلقائيًا إن ضاع التبويب ---- */
function getQuotesSheet(ss) {
  let sheet = ss.getSheetByName(QUOTES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(QUOTES_SHEET);
    sheet.appendRow(['created_at', 'author_name', 'page_number', 'book_title', 'quote_text', 'id', 'deletedAt', 'deletedBy', 'bookAuthor']);
  }
  ensureQuoteDeleteColumns(sheet);
  return sheet;
}

function ensureBookDeleteColumns(sheet) {
  if (sheet.getMaxColumns() < 16) sheet.insertColumnsAfter(sheet.getMaxColumns(), 16 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 11).getValue()) sheet.getRange(1, 11).setValue('coverImage');
  if (!sheet.getRange(1, 12).getValue()) sheet.getRange(1, 12).setValue('deletedAt');
  if (!sheet.getRange(1, 13).getValue()) sheet.getRange(1, 13).setValue('deletedBy');
  if (!sheet.getRange(1, 14).getValue()) sheet.getRange(1, 14).setValue('year');
  if (!sheet.getRange(1, 15).getValue()) sheet.getRange(1, 15).setValue('pdfUrl');
  if (!sheet.getRange(1, 16).getValue()) sheet.getRange(1, 16).setValue('coverColor2');
}

function ensureArticleDeleteColumns(sheet) {
  if (sheet.getMaxColumns() < 11) sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 10).getValue()) sheet.getRange(1, 10).setValue('deletedAt');
  if (!sheet.getRange(1, 11).getValue()) sheet.getRange(1, 11).setValue('deletedBy');
}

function ensureRecordedMeetingDeleteColumns(sheet) {
  if (sheet.getMaxColumns() < 13) sheet.insertColumnsAfter(sheet.getMaxColumns(), 13 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 12).getValue()) sheet.getRange(1, 12).setValue('deletedAt');
  if (!sheet.getRange(1, 13).getValue()) sheet.getRange(1, 13).setValue('deletedBy');
}

function paintDeletedRow(sheet, row, deleted, width) {
  const columns = Math.min(Math.max(Number(width) || sheet.getMaxColumns(), 1), sheet.getMaxColumns());
  const range = sheet.getRange(row, 1, 1, columns);
  if (deleted) {
    range.setBackground('#f4cccc');
    range.setFontColor('#9c0006');
  } else {
    try { range.setBackground(null); } catch (error) { /* تجاهل */ }
    try { range.setFontColor(null); } catch (error) { /* تجاهل */ }
  }
}

/* ---- طلبات الانضمام: حالة الطلب ولون الصف ---- */
const JOIN_REQUEST_COLORS = {
  pending: { background: '#efefef', font: '#555555' },
  accepted: { background: '#d9ead3', font: '#274e13' },
  rejected: { background: '#f4cccc', font: '#9c0006' }
};

function getJoinRequestsSheet(ss) {
  const sheet = getDataSheet(ss, JOIN_REQUESTS_SHEET, [
    'name', 'phone', 'note', 'ts', 'status', 'decidedAt', 'decidedBy'
  ]);
  if (sheet.getMaxColumns() < 7) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 7 - sheet.getMaxColumns());
  }
  const headers = sheet.getRange(1, 1, 1, 7).getValues()[0];
  if (!headers[4]) sheet.getRange(1, 5, 1, 3).setValues([['status', 'decidedAt', 'decidedBy']]);
  return sheet;
}

function normalizeJoinStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return status === 'accepted' || status === 'rejected' ? status : 'pending';
}

function paintJoinRequestRow(sheet, row, status) {
  const color = JOIN_REQUEST_COLORS[normalizeJoinStatus(status)];
  const range = sheet.getRange(row, 1, 1, 7);
  range.setBackground(color.background);
  range.setFontColor(color.font);
}

function ensureJoinRequestStatuses(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, 1, lastRow - 1, 7);
  const rows = range.getValues();
  let changed = false;
  rows.forEach((row) => {
    if (!row[4]) { row[4] = 'pending'; changed = true; }
  });
  if (changed) range.setValues(rows);
  rows.forEach((row, index) => {
    if (!String(row[0] || '').trim() && !String(row[1] || '').trim()) return;
    paintJoinRequestRow(sheet, index + 2, normalizeJoinStatus(row[4]));
  });
}

/* ---- حسابات الأعضاء: حالة الحساب ولون الصف ---- */
const MEMBER_STATUS_COLORS = {
  active: { background: '#d9ead3', font: '#274e13' },
  pending: { background: '#efefef', font: '#555555' },
  rejected: { background: '#f4cccc', font: '#9c0006' },
  banned: { background: '#4a4a4a', font: '#ffffff' }
};

function memberStatusCode(value) {
  const status = String(value || '').trim().toLowerCase();
  if (!status || status === 'active') return 'active';
  if (status === 'rejected') return 'rejected';
  if (status === 'banned' || status === 'طرد' || status === 'blocked') return 'banned';
  return 'pending';
}

function paintMemberRow(sheet, row, status) {
  const color = MEMBER_STATUS_COLORS[memberStatusCode(status)];
  const width = Math.min(13, sheet.getMaxColumns());
  const range = sheet.getRange(row, 1, 1, width);
  range.setBackground(color.background);
  range.setFontColor(color.font);
}

function normalizeTabName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u0640]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function getDataSheet(ss, name, headers) {
  const target = resolveSpreadsheet(ss);
  let sheet = target.getSheetByName(name);
  if (!sheet) {
    const wanted = normalizeTabName(name);
    const all = typeof target.getSheets === 'function' ? target.getSheets() : [];
    sheet = all.find((item) => normalizeTabName(item.getName()) === wanted) || null;
  }
  if (!sheet) sheet = target.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function getArticlesSheet(ss) {
  const sheet = getDataSheet(ss, ARTICLES_SHEET, ['id', 'memberId', 'memberName', 'title', 'category', 'body', 'excerpt', 'read', 'createdAt']);
  ensureArticleDeleteColumns(sheet);
  return sheet;
}

/* ==========================================================================
   نظام التنبيهات: إشعار داخل الموقع + إرسال فعلي إلى جوال المشرف
   ========================================================================== */
const NOTIFICATION_TYPES = {
  register: { label: 'طلب تسجيل', icon: 'user' },
  join: { label: 'طلب انضمام', icon: 'user' },
  consultation: { label: 'استشارة', icon: 'chat' },
  article: { label: 'مقال', icon: 'article' },
  book: { label: 'كتاب', icon: 'book' },
  weekly: { label: 'تقرير أسبوعي', icon: 'calendar' },
  archive: { label: 'أرشيف', icon: 'library' },
  window: { label: 'نافذة قرائية', icon: 'quote' },
  selection: { label: 'اقتباس مختار', icon: 'quote' },
  summary: { label: 'ملخص', icon: 'book' },
  member: { label: 'عضو', icon: 'user' }
};

function getNotificationsSheet(ss) {
  return getDataSheet(ss, NOTIFICATIONS_SHEET, [
    'id', 'type', 'title', 'body', 'memberId', 'memberName', 'createdAt', 'readAt', 'link'
  ]);
}

/* ---- إعدادات قناة الإرسال (تُحفظ في خصائص السكربت) ---- */
function pushSettings() {
  let props = {};
  try { props = PropertiesService.getScriptProperties(); } catch (error) { props = {}; }
  const get = (key, fallback) => {
    try { return String(props.getProperty(key) || fallback || ''); } catch (error) { return fallback || ''; }
  };
  /* عدة محادثات مفصولة بفاصلة — للمشاركة مع أكثر من مشرف أو مجموعة */
  const chats = get('JALEES_TELEGRAM_CHAT', '6584082937')
    .split(/[,;\n\r]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    channel: (get('JALEES_PUSH_CHANNEL', 'email') || 'email').toLowerCase(),
    emailProvider: (get('JALEES_EMAIL_PROVIDER', 'email') || 'email').toLowerCase(),
    telegramToken: get('JALEES_TELEGRAM_TOKEN', ''),
    telegramChat: chats[0] || '',
    telegramChats: chats,
    ntfyTopic: get('JALEES_NTFY_TOPIC', ''),
    resendKey: get('JALEES_RESEND_KEY', ''),
    resendFrom: get('JALEES_RESEND_FROM', ''),
    brevoKey: get('JALEES_BREVO_KEY', ''),
    brevoFrom: get('JALEES_BREVO_FROM', ''),
    brevoName: get('JALEES_BREVO_NAME', 'نادي جليس القرائي'),
    mailjetPublic: get('JALEES_MAILJET_PUBLIC', ''),
    mailjetPrivate: get('JALEES_MAILJET_PRIVATE', ''),
    mailjetFrom: get('JALEES_MAILJET_FROM', ''),
    pushoverToken: get('JALEES_PUSHOVER_TOKEN', ''),
    pushoverUser: get('JALEES_PUSHOVER_USER', ''),
    types: get('JALEES_PUSH_TYPES', ''),
    siteUrl: get('JALEES_SITE_URL', '')
  };
}

function pushEnabledTypes() {
  const settings = pushSettings();
  const list = String(settings.types || '').split(',').map((t) => t.trim()).filter(Boolean);
  return list.length ? new Set(list) : new Set(Object.keys(NOTIFICATION_TYPES));
}

/* ---- الإرسال الفعلي إلى الجوال (تيليجرام / ntfy / Pushover / بريد) ---- */
function sendPushNotification(ss, type, title, body, link) {
  const settings = pushSettings();
  const originalChannel = settings.channel;
  let channel = originalChannel;
  /* backward compat: old settings used channel=resend/brevo/mailjet for email updates */
  if (['resend', 'brevo', 'mailjet'].indexOf(channel) >= 0) {
    channel = 'email';
  }
  if (!channel || channel === 'off' || channel === 'none') {
    return { sent: false, channel: channel, detail: 'الإرسال مُعطّل' };
  }
  const text = link ? (title + '\n' + body + '\n' + link) : (title + '\n' + body);
  try {
    if (channel === 'telegram') {
      const chats = settings.telegramChats || [];
      if (!settings.telegramToken || !chats.length) throw new Error('إعدادات تيليجرام ناقصة');
      const url = 'https://api.telegram.org/bot' + settings.telegramToken + '/sendMessage';
      let sent = 0;
      const failures = [];
      for (const chat of chats) {
        try {
          const res = UrlFetchApp.fetch(url, {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify({
              chat_id: chat,
              text: text,
              disable_web_page_preview: true
            }),
            muteHttpExceptions: true
          });
          const code = res.getResponseCode();
          const body = String(res.getContentText() || '');
          if (code < 200 || code >= 300) throw new Error('تيليجرام ' + code + ': ' + body.slice(0, 120));
          try {
            const parsed = JSON.parse(body);
            if (parsed && parsed.ok === false) throw new Error('تيليجرام: ' + String((parsed.description || 'خطأ') || '').slice(0, 120));
          } catch (parseError) {
            if (parseError && /تيليجرام/.test(String(parseError.message || ''))) throw parseError;
          }
          sent += 1;
        } catch (chatError) {
          failures.push(chat + ': ' + String((chatError && chatError.message) || chatError).slice(0, 90));
        }
      }
      if (!sent) throw new Error('فشل الإرسال لكل المحادثات — ' + (failures[0] || '؟'));
      return {
        sent: true,
        channel: channel,
        detail: 'أُرسل عبر تيليجرام إلى ' + sent + ' محادثة' + (failures.length ? ' · فشل ' + failures.length : '')
      };
    }

    if (channel === 'ntfy') {
      if (!settings.ntfyTopic) throw new Error('مجلد ntfy غير محدد');
      const res = UrlFetchApp.fetch('https://ntfy.sh/' + encodeURIComponent(settings.ntfyTopic), {
        method: 'post',
        contentType: 'text/plain; charset=utf-8',
        payload: text,
        headers: {
          Title: String(title || 'جليس').slice(0, 100),
          Tags: 'books',
          Priority: 'default',
          Click: String(link || settings.siteUrl || '')
        },
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      if (code < 200 || code >= 300) throw new Error('ntfy: ' + code + ' ' + String(res.getContentText() || '').slice(0, 120));
      return { sent: true, channel: channel, detail: 'أُرسل عبر ntfy' };
    }

    if (channel === 'pushover') {
      if (!settings.pushoverToken || !settings.pushoverUser) throw new Error('إعدادات Pushover ناقصة');
      const res = UrlFetchApp.fetch('https://api.pushover.net/1/messages.json', {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: {
          token: settings.pushoverToken,
          user: settings.pushoverUser,
          title: String(title || 'جليس'),
          message: String(body || ''),
          url: String(link || settings.siteUrl || ''),
          sound: 'push'
        },
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      if (code < 200 || code >= 300) throw new Error('Pushover: ' + code + ' ' + String(res.getContentText() || '').slice(0, 120));
      return { sent: true, channel: channel, detail: 'أُرسل عبر Pushover' };
    }

    /* مزوّدات البريد الاحترافية: تُرسل التنبيه إلى بريد النادي (نفس سلوك قناة البريد) */
    /* إرسال تحديثات المشرف عبر البريد (email provider) — مستقل عن قناة التحديثات */
    if (channel === 'email' || channel === 'resend' || channel === 'brevo' || channel === 'mailjet') {
      const provider = (['resend', 'brevo', 'mailjet'].indexOf(originalChannel) >= 0)
        ? originalChannel
        : ((settings.emailProvider && settings.emailProvider !== 'email') ? settings.emailProvider : 'email');
      const html = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#1E3A2B">'
        + '<p style="color:#8C532D;font-size:11px;margin:0 0 6px">نادي جليس القرائي</p>'
        + '<h2 style="margin:0 0 10px">' + String(title || 'جليس') + '</h2>'
        + '<p>' + String(body || '') + '</p>'
        + (link ? '<p><a href="' + link + '">افتح الموقع</a></p>' : '') + '</div>';
      const plain = ['نادي جليس القرائي', title || 'جليس', body || '', link || ''].filter(Boolean).join('\n');
      if (provider === 'resend' && settings.resendKey && settings.resendFrom) {
        const res = UrlFetchApp.fetch('https://api.resend.com/emails', {
          method: 'post', contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + settings.resendKey },
          payload: JSON.stringify({ from: settings.resendFrom, to: [MAIL_FROM], subject: 'جليس | ' + String(title || 'تنبيه جديد').slice(0, 80), text: plain, html: html }),
          muteHttpExceptions: true
        });
        const status = res.getResponseCode();
        const responseBody = String(res.getContentText() || '');
        if (status < 200 || status >= 300) throw new Error('مزوّد البريد ' + status + ': ' + responseBody.slice(0, 160));
        return { sent: true, channel: 'email', detail: 'أُرسل عبر مزوّد البريد' };
      }
      if (provider === 'brevo' && settings.brevoKey && settings.brevoFrom) {
        const res = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'post', contentType: 'application/json',
          headers: { 'api-key': settings.brevoKey },
          payload: JSON.stringify({ sender: { name: settings.brevoName || 'نادي جليس القرائي', email: settings.brevoFrom }, to: [{ email: MAIL_FROM }], subject: 'جليس | ' + String(title || 'تنبيه جديد').slice(0, 80), htmlContent: html, textContent: plain }),
          muteHttpExceptions: true
        });
        const status = res.getResponseCode();
        const responseBody = String(res.getContentText() || '');
        if (status < 200 || status >= 300) throw new Error('Brevo ' + status + ': ' + responseBody.slice(0, 160));
        return { sent: true, channel: 'email', detail: 'أُرسل عبر Brevo' };
      }
      if (provider === 'mailjet' && settings.mailjetPublic && settings.mailjetPrivate && settings.mailjetFrom) {
        const auth = Utilities.base64Encode(settings.mailjetPublic + ':' + settings.mailjetPrivate);
        const res = UrlFetchApp.fetch('https://api.mailjet.com/v3.1/send', {
          method: 'post', contentType: 'application/json',
          headers: { Authorization: 'Basic ' + auth },
          payload: JSON.stringify({ Messages: [{ From: { Email: settings.mailjetFrom, Name: 'نادي جليس القرائي' }, To: [{ Email: MAIL_FROM }], Subject: 'جليس | ' + String(title || 'تنبيه جديد').slice(0, 80), TextPart: plain, HTMLPart: html }] }),
          muteHttpExceptions: true
        });
        const status = res.getResponseCode();
        const responseBody = String(res.getContentText() || '');
        if (status < 200 || status >= 300) throw new Error('Mailjet ' + status + ': ' + responseBody.slice(0, 160));
        return { sent: true, channel: 'email', detail: 'أُرسل عبر Mailjet' };
      }
      const opts = { to: MAIL_FROM, subject: 'جليس | ' + String(title || 'تنبيه جديد').slice(0, 80), body: plain, htmlBody: html };
      try { MailApp.sendEmail(opts); } catch (firstError) { MailApp.sendEmail({ to: MAIL_FROM, subject: opts.subject, body: plain, htmlBody: html }); }
      return { sent: true, channel: 'email', detail: 'أُرسل إلى بريد النادي' };
    }


    return { sent: false, channel: channel, detail: 'قناة غير معروفة' };
  } catch (error) {
    return { sent: false, channel: channel, detail: String((error && error.message) || error) };
  }
}

/* ---- تسجيل تنبيه وإرساله ---- */
function notifySupervisors(ss, type, title, body, link, memberId, memberName) {
  /* النوع غير المفعّل = لا تسجيل ولا إرسال */
  if (!pushEnabledTypes().has(String(type || 'member'))) {
    return { stored: false, push: { sent: false, channel: 'off', detail: 'نوع غير مفعّل' } };
  }

  let stored = false;
  try {
    const id = 'n-' + Date.now() + '-' + Math.floor(Math.random() * 900 + 100);
    getNotificationsSheet(ss).appendRow([
      id, String(type || 'member'), String(title || ''), String(body || ''),
      String(memberId || ''), String(memberName || ''), Date.now(), '', String(link || '')
    ]);
    stored = true;
  } catch (error) { /* السجل لا يمنع الإرسال */ }

  let push = { sent: false, channel: 'off', detail: 'تعذّر الإرسال' };
  try {
    push = sendPushNotification(ss, type, title, body, link);
  } catch (error) {
    push = { sent: false, channel: 'off', detail: String((error && error.message) || error) };
  }
  try { logMailAttempt(ss, String(memberId || title || 'تنبيه'), push.sent ? 'push-sent' : 'push-failed', push.detail, ''); } catch (error) {}
  return { stored: stored, push: push };
}


function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  let text = String(value || '')
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\s().-]/g, '');
  /* الصيغة الدولية تُحوَّل إلى الصيغة المحلية — وإلا تفوت المطرود بصيغة أخرى */
  text = text.replace(/^\+?00966/, '0').replace(/^\+?966/, '0');
  return text;
}

function normalizePersonName(value) {
  return String(value || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
    .trim();
}

function isSupervisorName(name) {
  const target = normalizePersonName(name);
  if (!target) return false;
  return SUPERVISOR_NAMES.some(item => normalizePersonName(item) === target);
}

function isConsultantName(name) {
  const target = normalizePersonName(name);
  if (!target) return false;
  // Hardcoded consultants (legacy)
  if (CONSULTANT_NAMES.some(item => normalizePersonName(item) === target)) return true;
  // Dynamic: check members sheet role
  try {
    const ss = SpreadsheetApp.openById('1s_7SIePvvoBHcZSlqNqtNH9g6IIOCcr7GIKf7hC-46g');
    const sheet = getMembersSheet(ss);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (normalizePersonName(rows[i][1]) === target) {
        const role = String(rows[i][5] || '').toLowerCase();
        return role === 'consultant' || role === 'supervisor';
      }
    }
  } catch (error) { /* تجاهل */ }
  return false;
}

function utf8Bytes(text) {
  const str = String(text);
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        const point = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        bytes.push(
          0xf0 | (point >> 18),
          0x80 | ((point >> 12) & 63),
          0x80 | ((point >> 6) & 63),
          0x80 | (point & 63)
        );
        i++;
      } else {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
      }
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    }
  }
  return bytes;
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256Bytes(input) {
  const bytes = Array.prototype.slice.call(input);
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 9) + 63) >> 6) << 6;
  const padded = new Array(paddedLength).fill(0);
  for (let i = 0; i < bytes.length; i++) padded[i] = bytes[i] & 255;
  padded[bytes.length] = 0x80;

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  padded[paddedLength - 8] = (high >>> 24) & 255;
  padded[paddedLength - 7] = (high >>> 16) & 255;
  padded[paddedLength - 6] = (high >>> 8) & 255;
  padded[paddedLength - 5] = high & 255;
  padded[paddedLength - 4] = (low >>> 24) & 255;
  padded[paddedLength - 3] = (low >>> 16) & 255;
  padded[paddedLength - 2] = (low >>> 8) & 255;
  padded[paddedLength - 1] = low & 255;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const words = new Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      words[i] = ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) | 0;
    }
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15];
      const y = words[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) | 0;
    }

    let aa = hash[0];
    let bb = hash[1];
    let cc = hash[2];
    let dd = hash[3];
    let ee = hash[4];
    let ff = hash[5];
    let gg = hash[6];
    let hh = hash[7];

    for (let i = 0; i < 64; i++) {
      const S1 = ((ee >>> 6) | (ee << 26)) ^ ((ee >>> 11) | (ee << 21)) ^ ((ee >>> 25) | (ee << 7));
      const ch = (ee & ff) ^ (~ee & gg);
      const temp1 = (hh + S1 + ch + SHA256_K[i] + words[i]) | 0;
      const S0 = ((aa >>> 2) | (aa << 30)) ^ ((aa >>> 13) | (aa << 19)) ^ ((aa >>> 22) | (aa << 10));
      const maj = (aa & bb) ^ (aa & cc) ^ (bb & cc);
      const temp2 = (S0 + maj) | 0;

      hh = gg;
      gg = ff;
      ff = ee;
      ee = (dd + temp1) | 0;
      dd = cc;
      cc = bb;
      bb = aa;
      aa = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + aa) | 0;
    hash[1] = (hash[1] + bb) | 0;
    hash[2] = (hash[2] + cc) | 0;
    hash[3] = (hash[3] + dd) | 0;
    hash[4] = (hash[4] + ee) | 0;
    hash[5] = (hash[5] + ff) | 0;
    hash[6] = (hash[6] + gg) | 0;
    hash[7] = (hash[7] + hh) | 0;
  }

  const out = [];
  hash.forEach((word) => {
    out.push((word >>> 24) & 255, (word >>> 16) & 255, (word >>> 8) & 255, word & 255);
  });
  return out;
}

function sha256Hex(text) {
  return bytesToHex(sha256Bytes(utf8Bytes(text)));
}

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
  }
  return hex;
}

function hashPassword(password, salt) {
  let digest = sha256Bytes(utf8Bytes(`${salt}:${password}`));
  for (let i = 0; i < PASSWORD_ROUNDS; i++) digest = sha256Bytes(digest);
  return `v2:${bytesToHex(digest)}`;
}

function legacyHashPassword(password, salt) {
  let bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${salt}:${password}`,
    Utilities.Charset.UTF_8
  );
  for (let i = 0; i < 200; i++) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  }
  return bytes.map((byte) => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function verifyPassword(password, salt, stored) {
  const expected = String(stored || '');
  if (!expected) return false;
  if (expected.indexOf('v2:') === 0) return hashPassword(password, salt) === expected;
  return legacyHashPassword(password, salt) === expected;
}

function isLegacyPasswordHash(stored) {
  const text = String(stored || '');
  return Boolean(text) && text.indexOf('v2:') !== 0;
}

function getMembersSheet(ss) {
  const sheet = getDataSheet(ss, MEMBERS_SHEET, [
    'id', 'name', 'email', 'passwordHash', 'salt', 'role',
    'status', 'createdAt', 'lastLogin', 'resetCode', 'resetExpires', 'phone', 'profilePhoto'
  ]);
  if (sheet.getMaxColumns() < 13) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 13 - sheet.getMaxColumns());
  }
  if (!sheet.getRange(1, 12).getValue()) sheet.getRange(1, 12).setValue('phone');
  if (!sheet.getRange(1, 13).getValue()) sheet.getRange(1, 13).setValue('profilePhoto');
  // عمود نوع العضوية: 14 = memberType (عضو / صديق) — عمود منفصل عن كلمة المرور
  if (sheet.getMaxColumns() < 14) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 14 - sheet.getMaxColumns());
  }
  const typeHeader = String(sheet.getRange(1, 14).getValue() || '').trim();
  if (!typeHeader) sheet.getRange(1, 14).setValue('memberType');
  return sheet;
}

function getMyBooksSheet(ss) {
  return getDataSheet(ss, 'مكتبات الأعضاء', ['memberId', 'memberName', 'bookId', 'status', 'currentPage', 'addedAt']);
}
function getConsultationsSheet(ss) {
  const sheet = getDataSheet(ss, CONSULTATIONS_SHEET, [
    'id', 'memberId', 'memberName', 'question', 'askedAt',
    'answer', 'answeredById', 'answeredBy', 'answeredAt'
  ]);
  if (sheet.getMaxColumns() < 9) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 9 - sheet.getMaxColumns());
  }
  return sheet;
}

function findMemberRow(sheet, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const target = normalizeEmail(email);
  if (!target) return -1;
  const rows = sheet.getRange(2, 3, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    if (normalizeEmail(rows[i][0]) === target) return i + 2;
  }
  return -1;
}

/* البحث عن حساب مطرود بالبريد أو برقم الجوال */
function findBannedRow(sheet, email, phone) {
  const targetEmail = normalizeEmail(email);
  const targetPhone = normalizePhone(phone);
  if (!targetEmail && !targetPhone) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (memberStatusCode(rows[i][6]) !== 'banned') continue;
    if (targetEmail && normalizeEmail(rows[i][2]) === targetEmail) return i + 2;
    if (targetPhone && normalizePhone(rows[i][11]) === targetPhone) return i + 2;
  }
  return -1;
}

function findMemberRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  const target = String(id || '').trim();
  if (lastRow < 2 || !target) return -1;
  const rows = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === target) return i + 2;
  }
  return -1;
}

function getMemberPhotosForIds(ss, memberIds) {
  const photos = {};
  const wanted = new Set((memberIds || []).map(id => String(id || '')).filter(Boolean));
  if (!wanted.size) return photos;
  const sheet = getMembersSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return photos;
  const rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  rows.forEach(row => {
    const id = String(row[0] || '');
    if (wanted.has(id) && row[12]) photos[id] = String(row[12]);
  });
  return photos;
}

function findMemberRowsByName(sheet, name) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const target = normalizePersonName(name);
  if (!target) return [];
  const rows = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    if (normalizePersonName(rows[i][0]) === target) matches.push(i + 2);
  }
  return matches;
}

function memberRecord(values) {
  return {
    id: String(values[0] || ''),
    name: String(values[1] || ''),
    email: String(values[2] || ''),
    role: String(values[5] || 'member'),
    status: String(values[6] || 'active'),
    photo: String(values[12] || '')
  };
}

/* ---- طلبات التسجيل المنتظرة لتأكيد البريد ---- */
function pendingRegistrationKey(email) {
  return `pending-registration:${normalizeEmail(email)}`;
}

function readPendingRegistration(email) {
  const raw = PropertiesService.getScriptProperties().getProperty(pendingRegistrationKey(email));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (error) { return null; }
}

function savePendingRegistration(record) {
  PropertiesService.getScriptProperties().setProperty(
    pendingRegistrationKey(record.email),
    JSON.stringify(record)
  );
}

function clearPendingRegistration(email) {
  PropertiesService.getScriptProperties().deleteProperty(pendingRegistrationKey(email));
}

const MAIL_FROM = 'jjalees.com@gmail.com';
const MAIL_NAME = 'نادي جليس القرائي';
const MAIL_REPLY = 'jjalees.com@gmail.com';

/* ---- سجل الإرسال: لتعرف الإدارة ما الذي أُرسل ولمن وهل نجح ---- */
const MAIL_LOG_SHEET = 'سجل الإرسال';

function getMailLogSheet(ss) {
  return getDataSheet(ss, MAIL_LOG_SHEET, ['email', 'sentAt', 'status', 'detail', 'code']);
}

function logMailAttempt(ss, email, status, detail, code) {
  try {
    getMailLogSheet(ss).appendRow([
      String(email || ''), Date.now(), String(status || ''), String(detail || ''), String(code || '')
    ]);
  } catch (error) { /* السجل لا يوقف الإرسال */ }
}

/* نسخة من كل رسالة إلى صندوق النادي — لو ما وصل الرمز للعضو يقدر المشرف يوصله */
function mailBccAddress() {
  try {
    const props = PropertiesService.getScriptProperties();
    const saved = String(props.getProperty('JALEES_MAIL_BCC') || '').trim();
    if (saved.toLowerCase() === 'off' || saved.toLowerCase() === 'none') return '';
    if (saved) return saved;
  } catch (error) { /* تجاهل */ }
  return MAIL_FROM;
}

/* ---- إرسال عبر مزوّد بريد احترافي (وصول مضمون — لا-importantls إلى المهملات) ---- */
function sendViaResend(settings, to, subject, intro, code, name) {
  if (!settings || !settings.resendKey || !settings.resendFrom) return false;
  const res = UrlFetchApp.fetch('https://api.resend.com/emails', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + settings.resendKey },
    payload: JSON.stringify({
      from: settings.resendFrom,
      to: [to],
      subject: subject,
      text: 'نادي جليس القرائي\n\nمرحباً ' + name + '،\n' + intro + '\n\nرمزك: ' + code + '\n\nالرمز صالح لمدة ١٥ دقيقة.',
      html: '<div dir="rtl" style="font-family:Arial,Tahoma,sans-serif;font-size:15px;line-height:1.9;color:#1E3A2B">'
        + '<p>مرحباً ' + name + '،</p><p>' + intro + '</p>'
        + '<p style="font-size:26px;letter-spacing:8px;font-weight:bold;color:#8C532D">' + code + '</p>'
        + '<p>الرمز صالح لمدة ١٥ دقيقة.</p>'
        + '<p style="color:#5F6B64">نادي جليس القرائي · منطقة القصيم</p></div>'
    }),
    muteHttpExceptions: true
  });
  const code2 = res.getResponseCode();
  const body = String(res.getContentText() || '');
  if (code2 < 200 || code2 >= 300) throw new Error('مزوّد البريد ' + code2 + ': ' + body.slice(0, 160));
  return true;
}

/* ---- إرسال عبر Brevo (توثيق بريد واحد — بدون نطاق) ---- */
function sendViaBrevo(settings, to, subject, intro, code, name) {
  if (!settings || !settings.brevoKey || !settings.brevoFrom) return false;
  const res = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'api-key': settings.brevoKey },
    payload: JSON.stringify({
      sender: { name: settings.brevoName || 'نادي جليس القرائي', email: settings.brevoFrom },
      to: [{ email: to, name: name || 'عضو جليس' }],
      subject: subject,
      htmlContent: '<div dir="rtl" style="font-family:Arial,Tahoma,sans-serif;font-size:15px;line-height:1.9;color:#1E3A2B">'
        + '<p>مرحباً ' + name + '،</p><p>' + intro + '</p>'
        + '<p style="font-size:26px;letter-spacing:8px;font-weight:bold;color:#8C532D">' + code + '</p>'
        + '<p>الرمز صالح لمدة ١٥ دقيقة.</p>'
        + '<p style="color:#5F6B64">نادي جليس القرائي · منطقة القصيم</p></div>',
      textContent: 'نادي جليس القرائي\n\nمرحباً ' + name + '،\n' + intro + '\n\nرمزك: ' + code + '\n\nالرمز صالح لمدة ١٥ دقيقة.'
    }),
    muteHttpExceptions: true
  });
  const status = res.getResponseCode();
  const body = String(res.getContentText() || '');
  if (status < 200 || status >= 300) throw new Error('Brevo ' + status + ': ' + body.slice(0, 160));
  return true;
}

/* ---- إرسال عبر Mailjet (REST API v3.1) ---- */
function sendViaMailjet(settings, to, subject, intro, code, name) {
  if (!settings || !settings.mailjetPublic || !settings.mailjetPrivate || !settings.mailjetFrom) return false;
  const auth = Utilities.base64Encode(settings.mailjetPublic + ':' + settings.mailjetPrivate);
  const res = UrlFetchApp.fetch('https://api.mailjet.com/v3.1/send', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Basic ' + auth },
    payload: JSON.stringify({
      Messages: [{
        From: { Email: settings.mailjetFrom, Name: 'نادي جليس القرائي' },
        To: [{ Email: to, Name: name || 'عضو جليس' }],
        Subject: subject,
        TextPart: 'نادي جليس القرائي\n\nمرحباً ' + name + '،\n' + intro + '\n\nرمزك: ' + code + '\n\nالرمز صالح لمدة ١٥ دقيقة.',
        HTMLPart: '<div dir="rtl" style="font-family:Arial,Tahoma,sans-serif;font-size:15px;line-height:1.9;color:#1E3A2B">'
          + '<p>مرحباً ' + name + '،</p><p>' + intro + '</p>'
          + '<p style="font-size:26px;letter-spacing:8px;font-weight:bold;color:#8C532D">' + code + '</p>'
          + '<p>الرمز صالح لمدة ١٥ دقيقة.</p>'
          + '<p style="color:#5F6B64">نادي جليس القرائي · منطقة القصيم</p></div>'
      }]
    }),
    muteHttpExceptions: true
  });
  const status = res.getResponseCode();
  const body = String(res.getContentText() || '');
  if (status < 200 || status >= 300) throw new Error('Mailjet ' + status + ': ' + body.slice(0, 160));
  return true;
}

function sendCodeEmail(email, name, code, subject, intro) {
  /* مزوّد البريد (مستقل عن قناة التحديثات) — وصول مضمون */
  try {
    const providerSettings = pushSettings();
    /* backward compat: if emailProvider not set, fall back to channel */
    const provider = (providerSettings.emailProvider && providerSettings.emailProvider !== 'email')
      ? providerSettings.emailProvider
      : (['resend', 'brevo', 'mailjet'].indexOf(providerSettings.channel) >= 0 ? providerSettings.channel : (providerSettings.emailProvider || 'email'));
    if (provider === 'resend' && sendViaResend(providerSettings, email, subject, intro, code, name)) {
      return true;
    }
    if (provider === 'brevo' && sendViaBrevo(providerSettings, email, subject, intro, code, name)) {
      return true;
    }
    if (provider === 'mailjet' && sendViaMailjet(providerSettings, email, subject, intro, code, name)) {
      return true;
    }
  } catch (providerError) {
    /* نكمل بالبريد العادي إن فشل المزوّد */
  }

  const plainBody = [
    'نادي جليس القرائي',
    '',
    'مرحباً ' + name + '،',
    intro,
    '',
    'رمزك: ' + code,
    '',
    'الرمز صالح لمدة ١٥ دقيقة. إذا لم تطلب هذا الرمز، تجاهله.'
  ].join('\n');
  const htmlBody = `<div dir="rtl" style="font-family:Arial,Tahoma,sans-serif;font-size:15px;line-height:1.9;color:#1E3A2B">
      <p>مرحباً ${name}،</p>
      <p>${intro}</p>
      <p style="font-size:26px;letter-spacing:8px;font-weight:bold;color:#8C532D">${code}</p>
      <p>الرمز صالح لمدة ١٥ دقيقة. إن لم تطلب هذا الرمز تجاهله.</p>
      <p style="color:#5F6B64">نادي جليس القرائي · منطقة القصيم</p>
    </div>`;
  const base = {
    to: email,
    subject: subject,
    replyTo: MAIL_REPLY,
    body: plainBody,
    htmlBody: htmlBody
  };

  /* نرسل باسم إيميل النادي فقط إذا كان هو الحساب المالك للسكربت
     (وإلا رفض Gmail الإرسال). وفي حال أي رفض نعيد الإرسال بدون from. */
  let owner = '';
  try { owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (error) { owner = ''; }
  const from = String(MAIL_FROM || '').toLowerCase();
  const canUseFrom = Boolean(from) && Boolean(owner) && owner === from;
  const bcc = mailBccAddress();
  const payload = (withFrom) => {
    const opts = { ...base };
    if (bcc) opts.bcc = bcc;
    if (withFrom) opts.from = MAIL_FROM;
    return opts;
  };

  try {
    MailApp.sendEmail(payload(canUseFrom));
    return true;
  } catch (firstError) {
    try {
      MailApp.sendEmail(payload(false));
      return true;
    } catch (secondError) {
      throw new Error(String((secondError && secondError.message) || (firstError && firstError.message) || 'فشل الإرسال'));
    }
  }
}

/* تشخيص الإرسال: من الحساب المالك؟ وهل الاسم مطابق؟ وآخر محاولات */
function getMailStatus() {
  let owner = '';
  try { owner = String(Session.getEffectiveUser().getEmail() || ''); } catch (error) { owner = ''; }
  let quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (error) { quota = 0; }
  const recent = [];
  try {
    const ss = resolveSpreadsheet();
    const sheet = getMailLogSheet(ss);
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const rows = sheet.getRange(Math.max(2, lastRow - 19), 1, Math.min(20, lastRow - 1), 5).getValues();
      rows.forEach((row) => {
        recent.push({
          email: String(row[0] || ''),
          sentAt: Number(row[1]) || 0,
          status: String(row[2] || ''),
          detail: String(row[3] || ''),
          code: String(row[4] || '')
        });
      });
    }
  } catch (error) { /* السجل غير متاح */ }
  return {
    success: true,
    owner: owner,
    configuredFrom: MAIL_FROM,
    canSendAsClub: owner.toLowerCase() === String(MAIL_FROM).toLowerCase(),
    bcc: mailBccAddress(),
    remainingQuota: quota,
    recent: recent.reverse()
  };
}

function getBookRatingsSheet(ss) {
  return getDataSheet(ss, BOOK_RATINGS_SHEET, ['id', 'bookId', 'memberId', 'memberName', 'rating', 'review', 'createdAt']);
}

function getLibraryCategoriesSheet(ss) {
  const sheet = getDataSheet(ss, LIBRARY_CATEGORIES_SHEET, ['category']);
  if (sheet.getMaxColumns() < 4) sheet.insertColumnsAfter(sheet.getMaxColumns(), 4 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 2).getValue()) sheet.getRange(1, 2).setValue('deletedAt');
  if (!sheet.getRange(1, 3).getValue()) sheet.getRange(1, 3).setValue('deletedBy');
  if (!sheet.getRange(1, 4).getValue()) sheet.getRange(1, 4).setValue('booksSnapshot');
  const properties = PropertiesService.getScriptProperties();
  const seededKey = `library-category-defaults-seeded:${ss.getId()}`;
  if (properties.getProperty(seededKey) !== 'yes') {
    const existing = new Set();
    if (sheet.getLastRow() >= 2) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues()
        .forEach(row => existing.add(normalizeTabName(row[0])));
    }
    const missing = DEFAULT_LIBRARY_CATEGORIES.filter(name => !existing.has(normalizeTabName(name)));
    if (missing.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, 1).setValues(missing.map(name => [name]));
    }
    properties.setProperty(seededKey, 'yes');
  }
  return sheet;
}

/* مخطط أعمدة كل تبويبة — نستخدمه لاكتشاف التبويبات المكرّرة */
const SHEET_SIGNATURES = [
  { name: 'الأعضاء', headers: ['id', 'name', 'email', 'passwordHash'] },
  { name: 'الاقتباسات', headers: ['quote_text', 'author_name'] },
  { name: 'المقالات', headers: ['excerpt', 'read', 'body'] },
  { name: 'تقييمات الكتب', headers: ['bookId', 'rating', 'review'] },
  { name: 'تصنيفات المكتبة', headers: ['category', 'booksSnapshot'] },
  { name: 'طلبات الانضمام', headers: ['name', 'phone', 'decidedBy'] },
  { name: 'استشارات الأعضاء', headers: ['question', 'answer'] },
  { name: 'الملفات الشخصية', headers: ['memberId', 'goal', 'notifications'] },
  { name: 'سجلات القراءة', headers: ['bookTitle', 'pages', 'date'] },
  { name: 'مكتبات الأعضاء', headers: ['bookId', 'currentPage', 'status'] },
  { name: 'كتبي الخاصة', headers: ['bookId', 'pages', 'coverColor'] },
  { name: 'المكتبة', headers: ['title', 'author', 'category', 'coverColor'] },
  { name: 'النوافذ القرائية', headers: ['title', 'body', 'image'] },
  { name: 'أرشيف النادي', headers: ['duration', 'videoUrl'] },
  { name: 'التقارير الأسبوعية', headers: ['weekNo', 'weekStart'] },
  { name: 'الإعجابات', headers: ['targetId', 'memberName'] },
  { name: 'مختارات الاقتباسات', headers: ['quoteText', 'authorName'] },
  { name: 'القوائم القرائية', headers: ['books', 'cover'] },
  { name: 'ملخصات الأعضاء', headers: ['bookTitle', 'summary'] }
];

function sheetHeaderList(sheet) {
  try {
    if (!sheet || sheet.getLastRow() < 1) return [];
    const cols = Math.max(1, sheet.getMaxColumn());
    return sheet.getRange(1, 1, 1, cols).getValues()[0].map((h) => String(h || '').trim());
  } catch (error) {
    return [];
  }
}

/* هل هذا التبويب نسخة من تبويب معروف؟ (نكتشفه من أعمدة رأسه) */
function detectSheetByHeaders(sheet) {
  const headers = sheetHeaderList(sheet);
  if (!headers.length) return '';
  for (let i = 0; i < SHEET_SIGNATURES.length; i++) {
    const signature = SHEET_SIGNATURES[i];
    const found = signature.headers.every((name) => headers.indexOf(name) >= 0);
    if (found) return signature.name;
  }
  return '';
}

/* تبويبة المكتبة — تُنشأ تلقائيًا إن كانت مفقودة (إصلاح ذاتي) */
function getBooksSheet(ss) {
  const target = resolveSpreadsheet(ss);
  let sheet = target.getSheetByName(BOOKS_SHEET);
  if (!sheet) {
    /* ربما أُعيدت تسميته أثناء التنظيم — نبحث بمخطط الأعمدة */
    const all = target.getSheets();
    sheet = all.find((item) => detectSheetByHeaders(item) === BOOKS_SHEET) || null;
    if (sheet) {
      try { sheet.setName(BOOKS_SHEET); } catch (error) { /* تجاهل */ }
    } else {
      sheet = target.insertSheet(BOOKS_SHEET);
      sheet.appendRow([
        'id', 'memberId', 'memberName', 'title', 'author', 'category', 'coverColor',
        'report', 'pages', 'createdAt', 'coverImage', 'deletedAt', 'deletedBy', 'year', 'pdfUrl', 'coverColor2'
      ]);
    }
  }
  ensureBookDeleteColumns(sheet);
  return sheet;
}

/* مفتاح الكتاب — العنوان + المؤلف (لمنع التكرار) */
function bookKey(title, author) {
  const clean = (value) => String(value || '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return clean(title) + '|' + clean(author);
}

/* حذف الكتب المكرّرة (نفس العنوان والمؤلف) — مع الإبقاء على النسخة الحيّة */
function dedupeClubBooks(ss) {
  const target = getBooksSheet(ss);
  const lastRow = target.getLastRow();
  if (lastRow < 2) return { removed: 0 };
  const rows = target.getRange(2, 1, lastRow - 1, 12).getValues();
  const liveRows = new Map();
  const removed = [];
  rows.forEach((row, index) => {
    const key = bookKey(row[3], row[4]);
    if (!key || key === '|') return;
    const rowNumber = index + 2;
    const deleted = Boolean(row[11]);
    if (!liveRows.has(key)) {
      liveRows.set(key, { row: rowNumber, deleted: deleted });
      return;
    }
    const kept = liveRows.get(key);
    /* نحتفظ بالنسخة الحيّة ونتخلص من المحذوف أو المكرّر */
    if (kept.deleted && !deleted) {
      removed.push(kept.row);
      liveRows.set(key, { row: rowNumber, deleted: false });
      return;
    }
    removed.push(rowNumber);
  });
  for (let i = removed.length - 1; i >= 0; i--) {
    try { target.deleteRow(removed[i]); } catch (error) { /* تجاهل */ }
  }
  return { removed: removed.length };
}

function libraryBookSheets(ss) {
  const target = resolveSpreadsheet(ss);
  return [getBooksSheet(target), target.getSheetById(OLD_BOOKS_SHEET_ID)]
    .filter((sheet, index, list) => sheet && list.indexOf(sheet) === index);
}

function bookIdForRow(sheet, rawId, zeroBasedIndex) {
  return String(rawId || `legacy-${sheet.getSheetId()}-${zeroBasedIndex + 2}`);
}

function getLibraryCategoryNames(ss) {
  const sheet = getLibraryCategoriesSheet(ss);
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
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues().forEach(row => {
      if (!row[1]) add(row[0]);
    });
  }

  const missing = [];
  libraryBookSheets(ss).forEach(bookSheet => {
    const lastRow = bookSheet.getLastRow();
    if (lastRow < 2 || bookSheet.getLastColumn() < 6) return;
    ensureBookDeleteColumns(bookSheet);
    bookSheet.getRange(2, 1, lastRow - 1, 12).getDisplayValues().forEach(row => {
      if (row[11]) return;
      const name = String(row[5] || '').trim();
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

    if (action === 'organizeSheets') {
      const requester = String(data.requesterName || '').trim();
      if (!isSupervisorName(requester)) throw new Error('التنظيم متاح للمشرفين فقط');
      const result = organizeSheets(ss);
      return output(Object.assign({ success: true }, result));
    }

    if (action === 'saveClubBook') {
      const sheet = getBooksSheet(ss);
      ensureBookDeleteColumns(sheet);

      const bookId = String(data.id || '');
      const oldSheet = ss.getSheetById(OLD_BOOKS_SHEET_ID);
      const sources = [oldSheet, sheet]
        .filter((source, index, list) => source && list.indexOf(source) === index);

      /* منع التكرار: نبحث بالمعرّف أولًا، ثم بالعنوان+المؤلف */
      const wantedKey = bookKey(data.title, data.author);
      const rowData = [
        data.id || '', data.memberId || '', data.memberName || '',
        data.title || '', data.author || '', data.category || '',
        data.coverColor || '', data.report || '', data.pages || 0,
        data.createdAt || Date.now(), storeImage(data.coverImage, 'book'),
        '', '', data.year || '', data.pdfUrl || '', data.coverColor2 || ''
      ];

      for (const source of sources) {
        const lastRow = source.getLastRow();
        if (lastRow < 2) continue;
        const rows = source.getRange(2, 1, lastRow - 1, 5).getValues();
        let matchIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          if (bookId && String(rows[i][0] || '') === bookId) { matchIndex = i; break; }
          if (wantedKey && bookKey(rows[i][3], rows[i][4]) === wantedKey) { matchIndex = i; break; }
        }
        if (matchIndex < 0) continue;
        const row = matchIndex + 2;
        ensureBookDeleteColumns(source);
        const keepId = String(rows[matchIndex][0] || rowData[0]);
        source.getRange(row, 1, 1, rowData.length).setValues([[
          keepId, rowData[1], rowData[2], rowData[3], rowData[4], rowData[5],
          rowData[6], rowData[7], rowData[8], rowData[9], rowData[10],
          rowData[11], rowData[12], rowData[13], rowData[14], rowData[15]
        ]]);
        /* إعادة إضافة كتاب كان محذوفًا تُلغي شاهد الحذف حتى يظهر في كل الأجهزة */
        clearDeletedLog(ss, keepId, 'book');
        if (wantedKey) clearDeletedLog(ss, wantedKey, 'bookkey');
        const previousId = String(rows[matchIndex][0] || '');
        if (previousId && previousId !== keepId) clearDeletedLog(ss, previousId, 'book');
        return output({ success: true, id: keepId, message: 'تم تحديث الكتاب (بدون تكرار)' });
      }

      sheet.appendRow(rowData);
      notifySupervisors(
        ss, 'book',
        'كتاب جديد في المكتبة',
        String(data.title || '') + ' — ' + String(data.author || ''),
        '', String(data.memberId || ''), String(data.memberName || '')
      );
      return output({ success: true, id: rowData[0], message: 'تم حفظ الكتاب' });
    }

    /* تنظيف الكتب المكرّرة في الشيت (نفس العنوان والمؤلف) */
    if (action === 'dedupeClubBooks') {
      const result = dedupeClubBooks(ss);
      return output({ success: true, removed: result.removed, message: 'تم حذف ' + result.removed + ' كتاب مكرر' });
    }

    if (action === 'updateClubBook') {
      const bookId = String(data.id || '');
      if (!bookId) throw new Error('معرّف الكتاب مطلوب');
      const coverImage = storeImage(data.coverImage, 'book');

      const oldSheet = ss.getSheetById(OLD_BOOKS_SHEET_ID);
      const sources = libraryBookSheets(ss);

      let touched = 0;
      for (const source of sources) {
        const lastRow = source.getLastRow();
        if (lastRow < 2) continue;
        const rows = source.getRange(2, 1, lastRow - 1, 5).getValues();
        for (let i = rows.length - 1; i >= 0; i--) {
          const rowId = bookIdForRow(source, rows[i][0], i);
          const sameId = rowId === bookId;
          const sameKey = data.key ? bookKey(rows[i][3], rows[i][4]) === String(data.key) : false;
          if (!sameId && !sameKey) continue;

          const row = i + 2;
          ensureBookDeleteColumns(source);
          source.getRange(row, 4, 1, 6).setValues([[
            data.title || '', data.author || '', data.category || '',
            data.coverColor || '', data.report || '', Number(data.pages) || 0
          ]]);
          source.getRange(row, 11).setValue(coverImage);
          source.getRange(row, 14).setValue(data.year || '');
          source.getRange(row, 15).setValue(data.pdfUrl || '');
          source.getRange(row, 16).setValue(data.coverColor2 || '');
          touched += 1;
        }
      }
      if (!touched) throw new Error('لم أجد الكتاب المطلوب في المكتبة');
      return output({ success: true, updated: touched, message: 'تم تحديث بيانات الكتاب' });
    }

    if (action === 'deleteClubBook' || action === 'restoreClubBook') {
      const bookId = String(data.id || '');
      if (!bookId) throw new Error('معرّف الكتاب مطلوب');
      const deleting = action === 'deleteClubBook';
      const sources = libraryBookSheets(ss);

      let touched = 0;
      let deletedTitle = '';
      let deletedAuthor = '';
      const restoredKeys = [];
      for (const source of sources) {
        ensureBookDeleteColumns(source);
        const lastRow = source.getLastRow();
        if (lastRow < 2) continue;
        const rows = source.getRange(2, 1, lastRow - 1, 5).getValues();
        for (let i = rows.length - 1; i >= 0; i--) {
          const rowId = bookIdForRow(source, rows[i][0], i);
          const sameId = rowId === bookId;
          const sameKey = data.key ? bookKey(rows[i][3], rows[i][4]) === String(data.key) : false;
          if (!sameId && !sameKey) continue;
          const row = i + 2;
          source.getRange(row, 12, 1, 2).setValues([deleting ? [Date.now(), data.deletedBy || 'مشرف'] : ['', '']]);
          paintDeletedRow(source, row, deleting, 14);
          if (deleting) {
            if (!deletedTitle) { deletedTitle = String(rows[i][3] || ''); deletedAuthor = String(rows[i][4] || ''); }
          } else {
            /* نحفظ مفتاح الكتاب لنزيل شاهد الحذف الخاص به */
            const rowKey = bookKey(rows[i][3], rows[i][4]);
            if (rowKey && rowKey !== '|') restoredKeys.push(rowKey);
          }
          touched += 1;
        }
      }
      if (deleting) {
        /* شاهد دائم: حتى لو ضاع صف الكتاب يبقى محذوفًا في كل الأجهزة */
        logDeletedItem(ss, bookId, 'book', deletedTitle || String(data.title || ''), deletedAuthor || String(data.author || ''), data.deletedBy || 'مشرف');
        /* شاهد المفتاح يُشتق من صف الكتاب نفسه — حتى يتطابق مع الاسترجاع والحذف النهائي */
        const rowKey = bookKey(deletedTitle || String(data.title || ''), deletedAuthor || String(data.author || ''));
        if (rowKey && rowKey !== '|') {
          logDeletedItem(ss, rowKey, 'bookkey', deletedTitle || String(data.title || ''), deletedAuthor || String(data.author || ''), data.deletedBy || 'مشرف');
        }
        /* مفتاح قديم أرسله المتصفح (عنوان تغيّر) لم يعد صالحًا */
        if (data.key && rowKey && String(data.key) !== rowKey) clearDeletedLog(ss, String(data.key), 'bookkey');
      } else {
        /* إزالة الشاهد كاملًا — بالمعرّف وبالمفتاح — وإلا بقي الكتاب مخفيًا */
        clearDeletedLog(ss, bookId, 'book');
        if (data.key) clearDeletedLog(ss, String(data.key), 'bookkey');
        restoredKeys.forEach((key) => clearDeletedLog(ss, key, 'bookkey'));
      }
      if (!touched && !deleting) throw new Error('لم أجد الكتاب المطلوب');
      return output({ success: true, updated: touched, message: deleting ? 'نُقل الكتاب إلى سلة المحذوفات' : 'تمت استعادة الكتاب' });
    }

    if (action === 'saveJoinRequest') {
      const sheet = getJoinRequestsSheet(ss);
      const row = sheet.getLastRow() + 1;
      sheet.appendRow([
        data.name || '',
        data.phone || '',
        data.note || '',
        data.ts || Date.now(),
        'pending',
        '',
        ''
      ]);
      paintJoinRequestRow(sheet, row, 'pending');
      notifySupervisors(
        ss, 'join',
        'طلب انضمام جديد',
        (data.name || 'عضو') + ' أرسل طلب انضمام — ' + (data.phone || ''),
        '', '', String(data.name || '')
      );
      return output({ success: true, message: 'تم حفظ طلب الانضمام' });
    }

    if (action === 'setJoinRequestStatus') {
      const sheet = getJoinRequestsSheet(ss);
      const row = Number(data.row);
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('لم أجد طلب الانضمام');
      const status = normalizeJoinStatus(data.status);
      sheet.getRange(row, 5, 1, 3).setValues([[
        status,
        status === 'pending' ? '' : Date.now(),
        status === 'pending' ? '' : (data.by || 'مشرف')
      ]]);
      paintJoinRequestRow(sheet, row, status);
      return output({ success: true, status: status });
    }

    if (action === 'getPendingMembers') {
      const sheet = getMembersSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
      const pending = [];
      rows.forEach((row, index) => {
        const id = String(row[0] || '');
        if (!id) return;
        const status = memberStatusCode(row[6]);
        if (status === 'active') return;
        pending.push({
          row: index + 2,
          id: id,
          name: String(row[1] || ''),
          email: String(row[2] || ''),
          phone: normalizePhone(row[11]),
          status: status,
          role: String(row[5] || 'member'),
          memberType: String(row[13] || 'member').trim(),
          createdAt: row[7]
        });
      });
      pending.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
      return output({ success: true, data: pending });
    }

    if (action === 'setMemberStatus') {
      const sheet = getMembersSheet(ss);
      const row = Number(data.row);
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('لم أجد الحساب');
      const status = memberStatusCode(data.status);
      sheet.getRange(row, 7).setValue(status);
      paintMemberRow(sheet, row, status);
      if (data.memberType) {
        sheet.getRange(row, 14).setValue(String(data.memberType).trim());
      }
      if (status === 'active') {
        // Send welcome email
        try {
          const member = sheet.getRange(row, 1, 1, 13).getValues()[0];
          const email = String(member[2] || '').trim();
          if (email) {
            // ... email sending logic if exists
          }
        } catch (e) { /* تجاهل */ }
      }
      return output({ success: true, status: status, memberType: data.memberType || '' });
    }

    if (action === 'setConsultantStatus') {
      const sheet = getMembersSheet(ss);
      const row = Number(data.row);
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('لم أجد الحساب');
      const isConsultant = (String(data.isConsultant) === 'true' || data.isConsultant === true);
      sheet.getRange(row, 6).setValue(isConsultant ? 'consultant' : 'member');
      return output({ success: true, role: isConsultant ? 'consultant' : 'member', message: isConsultant ? 'تم ترقية العضو إلى مستشار' : 'تم إلغاء ترقية المستشار' });
    }

    /* منح صلاحية إشراف لعضو (للمشرف فقط) */
    if (action === 'setSupervisorStatus') {
      const sheet = getMembersSheet(ss);
      const row = Number(data.row);
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('لم أجد الحساب');
      const isSupervisor = (String(data.isSupervisor) === 'true' || data.isSupervisor === true);
      const current = String(sheet.getRange(row, 6).getValue() || '');
      const next = isSupervisor ? 'supervisor' : (current === 'consultant' ? 'consultant' : 'member');
      sheet.getRange(row, 6).setValue(next);
      return output({ success: true, role: next, message: isSupervisor ? 'أصبح العضو مشرفًا للنادي' : 'أُلغي إشراف العضو' });
    }

    /* طرد عضو: يُمنع من الدخول بنفس الإيميل أو الرقم */
    if (action === 'banMember') {
      const sheet = getMembersSheet(ss);
      const row = Number(data.row);
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('لم أجد الحساب');
      const banning = !(String(data.banned) === 'false' || data.banned === false);
      sheet.getRange(row, 7).setValue(banning ? 'banned' : 'active');
      paintMemberRow(sheet, row, banning ? 'banned' : 'active');
      return output({ success: true, banned: banning, message: banning ? 'تم طرد العضو — لن يستطيع الدخول بنفس الإيميل أو الرقم' : 'أُعيد تفعيل الحساب' });
    }

    if (action === 'setMemberType') {
      const sheet = getMembersSheet(ss);
      const row = Number(data.row);
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('لم أجد الحساب');
      const memberType = String(data.memberType || 'member').trim();
      // العمود 14 = memberType (لا يمس كلمة المرور)
      sheet.getRange(row, 14).setValue(memberType);
      return output({ success: true, memberType: memberType, message: 'تم تحديث نوع العضوية' });
    }

    if (action === 'saveProfile') {
      const memberId = String(data.memberId || '').trim();
      if (!memberId) throw new Error('معرّف العضو مطلوب');
      const sheet = getProfilesSheet(ss);
      const lastRow = sheet.getLastRow();
      const rowData = [
        memberId, data.name || '', data.role || 'member', data.joined || '٢٠٢٤',
        Number(data.goal) || 200, Number(data.lastWeekPages) || 0,
        data.notifications === false ? 'false' : 'true'
      ];
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        const index = ids.findIndex((row) => String(row[0] || '') === memberId);
        if (index >= 0) {
          sheet.getRange(index + 2, 1, 1, rowData.length).setValues([rowData]);
          return output({ success: true, message: 'تم تحديث الملف الشخصي' });
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'تم حفظ الملف الشخصي' });
    }

    if (action === 'saveEntry') {
      const sheet = getEntriesSheet(ss);
      const memberId = String(data.memberId || '').trim();
      if (!memberId) throw new Error('معرّف العضو مطلوب');
      const entryId = String(data.id || `entry-${Date.now()}`);
      const rowData = [
        entryId, memberId, data.memberName || '', data.bookId || '',
        data.bookTitle || '', Number(data.pages) || 0, data.date || '', data.createdAt || Date.now()
      ];
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        const index = ids.findIndex((row) => String(row[0] || '') === entryId);
        if (index >= 0) {
          sheet.getRange(index + 2, 1, 1, rowData.length).setValues([rowData]);
          return output({ success: true, message: 'تم تحديث سجل القراءة' });
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'تم حفظ سجل القراءة' });
    }

    if (action === 'saveMyBook') {
      const sheet = getMyBooksSheet(ss);
      const memberId = String(data.memberId || '').trim();
      const bookId = String(data.bookId || '').trim();
      if (!memberId || !bookId) throw new Error('معرّف العضو والكتاب مطلوبان');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const keys = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (let i = 0; i < keys.length; i++) {
          if (String(keys[i][0]) === memberId && String(keys[i][2]) === bookId) {
            sheet.getRange(i + 2, 4).setValue(String(data.status || 'reading'));
            sheet.getRange(i + 2, 5).setValue(Number(data.currentPage) || 0);
            return output({ success: true, message: 'تم تحديث مكتبتي' });
          }
        }
      }
      sheet.appendRow([memberId, data.memberName || '', bookId, String(data.status || 'reading'), Number(data.currentPage) || 0, data.createdAt || Date.now()]);
      return output({ success: true, message: 'تم حفظ الكتاب في مكتبتي' });
    }

    if (action === 'deleteMyBook') {
      const sheet = getMyBooksSheet(ss);
      const memberId = String(data.memberId || '').trim();
      const bookId = String(data.bookId || '').trim();
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const keys = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (let i = 0; i < keys.length; i++) {
          if (String(keys[i][0]) === memberId && String(keys[i][2]) === bookId) {
            sheet.deleteRow(i + 2);
            return output({ success: true, message: 'تمت الإزالة من مكتبتي' });
          }
        }
      }
      return output({ success: true, message: 'الكتاب غير موجود في مكتبتي' });
    }

    if (action === 'getMyBooks') {
      const memberId = String((data && data.memberId) || (e && e.parameter && e.parameter.memberId) || '').trim();
      const sheet = getMyBooksSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2 || !memberId) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      const mine = rows.filter((row) => String(row[0]) === memberId).map((row) => ({
        bookId: String(row[2] || ''),
        status: String(row[3] || 'reading'),
        currentPage: Number(row[4]) || 0,
        addedAt: row[5] || null
      })).filter((item) => item.bookId);
      return output({ success: true, data: mine });
    }

    if (action === 'saveBookSummary') {
      const sheet = getBookSummariesSheet(ss);
      const memberId = String(data.memberId || '').trim();
      if (!memberId) throw new Error('سجّل الدخول لنشر الملخص');
      const summaryId = String(data.id || `sum-${Date.now()}`);
      sheet.appendRow([
        summaryId, memberId, data.memberName || '', data.bookTitle || '',
        data.bookAuthor || '', data.summary || '', data.createdAt || Date.now(), '', ''
      ]);
      notifySupervisors(
        ss, 'summary',
        'ملخص كتاب جديد',
        (data.memberName || 'عضو') + ' — ' + String(data.bookTitle || ''),
        '', memberId, String(data.memberName || '')
      );
      return output({ success: true, id: summaryId, message: 'تم نشر الملخص' });
    }

    if (action === 'deleteBookSummary') {
      const sheet = getBookSummariesSheet(ss);
      const summaryId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '') === summaryId) {
            sheet.getRange(i + 2, 8, 1, 2).setValues([[Date.now(), data.by || 'مشرف']]);
            return output({ success: true, message: 'تم حذف الملخص' });
          }
        }
      }
      return output({ success: true, message: 'الملخص غير موجود' });
    }

    /* حذف نهائي من سلة المهملات (لا استعادة) */
    if (action === 'purgeDeletedItem') {
      const type = String(data.type || '').trim();
      const id = String(data.id || '').trim();
      if (!id) throw new Error('معرّف العنصر مطلوب');
      const sources = [];
      if (type === 'quote') sources.push(ss.getSheetByName(QUOTES_SHEET));
      else if (type === 'article') sources.push(getArticlesSheet(ss));
      else if (type === 'recording') sources.push(getRecordedMeetingsSheet(ss));
      else if (type === 'shelf') sources.push(getLibraryCategoriesSheet(ss));
      else if (type === 'book') sources.push.apply(sources, libraryBookSheets(ss));
      else if (type === 'summary') sources.push(getBookSummariesSheet(ss));
      else if (type === 'consultation') sources.push(getConsultationsSheet(ss));
      else if (type === 'list') sources.push(getReadingListsSheet(ss));
      else if (type === 'window') sources.push(getReadingTipsSheet(ss));
      else if (type === 'meeting') sources.push(getMeetingsSheet(ss));

      let deleted = false;
      sources.filter(Boolean).forEach((source) => {
        if (deleted) return;
        try { ensureBookDeleteColumns(source); } catch (error) { /* تجاهل */ }
        const lastRow = source.getLastRow();
        if (lastRow < 2) return;
        const ids = source.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
        for (let i = ids.length - 1; i >= 0; i--) {
          /* عمود المعرّف يختلف: الاقتباسات في العمود ٦، والباقي في العمود ١ */
          const idIndex = (type === 'quote') ? 5 : 0;
          const fallback = 'sheet-' + (i + 1);
          const rowId = (type === 'book')
            ? bookIdForRow(source, ids[i][0], i)
            : String(ids[i][idIndex] || (type === 'quote' ? fallback : ''));
          if (rowId === id || (type === 'book' && String(ids[i][0] || '') === String(id))) {
            if (type === 'book') {
              /* الحذف النهائي يزيل شاهد المحذوفات حتى يمكن إضافة الكتاب نفسه لاحقًا */
              const rowKey = bookKey(ids[i][3], ids[i][4]);
              clearDeletedLog(ss, id, 'book');
              if (rowKey && rowKey !== '|') clearDeletedLog(ss, rowKey, 'bookkey');
            }
            source.deleteRow(i + 2);
            deleted = true;
            return;
          }
        }
      });
      return output({ success: true, message: deleted ? 'تم الحذف النهائي' : 'العنصر غير موجود' });
    }

    if (action === 'saveSelectionQuote') {
      const sheet = getSelectionQuotesSheet(ss);
      const selectionId = String(data.id || `sel-${Date.now()}`);
      const image = storeImage(data.image, 'selquote');
      if (!image) throw new Error('أضف صورة الاقتباس');
      const rowData = [
        selectionId, data.text || '', data.book || '', data.bookAuthor || '',
        data.authorName || '', data.createdAt || Date.now(), data.by || 'مشرف', '', '',
        image, String(data.quoteId || '')
      ];
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '') === selectionId) {
            sheet.getRange(i + 2, 1, 1, rowData.length).setValues([rowData]);
            return output({ success: true, id: selectionId, message: 'تم تحديث الاقتباس المختار' });
          }
        }
      }
      sheet.appendRow(rowData);
      notifySupervisors(
        ss, 'selection',
        'اقتباس مختار جديد',
        String(data.text || '').slice(0, 110),
        '', '', String(data.by || 'مشرف')
      );
      return output({ success: true, id: selectionId, message: 'تم نشر الاقتباس في مختارات النادي' });
    }

    if (action === 'deleteSelectionQuote') {
      const sheet = getSelectionQuotesSheet(ss);
      const selectionId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '') === selectionId) {
            sheet.getRange(i + 2, 8, 1, 2).setValues([[Date.now(), data.by || 'مشرف']]);
            return output({ success: true, message: 'تمت الإزالة من مختارات النادي' });
          }
        }
      }
      return output({ success: true, message: 'الاقتباس غير موجود' });
    }

    if (action === 'saveWeeklyReport') {
      const sheet = getWeeklyReportsSheet(ss);
      const weekNo = Number(data.weekNo) || 0;
      if (!weekNo) throw new Error('أدخل رقم الأسبوع');
      const image = storeImage(data.image, 'weekly');
      if (!image) throw new Error('أضف صورة التقرير');
      let reportId = String(data.id || `wk-${Date.now()}`);
      let target = 0;
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
        for (let i = 0; i < rows.length; i++) {
          if (rows[i][7]) continue;
          if (Number(rows[i][1]) === weekNo) { target = i + 2; reportId = String(rows[i][0]); break; }
        }
      }
      const rowData = [
        reportId, weekNo, String(data.weekStart || ''), String(data.weekEnd || ''),
        image, Date.now(), data.by || 'مشرف', '', '',
        data.title || '', Number(data.pages) || 0, Number(data.participants) || 0, data.notes || '',
        storeImageList(data.images, 'weekly')
      ];
      if (target) {
        sheet.getRange(target, 1, 1, rowData.length).setValues([rowData]);
        return output({ success: true, id: reportId, message: 'تم تحديث تقرير هذا الأسبوع' });
      }
      sheet.appendRow(rowData);
      notifySupervisors(
        ss, 'weekly',
        'تقرير أسبوعي جديد',
        'الأسبوع ' + weekNo + (data.title ? ' — ' + String(data.title).slice(0, 70) : ''),
        '', '', String(data.by || 'مشرف')
      );
      return output({ success: true, id: reportId, message: 'تم حفظ التقرير الأسبوعي' });
    }

    if (action === 'deleteWeeklyReport') {
      const sheet = getWeeklyReportsSheet(ss);
      const reportId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '') === reportId) {
            sheet.getRange(i + 2, 8, 1, 2).setValues([[Date.now(), data.by || 'مشرف']]);
            return output({ success: true, message: 'تم حذف التقرير' });
          }
        }
      }
      return output({ success: true, message: 'التقرير غير موجود' });
    }

    /* حذف كل التقارير الأسبوعية دفعة واحدة (المشرف) — يقبل POST و GET */
    if (action === 'deleteAllWeeklyReports') {
      const sheet = getWeeklyReportsSheet(ss);
      const lastRow = sheet.getLastRow();
      let removed = 0;
      for (let row = lastRow; row >= 2; row--) {
        sheet.deleteRow(row);
        removed += 1;
      }
      return output({ success: true, removed: removed, message: 'تم حذف كل التقارير' });
    }

    if (action === 'toggleSelectionQuote') {
      const sheet = getSelectionQuotesSheet(ss);
      const quoteId = String(data.id || '').trim();
      if (!quoteId) throw new Error('معرّف الاقتباس مطلوب');
      const lastRow = sheet.getLastRow();
      let rowNumber = 0;
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '') === quoteId) { rowNumber = i + 2; break; }
        }
      }
      if (rowNumber) {
        sheet.getRange(rowNumber, 8, 1, 2).setValues([[Date.now(), data.by || 'مشرف']]);
        return output({ success: true, selected: false, message: 'أُزيل الاقتباس من مختارات النادي' });
      }
      sheet.appendRow([
        quoteId, data.text || '', data.book || '', data.bookAuthor || '',
        data.authorName || '', Date.now(), data.by || 'مشرف', '', ''
      ]);
      return output({ success: true, selected: true, message: 'أُضيف الاقتباس إلى مختارات النادي' });
    }

    if (action === 'saveReadingList') {
      const sheet = getReadingListsSheet(ss);
      const listId = String(data.id || `list-${Date.now()}`);
      const books = Array.isArray(data.books) ? data.books : [];
      const rowData = [
        listId, data.title || '', data.description || '', JSON.stringify(books),
        storeImage(data.cover, 'list'), data.createdAt || Date.now(), data.createdBy || '', '', ''
      ];
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '') === listId) {
            sheet.getRange(i + 2, 1, 1, rowData.length).setValues([rowData]);
            return output({ success: true, id: listId, message: 'تم تحديث القائمة القرائية' });
          }
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, id: listId, message: 'تم حفظ القائمة القرائية' });
    }

    if (action === 'deleteReadingList') {
      const sheet = getReadingListsSheet(ss);
      const listId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '') === listId) {
            sheet.getRange(i + 2, 8, 1, 2).setValues([[Date.now(), data.by || 'مشرف']]);
            return output({ success: true, message: 'تم حذف القائمة القرائية' });
          }
        }
      }
      return output({ success: true, message: 'القائمة غير موجودة' });
    }

    if (action === 'toggleLike') {
      const sheet = getLikesSheet(ss);
      const type = String(data.type || 'quote').trim() === 'article' ? 'article' : 'quote';
      const targetId = String(data.id || '').trim();
      const memberId = String(data.memberId || '').trim();
      if (!targetId) throw new Error('معرّف العنصر مطلوب');
      if (!memberId) throw new Error('سجّل الدخول للإعجاب');
      const lastRow = sheet.getLastRow();
      let rowNumber = 0;
      if (lastRow >= 2) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i][0] || '') === type && String(rows[i][1] || '') === targetId && String(rows[i][2] || '') === memberId) {
            rowNumber = i + 2;
            break;
          }
        }
      }
      let liked = true;
      if (rowNumber) {
        sheet.deleteRow(rowNumber);
        liked = false;
      } else {
        sheet.appendRow([type, targetId, memberId, data.memberName || '', Date.now()]);
      }
      let count = 0;
      if (sheet.getLastRow() >= 2) {
        const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
        count = rows.filter(row => String(row[0] || '') === type && String(row[1] || '') === targetId).length;
      }
      return output({ success: true, liked: liked, likes: count });
    }

    if (action === 'savePersonalBook') {
      const sheet = getPersonalBooksSheet(ss);
      const memberId = String(data.memberId || '').trim();
      const bookId = String(data.bookId || '').trim();
      if (!memberId || !bookId) throw new Error('بيانات الكتاب ناقصة');
      const rowData = [
        memberId, data.memberName || '', bookId, data.title || '', data.author || '',
        Number(data.pages) || 0, data.coverColor || '', data.pdfUrl || '', data.createdAt || Date.now(),
        data.coverColor2 || '', storeImage(data.coverImage, 'mybook')
      ];
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const keys = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (let i = 0; i < keys.length; i++) {
          if (String(keys[i][0] || '') === memberId && String(keys[i][2] || '') === bookId) {
            sheet.getRange(i + 2, 1, 1, rowData.length).setValues([rowData]);
            return output({ success: true, message: 'تم تحديث الكتاب في مكتبتي' });
          }
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'تم حفظ الكتاب في مكتبتي' });
    }

    if (action === 'deletePersonalBook') {
      const sheet = getPersonalBooksSheet(ss);
      const memberId = String(data.memberId || '').trim();
      const bookId = String(data.bookId || '').trim();
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const keys = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (let i = keys.length - 1; i >= 0; i--) {
          if (String(keys[i][0] || '') === memberId && String(keys[i][2] || '') === bookId) {
            sheet.deleteRow(i + 2);
            return output({ success: true, message: 'تمت الإزالة من مكتبتي' });
          }
        }
      }
      return output({ success: true, message: 'الكتاب غير موجود في مكتبتي' });
    }

    if (action === 'uploadFile') {
      const raw = String(data.data || '');
      if (!raw) throw new Error('لم يصل أي ملف');
      const isPdf = /pdf/i.test(String(data.name || '')) || /application\/pdf/i.test(raw.slice(0, 40));
      if (raw.length > 9000000) throw new Error('الملف كبير جدًا — الحد ٦ ميجابايت');
      const url = isPdf ? storePdf(raw, 'pdf') : storeFile(raw, 'upload', 'image/jpeg', 'jpg');
      if (!url) throw new Error('تعذر رفع الملف');
      return output({ success: true, url: url, isPdf: isPdf });
    }

    if (action === 'saveReadingTip') {
      const sheet = getReadingTipsSheet(ss);
      const tipId = String(data.id || `tip-${Date.now()}`);
      const rowData = [
        tipId, data.title || '', data.body || '', storeImage(data.image, 'tip'),
        data.createdAt || Date.now(), data.createdBy || '', '', ''
      ];
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === tipId) {
            sheet.getRange(i + 2, 1, 1, rowData.length).setValues([rowData]);
            return output({ success: true, message: 'تم تحديث النصيحة' });
          }
        }
      }
      sheet.appendRow(rowData);
      notifySupervisors(
        ss, 'window',
        'نافذة قرائية جديدة',
        String(data.title || ''),
        '', '', String(data.createdBy || 'مشرف')
      );
      return output({ success: true, id: tipId, message: 'تم حفظ النصيحة' });
    }

    if (action === 'getReadingTips') {
      const sheet = getReadingTipsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      const tips = rows.map(row => ({
        id: row[0], title: row[1], body: row[2], image: row[3],
        createdAt: row[4], createdBy: row[5], deletedAt: row[6], deletedBy: row[7]
      })).filter(t => t.id && !t.deletedAt);
      tips.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return output({ success: true, data: tips });
    }

    if (action === 'deleteReadingTip') {
      const sheet = getReadingTipsSheet(ss);
      const tipId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === tipId) {
            sheet.getRange(i + 2, 7).setValue(Date.now());
            sheet.getRange(i + 2, 8).setValue(data.by || '');
            return output({ success: true, message: 'تم حذف النصيحة' });
          }
        }
      }
      return output({ success: false, message: 'لم أجد النصيحة' });
    }

    if (action === 'setMemberPhoto') {
      const memberId = String(data.memberId || '').trim();
      const photo = String(data.photo || '');
      if (!/^(?:data:image\/(?:jpeg|png|webp);base64,|https?:\/\/)/i.test(photo)) {
        throw new Error('اختر صورة بصيغة JPG أو PNG أو WebP');
      }
      const stored = storeImage(photo, `member-${memberId || 'photo'}`);
      if (!stored) throw new Error('تعذر حفظ الصورة، حاول مرة أخرى');
      const sheet = getMembersSheet(ss);
      const row = findMemberRowById(sheet, memberId);
      if (row < 2) throw new Error('لم أجد حساب العضو');
      const member = sheet.getRange(row, 1, 1, 13).getValues()[0];
      if (memberStatusCode(member[6]) !== 'active') throw new Error('الحساب غير معتمد');
      sheet.getRange(row, 13).setValue(stored);
      return output({ success: true, photo: stored, message: 'تم تحديث الصورة الشخصية' });
    }

    if (action === 'getApprovedMembers') {
      const sheet = getMembersSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
      const members = [];
      rows.forEach((row, index) => {
        if (!String(row[0] || '').trim()) return;
        if (memberStatusCode(row[6]) !== 'active') return;
        members.push({
          id: String(row[0] || ''),
          row: index + 2,
          name: String(row[1] || '').trim(),
          role: String(row[5] || 'member'),
          joinedAt: row[7],
          photo: String(row[12] || ''),
          memberType: String(row[13] || 'member').trim()
        });
      });
      return output({ success: true, data: members });
    }

    if (action === 'submitConsultation') {
      const memberId = String(data.memberId || '').trim();
      const question = String(data.question || '').trim();
      if (question.length < 8) throw new Error('اكتب سؤالك بتفصيل أكبر');
      if (question.length > 10000) throw new Error('السؤال أطول من الحد المسموح (١٠٠٠٠ حرف)');
      const membersSheet = getMembersSheet(ss);
      const memberRow = findMemberRowById(membersSheet, memberId);
      if (memberRow < 2) throw new Error('سجّل الدخول كعضو لطرح استشارة');
      const member = membersSheet.getRange(memberRow, 1, 1, 12).getValues()[0];
      if (memberStatusCode(member[6]) !== 'active') throw new Error('الحساب غير معتمد');
      const id = `consult-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
      const sheet = getConsultationsSheet(ss);
      sheet.appendRow([id, memberId, String(member[1] || ''), question, Date.now(), '', '', '', '']);
      notifySupervisors(
        ss, 'consultation',
        'استشارة جديدة',
        String(member[1] || '') + ': ' + String(question || '').slice(0, 120),
        '', memberId, String(member[1] || '')
      );
      return output({ success: true, id: id, message: 'تم إرسال استشارتك للمستشارين' });
    }

    /* حذف استشارة (للمشرف) */
    if (action === 'deleteConsultation') {
      const requester = String(data.requesterName || data.by || '').trim();
      if (!isSupervisorName(requester)) throw new Error('حذف الاستشارة متاح للمشرفين فقط');
      const sheet = getConsultationsSheet(ss);
      const consultationId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '') !== consultationId) continue;
          sheet.deleteRow(i + 2);
          return output({ success: true, message: 'تم حذف الاستشارة' });
        }
      }
      return output({ success: false, message: 'لم أجد الاستشارة' });
    }

    /* حذف إجابة الاستشارة (صاحبها فقط) */
    if (action === 'deleteConsultationAnswer') {
      const memberId = String(data.memberId || '').trim();
      const sheet = getConsultationsSheet(ss);
      const consultationId = String(data.id || '');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 9).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0] || '') !== consultationId) continue;
          const answeredById = String(ids[i][6] || '').trim();
          if (!answeredById || answeredById !== memberId) {
            throw new Error('لا يمكنك حذف إجابة كتبها شخص آخر');
          }
          sheet.getRange(i + 2, 6, 1, 4).setValues([['', '', '', '']]);
          return output({ success: true, message: 'تم حذف الإجابة' });
        }
      }
      return output({ success: false, message: 'لم أجد الاستشارة' });
    }

    if (action === 'answerConsultation') {
      const memberId = String(data.memberId || '').trim();
      const consultationId = String(data.id || '').trim();
      const answer = String(data.answer || '').trim();
      if (!consultationId) throw new Error('معرّف الاستشارة مطلوب');
      if (answer.length < 2) throw new Error('اكتب الإجابة');
      if (answer.length > 20000) throw new Error('الإجابة أطول من الحد المسموح (٢٠٠٠٠ حرف)');
      const membersSheet = getMembersSheet(ss);
      const memberRow = findMemberRowById(membersSheet, memberId);
      if (memberRow < 2) throw new Error('سجّل الدخول بحساب المستشار');
      const member = membersSheet.getRange(memberRow, 1, 1, 12).getValues()[0];
      const advisorName = String(member[1] || '').trim();
      if (memberStatusCode(member[6]) !== 'active' || !isConsultantName(advisorName)) {
        throw new Error('الإجابة متاحة للمستشارين المعتمدين فقط');
      }
      const sheet = getConsultationsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) throw new Error('لم أجد الاستشارة');
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      const index = ids.findIndex(row => String(row[0] || '') === consultationId);
      if (index < 0) throw new Error('لم أجد الاستشارة');
      const row = index + 2;
      const existing = sheet.getRange(row, 6, 1, 4).getValues()[0];
      const existingAnswer = String(existing[0] || '').trim();
      if (existingAnswer) {
        const existingBy = String(existing[2] || 'مستشار آخر').trim();
        const existingById = String(existing[1] || '').trim();
        if (existingById !== memberId) {
          throw new Error('هذه الاستشارة أجاب عليها ' + existingBy + ' — الإجابة محفوظة لصاحبها ولا يمكن نسبتها لغيره');
        }
        // صاحب الإجابة نفسه يعدّل نصّ إجابته فقط دون تغيير صاحبها
        sheet.getRange(row, 6).setValue(answer);
        sheet.getRange(row, 9).setValue(Date.now());
        return output({ success: true, message: 'تم تحديث إجابتك' });
      }
      sheet.getRange(row, 6, 1, 4).setValues([[answer, memberId, advisorName, Date.now()]]);
      return output({ success: true, message: 'تم نشر الإجابة' });
    }

    if (action === 'requestRegistrationCode') {
      const sheet = getMembersSheet(ss);
      const name = String(data.name || '').replace(/\s+/g, ' ').trim();
      const phone = normalizePhone(data.phone);
      const email = normalizeEmail(data.email);
      const password = String(data.password || '');

      if (name.split(' ').filter(Boolean).length < 3) {
        throw new Error('اكتب الاسم الثلاثي كما هو في الهوية');
      }
      if (!/^\+?\d{8,15}$/.test(phone)) {
        throw new Error('أدخل رقم جوال صحيحًا');
      }
      if (!EMAIL_PATTERN.test(email)) throw new Error('صيغة البريد الإلكتروني غير صحيحة');
      if (password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`الرمز يجب أن يكون ${PASSWORD_MIN_LENGTH} أحرف أو أكثر`);
      }
      if (findMemberRow(sheet, email) > 0) {
        throw new Error('هذا البريد مسجل مسبقًا، جرّب الدخول أو استعادة الرمز');
      }
      const bannedByEmail = findBannedRow(sheet, email, '');
      if (bannedByEmail > 0) {
        throw new Error('هذا البريد مطرود من النادي ولا يمكن التسجيل به');
      }
      const bannedByPhone = findBannedRow(sheet, '', phone);
      if (bannedByPhone > 0) {
        throw new Error('رقم الجوال مطرود من النادي ولا يمكن التسجيل به');
      }

      const previous = readPendingRegistration(email);
      if (previous && previous.sentAt && Date.now() - Number(previous.sentAt) < 60000 && previous.code) {
        /* إعادة إرسال الرمز نفسه بدل رفض الطلب — لا يستهلك رمزًا جديدًا */
        try {
          sendCodeEmail(email, name, String(previous.code), 'جليس | رمز تأكيد بريدك', 'رمز تأكيد بريدك لإنشاء حسابك في جليس هو:');
          previous.sentAt = Date.now();
          savePendingRegistration(previous);
          logMailAttempt(ss, email, 'sent', 'إعادة إرسال نفس الرمز', String(previous.code));
          return output({ success: true, resent: true, message: 'أرسلنا رمز التحقق إلى بريدك' });
        } catch (mailError) {
          logMailAttempt(ss, email, 'failed', String(mailError && mailError.message || mailError), String(previous.code));
          throw new Error('تعذر إرسال البريد، حاول مرة أخرى بعد قليل');
        }
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeSalt = Utilities.getUuid();
      const passwordSalt = Utilities.getUuid();
      savePendingRegistration({
        name,
        phone,
        email,
        passwordHash: hashPassword(password, passwordSalt),
        passwordSalt,
        codeHash: hashPassword(code, codeSalt),
        codeSalt,
        code: code,
        expiry: Date.now() + 15 * 60 * 1000,
        sentAt: Date.now(),
        attempts: 0
      });

      try {
        sendCodeEmail(
          email, name, code,
          'جليس | رمز تأكيد بريدك',
          'رمز تأكيد بريدك لإنشاء حسابك في جليس هو:'
        );
      } catch (mailError) {
        clearPendingRegistration(email);
        logMailAttempt(ss, email, 'failed', String((mailError && mailError.message) || mailError), code);
        throw new Error('تعذر إرسال البريد، حاول مرة أخرى بعد قليل');
      }
      logMailAttempt(ss, email, 'sent', 'رمز جديد', code);

      return output({ success: true, sentTo: email, message: 'أرسلنا رمز التحقق إلى بريدك' });
    }

    if (action === 'verifyRegistrationCode') {
      const sheet = getMembersSheet(ss);
      const email = normalizeEmail(data.email);
      const code = String(data.code || '').trim();

      if (!/^\d{6}$/.test(code)) throw new Error('رمز التحقق ستة أرقام');

      const record = readPendingRegistration(email);
      if (!record) throw new Error('لا يوجد طلب تسجيل لهذا البريد، أعد التسجيل');

      if (!record.expiry || Date.now() > Number(record.expiry)) {
        clearPendingRegistration(email);
        throw new Error('انتهت صلاحية الرمز، أعد التسجيل لطلب رمز جديد');
      }
      if (findMemberRow(sheet, email) > 0) {
        clearPendingRegistration(email);
        throw new Error('هذا البريد مسجل مسبقًا، يمكنك الدخول الآن');
      }
      if (findBannedRow(sheet, email, record.phone) > 0) {
        clearPendingRegistration(email);
        throw new Error('هذا الحساب مطرود من النادي ولا يمكن تفعيله');
      }
      if (!verifyPassword(code, record.codeSalt, record.codeHash)) {
        record.attempts = (Number(record.attempts) || 0) + 1;
        if (record.attempts >= 6) {
          clearPendingRegistration(email);
          throw new Error('تجاوزت عدد المحاولات، أعد التسجيل لطلب رمز جديد');
        }
        savePendingRegistration(record);
        throw new Error('رمز التحقق غير صحيح');
      }

      const id = `u-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
      const role = SUPERVISOR_NAMES.some((item) => normalizePersonName(item) === normalizePersonName(record.name))
        ? 'supervisor'
        : 'member';
      sheet.appendRow([
        id, record.name, email, record.passwordHash, record.passwordSalt, role,
        'pending', Date.now(), Date.now(), '', '', normalizePhone(record.phone), ''
      ]);
      paintMemberRow(sheet, sheet.getLastRow(), 'pending');
      clearPendingRegistration(email);
      /* تنبيه المشرف بوجود طلب تسجيل جديد — مع الرمز ليقدر يوصله للعضو */
      notifySupervisors(
        ss, 'register',
        'طلب تسجيل جديد',
        record.name + ' (' + email + ') — الرمز: ' + code + ' — بانتظار موافقتك.',
        '', id, record.name
      );
      return output({
        success: true,
        status: 'pending',
        message: 'تم تأكيد بريدك، وحسابك بانتظار موافقة الإدارة'
      });
    }

    if (action === 'registerMember') {
      throw new Error('حدّثنا نظام التسجيل، أعد تحميل الصفحة ثم أنشئ الحساب من جديد');
    }

    if (action === 'loginMember') {
      const sheet = getMembersSheet(ss);
      const identifier = String(data.identifier || data.email || '').trim();
      const password = String(data.password || '');
      let row = -1;
      if (identifier.indexOf('@') >= 0) {
        row = findMemberRow(sheet, identifier);
      } else {
        if (identifier.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length < 3) {
          throw new Error('أدخل الاسم الثلاثي أو البريد الإلكتروني');
        }
        const nameRows = findMemberRowsByName(sheet, identifier);
        if (nameRows.length > 1) {
          throw new Error('يوجد أكثر من عضو بهذا الاسم، استخدم البريد الإلكتروني للدخول');
        }
        if (nameRows.length === 1) row = nameRows[0];
      }
      if (row < 0) throw new Error('الاسم أو البريد الإلكتروني أو الرمز غير صحيح');

      const values = sheet.getRange(row, 1, 1, 13).getValues()[0];
      const status = memberStatusCode(values[6]);
      if (status === 'banned') throw new Error('تم طرد حسابك من النادي');
      if (status === 'rejected') throw new Error('تم رفض طلب حسابك، تواصل مع إدارة النادي');
      if (status !== 'active') throw new Error('حسابك بانتظار موافقة المشرف');

      const expected = String(values[3] || '');
      const salt = String(values[4] || '');
      if (!verifyPassword(password, salt, expected)) {
        throw new Error('الاسم أو البريد الإلكتروني أو الرمز غير صحيح');
      }
      if (isLegacyPasswordHash(expected)) {
        const newSalt = Utilities.getUuid();
        sheet.getRange(row, 4, 1, 2).setValues([[hashPassword(password, newSalt), newSalt]]);
      }

      sheet.getRange(row, 9).setValue(Date.now());
      return output({ success: true, member: memberRecord(values) });
    }

    if (action === 'requestPasswordReset') {
      const sheet = getMembersSheet(ss);
      const email = normalizeEmail(data.email);
      const row = findMemberRow(sheet, email);

      if (row > 0) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const codeSalt = Utilities.getUuid();
        const expiry = Date.now() + 15 * 60 * 1000;
        const name = String(sheet.getRange(row, 2).getValue() || 'عضو جليس');
        sheet.getRange(row, 10, 1, 2).setValues([[
          JSON.stringify({ hash: hashPassword(code, codeSalt), salt: codeSalt }),
          expiry
        ]]);
        try {
          sendCodeEmail(
            email, name, code,
            'جليس | رمز استعادة الرمز السري',
            'رمز استعادة الرمز السري الخاص بك هو:'
          );
        } catch (mailError) {
          console.error('MailApp error:', mailError);
        }
      }
      return output({ success: true, message: 'إن كان البريد مسجلًا فسيصلك رمز الاستعادة خلال لحظات' });
    }

    if (action === 'resetPassword') {
      const sheet = getMembersSheet(ss);
      const email = normalizeEmail(data.email);
      const code = String(data.code || '').trim();
      const password = String(data.password || '');
      if (password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`الرمز الجديد يجب أن يكون ${PASSWORD_MIN_LENGTH} أحرف أو أكثر`);
      }
      const row = findMemberRow(sheet, email);
      if (row < 0) throw new Error('رمز التحقق غير صحيح أو منتهي الصلاحية');

      const stored = String(sheet.getRange(row, 10).getValue() || '');
      const expiry = Number(sheet.getRange(row, 11).getValue()) || 0;
      if (!stored || !expiry || Date.now() > expiry) {
        throw new Error('انتهت صلاحية الرمز، اطلب رمزًا جديدًا');
      }

      let valid = false;
      let parsed = null;
      try { parsed = JSON.parse(stored); } catch (error) { parsed = null; }
      if (parsed && parsed.hash && parsed.salt) {
        valid = verifyPassword(code, parsed.salt, parsed.hash);
      } else {
        const parts = stored.split(':');
        if (parts.length === 2) valid = verifyPassword(code, parts[1], parts[0]);
      }
      if (!valid) throw new Error('رمز التحقق غير صحيح');

      const salt = Utilities.getUuid();
      sheet.getRange(row, 4, 1, 2).setValues([[hashPassword(password, salt), salt]]);
      sheet.getRange(row, 10, 1, 2).setValues([['', '']]);
      return output({ success: true, message: 'تم تعيين الرمز الجديد، يمكنك الدخول الآن' });
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

    if (action === 'deleteLibraryCategory' || action === 'restoreLibraryCategory') {
      const category = String(data.id || data.category || '').trim();
      if (!category) throw new Error('اسم الرف مطلوب');
      const sheet = getLibraryCategoriesSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) throw new Error('لا توجد رفوف لإدارتها');
      const rows = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
      const restoring = action === 'restoreLibraryCategory';
      const rowIndex = rows.findIndex(row => normalizeTabName(row[0]) === normalizeTabName(category)
        && (restoring ? Boolean(row[1]) : !row[1]));
      if (rowIndex < 0) throw new Error('لم أجد الرف المطلوب');
      const sheetRow = rowIndex + 2;

      if (action === 'deleteLibraryCategory') {
        if (rows[rowIndex][1]) return output({ success: true, message: 'الرف موجود بالفعل في سلة المحذوفات' });
        const snapshotIds = [];
        libraryBookSheets(ss).forEach(bookSheet => {
          ensureBookDeleteColumns(bookSheet);
          const lastBookRow = bookSheet.getLastRow();
          if (lastBookRow < 2) return;
          const ids = bookSheet.getRange(2, 1, lastBookRow - 1, 1).getDisplayValues();
          const categories = bookSheet.getRange(2, 6, lastBookRow - 1, 1).getValues();
          let changed = false;
          categories.forEach((row, index) => {
            if (normalizeTabName(row[0]) === normalizeTabName(category)) {
              snapshotIds.push(bookIdForRow(bookSheet, ids[index][0], index));
              row[0] = 'غير مصنف';
              changed = true;
            }
          });
          if (changed) bookSheet.getRange(2, 6, lastBookRow - 1, 1).setValues(categories);
        });

        sheet.getRange(sheetRow, 2, 1, 3).setValues([[Date.now(), data.deletedBy || 'مشرف', JSON.stringify(snapshotIds)]]);
        paintDeletedRow(sheet, sheetRow, true, 4);
        if (!getLibraryCategoryNames(ss).some(name => normalizeTabName(name) === normalizeTabName('غير مصنف'))) {
          sheet.appendRow(['غير مصنف', '', '', '']);
        }
        return output({ success: true, message: 'نُقل الرف إلى سلة المحذوفات، وحُفظت كتبه في غير مصنف', movedBooks: snapshotIds.length });
      }

      if (!rows[rowIndex][1]) return output({ success: true, message: 'الرف غير محذوف' });
      let snapshotIds = [];
      try { snapshotIds = JSON.parse(rows[rowIndex][3] || '[]'); } catch (error) { snapshotIds = []; }
      sheet.getRange(sheetRow, 2, 1, 3).setValues([['', '', '']]);
      paintDeletedRow(sheet, sheetRow, false, 4);
      const wanted = new Set(snapshotIds.map(String));
      libraryBookSheets(ss).forEach(bookSheet => {
        const lastBookRow = bookSheet.getLastRow();
        if (lastBookRow < 2) return;
        const ids = bookSheet.getRange(2, 1, lastBookRow - 1, 1).getDisplayValues();
        const categories = bookSheet.getRange(2, 6, lastBookRow - 1, 1).getValues();
        let changed = false;
        categories.forEach((row, index) => {
          if (wanted.has(bookIdForRow(bookSheet, ids[index][0], index))) {
            row[0] = category;
            changed = true;
          }
        });
        if (changed) bookSheet.getRange(2, 6, lastBookRow - 1, 1).setValues(categories);
      });
      return output({ success: true, message: 'تمت استعادة الرف وكتبه', restoredBooks: snapshotIds.length });
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
      notifySupervisors(
        ss, 'article',
        'مقال جديد',
        (data.memberName || 'عضو') + ' نشر: ' + String(data.title || '').slice(0, 90),
        '', String(data.memberId || ''), String(data.memberName || '')
      );
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
      const meetingImage = storeImage(data.image, 'meeting');

      const rowData = [
        meetingId, data.title || '', data.description || '', String(data.date || ''),
        String(data.time || ''), data.location || '', meetingImage,
        data.createdAt || Date.now(), data.createdBy || '',
        (data.imagePosX === '' || data.imagePosX === undefined || data.imagePosX === null ? 50 : Number(data.imagePosX) || 50),
        (data.imagePosY === '' || data.imagePosY === undefined || data.imagePosY === null ? 50 : Number(data.imagePosY) || 50),
        (data.imageScale === '' || data.imageScale === undefined || data.imageScale === null ? 100 : Number(data.imageScale) || 100)
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

      const rowData = [
        recordId, data.title || '', data.description || '', data.recordedAt || '',
        data.speaker || '', Number(data.views) || 0, data.duration || '',
        data.videoUrl || '', storeImage(data.image, 'recording'), data.createdAt || Date.now(), data.createdBy || '',
        '', '', data.type || '', data.location || '', storeImageList(data.images, 'recording')
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
      notifySupervisors(
        ss, 'archive',
        'مدخل جديد في الأرشيف',
        String(data.title || '') + (data.location ? ' — ' + String(data.location) : ''),
        '', '', String(data.createdBy || 'مشرف')
      );
      return output({ success: true, message: 'تم حفظ التسجيل' });
    }

    if (action === 'deleteRecordedMeeting' || action === 'restoreRecordedMeeting') {
      const sheet = getRecordedMeetingsSheet(ss);
      const recordId = String(data.id || '');
      const deleting = action === 'deleteRecordedMeeting';
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === recordId) {
            const row = i + 2;
            sheet.getRange(row, 12, 1, 2).setValues([deleting ? [Date.now(), data.deletedBy || 'مشرف'] : ['', '']]);
            paintDeletedRow(sheet, row, deleting, 13);
            return output({ success: true, message: deleting ? 'نُقل اللقاء المسجل إلى سلة المحذوفات' : 'تمت استعادة اللقاء المسجل' });
          }
        }
      }
      if (!deleting) throw new Error('لم أجد اللقاء المسجل');
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

    if (action === 'deleteArticle' || action === 'restoreArticle') {
      const sheet = getArticlesSheet(ss);
      const articleId = String(data.id || '');
      const deleting = action === 'deleteArticle';
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === articleId) {
            const row = i + 2;
            sheet.getRange(row, 10, 1, 2).setValues([deleting ? [Date.now(), data.deletedBy || 'مشرف'] : ['', '']]);
            paintDeletedRow(sheet, row, deleting, 11);
            return output({ success: true, message: deleting ? 'نُقل المقال إلى سلة المحذوفات' : 'تمت استعادة المقال' });
          }
        }
      }
      if (!deleting) throw new Error('لم أجد المقال المطلوب');
      /* مقال محلي/قديم غير موجود في الشيت: نحفظ نسخة قابلة للاستعادة بدل فقدانه. */
      if (data.title) {
        sheet.appendRow([
          articleId, data.memberId || '', data.memberName || '', data.title || '',
          data.category || '', data.body || '', data.excerpt || '', Number(data.read) || 3,
          data.createdAt || Date.now(), Date.now(), data.deletedBy || 'مشرف'
        ]);
        paintDeletedRow(sheet, sheet.getLastRow(), true, 11);
        return output({ success: true, message: 'نُقل المقال إلى سلة المحذوفات' });
      }
      return output({ success: true, message: 'المقال غير موجود' });
    }

    /* طلبات التسجيل المعلّقة مع رموزها (للمشرف) */
    if (action === 'getPendingRegistrations') {
      const requester = String(data.requesterName || data.by || '').trim();
      if (!isSupervisorName(requester)) throw new Error('عرض الطلبات متاح للمشرفين فقط');
      const pending = [];
      try {
        const all = PropertiesService.getScriptProperties().getProperties();
        Object.keys(all).forEach((key) => {
          if (key.indexOf('pending-registration:') !== 0) return;
          let record = null;
          try { record = JSON.parse(all[key]); } catch (error) { record = null; }
          if (!record || !record.email) return;
          pending.push({
            email: String(record.email || ''),
            name: String(record.name || ''),
            phone: String(record.phone || ''),
            code: String(record.code || ''),
            sentAt: Number(record.sentAt) || 0,
            expiresAt: Number(record.expiry) || 0,
            attempts: Number(record.attempts) || 0
          });
        });
      } catch (error) { /* لا شيء */ }
      pending.sort((a, b) => b.sentAt - a.sentAt);
      return output({ success: true, data: pending.slice(0, 20) });
    }

    /* ===== التنبيهات ===== */
    if (action === 'markNotificationsRead') {
      const sheet = getNotificationsSheet(ss);
      const lastRow = sheet.getLastRow();
      let marked = 0;
      if (lastRow >= 2) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
        const targetId = String(data.id || '').trim();
        for (let i = 0; i < rows.length; i++) {
          if (rows[i][7]) continue;
          if (targetId && String(rows[i][0]) !== targetId) continue;
          sheet.getRange(i + 2, 8).setValue(Date.now());
          marked += 1;
        }
      }
      return output({ success: true, marked: marked });
    }

    if (action === 'getNotifySettings') {
      const settings = pushSettings();
      return output({
        success: true,
        channel: settings.channel,
        emailProvider: settings.emailProvider || 'email',
        telegramChat: settings.telegramChat || '',
        telegramChats: String(settings.telegramChat || '').split(',').map((v) => v.trim()).filter(Boolean),
        siteUrl: settings.siteUrl || '',
        hasTelegram: Boolean(settings.telegramToken && settings.telegramChat),
        hasNtfy: Boolean(settings.ntfyTopic),
        hasPushover: Boolean(settings.pushoverToken && settings.pushoverUser),
        hasResend: Boolean(settings.resendKey && settings.resendFrom),
        hasBrevo: Boolean(settings.brevoKey && settings.brevoFrom),
        brevoFrom: settings.brevoFrom,
        brevoName: settings.brevoName,
        hasMailjet: Boolean(settings.mailjetPublic && settings.mailjetPrivate && settings.mailjetFrom),
        mailjetFrom: settings.mailjetFrom,
        types: [...pushEnabledTypes()],
        allTypes: Object.keys(NOTIFICATION_TYPES),
        labels: NOTIFICATION_TYPES
      });
    }

    if (action === 'saveNotifySettings') {
      const channel = String(data.channel || 'off').toLowerCase();
      const props = PropertiesService.getScriptProperties();
      const set = (key, value) => { try { props.setProperty(key, String(value || '')); } catch (error) {} };
      /* الأسرار: لا نمسحها إن لم ترسلها الواجهة (نسخة قديمة) أو جاءت فارغة */
      const setSecret = (key, value) => {
        const v = String(value === undefined || value === null ? '' : value).trim();
        if (!v) return;
        set(key, v);
      };
      /* حقول اختيارية: تُحفظ فقط إن أرسلتها الواجهة */
      const setIfPresent = (propKey, dataObj, field, transform) => {
        if (!Object.prototype.hasOwnProperty.call(dataObj, field)) return;
        const raw = dataObj[field] === undefined || dataObj[field] === null ? '' : dataObj[field];
        const v = transform ? transform(raw) : String(raw).trim();
        if (!v) return;
        set(propKey, v);
      };
      set('JALEES_PUSH_CHANNEL', channel);
      setIfPresent('JALEES_EMAIL_PROVIDER', data, 'emailProvider', (v) => String(v || 'email').toLowerCase());
      setSecret('JALEES_TELEGRAM_TOKEN', data.telegramToken);
      /* عدة محادثات: نفصلها ونخزّنها موحّدة */
      const chatList = String(data.telegramChat || '').split(/[,;\n\r]+/).map((v) => v.trim()).filter(Boolean);
      if (chatList.length) set('JALEES_TELEGRAM_CHAT', chatList.join(','));
      setSecret('JALEES_NTFY_TOPIC', data.ntfyTopic);
      setSecret('JALEES_RESEND_KEY', data.resendKey);
      setIfPresent('JALEES_RESEND_FROM', data, 'resendFrom');
      setSecret('JALEES_BREVO_KEY', data.brevoKey);
      setIfPresent('JALEES_BREVO_FROM', data, 'brevoFrom');
      setIfPresent('JALEES_BREVO_NAME', data, 'brevoName', (v) => String(v || 'نادي جليس القرائي').trim());
      setSecret('JALEES_MAILJET_PUBLIC', data.mailjetPublic);
      setSecret('JALEES_MAILJET_PRIVATE', data.mailjetPrivate);
      setIfPresent('JALEES_MAILJET_FROM', data, 'mailjetFrom');
      setSecret('JALEES_PUSHOVER_TOKEN', data.pushoverToken);
      setIfPresent('JALEES_PUSHOVER_USER', data, 'pushoverUser');
      setIfPresent('JALEES_SITE_URL', data, 'siteUrl');
      if (Array.isArray(data.types)) {
        const types = data.types.map((t) => String(t)).filter(Boolean);
        set('JALEES_PUSH_TYPES', types.join(','));
      }
      return output({ success: true, message: 'تم حفظ إعدادات التنبيهات', channel: channel });
    }

    if (action === 'testNotification') {
      const result = notifySupervisors(
        ss, 'register', 'تجربة تنبيه',
        'هكذا سيصلك التنبيه على جوالك عندما يطلب عضو تسجيلًا جديدًا.',
        String(data.link || ''), '', 'تجربة'
      );
      return output({
        success: true,
        stored: result.stored,
        pushed: result.push.sent,
        channel: result.push.channel,
        detail: result.push.detail
      });
    }

    /* ===== حذف كل المقالات (للمشرف) ===== */
    if (action === 'deleteAllArticles') {
      const sheet = getArticlesSheet(ss);
      const lastRow = sheet.getLastRow();
      let removed = 0;
      for (let row = lastRow; row >= 2; row--) {
        sheet.deleteRow(row);
        removed += 1;
      }
      return output({ success: true, removed: removed, message: 'تم حذف كل المقالات' });
    }

    if (action === 'deleteQuote' || action === 'restoreQuote') {
      const sheet = getQuotesSheet(ss);
      const quoteId = String(data.id || '');
      if (!quoteId) throw new Error('معرّف الاقتباس مطلوب');
      const deleting = action === 'deleteQuote';
      const lastRow = sheet.getLastRow();
      let rowNumber = 0;
      if (lastRow >= 2) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues();
        for (let i = 0; i < rows.length; i++) {
          const spreadsheetRow = i + 2;
          const rowId = rows[i][5] || `sheet-${spreadsheetRow - 1}`;
          if (String(rowId) === quoteId) { rowNumber = spreadsheetRow; break; }
        }
      }

      // Demo/seed quote not yet in the sheet: preserve it as a recoverable tombstone.
      if (!rowNumber && deleting && data.text) {
        sheet.appendRow([
          data.created_at || new Date().toLocaleString('ar-SA'),
          data.author_name || '', data.page_number || '', data.book_title || '',
          data.text, quoteId, Date.now(), data.deletedBy || 'مشرف'
        ]);
        paintDeletedRow(sheet, sheet.getLastRow(), true, 8);
        return output({ success: true, message: 'نُقل الاقتباس إلى سلة المحذوفات' });
      }
      if (!rowNumber) throw new Error('لم أجد الاقتباس المطلوب');

      if (deleting) {
        sheet.getRange(rowNumber, 6).setValue(quoteId);
        sheet.getRange(rowNumber, 7, 1, 2).setValues([[Date.now(), data.deletedBy || 'مشرف']]);
        paintDeletedRow(sheet, rowNumber, true, 8);
        return output({ success: true, message: 'نُقل الاقتباس إلى سلة المحذوفات' });
      }
      sheet.getRange(rowNumber, 7, 1, 2).setValues([['', '']]);
      paintDeletedRow(sheet, rowNumber, false, 8);
      return output({ success: true, message: 'تمت استعادة الاقتباس' });
    }

    // حفظ الاقتباس (fallback)
    if (action && action !== 'saveQuote' && action !== 'addQuote' && action !== 'saveSharedQuote') {
      throw new Error(`إجراء غير معروف: ${action}`);
    }
    const sheet = getQuotesSheet(ss);

    ensureQuoteDeleteColumns(sheet);
    sheet.appendRow([
      data.created_at || new Date().toLocaleString('ar-SA'),
      data.author_name || '',
      data.page_number || data.page_numbe || '',
      data.book_title || '',
      data.quote_text || '',
      data.id || `q-${Date.now()}`,
      '', '', data.book_author || ''
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

    if (action === 'getMemberProfile') {
      const memberId = String(e && e.parameter ? e.parameter.memberId || '' : '').trim();
      const membersSheet = getMembersSheet(ss);
      const row = findMemberRowById(membersSheet, memberId);
      if (row < 2) throw new Error('لم أجد حساب العضو');
      const member = membersSheet.getRange(row, 1, 1, 13).getValues()[0];
      if (memberStatusCode(member[6]) !== 'active') throw new Error('الحساب غير معتمد');
      return output({
        success: true,
        member: { id: String(member[0] || ''), name: String(member[1] || ''), photo: String(member[12] || '') }
      });
    }

    if (action === 'getNotifySettings') {
      const settings = pushSettings();
      return output({
        success: true,
        channel: settings.channel,
        telegramChat: settings.telegramChat,
        telegramChats: settings.telegramChats,
        ntfyTopic: settings.ntfyTopic,
        hasResend: Boolean(settings.resendKey && settings.resendFrom),
        hasBrevo: Boolean(settings.brevoKey && settings.brevoFrom),
        brevoFrom: settings.brevoFrom,
        brevoName: settings.brevoName,
        hasMailjet: Boolean(settings.mailjetPublic && settings.mailjetPrivate && settings.mailjetFrom),
        mailjetFrom: settings.mailjetFrom,
        siteUrl: settings.siteUrl,
        hasTelegram: Boolean(settings.telegramToken && settings.telegramChat),
        hasNtfy: Boolean(settings.ntfyTopic),
        hasPushover: Boolean(settings.pushoverToken && settings.pushoverUser),
        types: [...pushEnabledTypes()],
        allTypes: Object.keys(NOTIFICATION_TYPES),
        labels: NOTIFICATION_TYPES
      });
    }

    if (action === 'getNotifications') {
      const sheet = getNotificationsSheet(ss);
      const lastRow = sheet.getLastRow();
      const data = [];
      let unread = 0;
      if (lastRow >= 2) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
        rows.forEach((row) => {
          if (!row[0]) return;
          if (!row[7]) unread += 1;
          data.push({
            id: String(row[0]),
            type: String(row[1] || 'member'),
            title: String(row[2] || ''),
            body: String(row[3] || ''),
            memberId: String(row[4] || ''),
            memberName: String(row[5] || ''),
            createdAt: Number(row[6]) || 0,
            read: Boolean(row[7]),
            link: String(row[8] || '')
          });
        });
      }
      data.sort((a, b) => b.createdAt - a.createdAt);
      return output({ success: true, data: data.slice(0, 40), unread: unread, types: NOTIFICATION_TYPES });
    }

    if (action === 'getVersion') {
      return output({ success: true, version: CODE_VERSION, deployed: true });
    }

    if (action === 'describeSpreadsheet') {
      return output({ success: true, sheets: describeSpreadsheet() });
    }

    if (action === 'getMailStatus') {
      return output(getMailStatus());
    }

    if (action === 'getProfile') {
      const memberId = String(e && e.parameter ? e.parameter.memberId || '' : '').trim();
      if (!memberId) return output({ success: true, data: null });
      const sheet = getProfilesSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: null });
      const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      const found = rows.find((row) => String(row[0] || '') === memberId);
      if (!found) return output({ success: true, data: null });
      return output({
        success: true,
        data: {
          memberId: String(found[0] || ''),
          name: String(found[1] || ''),
          role: String(found[2] || 'member'),
          joined: String(found[3] || '٢٠٢٤'),
          goal: Number(found[4]) || 200,
          lastWeekPages: Number(found[5]) || 0,
          notifications: found[6] !== 'false'
        }
      });
    }

    if (action === 'getEntries') {
      const memberId = String(e && e.parameter ? e.parameter.memberId || '' : '').trim();
      const sheet = getEntriesSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2 || !memberId) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      const entries = rows.filter((row) => String(row[1] || '') === memberId).map((row) => ({
        id: String(row[0] || ''),
        bookId: row[3] || '',
        bookTitle: String(row[4] || ''),
        pages: Number(row[5]) || 0,
        date: row[6] || '',
        ts: Number(row[7]) || 0
      })).filter((item) => item.id);
      entries.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
      return output({ success: true, data: entries });
    }

    if (action === 'getMyBooks') {
      const memberId = String(e && e.parameter ? e.parameter.memberId || '' : '').trim();
      const sheet = getMyBooksSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2 || !memberId) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      const mine = rows.filter((row) => String(row[0]) === memberId).map((row) => ({
        bookId: String(row[2] || ''),
        status: String(row[3] || 'reading'),
        currentPage: Number(row[4]) || 0,
        addedAt: row[5] || null
      })).filter((item) => item.bookId);
      return output({ success: true, data: mine });
    }

    if (action === 'getPersonalBooks') {
      const memberId = String(e && e.parameter ? e.parameter.memberId || '' : '').trim();
      const sheet = getPersonalBooksSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2 || !memberId) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
      const mine = rows.filter(row => String(row[0] || '') === memberId).map(row => ({
        id: String(row[2] || ''),
        bookId: String(row[2] || ''),
        title: String(row[3] || ''),
        author: String(row[4] || ''),
        pages: Number(row[5]) || 0,
        coverColor: String(row[6] || ''),
        pdfUrl: String(row[7] || ''),
        createdAt: row[8] || null,
        coverColor2: String(row[9] || ''),
        coverImage: String(row[10] || '')
      })).filter(item => item.id);
      return output({ success: true, data: mine });
    }

    if (action === 'getBookSummaries') {
      const sheet = getBookSummariesSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      const summaries = rows.filter(row => row[0] && !row[7]).map(row => ({
        id: String(row[0] || ''), memberId: String(row[1] || ''), memberName: String(row[2] || ''),
        bookTitle: String(row[3] || ''), bookAuthor: String(row[4] || ''),
        summary: String(row[5] || ''), createdAt: row[6]
      }));
      summaries.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return output({ success: true, data: summaries });
    }

    if (action === 'getWeeklyReport') {
      const sheet = getEntriesSheet(ss);
      const lastRow = sheet.getLastRow();
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setDate(start.getDate() - start.getDay());
      const pad = (n) => String(n).padStart(2, '0');
      const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const days = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push(iso(d));
      }
      const from = days[0];
      const to = days[6];
      const totals = {};
      const dayTotals = {};
      days.forEach((day) => { dayTotals[day] = 0; });
      let pages = 0;
      let sessions = 0;
      if (lastRow >= 2) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
        rows.forEach(row => {
          const date = String(row[6] || '').slice(0, 10);
          if (!date || date < from || date > to) return;
          const count = Number(row[5]) || 0;
          const name = String(row[2] || '').trim() || 'عضو جليس';
          pages += count;
          sessions += 1;
          if (dayTotals[date] !== undefined) dayTotals[date] += count;
          const key = String(row[1] || '') || name;
          if (!totals[key]) totals[key] = { memberId: String(row[1] || ''), memberName: name, pages: 0, books: {} };
          totals[key].pages += count;
          const bookTitle = String(row[4] || '').trim();
          if (bookTitle) totals[key].books[bookTitle] = (totals[key].books[bookTitle] || 0) + count;
        });
      }
      const members = Object.keys(totals).map((key) => ({
        memberId: totals[key].memberId,
        memberName: totals[key].memberName,
        pages: totals[key].pages,
        books: Object.keys(totals[key].books).map((title) => ({ title, pages: totals[key].books[title] }))
      })).sort((a, b) => b.pages - a.pages);
      return output({
        success: true,
        from: from,
        to: to,
        pages: pages,
        sessions: sessions,
        readers: members.length,
        days: days.map((day) => ({ date: day, pages: dayTotals[day] || 0 })),
        members: members
      });
    }

    if (action === 'getWeeklyReports') {
      const sheet = getWeeklyReportsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
      const reports = rows.filter(row => row[0] && !row[7]).map(row => ({
        id: String(row[0]), weekNo: Number(row[1]) || 0,
        weekStart: dateKeyOf(row[2]), weekEnd: dateKeyOf(row[3]),
        image: String(row[4]), createdAt: row[5],
        title: String(row[9] || ''), pages: Number(row[10]) || 0,
        participants: Number(row[11]) || 0, notes: String(row[12] || ''),
        images: parseImageList(row[13])
      }));
      reports.sort((a, b) => b.weekNo - a.weekNo);
      return output({ success: true, data: reports });
    }

    /* حذف كل التقارير الأسبوعية دفعة واحدة (للمشرف) */
    if (action === 'deleteAllWeeklyReports') {
      const sheet = getWeeklyReportsSheet(ss);
      const lastRow = sheet.getLastRow();
      let removed = 0;
      for (let row = lastRow; row >= 2; row--) {
        sheet.deleteRow(row);
        removed += 1;
      }
      return output({ success: true, removed: removed, message: 'تم حذف كل التقارير' });
    }

    if (action === 'getSelectionQuotes') {
      const sheet = getSelectionQuotesSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
      const quotes = rows.filter(row => row[0] && !row[7]).map(row => ({
        id: String(row[0] || ''), text: String(row[1] || ''), book: String(row[2] || ''),
        bookAuthor: String(row[3] || ''), authorName: String(row[4] || ''),
        createdAt: row[5], createdBy: String(row[6] || ''), image: String(row[9] || '')
      }));
      quotes.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return output({ success: true, data: quotes });
    }

    if (action === 'getReadingLists') {
      const sheet = getReadingListsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      const lists = rows.map(row => {
        let books = [];
        try { books = JSON.parse(row[3] || '[]'); } catch (error) { books = []; }
        return {
          id: String(row[0] || ''), title: String(row[1] || ''), description: String(row[2] || ''),
          books: Array.isArray(books) ? books : [], cover: String(row[4] || ''),
          createdAt: row[5], createdBy: String(row[6] || ''),
          deletedAt: row[7], deletedBy: String(row[8] || '')
        };
      }).filter(item => item.id && !item.deletedAt);
      lists.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return output({ success: true, data: lists });
    }

    if (action === 'getLikes') {
      const memberId = String(e && e.parameter ? e.parameter.memberId || '' : '').trim();
      const sheet = getLikesSheet(ss);
      const quotes = {};
      const articles = {};
      const mine = { quotes: [], articles: [] };
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        rows.forEach(row => {
          const type = String(row[0] || '').trim();
          const id = String(row[1] || '').trim();
          if (!id) return;
          const who = String(row[2] || '').trim();
          if (type === 'article') {
            articles[id] = (articles[id] || 0) + 1;
            if (memberId && who === memberId) mine.articles.push(id);
          } else {
            quotes[id] = (quotes[id] || 0) + 1;
            if (memberId && who === memberId) mine.quotes.push(id);
          }
        });
      }
      return output({ success: true, quotes: quotes, articles: articles, mine: mine });
    }

    if (action === 'getReadingTips') {
      const sheet = getReadingTipsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      const tips = rows.map((row) => ({
        id: row[0], title: row[1], body: row[2], image: row[3],
        createdAt: row[4], createdBy: row[5], deletedAt: row[6], deletedBy: row[7]
      })).filter((t) => t.id && !t.deletedAt);
      tips.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return output({ success: true, data: tips });
    }

    if (action === 'getPendingMembers') {
      const sheet = getMembersSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
      const pending = [];
      rows.forEach((row, index) => {
        const id = String(row[0] || '');
        if (!id) return;
        const status = memberStatusCode(row[6]);
        if (status === 'active') return;
        pending.push({
          row: index + 2,
          id: id,
          name: String(row[1] || ''),
          email: String(row[2] || ''),
          phone: normalizePhone(row[11]),
          status: status,
          role: String(row[5] || 'member'),
          memberType: String(row[13] || 'member').trim(),
          createdAt: row[7]
        });
      });
      pending.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
      return output({ success: true, data: pending });
    }

    if (action === 'getApprovedMembers') {
      const sheet = getMembersSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
      const members = [];
      rows.forEach((row, index) => {
        if (!String(row[0] || '').trim()) return;
        if (memberStatusCode(row[6]) !== 'active') return;
        members.push({
          id: String(row[0] || ''),
          row: index + 2,
          name: String(row[1] || '').trim(),
          role: String(row[5] || 'member'),
          joinedAt: row[7],
          photo: String(row[12] || ''),
          memberType: String(row[13] || 'member').trim()
        });
      });
      return output({ success: true, data: members });
    }

    if (action === 'getConsultations') {
      const sheet = getConsultationsSheet(ss);
      const lastRow = sheet.getLastRow();
      const rows = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      const consultations = rows.map(row => ({
        id: String(row[0] || ''),
        memberId: String(row[1] || ''),
        memberName: String(row[2] || ''),
        question: String(row[3] || ''),
        askedAt: row[4],
        answer: String(row[5] || ''),
        answeredById: String(row[6] || ''),
        answeredBy: String(row[7] || ''),
        answeredAt: row[8]
      })).filter(item => item.id && item.question);
      consultations.sort((a, b) => {
        const aTime = new Date(a.askedAt || 0).getTime() || Number(a.askedAt) || 0;
        const bTime = new Date(b.askedAt || 0).getTime() || Number(b.askedAt) || 0;
        return bTime - aTime;
      });
      const requestedMemberId = String(e && e.parameter ? e.parameter.memberId || '' : '').trim();
      let canAnswer = false;
      if (requestedMemberId) {
        const membersSheet = getMembersSheet(ss);
        const memberRow = findMemberRowById(membersSheet, requestedMemberId);
        if (memberRow > 1) {
          const member = membersSheet.getRange(memberRow, 1, 1, 13).getValues()[0];
          canAnswer = memberStatusCode(member[6]) === 'active' && isConsultantName(member[1]);
        }
      }
      return output({
        success: true,
        data: consultations,
        canAnswer: canAnswer,
        consultantsConfigured: true
      });
    }

    if (action === 'getLibraryCategories') {
      return output({ success: true, data: getLibraryCategoryNames(ss) });
    }

    if (action === 'getClubBooks') {
      const sources = libraryBookSheets(ss);

      const booksById = {};
      const seenKeys = new Set();
      const deletedIds = new Set();
      const deletedKeys = new Set();
      /* الشاهد الدائم للمحذوفات (حتى لو ضاع صف الكتاب) */
      const registry = deletedBookRegistry(ss);
      registry.ids.forEach((id) => deletedIds.add(id));
      registry.keys.forEach((key) => deletedKeys.add(key));

      /* 1) المحذوف من كل النسخ أولًا — حتى لا يظهر كتاب محذوف من نسخة أخرى */
      sources.forEach(sheet => {
        ensureBookDeleteColumns(sheet);
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return;
        const rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
        rows.forEach((row, index) => {
          if (!row[3] || !row[11]) return;
          const id = String(row[0] || `legacy-${sheet.getSheetId()}-${index + 2}`);
          deletedIds.add(id);
          deletedKeys.add(bookKey(row[3], row[4]));
        });
      });

      /* 2) ثم بقية الكتب */
      sources.forEach(sheet => {
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return;
        const rows = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
        rows.forEach((row, index) => {
          if (!row[3]) return;
          const id = String(row[0] || `legacy-${sheet.getSheetId()}-${index + 2}`);
          if (row[11]) return;
          /* منع التكرار: نفس العنوان والمؤلف يظهر مرة واحدة فقط */
          const key = bookKey(row[3], row[4]);
          if (key && key !== '|') {
            if (deletedKeys.has(key)) return;
            if (seenKeys.has(key)) return;
            seenKeys.add(key);
          }
          booksById[id] = {
            id, memberId: row[1], memberName: row[2], title: row[3],
            author: row[4], category: row[5], coverColor: row[6],
            report: row[7], pages: row[8], createdAt: row[9],
            coverImage: row[10] || '', year: row[13] || '', pdfUrl: row[14] || '',
            coverColor2: row[15] || ''
          };
        });
      });
      return output({ success: true, data: Object.values(booksById), deletedIds: [...deletedIds], deletedKeys: [...deletedKeys] });
    }

    if (action === 'getJoinRequests') {
      const sheet = getJoinRequestsSheet(ss);
      ensureJoinRequestStatuses(sheet);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      const requests = rows.map((row, index) => ({
        row: index + 2,
        name: row[0], phone: row[1], note: row[2], ts: row[3],
        status: normalizeJoinStatus(row[4]),
        decidedAt: row[5], decidedBy: row[6]
      })).filter((item) => String(item.name || '').trim() || String(item.phone || '').trim());
      return output({ success: true, data: requests });
    }

    if (action === 'getArticles') {
      const sheet = getArticlesSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [], deletedIds: [], authorPhotos: {} });
      const rows = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
      const articles = [];
      const deletedIds = [];
      rows.forEach(row => {
        if (!row[0]) return;
        if (row[9]) { deletedIds.push(String(row[0])); return; }
        articles.push({
          id: row[0], memberId: row[1], memberName: row[2],
          title: row[3], category: row[4], body: row[5],
          excerpt: row[6], read: row[7], createdAt: row[8]
        });
      });
      const authorPhotos = getMemberPhotosForIds(ss, articles.map(article => article.memberId));
      return output({ success: true, data: articles, deletedIds: deletedIds, authorPhotos: authorPhotos });
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
      const rows = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
      const display = sheet.getRange(2, 4, lastRow - 1, 2).getDisplayValues();
      const meetings = rows.map((row, idx) => ({
        id: row[0], title: row[1], description: row[2], date: String(display[idx][0] || row[3] || ''),
        time: String(display[idx][1] || row[4] || ''), location: row[5], image: row[6],
        createdAt: row[7], createdBy: row[8],
        imagePosX: Number(row[9]) || 50, imagePosY: Number(row[10]) || 50, imageScale: Number(row[11]) || 100
      })).filter(meeting => meeting.id);
      meetings.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return output({ success: true, data: meetings });
    }

    if (action === 'getRecordedMeetings') {
      const sheet = getRecordedMeetingsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [], deletedIds: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
      const recordings = [];
      const deletedIds = [];
      rows.forEach(row => {
        if (!row[0]) return;
        if (row[11]) { deletedIds.push(String(row[0])); return; }
        recordings.push({
          id: row[0], title: row[1], description: row[2], recordedAt: row[3],
          speaker: row[4], views: Number(row[5]) || 0, duration: row[6],
          videoUrl: row[7], image: row[8], createdAt: row[9], createdBy: row[10],
          type: row[13] || '', location: row[14] || '', images: parseImageList(row[15])
        });
      });
      recordings.sort((a, b) => {
        const dateA = new Date(a.recordedAt || a.createdAt || 0).getTime() || 0;
        const dateB = new Date(b.recordedAt || b.createdAt || 0).getTime() || 0;
        return dateB - dateA;
      });
      return output({ success: true, data: recordings, deletedIds: deletedIds });
    }

    if (action === 'getDeletedItems') {
      const deleted = [];

      const quoteSheet = ss.getSheetByName(QUOTES_SHEET);
      if (quoteSheet && quoteSheet.getLastRow() >= 2) {
        ensureQuoteDeleteColumns(quoteSheet);
        const rows = quoteSheet.getRange(2, 1, quoteSheet.getLastRow() - 1, 8).getValues();
        rows.forEach((row, index) => {
          if (!row[6] || !row[4]) return;
          deleted.push({
            type: 'quote', id: String(row[5] || `sheet-${index + 1}`),
            title: String(row[4]).slice(0, 120), text: row[4], book: row[3],
            deletedAt: row[6], deletedBy: row[7] || ''
          });
        });
      }

      libraryBookSheets(ss)
        .forEach(sheet => {
          ensureBookDeleteColumns(sheet);
          const lastRow = sheet.getLastRow();
          if (lastRow < 2) return;
          const rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
          rows.forEach((row, index) => {
            if (!row[11]) return;
            deleted.push({
              type: 'book', id: bookIdForRow(sheet, row[0], index), title: row[3] || 'كتاب',
              category: row[5] || '', deletedAt: row[11], deletedBy: row[12] || ''
            });
          });
        });

      const categorySheet = getLibraryCategoriesSheet(ss);
      if (categorySheet.getLastRow() >= 2) {
        const rows = categorySheet.getRange(2, 1, categorySheet.getLastRow() - 1, 4).getValues();
        rows.forEach(row => {
          if (!row[1] || !row[0]) return;
          let bookIds = [];
          try { bookIds = JSON.parse(row[3] || '[]'); } catch (error) { bookIds = []; }
          deleted.push({
            type: 'shelf', id: String(row[0]), title: String(row[0]),
            deletedAt: row[1], deletedBy: row[2] || '', booksCount: bookIds.length
          });
        });
      }

      const articleSheet = getArticlesSheet(ss);
      if (articleSheet.getLastRow() >= 2) {
        const rows = articleSheet.getRange(2, 1, articleSheet.getLastRow() - 1, 11).getValues();
        rows.forEach(row => {
          if (!row[9] || !row[0]) return;
          deleted.push({
            type: 'article', id: String(row[0]), title: row[3] || 'مقال',
            category: row[4] || '', deletedAt: row[9], deletedBy: row[10] || ''
          });
        });
      }

      const recordedSheet = getRecordedMeetingsSheet(ss);
      if (recordedSheet.getLastRow() >= 2) {
        const rows = recordedSheet.getRange(2, 1, recordedSheet.getLastRow() - 1, 13).getValues();
        rows.forEach(row => {
          if (!row[11] || !row[0]) return;
          deleted.push({
            type: 'recording', id: String(row[0]), title: row[1] || 'لقاء مسجل',
            category: row[4] || '', deletedAt: row[11], deletedBy: row[12] || ''
          });
        });
      }

      deleted.sort((a, b) => (Number(b.deletedAt) || 0) - (Number(a.deletedAt) || 0));
      return output({ success: true, data: deleted });
    }

    // قراءة الاقتباسات
    const sheet = getQuotesSheet(ss);
    ensureQuoteDeleteColumns(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return output({ success: true, status: 'success', data: [], deletedIds: [], deletedTexts: [] });
    const rows = sheet.getRange(1, 1, lastRow, 9).getValues();
    const quotes = [];
    const deletedIds = [];
    const deletedTexts = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][4]) {
        const id = String(rows[i][5] || `sheet-${i}`);
        if (rows[i][6]) {
          deletedIds.push(id);
          deletedTexts.push(rows[i][4]);
          continue;
        }
        quotes.push({
          id: id,
          created_at: rows[i][0],
          author_name: rows[i][1],
          page_number: rows[i][2],
          book_title: rows[i][3],
          quote_text: rows[i][4],
          book_author: rows[i][8] || ''
        });
      }
    }
    return output({ success: true, status: 'success', data: quotes, deletedIds: deletedIds, deletedTexts: deletedTexts });
  } catch (error) {
    return output({ success: false, status: 'error', error: error.toString() });
  }
}

/* ==========================================================================
   تنظيم الشيت: تسمية موحّدة + حذف ما لا داعي له + ترتيب التبويبات
   - الأسماء القديمة تُعاد تسميتها إلى الأسماء القياسية (بلا فقدان بيانات)
   - التبويبات الفارغة والمكرّرة تُحذف
   - الترتيب النهائي منطقي (الأعضاء أولًا … الإحصاءات آخرًا)
   ========================================================================== */

/* الاسم القياسي ← الأسماء القديمة المحتملة (بدون تكرار الاسم القياسي) */
const SHEET_NAME_ALIASES = {
  'الأعضاء': ['الاعضاء', 'أعضاء النادي', 'العضو', 'members'],
  'الاقتباسات': ['الاقتباس', 'اقتباسات', 'quotes', 'اقتباس'],
  'المقالات': ['مقالات', 'المقال', 'articles', 'مقالة'],
  'المكتبة': ['كتب النادي', 'الكتب', 'مكتبة النادي', 'books', 'المكتبة القديمة'],
  'تصنيفات المكتبة': ['التصنيفات', 'تصنيفات', 'رفوف المكتبة', 'categories'],
  'تقييمات الكتب': ['التقييمات', 'تقييمات', 'ratings'],
  'طلبات الانضمام': ['الطلبات', 'انضمام', 'طلبات', 'join requests'],
  'اللقاءات': ['لقاءات', 'الMeetings', 'meetings'],
  'أرشيف النادي': ['اللقاءات المسجلة', 'التسجيلات', 'أرشيف اللقاءات', 'recordings', 'أرشيف'],
  'النوافذ القرائية': ['نافذة قرائية', 'النافذة القرائية', 'نوافذ', 'reading windows', 'نوافذ قرائية'],
  'التقارير الأسبوعية': ['التقارير', 'تقارير أسبوعية', 'التقرير الأسبوعي', 'weekly reports'],
  'الملفات الشخصية': ['الملف الشخصي', 'ملفات شخصية', 'profiles', 'الملفات'],
  'سجلات القراءة': ['سجلات', 'سجل القراءة', 'entries', 'القراءات'],
  'استشارات الأعضاء': ['الاستشارات', 'استشارات', 'consultations'],
  'الإعجابات': ['الاعجابات', 'اعجابات', 'likes', 'الإعجاب'],
  'كتبي الخاصة': ['كتب خاصة', 'مكتبتي', 'personal books', 'الكتب الخاصة'],
  'القوائم القرائية': ['القوائم', 'قوائم', 'reading lists'],
  'مختارات الاقتباسات': ['مختارات', 'اقتباسات مختارة', 'selection quotes'],
  'ملخصات الأعضاء': ['الملخصات', 'ملخصات', 'summaries']
};

/* التبويبات القياسية بالترتيب + وصفها */
const SHEET_ORDER = [
  'الأعضاء', 'الملفات الشخصية', 'طلبات الانضمام', 'استشارات الأعضاء',
  'المكتبة', 'تصنيفات المكتبة', 'تقييمات الكتب',
  'مكتبات الأعضاء', 'كتبي الخاصة', 'سجلات القراءة',
  'الاقتباسات', 'مختارات الاقتباسات', 'المقالات', 'ملخصات الأعضاء', 'القوائم القرائية',
  'النوافذ القرائية', 'اللقاءات', 'أرشيف النادي', 'التقارير الأسبوعية', 'الإعجابات'
];

function normalizeSheetName(value) {
  let text = String(value || '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[‌‍‎‏]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  /* نحذف «ال» التعريف في البداية لمطابقة «المكتبة» بـ«مكتبة» */
  text = text.replace(/^ال(?=.{2,})/, '');
  return text;
}

/* أسماء تبويبات عامة لا قيمة لها — تُحذف إن كانت فارغة */
function isJunkSheetName(name) {
  let normalized = String(name || '').trim().toLowerCase();
  if (!normalized) return true;
  /* «الورقة 1» ← «ورقة 1» */
  normalized = normalized.replace(/^ال(?=ورقة|صفحة|نسخة)/, '');
  if (/^(sheet|ورقة|صفحة|tab|untitled|نسخة|copy)[ _-]*\d*$/i.test(normalized)) return true;
  return false;
}

function canonicalSheetName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const normalized = normalizeSheetName(raw);
  if (SHEET_ORDER.indexOf(raw) >= 0) return raw;
  /* مطابقة التطبيع: «النافذه القرائيه» → «النوافذ القرائية» */
  for (let i = 0; i < SHEET_ORDER.length; i++) {
    const canonical = SHEET_ORDER[i];
    if (normalizeSheetName(canonical) === normalized) return canonical;
    const aliases = SHEET_NAME_ALIASES[canonical] || [];
    for (let j = 0; j < aliases.length; j++) {
      if (normalizeSheetName(aliases[j]) === normalized) return canonical;
    }
  }
  return '';
}

/* هل التبويب فارغ تمامًا (لا صفوف بيانات)؟ */
function sheetHasNoData(sheet) {
  if (!sheet) return true;
  try {
    if (sheet.getLastRow() <= 1) return true;
    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(1, sheet.getLastColumn());
    const values = sheet.getRange(2, 1, Math.max(1, lastRow - 1), lastCol).getValues();
    return values.every((row) => row.every((cell) => String(cell === null ? '' : cell).trim() === ''));
  } catch (error) {
    return false;
  }
}

/* دمج بيانات تبويب في آخر (مطابقة الأعمدة بالاسم) */
function mergeSheetInto(destination, source) {
  try {
    const sourceRows = source.getDataRange().getValues();
    const targetRows = destination.getDataRange().getValues();
    if (!sourceRows.length) return 0;
    const targetHeaders = (targetRows[0] || []).map((h) => String(h || '').trim());
    const sourceHeaders = (sourceRows[0] || []).map((h) => String(h || '').trim());
    const map = sourceHeaders.map((h, index) => {
      const pos = targetHeaders.indexOf(h);
      return pos >= 0 ? pos : index;
    });
    const existingKeys = new Set(targetRows.slice(1).map((row) => row.map((c) => String(c === null ? '' : c)).join('|')));
    const additions = sourceRows.slice(1)
      .map((row) => map.map((pos) => (row[pos] === undefined ? '' : row[pos])))
      .filter((row) => row.some((c) => String(c === null ? '' : c).trim() !== ''))
      .filter((row) => !existingKeys.has(row.map((c) => String(c === null ? '' : c)).join('|')));
    if (additions.length) {
      destination.getRange(destination.getLastRow() + 1, 1, additions.length, additions[0].length).setValues(additions);
    }
    return additions.length;
  } catch (error) {
    return 0;
  }
}

/* دمج كتب: يكمل الحقول الفارغة من النسخة الأخرى (الملف/PDF/التقرير) */
function mergeBooksSheetInto(destination, source) {
  const destRows = destination.getDataRange().getValues();
  const destHeaders = (destRows[0] || []).map((h) => String(h || '').trim());
  const srcRows = source.getDataRange().getValues();
  const srcHeaders = (srcRows[0] || []).map((h) => String(h || '').trim());
  const destTitle = destHeaders.indexOf('title');
  const destAuthor = destHeaders.indexOf('author');
  const srcTitle = srcHeaders.indexOf('title');
  const srcAuthor = srcHeaders.indexOf('author');
  if (destTitle < 0 || destAuthor < 0 || srcTitle < 0 || srcAuthor < 0) return { added: 0 };

  const byKey = new Map();
  destRows.slice(1).forEach((row, index) => {
    const key = bookKey(row[destTitle], row[destAuthor]);
    if (key && key !== '|') byKey.set(key, index + 2);
  });

  let completed = 0;
  const additions = [];
  srcRows.slice(1).forEach((row) => {
    const key = bookKey(row[srcTitle], row[srcAuthor]);
    const existingRow = byKey.get(key);
    if (existingRow !== undefined) {
      const values = destination.getRange(existingRow, 1, 1, destHeaders.length).getValues()[0].slice();
      let changed = false;
      destHeaders.forEach((header, index) => {
        const sourceIndex = srcHeaders.indexOf(header);
        if (sourceIndex < 0) return;
        const sourceValue = row[sourceIndex];
        const empty = values[index] === undefined || values[index] === null || String(values[index]).trim() === '';
        if (empty && sourceValue !== undefined && sourceValue !== null && String(sourceValue).trim() !== '') {
          values[index] = sourceValue;
          changed = true;
        }
      });
      if (changed) {
        destination.getRange(existingRow, 1, 1, values.length).setValues([values]);
        completed += 1;
      }
      return;
    }
    additions.push(row);
  });

  if (additions.length) {
    const mapped = additions.map((row) => destHeaders.map((header, index) => {
      const sourceIndex = srcHeaders.indexOf(header);
      if (sourceIndex >= 0) return row[sourceIndex];
      return row[index] !== undefined ? row[index] : '';
    }));
    destination.getRange(destination.getLastRow() + 1, 1, mapped.length, destHeaders.length).setValues(mapped);
  }
  return { added: additions.length, completed: completed };
}

function organizeSheets(ss) {
  const target = resolveSpreadsheet(ss);
  const report = [];
  const sheets = target.getSheets();

  /* 1) إعادة التسمية + حذف المكرر/الفارغ */
  const renamed = [];
  const deleted = [];
  const keptUnknown = [];

  sheets.slice().forEach((sheet) => {
    const currentName = sheet.getName();
    if (isJunkSheetName(currentName)) {
      if (sheetHasNoData(sheet)) {
        target.deleteSheet(sheet);
        deleted.push(currentName + ' (فارغ)');
      } else {
        try {
          sheet.setName('أرشيف — ' + currentName);
          renamed.push(currentName + ' → أرشيف — ' + currentName);
        } catch (error) { /* تجاهل */ }
      }
      return;
    }
    /* الاسم القياسي: من الاسم نفسه أو من مخطط الأعمدة (للتكرارات ذات الأسماء الملخبطة) */
    const canonical = canonicalSheetName(currentName) || detectSheetByHeaders(sheet);
    if (!canonical) {
      /* تبويب مجهول وفارغ — نحذفه */
      if (sheetHasNoData(sheet)) {
        target.deleteSheet(sheet);
        deleted.push(currentName + ' (فارغ)');
        return;
      }
      keptUnknown.push(currentName);
      return;
    }
    if (canonical === currentName) return;
    const existing = target.getSheetByName(canonical);
    if (existing && existing.getSheetId() !== sheet.getSheetId()) {
      let added = 0;
      if (canonical === BOOKS_SHEET) {
        const result = mergeBooksSheetInto(existing, sheet);
        added = result.added;
        if (result.completed) report.push('اكتملت بيانات ' + result.completed + ' كتاب في ' + canonical);
      } else {
        added = mergeSheetInto(existing, sheet);
      }
      target.deleteSheet(sheet);
      deleted.push(currentName + ' (مكرّر → ' + canonical + (added ? ' · ' + added + ' صف' : '') + ')');
      return;
    }
    try {
      sheet.setName(canonical);
      renamed.push(currentName + ' → ' + canonical);
    } catch (error) { /* تجاهل */ }
  });

  if (renamed.length) report.push('أُعيدت تسمية: ' + renamed.join('، '));
  if (deleted.length) report.push('حُذف: ' + deleted.join('، '));

  /* 2) ضمان وجود تبويب المكتبة (الأساسي) */
  if (!target.getSheetByName(BOOKS_SHEET)) {
    try {
      getBooksSheet(target);
      report.push('أُنشئ: ' + BOOKS_SHEET);
    } catch (error) { /* تجاهل */ }
  }

  /* 3) التبويبات القياسية بالترتيب، وبعدها أي تبويب غير معروف */
  const ordered = [];
  SHEET_ORDER.forEach((name) => {
    const sheet = target.getSheetByName(name);
    if (sheet) ordered.push(sheet);
  });
  const all = target.getSheets();
  all.forEach((sheet) => { if (ordered.indexOf(sheet) < 0) ordered.push(sheet); });
  ordered.forEach((sheet, index) => {
    try { target.setActiveSheet(sheet); target.moveActiveSheet(index + 1); } catch (error) { /* تجاهل */ }
  });

  report.push('الترتيب: ' + ordered.map((s) => s.getName()).join(' ← '));
  if (keptUnknown.length) report.push('أُبقيت (غير معروفة): ' + keptUnknown.join('، '));

  return { report: report, renamed: renamed, deleted: deleted, keptUnknown: keptUnknown };
}

/* وصف محتويات الشيت — لمساعدتك على المراجعة */
function describeSpreadsheet() {
  const ss = resolveSpreadsheet();
  const sheets = ss.getSheets().map((sheet) => {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    let headers = [];
    try {
      headers = lastRow > 0 ? sheet.getRange(1, 1, 1, Math.max(1, lastCol)).getValues()[0].map((h) => String(h || '').trim()) : [];
    } catch (error) { headers = []; }
    return {
      name: sheet.getName(),
      rows: lastRow,
      dataRows: Math.max(0, lastRow - 1),
      cols: lastCol,
      headers: headers,
      empty: sheetHasNoData(sheet)
    };
  });
  return sheets;
}

/* ==========================================================================
   دالة تجهيز تُشغَّل يدويًا مرة واحدة من محرر Apps Script (Run)
   تنشئ أعمدة الحذف وسنة النشر، وتُعيد تلوين الصفوف المحذوفة بالأحمر.
   ========================================================================== */
/* إصلاح رؤوس الأعمدة التالفة (تكرار أو نصوص مشوّهة) */
function repairSheetHeaders(ss) {
  const target = resolveSpreadsheet(ss);
  const fixes = [];
  const apply = (name, headers) => {
    const sheet = target.getSheetByName(name);
    if (!sheet) return;
    try {
      const current = sheetHeaderList(sheet);
      const width = Math.max(current.length, headers.length);
      const changed = headers.some((h, i) => String(current[i] || '') !== h);
      if (!changed) return;
      const row = [];
      for (let i = 0; i < width; i++) row.push(headers[i] || '');
      sheet.getRange(1, 1, 1, width).setValues([row]);
      fixes.push(name);
    } catch (error) { /* تجاهل */ }
  };
  apply(QUOTES_SHEET, ['created_at', 'author_name', 'page_number', 'book_title', 'quote_text', 'id', 'deletedAt', 'deletedBy', 'bookAuthor']);
  apply(ARTICLES_SHEET, ['id', 'memberId', 'memberName', 'title', 'category', 'body', 'excerpt', 'read', 'createdAt', 'deletedAt', 'deletedBy']);
  apply(MEETINGS_SHEET, ['id', 'title', 'description', 'date', 'time', 'location', 'image', 'createdAt', 'createdBy', 'imagePosX', 'imagePosY', 'imageScale']);
  apply(RECORDED_MEETINGS_SHEET, ['id', 'title', 'description', 'recordedAt', 'speaker', 'views', 'duration', 'videoUrl', 'image', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy', 'type', 'location', 'images']);
  apply(SELECTION_QUOTES_SHEET, ['id', 'text', 'book', 'bookAuthor', 'authorName', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy', 'image', 'quoteId']);
  apply(BOOK_SUMMARIES_SHEET, ['id', 'memberId', 'memberName', 'bookTitle', 'bookAuthor', 'summary', 'createdAt', 'deletedAt', 'deletedBy']);
  apply(READING_LISTS_SHEET, ['id', 'title', 'description', 'books', 'cover', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy']);
  apply(WEEKLY_REPORTS_SHEET, ['id', 'weekNo', 'weekStart', 'weekEnd', 'image', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy', 'title', 'pages', 'participants', 'notes']);
  apply(LIKES_SHEET, ['type', 'targetId', 'memberId', 'memberName', 'createdAt']);
  apply(PERSONAL_BOOKS_SHEET, ['memberId', 'memberName', 'bookId', 'title', 'author', 'pages', 'coverColor', 'pdfUrl', 'createdAt', 'coverColor2', 'coverImage']);
  apply(READING_TIPS_SHEET, ['id', 'title', 'body', 'image', 'createdAt', 'createdBy', 'deletedAt', 'deletedBy']);
  apply(CONSULTATIONS_SHEET, ['id', 'memberId', 'memberName', 'question', 'askedAt', 'answer', 'answeredById', 'answeredBy', 'answeredAt']);
  apply(ENTRIES_SHEET, ['id', 'memberId', 'memberName', 'bookId', 'bookTitle', 'pages', 'date', 'createdAt']);
  apply(PROFILES_SHEET, ['memberId', 'name', 'role', 'joined', 'goal', 'lastWeekPages', 'notifications']);
  apply(BOOK_RATINGS_SHEET, ['id', 'bookId', 'memberId', 'memberName', 'rating', 'review', 'createdAt']);
  apply(LIBRARY_CATEGORIES_SHEET, ['category', 'deletedAt', 'deletedBy', 'booksSnapshot']);
  apply(JOIN_REQUESTS_SHEET, ['name', 'phone', 'note', 'ts', 'status', 'decidedAt', 'decidedBy']);
  return fixes;
}

function setupJaleesSheets() {
  const ss = SpreadsheetApp.openById('1s_7SIePvvoBHcZSlqNqtNH9g6IIOCcr7GIKf7hC-46g');
  const report = [];
  /* كل خطوة داخل try/catch حتى لا يوقف خطأ واحد 나머ح الإعداد */
  const step = (label, fn) => {
    try {
      const value = fn();
      report.push(label + (value === undefined || value === null ? '' : ': ' + value));
    } catch (error) {
      report.push(label + ': فشل - ' + (error && error.message ? error.message : String(error)));
    }
  };

  /* أولًا: إصلاح رؤوس الأعمدة (حتى نكتشف التكرارات بمخطط الأعمدة) */
  step('إصلاح رؤوس الأعمدة', () => {
    const fixed = repairSheetHeaders(ss);
    return fixed.length ? fixed.join('، ') : 'سليمة';
  });

  /* ثانيًا: دمج «المكتبة» مع النسخة القديمة وحذفها — مصدر واحد للمكتبة */
  step('دمج المكتبة مع النسخة القديمة وحذفها', () => {
    const main = getBooksSheet(ss);
    const legacy = ss.getSheetById(OLD_BOOKS_SHEET_ID);
    if (!legacy || legacy.getSheetId() === main.getSheetId()) return 'لا توجد نسخة قديمة';
    const result = mergeBooksSheetInto(main, legacy);
    try { ss.deleteSheet(legacy); } catch (error) { /* تجاهل */ }
    return 'أُضيف ' + result.added + ' كتاب · أُكمل ' + result.completed + ' كتاب (ملفات PDF والأغلفة الناقصة)';
  });

  /* ثالثًا: توحيد الأسماء وترتيب التبويبات */
  step('تنظيم التبويبات', () => {
    const result = organizeSheets(ss);
    return result.report.join(' · ');
  });

  step('إصلاح رؤوس الأعمدة (مرة أخرى بعد التنظيم)', () => {
    const fixed = repairSheetHeaders(ss);
    return fixed.length ? fixed.join('، ') : 'سليمة';
  });

  step(BOOKS_SHEET, () => {
    const books = getBooksSheet(ss);
    books.getRange(1, 1, 1, 16).setValues([[
      'id', 'memberId', 'memberName', 'title', 'author', 'category', 'coverColor',
      'report', 'pages', 'createdAt', 'coverImage', 'deletedAt', 'deletedBy', 'year', 'pdfUrl', 'coverColor2'
    ]]);
    repaintDeletedRows(books, 12, 14);
    return books.getMaxColumns() + ' عمود';
  });

  step(ARTICLES_SHEET, () => {
    const articles = getArticlesSheet(ss);
    articles.getRange(1, 10, 1, 2).setValues([['deletedAt', 'deletedBy']]);
    repaintDeletedRows(articles, 10, 11);
    return articles.getMaxColumns() + ' عمود';
  });

  step(QUOTES_SHEET, () => {
    const quotes = ss.getSheetByName(QUOTES_SHEET);
    if (!quotes) return 'غير موجود';
    ensureQuoteDeleteColumns(quotes);
    repaintDeletedRows(quotes, 7, 8);
    return quotes.getMaxColumns() + ' عمود';
  });

  step(MEETINGS_SHEET, () => {
    const meetings = getMeetingsSheet(ss);
    return meetings.getMaxColumns() + ' عمود';
  });

  step(RECORDED_MEETINGS_SHEET, () => {
    const recorded = getRecordedMeetingsSheet(ss);
    repaintDeletedRows(recorded, 12, 13);
    return recorded.getMaxColumns() + ' عمود';
  });

  step(LIBRARY_CATEGORIES_SHEET, () => {
    const categories = getLibraryCategoriesSheet(ss);
    repaintDeletedRows(categories, 2, 4);
    return categories.getMaxColumns() + ' عمود';
  });

  step(MEMBERS_SHEET, () => {
    const members = getMembersSheet(ss);
    const repaired = repairMemberPasswordColumn(members);
    return members.getMaxColumns() + ' عمود' + (repaired ? ' · إصلاح ' + repaired + ' حساب' : '');
  });

  step('مكتبات الأعضاء', () => {
    const myBooks = getMyBooksSheet(ss);
    return myBooks.getMaxColumns() + ' عمود';
  });

  step(PROFILES_SHEET, () => {
    const profiles = getProfilesSheet(ss);
    return profiles.getMaxColumns() + ' عمود';
  });

  step(ENTRIES_SHEET, () => {
    const entries = getEntriesSheet(ss);
    return entries.getMaxColumns() + ' عمود';
  });

  step(CONSULTATIONS_SHEET, () => {
    const consultations = getConsultationsSheet(ss);
    return consultations.getMaxColumns() + ' عمود';
  });

  step(JOIN_REQUESTS_SHEET, () => {
    const joinRequests = getJoinRequestsSheet(ss);
    ensureJoinRequestStatuses(joinRequests);
    return joinRequests.getMaxColumns() + ' عمود';
  });

  step('تنظيف صفوف فارغة في المكتبة', () => {
    const target = getBooksSheet(ss);
    let removed = 0;
    const lastRow = target.getLastRow();
    for (let row = lastRow; row >= 2; row--) {
      const values = target.getRange(row, 1, 1, 5).getDisplayValues()[0];
      const hasContent = values.some((value) => String(value || '').trim());
      if (hasContent) continue;
      try { target.deleteRow(row); removed += 1; } catch (error) { /* تجاهل */ }
    }
    return removed ? removed + ' صف فارغ' : 'لا صفوف فارغة';
  });

  step(MAIL_LOG_SHEET, () => {
    const mailLog = getMailLogSheet(ss);
    return mailLog.getMaxColumns() + ' عمود · نسخة إلى ' + mailBccAddress();
  });

  step(NOTIFICATIONS_SHEET, () => {
    const notifications = getNotificationsSheet(ss);
    return notifications.getMaxColumns() + ' عمود · قناة الإرسال: ' + pushSettings().channel;
  });

  step(READING_TIPS_SHEET, () => {
    // توحيد التسمية: «نافذة قرائية» → «النوافذ القرائية» (بدون فقدان البيانات)
    const oldSheet = ss.getSheetByName('نافذة قرائية');
    if (oldSheet) {
      try { oldSheet.setName(READING_TIPS_SHEET); } catch (error) { /* قد توجد تبويبة بنفس الاسم */ }
    }
    const tips = getReadingTipsSheet(ss);
    return tips.getMaxColumns() + ' عمود';
  });

  step('ترتيب التبويبات', () => {
    const result = organizeSheets(ss);
    return result.report.join(' · ');
  });

  step(LIKES_SHEET, () => {
    const likes = getLikesSheet(ss);
    return likes.getMaxColumns() + ' عمود';
  });

  step(PERSONAL_BOOKS_SHEET, () => {
    const personal = getPersonalBooksSheet(ss);
    return personal.getMaxColumns() + ' عمود';
  });

  step(READING_LISTS_SHEET, () => {
    const lists = getReadingListsSheet(ss);
    return lists.getMaxColumns() + ' عمود';
  });

  step(SELECTION_QUOTES_SHEET, () => {
    const selected = getSelectionQuotesSheet(ss);
    return selected.getMaxColumns() + ' عمود';
  });

  step(WEEKLY_REPORTS_SHEET, () => {
    const weekly = getWeeklyReportsSheet(ss);
    return weekly.getMaxColumns() + ' عمود';
  });

  step(BOOK_SUMMARIES_SHEET, () => {
    const summaries = getBookSummariesSheet(ss);
    return summaries.getMaxColumns() + ' عمود';
  });

  /* تسجيل الكتب التي حُذفت قبل إنشاء «سجل المحذوفات» حتى لا تظهر في المتصفحات */
  step('سجل المحذوفات', () => {
    const legacy = [
      'club-1794356579330', 'club-1794356738327', 'club-1794356822293',
      'club-1794476475872', 'club-1793495137723', 'book-test', 'b-test',
      'club-1794257018640'
    ];
    legacy.forEach((id) => { logDeletedItem(ss, id, 'book', '', '', 'مشرف'); });
    return legacy.length + ' معرّفًا مسجّلًا';
  });

  step('تنظيف الكتب المكرّرة', () => {
    const result = dedupeClubBooks(ss);
    return result.removed ? 'حُذف ' + result.removed + ' مكرر' : 'لا تكرار';
  });

  step('تصغير روابط الصور', () => {
    const result = shrinkImageLinks();
    return result.updated + ' رابط مصغّر';
  });

  step('الحفظ النهائي', () => {
    SpreadsheetApp.flush();
    return 'تم';
  });

  return report.join(' | ');
}

/* إصلاح أي حساب تضرر لأن نوع العضوية كُتب بالخطأ فوق كلمة المرور */
function repairMemberPasswordColumn(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  let fixed = 0;
  rows.forEach((row, index) => {
    const hash = String(row[3] || '').trim().toLowerCase();
    if (hash === 'member' || hash === 'friend' || hash === 'consultant' || hash === 'supervisor') {
      sheet.getRange(index + 2, 4).setValue('');
      fixed += 1;
    }
  });
  return fixed;
}

function repaintDeletedRows(sheet, deleteColumn, width) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const flags = sheet.getRange(2, deleteColumn, lastRow - 1, 1).getValues();
  flags.forEach((row, index) => paintDeletedRow(sheet, index + 2, Boolean(row[0]), width));
}

