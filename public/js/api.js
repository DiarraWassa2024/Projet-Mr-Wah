const api = (() => {
  const BASE = '/api';

  function token() { return localStorage.getItem('gpo_token'); }

  async function req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const hadToken = !!token();
    if (hadToken) headers['Authorization'] = 'Bearer ' + token();
    const opts = { method, headers, signal: AbortSignal.timeout(15000) };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    // Un 401 ne signifie "session expirée" que s'il y avait un token envoyé — sinon (ex: un
    // essai de connexion avec de mauvais identifiants) ce n'est qu'une erreur normale à afficher,
    // pas une déconnexion/redirection vers l'accueil.
    if (res.status === 401 && hadToken) {
      auth.logout();
      throw new Error('Session expirée — veuillez vous reconnecter');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
    return data;
  }

  return {
    get:    (path)        => req('GET',    path),
    post:   (path, body)  => req('POST',   path, body),
    put:    (path, body)  => req('PUT',    path, body),
    delete: (path)        => req('DELETE', path),
  };
})();
