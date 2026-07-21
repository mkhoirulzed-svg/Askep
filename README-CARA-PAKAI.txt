# Workflow perbaikan halaman ASKEP

Paket ini menambahkan:

- `.github/workflows/sync-page-settings.yml`
- `scripts/sync-page-settings.mjs`

## Yang dilakukan workflow

1. Memindai `index.html` dan semua `pages/*.html`.
2. Menambahkan secara otomatis jika belum ada:
   - `manifest.webmanifest`
   - `favicon.png`
   - `apple-touch-icon.png`
   - `styles/settings-fixes.css`
   - `scripts/settings.js`
3. Menyesuaikan path untuk halaman root dan halaman di folder `pages`.
4. Menghapus duplikasi tag yang dikelola workflow.
5. Membuat `styles/settings-fixes.css`.
6. Memperbaiki input, textarea, select, placeholder, readonly, disabled, autofill, dan search input pada mode gelap.
7. Commit perubahan otomatis ke branch tempat workflow dijalankan.

## Cara memasang

Unggah kedua file sesuai foldernya:

- `.github/workflows/sync-page-settings.yml`
- `scripts/sync-page-settings.mjs`

Setelah itu:

1. Buka tab **Actions**.
2. Pilih **Sinkronisasi Pengaturan Semua Halaman**.
3. Tekan **Run workflow**.
4. Pilih branch `main`.
5. Tekan tombol hijau **Run workflow**.

Workflow hanya berjalan manual, sehingga tidak membuat loop commit.
