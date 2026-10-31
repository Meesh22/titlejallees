/**
 * ==========================================================================
 * جليس | مساحة الأعضاء
 * تطبيق أعضاء نادي جليس القرائي — JavaScript خالص (بدون مكتبات)
 * ==========================================================================
 */
'use strict';

/* --------------------------------------------------------------------------
   0. أدوات مساعدة
   -------------------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const AR = '٠١٢٣٤٥٦٧٨٩';
const toAr = (value) => String(value).replace(/\d/g, (d) => AR[Number(d)]);
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromISO = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
const startOfWeek = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
};
const isThisWeek = (key) => {
  const start = startOfWeek();
  const end = addDays(start, 6);
  return key >= toISO(start) && key <= toISO(end);
};
const dayLabel = (key) => {
  const today = toISO(new Date());
  const yesterday = toISO(addDays(new Date(), -1));
  if (key === today) return 'اليوم';
  if (key === yesterday) return 'أمس';
  return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short' }).format(fromISO(key));
};
const initials = (name) => (String(name).trim().charAt(0) || 'ج');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* --------------------------------------------------------------------------
   1. الثوابت والبيانات الأساسية
   -------------------------------------------------------------------------- */
const SESSION_KEY = 'jalees-session-v2';
const MEMBER_KEY_PREFIX = 'jalees-member-v2:';
const LEGACY_KEY = 'jalees-members-v1';
const CLUB_GOAL = 12000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzQAU7y1xbP8LRSgGjhVS29jBPgXxKc_dhz-5ZGbcrg6QIjWN-2HtuKym8dymUyP5IK/exec';
const QUOTES_SHEET_URL = 'https://script.google.com/macros/s/AKfycbyUvJexsviIa-2nedbRPQa1NN9thBogDIcL5gYNtxIg3vL5LtZEd17udgQpKLxGDtloYw/exec';
const SHARED_QUOTES_KEY = 'jalees-shared-quotes-v3';

function mergeQuoteLists(...lists) {
  const out = [];
  const seenText = new Set();
  const seenId = new Set();
  lists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((quote) => {
      if (!quote || !quote.text) return;
      const text = normalizeName(quote.text);
      if (!text || seenText.has(text)) return;
      if (quote.id && seenId.has(quote.id)) return;
      seenText.add(text);
      if (quote.id) seenId.add(quote.id);
      out.push(quote);
    });
  });
  /* الأحدث أولاً: الاقتباسات الجديدة تظهر في المقدمة */
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function collectAllMemberQuotes() {
  const out = [];
  try {
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith(MEMBER_KEY_PREFIX)) return;
      let parsed = null;
      try { parsed = JSON.parse(localStorage.getItem(key)); } catch (e) { parsed = null; }
      if (!parsed || !Array.isArray(parsed.quotes)) return;
      const memberId = parsed.memberId || key.slice(MEMBER_KEY_PREFIX.length);
      parsed.quotes.forEach((quote) => {
        if (!quote || !quote.text) return;
        /* اقتباس نُشر قديماً بـ «me» يُنسب لصاحبه الأصلي حتى لا يظهر كاقتباسك */
        out.push({ ...quote, authorId: quote.authorId === 'me' ? memberId : quote.authorId });
      });
    });
  } catch (e) {}
  return out;
}

function getLocalSharedQuotes() {
  let stored = [];
  try {
    const raw = localStorage.getItem(SHARED_QUOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) stored = parsed;
    }
  } catch (e) {}
  /* ندمج كل المصادر ثم نرتّب بحيث يظهر الأحدث أولاً */
  return mergeQuoteLists(stored, QUOTE_SEED.map((q) => ({ ...q })), collectAllMemberQuotes());
}

function saveLocalSharedQuotes(quotes) {
  try {
    if (Array.isArray(quotes)) {
      localStorage.setItem(SHARED_QUOTES_KEY, JSON.stringify(quotes));
    }
  } catch (e) {}
}

function getStoredSharedQuotes() {
  try {
    const raw = localStorage.getItem(SHARED_QUOTES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/* حذف الاقتباسات من كل مكان على هذا الجهاز (الشيت هو المصدر): Member state + الكاش */
function pruneQuotesEverywhere(texts) {
  const isRemoved = (quote) => Boolean(quote && quote.text && texts.has(normalizeName(quote.text)));
  try {
    /* 1. حالة العضو الحالي */
    if (state && Array.isArray(state.quotes) && state.quotes.some(isRemoved)) {
      state.quotes = state.quotes.filter((q) => !isRemoved(q));
      saveState();
    }
    /* 2. سجلات كل الأعضاء الآخرين على هذا الجهاز */
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith(MEMBER_KEY_PREFIX)) return;
      let parsed = null;
      try { parsed = JSON.parse(localStorage.getItem(key)); } catch (e) { parsed = null; }
      if (!parsed || !Array.isArray(parsed.quotes)) return;
      const filtered = parsed.quotes.filter((q) => !isRemoved(q));
      if (filtered.length === parsed.quotes.length) return;
      parsed.quotes = filtered;
      localStorage.setItem(key, JSON.stringify(parsed));
    });
  } catch (e) {}
}

const CLUB = {
  name: 'نادي جليس القرائي',
  tagline: 'لأن القراءة تجمعنا',
  city: 'منطقة القصيم'
};

/* قائمة أعضاء النادي — الاسم هو العضوية.
   pages = صفحات الأسبوع ١٩٨، lastWeek = صفحات الأسبوع ١٩٧ (من تقرير النادي). */
const MEMBER_COLORS = ['#1E3A2B', '#8C532D', '#A3503B', '#3D5A4C', '#6B4E2E', '#7A4A3A', '#2A4F3B', '#C59B63'];
const MEMBER_ROSTER = [
  ['محمد السحيباني', 750, 760],
  ['عبدالرحمن بن أمين', 650, 700],
  ['عادل الكبير', 679, 653],
  ['خالد الواصل', 600, 672],
  ['راكان الحربي', 455, 600],
  ['رائد القرعاوي', 150, 500],
  ['عمار الفايز', 400, 400],
  ['محمد الضويان', 450, 100],
  ['محمد العميري', 375, 335],
  ['محمد العمر', 287, 582],
  ['باسل الرميح', 500, 406],
  ['نعيم الغضية', 1230, 0],
  ['عبدالعزيز الدوسري', 0, 0],
  ['أسامة الفلاج', 300, 300],
  ['سلطان النصيان', 200, 200],
  ['عبدالرحمن الجريش', 250, 200],
  ['سلطان بن برغش', 400, 300],
  ['عبدالرحمن السيف', 388, 0],
  ['عبدالرحمن الصعب', 0, 700],
  ['عبدالله الزويد', 123, 404],
  ['عبدالرحيم قاعد', 0, 700],
  ['عبدالعزيز الطويان', 247, 127],
  ['أحمد الظاهر', 175, 155],
  ['عبدالله التويجري', 200, 50],
  ['محمد الدبيخي', 80, 70],
  ['خلف الهديي', 190, 60],
  ['عبدالله الشبرمي', 180, 0],
  ['محمد الدخيل', 500, 0],
  ['عبدالعزيز الوهيبي', 135, 108],
  ['مشعل الحفير', 85, 164],
  ['صالح الجاسر', 30, 70],
  ['عبدالرحمن القحطاني', 0, 324],
  ['صالح الضحيان', 0, 0],
  ['بدر الشايعي', 200, 0],
  ['عبدالله المحميد', 70, 0],
  ['سلطان الدبيخي', 0, 0],
  ['بندر الغامدي', 0, 100],
  ['إبراهيم الشويهي', 0, 35],
  ['محمد العليان', 30, 100],
  ['عمر الشعيبي', 0, 149],
  ['محمد العجاجي', 145, 0],
  ['تركي العمران', 53, 61],
  ['عبدالعزيز الهويمل', 111, 0],
  ['عبدالله السعودي', 0, 110],
  ['محمد حمدان', 0, 102],
  ['حكيم الصطامي', 0, 0],
  ['رائد الوسيدي', 0, 0],
  ['إلياس العبيري', 1, 3],
  ['احمد الاكيزم', 0, 0],
  ['عبدالله الفهيد', 20, 20],
  ['عمر القريعان', 50, 0],
  ['معاذ عطافي', 0, 23],
  ['عبدالعزيز العقيل', 0, 0],
  ['يحيى اليحيا', 0, 30],
  ['فهد العوفي', 0, 27],
  ['صالح السمحان', 0, 0],
  ['مهيب الغيثي', 0, 0],
  ['فهد الفلاج', 11, 5],
  ['عمر البقمي', 0, 14],
  ['ابراهيم النغيمشي', 0, 20],
  ['عبدالله المنصور', 0, 15],
  ['عبدالله الرقيعي', 0, 10],
  ['عبدالرحمن الثنيان', 0, 4]
];

const MEMBERS = MEMBER_ROSTER.map(([name, pages, lastWeek], index) => ({
  id: `m${index + 1}`,
  name,
  role: index === 0 ? 'عضو مؤسس' : 'عضو',
  pages,
  lastWeek,
  color: MEMBER_COLORS[index % MEMBER_COLORS.length]
}));

const memberById = (id) => MEMBERS.find((member) => member.id === id) || null;

