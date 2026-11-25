/**
 * Logika Halaman tryout.html (Sumber Spreadsheet Tryout, Sinkronisasi Manual, & Data Hasil)
 */
(function (global) {
  'use strict';

  var currentHasilList = [];

  async function initTryoutPage() {
    var user = global.TKA_AUTH.requireAuth({
      pageTitle: 'Manajemen Sumber Tryout & Sinkronisasi',
      activeNav: 'tryout',
      allowedRoles: ['admin', 'guru']
    });
    if (!user) return;

    var btnAddSumber = document.getElementById('btnOpenTambahSumber');
    if (btnAddSumber && user.role !== 'admin') {
      btnAddSumber.classList.add('d-none');
    }

    var btnServerCfg = document.getElementById('btnOpenServerConfig');
    if (btnServerCfg && user.role === 'admin') {
      btnServerCfg.classList.remove('d-none');
      initAdminServerModal();
    }

    var btnSync = document.getElementById('btnTryoutSync');
    if (btnSync) {
      btnSync.addEventListener('click', handleSync);
    }

    var formSumber = document.getElementById('formTambahSumber');
    if (formSumber) {
      formSumber.addEventListener('submit', handleTambahSumber);
    }

    var filterMapel = document.getElementById('hasilFilterMapel');
    if (filterMapel) {
      filterMapel.addEventListener('change', renderHasilTable);
    }

    await loadTryoutPageData(user);
  }

  function initAdminServerModal() {
    var modalEl = document.getElementById('modalTryoutServerConfig');
    var inputUrl = document.getElementById('inputTryoutWebAppUrl');
    var form = document.getElementById('formTryoutServerConfig');
    var btnDl = document.getElementById('btnTryoutDownloadConfig');
    var btnCopy = document.getElementById('btnTryoutCopyLink');

    if (modalEl && inputUrl) {
      modalEl.addEventListener('show.bs.modal', function () {
        inputUrl.value = global.TKA_CONFIG.getWebAppUrl();
      });
    }

    if (btnDl) {
      btnDl.addEventListener('click', function () {
        var clean = String((inputUrl && inputUrl.value) || global.TKA_CONFIG.getWebAppUrl() || '').trim();
        if (!global.TKA_CONFIG.isValidWebAppUrl(clean)) {
          global.TKA_API.showToast('URL Web App tidak valid.', 'warning');
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
        global.TKA_API.showToast('File config.js permanen berhasil diunduh.', 'success');
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', async function () {
        var clean = String((inputUrl && inputUrl.value) || global.TKA_CONFIG.getWebAppUrl() || '').trim();
        if (!global.TKA_CONFIG.isValidWebAppUrl(clean)) {
          global.TKA_API.showToast('URL Web App tidak valid.', 'warning');
          return;
        }
        var link = global.TKA_CONFIG.buildAutoConnectLink(clean);
        try {
          await global.navigator.clipboard.writeText(link);
          global.TKA_API.showToast('Tautan otomatis berhasil disalin.', 'success');
        } catch (e) {
          global.TKA_API.showToast('Salin manual tautan: ' + link, 'info');
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async function (ev) {
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
        } catch (err) {
          global.TKA_API.showToast('URL disimpan, tetapi uji koneksi gagal: ' + err.message, 'error');
        }
      });
    }
  }

  async function loadTryoutPageData(user) {
    try {
      var [sumberRes, hasilRes] = await Promise.all([
        global.TKA_API.apiCall('getSumberTryout', {}, { loadingText: 'Memuat daftar sumber tryout...' }),
        global.TKA_API.apiCall('getHasil', {}, { silent: true })
      ]);

      renderSumberTable(sumberRes.sumberTryout || [], user.role);
      currentHasilList = hasilRes.hasil || [];
      renderHasilTable();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function renderSumberTable(list, role) {
    var tbody = document.getElementById('sumberTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'text-center py-4 text-secondary';
      td.textContent = 'Belum ada sumber tryout yang dikonfigurasi.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    list.forEach(function (src) {
      var tr = document.createElement('tr');
      tr.appendChild(makeTd(src.sumberId, 'tabular-nums fw-semibold'));
      tr.appendChild(makeTd(src.namaTryout, 'fw-semibold'));
      tr.appendChild(makeTd(src.mataPelajaran));
      tr.appendChild(makeTd(src.sheetGid, 'tabular-nums'));
      tr.appendChild(makeTd(src.terakhirSync || 'Belum pernah', 'tabular-nums'));

      var statusCls = src.status === 'Aktif' ? 'status-success' : 'status-muted';
      tr.appendChild(makeTd(src.status, 'fw-semibold ' + statusCls));

      var tdAksi = document.createElement('td');
      tdAksi.className = 'text-end';
      if (role === 'admin') {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-outline-secondary';
        btn.textContent = src.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan';
        btn.addEventListener('click', function () {
          handleToggleSumber(src.sumberId, src.status === 'Aktif' ? 'Nonaktif' : 'Aktif');
        });
        tdAksi.appendChild(btn);
      } else {
        tdAksi.textContent = '-';
      }
      tr.appendChild(tdAksi);
      tbody.appendChild(tr);
    });
  }

  function renderHasilTable() {
    var mapel = document.getElementById('hasilFilterMapel')?.value || '';
    var filtered = currentHasilList.filter(function (h) {
      return !mapel || h.mataPelajaran === mapel;
    });

    var countEl = document.getElementById('hasilCountBadge');
    if (countEl) countEl.textContent = filtered.length + ' rekaman hasil';

    var tbody = document.getElementById('hasilTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'text-center py-4 text-secondary';
      td.textContent = 'Belum ada data hasil tryout tersinkronisasi.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach(function (h) {
      var tr = document.createElement('tr');
      tr.appendChild(makeTd(h.nis, 'tabular-nums'));

      var tdNama = document.createElement('td');
      var link = document.createElement('a');
      link.href = 'detail-siswa.html?siswaId=' + encodeURIComponent(h.siswaId);
      link.className = 'fw-semibold text-decoration-none';
      link.textContent = h.namaSiswa;
      tdNama.appendChild(link);
      tr.appendChild(tdNama);

      tr.appendChild(makeTd(h.mataPelajaran));
      tr.appendChild(makeTd(h.tanggal || '-', 'tabular-nums'));
      tr.appendChild(makeTd(String(h.benar) + ' / ' + String(h.totalSoal), 'text-end tabular-nums'));
      tr.appendChild(makeTd(global.TKA_API.formatScore(h.nilai), 'text-end fw-bold tabular-nums'));
      tr.appendChild(makeTd(h.sumberId + ' (Baris ' + h.sourceRow + ')', 'small text-secondary tabular-nums'));
      tbody.appendChild(tr);
    });
  }

  async function handleSync() {
    try {
      var res = await global.TKA_API.apiCall('sinkronkanDataTryout', {}, {
        loadingText: 'Menyinkronkan seluruh sumber tryout...'
      });

      renderSyncBanner(res);
      var r = res.ringkasan || {};
      global.TKA_API.showToast(
        res.message + ' (Baru: ' + (r.totalInserted || 0) + ', Update: ' + (r.totalUpdated || 0) + ')',
        (r.sumberGagal || 0) > 0 ? 'warning' : 'success'
      );

      var user = global.TKA_AUTH.getUser();
      await loadTryoutPageData(user);
    } catch (err) {
      global.TKA_API.showToast('Sinkronisasi gagal: ' + err.message, 'error');
    }
  }

  function renderSyncBanner(res) {
    var box = document.getElementById('tryoutSyncReportBox');
    var listEl = document.getElementById('tryoutSyncReportList');
    if (!box || !listEl) return;

    box.classList.remove('d-none');
    listEl.innerHTML = '';

    (res.laporanPerSumber || []).forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'mb-1';
      li.textContent = item.namaTryout + ' (' + item.mataPelajaran + '): ' + item.status +
        ' · Baru: ' + (item.inserted || 0) +
        ' · Diperbarui: ' + (item.updated || 0) +
        ' · ' + (item.pesan || '');
      listEl.appendChild(li);
    });
  }

  async function handleTambahSumber(ev) {
    ev.preventDefault();
    var payload = {
      mataPelajaran: document.getElementById('addSumberMapel').value,
      namaTryout: document.getElementById('addSumberNama').value.trim(),
      spreadsheetId: document.getElementById('addSumberSpreadsheetId').value.trim(),
      sheetGid: document.getElementById('addSumberGid').value.trim()
    };

    if (!payload.namaTryout || !payload.spreadsheetId || !payload.sheetGid) {
      global.TKA_API.showToast('Semua kolom sumber tryout wajib diisi.', 'warning');
      return;
    }

    try {
      var res = await global.TKA_API.apiCall('tambahSumberTryout', payload, {
        loadingText: 'Menyimpan sumber tryout...'
      });
      global.TKA_API.showToast(res.message, 'success');
      ev.target.reset();
      var modalEl = document.getElementById('modalTambahSumber');
      var inst = modalEl && global.bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
      await loadTryoutPageData(global.TKA_AUTH.getUser());
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  async function handleToggleSumber(sumberId, statusBaru) {
    try {
      var res = await global.TKA_API.apiCall('toggleStatusSumber', {
        sumberId: sumberId,
        status: statusBaru
      }, { loadingText: 'Memperbarui status sumber...' });
      global.TKA_API.showToast(res.message, 'success');
      await loadTryoutPageData(global.TKA_AUTH.getUser());
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

  document.addEventListener('DOMContentLoaded', initTryoutPage);
})(window);
