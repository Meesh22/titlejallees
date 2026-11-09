const QUOTES_SHEET = 'ط§ظ„ط§ظ‚طھط¨ط§ط³ط§طھ';
const CODE_VERSION = 'jalees-2026-11-09-r8';
const BOOKS_SHEET = 'ط§ظ„ظ…ظƒطھط¨ط©';
const ARTICLES_SHEET = 'ط§ظ„ظ…ظ‚ط§ظ„ط§طھ';
const BOOK_RATINGS_SHEET = 'طھظ‚ظٹظٹظ…ط§طھ ط§ظ„ظƒطھط¨';
const LIBRARY_CATEGORIES_SHEET = 'طھطµظ†ظٹظپط§طھ ط§ظ„ظ…ظƒطھط¨ط©';
const JOIN_REQUESTS_SHEET = 'ط·ظ„ط¨ط§طھ ط§ظ„ط§ظ†ط¶ظ…ط§ظ…';
const MEETINGS_SHEET = 'ط§ظ„ظ„ظ‚ط§ط،ط§طھ';
const RECORDED_MEETINGS_SHEET = 'ط§ظ„ظ„ظ‚ط§ط،ط§طھ ط§ظ„ظ…ط³ط¬ظ„ط©';
const READING_TIPS_SHEET = 'ظ†ط§ظپط°ط© ظ‚ط±ط§ط¦ظٹط©';
const PROFILES_SHEET = 'ط§ظ„ظ…ظ„ظپط§طھ ط§ظ„ط´ط®طµظٹط©';
const ENTRIES_SHEET = 'ط³ط¬ظ„ط§طھ ط§ظ„ظ‚ط±ط§ط،ط©';

const SPREADSHEET_ID = '1s_7SIePvvoBHcZSlqNqtNH9g6IIOCcr7GIKf7hC-46g';

/* ط­ظ…ط§ظٹط© ط´ط§ظ…ظ„ط©: ط£ظٹ ط¯ط§ظ„ط© ظˆط±ظ‚ط© طھط¹ظ…ظ„ ط­طھظ‰ ظ„ظˆ ظ„ظ… ظٹظڈظ…ط±ظژظ‘ط± ظ„ظ‡ط§ ss */
function resolveSpreadsheet(ss) {
  if (ss && typeof ss.getSheetByName === 'function') return ss;
  return SpreadsheetApp.openById(SPREADSHEET_ID);
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
const MEMBERS_SHEET = 'ط§ظ„ط£ط¹ط¶ط§ط،';
const CONSULTATIONS_SHEET = 'ط§ط³طھط´ط§ط±ط§طھ ط§ظ„ط£ط¹ط¶ط§ط،';
const OLD_BOOKS_SHEET_ID = 1035156833;
const SUPERVISOR_NAMES = ['ظ…ط´ط¹ظ„ ط¹ط¨ط¯ط§ظ„ط±ط­ظ…ظ† ط§ظ„ط­ظپظٹط±', 'ظ…ط´ط¹ظ„ ط§ظ„ط­ظپظٹط±', 'ظ…ط­ظ…ط¯ طµط§ظ„ط­ ط§ظ„ط¯ط¨ظٹط®ظٹ', 'ظ…ط­ظ…ط¯ ط§ظ„ط¯ط¨ظٹط®ظٹ'];
// طھظڈط¶ط§ظپ ط£ط³ظ…ط§ط، ط§ظ„ظ…ط³طھط´ط§ط±ظٹظ† ط§ظ„ظ…ط¹طھظ…ط¯ظٹظ† ظ‡ظ†ط§ ط¨ط¹ط¯ ط§ط³طھظ„ط§ظ…ظ‡ط§ط› ظ„ط§ ظٹظڈط³ظ…ط­ ط¨ط§ظ„ط¥ط¬ط§ط¨ط© ظ‚ط¨ظ„ ط§ط¹طھظ…ط§ط¯ ط§ظ„ط§ط³ظ….
const CONSULTANT_NAMES = [];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_ROUNDS = 10000;
const DEFAULT_LIBRARY_CATEGORIES = [
  'ط£ط¯ط¨', 'ط¥ط¯ط§ط±ط©', 'ط§ظ‚طھطµط§ط¯', 'ط£ط³ط±ط© ظˆط·ظپظˆظ„ط©', 'طھط§ط±ظٹط®', 'طھط§ط±ظٹط® ط¥ط³ظ„ط§ظ…ظٹ', 'طھط§ط±ظٹط® ط³ط¹ظˆط¯ظٹ',
  'طھط±ط¨ظٹط©', 'طھظ†ظ…ظٹط© ط°ط§طھظٹط©', 'طھط±ط§ط¬ظ…', 'طھظ‚ظ†ظٹط©', 'طھط¹ظ„ظٹظ…', 'طھظپط³ظٹط± ظˆط¹ظ„ظˆظ… ط§ظ„ظ‚ط±ط¢ظ†', 'ط«ظ‚ط§ظپط© ط¹ط§ظ…ط©',
  'ط¬ط؛ط±ط§ظپظٹط§ ظˆط±ط­ظ„ط§طھ', 'ط­ط¯ظٹط« ظˆط³ظٹط±ط© ظ†ط¨ظˆظٹط©', 'ط­ظƒط§ظٹط§طھ ط´ط¹ط¨ظٹط©', 'ط±ظˆط§ظٹط©', 'ط±ظˆط§ظٹط© طھط§ط±ظٹط®ظٹط©',
  'ط±ظٹط§ط¶ط©', 'ط³ظٹط±ط©', 'ط³ظٹط±ط© ط°ط§طھظٹط©', 'ط´ط¹ط±', 'طµط­ط©', 'ط¹ظ„ظ… ط§ط¬طھظ…ط§ط¹', 'ط¹ظ„ظ… ظ†ظپط³', 'ط¹ظ„ظˆظ…',
  'ظپظƒط±', 'ظپظƒط± ظˆظپظ„ط³ظپط©', 'ظپظ† ظˆظ…ط³ط±ط­', 'ظ‚طµط© ظ‚طµظٹط±ط©', 'ظ‚طµطµ ط£ط·ظپط§ظ„', 'ظ„ط؛ط© ط¹ط±ط¨ظٹط©', 'ظ…ط°ظƒط±ط§طھ',
  'ظ…ظ‚ط§ظ„ط§طھ', 'ظپظ†ظˆظ†', 'ظپظ‚ظ‡', 'طھط·ظˆظٹط±', 'طھط¬ط§ط±ط¨', 'ط£ط®ط±ظ‰'
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
    try { range.setBackground(null); } catch (error) { /* طھط¬ط§ظ‡ظ„ */ }
    try { range.setFontColor(null); } catch (error) { /* طھط¬ط§ظ‡ظ„ */ }
  }
}

/* ---- ط·ظ„ط¨ط§طھ ط§ظ„ط§ظ†ط¶ظ…ط§ظ…: ط­ط§ظ„ط© ط§ظ„ط·ظ„ط¨ ظˆظ„ظˆظ† ط§ظ„طµظپ ---- */
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

