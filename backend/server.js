const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./database');
const { sendOtpWhatsApp, sendOtpSMS, getOtpSenderNumber, testFonnteDeviceStatus } = require('./otpService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middlewares
app.use(cors());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Admin Security & Secret Password Gate
const crypto = require('crypto');

function getExpectedAdminToken() {
  const pass = process.env.ADMIN_PASSWORD || 'adminserabut2026';
  return crypto.createHmac('sha256', 'sobatserabut-secret-admin-key')
               .update(pass)
               .digest('hex');
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  if (token && token === getExpectedAdminToken()) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Akses ditolak: Autentikasi admin diperlukan.' });
}

// Cloud Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'sobatserabut', uptime: process.uptime() });
});

// Static files
const UPLOADS_DIR = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOADS_DIR));

// 1. Portal & Hub Akses Resmi SobatSerabut
app.use('/portal', express.static(path.join(__dirname, '../portal')));
app.use('/hub', express.static(path.join(__dirname, '../portal')));

// 2. Download APK Resmi (Driver SobatSerabut & SobatSerabut Klien)
app.get('/download/driver-apk', (req, res) => {
  const primaryApk = path.join(__dirname, '../android-app/Driver-SobatSerabut.apk');
  const fallbackApk = path.join(__dirname, '../android-app/SobatSerabut-Mitra.apk');
  if (fs.existsSync(primaryApk)) {
    return res.download(primaryApk, 'Driver-SobatSerabut.apk');
  } else if (fs.existsSync(fallbackApk)) {
    return res.download(fallbackApk, 'Driver-SobatSerabut.apk');
  }
  res.status(404).send('File APK Driver belum selesai dikompilasi.');
});

app.get('/download/mitra-apk', (req, res) => {
  const primaryApk = path.join(__dirname, '../android-app/Driver-SobatSerabut.apk');
  const fallbackApk = path.join(__dirname, '../android-app/SobatSerabut-Mitra.apk');
  if (fs.existsSync(primaryApk)) {
    return res.download(primaryApk, 'SobatSerabut-Mitra.apk');
  } else if (fs.existsSync(fallbackApk)) {
    return res.download(fallbackApk, 'SobatSerabut-Mitra.apk');
  }
  res.status(404).send('File APK Mitra belum selesai dikompilasi.');
});

app.get('/download/client-apk', (req, res) => {
  const primaryApk = path.join(__dirname, '../android-app/SobatSerabut.apk');
  if (fs.existsSync(primaryApk)) {
    return res.download(primaryApk, 'SobatSerabut.apk');
  }
  res.status(404).send('File APK Klien belum selesai dikompilasi.');
});

app.get('/SobatSerabut.apk', (req, res) => {
  const primaryApk = path.join(__dirname, '../android-app/SobatSerabut.apk');
  if (fs.existsSync(primaryApk)) return res.download(primaryApk, 'SobatSerabut.apk');
  res.status(404).send('File APK Klien belum selesai dikompilasi.');
});

app.get('/Driver-SobatSerabut.apk', (req, res) => {
  const driverApk = path.join(__dirname, '../android-app/Driver-SobatSerabut.apk');
  if (fs.existsSync(driverApk)) return res.download(driverApk, 'Driver-SobatSerabut.apk');
  res.status(404).send('File APK Driver belum selesai dikompilasi.');
});

app.get('/SobatSerabut-Mitra.apk', (req, res) => {
  const driverApk = path.join(__dirname, '../android-app/Driver-SobatSerabut.apk');
  if (fs.existsSync(driverApk)) return res.download(driverApk, 'Driver-SobatSerabut.apk');
  res.status(404).send('File APK Driver belum selesai dikompilasi.');
});

app.get('/download/apk', (req, res) => {
  const driverApk = path.join(__dirname, '../android-app/Driver-SobatSerabut.apk');
  const fallbackApk = path.join(__dirname, '../android-app/SobatSerabut-Mitra.apk');
  if (fs.existsSync(driverApk)) {
    return res.download(driverApk, 'Driver-SobatSerabut.apk');
  } else if (fs.existsSync(fallbackApk)) {
    return res.download(fallbackApk, 'Driver-SobatSerabut.apk');
  }
  res.status(404).send('File APK belum dikompilasi.');
});

// Halaman web interaktif unduhan & instalasi semua HP
app.use('/download', express.static(path.join(__dirname, '../portal')));

// ── SUBDOMAIN ROUTING & MULTI-TENANT ASSETS ───────────────────
// Otomatis mengenali host subdomain:
// • driver.sobatserabut.id / mitra.sobatserabut.id -> driver-app
// • admin.sobatserabut.id                          -> admin-dashboard
// • app.sobatserabut.id / sobatserabut.id          -> client-app
const driverStatic = express.static(path.join(__dirname, '../driver-app'));
const adminStatic  = express.static(path.join(__dirname, '../admin-dashboard'));
const clientStatic = express.static(path.join(__dirname, '../client-app'));

function getHostSubdomain(req) {
  const host = (req.headers.host || req.hostname || '').split(':')[0].toLowerCase();
  if (host.startsWith('driver.') || host.startsWith('mitra.')) return 'driver';
  if (host.startsWith('admin.')) return 'admin';
  if (host.startsWith('app.')) return 'client';
  return null;
}

// Subdomain-aware static middleware
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/socket.io') ||
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/download') ||
    req.path.startsWith('/portal') ||
    req.path.startsWith('/hub') ||
    req.path.startsWith('/admin') ||
    req.path.startsWith('/driver') ||
    req.path.startsWith('/mitra') ||
    req.path.startsWith('/client') ||
    req.path.startsWith('/klien') ||
    req.path.startsWith('/app')
  ) {
    return next();
  }

  const sub = getHostSubdomain(req);
  if (sub === 'driver') {
    return driverStatic(req, res, next);
  } else if (sub === 'admin') {
    return adminStatic(req, res, next);
  } else if (sub === 'client') {
    return clientStatic(req, res, next);
  }
  next();
});

// 3. Serve Admin Dashboard secara terpusat hanya di /admin dan /admin-pusat
app.use('/admin', express.static(path.join(__dirname, '../admin-dashboard')));
app.use('/admin-pusat', express.static(path.join(__dirname, '../admin-dashboard')));

// SPA Fallback: Admin Dashboard — setiap sub-route di /admin/* serve index.html
app.get('/admin/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-dashboard/index.html'));
});
app.get('/admin-pusat/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-dashboard/index.html'));
});

// 4. Serve Aplikasi Penyedia Jasa: Driver SobatSerabut
app.use('/driver', express.static(path.join(__dirname, '../driver-app')));
app.use('/mitra', express.static(path.join(__dirname, '../driver-app')));

// SPA Fallback: Driver App
app.get('/driver/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../driver-app/index.html'));
});
app.get('/mitra/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../driver-app/index.html'));
});

// 5. Serve Aplikasi Pemohon Jasa: SobatSerabut (Klien)
app.use('/client', express.static(path.join(__dirname, '../client-app')));
app.use('/klien', express.static(path.join(__dirname, '../client-app')));
app.use('/app', express.static(path.join(__dirname, '../client-app')));

// SPA Fallback: Client App — setiap path yang tidak cocok API/static → client index
app.get('/client/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../client-app/index.html'));
});
app.get('/klien/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../client-app/index.html'));
});
app.get('/app/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../client-app/index.html'));
});

