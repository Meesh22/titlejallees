const QUOTES_SHEET = 'الاقتباسات';
const BOOKS_SHEET = 'المكتبة';
const ARTICLES_SHEET = 'المقالات';
const BOOK_RATINGS_SHEET = 'تقييمات الكتب';
const LIBRARY_CATEGORIES_SHEET = 'تصنيفات المكتبة';
const JOIN_REQUESTS_SHEET = 'طلبات الانضمام';
const MEETINGS_SHEET = 'اللقاءات';
const RECORDED_MEETINGS_SHEET = 'اللقاءات المسجلة';
const MEMBERS_SHEET = 'الأعضاء';
const OLD_BOOKS_SHEET_ID = 1035156833;
const SUPERVISOR_NAMES = ['مشعل عبدالرحمن الحفير', 'مشعل الحفير', 'محمد صالح الدبيخي', 'محمد الدبيخي'];
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
  ensureRecordedMeetingDeleteColumns(sheet);
  return sheet;
}

function ensureQuoteDeleteColumns(sheet) {
  if (sheet.getMaxColumns() < 8) sheet.insertColumnsAfter(sheet.getMaxColumns(), 8 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 6).getValue()) sheet.getRange(1, 6).setValue('id');
  if (!sheet.getRange(1, 7).getValue()) sheet.getRange(1, 7).setValue('deletedAt');
  if (!sheet.getRange(1, 8).getValue()) sheet.getRange(1, 8).setValue('deletedBy');
}

function ensureBookDeleteColumns(sheet) {
  if (sheet.getMaxColumns() < 14) sheet.insertColumnsAfter(sheet.getMaxColumns(), 14 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 11).getValue()) sheet.getRange(1, 11).setValue('coverImage');
  if (!sheet.getRange(1, 12).getValue()) sheet.getRange(1, 12).setValue('deletedAt');
  if (!sheet.getRange(1, 13).getValue()) sheet.getRange(1, 13).setValue('deletedBy');
  if (!sheet.getRange(1, 14).getValue()) sheet.getRange(1, 14).setValue('year');
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
    range.setBackground(null);
    range.setFontColor(null);
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
  rejected: { background: '#f4cccc', font: '#9c0006' }
};

function memberStatusCode(value) {
  const status = String(value || '').trim().toLowerCase();
  if (!status || status === 'active') return 'active';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

function paintMemberRow(sheet, row, status) {
  const color = MEMBER_STATUS_COLORS[memberStatusCode(status)];
  const width = Math.min(11, sheet.getMaxColumns());
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
  const sheet = getDataSheet(ss, ARTICLES_SHEET, ['id', 'memberId', 'memberName', 'title', 'category', 'body', 'excerpt', 'read', 'createdAt']);
  ensureArticleDeleteColumns(sheet);
  return sheet;
}

/* ==========================================================================
   حسابات الأعضاء: البريد الإلكتروني + الرمز السري
   ========================================================================== */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
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
    'status', 'createdAt', 'lastLogin', 'resetCode', 'resetExpires'
  ]);
  if (sheet.getMaxColumns() < 11) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns());
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
    status: String(values[6] || 'active')
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

