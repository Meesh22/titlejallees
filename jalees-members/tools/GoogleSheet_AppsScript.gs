/**
 * جليس | مجلس الأعضاء - كود Google Apps Script للشيت
 * صيغة ES5 متوافقة مع كل محركات Apps Script.
 *
 * الاستخدام:
 * 1) Extensions <- Apps Script، الصق الملف كاملاً واحفظ.
 * 2) شغّل setupSheet مرة واحدة، ثم أعد تحميل الشيت.
 * 3) أدخل البيانات في التبويبات الثلاثة.
 * 4) من قائمة "جليس | أدوات المحتوى": دفع إلى GitHub، أو تشغيل المزامنة التلقائية.
 */

'use strict';

/* ربط مشروع مستقل (من script.google.com) بالشيت عبر الرابط */
function setSheetIdFromUrl() {
  var url = Browser.inputBox('الصق رابط Google Sheet كاملاً', Browser.Buttons.OK_CANCEL);
  if (url === 'cancel' || !url) return false;
  var m = String(url).match(/[-\w]{25,}/);
  if (!m) {
    Browser.msgBox('الرابط غير صالح');
    return false;
  }
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', m[0]);
  Browser.msgBox('تم ربط الشيت');
  return true;
}

/* زر Run الافتراضي: يربط الشيت إن لزم، ثم يجهّزه بدون نافذة واجهة */
function myFunction() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SHEET_ID')) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      props.setProperty('SHEET_ID', ss.getId());
    } else if (!setSheetIdFromUrl()) {
      return;
    }
  }
  setupSheetCore_();
  Browser.msgBox('تم تجهيز الشيت ✅\nارجع للشيت واعمل تحديث الصفحة F5.');
}

var TAB_MEMBERS = 'الأعضاء';
var TAB_QUOTES = 'الاقتباسات';
var TAB_ARTICLES = 'المقالات';
var TAB_SUMMARIES = 'الملخصات';

var HEADERS = {};
HEADERS[TAB_MEMBERS] = ['id', 'اسم العضو'];
HEADERS[TAB_QUOTES] = ['العضو', 'الاقتباس', 'الكتاب / المصدر', 'التاريخ'];
HEADERS[TAB_ARTICLES] = ['العضو', 'عنوان المقال', 'مقتطف', 'التاريخ', 'الرابط'];
HEADERS[TAB_SUMMARIES] = ['العضو', 'الكتاب', 'المؤلف', 'الملخص', 'التاريخ'];

