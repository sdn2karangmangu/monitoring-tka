/**
 * ============================================================================
 * MONITORING HASIL TRYOUT TKA KELAS VI SDN 2 KARANGMANGU
 * Tahun Ajaran 2026/2027
 * Backend Lengkap (Tahap 1 s.d. Tahap 8): Google Apps Script + Google Sheets
 * Database Pusat: DB_MONITORING_TKA_SDN2_KARANGMANGU
 * ============================================================================
 */

const APP_CONFIG = {
  APP_NAME: 'MONITORING TKA KELAS VI',
  SEKOLAH: 'SDN 2 KARANGMANGU',
  TAHUN_AJARAN: '2026/2027',
  DB_NAME: 'DB_MONITORING_TKA_SDN2_KARANGMANGU',
  TIMEZONE: 'Asia/Jakarta',
  SESSION_TTL_SECONDS: 21600, // 6 jam (batas maksimum CacheService GAS)
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_SECONDS: 900, // 15 menit
  PASSWORD_HASH_ROUNDS: 500,
  VERSION: '2.0.0'
};

const PROP_KEYS = {
  DB_SPREADSHEET_ID: 'DB_SPREADSHEET_ID',
  STAGE1_API_KEY: 'STAGE1_API_KEY'
};

const SHEET_NAMES = {
  USERS: 'Users',
  SISWA: 'Siswa',
  SUMBER_TRYOUT: 'SumberTryout',
  TRYOUT: 'Tryout',
  HASIL: 'Hasil',
  DETAIL_NILAI: 'DetailNilai',
  CATATAN_GURU: 'CatatanGuru',
  LOG_AKTIVITAS: 'LogAktivitas'
};

const SHEET_SCHEMAS = {
  Users: [
    'UserID',
    'Username',
    'PasswordHash',
    'Salt',
    'Role',
    'Nama',
    'SiswaID',
    'Status',
    'CreatedAt'
  ],
  Siswa: [
    'SiswaID',
    'NIS',
    'Nama',
    'JenisKelamin',
    'Kelas',
    'NamaOrangTua',
    'NoHPOrangTua',
    'Status'
  ],
  SumberTryout: [
    'SumberID',
    'MataPelajaran',
    'NamaTryout',
    'SpreadsheetID',
    'SheetGID',
    'Status',
    'TerakhirSync'
  ],
  Tryout: [
    'TryoutID',
    'NamaTryout',
    'MataPelajaran',
    'Tanggal',
    'Durasi',
    'Status'
  ],
  Hasil: [
    'HasilID',
    'SiswaID',
    'TryoutID',
    'SumberID',
    'NIS',
    'Tanggal',
    'NamaSiswa',
    'MataPelajaran',
    'Benar',
    'TotalSoal',
    'Nilai',
    'Status',
    'SourceRow'
  ],
  DetailNilai: [
    'DetailID',
    'HasilID',
    'MataPelajaran',
    'Materi',
    'JumlahSoal',
    'Benar',
    'Salah',
    'Kosong',
    'Nilai'
  ],
  CatatanGuru: [
    'CatatanID',
    'SiswaID',
    'TryoutID',
    'Catatan',
    'Rekomendasi',
    'Guru',
    'Tanggal'
  ],
  LogAktivitas: [
    'LogID',
    'UserID',
    'Aktivitas',
    'Keterangan',
    'Timestamp'
  ]
};

/**
 * Konfigurasi 4 sumber Google Spreadsheet CBT (HANYA DIBACA / READ-ONLY).
 */
const DEFAULT_SUMBER_TRYOUT = [
  {
    sumberId: 'SRC-MTK-1',
    tryoutId: 'TO-MTK-1',
    mataPelajaran: 'Matematika',
    namaTryout: 'Matematika 1',
    spreadsheetId: '1SiM7TAicjdfHdA7pIknb3pBZdcRa2aSDG-x_kS8D0jo',
    sheetGid: '1336762570',
    status: 'Aktif'
  },
  {
    sumberId: 'SRC-MTK-2',
    tryoutId: 'TO-MTK-2',
    mataPelajaran: 'Matematika',
    namaTryout: 'Matematika 2',
    spreadsheetId: '1Fr1pSLFYyh1BNPwIELrIuL63ty_QXzxjj6DWApSbBg4',
    sheetGid: '1336762570',
    status: 'Aktif'
  },
  {
    sumberId: 'SRC-BI-1',
    tryoutId: 'TO-BI-1',
    mataPelajaran: 'Bahasa Indonesia',
    namaTryout: 'Bahasa Indonesia 1',
    spreadsheetId: '1bhvt7q_fjajSR8G3hZ0VL0PeViLdasd-3MDFR_mR_XM',
    sheetGid: '1336762570',
    status: 'Aktif'
  },
  {
    sumberId: 'SRC-BI-2',
    tryoutId: 'TO-BI-2',
    mataPelajaran: 'Bahasa Indonesia',
    namaTryout: 'Bahasa Indonesia 2',
    spreadsheetId: '1CeWwG5a8ieB5eWv9lbKsWY8MYDRQYgRSLasptolJDxk',
    sheetGid: '1336762570',
    status: 'Aktif'
  }
];

/* ============================================================================
 * 1. SETUP DATABASE & KONFIGURASI SUMBER TRYOUT
 * ============================================================================ */

function setupDatabase() {
  var ss = getOrCreateDatabaseSpreadsheet_();
  var createdSheets = [];
  var existingSheets = [];

  var sheetNames = Object.keys(SHEET_SCHEMAS);
  for (var i = 0; i < sheetNames.length; i++) {
    var sheetName = sheetNames[i];
    var headers = SHEET_SCHEMAS[sheetName];
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      initializeSheetHeader_(sheet, headers);
      createdSheets.push(sheetName);
    } else {
      if (sheet.getLastRow() === 0) {
        initializeSheetHeader_(sheet, headers);
      }
      existingSheets.push(sheetName);
    }

    applyTextColumnFormats_(sheet, sheetName);
  }

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }

  var sumberResult = setupSumberTryout();

  writeActivityLog_(
    'SYSTEM',
    'SETUP_DATABASE',
    'Setup database selesai. Dibuat: [' + createdSheets.join(', ') + '], Sudah ada: [' + existingSheets.join(', ') + '].'
  );

  var result = {
    ok: true,
    message: 'Database berhasil disiapkan.',
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    createdSheets: createdSheets,
    existingSheets: existingSheets,
    sumberTryout: sumberResult
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function setupSumberTryout() {
  var ss = getDatabaseSpreadsheet_();
  var sumberSheet = ensureSheetExists_(ss, SHEET_NAMES.SUMBER_TRYOUT);
  var tryoutSheet = ensureSheetExists_(ss, SHEET_NAMES.TRYOUT);

  var existingSumberIds = getExistingColumnValueSet_(sumberSheet, 0);
  var existingTryoutKeys = getExistingTryoutKeyMap_(tryoutSheet);

  var addedSumber = [];
  var addedTryout = [];

  for (var i = 0; i < DEFAULT_SUMBER_TRYOUT.length; i++) {
    var cfg = DEFAULT_SUMBER_TRYOUT[i];

    if (!existingSumberIds[cfg.sumberId]) {
      var sumberRow = [
        cfg.sumberId,
        cfg.mataPelajaran,
        cfg.namaTryout,
        cfg.spreadsheetId,
        String(cfg.sheetGid),
        cfg.status,
        ''
      ];
      appendRowWithTextFormat_(sumberSheet, sumberRow, [3, 4]);
      existingSumberIds[cfg.sumberId] = true;
      addedSumber.push(cfg.sumberId);
    }

    var tryoutKey = buildTryoutKey_(cfg.namaTryout, cfg.mataPelajaran);
    if (!existingTryoutKeys[tryoutKey]) {
      var tryoutRow = [
        cfg.tryoutId,
        cfg.namaTryout,
        cfg.mataPelajaran,
        '',
        60,
        'Aktif'
      ];
      tryoutSheet.appendRow(tryoutRow);
      existingTryoutKeys[tryoutKey] = cfg.tryoutId;
      addedTryout.push(cfg.tryoutId);
    }
  }

  if (addedSumber.length > 0 || addedTryout.length > 0) {
    writeActivityLog_(
      'SYSTEM',
      'SETUP_SUMBER_TRYOUT',
      'Sumber ditambahkan: [' + addedSumber.join(', ') + '], Tryout ditambahkan: [' + addedTryout.join(', ') + '].'
    );
  }

  return {
    ok: true,
    addedSumber: addedSumber,
    addedTryout: addedTryout,
    totalSumberConfigured: sumberSheet.getLastRow() > 1 ? sumberSheet.getLastRow() - 1 : 0
  };
}

function generateStage1ApiKey() {
  var key = 'TKA-' + Utilities.getUuid().replace(/-/g, '').toUpperCase();
  PropertiesService.getScriptProperties().setProperty(PROP_KEYS.STAGE1_API_KEY, key);
  Logger.log('STAGE1_API_KEY baru berhasil dibuat: ' + key);
  return {
    ok: true,
    message: 'API Key berhasil dibuat dan disimpan di ScriptProperties.',
    apiKey: key
  };
}

/* ============================================================================
 * 2. SISTEM AUTENTIKASI, KEAMANAN, & MANAJEMEN PENGGUNA (TAHAP 2)
 * ============================================================================ */

function cekStatusSetupAwal_() {
  var ss = getOrCreateDatabaseSpreadsheet_();
  var usersSheet = ensureSheetExists_(ss, SHEET_NAMES.USERS);
  var hasUsers = usersSheet.getLastRow() >= 2;
  return {
    ok: true,
    needsInitialSetup: !hasUsers
  };
}

/**
 * Bootstrap akun Admin pertama kali saat tabel Users masih kosong.
 * Terkunci otomatis secara permanen setelah 1 pengguna terdaftar.
 */
function setupAdminPertama(body) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, code: 409, message: 'Sistem sedang memproses permintaan lain.' };
  }

  try {
    var setupRes = setupDatabase();
    var ss = SpreadsheetApp.openById(setupRes.spreadsheetId);
    var usersSheet = ensureSheetExists_(ss, SHEET_NAMES.USERS);

    if (usersSheet.getLastRow() >= 2) {
      return {
        ok: false,
        code: 403,
        message: 'Akun admin awal sudah dibuat sebelumnya. Silakan login menggunakan akun yang terdaftar.'
      };
    }

    var username = normalizeUsername_(body.username);
    var nama = sanitizeCellText_(body.nama);
    var password = body.password ? String(body.password) : '';

    if (!isValidUsername_(username)) {
      return {
        ok: false,
        code: 400,
        message: 'Username minimal 4 karakter (hanya huruf, angka, titik, atau garis bawah).'
      };
    }
    if (!nama) {
      return { ok: false, code: 400, message: 'Nama lengkap admin wajib diisi.' };
    }
    if (password.length < 8) {
      return { ok: false, code: 400, message: 'Password minimal 8 karakter.' };
    }

    var salt = generateSalt_();
    var hash = hashPassword_(password, salt);
    var userId = 'USR-0001';
    var createdAt = formatNow_();

    usersSheet.appendRow([
      userId,
      username,
      hash,
      salt,
      'admin',
      nama,
      '',
      'Aktif',
      createdAt
    ]);

    writeActivityLog_(userId, 'SETUP_ADMIN_AWAL', 'Akun admin pertama dibuat: ' + username);

    return {
      ok: true,
      message: 'Akun Admin awal berhasil dibuat. Silakan login.'
    };
  } finally {
    lock.releaseLock();
  }
}

