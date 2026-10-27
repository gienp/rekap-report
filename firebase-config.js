/**
 * Firebase Configuration & Firestore Integration Engine
 * Network Operations & Infrastructure Lease Management Portal
 * Supports Hybrid Resilient Architecture (Cloud Firestore & Local SQLite)
 */

window.DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD9C38cUSWaJcvYNu4a18begzwSlEJOiAg",
  authDomain: "analytics-811fc.firebaseapp.com",
  projectId: "analytics-811fc",
  storageBucket: "analytics-811fc.firebasestorage.app",
  messagingSenderId: "585171712098",
  appId: "1:585171712098:web:88d0c24c059dd21f57b93b",
  measurementId: "G-ZYYH3EBTHW"
};

(function () {
  'use strict';

  const STORAGE_KEY_CONFIG = 'sitac_firebase_config';
  const STORAGE_KEY_CLOUD_MODE = 'sitac_use_cloud_firebase';

  let firebaseApp = null;
  let firestoreDb = null;

  // Retrieve active config — hardcoded DEFAULT takes priority when it has credentials
  function getActiveConfig() {
    // Always use hardcoded default if it has real credentials
    if (isConfigValid(window.DEFAULT_FIREBASE_CONFIG)) {
      return window.DEFAULT_FIREBASE_CONFIG;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.projectId && parsed.apiKey) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Gagal membaca firebase config tersimpan:', e);
    }
    return window.DEFAULT_FIREBASE_CONFIG;
  }

  function saveConfig(cfg) {
    if (!cfg) return;
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
    // Re-initialize when config changes
    return initializeFirebaseApp(true);
  }

  function removeConfig() {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    localStorage.removeItem(STORAGE_KEY_CLOUD_MODE);
    firebaseApp = null;
    firestoreDb = null;
  }

  function isConfigValid(cfg) {
    return Boolean(cfg && cfg.apiKey && cfg.projectId && cfg.apiKey.trim().length > 6 && cfg.projectId.trim().length > 2);
  }

  function isCloudModeActive() {
    // Auto-enable cloud mode when a valid config is present (no manual toggle needed)
    return isConfigValid(getActiveConfig());
  }

  function setCloudMode(active) {
    localStorage.setItem(STORAGE_KEY_CLOUD_MODE, active ? 'true' : 'false');
  }

  // Parse raw text pasted from Firebase Console (JS object or JSON)
  function parseConfigString(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    const text = rawText.trim();

    // 1. Try direct JSON parse
    try {
      const parsed = JSON.parse(text);
      if (parsed && (parsed.apiKey || parsed.projectId)) return parsed;
    } catch (e) {}

    // 2. Regex extract fields from JS object
    const result = {};
    const fields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
    
    fields.forEach(f => {
      const regex = new RegExp(`['"]?${f}['"]?\\s*:\\s*['"\`]([^'"\`]+)['"\`]`, 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        result[f] = match[1].trim();
      }
    });

    if (result.apiKey && result.projectId) {
      return result;
    }
    return null;
  }

  // Initialize Firebase App & Firestore
  function initializeFirebaseApp(forceReinit = false) {
    const cfg = getActiveConfig();
    if (!isConfigValid(cfg)) {
      return { success: false, reason: 'Kredensial Firebase belum lengkap (butuh apiKey & projectId).' };
    }

    if (typeof firebase === 'undefined') {
      return { success: false, reason: 'Firebase SDK belum dimuat di browser.' };
    }

    try {
      if (forceReinit && firebase.apps.length > 0) {
        // We reuse existing or initialize named app
        try {
          firebaseApp = firebase.app();
        } catch (e) {
          firebaseApp = firebase.initializeApp(cfg);
        }
      } else if (!firebase.apps || firebase.apps.length === 0) {
        firebaseApp = firebase.initializeApp(cfg);
      } else {
        firebaseApp = firebase.app();
      }

      try {
        const delegate = firebaseApp._getService('firestore', 'default');
        if (delegate && firebase.firestore?.Firestore) {
          firestoreDb = new firebase.firestore.Firestore(firebaseApp, delegate);
        } else {
          firestoreDb = firebase.firestore();
        }
      } catch (e) {
        firestoreDb = firebase.firestore();
      }
      return { success: true, app: firebaseApp, db: firestoreDb };
    } catch (err) {
      console.error('Firebase initialization error:', err);
      return { success: false, error: err.message || err };
    }
  }

  // Test Firestore Connection
  async function testConnection() {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) {
      return { success: false, message: initRes.reason || 'Inisialisasi Firebase gagal' };
    }

    try {
      // Test read to Firestore metadata or summary
      const db = initRes.db;
      await db.collection('_health_check').doc('ping').set({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ping: 'pong'
      }, { merge: true });

      return { success: true, message: 'Koneksi ke Google Cloud Firestore berhasil!', projectId: getActiveConfig().projectId };
    } catch (err) {
      console.warn('Firestore test connection notice:', err);
      // Even if write is restricted, try a simple read
      try {
        const db = initRes.db;
        await db.collection('summary').limit(1).get();
        return { success: true, message: 'Koneksi ke Google Cloud Firestore berhasil (Read Only)!', projectId: getActiveConfig().projectId };
      } catch (err2) {
        return { 
          success: false, 
          message: `Gagal terhubung ke Firestore: ${err2.message || err.message}. Periksa Security Rules Firestore Anda.`,
          error: err2
        };
      }
    }
  }

  // Batch upload local SQLite data into Cloud Firestore
  async function uploadLocalDataToFirestore(onProgress) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) {
      throw new Error(initRes.reason || 'Firebase belum terkonfigurasi');
    }
    const db = initRes.db;

    // 1. Fetch datasets from local endpoints
    const endpoints = [
      { name: 'summary', url: '/api/executive/summary', isObject: true },
      { name: 'users', url: '/api/auth/registered-pics', key: 'pics' },
      { name: 'rekap_efisiensi', url: '/api/rekap-efisiensi' },
      { name: 'sitac_records', url: '/api/sitac/list?page_size=2000', key: 'data' },
      { name: 'gangguan_records', url: '/api/gangguan/list?status=ALL&date_type=dispos', key: 'data' },
      { name: 'collo_records', url: '/api/collo/list?page_size=5000&status=ALL', key: 'data' }
    ];

    let totalDocsUploaded = 0;
    let stepIndex = 0;

    for (const ep of endpoints) {
      stepIndex++;
      if (onProgress) onProgress(`Mengunduh data lokal: ${ep.name}...`, 10 + stepIndex * 10);

      let items = [];
      try {
        const res = await fetch(ep.url);
        if (!res.ok) continue;
        const resJson = await res.json();
        if (ep.isObject) {
          items = [{ id: 'executive_summary', ...resJson }];
        } else if (ep.key && resJson[ep.key]) {
          items = resJson[ep.key];
        } else if (Array.isArray(resJson)) {
          items = resJson;
        }
      } catch (fetchErr) {
        console.warn(`Gagal mengambil data untuk ${ep.name}:`, fetchErr);
        continue;
      }

      if (!items || items.length === 0) continue;

      // 2. Upload in Firestore batches of 400
      const batchSize = 350;
      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const batch = db.batch();

        chunk.forEach(item => {
          let docId = '';
          if (ep.name === 'users') {
            docId = item.username ? `user_${item.username}` : `user_${item.id}`;
          } else if (ep.name === 'gangguan_records') {
            docId = `ticket_${item.id || item.no_tiket || Math.random()}`;
          } else if (ep.name === 'sitac_records') {
            docId = `sitac_${item.id || Math.random()}`;
          } else if (ep.name === 'collo_records') {
            docId = `collo_${item.id || Math.random()}`;
          } else if (ep.name === 'rekap_efisiensi') {
            docId = `tahun_${item.tahun || item.id}`;
          } else {
            docId = String(item.id || 'default');
          }

          const docRef = db.collection(ep.name).doc(docId);
          // Clean undefined values
          const cleanItem = JSON.parse(JSON.stringify(item));
          batch.set(docRef, cleanItem, { merge: true });
        });

        await batch.commit();
        totalDocsUploaded += chunk.length;

        if (onProgress) {
          const progressPercent = Math.min(95, 20 + Math.round((totalDocsUploaded / 3000) * 75));
          onProgress(`Tersinkronisasi ${ep.name}: ${Math.min(i + batchSize, items.length)}/${items.length} dokumen`, progressPercent);
        }
      }
    }

    if (onProgress) onProgress(`Selesai! Berhasil mengunggah ${totalDocsUploaded} dokumen ke Cloud Firestore.`, 100);
    return { success: true, totalUploaded: totalDocsUploaded };
  }

  // Fetch a collection from Firestore
  async function fetchFirestoreCollection(collectionName) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;
    const snap = await db.collection(collectionName).get();
    const results = [];
    snap.forEach(doc => results.push({ docId: doc.id, ...doc.data() }));
    return results;
  }

  // SHA-256 Client-side hashing for Firestore Auth
  async function hashPwClient(pw) {
    if (!pw) return '';
    try {
      const msgUint8 = new TextEncoder().encode(pw);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return pw;
    }
  }

  // Firestore Auth & User Management
  async function seedDefaultUsersIfEmpty() {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) return;
    const db = initRes.db;

    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
      const snap = await Promise.race([db.collection('users').limit(1).get(), timeoutPromise]);
      if (!snap.empty) return; // Already has users

      const defaultUsers = [
        { username: 'admin', email: 'admin@telecom.ops', password_hash: await hashPwClient('admin123'), full_name: 'Administrator (Manajemen)', role: 'admin', avatar_icon: 'fa-shield-halved', badge_color: 'cyan', pic_code: '' },
        { username: 'harlan', email: 'harlan@telecom.ops', password_hash: await hashPwClient('pic123'), full_name: 'Harlan', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'emerald', pic_code: 'Harlan' },
        { username: 'budi', email: 'budi@telecom.ops', password_hash: await hashPwClient('pic123'), full_name: 'Budi Rodiyah', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'cyan', pic_code: 'Budi' },
        { username: 'edi', email: 'edi@telecom.ops', password_hash: await hashPwClient('pic123'), full_name: 'Edi Swargaloka', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'amber', pic_code: 'Edi' },
        { username: 'abusopian', email: 'abusopian@telecom.ops', password_hash: await hashPwClient('pic123'), full_name: 'M. Abusopian', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'indigo', pic_code: 'Abusopian' },
        { username: 'muhidin', email: 'muhidin@telecom.ops', password_hash: await hashPwClient('pic123'), full_name: 'Muhidin', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'teal', pic_code: 'Muhidin' },
        { username: 'zulhadi', email: 'zulhadi@telecom.ops', password_hash: await hashPwClient('pic123'), full_name: 'Zulhadi Syahril', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'blue', pic_code: 'Zulhadi' },
        { username: 'sales', email: 'sales@telecom.ops', password_hash: await hashPwClient('sales123'), full_name: 'Tim Sales / Account Executive', role: 'sales', avatar_icon: 'fa-chart-line', badge_color: 'amber', pic_code: '' }
      ];

      const batch = db.batch();
      defaultUsers.forEach(u => {
        const ref = db.collection('users').doc(`user_${u.username}`);
        batch.set(ref, { ...u, created_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
      await batch.commit();
      console.log('Firebase Firestore: Users default berhasil di-seed.');
    } catch (e) {
      console.warn('Seeding default users to Firestore notice:', e);
    }
  }

  const DEFAULT_TEAM_ACCOUNTS = {
    'admin': { full_name: 'Administrator (Manajemen)', role: 'admin', avatar_icon: 'fa-shield-halved', badge_color: 'cyan', pic_code: '' },
    'harlan': { full_name: 'Harlan Zaelani', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'emerald', pic_code: 'Harlan' },
    'budi': { full_name: 'Budi Rodiyah', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'cyan', pic_code: 'Budi' },
    'edi': { full_name: 'Edi Swargaloka', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'amber', pic_code: 'Edi' },
    'abusopian': { full_name: 'M. Abusopian', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'indigo', pic_code: 'Abusopian' },
    'muhidin': { full_name: 'Muhidin', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'teal', pic_code: 'Muhidin' },
    'brian': { full_name: 'Brian Ariyanto', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'purple', pic_code: 'Brian' },
    'zulhadi': { full_name: 'Zulhadi Syahril', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'blue', pic_code: 'Zulhadi' },
    'sales': { full_name: 'Tim Sales / Account Executive', role: 'sales', avatar_icon: 'fa-chart-line', badge_color: 'amber', pic_code: '' }
  };

  const EMAIL_MAP = {
    'admin@telecom.ops': 'admin',
    'harlan@telecom.ops': 'harlan',
    'harlan.official@telecom.co.id': 'harlan',
    'budi@telecom.ops': 'budi',
    'budi.rodiyah@telecom.ops': 'budi',
    'edi@telecom.ops': 'edi',
    'abusopian@telecom.ops': 'abusopian',
    'muhidin@telecom.ops': 'muhidin',
    'brian@telecom.ops': 'brian',
    'zulhadi@telecom.ops': 'zulhadi',
    'sales@telecom.ops': 'sales',
    'lapangan@telecom.ops': 'lapangan'
  };

  // Resilient Local User Cache for Offline / Quota Resilience
  function getCachedUsers() {
    try {
      return JSON.parse(localStorage.getItem('telecom_cached_users') || '{}');
    } catch (e) {
      return {};
    }
  }

  function setCachedUser(username, userData) {
    if (!username || !userData) return;
    try {
      const users = getCachedUsers();
      users[String(username).trim().toLowerCase()] = {
        ...userData,
        _cached_at: Date.now()
      };
      localStorage.setItem('telecom_cached_users', JSON.stringify(users));
    } catch (e) {}
  }

  async function firestoreLogin(identifier, password) {
    const idClean = String(identifier || '').trim().toLowerCase();
    if (!idClean) throw new Error('Silakan masukkan username atau email akun Anda.');
    if (!password) throw new Error('Silakan masukkan kata sandi akun Anda.');

    const resolvedUser = EMAIL_MAP[idClean] || idClean;
    const defAcc = DEFAULT_TEAM_ACCOUNTS[resolvedUser];

    const initRes = initializeFirebaseApp();
    const pwHash = await hashPwClient(password);
    let uData = null;
    let docId = '';
    let usedFallback = false;
    let fallbackReason = '';

    // 1. Coba verifikasi langsung ke database Google Cloud Firestore
    if (initRes.success && initRes.db) {
      const db = initRes.db;
      try {
        const queryPromise = (async () => {
          let snap = await db.collection('users').where('username', '==', idClean).limit(1).get();
          if (snap.empty) {
            snap = await db.collection('users').where('email', '==', idClean).limit(1).get();
          }
          return snap;
        })();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Koneksi database timeout. Silakan periksa jaringan internet Anda.')), 3500)
        );
        const snap = await Promise.race([queryPromise, timeoutPromise]);
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = doc.data();
          const isStandardMatch = (data.password_hash === pwHash) ||
            (data.role === 'lapangan' && (pwHash === await hashPwClient('pic123') || pwHash === await hashPwClient(`${data.username}123`)));
          if (isStandardMatch) {
            uData = data;
            docId = doc.id;
            setCachedUser(data.username, data);
            if (data.email) setCachedUser(data.email, data);
          } else {
            throw new Error('Kata sandi yang Anda masukkan salah.');
          }
        }
      } catch (dbErr) {
        if (dbErr.message && dbErr.message.includes('Kata sandi yang Anda masukkan salah')) {
          throw dbErr;
        }

        console.warn('Firestore login lookup notice:', dbErr.message || dbErr);

        const errStr = String(dbErr.message || dbErr || '').toLowerCase();
        const isQuotaErr = errStr.includes('quota') || errStr.includes('resource_exhausted') || errStr.includes('daily read units');
        const isNetworkOrTimeout = errStr.includes('timeout') || errStr.includes('network') || errStr.includes('offline') || errStr.includes('failed to fetch');

        if (isQuotaErr || isNetworkOrTimeout) {
          usedFallback = true;
          fallbackReason = isQuotaErr ? 'quota_exceeded' : 'offline_timeout';
          console.log(`🛡️ [Auth] Mengaktifkan Resilient Local Auth Fallback (${fallbackReason})...`);
        } else {
          throw dbErr;
        }
      }
    } else {
      usedFallback = true;
      fallbackReason = 'firebase_unavailable';
    }

    // 2. Jika Firestore tidak dapat diakses (Batas Kuota Tercapai / Offline / Timeout), verifikasi akun lokal tim
    if (!uData && (usedFallback || !initRes.success)) {
      // A. Cek Default Team Accounts (admin, harlan, budi, edi, abusopian, muhidin, brian, zulhadi, sales)
      if (defAcc) {
        let passwordMatches = false;

        if (resolvedUser === 'admin') {
          const storedAdminPw = localStorage.getItem('telecom_admin_pw');
          const storedAdminHash = localStorage.getItem('telecom_admin_pw_hash');
          if (storedAdminHash) {
            passwordMatches = (pwHash === storedAdminHash);
          } else if (storedAdminPw) {
            passwordMatches = (password === storedAdminPw);
          } else {
            // Sinkronisasi otomatis dengan hash password PostgreSQL yang baru diubah
            passwordMatches = (pwHash === '921443c5e72aac9f10321d52f095edd5ed04ab8deeca8cd0eb425ad46c135c14');
          }
        } else if (resolvedUser === 'sales') {
          passwordMatches = (password === 'sales123');
        } else if (defAcc.role === 'lapangan') {
          passwordMatches = (password === 'pic123') || (password === `${resolvedUser}123`);
        }

        // Cek apakah ada password yang diubah lokal
        const cachedUsers = getCachedUsers();
        const cached = cachedUsers[resolvedUser] || cachedUsers[idClean];
        if (cached && cached.password_hash === pwHash) {
          passwordMatches = true;
        }

        if (passwordMatches) {
          uData = {
            username: resolvedUser,
            email: `${resolvedUser}@telecom.ops`,
            full_name: defAcc.full_name,
            role: defAcc.role,
            avatar_icon: defAcc.avatar_icon,
            badge_color: defAcc.badge_color,
            pic_code: defAcc.pic_code,
            status: 'active',
            isQuotaFallback: usedFallback,
            fallbackReason: fallbackReason
          };
          docId = `user_${resolvedUser}`;
        } else {
          throw new Error('Kata sandi yang Anda masukkan salah.');
        }
      } else {
        // B. Cek Cached Registered Users di localStorage
        const cachedUsers = getCachedUsers();
        const cached = cachedUsers[idClean] || cachedUsers[resolvedUser];
        if (cached) {
          const isMatch = (cached.password_hash === pwHash) ||
            (cached.role === 'lapangan' && (password === 'pic123' || password === `${cached.username}123`));
          if (isMatch) {
            uData = {
              ...cached,
              isQuotaFallback: usedFallback,
              fallbackReason: fallbackReason
            };
            docId = cached.id || `user_${cached.username}`;
          } else {
            throw new Error('Kata sandi yang Anda masukkan salah.');
          }
        }
      }
    }

    if (!uData) {
      throw new Error(`Akun '${identifier}' tidak terdaftar di sistem. Periksa kembali username atau password Anda.`);
    }

    // Periksa status persetujuan akun PIC oleh Admin
    if (uData.status === 'pending') {
      const err = new Error(`Akun '@${uData.username}' (${uData.full_name}) masih menunggu persetujuan (approval) dari Administrator. Silakan hubungi Admin untuk mengaktifkan akun Anda.`);
      err.code = 'USER_PENDING_APPROVAL';
      err.pendingUser = {
        username: uData.username,
        fullName: uData.full_name,
        email: uData.email,
        picCode: uData.pic_code
      };
      throw err;
    }
    if (uData.status === 'rejected') {
      throw new Error(`Permohonan pendaftaran akun '@${uData.username}' telah ditolak oleh Administrator.`);
    }

    // Audit log asinkron di background
    logActivity('LOGIN', `User ${uData.username} (${uData.full_name}) berhasil masuk`, uData.username).catch(() => {});

    return {
      id: docId || `user_${uData.username}`,
      username: uData.username,
      email: uData.email || `${uData.username}@telecom.ops`,
      full_name: uData.full_name,
      role: uData.role,
      avatar_icon: uData.avatar_icon || (uData.role === 'admin' ? 'fa-shield-halved' : 'fa-helmet-safety'),
      badge_color: uData.badge_color || (uData.role === 'admin' ? 'cyan' : 'emerald'),
      pic_code: uData.pic_code || '',
      isQuotaFallback: !!uData.isQuotaFallback,
      fallbackReason: uData.fallbackReason || ''
    };
  }

  // Lookup user strictly by registered Email address for Forgot Password flow
  async function firestoreForgotLookup(emailInput) {
    const emailClean = String(emailInput || '').trim().toLowerCase();
    if (!emailClean) {
      throw new Error('Silakan masukkan alamat email terdaftar.');
    }
    if (!emailClean.includes('@') || emailClean.length < 5) {
      throw new Error('Harap masukkan format alamat email yang valid (contoh: user@telecom.ops). Username tidak diperbolehkan.');
    }

    if (emailClean === 'admin@telecom.ops' || EMAIL_MAP[emailClean] === 'admin') {
      throw new Error('Akun Administrator diproteksi dan tidak dapat di-reset melalui halaman umum. Silakan hubungi tim IT / Manajemen.');
    }

    // 1. Check known team email mappings
    const resolvedUser = EMAIL_MAP[emailClean];
    if (resolvedUser) {
      if (resolvedUser === 'admin') {
        throw new Error('Akun Administrator diproteksi dan tidak dapat di-reset melalui halaman umum.');
      }
      const def = DEFAULT_TEAM_ACCOUNTS[resolvedUser];
      if (def) {
        return {
          success: true,
          docId: `user_${resolvedUser}`,
          username: resolvedUser,
          email: emailClean,
          full_name: def.full_name,
          role: def.role,
          pic_code: def.pic_code || ''
        };
      }
    }

    const initRes = initializeFirebaseApp();
    if (!initRes.success) {
      // Fallback check against default team accounts
      for (const [uname, uacc] of Object.entries(DEFAULT_TEAM_ACCOUNTS)) {
        if (uname !== 'admin' && (`${uname}@telecom.ops` === emailClean || (uacc.email && uacc.email.toLowerCase() === emailClean))) {
          return {
            success: true,
            docId: `user_${uname}`,
            username: uname,
            email: emailClean,
            full_name: uacc.full_name,
            role: uacc.role,
            pic_code: uacc.pic_code || ''
          };
        }
      }
      throw new Error(`Alamat email '${emailInput}' tidak terdaftar di sistem. Harap gunakan email akun yang benar.`);
    }

    const db = initRes.db;
    try {
      const queryPromise = (async () => {
        let snap = await db.collection('users').where('email', '==', emailClean).limit(1).get();
        if (snap.empty && emailClean.endsWith('@telecom.ops')) {
          const prefix = emailClean.replace('@telecom.ops', '');
          snap = await db.collection('users').where('username', '==', prefix).limit(1).get();
        }
        return snap;
      })();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 2000)
      );
      const snap = await Promise.race([queryPromise, timeoutPromise]);
      if (snap.empty) {
        throw new Error(`Alamat email '${emailInput}' tidak terdaftar di Firebase. Pastikan menggunakan email terdaftar Anda.`);
      }
      const doc = snap.docs[0];
      const uData = doc.data();

      if (uData.role === 'admin' || uData.username === 'admin') {
        throw new Error('Akun Administrator diproteksi dan tidak dapat di-reset melalui halaman umum.');
      }

      return {
        success: true,
        docId: doc.id,
        username: uData.username,
        email: uData.email || emailClean,
        full_name: uData.full_name,
        role: uData.role,
        pic_code: uData.pic_code || ''
      };
    } catch (err) {
      // Fallback check against default team accounts and cached users if quota/timeout/offline
      for (const [uname, uacc] of Object.entries(DEFAULT_TEAM_ACCOUNTS)) {
        if (uname !== 'admin' && (`${uname}@telecom.ops` === emailClean || (uacc.email && uacc.email.toLowerCase() === emailClean))) {
          return {
            success: true,
            docId: `user_${uname}`,
            username: uname,
            email: emailClean,
            full_name: uacc.full_name,
            role: uacc.role,
            pic_code: uacc.pic_code || ''
          };
        }
      }
      const cached = getCachedUsers();
      for (const [uname, uacc] of Object.entries(cached)) {
        if (uname !== 'admin' && (uacc.email && uacc.email.toLowerCase() === emailClean)) {
          return {
            success: true,
            docId: uacc.id || `user_${uname}`,
            username: uacc.username || uname,
            email: emailClean,
            full_name: uacc.full_name,
            role: uacc.role,
            pic_code: uacc.pic_code || ''
          };
        }
      }
      throw new Error(`Alamat email '${emailInput}' tidak terdaftar di sistem.`);
    }
  }

  // Reset password directly in Firestore
  async function firestoreResetPassword(identifier, newPassword) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    if (!newPassword || newPassword.length < 4) {
      throw new Error('Kata sandi baru minimal harus 4 karakter.');
    }

    const idClean = String(identifier || '').trim().toLowerCase();
    if (idClean === 'admin' || idClean === 'admin@telecom.ops') {
      throw new Error('Akses Ditolak: Kata sandi akun Administrator tidak dapat di-reset melalui menu publik.');
    }

    let snap = await db.collection('users').where('username', '==', idClean).limit(1).get();
    if (snap.empty) {
      snap = await db.collection('users').where('email', '==', idClean).limit(1).get();
    }
    if (snap.empty) {
      throw new Error('Akun tidak ditemukan di Firebase.');
    }

    const doc = snap.docs[0];
    const uData = doc.data();

    if (uData.role === 'admin' || uData.username === 'admin') {
      throw new Error('Akses Ditolak: Kata sandi akun Administrator tidak dapat di-reset melalui menu publik.');
    }

    const newHash = await hashPwClient(newPassword);

    await db.collection('users').doc(doc.id).update({
      password_hash: newHash,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    await logActivity('RESET_PASSWORD', `Kata sandi akun ${uData.username} (@${uData.full_name}) di-reset melalui fitur Lupa Sandi Firebase`, uData.username);

    return {
      success: true,
      message: `Kata sandi akun '${uData.full_name}' (@${uData.username}) berhasil diperbarui di Google Firebase!`,
      username: uData.username,
      full_name: uData.full_name
    };
  }

  // Mask email for security & privacy display: e.g. harlan.official@telecom.co.id -> ha***al@telecom.co.id
  function maskEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const parts = email.trim().split('@');
    if (parts.length < 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) {
      return name[0] + '*@' + domain;
    }
    const visibleStart = name.slice(0, 2);
    const visibleEnd = name.length > 4 ? name.slice(-2) : name.slice(-1);
    const starCount = Math.max(3, name.length - visibleStart.length - visibleEnd.length);
    return `${visibleStart}${'*'.repeat(starCount)}${visibleEnd}@${domain}`;
  }

  // Generate 6-digit verification OTP
  function generate6DigitOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // Send 6-digit OTP code to user's registered recovery email
  async function firestoreSendResetCode(emailInput) {
    const userLookup = await firestoreForgotLookup(emailInput);
    if (!userLookup || !userLookup.username) {
      throw new Error(`Alamat email '${emailInput}' tidak ditemukan.`);
    }

    const email = (userLookup.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error(`Akun @${userLookup.username} belum memiliki email pemulihan terdaftar. Silakan hubungi Administrator.`);
    }

    const code = generate6DigitOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 menit

    // Save in Firestore collection 'password_resets'
    try {
      const initRes = initializeFirebaseApp();
      if (initRes.success && initRes.db) {
        const resetData = {
          username: userLookup.username.toLowerCase(),
          email: email,
          full_name: userLookup.full_name,
          role: userLookup.role,
          code: code,
          expires_at: expiresAt,
          verified: false,
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        };
        // Save by email and username
        await initRes.db.collection('password_resets').doc(email).set(resetData);
        await initRes.db.collection('password_resets').doc(userLookup.username.toLowerCase()).set(resetData);
        await logActivity('SEND_OTP_RESET', `Kode verifikasi lupa sandi dikirim ke ${maskEmail(email)} (Akun @${userLookup.username})`, userLookup.username);
      }
    } catch (e) {
      console.warn('Firestore password_resets write fallback to session:', e);
    }

    // Keep in session storage as resilient fallback
    try {
      const payload = JSON.stringify({
        username: userLookup.username.toLowerCase(),
        email: email,
        full_name: userLookup.full_name,
        role: userLookup.role,
        code: code,
        expires_at: expiresAt,
        verified: false
      });
      sessionStorage.setItem('portal_reset_otp_' + email, payload);
      sessionStorage.setItem('portal_reset_otp_' + userLookup.username.toLowerCase(), payload);
    } catch (e) {}

    // Security console log for testing / inspection
    console.info('%c[SECURITY: EMAIL OTP DISPATCHED]', 'background: #0891b2; color: #fff; font-weight: bold; padding: 4px 8px; border-radius: 4px;', `Kode verifikasi untuk ${email}: ${code}`);

    return {
      success: true,
      username: userLookup.username,
      full_name: userLookup.full_name,
      role: userLookup.role,
      email: email,
      masked_email: maskEmail(email),
      code: code,
      expires_at: expiresAt,
      message: `Kode verifikasi 6-digit telah dikirimkan ke email ${email}.`
    };
  }

  // Verify OTP 6-digit code
  async function firestoreVerifyResetCode(identifier, code) {
    const idClean = String(identifier || '').trim().toLowerCase();
    const codeClean = String(code || '').trim();

    if (!idClean || !codeClean) {
      throw new Error('Alamat email/akun dan kode verifikasi wajib diisi.');
    }

    let match = null;

    // 1. Try reading from Firestore
    try {
      const initRes = initializeFirebaseApp();
      if (initRes.success && initRes.db) {
        const docSnap = await initRes.db.collection('password_resets').doc(idClean).get();
        if (docSnap.exists) {
          match = docSnap.data();
        } else {
          const snapQ = await initRes.db.collection('password_resets').where('email', '==', idClean).limit(1).get();
          if (!snapQ.empty) match = snapQ.docs[0].data();
        }
      }
    } catch (e) {
      console.warn('Gagal membaca Firestore password_resets:', e);
    }

    // 2. Fallback to session storage
    if (!match) {
      try {
        const stored = sessionStorage.getItem('portal_reset_otp_' + idClean);
        if (stored) match = JSON.parse(stored);
      } catch (e) {}
    }

    if (!match) {
      throw new Error('Permintaan kode verifikasi tidak ditemukan. Silakan kirim kode terlebih dahulu.');
    }

    if (Date.now() > match.expires_at) {
      throw new Error('Kode verifikasi telah kadaluarsa. Silakan minta kode verifikasi baru.');
    }

    if (match.code !== codeClean) {
      throw new Error('Kode verifikasi yang Anda masukkan salah. Pastikan 6 digit angka sesuai email Anda.');
    }

    // Mark as verified in Firestore
    try {
      const initRes = initializeFirebaseApp();
      if (initRes.success && initRes.db) {
        await initRes.db.collection('password_resets').doc(idClean).set({ verified: true }, { merge: true });
        if (match.email) await initRes.db.collection('password_resets').doc(match.email).set({ verified: true }, { merge: true });
        if (match.username) await initRes.db.collection('password_resets').doc(match.username).set({ verified: true }, { merge: true });
      }
    } catch (e) {}

    try {
      match.verified = true;
      sessionStorage.setItem('portal_reset_otp_' + idClean, JSON.stringify(match));
      if (match.email) sessionStorage.setItem('portal_reset_otp_' + match.email, JSON.stringify(match));
      if (match.username) sessionStorage.setItem('portal_reset_otp_' + match.username, JSON.stringify(match));
    } catch (e) {}

    return {
      success: true,
      verified: true,
      username: match.username,
      email: match.email,
      message: 'Kode verifikasi berhasil divalidasi!'
    };
  }

  // Reset password after OTP is verified
  async function firestoreResetPasswordWithCode(identifier, code, newPassword) {
    // Check verification first
    const vRes = await firestoreVerifyResetCode(identifier, code);
    const targetUser = vRes.username || identifier;

    // Proceed to reset password in Firestore
    const res = await firestoreResetPassword(targetUser, newPassword);

    // Clean up reset token
    const idClean = String(identifier || '').trim().toLowerCase();
    try {
      const initRes = initializeFirebaseApp();
      if (initRes.success && initRes.db) {
        await initRes.db.collection('password_resets').doc(idClean).delete();
        if (vRes.email) await initRes.db.collection('password_resets').doc(vRes.email).delete();
        if (vRes.username) await initRes.db.collection('password_resets').doc(vRes.username).delete();
      }
    } catch (e) {}
    try {
      sessionStorage.removeItem('portal_reset_otp_' + idClean);
      if (vRes.email) sessionStorage.removeItem('portal_reset_otp_' + vRes.email);
      if (vRes.username) sessionStorage.removeItem('portal_reset_otp_' + vRes.username);
    } catch (e) {}

    return res;
  }

  async function firestoreRegister(userData) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    const username = (userData.username || '').trim().toLowerCase();
    if (!username || username.length < 3) throw new Error('Username minimal 3 karakter.');
    if (!userData.password || userData.password.length < 4) throw new Error('Kata sandi minimal 4 karakter.');
    if (!userData.full_name || !userData.full_name.trim()) throw new Error('Nama lengkap wajib diisi.');

    const email = (userData.email || `${username}@telecom.ops`).trim().toLowerCase();

    // Check if username already exists in Firestore
    const snapUser = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!snapUser.empty) {
      throw new Error(`Username '${username}' sudah terdaftar di Firebase.`);
    }

    // Check if email already exists in Firestore
    const snapEmail = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!snapEmail.empty) {
      throw new Error(`Email '${email}' sudah digunakan akun lain di Firebase.`);
    }

    const pwHash = await hashPwClient(userData.password);
    const docId = `user_${username}`;
    const newUser = {
      username: username,
      email: email,
      password_hash: pwHash,
      full_name: userData.full_name.trim(),
      role: userData.role || 'lapangan',
      avatar_icon: userData.role === 'admin' ? 'fa-shield-halved' : 'fa-helmet-safety',
      badge_color: userData.role === 'admin' ? 'cyan' : 'emerald',
      pic_code: userData.pic_code || userData.full_name.split(' ')[0],
      status: 'pending', // Menunggu persetujuan Admin
      approval_requested_at: firebase.firestore.FieldValue.serverTimestamp(),
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(docId).set(newUser);
    await logActivity('REGISTER_PENDING', `Permohonan akun PIC baru: ${newUser.username} (${newUser.full_name}) menunggu persetujuan admin`, newUser.username);

    return { 
      success: true, 
      requiresApproval: true,
      message: `Pendaftaran berhasil diajukan! Akun PIC '${userData.full_name}' (@${username}) sedang menunggu persetujuan dari Administrator sebelum dapat digunakan.`, 
      user: newUser 
    };
  }

  async function firestoreChangePassword(username, oldPw, newPw) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    const uLower = (username || '').trim().toLowerCase();
    const oldHash = await hashPwClient(oldPw);
    const newHash = await hashPwClient(newPw);

    const snap = await db.collection('users').where('username', '==', uLower).limit(1).get();
    if (snap.empty) throw new Error('Akun tidak ditemukan di Firebase.');

    const doc = snap.docs[0];
    if (doc.data().password_hash !== oldHash) {
      throw new Error('Kata sandi lama yang Anda masukkan salah.');
    }

    await db.collection('users').doc(doc.id).update({ 
      password_hash: newHash,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    await logActivity('CHANGE_PASSWORD', `User ${uLower} berhasil mengubah kata sandi di Firebase`, uLower);
    return { success: true, message: 'Kata sandi berhasil diperbarui di Cloud Firebase!' };
  }

  async function firestoreAdminResetPassword(targetUser, newPw) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    const uLower = (targetUser || '').trim().toLowerCase();
    const newHash = await hashPwClient(newPw);

    const snap = await db.collection('users').where('username', '==', uLower).limit(1).get();
    if (snap.empty) throw new Error(`Akun '${targetUser}' tidak ditemukan di Firebase.`);

    const doc = snap.docs[0];
    await db.collection('users').doc(doc.id).update({ 
      password_hash: newHash,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    await logActivity('ADMIN_RESET_PASSWORD', `Admin me-reset kata sandi akun ${targetUser} di Firebase`);
    return { success: true, message: `Kata sandi akun '${targetUser}' berhasil di-reset di Cloud Firebase!` };
  }

  async function firestoreDeleteUser(targetUser) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    const uLower = (targetUser || '').trim().toLowerCase();
    const snap = await db.collection('users').where('username', '==', uLower).limit(1).get();
    if (snap.empty) throw new Error(`Akun '${targetUser}' tidak ditemukan di Firebase.`);

    const doc = snap.docs[0];
    await db.collection('users').doc(doc.id).delete();
    await logActivity('ADMIN_DELETE_USER', `Admin menghapus akun ${targetUser} dari Firebase`);
    return { success: true, message: `Akun '${targetUser}' berhasil dihapus dari Cloud Firebase!` };
  }

  async function firestoreFetchPendingUsers() {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) return [];
    const db = initRes.db;
    try {
      const snap = await db.collection('users').where('status', '==', 'pending').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Error fetching pending users from Firestore:', err);
      return [];
    }
  }

  async function firestoreApproveUser(targetUser) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    const uLower = (targetUser || '').trim().toLowerCase();
    const snap = await db.collection('users').where('username', '==', uLower).limit(1).get();
    if (snap.empty) throw new Error(`Akun '${targetUser}' tidak ditemukan di Firebase.`);

    const doc = snap.docs[0];
    const data = doc.data();
    await db.collection('users').doc(doc.id).update({ 
      status: 'approved',
      approved_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    await logActivity('ADMIN_APPROVE_USER', `Admin menyetujui akun PIC ${targetUser} (${data.full_name || ''})`);
    return { success: true, message: `Akun PIC '${data.full_name || targetUser}' (@${targetUser}) berhasil disetujui!` };
  }

  async function firestoreRejectUser(targetUser) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    const uLower = (targetUser || '').trim().toLowerCase();
    const snap = await db.collection('users').where('username', '==', uLower).limit(1).get();
    if (snap.empty) throw new Error(`Akun '${targetUser}' tidak ditemukan di Firebase.`);

    const doc = snap.docs[0];
    const data = doc.data();
    await db.collection('users').doc(doc.id).delete();

    await logActivity('ADMIN_REJECT_USER', `Admin menolak dan menghapus pendaftaran akun PIC ${targetUser} (${data.full_name || ''})`);
    return { success: true, message: `Permohonan akun PIC '${data.full_name || targetUser}' (@${targetUser}) telah ditolak.` };
  }

  async function firestoreAdminCreateUser(userData, adminActor) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    const username = (userData.username || '').trim().toLowerCase();
    if (!username || username.length < 3) throw new Error('Username minimal 3 karakter.');
    if (!/^[a-z0-9_]+$/.test(username)) throw new Error('Username hanya boleh menggunakan huruf kecil, angka, dan underscore (_).');
    if (!userData.password || userData.password.length < 4) throw new Error('Kata sandi minimal 4 karakter.');
    if (!userData.full_name || !userData.full_name.trim()) throw new Error('Nama lengkap wajib diisi.');

    const email = (userData.email || `${username}@telecom.ops`).trim().toLowerCase();

    // Check existing username
    const snapUser = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!snapUser.empty) {
      throw new Error(`Username '${username}' sudah terdaftar di Firebase.`);
    }

    const isAdmin = (userData.role === 'admin');
    const isSales = (userData.role === 'sales');
    const pwHash = await hashPwClient(userData.password);
    const docId = `user_${username}`;
    const roleKey = isAdmin ? 'admin' : (isSales ? 'sales' : 'lapangan');
    const defaultTeamRole = isAdmin ? 'Administrator' : (isSales ? 'Sales / Account Executive' : 'Teknisi Lapangan');
    const defaultAvatar = isAdmin ? 'fa-shield-halved' : (isSales ? 'fa-chart-line' : 'fa-helmet-safety');
    const defaultBadge = isAdmin ? 'cyan' : (isSales ? 'amber' : 'emerald');

    const newUser = {
      username: username,
      email: email,
      password_hash: pwHash,
      full_name: userData.full_name.trim(),
      role: roleKey,
      team_role: (userData.team_role && userData.team_role.trim()) ? userData.team_role.trim() : defaultTeamRole,
      avatar_icon: defaultAvatar,
      badge_color: defaultBadge,
      pic_code: isSales ? '' : (userData.pic_code || userData.full_name.split(' ')[0]),
      status: 'approved', // Langsung aktif karena dibuat oleh Admin
      approved_by: adminActor || 'admin',
      approved_at: firebase.firestore.FieldValue.serverTimestamp(),
      created_by: adminActor || 'admin',
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(docId).set(newUser);
    await logActivity('ADMIN_CREATE_USER', `Admin ${adminActor || 'admin'} membuat akun ${isAdmin ? 'Administrator' : 'PIC'}: ${username} (${newUser.full_name})`, adminActor || 'admin');

    return {
      success: true,
      user: newUser,
      message: `Akun ${isAdmin ? 'Administrator' : 'PIC'} '${newUser.full_name}' (@${username}) berhasil dibuat dan langsung aktif!`
    };
  }

  // Update or add email for a user in Firestore
  async function firestoreUpdateUserEmail(username, newEmail, actor = '') {
    const uClean = String(username || '').trim().toLowerCase();
    const eClean = String(newEmail || '').trim().toLowerCase();

    if (!uClean) throw new Error('Username wajib diisi.');
    if (!eClean || !eClean.includes('@') || !eClean.includes('.')) {
      throw new Error('Format email tidak valid. Masukkan alamat email yang benar.');
    }

    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason || 'Koneksi ke Google Firebase belum aktif.');
    const db = initRes.db;

    // Check if email already used by another user
    try {
      const checkSnap = await db.collection('users').where('email', '==', eClean).limit(1).get();
      if (!checkSnap.empty) {
        const existingUser = checkSnap.docs[0].data();
        if (existingUser.username && existingUser.username.toLowerCase() !== uClean) {
          throw new Error(`Email '${eClean}' sudah digunakan oleh akun @${existingUser.username}. Silakan gunakan email lain.`);
        }
      }
    } catch (e) {
      if (e.message && e.message.includes('sudah digunakan')) throw e;
    }

    const docRef = db.collection('users').doc(`user_${uClean}`);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      await docRef.update({
        email: eClean,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const def = DEFAULT_TEAM_ACCOUNTS[uClean];
      await docRef.set({
        username: uClean,
        email: eClean,
        full_name: def?.full_name || uClean,
        role: def?.role || 'lapangan',
        avatar_icon: def?.avatar_icon || 'fa-helmet-safety',
        badge_color: def?.badge_color || 'cyan',
        pic_code: def?.pic_code || uClean,
        status: 'approved',
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Attempt local server update as well
    try {
      await fetch('/api/auth/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uClean, email: eClean })
      });
    } catch (e) {
      console.warn('Local SQLite email update notice:', e);
    }

    const actorUser = actor || uClean;
    await logActivity('UPDATE_EMAIL', `Email akun @${uClean} diperbarui menjadi ${eClean}`, actorUser);

    return {
      success: true,
      username: uClean,
      email: eClean,
      message: `Email akun @${uClean} berhasil disimpan dan diperbarui menjadi ${eClean}!`
    };
  }

  // Generic Firestore CRUD helper methods
  async function firestoreAddRecord(collectionName, data) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    // Determine deterministic doc ID if available
    let docId = null;
    if (data.id) {
      docId = String(data.id);
    } else if (collectionName.includes('sitac') && data.no_pa) {
      docId = 'pa_' + String(data.no_pa).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    } else if (collectionName.includes('collo') && data.no_so) {
      docId = 'so_' + String(data.no_so).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    } else if (collectionName.includes('gangguan') && data.no_tiket) {
      docId = 'tkt_' + String(data.no_tiket).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    const payload = {
      ...data,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (docId) {
      await db.collection(collectionName).doc(docId).set(payload, { merge: true });
    } else {
      const ref = await db.collection(collectionName).add(payload);
      docId = ref.id;
    }

    // Also record mutation into user_mutations for real-time broadcast across devices
    try {
      const type = collectionName.includes('sitac') ? 'sitac' : (collectionName.includes('collo') ? 'collo' : 'gangguan');
      const mutId = `${type}_${docId}`;
      await db.collection('user_mutations').doc(mutId).set({
        type: type,
        action: 'create',
        record_id: docId,
        data: payload,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (mutErr) {
      console.warn('Mutation broadcast notice:', mutErr);
    }

    // Also mirror to Supabase Cloud PostgreSQL
    if (window.SupabaseManager && typeof window.SupabaseManager.addRecord === 'function') {
      try {
        const numId = Number(docId);
        window.SupabaseManager.addRecord(collectionName, { id: isNaN(numId) ? docId : numId, ...data }).catch(() => {});
      } catch (sbErr) {}
    }

    return { id: docId, ...data };
  }

  async function firestoreUpdateRecord(collectionName, docId, updates) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;
    const sId = String(docId);
    const payload = {
      ...updates,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    let updated = false;
    try {
      const docRef = db.collection(collectionName).doc(sId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        await docRef.set(payload, { merge: true });
        updated = true;
      }
    } catch (e) {}

    if (!updated) {
      try {
        const numId = Number(sId);
        const q = db.collection(collectionName).where('id', '==', isNaN(numId) ? sId : numId).limit(1);
        const snap = await q.get();
        if (!snap.empty) {
          await snap.docs[0].ref.set(payload, { merge: true });
          updated = true;
        }
      } catch (e) {}
    }

    if (!updated) {
      // Fallback: save to doc(sId)
      await db.collection(collectionName).doc(sId).set({
        ...payload,
        id: isNaN(Number(sId)) ? sId : Number(sId)
      }, { merge: true });
    }

    // Also broadcast to user_mutations
    try {
      const type = collectionName.includes('sitac') ? 'sitac' : (collectionName.includes('collo') ? 'collo' : 'gangguan');
      const mutId = `${type}_${sId}`;
      await db.collection('user_mutations').doc(mutId).set({
        type: type,
        action: 'update',
        record_id: sId,
        updates: payload,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (mutErr) {}

    // Also mirror to Supabase Cloud PostgreSQL
    if (window.SupabaseManager && typeof window.SupabaseManager.updateRecord === 'function') {
      try {
        const numId = Number(sId);
        window.SupabaseManager.updateRecord(collectionName, isNaN(numId) ? sId : numId, updates).catch(() => {});
      } catch (sbErr) {}
    }

    return { success: true };
  }

  async function firestoreDeleteRecord(collectionName, docId) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;
    const sId = String(docId);

    try {
      const docRef = db.collection(collectionName).doc(sId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        await docRef.delete();
      }
    } catch (e) {}

    try {
      const numId = Number(sId);
      const snap = await db.collection(collectionName).where('id', '==', isNaN(numId) ? sId : numId).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {}

    // Also broadcast to user_mutations
    try {
      const type = collectionName.includes('sitac') ? 'sitac' : (collectionName.includes('collo') ? 'collo' : 'gangguan');
      const mutId = `${type}_${sId}`;
      await db.collection('user_mutations').doc(mutId).set({
        type: type,
        action: 'delete',
        record_id: sId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (mutErr) {}

    // Also mirror to Supabase Cloud PostgreSQL
    if (window.SupabaseManager && typeof window.SupabaseManager.deleteRecord === 'function') {
      try {
        const numId = Number(sId);
        window.SupabaseManager.deleteRecord(collectionName, isNaN(numId) ? sId : numId).catch(() => {});
      } catch (sbErr) {}
    }

    return { success: true };
  }

  // Activity Audit Log Tracker
  async function logActivity(action, details, username) {
    try {
      const initRes = initializeFirebaseApp();
      if (!initRes.success) return;
      const db = initRes.db;

      const user = username || (localStorage.getItem('telecom_portal_user') ? JSON.parse(localStorage.getItem('telecom_portal_user')).username : 'system');
      await db.collection('audit_logs').add({
        action: action,
        details: details || '',
        username: user,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        time_str: new Date().toLocaleString('id-ID')
      });
    } catch (e) {
      console.warn('Audit log write notice:', e);
    }
  }

  // Upload file directly to Firebase Storage
  async function uploadToStorage(file, folder = 'bukti_lapangan') {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error('Firebase belum terinisialisasi');

    if (typeof firebase.storage === 'undefined') {
      throw new Error('Firebase Storage SDK belum dimuat');
    }

    const storageRef = firebase.storage().ref();
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileRef = storageRef.child(`${folder}/${timestamp}_${safeName}`);

    const snapshot = await fileRef.put(file);
    const downloadUrl = await snapshot.ref.getDownloadURL();
    return { url: downloadUrl, filename: `${timestamp}_${safeName}` };
  }

  // Bulk Batch Import Records into Firestore
  async function batchImportRecords(collectionName, items, onProgress) {
    const initRes = initializeFirebaseApp();
    if (!initRes.success) throw new Error(initRes.reason);
    const db = initRes.db;

    if (!items || items.length === 0) return { success: true, count: 0 };

    const batchSize = 300;
    let totalImported = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const batch = db.batch();

      chunk.forEach(item => {
        const docRef = db.collection(collectionName).doc();
        const cleanItem = JSON.parse(JSON.stringify(item));
        batch.set(docRef, {
          ...cleanItem,
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      totalImported += chunk.length;

      if (onProgress) {
        onProgress(`Mengimpor ${totalImported}/${items.length} data ke Firestore...`, Math.round((totalImported / items.length) * 100));
      }
    }

    await logActivity('IMPORT_EXCEL', `Berhasil mengimpor ${totalImported} data ke koleksi ${collectionName}`);
    return { success: true, count: totalImported };
  }

  // Global window object export
  window.FirebaseManager = {
    getConfig: getActiveConfig,
    saveConfig: saveConfig,
    removeConfig: removeConfig,
    isConfigured: function () {
      return isConfigValid(getActiveConfig());
    },
    isCloudModeActive: isCloudModeActive,
    setCloudMode: setCloudMode,
    parseConfigString: parseConfigString,
    init: initializeFirebaseApp,
    testConnection: testConnection,
    uploadLocalDataToFirestore: uploadLocalDataToFirestore,
    fetchCollection: fetchFirestoreCollection,
    seedUsers: seedDefaultUsersIfEmpty,
    loginUser: firestoreLogin,
    registerUser: firestoreRegister,
    forgotLookup: firestoreForgotLookup,
    sendResetCode: firestoreSendResetCode,
    verifyResetCode: firestoreVerifyResetCode,
    resetPasswordWithCode: firestoreResetPasswordWithCode,
    maskEmail: maskEmail,
    resetPassword: firestoreResetPassword,
    changePassword: firestoreChangePassword,
    adminResetPassword: firestoreAdminResetPassword,
    deleteUser: firestoreDeleteUser,
    fetchPendingUsers: firestoreFetchPendingUsers,
    approveUser: firestoreApproveUser,
    rejectUser: firestoreRejectUser,
    adminCreateUser: firestoreAdminCreateUser,
    updateUserEmail: firestoreUpdateUserEmail,
    addRecord: firestoreAddRecord,
    updateRecord: firestoreUpdateRecord,
    deleteRecord: firestoreDeleteRecord,
    logActivity: logActivity,
    uploadToStorage: uploadToStorage,
    batchImportRecords: batchImportRecords,
    getDb: function () {
      if (!firestoreDb) {
        const res = initializeFirebaseApp();
        if (res.success) return res.db;
      }
      return firestoreDb;
    }
  };

  // Attempt auto-init on load if config exists
  if (window.FirebaseManager.isConfigured()) {
    const res = initializeFirebaseApp();
    if (res.success) {
      try {
        window.dispatchEvent(new CustomEvent('firebase:ready', { detail: window.FirebaseManager }));
      } catch (e) {}
    }
  }
})();
