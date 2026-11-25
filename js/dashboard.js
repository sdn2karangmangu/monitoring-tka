/**
 * Logika Halaman dashboard.html (Dashboard Admin/Guru & Portal Wali Murid)
 */
(function (global) {
  'use strict';

  var charts = {};
  var cachedRekapData = null;

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  async function initDashboard() {
    var user = global.TKA_AUTH.requireAuth({
      pageTitle: 'Dashboard Monitoring TKA',
      activeNav: 'dashboard',
      allowedRoles: ['admin', 'guru', 'wali']
    });
    if (!user) return;

    if (user.role === 'wali') {
      var titleEl = document.getElementById('topbarPageTitle');
      if (titleEl) titleEl.textContent = 'Portal Perkembangan Anak';
      await loadWaliPortal(user);
    } else {
      await loadAdminGuruDashboard();
    }
  }

  /* ========================================================================
   * DASHBOARD ADMIN & GURU
   * ======================================================================== */
  async function loadAdminGuruDashboard() {
    var adminView = document.getElementById('adminGuruDashboardView');
    var waliView = document.getElementById('waliPortalView');
    if (adminView) adminView.classList.remove('d-none');
    if (waliView) waliView.classList.add('d-none');

    var btnSync = document.getElementById('btnSyncTryout');
    if (btnSync) {
      btnSync.addEventListener('click', handleManualSync);
    }

    var searchInput = document.getElementById('dashSearchInput');
    var filterKelas = document.getElementById('dashFilterKelas');
    var filterMapel = document.getElementById('dashFilterMapel');
    var sortSelect = document.getElementById('dashSortSelect');

    [searchInput, filterKelas, filterMapel, sortSelect].forEach(function (el) {
      if (!el) return;
      var evt = el.tagName === 'INPUT' ? 'input' : 'change';
      el.addEventListener(evt, function () {
        renderAdminTableFromFilter();
      });
    });

    await fetchAndRenderAdminData();
  }

  async function fetchAndRenderAdminData() {
    try {
      var res = await global.TKA_API.apiCall('getRekapNilai', {}, {
        loadingText: 'Memuat data dashboard TKA...'
      });
      cachedRekapData = res;
      renderAdminStats(res.ringkasan);
      populateKelasFilter(res.kelasList || []);
      renderAdminCharts(res);
      renderAdminTableFromFilter();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function renderAdminStats(ringkasan) {
    var r = ringkasan || {};
    setText('statTotalSiswa', r.totalSiswa ?? 0);
    setText('statTotalTryout', r.totalTryout ?? 0);
    setText('statSiswaSudah', r.siswaSudahTryout ?? 0);
    setText('statRataBI', global.TKA_API.formatScore(r.rataRataBahasaIndonesia));
    setText('statRataMTK', global.TKA_API.formatScore(r.rataRataMatematika));
    setText('statRataGlobal', global.TKA_API.formatScore(r.rataRataKeseluruhan));
    setText('statTertinggi', global.TKA_API.formatScore(r.nilaiTertinggi));
    setText('statTerendah', global.TKA_API.formatScore(r.nilaiTerendah));
  }

  function populateKelasFilter(kelasList) {
    var select = document.getElementById('dashFilterKelas');
    if (!select) return;
    var current = select.value;
    select.innerHTML = '<option value="">Semua Kelas</option>';
    kelasList.forEach(function (kls) {
      var opt = document.createElement('option');
      opt.value = kls;
      opt.textContent = kls;
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  function renderAdminTableFromFilter() {
    if (!cachedRekapData) return;
    var rows = (cachedRekapData.rekap || []).slice();
    var q = (document.getElementById('dashSearchInput')?.value || '').trim().toLowerCase();
    var kelas = (document.getElementById('dashFilterKelas')?.value || '').trim().toLowerCase();
    var mapel = document.getElementById('dashFilterMapel')?.value || '';
    var sortBy = document.getElementById('dashSortSelect')?.value || 'nama';

    var filtered = rows.filter(function (row) {
      if (q) {
        var hit = row.nama.toLowerCase().indexOf(q) !== -1 || row.nis.toLowerCase().indexOf(q) !== -1;
        if (!hit) return false;
      }
      if (kelas && row.kelas.toLowerCase() !== kelas) return false;
      return true;
    }).map(function (row) {
      var avg = row.rataRata;
      if (mapel === 'Bahasa Indonesia') avg = row.rataBI;
      else if (mapel === 'Matematika') avg = row.rataMTK;
      return Object.assign({}, row, { activeRataRata: avg });
    });

    filtered.sort(function (a, b) {
      if (sortBy === 'rataRataDesc') {
        return (b.activeRataRata ?? -Infinity) - (a.activeRataRata ?? -Infinity);
      }
      if (sortBy === 'rataRataAsc') {
        return (a.activeRataRata ?? Infinity) - (b.activeRataRata ?? Infinity);
      }
      return a.nama.localeCompare(b.nama, 'id');
    });

    var tbody = document.getElementById('dashRekapTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      var emptyTr = document.createElement('tr');
      var emptyTd = document.createElement('td');
      emptyTd.colSpan = 9;
      emptyTd.className = 'text-center py-4 text-secondary';
      emptyTd.textContent = 'Belum ada data siswa atau hasil tryout yang sesuai filter.';
      emptyTr.appendChild(emptyTd);
      tbody.appendChild(emptyTr);
      return;
    }

    filtered.forEach(function (row) {
      var tr = document.createElement('tr');

      var tdNama = document.createElement('td');
      var link = document.createElement('a');
      link.href = 'detail-siswa.html?siswaId=' + encodeURIComponent(row.siswaId);
      link.className = 'fw-semibold text-decoration-none';
      link.textContent = row.nama;
      tdNama.appendChild(link);
      tr.appendChild(tdNama);

      tr.appendChild(createCell(row.nis, 'tabular-nums'));
      tr.appendChild(createCell(row.kelas));
      tr.appendChild(createCell(global.TKA_API.formatScore(row.bi1), 'text-end tabular-nums'));
      tr.appendChild(createCell(global.TKA_API.formatScore(row.bi2), 'text-end tabular-nums'));
      tr.appendChild(createCell(global.TKA_API.formatScore(row.mtk1), 'text-end tabular-nums'));
      tr.appendChild(createCell(global.TKA_API.formatScore(row.mtk2), 'text-end tabular-nums'));
      tr.appendChild(createCell(global.TKA_API.formatScore(row.activeRataRata), 'text-end fw-bold tabular-nums'));

      var tdProg = document.createElement('td');
      tdProg.className = 'text-end tabular-nums';
      if (row.progress === null || row.progress === undefined) {
        tdProg.textContent = '-';
        tdProg.classList.add('status-muted');
      } else if (row.progress > 0) {
        tdProg.textContent = '+' + row.progress;
        tdProg.classList.add('status-success', 'fw-semibold');
      } else if (row.progress < 0) {
        tdProg.textContent = String(row.progress);
        tdProg.classList.add('status-danger', 'fw-semibold');
      } else {
        tdProg.textContent = '0';
      }
      tr.appendChild(tdProg);

      tbody.appendChild(tr);
    });
  }

  function renderAdminCharts(res) {
    if (!global.Chart) return;
    var perTryout = res.perTryout || [];
    var biItems = perTryout.filter(function (x) { return x.mataPelajaran === 'Bahasa Indonesia'; });
    var mtkItems = perTryout.filter(function (x) { return x.mataPelajaran === 'Matematika'; });

    var commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(148,163,184,0.18)' }, ticks: { color: '#64748b' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } }
      }
    };

    // 1. Grafik Rata-rata Bahasa Indonesia per Tryout
    destroyChart('bi');
    var ctxBi = document.getElementById('chartDashBI');
    if (ctxBi) {
      charts.bi = new global.Chart(ctxBi, {
        type: 'bar',
        data: {
          labels: biItems.map(function (i) { return i.namaTryout; }),
          datasets: [{
            label: 'Rata-rata Bahasa Indonesia',
            data: biItems.map(function (i) { return i.rataRata ?? 0; }),
            backgroundColor: '#2563eb',
            borderRadius: 6
          }]
        },
        options: commonOptions
      });
    }

    // 2. Grafik Rata-rata Matematika per Tryout
    destroyChart('mtk');
    var ctxMtk = document.getElementById('chartDashMTK');
    if (ctxMtk) {
      charts.mtk = new global.Chart(ctxMtk, {
        type: 'bar',
        data: {
          labels: mtkItems.map(function (i) { return i.namaTryout; }),
          datasets: [{
            label: 'Rata-rata Matematika',
            data: mtkItems.map(function (i) { return i.rataRata ?? 0; }),
            backgroundColor: '#0f294a',
            borderRadius: 6
          }]
        },
        options: commonOptions
      });
    }

    // 3. Grafik Perkembangan Rata-rata Kelas
    destroyChart('trend');
    var ctxTrend = document.getElementById('chartDashTrend');
    if (ctxTrend) {
      charts.trend = new global.Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: perTryout.map(function (i) { return i.namaTryout; }),
          datasets: [{
            label: 'Rata-rata Kelas',
            data: perTryout.map(function (i) { return i.rataRata ?? null; }),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.14)',
            tension: 0.25,
            fill: true,
            pointRadius: 5
          }]
        },
        options: commonOptions
      });
    }

    // 4. Grafik Distribusi Kategori Nilai
    destroyChart('dist');
    var ctxDist = document.getElementById('chartDashDistribusi');
    var dist = res.distribusiKategori || { sangatBaik: 0, baik: 0, cukup: 0, perluBimbingan: 0 };
    if (ctxDist) {
      charts.dist = new global.Chart(ctxDist, {
        type: 'doughnut',
        data: {
          labels: ['Sangat Baik (90-100)', 'Baik (75-89)', 'Cukup (60-74)', 'Perlu Bimbingan (<60)'],
          datasets: [{
            data: [dist.sangatBaik, dist.baik, dist.cukup, dist.perluBimbingan],
            backgroundColor: ['#16a34a', '#2563eb', '#d97706', '#dc2626'],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#64748b', boxWidth: 12 } }
          }
        }
      });
    }
  }

  async function handleManualSync() {
    try {
      var res = await global.TKA_API.apiCall('sinkronkanDataTryout', {}, {
        loadingText: 'Menyinkronkan 4 spreadsheet sumber...'
      });

      var r = res.ringkasan || {};
      var msg = (res.message || 'Sinkronisasi selesai.') +
        ' Baru: ' + (r.totalInserted || 0) +
        ', Diperbarui: ' + (r.totalUpdated || 0) +
        ', Sumber gagal: ' + (r.sumberGagal || 0);

      global.TKA_API.showToast(msg, (r.sumberGagal || 0) > 0 ? 'warning' : 'success');
      showSyncReportModal(res);
      await fetchAndRenderAdminData();
    } catch (err) {
      global.TKA_API.showToast('Sinkronisasi gagal: ' + err.message, 'error');
    }
  }

  function showSyncReportModal(res) {
    var bodyEl = document.getElementById('syncReportModalBody');
    var modalEl = document.getElementById('modalSyncReport');
    if (!bodyEl || !modalEl) return;

    bodyEl.innerHTML = '';
    var r = res.ringkasan || {};
    var summaryP = document.createElement('p');
    summaryP.className = 'mb-3 small text-secondary';
    summaryP.textContent = 'Waktu sinkronisasi: ' + (res.syncedAt || '-') +
      ' · Baru: ' + (r.totalInserted || 0) +
      ' · Diperbarui: ' + (r.totalUpdated || 0) +
      ' · Tidak berubah: ' + (r.totalUnchanged || 0) +
      ' · Siswa baru (Perlu Verifikasi): ' + (r.totalNewSiswaPerluVerifikasi || 0);
    bodyEl.appendChild(summaryP);

    var tableWrap = document.createElement('div');
    tableWrap.className = 'table-responsive';
    var table = document.createElement('table');
    table.className = 'table table-clean';
    table.innerHTML = '<thead><tr><th>Sumber</th><th>Mapel</th><th>Status</th><th class="text-end">Baru</th><th class="text-end">Update</th><th>Keterangan</th></tr></thead>';
    var tb = document.createElement('tbody');

    (res.laporanPerSumber || []).forEach(function (item) {
      var tr = document.createElement('tr');
      tr.appendChild(createCell(item.namaTryout));
      tr.appendChild(createCell(item.mataPelajaran));
      var statusClass = item.status === 'Berhasil' ? 'status-success' : (item.status === 'Gagal' ? 'status-danger' : 'status-warning');
      tr.appendChild(createCell(item.status, 'fw-semibold ' + statusClass));
      tr.appendChild(createCell(String(item.inserted || 0), 'text-end tabular-nums'));
      tr.appendChild(createCell(String(item.updated || 0), 'text-end tabular-nums'));
      tr.appendChild(createCell(item.pesan || '-'));
      tb.appendChild(tr);
    });

    table.appendChild(tb);
    tableWrap.appendChild(table);
    bodyEl.appendChild(tableWrap);

    var modal = new global.bootstrap.Modal(modalEl);
    modal.show();
  }

  /* ========================================================================
   * PORTAL WALI MURID (MOBILE-FRIENDLY & TERISOLASI PER SISWA)
   * ======================================================================== */
  async function loadWaliPortal(user) {
    var adminView = document.getElementById('adminGuruDashboardView');
    var waliView = document.getElementById('waliPortalView');
    if (adminView) adminView.classList.add('d-none');
    if (waliView) waliView.classList.remove('d-none');

    setText('waliWelcomeName', user.nama || user.username);

    try {
      var res = await global.TKA_API.apiCall('getPortalWali', {}, {
        loadingText: 'Memuat data perkembangan anak...'
      });

      var siswa = res.siswa || {};
      var stats = res.statistik || {};
      var evalObj = res.evaluasi || {};

      setText('waliAnakNama', siswa.nama || '-');
      setText('waliAnakNis', siswa.nis || '-');
      setText('waliAnakKelas', siswa.kelas || '-');

      setText('waliStatBI', global.TKA_API.formatScore(stats.rataRataBI));
      setText('waliStatMTK', global.TKA_API.formatScore(stats.rataRataMTK));
      setText('waliStatTotal', global.TKA_API.formatScore(stats.rataRataKeseluruhan));
      setText('waliStatJumlah', String(stats.jumlahTryoutDiikuti ?? 0));

      renderWaliRiwayat(res.riwayatTryout || []);
      renderWaliCharts(res.rekapBI || {}, res.rekapMTK || {});
      renderWaliEvaluasi(evalObj, res.catatanGuru || []);
    } catch (err) {
      var errBox = document.getElementById('waliErrorBanner');
      if (errBox) {
        errBox.textContent = err.message;
        errBox.classList.remove('d-none');
      }
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function renderWaliRiwayat(riwayat) {
    var tbody = document.getElementById('waliRiwayatTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (riwayat.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'text-center py-4 text-secondary';
      td.textContent = 'Belum ada riwayat hasil tryout untuk anak Anda.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    riwayat.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.appendChild(createCell(item.namaTryout, 'fw-semibold'));
      tr.appendChild(createCell(item.tanggal || '-', 'tabular-nums'));
      tr.appendChild(createCell(item.mataPelajaran));
      tr.appendChild(createCell(String(item.benar ?? 0), 'text-end tabular-nums'));
      tr.appendChild(createCell(String(item.totalSoal ?? 0), 'text-end tabular-nums'));
      tr.appendChild(createCell(global.TKA_API.formatScore(item.nilai), 'text-end fw-bold tabular-nums'));
      tbody.appendChild(tr);
    });
  }

  function renderWaliCharts(rekapBI, rekapMTK) {
    if (!global.Chart) return;
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(148,163,184,0.18)' }, ticks: { color: '#64748b' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } }
      }
    };

    destroyChart('waliBI');
    var ctxBi = document.getElementById('chartWaliBI');
    if (ctxBi) {
      charts.waliBI = new global.Chart(ctxBi, {
        type: 'line',
        data: {
          labels: ['Tryout 1', 'Tryout 2'],
          datasets: [{
            label: 'Bahasa Indonesia',
            data: [rekapBI.to1, rekapBI.to2],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.14)',
            fill: true,
            tension: 0.25,
            pointRadius: 5,
            spanGaps: false
          }]
        },
        options: opts
      });
    }

    destroyChart('waliMTK');
    var ctxMtk = document.getElementById('chartWaliMTK');
    if (ctxMtk) {
      charts.waliMTK = new global.Chart(ctxMtk, {
        type: 'line',
        data: {
          labels: ['Tryout 1', 'Tryout 2'],
          datasets: [{
            label: 'Matematika',
            data: [rekapMTK.to1, rekapMTK.to2],
            borderColor: '#0f294a',
            backgroundColor: 'rgba(15, 41, 74, 0.14)',
            fill: true,
            tension: 0.25,
            pointRadius: 5,
            spanGaps: false
          }]
        },
        options: opts
      });
    }
  }

  function renderWaliEvaluasi(evalObj, catatanList) {
    setText('waliEvalRingkasan', evalObj.ringkasanPerkembangan || '-');
    setText('waliEvalMapelUnggul', evalObj.mataPelajaranLebihBaik || '-');

    var listTingkatkan = document.getElementById('waliEvalTingkatkan');
    if (listTingkatkan) {
      listTingkatkan.innerHTML = '';
      var items = evalObj.perluDitingkatkan || [];
      if (items.length === 0) {
        var li = document.createElement('li');
        li.textContent = 'Pertahankan konsistensi belajar anak secara rutin.';
        listTingkatkan.appendChild(li);
      } else {
        items.forEach(function (txt) {
          var li = document.createElement('li');
          li.textContent = txt;
          listTingkatkan.appendChild(li);
        });
      }
    }

    var catatanBox = document.getElementById('waliCatatanGuruList');
    if (catatanBox) {
      catatanBox.innerHTML = '';
      if (catatanList.length === 0) {
        var p = document.createElement('p');
        p.className = 'text-secondary mb-0 small';
        p.textContent = 'Belum ada catatan khusus dari guru.';
        catatanBox.appendChild(p);
      } else {
        catatanList.forEach(function (c) {
          var itemDiv = document.createElement('div');
          itemDiv.className = 'py-2 border-bottom';
          var head = document.createElement('div');
          head.className = 'small text-secondary mb-1';
          head.textContent = (c.guru || 'Guru') + ' · ' + (c.namaTryout || 'Umum') + ' · ' + (c.tanggal || '');
          var body = document.createElement('div');
          body.className = 'fw-medium';
          body.textContent = c.catatan;
          itemDiv.appendChild(head);
          itemDiv.appendChild(body);
          if (c.rekomendasi) {
            var rek = document.createElement('div');
            rek.className = 'small text-primary mt-1';
            rek.textContent = 'Rekomendasi: ' + c.rekomendasi;
            itemDiv.appendChild(rek);
          }
          catatanBox.appendChild(itemDiv);
        });
      }
    }
  }

  function createCell(text, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  document.addEventListener('DOMContentLoaded', initDashboard);
})(window);
