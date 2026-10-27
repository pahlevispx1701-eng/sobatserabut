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

// 3. Serve Admin Dashboard secara terpusat hanya di /admin dan /admin-pusat
app.use('/admin', express.static(path.join(__dirname, '../admin-dashboard')));
app.use('/admin-pusat', express.static(path.join(__dirname, '../admin-dashboard')));

// 4. Serve Aplikasi Penyedia Jasa: Driver SobatSerabut
app.use('/driver', express.static(path.join(__dirname, '../driver-app')));
app.use('/mitra', express.static(path.join(__dirname, '../driver-app')));

// 5. Serve Aplikasi Pemohon Jasa: SobatSerabut (Klien)
app.use('/client', express.static(path.join(__dirname, '../client-app')));
app.use('/klien', express.static(path.join(__dirname, '../client-app')));
app.use('/app', express.static(path.join(__dirname, '../client-app')));
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

  const newUser = {
    id: newUserId,
    name: assignedName,
    phone: phone.trim(),
    email: email || `${cleanPhone}@sobatserabut.id`,
    password: password.trim(),
    role: assignedRole, // 'klien' atau 'mitra'
    avatar: userAvatar,
    address: address || 'Indonesia',
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
  const { phoneOrEmail, password } = req.body;
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
    return (phoneMatch || nameMatch || nikMatch || emailMatch) && u.password === password;
  });
  
  if (!user) {
    return res.status(401).json({ success: false, message: 'Nama akun, nomor HP, atau kata sandi tidak cocok. Silakan periksa kembali.' });
  }

  if (user.role === 'mitra') {
    // Mitra otomatis aktif (ready) saat masuk akun (login)
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
    return userClean === cleanPhone ||
           (userClean.length >= 9 && cleanPhone.endsWith(userClean.slice(-9))) ||
           (cleanPhone.length >= 9 && userClean.endsWith(cleanPhone.slice(-9)));
  });

  if (user) {
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

  const { name, address, avatarPhoto, bankName, bankAccount, bankHolder } = req.body;
  if (name && name.trim()) users[idx].name = name.trim();
  if (address && address.trim()) users[idx].address = address.trim();
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
  res.json({ success: true, message: 'Profil akun berhasil diperbarui!', data: users[idx] });
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
  res.json({ success: true, message: 'Kategori berhasil diperbarui', data: categories[idx] });
});

app.delete('/api/categories/:id', requireAdminAuth, (req, res) => {
  let categories = db.get('categories') || [];
  categories = categories.filter(c => c.id !== req.params.id);
  db.set('categories', categories);
  io.emit('categories:update', categories);
  res.json({ success: true, message: 'Kategori berhasil dihapus' });
});

/* ========================================================
 * 4. MITRA PEKERJA API (Tracking, Status, GPS)
 * ======================================================== */
app.get('/api/mitra', (req, res) => {
  res.json({ success: true, data: db.get('mitra') });
});

