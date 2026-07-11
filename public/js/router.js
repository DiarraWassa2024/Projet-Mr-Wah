const router = (() => {
  const routes = {};

  // Mapping route interne → URL publique propre (pages publiques uniquement ;
  // les routes privées gardent une URL = leur nom, ex. /organisations).
  const ROUTE_PATHS = {
    landing:               '/',
    adhesion:              '/adhesion',
    'expression-besoins':  '/besoins',
    don:                   '/don',
    login:                 '/connexion',
    'paiement-adhesion':   '/paiement',
  };

  function register(name, fn) { routes[name] = fn; }

  function buildUrl(name, params = {}) {
    const base = ROUTE_PATHS[name] || ('/' + name);
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const qsStr = qs.toString();
    return qsStr ? `${base}?${qsStr}` : base;
  }

  function routeNameFromPath(pathname) {
    const found = Object.entries(ROUTE_PATHS).find(([, p]) => p === pathname);
    if (found) return found[0];
    const stripped = pathname.replace(/^\/+/, '');
    return stripped || 'landing';
  }

  function navigate(name, params = {}, options = {}) {
    const publicRoutes = ['login','landing','adhesion','expression-besoins','don','paiement-adhesion','verification'];
    if (!auth.isLoggedIn() && !publicRoutes.includes(name)) {
      name = 'landing';
    }
    const fn = routes[name];
    if (fn) {
      const appEl = document.getElementById('app');
      if (appEl) appEl.innerHTML = '';
      fn(params);
      // Met à jour la nav active
      document.querySelectorAll('[data-route]').forEach(el => {
        el.classList.toggle('active', el.dataset.route === name);
      });
      window._currentRoute = name;

      if (!options.skipHistory) {
        const url = buildUrl(name, params);
        if (location.pathname + location.search !== url) {
          history.pushState({ route: name, params }, '', url);
        }
      }
    }
  }

  /** Lit l'URL courante (chemin + query) et route en conséquence — utilisé au chargement initial. */
  function resolveInitialRoute() {
    const name = routeNameFromPath(location.pathname);
    const params = Object.fromEntries(new URLSearchParams(location.search));
    navigate(name, params, { skipHistory: true });
  }

  window.addEventListener('popstate', e => {
    if (e.state && e.state.route) {
      navigate(e.state.route, e.state.params || {}, { skipHistory: true });
    } else {
      resolveInitialRoute();
    }
  });

  return { register, navigate, resolveInitialRoute };
})();