function normalizeName(value) {
  return String(value || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
    .trim();
}

function findMemberByName(value) {
  const key = normalizeName(value);
  if (!key) return null;
  return MEMBERS.find((member) => normalizeName(member.name) === key) || null;
}

const seedAuthor = (id) => {
  const member = memberById(id);
  return member
    ? { authorId: member.id, authorName: member.name, color: member.color }
    : { authorId: id, authorName: 'عضو جليس', color: '#1E3A2B' };
};

const BOOKS = [
  {
    id: 'b1', title: 'حياة في الإدارة', author: 'غازي القصيبي', category: 'إدارة',
    pages: 288, rating: 4.8, available: 2, pick: true, c1: '#1B3A2B', c2: '#2E5A43',
    desc: 'سيرة غازي القصيبي الإدارية وتجاربه في الوزارة والجامعة، بأسلوب يجمع بين الطرفة والدرس، ويقدّم خلاصة سنوات من العمل العام.'
  },
  {
    id: 'b2', title: 'الأيام', author: 'طه حسين', category: 'سيرة',
    pages: 320, rating: 4.7, available: 3, pick: true, c1: '#6B4E2E', c2: '#8C6531',
    desc: 'سيرة طه حسين الذاتية من طفولته في الريف إلى الأزهر ثم السوربون، بأسلوب رائد في السرد العربي الحديث.'
  },
  {
    id: 'b3', title: 'وحي القلم', author: 'مصطفى صادق الرافعي', category: 'أدب',
    pages: 400, rating: 4.6, available: 1, pick: true, c1: '#7A4A3A', c2: '#A3503B',
    desc: 'مقالات الرافعي في الأدب واللغة والحياة، بنثر موسيقي يعيد للكلمة هيبتها، ويوقظ في القارئ حساسية جديدة تجاه الجمال.'
  },
  {
    id: 'b4', title: 'مقدمة ابن خلدون', author: 'عبد الرحمن بن خلدون', category: 'فكر',
    pages: 360, rating: 4.9, available: 0, pick: true, c1: '#243B33', c2: '#3D5A4C',
    desc: 'مختارات من المقدمة في العمران والاجتماع والتاريخ، وأسس علم العمران البشري كما صاغها ابن خلدون قبل قرون.'
  },
  {
    id: 'b5', title: 'رحلة الحاج', author: 'سعد بن أحمد الربيعة', category: 'تاريخ',
    pages: 240, rating: 4.5, available: 2, pick: false, c1: '#3B4A2E', c2: '#5C6B3F',
    desc: 'توثيق لرحلة الحج من بلد الزبير إلى البلد الحرام، بوصف اجتماعي وتاريخي دقيق يستعيد تفاصيل الطريق والناس.'
  },
  {
    id: 'b6', title: 'رجال في الشمس', author: 'غسان كنفاني', category: 'رواية',
    pages: 160, rating: 4.8, available: 1, pick: false, c1: '#4A3328', c2: '#8C532D',
    desc: 'ثلاثة فلسطينيين يحملون حلم العودة في شاحنة صهريج، في رواية عن الانتظار والخيانة والأمل الذي لا يموت.'
  },
  {
    id: 'b7', title: 'موسم الهجرة إلى الشمال', author: 'الطيب صالح', category: 'رواية',
    pages: 192, rating: 4.7, available: 3, pick: false, c1: '#1E3A2B', c2: '#4C6A55',
    desc: 'حكاية مصطفى سعيد بين السودان وإنجلترا، عن الهوية والاستلاب وما تفعله الحضارة بالبشر حين تفقدهم جذورهم.'
  },
  {
    id: 'b8', title: 'العادات الذرية', author: 'جيمس كلير', category: 'تطوير',
    pages: 320, rating: 4.4, available: 2, pick: false, c1: '#8A6A2F', c2: '#C59B63',
    desc: 'دليل عملي لبناء عادات صغيرة تصنع نتائج كبيرة، عبر تغيير البيئة والهوية لا الإرادة وحدها.'
  }
];

const ARTICLE_CATEGORIES = [
  'الكل',
  'قراءة',
  'تجارب',
  'فكر',
  'رواية',
  'تاريخ',
  'أدب',
  'تطوير ذاتي',
  'شعر',
  'دراسات',
  'طفولة',
  'فلسفة',
  'علوم',
  'سيرة',
  'فنون'
];

const ARTICLE_SEED = [
  {
    id: 'a1', title: 'كيف نقرأ الكتاب الواحد ثلاث مرات؟', category: 'قراءة', read: 5,
    ...seedAuthor('m27'), time: 'قبل ٣ ساعات',
    excerpt: 'ليست إعادة القراءة تكراراً… بل اكتشافاً لطبقات لم نرها في المرة الأولى.',
    body: 'أول قراءة هي قراءة الاكتشاف. نندفع مع الصفحات لنعرف ماذا سيحدث، ونلتقط الفكرة العامة، ونغلق الكتاب وقد صار لنا رأي أولي… لكنه رأي متعجل.\n\nالقراءة الثانية هي قراءة الخريطة. نعود إلى الفصول التي أحببناها، ونتوقف عند الجمل التي مررنا عليها سريعاً، ونبدأ في رؤية كيف بُني الكتاب: أين يكرر المؤلف فكرته؟ وأين يخالف نفسه؟\n\nأما القراءة الثالثة فهي قراءة الحوار. نقرأ ونحن نكتب على الهامش، نسأل الكاتب، ونعترض، ونربط بما قرأناه في كتب أخرى. عندها يتوقف الكتاب عن كونه نصاً خارجياً، ويصبح جزءاً من تفكيرنا.\n\nليست كل الكتب تستحق ثلاث قراءات، لكن أجملها يستحق أن يعود إليه القارئ بعد سنة، فيجده مختلفاً… لا لأن الكتاب تغيّر، بل لأننا تغيّرنا.'
  },
  {
    id: 'a2', title: 'القراءة البطيئة: حين يصير التأمل جزءاً من الكتاب', category: 'قراءة', read: 4,
    ...seedAuthor('m19'), time: 'أمس',
    excerpt: 'في زمن يعدّ الصفحات، قد تكون أجمل قراءة هي التي نتوقف فيها أكثر مما نتقدم.',
    body: 'كبرتُ على فكرة أن القراءة إنجاز: عدد الكتب، عدد الصفحات، قائمة تنتهي ثم تبدأ أخرى. ثم اكتشفت أن بعض الكتب لا تريد منك أن تصل إلى صفحتها الأخيرة بسرعة.\n\nالقراءة البطيئة ليست بطئاً في الفهم، بل هي سماح للجملة بأن تعمل داخلك. تعيد قراءة الفقرة، تغلق الكتاب، تمشي قليلاً، ثم تعود.\n\nجرّب أن تقرأ عشر صفحات فقط في جلسة واحدة، وأن تكتب بعدها ثلاثة أسطر عمّا تغيّر فيك. ستكتشف أن ما بقي معك أكبر مما توقعت.\n\nالكتب العظيمة لا تُقاس بعدد الصفحات التي أنهيناها، بل بعدد المرات التي عُدنا فيها إلى جملة واحدة.'
  },
  {
    id: 'a3', title: 'من هامش الكتاب: لماذا نكتب على الصفحات؟', category: 'تجارب', read: 3,
    ...seedAuthor('m30'), color: '#C59B63', time: 'قبل يومين',
    excerpt: 'الهامش مساحة خاصة بين الكاتب والقارئ… فيها نعترف بما لم نفهمه، ونحتفظ بما أدهشنا.',
    body: 'أول كتاب كتبت على هوامشه كنت أظن أنني أفسده. ثم صار الهامش هو المكان الذي أعود إليه قبل أن أعيد قراءة الكتاب نفسه.\n\nنكتب في الهامش لأن الذاكرة لا تحفظ كل شيء. نكتب لنقول لأنفسنا في المستقبل: هنا توقفت، وهذه الفكرة أشبهتني، وهذا السؤال ما زال بلا جواب.\n\nبعض الهوامش تصير مقالات، وبعضها يصير اقتباساً نشاركه، وبعضها يبقى سراً صغيراً بيننا وبين الصفحة.\n\nالكتاب الذي لا أثر لنا فيه، ربما لم نقرأه بالطريقة التي تستحق.'
  },
  {
    id: 'a4', title: 'جليس… حين تصير القراءة مجلساً', category: 'النادي', read: 4,
    ...seedAuthor('m3'), time: 'قبل ٤ أيام',
    excerpt: 'لم نكن نبحث عن نادٍ للقراءة، كنا نبحث عن مكان يجتمع فيه الناس على السؤال نفسه.',
    body: 'بدأت الحكاية بجلسة صغيرة، كتاب واحد، وعدد محدود من الكراسي. لم يكن هناك عنوان كبير ولا شعار، فقط رغبة في أن نقرأ ثم نتحدث.\n\nفي جليس تعلمت أن القراءة الجماعية لا تلغي القراءة الفردية، بل تضيء زوايا لم أرها وحدي. كل عضو يقرأ الكتاب بعينه، وحين نجتمع يصبح لدينا عشر عيون.\n\nأجمل ما في المجلس هو الصمت الذي يسبق السؤال، ثم الضحك حين يكتشف أحدنا أنه فهم الجملة بشكل مختلف تماماً.\n\nجليس ليس مكاناً نذهب إليه لننهي الكتب، بل لنبدأ الحديث عنها.'
  }
];

const QUOTE_SEED = [
  {
    id: 'q1', text: 'خير جليس في الزمان كتاب', book: 'ديوان المتنبي', page: '',
    ...seedAuthor('m27'), time: 'قبل ساعتين', likes: 18
  },
  {
    id: 'q2', text: 'القراءة ليست هروباً من الحياة، بل عودة إليها بعينين أكثر اتساعاً.', book: 'الأيام', page: '٢٤',
    ...seedAuthor('m9'), time: 'قبل ٥ ساعات', likes: 24
  },
  {
    id: 'q3', text: 'ما أجمل أن تكتشف أن الكتاب الذي تأخرت في قراءته كان ينتظرك في الوقت المناسب.', book: 'وحي القلم', page: '١١٢',
    ...seedAuthor('m30'), color: '#C59B63', time: 'أمس', likes: 12
  },
  {
    id: 'q4', text: 'نحن نقرأ لنعرف أننا لسنا وحدنا في هذا العالم.', book: 'موسم الهجرة إلى الشمال', page: '',
    ...seedAuthor('m15'), time: 'أمس', likes: 31
  },
  {
    id: 'q5', text: 'في كل كتاب زاوية جديدة للعالم… وفي كل قارئ عالم جديد للكتاب.', book: 'حياة في الإدارة', page: '٨٨',
    ...seedAuthor('m25'), time: 'قبل يومين', likes: 9
  },
  {
    id: 'q6', text: 'الصفحات القليلة التي نقرأها كل يوم تصنع فارقاً لا نراه اليوم، لكننا نراه بعد سنة.', book: 'العادات الذرية', page: '',
    ...seedAuthor('m22'), time: 'قبل ٣ أيام', likes: 27
  }
];

/* --------------------------------------------------------------------------
   2. حالة التطبيق والتخزين المحلي
   -------------------------------------------------------------------------- */
function createInitialState(member) {
  return {
    memberId: member ? member.id : null,
    profile: {
      name: member ? member.name : MEMBERS[0].name,
      role: member ? member.role : 'عضو',
      joined: '٢٠٢٤',
      goal: 200,
      lastWeekPages: member ? member.lastWeek : 0,
      notifications: true
    },
    /* كل عضو يبدأ بسجل فارغ — التقدم يُبنى من قراءاته الفعلية. */
    entries: [],
    myBooks: [],
    quotes: QUOTE_SEED.map((q) => ({ ...q })),
    savedQuotes: [],
    likedQuotes: [],
    quoteFilter: 'all',
    articles: ARTICLE_SEED.map((a) => ({ ...a })),
    savedArticles: [],
    rsvp: false,
    boardPeriod: 'week',
    libraryPane: 'club',
    libraryCategory: 'all',
    libraryQuery: '',
    myFilter: 'reading',
    articleFilter: 'all',
    articleCategory: 'all',
    articleCategorySearch: '',
    clubBooks: [],
    personalBooks: []
  };
}

const stateKey = (id) => `${MEMBER_KEY_PREFIX}${id}`;

/* ============================================================================
   مزامنة البيانات مع Google Sheets (السحابة)
   ============================================================================ */
async function cloudRequest(action, data = null, memberId = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = memberId
      ? `${APPS_SCRIPT_URL}?action=${action}&memberId=${encodeURIComponent(memberId)}`
      : APPS_SCRIPT_URL;

    const options = data
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `action=${action}&data=${encodeURIComponent(JSON.stringify(data))}`,
          signal: controller.signal
        }
      : { signal: controller.signal };

    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    console.error('Cloud request error:', error);
    return { success: false, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

/* ---- مزامنة ذكية: تُرسل الصفوف الجديدة فقط، مؤجلة ومتسلسلة ----
   السبب: إعادة رفع كل السجلات في كل حفظ كانت تُغرق الموقع بمئات الطلبات. */
const SYNC_KEY_PREFIX = 'jalees-sync-v2:';
const syncKey = (id) => `${SYNC_KEY_PREFIX}${id}`;
let syncState = { profile: false, entries: new Set(), myBooks: new Set(), clubBooks: new Set() };
let syncTimer = null;
let syncRunning = false;
let syncAgain = false;
let syncBlockedUntil = 0;
let loadedFromCloud = false;

function emptySyncState() {
  return { profile: false, entries: new Set(), myBooks: new Set(), clubBooks: new Set() };
}

function loadSyncState(memberId) {
  try {
    const raw = localStorage.getItem(syncKey(memberId));
    if (!raw) return emptySyncState();
    const parsed = JSON.parse(raw);
    return {
      profile: Boolean(parsed.profile),
      entries: new Set(parsed.entries || []),
      myBooks: new Set(parsed.myBooks || []),
      clubBooks: new Set(parsed.clubBooks || [])
    };
  } catch (error) {
    return emptySyncState();
  }
}

function persistSyncState(memberId) {
  try {
    localStorage.setItem(syncKey(memberId), JSON.stringify({
      profile: syncState.profile,
      entries: [...syncState.entries],
      myBooks: [...syncState.myBooks],
      clubBooks: [...syncState.clubBooks]
    }));
  } catch (error) { /* التخزين غير متاح */ }
}

function resetSyncState(memberId) {
  syncState = loadSyncState(memberId);
}

function myBookSyncKey(book) {
  return `${book.bookId}:${book.status}:${Number(book.currentPage) || 0}`;
}

async function saveProfileToCloud(member) {
  return cloudRequest('saveProfile', {
    memberId: member.id,
    name: member.name,
    role: member.role,
    joined: '٢٠٢٤',
    goal: state.profile.goal,
    lastWeekPages: member.lastWeek,
    notifications: state.profile.notifications
  });
}

async function saveEntryToCloud(member, entry) {
  return cloudRequest('saveEntry', {
    id: entry.id,
    memberId: member.id,
    memberName: state.profile.name,
    bookId: entry.bookId || null,
    bookTitle: entry.bookTitle || '',
    pages: entry.pages,
    date: entry.date,
    createdAt: entry.ts || Date.now()
  });
}

async function saveMyBookRowToCloud(member, book) {
  return cloudRequest('saveMyBook', {
    memberId: member.id,
    memberName: state.profile.name,
    bookId: book.bookId,
    status: book.status,
    currentPage: book.currentPage
  });
}

async function saveClubBookToCloud(member, book) {
  return cloudRequest('saveClubBook', {
    id: book.id,
    memberId: member.id,
    memberName: state.profile.name,
    title: book.title,
    author: book.author,
    category: book.category,
    coverColor: book.coverColor,
    report: book.report || '',
    pages: book.pages || 0,
    createdAt: book.createdAt || Date.now()
  });
}

function scheduleCloudSync(delay = 1200) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncTimer = null; runCloudSync(); }, delay);
}

async function runCloudSync() {
  if (!state || !currentMember) return;
  if (Date.now() < syncBlockedUntil) return;
  if (syncRunning) { syncAgain = true; return; }
  syncRunning = true;
  const member = currentMember;
  const memberId = member.id;
  try {
    if (!syncState.profile) {
      const result = await saveProfileToCloud(member);
      if (result && result.success !== false) {
        syncState.profile = true;
        persistSyncState(memberId);
      } else {
        syncBlockedUntil = Date.now() + 60000;
        return;
      }
    }

    for (const entry of state.entries) {
      if (currentMember !== member) return;
      if (syncState.entries.has(entry.id)) continue;
      const result = await saveEntryToCloud(member, entry);
      if (!result || result.success === false) { syncBlockedUntil = Date.now() + 60000; break; }
      syncState.entries.add(entry.id);
      persistSyncState(memberId);
    }

    for (const book of state.myBooks) {
      if (currentMember !== member) return;
      const key = myBookSyncKey(book);
      if (syncState.myBooks.has(key)) continue;
      const result = await saveMyBookRowToCloud(member, book);
      if (!result || result.success === false) { syncBlockedUntil = Date.now() + 60000; break; }
      syncState.myBooks.add(key);
      persistSyncState(memberId);
    }

    for (const book of state.clubBooks) {
      if (currentMember !== member) return;
      if (syncState.clubBooks.has(book.id)) continue;
      const result = await saveClubBookToCloud(member, book);
      if (!result || result.success === false) { syncBlockedUntil = Date.now() + 60000; break; }
      syncState.clubBooks.add(book.id);
      persistSyncState(memberId);
    }
  } catch (error) {
    console.error('Cloud sync error:', error);
  } finally {
    syncRunning = false;
    if (syncAgain && currentMember === member) {
      syncAgain = false;
      scheduleCloudSync(1500);
    }
  }
}

async function loadClubBooksFromCloud(memberId) {
  const result = await cloudRequest('getClubBooks', null, memberId);
  return result.success ? result.data : [];
}

async function loadProfileFromCloud(memberId) {
  const result = await cloudRequest('getProfile', null, memberId);
  return result.success && result.data.length > 0 ? result.data[0] : null;
}

async function loadEntriesFromCloud(memberId) {
  const result = await cloudRequest('getEntries', null, memberId);
  return result.success ? result.data : [];
}

async function loadMyBooksFromCloud(memberId) {
  const result = await cloudRequest('getMyBooks', null, memberId);
  return result.success ? result.data : [];
}

