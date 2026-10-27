---
title: SobatSerabut
emoji: 🛵
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# 🛠️ SobatSerabut - Platform Jasa Serabutan & Pemantauan Mitra Terpusat

**SobatSerabut** adalah platform marketplace dua sisi (*two-sided marketplace*) yang menghubungkan Pemohon Jasa (Klien) dan Penyedia Jasa (Mitra Pekerja) berdasarkan lokasi terdekat (*geolocation matching*).

Proyek ini terdiri dari **2 aplikasi utama** yang saling terintegrasi secara real-time:
1. **Aplikasi Pertama**: **Dashboard Admin Terpusat & Sistem Otomasi Data** (Monitoring GPS real-time, Geofencing, CMS Dynamic Pricing, Verifikasi KYC, Rekber Escrow, & Otomasi Finansial).
2. **Aplikasi Kedua**: **Aplikasi Mitra Pekerja "SobatSerabut"** (Aplikasi Mobile Android APK siap install di HP & upload ke Google Play Store, PWA, Radar Tugas, Bidding/Instant Take, In-App Chat, Call, E-Wallet, dan Logo yang Dapat Dirubah Sendiri).

---

## 🌟 Arsitektur & Alur Kerja Sistem (Workflow)

```
[Klien] --------> Kirim Order (Lokasi A) + Bayar ke Rekber
                     |
                     v
             [Sistem Geolocation & Radar] 
                     |---> Cari Mitra Terdekat <--- [Dasbor Admin (Pantau & Atur Radius)]
                     v
[Mitra Pekerja] <--- Notifikasi & Terima Order (Instant Take / Bidding)
                     |
                     v
         [Pelacakan Live GPS] ---> Dikirim secara Real-Time ke Panel Admin
                     |
                     v
    [Tugas Selesai & Bukti Kerja] 
                     |
                     v
       [Pencairan Rekber Otomatis] 
    ├──> Saldo Jasa Bersih Masuk ke Dompet Mitra
    └──> Platform Fee (Rp 3.000) + Komisi (10%) Masuk Kas Admin
```

---

## 🚀 Akses Cepat Aplikasi (URL Langsung)

Saat server dijalankan (Port `4000`), seluruh aplikasi dapat langsung dibuka melalui peramban:

| Komponen | URL Akses | Keterangan |
| :--- | :--- | :--- |
| 🌐 **Portal Utama** | `http://127.0.0.1:4000/` | Pintu masuk terpadu & pengunduhan APK |
| 📊 **Aplikasi 1: Dashboard Admin** | `http://127.0.0.1:4000/admin/` | Panel pemantauan mitra, CMS, & finansial |
| 📱 **Aplikasi 2: Mitra Pekerja** | `http://127.0.0.1:4000/mitra/` | Antarmuka mobile-first mitra pekerja |
| 📦 **Download APK Android** | `http://127.0.0.1:4000/download/apk` | File APK siap install di HP Android |

---

## 1. 📊 Fitur Aplikasi Pertama: Dashboard Admin Terpusat

### A. Panel Pemantauan Mitra Pekerja (Live Tracking & Geolocation)
- **Peta Real-Time (Live Map Tracking)**:
  - Berbasis OpenStreetMap / Leaflet dengan visualisasi pergerakan GPS live tanpa jeda (Socket.IO).
  - Warna marker status mitra:
    - 🟢 **Hijau**: Siap Menerima Order (*Ready / Standby*)
    - 🟡 **Kuning**: Sedang Bertugas (*Working / On the job*)
    - 🔴 **Merah**: Offline / Istirahat
  - Pop-up interaktif: Nama, foto, rating bintang, jumlah order sukses, nomor telepon, dan status kendaraan.
  - Tombol **Simulasikan Pergerakan GPS Live** untuk menguji pergerakan dinamis marker di peta.

### B. Log Geofencing & Riwayat Perjalanan (Route History)
- Merekam titik jejak rute perjalanan (*breadcrumbs polyline*) setiap mitra saat menjalankan order.
- Informasi lengkap per titik: Timestamp waktu singgah, estimasi kecepatan tempuh (km/h), dan status navigasi.
- **Geofence Circle**: Visualisasi lingkaran radius batas matching order di peta untuk mendeteksi kecurangan atau kendala lalu lintas.

### C. Dasbor Metrik Performa Real-Time
- Counter metrik otomatis:
  - Total Mitra Terdaftar, Mitra Aktif vs Offline
  - Jumlah Order Selesai & Order Aktif
  - Persentase Pembatalan (*Cancellation Rate %*)
  - Rata-rata Rating Mitra (*e.g., 4.8 / 5.0*)
  - Total Dana Mengendap di Rekber (*Escrow Balance*)
  - Total Pendapatan Bersih Platform
