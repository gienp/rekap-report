# 🚀 Panduan Deploy Web Portal ke GitHub Pages

Panduan ini berisi langkah-langkah untuk melakukan **push source code ke GitHub** dan **mengaktifkan GitHub Pages** agar web portal dapat diakses secara online melalui internet di alamat:

🌐 **`https://gienp.github.io/rekap-report/`**

---

## 📦 Apa Saja yang Sudah Disiapkan Otomatis

1. ✅ **Workflow GitHub Actions (`.github/workflows/deploy-pages.yml`)**:
   - Otomatis melakukan build & deploy setiap kali ada push ke branch `main`.
2. ✅ **File `.nojekyll`**:
   - Memastikan GitHub Pages menyajikan seluruh file HTML, CSS, JavaScript, dan dataset tanpa batasan engine Jekyll.
3. ✅ **File Dataset Master (`sitac_collo_data.js`)**:
   - Sudah dimasukkan ke git tracking agar dashboard, tabel, grafik, dan WebGIS langsung tampil lengkap saat pertama kali dibuka di GitHub Pages.
4. ✅ **File `.gitignore` yang Bersih**:
   - Mengabaikan folder build lama (`frontend/`, `backend/`, `data/`, `node_modules/`) agar repositori tetap ringan dan cepat.

---

## 🔑 Langkah 1: Push Perubahan ke GitHub

Buka terminal **PowerShell** atau **Terminal di VS Code** Anda (pada direktori repositori):

```powershell
cd "c:\Users\User\Downloads\rekap & report\rekap & report"
```

Lalu jalankan perintah push:

```powershell
git push origin main
```

### 💡 Jika Muncul Prompt Login GitHub:
- **Pilihan 1 (Browser Login)**: Jendela browser akan terbuka otomatis dari Git Credential Manager. Klik **"Sign in with your browser"** lalu konfirmasi otorisasi akun GitHub **`gienp`**.
- **Pilihan 2 (Personal Access Token / PAT)**: Jika diminta password/token di terminal:
  1. Buka browser: [https://github.com/settings/tokens](https://github.com/settings/tokens)
  2. Klik **Generate new token (classic)**.
  3. Beri nama (misal: `rekap-deploy`) dan centang checklist **`repo`** (Full control of private repositories).
  4. Klik **Generate token**, lalu copy token tersebut (contoh: `ghp_xxxx...`).
  5. Jalankan perintah push dengan token:
     ```powershell
     git push https://<TOKEN_ANDA>@github.com/gienp/rekap-report.git main
     ```

---

## 🌐 Langkah 2: Aktifkan GitHub Pages di Repositori

Setelah proses `git push` selesai:

1. Buka halaman pengaturan repositori di browser:
   👉 **[https://github.com/gienp/rekap-report/settings/pages](https://github.com/gienp/rekap-report/settings/pages)**
2. Pada bagian **"Build and deployment"**:
   - **Source**: Pilih **`GitHub Actions`** (Rekomendasi, karena file workflow `.github/workflows/deploy-pages.yml` sudah kami sediakan).
   - *(Atau jika ingin tanpa Actions, pilih `Deploy from a branch` -> pilih Branch: `main` -> Folder: `/ (root)` -> klik Save).*
3. Tunggu proses deployment sekitar 1 - 2 menit. Anda dapat memantau prosesnya di tab **Actions**:
   👉 **[https://github.com/gienp/rekap-report/actions](https://github.com/gienp/rekap-report/actions)**

---

## 🌟 Langkah 3: Akses Web Portal Anda

Setelah workflow selesai bertanda centang hijau (✔), web portal Anda sudah live dan siap digunakan di:

👉 **[https://gienp.github.io/rekap-report/](https://gienp.github.io/rekap-report/)**

Portal ini sudah terhubung langsung ke:
- **Cloud Firestore** & **Supabase PostgreSQL** untuk sinkronisasi realtime dua arah.
- **Master Dataset Client-Side** untuk performa instant tanpa loading delay.
- **Responsive PWA** siap dibuka dari laptop maupun smartphone petugas lapangan.

