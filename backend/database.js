const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'sobatserabut_db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Initial Default State
const defaultState = {
  config: {
    appName: "SobatSerabut",
    appTagline: "Solusi Cepat Serabutan & Jasa Harian",
    logoUrl: "/uploads/logo_sobatserabut.svg",
    appIconUrl: "/uploads/logo_icon.svg",
    logoPreset: "shield",
    primaryColor: "#2563EB",
    secondaryColor: "#F59E0B",
    maintenanceMode: false,
    maintenanceMessage: "Aplikasi SobatSerabut sedang menjalani pemeliharaan berkala untuk peningkatan server. Kami akan segera kembali!",
    maxRadiusKm: 10,
    baseFare: 25000,
    farePerKm: 3500,
    platformFee: 3000,
    serviceFeePercentage: 10, // 10% komisi platform
    premiumSubscriptionPrice: 50000,
    escrowAccountInfo: "SeaBank: 901771223812 | GoPay: 087735170386 | QRIS SobatSerabut (a/n SobatSerabut Admin)",
    adminSeaBank: {
      bankName: "SeaBank",
      accountNumber: "901771223812",
      accountHolder: "SobatSerabut Admin"
    },
    adminGopay: {
      provider: "GoPay",
      accountNumber: "087735170386",
      accountHolder: "SobatSerabut Admin"
    },
    adminQris: {
      title: "QRIS SobatSerabut Resmi",
      url: "/uploads/qris_sobatserabut.svg",
      accountHolder: "SobatSerabut Admin"
    },
    otpSenderNumber: "087791201091",
    fonnteToken: "G7pBKmdnGMyfnLoEkv7g",
    otpMessageFormat: "🤖 [BOT RESMI SOBATSERABUT - 087791201091]\nKODE VERIFIKASI OTP ANDA: *{otpCode}*\n\n⚠️ PERINGATAN RESMI:\n\"jangan berikan kode otp ini kepada siapapun\"\n\nKode rahasia ini bersifat pribadi untuk keamanan akun Anda dan berlaku selama 5 menit.",
    announcement: "Selamat datang di SobatSerabut! Layanan serabutan & pekerjaan harian terpercaya siap membantu Anda kapan saja.",
    contactPhone: "087791201091",
    googleMapsApiKey: "",
    mapProvider: "google_roadmap", // "google_roadmap", "google_hybrid", "google_terrain", "osm"
    updatedAt: new Date().toISOString()
  },
  categories: [
    { id: "cat-1", name: "Servis AC", icon: "snowflake", image: "/uploads/service_ac.png", baseFare: 75000, description: "Cuci, tambah freon, dan perbaikan AC", active: true },
    { id: "cat-2", name: "Pembersih Rumah", icon: "sparkles", image: "/uploads/service_clean.png", baseFare: 50000, description: "Bersih-bersih kamar, toilet, dan dapur", active: true },
    { id: "cat-3", name: "Angkat Barang & Pindahan", icon: "truck", image: "/uploads/service_lifting.png", baseFare: 80000, description: "Bantuan angkut mebel, kardus, dan pindahan", active: true },
    { id: "cat-4", name: "Tukang Ledeng & Pipa", icon: "wrench", image: "/uploads/service_plumber.png", baseFare: 60000, description: "Perbaikan pipa bocor, wastafel, dan pompa air", active: true },
    { id: "cat-5", name: "Kelistrikan & Instalasi", icon: "zap", image: "/uploads/service_electric.png", baseFare: 65000, description: "Perbaikan korsleting, pasang lampu & saklar", active: true },
    { id: "cat-6", name: "Runner / Belanja Kilat", icon: "shopping-bag", image: "/uploads/service_runner.png", baseFare: 25000, description: "Beli gas, galon, belanja pasar & titipan kilat", active: true },
    { id: "cat-7", name: "Pertukangan Kayu & Cat", icon: "hammer", image: "/uploads/service_carpentry.png", baseFare: 90000, description: "Cat dinding, perbaikan kusen, dan furnitur", active: true },
    { id: "cat-8", name: "Tambal Ban & Darurat", icon: "tool", image: "/uploads/service_tire.png", baseFare: 30000, description: "Tambal ban tubeless, jumper aki di tempat", active: true },
    { id: "cat-9", name: "Servis Mesin Cuci", icon: "gear", image: "/uploads/service_washing.png", baseFare: 60000, description: "Perbaikan & perawatan langsung di rumah", active: true }
  ],
  users: [],
  mitra: [], // synced automatically from users with role == 'mitra'
  orders: [],
  kycRequests: [],
  withdrawals: [],
  routeHistory: {},
  transactions: []
};

// Database class
class Database {
  constructor() {
    this.data = null;
    this.load();
  }