function loginUser(body) {
  var username = normalizeUsername_(body.username);
  var password = body.password ? String(body.password) : '';

  if (!username || !password) {
    return { ok: false, code: 400, message: 'Username dan password wajib diisi.' };
  }

  // Cek pembatasan percobaan login
  var cache = CacheService.getScriptCache();
  var failKey = 'LOGIN_FAIL_' + username;
  var rawFail = cache.get(failKey);
  var failData = rawFail ? safeJsonParse_(rawFail) : null;
  var nowMs = Date.now();

  if (failData && failData.lockedUntil && nowMs < failData.lockedUntil) {
    var sisaMenit = Math.ceil((failData.lockedUntil - nowMs) / 60000);
    return {
      ok: false,
      code: 429,
      message: 'Terlalu banyak percobaan login gagal. Coba lagi dalam ' + sisaMenit + ' menit.'
    };
  }

  var ss = getDatabaseSpreadsheet_();
  var usersSheet = ensureSheetExists_(ss, SHEET_NAMES.USERS);
  var userRecord = findUserByUsername_(usersSheet, username);

  if (!userRecord || !constantTimeEqual_(hashPassword_(password, userRecord.salt), userRecord.passwordHash)) {
    var nextCount = (failData && (!failData.lockedUntil || nowMs >= failData.lockedUntil)) ? failData.count + 1 : 1;
    var nextState = { count: nextCount, lockedUntil: 0 };
    if (nextCount >= APP_CONFIG.MAX_LOGIN_ATTEMPTS) {
      nextState.lockedUntil = nowMs + (APP_CONFIG.LOCKOUT_SECONDS * 1000);
      writeActivityLog_(username, 'LOGIN_TERKUNCI', 'Akun dikunci sementara setelah ' + nextCount + ' kali gagal login.');
    }
    cache.put(failKey, JSON.stringify(nextState), APP_CONFIG.LOCKOUT_SECONDS);

    if (nextState.lockedUntil > 0) {
      return {
        ok: false,
        code: 429,
        message: 'Terlalu banyak percobaan login gagal. Akun dikunci selama 15 menit.'
      };
    }

    var sisaCoba = APP_CONFIG.MAX_LOGIN_ATTEMPTS - nextCount;
    return {
      ok: false,
      code: 401,
      message: 'Username atau password salah. Sisa percobaan: ' + sisaCoba + '.'
    };
  }

  if (String(userRecord.status).toLowerCase() !== 'aktif') {
    return {
      ok: false,
      code: 403,
      message: 'Akun Anda berstatus nonaktif. Hubungi Administrator sekolah.'
    };
  }

  // Hapus hitungan gagal login
  cache.remove(failKey);

  // Buat token sesi aman
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var sessionData = {
    userId: userRecord.userId,
    username: userRecord.username,
    role: userRecord.role,
    nama: userRecord.nama,
    siswaId: userRecord.siswaId || '',
    createdAt: formatNow_()
  };

  cache.put('SESSION_' + token, JSON.stringify(sessionData), APP_CONFIG.SESSION_TTL_SECONDS);
  writeActivityLog_(userRecord.userId, 'LOGIN', 'Login berhasil sebagai ' + userRecord.role);

  return {
    ok: true,
    message: 'Login berhasil.',
    token: token,
    user: {
      userId: userRecord.userId,
      username: userRecord.username,
      role: userRecord.role,
      nama: userRecord.nama,
      siswaId: userRecord.siswaId || ''
    }
  };
}

function logoutUser(token, auth) {
  if (token) {
    CacheService.getScriptCache().remove('SESSION_' + String(token).trim());
  }
  if (auth && auth.userId) {
    writeActivityLog_(auth.userId, 'LOGOUT', 'Pengguna keluar dari sistem.');
  }
  return { ok: true, message: 'Logout berhasil.' };
}

function ubahPasswordSendiri(body, auth) {
  var passwordLama = body.passwordLama ? String(body.passwordLama) : '';
  var passwordBaru = body.passwordBaru ? String(body.passwordBaru) : '';

  if (!passwordLama || !passwordBaru) {
    return { ok: false, code: 400, message: 'Password lama dan password baru wajib diisi.' };
  }
  if (passwordBaru.length < 8) {
    return { ok: false, code: 400, message: 'Password baru minimal 8 karakter.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var usersSheet = ensureSheetExists_(ss, SHEET_NAMES.USERS);
  var userRecord = findUserById_(usersSheet, auth.userId);

  if (!userRecord) {
    return { ok: false, code: 404, message: 'Akun pengguna tidak ditemukan.' };
  }

  if (!constantTimeEqual_(hashPassword_(passwordLama, userRecord.salt), userRecord.passwordHash)) {
    return { ok: false, code: 400, message: 'Password lama tidak sesuai.' };
  }

  var newSalt = generateSalt_();
  var newHash = hashPassword_(passwordBaru, newSalt);

  usersSheet.getRange(userRecord.rowIndex, 3).setValue(newHash);
  usersSheet.getRange(userRecord.rowIndex, 4).setValue(newSalt);

  writeActivityLog_(auth.userId, 'UBAH_PASSWORD', 'Pengguna mengubah password akunnya sendiri.');
  return { ok: true, message: 'Password berhasil diperbarui.' };
}

function getUsersList_(usersSheet) {
  var ss = getDatabaseSpreadsheet_();
  var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
  var siswaList = readAllSiswa_(siswaSheet);
  var siswaById = {};
  for (var s = 0; s < siswaList.length; s++) {
    siswaById[siswaList[s].siswaId] = siswaList[s];
  }

  var list = [];
  var lastRow = usersSheet.getLastRow();
  if (lastRow >= 2) {
    var rows = usersSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Users.length).getDisplayValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!String(r[0]).trim()) continue;
      var sid = String(r[6]).trim();
      var linkedSiswa = sid && siswaById[sid] ? siswaById[sid] : null;

      // PasswordHash dan Salt TIDAK PERNAH dikirim ke frontend
      list.push({
        userId: String(r[0]).trim(),
        username: String(r[1]).trim(),
        role: String(r[4]).trim(),
        nama: String(r[5]).trim(),
        siswaId: sid,
        siswaNama: linkedSiswa ? linkedSiswa.nama : '',
        siswaNis: linkedSiswa ? linkedSiswa.nis : '',
        status: String(r[7]).trim(),
        createdAt: String(r[8]).trim()
      });
    }
  }

  return {
    ok: true,
    total: list.length,
    users: list
  };
}