- Grafik analitik interaktif (Chart.js):
  - Grafik Batang Pendapatan Harian (Admin Fee flat + Komisi jasa 10% + Langganan VIP)
  - Donat Distribusi Order per Kategori Jasa

### D. Panel Manajemen CMS & Remote Config (Update Tanpa Coding Ulang)
- **Dynamic Pricing & Geolocation**:
  - Slider Radius Maksimal Pencarian (1 km s.d. 30 km).
  - Formulir Tarif Dasar Jasa (Base Fare), Tarif per Kilometer, Platform Fee flat (Rp 3.000), dan Potongan Jasa Mitra (10%).
  - Tarif Langganan Akun Premium Mitra (Rp 50.000 / bulan).
- **Manajemen Kategori Jasa**:
  - Tambah keahlian/kategori jasa baru secara instan (Servis AC, Pembersih Rumah, Angkat Barang, dll).
  - Saklar Toggle Aktif/Nonaktif dan tombol Hapus.
- **Toggle Mode Pemeliharaan (Maintenance Mode 1-Klik)**:
  - Tombol satu klik untuk mengunci aplikasi jika server sedang *maintenance*.
  - Menampilkan pengumuman resmi di seluruh aplikasi mitra secara *real-time*.
- **Kustomisasi Logo & Identitas Aplikasi**:
  - Form ganti Nama Aplikasi & Tagline.
  - Upload file logo baru atau pilih preset logo (Shield Classic, Square Icon, Modern).
  - Perubahan logo langsung tersinkronisasi ke Aplikasi Mitra!

### E. Verifikasi Identitas Ketat (KYC - KTP & Selfie)
- Verifikasi keamanan mitra sebelum diperbolehkan melayani klien ke rumah.
- Tinjauan foto e-KTP dan foto selfie memegang KTP dengan fitur zoom modal.
- Tombol aksi: **Setujui (Approve)** atau **Tolak (Reject)** dengan catatan alasan.

### F. Rekening Bersama (Rekber) & Penarikan Dana (Withdrawal)
- Pengawasan dana jasa yang ditahan di sistem rekber.
- Permohonan penarikan saldo dompet mitra ke Bank (BCA, BRI, Mandiri) atau E-Wallet (DANA, GoPay, OVO, ShopeePay).
- Tombol satu klik **Transfer & Selesaikan**.

### G. Simulasi Order Klien Terintegrasi
- Tombol **+ Simulasi Order Klien** pada header dashboard admin untuk memposting order uji coba langsung ke peta (Pilih kategori, koordinat titik lokasi, dan budget jasa).

---

## 2. 📱 Fitur Aplikasi Kedua: Mitra Pekerja "SobatSerabut"

Aplikasi mitra dirancang dengan antarmuka **Mobile-First** yang responsif dan siap digunakan sebagai **Aplikasi Android Native** maupun **PWA**:

### A. Logo & Branding yang Dapat Dirubah Sendiri
- **Sinkronisasi Otomatis**: Jika Admin mengubah logo di Dashboard CMS, logo di aplikasi mitra otomatis berganti tanpa perlu *re-install*.
- **Kustomisasi Mandiri**: Di tab Akun, Mitra/Pengembang dapat memilih preset logo atau memasukkan URL gambar logo sendiri.

### B. Mode Kerja & Live GPS Updater
- Saklar status besar pada header: **ONLINE (Hijau)**, **ON JOB (Kuning)**, dan **OFFLINE (Merah)**.
- Saat Online: GPS background updater otomatis mengirimkan koordinat terkini ke backend setiap 4 detik untuk pelacakan live.

### C. Radar Tugas Terdekat (Geolocation Matching)
- Memindai order klien yang berada dalam radius maksimal (misal 10 km).
- Menampilkan kalkulasi jarak rute secara nyata (misal: `0.8 km dari Anda`).
- Dua Opsi Penerimaan Order:
  - ⚡ **Ambil Langsung (Instant Take)**: Menerima tugas dengan budget yang diajukan klien.
  - 💰 **Tawar Harga (Bidding)**: Mengajukan penawaran harga alternatif dengan catatan khusus.
- Lencana **VIP Radar**: Mitra Premium mendapatkan lowongan prioritas lebih awal.