// Root SPA: Client App (akses langsung ke domain root)
app.use('/', express.static(path.join(__dirname, '../client-app')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${unique}${ext}`);
  }
});
const upload = multer({ storage });

// Helper: Haversine distance in KM
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}

// Helper: Save Base64 Image to uploads folder
function saveBase64Image(dataString, prefix = 'upload') {
  if (!dataString || typeof dataString !== 'string') return dataString;
  if (!dataString.startsWith('data:image/')) return dataString;
  try {
    const matches = dataString.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) return dataString;
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    return `/uploads/${filename}`;
  } catch (e) {
    console.error('Error saving base64 image:', e);
    return dataString;
  }
}

// Helper: Real Indonesian Bank & E-Wallet Validation
function validateIndonesianBankOrEwallet(bankName, bankAccount, phone, bankHolder) {
  if (!bankName || !bankAccount) {
    return { valid: false, message: 'Pilihan penyedia bank/e-wallet dan nomor rekening/akun wajib diisi.' };
  }
  const cleanAccount = (bankAccount || '').toString().replace(/[^0-9]/g, '');
  const cleanPhone = (phone || '').toString().replace(/[^0-9]/g, '');
  const nameNorm = (bankName || '').toUpperCase().trim();

  const isEwallet = ['DANA', 'GOPAY', 'OVO', 'SHOPEEPAY', 'LINKAJA'].includes(nameNorm);
  if (isEwallet) {
    if (cleanAccount.length < 10 || cleanAccount.length > 13) {
      return { valid: false, message: `Nomor akun ${bankName} harus berupa nomor ponsel seluler Indonesia yang valid (10-13 digit).` };
    }
    if (!cleanAccount.startsWith('08') && !cleanAccount.startsWith('628')) {
      return { valid: false, message: `Nomor akun ${bankName} harus dimulai dengan 08 atau 628.` };
    }
  } else if (nameNorm.includes('BCA')) {
    if (cleanAccount.length !== 10) {
      return { valid: false, message: 'Nomor rekening Bank BCA resmi wajib 10 digit angka.' };
    }
  } else if (nameNorm.includes('MANDIRI')) {
    if (cleanAccount.length !== 13) {
      return { valid: false, message: 'Nomor rekening Bank Mandiri resmi wajib 13 digit angka.' };
    }
  } else if (nameNorm.includes('BNI')) {
    if (cleanAccount.length !== 10) {
      return { valid: false, message: 'Nomor rekening Bank BNI resmi wajib 10 digit angka.' };
    }
  } else if (nameNorm.includes('BRI')) {
    if (cleanAccount.length !== 15) {
      return { valid: false, message: 'Nomor rekening Bank BRI resmi wajib 15 digit angka.' };
    }
  } else if (nameNorm.includes('JAGO') || nameNorm.includes('SEABANK')) {
    if (cleanAccount.length < 10 || cleanAccount.length > 12) {
      return { valid: false, message: `Nomor rekening ${bankName} harus 10-12 digit angka.` };
    }
  } else {
    if (cleanAccount.length < 8 || cleanAccount.length > 20) {
      return { valid: false, message: `Nomor rekening ${bankName} tidak sesuai standar perbankan.` };
    }
  }

  return { valid: true, cleanAccount };
}

/* ========================================================
 * 1. AUTENTIKASI PENGGUNA (REGISTER & LOGIN NYATA)
 * ======================================================== */
app.post('/api/auth/register', (req, res) => {
  const {
    name, phone, email, password, role, skills, vehicle, address,
    nik, ktpPhoto, selfieKtpPhoto, avatarPhoto,
    bankName, bankAccount, bankHolder,
    clientPaymentType, clientPaymentProvider, clientAccountNo, clientAccountName
  } = req.body;

  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const assignedRole = role || 'klien';
  const assignedName = (name && name.trim()) ? name.trim() : (cleanPhone ? ('Sobat ' + cleanPhone.slice(-4)) : 'Pengguna SobatSerabut');

  if (!phone || !password) {
    return res.status(400).json({ success: false, message: 'Harap isi Nomor HP dan Kata Sandi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Kata sandi minimal 6 karakter.' });
  }
  const users = db.get('users') || [];
  const existing = users.find(u => {
    const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
    return uPhone === cleanPhone || (email && u.email === email);
  });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Nomor HP atau Email ini sudah terdaftar. Silakan langsung masuk menggunakan kata sandi Anda.' });
  }

  const isMitra = assignedRole === 'mitra';
  if (isMitra) {
    const valRes = validateIndonesianBankOrEwallet(bankName, bankAccount, cleanPhone, bankHolder);
    if (!valRes.valid) {
      return res.status(400).json({ success: false, message: valRes.message });
    }
  }

  const prefix = isMitra ? 'MTR' : 'KLN';
  const newUserId = `${prefix}-${Date.now().toString().slice(-4)}`;

  // Process Real Photos (No Fake Avatars)
  let userAvatar = isMitra ? '/uploads/avatar_mitra.svg' : '/uploads/avatar_klien.svg';
  if (avatarPhoto) {
    userAvatar = saveBase64Image(avatarPhoto, 'avatar');
  }

  // Koordinat GPS Nyata dari Perangkat (Tanpa Random Jitter / Rekayasa)
  const reqLat = Number(req.body.lat);
  const reqLng = Number(req.body.lng);
  const userLat = (!isNaN(reqLat) && reqLat !== 0) ? reqLat : -6.2088;
  const userLng = (!isNaN(reqLng) && reqLng !== 0) ? reqLng : 106.8456;

  let regAddress = (address || '').trim();
  const { street, houseNumber, rt, rw, kelurahan, kecamatan, city, benchmark } = req.body;
  if (!regAddress && (street || houseNumber || kelurahan || kecamatan || city)) {
    const parts = [];
    if (street) parts.push(street.trim());
    if (houseNumber) parts.push(`No. ${houseNumber.trim()}`);
    if (rt || rw) parts.push(`RT ${rt || '-'}/RW ${rw || '-'}`);
    if (kelurahan) parts.push(`Kel. ${kelurahan.trim()}`);
    if (kecamatan) parts.push(`Kec. ${kecamatan.trim()}`);
    if (city) parts.push(city.trim());
    regAddress = parts.join(', ');
  }
  if (!regAddress) regAddress = 'Indonesia';

  const structuredAddress = {
    street: (street || '').trim(),
    houseNumber: (houseNumber || '').trim(),
    rt: (rt || '').trim(),
    rw: (rw || '').trim(),
    kelurahan: (kelurahan || '').trim(),
    kecamatan: (kecamatan || '').trim(),
    city: (city || '').trim(),
    benchmark: (benchmark || '').trim(),
    fullAddress: regAddress,
    lat: userLat,
    lng: userLng
  };

  const newUser = {
    id: newUserId,
    name: assignedName,
    phone: phone.trim(),
    email: email || `${cleanPhone}@sobatserabut.id`,
    password: password.trim(),
    role: assignedRole, // 'klien' atau 'mitra'
    avatar: userAvatar,
    address: regAddress,
    structuredAddress: structuredAddress,
    addresses: [structuredAddress],
    lat: userLat,
    lng: userLng,
    walletBalance: 0,
    createdAt: new Date().toISOString()
  };

  if (isMitra) {
    // Validasi Kelengkapan Mitra Baru Sesuai Syarat KYC Ketat
    const processedKtp = saveBase64Image(ktpPhoto, 'ktp') || '';
    const processedSelfie = saveBase64Image(selfieKtpPhoto || avatarPhoto, 'selfie') || '';

    // Status mitra baru: aktif dengan status KYC pending menunggu konfirmasi admin
    newUser.status = 'ready';
    newUser.rating = 5.0;
    newUser.completedOrders = 0;
    newUser.cancelRate = 0.0;
    newUser.earnings = 0;
    newUser.isPremium = false;
    newUser.kycStatus = (processedKtp || processedSelfie) ? 'pending' : 'pending';
    newUser.nik = nik ? nik.replace(/[^0-9]/g, '').slice(0, 16) : '';
    newUser.ktpPhoto = processedKtp;
    newUser.selfieKtpPhoto = processedSelfie;
    newUser.skills = Array.isArray(skills) ? skills : [skills || "Runner / Belanja Kilat"];
    newUser.vehicle = vehicle || "Sepeda Motor";
    newUser.bankDetails = {
      bankName: bankName || 'DANA',
      bankAccount: bankAccount || cleanPhone,
      bankHolder: bankHolder || name
    };

    // Masukkan ke antrean KYC Admin untuk konfirmasi nyata
    const kycRequests = db.get('kycRequests') || [];
    const newKyc = {
      id: `KYC-${Date.now().toString().slice(-4)}`,
      mitraId: newUser.id,
      mitraName: newUser.name,
      phone: newUser.phone,
      nik: newUser.nik,
      address: newUser.address,
      bankDetails: newUser.bankDetails,
      ktpImageUrl: processedKtp,
      selfieImageUrl: processedSelfie,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      reviewNotes: 'Data pendaftaran mitra, foto e-KTP & selfie siap dikonfirmasi di Dashboard Admin.'
    };
    kycRequests.unshift(newKyc);
    db.set('kycRequests', kycRequests);
    io.emit('kyc:new', newKyc);
    io.emit('mitra:status_change', { mitraId: newUser.id, status: 'ready', name: newUser.name, lat: newUser.lat, lng: newUser.lng });
    io.emit('mitra:online', newUser);
  } else {
    // Akun Pemohon Jasa (Klien)
    newUser.totalOrdersPosted = 0;
    newUser.paymentAccount = {
      type: clientPaymentType || 'ewallet',
      provider: clientPaymentProvider || 'DANA',
      accountNo: clientAccountNo || cleanPhone,
      accountName: clientAccountName || name
    };
  }

  users.unshift(newUser);
  db.set('users', users);

  io.emit('user:registered', { id: newUser.id, name: newUser.name, role: newUser.role });
  res.json({
    success: true,
    message: isMitra
      ? `Pendaftaran Mitra Driver berhasil! Akun Anda telah aktif dan siap menerima order tugas.`
      : `Pendaftaran Pemohon Jasa (Klien) berhasil! Silakan nikmati kemudahan order jasa.`,
    data: newUser
  });
});


app.post('/api/auth/login', (req, res) => {
  const { phoneOrEmail, password, expectedRole } = req.body;
  if (!phoneOrEmail || !password) {
    return res.status(400).json({ success: false, message: 'Masukkan nama akun / nomor HP dan kata sandi.' });
  }

  const cleanInput = phoneOrEmail.toString().trim();
  const cleanPhone = cleanInput.replace(/[^0-9]/g, '');
  const users = db.get('users') || [];
  const user = users.find(u => {
    const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
    const phoneMatch = cleanPhone && uPhone && (
      uPhone === cleanPhone ||
      (uPhone.length >= 9 && cleanPhone.endsWith(uPhone.slice(-9))) ||
      (cleanPhone.length >= 9 && uPhone.endsWith(cleanPhone.slice(-9)))
    );
    const nameMatch = u.name && u.name.trim().toLowerCase() === cleanInput.toLowerCase();
    const nikMatch = u.nik && u.nik === cleanInput;
    const emailMatch = u.email && u.email.toLowerCase() === cleanInput.toLowerCase();
    const roleMatch = expectedRole ? (u.role === expectedRole) : true;
    return (phoneMatch || nameMatch || nikMatch || emailMatch) && u.password === password && roleMatch;
  });
  
  if (!user) {
    // Cek apakah akun ada tapi role tidak cocok
    if (expectedRole) {
      const otherRoleUser = users.find(u => {
        const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
        const phoneMatch = cleanPhone && uPhone && (
          uPhone === cleanPhone ||
          (uPhone.length >= 9 && cleanPhone.endsWith(uPhone.slice(-9))) ||
          (cleanPhone.length >= 9 && uPhone.endsWith(cleanPhone.slice(-9)))
        );
        return phoneMatch && u.password === password;
      });
      if (otherRoleUser) {
        if (expectedRole === 'mitra' && otherRoleUser.role === 'klien') {
          return res.status(403).json({
            success: false,
            roleMismatch: true,
            message: 'Akun ini adalah Akun Klien SobatSerabut. Silakan masuk menggunakan Aplikasi Klien atau daftar sebagai Driver baru.'
          });
        }
        if (expectedRole === 'klien' && otherRoleUser.role === 'mitra') {
          return res.status(403).json({
            success: false,
            roleMismatch: true,
            message: 'Akun ini adalah Akun Driver Mitra. Silakan masuk menggunakan Aplikasi Driver SobatSerabut.'
          });
        }
      }
    }
    return res.status(401).json({ success: false, message: 'Nama akun, nomor HP, atau kata sandi tidak cocok. Silakan periksa kembali.' });
  }

  // Cek status suspend atau terminate
  if (user.accountStatus === 'suspended') {
    return res.status(403).json({
      success: false,
      suspended: true,
      message: `Akun Anda sedang ditangguhkan (Suspended) oleh Admin. Alasan: ${user.suspendReason || 'Pemeriksaan kepatuhan'}. Hubungi Admin untuk bantuan.`
    });
  }
  if (user.accountStatus === 'terminated') {
    return res.status(403).json({
      success: false,
      terminated: true,
      message: 'Kemitraan akun Anda telah dinonaktifkan secara permanen (Terminated).'
    });
  }

  if (user.role === 'mitra') {
    user.status = 'ready';
    user.lastActive = new Date().toISOString();
    db.set('users', users);
    io.emit('mitra:status_change', { mitraId: user.id, status: 'ready', name: user.name, lat: user.lat, lng: user.lng });
    io.emit('mitra:online', user);
  }

  res.json({
    success: true,
    message: `Selamat datang kembali, ${user.name}!`,
    data: user
  });
});

/* ========================================================
 * LUPA KATA SANDI / RESET PASSWORD PENGGUNA VIA OTP
 * ======================================================== */
app.post('/api/auth/reset-password', (req, res) => {
  const { phone, otp, newPassword, role, name, email } = req.body;
  if (!phone || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Nomor HP, kode OTP, dan kata sandi baru wajib diisi.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Kata sandi baru minimal 6 karakter.' });
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  let entry = db.getOtp(cleanPhone);
  if (!entry && req.body.deliveryPhone) {
    entry = db.getOtp(req.body.deliveryPhone.replace(/[^0-9]/g, ''));
  }
  const isMatch = entry && (entry.code === otp.toString().trim());

  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Kode OTP salah atau telah kedaluwarsa. Silakan minta kode OTP baru.' });
  }

  const users = db.get('users') || [];
  let user = users.find(u => {
    const userClean = (u.phone || '').replace(/[^0-9]/g, '');
    return userClean === cleanPhone ||
           (userClean.length >= 9 && cleanPhone.endsWith(userClean.slice(-9))) ||
           (cleanPhone.length >= 9 && userClean.endsWith(cleanPhone.slice(-9)));
  });

  if (!user) {
    // Otomatis buatkan akun resmi langsung aktif jika nomor belum terdaftar
    const isMitra = (role === 'mitra');
    const userId = (isMitra ? 'MTR-' : 'KLN-') + Date.now().toString().slice(-4);
    const formattedPhone = cleanPhone.startsWith('0') ? cleanPhone : ('0' + cleanPhone);
    user = {
      id: userId,
      name: name || ('Pengguna ' + cleanPhone.slice(-4)),
      phone: formattedPhone,
      email: email || `${cleanPhone}@sobatserabut.id`,
      password: newPassword.trim(),
      role: isMitra ? 'mitra' : 'klien',
      avatar: isMitra ? '/uploads/avatar_driver.svg' : '/uploads/avatar_klien.svg',
      walletBalance: 0,
      address: 'Indonesia',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    if (isMitra) {
      user.status = 'ready';
      user.rating = 5.0;
      user.completedOrders = 0;
      user.cancelRate = 0.0;
      user.earnings = 0;
      user.isPremium = false;
      user.kycStatus = 'approved';
      user.nik = '';
      user.skills = ['Kurir & Pengiriman', 'Ojek / Transportasi'];
      user.vehicle = { type: 'motor', plate: 'B 1234 SB' };
    } else {
      user.totalOrdersPosted = 0;
      user.paymentAccount = {
        type: 'bca_va',
        accountNumber: '88019-' + cleanPhone.slice(-6),
        accountHolder: user.name,
        active: true
      };
    }
    users.unshift(user);
  } else {
    user.password = newPassword.trim();
    user.lastActive = new Date().toISOString();
  }

  db.set('users', users);
  db.save();
  db.deleteOtp(cleanPhone);

  console.log(`🔑 [PASSWORD RESET] Kata sandi untuk pengguna ${user.name} (${user.phone}) berhasil diperbarui.`);
  res.json({
    success: true,
    message: 'Kata sandi berhasil diperbarui! Akun Anda langsung aktif dengan kata sandi baru.',
    data: user
  });
});

/* --------------------------------------------------------
 * SAMBUNGKAN AKUN GOOGLE DENGAN NOMOR HP PENGGUNA PERANGKAT
 * (Bukan nomor demo atau sembarangan)
 * -------------------------------------------------------- */
app.post('/api/auth/google-connect', (req, res) => {
  const { phone, email, name, avatar, role = 'klien', googleId } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Nomor WhatsApp / HP yang terdaftar di perangkat wajib diisi.' });
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 9) {
    return res.status(400).json({ success: false, message: 'Format nomor HP tidak valid. Minimal 9 digit.' });
  }

  const users = db.get('users') || [];
  let user = users.find(u => {
    const userClean = (u.phone || '').replace(/[^0-9]/g, '');
    return userClean === cleanPhone ||
           (userClean.length >= 9 && cleanPhone.endsWith(userClean.slice(-9))) ||
           (cleanPhone.length >= 9 && userClean.endsWith(cleanPhone.slice(-9)));
  });

  if (user) {
    // Hubungkan akun terdaftar nomor HP tersebut dengan Google
    user.googleConnected = true;
    if (email) user.googleEmail = email;
    if (googleId) user.googleId = googleId;
    if (name && (!user.name || user.name.startsWith('Pengguna'))) user.name = name;
    user.lastLogin = new Date().toISOString();
    user.lastActive = new Date().toISOString();
    db.set('users', users);
    db.save();

    console.log(`🔗 [GOOGLE CONNECT] Akun Google terhubung ke akun HP nyata: ${user.name} (${user.phone})`);
    return res.json({
      success: true,
      isNewUser: false,
      message: `Akun Google berhasil dihubungkan ke nomor HP terdaftar Anda (${user.phone})!`,
      data: user
    });
  }

  // Daftarkan pengguna baru dengan nomor HP nyata dari perangkat peminta
  const isMitra = (role === 'mitra');
  const userId = (isMitra ? 'MTR-' : 'KLN-') + Date.now().toString().slice(-4);
  const formattedPhone = cleanPhone.startsWith('0') ? cleanPhone : ('0' + cleanPhone);
  const userName = name || (email ? email.split('@')[0] : ('Pengguna ' + cleanPhone.slice(-4)));
  const userAvatar = avatar || (isMitra ? '/uploads/avatar_driver.svg' : '/uploads/avatar_klien.svg');

  const newUser = {
    id: userId,
    name: userName,
    phone: formattedPhone,
    email: email || `${cleanPhone}@gmail.com`,
    password: `SB_${cleanPhone.slice(-6)}`,
    role: isMitra ? 'mitra' : 'klien',
    avatar: userAvatar,
    walletBalance: 0,
    address: 'Indonesia',
    googleConnected: true,
    googleId: googleId || `goog_${Date.now()}`,
    googleEmail: email || `${cleanPhone}@gmail.com`,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  if (isMitra) {
    newUser.status = 'ready';
    newUser.rating = 5.0;
    newUser.completedOrders = 0;
    newUser.cancelRate = 0.0;
    newUser.earnings = 0;
    newUser.isPremium = false;
    newUser.kycStatus = 'approved';
    newUser.nik = '';
    newUser.skills = ['Kurir & Pengiriman', 'Ojek / Transportasi'];
    newUser.vehicle = { type: 'motor', plate: 'B 1234 SB' };
  } else {
    newUser.totalOrdersPosted = 0;
    newUser.paymentAccount = {
      type: 'bca_va',
      accountNumber: '88019-' + cleanPhone.slice(-6),
      accountHolder: userName,
      active: true
    };
  }

  users.unshift(newUser);
  db.set('users', users);
  db.save();

  console.log(`✅ [GOOGLE REGISTER] Pengguna baru didaftarkan via Google dengan nomor HP nyata: ${userName} (${formattedPhone})`);

  res.json({
    success: true,
    isNewUser: true,
    message: `Pendaftaran berhasil! Akun Google telah terhubung ke nomor HP ${formattedPhone}.`,
    data: newUser
  });
});

/* --------------------------------------------------------
 * OTP VIA WHATSAPP & SMS (PENDAFTARAN AKUN, LUPA KATA SANDI & LOGIN CEPAT)
 * -------------------------------------------------------- */
app.post('/api/auth/send-otp', async (req, res) => {
  const { phone, method, deliveryPhone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Nomor HP wajib diisi.' });
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 9) {
    return res.status(400).json({ success: false, message: 'Format nomor HP tidak valid. Minimal 9 digit.' });
  }

  // Nomor tujuan fisik pengiriman OTP (bisa sama atau nomor HP lain yang sedang dipegang)
  const targetPhone = (deliveryPhone && deliveryPhone.toString().replace(/[^0-9]/g, '').length >= 9)
    ? deliveryPhone.toString().trim()
    : phone;
  const cleanTargetPhone = targetPhone.replace(/[^0-9]/g, '');

  const sendMethod = (method === 'sms') ? 'sms' : 'whatsapp';
  // Buat kode OTP 6-digit acak nyata
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Simpan kode OTP untuk kedua nomor (nomor akun & nomor pengiriman penerima)
  db.setOtp(cleanPhone, {
    code: code,
    method: sendMethod,
    phone: phone,
    deliveryPhone: targetPhone
  });
  if (cleanTargetPhone && cleanTargetPhone !== cleanPhone) {
    db.setOtp(cleanTargetPhone, {
      code: code,
      method: sendMethod,
      phone: phone,
      deliveryPhone: targetPhone
    });
  }

  console.log(`====================================================`);
  console.log(`📩 [OTP DISPATCH] Metode: ${sendMethod.toUpperCase()}`);
  console.log(`📱 Nomor Akun: ${phone} (${cleanPhone})`);
  console.log(`🎯 Nomor HP Penerima OTP: ${targetPhone} (${cleanTargetPhone})`);
  console.log(`🔑 Kode OTP Nyata Dihasilkan: ${code}`);
  console.log(`====================================================`);

  let sendResult = null;
  if (sendMethod === 'whatsapp') {
    sendResult = await sendOtpWhatsApp(targetPhone, code);
  } else {
    sendResult = await sendOtpSMS(targetPhone, code);
  }

  const senderNumber = getOtpSenderNumber();
  const methodText = (sendResult && sendResult.fallback) ? 'WhatsApp (dialihkan dari SMS)' : (sendMethod === 'whatsapp' ? 'WhatsApp' : 'SMS');

  console.log(`✅ [OTP PROCESSED] Kode ${code} dikirim ke ${cleanTargetPhone} via ${methodText}`);

  res.json({
    success: true,
    message: `Kode OTP 6-digit berhasil diproses dan dikirim via ${methodText} dari Bot ${senderNumber} ("jangan berikan kode otp ini kepada siapapun") ke nomor ${targetPhone}.`,
    method: sendMethod,
    sender: senderNumber,
    fallback: !!(sendResult && sendResult.fallback),
    devOtp: code, // Selalu sertakan devOtp agar pengguna langsung menerima kode di layar & WhatsApp tanpa tertahan antrean jaringan
    phone: phone,
    deliveryPhone: targetPhone,
    expiresIn: 300
  });
});

app.get('/api/auth/latest-otp', (req, res) => {
  const { phone } = req.query;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Nomor HP diperlukan.' });
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  let entry = db.getOtp(cleanPhone);
  if (!entry && req.body.deliveryPhone) {
    entry = db.getOtp(req.body.deliveryPhone.replace(/[^0-9]/g, ''));
  }
  if (!entry) {
    return res.json({ success: false, message: 'Tidak ada kode OTP aktif untuk nomor ini.' });
  }
  res.json({
    success: true,
    phone: phone,
    otp: entry.code,
    method: entry.method,
    createdAt: entry.createdAt,
    expiresIn: Math.max(0, Math.floor((300000 - (Date.now() - entry.createdAt)) / 1000)),
    message: `Kode OTP aktif: ${entry.code}`
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const {
    phone, otp, name, role, email, password, skills, vehicle, address,
    nik, ktpPhoto, selfieKtpPhoto, avatarPhoto,
    bankName, bankAccount, bankHolder,
    clientPaymentType, clientPaymentProvider, clientAccountNo, clientAccountName
  } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: 'Nomor HP dan kode OTP wajib diisi.' });
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  let entry = db.getOtp(cleanPhone);
  if (!entry && req.body.deliveryPhone) {
    entry = db.getOtp(req.body.deliveryPhone.replace(/[^0-9]/g, ''));
  }

  const isMatch = entry && (entry.code === otp.toString().trim());

  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Kode OTP salah atau telah kedaluwarsa. Silakan minta kode baru.' });
  }

  // OTP Valid! Periksa apakah pengguna sudah ada di database
  const users = db.get('users') || [];
  let user = users.find(u => {
    const userClean = (u.phone || '').replace(/[^0-9]/g, '');
    const phoneMatch = userClean === cleanPhone ||
           (userClean.length >= 9 && cleanPhone.endsWith(userClean.slice(-9))) ||
           (cleanPhone.length >= 9 && userClean.endsWith(cleanPhone.slice(-9)));
    // Jika verifikasi dari registrasi mitra/driver, hanya cocokkan mitra
    if (role === 'mitra') return phoneMatch && u.role === 'mitra';
    if (role === 'klien') return phoneMatch && u.role === 'klien';
    return phoneMatch;
  });

  if (user) {
    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        suspended: true,
        message: `Akun Anda sedang ditangguhkan (Suspended) oleh Admin. Alasan: ${user.suspendReason || 'Pemeriksaan kepatuhan'}. Hubungi Admin untuk bantuan.`
      });
    }
    if (user.accountStatus === 'terminated') {
      return res.status(403).json({
        success: false,
        terminated: true,
        message: 'Kemitraan akun Anda telah dinonaktifkan secara permanen (Terminated).'
      });
    }

    // Pengguna sudah terdaftar: langsung login
    db.deleteOtp(cleanPhone);
    if (user.role === 'mitra') {
      user.status = 'ready';
      user.lastActive = new Date().toISOString();
      db.set('users', users);
      io.emit('mitra:status_change', { mitraId: user.id, status: 'ready', name: user.name, lat: user.lat, lng: user.lng });
      io.emit('mitra:online', user);
    }

    return res.json({
      success: true,
      isNewUser: false,
      message: `Login berhasil via OTP! Selamat datang kembali, ${user.name}.`,
      data: user
    });
  }

  // Pengguna belum terdaftar: buat akun baru
  if ((name && role) || (phone && password)) {
    if (!password || password.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Harap tentukan kata sandi akun minimal 6 karakter.' });
    }

    const assignedRole = role || 'klien';
    const assignedName = (name && name.trim()) ? name.trim() : `Sobat ${cleanPhone.slice(-4)}`;
    const isMitra = assignedRole === 'mitra';
    const prefix = isMitra ? 'MTR' : 'KLN';
    const newUserId = `${prefix}-${Date.now().toString().slice(-4)}`;

    let userAvatar = isMitra ? '/uploads/avatar_mitra.svg' : '/uploads/avatar_klien.svg';
    if (avatarPhoto) {
      userAvatar = saveBase64Image(avatarPhoto, 'avatar');
    }

    const reqLat = Number(req.body.lat);
    const reqLng = Number(req.body.lng);
    const userLat = (!isNaN(reqLat) && reqLat !== 0) ? reqLat : -6.2088;
    const userLng = (!isNaN(reqLng) && reqLng !== 0) ? reqLng : 106.8456;

    const newUser = {
      id: newUserId,
      name: assignedName,
      phone: phone.trim(),
      email: email || `${cleanPhone}@sobatserabut.id`,
      password: password.trim(),
      role: assignedRole,
      avatar: userAvatar,
      address: address || 'Indonesia',
      lat: userLat,
      lng: userLng,
      walletBalance: 0,
      createdAt: new Date().toISOString()
    };

    if (isMitra) {
      const valRes = validateIndonesianBankOrEwallet(bankName, bankAccount, cleanPhone, bankHolder);
      if (!valRes.valid) {
        return res.status(400).json({ success: false, message: valRes.message });
      }

      const processedKtp = saveBase64Image(ktpPhoto, 'ktp') || '';
      const processedSelfie = saveBase64Image(selfieKtpPhoto || avatarPhoto, 'selfie') || '';

      newUser.status = 'ready';
      newUser.accountStatus = 'active';
      newUser.points = 100;
      newUser.pointHistory = [{
        id: `PTS-${Date.now().toString().slice(-5)}`,
        timestamp: new Date().toISOString(),
        action: 'initial',
        change: 100,
        newTotal: 100,
        reason: 'Poin apresiasi pendaftaran Driver SobatSerabut'
      }];
      newUser.rating = 5.0;
      newUser.completedOrders = 0;
      newUser.cancelRate = 0.0;
      newUser.earnings = 0;
      newUser.isPremium = false;
      newUser.kycStatus = 'approved';
      newUser.nik = nik ? nik.replace(/[^0-9]/g, '').slice(0, 16) : '';
      newUser.ktpPhoto = processedKtp;
      newUser.selfieKtpPhoto = processedSelfie;
      newUser.skills = Array.isArray(skills) ? skills : [skills || "Runner / Belanja Kilat"];
      newUser.vehicle = vehicle || "Sepeda Motor";
      newUser.bankDetails = {
        bankName: bankName || 'DANA',
        bankAccount: bankAccount || cleanPhone,
        bankHolder: bankHolder || name
      };

      const kycRequests = db.get('kycRequests') || [];
      const newKyc = {
        id: `KYC-${Date.now().toString().slice(-4)}`,
        mitraId: newUser.id,
        mitraName: newUser.name,
        phone: newUser.phone,
        nik: newUser.nik,
        address: newUser.address,
        bankDetails: newUser.bankDetails,
        ktpImageUrl: processedKtp,
        selfieImageUrl: processedSelfie || userAvatar,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        reviewNotes: 'Data pendaftaran mitra via OTP, foto e-KTP & selfie siap dikonfirmasi di Dashboard Admin.'
      };
      kycRequests.unshift(newKyc);
      db.set('kycRequests', kycRequests);
      newUser.kycStatus = 'pending';
      io.emit('kyc:new', newKyc);
      io.emit('mitra:status_change', { mitraId: newUser.id, status: 'ready', name: newUser.name, lat: newUser.lat, lng: newUser.lng });
      io.emit('mitra:online', newUser);
    } else {
      newUser.totalOrdersPosted = 0;
      newUser.paymentAccount = {
        type: clientPaymentType || 'ewallet',
        provider: clientPaymentProvider || 'DANA',
        accountNo: clientAccountNo || cleanPhone,
        accountName: clientAccountName || name
      };
    }

    users.unshift(newUser);
    db.set('users', users);
    db.deleteOtp(cleanPhone);

    io.emit('user:registered', { id: newUser.id, name: newUser.name, role: newUser.role });

    return res.json({
      success: true,
      isNewUser: true,
      message: isMitra
        ? `Pendaftaran Mitra Driver berhasil! Akun Anda telah aktif dan siap menerima order tugas.`
        : `Pendaftaran Pemohon Jasa (Klien) berhasil! Selamat datang di SobatSerabut.`,
      data: newUser
    });
  }

  // Jika belum ada data profil, tandai OTP valid agar frontend meminta data profil
  return res.json({
    success: true,
    isNewUser: true,
    phone: phone,
    message: 'Nomor HP terverifikasi! Silakan lengkapi data pendaftaran Anda.'
  });
});


app.get('/api/maps/config', (req, res) => {
  const config = db.get('config') || {};
  res.json({
    success: true,
    data: {
      googleMapsApiKey: config.googleMapsApiKey || '',
      mapProvider: config.mapProvider || 'google_roadmap',
      center: [-6.1754, 106.8272],
      zoom: 13
    }
  });
});

app.get('/api/auth/profile/:id', (req, res) => {
  const users = db.get('users') || [];
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  res.json({ success: true, data: user });
});

// Update Profile & Avatar (Foto profil asli hanya saat pendaftaran atau update profil)
app.post('/api/auth/update-avatar', (req, res) => {
  const { userId, avatarPhoto } = req.body;
  if (!userId || !avatarPhoto) {
    return res.status(400).json({ success: false, message: 'Data foto dan User ID diperlukan.' });
  }
  const users = db.get('users') || [];
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });

  const savedUrl = saveBase64Image(avatarPhoto, 'avatar');
  users[idx].avatar = savedUrl;
  db.set('users', users);

  io.emit('user:avatar_updated', { userId: users[idx].id, avatar: savedUrl });
  res.json({ success: true, message: 'Foto profil resmi berhasil disimpan!', avatarUrl: savedUrl, user: users[idx] });
});

app.post('/api/auth/profile/:id', (req, res) => {
  const users = db.get('users') || [];
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });

  const { name, address, structuredAddress, addresses, avatarPhoto, bankName, bankAccount, bankHolder } = req.body;
  if (name && name.trim()) users[idx].name = name.trim();
  if (address && address.trim()) users[idx].address = address.trim();
  if (structuredAddress) {
    users[idx].structuredAddress = structuredAddress;
    if (structuredAddress.fullAddress) users[idx].address = structuredAddress.fullAddress;
    if (!users[idx].addresses) users[idx].addresses = [];
    const exists = users[idx].addresses.some(a => a.fullAddress === structuredAddress.fullAddress);
    if (!exists) users[idx].addresses.push(structuredAddress);
  }
  if (addresses && Array.isArray(addresses)) {
    users[idx].addresses = addresses;
  }
  if (avatarPhoto) {
    users[idx].avatar = saveBase64Image(avatarPhoto, 'avatar');
  }
  if (bankName || bankAccount || bankHolder) {
    users[idx].bankDetails = {
      bankName: bankName || users[idx].bankDetails?.bankName || 'SeaBank',
      bankAccount: bankAccount || users[idx].bankDetails?.bankAccount || '',
      bankHolder: bankHolder || users[idx].bankDetails?.bankHolder || users[idx].name
    };
  }
  db.set('users', users);
  res.json({ success: true, message: 'Profil dan alamat akun berhasil diperbarui!', data: users[idx] });
});

// Top-Up Dompet Riil Klien (Melalui Rekening Resmi Admin: QRIS, SeaBank 901771223812, GoPay 087735170386)
app.post('/api/auth/topup', (req, res) => {
  const { userId, amount, paymentMethod, proofPhoto, senderAccountName, senderAccountNo } = req.body;
  const users = db.get('users') || [];
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 10000) {
    return res.status(400).json({ success: false, message: 'Minimal pengisian saldo dompet adalah Rp 10.000' });
  }

  let savedProof = null;
  if (proofPhoto) {
    savedProof = saveBase64Image(proofPhoto, 'topup');
  }

  const validMethods = ['qris', 'seabank', 'gopay'];
  const method = validMethods.includes((paymentMethod || '').toLowerCase()) ? paymentMethod.toLowerCase() : 'qris';

  const methodLabels = {
    seabank: 'SeaBank (No: 901771223812 - a/n SobatSerabut Admin)',
    gopay: 'GoPay (No: 087735170386 - a/n SobatSerabut Admin)',
    qris: 'QRIS SobatSerabut Resmi'
  };

  users[idx].walletBalance = (users[idx].walletBalance || 0) + numAmount;
  db.set('users', users);

  const transactions = db.get('transactions') || [];
  const topupRecord = {
    id: `TOP-${Date.now().toString().slice(-4)}`,
    type: 'topup',
    amount: numAmount,
    userId: users[idx].id,
    userName: users[idx].name,
    userPhone: users[idx].phone,
    paymentMethod: method,
    paymentDestination: methodLabels[method] || methodLabels.qris,
    senderAccountName: senderAccountName || users[idx].name,
    senderAccountNo: senderAccountNo || users[idx].phone,
    proofPhoto: savedProof,
    status: 'success',
    description: `Top-up Saldo Klien via ${methodLabels[method]}`,
    timestamp: new Date().toISOString()
  };

  transactions.unshift(topupRecord);
  db.set('transactions', transactions);

  io.emit('wallet:topup_received', topupRecord);
  io.emit('user:balance_update', { userId: users[idx].id, newBalance: users[idx].walletBalance });

  res.json({
    success: true,
    message: `Top-up saldo sebesar Rp ${numAmount.toLocaleString('id-ID')} via ${methodLabels[method]} berhasil masuk ke dompet Anda!`,
    newBalance: users[idx].walletBalance,
    data: topupRecord
  });
});

/* ========================================================
 * VIRTUAL ACCOUNT APLIKASI SENDIRI: TOP UP OTOMATIS
 * Saldo langsung masuk ke dompet Klien & Driver Mitra
 * Saluran: E-Wallet, Rekening Bank, Alfamart, Indomaret
 * ======================================================== */
app.post('/api/wallet/generate-va', (req, res) => {
  const { userId, amount, channel } = req.body;
  const users = db.get('users') || [];
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

  const cleanPhone = (user.phone || '').replace(/[^0-9]/g, '');
  const numAmount = Number(amount) || 25000;
  const ch = (channel || 'seabank').toLowerCase();

  let vaNumber = '';
  let channelName = '';
  let accountHolder = 'SobatSerabut Admin';
  let instructions = [];

  switch (ch) {
    case 'seabank':
      channelName = 'SeaBank Direct / Virtual Account';
      vaNumber = '901771223812';
      instructions = [
        'Buka aplikasi SeaBank atau m-Banking bank mana saja.',
        'Pilih menu Transfer > Antar Bank / Ke Rekening SeaBank.',
        'Nomor Rekening Tujuan: 901771223812 a.n SobatSerabut Admin.',
        `Masukkan nominal tepat: Rp ${numAmount.toLocaleString('id-ID')}.`,
        'Konfirmasi pembayaran. Saldo otomatis masuk ke dompet aplikasi seketika!'
      ];
      break;
    case 'bca_va':
      channelName = 'BCA Virtual Account';
      vaNumber = '88077' + cleanPhone;
      instructions = [
        'Buka BCA mobile / KlikBCA / ATM BCA.',
        'Pilih menu Transfer > Ke BCA Virtual Account.',
        `Nomor Virtual Account SobatSerabut: ${vaNumber}.`,
        `Nominal tagihan otomatis terisi: Rp ${numAmount.toLocaleString('id-ID')}.`,
        'Selesaikan pembayaran. Saldo dompet Anda otomatis terisi!'
      ];
      break;
    case 'bri_va':
      channelName = 'BRI BRIVA';
      vaNumber = '12877' + cleanPhone;
      instructions = [
        'Buka aplikasi BRImo atau ATM BRI.',
        'Pilih Pembayaran / Bayar > BRIVA.',
        `Nomor BRIVA SobatSerabut: ${vaNumber}.`,
        'Konfirmasi dan selesaikan pembayaran.',
        'Saldo otomatis masuk ke dompet akun Anda.'
      ];
      break;
    case 'mandiri_va':
      channelName = 'Mandiri Virtual Account / Livin';
      vaNumber = '89077' + cleanPhone;
      instructions = [
        'Buka aplikasi Livin\' by Mandiri atau ATM Mandiri.',
        'Pilih Bayar > Multipayment > Kode SobatSerabut 89077.',
        `Nomor VA: ${vaNumber}.`,
        'Konfirmasi nama dan jumlah bayar untuk top-up instan.'
      ];
      break;
    case 'bni_va':
      channelName = 'BNI Virtual Account';
      vaNumber = '98077' + cleanPhone;
      instructions = [
        'Buka BNI Mobile Banking / ATM BNI.',
        'Pilih menu Transfer > Virtual Account Billing.',
        `Nomor VA: ${vaNumber}.`,
        'Konfirmasi dan saldo dompet langsung masuk.'
      ];
      break;
    case 'dana':
      channelName = 'E-Wallet DANA';
      vaNumber = '087735170386';
      instructions = [
        'Buka aplikasi DANA.',
        'Pilih menu Kirim > Kirim ke Nomor HP.',
        'Nomor Akun SobatSerabut: 087735170386 a.n SobatSerabut Admin.',
        `Kirim nominal Rp ${numAmount.toLocaleString('id-ID')}.`,
        'Konfirmasi transfer saldo otomatis bertambah.'
      ];
      break;
    case 'gopay':
      channelName = 'E-Wallet GoPay';
      vaNumber = '087735170386';
      instructions = [
        'Buka aplikasi GoPay atau Gojek.',
        'Pilih menu Transfer / Kirim ke Kontak HP.',
        'Tujuan: 087735170386 a.n SobatSerabut Admin.',
        `Kirim nominal Rp ${numAmount.toLocaleString('id-ID')}.`,
        'Saldo langsung bertambah di dompet SobatSerabut Anda.'
      ];
      break;
    case 'ovo':
      channelName = 'E-Wallet OVO';
      vaNumber = '087735170386';
      instructions = [
        'Buka aplikasi OVO.',
        'Pilih Transfer > Ke Sesama OVO.',
        'Nomor: 087735170386 a.n SobatSerabut Admin.',
        `Kirim nominal Rp ${numAmount.toLocaleString('id-ID')}. Saldo dompet otomatis masuk.`
      ];
      break;
    case 'shopeepay':
      channelName = 'ShopeePay';
      vaNumber = '087735170386';
      instructions = [
        'Buka aplikasi Shopee > ShopeePay.',
        'Pilih Transfer ke Kontak / Nomor HP.',
        'Tujuan: 087735170386 a.n SobatSerabut Admin.',
        `Transfer Rp ${numAmount.toLocaleString('id-ID')} saldo otomatis masuk.`
      ];
      break;
    case 'alfamart':
      channelName = 'Gerai Retail Alfamart';
      vaNumber = 'SS-ALFA-' + (cleanPhone.slice(-6) || '888888');
      instructions = [
        'Kunjungi gerai Alfamart / Alfamidi / Dan+Dan terdekat.',
        'Sampaikan ke kasir: "Pembayaran Merchant SobatSerabut".',
        `Tunjukkan Kode Pembayaran Kasir: ${vaNumber}.`,
        `Bayar sesuai nominal: Rp ${numAmount.toLocaleString('id-ID')}.`,
        'Simpan struk kasir. Saldo aplikasi otomatis bertambah seketika!'
      ];
      break;
    case 'indomaret':
      channelName = 'Gerai Retail Indomaret';
      vaNumber = 'SS-INDO-' + (cleanPhone.slice(-6) || '888888');
      instructions = [
        'Kunjungi gerai Indomaret / Ceriamart / Indogrosir terdekat.',
        'Sampaikan ke kasir: "Pembayaran Tagihan SobatSerabut".',
        `Tunjukkan Kode Pembayaran Kasir: ${vaNumber}.`,
        `Bayar sesuai nominal: Rp ${numAmount.toLocaleString('id-ID')}.`,
        'Ambil struk bukti bayar. Saldo dompet otomatis masuk ke akun Anda!'
      ];
      break;
    default:
      channelName = 'Virtual Account SobatSerabut';
      vaNumber = '901771223812';
      instructions = ['Gunakan nomor Virtual Account untuk transfer otomatis.'];
  }

  res.json({
    success: true,
    data: {
      userId: user.id,
      userName: user.name,
      amount: numAmount,
      channel: ch,
      channelName,
      vaNumber,
      accountHolder,
      instructions,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    }
  });
});

app.post('/api/wallet/pay-va', (req, res) => {
  const { userId, amount, channel, vaNumber } = req.body;
  const numAmount = Number(amount);
  if (!userId || isNaN(numAmount) || numAmount < 10000) {
    return res.status(400).json({ success: false, message: 'Nominal top up minimal Rp 10.000.' });
  }

  const users = db.get('users') || [];
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

  users[idx].walletBalance = (users[idx].walletBalance || 0) + numAmount;
  db.set('users', users);

  const nowIso = new Date().toISOString();
  const chName = (channel || 'Virtual Account').toUpperCase();
  const transactions = db.get('transactions') || [];
  const topupTrx = {
    id: `TOP-${Date.now().toString().slice(-4)}`,
    type: 'topup_va',
    amount: numAmount,
    userId: users[idx].id,
    userName: users[idx].name,
    userRole: users[idx].role,
    channel: channel || 'va',
    vaNumber: vaNumber || '901771223812',
    status: 'success',
    description: `Top-up Saldo via ${chName} (${vaNumber || 'Auto-VA'})`,
    timestamp: nowIso
  };

  transactions.unshift(topupTrx);
  db.set('transactions', transactions);

  io.emit('wallet:topup_received', topupTrx);
  io.emit('user:balance_update', { userId: users[idx].id, newBalance: users[idx].walletBalance });

  res.json({
    success: true,
    message: `Top-up saldo sebesar Rp ${numAmount.toLocaleString('id-ID')} via ${chName} berhasil langsung masuk ke dompet Anda!`,
    newBalance: users[idx].walletBalance,
    data: topupTrx
  });
});

/* ========================================================
 * 2. REMOTE CONFIG & CMS SETTINGS API (KONTROL VIA LAPTOP)
 * ======================================================== */
// Health / Ping endpoint untuk deteksi koneksi internet & WiFi aktif
app.get('/api/ping', (req, res) => {
  res.json({
    success: true,
    online: true,
    status: 'connected',
    timestamp: Date.now(),
    serverTime: new Date().toISOString()
  });
});

app.get('/api/config', (req, res) => {
  res.json({ success: true, data: db.get('config') });
});

app.post('/api/config', requireAdminAuth, (req, res) => {
  if (req.body.radarRadiusMeters !== undefined) {
    let r = Number(req.body.radarRadiusMeters);
    if (isNaN(r) || r < 100) r = 100;
    if (r > 2000) r = 2000;
    req.body.radarRadiusMeters = r;
    req.body.maxRadiusKm = Number((r / 1000).toFixed(2));
  }
  const updated = db.updateConfig(req.body);
  io.emit('config:update', updated);
  io.emit('config:updated', updated);
  res.json({ success: true, message: 'Konfigurasi sistem berhasil diperbarui dari laptop admin', data: updated });
});

app.post('/api/config/toggle-maintenance', requireAdminAuth, (req, res) => {
  const config = db.get('config');
  const newStatus = req.body.maintenanceMode !== undefined ? req.body.maintenanceMode : !config.maintenanceMode;
  const message = req.body.maintenanceMessage || config.maintenanceMessage;
  
  const updated = db.updateConfig({ 
    maintenanceMode: newStatus,
    maintenanceMessage: message 
  });
  
  io.emit('maintenance:alert', { maintenanceMode: newStatus, maintenanceMessage: message });
  io.emit('config:update', updated);
  io.emit('config:updated', updated);
  res.json({ success: true, maintenanceMode: newStatus, message: `Mode pemeliharaan berhasil di-${newStatus ? 'AKTIFKAN' : 'NONAKTIFKAN'}` });
});

app.post('/api/config/upload-logo', requireAdminAuth, upload.single('logo'), (req, res) => {
  let logoUrl = '';
  if (req.file) {
    logoUrl = `/uploads/${req.file.filename}`;
  } else if (req.body.logoUrl) {
    logoUrl = req.body.logoUrl;
  } else if (req.body.logoPreset) {
    logoUrl = `/uploads/logo_sobatserabut.svg`;
  }

  const updated = db.updateConfig({
    logoUrl: logoUrl || db.get('config').logoUrl,
    logoPreset: req.body.logoPreset || db.get('config').logoPreset
  });

  io.emit('config:update', updated);
  io.emit('config:updated', updated);
  res.json({ success: true, message: 'Logo aplikasi berhasil diperbarui', data: updated });
});

/* ========================================================
 * UPLOAD ICON APLIKASI SOBATSERABUT.COM (FAVICON & APP ICON)
 * ======================================================== */
app.post('/api/config/upload-icon', requireAdminAuth, upload.single('icon'), (req, res) => {
  let iconUrl = '';
  if (req.file) {
    iconUrl = `/uploads/${req.file.filename}`;
  } else if (req.body.iconUrl) {
    iconUrl = req.body.iconUrl;
  } else if (req.body.iconPreset) {
    iconUrl = `/uploads/logo_icon.svg`;
  }

  const updated = db.updateConfig({
    appIconUrl: iconUrl || db.get('config').appIconUrl
  });

  // Sinkronisasi favicon fisik ke root dan direktori aplikasi
  try {
    if (req.file) {
      const srcPath = path.join(UPLOADS_DIR, req.file.filename);
      const targets = [
        path.join(__dirname, '../mitra-app/favicon.ico'),
        path.join(__dirname, '../favicon.ico'),
        path.join(__dirname, '../admin-dashboard/favicon.ico'),
        path.join(__dirname, '../mitra-app/img/logo_icon.png')
      ];
      for (const t of targets) {
        try { fs.copyFileSync(srcPath, t); } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('Sinkronisasi file favicon parsial:', err.message);
  }

  io.emit('config:update', updated);
  io.emit('config:updated', updated);
  res.json({ 
    success: true, 
    message: 'Ikon aplikasi sobatserabut.com berhasil diperbarui dan disinkronkan ke seluruh ekosistem!', 
    data: updated 
  });
});

/* ========================================================
 * TES KONEKSI BOT WHATSAPP FONNTE (NOMOR 087791201091)
 * ======================================================== */
app.post('/api/admin/test-fonnte', requireAdminAuth, async (req, res) => {
  const token = req.body.token || db.get('config')?.fonnteToken;
  const result = await testFonnteDeviceStatus(token);
  const senderNumber = getOtpSenderNumber();
  if (result.success && result.data && result.data.status !== false) {
    res.json({
      success: true,
      message: `✅ Bot Fonnte Aktif! Terhubung untuk nomor bot: ${senderNumber}`,
      data: result.data
    });
  } else {
    const reason = (result.data && result.data.reason) ? result.data.reason : (result.error || 'Perangkat belum terhubung');
    res.json({
      success: false,
      message: `Gateway Fonnte merespons: "${reason}". Masukkan token Fonnte yang aktif untuk nomor ${senderNumber}.`,
      error: reason
    });
  }
});

/* ========================================================
 * TRIGGER SINKRONISASI & BUILD APK ANDROID TERBARU
 * ======================================================== */
app.post('/api/admin/trigger-build-apk', requireAdminAuth, (req, res) => {
  const { exec } = require('child_process');
  const scriptPath = path.join(__dirname, '../android-app/build_apk.sh');
  exec(`bash "${scriptPath}"`, (err, stdout, stderr) => {
    if (err) {
      console.error('Build APK error:', err);
    } else {
      console.log('Build APK berhasil dikompilasi via remote admin trigger');
    }
  });
  res.json({ 
    success: true, 
    message: 'Kompilasi APK Android telah dijalankan di latar belakang dengan aset dan icon terbaru!' 
  });
});

// Dynamic manifest.json endpoint
app.get(['/manifest.json', '/mitra/manifest.json'], (req, res) => {
  const config = db.get('config') || {};
  const iconSrc = config.appIconUrl || config.logoUrl || '/uploads/logo_icon.svg';
  const manifest = {
    name: config.appName || "SobatSerabut",
    short_name: config.appName || "SobatSerabut",
    start_url: "./index.html",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: config.primaryColor || "#1E40AF",
    orientation: "portrait",
    description: config.appTagline || "Solusi Cepat Serabutan & Jasa Harian",
    icons: [
      {
        src: iconSrc,
        sizes: "192x192",
        type: iconSrc.endsWith('.svg') ? "image/svg+xml" : "image/png",
        purpose: "any maskable"
      },
      {
        src: iconSrc,
        sizes: "512x512",
        type: iconSrc.endsWith('.svg') ? "image/svg+xml" : "image/png",
        purpose: "any maskable"
      }
    ]
  };
  res.json(manifest);
});


/* ========================================================
 * 3. KATEGORI JASA API (CMS)
 * ======================================================== */
app.get('/api/categories', (req, res) => {
  res.json({ success: true, data: db.get('categories') });
});

app.post('/api/categories', requireAdminAuth, (req, res) => {
  const categories = db.get('categories') || [];
  const cname = (req.body.name || '').toLowerCase();
  let defaultImg = '/uploads/service_runner.png';
  if (cname.includes('ac')) defaultImg = '/uploads/service_ac.png';
  else if (cname.includes('bersih') || cname.includes('clean')) defaultImg = '/uploads/service_clean.png';
  else if (cname.includes('angkat') || cname.includes('pindah') || cname.includes('truck')) defaultImg = '/uploads/service_lifting.png';
  else if (cname.includes('ledeng') || cname.includes('pipa') || cname.includes('plumber') || cname.includes('pompa')) defaultImg = '/uploads/service_plumber.png';
  else if (cname.includes('listrik') || cname.includes('instalasi') || cname.includes('electric') || cname.includes('bolt')) defaultImg = '/uploads/service_electric.png';
  else if (cname.includes('runner') || cname.includes('belanja') || cname.includes('pasar') || cname.includes('titip')) defaultImg = '/uploads/service_runner.png';
  else if (cname.includes('kayu') || cname.includes('pertukangan') || cname.includes('carpentry') || cname.includes('kusen') || cname.includes('cat')) defaultImg = '/uploads/service_carpentry.png';
  else if (cname.includes('ban') || cname.includes('tambal') || cname.includes('darurat') || cname.includes('tire')) defaultImg = '/uploads/service_tire.png';
  else if (cname.includes('cuci') || cname.includes('mesin') || cname.includes('washer')) defaultImg = '/uploads/service_washing.png';

  const newCat = {
    id: `cat-${Date.now()}`,
    name: req.body.name,
    icon: req.body.icon || 'screwdriver-wrench',
    image: req.body.image || defaultImg,
    baseFare: Number(req.body.baseFare) || 30000,
    description: req.body.description || '',
    active: req.body.active !== undefined ? req.body.active : true
  };
  categories.push(newCat);
  db.set('categories', categories);
  io.emit('categories:update', categories);
  io.emit('categories:updated', categories);
  res.json({ success: true, message: 'Kategori baru berhasil ditambahkan', data: newCat });
});

app.put('/api/categories/:id', requireAdminAuth, (req, res) => {
  const categories = db.get('categories') || [];
  const idx = categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
  
  categories[idx] = { ...categories[idx], ...req.body };
  if (req.body.baseFare) categories[idx].baseFare = Number(req.body.baseFare);
  db.set('categories', categories);
  io.emit('categories:update', categories);
  io.emit('categories:updated', categories);
  res.json({ success: true, message: 'Kategori berhasil diperbarui', data: categories[idx] });
});

app.delete('/api/categories/:id', requireAdminAuth, (req, res) => {
  let categories = db.get('categories') || [];
  categories = categories.filter(c => c.id !== req.params.id);
  db.set('categories', categories);
  io.emit('categories:update', categories);
  io.emit('categories:updated', categories);
  res.json({ success: true, message: 'Kategori berhasil dihapus' });
});

/* ========================================================
 * 4. MITRA PEKERJA API (Tracking, Status, GPS)
 * ======================================================== */
app.get('/api/mitra', (req, res) => {
  // Ambil mitra dari tabel users (role === 'mitra') — data nyata dari pendaftaran
  const users = db.get('users') || [];
  const mitraUsers = users.filter(u => u.role === 'mitra');
  res.json({ success: true, data: mitraUsers });
});

app.get('/api/mitra/:id', (req, res) => {
  // Cari mitra berdasarkan ID dari tabel users (role === 'mitra')
  const users = db.get('users') || [];
  const mitra = users.find(u => u.id === req.params.id && u.role === 'mitra');
  if (!mitra) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });
  res.json({ success: true, data: mitra });
});

// Update Live GPS Location with Geofencing & Off-Route Detection
app.post('/api/mitra/:id/location', (req, res) => {
  const { lat, lng, speed, status } = req.body;
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) {
    return res.status(400).json({ success: false, message: 'Koordinat GPS latitude dan longitude tidak valid.' });
  }

  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  users[uIndex].lat = numLat;
  users[uIndex].lng = numLng;
  if (status) users[uIndex].status = status;
  users[uIndex].lastActive = new Date().toISOString();
  db.set('users', users);

  // Check if mitra is currently working on an active task
  const orders = db.get('orders') || [];
  const activeOrder = orders.find(o => o.assignedMitraId === req.params.id && (o.status === 'working' || o.step === 'on_the_way' || o.step === 'arrived' || o.step === 'working'));

  let distToTaskKm = null;
  let geofenceStatus = 'IDLE'; // IDLE, EN_ROUTE, NEAR_ZONE, INSIDE_GEOFENCE
  let isOffRoute = false;
  let offRouteMessage = '';

  if (activeOrder && activeOrder.lat && activeOrder.lng) {
    distToTaskKm = calculateDistance(numLat, numLng, activeOrder.lat, activeOrder.lng);

    // Geofencing Check: Radius 200m (0.2 km)
    if (distToTaskKm <= 0.2) {
      geofenceStatus = 'INSIDE_GEOFENCE'; // Tiba di dalam radius lokasi tugas
    } else if (distToTaskKm <= 1.0) {
      geofenceStatus = 'NEAR_ZONE'; // Kurang dari 1 km
    } else {
      geofenceStatus = 'EN_ROUTE'; // Sedang meluncur
    }

    // Off-Route Detection:
    // Cek riwayat titik sebelumnya untuk mendeteksi apakah bergerak menjauhi target > 1.2 km
    const routeHistoryMap = db.get('routeHistory') || {};
    const prevPoints = routeHistoryMap[req.params.id] || [];
    if (prevPoints.length >= 2) {
      const lastPoint = prevPoints[prevPoints.length - 1];
      if (lastPoint.distToTaskKm && distToTaskKm > (lastPoint.distToTaskKm + 1.2) && distToTaskKm > 2.0) {
        isOffRoute = true;
        offRouteMessage = `Mitra terdeteksi menjauhi lokasi tugas (Jarak bertambah menjadi ${distToTaskKm.toFixed(2)} km)`;
      }
    }

    // Simpan koordinat terakhir di object order untuk pemohon
    activeOrder.lastMitraLocation = {
      lat: numLat,
      lng: numLng,
      speed: speed || '20 km/h',
      distToTaskKm: Number(distToTaskKm.toFixed(2)),
      geofenceStatus: geofenceStatus,
      isOffRoute: isOffRoute,
      updatedAt: new Date().toISOString()
    };
    db.set('orders', orders);
  }

  // Append to route history breadcrumbs
  const routeHistory = db.get('routeHistory') || {};
  if (!routeHistory[req.params.id]) routeHistory[req.params.id] = [];
  const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const breadcrumb = {
    lat: numLat,
    lng: numLng,
    time: nowTime,
    timestamp: new Date().toISOString(),
    speed: speed || '20 km/h',
    status: activeOrder ? `Tugas: ${activeOrder.title} (${activeOrder.step || 'working'})` : (status === 'working' ? 'Menjalankan tugas' : 'Online'),
    orderId: activeOrder ? activeOrder.id : null,
    distToTaskKm: distToTaskKm !== null ? Number(distToTaskKm.toFixed(2)) : null,
    geofenceStatus: geofenceStatus,
    isOffRoute: isOffRoute,
    offRouteMessage: offRouteMessage
  };

  routeHistory[req.params.id].push(breadcrumb);
  if (routeHistory[req.params.id].length > 100) {
    routeHistory[req.params.id].shift();
  }
  db.set('routeHistory', routeHistory);

  const payload = {
    mitraId: req.params.id,
    name: users[uIndex].name,
    lat: numLat,
    lng: numLng,
    status: users[uIndex].status,
    speed: speed || '20 km/h',
    time: nowTime,
    orderId: activeOrder ? activeOrder.id : null,
    distToTaskKm: distToTaskKm !== null ? Number(distToTaskKm.toFixed(2)) : null,
    geofenceStatus: geofenceStatus,
    isOffRoute: isOffRoute
  };

  io.emit('mitra:location_update', payload);

  if (activeOrder) {
    io.emit('order:tracking_update', {
      orderId: activeOrder.id,
      mitraId: req.params.id,
      mitraName: users[uIndex].name,
      lat: numLat,
      lng: numLng,
      distToTaskKm: distToTaskKm !== null ? Number(distToTaskKm.toFixed(2)) : null,
      geofenceStatus: geofenceStatus,
      isOffRoute: isOffRoute,
      offRouteMessage: offRouteMessage,
      time: nowTime
    });

    if (isOffRoute) {
      io.emit('geofence:off_route_alert', {
        mitraId: req.params.id,
        mitraName: users[uIndex].name,
        orderId: activeOrder.id,
        orderTitle: activeOrder.title,
        message: offRouteMessage,
        lat: numLat,
        lng: numLng,
        time: nowTime
      });
    }
  }

  res.json({ success: true, message: 'Lokasi GPS & Geofencing berhasil diperbarui', data: payload });
});

// Universal Klien (Pemohon) & User Real-Time Live GPS Endpoint
app.post(['/api/klien/:id/location', '/api/users/:id/location', '/api/user/:id/location'], (req, res) => {
  const { lat, lng } = req.body;
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) {
    return res.status(400).json({ success: false, message: 'Koordinat GPS latitude dan longitude tidak valid.' });
  }

  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });

  users[uIndex].lat = numLat;
  users[uIndex].lng = numLng;
  users[uIndex].lastActive = new Date().toISOString();
  db.set('users', users);

  const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const payload = {
    userId: req.params.id,
    klienId: req.params.id,
    name: users[uIndex].name,
    role: users[uIndex].role || 'klien',
    lat: numLat,
    lng: numLng,
    time: nowTime
  };

  io.emit('klien:location_update', payload);
  io.emit('user:location_update', payload);

  res.json({ success: true, message: 'Lokasi GPS pemohon/pengguna berhasil diperbarui', data: payload });
});

// Toggle Status (Ready / Working / Offline)
app.post('/api/mitra/:id/status', (req, res) => {
  const { status } = req.body; // ready, working, offline
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  users[uIndex].status = status;
  users[uIndex].lastActive = new Date().toISOString();
  db.set('users', users);

  io.emit('mitra:status_change', {
    mitraId: req.params.id,
    status: status,
    name: users[uIndex].name
  });

  res.json({ success: true, message: `Status mitra diubah ke ${status}`, data: users[uIndex] });
});

// Radar: Get nearby orders for Mitra within Radius
app.get('/api/mitra/:id/nearby-orders', (req, res) => {
  const users = db.get('users') || [];
  const mitra = users.find(u => u.id === req.params.id && u.role === 'mitra');
  if (!mitra) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  const config = db.get('config');
  const maxRadius = config.maxRadiusKm || 10;
  const orders = db.get('orders') || [];

  const nearby = orders
    .filter(o => o.status === 'open' || (o.status === 'bidding' && o.assignedMitraId !== mitra.id))
    .map(order => {
      const distance = calculateDistance(mitra.lat, mitra.lng, order.lat, order.lng);
      return {
        ...order,
        distanceKm: distance,
        isWithinRadius: distance <= maxRadius,
        hasBid: (order.bids || []).some(b => b.mitraId === mitra.id)
      };
    })
    .filter(o => o.isWithinRadius)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({
    success: true,
    data: nearby,
    config: {
      maxRadiusKm: maxRadius,
      isPremium: mitra.isPremium
    }
  });
});

// Submit Bid on Order
app.post('/api/mitra/:id/bid', (req, res) => {
  const { orderId, bidAmount, note } = req.body;
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === orderId);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  const users = db.get('users') || [];
  const mitra = users.find(u => u.id === req.params.id && u.role === 'mitra');
  if (!mitra) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  const newBid = {
    mitraId: mitra.id,
    mitraName: mitra.name,
    mitraRating: (mitra.completedOrders > 0) ? (mitra.rating || 5.0) : 0.0,
    mitraAvatar: mitra.avatar,
    isPremium: mitra.isPremium,
    kycStatus: mitra.kycStatus,
    bidAmount: Number(bidAmount),
    note: note || 'Siap mengerjakan tugas sekarang!',
    createdAt: new Date().toISOString()
  };

  if (!orders[oIndex].bids) orders[oIndex].bids = [];
  orders[oIndex].bids.push(newBid);
  orders[oIndex].status = 'bidding';
  db.set('orders', orders);

  io.emit('order:bid_new', { orderId, bid: newBid });
  res.json({ success: true, message: 'Penawaran berhasil diajukan kepada klien', data: newBid });
});

// Instant Take Order by Mitra (Requires KYC Verification)
app.post('/api/mitra/:id/take-order', (req, res) => {
  const { orderId } = req.body;
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === orderId);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  if (orders[oIndex].status !== 'open' && orders[oIndex].status !== 'bidding') {
    return res.status(400).json({ success: false, message: 'Order sudah diambil oleh mitra lain' });
  }

  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  // Panel Verifikasi Identitas Ketat: Mitra wajib berstatus verified/approved
  if (users[uIndex].kycStatus !== 'verified' && users[uIndex].kycStatus !== 'approved') {
    return res.status(403).json({
      success: false,
      message: 'Akun Anda belum terverifikasi KYC oleh Admin SobatSerabut. Tunggu verifikasi identitas e-KTP dan selfie Anda disetujui oleh admin sebelum mengambil order.'
    });
  }

  const now = new Date().toISOString();
  orders[oIndex].assignedMitraId = req.params.id;
  orders[oIndex].assignedMitraName = users[uIndex].name;
  orders[oIndex].assignedMitraPhone = users[uIndex].phone;
  orders[oIndex].assignedMitraBank = users[uIndex].bankDetails || {
    bankName: 'DANA',
    bankAccount: users[uIndex].phone,
    bankHolder: users[uIndex].name
  };
  orders[oIndex].status = 'working';
  orders[oIndex].step = 'on_the_way';
  orders[oIndex].assignedAt = now;
  orders[oIndex].onTheWayAt = now;
  db.set('orders', orders);

  users[uIndex].status = 'working';
  users[uIndex].activeOrderId = orderId;
  db.set('users', users);

  io.emit('order:assigned', { order: orders[oIndex], mitra: users[uIndex] });
  io.emit('mitra:status_change', { mitraId: req.params.id, status: 'working', name: users[uIndex].name });

  res.json({ success: true, message: 'Order berhasil Anda ambil! Segera menuju ke lokasi tugas klien.', data: orders[oIndex] });
});

// KYC Submission (Upload e-KTP & Foto Selfie Memegang KTP)
app.post('/api/mitra/:id/kyc', upload.fields([{ name: 'ktp', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]), (req, res) => {
  const { nik, bankName, bankAccount, bankHolder, ktpPhoto, selfieKtpPhoto } = req.body;
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  let ktpUrl = '';
  let selfieUrl = '';

  if (req.files) {
    if (req.files.ktp && req.files.ktp[0]) ktpUrl = `/uploads/${req.files.ktp[0].filename}`;
    if (req.files.selfie && req.files.selfie[0]) selfieUrl = `/uploads/${req.files.selfie[0].filename}`;
  }

  if (!ktpUrl && (ktpPhoto || req.body.ktpUrl)) {
    ktpUrl = saveBase64Image(ktpPhoto || req.body.ktpUrl, 'ktp');
  }
  if (!selfieUrl && (selfieKtpPhoto || req.body.selfieUrl)) {
    selfieUrl = saveBase64Image(selfieKtpPhoto || req.body.selfieUrl, 'selfie');
  }

  const cleanNik = nik ? nik.replace(/[^0-9]/g, '').slice(0, 16) : (users[uIndex].nik || '');

  const bankDetails = {
    bankName: bankName || (users[uIndex].bankDetails && users[uIndex].bankDetails.bankName) || 'DANA',
    bankAccount: bankAccount || (users[uIndex].bankDetails && users[uIndex].bankDetails.bankAccount) || users[uIndex].phone,
    bankHolder: bankHolder || (users[uIndex].bankDetails && users[uIndex].bankDetails.bankHolder) || users[uIndex].name
  };

  const kycRequests = db.get('kycRequests') || [];
  const newKyc = {
    id: `KYC-${Date.now().toString().slice(-4)}`,
    mitraId: req.params.id,
    mitraName: users[uIndex].name,
    phone: users[uIndex].phone,
    nik: cleanNik,
    bankDetails: bankDetails,
    ktpImageUrl: ktpUrl,
    selfieImageUrl: selfieUrl,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    reviewNotes: 'Dokumen e-KTP dan foto selfie memegang KTP telah diunggah untuk verifikasi ketat.'
  };

  kycRequests.unshift(newKyc);
  db.set('kycRequests', kycRequests);

  users[uIndex].kycStatus = 'pending';
  users[uIndex].nik = cleanNik;
  users[uIndex].bankDetails = bankDetails;
  if (ktpUrl) users[uIndex].ktpPhoto = ktpUrl;
  if (selfieUrl) users[uIndex].selfieKtpPhoto = selfieUrl;
  db.set('users', users);

  io.emit('kyc:new', newKyc);
  res.json({ success: true, message: 'Dokumen verifikasi identitas (KYC) berhasil dikirim. Menunggu persetujuan admin.', data: newKyc });
});


// Withdraw Wallet Request
app.post('/api/mitra/:id/withdraw', (req, res) => {
  const { amount, channelType, destination } = req.body;
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 20000) {
    return res.status(400).json({ success: false, message: 'Minimal penarikan adalah Rp 20.000' });
  }

  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  if (users[uIndex].walletBalance < numAmount) {
    return res.status(400).json({ success: false, message: 'Saldo dompet tidak mencukupi untuk penarikan ini' });
  }

  users[uIndex].walletBalance -= numAmount;
  db.set('users', users);

  const withdrawals = db.get('withdrawals') || [];
  const newWd = {
    id: `WD-${Date.now().toString().slice(-4)}`,
    mitraId: req.params.id,
    mitraName: users[uIndex].name,
    amount: numAmount,
    channelType: channelType || 'DANA',
    destination: destination || '081234567890',
    status: 'pending',
    requestedAt: new Date().toISOString(),
    processedAt: null
  };
  withdrawals.unshift(newWd);
  db.set('withdrawals', withdrawals);

  io.emit('withdrawal:new', newWd);
  res.json({ success: true, message: `Permintaan penarikan Rp ${numAmount.toLocaleString('id-ID')} berhasil diajukan`, data: newWd, newBalance: users[uIndex].walletBalance });
});

// Upgrade to Premium VIP
app.post('/api/mitra/:id/upgrade-premium', (req, res) => {
  const config = db.get('config');
  const price = config.premiumSubscriptionPrice || 50000;
  
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  users[uIndex].isPremium = true;
  db.set('users', users);

  const transactions = db.get('transactions') || [];
  transactions.unshift({
    id: `TRX-${Date.now().toString().slice(-4)}`,
    type: 'premium_subscription',
    amount: price,
    mitraId: req.params.id,
    description: `Aktivasi Akun Premium SobatSerabut VIP (${users[uIndex].name})`,
    timestamp: new Date().toISOString()
  });
  db.set('transactions', transactions);

  io.emit('mitra:premium_upgraded', { mitraId: req.params.id, name: users[uIndex].name });
  res.json({ success: true, message: 'Selamat! Akun Anda kini berstatus Mitra Premium VIP SobatSerabut.', data: users[uIndex] });
});

/* ========================================================
 * 5. ORDER & REKBER (ESCROW) WORKFLOW API (TWO-SIDED MARKETPLACE)
 * ======================================================== */
app.get('/api/orders', (req, res) => {
  res.json({ success: true, data: db.get('orders') || [] });
});

app.get('/api/orders/:id', (req, res) => {
  const order = (db.get('orders') || []).find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  res.json({ success: true, data: order });
});

// Get orders posted by Client
app.get('/api/orders/client/:clientId', (req, res) => {
  const orders = (db.get('orders') || []).filter(o => o.clientId === req.params.clientId);
  res.json({ success: true, data: orders });
});

// Get orders assigned / taken / worked by Mitra
app.get('/api/orders/mitra/:mitraId', (req, res) => {
  const mitraId = req.params.mitraId;
  const orders = (db.get('orders') || []).filter(o => o.assignedMitraId === mitraId);
  res.json({ success: true, data: orders });
});

// Endpoint Bersihkan Riwayat Tugas Pengguna (Klien atau Mitra)
app.post('/api/orders/clean-history/:userId', (req, res) => {
  const userId = req.params.userId;
  let orders = db.get('orders') || [];
  const initialLength = orders.length;
  // Hapus semua pesanan selesai atau dibatalkan yang terkait dengan pengguna ini
  orders = orders.filter(o => {
    const isUserOrder = (o.clientId === userId || o.assignedMitraId === userId);
    if (!isUserOrder) return true;
    return o.status !== 'completed' && o.status !== 'cancelled';
  });
  db.set('orders', orders);
  io.emit('orders:updated', { userId });
  res.json({
    success: true,
    message: 'Riwayat tugas berhasil dibersihkan kembali.',
    clearedCount: initialLength - orders.length
  });
});

// 1. Klien / Pemohon Posting Tugas Baru (Harga Otomatis Sesuai Kategori Jasa & Kebutuhan)
app.post('/api/orders/:id/cancel', (req, res) => {
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  orders[oIndex].status = 'cancelled';
  orders[oIndex].cancelledAt = new Date().toISOString();
  orders[oIndex].cancelReason = req.body.reason || 'Dibatalkan oleh pemohon';

  if (orders[oIndex].assignedMitraId) {
    const users = db.get('users') || [];
    const mIdx = users.findIndex(u => u.id === orders[oIndex].assignedMitraId);
    if (mIdx !== -1) {
      users[mIdx].status = 'ready';
      users[mIdx].activeOrderId = null;
      db.set('users', users);
    }
  }

  db.set('orders', orders);
  io.emit('order:cancelled', { orderId: req.params.id });
  res.json({ success: true, message: 'Pesanan berhasil dibatalkan.', data: orders[oIndex] });
});

app.post('/api/orders', (req, res) => {
  const config = db.get('config') || {};
  const categories = db.get('categories') || [];
  const platformFee = config.platformFee || 3000;
  const serviceFeePercent = config.serviceFeePercentage || 10;
  const users = db.get('users') || [];
  const clientUser = users.find(u => u.id === req.body.clientId);

  // Temukan kategori jasa untuk penentuan harga otomatis standar & estimasi waktu pengerjaan
  const categoryName = req.body.category || 'Runner / Belanja Kilat';
  const categoryObj = categories.find(c => c.name === categoryName || c.id === req.body.categoryId);
  const baseFare = categoryObj ? categoryObj.baseFare : (config.baseFare || 25000);
  const estimatedMinutes = categoryObj ? (categoryObj.estimatedMinutes || 60) : 60;

  // Biaya tambahan jika ada spesifikasi kebutuhan khusus
  const extraRequirementCost = Number(req.body.extraRequirementCost) || 0;
  const serviceFare = baseFare + extraRequirementCost; // Biaya jasa murni otomatis
  const totalPayment = serviceFare + platformFee; // Total pembayaran pemohon (Biaya Jasa + Biaya Layanan 3rb)
  const commission = Math.round(serviceFare * (serviceFeePercent / 100)); // Potongan komisi 10%
  const mitraNetEarnings = serviceFare - commission; // Pendapatan bersih mitra

  // Akun Finansial Pemohon
  const clientPayment = {
    method: req.body.clientPaymentMethod || 'seabank',
    provider: req.body.clientPaymentProvider || 'SeaBank (901771223812)',
    accountNumber: req.body.clientAccountNumber || req.body.clientPhone || (clientUser && clientUser.phone) || '081234567890',
    accountName: req.body.clientAccountName || req.body.clientName || (clientUser && clientUser.name) || 'Pemohon Jasa'
  };

  // OTOMATIS SINKRONKAN ALAMAT DARI PROFIL SAYA (Tidak perlu lagi mengisi alamat saat posting)
  let resolvedAddress = (req.body.address || '').trim();
  let structuredAddress = req.body.structuredAddress || null;

  if ((!resolvedAddress || resolvedAddress === 'Indonesia') && clientUser) {
    resolvedAddress = clientUser.address || '';
    structuredAddress = clientUser.structuredAddress || null;
  }

  // Jika tetap kosong, fallback ke structured address parts jika ada
  const houseNumber = (req.body.houseNumber || (structuredAddress && structuredAddress.houseNumber) || '').trim();
  const street = (req.body.street || (structuredAddress && structuredAddress.street) || '').trim();
  const rt = (req.body.rt || (structuredAddress && structuredAddress.rt) || '').trim();
  const rw = (req.body.rw || (structuredAddress && structuredAddress.rw) || '').trim();
  const kelurahan = (req.body.kelurahan || (structuredAddress && structuredAddress.kelurahan) || '').trim();
  const kecamatan = (req.body.kecamatan || (structuredAddress && structuredAddress.kecamatan) || '').trim();
  const city = (req.body.city || (structuredAddress && structuredAddress.city) || '').trim();
  const benchmark = (req.body.benchmark || (structuredAddress && structuredAddress.benchmark) || '').trim();

  if (!resolvedAddress && (street || houseNumber || kelurahan || kecamatan || city)) {
    const parts = [];
    if (street) parts.push(street);
    if (houseNumber) parts.push(`No. ${houseNumber}`);
    if (rt || rw) parts.push(`RT ${rt || '-'}/RW ${rw || '-'}`);
    if (kelurahan) parts.push(`Kel. ${kelurahan}`);
    if (kecamatan) parts.push(`Kec. ${kecamatan}`);
    if (city) parts.push(city);
    resolvedAddress = parts.join(', ');
  }
  if (!resolvedAddress) resolvedAddress = 'Indonesia (Sesuai Profil Pemohon)';

  if (!structuredAddress) {
    structuredAddress = {
      street,
      houseNumber,
      rt,
      rw,
      kelurahan,
      kecamatan,
      city,
      benchmark,
      fullAddress: resolvedAddress
    };
  }

  // Titik Koordinat Lokasi: Sinkron dari Profil atau GPS
  let orderLat = Number(req.body.lat);
  let orderLng = Number(req.body.lng);
  if (isNaN(orderLat) || orderLat === 0) orderLat = (clientUser && clientUser.lat) || -6.1754;
  if (isNaN(orderLng) || orderLng === 0) orderLng = (clientUser && clientUser.lng) || 106.8272;

  // Radar Jarak Dinamis: Ditentukan Admin (100 m - 2000 m / 2 km)
  let radarRadiusMeters = Number(config.radarRadiusMeters) || ((Number(config.maxRadiusKm) || 2) * 1000);
  if (radarRadiusMeters < 100) radarRadiusMeters = 100;
  if (radarRadiusMeters > 2000) radarRadiusMeters = 2000;

  // Hapus judul pekerjaan & hapus foto tugas: Otomatis generate judul dari Kategori Jasa!
  const orderTitle = categoryObj ? `Layanan ${categoryObj.name}` : (req.body.title || 'Bantuan Pekerjaan Serabutan');

  const orders = db.get('orders') || [];
  const now = new Date().toISOString();
  const newOrder = {
    id: `ORD-${Date.now().toString().slice(-4)}`,
    title: orderTitle, // Hapus judul manual: Otomatis dari kategori jasa
    category: categoryName,
    description: req.body.description || req.body.notes || 'Pekerjaan serabutan sesuai rincian kebutuhan.',
    clientId: req.body.clientId || (clientUser ? clientUser.id : 'KLN-001'),
    clientName: (clientUser && clientUser.name) || req.body.clientName || 'Pemohon Jasa',
    clientPhone: (clientUser && clientUser.phone) || req.body.clientPhone || '08123456789',
    clientAvatar: (clientUser && clientUser.avatar) || '/uploads/avatar_klien.svg',
    clientPayment: clientPayment,
    address: resolvedAddress,
    houseNumber,
    street,
    rt,
    rw,
    kelurahan,
    kecamatan,
    city,
    benchmark,
    structuredAddress,
    lat: orderLat,
    lng: orderLng,
    radarRadiusMeters: radarRadiusMeters,
    estimatedMinutes: estimatedMinutes,
    // Biaya Otomatis Transparan: Layanan 3rb & Komisi 10%
    budget: serviceFare,
    platformFee: platformFee, // Rp 3.000
    totalPayment: totalPayment,
    platformCommission: commission, // 10% komisi
    mitraNetEarnings: mitraNetEarnings, // Pendapatan bersih driver
    escrowStatus: 'pending_payment',
    status: 'open',
    step: 'waiting_mitra',
    createdAt: now,
    assignedAt: null,
    onTheWayAt: null,
    arrivedAt: null,
    workingAt: null,
    completedAt: null,
    durationAudit: null,
    taskPhoto: null, // Hapus foto tugas pada saat posting
    startWorkPhoto: null, // Wajib diunggah driver saat tiba di lokasi sebelum mulai
    proofPhoto: null, // Wajib diunggah driver saat selesai
    proofConfirmed: null,
    proofConfirmedAt: null,
    proofNotes: null,
    assignedMitraId: null,
    bids: [],
    chatMessages: []
  };

  orders.unshift(newOrder);
  db.set('orders', orders);

  const transactions = db.get('transactions') || [];
  transactions.unshift({
    id: `TRX-${Date.now().toString().slice(-4)}`,
    type: 'order_posted',
    amount: totalPayment,
    orderId: newOrder.id,
    description: `Posting tugas baru: ${newOrder.title} (Radar ${radarRadiusMeters}m)`,
    timestamp: now
  });
  db.set('transactions', transactions);

  // Filter Driver Mitra Terdekat dalam Radius Radar (100 m - 2000 m) yang sedang ON (ready)
  const nearbyDrivers = users.filter(u => {
    if (u.role !== 'mitra' || u.status !== 'ready') return false;
    if (!u.lat || !u.lng) return true;
    const distMeters = calculateDistance(orderLat, orderLng, u.lat, u.lng) * 1000;
    return distMeters <= radarRadiusMeters;
  });

  newOrder.nearbyCount = nearbyDrivers.length;

  // Broadcast ke radar driver mitra terdekat
  io.emit('order:new', newOrder);
  nearbyDrivers.forEach(drv => {
    const dM = (drv.lat && drv.lng) ? Math.round(calculateDistance(orderLat, orderLng, drv.lat, drv.lng) * 1000) : 350;
    io.emit(`driver:order_offer:${drv.id}`, { ...newOrder, distanceMeters: dM });
  });

  res.json({
    success: true,
    message: `Tugas berhasil diposting dan dipancarkan ke radar ${nearbyDrivers.length} driver terdekat (Radius ${radarRadiusMeters}m)!`,
    data: newOrder
  });
});

// 2. Klien Memilih Mitra & Konfirmasi Rekber
app.post('/api/orders/:id/select-bid', (req, res) => {
  const { mitraId, paymentMethod } = req.body;
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  const users = db.get('users') || [];
  const mitra = users.find(u => u.id === mitraId);
  if (!mitra) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  if (mitra.kycStatus !== 'verified' && mitra.kycStatus !== 'approved') {
    return res.status(403).json({ success: false, message: 'Mitra ini belum terverifikasi KYC oleh admin.' });
  }

  const now = new Date().toISOString();
  orders[oIndex].assignedMitraId = mitraId;
  orders[oIndex].assignedMitraName = mitra.name;
  orders[oIndex].assignedMitraPhone = mitra.phone;
  orders[oIndex].assignedMitraBank = mitra.bankDetails || { bankName: 'DANA', bankAccount: mitra.phone, bankHolder: mitra.name };
  orders[oIndex].status = 'working';
  orders[oIndex].step = 'on_the_way';
  orders[oIndex].assignedAt = now;
  orders[oIndex].onTheWayAt = now;
  orders[oIndex].escrowStatus = 'paid';
  if (paymentMethod) orders[oIndex].paymentMethod = paymentMethod;
  db.set('orders', orders);

  mitra.status = 'working';
  mitra.activeOrderId = req.params.id;
  db.set('users', users);

  io.emit('order:assigned', { order: orders[oIndex], mitra });
  io.emit('mitra:status_change', { mitraId, status: 'working', name: mitra.name });

  res.json({ success: true, message: `Mitra ${mitra.name} telah dipilih! Dana diamankan di Rekber.`, data: orders[oIndex] });
});

// 3. Update Order Step & Audit Checkpoint
app.post('/api/orders/:id/step', (req, res) => {
  const { step, proofPhoto } = req.body; // 'on_the_way', 'arrived', 'working', 'completed'
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  const now = new Date().toISOString();
  orders[oIndex].step = step;

  // Catat Audit Timestamp pada setiap checkpoint
  if (step === 'on_the_way' && !orders[oIndex].onTheWayAt) {
    orders[oIndex].onTheWayAt = now;
  } else if (step === 'arrived') {
    orders[oIndex].arrivedAt = now;
  } else if (step === 'working') {
    orders[oIndex].workingAt = now;
    orders[oIndex].status = 'working';
  }

  if (proofPhoto) {
    orders[oIndex].proofPhoto = saveBase64Image(proofPhoto, 'proof');
  }

  db.set('orders', orders);

  io.emit('order:step_change', { orderId: req.params.id, step, updatedAt: now });
  res.json({ success: true, message: `Status tugas diperbarui ke tahapan ${step}`, data: orders[oIndex] });
});

// Driver Tiba di Lokasi: WAJIB FOTO PEKERJAAN YANG AKAN DIMULAI
app.post('/api/orders/:id/start-work', (req, res) => {
  const { startWorkPhoto, driverId } = req.body;
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  if (!startWorkPhoto) {
    return res.status(400).json({
      success: false,
      message: 'Driver wajib mengunggah foto pekerjaan / rumah yang akan dimulai guna memantau pekerjaan yang sedang dikerjakan!'
    });
  }

  const categories = db.get('categories') || [];
  const cat = categories.find(c => c.name === orders[oIndex].category);
  const estimatedMins = (cat && cat.estimatedMinutes) ? cat.estimatedMinutes : (orders[oIndex].estimatedMinutes || 60);

  const nowIso = new Date().toISOString();
  orders[oIndex].startWorkPhoto = saveBase64Image(startWorkPhoto, 'start_work');
  orders[oIndex].step = 'working';
  orders[oIndex].status = 'working';
  orders[oIndex].arrivedAt = orders[oIndex].arrivedAt || nowIso;
  orders[oIndex].workingAt = nowIso;
  orders[oIndex].estimatedMinutes = estimatedMins;

  db.set('orders', orders);

  io.emit('order:working_started', {
    orderId: req.params.id,
    order: orders[oIndex],
    estimatedMinutes: estimatedMins,
    workingAt: nowIso
  });
  io.emit('order:step_change', { orderId: req.params.id, step: 'working', updatedAt: nowIso });

  res.json({
    success: true,
    message: `Pekerjaan mulai dikerjakan! Foto awal terverifikasi. Estimasi waktu: ${estimatedMins} menit sesuai kategori ${orders[oIndex].category}.`,
    data: orders[oIndex]
  });
});

// Driver Selesai Mengerjakan: WAJIB FOTO TUGAS YANG SELESAI DIKERJAKAN
app.post('/api/orders/:id/finish-work', (req, res) => {
  const { proofPhoto, driverId } = req.body;
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  if (!proofPhoto) {
    return res.status(400).json({
      success: false,
      message: 'Driver wajib mengunggah foto bukti tugas yang sudah selesai dikerjakan!'
    });
  }

  const nowIso = new Date().toISOString();
  orders[oIndex].proofPhoto = saveBase64Image(proofPhoto, 'proof');
  orders[oIndex].completedWorkPhotoAt = nowIso;
  orders[oIndex].step = 'waiting_payment';
  orders[oIndex].status = 'waiting_payment';

  db.set('orders', orders);

  io.emit('order:waiting_payment', {
    orderId: req.params.id,
    order: orders[oIndex],
    proofPhoto: orders[oIndex].proofPhoto,
    totalPayment: orders[oIndex].totalPayment,
    adminSeaBank: '901771223812',
    accountHolder: 'SobatSerabut Admin'
  });
  io.emit('order:step_change', { orderId: req.params.id, step: 'waiting_payment', updatedAt: nowIso });

  res.json({
    success: true,
    message: 'Foto tugas selesai berhasil diunggah! Klien diwajibkan transfer ke SeaBank 901771223812.',
    data: orders[oIndex]
  });
});

// Konfirmasi Pembayaran Klien ke SeaBank 901771223812 & Payout Otomatis ke Driver
app.post('/api/orders/:id/confirm-payment', (req, res) => {
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  const order = orders[oIndex];
  if (order.status === 'completed') {
    return res.status(400).json({ success: false, message: 'Order ini sudah diselesaikan dan dana sudah dicairkan sebelumnya.' });
  }

  const nowIso = new Date().toISOString();
  const config = db.get('config') || {};
  const serviceFeePercent = config.serviceFeePercentage || 10;
  const platformFee = order.platformFee || 3000;
  const commission = Math.round(order.budget * (serviceFeePercent / 100));
  const driverNetEarnings = order.budget - commission;

  order.status = 'completed';
  order.step = 'completed';
  order.escrowStatus = 'released';
  order.completedAt = nowIso;
  order.paymentConfirmedAt = nowIso;

  const users = db.get('users') || [];
  let driverBankDetails = { bankName: 'SeaBank', bankAccount: '901771223812', bankHolder: 'Driver' };

  if (order.assignedMitraId) {
    const mIndex = users.findIndex(u => u.id === order.assignedMitraId);
    if (mIndex !== -1) {
      users[mIndex].walletBalance = (users[mIndex].walletBalance || 0) + driverNetEarnings;
      users[mIndex].earnings = (users[mIndex].earnings || 0) + driverNetEarnings;
      users[mIndex].completedOrders = (users[mIndex].completedOrders || 0) + 1;
      users[mIndex].status = 'ready'; // Otomatis kembali ON (Siap Menerima Pesanan)
      users[mIndex].activeOrderId = null;

      if (users[mIndex].bankDetails && users[mIndex].bankDetails.bankAccount) {
        driverBankDetails = users[mIndex].bankDetails;
      } else {
        driverBankDetails = {
          bankName: users[mIndex].bankName || 'DANA / E-Wallet',
          bankAccount: users[mIndex].bankAccount || users[mIndex].phone,
          bankHolder: users[mIndex].bankHolder || users[mIndex].name
        };
      }
      db.set('users', users);
      io.emit('mitra:status_change', { mitraId: users[mIndex].id, status: 'ready', name: users[mIndex].name });
      io.emit('user:balance_update', { userId: users[mIndex].id, newBalance: users[mIndex].walletBalance });
    }
  }

  // Bukti Transfer Otomatis Tanpa Menunggu Persetujuan Admin
  order.payoutDetails = {
    recipientName: driverBankDetails.bankHolder,
    bankName: driverBankDetails.bankName,
    accountNumber: driverBankDetails.bankAccount,
    grossFare: order.budget,
    platformFeeDeduction: platformFee, // Potongan layanan 3rb
    commissionDeduction: commission, // Potongan komisi 10%
    netIncome: driverNetEarnings, // Pendapatan bersih driver
    status: 'TRANSFERRED_AUTOMATIC',
    referenceId: `TRF-${Date.now().toString().slice(-6)}`,
    transferredAt: nowIso,
    destinationSeaBank: '901771223812'
  };

  db.set('orders', orders);

  const transactions = db.get('transactions') || [];
  transactions.unshift({
    id: `TRX-${Date.now().toString().slice(-4)}`,
    type: 'driver_payout',
    amount: driverNetEarnings,
    orderId: order.id,
    mitraId: order.assignedMitraId,
    description: `Pencairan bersih jasa ke ${driverBankDetails.bankName} ${driverBankDetails.bankAccount} a.n ${driverBankDetails.bankHolder} (Potongan layanan 3rb & komisi 10%)`,
    timestamp: nowIso
  });

  transactions.unshift({
    id: `TRX-${(Date.now() + 1).toString().slice(-4)}`,
    type: 'platform_revenue',
    amount: platformFee + commission,
    orderId: order.id,
    description: `Pendapatan platform SobatSerabut (Biaya layanan Rp ${platformFee.toLocaleString('id-ID')} + Komisi 10% Rp ${commission.toLocaleString('id-ID')})`,
    timestamp: nowIso
  });
  db.set('transactions', transactions);

  io.emit('order:completed', {
    order,
    driverNetEarnings,
    platformFee,
    commission,
    payoutDetails: order.payoutDetails
  });

  res.json({
    success: true,
    message: `Pembayaran ke SeaBank 901771223812 berhasil dikonfirmasi! Dana bersih Rp ${driverNetEarnings.toLocaleString('id-ID')} otomatis terkirim langsung ke rekening/e-wallet ${driverBankDetails.bankName} driver tanpa menunggu persetujuan admin.`,
    data: order
  });
});

// 4. Selesaikan Order (WAJIB FOTO TUGAS SELESAI, AUDIT DURASI, & SALDO OTOMATIS MASUK KE REKENING MITRA)
app.post('/api/orders/:id/complete', (req, res) => {
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  const order = orders[oIndex];
  if (order.status === 'completed') {
    return res.status(400).json({ success: false, message: 'Order ini sudah diselesaikan sebelumnya.' });
  }

  // Wajib melampirkan foto bukti pengerjaan tugas yang sudah selesai!
  let proofPhoto = req.body.proofPhoto || order.proofPhoto;
  if (!proofPhoto) {
    return res.status(400).json({
      success: false,
      message: 'Wajib mengunggah foto tugas yang sudah selesai dikerjakan sebelum menyelesaikan orderan!'
    });
  }
  proofPhoto = saveBase64Image(proofPhoto, 'proof');
  order.proofPhoto = proofPhoto;

  const now = new Date();
  const nowIso = now.toISOString();

  // Audit Durasi Pengerjaan Tugas Presisi
  const assignedTime = order.assignedAt ? new Date(order.assignedAt) : (order.createdAt ? new Date(order.createdAt) : now);
  const arrivedTime = order.arrivedAt ? new Date(order.arrivedAt) : assignedTime;
  const workingTime = order.workingAt ? new Date(order.workingAt) : arrivedTime;

  const travelMinutes = Math.max(1, Math.round((arrivedTime - assignedTime) / 60000));
  const workMinutes = Math.max(1, Math.round((now - workingTime) / 60000));
  const totalMinutes = Math.max(1, Math.round((now - assignedTime) / 60000));

  order.durationAudit = {
    assignedAt: order.assignedAt || assignedTime.toISOString(),
    onTheWayAt: order.onTheWayAt || assignedTime.toISOString(),
    arrivedAt: order.arrivedAt || arrivedTime.toISOString(),
    workingAt: order.workingAt || workingTime.toISOString(),
    completedAt: nowIso,
    travelMinutes: travelMinutes,
    workMinutes: workMinutes,
    totalMinutes: totalMinutes,
    status: totalMinutes <= 180 ? 'NORMAL_ON_TIME' : 'OVERDUE_AUDIT_FLAG',
    statusLabel: totalMinutes <= 180 ? 'Selesai Tepat Waktu' : 'Durasi Melebihi Estimasi (Perlu Audit)'
  };

  const config = db.get('config') || {};
  const serviceFeePercent = config.serviceFeePercentage || 10;
  const platformFee = order.platformFee || 3000;
  const commission = Math.round(order.budget * (serviceFeePercent / 100));
  const mitraNetIncome = order.budget - commission;

  order.status = 'completed';
  order.step = 'completed';
  order.escrowStatus = 'released';
  order.completedAt = nowIso;

  // Transfer otomatis dana jasa ke Rekening / E-Wallet Mitra yang terhubung
  const users = db.get('users') || [];
  let mitraBankDetails = { bankName: 'DANA', bankAccount: '08123456789', bankHolder: 'Mitra' };

  if (order.assignedMitraId) {
    const mIndex = users.findIndex(u => u.id === order.assignedMitraId);
    if (mIndex !== -1) {
      users[mIndex].walletBalance = (users[mIndex].walletBalance || 0) + mitraNetIncome;
      users[mIndex].earnings = (users[mIndex].earnings || 0) + mitraNetIncome;
      users[mIndex].completedOrders = (users[mIndex].completedOrders || 0) + 1;
      if (!users[mIndex].rating || users[mIndex].rating === 0) {
        users[mIndex].rating = 5.0;
      }
      users[mIndex].status = 'ready'; // kembali hijau online
      users[mIndex].activeOrderId = null;

      if (users[mIndex].bankDetails) {
        mitraBankDetails = users[mIndex].bankDetails;
      }
      db.set('users', users);

      io.emit('mitra:status_change', { mitraId: users[mIndex].id, status: 'ready', name: users[mIndex].name });
    }
  }

  // Data bukti transfer pencairan otomatis
  order.payoutDetails = {
    recipientName: mitraBankDetails.bankHolder,
    bankName: mitraBankDetails.bankName,
    accountNumber: mitraBankDetails.bankAccount,
    amount: mitraNetIncome,
    transferredAt: nowIso,
    referenceId: `TRF-${Date.now().toString().slice(-6)}`,
    status: 'SUCCESS_TRANSFERRED',
    sourceAccount: order.clientPayment || { provider: 'Rekber Penampung' }
  };

  db.set('orders', orders);

  // Catat transaksi pencairan dan komisi platform
  const transactions = db.get('transactions') || [];
  transactions.unshift({
    id: `TRX-${Date.now().toString().slice(-4)}`,
    type: 'mitra_payout',
    amount: mitraNetIncome,
    orderId: order.id,
    mitraId: order.assignedMitraId,
    description: `Pencairan jasa bersih ke ${mitraBankDetails.bankName} ${mitraBankDetails.bankAccount} a.n ${mitraBankDetails.bankHolder} (Net Rp${mitraNetIncome.toLocaleString('id-ID')})`,
    timestamp: nowIso
  });
  transactions.unshift({
    id: `TRX-${(Date.now() + 1).toString().slice(-4)}`,
    type: 'platform_fee',
    amount: platformFee + commission,
    orderId: order.id,
    description: `Pendapatan platform (Admin Rekber Rp${platformFee.toLocaleString('id-ID')} + Komisi ${serviceFeePercent}% Rp${commission.toLocaleString('id-ID')})`,
    timestamp: nowIso
  });
  db.set('transactions', transactions);

  io.emit('order:completed', { order, mitraNetIncome, platformFee: platformFee + commission });
  res.json({
    success: true,
    message: `Tugas selesai! Foto bukti terverifikasi, dana Rp ${mitraNetIncome.toLocaleString('id-ID')} otomatis masuk ke rekening ${mitraBankDetails.bankName} mitra.`,
    data: { order, mitraNetIncome, commission, platformFee, payoutDetails: order.payoutDetails }
  });
});

// 5. Endpoint Tracking & Geofencing Real-Time untuk Klien & Mitra
app.get('/api/orders/:id/tracking', (req, res) => {
  const orders = db.get('orders') || [];
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  const users = db.get('users') || [];
  const mitra = order.assignedMitraId ? users.find(u => u.id === order.assignedMitraId) : null;
  const routeHistoryMap = db.get('routeHistory') || {};
  const mitraBreadcrumbs = order.assignedMitraId ? (routeHistoryMap[order.assignedMitraId] || []) : [];

  let distanceKm = null;
  let geofenceStatus = 'IDLE';
  let isOffRoute = false;

  if (mitra && mitra.lat && mitra.lng && order.lat && order.lng) {
    distanceKm = calculateDistance(mitra.lat, mitra.lng, order.lat, order.lng);
    if (distanceKm <= 0.2) geofenceStatus = 'INSIDE_GEOFENCE';
    else if (distanceKm <= 1.0) geofenceStatus = 'NEAR_ZONE';
    else geofenceStatus = 'EN_ROUTE';

    if (order.lastMitraLocation) {
      isOffRoute = !!order.lastMitraLocation.isOffRoute;
    }
  }

  res.json({
    success: true,
    data: {
      orderId: order.id,
      orderTitle: order.title,
      orderCategory: order.category,
      orderStep: order.step,
      orderStatus: order.status,
      pickupLocation: {
        address: order.address,
        lat: order.lat,
        lng: order.lng
      },
      mitra: mitra ? {
        id: mitra.id,
        name: mitra.name,
        phone: mitra.phone,
        avatar: mitra.avatar,
        vehicle: mitra.vehicle,
        lat: mitra.lat,
        lng: mitra.lng,
        rating: mitra.rating
      } : null,
      distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
      geofenceStatus: geofenceStatus,
      isOffRoute: isOffRoute,
      durationAudit: order.durationAudit,
      proofPhoto: order.proofPhoto,
      breadcrumbs: mitraBreadcrumbs.slice(-20) // 20 titik GPS terakhir
    }
  });
});

// 6. Endpoint Log Geofencing & Riwayat Rute untuk Admin Dashboard
app.get('/api/admin/geofencing-logs', requireAdminAuth, (req, res) => {
  const orders = db.get('orders') || [];
  const users = db.get('users') || [];
  const routeHistoryMap = db.get('routeHistory') || {};

  const activeTracking = orders
    .filter(o => o.assignedMitraId && (o.status === 'working' || o.status === 'completed'))
    .map(o => {
      const mitra = users.find(u => u.id === o.assignedMitraId);
      const points = routeHistoryMap[o.assignedMitraId] || [];
      const offRoutePoints = points.filter(p => p.isOffRoute);
      return {
        orderId: o.id,
        orderTitle: o.title,
        orderCategory: o.category,
        orderStatus: o.status,
        orderStep: o.step,
        pickupAddress: o.address,
        pickupLat: o.lat,
        pickupLng: o.lng,
        mitraId: o.assignedMitraId,
        mitraName: mitra ? mitra.name : 'Mitra',
        mitraPhone: mitra ? mitra.phone : '',
        currentMitraLat: mitra ? mitra.lat : null,
        currentMitraLng: mitra ? mitra.lng : null,
        geofenceStatus: o.lastMitraLocation ? o.lastMitraLocation.geofenceStatus : 'IDLE',
        hasOffRouteAlert: offRoutePoints.length > 0,
        offRouteCount: offRoutePoints.length,
        durationAudit: o.durationAudit,
        proofPhoto: o.proofPhoto,
        totalPoints: points.length
      };
    });

  res.json({ success: true, data: activeTracking });
});

// Review Mitra oleh Klien
app.post('/api/orders/:id/review', (req, res) => {
  const { rating, comment } = req.body;
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  const numRating = Number(rating) || 5.0;
  orders[oIndex].review = { rating: numRating, comment: comment || 'Sangat memuaskan dan cepat!', createdAt: new Date().toISOString() };
  db.set('orders', orders);

  // Update rating rata-rata mitra
  const mitraId = orders[oIndex].assignedMitraId;
  if (mitraId) {
    const users = db.get('users') || [];
    const mIndex = users.findIndex(u => u.id === mitraId);
    if (mIndex !== -1) {
      const currentRating = users[mIndex].rating || 0;
      const totalCount = users[mIndex].completedOrders || 1;
      if (currentRating === 0 || totalCount <= 1) {
        users[mIndex].rating = numRating;
      } else {
        users[mIndex].rating = Number(((currentRating * (totalCount - 1) + numRating) / totalCount).toFixed(1));
      }
      db.set('users', users);
    }
  }

  res.json({ success: true, message: 'Terima kasih atas ulasan dan rating yang diberikan!' });
});

// Chat message
app.post('/api/orders/:id/chat', (req, res) => {
  const { sender, text } = req.body;
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });

  const msg = {
    sender: sender || 'mitra',
    text: text,
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  };

  if (!orders[oIndex].chatMessages) orders[oIndex].chatMessages = [];
  orders[oIndex].chatMessages.push(msg);
  db.set('orders', orders);

  io.emit('chat:message', { orderId: req.params.id, message: msg });
  res.json({ success: true, data: msg });
});


/* ========================================================
 * 6. LAPTOP ADMIN DASHBOARD & MONITORING API (PROTECTED)
 * ======================================================== */

// 6.1 Admin Login & Token Verification
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const currentPass = process.env.ADMIN_PASSWORD || 'adminserabut2026';
  if (!password || password !== currentPass) {
    return res.status(401).json({ success: false, message: 'Kata sandi admin salah!' });
  }
  const token = getExpectedAdminToken();
  res.json({
    success: true,
    message: 'Login Admin Berhasil! Selamat datang di Dashboard Kontrol Terpusat.',
    token: token
  });
});

app.get('/api/admin/verify-token', (req, res) => {
  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  if (token && token === getExpectedAdminToken()) {
    return res.json({ success: true, valid: true });
  }
  res.status(401).json({ success: false, valid: false, message: 'Sesi admin tidak valid atau telah kedaluwarsa.' });
});

app.post('/api/admin/change-password', (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const currentPass = process.env.ADMIN_PASSWORD || 'adminserabut2026';

  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  const isTokenValid = (token && token === getExpectedAdminToken());
  const isOldPasswordMatch = (oldPassword && oldPassword.trim() === currentPass);

  if (!isTokenValid && !isOldPasswordMatch) {
    return res.status(401).json({ success: false, message: 'Kata sandi lama tidak cocok atau akses ditolak!' });
  }

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ success: false, message: 'Kata sandi baru minimal 6 karakter!' });
  }

  const updatedPassword = newPassword.trim();
  process.env.ADMIN_PASSWORD = updatedPassword;
  const envPath = path.join(__dirname, '.env');
  try {
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (envContent.includes('ADMIN_PASSWORD=')) {
      envContent = envContent.replace(/ADMIN_PASSWORD=.*(\r?\n|$)/, `ADMIN_PASSWORD=${updatedPassword}$1`);
    } else {
      envContent += `\nADMIN_PASSWORD=${updatedPassword}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
  } catch (err) {
    console.error('Gagal memperbarui file .env:', err);
  }

  const newToken = getExpectedAdminToken();
  console.log(`🔐 [ADMIN SECURITY] Kata sandi master admin berhasil diubah.`);
  res.json({ 
    success: true, 
    message: 'Kata sandi master admin berhasil diperbarui! Silakan gunakan kata sandi baru untuk masuk.', 
    token: newToken 
  });
});

