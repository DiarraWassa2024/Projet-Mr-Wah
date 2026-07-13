const auth = (() => {
  function isLoggedIn() { return !!localStorage.getItem('gpo_token'); }
  function getUser()    { return JSON.parse(localStorage.getItem('gpo_user') || 'null'); }

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('gpo_token', data.token);
    localStorage.setItem('gpo_user', JSON.stringify(data.user));
    return data.user;
  }

  function logout() {
    localStorage.removeItem('gpo_token');
    localStorage.removeItem('gpo_user');
    document.body.innerHTML = '<div id="app"></div>';
    document.body.className = '';
    router.navigate('landing');
  }

  return { isLoggedIn, getUser, login, logout };
})();