function tambahUserBaru(body, auth) {
  var username = normalizeUsername_(body.username);
  var password = body.password ? String(body.password) : '';
  var role = body.role ? String(body.role).trim().toLowerCase() : '';
  var nama = sanitizeCellText_(body.nama);
  var siswaId = body.siswaId ? String(body.siswaId).trim() : '';

  if (!isValidUsername_(username)) {
    return { ok: false, code: 400, message: 'Username minimal 4 karakter (huruf, angka, titik, garis bawah).' };
  }
  if (password.length < 8) {
    return { ok: false, code: 400, message: 'Password minimal 8 karakter.' };
  }
  if (['admin', 'guru', 'wali'].indexOf(role) === -1) {
    return { ok: false, code: 400, message: 'Role tidak valid. Pilihan: admin, guru, wali.' };
  }
  if (!nama) {
    return { ok: false, code: 400, message: 'Nama lengkap wajib diisi.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var usersSheet = ensureSheetExists_(ss, SHEET_NAMES.USERS);

  if (findUserByUsername_(usersSheet, username)) {
    return { ok: false, code: 409, message: 'Username "' + username + '" sudah digunakan.' };
  }

  if (role === 'wali' && siswaId) {
    var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
    if (!findSiswaById_(siswaSheet, siswaId)) {
      return { ok: false, code: 404, message: 'SiswaID yang dipilih tidak ditemukan.' };
    }
  }
  if (role !== 'wali') {
    siswaId = '';
  }

  var maxSeq = getMaxIdSequenceInColumn_(usersSheet, 0);
  var newUserId = formatPrefixedId_('USR', maxSeq + 1, 4);
  var salt = generateSalt_();
  var hash = hashPassword_(password, salt);
  var createdAt = formatNow_();

  usersSheet.appendRow([
    newUserId,
    username,
    hash,
    salt,
    role,
    nama,
    siswaId,
    'Aktif',
    createdAt
  ]);

  writeActivityLog_(auth.userId, 'TAMBAH_USER', 'Menambahkan akun ' + username + ' (' + role + ')');

  return {
    ok: true,
    message: 'Akun pengguna berhasil dibuat.',
    user: {
      userId: newUserId,
      username: username,
      role: role,
      nama: nama,
      siswaId: siswaId,
      status: 'Aktif',
      createdAt: createdAt
    }
  };
}

function updateUserData(body, auth) {
  var userId = body.userId ? String(body.userId).trim() : '';
  if (!userId) {
    return { ok: false, code: 400, message: 'userId wajib diisi.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var usersSheet = ensureSheetExists_(ss, SHEET_NAMES.USERS);
  var target = findUserById_(usersSheet, userId);

  if (!target) {
    return { ok: false, code: 404, message: 'Pengguna tidak ditemukan.' };
  }

  var newRole = body.role ? String(body.role).trim().toLowerCase() : target.role;
  if (['admin', 'guru', 'wali'].indexOf(newRole) === -1) {
    return { ok: false, code: 400, message: 'Role tidak valid.' };
  }

  var newStatus = body.status ? String(body.status).trim() : target.status;
  if (['Aktif', 'Nonaktif'].indexOf(newStatus) === -1) {
    return { ok: false, code: 400, message: 'Status pengguna harus Aktif atau Nonaktif.' };
  }

  // Cegah admin menonaktifkan akunnya sendiri secara tidak sengaja
  if (userId === auth.userId && newStatus !== 'Aktif') {
    return { ok: false, code: 400, message: 'Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang login.' };
  }

  var newNama = body.nama !== undefined ? sanitizeCellText_(body.nama) : target.nama;
  if (!newNama) {
    return { ok: false, code: 400, message: 'Nama pengguna tidak boleh kosong.' };
  }

  var newSiswaId = body.siswaId !== undefined ? String(body.siswaId).trim() : target.siswaId;
  if (newRole === 'wali' && newSiswaId) {
    var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
    if (!findSiswaById_(siswaSheet, newSiswaId)) {
      return { ok: false, code: 404, message: 'SiswaID tidak ditemukan.' };
    }
  }
  if (newRole !== 'wali') {
    newSiswaId = '';
  }

  usersSheet.getRange(target.rowIndex, 5).setValue(newRole);
  usersSheet.getRange(target.rowIndex, 6).setValue(newNama);
  usersSheet.getRange(target.rowIndex, 7).setValue(newSiswaId);
  usersSheet.getRange(target.rowIndex, 8).setValue(newStatus);

  writeActivityLog_(
    auth.userId,
    'UPDATE_USER',
    'Memperbarui akun ' + target.username + ' (Role: ' + newRole + ', Status: ' + newStatus + ', SiswaID: ' + newSiswaId + ')'
  );

  return {
    ok: true,
    message: 'Data pengguna berhasil diperbarui.'
  };
}

function resetPasswordUser(body, auth) {
  var userId = body.userId ? String(body.userId).trim() : '';
  var passwordBaru = body.passwordBaru ? String(body.passwordBaru) : '';

  if (!userId || passwordBaru.length < 8) {
    return { ok: false, code: 400, message: 'userId wajib diisi dan password baru minimal 8 karakter.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var usersSheet = ensureSheetExists_(ss, SHEET_NAMES.USERS);
  var target = findUserById_(usersSheet, userId);

  if (!target) {
    return { ok: false, code: 404, message: 'Pengguna tidak ditemukan.' };
  }

  var newSalt = generateSalt_();
  var newHash = hashPassword_(passwordBaru, newSalt);

  usersSheet.getRange(target.rowIndex, 3).setValue(newHash);
  usersSheet.getRange(target.rowIndex, 4).setValue(newSalt);

  writeActivityLog_(auth.userId, 'RESET_PASSWORD', 'Reset password untuk akun ' + target.username);
  return { ok: true, message: 'Password pengguna ' + target.username + ' berhasil direset.' };
}

/* ============================================================================
 * 3. SISTEM SINKRONISASI MULTI-SPREADSHEET (FITUR UTAMA)
 * ============================================================================ */

function sinkronkanDataTryout(triggeredBy) {
  var actor = triggeredBy ? String(triggeredBy) : 'MANUAL';
  var lock = LockService.getScriptLock();
  var lockAcquired = lock.tryLock(15000);

  if (!lockAcquired) {
    return {
      ok: false,
      code: 409,
      message: 'Proses sinkronisasi lain sedang berjalan. Mohon tunggu hingga selesai lalu coba lagi.'
    };
  }

  try {
    var ss = getDatabaseSpreadsheet_();
    var sumberSheet = ensureSheetExists_(ss, SHEET_NAMES.SUMBER_TRYOUT);
    var tryoutSheet = ensureSheetExists_(ss, SHEET_NAMES.TRYOUT);
    var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
    var hasilSheet = ensureSheetExists_(ss, SHEET_NAMES.HASIL);

    var sumberList = readSumberTryoutList_(sumberSheet);
    if (sumberList.length === 0) {
      return {
        ok: false,
        code: 400,
        message: 'Belum ada konfigurasi pada sheet SumberTryout. Jalankan setupDatabase() terlebih dahulu.'
      };
    }

    var siswaIndex = loadSiswaIndex_(siswaSheet);
    var tryoutIndex = loadTryoutIndex_(tryoutSheet);
    var hasilIndex = loadHasilIndex_(hasilSheet);

    var syncTimestamp = formatNow_();
    var laporanSumber = [];
    var totalInserted = 0;
    var totalUpdated = 0;
    var totalUnchanged = 0;
    var totalSkippedInvalid = 0;
    var totalNewSiswa = 0;
    var sumberBerhasil = 0;
    var sumberGagal = 0;

    for (var s = 0; s < sumberList.length; s++) {
      var src = sumberList[s];

      if (String(src.status).toLowerCase() !== 'aktif') {
        laporanSumber.push({
          sumberId: src.sumberId,
          namaTryout: src.namaTryout,
          mataPelajaran: src.mataPelajaran,
          status: 'Dilewati',
          pesan: 'Status sumber tidak aktif.',
          inserted: 0,
          updated: 0,
          unchanged: 0,
          skippedInvalid: 0
        });
        continue;
      }

      var perSourceStat = {
        sumberId: src.sumberId,
        namaTryout: src.namaTryout,
        mataPelajaran: src.mataPelajaran,
        spreadsheetId: src.spreadsheetId,
        sheetGid: src.sheetGid,
        status: 'Berhasil',
        pesan: '',
        totalBarisDibaca: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        skippedInvalid: 0,
        siswaBaruPerluVerifikasi: 0
      };

      try {
        var tryoutId = ensureTryoutRecord_(tryoutSheet, tryoutIndex, src);

        var sourceSpreadsheet = SpreadsheetApp.openById(src.spreadsheetId);
        var sourceSheet = findSheetByGid_(sourceSpreadsheet, src.sheetGid);

        if (!sourceSheet) {
          throw new Error('Tab dengan GID "' + src.sheetGid + '" tidak ditemukan pada spreadsheet sumber.');
        }

        var lastRow = sourceSheet.getLastRow();
        if (lastRow < 2) {
          updateSumberLastSync_(sumberSheet, src.rowIndex, syncTimestamp);
          perSourceStat.pesan = 'Spreadsheet terhubung, belum ada data siswa (hanya header).';
          sumberBerhasil++;
          laporanSumber.push(perSourceStat);
          continue;
        }

        var numRows = lastRow - 1;
        var rawRange = sourceSheet.getRange(2, 1, numRows, 7);
        var values = rawRange.getValues();
        var displayValues = rawRange.getDisplayValues();

        var rowsToInsert = [];

        for (var r = 0; r < numRows; r++) {
          var sourceRowNumber = r + 2;
          var rowVal = values[r];
          var rowDisp = displayValues[r];

          if (isSourceRowCompletelyEmpty_(rowDisp)) {
            continue;
          }

          perSourceStat.totalBarisDibaca++;

          var waktuStr = normalizeTimestampValue_(rowVal[0], rowDisp[0]);
          var namaSiswa = sanitizeCellText_(rowDisp[1]);
          var nis = normalizeNis_(rowDisp[2]);
          var kelas = sanitizeCellText_(rowDisp[3]) || 'VI';
          var benar = parseNumberSafe_(rowVal[4], rowDisp[4]);
          var totalSoal = parseNumberSafe_(rowVal[5], rowDisp[5]);
          var nilai = parseNumberSafe_(rowVal[6], rowDisp[6]);

          if (!nis || nilai === null) {
            perSourceStat.skippedInvalid++;
            totalSkippedInvalid++;
            continue;
          }

          var siswaResult = validasiAtauDaftarkanSiswa_(
            siswaSheet,
            siswaIndex,
            nis,
            namaSiswa,
            kelas
          );

          if (siswaResult.isNew) {
            perSourceStat.siswaBaruPerluVerifikasi++;
            totalNewSiswa++;
          }

          var compositeKey = buildHasilCompositeKey_(src.sumberId, sourceRowNumber);
          var existingHasil = hasilIndex.byCompositeKey[compositeKey];

          var safeBenar = benar !== null ? benar : 0;
          var safeTotalSoal = totalSoal !== null ? totalSoal : 0;
          var normalizedNilai = roundScore_(nilai);

          if (existingHasil) {
            var changed =
              String(existingHasil.siswaId) !== String(siswaResult.siswa.siswaId) ||
              String(existingHasil.tryoutId) !== String(tryoutId) ||
              String(existingHasil.nis) !== String(nis) ||
              String(existingHasil.tanggal) !== String(waktuStr) ||
              String(existingHasil.namaSiswa) !== String(namaSiswa) ||
              String(existingHasil.mataPelajaran) !== String(src.mataPelajaran) ||
              Number(existingHasil.benar) !== Number(safeBenar) ||
              Number(existingHasil.totalSoal) !== Number(safeTotalSoal) ||
              Number(existingHasil.nilai) !== Number(normalizedNilai);

            if (changed) {
              var updatedRow = [
                existingHasil.hasilId,
                siswaResult.siswa.siswaId,
                tryoutId,
                src.sumberId,
                nis,
                waktuStr,
                namaSiswa,
                src.mataPelajaran,
                safeBenar,
                safeTotalSoal,
                normalizedNilai,
                'Valid',
                sourceRowNumber
              ];
              var updateRange = hasilSheet.getRange(existingHasil.rowIndex, 1, 1, updatedRow.length);
              updateRange.setValues([updatedRow]);
              hasilSheet.getRange(existingHasil.rowIndex, 5).setNumberFormat('@').setValue(nis);

              existingHasil.siswaId = siswaResult.siswa.siswaId;
              existingHasil.tryoutId = tryoutId;
              existingHasil.nis = nis;
              existingHasil.tanggal = waktuStr;
              existingHasil.namaSiswa = namaSiswa;
              existingHasil.mataPelajaran = src.mataPelajaran;
              existingHasil.benar = safeBenar;
              existingHasil.totalSoal = safeTotalSoal;
              existingHasil.nilai = normalizedNilai;

              perSourceStat.updated++;
              totalUpdated++;
            } else {
              perSourceStat.unchanged++;
              totalUnchanged++;
            }
          } else {
            hasilIndex.maxSeq++;
            var newHasilId = formatPrefixedId_('HSL', hasilIndex.maxSeq, 5);
            var newRow = [
              newHasilId,
              siswaResult.siswa.siswaId,
              tryoutId,
              src.sumberId,
              nis,
              waktuStr,
              namaSiswa,
              src.mataPelajaran,
              safeBenar,
              safeTotalSoal,
              normalizedNilai,
              'Valid',
              sourceRowNumber
            ];
            rowsToInsert.push(newRow);

            hasilIndex.byCompositeKey[compositeKey] = {
              rowIndex: -1,
              hasilId: newHasilId,
              siswaId: siswaResult.siswa.siswaId,
              tryoutId: tryoutId,
              sumberId: src.sumberId,
              nis: nis,
              tanggal: waktuStr,
              namaSiswa: namaSiswa,
              mataPelajaran: src.mataPelajaran,
              benar: safeBenar,
              totalSoal: safeTotalSoal,
              nilai: normalizedNilai,
              status: 'Valid',
              sourceRow: sourceRowNumber
            };

            perSourceStat.inserted++;
            totalInserted++;
          }
        }

        if (rowsToInsert.length > 0) {
          var startInsertRow = hasilSheet.getLastRow() + 1;
          hasilSheet.getRange(startInsertRow, 5, rowsToInsert.length, 1).setNumberFormat('@');
          hasilSheet.getRange(startInsertRow, 6, rowsToInsert.length, 1).setNumberFormat('@');
          hasilSheet
            .getRange(startInsertRow, 1, rowsToInsert.length, SHEET_SCHEMAS.Hasil.length)
            .setValues(rowsToInsert);
        }

        updateSumberLastSync_(sumberSheet, src.rowIndex, syncTimestamp);
        perSourceStat.pesan = 'Sinkronisasi sumber berhasil.';
        sumberBerhasil++;
      } catch (sourceErr) {
        sumberGagal++;
        perSourceStat.status = 'Gagal';
        perSourceStat.pesan = 'Gagal membaca sumber: ' + sourceErr.message;
      }

      laporanSumber.push(perSourceStat);
    }

    var summaryText =
      'Sumber berhasil: ' + sumberBerhasil +
      ', Gagal: ' + sumberGagal +
      ', Baru: ' + totalInserted +
      ', Diperbarui: ' + totalUpdated +
      ', Tidak berubah: ' + totalUnchanged +
      ', Siswa baru perlu verifikasi: ' + totalNewSiswa;

    writeActivityLog_(actor, 'SINKRONISASI_TRYOUT', summaryText);

    return {
      ok: sumberGagal === 0 || sumberBerhasil > 0,
      partialSuccess: sumberGagal > 0 && sumberBerhasil > 0,
      message: sumberGagal === 0
        ? 'Seluruh sumber tryout berhasil disinkronkan.'
        : (sumberBerhasil > 0
            ? 'Sebagian sumber berhasil disinkronkan, terdapat sumber yang gagal dibaca.'
            : 'Seluruh sumber gagal dibaca. Periksa akses spreadsheet sumber.'),
      syncedAt: syncTimestamp,
      ringkasan: {
        sumberBerhasil: sumberBerhasil,
        sumberGagal: sumberGagal,
        totalInserted: totalInserted,
        totalUpdated: totalUpdated,
        totalUnchanged: totalUnchanged,
        totalSkippedInvalid: totalSkippedInvalid,
        totalNewSiswaPerluVerifikasi: totalNewSiswa
      },
      laporanPerSumber: laporanSumber
    };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================================
 * 4. MANAJEMEN & VALIDASI DATA SISWA BERDASARKAN NIS
 * ============================================================================ */

function validasiAtauDaftarkanSiswa_(siswaSheet, siswaIndex, nis, namaFromSource, kelasFromSource) {
  var normalizedNis = normalizeNis_(nis);
  if (!normalizedNis) {
    throw new Error('NIS tidak boleh kosong.');
  }

  var existing = siswaIndex.byNis[normalizedNis];
  if (existing) {
    return {
      isNew: false,
      siswa: existing
    };
  }

  siswaIndex.maxSeq++;
  var newSiswaId = formatPrefixedId_('SIS', siswaIndex.maxSeq, 4);
  var safeNama = sanitizeCellText_(namaFromSource) || 'Siswa (' + normalizedNis + ')';
  var safeKelas = sanitizeCellText_(kelasFromSource) || 'VI';

  var newRow = [
    newSiswaId,
    normalizedNis,
    safeNama,
    '',
    safeKelas,
    '',
    '',
    'Perlu Verifikasi'
  ];

  var targetRow = siswaSheet.getLastRow() + 1;
  siswaSheet.getRange(targetRow, 2).setNumberFormat('@');
  siswaSheet.getRange(targetRow, 7).setNumberFormat('@');
  siswaSheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);

  var createdObj = {
    rowIndex: targetRow,
    siswaId: newSiswaId,
    nis: normalizedNis,
    nama: safeNama,
    jenisKelamin: '',
    kelas: safeKelas,
    namaOrangTua: '',
    noHpOrangTua: '',
    status: 'Perlu Verifikasi'
  };

  siswaIndex.byNis[normalizedNis] = createdObj;

  return {
    isNew: true,
    siswa: createdObj
  };
}

function tambahSiswaManual(body, actor) {
  var nis = normalizeNis_(body.nis);
  var nama = sanitizeCellText_(body.nama);
  var jenisKelamin = sanitizeCellText_(body.jenisKelamin);
  var kelas = sanitizeCellText_(body.kelas) || 'VI';
  var namaOrangTua = sanitizeCellText_(body.namaOrangTua);
  var noHpOrangTua = sanitizeCellText_(body.noHpOrangTua);
  var status = body.status ? String(body.status).trim() : 'Aktif';

  if (!nis || !nama) {
    return { ok: false, code: 400, message: 'NIS dan Nama Siswa wajib diisi.' };
  }
  if (['Aktif', 'Perlu Verifikasi', 'Nonaktif'].indexOf(status) === -1) {
    return { ok: false, code: 400, message: 'Status siswa tidak valid.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
  var index = loadSiswaIndex_(siswaSheet);

  if (index.byNis[nis]) {
    return { ok: false, code: 409, message: 'Siswa dengan NIS ' + nis + ' sudah terdaftar.' };
  }

  var newSiswaId = formatPrefixedId_('SIS', index.maxSeq + 1, 4);
  var targetRow = siswaSheet.getLastRow() + 1;
  var rowData = [
    newSiswaId,
    nis,
    nama,
    jenisKelamin,
    kelas,
    namaOrangTua,
    noHpOrangTua,
    status
  ];

  siswaSheet.getRange(targetRow, 2).setNumberFormat('@');
  siswaSheet.getRange(targetRow, 7).setNumberFormat('@');
  siswaSheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);

  writeActivityLog_(actor || 'ADMIN', 'TAMBAH_SISWA', 'Menambahkan siswa ' + newSiswaId + ' (NIS: ' + nis + ')');

  return {
    ok: true,
    message: 'Data siswa berhasil ditambahkan.',
    siswa: {
      siswaId: newSiswaId,
      nis: nis,
      nama: nama,
      jenisKelamin: jenisKelamin,
      kelas: kelas,
      namaOrangTua: namaOrangTua,
      noHpOrangTua: noHpOrangTua,
      status: status
    }
  };
}

function validasiDataSiswa(payload, actor) {
  if (!payload || (!payload.siswaId && !payload.nis)) {
    return { ok: false, code: 400, message: 'siswaId atau nis wajib diisi.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
  var lastRow = siswaSheet.getLastRow();
  if (lastRow < 2) {
    return { ok: false, code: 404, message: 'Data siswa masih kosong.' };
  }

  var numRows = lastRow - 1;
  var displayRows = siswaSheet.getRange(2, 1, numRows, SHEET_SCHEMAS.Siswa.length).getDisplayValues();
  var targetRowIdx = -1;
  var currentRow = null;

  var searchId = payload.siswaId ? String(payload.siswaId).trim() : '';
  var searchNis = payload.nis ? normalizeNis_(payload.nis) : '';

  for (var i = 0; i < displayRows.length; i++) {
    var row = displayRows[i];
    if ((searchId && row[0].trim() === searchId) || (!searchId && searchNis && normalizeNis_(row[1]) === searchNis)) {
      targetRowIdx = i + 2;
      currentRow = row;
      break;
    }
  }

  if (targetRowIdx === -1) {
    return { ok: false, code: 404, message: 'Siswa tidak ditemukan.' };
  }

  var allowedStatus = ['Aktif', 'Perlu Verifikasi', 'Nonaktif'];
  var newStatus = payload.status ? String(payload.status).trim() : currentRow[7];
  if (allowedStatus.indexOf(newStatus) === -1) {
    return { ok: false, code: 400, message: 'Status siswa tidak valid. Pilihan: Aktif, Perlu Verifikasi, Nonaktif.' };
  }

  var newNis = payload.nisBaru !== undefined ? normalizeNis_(payload.nisBaru) : normalizeNis_(currentRow[1]);
  if (!newNis) {
    return { ok: false, code: 400, message: 'NIS tidak boleh kosong.' };
  }

  if (newNis !== normalizeNis_(currentRow[1])) {
    for (var j = 0; j < displayRows.length; j++) {
      if (j + 2 !== targetRowIdx && normalizeNis_(displayRows[j][1]) === newNis) {
        return { ok: false, code: 409, message: 'NIS ' + newNis + ' sudah digunakan oleh siswa lain.' };
      }
    }
  }

  var updatedRow = [
    currentRow[0],
    newNis,
    payload.nama !== undefined ? sanitizeCellText_(payload.nama) : currentRow[2],
    payload.jenisKelamin !== undefined ? sanitizeCellText_(payload.jenisKelamin) : currentRow[3],
    payload.kelas !== undefined ? sanitizeCellText_(payload.kelas) : currentRow[4],
    payload.namaOrangTua !== undefined ? sanitizeCellText_(payload.namaOrangTua) : currentRow[5],
    payload.noHpOrangTua !== undefined ? sanitizeCellText_(payload.noHpOrangTua) : currentRow[6],
    newStatus
  ];

  siswaSheet.getRange(targetRowIdx, 2).setNumberFormat('@');
  siswaSheet.getRange(targetRowIdx, 7).setNumberFormat('@');
  siswaSheet.getRange(targetRowIdx, 1, 1, updatedRow.length).setValues([updatedRow]);

  writeActivityLog_(
    actor || 'ADMIN',
    'VALIDASI_SISWA',
    'Memperbarui siswa ' + updatedRow[0] + ' (NIS: ' + updatedRow[1] + ', Status: ' + updatedRow[7] + ')'
  );

  return {
    ok: true,
    message: 'Data siswa berhasil diperbarui.',
    siswa: {
      siswaId: updatedRow[0],
      nis: updatedRow[1],
      nama: updatedRow[2],
      jenisKelamin: updatedRow[3],
      kelas: updatedRow[4],
      namaOrangTua: updatedRow[5],
      noHpOrangTua: updatedRow[6],
      status: updatedRow[7]
    }
  };
}

/* ============================================================================
 * 5. MANAJEMEN SUMBER TRYOUT & CATATAN GURU
 * ============================================================================ */

function tambahSumberTryout(body, auth) {
  var mataPelajaran = sanitizeCellText_(body.mataPelajaran);
  var namaTryout = sanitizeCellText_(body.namaTryout);
  var spreadsheetId = body.spreadsheetId ? String(body.spreadsheetId).trim() : '';
  var sheetGid = body.sheetGid ? String(body.sheetGid).trim() : '';

  if (!mataPelajaran || !namaTryout || !spreadsheetId || !sheetGid) {
    return { ok: false, code: 400, message: 'Mata Pelajaran, Nama Tryout, Spreadsheet ID, dan Sheet GID wajib diisi.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var sumberSheet = ensureSheetExists_(ss, SHEET_NAMES.SUMBER_TRYOUT);
  var tryoutSheet = ensureSheetExists_(ss, SHEET_NAMES.TRYOUT);

  var maxSeq = getMaxIdSequenceInColumn_(sumberSheet, 0);
  var newSumberId = formatPrefixedId_('SRC', maxSeq + 1, 3);

  appendRowWithTextFormat_(
    sumberSheet,
    [newSumberId, mataPelajaran, namaTryout, spreadsheetId, sheetGid, 'Aktif', ''],
    [3, 4]
  );

  var tryoutIndex = loadTryoutIndex_(tryoutSheet);
  ensureTryoutRecord_(tryoutSheet, tryoutIndex, {
    sumberId: newSumberId,
    namaTryout: namaTryout,
    mataPelajaran: mataPelajaran
  });

  writeActivityLog_(auth.userId, 'TAMBAH_SUMBER', 'Menambahkan sumber tryout ' + namaTryout + ' (' + newSumberId + ')');
  return { ok: true, message: 'Sumber tryout berhasil ditambahkan.', sumberId: newSumberId };
}

function toggleStatusSumber(body, auth) {
  var sumberId = body.sumberId ? String(body.sumberId).trim() : '';
  var status = body.status ? String(body.status).trim() : '';
  if (!sumberId || ['Aktif', 'Nonaktif'].indexOf(status) === -1) {
    return { ok: false, code: 400, message: 'sumberId wajib diisi dan status harus Aktif atau Nonaktif.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var sumberSheet = ensureSheetExists_(ss, SHEET_NAMES.SUMBER_TRYOUT);
  var list = readSumberTryoutList_(sumberSheet);

  for (var i = 0; i < list.length; i++) {
    if (list[i].sumberId === sumberId) {
      sumberSheet.getRange(list[i].rowIndex, 6).setValue(status);
      writeActivityLog_(auth.userId, 'UBAH_STATUS_SUMBER', sumberId + ' -> ' + status);
      return { ok: true, message: 'Status sumber tryout diperbarui menjadi ' + status + '.' };
    }
  }

  return { ok: false, code: 404, message: 'Sumber tryout tidak ditemukan.' };
}

function tambahCatatanGuru(body, auth) {
  var siswaId = body.siswaId ? String(body.siswaId).trim() : '';
  var tryoutId = body.tryoutId ? String(body.tryoutId).trim() : '';
  var catatan = sanitizeCellText_(body.catatan);
  var rekomendasi = sanitizeCellText_(body.rekomendasi);

  if (!siswaId || !catatan) {
    return { ok: false, code: 400, message: 'Siswa dan isi catatan guru wajib diisi.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
  if (!findSiswaById_(siswaSheet, siswaId)) {
    return { ok: false, code: 404, message: 'Siswa tidak ditemukan.' };
  }

  var catatanSheet = ensureSheetExists_(ss, SHEET_NAMES.CATATAN_GURU);
  var maxSeq = getMaxIdSequenceInColumn_(catatanSheet, 0);
  var newCatatanId = formatPrefixedId_('CTN', maxSeq + 1, 5);
  var tanggal = formatNow_();
  var namaGuru = auth.nama || auth.actor || 'Guru';

  catatanSheet.appendRow([
    newCatatanId,
    siswaId,
    tryoutId,
    catatan,
    rekomendasi,
    namaGuru,
    tanggal
  ]);

  writeActivityLog_(auth.userId, 'TAMBAH_CATATAN_GURU', 'Menambahkan catatan ' + newCatatanId + ' untuk siswa ' + siswaId);

  return {
    ok: true,
    message: 'Catatan guru berhasil disimpan.',
    catatan: {
      catatanId: newCatatanId,
      siswaId: siswaId,
      tryoutId: tryoutId,
      catatan: catatan,
      rekomendasi: rekomendasi,
      guru: namaGuru,
      tanggal: tanggal
    }
  };
}

function hapusCatatanGuru(body, auth) {
  var catatanId = body.catatanId ? String(body.catatanId).trim() : '';
  if (!catatanId) {
    return { ok: false, code: 400, message: 'catatanId wajib diisi.' };
  }

  var ss = getDatabaseSpreadsheet_();
  var catatanSheet = ensureSheetExists_(ss, SHEET_NAMES.CATATAN_GURU);
  var lastRow = catatanSheet.getLastRow();
  if (lastRow < 2) {
    return { ok: false, code: 404, message: 'Catatan tidak ditemukan.' };
  }

  var ids = catatanSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === catatanId) {
      catatanSheet.deleteRow(i + 2);
      writeActivityLog_(auth.userId, 'HAPUS_CATATAN_GURU', 'Menghapus catatan ' + catatanId);
      return { ok: true, message: 'Catatan guru berhasil dihapus.' };
    }
  }

  return { ok: false, code: 404, message: 'Catatan tidak ditemukan.' };
}

/* ============================================================================
 * 6. FUNGSI REKAP NILAI, DETAIL SISWA, & PORTAL WALI MURID (TAHAP 3-7)
 * ============================================================================ */

function getRekapNilai(filters) {
  var opts = filters || {};
  var ss = getDatabaseSpreadsheet_();
  var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
  var tryoutSheet = ensureSheetExists_(ss, SHEET_NAMES.TRYOUT);
  var hasilSheet = ensureSheetExists_(ss, SHEET_NAMES.HASIL);

  var siswaList = readAllSiswa_(siswaSheet);
  var tryoutList = readAllTryout_(tryoutSheet);
  var hasilList = readAllHasil_(hasilSheet);

  var tryoutById = {};
  for (var t = 0; t < tryoutList.length; t++) {
    tryoutById[tryoutList[t].tryoutId] = tryoutList[t];
  }

  var hasilBySiswa = {};
  var siswaSudahIkutSet = {};

  for (var h = 0; h < hasilList.length; h++) {
    var item = hasilList[h];
    if (String(item.status).toLowerCase() !== 'valid') {
      continue;
    }
    siswaSudahIkutSet[item.siswaId] = true;

    if (!hasilBySiswa[item.siswaId]) {
      hasilBySiswa[item.siswaId] = {};
    }

    var prev = hasilBySiswa[item.siswaId][item.tryoutId];
    if (!prev || isNewerResult_(item, prev)) {
      var attemptCount = prev ? prev.jumlahPercobaan + 1 : 1;
      hasilBySiswa[item.siswaId][item.tryoutId] = {
        hasilId: item.hasilId,
        tryoutId: item.tryoutId,
        sumberId: item.sumberId,
        tanggal: item.tanggal,
        mataPelajaran: item.mataPelajaran,
        benar: item.benar,
        totalSoal: item.totalSoal,
        nilai: item.nilai,
        sourceRow: item.sourceRow,
        jumlahPercobaan: attemptCount
      };
    } else {
      prev.jumlahPercobaan = prev.jumlahPercobaan + 1;
    }
  }

  var searchQuery = opts.search ? String(opts.search).trim().toLowerCase() : '';
  var filterKelas = opts.kelas ? String(opts.kelas).trim().toLowerCase() : '';
  var filterMapel = opts.mataPelajaran ? String(opts.mataPelajaran).trim() : '';
  var filterStatus = opts.statusSiswa ? String(opts.statusSiswa).trim().toLowerCase() : '';

  var rekapRows = [];
  var allBiScores = [];
  var allMtkScores = [];
  var allValidScores = [];
  var studentAveragesForDistribution = [];
  var maxScore = null;
  var minScore = null;
  var siswaAktifDanVerifikasi = 0;
  var kelasSet = {};

  for (var s = 0; s < siswaList.length; s++) {
    var st = siswaList[s];
    if (st.kelas) kelasSet[st.kelas] = true;

    if (String(st.status).toLowerCase() !== 'nonaktif') {
      siswaAktifDanVerifikasi++;
    }

    var mapTryout = hasilBySiswa[st.siswaId] || {};

    var bi1 = extractTryoutScore_(mapTryout, 'TO-BI-1', tryoutById, 'Bahasa Indonesia', 1);
    var bi2 = extractTryoutScore_(mapTryout, 'TO-BI-2', tryoutById, 'Bahasa Indonesia', 2);
    var mtk1 = extractTryoutScore_(mapTryout, 'TO-MTK-1', tryoutById, 'Matematika', 1);
    var mtk2 = extractTryoutScore_(mapTryout, 'TO-MTK-2', tryoutById, 'Matematika', 2);

    var biScores = [bi1, bi2].filter(isValidNumber_);
    var mtkScores = [mtk1, mtk2].filter(isValidNumber_);

    var extraScores = [];
    var tryoutIdsForSiswa = Object.keys(mapTryout);
    for (var k = 0; k < tryoutIdsForSiswa.length; k++) {
      var tid = tryoutIdsForSiswa[k];
      var rec = mapTryout[tid];
      if (rec && isValidNumber_(rec.nilai)) {
        extraScores.push(rec);
      }
    }

    var rataBI = computeAverage_(biScores);
    var rataMTK = computeAverage_(mtkScores);

    var selectedScores = [];
    if (filterMapel === 'Bahasa Indonesia') {
      selectedScores = biScores;
    } else if (filterMapel === 'Matematika') {
      selectedScores = mtkScores;
    } else {
      selectedScores = biScores.concat(mtkScores);
    }

    var rataRata = computeAverage_(selectedScores);

    var progressBi = (bi1 !== null && bi2 !== null) ? roundScore_(bi2 - bi1) : null;
    var progressMtk = (mtk1 !== null && mtk2 !== null) ? roundScore_(mtk2 - mtk1) : null;
    var progressGabungan = computeCombinedProgress_(progressBi, progressMtk);

    if (String(st.status).toLowerCase() !== 'nonaktif') {
      for (var b = 0; b < biScores.length; b++) {
        allBiScores.push(biScores[b]);
        allValidScores.push(biScores[b]);
        if (maxScore === null || biScores[b] > maxScore) maxScore = biScores[b];
        if (minScore === null || biScores[b] < minScore) minScore = biScores[b];
      }
      for (var m = 0; m < mtkScores.length; m++) {
        allMtkScores.push(mtkScores[m]);
        allValidScores.push(mtkScores[m]);
        if (maxScore === null || mtkScores[m] > maxScore) maxScore = mtkScores[m];
        if (minScore === null || mtkScores[m] < minScore) minScore = mtkScores[m];
      }
      var avgGlobalSiswa = computeAverage_(biScores.concat(mtkScores));
      if (avgGlobalSiswa !== null) {
        studentAveragesForDistribution.push(avgGlobalSiswa);
      }
    }

    if (searchQuery) {
      var matchNama = st.nama.toLowerCase().indexOf(searchQuery) !== -1;
      var matchNis = st.nis.toLowerCase().indexOf(searchQuery) !== -1;
      if (!matchNama && !matchNis) {
        continue;
      }
    }
    if (filterKelas && st.kelas.toLowerCase() !== filterKelas) {
      continue;
    }
    if (filterStatus && st.status.toLowerCase() !== filterStatus) {
      continue;
    }

    rekapRows.push({
      siswaId: st.siswaId,
      nis: st.nis,
      nama: st.nama,
      kelas: st.kelas,
      status: st.status,
      bi1: bi1,
      bi2: bi2,
      mtk1: mtk1,
      mtk2: mtk2,
      bi1Display: formatScoreOrDash_(bi1),
      bi2Display: formatScoreOrDash_(bi2),
      mtk1Display: formatScoreOrDash_(mtk1),
      mtk2Display: formatScoreOrDash_(mtk2),
      rataBI: rataBI,
      rataMTK: rataMTK,
      rataRata: rataRata,
      rataRataDisplay: formatScoreOrDash_(rataRata),
      progressBI: progressBi,
      progressMTK: progressMtk,
      progress: progressGabungan,
      jumlahTryoutDiikuti: extraScores.length
    });
  }

  sortRekapRows_(rekapRows, opts.sortBy || 'nama');

  var perTryoutStats = computePerTryoutStats_(tryoutList, hasilBySiswa);
  var distribusiKategori = computeScoreDistribution_(studentAveragesForDistribution);

  return {
    ok: true,
    ringkasan: {
      totalSiswa: siswaAktifDanVerifikasi,
      totalTryout: tryoutList.length,
      siswaSudahTryout: Object.keys(siswaSudahIkutSet).length,
      rataRataBahasaIndonesia: computeAverage_(allBiScores),
      rataRataMatematika: computeAverage_(allMtkScores),
      rataRataKeseluruhan: computeAverage_(allValidScores),
      nilaiTertinggi: maxScore,
      nilaiTerendah: minScore
    },
    distribusiKategori: distribusiKategori,
    perTryout: perTryoutStats,
    tryoutList: tryoutList,
    kelasList: Object.keys(kelasSet).sort(),
    rekap: rekapRows
  };
}

/**
 * Mengambil detail lengkap perkembangan 1 siswa.
 * KEAMANAN: Jika role === 'wali', parameter siswaId dari klien DIABAIKAN
 * dan wajib menggunakan auth.siswaId dari sesi server-side.
 */
function getDetailSiswaData(requestedSiswaId, auth) {
  var targetSiswaId = '';
  if (auth.role === 'wali') {
    if (!auth.siswaId) {
      return {
        ok: false,
        code: 403,
        message: 'Akun wali murid belum dihubungkan dengan data siswa. Silakan hubungi Admin SDN 2 Karangmangu.'
      };
    }
    targetSiswaId = auth.siswaId;
  } else {
    targetSiswaId = requestedSiswaId ? String(requestedSiswaId).trim() : '';
    if (!targetSiswaId) {
      return { ok: false, code: 400, message: 'siswaId wajib diisi.' };
    }
  }

  var ss = getDatabaseSpreadsheet_();
  var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
  var tryoutSheet = ensureSheetExists_(ss, SHEET_NAMES.TRYOUT);
  var hasilSheet = ensureSheetExists_(ss, SHEET_NAMES.HASIL);
  var detailSheet = ensureSheetExists_(ss, SHEET_NAMES.DETAIL_NILAI);
  var catatanSheet = ensureSheetExists_(ss, SHEET_NAMES.CATATAN_GURU);

  var siswa = findSiswaById_(siswaSheet, targetSiswaId);
  if (!siswa) {
    return { ok: false, code: 404, message: 'Data siswa tidak ditemukan.' };
  }

  var tryoutList = readAllTryout_(tryoutSheet);
  var tryoutById = {};
  for (var t = 0; t < tryoutList.length; t++) {
    tryoutById[tryoutList[t].tryoutId] = tryoutList[t];
  }

  var allHasil = readAllHasil_(hasilSheet);
  var siswaHasil = allHasil.filter(function (h) {
    return h.siswaId === targetSiswaId && String(h.status).toLowerCase() === 'valid';
  });

  // Kelompokkan percobaan terbaru per TryoutID untuk rekap mapel
  var latestByTryout = {};
  var riwayatTryout = [];
  var hasilIdSet = {};

  for (var i = 0; i < siswaHasil.length; i++) {
    var rec = siswaHasil[i];
    hasilIdSet[rec.hasilId] = true;
    var toMeta = tryoutById[rec.tryoutId];
    riwayatTryout.push({
      hasilId: rec.hasilId,
      tryoutId: rec.tryoutId,
      namaTryout: toMeta ? toMeta.namaTryout : rec.tryoutId,
      mataPelajaran: rec.mataPelajaran,
      tanggal: rec.tanggal,
      benar: rec.benar,
      totalSoal: rec.totalSoal,
      nilai: rec.nilai
    });

    var prev = latestByTryout[rec.tryoutId];
    if (!prev || isNewerResult_(rec, prev)) {
      latestByTryout[rec.tryoutId] = rec;
    }
  }

  riwayatTryout.sort(function (a, b) {
    return String(a.tanggal || '').localeCompare(String(b.tanggal || ''));
  });

  var bi1 = extractTryoutScore_(latestByTryout, 'TO-BI-1', tryoutById, 'Bahasa Indonesia', 1);
  var bi2 = extractTryoutScore_(latestByTryout, 'TO-BI-2', tryoutById, 'Bahasa Indonesia', 2);
  var mtk1 = extractTryoutScore_(latestByTryout, 'TO-MTK-1', tryoutById, 'Matematika', 1);
  var mtk2 = extractTryoutScore_(latestByTryout, 'TO-MTK-2', tryoutById, 'Matematika', 2);

  var biValid = [bi1, bi2].filter(isValidNumber_);
  var mtkValid = [mtk1, mtk2].filter(isValidNumber_);
  var allValid = biValid.concat(mtkValid);

  var rekapBI = {
    to1: bi1,
    to2: bi2,
    rataRata: computeAverage_(biValid),
    tertinggi: biValid.length > 0 ? Math.max.apply(null, biValid) : null,
    terendah: biValid.length > 0 ? Math.min.apply(null, biValid) : null,
    perubahan: (bi1 !== null && bi2 !== null) ? roundScore_(bi2 - bi1) : null
  };

  var rekapMTK = {
    to1: mtk1,
    to2: mtk2,
    rataRata: computeAverage_(mtkValid),
    tertinggi: mtkValid.length > 0 ? Math.max.apply(null, mtkValid) : null,
    terendah: mtkValid.length > 0 ? Math.min.apply(null, mtkValid) : null,
    perubahan: (mtk1 !== null && mtk2 !== null) ? roundScore_(mtk2 - mtk1) : null
  };

  // Baca DetailNilai jika tersedia (tanpa mengarang jika kosong)
  var detailMateri = readDetailNilaiByHasilIds_(detailSheet, hasilIdSet);

  // Baca CatatanGuru untuk siswa ini
  var catatanGuru = readCatatanBySiswaId_(catatanSheet, targetSiswaId, tryoutById);

  // Susun evaluasi objektif berbasis data nyata
  var evaluasi = buildEvaluasiObjektif_(rekapBI, rekapMTK, detailMateri, riwayatTryout.length);

  return {
    ok: true,
    siswa: {
      siswaId: siswa.siswaId,
      nis: siswa.nis,
      nama: siswa.nama,
      jenisKelamin: siswa.jenisKelamin,
      kelas: siswa.kelas,
      namaOrangTua: siswa.namaOrangTua,
      noHpOrangTua: auth.role === 'wali' ? '' : siswa.noHpOrangTua,
      status: siswa.status
    },
    statistik: {
      rataRataBI: rekapBI.rataRata,
      rataRataMTK: rekapMTK.rataRata,
      rataRataKeseluruhan: computeAverage_(allValid),
      jumlahTryoutDiikuti: Object.keys(latestByTryout).length
    },
    rekapBI: rekapBI,
    rekapMTK: rekapMTK,
    riwayatTryout: riwayatTryout,
    detailMateri: detailMateri,
    evaluasi: evaluasi,
    catatanGuru: catatanGuru
  };
}

function buildEvaluasiObjektif_(rekapBI, rekapMTK, detailMateri, totalRiwayat) {
  var rataBI = rekapBI.rataRata;
  var rataMTK = rekapMTK.rataRata;
  var kelebihan = [];
  var perluDitingkatkan = [];
  var mataPelajaranLebihBaik = '-';
  var ringkasanPerkembangan = '';

  if (totalRiwayat === 0) {
    ringkasanPerkembangan = 'Siswa belum memiliki data hasil tryout yang tercatat.';
  } else {
    if (rataBI !== null && rataMTK !== null) {
      if (rataBI > rataMTK) {
        mataPelajaranLebihBaik = 'Bahasa Indonesia (' + rataBI + ' vs ' + rataMTK + ')';
        kelebihan.push('Capaian rata-rata Bahasa Indonesia (' + rataBI + ') lebih unggul dibanding Matematika (' + rataMTK + ').');
        perluDitingkatkan.push('Penguatan pemahaman dan ketelitian soal pada mata pelajaran Matematika (' + rataMTK + ').');
      } else if (rataMTK > rataBI) {
        mataPelajaranLebihBaik = 'Matematika (' + rataMTK + ' vs ' + rataBI + ')';
        kelebihan.push('Capaian rata-rata Matematika (' + rataMTK + ') lebih unggul dibanding Bahasa Indonesia (' + rataBI + ').');
        perluDitingkatkan.push('Penguatan pemahaman bacaan dan ketelitian soal pada mata pelajaran Bahasa Indonesia (' + rataBI + ').');
      } else {
        mataPelajaranLebihBaik = 'Seimbang (' + rataBI + ')';
        kelebihan.push('Capaian rata-rata Bahasa Indonesia dan Matematika seimbang pada nilai ' + rataBI + '.');
      }
    } else if (rataBI !== null) {
      mataPelajaranLebihBaik = 'Bahasa Indonesia (' + rataBI + ')';
      kelebihan.push('Telah menyelesaikan tryout Bahasa Indonesia dengan rata-rata ' + rataBI + '.');
      perluDitingkatkan.push('Belum terdapat nilai tryout Matematika yang tercatat.');
    } else if (rataMTK !== null) {
      mataPelajaranLebihBaik = 'Matematika (' + rataMTK + ')';
      kelebihan.push('Telah menyelesaikan tryout Matematika dengan rata-rata ' + rataMTK + '.');
      perluDitingkatkan.push('Belum terdapat nilai tryout Bahasa Indonesia yang tercatat.');
    }

    if (rekapBI.perubahan !== null) {
      if (rekapBI.perubahan > 0) {
        kelebihan.push('Nilai Bahasa Indonesia meningkat +' + rekapBI.perubahan + ' poin dari Tryout 1 ke Tryout 2.');
      } else if (rekapBI.perubahan < 0) {
        perluDitingkatkan.push('Nilai Bahasa Indonesia menurun ' + rekapBI.perubahan + ' poin dari Tryout 1 ke Tryout 2.');
      }
    }

    if (rekapMTK.perubahan !== null) {
      if (rekapMTK.perubahan > 0) {
        kelebihan.push('Nilai Matematika meningkat +' + rekapMTK.perubahan + ' poin dari Tryout 1 ke Tryout 2.');
      } else if (rekapMTK.perubahan < 0) {
        perluDitingkatkan.push('Nilai Matematika menurun ' + rekapMTK.perubahan + ' poin dari Tryout 1 ke Tryout 2.');
      }
    }

    if (rataBI !== null && rataBI < 75) {
      perluDitingkatkan.push('Rata-rata Bahasa Indonesia masih di bawah target 75.');
    }
    if (rataMTK !== null && rataMTK < 75) {
      perluDitingkatkan.push('Rata-rata Matematika masih di bawah target 75.');
    }

    if (detailMateri.length > 0) {
      var materiSorted = detailMateri.slice().sort(function (a, b) { return b.nilai - a.nilai; });
      kelebihan.push('Materi terkuat tercatat: ' + materiSorted[0].materi + ' (' + materiSorted[0].nilai + ').');
      var terlemah = materiSorted[materiSorted.length - 1];
      if (terlemah.nilai < 75) {
        perluDitingkatkan.push('Materi perlu pendalaman: ' + terlemah.materi + ' (' + terlemah.nilai + ').');
      }
    }

    ringkasanPerkembangan = 'Berdasarkan ' + totalRiwayat + ' riwayat tryout yang tercatat, ' +
      (mataPelajaranLebihBaik !== '-' ? 'mata pelajaran dengan capaian lebih tinggi adalah ' + mataPelajaranLebihBaik + '.' : 'data nilai telah terekap.');
  }

  return {
    hasDetailMateri: detailMateri.length > 0,
    catatanDataMateri: detailMateri.length > 0
      ? ''
      : 'Rincian per kompetensi/materi belum tersedia karena spreadsheet sumber CBT hanya merekap skor total per mata pelajaran.',
    mataPelajaranLebihBaik: mataPelajaranLebihBaik,
    ringkasanPerkembangan: ringkasanPerkembangan,
    kelebihan: kelebihan,
    perluDitingkatkan: perluDitingkatkan
  };
}

/* ============================================================================
 * 7. ENDPOINT REST API WEB APP (doGet & doPost)
 * ============================================================================ */

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action ? String(params.action).trim() : 'ping';

    if (action === 'ping' || action === 'health') {
      return jsonResponse_({
        ok: true,
        app: APP_CONFIG.APP_NAME,
        sekolah: APP_CONFIG.SEKOLAH,
        tahunAjaran: APP_CONFIG.TAHUN_AJARAN,
        version: APP_CONFIG.VERSION,
        timestamp: formatNow_()
      });
    }

    if (action === 'cekSetupAwal') {
      return jsonResponse_(cekStatusSetupAwal_());
    }

    var auth = verifyApiRequest_(params.token);
    if (!auth.ok) {
      return jsonResponse_(auth);
    }

    switch (action) {
      case 'verifySession':
        return jsonResponse_({ ok: true, user: auth });

      case 'statusDatabase':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getDatabaseStatus_());

      case 'getSumberTryout':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getSumberTryoutData_());

      case 'getTryout':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_({
          ok: true,
          tryout: readAllTryout_(ensureSheetExists_(getDatabaseSpreadsheet_(), SHEET_NAMES.TRYOUT))
        });

      case 'getSiswa':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getSiswaData_(params));

      case 'getHasil':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getHasilData_(params));

      case 'getRekapNilai':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getRekapNilai({
          search: params.search,
          kelas: params.kelas,
          mataPelajaran: params.mataPelajaran,
          statusSiswa: params.statusSiswa,
          sortBy: params.sortBy
        }));

      case 'getDetailSiswa':
      case 'getPortalWali':
      case 'getLaporanSiswa':
        requireRole_(auth, ['admin', 'guru', 'wali']);
        return jsonResponse_(getDetailSiswaData(params.siswaId, auth));

      default:
        return jsonResponse_({
          ok: false,
          code: 400,
          message: 'Action GET tidak dikenali: ' + action
        });
    }
  } catch (err) {
    return jsonResponse_({
      ok: false,
      code: err.statusCode || 500,
      message: err.message || 'Terjadi kesalahan pada server.'
    });
  }
}

function doPost(e) {
  try {
    var body = parsePostBody_(e);
    var action = body.action ? String(body.action).trim() : '';

    if (!action) {
      return jsonResponse_({
        ok: false,
        code: 400,
        message: 'Parameter action wajib dikirimkan.'
      });
    }

    // Endpoint publik pra-autentikasi
    if (action === 'ping' || action === 'health') {
      return jsonResponse_({
        ok: true,
        app: APP_CONFIG.APP_NAME,
        sekolah: APP_CONFIG.SEKOLAH,
        tahunAjaran: APP_CONFIG.TAHUN_AJARAN,
        version: APP_CONFIG.VERSION,
        timestamp: formatNow_()
      });
    }
    if (action === 'cekSetupAwal') {
      return jsonResponse_(cekStatusSetupAwal_());
    }
    if (action === 'setupAdminPertama') {
      return jsonResponse_(setupAdminPertama(body));
    }
    if (action === 'login') {
      return jsonResponse_(loginUser(body));
    }

    // Seluruh endpoint di bawah ini wajib memiliki token sesi valid
    var auth = verifyApiRequest_(body.token);
    if (!auth.ok) {
      return jsonResponse_(auth);
    }

    switch (action) {
      case 'verifySession':
        return jsonResponse_({
          ok: true,
          user: {
            userId: auth.userId,
            username: auth.actor,
            role: auth.role,
            nama: auth.nama,
            siswaId: auth.siswaId
          }
        });

      case 'logout':
        return jsonResponse_(logoutUser(body.token, auth));

      case 'ubahPassword':
        requireRole_(auth, ['admin', 'guru', 'wali']);
        return jsonResponse_(ubahPasswordSendiri(body, auth));

      // --- Manajemen Database & Sinkronisasi ---
      case 'setupDatabase':
        requireRole_(auth, ['admin']);
        return jsonResponse_(setupDatabase());

      case 'setupSumberTryout':
        requireRole_(auth, ['admin']);
        return jsonResponse_(setupSumberTryout());

      case 'sinkronkanDataTryout':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(sinkronkanDataTryout(auth.actor));

      case 'tambahSumberTryout':
        requireRole_(auth, ['admin']);
        return jsonResponse_(tambahSumberTryout(body, auth));

      case 'toggleStatusSumber':
        requireRole_(auth, ['admin']);
        return jsonResponse_(toggleStatusSumber(body, auth));

      // --- Manajemen Siswa ---
      case 'getSiswa':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getSiswaData_(body));

      case 'tambahSiswa':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(tambahSiswaManual(body, auth.actor));

      case 'validasiDataSiswa':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(validasiDataSiswa(body, auth.actor));

      // --- Rekap, Hasil, & Detail Siswa / Wali ---
      case 'getRekapNilai':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getRekapNilai({
          search: body.search,
          kelas: body.kelas,
          mataPelajaran: body.mataPelajaran,
          statusSiswa: body.statusSiswa,
          sortBy: body.sortBy
        }));

      case 'getSumberTryout':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getSumberTryoutData_());

      case 'getTryout':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_({
          ok: true,
          tryout: readAllTryout_(ensureSheetExists_(getDatabaseSpreadsheet_(), SHEET_NAMES.TRYOUT))
        });

      case 'getHasil':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getHasilData_(body));

      case 'statusDatabase':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(getDatabaseStatus_());

      case 'getDetailSiswa':
      case 'getPortalWali':
      case 'getLaporanSiswa':
        requireRole_(auth, ['admin', 'guru', 'wali']);
        return jsonResponse_(getDetailSiswaData(body.siswaId, auth));

      // --- Catatan Guru ---
      case 'tambahCatatanGuru':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(tambahCatatanGuru(body, auth));

      case 'hapusCatatanGuru':
        requireRole_(auth, ['admin', 'guru']);
        return jsonResponse_(hapusCatatanGuru(body, auth));

      // --- Manajemen Pengguna (Hanya Admin) ---
      case 'getUsers':
        requireRole_(auth, ['admin']);
        return jsonResponse_(getUsersList_(ensureSheetExists_(getDatabaseSpreadsheet_(), SHEET_NAMES.USERS)));

      case 'tambahUser':
        requireRole_(auth, ['admin']);
        return jsonResponse_(tambahUserBaru(body, auth));

      case 'updateUser':
        requireRole_(auth, ['admin']);
        return jsonResponse_(updateUserData(body, auth));

      case 'resetPasswordUser':
        requireRole_(auth, ['admin']);
        return jsonResponse_(resetPasswordUser(body, auth));

      default:
        return jsonResponse_({
          ok: false,
          code: 400,
          message: 'Action POST tidak dikenali: ' + action
        });
    }
  } catch (err) {
    return jsonResponse_({
      ok: false,
      code: err.statusCode || 500,
      message: err.message || 'Terjadi kesalahan pada server.'
    });
  }
}

/* ============================================================================
 * 8. FUNGSI PENGUJIAN TAHAP 1-8 (DIJALANKAN DARI APPS SCRIPT EDITOR)
 * ============================================================================ */

function testTahap1() {
  Logger.log('=== MULAI PENGUJIAN BACKEND ===');
  var dbSetup = setupDatabase();
  var syncResult = sinkronkanDataTryout('TEST_EDITOR');
  var rekapResult = getRekapNilai({});
  Logger.log('Ringkasan: ' + JSON.stringify(rekapResult.ringkasan));
  return {
    dbSetup: dbSetup,
    syncResult: syncResult,
    ringkasan: rekapResult.ringkasan
  };
}

/* ============================================================================
 * 9. HELPER INTERNAL DATABASE, KRIPTOGRAFI, & UTILITAS
 * ============================================================================ */

function generateSalt_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 24);
}

function hashPassword_(password, salt) {
  var current = String(salt) + ':' + String(password);
  for (var i = 0; i < APP_CONFIG.PASSWORD_HASH_ROUNDS; i++) {
    var digestBytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      current,
      Utilities.Charset.UTF_8
    );
    current = bytesToHex_(digestBytes);
  }
  return current;
}