// Endpoint Transaksi untuk Pengguna Real
app.get('/api/users/:id/transactions', (req, res) => {
  const userId = req.params.id;
  const trxs = db.get('transactions') || [];
  const relevant = trxs.filter(t => t.mitraId === userId || t.clientId === userId || t.orderId);
  res.json({ success: true, data: relevant });
});

app.get('/api/admin/users', requireAdminAuth, (req, res) => {
  const users = db.get('users') || [];
  res.json({ success: true, data: users });
});

app.get('/api/admin/metrics', requireAdminAuth, (req, res) => {
  const users = db.get('users') || [];
  const mitra = users.filter(u => u.role === 'mitra');
  const klien = users.filter(u => u.role === 'klien');
  const orders = db.get('orders') || [];
  const transactions = db.get('transactions') || [];
  const kycRequests = db.get('kycRequests') || [];
  const withdrawals = db.get('withdrawals') || [];

  const totalMitra = mitra.length;
  const mitraOnline = mitra.filter(m => m.status === 'ready').length;
  const mitraWorking = mitra.filter(m => m.status === 'working').length;
  const mitraOffline = mitra.filter(m => m.status === 'offline').length;

  const totalKlien = klien.length;
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;
  const activeOrders = orders.filter(o => o.status === 'working' || o.status === 'open' || o.status === 'bidding').length;
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const cancelRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : '0.0';

  const completionRate = totalOrders > 0 ? (((completedOrders) / totalOrders) * 100).toFixed(1) : '0.0';
  const mitraWithCompleted = mitra.filter(m => (m.completedOrders || 0) > 0);
  const avgRating = mitraWithCompleted.length > 0
    ? (mitraWithCompleted.reduce((acc, m) => acc + (m.rating || 5), 0) / mitraWithCompleted.length).toFixed(1)
    : '0.0';

  const escrowBalance = orders
    .filter(o => o.escrowStatus === 'paid' && o.status !== 'completed')
    .reduce((acc, o) => acc + (o.totalPayment || 0), 0);

  let platformRevenue = transactions
    .filter(t => t.type === 'platform_fee' || t.type === 'premium_subscription')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  if (platformRevenue === 0 && completedOrders > 0) {
    const pFee = db.get('config')?.platformFee || 3000;
    const commPct = db.get('config')?.serviceFeePercentage || 10;
    orders.filter(o => o.status === 'completed').forEach(o => {
      platformRevenue += pFee + Math.round((o.budget || 0) * (commPct / 100));
    });
  }

  res.json({
    success: true,
    data: {
      totalMitra,
      mitraOnline,
      mitraWorking,
      mitraOffline,
      totalKlien,
      totalOrders,
      completedOrders,
      activeOrders,
      cancelledOrders,
      cancelRate,
      completionRate,
      avgRating,
      escrowBalance,
      platformRevenue,
      pendingKyc: kycRequests.filter(k => k.status === 'pending').length,
      pendingWithdraw: withdrawals.filter(w => w.status === 'pending').length
    }
  });
});

