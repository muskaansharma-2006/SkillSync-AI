(() => {
  const pageName = window.location.pathname.split('/').pop() || 'index.html';
  if (pageName === 'auth.html' || pageName === 'home.html') {
    return;
  }

  const getSanitizedToken = () => {
    const t = localStorage.getItem("skillsync_token");
    if (!t || t === "null" || t === "undefined" || t.trim() === "") return null;
    return t;
  };

  const getBaseUrl = () => {
    if (typeof getApiBaseUrl === 'function') return getApiBaseUrl();
    if (typeof API_BASE_URL !== 'undefined') return API_BASE_URL;
    if (window.API_BASE_URL) return window.API_BASE_URL;
    return window.location.origin;
  };

  const clearSessionAndRedirect = () => {
    localStorage.removeItem("skillsync_token");
    localStorage.removeItem("skillsync_user");
    const returnParam = (pageName && pageName !== 'index.html') 
      ? `?returnTo=${encodeURIComponent(pageName + window.location.search)}` 
      : '';
    window.location.replace(`auth.html${returnParam}`);
  };

  const token = getSanitizedToken();
  if (!token) {
    clearSessionAndRedirect();
    return;
  }

  const baseUrl = getBaseUrl().replace(/\/$/, '');
  const headers = { "Authorization": `Bearer ${token}` };

  fetch(`${baseUrl}/api/auth/me`, { credentials: "include", headers })
    .then(async response => {
      if (!response.ok) throw new Error("Unauthenticated");
      const result = await response.json();
      if (result.data && result.data.id) {
        window.SkillSyncAuth = result.data;
        localStorage.setItem("skillsync_user", JSON.stringify(result.data));
      } else {
        throw new Error("Invalid user session");
      }
    })
    .catch(() => {
      clearSessionAndRedirect();
    });
})();