### D. Alur Pelaksanaan Tugas Terintegrasi & Navigasi
- Navigasi peta interaktif menuju lokasi penugasan klien.
- Tombol cepat **Buka Google Maps** untuk navigasi GPS eksternal turn-by-turn.
- Tahapan status progres tugas yang teratur:
  1. *Menuju Lokasi* -> Tombol konfirmasi "Saya Tiba di Lokasi"
  2. *Tiba di Lokasi* -> Tombol konfirmasi "Mulai Kerjakan"
  3. *Sedang Bekerja* -> Tombol konfirmasi "Tugas Selesai & Cairkan Rekber"
- Setelah tugas disetujui selesai, dana Rekber otomatis dicairkan ke dompet mitra.

### E. Sistem Chat & Telepon In-App (Privasi Terjaga)
- Komunikasi klien dan mitra terlindungi tanpa perlu bertukar nomor WhatsApp pribadi.
- **In-App Chat**: Obrolan teks real-time dilengkapi tombol pesan cepat (*quick templates*: "Saya sedang di jalan", "Sudah di depan pagar").
- **In-App Voice Call Simulator**: Antarmuka panggilan suara terenkripsi dengan penghitung durasi panggilan, tombol mute, dan speaker.

### F. Dompet Digital Mitra (E-Wallet) & Withdraw
- Pantau Saldo Aktif dan Total Penghasilan Bersih.
- Riwayat transaksi kredit/debit lengkap.
- Formulir **Tarik Saldo**: Penarikan ke DANA, GoPay, OVO, ShopeePay, atau Transfer Bank.

### G. Verifikasi Identitas (KYC)
- Halaman upload dokumen: Foto NIK KTP dan Foto Selfie memegang KTP.
- Status akun: *Belum Verifikasi*, *Menunggu Tinjauan*, atau *Terverifikasi*.

### H. Langganan Mitra VIP Premium
- Biaya langganan Rp 50.000 / bulan.
- Manfaat: Lencana Emas VIP Terverifikasi, notifikasi order radar 2 menit lebih awal, dan potongan fee lebih rendah.

---

## 3. 📦 Proyek Android Native & Publikasi ke Google Play Store

Proyek Android lengkap telah disiapkan di direktori `/home/jinny21/SobatSerabut/android-app/`:

### A. Struktur Proyek Android Play Store:
- **Package Name**: `com.sobatserabut.mitra`
- **Application Label**: `SobatSerabut`
- **Target SDK**: `34` (Android 14 - Wajib untuk Google Play Store)
- **Min SDK**: `24` (Android 7.0 ke atas, mencakup >98% perangkat Android)
- **Permissions di AndroidManifest.xml**:
  - `ACCESS_FINE_LOCATION` & `ACCESS_COARSE_LOCATION` (GPS Real-Time)
  - `INTERNET` & `ACCESS_NETWORK_STATE` (Koneksi Backend Socket)
  - `CAMERA` & `READ_EXTERNAL_STORAGE` (Upload KTP & Selfie KYC)
  - `VIBRATE` & `WAKE_LOCK` (Notifikasi order masuk)

### B. Kompilasi APK Otomatis:
Skrip kompilasi otomatis disediakan di:
```bash
/home/jinny21/SobatSerabut/android-app/build_apk.sh
```
Skrip ini memanfaatkan `aapt2`, `javac`, `d8`, `zipalign`, dan `apksigner` untuk menghasilkan APK Android yang sudah ditandatangani (*signed*):
```
/home/jinny21/SobatSerabut/android-app/SobatSerabut-Mitra.apk
```