app.get('/api/admin/route-history/:mitraId', requireAdminAuth, (req, res) => {
  const history = (db.get('routeHistory') || {})[req.params.mitraId] || [];
  res.json({ success: true, data: history });
});

app.get('/api/admin/kyc', requireAdminAuth, (req, res) => {
  const kycRequests = db.get('kycRequests') || [];
  const users = db.get('users') || [];
  const drivers = users.filter(u => u.role === 'mitra');

  // Pastikan seluruh mitra pengemudi terdaftar tercatat dalam daftar permohonan KYC
  drivers.forEach(d => {
    const exists = kycRequests.find(k => k.mitraId === d.id);
    if (!exists) {
      kycRequests.push({
        id: `KYC-${d.id.replace(/[^0-9]/g, '') || Date.now().toString().slice(-4)}`,
        mitraId: d.id,
        mitraName: d.name,
        phone: d.phone,
        nik: d.nik || '-',
        ktpImageUrl: d.ktpPhoto || '',
        selfieImageUrl: d.selfieKtpPhoto || d.avatar || '',
        bankDetails: d.bankDetails || {
          bankName: d.bankName || 'SeaBank',
          bankAccount: d.bankAccount || d.phone,
          bankHolder: d.bankHolder || d.name
        },
        status: d.kycStatus || 'pending',
        submittedAt: d.createdAt || new Date().toISOString(),
        reviewNotes: 'Data pendaftaran identitas mitra driver resmi.'
      });
    }
  });

  // Sinkronkan data terbaru setiap mitra driver
  const enriched = kycRequests.map(k => {
    const driver = drivers.find(d => d.id === k.mitraId);
    return {
      ...k,
      mitraName: k.mitraName || (driver && driver.name) || 'Mitra Driver',
      phone: k.phone || (driver && driver.phone) || '-',
      nik: (driver && driver.nik) ? driver.nik : (k.nik || '-'),
      bankDetails: (driver && driver.bankDetails && driver.bankDetails.bankAccount) ? driver.bankDetails : (k.bankDetails || { bankName: 'SeaBank', bankAccount: '-', bankHolder: '-' }),
      ktpImageUrl: (driver && driver.ktpPhoto) ? driver.ktpPhoto : (k.ktpImageUrl || ''),
      selfieImageUrl: (driver && driver.selfieKtpPhoto) ? driver.selfieKtpPhoto : (k.selfieImageUrl || ''),
      status: (driver && driver.kycStatus) ? driver.kycStatus : (k.status || 'pending')
    };
  });

  res.json({ success: true, data: enriched });
});

