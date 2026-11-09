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
const ACCOUNT_KEY = 'jalees-account-v1';
const MEMBER_KEY_PREFIX = 'jalees-member-v2:';
const LEGACY_KEY = 'jalees-members-v1';
const CLUB_GOAL = 12000;
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykj8VcIZXP6ljg-W0O0qeP1OHVhO7Y_jp9ReJy0i8KswPrQCDHAgtixCfCGz_6a6n-iA/exec';
const CLUB_BOOKS_URL = 'https://script.google.com/macros/s/AKfycbykj8VcIZXP6ljg-W0O0qeP1OHVhO7Y_jp9ReJy0i8KswPrQCDHAgtixCfCGz_6a6n-iA/exec';
const QUOTES_SHEET_URL = CLUB_BOOKS_URL;
// Authentication and member moderation belong to the main member backend,
// not the legacy club-books endpoint.
const MAIN_API_ACTIONS = new Set([
  'registerMember', 'loginMember', 'requestRegistrationCode', 'verifyRegistrationCode',
  'requestPasswordReset', 'resetPassword', 'getJoinRequests', 'saveJoinRequest',
  'setJoinRequestStatus', 'getPendingMembers', 'setMemberStatus', 'getApprovedMembers',
  'getClubBooks', 'saveClubBook', 'updateClubBook', 'deleteClubBook', 'restoreClubBook',
  'getDeletedItems', 'deleteArticle', 'restoreArticle', 'deleteQuote', 'restoreQuote',
  'deleteLibraryCategory', 'restoreLibraryCategory', 'deleteRecordedMeeting', 'restoreRecordedMeeting',
  'getConsultations', 'submitConsultation', 'answerConsultation', 'setMemberPhoto', 'getMemberProfile',
  'saveProfile', 'getProfile', 'saveEntry', 'getEntries',
  'getMyBooks', 'saveMyBook', 'deleteMyBook',
  'getReadingTips', 'saveReadingTip', 'deleteReadingTip',
  'setConsultantStatus', 'setMemberType'
]);
const SHARED_QUOTES_KEY = 'jalees-shared-quotes-v3';
let deletedQuoteIds = new Set();
let deletedQuoteTexts = new Set();
let deletedClubBookIds = new Set();
let deletedArticleIds = new Set();
let deletedRecordedMeetingIds = new Set();
const DEFAULT_MEETING = {
  id: 'meeting-default',
  title: 'مناقشة كتاب: ابني حبيبي',
  description: 'لقاء أسبوعي لأعضاء جليس؛ مساحة للحوار وتبادل الأفكار حول الكتاب.',
  date: '',
  time: '20:00',
  location: 'جمعية التنمية الأهلية بالمريداسية',
  image: '',
  createdAt: 0
};

function mergeQuoteLists(...lists) {
  const out = [];
  const seenText = new Set();
  const seenId = new Set();
  lists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((quote) => {
      if (!quote || !quote.text) return;
      const text = normalizeName(quote.text);
      if ((quote.id && deletedQuoteIds.has(String(quote.id))) || deletedQuoteTexts.has(text)) return;
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
  ['عبدالرحمن الثنيان', 0, 4],
  ['مشرف جليس', 0, 0]
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

function normalizeBookTitle(value) {
  return normalizeName(value)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[.,،؛:!?؟()\[\]{}«»“”'"_\-]/g, '');
}

function findMemberByName(value) {
  const key = normalizeName(value);
  if (!key) return null;
  // Search roster first
  const found = MEMBERS.find((member) => normalizeName(member.name) === key);
  if (found) return found;
  // Search custom members
  const customMembers = JSON.parse(localStorage.getItem('jalees-custom-members') || '[]');
  const customName = customMembers.find((name) => normalizeName(name) === key);
  if (customName) {
    // Create a temporary member object
    return { id: `custom-${normalizeName(customName)}`, name: customName, role: 'عضو', pages: 0, lastWeek: 0, color: MEMBER_COLORS[0], isCustom: true };
  }
  return null;
}

const SUPERVISORS = ['مشعل عبدالرحمن الحفير', 'مشعل الحفير', 'محمد صالح الدبيخي', 'محمد الدبيخي'];
function isGuest() { return !currentMember || currentMember.id === 'guest'; }

function isSupervisor() {
  if (!currentMember) return false;
  return SUPERVISORS.some((name) => normalizeName(name) === normalizeName(currentMember.name));
}

/* ---- حساب العضو: البريد الإلكتروني + الرمز السري ---- */
let pendingResetEmail = '';
let pendingRegister = null;

function readAccount() {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const account = JSON.parse(raw);
    return account && account.id ? account : null;
  } catch (error) {
    return null;
  }
}

function persistAccount(account) {
  try {
    if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch (error) {
    /* التخزين غير متاح */
  }
}

function accountToMember(account) {
  const name = String((account && account.name) || 'عضو جليس');
  return {
    id: String(account.id),
    name,
    role: account.role === 'supervisor' ? 'مشرف' : 'عضو',
    email: String(account.email || ''),
    photo: String(account.photo || ''),
    pages: 0,
    lastWeek: 0,
    color: MEMBER_COLORS[Math.abs(name.length) % MEMBER_COLORS.length]
  };
}

function cleanServerError(result, fallback) {
  const raw = result && (result.error || result.message);
  const text = String(raw || '').replace(/^Error:\s*/i, '').trim();
  return text || fallback;
}

function setBtnBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    button.dataset.idleLabel = button.innerHTML;
    button.disabled = true;
    if (label) button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.idleLabel) {
      button.innerHTML = button.dataset.idleLabel;
      delete button.dataset.idleLabel;
    }
  }
}

async function completeLogin(account) {
  persistAccount(account);
  const member = accountToMember(account);
  await setSessionMember(member);
  enterApp(true);
}

function resetPasswordToggles() {
  $$('.password-toggle').forEach((button) => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    input.type = 'password';
    button.classList.remove('is-on');
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'إظهار الرمز السري');
    const use = button.querySelector('use');
    if (use) use.setAttribute('href', '#i-eye');
  });
}

function bindPasswordToggles() {
  $$('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.classList.toggle('is-on', reveal);
      button.setAttribute('aria-pressed', String(reveal));
      button.setAttribute('aria-label', reveal ? 'إخفاء الرمز السري' : 'إظهار الرمز السري');
      const use = button.querySelector('use');
      if (use) use.setAttribute('href', reveal ? '#i-eye-off' : '#i-eye');
      try {
        input.focus({ preventScroll: true });
        const end = input.value.length;
        input.setSelectionRange(end, end);
      } catch (error) { /* تجاهل المتصفحات التي لا تدعم التحديد */ }
    });
  });
}

function showGateView(view) {
  const names = ['login', 'register', 'verify', 'pending', 'forgot', 'reset'];
  names.forEach((name) => {
    const form = document.getElementById(`${name}-form`);
    if (form) form.hidden = name !== view;
    const error = document.getElementById(`${name}-error`);
    if (error) error.hidden = true;
  });
  const contact = document.querySelector('#gate-card > .gate-whatsapp');
  if (contact) contact.hidden = view === 'pending';
  resetPasswordToggles();
  const firstInput = document.querySelector(`#${view}-form input`);
  if (firstInput) setTimeout(() => { try { firstInput.focus(); } catch (error) { /* تجاهل */ } }, 60);
}

const seedAuthor = (id) => {
  const member = memberById(id);
  return member
    ? { authorId: member.id, authorName: member.name, color: member.color }
    : { authorId: id, authorName: 'عضو جليس', color: '#1E3A2B' };
};

const LEGACY_BOOKS_SEED = [
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

/* لا نعرض الكتب التجريبية المضمّنة؛ مكتبة النادي مصدرها الشيت المشترك. */
const BOOKS = [];

const DEFAULT_BOOK_CATEGORIES = [
  'أدب', 'إدارة', 'اقتصاد', 'أسرة وطفولة', 'تاريخ', 'تاريخ إسلامي', 'تاريخ سعودي',
  'تربية', 'تنمية ذاتية', 'تراجم', 'تقنية', 'تعليم', 'تفسير وعلوم القرآن', 'ثقافة عامة',
  'جغرافيا ورحلات', 'حديث وسيرة نبوية', 'حكايات شعبية', 'رواية', 'رواية تاريخية',
  'رياضة', 'سيرة ذاتية', 'شعر', 'صحة', 'علم اجتماع', 'علم نفس', 'علوم', 'فكر وفلسفة',
  'فن ومسرح', 'قصة قصيرة', 'قصص أطفال', 'لغة عربية', 'مذكرات', 'مقالات', 'فنون', 'فقه', 'أخرى'
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
  'فنون',
  'النادي',
  'اقتصاد',
  'إدارة',
  'دين',
  'لغة',
  'تراجم',
  'رحلات',
  'صحة',
  'تقنية',
  'مجتمع',
  'قصص',
  'مسرح',
  'نقد',
  'أخرى'
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
      notifications: true,
      photo: member ? String(member.photo || '') : ''
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
    seenQuotes: 0,
    seenArticles: 0,
    seenClubBooks: 0,
    rsvp: false,
    meetings: [],
    recordedMeetings: [],
    boardPeriod: 'week',
    libraryPane: 'club',
    libraryCategory: 'all',
    libraryCategories: [],
    libraryQuery: '',
    myFilter: 'reading',
    articleFilter: 'all',
    articleCategory: 'all',
    articleCategories: [],
    articleFontSize: 16,
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
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const endpoint = MAIN_API_ACTIONS.has(action)
      ? APPS_SCRIPT_URL
      : action === 'getQuotes' || action === 'getArticles' || action === 'saveArticle' || action === 'deleteArticle' || action === 'restoreArticle'
      || action === 'deleteQuote' || action === 'restoreQuote'
      || action === 'getDeletedItems' || action === 'restoreLibraryCategory' || action === 'deleteLibraryCategory'
      || action === 'getBookRatings' || action === 'saveBookRating'
      || action === 'getMeetings' || action === 'saveMeeting' || action === 'deleteMeeting'
      || action === 'getRecordedMeetings' || action === 'saveRecordedMeeting' || action === 'deleteRecordedMeeting' || action === 'restoreRecordedMeeting'
      || action === 'getLibraryCategories' || action === 'addLibraryCategory' || action === 'renameLibraryCategory'
      ? CLUB_BOOKS_URL
      : APPS_SCRIPT_URL;
    const query = new URLSearchParams();
    query.set('action', action);
    if (memberId) query.set('memberId', memberId);
    // Apps Script may be served through redirects; bust intermediary caches so new rows appear.
    if (!data) query.set('_', String(Date.now()));
    const url = `${endpoint}?${query.toString()}`;

    const options = data
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `action=${action}&data=${encodeURIComponent(JSON.stringify(data))}`,
          signal: controller.signal,
          cache: 'no-store'
        }
      : { signal: controller.signal, cache: 'no-store' };

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
let syncState = { profile: false, entries: new Set(), myBooks: new Set(), clubBooks: new Set(), articles: new Set() };
let syncTimer = null;
let syncRunning = false;
let syncAgain = false;
let syncBlockedUntil = 0;
let loadedFromCloud = false;

function emptySyncState() {
  return { profile: false, entries: new Set(), myBooks: new Set(), clubBooks: new Set(), articles: new Set() };
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
      clubBooks: new Set(parsed.clubBooks || []),
      articles: new Set(parsed.articles || [])
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
      clubBooks: [...syncState.clubBooks],
      articles: [...syncState.articles]
    }));
  } catch (error) { /* التخزين غير متاح */ }
}

function resetSyncState(memberId) {
  syncState = loadSyncState(memberId);
  /* نقل حالة مزامنة كتب النادي إلى رابط المكتبة الجديد مرة واحدة لكل عضو. */
  const endpointKey = `jalees-club-books-endpoint:${memberId}`;
  let previousEndpoint = null;
  try { previousEndpoint = localStorage.getItem(endpointKey); } catch (error) {}
  if (previousEndpoint !== CLUB_BOOKS_URL) {
    syncState.clubBooks.clear();
    try { localStorage.setItem(endpointKey, CLUB_BOOKS_URL); } catch (error) {}
    persistSyncState(memberId);
  }
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
    coverImage: book.coverImage || '',
    report: book.report || '',
    pages: book.pages || 0,
    year: book.year || '',
    createdAt: book.createdAt || Date.now()
  });
}

async function saveArticleToCloud(member, article) {
  return cloudRequest('saveArticle', {
    id: article.id,
    memberId: member.id,
    memberName: state.profile.name,
    title: article.title,
    category: article.category,
    body: article.body,
    excerpt: article.excerpt,
    read: article.read || 3,
    createdAt: article.createdAt || Date.now()
  });
}

async function updateClubBookToCloud(book) {
  return cloudRequest('updateClubBook', {
    id: book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    coverColor: book.coverColor || '',
    report: book.report || '',
    pages: book.pages || 0,
    year: book.year || '',
    coverImage: book.coverImage || '',
    updatedAt: Date.now()
  });
}

function scheduleCloudSync(delay = 1200) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncTimer = null; runCloudSync(); }, delay);
}