async function saveQuoteToSheet(quoteData) {
  if (!QUOTES_SHEET_URL) return;
  try {
    const payload = {
      created_at: new Date().toLocaleString('ar-SA'),
      author_name: (state && state.profile && state.profile.name) || quoteData.authorName || 'عضو جليس',
      page_number: quoteData.page || '',
      book_title: quoteData.book || '',
      quote_text: quoteData.text || ''
    };

    await fetch(QUOTES_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(JSON.stringify(payload))}`
    });
  } catch (err) {
    console.error('Failed to save quote to sheet:', err);
  }
}

async function loadQuotesFromSheet() {
  if (!QUOTES_SHEET_URL) return null;
  try {
    const response = await fetch(QUOTES_SHEET_URL);
    const result = await response.json();
    if (result && result.status === 'success' && Array.isArray(result.data)) {
      return result.data.map((q, idx) => {
        const mem = MEMBERS.find((m) => normalizeName(m.name) === normalizeName(q.author_name));
        return {
          id: q.id || `sheet-${idx}`,
          text: q.quote_text,
          book: q.book_title || 'من هامش القراءة',
          page: q.page_number ? String(q.page_number) : '',
          authorId: mem ? mem.id : 'cloud',
          authorName: q.author_name || 'عضو جليس',
          color: mem ? mem.color : '#C59B63',
          time: q.created_at || 'مؤخراً',
          likes: 0,
          createdAt: q.created_at ? new Date(q.created_at).getTime() : 0
        };
      }).reverse();
    }
  } catch (err) {
    /* تجاوز في حال تعذر جلب السحابة */
  }
  return null;
}

let lastQuoteSyncAt = 0;

async function syncQuotesFromSheet() {
  const sheetQuotes = await loadQuotesFromSheet();
  if (!sheetQuotes) return; /* فشل الاتصال — نحتفظ بالبيانات الموجودة */

  /* الشيت هو المصدر القياسي: اقتباس كان موجوداً محلياً ثم اختفى من الشيت = محذوف.
     الاقتباسات الجديدة (أقل من ٣ دقائق) تُستثنى ريثما يصلها الشيت. */
  const sheetSet = new Set(sheetQuotes.map((q) => normalizeName(q.text)).filter(Boolean));
  const grace = Date.now() - 180000;
  const removedTexts = new Set(collectAllMemberQuotes().map((q) => {
    const text = normalizeName(q.text);
    if (!text || sheetSet.has(text)) return null;
    if (Number(q.createdAt || 0) > grace) return null;
    return text;
  }).filter(Boolean));

  if (removedTexts.size) pruneQuotesEverywhere(removedTexts);

  /* نستبدل الكاش المشترك بمحتوى الشيت، ثم نعيد الدمج مع ما يظل محلياً */
  saveLocalSharedQuotes(sheetQuotes);
  if (state) {
    state.quotes = getLocalSharedQuotes();
    renderQuotes();
    renderHome();
  }
}

async function loadQuotesFromCloud(memberId) {
  const fromSheet = await loadQuotesFromSheet();
  if (fromSheet && fromSheet.length) return fromSheet;
  const result = await cloudRequest('getQuotes', null, memberId);
  return result.success ? result.data : [];
}

async function loadArticlesFromCloud(memberId) {
  const result = await cloudRequest('getArticles', null, memberId);
  return result.success ? result.data : [];
}

let currentMember = null;
let state = null;

/* ترحيل بيانات النسخة القديمة — فقط للعضو الذي يطابق اسمه اسم الملف الشخصي المحفوظ. */
function readLegacyFor(member) {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (normalizeName(parsed && parsed.profile && parsed.profile.name) !== normalizeName(member.name)) return null;
    localStorage.removeItem(LEGACY_KEY);
    return parsed;
  } catch (error) {
    return null;
  }
}

async function loadStateFor(member) {
  const base = createInitialState(member);
  let parsed = null;
  loadedFromCloud = false;

  /* 1. أولوية للتخزين المحلي — بيانات المستخدم الحالية لا تُمسح أبداً */
  try {
    const raw = localStorage.getItem(stateKey(member.id));
    if (raw) parsed = JSON.parse(raw);
  } catch (error) {
    parsed = null;
  }
  if (!parsed) parsed = readLegacyFor(member);

  /* 2. إذا لم تكن هناك بيانات محلية، جلب من السحابة كبديل */
  if (!parsed || Object.keys(parsed).length <= 1) {
    try {
      const cloudLoad = Promise.all([
        loadProfileFromCloud(member.id),
        loadEntriesFromCloud(member.id),
        loadMyBooksFromCloud(member.id),
        loadQuotesFromCloud(member.id),
        loadArticlesFromCloud(member.id),
        loadClubBooksFromCloud(member.id)
      ]);
      /* مهلة قصوى: لا نُجمّد الدخول أكثر من ٤ ثوانٍ لو كان الاتصال بطيئاً */
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
      const cloudData = await Promise.race([cloudLoad, timeout]);
      if (!cloudData) throw new Error('cloud load timeout');
      const [profile, entries, myBooks, quotes, articles, clubBooks] = cloudData;

      if (profile) {
        loadedFromCloud = true;
        parsed = {
          profile: {
            name: profile.name || member.name,
            role: profile.role || member.role,
            joined: profile.joined || '٢٠٢٤',
            goal: Number(profile.goal) || 200,
            lastWeekPages: Number(profile.lastWeekPages) || member.lastWeek,
            notifications: profile.notifications !== 'false'
          },
          entries: Array.isArray(entries) ? entries : [],
          myBooks: Array.isArray(myBooks) ? myBooks : [],
          quotes: mergeQuoteLists(getLocalSharedQuotes(), Array.isArray(quotes) ? quotes : []),
          articles: Array.isArray(articles) && articles.length ? articles : base.articles,
          clubBooks: Array.isArray(clubBooks) ? clubBooks : [],
          savedQuotes: [],
          likedQuotes: [],
          savedArticles: []
        };
      }
    } catch (error) {
      console.error('Cloud load failed:', error);
    }
  }

  if (!parsed) {
    return {
      ...base,
      quotes: mergeQuoteLists(getLocalSharedQuotes(), base.quotes)
    };
  }

  return {
    ...base,
    ...parsed,
    memberId: member.id,
    profile: {
      ...base.profile,
      ...(parsed.profile || {}),
      name: member.name,
      role: member.role,
      lastWeekPages: member.lastWeek
    },
    entries: (Array.isArray(parsed.entries) ? parsed.entries : []).map((entry) => {
      const copy = { ...(entry || {}) };
      delete copy.minutes;
      return copy;
    }),
    myBooks: Array.isArray(parsed.myBooks) ? parsed.myBooks : [],
    clubBooks: Array.isArray(parsed.clubBooks) ? parsed.clubBooks : [],
    personalBooks: Array.isArray(parsed.personalBooks) ? parsed.personalBooks : [],
    quotes: mergeQuoteLists(getLocalSharedQuotes(), Array.isArray(parsed.quotes) ? parsed.quotes : []),
    articles: Array.isArray(parsed.articles) && parsed.articles.length ? parsed.articles : base.articles,
    savedQuotes: Array.isArray(parsed.savedQuotes) ? parsed.savedQuotes : [],
    likedQuotes: Array.isArray(parsed.likedQuotes) ? parsed.likedQuotes : [],
    savedArticles: Array.isArray(parsed.savedArticles) ? parsed.savedArticles : []
  };
}

async function saveState() {
  if (!state || !currentMember) return;
  /* 1. الحفظ المحلي فوري ومتزامن — يضمن ظهور البيانات فوراً في اللوحة */
  try {
    localStorage.setItem(stateKey(currentMember.id), JSON.stringify(state));
  } catch (error) {
    /* التخزين غير متاح — يستمر التطبيق في الذاكرة */
  }
  /* 2. المزامنة مع السحابة في الخلفية — مؤجلة ولا تعيق الواجهة إطلاقاً */
  scheduleCloudSync();
}

/* --------------------------------------------------------------------------
   3. حسابات القراءة
   -------------------------------------------------------------------------- */
const getBook = (id) => BOOKS.find((b) => b.id === id)
  || (state && state.clubBooks ? state.clubBooks.find((b) => b.id === id) : null)
  || (state && state.personalBooks ? state.personalBooks.find((b) => b.id === id) : null);
const getMyBook = (id) => state.myBooks.find((b) => b.bookId === id);

function isMine(item) {
  if (!item || !currentMember) return false;
  if (item.authorId === currentMember.id) return true;
  if (item.authorId === 'me' && (!item.authorName || normalizeName(item.authorName) === normalizeName(currentMember.name))) return true;
  if (item.authorName && normalizeName(item.authorName) === normalizeName(currentMember.name)) return true;
  return false;
}

function authorNameOf(item) {
  return isMine(item) ? state.profile.name : ((item && item.authorName) || 'عضو جليس');
}

function authorColorOf(item) {
  if (isMine(item)) return '#C59B63';
  if (item && item.color) return item.color;
  const m = item && item.authorName ? MEMBERS.find((mem) => normalizeName(mem.name) === normalizeName(item.authorName)) : null;
  return m ? m.color : '#1E3A2B';
}

function weekEntries() {
  const start = toISO(startOfWeek());
  const end = toISO(addDays(startOfWeek(), 6));
  return state.entries
    .filter((entry) => entry.date >= start && entry.date <= end)
    .sort((a, b) => (a.date === b.date ? b.ts - a.ts : b.date.localeCompare(a.date)));
}

function weekStats() {
  const entries = weekEntries();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = toISO(addDays(startOfWeek(), index));
    const pages = entries.filter((entry) => entry.date === date).reduce((sum, entry) => sum + Number(entry.pages || 0), 0);
    return { date, pages, label: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'][index] };
  });
  return {
    pages: entries.reduce((sum, entry) => sum + Number(entry.pages || 0), 0),
    sessions: entries.length,
    days
  };
}

function streakDays() {
  const days = new Set(state.entries.map((entry) => entry.date));
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(toISO(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(toISO(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function allMembers(period = state.boardPeriod) {
  const myWeekPages = weekStats().pages;
  const list = MEMBERS.map((member) => {
    const isMe = Boolean(currentMember && member.id === currentMember.id);
    const pages = period === 'week'
      ? Number(member.pages || 0) + (isMe ? myWeekPages : 0)
      : Number(member.lastWeek || 0);
    return { ...member, pages, isMe };
  });
  return list.sort((a, b) => b.pages - a.pages);
}

function yearDay() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

function weekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - start) / 86400000);
  return Math.ceil((days + start.getDay() + 1) / 7);
}

/* --------------------------------------------------------------------------
   4. قوالب مشتركة
   -------------------------------------------------------------------------- */
function coverHTML(book) {
  return `
    <div class="cover" style="background:linear-gradient(150deg, ${book.c1}, ${book.c2})">
      <span class="cover-frame" aria-hidden="true"></span>
      <div class="cover-kicker">نادي جليس</div>
      <div>
        <div class="cover-mark">ج</div>
        <div class="cover-title">${esc(book.title)}</div>
        <div class="cover-author">${esc(book.author)}</div>
      </div>
    </div>`;
}

function avatarHTML(name, color, cls = 'avatar-mini') {
  return `<span class="${cls}" style="background:linear-gradient(135deg, ${color}, #14291D)">${esc(initials(name))}</span>`;
}

function memberRowHTML(member, rank, options = {}) {
  const me = member.isMe ? ' is-me' : '';
  const top = rank <= 3 ? ' is-top' : '';
  const max = options.max || Math.max(1, ...allMembers().map((m) => m.pages));
  const bar = options.bar
    ? `<div class="board-bar"><span style="width:${Math.round((member.pages / max) * 100)}%"></span></div>`
    : '';
  return `
    <div class="board-row${me}${top}">
      <span class="board-rank">${toAr(rank)}</span>
      ${avatarHTML(member.name, member.color, 'board-avatar')}
      <div class="board-info">
        <strong>${esc(member.name)}${member.isMe ? ' · أنت' : ''}</strong>
        <span>${member.isMe ? 'وردك هذا الأسبوع' : esc(member.role)}</span>
        ${bar}
      </div>
      <div class="board-pages"><strong>${toAr(member.pages)}</strong><span>صفحة</span></div>
    </div>`;
}

function emptyHTML(icon, title, text) {
  return `
    <div class="empty">
      <svg class="ic"><use href="#i-${icon}"/></svg>
      <h4>${esc(title)}</h4>
      <p>${esc(text)}</p>
    </div>`;
}

function miniStatHTML(value, label, note) {
  return `<div class="mini-stat"><strong>${toAr(value)}</strong><span>${esc(label)}</span>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
}

/* --------------------------------------------------------------------------
   5. الرئيسية
   -------------------------------------------------------------------------- */
function renderHome() {
  const firstName = state.profile.name.trim().split(/\s+/)[0] || 'عضو جليس';

  $('#today-label').textContent = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-arab', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());
  $('#home-first-name').textContent = firstName;

  const me = allMembers('week').find((member) => member.isMe);
  const board = allMembers('week').slice(0, 3)
    .map((member, index) => memberRowHTML(member, index + 1))
    .join('');
  $('#home-board').innerHTML = board || emptyHTML('users', 'لا قراءات بعد', 'كن أول من يسجّل ورداً هذا الأسبوع.');

  $('#home-books').innerHTML = BOOKS.filter((book) => book.pick).slice(0, 4).map((book) => `
    <button class="book-mini" type="button" data-action="book" data-id="${book.id}" aria-label="${esc(book.title)}">
      ${coverHTML(book)}
      <h4>${esc(book.title)}</h4>
      <p>${esc(book.author)}</p>
    </button>`).join('');

  const quote = state.quotes[yearDay() % Math.max(1, state.quotes.length)];
  $('#home-quote').innerHTML = quote ? `
    <p class="dq-text">${esc(quote.text)}</p>
    <div class="dq-source">${esc(quote.book || 'من هامش القراءة')}${quote.page ? ` · ص ${esc(quote.page)}` : ''}</div>
    <div class="dq-author">
      ${avatarHTML(authorNameOf(quote), authorColorOf(quote))}
      <span>${esc(authorNameOf(quote))}${isMine(quote) ? ' · أنت' : ''}</span>
    </div>` : '';

  const article = state.articles[0];
  $('#home-article').innerHTML = article ? `
    <div class="ha-thumb"><svg class="ic"><use href="#i-article"/></svg></div>
    <div class="ha-body">
      <span class="chip chip-soft">${esc(article.category)}</span>
      <h4>${esc(article.title)}</h4>
      <div class="ha-meta"><b>${esc(authorNameOf(article))}</b><span>·</span><span>${toAr(article.read || 3)} دقائق قراءة</span></div>
    </div>` : emptyHTML('article', 'لا مقالات بعد', 'شارك أول مقال في مساحة الأعضاء.');
  $('#home-article').dataset.action = article ? 'open-article' : '';
  if (article) $('#home-article').dataset.id = article.id;

  const attendees = 13 + (state.rsvp ? 1 : 0);
  $('#meeting-attendees').innerHTML = `<strong>${toAr(attendees)}</strong> عضواً أكدوا الحضور`;

  updateHeaderAvatar();
}

/* --------------------------------------------------------------------------
   6. القراءات — السجل ولوحة الأعضاء
   -------------------------------------------------------------------------- */
function renderReadings() {
  const stats = weekStats();
  const goal = Number(state.profile.goal) || 200;
  const remaining = Math.max(0, goal - stats.pages);
  const percent = Math.round(clamp(stats.pages / goal, 0, 1) * 100);
  const streak = streakDays();

  $('#readings-week-badge').textContent = `الأسبوع ${toAr(weekNumber())}`;
  $('#log-stats').innerHTML = [
    miniStatHTML(stats.pages, 'صفحة هذا الأسبوع', `٪${toAr(percent)} من هدفك`),
    miniStatHTML(stats.sessions, 'جلسة قراءة', `${toAr(streak)} ${streak === 1 ? 'يوم' : 'أيام'} متتالية`),
    miniStatHTML(remaining, 'صفحة متبقية', `هدفك ${toAr(goal)} صفحة`)
  ].join('');

  renderLogStamp();
  renderBookOptions();
  renderWeekChart(stats);
  renderEntries(stats);
  renderBoard();
}

function renderLogStamp() {
  const now = new Date();
  const dateEl = $('#log-stamp-date');
  const timeEl = $('#log-stamp-time');
  if (dateEl) {
    dateEl.textContent = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-arab', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(now);
  }
  if (timeEl) {
    timeEl.textContent = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-arab', {
      hour: 'numeric', minute: '2-digit'
    }).format(now);
  }
}

