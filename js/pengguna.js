/**
 * Logika Halaman pengguna.html (Manajemen Akun Admin, Guru, dan Wali Murid)
 */
(function (global) {
  'use strict';

  var usersCache = [];
  var siswaOptionsCache = [];

  async function initPenggunaPage() {
    var user = global.TKA_AUTH.requireAuth({
      pageTitle: 'Manajemen Pengguna & Hak Akses',
      activeNav: 'pengguna',
      allowedRoles: ['admin']
    });
    if (!user) return;

    var roleAdd = document.getElementById('addUserRole');
    var groupAddSiswa = document.getElementById('addUserSiswaGroup');
    if (roleAdd && groupAddSiswa) {
      roleAdd.addEventListener('change', function () {
        groupAddSiswa.classList.toggle('d-none', roleAdd.value !== 'wali');
      });
    }

    var roleEdit = document.getElementById('editUserRole');
    var groupEditSiswa = document.getElementById('editUserSiswaGroup');
    if (roleEdit && groupEditSiswa) {
      roleEdit.addEventListener('change', function () {
        groupEditSiswa.classList.toggle('d-none', roleEdit.value !== 'wali');
      });
    }

    var formTambah = document.getElementById('formTambahUser');
    if (formTambah) formTambah.addEventListener('submit', handleTambahUser);

    var formEdit = document.getElementById('formEditUser');
    if (formEdit) formEdit.addEventListener('submit', handleEditUser);

    var formReset = document.getElementById('formResetPassword');
    if (formReset) formReset.addEventListener('submit', handleResetPassword);

    var searchEl = document.getElementById('userSearchInput');
    var roleFilterEl = document.getElementById('userRoleFilter');
    if (searchEl) searchEl.addEventListener('input', renderUsersTable);
    if (roleFilterEl) roleFilterEl.addEventListener('change', renderUsersTable);

    await loadUsersAndSiswa();
  }

  async function loadUsersAndSiswa() {
    try {
      var [usersRes, siswaRes] = await Promise.all([
        global.TKA_API.apiCall('getUsers', {}, { loadingText: 'Memuat data pengguna...' }),
        global.TKA_API.apiCall('getSiswa', {}, { silent: true })
      ]);

      usersCache = usersRes.users || [];
      siswaOptionsCache = siswaRes.siswa || [];
      populateSiswaDropdowns(siswaOptionsCache);
      renderUsersTable();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function populateSiswaDropdowns(siswaList) {
    ['addUserSiswaId', 'editUserSiswaId'].forEach(function (selectId) {
      var select = document.getElementById(selectId);
      if (!select) return;
      select.innerHTML = '<option value="">-- Belum dihubungkan --</option>';
      siswaList.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.siswaId;
        opt.textContent = s.nama + ' (NIS: ' + s.nis + ' · ' + s.kelas + ')';
        select.appendChild(opt);
      });
    });
  }

  function renderUsersTable() {
    var q = (document.getElementById('userSearchInput')?.value || '').trim().toLowerCase();
    var roleFilter = document.getElementById('userRoleFilter')?.value || '';

    var filtered = usersCache.filter(function (u) {
      if (q) {
        var hit = u.username.toLowerCase().indexOf(q) !== -1 ||
          u.nama.toLowerCase().indexOf(q) !== -1 ||
          (u.siswaNama || '').toLowerCase().indexOf(q) !== -1;
        if (!hit) return false;
      }
      if (roleFilter && u.role !== roleFilter) return false;
      return true;
    });

    var tbody = document.getElementById('usersTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'text-center py-4 text-secondary';
      td.textContent = 'Belum ada akun pengguna yang cocok.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach(function (u) {
      var tr = document.createElement('tr');
      tr.appendChild(makeTd(u.username, 'fw-semibold'));
      tr.appendChild(makeTd(u.nama));
      tr.appendChild(makeTd(global.TKA_AUTH.getRoleDisplayName(u.role)));

      var siswaInfo = u.role === 'wali'
        ? (u.siswaNama ? u.siswaNama + ' (NIS: ' + u.siswaNis + ')' : 'Belum terhubung')
        : '-';
      tr.appendChild(makeTd(siswaInfo, u.role === 'wali' && !u.siswaId ? 'text-warning fw-semibold' : ''));

      var statusCls = u.status === 'Aktif' ? 'status-success' : 'status-danger';
      tr.appendChild(makeTd(u.status, 'fw-semibold ' + statusCls));

      var tdAksi = document.createElement('td');
      tdAksi.className = 'text-end text-nowrap';

      var btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-sm btn-outline-primary me-1';
      btnEdit.textContent = 'Kelola';
      btnEdit.addEventListener('click', function () {
        openEditUserModal(u);
      });

      var btnReset = document.createElement('button');
      btnReset.type = 'button';
      btnReset.className = 'btn btn-sm btn-outline-secondary';
      btnReset.textContent = 'Reset Password';
      btnReset.addEventListener('click', function () {
        openResetPasswordModal(u);
      });

      tdAksi.appendChild(btnEdit);
      tdAksi.appendChild(btnReset);
      tr.appendChild(tdAksi);
      tbody.appendChild(tr);
    });
  }

  async function handleTambahUser(ev) {
    ev.preventDefault();
    var username = document.getElementById('addUserUsername').value.trim();
    var nama = document.getElementById('addUserNama').value.trim();
    var role = document.getElementById('addUserRole').value;
    var siswaId = role === 'wali' ? document.getElementById('addUserSiswaId').value : '';
    var password = document.getElementById('addUserPassword').value;

    if (!username || !nama || password.length < 8) {
      global.TKA_API.showToast('Username, Nama, dan Password (min. 8 karakter) wajib diisi.', 'warning');
      return;
    }

    try {
      var res = await global.TKA_API.apiCall('tambahUser', {
        username: username,
        nama: nama,
        role: role,
        siswaId: siswaId,
        password: password
      }, { loadingText: 'Membuat akun pengguna...' });

      global.TKA_API.showToast(res.message, 'success');
      ev.target.reset();
      document.getElementById('addUserSiswaGroup').classList.add('d-none');
      var modalEl = document.getElementById('modalTambahUser');
      var inst = modalEl && global.bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
      await loadUsersAndSiswa();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function openEditUserModal(u) {
    document.getElementById('editUserId').value = u.userId;
    document.getElementById('editUserUsername').value = u.username;
    document.getElementById('editUserNama').value = u.nama;
    document.getElementById('editUserRole').value = u.role;
    document.getElementById('editUserStatus').value = u.status;
    document.getElementById('editUserSiswaId').value = u.siswaId || '';
    document.getElementById('editUserSiswaGroup').classList.toggle('d-none', u.role !== 'wali');

    var modal = new global.bootstrap.Modal(document.getElementById('modalEditUser'));
    modal.show();
  }

  async function handleEditUser(ev) {
    ev.preventDefault();
    var role = document.getElementById('editUserRole').value;
    var payload = {
      userId: document.getElementById('editUserId').value,
      nama: document.getElementById('editUserNama').value.trim(),
      role: role,
      status: document.getElementById('editUserStatus').value,
      siswaId: role === 'wali' ? document.getElementById('editUserSiswaId').value : ''
    };

    if (!payload.nama) {
      global.TKA_API.showToast('Nama pengguna tidak boleh kosong.', 'warning');
      return;
    }

    try {
      var res = await global.TKA_API.apiCall('updateUser', payload, {
        loadingText: 'Memperbarui akun...'
      });
      global.TKA_API.showToast(res.message, 'success');
      var modalEl = document.getElementById('modalEditUser');
      var inst = modalEl && global.bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
      await loadUsersAndSiswa();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function openResetPasswordModal(u) {
    document.getElementById('resetUserId').value = u.userId;
    document.getElementById('resetUserLabel').textContent = u.nama + ' (' + u.username + ')';
    document.getElementById('resetPasswordBaru').value = '';
    var modal = new global.bootstrap.Modal(document.getElementById('modalResetPassword'));
    modal.show();
  }

  async function handleResetPassword(ev) {
    ev.preventDefault();
    var userId = document.getElementById('resetUserId').value;
    var passwordBaru = document.getElementById('resetPasswordBaru').value;

    if (passwordBaru.length < 8) {
      global.TKA_API.showToast('Password baru minimal 8 karakter.', 'warning');
      return;
    }

    try {
      var res = await global.TKA_API.apiCall('resetPasswordUser', {
        userId: userId,
        passwordBaru: passwordBaru
      }, { loadingText: 'Mereset password...' });

      global.TKA_API.showToast(res.message, 'success');
      var modalEl = document.getElementById('modalResetPassword');
      var inst = modalEl && global.bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function makeTd(text, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  document.addEventListener('DOMContentLoaded', initPenggunaPage);
})(window);