function bytesToHex_(bytes) {
  var hex = [];
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    var s = b.toString(16);
    if (s.length === 1) s = '0' + s;
    hex.push(s);
  }
  return hex.join('');
}

function normalizeUsername_(raw) {
  if (!raw) return '';
  return String(raw).trim().toLowerCase();
}

function isValidUsername_(username) {
  return /^[a-z0-9._]{4,32}$/.test(username);
}

function findUserByUsername_(usersSheet, username) {
  var lastRow = usersSheet.getLastRow();
  if (lastRow < 2) return null;
  var rows = usersSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Users.length).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (normalizeUsername_(r[1]) === username) {
      return {
        rowIndex: i + 2,
        userId: String(r[0]).trim(),
        username: normalizeUsername_(r[1]),
        passwordHash: String(r[2]).trim(),
        salt: String(r[3]).trim(),
        role: String(r[4]).trim().toLowerCase(),
        nama: String(r[5]).trim(),
        siswaId: String(r[6]).trim(),
        status: String(r[7]).trim(),
        createdAt: String(r[8]).trim()
      };
    }
  }
  return null;
}

function findUserById_(usersSheet, userId) {
  var lastRow = usersSheet.getLastRow();
  if (lastRow < 2) return null;
  var rows = usersSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Users.length).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[0]).trim() === userId) {
      return {
        rowIndex: i + 2,
        userId: String(r[0]).trim(),
        username: normalizeUsername_(r[1]),
        passwordHash: String(r[2]).trim(),
        salt: String(r[3]).trim(),
        role: String(r[4]).trim().toLowerCase(),
        nama: String(r[5]).trim(),
        siswaId: String(r[6]).trim(),
        status: String(r[7]).trim(),
        createdAt: String(r[8]).trim()
      };
    }
  }
  return null;
}

