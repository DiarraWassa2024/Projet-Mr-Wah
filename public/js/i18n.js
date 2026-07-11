const i18n = (() => {
  let locale = localStorage.getItem('gpo_lang') || 'fr';
  let translations = {};
  let fallback = {};

  function langMeta(code) {
    return (typeof I18N_LANGUAGES !== 'undefined' ? I18N_LANGUAGES : []).find(l => l.code === code);
  }

  async function load(lang) {
    const meta = langMeta(lang) || { code: 'fr', rtl: false };
    locale = meta.code;
    localStorage.setItem('gpo_lang', locale);

    const res = await fetch(`/locales/${locale}.json`);
    translations = await res.json();

    // Repli vers le français pour les clés pas encore traduites dans cette langue
    if (locale !== 'fr') {
      try {
        const fbRes = await fetch('/locales/fr.json');
        fallback = await fbRes.json();
      } catch (_) { fallback = {}; }
    } else {
      fallback = {};
    }

    document.documentElement.lang = locale;
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = translations[key] || fallback[key];
      if (val) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.dataset.i18nPh;
      const val = translations[key] || fallback[key];
      if (val) el.placeholder = val;
    });
  }

  function t(key) {
    return translations[key] || fallback[key] || key;
  }

  function current() { return locale; }

  /** Liste des langues disponibles (voir i18n-config.js), pour générer des sélecteurs génériques. */
  function available() {
    return typeof I18N_LANGUAGES !== 'undefined' ? I18N_LANGUAGES : [{ code: 'fr', label: 'Français', flag: '🇫🇷', rtl: false }];
  }

  return { load, t, current, available };
})();
