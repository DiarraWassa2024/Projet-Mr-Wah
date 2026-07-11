const router = (() => {
  const routes = {};

  function register(name, fn) { routes[name] = fn; }

  function navigate(name, params = {}) {
    const publicRoutes = ['login','landing','adhesion','expression-besoins','don'];
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
    }
  }

  return { register, navigate };
})();