app.post('/api/admin/kyc/:id/review', requireAdminAuth, (req, res) => {
  const { status, reviewNotes } = req.body;
  const kycRequests = db.get('kycRequests') || [];
  const kIndex = kycRequests.findIndex(k => k.id === req.params.id);
  if (kIndex === -1) return res.status(404).json({ success: false, message: 'Permohonan KYC tidak ditemukan' });

  kycRequests[kIndex].status = status;
  kycRequests[kIndex].reviewNotes = reviewNotes || (status === 'approved' ? 'Disetujui oleh admin' : 'Ditolak, silakan unggah ulang KTP yang jelas');
  kycRequests[kIndex].reviewedAt = new Date().toISOString();
  db.set('kycRequests', kycRequests);

  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === kycRequests[kIndex].mitraId);
  if (uIndex !== -1) {
    users[uIndex].kycStatus = status;
    if (status === 'approved') {
      users[uIndex].status = 'ready';
      io.emit('mitra:status_change', { mitraId: users[uIndex].id, status: 'ready', name: users[uIndex].name, lat: users[uIndex].lat, lng: users[uIndex].lng });
      io.emit('mitra:online', users[uIndex]);
    } else if (status === 'rejected') {
      users[uIndex].status = 'offline';
      io.emit('mitra:status_change', { mitraId: users[uIndex].id, status: 'offline', name: users[uIndex].name, lat: users[uIndex].lat, lng: users[uIndex].lng });
    }
    db.set('users', users);
    io.emit('kyc:reviewed', { mitraId: users[uIndex].id, status, notes: kycRequests[kIndex].reviewNotes });
  }

  res.json({ success: true, message: `Status KYC & Pendaftaran Mitra berhasil ${status === 'approved' ? 'dikonfirmasi dan diaktifkan' : 'ditolak'}`, data: kycRequests[kIndex] });
});

