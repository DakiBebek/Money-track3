# 💰 Duitku — Smart Personal Finance (TypeScript PWA)

Aplikasi pencatatan keuangan pribadi modern berbasis **TypeScript**, **Vite**, dan **Supabase**. Didesain dengan antarmuka elegan, offline-first cache (SWR), analisis visual arus kas 6 bulan, alokasi pengeluaran, pelacak cicilan, pos target tabungan, dan pemindai struk otomatis berbasis Google Gemini AI.

---

## 🚀 Fitur Unggulan

- **100% Berbasis TypeScript**: Arsitektur modular dengan *strict type safety* untuk Supabase Database schema, App State, dan API.
- **Backend Supabase Terintegrasi**: Sinkronisasi *real-time* ke Postgres Database, Row Level Security (RLS), dan Storage Bucket untuk foto profil (`avatars`).
- **AI Receipt Scanner (Google Gemini 1.5 Flash Vision)**: Deteksi otomatis nominal belanja, tanggal, merchant, dan kategori dari foto struk fisik dengan akurasi tinggi.
- **Offline-First PWA (Stale-While-Revalidate)**: Aplikasi dapat langsung dibuka dan digunakan seketika meski offline atau jaringan lambat.
- **Grup Transaksi Tanggal Modern**: Pengelompokan cerdas per tanggal dengan total ringkasan harian dan *Segmented Control Toggle* (`Pengeluaran` / `Pemasukan`).
- **Target Tabungan & Simulasi Cicilan**: Progress bar dinamis, estimasi lunas bulanan, dan setoran/penarikan dana terpisah.
- **Multi-Tema**: Modern (Indigo), Klasik (Emerald), dan Gelap (Obsidian) dengan dukungan sistem deteksi otomatis.

---

## 🛠️ Panduan Instalasi & Menjalankan Proyek

### 1. Persyaratan
Pastikan Anda telah menginstal **Node.js** (versi 18 ke atas) di komputer Anda:
[Unduh Node.js Resmi](https://nodejs.org/)

### 2. Jalankan Mode Pengembangan (Local Dev)
```bash
# Clone repository
git clone https://github.com/DakiBebek/Money-track3.git
cd Money-track3

# Pasang dependencies
npm install

# Jalankan development server lokal
npm run dev
```
Aplikasi akan otomatis terbuka di browser Anda pada alamat `http://localhost:3000`.

### 3. Build untuk Produksi
```bash
npm run build
```
File hasil kompilasi TypeScript dan bundler Vite akan tersimpan di dalam folder `dist/`.

---

## 📁 Struktur Direktori Proyek

```text
Money-track3/
├── .github/workflows/deploy.yml   # CI/CD otomatis deploy ke GitHub Pages
├── public/                        # Aset publik, ikon PWA & manifest
│   ├── icon-180.png
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── manifest.json
│   └── sw.js
├── src/
│   ├── types/
│   │   ├── database.ts            # Skema tipe data tabel Supabase
│   │   └── state.ts               # Interface AppState, Filter, & Tema
│   ├── lib/
│   │   ├── supabase.ts            # Klien Supabase terotentikasi
│   │   └── storage.ts             # SWR offline storage manager
│   ├── utils/
│   │   ├── format.ts              # Formatter mata uang, tanggal, & sanitasi
│   │   ├── calculator.ts          # Inline math calculator parser
│   │   ├── image.ts               # Canvas cropper & compressor WebP
│   │   └── ocr.ts                 # Integrasi Google Gemini AI Vision
│   ├── components/
│   │   └── splash.ts              # Luxury splash screen controller
│   ├── styles/
│   │   └── main.css               # Desain UI Fintech responsif
│   └── main.ts                    # Entry point aplikasi TypeScript
├── index.html                     # Vite HTML entry point
├── standalone.html                # Versi standalone single-file (opsional)
├── supabase-schema.sql            # Skrip skema database Supabase
├── package.json                   # Konfigurasi npm scripts & dependensi
├── tsconfig.json                  # Konfigurasi kompilator TypeScript
└── vite.config.ts                 # Konfigurasi Vite bundler
```

---

## 📄 Lisensi
MIT License © 2026 Duitku Financial.