function timeLabel(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('ar-u-ca-gregory-nu-arab', {
    hour: 'numeric', minute: '2-digit'
  }).format(new Date(ts));
}

function renderBookOptions() {
  const list = $('#log-book-list');
  if (!list) return;
  const mine = state.myBooks.map((item) => ({
    book: getBook(item.bookId),
    status: item.status
  })).filter((item) => item.book);
  mine.sort((a, b) => (a.status === 'reading' ? -1 : 1) - (b.status === 'reading' ? -1 : 1));

  const mineIds = new Set(mine.map((item) => item.book.id));
  const rest = BOOKS.filter((book) => !mineIds.has(book.id));

  list.innerHTML = [
    ...mine.map((item) => `<option value="${esc(item.book.title)}">${esc(item.book.author)}${item.status === 'reading' ? ' · أقرأه الآن' : ''}</option>`),
    ...rest.map((book) => `<option value="${esc(book.title)}">${esc(book.author)}</option>`)
  ].join('');
}

function renderWeekChart(stats) {
  const max = Math.max(10, ...stats.days.map((day) => day.pages));
  const today = toISO(new Date());
  $('#week-chart').innerHTML = stats.days.map((day) => {
    const height = day.pages ? Math.max(10, Math.round((day.pages / max) * 82)) : 5;
    const classes = ['chart-day'];
    if (day.pages) classes.push('has-value');
    if (day.date === today) classes.push('is-today');
    return `
      <div class="${classes.join(' ')}">
        <div class="chart-bar" style="height:${height}%">
          ${day.pages ? `<span class="chart-value">${toAr(day.pages)}</span>` : ''}
        </div>
        <span class="chart-label">${day.label}</span>
      </div>`;
  }).join('');
}

function renderEntries(stats) {
  const entries = weekEntries();
  $('#entries-count').textContent = entries.length
    ? `${toAr(entries.length)} ${entries.length === 1 ? 'جلسة' : 'جلسات'} · ${toAr(stats.pages)} صفحة`
    : 'لا توجد جلسات مسجّلة بعد';

  if (!entries.length) {
    $('#entries-list').innerHTML = emptyHTML('book', 'صفحة بيضاء تنتظرك', 'سجّل أول جلسة قراءة هذا الأسبوع وابدأ سلسلتك.');
    return;
  }

  $('#entries-list').innerHTML = entries.map((entry) => {
    const book = getBook(entry.bookId);
    const title = book ? book.title : (entry.bookTitle || 'قراءة حرة');
    const c1 = book ? book.c1 : '#24462F';
    const c2 = book ? book.c2 : '#3D5A4C';
    return `
      <article class="entry">
        <span class="entry-cover" style="background:linear-gradient(150deg, ${c1}, ${c2})">${esc(title.charAt(0))}</span>
        <div class="entry-body">
          <div class="entry-top">
            <h4>${esc(title)}</h4>
            <span>${dayLabel(entry.date)}${entry.ts ? ` · ${timeLabel(entry.ts)}` : ''}</span>
          </div>
          <div class="entry-meta"><span><b>${toAr(entry.pages)}</b> صفحة</span>${!book && entry.bookTitle ? '<span class="entry-free">قراءة حرة</span>' : ''}</div>
          ${entry.note ? `<p class="entry-note">${esc(entry.note)}</p>` : ''}
        </div>
        <button class="entry-del" type="button" data-action="del-entry" data-id="${entry.id}" aria-label="حذف السجل">
          <svg class="ic"><use href="#i-trash"/></svg>
        </button>
      </article>`;
  }).join('');
}

function podiumHTML(members) {
  const first = members[0];
  const second = members[1];
  const third = members[2];
  const column = (member, rank) => {
    if (!member) return '';
    return `
      <div class="podium-col ${rank === 1 ? 'is-first' : ''} ${member.isMe ? 'is-me' : ''}">
        ${rank === 1 ? '<span class="podium-crown"><svg class="ic"><use href="#i-trophy"/></svg></span>' : ''}
        <span class="podium-medal">${toAr(rank)}</span>
        ${avatarHTML(member.name, member.color, 'podium-avatar')}
        <span class="podium-name">${esc(member.name)}</span>
        <div class="podium-pages">${toAr(member.pages)}<span> صفحة</span></div>
        ${member.isMe ? '<span class="podium-you">أنت</span>' : ''}
      </div>`;
  };
  return [column(second, 2), column(first, 1), column(third, 3)].filter(Boolean).join('');
}