// Verifikasi langsung Mitra (Diterima / Ditolak) oleh Admin
app.post('/api/admin/mitra/:id/verify', requireAdminAuth, (req, res) => {
  const { status, reviewNotes } = req.body;
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  users[uIndex].kycStatus = status || 'approved';
  if (status === 'approved') {
    users[uIndex].status = 'ready';
  } else if (status === 'rejected') {
    users[uIndex].status = 'offline';
  }
  db.set('users', users);

  // Sinkronkan kycRequests jika ada
  const kycRequests = db.get('kycRequests') || [];
  const kIndex = kycRequests.findIndex(k => k.mitraId === req.params.id);
  if (kIndex !== -1) {
    kycRequests[kIndex].status = status || 'approved';
    kycRequests[kIndex].reviewNotes = reviewNotes || 'Diverifikasi langsung oleh admin SobatSerabut';
    kycRequests[kIndex].reviewedAt = new Date().toISOString();
    db.set('kycRequests', kycRequests);
  }

  io.emit('kyc:reviewed', { mitraId: users[uIndex].id, status, notes: reviewNotes });
  io.emit('mitra:status_change', { mitraId: users[uIndex].id, status: users[uIndex].status, name: users[uIndex].name });

  res.json({ success: true, message: `Mitra ${users[uIndex].name} berhasil ${status === 'approved' ? 'diverifikasi dan disetujui (diterima)' : 'ditolak'}!`, data: users[uIndex] });
});

// Admin mentransfer dana / mengkredit saldo dompet Mitra ke rekening/ewallet terdaftar
app.post('/api/admin/mitra/:id/transfer-saldo', requireAdminAuth, (req, res) => {
  const { amount, notes } = req.body;
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Nominal transfer tidak valid' });
  }

  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });

  const mitra = users[uIndex];
  mitra.walletBalance = (mitra.walletBalance || 0) + numAmount;
  db.set('users', users);

  const bankInfo = mitra.bankDetails || { bankName: 'SeaBank/E-Wallet', bankAccount: mitra.phone };
  const transactions = db.get('transactions') || [];
  const newTrx = {
    id: `TRF-${Date.now().toString().slice(-4)}`,
    type: 'admin_transfer_to_mitra',
    amount: numAmount,
    mitraId: mitra.id,
    mitraName: mitra.name,
    destination: `${bankInfo.bankName}: ${bankInfo.bankAccount} (a.n. ${bankInfo.bankHolder || mitra.name})`,
    description: notes || `Transfer pencairan oleh Admin ke ${bankInfo.bankName} ${bankInfo.bankAccount}`,
    timestamp: new Date().toISOString()
  };
  transactions.unshift(newTrx);
  db.set('transactions', transactions);

  io.emit('user:balance_update', { userId: mitra.id, newBalance: mitra.walletBalance });
  io.emit('mitra:transfer_received', { mitraId: mitra.id, amount: numAmount, destination: newTrx.destination });

  res.json({
    success: true,
    message: `Berhasil mentransfer Rp ${numAmount.toLocaleString('id-ID')} ke dompet/rekening mitra ${mitra.name} (${bankInfo.bankName} - ${bankInfo.bankAccount})!`,
    newBalance: mitra.walletBalance,
    data: newTrx
  });
});

app.get('/api/admin/withdrawals', requireAdminAuth, (req, res) => {
  res.json({ success: true, data: db.get('withdrawals') || [] });
});

app.post('/api/admin/withdrawals/:id/process', requireAdminAuth, (req, res) => {
  const { status } = req.body;
  const withdrawals = db.get('withdrawals') || [];
  const wIndex = withdrawals.findIndex(w => w.id === req.params.id);
  if (wIndex === -1) return res.status(404).json({ success: false, message: 'Permintaan penarikan tidak ditemukan' });

  withdrawals[wIndex].status = status;
  withdrawals[wIndex].processedAt = new Date().toISOString();
  db.set('withdrawals', withdrawals);

  io.emit('withdrawal:processed', withdrawals[wIndex]);
  res.json({ success: true, message: `Penarikan dana status: ${status}`, data: withdrawals[wIndex] });
});

app.get('/api/admin/transactions', requireAdminAuth, (req, res) => {
  res.json({ success: true, data: db.get('transactions') || [] });
});

// Verifikasi & Konfirmasi Foto serta Data Pengguna (Klien atau Mitra) oleh Admin
app.post('/api/admin/users/:id/verify-photo', requireAdminAuth, (req, res) => {
  const { status, reviewNotes } = req.body; // status: 'approved' | 'rejected'
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === req.params.id);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });

  const isApproved = (status === 'approved');
  users[uIndex].photoConfirmed = isApproved;
  users[uIndex].photoStatus = isApproved ? 'approved' : 'rejected';
  users[uIndex].photoReviewNotes = reviewNotes || (isApproved ? 'Foto identitas dan data telah diverifikasi sesuai oleh Admin' : 'Foto tidak sesuai atau buram');
  users[uIndex].photoReviewedAt = new Date().toISOString();

  // Jika mitra, sinkronkan KYC
  if (users[uIndex].role === 'mitra') {
    users[uIndex].kycStatus = isApproved ? 'approved' : 'rejected';
    if (isApproved) users[uIndex].status = 'ready';
    else users[uIndex].status = 'offline';
  }

  db.set('users', users);

  // Sinkronkan ke KYC jika ada
  const kycRequests = db.get('kycRequests') || [];
  const kIndex = kycRequests.findIndex(k => k.mitraId === req.params.id);
  if (kIndex !== -1) {
    kycRequests[kIndex].status = isApproved ? 'approved' : 'rejected';
    kycRequests[kIndex].reviewNotes = users[uIndex].photoReviewNotes;
    kycRequests[kIndex].reviewedAt = new Date().toISOString();
    db.set('kycRequests', kycRequests);
  }

  io.emit('user:photo_reviewed', {
    userId: users[uIndex].id,
    role: users[uIndex].role,
    status: users[uIndex].photoStatus,
    notes: users[uIndex].photoReviewNotes
  });

  res.json({
    success: true,
    message: `Data & Foto ${users[uIndex].name} berhasil ${isApproved ? 'dikonfirmasi sesuai & disetujui' : 'ditolak (tidak sesuai)'}!`,
    data: users[uIndex]
  });
});

