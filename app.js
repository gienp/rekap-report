/**
 * Telecom Infrastructure & Lease Operations Portal - Frontend Application Engine
 * Integrates SQLite REST API, Dynamic Routing, Real-Time CRUD, Revenue Sharing & WebGIS
 */

(function () {
  'use strict';

  // Ensure dataset alias consistency across all scopes
  if (!window.SITAC_COLLO_DATA && window.PORTAL_DATASET) {
    window.SITAC_COLLO_DATA = window.PORTAL_DATASET;
  }
  if (!window.PORTAL_DATASET && window.SITAC_COLLO_DATA) {
    window.PORTAL_DATASET = window.SITAC_COLLO_DATA;
  }

  // Pastikan dataset SITAC diurutkan berdasarkan tanggal terbaru (descending)
  if (window.SITAC_COLLO_DATA && Array.isArray(window.SITAC_COLLO_DATA.sitac_records)) {
    window.SITAC_COLLO_DATA.sitac_records.sort((a, b) => {
      const getT = (item) => {
        const raw = item.date_dispos || item.date_close || item.date_pa || item.created_at || '';
        const s = String(raw).trim();
        if (s && s.length >= 10) {
          const t = Date.parse(s.substring(0, 10));
          if (!isNaN(t)) return t;
        }
        return 0;
      };
      const diff = getT(b) - getT(a);
      if (diff !== 0) return diff;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }

  // =========================================================================
  // PERSISTENT DATA MUTATION ENGINE (LOCALSTORAGE & CLOUD FIRESTORE)
  // Ensures newly added, edited, or deleted records PERSIST across page refreshes (F5)
  // =========================================================================
  const STORAGE_KEY_MUTATIONS = 'sitac_collo_user_mutations_v2';

  function getLocalMutations() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MUTATIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return {
            created: { sitac: [], collo: [], gangguan: [], ...(parsed.created || {}) },
            updated: { sitac: {}, collo: {}, gangguan: {}, ...(parsed.updated || {}) },
            deleted: { sitac: [], collo: [], gangguan: [], ...(parsed.deleted || {}) }
          };
        }
      }
    } catch (e) {
      console.warn('Gagal membaca mutasi lokal:', e);
    }
    return {
      created: { sitac: [], collo: [], gangguan: [] },
      updated: { sitac: {}, collo: {}, gangguan: {} },
      deleted: { sitac: [], collo: [], gangguan: [] }
    };
  }

  function saveLocalMutations(mutations) {
    try {
      localStorage.setItem(STORAGE_KEY_MUTATIONS, JSON.stringify(mutations));
    } catch (e) {
      console.warn('Gagal menyimpan mutasi ke localStorage:', e);
    }
  }

  function persistNewRecord(type, record) {
    if (!type || !record || !record.id) return;
    const mut = getLocalMutations();
    if (!mut.created[type]) mut.created[type] = [];
    const key = String(record.id);
    const idx = mut.created[type].findIndex(r => String(r.id) === key);
    if (idx >= 0) {
      mut.created[type][idx] = { ...record };
    } else {
      mut.created[type].unshift({ ...record });
    }
    if (mut.deleted[type]) {
      mut.deleted[type] = mut.deleted[type].filter(d => String(d) !== key);
    }
    saveLocalMutations(mut);
  }

  function persistUpdateRecord(type, id, updates) {
    if (!type || !id || !updates) return;
    const mut = getLocalMutations();
    const key = String(id);
    if (!mut.updated[type]) mut.updated[type] = {};
    mut.updated[type][key] = Object.assign(mut.updated[type][key] || {}, updates);

    if (mut.created[type]) {
      const cRec = mut.created[type].find(r => String(r.id) === key);
      if (cRec) Object.assign(cRec, updates);
    }
    saveLocalMutations(mut);
  }

  function persistDeleteRecord(type, id) {
    if (!type || !id) return;
    const mut = getLocalMutations();
    const key = String(id);
    if (!mut.deleted[type]) mut.deleted[type] = [];
    if (!mut.deleted[type].includes(key)) {
      mut.deleted[type].push(key);
    }
    if (mut.created[type]) {
      mut.created[type] = mut.created[type].filter(r => String(r.id) !== key);
    }
    if (mut.updated[type]) {
      delete mut.updated[type][key];
    }
    saveLocalMutations(mut);
  }

  function applyLocalMutationsToDataset() {
    const data = window.SITAC_COLLO_DATA || window.PORTAL_DATASET;
    if (!data) return;
    const mut = getLocalMutations();

    const collections = [
      { type: 'sitac', colKey: 'sitac_records' },
      { type: 'collo', colKey: 'collo_records' },
      { type: 'gangguan', colKey: 'gangguan_records' }
    ];

    collections.forEach(({ type, colKey }) => {
      if (!Array.isArray(data[colKey])) data[colKey] = [];
      const deletedSet = new Set((mut.deleted[type] || []).map(String));
      const updateMap = mut.updated[type] || {};
      const createdList = mut.created[type] || [];

      // 1. Filter out deleted records
      if (deletedSet.size > 0) {
        data[colKey] = data[colKey].filter(r => !deletedSet.has(String(r.id)));
      }

      // 2. Apply updates
      data[colKey].forEach(r => {
        const u = updateMap[String(r.id)];
        if (u) {
          Object.assign(r, u);
        }
      });

      // 3. Prepend newly created records (clean any stale automated test records first)
      const isTestRecord = (r) => {
        const pa = String(r.no_pa || '').toLowerCase();
        const cust = String(r.pelanggan || '').toLowerCase();
        const idStr = String(r.id || '');
        return pa.includes('cross-sync') || cust.includes('cross sync') || cust.includes('uji lintas') ||
               cust.includes('persistensi cloud') || cust === 'abc' || pa === '0123456789' || idStr.includes('1792462122');
      };

      const validCreatedList = createdList.filter(r => !isTestRecord(r));
      if (validCreatedList.length !== createdList.length) {
        mut.created[type] = validCreatedList;
        saveLocalMutations(mut);
      }

      validCreatedList.forEach(newRec => {
        const exists = data[colKey].some(r => String(r.id) === String(newRec.id));
        if (!exists && !deletedSet.has(String(newRec.id))) {
          data[colKey].unshift({ ...newRec });
        }
      });
    });
  }

  // Auto-apply stored mutations on script load
  applyLocalMutationsToDataset();

  // Expose reset cache helper globally for administrative debugging if ever needed
  window.resetLocalDataCache = function () {
    if (confirm('Apakah Anda yakin ingin menghapus data input lokal sementara dan mengembalikan ke data Excel asli?')) {
      localStorage.removeItem(STORAGE_KEY_MUTATIONS);
      window.location.reload();
    }
  };

  // =========================================================================
  // REAL-TIME TWO-WAY CLOUD FIRESTORE SYNCHRONIZATION (CROSS-DEVICE)
  // Ensures any record added, edited, or deleted on any device (phone/PC)
  // is immediately synchronized in real time across all users' devices.
  // =========================================================================
  let _cloudSyncActive = false;

  function initRealtimeCloudSync() {
    if (_cloudSyncActive) return;
    if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) return;

    try {
      const db = window.FirebaseManager.getDb();
      if (!db) return;
      _cloudSyncActive = true;
      console.log('⚡ [CloudSync] Mengaktifkan sinkronisasi realtime dua arah dengan Cloud Firestore...');

      // Ultra-efficient quota-friendly real-time sync using user_mutations only (limit 20)
      // Eliminates the expensive full-collection reads (3,000+ reads per reload) that burned the daily Cloud quota
      db.collection('user_mutations')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .onSnapshot(snapshot => {
          if (!snapshot) return;
          const dataRoot = window.SITAC_COLLO_DATA || window.PORTAL_DATASET;
          if (!dataRoot) return;

          let mutChanges = false;
          let newRecordsAdded = 0;

          snapshot.docChanges().forEach(change => {
            if (change.type !== 'added' && change.type !== 'modified') return;
            const mut = change.doc.data();
            const colKey = mut.type === 'sitac' ? 'sitac_records' : (mut.type === 'collo' ? 'collo_records' : 'gangguan_records');
            const targetList = dataRoot[colKey];
            if (!Array.isArray(targetList)) return;

            const recId = String(mut.record_id || (mut.data && mut.data.id) || '');

            if ((mut.action === 'create' || mut.action === 'insert') && (mut.data || mut.record)) {
              const itemData = mut.data || mut.record;
              const exists = targetList.some(r => {
                if (r._firestoreDocId && r._firestoreDocId === change.doc.id) return true;
                if (mut.type === 'sitac' && r.no_pa && itemData.no_pa) {
                  return String(r.no_pa).trim().toLowerCase() === String(itemData.no_pa).trim().toLowerCase();
                }
                if (mut.type === 'collo' && r.no_so && itemData.no_so) {
                  return String(r.no_so).trim().toLowerCase() === String(itemData.no_so).trim().toLowerCase();
                }
                if (mut.type === 'gangguan' && r.no_tiket && itemData.no_tiket) {
                  return String(r.no_tiket).trim().toLowerCase() === String(itemData.no_tiket).trim().toLowerCase();
                }
                return String(r.id) === String(itemData.id || recId);
              });
              if (!exists) {
                targetList.unshift({ ...itemData, _firestoreDocId: change.doc.id });
                mutChanges = true;
                newRecordsAdded++;
              }
            } else if (mut.action === 'update' && (mut.updates || mut.data)) {
              const updates = mut.updates || mut.data;
              const target = targetList.find(r => 
                String(r.id) === recId || 
                (r.no_pa && updates.no_pa && String(r.no_pa).trim().toLowerCase() === String(updates.no_pa).trim().toLowerCase()) || 
                (r.no_so && updates.no_so && String(r.no_so).trim().toLowerCase() === String(updates.no_so).trim().toLowerCase()) ||
                (r.no_tiket && updates.no_tiket && String(r.no_tiket).trim().toLowerCase() === String(updates.no_tiket).trim().toLowerCase())
              );
              if (target) {
                Object.assign(target, updates);
                mutChanges = true;
              }
            } else if (mut.action === 'delete') {
              const idx = targetList.findIndex(r => String(r.id) === recId);
              if (idx >= 0) {
                targetList.splice(idx, 1);
                mutChanges = true;
              }
            }
          });

          if (mutChanges) {
            invalidateStaticDataCache();
            triggerViewRefresh('all');
            if (newRecordsAdded > 0 && typeof showToast === 'function') {
              showToast(`${newRecordsAdded} data baru diterima dari Cloud!`, 'info');
            }
          }
        }, err => {
          console.warn('[CloudSync] Mutations listener standby (kuota Cloud tercapai / offline):', err.message || err);
        });

    } catch (e) {
      console.warn('[CloudSync] Error in initRealtimeCloudSync:', e);
    }
  }

  function triggerViewRefresh(type) {
    try {
      if (typeof state === 'undefined') return;
      if ((type === 'sitac' || type === 'all') && state.activeView === 'view-sitac-pa' && typeof loadSitacData === 'function') {
        loadSitacData();
      } else if ((type === 'collo' || type === 'all') && (state.activeView === 'view-collo-list' || state.activeView === 'view-overview') && typeof loadColloData === 'function') {
        loadColloData();
      } else if ((type === 'gangguan' || type === 'all') && state.activeView === 'view-gangguan' && typeof loadGangguanData === 'function') {
        loadGangguanData();
      } else if (state.activeView === 'view-executive' && typeof loadExecutiveSummary === 'function') {
        loadExecutiveSummary();
      } else if (state.activeView === 'view-collo-alerts' && typeof loadAlertsData === 'function') {
        loadAlertsData();
      } else if (state.activeView === 'view-collo-rev-sharing' && typeof loadRevSharingData === 'function') {
        loadRevSharingData();
      }

      if (typeof updateMapMarkers === 'function') {
        updateMapMarkers();
      }
    } catch(err) {
      console.warn('[CloudSync] triggerViewRefresh notice:', err);
    }
  }

  // Trigger sync on readiness or load
  window.addEventListener('firebase:ready', () => {
    initRealtimeCloudSync();
  });
  if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
    initRealtimeCloudSync();
  }

  // =========================================================================
  // RESILIENT STATIC DATA ADAPTER & API ROUTER (CLOUD HOSTING & OFFLINE)
  // Ensures all charts, KPI cards, tables, WebGIS pins, and alerts render
  // seamlessly on Firebase Hosting and static CDN environments without server errors.
  // =========================================================================
  function isUserAssignedToTask(rec, user) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const picField = (rec.pic_perijinan || '').toLowerCase().trim();
    if (!picField) return false;
    const tokens = [];
    if (user.username) tokens.push(user.username.toLowerCase());
    if (user.pic_code) tokens.push(user.pic_code.toLowerCase());
    if (user.full_name) {
      tokens.push(user.full_name.toLowerCase());
      user.full_name.toLowerCase().split(/\s+/).forEach(p => {
        if (p.length >= 3 && !['dan', 'tim', 'all'].includes(p)) {
          tokens.push(p);
        }
      });
    }
    const norm = picField.replace(/[.\-_]/g, ' ');
    return tokens.some(t => picField.includes(t) || norm.includes(t));
  }

  function isTaskEditableByUser(rec) {
    if (!rec) return false;
    // When in Monitoring Tim SITAC view, it's always read-only
    if (state.activeView === 'view-sitac-colleagues') return false;
    // Admins can edit anything
    if (state.currentUser?.role === 'admin') return true;
    // Tim Lapangan can ONLY edit tasks assigned to them
    if (state.currentUser?.role === 'lapangan') {
      return isUserAssignedToTask(rec, state.currentUser);
    }
    // Sales role cannot edit operational tasks
    return false;
  }

  // Static (Firebase Hosting / offline) mode = no local Python server available
  function isStaticMode() {
    return !(window.location.port === '8888' || window.location.port === '8000');
  }

  // Proof file URL: embedded data URL (static mode) or file saved in /uploads (server mode)
  function fotoUrl(foto) {
    const f = String(foto || '');
    if (/^(data:|https?:\/\/)/i.test(f)) return f;
    return '/uploads/' + encodeURIComponent(f);
  }
  function fotoIsImage(foto) {
    const f = String(foto || '');
    if (/^data:image\//i.test(f)) return true;
    return /\.(jpe?g|png|webp|gif)$/i.test(f);
  }
  function fotoIsPdf(foto) {
    const f = String(foto || '');
    if (/^data:application\/pdf/i.test(f)) return true;
    return /\.pdf$/i.test(f);
  }
  function fotoDisplayName(foto) {
    const f = String(foto || '');
    return /^data:/i.test(f) ? 'Lampiran bukti (tersimpan di cloud)' : f;
  }

  // Compress image to a small JPEG data URL (Firestore doc limit is 1 MB)
  function compressImageToDataUrl(file, maxSide = 1280, quality = 0.72) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Duplicate No PA lookup (generic "NON PA" placeholders may repeat)
  function findDuplicateNoPa(noPa) {
    const key = String(noPa || '').trim().toUpperCase();
    if (!key || key.replace(/[\s_\-]+/g, '') === 'NONPA') return null;
    const all = (window.SITAC_COLLO_DATA?.sitac_records || []);
    return all.find(s => String(s.no_pa || '').trim().toUpperCase() === key) || null;
  }

  function computePicPerformanceFromData(sitacList, gangguanList) {
    const sList = sitacList || [];
    const gList = gangguanList || [];

    const gMap = {};
    gList.forEach(g => {
      const raw = (g.pic_perijinan || '').trim();
      if (raw) {
        const pic = typeof formatPicName === 'function' ? formatPicName(raw) : raw;
        gMap[pic] = (gMap[pic] || 0) + 1;
      }
    });

    const picMap = {};
    sList.forEach(s => {
      const raw = (s.pic_perijinan || '').trim();
      if (!raw || raw === '-') return;
      const pic = typeof formatPicName === 'function' ? formatPicName(raw) : raw;
      if (!picMap[pic]) {
        picMap[pic] = {
          pic,
          total_penugasan: 0,
          finish: 0,
          ongoing: 0,
          hold: 0,
          cancel: 0,
          biaya_awal: 0,
          biaya_final: 0,
          efisiensi_rupiah: 0,
          durasi_sum: 0,
          durasi_count: 0
        };
      }
      const e = picMap[pic];
      e.total_penugasan++;
      const p = (s.progress || '').toLowerCase();
      if (p === 'finish') e.finish++;
      else if (p === 'ongoing') e.ongoing++;
      else if (p === 'hold') e.hold++;
      else if (p === 'cancel') e.cancel++;

      e.biaya_awal += (Number(s.biaya_permintaan_awal) || 0);
      e.biaya_final += (Number(s.biaya_final) || 0);
      e.efisiensi_rupiah += (Number(s.efisiensi_rupiah) || 0);
      if (s.durasi_hari !== null && s.durasi_hari !== undefined && s.durasi_hari >= 0) {
        e.durasi_sum += Number(s.durasi_hari);
        e.durasi_count++;
      }
    });

    return Object.values(picMap).map(p => {
      const tot = p.total_penugasan;
      const fin = p.finish;
      const bAwal = p.biaya_awal;
      const bEff = p.efisiensi_rupiah;
      return {
        pic: p.pic,
        total_penugasan: tot,
        finish: fin,
        ongoing: p.ongoing,
        hold: p.hold,
        cancel: p.cancel,
        finish_rate: tot > 0 ? Math.round((fin / tot) * 1000) / 10 : 0,
        biaya_awal: bAwal,
        biaya_final: p.biaya_final,
        efisiensi_rupiah: bEff,
        efisiensi_persen: bAwal > 0 ? Math.round((bEff / bAwal) * 1000) / 10 : 0,
        avg_sla_hari: p.durasi_count > 0 ? Math.round((p.durasi_sum / p.durasi_count) * 10) / 10 : 0,
        gangguan_count: gMap[p.pic] || 0
      };
    }).sort((a, b) => b.total_penugasan - a.total_penugasan);
  }

  // High-performance static memory cache
  let _cachedExecSummaryAll = null;
  let _cachedMetaOptions = null;

  function invalidateStaticDataCache() {
    _cachedExecSummaryAll = null;
    _cachedMetaOptions = null;
  }

  function handleStaticApiRequest(url, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      invalidateStaticDataCache();
    }
    let body = {};
    if (init.body) {
      try {
        body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      } catch (e) { body = {}; }
    }
    const parsedUrl = new URL(url, window.location.origin || 'http://localhost');
    const path = parsedUrl.pathname;
    const params = parsedUrl.searchParams;

    const data = window.SITAC_COLLO_DATA || window.PORTAL_DATASET || {};
    const colloList = data.collo_records || [];
    const sitacList = data.sitac_records || [];
    const gangguanList = data.gangguan_records || [];
    const rekapEff = (data.summary && data.summary.rekap_efisiensi) || data.rekap_efisiensi || [];
    const workload = (data.summary && data.summary.workload_performa) || data.workload_performa || [];

    // 0. Handle Static/Cloud Mutations for SITAC (POST & PATCH & DELETE)
    const matchPatchSitac = path.match(/^\/api\/sitac\/(\d+)$/);
    if (method === 'PATCH' && matchPatchSitac) {
      const sitacId = parseInt(matchPatchSitac[1], 10);
      const target = sitacList.find(s => s.id === sitacId);
      if (target) {
        Object.assign(target, body);
        if (body.latitude !== undefined || body.longitude !== undefined) {
          const lat = (body.latitude !== null && body.latitude !== undefined && String(body.latitude).trim() !== '') ? Number(body.latitude) : null;
          const lng = (body.longitude !== null && body.longitude !== undefined && String(body.longitude).trim() !== '') ? Number(body.longitude) : null;
          target.latitude = lat;
          target.longitude = lng;
          target.coord_type = (lat !== null && lng !== null) ? 'EXACT' : null;
        }
        if (body.biaya_permintaan_awal !== undefined || body.biaya_final !== undefined) {
          const bAwal = Number(body.biaya_permintaan_awal !== undefined ? body.biaya_permintaan_awal : target.biaya_permintaan_awal) || 0;
          const bFinal = Number(body.biaya_final !== undefined ? body.biaya_final : target.biaya_final) || 0;
          target.biaya_permintaan_awal = bAwal;
          target.biaya_final = bFinal;
          target.efisiensi_rupiah = Math.max(0, bAwal - bFinal);
          target.efisiensi_persen = bAwal > 0 ? Number(((target.efisiensi_rupiah / bAwal) * 100).toFixed(2)) : 0;
          target.is_berbiaya = (bAwal > 0 || bFinal > 0) ? 1 : 0;
        }
        persistUpdateRecord('sitac', sitacId, body);
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          window.FirebaseManager.updateRecord('sitac_records', String(sitacId), body).catch(() => {});
        }
        return { success: true, message: `SITAC #${sitacId} berhasil diperbarui (Tersimpan Permanen)` };
      }
      return { success: false, message: 'Data SITAC tidak ditemukan' };
    }

    const matchPatchCollo = path.match(/^\/api\/collo\/(\d+)$/);
    if (method === 'PATCH' && matchPatchCollo) {
      const colloId = parseInt(matchPatchCollo[1], 10);
      const target = colloList.find(c => c.id === colloId);
      if (target) {
        Object.assign(target, body);
        persistUpdateRecord('collo', colloId, body);
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          window.FirebaseManager.updateRecord('collo_records', String(colloId), body).catch(() => {});
        }
        return { success: true, message: `Data Link #${colloId} berhasil diperbarui (Tersimpan Permanen)` };
      }
      return { success: false, message: 'Data Link tidak ditemukan' };
    }

    const matchPatchGangguan = path.match(/^\/api\/gangguan\/(\d+)$/);
    if (method === 'PATCH' && matchPatchGangguan) {
      const gangguanId = parseInt(matchPatchGangguan[1], 10);
      const target = gangguanList.find(g => g.id === gangguanId);
      if (target) {
        Object.assign(target, body);
        persistUpdateRecord('gangguan', gangguanId, body);
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          window.FirebaseManager.updateRecord('gangguan_records', String(gangguanId), body).catch(() => {});
        }
        return { success: true, message: `Tiket #${gangguanId} berhasil diperbarui (Tersimpan Permanen)` };
      }
      return { success: false, message: 'Data Gangguan tidak ditemukan' };
    }

    // Handle DELETE for sitac, collo, gangguan
    const matchDeleteSitac = path.match(/^\/api\/sitac\/(\d+)$/);
    if (method === 'DELETE' && matchDeleteSitac) {
      const sitacId = parseInt(matchDeleteSitac[1], 10);
      const idx = sitacList.findIndex(s => s.id === sitacId);
      if (idx >= 0) sitacList.splice(idx, 1);
      persistDeleteRecord('sitac', sitacId);
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        window.FirebaseManager.deleteRecord('sitac_records', String(sitacId)).catch(() => {});
      }
      return { success: true, message: `Disposisi SITAC #${sitacId} berhasil dihapus!` };
    }

    const matchDeleteCollo = path.match(/^\/api\/collo\/(\d+)$/);
    if (method === 'DELETE' && matchDeleteCollo) {
      const colloId = parseInt(matchDeleteCollo[1], 10);
      const idx = colloList.findIndex(c => c.id === colloId);
      if (idx >= 0) colloList.splice(idx, 1);
      persistDeleteRecord('collo', colloId);
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        window.FirebaseManager.deleteRecord('collo_records', String(colloId)).catch(() => {});
      }
      return { success: true, message: `Sirkuit Link #${colloId} berhasil dihapus!` };
    }

    const matchDeleteGangguan = path.match(/^\/api\/gangguan\/(\d+)$/);
    if (method === 'DELETE' && matchDeleteGangguan) {
      const gangguanId = parseInt(matchDeleteGangguan[1], 10);
      const idx = gangguanList.findIndex(g => g.id === gangguanId);
      if (idx >= 0) gangguanList.splice(idx, 1);
      persistDeleteRecord('gangguan', gangguanId);
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        window.FirebaseManager.deleteRecord('gangguan_records', String(gangguanId)).catch(() => {});
      }
      return { success: true, message: `Tiket gangguan #${gangguanId} berhasil dihapus!` };
    }

    if (method === 'POST' && path === '/api/upload') {
      const dataUri = String(body.data || '');
      if (!dataUri) return { success: false, message: 'Data file tidak ditemukan' };
      const tgtType = body.type;
      const tgtId = body.id;
      if (tgtType && tgtId) {
        const list = tgtType === 'sitac' ? sitacList : tgtType === 'gangguan' ? gangguanList : colloList;
        const tgt = list.find(r => r.id == tgtId);
        if (tgt) {
          tgt.foto_bukti = dataUri;
          persistUpdateRecord(tgtType, tgtId, { foto_bukti: dataUri });
        }
      }
      return { success: true, message: 'File bukti lapangan berhasil diunggah', filename: dataUri, file_url: dataUri };
    }

    if (method === 'POST' && path === '/api/sitac') {
      const dupRec = findDuplicateNoPa(body.no_pa);
      if (dupRec) {
        return { success: false, message: `Nomor PA ${String(body.no_pa).trim()} sudah ada (ID #${dupRec.id} - ${String(dupRec.pelanggan || '').slice(0, 40)}). Gunakan nomor PA lain atau edit data yang sudah ada.` };
      }
      const maxId = sitacList.reduce((max, s) => Math.max(max, Number(s.id) || 0), 1000);
      const lat = (body.latitude !== null && body.latitude !== undefined && String(body.latitude).trim() !== '') ? Number(body.latitude) : null;
      const lng = (body.longitude !== null && body.longitude !== undefined && String(body.longitude).trim() !== '') ? Number(body.longitude) : null;
      const newRec = {
        id: maxId + 1,
        ...body,
        latitude: lat,
        longitude: lng,
        coord_type: (lat !== null && lng !== null) ? 'EXACT' : null
      };
      sitacList.unshift(newRec);
      persistNewRecord('sitac', newRec);
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        window.FirebaseManager.addRecord('sitac_records', newRec).catch(() => {});
      }
      return { success: true, message: 'Disposisi SITAC baru berhasil ditambahkan (Tersimpan Permanen)', id: newRec.id, record: newRec };
    }

    if (method === 'POST' && path === '/api/collo') {
      const maxId = colloList.reduce((max, c) => Math.max(max, Number(c.id) || 0), 3100);
      const rev_sewa = Number(body.rev_sewa_tahun || 0);
      const biaya_sewa = Number(body.biaya_sewa_tahun || 0);
      const margin_rp = rev_sewa - biaya_sewa;
      const margin_pct = rev_sewa > 0 ? Number(((margin_rp / rev_sewa) * 100).toFixed(1)) : 0;
      const pct = Number(body.rev_sharing_pct || 0);
      const biaya_share = (pct > 0 && rev_sewa > 0) ? Math.round(rev_sewa * (pct / 100)) : 0;
      
      let sisa_hari = 999;
      let alert_cat = "SAFE";
      let alert_label = "Aman";
      let alert_color = "green";
      if (body.end_date) {
        try {
          const ed = new Date(body.end_date);
          const now = new Date();
          sisa_hari = Math.ceil((ed - now) / (1000 * 60 * 60 * 24));
          if (sisa_hari <= 0) {
            alert_cat = "EXPIRED"; alert_label = "Lewat Jatuh Tempo"; alert_color = "red";
          } else if (sisa_hari < 30) {
            alert_cat = "CRITICAL"; alert_label = `Sisa ${sisa_hari} Hari`; alert_color = "red";
          } else if (sisa_hari <= 60) {
            alert_cat = "WARNING"; alert_label = `Sisa ${sisa_hari} Hari`; alert_color = "yellow";
          } else {
            alert_cat = "SAFE"; alert_label = `Sisa ${sisa_hari} Hari`; alert_color = "green";
          }
        } catch (e) {}
      }

      const newRec = {
        id: maxId + 1,
        pengelola: String(body.pengelola || '').trim(),
        pelanggan: String(body.pelanggan || '').trim(),
        no_so: String(body.no_so || '').trim(),
        sid: String(body.sid || '').trim(),
        originating: String(body.originating || '').trim(),
        terminating: String(body.terminating || '').trim(),
        site: String(body.site || '').trim(),
        jenis_sewa: String(body.jenis_sewa || 'Colocation').trim(),
        layanan: String(body.layanan || '').trim(),
        rev_sewa_tahun: rev_sewa,
        biaya_otc: Number(body.biaya_otc || 0),
        biaya_deposit: Number(body.biaya_deposit || 0),
        biaya_sewa_tahun: biaya_sewa,
        margin_rupiah: margin_rp,
        margin_persen: margin_pct,
        rev_sharing_pct: pct,
        biaya_rev_sharing: biaya_share,
        rev_sharing_raw: pct > 0 ? `${pct}%` : '',
        status: String(body.status || 'ACTIVE').trim().toUpperCase(),
        is_active: (body.status || 'ACTIVE').trim().toUpperCase() === 'ACTIVE' ? 1 : 0,
        start_date: body.start_date || '',
        end_date: body.end_date || '',
        sisa_hari: sisa_hari,
        alert_category: alert_cat,
        alert_label: alert_label,
        spp: String(body.spp || '').trim(),
        po_baru: String(body.po_baru || '').trim(),
        pic_admin: String(body.pic_admin || '').trim(),
        alamat_pengelola: String(body.alamat_pengelola || '').trim(),
        keterangan: String(body.keterangan || '').trim(),
        foto_bukti: String(body.foto_bukti || '').trim() || null
      };
      colloList.unshift(newRec);
      persistNewRecord('collo', newRec);
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        window.FirebaseManager.addRecord('collo_records', newRec).catch(() => {});
      }
      return { success: true, message: 'Link sewa baru berhasil ditambahkan (Tersimpan Permanen)', id: newRec.id, record: newRec };
    }

    if (method === 'POST' && path === '/api/gangguan') {
      const maxId = gangguanList.reduce((max, g) => Math.max(max, Number(g.id) || 0), 100);
      const isSelesai = ['1', 'true', 'True', 'Selesai'].includes(String(body.is_selesai || '0').trim());
      const newRec = {
        id: maxId + 1,
        no_tiket: String(body.no_tiket || `TIKET-EMERGENCY-${String(maxId + 1).padStart(4, '0')}`).trim(),
        terminating: String(body.terminating || '').trim(),
        ptl: String(body.ptl || '').trim(),
        pic_perijinan: String(body.pic_perijinan || '').trim(),
        tgl_dispos: body.tgl_dispos || new Date().toISOString().slice(0, 10),
        status_pekerjaan: isSelesai ? 'Selesai' : 'Proses (Open)',
        tgl_selesai: isSelesai ? (body.tgl_selesai || new Date().toISOString().slice(0, 10)) : null,
        sla_target: String(body.sla_target || 'H+1').trim(),
        biaya_gangguan: Number(body.biaya_gangguan || 0),
        update_gangguan: String(body.update_gangguan || '').trim(),
        foto_bukti: String(body.foto_bukti || '').trim()
      };
      gangguanList.unshift(newRec);
      persistNewRecord('gangguan', newRec);
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        window.FirebaseManager.addRecord('gangguan_records', newRec).catch(() => {});
      }
      return { success: true, message: 'Tiket gangguan darurat berhasil ditambahkan (Tersimpan Permanen)', id: newRec.id, record: newRec };
    }

    // 1. Executive Summary
    if (path === '/api/executive/summary' || path.startsWith('/api/executive/summary')) {
      const urlParams = new URL(path, 'http://localhost').searchParams;
      const qYear = urlParams.get('year') || (state?.execFilter ? state.execFilter.period : 'ALL');
      const qStart = urlParams.get('start') || (state?.execFilter ? state.execFilter.startDate : '');
      const qEnd = urlParams.get('end') || (state?.execFilter ? state.execFilter.endDate : '');

      if ((!qYear || qYear === 'ALL') && !qStart && !qEnd && _cachedExecSummaryAll) {
        return _cachedExecSummaryAll;
      }

      let curCollo = colloList;
      let curSitac = sitacList;
      let curGangguan = gangguanList;

      let isFilteredYear = false;
      let filterYear = null;

      if (qYear && qYear !== 'ALL' && qYear !== 'CUSTOM') {
        const yr = parseInt(qYear, 10);
        if (!isNaN(yr)) {
          isFilteredYear = true;
          filterYear = yr;
          curSitac = sitacList.filter(s => s.tahun == yr || (s.date_pa && s.date_pa.startsWith(String(yr))));
          curGangguan = gangguanList.filter(g => (g.tgl_dispos && g.tgl_dispos.startsWith(String(yr))) || (g.tgl_selesai && g.tgl_selesai.startsWith(String(yr))));
          curCollo = colloList.filter(c => {
            const sy = c.start_date ? parseInt(c.start_date.substring(0, 4), 10) : 0;
            const ey = c.end_date ? parseInt(c.end_date.substring(0, 4), 10) : 9999;
            return (sy <= yr && ey >= yr) || sy === yr;
          });
        }
      } else if (qStart && qEnd) {
        const startYm = qStart.length >= 7 ? (parseInt(qStart.substring(0, 4), 10) * 100 + parseInt(qStart.substring(5, 7), 10)) : 0;
        const endYm = qEnd.length >= 7 ? (parseInt(qEnd.substring(0, 4), 10) * 100 + parseInt(qEnd.substring(5, 7), 10)) : 999999;
        curSitac = sitacList.filter(s => {
          if (s.date_pa) return s.date_pa >= qStart && s.date_pa <= qEnd;
          if (s.tahun && s.bulan) {
            const ym = s.tahun * 100 + s.bulan;
            return ym >= startYm && ym <= endYm;
          }
          return false;
        });
        curGangguan = gangguanList.filter(g => (g.tgl_dispos && g.tgl_dispos >= qStart && g.tgl_dispos <= qEnd));
        curCollo = colloList.filter(c => (c.start_date && c.start_date <= qEnd) && (!c.end_date || c.end_date >= qStart));
      }

      const cAct = curCollo.filter(c => c.status === 'ACTIVE');
      const cNon = curCollo.filter(c => c.status === 'NON ACTIVE');
      const cDeact = curCollo.filter(c => c.status === 'DEACTIVASI');
      const rev = cAct.reduce((a, b) => a + (Number(b.rev_sewa_tahun) || 0), 0);
      const biaya = cAct.reduce((a, b) => a + (Number(b.biaya_sewa_tahun) || 0), 0);
      const margin = cAct.reduce((a, b) => a + (Number(b.margin_rupiah) || 0), 0);
      const revShareCount = curCollo.filter(c => (Number(c.rev_sharing_pct) || 0) > 0 || (c.rev_sharing && c.rev_sharing !== '-')).length;
      const criticalAlertsCount = cAct.filter(c => c.alert_category === 'CRITICAL').length;
      const marginPct = rev > 0 ? Number(((rev - biaya) / rev * 100).toFixed(2)) : 0;

      const sFinish = curSitac.filter(s => s.progress === 'Finish').length;
      const sOngoing = curSitac.filter(s => s.progress === 'Ongoing').length;
      const sHold = curSitac.filter(s => s.progress === 'Hold').length;
      const sCancel = curSitac.filter(s => s.progress === 'Cancel').length;
      const bAwal = curSitac.reduce((a, b) => a + (Number(b.biaya_permintaan_awal) || 0), 0);
      const bFinal = curSitac.reduce((a, b) => a + (Number(b.biaya_final) || 0), 0);
      const bEff = curSitac.reduce((a, b) => a + (Number(b.efisiensi_rupiah) || 0), 0);
      const effPct = bAwal > 0 ? Number((bEff / bAwal * 100).toFixed(2)) : 0;

      const gTotal = curGangguan.length;
      const gSelesai = curGangguan.filter(g => g.is_selesai == 1 || g.status === 'Selesai').length;
      const gAktif = gTotal - gSelesai;
      const resRate = gTotal > 0 ? Number((gSelesai / gTotal * 100).toFixed(1)) : 0;

      const pMap = {};
      cAct.forEach(c => {
        const p = c.pengelola || 'Unknown';
        if (!pMap[p]) pMap[p] = { pengelola: p, sirkuit_count: 0, total_biaya: 0, total_rev: 0, total_margin: 0, biaya_sewa: 0, rev_sewa: 0 };
        pMap[p].sirkuit_count++;
        pMap[p].total_biaya += Number(c.biaya_sewa_tahun) || 0;
        pMap[p].total_rev += Number(c.rev_sewa_tahun) || 0;
        pMap[p].total_margin += Number(c.margin_rupiah) || 0;
        pMap[p].biaya_sewa = pMap[p].total_biaya;
        pMap[p].rev_sewa = pMap[p].total_rev;
      });
      const topPengelola = Object.values(pMap).sort((a, b) => b.total_biaya - a.total_biaya).slice(0, 10);

      const tMap = {};
      curSitac.forEach(s => {
        const m = s.bulan;
        const yr = s.tahun || (s.date_pa ? parseInt(s.date_pa.substring(0, 4), 10) : (filterYear || ''));
        if (m) {
          const k = `${yr}-${String(m).padStart(2, '0')}`;
          if (!tMap[k]) tMap[k] = { tahun: yr, bulan: m, count_masuk: 0, count_selesai: 0 };
          tMap[k].count_masuk++;
          if (s.progress === 'Finish') tMap[k].count_selesai++;
        }
      });
      const monthlyTrend = Object.values(tMap).sort((a, b) => (Number(a.tahun) - Number(b.tahun)) || (Number(a.bulan) - Number(b.bulan)));

      const jMap = {};
      cAct.forEach(c => {
        const j = c.jenis_sewa || 'Lainnya';
        jMap[j] = (jMap[j] || 0) + 1;
      });
      const jenisSewaDist = Object.entries(jMap).map(([jenis, cnt]) => ({ jenis, cnt })).sort((a, b) => b.cnt - a.cnt).slice(0, 6);

      const colloStatusDist = [
        { status: 'ACTIVE', cnt: cAct.length, rev },
        { status: 'NON ACTIVE', cnt: cNon.length, rev: 0 },
        { status: 'DEACTIVASI', cnt: cDeact.length, rev: 0 }
      ];

      const eMap = { CRITICAL: 0, WARNING: 0, SAFE: 0, EXPIRED: 0 };
      cAct.forEach(c => {
        const cat = c.alert_category || 'SAFE';
        if (eMap[cat] !== undefined) eMap[cat]++;
        else eMap.SAFE++;
      });
      const expirationDist = Object.entries(eMap).map(([alert_category, cnt]) => ({ alert_category, cnt }));

      let aGreen = 0, aYellow = 0, aRed = 0;
      curSitac.forEach(s => {
        const d = s.durasi_hari;
        if (d !== null && d !== undefined && d >= 0) {
          if (d <= 7) aGreen++;
          else if (d <= 14) aYellow++;
          else aRed++;
        }
      });

      let curRekapEff = [];
      if (isFilteredYear) {
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const mEffMap = {};
        curSitac.forEach(s => {
          const m = s.bulan;
          if (m && m >= 1 && m <= 12) {
            if (!mEffMap[m]) mEffMap[m] = { tahun: `${monthNames[m]} ${filterYear}`, nilai_awal: 0, nilai_akhir: 0, efisiensi_rupiah: 0 };
            mEffMap[m].nilai_awal += Number(s.biaya_permintaan_awal) || 0;
            mEffMap[m].nilai_akhir += Number(s.biaya_final) || 0;
            mEffMap[m].efisiensi_rupiah += Number(s.efisiensi_rupiah) || 0;
          }
        });
        curRekapEff = Object.keys(mEffMap).sort((a, b) => Number(a) - Number(b)).map(k => mEffMap[k]);
      } else {
        if (rekapEff && rekapEff.length > 0) {
          curRekapEff = rekapEff.slice().sort((a, b) => Number(a.tahun) - Number(b.tahun));
        } else {
          const yEffMap = {};
          sitacList.forEach(s => {
            const y = s.tahun || (s.date_pa ? parseInt(s.date_pa.substring(0, 4), 10) : 0);
            if (y && y >= 2024) {
              if (!yEffMap[y]) yEffMap[y] = { tahun: y, nilai_awal: 0, nilai_akhir: 0, efisiensi_rupiah: 0 };
              yEffMap[y].nilai_awal += Number(s.biaya_permintaan_awal) || 0;
              yEffMap[y].nilai_akhir += Number(s.biaya_final) || 0;
              yEffMap[y].efisiensi_rupiah += Number(s.efisiensi_rupiah) || 0;
            }
          });
          curRekapEff = Object.values(yEffMap).sort((a, b) => a.tahun - b.tahun);
        }
      }

      const vMap = {};
      cAct.forEach(c => {
        const p = c.pengelola || 'Unknown';
        if (!vMap[p]) vMap[p] = { pengelola: p, sirkuit_count: 0, rev: 0 };
        vMap[p].sirkuit_count++;
        vMap[p].rev += Number(c.rev_sewa_tahun) || 0;
      });
      const topColloVendors = Object.values(vMap).sort((a, b) => b.sirkuit_count - a.sirkuit_count).slice(0, 8);

      // Annual operational sum across 2024, 2025, 2026
      const annualCumulativeActive = [2024, 2025, 2026].reduce((acc, yr) => {
        const cnt = colloList.filter(c => {
          if (c.status !== 'ACTIVE') return false;
          const sy = c.start_date ? parseInt(String(c.start_date).substring(0, 4), 10) : 0;
          const ey = c.end_date ? parseInt(String(c.end_date).substring(0, 4), 10) : 9999;
          return (sy <= yr && ey >= yr) || sy === yr;
        }).length;
        return acc + cnt;
      }, 0);

      const newActCount = filterYear ? curCollo.filter(c => c.status === 'ACTIVE' && c.start_date && c.start_date.startsWith(String(filterYear))).length : 0;
      const carryActCount = filterYear ? curCollo.filter(c => c.status === 'ACTIVE' && c.start_date && parseInt(String(c.start_date).substring(0, 4), 10) < filterYear).length : 0;

      return {
        collo: {
          total_records: curCollo.length,
          active_count: cAct.length,
          non_active_count: cNon.length,
          deactivasi_count: cDeact.length,
          active_revenue: rev,
          active_biaya: biaya,
          active_margin: margin,
          rev_sharing_count: revShareCount,
          margin_pct: marginPct,
          critical_alerts_count: criticalAlertsCount,
          is_filtered_year: isFilteredYear,
          filtered_year: filterYear,
          new_active_count: newActCount,
          carry_over_active_count: carryActCount,
          annual_cumulative_active: annualCumulativeActive || 845
        },
        sitac: {
          total_pa: curSitac.length,
          finish_count: sFinish,
          ongoing_count: sOngoing,
          hold_count: sHold,
          cancel_count: sCancel,
          total_biaya_awal: bAwal,
          total_biaya_final: bFinal,
          total_efisiensi_rupiah: bEff,
          efisiensi_pct: effPct,
          avg_sla_hari: 20.3
        },
        gangguan: {
          total_gangguan: gTotal,
          selesai_count: gSelesai,
          aktif_count: gAktif,
          resolution_rate: resRate
        },
        top_pengelola: topPengelola,
        monthly_trend: monthlyTrend,
        jenis_sewa_dist: jenisSewaDist,
        collo_status_dist: colloStatusDist,
        expiration_dist: expirationDist,
        sitac_aging_dist: { green: aGreen, yellow: aYellow, red: aRed },
        rekap_efisiensi_list: curRekapEff,
        rekap_efisiensi: curRekapEff,
        top_collo_vendors: topColloVendors
      };
      if ((!qYear || qYear === 'ALL') && !qStart && !qEnd) {
        _cachedExecSummaryAll = execSummaryResult;
      }
      return execSummaryResult;
    }

    // 2. Meta Options
    if (path === '/api/meta/options') {
      if (_cachedMetaOptions) return _cachedMetaOptions;
      const pMap = new Map();
      const jMap = new Map();
      colloList.forEach(c => {
        if (c.pengelola && c.pengelola.trim()) {
          const norm = typeof normalizePengelolaName === 'function' ? normalizePengelolaName(c.pengelola) : c.pengelola.trim();
          if (norm) {
            const key = norm.toLowerCase();
            if (!pMap.has(key)) pMap.set(key, norm);
          }
        }
        if (c.jenis_sewa && c.jenis_sewa.trim()) {
          const key = c.jenis_sewa.trim().toLowerCase();
          if (!jMap.has(key)) jMap.set(key, c.jenis_sewa.trim());
        }
      });
      const picMap = new Map();
      sitacList.forEach(s => {
        if (s.pic_perijinan && s.pic_perijinan.trim()) {
          const fn = formatPicName(s.pic_perijinan.trim());
          const key = fn.toLowerCase();
          if (!picMap.has(key)) picMap.set(key, fn);
        }
      });
      _cachedMetaOptions = {
        pengelola: Array.from(pMap.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        jenis_sewa: Array.from(jMap.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        pic: Array.from(picMap.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      };
      return _cachedMetaOptions;
    }

    // 3. Expiring 3 Months
    if (path === '/api/collo/expiring-3months') {
      const activeCollo = colloList.filter(c => c.status === 'ACTIVE');
      const items = activeCollo
        .filter(c => c.sisa_hari !== undefined && c.sisa_hari !== null && c.sisa_hari <= 90)
        .map(c => ({
          id: c.id,
          pengelola: c.pengelola,
          pelanggan: c.pelanggan,
          no_so: c.no_so,
          end_date: c.end_date,
          sisa_hari_actual: c.sisa_hari,
          alert_cat_calc: c.alert_category || (c.sisa_hari <= 0 ? 'EXPIRED' : c.sisa_hari <= 30 ? 'CRITICAL' : 'WARNING'),
          rev_sewa_tahun: c.rev_sewa_tahun,
          biaya_sewa_tahun: c.biaya_sewa_tahun
        }));
      const crit = items.filter(x => x.alert_cat_calc === 'CRITICAL').length;
      const warn = items.filter(x => x.alert_cat_calc === 'WARNING').length;
      const exp = items.filter(x => x.alert_cat_calc === 'EXPIRED').length;
      return {
        counts: { total: items.length, critical: crit, warning: warn, expired: exp },
        items
      };
    }

    // 4. Collo Rev Sharing
    if (path === '/api/collo/rev-sharing') {
      const q = (params.get('search') || '').toLowerCase();
      let revItems = colloList.filter(c => {
        const pct = Number(c.rev_sharing_pct) || (c.rev_sharing ? parseFloat(c.rev_sharing) : 0);
        return pct > 0;
      });

      revItems = revItems.map(c => {
        let pct = Number(c.rev_sharing_pct) || 0;
        if (!pct && c.rev_sharing) {
          const parsed = parseFloat(c.rev_sharing);
          pct = parsed > 1 ? parsed / 100 : parsed;
        }
        const rev = Number(c.rev_sewa_tahun) || 0;
        const fee = Number(c.biaya_rev_sharing) || Math.round(rev * pct);
        return {
          ...c,
          rev_sharing_pct: pct,
          biaya_rev_sharing: fee,
          rev_sharing_raw: c.rev_sharing_raw ? `${roundPct(c.rev_sharing_raw)}%` : `${roundPct(pct * 100)}%`
        };
      });

      if (q) {
        revItems = revItems.filter(c =>
          (c.pengelola || '').toLowerCase().includes(q) ||
          (c.pelanggan || '').toLowerCase().includes(q) ||
          (c.no_so || '').toLowerCase().includes(q) ||
          (c.sid || '').toLowerCase().includes(q)
        );
      }

      const totalLinks = revItems.length;
      const totalRev = revItems.reduce((a, b) => a + (Number(b.rev_sewa_tahun) || 0), 0);
      const totalSharing = revItems.reduce((a, b) => a + (Number(b.biaya_rev_sharing) || 0), 0);
      const avgPct = totalLinks > 0 ? (revItems.reduce((a, b) => a + (Number(b.rev_sharing_pct) || 0), 0) / totalLinks) : 0;

      const pMap = {};
      revItems.forEach(c => {
        const p = c.pengelola || 'Unknown';
        if (!pMap[p]) {
          pMap[p] = { pengelola: p, link_count: 0, total_rev: 0, total_sharing: 0, sum_pct: 0 };
        }
        pMap[p].link_count++;
        pMap[p].total_rev += Number(c.rev_sewa_tahun) || 0;
        pMap[p].total_sharing += Number(c.biaya_rev_sharing) || 0;
        pMap[p].sum_pct += Number(c.rev_sharing_pct) || 0;
      });

      const topPengelola = Object.values(pMap).map(p => ({
        pengelola: p.pengelola,
        link_count: p.link_count,
        total_rev: p.total_rev,
        total_sharing: p.total_sharing,
        avg_pct: p.link_count > 0 ? Math.round((p.sum_pct / p.link_count) * 100) : 0
      })).sort((a, b) => b.total_sharing - a.total_sharing);

      revItems.sort((a, b) => (b.biaya_rev_sharing || 0) - (a.biaya_rev_sharing || 0));

      return {
        summary: {
          total_links: totalLinks,
          total_rev: totalRev,
          total_sharing: totalSharing,
          avg_pct_display: `${Math.round(avgPct * 100)}%`
        },
        top_pengelola: topPengelola,
        data: revItems
      };
    }

    // 5. Collo Expirations
    if (path === '/api/collo/expirations') {
      const cat = (params.get('category') || 'ALL').toUpperCase();
      const statusFilter = (params.get('status') || 'ACTIVE').toUpperCase();
      const q = (params.get('search') || '').toLowerCase();

      let baseList = colloList;
      if (statusFilter !== 'ALL') {
        baseList = baseList.filter(c => (c.status || '').toUpperCase() === statusFilter);
      }

      const counts = {
        critical: baseList.filter(c => c.alert_category === 'CRITICAL').length,
        warning: baseList.filter(c => c.alert_category === 'WARNING').length,
        safe: baseList.filter(c => c.alert_category === 'SAFE').length,
        expired: baseList.filter(c => c.alert_category === 'EXPIRED').length
      };
      counts.total = baseList.length;

      // Global histogram distribution across filtered circuits
      let overdue = 0, d0_30 = 0, d31_60 = 0, d61_90 = 0, d90plus = 0;
      baseList.forEach(c => {
        const d = Number(c.sisa_hari);
        if (d < 0) overdue++;
        else if (d <= 30) d0_30++;
        else if (d <= 60) d31_60++;
        else if (d <= 90) d61_90++;
        else d90plus++;
      });
      const distribution = { overdue, d0_30, d31_60, d61_90, d90plus };

      let items = baseList;
      if (cat !== 'ALL') {
        items = items.filter(c => (c.alert_category || 'SAFE').toUpperCase() === cat);
      }
      if (q) {
        items = items.filter(c =>
          (c.pengelola || '').toLowerCase().includes(q) ||
          (c.pelanggan || '').toLowerCase().includes(q) ||
          (c.no_so || '').toLowerCase().includes(q) ||
          (c.sid || '').toLowerCase().includes(q)
        );
      }

      items.sort((a, b) => (Number(a.sisa_hari) || 0) - (Number(b.sisa_hari) || 0));

      return {
        counts,
        distribution,
        data: items
      };
    }

    // 6. Single Collo
    if (path.startsWith('/api/collo/') && !path.includes('rev-sharing') && !path.includes('expirations') && !path.includes('expiring-3months')) {
      const id = parseInt(path.split('/').pop(), 10);
      const item = colloList.find(c => c.id === id);
      return item || { error: 'Not found' };
    }

    // 7. Collo List
    if (path === '/api/collo') {
      const status = params.get('status') || 'ACTIVE';
      const jenis = params.get('jenis_sewa') || 'ALL';
      const pengelola = params.get('pengelola') || 'ALL';
      const search = (params.get('search') || '').toLowerCase();
      const sort = params.get('sort') || 'margin_desc';
      const page = parseInt(params.get('page') || '1', 10);
      const pageSize = parseInt(params.get('pageSize') || '25', 10);

      let filtered = colloList;
      if (status !== 'ALL') filtered = filtered.filter(c => c.status === status);
      if (jenis !== 'ALL') filtered = filtered.filter(c => (c.jenis_sewa || '').toLowerCase() === jenis.toLowerCase());
      if (pengelola !== 'ALL') {
        const targetNorm = (typeof normalizePengelolaName === 'function' ? normalizePengelolaName(pengelola) : pengelola).toLowerCase();
        filtered = filtered.filter(c => {
          const raw = (c.pengelola || '').toLowerCase();
          const norm = (typeof normalizePengelolaName === 'function' ? normalizePengelolaName(c.pengelola) : raw).toLowerCase();
          return raw === targetNorm || norm === targetNorm;
        });
      }
      if (search) {
        let isOrigOnly = false;
        let isTermOnly = false;
        let cleanQuery = search.trim();

        if (/\b(orig|originating)\s*:\s*/i.test(cleanQuery)) {
          isOrigOnly = true;
          cleanQuery = cleanQuery.replace(/\b(orig|originating)\s*:\s*/i, '').trim();
        } else if (/\b(term|terminating)\s*:\s*/i.test(cleanQuery)) {
          isTermOnly = true;
          cleanQuery = cleanQuery.replace(/\b(term|terminating)\s*:\s*/i, '').trim();
        } else if (/^(originating|orig)\s+/i.test(cleanQuery)) {
          isOrigOnly = true;
          cleanQuery = cleanQuery.replace(/^(originating|orig)\s+/i, '').trim();
        } else if (/^(terminating|term)\s+/i.test(cleanQuery)) {
          isTermOnly = true;
          cleanQuery = cleanQuery.replace(/^(terminating|term)\s+/i, '').trim();
        } else if (/^(originating|orig)$/i.test(cleanQuery)) {
          isOrigOnly = true;
          cleanQuery = '';
        } else if (/^(terminating|term)$/i.test(cleanQuery)) {
          isTermOnly = true;
          cleanQuery = '';
        }

        const terms = cleanQuery.toLowerCase().split(/\s+/).filter(Boolean);

        filtered = filtered.filter(c => {
          if (isOrigOnly) {
            const origStr = (c.originating || '').toLowerCase();
            if (terms.length === 0) return origStr.length > 0;
            return terms.every(t => origStr.includes(t));
          }
          if (isTermOnly) {
            const termStr = (c.terminating || '').toLowerCase();
            if (terms.length === 0) return termStr.length > 0;
            return terms.every(t => termStr.includes(t));
          }
          const combo = [
            c.pelanggan || '',
            c.pengelola || '',
            c.no_so || '',
            c.sid || '',
            c.site || '',
            c.originating || '',
            c.terminating || '',
            c.alamat_pengelola || '',
            c.keterangan || ''
          ].join(' ').toLowerCase();

          return terms.every(t => combo.includes(t));
        });
      }

      if (sort === 'margin_desc') filtered.sort((a, b) => (b.margin_rupiah || 0) - (a.margin_rupiah || 0));
      else if (sort === 'margin_asc') filtered.sort((a, b) => (a.margin_rupiah || 0) - (b.margin_rupiah || 0));
      else if (sort === 'biaya_desc') filtered.sort((a, b) => (b.biaya_sewa_tahun || 0) - (a.biaya_sewa_tahun || 0));
      else if (sort === 'rev_desc') filtered.sort((a, b) => (b.rev_sewa_tahun || 0) - (a.rev_sewa_tahun || 0));

      const total = filtered.length;
      const totalPages = Math.ceil(total / pageSize) || 1;
      const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

      const rev = filtered.reduce((a, b) => a + (Number(b.rev_sewa_tahun) || 0), 0);
      const biaya = filtered.reduce((a, b) => a + (Number(b.biaya_sewa_tahun) || 0), 0);
      const biayaOtc = filtered.reduce((a, b) => a + (Number(b.biaya_otc) || 0), 0);
      const biayaDeposit = filtered.reduce((a, b) => a + (Number(b.biaya_deposit) || 0), 0);
      const margin = filtered.reduce((a, b) => a + (Number(b.margin_rupiah) || 0), 0);

      return {
        data: paginated,
        total,
        page,
        pageSize,
        totalPages,
        totals: { revenue: rev, biaya, biaya_otc: biayaOtc, biaya_deposit: biayaDeposit, margin }
      };
    }

    // 8. Single SITAC
    if (path.startsWith('/api/sitac/') && path !== '/api/sitac') {
      const id = parseInt(path.split('/').pop(), 10);
      const item = sitacList.find(s => s.id === id);
      return item || { error: 'Not found' };
    }

    // 9. SITAC List
    if (path === '/api/sitac') {
      const authUser = (typeof state !== 'undefined' && state.currentUser) || JSON.parse(localStorage.getItem('telecom_portal_user') || 'null');
      const isPicLapangan = authUser && authUser.role === 'lapangan';

      const status = params.get('status') || 'ALL';
      const pic = params.get('pic') || 'ALL';
      const year = params.get('year') || 'ALL';
      const aging = params.get('aging') || 'ALL';
      const region = (params.get('region') || 'ALL').toUpperCase();
      const search = (params.get('search') || '').toLowerCase();
      const page = parseInt(params.get('page') || '1', 10);
      const pageSize = parseInt(params.get('pageSize') || '25', 10);
      const startDate = params.get('startDate') || params.get('start_date') || '';
      const endDate = params.get('endDate') || params.get('end_date') || '';
      const dateField = params.get('dateField') || params.get('date_field') || 'date_dispos';
      const datePreset = params.get('datePreset') || params.get('preset') || 'ALL';
      const activePresets = String(datePreset).split(',').map(p => p.trim()).filter(Boolean);

      const allowAllTeam = params.get('all_team') === '1' || params.get('scope') === 'all';
      let scopedSitac = sitacList;
      if (isPicLapangan && !allowAllTeam) {
        scopedSitac = scopedSitac.filter(s => isUserAssignedToTask(s, authUser));
      }

      const getPresetDateRange = (preset) => {
        const today = new Date();
        const curYear = today.getFullYear();
        const curMonth = today.getMonth();
        if (preset === 'THIS_MONTH') {
          const firstDay = new Date(curYear, curMonth, 1);
          const lastDay = new Date(curYear, curMonth + 1, 0);
          return { start: firstDay.toISOString().slice(0, 10), end: lastDay.toISOString().slice(0, 10) };
        } else if (preset === 'LAST_MONTH') {
          const firstDay = new Date(curYear, curMonth - 1, 1);
          const lastDay = new Date(curYear, curMonth, 0);
          return { start: firstDay.toISOString().slice(0, 10), end: lastDay.toISOString().slice(0, 10) };
        } else if (['2024', '2025', '2026'].includes(preset)) {
          return { start: `${preset}-01-01`, end: `${preset}-12-31`, year: parseInt(preset, 10) };
        }
        return null;
      };

      // Filter by Date Presets (supports multi-selection) or Custom Range
      if (activePresets.length > 0 && !activePresets.includes('ALL')) {
        scopedSitac = scopedSitac.filter(s => {
          const raw = s[dateField] || s.date_dispos || s.date_close || '';
          const dStr = String(raw).trim().substring(0, 10);
          const sYear = Number(s.tahun) || (dStr && dStr.length >= 4 ? parseInt(dStr.substring(0, 4), 10) : 0);

          return activePresets.some(preset => {
            const range = getPresetDateRange(preset);
            if (!range) return false;
            if (range.year && sYear === range.year) return true;
            if (dStr && range.start && range.end) {
              return dStr >= range.start && dStr <= range.end;
            }
            return false;
          });
        });
      } else if (startDate || endDate) {
        scopedSitac = scopedSitac.filter(s => {
          const raw = s[dateField] || s.date_dispos || '';
          const dStr = String(raw).trim().substring(0, 10);
          if (!dStr) return false;
          if (startDate && dStr < startDate) return false;
          if (endDate && dStr > endDate) return false;
          return true;
        });
      }

      // Calculate region_stats over scopedSitac (respecting other filters)
      const regionStats = {
        ALL: { count: 0, berbiaya: 0, zerocost: 0, biaya_awal: 0, biaya_final: 0, efisiensi_rupiah: 0, efisiensi_persen: 0 },
        JAKPUSEL: { count: 0, berbiaya: 0, zerocost: 0, biaya_awal: 0, biaya_final: 0, efisiensi_rupiah: 0, efisiensi_persen: 0 },
        JAKUTIM: { count: 0, berbiaya: 0, zerocost: 0, biaya_awal: 0, biaya_final: 0, efisiensi_rupiah: 0, efisiensi_persen: 0 },
        BODEBEK: { count: 0, berbiaya: 0, zerocost: 0, biaya_awal: 0, biaya_final: 0, efisiensi_rupiah: 0, efisiensi_persen: 0 },
        JAKBAR: { count: 0, berbiaya: 0, zerocost: 0, biaya_awal: 0, biaya_final: 0, efisiensi_rupiah: 0, efisiensi_persen: 0 },
        BANTEN: { count: 0, berbiaya: 0, zerocost: 0, biaya_awal: 0, biaya_final: 0, efisiensi_rupiah: 0, efisiensi_persen: 0 },
        TANGERANG: { count: 0, berbiaya: 0, zerocost: 0, biaya_awal: 0, biaya_final: 0, efisiensi_rupiah: 0, efisiensi_persen: 0 }
      };

      scopedSitac.forEach(s => {
        const reg = typeof classifySitacRegion === 'function' ? classifySitacRegion(s) : 'LAINNYA';
        const bAwal = Number(s.biaya_permintaan_awal) || 0;
        const bFin = Number(s.biaya_final) || 0;
        const bEff = Number(s.efisiensi_rupiah) || 0;
        const isCost = bAwal > 0 || bFin > 0 || s.is_berbiaya == 1;

        regionStats.ALL.count++;
        if (isCost) regionStats.ALL.berbiaya++; else regionStats.ALL.zerocost++;
        regionStats.ALL.biaya_awal += bAwal;
        regionStats.ALL.biaya_final += bFin;
        regionStats.ALL.efisiensi_rupiah += bEff;

        if (regionStats[reg]) {
          regionStats[reg].count++;
          if (isCost) regionStats[reg].berbiaya++; else regionStats[reg].zerocost++;
          regionStats[reg].biaya_awal += bAwal;
          regionStats[reg].biaya_final += bFin;
          regionStats[reg].efisiensi_rupiah += bEff;
        }
      });

      Object.keys(regionStats).forEach(k => {
        const aw = regionStats[k].biaya_awal;
        const fin = regionStats[k].biaya_final;
        const ef = Math.max(0, aw - fin);
        regionStats[k].efisiensi_rupiah = ef;
        regionStats[k].efisiensi_persen = aw > 0 ? Number((ef / aw * 100).toFixed(2)) : 0;
      });

      let preStatusFiltered = scopedSitac;
      if (region && region !== 'ALL') {
        const selectedRegions = String(region).split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
        if (selectedRegions.length > 0 && !selectedRegions.includes('ALL')) {
          preStatusFiltered = preStatusFiltered.filter(s => {
            const rCode = (typeof classifySitacRegion === 'function' ? classifySitacRegion(s) : 'LAINNYA');
            return selectedRegions.includes(rCode);
          });
        }
      }
      if (pic !== 'ALL' && (!isPicLapangan || allowAllTeam)) {
        const pLower = pic.toLowerCase();
        preStatusFiltered = preStatusFiltered.filter(s => {
          const sPic = formatPicName(s.pic_perijinan || '').toLowerCase();
          return sPic === pLower || (s.pic_perijinan && s.pic_perijinan.toLowerCase() === pLower);
        });
      }
      if (year !== 'ALL') preStatusFiltered = preStatusFiltered.filter(s => String(s.tahun) === String(year));
      if (aging !== 'ALL') {
        if (aging === 'green') preStatusFiltered = preStatusFiltered.filter(s => s.durasi_hari <= 7);
        else if (aging === 'yellow') preStatusFiltered = preStatusFiltered.filter(s => s.durasi_hari > 7 && s.durasi_hari <= 14);
        else if (aging === 'red') preStatusFiltered = preStatusFiltered.filter(s => s.durasi_hari > 14);
      }
      if (search) {
        preStatusFiltered = preStatusFiltered.filter(s =>
          (s.no_pa || '').toLowerCase().includes(search) ||
          (s.pelanggan || '').toLowerCase().includes(search) ||
          (s.terminating || '').toLowerCase().includes(search) ||
          (s.pic_perijinan || '').toLowerCase().includes(search)
        );
      }

      const counts = { ALL: preStatusFiltered.length, Finish: 0, Ongoing: 0, Hold: 0, Cancel: 0 };
      preStatusFiltered.forEach(s => { if (counts[s.progress] !== undefined) counts[s.progress]++; });

      let filtered = preStatusFiltered;
      if (status !== 'ALL') filtered = filtered.filter(s => s.progress === status);

      // Urutkan data berdasarkan tanggal terbaru (descending)
      const parseSitacDate = (item) => {
        let raw = '';
        if (dateField === 'date_close') {
          raw = item.date_close || item.date_dispos || item.date_pa || item.created_at || '';
        } else {
          raw = item.date_dispos || item.date_close || item.date_pa || item.created_at || '';
        }
        const s = String(raw).trim();
        if (s && s.length >= 10) {
          const t = Date.parse(s.substring(0, 10));
          if (!isNaN(t)) return t;
        }
        return 0;
      };

      filtered = [...filtered].sort((a, b) => {
        const timeA = parseSitacDate(a);
        const timeB = parseSitacDate(b);
        if (timeB !== timeA) return timeB - timeA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });

      const total = filtered.length;
      const totalPages = Math.ceil(total / pageSize) || 1;
      const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

      let green = 0, yellow = 0, red = 0;
      filtered.forEach(s => {
        if (s.durasi_hari <= 7) green++;
        else if (s.durasi_hari <= 14) yellow++;
        else red++;
      });

      return {
        data: paginated,
        total,
        page,
        pageSize,
        totalPages,
        status_counts: counts,
        aging_dist: { green, yellow, red },
        region_stats: regionStats,
        selected_region: region
      };
    }

    // 10. Single Gangguan
    if (path.startsWith('/api/gangguan/') && path !== '/api/gangguan') {
      const id = parseInt(path.split('/').pop(), 10);
      const item = gangguanList.find(g => g.id === id);
      return item || { error: 'Not found' };
    }

    // 11. Gangguan List
    if (path === '/api/gangguan') {
      const authUser = (typeof state !== 'undefined' && state.currentUser) || JSON.parse(localStorage.getItem('telecom_portal_user') || 'null');
      const isPicLapangan = authUser && authUser.role === 'lapangan';

      const status = params.get('status') || 'ALL';
      const search = (params.get('search') || '').toLowerCase();

      let scopedGangguan = gangguanList;
      if (isPicLapangan) {
        scopedGangguan = scopedGangguan.filter(g => isUserAssignedToTask(g, authUser));
      }

      let filtered = scopedGangguan;
      if (status === 'Aktif' || status === '0') filtered = filtered.filter(g => !g.is_selesai && g.status !== 'Selesai');
      else if (status === 'Selesai' || status === '1') filtered = filtered.filter(g => g.is_selesai || g.status === 'Selesai');
      if (search) {
        filtered = filtered.filter(g =>
          (g.no_tiket || '').toLowerCase().includes(search) ||
          (g.terminating || '').toLowerCase().includes(search) ||
          (g.pic_perijinan || '').toLowerCase().includes(search) ||
          (g.jenis_gangguan || '').toLowerCase().includes(search)
        );
      }

      const totalBiaya = filtered.reduce((a, b) => a + (Number(b.biaya_gangguan) || 0), 0);
      const totalAktif = scopedGangguan.filter(g => !g.is_selesai && g.status !== 'Selesai').length;
      const totalSelesai = scopedGangguan.filter(g => g.is_selesai || g.status === 'Selesai').length;

      return {
        data: filtered,
        total: filtered.length,
        status_counts: { ALL: scopedGangguan.length, Aktif: totalAktif, Selesai: totalSelesai },
        counts: { all: scopedGangguan.length, open: totalAktif, selesai: totalSelesai },
        total_biaya: totalBiaya,
        avg_sla: 14.5
      };
    }

    // 12. Rekap Efisiensi
    if (path === '/api/rekap-efisiensi') {
      const regionsDef = [
        { code: 'JAKPUSEL', name: 'JAKPUSEL', desc: 'Jakarta Pusat dan Jakarta Selatan' },
        { code: 'JAKUTIM', name: 'JAKUTIM', desc: 'Jakarta Utara dan Jakarta Timur' },
        { code: 'BODEBEK', name: 'BODEBEK', desc: 'Bogor, Depok, dan Bekasi' },
        { code: 'JAKBAR', name: 'Jakbar', desc: 'Jakarta Barat' },
        { code: 'BANTEN', name: 'Banten', desc: 'Banten (Serang, Cilegon, Pandeglang, Lebak)' },
        { code: 'TANGERANG', name: 'Tangerang', desc: 'Tangerang (Kota Tangerang, Tangsel, Kab Tangerang)' }
      ];
      const regionalEff = regionsDef.map(reg => {
        const rows = sitacList.filter(s => (typeof classifySitacRegion === 'function' ? classifySitacRegion(s) : '') === reg.code);
        const tot = rows.length;
        const ada = rows.filter(s => (Number(s.biaya_permintaan_awal) > 0 || Number(s.biaya_final) > 0 || s.is_berbiaya == 1)).length;
        const tidak = tot - ada;
        const nAwal = rows.reduce((acc, s) => acc + (Number(s.biaya_permintaan_awal) || 0), 0);
        const nAkhir = rows.reduce((acc, s) => acc + (Number(s.biaya_final) || 0), 0);
        const nEff = Math.max(0, nAwal - nAkhir);
        const pct = nAwal > 0 ? Number((nEff / nAwal * 100).toFixed(2)) : 0;
        return {
          region_code: reg.code,
          region_name: reg.name,
          description: reg.desc,
          total_pa: tot,
          ada_biaya: ada,
          tidak_ada_biaya: tidak,
          nilai_awal: nAwal,
          nilai_akhir: nAkhir,
          efisiensi_rupiah: nEff,
          efisiensi_persen: pct
        };
      });
      return {
        yearly: rekapEff,
        regional: regionalEff
      };
    }

    // 13. PIC Performance
    if (path === '/api/pic-performance') {
      if (workload && Array.isArray(workload) && workload.length > 0) {
        return workload;
      }
      return computePicPerformanceFromData(sitacList, gangguanList);
    }

    // 14. Registered PICs
    if (path === '/api/auth/registered-pics') {
      const pics = [
        { id: 1, username: 'harlan', full_name: 'Harlan Zaelani', role: 'lapangan', pic_code: 'Harlan', badge_color: 'emerald' },
        { id: 2, username: 'budi', full_name: 'Budi Rodiyah', role: 'lapangan', pic_code: 'Budi', badge_color: 'cyan' },
        { id: 3, username: 'edi', full_name: 'Edi Swargaloka', role: 'lapangan', pic_code: 'Edi', badge_color: 'amber' },
        { id: 4, username: 'abusopian', full_name: 'M. Abusopian', role: 'lapangan', pic_code: 'Abusopian', badge_color: 'indigo' },
        { id: 5, username: 'muhidin', full_name: 'Muhidin', role: 'lapangan', pic_code: 'Muhidin', badge_color: 'teal' },
        { id: 6, username: 'brian', full_name: 'Brian Ariyanto', role: 'lapangan', pic_code: 'Brian', badge_color: 'purple' },
        { id: 7, username: 'zulhadi', full_name: 'Zulhadi Syahril', role: 'lapangan', pic_code: 'Zulhadi', badge_color: 'blue' }
      ];
      return { pics };
    }

    // 15. Map Coordinates
    if (path === '/api/map-coordinates') {
      const status = params.get('status') || 'ALL';
      let filtered = sitacList.filter(s => {
        if (!s.latitude || !s.longitude) return false;
        const ct = (s.coord_type || '').toUpperCase();
        return ct === 'EXACT' || ct === 'EXACT_COORDS' || ct === 'USER_INPUT';
      });
      if (status !== 'ALL') filtered = filtered.filter(s => s.progress === status);
      return filtered.map(s => ({
        id: s.id,
        no_pa: s.no_pa,
        pelanggan: s.pelanggan,
        terminating: s.terminating,
        latitude: s.latitude,
        longitude: s.longitude,
        progress: s.progress,
        durasi_hari: s.durasi_hari,
        biaya_final: s.biaya_final,
        pic_perijinan: s.pic_perijinan,
        coord_type: s.coord_type
      }));
    }

    // 16. Database Overview
    if (path === '/api/database/overview') {
      return {
        status: 'healthy',
        total_collo: colloList.length,
        total_sitac: sitacList.length,
        total_gangguan: gangguanList.length,
        sqlite_connected: true
      };
    }

    return { success: true, message: 'OK' };
  }

  // Transparent fetch interceptor for /api/* endpoints
  const _nativeFetch = window.fetch.bind(window);
  window.fetch = async function (resource, init) {
    const url = typeof resource === 'string' ? resource : (resource?.url || '');
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const isLocalServer = window.location.port === '8888' || window.location.port === '8000';
      if (isLocalServer) {
        try {
          const res = await _nativeFetch(resource, init);
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            return res;
          }
        } catch (e) {
          // Local Python server offline: fall through to static data adapter
        }
      }

      // Serve from embedded master dataset
      try {
        const mockResult = handleStaticApiRequest(url, init);
        return new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('Static router error for', url, err);
      }
    }
    return _nativeFetch(resource, init);
  };

  // --- VIEW PERSISTENCE HELPER (PRESERVE TAB ON REFRESH) ---
  const VALID_VIEWS = [
    'view-executive',
    'view-collo-list',
    'view-collo-rev-sharing',
    'view-collo-alerts',
    'view-sitac-pa',
    'view-sitac-colleagues',
    'view-efisiensi',
    'view-pic-matrix',
    'view-webgis'
  ];

  const VIEW_SLUGS = {
    'view-executive': 'dashboard',
    'view-collo-list': 'collo',
    'view-collo-rev-sharing': 'revshare',
    'view-collo-alerts': 'alerts',
    'view-sitac-pa': 'sitac',
    'view-sitac-colleagues': 'tim-sitac',
    'view-efisiensi': 'efisiensi',
    'view-pic-matrix': 'pic',
    'view-webgis': 'gis'
  };

  const SLUG_TO_VIEW = {
    'dashboard': 'view-executive',
    'executive': 'view-executive',
    'ringkasan': 'view-executive',
    'collo': 'view-collo-list',
    'colocation': 'view-collo-list',
    'revshare': 'view-collo-rev-sharing',
    'revenue-sharing': 'view-collo-rev-sharing',
    'alerts': 'view-collo-alerts',
    'alert': 'view-collo-alerts',
    'sitac': 'view-sitac-pa',
    'perizinan': 'view-sitac-pa',
    'pa': 'view-sitac-pa',
    'tim-sitac': 'view-sitac-colleagues',
    'colleagues': 'view-sitac-colleagues',
    'efisiensi': 'view-efisiensi',
    'pic': 'view-pic-matrix',
    'beban-kerja': 'view-pic-matrix',
    'pic-matrix': 'view-pic-matrix',
    'gis': 'view-webgis',
    'webgis': 'view-webgis',
    'peta': 'view-webgis'
  };

  function resolveViewIdFromHash(rawHash) {
    const clean = (rawHash || '').replace(/^#/, '').trim().toLowerCase();
    if (!clean) return null;
    if (VALID_VIEWS.includes(clean)) return clean;
    if (SLUG_TO_VIEW[clean]) return SLUG_TO_VIEW[clean];
    return null;
  }

  function getViewSlug(viewId) {
    return VIEW_SLUGS[viewId] || viewId.replace(/^view-/, '');
  }

  function getSavedActiveView() {
    try {
      const fromHash = resolveViewIdFromHash(window.location.hash);
      if (fromHash) return fromHash;

      const saved = localStorage.getItem('telecom_portal_active_view');
      const fromSaved = resolveViewIdFromHash(saved);
      if (fromSaved) return fromSaved;
    } catch (e) {}
    return 'view-executive';
  }

  // --- GLOBAL STATE ---
  const state = {
    activeView: getSavedActiveView(),
    theme: localStorage.getItem('portal_theme') || 'dark',
    currentUser: JSON.parse(localStorage.getItem('telecom_portal_user') || 'null'),
    token: localStorage.getItem('telecom_portal_token') || null,
    activeTechnician: localStorage.getItem('telecom_active_technician') || 'Harlan',
    myTasksOnlyGangguan: false,
    myTasksOnlySitac: false,

    // View 2: Colocation Links (Default: ACTIVE ONLY)
    collo: {
      status: 'ACTIVE',
      jenisSewa: 'ALL',
      pengelola: 'ALL',
      search: '',
      sort: 'margin_desc',
      page: 1,
      pageSize: 25,
      data: [],
      totals: {}
    },

    // View 3: Revenue Sharing
    revSharing: {
      search: '',
      data: []
    },

    // View 4: Expiration Alerts
    alerts: {
      category: 'CRITICAL',
      status: 'ACTIVE',
      search: '',
      data: []
    },

    // View 5: SITAC Projects
    sitac: {
      status: 'ALL',
      pic: 'ALL',
      year: 'ALL',
      aging: 'ALL',
      region: 'ALL',
      search: '',
      startDate: '',
      endDate: '',
      dateField: 'date_dispos',
      datePreset: 'ALL',
      page: 1,
      pageSize: 25,
      data: []
    },

    // View 5.5: Monitoring Tim SITAC (Read-Only)
    colleagues: {
      status: 'ALL',
      pic: 'ALL',
      year: 'ALL',
      aging: 'ALL',
      region: 'ALL',
      search: '',
      startDate: '',
      endDate: '',
      dateField: 'date_dispos',
      datePreset: 'ALL',
      page: 1,
      pageSize: 25,
      data: []
    },

    // View 6: Emergency Trouble Tickets
    gangguan: {
      status: 'ALL',
      search: '',
      dateType: 'dispos',
      exactDate: '',
      startDate: '',
      endDate: '',
      quickPeriod: 'all',
      data: []
    },

    // Meta options
    meta: {
      pengelola: [],
      pic: [],
      jenisSewa: []
    },

    // View 7 & 8 cached dataset for exports & charts
    efisiensi: [],
    picMatrix: []
  };

  // Chart & Map instances registry
  const charts = {};
  let leafletMap = null;
  let mapMarkersLayer = null;
  let mapCircuitsLayer = null;
  let isSitacLayerVisible = true;
  let isCircuitLayerVisible = true;
  let currentCircuitFilter = 'ALL';
  let mapBaseLayers = {};
  let currentBaseLayer = 'googleRoadmap';
  let mapResizeObserver = null;
  let lastMapBounds = null;

  const destroyChart = (key) => {
    if (charts[key]) {
      try { charts[key].destroy(); } catch (e) {}
      charts[key] = null;
    }
  };

  // ── CORPORATE ENTERPRISE CHART THEME (PLN ICON PLUS) ────────────────────────
  // Professional corporate palette aligned with enterprise operations
  const CHART_PALETTE = {
    cyan:    '#0284C7', // PLN Corporate Blue
    purple:  '#6366F1', // Indigo / Enterprise Accent
    amber:   '#F59E0B', // Corporate Amber / Gold
    rose:    '#EF4444', // Clean Enterprise Red
    emerald: '#10B981', // Clean Emerald Green
    orange:  '#F97316', // Corporate Orange
    green:   '#059669', // Deep Forest Green
    slate:   '#64748B', // Neutral Slate Gray
    pink:    '#EC4899', // Professional Rose
    sky:     '#38BDF8', // Sky Blue Accent
  };
  const PALETTE_ORDER = ['cyan', 'purple', 'amber', 'rose', 'emerald', 'orange', 'green', 'slate', 'pink', 'sky'];
  const getPaletteColors = (n) => PALETTE_ORDER.slice(0, n).map(k => CHART_PALETTE[k]);

  // Build a canvas gradient for line/area charts
  const makeGradient = (ctx, colorHex, alphaTop = 0.28, alphaBot = 0.02) => {
    const h = ctx.canvas.offsetHeight || 220;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const hex = colorHex.replace('#','');
    const r = parseInt(hex.substr(0,2),16);
    const gr = parseInt(hex.substr(2,2),16);
    const b = parseInt(hex.substr(4,2),16);
    g.addColorStop(0, `rgba(${r},${gr},${b},${alphaTop})`);
    g.addColorStop(1, `rgba(${r},${gr},${b},${alphaBot})`);
    return g;
  };

  const getChartTheme = () => {
    const isDark = state.theme === 'dark';
    const textColor      = isDark ? '#94a3b8' : '#475569';
    const titleColor     = isDark ? '#f8fafc' : '#0f172a';
    const gridColor      = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    const tooltipBg      = isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)';
    const tooltipBorder  = isDark ? 'rgba(2, 132, 199, 0.35)' : 'rgba(2, 132, 199, 0.25)';
    const tooltipText    = isDark ? '#f8fafc' : '#0f172a';
    const donutBorder    = isDark ? 'transparent' : '#ffffff';
    const donutBorderWidth = isDark ? 0 : 2;

    // Global Chart.js defaults — set once per theme switch
    Chart.defaults.font.family = "'DM Sans', sans-serif";
    Chart.defaults.font.size   = 11;
    Chart.defaults.color       = textColor;
    Chart.defaults.borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    // Scale border & grid defaults — eliminates harsh black axis lines in light mode
    if (Chart.defaults.scale) {
      if (Chart.defaults.scale.border) {
        Chart.defaults.scale.border.display = false;
        Chart.defaults.scale.border.color   = 'transparent';
      }
      if (Chart.defaults.scale.grid) {
        Chart.defaults.scale.grid.color      = gridColor;
        Chart.defaults.scale.grid.drawBorder = false;
      }
    }

    // Elements defaults
    if (Chart.defaults.elements?.arc) {
      Chart.defaults.elements.arc.borderColor = donutBorder;
      Chart.defaults.elements.arc.borderWidth = donutBorderWidth;
    }

    Chart.defaults.plugins.tooltip.backgroundColor   = tooltipBg;
    Chart.defaults.plugins.tooltip.borderColor       = tooltipBorder;
    Chart.defaults.plugins.tooltip.borderWidth       = 1;
    Chart.defaults.plugins.tooltip.titleColor        = titleColor;
    Chart.defaults.plugins.tooltip.bodyColor         = tooltipText;
    Chart.defaults.plugins.tooltip.padding           = 10;
    Chart.defaults.plugins.tooltip.cornerRadius      = 10;
    Chart.defaults.plugins.tooltip.titleFont         = { family: "'Outfit', sans-serif", weight: '700', size: 12 };
    Chart.defaults.plugins.tooltip.bodyFont          = { family: "'Inter', sans-serif", size: 11 };
    Chart.defaults.plugins.tooltip.displayColors     = true;
    Chart.defaults.plugins.tooltip.boxPadding        = 4;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle    = 'circle';
    Chart.defaults.plugins.legend.labels.padding       = 16;
    Chart.defaults.plugins.legend.labels.font          = { family: "'Inter', sans-serif", size: 11 };
    Chart.defaults.animation.duration                 = 600;
    Chart.defaults.animation.easing                   = 'easeInOutQuart';

    return {
      isDark, textColor, titleColor, gridColor,
      tooltipBg, tooltipBorder, tooltipText, donutBorder, donutBorderWidth,
      palette: CHART_PALETTE,
      getPaletteColors,
      makeGradient,
    };
  };

  // --- FORMATTING UTILS ---
  function normalizePengelolaName(name) {
    if (!name) return '';
    const s = String(name).trim();
    const u = s.toUpperCase();

    // 1. Biznet Data Center (All variations from user screenshot)
    if (u.includes('BIZNE') || u.includes('BIZNET')) {
      if (u.includes('SUPRA PRIMATAMA') || u.includes('BIZNET NETWORKS')) return 'Supra Primatama Nusantara (Biznet Networks)';
      return 'Biznet Data Center';
    }
    if (u.includes('SIGMA CIPTA')) return 'Sigma Cipta Caraka';
    if (u.includes('TELKOM DATA EKOSISTEM')) return 'Telkom Data Ekosistem';
    if ((u.includes('TELKOM INDONESIA') || u.includes('TELEKOMUNIKASI INDONESIA')) && !['MEGA', 'PC 24', 'PC24', 'GRAHA', 'MORA'].some(x => u.includes(x))) return 'Telkom Indonesia';
    if (u.includes('TEKNOVATUS') || u.includes('TEKTOVANUS')) return 'Teknovatus Solusi Sejahtera';
    if (u.includes('LOKA MAMPANG') || u.includes('LOKA AMAPANG')) return 'Loka Mampang Indah Realty';
    if (u.includes('KARUNIA MEGA')) return 'Karunia Megah Perkasa';
    if ((u.includes('JEKAEL') || u.includes('JAKAEL')) && !u.includes('BINAJASA')) return 'Jekael Invesco';
    if (u.includes('P3SR') && u.includes('CITY TOWER')) return 'P3SRS The City Tower';
    if (u.includes('MULTIVISION TOWER')) return 'P3SRS Multivision Tower';
    if (u.includes('MENARA KARYA')) return 'Perhimpunan Penghuni Menara Karya';
    if (u.includes('METROPOLITAN KENCANA') || u.includes('METROPOLITAN KENTJANA')) return 'Metropolitan Kencana';
    if (u.includes('PATRA JASA')) {
      if (u.includes('OFFICE TOWER')) return 'Patra Jasa Office Tower';
      return 'Patra Jasa';
    }
    if (u.includes('PLAZA ADIKA') || u.includes('PLAZA ANDIKA')) return 'Plaza Adika Lestari';
    if (u.includes('PERWITA') || u.includes('PERWIRA MARGASAKTI')) return 'Perwita Margasakti';
    if (u.includes('PHINISINDO') || u.includes('PHISINDO')) return 'Phinisindo Zamrud Nusantara';
    if (u.includes('PRAJA PURI')) return 'Praja Puri Indah Real Estate';
    if (u.includes('PRIMA WIRA')) return 'Prima Wira Utama';
    if (u.includes('PRINCETON DIGITAL')) return 'Princeton Digital Group';
    if (u.includes('SAMPOERNA LAND')) return 'Sampoerna Land';
    if (u.includes('SENAYAN TRIKARYA') || u.includes('SENAYAN TIRTAKARYA')) return 'Senayan Trikarya Sempana';
    if (u.includes('SUKSES KELOLA') || u.includes('SUKSES KELOLE')) return 'Sukses Kelola Persada';
    if (u.includes('SUPRA PRIMATAMA') || u.includes('SUPRA PRITAMA')) return 'Supra Primatama Nusantara (Biznet Networks)';
    if (u.includes('ZOTA INDONESIA')) return 'Zota Indonesia';
    if (u.includes('KRAKATAU INFORMATION')) return 'Krakatau Information Technology';
    if (u.includes('KRAKATAU INDUSTRIAL') || u.includes('KRAKATAU SARANA')) return 'Krakatau Sarana Properti';
    if (u.includes('PELINDO') || u.includes('PELABUHAN INDONESIA')) return 'Pelabuhan Indonesia (Pelindo)';
    if (u.includes('PC 24') || u.includes('PC24')) return 'PC 24 Telekomunikasi Indonesia';
    if (u.includes('NETTOCYBER')) return 'Nettocyber Indonesia';
    if (u.includes('MENARA THAMRIN')) return 'Menara Thamrin';
    if (u.includes('MEGA TELEKOMUNIKASI')) return 'Mega Telekomunikasi Indonesia';
    if (u.includes('MEGA AKSES PERSADA')) return 'Mega Akses Persada';
    if (u.includes('MARMITRIA')) return 'Marmitria Land';
    if (u.includes('KARYAGRAHA')) return 'Karyagraha Nusantara';
    if (u.includes('BUMI SERPONG DAMAI')) return 'Bumi Serpong Damai (BSD)';
    if (u.includes('DCI INDONESIA') || u.includes('DCI  INDONESIA')) return 'DCI Indonesia';
    if (u.includes('DWI TUNGGAL')) return 'Dwi Tunggal Putra';
    if (u.includes('KAI COMMUTER')) return 'KAI Commuter Jabodetabek';
    if (u.includes('KERETA API INDONESIA')) return 'Kereta Api Indonesia (KAI)';
    if (u.includes('LINK NET') || u.includes('LINKNET')) return 'Link Net';
    if (u.includes('MNC KABEL')) return 'MNC Kabel Mediacom';
    if (u.includes('MULTI KONTROL') || u.includes('MULTIKONTROL')) return 'Multi Kontrol Nusantara';
    if (u.includes('NETCITI')) return 'Netciti Persada';
    if (u.includes('NTT INDONESIA')) return 'NTT Indonesia';
    if (u.includes('SMARTFREN')) return 'Smartfren Telecom';
    if (u.includes('XL AXIATA')) return 'XL Axiata';

    let clean = s;
    clean = clean.replace(/^(?:PT\.?|CV\.?)\s+/i, '');
    clean = clean.replace(/[, ]+(?:PT\.?|CV\.?)$/i, '');
    clean = clean.replace(/\s*\((?:Persero)\)/i, '');
    clean = clean.replace(/\s+Tbk\.?/i, '');
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
  }
  window.normalizePengelolaName = normalizePengelolaName;

  function classifySitacRegion(row) {
    if (!row) return 'LAINNYA';

    // Authoritative geographical validation mapping for SITAC records
    const SITAC_SPECIFIC_ID_MAP = {
      // JAKPUSEL (24)
      59: 'JAKPUSEL', 70: 'JAKPUSEL', 455: 'JAKPUSEL',
      170: 'JAKPUSEL', 172: 'JAKPUSEL', 250: 'JAKPUSEL', 263: 'JAKPUSEL', 270: 'JAKPUSEL',
      279: 'JAKPUSEL', 310: 'JAKPUSEL', 352: 'JAKPUSEL', 367: 'JAKPUSEL', 378: 'JAKPUSEL',
      379: 'JAKPUSEL', 427: 'JAKPUSEL', 438: 'JAKPUSEL', 572: 'JAKPUSEL', 573: 'JAKPUSEL',
      577: 'JAKPUSEL', 597: 'JAKPUSEL', 609: 'JAKPUSEL', 639: 'JAKPUSEL', 641: 'JAKPUSEL',
      680: 'JAKPUSEL',

      // JAKUTIM (10)
      36: 'JAKUTIM', 119: 'JAKUTIM', 218: 'JAKUTIM', 300: 'JAKUTIM', 307: 'JAKUTIM',
      468: 'JAKUTIM', 499: 'JAKUTIM', 511: 'JAKUTIM', 574: 'JAKUTIM', 645: 'JAKUTIM',

      // BODEBEK (6)
      388: 'BODEBEK', 491: 'BODEBEK', 492: 'BODEBEK', 540: 'BODEBEK', 627: 'BODEBEK', 650: 'BODEBEK',

      // JAKBAR (2)
      472: 'JAKBAR', 478: 'JAKBAR',

      // BANTEN (3)
      397: 'BANTEN', 581: 'BANTEN', 628: 'BANTEN',

      // TANGERANG (15)
      331: 'TANGERANG', 432: 'TANGERANG',
      228: 'TANGERANG', 290: 'TANGERANG', 294: 'TANGERANG', 295: 'TANGERANG', 354: 'TANGERANG',
      359: 'TANGERANG', 431: 'TANGERANG', 440: 'TANGERANG', 465: 'TANGERANG', 466: 'TANGERANG',
      469: 'TANGERANG', 497: 'TANGERANG', 514: 'TANGERANG'
    };

    // 0. Check Authoritative ID mapping
    const rowId = row.id !== undefined && row.id !== null ? Number(row.id) : null;
    if (rowId !== null && SITAC_SPECIFIC_ID_MAP[rowId]) {
      return SITAC_SPECIFIC_ID_MAP[rowId];
    }

    const term = (row.terminating || '').toUpperCase();
    const ptl = (row.ptl || '').toUpperCase();
    const pel = (row.pelanggan || '').toUpperCase();
    const t = term;

    // Strip cluster prefixes like '(TANGERANG 2)' or '(BOGOR 1)' from terminating if followed by actual address
    const realAddr = t.replace(/^\s*(\([^\)]+\)\s*)+/, '');
    const tClean = realAddr || t;

    const has = (words, target) => {
      const src = target !== undefined ? target : tClean;
      return words.some(w => src.includes(w));
    };

    // 1. SPECIFIC EXPLICIT ADDRESS OVERRIDES (Disambiguation)
    // Kelapa Dua Depok -> BODEBEK (Depok)
    if (t.includes('KELAPA DUA DEPOK') || (t.includes('KELAPA DUA') && t.includes('DEPOK'))) {
      return 'BODEBEK';
    }
    // Cinere / Cinere Mall Depok -> BODEBEK
    if (t.includes('CINERE')) {
      return 'BODEBEK';
    }
    // Pondok Gede / Jatisampurna -> BODEBEK (Bekasi)
    if (t.includes('PONDOK GEDE') || t.includes('JATISAMPURNA')) {
      return 'BODEBEK';
    }
    // Pondok Pinang / Pd. Pinang / Kebayoran Lama -> JAKPUSEL
    if (['PONDOK PINANG', 'PD. PINANG', 'PD PINANG', 'KEBAYORAN LAMA', 'KBY. LAMA', 'PONDOK INDAH', 'FATMAWATI', 'SIMATUPANG', 'TB SIMATUPANG'].some(k => t.includes(k))) {
      return 'JAKPUSEL';
    }
    // Key Landmarks: GBK, JIExpo, Lapangan Banteng, Pasar Baru, Gedung BP BUMN, Danantara, Cyber/APJII, Atrium Mulia, Cideng, Bulungan, Lebak Bulus -> JAKPUSEL
    if (['PPKGBK', 'PPK GBK', 'HUTAN KOTA GBK', 'AQUATIK', 'JIEXPO', 'JAKARTA INTERNATIONAL EXPO', 'LAPANGAN BANTENG', 'BANTENG', 'PASAR BARU', 'PS. BARU', 'PS BARU', 'JUANDA', 'VETERAN', 'MONAS', 'MEDAN MERDEKA', 'SALEMBA', 'RAWASARI', 'PEJOMPONGAN', 'BENHIL', 'BENDUNGAN HILIR', 'KWITANG', 'GUNUNG SAHARI', 'BULUNGAN', 'LEBAK BULUS', 'STADION LEBAK BULUS', 'PASAR JUMAT', 'RECAPITAL', 'WISMA LUMBA', 'DANANTARA', 'BP BUMN', 'APJII', 'ANTAM', 'OIL CENTRE', 'TAMAN GANDARIA', 'ATRIUM MULIA', 'CIDENG', 'JATIBARU', 'TAMAN JATI BARU', 'HEAD OFFICE BNI'].some(k => t.includes(k))) {
      return 'JAKPUSEL';
    }
    // JIEP Pulogadung, Inkopal, Artha Gading, Kirana Three, Tanjung Priuk, Wisma Indomobil -> JAKUTIM
    if (['JIEP', 'PULOGADUNG', 'PULO GADUNG', 'TANJUNG PRIUK', 'INKOPAL', 'ARTHA GADING', 'KIRANA THREE', 'WISMA INDOMOBIL'].some(k => t.includes(k))) {
      return 'JAKUTIM';
    }
    // Technovillage, Parung Panjang, Transvision, Pondok Ungu, Riverside, Cibatu -> BODEBEK
    if (['TECHNOVILLAGE', 'KPSOMANG', 'PARUNG PANJANG', 'TRANSVISION', 'PONDOK UNGU', 'RIVERSIDE', 'CIBATU'].some(k => t.includes(k))) {
      return 'BODEBEK';
    }
    // Grand Soho, Palmerah, Kebon Jeruk, Srengseng -> JAKBAR
    if (['GRAND SOHO', 'KEBON JERUK', 'KB. JERUK', 'SRENGSENG'].some(k => t.includes(k))) {
      return 'JAKBAR';
    }
    // Leuwidamar, Cikande, Nikomas -> BANTEN
    if (['LEUWIDAMAR', 'CIKANDE', 'NIKOMAS'].some(k => t.includes(k))) {
      return 'BANTEN';
    }
    // Foresta, Pagedangan, Diklat Pemda, Tanggerang, Titan Bintaro, Bizpoint, Industri Manis, Tristate, Taman Tekno, DCI Rempoa, Puri Beta, Gading Serpong -> TANGERANG
    if (['FORESTA', 'PAGEDANGAN', 'DIKLAT PEMDA', 'LENGKONG KULON', 'TANGGERANG', 'KABUPATEN TANGGERANG', 'KAB. TANGGERANG', 'TITAN BINTARO', 'BIZPOINT', 'INDUSTRI MANIS', 'TRISTATE', 'TAMAN TECNO', 'TAMAN TEKNO', 'DCI REMPOA', 'PURI BETA', 'PALEM GANDA ASRI', 'QUBIKA'].some(k => t.includes(k))) {
      return 'TANGERANG';
    }
    // Rorotan / Cilincing / Karang Tengah Cilincing -> JAKUTIM
    if (t.includes('ROROTAN') || t.includes('CILINCING')) {
      return 'JAKUTIM';
    }
    // Kamal Benda / 12JKB -> JAKBAR
    if (t.includes('12JKB') || t.includes('01JKB') || (t.includes('KAMAL') && t.includes('BENDA'))) {
      return 'JAKBAR';
    }
    // Cikokol / Thamrin Tangerang / Rasuna Said Tangerang -> TANGERANG
    if (['CIKOKOL', 'BATUCEPER', 'PORIS', 'JATIUWUNG', 'PERIUK', 'CIBODAS', 'NEGLASARI'].some(k => t.includes(k))) {
      return 'TANGERANG';
    }
    // Bassura / Cipinang -> JAKUTIM
    if (['BASSURA', 'CIPINANG', 'JATINEGARA', 'PULOGADUNG', 'PULO GADUNG'].some(k => t.includes(k))) {
      return 'JAKUTIM';
    }

    // 2. EXPLICIT CITY / REGENCY NAMES
    if (has(['KOTA TANGERANG', 'TANGERANG SELATAN', 'TANGSEL', 'KAB. TANGERANG', 'KAB TANGERANG', 'KABUPATEN TANGERANG', 'KABUPATEN TANGGERANG', 'KAB. TANGGERANG', 'TANGGERANG', '11TNG', '11TGX', '11TGS', '11TGR'])) {
      return 'TANGERANG';
    }
    if (has(['JAKARTA BARAT', 'JAKBAR'])) {
      return 'JAKBAR';
    }
    if (has(['JAKARTA SELATAN', 'JAKSEL', '12JKS', '01JKS', 'JAKARTA PUSAT', 'JAKPUS', '12JKP', '01JKP'])) {
      return 'JAKPUSEL';
    }
    if (has(['JAKARTA TIMUR', 'JAKTIM', '12JKT', '01JKT', 'JAKARTA UTARA', 'JAKUT', '12JKU', '01JKU'])) {
      return 'JAKUTIM';
    }
    if (has(['KOTA DEPOK', 'KAB. BOGOR', 'KAB BOGOR', 'KOTA BOGOR', 'KABUPATEN BOGOR', 'KOTA BEKASI', 'KAB. BEKASI', 'KAB BEKASI', 'KABUPATEN BEKASI', 'KOTA BKS', '13BGR', '13DPK', '13BKS'])) {
      return 'BODEBEK';
    }
    if (has(['DEPOK', 'BEKASI', 'BOGOR', 'CIBINONG', 'SENTUL', 'CIKARANG'])) {
      return 'BODEBEK';
    }

    // Banten (strictly Serang, Cilegon, Pandeglang, Lebak)
    const bantenExplicit = ['SERANG', 'CILEGON', 'PANDEGLANG', 'RANGKASBITUNG', 'ANYER', 'MERAK', 'BOJONEGARA', 'ASAHIMAS', 'KRAKATAU STEEL', '11SRG', '11CLG', '11PAN', '11LBK', '11LBA', '11CIL', '11SER'];
    if (has(bantenExplicit) || (has(['LEBAK']) && !has(['LEBAK BULUS']))) {
      return 'BANTEN';
    }
    if (has(['BANTEN']) && !has(['TANGERANG', 'TANGGERANG', 'TANGSEL', 'PAGEDANGAN', 'FORESTA', 'DIKLAT PEMDA', 'BULUNGAN', 'LEBAK BULUS'])) {
      return 'BANTEN';
    }

    // 3. DISTINCT DISTRICTS & LOCALITIES
    const tngAreas = [
      'TANGERANG', 'TANGGERANG', 'CIPUTAT', 'PAMULANG', 'SERPONG', 'BSD', 'KARAWACI', 
      'CIKUPA', 'BALARAJA', 'LEGOK', 'TIGARAKSA', 'CURUG', 'KELAPA DUA', 
      'CILEDUG', 'KARANG TENGAH', 'PONDOK AREN', 'PUSPITEK', 'PUSPIPTEK', 
      'ALAM SUTERA', 'GADING SERPONG', 'PAGEDANGAN', 'FORESTA', 'DIKLAT PEMDA',
      'CISAUK', 'CISOKA', 'PANONGAN', 'PASAR KEMIS', 'PS KEMIS', 'PS. KEMIS',
      'RAJEG', 'SEPATAN', 'TELUKNAGA', 'PAKUHAJI', 'MAUK', 'KRONJO', 'SOLEAR', 'SUKAMULYA', 'SINDANG JAYA'
    ];
    if (has(tngAreas)) return 'TANGERANG';
    if (/\bPINANG\b/.test(tClean) && !has(['CIPINANG', 'PONDOK PINANG', 'PD. PINANG', 'PD PINANG', 'PINANG RANTI'])) {
      return 'TANGERANG';
    }
    if (/\bSETU\b/.test(tClean) && !has(['SETU BEKASI', 'CIPAYUNG'])) {
      return 'TANGERANG';
    }

    const jkbAreas = [
      'KALIDERES', 'CENGKARENG', 'GROGOL', 'KEBON JERUK', 'KB. JERUK', 'PALMERAH', 
      'KEMBANGAN', 'TAMBORA', 'TAMAN SARI', 'KAPUK', 'PEGADUNGAN', 'MERUYA', 'JOGLO', 
      'KEDOYA', 'TOMANG', 'SLIPI', 'JEMBATAN BESI', 'DAAN MOGOT', 'GLODOK', 'BINUS', 
      'RAWA BUAYA', 'SEMANAN', 'JEMB. LIMA', 'JEMBATAN LIMA', 'ANGKE', 'ROXY', 'TAMAN PALEM', 'PURI INDAH', 'GREEN GARDEN'
    ];
    if (has(jkbAreas)) return 'JAKBAR';

    const jpsAreas = [
      'SUDIRMAN', 'THAMRIN', 'KUNINGAN', 'TEBET', 'SETIABUDI', 'MAMPANG', 'PANCORAN', 
      'PASAR MINGGU', 'PESANGGRAHAN', 'JAGAKARSA', 'BLOK M', 
      'GATOT SUBROTO', 'CENTENNIAL TOWER', 'INTILAND TOWER', 'GRAND INDONESIA', 'KALIBATA', 
      'MEDAN MERDEKA', 'PERMATA HIJAU', 'PETUKANGAN', 'KARET', 'RASUNA SAID', 'SENAYAN', 
      'SCBD', 'BINTARO SEKTOR', 'PEJATEN', 'MANGGARAI', 'CASABLANCA', 'KEMANG', 'LEBAK BULUS', 
      'CIPETE', 'TANJUNG BARAT', 'JCC', 'M.T HARYONO', 'CAWANG', 'JAMSOSTEK', 'CEMPAKA MAS',
      'GAMBIR', 'MENTENG', 'TANAH ABANG', 'SENEN', 'CEMPAKA PUTIH', 'JOHAR BARU', 'KEMAYORAN', 'SAWAH BESAR',
      'LAPANGAN BANTENG', 'PASAR BARU', 'PS. BARU', 'PS BARU', 'JUANDA', 'VETERAN', 'MONAS', 'SALEMBA', 'RAWASARI', 'PEJOMPONGAN', 'BENHIL', 'BENDUNGAN HILIR',
      'BULUNGAN', 'STADION LEBAK BULUS', 'PASAR JUMAT',
      'KEBAYORAN', 'CILANDAK'
    ];
    if (has(jpsAreas)) return 'JAKPUSEL';

    const jutAreas = [
      'PRIOK', 'TANJUNG PRIOK', 'KOJA', 'KELAPA GADING', 'PADEMANGAN', 'PENJARINGAN', 
      'SUNTER', 'ANCOL', 'PLUIT', 'MARUNDA', 'MATRAMAN', 'DUREN SAWIT', 'KRAMAT JATI', 'MAKASAR', 
      'PASAR REBO', 'CIRACAS', 'CIPAYUNG', 'CAKUNG', 'RAWAMANGUN', 'RAMBUTAN', 'CIBUBUR', 'TMII', 
      'RAWA MALANG', 'CILILITAN', 'KAMPUNG RAMBUTAN', 'PONDOK KOPI', 'KLENDER', 'PONDOK KELAPA', 
      'HALIM', 'PULO GEBANG', 'UJUNG MENTENG', 'SEMPER', 'PEGANGSAAN', 'PINANG RANTI'
    ];
    if (has(jutAreas)) return 'JAKUTIM';

    const bdbAreas = [
      'CIAWI', 'BOJONG GEDE', 'GUNUNG PUTRI', 'CILEUNGSI', 'SAWANGAN', 'CIMANGGIS', 
      'SUKMAJAYA', 'BEJI', 'LIMO', 'TAPOS', 'CILODONG', 'TAMBUN', 'CIBITUNG', 'HARAPAN INDAH', 
      'JATIASIH', 'HARAPAN JAYA', 'JATIMAKMUR', 'JATIMULYA', 'GANDUL', 'PLN GANDUL', 
      'MUSTIKA JAYA', 'MM2100', 'GIIC', 'DELTAMAS', 'JONGGOL', 'BOJONG SARI', 'BABAKAN MADANG', 
      'CITRA INDAH', 'SUMMARECON BEKASI', 'JABABEKA', 'EJIP', 'LIPPO CIKARANG', 'KARAWANG', 'RADAR AURI'
    ];
    if (has(bdbAreas)) return 'BODEBEK';

    // 4. FALLBACK: Check raw terminating, PTL or customer name
    if (has(['TANGERANG', 'TANGSEL'], t)) return 'TANGERANG';
    if (has(['JAKARTA BARAT', 'JAKBAR', '12JKB'], t)) return 'JAKBAR';
    if (has(['JAKARTA SELATAN', 'JAKSEL', 'JAKARTA PUSAT', 'JAKPUS'], t)) return 'JAKPUSEL';
    if (has(['JAKARTA TIMUR', 'JAKTIM', 'JAKARTA UTARA', 'JAKUT'], t)) return 'JAKUTIM';
    if (has(['BOGOR', 'DEPOK', 'BEKASI', '13BGR', '13DPK', '13BKS'], t)) return 'BODEBEK';

    const extra = (ptl + ' ' + pel);
    if (['DEPOK', 'BEKASI', 'BOGOR'].some(k => extra.includes(k))) return 'BODEBEK';
    if (['TANGERANG', 'TANGSEL'].some(k => extra.includes(k))) return 'TANGERANG';
    if (['SERANG', 'CILEGON'].some(k => extra.includes(k))) return 'BANTEN';
    if (['JAKBAR', 'JAKARTA BARAT'].some(k => extra.includes(k))) return 'JAKBAR';
    if (['JAKPUS', 'JAKSEL', 'JAKARTA PUSAT', 'JAKARTA SELATAN'].some(k => extra.includes(k))) return 'JAKPUSEL';
    if (['JAKUT', 'JAKTIM', 'JAKARTA UTARA', 'JAKARTA TIMUR'].some(k => extra.includes(k))) return 'JAKUTIM';

    return 'LAINNYA';
  }
  window.classifySitacRegion = classifySitacRegion;

  function formatPicName(name) {
    if (!name) return '-';
    const s = String(name).trim();
    if (!s || s === '-') return '-';
    const known = {
      'budi.rodiyah': 'Budi Rodiyah',
      'edi.swargaloka': 'Edi Swargaloka',
      'harlan.zaelani': 'Harlan Zaelani',
      'zulhadi.syahril': 'Zulhadi Syahril',
      'zulhadi syahril': 'Zulhadi Syahril',
      'muhidin.shelay': 'Muhidin Shelay',
      'brian.ariyanto': 'Brian Ariyanto',
      'agih.gahara': 'Agih Gahara',
      'hairul.aswan': 'Hairul Aswan',
      'yudiansyah': 'Yudiansyah',
      'muhamad abusopian': 'Muhamad Abusopian',
      'muhammad abusopian': 'Muhamad Abusopian'
    };
    if (known[s.toLowerCase()]) return known[s.toLowerCase()];
    if (s.includes('.') && !s.includes('@')) {
      return s.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    }
    return s;
  }

  function normalizePengelolaName(name) {
    if (!name) return '';
    const raw = String(name).trim();
    if (!raw) return '';
    const u = raw.toUpperCase();

    // 0. Caturmas Kelola Sukses (Fix Caltumas typo & all-caps)
    if (u.includes('CATURMAS') || u.includes('CALTUMAS')) {
      return 'Caturmas Kelola Sukses';
    }

    // Indointernet
    if (u.includes('INDOINTERNET') || u.includes('INDO INTERNET')) {
      return 'Indointernet';
    }

    // Infrastruktur Cakrawala Telekomunikasi (Fix Infranstruktur typo)
    if (u.includes('CAKRAWALA TELEKOMUNIKASI')) {
      return 'Infrastruktur Cakrawala Telekomunikasi';
    }

    // IDC (Internetindo Data Centra Indonesia)
    if (u.includes('INTERNETINDO DATA CENTRA') || (u.includes('IDC') && u.includes('INTERNETINDO'))) {
      return 'IDC (Internetindo Data Centra Indonesia)';
    }

    // Crisis Center Menara Permai (Fix Cricis typo)
    if (u.includes('MENARA PERMAI')) {
      return 'Crisis Center Menara Permai';
    }

    // Data Sinergitama Jaya (Elitery)
    if (u.includes('DATA SINERGITAMA') || u.includes('ELITERY')) {
      return 'Data Sinergitama Jaya (Elitery)';
    }

    // PLN Dist Jaya AP Bulungan
    if (u.includes('PLN DIST') && u.includes('BULUNGAN')) {
      return 'PLN Dist Jaya AP Bulungan';
    }

    // Graha Anugerah Sejahtera
    if (u.includes('GRAHA ANUGERAH')) {
      return 'Graha Anugerah Sejahtera';
    }

    // Intershop Prima Center
    if (u.includes('INTERSHOP PRIMA')) {
      return 'Intershop Prima Center';
    }

    // Prestasi Piranti Informasi
    if (u.includes('PRESTASI PIRANTI')) {
      return 'Prestasi Piranti Informasi';
    }

    // Megalopolis Manunggal Industrial Development
    if (u.includes('MEGALOPOLIS MANUNGGAL')) {
      return 'Megalopolis Manunggal Industrial Development';
    }

    // Mandiri Andal Sejahtera
    if (u.includes('MANDIRI ANDAL') || u.includes('MAKMUR JAYA SERASI')) {
      return 'Mandiri Andal Sejahtera';
    }

    // PCDC Propco One
    if (u.includes('PROPCO ONE')) {
      return 'PCDC Propco One';
    }

    // Trans Indonesia Superkoridor (Fix Sueprkoridor typo)
    if (u.includes('SUEPRKORIDOR') || u.includes('SUPERKORIDOR')) {
      return 'Trans Indonesia Superkoridor';
    }

    // Wisma Keiai Indonesia
    if (u.includes('WISMA KEIAI')) {
      return 'Wisma Keiai Indonesia';
    }

    // BPJS Ketenagakerjaan
    if (u.includes('BPJS KETENAGAKERJAAN') && !u.includes('BINAJASA')) {
      return 'BPJS Ketenagakerjaan';
    }

    // APJII
    if (u === 'APJII' || u.includes('ASOSIASI PENYELENGGARA JASA INTERNET INDONESIA')) {
      return 'Asosiasi Penyelenggara Jasa Internet Indonesia (APJII)';
    }

    // Biznet Data Center
    if (u.includes('BIZNE') || u.includes('BIZNET')) {
      if (u.includes('SUPRA PRIMATAMA') || u.includes('BIZNET NETWORKS')) {
        return 'Supra Primatama Nusantara (Biznet Networks)';
      }
      return 'Biznet Data Center';
    }

    // Sigma Cipta Caraka
    if (u.includes('SIGMA CIPTA')) {
      return 'Sigma Cipta Caraka';
    }

    // Telkom Data Ekosistem (NeutraDC)
    if (u.includes('TELKOM DATA EKOSISTEM') || u.includes('NEUTRA DC') || u.includes('NEUTRADEC') || u.includes('NEUTRA')) {
      return 'Telkom Data Ekosistem (NeutraDC)';
    }

    // NTT Indonesia
    if (u.includes('NTT INDONESIA') || u.includes('NTT GLOBAL') || u === 'NTT' || u.startsWith('NTT ')) {
      return 'NTT Indonesia';
    }

    // DCI Indonesia
    if (u.includes('DCI INDONESIA') || u === 'DCI' || u.startsWith('DCI ')) {
      return 'DCI Indonesia';
    }

    // Princeton Digital Group
    if (u.includes('PRINCETON DIGITAL') || u.includes('PDG')) {
      return 'Princeton Digital Group';
    }

    // Lintasarta
    if (u.includes('LINTASARTA') || u.includes('APLIKANUSA LINTASARTA')) {
      return 'Aplikanusa Lintasarta';
    }

    // Mora Telematika Indonesia (Moratelindo)
    if (u.includes('MORATEL') || u.includes('MORA TELEMATIKA')) {
      return 'Mora Telematika Indonesia (Moratelindo)';
    }

    // Karya Pilih Teknologi (Cybertrend)
    if (u.includes('KARYA PILIH TEKNOLOGI') || u.includes('CYBERTREND')) {
      return 'Karya Pilih Teknologi (Cybertrend)';
    }

    return raw;
  }
  window.normalizePengelolaName = normalizePengelolaName;

  const formatRupiah = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
    return 'Rp\u00A0' + Number(val).toLocaleString('id-ID');
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // =========================================================================
  // KONFIGURASI KONTAK WHATSAPP ADMIN & HELPDESK
  // Nomor tujuan konfirmasi aktivasi akun PIC baru (format: 628xxxxxxxxxx)
  // =========================================================================
  window.TELECOM_ADMIN_WA = window.TELECOM_ADMIN_WA || '6281234567890';

  function generateAdminWhatsAppUrl(username, fullName) {
    const rawNumber = (localStorage.getItem('telecom_admin_wa') || window.TELECOM_ADMIN_WA || '6281234567890').replace(/[^0-9]/g, '');
    const cleanPhone = rawNumber.startsWith('0') ? '62' + rawNumber.slice(1) : rawNumber;
    const greeting = 'Halo Admin Telecom Portal,';
    const body = `Saya ingin konfirmasi pendaftaran akun PIC baru:\n` +
                 `• Nama Lengkap: ${fullName || '-'}\n` +
                 `• Username: @${username || '-'}\n\n` +
                 `Mohon bantuannya untuk persetujuan (approval) akun agar saya dapat segera masuk dan bertugas. Terima kasih!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting + '\n\n' + body)}`;
  }

  const formatPelangganCell = (rawPelanggan) => {
    if (!rawPelanggan || rawPelanggan === '-') {
      return '<span class="text-slate-400">-</span>';
    }

    // Split by newline or semicolon
    const rawItems = String(rawPelanggan)
      .split(/[\r\n]+/)
      .map(s => s.trim().replace(/^\d+[\.\)]\s*/, ''))
      .filter(s => s.length > 0);

    if (rawItems.length === 0) {
      return '<span class="text-slate-400">-</span>';
    }

    // Group and deduplicate items while preserving original case of first occurrence
    const map = new Map();
    rawItems.forEach(item => {
      const key = item.toUpperCase().replace(/\s+/g, ' ');
      if (!map.has(key)) {
        map.set(key, { name: item, count: 0 });
      }
      map.get(key).count++;
    });

    const uniqueEntries = Array.from(map.values());
    const totalTenants = uniqueEntries.length;
    const firstTenant = uniqueEntries[0];

    const fullTooltip = uniqueEntries.map((item, i) => `${i + 1}. ${item.name}${item.count > 1 ? ` (${item.count}×)` : ''}`).join('\n');

    if (totalTenants === 1 && rawItems.length === 1) {
      return `
        <div class="tenant-primary-name" title="${escapeHtml(firstTenant.name)}">
          ${escapeHtml(firstTenant.name)}
        </div>
      `;
    }

    const remainingCount = totalTenants - 1;
    const badgeText = remainingCount > 0 
      ? `+${remainingCount} lainnya` 
      : `${rawItems.length}× link`;

    const popoverPayload = encodeURIComponent(JSON.stringify({
      title: `Daftar Pelanggan (${totalTenants} Tenant)`,
      icon: 'fa-users',
      items: uniqueEntries.map(e => ({ name: e.name, badge: e.count > 1 ? `${e.count} link` : null }))
    }));

    return `
      <div class="tenant-cell" title="${escapeHtml(fullTooltip)}">
        <span class="tenant-primary-name" title="${escapeHtml(firstTenant.name)}">
          ${escapeHtml(firstTenant.name)}
        </span>
        <button type="button" class="tenant-badge cursor-pointer" data-popover="${popoverPayload}" title="Klik untuk rincian ${remainingCount > 0 ? remainingCount + ' pelanggan lainnya' : ''}">
          ${escapeHtml(badgeText)}
        </button>
      </div>
    `;
  };

  const formatSoCell = (sid, noSo) => {
    // 1. Process SID (dedup & compact multiline SID)
    const rawSid = String(sid || '')
      .split(/[\r\n]+/)
      .map(s => s.trim().replace(/^['`]/, ''))
      .filter(Boolean);
    const primarySid = rawSid[0] || '';
    const remainingSidCount = rawSid.length - 1;

    let sidHtml = '';
    if (primarySid) {
      if (rawSid.length <= 1) {
        sidHtml = `<div class="font-mono text-cyan-400 text-xs max-w-[140px] truncate" title="${escapeHtml(primarySid)}">${escapeHtml(primarySid)}</div>`;
      } else {
        const sidTooltip = rawSid.map((s, i) => `${i + 1}. ${s}`).join('\n');
        const sidPopoverPayload = encodeURIComponent(JSON.stringify({
          title: `Daftar SID (${rawSid.length} SID)`,
          icon: 'fa-network-wired',
          items: rawSid.map(s => ({ name: s, badge: null }))
        }));
        sidHtml = `
          <div class="flex items-center gap-1" title="${escapeHtml(sidTooltip)}">
            <span class="font-mono text-cyan-400 text-xs max-w-[95px] truncate" title="${escapeHtml(primarySid)}">${escapeHtml(primarySid)}</span>
            <button type="button" class="tenant-badge text-[9px] py-0 px-1 cursor-pointer text-cyan-300 border-cyan-500/40" data-popover="${sidPopoverPayload}" title="Klik untuk rincian ${remainingSidCount} SID lainnya">
              +${remainingSidCount} lainnya
            </button>
          </div>
        `;
      }
    }

    // 2. Process Nomor SO
    const rawSo = String(noSo || '')
      .split(/[\r\n]+/)
      .map(s => s.trim().replace(/^\d+[\.\)]\s*/, ''))
      .filter(Boolean);
    const primarySo = rawSo[0] || (primarySid ? '-' : '-');
    
    if (rawSo.length <= 1) {
      return `
        ${sidHtml}
        <div class="text-[11px] text-slate-500 max-w-[140px] truncate" title="${escapeHtml(primarySo)}">${escapeHtml(primarySo)}</div>
      `;
    }

    const fullTooltip = rawSo.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const remainingCount = rawSo.length - 1;
    const popoverPayload = encodeURIComponent(JSON.stringify({
      title: `Daftar Nomor SO (${rawSo.length} SO)`,
      icon: 'fa-file-lines',
      items: rawSo.map(s => ({ name: s, badge: null }))
    }));

    return `
      ${sidHtml}
      <div class="flex items-center gap-1" title="${escapeHtml(fullTooltip)}">
        <span class="text-[11px] text-slate-500 max-w-[95px] truncate" title="${escapeHtml(primarySo)}">${escapeHtml(primarySo)}</span>
        <button type="button" class="tenant-badge text-[9px] py-0 px-1 cursor-pointer" data-popover="${popoverPayload}" title="Klik untuk rincian ${remainingCount} SO lainnya">
          +${remainingCount} lainnya
        </button>
      </div>
    `;
  };

  const formatSiteCell = (site, alamatPengelola) => {
    const raw = String(site || alamatPengelola || '').trim();
    if (!raw || raw.toLowerCase() === 'y' || raw === '-') {
      return `<span class="text-slate-600 text-xs italic">-</span>`;
    }
    return `
      <div class="flex items-center gap-1.5 max-w-[220px] text-xs text-slate-200" title="Site: ${escapeHtml(raw)}">
        <span class="badge-emerald px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
          <i class="fa-solid fa-server text-[8px]"></i>Site
        </span>
        <span class="truncate font-medium">${escapeHtml(raw)}</span>
      </div>
    `;
  };

  const formatLocationCell = (originating, terminating, alamatPengelola, site) => {
    const orig = String(originating || '').trim();
    const term = String(terminating || '').trim();
    const hasOrig = orig.length > 0 && orig !== '-';
    const hasTerm = term.length > 0 && term !== '-';

    if (hasOrig && hasTerm) {
      return `
        <div class="flex flex-col gap-0.5 max-w-[240px] text-[11px] leading-tight">
          <div class="flex items-center gap-1.5 truncate" title="Originating: ${escapeHtml(orig)}">
            <span class="badge-cyan px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0">Orig</span>
            <span class="truncate font-medium">${escapeHtml(orig)}</span>
          </div>
          <div class="flex items-center gap-1.5 truncate opacity-80" title="Terminating: ${escapeHtml(term)}">
            <span class="badge-amber px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0">Term</span>
            <span class="truncate">${escapeHtml(term)}</span>
          </div>
        </div>
      `;
    }
    if (hasTerm) {
      return `
        <div class="flex flex-col gap-0.5 max-w-[240px] text-xs">
          <div class="flex items-center gap-1.5 truncate" title="Terminating: ${escapeHtml(term)}">
            <span class="badge-amber px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0">Term</span>
            <span class="truncate">${escapeHtml(term)}</span>
          </div>
        </div>
      `;
    }
    if (hasOrig) {
      return `
        <div class="flex flex-col gap-0.5 max-w-[240px] text-xs">
          <div class="flex items-center gap-1.5 truncate" title="Originating: ${escapeHtml(orig)}">
            <span class="badge-cyan px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0">Orig</span>
            <span class="truncate font-medium">${escapeHtml(orig)}</span>
          </div>
        </div>
      `;
    }
    return '<span class="opacity-40">-</span>';
  };

  const computeRowspanMap = (records, key = 'pengelola') => {
    if (!records || !records.length) return [];
    const map = new Array(records.length).fill(0);
    for (let i = 0; i < records.length;) {
      const cur = String(records[i][key] || '').trim().toLowerCase();
      let span = 1;
      while (
        i + span < records.length &&
        String(records[i + span][key] || '').trim().toLowerCase() === cur &&
        cur !== ''
      ) {
        span++;
      }
      map[i] = span;
      for (let j = 1; j < span; j++) {
        map[i + j] = -1;
      }
      i += span;
    }
    return map;
  };

  const showToast = (message, type = 'success') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'portal-toast';
    const icon = type === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-circle-exclamation text-rose-400';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('FINISH') || s === 'ACTIVE') {
      return `<span class="status-badge status-active"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(status)}</span>`;
    } else if (s.includes('ONGOING')) {
      return `<span class="status-badge status-ongoing"><i class="fa-solid fa-clock"></i> Ongoing</span>`;
    } else if (s.includes('HOLD')) {
      return `<span class="status-badge status-hold"><i class="fa-solid fa-circle-pause"></i> Hold</span>`;
    } else if (s.includes('CANCEL') || s.includes('DEACTIVASI')) {
      return `<span class="status-badge status-cancel"><i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(status)}</span>`;
    } else {
      return `<span class="status-badge status-nonactive">${escapeHtml(status || 'Non Active')}</span>`;
    }
  };

  const getAgingBadge = (days) => {
    if (days === null || days === undefined || days < 0) {
      return `<span class="aging-badge aging-green">-</span>`;
    }
    if (days <= 7) {
      return `<span class="aging-badge aging-green" title="SLA Aman (&le; 7 Hari)"><i class="fa-solid fa-check"></i> ${days} Hari</span>`;
    } else if (days <= 14) {
      return `<span class="aging-badge aging-yellow" title="Perhatian (8 - 14 Hari)"><i class="fa-solid fa-triangle-exclamation"></i> ${days} Hari</span>`;
    } else {
      return `<span class="aging-badge aging-red" title="Kritis (> 14 Hari)"><i class="fa-solid fa-fire"></i> ${days} Hari</span>`;
    }
  };

  const getAlertBadge = (category, sisaHari) => {
    const cat = (category || '').toUpperCase();
    if (cat === 'CRITICAL') {
      return `<span class="alert-pill alert-critical"><i class="fa-solid fa-fire"></i> CRITICAL (${sisaHari} Hari)</span>`;
    } else if (cat === 'WARNING') {
      return `<span class="alert-pill alert-warning"><i class="fa-solid fa-bell"></i> WARNING (${sisaHari} Hari)</span>`;
    } else if (cat === 'SAFE') {
      return `<span class="alert-pill alert-safe"><i class="fa-solid fa-shield-check"></i> SAFE (${sisaHari} Hari)</span>`;
    } else {
      return `<span class="alert-pill alert-expired"><i class="fa-solid fa-triangle-exclamation"></i> EXPIRED (${sisaHari} Hari)</span>`;
    }
  };

  function updateGlobalNavBadges() {
    try {
      const data = window.SITAC_COLLO_DATA || {};
      const sitacCount = (data.sitac_records || []).length || 686;
      const colloRecords = data.collo_records || [];
      const actCollo = colloRecords.filter(c => c.status === 'ACTIVE').length || 592;
      const revShare = colloRecords.filter(c => (Number(c.rev_sharing_pct) || 0) > 0 || (c.rev_sharing && c.rev_sharing !== '-')).length || 423;
      const gangguanCount = (data.gangguan_records || []).length || 98;
      const critAlerts = colloRecords.filter(c => c.status === 'ACTIVE' && c.alert_category === 'CRITICAL').length || 36;

      const bSitac = document.getElementById('badgeNavSitac');
      if (bSitac) bSitac.textContent = sitacCount.toLocaleString('id-ID');

      const bCollo = document.getElementById('badgeNavActiveCollo');
      if (bCollo) bCollo.textContent = actCollo.toLocaleString('id-ID');

      const bRev = document.getElementById('badgeNavRevShare');
      if (bRev) bRev.textContent = revShare.toLocaleString('id-ID');

      const bAlerts = document.getElementById('badgeNavCriticalAlerts');
      if (bAlerts) bAlerts.textContent = critAlerts.toLocaleString('id-ID');

      const bGangguan = document.getElementById('badgeNavGangguan');
      if (bGangguan) bGangguan.textContent = gangguanCount.toLocaleString('id-ID');
    } catch (e) {
      console.warn('Error updating global nav badges:', e);
    }
  }

  // --- INITIALIZATION ---
  async function init() {
    initTheme();
    updateGlobalNavBadges();
    setupEventListeners();
    initAuth();
    loadMetaOptions();
    loadRegisteredPicChips();
    initContractAlertSystem();
    initTableScrollNavigation();
    initWhatsAppModalListeners();
    initGlobalSearch();
  }

  // =========================================================================
  // CONTRACT EXPIRATION ALERT SYSTEM (≤ 3 BULAN & DAILY NOTIFICATION)
  // =========================================================================
  let contractAlertData = {
    counts: { total: 0, critical: 0, warning: 0, expired: 0 },
    items: [],
    activeFilter: 'ALL'
  };

  let picAlertData = {
    counts: { total: 0, gangguan: 0, sitac_crit: 0, sitac_normal: 0 },
    items: [],
    activeFilter: 'ALL'
  };

  async function fetchExpiringContracts(silent = false) {
    try {
      const res = await fetch('/api/collo/expiring-3months');
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      contractAlertData.counts = data.counts || { total: 0, critical: 0, warning: 0, expired: 0 };
      contractAlertData.items = data.items || [];
      
      // STRICT: Notifikasi HANYA untuk user yang SUDAH LOGIN dan memiliki role 'admin'!
      // Pada laman login (belum login) atau user PIC lapangan, sembunyikan semua peringatan.
      const isAdmin = !!(state.currentUser && state.currentUser.role === 'admin');
      const bellContainer = document.getElementById('contractAlertBellContainer');
      const banner = document.getElementById('dailyContractAlertBanner');

      if (!isAdmin) {
        if (bellContainer) bellContainer.style.display = 'none';
        if (banner) {
          banner.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
          banner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }
      } else {
        const bellContainer = document.getElementById('contractAlertBellContainer');
        if (bellContainer) bellContainer.style.display = '';
        updateContractAlertUI();
        checkDailyContractAlertNotification(silent);
      }
    } catch (e) {
      console.error('Failed to load contract expiration alerts:', e);
    }
  }

  function getPicTaskData() {
    const rawPic = state.currentUser?.pic_code || state.activeTechnician || 'Harlan';
    const picLower = rawPic.toLowerCase();
    const data = window.SITAC_COLLO_DATA || {};
    const sitacList = data.sitac_records || [];
    const gangguanList = data.gangguan_records || [];

    // Filter Gangguan for this PIC (Open / Aktif)
    const myGangguan = gangguanList.filter(g => {
      const p = (g.pic_perijinan || '').toLowerCase();
      const isOpen = !g.is_selesai && g.status !== 'Selesai';
      return isOpen && p.includes(picLower);
    }).map(g => ({
      type: 'gangguan',
      id: g.id,
      no_tiket: g.no_tiket,
      terminating: g.terminating,
      pic_disposisi: g.pic_disposisi,
      tgl_dispos: g.tgl_dispos,
      jenis_gangguan: g.jenis_gangguan,
      update_gangguan: g.update_gangguan,
      status: g.status || 'Aktif (Open)'
    }));

    // Filter SITAC for this PIC (Ongoing)
    const mySitac = sitacList.filter(s => {
      const p = (s.pic_perijinan || '').toLowerCase();
      const isOngoing = s.progress === 'Ongoing';
      return isOngoing && p.includes(picLower);
    }).map(s => ({
      type: 'sitac',
      id: s.id,
      no_pa: s.no_pa,
      pelanggan: s.pelanggan,
      terminating: s.terminating,
      durasi_hari: s.durasi_hari || 0,
      is_critical: (s.durasi_hari || 0) > 14,
      tahun: s.tahun,
      progress: s.progress
    }));

    const sitacCrit = mySitac.filter(s => s.is_critical);
    const sitacNormal = mySitac.filter(s => !s.is_critical);
    const allItems = [...myGangguan, ...mySitac];

    return {
      picName: rawPic,
      counts: {
        total: allItems.length,
        gangguan: myGangguan.length,
        sitac_crit: sitacCrit.length,
        sitac_normal: sitacNormal.length
      },
      items: allItems,
      myGangguan,
      mySitac,
      sitacCrit,
      sitacNormal
    };
  }

  function updatePicTaskAlertUI() {
    const picData = getPicTaskData();
    picAlertData.counts = picData.counts;
    picAlertData.items = picData.items;

    const bellBtn = document.getElementById('btnContractAlertBell');
    const bellBadge = document.getElementById('contractAlertBellBadge');
    const bellIcon = document.getElementById('contractBellIcon');
    const panelCount = document.getElementById('panelAlertBadgeCount');
    const panelHeaderIconBox = document.getElementById('panelHeaderIconBox');
    const panelHeaderIcon = document.getElementById('panelHeaderIcon');
    const panelTitleText = document.getElementById('panelTitleText');
    const panelSubtitleText = document.getElementById('panelSubtitleText');
    const panelFooterInfo = document.getElementById('panelFooterInfo');
    const panelGoToText = document.getElementById('panelGoToText');
    const tabsContainer = document.getElementById('alertPanelTabs');

    // Update Bell Tooltip & Badge
    if (bellBtn) bellBtn.title = `Tugas Lapangan PIC: ${picData.picName} (${picData.counts.total} tugas aktif)`;
    if (panelCount) panelCount.textContent = picData.counts.total;

    if (panelHeaderIconBox) {
      panelHeaderIconBox.className = 'w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400';
    }
    if (panelHeaderIcon) {
      panelHeaderIcon.className = 'fa-solid fa-helmet-safety text-xs';
    }
    if (panelTitleText) panelTitleText.textContent = `Tugas Lapangan PIC`;
    if (panelSubtitleText) {
      panelSubtitleText.textContent = `PIC: ${picData.picName} • ${picData.counts.sitac_crit} Kritis, ${picData.counts.sitac_normal} Ongoing`;
    }

    if (panelFooterInfo) {
      panelFooterInfo.className = 'text-[10px] text-emerald-400/90 flex items-center gap-1 font-medium';
      panelFooterInfo.innerHTML = `<i class="fa-solid fa-clipboard-check text-[10px]"></i> <span>Tugas aktif ${escapeHtml(picData.picName)}</span>`;
    }
    if (panelGoToText) {
      panelGoToText.textContent = 'Lihat Semua SITAC';
    }

    if (picData.counts.total > 0) {
      if (bellBadge) {
        bellBadge.textContent = picData.counts.total > 99 ? '99+' : picData.counts.total;
        bellBadge.classList.remove('hidden');
        bellBadge.className = 'absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full text-[10px] font-extrabold bg-emerald-500 text-white shadow-md shadow-emerald-500/50';
      }
      if (bellIcon) {
        bellIcon.className = 'fa-solid fa-bell text-emerald-400 text-lg bell-ring-icon bell-ring-active';
      }
    } else {
      if (bellBadge) bellBadge.classList.add('hidden');
      if (bellIcon) {
        bellIcon.className = 'fa-solid fa-bell text-emerald-400 text-lg bell-ring-icon';
        bellIcon.classList.remove('bell-ring-active');
      }
    }

    // Render PIC Tabs
    if (tabsContainer) {
      tabsContainer.innerHTML = `
        <button type="button" class="alert-panel-tab ${picAlertData.activeFilter === 'ALL' ? 'active text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200'} px-2 py-1 rounded-md font-semibold text-[11px]" data-pic-filter="ALL">
          Semua (${picData.counts.total})
        </button>
        <button type="button" class="alert-panel-tab ${picAlertData.activeFilter === 'SITAC_CRIT' ? 'active text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200'} px-2 py-1 rounded-md font-semibold text-[11px]" data-pic-filter="SITAC_CRIT">
          Kritis >14h (${picData.counts.sitac_crit})
        </button>
        <button type="button" class="alert-panel-tab ${picAlertData.activeFilter === 'SITAC_NORMAL' ? 'active text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200'} px-2 py-1 rounded-md font-semibold text-[11px]" data-pic-filter="SITAC_NORMAL">
          Normal (${picData.counts.sitac_normal})
        </button>
      `;

      tabsContainer.querySelectorAll('.alert-panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          tabsContainer.querySelectorAll('.alert-panel-tab').forEach(t => {
            t.classList.remove('active', 'text-emerald-400', 'bg-emerald-500/10', 'border', 'border-emerald-500/20');
            t.classList.add('text-slate-400');
          });
          tab.classList.add('active', 'text-emerald-400', 'bg-emerald-500/10', 'border', 'border-emerald-500/20');
          tab.classList.remove('text-slate-400');
          picAlertData.activeFilter = tab.getAttribute('data-pic-filter') || 'ALL';
          renderPicTaskItems();
        });
      });
    }

    renderPicTaskItems();
  }

  function renderPicTaskItems() {
    const list = document.getElementById('alertNotificationList');
    if (!list) return;

    let items = picAlertData.items || [];
    const filter = picAlertData.activeFilter;
    if (filter === 'GANGGUAN') {
      items = items.filter(x => x.type === 'gangguan');
    } else if (filter === 'SITAC_CRIT') {
      items = items.filter(x => x.type === 'sitac' && x.is_critical);
    } else if (filter === 'SITAC_NORMAL') {
      items = items.filter(x => x.type === 'sitac' && !x.is_critical);
    }

    const rawPic = state.currentUser?.pic_code || state.activeTechnician || 'Harlan';

    if (items.length === 0) {
      list.innerHTML = `
        <div class="p-6 text-center text-xs text-emerald-400">
          <i class="fa-solid fa-circle-check text-2xl mb-2 block text-emerald-400"></i>
          <span class="font-bold">Tidak Ada Tiket Terbuka!</span>
          <div class="text-[10px] text-slate-400 mt-0.5">Semua tugas kategori ini untuk PIC ${escapeHtml(rawPic)} telah selesai.</div>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map(item => {
      if (item.type === 'gangguan') {
        return `
          <div class="alert-panel-item flex items-center justify-between gap-3 text-xs border-b border-white/5 py-2.5 px-3 hover:bg-white/5 transition">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="font-bold text-rose-400 text-[11px] flex items-center gap-1">
                  <i class="fa-solid fa-triangle-exclamation text-[10px]"></i> Tiket ${escapeHtml(item.no_tiket)}
                </span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-bold border bg-rose-500/15 text-rose-400 border-rose-500/30 whitespace-nowrap shrink-0">
                  Gangguan Aktif
                </span>
              </div>
              <div class="text-[11px] font-medium text-slate-200 truncate mb-0.5" title="${escapeHtml(item.terminating || '')}">
                ${escapeHtml(item.terminating || 'Lokasi Gangguan')}
              </div>
              <div class="text-[10px] text-slate-400 flex items-center gap-2">
                <span class="text-cyan-400 font-semibold truncate max-w-[120px]">Dispos: ${escapeHtml(item.pic_disposisi || '-')}</span>
                <span>•</span>
                <span class="font-mono text-slate-300">Tgl: ${item.tgl_dispos || '-'}</span>
              </div>
              ${item.update_gangguan ? `<div class="text-[9px] text-amber-300/80 truncate mt-0.5"><i class="fa-solid fa-note-sticky mr-1"></i>${escapeHtml(item.update_gangguan)}</div>` : ''}
            </div>
            <button type="button" class="btn btn-secondary text-[10px] py-1 px-2.5 rounded-lg shrink-0 font-bold border-rose-500/40 text-rose-300 hover:bg-rose-500/20 btn-pic-open-gangguan" data-tiket="${escapeHtml(item.no_tiket)}" title="Buka detail tiket gangguan ini">
              <i class="fa-solid fa-eye mr-1"></i> Buka
            </button>
          </div>
        `;
      } else {
        const isCrit = item.is_critical;
        const badgeBg = isCrit ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        const badgeLabel = isCrit ? `Kritis (${item.durasi_hari}h)` : `Ongoing (${item.durasi_hari || 0}h)`;

        return `
          <div class="alert-panel-item flex items-center justify-between gap-3 text-xs border-b border-white/5 py-2.5 px-3 hover:bg-white/5 transition">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="font-bold text-amber-400 text-[11px] flex items-center gap-1">
                  <i class="fa-solid fa-tower-cell text-[10px]"></i> PA: ${escapeHtml(item.no_pa || 'NON PA')}
                </span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-bold border ${badgeBg} whitespace-nowrap shrink-0">
                  ${badgeLabel}
                </span>
              </div>
              <div class="text-[11px] font-medium text-slate-200 truncate mb-0.5" title="${escapeHtml(item.terminating || '')}">
                ${escapeHtml(item.terminating || item.pelanggan || '-')}
              </div>
              <div class="text-[10px] text-slate-400 flex items-center gap-2">
                <span class="text-emerald-400 font-semibold">${escapeHtml(item.pelanggan || '-')}</span>
                <span>•</span>
                <span class="font-mono text-slate-300">Tahun ${item.tahun || 2026}</span>
              </div>
            </div>
            <button type="button" class="btn btn-secondary text-[10px] py-1 px-2.5 rounded-lg shrink-0 font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/20 btn-pic-open-sitac" data-pa="${escapeHtml(item.no_pa || '')}" title="Periksa status perizinan SITAC ini">
              <i class="fa-solid fa-file-lines mr-1"></i> Periksa
            </button>
          </div>
        `;
      }
    }).join('');

    // Wire action buttons
    list.querySelectorAll('.btn-pic-open-gangguan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tiket = btn.getAttribute('data-tiket');
        document.getElementById('contractAlertNotificationPanel')?.classList.add('hidden');
        document.getElementById('btnContractAlertBell')?.classList.remove('active');

        state.myTasksOnlyGangguan = true;
        state.gangguan.search = tiket;
        const searchInput = document.getElementById('searchGangguan');
        if (searchInput) searchInput.value = tiket;
        switchView('view-gangguan');
        loadGangguanData();
      });
    });

    list.querySelectorAll('.btn-pic-open-sitac').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pa = btn.getAttribute('data-pa');
        document.getElementById('contractAlertNotificationPanel')?.classList.add('hidden');
        document.getElementById('btnContractAlertBell')?.classList.remove('active');

        state.sitac.search = pa;
        const searchInput = document.getElementById('sitacSearch');
        if (searchInput) searchInput.value = pa;
        switchView('view-sitac-pa');
        loadSitacData();
      });
    });
  }

  function updateContractAlertUI() {
    const { counts } = contractAlertData;
    const bellBtn = document.getElementById('btnContractAlertBell');
    const bellBadge = document.getElementById('contractAlertBellBadge');
    const bellIcon = document.getElementById('contractBellIcon');
    const panelCount = document.getElementById('panelAlertBadgeCount');
    const panelHeaderIconBox = document.getElementById('panelHeaderIconBox');
    const panelHeaderIcon = document.getElementById('panelHeaderIcon');
    const panelTitleText = document.getElementById('panelTitleText');
    const panelSubtitleText = document.getElementById('panelSubtitleText');
    const panelFooterInfo = document.getElementById('panelFooterInfo');
    const panelGoToText = document.getElementById('panelGoToText');
    const tabsContainer = document.getElementById('alertPanelTabs');

    if (bellBtn) bellBtn.title = 'Notifikasi Kontrak Jatuh Tempo (≤ 3 Bulan)';
    if (panelCount) panelCount.textContent = counts.total || 0;

    if (panelHeaderIconBox) {
      panelHeaderIconBox.className = 'w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400';
    }
    if (panelHeaderIcon) {
      panelHeaderIcon.className = 'fa-solid fa-bell text-xs';
    }
    if (panelTitleText) panelTitleText.textContent = 'Peringatan Kontrak';
    if (panelSubtitleText) panelSubtitleText.textContent = 'Jatuh tempo ≤ 3 bulan & perlu pembaruan';

    if (panelFooterInfo) {
      panelFooterInfo.className = 'text-[10px] text-amber-400/90 flex items-center gap-1 font-medium';
      panelFooterInfo.innerHTML = `<i class="fa-solid fa-circle-exclamation text-[9px]"></i> <span>Notifikasi harian aktif</span>`;
    }
    if (panelGoToText) {
      panelGoToText.textContent = 'Buka Monitoring';
    }

    if (counts.total > 0) {
      if (bellBadge) {
        bellBadge.textContent = counts.total > 99 ? '99+' : counts.total;
        bellBadge.classList.remove('hidden');
        bellBadge.className = 'absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full text-[10px] font-extrabold bg-rose-500 text-white shadow-md shadow-rose-500/50';
      }
      if (bellIcon) {
        bellIcon.className = 'fa-solid fa-bell text-amber-400 text-lg bell-ring-icon bell-ring-active';
      }
    } else {
      if (bellBadge) bellBadge.classList.add('hidden');
      if (bellIcon) {
        bellIcon.className = 'fa-solid fa-bell text-amber-400 text-lg bell-ring-icon';
        bellIcon.classList.remove('bell-ring-active');
      }
    }

    // Render Admin Tabs
    if (tabsContainer) {
      tabsContainer.innerHTML = `
        <button type="button" class="alert-panel-tab ${contractAlertData.activeFilter === 'ALL' ? 'active text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'} px-2 py-1 rounded-md font-semibold text-[11px]" data-filter="ALL">
          Semua (<span id="tabCountAll">${counts.total || 0}</span>)
        </button>
        <button type="button" class="alert-panel-tab ${contractAlertData.activeFilter === 'CRITICAL' ? 'active text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'} px-2 py-1 rounded-md font-semibold text-[11px]" data-filter="CRITICAL">
          Kritis ≤30h (<span id="tabCountCritical">${counts.critical || 0}</span>)
        </button>
        <button type="button" class="alert-panel-tab ${contractAlertData.activeFilter === 'WARNING' ? 'active text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'} px-2 py-1 rounded-md font-semibold text-[11px]" data-filter="WARNING">
          ≤3 Bulan (<span id="tabCountWarning">${counts.warning || 0}</span>)
        </button>
        <button type="button" class="alert-panel-tab ${contractAlertData.activeFilter === 'EXPIRED' ? 'active text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200'} px-2 py-1 rounded-md font-semibold text-[11px]" data-filter="EXPIRED">
          Lewat (<span id="tabCountExpired">${counts.expired || 0}</span>)
        </button>
      `;

      tabsContainer.querySelectorAll('.alert-panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          tabsContainer.querySelectorAll('.alert-panel-tab').forEach(t => {
            t.classList.remove('active', 'text-cyan-400', 'bg-cyan-500/10', 'border', 'border-cyan-500/20');
            t.classList.add('text-slate-400');
          });
          tab.classList.add('active', 'text-cyan-400', 'bg-cyan-500/10', 'border', 'border-cyan-500/20');
          tab.classList.remove('text-slate-400');
          contractAlertData.activeFilter = tab.getAttribute('data-filter') || 'ALL';
          renderContractAlertItems();
        });
      });
    }

    renderContractAlertItems();
  }

  function renderContractAlertItems() {
    const list = document.getElementById('alertNotificationList');
    if (!list) return;

    let items = contractAlertData.items || [];
    const filter = contractAlertData.activeFilter;
    if (filter === 'CRITICAL') {
      items = items.filter(x => x.alert_cat_calc === 'CRITICAL');
    } else if (filter === 'WARNING') {
      items = items.filter(x => x.alert_cat_calc === 'WARNING');
    } else if (filter === 'EXPIRED') {
      items = items.filter(x => x.alert_cat_calc === 'EXPIRED');
    }

    if (items.length === 0) {
      list.innerHTML = `
        <div class="p-6 text-center text-xs text-emerald-400">
          <i class="fa-solid fa-circle-check text-2xl mb-2 block text-emerald-400"></i>
          <span class="font-bold">Semua Kontrak Aman!</span>
          <div class="text-[10px] text-slate-400 mt-0.5">Tidak ada kontrak kategori ini yang perlu diperbaharui.</div>
        </div>
      `;
      return;
    }

    list.innerHTML = items.slice(0, 100).map(item => {
      let badgeBg = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      if (item.alert_cat_calc === 'EXPIRED') badgeBg = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      else if (item.alert_cat_calc === 'CRITICAL') badgeBg = 'bg-orange-500/15 text-orange-400 border-orange-500/30';

      const sisaDays = item.sisa_hari_actual;
      const sisaLabel = sisaDays <= 0 ? 'Lewat Jatuh Tempo' : `Sisa ${sisaDays} Hari`;

      return `
        <div class="alert-panel-item text-xs">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1 mb-0.5">
                <span class="font-bold text-slate-100 truncate text-[11px] max-w-[180px] sm:max-w-none">${escapeHtml(item.pelanggan || 'Pelanggan')}</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeBg} whitespace-nowrap shrink-0">
                  ${sisaLabel}
                </span>
              </div>
              <div class="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span class="text-cyan-400 font-semibold truncate max-w-[120px]">${escapeHtml(item.pengelola || '-')}</span>
                <span>•</span>
                <span class="font-mono text-slate-300 whitespace-nowrap">Tgl: ${item.end_date || '-'}</span>
              </div>
              ${item.sid ? `<div class="text-[9px] font-mono text-slate-500 mt-0.5">SID: ${escapeHtml(item.sid)}</div>` : ''}
            </div>
            <button type="button" class="btn btn-primary text-[10px] py-1 px-2 rounded-lg shrink-0 font-bold btn-renew-contract-quick whitespace-nowrap" data-id="${item.id}" title="Perbaharui masa sewa / nomor PO kontrak ini">
              <i class="fa-solid fa-pen-to-square sm:mr-1"></i><span class="hidden sm:inline"> Perbaharui</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire Perbaharui buttons to open quick edit modal
    list.querySelectorAll('.btn-renew-contract-quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        // Close dropdown
        const panel = document.getElementById('contractAlertNotificationPanel');
        const bellBtn = document.getElementById('btnContractAlertBell');
        if (panel) panel.classList.add('hidden');
        if (bellBtn) bellBtn.classList.remove('active');

        // Open quick edit modal for this contract
        openQuickEditModal('collo', id);
      });
    });
  }

  function checkDailyContractAlertNotification(silent = false) {
    // STRICT: Peringatan jatuh tempo kontrak HANYA BOLEH muncul jika user SUDAH LOGIN sebagai Admin!
    // Tidak boleh muncul di laman login (belum login) dan tidak boleh muncul pada PIC Lapangan.
    const isAdmin = !!(state.currentUser && state.currentUser.role === 'admin');
    const banner = document.getElementById('dailyContractAlertBanner');

    if (!isAdmin || contractAlertData.counts.total <= 0) {
      if (banner) {
        banner.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
        banner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
      }
      return;
    }

    if (silent) return;

    // Check if dismissed TODAY
    const todayStr = new Date().toISOString().slice(0, 10);
    const lastDismissed = localStorage.getItem('telecom_portal_alert_dismissed_date');

    // Daily notification popup until all contracts are renewed
    if (lastDismissed !== todayStr) {
      const countEl = document.getElementById('dailyBannerCount');
      if (countEl) countEl.textContent = contractAlertData.counts.total;
      if (banner) {
        setTimeout(() => {
          banner.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
          banner.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }, 1200);
      }

      // Also trigger browser desktop notification if permitted (Admin only)
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('🔔 Peringatan Jatuh Tempo Kontrak (≤ 3 Bulan)', {
            body: `Terdapat ${contractAlertData.counts.total} kontrak sirkuit yang belum diperbaharui hari ini (${todayStr}). Harap lakukan perpanjangan sewa!`,
            icon: '/favicon.ico'
          });
        } catch (e) {}
      }
    }
  }

  function setupContractAlertEventListeners() {
    const bellBtn = document.getElementById('btnContractAlertBell');
    const bellPanel = document.getElementById('contractAlertNotificationPanel');
    const closePanelBtn = document.getElementById('btnCloseAlertPanel');
    const goToFullAlerts = document.getElementById('btnGoToFullAlerts');

    // Bell toggle click
    if (bellBtn && bellPanel) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other dropdowns
        document.getElementById('exportGroupMenu')?.classList.add('hidden');
        document.getElementById('btnToggleExportMenu')?.classList.remove('active');
        document.getElementById('toolsGroupMenu')?.classList.add('hidden');
        document.getElementById('btnToggleToolsMenu')?.classList.remove('active');

        const isHidden = bellPanel.classList.contains('hidden');
        if (isHidden) {
          bellPanel.classList.remove('hidden');
          bellBtn.classList.add('active');
        } else {
          bellPanel.classList.add('hidden');
          bellBtn.classList.remove('active');
        }
      });
    }

    if (closePanelBtn && bellPanel) {
      closePanelBtn.addEventListener('click', () => {
        bellPanel.classList.add('hidden');
        bellBtn?.classList.remove('active');
      });
    }

    // Go to full alerts page
    if (goToFullAlerts) {
      goToFullAlerts.addEventListener('click', () => {
        bellPanel?.classList.add('hidden');
        bellBtn?.classList.remove('active');
        if (state.currentUser && state.currentUser.role === 'lapangan') {
          switchView('view-sitac-pa');
        } else {
          switchView('view-collo-alerts');
        }
      });
    }

    // Daily Banner events
    const banner = document.getElementById('dailyContractAlertBanner');
    const btnDismissToday = document.getElementById('btnDailyBannerDismissToday');
    const btnCloseDaily = document.getElementById('btnCloseDailyBanner');
    const btnOpenList = document.getElementById('btnDailyBannerOpenList');

    const dismissBannerForToday = () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      localStorage.setItem('telecom_portal_alert_dismissed_date', todayStr);
      if (banner) {
        banner.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
        banner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
      }
      showToast('Peringatan ditunda hingga besok.', 'info');
    };

    if (btnDismissToday) btnDismissToday.addEventListener('click', dismissBannerForToday);
    if (btnCloseDaily) btnCloseDaily.addEventListener('click', dismissBannerForToday);

    if (btnOpenList) {
      btnOpenList.addEventListener('click', () => {
        if (banner) {
          banner.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
          banner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }
        bellBtn?.click();
      });
    }

    // Close panel on outside click
    document.addEventListener('click', (e) => {
      const container = document.getElementById('contractAlertBellContainer');
      if (container && !container.contains(e.target)) {
        bellPanel?.classList.add('hidden');
        bellBtn?.classList.remove('active');
      }
    });

    // Request notification permission if supported
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        try { Notification.requestPermission(); } catch (e) {}
      }, 5000);
    }
  }

  function initContractAlertSystem() {
    setupContractAlertEventListeners();
    fetchExpiringContracts();
  }

  // --- AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) ---
  async function loadRegisteredPicChips() {
    try {
      let pics = [];
      const res = await fetch('/api/auth/registered-pics');
      if (res.ok) {
        const data = await res.json();
        pics = data.pics || [];
      }

      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        try {
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500));
          const allUsers = await Promise.race([window.FirebaseManager.fetchCollection('users'), timeoutPromise]);
          const fbPics = allUsers.filter(u => u.role === 'lapangan' && u.username !== 'lapangan');
          if (fbPics.length > 0) pics = fbPics;
        } catch (fbErr) {
          // Silent fallback to standard pics
        }
      }

      // Pastikan chip tim PIC selalu tampil meski dalam mode offline atau kuota Cloud penuh
      if (pics.length === 0) {
        pics = [
          { username: 'harlan', full_name: 'Harlan Zaelani', badge_color: 'emerald' },
          { username: 'budi', full_name: 'Budi Rodiyah', badge_color: 'cyan' },
          { username: 'edi', full_name: 'Edi Swargaloka', badge_color: 'amber' },
          { username: 'abusopian', full_name: 'M. Abusopian', badge_color: 'indigo' },
          { username: 'muhidin', full_name: 'Muhidin', badge_color: 'teal' },
          { username: 'brian', full_name: 'Brian Ariyanto', badge_color: 'purple' },
          { username: 'zulhadi', full_name: 'Zulhadi Syahril', badge_color: 'blue' }
        ];
      }
      
      const container = document.getElementById('loginPicChips');
      if (!container) return;
      
      let html = '';
      pics.forEach(p => {
        const shortName = p.full_name ? p.full_name.split(' ')[0] : p.username;
        html += `
          <button type="button" class="pic-chip-btn" data-user="${p.username}" title="${p.full_name}">
            <span class="w-2 h-2 rounded-full bg-${p.badge_color || 'emerald'}-400"></span> ${shortName}
          </button>
        `;
      });
      html += `
        <button type="button" class="pic-chip-btn border-cyan-500/30 text-cyan-300" data-user="admin" title="Administrator / Manajemen Portal">
          <i class="fa-solid fa-shield-halved text-[9px]"></i> Admin
        </button>
      `;
      container.innerHTML = html;

      // Rebind click listeners to chips
      container.querySelectorAll('.pic-chip-btn').forEach(chip => {
        chip.addEventListener('click', () => {
          container.querySelectorAll('.pic-chip-btn').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const u = chip.getAttribute('data-user');
          const userInput = document.getElementById('loginUsername');
          const passInput = document.getElementById('loginPassword');
          if (userInput) userInput.value = u;
          if (passInput) {
            passInput.value = '';
            passInput.focus();
          }
        });
      });
    } catch (e) {
      console.warn('Gagal memuat daftar PIC terdaftar:', e);
    }
  }

  function initAuth() {
    const savedUser = localStorage.getItem('telecom_portal_user');
    if (savedUser) {
      try {
        state.currentUser = JSON.parse(savedUser);
        hideLoginOverlay();
        applyRolePermissions(state.currentUser.role);
        return;
      } catch (e) {
        localStorage.removeItem('telecom_portal_user');
        state.currentUser = null;
      }
    }
    showLoginOverlay();
  }

  function showLoginOverlay() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'flex';
    document.getElementById('topbarUserProfile')?.classList.add('hidden');
    document.getElementById('btnLogout')?.classList.add('hidden');
    document.getElementById('btnOpenChangePassword')?.classList.add('hidden');
    document.getElementById('btnOpenAdminUsers')?.classList.add('hidden');

    // Sembunyikan SEMUA notifikasi di laman login (lonceng topbar, panel notifikasi, & floating banner)
    const bellContainer = document.getElementById('contractAlertBellContainer');
    if (bellContainer) bellContainer.style.display = 'none';
    const bellPanel = document.getElementById('contractAlertNotificationPanel');
    if (bellPanel) bellPanel.classList.add('hidden');
    const banner = document.getElementById('dailyContractAlertBanner');
    if (banner) {
      banner.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
      banner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
    }

    // Reset overlay panes to default login state
    document.getElementById('paneLogin')?.classList.remove('hidden');
    document.getElementById('paneRegister')?.classList.add('hidden');
    document.getElementById('paneForgotPassword')?.classList.add('hidden');
    document.getElementById('tabModeLogin')?.classList.add('active');
    document.getElementById('tabModeRegister')?.classList.remove('active');
    document.getElementById('loginErrorAlert')?.classList.add('hidden');
    document.getElementById('loginSuccessAlert')?.classList.add('hidden');
  }

  function hideLoginOverlay() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
    document.getElementById('topbarUserProfile')?.classList.remove('hidden');
    document.getElementById('btnLogout')?.classList.remove('hidden');
    document.getElementById('btnOpenChangePassword')?.classList.remove('hidden');
    
    // Update status email pemulihan akun di menu profil
    updateUserEmailBadges();

    // 'Kelola Akun' hanya untuk admin
    const currentUser = state.currentUser || JSON.parse(localStorage.getItem('telecom_portal_user') || '{}');
    if (currentUser.role === 'admin') {
      document.getElementById('btnOpenAdminUsers')?.classList.remove('hidden');
      setTimeout(() => { window.checkAdminPendingUsersBadge?.(); }, 1000);
    } else {
      document.getElementById('btnOpenAdminUsers')?.classList.add('hidden');
    }
  }

  function updateUserEmailBadges() {
    try {
      const missingBadge = document.getElementById('myEmailMissingBadge');
      const desc = document.getElementById('myEmailDesc');
      const email = state.currentUser?.email;
      if (!email) {
        if (missingBadge) missingBadge.classList.remove('hidden');
        if (desc) desc.textContent = 'Email belum terdaftar - Tambahkan sekarang';
      } else {
        if (missingBadge) missingBadge.classList.add('hidden');
        if (desc) desc.textContent = email;
      }
    } catch (e) {
      console.warn('updateUserEmailBadges notice:', e);
    }
  }

  function applyRolePermissions(role) {
    const isLapangan = role === 'lapangan';
    const isSales = role === 'sales';
    const isAdmin = role === 'admin';

    // Update status email pemulihan akun di menu profil
    updateUserEmailBadges();

    // Update Executive Greeting with user's name
    const greetingNameEl = document.getElementById('execGreetingName');
    if (greetingNameEl) {
      const rawUser = state.currentUser?.full_name || state.currentUser?.username || 'Administrator';
      greetingNameEl.textContent = rawUser.replace(/\s*\([^)]*\)/g, '').trim();
    }

    // 0. Toggle role classes on document.body for global CSS RBAC
    document.body.classList.remove('role-lapangan', 'role-admin', 'role-sales');
    if (isLapangan) {
      document.body.classList.add('role-lapangan');
      state.myTasksOnlySitac = true;
      state.myTasksOnlyGangguan = true;
    } else if (isSales) {
      document.body.classList.add('role-sales');
      state.myTasksOnlySitac = false;
      state.myTasksOnlyGangguan = false;
      state.sitac.pic = 'ALL';
      if (state.activeView === 'view-sitac-pa' || state.activeView === 'view-gangguan' || state.activeView === 'view-pic-matrix' || state.activeView === 'view-efisiensi') {
        switchView('view-executive');
      }
    } else {
      document.body.classList.add('role-admin');
      state.myTasksOnlySitac = false;
      state.myTasksOnlyGangguan = false;
      state.sitac.pic = 'ALL';
    }

    // 1. Update Topbar User Profile Badge & PIC Sync
    const nameDisplay = document.getElementById('userNameDisplay');
    const roleDisplay = document.getElementById('userRoleDisplay');
    const avatarIcon = document.getElementById('userRoleIcon');
    const avatarBox = document.getElementById('userRoleAvatar');

    const sidebarName = document.getElementById('sidebarUserNameDisplay');
    const sidebarRole = document.getElementById('sidebarUserRoleDisplay');
    const sidebarAvatarIcon = document.getElementById('sidebarUserRoleIcon');
    const sidebarAvatarBox = document.getElementById('sidebarUserRoleAvatar');

    if (nameDisplay || sidebarName) {
      const defaultTitle = isLapangan ? 'Tim Lapangan' : (isSales ? 'Tim Sales' : 'Administrator');
      const rawName = state.currentUser?.full_name || defaultTitle;
      // Strip parenthetical text like "(Manajemen)" to display cleanly without overflow
      const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
      const roleLabel = isLapangan ? 'Lapangan' : (isSales ? 'Sales' : 'Admin');
      if (nameDisplay) {
        nameDisplay.textContent = cleanName;
        nameDisplay.title = `${rawName} (${roleLabel})`;
      }
      if (sidebarName) {
        sidebarName.textContent = cleanName;
        sidebarName.title = `${rawName} (${roleLabel})`;
      }
    }
    if (roleDisplay || sidebarRole) {
      let roleText = 'ADMIN';
      let roleClass = 'text-[8px] uppercase tracking-wider text-cyan-400 font-semibold leading-none mt-0.5';
      if (isLapangan) {
        roleText = (state.currentUser?.pic_code || state.activeTechnician ? `PIC: ${(state.currentUser?.pic_code || state.activeTechnician).toUpperCase()}` : 'TEKNISI');
        roleClass = 'text-[8px] uppercase tracking-wider text-emerald-400 font-semibold leading-none mt-0.5';
      } else if (isSales) {
        roleText = 'SALES';
        roleClass = 'text-[8px] uppercase tracking-wider text-amber-400 font-semibold leading-none mt-0.5';
      }
      if (roleDisplay) {
        roleDisplay.textContent = roleText;
        roleDisplay.className = roleClass;
      }
      if (sidebarRole) {
        sidebarRole.textContent = roleText;
        sidebarRole.className = roleClass;
      }
      const dropdownRole = document.getElementById('sidebarDropdownRoleLabel');
      if (dropdownRole) {
        dropdownRole.textContent = isLapangan ? (state.currentUser?.pic_code || 'LAPANGAN').toUpperCase() : (isSales ? 'SALES' : 'ADMIN');
      }
    }
    let iconClass = 'fa-solid fa-shield-halved';
    let boxClass = 'w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
    let sidebarBoxClass = 'w-8 h-8 rounded-full flex items-center justify-center text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0';

    if (isLapangan) {
      iconClass = 'fa-solid fa-helmet-safety';
      boxClass = 'w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      sidebarBoxClass = 'w-8 h-8 rounded-full flex items-center justify-center text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0';
    } else if (isSales) {
      iconClass = 'fa-solid fa-chart-line';
      boxClass = 'w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30';
      sidebarBoxClass = 'w-8 h-8 rounded-full flex items-center justify-center text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0';
    }

    if (avatarIcon) avatarIcon.className = iconClass;
    if (sidebarAvatarIcon) sidebarAvatarIcon.className = iconClass;
    if (avatarBox) avatarBox.className = boxClass;
    if (sidebarAvatarBox) sidebarAvatarBox.className = sidebarBoxClass;

    // Sync PIC & Lock Account Identity (Mencegah gonta-ganti user seenaknya)
    const sel = document.getElementById('selectActiveTechnician');
    const lockedName = document.getElementById('lockedPicBadgeName');
    const picFilter = document.getElementById('sitacFilterPic');
    const btnSMyTasks = document.getElementById('btnSitacMyTasks');
    const btnGMyTasks = document.getElementById('btnGangguanMyTasks');

    if (isLapangan) {
      const activePic = state.currentUser?.pic_code || 'Harlan';
      const currentPicFormatted = formatPicName(state.currentUser?.full_name || state.currentUser?.pic_code || state.currentUser?.username || activePic);
      state.activeTechnician = activePic;
      state.sitac.pic = activePic;
      localStorage.setItem('telecom_active_technician', activePic);
      if (sel) {
        sel.value = activePic;
        sel.disabled = true;
      }
      if (lockedName) lockedName.textContent = `PIC: ${activePic.toUpperCase()}`;
      if (picFilter) {
        picFilter.innerHTML = `<option value="${escapeHtml(activePic)}">${escapeHtml(currentPicFormatted)}</option>`;
        picFilter.value = activePic;
        picFilter.disabled = true;
        picFilter.classList.add('filter-select-locked');
        picFilter.title = `Terkunci: Menampilkan penugasan untuk PIC ${currentPicFormatted}`;
      }
      if (btnSMyTasks) {
        btnSMyTasks.style.display = '';
        btnSMyTasks.classList.add('active');
        btnSMyTasks.style.pointerEvents = 'none';
      }
      if (btnGMyTasks) {
        btnGMyTasks.style.display = '';
        btnGMyTasks.classList.add('active');
        btnGMyTasks.style.pointerEvents = 'none';
      }
    } else if (isSales) {
      state.activeTechnician = 'Sales';
      state.myTasksOnlySitac = false;
      state.myTasksOnlyGangguan = false;
      state.sitac.pic = 'ALL';
      if (sel) {
        sel.value = 'Sales';
        sel.disabled = true;
      }
      if (lockedName) lockedName.textContent = 'SALES / KOMERSIAL';
      if (picFilter) {
        picFilter.disabled = false;
        picFilter.classList.remove('filter-select-locked');
        picFilter.title = '';
        if (state.meta.pic && (!picFilter.options || picFilter.options.length <= 1)) {
          picFilter.innerHTML = '<option value="ALL">Semua PIC SITAC</option>' +
            state.meta.pic.map(pic => `<option value="${escapeHtml(formatPicName(pic))}">${escapeHtml(formatPicName(pic))}</option>`).join('');
          picFilter.value = 'ALL';
        }
      }
      if (btnSMyTasks) {
        btnSMyTasks.style.display = 'none';
        btnSMyTasks.classList.remove('active');
        btnSMyTasks.style.pointerEvents = '';
      }
      if (btnGMyTasks) {
        btnGMyTasks.style.display = 'none';
        btnGMyTasks.classList.remove('active');
        btnGMyTasks.style.pointerEvents = '';
      }
      const sitacBadge = document.getElementById('sitacMyTasksCount');
      if (sitacBadge) sitacBadge.classList.add('hidden');
      const gangguanBadge = document.getElementById('gangguanMyTasksCount');
      if (gangguanBadge) gangguanBadge.classList.add('hidden');
    } else {
      state.activeTechnician = 'Admin';
      state.myTasksOnlySitac = false;
      state.myTasksOnlyGangguan = false;
      state.sitac.pic = 'ALL';
      if (sel) {
        sel.value = 'Admin';
        sel.disabled = false;
      }
      if (lockedName) lockedName.textContent = 'ADMIN';
      if (picFilter) {
        picFilter.disabled = false;
        picFilter.classList.remove('filter-select-locked');
        picFilter.title = '';
        if (state.meta.pic && (!picFilter.options || picFilter.options.length <= 1)) {
          picFilter.innerHTML = '<option value="ALL">Semua PIC SITAC</option>' +
            state.meta.pic.map(pic => `<option value="${escapeHtml(formatPicName(pic))}">${escapeHtml(formatPicName(pic))}</option>`).join('');
          picFilter.value = 'ALL';
        }
      }
      if (btnSMyTasks) {
        btnSMyTasks.style.display = 'none';
        btnSMyTasks.classList.remove('active');
        btnSMyTasks.style.pointerEvents = '';
      }
      if (btnGMyTasks) {
        btnGMyTasks.style.display = 'none';
        btnGMyTasks.classList.remove('active');
        btnGMyTasks.style.pointerEvents = '';
      }
      const sitacBadge = document.getElementById('sitacMyTasksCount');
      if (sitacBadge) sitacBadge.classList.add('hidden');
      const gangguanBadge = document.getElementById('gangguanMyTasksCount');
      if (gangguanBadge) gangguanBadge.classList.add('hidden');
    }

    // 2. Hide / Show Sidebar Menus
    const groupCollo = document.getElementById('groupCollo');
    const execNavWrap = document.querySelector('.nav-item[data-view="view-executive"]')?.closest('.nav-section-wrap');
    const btnNavSitacColleagues = document.getElementById('btnNavSitacColleagues');
    const btnSitacColleaguesQuick = document.getElementById('btnSitacColleaguesQuick');

    if (groupCollo) {
      groupCollo.style.display = isLapangan ? 'none' : '';
    }
    if (execNavWrap) {
      execNavWrap.style.display = isLapangan ? 'none' : '';
    }
    if (btnNavSitacColleagues) {
      btnNavSitacColleagues.style.display = isLapangan ? '' : 'none';
    }
    if (btnSitacColleaguesQuick) {
      btnSitacColleaguesQuick.style.display = isLapangan ? '' : 'none';
    }

    // 4. Role-based Notifications (Strict: Notifications appear for Admin & Sales)
    const bellContainer = document.getElementById('contractAlertBellContainer');
    const bellPanel = document.getElementById('contractAlertNotificationPanel');
    const banner = document.getElementById('dailyContractAlertBanner');

    if (role === 'admin' || role === 'sales') {
      // Admin & Sales melihat notifikasi (lonceng topbar & banner perpanjangan kontrak)
      if (bellContainer) bellContainer.style.display = '';
      updateContractAlertUI();
      checkDailyContractAlertNotification();
    } else {
      // Sembunyikan SEMUA notifikasi untuk non-admin (user PIC lapangan maupun tamu)
      if (bellContainer) bellContainer.style.display = 'none';
      if (bellPanel) bellPanel.classList.add('hidden');
      if (banner) {
        banner.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
        banner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
      }
    }

    // 5. Initial Landing View (Preserve Current Page on Refresh)
    let targetView = getSavedActiveView();

    if (isLapangan) {
      // Auto-expand groupSitac
      const groupSitac = document.getElementById('groupSitac');
      if (groupSitac && groupSitac.classList.contains('collapsed')) {
        groupSitac.classList.remove('collapsed');
      }
      // If currently on executive or collo, redirect to view-sitac-pa
      if (targetView === 'view-executive' || targetView.startsWith('view-collo-') || targetView === 'view-efisiensi') {
        targetView = 'view-sitac-pa';
      }
    } else if (isSales) {
      if (targetView === 'view-sitac-pa' || targetView === 'view-sitac-colleagues' || targetView === 'view-gangguan' || targetView === 'view-pic-matrix' || targetView === 'view-efisiensi') {
        targetView = 'view-executive';
      }
    } else if (isAdmin) {
      if (targetView === 'view-sitac-colleagues') {
        targetView = 'view-sitac-pa';
      }
    }

    switchView(targetView);
  }

  function updateMyTasksBadges() {
    try {
      const lockedBadge = document.getElementById('lockedPicBadgeName');
      if (lockedBadge) {
        if (state.activeTechnician && state.activeTechnician !== 'Admin') {
          lockedBadge.textContent = `PIC: ${state.activeTechnician.toUpperCase()}`;
        } else {
          lockedBadge.textContent = 'ADMIN';
        }
      }
    } catch (e) {
      console.warn('updateMyTasksBadges notice:', e);
    }
  }

  async function performLogin(usernameOrEmail, password) {
    const errBox = document.getElementById('loginErrorAlert');
    const errMsg = document.getElementById('loginErrorMsg');
    const submitBtn = document.getElementById('btnLoginSubmit');
    if (errBox) errBox.classList.add('hidden');

    if (!usernameOrEmail || !password) {
      if (errBox) {
        errBox.classList.remove('hidden');
        if (errMsg) errMsg.textContent = 'Username atau email dan kata sandi wajib diisi.';
      }
      showToast('Username atau email dan kata sandi wajib diisi', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> Mengautentikasi (Firebase)...';
    }

    try {
      let userObj = null;
      let token = null;

      // 1. Prioritas Utama: Autentikasi langsung ke PostgreSQL Backend jika server lokal aktif
      try {
        const pgRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usernameOrEmail, password: password })
        });
        if (pgRes.ok) {
          const pgData = await pgRes.json();
          if (pgData && pgData.success && pgData.user) {
            userObj = pgData.user;
            token = pgData.token || `pg_auth_${userObj.role}_${Date.now()}`;
            if (userObj.password_hash) {
              localStorage.setItem('telecom_admin_pw_hash', userObj.password_hash);
            }
          }
        } else if (pgRes.status === 401 || pgRes.status === 403) {
          const errData = await pgRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Password yang Anda masukkan salah. Pastikan sandi akun Anda benar.');
        }
      } catch (backendErr) {
        if (backendErr.message && !backendErr.message.includes('Failed to fetch') && !backendErr.message.includes('NetworkError') && !backendErr.message.includes('Load failed')) {
          throw backendErr;
        }
      }

      // 2. Jika server backend lokal tidak aktif, gunakan Firebase Cloud
      if (!userObj) {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) {
          throw new Error('Koneksi autentikasi belum aktif.');
        }
        userObj = await window.FirebaseManager.loginUser(usernameOrEmail, password);
        token = `fb_auth_${userObj.role}_${Date.now()}`;
      }

      state.currentUser = userObj;
      state.token = token;
      localStorage.setItem('telecom_portal_user', JSON.stringify(userObj));
      localStorage.setItem('telecom_portal_token', token);

      const resolvedPic = userObj.pic_code;
      if (resolvedPic) {
        state.activeTechnician = resolvedPic;
        localStorage.setItem('telecom_active_technician', resolvedPic);
      }

      hideLoginOverlay();
      applyRolePermissions(userObj.role);
      if (typeof updateMyTasksBadges === 'function') {
        try { updateMyTasksBadges(); } catch (badgeErr) { console.warn(badgeErr); }
      }

      const welcomeName = userObj.full_name || usernameOrEmail;
      showToast(`Selamat datang kembali, ${welcomeName}! Berhasil masuk ke portal.`, 'success');

      if (document.getElementById('loginUsername')) document.getElementById('loginUsername').value = '';
      if (document.getElementById('loginPassword')) document.getElementById('loginPassword').value = '';

    } catch (err) {
      if (errBox) {
        errBox.classList.remove('hidden');
        const isPending = err.code === 'USER_PENDING_APPROVAL' || 
                          (err.message && err.message.toLowerCase().includes('menunggu persetujuan'));

        if (isPending) {
          const targetUsername = err.pendingUser?.username || usernameOrEmail;
          const targetFullName = err.pendingUser?.fullName || targetUsername;
          const waUrl = generateAdminWhatsAppUrl(targetUsername, targetFullName);

          errBox.className = 'p-3.5 mb-3.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs shadow-lg shadow-amber-950/20';
          errBox.innerHTML = `
            <div class="flex items-start gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <i class="fa-solid fa-user-clock text-base"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-amber-300 text-xs">Akun Menunggu Persetujuan Admin</div>
                <div class="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  Akun <strong>@${escapeHtml(targetUsername)}</strong> (${escapeHtml(targetFullName)}) belum diaktifkan oleh Administrator. Silakan hubungi Admin untuk mengaktifkan akun Anda.
                </div>
                <div class="mt-3 pt-2.5 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <span class="text-[10.5px] text-slate-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-paper-plane text-[10px] text-emerald-400"></i> Konfirmasi langsung ke Admin:
                  </span>
                  <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
                    class="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition active:scale-95 whitespace-nowrap">
                    <i class="fa-brands fa-whatsapp text-sm"></i>
                    <span>Hubungi Admin via WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          `;
        } else {
          errBox.className = 'p-3 mb-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs';
          const rawMsg = err.message || 'Gagal masuk akun ke Firebase.';
          const isQuota = rawMsg.toLowerCase().includes('quota') || rawMsg.toLowerCase().includes('daily read units') || rawMsg.includes('RESOURCE_EXHAUSTED');
          const cleanMsg = isQuota
            ? 'Batas kuota harian Cloud Firebase tercapai. Silakan masuk menggunakan akun tim lokal Anda (misal: admin, harlan, budi, dll).'
            : rawMsg;
          errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> <span id="loginErrorMsg">${escapeHtml(cleanMsg)}</span>`;
        }
      }
      showToast(err.message || 'Gagal masuk akun', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-1.5"></i> Autentikasi & Masuk';
      }
    }
  }

  function performLogout() {
    localStorage.removeItem('telecom_portal_user');
    localStorage.removeItem('telecom_portal_token');
    localStorage.removeItem('telecom_portal_active_view');
    try {
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
      }
    } catch (e) {}
    state.currentUser = null;
    state.token = null;
    state.myTasksOnlySitac = false;
    state.myTasksOnlyGangguan = false;
    state.sitac.pic = 'ALL';
    document.body.classList.remove('role-lapangan', 'role-admin', 'role-sales');
    showLoginOverlay();
    showToast('Anda telah keluar dari sistem.', 'info');
  }

  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const icon = document.querySelector('#themeToggleBtn i');
    if (icon) {
      icon.className = state.theme === 'light' ? 'fa-solid fa-sun text-xs' : 'fa-solid fa-moon text-xs';
    }
  }

  async function loadMetaOptions() {
    try {
      const res = await fetch('/api/meta/options');
      if (res.ok) {
        state.meta = await res.json();
        populateFilterDropdowns();
      }
    } catch (e) {
      console.warn('Gagal memuat filter options:', e);
    }
  }

  function populateFilterDropdowns() {
    // Pengelola (deduplicated & canonicalized)
    const pSelect = document.getElementById('colloFilterPengelola');
    if (pSelect && state.meta.pengelola) {
      const normSet = new Set();
      state.meta.pengelola.forEach(p => {
        const norm = typeof normalizePengelolaName === 'function' ? normalizePengelolaName(p) : (p || '').trim();
        if (norm) normSet.add(norm);
      });
      const sorted = Array.from(normSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      pSelect.innerHTML = '<option value="ALL">Semua Pengelola</option>' + 
        sorted.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    }

    // Jenis Sewa
    const jSelect = document.getElementById('colloFilterJenis');
    if (jSelect && state.meta.jenis_sewa) {
      jSelect.innerHTML = '<option value="ALL">Semua Jenis Sewa</option>' +
        state.meta.jenis_sewa.map(j => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join('');
    }

    // PIC SITAC
    const picSelect = document.getElementById('sitacFilterPic');
    if (picSelect) {
      if (state.currentUser?.role === 'lapangan') {
        const activePic = state.currentUser?.pic_code || state.activeTechnician || 'Harlan';
        const currentPicFormatted = formatPicName(state.currentUser?.full_name || state.currentUser?.pic_code || state.currentUser?.username || activePic);
        picSelect.innerHTML = `<option value="${escapeHtml(activePic)}">${escapeHtml(currentPicFormatted)}</option>`;
        picSelect.value = activePic;
        picSelect.disabled = true;
        picSelect.classList.add('filter-select-locked');
        picSelect.title = `Terkunci: Menampilkan penugasan untuk PIC ${currentPicFormatted}`;
      } else if (state.meta.pic) {
        picSelect.disabled = false;
        picSelect.classList.remove('filter-select-locked');
        picSelect.title = '';
        picSelect.innerHTML = '<option value="ALL">Semua PIC SITAC</option>' +
          state.meta.pic.map(pic => `<option value="${escapeHtml(formatPicName(pic))}">${escapeHtml(formatPicName(pic))}</option>`).join('');
      }
    }
  }

  // --- HIGH-SPEED ON-DEMAND DYNAMIC LIBRARY LOADERS ---
  function ensureLeafletLoaded() {
    if (typeof L !== 'undefined') return Promise.resolve(window.L);
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = () => resolve(window.L);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureXlsxLoaded() {
    if (typeof XLSX !== 'undefined') return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureJsPdfLoaded() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
      s.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js';
        s2.onload = () => resolve(window.jspdf);
        s2.onerror = reject;
        document.head.appendChild(s2);
      };
      s.onerror = (err) => {
        // Fallback to jsdelivr if cdnjs fails
        const fb1 = document.createElement('script');
        fb1.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
        fb1.onload = () => {
          const fb2 = document.createElement('script');
          fb2.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js';
          fb2.onload = () => resolve(window.jspdf);
          fb2.onerror = reject;
          document.head.appendChild(fb2);
        };
        fb1.onerror = reject;
        document.head.appendChild(fb1);
      };
      document.head.appendChild(s);
    });
  }

  // --- NAVIGATION ROUTING ---
  function switchView(viewId) {
    window.switchView = switchView;
    if (viewId === 'view-gangguan') {
      viewId = 'view-sitac-pa';
    }
    // RBAC: Tim Lapangan cannot access executive, colocation views, or efisiensi
    if (state.currentUser?.role === 'lapangan' && (viewId === 'view-executive' || viewId.startsWith('view-collo-') || viewId === 'view-efisiensi')) {
      showToast('Akses dibatasi. Modul Finansial & Colocation hanya dapat diakses oleh Manajemen / Admin.', 'error');
      viewId = 'view-sitac-pa';
    }

    // RBAC: Tim Sales cannot access operational SITAC & Field modules
    if (state.currentUser?.role === 'sales' && (viewId === 'view-sitac-pa' || viewId === 'view-sitac-colleagues' || viewId === 'view-pic-matrix' || viewId === 'view-efisiensi')) {
      showToast('Akses dibatasi. Modul Operasional SITAC & Lapangan hanya untuk Tim Lapangan & Admin.', 'error');
      viewId = 'view-executive';
    }

    // RBAC: Admin tidak memerlukan view-sitac-colleagues karena sudah memiliki akses penuh di view-sitac-pa
    if (state.currentUser?.role === 'admin' && viewId === 'view-sitac-colleagues') {
      viewId = 'view-sitac-pa';
    }

    state.activeView = viewId;
    try {
      localStorage.setItem('telecom_portal_active_view', viewId);
      document.documentElement.setAttribute('data-target-view', viewId);
      const slug = getViewSlug(viewId);
      const targetHash = '#' + slug;
      if (window.location.hash !== targetHash) {
        history.replaceState(null, '', targetHash);
      }
    } catch (e) {}

    // Update active nav button
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    // Update active mobile bottom nav button
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mobile-view') === viewId);
    });

    // Auto-close mobile sidebar if open
    const mobSidebar = document.getElementById('portalSidebar');
    const mobBackdrop = document.getElementById('sidebarBackdrop');
    if (mobSidebar?.classList.contains('mobile-open')) {
      mobSidebar.classList.remove('mobile-open');
      mobBackdrop?.classList.remove('active');
    }

    // Reset scroll on content container
    const contentBody = document.querySelector('.portal-content-body');
    if (contentBody) contentBody.scrollTop = 0;

    // Toggle active view container
    document.querySelectorAll('.portal-view').forEach(view => {
      view.classList.toggle('active', view.id === viewId);
    });

    // Update topbar breadcrumbs
    const bcCat = document.getElementById('breadcrumbCategory');
    const bcTitle = document.getElementById('breadcrumbPageTitle');

    const isMobileScreen = window.innerWidth < 640;
    const metaMap = {
      'view-executive': { cat: 'Ringkasan', title: isMobileScreen ? 'Ringkasan Eksekutif' : 'Dashboard Ringkasan Eksekutif' },
      'view-collo-list': { cat: 'Colocation & Sewa Aset', title: isMobileScreen ? 'Daftar Link & Finansial' : 'Daftar Link & Finansial (Sewa Aset)' },
      'view-collo-rev-sharing': { cat: 'Colocation & Sewa Aset', title: isMobileScreen ? 'Skema Revenue Sharing' : 'Skema Revenue Sharing Mitra' },
      'view-collo-alerts': { cat: 'Colocation & Sewa Aset', title: isMobileScreen ? 'Jatuh Tempo Kontrak' : 'Monitoring Jatuh Tempo Kontrak (Alerts)' },
      'view-sitac-pa': { cat: 'Operasional SITAC & Lapangan', title: 'Monitoring Perizinan (PA)' },
      'view-sitac-colleagues': { cat: 'Operasional SITAC & Lapangan', title: isMobileScreen ? 'Monitoring Tim SITAC' : 'Monitoring Progres Perizinan Tim SITAC' },
      'view-efisiensi': { cat: 'Operasional SITAC & Lapangan', title: isMobileScreen ? 'Rekap Efisiensi Biaya' : 'Rekap Efisiensi Biaya Negosiasi' },
      'view-pic-matrix': { cat: 'Operasional SITAC & Lapangan', title: isMobileScreen ? 'Beban Kerja PIC SITAC' : 'Beban Kerja & Leaderboard PIC SITAC' },
      'view-webgis': { cat: 'Operasional SITAC & Lapangan', title: isMobileScreen ? 'Peta Sebaran WebGIS' : 'Peta Sebaran Lokasi Spasial (WebGIS)' }
    };

    if (metaMap[viewId]) {
      bcCat.textContent = metaMap[viewId].cat;
      bcTitle.textContent = metaMap[viewId].title;
    }

    // Auto-expand parent accordion group if target item is inside it
    const activeNavBtn = document.querySelector(`.nav-item[data-view="${viewId}"]`);
    const parentNavGroup = activeNavBtn?.closest('.nav-section-group');
    if (parentNavGroup && parentNavGroup.classList.contains('collapsed')) {
      parentNavGroup.classList.remove('collapsed');
    }

    // Lazy load data for view
    if (viewId === 'view-executive') loadExecutiveSummary();
    else if (viewId === 'view-collo-list') loadColloData();
    else if (viewId === 'view-collo-rev-sharing') loadRevSharingData();
    else if (viewId === 'view-collo-alerts') loadAlertsData();
    else if (viewId === 'view-sitac-pa') loadSitacData();
    else if (viewId === 'view-sitac-colleagues') {
      if (window.initColleaguesView) window.initColleaguesView();
    }
    else if (viewId === 'view-efisiensi') loadEfisiensiData();
    else if (viewId === 'view-pic-matrix') loadPicMatrixData();
    else if (viewId === 'view-webgis') {
      ensureLeafletLoaded().then(() => {
        setTimeout(() => initWebgisMap(), 50);
        setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 250);
        setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 500);
      });
    }

    // Context-Aware Topbar & Mobile Export Visibility
    updateExportMenuVisibility(viewId);

    setTimeout(() => {
      if (typeof updateAllTableScrollState === 'function') updateAllTableScrollState();
    }, 120);
    setTimeout(() => {
      if (typeof updateAllTableScrollState === 'function') updateAllTableScrollState();
    }, 350);
  }
  window.switchView = switchView;

  function updateExportMenuVisibility(viewId) {
    const exportContainer = document.getElementById('exportGroupDropdownContainer');
    const mobileExportSection = document.getElementById('mobileExportSection');
    const itemPdfTitle = document.querySelector('#btnExportCurrentModulePdf .item-title');
    const itemExcelTitle = document.querySelector('#btnExportExcel .item-title');

    // Views where data tables exist and can be exported
    const EXPORTABLE_VIEWS = [
      'view-executive',
      'view-collo-list',
      'view-collo-rev-sharing',
      'view-collo-alerts',
      'view-sitac-pa',
      'view-sitac-colleagues',
      'view-gangguan',
      'view-efisiensi',
      'view-pic-matrix'
    ];

    const canExport = EXPORTABLE_VIEWS.includes(viewId);

    if (exportContainer) {
      if (canExport) {
        exportContainer.classList.remove('hidden');
        exportContainer.style.display = '';
      } else {
        exportContainer.classList.add('hidden');
        exportContainer.style.display = 'none';
      }
    }

    if (mobileExportSection) {
      mobileExportSection.style.display = canExport ? '' : 'none';
    }

    // Dynamic label for current module export
    if (canExport && itemPdfTitle) {
      const pdfLabels = {
        'view-executive': 'Cetak Ringkasan Eksekutif PDF',
        'view-collo-list': 'Cetak Tabel Colocation PDF',
        'view-collo-rev-sharing': 'Cetak Rev Sharing PDF',
        'view-collo-alerts': 'Cetak Alert Kontrak PDF',
        'view-sitac-pa': 'Cetak Tabel SITAC PA PDF',
        'view-sitac-colleagues': 'Cetak Tim SITAC PDF',
        'view-gangguan': 'Cetak Rekap Gangguan PDF',
        'view-efisiensi': 'Cetak Rekap Efisiensi PDF',
        'view-pic-matrix': 'Cetak Beban Kerja PIC PDF'
      };
      itemPdfTitle.textContent = pdfLabels[viewId] || 'Cetak Modul Aktif PDF';
    }

    if (canExport && itemExcelTitle) {
      const excelLabels = {
        'view-executive': 'Ekspor Ringkasan (.xlsx)',
        'view-collo-list': 'Ekspor Data Colocation (.xlsx)',
        'view-collo-rev-sharing': 'Ekspor Rev Sharing (.xlsx)',
        'view-collo-alerts': 'Ekspor Alert Kontrak (.xlsx)',
        'view-sitac-pa': 'Ekspor Data SITAC (.xlsx)',
        'view-sitac-colleagues': 'Ekspor Tim SITAC (.xlsx)',
        'view-gangguan': 'Ekspor Rekap Gangguan (.xlsx)',
        'view-efisiensi': 'Ekspor Rekap Efisiensi (.xlsx)',
        'view-pic-matrix': 'Ekspor Matriks PIC (.xlsx)'
      };
      itemExcelTitle.textContent = excelLabels[viewId] || 'Ekspor Excel (.xlsx)';
    }
  }
  window.updateExportMenuVisibility = updateExportMenuVisibility;

  // =========================================================================
  // VIEW 1: EXECUTIVE OVERVIEW
  // =========================================================================
  async function loadExecutiveSummary() {
    try {
      let url = '/api/executive/summary';
      const ef = state?.execFilter || { period: 'ALL' };
      if (ef.period && ef.period !== 'ALL' && ef.period !== 'CUSTOM') {
        url += `?year=${encodeURIComponent(ef.period)}`;
      } else if (ef.period === 'CUSTOM' && ef.startDate && ef.endDate) {
        url += `?start=${encodeURIComponent(ef.startDate)}&end=${encodeURIComponent(ef.endDate)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      state.execData = data;

      // Populate Cards
      const c = data.collo || {};
      const isFilteredYear = Boolean(c.is_filtered_year);
      const activeCount = Number(c.active_count || 592);
      const totalRec = Number(c.total_records || 2233);
      const annualOps = Number(c.annual_cumulative_active || 845);

      const elPrimaryVal = document.getElementById('execActiveCollo');
      const elPrimaryLabel = document.getElementById('execActiveColloLabel');
      const elPrimarySub = document.getElementById('execActiveColloSub');
      const elSecondaryVal = document.getElementById('execColloSecondaryVal');
      const elSecondaryLabel = document.getElementById('execColloSecondaryLabel');
      const elSecondarySub = document.getElementById('execColloSecondarySub');

      if (elPrimaryVal) elPrimaryVal.textContent = activeCount.toLocaleString('id-ID');
      document.getElementById('execHistCollo').textContent = Number(totalRec - activeCount).toLocaleString('id-ID');
      document.getElementById('execDeactCollo').textContent = Number(c.deactivasi_count || 285).toLocaleString('id-ID');
      const marginEl = document.getElementById('execMarginRp');
      if (marginEl) {
        const formatted = formatRupiah(c.active_margin);
        marginEl.textContent = formatted;
        marginEl.title = formatted;
        // Smart auto-scaling font size to ensure nominal NEVER overflows card border
        if (formatted.length > 20) {
          marginEl.style.fontSize = 'clamp(1.15rem, 1.45vw, 1.55rem)';
        } else if (formatted.length > 17) {
          marginEl.style.fontSize = 'clamp(1.25rem, 1.6vw, 1.7rem)';
        } else {
          marginEl.style.fontSize = '';
        }
      }
      document.getElementById('execRevRp').textContent = formatRupiah(c.active_revenue);
      document.getElementById('execMarginPct').textContent = `${c.margin_pct}%`;

      // Contextual breakdown for Card 1 (Dual Metric: Aset Fisik vs Layanan Kontrak)
      const newWrap = document.getElementById('execColloNewWrap');
      const carryWrap = document.getElementById('execColloCarryWrap');
      const divider = document.getElementById('execColloDivider');
      const masterWrap = document.getElementById('execColloUniqueMasterWrap');
      const masterText = document.getElementById('execColloUniqueMasterText');

      if (isFilteredYear) {
        const fy = c.filtered_year || (state?.execFilter ? state.execFilter.period : '');
        if (elPrimaryLabel) elPrimaryLabel.textContent = 'Link Beroperasi';
        if (elPrimarySub) elPrimarySub.textContent = fy ? `Tahun ${fy}` : 'Periode Terpilih';

        if (elSecondaryVal) elSecondaryVal.textContent = totalRec.toLocaleString('id-ID');
        if (elSecondaryLabel) elSecondaryLabel.textContent = 'Total Terdata';
        if (elSecondarySub) elSecondarySub.textContent = 'Aktif + Non-Aktif';

        if (newWrap) newWrap.classList.remove('hidden');
        if (carryWrap) carryWrap.classList.remove('hidden');
        if (divider) divider.classList.remove('hidden');
        if (masterWrap) masterWrap.classList.add('hidden');

        const elNew = document.getElementById('execColloNewCount');
        const elCarry = document.getElementById('execColloCarryCount');
        const nAct = Number(c.new_active_count || 0);
        const cAct = Number(c.carry_over_active_count || 0);
        const nPct = activeCount > 0 ? ((nAct / activeCount) * 100).toFixed(1) : 0;
        const cPct = activeCount > 0 ? ((cAct / activeCount) * 100).toFixed(1) : 0;
        if (elNew) elNew.textContent = `${nAct.toLocaleString('id-ID')} (${nPct}%)`;
        if (elCarry) elCarry.textContent = `${cAct.toLocaleString('id-ID')} (${cPct}%)`;
      } else {
        if (elPrimaryLabel) elPrimaryLabel.textContent = 'Aset Fisik Unik';
        if (elPrimarySub) elPrimarySub.textContent = 'Titik Jaringan Riil';

        if (elSecondaryVal) elSecondaryVal.textContent = annualOps.toLocaleString('id-ID');
        if (elSecondaryLabel) elSecondaryLabel.textContent = 'Akumulasi Layanan';
        if (elSecondarySub) elSecondarySub.textContent = 'Total 2024–2026';

        if (newWrap) newWrap.classList.add('hidden');
        if (carryWrap) carryWrap.classList.add('hidden');
        if (divider) divider.classList.add('hidden');
        if (masterWrap) masterWrap.classList.remove('hidden');
        if (masterText) {
          masterText.textContent = `${activeCount.toLocaleString('id-ID')} aset fisik unik melayani ${annualOps.toLocaleString('id-ID')} siklus kontrak multi-tahun`;
        }
      }

      const s = data.sitac || {};
      const finishCount = Number(s.finish_count || 0).toLocaleString('id-ID');
      const totalPa = Number(s.total_pa || 0).toLocaleString('id-ID');
      document.getElementById('execSitacFinish').innerHTML = `${finishCount} <span class="text-xs text-slate-400 font-normal">/ ${totalPa} PA</span>`;
      document.getElementById('execSitacSavings').textContent = formatRupiah(s.total_efisiensi_rupiah || 0);

      // Update Nav Badges dynamically
      const bCollo = document.getElementById('badgeNavActiveCollo');
      if (bCollo) bCollo.textContent = Number(c.active_count || 880).toLocaleString('id-ID');
      const bRev = document.getElementById('badgeNavRevShare');
      if (bRev) bRev.textContent = Number(c.rev_sharing_count || 423).toLocaleString('id-ID');
      const bAlerts = document.getElementById('badgeNavCriticalAlerts');
      if (bAlerts) bAlerts.textContent = Number(c.critical_alerts_count ?? 36).toLocaleString('id-ID');
      const bSitac = document.getElementById('badgeNavSitac');
      if (bSitac) bSitac.textContent = Number(s.total_pa || 686).toLocaleString('id-ID');
      const bGangguan = document.getElementById('badgeNavGangguan');
      if (bGangguan) bGangguan.textContent = Number(data.gangguan?.total ?? 98).toLocaleString('id-ID');

      // Update Power BI Radial Gauges & Bento Controls
      const totalCollo = Number(c.total_records || 2243);
      const actCollo = Number(c.active_count || 880);
      const deactCollo = Number(c.deactivasi_count || 285);
      const otherCollo = Math.max(0, totalCollo - actCollo - deactCollo);
      if (document.getElementById('execHistColloTotal')) {
        document.getElementById('execHistColloTotal').textContent = totalCollo.toLocaleString('id-ID');
      }
      if (totalCollo > 0) {
        const segAct = document.getElementById('bentoColloActiveSegment');
        const segDeact = document.getElementById('bentoColloDeactSegment');
        const segOther = document.getElementById('bentoColloOtherSegment');
        const actPct = ((actCollo / totalCollo) * 100).toFixed(1);
        const deactPct = ((deactCollo / totalCollo) * 100).toFixed(1);
        const otherPct = ((otherCollo / totalCollo) * 100).toFixed(1);
        if (segAct) {
          segAct.style.width = `${actPct}%`;
          segAct.title = `Active: ${actCollo.toLocaleString('id-ID')} Link (${actPct}%)`;
        }
        if (segDeact) {
          segDeact.style.width = `${deactPct}%`;
          segDeact.title = `Deactivated: ${deactCollo.toLocaleString('id-ID')} Link (${deactPct}%)`;
        }
        if (segOther) {
          segOther.style.width = `${otherPct}%`;
          segOther.title = `Histori / Non-Aktif: ${otherCollo.toLocaleString('id-ID')} Link (${otherPct}%)`;
        }
      }

      const sitacRate = (s.total_pa > 0) ? (s.finish_count / s.total_pa * 100).toFixed(1) : 0;
      if (document.getElementById('gaugeSitacRate')) document.getElementById('gaugeSitacRate').textContent = `${sitacRate}%`;
      if (document.getElementById('gaugeSitacBar')) document.getElementById('gaugeSitacBar').style.width = `${sitacRate}%`;

      // SITAC Mini SVG Radial Ring
      const radialCirc = document.getElementById('radialSitacCircle');
      if (radialCirc) {
        const pct = Math.min(100, Math.max(0, parseFloat(sitacRate) || 0));
        const offset = (113.1 - (113.1 * pct / 100)).toFixed(1);
        radialCirc.style.strokeDashoffset = offset;
      }
      const radialTxt = document.getElementById('radialSitacPercent');
      if (radialTxt) {
        radialTxt.textContent = `${Math.round(parseFloat(sitacRate) || 0)}%`;
      }

      const savingsRate = s.efisiensi_pct || 0;
      if (document.getElementById('gaugeSavingsRate')) document.getElementById('gaugeSavingsRate').textContent = `${savingsRate}%`;
      if (document.getElementById('gaugeSavingsBar')) document.getElementById('gaugeSavingsBar').style.width = `${savingsRate}%`;

      const marginRate = c.margin_pct || 0;
      if (document.getElementById('gaugeMarginRate')) document.getElementById('gaugeMarginRate').textContent = `${marginRate}%`;
      if (document.getElementById('gaugeMarginBar')) document.getElementById('gaugeMarginBar').style.width = `${marginRate}%`;

      // Render Charts
      renderExecutiveCharts(data);

    } catch (e) {
      console.error('Failed to load executive summary:', e);
    }
  }

  function renderExecutiveCharts(data) {
    const { textColor, gridColor, makeGradient, donutBorder, donutBorderWidth } = getChartTheme();

    // ── Update Badges & Titles according to filtered period
    const ef = state?.execFilter || { period: 'ALL' };
    const periodLabel = ef.period === 'ALL' ? 'Akumulasi' :
                        ef.period === 'CUSTOM' ? `${ef.startDate || ''} - ${ef.endDate || ''}` :
                        `Tahun ${ef.period}`;

    const bTopP = document.getElementById('badgeTopPengelola');
    if (bTopP) bTopP.textContent = `Sirkuit Aktif (${(data.collo?.active_count ?? data.top_pengelola?.length ?? 0).toLocaleString('id-ID')})`;

    const bSitac = document.getElementById('badgeSitacStatus');
    if (bSitac) bSitac.textContent = `${(data.sitac?.total_pa ?? 0).toLocaleString('id-ID')} PA`;

    const bJenis = document.getElementById('badgeJenisSewa');
    if (bJenis) bJenis.textContent = `${(data.collo?.active_count ?? 0).toLocaleString('id-ID')} Active`;

    const bExp = document.getElementById('badgeExpiration');
    if (bExp) bExp.textContent = `Active (${(data.collo?.active_count ?? 0).toLocaleString('id-ID')})`;

    const bTrend = document.getElementById('badgeMonthlyTrend');
    if (bTrend) bTrend.textContent = periodLabel;

    const bEff = document.getElementById('badgeEfisiensiVisual');
    const tEff = document.getElementById('titleEfisiensiVisual');
    if (bEff) bEff.textContent = periodLabel;
    if (tEff) {
      if (ef.period && ef.period !== 'ALL' && ef.period !== 'CUSTOM') {
        tEff.textContent = `Efisiensi Negosiasi Biaya Perizinan Bulanan (${ef.period})`;
      } else {
        tEff.textContent = 'Efisiensi Negosiasi Biaya Perizinan (Awal vs Final)';
      }
    }

    // ── Shared scale defaults
    const scaleBase = (axisOverrides = {}) => ({
      grid: { color: gridColor, drawBorder: false },
      ticks: { color: textColor, font: { size: 10 }, padding: 6 },
      border: { display: false },
      ...axisOverrides
    });

    // ── Chart 1: Top Pengelola — premium horizontal bar
    const ctxPengelola = document.getElementById('chartTopPengelola')?.getContext('2d');
    if (ctxPengelola) {
      destroyChart('topPengelola');
      const topP = data.top_pengelola || [];
      charts.topPengelola = new Chart(ctxPengelola, {
        type: 'bar',
        data: {
          labels: topP.length > 0 ? topP.map(p => p.pengelola.length > 22 ? p.pengelola.slice(0, 22) + '…' : p.pengelola) : ['Tidak ada data'],
          datasets: [
            {
              label: 'Biaya Sewa Mitra',
              data: topP.length > 0 ? topP.map(p => p.total_biaya) : [0],
              backgroundColor: 'rgba(245, 158, 11, 0.85)',
              hoverBackgroundColor: 'rgba(245, 158, 11, 1)',
              borderRadius: 8,
              borderSkipped: false,
              barPercentage: 0.72,
            },
            {
              label: 'Revenue Sewa',
              data: topP.length > 0 ? topP.map(p => p.total_rev) : [0],
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
              borderRadius: 8,
              borderSkipped: false,
              barPercentage: 0.72,
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}` }
            }
          },
          scales: {
            x: { ...scaleBase({ ticks: { color: textColor, callback: v => 'Rp' + (v/1e9).toFixed(1)+'M', font:{size:9} } }) },
            y: { grid: { display: false }, border: { display: false }, ticks: { color: textColor, font: { size: 9.5 } } }
          }
        }
      });
    }

    // ── Chart 2: SITAC Status — premium doughnut with distinct status colors
    const ctxStatus = document.getElementById('chartSitacStatus')?.getContext('2d');
    if (ctxStatus) {
      destroyChart('sitacStatus');
      const s = data.sitac || {};
      const fCnt = Number(s.finish_count) || 0;
      const oCnt = Number(s.ongoing_count) || 0;
      const hCnt = Number(s.hold_count) || 0;
      const cCnt = Number(s.cancel_count) || 0;
      const totalPa = Number(s.total_pa) || (fCnt + oCnt + hCnt + cCnt) || 0;
      charts.sitacStatus = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
          labels: ['Finish', 'Ongoing', 'Hold', 'Cancel'],
          datasets: [{
            data: [fCnt, oCnt, hCnt, cCnt],
            backgroundColor: ['#0E6073', '#05C7F2', '#F2E205', '#F21D2F'],
            hoverBackgroundColor: ['#14829c', '#38d7f7', '#fff04d', '#ff5b6a'],
            borderWidth: donutBorderWidth,
            borderColor: donutBorder,
            hoverBorderColor: donutBorder,
            hoverOffset: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '74%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 10,
                boxWidth: 10,
                boxHeight: 10,
                font: { size: 11 }
              }
            },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} PA (${totalPa > 0 ? ((ctx.raw/totalPa)*100).toFixed(1) : 0}%)` } }
          }
        }
      });
    }

    // ── Chart 3: Jenis Sewa — multi-color doughnut with distinct colors
    const ctxJenis = document.getElementById('chartJenisSewa')?.getContext('2d');
    if (ctxJenis) {
      destroyChart('jenisSewa');
      const jd = data.jenis_sewa_dist || [];
      const totalCnt = jd.reduce((a, c) => a + c.cnt, 0);
      const jenisColorMap = {
        'Colocation': { bg: '#05C7F2', hover: '#38d7f7' },      // Vibrant Cyan (User Brand)
        'Cross Connect': { bg: '#8B5CF6', hover: '#a78bfa' },   // Royal Purple / Violet (Distinct from Cyan & Red)
        'Interkoneksi': { bg: '#F2E205', hover: '#fff04d' },    // Radiant Yellow (User Brand)
        'Revenue Sharing': { bg: '#F21D2F', hover: '#ff5b6a' }, // Crimson Red (User Brand)
        'Space Tower': { bg: '#F97316', hover: '#fb923c' },     // Vibrant Orange (Distinct from Yellow & Red)
        'Lainnya': { bg: '#94A3B8', hover: '#cbd5e1' }          // Slate Silver (Neutral)
      };
      const fallbackPalette = [
        { bg: '#05C7F2', hover: '#38d7f7' },
        { bg: '#8B5CF6', hover: '#a78bfa' },
        { bg: '#F2E205', hover: '#fff04d' },
        { bg: '#F21D2F', hover: '#ff5b6a' },
        { bg: '#F97316', hover: '#fb923c' },
        { bg: '#94A3B8', hover: '#cbd5e1' }
      ];
      const bgColors = jd.map((j, idx) => (jenisColorMap[j.jenis]?.bg || fallbackPalette[idx % fallbackPalette.length].bg));
      const hoverColors = jd.map((j, idx) => (jenisColorMap[j.jenis]?.hover || fallbackPalette[idx % fallbackPalette.length].hover));
      charts.jenisSewa = new Chart(ctxJenis, {
        type: 'doughnut',
        data: {
          labels: jd.map(j => j.jenis),
          datasets: [{
            data: jd.map(j => j.cnt),
            backgroundColor: bgColors,
            hoverBackgroundColor: hoverColors,
            borderWidth: donutBorderWidth,
            borderColor: donutBorder,
            hoverBorderColor: donutBorder,
            hoverOffset: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 8,
                boxWidth: 10,
                boxHeight: 10,
                font: { size: 10.5 }
              }
            },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${totalCnt > 0 ? ((ctx.raw/totalCnt)*100).toFixed(1) : 0}%)` } }
          }
        }
      });
    }

    // ── Chart 4: Expiration Donut — semantic alert colors
    const ctxExp = document.getElementById('chartExpirationDonut')?.getContext('2d');
    if (ctxExp) {
      destroyChart('expirationDonut');
      const ed = data.expiration_dist || [];
      const cMap = { CRITICAL: '#F21D2F', WARNING: '#F2E205', SAFE: '#0E6073', EXPIRED: '#8B5CF6' };
      const hMap = { CRITICAL: '#ff5b6a', WARNING: '#fff04d', SAFE: '#14829c', EXPIRED: '#a78bfa' };
      charts.expirationDonut = new Chart(ctxExp, {
        type: 'doughnut',
        data: {
          labels: ed.map(e => e.alert_category),
          datasets: [{
            data: ed.map(e => e.cnt),
            backgroundColor: ed.map(e => cMap[e.alert_category] || '#64748B'),
            hoverBackgroundColor: ed.map(e => hMap[e.alert_category] || '#94A3B8'),
            borderWidth: donutBorderWidth,
            borderColor: donutBorder,
            hoverBorderColor: donutBorder,
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 8,
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8,
                font: { size: 10.5, weight: '600' }
              }
            },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} Sirkuit` } }
          }
        }
      });
    }

    // ── Chart 5: Monthly Trend — gradient area + rounded bar
    const ctxTrend = document.getElementById('chartMonthlyTrend')?.getContext('2d');
    if (ctxTrend) {
      destroyChart('monthlyTrend');
      const trend = data.monthly_trend || [];
      const gradCyan = makeGradient(ctxTrend, '#0EA5E9', 0.5, 0.02);
      const gradEmerald = makeGradient(ctxTrend, '#10B981', 0.25, 0.01);
      const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      charts.monthlyTrend = new Chart(ctxTrend, {
        type: 'bar',
        data: {
          labels: trend.map(t => {
            const mStr = monthNames[Number(t.bulan)] || t.bulan;
            return t.tahun ? `${mStr} ${t.tahun}` : `${mStr}`;
          }),
          datasets: [
            {
              type: 'bar',
              label: 'Penugasan Masuk',
              data: trend.map(t => t.count_masuk),
              backgroundColor: gradCyan,
              hoverBackgroundColor: 'rgba(14, 165, 233, 0.95)',
              borderRadius: 7,
              borderSkipped: false,
              barPercentage: 0.65,
            },
            {
              type: 'line',
              label: 'Penyelesaian Selesai',
              data: trend.map(t => t.count_selesai),
              borderColor: '#10B981',
              backgroundColor: gradEmerald,
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#10B981',
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBorderColor: 'transparent',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'top' } },
          scales: {
            x: { ...scaleBase(), ticks: { color: textColor, font:{size:9.5} } },
            y: { ...scaleBase(), ticks: { color: textColor, precision: 0 } }
          }
        }
      });
    }

    // ── Chart 6: Efisiensi Tahunan — grouped bar with gradient
    const ctxEff = document.getElementById('chartEfisiensiTahunan')?.getContext('2d');
    if (ctxEff) {
      const el = (data.rekap_efisiensi_list || []).slice().sort((a, b) => {
        const ya = parseInt(String(a.tahun).replace(/\D/g, ''), 10) || 0;
        const yb = parseInt(String(b.tahun).replace(/\D/g, ''), 10) || 0;
        return ya - yb;
      });
      destroyChart('efisiensiTahunan');
      charts.efisiensiTahunan = new Chart(ctxEff, {
        type: 'bar',
        data: {
          labels: el.map(r => `${r.tahun}`),
          datasets: [
            {
              label: 'Pengajuan Awal',
              data: el.map(r => r.nilai_awal),
              backgroundColor: 'rgba(244, 63, 94, 0.85)',
              hoverBackgroundColor: 'rgba(244, 63, 94, 1)',
              borderRadius: 7,
              borderSkipped: false,
              barPercentage: 0.68,
            },
            {
              label: 'Realisasi Akhir',
              data: el.map(r => r.nilai_akhir),
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
              borderRadius: 7,
              borderSkipped: false,
              barPercentage: 0.68,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top' },
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}` } }
          },
          scales: {
            x: { ...scaleBase() },
            y: { ...scaleBase({ ticks: { color: textColor, callback: v => 'Rp'+(v/1e6).toFixed(0)+'Jt' } }) }
          }
        }
      });
    }
  }

  // =========================================================================
  // VIEW 2: DAFTAR LINK & FINANSIAL (MODUL A)
  // =========================================================================
  async function loadColloData() {
    const { status, jenisSewa, pengelola, search, sort, page, pageSize } = state.collo;
    const params = new URLSearchParams({
      status, jenis_sewa: jenisSewa, pengelola, search, sort, page, pageSize
    });

    try {
      const res = await fetch(`/api/collo?${params}`);
      if (!res.ok) throw new Error('Failed to fetch collo');
      const json = await res.json();
      state.collo.data = json.data;

      // Update summary bar
      document.getElementById('colloTableSummaryText').innerHTML = `Menampilkan <strong>${json.total}</strong> sirkuit (${status === 'ACTIVE' ? 'Default: ACTIVE' : status})`;
      document.getElementById('colloSumRev').textContent = formatRupiah(json.totals?.revenue);
      const otcEl = document.getElementById('colloSumOtc');
      if (otcEl) otcEl.textContent = formatRupiah(json.totals?.biaya_otc);
      const depositEl = document.getElementById('colloSumDeposit');
      if (depositEl) depositEl.textContent = formatRupiah(json.totals?.biaya_deposit);
      document.getElementById('colloSumBiaya').textContent = formatRupiah(json.totals?.biaya);
      document.getElementById('colloSumMargin').textContent = formatRupiah(json.totals?.margin);

      // Pagination info
      document.getElementById('colloPaginationInfo').textContent = `Halaman ${json.page} dari ${json.totalPages} (${json.total} data)`;
      document.getElementById('colloPrevPageBtn').disabled = json.page <= 1;
      document.getElementById('colloNextPageBtn').disabled = json.page >= json.totalPages;

      renderColloTable(json.data);

      if (!state.execData) {
        fetch('/api/executive/summary').then(r => r.json()).then(d => {
          state.execData = d;
          renderColloCharts();
        });
      } else {
        renderColloCharts();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderColloCharts() {
    if (!state.execData) return;
    const { textColor, gridColor, donutBorder, donutBorderWidth } = getChartTheme();

    // Chart Collo 1: Status Dist (Active, Non-Active, Deaktivasi)
    const ctxStat = document.getElementById('chartColloStatusDist')?.getContext('2d');
    if (ctxStat) {
      destroyChart('colloStatusDist');
      const dist = state.execData.collo_status_dist || [];
      const total = dist.reduce((acc, curr) => acc + curr.cnt, 0);
      const colorMap = { 'ACTIVE': '#05C7F2', 'NON ACTIVE': '#64748B', 'DEACTIVASI': '#F21D2F' };
      charts.colloStatusDist = new Chart(ctxStat, {
        type: 'doughnut',
        data: {
          labels: dist.map(d => d.status),
          datasets: [{
            data: dist.map(d => d.cnt),
            backgroundColor: dist.map(d => colorMap[d.status] || '#10B981'),
            borderColor: donutBorder,
            hoverBorderColor: donutBorder,
            borderWidth: donutBorderWidth,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: textColor, font: { size: 11 }, padding: 12 } },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${Number(ctx.raw).toLocaleString('id-ID')} sirkuit (${((ctx.raw / (total || 3123)) * 100).toFixed(1)}%)`
              }
            }
          },
          cutout: '68%'
        }
      });
    }

    // Chart Collo 2: Top 8 Vendors
    const ctxVendors = document.getElementById('chartColloTopVendors')?.getContext('2d');
    if (ctxVendors) {
      destroyChart('colloTopVendors');
      const vendors = state.execData.top_collo_vendors || [];
      charts.colloTopVendors = new Chart(ctxVendors, {
        type: 'bar',
        data: {
          labels: vendors.map(v => v.pengelola.length > 18 ? v.pengelola.slice(0, 18) + '...' : v.pengelola),
          datasets: [{
            label: 'Jumlah Sirkuit Aktif',
            data: vendors.map(v => v.sirkuit_count),
            backgroundColor: 'rgba(14, 165, 233, 0.85)',
            hoverBackgroundColor: 'rgba(14, 165, 233, 1)',
            borderRadius: 8
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, precision: 0 } },
            y: { grid: { display: false }, border: { display: false }, ticks: { color: textColor, font: { size: 10 } } }
          }
        }
      });
    }
  }

  function renderColloTable(records) {
    const tbody = document.getElementById('colloTableBody');
    if (!tbody) return;

    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="14" class="text-center py-10 text-slate-500">Tidak ada sirkuit yang sesuai filter.</td></tr>`;
      return;
    }

    const rowspanMap = computeRowspanMap(records, 'pengelola');

    let html = '';
    records.forEach((c, idx) => {
      const rowIdx = (state.collo.page - 1) * state.collo.pageSize + idx + 1;

      // Smart merged cell for Pengelola / Rekanan
      let pengelolaTd = '';
      if (rowspanMap[idx] > 0) {
        const span = rowspanMap[idx];
        const spanAttr = span > 1 ? ` rowspan="${span}"` : '';
        const isMerged = span > 1;
        pengelolaTd = `
          <td${spanAttr} class="${isMerged ? 'cell-merged align-middle' : ''}">
            <strong class="text-slate-100 block">${escapeHtml(c.pengelola || '-')}</strong>
          </td>
        `;
      }

      html += `
        <tr>
          <td class="font-mono text-xs text-slate-500">${rowIdx}</td>
          ${pengelolaTd}
          <td>${formatPelangganCell(c.pelanggan)}</td>
          <td>${formatSoCell(c.sid, c.no_so)}</td>
          <td>${formatSiteCell(c.site, c.alamat_pengelola)}</td>
          <td>${formatLocationCell(c.originating, c.terminating, c.alamat_pengelola, c.site)}</td>
          <td><span class="badge-pill bg-slate-800 text-slate-300">${escapeHtml(c.jenis_sewa || 'Colocation')}</span></td>
          <td class="text-right font-mono font-bold text-emerald-400">${formatRupiah(c.rev_sewa_tahun)}</td>
          <td class="text-right font-mono text-purple-400 font-semibold">${c.biaya_otc > 0 ? formatRupiah(c.biaya_otc) : '<span class="text-slate-600">-</span>'}</td>
          <td class="text-right font-mono text-blue-400 font-semibold">${c.biaya_deposit > 0 ? formatRupiah(c.biaya_deposit) : '<span class="text-slate-600">-</span>'}</td>
          <td class="text-right font-mono text-amber-400">${formatRupiah(c.biaya_sewa_tahun)}</td>
          <td class="text-right font-mono font-bold text-cyan-400">${formatRupiah(c.margin_rupiah)} <span class="text-[10px] text-slate-500">(${c.margin_persen}%)</span></td>
          <td class="text-center">${getStatusBadge(c.status)}</td>
          <td class="text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button class="btn-action btn-wa-dispatch text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40" data-type="collo" data-id="${c.id}" title="Kirim Info WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></button>
              <button class="btn-action btn-view-detail" data-type="collo" data-id="${c.id}" title="Lihat Detail"><i class="fa-solid fa-eye text-cyan-400"></i></button>
              <button class="btn-action btn-quick-edit" data-type="collo" data-id="${c.id}" title="Edit Data Sirkuit"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn-action btn-delete-row text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40" data-type="collo" data-id="${c.id}" title="Hapus Data"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
    if (typeof updateAllTableScrollState === 'function') {
      setTimeout(updateAllTableScrollState, 50);
    }
  }

  // =========================================================================
  // TABLE HORIZONTAL SCROLL NAVIGATION (FLOATING ARROWS & CONTROLS)
  // =========================================================================
  let tableScrollNavInitialized = false;

  function updateAllTableScrollState() {
    const cards = document.querySelectorAll('.table-container-card');
    cards.forEach(card => {
      const wrapper = card.querySelector('.overflow-x-auto');
      if (!wrapper) return;

      const leftBtn = card.querySelector('.table-floating-arrow.left');
      const rightBtn = card.querySelector('.table-floating-arrow.right');
      const fadeLeft = card.querySelector('.table-scroll-fade.left');
      const fadeRight = card.querySelector('.table-scroll-fade.right');

      if (!leftBtn || !rightBtn) return;

      const wrapperTop = wrapper.offsetTop || 0;
      const wrapperHeight = wrapper.offsetHeight || 0;
      if (wrapperHeight > 0) {
        const centerY = wrapperTop + Math.round(wrapperHeight / 2);
        leftBtn.style.top = `${centerY}px`;
        rightBtn.style.top = `${centerY}px`;
        if (fadeLeft) {
          fadeLeft.style.top = `${wrapperTop}px`;
          fadeLeft.style.height = `${wrapperHeight}px`;
        }
        if (fadeRight) {
          fadeRight.style.top = `${wrapperTop}px`;
          fadeRight.style.height = `${wrapperHeight}px`;
        }
      } else {
        leftBtn.style.top = '50%';
        rightBtn.style.top = '50%';
      }

      const scrollLeft = wrapper.scrollLeft;
      const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
      const canScroll = maxScroll > 15;

      if (canScroll && scrollLeft > 15) {
        leftBtn.classList.add('visible');
        if (fadeLeft) fadeLeft.classList.add('visible');
      } else {
        leftBtn.classList.remove('visible');
        if (fadeLeft) fadeLeft.classList.remove('visible');
      }

      if (canScroll && scrollLeft < maxScroll - 15) {
        rightBtn.classList.add('visible');
        if (fadeRight) fadeRight.classList.add('visible');
      } else {
        rightBtn.classList.remove('visible');
        if (fadeRight) fadeRight.classList.remove('visible');
      }
    });
  }

  function initTableScrollNavigation() {
    const cards = document.querySelectorAll('.table-container-card');
    cards.forEach(card => {
      const wrapper = card.querySelector('.overflow-x-auto');
      if (!wrapper) return;

      card.style.position = 'relative';

      // Check or inject left/right floating arrows if not present
      let leftBtn = card.querySelector('.table-floating-arrow.left');
      let rightBtn = card.querySelector('.table-floating-arrow.right');
      let fadeLeft = card.querySelector('.table-scroll-fade.left');
      let fadeRight = card.querySelector('.table-scroll-fade.right');

      if (!leftBtn) {
        leftBtn = document.createElement('button');
        leftBtn.type = 'button';
        leftBtn.className = 'table-floating-arrow left';
        leftBtn.setAttribute('aria-label', 'Geser tabel ke kiri');
        leftBtn.setAttribute('title', 'Geser ke kolom kiri (klik/tahan atau Shift + Scroll)');
        leftBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        card.appendChild(leftBtn);
      }

      if (!rightBtn) {
        rightBtn = document.createElement('button');
        rightBtn.type = 'button';
        rightBtn.className = 'table-floating-arrow right attention';
        rightBtn.setAttribute('aria-label', 'Geser tabel ke kanan');
        rightBtn.setAttribute('title', 'Geser ke kolom kanan (klik/tahan atau Shift + Scroll)');
        rightBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        card.appendChild(rightBtn);
      }

      if (!fadeLeft) {
        fadeLeft = document.createElement('div');
        fadeLeft.className = 'table-scroll-fade left';
        card.appendChild(fadeLeft);
      }
      if (!fadeRight) {
        fadeRight = document.createElement('div');
        fadeRight.className = 'table-scroll-fade right';
        card.appendChild(fadeRight);
      }

      if (card.hasAttribute('data-scroll-nav-bound')) {
        return;
      }
      card.setAttribute('data-scroll-nav-bound', 'true');

      // Scroll hold / click helper
      const scrollStep = 420;
      function setupScrollHold(btn, direction) {
        let holdTimer = null;
        let holdInterval = null;
        let didHold = false;

        const doScroll = () => {
          if (direction > 0 && rightBtn) rightBtn.classList.remove('attention');
          wrapper.scrollBy({ left: direction * scrollStep, behavior: 'smooth' });
        };

        btn.addEventListener('click', (e) => {
          if (!didHold) {
            doScroll();
          }
          didHold = false;
        });

        const startHold = (e) => {
          if (e.button && e.button !== 0) return;
          didHold = false;
          holdTimer = setTimeout(() => {
            didHold = true;
            if (direction > 0 && rightBtn) rightBtn.classList.remove('attention');
            holdInterval = setInterval(() => {
              wrapper.scrollBy({ left: direction * 100, behavior: 'auto' });
            }, 50);
          }, 300);
        };

        const stopHold = () => {
          clearTimeout(holdTimer);
          clearInterval(holdInterval);
        };

        btn.addEventListener('mousedown', startHold);
        btn.addEventListener('touchstart', startHold, { passive: true });
        window.addEventListener('mouseup', stopHold);
        window.addEventListener('touchend', stopHold);
        btn.addEventListener('mouseleave', stopHold);
      }

      setupScrollHold(leftBtn, -1);
      setupScrollHold(rightBtn, 1);

      wrapper.addEventListener('scroll', updateAllTableScrollState, { passive: true });
    });

    // Connect all .btn-scroll-nav elements
    document.querySelectorAll('.btn-scroll-nav').forEach(btn => {
      if (btn.hasAttribute('data-scroll-bound')) return;
      btn.setAttribute('data-scroll-bound', 'true');
      btn.addEventListener('click', (e) => {
        const targetSel = btn.getAttribute('data-target') || '#colloTableScrollWrapper';
        const target = document.querySelector(targetSel);
        if (!target) return;
        const dir = btn.getAttribute('data-dir') === 'left' ? -1 : 1;
        target.scrollBy({ left: dir * 420, behavior: 'smooth' });
      });
    });

    if (!tableScrollNavInitialized) {
      tableScrollNavInitialized = true;
      window.addEventListener('scroll', updateAllTableScrollState, { passive: true });
      window.addEventListener('resize', updateAllTableScrollState, { passive: true });
    }

    updateAllTableScrollState();
  }

  // =========================================================================
  // VIEW 3: REVENUE SHARING (MODUL A)
  // =========================================================================
  async function loadRevSharingData() {
    try {
      const q = encodeURIComponent(state.revSharing.search);
      const res = await fetch(`/api/collo/rev-sharing?search=${q}`);
      if (!res.ok) throw new Error('Failed to load rev sharing');
      const json = await res.json();

      // Cards
      const sum = json.summary || {};
      document.getElementById('revShareTotalLinks').textContent = sum.total_links || 0;
      document.getElementById('revShareTotalRev').textContent = formatRupiah(sum.total_rev);
      document.getElementById('revShareTotalFee').textContent = formatRupiah(sum.total_sharing);
      document.getElementById('revShareAvgPct').textContent = sum.avg_pct_display || '20.0%';

      // Top Pengelola Breakdown Table
      const tbPengelola = document.getElementById('revSharePengelolaTableBody');
      if (tbPengelola) {
        let phtml = '';
        (json.top_pengelola || []).forEach(p => {
          phtml += `
            <tr>
              <td><strong>${escapeHtml(p.pengelola)}</strong></td>
              <td class="text-center font-bold text-amber-400">${p.link_count} Link</td>
              <td class="text-right font-mono text-emerald-400">${formatRupiah(p.total_rev)}</td>
              <td class="text-right font-mono font-bold text-cyan-400">${formatRupiah(p.total_sharing)}</td>
              <td class="text-center font-mono">${roundPct(p.avg_pct)}%</td>
            </tr>
          `;
        });
        tbPengelola.innerHTML = phtml;
      }

      // Detailed Links Table
      const tbLinks = document.getElementById('revShareTableBody');
      if (tbLinks) {
        const sliceData = (json.data || []).slice(0, 50);
        const rowspanMap = computeRowspanMap(sliceData, 'pengelola');
        let lhtml = '';
        sliceData.forEach((c, idx) => {
          let pengelolaTd = '';
          if (rowspanMap[idx] > 0) {
            const span = rowspanMap[idx];
            const isMerged = span > 1;
            pengelolaTd = `
              <td${span > 1 ? ` rowspan="${span}"` : ''} class="${isMerged ? 'cell-merged align-middle' : ''}">
                <strong class="text-slate-100 block">${escapeHtml(c.pengelola || '-')}</strong>
              </td>
            `;
          }
          lhtml += `
            <tr>
              <td class="text-xs text-slate-500">${idx + 1}</td>
              ${pengelolaTd}
              <td>${formatPelangganCell(c.pelanggan)}</td>
              <td>${formatSoCell(c.sid, c.no_so)}</td>
              <td>${formatLocationCell(c.originating, c.terminating, c.alamat_pengelola, c.site)}</td>
              <td class="text-right font-mono text-emerald-400">${formatRupiah(c.rev_sewa_tahun)}</td>
              <td class="text-center font-mono font-bold text-amber-400 bg-amber-500/10 rounded">${roundPct(c.rev_sharing_pct || c.rev_sharing_raw)}%</td>
              <td class="text-right font-mono font-bold text-cyan-400">${formatRupiah(c.biaya_rev_sharing)}</td>
              <td class="text-center">${getStatusBadge(c.status)}</td>
              <td class="text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <button class="btn-action btn-view-detail" data-type="collo" data-id="${c.id}" title="Lihat Detail"><i class="fa-solid fa-eye text-cyan-400"></i></button>
                  <button class="btn-action btn-quick-edit" data-type="collo" data-id="${c.id}" title="Edit Data Sirkuit"><i class="fa-solid fa-pen-to-square"></i></button>
                  <button class="btn-action btn-delete-row text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40" data-type="collo" data-id="${c.id}" title="Hapus Data"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              </td>
            </tr>
          `;
        });
        tbLinks.innerHTML = lhtml;
        if (typeof updateAllTableScrollState === 'function') {
          setTimeout(updateAllTableScrollState, 50);
        }
      }

      renderRevShareCharts(json);

    } catch (e) {
      console.error(e);
    }
  }

  function renderRevShareCharts(json) {
    const { textColor, gridColor, donutBorder, donutBorderWidth } = getChartTheme();
    const top7 = (json.top_pengelola || []).slice(0, 7);

    // Chart RevShare 1: Top Mitra Portfolio Donut
    const ctxMitra = document.getElementById('chartRevShareMitra')?.getContext('2d');
    if (ctxMitra && top7.length > 0) {
      destroyChart('revShareMitra');
      charts.revShareMitra = new Chart(ctxMitra, {
        type: 'doughnut',
        data: {
          labels: top7.map(m => m.pengelola.length > 18 ? m.pengelola.slice(0, 18) + '...' : m.pengelola),
          datasets: [{
            data: top7.map(m => m.total_rev),
            backgroundColor: ['#05C7F2', '#8B5CF6', '#F2E205', '#F21D2F', '#F97316', '#10B981', '#94A3B8'],
            hoverBackgroundColor: ['#38d7f7', '#a78bfa', '#fff04d', '#ff5b6a', '#fb923c', '#34d399', '#cbd5e1'],
            borderColor: donutBorder,
            hoverBorderColor: donutBorder,
            borderWidth: donutBorderWidth,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 6, bottom: 12, left: 8, right: 8 }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                font: { size: 11, weight: '500' },
                padding: 10,
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8,
                boxHeight: 8
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${formatRupiah(ctx.raw)}`
              }
            }
          },
          cutout: '60%'
        }
      });
    }

    // Chart RevShare 2: Revenue vs Bagi Hasil (Side-by-side)
    const ctxComp = document.getElementById('chartRevShareCompare')?.getContext('2d');
    if (ctxComp && top7.length > 0) {
      destroyChart('revShareCompare');
      charts.revShareCompare = new Chart(ctxComp, {
        type: 'bar',
        data: {
          labels: top7.map(m => m.pengelola.length > 15 ? m.pengelola.slice(0, 15) + '...' : m.pengelola),
          datasets: [
            {
              label: 'Revenue Pelanggan',
              data: top7.map(m => m.total_rev),
              backgroundColor: 'rgba(5, 199, 242, 0.85)',
              borderColor: '#05C7F2',
              borderWidth: 1.5,
              borderRadius: 6
            },
            {
              label: 'Biaya Bagi Hasil Mitra',
              data: top7.map(m => m.total_sharing),
              backgroundColor: 'rgba(242, 226, 5, 0.90)',
              borderColor: '#F2E205',
              borderWidth: 1.5,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 10, bottom: 4, left: 4, right: 4 }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: textColor,
                font: { size: 11, weight: '600' },
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8,
                boxHeight: 8,
                padding: 16
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}`
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
            y: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, callback: val => 'Rp ' + (val/1e9).toFixed(1) + 'M' } }
          }
        }
      });
    }
  }

  function roundPct(val) {
    if (val === undefined || val === null || val === '') return 0;
    const clean = String(val).replace(/%/g, '').replace(/,/g, '.').trim();
    const num = Number(clean);
    if (isNaN(num)) return 0;
    const pct = (Math.abs(num) <= 1 && num !== 0) ? num * 100 : num;
    return Math.round(pct);
  }

  // =========================================================================
  // VIEW 4: MONITORING JATUH TEMPO KONTRAK (MODUL A)
  // =========================================================================
  async function loadAlertsData() {
    const { category, search, status = 'ACTIVE' } = state.alerts;
    try {
      const res = await fetch(`/api/collo/expirations?category=${category}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error('Failed to load alerts');
      const json = await res.json();

      // Counts
      const cnt = json.counts || {};
      document.getElementById('countAlertCritical').textContent = cnt.critical || 0;
      document.getElementById('countAlertWarning').textContent = cnt.warning || 0;
      document.getElementById('countAlertSafe').textContent = cnt.safe || 0;
      document.getElementById('countAlertExpired').textContent = cnt.expired || 0;

      // Dynamically sync Nav Badge with Critical Count so it always matches accurately
      const bAlerts = document.getElementById('badgeNavCriticalAlerts');
      if (bAlerts && cnt.critical !== undefined) {
        bAlerts.textContent = Number(cnt.critical).toLocaleString('id-ID');
      }

      // Sync status select dropdown if rendered
      const statusSelect = document.getElementById('alertStatusFilter');
      if (statusSelect && statusSelect.value !== status) {
        statusSelect.value = status;
      }

      // Update Active Badge
      const statusLabel = status === 'ALL' ? 'Semua Status' : status === 'ACTIVE' ? 'Aktif' : status;
      const badgeActive = document.getElementById('badgeActiveAlertsCount');
      if (badgeActive) {
        badgeActive.textContent = `${cnt.total || (json.data || []).length} Sirkuit (${statusLabel})`;
      }

      // Table Title
      document.getElementById('alertTableTitle').textContent = `Daftar Kontrak: ${category} [${statusLabel}] (${(json.data || []).length} sirkuit)`;

      // Table Body
      const tbody = document.getElementById('alertTableBody');
      if (tbody) {
        const sliceData = (json.data || []).slice(0, 60);
        const rowspanMap = computeRowspanMap(sliceData, 'pengelola');
        let html = '';
        sliceData.forEach((c, idx) => {
          let pengelolaTd = '';
          if (rowspanMap[idx] > 0) {
            const span = rowspanMap[idx];
            const isMerged = span > 1;
            pengelolaTd = `
              <td${span > 1 ? ` rowspan="${span}"` : ''} class="${isMerged ? 'cell-merged align-middle' : ''}">
                <strong class="text-slate-100 block">${escapeHtml(c.pengelola || '-')}</strong>
              </td>
            `;
          }
          const isNonActive = c.status && c.status !== 'ACTIVE';
          html += `
            <tr class="${isNonActive ? 'opacity-75 bg-slate-900/30' : ''}">
              <td class="text-xs text-slate-500">${idx + 1}</td>
              ${pengelolaTd}
              <td>
                ${formatPelangganCell(c.pelanggan)}
                ${isNonActive ? `<span class="badge-pill bg-amber-500/20 text-amber-300 text-[10px] ml-1 font-semibold">${escapeHtml(c.status)}</span>` : ''}
              </td>
              <td>${formatSoCell(c.sid, c.no_so)}</td>
              <td>${c.end_date || '-'}</td>
              <td class="text-center font-bold font-mono">${c.sisa_hari} Hari</td>
              <td class="text-center">${getAlertBadge(c.alert_category, c.sisa_hari)}</td>
              <td class="font-mono text-xs">${escapeHtml(c.spp || c.po_baru || c.ref_spp || '-')}</td>
              <td>
                <span class="badge-pill bg-slate-800 text-slate-300 text-xs">${escapeHtml(c.proses_admin || 'Running')}</span>
              </td>
              <td><strong>${escapeHtml(c.pic_admin || '-')}</strong></td>
              <td class="text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <button class="btn-action btn-wa-dispatch text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40" data-type="collo-alert" data-id="${c.id}" title="Kirim Pengingat WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></button>
                  <button class="btn-action btn-view-detail" data-type="collo" data-id="${c.id}" title="Lihat Detail"><i class="fa-solid fa-eye text-cyan-400"></i></button>
                  <button class="btn-action btn-quick-edit" data-type="collo" data-id="${c.id}" title="Edit Data Sirkuit"><i class="fa-solid fa-pen-to-square"></i></button>
                  <button class="btn-action btn-delete-row text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40" data-type="collo" data-id="${c.id}" title="Hapus Data"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              </td>
            </tr>
          `;
        });
        tbody.innerHTML = html;
      }

      renderAlertsCharts(json);

    } catch (e) {
      console.error(e);
    }
  }

  function renderAlertsCharts(json) {
    const { textColor, gridColor, donutBorder, donutBorderWidth } = getChartTheme();
    const cnt = json.counts || {};

    // Chart Alerts 1: Category Donut
    const ctxCat = document.getElementById('chartAlertsCategoryDonut')?.getContext('2d');
    if (ctxCat) {
      destroyChart('alertsCategoryDonut');
      charts.alertsCategoryDonut = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
          labels: ['CRITICAL (<30 Hari)', 'WARNING (30-60 Hari)', 'SAFE (>60 Hari)', 'EXPIRED / Overdue'],
          datasets: [{
            data: [cnt.critical || 0, cnt.warning || 0, cnt.safe || 0, cnt.expired || 0],
            backgroundColor: ['#F21D2F', '#F2E205', '#0E6073', '#64748B'],
            hoverBackgroundColor: ['#ff5b6a', '#fff04d', '#14829c', '#94A3B8'],
            borderColor: donutBorder,
            hoverBorderColor: donutBorder,
            borderWidth: donutBorderWidth,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 6, bottom: 12, left: 8, right: 8 }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                font: { size: 11, weight: '500' },
                padding: 12,
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8,
                boxHeight: 8
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} Sirkuit`
              }
            }
          },
          cutout: '60%'
        }
      });
    }

    // Chart Alerts 2: Remaining Days Bar
    const ctxDays = document.getElementById('chartAlertsSisaHari')?.getContext('2d');
    if (ctxDays) {
      destroyChart('alertsSisaHari');
      const dist = json.distribution || (() => {
        let overdue = 0, d0_30 = 0, d31_60 = 0, d61_90 = 0, d90plus = 0;
        (json.data || []).forEach(c => {
          const d = Number(c.sisa_hari);
          if (d < 0) overdue++;
          else if (d <= 30) d0_30++;
          else if (d <= 60) d31_60++;
          else if (d <= 90) d61_90++;
          else d90plus++;
        });
        return { overdue, d0_30, d31_60, d61_90, d90plus };
      })();

      charts.alertsSisaHari = new Chart(ctxDays, {
        type: 'bar',
        data: {
          labels: ['Overdue (<0 Hari)', '0 - 30 Hari', '31 - 60 Hari', '61 - 90 Hari', '> 90 Hari'],
          datasets: [{
            label: 'Jumlah Sirkuit',
            data: [dist.overdue, dist.d0_30, dist.d31_60, dist.d61_90, dist.d90plus],
            backgroundColor: ['#64748B', '#F21D2F', '#F2E205', '#05C7F2', '#0E6073'],
            borderColor: ['#94A3B8', '#ff5b6a', '#fff04d', '#38d7f7', '#14829c'],
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 12, bottom: 4, left: 4, right: 4 }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} Sirkuit`
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, font: { size: 10, weight: '500' } } },
            y: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, precision: 0 } }
          }
        }
      });
    }
  }

  // =========================================================================
  // VIEW 5: MONITORING PERIZINAN PROYEK PA (MODUL B)
  // =========================================================================
  function syncDatePresetButtons(containerId, presetValue) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const selected = String(presetValue || 'ALL').split(',').map(s => s.trim()).filter(Boolean);
    const isAll = selected.length === 0 || selected.includes('ALL');
    container.querySelectorAll('.sitac-date-preset-btn').forEach(btn => {
      const code = btn.getAttribute('data-preset') || 'ALL';
      if (isAll) {
        btn.classList.toggle('active', code === 'ALL');
      } else {
        btn.classList.toggle('active', selected.includes(code));
      }
    });
  }

  function setupDatePresetsMultiSelect(containerId, onFilterChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const allBtn = container.querySelector('.sitac-date-preset-btn[data-preset="ALL"]');
    const specificBtns = Array.from(container.querySelectorAll('.sitac-date-preset-btn:not([data-preset="ALL"])'));

    container.querySelectorAll('.sitac-date-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const clickedPreset = btn.getAttribute('data-preset') || 'ALL';

        if (clickedPreset === 'ALL') {
          // Reset to Semua
          specificBtns.forEach(b => b.classList.remove('active'));
          allBtn?.classList.add('active');
          onFilterChange('ALL');
        } else {
          allBtn?.classList.remove('active');

          if (btn.classList.contains('active')) {
            // Already active -> toggle OFF (unselect)
            btn.classList.remove('active');
          } else {
            // Inactive -> toggle ON (multi-select)
            btn.classList.add('active');
          }

          // Check which specific preset buttons are currently active
          const activeBtns = specificBtns.filter(b => b.classList.contains('active'));
          if (activeBtns.length === 0) {
            allBtn?.classList.add('active');
            onFilterChange('ALL');
          } else {
            const joinedPresets = activeBtns.map(b => b.getAttribute('data-preset')).join(',');
            onFilterChange(joinedPresets);
          }
        }
      });
    });
  }

  function updateYearDropdownSelection(dropdownId, presets) {
    const select = document.getElementById(dropdownId);
    if (!select) return;

    // Remove any previously injected multi-option
    const existingMulti = select.querySelector('option[data-multi="true"]');
    if (existingMulti) existingMulti.remove();

    const active = String(presets || 'ALL').split(',').map(s => s.trim()).filter(Boolean);
    const years = active.filter(p => ['2024', '2025', '2026'].includes(p)).sort();

    if (active.length === 0 || active.includes('ALL')) {
      select.value = 'ALL';
    } else if (years.length === 1 && active.length === 1) {
      select.value = years[0];
    } else if (years.length > 1 && years.length === active.length) {
      // Multiple years selected: e.g. 2025, 2026
      const label = years.join(', ');
      const opt = document.createElement('option');
      opt.value = active.join(',');
      opt.setAttribute('data-multi', 'true');
      opt.textContent = `Tahun: ${label}`;
      opt.selected = true;
      select.appendChild(opt);
      select.value = active.join(',');
    } else if (active.includes('THIS_MONTH') || active.includes('LAST_MONTH')) {
      const monthLabels = active.map(p => p === 'THIS_MONTH' ? 'Bulan Ini' : p === 'LAST_MONTH' ? 'Bulan Lalu' : p);
      const opt = document.createElement('option');
      opt.value = active.join(',');
      opt.setAttribute('data-multi', 'true');
      opt.textContent = `Periode: ${monthLabels.join(', ')}`;
      opt.selected = true;
      select.appendChild(opt);
      select.value = active.join(',');
    } else {
      select.value = 'ALL';
    }
  }

  function syncRegionalTabButtons(containerId, regionValue) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const selected = String(regionValue || 'ALL').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const isAll = selected.length === 0 || selected.includes('ALL');
    container.querySelectorAll('.sitac-region-btn').forEach(btn => {
      const code = btn.getAttribute('data-region') || 'ALL';
      if (isAll) {
        btn.classList.toggle('active', code === 'ALL');
      } else {
        btn.classList.toggle('active', selected.includes(code));
      }
    });
  }

  function setupRegionalTabsMultiSelect(containerId, onFilterChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const allBtn = container.querySelector('.sitac-region-btn[data-region="ALL"]');
    const specificBtns = Array.from(container.querySelectorAll('.sitac-region-btn:not([data-region="ALL"])'));

    container.querySelectorAll('.sitac-region-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const clickedRegion = btn.getAttribute('data-region') || 'ALL';

        if (clickedRegion === 'ALL') {
          // Reset to Semua
          specificBtns.forEach(b => b.classList.remove('active'));
          allBtn?.classList.add('active');
          onFilterChange('ALL');
        } else {
          // Specific region toggle
          allBtn?.classList.remove('active');

          if (btn.classList.contains('active')) {
            // Already active -> toggle OFF (unselect)
            btn.classList.remove('active');
          } else {
            // Inactive -> toggle ON (multi-select)
            btn.classList.add('active');
          }

          // Check which specific region buttons are currently active
          const activeBtns = specificBtns.filter(b => b.classList.contains('active'));
          if (activeBtns.length === 0) {
            // If all specific regions were deactivated, fall back to "Semua"
            allBtn?.classList.add('active');
            onFilterChange('ALL');
          } else {
            const joinedCodes = activeBtns.map(b => b.getAttribute('data-region')).join(',');
            onFilterChange(joinedCodes);
          }
        }
      });
    });
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = String(dateStr).trim().substring(0, 10).split('-');
      if (parts.length === 3) {
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const mIdx = parseInt(parts[1], 10);
        return `${parseInt(parts[2], 10)} ${monthNames[mIdx] || parts[1]} ${parts[0]}`;
      }
      return dateStr;
    } catch(e) { return dateStr; }
  }

  async function loadSitacData() {
    const { status, pic, year, aging, region, search, startDate, endDate, dateField, page, pageSize, datePreset } = state.sitac;
    const isLapangan = state.currentUser?.role === 'lapangan';
    const finalPic = (isLapangan || state.myTasksOnlySitac) && state.activeTechnician && state.activeTechnician !== 'Admin'
      ? state.activeTechnician
      : pic;
    const finalRegion = region || 'ALL';
    const finalDatePreset = datePreset || 'ALL';
    const params = new URLSearchParams({
      status, pic: finalPic, year, aging, region: finalRegion, search, page, pageSize,
      startDate: startDate || '',
      endDate: endDate || '',
      dateField: dateField || 'date_dispos',
      datePreset: finalDatePreset
    });

    try {
      const res = await fetch(`/api/sitac?${params}`);
      if (!res.ok) throw new Error('Failed to load SITAC');
      const json = await res.json();
      state.sitac.data = json.data;

      // Update badge for My Tasks (Hanya untuk tim lapangan)
      const myTasksBadge = document.getElementById('sitacMyTasksCount');
      if (myTasksBadge) {
        if (state.myTasksOnlySitac && isLapangan) {
          myTasksBadge.textContent = `${json.total || 0} PA`;
          myTasksBadge.classList.remove('hidden');
        } else {
          myTasksBadge.classList.add('hidden');
        }
      }

      // Update Date Range summary text & badge
      const activeBadge = document.getElementById('sitacDateActiveBadge');
      const activeText = document.getElementById('sitacDateActiveText');
      const summaryText = document.getElementById('sitacDateSummaryText');

      if (startDate || endDate) {
        if (activeBadge) activeBadge.classList.remove('hidden');
        const sFmt = startDate ? formatDisplayDate(startDate) : 'Awal';
        const eFmt = endDate ? formatDisplayDate(endDate) : 'Sekarang';
        const fieldLabel = dateField === 'date_close' ? 'Tgl Selesai' : 'Tgl Disposisi';
        if (activeText) activeText.textContent = `${fieldLabel}: ${sFmt} s/d ${eFmt}`;
        if (summaryText) {
          const stats = (json.region_stats && json.region_stats[finalRegion]) || (json.region_stats && json.region_stats.ALL) || {};
          const bAwal = Number(stats.biaya_awal) || 0;
          const bFinal = Number(stats.biaya_final) || 0;
          const bHemat = Math.max(0, bAwal - bFinal);
          const bPct = bAwal > 0 ? (bHemat / bAwal * 100).toFixed(1) : '0';
          summaryText.innerHTML = `Periode: <b class="text-cyan-300">${sFmt} &ndash; ${eFmt}</b> &bull; Total Biaya: <b class="text-amber-300">${formatRupiah(bFinal)}</b> &bull; Efisiensi: <b class="text-emerald-300">${formatRupiah(bHemat)} (${bPct}%)</b>`;
        }
      } else {
        if (activeBadge) activeBadge.classList.add('hidden');
        if (summaryText) summaryText.textContent = '';
      }

      // Update Regional Filter Badges & KPI Stat Cards
      if (json.region_stats) {
        state.sitacRegionStats = json.region_stats;
        const rs = json.region_stats;
        const bAll = document.getElementById('badgeRegionCountAll');
        const bJakpusel = document.getElementById('badgeRegionCountJakpusel');
        const bJakutim = document.getElementById('badgeRegionCountJakutim');
        const bBodebek = document.getElementById('badgeRegionCountBodebek');
        const bJakbar = document.getElementById('badgeRegionCountJakbar');
        const bBanten = document.getElementById('badgeRegionCountBanten');
        const bTangerang = document.getElementById('badgeRegionCountTangerang');

        if (bAll) bAll.textContent = rs.ALL ? rs.ALL.count : 0;
        const bNavSitac = document.getElementById('badgeNavSitac');
        if (bNavSitac && rs.ALL) bNavSitac.textContent = Number(rs.ALL.count).toLocaleString('id-ID');
        if (bJakpusel) bJakpusel.textContent = rs.JAKPUSEL ? rs.JAKPUSEL.count : 0;
        if (bJakutim) bJakutim.textContent = rs.JAKUTIM ? rs.JAKUTIM.count : 0;
        if (bBodebek) bBodebek.textContent = rs.BODEBEK ? rs.BODEBEK.count : 0;
        if (bJakbar) bJakbar.textContent = rs.JAKBAR ? rs.JAKBAR.count : 0;
        if (bBanten) bBanten.textContent = rs.BANTEN ? rs.BANTEN.count : 0;
        if (bTangerang) bTangerang.textContent = rs.TANGERANG ? rs.TANGERANG.count : 0;

        const curRegion = finalRegion;
        syncRegionalTabButtons('sitacRegionTabs', curRegion);
        syncDatePresetButtons('sitacDatePresets', finalDatePreset);
        updateYearDropdownSelection('sitacFilterYear', finalDatePreset);

        const selectedList = String(curRegion).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        let stats = { count: 0, berbiaya: 0, zerocost: 0, biaya_awal: 0, biaya_final: 0, efisiensi_rupiah: 0, efisiensi_persen: 0 };
        if (selectedList.length === 0 || selectedList.includes('ALL')) {
          stats = rs.ALL || stats;
        } else if (selectedList.length === 1) {
          stats = rs[selectedList[0]] || rs.ALL || stats;
        } else {
          selectedList.forEach(code => {
            const regStat = rs[code];
            if (regStat) {
              stats.count += Number(regStat.count) || 0;
              stats.berbiaya += Number(regStat.berbiaya) || 0;
              stats.zerocost += Number(regStat.zerocost) || 0;
              stats.biaya_awal += Number(regStat.biaya_awal) || 0;
              stats.biaya_final += Number(regStat.biaya_final) || 0;
            }
          });
          const bHemat = Math.max(0, stats.biaya_awal - stats.biaya_final);
          stats.efisiensi_rupiah = bHemat;
          stats.efisiensi_persen = stats.biaya_awal > 0 ? Number((bHemat / stats.biaya_awal * 100).toFixed(1)) : 0;
        }

        const elTotal = document.getElementById('regKpiTotalPa');
        const elBerbiaya = document.getElementById('regKpiBerbiaya');
        const elZeroCost = document.getElementById('regKpiZeroCost');
        const elBiayaAwal = document.getElementById('regKpiBiayaAwal');
        const elBiayaFinal = document.getElementById('regKpiBiayaFinal');
        const elHematRupiah = document.getElementById('regKpiHematRupiah');
        const elHematPersen = document.getElementById('regKpiHematPersen');
        const elScopeDesc = document.getElementById('regKpiScopeDesc');

        const bAwal = Number(stats.biaya_awal) || 0;
        const bFinal = Number(stats.biaya_final) || 0;
        const bHemat = Math.max(0, bAwal - bFinal);
        const hematPct = bAwal > 0 ? Number((bHemat / bAwal * 100).toFixed(1)) : 0;

        if (elTotal) elTotal.textContent = stats.count;
        if (elBerbiaya) elBerbiaya.textContent = stats.berbiaya;
        if (elZeroCost) elZeroCost.textContent = stats.zerocost;
        if (elBiayaAwal) elBiayaAwal.textContent = formatRupiah(bAwal);
        if (elBiayaFinal) elBiayaFinal.textContent = formatRupiah(bFinal);
        if (elHematRupiah) elHematRupiah.textContent = formatRupiah(bHemat);
        if (elHematPersen) elHematPersen.textContent = `${hematPct}%`;

        const scopeLabels = {
          ALL: 'Seluruh Wilayah (Jabodetabek, Banten, Tangerang)',
          JAKPUSEL: 'Jakarta Pusat & Jakarta Selatan',
          JAKUTIM: 'Jakarta Utara & Jakarta Timur',
          BODEBEK: 'Bogor, Depok, dan Bekasi',
          JAKBAR: 'Jakarta Barat',
          BANTEN: 'Banten (Serang, Cilegon, Pandeglang, Lebak)',
          TANGERANG: 'Kota Tangerang, Tangerang Selatan, Kab Tangerang'
        };
        if (elScopeDesc) {
          let baseScope = 'Seluruh Wilayah (Jabodetabek, Banten, Tangerang)';
          if (selectedList.length > 0 && !selectedList.includes('ALL')) {
            baseScope = selectedList.map(code => scopeLabels[code] || code).join(' + ');
          }

          const activePresets = String(finalDatePreset).split(',').map(p => p.trim()).filter(Boolean);
          let dateScopeText = '';
          if (activePresets.length > 0 && !activePresets.includes('ALL')) {
            const presetLabels = {
              THIS_MONTH: 'Bulan Ini',
              LAST_MONTH: 'Bulan Lalu',
              2026: '2026',
              2025: '2025',
              2024: '2024'
            };
            dateScopeText = activePresets.map(p => presetLabels[p] || p).join(' + ');
          } else if (startDate || endDate) {
            const sFmt = startDate ? formatDisplayDate(startDate) : 'Awal';
            const eFmt = endDate ? formatDisplayDate(endDate) : 'Sekarang';
            dateScopeText = `${sFmt} - ${eFmt}`;
          }

          if (dateScopeText) {
            elScopeDesc.textContent = `${baseScope} (${dateScopeText})`;
          } else {
            elScopeDesc.textContent = baseScope;
          }
        }
      }

      // Pagination
      document.getElementById('sitacPaginationInfo').textContent = `Halaman ${json.page} dari ${json.totalPages} (${json.total} data)`;
      document.getElementById('sitacPrevPageBtn').disabled = json.page <= 1;
      document.getElementById('sitacNextPageBtn').disabled = json.page >= json.totalPages;

      const tbody = document.getElementById('sitacTableBody');
      if (tbody) {
        let html = '';
        (json.data || []).forEach((s, idx) => {
          const rowIdx = (json.page - 1) * json.pageSize + idx + 1;
          html += `
            <tr>
              <td class="font-mono text-xs text-slate-500">${rowIdx}</td>
              <td class="font-mono font-bold text-cyan-400 text-xs">${escapeHtml(s.no_pa || '-')}</td>
              <td>${formatPelangganCell(s.pelanggan)}</td>
              <td>${escapeHtml(formatPicName(s.pic_perijinan || '-'))}</td>
              <td class="max-w-[200px] truncate" title="${escapeHtml(s.terminating)}">${escapeHtml(s.terminating || '-')}</td>
              <td class="text-right font-mono col-sitac-financial">${formatRupiah(s.biaya_permintaan_awal)}</td>
              <td class="text-right font-mono font-bold text-amber-400 col-sitac-financial">${formatRupiah(s.biaya_final)}</td>
              <td class="text-right font-mono font-bold text-emerald-400 col-sitac-financial">${formatRupiah(s.efisiensi_rupiah)}</td>
              <td class="text-center">${getStatusBadge(s.progress)}</td>
              <td class="text-center">${getAgingBadge(s.durasi_hari)}</td>
              <td class="text-xs text-slate-300 font-mono whitespace-nowrap">${s.date_dispos || '-'}</td>
              <td class="text-xs text-slate-300 font-mono whitespace-nowrap">${s.date_close || '-'}</td>
              <td class="text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <button class="btn-action btn-wa-dispatch text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40" data-type="sitac" data-id="${s.id}" title="Follow Up WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></button>
                  <button class="btn-action btn-view-detail" data-type="sitac" data-id="${s.id}" title="Lihat Detail"><i class="fa-solid fa-eye text-cyan-400"></i></button>
                  <button class="btn-action btn-quick-edit" data-type="sitac" data-id="${s.id}" title="Edit Data SITAC"><i class="fa-solid fa-pen-to-square"></i></button>
                  ${state.currentUser?.role === 'admin' ? `<button class="btn-action btn-delete-row text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40" data-type="sitac" data-id="${s.id}" title="Hapus Data"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                </div>
              </td>
            </tr>
          `;
        });
        tbody.innerHTML = html;
        if (typeof updateAllTableScrollState === 'function') {
          setTimeout(updateAllTableScrollState, 50);
        }
      }

      // Update status badges on the tab buttons
      if (json.status_counts) {
        state.sitacStatusCounts = json.status_counts;
        const totalBadge = document.getElementById('sitacTotalBadge');
        const finishBadge = document.getElementById('sitacFinishBadge');
        const ongoingBadge = document.getElementById('sitacOngoingBadge');
        const holdBadge = document.getElementById('sitacHoldBadge');
        const cancelBadge = document.getElementById('sitacCancelBadge');

        if (totalBadge) totalBadge.textContent = json.status_counts.ALL ?? 686;
        if (finishBadge) finishBadge.textContent = json.status_counts.Finish ?? 0;
        if (ongoingBadge) ongoingBadge.textContent = json.status_counts.Ongoing ?? 0;
        if (holdBadge) holdBadge.textContent = json.status_counts.Hold ?? 0;
        if (cancelBadge) cancelBadge.textContent = json.status_counts.Cancel ?? 0;
      }

      if (json.aging_dist) {
        state.sitacAgingDist = json.aging_dist;
      }

      if (!state.execData) {
        fetch('/api/executive/summary').then(r => r.json()).then(d => {
          state.execData = d;
          renderSitacCharts(json.status_counts, json.aging_dist);
        });
      } else {
        renderSitacCharts(json.status_counts, json.aging_dist);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderSitacCharts(statusCounts, agingDist) {
    const { textColor, gridColor, donutBorder, donutBorderWidth } = getChartTheme();
    const currentStatus = state.sitac.status || 'ALL';

    const sc = statusCounts || state.sitacStatusCounts || (state.execData?.sitac ? {
      Finish: state.execData.sitac.finish_count || 534,
      Ongoing: state.execData.sitac.ongoing_count || 35,
      Hold: state.execData.sitac.hold_count || 9,
      Cancel: state.execData.sitac.cancel_count || 108,
      ALL: state.execData.sitac.total_pa || 686
    } : { Finish: 534, Ongoing: 35, Hold: 9, Cancel: 108, ALL: 686 });

    const ag = agingDist || state.sitacAgingDist || (state.execData?.sitac_aging_dist || { green: 173, yellow: 82, red: 179 });

    // Chart SITAC 1: SLA Aging Bar Chart (Reflects Filter)
    const ctxAging = document.getElementById('chartSitacAging')?.getContext('2d');
    const agingBadge = document.getElementById('sitacAgingChartBadge');
    if (ctxAging) {
      destroyChart('sitacAging');
      if (agingBadge) {
        agingBadge.textContent = currentStatus === 'ALL' ? 'Durasi Hari' : `Durasi (${currentStatus})`;
      }
      charts.sitacAging = new Chart(ctxAging, {
        type: 'bar',
        data: {
          labels: ['Aman (<= 7 Hari)', 'Perhatian (8 - 14 Hari)', 'Kritis (> 14 Hari)'],
          datasets: [{
            label: `Penugasan PA ${currentStatus !== 'ALL' ? '(' + currentStatus + ')' : ''}`,
            data: [ag.green || 0, ag.yellow || 0, ag.red || 0],
            backgroundColor: ['#0E6073', '#F2E205', '#F21D2F'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label || 'Jumlah'}: ${ctx.raw} PA`
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, precision: 0 } }
          }
        }
      });
    }

    // Chart SITAC 2: Status Breakdown Donut Chart (HANYA status yang dipilih yang tampil)
    const ctxStatDetail = document.getElementById('chartSitacStatusDetail')?.getContext('2d');
    const statusBadge = document.getElementById('sitacChartTotalBadge');
    if (ctxStatDetail) {
      destroyChart('sitacStatusDetail');

      let labels = [];
      let data = [];
      let bgColors = [];

      if (currentStatus === 'ALL') {
        labels = ['Finish', 'Ongoing', 'Hold', 'Cancel'];
        data = [sc.Finish || 0, sc.Ongoing || 0, sc.Hold || 0, sc.Cancel || 0];
        bgColors = ['#0E6073', '#05C7F2', '#F2E205', '#F21D2F'];
        if (statusBadge) {
          statusBadge.textContent = `Total ${sc.ALL || 686} PA`;
          statusBadge.className = 'pbi-visual-badge';
        }
      } else if (currentStatus === 'Finish') {
        labels = ['Finish'];
        data = [sc.Finish || 0];
        bgColors = ['#0E6073'];
        if (statusBadge) {
          statusBadge.textContent = `Finish: ${sc.Finish || 0} PA`;
          statusBadge.className = 'pbi-visual-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        }
      } else if (currentStatus === 'Ongoing') {
        labels = ['Ongoing'];
        data = [sc.Ongoing || 0];
        bgColors = ['#05C7F2'];
        if (statusBadge) {
          statusBadge.textContent = `Ongoing: ${sc.Ongoing || 0} PA`;
          statusBadge.className = 'pbi-visual-badge bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
        }
      } else if (currentStatus === 'Hold') {
        labels = ['Hold'];
        data = [sc.Hold || 0];
        bgColors = ['#F2E205'];
        if (statusBadge) {
          statusBadge.textContent = `Hold: ${sc.Hold || 0} PA`;
          statusBadge.className = 'pbi-visual-badge bg-amber-500/20 text-amber-400 border border-amber-500/30';
        }
      } else if (currentStatus === 'Cancel') {
        labels = ['Cancel'];
        data = [sc.Cancel || 0];
        bgColors = ['#F21D2F'];
        if (statusBadge) {
          statusBadge.textContent = `Cancel: ${sc.Cancel || 0} PA`;
          statusBadge.className = 'pbi-visual-badge bg-rose-500/20 text-rose-400 border border-rose-500/30';
        }
      }

      const totalFiltered = data.reduce((a, b) => a + b, 0);

      charts.sitacStatusDetail = new Chart(ctxStatDetail, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: bgColors,
            borderColor: donutBorder,
            borderWidth: donutBorderWidth,
            hoverBorderColor: donutBorder,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                font: { size: 11, family: 'Outfit, sans-serif' },
                padding: 12
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} PA (${totalFiltered > 0 ? ((ctx.raw / totalFiltered) * 100).toFixed(1) : 0}%)`
              }
            }
          },
          cutout: '68%',
          onClick: (evt, activeEls) => {
            if (currentStatus !== 'ALL') {
              const allBtn = document.querySelector('.sitac-tab-btn[data-status="ALL"]');
              if (allBtn) allBtn.click();
            } else if (activeEls && activeEls.length > 0) {
              const idx = activeEls[0].index;
              const clickedStatus = labels[idx];
              if (clickedStatus) {
                const targetBtn = document.querySelector(`.sitac-tab-btn[data-status="${clickedStatus}"]`);
                if (targetBtn) targetBtn.click();
              }
            }
          }
        }
      });
    }
  }

  // =========================================================================
  // VIEW 5.5: MONITORING TIM SITAC (RUANG KOORDINASI PIC SITAC LAPANGAN - READ ONLY)
  // =========================================================================
  let colleaguesEventsBound = false;

  function populateColleaguesPicDropdown() {
    const picSelect = document.getElementById('colleaguesFilterPic');
    if (!picSelect || picSelect.options.length > 1) return;
    const records = window.SITAC_COLLO_DATA?.sitac_records || [];
    const picSet = new Set();
    records.forEach(r => {
      const p = (r.pic_perijinan || '').trim();
      if (p && !p.toLowerCase().includes('all') && !p.toLowerCase().includes('null') && !p.toLowerCase().includes('none')) {
        picSet.add(formatPicName(p));
      }
    });
    const sortedPics = Array.from(picSet).sort((a, b) => a.localeCompare(b));
    sortedPics.forEach(pic => {
      const opt = document.createElement('option');
      opt.value = pic;
      opt.textContent = pic;
      picSelect.appendChild(opt);
    });
  }

  function scrollColleaguesTableToTop() {
    const card = document.querySelector('#view-sitac-colleagues .table-container-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function applyColleaguesDatePreset(preset) {
    state.colleagues.datePreset = preset || 'ALL';

    const selected = String(preset || 'ALL').split(',').map(s => s.trim()).filter(Boolean);
    const isAll = selected.length === 0 || selected.includes('ALL');

    syncDatePresetButtons('colleaguesDatePresets', preset);
    updateYearDropdownSelection('colleaguesFilterYear', preset);

    const inpStart = document.getElementById('colleaguesStartDate');
    const inpEnd = document.getElementById('colleaguesEndDate');

    if (isAll) {
      state.colleagues.startDate = '';
      state.colleagues.endDate = '';
      state.colleagues.year = 'ALL';
      if (inpStart) inpStart.value = '';
      if (inpEnd) inpEnd.value = '';
    } else if (selected.length === 1) {
      const p = selected[0];
      const today = new Date();
      const curYear = today.getFullYear();
      const curMonth = today.getMonth();
      let start = '', end = '';

      if (p === 'THIS_MONTH') {
        start = new Date(curYear, curMonth, 1).toISOString().slice(0, 10);
        end = new Date(curYear, curMonth + 1, 0).toISOString().slice(0, 10);
      } else if (p === 'LAST_MONTH') {
        start = new Date(curYear, curMonth - 1, 1).toISOString().slice(0, 10);
        end = new Date(curYear, curMonth, 0).toISOString().slice(0, 10);
      } else if (['2024', '2025', '2026'].includes(p)) {
        start = `${p}-01-01`;
        end = `${p}-12-31`;
      }

      state.colleagues.startDate = start;
      state.colleagues.endDate = end;
      if (['2024', '2025', '2026'].includes(p)) {
        state.colleagues.year = p;
      } else {
        state.colleagues.year = 'ALL';
      }
      if (inpStart) inpStart.value = start;
      if (inpEnd) inpEnd.value = end;
    } else {
      // Multiple presets selected (e.g. '2025,2026' or 'THIS_MONTH,LAST_MONTH')
      state.colleagues.startDate = '';
      state.colleagues.endDate = '';
      state.colleagues.year = 'ALL';
      if (inpStart) inpStart.value = '';
      if (inpEnd) inpEnd.value = '';
    }

    state.colleagues.page = 1;
    scrollColleaguesTableToTop();
    loadColleaguesData();
  }

  async function loadColleaguesData() {
    if (!state.colleagues) return;
    const { status, pic, year, aging, region, search, startDate, endDate, dateField, page, pageSize, datePreset } = state.colleagues;
    const finalRegion = region || 'ALL';
    const finalDatePreset = datePreset || 'ALL';
    const params = new URLSearchParams({
      all_team: '1',
      status: status || 'ALL',
      pic: pic || 'ALL',
      year: year || 'ALL',
      aging: aging || 'ALL',
      region: finalRegion,
      search: search || '',
      page: page || 1,
      pageSize: pageSize || 25,
      startDate: startDate || '',
      endDate: endDate || '',
      dateField: dateField || 'date_dispos',
      datePreset: finalDatePreset
    });

    try {
      populateColleaguesPicDropdown();

      const res = await fetch(`/api/sitac?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load Colleagues SITAC data');
      const json = await res.json();
      state.colleagues.data = json.data || [];

      // Update Date Range summary text & active badge
      const activeBadge = document.getElementById('colleaguesDateActiveBadge');
      const activeText = document.getElementById('colleaguesDateActiveText');
      const summaryText = document.getElementById('colleaguesDateSummaryText');

      if (startDate || endDate) {
        if (activeBadge) activeBadge.classList.remove('hidden');
        const sFmt = startDate ? formatDisplayDate(startDate) : 'Awal';
        const eFmt = endDate ? formatDisplayDate(endDate) : 'Sekarang';
        const fieldLabel = dateField === 'date_close' ? 'Tgl Selesai' : 'Tgl Disposisi';
        if (activeText) activeText.textContent = `${fieldLabel}: ${sFmt} s/d ${eFmt}`;
        if (summaryText) {
          const stats = (json.region_stats && json.region_stats[finalRegion]) || (json.region_stats && json.region_stats.ALL) || {};
          const bAwal = Number(stats.biaya_awal) || 0;
          const bFinal = Number(stats.biaya_final) || 0;
          const bHemat = Math.max(0, bAwal - bFinal);
          const bPct = bAwal > 0 ? (bHemat / bAwal * 100).toFixed(1) : '0';
          summaryText.innerHTML = `Periode: <b class="text-cyan-300">${sFmt} &ndash; ${eFmt}</b> &bull; Total Biaya: <b class="text-amber-300">${formatRupiah(bFinal)}</b> &bull; Efisiensi: <b class="text-emerald-300">${formatRupiah(bHemat)} (${bPct}%)</b>`;
        }
      } else {
        if (activeBadge) activeBadge.classList.add('hidden');
        if (summaryText) summaryText.textContent = '';
      }

      // Update Regional Filter Badges & KPI Stat Cards
      if (json.region_stats) {
        state.colleaguesRegionStats = json.region_stats;
        const rs = json.region_stats;
        const bAll = document.getElementById('badgeColleaguesRegionAll');
        const bJakpusel = document.getElementById('badgeColleaguesRegionJakpusel');
        const bJakutim = document.getElementById('badgeColleaguesRegionJakutim');
        const bBodebek = document.getElementById('badgeColleaguesRegionBodebek');
        const bJakbar = document.getElementById('badgeColleaguesRegionJakbar');
        const bBanten = document.getElementById('badgeColleaguesRegionBanten');
        const bTangerang = document.getElementById('badgeColleaguesRegionTangerang');

        if (bAll) bAll.textContent = rs.ALL ? rs.ALL.count : 0;
        if (bJakpusel) bJakpusel.textContent = rs.JAKPUSEL ? rs.JAKPUSEL.count : 0;
        if (bJakutim) bJakutim.textContent = rs.JAKUTIM ? rs.JAKUTIM.count : 0;
        if (bBodebek) bBodebek.textContent = rs.BODEBEK ? rs.BODEBEK.count : 0;
        if (bJakbar) bJakbar.textContent = rs.JAKBAR ? rs.JAKBAR.count : 0;
        if (bBanten) bBanten.textContent = rs.BANTEN ? rs.BANTEN.count : 0;
        if (bTangerang) bTangerang.textContent = rs.TANGERANG ? rs.TANGERANG.count : 0;

        const curRegion = finalRegion;
        syncRegionalTabButtons('colleaguesRegionTabs', curRegion);
        syncDatePresetButtons('colleaguesDatePresets', finalDatePreset);
        updateYearDropdownSelection('colleaguesFilterYear', finalDatePreset);

        const selectedList = String(curRegion).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        let stats = { count: 0, berbiaya: 0, zerocost: 0, biaya_awal: 0, biaya_final: 0, efisiensi_rupiah: 0, efisiensi_persen: 0 };
        if (selectedList.length === 0 || selectedList.includes('ALL')) {
          stats = rs.ALL || stats;
        } else if (selectedList.length === 1) {
          stats = rs[selectedList[0]] || rs.ALL || stats;
        } else {
          selectedList.forEach(code => {
            const regStat = rs[code];
            if (regStat) {
              stats.count += Number(regStat.count) || 0;
              stats.berbiaya += Number(regStat.berbiaya) || 0;
              stats.zerocost += Number(regStat.zerocost) || 0;
              stats.biaya_awal += Number(regStat.biaya_awal) || 0;
              stats.biaya_final += Number(regStat.biaya_final) || 0;
            }
          });
          const bHemat = Math.max(0, stats.biaya_awal - stats.biaya_final);
          stats.efisiensi_rupiah = bHemat;
          stats.efisiensi_persen = stats.biaya_awal > 0 ? Number((bHemat / stats.biaya_awal * 100).toFixed(1)) : 0;
        }

        const elTotal = document.getElementById('regColleaguesTotalPa');
        const elBerbiaya = document.getElementById('regColleaguesBerbiaya');
        const elZeroCost = document.getElementById('regColleaguesZeroCost');
        const elBiayaAwal = document.getElementById('regColleaguesBiayaAwal');
        const elBiayaFinal = document.getElementById('regColleaguesBiayaFinal');
        const elHematRupiah = document.getElementById('regColleaguesHematRupiah');
        const elHematPersen = document.getElementById('regColleaguesHematPersen');

        const bAwal = Number(stats.biaya_awal) || 0;
        const bFinal = Number(stats.biaya_final) || 0;
        const bHemat = Math.max(0, bAwal - bFinal);
        const hematPct = bAwal > 0 ? Number((bHemat / bAwal * 100).toFixed(1)) : 0;

        if (elTotal) elTotal.textContent = stats.count;
        if (elBerbiaya) elBerbiaya.textContent = stats.berbiaya;
        if (elZeroCost) elZeroCost.textContent = stats.zerocost;
        if (elBiayaAwal) elBiayaAwal.textContent = formatRupiah(bAwal);
        if (elBiayaFinal) elBiayaFinal.textContent = formatRupiah(bFinal);
        if (elHematRupiah) elHematRupiah.textContent = formatRupiah(bHemat);
        if (elHematPersen) elHematPersen.textContent = `${hematPct}%`;
      }

      // Update Status Tab Badges
      if (json.status_counts) {
        state.colleaguesStatusCounts = json.status_counts;
        const totalBadge = document.getElementById('colleaguesTotalBadge');
        const finishBadge = document.getElementById('colleaguesFinishBadge');
        const ongoingBadge = document.getElementById('colleaguesOngoingBadge');
        const holdBadge = document.getElementById('colleaguesHoldBadge');
        const cancelBadge = document.getElementById('colleaguesCancelBadge');

        if (totalBadge) totalBadge.textContent = json.status_counts.ALL ?? 0;
        if (finishBadge) finishBadge.textContent = json.status_counts.Finish ?? 0;
        if (ongoingBadge) ongoingBadge.textContent = json.status_counts.Ongoing ?? 0;
        if (holdBadge) holdBadge.textContent = json.status_counts.Hold ?? 0;
        if (cancelBadge) cancelBadge.textContent = json.status_counts.Cancel ?? 0;
      }

      if (json.aging_dist) {
        state.colleaguesAgingDist = json.aging_dist;
      }

      // Update Main Table (Exact 13 Columns, View-Only)
      const tbody = document.getElementById('colleaguesTableBody');
      if (tbody) {
        if (!json.data || json.data.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="13" class="text-center py-10 text-slate-400">
                <i class="fa-solid fa-folder-open text-2xl mb-2 text-slate-500"></i>
                <p>Tidak ada data penugasan tim SITAC yang sesuai dengan kriteria filter.</p>
              </td>
            </tr>
          `;
        } else {
          let html = '';
          (json.data || []).forEach((s, idx) => {
            const rowIdx = (json.page - 1) * json.pageSize + idx + 1;
            html += `
              <tr class="hover:bg-slate-800/40 transition-colors">
                <td class="font-mono text-xs text-slate-500">${rowIdx}</td>
                <td class="font-mono font-bold text-cyan-400 text-xs">${escapeHtml(s.no_pa || '-')}</td>
                <td>${formatPelangganCell(s.pelanggan)}</td>
                <td>
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-[11px]">
                    <i class="fa-solid fa-user text-[9px]"></i>
                    <span>${escapeHtml(formatPicName(s.pic_perijinan || '-'))}</span>
                  </span>
                </td>
                <td class="max-w-[200px] truncate" title="${escapeHtml(s.terminating)}">${escapeHtml(s.terminating || '-')}</td>
                <td class="text-right font-mono col-sitac-financial">${formatRupiah(s.biaya_permintaan_awal)}</td>
                <td class="text-right font-mono font-bold text-amber-400 col-sitac-financial">${formatRupiah(s.biaya_final)}</td>
                <td class="text-right font-mono font-bold text-emerald-400 col-sitac-financial">${formatRupiah(s.efisiensi_rupiah)}</td>
                <td class="text-center">${getStatusBadge(s.progress)}</td>
                <td class="text-center">${getAgingBadge(s.durasi_hari)}</td>
                <td class="text-xs text-slate-300 font-mono whitespace-nowrap">${s.date_dispos || '-'}</td>
                <td class="text-xs text-slate-300 font-mono whitespace-nowrap">${s.date_close || '-'}</td>
                <td class="text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <button class="btn-action btn-wa-dispatch text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40" data-type="sitac" data-id="${s.id}" title="Koordinasi WhatsApp"><i class="fa-brands fa-whatsapp text-sm"></i></button>
                    <button class="btn-action btn-view-detail" data-type="sitac" data-id="${s.id}" title="Lihat Detail (Read-Only)"><i class="fa-solid fa-eye text-cyan-400"></i></button>
                  </div>
                </td>
              </tr>
            `;
          });
          tbody.innerHTML = html;
        }

        if (typeof updateAllTableScrollState === 'function') {
          setTimeout(updateAllTableScrollState, 50);
        }
      }

      // Pagination Controls
      const pagInfo = document.getElementById('colleaguesPaginationInfo');
      const prevBtn = document.getElementById('colleaguesPrevPageBtn');
      const nextBtn = document.getElementById('colleaguesNextPageBtn');
      if (pagInfo) pagInfo.textContent = `Halaman ${json.page} dari ${json.totalPages} (${json.total} data)`;
      if (prevBtn) prevBtn.disabled = json.page <= 1;
      if (nextBtn) nextBtn.disabled = json.page >= json.totalPages;

      // Render Charts
      renderColleaguesCharts(json.status_counts, json.aging_dist);

    } catch (e) {
      console.error('[ColleaguesView] loadColleaguesData error:', e);
    }
  }

  function renderColleaguesCharts(statusCounts, agingDist) {
    const { textColor, gridColor, donutBorder, donutBorderWidth } = getChartTheme();
    const currentStatus = state.colleagues?.status || 'ALL';

    const sc = statusCounts || state.colleaguesStatusCounts || { Finish: 534, Ongoing: 35, Hold: 9, Cancel: 108, ALL: 686 };
    const ag = agingDist || state.colleaguesAgingDist || { green: 173, yellow: 82, red: 179 };

    // Chart 1: SLA Aging Bar Chart
    const ctxAging = document.getElementById('chartColleaguesAging')?.getContext('2d');
    const agingBadge = document.getElementById('colleaguesAgingChartBadge');
    if (ctxAging) {
      destroyChart('colleaguesAging');
      if (agingBadge) {
        agingBadge.textContent = currentStatus === 'ALL' ? 'Durasi Hari' : `Durasi (${currentStatus})`;
      }
      charts.colleaguesAging = new Chart(ctxAging, {
        type: 'bar',
        data: {
          labels: ['Aman (<= 7 Hari)', 'Perhatian (8 - 14 Hari)', 'Kritis (> 14 Hari)'],
          datasets: [{
            label: `Penugasan PA ${currentStatus !== 'ALL' ? '(' + currentStatus + ')' : ''}`,
            data: [ag.green || 0, ag.yellow || 0, ag.red || 0],
            backgroundColor: ['#0E6073', '#F2E205', '#F21D2F'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label || 'Jumlah'}: ${ctx.raw} PA`
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, precision: 0 } }
          }
        }
      });
    }

    // Chart 2: Status Breakdown Donut Chart
    const ctxStatDetail = document.getElementById('chartColleaguesStatusDetail')?.getContext('2d');
    const statusBadge = document.getElementById('colleaguesChartTotalBadge');
    if (ctxStatDetail) {
      destroyChart('colleaguesStatusDetail');

      let labels = [];
      let data = [];
      let bgColors = [];

      if (currentStatus === 'ALL') {
        labels = ['Finish', 'Ongoing', 'Hold', 'Cancel'];
        data = [sc.Finish || 0, sc.Ongoing || 0, sc.Hold || 0, sc.Cancel || 0];
        bgColors = ['#0E6073', '#05C7F2', '#F2E205', '#F21D2F'];
        if (statusBadge) {
          statusBadge.textContent = `Total ${sc.ALL || 686} PA`;
          statusBadge.className = 'pbi-visual-badge';
        }
      } else if (currentStatus === 'Finish') {
        labels = ['Finish'];
        data = [sc.Finish || 0];
        bgColors = ['#0E6073'];
        if (statusBadge) {
          statusBadge.textContent = `Finish: ${sc.Finish || 0} PA`;
          statusBadge.className = 'pbi-visual-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        }
      } else if (currentStatus === 'Ongoing') {
        labels = ['Ongoing'];
        data = [sc.Ongoing || 0];
        bgColors = ['#05C7F2'];
        if (statusBadge) {
          statusBadge.textContent = `Ongoing: ${sc.Ongoing || 0} PA`;
          statusBadge.className = 'pbi-visual-badge bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
        }
      } else if (currentStatus === 'Hold') {
        labels = ['Hold'];
        data = [sc.Hold || 0];
        bgColors = ['#F2E205'];
        if (statusBadge) {
          statusBadge.textContent = `Hold: ${sc.Hold || 0} PA`;
          statusBadge.className = 'pbi-visual-badge bg-amber-500/20 text-amber-400 border border-amber-500/30';
        }
      } else if (currentStatus === 'Cancel') {
        labels = ['Cancel'];
        data = [sc.Cancel || 0];
        bgColors = ['#F21D2F'];
        if (statusBadge) {
          statusBadge.textContent = `Cancel: ${sc.Cancel || 0} PA`;
          statusBadge.className = 'pbi-visual-badge bg-rose-500/20 text-rose-400 border border-rose-500/30';
        }
      }

      charts.colleaguesStatusDetail = new Chart(ctxStatDetail, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: bgColors,
            borderColor: donutBorder,
            borderWidth: donutBorderWidth,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, boxWidth: 12, padding: 12, font: { size: 11 } }
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} PA (${((ctx.raw / (sc.ALL || 1)) * 100).toFixed(1)}%)`
              }
            }
          }
        }
      });
    }
  }

  function initColleaguesView() {
    window.initColleaguesView = initColleaguesView;
    window.loadColleaguesData = loadColleaguesData;

    if (!colleaguesEventsBound) {
      colleaguesEventsBound = true;

      // Status Tabs
      document.querySelectorAll('#colleaguesStatusTabs .sitac-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#colleaguesStatusTabs .sitac-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.colleagues.status = btn.getAttribute('data-status') || 'ALL';
          state.colleagues.page = 1;
          scrollColleaguesTableToTop();
          loadColleaguesData();
        });
      });

      // Search input with debounce & clear button
      const colleaguesSearch = document.getElementById('colleaguesSearchInput');
      const btnClearColleagues = document.getElementById('btnClearColleaguesSearch');
      let searchTimer = null;
      colleaguesSearch?.addEventListener('input', (e) => {
        if (btnClearColleagues) {
          btnClearColleagues.classList.toggle('hidden', !e.target.value);
        }
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.colleagues.search = e.target.value.trim().toLowerCase();
          state.colleagues.page = 1;
          loadColleaguesData();
        }, 300);
      });
      btnClearColleagues?.addEventListener('click', () => {
        if (colleaguesSearch) {
          colleaguesSearch.value = '';
          btnClearColleagues.classList.add('hidden');
          colleaguesSearch.focus();
          state.colleagues.search = '';
          state.colleagues.page = 1;
          loadColleaguesData();
        }
      });

      // Filter PIC
      document.getElementById('colleaguesFilterPic')?.addEventListener('change', (e) => {
        state.colleagues.pic = e.target.value;
        state.colleagues.page = 1;
        scrollColleaguesTableToTop();
        loadColleaguesData();
      });

      // Filter Aging SLA
      document.getElementById('colleaguesFilterAging')?.addEventListener('change', (e) => {
        state.colleagues.aging = e.target.value;
        state.colleagues.page = 1;
        scrollColleaguesTableToTop();
        loadColleaguesData();
      });

      // Filter Year
      document.getElementById('colleaguesFilterYear')?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'ALL') {
          applyColleaguesDatePreset('ALL');
        } else if (['2024', '2025', '2026'].includes(val)) {
          applyColleaguesDatePreset(val);
        } else if (val.includes(',')) {
          applyColleaguesDatePreset(val);
        } else {
          state.colleagues.year = val;
          state.colleagues.page = 1;
          scrollColleaguesTableToTop();
          loadColleaguesData();
        }
      });

      // Regional Tabs with Multi-Select and Toggle-off
      setupRegionalTabsMultiSelect('colleaguesRegionTabs', (regionCodes) => {
        state.colleagues.region = regionCodes;
        state.colleagues.page = 1;
        scrollColleaguesTableToTop();
        loadColleaguesData();
      });

      // Date Presets with Multi-Select and Toggle-off
      setupDatePresetsMultiSelect('colleaguesDatePresets', (presetCodes) => {
        applyColleaguesDatePreset(presetCodes);
      });

      // Apply Custom Date Range
      document.getElementById('btnApplyColleaguesDate')?.addEventListener('click', () => {
        const start = document.getElementById('colleaguesStartDate')?.value || '';
        const end = document.getElementById('colleaguesEndDate')?.value || '';
        const field = document.getElementById('colleaguesDateField')?.value || 'date_dispos';

        if (start && end && start > end) {
          showToast('Tanggal mulai tidak boleh lebih besar dari tanggal akhir!', 'warning');
          return;
        }

        state.colleagues.startDate = start;
        state.colleagues.endDate = end;
        state.colleagues.dateField = field;
        state.colleagues.datePreset = (start || end) ? 'CUSTOM' : 'ALL';

        document.querySelectorAll('#colleaguesDatePresets .sitac-date-preset-btn').forEach(btn => {
          btn.classList.remove('active');
        });

        state.colleagues.page = 1;
        scrollColleaguesTableToTop();
        loadColleaguesData();
      });

      // Reset Custom Date Range
      document.getElementById('btnResetColleaguesDate')?.addEventListener('click', () => {
        applyColleaguesDatePreset('ALL');
      });

      // Quick Clear Date Badge Button
      document.getElementById('btnColleaguesQuickClearDate')?.addEventListener('click', () => {
        applyColleaguesDatePreset('ALL');
      });

      // Date Field select change
      document.getElementById('colleaguesDateField')?.addEventListener('change', (e) => {
        state.colleagues.dateField = e.target.value;
        if (state.colleagues.startDate || state.colleagues.endDate) {
          state.colleagues.page = 1;
          loadColleaguesData();
        }
      });

      // Pagination buttons
      document.getElementById('colleaguesPrevPageBtn')?.addEventListener('click', () => {
        if (state.colleagues.page > 1) {
          state.colleagues.page--;
          scrollColleaguesTableToTop();
          loadColleaguesData();
        }
      });

      document.getElementById('colleaguesNextPageBtn')?.addEventListener('click', () => {
        state.colleagues.page++;
        scrollColleaguesTableToTop();
        loadColleaguesData();
      });

      // Excel export button
      document.getElementById('btnExportColleaguesExcel')?.addEventListener('click', () => {
        exportCurrentViewExcel('colleagues');
      });

      // Mobile Charts accordion toggle
      const btnToggleCharts = document.getElementById('btnToggleColleaguesCharts');
      const containerCharts = document.getElementById('colleaguesChartsContainer');
      const labelToggle = document.getElementById('colleaguesChartsToggleLabel');
      const chevronToggle = document.getElementById('colleaguesChartsChevron');
      btnToggleCharts?.addEventListener('click', () => {
        const isHidden = containerCharts?.classList.contains('hidden');
        if (isHidden) {
          containerCharts?.classList.remove('hidden');
          containerCharts?.classList.add('grid');
          if (labelToggle) labelToggle.textContent = 'Tutup Grafik';
          if (chevronToggle) chevronToggle.style.transform = 'rotate(180deg)';
        } else {
          containerCharts?.classList.add('hidden');
          containerCharts?.classList.remove('grid');
          if (labelToggle) labelToggle.textContent = 'Buka Grafik';
          if (chevronToggle) chevronToggle.style.transform = 'rotate(0deg)';
        }
      });

      // Floating Horizontal Scroll Arrows
      const scrollWrapper = document.getElementById('colleaguesTableScrollWrapper');
      const arrowLeft = document.getElementById('colleaguesScrollArrowLeft');
      const arrowRight = document.getElementById('colleaguesScrollArrowRight');

      arrowLeft?.addEventListener('click', () => {
        if (scrollWrapper) scrollWrapper.scrollBy({ left: -280, behavior: 'smooth' });
      });
      arrowRight?.addEventListener('click', () => {
        if (scrollWrapper) scrollWrapper.scrollBy({ left: 280, behavior: 'smooth' });
      });

      scrollWrapper?.addEventListener('scroll', () => {
        if (typeof updateAllTableScrollState === 'function') updateAllTableScrollState();
      });
    }

    loadColleaguesData();
  }

  window.initColleaguesView = initColleaguesView;

  // =========================================================================
  // VIEW 6: TIKET GANGGUAN DARURAT (MODUL B)
  // =========================================================================
  async function loadGangguanData() {
    const { status, search, dateType, exactDate, startDate, endDate } = state.gangguan;
    try {
      const params = new URLSearchParams();
      params.set('status', status);
      if (search) params.set('search', search);
      if ((state.currentUser?.role === 'lapangan' || state.myTasksOnlyGangguan) && state.activeTechnician && state.activeTechnician !== 'Admin') {
        params.set('pic', state.activeTechnician);
      }
      if (dateType) params.set('date_type', dateType);
      if (exactDate) {
        params.set('date', exactDate);
      } else {
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
      }

      const res = await fetch(`/api/gangguan?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load gangguan');
      const json = await res.json();
      state.gangguan.data = json.data || [];

      // Update badge for My Tasks (Hanya untuk tim lapangan)
      const myTasksBadge = document.getElementById('gangguanMyTasksCount');
      if (myTasksBadge) {
        if (state.myTasksOnlyGangguan && state.currentUser?.role === 'lapangan') {
          myTasksBadge.textContent = `${json.total || 0} tiket`;
          myTasksBadge.classList.remove('hidden');
        } else {
          myTasksBadge.classList.add('hidden');
        }
      }



      // Update Tab Badges if provided by backend
      if (json.counts) {
        const bAll = document.getElementById('gangguanBadgeAll');
        const bOpen = document.getElementById('gangguanBadgeOpen');
        const bClosed = document.getElementById('gangguanBadgeClosed');
        if (bAll) bAll.textContent = `(${json.counts.all})`;
        if (bOpen) bOpen.textContent = `(${json.counts.open})`;
        if (bClosed) bClosed.textContent = `(${json.counts.selesai})`;
      }

      // Update Filter Result Summary Chip
      const countEl = document.getElementById('gangguanFilterCountText');
      const biayaEl = document.getElementById('gangguanFilterBiayaText');
      if (countEl) countEl.innerHTML = `Menampilkan <strong>${json.total || 0}</strong> tiket`;
      if (biayaEl) biayaEl.textContent = formatRupiah(json.total_biaya || 0);

      const tbody = document.getElementById('gangguanTableBody');
      if (tbody) {
        if (!json.data || json.data.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="11" class="text-center py-8 text-slate-400">
                <div class="flex flex-col items-center justify-center gap-2">
                  <i class="fa-solid fa-calendar-xmark text-2xl text-slate-600"></i>
                  <span>Tidak ada tiket gangguan ditemukan pada periode tanggal yang dipilih.</span>
                  <button type="button" class="btn btn-secondary btn-sm mt-1 text-xs" onclick="document.getElementById('btnResetGangguanDate')?.click()">
                    <i class="fa-solid fa-rotate-left mr-1"></i> Reset Filter Tanggal
                  </button>
                </div>
              </td>
            </tr>
          `;
        } else {
          let html = '';
          json.data.forEach((g, idx) => {
            const stBadge = g.is_selesai === 1 
              ? `<span class="status-badge status-finish"><i class="fa-solid fa-circle-check"></i> Selesai</span>`
              : `<span class="status-badge status-ongoing"><i class="fa-solid fa-clock"></i> Open / Proses</span>`;

            html += `
              <tr>
                <td class="font-mono text-xs text-slate-500">${idx + 1}</td>
                <td class="font-mono font-bold text-cyan-400 text-xs">${escapeHtml(g.no_tiket)}</td>
                <td class="font-medium text-slate-200">${g.tgl_dispos || '-'}</td>
                <td class="text-slate-400">${g.tgl_selesai || '-'}</td>
                <td class="max-w-[200px] truncate" title="${escapeHtml(g.terminating)}">${escapeHtml(g.terminating || '-')}</td>
                <td><span class="badge-pill bg-slate-800 text-slate-300 text-xs">${escapeHtml(g.jenis_gangguan || 'FO Cut')}</span></td>
                <td><strong>${escapeHtml(formatPicName(g.pic_perijinan || '-'))}</strong></td>
                <td class="text-right font-mono text-amber-400 font-semibold col-gangguan-financial">${formatRupiah(g.biaya_gangguan)}</td>
                <td class="text-center">${stBadge}</td>
                <td class="max-w-[220px] truncate text-xs text-slate-400" title="${escapeHtml(g.update_gangguan)}">${escapeHtml(g.update_gangguan || '-')}</td>
                <td class="text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <button class="btn-action btn-view-detail" data-type="gangguan" data-id="${g.id}" title="Lihat Detail"><i class="fa-solid fa-eye text-cyan-400"></i></button>
                    <button class="btn-action btn-quick-edit" data-type="gangguan" data-id="${g.id}" title="Edit Data Gangguan"><i class="fa-solid fa-pen-to-square"></i></button>
                    ${state.currentUser?.role === 'admin' ? `<button class="btn-action btn-delete-row text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40" data-type="gangguan" data-id="${g.id}" title="Hapus Data"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `;
          });
          tbody.innerHTML = html;
        }
      }

      renderGangguanCharts(json.data);

    } catch (e) {
      console.error(e);
    }
  }

  function renderGangguanCharts(records) {
    const { textColor, gridColor, donutBorder, donutBorderWidth } = getChartTheme();
    if (!records || records.length === 0) {
      destroyChart('gangguanJenis');
      destroyChart('gangguanSla');
      return;
    }

    // Chart Gangguan 1: Incident Types
    const ctxJenis = document.getElementById('chartGangguanJenis')?.getContext('2d');
    if (ctxJenis) {
      destroyChart('gangguanJenis');
      const counts = {};
      records.forEach(r => {
        let j = (r.jenis_gangguan || 'Lain-lain').trim();
        if (j.length > 25) j = j.slice(0, 25) + '...';
        counts[j] = (counts[j] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);

      charts.gangguanJenis = new Chart(ctxJenis, {
        type: 'bar',
        data: {
          labels: sorted.map(s => s[0]),
          datasets: [{
            label: 'Jumlah Kasus',
            data: sorted.map(s => s[1]),
            backgroundColor: 'rgba(244, 63, 94, 0.85)',
            hoverBackgroundColor: 'rgba(244, 63, 94, 1)',
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, precision: 0 } },
            y: { grid: { display: false }, border: { display: false }, ticks: { color: textColor, font: { size: 10 } } }
          }
        }
      });
    }

    // Chart Gangguan 2: SLA Status Donut
    const ctxSla = document.getElementById('chartGangguanSla')?.getContext('2d');
    if (ctxSla) {
      destroyChart('gangguanSla');
      let selesai = 0, open = 0;
      records.forEach(r => {
        if (r.is_selesai === 1) selesai++;
        else open++;
      });
      let labels = ['Selesai (Resolved)', 'Open / Dalam Penanganan'];
      let data = [selesai, open];
      let bgColors = ['#0E6073', '#F21D2F'];

      if (state.gangguan.status === '0') {
        labels = ['Open / Dalam Penanganan'];
        data = [open];
        bgColors = ['#F21D2F'];
      } else if (state.gangguan.status === '1') {
        labels = ['Selesai (Resolved)'];
        data = [selesai];
        bgColors = ['#0E6073'];
      }

      const totalFiltered = data.reduce((a, b) => a + b, 0);

      charts.gangguanSla = new Chart(ctxSla, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: bgColors,
            borderColor: donutBorder,
            borderWidth: donutBorderWidth,
            hoverBorderColor: donutBorder,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: textColor, font: { size: 11, family: 'Outfit, sans-serif' }, padding: 12 } },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} Tiket (${totalFiltered > 0 ? ((ctx.raw / totalFiltered) * 100).toFixed(1) : 0}%)`
              }
            }
          },
          cutout: '68%',
          onClick: (evt, activeEls) => {
            if (state.gangguan.status !== 'ALL') {
              const allBtn = document.querySelector('.gangguan-tab-btn[data-status="ALL"]');
              if (allBtn) allBtn.click();
            } else if (activeEls && activeEls.length > 0) {
              const idx = activeEls[0].index;
              const targetStatus = idx === 0 ? '1' : '0';
              const targetBtn = document.querySelector(`.gangguan-tab-btn[data-status="${targetStatus}"]`);
              if (targetBtn) targetBtn.click();
            }
          }
        }
      });
    }
  }

  // =========================================================================
  // VIEW 7: REKAP EFISIENSI (MODUL B)
  // =========================================================================
  async function loadEfisiensiData() {
    try {
      const res = await fetch('/api/rekap-efisiensi');
      if (!res.ok) throw new Error('Failed to load efisiensi');
      const payload = await res.json();

      const rawRows = Array.isArray(payload) ? payload : (payload.yearly || []);
      const regionalRows = Array.isArray(payload) ? [] : (payload.regional || []);

      // Pastikan urutan selalu kronologis dari 2024 ke 2026 (Ascending)
      const rows = (rawRows || []).slice().sort((a, b) => Number(a.tahun) - Number(b.tahun));
      state.efisiensi = rows;

      const tbody = document.getElementById('rekapEfisiensiTableBody');
      if (tbody) {
        let html = '';
        rows.forEach(r => {
          html += `
            <tr>
              <td><strong class="text-lg text-cyan-400 font-mono">${r.tahun}</strong></td>
              <td class="text-center font-bold font-mono">${r.total_disposisi}</td>
              <td class="text-center text-amber-400 font-bold font-mono">${r.ada_biaya}</td>
              <td class="text-center text-emerald-400 font-bold font-mono">${r.tidak_ada_biaya}</td>
              <td class="text-right font-mono">${formatRupiah(r.nilai_awal)}</td>
              <td class="text-right font-mono font-bold text-amber-400">${formatRupiah(r.nilai_akhir)}</td>
              <td class="text-right font-mono font-bold text-emerald-400">${formatRupiah(r.efisiensi_rupiah)}</td>
              <td class="text-center font-bold text-emerald-400 bg-emerald-500/10 rounded font-mono">${r.efisiensi_persen}%</td>
            </tr>
          `;
        });
        tbody.innerHTML = html;
      }

      // Render Regional Efficiency Matrix Table
      const regTbody = document.getElementById('rekapEfisiensiRegionalTableBody');
      if (regTbody && regionalRows.length > 0) {
        let rHtml = '';
        regionalRows.forEach(reg => {
          const nAwal = Number(reg.nilai_awal) || 0;
          const nAkhir = Number(reg.nilai_akhir) || 0;
          const nEff = Math.max(0, nAwal - nAkhir);
          const effPct = nAwal > 0 ? Number((nEff / nAwal * 100).toFixed(1)) : 0;
          rHtml += `
            <tr>
              <td><strong>${escapeHtml(reg.region_name)}</strong></td>
              <td class="text-xs text-slate-400">${escapeHtml(reg.description)}</td>
              <td class="text-center font-bold font-mono">${reg.total_pa}</td>
              <td class="text-center text-amber-400 font-bold font-mono">${reg.ada_biaya}</td>
              <td class="text-center text-emerald-400 font-bold font-mono">${reg.tidak_ada_biaya}</td>
              <td class="text-right font-mono">${formatRupiah(nAwal)}</td>
              <td class="text-right font-mono font-bold text-amber-400">${formatRupiah(nAkhir)}</td>
              <td class="text-right font-mono font-bold text-emerald-400">${formatRupiah(nEff)}</td>
              <td class="text-center font-bold text-emerald-400 bg-emerald-500/10 rounded font-mono">${effPct}%</td>
            </tr>
          `;
        });
        regTbody.innerHTML = rHtml;
      }

      renderEfisiensiCharts(rows);

    } catch (e) {
      console.error(e);
    }
  }
  window.loadEfisiensiData = loadEfisiensiData;

  function renderEfisiensiCharts(rows) {
    const { textColor, gridColor } = getChartTheme();
    if (!rows || rows.length === 0) return;

    // Pastikan urutan data grafik kronologis dari 2024 ke 2026 (Ascending)
    const sorted = rows.slice().sort((a, b) => Number(a.tahun) - Number(b.tahun));

    // Chart Efisiensi 1: Awal vs Akhir
    const ctxComp = document.getElementById('chartEfisiensiCompare')?.getContext('2d');
    if (ctxComp) {
      destroyChart('efisiensiCompare');
      charts.efisiensiCompare = new Chart(ctxComp, {
        type: 'bar',
        data: {
          labels: sorted.map(r => `Tahun ${r.tahun}`),
          datasets: [
            {
              label: 'Biaya Pengajuan Awal',
              data: sorted.map(r => r.nilai_awal),
              backgroundColor: 'rgba(244, 63, 94, 0.85)',
              hoverBackgroundColor: 'rgba(244, 63, 94, 1)',
              borderRadius: 6
            },
            {
              label: 'Realisasi Biaya Akhir',
              data: sorted.map(r => r.nilai_akhir),
              backgroundColor: 'rgba(14, 165, 233, 0.85)',
              hoverBackgroundColor: 'rgba(14, 165, 233, 1)',
              borderRadius: 6
            },
            {
              label: 'Nominal Penghematan',
              data: sorted.map(r => r.efisiensi_rupiah),
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: textColor, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}`
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, callback: val => 'Rp ' + (val/1e6).toFixed(0) + ' Jt' } }
          }
        }
      });
    }

    // Chart Efisiensi 2: Efficiency % Trend
    const ctxPct = document.getElementById('chartEfisiensiPct')?.getContext('2d');
    if (ctxPct) {
      destroyChart('efisiensiPct');
      charts.efisiensiPct = new Chart(ctxPct, {
        type: 'line',
        data: {
          labels: sorted.map(r => `Tahun ${r.tahun}`),
          datasets: [{
            label: 'Efisiensi Negosiasi (%)',
            data: sorted.map(r => r.efisiensi_persen),
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointRadius: 6,
            pointBackgroundColor: '#10B981'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: textColor } },
            tooltip: {
              callbacks: {
                label: ctx => ` Efisiensi: ${ctx.raw}%`
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, callback: val => `${val}%` }, min: 0, max: 100 }
          }
        }
      });
    }
  }

  // =========================================================================
  // VIEW 8: PIC WORKLOAD MATRIX (MODUL B)
  // =========================================================================
  async function loadPicMatrixData() {
    try {
      let rows = [];
      try {
        const res = await fetch('/api/pic-performance');
        if (res.ok) {
          rows = await res.json();
        }
      } catch (err) {
        console.warn('Network error loading pic performance:', err);
      }

      if (!rows || rows.length === 0) {
        const d = window.SITAC_COLLO_DATA || {};
        if (d.summary && Array.isArray(d.summary.workload_performa) && d.summary.workload_performa.length > 0) {
          rows = d.summary.workload_performa;
        } else if (Array.isArray(d.workload_performa) && d.workload_performa.length > 0) {
          rows = d.workload_performa;
        } else if (Array.isArray(d.sitac_records) && d.sitac_records.length > 0) {
          rows = computePicPerformanceFromData(d.sitac_records, d.gangguan_records);
        }
      }

      state.picMatrix = rows || [];

      const tbody = document.getElementById('picMatrixTableBody');
      if (tbody) {
        if (!rows || rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" class="text-center py-8 text-slate-400">Tidak ada data beban kerja PIC SITAC</td></tr>';
        } else {
          let html = '';
          rows.forEach(p => {
            html += `
              <tr>
                <td><strong>${escapeHtml(formatPicName(p.pic))}</strong></td>
                <td class="text-center font-bold">${p.total_penugasan}</td>
                <td class="text-center font-bold text-emerald-400">${p.finish}</td>
                <td class="text-center text-amber-400">${p.ongoing + p.hold}</td>
                <td class="text-center text-rose-400">${p.cancel}</td>
                <td class="text-center font-mono font-bold text-emerald-400">${p.finish_rate}%</td>
                <td class="text-right font-mono">${formatRupiah(p.biaya_awal)}</td>
                <td class="text-right font-mono font-bold text-amber-400">${formatRupiah(p.biaya_final)}</td>
                <td class="text-right font-mono font-bold text-emerald-400">${formatRupiah(p.efisiensi_rupiah)}</td>
                <td class="text-center font-mono">${p.avg_sla_hari} Hari</td>
              </tr>
            `;
          });
          tbody.innerHTML = html;
        }
      }

      renderPicMatrixCharts(rows || []);

    } catch (e) {
      console.error('Error rendering PIC matrix data:', e);
    }
  }

  function renderPicMatrixCharts(rows) {
    const { textColor, gridColor } = getChartTheme();
    if (!rows || rows.length === 0) return;

    // Chart PIC 1: Bar Workload
    const ctxWork = document.getElementById('chartPicWorkload')?.getContext('2d');
    if (ctxWork) {
      destroyChart('picWorkload');
      charts.picWorkload = new Chart(ctxWork, {
        type: 'bar',
        data: {
          labels: rows.map(p => formatPicName(p.pic)),
          datasets: [
            {
              label: 'Penugasan Perizinan (PA)',
              data: rows.map(p => p.total_penugasan),
              backgroundColor: 'rgba(14, 165, 233, 0.85)',
              hoverBackgroundColor: 'rgba(14, 165, 233, 1)',
              borderRadius: 6
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: textColor, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} Tugas`
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, precision: 0 } },
            y: { grid: { display: false }, border: { display: false }, ticks: { color: textColor, font: { size: 10 } } }
          }
        }
      });
    }

    // Chart PIC 2: Finish Rate (%)
    const ctxRate = document.getElementById('chartPicFinishRate')?.getContext('2d');
    if (ctxRate) {
      destroyChart('picFinishRate');
      charts.picFinishRate = new Chart(ctxRate, {
        type: 'bar',
        data: {
          labels: rows.map(p => formatPicName(p.pic)),
          datasets: [{
            label: 'Finish Rate (%)',
            data: rows.map(p => p.finish_rate),
            backgroundColor: rows.map(p => p.finish_rate >= 80 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(245, 158, 11, 0.85)'),
            hoverBackgroundColor: rows.map(p => p.finish_rate >= 80 ? 'rgba(16, 185, 129, 1)' : 'rgba(245, 158, 11, 1)'),
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` Finish Rate: ${ctx.raw}%`
              }
            }
          },
          scales: {
            x: { grid: { color: gridColor, drawBorder: false }, border: { display: false }, ticks: { color: textColor, callback: val => `${val}%` }, min: 0, max: 100 },
            y: { grid: { display: false }, border: { display: false }, ticks: { color: textColor, font: { size: 10 } } }
          }
        }
      });
    }
  }

  // =========================================================================
  // VIEW 9: PETA SEBARAN (WEBGIS LEAFLET)
  // =========================================================================
  function setMapBaseLayer(layerKey) {
    if (!leafletMap || !mapBaseLayers[layerKey]) return;

    // Remove other base layers
    Object.keys(mapBaseLayers).forEach(k => {
      if (leafletMap.hasLayer(mapBaseLayers[k])) {
        leafletMap.removeLayer(mapBaseLayers[k]);
      }
    });

    // Add selected layer
    mapBaseLayers[layerKey].addTo(leafletMap);
    currentBaseLayer = layerKey;

    // Update active class on buttons
    document.querySelectorAll('.map-layer-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-layer') === layerKey);
    });

    // Trigger invalidateSize to ensure new tiles render seamlessly
    leafletMap.invalidateSize();
  }

  async function initWebgisMap() {
    const mapEl = document.getElementById('portalLeafletMap');
    if (!mapEl) return;

    if (!leafletMap) {
      leafletMap = L.map('portalLeafletMap', {
        center: [-6.2200, 106.8400],
        zoom: 11,
        zoomControl: true,
        preferCanvas: true
      });
      window.leafletMap = leafletMap;

      // Prepare official Google Maps & High-Res providers
      mapBaseLayers = {
        googleRoadmap: L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          attribution: '&copy; Google Maps',
          maxZoom: 20,
          subdomains: ['0', '1', '2', '3']
        }),
        googleHybrid: L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
          attribution: '&copy; Google Maps Satelit &mdash; Maxar, CNES',
          maxZoom: 20,
          subdomains: ['0', '1', '2', '3']
        }),
        googleTerrain: L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
          attribution: '&copy; Google Maps Medan',
          maxZoom: 20,
          subdomains: ['0', '1', '2', '3']
        }),
        cartoDark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; CARTO &copy; OpenStreetMap',
          maxZoom: 19
        })
      };

      // Default to Google Maps Roadmap (Peta Standar Google)
      mapBaseLayers['googleRoadmap'].addTo(leafletMap);
      currentBaseLayer = 'googleRoadmap';

      mapMarkersLayer = L.layerGroup().addTo(leafletMap);
      window.mapMarkersLayer = mapMarkersLayer;

      mapCircuitsLayer = L.layerGroup().addTo(leafletMap);
      window.mapCircuitsLayer = mapCircuitsLayer;

      // Auto-detect container size changes using ResizeObserver
      if (window.ResizeObserver && !mapResizeObserver) {
        mapResizeObserver = new ResizeObserver(() => {
          if (leafletMap) leafletMap.invalidateSize();
        });
        mapResizeObserver.observe(mapEl);
      }

      window.addEventListener('resize', () => {
        if (leafletMap && state.activeView === 'view-webgis') {
          leafletMap.invalidateSize();
        }
      });

      // Bind dynamic actions inside Leaflet popups
      leafletMap.on('popupopen', (e) => {
        const popupEl = e.popup && e.popup.getElement();
        if (!popupEl) return;
        const btnCollo = popupEl.querySelector('.btn-view-contract-detail');
        if (btnCollo) {
          btnCollo.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const colloId = parseInt(btnCollo.getAttribute('data-collo-id'), 10);
            if (window.openDetailModal && colloId) {
              window.openDetailModal('collo', colloId);
            }
          };
        }
      });
    }

    // Force multiple invalidateSize steps to guarantee no blank/gray tiles
    leafletMap.invalidateSize();
    setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 150);
    setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 350);

    await Promise.all([
      updateMapMarkers(),
      updateNetworkCircuits(currentCircuitFilter)
    ]);
  }

  async function updateMapMarkers(filterStatus = 'ALL') {
    if (!leafletMap || !mapMarkersLayer) return;
    mapMarkersLayer.clearLayers();

    // Check layer visibility toggle
    if (!isSitacLayerVisible) {
      if (leafletMap.hasLayer(mapMarkersLayer)) leafletMap.removeLayer(mapMarkersLayer);
      return;
    } else {
      if (!leafletMap.hasLayer(mapMarkersLayer)) mapMarkersLayer.addTo(leafletMap);
    }

    try {
      let pins = [];
      try {
        const res = await fetch(`/api/map-coordinates?status=${filterStatus}`);
        if (res.ok) pins = await res.json();
      } catch (err) {
        console.warn('Backend map coords fetch failed, using fallback:', err);
      }

      if (!pins || pins.length === 0) {
        const fallbackSitac = (window.SITAC_COLLO_DATA && window.SITAC_COLLO_DATA.sitac_records) || [];
        pins = fallbackSitac.filter(s => s.latitude && s.longitude && (!filterStatus || filterStatus === 'ALL' || s.progress === filterStatus));
      }

      // Ensure only verified exact / user-entered coordinates are rendered
      pins = (pins || []).filter(p => {
        if (!p.latitude || !p.longitude) return false;
        const ct = (p.coord_type || '').toUpperCase();
        return ct === 'EXACT' || ct === 'EXACT_COORDS' || ct === 'USER_INPUT' || !p.coord_type;
      });

      // Update counter pill
      const countEl = document.getElementById('mapPinCount');
      if (countEl) countEl.textContent = pins.length;

      // Color mapping strictly aligned with requested status colors
      const colors = {
        Finish: {
          color: '#10b981',       // Hijau Emerald
          label: 'Finish'
        },
        Ongoing: {
          color: '#06b6d4',       // Biru Cyan
          label: 'Ongoing'
        },
        Hold: {
          color: '#f59e0b',       // Kuning Amber
          label: 'Hold'
        },
        Cancel: {
          color: '#f43f5e',       // Merah Rose
          label: 'Cancel'
        }
      };

      const bounds = [];
      const coordCounts = {};

      pins.forEach(p => {
        if (!p.latitude || !p.longitude) return;

        // Micro-jitter to spread duplicate coordinates so all points are distinct
        const coordKey = `${Number(p.latitude).toFixed(4)},${Number(p.longitude).toFixed(4)}`;
        const count = coordCounts[coordKey] || 0;
        coordCounts[coordKey] = count + 1;

        let lat = Number(p.latitude);
        let lng = Number(p.longitude);
        if (count > 0) {
          const angle = count * 0.785398;
          const ring = Math.floor((count - 1) / 8) + 1;
          const offset = 0.0016 * ring;
          lat += offset * Math.sin(angle);
          lng += (offset * 1.3) * Math.cos(angle);
        }

        const statusCfg = colors[p.progress] || colors.Ongoing;
        const marker = L.circleMarker([lat, lng], {
          radius: 7,
          fillColor: statusCfg.color,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        });

        const gmapsCoordQuery = encodeURIComponent(`${lat.toFixed(6)},${lng.toFixed(6)}`);
        marker.bindPopup(`
          <div class="p-2.5 space-y-2 font-sans min-w-[260px] max-w-[320px]">
            <div class="flex justify-between items-center text-xs border-b border-white/10 pb-1.5 pr-7 gap-2">
              <strong class="font-mono text-cyan-400 font-bold">${escapeHtml(p.no_pa || 'PA')}</strong>
              ${getStatusBadge(p.progress)}
            </div>
            <div class="font-bold text-sm text-slate-100 mt-1">${escapeHtml(p.pelanggan || 'Pelanggan')}</div>
            <div class="text-xs text-slate-300 leading-relaxed"><i class="fa-solid fa-location-dot text-rose-400 mr-1"></i>${escapeHtml(p.terminating || '-')}</div>
            <div class="text-xs text-slate-300">PIC: <strong class="text-slate-100">${escapeHtml(p.pic_perijinan || '-')}</strong></div>
            <div class="flex justify-between items-center text-xs pt-1.5 border-t border-white/10">
              <span class="text-slate-400">Realisasi Biaya:</span>
              <strong class="text-amber-400 font-mono font-bold text-xs">${formatRupiah(p.biaya_final)}</strong>
            </div>
            <div class="pt-1.5 flex items-center gap-2">
              <a href="https://www.google.com/maps/search/?api=1&query=${gmapsCoordQuery}" target="_blank" rel="noopener noreferrer" class="btn-gmaps-link flex-1 text-center py-1.5 text-xs">
                <i class="fa-brands fa-google text-rose-400 mr-1"></i> Google Maps
              </a>
              <button type="button" class="px-3 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition" onclick="window.openDetailModal && window.openDetailModal('sitac', ${p.id})">
                <i class="fa-solid fa-eye mr-1"></i> Detail
              </button>
            </div>
          </div>
        `);

        mapMarkersLayer.addLayer(marker);
        bounds.push([lat, lng]);
      });

      if (bounds.length > 0 && isSitacLayerVisible && !isCircuitLayerVisible) {
        lastMapBounds = L.latLngBounds(bounds);
        leafletMap.fitBounds(lastMapBounds, { padding: [40, 40], maxZoom: 13 });
      }

      setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 200);
    } catch (e) {
      console.error('Error updating map markers:', e);
    }
  }

  async function updateNetworkCircuits(filterStatus = 'ALL') {
    if (!leafletMap || !mapCircuitsLayer) return;
    mapCircuitsLayer.clearLayers();
    currentCircuitFilter = filterStatus;

    try {
      let data = null;
      try {
        const res = await fetch(`/api/network-links?status=${filterStatus}`);
        if (res.ok) data = await res.json();
      } catch (err) {
        console.warn('Backend /api/network-links fetch failed, using fallback:', err);
      }

      // Offline / fallback data
      if (!data || !data.links) {
        let fallbackLinks = (window.SITAC_COLLO_DATA && window.SITAC_COLLO_DATA.network_links) || [];
        if (filterStatus !== 'ALL') {
          fallbackLinks = fallbackLinks.filter(l => (l.status || '').toUpperCase() === filterStatus.toUpperCase());
        }
        data = {
          total: fallbackLinks.length,
          links: fallbackLinks,
          status_counts: {
            ALL: fallbackLinks.length,
            ACTIVE: fallbackLinks.filter(l => l.status === 'ACTIVE').length,
            DEACTIVASI: fallbackLinks.filter(l => l.status === 'DEACTIVASI').length,
            'NON ACTIVE': fallbackLinks.filter(l => l.status === 'NON ACTIVE').length
          }
        };
      }

      const links = data.links || [];
      const counts = data.status_counts || {};

      // Update counters in UI
      const countEl = document.getElementById('mapCircuitCount');
      if (countEl) countEl.textContent = links.length;
      if (document.getElementById('filterCountCircuitsAll')) document.getElementById('filterCountCircuitsAll').textContent = counts.ALL || 0;
      if (document.getElementById('filterCountCircuitsActive')) document.getElementById('filterCountCircuitsActive').textContent = counts.ACTIVE || 0;
      if (document.getElementById('filterCountCircuitsDeact')) document.getElementById('filterCountCircuitsDeact').textContent = counts.DEACTIVASI || 0;
      if (document.getElementById('filterCountCircuitsNon')) document.getElementById('filterCountCircuitsNon').textContent = counts['NON ACTIVE'] || 0;

      // If user toggled circuit layer off, keep layer cleared
      if (!isCircuitLayerVisible) {
        if (leafletMap.hasLayer(mapCircuitsLayer)) leafletMap.removeLayer(mapCircuitsLayer);
        return;
      } else {
        if (!leafletMap.hasLayer(mapCircuitsLayer)) mapCircuitsLayer.addTo(leafletMap);
      }

      const circuitStyles = {
        ACTIVE: {
          color: '#10b981',       // Emerald
          weight: 3.5,
          opacity: 0.85,
          dashArray: null,
          label: 'Aktif'
        },
        DEACTIVASI: {
          color: '#f59e0b',       // Amber
          weight: 3.0,
          opacity: 0.85,
          dashArray: null,
          label: 'Deaktivasi'
        },
        'NON ACTIVE': {
          color: '#94a3b8',       // Slate
          weight: 2.2,
          opacity: 0.65,
          dashArray: '6, 8',
          label: 'Non-Aktif'
        }
      };

      const bounds = [];
      const origCounts = {};
      const termCounts = {};

      links.forEach(l => {
        const orig = l.originating;
        const term = l.terminating;
        if (!orig || !orig.lat || !orig.lng || !term || !term.lat || !term.lng) return;

        const stKey = (l.status || 'ACTIVE').toUpperCase();
        const style = circuitStyles[stKey] || circuitStyles.ACTIVE;

        // Polyline connecting Originating -> Terminating
        const polyline = L.polyline([
          [orig.lat, orig.lng],
          [term.lat, term.lng]
        ], {
          color: style.color,
          weight: style.weight,
          opacity: style.opacity,
          dashArray: style.dashArray,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'network-circuit-line'
        });

        const popupContent = `
          <div class="circuit-popup space-y-2.5 font-sans min-w-[280px] max-w-[360px] text-xs">
            <div class="flex justify-between items-center border-b border-white/10 pb-2 pr-7 gap-2">
              <span class="font-mono text-cyan-400 font-bold flex items-center gap-1.5">
                <i class="fa-solid fa-network-wired text-cyan-400"></i>
                <span>${escapeHtml(l.no_so || 'SO')}</span>
              </span>
              ${getStatusBadge(l.status)}
            </div>
            <div>
              <div class="font-bold text-sm text-slate-100 leading-snug">${escapeHtml(l.pelanggan || '-')}</div>
              <div class="text-[11px] text-slate-400 mt-0.5">Pengelola: <strong class="text-slate-200">${escapeHtml(l.pengelola || '-')}</strong></div>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/80 border border-white/10 space-y-2">
              <div class="flex items-start gap-2">
                <span class="w-4 h-4 rounded-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">A</span>
                <div class="min-w-0 flex-1">
                  <div class="text-[9px] uppercase tracking-wider text-cyan-400 font-semibold">Originating (Asal)</div>
                  <div class="text-slate-200 text-xs font-medium break-words leading-tight" title="${escapeHtml(orig.raw || '')}">${escapeHtml(orig.label || orig.raw)}</div>
                </div>
              </div>
              <div class="flex items-center gap-2 pl-1.5 my-1 text-slate-500 text-[10px]">
                <div class="w-0.5 h-3 bg-cyan-500/30 ml-1"></div>
                <i class="fa-solid fa-arrow-down text-cyan-400 text-xs"></i>
                <span class="text-[10px] text-slate-400 font-medium">Jalur Transmisi Sirkuit</span>
              </div>
              <div class="flex items-start gap-2">
                <span class="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">B</span>
                <div class="min-w-0 flex-1">
                  <div class="text-[9px] uppercase tracking-wider text-emerald-400 font-semibold">Terminating (Tujuan)</div>
                  <div class="text-slate-200 text-xs font-medium break-words leading-tight" title="${escapeHtml(term.raw || '')}">${escapeHtml(term.label || term.raw)}</div>
                </div>
              </div>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 space-y-2">
              <div class="flex justify-between items-center text-xs gap-2">
                <span class="text-slate-400 text-[11px]">Layanan & Kapasitas:</span>
                <strong class="text-slate-200 font-medium text-xs text-right truncate max-w-[180px]">${escapeHtml(l.layanan || 'Interkoneksi')} (${escapeHtml(l.kapasitas || 'Standard')})</strong>
              </div>
              <div class="flex justify-between items-center text-xs gap-2 pt-1.5 border-t border-white/10">
                <span class="text-slate-400 text-[11px]">Biaya Sewa / Thn:</span>
                <strong class="text-amber-400 font-mono font-bold text-sm tracking-wide text-right">${formatRupiah(l.biaya_sewa_tahun)}</strong>
              </div>
            </div>
            <div class="pt-1 flex items-center gap-2">
              <button type="button" class="btn btn-secondary btn-sm flex-1 text-center py-2 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-slate-700/80 transition btn-view-contract-detail" data-collo-id="${l.collo_id || l.id}" onclick="event.stopPropagation(); window.openDetailModal && window.openDetailModal('collo', ${l.collo_id || l.id}); return false;">
                <i class="fa-solid fa-file-contract text-cyan-400"></i>
                <span>Rincian Kontrak</span>
              </button>
            </div>
          </div>
        `;

        polyline.bindPopup(popupContent, { className: 'circuit-route-popup', maxWidth: 380, minWidth: 290 });

        // Interactive hover
        polyline.on('mouseover', () => {
          polyline.setStyle({
            weight: style.weight + 3,
            opacity: 1
          });
          polyline.bringToFront();
        });
        polyline.on('mouseout', () => {
          polyline.setStyle({
            weight: style.weight,
            opacity: style.opacity
          });
        });

        // Originating marker (Point A: Square/Diamond Cyan)
        const origKey = `${orig.lat.toFixed(4)},${orig.lng.toFixed(4)}`;
        if (!origCounts[origKey]) {
          origCounts[origKey] = true;
          const origMarker = L.circleMarker([orig.lat, orig.lng], {
            radius: 5,
            fillColor: '#06b6d4',
            color: '#ffffff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.95
          });
          origMarker.bindTooltip(`<strong>Titik A (Originating)</strong>: ${escapeHtml(orig.label || orig.raw)}`, { direction: 'top' });
          mapCircuitsLayer.addLayer(origMarker);
        }

        // Terminating marker (Point B: Circle Emerald)
        const termKey = `${term.lat.toFixed(4)},${term.lng.toFixed(4)}`;
        if (!termCounts[termKey]) {
          termCounts[termKey] = true;
          const termMarker = L.circleMarker([term.lat, term.lng], {
            radius: 5,
            fillColor: style.color,
            color: '#ffffff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.95
          });
          termMarker.bindTooltip(`<strong>Titik B (Terminating)</strong>: ${escapeHtml(term.label || term.raw)}`, { direction: 'top' });
          mapCircuitsLayer.addLayer(termMarker);
        }

        mapCircuitsLayer.addLayer(polyline);
        bounds.push([orig.lat, orig.lng]);
        bounds.push([term.lat, term.lng]);
      });

      if (bounds.length > 0 && !lastMapBounds) {
        lastMapBounds = L.latLngBounds(bounds);
        leafletMap.fitBounds(lastMapBounds, { padding: [40, 40], maxZoom: 13 });
      }
    } catch (e) {
      console.error('Error updating network circuits:', e);
    }
  }

  // =========================================================================
  // INTERACTIVE CRUD MODALS (PATCH & POST) & GEOLOCATION HELPERS
  // =========================================================================

  function parseAndSetCoordinates(rawText, latInput, lngInput) {
    if (!rawText) return false;
    let s = String(rawText).trim();

    // 1. Google Maps URL e.g. google.com/maps?q=-6.221658,106.867650 or @-6.221658,106.867650
    const urlMatch = s.match(/[@?&]q?=?(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (urlMatch) {
      if (latInput) latInput.value = urlMatch[1];
      if (lngInput) lngInput.value = urlMatch[2];
      showToast('Koordinat GPS berhasil diekstrak dari link Google Maps!');
      return true;
    }

    // 2. Paired coordinates e.g. -6.221658, 106.867650 or -6.221658 106.867650
    const coordMatch = s.match(/(-?\d+\.\d+)\s*[,;\s]\s*(-?\d+\.\d+)/);
    if (coordMatch) {
      if (latInput) latInput.value = coordMatch[1];
      if (lngInput) lngInput.value = coordMatch[2];
      showToast('Koordinat Latitude & Longitude berhasil dipisah!');
      return true;
    }

    return false;
  }

  function handleGetDeviceGps(latInput, lngInput, btnEl) {
    if (!navigator.geolocation) {
      alert('Perangkat atau browser Anda tidak mendukung Geolocation GPS.');
      return;
    }
    const origHtml = btnEl ? btnEl.innerHTML : '';
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mendeteksi GPS...';
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (latInput) latInput.value = pos.coords.latitude.toFixed(6);
        if (lngInput) lngInput.value = pos.coords.longitude.toFixed(6);
        showToast('Titik koordinat GPS saat ini berhasil didapatkan!');
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = origHtml;
        }
      },
      (err) => {
        console.warn('Geolocation notice:', err);
        alert('Gagal mengambil titik GPS: ' + (err.message || 'Izin lokasi tidak diberikan.'));
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = origHtml;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function openQuickEditModal(type, id) {
    const overlay = document.getElementById('modalQuickEdit');
    const container = document.getElementById('quickEditDynamicFields');
    const title = document.getElementById('quickEditModalTitle');
    const sub = document.getElementById('quickEditModalSub');
    const isLapangan = state.currentUser?.role === 'lapangan';

    const colName = type === 'sitac' ? 'sitac_records' : (type === 'gangguan' ? 'gangguan_records' : 'collo_records');
    const targetRec = (window.SITAC_COLLO_DATA?.[colName] || []).find(r => r.id == id) ||
                      (state.sitac?.data || []).find(s => s.id == id) ||
                      (state.colleagues?.data || []).find(s => s.id == id) ||
                      (state.gangguan?.data || []).find(g => g.id == id) ||
                      (state.collo?.data || []).find(c => c.id == id);

    if (isLapangan && type === 'collo') {
      showToast('Akses ditolak: Hanya Administrator yang berhak mengedit data Colocation', 'error');
      return;
    }

    if (!isTaskEditableByUser(targetRec)) {
      showToast('Akses ditolak: Anda hanya berwenang memperbarui tugas/tiket yang ditugaskan kepada Anda (Mode Lihat Saja).', 'error');
      return;
    }

    document.getElementById('quickEditTargetType').value = type;
    document.getElementById('quickEditTargetId').value = id;

    if (type === 'collo') {
      let rec = (contractAlertData?.items || []).find(c => c.id == id) ||
                (state.collo?.data || []).find(c => c.id == id) ||
                (state.alerts?.data || []).find(c => c.id == id) ||
                (state.revSharing?.data || []).find(c => c.id == id) || {};
      const firstPel = (rec.pelanggan || '').split(/[\r\n]+/)[0]?.replace(/^\d+[\.\)]\s*/, '') || 'Colocation';
      title.textContent = `Edit Data Link #${id} - ${firstPel}`;
      sub.textContent = 'Perbarui identitas sirkuit, nilai finansial sewa, status, dan data administrasi';
      container.innerHTML = `
        <div class="space-y-4">
          <!-- Section 1: Identitas Sirkuit & Pelanggan -->
          <div class="p-4 bg-slate-900/60 rounded-xl border border-cyan-500/20 space-y-3.5 shadow-sm">
            <div class="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <i class="fa-solid fa-network-wired"></i>
              <span>Identitas Sirkuit & Pelanggan</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Pengelola / Mitra Datacenter *</label>
                <input type="text" name="pengelola" class="filter-input w-full text-xs font-semibold" value="${escapeHtml(rec.pengelola || '')}" required placeholder="Contoh: NTT, APJII, dll">
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Nama Pelanggan *</label>
                <input type="text" name="pelanggan" class="filter-input w-full text-xs font-semibold text-slate-100" value="${escapeHtml(rec.pelanggan || '')}" required placeholder="Nama Pelanggan">
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">SID Sirkuit</label>
                <input type="text" name="sid" class="filter-input w-full text-xs font-mono text-cyan-400" value="${escapeHtml(rec.sid || '')}" placeholder="Contoh: 100234">
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Nomor SO</label>
                <input type="text" name="no_so" class="filter-input w-full text-xs font-mono" value="${escapeHtml(rec.no_so || '')}" placeholder="Contoh: AR/ACT/...">
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Jenis Sewa / Layanan</label>
                <select name="jenis_sewa" class="filter-select w-full text-xs font-medium">
                  <option value="Colocation" ${rec.jenis_sewa === 'Colocation' ? 'selected' : ''}>Colocation</option>
                  <option value="Revenue Sharing" ${rec.jenis_sewa === 'Revenue Sharing' ? 'selected' : ''}>Revenue Sharing</option>
                  <option value="Interkoneksi" ${rec.jenis_sewa === 'Interkoneksi' ? 'selected' : ''}>Interkoneksi</option>
                  <option value="Rack Space" ${rec.jenis_sewa === 'Rack Space' ? 'selected' : ''}>Rack Space</option>
                  <option value="Cross Connect" ${rec.jenis_sewa === 'Cross Connect' ? 'selected' : ''}>Cross Connect</option>
                  <option value="Space Tower" ${rec.jenis_sewa === 'Space Tower' ? 'selected' : ''}>Space Tower</option>
                </select>
              </div>
            </div>

            <!-- Site & Lokasi -->
            <div class="pt-2 border-t border-white/5 space-y-3">
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Site</label>
                <input type="text" name="site" id="quickEditSite" class="filter-input w-full text-xs font-semibold text-emerald-200 border-emerald-500/40 bg-emerald-950/20 focus:border-emerald-400 placeholder:text-slate-500" value="${escapeHtml(rec.site || '')}" placeholder="Ketik nama Site">
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Originating (Lokasi Asal)</label>
                  <input type="text" name="originating" class="filter-input w-full text-xs" value="${escapeHtml(rec.originating || '')}" placeholder="Lokasi asal...">
                </div>
                <div>
                  <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Terminating (Lokasi Tujuan)</label>
                  <input type="text" name="terminating" class="filter-input w-full text-xs" value="${escapeHtml(rec.terminating || '')}" placeholder="Lokasi tujuan...">
                </div>
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Alamat Pengelola / Fasilitas Datacenter</label>
                <input type="text" name="alamat_pengelola" class="filter-input w-full text-xs" value="${escapeHtml(rec.alamat_pengelola || '')}" placeholder="Alamat lengkap fasilitas datacenter...">
              </div>
            </div>
          </div>

          <!-- Section 2: Finansial & Skema Biaya -->
          <div class="p-4 bg-slate-900/60 rounded-xl border border-emerald-500/20 space-y-3.5 shadow-sm">
            <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
              <span class="flex items-center gap-1.5"><i class="fa-solid fa-coins"></i> Nilai Finansial & Skema Biaya</span>
              <span class="text-[10px] text-slate-400 font-normal">Kalkulasi Margin Otomatis</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Rev Sewa (1 Thn) (Rp)</label>
                <input type="number" name="rev_sewa_tahun" id="quickEditRevSewa" class="filter-input w-full text-xs font-mono font-bold text-emerald-400" value="${rec.rev_sewa_tahun || 0}">
                <span class="text-[11px] text-emerald-400 font-mono font-semibold block mt-1" id="previewQuickEditRev">${formatRupiah(rec.rev_sewa_tahun || 0)}</span>
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Biaya OTC (Rp)</label>
                <input type="number" name="biaya_otc" id="quickEditBiayaOtc" class="filter-input w-full text-xs font-mono text-purple-400 font-semibold" value="${rec.biaya_otc || 0}">
                <span class="text-[11px] text-purple-400 font-mono font-semibold block mt-1" id="previewQuickEditOtc">${formatRupiah(rec.biaya_otc || 0)}</span>
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Biaya Deposito (Rp)</label>
                <input type="number" name="biaya_deposit" id="quickEditBiayaDeposit" class="filter-input w-full text-xs font-mono text-blue-400 font-semibold" value="${rec.biaya_deposit || 0}">
                <span class="text-[11px] text-blue-400 font-mono font-semibold block mt-1" id="previewQuickEditDeposit">${formatRupiah(rec.biaya_deposit || 0)}</span>
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Biaya Sewa 1 Tahun (Rp)</label>
                <input type="number" name="biaya_sewa_tahun" id="quickEditBiayaSewa" class="filter-input w-full text-xs font-mono text-amber-400 font-semibold" value="${rec.biaya_sewa_tahun || 0}">
                <span class="text-[11px] text-amber-400 font-mono font-semibold block mt-1" id="previewQuickEditBiaya">${formatRupiah(rec.biaya_sewa_tahun || 0)}</span>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Rev Sharing (%)</label>
                <input type="number" step="0.01" name="rev_sharing_pct" class="filter-input w-full text-xs font-mono" value="${rec.rev_sharing_pct || 0}" placeholder="20">
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Status Sirkuit *</label>
                <select name="status" class="filter-select w-full text-xs font-bold">
                  <option value="ACTIVE" ${rec.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
                  <option value="NON ACTIVE" ${rec.status === 'NON ACTIVE' ? 'selected' : ''}>NON ACTIVE</option>
                  <option value="DEACTIVASI" ${rec.status === 'DEACTIVASI' ? 'selected' : ''}>DEACTIVASI</option>
                </select>
              </div>
              <div>
                <label class="form-label text-slate-400 text-xs mb-1 block">Estimasi Gross Margin</label>
                <div class="h-[38px] px-3 bg-slate-950/80 rounded-xl border border-cyan-500/25 flex items-center justify-between">
                  <span class="text-[10px] text-slate-400">Margin:</span>
                  <span class="font-mono font-bold text-cyan-400 text-xs" id="previewQuickEditMargin">${formatRupiah(rec.margin_rupiah || 0)} (${rec.margin_persen || 0}%)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: Administrasi & Kontrak -->
          <div class="p-4 bg-slate-900/60 rounded-xl border border-amber-500/20 space-y-3.5 shadow-sm">
            <div class="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <i class="fa-solid fa-file-contract"></i>
              <span>Administrasi, Kontrak & Catatan</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Tanggal Mulai Kontrak</label>
                <input type="date" name="start_date" class="filter-input w-full text-xs" value="${rec.start_date || ''}">
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Tanggal Jatuh Tempo</label>
                <input type="date" name="end_date" class="filter-input w-full text-xs" value="${rec.end_date || ''}">
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Nomor SPP</label>
                <input type="text" name="spp" class="filter-input w-full text-xs font-mono" value="${escapeHtml(rec.spp || '')}" placeholder="Nomor SPP">
              </div>
              <div>
                <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Nomor PO Baru</label>
                <input type="text" name="po_baru" class="filter-input w-full text-xs font-mono" value="${escapeHtml(rec.po_baru || '')}" placeholder="Nomor PO">
              </div>
            </div>
            <div>
              <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Status Proses Admin</label>
              <input type="text" name="proses_admin" class="filter-input w-full text-xs" value="${escapeHtml(rec.proses_admin || '')}" placeholder="Contoh: Proses SPP / Running">
            </div>
            <div>
              <label class="form-label text-slate-300 font-medium text-xs mb-1 block">Catatan Keterangan</label>
              <textarea name="keterangan" rows="2" class="filter-input w-full text-xs" placeholder="Catatan kontrak / rekanan...">${escapeHtml(rec.keterangan || '')}</textarea>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="form-label text-slate-300 font-medium text-xs mb-0 block">Upload / Ganti Dokumen Kontrak / Berita Acara / Foto Titik Jaringan (Opsional)</label>
                <button type="button" id="btnCancelQuickEditFoto" class="hidden text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-colors">
                  <i class="fa-solid fa-xmark mr-1"></i>Batal Pilih File
                </button>
              </div>
              <input type="file" id="quickEditFotoInput" accept="image/*,application/pdf" class="filter-input w-full text-xs cursor-pointer">
              <div id="quickEditFotoHelp" class="mt-1">
                ${rec.foto_bukti ? `
                  <div class="flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-950/30 p-1.5 rounded border border-emerald-500/30">
                    <span class="truncate mr-2"><i class="fa-solid fa-file-check mr-1"></i> File: <strong>${escapeHtml(rec.foto_bukti)}</strong></span>
                    <label class="flex items-center text-rose-300 hover:text-rose-200 cursor-pointer text-[10px] shrink-0">
                      <input type="checkbox" id="chkDeleteFotoBukti" name="delete_foto_bukti" value="1" class="mr-1 rounded"> Hapus Foto/Dokumen Ini
                    </label>
                  </div>` : '<span class="text-[10px] text-slate-500 block">Format: JPG, PNG, atau PDF (Lampiran Berita Acara / Kontrak / SPP)</span>'}
              </div>
            </div>
          </div>
        </div>
      `;

      // Wire live currency previews & auto margin calculation
      const inRev = document.getElementById('quickEditRevSewa');
      const inOtc = document.getElementById('quickEditBiayaOtc');
      const inDeposit = document.getElementById('quickEditBiayaDeposit');
      const inBiaya = document.getElementById('quickEditBiayaSewa');
      const inMargin = document.getElementById('previewQuickEditMargin');

      const updateLivePreviews = () => {
        const rev = parseInt(inRev?.value || '0', 10) || 0;
        const otc = parseInt(inOtc?.value || '0', 10) || 0;
        const dep = parseInt(inDeposit?.value || '0', 10) || 0;
        const biaya = parseInt(inBiaya?.value || '0', 10) || 0;
        const margin = rev - biaya;
        const pct = rev > 0 ? ((margin / rev) * 100).toFixed(1) : '0.0';

        const pRev = document.getElementById('previewQuickEditRev');
        if (pRev) pRev.textContent = formatRupiah(rev);
        const pOtc = document.getElementById('previewQuickEditOtc');
        if (pOtc) pOtc.textContent = formatRupiah(otc);
        const pDep = document.getElementById('previewQuickEditDeposit');
        if (pDep) pDep.textContent = formatRupiah(dep);
        const pBiaya = document.getElementById('previewQuickEditBiaya');
        if (pBiaya) pBiaya.textContent = formatRupiah(biaya);
        if (inMargin) inMargin.textContent = `${formatRupiah(margin)} (${pct}%)`;
      };

      [inRev, inOtc, inDeposit, inBiaya].forEach(input => {
        input?.addEventListener('input', updateLivePreviews);
      });

      // Asynchronously fetch complete single record from backend to guarantee 100% fresh data
      fetch(`/api/collo/${id}`)
        .then(res => res.ok ? res.json() : null)
        .then(freshRec => {
          if (!freshRec) return;
          if (document.getElementById('quickEditTargetId')?.value != id) return;
          const f = document.getElementById('formQuickEdit');
          if (!f) return;
          const fields = [
            'pengelola', 'pelanggan', 'sid', 'no_so', 'jenis_sewa', 'site', 'originating', 'terminating', 'alamat_pengelola',
            'rev_sewa_tahun', 'biaya_otc', 'biaya_deposit', 'biaya_sewa_tahun', 'rev_sharing_pct', 'status',
            'start_date', 'end_date', 'spp', 'po_baru', 'proses_admin', 'keterangan'
          ];
          fields.forEach(field => {
            const input = f.elements[field];
            if (input && (input.value === '' || input.value === '0' || !input.matches(':focus'))) {
              if (freshRec[field] !== undefined && freshRec[field] !== null) {
                input.value = freshRec[field];
              }
            }
          });
          updateLivePreviews();
          const firstPel = (freshRec.pelanggan || '').split(/[\r\n]+/)[0]?.replace(/^\d+[\.\)]\s*/, '') || 'Colocation';
          title.textContent = `Edit Data Link #${id} - ${firstPel}`;
        })
        .catch(err => console.warn('Could not fetch single collo:', err));
    } else if (type === 'sitac') {
      const rec = (state.sitac.data || []).find(s => s.id == id) || (window.SITAC_COLLO_DATA?.sitac_records || []).find(s => s.id == id) || {};
      title.textContent = `Update Penugasan SITAC #${id}`;
      sub.textContent = isLapangan ? 'Perbarui progress pengerjaan lapangan, titik GPS, dan catatan operasional' : 'Perbarui progress pengerjaan lapangan, titik GPS, dan realisasi biaya final';
      container.innerHTML = `
        <div>
          <label class="form-label">Progress Pengerjaan *</label>
          <select name="progress" class="filter-select w-full text-xs font-semibold">
            <option value="Finish" ${rec.progress === 'Finish' ? 'selected' : ''}>Finish</option>
            <option value="Ongoing" ${rec.progress === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
            <option value="Hold" ${rec.progress === 'Hold' ? 'selected' : ''}>Hold</option>
            <option value="Cancel" ${rec.progress === 'Cancel' ? 'selected' : ''}>Cancel</option>
          </select>
        </div>

        <!-- Section: Titik Koordinat Lokasi Spasial (WebGIS Pin) -->
        <div class="p-3 bg-slate-900/70 rounded-xl border border-cyan-500/25 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wide">
              <i class="fa-solid fa-map-location-dot"></i> Koordinat Lokasi WebGIS (Pin Peta)
            </span>
            <button type="button" id="btnGetGpsQuickEditSitac" class="text-[10px] px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition flex items-center gap-1 font-medium">
              <i class="fa-solid fa-crosshairs"></i> Ambil GPS Saat Ini
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="form-label text-[10px] text-slate-400">Latitude (Lintang)</label>
              <input type="text" name="latitude" id="quickEditSitacLat" class="filter-input w-full text-xs font-mono" placeholder="-6.2088..." value="${rec.latitude !== null && rec.latitude !== undefined ? escapeHtml(String(rec.latitude)) : ''}">
            </div>
            <div>
              <label class="form-label text-[10px] text-slate-400">Longitude (Bujur)</label>
              <input type="text" name="longitude" id="quickEditSitacLng" class="filter-input w-full text-xs font-mono" placeholder="106.8456..." value="${rec.longitude !== null && rec.longitude !== undefined ? escapeHtml(String(rec.longitude)) : ''}">
            </div>
          </div>
          <div class="text-[10px] text-slate-400 leading-tight">
            <i class="fa-solid fa-circle-info mr-1 text-cyan-400"></i>
            Bisa paste link Google Maps atau format <code>lat, lng</code>. Pin otomatis terupdate di peta dengan warna status.
          </div>
        </div>

        ${!isLapangan ? `
        <div class="p-3 bg-slate-900/60 rounded-xl border border-amber-500/20 space-y-2.5 financial-field-group">
          <div class="text-[11px] font-bold text-amber-400 flex items-center justify-between uppercase tracking-wide">
            <span class="flex items-center gap-1.5"><i class="fa-solid fa-coins"></i> Finansial & Negosiasi Biaya Perizinan</span>
            <span class="text-[10px] text-slate-400 font-normal lowercase">Bisa diisi / diperbarui kapan saja</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label">Biaya Pengajuan Awal (Rp)</label>
              <input type="number" name="biaya_permintaan_awal" id="quickEditSitacBiayaAwal" class="filter-input w-full text-xs font-mono" placeholder="0" value="${rec.biaya_permintaan_awal || 0}">
              <span class="text-[10px] text-slate-400 block mt-0.5">Estimasi/tagihan awal instansi</span>
            </div>
            <div>
              <label class="form-label">Realisasi Biaya Final (Rp)</label>
              <input type="number" name="biaya_final" id="quickEditSitacBiayaFinal" class="filter-input w-full text-xs font-mono" placeholder="0" value="${rec.biaya_final || 0}">
              <span class="text-[10px] text-slate-400 block mt-0.5">Biaya resmi yang disepakati/dibayar</span>
            </div>
          </div>
          <!-- Live Efisiensi Summary Pill -->
          <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs">
            <span class="text-slate-300 font-medium flex items-center gap-1.5">
              <i class="fa-solid fa-piggy-bank text-emerald-400"></i> Penghematan (Efisiensi Biaya):
            </span>
            <span id="quickEditSitacHematText" class="font-mono font-bold text-emerald-400">Rp 0 (0%)</span>
          </div>
        </div>
        <div>
          <label class="form-label">Tanggal Close / Selesai</label>
          <input type="date" name="date_close" class="filter-input w-full text-xs" value="${rec.date_close || ''}">
        </div>` : `
        <div>
          <label class="form-label">Tanggal Close / Selesai</label>
          <input type="date" name="date_close" class="filter-input w-full text-xs" value="${rec.date_close || ''}">
        </div>`}
        <div>
          <label class="form-label">Update Pengerjaan Lapangan</label>
          <textarea name="update_pekerjaan" rows="2" class="filter-input w-full text-xs" placeholder="Catatan progress fisik...">${escapeHtml(rec.update_pekerjaan || '')}</textarea>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="form-label mb-0">Upload / Ganti Foto Bukti / Berita Acara (Opsional)</label>
            <button type="button" id="btnCancelQuickEditFoto" class="hidden text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-colors">
              <i class="fa-solid fa-xmark mr-1"></i>Batal Pilih File
            </button>
          </div>
          <input type="file" id="quickEditFotoInput" accept="image/*,application/pdf" class="filter-input w-full text-xs cursor-pointer">
          <div id="quickEditFotoHelp" class="mt-1">
            ${rec.foto_bukti ? `
              <div class="flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-950/30 p-1.5 rounded border border-emerald-500/30">
                <span class="truncate mr-2"><i class="fa-solid fa-file-check mr-1"></i> File: <strong>${escapeHtml(rec.foto_bukti)}</strong></span>
                <label class="flex items-center text-rose-300 hover:text-rose-200 cursor-pointer text-[10px] shrink-0">
                  <input type="checkbox" id="chkDeleteFotoBukti" name="delete_foto_bukti" value="1" class="mr-1 rounded"> Hapus Foto Ini
                </label>
              </div>` : '<span class="text-[10px] text-slate-500 block">Format: JPG, PNG, atau PDF</span>'}
          </div>
        </div>
      `;

      const btnGps = container.querySelector('#btnGetGpsQuickEditSitac');
      const latIn = container.querySelector('#quickEditSitacLat');
      const lngIn = container.querySelector('#quickEditSitacLng');
      if (btnGps && latIn && lngIn) {
        btnGps.addEventListener('click', () => handleGetDeviceGps(latIn, lngIn, btnGps));
        [latIn, lngIn].forEach(inp => {
          inp.addEventListener('paste', (e) => {
            const pasteData = (e.clipboardData || window.clipboardData).getData('text');
            if (parseAndSetCoordinates(pasteData, latIn, lngIn)) {
              e.preventDefault();
            }
          });
        });
      }

      const inpAwal = container.querySelector('#quickEditSitacBiayaAwal');
      const inpFinal = container.querySelector('#quickEditSitacBiayaFinal');
      const txtHemat = container.querySelector('#quickEditSitacHematText');

      function updateSitacHematPreview() {
        if (!inpAwal || !inpFinal || !txtHemat) return;
        const bAwal = Number(inpAwal.value) || 0;
        const bFinal = Number(inpFinal.value) || 0;
        const hemat = Math.max(0, bAwal - bFinal);
        const pct = bAwal > 0 ? ((hemat / bAwal) * 100).toFixed(1) : '0';
        txtHemat.textContent = `${formatRupiah(hemat)} (${pct}%)`;
      }

      if (inpAwal && inpFinal) {
        inpAwal.addEventListener('input', updateSitacHematPreview);
        inpFinal.addEventListener('input', updateSitacHematPreview);
        updateSitacHematPreview();
      }
    } else if (type === 'gangguan') {
      const rec = (state.gangguan.data || []).find(g => g.id == id) || {};
      title.textContent = `Update Tiket Gangguan #${id}`;
      sub.textContent = 'Update status penyelesaian insiden dan catatan penanganan';
      container.innerHTML = `
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Status Penyelesaian *</label>
            <select name="is_selesai" class="filter-select w-full text-xs">
              <option value="1" ${rec.is_selesai === 1 ? 'selected' : ''}>Selesai (Close Incident)</option>
              <option value="0" ${rec.is_selesai === 0 ? 'selected' : ''}>Proses / Open (Sedang Dikerjakan)</option>
            </select>
          </div>
          <div>
            <label class="form-label">Tanggal Selesai</label>
            <input type="date" name="tgl_selesai" class="filter-input w-full text-xs" value="${rec.tgl_selesai || ''}">
          </div>
        </div>
        ${!isLapangan ? `
        <div class="financial-field-group">
          <label class="form-label">Biaya Perbaikan Gangguan (Rp)</label>
          <input type="number" name="biaya_gangguan" class="filter-input w-full text-xs" value="${rec.biaya_gangguan || 0}" placeholder="0">
        </div>` : ''}
        <div>
          <label class="form-label">Catatan Update Penanganan Lapangan</label>
          <textarea name="update_gangguan" rows="2" class="filter-input w-full text-xs" placeholder="Catatan lapangan...">${escapeHtml(rec.update_gangguan || '')}</textarea>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="form-label mb-0">Upload / Ganti Foto Bukti Lapangan (Opsional)</label>
            <button type="button" id="btnCancelQuickEditFoto" class="hidden text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-colors">
              <i class="fa-solid fa-xmark mr-1"></i>Batal Pilih File
            </button>
          </div>
          <input type="file" id="quickEditFotoInput" accept="image/*,application/pdf" class="filter-input w-full text-xs cursor-pointer">
          <div id="quickEditFotoHelp" class="mt-1">
            ${rec.foto_bukti ? `
              <div class="flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-950/30 p-1.5 rounded border border-emerald-500/30">
                <span class="truncate mr-2"><i class="fa-solid fa-file-check mr-1"></i> File: <strong>${escapeHtml(rec.foto_bukti)}</strong></span>
                <label class="flex items-center text-rose-300 hover:text-rose-200 cursor-pointer text-[10px] shrink-0">
                  <input type="checkbox" id="chkDeleteFotoBukti" name="delete_foto_bukti" value="1" class="mr-1 rounded"> Hapus Foto Ini
                </label>
              </div>` : '<span class="text-[10px] text-slate-500 block">Format: JPG, PNG, atau PDF</span>'}
          </div>
        </div>
      `;
    }

    const qeFotoInp = container.querySelector('#quickEditFotoInput');
    const qeBtnCancel = container.querySelector('#btnCancelQuickEditFoto');
    const qeFotoHelp = container.querySelector('#quickEditFotoHelp');
    if (qeFotoInp && qeBtnCancel) {
      qeFotoInp.addEventListener('change', () => {
        if (qeFotoInp.files && qeFotoInp.files.length > 0) {
          qeBtnCancel.classList.remove('hidden');
          if (qeFotoHelp) {
            qeFotoHelp.innerHTML = `<span class="text-[11px] text-emerald-400 font-medium block"><i class="fa-solid fa-file-image mr-1"></i> File dipilih: ${escapeHtml(qeFotoInp.files[0].name)} (${(qeFotoInp.files[0].size / 1024).toFixed(1)} KB)</span>`;
          }
        } else {
          qeBtnCancel.classList.add('hidden');
        }
      });
      qeBtnCancel.addEventListener('click', () => {
        qeFotoInp.value = '';
        qeBtnCancel.classList.add('hidden');
        if (qeFotoHelp) {
          qeFotoHelp.innerHTML = '<span class="text-[10px] text-slate-500 block">Pilihan file dibatalkan. Format: JPG, PNG, atau PDF</span>';
        }
        showToast('Pilihan file foto dibatalkan', 'info');
      });
    }

    overlay.style.display = 'flex';
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // Prepare file for upload: in static/Firebase mode images are compressed and PDFs size-limited
  async function prepareUploadData(file) {
    if (!isStaticMode()) return readFileAsBase64(file);
    if (file.type && file.type.startsWith('image/')) {
      return compressImageToDataUrl(file);
    }
    if (file.size > 700 * 1024) {
      throw new Error('Ukuran file PDF maksimal 700 KB pada mode cloud. Gunakan foto atau kompres PDF terlebih dahulu.');
    }
    return readFileAsBase64(file);
  }

  async function handleQuickEditSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('quickEditTargetType').value;
    const id = document.getElementById('quickEditTargetId').value;
    const form = document.getElementById('formQuickEdit');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...';
    }

    const formData = new FormData(form);
    const payload = {};
    formData.forEach((val, key) => {
      payload[key] = typeof val === 'string' ? val.trim() : val;
    });

    if (state.currentUser?.role === 'lapangan') {
      delete payload.biaya_final;
      delete payload.biaya_permintaan_awal;
      delete payload.biaya_gangguan;
      delete payload.rev_sewa_tahun;
      delete payload.biaya_sewa_tahun;
      delete payload.biaya_otc;
      delete payload.biaya_deposit;
    }

    const chkDeleteFoto = form.querySelector('#chkDeleteFotoBukti');
    if (chkDeleteFoto && chkDeleteFoto.checked) {
      payload.foto_bukti = '';
    }

    const fileInput = document.getElementById('quickEditFotoInput');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      try {
        const file = fileInput.files[0];
        const base64Data = await prepareUploadData(file);
        const upRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            data: base64Data,
            type: type,
            id: id
          })
        });
        const upData = await upRes.json();
        if (!upData.success || !upData.filename) {
          throw new Error(upData.message || 'Server menolak file');
        }
        payload.foto_bukti = upData.filename;
      } catch (upErr) {
        console.error('Upload error in quick edit:', upErr);
        showToast('Gagal mengunggah foto bukti: ' + (upErr.message || upErr), 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
        return;
      }
    }

    try {
      const res = await fetch(`/api/${type}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || 'Perubahan berhasil disimpan ke database!');
        document.getElementById('modalQuickEdit').style.display = 'none';

        // Persist mutation locally and to Google Cloud Firestore
        persistUpdateRecord(type, id, payload);
        const colName = type === 'collo' ? 'collo_records' : (type === 'sitac' ? 'sitac_records' : 'gangguan_records');
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          window.FirebaseManager.updateRecord(colName, String(id), payload).catch(err => {
            console.warn('Firestore async sync notice:', err);
          });
        }

        // Refresh active table
        if (state.activeView === 'view-collo-list') await loadColloData();
        else if (state.activeView === 'view-collo-alerts') await loadAlertsData();
        else if (state.activeView === 'view-collo-rev-sharing') await loadRevSharingData();
        else if (state.activeView === 'view-sitac-pa') await loadSitacData();
        else if (state.activeView === 'view-gangguan') await loadGangguanData();
        else if (state.activeView === 'view-executive') await loadExecutiveSummary();

        // If SITAC, sync in-memory coordinates & refresh map markers dynamically
        if (type === 'sitac') {
          const memRec = (window.SITAC_COLLO_DATA?.sitac_records || []).find(s => s.id == id);
          if (memRec) {
            Object.assign(memRec, payload);
            if (payload.latitude && payload.longitude) {
              memRec.latitude = Number(payload.latitude);
              memRec.longitude = Number(payload.longitude);
              memRec.coord_type = 'EXACT';
            }
          }
          if (leafletMap && mapMarkersLayer) {
            updateMapMarkers();
          }
        }

        // Refresh contract alert bell & counts if collo record was updated
        if (type === 'collo') {
          fetchExpiringContracts(true);
        }
      } else {
        alert(data.message || 'Gagal menyimpan perubahan');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan saat menyimpan.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  }

  async function handleAddFormSubmit(e, endpoint) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...';
    }

    const formData = new FormData(form);
    const payload = {};
    formData.forEach((val, key) => {
      payload[key] = typeof val === 'string' ? val.trim() : val;
    });

    // Enforce identity lock: field technicians can never submit under another person's PIC
    if (state.currentUser?.role === 'lapangan' && (endpoint === 'gangguan' || endpoint === 'sitac')) {
      payload.pic_perijinan = state.currentUser.full_name || state.currentUser.pic_code || state.activeTechnician;
    }

    // Duplicate No PA validation on SITAC creation
    if (endpoint === 'sitac' && payload.no_pa) {
      const dupRec = findDuplicateNoPa(payload.no_pa);
      if (dupRec) {
        showToast(`Nomor PA "${payload.no_pa}" sudah terdaftar di sistem! (ID #${dupRec.id})`, 'error');
        alert(`Nomor PA "${payload.no_pa}" sudah terdaftar di sistem!\nPelanggan: ${dupRec.pelanggan || '-'}\n\nSilakan gunakan nomor PA lain atau edit data yang sudah ada.`);
        const noPaIn = form.querySelector('input[name="no_pa"]');
        if (noPaIn) {
          noPaIn.focus();
          noPaIn.classList.add('border-rose-500');
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
        return;
      }
    }

    const fileInput = form.querySelector('input[type="file"]');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      try {
        const file = fileInput.files[0];
        const base64Data = await prepareUploadData(file);
        const upRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            data: base64Data
          })
        });
        const upData = await upRes.json();
        if (upData.success && upData.filename) {
          payload.foto_bukti = upData.filename;
        }
      } catch (upErr) {
        console.error('Upload error in add form:', upErr);
      }
    }

    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || 'Data baru berhasil ditambahkan!');
        ['modalAddGangguan', 'modalAddSitac', 'modalAddCollo', 'modalPickAddType'].forEach(id => {
          const m = document.getElementById(id);
          if (m) m.style.display = 'none';
        });

        // Reset form inputs
        form.reset();
        const cancelBtn = form.querySelector('button[id^="btnCancelAdd"]');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        const helpText = form.querySelector('span[id$="FotoHelpText"]');
        if (helpText) {
          if (endpoint === 'collo') {
            helpText.textContent = 'Format: JPG, PNG, atau PDF (Lampiran Berita Acara / Kontrak Sewa / SPP)';
          } else {
            helpText.textContent = 'Format: JPG, PNG, atau PDF (Surat izin, kuitansi retribusi, dll.)';
          }
        }

        // Refresh global state & meta
        await loadMetaOptions();
        await loadExecutiveSummary();

        // Refresh view data
        if (endpoint === 'gangguan') {
          const newId = data.id || data.record?.id || (Date.now());
          const newRec = data.record || {
            id: newId,
            ...payload
          };
          if (window.SITAC_COLLO_DATA?.gangguan_records) {
            const exists = window.SITAC_COLLO_DATA.gangguan_records.find(g => g.id === newId || (g.no_tiket && newRec.no_tiket && String(g.no_tiket).trim().toLowerCase() === String(newRec.no_tiket).trim().toLowerCase()));
            if (!exists) {
              window.SITAC_COLLO_DATA.gangguan_records.unshift(newRec);
            }
          }
          persistNewRecord('gangguan', newRec);
          if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
            window.FirebaseManager.addRecord('gangguan_records', newRec).catch(() => {});
          }
          await loadGangguanData();
          if (state.activeView !== 'view-gangguan') switchView('view-gangguan');
        } else if (endpoint === 'sitac') {
          // If SITAC, register newly added coordinates & refresh map markers dynamically
          const newId = data.id || data.record?.id || (Date.now());
          const newRec = data.record || {
            id: newId,
            ...payload,
            latitude: (payload.latitude && payload.longitude) ? Number(payload.latitude) : null,
            longitude: (payload.latitude && payload.longitude) ? Number(payload.longitude) : null,
            coord_type: (payload.latitude && payload.longitude) ? 'EXACT' : null
          };
          if (window.SITAC_COLLO_DATA?.sitac_records) {
            const exists = window.SITAC_COLLO_DATA.sitac_records.find(s => s.id === newId || (s.no_pa && newRec.no_pa && String(s.no_pa).trim().toLowerCase() === String(newRec.no_pa).trim().toLowerCase()));
            if (!exists) {
              window.SITAC_COLLO_DATA.sitac_records.unshift(newRec);
            }
          }
          persistNewRecord('sitac', newRec);
          if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
            window.FirebaseManager.addRecord('sitac_records', newRec).catch(() => {});
          }
          if (leafletMap && mapMarkersLayer) {
            updateMapMarkers();
          }
          await loadSitacData();
          if (state.activeView !== 'view-sitac-pa') switchView('view-sitac-pa');
        } else if (endpoint === 'collo') {
          const newId = data.id || data.record?.id || (Date.now());
          const newRec = data.record || {
            id: newId,
            ...payload
          };
          if (window.SITAC_COLLO_DATA?.collo_records) {
            const exists = window.SITAC_COLLO_DATA.collo_records.find(c => c.id === newId);
            if (!exists) window.SITAC_COLLO_DATA.collo_records.unshift(newRec);
          }
          persistNewRecord('collo', newRec);
          if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
            window.FirebaseManager.addRecord('collo_records', newRec).catch(() => {});
          }
          await loadColloData();
          if (state.activeView !== 'view-collo-list') switchView('view-collo-list');
        }
      } else {
        alert(data.message || 'Gagal menambahkan data');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan atau server saat menyimpan data.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  }

  // =========================================================================
  // FIELD OPERATIONS: DIRECT MODAL PHOTO UPLOAD & WHATSAPP COORDINATION
  // =========================================================================
  async function uploadBuktiDirect(type, id, fileInput) {
    if (!fileInput.files || !fileInput.files[0]) return;
    const colName = type === 'sitac' ? 'sitac_records' : (type === 'gangguan' ? 'gangguan_records' : 'collo_records');
    const targetRec = (window.SITAC_COLLO_DATA?.[colName] || []).find(r => r.id == id) ||
                      (state.sitac?.data || []).find(s => s.id == id) ||
                      (state.colleagues?.data || []).find(s => s.id == id) ||
                      (state.gangguan?.data || []).find(g => g.id == id) ||
                      (state.collo?.data || []).find(c => c.id == id);
    if (!isTaskEditableByUser(targetRec)) {
      showToast('Akses ditolak: Anda tidak memiliki izin untuk mengunggah bukti pada penugasan ini (Mode Lihat Saja).', 'error');
      fileInput.value = '';
      return;
    }

    const file = fileInput.files[0];
    const container = fileInput.closest('.col-span-2') || fileInput.parentElement;
    const prevHtml = container.innerHTML;

    container.innerHTML = `
      <div class="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 text-center text-xs text-cyan-400">
        <i class="fa-solid fa-spinner fa-spin mr-2"></i> Mengunggah file bukti lapangan (${escapeHtml(file.name)})...
      </div>
    `;

    try {
      const base64Data = await prepareUploadData(file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          data: base64Data,
          type: type,
          id: id
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengunggah file bukti');
      }

      showToast('Foto bukti lapangan berhasil disimpan!');

      // Update in memory master data
      const memRec = (window.SITAC_COLLO_DATA?.[colName] || []).find(r => r.id == id);
      if (memRec && data.filename) {
        memRec.foto_bukti = data.filename;
      }

      // Reload dataset to update in memory
      if (type === 'gangguan') await loadGangguanData();
      else if (type === 'sitac') await loadSitacData();
      else if (type === 'collo') await loadColloData();

      // Refresh Detail Modal immediately to show preview
      openDetailModal(type, id);
    } catch (err) {
      console.error(err);
      showToast('Gagal mengunggah bukti: ' + err.message, 'error');
      alert('Gagal mengunggah bukti: ' + err.message);
      container.innerHTML = prevHtml;
    }
  }
  window.uploadBuktiDirect = uploadBuktiDirect;

  async function deleteBuktiDirect(type, id) {
    const colName = type === 'sitac' ? 'sitac_records' : (type === 'gangguan' ? 'gangguan_records' : 'collo_records');
    const targetRec = (window.SITAC_COLLO_DATA?.[colName] || []).find(r => r.id == id) ||
                      (state.sitac?.data || []).find(s => s.id == id) ||
                      (state.colleagues?.data || []).find(s => s.id == id) ||
                      (state.gangguan?.data || []).find(g => g.id == id) ||
                      (state.collo?.data || []).find(c => c.id == id);
    if (!isTaskEditableByUser(targetRec)) {
      showToast('Akses ditolak: Anda tidak memiliki izin untuk menghapus bukti pada penugasan ini (Mode Lihat Saja).', 'error');
      return;
    }

    if (!confirm('Apakah Anda yakin ingin membatalkan / menghapus foto bukti lapangan ini?')) return;

    const container = document.getElementById('detailPhotoSectionWrap');
    if (container) {
      container.innerHTML = `
        <div class="col-span-2 p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-center text-xs text-rose-300">
          <i class="fa-solid fa-spinner fa-spin mr-2"></i> Menghapus foto bukti lapangan...
        </div>
      `;
    }

    try {
      if (!isStaticMode()) {
        const res = await fetch('/api/upload/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Gagal menghapus file bukti');
        }
      }

      // Update in memory master dataset
      const colName = type === 'sitac' ? 'sitac_records' : (type === 'gangguan' ? 'gangguan_records' : 'collo_records');
      if (window.SITAC_COLLO_DATA?.[colName]) {
        const memRec = window.SITAC_COLLO_DATA[colName].find(r => r.id == id);
        if (memRec) memRec.foto_bukti = null;
      }

      // Update Firebase Firestore if active
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        try {
          await window.FirebaseManager.saveDocument(colName, String(id), { foto_bukti: null });
        } catch (fbErr) {
          console.warn('Firestore photo delete notice:', fbErr);
        }
      }

      // Reload active table data
      if (type === 'gangguan') await loadGangguanData();
      else if (type === 'sitac') await loadSitacData();
      else if (type === 'collo') await loadColloData();

      showToast('Foto bukti lapangan berhasil dihapus!', 'info');

      // Reopen Detail Modal to return to empty upload dropzone
      openDetailModal(type, id);
    } catch (err) {
      console.error('Delete photo error:', err);
      showToast('Gagal menghapus foto bukti: ' + err.message, 'error');
      alert('Gagal menghapus foto bukti: ' + err.message);
      openDetailModal(type, id);
    }
  }
  window.deleteBuktiDirect = deleteBuktiDirect;

  function renderPhotoBuktiSection(rec, type, id) {
    const canEdit = isTaskEditableByUser(rec);
    const foto = rec.foto_bukti;
    const isImage = foto && fotoIsImage(foto);
    const isPdf = foto && fotoIsPdf(foto);
    const url = foto ? fotoUrl(foto) : '';
    const name = foto ? fotoDisplayName(foto) : '';

    if (foto) {
      return `
        <div class="col-span-2 p-3.5 bg-slate-900/90 rounded-xl border border-white/10 mt-2" id="detailPhotoSectionWrap">
          <div class="flex items-center justify-between mb-2.5">
            <span class="text-[11px] font-bold tracking-wider uppercase text-cyan-400 flex items-center gap-1.5">
              <i class="fa-solid fa-camera"></i> Dokumen / Foto Bukti Lapangan
            </span>
            <div class="flex items-center gap-2">
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[11px] text-cyan-300 hover:text-cyan-200 underline flex items-center gap-1 font-semibold">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Buka File Penuh
              </a>
              ${canEdit ? `
              <button type="button" class="text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer" onclick="document.getElementById('detailDirectFileInput').click()" title="Ganti dengan foto lain">
                <i class="fa-solid fa-arrows-rotate mr-1"></i> Ganti
              </button>
              <button type="button" class="btn-delete-photo text-[10px] px-2 py-0.5 rounded border cursor-pointer flex items-center gap-1" onclick="window.deleteBuktiDirect('${type}', ${id})" title="Batalkan atau hapus foto bukti">
                <i class="fa-solid fa-trash-can text-rose-400"></i> Hapus Foto
              </button>` : ''}
            </div>
          </div>
          ${isImage ? `
            <div class="bukti-foto-card group relative cursor-pointer" onclick="window.open('${url}', '_blank')">
              <img src="${url}" alt="Foto Bukti Lapangan" class="w-full max-h-56 object-cover rounded-lg border border-white/5 transition duration-300 group-hover:scale-[1.01]" onerror="this.onerror=null; this.closest('.bukti-foto-card').innerHTML='<div class=\\'p-3 rounded-lg bg-slate-900/80 border border-white/10 text-center text-xs text-slate-400\\'><i class=\\'fa-solid fa-circle-exclamation text-amber-400 mr-1\\'></i> File bukti fisik belum diunggah atau tidak ditemukan di server.</div>';">
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2.5">
                <span class="text-xs text-white font-medium"><i class="fa-solid fa-magnifying-glass-plus mr-1"></i> Klik untuk memperbesar foto</span>
              </div>
            </div>
          ` : isPdf ? `
            <div class="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <i class="fa-solid fa-file-pdf text-rose-400 text-2xl"></i>
                <div>
                  <div class="text-xs font-semibold text-slate-200">${escapeHtml(name)}</div>
                  <div class="text-[10px] text-slate-400">Lampiran Dokumen Berita Acara / Surat Izin PDF</div>
                </div>
              </div>
              <a href="${url}" target="_blank" class="btn btn-secondary text-xs py-1 px-3">
                <i class="fa-solid fa-file-arrow-down mr-1"></i> Unduh / Buka
              </a>
            </div>
          ` : `
            <div class="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <i class="fa-solid fa-file-lines text-cyan-400 text-xl"></i>
                <div class="text-xs text-slate-200">${escapeHtml(name)}</div>
              </div>
              <a href="${url}" target="_blank" class="btn btn-secondary text-xs py-1 px-3">Buka File</a>
            </div>
          `}
          ${canEdit ? `<input type="file" id="detailDirectFileInput" accept="image/*,application/pdf" style="display:none;" onchange="window.uploadBuktiDirect('${type}', ${id}, this)">` : ''}
        </div>
      `;
    } else {
      if (!canEdit) {
        return `
          <div class="col-span-2 mt-2">
            <div class="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-slate-900/60">
              <div class="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center shrink-0 border border-white/5">
                <i class="fa-solid fa-camera text-sm"></i>
              </div>
              <div class="text-left">
                <div class="text-xs font-semibold text-slate-300">Belum Ada Foto Bukti Lapangan</div>
                <div class="text-[10px] text-slate-500">Dokumen atau foto fisik belum diunggah untuk penugasan ini (Mode Lihat Saja).</div>
              </div>
            </div>
          </div>
        `;
      }
      return `
        <div class="col-span-2 mt-2">
          <div class="upload-dropzone flex items-center justify-between p-3.5 cursor-pointer hover:border-cyan-500/50 transition rounded-xl border border-dashed border-white/10 bg-slate-900/60" onclick="document.getElementById('detailDirectFileInput').click()">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <i class="fa-solid fa-cloud-arrow-up text-lg"></i>
              </div>
              <div class="text-left">
                <div class="text-xs font-bold text-slate-200">Belum Ada Bukti yang Diupload</div>
                <div class="text-[10px] text-slate-400">Klik di sini untuk mengunggah foto fisik tiang, FO cut, atau dokumen berita acara</div>
              </div>
            </div>
            <button type="button" class="btn btn-secondary text-[11px] py-1.5 px-3 pointer-events-none">
              Upload Bukti
            </button>
          </div>
          <input type="file" id="detailDirectFileInput" accept="image/*,application/pdf" style="display:none;" onchange="window.uploadBuktiDirect('${type}', ${id}, this)">
        </div>
      `;
    }
  }

  function shareDetailToWhatsApp(type, id) {
    openWhatsAppDispatchModal(type, id);
  }

  function cleanPhoneNumber(str) {
    if (!str) return '';
    let cleaned = String(str).replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    return cleaned;
  }

  function openWhatsAppDispatchModal(type, id) {
    let msg = '';
    let defaultPhone = '';
    let targetTitle = 'Kirim Pesan WhatsApp';
    let targetSubtitle = 'Notifikasi & Dispatch Operasional';

    if (type === 'collo-alert') {
      const rec = (state.alerts?.data || []).find(c => c.id == id) || (state.collo?.data || []).find(c => c.id == id) || (window.SITAC_COLLO_DATA?.collo_records || []).find(c => c.id == id);
      if (!rec) return;

      const pengelola = rec.pengelola || 'Mitra Pengelola Data Center';
      const sisaHariText = rec.sisa_hari !== undefined ? `${rec.sisa_hari} Hari` : '-';
      const statusUrgency = (rec.sisa_hari !== undefined && rec.sisa_hari <= 30) ? '🔴 KRITIS (H-30)' : (rec.sisa_hari !== undefined && rec.sisa_hari <= 60) ? '🟠 PERINGATAN (H-60)' : '🟡 PANTAUAN (H-90)';
      const soOrSid = rec.sid ? `SID: ${escapeHtml(rec.sid)}` : rec.no_so ? `SO: ${escapeHtml(rec.no_so)}` : '-';
      const soSidText = (rec.sid && rec.no_so) ? `${rec.sid} / ${rec.no_so}` : (rec.sid || rec.no_so || '-');
      
      targetTitle = 'Pengingat Jatuh Tempo Kontrak';
      targetSubtitle = `${escapeHtml(pengelola)} • ${soOrSid}`;
      defaultPhone = cleanPhoneNumber(rec.telp || '');

      msg = `🔔 *PENGINGAT JATUH TEMPO KONTRAK SEWA*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Kepada Yth. Rekan *${pengelola}*,\n\n` +
            `Menginformasikan bahwa kontrak sewa sirkuit telekomunikasi berikut akan segera jatuh tempo:\n\n` +
            `▫️ *Pelanggan:* ${rec.pelanggan || '-'}\n` +
            `▫️ *SID / No SO:* ${soSidText}\n` +
            `▫️ *Layanan:* ${rec.layanan || rec.jenis_sewa || '-'}\n` +
            `▫️ *Site / Titik:* ${rec.site || rec.terminating || '-'}\n` +
            `▫️ *Tgl Jatuh Tempo:* ${rec.end_date || '-'} (*Sisa ${sisaHariText}*)\n` +
            `▫️ *Status Urgensi:* ${statusUrgency}\n` +
            `▫️ *PIC Admin:* ${rec.pic_admin || '-'}\n` +
            `▫️ *Status Proses:* ${rec.proses_admin || 'Running'}\n\n` +
            `Mohon bantuan konfirmasi terkait proses perpanjangan / penerbitan SPP / PO Baru sirkuit tersebut.\n\n` +
            `Terima kasih atas kerja sama dan dukungannya.\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `_PT PLN Icon Plus - Telecom Operations Portal_`;

    } else if (type === 'collo') {
      const rec = (state.collo?.data || []).find(c => c.id == id) || (state.alerts?.data || []).find(c => c.id == id) || (state.revSharing?.data || []).find(c => c.id == id) || (window.SITAC_COLLO_DATA?.collo_records || []).find(c => c.id == id);
      if (!rec) return;

      const soOrSid = rec.sid ? `SID: ${escapeHtml(rec.sid)}` : rec.no_so ? `SO: ${escapeHtml(rec.no_so)}` : '-';
      const soSidText = (rec.sid && rec.no_so) ? `${rec.sid} / ${rec.no_so}` : (rec.sid || rec.no_so || '-');

      targetTitle = 'Informasi Kontrak Colocation';
      targetSubtitle = `${escapeHtml(rec.pengelola || '-')} • ${soOrSid}`;
      defaultPhone = cleanPhoneNumber(rec.telp || '');

      msg = `🏢 *INFORMASI KONTRAK SEWA COLOCATION*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `*Pengelola:* ${rec.pengelola || '-'}\n` +
            `*Pelanggan:* ${rec.pelanggan || '-'}\n` +
            `*Status Sirkuit:* ${rec.status || 'ACTIVE'}\n` +
            `*No SO / SID:* ${soSidText}\n` +
            `*Layanan:* ${rec.layanan || rec.jenis_sewa || '-'}\n` +
            `*Biaya Sewa / Thn:* ${formatRupiah(rec.biaya_sewa_tahun)}\n` +
            `*Masa Berlaku:* ${rec.start_date || '-'} s/d ${rec.end_date || '-'} (Sisa ${rec.sisa_hari !== undefined ? rec.sisa_hari + ' Hari' : '-'})\n` +
            `*PIC Rekanan:* ${rec.pic_rekanan || '-'} (${rec.telp || '-'})\n` +
            `*Catatan:* ${rec.keterangan || '-'}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `_PT PLN Icon Plus - Telecom Operations Portal_`;

    } else if (type === 'sitac') {
      const rec = (state.sitac?.data || []).find(s => s.id == id) || (window.SITAC_COLLO_DATA?.sitac_records || []).find(s => s.id == id);
      if (!rec) return;

      const picName = formatPicName(rec.pic_perijinan || 'Tim Lapangan');
      const koordinatLink = (rec.latitude && rec.longitude) ? `\n- *Titik Lokasi (GPS):* https://www.google.com/maps/search/?api=1&query=${rec.latitude},${rec.longitude}` : '';

      targetTitle = 'Dispatch Penugasan SITAC';
      targetSubtitle = `No PA: ${escapeHtml(rec.no_pa || '-')} • ${escapeHtml(picName)}`;

      msg = `*DISPATCH PENUGASAN SITAC & PERIZINAN*\n` +
            `-----------------------------------------\n` +
            `Halo Rekan *${picName}*,\n\n` +
            `Mohon tindak lanjut dan laporan progres berkas perizinan berikut:\n\n` +
            `- *No PA:* ${rec.no_pa || '-'}\n` +
            `- *Pelanggan:* ${rec.pelanggan || '-'}\n` +
            `- *Rute / Lokasi:* ${rec.terminating || '-'}\n` +
            `- *Status Pengerjaan:* ${rec.progress || 'Ongoing'}\n` +
            `- *Tgl Disposisi:* ${rec.date_dispos || '-'}\n` +
            `- *Aging (SLA):* ${rec.durasi_hari !== null && rec.durasi_hari !== undefined ? rec.durasi_hari + ' Hari' : '-'}\n` +
            `- *Pengajuan Biaya:* ${formatRupiah(rec.biaya_permintaan_awal)}\n` +
            `- *Target Negosiasi:* ${formatRupiah(rec.biaya_final)}${koordinatLink}\n` +
            `- *Catatan Lapangan:* ${rec.update_pekerjaan || 'Mohon segera dilaporkan'}\n\n` +
            `Mohon diupdate apabila terdapat kesepakatan nilai retribusi atau kendala perizinan.\n` +
            `Terima kasih dan tetap utamakan keselamatan kerja (K3).\n` +
            `-----------------------------------------\n` +
            `_PT PLN Icon Plus - Operasional SITAC Lapangan_`;

    } else if (type === 'gangguan') {
      const rec = (state.gangguan?.data || []).find(g => g.id == id);
      if (!rec) return;
      const statusText = rec.is_selesai ? '✅ *STATUS: SELESAI (CLOSED)*' : '⏳ *STATUS: DALAM PENANGANAN (OPEN)*';
      targetTitle = 'Laporan Tiket Gangguan';
      targetSubtitle = `Tiket: ${escapeHtml(rec.no_tiket || '-')}`;
      msg = `🚨 *LAPORAN INSIDEN GANGGUAN DARURAT*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `*No Tiket:* ${rec.no_tiket || '-'}\n` +
            `*Jenis:* ${rec.jenis_gangguan || 'Insiden FO'}\n` +
            `${statusText}\n` +
            `*Target SLA:* ${rec.sla_target || 'H+1'}\n` +
            `*PIC Teknis:* ${rec.pic_perijinan || '-'}\n` +
            `*Lokasi Kejadian:* ${rec.terminating || '-'}\n` +
            `*Catatan Lapangan:* ${rec.update_gangguan || '-'}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `_PT PLN Icon Plus - Telecom Operations Portal_`;
    }

    const modal = document.getElementById('modalWhatsAppDispatch');
    const titleEl = document.getElementById('waModalTitle');
    const subEl = document.getElementById('waModalSubtitle');
    const phoneInput = document.getElementById('waTargetPhone');
    const textArea = document.getElementById('waMessageText');
    const charCount = document.getElementById('waCharCount');

    if (titleEl) titleEl.textContent = targetTitle;
    if (subEl) subEl.innerHTML = targetSubtitle;
    if (phoneInput) phoneInput.value = defaultPhone;
    if (textArea) {
      textArea.value = msg;
      if (charCount) charCount.textContent = `${msg.length} karakter`;
      textArea.oninput = () => {
        if (charCount) charCount.textContent = `${textArea.value.length} karakter`;
      };
    }

    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => textArea?.focus(), 100);
    }
  }

  async function openDetailModal(type, id, fallbackIdentifier) {
    const overlay = document.getElementById('modalDetail');
    const content = document.getElementById('detailContent');
    const title = document.getElementById('detailTitle');
    const sub = document.getElementById('detailSubtitle');

    if (!overlay || !content) return;

    if (type === 'collo') {
      const isLapangan = state.currentUser?.role === 'lapangan';
      let rec = (state.collo?.data || []).find(c => c.id == id) ||
                (state.alerts?.data || []).find(c => c.id == id) ||
                (state.revSharing?.data || []).find(c => c.id == id) ||
                (window.SITAC_COLLO_DATA?.collo_records || []).find(c => c.id == id);

      // Fallback search by fallbackIdentifier or if id is passed as string / SO number
      if (!rec && fallbackIdentifier) {
        rec = (state.collo?.data || []).find(c => c.no_so == fallbackIdentifier || c.sid == fallbackIdentifier) ||
              (window.SITAC_COLLO_DATA?.collo_records || []).find(c => c.no_so == fallbackIdentifier || c.sid == fallbackIdentifier);
      }

      if (!rec && typeof id === 'string') {
        rec = (state.collo?.data || []).find(c => c.no_so == id || c.sid == id) ||
              (window.SITAC_COLLO_DATA?.collo_records || []).find(c => c.no_so == id || c.sid == id);
      }

      // Fallback search via network_links
      if (!rec && window.SITAC_COLLO_DATA?.network_links) {
        const link = window.SITAC_COLLO_DATA.network_links.find(l => l.id == id || l.collo_id == id);
        if (link && link.no_so) {
          rec = (window.SITAC_COLLO_DATA?.collo_records || []).find(c => c.no_so == link.no_so);
        }
      }

      // If still not found and backend API is reachable, attempt to fetch
      if (!rec) {
        try {
          const res = await fetch(`/api/collo-records/${id}`);
          if (res.ok) rec = await res.json();
        } catch (e) {
          console.warn('Could not fetch collo record from server:', e);
        }
      }

      if (!rec) {
        showToast('Data rincian kontrak Colocation tidak ditemukan', 'warning');
        return;
      }

      const allPelangganList = (rec.pelanggan || '').split(/[\r\n]+/).map(s => s.trim().replace(/^\d+[\.\)]\s*/, '')).filter(Boolean);
      const firstPel = allPelangganList[0] || 'Colocation';
      const allSos = String(rec.no_so || '').split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
      const firstSo = allSos[0] || '-';
      const soDisplay = allSos.length > 1 ? `${firstSo} (+${allSos.length - 1} SO)` : firstSo;

      title.textContent = `Rincian Kontrak: ${firstPel}`;
      sub.textContent = `SID: ${rec.sid || '-'} | NO SO: ${soDisplay}`;

      let pelangganDetailHtml = '';
      if (allPelangganList.length > 1) {
        const pCounts = {};
        allPelangganList.forEach(p => { pCounts[p] = (pCounts[p] || 0) + 1; });
        pelangganDetailHtml = `
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2">
            <span class="text-slate-500 uppercase block mb-1.5 font-bold text-[10px]">Daftar Pelanggan / Tenant (${allPelangganList.length} Entri &bull; ${Object.keys(pCounts).length} Tenant Unik)</span>
            <div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              ${Object.entries(pCounts).map(([name, count]) => `
                <span class="badge-pill bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-[11px]">
                  ${escapeHtml(name)} ${count > 1 ? `<strong class="text-cyan-300">(${count}×)</strong>` : ''}
                </span>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        pelangganDetailHtml = `
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2">
            <span class="text-slate-500 uppercase block text-[10px] font-bold">Pelanggan</span>
            <span class="font-bold text-slate-100">${escapeHtml(rec.pelanggan || '-')}</span>
          </div>
        `;
      }

      const financialSection = !isLapangan ? `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs mb-3">
          <div class="p-2.5 sm:p-3 bg-emerald-950/30 rounded-lg border border-emerald-500/20 overflow-hidden min-w-0" title="${formatRupiah(rec.rev_sewa_tahun)}">
            <span class="text-slate-400 uppercase text-[10px] block font-semibold truncate">Rev Sewa (1 Thn) Pelanggan</span>
            <span class="font-bold text-xs sm:text-sm text-emerald-400 font-mono mt-0.5 block truncate tracking-tight">${formatRupiah(rec.rev_sewa_tahun)}</span>
          </div>
          <div class="p-2.5 sm:p-3 bg-purple-950/30 rounded-lg border border-purple-500/20 overflow-hidden min-w-0" title="${rec.biaya_otc > 0 ? formatRupiah(rec.biaya_otc) : 'Rp 0'}">
            <span class="text-slate-400 uppercase text-[10px] block font-semibold truncate">Biaya OTC</span>
            <span class="font-bold text-xs sm:text-sm text-purple-400 font-mono mt-0.5 block truncate tracking-tight">${rec.biaya_otc > 0 ? formatRupiah(rec.biaya_otc) : 'Rp 0'}</span>
          </div>
          <div class="p-2.5 sm:p-3 bg-blue-950/30 rounded-lg border border-blue-500/20 overflow-hidden min-w-0" title="${rec.biaya_deposit > 0 ? formatRupiah(rec.biaya_deposit) : 'Rp 0'}">
            <span class="text-slate-400 uppercase text-[10px] block font-semibold truncate">Biaya Deposito</span>
            <span class="font-bold text-xs sm:text-sm text-blue-400 font-mono mt-0.5 block truncate tracking-tight">${rec.biaya_deposit > 0 ? formatRupiah(rec.biaya_deposit) : 'Rp 0'}</span>
          </div>
          <div class="p-2.5 sm:p-3 bg-amber-950/30 rounded-lg border border-amber-500/20 overflow-hidden min-w-0" title="${formatRupiah(rec.biaya_sewa_tahun)}">
            <span class="text-slate-400 uppercase text-[10px] block font-semibold truncate">Biaya Sewa 1 Tahun</span>
            <span class="font-bold text-xs sm:text-sm text-amber-400 font-mono mt-0.5 block truncate tracking-tight">${formatRupiah(rec.biaya_sewa_tahun)}</span>
          </div>
        </div>
      ` : `
        <div class="p-2.5 bg-slate-900/60 rounded-lg border border-cyan-500/20 text-xs text-slate-400 mb-3 flex items-center justify-between">
          <span class="flex items-center gap-1.5"><i class="fa-solid fa-lock text-amber-400"></i> Informasi Finansial (Biaya/Margin) dibatasi untuk Manajemen / Administrator</span>
          <span class="badge-pill bg-slate-800 text-cyan-300 text-[10px]">Akses Lapangan</span>
        </div>
      `;

      const marginRevSharingHtml = !isLapangan ? `
        <div class="p-2.5 bg-slate-900 rounded border border-white/5 overflow-hidden min-w-0" title="${formatRupiah(rec.margin_rupiah)} (${rec.margin_persen}%)"><span class="text-slate-500 uppercase block truncate">Margin (Rev - Biaya)</span><span class="font-bold text-cyan-400 font-mono text-xs sm:text-sm truncate block">${formatRupiah(rec.margin_rupiah)} (${rec.margin_persen}%)</span></div>
        <div class="p-2.5 bg-slate-900 rounded border border-white/5 overflow-hidden min-w-0" title="${escapeHtml(rec.rev_sharing_raw || '-')}"><span class="text-slate-500 uppercase block truncate">Rev Sharing</span><span class="font-bold text-amber-400 font-mono text-xs sm:text-sm truncate block">${escapeHtml(rec.rev_sharing_raw || '-')}</span></div>
      ` : '';

      content.innerHTML = `
        ${financialSection}
        <div class="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Status</span><span class="font-bold text-sm text-slate-100 truncate block">${escapeHtml(rec.status)}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Layanan / Jenis</span><span class="font-bold text-sm text-slate-100 truncate block">${escapeHtml(rec.layanan || rec.jenis_sewa || '-')}</span></div>
          ${marginRevSharingHtml}
          ${pelangganDetailHtml}
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Masa Berlaku</span><span class="font-mono text-slate-200 text-xs sm:text-sm truncate block">${rec.start_date || '-'} s/d ${rec.end_date || '-'} (Sisa ${rec.sisa_hari !== undefined && rec.sisa_hari !== null ? rec.sisa_hari : '-'} Hari)</span></div>
          ${rec.site ? `<div class="p-2.5 bg-slate-900 rounded border border-emerald-500/25 col-span-2 flex items-center justify-between overflow-hidden min-w-0"><span class="text-emerald-400 uppercase text-[10px] font-semibold flex items-center gap-1.5 shrink-0"><i class="fa-solid fa-server"></i> Site / Titik Jaringan</span><span class="font-bold text-slate-100 text-xs truncate max-w-[65%]" title="${escapeHtml(rec.site)}">${escapeHtml(rec.site)}</span></div>` : ''}
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Originating / Terminating</span><span class="text-slate-200 text-xs truncate block" title="${escapeHtml(rec.originating || '-')} &rarr; ${escapeHtml(rec.terminating || '-')}">${escapeHtml(rec.originating || '-')} &rarr; ${escapeHtml(rec.terminating || '-')}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Admin & Kontak</span><span class="text-slate-200 text-xs truncate block" title="PIC Admin: ${escapeHtml(rec.pic_admin || '-')} | Rekanan: ${escapeHtml(rec.pic_rekanan || '-')} (${escapeHtml(rec.telp || '-')})">PIC Admin: ${escapeHtml(rec.pic_admin || '-')} | Rekanan: ${escapeHtml(rec.pic_rekanan || '-')} (${escapeHtml(rec.telp || '-')})</span></div>
          ${rec.keterangan ? `<div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Catatan / Keterangan</span><span class="text-slate-300 text-xs">${escapeHtml(rec.keterangan)}</span></div>` : ''}
          ${renderPhotoBuktiSection(rec, type, id)}
        </div>
      `;
    } else if (type === 'sitac') {
      let rec = (state.sitac?.data || []).find(s => s.id == id) || (window.SITAC_COLLO_DATA?.sitac_records || []).find(s => s.id == id);
      if (!rec) {
        try {
          const res = await fetch(`/api/sitac-records/${id}`);
          if (res.ok) rec = await res.json();
        } catch (e) {
          console.warn('Could not fetch sitac detail:', e);
        }
      }
      if (!rec) {
        showToast('Data rincian SITAC tidak ditemukan', 'warning');
        return;
      }

      const isLapangan = state.currentUser?.role === 'lapangan';
      const firstSitacPel = (rec.pelanggan || '').split(/[\r\n]+/)[0]?.replace(/^\d+[\.\)]\s*/, '') || '-';
      title.textContent = `Penugasan PA: ${rec.no_pa || '-'}`;
      sub.textContent = `${firstSitacPel}`;

      const financialSection = !isLapangan ? `
        <div class="p-2.5 bg-slate-900 rounded border border-white/5 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Biaya Pengajuan</span><span class="font-bold text-slate-300 font-mono text-xs sm:text-sm truncate block" title="${formatRupiah(rec.biaya_permintaan_awal)}">${formatRupiah(rec.biaya_permintaan_awal)}</span></div>
        <div class="p-2.5 bg-slate-900 rounded border border-white/5 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Realisasi Final</span><span class="font-bold text-amber-400 font-mono text-xs sm:text-sm truncate block" title="${formatRupiah(rec.biaya_final)}">${formatRupiah(rec.biaya_final)}</span></div>
        <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Penghematan Negosiasi</span><span class="font-bold text-emerald-400 font-mono text-xs sm:text-sm truncate block" title="${formatRupiah(rec.efisiensi_rupiah)} (${rec.efisiensi_persen}%)">${formatRupiah(rec.efisiensi_rupiah)} (${rec.efisiensi_persen}%)</span></div>
        ${rec.sewa_otc > 0 ? `<div class="p-2.5 bg-slate-900 rounded border border-white/5 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Biaya OTC</span><span class="font-bold text-purple-400 font-mono text-xs sm:text-sm truncate block" title="${formatRupiah(rec.sewa_otc)}">${formatRupiah(rec.sewa_otc)}</span></div>` : ''}
        ${rec.biaya_sewa_bulan > 0 ? `<div class="p-2.5 bg-slate-900 rounded border border-white/5 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Biaya Sewa / Bulan</span><span class="font-bold text-amber-400 font-mono text-xs sm:text-sm truncate block" title="${formatRupiah(rec.biaya_sewa_bulan)}">${formatRupiah(rec.biaya_sewa_bulan)}</span></div>` : ''}
      ` : '';

      const hasCoords = rec.latitude !== null && rec.latitude !== undefined && rec.longitude !== null && rec.longitude !== undefined && String(rec.latitude).trim() !== '' && String(rec.longitude).trim() !== '';
      const coordsHtml = hasCoords ? `
        <div class="p-2.5 bg-slate-900/90 rounded-lg border border-cyan-500/30 col-span-2 flex items-center justify-between">
          <div>
            <span class="text-cyan-400 uppercase text-[10px] block font-semibold flex items-center gap-1.5">
              <i class="fa-solid fa-map-location-dot"></i> Koordinat Lokasi WebGIS (Pin Aktif)
            </span>
            <span class="font-mono text-slate-100 text-xs mt-0.5 block">${rec.latitude}, ${rec.longitude}</span>
          </div>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${rec.latitude},${rec.longitude}`)}" target="_blank" rel="noopener noreferrer" class="btn-gmaps-link px-3 py-1.5 text-xs font-semibold">
            <i class="fa-brands fa-google text-rose-400 mr-1"></i> Buka Google Maps
          </a>
        </div>` : `
        <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2 flex items-center justify-between text-slate-400 text-xs">
          <span class="text-[11px]"><i class="fa-solid fa-map-pin mr-1.5 text-slate-500"></i> Belum ada titik GPS terverifikasi</span>
          ${isTaskEditableByUser(rec) ? `
          <button type="button" class="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20" onclick="document.getElementById('modalDetail').style.display='none'; openQuickEditModal('sitac', ${rec.id})">
            + Tambahkan Koordinat
          </button>` : ''}
        </div>`;

      content.innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="p-2.5 bg-slate-900 rounded border border-white/5"><span class="text-slate-500 uppercase block">Status</span><span class="font-bold text-sm text-slate-100">${escapeHtml(rec.progress)}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5"><span class="text-slate-500 uppercase block">PIC SITAC</span><span class="font-bold text-sm text-slate-100">${escapeHtml(formatPicName(rec.pic_perijinan || '-'))}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5"><span class="text-slate-500 uppercase block">Tanggal Disposisi</span><span class="font-mono text-slate-200">${rec.date_dispos || '-'}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5"><span class="text-slate-500 uppercase block">Tanggal Selesai</span><span class="font-mono text-slate-200">${rec.date_close || '-'}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2"><span class="text-slate-500 uppercase block">Durasi Pengerjaan (SLA)</span><span class="font-mono text-slate-200">${rec.durasi_hari !== null && rec.durasi_hari !== undefined ? rec.durasi_hari + ' Hari' : '-'}</span></div>
          ${financialSection}
          ${coordsHtml}
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2"><span class="text-slate-500 uppercase block">Terminating</span><span class="text-slate-200">${escapeHtml(rec.terminating || '-')}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2"><span class="text-slate-500 uppercase block">Catatan Update Lapangan</span><span class="text-slate-200">${escapeHtml(rec.update_pekerjaan || 'Tidak ada catatan')}</span></div>
          ${renderPhotoBuktiSection(rec, type, id)}
        </div>
      `;
    } else if (type === 'gangguan') {
      let rec = (state.gangguan?.data || []).find(g => g.id == id) || (window.SITAC_COLLO_DATA?.gangguan_records || []).find(g => g.id == id);
      if (!rec) {
        try {
          const res = await fetch(`/api/gangguan/${id}`);
          if (res.ok) rec = await res.json();
        } catch (e) {
          console.warn('Could not fetch gangguan detail:', e);
        }
      }
      if (!rec) {
        showToast('Data tiket gangguan tidak ditemukan', 'warning');
        return;
      }

      const isLapangan = state.currentUser?.role === 'lapangan';
      title.textContent = `Tiket Gangguan: ${rec.no_tiket || '-'}`;
      sub.textContent = `${rec.jenis_gangguan || 'Insiden FO'} | Lokasi: ${rec.terminating || '-'}`;
      content.innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="p-2.5 bg-slate-900 rounded border border-white/5"><span class="text-slate-500 uppercase block">Status</span><span class="font-bold text-sm text-slate-100">${rec.is_selesai ? '<span class="text-emerald-400 font-bold">SELESAI</span>' : '<span class="text-amber-400 font-bold">PROSES</span>'}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5"><span class="text-slate-500 uppercase block">PIC Perijinan</span><span class="font-bold text-sm text-slate-100">${escapeHtml(formatPicName(rec.pic_perijinan || '-'))}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5"><span class="text-slate-500 uppercase block">Tanggal Disposisi</span><span class="font-mono text-slate-200">${rec.tgl_dispos || '-'}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5"><span class="text-slate-500 uppercase block">Tanggal Selesai</span><span class="font-mono text-slate-200">${rec.tgl_selesai || '-'}</span></div>
          ${!isLapangan ? `<div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2 overflow-hidden min-w-0"><span class="text-slate-500 uppercase block truncate">Biaya Penanganan</span><span class="font-bold text-amber-400 font-mono text-sm sm:text-base truncate block" title="${formatRupiah(rec.biaya_gangguan)}">${formatRupiah(rec.biaya_gangguan)}</span></div>` : ''}
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2"><span class="text-slate-500 uppercase block">Lokasi Kejadian</span><span class="text-slate-200">${escapeHtml(rec.terminating || '-')}</span></div>
          <div class="p-2.5 bg-slate-900 rounded border border-white/5 col-span-2"><span class="text-slate-500 uppercase block">Catatan Update Gangguan</span><span class="text-slate-200">${escapeHtml(rec.update_gangguan || 'Tidak ada catatan')}</span></div>
          ${renderPhotoBuktiSection(rec, type, id)}
        </div>
      `;
    }

    // Bind modal footer action buttons
    const btnWhatsAppAction = document.getElementById('btnDetailWhatsAppAction');
    const btnEditAction = document.getElementById('btnDetailEditAction');
    const btnDeleteAction = document.getElementById('btnDetailDeleteAction');
    const btnCloseAction = document.getElementById('btnDetailCloseAction');
    const isLapangan = state.currentUser?.role === 'lapangan';

    if (btnDeleteAction) {
      btnDeleteAction.style.display = isLapangan ? 'none' : '';
    }
    if (btnEditAction) {
      const colName = type === 'sitac' ? 'sitac_records' : (type === 'gangguan' ? 'gangguan_records' : 'collo_records');
      const targetRec = (window.SITAC_COLLO_DATA?.[colName] || []).find(r => r.id == id) ||
                        (state.sitac?.data || []).find(s => s.id == id) ||
                        (state.colleagues?.data || []).find(s => s.id == id) ||
                        (state.gangguan?.data || []).find(g => g.id == id);
      btnEditAction.style.display = isTaskEditableByUser(targetRec) ? '' : 'none';
    }

    if (btnWhatsAppAction) {
      btnWhatsAppAction.onclick = () => {
        shareDetailToWhatsApp(type, id);
      };
    }
    if (btnEditAction) {
      btnEditAction.onclick = () => {
        overlay.style.display = 'none';
        openQuickEditModal(type, id);
      };
    }
    if (btnDeleteAction) {
      btnDeleteAction.onclick = () => {
        deleteRecord(type, id);
      };
    }
    if (btnCloseAction) {
      btnCloseAction.onclick = () => {
        overlay.style.display = 'none';
      };
    }

    overlay.style.display = 'flex';
  }

  // =========================================================================
  // DELETE RECORD ENGINE (LIVE SQLite RECORD DELETION)
  // =========================================================================
  async function deleteRecord(type, id) {
    if (state.currentUser?.role !== 'admin') {
      showToast('Akses ditolak: Hanya Administrator yang berhak menghapus data secara permanen', 'error');
      return;
    }
    let name = 'data ini';
    if (type === 'collo') {
      const rec = (state.collo.data || []).find(c => c.id == id) || (state.alerts.data || []).find(c => c.id == id);
      if (rec) name = `sirkuit "${rec.pelanggan || rec.no_so}"`;
    } else if (type === 'sitac') {
      const rec = (state.sitac.data || []).find(s => s.id == id);
      if (rec) name = `penugasan PA "${rec.no_pa || rec.pelanggan}"`;
    } else if (type === 'gangguan') {
      const rec = (state.gangguan.data || []).find(g => g.id == id);
      if (rec) name = `tiket gangguan "${rec.no_tiket || id}"`;
    }

    const confirmed = confirm(`Apakah Anda yakin ingin menghapus ${name} (ID #${id}) secara permanen?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/${type}/${id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.message || 'Gagal menghapus data');

      showToast(json.message || 'Data berhasil dihapus!');

      // Persist deletion locally and sync to Firestore
      persistDeleteRecord(type, id);
      const colName = type === 'collo' ? 'collo_records' : (type === 'sitac' ? 'sitac_records' : 'gangguan_records');
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        window.FirebaseManager.deleteRecord(colName, String(id)).catch(() => {});
      }

      // Close modal if open
      const detailModal = document.getElementById('modalDetail');
      if (detailModal) detailModal.style.display = 'none';

      // Refresh active module data
      if (type === 'collo') {
        await loadColloData();
        if (state.activeView === 'view-collo-rev-sharing') loadRevSharingData();
        if (state.activeView === 'view-collo-alerts') loadAlertsData();
      } else if (type === 'sitac') {
        await loadSitacData();
      } else if (type === 'gangguan') {
        await loadGangguanData();
      }

      // Refresh Executive Summary metrics
      fetch('/api/executive/summary').then(r => r.json()).then(d => {
        state.execData = d;
        if (state.activeView === 'view-executive') renderExecutiveDashboard(d);
      }).catch(() => {});

    } catch (e) {
      alert('Error saat menghapus data: ' + e.message);
    }
  }

  // =========================================================================
  // EXPORT ENGINE (ROBUST CSV GENERATOR WITH UTF-8 BOM & PROPER ESCAPING)
  // =========================================================================
  function downloadCsvFile(filename, headers, rows) {
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      const sanitized = r.map(val => {
        if (val === null || val === undefined) return '""';
        let str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvRows.push(sanitized.join(','));
    });
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`File ${filename} berhasil diunduh!`);
  }

  async function downloadExcelFile(filename, sheetName, headers, rows) {
    if (typeof XLSX === 'undefined') {
      showToast('Menyiapkan komponen Excel export...', 'info');
      try {
        await ensureXlsxLoaded();
      } catch (e) {
        console.warn('Gagal memuat XLSX CDN, beralih ke fallback server:', e);
      }
    }
    if (typeof XLSX !== 'undefined') {
      const wb = XLSX.utils.book_new();

      const cleanRows = rows.map(r => r.map(c => {
        if (c === null || c === undefined) return '';
        if (typeof c === 'number') return c;
        return String(c);
      }));

      const wsData = [headers, ...cleanRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Auto calculate column width
      const colWidths = headers.map((h, i) => {
        let maxLen = String(h).length;
        cleanRows.forEach(row => {
          const valStr = String(row[i] || '');
          if (valStr.length > maxLen) maxLen = valStr.length;
        });
        return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
      });
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      XLSX.writeFile(wb, filename);
      showToast(`File Excel "${filename}" berhasil diunduh!`);
    } else {
      showToast('Mengunduh file Excel dari server...');
      const mod = sheetName.toLowerCase().includes('gangguan') ? 'gangguan' : (sheetName.toLowerCase().includes('sitac') ? 'sitac' : 'collo');
      window.location.href = `/api/download/excel-report?module=${mod}`;
    }
  }

  function exportCurrentViewExcel(moduleOverride) {
    const view = moduleOverride || state.activeView;
    const today = new Date().toISOString().slice(0, 10);
    const isLapangan = state.currentUser?.role === 'lapangan';

    if (isLapangan && (view === 'view-collo-list' || view === 'view-collo-alerts' || view === 'view-collo-rev-sharing' || view === 'collo' || view === 'view-efisiensi')) {
      alert('Akses dibatasi. Hanya Administrator yang dapat mengekspor data finansial/colocation.');
      return;
    }

    if (view === 'view-gangguan' || view === 'gangguan') {
      const records = state.gangguan.data;
      if (!records || records.length === 0) return alert('Tidak ada data gangguan untuk diekspor!');
      const filename = `Rekap_Tiket_Gangguan_${today}.xlsx`;
      const headers = isLapangan ? [
        'No', 'Nomor Tiket', 'Tgl Disposisi', 'Tgl Selesai', 'Lokasi Gangguan / Terminating',
        'Jenis Insiden', 'Target SLA', 'PIC Lapangan', 'Status Pekerjaan',
        'Catatan Update Gangguan', 'Foto Bukti'
      ] : [
        'No', 'Nomor Tiket', 'Tgl Disposisi', 'Tgl Selesai', 'Lokasi Gangguan / Terminating',
        'Jenis Insiden', 'Target SLA', 'PIC Lapangan', 'Biaya Penanganan (Rp)', 'Status Pekerjaan',
        'Catatan Update Gangguan', 'Foto Bukti'
      ];
      const rows = records.map((g, idx) => {
        if (isLapangan) {
          return [
            idx + 1, g.no_tiket || '', g.tgl_dispos || '', g.tgl_selesai || '',
            g.terminating || '', g.jenis_gangguan || 'FO Cut', g.sla_target || 'H+1',
            g.pic_perijinan || '', g.is_selesai ? 'Selesai' : 'Proses (Open)',
            g.update_gangguan || '', g.foto_bukti || ''
          ];
        }
        return [
          idx + 1, g.no_tiket || '', g.tgl_dispos || '', g.tgl_selesai || '',
          g.terminating || '', g.jenis_gangguan || 'FO Cut', g.sla_target || 'H+1',
          g.pic_perijinan || '', g.biaya_gangguan || 0, g.is_selesai ? 'Selesai' : 'Proses (Open)',
          g.update_gangguan || '', g.foto_bukti || ''
        ];
      });
      downloadExcelFile(filename, 'Tiket Gangguan', headers, rows);

    } else if (view === 'view-sitac-pa' || view === 'sitac') {
      const records = state.sitac.data;
      if (!records || records.length === 0) return alert('Tidak ada data SITAC untuk diekspor!');
      const filename = `Rekap_Proyek_SITAC_${today}.xlsx`;
      const headers = isLapangan ? [
        'No', 'Nomor PA', 'Pelanggan', 'PTL', 'PIC SITAC', 'Rute Terminating',
        'Progress Status', 'Durasi SLA (Hari)', 'Tgl Disposisi', 'Tgl Close', 'Catatan Lapangan'
      ] : [
        'No', 'Nomor PA', 'Pelanggan', 'PTL', 'PIC SITAC', 'Rute Terminating',
        'Biaya Pengajuan (Rp)', 'Biaya Realisasi (Rp)', 'Efisiensi (Rp)', 'Efisiensi (%)',
        'Progress Status', 'Durasi SLA (Hari)', 'Tgl Disposisi', 'Tgl Close', 'Catatan Lapangan'
      ];
      const rows = records.map((s, idx) => {
        if (isLapangan) {
          return [
            idx + 1, s.no_pa || '', s.pelanggan || '', s.ptl || '', formatPicName(s.pic_perijinan || ''),
            s.terminating || '', s.progress || '',
            s.durasi_hari !== null && s.durasi_hari !== undefined ? s.durasi_hari : '',
            s.date_dispos || '', s.date_close || '', s.update_pekerjaan || ''
          ];
        }
        return [
          idx + 1, s.no_pa || '', s.pelanggan || '', s.ptl || '', formatPicName(s.pic_perijinan || ''),
          s.terminating || '', s.biaya_permintaan_awal || 0, s.biaya_final || 0,
          s.efisiensi_rupiah || 0, s.efisiensi_persen || 0, s.progress || '',
          s.durasi_hari !== null && s.durasi_hari !== undefined ? s.durasi_hari : '',
          s.date_dispos || '', s.date_close || '', s.update_pekerjaan || ''
        ];
      });
      downloadExcelFile(filename, 'Proyek SITAC', headers, rows);

    } else if (view === 'view-sitac-colleagues' || view === 'colleagues' || view === 'sitac_colleagues') {
      const records = state.colleagues?.data;
      if (!records || records.length === 0) return alert('Tidak ada data Tim SITAC untuk diekspor!');
      const filename = `Monitoring_Tim_SITAC_${today}.xlsx`;
      const headers = isLapangan ? [
        'No', 'Nomor PA', 'Pelanggan', 'PTL', 'PIC SITAC', 'Rute Terminating',
        'Progress Status', 'Durasi SLA (Hari)', 'Tgl Disposisi', 'Tgl Close', 'Catatan Lapangan'
      ] : [
        'No', 'Nomor PA', 'Pelanggan', 'PTL', 'PIC SITAC', 'Rute Terminating',
        'Biaya Pengajuan (Rp)', 'Biaya Realisasi (Rp)', 'Efisiensi (Rp)', 'Efisiensi (%)',
        'Progress Status', 'Durasi SLA (Hari)', 'Tgl Disposisi', 'Tgl Close', 'Catatan Lapangan'
      ];
      const rows = records.map((s, idx) => {
        if (isLapangan) {
          return [
            idx + 1, s.no_pa || '', s.pelanggan || '', s.ptl || '', formatPicName(s.pic_perijinan || ''),
            s.terminating || '', s.progress || '',
            s.durasi_hari !== null && s.durasi_hari !== undefined ? s.durasi_hari : '',
            s.date_dispos || '', s.date_close || '', s.update_pekerjaan || ''
          ];
        }
        return [
          idx + 1, s.no_pa || '', s.pelanggan || '', s.ptl || '', formatPicName(s.pic_perijinan || ''),
          s.terminating || '', s.biaya_permintaan_awal || 0, s.biaya_final || 0,
          s.efisiensi_rupiah || 0, s.efisiensi_persen || 0, s.progress || '',
          s.durasi_hari !== null && s.durasi_hari !== undefined ? s.durasi_hari : '',
          s.date_dispos || '', s.date_close || '', s.update_pekerjaan || ''
        ];
      });
      downloadExcelFile(filename, 'Tim SITAC', headers, rows);

    } else if (view === 'view-collo-list' || view === 'view-collo-alerts' || view === 'view-collo-rev-sharing' || view === 'collo') {
      const records = view === 'view-collo-list' ? state.collo.data : (view === 'view-collo-rev-sharing' ? state.revSharing.data : state.alerts.data);
      if (!records || records.length === 0) return alert('Tidak ada data colocation untuk diekspor!');
      const filename = `Rekap_Kontrak_Colocation_${today}.xlsx`;
      const headers = [
        'No', 'Pengelola', 'Pelanggan', 'Nomor SO', 'SID Sirkuit', 'Site / Titik Jaringan', 'Jenis Layanan', 'Jenis Sewa',
        'Originating', 'Terminating', 'Rev Sewa 1 Thn (Rp)', 'Biaya OTC (Rp)', 'Biaya Deposito (Rp)', 'Biaya Sewa 1 Thn (Rp)',
        'Gross Margin (Rp)', 'Margin (%)', 'Rev Sharing', 'Status Sirkuit', 'Tgl Mulai', 'Jatuh Tempo',
        'Sisa Hari', 'Nomor SPP / PO', 'PIC Admin', 'Keterangan'
      ];
      const rows = records.map((c, idx) => [
        idx + 1, c.pengelola || '', c.pelanggan || '', c.no_so || '', c.sid || '',
        c.site || c.alamat_pengelola || '',
        c.layanan || '', c.jenis_sewa || '', c.originating || '', c.terminating || '',
        c.rev_sewa_tahun || 0, c.biaya_otc || 0, c.biaya_deposit || 0, c.biaya_sewa_tahun || 0,
        c.margin_rupiah || 0, c.margin_persen || 0, c.rev_sharing_raw || '',
        c.status || '', c.start_date || '', c.end_date || '', c.sisa_hari || 0,
        c.spp || c.po_baru || '', c.pic_admin || '', c.keterangan || ''
      ]);
      downloadExcelFile(filename, 'Colocation', headers, rows);

    } else if (view === 'view-efisiensi') {
      const records = state.efisiensi.length ? state.efisiensi : state.sitac.data;
      if (!records || records.length === 0) return alert('Tidak ada data efisiensi untuk diekspor!');
      const filename = `Rekap_Efisiensi_Biaya_${today}.xlsx`;
      const headers = ['No', 'Nomor PA', 'Pelanggan', 'PIC SITAC', 'Biaya Awal (Rp)', 'Biaya Final (Rp)', 'Efisiensi (Rp)', 'Efisiensi (%)', 'Status'];
      const rows = records.map((e, idx) => [
        idx + 1, e.no_pa || '', e.pelanggan || '', e.pic_perijinan || '',
        e.biaya_permintaan_awal || 0, e.biaya_final || 0, e.efisiensi_rupiah || 0, e.efisiensi_persen || 0, e.progress || ''
      ]);
      downloadExcelFile(filename, 'Efisiensi Biaya', headers, rows);

    } else if (view === 'view-pic-matrix') {
      const records = state.picMatrix.length ? state.picMatrix : [];
      if (!records || records.length === 0) return alert('Tidak ada data beban kerja PIC untuk diekspor!');
      const filename = `Rekap_Beban_Kerja_PIC_${today}.xlsx`;
      const headers = ['No', 'Nama PIC SITAC', 'Total PA Dikerjakan', 'Selesai (Finish)', 'Sedang Proses', 'Total Efisiensi (Rp)', 'Peringkat'];
      const rows = records.map((p, idx) => [
        idx + 1, formatPicName(p.pic || p.pic_perijinan || ''), p.total || p.total_pa || 0,
        p.finish || 0, p.ongoing || 0, p.total_efisiensi || 0, idx + 1
      ]);
      downloadExcelFile(filename, 'Beban Kerja PIC', headers, rows);

    } else if (view === 'view-executive') {
      const ex = state.execData;
      if (!ex) return alert('Data executive belum dimuat!');
      const filename = `Rekap_Executive_Summary_${today}.xlsx`;
      const headers = ['Kategori Indikator', 'Nilai Metrik', 'Keterangan'];
      const c = ex.collo || {};
      const s = ex.sitac || {};
      const g = ex.gangguan || {};
      const rows = [
        ['Sirkuit Colocation Aktif', c.active_count || 0, 'Total sirkuit berstatus ACTIVE'],
        ['Total Revenue Sewa Tahunan (Rp)', c.active_revenue || 0, 'Revenue aktif dalam Rupiah'],
        ['Total Biaya Mitra Tahunan (Rp)', c.active_biaya || 0, 'Beban sewa ke mitra datacenter'],
        ['Gross Margin Finansial (Rp)', c.active_margin || 0, `Persentase margin: ${c.margin_pct || 0}%`],
        ['Total Project Assignment (PA)', s.total_pa || 0, 'Semua penugasan perizinan FO'],
        ['PA Selesai (Finish)', s.finish_count || 0, `Finish rate: ${s.finish_count && s.total_pa ? (s.finish_count/s.total_pa*100).toFixed(1) : 0}%`],
        ['Total Penghematan Negosiasi (Rp)', s.total_efisiensi_rupiah || 0, `Efisiensi biaya: ${s.efisiensi_pct || 0}%`],
        ['Total Tiket Gangguan Darurat', g.total_gangguan || 0, 'Total insiden dilaporkan'],
        ['Gangguan Dituntaskan', g.selesai_count || 0, `Resolution rate: ${g.resolution_rate || 0}%`]
      ];
      downloadExcelFile(filename, 'Executive Summary', headers, rows);
    } else {
      alert('Pilih tabel yang ingin diekspor ke Excel.');
    }
  }

  async function exportPicMatrixCsv() {
    let records = state.picMatrix;
    if (!records || records.length === 0) {
      try {
        const res = await fetch('/api/pic-performance');
        if (res.ok) {
          records = await res.json();
          state.picMatrix = records;
        }
      } catch (e) {
        console.error('Failed to fetch pic performance for export', e);
      }
    }
    if (!records || records.length === 0) {
      const d = window.SITAC_COLLO_DATA || {};
      records = d.workload_performa || (d.summary && d.summary.workload_performa) || computePicPerformanceFromData(d.sitac_records, d.gangguan_records);
      state.picMatrix = records || [];
    }
    if (!records || records.length === 0) {
      return alert('Tidak ada data Beban Kerja PIC untuk diekspor!');
    }

    const filename = `rekap_beban_kerja_pic_${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = [
      'Nama PIC SITAC',
      'Total Penugasan (PA)',
      'Selesai (Finish)',
      'Sedang Berjalan (Ongoing/Hold)',
      'Dibatalkan (Cancel)',
      'Tingkat Penyelesaian (%)',
      'Biaya Pengajuan Awal (Rp)',
      'Realisasi Biaya Akhir (Rp)',
      'Total Penghematan / Efisiensi (Rp)',
      'Persentase Efisiensi (%)',
      'Rata-rata SLA (Hari)',
      'Tiket Gangguan Ditangani'
    ];

    const rows = records.map(p => [
      p.pic || '-',
      p.total_penugasan || 0,
      p.finish || 0,
      (p.ongoing || 0) + (p.hold || 0),
      p.cancel || 0,
      `${p.finish_rate || 0}%`,
      p.biaya_awal || 0,
      p.biaya_final || 0,
      p.efisiensi_rupiah || 0,
      `${p.efisiensi_persen || 0}%`,
      p.avg_sla_hari || 0,
      p.gangguan_count || 0
    ]);

    downloadCsvFile(filename, headers, rows);
  }

  async function exportEfisiensiCsv() {
    let records = state.efisiensi;
    if (!records || records.length === 0) {
      try {
        const res = await fetch('/api/rekap-efisiensi');
        if (res.ok) {
          records = await res.json();
          state.efisiensi = records;
        }
      } catch (e) {
        console.error('Failed to fetch efisiensi for export', e);
      }
    }
    if (!records || records.length === 0) {
      return alert('Tidak ada data Efisiensi untuk diekspor!');
    }

    const filename = `rekap_efisiensi_biaya_${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = [
      'Tahun Anggaran',
      'Total Disposisi PA',
      'Pekerjaan Berbiaya',
      'Tanpa Biaya (Zero Cost)',
      'Biaya Pengajuan Awal (Rp)',
      'Realisasi Biaya Akhir (Rp)',
      'Nominal Penghematan (Rp)',
      'Persentase Efisiensi (%)'
    ];

    const rows = records.map(r => [
      r.tahun || '-',
      r.total_disposisi || 0,
      r.ada_biaya || 0,
      r.tidak_ada_biaya || 0,
      r.nilai_awal || 0,
      r.nilai_akhir || 0,
      r.efisiensi_rupiah || 0,
      `${r.efisiensi_persen || 0}%`
    ]);

    downloadCsvFile(filename, headers, rows);
  }

  function exportCurrentView() {
    const view = state.activeView;

    if (view === 'view-pic-matrix') {
      return exportPicMatrixCsv();
    }
    if (view === 'view-efisiensi') {
      return exportEfisiensiCsv();
    }

    let filename = `telecom_${view}_${new Date().toISOString().slice(0, 10)}.csv`;
    let headers = [];
    let rows = [];

    if (view === 'view-collo-list' || view === 'view-collo-alerts' || view === 'view-collo-rev-sharing') {
      const records = view === 'view-collo-list' ? state.collo.data : (view === 'view-collo-rev-sharing' ? state.revSharing.data : state.alerts.data);
      if (!records || records.length === 0) return alert('Tidak ada data colocation untuk diekspor!');

      headers = [
        'ID', 'Pengelola', 'Pelanggan', 'No SO', 'SID', 'Originating', 'Terminating', 'Layanan', 'Jenis Sewa',
        'Rev Sewa (1 Thn) Pelanggan (Rp)', 'Biaya OTC (Rp)', 'Biaya Deposito (Rp)', 'Biaya Sewa 1 Tahun (Rp)',
        'Margin Rp', 'Margin %', 'Rev Sharing', 'Status', 'Sisa Hari', 'SPP'
      ];
      rows = records.map(c => [
        c.id, c.pengelola || '', c.pelanggan || '',
        c.no_so || '', c.sid || '', c.originating || '', c.terminating || '', c.layanan || '', c.jenis_sewa || '',
        c.rev_sewa_tahun || 0, c.biaya_otc || 0, c.biaya_deposit || 0, c.biaya_sewa_tahun || 0,
        c.margin_rupiah || 0, c.margin_persen || 0,
        c.rev_sharing_raw || '', c.status || '', c.sisa_hari || 0, c.spp || c.po_baru || ''
      ]);
    } else if (view === 'view-sitac-pa') {
      const records = state.sitac.data;
      if (!records || records.length === 0) return alert('Tidak ada data SITAC untuk diekspor!');

      headers = ['ID', 'No PA', 'Pelanggan', 'PIC SITAC', 'PTL', 'Terminating', 'Biaya Awal', 'Biaya Final', 'Biaya OTC', 'Biaya Sewa / Bulan', 'Penghematan', 'Status', 'Durasi SLA'];
      rows = records.map(s => [
        s.id, s.no_pa || '', s.pelanggan || '', s.pic_perijinan || '',
        s.ptl || '', s.terminating || '',
        s.biaya_permintaan_awal || 0, s.biaya_final || 0, s.sewa_otc || 0, s.biaya_sewa_bulan || 0, s.efisiensi_rupiah || 0, s.progress || '', s.durasi_hari || ''
      ]);
    } else if (view === 'view-gangguan') {
      const records = state.gangguan.data;
      if (!records || records.length === 0) return alert('Tidak ada data gangguan untuk diekspor!');

      headers = ['ID', 'No Tiket', 'Tgl Dispos', 'Tgl Selesai', 'Lokasi', 'Jenis Gangguan', 'PIC', 'Biaya', 'Status'];
      rows = records.map(g => [
        g.id, g.no_tiket || '', g.tgl_dispos || '', g.tgl_selesai || '',
        g.terminating || '', g.jenis_gangguan || '',
        g.pic_perijinan || '', g.biaya_gangguan || 0, g.is_selesai ? 'Selesai' : 'Proses'
      ]);
    } else if (view === 'view-executive') {
      const ex = state.execData;
      if (!ex) return alert('Data executive belum dimuat!');
      filename = `rekap_executive_summary_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Kategori Indikator', 'Nilai Metrik', 'Keterangan'];
      const c = ex.collo || {};
      const s = ex.sitac || {};
      const g = ex.gangguan || {};
      rows = [
        ['Sirkuit Colocation Aktif', c.active_count || 0, 'Total sirkuit berstatus ACTIVE'],
        ['Total Revenue Sewa Tahunan', c.active_revenue || 0, 'Revenue aktif dalam Rupiah'],
        ['Total Biaya Mitra Tahunan', c.active_biaya || 0, 'Beban sewa ke mitra datacenter'],
        ['Gross Margin Finansial', c.active_margin || 0, `Persentase margin: ${c.margin_pct || 0}%`],
        ['Total Project Assignment (PA)', s.total_pa || 0, 'Semua penugasan perizinan FO'],
        ['PA Selesai (Finish)', s.finish_count || 0, `Finish rate: ${s.finish_count && s.total_pa ? (s.finish_count/s.total_pa*100).toFixed(1) : 0}%`],
        ['Total Penghematan Negosiasi', s.total_efisiensi_rupiah || 0, `Efisiensi biaya: ${s.efisiensi_pct || 0}%`],
        ['Total Tiket Gangguan Darurat', g.total_gangguan || 0, 'Total insiden dilaporkan'],
        ['Gangguan Dituntaskan', g.selesai_count || 0, `Resolution rate: ${g.resolution_rate || 0}%`]
      ];
    } else {
      return alert('Buka tabel spesifik untuk mengekspor data.');
    }

    downloadCsvFile(filename, headers, rows);
  }

  // =========================================================================
  // PDF EXPORT ENGINE (jsPDF + AutoTable)
  // =========================================================================
  function fmtRp(val) {
    if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
    return 'Rp ' + Number(val).toLocaleString('id-ID');
  }

  function getPdfTitle(view) {
    const titles = {
      'view-executive': 'Laporan Executive Summary',
      'view-collo-list': 'Laporan Data Colocation',
      'view-collo-rev-sharing': 'Laporan Revenue Sharing',
      'view-collo-alerts': 'Laporan Alert Kontrak',
      'view-sitac-pa': 'Laporan SITAC Project Assignment',
      'view-sitac-colleagues': 'Laporan Monitoring Tim SITAC',
      'view-gangguan': 'Laporan Gangguan Darurat',
      'view-efisiensi': 'Laporan Efisiensi Biaya',
      'view-pic-matrix': 'Laporan Beban Kerja PIC'
    };
    return titles[view] || 'Laporan Data';
  }

  function addPdfHeader(doc, title) {
    const pageW = doc.internal.pageSize.getWidth();
    // Header gradient bar
    doc.setFillColor(8, 12, 20);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setFillColor(6, 182, 212);
    doc.rect(0, 27, pageW, 1.5, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(248, 250, 252);
    doc.text(title, 14, 12);

    // Subtitle - date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Dicetak: ${dateStr} | Telecom Infrastructure & Lease Operations Portal`, 14, 19);

    // Company info right
    doc.setFontSize(9);
    doc.setTextColor(6, 182, 212);
    doc.text('ANALYTICS PORTAL', pageW - 14, 12, { align: 'right' });
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text('Infrastructure & Lease Ops', pageW - 14, 18, { align: 'right' });
  }

  function addPdfFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(8, 12, 20);
      doc.rect(0, pageH - 12, pageW, 12, 'F');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, pageH - 5, { align: 'center' });
      doc.text('Confidential - Internal Use Only', 14, pageH - 5);
    }
  }

  function getStatusColor(status) {
    const s = (status || '').toUpperCase();
    if (s === 'ACTIVE' || s === 'FINISH' || s === 'SELESAI') return [16, 185, 129];
    if (s === 'NON ACTIVE' || s === 'CANCEL') return [239, 68, 68];
    if (s === 'DEACTIVASI') return [245, 158, 11];
    if (s.includes('ONGOING') || s.includes('PROSES')) return [99, 102, 241];
    return [148, 163, 184];
  }

  async function exportCurrentViewPdf() {
    const view = state.activeView;
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast('Menyiapkan library PDF...', 'info');
      try {
        await ensureJsPdfLoaded();
      } catch (e) {
        console.warn('Gagal memuat jsPDF CDN:', e);
      }
    }
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return alert('Library PDF belum dimuat. Periksa koneksi internet dan coba lagi.');

    const title = getPdfTitle(view);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    addPdfHeader(doc, title);

    const startY = 34;

    if (view === 'view-executive') {
      await exportExecutivePdf(doc, startY);
    } else if (view === 'view-collo-list' || view === 'view-collo-alerts') {
      await exportColloPdf(doc, startY, view);
    } else if (view === 'view-collo-rev-sharing') {
      exportRevSharingPdf(doc, startY);
    } else if (view === 'view-sitac-pa' || view === 'view-sitac-colleagues') {
      await exportSitacPdf(doc, startY);
    } else if (view === 'view-gangguan') {
      exportGangguanPdf(doc, startY);
    } else if (view === 'view-efisiensi') {
      await exportEfisiensiPdf(doc, startY);
    } else if (view === 'view-pic-matrix') {
      await exportPicMatrixPdf(doc, startY);
    } else {
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text('Buka salah satu modul untuk mengekspor data ke PDF.', 14, startY + 10);
    }

    addPdfFooter(doc);

    const filename = `${title.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    showToast(`File PDF "${filename}" berhasil diunduh!`);
  }

  // --- EXECUTIVE SUMMARY PDF ---
  async function exportExecutivePdf(doc, startY) {
    let ex = state.execData;
    if (!ex) {
      try {
        const res = await fetch('/api/executive/summary');
        if (res.ok) ex = await res.json();
      } catch (e) { /* ignore */ }
    }
    if (!ex) {
      doc.setFontSize(11);
      doc.setTextColor(239, 68, 68);
      doc.text('Data Executive Summary belum tersedia.', 14, startY + 10);
      return;
    }
    const c = ex.collo || {};
    const s = ex.sitac || {};
    const g = ex.gangguan || {};

    const summaryData = [
      ['Sirkuit Colocation Aktif', String(c.active_count || 0), 'Total sirkuit berstatus ACTIVE'],
      ['Total Revenue Sewa Tahunan', fmtRp(c.active_revenue), 'Revenue aktif dalam Rupiah'],
      ['Total Biaya Mitra Tahunan', fmtRp(c.active_biaya), 'Beban sewa ke mitra datacenter'],
      ['Gross Margin Finansial', fmtRp(c.active_margin), `Persentase margin: ${c.margin_pct || 0}%`],
      ['Total Project Assignment (PA)', String(s.total_pa || 0), 'Semua penugasan perizinan FO'],
      ['PA Selesai (Finish)', String(s.finish_count || 0), `Finish rate: ${s.finish_count && s.total_pa ? (s.finish_count / s.total_pa * 100).toFixed(1) : 0}%`],
      ['Total Penghematan Negosiasi', fmtRp(s.total_efisiensi_rupiah), `Efisiensi biaya: ${s.efisiensi_pct || 0}%`],
      ['Total Tiket Gangguan', String(g.total_gangguan || 0), 'Total insiden dilaporkan'],
      ['Gangguan Dituntaskan', String(g.selesai_count || 0), `Resolution rate: ${g.resolution_rate || 0}%`]
    ];

    doc.autoTable({
      startY: startY,
      head: [['Kategori Indikator', 'Nilai Metrik', 'Keterangan']],
      body: summaryData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, textColor: [30, 41, 59] },
      headStyles: { fillColor: [6, 182, 212], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { halign: 'right', cellWidth: 65, fontStyle: 'bold' },
        2: { cellWidth: 'auto', textColor: [100, 116, 139], fontSize: 8 }
      }
    });

    if (ex.top_pengelola && ex.top_pengelola.length > 0) {
      const nextY = (doc.lastAutoTable?.finalY || startY + 80) + 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Top 10 Mitra Pengelola Datacenter (Sirkuit Aktif)', 14, nextY);

      const topBody = ex.top_pengelola.map((p, idx) => [
        idx + 1,
        p.pengelola || '-',
        p.sirkuit_count || 0,
        fmtRp(p.total_rev),
        fmtRp(p.total_biaya),
        fmtRp(p.total_margin),
        `${p.total_rev ? (p.total_margin / p.total_rev * 100).toFixed(1) : 0}%`
      ]);

      doc.autoTable({
        startY: nextY + 3,
        head: [['No', 'Mitra Pengelola', 'Sirkuit', 'Revenue (1 Thn)', 'Biaya Mitra', 'Margin Finansial', 'Margin %']],
        body: topBody,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 60, fontStyle: 'bold' },
          2: { cellWidth: 20, halign: 'right' },
          3: { cellWidth: 45, halign: 'right' },
          4: { cellWidth: 45, halign: 'right' },
          5: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
          6: { cellWidth: 20, halign: 'right' }
        }
      });
    }
  }

  // --- COLOCATION PDF (RESPECTS ALL ACTIVE FILTERS) ---
  async function exportColloPdf(doc, startY, view) {
    let records = [];
    const isAlerts = view === 'view-collo-alerts';

    if (isAlerts) {
      records = state.alerts?.data || [];
    } else {
      const { status, jenisSewa, pengelola, search, sort } = state.collo;
      try {
        const params = new URLSearchParams({
          status: status || 'ALL',
          jenis_sewa: jenisSewa || 'ALL',
          pengelola: pengelola || 'ALL',
          search: search || '',
          sort: sort || 'margin_desc',
          page: 1,
          pageSize: 5000
        });
        const res = await fetch(`/api/collo?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) records = json.data;
        }
      } catch (e) {
        console.warn('Fallback to loaded page data', e);
      }

      // Direct fallback filter to ensure 100% adherence to active screen filters
      if (!records || records.length === 0) {
        const allCollo = (window.SITAC_COLLO_DATA && window.SITAC_COLLO_DATA.collo_records) || state.collo?.data || [];
        records = allCollo.filter(c => {
          if (status && status !== 'ALL' && c.status !== status) return false;
          if (jenisSewa && jenisSewa !== 'ALL' && (c.jenis_sewa || '').toLowerCase() !== jenisSewa.toLowerCase()) return false;
          if (pengelola && pengelola !== 'ALL') {
            const targetNorm = (typeof normalizePengelolaName === 'function' ? normalizePengelolaName(pengelola) : pengelola).toLowerCase();
            const raw = (c.pengelola || '').toLowerCase();
            const norm = (typeof normalizePengelolaName === 'function' ? normalizePengelolaName(c.pengelola) : raw).toLowerCase();
            if (raw !== targetNorm && norm !== targetNorm) return false;
          }
          if (search) {
            const q = search.toLowerCase();
            const match = (c.no_so || '').toLowerCase().includes(q) ||
              (c.pelanggan || '').toLowerCase().includes(q) ||
              (c.sid || '').toLowerCase().includes(q) ||
              (c.pengelola || '').toLowerCase().includes(q) ||
              (c.originating || '').toLowerCase().includes(q) ||
              (c.terminating || '').toLowerCase().includes(q);
            if (!match) return false;
          }
          return true;
        });
      }
    }

    if (!records || records.length === 0) {
      doc.setFontSize(11); doc.setTextColor(239, 68, 68);
      doc.text('Tidak ada data Colocation yang sesuai dengan filter aktif.', 14, startY + 10);
      return;
    }

    const { status, jenisSewa, pengelola, search } = state.collo;
    const filterInfo = isAlerts
      ? `Alert Kedaluwarsa (${state.alerts.category || 'CRITICAL'}) | Total: ${records.length} Sirkuit`
      : [
          `Status: ${status || 'ALL'}`,
          pengelola && pengelola !== 'ALL' ? `Pengelola: ${pengelola}` : null,
          jenisSewa && jenisSewa !== 'ALL' ? `Jenis Sewa: ${jenisSewa}` : null,
          search ? `Pencarian: "${search}"` : null
        ].filter(Boolean).join(' | ');

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Hasil Filter: ${records.length} Sirkuit (${filterInfo})`, 14, startY);

    let sumRev = 0, sumOtc = 0, sumBiaya = 0, sumMargin = 0;
    records.forEach(c => {
      sumRev += Number(c.rev_sewa_tahun) || 0;
      sumOtc += Number(c.biaya_otc) || 0;
      sumBiaya += Number(c.biaya_sewa_tahun) || 0;
      sumMargin += Number(c.margin_rupiah) || 0;
    });

    const body = records.map(c => [
      c.pengelola || '-',
      c.pelanggan || '-',
      c.no_so || '-',
      c.terminating || '-',
      c.jenis_sewa || '-',
      fmtRp(c.rev_sewa_tahun),
      fmtRp(c.biaya_otc),
      fmtRp(c.biaya_sewa_tahun),
      fmtRp(c.margin_rupiah),
      `${c.margin_persen || 0}%`,
      c.status || '-',
      c.sisa_hari != null ? `${c.sisa_hari} hr` : '-'
    ]);

    // Summary row
    body.push([
      'TOTAL FILTERED',
      `${records.length} Sirkuit`,
      '-',
      '-',
      '-',
      fmtRp(sumRev),
      fmtRp(sumOtc),
      fmtRp(sumBiaya),
      fmtRp(sumMargin),
      sumRev > 0 ? `${((sumMargin / sumRev) * 100).toFixed(1)}%` : '-',
      '-',
      '-'
    ]);

    doc.autoTable({
      startY: startY + 4,
      head: [['Pengelola', 'Pelanggan', 'No SO', 'Terminating', 'Jenis Sewa', 'Rev Sewa/Thn', 'Biaya OTC', 'Biaya Sewa/Thn', 'Margin', 'Margin %', 'Status', 'Sisa Hari']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [6, 182, 212], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 28 },
        2: { cellWidth: 20 },
        3: { cellWidth: 35 },
        4: { cellWidth: 18 },
        5: { halign: 'right', cellWidth: 24 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 24 },
        8: { halign: 'right', cellWidth: 22 },
        9: { halign: 'right', cellWidth: 14 },
        10: { cellWidth: 17 },
        11: { halign: 'right', cellWidth: 14 }
      },
      didParseCell: function(data) {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [224, 242, 254];
          data.cell.styles.textColor = [12, 74, 96];
        } else if (data.section === 'body' && data.column.index === 10) {
          const clr = getStatusColor(data.cell.raw);
          data.cell.styles.textColor = clr;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
  }

  // --- REVENUE SHARING PDF ---
  function exportRevSharingPdf(doc, startY) {
    const records = state.revSharing.data;
    if (!records || records.length === 0) {
      doc.setFontSize(11); doc.setTextColor(239, 68, 68);
      doc.text('Tidak ada data Revenue Sharing.', 14, startY + 10);
      return;
    }

    const body = records.map(c => [
      c.pengelola || '-',
      c.pelanggan || '-',
      c.sid || '-',
      c.rev_sharing_raw || '-',
      fmtRp(c.rev_sewa_tahun),
      fmtRp(c.biaya_rev_sharing),
      c.status || '-',
      c.sisa_hari != null ? `${c.sisa_hari} hr` : '-'
    ]);

    doc.autoTable({
      startY: startY,
      head: [['Pengelola', 'Pelanggan', 'SID', 'Rev Sharing %', 'Revenue / Thn', 'Biaya Rev Sharing', 'Status', 'Sisa Hari']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2.5, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        7: { halign: 'right' }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 6) {
          data.cell.styles.textColor = getStatusColor(data.cell.raw);
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
  }

  // --- SITAC PDF (100% RESPECTS ACTIVE REGIONAL & ALL FILTERS) ---
  async function exportSitacPdf(doc, startY) {
    const isColleagues = state.activeView === 'view-sitac-colleagues';
    const sitacState = isColleagues ? state.colleagues : state.sitac;
    let records = [];

    const { status, pic, year, aging, region, search, startDate, endDate, dateField } = sitacState;
    const isLapangan = state.currentUser?.role === 'lapangan';
    const finalPic = (isLapangan || state.myTasksOnlySitac) && state.activeTechnician && state.activeTechnician !== 'Admin' && !isColleagues
      ? state.activeTechnician
      : (pic || 'ALL');
    const finalRegion = region || 'ALL';

    try {
      const params = new URLSearchParams({
        status: status || 'ALL',
        pic: finalPic,
        year: year || 'ALL',
        aging: aging || 'ALL',
        region: finalRegion,
        search: search || '',
        page: 1,
        pageSize: 5000,
        startDate: startDate || '',
        endDate: endDate || '',
        dateField: dateField || 'date_dispos',
        all_team: isColleagues ? '1' : '0'
      });
      const res = await fetch(`/api/sitac?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) records = json.data;
      }
    } catch (e) {
      console.warn('Fallback to loaded sitac data for PDF', e);
    }

    // Rock-solid fallback: if records is empty, filter directly from dataset
    if (!records || records.length === 0) {
      const allSitac = (window.SITAC_COLLO_DATA && window.SITAC_COLLO_DATA.sitac_records) || state.sitac?.data || [];
      records = allSitac.filter(s => {
        // Field technician restriction
        if (isLapangan && !isColleagues && !isUserAssignedToTask(s, state.currentUser)) return false;
        if (finalPic !== 'ALL' && !isUserAssignedToTask(s, { pic_code: finalPic, username: finalPic })) return false;

        // Status
        if (status && status !== 'ALL' && (s.progress || '').toLowerCase() !== status.toLowerCase()) return false;

        // Region
        if (finalRegion && finalRegion !== 'ALL') {
          const reg = typeof classifySitacRegion === 'function' ? classifySitacRegion(s) : 'LAINNYA';
          if (reg !== finalRegion) return false;
        }

        // Year
        if (year && year !== 'ALL') {
          const y = (s.date_dispos || '').substring(0, 4);
          if (y !== String(year)) return false;
        }

        // Aging
        if (aging && aging !== 'ALL') {
          const dur = Number(s.durasi_hari) || 0;
          if (aging === 'green' && !(dur <= 30)) return false;
          if (aging === 'yellow' && !(dur > 30 && dur <= 60)) return false;
          if (aging === 'red' && !(dur > 60)) return false;
        }

        // Date Range
        if (startDate || endDate) {
          const raw = s[dateField] || s.date_dispos || '';
          const dStr = String(raw).trim().substring(0, 10);
          if (!dStr) return false;
          if (startDate && dStr < startDate) return false;
          if (endDate && dStr > endDate) return false;
        }

        // Search
        if (search) {
          const q = search.toLowerCase();
          const match = (s.no_pa || '').toLowerCase().includes(q) ||
            (s.pelanggan || '').toLowerCase().includes(q) ||
            (s.terminating || '').toLowerCase().includes(q) ||
            (s.pic_perijinan || '').toLowerCase().includes(q) ||
            (s.ptl || '').toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      });
    }

    if (!records || records.length === 0) {
      doc.setFontSize(11); doc.setTextColor(239, 68, 68);
      doc.text('Tidak ada data SITAC yang sesuai dengan filter aktif.', 14, startY + 10);
      return;
    }

    const scopeLabels = {
      ALL: 'Seluruh Wilayah (Jabodetabek, Banten, Tangerang)',
      JAKPUSEL: 'Jakarta Pusat & Jakarta Selatan',
      JAKUTIM: 'Jakarta Utara & Jakarta Timur',
      BODEBEK: 'Bogor, Depok, dan Bekasi',
      JAKBAR: 'Jakarta Barat',
      BANTEN: 'Banten (Serang, Cilegon, Pandeglang, Lebak)',
      TANGERANG: 'Kota Tangerang, Tangerang Selatan, Kab Tangerang'
    };
    const regionName = scopeLabels[finalRegion] || finalRegion;

    const filterBadges = [
      `Wilayah: ${regionName}`,
      status !== 'ALL' ? `Status: ${status}` : null,
      finalPic !== 'ALL' ? `PIC: ${finalPic}` : null,
      year !== 'ALL' ? `Tahun: ${year}` : null,
      (startDate || endDate) ? `Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}` : null,
      search ? `Pencarian: "${search}"` : null
    ].filter(Boolean).join(' | ');

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Hasil Filter: ${records.length} PA (${filterBadges})`, 14, startY);

    let sumAwal = 0, sumFinal = 0, sumHemat = 0;
    records.forEach(s => {
      sumAwal += Number(s.biaya_permintaan_awal) || 0;
      sumFinal += Number(s.biaya_final) || 0;
      sumHemat += Number(s.efisiensi_rupiah) || 0;
    });

    const body = records.map(s => [
      s.no_pa || '-',
      s.pelanggan || '-',
      s.pic_perijinan || '-',
      s.ptl || '-',
      s.terminating || '-',
      fmtRp(s.biaya_permintaan_awal),
      fmtRp(s.biaya_final),
      fmtRp(s.efisiensi_rupiah),
      s.progress || '-',
      s.durasi_hari != null ? `${s.durasi_hari} hr` : '-'
    ]);

    // Financial Summary Footer Row
    body.push([
      'TOTAL FILTERED',
      `${records.length} Berkas PA`,
      '-',
      '-',
      '-',
      fmtRp(sumAwal),
      fmtRp(sumFinal),
      fmtRp(sumHemat),
      sumAwal > 0 ? `${((sumHemat / sumAwal) * 100).toFixed(1)}% Hemat` : '-',
      '-'
    ]);

    doc.autoTable({
      startY: startY + 4,
      head: [['No PA', 'Pelanggan', 'PIC SITAC', 'PTL', 'Terminating (Rute / Lokasi)', 'Biaya Awal', 'Biaya Final', 'Penghematan', 'Status', 'SLA']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 6.8, cellPadding: 2, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [245, 158, 11], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 7.2 },
      alternateRowStyles: { fillColor: [254, 249, 235] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 35 },
        2: { cellWidth: 20 },
        3: { cellWidth: 24 },
        4: { cellWidth: 70, overflow: 'linebreak' },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 20 },
        8: { cellWidth: 14 },
        9: { halign: 'right', cellWidth: 12 }
      },
      didParseCell: function(data) {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [120, 53, 15];
        } else if (data.section === 'body' && data.column.index === 8) {
          data.cell.styles.textColor = getStatusColor(data.cell.raw);
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
  }

  // --- GANGGUAN PDF (RESPECTS ALL ACTIVE FILTERS) ---
  function exportGangguanPdf(doc, startY) {
    const records = state.gangguan?.data || [];
    if (!records || records.length === 0) {
      doc.setFontSize(11); doc.setTextColor(239, 68, 68);
      doc.text('Tidak ada data Gangguan yang sesuai dengan filter aktif.', 14, startY + 10);
      return;
    }

    const { status, search, startDate, endDate, exactDate } = state.gangguan || {};
    const statusLabel = status === '0' ? 'Open / Proses' : status === '1' ? 'Resolved / Selesai' : 'Semua Status';
    const periodLabel = exactDate ? `Tanggal: ${exactDate}` : (startDate || endDate) ? `Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}` : 'Semua Periode';
    const searchLabel = search ? ` | Pencarian: "${search}"` : '';

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Hasil Filter: ${records.length} Tiket (${statusLabel} | ${periodLabel}${searchLabel})`, 14, startY);

    let sumBiaya = 0;
    records.forEach(g => {
      sumBiaya += Number(g.biaya_gangguan) || 0;
    });

    const body = records.map(g => [
      g.no_tiket || '-',
      g.tgl_dispos || '-',
      g.tgl_selesai || '-',
      g.terminating || '-',
      g.jenis_gangguan || '-',
      g.pic_perijinan || '-',
      fmtRp(g.biaya_gangguan),
      g.is_selesai ? 'Selesai' : 'Proses'
    ]);

    // Summary row
    body.push([
      'TOTAL FILTERED',
      `${records.length} Tiket`,
      '-',
      '-',
      '-',
      '-',
      fmtRp(sumBiaya),
      '-'
    ]);

    doc.autoTable({
      startY: startY + 4,
      head: [['No Tiket', 'Tgl Dispos', 'Tgl Selesai', 'Lokasi', 'Jenis Gangguan', 'PIC', 'Biaya', 'Status']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        3: { cellWidth: 65, overflow: 'linebreak' },
        6: { halign: 'right' }
      },
      didParseCell: function(data) {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
        } else if (data.section === 'body' && data.column.index === 7) {
          data.cell.styles.textColor = data.cell.raw === 'Selesai' ? [16, 185, 129] : [245, 158, 11];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
  }

  // --- EFISIENSI PDF ---
  async function exportEfisiensiPdf(doc, startY) {
    let records = state.efisiensi;
    if (!records || records.length === 0) {
      try {
        const res = await fetch('/api/rekap-efisiensi');
        if (res.ok) { records = await res.json(); state.efisiensi = records; }
      } catch (e) { /* ignore */ }
    }
    if (!records || records.length === 0) {
      doc.setFontSize(11); doc.setTextColor(239, 68, 68);
      doc.text('Tidak ada data Efisiensi.', 14, startY + 10);
      return;
    }

    const body = records.map(r => [
      String(r.tahun || '-'),
      String(r.total_disposisi || 0),
      String(r.ada_biaya || 0),
      String(r.tidak_ada_biaya || 0),
      fmtRp(r.nilai_awal),
      fmtRp(r.nilai_akhir),
      fmtRp(r.efisiensi_rupiah),
      `${r.efisiensi_persen || 0}%`
    ]);

    doc.autoTable({
      startY: startY,
      head: [['Tahun', 'Total Disposisi', 'Berbiaya', 'Zero Cost', 'Biaya Awal', 'Biaya Akhir', 'Penghematan', 'Efisiensi %']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59] },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [236, 253, 245] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' },
        7: { halign: 'right', fontStyle: 'bold' }
      }
    });
  }

  // --- PIC MATRIX PDF ---
  async function exportPicMatrixPdf(doc, startY) {
    let records = state.picMatrix;
    if (!records || records.length === 0) {
      try {
        const res = await fetch('/api/pic-performance');
        if (res.ok) { records = await res.json(); state.picMatrix = records; }
      } catch (e) { /* ignore */ }
    }
    if (!records || records.length === 0) {
      const d = window.SITAC_COLLO_DATA || {};
      records = d.workload_performa || (d.summary && d.summary.workload_performa) || computePicPerformanceFromData(d.sitac_records, d.gangguan_records);
      state.picMatrix = records || [];
    }
    if (!records || records.length === 0) {
      doc.setFontSize(11); doc.setTextColor(239, 68, 68);
      doc.text('Tidak ada data PIC Matrix.', 14, startY + 10);
      return;
    }

    const body = records.map(p => [
      p.pic || '-',
      String(p.total_penugasan || 0),
      String(p.finish || 0),
      String((p.ongoing || 0) + (p.hold || 0)),
      String(p.cancel || 0),
      `${p.finish_rate || 0}%`,
      fmtRp(p.biaya_awal),
      fmtRp(p.biaya_final),
      fmtRp(p.efisiensi_rupiah),
      `${p.efisiensi_persen || 0}%`,
      String(p.avg_sla_hari || 0),
      String(p.gangguan_count || 0)
    ]);

    doc.autoTable({
      startY: startY,
      head: [['PIC SITAC', 'Total PA', 'Finish', 'Ongoing', 'Cancel', 'Finish %', 'Biaya Awal', 'Biaya Final', 'Penghematan', 'Efisiensi %', 'Avg SLA', 'Gangguan']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [238, 242, 255] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' },
        9: { halign: 'right', fontStyle: 'bold' },
        10: { halign: 'center' },
        11: { halign: 'center' }
      }
    });
  }

  // =========================================================================
  // EVENT LISTENERS BINDING
  // =========================================================================
  function setupEventListeners() {
    // 0. Auth & Login Handlers: Mode Tabs (Masuk vs Daftar Akun Baru)
    document.querySelectorAll('.login-mode-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.login-mode-tab-btn').forEach(b => {
          b.classList.remove('active', 'text-white');
          b.classList.add('text-slate-400');
        });
        btn.classList.add('active', 'text-white');
        btn.classList.remove('text-slate-400');

        const targetPaneId = btn.getAttribute('data-target');
        const paneLogin = document.getElementById('paneLogin');
        const paneRegister = document.getElementById('paneRegister');
        const paneForgot = document.getElementById('paneForgotPassword');
        const errBox = document.getElementById('loginErrorAlert');
        const succBox = document.getElementById('loginSuccessAlert');
        if (errBox) errBox.classList.add('hidden');
        if (succBox) succBox.classList.add('hidden');

        paneForgot?.classList.add('hidden');

        if (targetPaneId === 'paneRegister') {
          paneLogin?.classList.add('hidden');
          paneRegister?.classList.remove('hidden');
          document.getElementById('regFullName')?.focus();
        } else {
          paneRegister?.classList.add('hidden');
          paneLogin?.classList.remove('hidden');
          document.getElementById('loginUsername')?.focus();
        }
      });
    });

    // 0a. Toggle Password Visibility on Login Form
    document.getElementById('btnTogglePassword')?.addEventListener('click', () => {
      const passInput = document.getElementById('loginPassword');
      const eyeIcon = document.getElementById('passwordEyeIcon');
      if (!passInput || !eyeIcon) return;
      if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
      } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
      }
    });

    // 0b. Login Form Submit Handler (Firebase Authentication)
    document.getElementById('formLogin')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = document.getElementById('loginUsername')?.value.trim();
      const p = document.getElementById('loginPassword')?.value;
      if (!u || !p) {
        showToast('Username/email dan kata sandi wajib diisi!', 'error');
        return;
      }
      performLogin(u, p);
    });

    // 0c. Fitur Lupa Sandi: Navigasi & Form Handlers (Google Firebase)
    let verifiedForgotUser = null;

    document.getElementById('btnOpenForgotPassword')?.addEventListener('click', () => {
      document.getElementById('paneLogin')?.classList.add('hidden');
      document.getElementById('paneRegister')?.classList.add('hidden');
      const paneForgot = document.getElementById('paneForgotPassword');
      if (paneForgot) paneForgot.classList.remove('hidden');

      // Reset forgot password state
      const formStep1 = document.getElementById('formForgotStep1');
      const formStepOTP = document.getElementById('formForgotStepOTP');
      const formStep2 = document.getElementById('formForgotStep2');
      const alertEl = document.getElementById('forgotPwAlert');
      if (formStep1) {
        formStep1.classList.remove('hidden');
        formStep1.reset();
      }
      if (formStepOTP) {
        formStepOTP.classList.add('hidden');
        formStepOTP.reset();
      }
      if (formStep2) {
        formStep2.classList.add('hidden');
        formStep2.reset();
      }
      if (alertEl) alertEl.className = 'p-3 rounded-lg text-xs hidden';
      verifiedForgotUser = null;
      if (typeof otpCountdownInterval !== 'undefined') clearInterval(otpCountdownInterval);
      if (typeof resendCooldownInterval !== 'undefined') clearInterval(resendCooldownInterval);

      // De-select tabs
      document.querySelectorAll('.login-mode-tab-btn').forEach(b => {
        b.classList.remove('active', 'text-white');
        b.classList.add('text-slate-400');
      });

      document.getElementById('forgotEmail')?.focus();
    });

    document.getElementById('btnBackToLoginFromForgot')?.addEventListener('click', () => {
      document.getElementById('paneForgotPassword')?.classList.add('hidden');
      document.getElementById('paneRegister')?.classList.add('hidden');
      document.getElementById('paneLogin')?.classList.remove('hidden');
      const tabLogin = document.getElementById('tabModeLogin');
      if (tabLogin) {
        tabLogin.classList.add('active', 'text-white');
        tabLogin.classList.remove('text-slate-400');
      }
      if (typeof otpCountdownInterval !== 'undefined') clearInterval(otpCountdownInterval);
      if (typeof resendCooldownInterval !== 'undefined') clearInterval(resendCooldownInterval);
      document.getElementById('loginUsername')?.focus();
    });

    // Toggle Password Visibility on Forgot Password Form
    document.getElementById('btnToggleForgotPw')?.addEventListener('click', () => {
      const passInput = document.getElementById('forgotNewPassword');
      const eyeIcon = document.getElementById('forgotEyeIcon');
      if (!passInput || !eyeIcon) return;
      if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
      } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
      }
    });

    // Toggle helper: generic function for all other password fields
    function bindPasswordToggle(btnId, inputId, iconId) {
      document.getElementById(btnId)?.addEventListener('click', () => {
        const inp = document.getElementById(inputId);
        const ico = document.getElementById(iconId);
        if (!inp || !ico) return;
        if (inp.type === 'password') {
          inp.type = 'text';
          ico.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
          inp.type = 'password';
          ico.classList.replace('fa-eye-slash', 'fa-eye');
        }
      });
    }
    // Register form (paneRegister)
    bindPasswordToggle('btnToggleRegPassword',        'regPassword',        'regPasswordEyeIcon');
    bindPasswordToggle('btnToggleRegPasswordConfirm', 'regPasswordConfirm', 'regPasswordConfirmEyeIcon');
    // Forgot password confirm
    bindPasswordToggle('btnToggleForgotConfirmPw', 'forgotConfirmPassword', 'forgotConfirmEyeIcon');
    // Admin Create User modal
    bindPasswordToggle('btnToggleAdminCreatePw',        'adminCreatePassword',        'adminCreatePwEyeIcon');
    bindPasswordToggle('btnToggleAdminCreateConfirmPw', 'adminCreateConfirmPassword', 'adminCreateConfirmPwEyeIcon');
    bindPasswordToggle('btnToggleAdminCreateAdminPw',   'adminCreateAdminPw',         'adminCreateAdminPwEyeIcon');

    // Timer variables for OTP
    let otpCountdownInterval = null;
    let resendCooldownInterval = null;

    function startResendCooldown(seconds = 60) {
      const resendBtn = document.getElementById('btnForgotResendCode');
      if (!resendBtn) return;
      let left = seconds;
      resendBtn.disabled = true;
      resendBtn.classList.add('opacity-50', 'cursor-not-allowed');
      resendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[10px]"></i> Kirim Ulang (${left}s)`;

      clearInterval(resendCooldownInterval);
      resendCooldownInterval = setInterval(() => {
        left--;
        if (left <= 0) {
          clearInterval(resendCooldownInterval);
          resendBtn.disabled = false;
          resendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          resendBtn.innerHTML = `<i class="fa-solid fa-rotate-right text-[10px]"></i> Kirim Ulang`;
        } else {
          resendBtn.innerHTML = `<i class="fa-solid fa-clock text-[10px]"></i> Kirim Ulang (${left}s)`;
        }
      }, 1000);
    }

    function startOtpCountdown(expiresAt) {
      clearInterval(otpCountdownInterval);
      const updateTimer = () => {
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        const countdownEl = document.getElementById('forgotOtpCountdown');
        if (countdownEl) {
          countdownEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
          if (remaining <= 60) {
            countdownEl.className = 'text-rose-400 font-mono animate-pulse';
          } else {
            countdownEl.className = 'text-cyan-400 font-mono';
          }
        }
        if (remaining <= 0) {
          clearInterval(otpCountdownInterval);
          if (countdownEl) countdownEl.textContent = 'Kadaluarsa';
          const alertEl = document.getElementById('forgotPwAlert');
          if (alertEl && (!verifiedForgotUser || !verifiedForgotUser.verified)) {
            alertEl.className = 'p-3 rounded-lg text-xs bg-amber-500/15 border border-amber-500/30 text-amber-300';
            alertEl.innerHTML = '<i class="fa-solid fa-clock text-amber-400 mr-1.5"></i> Kode verifikasi telah kadaluarsa. Silakan klik <strong>Kirim Ulang</strong> untuk mendapatkan kode baru.';
          }
        }
      };
      updateTimer();
      otpCountdownInterval = setInterval(updateTimer, 1000);
    }

    // Input filter: Only digits & auto-maxlength 6
    document.getElementById('forgotOtpInput')?.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });

    // Button Back to Step 1 from OTP
    document.getElementById('btnForgotBackToStep1')?.addEventListener('click', () => {
      clearInterval(otpCountdownInterval);
      clearInterval(resendCooldownInterval);
      document.getElementById('formForgotStep1')?.classList.remove('hidden');
      document.getElementById('formForgotStepOTP')?.classList.add('hidden');
      document.getElementById('formForgotStep2')?.classList.add('hidden');
      const alertEl = document.getElementById('forgotPwAlert');
      if (alertEl) alertEl.className = 'p-3 rounded-lg text-xs hidden';
      document.getElementById('forgotEmail')?.focus();
    });

    // Button Resend OTP Code
    document.getElementById('btnForgotResendCode')?.addEventListener('click', async () => {
      if (!verifiedForgotUser || !verifiedForgotUser.email) return;
      const resendBtn = document.getElementById('btnForgotResendCode');
      if (resendBtn && resendBtn.disabled) return;

      const alertEl = document.getElementById('forgotPwAlert');
      try {
        let res = null;
        if (window.FirebaseManager && typeof window.FirebaseManager.sendResetCode === 'function') {
          res = await window.FirebaseManager.sendResetCode(verifiedForgotUser.email);
        } else {
          const resp = await fetch('/api/auth/send-reset-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: verifiedForgotUser.email })
          });
          res = await resp.json();
          if (!res.success) throw new Error(res.error || 'Gagal mengirim kode.');
        }

        verifiedForgotUser.code = res.code;
        verifiedForgotUser.expires_at = res.expires_at || (Date.now() + 600000);

        startOtpCountdown(verifiedForgotUser.expires_at);
        startResendCooldown(60);

        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-300';
          alertEl.innerHTML = `<i class="fa-solid fa-paper-plane mr-1.5"></i> Kode verifikasi baru telah dikirimkan ke <strong>${verifiedForgotUser.email}</strong>.`;
        }
        showToast('Kode verifikasi baru berhasil dikirim!', 'success');

      } catch (err) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${err.message || 'Gagal mengirim ulang kode.'}`;
        }
        showToast(err.message || 'Gagal mengirim ulang kode', 'error');
      }
    });

    // Step 1 Lupa Sandi: Cari Akun berdasarkan Email Terdaftar & Kirim Kode Verifikasi
    document.getElementById('formForgotStep1')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('forgotEmail')?.value || document.getElementById('forgotIdentifier')?.value || '').trim().toLowerCase();
      const alertEl = document.getElementById('forgotPwAlert');
      const submitBtn = document.getElementById('btnForgotCheckAccount');

      if (!email) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1.5"></i> Silakan masukkan alamat email akun Anda.';
        }
        document.getElementById('forgotEmail')?.focus();
        return;
      }

      if (!email.includes('@') || email.length < 5) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Harap masukkan format alamat email yang valid (contoh: user@telecom.ops). Username tidak diperbolehkan demi keamanan.';
        }
        document.getElementById('forgotEmail')?.focus();
        return;
      }

      if (email.startsWith('admin@') || email === 'admin@telecom.ops') {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = '<i class="fa-solid fa-shield-halved mr-1.5"></i> Akun Administrator diproteksi dan tidak dapat di-reset melalui halaman umum. Silakan hubungi tim IT / Manajemen.';
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Mengirim Kode ke Email...';
      }

      try {
        let res = null;
        // Priority 1: Firebase Manager sendResetCode
        if (window.FirebaseManager && typeof window.FirebaseManager.sendResetCode === 'function') {
          res = await window.FirebaseManager.sendResetCode(email);
        } else {
          // Priority 2: Backend SQLite API /api/auth/send-reset-code
          const resp = await fetch('/api/auth/send-reset-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
          });
          res = await resp.json();
          if (!res.success) throw new Error(res.error || 'Gagal memproses permintaan kode.');
        }

        verifiedForgotUser = {
          username: res.username,
          full_name: res.full_name,
          role: res.role,
          email: res.email || email,
          masked_email: res.masked_email || res.email || email,
          code: res.code,
          expires_at: res.expires_at || (Date.now() + 600000),
          verified: false
        };

        // Populate step OTP details
        const recipientNameEl = document.getElementById('forgotOtpRecipientName');
        const targetEmailEl = document.getElementById('forgotOtpTargetEmail');
        const otpInputEl = document.getElementById('forgotOtpInput');

        if (recipientNameEl) {
          recipientNameEl.innerHTML = `<i class="fa-solid fa-user-circle text-cyan-400"></i> ${res.full_name} <span class="font-mono text-[11px] text-cyan-300">(@${res.username})</span>`;
        }
        if (targetEmailEl) targetEmailEl.textContent = res.email || email;
        if (otpInputEl) otpInputEl.value = '';

        // Switch from Step 1 to Step OTP
        document.getElementById('formForgotStep1')?.classList.add('hidden');
        document.getElementById('formForgotStepOTP')?.classList.remove('hidden');
        document.getElementById('formForgotStep2')?.classList.add('hidden');

        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-cyan-500/15 border border-cyan-500/30 text-cyan-300';
          alertEl.innerHTML = `<i class="fa-solid fa-paper-plane mr-1.5 text-cyan-400"></i> Kode verifikasi 6-digit telah dikirimkan ke email <strong>${verifiedForgotUser.email}</strong>. Silakan periksa inbox email Anda.`;
        }

        startOtpCountdown(verifiedForgotUser.expires_at);
        startResendCooldown(60);
        otpInputEl?.focus();

      } catch (err) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${err.message || 'Email tidak terdaftar atau gagal mengirim kode.'}`;
        }
        showToast(err.message || 'Gagal mengirim kode verifikasi', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1.5"></i> Kirim Kode Verifikasi ke Email';
        }
      }
    });

    // Step 2 Lupa Sandi: Verifikasi Kode OTP 6-Digit
    document.getElementById('formForgotStepOTP')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const codeInput = document.getElementById('forgotOtpInput')?.value.trim();
      const alertEl = document.getElementById('forgotPwAlert');
      const submitBtn = document.getElementById('btnForgotSubmitOtp');

      if (!codeInput || codeInput.length !== 6) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1.5"></i> Masukkan 6 digit kode verifikasi dengan lengkap.';
        }
        document.getElementById('forgotOtpInput')?.focus();
        return;
      }

      if (!verifiedForgotUser || !verifiedForgotUser.email) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1.5"></i> Sesi verifikasi tidak ditemukan. Silakan kirim kode ulang.';
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Memvalidasi Kode...';
      }

      try {
        let verifyRes = null;
        if (window.FirebaseManager && typeof window.FirebaseManager.verifyResetCode === 'function') {
          verifyRes = await window.FirebaseManager.verifyResetCode(verifiedForgotUser.email, codeInput);
        } else {
          const resp = await fetch('/api/auth/verify-reset-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: verifiedForgotUser.email, code: codeInput })
          });
          verifyRes = await resp.json();
          if (!verifyRes.success) throw new Error(verifyRes.error || 'Kode verifikasi tidak sesuai.');
        }

        verifiedForgotUser.verified = true;
        verifiedForgotUser.code = codeInput;
        clearInterval(otpCountdownInterval);
        clearInterval(resendCooldownInterval);

        // Switch to Step 3: Buat Kata Sandi Baru
        document.getElementById('formForgotStepOTP')?.classList.add('hidden');
        document.getElementById('formForgotStep2')?.classList.remove('hidden');

        // Populate step 3 details
        const nameEl = document.getElementById('forgotVerifiedName');
        const roleEl = document.getElementById('forgotVerifiedRole');
        if (nameEl) nameEl.textContent = verifiedForgotUser.full_name;
        if (roleEl) {
          const roleLabel = verifiedForgotUser.role === 'admin' ? 'Administrator / Manajemen' : 'Teknisi PIC Lapangan';
          roleEl.textContent = `${roleLabel} (@${verifiedForgotUser.username}) • ${verifiedForgotUser.email}`;
        }

        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-300';
          alertEl.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5"></i> Kode verifikasi berhasil divalidasi! Email <strong>${verifiedForgotUser.email}</strong> terverifikasi. Silakan tentukan kata sandi baru Anda.`;
        }
        showToast('Email terverifikasi! Masukkan kata sandi baru.', 'success');
        document.getElementById('forgotNewPassword')?.focus();

      } catch (err) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${err.message || 'Kode verifikasi salah atau sudah kadaluarsa.'}`;
        }
        showToast(err.message || 'Kode verifikasi salah', 'error');
        const inputEl = document.getElementById('forgotOtpInput');
        if (inputEl) {
          inputEl.classList.add('border-rose-500');
          setTimeout(() => inputEl.classList.remove('border-rose-500'), 2000);
          inputEl.focus();
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-shield-check mr-1.5"></i> Verifikasi Kode';
        }
      }
    });

    // Step 3 Lupa Sandi: Simpan Sandi Baru ke Database / Firebase
    document.getElementById('formForgotStep2')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertEl = document.getElementById('forgotPwAlert');
      const submitBtn = document.getElementById('btnForgotSubmitReset');
      const newPw = document.getElementById('forgotNewPassword')?.value;
      const confirmPw = document.getElementById('forgotConfirmPassword')?.value;

      if (!verifiedForgotUser || !verifiedForgotUser.username || !verifiedForgotUser.verified) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1.5"></i> Email belum terverifikasi dengan kode OTP. Silakan lakukan verifikasi kode terlebih dahulu.';
        }
        return;
      }

      if (!newPw || newPw.length < 4) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1.5"></i> Kata sandi baru minimal 4 karakter.';
        }
        return;
      }

      if (newPw !== confirmPw) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1.5"></i> Konfirmasi kata sandi tidak cocok.';
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan Sandi Baru...';
      }

      try {
        let resetSuccess = false;
        // Priority 1: Firebase Manager with code verification
        if (window.FirebaseManager && typeof window.FirebaseManager.resetPasswordWithCode === 'function') {
          await window.FirebaseManager.resetPasswordWithCode(verifiedForgotUser.email, verifiedForgotUser.code, newPw);
          resetSuccess = true;
        }

        // Priority 2: Sync to local server backend if running
        try {
          const resp = await fetch('/api/auth/reset-password-with-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identifier: verifiedForgotUser.email,
              code: verifiedForgotUser.code,
              new_password: newPw
            })
          });
          const localRes = await resp.json();
          if (localRes.success) resetSuccess = true;
        } catch (e) {
          // If local server is not running (e.g. Firebase hosting only), ignore local sync failure if Firebase succeeded
          if (!resetSuccess) throw e;
        }

        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-300';
          alertEl.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5"></i> Kata sandi akun <strong>@${verifiedForgotUser.username}</strong> berhasil diperbarui! Mengalihkan ke login...`;
        }
        showToast('Kata sandi berhasil diperbarui!', 'success');

        const savedUsername = verifiedForgotUser.username;
        verifiedForgotUser = null;

        // Auto return to login pane after 1.5 seconds
        setTimeout(() => {
          document.getElementById('paneForgotPassword')?.classList.add('hidden');
          document.getElementById('paneRegister')?.classList.add('hidden');
          document.getElementById('paneLogin')?.classList.remove('hidden');

          const tabLogin = document.getElementById('tabModeLogin');
          if (tabLogin) {
            tabLogin.classList.add('active', 'text-white');
            tabLogin.classList.remove('text-slate-400');
          }

          const loginUserInput = document.getElementById('loginUsername');
          const loginPassInput = document.getElementById('loginPassword');
          if (loginUserInput) loginUserInput.value = savedUsername;
          if (loginPassInput) {
            loginPassInput.value = '';
            loginPassInput.focus();
          }
        }, 1500);

      } catch (err) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-lg text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300';
          alertEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${err.message || 'Gagal mereset kata sandi.'}`;
        }
        showToast(err.message || 'Gagal mereset kata sandi', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-key mr-1.5"></i> Simpan Sandi Baru';
        }
      }
    });

    // 0d. Register Form Submit Handler (Daftar PIC Baru langsung ke Google Firebase Cloud Firestore)
    document.getElementById('formRegister')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('loginErrorAlert');
      const errMsg = document.getElementById('loginErrorMsg');
      const succBox = document.getElementById('loginSuccessAlert');
      const succMsg = document.getElementById('loginSuccessMsg');
      const submitBtn = document.getElementById('btnRegisterSubmit');

      if (errBox) errBox.classList.add('hidden');
      if (succBox) succBox.classList.add('hidden');

      const fullName = document.getElementById('regFullName')?.value.trim();
      const username = document.getElementById('regUsername')?.value.trim().toLowerCase();
      const email = document.getElementById('regEmail')?.value.trim().toLowerCase() || `${username}@telecom.ops`;
      const picSelect = document.getElementById('regPicCode');
      let picCode = picSelect ? picSelect.value : '';
      if (!picCode || picCode === 'Custom') {
        picCode = fullName ? fullName.split(' ')[0] : username;
      }
      const password = document.getElementById('regPassword')?.value;
      const passwordConfirm = document.getElementById('regPasswordConfirm')?.value;

      if (!fullName || !username || !password) {
        if (errBox) {
          errBox.classList.remove('hidden');
          if (errMsg) errMsg.textContent = 'Harap lengkapi semua data pendaftaran.';
        }
        return;
      }

      if (password.length < 4) {
        if (errBox) {
          errBox.classList.remove('hidden');
          if (errMsg) errMsg.textContent = 'Kata sandi minimal harus 4 karakter.';
        }
        return;
      }

      if (password !== passwordConfirm) {
        if (errBox) {
          errBox.classList.remove('hidden');
          if (errMsg) errMsg.textContent = 'Konfirmasi kata sandi tidak cocok dengan kata sandi yang dibuat.';
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> Mendaftarkan ke Firebase...';
      }

      try {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) {
          throw new Error('Koneksi Google Firebase belum aktif.');
        }

        // PURE FIREBASE FIRESTORE REGISTRATION
        const regRes = await window.FirebaseManager.registerUser({
          full_name: fullName,
          username: username,
          email: email,
          pic_code: picCode,
          password: password,
          role: 'lapangan'
        });

        // Show success alert with direct WhatsApp button
        if (succBox) {
          succBox.classList.remove('hidden');
          const waUrl = generateAdminWhatsAppUrl(username, fullName);
          succBox.className = 'p-3.5 mb-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-xs shadow-lg shadow-emerald-950/20';
          succBox.innerHTML = `
            <div class="flex items-start gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <i class="fa-solid fa-circle-check text-base"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-emerald-300 text-xs">Pendaftaran Berhasil Diajukan!</div>
                <div class="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  Akun PIC <strong>@${escapeHtml(username)}</strong> (${escapeHtml(fullName)}) sedang menunggu persetujuan Administrator.
                </div>
                <div class="mt-3 pt-2.5 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <span class="text-[10.5px] text-slate-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-paper-plane text-[10px] text-emerald-400"></i> Kirim konfirmasi pendaftaran ke Admin:
                  </span>
                  <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
                    class="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition active:scale-95 whitespace-nowrap">
                    <i class="fa-brands fa-whatsapp text-sm"></i>
                    <span>Hubungi Admin via WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          `;
        }
        showToast(regRes.message || 'Pendaftaran berhasil diajukan! Menunggu persetujuan Admin.', 'success');

        // Reset form
        document.getElementById('formRegister')?.reset();

        // Switch to login tab and prefill username after 6 seconds
        setTimeout(() => {
          document.getElementById('tabModeLogin')?.click();
          const loginUserInput = document.getElementById('loginUsername');
          const loginPassInput = document.getElementById('loginPassword');
          if (loginUserInput) loginUserInput.value = username;
          if (loginPassInput) {
            loginPassInput.value = '';
          }
        }, 6000);

      } catch (err) {
        if (errBox) {
          errBox.classList.remove('hidden');
          if (errMsg) errMsg.textContent = err.message || 'Pendaftaran akun ke Firebase gagal.';
        }
        showToast(err.message || 'Pendaftaran akun gagal', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-user-plus mr-1.5"></i> Daftarkan Akun PIC ke Cloud Firebase';
        }
      }
    });

    // 0e. Change Password Modal Handlers
    document.getElementById('btnOpenChangePassword')?.addEventListener('click', () => {
      const modal = document.getElementById('modalChangePassword');
      const alert = document.getElementById('changePwAlert');
      if (alert) alert.className = 'p-2.5 rounded-lg text-xs hidden';
      document.getElementById('formChangePassword')?.reset();
      if (modal) modal.style.display = 'flex';
      document.getElementById('changePwOld')?.focus();
    });

    const closeChangePasswordModal = () => {
      const modal = document.getElementById('modalChangePassword');
      if (modal) modal.style.display = 'none';
    };
    document.getElementById('btnCloseChangePassword')?.addEventListener('click', closeChangePasswordModal);
    document.getElementById('btnBackChangePassword')?.addEventListener('click', closeChangePasswordModal);
    document.getElementById('btnCancelChangePassword')?.addEventListener('click', closeChangePasswordModal);
    document.getElementById('modalChangePassword')?.addEventListener('click', (e) => {
      if (e.target.id === 'modalChangePassword') closeChangePasswordModal();
    });

    document.getElementById('formChangePassword')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPw = document.getElementById('changePwOld')?.value;
      const newPw = document.getElementById('changePwNew')?.value;
      const confirmPw = document.getElementById('changePwConfirm')?.value;
      const alert = document.getElementById('changePwAlert');
      const submitBtn = document.getElementById('btnSubmitChangePassword');

      if (!oldPw || !newPw || !confirmPw) {
        if (alert) {
          alert.className = 'p-2.5 rounded-lg text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30';
          alert.textContent = 'Harap isi semua kolom password.';
        }
        return;
      }

      if (newPw.length < 4) {
        if (alert) {
          alert.className = 'p-2.5 rounded-lg text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30';
          alert.textContent = 'Password baru minimal 4 karakter.';
        }
        return;
      }

      if (newPw !== confirmPw) {
        if (alert) {
          alert.className = 'p-2.5 rounded-lg text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30';
          alert.textContent = 'Konfirmasi password baru tidak cocok.';
        }
        return;
      }

      if (!state.currentUser?.username) {
        showToast('Sesi login tidak valid, silakan login ulang', 'error');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
      }

      try {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) {
          throw new Error('Koneksi Google Firebase belum aktif.');
        }

        const res = await window.FirebaseManager.changePassword(
          state.currentUser.username,
          oldPw,
          newPw
        );

        showToast('Password akun Anda berhasil diperbarui di Cloud Firebase!', 'success');
        const modal = document.getElementById('modalChangePassword');
        if (modal) modal.style.display = 'none';
        document.getElementById('formChangePassword')?.reset();

      } catch (err) {
        if (alert) {
          alert.className = 'p-2.5 rounded-lg text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30';
          alert.textContent = err.message;
        }
        showToast(err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-save mr-1"></i> Simpan Password Baru';
        }
      }
    });

    // 0f. Update My Email Handlers (modalUpdateMyEmail)
    document.getElementById('btnOpenUpdateEmail')?.addEventListener('click', () => {
      const modal = document.getElementById('modalUpdateMyEmail');
      const alert = document.getElementById('updateMyEmailAlert');
      if (alert) alert.className = 'p-2.5 rounded-lg text-xs hidden';

      const user = state.currentUser || JSON.parse(localStorage.getItem('telecom_portal_user') || '{}');
      const nameEl = document.getElementById('myEmailDisplayName');
      const userEl = document.getElementById('myEmailUsername');
      const statusEl = document.getElementById('myEmailCurrentStatus');
      const input = document.getElementById('myEmailInput');

      if (nameEl) nameEl.textContent = user.full_name || user.username || 'Pengguna';
      if (userEl) userEl.textContent = `@${user.username || 'user'}`;
      if (statusEl) {
        statusEl.innerHTML = user.email 
          ? `Email saat ini: <strong class="text-emerald-400 font-mono">${user.email}</strong>` 
          : `Email saat ini: <span class="text-amber-400 font-semibold">- Belum Terdaftar -</span>`;
      }
      if (input) {
        input.value = user.email || '';
        setTimeout(() => input.focus(), 50);
      }

      if (modal) modal.style.display = 'flex';
    });

    const closeUpdateMyEmailModal = () => {
      const modal = document.getElementById('modalUpdateMyEmail');
      if (modal) modal.style.display = 'none';
    };
    document.getElementById('btnCloseUpdateMyEmail')?.addEventListener('click', closeUpdateMyEmailModal);
    document.getElementById('btnBackUpdateMyEmail')?.addEventListener('click', closeUpdateMyEmailModal);
    document.getElementById('btnCancelUpdateMyEmail')?.addEventListener('click', closeUpdateMyEmailModal);
    document.getElementById('modalUpdateMyEmail')?.addEventListener('click', (e) => {
      if (e.target.id === 'modalUpdateMyEmail') closeUpdateMyEmailModal();
    });

    document.getElementById('btnMyEmailAutoSuggest')?.addEventListener('click', () => {
      const user = state.currentUser || JSON.parse(localStorage.getItem('telecom_portal_user') || '{}');
      const name = user.full_name || user.username || '';
      if (!name) return;
      const suggested = (name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).join('.') + '@telecom.ops');
      const input = document.getElementById('myEmailInput');
      if (input) {
        input.value = suggested;
        input.focus();
      }
    });

    document.getElementById('formUpdateMyEmail')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('myEmailInput');
      const alert = document.getElementById('updateMyEmailAlert');
      const submitBtn = document.getElementById('btnSubmitUpdateMyEmail');
      const newEmail = input?.value.trim().toLowerCase();

      function showAlert(msg, isErr) {
        if (alert) {
          alert.className = `p-2.5 rounded-lg text-xs border ${isErr ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`;
          alert.textContent = msg;
          alert.classList.remove('hidden');
        }
      }

      if (!newEmail || !newEmail.includes('@') || !newEmail.includes('.')) {
        return showAlert('Format email tidak valid. Masukkan alamat email yang benar.', true);
      }

      const user = state.currentUser || JSON.parse(localStorage.getItem('telecom_portal_user') || '{}');
      if (!user.username) {
        return showAlert('Sesi login tidak valid. Silakan login kembali.', true);
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...';

      try {
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          const res = await window.FirebaseManager.updateUserEmail(user.username, newEmail, user.username);
          showAlert(res.message, false);
          showToast(res.message, 'success');
        } else {
          const res = await fetch('/api/auth/update-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user.username, email: newEmail })
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || 'Gagal menyimpan email');
          showAlert(d.message, false);
          showToast(d.message, 'success');
        }

        // Update local session
        user.email = newEmail;
        state.currentUser = user;
        localStorage.setItem('telecom_portal_user', JSON.stringify(user));
        updateUserEmailBadges();

        setTimeout(() => {
          const modal = document.getElementById('modalUpdateMyEmail');
          if (modal) modal.style.display = 'none';
        }, 1200);

      } catch (err) {
        showAlert(err.message || 'Gagal menyimpan email.', true);
        showToast(err.message || 'Gagal menyimpan email', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Email';
      }
    });

    // =====================================================================
    // ADMIN: KELOLA AKUN PIC HANDLERS (APPROVAL, RESET, DELETE, EMAIL)
    // =====================================================================

    // Helper: load daftar PIC/Pengguna ke dropdown admin via Firebase (hanya akun yang aktif / disetujui)
    async function loadAdminUserList() {
      try {
        let pics = [];
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          const allUsers = await window.FirebaseManager.fetchCollection('users');
          pics = allUsers.filter(u => u.username !== 'admin' && u.status !== 'pending');
        }
        if (!pics || pics.length === 0) {
          const res = await fetch('/api/auth/registered-pics');
          if (res.ok) {
            const data = await res.json();
            pics = data.pics || [];
          }
        }
        const opts = pics.map(p => {
          const roleTag = (p.role === 'admin') ? '[ADMIN] ' : (p.role === 'sales' ? '[SALES] ' : '[PIC] ');
          return `<option value="${p.username}">${roleTag}${p.full_name || p.username} (@${p.username})</option>`;
        }).join('');
        const selectReset = document.getElementById('adminResetTargetUser');
        const selectDelete = document.getElementById('adminDeleteTargetUser');
        const selectEmail = document.getElementById('adminEmailTargetUser');
        if (selectReset) selectReset.innerHTML = `<option value="">-- Pilih Akun Pengguna / PIC --</option>${opts}`;
        if (selectDelete) selectDelete.innerHTML = `<option value="">-- Pilih Akun Pengguna / PIC --</option>${opts}`;
        if (selectEmail) {
          const emailOpts = pics.map(p => {
            const roleTag = (p.role === 'admin') ? '[ADMIN] ' : (p.role === 'sales' ? '[SALES] ' : '[PIC] ');
            const emailStatus = p.email ? `(${p.email})` : '• [Belum Ada Email]';
            return `<option value="${p.username}" data-name="${p.full_name || p.username}" data-email="${p.email || ''}">${roleTag}${p.full_name || p.username} (@${p.username}) ${emailStatus}</option>`;
          }).join('');
          const curVal = selectEmail.value;
          selectEmail.innerHTML = `<option value="">-- Pilih Akun Teknisi PIC --</option>${emailOpts}`;
          if (curVal) selectEmail.value = curVal;
        }
      } catch (err) {
        console.warn('Gagal memuat daftar PIC dari Firebase:', err);
      }
    }

    // Helper: load daftar permohonan PIC pending ke tab persetujuan
    async function loadAdminPendingUsersList() {
      const container = document.getElementById('adminPendingListContainer');
      const badgeModal = document.getElementById('adminPendingBadge');
      const badgeTools = document.getElementById('toolsPendingUserBadge');
      const alertBox = document.getElementById('adminPendingAlert');
      if (alertBox) alertBox.className = 'p-2.5 rounded-lg text-xs hidden';

      const waDisplay = document.getElementById('adminWaDisplay');
      if (waDisplay) {
        waDisplay.textContent = localStorage.getItem('telecom_admin_wa') || window.TELECOM_ADMIN_WA || '6281234567890';
      }

      if (!container) return;
      container.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          <i class="fa-solid fa-spinner fa-spin text-cyan-400 text-lg mb-2 block"></i> Memeriksa permohonan akun...
        </div>
      `;

      try {
        let pending = [];
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          pending = await window.FirebaseManager.fetchPendingUsers();
        }

        const count = pending.length;

        // Update badges
        if (badgeModal) {
          if (count > 0) {
            badgeModal.textContent = count;
            badgeModal.classList.remove('hidden');
          } else {
            badgeModal.classList.add('hidden');
          }
        }
        if (badgeTools) {
          if (count > 0) {
            badgeTools.textContent = `${count} Baru`;
            badgeTools.classList.remove('hidden');
          } else {
            badgeTools.classList.add('hidden');
          }
        }

        if (count === 0) {
          container.innerHTML = `
            <div class="text-center py-8 px-4 rounded-xl border border-dashed border-white/10 bg-slate-900/40">
              <i class="fa-solid fa-circle-check text-emerald-400 text-2xl mb-2 block"></i>
              <div class="text-xs font-semibold text-slate-300">Tidak ada permohonan akun pending</div>
              <div class="text-[11px] text-slate-400 mt-0.5">Semua permohonan teknisi PIC telah disetujui atau diverifikasi.</div>
            </div>
          `;
          return;
        }

        container.innerHTML = pending.map(u => {
          const reqTime = u.approval_requested_at?.toDate ? u.approval_requested_at.toDate().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : (u.created_at?.toDate ? u.created_at.toDate().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Baru saja');
          const safeName = (u.full_name || u.username).replace(/'/g, "\\'");
          return `
            <div class="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md" id="cardPending_${u.username}">
              <div class="flex items-start gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <i class="fa-solid fa-helmet-safety text-sm"></i>
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-white truncate flex items-center gap-1.5">
                    <span>${u.full_name || u.username}</span>
                    <span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">Pending</span>
                  </div>
                  <div class="text-[11px] text-slate-400 font-mono truncate">@${u.username} &bull; ${u.email || '-'}</div>
                  <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <i class="fa-regular fa-clock text-[9px]"></i> Diajukan: ${reqTime}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button type="button" class="btn btn-sm btn-primary bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 text-xs" onclick="window.handleAdminApproveUser('${u.username}', '${safeName}')">
                  <i class="fa-solid fa-check mr-1"></i> Setujui
                </button>
                <button type="button" class="btn btn-sm text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 px-2 py-1 text-xs" onclick="window.handleAdminRejectUser('${u.username}', '${safeName}')">
                  <i class="fa-solid fa-xmark mr-1"></i> Tolak
                </button>
              </div>
            </div>
          `;
        }).join('');

      } catch (err) {
        console.error('Error loadAdminPendingUsersList:', err);
        container.innerHTML = `
          <div class="text-center py-6 text-rose-400 text-xs">
            <i class="fa-solid fa-triangle-exclamation text-lg mb-1 block"></i>
            Gagal memuat permohonan akun: ${err.message || 'Error'}
          </div>
        `;
      }
    }

    // Handler Setujui PIC
    window.handleAdminApproveUser = async function(username, fullName) {
      if (!confirm(`Setujui permohonan akun PIC untuk "${fullName}" (@${username})?\nSetelah disetujui, teknisi dapat segera login.`)) return;
      const alertBox = document.getElementById('adminPendingAlert');
      try {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) {
          throw new Error('Koneksi Google Firebase belum aktif.');
        }
        const res = await window.FirebaseManager.approveUser(username);
        if (alertBox) {
          alertBox.className = 'p-2.5 rounded-lg text-xs border bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
          alertBox.textContent = res.message;
        }
        showToast(res.message, 'success');
        await loadAdminPendingUsersList();
        await loadAdminUserList();
      } catch (err) {
        if (alertBox) {
          alertBox.className = 'p-2.5 rounded-lg text-xs border bg-rose-500/20 text-rose-300 border-rose-500/30';
          alertBox.textContent = err.message || 'Gagal menyetujui akun';
        }
        showToast(err.message || 'Gagal menyetujui akun', 'error');
      }
    };

    // Handler Tolak PIC
    window.handleAdminRejectUser = async function(username, fullName) {
      if (!confirm(`Tolak dan batalkan permohonan akun PIC "${fullName}" (@${username})?`)) return;
      const alertBox = document.getElementById('adminPendingAlert');
      try {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) {
          throw new Error('Koneksi Google Firebase belum aktif.');
        }
        const res = await window.FirebaseManager.rejectUser(username);
        if (alertBox) {
          alertBox.className = 'p-2.5 rounded-lg text-xs border bg-amber-500/20 text-amber-300 border-amber-500/30';
          alertBox.textContent = res.message;
        }
        showToast(res.message, 'info');
        await loadAdminPendingUsersList();
        await loadAdminUserList();
      } catch (err) {
        if (alertBox) {
          alertBox.className = 'p-2.5 rounded-lg text-xs border bg-rose-500/20 text-rose-300 border-rose-500/30';
          alertBox.textContent = err.message || 'Gagal menolak akun';
        }
        showToast(err.message || 'Gagal menolak akun', 'error');
      }
    };

    // Helper: switch tab admin
    window.switchAdminTab = function(tab) {
      const panelPending = document.getElementById('tabPanelPending');
      const panelCreate = document.getElementById('formAdminCreateUser');
      const panelEmail = document.getElementById('tabPanelEmail');
      const panelReset = document.getElementById('tabPanelReset');
      const panelDelete = document.getElementById('tabPanelDelete');

      const btnPending = document.getElementById('tabPendingUsers');
      const btnCreate = document.getElementById('tabCreateUser');
      const btnEmail = document.getElementById('tabPicEmail');
      const btnReset = document.getElementById('tabResetPw');
      const btnDelete = document.getElementById('tabDeleteUser');

      if (btnPending) {
        btnPending.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-slate-400 hover:text-emerald-300 transition flex items-center justify-center gap-1 whitespace-nowrap';
      }
      if (btnCreate) {
        btnCreate.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-slate-400 hover:text-cyan-300 transition flex items-center justify-center gap-1 whitespace-nowrap';
      }
      if (btnEmail) {
        btnEmail.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-slate-400 hover:text-amber-300 transition flex items-center justify-center gap-1 whitespace-nowrap';
      }
      if (btnReset) {
        btnReset.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-slate-400 hover:text-violet-300 transition flex items-center justify-center gap-1 whitespace-nowrap';
      }
      if (btnDelete) {
        btnDelete.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-slate-400 hover:text-rose-300 transition flex items-center justify-center gap-1 whitespace-nowrap';
      }

      panelPending?.classList.add('hidden');
      panelCreate?.classList.add('hidden');
      panelEmail?.classList.add('hidden');
      panelReset?.classList.add('hidden');
      panelDelete?.classList.add('hidden');

      if (tab === 'pending') {
        panelPending?.classList.remove('hidden');
        if (btnPending) {
          btnPending.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-emerald-400 border-b-2 border-emerald-400 transition flex items-center justify-center gap-1 whitespace-nowrap';
        }
        loadAdminPendingUsersList();
      } else if (tab === 'create') {
        panelCreate?.classList.remove('hidden');
        if (btnCreate) {
          btnCreate.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-cyan-400 border-b-2 border-cyan-400 transition flex items-center justify-center gap-1 whitespace-nowrap';
        }
      } else if (tab === 'email') {
        panelEmail?.classList.remove('hidden');
        if (btnEmail) {
          btnEmail.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-amber-400 border-b-2 border-amber-400 transition flex items-center justify-center gap-1 whitespace-nowrap';
        }
        loadAdminEmailPICList();
      } else if (tab === 'reset') {
        panelReset?.classList.remove('hidden');
        if (btnReset) {
          btnReset.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-violet-300 border-b-2 border-violet-400 transition flex items-center justify-center gap-1 whitespace-nowrap';
        }
      } else if (tab === 'delete') {
        panelDelete?.classList.remove('hidden');
        if (btnDelete) {
          btnDelete.className = 'flex-1 py-2.5 px-2 text-xs font-semibold text-rose-300 border-b-2 border-rose-400 transition flex items-center justify-center gap-1 whitespace-nowrap';
        }
      }
    };

    // Background badge updater
    window.checkAdminPendingUsersBadge = async function() {
      try {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) return;
        const pending = await window.FirebaseManager.fetchPendingUsers();
        const count = pending.length;
        const badgeModal = document.getElementById('adminPendingBadge');
        const badgeTools = document.getElementById('toolsPendingUserBadge');
        if (badgeModal) {
          if (count > 0) {
            badgeModal.textContent = count;
            badgeModal.classList.remove('hidden');
          } else {
            badgeModal.classList.add('hidden');
          }
        }
        if (badgeTools) {
          if (count > 0) {
            badgeTools.textContent = `${count} Baru`;
            badgeTools.classList.remove('hidden');
          } else {
            badgeTools.classList.add('hidden');
          }
        }
      } catch (e) {
        console.warn('Error checking pending users badge:', e);
      }
    };

    // Buka modal admin
    document.getElementById('btnOpenAdminUsers')?.addEventListener('click', () => {
      const modal = document.getElementById('modalAdminUsers');
      if (modal) modal.style.display = 'flex';
      loadAdminUserList();
      // Reset fields
      ['adminResetNewPw','adminResetConfirmPw','adminResetAdminPw','adminDeleteAdminPw','adminCreateUsername','adminCreateDisplayName','adminCreateEmail','adminCreatePassword','adminCreateConfirmPassword','adminCreateAdminPw','adminEmailInput'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      const roleSel = document.getElementById('adminCreateRole');
      if (roleSel) roleSel.value = 'admin'; // Default ke Administrator
      const teamRoleInp = document.getElementById('adminCreateTeamRole');
      if (teamRoleInp) teamRoleInp.value = 'Administrator';

      ['adminResetAlert','adminDeleteAlert','adminPendingAlert','adminCreateAlert','adminEmailAlert'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = 'p-2.5 rounded-lg text-xs hidden';
      });
      const emailCard = document.getElementById('adminEmailSelectedCard');
      if (emailCard) emailCard.classList.add('hidden');
      const emailSuggest = document.getElementById('btnAdminEmailAutoSuggest');
      if (emailSuggest) emailSuggest.classList.add('hidden');
      const emailHint = document.getElementById('adminEmailSuggestHint');
      if (emailHint) emailHint.classList.add('hidden');

      window.switchAdminTab('pending');
    });

    // Refresh pending users list button
    document.getElementById('btnRefreshPendingUsers')?.addEventListener('click', () => {
      loadAdminPendingUsersList();
    });

    // Ubah nomor WhatsApp Admin untuk konfirmasi persetujuan PIC
    document.getElementById('btnEditAdminWa')?.addEventListener('click', () => {
      const current = localStorage.getItem('telecom_admin_wa') || window.TELECOM_ADMIN_WA || '6281234567890';
      const input = prompt('Masukkan nomor WhatsApp Admin untuk menerima konfirmasi dari pendaftar baru:\n(Format: 628xxxxxxxxxx tanpa tanda + atau spasi)', current);
      if (input !== null) {
        const clean = input.replace(/[^0-9]/g, '');
        if (clean.length >= 8) {
          const formatted = clean.startsWith('0') ? '62' + clean.slice(1) : clean;
          localStorage.setItem('telecom_admin_wa', formatted);
          window.TELECOM_ADMIN_WA = formatted;
          const waDisplay = document.getElementById('adminWaDisplay');
          if (waDisplay) waDisplay.textContent = formatted;
          showToast(`Nomor WhatsApp Admin disimpan: +${formatted}`, 'success');
        } else {
          showToast('Nomor WhatsApp tidak valid (terlalu pendek)', 'error');
        }
      }
    });

    // Tutup / Kembali modal admin
    const closeAdminUsersModal = () => {
      const modal = document.getElementById('modalAdminUsers');
      if (modal) modal.style.display = 'none';
    };
    document.getElementById('btnCloseAdminUsers')?.addEventListener('click', closeAdminUsersModal);
    document.getElementById('btnBackAdminUsers')?.addEventListener('click', closeAdminUsersModal);
    document.getElementById('btnBottomBackAdminUsers')?.addEventListener('click', closeAdminUsersModal);
    document.getElementById('modalAdminUsers')?.addEventListener('click', (e) => {
      if (e.target.id === 'modalAdminUsers') closeAdminUsersModal();
    });

    // Admin: Reset Password
    document.getElementById('btnSubmitAdminReset')?.addEventListener('click', async () => {
      const targetUser = document.getElementById('adminResetTargetUser')?.value;
      const newPw = document.getElementById('adminResetNewPw')?.value;
      const confirmPw = document.getElementById('adminResetConfirmPw')?.value;
      const adminPw = document.getElementById('adminResetAdminPw')?.value;
      const alertEl = document.getElementById('adminResetAlert');
      const btn = document.getElementById('btnSubmitAdminReset');

      function showResetAlert(msg, isError) {
        if (alertEl) {
          alertEl.className = `p-2.5 rounded-lg text-xs border ${isError ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`;
          alertEl.textContent = msg;
        }
      }

      if (!targetUser) return showResetAlert('Pilih akun PIC terlebih dahulu', true);
      if (!newPw || newPw.length < 4) return showResetAlert('Password baru minimal 4 karakter', true);
      if (newPw !== confirmPw) return showResetAlert('Konfirmasi password tidak cocok', true);
      if (!adminPw) return showResetAlert('Password admin wajib diisi untuk verifikasi', true);

      const currentUser = state.currentUser || JSON.parse(localStorage.getItem('telecom_portal_user') || '{}');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mereset di Firebase...';
      try {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) {
          throw new Error('Koneksi Google Firebase belum aktif.');
        }

        // Verify admin password against Firebase
        await window.FirebaseManager.loginUser(currentUser.username, adminPw);

        // Perform reset on target user in Firebase
        const res = await window.FirebaseManager.adminResetPassword(targetUser, newPw);
        showResetAlert(res.message, false);
        showToast(res.message, 'success');
        ['adminResetNewPw','adminResetConfirmPw','adminResetAdminPw'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = '';
        });
      } catch (err) {
        showResetAlert(err.message || 'Gagal mereset kata sandi', true);
        showToast(err.message || 'Gagal mereset kata sandi', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate-right mr-1"></i> Reset Password';
      }
    });

    // Admin: Hapus Akun
    document.getElementById('btnSubmitAdminDelete')?.addEventListener('click', async () => {
      const targetUser = document.getElementById('adminDeleteTargetUser')?.value;
      const adminPw = document.getElementById('adminDeleteAdminPw')?.value;
      const alertEl = document.getElementById('adminDeleteAlert');
      const btn = document.getElementById('btnSubmitAdminDelete');

      function showDeleteAlert(msg, isError) {
        if (alertEl) {
          alertEl.className = `p-2.5 rounded-lg text-xs border ${isError ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`;
          alertEl.textContent = msg;
        }
      }

      if (!targetUser) return showDeleteAlert('Pilih akun yang akan dihapus', true);
      if (!adminPw) return showDeleteAlert('Password admin wajib diisi', true);

      if (!confirm(`Yakin ingin menghapus akun @${targetUser}? Tindakan ini tidak dapat dibatalkan.`)) return;

      const currentUser = state.currentUser || JSON.parse(localStorage.getItem('telecom_portal_user') || '{}');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menghapus di Firebase...';
      try {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) {
          throw new Error('Koneksi Google Firebase belum aktif.');
        }

        // Verify admin password against Firebase
        await window.FirebaseManager.loginUser(currentUser.username, adminPw);

        // Delete user in Firebase
        const res = await window.FirebaseManager.deleteUser(targetUser);
        showDeleteAlert(res.message, false);
        showToast(res.message, 'success');
        const adminPwInput = document.getElementById('adminDeleteAdminPw');
        if (adminPwInput) adminPwInput.value = '';
        loadAdminUserList(); // Refresh dropdown
      } catch (err) {
        showDeleteAlert(err.message || 'Gagal menghapus akun', true);
        showToast(err.message || 'Gagal menghapus akun', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-user-minus mr-1"></i> Hapus Akun Ini';
      }
    });

    // Admin: Role Change auto-fills default Team Role
    document.getElementById('adminCreateRole')?.addEventListener('change', (e) => {
      const teamRoleInput = document.getElementById('adminCreateTeamRole');
      if (teamRoleInput) {
        if (e.target.value === 'admin') {
          teamRoleInput.value = 'Administrator';
          teamRoleInput.placeholder = 'misal: Administrator / Head of Ops';
        } else {
          teamRoleInput.value = 'Teknisi Lapangan';
          teamRoleInput.placeholder = 'misal: Teknisi Lapangan / Staff SITAC';
        }
      }
    });

    // Admin: Auto-suggest email dari Nama Lengkap PIC
    (function setupEmailAutoSuggest() {
      const displayNameInput = document.getElementById('adminCreateDisplayName');
      const usernameInput    = document.getElementById('adminCreateUsername');
      const emailInput       = document.getElementById('adminCreateEmail');
      const btnAutoFill      = document.getElementById('btnAutoFillEmail');
      const hintEl           = document.getElementById('adminCreateEmailHint');
      const hintText         = document.getElementById('adminCreateEmailHintText');

      function generateEmailSuggestion(name) {
        if (!name) return '';
        // Buat email dari nama: "Budi Rodiyah" → "budi.rodiyah@telecom.ops"
        return name.trim().toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')   // hapus karakter selain huruf & angka
          .trim()
          .split(/\s+/)
          .join('.') + '@telecom.ops';
      }

      function updateEmailSuggest() {
        if (!displayNameInput || !emailInput || !btnAutoFill || !hintEl || !hintText) return;
        const name = displayNameInput.value.trim();
        const currentEmail = emailInput.value.trim();
        if (!name) {
          btnAutoFill.classList.add('hidden');
          hintEl.classList.add('hidden');
          return;
        }
        const suggested = generateEmailSuggestion(name);
        if (currentEmail && currentEmail === suggested) {
          btnAutoFill.classList.add('hidden');
        } else {
          btnAutoFill.classList.remove('hidden');
        }
        hintText.textContent = `Saran: ${suggested}`;
        hintEl.classList.remove('hidden');
      }

      displayNameInput?.addEventListener('input', updateEmailSuggest);

      btnAutoFill?.addEventListener('click', () => {
        const name = displayNameInput?.value.trim();
        if (!name || !emailInput) return;
        const suggested = generateEmailSuggestion(name);
        emailInput.value = suggested;
        emailInput.focus();
        btnAutoFill.classList.add('hidden');
        if (hintText) hintText.textContent = `Email diisi otomatis: ${suggested}`;
      });

      // Jika username terisi nama orang (ada spasi / huruf kapital), tampilkan hint juga
      usernameInput?.addEventListener('input', () => {
        const val = usernameInput.value;
        const looksLikeName = /[A-Z\s]/.test(val) || val.includes(' ');
        if (looksLikeName) {
          const converted = val.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          if (converted !== val) {
            usernameInput.style.borderColor = 'rgba(245,158,11,0.5)';
            usernameInput.title = `Saran username: "${converted}" (hanya huruf kecil, angka, _)`;
          }
        } else {
          usernameInput.style.borderColor = '';
          usernameInput.title = '';
        }
      });

      const roleSelectEl = document.getElementById('adminCreateRole');
      const teamRoleInputEl = document.getElementById('adminCreateTeamRole');
      roleSelectEl?.addEventListener('change', () => {
        const val = roleSelectEl.value;
        if (teamRoleInputEl) {
          if (val === 'admin') teamRoleInputEl.value = 'Administrator';
          else if (val === 'sales') teamRoleInputEl.value = 'Sales / Account Executive';
          else teamRoleInputEl.value = 'Teknisi Lapangan';
        }
      });
    })();

    // Admin: Submit Pembuatan Akun Baru (Admin / Sales / PIC)
    document.getElementById('formAdminCreateUser')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('adminCreateUsername');
      const displayNameInput = document.getElementById('adminCreateDisplayName');
      const roleSelect = document.getElementById('adminCreateRole');
      const teamRoleInput = document.getElementById('adminCreateTeamRole');
      const emailInput = document.getElementById('adminCreateEmail');
      const passwordInput = document.getElementById('adminCreatePassword');
      const confirmPasswordInput = document.getElementById('adminCreateConfirmPassword');
      const adminPwInput = document.getElementById('adminCreateAdminPw');
      const alertEl = document.getElementById('adminCreateAlert');
      const submitBtn = document.getElementById('btnSubmitAdminCreateUser');

      function showCreateAlert(msg, isError) {
        if (alertEl) {
          alertEl.className = `p-2.5 rounded-lg text-xs border ${isError ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`;
          alertEl.textContent = msg;
          alertEl.classList.remove('hidden');
        }
      }

      const username = (usernameInput?.value || '').trim().toLowerCase();
      const displayName = (displayNameInput?.value || '').trim();
      const role = roleSelect?.value || 'pic';
      const teamRole = (teamRoleInput?.value || '').trim();
      const email = (emailInput?.value || '').trim().toLowerCase();
      const password = passwordInput?.value || '';
      const confirmPassword = confirmPasswordInput?.value || '';
      const adminPw = adminPwInput?.value || '';

      if (!username || !displayName || !password || !confirmPassword || !adminPw) {
        return showCreateAlert('Semua kolom bertanda * wajib diisi.', true);
      }
      if (username.length < 3) {
        return showCreateAlert('Username minimal 3 karakter.', true);
      }
      if (!/^[a-z0-9_]+$/.test(username)) {
        return showCreateAlert('Username hanya boleh menggunakan huruf kecil, angka, dan underscore (_).', true);
      }
      if (password.length < 4) {
        return showCreateAlert('Password baru minimal 4 karakter.', true);
      }
      if (password !== confirmPassword) {
        return showCreateAlert('Konfirmasi password tidak cocok dengan password baru.', true);
      }

      // Verifikasi identitas admin yang sedang aktif
      const curAdmin = state.currentUser?.username || 'admin';
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Membuat Akun...';

      try {
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          // Validasi kredensial admin requester terlebih dahulu
          try {
            await window.FirebaseManager.loginUser(curAdmin, adminPw);
          } catch (pwErr) {
            throw new Error('Password admin Anda salah. Otorisasi pembuatan akun ditolak.');
          }

          const res = await window.FirebaseManager.adminCreateUser({
            username: username,
            full_name: displayName,
            role: role,
            team_role: teamRole,
            email: email,
            password: password
          }, curAdmin);

          showCreateAlert(res.message, false);
          showToast(res.message, 'success');
        } else {
          // Fallback backend SQLite
          const res = await fetch('/api/auth/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              admin_username: curAdmin,
              admin_password: adminPw,
              username: username,
              full_name: displayName,
              role: role === 'admin' ? 'admin' : 'lapangan',
              team_role: teamRole,
              email: email,
              password: password
            })
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || 'Gagal membuat akun');
          showCreateAlert(d.message, false);
          showToast(d.message, 'success');
        }

        // Reset inputs on success
        if (usernameInput) usernameInput.value = '';
        if (displayNameInput) displayNameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';
        if (adminPwInput) adminPwInput.value = '';

        // Refresh dropdown user list di tab Reset & Hapus
        await loadAdminUserList();
      } catch (err) {
        showCreateAlert(err.message || 'Gagal membuat akun', true);
        showToast(err.message || 'Gagal membuat akun', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-user-plus mr-1.5"></i> Buat Akun Sekarang';
      }
    });

    // =====================================================================
    // ADMIN: TAB KELOLA EMAIL PIC (PANEL EMAIL)
    // =====================================================================

    // Helper: load daftar email semua PIC dan statusnya ke Tab Email Admin
    async function loadAdminEmailPICList() {
      const selectEmail = document.getElementById('adminEmailTargetUser');
      const listContainer = document.getElementById('adminEmailPicListContainer');
      const countEl = document.getElementById('adminEmailSummaryCount');
      const alertBox = document.getElementById('adminEmailAlert');
      if (alertBox) alertBox.className = 'p-2.5 rounded-lg text-xs hidden';

      if (listContainer) {
        listContainer.innerHTML = `
          <div class="text-center py-4 text-slate-400 text-xs">
            <i class="fa-solid fa-spinner fa-spin mr-1.5 text-cyan-400"></i> Memuat daftar email PIC...
          </div>
        `;
      }

      try {
        let users = [];
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          users = await window.FirebaseManager.fetchCollection('users');
        }
        if (!users || users.length === 0) {
          const res = await fetch('/api/auth/registered-pics');
          if (res.ok) {
            const data = await res.json();
            users = data.pics || [];
          }
        }

        const picUsers = users.filter(u => u.status !== 'pending' && u.status !== 'rejected');
        picUsers.sort((a, b) => (a.full_name || a.username).localeCompare(b.full_name || b.username));

        const withEmailCount = picUsers.filter(u => !!u.email).length;
        if (countEl) {
          countEl.textContent = `${picUsers.length} Akun (${withEmailCount} punya email, ${picUsers.length - withEmailCount} belum)`;
        }

        // Update select
        const opts = picUsers.map(p => {
          const roleTag = (p.role === 'admin') ? '[ADMIN] ' : (p.role === 'sales' ? '[SALES] ' : '[PIC] ');
          const emailStatus = p.email ? `(${p.email})` : '• [Belum Ada Email]';
          return `<option value="${p.username}" data-name="${p.full_name || p.username}" data-email="${p.email || ''}">${roleTag}${p.full_name || p.username} (@${p.username}) ${emailStatus}</option>`;
        }).join('');
        if (selectEmail) {
          const curVal = selectEmail.value;
          selectEmail.innerHTML = `<option value="">-- Pilih Akun Teknisi PIC --</option>${opts}`;
          if (curVal) selectEmail.value = curVal;
        }

        if (listContainer) {
          if (picUsers.length === 0) {
            listContainer.innerHTML = `<div class="text-center py-4 text-slate-400 text-xs">Belum ada akun PIC terdaftar.</div>`;
            return;
          }

          listContainer.innerHTML = picUsers.map(u => {
            const hasEmail = Boolean(u.email);
            const badgeClass = hasEmail ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            const badgeText = hasEmail ? u.email : 'Belum Ada Email';
            let iconClass = 'fa-helmet-safety text-emerald-400';
            if (u.role === 'admin') iconClass = 'fa-shield-halved text-cyan-400';
            else if (u.role === 'sales') iconClass = 'fa-chart-line text-amber-400';
            return `
              <div class="p-2.5 rounded-lg bg-slate-900/90 border border-white/5 flex items-center justify-between gap-2.5 hover:border-white/10 transition">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center shrink-0 text-xs">
                    <i class="fa-solid ${iconClass}"></i>
                  </div>
                  <div class="min-w-0 truncate">
                    <div class="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                      <span>${u.full_name || u.username}</span>
                      <span class="text-[10px] text-slate-500 font-mono">@${u.username}</span>
                    </div>
                    <div class="text-[11px] truncate mt-0.5">
                      <span class="font-mono text-[10px] px-1.5 py-0.2 rounded border ${badgeClass}">
                        ${badgeText}
                      </span>
                    </div>
                  </div>
                </div>
                <button type="button" class="btn btn-sm text-[11px] px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold shrink-0"
                  onclick="window.selectAdminEmailUser('${u.username}')">
                  <i class="fa-solid fa-pen-to-square mr-1"></i>${hasEmail ? 'Ubah' : 'Isi Email'}
                </button>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        console.warn('Error loadAdminEmailPICList:', err);
        if (listContainer) {
          listContainer.innerHTML = `<div class="text-center py-4 text-rose-400 text-xs">Gagal memuat: ${err.message || 'Error'}</div>`;
        }
      }
    }

    // Helper global untuk klik tombol "Isi Email" di baris daftar PIC
    window.selectAdminEmailUser = function(username) {
      const select = document.getElementById('adminEmailTargetUser');
      if (select) {
        select.value = username;
        select.dispatchEvent(new Event('change'));
        const input = document.getElementById('adminEmailInput');
        if (input) {
          input.focus();
          input.select();
        }
      }
    };

    // Event saat dropdown pilih akun PIC di Tab Email berubah
    document.getElementById('adminEmailTargetUser')?.addEventListener('change', (e) => {
      const select = e.target;
      const val = select.value;
      const card = document.getElementById('adminEmailSelectedCard');
      const cardFullName = document.getElementById('adminEmailCardFullName');
      const cardUsername = document.getElementById('adminEmailCardUsername');
      const cardCurrentEmail = document.getElementById('adminEmailCardCurrentEmail');
      const cardStatusBadge = document.getElementById('adminEmailCardStatusBadge');
      const emailInput = document.getElementById('adminEmailInput');
      const btnSuggest = document.getElementById('btnAdminEmailAutoSuggest');
      const hintEl = document.getElementById('adminEmailSuggestHint');

      if (!val) {
        if (card) card.classList.add('hidden');
        if (btnSuggest) btnSuggest.classList.add('hidden');
        if (hintEl) hintEl.classList.add('hidden');
        if (emailInput) emailInput.value = '';
        return;
      }

      const opt = select.selectedOptions[0];
      const name = opt?.getAttribute('data-name') || val;
      const email = opt?.getAttribute('data-email') || '';

      if (card) card.classList.remove('hidden');
      if (cardFullName) cardFullName.textContent = name;
      if (cardUsername) cardUsername.textContent = `@${val}`;
      if (cardCurrentEmail) cardCurrentEmail.textContent = email || 'Belum Ada';
      if (cardStatusBadge) {
        if (email) {
          cardStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
          cardStatusBadge.textContent = 'Sudah Ada Email';
        } else {
          cardStatusBadge.className = 'text-[10px] px-2 py-0.5 rounded font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30';
          cardStatusBadge.textContent = 'Belum Ada Email';
        }
      }

      if (emailInput) {
        emailInput.value = email;
      }

      const suggested = name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).join('.') + '@telecom.ops';
      if (btnSuggest) {
        btnSuggest.classList.remove('hidden');
      }
      if (hintEl) {
        hintEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles mr-1 text-cyan-400"></i> Saran email otomatis: <span class="font-mono text-cyan-300">${suggested}</span>`;
        hintEl.classList.remove('hidden');
      }
    });

    // Auto-suggest email dari nama PIC yang dipilih
    document.getElementById('btnAdminEmailAutoSuggest')?.addEventListener('click', () => {
      const select = document.getElementById('adminEmailTargetUser');
      const opt = select?.selectedOptions[0];
      const name = opt?.getAttribute('data-name') || select?.value;
      if (!name) return;
      const suggested = name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).join('.') + '@telecom.ops';
      const emailInput = document.getElementById('adminEmailInput');
      if (emailInput) {
        emailInput.value = suggested;
        emailInput.focus();
      }
    });

    // Submit simpan / perbarui email PIC oleh Admin
    document.getElementById('btnSubmitAdminUpdateEmail')?.addEventListener('click', async () => {
      const targetUser = document.getElementById('adminEmailTargetUser')?.value;
      const newEmail = document.getElementById('adminEmailInput')?.value.trim().toLowerCase();
      const alertEl = document.getElementById('adminEmailAlert');
      const btn = document.getElementById('btnSubmitAdminUpdateEmail');

      function showAlert(msg, isErr) {
        if (alertEl) {
          alertEl.className = `p-2.5 rounded-lg text-xs border ${isErr ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`;
          alertEl.textContent = msg;
          alertEl.classList.remove('hidden');
        }
      }

      if (!targetUser) return showAlert('Pilih akun PIC terlebih dahulu.', true);
      if (!newEmail || !newEmail.includes('@') || !newEmail.includes('.')) {
        return showAlert('Format email tidak valid. Masukkan email lengkap seperti nama@telecom.ops', true);
      }

      const curAdmin = state.currentUser?.username || 'admin';
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...';

      try {
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          const res = await window.FirebaseManager.updateUserEmail(targetUser, newEmail, curAdmin);
          showAlert(res.message, false);
          showToast(res.message, 'success');
        } else {
          const res = await fetch('/api/auth/update-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: targetUser, email: newEmail })
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || 'Gagal menyimpan email');
          showAlert(d.message, false);
          showToast(d.message, 'success');
        }

        // Jika target user adalah user yang sedang login, update state & badge
        if (state.currentUser?.username?.toLowerCase() === targetUser.toLowerCase()) {
          state.currentUser.email = newEmail;
          localStorage.setItem('telecom_portal_user', JSON.stringify(state.currentUser));
          updateUserEmailBadges();
        }

        await loadAdminEmailPICList();
        await loadAdminUserList();
      } catch (err) {
        showAlert(err.message || 'Gagal menyimpan email', true);
        showToast(err.message || 'Gagal menyimpan email', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1.5"></i> Simpan Email Akun';
      }
    });

    const logoutBtn = document.getElementById('btnLogout');
    logoutBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      logoutBtn.classList.remove('anim-logout-click');
      void logoutBtn.offsetWidth; // trigger reflow
      logoutBtn.classList.add('anim-logout-click');
      setTimeout(() => {
        logoutBtn.classList.remove('anim-logout-click');
        performLogout();
      }, 220);
    });

    // 1. Sidebar Nav Click & Any [data-view] Buttons
    document.querySelectorAll('.nav-item, [data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const viewId = btn.getAttribute('data-view');
        if (!viewId) return;
        if (window.innerWidth < 1024) {
          toggleMobileSidebar(false);
        }
        switchView(viewId);
      });
    });

    // 1a. Listen for browser hash change (back/forward button & direct URL hash)
    window.addEventListener('hashchange', () => {
      const resolved = resolveViewIdFromHash(window.location.hash);
      if (resolved && resolved !== state.activeView) {
        switchView(resolved);
      }
    });

    // 1b. Sidebar Submenu Dropdown Accordion Toggle
    document.querySelectorAll('.section-dropdown-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const group = btn.closest('.nav-section-group');
        if (group) {
          group.classList.toggle('collapsed');
        }
      });
    });

    // 1c. Mobile Sidebar Toggle Button, Backdrop, Close Button, and Menu
    const toggleMobileSidebar = (forceState) => {
      const sidebar = document.getElementById('portalSidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (!sidebar) return;
      const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('mobile-open');
      sidebar.classList.toggle('mobile-open', isOpen);
      if (backdrop) {
        backdrop.classList.toggle('active', isOpen);
      }
    };

    document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => toggleMobileSidebar());
    document.getElementById('btnCloseSidebarMobile')?.addEventListener('click', () => toggleMobileSidebar(false));
    document.getElementById('sidebarBackdrop')?.addEventListener('click', () => toggleMobileSidebar(false));
    document.getElementById('btnMobMenu')?.addEventListener('click', () => toggleMobileSidebar());

    // 1d. Mobile Bottom Navigation Bar Events
    document.querySelectorAll('.mobile-nav-btn[data-mobile-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-mobile-view');
        toggleMobileSidebar(false);
        switchView(viewId);
      });
    });

    document.getElementById('btnMobAddData')?.addEventListener('click', () => {
      toggleMobileSidebar(false);
      const pickModal = document.getElementById('modalPickAddType');
      if (pickModal) {
        pickModal.style.display = 'flex';
      }
    });

    // 1e. Mobile Chart Accordion Toggles
    const setupChartToggle = (btnId, containerId, chevronId, labelId) => {
      const btn = document.getElementById(btnId);
      const container = document.getElementById(containerId);
      const chevron = document.getElementById(chevronId);
      const label = document.getElementById(labelId);
      if (!btn || !container) return;

      btn.addEventListener('click', () => {
        const isHidden = container.classList.contains('hidden');
        if (isHidden) {
          container.classList.remove('hidden');
          chevron?.classList.add('rotate-180');
          if (label) label.textContent = 'Tutup Grafik';
        } else {
          container.classList.add('hidden');
          chevron?.classList.remove('rotate-180');
          if (label) label.textContent = 'Buka Grafik';
        }
      });
    };

    setupChartToggle('btnToggleSitacCharts', 'sitacChartsContainer', 'sitacChartsChevron', 'sitacChartsToggleLabel');
    setupChartToggle('btnToggleGangguanCharts', 'gangguanChartsContainer', 'gangguanChartsChevron', 'gangguanChartsToggleLabel');

    document.getElementById('clearwaveFloatingFab')?.addEventListener('click', () => {
      const sidebar = document.getElementById('portalSidebar');
      if (window.innerWidth < 1024 && sidebar) {
        toggleMobileSidebar();
      } else {
        const bodyEl = document.querySelector('.portal-content-body') || window;
        bodyEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    // 2. Theme Toggle (Supports both sidebar button and topbar segmented switcher)
    const applyThemeChange = (newTheme) => {
      state.theme = newTheme;
      localStorage.setItem('portal_theme', state.theme);
      initTheme();
      getChartTheme();

      // Cleanly destroy all existing charts so any view recreated or switched to uses current theme colors & borders
      Object.keys(charts).forEach(key => {
        try { destroyChart(key); } catch (e) {}
      });

      if (state.activeView === 'view-executive') loadExecutiveSummary();
      else if (state.activeView === 'view-collo-list') loadColloData();
      else if (state.activeView === 'view-collo-rev-sharing') loadRevSharingData();
      else if (state.activeView === 'view-collo-alerts') loadAlertsData();
      else if (state.activeView === 'view-sitac-pa') loadSitacData();
      else if (state.activeView === 'view-gangguan') loadGangguanData();
      else if (state.activeView === 'view-efisiensi') loadEfisiensiData();
      else if (state.activeView === 'view-pic-matrix') loadPicMatrixData();
      if (leafletMap) {
        leafletMap.remove();
        leafletMap = null;
        initWebgisMap();
      }
    };
    window.applyThemeChange = applyThemeChange;

    const themeBtn = document.getElementById('themeToggleBtn');
    themeBtn?.addEventListener('click', () => {
      themeBtn.classList.remove('anim-theme-click');
      void themeBtn.offsetWidth; // trigger reflow
      themeBtn.classList.add('anim-theme-click');
      setTimeout(() => {
        themeBtn.classList.remove('anim-theme-click');
      }, 550);
      applyThemeChange(state.theme === 'dark' ? 'light' : 'dark');
    });


    // 2b. Card 1 Info Popover Handler (100% contained within Card 1, cannot be covered by Card 2)
    const btnTip = document.getElementById('btnColloInfoTip');
    const popoverTip = document.getElementById('popoverColloInfo');
    const btnCloseTip = document.getElementById('btnCloseColloInfo');

    if (btnTip && popoverTip) {
      let closeTimeout = null;

      const showPopover = () => {
        if (closeTimeout) clearTimeout(closeTimeout);
        popoverTip.classList.remove('hidden');
      };

      const hidePopover = () => {
        closeTimeout = setTimeout(() => {
          popoverTip.classList.add('hidden');
        }, 250);
      };

      btnTip.addEventListener('click', (e) => {
        e.stopPropagation();
        popoverTip.classList.toggle('hidden');
      });

      btnTip.addEventListener('mouseenter', showPopover);
      btnTip.addEventListener('mouseleave', hidePopover);

      popoverTip.addEventListener('mouseenter', () => {
        if (closeTimeout) clearTimeout(closeTimeout);
      });
      popoverTip.addEventListener('mouseleave', hidePopover);

      btnCloseTip?.addEventListener('click', (e) => {
        e.stopPropagation();
        popoverTip.classList.add('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!popoverTip.contains(e.target) && e.target !== btnTip) {
          popoverTip.classList.add('hidden');
        }
      });
    }

    // 2c. Executive Greeting Helper
    const updateExecutiveGreeting = () => {
      const greetingTitleEl = document.getElementById('execGreetingTitle');
      const dateEl = document.getElementById('execCurrentDateDisplay');
      const hour = new Date().getHours();
      let salam = 'Selamat Datang,';
      if (hour >= 4 && hour < 11) salam = 'Selamat Pagi,';
      else if (hour >= 11 && hour < 15) salam = 'Selamat Siang,';
      else if (hour >= 15 && hour < 18) salam = 'Selamat Sore,';
      else salam = 'Selamat Malam,';

      const rawUser = state.currentUser?.full_name || state.currentUser?.username || 'Administrator';
      const cleanUser = rawUser.replace(/\s*\([^)]*\)/g, '').trim();
      if (greetingTitleEl) {
        greetingTitleEl.innerHTML = `${salam} <span class="text-cyan-400 font-bold" id="execGreetingName">${escapeHtml(cleanUser)}</span>`;
      }
      if (dateEl) {
        try {
          dateEl.textContent = new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
        } catch (e) {
          dateEl.textContent = new Date().toDateString();
        }
      }
    };
    updateExecutiveGreeting();

    // 3. Quick Export Buttons & Dropdowns
    document.getElementById('btnExportExcel')?.addEventListener('click', () => exportCurrentViewExcel());
    document.getElementById('btnExportColloExcel')?.addEventListener('click', () => exportCurrentViewExcel('collo'));
    document.getElementById('btnExportSitacExcel')?.addEventListener('click', () => exportCurrentViewExcel('sitac'));
    document.getElementById('btnExportGangguanExcel')?.addEventListener('click', () => exportCurrentViewExcel('gangguan'));

    document.getElementById('btnQuickExport')?.addEventListener('click', exportCurrentView);

    // Active Technician Identity Selector & My Tasks Filter Listeners
    const techSelect = document.getElementById('selectActiveTechnician');
    if (techSelect) {
      techSelect.value = state.activeTechnician || 'Harlan';
      techSelect.addEventListener('change', (e) => {
        // Enforce PIC locking: non-admin cannot change identity casually ("tidak bisa gonta ganti user seenaknya")
        if (state.currentUser && state.currentUser.role === 'lapangan') {
          showToast('Identitas PIC terkunci sesuai akun login Anda. Silakan keluar untuk ganti akun.', 'warning');
          techSelect.value = state.currentUser.pic_code || 'Harlan';
          return;
        }
        state.activeTechnician = e.target.value;
        localStorage.setItem('telecom_active_technician', state.activeTechnician);
        showToast(`Filter identitas teknisi aktif: ${state.activeTechnician}`);
        if (state.myTasksOnlyGangguan) loadGangguanData();
        if (state.myTasksOnlySitac) {
          state.sitac.page = 1;
          loadSitacData();
        }
      });
    }

    const btnGMyTasks = document.getElementById('btnGangguanMyTasks');
    btnGMyTasks?.addEventListener('click', () => {
      if (state.currentUser?.role === 'admin') return;
      state.myTasksOnlyGangguan = !state.myTasksOnlyGangguan;
      btnGMyTasks.classList.toggle('active', state.myTasksOnlyGangguan);
      loadGangguanData();
      if (state.myTasksOnlyGangguan) {
        showToast(`Memfilter gangguan penugasan: ${state.activeTechnician}`);
      } else {
        showToast('Menampilkan seluruh tiket gangguan');
      }
    });

    const btnSMyTasks = document.getElementById('btnSitacMyTasks');
    btnSMyTasks?.addEventListener('click', () => {
      if (state.currentUser?.role === 'admin') return;
      state.myTasksOnlySitac = !state.myTasksOnlySitac;
      btnSMyTasks.classList.toggle('active', state.myTasksOnlySitac);
      state.sitac.page = 1;
      loadSitacData();
      if (state.myTasksOnlySitac) {
        showToast(`Memfilter proyek SITAC penugasan: ${state.activeTechnician}`);
      } else {
        showToast('Menampilkan seluruh penugasan SITAC');
      }
    });

    const btnExportPdf = document.getElementById('btnExportPdf');
    const exportPdfMenu = document.getElementById('exportPdfMenu');
    btnExportPdf?.addEventListener('click', (e) => {
      e.stopPropagation();
      exportPdfMenu?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#exportPdfDropdownContainer')) {
        exportPdfMenu?.classList.add('hidden');
      }
    });

    document.getElementById('btnExportCurrentModulePdf')?.addEventListener('click', () => {
      exportPdfMenu?.classList.add('hidden');
      exportCurrentViewPdf();
    });

    // Inline Table Toolbar Export Buttons
    document.getElementById('btnExportColloPdf')?.addEventListener('click', exportCurrentViewPdf);
    document.getElementById('btnExportSitacPdf')?.addEventListener('click', exportCurrentViewPdf);
    document.getElementById('btnExportColleaguesPdf')?.addEventListener('click', exportCurrentViewPdf);
    document.getElementById('btnExportEfisiensiPdf')?.addEventListener('click', exportCurrentViewPdf);
    document.getElementById('btnExportColleaguesExcel')?.addEventListener('click', () => exportCurrentViewExcel('colleagues'));

    document.getElementById('btnDownloadMasterPdf')?.addEventListener('click', () => {
      exportPdfMenu?.classList.add('hidden');
      showToast('Mengunduh Laporan Master PDF...');
    });

    document.getElementById('btnExportPicMatrix')?.addEventListener('click', exportPicMatrixCsv);
    document.getElementById('btnExportEfisiensi')?.addEventListener('click', exportEfisiensiCsv);

    // Initial check of export menu visibility based on initial view
    if (typeof updateExportMenuVisibility === 'function') {
      updateExportMenuVisibility(state.activeView);
    }

    // 4. View 2 (Collo) Controls
    document.querySelectorAll('.collo-status-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.collo-status-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.collo.status = btn.getAttribute('data-status');
        state.collo.page = 1;
        loadColloData();
      });
    });

    const colloSearch = document.getElementById('colloSearchInput');
    let colloSearchTimer = null;
    colloSearch?.addEventListener('input', (e) => {
      clearTimeout(colloSearchTimer);
      colloSearchTimer = setTimeout(() => {
        state.collo.search = e.target.value;
        state.collo.page = 1;
        loadColloData();
      }, 300);
    });

    document.getElementById('colloFilterJenis')?.addEventListener('change', (e) => {
      state.collo.jenisSewa = e.target.value;
      state.collo.page = 1;
      loadColloData();
    });

    document.getElementById('colloFilterPengelola')?.addEventListener('change', (e) => {
      state.collo.pengelola = e.target.value;
      state.collo.page = 1;
      loadColloData();
    });

    document.getElementById('colloSortSelect')?.addEventListener('change', (e) => {
      state.collo.sort = e.target.value;
      loadColloData();
    });

    // Helper to scroll table smoothly to top on pagination / page change
    function scrollTableToTop(cardSelector) {
      const card = document.querySelector(cardSelector);
      const scrollContainer = document.querySelector('.portal-content-body');
      if (card && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const targetScroll = scrollContainer.scrollTop + (cardRect.top - containerRect.top) - 16;
        scrollContainer.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
      } else if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    document.getElementById('colloPrevPageBtn')?.addEventListener('click', () => {
      if (state.collo.page > 1) {
        state.collo.page--;
        scrollTableToTop('#view-collo-list .table-container-card');
        loadColloData().then(() => {
          scrollTableToTop('#view-collo-list .table-container-card');
        });
      }
    });

    document.getElementById('colloNextPageBtn')?.addEventListener('click', () => {
      state.collo.page++;
      scrollTableToTop('#view-collo-list .table-container-card');
      loadColloData().then(() => {
        scrollTableToTop('#view-collo-list .table-container-card');
      });
    });

    // 5. View 3 (Rev Sharing) Controls
    const rsSearch = document.getElementById('revShareSearchInput');
    let rsTimer = null;
    rsSearch?.addEventListener('input', (e) => {
      clearTimeout(rsTimer);
      rsTimer = setTimeout(() => {
        state.revSharing.search = e.target.value;
        loadRevSharingData();
      }, 300);
    });

    // 6. View 4 (Alerts) Controls
    document.querySelectorAll('.alert-filter-card').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.alert-filter-card').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.alerts.category = btn.getAttribute('data-alert-cat');
        loadAlertsData();
      });
    });

    const alertSearch = document.getElementById('alertSearchInput');
    let alertTimer = null;
    alertSearch?.addEventListener('input', (e) => {
      clearTimeout(alertTimer);
      alertTimer = setTimeout(() => {
        state.alerts.search = e.target.value;
        loadAlertsData();
      }, 300);
    });

    const alertStatusSelect = document.getElementById('alertStatusFilter');
    alertStatusSelect?.addEventListener('change', (e) => {
      state.alerts.status = e.target.value;
      loadAlertsData();
    });

    // 7. View 5 (SITAC) Controls
    document.querySelectorAll('.sitac-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sitac-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.sitac.status = btn.getAttribute('data-status');
        state.sitac.page = 1;
        loadSitacData();
      });
    });

    const sitacSearch = document.getElementById('sitacSearchInput');
    const btnClearSitac = document.getElementById('btnClearSitacSearch');
    let sitacTimer = null;
    sitacSearch?.addEventListener('input', (e) => {
      if (btnClearSitac) {
        btnClearSitac.classList.toggle('hidden', !e.target.value);
      }
      clearTimeout(sitacTimer);
      sitacTimer = setTimeout(() => {
        state.sitac.search = e.target.value;
        state.sitac.page = 1;
        loadSitacData();
      }, 300);
    });
    btnClearSitac?.addEventListener('click', () => {
      if (sitacSearch) {
        sitacSearch.value = '';
        btnClearSitac.classList.add('hidden');
        sitacSearch.focus();
        state.sitac.search = '';
        state.sitac.page = 1;
        loadSitacData();
      }
    });

    document.getElementById('sitacFilterPic')?.addEventListener('change', (e) => {
      state.sitac.pic = e.target.value;
      state.sitac.page = 1;
      loadSitacData();
    });
    document.getElementById('sitacFilterAging')?.addEventListener('change', (e) => {
      state.sitac.aging = e.target.value;
      state.sitac.page = 1;
      loadSitacData();
    });
    function applySitacDatePreset(preset) {
      state.sitac.datePreset = preset || 'ALL';

      const selected = String(preset || 'ALL').split(',').map(s => s.trim()).filter(Boolean);
      const isAll = selected.length === 0 || selected.includes('ALL');

      syncDatePresetButtons('sitacDatePresets', preset);
      updateYearDropdownSelection('sitacFilterYear', preset);

      const inpStart = document.getElementById('sitacStartDate');
      const inpEnd = document.getElementById('sitacEndDate');

      if (isAll) {
        state.sitac.startDate = '';
        state.sitac.endDate = '';
        state.sitac.year = 'ALL';
        if (inpStart) inpStart.value = '';
        if (inpEnd) inpEnd.value = '';
      } else if (selected.length === 1) {
        const p = selected[0];
        const today = new Date();
        const curYear = today.getFullYear();
        const curMonth = today.getMonth();
        let start = '', end = '';

        if (p === 'THIS_MONTH') {
          start = new Date(curYear, curMonth, 1).toISOString().slice(0, 10);
          end = new Date(curYear, curMonth + 1, 0).toISOString().slice(0, 10);
        } else if (p === 'LAST_MONTH') {
          start = new Date(curYear, curMonth - 1, 1).toISOString().slice(0, 10);
          end = new Date(curYear, curMonth, 0).toISOString().slice(0, 10);
        } else if (['2024', '2025', '2026'].includes(p)) {
          start = `${p}-01-01`;
          end = `${p}-12-31`;
        }

        state.sitac.startDate = start;
        state.sitac.endDate = end;
        if (['2024', '2025', '2026'].includes(p)) {
          state.sitac.year = p;
        } else {
          state.sitac.year = 'ALL';
        }
        if (inpStart) inpStart.value = start;
        if (inpEnd) inpEnd.value = end;
      } else {
        // Multiple presets selected (e.g. '2025,2026' or 'THIS_MONTH,LAST_MONTH')
        state.sitac.startDate = '';
        state.sitac.endDate = '';
        state.sitac.year = 'ALL';
        if (inpStart) inpStart.value = '';
        if (inpEnd) inpEnd.value = '';
      }

      state.sitac.page = 1;
      scrollTableToTop('#view-sitac-pa .table-container-card');
      loadSitacData();
    }

    // Bind Date Preset buttons with Multi-Select and Toggle-off
    setupDatePresetsMultiSelect('sitacDatePresets', (presetCodes) => {
      applySitacDatePreset(presetCodes);
    });

    // Custom Date Range: Filter button
    document.getElementById('btnApplySitacDate')?.addEventListener('click', () => {
      const start = document.getElementById('sitacStartDate')?.value || '';
      const end = document.getElementById('sitacEndDate')?.value || '';
      const field = document.getElementById('sitacDateField')?.value || 'date_dispos';

      if (start && end && start > end) {
        alert('Tanggal mulai tidak boleh lebih besar dari tanggal akhir!');
        return;
      }

      state.sitac.startDate = start;
      state.sitac.endDate = end;
      state.sitac.dateField = field;
      state.sitac.datePreset = (start || end) ? 'CUSTOM' : 'ALL';

      document.querySelectorAll('#sitacDatePresets .sitac-date-preset-btn').forEach(btn => {
        btn.classList.remove('active');
      });

      state.sitac.page = 1;
      scrollTableToTop('#view-sitac-pa .table-container-card');
      loadSitacData();
    });

    // Custom Date Range: Reset button
    document.getElementById('btnResetSitacDate')?.addEventListener('click', () => {
      applySitacDatePreset('ALL');
    });

    // Quick clear date badge button
    document.getElementById('btnQuickClearDate')?.addEventListener('click', () => {
      applySitacDatePreset('ALL');
    });

    // Date field selection change
    document.getElementById('sitacDateField')?.addEventListener('change', (e) => {
      state.sitac.dateField = e.target.value;
      if (state.sitac.startDate || state.sitac.endDate) {
        state.sitac.page = 1;
        loadSitacData();
      }
    });

    document.getElementById('sitacFilterYear')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'ALL') {
        applySitacDatePreset('ALL');
      } else if (['2024', '2025', '2026'].includes(val)) {
        applySitacDatePreset(val);
      } else if (val.includes(',')) {
        applySitacDatePreset(val);
      } else {
        state.sitac.year = val;
        state.sitac.page = 1;
        loadSitacData();
      }
    });

    // Regional SITAC Filter Tabs with Multi-Select and Toggle-off
    setupRegionalTabsMultiSelect('sitacRegionTabs', (regionCodes) => {
      state.sitac.region = regionCodes;
      state.sitac.page = 1;
      scrollTableToTop('#view-sitac-pa .table-container-card');
      loadSitacData();
    });
    document.getElementById('sitacPrevPageBtn')?.addEventListener('click', () => {
      if (state.sitac.page > 1) {
        state.sitac.page--;
        scrollTableToTop('#view-sitac-pa .table-container-card');
        loadSitacData().then(() => {
          scrollTableToTop('#view-sitac-pa .table-container-card');
        });
      }
    });
    document.getElementById('sitacNextPageBtn')?.addEventListener('click', () => {
      state.sitac.page++;
      scrollTableToTop('#view-sitac-pa .table-container-card');
      loadSitacData().then(() => {
        scrollTableToTop('#view-sitac-pa .table-container-card');
      });
    });

    // 8. View 6 (Gangguan) Controls & Date Filtering
    document.querySelectorAll('.gangguan-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gangguan-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.gangguan.status = btn.getAttribute('data-status');
        loadGangguanData();
      });
    });

    const gSearch = document.getElementById('gangguanSearchInput');
    let gTimer = null;
    gSearch?.addEventListener('input', (e) => {
      clearTimeout(gTimer);
      gTimer = setTimeout(() => {
        state.gangguan.search = e.target.value;
        loadGangguanData();
      }, 300);
    });

    // Helper to format Date object into YYYY-MM-DD
    function toISODateStr(d) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Apply Quick Period for Gangguan
    function applyGangguanQuickPeriod(period) {
      const today = new Date();
      let start = '';
      let end = '';

      if (period === 'today') {
        start = toISODateStr(today);
        end = toISODateStr(today);
      } else if (period === 'last7') {
        const past7 = new Date();
        past7.setDate(today.getDate() - 7);
        start = toISODateStr(past7);
        end = toISODateStr(today);
      } else if (period === 'last30') {
        const past30 = new Date();
        past30.setDate(today.getDate() - 30);
        start = toISODateStr(past30);
        end = toISODateStr(today);
      } else if (period === 'thisMonth') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        start = toISODateStr(firstDay);
        end = toISODateStr(lastDay);
      } else if (period === 'year2024') {
        start = '2024-01-01';
        end = '2024-12-31';
      } else if (period === 'year2025') {
        start = '2025-01-01';
        end = '2025-12-31';
      } else if (period === 'year2026') {
        start = '2026-01-01';
        end = '2026-12-31';
      } else {
        // 'all'
        start = '';
        end = '';
      }

      state.gangguan.quickPeriod = period;
      state.gangguan.startDate = start;
      state.gangguan.endDate = end;
      state.gangguan.exactDate = '';

      const startInput = document.getElementById('gangguanStartDate');
      const endInput = document.getElementById('gangguanEndDate');
      const exactInput = document.getElementById('gangguanExactDate');
      if (startInput) startInput.value = start;
      if (endInput) endInput.value = end;
      if (exactInput) exactInput.value = '';

      document.querySelectorAll('.gangguan-period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-period') === period);
      });

      loadGangguanData();
    }

    // Date Type Selector (Disposisi vs Selesai)
    document.getElementById('gangguanDateType')?.addEventListener('change', (e) => {
      state.gangguan.dateType = e.target.value;
      loadGangguanData();
    });

    // Quick Period Buttons
    document.querySelectorAll('.gangguan-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-period');
        applyGangguanQuickPeriod(p);
      });
    });

    // Date Range (Dari - Sampai)
    const gStartInput = document.getElementById('gangguanStartDate');
    const gEndInput = document.getElementById('gangguanEndDate');
    const onGangguanRangeChange = () => {
      state.gangguan.startDate = gStartInput?.value || '';
      state.gangguan.endDate = gEndInput?.value || '';
      state.gangguan.exactDate = '';
      const exactInput = document.getElementById('gangguanExactDate');
      if (exactInput) exactInput.value = '';

      document.querySelectorAll('.gangguan-period-btn').forEach(b => b.classList.remove('active'));
      state.gangguan.quickPeriod = 'custom';
      loadGangguanData();
    };
    gStartInput?.addEventListener('change', onGangguanRangeChange);
    gEndInput?.addEventListener('change', onGangguanRangeChange);

    // Exact Date Picker (Cari Tanggal Tertentu)
    const gExactInput = document.getElementById('gangguanExactDate');
    gExactInput?.addEventListener('change', (e) => {
      const val = e.target.value;
      state.gangguan.exactDate = val;
      state.gangguan.startDate = '';
      state.gangguan.endDate = '';
      if (gStartInput) gStartInput.value = '';
      if (gEndInput) gEndInput.value = '';

      document.querySelectorAll('.gangguan-period-btn').forEach(b => b.classList.remove('active'));
      state.gangguan.quickPeriod = val ? 'exact' : 'all';
      loadGangguanData();
    });

    // Reset Filter Tanggal
    document.getElementById('btnResetGangguanDate')?.addEventListener('click', () => {
      applyGangguanQuickPeriod('all');
    });

    // 9. View 9 (WebGIS) Controls & Dual-Layer Event Handlers
    // 9a. Layer Visibility Toggles (SITAC vs Circuits)
    document.getElementById('btnToggleSitacLayer')?.addEventListener('click', function() {
      isSitacLayerVisible = !isSitacLayerVisible;
      this.classList.toggle('active', isSitacLayerVisible);
      const group = document.getElementById('sitacPinFiltersGroup');
      if (group) group.style.opacity = isSitacLayerVisible ? '1' : '0.4';
      updateMapMarkers();
    });

    document.getElementById('btnToggleCircuitLayer')?.addEventListener('click', function() {
      isCircuitLayerVisible = !isCircuitLayerVisible;
      this.classList.toggle('active', isCircuitLayerVisible);
      const group = document.getElementById('circuitFiltersGroup');
      if (group) group.style.opacity = isCircuitLayerVisible ? '1' : '0.4';
      updateNetworkCircuits(currentCircuitFilter);
    });

    // 9b. SITAC Pin Status Filters
    document.querySelectorAll('.map-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.map-tag-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const st = btn.getAttribute('data-status');
        updateMapMarkers(st);
      });
    });

    // 9c. Circuit Routes Status Filters
    document.querySelectorAll('.map-circuit-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.map-circuit-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const st = btn.getAttribute('data-circuit-status') || 'ALL';
        updateNetworkCircuits(st);
      });
    });

    // 9d. Base Layer switcher buttons
    document.querySelectorAll('.map-layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layerKey = btn.getAttribute('data-layer');
        setMapBaseLayer(layerKey);
      });
    });

    // 9e. Fit Bounds button (zoom into all active pins & circuits)
    document.getElementById('btnFitMapBounds')?.addEventListener('click', () => {
      if (!leafletMap) return;
      const allBounds = [];
      if (isSitacLayerVisible && mapMarkersLayer) {
        mapMarkersLayer.eachLayer(l => {
          if (l.getLatLng) allBounds.push(l.getLatLng());
        });
      }
      if (isCircuitLayerVisible && mapCircuitsLayer) {
        mapCircuitsLayer.eachLayer(l => {
          if (l.getLatLng) allBounds.push(l.getLatLng());
          if (l.getLatLngs) {
            const lls = l.getLatLngs();
            if (Array.isArray(lls)) {
              lls.forEach(pt => allBounds.push(pt));
            }
          }
        });
      }
      if (allBounds.length > 0) {
        leafletMap.fitBounds(L.latLngBounds(allBounds), { padding: [40, 40], maxZoom: 13 });
      } else if (lastMapBounds) {
        leafletMap.fitBounds(lastMapBounds, { padding: [40, 40], maxZoom: 13 });
      }
    });

    document.getElementById('btnResetWebgisView')?.addEventListener('click', () => {
      if (leafletMap) leafletMap.setView([-6.2200, 106.8400], 11);
    });

    // 9f. Legend Collapse/Expand Toggle
    document.getElementById('btnToggleLegendCollapse')?.addEventListener('click', () => {
      const content = document.getElementById('webgisLegendContent');
      const icon = document.getElementById('iconLegendCollapse');
      if (!content) return;
      const isHidden = content.classList.contains('hidden');
      if (isHidden) {
        content.classList.remove('hidden');
        if (icon) icon.className = 'fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200';
      } else {
        content.classList.add('hidden');
        if (icon) icon.className = 'fa-solid fa-chevron-up text-[10px] text-slate-400 transition-transform duration-200';
      }
    });

    // 10. Table Action Buttons Delegation (View Detail, Delete & Quick Edit)
    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-quick-edit');
      if (editBtn) {
        const type = editBtn.getAttribute('data-type');
        const id = editBtn.getAttribute('data-id');
        openQuickEditModal(type, id);
        return;
      }

      const waBtn = e.target.closest('.btn-wa-dispatch');
      if (waBtn) {
        const type = waBtn.getAttribute('data-type');
        const id = waBtn.getAttribute('data-id');
        openWhatsAppDispatchModal(type, id);
        return;
      }

      const detailBtn = e.target.closest('.btn-view-detail');
      if (detailBtn) {
        const type = detailBtn.getAttribute('data-type');
        const id = detailBtn.getAttribute('data-id');
        openDetailModal(type, id);
      }

      const deleteBtn = e.target.closest('.btn-delete-row');
      if (deleteBtn) {
        const type = deleteBtn.getAttribute('data-type');
        const id = deleteBtn.getAttribute('data-id');
        deleteRecord(type, id);
      }
    });

    // 10c. Interactive Multi-Value Popover (+N Lainnya / Solusi 1)
    const tenantPopover = document.getElementById('tenantPopover');
    const popoverTitle = document.getElementById('tenantPopoverTitle');
    const popoverIcon = document.getElementById('tenantPopoverIcon');
    const popoverBody = document.getElementById('tenantPopoverBody');
    const btnPopoverClose = document.getElementById('btnTenantPopoverClose');
    let activePopoverBtn = null;

    const closePopover = () => {
      if (tenantPopover) {
        tenantPopover.classList.add('hidden');
        tenantPopover.style.display = 'none';
        activePopoverBtn = null;
      }
    };

    btnPopoverClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      closePopover();
    });

    document.addEventListener('click', (e) => {
      const popoverTrigger = e.target.closest('[data-popover]');
      if (popoverTrigger) {
        e.stopPropagation();

        // If clicking the same trigger button that's already open, toggle close
        if (activePopoverBtn === popoverTrigger && tenantPopover && !tenantPopover.classList.contains('hidden')) {
          closePopover();
          return;
        }

        try {
          const raw = popoverTrigger.getAttribute('data-popover');
          const data = JSON.parse(decodeURIComponent(raw));
          
          if (popoverTitle) popoverTitle.textContent = data.title || 'Daftar Lengkap';
          if (popoverIcon) {
            popoverIcon.className = `fa-solid ${data.icon || 'fa-users'} text-cyan-400 text-xs`;
          }
          if (popoverBody) {
            popoverBody.innerHTML = (data.items || []).map((item, idx) => `
              <div class="popover-tenant-item">
                <div class="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                  <span class="popover-item-num">${idx + 1}.</span>
                  <span class="popover-item-text font-medium truncate" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                </div>
                ${item.badge ? `<span class="badge-pill bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-[10px] whitespace-nowrap flex-shrink-0 font-bold">${escapeHtml(item.badge)}</span>` : ''}
              </div>
            `).join('');
          }

          // Positioning near the button
          const rect = popoverTrigger.getBoundingClientRect();
          const popoverWidth = 330;
          const popoverHeight = 280;
          
          let top = rect.bottom + 6;
          let left = rect.left;

          // Check right boundary
          if (left + popoverWidth > window.innerWidth - 16) {
            left = Math.max(16, window.innerWidth - popoverWidth - 16);
          }
          if (left < 16) left = 16;

          // Check bottom boundary: if bottom overflows, flip to show above the button
          if (top + popoverHeight > window.innerHeight - 16) {
            const topAbove = rect.top - popoverHeight - 6;
            if (topAbove >= 16) {
              top = topAbove;
            } else {
              top = Math.max(16, window.innerHeight - popoverHeight - 16);
            }
          }

          tenantPopover.style.top = `${top}px`;
          tenantPopover.style.left = `${left}px`;
          tenantPopover.classList.remove('hidden');
          tenantPopover.style.display = 'block';
          activePopoverBtn = popoverTrigger;
        } catch (err) {
          console.error('Error opening popover:', err);
        }
        return;
      }

      if (tenantPopover && !tenantPopover.contains(e.target) && !tenantPopover.classList.contains('hidden')) {
        closePopover();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePopover();
    });


    // Helper function to open modal with auto-fill date & PIC
    function openModalWithDate(modalId, dateInputId) {
      const today = new Date().toISOString().slice(0, 10);
      if (dateInputId) {
        const d = document.getElementById(dateInputId);
        if (d && !d.value) d.value = today;
      }
      const m = document.getElementById(modalId);
      if (m) {
        m.style.display = 'flex';
        // Auto-fill & lock PIC name if field technician is logged in
        if (modalId === 'modalAddGangguan' || modalId === 'modalAddSitac') {
          const picInput = m.querySelector('input[name="pic_perijinan"]');
          if (picInput) {
            if (state.currentUser?.role === 'lapangan') {
              const assignedName = state.currentUser.full_name || state.activeTechnician || 'Teknisi Lapangan';
              picInput.value = assignedName;
              picInput.readOnly = true;
              picInput.style.opacity = '0.85';
              picInput.style.cursor = 'not-allowed';
              picInput.title = 'Identitas PIC terkunci otomatis sesuai akun sesi Anda';
            } else {
              picInput.readOnly = false;
              picInput.style.opacity = '1';
              picInput.style.cursor = 'text';
              if (!picInput.value) picInput.value = state.activeTechnician !== 'Admin' ? state.activeTechnician : '';
            }
          }
        }
      }
    }

    // 11. Separated Add Data Modals (Gangguan, SITAC, Collo, and Smart Picker)
    // 11a. Direct button on Tiket Gangguan page
    document.getElementById('btnOpenAddGangguanDirect')?.addEventListener('click', () => {
      openModalWithDate('modalAddGangguan', 'addGangguanDateDispos');
    });

    // 11b. Direct button on SITAC PA page
    document.getElementById('btnOpenAddSitacDirect')?.addEventListener('click', () => {
      openModalWithDate('modalAddSitac', 'addSitacDateDispos');
    });

    // 11c. Direct button on Colocation page
    document.getElementById('btnOpenAddColloDirect')?.addEventListener('click', () => {
      openModalWithDate('modalAddCollo');
    });

    // 11d. Topbar "+ Tambah Data" Smart Button
    document.getElementById('btnOpenAddModal')?.addEventListener('click', () => {
      // If currently looking at a specific view, open that form directly!
      if (state.currentUser?.role === 'sales') {
        openModalWithDate('modalAddCollo');
      } else if (state.activeView === 'view-gangguan') {
        openModalWithDate('modalAddGangguan', 'addGangguanDateDispos');
      } else if (state.activeView === 'view-sitac-pa') {
        openModalWithDate('modalAddSitac', 'addSitacDateDispos');
      } else if (state.activeView === 'view-collo-list' && state.currentUser?.role !== 'lapangan') {
        openModalWithDate('modalAddCollo');
      } else {
        // Open clean picker dialog so user can choose what to add without confusion
        const pickModal = document.getElementById('modalPickAddType');
        if (pickModal) pickModal.style.display = 'flex';
      }
    });

    // 11e. Picker Dialog Options
    document.getElementById('btnPickSitac')?.addEventListener('click', () => {
      document.getElementById('modalPickAddType').style.display = 'none';
      openModalWithDate('modalAddSitac', 'addSitacDateDispos');
    });

    document.getElementById('btnPickCollo')?.addEventListener('click', () => {
      document.getElementById('modalPickAddType').style.display = 'none';
      const m = document.getElementById('modalAddCollo');
      if (m) {
        m.style.display = 'flex';
        const startInput = m.querySelector('input[name="start_date"]');
        if (startInput && !startInput.value) {
          startInput.value = new Date().toISOString().split('T')[0];
        }
      }
    });

    // 11f. Close buttons for each modal
    document.getElementById('btnClosePickAdd')?.addEventListener('click', () => {
      document.getElementById('modalPickAddType').style.display = 'none';
    });
    document.getElementById('btnCloseAddGangguan')?.addEventListener('click', () => {
      document.getElementById('modalAddGangguan').style.display = 'none';
    });
    document.getElementById('btnCloseAddSitac')?.addEventListener('click', () => {
      document.getElementById('modalAddSitac').style.display = 'none';
    });
    document.getElementById('btnCloseAddCollo')?.addEventListener('click', () => {
      document.getElementById('modalAddCollo').style.display = 'none';
    });

    // Close modals on overlay backdrop click
    ['modalAddGangguan', 'modalAddSitac', 'modalAddCollo', 'modalPickAddType', 'modalQuickEdit', 'modalDetail', 'modalChangePassword'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        if (e.target.id === id) {
          e.target.style.display = 'none';
        }
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ['modalAddGangguan', 'modalAddSitac', 'modalAddCollo', 'modalPickAddType', 'modalQuickEdit', 'modalDetail', 'modalChangePassword', 'loginOverlay'].forEach(id => {
          if (id === 'loginOverlay' && !state.currentUser) return;
          const el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
      }
    });

    // 12. Modal Quick Edit Close & Submit
    document.getElementById('btnCloseQuickEdit')?.addEventListener('click', () => {
      document.getElementById('modalQuickEdit').style.display = 'none';
    });
    document.getElementById('btnCancelQuickEdit')?.addEventListener('click', () => {
      document.getElementById('modalQuickEdit').style.display = 'none';
    });
    document.getElementById('formQuickEdit')?.addEventListener('submit', handleQuickEditSubmit);

    // 13. Modal Detail Close
    document.getElementById('btnCloseDetail')?.addEventListener('click', () => {
      document.getElementById('modalDetail').style.display = 'none';
    });

    // 14. Add Forms Submissions
    document.getElementById('formAddGangguan')?.addEventListener('submit', (e) => handleAddFormSubmit(e, 'gangguan'));
    document.getElementById('formAddSitac')?.addEventListener('submit', (e) => handleAddFormSubmit(e, 'sitac'));
    document.getElementById('formAddCollo')?.addEventListener('submit', (e) => handleAddFormSubmit(e, 'collo'));

    // 14b. GPS Geolocation & Smart Paste Parser for modalAddSitac
    const btnGetGpsAdd = document.getElementById('btnGetGpsAddSitac');
    const latInAdd = document.getElementById('addSitacLat');
    const lngInAdd = document.getElementById('addSitacLng');
    if (btnGetGpsAdd && latInAdd && lngInAdd) {
      btnGetGpsAdd.addEventListener('click', () => handleGetDeviceGps(latInAdd, lngInAdd, btnGetGpsAdd));
      [latInAdd, lngInAdd].forEach(inp => {
        inp.addEventListener('paste', (e) => {
          const pasteData = (e.clipboardData || window.clipboardData).getData('text');
          if (parseAndSetCoordinates(pasteData, latInAdd, lngInAdd)) {
            e.preventDefault();
          }
        });
      });
    }

    // 14c. Real-time Duplicate Check on Nomor PA input
    const noPaInput = document.getElementById('addSitacNoPa');
    const noPaWarnBox = document.getElementById('addSitacNoPaDupWarning');
    const noPaWarnMsg = document.getElementById('addSitacNoPaDupMsg');
    if (noPaInput && noPaWarnBox) {
      const checkNoPaDup = () => {
        const val = noPaInput.value.trim();
        const dup = findDuplicateNoPa(val);
        if (dup) {
          noPaWarnBox.classList.remove('hidden');
          if (noPaWarnMsg) {
            noPaWarnMsg.textContent = `Nomor PA "${val}" sudah terdaftar di sistem! (Pelanggan: ${dup.pelanggan || '-'})`;
          }
          noPaInput.classList.add('border-rose-500');
        } else {
          noPaWarnBox.classList.add('hidden');
          noPaInput.classList.remove('border-rose-500');
        }
      };
      noPaInput.addEventListener('input', checkNoPaDup);
      noPaInput.addEventListener('blur', checkNoPaDup);
    }

    // 14d. Cancel file photo selection in modalAddSitac
    const addFotoInput = document.getElementById('addSitacFotoInput');
    const btnCancelAddFoto = document.getElementById('btnCancelAddSitacFoto');
    const addFotoHelp = document.getElementById('addSitacFotoHelpText');
    if (addFotoInput && btnCancelAddFoto) {
      addFotoInput.addEventListener('change', () => {
        if (addFotoInput.files && addFotoInput.files.length > 0) {
          btnCancelAddFoto.classList.remove('hidden');
          if (addFotoHelp) {
            addFotoHelp.innerHTML = `<span class="text-emerald-400 font-medium"><i class="fa-solid fa-file-image mr-1"></i> File dipilih: ${escapeHtml(addFotoInput.files[0].name)} (${(addFotoInput.files[0].size / 1024).toFixed(1)} KB)</span>`;
          }
        } else {
          btnCancelAddFoto.classList.add('hidden');
          if (addFotoHelp) {
            addFotoHelp.textContent = 'Format: JPG, PNG, atau PDF (Surat izin, kuitansi retribusi, dll.)';
          }
        }
      });
      btnCancelAddFoto.addEventListener('click', () => {
        addFotoInput.value = '';
        btnCancelAddFoto.classList.add('hidden');
        if (addFotoHelp) {
          addFotoHelp.textContent = 'Format: JPG, PNG, atau PDF (Surat izin, kuitansi retribusi, dll.)';
        }
        showToast('Pilihan file foto dibatalkan', 'info');
      });
    }

    // 14e. Cancel and preview file document selection in modalAddCollo
    const addColloFotoInp = document.getElementById('addColloFotoInput');
    const btnCancelAddColloFoto = document.getElementById('btnCancelAddColloFoto');
    const addColloFotoHelp = document.getElementById('addColloFotoHelpText');
    if (addColloFotoInp && btnCancelAddColloFoto) {
      addColloFotoInp.addEventListener('change', () => {
        if (addColloFotoInp.files && addColloFotoInp.files.length > 0) {
          btnCancelAddColloFoto.classList.remove('hidden');
          if (addColloFotoHelp) {
            addColloFotoHelp.innerHTML = `<span class="text-emerald-400 font-medium"><i class="fa-solid fa-file-contract mr-1"></i> File dipilih: ${escapeHtml(addColloFotoInp.files[0].name)} (${(addColloFotoInp.files[0].size / 1024).toFixed(1)} KB)</span>`;
          }
        } else {
          btnCancelAddColloFoto.classList.add('hidden');
          if (addColloFotoHelp) {
            addColloFotoHelp.textContent = 'Format: JPG, PNG, atau PDF (Lampiran Berita Acara / Kontrak Sewa / SPP)';
          }
        }
      });
      btnCancelAddColloFoto.addEventListener('click', () => {
        addColloFotoInp.value = '';
        btnCancelAddColloFoto.classList.add('hidden');
        if (addColloFotoHelp) {
          addColloFotoHelp.textContent = 'Format: JPG, PNG, atau PDF (Lampiran Berita Acara / Kontrak Sewa / SPP)';
        }
        showToast('Pilihan file dokumen link sewa dibatalkan', 'info');
      });
    }

    // 15. Topbar Dropdown Toggle Handlers (Ekspor & Alat Portal)
    const btnExport = document.getElementById('btnToggleExportMenu');
    const menuExport = document.getElementById('exportGroupMenu');
    const btnTools = document.getElementById('btnToggleToolsMenu');
    const menuTools = document.getElementById('toolsGroupMenu');

    const updateDropdownActiveStates = () => {
      const isExportOpen = menuExport && !menuExport.classList.contains('hidden');
      const isToolsOpen = menuTools && !menuTools.classList.contains('hidden');

      if (btnExport) btnExport.classList.toggle('active', !!isExportOpen);
      if (btnTools) btnTools.classList.toggle('active', !!isToolsOpen);
    };

    const closeAllDropdowns = () => {
      menuExport?.classList.add('hidden');
      menuTools?.classList.add('hidden');
      updateDropdownActiveStates();
    };

    btnExport?.addEventListener('click', (e) => {
      e.stopPropagation();
      menuTools?.classList.add('hidden');
      menuExport?.classList.toggle('hidden');
      updateDropdownActiveStates();
    });

    btnTools?.addEventListener('click', (e) => {
      e.stopPropagation();
      menuExport?.classList.add('hidden');
      menuTools?.classList.toggle('hidden');
      updateDropdownActiveStates();
    });

    // Close dropdowns on item click
    menuExport?.querySelectorAll('button, a').forEach(item => {
      item.addEventListener('click', closeAllDropdowns);
    });
    menuTools?.querySelectorAll('button, a').forEach(item => {
      item.addEventListener('click', closeAllDropdowns);
    });

    // Close dropdowns on document click
    document.addEventListener('click', (e) => {
      let changed = false;
      if (!e.target.closest('#exportGroupDropdownContainer')) {
        if (menuExport && !menuExport.classList.contains('hidden')) {
          menuExport.classList.add('hidden');
          changed = true;
        }
      }
      if (!e.target.closest('#toolsGroupDropdownContainer')) {
        if (menuTools && !menuTools.classList.contains('hidden')) {
          menuTools.classList.add('hidden');
          changed = true;
        }
      }
      if (changed) updateDropdownActiveStates();
    });

    // 15b. Sidebar User Tools Dropdown Handlers (Silky Smooth Animation)
    const containerUser = document.getElementById('sidebarUserContainer');
    const btnUserSidebar = document.getElementById('btnToggleUserToolsSidebar');
    const menuUserSidebar = document.getElementById('sidebarUserDropdownMenu');
    const userChevron = document.getElementById('sidebarUserChevron');

    const closeSidebarUserMenu = () => {
      if (menuUserSidebar && menuUserSidebar.classList.contains('show')) {
        menuUserSidebar.classList.remove('show');
        containerUser?.classList.remove('dropdown-open');
        if (userChevron) userChevron.style.transform = '';
      }
    };

    const openSidebarUserMenu = () => {
      if (menuUserSidebar) {
        menuUserSidebar.classList.add('show');
        containerUser?.classList.add('dropdown-open');
        if (userChevron) userChevron.style.transform = 'rotate(180deg)';
      }
    };

    if (btnUserSidebar && menuUserSidebar) {
      btnUserSidebar.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menuUserSidebar.classList.contains('show');
        if (isOpen) {
          closeSidebarUserMenu();
        } else {
          openSidebarUserMenu();
        }
      });

      menuUserSidebar.querySelectorAll('button').forEach(item => {
        item.addEventListener('click', () => {
          closeSidebarUserMenu();
        });
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#sidebarUserContainer')) {
          closeSidebarUserMenu();
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllDropdowns();
        closeSidebarUserMenu();
      }
    });

    // 15c. Database Access & Explorer Modal Handlers
    document.getElementById('btnOpenDatabaseViewer')?.addEventListener('click', openDatabaseViewerModal);
    document.querySelector('.db-status-pill')?.addEventListener('click', openDatabaseViewerModal);
    document.getElementById('btnCloseDatabaseViewer')?.addEventListener('click', () => {
      document.getElementById('modalDatabaseViewer').style.display = 'none';
    });
    document.getElementById('modalDatabaseViewer')?.addEventListener('click', (e) => {
      if (e.target.id === 'modalDatabaseViewer') {
        e.target.style.display = 'none';
      }
    });
    document.getElementById('btnRefreshDbUsers')?.addEventListener('click', fetchDatabaseOverview);
    document.getElementById('dbUserSearchInput')?.addEventListener('input', () => {
      if (dbOverviewData && dbOverviewData.users) {
        renderDbUsersTable(dbOverviewData.users);
      }
    });

    // Test Firestore Connection Button
    document.getElementById('btnTestFirestoreConn')?.addEventListener('click', async () => {
      const alertBox = document.getElementById('firestoreStatusAlert');
      if (!alertBox) return;
      alertBox.className = 'p-3 rounded-lg text-xs bg-cyan-950/40 border border-cyan-500/30 text-cyan-300';
      alertBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Menghubungkan ke Google Cloud Firestore...';

      if (window.FirebaseManager) {
        const res = await window.FirebaseManager.testConnection();
        if (res.success) {
          alertBox.className = 'p-3 rounded-lg text-xs bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-semibold';
          alertBox.innerHTML = `<i class="fa-solid fa-circle-check mr-2"></i> ${res.message}`;
        } else {
          alertBox.className = 'p-3 rounded-lg text-xs bg-amber-950/40 border border-amber-500/30 text-amber-300 font-semibold';
          alertBox.innerHTML = `<i class="fa-solid fa-circle-exclamation mr-2"></i> ${res.message}`;
        }
      } else {
        alertBox.className = 'p-3 rounded-lg text-xs bg-rose-950/40 border border-rose-500/30 text-rose-300';
        alertBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-2"></i> FirebaseManager SDK belum dimuat di browser.';
      }
    });

    // Sync Firestore Button
    document.getElementById('btnSyncFirestore')?.addEventListener('click', async () => {
      const progBox = document.getElementById('syncProgressContainer');
      const label = document.getElementById('syncProgressLabel');
      const pct = document.getElementById('syncProgressPct');
      const bar = document.getElementById('syncProgressBar');

      if (!window.FirebaseManager) {
        alert('SDK Firebase tidak aktif');
        return;
      }

      if (progBox) progBox.classList.remove('hidden');
      try {
        await window.FirebaseManager.uploadLocalDataToFirestore((msg, percent) => {
          if (label) label.textContent = msg;
          if (pct) pct.textContent = `${percent}%`;
          if (bar) bar.style.width = `${percent}%`;
        });
        showToast('Berhasil sinkronisasi seluruh data ke Cloud Firestore!');
        fetchDatabaseOverview();
      } catch (err) {
        alert('Gagal sinkronisasi: ' + err.message);
      }
    });

    // Submit Add User in DB Explorer Form
    document.getElementById('formDbAddUser')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertBox = document.getElementById('dbAddUserAlert');
      const username = document.getElementById('dbAddUsername').value.trim();
      const password = document.getElementById('dbAddPassword').value.trim();
      const full_name = document.getElementById('dbAddFullName').value.trim();
      const pic_code = document.getElementById('dbAddPicCode').value.trim();
      const role = document.getElementById('dbAddRole').value;

      alertBox.className = 'p-2.5 rounded-lg text-xs bg-slate-900 text-slate-300 hidden';

      try {
        let registerRes = null;
        if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
          try {
            registerRes = await window.FirebaseManager.registerUser({ username, password, full_name, pic_code, role });
          } catch (fbErr) {
            console.warn('Firestore register notice:', fbErr.message);
          }
        }
        if (!registerRes) {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, full_name, pic_code, role })
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.message || 'Gagal menambahkan user');
          }
          registerRes = data;
        }

        alertBox.className = 'p-2.5 rounded-lg text-xs bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 block';
        alertBox.textContent = registerRes.message || 'Akun baru berhasil ditambahkan ke Firestore!';
        showToast(`Akun '${full_name}' (@${username}) berhasil didaftarkan ke Firestore!`);

        document.getElementById('formDbAddUser').reset();
        await fetchDatabaseOverview();
        setTimeout(() => window.switchDbTab('users'), 1000);
      } catch (err) {
        alertBox.className = 'p-2.5 rounded-lg text-xs bg-rose-950/60 border border-rose-500/30 text-rose-300 block';
        alertBox.textContent = err.message;
      }
    });

    // 16. Audit Log Modal Handlers
    document.getElementById('btnOpenAuditLogs')?.addEventListener('click', () => {
      document.getElementById('modalAuditLogs').style.display = 'flex';
      fetchAuditLogs();
    });
    document.getElementById('btnCloseAuditLogs')?.addEventListener('click', () => {
      document.getElementById('modalAuditLogs').style.display = 'none';
    });
    document.getElementById('btnRefreshAuditLogs')?.addEventListener('click', fetchAuditLogs);
    document.getElementById('auditLogSearch')?.addEventListener('input', () => {
      if (cachedAuditLogs) renderAuditLogsUI(cachedAuditLogs);
    });

    // 17. Import Excel Modal Handlers
    document.getElementById('btnOpenImportExcel')?.addEventListener('click', () => {
      document.getElementById('modalImportExcel').style.display = 'flex';
    });
    document.getElementById('btnCloseImportExcel')?.addEventListener('click', () => {
      document.getElementById('modalImportExcel').style.display = 'none';
    });
    document.getElementById('btnCancelImportExcel')?.addEventListener('click', () => {
      document.getElementById('modalImportExcel').style.display = 'none';
    });

    // Backdrop click for new modals
    ['modalAuditLogs', 'modalImportExcel'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        if (e.target.id === id) e.target.style.display = 'none';
      });
    });

    setupExcelImportHandlers();
    setupExecutivePeriodFilter();
  }

  // =========================================================================
  // DATABASE OVERVIEW HELPERS (FIRESTORE INTEGRATED)
  // =========================================================================
  let dbOverviewData = null;

  async function fetchDatabaseOverview() {
    try {
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        try {
          const users = await window.FirebaseManager.fetchCollection('users');
          const sitac = await window.FirebaseManager.fetchCollection('sitac_records');
          const gangguan = await window.FirebaseManager.fetchCollection('gangguan_records');
          const collo = await window.FirebaseManager.fetchCollection('collo_records');

          dbOverviewData = {
            success: true,
            database_info: {
              file: "Google Cloud Firestore",
              size_mb: "Cloud Managed",
              status: "Connected (Firestore)"
            },
            tables: [
              { name: "users", label: "Pengguna / PIC Accounts (Firestore)", count: users.length, description: "Koleksi Users di Cloud Firestore" },
              { name: "sitac_records", label: "Monitoring SITAC & Perizinan", count: sitac.length, description: "Koleksi SITAC di Cloud Firestore" },
              { name: "gangguan_records", label: "Tiket Gangguan Darurat", count: gangguan.length, description: "Koleksi Gangguan di Cloud Firestore" },
              { name: "collo_records", label: "Aset Colocation & Finansial", count: collo.length, description: "Koleksi Collo di Cloud Firestore" }
            ],
            users: users
          };
          renderDbOverviewUI();
          return;
        } catch (fbErr) {
          console.warn('Fallback to REST API for db overview:', fbErr);
        }
      }

      const res = await fetch('/api/database/overview');
      if (!res.ok) throw new Error('Gagal mengambil overview database');
      const data = await res.json();
      if (data.success) {
        dbOverviewData = data;
        renderDbOverviewUI();
      }
    } catch (err) {
      console.warn('Gagal memuat overview database:', err);
    }
  }

  function renderDbOverviewUI() {
    if (!dbOverviewData) return;
    const { database_info, tables, users } = dbOverviewData;

    if (database_info) {
      const dbInfoFile = document.getElementById('dbInfoFile');
      const dbInfoSize = document.getElementById('dbInfoSize');
      if (dbInfoFile) dbInfoFile.textContent = database_info.file || 'telecom_portal.db';
      if (dbInfoSize) dbInfoSize.textContent = `${database_info.size_mb || 2.5} MB`;
    }

    let totalRecordsSum = 0;
    if (tables && Array.isArray(tables)) {
      tables.forEach(t => totalRecordsSum += (t.count || 0));
    }
    const dbInfoTotalRecords = document.getElementById('dbInfoTotalRecords');
    if (dbInfoTotalRecords) dbInfoTotalRecords.textContent = `${totalRecordsSum.toLocaleString('id-ID')} Data`;

    const dbUsersBadgeCount = document.getElementById('dbUsersBadgeCount');
    if (dbUsersBadgeCount) dbUsersBadgeCount.textContent = users ? users.length : 0;

    renderDbUsersTable(users || []);
    renderDbTablesGrid(tables || []);
  }

  function renderDbUsersTable(usersList) {
    const tbody = document.getElementById('dbUserTableBody');
    if (!tbody) return;

    const query = (document.getElementById('dbUserSearchInput')?.value || '').toLowerCase().trim();
    const filtered = usersList.filter(u => {
      if (!query) return true;
      return (u.username || '').toLowerCase().includes(query) ||
             (u.full_name || '').toLowerCase().includes(query) ||
             (u.pic_code || '').toLowerCase().includes(query) ||
             (u.role || '').toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-slate-400">Tidak ada akun user database yang cocok.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(u => {
      const roleBadge = u.role === 'admin' 
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">ADMIN</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">PETUGAS PIC</span>`;

      return `
        <tr class="hover:bg-slate-800/40 transition border-b border-white/5">
          <td class="p-3 font-mono text-[11px] text-slate-400">#${u.id}</td>
          <td class="p-3 font-bold text-cyan-300 flex items-center gap-1.5">
            <i class="fa-solid fa-user-circle text-slate-400"></i>
            @${escapeHtml(u.username)}
          </td>
          <td class="p-3 font-semibold text-slate-100">${escapeHtml(u.full_name)}</td>
          <td class="p-3">${roleBadge}</td>
          <td class="p-3 font-mono text-slate-300">${escapeHtml(u.pic_code || '-')}</td>
          <td class="p-3 text-center font-bold text-amber-300">${u.sitac_count || 0}</td>
          <td class="p-3 text-right space-x-1">
            <button type="button" class="px-2 py-1 rounded bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 text-[10px] font-semibold border border-violet-500/40" onclick="window.openAdminResetForUser('${escapeHtml(u.username)}')">
              <i class="fa-solid fa-key mr-1"></i> Reset Pw
            </button>
            ${u.role !== 'admin' ? `
              <button type="button" class="px-2 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-[10px] font-semibold border border-rose-500/40" onclick="window.openAdminDeleteForUser('${escapeHtml(u.username)}')">
                <i class="fa-solid fa-trash mr-1"></i> Hapus
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderDbTablesGrid(tables) {
    const grid = document.getElementById('dbTablesGrid');
    if (!grid) return;

    grid.innerHTML = tables.map(t => `
      <div class="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex items-center justify-between">
        <div>
          <div class="font-bold text-slate-200 text-xs flex items-center gap-1.5">
            <i class="fa-solid fa-table text-cyan-400"></i>
            <span>${escapeHtml(t.label)}</span>
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(t.description)}</div>
          <div class="text-[10px] font-mono text-slate-500 mt-1">Nama Tabel: ${t.name}</div>
        </div>
        <div class="text-right">
          <div class="font-bold text-cyan-300 text-sm">${(t.count || 0).toLocaleString('id-ID')}</div>
          <div class="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">BARIS / DATA</div>
        </div>
      </div>
    `).join('');
  }

  window.switchDbTab = function(tabName) {
    ['users', 'tables', 'firestore', 'adduser'].forEach(t => {
      const btnName = `dbTab${t.charAt(0).toUpperCase() + t.slice(1)}`;
      const panelName = `dbTabPanel${t.charAt(0).toUpperCase() + t.slice(1)}`;
      const btn = document.getElementById(btnName);
      const panel = document.getElementById(panelName);
      if (btn) {
        if (t === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
      }
      if (panel) {
        if (t === tabName) panel.classList.remove('hidden');
        else panel.classList.add('hidden');
      }
    });
  };

  function openDatabaseViewerModal() {
    const modal = document.getElementById('modalDatabaseViewer');
    if (modal) {
      modal.style.display = 'flex';
      fetchDatabaseOverview();
    }
  }

  window.openAdminResetForUser = function(targetUser) {
    const modal = document.getElementById('modalDatabaseViewer');
    if (modal) modal.style.display = 'none';
    if (typeof window.openAdminUsersModal === 'function') {
      window.openAdminUsersModal();
    } else {
      const mAdmin = document.getElementById('modalAdminUsers');
      if (mAdmin) mAdmin.style.display = 'flex';
    }
    const select = document.getElementById('adminResetTargetUser');
    if (select) select.value = targetUser;
  };

  window.openAdminDeleteForUser = function(targetUser) {
    const modal = document.getElementById('modalDatabaseViewer');
    if (modal) modal.style.display = 'none';
    if (typeof window.openAdminUsersModal === 'function') {
      window.openAdminUsersModal();
      if (typeof window.switchAdminTab === 'function') window.switchAdminTab('delete');
    } else {
      const mAdmin = document.getElementById('modalAdminUsers');
      if (mAdmin) mAdmin.style.display = 'flex';
    }
    const select = document.getElementById('adminDeleteTargetUser');
    if (select) select.value = targetUser;
  };

  // =========================================================================
  // 19. AUDIT LOGS & RIWAYAT AKTIVITAS HELPERS
  // =========================================================================
  let cachedAuditLogs = [];

  async function fetchAuditLogs() {
    const timeline = document.getElementById('auditLogTimeline');
    if (timeline) {
      timeline.innerHTML = '<div class="text-center p-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Memuat audit log dari Cloud Firestore...</div>';
    }

    try {
      if (window.FirebaseManager && window.FirebaseManager.isConfigured()) {
        const logs = await window.FirebaseManager.fetchCollection('audit_logs');
        logs.sort((a, b) => (b.time_str || '').localeCompare(a.time_str || ''));
        cachedAuditLogs = logs;
        renderAuditLogsUI(logs);
      } else {
        if (timeline) timeline.innerHTML = '<div class="text-center p-6 text-slate-400">Firebase Firestore tidak aktif.</div>';
      }
    } catch (e) {
      if (timeline) timeline.innerHTML = `<div class="text-center p-6 text-rose-400">Gagal memuat log: ${e.message}</div>`;
    }
  }

  function renderAuditLogsUI(logs) {
    const timeline = document.getElementById('auditLogTimeline');
    if (!timeline) return;

    const query = (document.getElementById('auditLogSearch')?.value || '').toLowerCase().trim();
    const filtered = logs.filter(l => {
      if (!query) return true;
      return (l.action || '').toLowerCase().includes(query) ||
             (l.username || '').toLowerCase().includes(query) ||
             (l.details || '').toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      timeline.innerHTML = '<div class="text-center p-6 text-slate-400">Tidak ada riwayat aktivitas yang sesuai.</div>';
      return;
    }

    timeline.innerHTML = filtered.map(l => {
      let badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      if ((l.action || '').includes('LOGIN')) badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      else if ((l.action || '').includes('IMPORT') || (l.action || '').includes('ADD')) badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      else if ((l.action || '').includes('DELETE') || (l.action || '').includes('RESET')) badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';

      return `
        <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10 flex items-start gap-3">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${badgeColor} border text-[11px]">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-slate-100 text-xs">${escapeHtml(l.action || 'ACTIVITY')}</span>
              <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(l.time_str || '-')}</span>
            </div>
            <div class="text-[11px] text-slate-300 mt-0.5">${escapeHtml(l.details || '-')}</div>
            <div class="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-semibold">
              <i class="fa-solid fa-user-circle"></i> @${escapeHtml(l.username || 'system')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // =========================================================================
  // 20. EXCEL BULK IMPORT HELPERS & SMART COLUMN MAPPER
  // =========================================================================
  let rawExcelRows = [];
  let normalizedExcelRecords = [];

  function normalizeExcelRow(raw, targetModule) {
    const norm = {};
    const keys = Object.keys(raw || {});

    const findVal = (regex) => {
      const k = keys.find(key => regex.test(key.trim().toLowerCase()));
      return k !== undefined ? raw[k] : undefined;
    };

    if (targetModule === 'sitac_records') {
      norm.no_pa = String(findVal(/^(no[_\s\.]*pa|nomor[_\s\.]*pa|nopa)$/i) || '').trim();
      norm.pelanggan = String(findVal(/^(pelanggan|nama[_\s\.]*pelanggan|customer|client|instansi)$/i) || '').trim();
      norm.ptl = String(findVal(/^(ptl|project[_\s\.]*technical[_\s\.]*lead)$/i) || '').trim();
      norm.pic_perijinan = String(findVal(/^(pic|pic[_\s\.]*sitac|pic[_\s\.]*perijinan|pic[_\s\.]*perizinan|teknisi)$/i) || '').trim();
      norm.terminating = String(findVal(/^(terminating|rute|lokasi|alamat[_\s\.]*terminating|jalur)$/i) || '').trim();
      norm.biaya_permintaan_awal = Number(findVal(/^(biaya[_\s\.]*awal|biaya[_\s\.]*permintaan[_\s\.]*awal|pengajuan[_\s\.]*awal|biaya_permintaan_awal)$/i) || 0);
      norm.biaya_final = Number(findVal(/^(biaya[_\s\.]*final|realisasi[_\s\.]*final|biaya_final|final)$/i) || 0);
      norm.progress = String(findVal(/^(progress|status|status[_\s\.]*progress)$/i) || 'Ongoing').trim();
      const lat = findVal(/^(latitude|lat|lintang)$/i);
      const lng = findVal(/^(longitude|long|lng|bujur)$/i);
      norm.latitude = (lat !== undefined && String(lat).trim() !== '') ? Number(lat) : null;
      norm.longitude = (lng !== undefined && String(lng).trim() !== '') ? Number(lng) : null;
      norm.date_dispos = String(findVal(/^(tgl[_\s\.]*dispos|tanggal[_\s\.]*disposisi|tgl[_\s\.]*disposisi|date_dispos)$/i) || '').trim();
      norm.date_close = String(findVal(/^(tgl[_\s\.]*close|tanggal[_\s\.]*selesai|tgl[_\s\.]*selesai|date_close)$/i) || '').trim();
      norm.update_pekerjaan = String(findVal(/^(update|update[_\s\.]*pekerjaan|catatan|keterangan)$/i) || '').trim();

    } else if (targetModule === 'collo_records') {
      norm.pengelola = String(findVal(/^(pengelola|datacenter|mitra)$/i) || '').trim();
      norm.pelanggan = String(findVal(/^(pelanggan|nama[_\s\.]*pelanggan|tenant)$/i) || '').trim();
      norm.sid = String(findVal(/^(sid|service[_\s\.]*id)$/i) || '').trim();
      norm.no_so = String(findVal(/^(no[_\s\.]*so|nomor[_\s\.]*so|so[_\s\.]*number)$/i) || '').trim();
      norm.jenis_sewa = String(findVal(/^(jenis[_\s\.]*sewa|tipe[_\s\.]*sewa)$/i) || 'Backbone').trim();
      norm.originating = String(findVal(/^(originating|site[_\s\.]*asal)$/i) || '').trim();
      norm.terminating = String(findVal(/^(terminating|site[_\s\.]*tujuan)$/i) || '').trim();
      norm.rev_sewa_tahun = Number(findVal(/^(revenue[_\s\.]*sewa[_\s\.]*tahun|rev[_\s\.]*sewa[_\s\.]*tahun|revenue|rev_sewa_tahun)$/i) || 0);
      norm.biaya_sewa_tahun = Number(findVal(/^(biaya[_\s\.]*sewa[_\s\.]*tahun|biaya[_\s\.]*tahunan|biaya_sewa_tahun)$/i) || 0);
      norm.rev_sharing_pct = Number(findVal(/^(rev[_\s\.]*sharing[_\s\.]*pct|sharing[_\s\.]*pct|bagi[_\s\.]*hasil[_\s\.]*pct)$/i) || 0);
      norm.status = String(findVal(/^(status|status[_\s\.]*link)$/i) || 'ACTIVE').trim().toUpperCase();
      norm.start_date = String(findVal(/^(start[_\s\.]*date|tgl[_\s\.]*mulai)$/i) || '').trim();
      norm.end_date = String(findVal(/^(end[_\s\.]*date|tgl[_\s\.]*berakhir|jatuh[_\s\.]*tempo)$/i) || '').trim();
      norm.spp = String(findVal(/^(spp|no[_\s\.]*spp|po[_\s\.]*baru|spp[_\s\.]*\/[_\s\.]*po)$/i) || '').trim();
      norm.proses_admin = String(findVal(/^(proses[_\s\.]*admin|status[_\s\.]*admin)$/i) || 'Running').trim();
      norm.pic_admin = String(findVal(/^(pic[_\s\.]*admin|admin)$/i) || '').trim();
      norm.keterangan = String(findVal(/^(keterangan|catatan|notes)$/i) || '').trim();

    } else if (targetModule === 'gangguan_records') {
      norm.no_tiket = String(findVal(/^(no[_\s\.]*tiket|nomor[_\s\.]*tiket|tiket)$/i) || '').trim();
      norm.tgl_dispos = String(findVal(/^(tgl[_\s\.]*dispos|tanggal[_\s\.]*disposisi|tgl_dispos)$/i) || '').trim();
      norm.tgl_selesai = String(findVal(/^(tgl[_\s\.]*selesai|tanggal[_\s\.]*selesai|tgl_selesai)$/i) || '').trim();
      norm.terminating = String(findVal(/^(terminating|lokasi|kejadian)$/i) || '').trim();
      norm.jenis_gangguan = String(findVal(/^(jenis[_\s\.]*gangguan|jenis)$/i) || 'FO Cut / Utilitas').trim();
      norm.pic_perijinan = String(findVal(/^(pic|pic[_\s\.]*teknis|teknisi)$/i) || '').trim();
      norm.biaya_gangguan = Number(findVal(/^(biaya|biaya[_\s\.]*gangguan)$/i) || 0);
      const isSel = findVal(/^(is_selesai|status|selesai)$/i);
      norm.is_selesai = (isSel === 1 || String(isSel).toLowerCase() === 'selesai' || String(isSel).toLowerCase() === 'true') ? 1 : 0;
      norm.sla_target = String(findVal(/^(sla|sla[_\s\.]*target)$/i) || 'H+1').trim();
      norm.update_gangguan = String(findVal(/^(update|catatan|keterangan)$/i) || '').trim();
    }
    return norm;
  }

  async function downloadImportTemplate(targetModule) {
    if (typeof XLSX === 'undefined') {
      showToast('Menyiapkan template Excel...', 'info');
      try { await ensureXlsxLoaded(); } catch(e) {}
    }
    if (typeof XLSX === 'undefined') {
      alert('Library SheetJS belum termuat di browser.');
      return;
    }
    const wb = XLSX.utils.book_new();
    let wsData = [];
    let filename = '';

    if (targetModule === 'sitac_records') {
      filename = 'Template_Import_SITAC_PA.xlsx';
      wsData = [
        ['No PA', 'Pelanggan', 'PTL', 'PIC SITAC', 'Rute / Terminating', 'Biaya Permintaan Awal', 'Biaya Final', 'Progress', 'Latitude', 'Longitude', 'Tanggal Disposisi', 'Tanggal Selesai', 'Update Pekerjaan'],
        ['PA-CONTOH-001', 'PT Contoh Telekomunikasi', 'Harlan', 'Budi Rodiyah', 'Jl. Jendral Sudirman No. 10 Jakarta Pusat', 5000000, 3500000, 'Ongoing', -6.2088, 106.8456, '2026-10-01', '', 'Survei rute jalur kabel optik'],
        ['PA-CONTOH-002', 'PT Solusi Fiber Prima', 'Harlan', 'Edi Swargaloka', 'Jl. M.H. Thamrin No. 28 Jakarta Pusat', 8000000, 6000000, 'Finish', -6.1855, 106.8155, '2026-10-02', '2026-10-08', 'Izin warga selesai dan kabel tersambung']
      ];
    } else if (targetModule === 'collo_records') {
      filename = 'Template_Import_Colocation_Links.xlsx';
      wsData = [
        ['Pengelola Datacenter', 'Pelanggan', 'SID', 'No SO', 'Jenis Sewa', 'Originating', 'Terminating', 'Revenue Sewa Tahun', 'Biaya Sewa Tahun', 'Rev Sharing Pct', 'Status', 'Start Date', 'End Date', 'No SPP / PO Baru', 'Proses Admin', 'PIC Admin', 'Keterangan'],
        ['DCI Indonesia', 'PT Bank Contoh Nasional', 'SID-DCI-9981', 'SO-2026-0881', 'Colocation Rack', 'Cyber 1 Kuningan', 'DCI Cibitung', 120000000, 85000000, 15, 'ACTIVE', '2026-01-01', '2027-01-01', 'SPP/2026/0881', 'Running', 'Admin', 'Sewa rack dan cross connect'],
        ['NTT Indonesia', 'PT Finansial Digital Asia', 'SID-NTT-2041', 'SO-2026-1102', 'Interkoneksi FO', 'IDC Duren Tiga', 'NTT Cibitung', 65000000, 45000000, 10, 'ACTIVE', '2026-03-01', '2027-03-01', 'PO/2026/1102', 'Running', 'Admin', 'Koneksi MMR']
      ];
    } else {
      filename = 'Template_Import_Gangguan_Insiden.xlsx';
      wsData = [
        ['No Tiket', 'Tanggal Disposisi', 'Lokasi Kejadian', 'Jenis Gangguan', 'PIC Teknis', 'Biaya Penanganan', 'Status Selesai (1/0)', 'Target SLA', 'Catatan Lapangan'],
        ['TIKET-EMG-001', '2026-10-10', 'Jl. Gatot Subroto Kav. 18 Jakarta Selatan', 'FO Cut Utilitas', 'Edi Swargaloka', 1500000, 1, 'H+1', 'Core FO putus akibat galian utilitas, telah disambung selesai'],
        ['TIKET-EMG-002', '2026-10-11', 'Jl. D.I. Panjaitan Cawang Jakarta Timur', 'Tiang Roboh', 'M. Abusopian', 2500000, 0, 'H+1', 'Pendirian tiang pengganti dan relokasi kabel']
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, filename);
    showToast(`Template ${filename} berhasil diunduh!`, 'success');
  }

  function renderImportPreviewTable(targetModule) {
    const previewBox = document.getElementById('importPreviewContainer');
    const previewCount = document.getElementById('importPreviewCount');
    const dupBadge = document.getElementById('importPreviewDupBadge');
    const dupCountEl = document.getElementById('importPreviewDupCount');
    const tableWrap = document.getElementById('importPreviewTableWrap');
    const submitBtn = document.getElementById('btnSubmitImportExcel');

    if (!rawExcelRows || rawExcelRows.length === 0) {
      if (previewBox) previewBox.classList.add('hidden');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    normalizedExcelRecords = rawExcelRows
      .map(r => normalizeExcelRow(r, targetModule))
      .filter(r => {
        if (!r) return false;
        if (targetModule === 'sitac_records') {
          return Boolean(r.no_pa || r.pelanggan || r.terminating || r.ptl || r.pic_perijinan || r.biaya_permintaan_awal || r.biaya_final);
        } else if (targetModule === 'collo_records') {
          return Boolean(r.sid || r.no_so || r.pelanggan || r.pengelola || r.originating || r.terminating);
        } else {
          return Boolean(r.no_tiket || r.terminating || r.pic_perijinan || r.biaya_gangguan);
        }
      });

    // Calculate duplicates against current dataset in web with multi-key smart matching
    let dupCount = 0;
    const isGenericNo = (val) => {
      const v = String(val || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
      return !v || v === 'NONPA' || v === 'NOPA' || v === 'NON' || v === '';
    };

    if (targetModule === 'sitac_records') {
      const sitacSrcA = Array.isArray(window.SITAC_COLLO_DATA?.sitac_records) ? window.SITAC_COLLO_DATA.sitac_records : [];
      const sitacSrcB = Array.isArray(state?.sitac?.data) ? state.sitac.data : [];
      const combined = [...sitacSrcA, ...sitacSrcB];

      const existingNos = new Set();
      const existingPelangganTerm = new Set();

      combined.forEach(s => {
        const pa = String(s.no_pa || '').trim().toUpperCase();
        if (pa && !isGenericNo(pa)) existingNos.add(pa);
        const pel = String(s.pelanggan || '').trim().toUpperCase();
        const term = String(s.terminating || '').trim().toUpperCase();
        if (pel && term) existingPelangganTerm.add(`${pel}|${term}`);
      });

      normalizedExcelRecords.forEach(r => {
        const k = String(r.no_pa || '').trim().toUpperCase();
        const pel = String(r.pelanggan || '').trim().toUpperCase();
        const term = String(r.terminating || '').trim().toUpperCase();
        const ptKey = `${pel}|${term}`;

        if (k && !isGenericNo(k)) {
          r._isDuplicate = existingNos.has(k) || (pel && term && existingPelangganTerm.has(ptKey));
        } else if (pel && term) {
          r._isDuplicate = existingPelangganTerm.has(ptKey);
        } else {
          r._isDuplicate = false;
        }

        if (r._isDuplicate) dupCount++;
      });
    } else if (targetModule === 'collo_records') {
      const colloSrcA = Array.isArray(window.SITAC_COLLO_DATA?.collo_records) ? window.SITAC_COLLO_DATA.collo_records : [];
      const colloSrcB = Array.isArray(state?.collo?.data) ? state.collo.data : [];
      const combined = [...colloSrcA, ...colloSrcB];

      const existingKeys = new Set();
      const existingSids = new Set();
      const existingSos = new Set();
      const existingPelTerm = new Set();

      combined.forEach(c => {
        const sid = String(c.sid || '').trim().toUpperCase();
        const so = String(c.no_so || '').trim().toUpperCase();
        const pel = String(c.pelanggan || '').trim().toUpperCase();
        const term = String(c.terminating || '').trim().toUpperCase();
        if (sid && so) existingKeys.add(`${sid}|${so}`);
        if (sid) existingSids.add(sid);
        if (so) existingSos.add(so);
        if (pel && term) existingPelTerm.add(`${pel}|${term}`);
      });

      normalizedExcelRecords.forEach(r => {
        const sid = String(r.sid || '').trim().toUpperCase();
        const so = String(r.no_so || '').trim().toUpperCase();
        const pel = String(r.pelanggan || '').trim().toUpperCase();
        const term = String(r.terminating || '').trim().toUpperCase();

        if (sid && so) {
          r._isDuplicate = existingKeys.has(`${sid}|${so}`);
        } else if (sid) {
          r._isDuplicate = existingSids.has(sid);
        } else if (so) {
          r._isDuplicate = existingSos.has(so);
        } else if (pel && term) {
          r._isDuplicate = existingPelTerm.has(`${pel}|${term}`);
        } else {
          r._isDuplicate = false;
        }

        if (r._isDuplicate) dupCount++;
      });
    } else if (targetModule === 'gangguan_records') {
      const gngSrcA = Array.isArray(window.SITAC_COLLO_DATA?.gangguan_records) ? window.SITAC_COLLO_DATA.gangguan_records : [];
      const gngSrcB = Array.isArray(state?.gangguan?.data) ? state.gangguan.data : [];
      const combined = [...gngSrcA, ...gngSrcB];

      const existingNos = new Set();
      const existingTermTgl = new Set();

      combined.forEach(g => {
        const t = String(g.no_tiket || '').trim().toUpperCase();
        if (t && !t.startsWith('TIKET-EMERGENCY')) existingNos.add(t);
        const term = String(g.terminating || '').trim().toUpperCase();
        const tgl = String(g.tgl_dispos || '').trim();
        if (term) existingTermTgl.add(`${term}|${tgl}`);
      });

      normalizedExcelRecords.forEach(r => {
        const k = String(r.no_tiket || '').trim().toUpperCase();
        const term = String(r.terminating || '').trim().toUpperCase();
        const tgl = String(r.tgl_dispos || '').trim();

        if (k && !k.startsWith('TIKET-EMERGENCY')) {
          r._isDuplicate = existingNos.has(k);
        } else if (term) {
          r._isDuplicate = existingTermTgl.has(`${term}|${tgl}`);
        } else {
          r._isDuplicate = false;
        }

        if (r._isDuplicate) dupCount++;
      });
    }

    const totalCount = normalizedExcelRecords.length;
    const newCount = totalCount - dupCount;
    const dupMode = document.getElementById('importDuplicateMode')?.value || 'skip';

    if (previewCount) previewCount.textContent = totalCount;
    if (dupBadge && dupCountEl) {
      if (dupCount > 0) {
        dupBadge.classList.remove('hidden');
        dupCountEl.textContent = dupCount;
      } else {
        dupBadge.classList.add('hidden');
      }
    }

    const newBadge = document.getElementById('importPreviewNewBadge');
    const newCountEl = document.getElementById('importPreviewNewCount');
    if (newBadge && newCountEl) {
      newBadge.classList.remove('hidden');
      newCountEl.textContent = newCount;
    }

    // Prominent Notification Alert Banner for Duplicates
    const bannerNotice = document.getElementById('importDuplicateNoticeBanner');
    if (bannerNotice) {
      if (dupCount === totalCount && totalCount > 0) {
        bannerNotice.className = 'p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 shadow-lg';
        bannerNotice.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation text-amber-400 text-lg shrink-0 mt-0.5"></i>
          <div class="leading-relaxed flex-1">
            <div class="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <strong class="text-amber-300 font-bold text-xs flex items-center gap-1.5">
                <i class="fa-solid fa-bell"></i> Pemberitahuan: Seluruh Data (${dupCount} Baris) Sudah Ada di Web!
              </strong>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/30 text-amber-200 border border-amber-500/40">100% Duplikat Terdeteksi</span>
            </div>
            <p class="text-slate-200 text-[11px] mb-2">
              Semua baris dalam file Excel ini telah terdaftar di database web.
            </p>
            <div class="text-[11px] bg-slate-900/80 p-2.5 rounded-lg border border-amber-500/20 text-slate-300 space-y-1.5">
              <div class="flex items-start gap-1.5">
                <i class="fa-solid fa-circle-info text-cyan-400 shrink-0 mt-0.5"></i>
                <span><strong>Opsi "Lewati Data Duplikat (Skip)":</strong> Sistem akan melewati semua baris ini sehingga <strong>0 data baru</strong> yang ditambahkan ke web.</span>
              </div>
              <div class="flex items-start gap-1.5">
                <i class="fa-solid fa-arrows-rotate text-emerald-400 shrink-0 mt-0.5"></i>
                <span><strong>Opsi "Perbarui / Timpa Data (Update/Merge)":</strong> Sistem akan memperbarui data yang sudah ada di web dengan nilai terbaru dari file Excel ini.</span>
              </div>
            </div>
          </div>
        `;
        bannerNotice.classList.remove('hidden');
        showToast(`Pemberitahuan: Seluruh ${dupCount} data dalam file Excel ini sudah ada di web!`, 'warning');
      } else if (dupCount > 0) {
        bannerNotice.className = 'p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-2.5 shadow-lg';
        bannerNotice.innerHTML = `
          <i class="fa-solid fa-circle-info text-cyan-400 text-base shrink-0 mt-0.5"></i>
          <div class="leading-relaxed flex-1">
            <strong class="text-cyan-300 font-bold text-xs block mb-0.5 flex items-center gap-1.5">
              <i class="fa-solid fa-bell"></i> Pemberitahuan: ${dupCount} Data Sudah Ada di Web, ${newCount} Data Baru
            </strong>
            <p class="text-slate-300 text-[11px]">
              Ditemukan <strong>${newCount} data baru</strong> yang akan ditambahkan ke sistem, dan <strong>${dupCount} data</strong> yang sudah tercatat di web (akan ${dupMode === 'update' ? '<span class="text-emerald-400 font-bold">diperbarui</span>' : '<span class="text-amber-400 font-bold">dilewati</span>'} sesuai opsi terpilih).
            </p>
          </div>
        `;
        bannerNotice.classList.remove('hidden');
        showToast(`Pemberitahuan: ${dupCount} data sudah ada di web, ${newCount} data baru siap diimpor.`, 'info');
      } else {
        bannerNotice.className = 'p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2';
        bannerNotice.innerHTML = `
          <i class="fa-solid fa-circle-check text-emerald-400 text-sm shrink-0"></i>
          <span><strong>Semua ${totalCount} data baru!</strong> Tidak ada data duplikat yang terdeteksi di database web.</span>
        `;
        bannerNotice.classList.remove('hidden');
      }
    }

    if (tableWrap) {
      const sample = normalizedExcelRecords.slice(0, 8);
      let headers = [];
      let rowRenderer = null;

      if (targetModule === 'sitac_records') {
        headers = ['#', 'Status di Web', 'No PA', 'Pelanggan', 'PTL', 'PIC SITAC', 'Biaya Awal', 'Biaya Final', 'Progress'];
        rowRenderer = (r, i) => `
          <tr class="border-b border-white/5 ${r._isDuplicate ? 'bg-amber-500/5' : ''}">
            <td class="p-1.5 text-slate-500">${i+1}</td>
            <td class="p-1.5">
              ${r._isDuplicate 
                ? '<span class="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 whitespace-nowrap"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> Sudah Ada</span>'
                : '<span class="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1 whitespace-nowrap"><i class="fa-solid fa-circle-plus text-[9px]"></i> Data Baru</span>'
              }
            </td>
            <td class="p-1.5 font-bold ${r._isDuplicate ? 'text-amber-200' : 'text-cyan-300'}">${escapeHtml(r.no_pa || '-')}</td>
            <td class="p-1.5 text-slate-200">${escapeHtml(r.pelanggan || '-')}</td>
            <td class="p-1.5 text-slate-400">${escapeHtml(r.ptl || '-')}</td>
            <td class="p-1.5 text-slate-300">${escapeHtml(r.pic_perijinan || '-')}</td>
            <td class="p-1.5 font-mono">${formatRupiah(r.biaya_permintaan_awal)}</td>
            <td class="p-1.5 font-mono text-emerald-400">${formatRupiah(r.biaya_final)}</td>
            <td class="p-1.5"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${r.progress === 'Finish' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'}">${escapeHtml(r.progress || 'Ongoing')}</span></td>
          </tr>
        `;
      } else if (targetModule === 'collo_records') {
        headers = ['#', 'Status di Web', 'Pengelola', 'Pelanggan', 'SID / SO', 'Jenis Sewa', 'Rev Sewa/Thn', 'Status'];
        rowRenderer = (r, i) => `
          <tr class="border-b border-white/5 ${r._isDuplicate ? 'bg-amber-500/5' : ''}">
            <td class="p-1.5 text-slate-500">${i+1}</td>
            <td class="p-1.5">
              ${r._isDuplicate 
                ? '<span class="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 whitespace-nowrap"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> Sudah Ada</span>'
                : '<span class="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1 whitespace-nowrap"><i class="fa-solid fa-circle-plus text-[9px]"></i> Data Baru</span>'
              }
            </td>
            <td class="p-1.5 font-bold text-slate-100">${escapeHtml(r.pengelola || '-')}</td>
            <td class="p-1.5 text-slate-200">${escapeHtml(r.pelanggan || '-')}</td>
            <td class="p-1.5 font-mono text-[10px] ${r._isDuplicate ? 'text-amber-200' : 'text-cyan-300'}">${escapeHtml(r.sid || '-')}<br>${escapeHtml(r.no_so || '-')}</td>
            <td class="p-1.5 text-slate-400">${escapeHtml(r.jenis_sewa || '-')}</td>
            <td class="p-1.5 font-mono text-emerald-400">${formatRupiah(r.rev_sewa_tahun)}</td>
            <td class="p-1.5"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${r.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}">${escapeHtml(r.status || 'ACTIVE')}</span></td>
          </tr>
        `;
      } else {
        headers = ['#', 'Status di Web', 'No Tiket', 'Tgl Dispos', 'Terminating / Rute', 'Jenis Gangguan', 'PIC Teknis', 'Biaya', 'Status'];
        rowRenderer = (r, i) => `
          <tr class="border-b border-white/5 ${r._isDuplicate ? 'bg-amber-500/5' : ''}">
            <td class="p-1.5 text-slate-500">${i+1}</td>
            <td class="p-1.5">
              ${r._isDuplicate 
                ? '<span class="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 whitespace-nowrap"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> Sudah Ada</span>'
                : '<span class="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1 whitespace-nowrap"><i class="fa-solid fa-circle-plus text-[9px]"></i> Data Baru</span>'
              }
            </td>
            <td class="p-1.5 font-bold ${r._isDuplicate ? 'text-amber-200' : 'text-rose-400'}">${escapeHtml(r.no_tiket || '-')}</td>
            <td class="p-1.5 text-slate-400">${escapeHtml(r.tgl_dispos || '-')}</td>
            <td class="p-1.5 text-slate-200">${escapeHtml(r.terminating || '-')}</td>
            <td class="p-1.5 text-slate-300">${escapeHtml(r.jenis_gangguan || '-')}</td>
            <td class="p-1.5 text-slate-300">${escapeHtml(r.pic_perijinan || '-')}</td>
            <td class="p-1.5 font-mono text-rose-300">${formatRupiah(r.biaya_gangguan)}</td>
            <td class="p-1.5"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${r.is_selesai ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">${r.is_selesai ? 'Selesai' : 'Open'}</span></td>
          </tr>
        `;
      }

      tableWrap.innerHTML = `
        <table class="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr class="bg-slate-900 border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              ${headers.map(h => `<th class="p-1.5">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${sample.map(rowRenderer).join('')}
          </tbody>
        </table>
        ${normalizedExcelRecords.length > sample.length ? `<div class="text-[10px] text-slate-400 p-1.5 text-center bg-slate-900/70 border-t border-white/5">+ ${normalizedExcelRecords.length - sample.length} baris lainnya (${dupCount} sudah ada di web, ${newCount} data baru)...</div>` : ''}
      `;
    }

    if (previewBox) previewBox.classList.remove('hidden');
    if (submitBtn) {
      submitBtn.disabled = totalCount === 0;
      if (totalCount > 0) {
        if (dupMode === 'skip') {
          if (newCount === 0) {
            submitBtn.innerHTML = `<i class="fa-solid fa-ban mr-1.5 text-amber-400"></i> Proses Impor (0 Baru, ${dupCount} Sudah Ada)`;
          } else {
            submitBtn.innerHTML = `<i class="fa-solid fa-file-import mr-1.5"></i> Impor ${newCount} Data Baru (${dupCount} Dilewati)`;
          }
        } else {
          submitBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate mr-1.5"></i> Perbarui & Impor ${totalCount} Data (${dupCount} di Web Ditimpa)`;
        }
      }
    }
  }

  window.triggerExcelImportPreview = function(rows, module) {
    rawExcelRows = rows || [];
    renderImportPreviewTable(module || 'sitac_records');
  };

  function setupExcelImportHandlers() {
    const fileInput = document.getElementById('importExcelFileInput');
    const label = document.getElementById('importFileNameLabel');
    const targetSelect = document.getElementById('importTargetModule');
    const btnTemplate = document.getElementById('btnDownloadImportTemplate');
    const dropzone = document.getElementById('importDropzoneBox');

    // Download template handler
    if (btnTemplate) {
      btnTemplate.addEventListener('click', () => {
        downloadImportTemplate(targetSelect?.value || 'sitac_records');
      });
    }

    // Change target module handler -> refresh preview if file loaded
    if (targetSelect) {
      targetSelect.addEventListener('change', () => {
        if (rawExcelRows && rawExcelRows.length > 0) {
          renderImportPreviewTable(targetSelect.value);
        }
      });
    }

    // Change duplicate mode handler -> refresh preview & alerts in real-time
    const dupModeSelect = document.getElementById('importDuplicateMode');
    if (dupModeSelect) {
      dupModeSelect.addEventListener('change', () => {
        if (rawExcelRows && rawExcelRows.length > 0) {
          renderImportPreviewTable(targetSelect?.value || 'sitac_records');
        }
      });
    }

    // Drag and Drop helpers
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('border-emerald-400', 'bg-emerald-950/20');
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('border-emerald-400', 'bg-emerald-950/20');
        });
      });
      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          fileInput.files = files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }

    // Cancel & Reset chosen Excel file
    const resetExcelImportSelection = (silent = false) => {
      if (fileInput) fileInput.value = '';
      rawExcelRows = [];
      normalizedExcelRecords = [];

      if (label) label.textContent = 'Klik atau tarik file Excel ke sini';
      if (dropzone) {
        dropzone.classList.remove('border-emerald-500', 'bg-emerald-950/20');
        dropzone.classList.add('border-white/10');
      }

      const btnCancelDropzone = document.getElementById('btnCancelImportFile');
      const btnCancelLabel = document.getElementById('btnCancelImportFileLabel');
      const btnCancelPreview = document.getElementById('btnCancelImportPreview');
      if (btnCancelDropzone) btnCancelDropzone.classList.add('hidden');
      if (btnCancelLabel) btnCancelLabel.classList.add('hidden');
      if (btnCancelPreview) btnCancelPreview.classList.add('hidden');

      const previewContainer = document.getElementById('importPreviewContainer');
      if (previewContainer) previewContainer.classList.add('hidden');

      const previewTableWrap = document.getElementById('importPreviewTableWrap');
      if (previewTableWrap) previewTableWrap.innerHTML = '';

      const noticeBanner = document.getElementById('importDuplicateNoticeBanner');
      if (noticeBanner) {
        noticeBanner.classList.add('hidden');
        noticeBanner.innerHTML = '';
      }

      const dupBadge = document.getElementById('importPreviewDupBadge');
      const newBadge = document.getElementById('importPreviewNewBadge');
      if (dupBadge) dupBadge.classList.add('hidden');
      if (newBadge) newBadge.classList.add('hidden');

      const submitBtn = document.getElementById('btnSubmitImportExcel');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-1.5"></i> Impor Data Sekarang';
      }

      if (!silent) {
        showToast('File yang dipilih berhasil dibatalkan', 'info');
      }
    };

    // Attach cancel click handlers (with stopPropagation so dropzone click is not triggered)
    document.getElementById('btnCancelImportFile')?.addEventListener('click', (e) => {
      e.stopPropagation();
      resetExcelImportSelection();
    });
    document.getElementById('btnCancelImportFileLabel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      resetExcelImportSelection();
    });
    document.getElementById('btnCancelImportPreview')?.addEventListener('click', (e) => {
      e.stopPropagation();
      resetExcelImportSelection();
    });

    // File Input change handler
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (typeof XLSX === 'undefined') {
          showToast('Menyiapkan parser Excel...', 'info');
          try { await ensureXlsxLoaded(); } catch(e) {}
        }

        if (label) label.textContent = `File terpilih: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        
        // Show cancel buttons
        const btnCancelDropzone = document.getElementById('btnCancelImportFile');
        const btnCancelLabel = document.getElementById('btnCancelImportFileLabel');
        const btnCancelPreview = document.getElementById('btnCancelImportPreview');
        if (btnCancelDropzone) btnCancelDropzone.classList.remove('hidden');
        if (btnCancelLabel) btnCancelLabel.classList.remove('hidden');
        if (btnCancelPreview) btnCancelPreview.classList.remove('hidden');
        if (dropzone) {
          dropzone.classList.add('border-emerald-500', 'bg-emerald-950/20');
          dropzone.classList.remove('border-white/10');
        }
        
        const reader = new FileReader();
        reader.onload = function(evt) {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
            const cleanedRows = (jsonRows || []).filter(row => {
              if (!row || typeof row !== 'object') return false;
              return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
            });

            if (!cleanedRows || cleanedRows.length === 0) {
              alert('File Excel kosong atau tidak memiliki baris data.');
              resetExcelImportSelection(true);
              return;
            }

            rawExcelRows = cleanedRows;
            renderImportPreviewTable(targetSelect?.value || 'sitac_records');

          } catch (err) {
            console.error('Error reading excel file:', err);
            alert('Gagal membaca file Excel: ' + err.message);
            resetExcelImportSelection(true);
          }
        };
        reader.readAsArrayBuffer(file);
      });
    }

    // Submit Form Import Batch
    document.getElementById('formImportExcel')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!normalizedExcelRecords || normalizedExcelRecords.length === 0) {
        alert('Pilih file Excel terlebih dahulu.');
        return;
      }

      const targetModule = targetSelect?.value || 'sitac_records';
      const mode = document.getElementById('importDuplicateMode')?.value || 'skip';
      const submitBtn = document.getElementById('btnSubmitImportExcel');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      const progBox = document.getElementById('importProgressContainer');
      const progMsg = document.getElementById('importProgressMsg');
      const progPct = document.getElementById('importProgressPct');
      const progBar = document.getElementById('importProgressBar');
      const resultAlert = document.getElementById('importResultAlert');

      // Duplicate check & user confirmation prompt
      const dupCount = (normalizedExcelRecords || []).filter(r => r._isDuplicate).length;
      const newCount = (normalizedExcelRecords || []).length - dupCount;

      if (mode === 'skip' && dupCount === normalizedExcelRecords.length && dupCount > 0) {
        const proceed = confirm(`PEMBERITAHUAN DATA SUDAH ADA DI WEB:\n\nSeluruh ${dupCount} baris data pada file Excel ini SUDAH ADA di dalam database web.\n\nKarena Anda memilih opsi "Lewati Data Duplikat (Skip)", maka 0 data baru yang akan ditambahkan ke web.\n\nApakah Anda ingin tetap melanjutkan (0 data baru)?\n\n(Pilih 'Cancel' jika Anda ingin mengubah opsi ke 'Perbarui / Timpa Data (Update/Merge)' agar data yang sudah ada diupdate)`);
        if (!proceed) return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Mengimpor...';
      }

      if (progBox) progBox.classList.remove('hidden');
      if (progMsg) progMsg.textContent = `Memproses ${normalizedExcelRecords.length} baris data...`;
      if (progPct) progPct.textContent = '30%';
      if (progBar) progBar.style.width = '30%';
      if (resultAlert) resultAlert.classList.add('hidden');

      try {
        let resData = null;

        // 1. Send to REST API (Server Python SQLite)
        if (!isStaticMode()) {
          const res = await fetch('/api/import/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              module: targetModule,
              mode: mode,
              records: normalizedExcelRecords
            })
          });
          resData = await res.json();
          if (!res.ok || !resData.success) {
            throw new Error(resData.message || 'Gagal mengimpor ke server backend');
          }
        }

        if (progPct) progPct.textContent = '80%';
        if (progBar) progBar.style.width = '80%';

        // 2. Dual-Sync to Google Cloud Firestore if configured
        if (window.FirebaseManager && window.FirebaseManager.isConfigured() && typeof window.FirebaseManager.batchImportRecords === 'function') {
          try {
            await window.FirebaseManager.batchImportRecords(targetModule, normalizedExcelRecords);
          } catch (fbErr) {
            console.warn('Firestore background import notice:', fbErr);
          }
        }

        // 2b. Dual-Sync to Supabase Cloud PostgreSQL
        if (window.SupabaseManager) {
          try {
            const cl = window.SupabaseManager.getClient();
            if (cl) {
              await cl.from(targetModule).upsert(normalizedExcelRecords);
            }
          } catch (sbErr) {
            console.warn('[Supabase Batch Import Notice]:', sbErr);
          }
        }

        // 3. Update local in-memory dataset with smart matching
        const colKey = targetModule === 'sitac_records' ? 'sitac_records' : (targetModule === 'collo_records' ? 'collo_records' : 'gangguan_records');
        if (window.SITAC_COLLO_DATA && window.SITAC_COLLO_DATA[colKey]) {
          const isGeneric = (val) => {
            const v = String(val || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
            return !v || v === 'NONPA' || v === 'NOPA' || v === 'NON' || v === '';
          };

          const matchItem = (item, r) => {
            if (targetModule === 'sitac_records') {
              const k1 = String(item.no_pa || '').trim().toUpperCase();
              const k2 = String(r.no_pa || '').trim().toUpperCase();
              if (k1 && k2 && !isGeneric(k1) && !isGeneric(k2)) {
                return k1 === k2;
              }
              const p1 = String(item.pelanggan || '').trim().toUpperCase();
              const p2 = String(r.pelanggan || '').trim().toUpperCase();
              const t1 = String(item.terminating || '').trim().toUpperCase();
              const t2 = String(r.terminating || '').trim().toUpperCase();
              return p1 && p2 && t1 && t2 && p1 === p2 && t1 === t2;
            } else if (targetModule === 'collo_records') {
              const s1 = String(item.sid || '').trim().toUpperCase();
              const s2 = String(r.sid || '').trim().toUpperCase();
              const so1 = String(item.no_so || '').trim().toUpperCase();
              const so2 = String(r.no_so || '').trim().toUpperCase();
              if (s1 && s2 && so1 && so2) return s1 === s2 && so1 === so2;
              if (s1 && s2) return s1 === s2;
              if (so1 && so2) return so1 === so2;
              const p1 = String(item.pelanggan || '').trim().toUpperCase();
              const p2 = String(r.pelanggan || '').trim().toUpperCase();
              const t1 = String(item.terminating || '').trim().toUpperCase();
              const t2 = String(r.terminating || '').trim().toUpperCase();
              return p1 && p2 && t1 && t2 && p1 === p2 && t1 === t2;
            } else {
              const t1 = String(item.no_tiket || '').trim().toUpperCase();
              const t2 = String(r.no_tiket || '').trim().toUpperCase();
              if (t1 && t2 && !t1.startsWith('TIKET-EMERGENCY') && !t2.startsWith('TIKET-EMERGENCY')) {
                return t1 === t2;
              }
              const term1 = String(item.terminating || '').trim().toUpperCase();
              const term2 = String(r.terminating || '').trim().toUpperCase();
              return term1 && term2 && term1 === term2;
            }
          };

          if (mode === 'update') {
            normalizedExcelRecords.forEach(r => {
              const existingIdx = window.SITAC_COLLO_DATA[colKey].findIndex(item => matchItem(item, r));
              if (existingIdx !== -1) {
                Object.assign(window.SITAC_COLLO_DATA[colKey][existingIdx], r);
              } else {
                window.SITAC_COLLO_DATA[colKey].unshift({ id: Date.now() + Math.floor(Math.random() * 1000), ...r });
              }
            });
          } else {
            // mode === 'skip': add only new
            normalizedExcelRecords.forEach(r => {
              const exists = window.SITAC_COLLO_DATA[colKey].some(item => matchItem(item, r));
              if (!exists) {
                window.SITAC_COLLO_DATA[colKey].unshift({ id: Date.now() + Math.floor(Math.random() * 1000), ...r });
              }
            });
          }
        }

        if (progPct) progPct.textContent = '100%';
        if (progBar) progBar.style.width = '100%';

        let summaryMsg = '';
        if (mode === 'update') {
          summaryMsg = resData?.message || `Pemberitahuan: Selesai memproses ${normalizedExcelRecords.length} data (${dupCount} data di web berhasil diperbarui, ${newCount} data baru ditambahkan).`;
        } else {
          summaryMsg = resData?.message || `Pemberitahuan: ${newCount} data baru berhasil ditambahkan ke web (${dupCount} data dilewati karena sudah ada di web).`;
        }
        showToast(summaryMsg, 'success');

        if (resultAlert) {
          resultAlert.className = 'p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium text-xs flex items-center gap-2 mt-2';
          resultAlert.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 text-base"></i> <span>${escapeHtml(summaryMsg)}</span>`;
          resultAlert.classList.remove('hidden');
        }

        // Refresh UI views
        if (targetModule === 'sitac_records') {
          await loadSitacData();
          if (leafletMap && mapMarkersLayer) updateMapMarkers();
        } else if (targetModule === 'collo_records') {
          await loadColloData();
          fetchExpiringContracts(true);
        } else if (targetModule === 'gangguan_records') {
          await loadGangguanData();
        }
        await loadExecutiveSummary();

        setTimeout(() => {
          document.getElementById('modalImportExcel').style.display = 'none';
          if (resultAlert) resultAlert.classList.add('hidden');
          if (progBox) progBox.classList.add('hidden');
          if (label) label.textContent = 'Klik atau tarik file Excel ke sini';
          document.getElementById('importPreviewContainer')?.classList.add('hidden');
          rawExcelRows = [];
          normalizedExcelRecords = [];
        }, 1800);

      } catch (err) {
        console.error('Import batch error:', err);
        showToast('Gagal mengimpor Excel: ' + err.message, 'error');
        alert('Gagal mengimpor Excel: ' + err.message);
        if (progBox) progBox.classList.add('hidden');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
      }
    });
  }

  // =========================================================================
  // 21. EXECUTIVE OVERVIEW PERIOD FILTER HELPERS
  // =========================================================================
  function setupExecutivePeriodFilter() {
    const pillContainer = document.getElementById('execPeriodQuickPills');
    const periodSelect = document.getElementById('execFilterPeriod');
    const customWrap = document.getElementById('execCustomDateWrap');
    const btnApplyCustom = document.getElementById('btnApplyExecCustomDate');

    const curYear = new Date().getFullYear();
    const maxYear = Math.max(2026, curYear);
    const startYear = 2024;
    const currentVal = state.execFilter?.period || 'ALL';

    // 1. Dynamic generation of quick period pills (auto-adds new years like 2027 when current year advances)
    if (pillContainer) {
      let pillsHtml = `<button type="button" class="exec-period-pill ${currentVal === 'ALL' ? 'active' : ''}" data-period="ALL">Semua Periode</button>`;
      for (let y = startYear; y <= maxYear; y++) {
        const isActive = currentVal === String(y) ? 'active' : '';
        pillsHtml += `<button type="button" class="exec-period-pill ${isActive}" data-period="${y}">${y}</button>`;
      }
      pillContainer.innerHTML = pillsHtml;

      const quickPeriodPills = pillContainer.querySelectorAll('.exec-period-pill');
      quickPeriodPills.forEach(pill => {
        pill.addEventListener('click', () => {
          const pVal = pill.getAttribute('data-period');
          quickPeriodPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          if (periodSelect && periodSelect.value !== pVal) {
            periodSelect.value = pVal;
            periodSelect.dispatchEvent(new Event('change'));
          }
        });
      });
    }

    // 2. Dynamic generation of select options with automatic '(Tahun Berjalan)' label
    if (periodSelect) {
      let optionsHtml = `<option value="ALL" ${currentVal === 'ALL' ? 'selected' : ''}>Semua Periode (Akumulasi)</option>`;
      for (let y = startYear; y <= maxYear; y++) {
        const isRunning = (y === curYear) ? ' (Tahun Berjalan)' : '';
        optionsHtml += `<option value="${y}" ${currentVal === String(y) ? 'selected' : ''}>Tahun ${y}${isRunning}</option>`;
      }
      optionsHtml += `<option value="CUSTOM" ${currentVal === 'CUSTOM' ? 'selected' : ''}>Rentang Tanggal Custom...</option>`;
      periodSelect.innerHTML = optionsHtml;

      periodSelect.addEventListener('change', () => {
        const val = periodSelect.value;
        const quickPeriodPills = document.querySelectorAll('#execPeriodQuickPills .exec-period-pill');
        quickPeriodPills.forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-period') === val);
        });

        if (val === 'CUSTOM') {
          if (customWrap) customWrap.classList.remove('hidden');
          if (customWrap) customWrap.classList.add('flex');
        } else {
          if (customWrap) customWrap.classList.add('hidden');
          if (customWrap) customWrap.classList.remove('flex');
          applyExecutivePeriodFilter(val);
        }
      });
    }

    if (btnApplyCustom) {
      btnApplyCustom.addEventListener('click', () => {
        const dStart = document.getElementById('execDateStart').value;
        const dEnd = document.getElementById('execDateEnd').value;
        if (!dStart || !dEnd) {
          alert('Silakan tentukan tanggal mulai dan tanggal selesai');
          return;
        }
        applyExecutivePeriodFilter('CUSTOM', dStart, dEnd);
      });
    }
  }

  function applyExecutivePeriodFilter(period, startStr, endStr) {
    const curYear = new Date().getFullYear();
    let label = period;
    if (period === 'ALL') {
      label = 'Semua Periode (Akumulasi)';
    } else if (period === 'CUSTOM') {
      label = `Rentang Khusus (${startStr} s/d ${endStr})`;
    } else if (!isNaN(Number(period))) {
      const y = Number(period);
      label = (y === curYear) ? `Tahun ${y} (Tahun Berjalan)` : `Tahun ${y}`;
    }
    state.execFilter = {
      period: period,
      startDate: startStr || '',
      endDate: endStr || ''
    };
    showToast(`Filter periode Executive disesuaikan: ${label}`, 'info');
    loadExecutiveSummary();
  }

  // =========================================================================
  // WHATSAPP DISPATCH MODAL HANDLERS
  // =========================================================================
  function initWhatsAppModalListeners() {
    const modal = document.getElementById('modalWhatsAppDispatch');
    const btnClose = document.getElementById('btnCloseWaModal');
    const btnCloseFooter = document.getElementById('btnWaCloseModal');
    const btnCopy = document.getElementById('btnWaCopyMessage');
    const btnOpen = document.getElementById('btnWaOpenApp');
    const phoneInput = document.getElementById('waTargetPhone');
    const textArea = document.getElementById('waMessageText');

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    btnClose?.addEventListener('click', closeModal);
    btnCloseFooter?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    btnCopy?.addEventListener('click', async () => {
      const text = textArea?.value || '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Pesan berhasil disalin ke clipboard! Siap ditempel ke WA.', 'success');
      } catch (err) {
        if (textArea) {
          textArea.select();
          document.execCommand('copy');
          showToast('Pesan berhasil disalin!', 'success');
        }
      }
    });

    btnOpen?.addEventListener('click', () => {
      const text = textArea?.value || '';
      const rawPhone = phoneInput?.value?.trim() || '';
      const phone = cleanPhoneNumber(rawPhone);
      let waUrl = '';
      if (phone) {
        waUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`;
      } else {
        waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      }
      window.open(waUrl, '_blank');
    });
  }

  // =========================================================================
  // UNIVERSAL GLOBAL SEARCH & COMMAND PALETTE (CTRL+K)
  // =========================================================================
  let globalSearchDebounceTimer = null;
  let globalSearchCurrentFilter = 'ALL';
  let globalSearchResults = [];
  let globalSearchSelectedIndex = -1;

  function initGlobalSearch() {
    const btnTrigger = document.getElementById('btnOpenGlobalSearch');
    const btnTriggerMobile = document.getElementById('btnOpenGlobalSearchMobile');
    const modal = document.getElementById('modalGlobalSearch');
    const input = document.getElementById('globalSearchInput');
    const btnClear = document.getElementById('btnGlobalSearchClear');
    const btnEscKbd = document.getElementById('btnCloseGlobalSearchKbd');
    const filterTabsContainer = document.getElementById('globalSearchFilterTabs');
    const resultsContainer = document.getElementById('globalSearchResultsList');

    const toggleModal = (show) => {
      if (!modal) return;
      if (show) {
        modal.style.display = 'flex';
        input?.focus();
        input?.select();
        runSearch();
      } else {
        modal.style.display = 'none';
        globalSearchSelectedIndex = -1;
      }
    };

    btnTrigger?.addEventListener('click', () => toggleModal(true));
    btnTriggerMobile?.addEventListener('click', () => toggleModal(true));
    btnEscKbd?.addEventListener('click', () => toggleModal(false));
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) toggleModal(false);
    });

    // Global keyboard shortcut: Ctrl+K / Cmd+K and Escape
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggleModal(modal.style.display === 'none');
      } else if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
        toggleModal(false);
      }
    });

    // Clear button
    btnClear?.addEventListener('click', () => {
      if (input) {
        input.value = '';
        btnClear.classList.add('hidden');
        input.focus();
        runSearch();
      }
    });

    // Filter tabs
    filterTabsContainer?.addEventListener('click', (e) => {
      const tab = e.target.closest('.global-search-tab');
      if (!tab) return;
      const filter = tab.getAttribute('data-filter') || 'ALL';
      globalSearchCurrentFilter = filter;

      // Update tab active styling
      filterTabsContainer.querySelectorAll('.global-search-tab').forEach(t => {
        t.className = 'global-search-tab px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/60 text-slate-400 hover:text-white border border-white/5';
      });
      tab.className = 'global-search-tab px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';

      runSearch();
    });

    // Reactive input debounced
    input?.addEventListener('input', () => {
      if (btnClear) {
        if (input.value.length > 0) btnClear.classList.remove('hidden');
        else btnClear.classList.add('hidden');
      }
      clearTimeout(globalSearchDebounceTimer);
      globalSearchDebounceTimer = setTimeout(runSearch, 120);
    });

    // Keyboard navigation in search results: ArrowUp, ArrowDown, Enter
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateResults(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateResults(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (globalSearchSelectedIndex >= 0 && globalSearchResults[globalSearchSelectedIndex]) {
          selectSearchResult(globalSearchResults[globalSearchSelectedIndex]);
        }
      }
    });

    function navigateResults(delta) {
      if (globalSearchResults.length === 0) return;
      globalSearchSelectedIndex += delta;
      if (globalSearchSelectedIndex < 0) globalSearchSelectedIndex = globalSearchResults.length - 1;
      if (globalSearchSelectedIndex >= globalSearchResults.length) globalSearchSelectedIndex = 0;

      const items = resultsContainer.querySelectorAll('.global-search-result-item');
      items.forEach((item, idx) => {
        if (idx === globalSearchSelectedIndex) {
          item.classList.add('active-search-item');
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          item.classList.remove('active-search-item');
        }
      });
    }

    function runSearch() {
      const q = (input?.value || '').trim().toLowerCase();
      const countEl = document.getElementById('globalSearchResultCount');
      globalSearchSelectedIndex = -1;

      if (q.length < 2) {
        globalSearchResults = [];
        if (countEl) countEl.textContent = '0 hasil';
        resultsContainer.innerHTML = `
          <div class="py-12 text-center text-slate-500">
            <i class="fa-solid fa-keyboard text-3xl mb-2 text-slate-600 block"></i>
            <p class="text-xs">Ketik minimal 2 huruf untuk mencari No SO, SID, Pelanggan, Site, PA, atau PIC</p>
          </div>
        `;
        return;
      }

      const colloSource = state.collo?.data?.length ? state.collo.data : (window.SITAC_COLLO_DATA?.collo_records || []);
      const sitacSource = state.sitac?.data?.length ? state.sitac.data : (window.SITAC_COLLO_DATA?.sitac_records || []);

      const results = [];

      // Search Colocation
      if (globalSearchCurrentFilter === 'ALL' || globalSearchCurrentFilter === 'COLLO') {
        colloSource.forEach(item => {
          const sid = String(item.sid || '').toLowerCase();
          const so = String(item.no_so || '').toLowerCase();
          const pel = String(item.pelanggan || '').toLowerCase();
          const site = String(item.site || '').toLowerCase();
          const peng = String(item.pengelola || '').toLowerCase();
          const lay = String(item.layanan || item.jenis_sewa || '').toLowerCase();

          if (sid.includes(q) || so.includes(q) || pel.includes(q) || site.includes(q) || peng.includes(q) || lay.includes(q)) {
            let score = 0;
            if (sid === q || so === q) score += 100;
            else if (sid.startsWith(q) || so.startsWith(q)) score += 50;
            else if (pel.includes(q)) score += 30;
            else score += 10;

            results.push({
              module: 'collo',
              id: item.id,
              score,
              title: `SID: ${item.sid || '-'} | SO: ${item.no_so || '-'}`,
              pelanggan: item.pelanggan || '-',
              detail: `${item.pengelola || '-'} • ${item.site || item.terminating || 'Titik Sirkuit'}`,
              status: item.status || 'ACTIVE',
              amount: formatRupiah(item.biaya_sewa_tahun || item.rev_sewa_tahun),
              rawItem: item
            });
          }
        });
      }

      // Search SITAC
      if (globalSearchCurrentFilter === 'ALL' || globalSearchCurrentFilter === 'SITAC') {
        sitacSource.forEach(item => {
          const pa = String(item.no_pa || '').toLowerCase();
          const pel = String(item.pelanggan || '').toLowerCase();
          const pic = String(item.pic_perijinan || '').toLowerCase();
          const term = String(item.terminating || '').toLowerCase();
          const prog = String(item.progress || '').toLowerCase();

          if (pa.includes(q) || pel.includes(q) || pic.includes(q) || term.includes(q) || prog.includes(q)) {
            let score = 0;
            if (pa === q) score += 100;
            else if (pa.startsWith(q)) score += 50;
            else if (pel.includes(q)) score += 30;
            else score += 10;

            results.push({
              module: 'sitac',
              id: item.id,
              score,
              title: `PA: ${item.no_pa || '-'}`,
              pelanggan: item.pelanggan || '-',
              detail: `PIC: ${formatPicName(item.pic_perijinan || '-')} • ${item.terminating || '-'}`,
              status: item.progress || 'Ongoing',
              amount: formatRupiah(item.biaya_final || item.biaya_permintaan_awal),
              rawItem: item
            });
          }
        });
      }

      // Sort by score desc, then slice to top 30
      results.sort((a, b) => b.score - a.score);
      globalSearchResults = results.slice(0, 30);

      if (countEl) countEl.textContent = `${globalSearchResults.length} hasil ditemukan`;

      if (globalSearchResults.length === 0) {
        resultsContainer.innerHTML = `
          <div class="py-12 text-center text-slate-500">
            <i class="fa-solid fa-magnifying-glass text-3xl mb-2 text-slate-600 block"></i>
            <p class="text-xs">Tidak ditemukan data yang cocok dengan kata kunci "<strong>${escapeHtml(input.value)}</strong>"</p>
          </div>
        `;
        return;
      }

      const highlight = (text, term) => {
        if (!text || !term) return escapeHtml(text || '-');
        const escaped = escapeHtml(String(text));
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return escaped.replace(regex, '<mark>$1</mark>');
      };

      let html = '';
      globalSearchResults.forEach((res, idx) => {
        const isCollo = res.module === 'collo';
        const iconClass = isCollo ? 'fa-server text-cyan-400 bg-cyan-500/10 border-cyan-500/20' : 'fa-file-signature text-amber-400 bg-amber-500/10 border-amber-500/20';
        const badgeModule = isCollo ? '<span class="text-[9px] uppercase font-bold text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.5 rounded">Colocation</span>' : '<span class="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded">SITAC</span>';
        
        html += `
          <div class="global-search-result-item ${idx === 0 ? 'active-search-item' : ''}" data-index="${idx}">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${iconClass}">
                <i class="fa-solid ${iconClass.split(' ')[0]} text-sm"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  ${badgeModule}
                  <strong class="text-xs text-white font-mono">${highlight(res.title, q)}</strong>
                  <span class="text-[10px] text-slate-400 font-semibold truncate">• ${highlight(res.pelanggan, q)}</span>
                </div>
                <div class="text-[11px] text-slate-400 truncate mt-0.5">${highlight(res.detail, q)}</div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-xs font-bold font-mono ${isCollo ? 'text-cyan-400' : 'text-emerald-400'}">${res.amount}</div>
              <span class="text-[10px] font-semibold text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded border border-white/5 mt-0.5 inline-block">${escapeHtml(res.status)}</span>
            </div>
          </div>
        `;
      });

      resultsContainer.innerHTML = html;
      globalSearchSelectedIndex = 0;

      // Click to select
      resultsContainer.querySelectorAll('.global-search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.getAttribute('data-index'), 10);
          if (globalSearchResults[idx]) {
            selectSearchResult(globalSearchResults[idx]);
          }
        });
      });
    }

    function selectSearchResult(item) {
      toggleModal(false);
      if (item.module === 'collo') {
        switchView('view-collo-list');
        setTimeout(() => {
          openDetailModal('collo', item.id);
        }, 150);
      } else if (item.module === 'sitac') {
        switchView('view-sitac-pa');
        setTimeout(() => {
          openDetailModal('sitac', item.id);
        }, 150);
      }
    }
  }

  // Expose global modal and map helpers for popups & inline actions
  window.openDetailModal = openDetailModal;
  window.openWhatsAppDispatchModal = openWhatsAppDispatchModal;
  window.openQuickEditModal = openQuickEditModal;
  window.updateMapMarkers = updateMapMarkers;

  // Launch immediately if DOM body is available, avoiding unnecessary DOMContentLoaded wait
  if (document.body && document.getElementById('view-executive')) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