var ROSTER = [
  ['m1', 'محمد صالح السحيباني'],
  ['m2', 'إبراهيم الشويهي'],
  ['m3', 'إبراهيم سليمان النغيمشي'],
  ['m4', 'إبراهيم محمد السعيد'],
  ['m5', 'أبو أديب عبدالله السعوي'],
  ['m6', 'أحمد بن صالح التويجري'],
  ['m7', 'أحمد سليمان القصير'],
  ['m8', 'أحمد صالح الدبيخي'],
  ['m9', 'أحمد محمد الأكييزم'],
  ['m10', 'أحمد مدشر الظاهر'],
  ['m11', 'أسامة الربيع'],
  ['m12', 'إلياس عبدالعزيز العييري'],
  ['m13', 'بدر التويجري'],
  ['m14', 'بلال عبدالله أحمد الربيع'],
  ['m15', 'بندر صالح الغامدي'],
  ['m16', 'تركي عبدالرحمن العمران'],
  ['m17', 'حكيم فهد الصطامي'],
  ['m18', 'خالد بن عبدالرحمن الواصل'],
  ['m19', 'خلف سليمان التويجري'],
  ['m20', 'د. سلطان عمي'],
  ['m21', 'رائد بن علي الوسيدي'],
  ['m22', 'راكان خلف الحربي'],
  ['m23', 'سلطان بن خالد بن برغش'],
  ['m24', 'سلطان عبدالله النصيان'],
  ['m25', 'سليمان بن عبدالله العنقري'],
  ['m26', 'صالح جاسر الجاسر'],
  ['m27', 'عادل بن عبدالله الكبير'],
  ['m28', 'عبدالرحمن الجريش'],
  ['m29', 'عبدالرحمن السيف'],
  ['m30', 'عبدالرحمن بن أمين مجيد'],
  ['m31', 'عبدالرحمن سليمان الثنيان'],
  ['m32', 'عبدالرحمن سليمان العجلان'],
  ['m33', 'عبدالرحمن عمر الصعب'],
  ['m34', 'عبدالرحمن مفرح علي'],
  ['m35', 'عبدالرحيم قاعود'],
  ['m36', 'عبدالسلام بن محمد الجمعة'],
  ['m37', 'عبدالعزيز العقيل'],
  ['m38', 'عبدالعزيز بن إبراهيم الدوسري'],
  ['m39', 'عبدالعزيز خالد الهويمل'],
  ['m40', 'عبدالعزيز عبدالله الطويان'],
  ['m41', 'عبدالعزيز علي الوهيبي'],
  ['m42', 'عبدالله الحجيلان'],
  ['m43', 'عبدالله الزهراني'],
  ['m44', 'عبدالله الزويد'],
  ['m45', 'عبدالله بن محمد المنصور'],
  ['m46', 'عبدالله خليفة التويجري'],
  ['m47', 'عبدالله سليمان الرقيعي'],
  ['m48', 'عبدالله سليمان المحيميد'],
  ['m49', 'عبدالله صائغ العوفي'],
  ['m50', 'عبدالله عبدالعزيز الفهيد'],
  ['m51', 'عمر بن إبراهيم القريعان'],
  ['m52', 'عمر عبدالله الفايز'],
  ['m53', 'عمر علي الشعيبي'],
  ['m54', 'عمر مجري البقمي'],
  ['m55', 'فهد عبدالرحمن الفلاج'],
  ['m56', 'فهد عبدالمعين العوفي'],
  ['m57', 'ماجد فهد الغنيم'],
  ['m58', 'محمد العييري'],
  ['m59', 'محمد بن عبدالمحسن الضويان'],
  ['m60', 'محمد حمدان سهرابي'],
  ['m61', 'محمد صالح الدبيخي'],
  ['m62', 'محمد عبدالرحمن الدخيّل'],
  ['m63', 'محمد عبدالعزيز العمر'],
  ['m64', 'محمد فهد العجاجي'],
  ['m65', 'محمد ناصر العليان'],
  ['m66', 'مشعل عبدالرحمن الحفير'],
  ['m67', 'مهيب علي أحمد الغيثي'],
  ['m68', 'نعيم محمد الغضية'],
  ['m69', 'هشام بن أحمد الربيش'],
  ['m70', 'يحيى سليمان اليحيى']
];

/** يعمل من داخل الشيت أو من المؤقّت */
function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* تابع */ }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('شغّل الكود من داخل الشيت، أو نفّذ setupSheet أولاً.');
  return ss;
}

/* ====================== القائمة ====================== */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('جليس | أدوات المحتوى')
    .addItem('1) تجهيز الشيت (مرة واحدة)', 'setupSheet')
    .addItem('2) تصدير JSON (نسخة احتياطية)', 'exportBackupJson')
    .addItem('3) دفع إلى GitHub الآن', 'pushToGitHub')
    .addSeparator()
    .addItem('4) تشغيل المزامنة التلقائية', 'installAutoSync')
    .addItem('5) إيقاف المزامنة التلقائية', 'removeAutoSync')
    .addSeparator()
    .addItem('إعدادات GitHub', 'configureGitHub')
    .addToUi();
}