  load() {
    this.otpStore = {};
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
        if (!this.data.users) {
          this.data.users = JSON.parse(JSON.stringify(defaultState.users));
        }
        // Hapus permanen semua data akun demo / palsu
        const demoUserIds = ['MTR-001', 'MTR-002', 'KLN-001', 'KLN-002', 'KLN-0171', 'MTR-2777'];
        const demoNames = ['budi santoso', 'agus hermanto', 'rina melati', 'dimas pratama', 'ahmad driver', 'sobat 4567'];
        
        this.data.users = this.data.users.filter(u => {
          if (demoUserIds.includes(u.id)) return false;
          if (u.name && demoNames.some(d => u.name.toLowerCase().includes(d))) return false;
          return true;
        });

        // Bersihkan foto profil palsu dan reset saldo demo ke 0
        this.data.users.forEach(u => {
          if (u.avatar && (u.avatar.includes('unsplash.com') || u.avatar.includes('photo-'))) {
            u.avatar = null; // Foto hanya akan muncul jika pengguna mengunggah foto asli
          }
          if (u.walletBalance === 250000 || typeof u.walletBalance !== 'number') {
            u.walletBalance = 0; // Dompet default 0
          }
        });

        // Hapus tugas demo
        const demoOrderIds = ['ORD-1001', 'ORD-1002', 'ORD-1003', 'ORD-0815'];
        if (this.data.orders) {
          this.data.orders = this.data.orders.filter(o => !demoOrderIds.includes(o.id));
        }

        // Hapus transaksi demo
        const demoTrxIds = ['TRX-1001', 'TRX-1002', 'TRX-0815'];
        if (this.data.transactions) {
          this.data.transactions = this.data.transactions.filter(t => !demoTrxIds.includes(t.id));
        }

        if (this.data.config) {
          this.data.config = { ...defaultState.config, ...this.data.config };
          this.data.config.escrowAccountInfo = defaultState.config.escrowAccountInfo;
          this.data.config.adminSeaBank = defaultState.config.adminSeaBank;
          this.data.config.adminGopay = defaultState.config.adminGopay;
          this.data.config.adminQris = defaultState.config.adminQris;
        } else {
          this.data.config = JSON.parse(JSON.stringify(defaultState.config));
        }
      } else {
        this.data = JSON.parse(JSON.stringify(defaultState));
        this.syncMitraArray();
        this.save();
      }
    } catch (e) {
      console.error('Error loading db, resetting to default:', e);
      this.data = JSON.parse(JSON.stringify(defaultState));
      this.syncMitraArray();
      this.save();
    }
    this.syncMitraArray();
  }

  syncMitraArray() {
    if (!this.data) return;
    if (!this.data.users) this.data.users = [];
    this.data.mitra = this.data.users.filter(u => u.role === 'mitra');
  }

  save() {
    try {
      this.syncMitraArray();
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving db:', e);
    }
  }

  get(key) {
    if (key === 'mitra') {
      this.syncMitraArray();
      return this.data.mitra;
    }
    return this.data[key];
  }

  set(key, val) {
    this.data[key] = val;
    if (key === 'users') this.syncMitraArray();
    this.save();
  }

  updateConfig(newConfig) {
    this.data.config = { ...this.data.config, ...newConfig, updatedAt: new Date().toISOString() };
    this.save();
    return this.data.config;
  }

  normalizePhone(phone) {
    let p = (phone || '').toString().replace(/[^0-9]/g, '');
    if (p.startsWith('62')) p = '0' + p.slice(2);
    else if (p.startsWith('8')) p = '0' + p;
    return p;
  }

  setOtp(phone, otpData) {
    if (!this.otpStore) this.otpStore = {};
    const normalized = this.normalizePhone(phone);
    const raw = phone.toString().replace(/[^0-9]/g, '');
    const entry = {
      ...otpData,
      createdAt: Date.now()
    };
    this.otpStore[normalized] = entry;
    if (raw && raw !== normalized) this.otpStore[raw] = entry;
  }

  getOtp(phone) {
    if (!this.otpStore) this.otpStore = {};
    const normalized = this.normalizePhone(phone);
    const raw = phone.toString().replace(/[^0-9]/g, '');
    const entry = this.otpStore[normalized] || this.otpStore[raw];
    if (!entry) return null;
    // Expire after 5 minutes (300,000 ms)
    if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
      delete this.otpStore[normalized];
      delete this.otpStore[raw];
      return null;
    }
    return entry;
  }

  deleteOtp(phone) {
    if (!this.otpStore) return;
    const normalized = phone.replace(/[^0-9]/g, '');
    delete this.otpStore[normalized];
  }
}

module.exports = new Database();
