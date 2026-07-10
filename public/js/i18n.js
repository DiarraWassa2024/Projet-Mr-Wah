const i18n = (() => {
  let locale = localStorage.getItem('gpo_lang') || 'fr';
  let translations = {};

  async function load(lang) {
    locale = lang;
    localStorage.setItem('gpo_lang', lang);
    const res = await fetch(`/locales/${lang}.json`);
    translations = await res.json();
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (translations[key]) el.textContent = translations[key];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.dataset.i18nPh;
      if (translations[key]) el.placeholder = translations[key];
    });
  }

  function t(key) {
    return translations[key] || key;
  }

  function current() { return locale; }

  return { load, t, current };
})();
