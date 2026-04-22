(function () {
  const ua = window.navigator.userAgent || '';
  const isSafariDesktopOrTablet = /Safari/i.test(ua) && !/(Chrome|CriOS|Chromium|Edg|OPR|Firefox|FxiOS|SamsungBrowser)/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  if (isSafariDesktopOrTablet) {
    document.documentElement.classList.add('is-safari');
  }
  if (isSafariDesktopOrTablet && isIOS) {
    document.documentElement.classList.add('is-ios-safari');
  }

  const primaryLinks = [
    { href: '/', label: 'الرئيسية' },
    { href: '/games/', label: 'الألعاب' },
    { href: '/how-to-play/', label: 'كيف تلعب؟' },
    { href: '/categories/', label: 'الفئات' },
    { href: '/faq/', label: 'الأسئلة الشائعة' },
    { href: '/about/', label: 'من نحن' }
  ];

  const supportLinks = [
    { href: '/contact/', label: 'تواصل معنا' },
    { href: '/privacy/', label: 'الخصوصية' },
    { href: '/terms/', label: 'الشروط' }
  ];

  const normalizePath = (value) => {
    if (!value) return '/';
    const withoutQuery = value.split('?')[0].split('#')[0];
    if (withoutQuery === '/') return '/';
    return withoutQuery.endsWith('/') ? withoutQuery : `${withoutQuery}/`;
  };

  const currentPath = normalizePath(window.location.pathname);
  const activeSupportLink = supportLinks.find((link) => normalizePath(link.href) === currentPath) || null;
  const makeLink = (link) => {
    const isActive = normalizePath(link.href) === currentPath;
    return `<a class="site-header__link" href="${link.href}"${isActive ? ' aria-current="page"' : ''}>${link.label}</a>`;
  };

  const header = document.createElement('header');
  header.className = 'site-header';
  header.setAttribute('aria-label', 'التنقل العام');

  header.innerHTML = `
    <div class="site-header__inner">
      <a class="site-header__brand" href="/" aria-label="الانتقال إلى الصفحة الرئيسية">
        <span class="site-header__logo site-header__logo--glyph" aria-hidden="true">ت</span>
        <img
          class="site-header__logo site-header__logo--brand-image"
          src="/assets/tasleya logo ready.webp"
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
        <span class="site-header__brand-text">تسلية</span>
      </a>
      <div class="site-header__nav-shell">
        <nav class="site-header__nav" aria-label="روابط رئيسية">
          ${primaryLinks.map(makeLink).join('')}
        </nav>
      </div>
      <div class="site-header__utility">
        <button
          class="site-header__support-toggle${activeSupportLink ? ' is-active' : ''}"
          type="button"
          aria-expanded="false"
          aria-controls="siteHeaderSupportMenu"
        >
          ${activeSupportLink ? activeSupportLink.label : 'روابط مهمة'}
        </button>
        <div id="siteHeaderSupportMenu" class="site-header__support-menu" role="menu" aria-label="روابط الدعم والمعلومات">
          ${supportLinks.map((link) => {
            const isActive = normalizePath(link.href) === currentPath;
            return `<a class="site-header__support-link" role="menuitem" href="${link.href}"${isActive ? ' aria-current="page"' : ''}>${link.label}</a>`;
          }).join('')}
        </div>
      </div>
      <div class="site-header__cta-shell">
        <a class="site-header__cta" href="/">ابدأ اللعب الآن</a>
      </div>
      <button class="site-header__toggle" type="button" aria-expanded="false" aria-controls="siteHeaderPanel">القائمة</button>
    </div>
    <nav id="siteHeaderPanel" class="site-header__panel" aria-label="قائمة التنقل على الجوال">
      <div class="site-header__panel-links">
        ${primaryLinks.map(makeLink).join('')}
        ${supportLinks.map(makeLink).join('')}
        <a class="site-header__cta" href="/">ابدأ اللعب الآن</a>
      </div>
    </nav>
  `;

  const host = document.querySelector('#startScreen') || document.body;
  host.prepend(header);

  const toggleButton = header.querySelector('.site-header__toggle');
  const supportToggle = header.querySelector('.site-header__support-toggle');
  const closeSupportMenu = () => {
    header.classList.remove('site-header--support-open');
    if (supportToggle) {
      supportToggle.setAttribute('aria-expanded', 'false');
    }
  };

  if (supportToggle) {
    supportToggle.addEventListener('click', () => {
      const shouldOpen = !header.classList.contains('site-header--support-open');
      header.classList.toggle('site-header--support-open', shouldOpen);
      supportToggle.setAttribute('aria-expanded', String(shouldOpen));
    });

    document.addEventListener('click', (event) => {
      if (!header.contains(event.target)) {
        closeSupportMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeSupportMenu();
      }
    });
  }

  if (!toggleButton) return;

  toggleButton.addEventListener('click', () => {
    const isOpen = header.classList.toggle('site-header--open');
    toggleButton.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      closeSupportMenu();
    }
  });
})();
