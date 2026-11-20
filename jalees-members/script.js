/**
 * ============================================================================
 * جليس | مجلس الأعضاء — المنطق المشترك للمشروع المساند
 * الصفحة الرئيسية: شبكة أعضاء أنيقة مع بحث فوري وأرقام مقاعد ثابتة.
 * صفحة العضو: اقتباساته ومقالاته وملخصاته.
 * ============================================================================
 */
'use strict';

const MEMBERS = window.JALEES_MEMBERS || [];
/* أعداد المحتوى تُحمّل من ملف خفيف واحد، والسجلات نفسها من ملف لكل عضو. */
let CONTENT_INDEX = null;
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toAr = (value) => String(value).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
const AVATAR_COLORS = [
  '#1E3A2B',
  '#2A4F3B',
  '#8C532D',
  '#A3503B',
  '#B1834A',
  '#3B6A51',
];

function initials(name) {
  const n = String(name || '').trim();
  return n.charAt(0) || 'ج';
}

function contentCount(member) {
  const counts = CONTENT_INDEX && CONTENT_INDEX[member.id];
  if (counts) {
    return (counts.quotes || 0) + (counts.articles || 0) + (counts.summaries || 0);
  }
  return (
    (member.quotes ? member.quotes.length : 0) +
    (member.articles ? member.articles.length : 0) +
    (member.summaries ? member.summaries.length : 0)
  );
}

function getMember(id) {
  return MEMBERS.find((m) => String(m.id) === String(id)) || null;
}

/* ==========================================================================
   الصفحة الرئيسية: شبكة الأعضاء والبحث
   ========================================================================== */