/* ====================== تجهيز الشيت ====================== */
function setupSheetCore_() {
  var ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());

  var members = ss.getSheetByName(TAB_MEMBERS);
  if (!members) members = ss.insertSheet(TAB_MEMBERS);
  members.clear();
  members.getRange(1, 1, 1, 2).setValues([HEADERS[TAB_MEMBERS]]);
  members.getRange(2, 1, ROSTER.length, 2).setValues(ROSTER);
  members.setFrozenRows(1);
  members.setColumnWidth(1, 90);
  members.setColumnWidth(2, 260);
  members.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#1E3A2B').setFontColor('#FFFFFF');

  var tabs = [TAB_QUOTES, TAB_ARTICLES, TAB_SUMMARIES];
  for (var i = 0; i < tabs.length; i++) {
    var name = tabs[i];
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    var headers = HEADERS[name];
    if (sh.getLastRow() < 2) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A2B').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 240);
    for (var c = 2; c <= headers.length; c++) {
      sh.setColumnWidth(c, c === 2 ? 420 : 180);
    }
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(members.getRange(2, 2, ROSTER.length, 1), true)
      .setAllowInvalid(false)
      .setHelpText('اختر اسم العضو من القائمة')
      .build();
    sh.getRange(2, 1, 1000, 1).setDataValidation(rule);
    for (var d = 0; d < headers.length; d++) {
      if (headers[d] === 'التاريخ') sh.getRange(2, d + 1, 1000, 1).setNumberFormat('@');
    }
  }

  ss.setActiveSheet(ss.getSheetByName(TAB_QUOTES));
}

function setupSheet() {
  setupSheetCore_();
  SpreadsheetApp.getUi().alert('تم تجهيز الشيت\nأدخل البيانات في التبويبات الثلاثة، ثم استخدم دفع إلى GitHub.');
}

/* ====================== قراءة البيانات ====================== */
function normalizeName_(value) {
  return String(value || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function buildMemberIndex_() {
  var map = {};
  for (var i = 0; i < ROSTER.length; i++) {
    map[normalizeName_(ROSTER[i][1])] = ROSTER[i][0];
  }
  return map;
}

function getMemberId_(value, map, errors, where) {
  var key = normalizeName_(value);
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  errors.push(where + ': اسم غير معروف «' + value + '»');
  return null;
}

function text_(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return String(value).trim();
}

function rows_(sheet, columns) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, columns).getValues();
}

function buildAllContent_() {
  var ss = ss_();
  var map = buildMemberIndex_();
  var errors = [];
  var data = {};
  var index = {};
  var j;

  for (j = 0; j < ROSTER.length; j++) {
    var id0 = ROSTER[j][0];
    data[id0] = { id: id0, quotes: [], articles: [], summaries: [] };
    index[id0] = { quotes: 0, articles: 0, summaries: 0 };
  }

  var qSheet = ss.getSheetByName(TAB_QUOTES);
  if (qSheet) {
    var qRows = rows_(qSheet, 4);
    var qc = {};
    for (j = 0; j < qRows.length; j++) {
      var qr = qRows[j];
      var qid = getMemberId_(qr[0], map, errors, 'الاقتباسات ص ' + (j + 2));
      var qtext = text_(qr[1]);
      if (!qid || !qtext) continue;
      qc[qid] = (qc[qid] || 0) + 1;
      data[qid].quotes.push({ id: 'q' + qc[qid], text: qtext, book: text_(qr[2]), date: text_(qr[3]) });
    }
  }

  var aSheet = ss.getSheetByName(TAB_ARTICLES);
  if (aSheet) {
    var aRows = rows_(aSheet, 5);
    var ac = {};
    for (j = 0; j < aRows.length; j++) {
      var ar = aRows[j];
      var aid = getMemberId_(ar[0], map, errors, 'المقالات ص ' + (j + 2));
      var atitle = text_(ar[1]);
      if (!aid || !atitle) continue;
      ac[aid] = (ac[aid] || 0) + 1;
      data[aid].articles.push({
        id: 'a' + ac[aid], title: atitle, excerpt: text_(ar[2]),
        date: text_(ar[3]), link: text_(ar[4])
      });
    }
  }

  var sSheet = ss.getSheetByName(TAB_SUMMARIES);
  if (sSheet) {
    var sRows = rows_(sSheet, 5);
    var sc = {};
    for (j = 0; j < sRows.length; j++) {
      var sr = sRows[j];
      var sid = getMemberId_(sr[0], map, errors, 'الملخصات ص ' + (j + 2));
      var stext = text_(sr[3]);
      if (!sid || !stext) continue;
      sc[sid] = (sc[sid] || 0) + 1;
      data[sid].summaries.push({
        id: 's' + sc[sid], book: text_(sr[1]), author: text_(sr[2]),
        text: stext, date: text_(sr[4])
      });
    }
  }

  if (errors.length) {
    var first = errors.slice(0, 15).join('\n');
    var more = errors.length > 15 ? '\n...و' + (errors.length - 15) + ' أخرى' : '';
    throw new Error('تصحّح الأسماء التالية أولاً:\n' + first + more);
  }

  for (j = 0; j < ROSTER.length; j++) {
    var mid = ROSTER[j][0];
    index[mid] = {
      quotes: data[mid].quotes.length,
      articles: data[mid].articles.length,
      summaries: data[mid].summaries.length
    };
  }

  return { data: data, index: index };
}

