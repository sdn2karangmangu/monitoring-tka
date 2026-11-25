/**
 * Modul Autentikasi, Proteksi Halaman Berdasarkan Role, Tema Gelap/Terang, & Shell Navigasi
 */
(function (global) {
  'use strict';

  var SESSION_TOKEN_KEY = 'tka_session_token';
  var SESSION_USER_KEY = 'tka_session_user';
  var THEME_KEY = 'tka_theme_mode';

  function getToken() {
    try {
      return global.sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function getUser() {
    try {
      var raw = global.sessionStorage.getItem(SESSION_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(token, user) {
    global.sessionStorage.setItem(SESSION_TOKEN_KEY, String(token || ''));
    global.sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user || {}));
  }

  function clearSession() {
    try {
      global.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      global.sessionStorage.removeItem(SESSION_USER_KEY);
    } catch (e) {
      // Abaikan
    }
  }

  function getSavedTheme() {
    try {
      return global.localStorage.getItem(THEME_KEY) || 'light';
    } catch (e) {
      return 'light';
    }
  }

  function applyTheme(theme) {
    var mode = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-bs-theme', mode);
    try {
      global.localStorage.setItem(THEME_KEY, mode);
    } catch (e) {
      // Abaikan
    }
    var iconEl = document.getElementById('themeToggleIcon');
    var labelEl = document.getElementById('themeToggleLabel');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', mode === 'dark' ? 'sun' : 'moon');
    }
    if (labelEl) {
      labelEl.textContent = mode === 'dark' ? 'Mode Terang' : 'Mode Gelap';
    }
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }
  }

  function toggleTheme() {
    var current = getSavedTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function getNavItemsForRole(role) {
    if (role === 'wali') {
      return [
        { id: 'dashboard', label: 'Portal Anak', href: 'dashboard.html', icon: 'home' },
        { id: 'laporan', label: 'Laporan PDF', href: 'laporan.html', icon: 'file-text' }
      ];
    }

    var items = [
      { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'layout-dashboard' },
      { id: 'siswa', label: 'Data Siswa', href: 'siswa.html', icon: 'users' },
      { id: 'rekap', label: 'Rekap Nilai', href: 'rekap.html', icon: 'table' },
      { id: 'tryout', label: 'Tryout & Sync', href: 'tryout.html', icon: 'refresh-cw' }
    ];

    if (role === 'admin') {
      items.push({ id: 'pengguna', label: 'Pengguna', href: 'pengguna.html', icon: 'shield-check' });
    }

    items.push({ id: 'laporan', label: 'Laporan PDF', href: 'laporan.html', icon: 'printer' });
    return items;
  }

  function buildSidebarLinksHtml(items, activeId) {
    return items.map(function (item) {
      var activeClass = item.id === activeId ? ' active' : '';
      return '<a class="sidebar-link' + activeClass + '" href="' + item.href + '">' +
        '<i data-lucide="' + item.icon + '"></i>' +
        '<span>' + global.TKA_API.escapeHtml(item.label) + '</span>' +
        '</a>';
    }).join('');
  }

  function getRoleDisplayName(role) {
    if (role === 'admin') return 'Administrator';
    if (role === 'guru') return 'Guru Kelas VI';
    if (role === 'wali') return 'Wali Murid';
    return role;
  }

  function ensurePasswordModal() {
    if (document.getElementById('modalUbahPassword')) return;

    var modalWrapper = document.createElement('div');
    modalWrapper.innerHTML =
      '<div class="modal fade" id="modalUbahPassword" tabindex="-1" aria-hidden="true">' +
      '  <div class="modal-dialog modal-dialog-centered">' +
      '    <div class="modal-content">' +
      '      <form id="formUbahPassword" novalidate>' +
      '        <div class="modal-header">' +
      '          <h5 class="modal-title fw-bold">Ubah Password</h5>' +
      '          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>' +
      '        </div>' +
      '        <div class="modal-body">' +
      '          <div class="mb-3">' +
      '            <label class="form-label fw-semibold" for="inputPasswordLama">Password Lama</label>' +
      '            <input type="password" class="form-control" id="inputPasswordLama" required>' +
      '          </div>' +
      '          <div class="mb-3">' +
      '            <label class="form-label fw-semibold" for="inputPasswordBaru">Password Baru (min. 8 karakter)</label>' +
      '            <input type="password" class="form-control" id="inputPasswordBaru" minlength="8" required>' +
      '          </div>' +
      '          <div class="mb-2">' +
      '            <label class="form-label fw-semibold" for="inputPasswordKonfirmasi">Konfirmasi Password Baru</label>' +
      '            <input type="password" class="form-control" id="inputPasswordKonfirmasi" minlength="8" required>' +
      '          </div>' +
      '        </div>' +
      '        <div class="modal-footer">' +
      '          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Batal</button>' +
      '          <button type="submit" class="btn btn-navy">Simpan Password</button>' +
      '        </div>' +
      '      </form>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(modalWrapper.firstChild);

    var form = document.getElementById('formUbahPassword');
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var lama = document.getElementById('inputPasswordLama').value;
      var baru = document.getElementById('inputPasswordBaru').value;
      var konfirmasi = document.getElementById('inputPasswordKonfirmasi').value;

      if (!lama || baru.length < 8) {
        global.TKA_API.showToast('Password baru wajib diisi minimal 8 karakter.', 'warning');
        return;
      }
      if (baru !== konfirmasi) {
        global.TKA_API.showToast('Konfirmasi password baru tidak cocok.', 'warning');
        return;
      }

      try {
        var res = await global.TKA_API.apiCall('ubahPassword', {
          passwordLama: lama,
          passwordBaru: baru
        }, { loadingText: 'Memperbarui password...' });

        global.TKA_API.showToast(res.message || 'Password berhasil diperbarui.', 'success');
        form.reset();
        var modalEl = document.getElementById('modalUbahPassword');
        var instance = global.bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
      } catch (err) {
        global.TKA_API.showToast(err.message, 'error');
      }
    });
  }

  async function handleLogout() {
    try {
      await global.TKA_API.apiCall('logout', {}, { silent: true, skipAuthRedirect: true });
    } catch (e) {
      // Abaikan error jaringan saat logout
    } finally {
      clearSession();
      global.location.href = 'login.html';
    }
  }

  function requireAuth(options) {
    var opts = options || {};
    applyTheme(getSavedTheme());

    var token = getToken();
    var user = getUser();

    if (!token || !user || !user.role) {
      clearSession();
      global.location.href = 'login.html';
      return null;
    }

    if (opts.allowedRoles && opts.allowedRoles.indexOf(user.role) === -1) {
      global.location.href = 'dashboard.html';
      return null;
    }

    // Render navigasi sidebar, offcanvas mobile, dan topbar
    var navItems = getNavItemsForRole(user.role);
    var linksHtml = buildSidebarLinksHtml(navItems, opts.activeNav || '');

    var desktopNav = document.getElementById('sidebarNavLinks');
    if (desktopNav) desktopNav.innerHTML = linksHtml;

    var mobileNav = document.getElementById('mobileNavLinks');
    if (mobileNav) mobileNav.innerHTML = linksHtml;

    var userNamaEl = document.getElementById('sidebarUserNama');
    if (userNamaEl) userNamaEl.textContent = user.nama || user.username;

    var userRoleEl = document.getElementById('sidebarUserRole');
    if (userRoleEl) userRoleEl.textContent = getRoleDisplayName(user.role);

    var topbarUserEl = document.getElementById('topbarUserName');
    if (topbarUserEl) topbarUserEl.textContent = user.nama || user.username;

    var pageTitleEl = document.getElementById('topbarPageTitle');
    if (pageTitleEl && opts.pageTitle) pageTitleEl.textContent = opts.pageTitle;

    var btnTheme = document.getElementById('btnThemeToggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', toggleTheme);
    }

    var btnLogoutList = document.querySelectorAll('.js-logout-btn');
    btnLogoutList.forEach(function (btn) {
      btn.addEventListener('click', handleLogout);
    });

    ensurePasswordModal();

    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons();
    }

    // Verifikasi sesi secara diam-diam dengan backend untuk mencegah token kedaluwarsa
    global.TKA_API.apiCall('verifySession', {}, { silent: true }).catch(function () {
      // Penanganan redirect 401 sudah dilakukan di apiCall
    });

    return user;
  }

  global.TKA_AUTH = {
    getToken: getToken,
    getUser: getUser,
    saveSession: saveSession,
    clearSession: clearSession,
    applyTheme: applyTheme,
    getSavedTheme: getSavedTheme,
    toggleTheme: toggleTheme,
    getRoleDisplayName: getRoleDisplayName,
    requireAuth: requireAuth,
    handleLogout: handleLogout
  };

  // Terapkan tema tersimpan secepat mungkin saat script dimuat
  applyTheme(getSavedTheme());
})(window);
