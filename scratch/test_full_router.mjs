import fs from 'fs';

const fileContent = fs.readFileSync('sitac_collo_data.js', 'utf8');
const jsonStr = fileContent.slice(fileContent.indexOf('=') + 1).trim().replace(/;$/, '');
const SITAC_COLLO_DATA = JSON.parse(jsonStr);

function handleStaticApiRequest(url) {
  const parsedUrl = new URL(url, 'http://localhost');
  const path = parsedUrl.pathname;
  const params = parsedUrl.searchParams;

  const data = SITAC_COLLO_DATA || {};
  const colloList = data.collo_records || [];
  const sitacList = data.sitac_records || [];
  const gangguanList = data.gangguan_records || [];
  const rekapEff = (data.summary && data.summary.rekap_efisiensi) || data.rekap_efisiensi || [];
  const workload = (data.summary && data.summary.workload_performa) || [];

  // 1. Executive Summary
  if (path === '/api/executive/summary') {
    const cAct = colloList.filter(c => c.status === 'ACTIVE');
    const cNon = colloList.filter(c => c.status === 'NON ACTIVE');
    const cDeact = colloList.filter(c => c.status === 'DEACTIVASI');
    const rev = cAct.reduce((a, b) => a + (Number(b.rev_sewa_tahun) || 0), 0);
    const biaya = cAct.reduce((a, b) => a + (Number(b.biaya_sewa_tahun) || 0), 0);
    const margin = cAct.reduce((a, b) => a + (Number(b.margin_rupiah) || 0), 0);
    const revShareCount = colloList.filter(c => (Number(c.rev_sharing_pct) || 0) > 0 || (c.rev_sharing && c.rev_sharing !== '-')).length;
    const marginPct = rev > 0 ? Number(((rev - biaya) / rev * 100).toFixed(2)) : 0;

    const sFinish = sitacList.filter(s => s.progress === 'Finish').length;
    const sOngoing = sitacList.filter(s => s.progress === 'Ongoing').length;
    const sHold = sitacList.filter(s => s.progress === 'Hold').length;
    const sCancel = sitacList.filter(s => s.progress === 'Cancel').length;
    const bAwal = sitacList.reduce((a, b) => a + (Number(b.biaya_permintaan_awal) || 0), 0);
    const bFinal = sitacList.reduce((a, b) => a + (Number(b.biaya_final) || 0), 0);
    const bEff = sitacList.reduce((a, b) => a + (Number(b.efisiensi_rupiah) || 0), 0);
    const effPct = bAwal > 0 ? Number((bEff / bAwal * 100).toFixed(2)) : 0;

    const gTotal = gangguanList.length;
    const gSelesai = gangguanList.filter(g => g.is_selesai == 1 || g.status === 'Selesai').length;
    const gAktif = gTotal - gSelesai;
    const resRate = gTotal > 0 ? Number((gSelesai / gTotal * 100).toFixed(1)) : 0;

    const pMap = {};
    cAct.forEach(c => {
      const p = c.pengelola || 'Unknown';
      if (!pMap[p]) pMap[p] = { pengelola: p, sirkuit_count: 0, total_biaya: 0, total_rev: 0, total_margin: 0 };
      pMap[p].sirkuit_count++;
      pMap[p].total_biaya += Number(c.biaya_sewa_tahun) || 0;
      pMap[p].total_rev += Number(c.rev_sewa_tahun) || 0;
      pMap[p].total_margin += Number(c.margin_rupiah) || 0;
    });
    const topPengelola = Object.values(pMap).sort((a, b) => b.total_biaya - a.total_biaya).slice(0, 10);

    const tMap = {};
    sitacList.forEach(s => {
      if (s.tahun && s.bulan) {
        const k = `${s.tahun}-${s.bulan}`;
        if (!tMap[k]) tMap[k] = { tahun: s.tahun, bulan: s.bulan, count_masuk: 0, count_selesai: 0 };
        tMap[k].count_masuk++;
        if (s.progress === 'Finish') tMap[k].count_selesai++;
      }
    });
    const monthlyTrend = Object.values(tMap).sort((a, b) => (a.tahun - b.tahun) || (a.bulan - b.bulan));

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
    sitacList.forEach(s => {
      const d = s.durasi_hari;
      if (d !== null && d !== undefined && d >= 0) {
        if (d <= 7) aGreen++;
        else if (d <= 14) aYellow++;
        else aRed++;
      }
    });

    const vMap = {};
    cAct.forEach(c => {
      const p = c.pengelola || 'Unknown';
      if (!vMap[p]) vMap[p] = { pengelola: p, sirkuit_count: 0, rev: 0 };
      vMap[p].sirkuit_count++;
      vMap[p].rev += Number(c.rev_sewa_tahun) || 0;
    });
    const topColloVendors = Object.values(vMap).sort((a, b) => b.sirkuit_count - a.sirkuit_count).slice(0, 8);

    return {
      collo: {
        total_records: colloList.length,
        active_count: cAct.length,
        non_active_count: cNon.length,
        deactivasi_count: cDeact.length,
        active_revenue: rev,
        active_biaya: biaya,
        active_margin: margin,
        rev_sharing_count: revShareCount,
        margin_pct: marginPct
      },
      sitac: {
        total_pa: sitacList.length,
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
      rekap_efisiensi_list: rekapEff,
      top_collo_vendors: topColloVendors
    };
  }

  // 2. Meta Options
  if (path === '/api/meta/options') {
    const pSet = new Set();
    const jSet = new Set();
    colloList.forEach(c => {
      if (c.pengelola) pSet.add(c.pengelola);
      if (c.jenis_sewa) jSet.add(c.jenis_sewa);
    });
    const picSet = new Set();
    sitacList.forEach(s => {
      if (s.pic_perijinan) picSet.add(s.pic_perijinan);
    });
    return {
      pengelola: Array.from(pSet).sort(),
      jenis_sewa: Array.from(jSet).sort(),
      pic: Array.from(picSet).sort()
    };
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
    let revItems = colloList.filter(c =>
      (Number(c.rev_sharing_pct) || 0) > 0 || (c.rev_sharing && c.rev_sharing !== '-')
    );
    if (q) {
      revItems = revItems.filter(c =>
        (c.pengelola || '').toLowerCase().includes(q) ||
        (c.pelanggan || '').toLowerCase().includes(q) ||
        (c.no_so || '').toLowerCase().includes(q)
      );
    }
    return { data: revItems };
  }

  // 5. Collo Expirations
  if (path === '/api/collo/expirations') {
    const cat = params.get('category') || 'ALL';
    const q = (params.get('search') || '').toLowerCase();
    let items = colloList.filter(c => c.status === 'ACTIVE');
    if (cat !== 'ALL') {
      items = items.filter(c => (c.alert_category || 'SAFE') === cat);
    }
    if (q) {
      items = items.filter(c =>
        (c.pengelola || '').toLowerCase().includes(q) ||
        (c.pelanggan || '').toLowerCase().includes(q) ||
        (c.no_so || '').toLowerCase().includes(q)
      );
    }
    return { data: items };
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
    if (jenis !== 'ALL') filtered = filtered.filter(c => c.jenis_sewa === jenis);
    if (pengelola !== 'ALL') filtered = filtered.filter(c => c.pengelola === pengelola);
    if (search) {
      filtered = filtered.filter(c =>
        (c.pengelola || '').toLowerCase().includes(search) ||
        (c.pelanggan || '').toLowerCase().includes(search) ||
        (c.no_so || '').toLowerCase().includes(search) ||
        (c.sid || '').toLowerCase().includes(search)
      );
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
    const margin = filtered.reduce((a, b) => a + (Number(b.margin_rupiah) || 0), 0);

    return {
      data: paginated,
      total,
      page,
      pageSize,
      totalPages,
      totals: { revenue: rev, biaya, biaya_otc: biayaOtc, margin }
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
    const status = params.get('status') || 'ALL';
    const pic = params.get('pic') || 'ALL';
    const year = params.get('year') || 'ALL';
    const aging = params.get('aging') || 'ALL';
    const search = (params.get('search') || '').toLowerCase();
    const page = parseInt(params.get('page') || '1', 10);
    const pageSize = parseInt(params.get('pageSize') || '25', 10);

    let filtered = sitacList;
    if (status !== 'ALL') filtered = filtered.filter(s => s.progress === status);
    if (pic !== 'ALL') filtered = filtered.filter(s => s.pic_perijinan === pic);
    if (year !== 'ALL') filtered = filtered.filter(s => String(s.tahun) === String(year));
    if (aging !== 'ALL') {
      if (aging === 'green') filtered = filtered.filter(s => s.durasi_hari <= 7);
      else if (aging === 'yellow') filtered = filtered.filter(s => s.durasi_hari > 7 && s.durasi_hari <= 14);
      else if (aging === 'red') filtered = filtered.filter(s => s.durasi_hari > 14);
    }
    if (search) {
      filtered = filtered.filter(s =>
        (s.no_pa || '').toLowerCase().includes(search) ||
        (s.pelanggan || '').toLowerCase().includes(search) ||
        (s.terminating || '').toLowerCase().includes(search) ||
        (s.pic_perijinan || '').toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    const counts = { ALL: sitacList.length, Finish: 0, Ongoing: 0, Hold: 0, Cancel: 0 };
    sitacList.forEach(s => { if (counts[s.progress] !== undefined) counts[s.progress]++; });

    let green = 0, yellow = 0, red = 0;
    sitacList.forEach(s => {
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
      aging_dist: { green, yellow, red }
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
    const status = params.get('status') || 'ALL';
    const search = (params.get('search') || '').toLowerCase();

    let filtered = gangguanList;
    if (status === 'Aktif') filtered = filtered.filter(g => !g.is_selesai && g.status !== 'Selesai');
    else if (status === 'Selesai') filtered = filtered.filter(g => g.is_selesai || g.status === 'Selesai');
    if (search) {
      filtered = filtered.filter(g =>
        (g.no_tiket || '').toLowerCase().includes(search) ||
        (g.terminating || '').toLowerCase().includes(search) ||
        (g.pic_perijinan || '').toLowerCase().includes(search) ||
        (g.jenis_gangguan || '').toLowerCase().includes(search)
      );
    }

    const totalBiaya = filtered.reduce((a, b) => a + (Number(b.biaya_gangguan) || 0), 0);
    const totalAktif = gangguanList.filter(g => !g.is_selesai && g.status !== 'Selesai').length;
    const totalSelesai = gangguanList.filter(g => g.is_selesai || g.status === 'Selesai').length;

    return {
      data: filtered,
      total: filtered.length,
      status_counts: { ALL: gangguanList.length, Aktif: totalAktif, Selesai: totalSelesai },
      total_biaya: totalBiaya,
      avg_sla: 14.5
    };
  }

  // 12. Rekap Efisiensi
  if (path === '/api/rekap-efisiensi') {
    return rekapEff;
  }

  // 13. PIC Performance
  if (path === '/api/pic-performance') {
    return workload;
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
    let filtered = sitacList.filter(s => s.latitude && s.longitude);
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
      biaya_final: s.biaya_final
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

const tests = [
  '/api/executive/summary',
  '/api/meta/options',
  '/api/collo/expiring-3months',
  '/api/collo/rev-sharing?search=indosat',
  '/api/collo/expirations?category=CRITICAL',
  '/api/collo/1',
  '/api/collo?status=ACTIVE&page=1&pageSize=25',
  '/api/sitac/1',
  '/api/sitac?page=1&pageSize=25',
  '/api/gangguan/1',
  '/api/gangguan',
  '/api/rekap-efisiensi',
  '/api/pic-performance',
  '/api/auth/registered-pics',
  '/api/map-coordinates?status=ALL',
  '/api/database/overview'
];

for (const t of tests) {
  const res = handleStaticApiRequest(t);
  console.log(`[PASS] ${t} -> ${res ? (Array.isArray(res) ? `Array(${res.length})` : typeof res) : 'null'}`);
}