function buildFiles_() {
  var built = buildAllContent_();
  var files = [{ path: 'data/content/index.json', content: JSON.stringify(built.index, null, 2) }];
  for (var j = 0; j < ROSTER.length; j++) {
    var id = ROSTER[j][0];
    files.push({ path: 'data/content/' + id + '.json', content: JSON.stringify(built.data[id], null, 2) });
  }
  return files;
}

/* ====================== نسخة احتياطية ====================== */
function exportBackupJson() {
  var files = buildFiles_();
  var all = {};
  for (var i = 0; i < files.length; i++) all[files[i].path] = JSON.parse(files[i].content);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
  var file = DriveApp.createFile('jalees-content-' + stamp + '.json', JSON.stringify(all, null, 2), MimeType.PLAIN_TEXT);
  SpreadsheetApp.getUi().alert('تم التصدير\n' + file.getUrl() + '\n\nيمكن نسخ محتواه إلى مجلد data/content/ في المستودع.');
}

/* ====================== إعدادات GitHub ====================== */
function configureGitHub() {
  var props = PropertiesService.getScriptProperties();
  var ui = SpreadsheetApp.getUi();
  var owner = ui.prompt('مالك المستودع', 'مثال: Meshh22', ui.ButtonSet.OK_CANCEL);
  if (owner.getSelectedButton() !== ui.Button.OK) return;
  var repo = ui.prompt('اسم المستودع', 'مثال: jalees-tool', ui.ButtonSet.OK_CANCEL);
  if (repo.getSelectedButton() !== ui.Button.OK) return;
  var branch = ui.prompt('الفرع', 'main', ui.ButtonSet.OK_CANCEL);
  if (branch.getSelectedButton() !== ui.Button.OK) return;
  var token = ui.prompt('GitHub Personal Access Token', 'صلاحية repo، يُحفظ داخل هذا السكربت فقط.', ui.ButtonSet.OK_CANCEL);
  if (token.getSelectedButton() !== ui.Button.OK) return;

  props.setProperties({
    GITHUB_OWNER: owner.getResponseText().trim() || 'Meshh22',
    GITHUB_REPO: repo.getResponseText().trim() || 'jalees-tool',
    GITHUB_BRANCH: branch.getResponseText().trim() || 'main',
    GITHUB_TOKEN: token.getResponseText().trim()
  });
  ui.alert('تم حفظ الإعدادات');
}

function github_(method, path, payload) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('افتح إعدادات GitHub وأدخل الـ token أولاً.');
  var options = {
    method: method.toUpperCase(),
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  if (payload) options.payload = JSON.stringify(payload);
  var url = 'https://api.github.com/repos/' + props.getProperty('GITHUB_OWNER') + '/' +
    props.getProperty('GITHUB_REPO') + path;
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('GitHub API ' + code + ': ' + body.slice(0, 500));
  return body ? JSON.parse(body) : null;
}

