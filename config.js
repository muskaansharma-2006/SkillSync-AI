// config.js - Centralized API Configuration for SkillSync
function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    if (window.ENV_API_BASE_URL) return window.ENV_API_BASE_URL.replace(/\/$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:${window.location.port || 3000}`;
    }
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}

if (typeof window !== 'undefined') {
  window.API_BASE_URL = window.API_BASE_URL || getApiBaseUrl();
  window.getApiBaseUrl = getApiBaseUrl;
}