async function runCloudSync() {
  if (!state || !currentMember) return;
  const pendingClubBooks = state.clubBooks.filter((book) => !syncState.clubBooks.has(book.id));
  /* لا تمنع أعطال مزامنة الملف الشخصي رفع كتب النادي إلى خدمتها المستقلة. */
  if (Date.now() < syncBlockedUntil && !pendingClubBooks.length) return;
  if (syncRunning) { syncAgain = true; return; }
  syncRunning = true;
  const member = currentMember;
  const memberId = member.id;
  try {
    for (const book of pendingClubBooks) {
      if (currentMember !== member) return;
      const result = await saveClubBookToCloud(member, book);
      if (!result || result.success === false) {
        syncBlockedUntil = Date.now() + 60000;
        break;
      }
      syncState.clubBooks.add(book.id);
      persistSyncState(memberId);
    }
    if (Date.now() < syncBlockedUntil) return;

    /* مزامنة المقالات الجديدة إلى الشيت */
    const myArticles = (state.articles || []).filter((a) => {
      if (!a || !a.id) return false;
      if (syncState.articles.has(a.id)) return false;
      return isMine(a);
    });
    for (const article of myArticles) {
      if (currentMember !== member) return;
      const result = await saveArticleToCloud(member, article);
      if (!result || result.success === false) { syncBlockedUntil = Date.now() + 60000; break; }
      syncState.articles.add(article.id);
      persistSyncState(memberId);
    }
    if (Date.now() < syncBlockedUntil) return;

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
  if (result && result.success === true) deletedClubBookIds = new Set((result.deletedIds || []).map(String));
  return result && result.success === true ? result.data : [];
}

async function refreshClubBooksFromCloud() {
  const member = currentMember;
  if (!member || !state) return;
  const cloudBooks = await loadClubBooksFromCloud(member.id);
  if (!Array.isArray(cloudBooks) || currentMember !== member || !state) return;

  const merged = new Map();
  (state.clubBooks || []).forEach((book) => { if (book && book.id) merged.set(book.id, book); });
  cloudBooks.forEach((book) => {
    if (!book || !book.id) return;
    const localBook = merged.get(book.id) || {};
    const nextBook = { ...localBook, ...book };
    /* حافظ على سنة النشر المحلية إن كانت النسخة السحابية القديمة لا تحتوي العمود بعد */
    if (!book.year && localBook.year) nextBook.year = localBook.year;
    merged.set(book.id, nextBook);
    if (member.id !== 'guest') syncState.clubBooks.add(book.id);
  });
  deletedClubBookIds.forEach((id) => merged.delete(String(id)));
  state.clubBooks = [...merged.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (member.id !== 'guest') {
    persistSyncState(member.id);
    await saveState();
  }
  renderLibrary();
  renderHome();
}

async function loadProfileFromCloud(memberId) {
  const result = await cloudRequest('getProfile', null, memberId);
  if (!result || result.success !== true) return null;
  if (Array.isArray(result.data)) return result.data.length > 0 ? result.data[0] : null;
  return result.data && typeof result.data === 'object' ? result.data : null;
}

async function loadEntriesFromCloud(memberId) {
  const result = await cloudRequest('getEntries', null, memberId);
  return result.success ? result.data : [];
}

async function loadMyBooksFromCloud(memberId) {
  const result = await cloudRequest('getMyBooks', null, memberId);
  return result.success ? result.data : [];
}

async function saveJoinRequestToSheet(data) {
  if (!CLUB_BOOKS_URL) return;
  try {
    await fetch(CLUB_BOOKS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `action=saveJoinRequest&data=${encodeURIComponent(JSON.stringify(data))}`
    });
  } catch (err) {
    console.error('Failed to save join request:', err);
  }
}
async function saveQuoteToSheet(quoteData) {
  if (!QUOTES_SHEET_URL) return;
  try {
    const payload = {
      id: quoteData.id || `q-${Date.now()}`,
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
    const response = await fetch(`${QUOTES_SHEET_URL}?action=getQuotes&_=${Date.now()}`, { cache: 'no-store' });
    const result = await response.json();
    if (result && (result.success === true || result.status === 'success') && Array.isArray(result.data)) {
      deletedQuoteIds = new Set((result.deletedIds || []).map(String));
      deletedQuoteTexts = new Set((result.deletedTexts || []).map(normalizeName));
      return result.data.map((q, idx) => {
        const mem = MEMBERS.find((m) => normalizeName(m.name) === normalizeName(q.author_name));
        const matchingBook = [...BOOKS, ...((state && state.clubBooks) || [])]
          .find((book) => normalizeBookTitle(book.title) === normalizeBookTitle(q.book_title));
        return {
          id: q.id || `sheet-${idx}`,
          text: q.quote_text,
          book: q.book_title || 'من هامش القراءة',
          bookId: q.book_id || (matchingBook && matchingBook.id) || '',
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
  if (result && result.success === true) {
    deletedArticleIds = new Set((result.deletedIds || []).map(String));
  }
  if (!result || result.success !== true || !Array.isArray(result.data)) return null;
  const authorPhotos = result.authorPhotos || {};
  return result.data.map((article) => ({
    ...article,
    authorPhoto: article.authorPhoto || authorPhotos[String(article.memberId || '')] || ''
  }));
}

async function refreshArticlesFromCloud() {
  const member = currentMember;
  if (!member || !state) return;
  const cloudArticles = await loadArticlesFromCloud(member.id);
  if (!Array.isArray(cloudArticles) || currentMember !== member || !state) return;

  /* Map cloud articles to app format */
  const mapped = cloudArticles.map((a) => ({
    id: a.id || `cloud-${Date.now()}`,
    title: a.title || '',
    category: a.category || 'قراءة',
    body: a.body || '',
    excerpt: a.excerpt || (a.body ? String(a.body).replace(/\\s+/g, ' ').slice(0, 118) : ''),
    authorId: a.memberId || 'cloud',
    authorName: a.memberName || 'عضو جليس',
    authorPhoto: a.authorPhoto || '',
    color: '#1E3A2B',
    time: a.createdAt ? new Date(Number(a.createdAt)).toLocaleString('ar-SA') : 'مؤخراً',
    read: Number(a.read) || 3,
    createdAt: articleTimestamp(a)
  }));

  /* Re-try local articles that have not yet reached the shared sheet. */
  const cloudIds = new Set(mapped.map((a) => a.id));
  if (member.id !== 'guest') {
    const pendingArticles = (state.articles || []).filter((article) =>
      article && String(article.id || '').startsWith('a-')
      && !cloudIds.has(article.id)
      && !syncState.articles.has(article.id)
      && isMine(article)
    );
    for (const article of pendingArticles) {
      if (currentMember !== member) return;
      const result = await saveArticleToCloud(member, article);
      if (result && result.success !== false) {
        syncState.articles.add(article.id);
        persistSyncState(member.id);
        cloudIds.add(article.id);
        mapped.push({
          ...article,
          authorId: member.id,
          authorName: article.authorName || member.name,
          createdAt: Number(article.createdAt) || Date.now()
        });
      }
    }
  }

  /* Merge cloud articles + local seed articles, dedupe by id, handle deletions */
  const merged = new Map();
  /* Keep seed articles */
  ARTICLE_SEED.forEach((s) => { merged.set(s.id, { ...s }); });
  /* Add/update cloud articles */
  mapped.forEach((a) => {
    if (!a.id) return;
    merged.set(a.id, a);
    if (member.id !== 'guest') syncState.articles.add(a.id);
  });
  /* Keep local non-seed articles that are NOT in cloud only if they're new (just created, not yet synced) */
  (state.articles || []).forEach((a) => {
    if (!a || !a.id) return;
    if (ARTICLE_SEED.some((s) => s.id === a.id)) return; // already handled
    if (cloudIds.has(a.id)) return; // already in cloud
    // Keep only if it's a brand-new local article (not yet uploaded) - check syncState
    if (!syncState.articles.has(a.id) && isMine(a)) {
      merged.set(a.id, a); // keep unsynced local article
    }
    // otherwise it was deleted from cloud -> drop it
  });

  deletedArticleIds.forEach((id) => merged.delete(String(id)));

  /* Sort newest first */
  state.articles = [...merged.values()].sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  if (state.articles.length === 0) state.articles = ARTICLE_SEED.map((a) => ({ ...a }));

  if (member.id !== 'guest') {
    persistSyncState(member.id);
    await saveState();
  }
  renderArticles();
  renderHome();
}

async function refreshLibraryCategoriesFromCloud() {
  if (!state) return;
  const member = currentMember;
  const result = await cloudRequest('getLibraryCategories');
  if (!result || result.success !== true || !Array.isArray(result.data)) return;
  if (member && currentMember !== member) return;
  state.libraryCategories = [...new Set(result.data.map((name) => String(name || '').trim()).filter(Boolean))];
  if (member && member.id !== 'guest') await saveState();
  renderLibrary();
}

async function loadMeetingsFromCloud() {
  const result = await cloudRequest('getMeetings');
  return result && result.success && Array.isArray(result.data) ? result.data : null;
}

async function refreshMeetingsFromCloud() {
  const member = currentMember;
  if (!member || !state) return;
  const cloudMeetings = await loadMeetingsFromCloud();
  if (!cloudMeetings || currentMember !== member || !state) return;

  const merged = new Map();
  cloudMeetings.forEach((meeting) => {
    if (meeting && meeting.id) merged.set(String(meeting.id), meeting);
  });
  // Keep an unsynced local meeting if network was unavailable during creation.
  (state.meetings || []).forEach((meeting) => {
    if (meeting && meeting.id && !merged.has(String(meeting.id))) merged.set(String(meeting.id), meeting);
  });
  state.meetings = [...merged.values()].sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  if (member.id !== 'guest') await saveState();
  renderMeetingCard();
}

async function saveMeetingToCloud(meeting) {
  return cloudRequest('saveMeeting', meeting);
}

async function loadRecordedMeetingsFromCloud() {
  const result = await cloudRequest('getRecordedMeetings');
  if (result && result.success === true) {
    deletedRecordedMeetingIds = new Set((result.deletedIds || []).map(String));
  }
  return result && result.success === true && Array.isArray(result.data) ? result.data : null;
}

function recordedMeetingTimestamp(meeting) {
  const value = meeting && (meeting.recordedAt || meeting.createdAt);
  if (value instanceof Date) return value.getTime();
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderRecordedMeetings(root, meetings) {
  const list = root.querySelector('#recorded-meetings-list');
  if (!list) return;
  if (!meetings.length) {
    list.innerHTML = emptyHTML('calendar', 'لا توجد لقاءات مسجلة بعد', 'ستظهر هنا تسجيلات لقاءات جليس السابقة.');
    return;
  }

  list.innerHTML = meetings.map((item) => {
    const videoUrl = /^https?:\/\//i.test(String(item.videoUrl || '').trim()) ? String(item.videoUrl).trim() : '';
    const image = item.image
      ? `<img src="${esc(item.image)}" alt="صورة لقاء ${esc(item.title)}" loading="lazy">`
      : `<div class="recorded-meeting-placeholder"><svg class="ic"><use href="#i-calendar"/></svg></div>`;
    const dateLabel = item.recordedAt ? meetingDateLabel(item.recordedAt) : '';
    const play = videoUrl
      ? `<a class="recorded-meeting-play" href="${esc(videoUrl)}" target="_blank" rel="noopener noreferrer" aria-label="مشاهدة ${esc(item.title)}"><svg class="ic"><use href="#i-play"/></svg></a>`
      : '';

    return `
      <article class="recorded-meeting-card">
        <div class="recorded-meeting-media">
          ${image}
          ${play}
          ${item.duration ? `<span class="recorded-meeting-duration">${esc(item.duration)}</span>` : ''}
        </div>
        <div class="recorded-meeting-content">
          <div class="recorded-meeting-meta">
            ${dateLabel ? `<span><svg class="ic"><use href="#i-calendar"/></svg>${esc(dateLabel)}</span>` : ''}
            <span><svg class="ic"><use href="#i-eye"/></svg>${toAr(Number(item.views) || 0)} مشاهدة</span>
          </div>
          <h3>${esc(item.title || 'لقاء جليس')}</h3>
          ${item.description ? `<p class="recorded-meeting-description">${esc(item.description)}</p>` : ''}
          ${item.speaker ? `<div class="recorded-meeting-speaker"><svg class="ic"><use href="#i-user"/></svg>${esc(item.speaker)}</div>` : ''}
          <div class="recorded-meeting-actions">
            ${videoUrl ? `<a class="btn btn-sm btn-primary" href="${esc(videoUrl)}" target="_blank" rel="noopener noreferrer">شاهد اللقاء <svg class="ic"><use href="#i-play"/></svg></a>` : '<span class="recorded-meeting-unavailable">رابط التسجيل غير متوفر</span>'}
            ${isSupervisor() ? `<button class="icon-btn recorded-meeting-delete" type="button" data-action="delete-recorded-meeting" data-id="${esc(item.id)}" aria-label="حذف اللقاء"><svg class="ic"><use href="#i-trash"/></svg></button>` : ''}
          </div>
        </div>
      </article>`;
  }).join('');
}

function openMeetingArchiveSheet() {
  const localMeetings = (state.recordedMeetings || []).slice().sort((a, b) => recordedMeetingTimestamp(b) - recordedMeetingTimestamp(a));
  openSheet(`
    ${sheetHead('اللقاءات المسجلة', 'أرشيف لقاءات جليس السابقة')}
    <div class="recorded-meetings-toolbar">
      <p>شاهد واستعد لحظات من لقاءاتنا السابقة.</p>
      ${isSupervisor() ? `<button class="btn btn-sm btn-primary" type="button" data-action="add-recorded-meeting"><svg class="ic"><use href="#i-plus"/></svg> إضافة تسجيل</button>` : ''}
    </div>
    <div id="recorded-meetings-list" class="recorded-meetings-list"><div class="recorded-meetings-loading">جارٍ تحميل اللقاءات…</div></div>`, (root) => {
    renderRecordedMeetings(root, localMeetings);
    loadRecordedMeetingsFromCloud().then(async (cloudMeetings) => {
      if (!cloudMeetings || !root.querySelector('#recorded-meetings-list')) return;
      const byId = new Map(cloudMeetings.filter((item) => item && item.id).map((item) => [String(item.id), item]));
      (state.recordedMeetings || []).forEach((item) => {
        if (item && item.id && !byId.has(String(item.id)) && !deletedRecordedMeetingIds.has(String(item.id))) byId.set(String(item.id), item);
      });
      deletedRecordedMeetingIds.forEach((id) => byId.delete(String(id)));
      state.recordedMeetings = [...byId.values()].sort((a, b) => recordedMeetingTimestamp(b) - recordedMeetingTimestamp(a));
      if (currentMember && currentMember.id !== 'guest') await saveState();
      renderRecordedMeetings(root, state.recordedMeetings);
    });
  });
}

function openRecordedMeetingComposer() {
  if (!isSupervisor()) { toast('إضافة التسجيلات للمشرفين فقط', 'info'); return; }
  openSheet(`
    ${sheetHead('إضافة لقاء مسجل', 'أضف تفاصيل اللقاء ورابط التسجيل')}
    <form id="recorded-meeting-form" class="meeting-form" novalidate>
      <div class="field"><label for="recorded-title">عنوان اللقاء</label><input class="input" id="recorded-title" maxlength="120" required placeholder="عنوان اللقاء المسجل"></div>
      <div class="field"><label for="recorded-description">نبذة عن اللقاء</label><textarea class="input" id="recorded-description" rows="3" maxlength="700" placeholder="نبذة قصيرة عن موضوع اللقاء"></textarea></div>
      <div class="meeting-form-row">
        <div class="field"><label>تاريخ اللقاء (سنة / شهر / يوم)</label>${dateYMDField('recorded-date', 'تاريخ اللقاء')}</div>
        <div class="field"><label for="recorded-speaker">مقدم اللقاء</label><input class="input" id="recorded-speaker" maxlength="100" placeholder="اسم مقدم اللقاء"></div>
      </div>
      <div class="meeting-form-row">
        <div class="field"><label for="recorded-views">عدد المشاهدات</label><input class="input" id="recorded-views" type="number" min="0" value="0"></div>
        <div class="field"><label for="recorded-duration">مدة التسجيل</label><input class="input" id="recorded-duration" maxlength="20" placeholder="مثال: 1:35:55"></div>
      </div>
      <div class="field"><label for="recorded-video-url">رابط التسجيل</label><input class="input" id="recorded-video-url" type="url" required placeholder="https://…"></div>
      <div class="field">
        <label for="recorded-image-input">صورة مصغرة للقاء</label>
        <label class="meeting-upload" for="recorded-image-input"><svg class="ic"><use href="#i-article"/></svg><span>اختر صورة اللقاء</span><small>تظهر كغلاف للتسجيل</small></label>
        <input id="recorded-image-input" class="meeting-file-input" type="file" accept="image/*">
        <div id="recorded-image-preview-wrap" class="meeting-image-preview-wrap" hidden><img id="recorded-image-preview" alt="معاينة صورة اللقاء"><button type="button" class="meeting-image-remove" id="recorded-image-remove" aria-label="إزالة الصورة">×</button></div>
        <small id="recorded-image-status" class="meeting-image-status"></small>
      </div>
      <button class="btn btn-gold btn-block" type="submit"><svg class="ic"><use href="#i-play"/></svg> نشر في أرشيف اللقاءات</button>
    </form>`, (root) => {
    let imageData = '';
    const fileInput = root.querySelector('#recorded-image-input');
    const previewWrap = root.querySelector('#recorded-image-preview-wrap');
    const preview = root.querySelector('#recorded-image-preview');
    const status = root.querySelector('#recorded-image-status');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      status.textContent = 'جارٍ تجهيز الصورة…';
      try {
        imageData = await compressMeetingImage(file);
        preview.src = imageData;
        previewWrap.hidden = false;
        status.textContent = 'الصورة جاهزة';
      } catch (error) {
        imageData = '';
        fileInput.value = '';
        previewWrap.hidden = true;
        status.textContent = error.message;
      }
    });

    root.querySelector('#recorded-image-remove').addEventListener('click', () => {
      imageData = '';
      fileInput.value = '';
      preview.removeAttribute('src');
      previewWrap.hidden = true;
      status.textContent = '';
    });

    root.querySelector('#recorded-meeting-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!isSupervisor()) { toast('إضافة التسجيلات للمشرفين فقط', 'info'); return; }
      const title = root.querySelector('#recorded-title').value.trim();
      const recordedAt = readYMD('recorded-date');
      const videoUrl = root.querySelector('#recorded-video-url').value.trim();
      if (!title || !recordedAt || !/^https?:\/\//i.test(videoUrl)) {
        toast('أكمل العنوان والتاريخ، وأدخل رابط تسجيل صحيحًا', 'info');
        return;
      }

      const record = {
        id: `recorded-${Date.now()}`,
        title,
        description: root.querySelector('#recorded-description').value.trim(),
        recordedAt,
        speaker: root.querySelector('#recorded-speaker').value.trim(),
        views: Number(root.querySelector('#recorded-views').value) || 0,
        duration: root.querySelector('#recorded-duration').value.trim(),
        videoUrl,
        image: imageData,
        createdAt: Date.now(),
        createdBy: currentMember.name
      };

      state.recordedMeetings = [record, ...(state.recordedMeetings || [])];
      await saveState();
      closeSheet();
      const result = await cloudRequest('saveRecordedMeeting', record);
      if (!result || result.success === false) {
        toast('حُفظ اللقاء على هذا الجهاز، وتعذرت مزامنته الآن', 'info');
      } else {
        toast('تمت إضافة اللقاء إلى الأرشيف', 'calendar');
      }
      openMeetingArchiveSheet();
    });
  });
}

function confirmDeleteRecordedMeeting(id) {
  if (!isSupervisor()) { toast('غير مصرح', 'info'); return; }
  const record = (state.recordedMeetings || []).find((item) => String(item.id) === String(id));
  if (!record) return;
  openConfirm({
    title: 'نقل اللقاء المسجل إلى سلة المحذوفات',
    text: `سيختفي تسجيل «${record.title}» من الأرشيف ويمكن استعادته لاحقًا.`,
    confirmLabel: 'نقل للسلة',
    onConfirm: async () => {
      const result = await cloudRequest('deleteRecordedMeeting', {
        id,
        deletedBy: currentMember ? currentMember.name : 'مشرف'
      });
      if (!result || result.success === false) {
        toast('تعذر نقل التسجيل إلى سلة المحذوفات؛ لم نحذفه.', 'info');
        return;
      }
      deletedRecordedMeetingIds.add(String(id));
      state.recordedMeetings = (state.recordedMeetings || []).filter((item) => String(item.id) !== String(id));
      await saveState();
      openMeetingArchiveSheet();
      toast('نُقل التسجيل إلى سلة المحذوفات', 'trash');
    }
  });
}

function getCurrentMeeting() {
  const meetings = (state && Array.isArray(state.meetings) ? state.meetings : [])
    .filter(Boolean)
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  return meetings[0] || DEFAULT_MEETING;
}

function meetingDateLabel(date) {
  if (!date) return 'موعد اللقاء يحدد قريبًا';
  const raw = date instanceof Date ? date.toISOString() : String(date).trim();
  const datePart = raw.match(/\d{4}-\d{2}-\d{2}/);
  const parsed = datePart ? new Date(`${datePart[0]}T12:00:00`) : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return new Intl.DateTimeFormat('ar-u-ca-gregory-nu-arab', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(parsed);
}

function meetingTimeLabel(time) {
  if (!time) return '';
  const raw = time instanceof Date ? time.toISOString() : String(time).trim();
  // Extract raw HH:MM without timezone conversion (supports "16:23", "16:23:00", ISO with T)
  let match = raw.match(/(?:T|^)(\d{1,2}):(\d{2})(?::\d{2})?/);
  let hourText;
  let minuteText;
  if (match) {
    hourText = match[1];
    minuteText = match[2];
  } else {
    // Fallback only if no raw time found; avoid shifting if raw is Date object from sheet
    return raw.replace(/[A-Z]/g, '').trim();
  }
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return raw;
  const hour12 = hour % 12 || 12;
  return `${toAr(hour12)}:${toAr(String(minute).padStart(2, '0'))} ${hour >= 12 ? 'مساءً' : 'صباحاً'}`;
}

function meetingLocationUrl(location) {
  const text = String(location || '').trim();
  if (!text) return '';
  if (normalizeName(text).includes(normalizeName('جمعية التنمية الأهلية ببريدة'))) {
    return 'https://maps.app.goo.gl/coNLQqZzvgE2PBD37';
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

function renderMeetingCard() {
  const root = $('#meeting-event-card');
  if (!root || !state) return;
  const meeting = getCurrentMeeting();
  const dateLabel = meetingDateLabel(meeting.date);
  const timeLabel = meetingTimeLabel(meeting.time || meeting.date);
  const locationUrl = meetingLocationUrl(meeting.location);
  const cropStyle = meeting.image
    ? `object-position:${clamp(Number(meeting.imagePosX) || 50, 0, 100)}% ${clamp(Number(meeting.imagePosY) || 50, 0, 100)}%;transform:scale(${(clamp(Number(meeting.imageScale) || 100, 100, 300) / 100).toFixed(2)})`
    : '';
  const imageMarkup = meeting.image
    ? `<img class="meeting-poster" style="${cropStyle}" src="${esc(meeting.image)}" alt="إعلان ${esc(meeting.title || 'اللقاء')}" loading="lazy">`
    : `<div class="meeting-poster-placeholder"><svg class="ic"><use href="#i-calendar"/></svg><span>لقاء جليس القادم</span></div>`;

  root.innerHTML = `
    <article class="meeting-card">
      <div class="meeting-poster-wrap">${imageMarkup}</div>
      <div class="meeting-card-content">
        <div class="meeting-card-kicker"><span class="meeting-pulse"></span> اللقاء القادم في جليس</div>
        <h3>${esc(meeting.title || 'لقاء نادي جليس')}</h3>
        ${meeting.description ? `<p class="meeting-description">${esc(meeting.description)}</p>` : ''}
        <div class="meeting-details-grid">
          <div class="meeting-detail"><span class="meeting-detail-icon"><svg class="ic"><use href="#i-calendar"/></svg></span><span><small>التاريخ</small><b>${esc(dateLabel)}</b></span></div>
          ${timeLabel ? `<div class="meeting-detail"><span class="meeting-detail-icon"><svg class="ic"><use href="#i-clock"/></svg></span><span><small>الوقت</small><b>${esc(timeLabel)}</b></span></div>` : ''}
          ${meeting.location ? `<a class="meeting-detail meeting-location meeting-detail-link" href="${esc(locationUrl)}" target="_blank" rel="noopener noreferrer"><span class="meeting-detail-icon"><svg class="ic"><use href="#i-pin"/></svg></span><span><small>المكان · افتح الخريطة</small><b>${esc(meeting.location)}</b></span></a>` : ''}
        </div>
        <div class="meeting-card-actions">
          <button class="btn btn-sm btn-primary" type="button" data-action="meeting" data-id="${esc(meeting.id)}">تفاصيل اللقاء</button>
          ${isSupervisor() ? `<button class="btn btn-sm btn-meeting-add" type="button" data-action="add-meeting"><svg class="ic"><use href="#i-plus"/></svg> إضافة لقاء</button>` : ''}
        </div>
      </div>
    </article>`;
}

function compressMeetingImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      let scale = Math.min(1, 640 / image.width, 1000 / image.height);
      let dataUrl = '';
      for (let attempt = 0; attempt < 12; attempt++) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const quality = Math.max(0.38, 0.76 - attempt * 0.035);
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= 44000) break;
        scale *= 0.84;
      }
      URL.revokeObjectURL(objectUrl);
      if (!dataUrl || dataUrl.length > 48000) {
        reject(new Error('تعذر ضغط الصورة للحجم المناسب. اختر صورة أصغر.'));
        return;
      }
      resolve(dataUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('تعذر قراءة الصورة المحددة.'));
    };
    image.src = objectUrl;
  });
}

let currentMember = null;
let state = null;
let approvedMembersCache = [];

/* قصّ يدوي كما في الآيفون: صورة كاملة + إطار قابل للسحب وتغيير الحجم + شبكة + أبعاد بكسل */
function createCropControls(wrap, previewImg) {
  const stage = document.createElement('div');
  stage.className = 'drag-crop-stage full-image';
  if (previewImg && previewImg.parentElement === wrap) {
    wrap.insertBefore(stage, previewImg);
    stage.appendChild(previewImg);
  } else {
    wrap.appendChild(stage);
    if (previewImg) stage.appendChild(previewImg);
  }
  previewImg.style.display = 'block';
  previewImg.style.width = '100%';
  previewImg.style.height = 'auto';
  previewImg.style.objectFit = 'contain';

  const box = document.createElement('div');
  box.className = 'drag-crop-box';
  box.innerHTML = `
    <div class="drag-crop-frame" role="application" aria-label="تحديد أطراف الصورة">
      <span class="drag-crop-grid"></span>
      <span class="drag-crop-handle tl"></span><span class="drag-crop-handle tr"></span>
      <span class="drag-crop-handle bl"></span><span class="drag-crop-handle br"></span>
      <span class="drag-crop-handle tm"></span><span class="drag-crop-handle bm"></span>
      <span class="drag-crop-handle lm"></span><span class="drag-crop-handle rm"></span>
    </div>
  `;
  stage.appendChild(box);

  const controls = document.createElement('div');
  controls.className = 'crop-size-controls';
  controls.innerHTML = `
    <div class="crop-size-row">
      <label>العرض (بكسل) <input type="number" class="crop-w" min="80" max="1400" step="10" value="640"></label>
      <label>الطول (بكسل) <input type="number" class="crop-h" min="80" max="1400" step="10" value="420"></label>
    </div>
    <div class="crop-size-presets">
      <button type="button" data-preset="640x420">٤:٣ إعلان</button>
      <button type="button" data-preset="1080x1350">٤:٥ بوست</button>
      <button type="button" data-preset="1200x630">١:٢ بطولي</button>
      <button type="button" data-preset="800x800">مربع</button>
    </div>
    <div class="drag-crop-hint">اسحب الإطار لتحديد الجزء المطلوب — أو اكتب العرض والطول يدويًا</div>
  `;
  wrap.appendChild(controls);

  const widthInput = controls.querySelector('.crop-w');
  const heightInput = controls.querySelector('.crop-h');
  const frame = box.querySelector('.drag-crop-frame');
  const crop = { width: 640, height: 420, x: 0, y: 0, zoom: 1 };

  /* حالة الإطار كنِسَب مئوية من الصورة */
  let fx = 0, fy = 0, fw = 100, fh = 100;
  const imageRatio = { w: 1, h: 1 };
  const updateImageRatio = () => {
    if (previewImg && previewImg.naturalWidth && previewImg.naturalHeight) {
      imageRatio.w = previewImg.naturalWidth;
      imageRatio.h = previewImg.naturalHeight;
    }
  };
  if (previewImg && previewImg.complete) updateImageRatio();
  if (previewImg) previewImg.addEventListener('load', updateImageRatio);

  const paint = () => {
    frame.style.left = fx + '%';
    frame.style.top = fy + '%';
    frame.style.width = fw + '%';
    frame.style.height = fh + '%';
    // الأبعاد الفعلية بالمظهر: البكسل = نسبة من الصورة الأصلية
    crop.x = fx / 100;
    crop.y = fy / 100;
    crop.zoom = fw / 100;
    const pxW = Math.round(imageRatio.w * (fw / 100));
    const pxH = Math.round(imageRatio.h * (fh / 100));
    crop.width = clamp(pxW, 80, 1400);
    crop.height = clamp(pxH, 80, 1400);
    widthInput.value = crop.width;
    heightInput.value = crop.height;
  };

  const setPointer = (e, onMove) => {
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const oX = fx, oY = fy, oW = fw, oH = fh;
    const move = (ev) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      onMove(dx, dy, oX, oY, oW, oH);
      paint();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* زوايا الأركان — تعديل الطول والعرض مع الحفاظ على الزاوية المقابلة */
  const corner = (name, xDir, yDir) => {
    const el = frame.querySelector(`.drag-crop-handle.${name}`);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => setPointer(e, (dx, dy, oX, oY, oW, oH) => {
      const nW = clamp(xDir > 0 ? oW + dx : oW - dx, 12, 100 - (xDir > 0 ? oX : 0));
      const nH = clamp(yDir > 0 ? oH + dy : oH - dy, 12, 100 - (yDir > 0 ? oY : 0));
      fw = nW; fh = nH;
      if (xDir < 0) fx = clamp(oX + oW - nW, 0, 100 - nW);
      if (yDir < 0) fy = clamp(oY + oH - nH, 0, 100 - nH);
    }));
  };
  corner('tl', -1, -1);
  corner('tr', 1, -1);
  corner('bl', -1, 1);
  corner('br', 1, 1);

  /* المقابض الجانبية */
  const edge = (name, axis, dir) => {
    const el = frame.querySelector(`.drag-crop-handle.${name}`);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => setPointer(e, (dx, dy, oX, oY, oW, oH) => {
      if (axis === 'x') {
        const nW = clamp(dir > 0 ? oW + dx : oW - dx, 12, 100 - (dir > 0 ? oX : 0));
        fw = nW;
        if (dir < 0) fx = clamp(oX + oW - nW, 0, 100 - nW);
      } else {
        const nH = clamp(dir > 0 ? oH + dy : oH - dy, 12, 100 - (dir > 0 ? oY : 0));
        fh = nH;
        if (dir < 0) fy = clamp(oY + oH - nH, 0, 100 - nH);
      }
    }));
  };
  edge('lm', 'x', -1);
  edge('rm', 'x', 1);
  edge('tm', 'y', -1);
  edge('bm', 'y', 1);

  /* تحريك الإطار نفسه */
  frame.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('drag-crop-handle')) return;
    setPointer(e, (dx, dy, oX, oY, oW, oH) => {
      fx = clamp(oX + dx, 0, 100 - oW);
      fy = clamp(oY + dy, 0, 100 - oH);
    });
  });

  widthInput.addEventListener('input', () => {
    const want = clamp(Number(widthInput.value) || 640, 80, 1400);
    fw = clamp((want / Math.max(1, imageRatio.w)) * 100, 12, 100);
    paint();
  });
  heightInput.addEventListener('input', () => {
    const want = clamp(Number(heightInput.value) || 420, 80, 1400);
    fh = clamp((want / Math.max(1, imageRatio.h)) * 100, 12, 100);
    paint();
  });
  controls.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [w, h] = btn.dataset.preset.split('x').map(Number);
      // اضبط نسبة الإطار على الصورة مع الحفاظ على المركز
      const targetRatio = w / h;
      let newW = fw;
      let newH = newW / targetRatio / (imageRatio.w / imageRatio.h);
      if (newH > 100) { newH = 100; newW = newH * targetRatio * (imageRatio.w / imageRatio.h); }
      fw = clamp(newW, 12, 100);
      fh = clamp(newH, 12, 100);
      fx = clamp(fx + (fw - newW) / 2, 0, 100 - fw);
      fy = clamp(fy + (fh - newH) / 2, 0, 100 - fh);
      paint();
    });
  });
  paint();
  return crop;
}

/* قصّ الصورة فعليًا حسب الجزء المحدد (x/y/zoom) والأبعاد */
function cropImageDataUrl(dataUrl, size) {
  return new Promise((resolve) => {
    if (!dataUrl) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const targetW = clamp(Number(size && size.width) || 640, 80, 1400);
        const targetH = clamp(Number(size && size.height) || 420, 80, 1400);
        const zoom = clamp(Number(size && size.zoom) || 1, 0.05, 1);
        const cropW = Math.max(1, Math.round(img.width * zoom));
        const cropH = Math.max(1, Math.round(img.height * zoom * (targetH / targetW) * (targetW / targetH) * (cropW / cropW)));
        const hRatio = targetH / targetW;
        const finalH = Math.max(1, Math.round(cropW * hRatio));
        const maxX = Math.max(0, img.width - cropW);
        const maxY = Math.max(0, img.height - finalH);
        const x = clamp(Math.round((Number(size && size.x) || 0) * maxX), 0, maxX);
        const y = clamp(Math.round((Number(size && size.y) || 0) * maxY), 0, maxY);
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, x, y, cropW, finalH, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', 0.76));
      } catch (e) { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function dateYMDField(idPrefix, label) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const today = new Date();
  return `
  <span class="ymd-group" role="group" aria-label="${label || 'التاريخ'}">
    <label>سنة <select class="input ymd-y" id="${idPrefix}-y">${years.map((y) => `<option value="${y}" ${y === today.getFullYear() ? 'selected' : ''}>${toAr(y)}</option>`).join('')}</select></label>
    <label>شهر <select class="input ymd-m" id="${idPrefix}-m">${months.map((m) => `<option value="${m}" ${m === today.getMonth() + 1 ? 'selected' : ''}>${toAr(m)}</option>`).join('')}</select></label>
    <label>يوم <select class="input ymd-d" id="${idPrefix}-d">${days.map((d) => `<option value="${d}" ${d === today.getDate() ? 'selected' : ''}>${toAr(d)}</option>`).join('')}</select></label>
    <input type="hidden" id="${idPrefix}-hidden">
  </span>`;
}
function readYMD(idPrefix) {
  const y = document.getElementById(`${idPrefix}-y`);
  const m = document.getElementById(`${idPrefix}-m`);
  const d = document.getElementById(`${idPrefix}-d`);
  if (!y || !m || !d) return '';
  const mm = String(m.value).padStart(2, '0');
  const dd = String(d.value).padStart(2, '0');
  return `${y.value}-${mm}-${dd}`;
}

function cacheApprovedMembers(list) {
  if (Array.isArray(list)) approvedMembersCache = list.slice();
}
function photoByName(name) {
  const key = normalizeName(name);
  if (!key) return '';
  if (currentMember && normalizeName(currentMember.name) === key) {
    return (state && state.profile && state.profile.photo) || currentMember.photo || '';
  }
  const found = approvedMembersCache.find((m) => normalizeName(m.name) === key);
  if (found && found.photo) return String(found.photo);
  return '';
}

function memberPhoto(name, explicitPhoto) {
  if (explicitPhoto) return explicitPhoto;
  return photoByName(name) || '';
}

async function refreshApprovedMembersCache() {
  try {
    const result = await cloudRequest('getApprovedMembers');
    if (result && result.success === true && Array.isArray(result.data)) {
      cacheApprovedMembers(result.data);
      return result.data;
    }
  } catch (error) { /* تجاهل */ }
  return [];
}

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
          savedArticles: [],
          seenQuotes: 0,
          seenArticles: 0,
          seenClubBooks: 0
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
    savedArticles: Array.isArray(parsed.savedArticles) ? parsed.savedArticles : [],
    seenQuotes: Number(parsed.seenQuotes) || 0,
    seenArticles: Number(parsed.seenArticles) || 0,
    seenClubBooks: Number(parsed.seenClubBooks) || 0,
    meetings: Array.isArray(parsed.meetings) ? parsed.meetings : []
  };
}