// Verifikasi Bukti Foto Penyelesaian Tugas oleh Admin
app.post('/api/admin/orders/:id/confirm-proof', requireAdminAuth, (req, res) => {
  const { status, notes } = req.body; // 'approved' | 'disputed'
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan' });

  const isApproved = (status === 'approved');
  orders[oIndex].proofConfirmed = isApproved;
  orders[oIndex].proofConfirmedAt = new Date().toISOString();
  orders[oIndex].proofNotes = notes || (isApproved ? 'Bukti foto pengerjaan tugas valid dan sesuai konfirmasi Admin.' : 'Bukti foto diragukan.');

  db.set('orders', orders);
  io.emit('order:proof_confirmed', {
    orderId: orders[oIndex].id,
    status: isApproved ? 'approved' : 'disputed',
    notes: orders[oIndex].proofNotes
  });

  res.json({
    success: true,
    message: `Bukti foto tugas ${orders[oIndex].id} berhasil ${isApproved ? 'dikonfirmasi valid & sesuai' : 'ditandai diragukan'}.`,
    data: orders[oIndex]
  });
});

/* ========================================================
 * AUTH ENDPOINTS TAMBAHAN: DRIVER & CLIENT
 * ======================================================== */

// Driver login (Khusus Aplikasi Driver)
app.post('/api/auth/driver/login', (req, res) => {
  const { phone, password, phoneOrEmail } = req.body;
  const inputParam = phone || phoneOrEmail;
  if (!inputParam || !password) {
    return res.status(400).json({ success: false, message: 'Nomor HP/Nama Akun dan kata sandi wajib diisi.' });
  }
  const cleanInput = inputParam.toString().trim();
  const cleanPhone = cleanInput.replace(/[^0-9]/g, '');
  const users = db.get('users') || [];
  const driver = users.find(u => {
    const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
    const phoneMatch = cleanPhone && uPhone && (
      uPhone === cleanPhone ||
      (uPhone.length >= 9 && cleanPhone.endsWith(uPhone.slice(-9))) ||
      (cleanPhone.length >= 9 && uPhone.endsWith(cleanPhone.slice(-9)))
    );
    const nameMatch = u.name && u.name.trim().toLowerCase() === cleanInput.toLowerCase();
    const nikMatch = u.nik && u.nik === cleanInput;
    return (phoneMatch || nameMatch || nikMatch) && u.password === password && u.role === 'mitra';
  });

  if (!driver) {
    // Periksa apakah pengguna ada tetapi terdaftar sebagai Klien
    const isClient = users.find(u => {
      const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
      const phoneMatch = cleanPhone && uPhone && (
        uPhone === cleanPhone ||
        (uPhone.length >= 9 && cleanPhone.endsWith(uPhone.slice(-9))) ||
        (cleanPhone.length >= 9 && uPhone.endsWith(cleanPhone.slice(-9)))
      );
      return phoneMatch && u.password === password && u.role === 'klien';
    });
    if (isClient) {
      return res.status(403).json({
        success: false,
        roleMismatch: true,
        message: 'Nomor ini terdaftar sebagai Akun Klien SobatSerabut. Untuk masuk ke Aplikasi Driver, silakan mendaftar sebagai Driver Mitra terlebih dahulu.'
      });
    }
    return res.status(401).json({ success: false, message: 'Nomor HP, Nama Akun, atau kata sandi Driver salah.' });
  }

  // Cek Status Penangguhan / Pemutusan
  if (driver.accountStatus === 'suspended') {
    return res.status(403).json({
      success: false,
      suspended: true,
      message: `Akun Driver Anda sedang ditangguhkan (Suspended) oleh Admin. Alasan: ${driver.suspendReason || 'Pemeriksaan standar'}. Silakan hubungi Admin untuk bantuan.`
    });
  }
  if (driver.accountStatus === 'terminated') {
    return res.status(403).json({
      success: false,
      terminated: true,
      message: 'Kemitraan Driver Anda telah dinonaktifkan secara permanen (Terminated).'
    });
  }

  driver.status = 'ready';
  driver.lastActive = new Date().toISOString();
  db.set('users', users);
  io.emit('mitra:status_change', { mitraId: driver.id, status: 'ready', name: driver.name, lat: driver.lat, lng: driver.lng });
  io.emit('driver:status_change', { driverId: driver.id, status: 'ready', name: driver.name, lat: driver.lat, lng: driver.lng });
  res.json({
    success: true,
    message: `Selamat datang kembali di Aplikasi Driver, ${driver.name}!`,
    data: driver
  });
});

// Driver register (Khusus Pendaftaran Driver)
app.post('/api/auth/driver/register', (req, res) => {
  const { name, phone, password, ktpPhoto, selfiePhoto, skills, vehicle, bankName, bankAccount, bankHolder } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ success: false, message: 'Nomor HP dan kata sandi wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Kata sandi minimal 6 karakter.' });
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const users = db.get('users') || [];
  const existingDriver = users.find(u => {
    const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
    return uPhone === cleanPhone && u.role === 'mitra';
  });
  if (existingDriver) {
    return res.status(400).json({
      success: false,
      message: 'Nomor HP ini sudah terdaftar sebagai Driver Mitra. Silakan langsung masuk ke Akun Driver.'
    });
  }

  const processedKtp = saveBase64Image(ktpPhoto, 'ktp') || '';
  const processedSelfie = saveBase64Image(selfiePhoto, 'selfie') || '';
  const newDriver = {
    id: `MTR-${Date.now().toString().slice(-4)}`,
    name: (name && name.trim()) ? name.trim() : `Driver ${cleanPhone.slice(-4)}`,
    phone: phone.trim(),
    email: `${cleanPhone}@sobatserabut.id`,
    password: password.trim(),
    role: 'mitra',
    avatar: processedSelfie || '/uploads/avatar_mitra.svg',
    walletBalance: 0,
    status: 'ready',
    accountStatus: 'active',
    points: 100,
    pointHistory: [{
      id: `PTS-${Date.now().toString().slice(-5)}`,
      timestamp: new Date().toISOString(),
      action: 'initial',
      change: 100,
      newTotal: 100,
      reason: 'Poin apresiasi pendaftaran Driver SobatSerabut'
    }],
    rating: 5.0,
    completedOrders: 0,
    cancelRate: 0.0,
    earnings: 0,
    isPremium: false,
    kycStatus: 'pending',
    skills: Array.isArray(skills) ? skills : [skills || 'Kurir & Pengiriman'],
    vehicle: vehicle || 'Sepeda Motor',
    ktpPhoto: processedKtp,
    selfieKtpPhoto: processedSelfie,
    bankDetails: {
      bankName: bankName || 'DANA',
      bankAccount: bankAccount || cleanPhone,
      bankHolder: bankHolder || name
    },
    createdAt: new Date().toISOString()
  };

  users.unshift(newDriver);
  db.set('users', users);

  const kycRequests = db.get('kycRequests') || [];
  kycRequests.unshift({
    id: `KYC-${Date.now().toString().slice(-4)}`,
    mitraId: newDriver.id,
    mitraName: newDriver.name,
    phone: newDriver.phone,
    ktpImageUrl: processedKtp,
    selfieImageUrl: processedSelfie,
    bankDetails: newDriver.bankDetails,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    reviewNotes: 'Pendaftaran driver baru, menunggu verifikasi dokumen admin.'
  });
  db.set('kycRequests', kycRequests);

  io.emit('kyc:new', kycRequests[0]);
  io.emit('mitra:online', newDriver);
  res.json({
    success: true,
    message: 'Pendaftaran Driver berhasil! Akun Driver Anda telah aktif. Silakan masuk untuk mulai bekerja.',
    data: newDriver
  });
});

// Client login (Khusus Aplikasi Klien SobatSerabut)
app.post('/api/auth/client/login', (req, res) => {
  const { phone, password, phoneOrEmail } = req.body;
  const inputParam = phone || phoneOrEmail;
  if (!inputParam || !password) {
    return res.status(400).json({ success: false, message: 'Nomor HP/Nama Akun dan kata sandi wajib diisi.' });
  }
  const cleanInput = inputParam.toString().trim();
  const cleanPhone = cleanInput.replace(/[^0-9]/g, '');
  const users = db.get('users') || [];
  const client = users.find(u => {
    const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
    const phoneMatch = cleanPhone && uPhone && (
      uPhone === cleanPhone ||
      (uPhone.length >= 9 && cleanPhone.endsWith(uPhone.slice(-9))) ||
      (cleanPhone.length >= 9 && uPhone.endsWith(cleanPhone.slice(-9)))
    );
    const nameMatch = u.name && u.name.trim().toLowerCase() === cleanInput.toLowerCase();
    return (phoneMatch || nameMatch) && u.password === password && u.role === 'klien';
  });

  if (!client) {
    // Periksa apakah pengguna adalah Mitra Driver
    const isMitra = users.find(u => {
      const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
      const phoneMatch = cleanPhone && uPhone && (
        uPhone === cleanPhone ||
        (uPhone.length >= 9 && cleanPhone.endsWith(uPhone.slice(-9))) ||
        (cleanPhone.length >= 9 && uPhone.endsWith(cleanPhone.slice(-9)))
      );
      return phoneMatch && u.password === password && u.role === 'mitra';
    });
    if (isMitra) {
      return res.status(403).json({
        success: false,
        roleMismatch: true,
        message: 'Nomor ini terdaftar sebagai Akun Driver Mitra. Silakan buka Aplikasi Driver SobatSerabut untuk masuk.'
      });
    }
    return res.status(401).json({ success: false, message: 'Nomor HP, Nama Akun, atau kata sandi Klien salah.' });
  }

  // Cek Status Penangguhan
  if (client.accountStatus === 'suspended') {
    return res.status(403).json({
      success: false,
      suspended: true,
      message: `Akun Klien Anda sedang ditangguhkan (Suspended) oleh Admin. Alasan: ${client.suspendReason || 'Pemeriksaan standar'}.`
    });
  }
  if (client.accountStatus === 'terminated') {
    return res.status(403).json({
      success: false,
      terminated: true,
      message: 'Akun Klien Anda telah dinonaktifkan secara permanen.'
    });
  }

  client.lastActive = new Date().toISOString();
  db.set('users', users);
  res.json({ success: true, message: `Selamat datang kembali, ${client.name}!`, data: client });
});

// Client register (Khusus Pendaftaran Klien - Wajib Isi Alamat Lengkap)
app.post('/api/auth/client/register', (req, res) => {
  const { name, phone, password, address, street, houseNumber, rt, rw, kelurahan, kecamatan, city, benchmark, lat, lng } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ success: false, message: 'Nomor HP dan kata sandi wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Kata sandi minimal 6 karakter.' });
  }

  // Wajib mengisi alamat lengkap saat mendaftar
  let resolvedAddress = (address || '').trim();
  if (!resolvedAddress && (street || houseNumber || kelurahan || kecamatan || city)) {
    const parts = [];
    if (street) parts.push(street.trim());
    if (houseNumber) parts.push(`No. ${houseNumber.trim()}`);
    if (rt || rw) parts.push(`RT ${rt || '-'}/RW ${rw || '-'}`);
    if (kelurahan) parts.push(`Kel. ${kelurahan.trim()}`);
    if (kecamatan) parts.push(`Kec. ${kecamatan.trim()}`);
    if (city) parts.push(city.trim());
    resolvedAddress = parts.join(', ');
  }

  if (!resolvedAddress || resolvedAddress.length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Pada saat pendaftaran akun Klien, Anda diwajibkan mengisi alamat lengkap (Nama Jalan/Gang, No. Rumah, RT/RW, Kelurahan, Kecamatan, Kota).'
    });
  }

  const structuredAddress = {
    street: (street || '').trim(),
    houseNumber: (houseNumber || '').trim(),
    rt: (rt || '').trim(),
    rw: (rw || '').trim(),
    kelurahan: (kelurahan || '').trim(),
    kecamatan: (kecamatan || '').trim(),
    city: (city || '').trim(),
    benchmark: (benchmark || '').trim(),
    fullAddress: resolvedAddress,
    lat: Number(lat) || -6.2088,
    lng: Number(lng) || 106.8456
  };

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const users = db.get('users') || [];
  const existing = users.find(u => {
    const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
    return uPhone === cleanPhone && u.role === 'klien';
  });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Nomor HP sudah terdaftar sebagai Klien. Silakan langsung masuk.' });
  }

  const newClient = {
    id: `KLN-${Date.now().toString().slice(-4)}`,
    name: (name && name.trim()) ? name.trim() : `Klien ${cleanPhone.slice(-4)}`,
    phone: phone.trim(),
    email: `${cleanPhone}@sobatserabut.id`,
    password: password.trim(),
    role: 'klien',
    avatar: '/uploads/avatar_klien.svg',
    address: resolvedAddress,
    structuredAddress: structuredAddress,
    addresses: [structuredAddress],
    lat: structuredAddress.lat,
    lng: structuredAddress.lng,
    walletBalance: 0,
    totalOrdersPosted: 0,
    accountStatus: 'active',
    paymentAccount: { type: 'ewallet', provider: 'DANA', accountNo: cleanPhone, accountName: name },
    createdAt: new Date().toISOString()
  };

  users.unshift(newClient);
  db.set('users', users);
  io.emit('user:registered', { id: newClient.id, name: newClient.name, role: newClient.role });
  res.json({ success: true, message: 'Pendaftaran Klien berhasil! Alamat lengkap Anda telah tersimpan otomatis.', data: newClient });
});

/* ========================================================
 * ADMIN MANAGEMENT: SUSPEND, UNSUSPEND, TERMINATE, POINTS & BROADCAST
 * ======================================================== */

// 1. Suspen Akun Driver
app.post('/api/admin/driver/:id/suspend', requireAdminAuth, (req, res) => {
  const { reason } = req.body;
  const users = db.get('users') || [];
  const driver = users.find(u => u.id === req.params.id && u.role === 'mitra');
  if (!driver) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });

  driver.accountStatus = 'suspended';
  driver.suspendReason = reason || 'Ditangguhkan sementara oleh Admin untuk audit kepatuhan';
  driver.suspendedAt = new Date().toISOString();
  driver.status = 'offline';
  db.set('users', users);

  io.emit('driver:suspended', { driverId: driver.id, reason: driver.suspendReason });
  io.emit('driver:status_change', { driverId: driver.id, status: 'offline', name: driver.name });
  io.emit('mitra:status_change', { mitraId: driver.id, status: 'offline', name: driver.name });

  res.json({
    success: true,
    message: `Driver ${driver.name} berhasil ditangguhkan (Suspended). Driver tidak dapat menerima order selama ditangguhkan.`,
    data: driver
  });
});

// 2. Buka Suspen Akun Driver
app.post('/api/admin/driver/:id/unsuspend', requireAdminAuth, (req, res) => {
  const users = db.get('users') || [];
  const driver = users.find(u => u.id === req.params.id && u.role === 'mitra');
  if (!driver) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });

  driver.accountStatus = 'active';
  driver.suspendReason = null;
  driver.unsuspendedAt = new Date().toISOString();
  driver.status = 'ready';
  db.set('users', users);

  io.emit('driver:unsuspended', { driverId: driver.id });
  io.emit('driver:status_change', { driverId: driver.id, status: 'ready', name: driver.name });
  io.emit('mitra:status_change', { mitraId: driver.id, status: 'ready', name: driver.name });

  res.json({
    success: true,
    message: `Status suspen untuk driver ${driver.name} berhasil dibuka. Akun kembali aktif & siap menerima tugas!`,
    data: driver
  });
});

// 3. Terminate Driver (Pemutusan Kemitraan Permanen)
app.post('/api/admin/driver/:id/terminate', requireAdminAuth, (req, res) => {
  const { reason } = req.body;
  const users = db.get('users') || [];
  const driver = users.find(u => u.id === req.params.id && u.role === 'mitra');
  if (!driver) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });

  driver.accountStatus = 'terminated';
  driver.suspendReason = reason || 'Kemitraan dihentikan permanen oleh Admin SobatSerabut';
  driver.terminatedAt = new Date().toISOString();
  driver.status = 'offline';
  db.set('users', users);

  io.emit('driver:terminated', { driverId: driver.id, reason: driver.suspendReason });
  io.emit('driver:status_change', { driverId: driver.id, status: 'offline', name: driver.name });
  io.emit('mitra:status_change', { mitraId: driver.id, status: 'offline', name: driver.name });

  res.json({
    success: true,
    message: `Kemitraan driver ${driver.name} telah berhasil dihentikan secara permanen (Terminated).`,
    data: driver
  });
});

// 4. Berikan / Kelola Poin Kinerja Driver (Gamifikasi & Penghargaan Kerja Sungguh-sungguh)
app.post('/api/admin/driver/:id/points', requireAdminAuth, (req, res) => {
  const { amount, action, reason } = req.body; // action: 'add' | 'deduct' | 'set'
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 0) {
    return res.status(400).json({ success: false, message: 'Jumlah poin harus berupa angka positif.' });
  }

  const users = db.get('users') || [];
  const driver = users.find(u => u.id === req.params.id && u.role === 'mitra');
  if (!driver) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });

  const currentPoints = typeof driver.points === 'number' ? driver.points : 100;
  let newPoints = currentPoints;
  const act = action || 'add';

  if (act === 'deduct') {
    newPoints = Math.max(0, currentPoints - numAmount);
  } else if (act === 'set') {
    newPoints = Math.max(0, numAmount);
  } else {
    // default 'add'
    newPoints = currentPoints + numAmount;
  }

  driver.points = newPoints;
  if (!Array.isArray(driver.pointHistory)) driver.pointHistory = [];
  const pointEntry = {
    id: `PTS-${Date.now().toString().slice(-5)}`,
    timestamp: new Date().toISOString(),
    action: act,
    change: numAmount,
    newTotal: newPoints,
    reason: reason || (act === 'deduct' ? 'Penalti ketidakhadiran / keterlambatan' : 'Bonus ketekunan & kedisiplinan kerja nyata')
  };
  driver.pointHistory.unshift(pointEntry);
  db.set('users', users);

  io.emit('driver:points_updated', {
    driverId: driver.id,
    driverName: driver.name,
    points: newPoints,
    change: numAmount,
    action: act,
    reason: pointEntry.reason
  });

  res.json({
    success: true,
    message: `Poin kinerja untuk driver ${driver.name} berhasil diubah menjadi ${newPoints} Poin! (${act === 'deduct' ? '-' : '+'}${numAmount})`,
    points: newPoints,
    data: driver
  });
});

// 5. Kirim Notifikasi Siaran Promo & Pengumuman Massal (Broadcast Notification)
app.post('/api/admin/broadcast-notification', requireAdminAuth, (req, res) => {
  const { target, type, title, message } = req.body;
  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'Judul dan pesan siaran wajib diisi.' });
  }

  const broadcastItem = {
    id: `BC-${Date.now()}`,
    target: target || 'all', // 'all', 'driver', 'client'
    type: type || 'promo',   // 'promo', 'announcement', 'urgent'
    title: title.trim(),
    message: message.trim(),
    createdAt: new Date().toISOString(),
    createdBy: 'Admin SobatSerabut'
  };

  const broadcasts = db.get('broadcasts') || [];
  broadcasts.unshift(broadcastItem);
  db.set('broadcasts', broadcasts.slice(0, 50)); // Simpan 50 notif riwayat

  if (type === 'promo' || type === 'announcement') {
    db.updateConfig({ announcement: `${title.trim()}: ${message.trim()}` });
  }

  // Siarkan langsung ke semua perangkat Android, PWA & Web via Socket.io
  io.emit('broadcast:notification', broadcastItem);
  io.emit('system:announcement', { text: `${title}: ${message}` });

  res.json({
    success: true,
    message: `Notifikasi ${broadcastItem.type.toUpperCase()} berhasil disiarkan ke ${broadcastItem.target === 'all' ? 'seluruh pengguna' : broadcastItem.target === 'driver' ? 'seluruh Driver Mitra' : 'seluruh Klien'}!`,
    data: broadcastItem
  });
});

// 6. Endpoint Pengambilan Riwayat Notifikasi Aktif oleh Driver & Client App
app.get('/api/notifications/active', (req, res) => {
  const target = req.query.target; // 'driver' or 'client'
  const broadcasts = db.get('broadcasts') || [];
  const filtered = broadcasts.filter(b => {
    if (!target) return true;
    return b.target === 'all' || b.target === target;
  });
  res.json({ success: true, data: filtered.slice(0, 20) });
});

/* ========================================================
 * KATEGORI JASA - ALIAS ENDPOINT /api/admin/categories
 * ======================================================== */
// Inisialisasi kategori default jika kosong
function initDefaultCategories() {
  let cats = db.get('categories') || [];
  if (cats.length === 0) {
    const defaults = [
      { name: 'AC & Pendingin', icon: 'snowflake', image: '/uploads/service_ac.png', baseFare: 50000, description: 'Servis, cuci, dan isi freon AC', active: true },
      { name: 'Instalasi Listrik', icon: 'bolt', image: '/uploads/service_electric.png', baseFare: 40000, description: 'Pasang saklar, stop kontak, panel listrik', active: true },
      { name: 'Tukang Bangunan', icon: 'screwdriver-wrench', image: '/uploads/service_runner.png', baseFare: 60000, description: 'Perbaikan dinding, lantai, plafon', active: true },
      { name: 'Kebersihan & Cleaning', icon: 'broom', image: '/uploads/service_clean.png', baseFare: 35000, description: 'Bersih rumah, kantor, kos-kosan', active: true },
      { name: 'Kurir & Pengiriman', icon: 'motorcycle', image: '/uploads/service_runner.png', baseFare: 20000, description: 'Antar jemput barang dan dokumen', active: true },
      { name: 'Pipa & Ledeng', icon: 'faucet', image: '/uploads/service_plumber.png', baseFare: 45000, description: 'Perbaikan pipa bocor, saluran mampet', active: true },
      { name: 'Tambal Ban & Darurat', icon: 'circle-dot', image: '/uploads/service_tire.png', baseFare: 25000, description: 'Tambal ban, ganti ban, darurat jalan', active: true },
      { name: 'Pertukangan Kayu', icon: 'hammer', image: '/uploads/service_carpentry.png', baseFare: 55000, description: 'Pembuatan dan perbaikan furniture kayu', active: true },
      { name: 'Cuci Motor & Mobil', icon: 'car', image: '/uploads/service_washing.png', baseFare: 30000, description: 'Cuci kendaraan di lokasi Anda', active: true },
    ];
    cats = defaults.map((c, i) => ({ id: `cat-default-${i + 1}`, ...c }));
    db.set('categories', cats);
  }
}
initDefaultCategories();