/* ---- ط­ط³ط§ط¨ط§طھ ط§ظ„ط£ط¹ط¶ط§ط،: ط­ط§ظ„ط© ط§ظ„ط­ط³ط§ط¨ ظˆظ„ظˆظ† ط§ظ„طµظپ ---- */
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
   ط­ط³ط§ط¨ط§طھ ط§ظ„ط£ط¹ط¶ط§ط،: ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ + ط§ظ„ط±ظ…ط² ط§ظ„ط³ط±ظٹ
   ========================================================================== */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '')
    .replace(/[ظ -ظ©]/g, digit => String('ظ ظ،ظ¢ظ£ظ¤ظ¥ظ¦ظ§ظ¨ظ©'.indexOf(digit)))
    .replace(/[غ°-غ¹]/g, digit => String('غ°غ±غ²غ³غ´غµغ¶غ·غ¸غ¹'.indexOf(digit)))
    .replace(/[\s().-]/g, '');
}

function normalizePersonName(value) {
  return String(value || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[ط£ط¥ط¢ظ±]/g, 'ط§')
    .replace(/ظ‰/g, 'ظٹ')
    .replace(/ط©/g, 'ظ‡')
    .replace(/\s+/g, '')
    .trim();
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
  } catch (error) { /* طھط¬ط§ظ‡ظ„ */ }
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
  // ط¹ظ…ظˆط¯ ظ†ظˆط¹ ط§ظ„ط¹ط¶ظˆظٹط©: 14 = memberType (ط¹ط¶ظˆ / طµط¯ظٹظ‚) â€” ط¹ظ…ظˆط¯ ظ…ظ†ظپطµظ„ ط¹ظ† ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±
  if (sheet.getMaxColumns() < 14) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 14 - sheet.getMaxColumns());
  }
  const typeHeader = String(sheet.getRange(1, 14).getValue() || '').trim();
  if (!typeHeader) sheet.getRange(1, 14).setValue('memberType');
  return sheet;
}