function findSiswaById_(siswaSheet, siswaId) {
  var all = readAllSiswa_(siswaSheet);
  for (var i = 0; i < all.length; i++) {
    if (all[i].siswaId === siswaId) return all[i];
  }
  return null;
}

function getMaxIdSequenceInColumn_(sheet, zeroBasedColIdx) {
  var maxSeq = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var vals = sheet.getRange(2, zeroBasedColIdx + 1, lastRow - 1, 1).getDisplayValues();
  for (var i = 0; i < vals.length; i++) {
    var seq = parseIdSequence_(vals[i][0]);
    if (seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}

function readDetailNilaiByHasilIds_(detailSheet, hasilIdSet) {
  var list = [];
  var lastRow = detailSheet.getLastRow();
  if (lastRow < 2) return list;
  var range = detailSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.DetailNilai.length);
  var vals = range.getValues();
  var disp = range.getDisplayValues();
  for (var i = 0; i < disp.length; i++) {
    var hasilId = String(disp[i][1]).trim();
    if (!hasilIdSet[hasilId]) continue;
    list.push({
      detailId: String(disp[i][0]).trim(),
      hasilId: hasilId,
      mataPelajaran: String(disp[i][2]).trim(),
      materi: String(disp[i][3]).trim(),
      jumlahSoal: parseNumberSafe_(vals[i][4], disp[i][4]) || 0,
      benar: parseNumberSafe_(vals[i][5], disp[i][5]) || 0,
      salah: parseNumberSafe_(vals[i][6], disp[i][6]) || 0,
      kosong: parseNumberSafe_(vals[i][7], disp[i][7]) || 0,
      nilai: parseNumberSafe_(vals[i][8], disp[i][8]) || 0
    });
  }
  return list;
}

function readCatatanBySiswaId_(catatanSheet, siswaId, tryoutById) {
  var list = [];
  var lastRow = catatanSheet.getLastRow();
  if (lastRow < 2) return list;
  var rows = catatanSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.CatatanGuru.length).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[1]).trim() !== siswaId) continue;
    var tid = String(r[2]).trim();
    var toMeta = tid && tryoutById[tid] ? tryoutById[tid] : null;
    list.push({
      catatanId: String(r[0]).trim(),
      siswaId: siswaId,
      tryoutId: tid,
      namaTryout: toMeta ? toMeta.namaTryout : (tid || 'Umum'),
      catatan: String(r[3]).trim(),
      rekomendasi: String(r[4]).trim(),
      guru: String(r[5]).trim(),
      tanggal: String(r[6]).trim()
    });
  }
  list.sort(function (a, b) {
    return String(b.tanggal).localeCompare(String(a.tanggal));
  });
  return list;
}

