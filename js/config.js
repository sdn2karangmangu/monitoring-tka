/**
 * Konfigurasi Terpusat Aplikasi Monitoring TKA Kelas VI SDN 2 Karangmangu
 * File ini dibuat otomatis dengan URL Web App permanen untuk GitHub Pages.
 */
(function tkaConfigBootstrap(global) {
  'use strict';

  var STORAGE_KEY_URL = 'tka_gas_webapp_url';
  var WINDOW_NAME_PREFIX = 'TKA_CFG:';
  var COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 tahun

  // Isi URL Web App Google Apps Script di bawah ini agar permanen untuk seluruh pengguna & HP wali murid:
  // Contoh: 'https://script.google.com/macros/s/AKfycb.../exec'
  var DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx2YLcVkzLEWKRH9L_aQB66Q1R4kALhrPstk-Mn1NTEL1CqYi1doJxHI3MYuQwfoYyc/exec';

  function isValidWebAppUrl(url) {
    var clean = String(url || '').trim();
    return /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\//i.test(clean);
  }

  function readCookie(name) {
    try {
      var pairs = document.cookie ? document.cookie.split(';') : [];
      var target = name + '=';
      for (var i = 0; i < pairs.length; i++) {
        var part = pairs[i].trim();
        if (part.indexOf(target) === 0) {
          return decodeURIComponent(part.substring(target.length));
        }
      }
    } catch (e) {
      // Abaikan jika cookie tidak tersedia
    }
    return '';
  }

  function writeCookie(name, value, maxAgeSeconds) {
    try {
      var secureFlag = global.location && global.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = name + '=' + encodeURIComponent(value) +
        '; Max-Age=' + maxAgeSeconds +
        '; Path=/; SameSite=Lax' + secureFlag;
    } catch (e) {
      // Abaikan jika cookie diblokir
    }
  }

  function readWindowNameUrl() {
    try {
      var raw = String(global.name || '');
      if (raw.indexOf(WINDOW_NAME_PREFIX) === 0) {
        var parsed = JSON.parse(raw.substring(WINDOW_NAME_PREFIX.length));
        return parsed && parsed.url ? String(parsed.url).trim() : '';
      }
    } catch (e) {
      // Abaikan jika window.name bukan format TKA_CFG
    }
    return '';
  }

  function writeWindowNameUrl(url) {
    try {
      var current = String(global.name || '');
      if (!current || current.indexOf(WINDOW_NAME_PREFIX) === 0) {
        global.name = url ? WINDOW_NAME_PREFIX + JSON.stringify({ url: url }) : '';
      }
    } catch (e) {
      // Abaikan
    }
  }

  function persistAcrossLayers(cleanUrl) {
    try {
      if (cleanUrl) {
        global.localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
      } else {
        global.localStorage.removeItem(STORAGE_KEY_URL);
      }
    } catch (e) {
      // Abaikan jika localStorage diblokir
    }

    try {
      if (cleanUrl) {
        global.sessionStorage.setItem(STORAGE_KEY_URL, cleanUrl);
      } else {
        global.sessionStorage.removeItem(STORAGE_KEY_URL);
      }
    } catch (e) {
      // Abaikan jika sessionStorage diblokir
    }

    if (cleanUrl) {
      writeCookie(STORAGE_KEY_URL, cleanUrl, COOKIE_MAX_AGE_SECONDS);
    } else {
      writeCookie(STORAGE_KEY_URL, '', 0);
    }

    writeWindowNameUrl(cleanUrl);
  }

  function readStoredUrl() {
    var candidates = [];
    try {
      candidates.push(global.localStorage.getItem(STORAGE_KEY_URL) || '');
    } catch (e) {
      // Abaikan
    }
    candidates.push(readCookie(STORAGE_KEY_URL));
    try {
      candidates.push(global.sessionStorage.getItem(STORAGE_KEY_URL) || '');
    } catch (e) {
      // Abaikan
    }
    candidates.push(readWindowNameUrl());

    for (var i = 0; i < candidates.length; i++) {
      var val = String(candidates[i] || '').trim();
      if (isValidWebAppUrl(val)) {
        return val;
      }
    }
    return '';
  }

  function captureServerFromQueryParam() {
    try {
      var params = new URLSearchParams(global.location.search || '');
      var fromParam = (params.get('server') || '').trim();
      if (!fromParam || !isValidWebAppUrl(fromParam)) {
        return;
      }

      // Hanya isi otomatis jika perangkat belum memiliki konfigurasi server sebelumnya
      var existing = readStoredUrl() || String(DEFAULT_WEB_APP_URL || '').trim();
      if (!existing) {
        persistAcrossLayers(fromParam);
      }

      // Bersihkan parameter ?server= dari address bar agar rapi
      if (global.history && typeof global.history.replaceState === 'function') {
        params.delete('server');
        var nextQuery = params.toString();
        var cleanHref = global.location.pathname + (nextQuery ? '?' + nextQuery : '') + (global.location.hash || '');
        global.history.replaceState({}, document.title, cleanHref);
      }
    } catch (e) {
      // Abaikan
    }
  }

  function getWebAppUrl() {
    var stored = readStoredUrl();
    if (stored) {
      // Sinkronkan ke seluruh lapisan penyimpanan agar tidak pernah hilang saat pindah halaman
      persistAcrossLayers(stored);
      return stored;
    }
    return String(DEFAULT_WEB_APP_URL || '').trim();
  }

  function setWebAppUrl(url) {
    var clean = String(url || '').trim();
    if (!clean) {
      persistAcrossLayers('');
      return '';
    }
    persistAcrossLayers(clean);
    return clean;
  }

  function buildPermanentConfigJs(url) {
    var clean = String(url || getWebAppUrl() || '').trim();
    var safeUrl = clean.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var header = [
      '/**',
      ' * Konfigurasi Terpusat Aplikasi Monitoring TKA Kelas VI SDN 2 Karangmangu',
      ' * File ini dibuat otomatis dengan URL Web App permanen untuk GitHub Pages.',
      ' */',
      ''
    ].join('\n');
    var body = '(' + tkaConfigBootstrap.toString() + ')(window);\n';
    body = body.replace(
      /var\s+DEFAULT_WEB_APP_URL\s*=\s*(['"])(?:\\.|(?!\1).)*\1\s*;/,
      function () {
        return "var DEFAULT_WEB_APP_URL = '" + safeUrl + "';";
      }
    );
    return header + body;
  }

  function buildAutoConnectLink(url) {
    var targetUrl = String(url || getWebAppUrl() || '').trim();
    if (!isValidWebAppUrl(targetUrl)) return '';
    var base = global.location.href.split('?')[0].split('#')[0];
    var dir = base.substring(0, base.lastIndexOf('/') + 1);
    return dir + 'login.html?server=' + encodeURIComponent(targetUrl);
  }

  captureServerFromQueryParam();

  global.TKA_CONFIG = {
    APP_NAME: 'MONITORING TKA KELAS VI',
    SEKOLAH: 'SDN 2 KARANGMANGU',
    TAHUN_AJARAN: '2026/2027',
    DEFAULT_WEB_APP_URL: DEFAULT_WEB_APP_URL,
    isValidWebAppUrl: isValidWebAppUrl,
    getWebAppUrl: getWebAppUrl,
    setWebAppUrl: setWebAppUrl,
    buildPermanentConfigJs: buildPermanentConfigJs,
    buildAutoConnectLink: buildAutoConnectLink
  };
})(window);
