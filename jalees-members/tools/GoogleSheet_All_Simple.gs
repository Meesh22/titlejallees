/** جليس - تجهيز الشيت فقط (نسخة اختبار آمنة) */
function setupJaleesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('افتح هذا السكربت من داخل الشيت عبر Extensions > Apps Script');

  var roster = [
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
  var members = getOrCreate_(ss, 'الأعضاء');
  members.clear();
  members.getRange(1, 1, 1, 2).setValues([['id', 'اسم العضو']]);
  members.getRange(2, 1, roster.length, 2).setValues(roster);
  members.setFrozenRows(1);
  members.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#1E3A2B').setFontColor('#FFFFFF');
  members.setColumnWidth(1, 90);
  members.setColumnWidth(2, 260);

  makeTab_(ss, 'الاقتباسات', ['العضو', 'الاقتباس', 'الكتاب / المصدر', 'التاريخ'], members, roster.length);
  makeTab_(ss, 'المقالات', ['العضو', 'عنوان المقال', 'مقتطف', 'التاريخ', 'الرابط'], members, roster.length);
  makeTab_(ss, 'الملخصات', ['العضو', 'الكتاب', 'المؤلف', 'الملخص', 'التاريخ'], members, roster.length);

  SpreadsheetApp.getUi().alert('تم تجهيز الشيت بنجاح ✅');
}

function getOrCreate_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function makeTab_(ss, name, headers, members, count) {
  var sh = getOrCreate_(ss, name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E3A2B').setFontColor('#FFFFFF');
  sh.setColumnWidth(1, 250);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(members.getRange(2, 2, count, 1), true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 1, 1000, 1).setDataValidation(rule);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('جليس')
    .addItem('تجهيز الشيت', 'setupJaleesSheet')
    .addToUi();
}
/* ====================== المزامنة مع GitHub ====================== */
function syncName_(v) {
  return String(v || '').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[\u0621\u0623\u0625\u0622\u0671\u0649]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/\s+/g, '').toLowerCase();
}

function gh_(m, p, payload) {
  var props = PropertiesService.getScriptProperties();
  var o = { method: m.toUpperCase(), headers: { 'Authorization': 'Bearer ' + props.getProperty('GITHUB_TOKEN') } };
  if (payload) {
    o.headers['Content-Type'] = 'application/json';
    o.payload = JSON.stringify(payload);
  }
  var url = 'https://api.github.com/repos/' + props.getProperty('GITHUB_OWNER') + '/' + props.getProperty('GITHUB_REPO') + p;
  var res = UrlFetchApp.fetch(url, o);
  if (res.getResponseCode() >= 400) throw new Error('GitHub ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  var t = res.getContentText();
  return t ? JSON.parse(t) : null;
}

function pushFiles_(files) {
  var props = PropertiesService.getScriptProperties();
  var branch = props.getProperty('GITHUB_BRANCH') || 'main';
  var ref = gh_('get', '/git/ref/heads/' + encodeURIComponent(branch));
  var commit = gh_('get', '/git/commits/' + ref.object.sha);
  var tree = files.map(function (f) {
    var blob = gh_('post', '/git/blobs', { content: Utilities.base64Encode(f.content, Utilities.Charset.UTF_8), encoding: 'base64' });
    return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
  });
  var newTree = gh_('post', '/git/trees', { base_tree: commit.tree.sha, tree: tree });
  var newCommit = gh_('post', '/git/commits', { message: 'مزامنة مكتبات الأعضاء من Google Sheet', tree: newTree.sha, parents: [ref.object.sha] });
  gh_('patch', '/git/refs/heads/' + encodeURIComponent(branch), { sha: newCommit.sha });
}

function buildContentFiles_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var members = ss.getSheetByName('الأعضاء');
  var names = members.getRange(2, 2, members.getLastRow() - 1, 1).getValues();

  var index = {};
  var data = {};
  names.forEach(function (r, i) {
    var id = 'm' + (i + 2);
    data[id] = { id: id, name: String(r[0]).trim(), quotes: [], articles: [], summaries: [] };
    index[id] = { quotes: 0, articles: 0, summaries: 0 };
  });

  function findMember(name) {
    var key = syncName_(name);
    for (var id in data) {
      if (data.hasOwnProperty(id) && syncName_(data[id].name) === key) return data[id];
    }
    return null;
  }

  function readSheet(sheetName, type, cols) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var last = sheet.getLastRow();
    var vals = sheet.getRange(2, 1, last - 1, cols).getValues();
    vals.forEach(function (r) {
      var m = findMember(r[0]);
      if (!m) return;
      var item = {};
      if (type === 'quotes') {
        if (!r[1]) return;
        item.id = 'q' + (m.quotes.length + 1); item.text = String(r[1]).trim(); item.book = r[2] ? String(r[2]).trim() : ''; item.date = r[3] ? String(r[3]).trim() : '';
      } else if (type === 'articles') {
        if (!r[1]) return;
        item.id = 'a' + (m.articles.length + 1); item.title = String(r[1]).trim(); item.excerpt = r[2] ? String(r[2]).trim() : ''; item.date = r[3] ? String(r[3]).trim() : ''; item.link = r[4] ? String(r[4]).trim() : '';
      } else {
        if (!r[1]) return;
        item.id = 's' + (m.summaries.length + 1); item.book = r[1] ? String(r[1]).trim() : ''; item.author = r[2] ? String(r[2]).trim() : ''; item.text = String(r[3]).trim(); item.date = r[4] ? String(r[4]).trim() : '';
      }
      m[type].push(item);
    });
  }

  readSheet('الاقتباسات', 'quotes', 4);
  readSheet('المقالات', 'articles', 5);
  readSheet('الملخصات', 'summaries', 5);

  Object.keys(data).forEach(function (id) {
    index[id] = { quotes: data[id].quotes.length, articles: data[id].articles.length, summaries: data[id].summaries.length };
  });

  var files = [{ path: 'data/content/index.json', content: JSON.stringify(index, null, 2) }];
  Object.keys(data).forEach(function (id) {
    files.push({ path: 'data/content/' + id + '.json', content: JSON.stringify(data[id], null, 2) });
  });
  return files;
}