function computeScoreDistribution_(averages) {
  var dist = {
    sangatBaik: 0, // >= 90
    baik: 0,       // 75 - 89.99
    cukup: 0,      // 60 - 74.99
    perluBimbingan: 0 // < 60
  };
  for (var i = 0; i < averages.length; i++) {
    var n = averages[i];
    if (n >= 90) dist.sangatBaik++;
    else if (n >= 75) dist.baik++;
    else if (n >= 60) dist.cukup++;
    else dist.perluBimbingan++;
  }
  return dist;
}

function getOrCreateDatabaseSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty(PROP_KEYS.DB_SPREADSHEET_ID);

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {
      // Lanjut cek active spreadsheet
    }
  }

  var activeSs = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSs) {
    props.setProperty(PROP_KEYS.DB_SPREADSHEET_ID, activeSs.getId());
    return activeSs;
  }

  var createdSs = SpreadsheetApp.create(APP_CONFIG.DB_NAME);
  props.setProperty(PROP_KEYS.DB_SPREADSHEET_ID, createdSs.getId());
  return createdSs;
}

function getDatabaseSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty(PROP_KEYS.DB_SPREADSHEET_ID);

  if (savedId) {
    return SpreadsheetApp.openById(savedId);
  }

  var activeSs = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSs) {
    props.setProperty(PROP_KEYS.DB_SPREADSHEET_ID, activeSs.getId());
    return activeSs;
  }

  throw new Error('Database pusat belum diinisialisasi. Jalankan setupDatabase() terlebih dahulu.');
}