async function saveState() {
  if (!state || !currentMember) return;
  if (currentMember.id === 'guest') return; /* لا نحفظ حالة الزائر */
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

const cloudBookRatingsCache = new Map();

function getBookRatings(bookId) {
  try {
    const raw = localStorage.getItem(`jalees-book-ratings:${bookId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* use in-memory cloud cache below */ }
  return cloudBookRatingsCache.get(String(bookId)) || [];
}

function saveBookRating(bookId, rating, review) {
  if (!currentMember || currentMember.id === 'guest') return Promise.resolve({ success: false, error: 'guest' });
  const ratings = getBookRatings(bookId);
  const existing = ratings.findIndex((r) => r.memberId === currentMember.id);
  const entry = { memberId: currentMember.id, memberName: state.profile.name, rating, review, createdAt: Date.now() };
  if (existing >= 0) ratings[existing] = entry;
  else ratings.push(entry);
  cloudBookRatingsCache.set(String(bookId), ratings);
  try { localStorage.setItem(`jalees-book-ratings:${bookId}`, JSON.stringify(ratings)); } catch (e) {}
  return cloudRequest('saveBookRating', { bookId, ...entry });
}

async function refreshBookRatingsFromCloud() {
  const member = currentMember;
  const result = await cloudRequest('getBookRatings');
  if (!result || result.success !== true || !Array.isArray(result.data)) return;

  const cloudByBook = new Map();
  result.data.forEach((rating) => {
    if (!rating || !rating.bookId || !rating.memberId) return;
    const key = String(rating.bookId);
    if (!cloudByBook.has(key)) cloudByBook.set(key, []);
    cloudByBook.get(key).push({
      ...rating,
      rating: Number(rating.rating) || 0,
      createdAt: Number(rating.createdAt) || 0
    });
  });

  const keys = new Set([...cloudByBook.keys()]);
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('jalees-book-ratings:')) keys.add(key.slice('jalees-book-ratings:'.length));
    });
  } catch (e) {}

  for (const bookId of keys) {
    const mergedByMember = new Map();
    (cloudByBook.get(bookId) || []).forEach((rating) => mergedByMember.set(String(rating.memberId), rating));
    const localRatings = getBookRatings(bookId);
    localRatings.forEach((rating) => {
      if (!rating || !rating.memberId) return;
      const key = String(rating.memberId);
      const cloudRating = mergedByMember.get(key);
      if (!cloudRating || Number(rating.createdAt || 0) > Number(cloudRating.createdAt || 0)) {
        mergedByMember.set(key, rating);
      }
    });
    const merged = [...mergedByMember.values()].sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    cloudBookRatingsCache.set(String(bookId), merged);
    if (member && member.id !== 'guest') {
      try { localStorage.setItem(`jalees-book-ratings:${bookId}`, JSON.stringify(merged)); } catch (e) {}
    }
  }

  // Push locally cached reviews that are not yet present in the shared sheet.
  if (member && member.id !== 'guest') {
    const cloudKeys = new Set(result.data.map((rating) => `${rating.bookId}:${rating.memberId}:${rating.createdAt}`));
    const pending = [];
    keys.forEach((bookId) => {
      getBookRatings(bookId).forEach((rating) => {
        const key = `${bookId}:${rating.memberId}:${rating.createdAt}`;
        if (!cloudKeys.has(key)) pending.push({ bookId, ...rating });
      });
    });
    for (const rating of pending) await cloudRequest('saveBookRating', rating);
  }
}

function getAverageRating(bookId, seedRating) {
  const ratings = getBookRatings(bookId);
  if (!ratings.length) return seedRating || 0;
  const sum = ratings.reduce((s, r) => s + (r.rating || 0), 0);
  return (sum / ratings.length).toFixed(1);
}

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
  if (book.coverImage) {
    return `
      <div class="cover cover-image" aria-label="غلاف ${esc(book.title)}">
        <img class="cover-image-source" src="${esc(book.coverImage)}" alt="غلاف كتاب ${esc(book.title)}" loading="lazy">
        <span class="cover-frame" aria-hidden="true"></span>
      </div>`;
  }
  const coverStart = book.c1 || book.coverColor || '#1E3A2B';
  const coverEnd = book.c2 || book.coverColor2 || '#3D5A4C';
  return `
    <div class="cover" style="background:linear-gradient(150deg, ${coverStart}, ${coverEnd})">
      <span class="cover-frame" aria-hidden="true"></span>
      <div class="cover-kicker">نادي جليس</div>
      <div>
        <div class="cover-mark">ج</div>
        <div class="cover-title">${esc(book.title)}</div>
        <div class="cover-author">${esc(book.author)}</div>
      </div>
    </div>`;
}

function avatarHTML(name, color, cls = 'avatar-mini', photo = '') {
  const resolvedPhoto = memberPhoto(name, photo);
  const safePhoto = /^data:image\/(?:jpeg|png|webp);base64,/i.test(String(resolvedPhoto || '')) ? String(resolvedPhoto) : '';
  return `<span class="${cls}" style="background:linear-gradient(135deg, ${color}, #14291D)">${safePhoto ? `<img class="avatar-photo-image" src="${esc(safePhoto)}" alt="صورة ${esc(name)}">` : esc(initials(name))}</span>`;
}

function articleAuthorPhoto(article) {
  if (!article) return '';
  return (isMine(article) && state && state.profile && state.profile.photo)
    || (isMine(article) && currentMember && currentMember.photo)
    || article.authorPhoto
    || '';
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
      ${avatarHTML(member.name, member.color, 'board-avatar', memberPhoto(member.name, member.photo))}
      <div class="board-info">
        <button class="board-member-name" type="button" data-action="open-member-profile" data-name="${esc(member.name)}">${esc(member.name)}${member.isMe ? ' · أنت' : ''}</button>
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
/* كل المقالات المنشورة في المجلة — تظهر لجميع الزوار والأعضاء */
function visibleMemberArticles() {
  return state && Array.isArray(state.articles)
    ? state.articles.slice().sort((a, b) => articleTimestamp(b) - articleTimestamp(a))
    : [];
}

function articleTimestamp(article) {
  const value = article && article.createdAt;
  if (value instanceof Date) return value.getTime();
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(String(value || ''));
  if (Number.isFinite(parsed)) return parsed;
  // Legacy locally-created article IDs include their creation timestamp (a-<milliseconds>).
  const idTimestamp = String(article && article.id || '').match(/(\d{10,})$/);
  return idTimestamp ? Number(idTimestamp[1]) : 0;
}

function renderHome() {
  const firstName = state.profile.name.trim().split(/\s+/)[0] || 'عضو جليس';

  const latestQuotes = $('#home-latest-quotes');
  if (latestQuotes) {
    const quotes = (state.quotes || []).slice(0, 1);
    latestQuotes.innerHTML = quotes.length
      ? quotes.map((quote, idx) => quoteCardHTML(quote, { compact: true, latest: idx === 0, rank: idx + 1, number: quoteSerialNumber(quote) })).join('')
      : '';
  }

  $('#today-label').textContent = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-arab', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());
  $('#home-first-name').textContent = firstName;

  const featuredBooks = BOOKS.filter((book) => book.pick).concat(state.clubBooks || []).slice(0, 4);
  $('#home-books').innerHTML = featuredBooks.map((book) => `
    <button class="book-mini" type="button" data-action="book" data-id="${book.id}" aria-label="${esc(book.title)}">
      ${coverHTML(book)}
      <h4>${esc(book.title)}</h4>
      <p>${esc(book.author)}</p>
    </button>`).join('');

  const article = visibleMemberArticles()[0];
  $('#home-article').innerHTML = article ? `
    <div class="ha-thumb"><svg class="ic"><use href="#i-article"/></svg></div>
    <div class="ha-body">
      <span class="chip chip-soft">${esc(article.category)}</span>
      <h4>${esc(article.title)}</h4>
      <div class="ha-meta"><button class="ha-author" type="button" data-action="open-member-profile" data-name="${esc(authorNameOf(article))}">${esc(authorNameOf(article))}</button><span>·</span><span>${toAr(article.read || 3)} دقائق قراءة</span></div>
    </div>` : emptyHTML('article', 'لا مقالات متاحة حاليًا', 'ستظهر هنا أحدث مقالات أعضاء جليس.');
  $('#home-article').dataset.action = article ? 'open-article' : '';
  if (article) $('#home-article').dataset.id = article.id;

  renderMeetingCard();

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
  const rest = [...(state.clubBooks || []), ...BOOKS].filter((book) => !mineIds.has(book.id));

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
        <button class="podium-name" type="button" data-action="open-member-profile" data-name="${esc(member.name)}">${esc(member.name)}</button>
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
function quoteSerialNumber(quote) {
  const quotes = state && Array.isArray(state.quotes) ? state.quotes : [];
  const index = quotes.findIndex((item) => item.id === quote.id);
  // الاقتباسات مرتبة من الأحدث إلى الأقدم؛ لذا نعكس الفهرس ليبدأ الأقدم بالرقم ١.
  return index < 0 ? 1 : quotes.length - index;
}

function quoteCardHTML(quote, options = {}) {
  const liked = state.likedQuotes.includes(quote.id);
  const saved = state.savedQuotes.includes(quote.id);
  const name = authorNameOf(quote);
  const color = authorColorOf(quote);
  const likes = Number(quote.likes || 0) + (liked ? 1 : 0);
  const canDelete = isSupervisor();
  const compact = Boolean(options.compact);
  const cardClasses = `quote-card${compact ? ' quote-card-compact' : ' quote-card-numbered'}${options.latest ? ' quote-latest' : ''}`;
  return `
    <article class="${cardClasses}">
      ${compact ? `<div class="home-quote-eyebrow"><span class="quote-number-stamp"><b class="quote-number-badge">${toAr(options.number || quoteSerialNumber(quote))}</b><img class="quote-number-image" src="quote-marks.svg" alt="" aria-hidden="true"></span>${options.latest ? '<span class="quote-new-badge">جديد</span>' : ''}</div>` : `<div class="quote-serial"><span class="quote-number-stamp"><b class="quote-number-badge">${toAr(options.number || quoteSerialNumber(quote))}</b><img class="quote-number-image" src="quote-marks.svg" alt="" aria-hidden="true"></span></div>`}
      <p class="quote-text">${esc(quote.text)}</p>
      <div class="quote-source">${esc(quote.book || 'من هامش القراءة')}${quote.page ? `<span> · ص ${esc(quote.page)}</span>` : ''}</div>
      <div class="quote-foot">
        <div class="quote-author">
          <button class="quote-author-link" type="button" data-action="open-member-profile" data-name="${esc(name)}">
            ${avatarHTML(name, color)}
            <div><strong>${esc(name)}${isMine(quote) ? ' · أنت' : ''}</strong><small>${esc(quote.time || '')}</small></div>
          </button>
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
          ${canDelete ? `<button type="button" data-action="delete-quote" data-id="${quote.id}" class="danger" aria-label="حذف الاقتباس">
            <svg class="ic"><use href="#i-trash"/></svg>
          </button>` : ''}
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
  if (filter === 'popular') {
    list = list.slice().sort((a, b) => {
      const likesA = Number(a.likes || 0) + (state.likedQuotes.includes(a.id) ? 1 : 0);
      const likesB = Number(b.likes || 0) + (state.likedQuotes.includes(b.id) ? 1 : 0);
      return likesB - likesA || (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });
  }

  const labels = {
    all: ['فنجان قهوة وهامش', 'شارك أول اقتباس يوقفك عند كتاب.'],
    mine: ['لم تنشر اقتباساً بعد', 'اضغط «اقتبس» وشارك جملة من كتابك.'],
    saved: ['لا اقتباسات محفوظة', 'احفظ ما يلامسك لتعود إليه لاحقاً.'],
    popular: ['لا توجد اقتباسات بعد', 'ستظهر هنا الاقتباسات الأكثر إعجابًا.']
  };

  $('#quotes-feed').innerHTML = list.length
    ? list.map((quote) => quoteCardHTML(quote, { number: quoteSerialNumber(quote) })).join('')
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

function getLibraryCategoryOptions() {
  const configured = Array.isArray(state.libraryCategories) && state.libraryCategories.length
    ? state.libraryCategories
    : DEFAULT_BOOK_CATEGORIES;
  const values = [...configured, ...BOOKS.map((book) => book.category), ...(state.clubBooks || []).map((book) => book.category)];
  const unique = new Map();
  values.forEach((value) => {
    const name = String(value || '').trim();
    const key = normalizeName(name);
    if (name && key && !unique.has(key)) unique.set(key, name);
  });
  return [...unique.values()];
}

function renderCategoryChips() {
  const container = $('#category-chips');
  if (!container) return;
  const usedCategories = [...new Set([...BOOKS, ...(state.clubBooks || [])].map((book) => book.category).filter(Boolean))];
  const categories = ['all', ...usedCategories];
  container.hidden = state.libraryCategory === 'all' && !state.libraryQuery.trim();
  container.innerHTML = categories.map((category) => {
    const active = state.libraryCategory === category;
    return `<button class="chip-filter ${active ? 'active' : ''}" type="button" data-category="${esc(category)}" aria-selected="${active}">${category === 'all' ? 'الكل' : esc(category)}</button>`;
  }).join('');
}

function renderLibraryCategoryManager(root) {
  const list = root.querySelector('#library-category-manager-list');
  if (!list) return;
  const categories = getLibraryCategoryOptions();
  list.innerHTML = categories.length ? categories.map((category) => `
    <div class="library-category-manager-row">
      <span>${esc(category)}</span>
      <div class="library-category-manager-actions">
        <button class="icon-btn" type="button" data-action="rename-library-category" data-id="${encodeURIComponent(category)}" aria-label="إعادة تسمية الرف ${esc(category)}"><svg class="ic"><use href="#i-edit"/></svg></button>
        ${normalizeName(category) !== normalizeName('غير مصنف') ? `<button class="icon-btn library-shelf-delete" type="button" data-action="delete-library-category" data-id="${encodeURIComponent(category)}" aria-label="حذف رف ${esc(category)}"><svg class="ic"><use href="#i-trash"/></svg></button>` : ''}
      </div>
    </div>`).join('') : emptyHTML('library', 'لا توجد تصنيفات', 'أضف أول تصنيف للمكتبة.');
}

function openLibraryCategoryManager() {
  if (!isSupervisor()) { toast('إدارة رفوف المكتبة للمشرفين فقط', 'info'); return; }
  openSheet(`
    ${sheetHead('إدارة رفوف المكتبة', 'أضف رفًا أو غيّر اسم رف موجود')}
    <button class="btn btn-gold btn-block library-category-add" type="button" data-action="add-library-category"><svg class="ic"><use href="#i-plus"/></svg> إضافة رف</button>
    <div id="library-category-manager-list" class="library-category-manager-list"></div>`, (root) => {
    renderLibraryCategoryManager(root);
  });
}

function confirmDeleteLibraryCategory(category) {
  if (!isSupervisor()) { toast('حذف الرفوف للمشرفين فقط', 'info'); return; }
  if (normalizeName(category) === normalizeName('غير مصنف')) {
    toast('لا يمكن حذف رف غير مصنف', 'info');
    return;
  }
  openConfirm({
    title: 'نقل الرف إلى سلة المحذوفات',
    text: `سيختفي رف «${category}» من المكتبة، وستُنقل كتبه إلى «غير مصنف». يمكنك استعادة الرف وكتبه من سلة المحذوفات.`,
    confirmLabel: 'نقل إلى السلة',
    onConfirm: async () => {
      const result = await cloudRequest('deleteLibraryCategory', {
        id: category,
        deletedBy: currentMember.name
      });
      if (!result || result.success === false) {
        toast(result && result.error ? result.error : 'تعذر نقل الرف إلى السلة', 'info');
        return;
      }
      state.libraryCategories = (state.libraryCategories || []).filter((name) => normalizeName(name) !== normalizeName(category));
      state.clubBooks = (state.clubBooks || []).map((book) => normalizeName(book.category) === normalizeName(category) ? { ...book, category: 'غير مصنف' } : book);
      if (normalizeName(state.libraryCategory) === normalizeName(category)) state.libraryCategory = 'all';
      await saveState();
      renderLibrary();
      await refreshLibraryCategoriesFromCloud();
      await refreshClubBooksFromCloud();
      toast('نُقل الرف إلى سلة المحذوفات دون حذف كتبه', 'check');
    }
  });
}

function openLibraryCategoryEditor(oldCategory = '') {
  if (!isSupervisor()) { toast('إدارة رفوف المكتبة للمشرفين فقط', 'info'); return; }
  const renaming = Boolean(oldCategory);
  openSheet(`
    ${sheetHead(renaming ? 'تعديل اسم الرف' : 'إضافة رف جديد', 'سيظهر الرف ضمن رفوف المكتبة')}
    <form id="library-category-form" novalidate>
      <div class="field"><label for="library-category-name">اسم الرف</label><input class="input" id="library-category-name" maxlength="50" value="${esc(oldCategory)}" required placeholder="مثال: حكايات سعودية"></div>
      <button class="btn btn-gold btn-block" type="submit">${renaming ? 'حفظ الاسم الجديد' : 'إضافة الرف'}</button>
    </form>`, (root) => {
    root.querySelector('#library-category-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!isSupervisor()) { toast('إدارة رفوف المكتبة للمشرفين فقط', 'info'); return; }
      const category = root.querySelector('#library-category-name').value.trim();
      if (!category) { toast('اكتب اسم التصنيف', 'info'); return; }
      if (oldCategory && normalizeName(category) === normalizeName(oldCategory)) { closeSheet(); return; }

      const result = await cloudRequest(renaming ? 'renameLibraryCategory' : 'addLibraryCategory', {
        oldCategory,
        category
      });
      if (!result || result.success === false) {
        toast(result && result.error ? result.error : 'تعذرت مزامنة التصنيف', 'info');
        return;
      }

      if (renaming) {
        state.libraryCategories = (state.libraryCategories || []).map((name) => normalizeName(name) === normalizeName(oldCategory) ? category : name);
        state.clubBooks = (state.clubBooks || []).map((book) => normalizeName(book.category) === normalizeName(oldCategory) ? { ...book, category } : book);
        state.personalBooks = (state.personalBooks || []).map((book) => normalizeName(book.category) === normalizeName(oldCategory) ? { ...book, category } : book);
        if (normalizeName(state.libraryCategory) === normalizeName(oldCategory)) state.libraryCategory = category;
      } else if (!(state.libraryCategories || []).some((name) => normalizeName(name) === normalizeName(category))) {
        state.libraryCategories = [...(state.libraryCategories || []), category];
      }

      await saveState();
      closeSheet();
      await refreshLibraryCategoriesFromCloud();
      await refreshClubBooksFromCloud();
      toast(renaming ? 'تم تعديل اسم الرف ومزامنته' : 'تمت إضافة الرف ومزامنته', 'check');
    });
  });
}

function libraryShelfTitle(category) {
  return category || 'مختارات جليس';
}

function libraryBookCardHTML(book) {
  const inLibrary = Boolean(getMyBook(book.id));
  const isClubBook = (state.clubBooks || []).some((item) => String(item.id) === String(book.id));
  return `
    <article class="book-shelf-card">
      <button class="book-mini" type="button" data-action="book" data-id="${esc(book.id)}" aria-label="${esc(book.title)}">
        ${book.coverImage
          ? `<div class="cover cover-image"><img class="cover-image-source" src="${esc(book.coverImage)}" alt="غلاف ${esc(book.title)}" loading="lazy"></div>`
          : coverHTML(book)}
        <h4>${esc(book.title)}</h4>
        <p>${esc(book.author)}${book.year ? ` · ${toAr(book.year)}` : ''}</p>
      </button>
      <div class="book-shelf-meta">
        <button class="book-shelf-rating" type="button" data-action="view-ratings" data-id="${esc(book.id)}" aria-label="عرض آراء الكتاب">
          <svg class="ic"><use href="#i-star"/></svg>${toAr(getAverageRating(book.id, book.rating))}<span>(${toAr(getBookRatings(book.id).length)})</span>
        </button>
        ${inLibrary ? '<span class="book-in-my-library">في مكتبتي</span>' : ''}
      </div>
      ${(isSupervisor() && isClubBook) || !isGuest() ? `<div class="book-shelf-actions">
        ${!isGuest() ? `<button class="book-shelf-rate" type="button" data-action="rate-book" data-id="${esc(book.id)}">قيّم</button>` : ''}
        ${isSupervisor() && isClubBook ? `<button class="book-shelf-edit" type="button" data-action="edit-club-book" data-id="${esc(book.id)}" aria-label="تعديل الكتاب"><svg class="ic"><use href="#i-edit"/></svg></button><button class="book-shelf-delete" type="button" data-action="delete-club-book" data-id="${esc(book.id)}" aria-label="حذف الكتاب"><svg class="ic"><use href="#i-trash"/></svg></button>` : ''}
      </div>` : ''}
    </article>`;
}

function renderClubBooks() {
  const query = state.libraryQuery.trim().toLowerCase();
  const allBooksById = new Map();
  [...(state.clubBooks || []), ...BOOKS].forEach((book) => {
    if (book && book.id) allBooksById.set(String(book.id), book);
  });
  const allBooks = [...allBooksById.values()].filter((book) => {
    const matchesCategory = state.libraryCategory === 'all' || book.category === state.libraryCategory;
    const title = String(book.title || '').toLowerCase();
    const author = String(book.author || '').toLowerCase();
    const matchesQuery = !query || title.includes(query) || author.includes(query);
    return matchesCategory && matchesQuery;
  }).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

  const countLabel = $('#library-count-label');
  if (countLabel) countLabel.textContent = 'مكتبة جليس';
  const container = $('#club-books');
  if (!container) return;
  if (!allBooks.length) {
    container.innerHTML = emptyHTML('search', 'لا توجد نتائج', 'جرّب عنواناً آخر أو أزل تصفية التصنيف.');
    return;
  }

  if (query || state.libraryCategory !== 'all') {
    const title = query ? 'نتائج البحث' : libraryShelfTitle(state.libraryCategory);
    container.innerHTML = `<section class="book-shelf-section"><div class="book-shelf-heading"><div><h3>${esc(title)}</h3><p>${toAr(allBooks.length)} كتب</p></div></div><div class="book-rail">${allBooks.map(libraryBookCardHTML).join('')}</div></section>`;
    return;
  }

  const shelves = new Map();
  allBooks.forEach((book) => {
    const category = book.category || 'مختارات جليس';
    if (!shelves.has(category)) shelves.set(category, []);
    shelves.get(category).push(book);
  });

  container.innerHTML = [...shelves.entries()].map(([category, books]) => `
    <section class="book-shelf-section">
      <div class="book-shelf-heading">
        <div><h3>${esc(libraryShelfTitle(category))}</h3><p>${esc(category)} · ${toAr(books.length)} كتب</p></div>
        <div class="book-shelf-heading-actions">
          ${isSupervisor() ? `<button class="book-shelf-more book-shelf-edit-category" type="button" data-action="rename-library-category" data-id="${encodeURIComponent(category)}" aria-label="تعديل اسم رف ${esc(category)}"><svg class="ic"><use href="#i-edit"/></svg></button>` : ''}
          <button class="book-shelf-more" type="button" data-category="${esc(category)}" aria-label="استعرض رف ${esc(category)}"><svg class="ic"><use href="#i-chevron-left"/></svg></button>
        </div>
      </div>
      ${books.length ? `<div class="book-rail">${books.map(libraryBookCardHTML).join('')}</div>` : `<p class="book-shelf-empty">رف جديد بانتظار الكتب.</p>`}
    </section>`).join('');
}

function openAddBook() {
  const bookCategories = getLibraryCategoryOptions();
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
          ${bookCategories.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}
          ${bookCategories.length ? '' : '<option>متنوع</option>'}
        </select>
      </div>
      <div class="field">
        <label for="add-book-report">تقرير عن الكتاب</label>
        <textarea class="input" id="add-book-report" rows="5" placeholder="اكتب تقرير الكتاب… اترك سطرًا فارغًا بين الفقرات لتنسيقها."></textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="add-book-pages">عدد الصفحات</label>
          <input class="input" id="add-book-pages" type="number" min="1" max="5000" placeholder="مثال: 320">
        </div>
        <div class="field">
          <label for="add-book-year">سنة النشر</label>
          <input class="input" id="add-book-year" type="number" min="1" max="2100" placeholder="مثال: 2020">
        </div>
      </div>
      <div class="field">
        <label for="add-book-color">لون الغلاف (إذا لم تختر صورة)</label>
        <input class="input" id="add-book-color" type="color" value="#1E3A2B">
      </div>
      <div class="field">
        <label for="add-book-image">صورة غلاف الكتاب (اختياري)</label>
        <input class="input" id="add-book-image" type="file" accept="image/*">
        <div class="image-preview crop-preview-wrap" id="image-preview" hidden></div>
        <small id="add-book-image-status" class="meeting-image-status"></small>
      </div>
      <button class="btn btn-primary btn-block" type="submit">
        <svg class="ic"><use href="#i-plus"/></svg> إضافة الكتاب
      </button>
    </form>`, (root) => {
    const imageInput = root.querySelector('#add-book-image');
    const preview = root.querySelector('#image-preview');
    const status = root.querySelector('#add-book-image-status');
    let imageData = null;

    imageInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      status.textContent = 'جارٍ تجهيز الصورة…';
      try {
        imageData = await compressMeetingImage(file);
        preview.innerHTML = `<img src="${imageData}" alt="غلاف الكتاب" style="width:100%;max-height:260px;object-fit:contain;border-radius:10px"><button type="button" class="meeting-image-remove" id="add-book-image-remove" aria-label="إزالة الصورة">×</button>`;
        preview.hidden = false;
        status.textContent = 'الصورة جاهزة — تُعرض كاملة تلقائيًا';
        preview.querySelector('#add-book-image-remove')?.addEventListener('click', () => {
          imageData = null;
          imageInput.value = '';
          preview.innerHTML = '';
          preview.hidden = true;
          status.textContent = '';
        });
      } catch (error) {
        status.textContent = error.message || 'تعذر قراءة الصورة';
      }
    });

    root.querySelector('#add-book-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = root.querySelector('#add-book-title').value.trim();
      const author = root.querySelector('#add-book-author').value.trim() || 'مؤلف غير محدد';
      const category = root.querySelector('#add-book-category').value;
      const report = root.querySelector('#add-book-report').value.trim();
      const pages = Number(root.querySelector('#add-book-pages').value) || 0;
      const year = Number(root.querySelector('#add-book-year').value) || '';
      const color = root.querySelector('#add-book-color').value;

      if (!title) {
        toast('يرجى إدخال عنوان الكتاب', 'info');
        return;
      }

      const finalCover = imageData || null;
      const newBook = {
        id: `club-${Date.now()}`,
        title,
        author,
        category,
        report,
        pages,
        year,
        coverColor: color,
        coverImage: finalCover,
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
      updateNavBadges();
      // حفظ فوري في الشيت حتى لا تضيع السنة
      try {
        const result = await saveClubBookToCloud(currentMember, newBook);
        if (result && result.success === true) {
          syncState.clubBooks.add(newBook.id);
          persistSyncState(currentMember.id);
          toast(`تمت إضافة «${title}» لمكتبة النادي`, 'book');
        } else {
          toast('أُضيف على هذا الجهاز، وسيُرفع للشيت عند عودة الاتصال', 'info');
        }
      } catch (e) {
        toast('أُضيف على هذا الجهاز، وسيُرفع للشيت عند عودة الاتصال', 'info');
      }
      celebrate();
    });
  });
}

function openEditClubBook(bookId) {
  if (!isSupervisor()) { toast('تعديل كتب النادي للمشرفين فقط', 'info'); return; }
  const book = (state.clubBooks || []).find((item) => String(item.id) === String(bookId));
  if (!book) { toast('لم أجد الكتاب في مكتبة النادي', 'info'); return; }

  const categories = getLibraryCategoryOptions();
  if (book.category && !categories.some((name) => normalizeName(name) === normalizeName(book.category))) {
    categories.unshift(book.category);
  }
  const initialColor = /^#[0-9a-f]{6}$/i.test(book.coverColor || '')
    ? book.coverColor
    : /^#[0-9a-f]{6}$/i.test(book.c1 || '') ? book.c1 : '#1E3A2B';

  openSheet(`
    ${sheetHead('تعديل بيانات الكتاب', book.title)}
    <form id="edit-club-book-form" class="meeting-form" novalidate>
      <div class="field"><label for="edit-club-book-title">عنوان الكتاب</label><input class="input" id="edit-club-book-title" maxlength="120" value="${esc(book.title)}" required></div>
      <div class="field"><label for="edit-club-book-author">المؤلف</label><input class="input" id="edit-club-book-author" maxlength="100" value="${esc(book.author || '')}"></div>
      <div class="field"><label for="edit-club-book-category">رف / تصنيف الكتاب</label><select class="input" id="edit-club-book-category">${categories.map((category) => `<option value="${esc(category)}" ${normalizeName(category) === normalizeName(book.category) ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></div>
      <div class="field"><label for="edit-club-book-report">تفاصيل الكتاب</label><textarea class="input" id="edit-club-book-report" rows="7" maxlength="6000" placeholder="اكتب الوصف، واترك سطرًا فارغًا بين الفقرات.">${esc(book.report || '')}</textarea></div>
      <div class="field-row"><div class="field"><label for="edit-club-book-pages">عدد الصفحات</label><input class="input" id="edit-club-book-pages" type="number" min="0" max="5000" value="${Number(book.pages) || ''}"></div><div class="field"><label for="edit-club-book-year">سنة النشر</label><input class="input" id="edit-club-book-year" type="number" min="1" max="2100" value="${Number(book.year) || ''}" placeholder="مثال: 2020"></div></div>
      <div class="field"><label for="edit-club-book-color">لون الغلاف</label><input class="input" id="edit-club-book-color" type="color" value="${initialColor}"></div>
      <div class="field">
        <label for="edit-club-book-image">صورة الغلاف</label>
        <label class="meeting-upload" for="edit-club-book-image"><svg class="ic"><use href="#i-article"/></svg><span>اختر صورة غلاف جديدة</span><small>اختيار صورة جديدة يستبدل الحالية</small></label>
        <input id="edit-club-book-image" class="meeting-file-input" type="file" accept="image/*">
        <div id="edit-club-book-image-preview-wrap" class="meeting-image-preview-wrap" ${book.coverImage ? '' : 'hidden'}>${book.coverImage ? `<img id="edit-club-book-image-preview" src="${esc(book.coverImage)}" alt="غلاف ${esc(book.title)}">` : '<img id="edit-club-book-image-preview" alt="معاينة الغلاف">'}<button type="button" class="meeting-image-remove" id="edit-club-book-image-remove" aria-label="إزالة الصورة">×</button></div>
        <small id="edit-club-book-image-status" class="meeting-image-status"></small>
      </div>
      <button class="btn btn-gold btn-block" type="submit"><svg class="ic"><use href="#i-check"/></svg> حفظ التعديلات</button>
    </form>`, (root) => {
    let imageData = book.coverImage || '';
    const fileInput = root.querySelector('#edit-club-book-image');
    const previewWrap = root.querySelector('#edit-club-book-image-preview-wrap');
    const preview = root.querySelector('#edit-club-book-image-preview');
    const status = root.querySelector('#edit-club-book-image-status');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast('اختر ملف صورة صالحًا', 'info');
        fileInput.value = '';
        return;
      }
      status.textContent = 'جارٍ تجهيز الصورة…';
      try {
        imageData = await compressMeetingImage(file);
        preview.src = imageData;
        previewWrap.hidden = false;
        status.textContent = 'الصورة الجديدة جاهزة';
      } catch (error) {
        fileInput.value = '';
        status.textContent = error.message;
      }
    });

    root.querySelector('#edit-club-book-image-remove').addEventListener('click', () => {
      imageData = '';
      fileInput.value = '';
      preview.removeAttribute('src');
      previewWrap.hidden = true;
      status.textContent = 'ستُحذف صورة الغلاف عند الحفظ';
    });

    root.querySelector('#edit-club-book-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!isSupervisor()) { toast('تعديل كتب النادي للمشرفين فقط', 'info'); return; }
      const title = root.querySelector('#edit-club-book-title').value.trim();
      if (!title) { toast('أدخل عنوان الكتاب', 'info'); return; }

      const updatedBook = {
        ...book,
        title,
        author: root.querySelector('#edit-club-book-author').value.trim() || 'مؤلف غير محدد',
        category: root.querySelector('#edit-club-book-category').value,
        report: root.querySelector('#edit-club-book-report').value,
        pages: Number(root.querySelector('#edit-club-book-pages').value) || 0,
        year: Number(root.querySelector('#edit-club-book-year').value) || '',
        coverColor: root.querySelector('#edit-club-book-color').value,
        coverImage: imageData,
        updatedAt: Date.now()
      };

      state.clubBooks = (state.clubBooks || []).map((item) => String(item.id) === String(bookId) ? updatedBook : item);
      await saveState();
      closeSheet();
      renderLibrary();
      renderHome();

      const result = await updateClubBookToCloud(updatedBook);
      if (!result || result.success === false) {
        toast('حُفظت التعديلات على هذا الجهاز، وتعذرت مزامنتها مع الشيت.', 'info');
        return;
      }
      refreshLibraryCategoriesFromCloud();
      toast('تم تحديث بيانات الكتاب ومزامنتها', 'check');
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
  const visibleArticles = visibleMemberArticles();
  const filtered = visibleArticles.filter((article) => {
    if (state.articleFilter === 'saved' && !state.savedArticles.includes(article.id)) return false;
    const cat = state.articleCategory || ARTICLE_CATEGORIES[0];
    if (cat !== ARTICLE_CATEGORIES[0] && cat !== 'all' && article.category !== cat) return false;
    return true;
  });

  $('#articles-list').innerHTML = filtered.length ? filtered.map((article) => {
    const saved = state.savedArticles.includes(article.id);
    return `
      <article class="article-row" data-action="open-article" data-id="${article.id}">
        <div class="ar-topline">
          <span class="chip chip-soft">${esc(article.category)}</span>
          <span class="ar-reading-time"><svg class="ic"><use href="#i-clock"/></svg>${toAr(article.read || 3)} دقائق</span>
        </div>
        <h3 class="ar-title">${esc(article.title)}</h3>
        <p class="ar-excerpt">${esc(article.excerpt || article.body || '')}</p>
        <div class="ar-bottomline">
          <div class="ar-meta"><button class="ar-author" type="button" data-action="open-member-profile" data-name="${esc(authorNameOf(article))}">${esc(authorNameOf(article))}</button><span>·</span><span>${esc(article.time || '')}</span></div>
          <div class="ar-actions">
            <button class="ar-save ${saved ? 'saved' : ''}" type="button" data-action="save-article" data-id="${article.id}" aria-label="حفظ المقال">
              <svg class="ic"><use href="#i-bookmark"/></svg>
            </button>
            ${isSupervisor() ? `<button class="ar-save" type="button" data-action="delete-article" data-id="${article.id}" aria-label="حذف المقال">
              <svg class="ic"><use href="#i-trash"/></svg>
            </button>` : ''}
          </div>
        </div>
      </article>`;
  }).join('') : emptyHTML('article', 'لا مقالات متاحة', 'ستظهر هنا أحدث مقالات مشعل الحفير.');
  renderArticleFilters();
}

function getArticleCategoryOptions() {
  const options = [];
  const seen = new Set();
  const add = (value) => {
    const name = String(value || '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    const key = normalizeName(name);
    if (seen.has(key)) return;
    seen.add(key);
    options.push(name);
  };
  ARTICLE_CATEGORIES.forEach(add);
  ((state && state.articleCategories) || []).forEach(add);
  ((state && state.articles) || []).forEach((article) => add(article && article.category));
  return options;
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

  const articleCats = new Set(visibleMemberArticles().map((a) => a.category));
  const categories = getArticleCategoryOptions();
  const allCategory = categories[0] || 'الكل';
  const selected = !state.articleCategory || state.articleCategory === 'all'
    ? allCategory
    : state.articleCategory;

  catContainer.innerHTML = `<span class="eyebrow">التصنيفات العامة</span>` + categories.map((category, index) => {
    const active = selected === category;
    const hasArticles = articleCats.has(category);
    const isAll = index === 0;
    return `<button class="chip-filter ${active ? 'active' : ''}${hasArticles ? '' : ' cat-empty'}" type="button" data-acat="${esc(category)}" aria-selected="${active}">
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
  const myArticles = visibleMemberArticles().filter((article) => isMine(article)).length;
  const streak = streakDays();

  $('#profile-name').textContent = state.profile.name;
  $('#profile-role').textContent = `${state.profile.role} · منذ ${state.profile.joined}`;
  setAvatarContent($('#profile-avatar'), state.profile.name, state.profile.photo || (currentMember && currentMember.photo));
  const photoButton = $('#profile-photo-change');
  if (photoButton) photoButton.hidden = isGuest();
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
    setAvatarContent(avatar, state.profile.name, state.profile.photo || (currentMember && currentMember.photo));
    avatar.title = state.profile.name;
  }
}

async function openMemberProfileSheet(name) {
  const target = String(name || '').trim();
  if (!target) return;
  const member = MEMBERS.find((m) => normalizeName(m.name) === normalizeName(target));
  let approved = null;
  try {
    const result = await cloudRequest('getApprovedMembers');
    if (result && result.success === true && Array.isArray(result.data)) {
      approved = result.data.find((m) => normalizeName(m.name) === normalizeName(target)) || null;
    }
  } catch (error) {}
  const isSelf = currentMember && normalizeName(currentMember.name) === normalizeName(target);
  const profileName = isSelf ? state.profile.name : target;
  const role = isSelf
    ? state.profile.role
    : (approved && approved.role === 'supervisor' ? 'مشرف' : (member ? (member.role || 'عضو') : 'عضو'));
  const joined = isSelf
    ? state.profile.joined
    : (approved && approved.joinedAt ? String(new Date(Number(approved.joinedAt)).getFullYear()) : (member ? '٢٠٢٤' : ''));
  const photo = isSelf
    ? (state.profile.photo || (currentMember && currentMember.photo) || '')
    : (approved && approved.photo ? approved.photo : '');
  const myArticles = (state && state.articles ? state.articles : []).filter((a) => normalizeName(authorNameOf(a)) === normalizeName(target));
  const myQuotes = (state && state.quotes ? state.quotes : []).filter((q) => normalizeName(authorNameOf(q)) === normalizeName(target));
  const articlesCount = myArticles.length;
  const quotesCount = myQuotes.length;
  const finished = isSelf ? state.myBooks.filter((item) => item.status === 'finished').length : 0;
  const color = isSelf ? '#C59B63' : (member ? member.color : (approved && approved.role === 'supervisor' ? '#1E3A2B' : '#C59B63'));

  openSheet(`
    <div class="member-profile-sheet">
      <div class="sheet-head">
        <span class="chip chip-soft">ملف عضو</span>
        <button class="sheet-close" type="button" data-close-sheet aria-label="إغلاق">
          <svg class="ic"><use href="#i-close"/></svg>
        </button>
      </div>
      <div class="member-profile-hero">
        ${avatarHTML(profileName, color, 'member-profile-avatar', photo)}
        <h2>${esc(profileName)}</h2>
        <p>${esc(role)}${joined ? ` · منذ ${esc(joined)}` : ''}</p>
      </div>
      <div class="member-profile-stats">
        <div><strong>${toAr(articlesCount)}</strong><span>مقال</span></div>
        <div><strong>${toAr(quotesCount)}</strong><span>اقتباس</span></div>
        ${isSelf ? `<div><strong>${toAr(finished)}</strong><span>كتاب مكتمل</span></div>` : ''}
      </div>
      <section class="member-contributions">
        <div class="member-contrib-tabs" role="tablist">
          <button class="active" type="button" data-contrib-tab="quotes" role="tab" aria-selected="true">اقتباساته <span>${toAr(quotesCount)}</span></button>
          <button type="button" data-contrib-tab="articles" role="tab" aria-selected="false">مقالاته <span>${toAr(articlesCount)}</span></button>
        </div>
        <div class="member-contrib-panel active" data-contrib-panel="quotes">
          ${myQuotes.length ? myQuotes.map((q) => `
            <blockquote class="member-contribution-quote">
              <p>«${esc(q.text)}»</p>
              <footer>${esc(q.book || 'من هامش القراءة')}${q.page ? ` · ص ${esc(q.page)}` : ''} · ${esc(q.time || '')}</footer>
            </blockquote>`).join('') : '<p class="member-contribution-empty">لا اقتباسات بعد</p>'}
        </div>
        <div class="member-contrib-panel" data-contrib-panel="articles" hidden>
          ${myArticles.length ? myArticles.map((a) => `
            <article class="member-contribution-article" data-action="open-article" data-id="${esc(a.id)}" role="button" tabindex="0">
              <span class="chip chip-soft">${esc(a.category || 'قراءة')}</span>
              <h5>${esc(a.title)}</h5>
              <p>${esc(a.excerpt || a.body || '').slice(0, 120)}</p>
              <small>${esc(a.time || '')} · ${toAr(a.read || 3)} دقائق</small>
            </article>`).join('') : '<p class="member-contribution-empty">لا مقالات بعد</p>'}
        </div>
      </section>
      ${isSelf ? `<button class="btn btn-sm btn-primary" type="button" data-action="open-profile">عرض ملفي الشخصي</button>` : ''}
    </div>`, (root) => {
    const btn = root.querySelector('[data-action="open-profile"]');
    if (btn) btn.addEventListener('click', () => { closeSheet(); go('profile'); });
    root.querySelectorAll('[data-contrib-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const key = tab.dataset.contribTab;
        root.querySelectorAll('[data-contrib-tab]').forEach((t) => {
          const on = t === tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        root.querySelectorAll('[data-contrib-panel]').forEach((panel) => {
          const on = panel.dataset.contribPanel === key;
          panel.hidden = !on;
          panel.classList.toggle('active', on);
        });
      });
    });
  });
}

async function refreshMemberProfileFromCloud() {
  const member = currentMember;
  if (!member || isGuest()) return;
  const result = await cloudRequest('getMemberProfile', null, member.id);
  if (!result || result.success !== true || !result.member || currentMember !== member) return;
  const photo = String(result.member.photo || '');
  member.photo = photo;
  if (state && state.profile && state.profile.photo !== photo) {
    state.profile.photo = photo;
    try { saveState(); } catch (error) {}
    renderProfile();
    updateHeaderAvatar();
  }
  const account = readAccount();
  if (account && String(account.id) === String(member.id) && account.photo !== photo) {
    persistAccount({ ...account, photo });
  }
}

function setAvatarContent(element, name, photo) {
  if (!element) return;
  const src = String(photo || '');
  if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(src)) {
    element.innerHTML = `<img class="avatar-photo-image" src="${esc(src)}" alt="صورة ${esc(name || 'عضو جليس')}">`;
  } else {
    element.textContent = initials(name);
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

function openSheet(html, onOpen, options = {}) {
  const root = $('#sheet-root');
  const fullscreen = Boolean(options.fullscreen);
  root.innerHTML = `
    <div class="sheet-backdrop" data-close-sheet></div>
    <div class="sheet ${fullscreen ? 'sheet-full' : ''}" role="dialog" aria-modal="true">
      ${fullscreen ? '' : '<div class="sheet-grabber" aria-hidden="true"></div>'}
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
  const book = getBook(id) || (state.clubBooks || []).find((b) => b.id === id);
  if (!book) return;
  const isClubBook = (state.clubBooks || []).some((item) => String(item.id) === String(book.id));
  const mine = getMyBook(id);
  const ratings = getBookRatings(id).slice().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  const average = Number(getAverageRating(id, book.rating)) || 0;
  const relatedQuotes = (state.quotes || []).filter((quote) =>
    (quote.bookId && String(quote.bookId) === String(book.id))
    || normalizeBookTitle(quote.book) === normalizeBookTitle(book.title)
  ).slice(0, 8);
  const ratingCounts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: ratings.filter((item) => Number(item.rating) === stars).length
  }));
  const progress = mine && mine.status === 'reading' && Number(book.pages) > 0
    ? `<div class="book-detail-progress"><div><span>${toAr(mine.currentPage)} من ${toAr(book.pages)} صفحة</span><b>٪${toAr(Math.round((mine.currentPage / book.pages) * 100))}</b></div><span class="progress"><span style="width:${clamp(Math.round((mine.currentPage / book.pages) * 100), 0, 100)}%"></span></span></div>`
    : '';
  const mainAction = mine
    ? `<button class="btn btn-gold btn-block" type="button" data-action="start-book" data-id="${esc(book.id)}">${mine.status === 'finished' ? 'أعد القراءة' : mine.status === 'want' ? 'ابدأ القراءة' : 'أكمل القراءة'}</button>`
    : !isGuest() ? `<button class="btn btn-gold btn-block" type="button" data-action="add-book" data-id="${esc(book.id)}" data-status="reading">ابدأ القراءة</button>` : `<button class="btn btn-gold btn-block" type="button" data-action="open-gate">دخول الأعضاء للقراءة</button>`;
  const secondaryAction = mine
    ? `<div class="book-detail-secondary-actions"><button class="btn btn-ghost" type="button" data-action="go-my-library">الانتقال إلى مكتبتي</button><button class="btn btn-ghost" type="button" data-action="remove-book" data-id="${esc(book.id)}">إزالة من مكتبتي</button></div>`
    : !isGuest() ? `<button class="btn btn-ghost btn-block" type="button" data-action="add-book" data-id="${esc(book.id)}" data-status="want">أضفه إلى قائمة القراءة</button>` : '';
  const reviewMarkup = ratings.length ? ratings.map((rating) => `
    <article class="book-review-card">
      <div class="book-review-head"><button class="book-review-author" type="button" data-action="open-member-profile" data-name="${esc(rating.memberName || 'عضو جليس')}">${esc(rating.memberName || 'عضو جليس')}</button><span class="book-review-stars">${'★'.repeat(clamp(Number(rating.rating) || 0, 0, 5))}${'☆'.repeat(5 - clamp(Number(rating.rating) || 0, 0, 5))}</span></div>
      ${rating.review ? `<p>${esc(rating.review)}</p>` : '<p class="book-review-empty">قيّم الكتاب دون كتابة مراجعة.</p>'}
    </article>`).join('') : emptyHTML('star', 'لا توجد مراجعات بعد', 'كن أول من يشارك رأيه عن هذا الكتاب.');
  const quotesMarkup = relatedQuotes.length ? relatedQuotes.map((quote) => `
    <blockquote class="book-related-quote"><p>«${esc(quote.text)}»</p><footer>${esc(quote.page ? `ص ${quote.page} · ` : '')}${esc(authorNameOf(quote))}</footer></blockquote>`).join('')
    : emptyHTML('quote', 'لا توجد اقتباسات من هذا الكتاب', 'ستظهر هنا الاقتباسات المرتبطة به.');

  openSheet(`
    ${sheetHead('تفاصيل الكتاب', book.category || 'من مكتبة جليس')}
    <section class="book-detail-hero">
      <div class="book-sheet-cover">${coverHTML(book)}</div>
      <div class="book-detail-hero-info">
        <span class="chip chip-soft">${esc(book.category || 'مكتبة جليس')}</span>
        <h2>${esc(book.title)}</h2>
        <p class="book-detail-author">${esc(book.author || 'مؤلف غير محدد')}</p>
        <button class="book-detail-rating" type="button" data-book-panel="reviews" aria-label="عرض التقييمات">
          <strong>${toAr(average.toFixed(1))}</strong>
          <span class="book-detail-stars">${'★'.repeat(Math.round(average))}${'☆'.repeat(5 - Math.round(average))}</span>
          <small>${toAr(ratings.length)} تقييمات ومراجعات</small>
        </button>
      </div>
    </section>
    ${progress}
    <div class="book-detail-actions">${mainAction}${secondaryAction}${isSupervisor() && isClubBook ? `<button class="btn btn-ghost btn-block book-admin-edit" type="button" data-action="edit-club-book" data-id="${esc(book.id)}"><svg class="ic"><use href="#i-edit"/></svg> تعديل بيانات الكتاب</button>` : ''}</div>
    <div class="book-detail-tabs" role="tablist" aria-label="تفاصيل الكتاب">
      <button class="active" type="button" data-book-panel="details" role="tab" aria-selected="true">تفاصيل الكتاب</button>
      <button type="button" data-book-panel="reviews" role="tab" aria-selected="false">تقييمات ومراجعات <span>${toAr(ratings.length)}</span></button>
      <button type="button" data-book-panel="quotes" role="tab" aria-selected="false">اقتباسات <span>${toAr(relatedQuotes.length)}</span></button>
    </div>
    <section class="book-detail-panel active" id="book-detail-details">
      <div class="book-detail-facts">
        <div><span>المؤلف</span><b>${esc(book.author || '—')}</b></div>
        <div><span>التصنيف</span><b>${esc(book.category || '—')}</b></div>
        ${book.year || book.publicationYear ? `<div><span>سنة النشر</span><b>${toAr(book.year || book.publicationYear)}</b></div>` : ''}
        ${Number(book.pages) > 0 ? `<div><span>الصفحات</span><b>${toAr(book.pages)}</b></div>` : ''}
        ${book.isbn ? `<div class="book-fact-wide"><span>ISBN</span><b>${esc(book.isbn)}</b></div>` : ''}
      </div>
      <div class="book-detail-description">
        <span>عن الكتاب</span>
        <p>${esc(book.report || 'لا يتوفر وصف لهذا الكتاب بعد.')}</p>
      </div>
    </section>
    <section class="book-detail-panel" id="book-detail-reviews" hidden>
      <div class="book-review-summary">
        <div><strong>${toAr(average.toFixed(1))}</strong><span>${'★'.repeat(Math.round(average))}${'☆'.repeat(5 - Math.round(average))}</span><small>${toAr(ratings.length)} تقييمات</small></div>
        <div class="book-rating-bars">${ratingCounts.map(({ stars, count }) => `<div><span>${toAr(stars)} ★</span><i><b style="width:${ratings.length ? Math.round(count / ratings.length * 100) : 0}%"></b></i><small>${toAr(count)}</small></div>`).join('')}</div>
      </div>
      ${!isGuest() ? `<button class="btn btn-ghost btn-block book-review-add" type="button" data-action="rate-book" data-id="${esc(book.id)}"><svg class="ic"><use href="#i-star"/></svg> أضف تقييمك ومراجعتك</button>` : ''}
      <div class="book-reviews-list">${reviewMarkup}</div>
    </section>
    <section class="book-detail-panel" id="book-detail-quotes" hidden>
      ${!isGuest() ? `<button class="btn btn-gold btn-block book-quote-add" type="button" data-action="add-quote-from-book" data-id="${esc(book.id)}"><svg class="ic"><use href="#i-quote"/></svg> أضف اقتباسًا من «${esc(book.title)}»</button>` : ''}
      <div class="book-related-quotes">${quotesMarkup}</div>
    </section>
  `, (root) => {
    root.querySelectorAll('[data-book-panel]').forEach((button) => {
      button.addEventListener('click', () => {
        const activePanel = button.dataset.bookPanel;
        root.querySelectorAll('[data-book-panel]').forEach((tab) => {
          const active = tab === button;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        root.querySelectorAll('.book-detail-panel').forEach((panel) => {
          panel.hidden = panel.id !== `book-detail-${activePanel}`;
          panel.classList.toggle('active', !panel.hidden);
        });
      });
    });
  });
}

function openQuoteComposer(presetBookId = '', presetBookTitle = '') {
  const presetBook = presetBookId ? (getBook(presetBookId) || (state.clubBooks || []).find((b) => String(b.id) === String(presetBookId))) : null;
  const initialBook = presetBook ? presetBook.title : (presetBookTitle || '');
  const initialBookId = presetBook ? String(presetBook.id) : '';
  const quoteBookOptions = [...new Map(
    [...BOOKS, ...((state && state.clubBooks) || [])]
      .filter((book) => book && book.title)
      .map((book) => [normalizeBookTitle(book.title), book.title])
  ).values()];
  if (initialBook && !quoteBookOptions.some((t) => normalizeBookTitle(t) === normalizeBookTitle(initialBook))) {
    quoteBookOptions.push(initialBook);
  }
  openSheet(`
    ${sheetHead('اقتبس ما ألهمك', `جملة واحدة قد تفتح باباً لكتاب كامل.${initialBook ? ` — من «${esc(initialBook)}»` : ''}`)}
    <form id="quote-form" novalidate>
      <div class="field">
        <label for="quote-text">نص الاقتباس</label>
        <textarea class="input" id="quote-text" rows="4" maxlength="400" placeholder="اكتب الجملة التي توقفت عندها…" required></textarea>
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="quote-book">الكتاب</label>
          <input class="input" id="quote-book" list="quote-books" maxlength="80" placeholder="اسم الكتاب" value="${esc(initialBook)}" ${initialBookId ? `data-book-id="${esc(initialBookId)}"` : ''}>
          <datalist id="quote-books">${quoteBookOptions.map((title) => `<option value="${esc(title)}"></option>`).join('')}</datalist>
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
        <svg class="ic"><use href="#i-send"/></svg> انشر الاقتباس في قائمة الاقتباسات
      </button>
    </form>`, (root) => {
    const text = root.querySelector('#quote-text');
    const book = root.querySelector('#quote-book');
    const page = root.querySelector('#quote-page');
    const preview = root.querySelector('#quote-preview-text');
    const source = root.querySelector('#quote-preview-source');
    const form = root.querySelector('#quote-form');
    let presetId = initialBookId;

    const update = () => {
      const value = text.value.trim();
      preview.textContent = value || 'سيظهر اقتباسك هنا…';
      preview.classList.toggle('is-empty', !value);
      source.textContent = [book.value.trim() || 'هامش الكتاب', page.value.trim() ? `ص ${page.value.trim()}` : '', state.profile.name]
        .filter(Boolean).join(' · ');
    };
    [text, book, page].forEach((field) => field.addEventListener('input', () => {
      // إذا غيّر العضو اسم الكتاب يدويًا نعيد البحث عن المعرف، وإلا نحتفظ بالمعرّف المضبوط من صفحة الكتاب
      if (presetId && normalizeBookTitle(book.value.trim()) !== normalizeBookTitle(initialBook)) presetId = '';
      update();
    }));
    update();
    if (form) form.addEventListener('submit', (event) => {
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
        bookId: presetId || (() => {
          const match = [...BOOKS, ...((state && state.clubBooks) || [])]
            .find((item) => normalizeBookTitle(item.title) === normalizeBookTitle(book.value.trim()));
          return match ? match.id : '';
        })(),
        page: page.value.trim(),
        authorId: 'me',
        authorName: state.profile.name,
        color: '#C59B63',
        time: 'الآن',
        likes: 0,
        createdAt: Date.now()
      };
      const savedBookId = newQuote.bookId;
      state.quotes = mergeQuoteLists([newQuote], state.quotes);
      saveLocalSharedQuotes(state.quotes);
      state.quoteFilter = 'all';
      saveState();
      saveQuoteToSheet(newQuote).then(() => syncQuotesFromSheet());
      closeSheet();
      renderQuotes();
      renderHome();
      updateNavBadges();
      toast('نُشر الاقتباس وظهر في قائمة الاقتباسات وفي صفحة الكتاب', 'quote');
      celebrate();
      if (savedBookId) {
        // إعادة فتح صفحة الكتاب لعرض التزامن فورًا
        setTimeout(() => openBookSheet(savedBookId), 250);
      }
    });
  });
}

function articleShareUrl(article) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('article', String(article.id));
  return url.toString();
}

function wrapCanvasText(context, value, maxWidth, maxLines) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  let last = clipped[maxLines - 1];
  while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trim();
  clipped[maxLines - 1] = `${last}…`;
  return clipped;
}

function loadShareImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) { resolve(null); return; }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCoverImage(context, image, x, y, size) {
  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
}

async function createArticleShareCard(article) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذر تجهيز بطاقة المشاركة');
  context.fillStyle = '#F8F5EE';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#14281E';
  context.fillRect(0, 0, canvas.width, 112);
  context.fillStyle = '#C59B63';
  context.fillRect(0, 108, canvas.width, 4);
  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#F8F5EE';
  context.font = '700 30px "IBM Plex Sans Arabic", sans-serif';
  context.fillText('مقال من مجلة جليس الإلكترونية', 1090, 69);

  context.fillStyle = '#9A7440';
  context.font = '700 23px "IBM Plex Sans Arabic", sans-serif';
  context.fillText(String(article.category || 'مقالات القراءة').slice(0, 48), 1080, 165);
  context.fillStyle = '#1E3A2B';
  context.font = '800 54px "IBM Plex Sans Arabic", sans-serif';
  const titleLines = wrapCanvasText(context, article.title || 'مقال من جليس', 1000, 3);
  titleLines.forEach((line, index) => context.fillText(line, 1080, 250 + index * 68));

  context.strokeStyle = 'rgba(30,58,43,.15)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(120, 470);
  context.lineTo(1080, 470);
  context.stroke();

  const author = authorNameOf(article);
  const photo = articleAuthorPhoto(article);
  const avatarSize = 82;
  const avatarX = 998;
  const avatarY = 500;
  context.save();
  context.beginPath();
  context.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  context.clip();
  const authorImage = await loadShareImage(photo);
  if (authorImage) {
    drawCoverImage(context, authorImage, avatarX, avatarY, avatarSize);
  } else {
    context.fillStyle = authorColorOf(article);
    context.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.fillStyle = '#F8F5EE';
    context.font = '800 30px "IBM Plex Sans Arabic", sans-serif';
    context.fillText(initials(author), avatarX + avatarSize / 2, avatarY + 52);
  }
  context.restore();

  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#9A7440';
  context.font = '600 21px "IBM Plex Sans Arabic", sans-serif';
  context.fillText('بقلم', 895, 532);
  context.fillStyle = '#1E3A2B';
  context.font = '800 27px "IBM Plex Sans Arabic", sans-serif';
  context.fillText(String(author).slice(0, 45), 895, 570);
  context.textAlign = 'left';
  context.fillStyle = '#667269';
  context.font = '600 20px "IBM Plex Sans Arabic", sans-serif';
  context.fillText('نادي جليس القرائي · لأن القراءة تجمعنا', 120, 558);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('تعذر إنشاء صورة المقال')), 'image/png');
  });
}