async function renderDirectory() {
  const grid = $('#members-grid');
  if (!grid) return;

  await loadContentIndex();

  // رقم مقعد ثابت لكل عضو (١..٧٠)
  MEMBERS.forEach((m, i) => {
    m._seat = i + 1;
  });

  const countEl = $('#member-count');
  const search = $('#member-search');
  const empty = $('#empty-state');

  if (countEl) countEl.textContent = toAr(MEMBERS.length);

  function apply() {
    const term = search ? search.value.trim() : '';
    const needle = normalizeName(term);

    const list = MEMBERS.filter((m) => !needle || normalizeName(m.name).includes(needle));

    render(list);
  }

  function render(list) {
    grid.innerHTML = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      grid.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    grid.hidden = false;

    const frag = document.createDocumentFragment();
    list.forEach((member) => {
      const color = member.avatar || AVATAR_COLORS[(member._seat - 1) % AVATAR_COLORS.length];
      const total = contentCount(member);

      const card = document.createElement('a');
      card.className = 'member-card';
      card.href = `member.html?id=${encodeURIComponent(member.id)}`;
      card.setAttribute('aria-label', `فتح مجلس ${member.name}`);
      card.style.setProperty('--card-accent', color);
      card.innerHTML = `
        <div class="card-top">
          <span class="card-seat">${toAr(member._seat)}</span>
          <span class="card-role">${esc(member.role)}</span>
        </div>
        <div class="card-main">
          <span class="card-rule" aria-hidden="true"></span>
          <h3 class="card-name">${esc(member.name)}</h3>
        </div>
        <div class="card-bottom">
          <div class="card-stats">${toAr(total)} محتوى</div>
          <span class="card-enter">تصفّح<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M10 6l6 6-6 6"/></svg></span>
        </div>
      `;
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  if (search) {
    search.addEventListener('input', apply);
  }

  render(MEMBERS);
}

/* ==========================================================================
   صفحة العضو
   ========================================================================== */
async function renderMemberDetail() {
  const params = new URLSearchParams(location.search);
  const member = getMember(params.get('id'));

  if (!member) {
    const root = $('#member-root');
    if (root) {
      root.innerHTML = `
        <div class="empty-state" style="max-width:660px">
          <div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3 3-3M5 19h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg></div>
          <h3>العضو غير موجود</h3>
          <p>لم نعثر على هذا العضو. <a href="index.html">عد إلى مجلس الأعضاء</a>.</p>
        </div>`;
    }
    return;
  }

  document.title = `${member.name} | مجلس جليس`;

  $$('.member-name-fill').forEach((el) => {
    el.textContent = member.name;
  });
  $$('.member-avatar-fill').forEach((el) => {
    el.textContent = initials(member.name);
    el.style.background = member.avatar || AVATAR_COLORS[0];
  });
  $$('.member-role-fill').forEach((el) => {
    el.textContent = member.role;
  });
  $$('.member-since-fill').forEach((el) => {
    el.textContent = member.since;
  });

  // ملف المحتوى هو المصدر الأساسي؛ والنسخة المضمّنة في members.js تعمل كاحتياطي.
  const saved = await loadMemberContent(member.id);
  const content = saved || member;

  renderSection('quotes', content.quotes || [], renderQuoteCard);
  renderSection('articles', content.articles || [], renderArticleCard);
  renderSection('summaries', content.summaries || [], renderSummaryCard);
}

function renderSection(key, items, renderer) {
  const container = $(`#${key}-list`);
  const sec = $(`#sec-${key}`);
  if (!container) return;

  const head = $(`#${key}-head`);
  if (head) {
    const countEl = head.querySelector('.count');
    if (countEl) countEl.textContent = toAr(items.length);
  }

  const emptyCopy = {
    quotes: 'لا توجد اقتباسات مضافة حالياً.',
    articles: 'لا توجد مقالات مضافة حالياً.',
    summaries: 'لا توجد ملخصات مضافة حالياً.',
  };
  container.hidden = false;
  if (sec) sec.hidden = false;
  container.innerHTML = items.length
    ? items.map(renderer).join('')
    : `<div class="section-empty"><span aria-hidden="true"></span><p>${emptyCopy[key]}</p></div>`;
}

function renderQuoteCard(q) {
  return `
    <article class="quote-card">
      <span class="quote-mark">”</span>
      <div class="quote-text">${esc(q.text)}</div>
      <div class="quote-source">
        <strong>${esc(q.book || 'بدون مصدر')}</strong>
        ${q.date ? `<span>· ${esc(q.date)}</span>` : ''}
      </div>
    </article>
  `;
}

function renderArticleCard(a) {
  return `
    <article class="article-card">
      <div class="article-number">#</div>
      <div class="article-body">
        <h4 class="article-title">${esc(a.title)}</h4>
        <p class="article-excerpt">${esc(a.excerpt || '')}</p>
        <div class="article-meta">
          <span>${esc(a.date || '')}</span>
        </div>
        <a class="read-more" href="${esc(a.link || '#')}" target="_blank" rel="noopener">
          اقرأ المزيد<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M10 6l6 6-6 6"/></svg>
        </a>
      </div>
    </article>
  `;
}

function renderSummaryCard(s) {
  return `
    <article class="summary-card">
      <div class="summary-title">${esc(s.book || 'ملخص')}</div>
      ${s.author ? `<div class="summary-author">${esc(s.author)}</div>` : ''}
      <p class="summary-text">${esc(s.text || '')}</p>
      ${s.date ? `<div class="summary-date">${esc(s.date)}</div>` : ''}
    </article>
  `;
}

/* ==========================================================================
   تحميل بيانات المحتوى (ملف خفيف للفهرس + ملف لكل عضو عند الطلب)
   ========================================================================== */
async function loadContentIndex() {
  try {
    const res = await fetch('data/content/index.json', { cache: 'no-store' });
    if (!res.ok) return;
    CONTENT_INDEX = await res.json();
  } catch (_) {
    CONTENT_INDEX = null; // على file:// تُستخدم النسخة المضمّنة
  }
}

async function loadMemberContent(id) {
  try {
    const res = await fetch(`data/content/${encodeURIComponent(id)}.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

/* ==========================================================================
   أدوات مساعدة
   ========================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function normalizeName(value) {
  return String(value || '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ==========================================================================
   التهيئة
   ========================================================================== */
function init() {
  if ($('#members-grid')) {
    renderDirectory();
  } else if ($('#member-root')) {
    renderMemberDetail();
  }
}

/* تسجيل عامل الخدمة المستقل للمشروع المساند، وعزله تماماً عن الموقع الأساسي.
   - عامل الخدمة الوحيد المسموح هنا هو عامل هذا المجلد (/jalees-members/).
   - يُلغى أي عامل خدمة آخر على نفس النطاق (مثل عامل الموقع الأساسي) حتى لا
     يعترض التنقّل أو يعيد عرض صفحة الموقع الأساسي عند انقطاع الشبكة.
   - تُحذف كاشات الموقع الأساسي حتى لا تُمسح كاشات هذا المشروع عند زيارته. */
async function isolateFromOriginalSite() {
  if (!('serviceWorker' in navigator)) return;

  const ownScope = new URL('./', location.href).pathname;
  const ownScript = new URL('./sw.js', location.href).href;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations
      .filter((reg) => {
        const scope = new URL(reg.scope).pathname;
        const active = reg.active || reg.installing || reg.waiting;
        const script = active ? active.scriptURL : '';
        return scope.indexOf(ownScope) !== 0 || (script && script !== ownScript);
      })
      .map((reg) => reg.unregister().catch(() => {})));
  } catch (_) { /* تجاهل أي قيد يمنع الإلغاء */ }

  try {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.indexOf('jalees-') === 0 && key.indexOf('jalees-members') !== 0)
      .map((key) => caches.delete(key).catch(() => {})));
  } catch (_) { /* تجاهل أي قيد يمنع الحذف */ }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return; // عوامل الخدمة لا تعمل على file://
  window.addEventListener('load', async () => {
    await isolateFromOriginalSite();
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    registerServiceWorker();
  });
} else {
  init();
  registerServiceWorker();
}
