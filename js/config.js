/**
 * Konfigurasi Terpusat Aplikasi Monitoring TKA Kelas VI SDN 2 Karangmangu
 */
(function (global) {
  'use strict';

  var STORAGE_KEY_URL = 'tka_gas_webapp_url';

  // Isi URL Web App Google Apps Script di bawah ini sebelum deploy ke GitHub Pages
  // Contoh: 'https://script.google.com/macros/s/AKfycb.../exec'
  var DEFAULT_WEB_APP_URL = '';

  function getWebAppUrl() {
    try {
      var saved = global.localStorage.getItem(STORAGE_KEY_URL);
      if (saved && saved.trim()) {
        return saved.trim();
      }
    } catch (e) {
      // Abaikan jika localStorage diblokir
    }
    return DEFAULT_WEB_APP_URL;
  }

  function setWebAppUrl(url) {
    var clean = String(url || '').trim();
    if (!clean) {
      global.localStorage.removeItem(STORAGE_KEY_URL);
      return '';
    }
    global.localStorage.setItem(STORAGE_KEY_URL, clean);
    return clean;
  }

  global.TKA_CONFIG = {
    APP_NAME: 'MONITORING TKA KELAS VI',
    SEKOLAH: 'SDN 2 KARANGMANGU',
    TAHUN_AJARAN: '2026/2027',
    DEFAULT_WEB_APP_URL: DEFAULT_WEB_APP_URL,
    getWebAppUrl: getWebAppUrl,
    setWebAppUrl: setWebAppUrl
  };
})(window);
