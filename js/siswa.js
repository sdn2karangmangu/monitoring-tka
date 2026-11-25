/**
 * Logika Halaman siswa.html (Manajemen & Verifikasi Siswa) dan detail-siswa.html
 */
(function (global) {
  'use strict';

  var allSiswaCache = [];
  var detailCharts = {};
  var activeDetailSiswaId = '';

  function destroyDetailChart(key) {
    if (detailCharts[key]) {
      detailCharts[key].destroy();
      detailCharts[key] = null;
    }
  }

  /* ========================================================================
   * HALAMAN DATA SISWA (siswa.html)
   * ======================================================================== */
  async function initSiswaListPage() {
    var user = global.TKA_AUTH.requireAuth({
      pageTitle: 'Manajemen Data Siswa Kelas VI',
      activeNav: 'siswa',
      allowedRoles: ['admin', 'guru']
    });
    if (!user) return;

    var searchEl = document.getElementById('siswaSearchInput');
    var statusEl = document.getElementById('siswaStatusFilter');
    if (searchEl) searchEl.addEventListener('input', renderSiswaTable);
    if (statusEl) statusEl.addEventListener('change', renderSiswaTable);

    var formTambah = document.getElementById('formTambahSiswa');
    if (formTambah) formTambah.addEventListener('submit', handleTambahSiswa);

    var formEdit = document.getElementById('formEditSiswa');
    if (formEdit) formEdit.addEventListener('submit', handleEditSiswa);

    await fetchSiswaList();
  }

  async function fetchSiswaList() {
    try {
      var res = await global.TKA_API.apiCall('getSiswa', {}, { loadingText: 'Memuat daftar siswa...' });
      allSiswaCache = res.siswa || [];
      renderSiswaSummary(allSiswaCache);
      renderSiswaTable();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function renderSiswaSummary(list) {
    var total = list.length;
    var aktif = list.filter(function (s) { return s.status === 'Aktif'; }).length;
    var perluVerif = list.filter(function (s) { return s.status === 'Perlu Verifikasi'; }).length;
    setText('siswaCountTotal', String(total));
    setText('siswaCountAktif', String(aktif));
    setText('siswaCountVerifikasi', String(perluVerif));
  }

  function renderSiswaTable() {
    var q = (document.getElementById('siswaSearchInput')?.value || '').trim().toLowerCase();
    var statusFilter = document.getElementById('siswaStatusFilter')?.value || '';

    var filtered = allSiswaCache.filter(function (s) {
      if (q) {
        var hit = s.nama.toLowerCase().indexOf(q) !== -1 || s.nis.toLowerCase().indexOf(q) !== -1;
        if (!hit) return false;
      }
      if (statusFilter && s.status !== statusFilter) return false;
      return true;
    });

    var tbody = document.getElementById('siswaTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      var trEmpty = document.createElement('tr');
      var tdEmpty = document.createElement('td');
      tdEmpty.colSpan = 7;
      tdEmpty.className = 'text-center py-4 text-secondary';
      tdEmpty.textContent = 'Belum ada data siswa yang cocok.';
      trEmpty.appendChild(tdEmpty);
      tbody.appendChild(trEmpty);
      return;
    }

    filtered.forEach(function (s) {
      var tr = document.createElement('tr');
      tr.appendChild(makeTd(s.nis, 'tabular-nums fw-semibold'));

      var tdNama = document.createElement('td');
      var link = document.createElement('a');
      link.href = 'detail-siswa.html?siswaId=' + encodeURIComponent(s.siswaId);
      link.className = 'fw-semibold text-decoration-none';
      link.textContent = s.nama;
      tdNama.appendChild(link);
      tr.appendChild(tdNama);

      tr.appendChild(makeTd(s.kelas || '-'));
      tr.appendChild(makeTd(s.jenisKelamin || '-'));
      tr.appendChild(makeTd(s.namaOrangTua || '-'));

      var statusCls = s.status === 'Aktif' ? 'status-success' : (s.status === 'Perlu Verifikasi' ? 'status-warning' : 'status-danger');
      tr.appendChild(makeTd(s.status, 'fw-semibold ' + statusCls));

      var tdAksi = document.createElement('td');
      tdAksi.className = 'text-end text-nowrap';

      var btnDetail = document.createElement('a');
      btnDetail.href = 'detail-siswa.html?siswaId=' + encodeURIComponent(s.siswaId);
      btnDetail.className = 'btn btn-sm btn-outline-primary me-1';
      btnDetail.textContent = 'Detail';

      var btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-sm btn-outline-secondary';
      btnEdit.textContent = s.status === 'Perlu Verifikasi' ? 'Verifikasi' : 'Edit';
      btnEdit.addEventListener('click', function () {
        openEditSiswaModal(s);
      });

      tdAksi.appendChild(btnDetail);
      tdAksi.appendChild(btnEdit);
      tr.appendChild(tdAksi);
      tbody.appendChild(tr);
    });
  }

  async function handleTambahSiswa(ev) {
    ev.preventDefault();
    var nis = document.getElementById('addSiswaNis').value.trim();
    var nama = document.getElementById('addSiswaNama').value.trim();
    var jk = document.getElementById('addSiswaJk').value;
    var kelas = document.getElementById('addSiswaKelas').value.trim() || 'VI';
    var ortu = document.getElementById('addSiswaOrtu').value.trim();
    var hp = document.getElementById('addSiswaHp').value.trim();

    if (!nis || !nama) {
      global.TKA_API.showToast('NIS dan Nama Siswa wajib diisi.', 'warning');
      return;
    }

    try {
      var res = await global.TKA_API.apiCall('tambahSiswa', {
        nis: nis,
        nama: nama,
        jenisKelamin: jk,
        kelas: kelas,
        namaOrangTua: ortu,
        noHpOrangTua: hp,
        status: 'Aktif'
      }, { loadingText: 'Menyimpan data siswa...' });

      global.TKA_API.showToast(res.message, 'success');
      ev.target.reset();
      var modalEl = document.getElementById('modalTambahSiswa');
      var inst = modalEl && global.bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
      await fetchSiswaList();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function openEditSiswaModal(s) {
    document.getElementById('editSiswaId').value = s.siswaId;
    document.getElementById('editSiswaNis').value = s.nis;
    document.getElementById('editSiswaNama').value = s.nama;
    document.getElementById('editSiswaJk').value = s.jenisKelamin || '';
    document.getElementById('editSiswaKelas').value = s.kelas || 'VI';
    document.getElementById('editSiswaOrtu').value = s.namaOrangTua || '';
    document.getElementById('editSiswaHp').value = s.noHpOrangTua || '';
    document.getElementById('editSiswaStatus').value = s.status === 'Perlu Verifikasi' ? 'Aktif' : s.status;

    var modal = new global.bootstrap.Modal(document.getElementById('modalEditSiswa'));
    modal.show();
  }

  async function handleEditSiswa(ev) {
    ev.preventDefault();
    var payload = {
      siswaId: document.getElementById('editSiswaId').value,
      nisBaru: document.getElementById('editSiswaNis').value.trim(),
      nama: document.getElementById('editSiswaNama').value.trim(),
      jenisKelamin: document.getElementById('editSiswaJk').value,
      kelas: document.getElementById('editSiswaKelas').value.trim() || 'VI',
      namaOrangTua: document.getElementById('editSiswaOrtu').value.trim(),
      noHpOrangTua: document.getElementById('editSiswaHp').value.trim(),
      status: document.getElementById('editSiswaStatus').value
    };

    if (!payload.nisBaru || !payload.nama) {
      global.TKA_API.showToast('NIS dan Nama Siswa tidak boleh kosong.', 'warning');
      return;
    }

    try {
      var res = await global.TKA_API.apiCall('validasiDataSiswa', payload, {
        loadingText: 'Memperbarui data siswa...'
      });
      global.TKA_API.showToast(res.message, 'success');
      var modalEl = document.getElementById('modalEditSiswa');
      var inst = modalEl && global.bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
      await fetchSiswaList();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  /* ========================================================================
   * HALAMAN DETAIL PERKEMBANGAN SISWA (detail-siswa.html)
   * ======================================================================== */
  async function initDetailSiswaPage() {
    var user = global.TKA_AUTH.requireAuth({
      pageTitle: 'Detail Perkembangan Siswa',
      activeNav: userNavForDetail(),
      allowedRoles: ['admin', 'guru', 'wali']
    });
    if (!user) return;

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('siswaId') || '';

    var formCatatan = document.getElementById('formTambahCatatan');
    var cardTambahCatatan = document.getElementById('cardFormCatatanGuru');
    if (user.role === 'wali' && cardTambahCatatan) {
      cardTambahCatatan.classList.add('d-none');
    } else if (formCatatan) {
      formCatatan.addEventListener('submit', handleTambahCatatan);
    }

    await loadDetailSiswa(requestedId, user);
  }

  function userNavForDetail() {
    var u = global.TKA_AUTH.getUser();
    return u && u.role === 'wali' ? 'dashboard' : 'siswa';
  }

  async function loadDetailSiswa(requestedId, user) {
    try {
      var res = await global.TKA_API.apiCall('getDetailSiswa', {
        siswaId: requestedId
      }, { loadingText: 'Memuat detail perkembangan siswa...' });

      var s = res.siswa || {};
      activeDetailSiswaId = s.siswaId || requestedId;

      setText('detailNamaSiswa', s.nama || '-');
      setText('detailNisSiswa', s.nis || '-');
      setText('detailKelasSiswa', s.kelas || '-');
      setText('detailOrtuSiswa', s.namaOrangTua || '-');

      var btnLaporan = document.getElementById('btnBukaLaporanSiswa');
      if (btnLaporan) {
        btnLaporan.href = user.role === 'wali'
          ? 'laporan.html'
          : 'laporan.html?siswaId=' + encodeURIComponent(activeDetailSiswaId);
      }

      // Rekap Bahasa Indonesia
      var bi = res.rekapBI || {};
      setText('detailBiTo1', global.TKA_API.formatScore(bi.to1));
      setText('detailBiTo2', global.TKA_API.formatScore(bi.to2));
      setText('detailBiRata', global.TKA_API.formatScore(bi.rataRata));
      setText('detailBiTertinggi', global.TKA_API.formatScore(bi.tertinggi));
      setText('detailBiTerendah', global.TKA_API.formatScore(bi.terendah));
      setDeltaText('detailBiPerubahan', bi.perubahan);

      // Rekap Matematika
      var mtk = res.rekapMTK || {};
      setText('detailMtkTo1', global.TKA_API.formatScore(mtk.to1));
      setText('detailMtkTo2', global.TKA_API.formatScore(mtk.to2));
      setText('detailMtkRata', global.TKA_API.formatScore(mtk.rataRata));
      setText('detailMtkTertinggi', global.TKA_API.formatScore(mtk.tertinggi));
      setText('detailMtkTerendah', global.TKA_API.formatScore(mtk.terendah));
      setDeltaText('detailMtkPerubahan', mtk.perubahan);

      renderDetailCharts(bi, mtk);
      renderEvaluasiSection(res.evaluasi || {});
      renderCatatanList(res.catatanGuru || [], user.role);
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function renderDetailCharts(bi, mtk) {
    if (!global.Chart) return;
    var baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(148,163,184,0.18)' }, ticks: { color: '#64748b' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } }
      }
    };

    destroyDetailChart('bi');
    var ctxBi = document.getElementById('chartDetailBI');
    if (ctxBi) {
      detailCharts.bi = new global.Chart(ctxBi, {
        type: 'line',
        data: {
          labels: ['Tryout 1', 'Tryout 2'],
          datasets: [{
            label: 'Bahasa Indonesia',
            data: [bi.to1, bi.to2],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.14)',
            fill: true,
            tension: 0.25,
            pointRadius: 5
          }]
        },
        options: baseOpts
      });
    }

    destroyDetailChart('mtk');
    var ctxMtk = document.getElementById('chartDetailMTK');
    if (ctxMtk) {
      detailCharts.mtk = new global.Chart(ctxMtk, {
        type: 'line',
        data: {
          labels: ['Tryout 1', 'Tryout 2'],
          datasets: [{
            label: 'Matematika',
            data: [mtk.to1, mtk.to2],
            borderColor: '#0f294a',
            backgroundColor: 'rgba(15,41,74,0.14)',
            fill: true,
            tension: 0.25,
            pointRadius: 5
          }]
        },
        options: baseOpts
      });
    }

    destroyDetailChart('compare');
    var ctxCompare = document.getElementById('chartDetailCompare');
    if (ctxCompare) {
      detailCharts.compare = new global.Chart(ctxCompare, {
        type: 'bar',
        data: {
          labels: ['Tryout 1', 'Tryout 2', 'Rata-rata'],
          datasets: [
            {
              label: 'Bahasa Indonesia',
              data: [bi.to1 ?? 0, bi.to2 ?? 0, bi.rataRata ?? 0],
              backgroundColor: '#2563eb',
              borderRadius: 6
            },
            {
              label: 'Matematika',
              data: [mtk.to1 ?? 0, mtk.to2 ?? 0, mtk.rataRata ?? 0],
              backgroundColor: '#0f294a',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#64748b' } } },
          scales: {
            y: { beginAtZero: true, max: 100, grid: { color: 'rgba(148,163,184,0.18)' }, ticks: { color: '#64748b' } },
            x: { grid: { display: false }, ticks: { color: '#64748b' } }
          }
        }
      });
    }
  }

  function renderEvaluasiSection(evalObj) {
    var ulPlus = document.getElementById('detailKelebihanList');
    var ulMin = document.getElementById('detailTingkatkanList');
    var noteMateri = document.getElementById('detailCatatanMateriInfo');

    if (noteMateri) {
      noteMateri.textContent = evalObj.catatanDataMateri || '';
      noteMateri.classList.toggle('d-none', !evalObj.catatanDataMateri);
    }

    if (ulPlus) {
      ulPlus.innerHTML = '';
      var plus = evalObj.kelebihan || [];
      if (plus.length === 0) {
        var li = document.createElement('li');
        li.className = 'text-secondary';
        li.textContent = 'Belum ada indikator kelebihan yang dapat disimpulkan dari data tryout.';
        ulPlus.appendChild(li);
      } else {
        plus.forEach(function (t) {
          var li = document.createElement('li');
          li.textContent = t;
          ulPlus.appendChild(li);
        });
      }
    }

    if (ulMin) {
      ulMin.innerHTML = '';
      var min = evalObj.perluDitingkatkan || [];
      if (min.length === 0) {
        var li = document.createElement('li');
        li.className = 'text-secondary';
        li.textContent = 'Tidak ada catatan kekurangan signifikan berdasarkan skor saat ini.';
        ulMin.appendChild(li);
      } else {
        min.forEach(function (t) {
          var li = document.createElement('li');
          li.textContent = t;
          ulMin.appendChild(li);
        });
      }
    }
  }

  function renderCatatanList(list, role) {
    var container = document.getElementById('detailCatatanList');
    if (!container) return;
    container.innerHTML = '';

    if (list.length === 0) {
      var p = document.createElement('p');
      p.className = 'text-secondary mb-0 small';
      p.textContent = 'Belum ada catatan guru untuk siswa ini.';
      container.appendChild(p);
      return;
    }

    list.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'py-3 border-bottom';

      var topRow = document.createElement('div');
      topRow.className = 'd-flex justify-content-between align-items-start gap-2';

      var meta = document.createElement('div');
      meta.className = 'small text-secondary';
      meta.textContent = (c.guru || 'Guru') + ' · ' + (c.namaTryout || 'Umum') + ' · ' + (c.tanggal || '');
      topRow.appendChild(meta);

      if (role === 'admin' || role === 'guru') {
        var btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn btn-sm btn-link text-danger p-0 text-decoration-none';
        btnDel.textContent = 'Hapus';
        btnDel.addEventListener('click', function () {
          handleHapusCatatan(c.catatanId);
        });
        topRow.appendChild(btnDel);
      }

      var textCatatan = document.createElement('div');
      textCatatan.className = 'mt-1 fw-medium';
      textCatatan.textContent = c.catatan;

      card.appendChild(topRow);
      card.appendChild(textCatatan);

      if (c.rekomendasi) {
        var rek = document.createElement('div');
        rek.className = 'small text-primary mt-1';
        rek.textContent = 'Rekomendasi latihan: ' + c.rekomendasi;
        card.appendChild(rek);
      }

      container.appendChild(card);
    });
  }

  async function handleTambahCatatan(ev) {
    ev.preventDefault();
    var tryoutId = document.getElementById('catatanTryoutSelect').value;
    var catatan = document.getElementById('catatanIsi').value.trim();
    var rekomendasi = document.getElementById('catatanRekomendasi').value.trim();

    if (!catatan) {
      global.TKA_API.showToast('Isi catatan guru wajib diisi.', 'warning');
      return;
    }

    try {
      var res = await global.TKA_API.apiCall('tambahCatatanGuru', {
        siswaId: activeDetailSiswaId,
        tryoutId: tryoutId,
        catatan: catatan,
        rekomendasi: rekomendasi
      }, { loadingText: 'Menyimpan catatan guru...' });

      global.TKA_API.showToast(res.message, 'success');
      ev.target.reset();
      var user = global.TKA_AUTH.getUser();
      await loadDetailSiswa(activeDetailSiswaId, user);
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  async function handleHapusCatatan(catatanId) {
    try {
      var res = await global.TKA_API.apiCall('hapusCatatanGuru', { catatanId: catatanId }, {
        loadingText: 'Menghapus catatan...'
      });
      global.TKA_API.showToast(res.message, 'success');
      var user = global.TKA_AUTH.getUser();
      await loadDetailSiswa(activeDetailSiswaId, user);
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function setDeltaText(id, delta) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('status-success', 'status-danger', 'status-muted');
    if (delta === null || delta === undefined) {
      el.textContent = '-';
      el.classList.add('status-muted');
    } else if (delta > 0) {
      el.textContent = '+' + delta;
      el.classList.add('status-success');
    } else if (delta < 0) {
      el.textContent = String(delta);
      el.classList.add('status-danger');
    } else {
      el.textContent = '0';
    }
  }

  function makeTd(text, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    if (page === 'siswa') {
      initSiswaListPage();
    } else if (page === 'detail-siswa') {
      initDetailSiswaPage();
    }
  });
})(window);
