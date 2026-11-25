/**
 * Modul Komunikasi REST API Google Apps Script, Loading Indicator, Toast & Safe DOM
 */
(function (global) {
  'use strict';

  var loadingDepth = 0;

  function ensureLoadingOverlay() {
    var el = document.getElementById('globalLoadingOverlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'globalLoadingOverlay';
    el.className = 'loading-overlay';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');

    var box = document.createElement('div');
    box.className = 'loading-box';

    var spinner = document.createElement('div');
    spinner.className = 'spinner-border spinner-border-sm text-primary';
    spinner.setAttribute('aria-hidden', 'true');

    var text = document.createElement('span');
    text.id = 'globalLoadingText';
    text.textContent = 'Memproses data...';

    box.appendChild(spinner);
    box.appendChild(text);
    el.appendChild(box);
    document.body.appendChild(el);
    return el;
  }

  function showLoading(message) {
    loadingDepth++;
    var el = ensureLoadingOverlay();
    var textEl = document.getElementById('globalLoadingText');
    if (textEl) {
      textEl.textContent = message || 'Memuat data...';
    }
    el.classList.add('show');
  }

  function hideLoading() {
    loadingDepth = Math.max(0, loadingDepth - 1);
    if (loadingDepth === 0) {
      var el = document.getElementById('globalLoadingOverlay');
      if (el) el.classList.remove('show');
    }
  }

  function ensureToastContainer() {
    var container = document.getElementById('globalToastContainer');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'globalToastContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '2100';
    document.body.appendChild(container);
    return container;
  }

  function showToast(message, type) {
    var kind = type || 'info';
    var container = ensureToastContainer();
    var toastEl = document.createElement('div');

    var bgClass = 'text-bg-primary';
    if (kind === 'success') bgClass = 'text-bg-success';
    else if (kind === 'error' || kind === 'danger') bgClass = 'text-bg-danger';
    else if (kind === 'warning') bgClass = 'text-bg-warning';

    toastEl.className = 'toast align-items-center border-0 ' + bgClass;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    var wrapper = document.createElement('div');
    wrapper.className = 'd-flex';

    var body = document.createElement('div');
    body.className = 'toast-body fw-medium';
    body.textContent = String(message || '');

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close btn-close-white me-2 m-auto';
    closeBtn.setAttribute('data-bs-dismiss', 'toast');
    closeBtn.setAttribute('aria-label', 'Tutup');

    wrapper.appendChild(body);
    wrapper.appendChild(closeBtn);
    toastEl.appendChild(wrapper);
    container.appendChild(toastEl);

    if (global.bootstrap && global.bootstrap.Toast) {
      var bsToast = new global.bootstrap.Toast(toastEl, { delay: 4500 });
      toastEl.addEventListener('hidden.bs.toast', function () {
        toastEl.remove();
      });
      bsToast.show();
    } else {
      setTimeout(function () {
        toastEl.remove();
      }, 4500);
    }
  }

  function escapeHtml(val) {
    return String(val === null || val === undefined ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatScore(val) {
    if (val === null || val === undefined || val === '' || Number.isNaN(Number(val))) {
      return '-';
    }
    return String(val);
  }

  function getKategoriNilai(nilai) {
    if (nilai === null || nilai === undefined || Number.isNaN(Number(nilai))) {
      return { label: '-', cssClass: 'status-muted' };
    }
    var n = Number(nilai);
    if (n >= 90) return { label: 'Sangat Baik', cssClass: 'status-success' };
    if (n >= 75) return { label: 'Baik', cssClass: 'status-success' };
    if (n >= 60) return { label: 'Cukup', cssClass: 'status-warning' };
    return { label: 'Perlu Bimbingan', cssClass: 'status-danger' };
  }

  async function apiCall(action, payload, options) {
    var opts = options || {};
    var url = global.TKA_CONFIG.getWebAppUrl();

    if (!url) {
      throw new Error('URL Web App Google Apps Script belum dikonfigurasi.');
    }

    var bodyObj = Object.assign({}, payload || {}, { action: action });
    if (global.TKA_AUTH && typeof global.TKA_AUTH.getToken === 'function') {
      var token = global.TKA_AUTH.getToken();
      if (token && !bodyObj.token) {
        bodyObj.token = token;
      }
    }

    if (!opts.silent) {
      showLoading(opts.loadingText || 'Menghubungkan ke server...');
    }

    try {
      var response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(bodyObj)
      });

      if (!response.ok) {
        throw new Error('Koneksi server gagal (HTTP ' + response.status + ').');
      }

      var data = await response.json();

      if (data && data.code === 401 && !opts.skipAuthRedirect) {
        if (global.TKA_AUTH) {
          global.TKA_AUTH.clearSession();
        }
        if (!window.location.pathname.endsWith('login.html')) {
          window.location.href = 'login.html';
        }
      }

      if (!data || data.ok === false) {
        var err = new Error((data && data.message) || 'Permintaan gagal diproses.');
        err.code = data ? data.code : 500;
        err.data = data;
        throw err;
      }

      return data;
    } finally {
      if (!opts.silent) {
        hideLoading();
      }
    }
  }

  global.TKA_API = {
    apiCall: apiCall,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showToast: showToast,
    escapeHtml: escapeHtml,
    formatScore: formatScore,
    getKategoriNilai: getKategoriNilai
  };
})(window);