function sendCodeEmail(email, name, code, subject, intro) {
  MailApp.sendEmail({
    to: email,
    subject,
    htmlBody: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#1E3A2B">
      <h2 style="margin:0 0 12px">مساحة أعضاء جليس</h2>
      <p>مرحبًا ${name}،</p>
      <p>${intro}</p>
      <p style="font-size:32px;letter-spacing:10px;font-weight:bold;color:#8C532D">${code}</p>
      <p>الرمز صالح لمدة ١٥ دقيقة. إذا لم تطلبه فتجاهل هذه الرسالة.</p>
    </div>`
  });
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

function libraryBookSheets(ss) {
  return [ss.getSheetByName(BOOKS_SHEET), ss.getSheetById(OLD_BOOKS_SHEET_ID)]
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

    if (action === 'saveClubBook') {
      const sheet = ss.getSheetByName(BOOKS_SHEET);
      if (!sheet) throw new Error('لم أجد تبويب المكتبة');
      ensureBookDeleteColumns(sheet);

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
        data.createdAt || Date.now(), data.coverImage || '',
        '', '', data.year || ''
      ]);
      return output({ success: true, message: 'تم حفظ الكتاب' });
    }

    if (action === 'updateClubBook') {
      const bookId = String(data.id || '');
      if (!bookId) throw new Error('معرّف الكتاب مطلوب');
      if (String(data.coverImage || '').length > 48000) {
        throw new Error('حجم صورة الغلاف أكبر من الحد المسموح');
      }

      const oldSheet = ss.getSheetById(OLD_BOOKS_SHEET_ID);
      const sources = [ss.getSheetByName(BOOKS_SHEET), oldSheet]
        .filter((source, index, list) => source && list.indexOf(source) === index);

      for (const source of sources) {
        const lastRow = source.getLastRow();
        if (lastRow < 2) continue;
        const ids = source.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        const matchIndex = ids.findIndex((row, index) => bookIdForRow(source, row[0], index) === bookId);
        if (matchIndex < 0) continue;

        const row = matchIndex + 2;
        ensureBookDeleteColumns(source);
        source.getRange(row, 4, 1, 6).setValues([[
          data.title || '', data.author || '', data.category || '',
          data.coverColor || '', data.report || '', Number(data.pages) || 0
        ]]);
        source.getRange(row, 11).setValue(data.coverImage || '');
        source.getRange(row, 14).setValue(data.year || '');
        return output({ success: true, message: 'تم تحديث بيانات الكتاب' });
      }

      throw new Error('لم أجد الكتاب المطلوب في المكتبة');
    }

    if (action === 'deleteClubBook' || action === 'restoreClubBook') {
      const bookId = String(data.id || '');
      if (!bookId) throw new Error('معرّف الكتاب مطلوب');
      const deleting = action === 'deleteClubBook';
      const sources = [ss.getSheetByName(BOOKS_SHEET), ss.getSheetById(OLD_BOOKS_SHEET_ID)]
        .filter((source, index, list) => source && list.indexOf(source) === index);

      for (const source of sources) {
        ensureBookDeleteColumns(source);
        const lastRow = source.getLastRow();
        if (lastRow < 2) continue;
        const ids = source.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        const matchIndex = ids.findIndex((row, index) => bookIdForRow(source, row[0], index) === bookId);
        if (matchIndex < 0) continue;
        const row = matchIndex + 2;
        source.getRange(row, 12, 1, 2).setValues([deleting ? [Date.now(), data.deletedBy || 'مشرف'] : ['', '']]);
        paintDeletedRow(source, row, deleting, 14);
        return output({ success: true, message: deleting ? 'نُقل الكتاب إلى سلة المحذوفات' : 'تمت استعادة الكتاب' });
      }
      throw new Error('لم أجد الكتاب المطلوب');
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
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
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
          status: status,
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
      return output({ success: true, status: status });
    }

    if (action === 'getApprovedMembers') {
      const sheet = getMembersSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      const members = [];
      rows.forEach((row) => {
        if (!String(row[0] || '').trim()) return;
        if (memberStatusCode(row[6]) !== 'active') return;
        members.push({
          name: String(row[1] || '').trim(),
          role: String(row[5] || 'member'),
          joinedAt: row[7]
        });
      });
      return output({ success: true, data: members });
    }

    if (action === 'requestRegistrationCode') {
      const sheet = getMembersSheet(ss);
      const name = String(data.name || '').replace(/\s+/g, ' ').trim();
      const email = normalizeEmail(data.email);
      const password = String(data.password || '');

      if (name.split(' ').filter(Boolean).length < 3) {
        throw new Error('اكتب الاسم الثلاثي كما هو في الهوية');
      }
      if (!EMAIL_PATTERN.test(email)) throw new Error('صيغة البريد الإلكتروني غير صحيحة');
      if (password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`الرمز يجب أن يكون ${PASSWORD_MIN_LENGTH} أحرف أو أكثر`);
      }
      if (findMemberRow(sheet, email) > 0) {
        throw new Error('هذا البريد مسجل مسبقًا، جرّب الدخول أو استعادة الرمز');
      }

      const previous = readPendingRegistration(email);
      if (previous && previous.sentAt && Date.now() - Number(previous.sentAt) < 60000) {
        throw new Error('انتظر دقيقة قبل طلب رمز جديد');
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeSalt = Utilities.getUuid();
      const passwordSalt = Utilities.getUuid();
      savePendingRegistration({
        name,
        email,
        passwordHash: hashPassword(password, passwordSalt),
        passwordSalt,
        codeHash: hashPassword(code, codeSalt),
        codeSalt,
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
        throw new Error('تعذر إرسال البريد، حاول مرة أخرى بعد قليل');
      }

      return output({ success: true, message: 'أرسلنا رمز التحقق إلى بريدك' });
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
        'pending', Date.now(), Date.now(), '', ''
      ]);
      paintMemberRow(sheet, sheet.getLastRow(), 'pending');
      clearPendingRegistration(email);
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

      const values = sheet.getRange(row, 1, 1, 11).getValues()[0];
      const status = memberStatusCode(values[6]);
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

    if (action === 'deleteQuote' || action === 'restoreQuote') {
      const sheet = ss.getSheetByName(QUOTES_SHEET);
      if (!sheet) throw new Error('لم أجد تبويب الاقتباسات');
      ensureQuoteDeleteColumns(sheet);
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
    const sheet = ss.getSheetByName(QUOTES_SHEET);
    if (!sheet) throw new Error('لم أجد تبويب الاقتباسات');

    ensureQuoteDeleteColumns(sheet);
    sheet.appendRow([
      data.created_at || new Date().toLocaleString('ar-SA'),
      data.author_name || '',
      data.page_number || data.page_numbe || '',
      data.book_title || '',
      data.quote_text || '',
      data.id || `q-${Date.now()}`,
      '', ''
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

    if (action === 'getPendingMembers') {
      const sheet = getMembersSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return output({ success: true, data: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
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
          status: status,
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
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      const members = [];
      rows.forEach((row) => {
        if (!String(row[0] || '').trim()) return;
        if (memberStatusCode(row[6]) !== 'active') return;
        members.push({
          name: String(row[1] || '').trim(),
          role: String(row[5] || 'member'),
          joinedAt: row[7]
        });
      });
      return output({ success: true, data: members });
    }

    if (action === 'getLibraryCategories') {
      return output({ success: true, data: getLibraryCategoryNames(ss) });
    }

    if (action === 'getClubBooks') {
      const sources = [
        ss.getSheetById(OLD_BOOKS_SHEET_ID),
        ss.getSheetByName(BOOKS_SHEET)
      ].filter((sheet, index, list) => sheet && list.indexOf(sheet) === index);

      const booksById = {};
      const deletedIds = new Set();
      sources.forEach(sheet => {
        ensureBookDeleteColumns(sheet);
        const rows = sheet.getDataRange().getValues();
        rows.slice(1).forEach((row, index) => {
          if (!row[3]) return;
          const id = String(row[0] || `legacy-${sheet.getSheetId()}-${index + 2}`);
          if (row[11]) { deletedIds.add(id); return; }
          booksById[id] = {
            id, memberId: row[1], memberName: row[2], title: row[3],
            author: row[4], category: row[5], coverColor: row[6],
            report: row[7], pages: row[8], createdAt: row[9],
            coverImage: row[10] || '', year: row[13] || ''
          };
        });
      });
      return output({ success: true, data: Object.values(booksById), deletedIds: [...deletedIds] });
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
      if (lastRow < 2) return output({ success: true, data: [], deletedIds: [] });
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
      return output({ success: true, data: articles, deletedIds: deletedIds });
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
      if (lastRow < 2) return output({ success: true, data: [], deletedIds: [] });
      const rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
      const recordings = [];
      const deletedIds = [];
      rows.forEach(row => {
        if (!row[0]) return;
        if (row[11]) { deletedIds.push(String(row[0])); return; }
        recordings.push({
          id: row[0], title: row[1], description: row[2], recordedAt: row[3],
          speaker: row[4], views: Number(row[5]) || 0, duration: row[6],
          videoUrl: row[7], image: row[8], createdAt: row[9], createdBy: row[10]
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

      [ss.getSheetByName(BOOKS_SHEET), ss.getSheetById(OLD_BOOKS_SHEET_ID)]
        .filter((sheet, index, list) => sheet && list.indexOf(sheet) === index)
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
    const sheet = ss.getSheetByName(QUOTES_SHEET);
    if (!sheet) throw new Error('لم أجد تبويب الاقتباسات');
    ensureQuoteDeleteColumns(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return output({ success: true, status: 'success', data: [], deletedIds: [], deletedTexts: [] });
    const rows = sheet.getRange(1, 1, lastRow, 8).getValues();
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
          quote_text: rows[i][4]
        });
      }
    }
    return output({ success: true, status: 'success', data: quotes, deletedIds: deletedIds, deletedTexts: deletedTexts });
  } catch (error) {
    return output({ success: false, status: 'error', error: error.toString() });
  }
}

/* ==========================================================================
   دالة تجهيز تُشغَّل يدويًا مرة واحدة من محرر Apps Script (Run)
   تنشئ أعمدة الحذف وسنة النشر، وتُعيد تلوين الصفوف المحذوفة بالأحمر.
   ========================================================================== */
function setupJaleesSheets() {
  const ss = SpreadsheetApp.openById('1s_7SIePvvoBHcZSlqNqtNH9g6IIOCcr7GIKf7hC-46g');
  const report = [];

  const books = ss.getSheetByName(BOOKS_SHEET);
  if (books) {
    ensureBookDeleteColumns(books);
    books.getRange(1, 11, 1, 4).setValues([['coverImage', 'deletedAt', 'deletedBy', 'year']]);
    repaintDeletedRows(books, 12, 14);
    report.push(`${BOOKS_SHEET}: ${books.getMaxColumns()} عمود`);
  }

  const articles = getArticlesSheet(ss);
  articles.getRange(1, 10, 1, 2).setValues([['deletedAt', 'deletedBy']]);
  repaintDeletedRows(articles, 10, 11);
  report.push(`${ARTICLES_SHEET}: ${articles.getMaxColumns()} عمود`);

  const quotes = ss.getSheetByName(QUOTES_SHEET);
  if (quotes) {
    ensureQuoteDeleteColumns(quotes);
    repaintDeletedRows(quotes, 7, 8);
    report.push(`${QUOTES_SHEET}: ${quotes.getMaxColumns()} عمود`);
  }

  const recorded = getRecordedMeetingsSheet(ss);
  repaintDeletedRows(recorded, 12, 13);
  report.push(`${RECORDED_MEETINGS_SHEET}: ${recorded.getMaxColumns()} عمود`);

  const categories = getLibraryCategoriesSheet(ss);
  repaintDeletedRows(categories, 2, 4);
  report.push(`${LIBRARY_CATEGORIES_SHEET}: ${categories.getMaxColumns()} عمود`);

  const members = getMembersSheet(ss);
  report.push(`${MEMBERS_SHEET}: ${members.getMaxColumns()} عمود`);

  const joinRequests = getJoinRequestsSheet(ss);
  ensureJoinRequestStatuses(joinRequests);
  report.push(`${JOIN_REQUESTS_SHEET}: ${joinRequests.getMaxColumns()} عمود`);

  SpreadsheetApp.flush();
  return report.join(' | ');
}

function repaintDeletedRows(sheet, deleteColumn, width) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const flags = sheet.getRange(2, deleteColumn, lastRow - 1, 1).getValues();
  flags.forEach((row, index) => paintDeletedRow(sheet, index + 2, Boolean(row[0]), width));
}
