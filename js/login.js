/**
 * Logika Halaman index.html & login.html
 */
(function (global) {
  'use strict';

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
    if (formUrl) {
      var inputUrl = document.getElementById('inputWebAppUrl');
      if (inputUrl) inputUrl.value = global.TKA_CONFIG.getWebAppUrl();

      formUrl.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var val = inputUrl ? inputUrl.value.trim() : '';
        if (!val || !/^https:\/\/script\.google\.com\/macros\/s\//i.test(val)) {
          global.TKA_API.showToast('Masukkan URL Web App Google Apps Script yang valid (https://script.google.com/macros/s/...).', 'warning');
          return;
        }
        global.TKA_CONFIG.setWebAppUrl(val);
        updateUrlStatusBadge();
        try {
          var ping = await global.TKA_API.apiCall('ping', {}, { loadingText: 'Menguji koneksi Web App...' });
          global.TKA_API.showToast('Terhubung ke ' + (ping.sekolah || 'server') + '!', 'success');
          var modalEl = document.getElementById('modalApiConfig');
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
      el.textContent = 'Koneksi Web App telah dikonfigurasi';
      el.className = 'status-text status-success';
    } else {
      el.textContent = 'URL Web App belum diatur — klik Pengaturan Koneksi';
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

    var formUrl = document.getElementById('formLoginApiUrl');
    if (formUrl) {
      formUrl.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var val = inputUrl ? inputUrl.value.trim() : '';
        if (!val || !/^https:\/\/script\.google\.com\/macros\/s\//i.test(val)) {
          global.TKA_API.showToast('URL Web App harus diawali https://script.google.com/macros/s/', 'warning');
          return;
        }
        global.TKA_CONFIG.setWebAppUrl(val);
        var modalEl = document.getElementById('modalLoginApi');
        var inst = modalEl && global.bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
        await checkInitialSetupState();
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