function getMyBooksSheet(ss) {
  return getDataSheet(ss, 'ظ…ظƒطھط¨ط§طھ ط§ظ„ط£ط¹ط¶ط§ط،', ['memberId', 'memberName', 'bookId', 'status', 'currentPage', 'addedAt']);
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

/* ---- ط·ظ„ط¨ط§طھ ط§ظ„طھط³ط¬ظٹظ„ ط§ظ„ظ…ظ†طھط¸ط±ط© ظ„طھط£ظƒظٹط¯ ط§ظ„ط¨ط±ظٹط¯ ---- */
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
      <h2 style="margin:0 0 12px">ظ…ط³ط§ط­ط© ط£ط¹ط¶ط§ط، ط¬ظ„ظٹط³</h2>
      <p>ظ…ط±ط­ط¨ظ‹ط§ ${name}طŒ</p>
      <p>${intro}</p>
      <p style="font-size:32px;letter-spacing:10px;font-weight:bold;color:#8C532D">${code}</p>
      <p>ط§ظ„ط±ظ…ط² طµط§ظ„ط­ ظ„ظ…ط¯ط© ظ،ظ¥ ط¯ظ‚ظٹظ‚ط©. ط¥ط°ط§ ظ„ظ… طھط·ظ„ط¨ظ‡ ظپطھط¬ط§ظ‡ظ„ ظ‡ط°ظ‡ ط§ظ„ط±ط³ط§ظ„ط©.</p>
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
      if (!sheet) throw new Error('ظ„ظ… ط£ط¬ط¯ طھط¨ظˆظٹط¨ ط§ظ„ظ…ظƒطھط¨ط©');
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
          return output({ success: true, message: 'ط§ظ„ظƒطھط§ط¨ ظ…ظˆط¬ظˆط¯ ظ…ط³ط¨ظ‚ظ‹ط§' });
        }
      }

      sheet.appendRow([
        data.id || '', data.memberId || '', data.memberName || '',
        data.title || '', data.author || '', data.category || '',
        data.coverColor || '', data.report || '', data.pages || 0,
        data.createdAt || Date.now(), data.coverImage || '',
        '', '', data.year || ''
      ]);
      return output({ success: true, message: 'طھظ… ط­ظپط¸ ط§ظ„ظƒطھط§ط¨' });
    }

    if (action === 'updateClubBook') {
      const bookId = String(data.id || '');
      if (!bookId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„ظƒطھط§ط¨ ظ…ط·ظ„ظˆط¨');
      if (String(data.coverImage || '').length > 48000) {
        throw new Error('ط­ط¬ظ… طµظˆط±ط© ط§ظ„ط؛ظ„ط§ظپ ط£ظƒط¨ط± ظ…ظ† ط§ظ„ط­ط¯ ط§ظ„ظ…ط³ظ…ظˆط­');
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
        return output({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط¨ظٹط§ظ†ط§طھ ط§ظ„ظƒطھط§ط¨' });
      }

      throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ظƒطھط§ط¨ ط§ظ„ظ…ط·ظ„ظˆط¨ ظپظٹ ط§ظ„ظ…ظƒطھط¨ط©');
    }

    if (action === 'deleteClubBook' || action === 'restoreClubBook') {
      const bookId = String(data.id || '');
      if (!bookId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„ظƒطھط§ط¨ ظ…ط·ظ„ظˆط¨');
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
        source.getRange(row, 12, 1, 2).setValues([deleting ? [Date.now(), data.deletedBy || 'ظ…ط´ط±ظپ'] : ['', '']]);
        paintDeletedRow(source, row, deleting, 14);
        return output({ success: true, message: deleting ? 'ظ†ظڈظ‚ظ„ ط§ظ„ظƒطھط§ط¨ ط¥ظ„ظ‰ ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆظپط§طھ' : 'طھظ…طھ ط§ط³طھط¹ط§ط¯ط© ط§ظ„ظƒطھط§ط¨' });
      }
      throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ظƒطھط§ط¨ ط§ظ„ظ…ط·ظ„ظˆط¨');
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
      return output({ success: true, message: 'طھظ… ط­ظپط¸ ط·ظ„ط¨ ط§ظ„ط§ظ†ط¶ظ…ط§ظ…' });
    }

    if (action === 'setJoinRequestStatus') {
      const sheet = getJoinRequestsSheet(ss);
      const row = Number(data.row);
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('ظ„ظ… ط£ط¬ط¯ ط·ظ„ط¨ ط§ظ„ط§ظ†ط¶ظ…ط§ظ…');
      const status = normalizeJoinStatus(data.status);
      sheet.getRange(row, 5, 1, 3).setValues([[
        status,
        status === 'pending' ? '' : Date.now(),
        status === 'pending' ? '' : (data.by || 'ظ…ط´ط±ظپ')
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
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ط­ط³ط§ط¨');
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
        } catch (e) { /* طھط¬ط§ظ‡ظ„ */ }
      }
      return output({ success: true, status: status, memberType: data.memberType || '' });
    }

    if (action === 'setConsultantStatus') {
      const sheet = getMembersSheet(ss);
      const row = Number(data.row);
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ط­ط³ط§ط¨');
      const isConsultant = (String(data.isConsultant) === 'true' || data.isConsultant === true);
      sheet.getRange(row, 6).setValue(isConsultant ? 'consultant' : 'member');
      return output({ success: true, role: isConsultant ? 'consultant' : 'member', message: isConsultant ? 'طھظ… طھط±ظ‚ظٹط© ط§ظ„ط¹ط¶ظˆ ط¥ظ„ظ‰ ظ…ط³طھط´ط§ط±' : 'طھظ… ط¥ظ„ط؛ط§ط، طھط±ظ‚ظٹط© ط§ظ„ظ…ط³طھط´ط§ط±' });
    }

    if (action === 'setMemberType') {
      const sheet = getMembersSheet(ss);
      const row = Number(data.row);
      if (!row || row < 2 || row > sheet.getLastRow()) throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ط­ط³ط§ط¨');
      const memberType = String(data.memberType || 'member').trim();
      // ط§ظ„ط¹ظ…ظˆط¯ 14 = memberType (ظ„ط§ ظٹظ…ط³ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±)
      sheet.getRange(row, 14).setValue(memberType);
      return output({ success: true, memberType: memberType, message: 'طھظ… طھط­ط¯ظٹط« ظ†ظˆط¹ ط§ظ„ط¹ط¶ظˆظٹط©' });
    }

    if (action === 'saveProfile') {
      const memberId = String(data.memberId || '').trim();
      if (!memberId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„ط¹ط¶ظˆ ظ…ط·ظ„ظˆط¨');
      const sheet = getProfilesSheet(ss);
      const lastRow = sheet.getLastRow();
      const rowData = [
        memberId, data.name || '', data.role || 'member', data.joined || 'ظ¢ظ ظ¢ظ¤',
        Number(data.goal) || 200, Number(data.lastWeekPages) || 0,
        data.notifications === false ? 'false' : 'true'
      ];
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        const index = ids.findIndex((row) => String(row[0] || '') === memberId);
        if (index >= 0) {
          sheet.getRange(index + 2, 1, 1, rowData.length).setValues([rowData]);
          return output({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ' });
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'طھظ… ط­ظپط¸ ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ' });
    }

    if (action === 'saveEntry') {
      const sheet = getEntriesSheet(ss);
      const memberId = String(data.memberId || '').trim();
      if (!memberId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„ط¹ط¶ظˆ ظ…ط·ظ„ظˆط¨');
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
          return output({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط³ط¬ظ„ ط§ظ„ظ‚ط±ط§ط،ط©' });
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'طھظ… ط­ظپط¸ ط³ط¬ظ„ ط§ظ„ظ‚ط±ط§ط،ط©' });
    }

    if (action === 'saveMyBook') {
      const sheet = getMyBooksSheet(ss);
      const memberId = String(data.memberId || '').trim();
      const bookId = String(data.bookId || '').trim();
      if (!memberId || !bookId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„ط¹ط¶ظˆ ظˆط§ظ„ظƒطھط§ط¨ ظ…ط·ظ„ظˆط¨ط§ظ†');
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const keys = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (let i = 0; i < keys.length; i++) {
          if (String(keys[i][0]) === memberId && String(keys[i][2]) === bookId) {
            sheet.getRange(i + 2, 4).setValue(String(data.status || 'reading'));
            sheet.getRange(i + 2, 5).setValue(Number(data.currentPage) || 0);
            return output({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ظ…ظƒطھط¨طھظٹ' });
          }
        }
      }
      sheet.appendRow([memberId, data.memberName || '', bookId, String(data.status || 'reading'), Number(data.currentPage) || 0, data.createdAt || Date.now()]);
      return output({ success: true, message: 'طھظ… ط­ظپط¸ ط§ظ„ظƒطھط§ط¨ ظپظٹ ظ…ظƒطھط¨طھظٹ' });
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
            return output({ success: true, message: 'طھظ…طھ ط§ظ„ط¥ط²ط§ظ„ط© ظ…ظ† ظ…ظƒطھط¨طھظٹ' });
          }
        }
      }
      return output({ success: true, message: 'ط§ظ„ظƒطھط§ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ ظپظٹ ظ…ظƒطھط¨طھظٹ' });
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

    if (action === 'saveReadingTip') {
      const sheet = getReadingTipsSheet(ss);
      const tipId = String(data.id || `tip-${Date.now()}`);
      if (String(data.image || '').length > 48000) throw new Error('ط­ط¬ظ… ط§ظ„طµظˆط±ط© ط£ظƒط¨ط± ظ…ظ† ط§ظ„ط­ط¯ ط§ظ„ظ…ط³ظ…ظˆط­');
      const rowData = [
        tipId, data.title || '', data.body || '', data.image || '',
        data.createdAt || Date.now(), data.createdBy || '', '', ''
      ];
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === tipId) {
            sheet.getRange(i + 2, 1, 1, rowData.length).setValues([rowData]);
            return output({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„ظ†طµظٹط­ط©' });
          }
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, id: tipId, message: 'طھظ… ط­ظپط¸ ط§ظ„ظ†طµظٹط­ط©' });
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
            return output({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„ظ†طµظٹط­ط©' });
          }
        }
      }
      return output({ success: false, message: 'ظ„ظ… ط£ط¬ط¯ ط§ظ„ظ†طµظٹط­ط©' });
    }

    if (action === 'setMemberPhoto') {
      const memberId = String(data.memberId || '').trim();
      const photo = String(data.photo || '');
      if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(photo)) {
        throw new Error('ط§ط®طھط± طµظˆط±ط© ط¨طµظٹط؛ط© JPG ط£ظˆ PNG ط£ظˆ WebP');
      }
      if (photo.length > 48000) throw new Error('ط§ظ„طµظˆط±ط© ط£ظƒط¨ط± ظ…ظ† ط§ظ„ط­ط¯ ط§ظ„ظ…ط³ظ…ظˆط­ط› ط§ط®طھط± طµظˆط±ط© ط£طµط؛ط±');
      const sheet = getMembersSheet(ss);
      const row = findMemberRowById(sheet, memberId);
      if (row < 2) throw new Error('ظ„ظ… ط£ط¬ط¯ ط­ط³ط§ط¨ ط§ظ„ط¹ط¶ظˆ');
      const member = sheet.getRange(row, 1, 1, 13).getValues()[0];
      if (memberStatusCode(member[6]) !== 'active') throw new Error('ط§ظ„ط­ط³ط§ط¨ ط؛ظٹط± ظ…ط¹طھظ…ط¯');
      sheet.getRange(row, 13).setValue(photo);
      return output({ success: true, photo: photo, message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„طµظˆط±ط© ط§ظ„ط´ط®طµظٹط©' });
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
      if (question.length < 8) throw new Error('ط§ظƒطھط¨ ط³ط¤ط§ظ„ظƒ ط¨طھظپطµظٹظ„ ط£ظƒط¨ط±');
      if (question.length > 2000) throw new Error('ط§ظ„ط³ط¤ط§ظ„ ط£ط·ظˆظ„ ظ…ظ† ط§ظ„ط­ط¯ ط§ظ„ظ…ط³ظ…ظˆط­');
      const membersSheet = getMembersSheet(ss);
      const memberRow = findMemberRowById(membersSheet, memberId);
      if (memberRow < 2) throw new Error('ط³ط¬ظ‘ظ„ ط§ظ„ط¯ط®ظˆظ„ ظƒط¹ط¶ظˆ ظ„ط·ط±ط­ ط§ط³طھط´ط§ط±ط©');
      const member = membersSheet.getRange(memberRow, 1, 1, 12).getValues()[0];
      if (memberStatusCode(member[6]) !== 'active') throw new Error('ط§ظ„ط­ط³ط§ط¨ ط؛ظٹط± ظ…ط¹طھظ…ط¯');
      const id = `consult-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
      const sheet = getConsultationsSheet(ss);
      sheet.appendRow([id, memberId, String(member[1] || ''), question, Date.now(), '', '', '', '']);
      return output({ success: true, id: id, message: 'طھظ… ط¥ط±ط³ط§ظ„ ط§ط³طھط´ط§ط±طھظƒ ظ„ظ„ظ…ط³طھط´ط§ط±ظٹظ†' });
    }

    if (action === 'answerConsultation') {
      const memberId = String(data.memberId || '').trim();
      const consultationId = String(data.id || '').trim();
      const answer = String(data.answer || '').trim();
      if (!consultationId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„ط§ط³طھط´ط§ط±ط© ظ…ط·ظ„ظˆط¨');
      if (answer.length < 2) throw new Error('ط§ظƒطھط¨ ط§ظ„ط¥ط¬ط§ط¨ط©');
      if (answer.length > 4000) throw new Error('ط§ظ„ط¥ط¬ط§ط¨ط© ط£ط·ظˆظ„ ظ…ظ† ط§ظ„ط­ط¯ ط§ظ„ظ…ط³ظ…ظˆط­');
      const membersSheet = getMembersSheet(ss);
      const memberRow = findMemberRowById(membersSheet, memberId);
      if (memberRow < 2) throw new Error('ط³ط¬ظ‘ظ„ ط§ظ„ط¯ط®ظˆظ„ ط¨ط­ط³ط§ط¨ ط§ظ„ظ…ط³طھط´ط§ط±');
      const member = membersSheet.getRange(memberRow, 1, 1, 12).getValues()[0];
      const advisorName = String(member[1] || '').trim();
      if (memberStatusCode(member[6]) !== 'active' || !isConsultantName(advisorName)) {
        throw new Error('ط§ظ„ط¥ط¬ط§ط¨ط© ظ…طھط§ط­ط© ظ„ظ„ظ…ط³طھط´ط§ط±ظٹظ† ط§ظ„ظ…ط¹طھظ…ط¯ظٹظ† ظپظ‚ط·');
      }
      const sheet = getConsultationsSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ط§ط³طھط´ط§ط±ط©');
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      const index = ids.findIndex(row => String(row[0] || '') === consultationId);
      if (index < 0) throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ط§ط³طھط´ط§ط±ط©');
      const row = index + 2;
      sheet.getRange(row, 6, 1, 4).setValues([[answer, memberId, advisorName, Date.now()]]);
      return output({ success: true, message: 'طھظ… ظ†ط´ط± ط§ظ„ط¥ط¬ط§ط¨ط©' });
    }

    if (action === 'requestRegistrationCode') {
      const sheet = getMembersSheet(ss);
      const name = String(data.name || '').replace(/\s+/g, ' ').trim();
      const phone = normalizePhone(data.phone);
      const email = normalizeEmail(data.email);
      const password = String(data.password || '');

      if (name.split(' ').filter(Boolean).length < 3) {
        throw new Error('ط§ظƒطھط¨ ط§ظ„ط§ط³ظ… ط§ظ„ط«ظ„ط§ط«ظٹ ظƒظ…ط§ ظ‡ظˆ ظپظٹ ط§ظ„ظ‡ظˆظٹط©');
      }
      if (!/^\+?\d{8,15}$/.test(phone)) {
        throw new Error('ط£ط¯ط®ظ„ ط±ظ‚ظ… ط¬ظˆط§ظ„ طµط­ظٹط­ظ‹ط§');
      }
      if (!EMAIL_PATTERN.test(email)) throw new Error('طµظٹط؛ط© ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ط؛ظٹط± طµط­ظٹط­ط©');
      if (password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`ط§ظ„ط±ظ…ط² ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ${PASSWORD_MIN_LENGTH} ط£ط­ط±ظپ ط£ظˆ ط£ظƒط«ط±`);
      }
      if (findMemberRow(sheet, email) > 0) {
        throw new Error('ظ‡ط°ط§ ط§ظ„ط¨ط±ظٹط¯ ظ…ط³ط¬ظ„ ظ…ط³ط¨ظ‚ظ‹ط§طŒ ط¬ط±ظ‘ط¨ ط§ظ„ط¯ط®ظˆظ„ ط£ظˆ ط§ط³طھط¹ط§ط¯ط© ط§ظ„ط±ظ…ط²');
      }

      const previous = readPendingRegistration(email);
      if (previous && previous.sentAt && Date.now() - Number(previous.sentAt) < 60000) {
        throw new Error('ط§ظ†طھط¸ط± ط¯ظ‚ظٹظ‚ط© ظ‚ط¨ظ„ ط·ظ„ط¨ ط±ظ…ط² ط¬ط¯ظٹط¯');
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
        expiry: Date.now() + 15 * 60 * 1000,
        sentAt: Date.now(),
        attempts: 0
      });

      try {
        sendCodeEmail(
          email, name, code,
          'ط¬ظ„ظٹط³ | ط±ظ…ط² طھط£ظƒظٹط¯ ط¨ط±ظٹط¯ظƒ',
          'ط±ظ…ط² طھط£ظƒظٹط¯ ط¨ط±ظٹط¯ظƒ ظ„ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ظƒ ظپظٹ ط¬ظ„ظٹط³ ظ‡ظˆ:'
        );
      } catch (mailError) {
        clearPendingRegistration(email);
        throw new Error('طھط¹ط°ط± ط¥ط±ط³ط§ظ„ ط§ظ„ط¨ط±ظٹط¯طŒ ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰ ط¨ط¹ط¯ ظ‚ظ„ظٹظ„');
      }

      return output({ success: true, message: 'ط£ط±ط³ظ„ظ†ط§ ط±ظ…ط² ط§ظ„طھط­ظ‚ظ‚ ط¥ظ„ظ‰ ط¨ط±ظٹط¯ظƒ' });
    }

    if (action === 'verifyRegistrationCode') {
      const sheet = getMembersSheet(ss);
      const email = normalizeEmail(data.email);
      const code = String(data.code || '').trim();

      if (!/^\d{6}$/.test(code)) throw new Error('ط±ظ…ط² ط§ظ„طھط­ظ‚ظ‚ ط³طھط© ط£ط±ظ‚ط§ظ…');

      const record = readPendingRegistration(email);
      if (!record) throw new Error('ظ„ط§ ظٹظˆط¬ط¯ ط·ظ„ط¨ طھط³ط¬ظٹظ„ ظ„ظ‡ط°ط§ ط§ظ„ط¨ط±ظٹط¯طŒ ط£ط¹ط¯ ط§ظ„طھط³ط¬ظٹظ„');

      if (!record.expiry || Date.now() > Number(record.expiry)) {
        clearPendingRegistration(email);
        throw new Error('ط§ظ†طھظ‡طھ طµظ„ط§ط­ظٹط© ط§ظ„ط±ظ…ط²طŒ ط£ط¹ط¯ ط§ظ„طھط³ط¬ظٹظ„ ظ„ط·ظ„ط¨ ط±ظ…ط² ط¬ط¯ظٹط¯');
      }
      if (findMemberRow(sheet, email) > 0) {
        clearPendingRegistration(email);
        throw new Error('ظ‡ط°ط§ ط§ظ„ط¨ط±ظٹط¯ ظ…ط³ط¬ظ„ ظ…ط³ط¨ظ‚ظ‹ط§طŒ ظٹظ…ظƒظ†ظƒ ط§ظ„ط¯ط®ظˆظ„ ط§ظ„ط¢ظ†');
      }
      if (!verifyPassword(code, record.codeSalt, record.codeHash)) {
        record.attempts = (Number(record.attempts) || 0) + 1;
        if (record.attempts >= 6) {
          clearPendingRegistration(email);
          throw new Error('طھط¬ط§ظˆط²طھ ط¹ط¯ط¯ ط§ظ„ظ…ط­ط§ظˆظ„ط§طھطŒ ط£ط¹ط¯ ط§ظ„طھط³ط¬ظٹظ„ ظ„ط·ظ„ط¨ ط±ظ…ط² ط¬ط¯ظٹط¯');
        }
        savePendingRegistration(record);
        throw new Error('ط±ظ…ط² ط§ظ„طھط­ظ‚ظ‚ ط؛ظٹط± طµط­ظٹط­');
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
      return output({
        success: true,
        status: 'pending',
        message: 'طھظ… طھط£ظƒظٹط¯ ط¨ط±ظٹط¯ظƒطŒ ظˆط­ط³ط§ط¨ظƒ ط¨ط§ظ†طھط¸ط§ط± ظ…ظˆط§ظپظ‚ط© ط§ظ„ط¥ط¯ط§ط±ط©'
      });
    }

    if (action === 'registerMember') {
      throw new Error('ط­ط¯ظ‘ط«ظ†ط§ ظ†ط¸ط§ظ… ط§ظ„طھط³ط¬ظٹظ„طŒ ط£ط¹ط¯ طھط­ظ…ظٹظ„ ط§ظ„طµظپط­ط© ط«ظ… ط£ظ†ط´ط¦ ط§ظ„ط­ط³ط§ط¨ ظ…ظ† ط¬ط¯ظٹط¯');
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
          throw new Error('ط£ط¯ط®ظ„ ط§ظ„ط§ط³ظ… ط§ظ„ط«ظ„ط§ط«ظٹ ط£ظˆ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ');
        }
        const nameRows = findMemberRowsByName(sheet, identifier);
        if (nameRows.length > 1) {
          throw new Error('ظٹظˆط¬ط¯ ط£ظƒط«ط± ظ…ظ† ط¹ط¶ظˆ ط¨ظ‡ط°ط§ ط§ظ„ط§ط³ظ…طŒ ط§ط³طھط®ط¯ظ… ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ظ„ظ„ط¯ط®ظˆظ„');
        }
        if (nameRows.length === 1) row = nameRows[0];
      }
      if (row < 0) throw new Error('ط§ظ„ط§ط³ظ… ط£ظˆ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ط£ظˆ ط§ظ„ط±ظ…ط² ط؛ظٹط± طµط­ظٹط­');

      const values = sheet.getRange(row, 1, 1, 13).getValues()[0];
      const status = memberStatusCode(values[6]);
      if (status === 'rejected') throw new Error('طھظ… ط±ظپط¶ ط·ظ„ط¨ ط­ط³ط§ط¨ظƒطŒ طھظˆط§طµظ„ ظ…ط¹ ط¥ط¯ط§ط±ط© ط§ظ„ظ†ط§ط¯ظٹ');
      if (status !== 'active') throw new Error('ط­ط³ط§ط¨ظƒ ط¨ط§ظ†طھط¸ط§ط± ظ…ظˆط§ظپظ‚ط© ط§ظ„ظ…ط´ط±ظپ');

      const expected = String(values[3] || '');
      const salt = String(values[4] || '');
      if (!verifyPassword(password, salt, expected)) {
        throw new Error('ط§ظ„ط§ط³ظ… ط£ظˆ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ط£ظˆ ط§ظ„ط±ظ…ط² ط؛ظٹط± طµط­ظٹط­');
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
        const name = String(sheet.getRange(row, 2).getValue() || 'ط¹ط¶ظˆ ط¬ظ„ظٹط³');
        sheet.getRange(row, 10, 1, 2).setValues([[
          JSON.stringify({ hash: hashPassword(code, codeSalt), salt: codeSalt }),
          expiry
        ]]);
        try {
          sendCodeEmail(
            email, name, code,
            'ط¬ظ„ظٹط³ | ط±ظ…ط² ط§ط³طھط¹ط§ط¯ط© ط§ظ„ط±ظ…ط² ط§ظ„ط³ط±ظٹ',
            'ط±ظ…ط² ط§ط³طھط¹ط§ط¯ط© ط§ظ„ط±ظ…ط² ط§ظ„ط³ط±ظٹ ط§ظ„ط®ط§طµ ط¨ظƒ ظ‡ظˆ:'
          );
        } catch (mailError) {
          console.error('MailApp error:', mailError);
        }
      }
      return output({ success: true, message: 'ط¥ظ† ظƒط§ظ† ط§ظ„ط¨ط±ظٹط¯ ظ…ط³ط¬ظ„ظ‹ط§ ظپط³ظٹطµظ„ظƒ ط±ظ…ط² ط§ظ„ط§ط³طھط¹ط§ط¯ط© ط®ظ„ط§ظ„ ظ„ط­ط¸ط§طھ' });
    }

    if (action === 'resetPassword') {
      const sheet = getMembersSheet(ss);
      const email = normalizeEmail(data.email);
      const code = String(data.code || '').trim();
      const password = String(data.password || '');
      if (password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`ط§ظ„ط±ظ…ط² ط§ظ„ط¬ط¯ظٹط¯ ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ${PASSWORD_MIN_LENGTH} ط£ط­ط±ظپ ط£ظˆ ط£ظƒط«ط±`);
      }
      const row = findMemberRow(sheet, email);
      if (row < 0) throw new Error('ط±ظ…ط² ط§ظ„طھط­ظ‚ظ‚ ط؛ظٹط± طµط­ظٹط­ ط£ظˆ ظ…ظ†طھظ‡ظٹ ط§ظ„طµظ„ط§ط­ظٹط©');

      const stored = String(sheet.getRange(row, 10).getValue() || '');
      const expiry = Number(sheet.getRange(row, 11).getValue()) || 0;
      if (!stored || !expiry || Date.now() > expiry) {
        throw new Error('ط§ظ†طھظ‡طھ طµظ„ط§ط­ظٹط© ط§ظ„ط±ظ…ط²طŒ ط§ط·ظ„ط¨ ط±ظ…ط²ظ‹ط§ ط¬ط¯ظٹط¯ظ‹ط§');
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
      if (!valid) throw new Error('ط±ظ…ط² ط§ظ„طھط­ظ‚ظ‚ ط؛ظٹط± طµط­ظٹط­');

      const salt = Utilities.getUuid();
      sheet.getRange(row, 4, 1, 2).setValues([[hashPassword(password, salt), salt]]);
      sheet.getRange(row, 10, 1, 2).setValues([['', '']]);
      return output({ success: true, message: 'طھظ… طھط¹ظٹظٹظ† ط§ظ„ط±ظ…ط² ط§ظ„ط¬ط¯ظٹط¯طŒ ظٹظ…ظƒظ†ظƒ ط§ظ„ط¯ط®ظˆظ„ ط§ظ„ط¢ظ†' });
    }

    if (action === 'addLibraryCategory') {
      const category = String(data.category || '').trim();
      if (!category) throw new Error('ط§ط³ظ… ط§ظ„طھطµظ†ظٹظپ ظ…ط·ظ„ظˆط¨');
      const existing = getLibraryCategoryNames(ss);
      if (existing.some(name => normalizeTabName(name) === normalizeTabName(category))) {
        return output({ success: true, message: 'ط§ظ„طھطµظ†ظٹظپ ظ…ظˆط¬ظˆط¯ ظ…ط³ط¨ظ‚ظ‹ط§', categories: existing });
      }
      getLibraryCategoriesSheet(ss).appendRow([category]);
      return output({ success: true, message: 'طھظ…طھ ط¥ط¶ط§ظپط© ط§ظ„طھطµظ†ظٹظپ', categories: getLibraryCategoryNames(ss) });
    }

    if (action === 'renameLibraryCategory') {
      const oldCategory = String(data.oldCategory || '').trim();
      const category = String(data.category || '').trim();
      if (!oldCategory || !category) throw new Error('ط§ط³ظ… ط§ظ„طھطµظ†ظٹظپ ط§ظ„ط¬ط¯ظٹط¯ ظ…ط·ظ„ظˆط¨');
      const current = getLibraryCategoryNames(ss);
      if (!current.some(name => normalizeTabName(name) === normalizeTabName(oldCategory))) {
        throw new Error('ط§ظ„طھطµظ†ظٹظپ ط§ظ„ط£طµظ„ظٹ ط؛ظٹط± ظ…ظˆط¬ظˆط¯');
      }
      if (current.some(name => normalizeTabName(name) === normalizeTabName(category)
        && normalizeTabName(name) !== normalizeTabName(oldCategory))) {
        throw new Error('ظٹظˆط¬ط¯ طھطµظ†ظٹظپ ط¢ط®ط± ط¨ظ‡ط°ط§ ط§ظ„ط§ط³ظ…');
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
      return output({ success: true, message: 'طھظ… طھط¹ط¯ظٹظ„ ط§ط³ظ… ط§ظ„طھطµظ†ظٹظپ', booksUpdated, categories: getLibraryCategoryNames(ss) });
    }

    if (action === 'deleteLibraryCategory' || action === 'restoreLibraryCategory') {
      const category = String(data.id || data.category || '').trim();
      if (!category) throw new Error('ط§ط³ظ… ط§ظ„ط±ظپ ظ…ط·ظ„ظˆط¨');
      const sheet = getLibraryCategoriesSheet(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) throw new Error('ظ„ط§ طھظˆط¬ط¯ ط±ظپظˆظپ ظ„ط¥ط¯ط§ط±طھظ‡ط§');
      const rows = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
      const restoring = action === 'restoreLibraryCategory';
      const rowIndex = rows.findIndex(row => normalizeTabName(row[0]) === normalizeTabName(category)
        && (restoring ? Boolean(row[1]) : !row[1]));
      if (rowIndex < 0) throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ط±ظپ ط§ظ„ظ…ط·ظ„ظˆط¨');
      const sheetRow = rowIndex + 2;

      if (action === 'deleteLibraryCategory') {
        if (rows[rowIndex][1]) return output({ success: true, message: 'ط§ظ„ط±ظپ ظ…ظˆط¬ظˆط¯ ط¨ط§ظ„ظپط¹ظ„ ظپظٹ ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆظپط§طھ' });
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
              row[0] = 'ط؛ظٹط± ظ…طµظ†ظپ';
              changed = true;
            }
          });
          if (changed) bookSheet.getRange(2, 6, lastBookRow - 1, 1).setValues(categories);
        });

        sheet.getRange(sheetRow, 2, 1, 3).setValues([[Date.now(), data.deletedBy || 'ظ…ط´ط±ظپ', JSON.stringify(snapshotIds)]]);
        paintDeletedRow(sheet, sheetRow, true, 4);
        if (!getLibraryCategoryNames(ss).some(name => normalizeTabName(name) === normalizeTabName('ط؛ظٹط± ظ…طµظ†ظپ'))) {
          sheet.appendRow(['ط؛ظٹط± ظ…طµظ†ظپ', '', '', '']);
        }
        return output({ success: true, message: 'ظ†ظڈظ‚ظ„ ط§ظ„ط±ظپ ط¥ظ„ظ‰ ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆظپط§طھطŒ ظˆط­ظڈظپط¸طھ ظƒطھط¨ظ‡ ظپظٹ ط؛ظٹط± ظ…طµظ†ظپ', movedBooks: snapshotIds.length });
      }

      if (!rows[rowIndex][1]) return output({ success: true, message: 'ط§ظ„ط±ظپ ط؛ظٹط± ظ…ط­ط°ظˆظپ' });
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
      return output({ success: true, message: 'طھظ…طھ ط§ط³طھط¹ط§ط¯ط© ط§ظ„ط±ظپ ظˆظƒطھط¨ظ‡', restoredBooks: snapshotIds.length });
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
              // طھط­ط¯ظٹط« طµظپ ظ…ظˆط¬ظˆط¯
              sheet.getRange(i + 2, 2).setValue(data.memberId || '');
              sheet.getRange(i + 2, 3).setValue(data.memberName || '');
              sheet.getRange(i + 2, 4).setValue(data.title || '');
              sheet.getRange(i + 2, 5).setValue(data.category || '');
              sheet.getRange(i + 2, 6).setValue(data.body || '');
              sheet.getRange(i + 2, 7).setValue(data.excerpt || '');
              sheet.getRange(i + 2, 8).setValue(data.read || 0);
              sheet.getRange(i + 2, 9).setValue(data.createdAt || Date.now());
              return output({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„ظ…ظ‚ط§ظ„' });
            }
          }
        }
      }

      sheet.appendRow([
        data.id || '', data.memberId || '', data.memberName || '',
        data.title || '', data.category || '', data.body || '',
        data.excerpt || '', data.read || 0, data.createdAt || Date.now()
      ]);
      return output({ success: true, message: 'طھظ… ط­ظپط¸ ط§ظ„ظ…ظ‚ط§ظ„' });
    }

    if (action === 'saveBookRating') {
      const sheet = getBookRatingsSheet(ss);
      const bookId = String(data.bookId || '');
      const memberId = String(data.memberId || '');
      const ratingValue = Number(data.rating);
      if (!bookId || !memberId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„ظƒطھط§ط¨ ظˆط§ظ„ط¹ط¶ظˆ ظ…ط·ظ„ظˆط¨ط§ظ† ظ„ظ„طھظ‚ظٹظٹظ…');
      if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        throw new Error('ط§ظ„طھظ‚ظٹظٹظ… ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ظ…ظ† ظ†ط¬ظ…ط© ط¥ظ„ظ‰ ط®ظ…ط³ ظ†ط¬ظˆظ…');
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
            return output({ success: true, message: 'طھظ… طھط­ط¯ظٹط« طھظ‚ظٹظٹظ… ط§ظ„ظƒطھط§ط¨' });
          }
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'طھظ… ط­ظپط¸ طھظ‚ظٹظٹظ… ط§ظ„ظƒطھط§ط¨' });
    }

    if (action === 'saveMeeting') {
      const sheet = getMeetingsSheet(ss);
      const meetingId = String(data.id || '');
      if (!meetingId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„ظ„ظ‚ط§ط، ظ…ط·ظ„ظˆط¨');
      if (String(data.image || '').length > 48000) {
        throw new Error('ط­ط¬ظ… طµظˆط±ط© ط§ظ„ظ„ظ‚ط§ط، ط£ظƒط¨ط± ظ…ظ† ط§ظ„ط­ط¯ ط§ظ„ظ…ط³ظ…ظˆط­');
      }

      const rowData = [
        meetingId, data.title || '', data.description || '', String(data.date || ''),
        String(data.time || ''), data.location || '', data.image || '',
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
            return output({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„ظ„ظ‚ط§ط،' });
          }
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'طھظ… ط­ظپط¸ ط§ظ„ظ„ظ‚ط§ط،' });
    }

    if (action === 'saveRecordedMeeting') {
      const sheet = getRecordedMeetingsSheet(ss);
      const recordId = String(data.id || '');
      if (!recordId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„طھط³ط¬ظٹظ„ ظ…ط·ظ„ظˆط¨');
      if (String(data.image || '').length > 48000) throw new Error('ط­ط¬ظ… طµظˆط±ط© ط§ظ„ظ„ظ‚ط§ط، ط£ظƒط¨ط± ظ…ظ† ط§ظ„ط­ط¯ ط§ظ„ظ…ط³ظ…ظˆط­');

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
            return output({ success: true, message: 'طھظ… طھط­ط¯ظٹط« ط§ظ„طھط³ط¬ظٹظ„' });
          }
        }
      }
      sheet.appendRow(rowData);
      return output({ success: true, message: 'طھظ… ط­ظپط¸ ط§ظ„طھط³ط¬ظٹظ„' });
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
            sheet.getRange(row, 12, 1, 2).setValues([deleting ? [Date.now(), data.deletedBy || 'ظ…ط´ط±ظپ'] : ['', '']]);
            paintDeletedRow(sheet, row, deleting, 13);
            return output({ success: true, message: deleting ? 'ظ†ظڈظ‚ظ„ ط§ظ„ظ„ظ‚ط§ط، ط§ظ„ظ…ط³ط¬ظ„ ط¥ظ„ظ‰ ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆظپط§طھ' : 'طھظ…طھ ط§ط³طھط¹ط§ط¯ط© ط§ظ„ظ„ظ‚ط§ط، ط§ظ„ظ…ط³ط¬ظ„' });
          }
        }
      }
      if (!deleting) throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ظ„ظ‚ط§ط، ط§ظ„ظ…ط³ط¬ظ„');
      return output({ success: true, message: 'ط§ظ„طھط³ط¬ظٹظ„ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
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
            return output({ success: true, message: 'طھظ… ط­ط°ظپ ط§ظ„ظ„ظ‚ط§ط،' });
          }
        }
      }
      return output({ success: true, message: 'ط§ظ„ظ„ظ‚ط§ط، ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
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
            sheet.getRange(row, 10, 1, 2).setValues([deleting ? [Date.now(), data.deletedBy || 'ظ…ط´ط±ظپ'] : ['', '']]);
            paintDeletedRow(sheet, row, deleting, 11);
            return output({ success: true, message: deleting ? 'ظ†ظڈظ‚ظ„ ط§ظ„ظ…ظ‚ط§ظ„ ط¥ظ„ظ‰ ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆظپط§طھ' : 'طھظ…طھ ط§ط³طھط¹ط§ط¯ط© ط§ظ„ظ…ظ‚ط§ظ„' });
          }
        }
      }
      if (!deleting) throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ظ…ظ‚ط§ظ„ ط§ظ„ظ…ط·ظ„ظˆط¨');
      /* ظ…ظ‚ط§ظ„ ظ…ط­ظ„ظٹ/ظ‚ط¯ظٹظ… ط؛ظٹط± ظ…ظˆط¬ظˆط¯ ظپظٹ ط§ظ„ط´ظٹطھ: ظ†ط­ظپط¸ ظ†ط³ط®ط© ظ‚ط§ط¨ظ„ط© ظ„ظ„ط§ط³طھط¹ط§ط¯ط© ط¨ط¯ظ„ ظپظ‚ط¯ط§ظ†ظ‡. */
      if (data.title) {
        sheet.appendRow([
          articleId, data.memberId || '', data.memberName || '', data.title || '',
          data.category || '', data.body || '', data.excerpt || '', Number(data.read) || 3,
          data.createdAt || Date.now(), Date.now(), data.deletedBy || 'ظ…ط´ط±ظپ'
        ]);
        paintDeletedRow(sheet, sheet.getLastRow(), true, 11);
        return output({ success: true, message: 'ظ†ظڈظ‚ظ„ ط§ظ„ظ…ظ‚ط§ظ„ ط¥ظ„ظ‰ ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆظپط§طھ' });
      }
      return output({ success: true, message: 'ط§ظ„ظ…ظ‚ط§ظ„ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
    }

    if (action === 'deleteQuote' || action === 'restoreQuote') {
      const sheet = ss.getSheetByName(QUOTES_SHEET);
      if (!sheet) throw new Error('ظ„ظ… ط£ط¬ط¯ طھط¨ظˆظٹط¨ ط§ظ„ط§ظ‚طھط¨ط§ط³ط§طھ');
      ensureQuoteDeleteColumns(sheet);
      const quoteId = String(data.id || '');
      if (!quoteId) throw new Error('ظ…ط¹ط±ظ‘ظپ ط§ظ„ط§ظ‚طھط¨ط§ط³ ظ…ط·ظ„ظˆط¨');
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
          data.text, quoteId, Date.now(), data.deletedBy || 'ظ…ط´ط±ظپ'
        ]);
        paintDeletedRow(sheet, sheet.getLastRow(), true, 8);
        return output({ success: true, message: 'ظ†ظڈظ‚ظ„ ط§ظ„ط§ظ‚طھط¨ط§ط³ ط¥ظ„ظ‰ ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆظپط§طھ' });
      }
      if (!rowNumber) throw new Error('ظ„ظ… ط£ط¬ط¯ ط§ظ„ط§ظ‚طھط¨ط§ط³ ط§ظ„ظ…ط·ظ„ظˆط¨');

      if (deleting) {
        sheet.getRange(rowNumber, 6).setValue(quoteId);
        sheet.getRange(rowNumber, 7, 1, 2).setValues([[Date.now(), data.deletedBy || 'ظ…ط´ط±ظپ']]);
        paintDeletedRow(sheet, rowNumber, true, 8);
        return output({ success: true, message: 'ظ†ظڈظ‚ظ„ ط§ظ„ط§ظ‚طھط¨ط§ط³ ط¥ظ„ظ‰ ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆظپط§طھ' });
      }
      sheet.getRange(rowNumber, 7, 1, 2).setValues([['', '']]);
      paintDeletedRow(sheet, rowNumber, false, 8);
      return output({ success: true, message: 'طھظ…طھ ط§ط³طھط¹ط§ط¯ط© ط§ظ„ط§ظ‚طھط¨ط§ط³' });
    }

    // ط­ظپط¸ ط§ظ„ط§ظ‚طھط¨ط§ط³ (fallback)
    if (action && action !== 'saveQuote' && action !== 'addQuote' && action !== 'saveSharedQuote') {
      throw new Error(`ط¥ط¬ط±ط§ط، ط؛ظٹط± ظ…ط¹ط±ظˆظپ: ${action}`);
    }
    const sheet = ss.getSheetByName(QUOTES_SHEET);
    if (!sheet) throw new Error('ظ„ظ… ط£ط¬ط¯ طھط¨ظˆظٹط¨ ط§ظ„ط§ظ‚طھط¨ط§ط³ط§طھ');

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
    return output({ status: 'success', message: 'طھظ… ط­ظپط¸ ط§ظ„ط§ظ‚طھط¨ط§ط³' });
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
      if (row < 2) throw new Error('ظ„ظ… ط£ط¬ط¯ ط­ط³ط§ط¨ ط§ظ„ط¹ط¶ظˆ');
      const member = membersSheet.getRange(row, 1, 1, 13).getValues()[0];
      if (memberStatusCode(member[6]) !== 'active') throw new Error('ط§ظ„ط­ط³ط§ط¨ ط؛ظٹط± ظ…ط¹طھظ…ط¯');
      return output({
        success: true,
        member: { id: String(member[0] || ''), name: String(member[1] || ''), photo: String(member[12] || '') }
      });
    }

    if (action === 'getVersion') {
      return output({ success: true, version: CODE_VERSION, deployed: true });
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
          joined: String(found[3] || 'ظ¢ظ ظ¢ظ¤'),
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
        memberName: String(row[2] || ''),
        question: String(row[3] || ''),
        askedAt: row[4],
        answer: String(row[5] || ''),
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
      const sources = [
        ss.getSheetById(OLD_BOOKS_SHEET_ID),
        ss.getSheetByName(BOOKS_SHEET)
      ].filter((sheet, index, list) => sheet && list.indexOf(sheet) === index);

      const booksById = {};
      const deletedIds = new Set();
      sources.forEach(sheet => {
        ensureBookDeleteColumns(sheet);
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return;
        const rows = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
        rows.forEach((row, index) => {
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
              type: 'book', id: bookIdForRow(sheet, row[0], index), title: row[3] || 'ظƒطھط§ط¨',
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
            type: 'article', id: String(row[0]), title: row[3] || 'ظ…ظ‚ط§ظ„',
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
            type: 'recording', id: String(row[0]), title: row[1] || 'ظ„ظ‚ط§ط، ظ…ط³ط¬ظ„',
            category: row[4] || '', deletedAt: row[11], deletedBy: row[12] || ''
          });
        });
      }

      deleted.sort((a, b) => (Number(b.deletedAt) || 0) - (Number(a.deletedAt) || 0));
      return output({ success: true, data: deleted });
    }

    // ظ‚ط±ط§ط،ط© ط§ظ„ط§ظ‚طھط¨ط§ط³ط§طھ
    const sheet = ss.getSheetByName(QUOTES_SHEET);
    if (!sheet) throw new Error('ظ„ظ… ط£ط¬ط¯ طھط¨ظˆظٹط¨ ط§ظ„ط§ظ‚طھط¨ط§ط³ط§طھ');
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
   ط¯ط§ظ„ط© طھط¬ظ‡ظٹط² طھظڈط´ط؛ظژظ‘ظ„ ظٹط¯ظˆظٹظ‹ط§ ظ…ط±ط© ظˆط§ط­ط¯ط© ظ…ظ† ظ…ط­ط±ط± Apps Script (Run)
   طھظ†ط´ط¦ ط£ط¹ظ…ط¯ط© ط§ظ„ط­ط°ظپ ظˆط³ظ†ط© ط§ظ„ظ†ط´ط±طŒ ظˆطھظڈط¹ظٹط¯ طھظ„ظˆظٹظ† ط§ظ„طµظپظˆظپ ط§ظ„ظ…ط­ط°ظˆظپط© ط¨ط§ظ„ط£ط­ظ…ط±.
   ========================================================================== */
function setupJaleesSheets() {
  const ss = SpreadsheetApp.openById('1s_7SIePvvoBHcZSlqNqtNH9g6IIOCcr7GIKf7hC-46g');
  const report = [];
  /* ظƒظ„ ط®ط·ظˆط© ط¯ط§ط®ظ„ try/catch ط­طھظ‰ ظ„ط§ ظٹظˆظ‚ظپ ط®ط·ط£ ظˆط§ط­ط¯ ë‚کë¨¸ط­ ط§ظ„ط¥ط¹ط¯ط§ط¯ */
  const step = (label, fn) => {
    try {
      const value = fn();
      report.push(label + (value === undefined || value === null ? '' : ': ' + value));
    } catch (error) {
      report.push(label + ': ظپط´ظ„ - ' + (error && error.message ? error.message : String(error)));
    }
  };

  step(BOOKS_SHEET, () => {
    const books = ss.getSheetByName(BOOKS_SHEET);
    if (!books) return 'ط؛ظٹط± ظ…ظˆط¬ظˆط¯';
    ensureBookDeleteColumns(books);
    books.getRange(1, 11, 1, 4).setValues([['coverImage', 'deletedAt', 'deletedBy', 'year']]);
    repaintDeletedRows(books, 12, 14);
    return books.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(ARTICLES_SHEET, () => {
    const articles = getArticlesSheet(ss);
    articles.getRange(1, 10, 1, 2).setValues([['deletedAt', 'deletedBy']]);
    repaintDeletedRows(articles, 10, 11);
    return articles.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(QUOTES_SHEET, () => {
    const quotes = ss.getSheetByName(QUOTES_SHEET);
    if (!quotes) return 'ط؛ظٹط± ظ…ظˆط¬ظˆط¯';
    ensureQuoteDeleteColumns(quotes);
    repaintDeletedRows(quotes, 7, 8);
    return quotes.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(MEETINGS_SHEET, () => {
    const meetings = getMeetingsSheet(ss);
    return meetings.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(RECORDED_MEETINGS_SHEET, () => {
    const recorded = getRecordedMeetingsSheet(ss);
    repaintDeletedRows(recorded, 12, 13);
    return recorded.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(LIBRARY_CATEGORIES_SHEET, () => {
    const categories = getLibraryCategoriesSheet(ss);
    repaintDeletedRows(categories, 2, 4);
    return categories.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(MEMBERS_SHEET, () => {
    const members = getMembersSheet(ss);
    const repaired = repairMemberPasswordColumn(members);
    return members.getMaxColumns() + ' ط¹ظ…ظˆط¯' + (repaired ? ' آ· ط¥طµظ„ط§ط­ ' + repaired + ' ط­ط³ط§ط¨' : '');
  });

  step('ظ…ظƒطھط¨ط§طھ ط§ظ„ط£ط¹ط¶ط§ط،', () => {
    const myBooks = getMyBooksSheet(ss);
    return myBooks.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(PROFILES_SHEET, () => {
    const profiles = getProfilesSheet(ss);
    return profiles.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(ENTRIES_SHEET, () => {
    const entries = getEntriesSheet(ss);
    return entries.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(CONSULTATIONS_SHEET, () => {
    const consultations = getConsultationsSheet(ss);
    return consultations.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(JOIN_REQUESTS_SHEET, () => {
    const joinRequests = getJoinRequestsSheet(ss);
    ensureJoinRequestStatuses(joinRequests);
    return joinRequests.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step(READING_TIPS_SHEET, () => {
    const tips = getReadingTipsSheet(ss);
    return tips.getMaxColumns() + ' ط¹ظ…ظˆط¯';
  });

  step('ط§ظ„ط­ظپط¸ ط§ظ„ظ†ظ‡ط§ط¦ظٹ', () => {
    SpreadsheetApp.flush();
    return 'طھظ…';
  });

  return report.join(' | ');
}

/* ط¥طµظ„ط§ط­ ط£ظٹ ط­ط³ط§ط¨ طھط¶ط±ط± ظ„ط£ظ† ظ†ظˆط¹ ط§ظ„ط¹ط¶ظˆظٹط© ظƒظڈطھط¨ ط¨ط§ظ„ط®ط·ط£ ظپظˆظ‚ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± */
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

