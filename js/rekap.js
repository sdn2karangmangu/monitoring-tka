/**
 * Logika Halaman rekap.html (Rekap Seluruh Nilai Siswa, Filter, Grafik, Export CSV, Cetak)
 */
(function (global) {
  'use strict';

  var rawRekapResponse = null;
  var currentFilteredRows = [];
  var rekapChart = null;

  async function initRekapPage() {
    var user = global.TKA_AUTH.requireAuth({
      pageTitle: 'Rekap Seluruh Nilai TKA',
      activeNav: 'rekap',
      allowedRoles: ['admin', 'guru']
    });
    if (!user) return;

    ['rekapSearch', 'rekapFilterKelas', 'rekapFilterMapel', 'rekapSort'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var evt = el.tagName === 'INPUT' ? 'input' : 'change';
      el.addEventListener(evt, applyFiltersAndRender);
    });

    var btnExport = document.getElementById('btnExportCsv');
    if (btnExport) btnExport.addEventListener('click', exportRekapCsv);

    var btnPrint = document.getElementById('btnPrintRekap');
    if (btnPrint) btnPrint.addEventListener('click', function () {
      global.print();
    });

    var btnRefresh = document.getElementById('btnRefreshRekap');
    if (btnRefresh) btnRefresh.addEventListener('click', loadRekapData);

    await loadRekapData();
  }

  async function loadRekapData() {
    try {
      var res = await global.TKA_API.apiCall('getRekapNilai', {}, {
        loadingText: 'Memuat rekap nilai seluruh siswa...'
      });
      rawRekapResponse = res;
      populateKelasDropdown(res.kelasList || []);
      renderComparisonChart(res.perTryout || []);
      applyFiltersAndRender();
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function populateKelasDropdown(kelasList) {
    var select = document.getElementById('rekapFilterKelas');
    if (!select) return;
    var prev = select.value;
    select.innerHTML = '<option value="">Semua Kelas</option>';
    kelasList.forEach(function (k) {
      var opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      select.appendChild(opt);
    });
    if (prev) select.value = prev;
  }

  function applyFiltersAndRender() {
    if (!rawRekapResponse) return;
    var q = (document.getElementById('rekapSearch')?.value || '').trim().toLowerCase();
    var kelas = (document.getElementById('rekapFilterKelas')?.value || '').trim().toLowerCase();
    var mapel = document.getElementById('rekapFilterMapel')?.value || '';
    var sortBy = document.getElementById('rekapSort')?.value || 'nama';

    var filtered = (rawRekapResponse.rekap || []).filter(function (row) {
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
      return Object.assign({}, row, { activeRata: avg });
    });

    filtered.sort(function (a, b) {
      if (sortBy === 'rataRataDesc') return (b.activeRata ?? -Infinity) - (a.activeRata ?? -Infinity);
      if (sortBy === 'rataRataAsc') return (a.activeRata ?? Infinity) - (b.activeRata ?? Infinity);
      return a.nama.localeCompare(b.nama, 'id');
    });

    currentFilteredRows = filtered;
    renderRekapTable(filtered, mapel);
  }

  function renderRekapTable(rows, mapel) {
    var countEl = document.getElementById('rekapCountLabel');
    if (countEl) countEl.textContent = 'Menampilkan ' + rows.length + ' siswa';

    var tbody = document.getElementById('rekapTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (rows.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 10;
      td.className = 'text-center py-4 text-secondary';
      td.textContent = 'Tidak ada data siswa yang cocok dengan filter pencarian.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    rows.forEach(function (row, idx) {
      var tr = document.createElement('tr');
      tr.appendChild(makeTd(String(idx + 1), 'tabular-nums text-secondary'));

      var tdNama = document.createElement('td');
      var link = document.createElement('a');
      link.href = 'detail-siswa.html?siswaId=' + encodeURIComponent(row.siswaId);
      link.className = 'fw-semibold text-decoration-none';
      link.textContent = row.nama;
      tdNama.appendChild(link);
      tr.appendChild(tdNama);

      tr.appendChild(makeTd(row.nis, 'tabular-nums'));
      tr.appendChild(makeTd(row.kelas));

      var showBI = !mapel || mapel === 'Bahasa Indonesia';
      var showMTK = !mapel || mapel === 'Matematika';

      tr.appendChild(makeTd(showBI ? global.TKA_API.formatScore(row.bi1) : '-', 'text-end tabular-nums'));
      tr.appendChild(makeTd(showBI ? global.TKA_API.formatScore(row.bi2) : '-', 'text-end tabular-nums'));
      tr.appendChild(makeTd(showMTK ? global.TKA_API.formatScore(row.mtk1) : '-', 'text-end tabular-nums'));
      tr.appendChild(makeTd(showMTK ? global.TKA_API.formatScore(row.mtk2) : '-', 'text-end tabular-nums'));
      tr.appendChild(makeTd(global.TKA_API.formatScore(row.activeRata), 'text-end fw-bold tabular-nums'));

      var progVal = row.progress;
      if (mapel === 'Bahasa Indonesia') progVal = row.progressBI;
      else if (mapel === 'Matematika') progVal = row.progressMTK;

      var tdProg = document.createElement('td');
      tdProg.className = 'text-end tabular-nums fw-semibold';
      if (progVal === null || progVal === undefined) {
        tdProg.textContent = '-';
        tdProg.classList.add('status-muted');
      } else if (progVal > 0) {
        tdProg.textContent = '+' + progVal;
        tdProg.classList.add('status-success');
      } else if (progVal < 0) {
        tdProg.textContent = String(progVal);
        tdProg.classList.add('status-danger');
      } else {
        tdProg.textContent = '0';
      }
      tr.appendChild(tdProg);

      tbody.appendChild(tr);
    });
  }

  function renderComparisonChart(perTryout) {
    if (!global.Chart) return;
    var ctx = document.getElementById('chartRekapPerbandingan');
    if (!ctx) return;

    if (rekapChart) rekapChart.destroy();

    rekapChart = new global.Chart(ctx, {
      type: 'bar',
      data: {
        labels: perTryout.map(function (t) { return t.namaTryout; }),
        datasets: [
          {
            label: 'Rata-rata',
            data: perTryout.map(function (t) { return t.rataRata ?? 0; }),
            backgroundColor: '#2563eb',
            borderRadius: 6
          },
          {
            label: 'Nilai Tertinggi',
            data: perTryout.map(function (t) { return t.nilaiTertinggi ?? 0; }),
            backgroundColor: '#16a34a',
            borderRadius: 6
          },
          {
            label: 'Nilai Terendah',
            data: perTryout.map(function (t) { return t.nilaiTerendah ?? 0; }),
            backgroundColor: '#d97706',
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

  function exportRekapCsv() {
    if (!currentFilteredRows || currentFilteredRows.length === 0) {
      global.TKA_API.showToast('Tidak ada data untuk diekspor.', 'warning');
      return;
    }

    var headers = ['No', 'Nama', 'NIS', 'Kelas', 'BI 1', 'BI 2', 'MTK 1', 'MTK 2', 'Rata-rata', 'Progress'];
    var lines = [headers.join(',')];

    currentFilteredRows.forEach(function (row, idx) {
      // Gunakan format ="NIS" agar nol di depan tidak hilang saat dibuka di Excel
      var nisExcel = '="' + String(row.nis).replace(/"/g, '""') + '"';
      var cols = [
        idx + 1,
        csvEscape(row.nama),
        nisExcel,
        csvEscape(row.kelas),
        global.TKA_API.formatScore(row.bi1),
        global.TKA_API.formatScore(row.bi2),
        global.TKA_API.formatScore(row.mtk1),
        global.TKA_API.formatScore(row.mtk2),
        global.TKA_API.formatScore(row.activeRata),
        row.progress === null || row.progress === undefined ? '-' : row.progress
      ];
      lines.push(cols.join(','));
    });

    var csvContent = '\uFEFF' + lines.join('\r\n');
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Rekap_TKA_Kelas_VI_SDN2_Karangmangu.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    global.TKA_API.showToast('File CSV rekap nilai berhasil diunduh.', 'success');
  }

  function csvEscape(val) {
    var s = String(val === null || val === undefined ? '' : val);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function makeTd(text, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  document.addEventListener('DOMContentLoaded', initRekapPage);
})(window);