app.get('/api/mitra/:id', (req, res) => {
  const mitra = (db.get('mitra') || []).find(m => m.id === req.params.id);
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
  const mitra = (db.get('mitra') || []).find(m => m.id === req.params.id);
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

  const mitra = (db.get('mitra') || []).find(m => m.id === req.params.id);
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

  // Temukan kategori jasa untuk penentuan harga otomatis standar
  const categoryName = req.body.category || 'Runner / Belanja Kilat';
  const categoryObj = categories.find(c => c.name === categoryName || c.id === req.body.categoryId);
  const baseFare = categoryObj ? categoryObj.baseFare : (config.baseFare || 25000);

  // Biaya tambahan jika ada spesifikasi kebutuhan khusus
  const extraRequirementCost = Number(req.body.extraRequirementCost) || 0;
  const serviceFare = baseFare + extraRequirementCost; // Biaya jasa murni otomatis
  const totalPayment = serviceFare + platformFee; // Total pembayaran pemohon
  const commission = Math.round(serviceFare * (serviceFeePercent / 100));
  const mitraNetEarnings = serviceFare - commission;

  // Akun Finansial Pemohon (E-Wallet / Rekening Bank / QRIS terhubung nyata)
  const clientPayment = {
    method: req.body.clientPaymentMethod || 'ewallet', // 'ewallet', 'bank_transfer', 'qris'
    provider: req.body.clientPaymentProvider || 'DANA', // 'DANA', 'GoPay', 'OVO', 'ShopeePay', 'BCA', 'Mandiri'
    accountNumber: req.body.clientAccountNumber || req.body.clientPhone || '081234567890',
    accountName: req.body.clientAccountName || req.body.clientName || 'Pemohon Jasa'
  };

  // Struktur Alamat Akurat (No. Rumah, RT/RW, Kelurahan, Kecamatan, Kota, Patokan)
  const houseNumber = (req.body.houseNumber || '').trim();
  const street = (req.body.street || '').trim();
  const rt = (req.body.rt || '').trim();
  const rw = (req.body.rw || '').trim();
  const kelurahan = (req.body.kelurahan || '').trim();
  const kecamatan = (req.body.kecamatan || '').trim();
  const city = (req.body.city || '').trim();
  const benchmark = (req.body.benchmark || '').trim();
  const accuracyMeters = Number(req.body.accuracyMeters) || null;

  let resolvedAddress = (req.body.address || '').trim();
  if (!resolvedAddress || (street && (houseNumber || rt || rw || kelurahan || kecamatan))) {
    const parts = [];
    if (street) parts.push(street);
    if (houseNumber) parts.push(`No. ${houseNumber}`);
    if (rt || rw) parts.push(`RT ${rt || '-'}/RW ${rw || '-'}`);
    if (kelurahan) parts.push(`Kel. ${kelurahan}`);
    if (kecamatan) parts.push(`Kec. ${kecamatan}`);
    if (city) parts.push(city);
    resolvedAddress = parts.join(', ');
  }
  if (!resolvedAddress) resolvedAddress = 'Indonesia';

  const structuredAddress = {
    street,
    houseNumber,
    rt,
    rw,
    kelurahan,
    kecamatan,
    city,
    benchmark,
    accuracyMeters,
    fullAddress: resolvedAddress
  };

  const orders = db.get('orders') || [];
  const now = new Date().toISOString();
  const newOrder = {
    id: `ORD-${Date.now().toString().slice(-4)}`,
    title: req.body.title || (categoryObj ? `Layanan ${categoryObj.name}` : 'Bantuan Pekerjaan Serabutan'),
    category: categoryName,
    description: req.body.description || 'Pekerjaan serabutan sesuai kebutuhan.',
    clientId: req.body.clientId || 'KLN-001',
    clientName: req.body.clientName || 'Pemohon Jasa',
    clientPhone: req.body.clientPhone || '08123456789',
    clientAvatar: req.body.clientAvatar || '/uploads/avatar_klien.svg',
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
    accuracyMeters,
    structuredAddress,
    lat: Number(req.body.lat) || -6.1754,
    lng: Number(req.body.lng) || 106.8272,
    // Penetapan Biaya Otomatis Transparan
    budget: serviceFare,
    platformFee: platformFee,
    totalPayment: totalPayment,
    platformCommission: commission,
    mitraNetEarnings: mitraNetEarnings,
    escrowStatus: 'paid', // Terbayar & diamankan ke Rekber SobatSerabut
    status: 'open',
    step: 'waiting_mitra',
    // Audit Durasi Pengerjaan Tugas
    createdAt: now,
    assignedAt: null,
    onTheWayAt: null,
    arrivedAt: null,
    workingAt: null,
    completedAt: null,
    durationAudit: null,
    taskPhoto: req.body.taskPhoto ? saveBase64Image(req.body.taskPhoto, 'task') : null,
    proofPhoto: null,
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
    type: 'order_escrow',
    amount: totalPayment,
    orderId: newOrder.id,
    description: `Setoran Rekber untuk ${newOrder.title} via ${clientPayment.provider} (${clientPayment.accountNumber})`,
    timestamp: now
  });
  db.set('transactions', transactions);

  // Broadcast ke radar mitra
  io.emit('order:new', newOrder);
  res.json({
    success: true,
    message: 'Tugas berhasil diposting dan dipancarkan ke radar mitra terdekat!',
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
  res.json({ success: true, data: db.get('kycRequests') || [] });
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

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});


// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 SOBATSERABUT MARKETPLACE BACKEND & WEBSOCKET`);
  console.log(`📡 Server running on http://0.0.0.0:${PORT}`);
  console.log(`====================================================`);
});
