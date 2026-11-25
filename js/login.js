/**
 * Logika Halaman index.html & login.html
 */
(function (global) {
  'use strict';

  function triggerDownloadConfig(url) {
    var clean = String(url || global.TKA_CONFIG.getWebAppUrl() || '').trim();
    if (!global.TKA_CONFIG.isValidWebAppUrl(clean)) {
      global.TKA_API.showToast('Masukkan dan simpan URL Web App Google Apps Script yang valid terlebih dahulu.', 'warning');
      return;
    }
    var content = global.TKA_CONFIG.buildPermanentConfigJs(clean);
    var blob = new Blob([content], { type: 'application/javascript;charset=utf-8;' });
    var objUrl = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = objUrl;
    a.download = 'config.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    global.TKA_API.showToast('File config.js berhasil diunduh. Ganti file monitoring-tka/js/config.js agar permanen untuk semua pengguna.', 'success');
  }

  async function triggerCopyAutoLink(url) {
    var clean = String(url || global.TKA_CONFIG.getWebAppUrl() || '').trim();
    if (!global.TKA_CONFIG.isValidWebAppUrl(clean)) {
      global.TKA_API.showToast('Masukkan URL Web App yang valid terlebih dahulu.', 'warning');
      return;
    }
    var link = global.TKA_CONFIG.buildAutoConnectLink(clean);
    try {
      await global.navigator.clipboard.writeText(link);
      global.TKA_API.showToast('Tautan otomatis berhasil disalin. Buka tautan ini di HP guru/wali murid agar langsung terhubung.', 'success');
    } catch (e) {
      global.TKA_API.showToast('Gagal menyalin otomatis. URL: ' + link, 'info');
    }
  }

  function initIndexPage() {
    global.TKA_AUTH.applyTheme(global.TKA_AUTH.getSavedTheme());

    var btnTheme = document.getElementById('btnPublicTheme');
    if (btnTheme) {
      btnTheme.addEventListener('click', global.TKA_AUTH.toggleTheme);
    }

    var token = global.TKA_AUTH.getToken();
    var user = global.TKA_AUTH.getUser();
    var ctaPrimary = document.getElementById('btnHeroPrimary');
    if (ctaPrimary && token && user) {
      ctaPrimary.textContent = 'Buka Dashboard (' + (user.nama || user.username) + ')';
      ctaPrimary.setAttribute('href', 'dashboard.html');
    }

    updateUrlStatusBadge();

    var formUrl = document.getElementById('formWebAppUrl');
    var inputUrl = document.getElementById('inputWebAppUrl');
    if (inputUrl) inputUrl.value = global.TKA_CONFIG.getWebAppUrl();

    var modalEl = document.getElementById('modalApiConfig');
    if (modalEl && inputUrl) {
      modalEl.addEventListener('show.bs.modal', function () {
        inputUrl.value = global.TKA_CONFIG.getWebAppUrl();
      });
    }

    var btnDl = document.getElementById('btnIndexDownloadConfig');
    if (btnDl) {
      btnDl.addEventListener('click', function () {
        triggerDownloadConfig(inputUrl ? inputUrl.value : '');
      });
    }

    var btnCopy = document.getElementById('btnIndexCopyLink');
    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        triggerCopyAutoLink(inputUrl ? inputUrl.value : '');
      });
    }

    if (formUrl) {
      formUrl.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var val = inputUrl ? inputUrl.value.trim() : '';
        if (!global.TKA_CONFIG.isValidWebAppUrl(val)) {
          global.TKA_API.showToast('Masukkan URL Web App Google Apps Script yang valid (https://script.google.com/macros/...).', 'warning');
          return;
        }
        global.TKA_CONFIG.setWebAppUrl(val);
        updateUrlStatusBadge();
        try {
          var ping = await global.TKA_API.apiCall('ping', {}, { loadingText: 'Menguji koneksi Web App...' });
          global.TKA_API.showToast('Tersimpan tetap & terhubung ke ' + (ping.sekolah || 'server') + '!', 'success');
          var inst = modalEl && global.bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
        } catch (err) {
          global.TKA_API.showToast('URL disimpan, tetapi uji koneksi gagal: ' + err.message, 'error');
        }
      });
    }

    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }
  }

  function updateUrlStatusBadge() {
    var el = document.getElementById('apiUrlStatusText');
    if (!el) return;
    var url = global.TKA_CONFIG.getWebAppUrl();
    if (url) {
      el.textContent = 'Koneksi server tersimpan tetap dan siap digunakan';
      el.className = 'status-text status-success';
    } else {
      el.textContent = 'URL Web App belum diatur — klik Pengaturan Koneksi Server';
      el.className = 'status-text status-warning';
    }
  }

  async function initLoginPage() {
    global.TKA_AUTH.applyTheme(global.TKA_AUTH.getSavedTheme());

    if (global.TKA_AUTH.getToken() && global.TKA_AUTH.getUser()) {
      global.location.href = 'dashboard.html';
      return;
    }

    var btnTheme = document.getElementById('btnLoginTheme');
    if (btnTheme) {
      btnTheme.addEventListener('click', global.TKA_AUTH.toggleTheme);
    }

    var togglePassBtn = document.getElementById('btnTogglePassword');
    var passInput = document.getElementById('loginPassword');
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener('click', function () {
        var isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        togglePassBtn.textContent = isPass ? 'Sembunyikan' : 'Lihat';
      });
    }

    var inputUrl = document.getElementById('inputLoginWebAppUrl');
    if (inputUrl) {
      inputUrl.value = global.TKA_CONFIG.getWebAppUrl();
    }

    var modalEl = document.getElementById('modalLoginApi');
    if (modalEl && inputUrl) {
      modalEl.addEventListener('show.bs.modal', function () {
        inputUrl.value = global.TKA_CONFIG.getWebAppUrl();
      });
    }

    var btnDl = document.getElementById('btnLoginDownloadConfig');
    if (btnDl) {
      btnDl.addEventListener('click', function () {
        triggerDownloadConfig(inputUrl ? inputUrl.value : '');
      });
    }

    var btnCopy = document.getElementById('btnLoginCopyLink');
    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        triggerCopyAutoLink(inputUrl ? inputUrl.value : '');
      });
    }

    var formUrl = document.getElementById('formLoginApiUrl');
    if (formUrl) {
      formUrl.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var val = inputUrl ? inputUrl.value.trim() : '';
        if (!global.TKA_CONFIG.isValidWebAppUrl(val)) {
          global.TKA_API.showToast('URL Web App harus diawali https://script.google.com/macros/', 'warning');
          return;
        }
        global.TKA_CONFIG.setWebAppUrl(val);
        try {
          var ping = await global.TKA_API.apiCall('ping', {}, { loadingText: 'Menguji koneksi server...' });
          global.TKA_API.showToast('Koneksi server tersimpan tetap (' + (ping.sekolah || 'OK') + ').', 'success');
          var inst = modalEl && global.bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
          await checkInitialSetupState();
        } catch (err) {
          global.TKA_API.showToast('URL disimpan, tetapi koneksi gagal: ' + err.message, 'error');
        }
      });
    }

    var formLogin = document.getElementById('formLogin');
    if (formLogin) {
      formLogin.addEventListener('submit', handleLoginSubmit);
    }

    var formSetup = document.getElementById('formSetupAdmin');
    if (formSetup) {
      formSetup.addEventListener('submit', handleInitialAdminSubmit);
    }

    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }

    await checkInitialSetupState();
  }

  async function checkInitialSetupState() {
    var alertNoUrl = document.getElementById('alertNoWebAppUrl');
    var cardLogin = document.getElementById('cardLoginBox');
    var cardSetup = document.getElementById('cardSetupAdminBox');
    var url = global.TKA_CONFIG.getWebAppUrl();

    if (!url) {
      if (alertNoUrl) alertNoUrl.classList.remove('d-none');
      return;
    }
    if (alertNoUrl) alertNoUrl.classList.add('d-none');

    try {
      var res = await global.TKA_API.apiCall('cekSetupAwal', {}, { silent: true, skipAuthRedirect: true });
      if (res && res.needsInitialSetup) {
        if (cardLogin) cardLogin.classList.add('d-none');
        if (cardSetup) cardSetup.classList.remove('d-none');
      } else {
        if (cardSetup) cardSetup.classList.add('d-none');
        if (cardLogin) cardLogin.classList.remove('d-none');
      }
    } catch (err) {
      global.TKA_API.showToast('Gagal memeriksa koneksi server: ' + err.message, 'error');
    }
  }

  async function handleLoginSubmit(ev) {
    ev.preventDefault();
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value;
    var errBox = document.getElementById('loginErrorAlert');

    if (errBox) errBox.classList.add('d-none');

    if (!global.TKA_CONFIG.getWebAppUrl()) {
      global.TKA_API.showToast('Silakan atur URL Web App Google Apps Script terlebih dahulu.', 'warning');
      return;
    }

    if (!username || !password) {
      showInlineError(errBox, 'Username dan password wajib diisi.');
      return;
    }

    try {
      var res = await global.TKA_API.apiCall('login', {
        username: username,
        password: password
      }, { loadingText: 'Memverifikasi akun...', skipAuthRedirect: true });

      global.TKA_AUTH.saveSession(res.token, res.user);
      global.TKA_API.showToast('Login berhasil. Mengarahkan ke dashboard...', 'success');
      setTimeout(function () {
        global.location.href = 'dashboard.html';
      }, 350);
    } catch (err) {
      showInlineError(errBox, err.message);
    }
  }

  async function handleInitialAdminSubmit(ev) {
    ev.preventDefault();
    var nama = document.getElementById('setupAdminNama').value.trim();
    var username = document.getElementById('setupAdminUsername').value.trim();
    var password = document.getElementById('setupAdminPassword').value;
    var konfirmasi = document.getElementById('setupAdminKonfirmasi').value;
    var errBox = document.getElementById('setupErrorAlert');

    if (errBox) errBox.classList.add('d-none');

    if (!nama || !username || password.length < 8) {
      showInlineError(errBox, 'Nama lengkap, username (min. 4 karakter), dan password (min. 8 karakter) wajib diisi.');
      return;
    }
    if (password !== konfirmasi) {
      showInlineError(errBox, 'Konfirmasi password tidak cocok.');
      return;
    }

    try {
      var res = await global.TKA_API.apiCall('setupAdminPertama', {
        nama: nama,
        username: username,
        password: password
      }, { loadingText: 'Menyiapkan database & akun admin...' });

      global.TKA_API.showToast(res.message || 'Akun admin berhasil dibuat. Silakan login.', 'success');
      document.getElementById('loginUsername').value = username;
      document.getElementById('cardSetupAdminBox').classList.add('d-none');
      document.getElementById('cardLoginBox').classList.remove('d-none');
    } catch (err) {
      showInlineError(errBox, err.message);
    }
  }

  function showInlineError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('d-none');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    if (page === 'index') {
      initIndexPage();
    } else if (page === 'login') {
      initLoginPage();
    }
  });
})(window);