/* ====================== الدفع والمزامنة ====================== */
function filesHash_(files) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(files), Utilities.Charset.UTF_8);
  var out = [];
  for (var i = 0; i < bytes.length; i++) {
    out.push(('0' + ((bytes[i] & 0xFF).toString(16))).slice(-2));
  }
  return out.join('');
}

function logSync_(status, count, note) {
  var ss = ss_();
  var sh = ss.getSheetByName('سجل المزامنة');
  if (!sh) {
    sh = ss.insertSheet('سجل المزامنة');
    sh.getRange(1, 1, 1, 4).setValues([['الوقت', 'الحالة', 'عدد الملفات', 'ملاحظة']]);
    sh.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1E3A2B').setFontColor('#FFFFFF');
    sh.setColumnWidth(3, 120);
    sh.setColumnWidth(4, 400);
  }
  sh.appendRow([new Date(), status, count, note || '']);
}

function doPush_(files) {
  var branch = PropertiesService.getScriptProperties().getProperty('GITHUB_BRANCH') || 'main';
  var ref = github_('get', '/git/ref/heads/' + encodeURIComponent(branch));
  var commit = github_('get', '/git/commits/' + ref.object.sha);
  var tree = [];
  for (var i = 0; i < files.length; i++) {
    var blob = github_('post', '/git/blobs', {
      content: Utilities.base64Encode(files[i].content, Utilities.Charset.UTF_8),
      encoding: 'base64'
    });
    tree.push({ path: files[i].path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  var newTree = github_('post', '/git/trees', { base_tree: commit.tree.sha, tree: tree });
  var newCommit = github_('post', '/git/commits', {
    message: 'مزامنة بيانات مكتبات الأعضاء من Google Sheet',
    tree: newTree.sha,
    parents: [ref.object.sha]
  });
  github_('patch', '/git/refs/heads/' + encodeURIComponent(branch), { sha: newCommit.sha, force: false });
  return files.length;
}

function pushToGitHub() {
  var files = buildFiles_();
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('تأكيد النشر', 'سيتم تحديث ' + files.length + ' ملفاً في data/content/ على GitHub.\nهل تريد المتابعة؟', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  try {
    var count = doPush_(files);
    PropertiesService.getScriptProperties().setProperty('LAST_SYNC_HASH', filesHash_(files));
    logSync_('تم', count, 'دفع يدوي');
    ui.alert('تم النشر\n' + count + ' ملفاً، انتظر دقيقة ثم افتح رابط Vercel.');
  } catch (err) {
    logSync_('فشل', files.length, String(err.message).slice(0, 300));
    ui.alert('تعذّر النشر\n' + err.message);
  }
}

function syncFromSheet() {
  try {
    var files = buildFiles_();
    var hash = filesHash_(files);
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('LAST_SYNC_HASH') === hash) return;
    var count = doPush_(files);
    props.setProperty('LAST_SYNC_HASH', hash);
    logSync_('تم', count, 'مزامنة تلقائية');
  } catch (err) {
    try { logSync_('فشل', 0, String(err.message).slice(0, 300)); } catch (e2) { /* تجاهل */ }
  }
}

function removeAutoSync_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncFromSheet') ScriptApp.deleteTrigger(triggers[i]);
  }
}

function installAutoSync() {
  if (!PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')) {
    SpreadsheetApp.getUi().alert('أولاً: افتح إعدادات GitHub وأدخل الـ token.');
    return;
  }
  removeAutoSync_();
  ScriptApp.newTrigger('syncFromSheet').timeBased().everyMinutes(10).create();
  syncFromSheet();
  SpreadsheetApp.getUi().alert('تم تشغيل المزامنة\nكل تعديل في الشيت يصل للموقع خلال 10 دقائق، ويسجّل في تبويب سجل المزامنة.');
}

function removeAutoSync() {
  removeAutoSync_();
  SpreadsheetApp.getUi().alert('تم إيقاف المزامنة التلقائية.');
}