function syncJalees() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('GITHUB_TOKEN')) {
    SpreadsheetApp.getUi().alert('أولاً: استخدم دالة إعدادات GitHub لأدخل الـ token.');
    return;
  }
  var files = buildContentFiles_();
  pushFiles_(files);
  SpreadsheetApp.getUi().alert('تم المزامنة بنجاح ✅\nرفع ' + files.length + ' ملف.');
}

function configureGitHub() {
  var props = PropertiesService.getScriptProperties();
  var ui = SpreadsheetApp.getUi();
  var owner = ui.prompt('مالك المستودع (مثال: Meshh22)', '', ui.ButtonSet.OK_CANCEL);
  if (owner.getSelectedButton() !== ui.Button.OK) return;
  var repo = ui.prompt('اسم المستودع (مثال: jalees-tool)', '', ui.ButtonSet.OK_CANCEL);
  if (repo.getSelectedButton() !== ui.Button.OK) return;
  var branch = ui.prompt('الفرع (default: main)', 'main', ui.ButtonSet.OK_CANCEL);
  if (branch.getSelectedButton() !== ui.Button.OK) return;
  var token = ui.prompt('GitHub Token (صلاحية repo)', '', ui.ButtonSet.OK_CANCEL);
  if (token.getSelectedButton() !== ui.Button.OK) return;
  props.setProperties({
    GITHUB_OWNER: owner.getResponseText().trim() || 'Meshh22',
    GITHUB_REPO: repo.getResponseText().trim() || 'jalees-tool',
    GITHUB_BRANCH: branch.getResponseText().trim() || 'main',
    GITHUB_TOKEN: token.getResponseText().trim()
  });
  ui.alert('تم حفظ الإعدادات ✅');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('جليس')
    .addItem('1) تجهيز الشيت', 'setupJaleesSheet')
    .addItem('2) مزامنة إلى GitHub', 'syncJalees')
    .addSeparator()
    .addItem('إعدادات GitHub', 'configureGitHub')
    .addToUi();
}