app.post('/api/admin/categories', requireAdminAuth, (req, res) => {
  const categories = db.get('categories') || [];
  const cname = (req.body.name || '').toLowerCase();
  let defaultImg = '/uploads/service_runner.png';
  if (cname.includes('ac')) defaultImg = '/uploads/service_ac.png';
  else if (cname.includes('bersih') || cname.includes('clean')) defaultImg = '/uploads/service_clean.png';
  else if (cname.includes('listrik')) defaultImg = '/uploads/service_electric.png';
  else if (cname.includes('pipa') || cname.includes('ledeng')) defaultImg = '/uploads/service_plumber.png';
  else if (cname.includes('ban')) defaultImg = '/uploads/service_tire.png';
  else if (cname.includes('kayu') || cname.includes('tukang')) defaultImg = '/uploads/service_carpentry.png';
  else if (cname.includes('cuci')) defaultImg = '/uploads/service_washing.png';

  const newCat = {
    id: `cat-${Date.now()}`,
    name: req.body.name,
    icon: req.body.icon || 'screwdriver-wrench',
    image: req.body.image || defaultImg,
    baseFare: Number(req.body.baseFare) || 30000,
    description: req.body.description || '',
    active: req.body.active !== undefined ? req.body.active : true
  };
  categories.push(newCat);
  db.set('categories', categories);
  io.emit('categories:updated', categories);
  io.emit('categories:update', categories);
  res.json({ success: true, message: 'Kategori baru berhasil ditambahkan', data: newCat });
});

app.delete('/api/admin/categories/:id', requireAdminAuth, (req, res) => {
  let categories = db.get('categories') || [];
  categories = categories.filter(c => c.id !== req.params.id);
  db.set('categories', categories);
  io.emit('categories:updated', categories);
  io.emit('categories:update', categories);
  res.json({ success: true, message: 'Kategori berhasil dihapus' });
});

// PUT /api/admin/categories/:id - Update/toggle kategori
app.put('/api/admin/categories/:id', requireAdminAuth, (req, res) => {
  try {
    const categories = db.get('categories') || [];
    const idx = categories.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });

    categories[idx] = { ...categories[idx], ...req.body };
    if (req.body.baseFare) categories[idx].baseFare = Number(req.body.baseFare);
    db.set('categories', categories);
    io.emit('categories:updated', categories);
    io.emit('categories:update', categories);
    res.json({ success: true, data: categories[idx], message: 'Kategori diperbarui' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

/* ========================================================
 * DRIVER ENDPOINTS TAMBAHAN
 * ======================================================== */

// Update status driver (online/offline/busy)
app.post('/api/driver/status', (req, res) => {
  const { driverId, status } = req.body;
  if (!driverId || !status) {
    return res.status(400).json({ success: false, message: 'driverId dan status wajib diisi.' });
  }
  const validStatuses = ['online', 'offline', 'busy', 'ready', 'working'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Status tidak valid. Gunakan: online, offline, busy.' });
  }

  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === driverId);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });

  if (users[uIndex].accountStatus === 'suspended') {
    return res.status(403).json({
      success: false,
      suspended: true,
      message: `Akun Anda sedang ditangguhkan (Suspended) oleh Admin. Alasan: ${users[uIndex].suspendReason || 'Pemeriksaan kepatuhan'}. Hubungi Admin untuk bantuan.`
    });
  }
  if (users[uIndex].accountStatus === 'terminated') {
    return res.status(403).json({
      success: false,
      terminated: true,
      message: 'Kemitraan akun Anda telah dinonaktifkan secara permanen (Terminated).'
    });
  }

  const mappedStatus = status === 'online' ? 'ready' : status === 'busy' ? 'working' : status;
  users[uIndex].status = mappedStatus;
  users[uIndex].lastActive = new Date().toISOString();
  db.set('users', users);

  const payload = { driverId, status: mappedStatus, location: { lat: users[uIndex].lat, lng: users[uIndex].lng }, name: users[uIndex].name };
  io.emit('driver:status_change', payload);
  io.emit('mitra:status_change', { mitraId: driverId, status: mappedStatus, name: users[uIndex].name, lat: users[uIndex].lat, lng: users[uIndex].lng });

  res.json({ success: true, message: `Status driver diperbarui ke ${mappedStatus}`, data: users[uIndex] });
});

// Update lokasi GPS driver
app.post('/api/driver/location', (req, res) => {
  const { driverId, lat, lng } = req.body;
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!driverId || isNaN(numLat) || isNaN(numLng)) {
    return res.status(400).json({ success: false, message: 'driverId, lat, dan lng wajib diisi.' });
  }

  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === driverId);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });

  users[uIndex].lat = numLat;
  users[uIndex].lng = numLng;
  users[uIndex].lastActive = new Date().toISOString();
  db.set('users', users);

  const payload = { driverId, lat: numLat, lng: numLng, name: users[uIndex].name, status: users[uIndex].status };
  io.emit('driver:location_update', payload);
  io.emit('mitra:location_update', { mitraId: driverId, ...payload });

  res.json({ success: true, message: 'Lokasi driver diperbarui', data: payload });
});

// Cek saldo driver
app.get('/api/driver/balance', (req, res) => {
  const { driverId } = req.query;
  if (!driverId) return res.status(400).json({ success: false, message: 'driverId wajib diisi.' });
  const users = db.get('users') || [];
  const driver = users.find(u => u.id === driverId);
  if (!driver) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });
  res.json({ success: true, data: { balance: driver.walletBalance || 0, driverId, name: driver.name } });
});

// Request top-up saldo driver
app.post('/api/driver/topup', (req, res) => {
  const { driverId, amount, method, provider } = req.body;
  if (!driverId || !amount) return res.status(400).json({ success: false, message: 'driverId dan amount wajib diisi.' });
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 10000) {
    return res.status(400).json({ success: false, message: 'Minimal top-up Rp 10.000.' });
  }
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === driverId);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });

  users[uIndex].walletBalance = (users[uIndex].walletBalance || 0) + numAmount;
  db.set('users', users);

  const transactions = db.get('transactions') || [];
  const topupRecord = {
    id: `TOP-${Date.now().toString().slice(-4)}`,
    type: 'driver_topup',
    amount: numAmount,
    userId: driverId,
    userName: users[uIndex].name,
    method: method || 'ewallet',
    provider: provider || 'DANA',
    status: 'success',
    timestamp: new Date().toISOString()
  };
  transactions.unshift(topupRecord);
  db.set('transactions', transactions);

  io.emit('user:balance_update', { userId: driverId, newBalance: users[uIndex].walletBalance });
  res.json({ success: true, message: `Top-up Rp ${numAmount.toLocaleString('id-ID')} berhasil.`, newBalance: users[uIndex].walletBalance, data: topupRecord });
});

// Request tarik saldo driver
app.post('/api/driver/withdraw', (req, res) => {
  const { driverId, amount, bankName, accountNumber, accountHolder } = req.body;
  if (!driverId || !amount) return res.status(400).json({ success: false, message: 'driverId dan amount wajib diisi.' });
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 20000) {
    return res.status(400).json({ success: false, message: 'Minimal penarikan Rp 20.000.' });
  }
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === driverId);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });
  if ((users[uIndex].walletBalance || 0) < numAmount) {
    return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi.' });
  }

  users[uIndex].walletBalance -= numAmount;
  db.set('users', users);

  const withdrawals = db.get('withdrawals') || [];
  const newWd = {
    id: `WD-${Date.now().toString().slice(-4)}`,
    mitraId: driverId,
    mitraName: users[uIndex].name,
    amount: numAmount,
    channelType: bankName || 'DANA',
    destination: accountNumber || users[uIndex].phone,
    accountHolder: accountHolder || users[uIndex].name,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    processedAt: null
  };
  withdrawals.unshift(newWd);
  db.set('withdrawals', withdrawals);

  io.emit('withdrawal:new', newWd);
  res.json({ success: true, message: `Permintaan penarikan Rp ${numAmount.toLocaleString('id-ID')} berhasil diajukan.`, data: newWd, newBalance: users[uIndex].walletBalance });
});

// Verifikasi wajah harian driver
app.post('/api/driver/face-verify', (req, res) => {
  const { driverId, facePhoto } = req.body;
  if (!driverId) return res.status(400).json({ success: false, message: 'driverId wajib diisi.' });
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === driverId);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });

  let savedFace = null;
  if (facePhoto) {
    savedFace = saveBase64Image(facePhoto, 'face');
  }

  users[uIndex].lastFaceVerify = {
    photo: savedFace,
    verifiedAt: new Date().toISOString(),
    status: 'verified'
  };
  db.set('users', users);

  res.json({ success: true, message: 'Verifikasi wajah berhasil.', data: { driverId, verifiedAt: users[uIndex].lastFaceVerify.verifiedAt } });
});

/* ========================================================
 * CLIENT ENDPOINTS TAMBAHAN
 * ======================================================== */

// Cek saldo klien
app.get('/api/client/balance', (req, res) => {
  const { clientId } = req.query;
  if (!clientId) return res.status(400).json({ success: false, message: 'clientId wajib diisi.' });
  const users = db.get('users') || [];
  const client = users.find(u => u.id === clientId);
  if (!client) return res.status(404).json({ success: false, message: 'Klien tidak ditemukan.' });
  res.json({ success: true, data: { balance: client.walletBalance || 0, clientId, name: client.name } });
});

// Top-up saldo klien
app.post('/api/client/topup', (req, res) => {
  const { clientId, amount, method, provider } = req.body;
  if (!clientId || !amount) return res.status(400).json({ success: false, message: 'clientId dan amount wajib diisi.' });
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 10000) {
    return res.status(400).json({ success: false, message: 'Minimal top-up Rp 10.000.' });
  }
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === clientId);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Klien tidak ditemukan.' });

  users[uIndex].walletBalance = (users[uIndex].walletBalance || 0) + numAmount;
  db.set('users', users);

  const transactions = db.get('transactions') || [];
  const topupRecord = {
    id: `TOP-${Date.now().toString().slice(-4)}`,
    type: 'client_topup',
    amount: numAmount,
    userId: clientId,
    userName: users[uIndex].name,
    method: method || 'ewallet',
    provider: provider || 'DANA',
    status: 'success',
    timestamp: new Date().toISOString()
  };
  transactions.unshift(topupRecord);
  db.set('transactions', transactions);

  io.emit('user:balance_update', { userId: clientId, newBalance: users[uIndex].walletBalance });
  res.json({ success: true, message: `Top-up Rp ${numAmount.toLocaleString('id-ID')} berhasil.`, newBalance: users[uIndex].walletBalance, data: topupRecord });
});

// Tarik saldo klien
app.post('/api/client/withdraw', (req, res) => {
  const { clientId, amount, bankName, accountNumber, accountHolder } = req.body;
  if (!clientId || !amount) return res.status(400).json({ success: false, message: 'clientId dan amount wajib diisi.' });
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 20000) {
    return res.status(400).json({ success: false, message: 'Minimal penarikan Rp 20.000.' });
  }
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === clientId);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Klien tidak ditemukan.' });
  if ((users[uIndex].walletBalance || 0) < numAmount) {
    return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi.' });
  }

  users[uIndex].walletBalance -= numAmount;
  db.set('users', users);

  const withdrawals = db.get('withdrawals') || [];
  const newWd = {
    id: `WD-${Date.now().toString().slice(-4)}`,
    mitraId: clientId,
    mitraName: users[uIndex].name,
    amount: numAmount,
    channelType: bankName || 'DANA',
    destination: accountNumber || users[uIndex].phone,
    accountHolder: accountHolder || users[uIndex].name,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    processedAt: null
  };
  withdrawals.unshift(newWd);
  db.set('withdrawals', withdrawals);

  io.emit('withdrawal:new', newWd);
  res.json({ success: true, message: `Permintaan penarikan Rp ${numAmount.toLocaleString('id-ID')} berhasil diajukan.`, data: newWd, newBalance: users[uIndex].walletBalance });
});

// Driver terima order
app.post('/api/orders/:id/accept', (req, res) => {
  const { driverId } = req.body;
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
  if (orders[oIndex].status !== 'open' && orders[oIndex].status !== 'bidding') {
    return res.status(400).json({ success: false, message: 'Order sudah diambil atau tidak tersedia.' });
  }
  const users = db.get('users') || [];
  const uIndex = users.findIndex(u => u.id === driverId);
  if (uIndex === -1) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });

  const now = new Date().toISOString();
  orders[oIndex].assignedMitraId = driverId;
  orders[oIndex].assignedMitraName = users[uIndex].name;
  orders[oIndex].assignedMitraPhone = users[uIndex].phone;
  orders[oIndex].status = 'working';
  orders[oIndex].step = 'on_the_way';
  orders[oIndex].assignedAt = now;
  users[uIndex].status = 'working';
  users[uIndex].activeOrderId = req.params.id;
  db.set('orders', orders);
  db.set('users', users);

  io.emit('order:assigned', { order: orders[oIndex], mitra: users[uIndex] });
  io.emit('driver:status_change', { driverId, status: 'working', name: users[uIndex].name });
  res.json({ success: true, message: 'Order berhasil diterima!', data: orders[oIndex] });
});

// Driver tolak order
app.post('/api/orders/:id/reject', (req, res) => {
  const { driverId, reason } = req.body;
  const orders = db.get('orders') || [];
  const oIndex = orders.findIndex(o => o.id === req.params.id);
  if (oIndex === -1) return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });

  if (!orders[oIndex].rejectedBy) orders[oIndex].rejectedBy = [];
  orders[oIndex].rejectedBy.push({ driverId, reason: reason || 'Ditolak oleh driver', rejectedAt: new Date().toISOString() });
  db.set('orders', orders);
  io.emit('order:rejected', { orderId: req.params.id, driverId });
  res.json({ success: true, message: 'Order ditolak.', data: orders[oIndex] });
});

/* ========================================================
 * CMS/CONFIG ENDPOINTS TAMBAHAN
 * ======================================================== */

// Upload ikon app driver/client
app.post('/api/admin/config/icon', requireAdminAuth, upload.single('file'), (req, res) => {
  const { target } = req.body; // 'driver' | 'client'
  let iconUrl = '';

  if (req.file) {
    iconUrl = `/uploads/${req.file.filename}`;
    // Salin ke nama file tetap
    const targetFilename = target === 'driver' ? 'logo_icon_driver.svg' : 'logo_icon_client.svg';
    try {
      fs.copyFileSync(path.join(UPLOADS_DIR, req.file.filename), path.join(UPLOADS_DIR, targetFilename));
      iconUrl = `/uploads/${targetFilename}`;
    } catch (e) {
      console.warn('Gagal menyalin file ikon:', e.message);
    }
  } else if (req.body.iconBase64) {
    iconUrl = saveBase64Image(req.body.iconBase64, target === 'driver' ? 'logo_icon_driver' : 'logo_icon_client');
  }

  if (!iconUrl) {
    return res.status(400).json({ success: false, message: 'File ikon tidak ditemukan.' });
  }

  const configKey = target === 'driver' ? 'driverIconUrl' : 'clientIconUrl';
  const updated = db.updateConfig({ [configKey]: iconUrl });

  const eventData = { target, iconUrl, updatedAt: new Date().toISOString() };
  io.emit('config:icon_updated', eventData);
  io.emit('config:update', updated);

  res.json({ success: true, message: `Ikon app ${target} berhasil diperbarui dan disiarkan!`, iconUrl, data: updated });
});

// Simpan zona geofencing
app.post('/api/admin/geofencing', requireAdminAuth, (req, res) => {
  const { zones } = req.body;
  if (!zones || !Array.isArray(zones)) {
    return res.status(400).json({ success: false, message: 'Data zones wajib berupa array.' });
  }
  const geofencingZones = zones.map((z, i) => ({
    id: z.id || `zone-${Date.now()}-${i}`,
    name: z.name || `Zona ${i + 1}`,
    coordinates: z.coordinates || [],
    color: z.color || '#3b82f6',
    createdAt: z.createdAt || new Date().toISOString()
  }));
  db.set('geofencingZones', geofencingZones);
  io.emit('geofencing:updated', geofencingZones);
  res.json({ success: true, message: 'Zona geofencing berhasil disimpan.', data: geofencingZones });
});

// Ambil semua zona geofencing
app.get('/api/admin/geofencing', (req, res) => {
  const zones = db.get('geofencingZones') || [];
  res.json({ success: true, data: zones });
});

// Daftar semua driver dengan lokasi terkini
app.get('/api/admin/drivers/live', requireAdminAuth, (req, res) => {
  const users = db.get('users') || [];
  const drivers = users
    .filter(u => u.role === 'mitra')
    .map(u => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      status: u.status || 'offline',
      lat: u.lat,
      lng: u.lng,
      lastActive: u.lastActive,
      rating: u.rating,
      activeOrderId: u.activeOrderId || null,
      kycStatus: u.kycStatus,
      avatar: u.avatar
    }));
  res.json({ success: true, data: drivers });
});

// Socket.io Connection & Real-Time Event Handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // In-App Audio Voice Calling Signaling
  socket.on('call:initiate', (data) => {
    socket.broadcast.emit('call:incoming', data);
  });

  socket.on('call:answer', (data) => {
    socket.broadcast.emit('call:connected', data);
  });

  socket.on('call:end', (data) => {
    socket.broadcast.emit('call:ended', data);
  });

  socket.on('call:mute', (data) => {
    socket.broadcast.emit('call:mute_status', data);
  });

  // Driver location real-time update via socket
  socket.on('driver:location', (data) => {
    // Simpan ke database jika ada driverId
    if (data && data.driverId) {
      const users = db.get('users') || [];
      const uIndex = users.findIndex(u => u.id === data.driverId);
      if (uIndex !== -1) {
        users[uIndex].lat = data.lat;
        users[uIndex].lng = data.lng;
        users[uIndex].lastActive = new Date().toISOString();
        db.set('users', users);
      }
    }
    // Broadcast ke admin dan semua klien
    socket.broadcast.emit('driver:location_update', data);
    socket.broadcast.emit('mitra:location_update', { mitraId: data.driverId, ...data });
  });

  // Driver status update via socket
  socket.on('driver:status', (data) => {
    if (data && data.driverId) {
      const users = db.get('users') || [];
      const uIndex = users.findIndex(u => u.id === data.driverId);
      if (uIndex !== -1) {
        users[uIndex].status = data.status || 'ready';
        users[uIndex].lastActive = new Date().toISOString();
        db.set('users', users);
      }
    }
    socket.broadcast.emit('driver:status_change', data);
    socket.broadcast.emit('mitra:status_change', { mitraId: data.driverId, ...data });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});


// ── Catch-All SPA Fallback ────────────────────────────────────────────────────
// Semua GET request yang tidak cocok dengan API/static diarahkan sesuai subdomain host
// Express 5: gunakan /{*path} bukan /* untuk wildcard
app.get('/{*path}', (req, res, next) => {
  // Jangan intercept API routes atau file static yang jelas tidak ada
  if (req.path.startsWith('/api/') ||
      req.path.startsWith('/socket.io/') ||
      req.path.startsWith('/uploads/') ||
      req.path.startsWith('/download') ||
      req.path.startsWith('/portal') ||
      req.path.startsWith('/hub') ||
      req.path.startsWith('/admin') ||
      req.path.startsWith('/driver') ||
      req.path.startsWith('/mitra') ||
      req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webmanifest|json|apk|mp3|wav)$/i)) {
    return next();
  }

  const sub = getHostSubdomain(req);
  if (sub === 'driver') {
    const driverIndex = path.join(__dirname, '../driver-app/index.html');
    if (fs.existsSync(driverIndex)) return res.sendFile(driverIndex);
  } else if (sub === 'admin') {
    const adminIndex = path.join(__dirname, '../admin-dashboard/index.html');
    if (fs.existsSync(adminIndex)) return res.sendFile(adminIndex);
  }

  // Default: render client app (app.sobatserabut.id atau sobatserabut.id)
  const clientIndex = path.join(__dirname, '../client-app/index.html');
  if (fs.existsSync(clientIndex)) {
    return res.sendFile(clientIndex);
  }
  next();
});

// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 SOBATSERABUT MARKETPLACE BACKEND & WEBSOCKET`);
  console.log(`📡 Server running on http://0.0.0.0:${PORT}`);
  console.log(`====================================================`);
});
