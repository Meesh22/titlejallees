/**
 * ==========================================================================
 * مشروع نادي جليس القرائي - منطقة القصيم
 * ملف الجافاسكريبت الرئيسي (Pure JavaScript - ES6+)
 * ==========================================================================
 */

// إعداد وضع التوافق الصارم
'use strict';

/* ==========================================================================
   1. الإعدادات العامة ونقطة نهاية نموذج الانضمام (API Configuration)
   ========================================================================== */
/**
 * إذا كان لديك رابط خدمة حقيقية لاستقبال الطلبات (مثل Formspree أو Google Sheet Webhook)،
 * ضعه هنا بين علامتي التنصيص.
 * مثال: const FORM_ENDPOINT = "https://formspree.io/f/your_form_id";
 * 
 * إذا تركته فارغاً ("")، سيتعامل الموقع بصدق وشفافية تامة:
 * سيقوم بالتحقق الكامل من صحة البيانات، ثم يخبر الزائر بأن النموذج غير مربوط
 * بخدمة سحابية بعد ويوجهه فوراً للاستبيان الرسمي تجنباً لأي ادعاء شكلي.
 */
const FORM_ENDPOINT = "";

// رابط استبيان Google Forms الرسمي للنادي
const OFFICIAL_SURVEY_URL = "https://forms.gle/UZY6DnS9W2X5ft9w8";


/* ==========================================================================
   2. مصفوفات البيانات المنظمة (Data Stores)
   (يمكنك إضافة أو حذف أو تعديل العناصر هنا بسهولة تامة)
   ========================================================================== */

/**
 * مصفوفة اللقاءات المسجلة (Recorded Meetings)
 * مرتبة من الأحدث إلى الأقدم وفق قناة ولقاءات نادي جليس الرسمية
 */
const recordedMeetings = [
  {
    id: 1,
    title: "حلقة نقاش حول كتاب: رحلة الحاج من بلد الزبير بن العوام إلى البلد الحرام",
    description: "قراءة نقدية وتوثيقية في كتاب رحلة الحاج لسعد بن أحمد الربيعة الصادر عن دارة الملك عبد العزيز، واستعراض مسارات وتفاصيل الحج تاريخياً واجتماعياً.",
    thumbnail: "assets/images/recording-hajj.jpg",
    guest: "أ.د. إبراهيم الدغيري",
    date: "قبل شهر واحد",
    duration: "جلسة حوارية",
    views: "252 مشاهدة",
    youtubeUrl: "https://www.youtube.com/watch?v=kaI7pPyPxig"
  },
  {
    id: 2,
    title: "الوزير الغرناطي لسان الدين بن الخطيب",
    description: "جلسة ثقافية متعمقة تسلط الضوء على سيرة الأديب والوزير الأندلسي لسان الدين بن الخطيب، واستعراض مؤلفاته ونتاجه الفكري والسياسي في غرناطة.",
    thumbnail: "assets/images/recording-gharnati.jpg",
    guest: "أ. محمد الرشيد",
    date: "قبل شهرين",
    duration: "1:33:55",
    views: "414 مشاهدة",
    youtubeUrl: "https://www.youtube.com/watch?v=px3d83robSs"
  },
  {
    id: 3,
    title: "القراءة في بناء الطفل",
    description: "حوار نوعي حول استراتيجيات غرس حب القراءة لدى النشء، ودور الكتاب والأسرة في تنمية الخيال واللغة وبناء شخصية الطفل المعرفية.",
    thumbnail: "assets/images/recording-child.jpg",
    guest: "د. عبد العزيز المقيل",
    date: "قبل 3 أشهر",
    duration: "54:11",
    views: "116 مشاهدة",
    youtubeUrl: "https://www.youtube.com/watch?v=ZbynouDU0fU"
  }
];

/**
 * مصفوفة اللقاءات القادمة (Upcoming Meetings)
 */