function ensureSheetExists_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initializeSheetHeader_(sheet, SHEET_SCHEMAS[sheetName]);
    applyTextColumnFormats_(sheet, sheetName);
  } else if (sheet.getLastRow() === 0) {
    initializeSheetHeader_(sheet, SHEET_SCHEMAS[sheetName]);
    applyTextColumnFormats_(sheet, sheetName);
  }
  return sheet;
}

function initializeSheetHeader_(sheet, headers) {
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0f294a');
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function applyTextColumnFormats_(sheet, sheetName) {
  var maxRows = Math.max(sheet.getMaxRows(), 100);
  if (sheetName === SHEET_NAMES.SISWA) {
    sheet.getRange(1, 2, maxRows, 1).setNumberFormat('@');
    sheet.getRange(1, 7, maxRows, 1).setNumberFormat('@');
  } else if (sheetName === SHEET_NAMES.HASIL) {
    sheet.getRange(1, 5, maxRows, 1).setNumberFormat('@');
    sheet.getRange(1, 6, maxRows, 1).setNumberFormat('@');
  } else if (sheetName === SHEET_NAMES.SUMBER_TRYOUT) {
    sheet.getRange(1, 5, maxRows, 1).setNumberFormat('@');
    sheet.getRange(1, 7, maxRows, 1).setNumberFormat('@');
  }
}

function appendRowWithTextFormat_(sheet, rowValues, zeroBasedTextColIndexes) {
  var targetRow = sheet.getLastRow() + 1;
  for (var i = 0; i < zeroBasedTextColIndexes.length; i++) {
    var colNum = zeroBasedTextColIndexes[i] + 1;
    sheet.getRange(targetRow, colNum).setNumberFormat('@');
  }
  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
}

function getExistingColumnValueSet_(sheet, zeroBasedColIdx) {
  var set = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return set;

  var vals = sheet.getRange(2, zeroBasedColIdx + 1, lastRow - 1, 1).getDisplayValues();
  for (var i = 0; i < vals.length; i++) {
    var val = String(vals[i][0]).trim();
    if (val) {
      set[val] = true;
    }
  }
  return set;
}

function getExistingTryoutKeyMap_(tryoutSheet) {
  var map = {};
  var lastRow = tryoutSheet.getLastRow();
  if (lastRow < 2) return map;

  var rows = tryoutSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Tryout.length).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var key = buildTryoutKey_(rows[i][1], rows[i][2]);
    if (key) {
      map[key] = rows[i][0];
    }
  }
  return map;
}

function buildTryoutKey_(namaTryout, mataPelajaran) {
  return String(mataPelajaran || '').trim().toLowerCase() + '::' + String(namaTryout || '').trim().toLowerCase();
}

function readSumberTryoutList_(sumberSheet) {
  var list = [];
  var lastRow = sumberSheet.getLastRow();
  if (lastRow < 2) return list;

  var rows = sumberSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.SumberTryout.length).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!String(r[0]).trim()) continue;
    list.push({
      rowIndex: i + 2,
      sumberId: String(r[0]).trim(),
      mataPelajaran: String(r[1]).trim(),
      namaTryout: String(r[2]).trim(),
      spreadsheetId: String(r[3]).trim(),
      sheetGid: String(r[4]).trim(),
      status: String(r[5]).trim(),
      terakhirSync: String(r[6]).trim()
    });
  }
  return list;
}

function updateSumberLastSync_(sumberSheet, rowIndex, timestampStr) {
  var cell = sumberSheet.getRange(rowIndex, 7);
  cell.setNumberFormat('@');
  cell.setValue(timestampStr);
}

function findSheetByGid_(ss, gid) {
  var sheets = ss.getSheets();
  var targetGid = String(gid).trim();
  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getSheetId()) === targetGid) {
      return sheets[i];
    }
  }
  return null;
}

function loadSiswaIndex_(siswaSheet) {
  var byNis = {};
  var maxSeq = 0;
  var lastRow = siswaSheet.getLastRow();

  if (lastRow >= 2) {
    var rows = siswaSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Siswa.length).getDisplayValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var siswaId = String(r[0]).trim();
      var nis = normalizeNis_(r[1]);
      var seq = parseIdSequence_(siswaId);
      if (seq > maxSeq) maxSeq = seq;

      if (nis) {
        byNis[nis] = {
          rowIndex: i + 2,
          siswaId: siswaId,
          nis: nis,
          nama: String(r[2]).trim(),
          jenisKelamin: String(r[3]).trim(),
          kelas: String(r[4]).trim(),
          namaOrangTua: String(r[5]).trim(),
          noHpOrangTua: String(r[6]).trim(),
          status: String(r[7]).trim()
        };
      }
    }
  }

  return {
    byNis: byNis,
    maxSeq: maxSeq
  };
}

function loadTryoutIndex_(tryoutSheet) {
  var byKey = {};
  var maxSeq = 0;
  var lastRow = tryoutSheet.getLastRow();

  if (lastRow >= 2) {
    var rows = tryoutSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Tryout.length).getDisplayValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var tryoutId = String(r[0]).trim();
      var key = buildTryoutKey_(r[1], r[2]);
      var seq = parseIdSequence_(tryoutId);
      if (seq > maxSeq) maxSeq = seq;
      if (key) {
        byKey[key] = tryoutId;
      }
    }
  }

  return {
    byKey: byKey,
    maxSeq: maxSeq
  };
}

function ensureTryoutRecord_(tryoutSheet, tryoutIndex, src) {
  var key = buildTryoutKey_(src.namaTryout, src.mataPelajaran);
  if (tryoutIndex.byKey[key]) {
    return tryoutIndex.byKey[key];
  }

  var newTryoutId = '';
  for (var i = 0; i < DEFAULT_SUMBER_TRYOUT.length; i++) {
    if (DEFAULT_SUMBER_TRYOUT[i].sumberId === src.sumberId) {
      newTryoutId = DEFAULT_SUMBER_TRYOUT[i].tryoutId;
      break;
    }
  }
  if (!newTryoutId) {
    tryoutIndex.maxSeq++;
    newTryoutId = formatPrefixedId_('TO', tryoutIndex.maxSeq, 3);
  }

  tryoutSheet.appendRow([
    newTryoutId,
    src.namaTryout,
    src.mataPelajaran,
    '',
    60,
    'Aktif'
  ]);
  tryoutIndex.byKey[key] = newTryoutId;
  return newTryoutId;
}

function loadHasilIndex_(hasilSheet) {
  var byCompositeKey = {};
  var maxSeq = 0;
  var lastRow = hasilSheet.getLastRow();

  if (lastRow >= 2) {
    var range = hasilSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Hasil.length);
    var vals = range.getValues();
    var disp = range.getDisplayValues();

    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      var d = disp[i];
      var hasilId = String(d[0]).trim();
      var seq = parseIdSequence_(hasilId);
      if (seq > maxSeq) maxSeq = seq;

      var sumberId = String(d[3]).trim();
      var sourceRow = Number(v[12] || d[12]);
      if (sumberId && sourceRow) {
        var key = buildHasilCompositeKey_(sumberId, sourceRow);
        if (!byCompositeKey[key]) {
          byCompositeKey[key] = {
            rowIndex: i + 2,
            hasilId: hasilId,
            siswaId: String(d[1]).trim(),
            tryoutId: String(d[2]).trim(),
            sumberId: sumberId,
            nis: normalizeNis_(d[4]),
            tanggal: String(d[5]).trim(),
            namaSiswa: String(d[6]).trim(),
            mataPelajaran: String(d[7]).trim(),
            benar: parseNumberSafe_(v[8], d[8]) || 0,
            totalSoal: parseNumberSafe_(v[9], d[9]) || 0,
            nilai: parseNumberSafe_(v[10], d[10]) || 0,
            status: String(d[11]).trim(),
            sourceRow: sourceRow
          };
        }
      }
    }
  }

  return {
    byCompositeKey: byCompositeKey,
    maxSeq: maxSeq
  };
}

function buildHasilCompositeKey_(sumberId, sourceRow) {
  return String(sumberId).trim() + '::' + String(sourceRow).trim();
}

function isSourceRowCompletelyEmpty_(rowDisp) {
  for (var i = 0; i < rowDisp.length; i++) {
    if (String(rowDisp[i]).trim() !== '') {
      return false;
    }
  }
  return true;
}

function normalizeNis_(rawNis) {
  if (rawNis === null || rawNis === undefined) return '';
  var s = String(rawNis).trim();
  if (s.charAt(0) === "'") {
    s = s.substring(1).trim();
  }
  s = s.replace(/\s+/g, '');
  return s;
}

function sanitizeCellText_(rawText) {
  if (rawText === null || rawText === undefined) return '';
  var s = String(rawText).trim();
  if (/^[=+\-@]/.test(s)) {
    s = "'" + s;
  }
  return s;
}

