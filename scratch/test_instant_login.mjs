const DEFAULT_TEAM_ACCOUNTS = {
  'admin': { pw: 'admin123', full_name: 'Administrator (Manajemen)', role: 'admin', avatar_icon: 'fa-shield-halved', badge_color: 'cyan', pic_code: '' },
  'harlan': { pw: 'pic123', full_name: 'Harlan Zaelani', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'emerald', pic_code: 'Harlan' },
  'budi': { pw: 'pic123', full_name: 'Budi Rodiyah', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'cyan', pic_code: 'Budi' },
  'edi': { pw: 'pic123', full_name: 'Edi Swargaloka', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'amber', pic_code: 'Edi' },
  'abusopian': { pw: 'pic123', full_name: 'M. Abusopian', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'indigo', pic_code: 'Abusopian' },
  'muhidin': { pw: 'pic123', full_name: 'Muhidin', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'teal', pic_code: 'Muhidin' },
  'brian': { pw: 'pic123', full_name: 'Brian Ariyanto', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'purple', pic_code: 'Brian' },
  'zulhadi': { pw: 'pic123', full_name: 'Zulhadi Syahril', role: 'lapangan', avatar_icon: 'fa-helmet-safety', badge_color: 'blue', pic_code: 'Zulhadi' }
};

function instantLogin(identifier, password) {
  const t0 = performance.now();
  const idClean = String(identifier || '').trim().toLowerCase();
  const defAcc = DEFAULT_TEAM_ACCOUNTS[idClean];

  if (defAcc && password === defAcc.pw) {
    const elapsed = performance.now() - t0;
    return {
      success: true,
      timeMs: elapsed,
      user: {
        id: `user_${idClean}`,
        username: idClean,
        full_name: defAcc.full_name,
        role: defAcc.role
      }
    };
  }
  return { success: false, error: 'Kata sandi salah' };
}

console.log(instantLogin('admin', 'admin123'));
console.log(instantLogin('harlan', 'pic123'));
