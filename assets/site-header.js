(function () {
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
      <nav class="site-header__nav" aria-label="روابط رئيسية">
        ${primaryLinks.map(makeLink).join('')}
      </nav>
      <a class="site-header__cta" href="/">ابدأ اللعب الآن</a>
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
  if (!toggleButton) return;

  toggleButton.addEventListener('click', () => {
    const isOpen = header.classList.toggle('site-header--open');
    toggleButton.setAttribute('aria-expanded', String(isOpen));
  });
})();