function normalizeTimestampValue_(rawVal, dispVal) {
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    return Utilities.formatDate(rawVal, APP_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  return String(dispVal || rawVal || '').trim();
}

function parseNumberSafe_(rawVal, dispVal) {
  if (typeof rawVal === 'number' && !isNaN(rawVal)) {
    return rawVal;
  }
  var s = String(dispVal !== undefined && dispVal !== null ? dispVal : rawVal || '').trim();
  if (!s) return null;
  s = s.replace(/\s+/g, '').replace(',', '.');
  var num = Number(s);
  return isNaN(num) ? null : num;
}

function roundScore_(val) {
  return Math.round(Number(val) * 100) / 100;
}

function isValidNumber_(val) {
  return typeof val === 'number' && !isNaN(val);
}

function computeAverage_(arr) {
  if (!arr || arr.length === 0) return null;
  var sum = 0;
  for (var i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return roundScore_(sum / arr.length);
}

function formatScoreOrDash_(val) {
  return isValidNumber_(val) ? val : '-';
}

function computeCombinedProgress_(progressBi, progressMtk) {
  var items = [];
  if (isValidNumber_(progressBi)) items.push(progressBi);
  if (isValidNumber_(progressMtk)) items.push(progressMtk);
  if (items.length === 0) return null;
  return computeAverage_(items);
}

function computeSeriesProgress_(scores) {
  if (!scores || scores.length < 2) return null;
  return roundScore_(scores[scores.length - 1] - scores[0]);
}

function sortTryoutListNaturally_(list) {
  return (list || []).slice().sort(function (a, b) {
    var mapelCmp = String(a.mataPelajaran || '').localeCompare(String(b.mataPelajaran || ''), 'id');
    if (mapelCmp !== 0) return mapelCmp;
    return String(a.namaTryout || '').localeCompare(String(b.namaTryout || ''), 'id', { numeric: true });
  });
}

function buildShortTryoutLabel_(toItem) {
  var mapel = String(toItem.mataPelajaran || '').toLowerCase();
  var prefix = mapel === 'bahasa indonesia' ? 'BI' : (mapel === 'matematika' ? 'MTK' : toItem.mataPelajaran);
  var numMatch = String(toItem.namaTryout || '').match(/(\d+)\s*$/);
  return numMatch ? (prefix + ' ' + numMatch[1]) : String(toItem.namaTryout || toItem.tryoutId);
}

function extractTryoutScore_(mapTryout, preferredTryoutId, tryoutById, mapel, urutanKe) {
  if (mapTryout[preferredTryoutId] && isValidNumber_(mapTryout[preferredTryoutId].nilai)) {
    return mapTryout[preferredTryoutId].nilai;
  }

  var matching = [];
  var ids = Object.keys(mapTryout);
  for (var i = 0; i < ids.length; i++) {
    var rec = mapTryout[ids[i]];
    var meta = tryoutById[rec.tryoutId];
    var recMapel = meta ? meta.mataPelajaran : rec.mataPelajaran;
    if (String(recMapel).toLowerCase() === String(mapel).toLowerCase()) {
      matching.push(rec);
    }
  }
  matching.sort(function (a, b) {
    return String(a.tryoutId).localeCompare(String(b.tryoutId));
  });

  if (matching[urutanKe - 1] && isValidNumber_(matching[urutanKe - 1].nilai)) {
    return matching[urutanKe - 1].nilai;
  }
  return null;
}

function isNewerResult_(candidate, current) {
  var cDate = String(candidate.tanggal || '');
  var curDate = String(current.tanggal || '');
  if (cDate && curDate && cDate !== curDate) {
    return cDate > curDate;
  }
  return Number(candidate.sourceRow || 0) > Number(current.sourceRow || 0);
}

function sortRekapRows_(rows, sortBy) {
  rows.sort(function (a, b) {
    if (sortBy === 'rataRataDesc' || sortBy === 'tertinggi') {
      var va = a.rataRata === null ? -Infinity : a.rataRata;
      var vb = b.rataRata === null ? -Infinity : b.rataRata;
      if (vb !== va) return vb - va;
    } else if (sortBy === 'rataRataAsc' || sortBy === 'terendah') {
      var vaAsc = a.rataRata === null ? Infinity : a.rataRata;
      var vbAsc = b.rataRata === null ? Infinity : b.rataRata;
      if (vaAsc !== vbAsc) return vaAsc - vbAsc;
    }
    return String(a.nama).localeCompare(String(b.nama), 'id');
  });
}

function computePerTryoutStats_(tryoutList, hasilBySiswa) {
  var stats = [];
  var siswaIds = Object.keys(hasilBySiswa);

  for (var t = 0; t < tryoutList.length; t++) {
    var to = tryoutList[t];
    var scores = [];
    for (var s = 0; s < siswaIds.length; s++) {
      var rec = hasilBySiswa[siswaIds[s]][to.tryoutId];
      if (rec && isValidNumber_(rec.nilai)) {
        scores.push(rec.nilai);
      }
    }
    stats.push({
      tryoutId: to.tryoutId,
      namaTryout: to.namaTryout,
      mataPelajaran: to.mataPelajaran,
      jumlahPeserta: scores.length,
      rataRata: computeAverage_(scores),
      nilaiTertinggi: scores.length > 0 ? Math.max.apply(null, scores) : null,
      nilaiTerendah: scores.length > 0 ? Math.min.apply(null, scores) : null
    });
  }

  return stats;
}

function readAllSiswa_(siswaSheet) {
  var list = [];
  var lastRow = siswaSheet.getLastRow();
  if (lastRow < 2) return list;

  var rows = siswaSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Siswa.length).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!String(r[0]).trim()) continue;
    list.push({
      siswaId: String(r[0]).trim(),
      nis: normalizeNis_(r[1]),
      nama: String(r[2]).trim(),
      jenisKelamin: String(r[3]).trim(),
      kelas: String(r[4]).trim(),
      namaOrangTua: String(r[5]).trim(),
      noHpOrangTua: String(r[6]).trim(),
      status: String(r[7]).trim()
    });
  }
  return list;
}

function readAllTryout_(tryoutSheet) {
  var list = [];
  var lastRow = tryoutSheet.getLastRow();
  if (lastRow < 2) return list;

  var rows = tryoutSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Tryout.length).getDisplayValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!String(r[0]).trim()) continue;
    list.push({
      tryoutId: String(r[0]).trim(),
      namaTryout: String(r[1]).trim(),
      mataPelajaran: String(r[2]).trim(),
      tanggal: String(r[3]).trim(),
      durasi: Number(r[4]) || 0,
      status: String(r[5]).trim()
    });
  }
  return list;
}

function readAllHasil_(hasilSheet) {
  var list = [];
  var lastRow = hasilSheet.getLastRow();
  if (lastRow < 2) return list;

  var range = hasilSheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS.Hasil.length);
  var vals = range.getValues();
  var disp = range.getDisplayValues();

  for (var i = 0; i < vals.length; i++) {
    var v = vals[i];
    var d = disp[i];
    if (!String(d[0]).trim()) continue;

    list.push({
      hasilId: String(d[0]).trim(),
      siswaId: String(d[1]).trim(),
      tryoutId: String(d[2]).trim(),
      sumberId: String(d[3]).trim(),
      nis: normalizeNis_(d[4]),
      tanggal: String(d[5]).trim(),
      namaSiswa: String(d[6]).trim(),
      mataPelajaran: String(d[7]).trim(),
      benar: parseNumberSafe_(v[8], d[8]) || 0,
      totalSoal: parseNumberSafe_(v[9], d[9]) || 0,
      nilai: parseNumberSafe_(v[10], d[10]),
      status: String(d[11]).trim(),
      sourceRow: Number(v[12] || d[12]) || 0
    });
  }
  return list;
}

function getDatabaseStatus_() {
  var ss = getDatabaseSpreadsheet_();
  var sheetsInfo = {};
  var keys = Object.keys(SHEET_SCHEMAS);

  for (var i = 0; i < keys.length; i++) {
    var name = keys[i];
    var sh = ss.getSheetByName(name);
    sheetsInfo[name] = {
      exists: Boolean(sh),
      jumlahBarisData: sh && sh.getLastRow() > 1 ? sh.getLastRow() - 1 : 0
    };
  }

  return {
    ok: true,
    databaseName: ss.getName(),
    sheets: sheetsInfo
  };
}

function getSumberTryoutData_() {
  var ss = getDatabaseSpreadsheet_();
  var sumberSheet = ensureSheetExists_(ss, SHEET_NAMES.SUMBER_TRYOUT);
  return {
    ok: true,
    sumberTryout: readSumberTryoutList_(sumberSheet)
  };
}

function getSiswaData_(params) {
  var ss = getDatabaseSpreadsheet_();
  var siswaSheet = ensureSheetExists_(ss, SHEET_NAMES.SISWA);
  var allSiswa = readAllSiswa_(siswaSheet);

  var search = params && params.search ? String(params.search).trim().toLowerCase() : '';
  var status = params && params.status ? String(params.status).trim().toLowerCase() : '';
  var kelas = params && params.kelas ? String(params.kelas).trim().toLowerCase() : '';

  var filtered = allSiswa.filter(function (item) {
    if (search) {
      var hit = item.nama.toLowerCase().indexOf(search) !== -1 || item.nis.toLowerCase().indexOf(search) !== -1;
      if (!hit) return false;
    }
    if (status && item.status.toLowerCase() !== status) return false;
    if (kelas && item.kelas.toLowerCase() !== kelas) return false;
    return true;
  });

  return {
    ok: true,
    total: filtered.length,
    siswa: filtered
  };
}

function getHasilData_(params) {
  var ss = getDatabaseSpreadsheet_();
  var hasilSheet = ensureSheetExists_(ss, SHEET_NAMES.HASIL);
  var allHasil = readAllHasil_(hasilSheet);

  var siswaId = params && params.siswaId ? String(params.siswaId).trim() : '';
  var tryoutId = params && params.tryoutId ? String(params.tryoutId).trim() : '';
  var mapel = params && params.mataPelajaran ? String(params.mataPelajaran).trim().toLowerCase() : '';

  var filtered = allHasil.filter(function (item) {
    if (siswaId && item.siswaId !== siswaId) return false;
    if (tryoutId && item.tryoutId !== tryoutId) return false;
    if (mapel && item.mataPelajaran.toLowerCase() !== mapel) return false;
    return true;
  });

  return {
    ok: true,
    total: filtered.length,
    hasil: filtered
  };
}

function writeActivityLog_(userId, aktivitas, keterangan) {
  try {
    var ss = getDatabaseSpreadsheet_();
    var logSheet = ensureSheetExists_(ss, SHEET_NAMES.LOG_AKTIVITAS);
    var nextNum = logSheet.getLastRow();
    var logId = formatPrefixedId_('LOG', nextNum, 5);
    logSheet.appendRow([
      logId,
      String(userId || 'SYSTEM'),
      String(aktivitas || ''),
      sanitizeCellText_(keterangan || ''),
      formatNow_()
    ]);
  } catch (e) {
    // Jangan gagalkan proses utama
  }
}

function parseIdSequence_(idStr) {
  if (!idStr) return 0;
  var m = String(idStr).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function formatPrefixedId_(prefix, number, width) {
  var s = String(number);
  while (s.length < width) {
    s = '0' + s;
  }
  return prefix + '-' + s;
}

function formatNow_() {
  return Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function safeJsonParse_(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function parsePostBody_(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  if (e && e.postData && e.postData.contents) {
    try {
      var parsed = JSON.parse(e.postData.contents);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (err) {
      // Fallback ke e.parameter
    }
  }
  return params;
}

function verifyApiRequest_(rawToken) {
  var token = rawToken ? String(rawToken).trim() : '';
  if (!token) {
    return {
      ok: false,
      code: 401,
      message: 'Akses ditolak. Silakan login terlebih dahulu.'
    };
  }

  var cache = CacheService.getScriptCache();
  var cachedSession = cache.get('SESSION_' + token);
  if (cachedSession) {
    try {
      var sessionObj = JSON.parse(cachedSession);
      return {
        ok: true,
        role: sessionObj.role,
        userId: sessionObj.userId,
        nama: sessionObj.nama || sessionObj.username,
        siswaId: sessionObj.siswaId || '',
        actor: sessionObj.username || sessionObj.userId
      };
    } catch (err) {
      return { ok: false, code: 401, message: 'Sesi tidak valid.' };
    }
  }

  var stage1Key = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.STAGE1_API_KEY);
  if (stage1Key && constantTimeEqual_(token, stage1Key)) {
    return {
      ok: true,
      role: 'admin',
      userId: 'STAGE1_ADMIN',
      nama: 'Administrator',
      siswaId: '',
      actor: 'STAGE1_ADMIN'
    };
  }

  return {
    ok: false,
    code: 401,
    message: 'Sesi telah berakhir atau token tidak valid. Silakan login ulang.'
  };
}

function requireRole_(auth, allowedRoles) {
  if (!auth || !auth.ok || allowedRoles.indexOf(auth.role) === -1) {
    var err = new Error('Akses ditolak. Peran Anda tidak memiliki izin untuk aksi ini.');
    err.statusCode = 403;
    throw err;
  }
}

function constantTimeEqual_(a, b) {
  var strA = String(a || '');
  var strB = String(b || '');
  if (strA.length !== strB.length) return false;
  var diff = 0;
  for (var i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