function renderBoard() {
  const period = state.boardPeriod;
  const members = allMembers(period);
  const total = members.reduce((sum, member) => sum + Number(member.pages || 0), 0);
  const max = Math.max(1, ...members.map((member) => member.pages));

  $('#board-total').textContent = toAr(total);
  $('#board-podium').innerHTML = podiumHTML(members);
  $('#board-list').innerHTML = members.slice(3).map((member, index) =>
    memberRowHTML(member, index + 4, { bar: true, max })
  ).join('') || emptyHTML('users', 'لا قراءات بعد', 'سجّل وردك لتظهر في اللوحة.');

  const percent = clamp(Math.round((total / CLUB_GOAL) * 100), 0, 100);
  $('#club-goal-bar').style.width = `${percent}%`;
  $('#club-goal-label').textContent = `${toAr(total)} / ${toAr(CLUB_GOAL)}`;
  $('#club-goal-note').textContent = total >= CLUB_GOAL
    ? 'اكتمل هدف النادي… أسبوع قرائي استثنائي.'
    : `بقي ${toAr(CLUB_GOAL - total)} صفحة ليكتمل هدف النادي هذا الأسبوع.`;

  $$('#period-seg button').forEach((button) => {
    const active = button.dataset.period === period;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

/* --------------------------------------------------------------------------
   7. الاقتباسات
   -------------------------------------------------------------------------- */
function quoteCardHTML(quote) {
  const liked = state.likedQuotes.includes(quote.id);
  const saved = state.savedQuotes.includes(quote.id);
  const name = authorNameOf(quote);
  const color = authorColorOf(quote);
  const likes = Number(quote.likes || 0) + (liked ? 1 : 0);
  return `
    <article class="quote-card">
      <p class="quote-text">${esc(quote.text)}</p>
      <div class="quote-source">${esc(quote.book || 'من هامش القراءة')}${quote.page ? `<span> · ص ${esc(quote.page)}</span>` : ''}</div>
      <div class="quote-foot">
        <div class="quote-author">
          ${avatarHTML(name, color)}
          <div><strong>${esc(name)}${isMine(quote) ? ' · أنت' : ''}</strong><small>${esc(quote.time || '')}</small></div>
        </div>
        <div class="quote-actions">
          <button type="button" data-action="like-quote" data-id="${quote.id}" class="${liked ? 'active' : ''}" aria-label="إعجاب">
            <svg class="ic"><use href="#i-heart"/></svg>${toAr(likes)}
          </button>
          <button type="button" data-action="save-quote" data-id="${quote.id}" class="${saved ? 'saved' : ''}" aria-label="حفظ الاقتباس">
            <svg class="ic"><use href="#i-bookmark"/></svg>
          </button>
          <button type="button" data-action="share-quote" data-id="${quote.id}" aria-label="مشاركة الاقتباس">
            <svg class="ic"><use href="#i-share"/></svg>
          </button>
        </div>
      </div>
    </article>`;
}

function renderQuotes() {
  const filter = state.quoteFilter;
  $$('#quote-filters button').forEach((button) => {
    const active = button.dataset.qfilter === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  let list = state.quotes;
  if (filter === 'mine') list = list.filter((quote) => isMine(quote));
  if (filter === 'saved') list = list.filter((quote) => state.savedQuotes.includes(quote.id));

  const labels = {
    all: ['فنجان قهوة وهامش', 'شارك أول اقتباس يوقفك عند كتاب.'],
    mine: ['لم تنشر اقتباساً بعد', 'اضغط «اقتبس» وشارك جملة من كتابك.'],
    saved: ['لا اقتباسات محفوظة', 'احفظ ما يلامسك لتعود إليه لاحقاً.']
  };

  $('#quotes-feed').innerHTML = list.length
    ? list.map(quoteCardHTML).join('')
    : emptyHTML('quote', labels[filter][0], labels[filter][1]);
}

/* --------------------------------------------------------------------------
   8. المكتبة ومكتبتي
   -------------------------------------------------------------------------- */
function renderLibrary() {
  renderCategoryChips();
  renderClubBooks();
  renderMyBooks();

  $$('#library-seg button').forEach((button) => {
    const active = button.dataset.lseg === `pane-${state.libraryPane}`;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $('#pane-club').hidden = state.libraryPane !== 'club';
  $('#pane-mine').hidden = state.libraryPane !== 'mine';
  $('#pane-club').classList.toggle('active', state.libraryPane === 'club');
  $('#pane-mine').classList.toggle('active', state.libraryPane === 'mine');

  $$('#my-filters button').forEach((button) => {
    const active = button.dataset.mfilter === state.myFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function renderCategoryChips() {
  const categories = ['all', ...Array.from(new Set(BOOKS.map((book) => book.category)))];
  $('#category-chips').innerHTML = categories.map((category) => {
    const active = state.libraryCategory === category;
    return `<button class="chip-filter ${active ? 'active' : ''}" type="button" data-category="${category}" aria-selected="${active}">${category === 'all' ? 'الكل' : esc(category)}</button>`;
  }).join('');
}

function renderClubBooks() {
  const query = state.libraryQuery.trim().toLowerCase();
  const list = BOOKS.filter((book) => {
    const matchesCategory = state.libraryCategory === 'all' || book.category === state.libraryCategory;
    const matchesQuery = !query || book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  const clubList = state.clubBooks.filter((book) => {
    const matchesCategory = state.libraryCategory === 'all' || book.category === state.libraryCategory;
    const matchesQuery = !query || book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const allBooks = [...clubList, ...list];

  $('#library-count-label').textContent = `كتب النادي · ${toAr(allBooks.length)}`;
  $('#club-books').innerHTML = allBooks.length ? allBooks.map((book) => {
    const inLibrary = Boolean(getMyBook(book.id));
    const isClubBook = !BOOKS.find((b) => b.id === book.id);
    return `
      <article class="lib-card" data-action="book" data-id="${book.id}">
        <div class="lib-cover-wrap">
          ${book.pick ? '<span class="lib-flag">مختار النادي</span>' : ''}
          ${isClubBook ? '<span class="lib-flag">مشاركة من عضو</span>' : ''}
          <button class="lib-more ${inLibrary ? 'added' : ''}" type="button" data-action="book-more" data-id="${book.id}" aria-label="أعرف أكثر عن الكتاب">
            <span class="lib-more-text">أعرف أكثر عن الكتاب</span>
          </button>
          ${book.coverImage
            ? `<img class="lib-cover-img" src="${book.coverImage}" alt="${esc(book.title)}">`
            : `<div class="lib-cover" style="background:linear-gradient(150deg, ${book.coverColor || book.c1 || '#1E3A2B'}, ${book.coverColor2 || book.c2 || '#3D5A4C'})">${esc(book.title.charAt(0))}</div>`}
        </div>
        <div class="lib-info">
          <h4>${esc(book.title)}</h4>
          <p>${esc(book.author)}</p>
          <div class="lib-meta">
            ${isClubBook ? `<span class="lib-added-by"><svg class="ic"><use href="#i-user"/></svg>${esc(book.memberName || 'عضو جليس')}</span>` : ''}
            <span class="lib-rating"><svg class="ic"><use href="#i-star"/></svg>${toAr(book.rating || 0)}</span>
            <span class="lib-avail ${book.available ? '' : 'out'}"><i></i>${book.available ? `${toAr(book.available)} نسخ` : 'قائمة انتظار'}</span>
          </div>
          ${book.report ? (book.report.length > 120
            ? `<p class="lib-report" data-short="${esc(book.report.substring(0, 120) + '…')}" data-full="${esc(book.report)}">${esc(book.report.substring(0, 120) + '…')}</p><span class="report-toggle" data-action="toggle-report">أعرف أكثر</span>`
            : `<p class="lib-report">${esc(book.report)}</p>`) : ''}
        </div>
      </article>`;
  }).join('') : emptyHTML('search', 'لا توجد نتائج', 'جرّب عنواناً آخر أو أزل تصفية التصنيف.');
}

function openAddBook() {
  openSheet(`
    ${sheetHead('إضافة كتاب لمكتبة النادي', 'أضف كتاباً تود مشاركته مع أعضاء جليس.')}
    <form id="add-book-form" novalidate>
      <div class="field">
        <label for="add-book-title">عنوان الكتاب <span class="label-opt">مطلوب</span></label>
        <input class="input" id="add-book-title" maxlength="120" placeholder="مثال: حياة في الإدارة" required>
      </div>
      <div class="field">
        <label for="add-book-author">المؤلف</label>
        <input class="input" id="add-book-author" maxlength="100" placeholder="مثال: غازي القصيبي">
      </div>
      <div class="field">
        <label for="add-book-category">التصنيف</label>
        <select class="input" id="add-book-category">
          <option>تطوير</option>
          <option>سيرة</option>
          <option>رواية</option>
          <option>فكر</option>
          <option>أدب</option>
          <option>تاريخ</option>
          <option>إدارة</option>
          <option>تجارب</option>
        </select>
      </div>
      <div class="field">
        <label for="add-book-report">تقرير عن الكتاب</label>
        <textarea class="input" id="add-book-report" rows="4" placeholder="اكتب تقريراً قصيراً عن الكتاب وماذا يحتوي…"></textarea>
      </div>
      <div class="field">
        <label for="add-book-pages">عدد الصفحات (اختياري)</label>
        <input class="input" id="add-book-pages" type="number" min="1" max="5000" placeholder="مثال: 320">
      </div>
      <div class="field">
        <label for="add-book-color">لون الغلاف (إذا لم تختر صورة)</label>
        <input class="input" id="add-book-color" type="color" value="#1E3A2B">
      </div>
      <div class="field">
        <label for="add-book-image">صورة غلاف الكتاب (اختياري)</label>
        <input class="input" id="add-book-image" type="file" accept="image/*">
        <div class="image-preview" id="image-preview" hidden></div>
      </div>
      <button class="btn btn-primary btn-block" type="submit">
        <svg class="ic"><use href="#i-plus"/></svg> إضافة الكتاب
      </button>
    </form>`, (root) => {
    const imageInput = root.querySelector('#add-book-image');
    const preview = root.querySelector('#image-preview');
    let imageData = null;

    imageInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        imageData = e.target.result;
        preview.innerHTML = `<img src="${imageData}" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:8px">`;
        preview.hidden = false;
      };
      reader.readAsDataURL(file);
    });

    root.querySelector('#add-book-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const title = root.querySelector('#add-book-title').value.trim();
      const author = root.querySelector('#add-book-author').value.trim() || 'مؤلف غير محدد';
      const category = root.querySelector('#add-book-category').value;
      const report = root.querySelector('#add-book-report').value.trim();
      const pages = Number(root.querySelector('#add-book-pages').value) || 0;
      const color = root.querySelector('#add-book-color').value;

      if (!title) {
        toast('يرجى إدخال عنوان الكتاب', 'info');
        return;
      }

      const newBook = {
        id: `club-${Date.now()}`,
        title,
        author,
        category,
        report,
        pages,
        coverColor: color,
        coverImage: imageData,
        coverColor2: '#14291D',
        createdAt: Date.now(),
        memberId: currentMember.id,
        memberName: state.profile.name,
        available: 1,
        rating: 0
      };

      state.clubBooks.unshift(newBook);
      saveState();
      closeSheet();
      renderClubBooks();
      renderHome();
      toast(`تمت إضافة «${title}» لمكتبة النادي`, 'book');
      celebrate();
    });
  });
}

/* إضافة كتاب خاص بمكتبتي — مستقل تماماً عن مكتبة النادي */
function openAddMyBook() {
  openSheet(`
    ${sheetHead('أضف كتاباً إلى مكتبتي', 'كتابك الخاص يظهر لك وحدك، ولا يُضاف إلى مكتبة النادي.')}
    <form id="add-my-book-form" novalidate>
      <div class="field">
        <label for="my-book-title">عنوان الكتاب <span class="label-opt">مطلوب</span></label>
        <input class="input" id="my-book-title" maxlength="120" placeholder="مثال: الخيميائي" required>
      </div>
      <div class="field">
        <label for="my-book-author">المؤلف</label>
        <input class="input" id="my-book-author" maxlength="100" placeholder="مثال: باولو كويلو">
      </div>
      <div class="field">
        <label for="my-book-pages">عدد الصفحات</label>
        <input class="input" id="my-book-pages" type="number" min="1" max="5000" placeholder="مثال: 208" required>
      </div>
      <div class="field">
        <label for="my-book-current">آخر صفحة وصلت إليها</label>
        <input class="input" id="my-book-current" type="number" min="0" max="5000" placeholder="0">
      </div>
      <div class="field">
        <label for="my-book-status">الحالة</label>
        <select class="input" id="my-book-status">
          <option value="reading">أقرأ الآن</option>
          <option value="want">أريد قراءتها</option>
          <option value="finished">أنهيتها</option>
        </select>
      </div>
      <div class="field">
        <label for="my-book-color">لون الغلاف</label>
        <input class="input" id="my-book-color" type="color" value="#1E3A2B">
      </div>
      <button class="btn btn-primary btn-block" type="submit">
        <svg class="ic"><use href="#i-plus"/></svg> أضف إلى مكتبتي
      </button>
    </form>`, (root) => {
    root.querySelector('#add-my-book-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const title = root.querySelector('#my-book-title').value.trim();
      const author = root.querySelector('#my-book-author').value.trim() || 'مؤلف غير محدد';
      const pages = Number(root.querySelector('#my-book-pages').value) || 0;
      const current = Number(root.querySelector('#my-book-current').value) || 0;
      const status = root.querySelector('#my-book-status').value;
      const color = root.querySelector('#my-book-color').value;

      if (!title) {
        toast('يرجى إدخال عنوان الكتاب', 'info');
        return;
      }
      if (!pages) {
        toast('يرجى إدخال عدد الصفحات', 'info');
        return;
      }

      const id = `my-${Date.now()}`;
      state.personalBooks.unshift({
        id,
        title,
        author,
        category: 'مكتبتي',
        pages,
        c1: color,
        c2: '#14291D',
        coverColor: color,
        rating: 0,
        available: 0
      });
      state.myBooks.push({
        bookId: id,
        status,
        currentPage: clamp(current, 0, pages)
      });

      state.myFilter = status;
      saveState();
      closeSheet();
      renderLibrary();
      renderHome();
      renderProfile();
      toast(`أُضيف «${title}» إلى مكتبتك`, 'book');
      celebrate();
    });
  });
}

const STATUS_LABEL = {
  reading: 'أقرأ الآن',
  want: 'أريد قراءتها',
  finished: 'أنهيتها'
};

function renderMyBooks() {
  const counts = { reading: 0, want: 0, finished: 0 };
  state.myBooks.forEach((item) => { counts[item.status] = (counts[item.status] || 0) + 1; });
  const stats = weekStats();

  $('#my-summary').innerHTML = `
    <div class="rs-item"><strong>${toAr(counts.reading)}</strong><span>أقرأ الآن</span></div>
    <div class="rs-item"><strong>${toAr(counts.finished)}</strong><span>أنهيتها</span></div>
    <div class="rs-item"><strong>${toAr(stats.pages)}</strong><span>صفحة هذا الأسبوع</span></div>`;

  const list = state.myBooks.filter((item) => item.status === state.myFilter);
  if (!list.length) {
    const messages = {
      reading: ['لا كتاب مفتوح الآن', 'اختر كتاباً من مكتبة النادي وابدأ القراءة.'],
      want: ['قائمة الأمنيات فارغة', 'أضف ما تنوي قراءته من مكتبة النادي.'],
      finished: ['لم تُنهِ كتاباً بعد', 'كل كتاب تنهيه سيظهر هنا كوسام.']
    };
    $('#my-books').innerHTML = emptyHTML('book', messages[state.myFilter][0], messages[state.myFilter][1]);
    return;
  }

  $('#my-books').innerHTML = list.map((item) => {
    const book = getBook(item.bookId);
    if (!book) return '';
    const percent = clamp(Math.round((Number(item.currentPage) / book.pages) * 100), 0, 100);
    const progress = item.status === 'reading' ? `
      <div class="my-progress">
        <div class="my-progress-head">
          <span>${toAr(item.currentPage)} من ${toAr(book.pages)} صفحة</span>
          <b>٪${toAr(percent)}</b>
        </div>
        <input type="range" min="0" max="${book.pages}" step="1" value="${item.currentPage}" data-progress="${book.id}" style="--p:${percent}%" aria-label="تقدم قراءة ${esc(book.title)}">
      </div>
      <div class="page-entry">
        <label for="page-input-${book.id}">آخر صفحة وصلت إليها</label>
        <div class="page-entry-row">
          <input class="input page-input" id="page-input-${book.id}" type="number" inputmode="numeric" min="0" max="${book.pages}" step="1" value="${item.currentPage}" data-pageinput="${book.id}" aria-label="اكتب آخر صفحة وصلت إليها في ${esc(book.title)}">
          <span class="page-total">من ${toAr(book.pages)}</span>
          <button class="btn btn-primary page-save" type="button" data-action="save-page" data-id="${book.id}">حفظ</button>
        </div>
      </div>` : '';
    const finished = item.status === 'finished'
      ? '<div class="my-finished-note">أتممت القراءة · ٪١٠٠</div>'
      : '';
    const want = item.status === 'want'
      ? `<button class="btn btn-sm btn-ghost" type="button" data-action="start-book" data-id="${book.id}" style="margin-top:8px">ابدأ القراءة</button>`
      : '';
    return `
      <article class="my-book">
        <div class="my-book-cover" style="background:linear-gradient(150deg, ${book.c1}, ${book.c2})">${esc(book.title)}</div>
        <div class="my-book-body">
          <div class="my-book-top">
            <h4>${esc(book.title)}</h4>
            <span>${esc(book.author)}</span>
          </div>
          <span class="my-status ${item.status}">${STATUS_LABEL[item.status]}</span>
          ${progress}${finished}${want}
        </div>
      </article>`;
  }).join('');
}

/* --------------------------------------------------------------------------
   9. مقالات الأعضاء
   -------------------------------------------------------------------------- */
function renderArticles() {
  const featured = state.articles[0];
  if (!featured) {
    $('#featured-article').innerHTML = emptyHTML('article', 'مساحة القلم', 'اكتب أول مقال لأعضاء جليس.');
    $('#featured-article').removeAttribute('data-action');
    $('#articles-list').innerHTML = '';
    renderArticleFilters();
    return;
  }

  $('#featured-article').dataset.action = 'open-article';
  $('#featured-article').dataset.id = featured.id;
  $('#featured-article').innerHTML = `
    <div class="fa-top">
      <span class="chip fa-cat">${esc(featured.category)}</span>
      <span class="fa-read">${toAr(featured.read || 3)} دقائق قراءة</span>
    </div>
    <h3>${esc(featured.title)}</h3>
    <p>${esc(featured.excerpt)}</p>
    <div class="fa-foot">
      <div class="fa-author">
        ${avatarHTML(authorNameOf(featured), authorColorOf(featured))}
        <div><strong>${esc(authorNameOf(featured))}</strong><small>${esc(featured.time || '')}</small></div>
      </div>
      <span class="fa-more">اقرأ المقال <svg class="ic"><use href="#i-arrow-right"/></svg></span>
    </div>`;

  const rest = state.articles.slice(1);
  const filtered = rest.filter((article) => {
    if (state.articleFilter === 'saved' && !state.savedArticles.includes(article.id)) return false;
    const cat = state.articleCategory || ARTICLE_CATEGORIES[0];
    if (cat !== ARTICLE_CATEGORIES[0] && cat !== 'all' && article.category !== cat) return false;
    return true;
  });

  $('#articles-list').innerHTML = filtered.length ? filtered.map((article, index) => {
    const saved = state.savedArticles.includes(article.id);
    return `
      <article class="article-row" data-action="open-article" data-id="${article.id}">
        <span class="ar-num">${toAr(index + 1)}</span>
        <div class="ar-body">
          <span class="chip chip-soft">${esc(article.category)}</span>
          <h4>${esc(article.title)}</h4>
          <div class="ar-meta"><b>${esc(authorNameOf(article))}</b><span>·</span><span>${toAr(article.read || 3)} دقائق</span></div>
        </div>
        <div class="ar-actions">
          <button class="ar-save ${saved ? 'saved' : ''}" type="button" data-action="save-article" data-id="${article.id}" aria-label="حفظ المقال">
            <svg class="ic"><use href="#i-bookmark"/></svg>
          </button>
        </div>
      </article>`;
  }).join('') : emptyHTML('article', 'لا مقالات متاحة', 'جرّب تصنيفاً آخر أو اكتب أول مقال.');
  renderArticleFilters();
}

function renderArticleFilters() {
  const container = $('#article-filters');
  if (!container) return;
  $$('#article-filters button').forEach((button) => {
    const active = button.dataset.afilter === state.articleFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const catContainer = $('#article-categories');
  if (!catContainer) return;

  const articleCats = new Set(state.articles.map((a) => a.category));

  const search = (state.articleCategorySearch || '').trim().toLowerCase();
  const visibleCats = ARTICLE_CATEGORIES.filter((c) =>
    c.toLowerCase().includes(search)
  );

  catContainer.innerHTML = `
    <div class="category-search">
      <svg class="ic"><use href="#i-search"/></svg>
      <input class="input" id="article-category-search" type="search"
        placeholder="ابحث عن تصنيف…" value="${esc(state.articleCategorySearch || '')}"
        aria-label="ابحث عن تصنيف">
    </div>
    <span class="eyebrow">التصنيفات العامة</span>
  ` + visibleCats.map((category, index) => {
    const active = state.articleCategory === category;
    const hasArticles = articleCats.has(category);
    const isAll = index === 0;
    return `<button class="chip-filter ${active ? 'active' : ''}${hasArticles ? '' : ' cat-empty'}" type="button" data-acat="${category}" aria-selected="${active}">
      ${esc(category)}${isAll || hasArticles ? '' : ' <span class="cat-count">—</span>'}</button>`;
  }).join('');
}

/* --------------------------------------------------------------------------
   10. الملف الشخصي
   -------------------------------------------------------------------------- */
function renderProfile() {
  const finished = state.myBooks.filter((item) => item.status === 'finished').length;
  const stats = weekStats();
  const myQuotes = state.quotes.filter((quote) => isMine(quote)).length;
  const myArticles = state.articles.filter((article) => isMine(article)).length;
  const streak = streakDays();

  $('#profile-name').textContent = state.profile.name;
  $('#profile-role').textContent = `${state.profile.role} · منذ ${state.profile.joined}`;
  $('#profile-avatar').textContent = initials(state.profile.name);
  $('#profile-badges').innerHTML = [
    `<span><svg class="ic"><use href="#i-sparkles"/></svg> قارئ نشط</span>`,
    streak ? `<span><svg class="ic"><use href="#i-flame"/></svg> ${toAr(streak)} أيام متتالية</span>` : '',
    finished ? `<span><svg class="ic"><use href="#i-star"/></svg> ${toAr(finished)} كتب مكتملة</span>` : '',
    `<span><svg class="ic"><use href="#i-users"/></svg> عضو منذ ${esc(state.profile.joined)}</span>`
  ].join('');

  $('#profile-stats').innerHTML = `
    <div class="ps-item"><strong>${toAr(finished)}</strong><span>كتاب مكتمل</span></div>
    <div class="ps-item"><strong>${toAr(stats.pages)}</strong><span>صفحة الأسبوع</span></div>
    <div class="ps-item"><strong>${toAr(myQuotes)}</strong><span>اقتباس</span></div>
    <div class="ps-item"><strong>${toAr(myArticles)}</strong><span>مقال</span></div>`;

  const goal = Number(state.profile.goal) || 200;
  const range = $('#goal-range');
  range.value = clamp(goal, 50, 500);
  range.style.setProperty('--p', `${((range.value - 50) / 450) * 100}%`);
  $('#goal-output').textContent = toAr(goal);
  $('#notif-toggle').checked = Boolean(state.profile.notifications);

  updateHeaderAvatar();
}

function updateHeaderAvatar() {
  const avatar = $('#header-avatar');
  if (avatar) {
    avatar.textContent = initials(state.profile.name);
    avatar.title = state.profile.name;
  }
}

/* --------------------------------------------------------------------------
   11. النوافذ السفلية والتنبيهات
   -------------------------------------------------------------------------- */
let toastTimer = null;

function toast(message, icon = 'sparkles') {
  const el = $('#toast');
  el.innerHTML = `<svg class="ic"><use href="#i-${icon}"/></svg><span>${esc(message)}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = $('#confetti');
  const colors = ['#C59B63', '#2A4F3B', '#A3503B', '#D6B27C', '#1E3A2B'];
  for (let i = 0; i < 26; i += 1) {
    const bit = document.createElement('span');
    bit.className = 'confetti-bit';
    bit.style.left = `${8 + Math.random() * 84}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty('--dx', `${(Math.random() - 0.5) * 190}px`);
    bit.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    bit.style.animationDelay = `${Math.random() * 0.3}s`;
    bit.style.opacity = '0.95';
    layer.appendChild(bit);
  }
  setTimeout(() => { layer.innerHTML = ''; }, 2200);
}

function sheetHead(title, subtitle = '') {
  return `
    <div class="sheet-head">
      <div>
        <h2>${esc(title)}</h2>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      </div>
      <button class="sheet-close" type="button" data-close-sheet aria-label="إغلاق">
        <svg class="ic"><use href="#i-close"/></svg>
      </button>
    </div>`;
}

function openSheet(html, onOpen) {
  const root = $('#sheet-root');
  root.innerHTML = `
    <div class="sheet-backdrop" data-close-sheet></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-grabber" aria-hidden="true"></div>
      ${html}
    </div>`;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  setTimeout(() => {
    const first = root.querySelector('.sheet textarea, .sheet input:not([type="range"]):not([type="checkbox"]), .sheet select');
    if (first) first.focus({ preventScroll: true });
  }, 260);
  if (typeof onOpen === 'function') onOpen(root);
}

function closeSheet() {
  const root = $('#sheet-root');
  root.classList.remove('open');
  setTimeout(() => {
    if (!root.classList.contains('open')) {
      root.hidden = true;
      root.innerHTML = '';
    }
  }, 320);
}

function openConfirm({ title, text, confirmLabel = 'تأكيد', danger = true, onConfirm }) {
  openSheet(`
    ${sheetHead(title)}
    <p style="font-size:11.5px;line-height:1.95;color:var(--muted);margin-bottom:4px">${esc(text)}</p>
    <div class="confirm-actions">
      <button class="btn btn-ghost" type="button" data-close-sheet>إلغاء</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" id="confirm-action">${esc(confirmLabel)}</button>
    </div>`, (root) => {
    root.querySelector('#confirm-action').addEventListener('click', () => {
      closeSheet();
      setTimeout(onConfirm, 120);
    });
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      return true;
    } catch (err) {
      return false;
    }
  }
}

/* --------------------------------------------------------------------------
   12. نوافذ المحتوى
   -------------------------------------------------------------------------- */
function openBookSheet(id) {
  const book = getBook(id) || state.clubBooks.find((b) => b.id === id);
  if (!book) return;
  const mine = getMyBook(id);
  const status = mine ? STATUS_LABEL[mine.status] : '';
  const progress = mine && mine.status === 'reading'
    ? `<div class="my-progress" style="margin-top:10px"><div class="my-progress-head"><span>${toAr(mine.currentPage)} من ${toAr(book.pages)} صفحة</span><b>٪${toAr(Math.round((mine.currentPage / book.pages) * 100))}</b></div><div class="progress" style="margin:5px 0 0"><span style="width:${(mine.currentPage / book.pages) * 100}%"></span></div></div>`
    : '';

  const actions = mine
    ? `
      <button class="btn btn-primary btn-block" type="button" data-action="go-my-library">الانتقال إلى مكتبتي</button>
      <button class="btn btn-ghost" type="button" data-action="start-book" data-id="${book.id}">${mine.status === 'finished' ? 'أعد القراءة' : 'أكمل القراءة'}</button>
      <button class="btn btn-danger" type="button" data-action="remove-book" data-id="${book.id}">إزالة</button>`
    : `
      <button class="btn btn-primary" type="button" data-action="add-book" data-id="${book.id}" data-status="reading">أقرأ الآن</button>
      <button class="btn btn-ghost" type="button" data-action="add-book" data-id="${book.id}" data-status="want">أريد قراءتها</button>`;

  openSheet(`
    ${sheetHead('من مكتبة النادي', book.pick ? 'مختار النادي لهذا الشهر' : '')}
    <div class="book-sheet-top">
      <div class="book-sheet-cover" style="background:linear-gradient(150deg, ${book.coverColor || book.c1 || '#1E3A2B'}, ${book.coverColor2 || book.c2 || '#3D5A4C'})">${esc(book.title.charAt(0))}</div>
      <div class="book-sheet-info">
        <span class="chip chip-soft">${esc(book.category)}</span>
        <h2>${esc(book.title)}</h2>
        <p class="author">${esc(book.author)}</p>
        <div class="book-sheet-meta">
          ${book.memberName ? `<span class="lib-added-by"><svg class="ic"><use href="#i-user"/></svg>${esc(book.memberName)}</span>` : ''}
          <span><svg class="ic"><use href="#i-star"/></svg> ${toAr(book.rating || 0)}</span>
          <span><svg class="ic"><use href="#i-book"/></svg> ${toAr(book.pages || 0)} صفحة</span>
          <span><svg class="ic"><use href="#i-calendar"/></svg> ${book.available ? `${toAr(book.available)} نسخة متاحة` : 'قائمة انتظار'}</span>
        </div>
        ${book.report ? `<p class="lib-report">${esc(book.report)}</p>` : ''}
        ${mine ? `<span class="my-status ${mine.status}" style="margin-top:9px">${status}</span>${progress}` : ''}
      </div>
    </div>
    <div class="book-sheet-actions">${actions}</div>
  `);
}

function openQuoteComposer() {
  openSheet(`
    ${sheetHead('اقتبس ما ألهمك', 'جملة واحدة قد تفتح باباً لكتاب كامل.')}
    <form id="quote-form" novalidate>
      <div class="field">
        <label for="quote-text">نص الاقتباس</label>
        <textarea class="input" id="quote-text" rows="4" maxlength="400" placeholder="اكتب الجملة التي توقفت عندها…" required></textarea>
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="quote-book">الكتاب</label>
          <input class="input" id="quote-book" list="quote-books" maxlength="80" placeholder="اسم الكتاب">
          <datalist id="quote-books">${BOOKS.map((book) => `<option value="${esc(book.title)}"></option>`).join('')}</datalist>
        </div>
        <div class="field">
          <label for="quote-page">الصفحة</label>
          <input class="input" id="quote-page" inputmode="numeric" maxlength="8" placeholder="اختياري">
        </div>
      </div>
      <div class="quote-preview-label"><svg class="ic"><use href="#i-quote"/></svg> معاينة الاقتباس</div>
      <div class="quote-preview">
        <p id="quote-preview-text" class="is-empty">سيظهر اقتباسك هنا…</p>
        <span id="quote-preview-source">—</span>
      </div>
      <button class="btn btn-gold btn-block" type="submit">
        <svg class="ic"><use href="#i-send"/></svg> انشر الاقتباس
      </button>
    </form>`, (root) => {
    const text = root.querySelector('#quote-text');
    const book = root.querySelector('#quote-book');
    const page = root.querySelector('#quote-page');
    const preview = root.querySelector('#quote-preview-text');
    const source = root.querySelector('#quote-preview-source');

    const update = () => {
      const value = text.value.trim();
      preview.textContent = value || 'سيظهر اقتباسك هنا…';
      preview.classList.toggle('is-empty', !value);
      source.textContent = [book.value.trim() || 'هامش الكتاب', page.value.trim() ? `ص ${page.value.trim()}` : '', state.profile.name]
        .filter(Boolean).join(' · ');
    };
    [text, book, page].forEach((field) => field.addEventListener('input', update));
    update();

    root.querySelector('#quote-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = text.value.trim();
      if (value.length < 4) {
        toast('اكتب اقتباساً أطول قليلاً', 'info');
        text.focus();
        return;
      }
      const newQuote = {
        id: `q-${Date.now()}`,
        text: value,
        book: book.value.trim() || 'من هامش القراءة',
        page: page.value.trim(),
        authorId: 'me',
        authorName: state.profile.name,
        color: '#C59B63',
        time: 'الآن',
        likes: 0,
        createdAt: Date.now()
      };
      state.quotes = mergeQuoteLists([newQuote], state.quotes);
      saveLocalSharedQuotes(state.quotes);
      state.quoteFilter = 'all';
      saveState();
      saveQuoteToSheet(newQuote).then(() => syncQuotesFromSheet());
      closeSheet();
      renderQuotes();
      renderHome();
      toast('نُشر اقتباسك وسُجّل في الشيت السحابي', 'quote');
      celebrate();
    });
  });
}

function openArticleSheet(id) {
  const article = state.articles.find((item) => item.id === id);
  if (!article) return;
  const saved = state.savedArticles.includes(article.id);
  const body = article.body.split(/\n{2,}/).map((paragraph) => `<p>${esc(paragraph).replace(/\n/g, '<br>')}</p>`).join('');

  openSheet(`
    <div class="article-reader">
      <div class="sheet-head">
        <span class="chip chip-soft">${esc(article.category)}</span>
        <button class="sheet-close" type="button" data-close-sheet aria-label="إغلاق">
          <svg class="ic"><use href="#i-close"/></svg>
        </button>
      </div>
      <h2 class="reader-title">${esc(article.title)}</h2>
      <div class="reader-meta">
        <span><svg class="ic"><use href="#i-clock"/></svg> ${toAr(article.read || 3)} دقائق قراءة</span>
        <span><svg class="ic"><use href="#i-article"/></svg> ${esc(article.category)}</span>
        <span><svg class="ic"><use href="#i-calendar"/></svg> ${esc(article.time || '')}</span>
      </div>
      <div class="reader-author">
        ${avatarHTML(authorNameOf(article), authorColorOf(article))}
        <div>
          <strong>${esc(authorNameOf(article))}</strong>
          <small>عضو في نادي جليس القرائي</small>
        </div>
      </div>
      <div class="reader-body">${body}</div>
      <div class="reader-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-action="save-article" data-id="${article.id}">
          <svg class="ic"><use href="#i-bookmark"/></svg> ${saved ? 'محفوظ' : 'حفظ المقال'}
        </button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="share-article" data-id="${article.id}">
          <svg class="ic"><use href="#i-share"/></svg> مشاركة
        </button>
      </div>
    </div>`);
}

function openArticleComposer() {
  openSheet(`
    ${sheetHead('اكتب مقالاً', 'شارك تجربة قراءة، فكرة، أو خاطرة من هامش كتابك.')}
    <form id="article-form" novalidate>
      <div class="field">
        <label for="article-title">عنوان المقال</label>
        <input class="input" id="article-title" maxlength="120" placeholder="عنوان يفتح الشهية للقراءة…" required>
      </div>
      <div class="field">
        <label for="article-category">التصنيف</label>
        <select class="input" id="article-category">
          <option>قراءة</option>
          <option>تجارب</option>
          <option>فكر</option>
          <option>رواية</option>
          <option>النادي</option>
        </select>
      </div>
      <div class="field">
        <label for="article-body">نص المقال</label>
        <textarea class="input" id="article-body" rows="8" maxlength="6000" placeholder="اكتب هنا… اترك سطراً فارغاً بين الفقرات." required></textarea>
      </div>
      <button class="btn btn-gold btn-block" type="submit">
        <svg class="ic"><use href="#i-send"/></svg> انشر المقال
      </button>
    </form>`, (root) => {
    root.querySelector('#article-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const title = root.querySelector('#article-title').value.trim();
      const category = root.querySelector('#article-category').value;
      const body = root.querySelector('#article-body').value.trim();
      if (title.length < 4) {
        toast('العنوان قصير جداً', 'info');
        return;
      }
      if (body.length < 30) {
        toast('اكتب فقرة أطول قليلاً', 'info');
        return;
      }
      const words = body.split(/\s+/).filter(Boolean).length;
      const excerpt = body.replace(/\s+/g, ' ').slice(0, 118).trim();
      state.articles.unshift({
        id: `a-${Date.now()}`,
        title,
        category,
        body,
        excerpt: `${excerpt}${body.length > 118 ? '…' : ''}`,
        authorId: 'me',
        authorName: state.profile.name,
        color: '#C59B63',
        time: 'الآن',
        read: Math.max(1, Math.ceil(words / 180))
      });
      saveState();
      closeSheet();
      renderArticles();
      renderHome();
      renderProfile();
      go('articles');
      toast('نُشر مقالك في مساحة الأعضاء', 'article');
      celebrate();
    });
  });
}

function openNotificationsSheet() {
  openSheet(`
    ${sheetHead('التنبيهات', 'آخر ما يحدث في مجلس جليس')}
    <div class="notif-list">
      <div class="notif-item">
        <span class="notif-icon"><svg class="ic"><use href="#i-calendar"/></svg></span>
        <div class="notif-body"><strong>جلسة الأسبوع</strong><p>مناقشة كتاب «ابني حبيبي» الثلاثاء القادم، ٨:٠٠ م.</p><small>قبل ساعة</small></div>
      </div>
      <div class="notif-item">
        <span class="notif-icon"><svg class="ic"><use href="#i-heart"/></svg></span>
        <div class="notif-body"><strong>اقتباسك أعجب الأعضاء</strong><p>حصل اقتباسك عن «وحي القلم» على ١٢ إعجاباً.</p><small>أمس</small></div>
      </div>
      <div class="notif-item">
        <span class="notif-icon"><svg class="ic"><use href="#i-book"/></svg></span>
        <div class="notif-body"><strong>كتاب جديد في المكتبة</strong><p>أضيف «موسم الهجرة إلى الشمال» إلى رفوف النادي.</p><small>قبل يومين</small></div>
      </div>
    </div>`);
}

function openMeetingSheet() {
  const attendees = 13 + (state.rsvp ? 1 : 0);
  openSheet(`
    ${sheetHead('جلسة الأسبوع', 'لقاء أعضاء جليس الشهري')}
    <div class="meeting-date" style="width:100%;height:auto;flex-direction:row;gap:10px;padding:12px;border-radius:14px">
      <strong style="font-size:26px">١٦</strong>
      <span style="font-size:10px;color:var(--gold)">ربيع أول · الثلاثاء · ٨:٠٠ م</span>
    </div>
    <h2 style="font-size:19px;font-weight:800;color:var(--green-700);margin:14px 0 4px">مناقشة كتاب: ابني حبيبي</h2>
    <p style="font-size:11px;color:var(--muted);line-height:1.9">قواعد نبوية لتربية الأبناء… جلسة حوارية يديرها أحد أعضاء النادي، والحضور مفتوح لأعضاء جليس.</p>
    <div style="display:grid;gap:7px;margin:14px 0;padding:13px;border-radius:14px;background:var(--white);border:1px solid var(--line)">
      <span style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--muted)"><svg class="ic" style="width:14px;height:14px;color:var(--gold-700)"><use href="#i-pin"/></svg> جمعية التنمية الأهلية بالمريداسية</span>
      <span style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--muted)"><svg class="ic" style="width:14px;height:14px;color:var(--gold-700)"><use href="#i-users"/></svg> <b id="meeting-attendees-sheet" style="color:var(--green-600)">${toAr(attendees)}</b> عضواً أكدوا الحضور</span>
    </div>
    <button class="btn ${state.rsvp ? 'btn-primary' : 'btn-gold'} btn-block" type="button" id="meeting-rsvp">
      <svg class="ic"><use href="#i-${state.rsvp ? 'check' : 'calendar'}"/></svg>
      ${state.rsvp ? 'حضورك مؤكد — نراك هناك' : 'أؤكد الحضور'}
    </button>`);
}

/* --------------------------------------------------------------------------
   13. عمليات المكتبة
   -------------------------------------------------------------------------- */
function addMyBook(bookId, status) {
  if (!getBook(bookId)) return;
  if (getMyBook(bookId)) return;
  state.myBooks.unshift({
    bookId,
    status: status === 'want' ? 'want' : 'reading',
    currentPage: 0,
    addedAt: toISO(new Date())
  });
  saveState();
}

function startBook(bookId) {
  const book = getBook(bookId);
  const item = getMyBook(bookId);
  if (!book) return;
  if (!item) {
    addMyBook(bookId, 'reading');
  } else {
    item.status = 'reading';
    if (Number(item.currentPage) >= book.pages) item.currentPage = 0;
    saveState();
  }
  closeSheet();
  state.libraryPane = 'mine';
  state.myFilter = 'reading';
  saveState();
  renderLibrary();
  renderHome();
  renderProfile();
  toast('الكتاب بين يديك الآن… قراءة ممتعة', 'book');
}

function commitProgress(bookId, value) {
  const book = getBook(bookId);
  const item = getMyBook(bookId);
  if (!book || !item) return;
  item.currentPage = clamp(Number(value) || 0, 0, book.pages);
  let completed = false;
  if (item.currentPage >= book.pages) {
    if (item.status !== 'finished') completed = true;
    item.status = 'finished';
    item.currentPage = book.pages;
  } else if (item.status === 'finished') {
    item.status = 'reading';
  }
  saveState();
  renderMyBooks();
  renderHome();
  renderProfile();
  if (completed) {
    toast(`أتممت «${book.title}»… مبارك!`, 'trophy');
    celebrate();
  }
}

/* --------------------------------------------------------------------------
   14. التنقل وتسجيل الدخول
   -------------------------------------------------------------------------- */
let currentScreen = 'home';
let profileReturn = 'home';

function go(name) {
  const allowed = ['home', 'readings', 'quotes', 'library', 'articles', 'profile'];
  if (!allowed.includes(name)) name = 'home';
  currentScreen = name;

  $$('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.dataset.screen === name);
  });
  $$('.tab').forEach((tab) => {
    const active = tab.dataset.nav === name;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });

  $('#app-main').scrollTop = 0;

  if (name === 'home') renderHome();
  if (name === 'readings') renderReadings();
  if (name === 'quotes') {
    renderQuotes();
    /* جلب دوري خفيف من الشيت حتى تنعكس الإضافات والحذفات السحابية */
    const now = Date.now();
    if (now - lastQuoteSyncAt > 30000) {
      lastQuoteSyncAt = now;
      syncQuotesFromSheet();
    }
  }
  if (name === 'library') renderLibrary();
  if (name === 'articles') renderArticles();
  if (name === 'profile') renderProfile();
}

function renderAll() {
  renderHome();
  renderReadings();
  renderQuotes();
  renderLibrary();
  renderArticles();
  renderProfile();
}

function showReadingsPane(name) {
  const pane = name === 'board' ? 'board' : 'log';
  $('#pane-log').hidden = pane !== 'log';
  $('#pane-board').hidden = pane !== 'board';
  $('#pane-log').classList.toggle('active', pane === 'log');
  $('#pane-board').classList.toggle('active', pane === 'board');
  $$('#readings-seg button').forEach((button) => {
    const active = button.dataset.seg === `pane-${pane}`;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function showLibraryPane(name) {
  state.libraryPane = name === 'mine' ? 'mine' : 'club';
  saveState();
  renderLibrary();
}

async function setSessionMember(member) {
  currentMember = member;
  state = await loadStateFor(member);
  resetSyncState(member.id);
  if (loadedFromCloud) {
    /* البيانات جلبت من الشيت — لا داعي لإعادة رفعها */
    syncState.profile = true;
    state.entries.forEach((entry) => syncState.entries.add(entry.id));
    state.myBooks.forEach((book) => syncState.myBooks.add(myBookSyncKey(book)));
    state.clubBooks.forEach((book) => syncState.clubBooks.add(book.id));
    persistSyncState(member.id);
  }
  try {
    localStorage.setItem(SESSION_KEY, member.id);
  } catch (error) {
    /* التخزين غير متاح */
  }
  await saveState();
}

function showGate() {
  closeSheet();
  try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* تجاهل */ }
  currentMember = null;
  state = null;
  $('#gate').hidden = false;
  $('#shell').hidden = true;
  $('#login-error').hidden = true;
  const input = $('#login-name');
  if (input) input.value = '';
  currentScreen = 'home';
}

function enterApp(welcome = false) {
  if (!currentMember || !state) return;
  try {
    localStorage.setItem(SESSION_KEY, currentMember.id);
  } catch (error) {
    /* التخزين غير متاح */
  }
  $('#gate').hidden = true;
  $('#shell').hidden = false;
  renderAll();
  go('home');
  /* سحب اقتباسات الأعضاء من الشيت المشترك في الخلفية */
  if (typeof syncQuotesFromSheet === 'function') syncQuotesFromSheet();
  if (welcome) {
    const firstName = state.profile.name.trim().split(/\s+/)[0];
    setTimeout(() => toast(`أهلاً ${firstName}… مجلسك جاهز`, 'sparkles'), 550);
  }
}

function toggleRsvp() {
  state.rsvp = !state.rsvp;
  saveState();
  renderHome();
  const button = $('#meeting-rsvp');
  if (button) {
    button.className = `btn ${state.rsvp ? 'btn-primary' : 'btn-gold'} btn-block`;
    button.innerHTML = `<svg class="ic"><use href="#i-${state.rsvp ? 'check' : 'calendar'}"/></svg>${state.rsvp ? 'حضورك مؤكد — نراك هناك' : 'أؤكد الحضور'}`;
  }
  const count = $('#meeting-attendees-sheet');
  if (count) count.textContent = toAr(13 + (state.rsvp ? 1 : 0));
  toast(state.rsvp ? 'سجّلنا حضورك… نراك هناك' : 'أُلغي تأكيد الحضور', 'calendar');
}

/* --------------------------------------------------------------------------
   15. معالجة الأحداث
   -------------------------------------------------------------------------- */
function handleGlobalClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const closer = target.closest('[data-close-sheet]');
  if (closer) { closeSheet(); return; }

  const nav = target.closest('[data-nav]');
  if (nav) { closeSheet(); go(nav.dataset.nav); return; }

  const seg = target.closest('[data-seg]');
  if (seg) { showReadingsPane(seg.dataset.seg === 'pane-board' ? 'board' : 'log'); return; }

  const lseg = target.closest('[data-lseg]');
  if (lseg) { showLibraryPane(lseg.dataset.lseg === 'pane-mine' ? 'mine' : 'club'); return; }

  const period = target.closest('[data-period]');
  if (period) {
    state.boardPeriod = period.dataset.period === 'last' ? 'last' : 'week';
    saveState();
    renderBoard();
    return;
  }

  const category = target.closest('[data-category]');
  if (category) {
    state.libraryCategory = category.dataset.category;
    saveState();
    renderCategoryChips();
    renderClubBooks();
    return;
  }

  const qfilter = target.closest('[data-qfilter]');
  if (qfilter) {
    state.quoteFilter = qfilter.dataset.qfilter;
    saveState();
    renderQuotes();
    return;
  }

  const mfilter = target.closest('[data-mfilter]');
  if (mfilter) {
    state.myFilter = mfilter.dataset.mfilter;
    saveState();
    renderMyBooks();
    $$('#my-filters button').forEach((button) => {
      const active = button.dataset.mfilter === state.myFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    return;
  }

  if (target.closest('#meeting-rsvp')) { toggleRsvp(); return; }

  const actionEl = target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const id = actionEl.dataset.id;

  switch (action) {
    case 'go-home':
      go('home');
      break;
    case 'notifications':
      openNotificationsSheet();
      break;
    case 'open-profile':
      profileReturn = currentScreen;
      go('profile');
      break;
    case 'profile-back':
      go(profileReturn || 'home');
      break;
    case 'go-log':
      go('readings');
      showReadingsPane('log');
      setTimeout(() => {
        const form = $('#log-form');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 180);
      break;
    case 'go-board':
      go('readings');
      showReadingsPane('board');
      break;
    case 'go-quotes':
      go('quotes');
      break;
    case 'go-library':
      go('library');
      break;
    case 'go-articles':
      go('articles');
      break;
    case 'focus-search':
      go('library');
      showLibraryPane('club');
      setTimeout(() => { const input = $('#club-search'); if (input) input.focus(); }, 200);
      break;
    case 'open-quote':
      openQuoteComposer();
      break;
    case 'open-article-compose':
      openArticleComposer();
      break;
    case 'open-add-book':
      openAddBook();
      break;
    case 'open-add-my-book':
      openAddMyBook();
      break;
    case 'book-more':
      openBookSheet(id);
      break;
    case 'toggle-report': {
      const report = actionEl.previousElementSibling;
      if (report && report.classList.contains('lib-report')) {
        const expanded = report.dataset.expanded === '1';
        report.dataset.expanded = expanded ? '0' : '1';
        report.textContent = expanded ? report.dataset.short : report.dataset.full;
        actionEl.textContent = expanded ? 'أعرف أكثر' : 'أقل';
      }
      break;
    }
    case 'meeting':
      openMeetingSheet();
      break;
    case 'logout':
      openConfirm({
        title: 'تسجيل الخروج',
        text: 'ستعود إلى بوابة الأعضاء. تقدمك محفوظ باسمك في هذا الجهاز.',
        confirmLabel: 'خروج',
        onConfirm: () => {
          try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* تجاهل */ }
          showGate();
        }
      });
      break;
    case 'reset-demo':
      openConfirm({
        title: 'إعادة تعيين تقدمي',
        text: 'سيتم حذف سجل قراءاتك ومكتبتك واقتباساتك ومقالاتك لهذا الاسم في هذا الجهاز.',
        confirmLabel: 'إعادة التعيين',
        onConfirm: () => {
          const id = currentMember && currentMember.id;
          try {
            if (id) localStorage.removeItem(stateKey(id));
            localStorage.removeItem(LEGACY_KEY);
          } catch (error) { /* تجاهل */ }
          location.reload();
        }
      });
      break;
    case 'like-quote': {
      if (state.likedQuotes.includes(id)) {
        state.likedQuotes = state.likedQuotes.filter((quoteId) => quoteId !== id);
      } else {
        state.likedQuotes.push(id);
      }
      saveState();
      renderQuotes();
      break;
    }
    case 'save-quote': {
      const saved = state.savedQuotes.includes(id);
      if (saved) {
        state.savedQuotes = state.savedQuotes.filter((quoteId) => quoteId !== id);
        toast('أُزيل الاقتباس من المحفوظات', 'bookmark');
      } else {
        state.savedQuotes.push(id);
        toast('حُفظ الاقتباس لتعود إليه', 'bookmark');
      }
      saveState();
      renderQuotes();
      break;
    }
    case 'share-quote': {
      const quote = state.quotes.find((item) => item.id === id);
      if (!quote) break;
      const text = `«${quote.text}»\n${quote.book || ''}${quote.page ? ` — ص ${quote.page}` : ''}\n— ${authorNameOf(quote)}\n#جليس_القرائي`;
      copyText(text).then((ok) => toast(ok ? 'نُسخ الاقتباس للمشاركة' : 'تعذّر النسخ من المتصفح', ok ? 'share' : 'info'));
      break;
    }
    case 'del-entry': {
      const entry = state.entries.find((item) => item.id === id);
      if (!entry) break;
      const book = getBook(entry.bookId);
      openConfirm({
        title: 'حذف سجل القراءة',
        text: `سيُحذف سجل ${toAr(entry.pages)} صفحة${book ? ` من «${book.title}»` : ''} من هذا الأسبوع.`,
        confirmLabel: 'حذف',
        onConfirm: () => {
          state.entries = state.entries.filter((item) => item.id !== id);
          const mine = getMyBook(entry.bookId);
          if (mine && book && mine.status !== 'want') {
            mine.currentPage = clamp(Number(mine.currentPage) - Number(entry.pages || 0), 0, book.pages);
            if (mine.status === 'finished' && mine.currentPage < book.pages) mine.status = 'reading';
          }
          saveState();
          renderReadings();
          renderHome();
          renderLibrary();
          renderProfile();
          toast('حُذف السجل', 'trash');
        }
      });
      break;
    }
    case 'quick-add':
    case 'book':
      openBookSheet(id);
      break;
    case 'add-book':
      addMyBook(id, actionEl.dataset.status || 'reading');
      closeSheet();
      renderLibrary();
      renderHome();
      renderProfile();
      toast(actionEl.dataset.status === 'want' ? 'أُضيف إلى قائمة الأمنيات' : 'أُضيف إلى مكتبتك', 'book');
      break;
    case 'remove-book': {
      const book = getBook(id);
      openConfirm({
        title: 'إزالة من مكتبتي',
        text: `سيُزال «${book ? book.title : 'الكتاب'}» من مكتبتك، ويبقى متاحاً في مكتبة النادي.`,
        confirmLabel: 'إزالة',
        onConfirm: () => {
          state.myBooks = state.myBooks.filter((item) => item.bookId !== id);
          saveState();
          renderLibrary();
          renderHome();
          renderProfile();
          toast('أُزيل الكتاب من مكتبتك', 'trash');
        }
      });
      break;
    }
    case 'go-my-library':
      closeSheet();
      state.libraryPane = 'mine';
      saveState();
      go('library');
      renderLibrary();
      break;
    case 'start-book':
      startBook(id);
      break;
    case 'save-page': {
      const book = getBook(id);
      const input = $(`#page-input-${id}`);
      if (!book || !input) break;
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0 || value > book.pages) {
        toast(`اكتب رقماً بين ٠ و${toAr(book.pages)}`, 'info');
        input.focus();
        break;
      }
      commitProgress(id, value);
      const item = getMyBook(id);
      if (item && item.status !== 'finished') toast('حُدّثت آخر صفحة وصلت إليها', 'check');
      break;
    }
    case 'open-article':
      openArticleSheet(id);
      break;
    case 'save-article': {
      const wasSaved = state.savedArticles.includes(id);
      if (wasSaved) {
        state.savedArticles = state.savedArticles.filter((articleId) => articleId !== id);
      } else {
        state.savedArticles.push(id);
      }
      saveState();
      renderArticles();
      const button = $(`#sheet-root [data-action="save-article"][data-id="${id}"]`);
      if (button) {
        button.innerHTML = `<svg class="ic"><use href="#i-bookmark"/></svg> ${wasSaved ? 'حفظ المقال' : 'محفوظ'}`;
      }
      toast(wasSaved ? 'أُزيل المقال من المحفوظات' : 'حُفظ المقال لتعود إليه', 'bookmark');
      break;
    }
    case 'share-article': {
      const article = state.articles.find((item) => item.id === id);
      if (!article) break;
      const text = `${article.title}\n— ${authorNameOf(article)}\n\n${article.excerpt}\n\n#جليس_القرائي`;
      copyText(text).then((ok) => toast(ok ? 'نُسخ المقال للمشاركة' : 'تعذّر النسخ من المتصفح', ok ? 'share' : 'info'));
      break;
    }
    default:
      break;
  }
}

function handleLogSubmit(event) {
  event.preventDefault();
  const bookTitle = $('#log-book').value.trim();
  const pages = Number($('#log-pages').value);
  const note = $('#log-note').value.trim();

  if (!Number.isFinite(pages) || pages < 1) { toast('أدخل عدد صفحات صحيح', 'info'); $('#log-pages').focus(); return; }

  const norm = (value) => value.replace(/\s+/g, ' ').trim();
  const book = bookTitle
    ? (BOOKS.find((item) => norm(item.title) === norm(bookTitle))
      || BOOKS.find((item) => norm(bookTitle).includes(norm(item.title))))
    : null;

  const now = new Date();
  const before = weekStats().pages;
  state.entries.push({
    id: `e-${Date.now()}`,
    bookId: book ? book.id : null,
    bookTitle: book ? book.title : bookTitle,
    pages,
    date: toISO(now),
    note,
    ts: now.getTime()
  });

  if (book) {
    const mine = getMyBook(book.id);
    if (!mine) {
      state.myBooks.unshift({
        bookId: book.id,
        status: 'reading',
        currentPage: Math.min(pages, book.pages),
        addedAt: toISO(now)
      });
    } else if (mine.status !== 'want') {
      mine.currentPage = clamp(Number(mine.currentPage) + pages, 0, book.pages);
      if (mine.currentPage >= book.pages) mine.status = 'finished';
      else if (mine.status === 'finished') mine.status = 'reading';
    } else {
      mine.status = 'reading';
      mine.currentPage = Math.min(pages, book.pages);
    }
  }

  saveState();
  $('#log-pages').value = '';
  $('#log-note').value = '';
  renderReadings();
  renderHome();
  renderLibrary();
  renderProfile();

  const after = weekStats().pages;
  const goal = Number(state.profile.goal) || 200;
  if (before < goal && after >= goal) {
    toast(`أتممت هدفك الأسبوعي… ${toAr(after)} صفحة`, 'trophy');
    celebrate();
  } else {
    toast(`أُضيفت ${toAr(pages)} صفحة إلى سجل قراءتك`, 'check');
    celebrate();
  }
}

async function init() {
  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('#login-name').value.trim();
    const error = $('#login-error');
    const member = findMemberByName(name);

    if (!member) {
      error.textContent = name.length < 2
        ? 'اكتب اسمك كما هو مسجل في قائمة أعضاء النادي.'
        : 'هذا الاسم ليس ضمن قائمة أعضاء جليس. تأكد من كتابته كما هو مسجل لدينا.';
      error.hidden = false;
      $('#login-name').focus();
      return;
    }
    error.hidden = true;
    await setSessionMember(member);
    enterApp(true);
  });

  $('#log-form').addEventListener('submit', handleLogSubmit);

  $('#club-search').addEventListener('input', (event) => {
    state.libraryQuery = event.target.value;
    renderClubBooks();
  });

  $('#goal-range').addEventListener('input', (event) => {
    const value = Number(event.target.value);
    event.target.style.setProperty('--p', `${((value - 50) / 450) * 100}%`);
    $('#goal-output').textContent = toAr(value);
  });

  $('#goal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const goal = clamp(Number($('#goal-range').value) || 200, 50, 500);
    state.profile.goal = goal;
    saveState();
    renderHome();
    renderReadings();
    renderProfile();
    toast(`هدفك الأسبوعي الآن ${toAr(goal)} صفحة`, 'target');
  });

  $('#notif-toggle').addEventListener('change', (event) => {
    state.profile.notifications = event.target.checked;
    saveState();
    toast(event.target.checked ? 'تذكير الورد مفعّل' : 'تذكير الورد متوقف', 'bell');
  });

  $('#app-main').addEventListener('click', (event) => {
    const afilter = event.target.closest('[data-afilter]');
    if (afilter) {
      state.articleFilter = afilter.dataset.afilter;
      saveState();
      renderArticles();
      return;
    }
    const acat = event.target.closest('[data-acat]');
    if (acat) {
      state.articleCategory = acat.dataset.acat;
      saveState();
      renderArticles();
      return;
    }
  });

  $('#app-main').addEventListener('input', (event) => {
    const range = event.target.closest('[data-progress]');
    if (!range) return;
    const percent = clamp(Math.round((Number(range.value) / Number(range.max)) * 100), 0, 100);
    range.style.setProperty('--p', `${percent}%`);
    const head = range.closest('.my-progress').querySelector('.my-progress-head');
    head.querySelector('span').textContent = `${toAr(range.value)} من ${toAr(range.max)} صفحة`;
    head.querySelector('b').textContent = `٪${toAr(percent)}`;
  });

  $('#app-main').addEventListener('input', (event) => {
    const search = event.target.closest('#article-category-search');
    if (!search) return;
    state.articleCategorySearch = search.value;
    saveState();
    renderArticles();
  });

  $('#app-main').addEventListener('change', (event) => {
    const range = event.target.closest('[data-progress]');
    if (!range) return;
    commitProgress(range.dataset.progress, range.value);
  });

  $('#app-main').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const input = event.target.closest('[data-pageinput]');
    if (!input) return;
    event.preventDefault();
    const button = $(`[data-action="save-page"][data-id="${input.dataset.pageinput}"]`);
    if (button) button.click();
  });

  document.addEventListener('click', handleGlobalClick);

  /* تحديث اقتباسات الأعضاء مشتركاً بين التبويبات/الحسابات */
  window.addEventListener('storage', (event) => {
    if (!state) return;
    if (event.key === SHARED_QUOTES_KEY || event.key === null) {
      state.quotes = mergeQuoteLists(getLocalSharedQuotes(), state.quotes);
      renderQuotes();
      renderHome();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#sheet-root').hidden) {
      closeSheet();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[role="button"]')) {
      event.preventDefault();
      event.target.click();
    }
  });

  const params = new URLSearchParams(location.search);
  let member = null;
  if (params.get('demo') === '1') {
    member = findMemberByName(params.get('member') || '')
      || findMemberByName('مشعل الحفير')
      || MEMBERS[0];
  } else {
    let savedId = null;
    try { savedId = localStorage.getItem(SESSION_KEY); } catch (error) { savedId = null; }
    member = memberById(savedId);
  }

  renderLogStamp();
  setInterval(renderLogStamp, 30000);

  if (member) {
    await setSessionMember(member);
    enterApp(false);
    const requested = params.get('screen');
    if (requested) go(requested);
  } else {
    showGate();
  }
}

init();

/* @@ */