const upcomingMeetings = [
  {
    id: 101,
    title: "مناقشة كتاب: ابني حبيبي",
    description: "اللقاء الأسبوعي لنادي جليس لمناقشة كتاب «ابني حبيبي: قواعد نبوية لتربية الأبناء»، بحضوركم يثري اللقاء ويسعدنا.",
    cover: "assets/images/upcoming-ibni-habibi.png",
    guestLabel: "يدير النقاش",
    guest: "عبدالله بن إبراهيم الشبرمي (عضو النادي)",
    date: "الثلاثاء ١٤٤٨/٥/١٦",
    time: "من ٨:٠٠ م إلى ٩:٠٠ م",
    location: "جمعية التنمية الأهلية بالمريداسية",
    status: "التسجيل مفتوح",
    actionUrl: OFFICIAL_SURVEY_URL,
    actionText: "حجز مقعد عبر الاستبيان"
  }
];

/* ==========================================================================
   3. دوال بناء وعرض المحتوى الديناميكي (Rendering Functions)
   ========================================================================== */

/**
 * عرض اللقاءات المسجلة
 */
function renderRecordedMeetings() {
  const container = document.getElementById('recorded-meetings-grid');
  const emptyState = document.getElementById('recorded-meetings-empty');
  
  if (!container) return;

  if (!recordedMeetings || recordedMeetings.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = recordedMeetings.map(meeting => {
    const hasVideo = Boolean(meeting.youtubeUrl && meeting.youtubeUrl.trim() !== "");
    return `
      <article class="recorded-card reveal-on-scroll" data-meeting-id="${meeting.id}">
        
        <div class="recorded-thumbnail-wrapper" onclick="handleMeetingClick(${meeting.id})" role="button" tabindex="0" aria-label="مشاهدة لقاء: ${escapeHtml(meeting.title)}">
          <img src="${escapeHtml(meeting.thumbnail)}" alt="غلاف لقاء ${escapeHtml(meeting.title)}" class="recorded-thumbnail" loading="lazy">
          <div class="play-overlay-btn">
            <div class="play-icon-circle" title="${hasVideo ? 'تشغيل الفيديو' : 'التسجيل غير متاح'}">
              <div class="play-icon-triangle"></div>
            </div>
          </div>
          ${meeting.duration ? `<span class="video-duration-badge">${escapeHtml(meeting.duration)}</span>` : ''}
        </div>

        <div class="recorded-content">
          <div>
            <div class="recorded-meta">
              <span class="meta-pill">📅 ${escapeHtml(meeting.date || 'تاريخ اللقاء')}</span>
              <span class="meta-guest">🎙️ ${escapeHtml(meeting.guest || 'ضيف جليس')}</span>
              ${meeting.views ? `<span class="meta-views">👁️ ${escapeHtml(meeting.views)}</span>` : ''}
            </div>
            </div>
            
            <h3 class="recorded-title">${escapeHtml(meeting.title)}</h3>
            <p class="recorded-desc">${escapeHtml(meeting.description)}</p>
          </div>

          <div class="recorded-footer">
            <button type="button" class="btn ${hasVideo ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="handleMeetingClick(${meeting.id})">
              ${hasVideo ? '▶ شاهد اللقاء' : 'ℹ️ حالة التسجيل'}
            </button>
          </div>
        </div>

      </article>
    `;
  }).join('');
}

/**
 * عرض اللقاءات القادمة
 */
function renderUpcomingMeetings() {
  const container = document.getElementById('upcoming-meetings-grid');
  const emptyState = document.getElementById('upcoming-meetings-empty');

  if (!container) return;

  if (!upcomingMeetings || upcomingMeetings.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = upcomingMeetings.map(meeting => {
    return `
      <article class="upcoming-card reveal-on-scroll">
        <div class="upcoming-cover-wrapper">
          <img src="${escapeHtml(meeting.cover)}" alt="غلاف فعالية ${escapeHtml(meeting.title)}" class="upcoming-cover" loading="lazy">
          <span class="status-badge ${meeting.status === 'التسجيل مفتوح' ? 'open' : ''}">
            ${escapeHtml(meeting.status || 'قريباً')}
          </span>
        </div>

        <div class="upcoming-body">
          <h3 class="upcoming-title">${escapeHtml(meeting.title)}</h3>
          <p class="upcoming-desc">${escapeHtml(meeting.description)}</p>

          <div class="upcoming-meta-list">
            <div class="meta-row">
              <span class="meta-row-icon">🎙️</span>
              <span><strong>${escapeHtml(meeting.guestLabel || 'الضيف')}:</strong> ${escapeHtml(meeting.guest || 'سيتم الإعلان عنه')}</span>
            </div>
            <div class="meta-row">
              <span class="meta-row-icon">📅</span>
              <span><strong>الموعد:</strong> ${escapeHtml(meeting.date)} - ${escapeHtml(meeting.time)}</span>
            </div>
            <div class="meta-row">
              <span class="meta-row-icon">📍</span>
              <span><strong>المكان:</strong> ${escapeHtml(meeting.location)}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

/* ==========================================================================
   4. التعامل مع تشغيل الفيديو والنافذة المنبثقة (Video Modal)
   ========================================================================== */

/**
 * التعامل مع النقر على بطاقة اللقاء
 */
function handleMeetingClick(meetingId) {
  const meeting = recordedMeetings.find(m => m.id === meetingId);
  if (!meeting) return;

  if (!meeting.youtubeUrl || meeting.youtubeUrl.trim() === "") {
    // رسالة تنبيه واضحة بدلاً من فتح رابط ميت
    showToast("⚠️ تسجيل هذا اللقاء غير متاح حاليًا، نعمل على توثيقه ورفعه قريباً.");
    return;
  }

  openVideoModal(meeting);
}

/**
 * فتح النافذة المنبثقة وتشغيل الفيديو
 */
function openVideoModal(meeting) {
  const modal = document.getElementById('video-modal');
  const titleElem = document.getElementById('modal-video-title');
  const containerElem = document.getElementById('modal-video-container');
  const metaElem = document.getElementById('modal-video-meta');

  if (!modal || !containerElem) return;

  const videoId = extractYouTubeId(meeting.youtubeUrl);

  titleElem.textContent = meeting.title;

  if (videoId) {
    containerElem.innerHTML = `
      <iframe 
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" 
        title="${escapeHtml(meeting.title)}" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    `;
  } else {
    // إذا لم يكن رابط يوتيوب تقليدياً
    containerElem.innerHTML = `
      <div class="modal-notice-box">
        <div class="modal-notice-icon">🔗</div>
        <p>الرابط متوفر خارج منصة اليوتيوب:</p>
        <a href="${escapeHtml(meeting.youtubeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="margin-top:12px;">
          فتح اللقاء في نافذة خارجية ↗
        </a>
      </div>
    `;
  }

  metaElem.innerHTML = `
    <p><strong>الضيف:</strong> ${escapeHtml(meeting.guest || 'غير محدد')}</p>
    <p style="margin-top:6px; color:#57635C; font-size:14.5px;">${escapeHtml(meeting.description)}</p>
  `;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // قفل التمرير الخلفي
}

/**
 * إغلاق نافذة الفيديو
 */
function closeVideoModal() {
  const modal = document.getElementById('video-modal');
  const containerElem = document.getElementById('modal-video-container');

  if (!modal) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = ''; // استعادة التمرير

  // إيقاف تشغيل الفيديو بتفريغ الـ iframe
  if (containerElem) {
    containerElem.innerHTML = '';
  }
}

/**
 * استخراج معرف فيديو اليوتيوب
 */
function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}


/* ==========================================================================
   5. إدارة نموذج طلب الانضمام (Form Validation & Honest Submission)
   ========================================================================== */

/**
 * تهيئة التحقق من النموذج
 */
function setupJoinForm() {
  const form = document.getElementById('join-club-form');
  if (!form) return;

  const nameInput = document.getElementById('fullName');
  const phoneInput = document.getElementById('phoneNumber');
  const submitBtn = document.getElementById('submit-btn');
  const spinner = document.getElementById('btn-spinner');
  const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
  const statusAlert = document.getElementById('form-status-alert');

  // إزالة رسائل الخطأ عند البدء في الكتابة
  nameInput.addEventListener('input', () => clearFieldError('fullName'));
  phoneInput.addEventListener('input', () => clearFieldError('phoneNumber'));

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // 1. التحقق من الحقول
    const isNameValid = validateName(nameInput.value.trim());
    const isPhoneValid = validatePhone(phoneInput.value.trim());

    if (!isNameValid || !isPhoneValid) {
      return; // توقف لوجود أخطاء
    }

    const payload = {
      fullName: nameInput.value.trim(),
      phoneNumber: phoneInput.value.trim(),
      submittedAt: new Date().toISOString(),
      source: "موقع نادي جليس القرائي"
    };

    // 2. تفعيل حالة التحميل
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = "جاري المعالجة...";
    if (statusAlert) statusAlert.classList.add('hidden');

    try {
      // 3. التحقق مما إذا كان هناك عنوان API مهيأ
      if (!FORM_ENDPOINT || FORM_ENDPOINT.trim() === "") {
        // حالة الصدق والشفافية: النموذج سليم ولكنه غير مربوط بخادم
        await simulateDelay(600); // تأخير بسيط لمحاكاة الفحص

        if (statusAlert) {
          statusAlert.className = 'form-status-alert alert-info';
          statusAlert.innerHTML = `
            <strong>ملاحظة هامة وشفافة:</strong><br>
            بياناتك المدخلة صحيحة تماماً (الاسم: ${escapeHtml(payload.fullName)}، الهاتف: ${escapeHtml(payload.phoneNumber)}).<br>
            نظراً لأن الموقع مبني بـ (HTML/CSS/JS) ولا يرتبط حالياً بخدمة استقبال بيانات (API Endpoint)، 
            فإننا <strong>لا ندعي وصول طلبك شكلياً</strong>.<br>
            فضلاً تفضل بالتسجيل مباشرة عبر الاستبيان المعتمد لتأكيد انضمامك:<br>
            <a href="${OFFICIAL_SURVEY_URL}" target="_blank" rel="noopener noreferrer" class="btn btn-gold btn-block" style="margin-top:10px;">
              فتح استبيان الانضمام المعتمد ↗
            </a>
          `;
          statusAlert.classList.remove('hidden');
        }

        form.reset();
        return;
      }

      // إذا وُجد رابط API فعلي: إرسال الطلب فعلياً
      const response = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        if (statusAlert) {
          statusAlert.className = 'form-status-alert alert-success';
          statusAlert.innerHTML = `
            <strong>تم إرسال طلبك بنجاح!</strong><br>
            سعداء بانضمامك يا ${escapeHtml(payload.fullName)}. سيتواصل معك فريق نادي جليس قريباً عبر الواتساب.
          `;
          statusAlert.classList.remove('hidden');
        }
        form.reset();
      } else {
        throw new Error('فشل إرسال الطلب من الخادم.');
      }

    } catch (error) {
      if (statusAlert) {
        statusAlert.className = 'form-status-alert alert-error';
        statusAlert.innerHTML = `
          <strong>حدث خطأ أثناء الإرسال:</strong> تعذر الاتصال بالخدمة. 
          يرجى استخدام <a href="${OFFICIAL_SURVEY_URL}" target="_blank" style="text-decoration:underline;">استبيان الانضمام المباشر</a>.
        `;
        statusAlert.classList.remove('hidden');
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.classList.add('hidden');
      if (btnText) btnText.textContent = "إرسال طلب الانضمام";
    }
  });
}

/**
 * التحقق من صحة الاسم
 */
function validateName(name) {
  if (!name || name.length < 3) {
    showFieldError('fullName', 'يرجى إدخال اسمك الكامل (3 أحرف على الأقل).');
    return false;
  }
  // التحقق من أن الاسم يحتوي على أحرف
  const lettersRegex = /^[\u0600-\u06FFa-zA-Z\s]{3,60}$/;
  if (!lettersRegex.test(name)) {
    showFieldError('fullName', 'يرجى إدخال اسم صحيح بالحروف دون أرقام أو رموز خاصة.');
    return false;
  }
  return true;
}

/**
 * التحقق من صحة رقم الهاتف السعودي
 * يقبل الصيغ:
 * 05xxxxxxxx
 * +9665xxxxxxxx
 * 9665xxxxxxxx
 * 5xxxxxxxx
 */
function validatePhone(phone) {
  if (!phone) {
    showFieldError('phoneNumber', 'رقم الهاتف إلزامي للتواصل معك.');
    return false;
  }

  // تنظيف الرقم من المسافات أو الواصلات
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // التعبير النمطي لأرقام الجوال السعودية
  const saudiPhoneRegex = /^((\+?966)|0)?5[0-9]{8}$/;

  if (!saudiPhoneRegex.test(cleaned)) {
    showFieldError('phoneNumber', 'يرجى إدخال رقم جوال سعودي صالح (يبدأ بـ 05 أو 9665 ومكون من 10 أرقام).');
    return false;
  }

  return true;
}

function showFieldError(fieldId, message) {
  const group = document.getElementById(`group-${fieldId}`);
  const errorElem = document.getElementById(`error-${fieldId}`);
  if (group) group.classList.add('has-error');
  if (errorElem) errorElem.textContent = message;
}

function clearFieldError(fieldId) {
  const group = document.getElementById(`group-${fieldId}`);
  const errorElem = document.getElementById(`error-${fieldId}`);
  if (group) group.classList.remove('has-error');
  if (errorElem) errorElem.textContent = '';
}


/* ==========================================================================
   6. التنقل وقائمة الجوال والتمرير (Navigation & Scroll Effects)
   ========================================================================== */

function setupNavigation() {
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileBackdrop = document.getElementById('mobile-backdrop');
  const mobileCloseBtn = document.getElementById('mobile-close-btn');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');
  const backToTopBtn = document.getElementById('back-to-top');

  // فتح / إغلاق قائمة الجوال
  function toggleMobileMenu(open) {
    const isOpen = open !== undefined ? open : !mobileNav.classList.contains('open');
    mobileNav.classList.toggle('open', isOpen);
    mobileBackdrop.classList.toggle('open', isOpen);
    menuToggle.setAttribute('aria-expanded', isOpen.toString());
    mobileNav.setAttribute('aria-hidden', (!isOpen).toString());
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  if (menuToggle) menuToggle.addEventListener('click', () => toggleMobileMenu(true));
  if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', () => toggleMobileMenu(false));
  if (mobileBackdrop) mobileBackdrop.addEventListener('click', () => toggleMobileMenu(false));

  // إغلاق القائمة عند اختيار أي رابط
  mobileLinks.forEach(link => {
    link.addEventListener('click', () => toggleMobileMenu(false));
  });

  // إغلاق القائمة أو الفيديو بزر Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleMobileMenu(false);
      closeVideoModal();
    }
  });

  // تأثير شريط الترويسة وزر العودة للأعلى عند التمرير
  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;

    if (header) {
      if (currentScroll > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    if (backToTopBtn) {
      if (currentScroll > 400) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }
  }, { passive: true });

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // تمييز الرابط النشط في القائمة عند التمرير
  setupActiveSectionSpy();
}

/**
 * تمييز القسم الحالي في شريط التنقل
 */
function setupActiveSectionSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  if (!window.IntersectionObserver) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }, {
    threshold: 0.35
  });

  sections.forEach(section => observer.observe(section));
}

/**
 * حركة ظهور العناصر عند التمرير إليها (Scroll Reveal)
 */
function setupScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');

  if (!window.IntersectionObserver) {
    // البديل إذا كان المتصفح قديماً
    revealElements.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target); // تشغيل الحركة مرة واحدة فقط
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => observer.observe(el));
}


/* ==========================================================================
   7. أدوات مساعدة عامة (Helpers & Toast)
   ========================================================================== */

/**
 * عرض إشعار سريع للمستخدم (Toast)
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3800);
}

/**
 * حماية النصوص من هجمات XSS
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function simulateDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * تحديث سنة حقوق النشر تلقائياً
 */
function updateCopyrightYear() {
  const yearElem = document.getElementById('current-year');
  if (yearElem) {
    yearElem.textContent = new Date().getFullYear();
  }
}


/**
 * فتح وتوسيع بطاقة الشواهد الحية دون الذهاب لصفحة أخرى
 */
function toggleProofCard(key) {
  const card = document.getElementById(`proof-${key}`);
  if (!card) return;

  const wasActive = card.classList.contains('active');

  // إغلاق أي بطاقة أخرى مفتوحة ليبقى المظهر متناسقاً
  document.querySelectorAll('.proof-card').forEach(c => {
    c.classList.remove('active');
  });

  // إذا لم تكن مفتوحة مسبقاً، افتحها
  if (!wasActive) {
    card.classList.add('active');
  }
}

/**
 * بيانات ووظائف التوثيق الحي لبطاقات النادي (Photo Proofs)
 */
const aboutProofs = {
  reading: {
    title: "تعزيز ثقافة القراءة وتحديات الكتب",
    desc: "توثيق حي من جلسات ولقاءات نادي جليس لنقاش آليات القراءة وبناء شغف المعرفة لدى النشء والمجتمع، مع إنجاز قرائي نوعي تجاوز مليون صفحة وآلاف الكتب.",
    image: "assets/images/meeting-child-reading.png"
  },
  community: {
    title: "بناء مجتمع حيوي من قرّاء القصيم",
    desc: "صورة حية من طاولة حوار النادي ومجلس الأعضاء بحضور شعار جليس وراية الوطن، حيث يلتقي القرّاء لتبادل الرؤى ونقد الكتب في بيئة معرفية دافئة.",
    image: "assets/images/meeting-gharnati.png"
  },
  history: {
    title: "استضافات نوعية للمهتمين بالثقافة والتاريخ",
    desc: "لقاء معالم من مملكتنا (نجد نموذجاً) مع الأستاذ محمد بن عبدالله الشاوي، باحث وميداني ورحالة مهتم بالبحث والتوثيق للأماكن التراثية في المملكة.",
    image: "assets/images/guest-shawi.png"
  }
};

function setupAboutProofCards() {
  const cards = document.querySelectorAll('.proof-card');
  const modal = document.getElementById('photo-modal');
  const modalImg = document.getElementById('photo-modal-img');
  const modalTitle = document.getElementById('photo-modal-title');
  const modalDesc = document.getElementById('photo-modal-desc');
  const closeBtn = document.getElementById('photo-modal-close');
  const backdrop = document.getElementById('photo-modal-backdrop');

  if (!cards.length || !modal) return;

  function openPhotoModal(key) {
    const data = aboutProofs[key];
    if (!data) return;

    modalImg.src = data.image;
    modalImg.alt = data.title;
    modalTitle.textContent = data.title;
    modalDesc.textContent = data.desc;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closePhotoModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const key = card.getAttribute('data-proof');
      openPhotoModal(key);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const key = card.getAttribute('data-proof');
        openPhotoModal(key);
      }
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closePhotoModal);
  if (backdrop) backdrop.addEventListener('click', closePhotoModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closePhotoModal();
    }
  });
}

/* ==========================================================================
   8. إقلاع وتشغيل التطبيق عند اكتمال تحميل الصفحة (Initialization)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // 1. تحديث السنة الحالية
  updateCopyrightYear();

  // 2. بناء الأقسام التفاعلية من المصفوفات
  renderRecordedMeetings();
  renderUpcomingMeetings();

  // 3. تفعيل بطاقات التوثيق الحي لصور النادي
  setupAboutProofCards();

  // 4. تفعيل التنقل والقوائم
  setupNavigation();

  // 5. تفعيل حركات الظهور
  setupScrollReveal();

  // 6. تفعيل مستمعات نافذة الفيديو
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalBackdrop = document.getElementById('modal-backdrop');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeVideoModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeVideoModal);
});