function downloadArticleShareCard(blob, article) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `jalees-article-${String(article.id || 'share').replace(/[^a-zA-Z0-9-_]/g, '-')}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareArticle(article) {
  const shareUrl = articleShareUrl(article);
  const author = authorNameOf(article);
  const shareText = `${article.title}\nبقلم ${author}\n#جليس_القرائي`;
  try {
    const blob = await createArticleShareCard(article);
    const file = new File([blob], 'مقال-جليس.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: article.title, text: shareText, url: shareUrl, files: [file] });
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, text: shareText, url: shareUrl });
        downloadArticleShareCard(blob, article);
        toast('تمت مشاركة رابط المقال، وحُمّلت بطاقته لإرفاقها', 'share');
        return;
      } catch (shareError) {
        if (shareError && shareError.name === 'AbortError') return;
      }
    }
    const copied = await copyText(`${shareText}\n${shareUrl}`);
    downloadArticleShareCard(blob, article);
    toast(copied ? 'نُسخ رابط المقال وحُمّلت بطاقة المشاركة' : 'حُمّلت بطاقة المقال للمشاركة', 'share');
  } catch (error) {
    const copied = await copyText(`${shareText}\n${shareUrl}`);
    toast(copied ? 'نُسخ رابط المقال للمشاركة' : 'تعذرت المشاركة', copied ? 'share' : 'info');
  }
}

