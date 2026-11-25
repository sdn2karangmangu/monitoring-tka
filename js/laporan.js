/**
 * Logika Halaman laporan.html (Laporan Perkembangan Siswa Format A4 Siap Cetak / PDF)
 */
(function (global) {
  'use strict';

  var reportChart = null;

  async function initLaporanPage() {
    var user = global.TKA_AUTH.requireAuth({
      pageTitle: 'Laporan Perkembangan TKA (PDF)',
      activeNav: 'laporan',
      allowedRoles: ['admin', 'guru', 'wali']
    });
    if (!user) return;

    var btnPrint = document.getElementById('btnCetakLaporan');
    if (btnPrint) {
      btnPrint.addEventListener('click', function () {
        global.print();
      });
    }

    // Input kustomisasi nama penanda tangan & tanggal cetak (live update)
    var inputKotaTgl = document.getElementById('inputLapTanggal');
    var inputGuru = document.getElementById('inputLapGuru');
    var inputKepsek = document.getElementById('inputLapKepsek');

    if (inputKotaTgl) {
      var todayStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      inputKotaTgl.value = 'Karangmangu, ' + todayStr;
      setText('lapTtdTanggal', inputKotaTgl.value);
      inputKotaTgl.addEventListener('input', function () {
        setText('lapTtdTanggal', inputKotaTgl.value || 'Karangmangu, ..................');
      });
    }

    if (inputGuru) {
      if (user.role === 'guru') {
        inputGuru.value = user.nama || '';
        setText('lapTtdGuru', inputGuru.value || '..............................');
      }
      inputGuru.addEventListener('input', function () {
        setText('lapTtdGuru', inputGuru.value || '..............................');
      });
    }

    if (inputKepsek) {
      inputKepsek.addEventListener('input', function () {
        setText('lapTtdKepsek', inputKepsek.value || '..............................');
      });
    }

    var params = new URLSearchParams(global.location.search);
    var requestedId = params.get('siswaId') || '';

    var siswaPickerGroup = document.getElementById('laporanSiswaPickerGroup');
    var siswaPicker = document.getElementById('laporanSiswaSelect');

    if (user.role === 'wali') {
      if (siswaPickerGroup) siswaPickerGroup.classList.add('d-none');
      await loadLaporanSiswa('');
      return;
    }

    // Admin / Guru: muat daftar siswa agar bisa memilih langsung di halaman laporan
    try {
      var siswaRes = await global.TKA_API.apiCall('getSiswa', {}, { loadingText: 'Memuat daftar siswa...' });
      var siswaList = siswaRes.siswa || [];

      if (siswaPicker) {
        siswaPicker.innerHTML = '';
        if (siswaList.length === 0) {
          var emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.textContent = 'Belum ada data siswa';
          siswaPicker.appendChild(emptyOpt);
        } else {
          siswaList.forEach(function (s) {
            var opt = document.createElement('option');
            opt.value = s.siswaId;
            opt.textContent = s.nama + ' (NIS: ' + s.nis + ')';
            siswaPicker.appendChild(opt);
          });

          var targetId = requestedId || siswaList[0].siswaId;
          siswaPicker.value = targetId;
          siswaPicker.addEventListener('change', function () {
            loadLaporanSiswa(siswaPicker.value);
          });

          await loadLaporanSiswa(targetId);
        }
      }
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  async function loadLaporanSiswa(siswaId) {
    try {
      var res = await global.TKA_API.apiCall('getLaporanSiswa', {
        siswaId: siswaId
      }, { loadingText: 'Menyusun laporan perkembangan...' });

      var s = res.siswa || {};
      var stats = res.statistik || {};
      var bi = res.rekapBI || {};
      var mtk = res.rekapMTK || {};
      var evalObj = res.evaluasi || {};

      setText('lapNama', s.nama || '-');
      setText('lapNis', s.nis || '-');
      setText('lapKelas', s.kelas || '-');
      setText('lapOrtu', s.namaOrangTua || '-');

      setText('lapBi1', global.TKA_API.formatScore(bi.to1));
      setText('lapBi2', global.TKA_API.formatScore(bi.to2));
      setText('lapBiRata', global.TKA_API.formatScore(bi.rataRata));

      setText('lapMtk1', global.TKA_API.formatScore(mtk.to1));
      setText('lapMtk2', global.TKA_API.formatScore(mtk.to2));
      setText('lapMtkRata', global.TKA_API.formatScore(mtk.rataRata));

      setText('lapRataGlobal', global.TKA_API.formatScore(stats.rataRataKeseluruhan));

      renderLaporanRiwayat(res.riwayatTryout || []);
      renderLaporanChart(bi, mtk);
      renderLaporanCatatan(evalObj, res.catatanGuru || []);
    } catch (err) {
      global.TKA_API.showToast(err.message, 'error');
    }
  }

  function renderLaporanRiwayat(riwayat) {
    var tbody = document.getElementById('lapRiwayatTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (riwayat.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'text-center text-secondary py-3';
      td.textContent = 'Belum ada riwayat hasil tryout yang tercatat.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    riwayat.forEach(function (item, idx) {
      var tr = document.createElement('tr');
      tr.appendChild(makeTd(String(idx + 1), 'tabular-nums'));
      tr.appendChild(makeTd(item.namaTryout));
      tr.appendChild(makeTd(item.mataPelajaran));
      tr.appendChild(makeTd(item.tanggal || '-', 'tabular-nums'));
      tr.appendChild(makeTd(String(item.benar ?? 0) + ' / ' + String(item.totalSoal ?? 0), 'text-end tabular-nums'));
      tr.appendChild(makeTd(global.TKA_API.formatScore(item.nilai), 'text-end fw-bold tabular-nums'));
      tbody.appendChild(tr);
    });
  }

  function renderLaporanChart(bi, mtk) {
    if (!global.Chart) return;
    var ctx = document.getElementById('chartLaporanSiswa');
    if (!ctx) return;

    if (reportChart) reportChart.destroy();

    reportChart = new global.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Tryout 1', 'Tryout 2', 'Rata-rata'],
        datasets: [
          {
            label: 'Bahasa Indonesia',
            data: [bi.to1 ?? 0, bi.to2 ?? 0, bi.rataRata ?? 0],
            backgroundColor: '#2563eb',
            borderRadius: 4
          },
          {
            label: 'Matematika',
            data: [mtk.to1 ?? 0, mtk.to2 ?? 0, mtk.rataRata ?? 0],
            backgroundColor: '#0f294a',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#334155', boxWidth: 12 } }
        },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { color: '#334155' } },
          x: { ticks: { color: '#334155' } }
        }
      }
    });
  }

  function renderLaporanCatatan(evalObj, catatanList) {
    setText('lapRingkasanEvaluasi', evalObj.ringkasanPerkembangan || '-');

    var catatanEl = document.getElementById('lapCatatanBox');
    var rekEl = document.getElementById('lapRekomendasiBox');

    if (catatanEl) {
      if (catatanList.length === 0) {
        catatanEl.textContent = 'Belum ada catatan khusus dari guru.';
      } else {
        catatanEl.innerHTML = '';
        catatanList.forEach(function (c) {
          var p = document.createElement('p');
          p.className = 'mb-1';
          p.textContent = '[' + (c.namaTryout || 'Umum') + '] ' + c.catatan + ' (' + (c.guru || 'Guru') + ')';
          catatanEl.appendChild(p);
        });
      }
    }

    if (rekEl) {
      var recs = catatanList.filter(function (c) { return c.rekomendasi; });
      if (recs.length > 0) {
        rekEl.innerHTML = '';
        recs.forEach(function (c) {
          var p = document.createElement('p');
          p.className = 'mb-1';
          p.textContent = '• ' + c.rekomendasi;
          rekEl.appendChild(p);
        });
      } else {
        var ting = evalObj.perluDitingkatkan || [];
        rekEl.textContent = ting.length > 0 ? ting.join(' ') : 'Terus pertahankan latihan soal TKA secara berkala.';
      }
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

  document.addEventListener('DOMContentLoaded', initLaporanPage);
})(window);