### C. Panduan Upload ke Google Play Console (Play Store):
1. Buka [Google Play Console](https://play.google.com/console).
2. Buat aplikasi baru dengan nama **SobatSerabut**.
3. Di Android Studio atau terminal, buat berkas release Android App Bundle (AAB):
   ```bash
   cd /home/jinny21/SobatSerabut/android-app
   ./gradlew bundleRelease
   ```
4. Unggah berkas `.aab` ke bagian **Production** atau **Internal Testing**.
5. Lengkapi formulir deskripsi, ikon `512x512` (tersedia di `backend/uploads/logo_icon.svg`), tangkapan layar (*screenshots*), dan kebijakan privasi (*privacy policy*).

---

## 4. 🎨 Panduan Mengubah Gambar Logo Aplikasi

Anda dapat mengubah logo SobatSerabut kapan saja dengan **3 cara mudah**:

### Cara 1: Lewat Panel CMS Dashboard Admin (Paling Praktis)
1. Buka Dashboard Admin di menu **CMS & Dynamic Pricing**.
2. Pada bagian **Identitas Aplikasi & Logo Kustom**, pilih file gambar logo baru Anda (format PNG, SVG, atau JPG).
3. Klik tombol **Simpan Seluruh Pengaturan**. Logo otomatis terdistribusi via Remote Config ke seluruh aplikasi mitra!

### Cara 2: Menggunakan Skrip CLI Terminal
Jalankan skrip pembantu yang telah disediakan:
```bash
# Menggunakan preset Shield
/home/jinny21/SobatSerabut/scripts/update_logo.sh preset:shield

# Menggunakan preset Square Icon
/home/jinny21/SobatSerabut/scripts/update_logo.sh preset:icon

# Atau menggunakan file gambar Anda sendiri
/home/jinny21/SobatSerabut/scripts/update_logo.sh /path/ke/logo_anda.png
```

### Cara 3: Lewat Menu Pengaturan di Aplikasi Mitra
1. Di Aplikasi Mitra, buka tab **Akun & Logo**.
2. Pada bagian **Kustomisasi Logo & Tampilan Aplikasi**, pilih preset logo atau tempelkan URL gambar logo baru Anda.

---

## 5. 💰 Rincian Simulasi Monetisasi (Cara Menghasilkan Uang)

Platform SobatSerabut menerapkan tiga pintu monetisasi yang sangat menguntungkan:

| Sumber Pendapatan | Biaya | Simulasi 500 Tugas/Hari | Pendapatan / Bulan |
| :--- | :--- | :--- | :--- |
| **1. Platform Fee (Admin Klien)** | Flat Rp 3.000 / tugas | 500 x Rp 3.000 = Rp 1.500.000/hari | **Rp 45.000.000 / bulan** |
| **2. Komisi Persentase Jasa** | 10% dari tarif jasa | Rata-rata order Rp 50k (komisi Rp 5k) x 500 = Rp 2.500.000/hari | **Rp 75.000.000 / bulan** |
| **3. Langganan Mitra VIP** | Rp 50.000 / bulan / mitra | 200 mitra berlangganan VIP | **Rp 10.000.000 / bulan** |
| **TOTAL PROYEKSI PENDAPATAN** | | | **Rp 130.000.000 / bulan** |

---

## 6. 🛠️ Struktur Direktori Proyek

```
/home/jinny21/SobatSerabut/
├── backend/
│   ├── server.js               # REST API & Socket.IO server real-time
│   ├── database.js             # File-backed JSON DB dengan data awal
│   ├── data/sobatserabut_db.json # Penyimpanan persisten (Mitra, Order, Transaksi)
│   └── uploads/                # Berkas logo SVG/PNG, KTP, dan selfie KYC
│
├── admin-dashboard/            # APLIKASI 1: DASHBOARD ADMIN TERPUSAT
│   ├── index.html              # Antarmuka SPA panel admin lengkap
│   └── js/app.js               # Logika real-time Leaflet, Chart.js, CMS & KYC
│
├── mitra-app/                  # APLIKASI 2: MITRA PEKERJA (MOBILE / PWA)
│   ├── index.html              # Antarmuka mobile-first mitra pekerja
│   ├── manifest.json           # PWA Web App Manifest
│   └── js/app.js               # Radar geolocation, GPS ping, chat, call, wallet
│
├── android-app/                # PROYEK ANDROID NATIVE SIAP PLAY STORE
│   ├── AndroidManifest.xml     # Izin GPS, kamera, internet, package com.sobatserabut.mitra
│   ├── build_apk.sh            # Skrip otomatisasi build & signing APK
│   ├── SobatSerabut-Mitra.apk  # File APK yang sudah ter-compile & signed
│   └── app/src/main/
│       ├── java/com/sobatserabut/mitra/ (MainActivity, SplashActivity, Clients)
│       └── res/ (mipmap launcher icons, layout, values, drawables)
│
├── scripts/
│   ├── start_all.sh            # Menjalankan server dan seluruh ekosistem
│   ├── stop_all.sh             # Menghentikan server
│   └── update_logo.sh          # Mengganti logo aplikasi secara instan
└── README.md                   # Dokumentasi lengkap proyek
```

---

## 7. 🚀 Cara Menjalankan Ekosistem Aplikasi

Untuk memulai server dan menyalakan seluruh ekosistem:
```bash
/home/jinny21/SobatSerabut/scripts/start_all.sh
```

Untuk menghentikan server:
```bash
/home/jinny21/SobatSerabut/scripts/stop_all.sh
```

Untuk mengkompilasi ulang file APK Android kapan saja:
```bash
/home/jinny21/SobatSerabut/android-app/build_apk.sh
```
# wsl-ke-ubuntu