async function openSharedArticlePage(articleId) {
  if (!articleId) return;
  await refreshArticlesFromCloud();
  const article = (state && state.articles || []).find(item => String(item.id) === String(articleId));
  if (!article) {
    go('articles');
    toast('لم أجد المقال المطلوب أو ربما نُقل إلى السلة', 'info');
    return;
  }
  const shareTitle = `${article.title} | جليس`;
  const shareDescription = article.excerpt || `مقال بقلم ${authorNameOf(article)} في مجلة جليس الإلكترونية.`;
  document.title = shareTitle;
  const titleMeta = document.querySelector('meta[property="og:title"]');
  const descriptionMeta = document.querySelector('meta[property="og:description"]');
  const twitterTitleMeta = document.querySelector('meta[name="twitter:title"]');
  const twitterDescriptionMeta = document.querySelector('meta[name="twitter:description"]');
  if (titleMeta) titleMeta.content = shareTitle;
  if (descriptionMeta) descriptionMeta.content = shareDescription;
  if (twitterTitleMeta) twitterTitleMeta.content = shareTitle;
  if (twitterDescriptionMeta) twitterDescriptionMeta.content = shareDescription;
  go('articles');
  openArticleSheet(article.id);
}

function openArticleSheet(id) {
  const article = state.articles.find((item) => item.id === id);
  if (!article) return;
  const saved = state.savedArticles.includes(article.id);
  const body = article.body.split(/\n{2,}/).map((paragraph) => `<p>${esc(paragraph).replace(/\n/g, '<br>')}</p>`).join('');

  openSheet(`
    <div class="article-reader article-reader-full">
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
        ${avatarHTML(authorNameOf(article), authorColorOf(article), 'avatar-mini reader-author-avatar', articleAuthorPhoto(article))}
        <div>
          <button class="reader-author-name" type="button" data-action="open-member-profile" data-name="${esc(authorNameOf(article))}">
            <strong>${esc(authorNameOf(article))}</strong>
          </button>
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
  </div>`, null, { fullscreen: true });
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
          ${getArticleCategoryOptions().filter((c) => c !== 'الكل').map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          ${isSupervisor() ? '<option value="__new__">＋ تصنيف جديد…</option>' : ''}
        </select>
      </div>
      ${isSupervisor() ? `<div class="field" id="article-new-category-field" hidden>
        <label for="article-new-category">اسم التصنيف الجديد</label>
        <input class="input" id="article-new-category" maxlength="40" placeholder="مثال: رحلات">
      </div>` : ''}
      <div class="field">
        <div class="article-font-row">
          <label for="article-body">نص المقال</label>
          <div class="article-font-controls" role="group" aria-label="حجم خط الكتابة">
            <button type="button" class="font-size-btn" data-font-step="-1" aria-label="تصغير الخط">أ−</button>
            <span class="font-size-value" id="article-font-value">16</span>
            <button type="button" class="font-size-btn" data-font-step="1" aria-label="تكبير الخط">أ+</button>
          </div>
        </div>
        <textarea class="input" id="article-body" rows="8" maxlength="6000" placeholder="اكتب هنا… اترك سطراً فارغاً بين الفقرات." required></textarea>
      </div>
      <button class="btn btn-gold btn-block" type="submit">
        <svg class="ic"><use href="#i-send"/></svg> انشر المقال
      </button>
    </form>`, (root) => {
    const categorySelect = root.querySelector('#article-category');
    const newCategoryField = root.querySelector('#article-new-category-field');
    if (categorySelect && newCategoryField) {
      categorySelect.addEventListener('change', () => {
        newCategoryField.hidden = categorySelect.value !== '__new__';
        if (!newCategoryField.hidden) root.querySelector('#article-new-category').focus();
      });
    }
    const bodyInput = root.querySelector('#article-body');
    const fontValue = root.querySelector('#article-font-value');
    const clampFont = (value) => Math.min(24, Math.max(12, value));
    let fontSize = clampFont(Number(state.articleFontSize) || 16);
    const applyFont = (value, persist) => {
      fontSize = clampFont(value);
      if (bodyInput) bodyInput.style.fontSize = `${fontSize}px`;
      if (fontValue) fontValue.textContent = String(fontSize);
      if (persist) {
        state.articleFontSize = fontSize;
        saveState();
      }
    };
    applyFont(fontSize, false);
    root.querySelectorAll('[data-font-step]').forEach((button) => {
      button.addEventListener('click', () => applyFont(fontSize + Number(button.dataset.fontStep), true));
    });
    root.querySelector('#article-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const title = root.querySelector('#article-title').value.trim();
      let category = root.querySelector('#article-category').value;
      if (category === '__new__') {
        const custom = root.querySelector('#article-new-category') ? root.querySelector('#article-new-category').value.replace(/\s+/g, ' ').trim() : '';
        if (custom.length < 2) {
          toast('اكتب اسم التصنيف الجديد', 'info');
          return;
        }
        const existing = getArticleCategoryOptions().find((name) => normalizeName(name) === normalizeName(custom));
        category = existing || custom;
        if (!existing) {
          state.articleCategories = Array.isArray(state.articleCategories) ? state.articleCategories : [];
          state.articleCategories.push(category);
          saveState();
        }
      }
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
      const newArticle = {
        id: `a-${Date.now()}`,
        title,
        category,
        body,
        excerpt: `${excerpt}${body.length > 118 ? '…' : ''}`,
        authorId: 'me',
        authorName: state.profile.name,
        authorPhoto: state.profile.photo || (currentMember && currentMember.photo) || '',
        color: '#C59B63',
        time: 'الآن',
        read: Math.max(1, Math.ceil(words / 180)),
        createdAt: Date.now()
      };
      state.articles.unshift(newArticle);
      const articleMember = currentMember;
      const shouldSaveArticleToCloud = articleMember && articleMember.id !== 'guest';
      if (shouldSaveArticleToCloud) {
        // احجز المقال من مزامنة الخلفية حتى لا يرسل مرتين أثناء الحفظ المباشر.
        syncState.articles.add(newArticle.id);
        persistSyncState(articleMember.id);
      }
      saveState();
      if (shouldSaveArticleToCloud) {
        saveArticleToCloud(articleMember, newArticle).then((result) => {
          if (result && result.success !== false) {
            toast('تم حفظ المقال في الشيت', 'article');
            return;
          }
          syncState.articles.delete(newArticle.id);
          persistSyncState(articleMember.id);
          scheduleCloudSync(1000);
          toast('حُفظ المقال على الجهاز، تعذرت مزامنته مع الشيت وستتم إعادة المحاولة', 'info');
        });
      }
      closeSheet();
      renderArticles();
      renderHome();
      renderProfile();
      go('articles');
      updateNavBadges();
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

function openJoinSheet() {
  openSheet(`
    ${sheetHead('انضم للنادي', 'أرسل طلب انضمامك، وسيتواصل معك مشرف جليس.')}
    <form id="join-form" novalidate>
      <div class="field">
        <label for="join-name">الاسم (كما في السجل)</label>
        <input class="input" id="join-name" type="text" maxlength="60" required>
      </div>
      <div class="field">
        <label for="join-phone">رقم الجوال</label>
        <input class="input" id="join-phone" type="tel" maxlength="20" placeholder="05xxxxxxxx">
      </div>
      <div class="field">
        <label for="join-note">ملاحظة (اختياري)</label>
        <textarea class="input" id="join-note" rows="2" maxlength="180" placeholder="لماذا تود الانضمام؟"></textarea>
      </div>
      <div class="whatsapp-contact">
        <svg class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <div class="whatsapp-body">
          <strong>للاستفسار والتواصل:</strong>
          <a href="https://wa.me/966545946169" target="_blank" rel="noopener" class="whatsapp-link">054 594 6169</a>
        </div>
      </div>
      <button class="btn btn-gold btn-block" type="submit">
        <svg class="ic"><use href="#i-send"/></svg> إرسال طلب الانضمام
      </button>
    </form>`, (root) => {
    root.querySelector('#join-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = root.querySelector('#join-name').value.trim();
      const phone = root.querySelector('#join-phone').value.trim();
      const note = root.querySelector('#join-note').value.trim();
      if (!name) { toast('يرجى إدخال الاسم', 'info'); return; }
      // Save request locally
      const requests = JSON.parse(localStorage.getItem('jalees-join-requests') || '[]');
      requests.push({ name, phone, note, ts: Date.now() });
      localStorage.setItem('jalees-join-requests', JSON.stringify(requests));
      // Save to sheet
      saveJoinRequestToSheet({ name, phone, note });
      closeSheet();
      toast('تم إرسال طلب انضمامك، سنتواصل معك قريباً', 'check');
    });
  });
}

function joinStatusMeta(status) {
  if (status === 'accepted') return { label: 'مقبول', className: 'accepted' };
  if (status === 'rejected') return { label: 'مرفوض', className: 'rejected' };
  return { label: 'معلق', className: 'pending' };
}

function memberAccountStatusMeta(status) {
  if (status === 'rejected') return { label: 'مرفوض', className: 'rejected' };
  return { label: 'بانتظار الموافقة', className: 'pending' };
}

function renderPendingMembers(accounts) {
  const list = document.getElementById('pending-members-list');
  if (!list) return;
  if (!accounts.length) {
    list.innerHTML = '<div class="empty"><svg class="ic"><use href="#i-check"/></svg><h4>لا حسابات بانتظار الموافقة</h4><p>كل الحسابات المسجلة تمت مراجعتها.</p></div>';
    return;
  }
  list.innerHTML = accounts.map((account) => {
    const meta = memberAccountStatusMeta(account.status);
    const isConsultant = (account.role === 'consultant');
    const memberType = account.memberType || 'member';
    return `
      <div class="join-request-card ${meta.className}">
        <span class="notif-icon"><svg class="ic"><use href="#i-user"/></svg></span>
        <div class="notif-body">
          <div class="join-request-head">
            <strong>${esc(account.name || 'بدون اسم')}</strong>
            <span class="join-status ${meta.className}">${meta.label}</span>
          </div>
          <p dir="ltr" style="text-align:right">${esc(account.email || '')}</p>
          ${account.phone ? `<p dir="ltr" style="text-align:right">${esc(account.phone)}</p>` : ''}
          <small>${account.createdAt ? new Date(Number(account.createdAt)).toLocaleDateString('ar-SA') : ''}</small>
          ${meta.className === 'pending' ? `
          <div class="member-type-row">
            <label>نوع العضوية:
              <select class="member-type-select" data-row="${esc(String(account.row))}">
                <option value="member" ${memberType === 'member' ? 'selected' : ''}>عضو جليس</option>
                <option value="friend" ${memberType === 'friend' ? 'selected' : ''}>صديق جليس</option>
              </select>
            </label>
          </div>` : ''}
          <div class="join-request-actions">
            <button class="join-decision accept" type="button" data-action="member-accept" data-row="${esc(String(account.row))}" ${meta.className === 'accepted' ? 'disabled' : ''}>قبول</button>
            <button class="join-decision reject" type="button" data-action="member-reject" data-row="${esc(String(account.row))}" ${meta.className === 'rejected' ? 'disabled' : ''}>رفض</button>
            ${meta.className === 'accepted' ? `
            <button class="join-decision consultant-toggle" type="button" data-action="toggle-consultant" data-row="${esc(String(account.row))}" data-consultant="${isConsultant ? 'true' : 'false'}">${isConsultant ? 'إلغاء ترقية مستشار' : 'ترقية إلى مستشار'}</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderJoinRequestsList(requests) {
  const list = document.getElementById('join-requests-list');
  if (!list) return;
  if (!requests.length) {
    list.innerHTML = '<div class="empty"><svg class="ic"><use href="#i-users"/></svg><h4>لا توجد طلبات</h4><p>لم يُرسل أي طلب انضمام بعد.</p></div>';
    return;
  }
  list.innerHTML = requests.slice().reverse().map((request) => {
    const meta = joinStatusMeta(request.status);
    return `
      <div class="join-request-card ${meta.className}">
        <span class="notif-icon"><svg class="ic"><use href="#i-user"/></svg></span>
        <div class="notif-body">
          <div class="join-request-head">
            <strong>${esc(request.name || 'بدون اسم')}</strong>
            <span class="join-status ${meta.className}">${meta.label}</span>
          </div>
          <p>${esc(request.phone || '')} ${request.note ? '· ' + esc(request.note) : ''}</p>
          <small>${request.ts ? new Date(Number(request.ts)).toLocaleDateString('ar-SA') : ''}</small>
          <div class="join-request-actions">
            <button class="join-decision accept" type="button" data-action="join-accept" data-row="${esc(String(request.row))}" ${meta.className === 'accepted' ? 'disabled' : ''}>قبول</button>
            <button class="join-decision reject" type="button" data-action="join-reject" data-row="${esc(String(request.row))}" ${meta.className === 'rejected' ? 'disabled' : ''}>رفض</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function refreshJoinRequests() {
  const list = document.getElementById('join-requests-list');
  const membersList = document.getElementById('pending-members-list');
  if (!list && !membersList) return;
  try {
    const results = await Promise.all([
      fetch(`${CLUB_BOOKS_URL}?action=getJoinRequests&_=${Date.now()}`),
      cloudRequest('getPendingMembers')
    ]);
    const data = await results[0].json();
    const requests = (data && data.success && Array.isArray(data.data)) ? data.data : [];
    renderJoinRequestsList(requests);
    const pendingAccounts = (results[1] && results[1].success && Array.isArray(results[1].data)) ? results[1].data : [];
    renderPendingMembers(pendingAccounts);
  } catch (error) {
    if (list) list.innerHTML = '<div class="empty"><svg class="ic"><use href="#i-users"/></svg><h4>تعذّر التحميل</h4><p>تحقق من نشر Apps Script المحدّث.</p></div>';
    if (membersList) membersList.innerHTML = '<div class="empty"><svg class="ic"><use href="#i-user"/></svg><h4>تعذّر التحميل</h4><p>تحقق من نشر Apps Script المحدّث.</p></div>';
  }
}

async function setMemberAccountStatus(button, status) {
  if (!isSupervisor()) { toast('غير مصرح', 'info'); return; }
  const row = Number(button.dataset.row);
  if (!row) return;
  button.disabled = true;
  const card = button.closest('.join-request-card');
  if (card) card.classList.add('busy');
  const memberTypeSelect = card ? card.querySelector('.member-type-select') : null;
  const memberType = memberTypeSelect ? memberTypeSelect.value : 'member';
  try {
    const result = await cloudRequest('setMemberStatus', {
      row,
      status,
      memberType: status === 'active' ? memberType : undefined,
      by: (currentMember && currentMember.name) || 'مشرف'
    });
    if (!result || result.success !== true) {
      toast(cleanServerError(result, 'تعذر تحديث حالة الحساب'), 'info');
      button.disabled = false;
      return;
    }
    toast(status === 'active' ? `تم قبول العضو كـ${memberType === 'friend' ? 'صديق جليس' : 'عضو جليس'}` : 'تم رفض طلب العضوية', status === 'active' ? 'check' : 'info');
    await refreshJoinRequests();
  } catch (error) {
    toast('تعذر تحديث حالة الحساب', 'info');
    button.disabled = false;
  }
}

async function setJoinRequestStatus(button, status) {
  if (!isSupervisor()) { toast('غير مصرح', 'info'); return; }
  const row = Number(button.dataset.row);
  if (!row) return;
  button.disabled = true;
  const card = button.closest('.join-request-card');
  if (card) card.classList.add('busy');
  try {
    const result = await cloudRequest('setJoinRequestStatus', {
      row,
      status,
      by: (currentMember && currentMember.name) || 'مشرف'
    });
    if (!result || result.success !== true) {
      toast(cleanServerError(result, 'تعذر تحديث حالة الطلب'), 'info');
      button.disabled = false;
      return;
    }
    toast(status === 'accepted' ? 'تم قبول الطلب' : 'تم رفض الطلب', status === 'accepted' ? 'check' : 'info');
    await refreshJoinRequests();
  } catch (error) {
    toast('تعذر تحديث حالة الطلب', 'info');
    button.disabled = false;
  }
}

function openJoinRequestsSheet() {
  if (!isSupervisor()) { toast('غير مصرح', 'info'); return; }
  openSheet(`
    ${sheetHead('طلبات الانضمام', 'حسابات الأعضاء الجدد وطلبات الزوار')}
    <div class="join-section">
      <h3 class="join-section-title">حسابات بانتظار الموافقة</h3>
      <div class="notif-list" id="pending-members-list"><div class="empty"><svg class="ic"><use href="#i-user"/></svg><h4>جارٍ التحميل…</h4></div></div>
    </div>
    <div class="join-section">
      <h3 class="join-section-title">طلبات الزوار للانضمام</h3>
      <div class="notif-list" id="join-requests-list"><div class="empty"><svg class="ic"><use href="#i-users"/></svg><h4>جارٍ التحميل…</h4></div></div>
    </div>`);
  refreshJoinRequests();
}

function openRateBookSheet(bookId) {
  const book = getBook(bookId) || (state.clubBooks || []).find((b) => b.id === bookId);
  if (!book) return;
  const existing = getBookRatings(bookId).find((r) => r.memberId === (currentMember ? currentMember.id : ''));
  const currentRating = existing ? existing.rating : 0;
  const currentReview = existing ? existing.review : '';
  openSheet(`
    ${sheetHead('تقييم الكتاب', esc(book.title))}
    <form id="rate-book-form" novalidate>
      <div class="field">
        <span class="field-label">التقييم</span>
        <div class="star-rating" id="star-rating">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star-btn ${n <= currentRating ? 'active' : ''}" data-star="${n}" aria-label="${n} نجوم">★</button>`).join('')}
        </div>
        <input type="hidden" id="rate-value" value="${currentRating}">
      </div>
      <div class="field">
        <label for="rate-review">المراجعة (اختياري)</label>
        <textarea class="input" id="rate-review" rows="3" maxlength="300" placeholder="ما رأيك في هذا الكتاب؟">${esc(currentReview)}</textarea>
      </div>
      <button class="btn btn-gold btn-block" type="submit">
        <svg class="ic"><use href="#i-star"/></svg> حفظ التقييم
      </button>
    </form>`, (root) => {
    let selectedRating = currentRating;
    const stars = root.querySelectorAll('.star-btn');
    const hidden = root.querySelector('#rate-value');
    stars.forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRating = Number(btn.dataset.star);
        hidden.value = selectedRating;
        stars.forEach((s) => s.classList.toggle('active', Number(s.dataset.star) <= selectedRating));
      });
      btn.addEventListener('mouseenter', () => {
        const hover = Number(btn.dataset.star);
        stars.forEach((s) => s.classList.toggle('hover', Number(s.dataset.star) <= hover));
      });
      btn.addEventListener('mouseleave', () => {
        stars.forEach((s) => s.classList.remove('hover'));
      });
    });
    root.querySelector('#rate-book-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedRating) { toast('يرجى اختيار تقييم', 'info'); return; }
      const review = root.querySelector('#rate-review').value.trim();
      const result = await saveBookRating(bookId, selectedRating, review);
      closeSheet();
      renderLibrary();
      renderHome();
      toast(result && result.success !== false ? 'تم حفظ تقييمك ومزامنته للأعضاء' : 'حُفظ التقييم على الجهاز، وتعذرت مزامنته الآن', result && result.success !== false ? 'star' : 'info');
    });
  });
}

function openViewRatingsSheet(bookId) {
  const book = getBook(bookId) || (state.clubBooks || []).find((b) => b.id === bookId);
  if (!book) return;
  const ratings = getBookRatings(bookId);
  const avg = getAverageRating(bookId, book.rating);
  const html = ratings.length
    ? ratings.map((r) => `
        <div class="notif-item">
          <span class="notif-icon"><svg class="ic"><use href="#i-star"/></svg></span>
          <div class="notif-body">
            <strong>${esc(r.memberName)} · ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</strong>
            ${r.review ? `<p>${esc(r.review)}</p>` : ''}
            <small>${new Date(r.createdAt).toLocaleDateString('ar-SA')}</small>
          </div>
        </div>`).join('')
    : '<div class="empty"><svg class="ic"><use href="#i-star"/></svg><h4>لا توجد تقييمات</h4><p>كن أول من يقيّم هذا الكتاب.</p></div>';
  openSheet(`
    ${sheetHead('تقييمات الكتاب', `${esc(book.title)} · متوسط ${avg}`)}
    <div class="notif-list">${html}</div>`);
}

function openGuideSheet() {
  openSheet(`
    ${sheetHead('الدليل التعريفي', 'نادي جليس القرائي · 1445هـ - 2024م')}
    <div class="guide-sheet">
      <div class="guide-hero">
        <div class="guide-hero-logo"><img src="logo.png?v=1" alt="شعار جليس"></div>
        <h3>الدليل التعريفي بنادي جليس</h3>
        <p>جمعية التنمية الأهلية بالمريدسية · القصيم – بريدة<br><small>ترخيص رقم 4373 · وزارة الموارد البشرية والتنمية الاجتماعية · المركز الوطني لتنمية القطاع غير الربحي</small></p>
        <div class="guide-hero-contacts">
          <a href="https://wa.me/966545946169" target="_blank" rel="noopener noreferrer">واتساب: 054 594 6169</a>
          <a href="https://x.com/jalees1444?s=20" target="_blank" rel="noopener noreferrer">إكس: @jalees1444</a>
          <a href="https://youtube.com/@jalees1444?si=EYllTqOxysKkoIqW" target="_blank" rel="noopener noreferrer">يوتيوب: @jalees1444</a>
        </div>
      </div>

      <section class="guide-section">
        <h4>مقدمة</h4>
        <p>الحمد لله العظيم العليم الذي قال في أول آيات نزلت: ﴿اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ (1) خَلَقَ الْإِنسَانَ مِنْ عَلَقٍ (2) اقْرَأْ وَرَبُّكَ الْأَكْرَمُ (3) الَّذِي عَلَّمَ بِالْقَلَمِ (4) عَلَّمَ الْإِنسَانَ مَا لَمْ يَعْلَمْ﴾، والصلاة والسلام على خير البشر القائل: «من سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة».</p>
        <p>أما بعد، فلا شك أن للقراءة أثراً عظيماً على الفرد والمجتمع؛ فهي تغذي عقلاً، وترفع وعياً، وتعدّل سلوكاً، وتثري لفظاً، وتحيي روحاً، وتشرح صدراً، وتوسع أفقاً، وتملأ وقتاً، وترفع همةً، وتشد عزيمةً، وتبني ثقافة، إلى غير ذلك مما يدركه من سبر أغوارها وقطف من ثمارها.</p>
        <p>ثم إن لنوادي القراءة دوراً مجتمعياً وأثراً تحفيزياً على أعضائها، بغرس محبة القراءة والمداومة عليها، وهي أيضاً تنمي مهارات الحوار والنقد، ومجال رحب للتعرف على من يشاركك الاهتمام في مجال القراءة ويضيف لك المزيد والمفيد من خلاله.</p>
        <p>ويسرنا في نادي جليس أن نقدّم لكم هذا الدليل التعريفي بأنشطة النادي الذي انطلق بفضل الله يوم الأربعاء 1444/5/20هـ في مقر جمعية التنمية الأهلية بالمريدسية، ويمثل أحد برامجها، وما زال ينمو ويشتد ولله الحمد والمنة. سائلين الله تعالى أن يوفقنا وإياكم، وأن ينير بصائرنا ويعلمنا ما ينفعنا وينفعنا بما علمنا.</p>
      </section>

      <section class="guide-section guide-cols">
        <div>
          <h4>الرؤية</h4>
          <p>التميّز في نشر ثقافة القراءة.</p>
        </div>
        <div>
          <h4>الرسالة</h4>
          <p>نشر ثقافة القراءة، وبناء عادة القراءة المستمرة.</p>
        </div>
      </section>

      <section class="guide-section">
        <h4>أهداف النادي</h4>
        <ol class="guide-list">
          <li>نشر ثقافة القراءة بين أفراد المجتمع.</li>
          <li>تنمية مهارات القراءة والحوار.</li>
          <li>نشر العلم والمعرفة.</li>
        </ol>
      </section>

      <section class="guide-section">
        <h4>برامج النادي وأنشطته (بشكل مُجمَل)</h4>
        <p>يمكن تقسيم أنشطة النادي إلى:</p>
        <div class="guide-sub">
          <strong>أ. أنشطة غير حضورية وتشمل:</strong>
          <ol class="guide-list">
            <li>مجموعة النادي على الواتساب.</li>
            <li>المسابقات القرائية.</li>
            <li>برامج المجموعات المخصصة لقراءة كتاب محدد.</li>
          </ol>
        </div>
        <div class="guide-sub">
          <strong>ب. الأنشطة الحضورية وتشمل:</strong>
          <ol class="guide-list">
            <li>جلسات مناقشة الكتب (قراءة الكتاب على مدى زمني محدد ثم الاجتماع لمناقشة ما فيه).</li>
            <li>جلسات حضورية متنوعة مثل: الاستضافات والزيارات ولقاء القرّاء وغيرها.</li>
          </ol>
        </div>
        <div class="guide-diagram">
          <div class="guide-diagram-root">أنشطة النادي</div>
          <div class="guide-diagram-branches">
            <div>
              <div class="guide-diagram-node">البرامج غير الحضورية</div>
              <div class="guide-diagram-leaves"><span>مجموعة الواتساب</span><span>برامج متنوعة مثل المسابقات</span></div>
            </div>
            <div>
              <div class="guide-diagram-node">البرامج الحضورية</div>
              <div class="guide-diagram-leaves"><span>لقاءات مناقشة الكتب</span><span>لقاءات متنوعة مثل: الاستضافة</span></div>
            </div>
          </div>
        </div>
      </section>

      <section class="guide-section">
        <h4>أولاً: الأنشطة غير الحضورية</h4>
        <div class="guide-sub">
          <strong>أ. مجموعة النادي على الواتساب:</strong>
          <p>هدف المجموعة: إيجاد بيئة محفّزة على القراءة من خلال مجموعة الواتساب التفاعلية التي يكتب فيها الأعضاء ما يقرؤونه.</p>
          <p>محتوى المجموعة:</p>
          <ol class="guide-list">
            <li>تقارير الكتب: عند الانتهاء من قراءة الكتاب يكتب العضو تقريراً يشمل العنوان، والمؤلف، وعدد الصفحات، وفكرة الكتاب.</li>
            <li>الاقتباسات من الكتب المقروءة.</li>
            <li>المشاركات والاستشارات في مجال القراءة.</li>
            <li>الإعلان عن أنشطة النادي المختلفة.</li>
            <li>التقرير الأسبوعي: في نهاية كل أسبوع يصدر مشرف المجموعة تقريراً عن الأعضاء الذين شاركونا قراءتهم خلال الأسبوع، مرتباً على حسب عدد الصفحات التي قرأت.</li>
          </ol>
        </div>
        <div class="guide-sub">
          <strong>ب. المسابقات القرائية:</strong>
          <p>وتكون إما خاصة للأعضاء أو عامة للمجتمع. ومن المسابقات التي تم تنفيذها: مسابقة قراءة خمسة كتب في عشرة أيام، والتي شارك فيها 66 متسابقاً قرؤوا ما يزيد عن 300 كتاب.</p>
        </div>
        <div class="guide-sub">
          <strong>ج. برامج مجموعات مخصصة لقراءة كتاب في فترة طويلة:</strong>
          <p>فكرة البرنامج: أن يتم تحديد كتاب ويُنشأ لأجله مجموعة على الواتساب، ثم يتم متابعة قراءة الكتاب في فترة زمنية محددة.</p>
          <p>وللنادي تجربتين في ذلك:</p>
          <ol class="guide-list">
            <li>مجال كتب السنة النبوية: قراءة كتاب جامع السنة في 14 شهراً بمعدل خمس صفحات في اليوم.</li>
            <li>مجال تكوين الملكة اللغوية بقراءة كتاب البخلاء للجاحظ في سبعة أسابيع، ثم قراءة كتاب البيان والتبيين في تسعة أسابيع مع التسجيل الصوتي لمن يرغب وكتابة الفوائد والاقتباسات.</li>
          </ol>
        </div>
      </section>

      <section class="guide-section">
        <h4>ثانياً: الأنشطة الحضورية</h4>
        <div class="guide-sub">
          <strong>أ. جلسات نقاش الكتب:</strong>
          <p>الفكرة: قراءة الكتاب على مدى زمني محدد ثم الاجتماع لمناقشة ما فيه.</p>
          <p>الكتب التي تم مناقشتها خلال السنة الأولى من عمر النادي:</p>
          <div class="guide-table-wrap">
            <table class="guide-table">
              <thead><tr><th>الكتاب</th><th>المجال</th><th>الكتاب</th><th>المجال</th></tr></thead>
              <tbody>
                <tr><td>اقرأ وارق</td><td>القراءة</td><td>تعزيز الرقابة الذاتية</td><td>تربوي</td></tr>
                <tr><td>إلى الظل</td><td>تطوير</td><td>صحتك في المشي</td><td>الصحة</td></tr>
                <tr><td>الهشاشة النفسية</td><td>نفسي</td><td>مختصر المغالطات المنطقية</td><td>التفكير</td></tr>
                <tr><td>مفاتيح تدبر القرآن</td><td>إيماني</td><td>تكوين الملكة اللغوية</td><td>اللغة</td></tr>
                <tr><td>روائع الطنطاوي</td><td>أدبي</td><td>الوسائل المفيدة للحياة السعيدة</td><td>عام</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="guide-sub">
          <strong>ب. البرامج الحضورية الأخرى:</strong>
          <p><strong>1- الاستضافات:</strong> للشخصيات البارزة في مجال القراءة والثقافة وللمؤلفين والمتخصصين في مجالاتهم.</p>
          <p><strong>2- الزيارات:</strong> وتكون للشخصيات العلمية أو لمكتبات المؤلفين والمراكز الثقافية، ومن أمثلة الزيارات التي نفذت: زيارة د. عبد العزيز المقبل، زيارة د. عبد الله البريدي، زيارة معرض نفائس الكتب، زيارة مؤسسة الشيخ محمد بن صالح العثيمين الخيرية.</p>
          <p><strong>3- الجلسة القرائية:</strong> فكرة الجلسة هي الاتفاق على كتاب محدد، ثم الاجتماع حضورياً وقراءته قراءة جهرية بالتداول بين الأعضاء بدون قراءة مسبقة للكتاب، ويتخلل الجلسة تعليقات بسيطة.</p>
          <p>ب. من الكتب التي قرئت في النادي: ذوق الصلاة، و300 كلمة قرآنية قد تُقرأ خطأً (كل كتاب استغرق خمس جلسات تقريباً).</p>
          <p><strong>4- لقاء القرّاء، وطريقته كالتالي:</strong></p>
          <ol class="guide-list">
            <li>تخصيص وقت للقراءة، بأن يحضر كل مشارك الكتاب الذي يرغب بقراءته.</li>
            <li>يعرض كل مشارك ما قرأه بطريقة الاقتباسات، أو تلخيص فكرة ما قرأ.</li>
            <li>أثناء عرض الكتاب يتاح للحضور التعليق والاستفسارات في موضوع الكتاب.</li>
          </ol>
          <p><strong>5- لقاء عرض الكتب، وآليته كالتالي:</strong></p>
          <ol class="guide-list">
            <li>يعلن عن البرنامج قبل وقت كافٍ.</li>
            <li>كل من يرغب بالمشاركة يعد عرضاً عن كتاب أعجبه (فكرة الكتاب والاقتباسات الجميلة فيه).</li>
            <li>يقوم كل مشارك بعرض الكتاب في اللقاء.</li>
            <li>يتاح للحضور طرح الاستفسارات والتعليقات.</li>
          </ol>
          <p><strong>6- تخصص وقارئ:</strong> فكرة اللقاء: استضافة أحد أعضاء جليس ممن له اطلاع على تخصص قرائي معين، فيقدم خلاصة تجربته، ويفيد في مجاله، مع عرض الكتب المهمة في هذا التخصص، ثم يتاح المجال للحضور في الاستفسارات والتعليقات حول التخصص.</p>
          <p>أمثلة للقاءات تخصص وقارئ التي أقامها النادي: تاريخ الأندلس، السير الذاتية، كتب الفقه، تخصص القانون، كتب العقيدة.</p>
        </div>
      </section>

      <section class="guide-section">
        <h4>التسجيل في النادي</h4>
        <p>متطلبات الدخول في مجموعة النادي:</p>
        <ol class="guide-list">
          <li>الالتزام بالحد الأدنى للمشاركة وهو مشاركة قرائية واحدة في الشهر (تقرير عن كتاب).</li>
          <li>البيانات المطلوبة في تقرير الكتاب:
            <ul>
              <li>البيانات الأساسية: اسم الكتاب، اسم المؤلف، عدد الصفحات المقروءة.</li>
              <li>بيانات إضافية اختيارية: صورة الغلاف، نبذة عن الكتاب، مقتطفات أعجبتك في الكتاب.</li>
            </ul>
          </li>
          <li>جميع المشاركات تخضع للضوابط الدينية، والأطر التنظيمية المعمول بها في البلد، ومن ذلك عدم المشاركة في تقارير الكتب التي تخص مؤلفين موقوفين أمنياً أو منتمين لجماعات محظورة.</li>
          <li>المجموعة أنشئت لتحقيق أهداف نادي جليس ونشر أنشطته، فلا يسمح بنشر الموضوعات التي هي خارج تخصص المجموعة.</li>
          <li>تجنب مخالفات أنظمة حماية الملكية الفكرية، ومن ذلك عدم نشر مصورات الكتب PDF بدون إذن المؤلف والناشر.</li>
        </ol>
        <div class="guide-cta">
          <a class="btn btn-primary" href="https://wa.me/966545946169?text=%D8%A3%D8%B1%D8%BA%D8%A8%20%D8%A8%D8%A7%D9%84%D8%AA%D8%B3%D8%AC%D9%8A%D9%84%20%D9%81%D9%8A%20%D9%86%D8%A7%D8%AF%D9%8A%20%D8%AC%D9%84%D9%8A%D8%B3" target="_blank" rel="noopener noreferrer">رابط التسجيل عبر واتساب</a>
        </div>
      </section>
    </div>`);
}

function openClubActivitiesSheet() {
  closeSheet();
  openGuideSheet();
}

function openClubProgramsSheet() {
  const groups = [
    {
      label: 'أنشطة غير حضورية',
      items: [
        { number: 'غير حضوري 1', title: 'مجموعة النادي على الواتساب', description: 'بيئة محفزة على القراءة: تقارير كتب، اقتباسات، مشاركات واستشارات، وإعلانات أنشطة النادي.' },
        { number: 'غير حضوري 2', title: 'المسابقات القرائية', description: 'مسابقات خاصة أو عامة، منها مسابقة 5 كتب في 10 أيام (66 متسابقاً، أكثر من 300 كتاب).' },
        { number: 'غير حضوري 3', title: 'برامج مجموعات مخصصة لقراءة كتاب', description: 'جامع السنة في 14 شهراً (5 صفحات يومياً)، والملكة اللغوية عبر البخلاء والبيان والتبيين.' }
      ]
    },
    {
      label: 'أنشطة حضورية',
      items: [
        { number: 'حضوري 1', title: 'جلسات مناقشة الكتب', description: 'قراءة الكتاب على مدى زمني محدد ثم الاجتماع لمناقشة ما فيه — 10 كتب في السنة الأولى.' },
        { number: 'حضوري 2', title: 'جلسات حضورية متنوعة', description: 'الاستضافات، الزيارات، الجلسة القرائية، لقاء القرّاء، لقاء عرض الكتب، وتخصص وقارئ.' }
      ]
    }
  ];
  openSheet(`
    ${sheetHead('الأنشطة', 'الأنشطة الحضورية وغير الحضورية من الدليل التعريفي')}
    <div class="club-programs-list">
      ${groups.map((group) => `
        <div class="club-program-group-label">${esc(group.label)}</div>
        ${group.items.map((program, index) => `
          <article class="club-program-card">
            <span class="club-program-index">${toAr(index + 1)}</span>
            <div>
              <small>${esc(program.number)}</small>
              <h3>${esc(program.title)}</h3>
              <p>${esc(program.description)}</p>
            </div>
            <svg class="ic"><use href="#i-books"/></svg>
          </article>`).join('')}
      `).join('')}
      <button class="btn btn-gold btn-block" type="button" data-action="open-guide">عرض الدليل التعريفي كاملًا</button>
    </div>`, (root) => {
    const cards = root.querySelectorAll('.club-program-card');
    cards.forEach((card, i) => {
      card.addEventListener('click', () => {
        closeSheet();
        openGuideSheet();
      });
    });
  });
}

function openReadingWindowSheet() {
  openSheet(`
    ${sheetHead('نوافذ قرائية', 'صور ونصائح عن القراءة وفوائدها — بإضافة المشرف')}
    <div class="reading-window">
      <div class="reading-window-hero">
        <span class="chip chip-soft">نوافذ قرائية</span>
        <h3>نوافذ قرائية</h3>
        <p>نافذة قصيرة تعرض صورًا ونصائح عن القراءة وفوائدها، يضيفها المشرف.</p>
      </div>
      <div class="reading-window-tips reading-windows-gallery" id="reading-window-tips"><p class="deleted-items-loading">جارٍ تحميل النوافذ القرائية…</p></div>
      ${isSupervisor() ? `<button class="btn btn-gold btn-block" type="button" data-action="add-reading-tip"><svg class="ic"><use href="#i-plus"/></svg> إضافة نافذة قرائية (للمشرف)</button>` : ''}
    </div>`, (root) => {
    const tipsContainer = root.querySelector('#reading-window-tips');
    loadReadingTips(tipsContainer);
    const addBtn = root.querySelector('[data-action="add-reading-tip"]');
    if (addBtn) addBtn.addEventListener('click', () => {
      closeSheet();
      openReadingTipComposer();
    });
  });
}

async function loadReadingTips(container) {
  if (!container) return;
  try {
    const result = await cloudRequest('getReadingTips');
    const tips = (result && result.success && Array.isArray(result.data)) ? result.data : [];
    if (!tips.length) {
      container.innerHTML = '<div class="reading-tip-empty">لا توجد نصائح قرائية بعد. يمكن للمشرف إضافة نصائح.</div>';
      return;
    }
    container.innerHTML = tips.map((tip) => `
      <article class="reading-tip-card">
        ${tip.image ? `<img class="reading-tip-image" src="${esc(tip.image)}" alt="${esc(tip.title || 'نصيحة قرائية')}">` : ''}
        <div class="reading-tip-body">
          <h5>${esc(tip.title || 'نصيحة قرائية')}</h5>
          <p>${esc(tip.body || '')}</p>
          ${isSupervisor() ? `<button class="btn btn-ghost btn-sm reading-tip-delete" type="button" data-action="delete-reading-tip" data-id="${esc(tip.id)}">حذف</button>` : ''}
        </div>
      </article>`).join('');
    container.querySelectorAll('[data-action="delete-reading-tip"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const result = await cloudRequest('deleteReadingTip', { id: btn.dataset.id, by: (currentMember && currentMember.name) || 'مشرف' });
        if (result && result.success) {
          toast('تم حذف النصيحة', 'trash');
          loadReadingTips(container);
        } else {
          toast('تعذر حذف النصيحة', 'info');
        }
      });
    });
  } catch (error) {
    container.innerHTML = '<div class="reading-tip-empty">تعذر تحميل النصائح</div>';
  }
}

function openMemberStatsSheet() {
  const map = new Map();
  const ensure = (name) => {
    const key = normalizeName(name);
    if (!key || !name) return null;
    if (!map.has(key)) map.set(key, { name, quotes: 0, articles: 0, color: '#C59B63', photo: '' });
    const entry = map.get(key);
    if (!entry.photo) entry.photo = photoByName(name) || '';
    return entry;
  };
  // Approved members first
  (approvedMembersCache || []).forEach((m) => {
    const e = ensure(m.name);
    if (e) e.photo = m.photo || e.photo;
  });
  // Roster names
  (MEMBERS || []).forEach((m) => { ensure(m.name); });
  // Quotes
  (state && state.quotes ? state.quotes : []).forEach((q) => {
    const n = authorNameOf(q);
    const e = ensure(n);
    if (e) e.quotes += 1;
  });
  // Articles
  (state && state.articles ? state.articles : []).forEach((a) => {
    const n = authorNameOf(a);
    const e = ensure(n);
    if (e) e.articles += 1;
  });
  const list = [...map.values()].map((e) => ({ ...e, total: e.quotes + e.articles }));
  const sorted = list.sort((a, b) => b.total - a.total || b.quotes - a.quotes);
  const html = sorted.length ? sorted.map((e) => {
    const known = MEMBERS.find((m) => normalizeName(m.name) === normalizeName(e.name));
    const color = known ? known.color : '#C59B63';
    const isMe = currentMember && normalizeName(currentMember.name) === normalizeName(e.name);
    return `
      <div class="member-stat-row">
        <button class="member-profile-trigger" type="button" data-action="open-member-profile" data-name="${esc(e.name)}">${avatarHTML(e.name, color, 'member-avatar', e.photo)}</button>
        <div class="member-stat-main">
          <button class="member-name-trigger" type="button" data-action="open-member-profile" data-name="${esc(e.name)}">${esc(e.name)}${isMe ? ' · أنت' : ''}</button>
          <small>اقتباسات: ${toAr(e.quotes)} · مقالات: ${toAr(e.articles)}</small>
        </div>
        <span class="member-stat-total"><strong>${toAr(e.total)}</strong><span>مساهمة</span></span>
      </div>`;
  }).join('') : emptyHTML('chart', 'لا إحصائيات بعد', 'ستظهر مساهمات الأعضاء هنا.');

  openSheet(`
    ${sheetHead('إحصائيات الأعضاء', 'عدد مساهمات الأعضاء من اقتباسات ومقالات — يظهر للجميع')}
    <div class="member-stats-list">${html}</div>`);
}

function openReadingTipComposer() {
  if (!isSupervisor()) { toast('إضافة النصائح للمشرفين فقط', 'info'); return; }
  openSheet(`
    ${sheetHead('إضافة نصيحة قرائية', 'صورة + عنوان + نص — تظهر في النافذة القرائية')}
    <form id="reading-tip-form" novalidate>
      <div class="field">
        <label for="tip-title">العنوان</label>
        <input class="input" id="tip-title" maxlength="80" placeholder="مثال: ٢٠ دقيقة يوميًا" required>
      </div>
      <div class="field">
        <label for="tip-body">النص</label>
        <textarea class="input" id="tip-body" rows="4" maxlength="1000" placeholder="اكتب نصيحة قرائية أو فائدة…" required></textarea>
      </div>
      <div class="field">
        <label for="tip-image-input">صورة النصيحة (اختياري)</label>
        <label class="meeting-upload" for="tip-image-input">
          <svg class="ic"><use href="#i-article"/></svg><span>اختر صورة</span><small>ستظهر كـ«نافذة» في النافذة القرائية</small>
        </label>
        <input id="tip-image-input" class="meeting-file-input" type="file" accept="image/*">
        <div id="tip-image-preview-wrap" class="meeting-image-preview-wrap crop-preview-wrap" hidden><img id="tip-image-preview" alt="معاينة"><button type="button" class="meeting-image-remove" id="tip-image-remove" aria-label="إزالة">×</button></div>
        <small id="tip-image-status" class="meeting-image-status"></small>
      </div>
      <button class="btn btn-gold btn-block" type="submit"><svg class="ic"><use href="#i-plus"/></svg> نشر النصيحة</button>
    </form>`, (root) => {
    let imageData = '';
    let cropState = { width: 640, height: 420 };
    const fileInput = root.querySelector('#tip-image-input');
    const previewWrap = root.querySelector('#tip-image-preview-wrap');
    const preview = root.querySelector('#tip-image-preview');
    const status = root.querySelector('#tip-image-status');
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { toast('اختر ملف صورة صالحًا', 'info'); fileInput.value = ''; return; }
      status.textContent = 'جارٍ تجهيز الصورة…';
      try {
        imageData = await compressMeetingImage(file);
        preview.src = imageData;
        previewWrap.hidden = false;
        if (!previewWrap.dataset.cropInit) {
          previewWrap.dataset.cropInit = '1';
          cropState = createCropControls(previewWrap, preview);
        }
        status.textContent = 'الصورة جاهزة — حدّد العرض والطول يدويًا';
      } catch (error) {
        imageData = '';
        fileInput.value = '';
        previewWrap.hidden = true;
        status.textContent = error.message;
      }
    });
    root.querySelector('#tip-image-remove').addEventListener('click', () => {
      imageData = '';
      fileInput.value = '';
      preview.removeAttribute('src');
      previewWrap.hidden = true;
      status.textContent = '';
    });
    root.querySelector('#reading-tip-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = root.querySelector('#tip-title').value.trim();
      const body = root.querySelector('#tip-body').value.trim();
      if (!title || !body) { toast('أكمل العنوان والنص', 'info'); return; }
      const finalImage = imageData ? await cropImageDataUrl(imageData, cropState) : '';
      const result = await cloudRequest('saveReadingTip', {
        title, body, image: finalImage,
        createdAt: Date.now(),
        createdBy: (currentMember && currentMember.name) || 'مشرف'
      });
      if (!result || result.success !== true) { toast('تعذر حفظ النصيحة', 'info'); return; }
      toast('تم نشر النصيحة في النافذة القرائية', 'check');
      closeSheet();
      openReadingWindowSheet();
    });
  });
}

function openMoreSheet() {
  openSheet(`
    ${sheetHead('المزيد', 'خدمات و programmes النادي')}
    <div class="more-list">
      <button class="more-item" type="button" data-action="meeting-archive">
        <span class="more-icon"><svg class="ic"><use href="#i-calendar"/></svg></span>
        <div class="more-body"><strong>اللقاءات المسجلة</strong><p>أرشيف لقاءات جليس السابقة</p></div>
        <svg class="ic chev"><use href="#i-chevron-left"/></svg>
      </button>
      <button class="more-item" type="button" data-action="view-members">
        <span class="more-icon"><svg class="ic"><use href="#i-users"/></svg></span>
        <div class="more-body"><strong>أعضاء جليس</strong><p id="more-members-count">الأعضاء المسجلون رسميًا</p></div>
        <svg class="ic chev"><use href="#i-chevron-left"/></svg>
      </button>
      <button class="more-item" type="button" data-action="reading-window">
        <span class="more-icon"><svg class="ic"><use href="#i-book"/></svg></span>
        <div class="more-body"><strong>نوافذ قرائية</strong><p>صور ونصائح عن القراءة وفوائدها — بإضافة المشرف</p></div>
        <svg class="ic chev"><use href="#i-chevron-left"/></svg>
      </button>
      <button class="more-item" type="button" data-action="club-programs">
        <span class="more-icon"><svg class="ic"><use href="#i-sparkles"/></svg></span>
        <div class="more-body"><strong>الأنشطة</strong><p>الأنشطة والدورات الثقافية</p></div>
        <svg class="ic chev"><use href="#i-chevron-left"/></svg>
      </button>
      ${isSupervisor() ? `
      <button class="more-item" type="button" data-action="view-join-requests">
        <span class="more-icon"><svg class="ic"><use href="#i-users"/></svg></span>
        <div class="more-body"><strong>طلبات الانضمام</strong><p>مراجعة طلبات الزوار والموافقة عليها</p></div>
        <svg class="ic chev"><use href="#i-chevron-left"/></svg>
      </button>` : ''}
      ${isSupervisor() ? `
      <button class="more-item" type="button" data-action="open-trash">
        <span class="more-icon"><svg class="ic"><use href="#i-trash"/></svg></span>
        <div class="more-body"><strong>سلة المحذوفات</strong><p>استعادة الاقتباسات والمقالات والكتب والرفوف واللقاءات</p></div>
        <svg class="ic chev"><use href="#i-chevron-left"/></svg>
      </button>` : ''}
    </div>`, (root) => {
    const programsButton = root.querySelector('[data-action="club-programs"]');
    if (programsButton) programsButton.addEventListener('click', () => {
      closeSheet();
      openClubProgramsSheet();
    });
    const readingButton = root.querySelector('[data-action="reading-window"]');
    if (readingButton) readingButton.addEventListener('click', () => {
      closeSheet();
      openReadingWindowSheet();
    });
    refreshMembersCount(root);
  });
}

async function refreshMembersCount(root) {
  const target = (root || document).querySelector('#more-members-count');
  if (!target) return;
  try {
    const result = await cloudRequest('getApprovedMembers');
    if (result && result.success === true && Array.isArray(result.data)) {
      cacheApprovedMembers(result.data);
      target.textContent = result.data.length
        ? `${toAr(result.data.length)} عضوًا مسجلًا`
        : 'لا أعضاء مسجلين بعد';
    }
  } catch (error) { /* تجاهل */ }
}

function renderApprovedMembers(root, members) {
  const list = root.querySelector('#members-list');
  if (!list) return;
  const countEl = root.querySelector('#members-count');
  if (countEl) countEl.textContent = members.length ? `${toAr(members.length)} عضوًا مسجلًا` : '';
  if (!members.length) {
    list.innerHTML = emptyHTML('users', 'لا أعضاء مسجلين بعد', 'ستظهر أسماء الأعضاء هنا بعد قبول حساباتهم.');
    return;
  }
  const sorted = members.slice().sort((a, b) => {
    const sa = a.role === 'supervisor' ? 0 : 1;
    const sb = b.role === 'supervisor' ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
  });
  list.innerHTML = sorted.map((member) => {
    const known = MEMBERS.find((item) => normalizeName(item.name) === normalizeName(member.name));
    const color = known ? known.color : '#C59B63';
    const isSupervisorMember = member.role === 'supervisor';
    const isConsultant = member.role === 'consultant';
    const joined = Number(member.joinedAt)
      ? `منذ ${toAr(new Date(Number(member.joinedAt)).getFullYear())}`
      : '';
    const photo = memberPhoto(member.name, member.photo || '');
    const roleLabel = isSupervisorMember ? 'مشرف النادي' : (isConsultant ? 'مستشار استشارات' : (member.memberType === 'friend' ? 'صديق جليس' : 'عضو جليس'));
    return `<div class="member-row member-row-promote">
      <button class="member-profile-trigger" type="button" data-action="open-member-profile" data-name="${esc(member.name || '')}">${avatarHTML(member.name || 'عضو جليس', color, 'member-avatar', photo)}</button>
      <div class="member-main">
        <button class="member-name-trigger" type="button" data-action="open-member-profile" data-name="${esc(member.name || '')}">${esc(member.name || 'عضو جليس')}</button>
        <small>${roleLabel}${joined ? ' · ' + joined : ''}</small>
      </div>
      ${isSupervisorMember ? '<span class="member-role">مشرف</span>' : (isConsultant ? '<span class="member-role consultant">مستشار</span>' : (member.memberType === 'friend' ? '<span class="member-role friend">صديق</span>' : ''))}
      ${isSupervisor() && member.row ? `<button class="btn btn-ghost btn-sm member-promote-btn" type="button" data-action="toggle-consultant" data-row="${esc(String(member.row))}" data-consultant="${isConsultant ? 'true' : 'false'}">${isConsultant ? 'إلغاء ترقية مستشار' : 'ترقية إلى مستشار'}</button>` : ''}
    </div>`;
  }).join('');
}

async function loadApprovedMembers(root) {
  const list = root.querySelector('#members-list');
  const countEl = root.querySelector('#members-count');
  if (countEl) countEl.textContent = 'جارٍ التحميل…';
  try {
    const result = await cloudRequest('getApprovedMembers');
    if (!result || result.success !== true || !Array.isArray(result.data)) throw new Error('failed');
    renderApprovedMembers(root, result.data);
  } catch (error) {
    if (list) list.innerHTML = emptyHTML('info', 'تعذّر تحميل الأعضاء', 'تحقق من نشر Apps Script المحدّث.');
    if (countEl) countEl.textContent = '';
  }
}

function openMembersSheet() {
  openSheet(`
    ${sheetHead('أعضاء جليس', 'الأعضاء المسجلون رسميًا بعد قبول حساباتهم')}
    <div class="members-head">
      <span class="eyebrow" id="members-count">جارٍ التحميل…</span>
      <button class="icon-btn" type="button" id="refresh-members" aria-label="تحديث قائمة الأعضاء">
        <svg class="ic"><use href="#i-refresh"/></svg>
      </button>
    </div>
    <div class="members-list" id="members-list"><div class="empty"><svg class="ic"><use href="#i-users"/></svg><h4>جارٍ التحميل…</h4></div></div>
  `, (root) => {
    const btn = root.querySelector('#refresh-members');
    if (btn) btn.addEventListener('click', () => loadApprovedMembers(root));
    loadApprovedMembers(root);
  });
}

function consultationDateLabel(value) {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return '';
  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderConsultations(root, consultations, mayAnswer, consultantsConfigured) {
  const list = root.querySelector('#consultations-list');
  if (!list) return;
  if (!consultations.length) {
    list.innerHTML = emptyHTML('info', 'لا توجد استشارات بعد', 'كن أول من يطرح سؤالًا عن كتاب أو قراءة.');
    return;
  }
  const canAnswerAll = mayAnswer || isSupervisor();
  list.innerHTML = consultations.map((item) => `
    <article class="consultation-card">
      <div class="consultation-meta"><strong>${esc(item.memberName || 'عضو جليس')}</strong><span>${esc(consultationDateLabel(item.askedAt))}</span></div>
      <p class="consultation-question">${esc(item.question || '')}</p>
      ${item.answer ? `
        <div class="consultation-answer">
          <small>إجابة ${esc(item.answeredBy || 'المستشار')}</small>
          <p>${esc(item.answer)}</p>
          ${item.answeredAt ? `<time>${esc(consultationDateLabel(item.answeredAt))}</time>` : ''}
        </div>` : canAnswerAll ? `
        <form class="consultation-answer-form" data-id="${esc(item.id)}">
          <label for="consultation-answer-${esc(item.id)}">${isSupervisor() ? 'إجابتك كمشرف' : 'إجابتك كمستشار'}</label>
          <textarea class="input" id="consultation-answer-${esc(item.id)}" name="answer" rows="3" maxlength="4000" required placeholder="اكتب إجابتك المعرفية…"></textarea>
          <button class="btn btn-sm btn-primary" type="submit"><svg class="ic"><use href="#i-send"/></svg> نشر الإجابة</button>
        </form>` : `
        <div class="consultation-awaiting"><svg class="ic"><use href="#i-clock"/></svg><span>${consultantsConfigured ? 'بانتظار إجابة أحد المستشارين المعتمدين' : 'سيُتاح الرد بعد اعتماد أسماء المستشارين'}</span></div>`}
      ${item.answer && canAnswerAll ? `
        <form class="consultation-answer-form consultation-answer-edit" data-id="${esc(item.id)}">
          <label for="consultation-reanswer-${esc(item.id)}">تعديل الإجابة أو إضافة ردّ</label>
          <textarea class="input" id="consultation-reanswer-${esc(item.id)}" name="answer" rows="2" maxlength="4000" placeholder="اكتب ردّك…">${esc(item.answer || '')}</textarea>
          <button class="btn btn-sm btn-ghost" type="submit">حفظ الرد</button>
        </form>` : ''}
    </article>`).join('');

  list.querySelectorAll('.consultation-answer-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const answer = form.querySelector('textarea').value.trim();
      if (answer.length < 2) { toast('اكتب الإجابة أولًا', 'info'); return; }
      setBtnBusy(submit, true, 'جارٍ النشر…');
      const result = await cloudRequest('answerConsultation', {
        memberId: currentMember.id,
        id: form.dataset.id,
        answer
      });
      setBtnBusy(submit, false);
      if (!result || result.success !== true) {
        toast(cleanServerError(result, 'تعذر نشر الإجابة'), 'info');
        return;
      }
      toast('تم نشر الإجابة', 'check');
      await loadConsultations(root);
    });
  });
}

async function loadConsultations(root) {
  const list = root.querySelector('#consultations-list');
  if (!list) return;
  list.innerHTML = '<p class="deleted-items-loading">جارٍ تحميل الاستشارات…</p>';
  const result = await cloudRequest('getConsultations', null, currentMember && !isGuest() ? currentMember.id : null);
  if (!root.querySelector('#consultations-list')) return;
  if (!result || result.success !== true || !Array.isArray(result.data)) {
    list.innerHTML = emptyHTML('info', 'تعذر تحميل الاستشارات', 'تحقق من نشر Apps Script المحدّث.');
    return;
  }
  const mayAnswer = result.canAnswer === true || isSupervisor();
  const banner = root.querySelector('#consultation-role-banner');
  if (banner) {
    banner.hidden = !mayAnswer;
    if (mayAnswer) {
      banner.querySelector('strong').textContent = isSupervisor() ? 'أنت مشرف النادي' : 'أنت مستشار معتمد';
      banner.querySelector('span').textContent = 'يمكنك الإجابة على الاستشارات مباشرة من هنا.';
    }
  }
  const headNote = root.querySelector('#consultation-head-note');
  if (headNote) headNote.textContent = mayAnswer ? 'يمكنك الرد على الاستشارات مباشرة' : 'الإجابة للمستشارين المعتمدين فقط';
  renderConsultations(root, result.data, mayAnswer, result.consultantsConfigured === true);
}

function openConsultationsSheet() {
  openSheet(`
    ${sheetHead('استشارة رأي', 'أسئلة الأعضاء وإجابات المستشارين في الكتب والقراءة')}
    ${isGuest() ? `
      <div class="consultation-signin">
        <p>يمكن للأعضاء طرح الأسئلة. سجّل الدخول لإرسال استشارتك.</p>
        <button class="btn btn-sm btn-primary" type="button" data-action="open-gate">دخول الأعضاء</button>
      </div>` : `
      <form id="consultation-question-form" class="consultation-question-form">
        <label for="consultation-question">اطرح سؤالك</label>
        <textarea class="input" id="consultation-question" name="question" rows="3" maxlength="2000" required placeholder="اكتب سؤالك عن كتاب أو فكرة قرائية…"></textarea>
        <button class="btn btn-gold btn-block" type="submit"><svg class="ic"><use href="#i-send"/></svg> إرسال للمستشارين</button>
      </form>`}
    <div class="consultation-role-banner" id="consultation-role-banner" hidden>
      <svg class="ic"><use href="#i-check"/></svg>
      <div><strong>أنت مستشار معتمد</strong><span>يمكنك الإجابة على الاستشارات مباشرة من هنا.</span></div>
    </div>
    <div class="consultations-section-head"><h3>الاستشارات</h3><span id="consultation-head-note">الإجابة للمستشارين المعتمدين فقط</span></div>
    <div id="consultations-list" class="consultations-list"><p class="deleted-items-loading">جارٍ التحميل…</p></div>
  `, (root) => {
    const form = root.querySelector('#consultation-question-form');
    if (form) form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentMember || isGuest()) { toast('سجّل الدخول لإرسال استشارتك', 'info'); return; }
      const question = form.querySelector('textarea').value.trim();
      if (question.length < 8) { toast('اكتب سؤالك بتفصيل أكبر', 'info'); return; }
      const submit = form.querySelector('button[type="submit"]');
      setBtnBusy(submit, true, 'جارٍ الإرسال…');
      const result = await cloudRequest('submitConsultation', {
        memberId: currentMember.id,
        question
      });
      setBtnBusy(submit, false);
      if (!result || result.success !== true) {
        toast(cleanServerError(result, 'تعذر إرسال الاستشارة'), 'info');
        return;
      }
      form.reset();
      toast('وصل سؤالك للمستشارين', 'check');
      await loadConsultations(root);
    });
    loadConsultations(root);
  });
}

function renderDeletedItems(root, items) {
  const list = root.querySelector('#deleted-items-list');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = emptyHTML('check', 'سلة المحذوفات فارغة', 'العناصر المحذوفة تبقى محفوظة هنا ويمكن استعادتها.');
    return;
  }
  const labels = { quote: 'اقتباس', book: 'كتاب', shelf: 'رف تصنيف', article: 'مقال', recording: 'لقاء مسجل' };
  const icons = { quote: 'quote', book: 'book', shelf: 'library', article: 'article', recording: 'play' };
  list.innerHTML = items.map((item) => {
    const title = item.title || item.id || 'عنصر محذوف';
    const detail = item.type === 'quote'
      ? item.text
      : item.type === 'shelf'
        ? `${toAr(item.booksCount || 0)} كتاب مرتبط`
        : item.category;
    const deletedAt = Number(item.deletedAt)
      ? new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(new Date(Number(item.deletedAt)))
      : '';
    const icon = icons[item.type] || 'library';
    return `
      <article class="deleted-item-card">
        <span class="deleted-item-icon"><svg class="ic"><use href="#i-${icon}"/></svg></span>
        <div class="deleted-item-body">
          <small>${esc(labels[item.type] || 'عنصر')}</small>
          <strong>${esc(title)}</strong>
          ${detail ? `<p>${esc(String(detail).slice(0, 110))}</p>` : ''}
          <span>${deletedAt ? `حُذف ${esc(deletedAt)}` : ''}${item.deletedBy ? ` · ${esc(item.deletedBy)}` : ''}</span>
        </div>
        <button class="btn btn-sm btn-ghost deleted-item-restore" type="button" data-action="restore-deleted" data-type="${esc(item.type)}" data-id="${encodeURIComponent(String(item.id))}">استعادة</button>
      </article>`;
  }).join('');
}

function openTrashSheet() {
  if (!isSupervisor()) { toast('سلة المحذوفات للمشرفين فقط', 'info'); return; }
  openSheet(`
    ${sheetHead('سلة المحذوفات', 'الحذف هنا قابل للاستعادة ولا يحذف البيانات نهائيًا')}
    <div class="trash-toolbar">
      <span>السلة مشتركة بين مشرفي النادي</span>
      <button class="icon-btn" type="button" id="refresh-trash" aria-label="تحديث سلة المحذوفات">
        <svg class="ic"><use href="#i-refresh"/></svg>
      </button>
    </div>
    <div id="deleted-items-list" class="deleted-items-list"><p class="deleted-items-loading">جارٍ التحميل…</p></div>`, async (root) => {
    const refresh = async () => {
      const list = root.querySelector('#deleted-items-list');
      if (!list) return;
      list.innerHTML = '<p class="deleted-items-loading">جارٍ تحديث السلة…</p>';
      const result = await cloudRequest('getDeletedItems');
      if (!root.querySelector('#deleted-items-list')) return;
      if (!result || result.success !== true || !Array.isArray(result.data)) {
        list.innerHTML = emptyHTML('info', 'تعذر تحميل السلة', 'تحقق من نشر Apps Script المحدّث.');
        return;
      }
      if (result.data.length && !result.data.some((item) => item && item.type)) {
        list.innerHTML = emptyHTML('info', 'نسخة Apps Script قديمة', 'انشر النسخة المحدّثة من الكود لتفعيل سلة المحذوفات.');
        return;
      }
      renderDeletedItems(root, result.data);
    };
    const refreshButton = root.querySelector('#refresh-trash');
    if (refreshButton) refreshButton.addEventListener('click', refresh);
    await refresh();
  });
}

async function restoreDeletedItem(type, encodedId) {
  if (!isSupervisor()) { toast('الاستعادة للمشرفين فقط', 'info'); return; }
  let id = encodedId || '';
  try { id = decodeURIComponent(id); } catch (error) {}
  const actions = { quote: 'restoreQuote', book: 'restoreClubBook', shelf: 'restoreLibraryCategory', article: 'restoreArticle', recording: 'restoreRecordedMeeting' };
  const action = actions[type];
  if (!action) return;
  const result = await cloudRequest(action, { id });
  if (!result || result.success === false) {
    toast(result && result.error ? result.error : 'تعذرت الاستعادة', 'info');
    return;
  }

  if (type === 'quote') {
    deletedQuoteIds.delete(String(id));
    await syncQuotesFromSheet();
    renderQuotes();
  } else if (type === 'book') {
    deletedClubBookIds.delete(String(id));
    await refreshClubBooksFromCloud();
  } else if (type === 'shelf') {
    await refreshLibraryCategoriesFromCloud();
    await refreshClubBooksFromCloud();
  } else if (type === 'article') {
    deletedArticleIds.delete(String(id));
    await refreshArticlesFromCloud();
  } else if (type === 'recording') {
    deletedRecordedMeetingIds.delete(String(id));
    const meetings = await loadRecordedMeetingsFromCloud();
    if (Array.isArray(meetings)) state.recordedMeetings = meetings;
  }
  renderHome();
  openTrashSheet();
  toast('تمت الاستعادة بنجاح', 'check');
}

function openMeetingSheet(id = '') {
  const meeting = (state.meetings || []).find((item) => String(item.id) === String(id)) || getCurrentMeeting();
  const timeLabel = meetingTimeLabel(meeting.time || meeting.date);
  const locationUrl = meetingLocationUrl(meeting.location);
  const cropStyle = meeting.image
    ? `object-position:${clamp(Number(meeting.imagePosX) || 50, 0, 100)}% ${clamp(Number(meeting.imagePosY) || 50, 0, 100)}%;transform:scale(${(clamp(Number(meeting.imageScale) || 100, 100, 300) / 100).toFixed(2)})`
    : '';
  const image = meeting.image
    ? `<img class="meeting-sheet-poster" style="${cropStyle}" src="${esc(meeting.image)}" alt="إعلان ${esc(meeting.title)}">`
    : '';
  openSheet(`
    ${sheetHead('تفاصيل اللقاء', 'نلتقي على القراءة والحوار')}
    ${image}
    <div class="meeting-sheet-heading">
      <span class="chip chip-soft">لقاء جليس</span>
      <h2>${esc(meeting.title || 'لقاء نادي جليس')}</h2>
      ${meeting.description ? `<p>${esc(meeting.description)}</p>` : ''}
    </div>
    <div class="meeting-sheet-details">
      <div><svg class="ic"><use href="#i-calendar"/></svg><span><small>التاريخ</small><b>${esc(meetingDateLabel(meeting.date))}</b></span></div>
      ${timeLabel ? `<div><svg class="ic"><use href="#i-clock"/></svg><span><small>الوقت</small><b>${esc(timeLabel)}</b></span></div>` : ''}
      ${meeting.location ? `<a class="meeting-sheet-location-link" href="${esc(locationUrl)}" target="_blank" rel="noopener noreferrer"><svg class="ic"><use href="#i-pin"/></svg><span><small>المكان · افتح الخريطة</small><b>${esc(meeting.location)}</b></span></a>` : ''}
    </div>
    <div class="meeting-attendance-note"><svg class="ic"><use href="#i-users"/></svg><span>${state.rsvp ? 'تم تأكيد حضورك على هذا الجهاز' : 'يسعدنا تأكيد حضورك في اللقاء'}</span></div>
    <button class="btn ${state.rsvp ? 'btn-primary' : 'btn-gold'} btn-block" type="button" id="meeting-rsvp">
      <svg class="ic"><use href="#i-${state.rsvp ? 'check' : 'calendar'}"/></svg>
      ${state.rsvp ? 'حضورك مؤكد — نراك هناك' : 'أؤكد الحضور'}
    </button>`);
}

function openMeetingComposer() {
  if (!isSupervisor()) { toast('إضافة اللقاءات للمشرفين فقط', 'info'); return; }
  openSheet(`
    ${sheetHead('إضافة لقاء جديد', 'أضف إعلان اللقاء ومعلوماته ليظهر لجميع أعضاء جليس')}
    <form id="meeting-form" class="meeting-form" novalidate>
      <div class="field">
        <label for="meeting-title-input">عنوان اللقاء</label>
        <input class="input" id="meeting-title-input" maxlength="100" placeholder="مثال: مناقشة كتاب ابني حبيبي" required>
      </div>
      <div class="field">
        <label for="meeting-description-input">التعليق أو وصف اللقاء</label>
        <textarea class="input" id="meeting-description-input" rows="4" maxlength="700" placeholder="اكتب نبذة قصيرة عن اللقاء…"></textarea>
      </div>
      <div class="meeting-form-row">
        <div class="field"><label>التاريخ (سنة / شهر / يوم)</label>${dateYMDField('meeting-date', 'تاريخ اللقاء')}</div>
        <div class="field"><label for="meeting-time-input">الوقت</label><input class="input" id="meeting-time-input" type="time" required dir="ltr"></div>
      </div>
      <div class="field">
        <label for="meeting-location-input">المكان</label>
        <input class="input" id="meeting-location-input" maxlength="160" placeholder="الموقع أو رابط اللقاء">
      </div>
      <div class="field">
        <label for="meeting-image-input">صورة الإعلان</label>
        <label class="meeting-upload" for="meeting-image-input">
          <svg class="ic"><use href="#i-article"/></svg><span>اختر صورة اللقاء</span><small>ستظهر للأعضاء في الصفحة الرئيسية</small>
        </label>
        <input id="meeting-image-input" class="meeting-file-input" type="file" accept="image/*">
        <div id="meeting-image-preview-wrap" class="meeting-image-preview-wrap crop-preview-wrap" hidden>
          <img id="meeting-image-preview" alt="معاينة صورة اللقاء">
          <button type="button" class="meeting-image-remove" id="meeting-image-remove" aria-label="إزالة الصورة">×</button>
        </div>
        <small id="meeting-image-status" class="meeting-image-status"></small>
      </div>
      <button class="btn btn-gold btn-block" type="submit"><svg class="ic"><use href="#i-calendar"/></svg> نشر اللقاء للأعضاء</button>
    </form>`, (root) => {
    let imageData = '';
    let crop = { width: 640, height: 420 };
    const fileInput = root.querySelector('#meeting-image-input');
    const previewWrap = root.querySelector('#meeting-image-preview-wrap');
    const preview = root.querySelector('#meeting-image-preview');
    const status = root.querySelector('#meeting-image-status');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast('اختر ملف صورة صالحًا', 'info');
        fileInput.value = '';
        return;
      }
      status.textContent = 'جارٍ تجهيز الصورة…';
      try {
        imageData = await compressMeetingImage(file);
        preview.src = imageData;
        previewWrap.hidden = false;
        if (!previewWrap.dataset.cropInit) {
          previewWrap.dataset.cropInit = '1';
          crop = createCropControls(previewWrap, preview);
        }
        status.textContent = 'الصورة جاهزة — حدّد العرض والطول يدويًا بما يناسب العرض';
      } catch (error) {
        imageData = '';
        fileInput.value = '';
        previewWrap.hidden = true;
        status.textContent = error.message;
      }
    });

    root.querySelector('#meeting-image-remove').addEventListener('click', () => {
      imageData = '';
      crop = { width: 640, height: 420 };
      fileInput.value = '';
      preview.removeAttribute('src');
      previewWrap.hidden = true;
      status.textContent = '';
    });

    root.querySelector('#meeting-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!isSupervisor()) { toast('إضافة اللقاءات للمشرفين فقط', 'info'); return; }
      const title = root.querySelector('#meeting-title-input').value.trim();
      const date = readYMD('meeting-date');
      const time = root.querySelector('#meeting-time-input').value;
      if (!title || !date || !time) { toast('أكمل العنوان والتاريخ والوقت', 'info'); return; }

      const finalImage = imageData ? await cropImageDataUrl(imageData, crop) : '';
      const meeting = {
        id: `meeting-${Date.now()}`,
        title,
        description: root.querySelector('#meeting-description-input').value.trim(),
        date,
        time,
        location: root.querySelector('#meeting-location-input').value.trim(),
        image: finalImage,
        imagePosX: 50,
        imagePosY: 50,
        imageScale: 100,
        createdAt: Date.now(),
        createdBy: currentMember.name
      };

      state.meetings = [meeting, ...(state.meetings || []).filter((item) => item.id !== meeting.id)];
      state.rsvp = false;
      await saveState();
      renderMeetingCard();
      closeSheet();
      const result = await saveMeetingToCloud(meeting);
      if (!result || result.success === false) {
        toast('نُشر اللقاء على هذا الجهاز، لكن تعذرت مزامنته لبقية الأعضاء. تحقق من نشر Apps Script المحدّث.', 'info');
        return;
      }
      toast('تم نشر اللقاء للأعضاء', 'calendar');
    });
  });
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
  const allowed = ['home', 'quotes', 'library', 'articles', 'profile'];
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

  if (name === 'quotes') state.seenQuotes = (state.quotes || []).length;
  if (name === 'library') state.seenClubBooks = (state.clubBooks || []).length;
  if (name === 'articles') state.seenArticles = visibleMemberArticles().length;
  updateNavBadges();
}

function renderAll() {
  renderHome();
  renderQuotes();
  renderLibrary();
  renderArticles();
  renderProfile();
  updateNavBadges();
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
    state.articles.forEach((article) => { if (article && article.id) syncState.articles.add(article.id); });
    persistSyncState(member.id);
  }
  try {
    localStorage.setItem(SESSION_KEY, member.id);
  } catch (error) {
    /* التخزين غير متاح */
  }
  await saveState();
}

function showGate(view = 'register') {
  closeSheet();
  try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* تجاهل */ }
  persistAccount(null);
  pendingResetEmail = '';
  pendingRegister = null;
  currentMember = null;
  state = null;
  $('#gate').hidden = false;
  $('#shell').hidden = true;
  ['login-email', 'login-password', 'register-name', 'register-email', 'register-password',
    'register-confirm', 'verify-code', 'forgot-email', 'reset-code', 'reset-password'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
  showGateView(view);
  currentScreen = 'home';
  hideSplash();
}

function applyGuestVisibility() {
  const isGuest = !currentMember || currentMember.id === 'guest';
  const blocked = new Set(['go-log', 'go-add-book-report', 'open-quote', 'open-article-compose', 'open-add-book', 'open-add-my-book', 'add-book', 'start-book', 'save-page', 'remove-book', 'reset-demo', 'like-quote', 'save-quote', 'save-article', 'manage-library-categories']);
  document.querySelectorAll('[data-action]').forEach((el) => {
    if (blocked.has(el.dataset.action)) el.style.display = isGuest ? 'none' : '';
  });
  const logForm = document.getElementById('log-form');
  if (logForm) logForm.style.display = isGuest ? 'none' : '';
  const goalCard = document.querySelector('.goal-card');
  if (goalCard) goalCard.style.display = isGuest ? 'none' : '';
  const categoryManager = document.getElementById('manage-library-categories-btn');
  if (categoryManager) categoryManager.hidden = !isSupervisor();
}

function showPublicHome() {
  pendingRegister = null;
  pendingResetEmail = '';
  try {
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch (error) { /* تجاهل */ }

  currentMember = { id: 'guest', name: 'زائر', role: 'زائر', lastWeek: 0, color: '#1E3A2B' };
  const base = createInitialState(null);
  state = {
    ...base,
    memberId: 'guest',
    profile: { ...base.profile, name: 'زائر', role: 'زائر' },
    quotes: getLocalSharedQuotes(),
    articles: ARTICLE_SEED.map((article) => ({ ...article })),
    seenQuotes: getLocalSharedQuotes().length,
    seenArticles: ARTICLE_SEED.length,
    seenClubBooks: 0
  };
  enterApp(false);
  try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* تجاهل */ }
}

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('hidden');
  setTimeout(() => { if (splash.parentNode) splash.remove(); }, 520);
}

function updateNavBadges() {
  if (!state) return;
  const badges = {
    quotes: Math.max(0, (state.quotes || []).length - (state.seenQuotes || 0)),
    library: Math.max(0, (state.clubBooks || []).length - (state.seenClubBooks || 0)),
    articles: Math.max(0, visibleMemberArticles().length - (state.seenArticles || 0))
  };
  Object.entries(badges).forEach(([key, count]) => {
    const el = document.getElementById(`badge-${key}`);
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 9 ? '9+' : String(count);
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  });
}

async function showBackendVersion() {
  const el = document.getElementById('app-version');
  if (!el) return;
  try {
    const result = await cloudRequest('getVersion');
    const version = (result && result.version) ? result.version : 'غير معروف';
    el.textContent = `· ${version}`;
    el.title = 'نسخة الخادم المنشورة — تأكد أنها مطابقة لأحدث حزمة';
  } catch (error) {
    el.textContent = '· تعذر الاتصال بالخادم';
    el.title = 'تحقق من نشر Apps Script بإصدار جديد';
  }
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
  applyGuestVisibility();
  setTimeout(hideSplash, 2500);
  go('home');
  /* إظهار زر «التسجيل في النادي/دخول» فقط في وضع الزائر */
  const guestRegisterBtn = $('#guest-register-btn');
  const guestLoginBtn = $('#guest-login-btn');
  const isGuest = currentMember && currentMember.id === 'guest';
  [guestRegisterBtn, guestLoginBtn].forEach((btn) => {
    if (btn) {
      btn.hidden = !isGuest;
      btn.style.display = isGuest ? '' : 'none';
    }
  });
  /* سحب اقتباسات الأعضاء من الشيت المشترك في الخلفية */
  if (typeof syncQuotesFromSheet === 'function') syncQuotesFromSheet();
  /* جلب كتب النادي المشتركة حتى مع وجود حالة محلية قديمة للعضو */
  refreshClubBooksFromCloud();
  /* جلب أسماء تصنيفات المكتبة المشتركة */
  refreshLibraryCategoriesFromCloud();
  /* جلب المقالات المشتركة من الشيت */
  refreshArticlesFromCloud();
  /* تحديث الصورة الشخصية من الحساب المشترك على أي جهاز */
  refreshMemberProfileFromCloud();
  /* جلب اللقاءات المشتركة من الشيت */
  refreshMeetingsFromCloud();
  /* جلب صور الأعضاء حتى تظهر صورتك عند الكل في كل مكان */
  refreshApprovedMembersCache().then(() => {
    if (state && currentMember) {
      renderHome();
      renderQuotes();
      renderArticles();
      renderReadings();
    }
  });
  /* مزامنة مكتبتي من الشيت حتى لا تضيع الكتب عند تغيير الجهاز */
  loadMyBooksFromCloud(currentMember ? currentMember.id : null).then((cloudBooks) => {
    if (!Array.isArray(cloudBooks) || !state || !currentMember) return;
    const map = new Map();
    (state.myBooks || []).forEach((b) => { if (b && b.bookId) map.set(String(b.bookId), b); });
    cloudBooks.forEach((b) => { if (b && b.bookId) map.set(String(b.bookId), b); });
    const merged = [...map.values()];
    const changed = merged.length !== (state.myBooks || []).length;
    if (changed) {
      state.myBooks = merged;
      saveState();
      renderLibrary();
      renderHome();
      renderProfile();
    }
    merged.forEach((b) => syncState.myBooks.add(myBookSyncKey(b)));
    persistSyncState(currentMember.id);
  });
  /* جلب آراء الكتب المشتركة وتحديث متوسطات المكتبة */
  refreshBookRatingsFromCloud().then(() => {
    if (state && currentMember) {
      renderLibrary();
      renderHome();
    }
  });
  if (welcome) {
    const firstName = state.profile.name.trim().split(/\s+/)[0];
    setTimeout(() => toast(`أهلاً ${firstName}… مجلسك جاهز`, 'sparkles'), 550);
  }
  showBackendVersion();
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

  const isGuest = !currentMember || currentMember.id === 'guest';
  const guestBlocked = new Set(['go-log', 'go-add-book-report', 'open-quote', 'open-article-compose', 'open-add-book', 'open-add-my-book', 'add-book', 'start-book', 'save-page', 'remove-book', 'reset-demo', 'like-quote', 'save-quote', 'save-article']);
  if (isGuest && guestBlocked.has(action)) {
    showGate();
    toast('سجّل دخولك بالبريد والرمز للتعديل والإضافة', 'user');
    return;
  }

  switch (action) {
    case 'open-gate':
    case 'open-gate-login':
      showGate('login');
      toast('سجّل دخولك بالبريد والرمز للتعديل والإضافة', 'user');
      break;
    case 'open-gate-register':
      showGate('register');
      toast('أنشئ حسابك الجديد للانضمام إلى نادي جليس', 'user');
      break;
    case 'open-join':
      openJoinSheet();
      break;
    case 'open-more':
      openMoreSheet();
      break;
    case 'open-guide':
      closeSheet();
      openGuideSheet();
      break;
    case 'reading-window':
      closeSheet();
      openReadingWindowSheet();
      break;
    case 'member-stats':
      closeSheet();
      openMemberStatsSheet();
      break;
    case 'open-consultations':
      openConsultationsSheet();
      break;
    case 'view-members':
      openMembersSheet();
      break;
    case 'view-join-requests':
      openJoinRequestsSheet();
      break;
    case 'join-accept':
      setJoinRequestStatus(actionEl, 'accepted');
      break;
    case 'join-reject':
      setJoinRequestStatus(actionEl, 'rejected');
      break;
    case 'member-accept':
      setMemberAccountStatus(actionEl, 'active');
      break;
    case 'member-reject':
      setMemberAccountStatus(actionEl, 'rejected');
      break;
    case 'toggle-consultant': {
      if (!isSupervisor()) { toast('غير مصرح', 'info'); break; }
      const row = Number(actionEl.dataset.row);
      const currently = actionEl.dataset.consultant === 'true';
      const newStatus = !currently;
      cloudRequest('setConsultantStatus', { row, isConsultant: newStatus, by: (currentMember && currentMember.name) || 'مشرف' })
        .then((result) => {
          if (result && result.success === true) {
            toast(newStatus ? 'تمت ترقية العضو إلى مستشار استشارات' : 'تم إلغاء ترقية المستشار', 'check');
            refreshJoinRequests();
            const membersList = document.querySelector('#members-list');
            if (membersList) loadApprovedMembers(document.querySelector('.sheet-root') || document);
          } else {
            toast(cleanServerError(result, 'تعذر تحديث الترقية'), 'info');
          }
        })
        .catch(() => toast('تعذر تحديث الترقية', 'info'));
      break;
    }
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
    case 'open-member-profile':
      openMemberProfileSheet(actionEl.dataset.name || '');
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
    case 'go-add-book-report':
      state.libraryPane = 'club';
      go('library');
      setTimeout(openAddBook, 180);
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
    case 'add-quote-from-book': {
      const book = getBook(id) || (state.clubBooks || []).find((b) => String(b.id) === String(id));
      closeSheet();
      openQuoteComposer(id, book ? book.title : '');
      break;
    }
    case 'open-article-compose':
      openArticleComposer();
      break;
    case 'open-add-book':
      openAddBook();
      break;
    case 'manage-library-categories':
      openLibraryCategoryManager();
      break;
    case 'add-library-category':
      openLibraryCategoryEditor();
      break;
    case 'rename-library-category': {
      let categoryName = id || '';
      try { categoryName = decodeURIComponent(categoryName); } catch (error) {}
      openLibraryCategoryEditor(categoryName);
      break;
    }
    case 'delete-library-category': {
      let categoryName = id || '';
      try { categoryName = decodeURIComponent(categoryName); } catch (error) {}
      confirmDeleteLibraryCategory(categoryName);
      break;
    }
    case 'open-trash':
      openTrashSheet();
      break;
    case 'restore-deleted':
      restoreDeletedItem(actionEl.dataset.type, id);
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
        actionEl.textContent = expanded ? 'قراءة المزيد' : 'أقل';
      }
      break;
    }
    case 'meeting':
      openMeetingSheet(id);
      break;
    case 'meeting-archive':
      openMeetingArchiveSheet();
      break;
    case 'add-meeting':
      openMeetingComposer();
      break;
    case 'add-recorded-meeting':
      openRecordedMeetingComposer();
      break;
    case 'delete-recorded-meeting':
      confirmDeleteRecordedMeeting(id);
      break;
    case 'logout':
      openConfirm({
        title: 'تسجيل الخروج',
        text: 'ستعود إلى بوابة الأعضاء. تقدمك محفوظ باسمك في هذا الجهاز.',
        confirmLabel: 'خروج',
        onConfirm: () => {
          try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* تجاهل */ }
          showGate('login');
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
        toast('أُزيلت من الاقتباسات المفضلة', 'bookmark');
      } else {
        state.likedQuotes.push(id);
        toast('أُضيف إلى الاقتباسات المفضلة', 'bookmark');
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
    case 'delete-quote': {
      if (!isSupervisor()) { toast('غير مصرح', 'info'); break; }
      const q = state.quotes.find((item) => item.id === id);
      if (!q) break;
      openConfirm({
        title: 'حذف الاقتباس',
        text: `سينتقل الاقتباس «${q.text.slice(0, 60)}…» إلى سلة المحذوفات ويمكن استعادته لاحقًا.`,
        confirmLabel: 'نقل للسلة',
        onConfirm: async () => {
          const result = await cloudRequest('deleteQuote', {
            id: q.id,
            text: q.text,
            book_title: q.book || '',
            page_number: q.page || '',
            author_name: q.authorName || state.profile.name,
            deletedBy: currentMember ? currentMember.name : 'مشرف'
          });
          if (!result || result.success === false) {
            toast('تعذر نقل الاقتباس إلى سلة المحذوفات؛ لم نحذفه من الموقع.', 'info');
            return;
          }
          deletedQuoteIds.add(String(q.id));
          deletedQuoteTexts.add(normalizeName(q.text));
          state.quotes = state.quotes.filter((item) => item.id !== id);
          saveLocalSharedQuotes(state.quotes);
          saveState();
          renderQuotes();
          renderHome();
          updateNavBadges();
          toast('نُقل الاقتباس إلى سلة المحذوفات', 'trash');
        }
      });
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
    case 'edit-club-book':
      openEditClubBook(id);
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
          // Delete from cloud sheet so it does not reappear on another device
          if (currentMember && currentMember.id !== 'guest') {
            cloudRequest('deleteMyBook', { memberId: currentMember.id, bookId: id }).catch(() => {});
            // Also remove from sync cache so it is not re-uploaded
            syncState.myBooks.forEach((key) => { if (key.includes(String(id))) syncState.myBooks.delete(key); });
            persistSyncState(currentMember.id);
          }
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
      shareArticle(article);
      break;
    }
    case 'delete-article': {
      if (!isSupervisor()) { toast('غير مصرح', 'info'); break; }
      const a = state.articles.find((item) => item.id === id);
      if (!a) break;
      openConfirm({
        title: 'نقل المقال إلى سلة المحذوفات',
        text: `سيختفي المقال «${a.title}» من الموقع ويمكن استعادته لاحقًا.`,
        confirmLabel: 'نقل للسلة',
        onConfirm: async () => {
          const result = await cloudRequest('deleteArticle', {
            id,
            title: a.title || '',
            category: a.category || '',
            body: a.body || '',
            excerpt: a.excerpt || '',
            read: a.read || 3,
            createdAt: a.createdAt || Date.now(),
            memberId: a.authorId || (currentMember ? currentMember.id : ''),
            memberName: a.authorName || (currentMember ? currentMember.name : ''),
            deletedBy: currentMember ? currentMember.name : 'مشرف'
          });
          if (!result || result.success === false) {
            toast('تعذر نقل المقال إلى سلة المحذوفات؛ لم نحذفه.', 'info');
            return;
          }
          deletedArticleIds.add(String(id));
          state.articles = state.articles.filter((item) => item.id !== id);
          if (currentMember && currentMember.id !== 'guest') {
            syncState.articles.add(id);
            persistSyncState(currentMember.id);
          }
          saveState();
          renderArticles();
          renderHome();
          updateNavBadges();
          toast('نُقل المقال إلى سلة المحذوفات', 'trash');
        }
      });
      break;
    }
    case 'delete-club-book': {
      if (!isSupervisor()) { toast('غير مصرح', 'info'); break; }
      const book = state.clubBooks.find((item) => item.id === id);
      if (!book) break;
      openConfirm({
        title: 'نقل الكتاب إلى سلة المحذوفات',
        text: `سيختفي «${book.title}» من مكتبة النادي ويمكن استعادته لاحقًا من سلة المحذوفات.`,
        confirmLabel: 'نقل للسلة',
        onConfirm: async () => {
          const result = await cloudRequest('deleteClubBook', { id, deletedBy: currentMember.name });
          if (!result || result.success === false) {
            toast('تعذر نقل الكتاب إلى سلة المحذوفات؛ لم نحذفه من الموقع.', 'info');
            return;
          }
          deletedClubBookIds.add(String(id));
          state.clubBooks = state.clubBooks.filter((item) => item.id !== id);
          saveState();
          renderLibrary();
          renderHome();
          updateNavBadges();
          toast('نُقل الكتاب إلى سلة المحذوفات', 'trash');
        }
      });
      break;
    }
    case 'rate-book': {
      openRateBookSheet(id);
      break;
    }
    case 'view-ratings': {
      openViewRatingsSheet(id);
      break;
    }
    default:
      break;
  }
}

function handleLogSubmit(event) {
  event.preventDefault();
  const isGuest = !currentMember || currentMember.id === 'guest';
  if (isGuest) { showGate(); toast('سجّل دخولك بالبريد والرمز للتعديل والإضافة', 'user'); return; }
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
  bindPasswordToggles();

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const identifier = $('#login-email').value.replace(/\s+/g, ' ').trim();
    const password = $('#login-password').value;
    const error = $('#login-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (!identifier || !password) {
      error.textContent = 'أدخل اسمك الثلاثي أو بريدك الإلكتروني والرمز السري.';
      error.hidden = false;
      return;
    }
    if (identifier.includes('@')
      ? !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identifier)
      : identifier.split(' ').filter(Boolean).length < 3) {
      error.textContent = 'أدخل اسمك الثلاثي أو بريدًا إلكترونيًا صحيحًا.';
      error.hidden = false;
      return;
    }

    error.hidden = true;
    setBtnBusy(submitBtn, true, 'جارٍ الدخول…');
    try {
      const result = await cloudRequest('loginMember', { identifier, password });
      if (!result || result.success !== true || !result.member) {
        error.textContent = result && result.success === true && !result.member
          ? 'خدمة الدخول لم تُرجع بيانات الحساب. يجب تحديث Apps Script ونشر إصدار جديد.'
          : cleanServerError(result, 'تعذر الدخول، تحقق من الاسم أو البريد والرمز.');
        error.hidden = false;
        return;
      }
      if (String(result.member.status || '').toLowerCase() !== 'active') {
        const statusMessage = result.member.status === 'pending'
          ? 'حسابك بانتظار موافقة المشرف'
          : result.member.status === 'rejected'
            ? 'تم رفض طلب حسابك، تواصل مع إدارة النادي'
            : 'تعذر التحقق من حالة الحساب. حدّث الصفحة وحاول مرة أخرى.';
        error.textContent = statusMessage;
        error.hidden = false;
        return;
      }
      await completeLogin(result.member);
    } finally {
      setBtnBusy(submitBtn, false);
    }
  });

  $('#register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('#register-name').value.replace(/\s+/g, ' ').trim();
    const phone = $('#register-phone').value.trim()
      .replace(/[٠-٩]/g, (digit) => String(AR.indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[\s().-]/g, '');
    const email = $('#register-email').value.trim();
    const password = $('#register-password').value;
    const confirm = $('#register-confirm').value;
    const error = $('#register-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const fail = (message) => { error.textContent = message; error.hidden = false; };

    if (name.split(' ').filter(Boolean).length < 3) return fail('اكتب الاسم الثلاثي كما في الهوية.');
    if (!/^\+?\d{8,15}$/.test(phone)) return fail('أدخل رقم جوال صحيحًا.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('صيغة البريد الإلكتروني غير صحيحة.');
    if (password.length < 8) return fail('الرمز السري يجب أن يكون ٨ أحرف أو أكثر.');
    if (password !== confirm) return fail('الرمزان غير متطابقين.');

    error.hidden = true;
    setBtnBusy(submitBtn, true, 'جارٍ إرسال الرمز…');
    try {
      const result = await cloudRequest('requestRegistrationCode', { name, phone, email, password });
      if (!result || result.success !== true) {
        fail(cleanServerError(result, 'تعذر إرسال رمز التحقق، حاول مرة أخرى.'));
        return;
      }
      pendingRegister = { name, phone, email, password };
      $('#verify-code').value = '';
      $('#verify-email').textContent = email;
      showGateView('verify');
      toast('أرسلنا رمز التحقق إلى بريدك', 'send');
    } finally {
      setBtnBusy(submitBtn, false);
    }
  });

  $('#verify-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = $('#verify-code').value.trim();
    const error = $('#verify-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (!pendingRegister) { showGateView('register'); return; }
    if (!/^\d{6}$/.test(code)) {
      error.textContent = 'رمز التحقق ستة أرقام.';
      error.hidden = false;
      return;
    }

    error.hidden = true;
    setBtnBusy(submitBtn, true, 'جارٍ التأكيد…');
    try {
      const result = await cloudRequest('verifyRegistrationCode', {
        email: pendingRegister.email,
        code
      });
      if (!result || result.success !== true || result.status !== 'pending') {
        error.textContent = cleanServerError(result, 'لم يتم تأكيد طلبك كحساب بانتظار الموافقة. حدّث الصفحة وحاول مرة أخرى.');
        error.hidden = false;
        return;
      }
      pendingRegister = null;
      showGateView('pending');
      toast('تم إنشاء طلب حسابك، سنتواصل معك عند قبولك', 'check');
    } finally {
      setBtnBusy(submitBtn, false);
    }
  });

  $('#forgot-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#forgot-email').value.trim();
    const error = $('#forgot-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      error.textContent = 'أدخل بريدًا إلكترونيًا صحيحًا.';
      error.hidden = false;
      return;
    }

    error.hidden = true;
    setBtnBusy(submitBtn, true, 'جارٍ الإرسال…');
    try {
      const result = await cloudRequest('requestPasswordReset', { email });
      if (!result || result.success !== true) {
        error.textContent = cleanServerError(result, 'تعذر إرسال رمز الاستعادة.');
        error.hidden = false;
        return;
      }
      pendingResetEmail = email;
      $('#reset-code').value = '';
      $('#reset-password').value = '';
      showGateView('reset');
      toast('إن كان البريد مسجلًا فسيصلك رمز الاستعادة', 'send');
    } finally {
      setBtnBusy(submitBtn, false);
    }
  });

  $('#reset-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = $('#reset-code').value.trim();
    const password = $('#reset-password').value;
    const error = $('#reset-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    if (!pendingResetEmail) { showGateView('forgot'); return; }
    if (!/^\d{6}$/.test(code)) {
      error.textContent = 'رمز التحقق ستة أرقام.';
      error.hidden = false;
      return;
    }
    if (password.length < 8) {
      error.textContent = 'الرمز السري يجب أن يكون ٨ أحرف أو أكثر.';
      error.hidden = false;
      return;
    }

    error.hidden = true;
    setBtnBusy(submitBtn, true, 'جارٍ التعيين…');
    try {
      const result = await cloudRequest('resetPassword', {
        email: pendingResetEmail,
        code,
        password
      });
      if (!result || result.success !== true) {
        error.textContent = cleanServerError(result, 'تعذر تعيين الرمز، تحقق من رمز التحقق.');
        error.hidden = false;
        return;
      }
      const email = pendingResetEmail;
      pendingResetEmail = '';
      showGateView('login');
      $('#login-email').value = email;
      $('#login-password').value = '';
      toast('تم تعيين الرمز الجديد، ادخل بحسابك', 'check');
    } finally {
      setBtnBusy(submitBtn, false);
    }
  });

  const goRegister = document.getElementById('go-register');
  if (goRegister) goRegister.addEventListener('click', () => { $('#register-error').hidden = true; showGateView('register'); });
  const registerBack = document.getElementById('register-back');
  if (registerBack) registerBack.addEventListener('click', () => showGateView('login'));

  const gateHome = document.getElementById('gate-home');
  if (gateHome) gateHome.addEventListener('click', showPublicHome);
  const pendingHome = document.getElementById('pending-home');
  if (pendingHome) pendingHome.addEventListener('click', showPublicHome);

  const verifyBack = document.getElementById('verify-back');
  if (verifyBack) verifyBack.addEventListener('click', () => showGateView('register'));

  const verifyResend = document.getElementById('verify-resend');
  if (verifyResend) {
    verifyResend.addEventListener('click', async () => {
      const error = $('#verify-error');
      if (!pendingRegister) { showGateView('register'); return; }
      error.hidden = true;
      setBtnBusy(verifyResend, true, 'جارٍ الإرسال…');
      try {
        const result = await cloudRequest('requestRegistrationCode', {
          name: pendingRegister.name,
          phone: pendingRegister.phone,
          email: pendingRegister.email,
          password: pendingRegister.password
        });
        if (!result || result.success !== true) {
          error.textContent = cleanServerError(result, 'تعذر إعادة الإرسال، حاول بعد قليل.');
          error.hidden = false;
          return;
        }
        $('#verify-code').value = '';
        $('#verify-code').focus();
        toast('أعدنا إرسال الرمز إلى بريدك', 'send');
      } finally {
        setBtnBusy(verifyResend, false);
      }
    });
  }
  const goForgot = document.getElementById('go-forgot');
  if (goForgot) goForgot.addEventListener('click', () => {
    const typed = $('#login-email').value.trim();
    $('#forgot-email').value = typed.includes('@') ? typed : '';
    showGateView('forgot');
  });
  const forgotBack = document.getElementById('forgot-back');
  if (forgotBack) forgotBack.addEventListener('click', () => showGateView('login'));
  const resetBack = document.getElementById('reset-back');
  if (resetBack) resetBack.addEventListener('click', () => showGateView('login'));

  const logForm = $('#log-form');
  if (logForm) logForm.addEventListener('submit', handleLogSubmit);

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
    const isGuest = !currentMember || currentMember.id === 'guest';
    if (isGuest) { showGate(); toast('سجّل دخولك بالبريد والرمز للتعديل', 'user'); return; }
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

  const photoButton = document.getElementById('profile-photo-change');
  const photoInput = document.getElementById('profile-photo-input');
  if (photoButton && photoInput) {
    photoButton.addEventListener('click', () => {
      if (isGuest()) { showGate(); toast('سجّل دخولك لتغيير صورتك', 'user'); return; }
      photoInput.click();
    });
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      if (!file.type || !file.type.startsWith('image/')) {
        toast('اختر ملف صورة صالحًا', 'info');
        photoInput.value = '';
        return;
      }
      if (isGuest() || !currentMember) {
        showGate();
        photoInput.value = '';
        return;
      }
      setBtnBusy(photoButton, true, 'جارٍ الحفظ…');
      try {
        const photo = await compressMeetingImage(file);
        const result = await cloudRequest('setMemberPhoto', { memberId: currentMember.id, photo });
        if (!result || result.success !== true) {
          toast(cleanServerError(result, 'تعذر حفظ الصورة الشخصية'), 'info');
          return;
        }
        currentMember.photo = photo;
        state.profile.photo = photo;
        const cached = approvedMembersCache.find((m) => normalizeName(m.name) === normalizeName(currentMember.name));
        if (cached) cached.photo = photo;
        const account = readAccount();
        if (account && String(account.id) === String(currentMember.id)) {
          persistAccount({ ...account, photo });
        }
        await saveState();
        renderProfile();
        updateHeaderAvatar();
        toast('تم تحديث صورتك الشخصية', 'check');
      } catch (error) {
        toast(error.message || 'تعذر قراءة الصورة المحددة', 'info');
      } finally {
        setBtnBusy(photoButton, false);
        photoInput.value = '';
      }
    });
  }

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
    const account = readAccount();
    if (account) member = accountToMember(account);
  }

  renderLogStamp();
  setInterval(renderLogStamp, 30000);

  if (member) {
    await setSessionMember(member);
    enterApp(false);
    const requested = params.get('screen');
    if (params.get('article')) await openSharedArticlePage(params.get('article'));
    else if (requested) go(requested);
  } else {
    /* وضع زائر: تصفح عام بدون تسجيل */
    currentMember = { id: 'guest', name: 'زائر', role: 'زائر', lastWeek: 0, color: '#1E3A2B' };
    const base = createInitialState(null);
    state = {
      ...base,
      memberId: 'guest',
      profile: { ...base.profile, name: 'زائر', role: 'زائر' },
      quotes: getLocalSharedQuotes(),
      articles: ARTICLE_SEED.map((a) => ({ ...a })),
      seenQuotes: getLocalSharedQuotes().length,
      seenArticles: ARTICLE_SEED.length,
      seenClubBooks: 0
    };
    enterApp(false);
    const requested = params.get('screen');
    if (params.get('article')) await openSharedArticlePage(params.get('article'));
    else if (requested) go(requested);
  }
  setTimeout(hideSplash, 4000);
}

init();

/* @@ */
