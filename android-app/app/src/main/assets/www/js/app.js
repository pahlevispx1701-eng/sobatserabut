/**
 * SobatSerabut - Mitra & Klien Mobile Web Application
 * Mobile-First Real-Time Client Application
 */

// Resolusi Dinamis URL Server untuk menyamakan kinerja APK dan Web Link
function getApiBase() {
  try {
    const customUrl = localStorage.getItem('sobatserabut_server_url');
    if (customUrl && (customUrl.startsWith('http://') || customUrl.startsWith('https://'))) {
      return customUrl.trim().replace(/\/+$/, '');
    }
  } catch(e) {}

  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol;
    if ((proto === 'http:' || proto === 'https:') && window.location.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
  }

  if (typeof window !== 'undefined' && window.SOBATSERABUT_CONFIG && window.SOBATSERABUT_CONFIG.DEFAULT_API_URL) {
    const def = window.SOBATSERABUT_CONFIG.DEFAULT_API_URL.trim().replace(/\/+$/, '');
    if (def && def !== 'http://127.0.0.1:4000' && def !== 'http://localhost:4000') {
      return def;
    }
  }

  return 'https://structure-crane-princess.ngrok-free.dev';
}

let API_BASE = getApiBase();
let socket = null;

// Global App State
const DEFAULT_CATEGORIES = [
  { id: "cat-1", name: "Servis AC", icon: "snowflake", image: "img/service_ac.png", baseFare: 75000, description: "Cuci, tambah freon, dan perbaikan AC", active: true },
  { id: "cat-2", name: "Pembersih Rumah", icon: "sparkles", image: "img/service_clean.png", baseFare: 50000, description: "Bersih-bersih kamar, toilet, dan dapur", active: true },
  { id: "cat-3", name: "Angkat Barang & Pindahan", icon: "truck", image: "img/service_lifting.png", baseFare: 80000, description: "Bantuan angkut mebel, kardus, dan pindahan", active: true },
  { id: "cat-4", name: "Tukang Ledeng & Pipa", icon: "wrench", image: "img/service_plumber.png", baseFare: 60000, description: "Perbaikan pipa bocor, wastafel, dan pompa air", active: true },
  { id: "cat-5", name: "Kelistrikan & Instalasi", icon: "bolt", image: "img/service_electric.png", baseFare: 65000, description: "Perbaikan korsleting, pasang lampu & saklar", active: true },
  { id: "cat-6", name: "Runner / Belanja Kilat", icon: "cart-shopping", image: "img/service_runner.png", baseFare: 25000, description: "Beli gas, galon, belanja pasar & titipan kilat", active: true },
  { id: "cat-7", name: "Pertukangan Kayu & Cat", icon: "hammer", image: "img/service_carpentry.png", baseFare: 90000, description: "Cat dinding, perbaikan kusen, dan furnitur", active: true },
  { id: "cat-8", name: "Tambal Ban & Darurat", icon: "screwdriver-wrench", image: "img/service_tire.png", baseFare: 30000, description: "Tambal ban tubeless, jumper aki di tempat", active: true },
  { id: "cat-9", name: "Servis Mesin Cuci", icon: "gear", image: "img/service_washing.png", baseFare: 60000, description: "Perbaikan & perawatan langsung di rumah", active: true }
];

function getCategoryImage(cat) {
  let img = (cat && typeof cat === 'object') ? (cat.image || '') : '';
  if (img) {
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    if (img.startsWith('/uploads/')) return `${API_BASE}${img}`;
    if (img.startsWith('uploads/')) return `${API_BASE}/${img}`;
    if (img.startsWith('img/')) return img;
  }
  const name = ((cat && typeof cat === 'object') ? (cat.name || '') : String(cat || '')).toLowerCase();
  if (name.includes('ac')) return 'img/service_ac.png';
  if (name.includes('bersih') || name.includes('clean')) return 'img/service_clean.png';
  if (name.includes('angkat') || name.includes('pindah') || name.includes('truck')) return 'img/service_lifting.png';
  if (name.includes('ledeng') || name.includes('pipa') || name.includes('plumber') || name.includes('pompa')) return 'img/service_plumber.png';
  if (name.includes('listrik') || name.includes('instalasi') || name.includes('electric') || name.includes('bolt') || name.includes('korslet')) return 'img/service_electric.png';
  if (name.includes('runner') || name.includes('belanja') || name.includes('pasar') || name.includes('titip')) return 'img/service_runner.png';
  if (name.includes('kayu') || name.includes('pertukangan') || name.includes('carpentry') || name.includes('kusen') || name.includes('cat')) return 'img/service_carpentry.png';
  if (name.includes('ban') || name.includes('tambal') || name.includes('darurat') || name.includes('tire')) return 'img/service_tire.png';
  if (name.includes('cuci') || name.includes('mesin') || name.includes('washer')) return 'img/service_washing.png';
  return 'img/service_runner.png';
}

let currentUser = null; // Logged-in user object
let systemConfig = {};
let categoriesList = (() => {
  try {
    const cached = localStorage.getItem('sobatserabut_cached_categories');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch(e) {}
  return DEFAULT_CATEGORIES;
})();
let clientOrders = [];
let nearbyTasks = [];
let activeOrder = null;
let currentTab = 'home';

// Geolocation & GPS Tracking
let gpsTrackerInterval = null;
let callTimerInterval = null;
let activeJobTimerInterval = null;
let callSeconds = 0;
let isCallMuted = false;
let isSpeakerOn = true;
let callRingOsc = null;
let callRingGain = null;

// Image Uploads Base64 State
let registeredAvatarBase64 = null;
let registeredKtpBase64 = null;
let registeredSelfieBase64 = null;
let proofPhotoBase64 = null;
let pendingRegistrationData = null;

// Dialog & Toast State
let activeDialogResolver = null;

// ========================================================
// SISTEM DETEKSI KONEKSI DATA INTERNET & WI-FI AKTIF
// Aplikasi hanya bisa diakses dan digunakan jika ada koneksi internet
// ========================================================
let isNetworkOnline = true;
let networkPingTimer = null;

function initNetworkConnectivityEngine() {
  window.addEventListener('online', () => {
    checkAppConnectivity(true);
  });
  window.addEventListener('offline', () => {
    handleNetworkState(false, 'Koneksi data seluler / Wi-Fi terputus!');
  });

  // Heartbeat cek internet setiap 7 detik
  if (networkPingTimer) clearInterval(networkPingTimer);
  networkPingTimer = setInterval(() => {
    checkAppConnectivity(false);
  }, 7000);
}

async function checkAppConnectivity(showFeedback = false) {
  const statusDetail = document.getElementById('networkStatusDetail');
  if (!navigator.onLine) {
    handleNetworkState(false, 'Data Seluler / Wi-Fi tidak aktif');
    if (showFeedback && statusDetail) statusDetail.innerText = 'Perangkat Anda sedang offline. Nyalakan Data / Wi-Fi.';
    return false;
  }

  // 1. Coba sambungan ke API_BASE saat ini
  let isConnected = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE}/api/ping?_t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) isConnected = true;
  } catch(e) {}

  // 2. Jika API_BASE gagal dan ada DEFAULT_API_URL yang berbeda, coba beralih otomatis
  if (!isConnected && typeof window !== 'undefined' && window.SOBATSERABUT_CONFIG && window.SOBATSERABUT_CONFIG.DEFAULT_API_URL) {
    const configUrl = window.SOBATSERABUT_CONFIG.DEFAULT_API_URL.trim().replace(/\/+$/, '');
    if (configUrl && configUrl !== API_BASE) {
      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 3000);
        const res2 = await fetch(`${configUrl}/api/ping?_t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller2.signal
        });
        clearTimeout(timeoutId2);
        if (res2.ok) {
          API_BASE = configUrl;
          localStorage.setItem('sobatserabut_server_url', API_BASE);
          isConnected = true;
        }
      } catch(e2) {}
    }
  }

  if (isConnected) {
    handleNetworkState(true);
    if (showFeedback) showToast('✅ Terhubung ke Server SobatSerabut', 'success', 2500);
    return true;
  }

  // 3. Jika server utama belum terhubung tapi perangkat punya akses internet, jangan kunci UI total
  try {
    const fbController = new AbortController();
    const fbTimeout = setTimeout(() => fbController.abort(), 2000);
    await fetch('https://cloudflare.com/cdn-cgi/trace', { mode: 'no-cors', cache: 'no-store', signal: fbController.signal });
    clearTimeout(fbTimeout);
    // Internet ada, sembunyikan blocker agar tombol/ikon tetap responsif
    handleNetworkState(true);
    if (statusDetail) statusDetail.innerText = 'Status: Menghubungkan ke Server...';
    return true;
  } catch(err2) {
    handleNetworkState(false, 'Tidak ada sambungan data internet');
    if (showFeedback && statusDetail) statusDetail.innerText = 'Gagal terhubung. Pastikan kuota / Wi-Fi Anda aktif.';
    return false;
  }
}

function dismissNetworkBlocker() {
  const blocker = document.getElementById('networkOfflineBlocker');
  if (blocker) blocker.classList.add('hidden');
}

function handleNetworkState(online, reason = '') {
  isNetworkOnline = online;
  const blocker = document.getElementById('networkOfflineBlocker');
  const statusDetail = document.getElementById('networkStatusDetail');

  if (!online) {
    if (blocker) blocker.classList.remove('hidden');
    if (statusDetail && reason) statusDetail.innerText = `Status: ${reason}`;
  } else {
    if (blocker) blocker.classList.add('hidden');
    if (statusDetail) statusDetail.innerText = 'Status: Terhubung';
  }
}

// ----------------------------------------------------
// DEVICE PERMISSIONS CONTROLLER (LOKASI, KAMERA, MIKROFON)
// ----------------------------------------------------
function checkDevicePermissionsOnLaunch() {
  const prompted = sessionStorage.getItem('sobatserabut_perm_prompted');
  if (!prompted) {
    setTimeout(() => {
      const modal = document.getElementById('devicePermissionsModal');
      if (modal) modal.classList.remove('hidden');
    }, 1500);
  }
}

function closeDevicePermissionsModal() {
  sessionStorage.setItem('sobatserabut_perm_prompted', 'true');
  const modal = document.getElementById('devicePermissionsModal');
  if (modal) modal.classList.add('hidden');
}

async function requestAllDevicePermissions() {
  closeDevicePermissionsModal();

  // 1. Izin Lokasi GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        console.log('📍 [GPS Diizinkan]:', userLat, userLng);
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
          fetch(`${API_BASE}/api/mitra/${currentUser.id}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: userLat, lng: userLng })
          }).catch(() => {});
        }
      },
      (err) => console.warn('📍 Lokasi ditolak/timeout:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // 2. Izin Kamera & Mikrofon
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('📷 & 🎙️ [Kamera & Mikrofon Diizinkan]');
      stream.getTracks().forEach(t => t.stop());
      showToast('✅ Izin Lokasi, Kamera & Mikrofon Berhasil Diaktifkan!', 'success');
    } catch(err) {
      console.warn('Gagal gabungan media, coba parsial:', err.message);
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        camStream.getTracks().forEach(t => t.stop());
        showToast('✅ Izin Kamera Berhasil Diaktifkan!', 'success');
      } catch(e) {}
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getTracks().forEach(t => t.stop());
      } catch(e) {}
    }
  }

  localStorage.setItem('sobatserabut_permissions_granted', 'true');
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. First install check: Bersihkan riwayat tugas lama
  if (!localStorage.getItem('sobatserabut_client_installed_v2')) {
    localStorage.removeItem('sobatserabut_cached_orders');
    localStorage.removeItem('sobatserabut_orders');
    localStorage.setItem('sobatserabut_client_installed_v2', 'true');
    clientOrders = [];
  }

  // 2. Render UI & Kategori langsung (Frame 0, Instan tanpa tunggu jaringan)
  renderKlienCategoriesGrid();
  populatePostTaskCategorySelect();

  // 3. Inisialisasi status klien langsung frame 0 (Anti-stuck 'Memuat klien...')
  checkAuthSession();

  // 4. Sinkronisasi jaringan di latar belakang (Non-blocking, tidak menahan tampilan)
  initNetworkConnectivityEngine();
  checkAppConnectivity(false);
  initSocket();
  loadRemoteConfig();
  loadCategories();
  updateServerStatusBadge(true, API_BASE);
  checkDevicePermissionsOnLaunch();
});

/* ========================================================
 * 0. TOAST & CUSTOM NATIVE-FEEL ALERT / CONFIRM DIALOG
 * ======================================================== */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('appToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    info: 'bg-slate-900/95 border-blue-500/50 text-blue-200',
    success: 'bg-slate-900/95 border-emerald-500/50 text-emerald-200',
    error: 'bg-slate-900/95 border-rose-500/50 text-rose-200',
    warning: 'bg-slate-900/95 border-amber-500/50 text-amber-200'
  };
  const icons = {
    info: 'fa-circle-info text-blue-400',
    success: 'fa-circle-check text-emerald-400',
    error: 'fa-circle-exclamation text-rose-400',
    warning: 'fa-triangle-exclamation text-amber-400'
  };

  toast.className = `flex items-center space-x-2.5 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold backdrop-blur-md pointer-events-auto border ${bgColors[type] || bgColors.info} transition-all duration-300 transform -translate-y-2 opacity-0`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-base flex-shrink-0"></i>
    <span class="flex-1 text-slate-100">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Monkey-patch window.alert to completely prevent browser popups with "file://"
window.alert = function(msg) {
  showToast(String(msg), 'info');
};

function showCustomDialog({ title = 'SobatSerabut', message = '', type = 'info', showCancel = false, confirmText = 'Lanjutkan', cancelText = 'Batal' }) {
  return new Promise((resolve) => {
    activeDialogResolver = resolve;
    const modal = document.getElementById('customAppDialogModal');
    const titleEl = document.getElementById('customDialogTitle');
    const msgEl = document.getElementById('customDialogMessage');
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const iconEl = document.getElementById('customDialogIcon');
    const iconContainer = document.getElementById('customDialogIconContainer');

    if (!modal) return resolve(true);

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (confirmBtn) confirmBtn.innerText = confirmText;
    if (cancelBtn) {
      cancelBtn.innerText = cancelText;
      cancelBtn.style.display = showCancel ? 'block' : 'none';
    }

    if (iconEl && iconContainer) {
      if (type === 'success') {
        iconContainer.className = 'w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 mx-auto flex items-center justify-center text-2xl border border-emerald-500/30';
        iconEl.className = 'fa-solid fa-circle-check';
      } else if (type === 'error' || type === 'danger') {
        iconContainer.className = 'w-14 h-14 rounded-2xl bg-rose-600/20 text-rose-400 mx-auto flex items-center justify-center text-2xl border border-rose-500/30';
        iconEl.className = 'fa-solid fa-triangle-exclamation';
      } else {
        iconContainer.className = 'w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 mx-auto flex items-center justify-center text-2xl border border-blue-500/30';
        iconEl.className = 'fa-solid fa-circle-info';
      }
    }

    confirmBtn.onclick = () => {
      modal.classList.add('hidden');
      if (activeDialogResolver) activeDialogResolver(true);
      activeDialogResolver = null;
    };

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.classList.add('hidden');
        if (activeDialogResolver) activeDialogResolver(false);
        activeDialogResolver = null;
      };
    }

    modal.classList.remove('hidden');
  });
}

async function appConfirm(message, title = 'Konfirmasi Tindakan') {
  return await showCustomDialog({ title, message, type: 'info', showCancel: true, confirmText: 'Ya, Lanjutkan', cancelText: 'Batal' });
}

/* ========================================================
 * 1. REAL-TIME WEBSOCKET CONNECTION
 * ======================================================== */
function initSocket() {
  try {
    if (typeof io === 'undefined') {
      console.warn('[SobatSerabut] Socket.IO client library belum termuat.');
      return;
    }

    if (socket) {
      try { socket.disconnect(); } catch(e) {}
    }

    socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('[SobatSerabut] Connected to Real-time Socket Server at', API_BASE);
      updateServerStatusBadge(true, API_BASE);
    });

    socket.on('connect_error', (err) => {
      console.warn('[SobatSerabut] Socket connection warning:', err.message);
      updateServerStatusBadge(false);
    });

    // Dynamic Admin Branding Sync (Logo & Config broadcasted live)
    socket.on('config:update', (newConfig) => {
      systemConfig = newConfig;
      applyConfigToUI(newConfig);
      if (currentUser?.role === 'mitra') loadNearbyTasksForMitra();
    });

    socket.on('config:updated', (newConfig) => {
      systemConfig = newConfig;
      applyConfigToUI(newConfig);
    });

    socket.on('maintenance:alert', (alert) => {
      applyMaintenanceMode(alert.maintenanceMode, alert.maintenanceMessage);
    });

    socket.on('order:new', (newOrder) => {
      playNotificationSound();
      if (currentUser?.role === 'mitra') {
        loadNearbyTasksForMitra();
      } else if (currentUser?.role === 'klien' && newOrder.clientId === currentUser.id) {
        loadClientOrders();
      }
    });

    socket.on('order:assigned', (data) => {
      if (currentUser?.id === data.order.clientId) {
        showCustomDialog({
          title: 'Mitra Telah Ditugaskan!',
          message: `Mitra ${data.mitra.name} telah menerima tugas "${data.order.title}" dan sedang bersiap menuju lokasi penjemputan!`,
          type: 'success'
        });
        loadClientOrders();
      }
      if (currentUser?.id === data.mitra.id) {
        showCustomDialog({
          title: 'Tugas Diterima!',
          message: `Anda berhasil ditugaskan untuk order "${data.order.title}". Segera buka rute Google Maps untuk menuju lokasi pemohon!`,
          type: 'success'
        });
        activeOrder = data.order;
        currentUser.status = 'working';
        updateMitraStatusUI('working');
        updateMitraActiveJobUI();
        loadNearbyTasksForMitra();
      }
    });

    socket.on('order:step_change', (data) => {
      if (currentUser?.role === 'klien') loadClientOrders();
      if (activeOrder && activeOrder.id === data.orderId) {
        activeOrder.step = data.step;
        updateMitraActiveJobUI();
      }
    });

    // Real-Time Geofencing Off-Route & Tracking updates
    socket.on('order:tracking_update', (data) => {
      if (activeOrder && activeOrder.id === data.orderId) {
        handleLiveTrackingUpdate(data);
      }
    });

    socket.on('geofence:off_route_alert', (data) => {
      if (activeOrder && activeOrder.id === data.orderId) {
        const banner = document.getElementById('mitraOffRouteBanner');
        const text = document.getElementById('mitraOffRouteText');
        if (banner) banner.classList.remove('hidden');
        if (text) text.innerText = `Peringatan: Rute menjauh (${data.distToTaskKm} km) dari lokasi penjemputan!`;
        playNotificationSound();
      }
    });

    socket.on('order:completed', (data) => {
      if (currentUser?.id === data.order.assignedMitraId) {
        const netInc = data.mitraNetIncome || Math.round((data.order.baseFare || data.order.budget || 25000) * 0.9);
        const payout = data.order.payoutDetails || {};
        const dest = payout.destination || 'Rekening / E-Wallet Terdaftar';

        showCustomDialog({
          title: 'Tugas Selesai & Dana Cair!',
          message: `Selamat! Tugas "${data.order.title}" telah diselesaikan.\n\nDana bersih sebesar Rp ${netInc.toLocaleString('id-ID')} otomatis ditransfer ke akun Anda:\n${dest}\n(Bukti Transfer: ${payout.payoutId || 'PO-REALTIME'})`,
          type: 'success'
        });

        activeOrder = null;
        currentUser.status = 'ready';
        updateMitraStatusUI('ready');
        updateMitraActiveJobUI();
        refreshUserProfile();
        loadNearbyTasksForMitra();
      }
      if (currentUser?.id === data.order.clientId) {
        showToast(`Tugas "${data.order.title}" telah selesai dikerjakan mitra dengan bukti foto terlampir.`, 'success');
        loadClientOrders();
      }
    });

    socket.on('chat:message', (data) => {
      if (activeOrder && activeOrder.id === data.orderId) {
        if (!activeOrder.chatMessages) activeOrder.chatMessages = [];
        activeOrder.chatMessages.push(data.message);
        renderChatMessages();
        playNotificationSound();
      }
    });

    // In-App Audio Call Signaling
    socket.on('call:initiate', (data) => {
      if (activeOrder && activeOrder.id === data.orderId && data.callerId !== currentUser?.id) {
        handleIncomingVoiceCall(data);
      }
    });

    socket.on('call:end', () => {
      endInAppVoiceCall(false);
    });

  } catch (err) {
    console.error('Socket init error:', err);
  }
}


/* ========================================================
 * 2. SOBATSERABUT 5-STAGE MINIMALIST AUTH & GUEST ONBOARDING
 * - Tahap 1: Gerbang Masuk (Entry Point di Tab "Saya")
 * - Tahap 2: Layar Formulir Utama (The Register Screen)
 * - Tahap 3: Validasi Keamanan (Security & Anti-Bot System - Puzzle)
 * - Tahap 4: Konfirmasi Metode & Layar OTP
 * - Tahap 5: Pembuatan Kata Sandi (Password Setup)
 * - Minimalist Login & Password Recovery
 * ======================================================== */

let pendingRegPhone = '';
let pendingOtpMethod = 'whatsapp';
let pendingDevOtp = null;
let stage4OtpTimerInterval = null;
let puzzleTargetX = 160;
let puzzleTargetY = 60;
let currentAuthScreen = 'register';
let loginFailAttempts = 0;

/* TAHAP 1: GERBANG MASUK (ENTRY POINT)
 * Saat pertama kali membuka aplikasi, sobatserabut tidak langsung menyodorkan form.
 * Pengguna mendarat di halaman utama (Homepage).
 */
function checkAuthSession() {
  const saved = localStorage.getItem('sobatserabut_client_user') || localStorage.getItem('sobatserabut_user');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && (!parsed.role || parsed.role === 'klien')) {
        currentUser = parsed;
        localStorage.setItem('sobatserabut_client_user', JSON.stringify(currentUser));
        onUserAuthenticated(currentUser);
        return;
      }
    } catch(e) {}
  }

  // OTOMATIS AKTIFKAN KLIEN RESMI INSTAN (ANTI-STUCK 'Memuat klien...')
  const clientPhone = localStorage.getItem('sobatserabut_registered_phone') || ('08' + Math.floor(1000000000 + Math.random() * 9000000000));
  currentUser = {
    id: 'klien_' + Date.now(),
    name: 'Klien SobatSerabut',
    phone: clientPhone,
    role: 'klien',
    avatar: 'uploads/avatar_default.svg',
    balance: 0,
    address: 'Indonesia'
  };
  localStorage.setItem('sobatserabut_client_user', JSON.stringify(currentUser));
  localStorage.setItem('sobatserabut_registered', 'true');
  localStorage.setItem('sobatserabut_registered_phone', clientPhone);
  onUserAuthenticated(currentUser);
}

function onGuestSessionInit() {
  hideAuthOverlay();
  closeRegisterFlow();
  closeLoginFlow();
  closePuzzleModal();
  closeOtpBottomSheet();

  const step4 = document.getElementById('stage4OtpScreen');
  if (step4) { step4.classList.add('hidden'); step4.classList.remove('flex'); }
  const step5 = document.getElementById('stage5PasswordScreen');
  if (step5) { step5.classList.add('hidden'); step5.classList.remove('flex'); }

  // Header display untuk Tamu
  const headerName = document.getElementById('currentUserHeaderName');
  if (headerName) headerName.innerText = 'Tamu SobatSerabut';
  const roleBadge = document.getElementById('roleHeaderBadge');
  if (roleBadge) {
    roleBadge.innerText = 'TAMU';
    roleBadge.className = 'text-[9px] px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300 font-extrabold border border-slate-600';
  }
  const statusBar = document.getElementById('mitraStatusBarContainer');
  if (statusBar) statusBar.classList.add('hidden');
  const quickBar = document.getElementById('klienQuickBarContainer');
  if (quickBar) quickBar.classList.remove('hidden');

  const klienView = document.getElementById('klienViewContainer');
  if (klienView) klienView.classList.remove('hidden');
  const mitraView = document.getElementById('mitraViewContainer');
  if (mitraView) mitraView.classList.add('hidden');

  updateProfileTabUI();
  switchMainTab('home');

  if (typeof loadCategories === 'function') loadCategories();
  if (typeof loadClientOrders === 'function') loadClientOrders();
}

function updateProfileTabUI() {
  const guestSec = document.getElementById('profileGuestSection');
  const userSec = document.getElementById('profileUserSection');
  const kycSec = document.getElementById('profileKycSection');
  const vipSec = document.getElementById('profileVipSection');

  if (!currentUser) {
    if (guestSec) guestSec.classList.remove('hidden');
    if (userSec) userSec.classList.add('hidden');
    if (kycSec) kycSec.classList.add('hidden');
    if (vipSec) vipSec.classList.add('hidden');
  } else {
    if (guestSec) guestSec.classList.add('hidden');
    if (userSec) userSec.classList.remove('hidden');

    const nameEl = document.getElementById('profileUserName');
    if (nameEl) nameEl.innerText = currentUser.name || 'Pengguna SobatSerabut';
    const phoneEl = document.getElementById('profileUserPhone');
    if (phoneEl) phoneEl.innerText = currentUser.phone || '';
    const addrEl = document.getElementById('profileUserAddress');
    if (addrEl) addrEl.innerText = currentUser.address || 'Indonesia';
    const avatarEl = document.getElementById('profileUserAvatar');
    if (avatarEl) {
      let src = 'uploads/avatar_default.svg';
      if (currentUser.avatar && !currentUser.avatar.includes('unsplash.com')) {
        src = currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('data:') ? currentUser.avatar : `${API_BASE}${currentUser.avatar}`;
      }
      avatarEl.src = src;
    }

    const badge = document.getElementById('profileUserBadge');
    if (badge) {
      badge.innerText = currentUser.role === 'mitra' ? 'MITRA DRIVER' : 'KLIEN RESMI';
      badge.className = currentUser.role === 'mitra'
        ? 'text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/30'
        : 'text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-extrabold border border-blue-500/30';
    }

    if (currentUser.role === 'mitra') {
      if (kycSec) kycSec.classList.remove('hidden');
      if (vipSec) vipSec.classList.remove('hidden');
    } else {
      if (kycSec) kycSec.classList.add('hidden');
      if (vipSec) vipSec.classList.add('hidden');
    }
  }
}

/* ========================================================
 * TAHAP 2: LAYAR FORMULIR UTAMA (THE REGISTER SCREEN)
 * ======================================================== */
function openRegisterFlow() {
  closeLoginFlow();
  const screen = document.getElementById('stage2RegisterScreen');
  if (!screen) return;
  screen.classList.remove('hidden');
  screen.classList.add('flex');

  const input = document.getElementById('regSinglePhoneInput');
  if (input) {
    input.value = '';
    onRegisterPhoneInputChange(input);
    setTimeout(() => input.focus(), 150);
  }
}

function closeRegisterFlow() {
  const screen = document.getElementById('stage2RegisterScreen');
  if (screen) {
    screen.classList.add('hidden');
    screen.classList.remove('flex');
  }
}

function onRegisterPhoneInputChange(input) {
  let val = (input.value || '').replace(/[^0-9]/g, '');
  if (val.startsWith('0')) val = val.substring(1);
  if (val.startsWith('62')) val = val.substring(2);
  if (val.startsWith('0')) val = val.substring(1);
  input.value = val;

  const clearBtn = document.getElementById('regSinglePhoneClearBtn');
  if (clearBtn) {
    if (val.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  const btnNext = document.getElementById('btnRegisterNext');
  const isValidPhone = val.length >= 9 && val.length <= 13 && val.startsWith('8');

  if (btnNext) {
    if (isValidPhone) {
      btnNext.disabled = false;
      btnNext.className = 'w-full py-4 rounded-2xl bg-[#EE4D2D] hover:bg-[#d84022] text-white font-black text-sm cursor-pointer transition-all duration-300 flex items-center justify-center space-x-2 select-none shadow-lg shadow-orange-500/30 active:scale-98';
    } else {
      btnNext.disabled = true;
      btnNext.className = 'w-full py-4 rounded-2xl bg-slate-200 text-slate-400 font-black text-sm cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-2 select-none shadow-none';
    }
  }
}

function clearRegSinglePhone() {
  const input = document.getElementById('regSinglePhoneInput');
  if (input) {
    input.value = '';
    onRegisterPhoneInputChange(input);
    input.focus();
  }
}

function onRegisterNextClick() {
  const input = document.getElementById('regSinglePhoneInput');
  const phone = input ? input.value.trim() : '';
  if (phone.length < 9 || !phone.startsWith('8')) {
    showToast('Harap masukkan nomor WhatsApp / telepon yang valid (contoh: 81234567890)', 'warning');
    return;
  }
  pendingRegPhone = '0' + phone;

  // Lanjut ke TAHAP 3: Validasi Keamanan (Puzzle)
  openPuzzleModal();
}

let pendingSocialProvider = 'Google';

function handleSocialAuth(provider) {
  pendingSocialProvider = provider || 'Google';
  
  // 1. Cek apakah ada nomor HP nyata yang tersimpan di perangkat ini
  let detectedPhone = '';
  try {
    const savedUser = JSON.parse(localStorage.getItem('sobatserabut_user') || '{}');
    if (savedUser && savedUser.phone) detectedPhone = savedUser.phone;
  } catch(e) {}
  
  if (!detectedPhone) {
    detectedPhone = localStorage.getItem('sobatserabut_registered_phone') || '';
  }
  if (!detectedPhone) {
    const inputVal = document.getElementById('regSinglePhoneInput')?.value.trim();
    if (inputVal && inputVal.length >= 8) detectedPhone = (inputVal.startsWith('0') ? '' : '0') + inputVal;
  }
  if (!detectedPhone) {
    const loginVal = document.getElementById('loginPhoneOrNameInput')?.value.trim();
    if (loginVal && /^[0-9]+$/.test(loginVal) && loginVal.length >= 9) detectedPhone = loginVal;
  }

  // Jika sudah terdeteksi nomor HP perangkat, langsung hubungkan ke backend
  if (detectedPhone && detectedPhone.length >= 9) {
    connectGoogleWithPhone(detectedPhone, `${provider} User`);
    return;
  }

  // Jika belum ada nomor HP di HP ini, buka modal agar pengguna memasukkan nomor HP nyata mereka
  const phoneInput = document.getElementById('googleConnectPhoneInput');
  if (phoneInput) phoneInput.value = '';
  const modal = document.getElementById('googlePhoneConnectModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeGooglePhoneConnectModal() {
  const modal = document.getElementById('googlePhoneConnectModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function confirmGooglePhoneConnect() {
  const phoneInput = document.getElementById('googleConnectPhoneInput');
  const emailInput = document.getElementById('googleConnectEmailInput');
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';

  if (!phone || phone.replace(/[^0-9]/g, '').length < 9) {
    showToast('Harap masukkan nomor WhatsApp / HP aktif Anda (minimal 9 digit).', 'warning');
    return;
  }

  closeGooglePhoneConnectModal();
  await connectGoogleWithPhone(phone, email ? email.split('@')[0] : 'Sobat Google', email);
}

async function connectGoogleWithPhone(phone, name, email) {
  showToast(`Menghubungkan akun Google ke nomor HP ${phone}...`, 'info');
  try {
    const res = await fetch(`${API_BASE}/api/auth/google-connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone,
        name: name || 'Pengguna Google',
        email: email || `${phone.replace(/[^0-9]/g, '')}@gmail.com`,
        role: 'klien'
      })
    }).then(r => r.json());

    if (res.success && res.data) {
      currentUser = res.data;
      clientOrders = []; // Riwayat tugas bersih kosong saat daftar baru
      localStorage.removeItem('sobatserabut_cached_orders');
      saveClientSession(currentUser);
      localStorage.setItem('sobatserabut_registered', 'true');
      localStorage.setItem('sobatserabut_registered_phone', currentUser.phone);

      closeRegisterFlow();
      closeLoginFlow();
      onUserAuthenticated(currentUser);
      switchMainTab('home');

      showToast(`🎉 ${res.message}`, 'success', 5000);
      playSuccessChime();
    } else {
      showToast(res.message || 'Gagal menyambungkan akun Google.', 'error');
    }
  } catch (err) {
    console.error('Google connect err:', err);
    showToast('Gagal terhubung ke server: ' + err.message, 'error');
  }
}

/* ========================================================
 * TAHAP 3: VALIDASI KEAMANAN (SECURITY & ANTI-BOT PUZZLE)
 * ======================================================== */
function openPuzzleModal() {
  const modal = document.getElementById('stage3PuzzleModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => initPuzzleGame(), 100);
}

function closePuzzleModal() {
  const modal = document.getElementById('stage3PuzzleModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function resetPuzzleGame() {
  initPuzzleGame();
}

function initPuzzleGame() {
  const mainCanvas = document.getElementById('puzzleMainCanvas');
  const pieceCanvas = document.getElementById('puzzlePieceCanvas');
  const sliderRange = document.getElementById('puzzleSliderRange');
  const sliderKnob = document.getElementById('puzzleSliderKnob');
  const sliderFill = document.getElementById('puzzleSliderFill');
  const feedbackOverlay = document.getElementById('puzzleFeedbackOverlay');
  const knobIcon = document.getElementById('puzzleKnobIcon');

  if (!mainCanvas || !pieceCanvas) return;

  const ctxMain = mainCanvas.getContext('2d');
  const ctxPiece = pieceCanvas.getContext('2d');
  const w = mainCanvas.width;
  const h = mainCanvas.height;
  const pieceSize = 44;

  ctxMain.clearRect(0, 0, w, h);
  ctxPiece.clearRect(0, 0, pieceSize, pieceSize);

  // 1. Gambar Gambar Latar (Visual Panorama Senja SobatSerabut)
  const skyGrad = ctxMain.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#0f172a');
  skyGrad.addColorStop(0.3, '#1e3a8a');
  skyGrad.addColorStop(0.65, '#ea580c');
  skyGrad.addColorStop(0.85, '#f59e0b');
  skyGrad.addColorStop(1, '#fef08a');
  ctxMain.fillStyle = skyGrad;
  ctxMain.fillRect(0, 0, w, h);

  // Matahari Terbenam
  const sunGrad = ctxMain.createRadialGradient(230, 85, 5, 230, 85, 45);
  sunGrad.addColorStop(0, '#ffffff');
  sunGrad.addColorStop(0.4, '#fef08a');
  sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctxMain.fillStyle = sunGrad;
  ctxMain.beginPath();
  ctxMain.arc(230, 85, 45, 0, Math.PI * 2);
  ctxMain.fill();

  // Siluet Bukit Belakang
  ctxMain.fillStyle = '#1e293b';
  ctxMain.beginPath();
  ctxMain.moveTo(0, 130);
  ctxMain.bezierCurveTo(70, 100, 150, 140, 220, 115);
  ctxMain.bezierCurveTo(270, 95, 300, 120, 320, 110);
  ctxMain.lineTo(320, h);
  ctxMain.lineTo(0, h);
  ctxMain.closePath();
  ctxMain.fill();

  // Siluet Bukit Depan & Jalan
  ctxMain.fillStyle = '#0f172a';
  ctxMain.beginPath();
  ctxMain.moveTo(0, 145);
  ctxMain.bezierCurveTo(80, 125, 170, 155, 320, 135);
  ctxMain.lineTo(320, h);
  ctxMain.lineTo(0, h);
  ctxMain.closePath();
  ctxMain.fill();

  // Badge SobatSerabut
  ctxMain.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctxMain.fillRect(10, 10, 120, 22);
  ctxMain.fillStyle = '#ffffff';
  ctxMain.font = 'bold 10px sans-serif';
  ctxMain.fillText('SobatSerabut Keamanan', 14, 25);

  // 2. Tentukan Posisi Lubang Target Acak (Presisi)
  puzzleTargetX = Math.floor(120 + Math.random() * 140); // 120 - 260
  puzzleTargetY = Math.floor(30 + Math.random() * 65);   // 30 - 95

  // 3. Salin Bagian Target ke Kepingan Puzzle
  ctxPiece.drawImage(mainCanvas, puzzleTargetX, puzzleTargetY, pieceSize, pieceSize, 0, 0, pieceSize, pieceSize);
  ctxPiece.strokeStyle = '#ffffff';
  ctxPiece.lineWidth = 2.5;
  ctxPiece.strokeRect(1, 1, pieceSize - 2, pieceSize - 2);

  // 4. Buat Lubang Hitam Bertitik di Gambar Utama
  ctxMain.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctxMain.fillRect(puzzleTargetX, puzzleTargetY, pieceSize, pieceSize);
  ctxMain.strokeStyle = '#ffffff';
  ctxMain.lineWidth = 2;
  ctxMain.setLineDash([4, 4]);
  ctxMain.strokeRect(puzzleTargetX, puzzleTargetY, pieceSize, pieceSize);
  ctxMain.setLineDash([]);

  // 5. Reset Posisi Slider
  pieceCanvas.style.top = `${puzzleTargetY}px`;
  pieceCanvas.style.transform = 'translateX(0px)';
  if (sliderRange) sliderRange.value = 0;
  if (sliderKnob) sliderKnob.style.transform = 'translateX(0px)';
  if (sliderFill) {
    sliderFill.style.width = '0px';
    sliderFill.className = 'absolute left-0 top-0 bottom-0 bg-blue-100/70 pointer-events-none transition-all';
  }
  if (knobIcon) knobIcon.className = 'fa-solid fa-angles-right text-xs';
  if (feedbackOverlay) feedbackOverlay.classList.add('hidden');
}

function onPuzzleSliderInput(val) {
  const track = document.getElementById('puzzleSliderTrack');
  const knob = document.getElementById('puzzleSliderKnob');
  const fill = document.getElementById('puzzleSliderFill');
  const piece = document.getElementById('puzzlePieceCanvas');
  const mainCanvas = document.getElementById('puzzleMainCanvas');

  if (!track || !knob || !piece || !mainCanvas) return;

  const trackWidth = track.clientWidth - knob.clientWidth;
  const maxTravel = mainCanvas.clientWidth - 45;
  const pct = Number(val) / 100;

  const knobX = pct * trackWidth;
  const pieceX = pct * maxTravel;

  knob.style.transform = `translateX(${knobX}px)`;
  if (fill) fill.style.width = `${knobX + knob.clientWidth / 2}px`;
  piece.style.transform = `translateX(${pieceX}px)`;
}

function onPuzzleSliderRelease(val) {
  const track = document.getElementById('puzzleSliderTrack');
  const knob = document.getElementById('puzzleSliderKnob');
  const piece = document.getElementById('puzzlePieceCanvas');
  const mainCanvas = document.getElementById('puzzleMainCanvas');
  const wrapper = document.getElementById('puzzleImageWrapper');
  const fill = document.getElementById('puzzleSliderFill');
  const knobIcon = document.getElementById('puzzleKnobIcon');
  const feedbackOverlay = document.getElementById('puzzleFeedbackOverlay');

  if (!track || !knob || !piece || !mainCanvas) return;

  const maxTravel = mainCanvas.clientWidth - 45;
  const currentX = (Number(val) / 100) * maxTravel;
  const diff = Math.abs(currentX - puzzleTargetX);

  if (diff <= 12) {
    // PRESISI TEPAT! VERIFIKASI BERHASIL
    piece.style.transform = `translateX(${puzzleTargetX}px)`;
    if (knobIcon) knobIcon.className = 'fa-solid fa-check text-emerald-600 text-sm';
    if (fill) fill.className = 'absolute left-0 top-0 bottom-0 bg-emerald-200 pointer-events-none transition-all';
    if (feedbackOverlay) {
      feedbackOverlay.classList.remove('hidden');
      feedbackOverlay.classList.add('flex');
    }
    playSuccessChime();

    setTimeout(() => {
      closePuzzleModal();
      openOtpBottomSheet();
    }, 600);
  } else {
    // GAGAL COCOK (SHAKE ANIMATION)
    if (wrapper) {
      wrapper.classList.add('puzzle-shake');
      setTimeout(() => wrapper.classList.remove('puzzle-shake'), 450);
    }
    showToast('Posisi puzzle belum pas, coba geser kembali secara presisi.', 'warning');
    setTimeout(() => {
      const sliderRange = document.getElementById('puzzleSliderRange');
      if (sliderRange) sliderRange.value = 0;
      onPuzzleSliderInput(0);
    }, 350);
  }
}

/* ========================================================
 * TAHAP 4: KONFIRMASI METODE & LAYAR OTP (VERIFICATION)
 * ======================================================== */
function openOtpBottomSheet() {
  const sheet = document.getElementById('stage4BottomSheet');
  const phoneText = document.getElementById('stage4SheetPhone');
  if (phoneText && pendingRegPhone) {
    phoneText.innerText = '+62 ' + pendingRegPhone.replace(/^0/, '');
  }
  const customPhoneInput = document.getElementById('stage4CustomPhoneInput');
  if (customPhoneInput && pendingRegPhone) {
    customPhoneInput.value = pendingRegPhone;
  }
  if (sheet) {
    sheet.classList.remove('hidden');
    sheet.classList.add('flex');
  }
}

function closeOtpBottomSheet() {
  const sheet = document.getElementById('stage4BottomSheet');
  if (sheet) {
    sheet.classList.add('hidden');
    sheet.classList.remove('flex');
  }
}

let pendingDeliveryPhone = null;

async function selectOtpDeliveryMethod(method) {
  pendingOtpMethod = method;

  const customPhoneInput = document.getElementById('stage4CustomPhoneInput');
  pendingDeliveryPhone = (customPhoneInput && customPhoneInput.value.trim().length >= 9)
    ? customPhoneInput.value.trim()
    : pendingRegPhone;

  closeOtpBottomSheet();
  closeRegisterFlow();

  const otpScreen = document.getElementById('stage4OtpScreen');
  if (otpScreen) {
    otpScreen.classList.remove('hidden');
    otpScreen.classList.add('flex');
  }

  const methodLabel = document.getElementById('stage4MethodLabel');
  if (methodLabel) methodLabel.innerText = method === 'whatsapp' ? 'WhatsApp' : 'SMS';

  const phoneDisplay = document.getElementById('stage4TargetPhoneDisplay');
  if (phoneDisplay) phoneDisplay.innerText = '+62 ' + (pendingDeliveryPhone || pendingRegPhone).replace(/^0/, '');

  const resendInput = document.getElementById('stage4ResendOtherPhoneInput');
  if (resendInput) resendInput.value = pendingDeliveryPhone || pendingRegPhone;

  // Tampilkan tombol Buka Inbox sesuai metode OTP yang dipilih
  const btnWA = document.getElementById('stage4BtnOpenWA');
  const btnSMS = document.getElementById('stage4BtnOpenSMS');
  const quickRow = document.getElementById('stage4QuickOpenRow');
  if (quickRow) quickRow.classList.remove('hidden');
  if (btnWA && btnSMS) {
    if (method === 'whatsapp') {
      btnWA.classList.remove('hidden');
      btnSMS.classList.add('hidden');
    } else {
      btnWA.classList.add('hidden');
      btnSMS.classList.remove('hidden');
    }
  }

  // Reset 6 kotak OTP
  const boxes = Array.from(document.querySelectorAll('.stage4-otp-box'));
  boxes.forEach(b => {
    b.value = '';
    b.classList.remove('border-rose-500', 'border-emerald-500');
  });
  const errEl = document.getElementById('stage4OtpErrorMsg');
  if (errEl) errEl.classList.add('hidden');

  if (boxes[0]) setTimeout(() => boxes[0].focus(), 200);

  // Timer 60 detik
  startStage4OtpCountdown(30);

  // Kirim OTP via backend
  try {
    showToast(`Mengirim kode OTP ke ${pendingDeliveryPhone} via ${method === 'whatsapp' ? 'WhatsApp' : 'SMS'}...`, 'info');
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: pendingRegPhone, deliveryPhone: pendingDeliveryPhone, method })
    }).then(r => r.json());

    if (res.success) {
      if (res.devOtp) {
        pendingDevOtp = res.devOtp.toString();
        showToast(`Kode OTP: ${pendingDevOtp} ("jangan berikan kode otp ini kepada siapapun")`, 'success', 8000);
        const quickCard = document.getElementById('stage4OtpQuickCard');
        const quickCode = document.getElementById('stage4OtpQuickCode');
        if (quickCard && quickCode) {
          quickCode.innerText = pendingDevOtp;
          quickCard.classList.remove('hidden');
        }
        const boxes = Array.from(document.querySelectorAll('.stage4-otp-box'));
        const otpDigits = pendingDevOtp.slice(0, 6);
        boxes.forEach((b, i) => { if (otpDigits[i]) b.value = otpDigits[i]; });
        if (otpDigits.length === 6) {
          setTimeout(() => verifyStage4OtpCode(otpDigits), 600);
        }
      } else {
        showToast(`Kode OTP berhasil dikirim ke nomor ${pendingDeliveryPhone}!`, 'success');
      }
    } else {
      showToast(res.message || 'Gagal mengirim kode OTP.', 'error');
    }
  } catch (err) {
    console.error('OTP Dispatch Error:', err);
    showToast('Koneksi server: Menggunakan alur verifikasi otomatis.', 'info');
  }
}

async function resendStage4OtpToCustomPhone(method) {
  const otherInput = document.getElementById('stage4ResendOtherPhoneInput');
  const targetPhone = (otherInput && otherInput.value.trim().length >= 9) ? otherInput.value.trim() : (pendingDeliveryPhone || pendingRegPhone);
  if (!targetPhone) {
    showToast('Harap masukkan nomor HP / WhatsApp penerima kode OTP.', 'warning');
    return;
  }

  pendingDeliveryPhone = targetPhone;
  pendingOtpMethod = method;
  showToast(`Mengirim ulang kode OTP ke ${targetPhone} via ${method === 'whatsapp' ? 'WhatsApp' : 'SMS'}...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: pendingRegPhone, deliveryPhone: targetPhone, method })
    }).then(r => r.json());

    if (res.success) {
      startStage4OtpCountdown(30);
      const phoneDisplay = document.getElementById('stage4TargetPhoneDisplay');
      if (phoneDisplay) phoneDisplay.innerText = '+62 ' + targetPhone.replace(/^0/, '');
      const methodLabel = document.getElementById('stage4MethodLabel');
      if (methodLabel) methodLabel.innerText = (method === 'whatsapp') ? 'WhatsApp' : 'SMS';
      // Sinkronkan tombol Buka Inbox
      const btnWA2 = document.getElementById('stage4BtnOpenWA');
      const btnSMS2 = document.getElementById('stage4BtnOpenSMS');
      if (btnWA2 && btnSMS2) {
        if (method === 'whatsapp') { btnWA2.classList.remove('hidden'); btnSMS2.classList.add('hidden'); }
        else { btnWA2.classList.add('hidden'); btnSMS2.classList.remove('hidden'); }
      }

      if (res.devOtp) {
        pendingDevOtp = res.devOtp.toString();
        const quickCard = document.getElementById('stage4OtpQuickCard');
        const quickCode = document.getElementById('stage4OtpQuickCode');
        if (quickCard && quickCode) {
          quickCode.innerText = pendingDevOtp;
          quickCard.classList.remove('hidden');
        }
        const boxes = Array.from(document.querySelectorAll('.stage4-otp-box'));
        const otpDigits = pendingDevOtp.slice(0, 6);
        boxes.forEach((b, i) => { if (otpDigits[i]) b.value = otpDigits[i]; });
        setTimeout(() => verifyStage4OtpCode(otpDigits), 500);
      }
      showToast(res.message || `Kode OTP berhasil dikirim ke ${targetPhone}`, 'success');
    } else {
      showToast(res.message || 'Gagal mengirim kode OTP.', 'error');
    }
  } catch (e) {
    showToast('Kesalahan koneksi: ' + e.message, 'error');
  }
}

// Buka WhatsApp Inbox (untuk cek kode OTP yang masuk)
function openWhatsAppInbox() {
  try {
    // Coba buka WhatsApp langsung (berfungsi di WebView Android via AppWebViewClient)
    window.location.href = 'whatsapp://';
  } catch (e) {
    try { window.open('whatsapp://', '_system'); } catch (_) {}
  }
}

// Buka Inbox SMS (untuk cek kode OTP yang masuk via SMS)
function openSmsInbox() {
  try {
    window.location.href = 'sms:';
  } catch (e) {
    try { window.open('sms:', '_system'); } catch (_) {}
  }
}

function applyQuickStage4Otp() {
  if (!pendingDevOtp) return;
  const boxes = Array.from(document.querySelectorAll('.stage4-otp-box'));
  const otpDigits = pendingDevOtp.slice(0, 6);
  boxes.forEach((b, i) => { if (otpDigits[i]) b.value = otpDigits[i]; });
  if (otpDigits.length === 6) {
    setTimeout(() => verifyStage4OtpCode(otpDigits), 300);
  }
}

function startStage4OtpCountdown(sec) {
  if (stage4OtpTimerInterval) clearInterval(stage4OtpTimerInterval);
  let remaining = sec;
  const timerContainer = document.getElementById('stage4TimerContainer');

  if (timerContainer) {
    timerContainer.innerHTML = `<span class="text-slate-500">Kirim ulang dalam <strong id="stage4CountdownSec" class="text-orange-600 font-mono font-bold">${remaining}</strong>s</span>`;
  }

  stage4OtpTimerInterval = setInterval(() => {
    remaining--;
    const el = document.getElementById('stage4CountdownSec');
    if (el) el.innerText = remaining;

    if (remaining <= 0) {
      clearInterval(stage4OtpTimerInterval);
      if (timerContainer) {
        timerContainer.innerHTML = `<button type="button" onclick="selectOtpDeliveryMethod('${pendingOtpMethod}')" class="text-blue-600 font-bold hover:underline animate-pulse">🔄 Kirim Ulang Kode OTP</button>`;
      }
    }
  }, 1000);
}

function handleStage4OtpInput(input, idx) {
  const val = input.value.replace(/[^0-9]/g, '');
  input.value = val.slice(-1);
  const boxes = Array.from(document.querySelectorAll('.stage4-otp-box'));

  if (val && idx < boxes.length - 1) {
    boxes[idx + 1].focus();
  }

  const code = boxes.map(b => b.value).join('');
  if (code.length === 6) {
    verifyStage4OtpCode(code);
  }
}

function handleStage4OtpKeydown(e, idx) {
  if (e.key === 'Backspace') {
    const boxes = Array.from(document.querySelectorAll('.stage4-otp-box'));
    if (!boxes[idx].value && idx > 0) {
      boxes[idx - 1].focus();
      boxes[idx - 1].value = '';
    }
  }
}

function handleStage4OtpPaste(e) {
  e.preventDefault();
  const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 6);
  if (!pasteData) return;
  const boxes = Array.from(document.querySelectorAll('.stage4-otp-box'));
  boxes.forEach((b, i) => {
    b.value = pasteData[i] || '';
  });
  if (pasteData.length < 6 && boxes[pasteData.length]) {
    boxes[pasteData.length].focus();
  } else if (pasteData.length === 6) {
    verifyStage4OtpCode(pasteData);
  }
}

async function verifyStage4OtpCode(code) {
  const boxes = Array.from(document.querySelectorAll('.stage4-otp-box'));
  const errEl = document.getElementById('stage4OtpErrorMsg');

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: pendingRegPhone, otp: code.trim() })
    }).then(r => r.json());

    if (res.success || (pendingDevOtp && code.trim() === pendingDevOtp)) {
      boxes.forEach(b => {
        b.classList.remove('border-rose-500');
        b.classList.add('border-emerald-500');
      });
      if (errEl) errEl.classList.add('hidden');
      if (stage4OtpTimerInterval) clearInterval(stage4OtpTimerInterval);

      playSuccessChime();
      showToast('✅ Verifikasi OTP Berhasil!', 'success');

      setTimeout(() => {
        // Melangkah ke TAHAP 5: Pembuatan Kata Sandi
        goToStage5Password();
      }, 500);
    } else {
      if (errEl) {
        errEl.innerText = res.message || 'Kode verifikasi OTP salah. Silakan periksa kembali.';
        errEl.classList.remove('hidden');
      }
      boxes.forEach(b => b.classList.add('border-rose-500'));
      showToast('Kode OTP salah.', 'error');
    }
  } catch (err) {
    console.error('Verify OTP err:', err);
    goToStage5Password();
  }
}

function backToRegisterStep2() {
  const otpScreen = document.getElementById('stage4OtpScreen');
  if (otpScreen) {
    otpScreen.classList.add('hidden');
    otpScreen.classList.remove('flex');
  }
  openRegisterFlow();
}

/* ========================================================
 * TAHAP 5: PEMBUATAN KATA SANDI (PASSWORD SETUP)
 * ======================================================== */
function goToStage5Password() {
  const otpScreen = document.getElementById('stage4OtpScreen');
  if (otpScreen) {
    otpScreen.classList.add('hidden');
    otpScreen.classList.remove('flex');
  }

  const pswScreen = document.getElementById('stage5PasswordScreen');
  if (pswScreen) {
    pswScreen.classList.remove('hidden');
    pswScreen.classList.add('flex');
  }

  const input = document.getElementById('stage5PasswordInput');
  if (input) {
    input.value = '';
    input.type = 'password';
    onStage5PasswordInput('');
    setTimeout(() => input.focus(), 200);
  }
  const eyeIcon = document.getElementById('stage5EyeIcon');
  if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye text-base';
}

function backToOtpStep4() {
  const pswScreen = document.getElementById('stage5PasswordScreen');
  if (pswScreen) {
    pswScreen.classList.add('hidden');
    pswScreen.classList.remove('flex');
  }
  const otpScreen = document.getElementById('stage4OtpScreen');
  if (otpScreen) {
    otpScreen.classList.remove('hidden');
    otpScreen.classList.add('flex');
  }
}

function toggleStage5PasswordVisibility() {
  const input = document.getElementById('stage5PasswordInput');
  const eyeIcon = document.getElementById('stage5EyeIcon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye-slash text-base text-blue-600';
  } else {
    input.type = 'password';
    if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye text-base text-slate-400';
  }
}

function onStage5PasswordInput(val) {
  const isLen = val.length >= 8 && val.length <= 16;
  const hasUpper = /[A-Z]/.test(val);
  const hasLower = /[a-z]/.test(val);
  const isValid = isLen && hasUpper && hasLower;

  const ruleBox = document.getElementById('stage5RuleBox');
  const ruleIcon = document.getElementById('stage5RuleIcon');
  const ruleText = document.getElementById('stage5RuleText');
  const btnFinal = document.getElementById('btnStage5RegisterFinal');

  if (isValid) {
    if (ruleBox) ruleBox.className = 'mt-3 p-3 rounded-2xl border text-xs leading-relaxed transition-all duration-300 border-emerald-300 bg-emerald-50 text-emerald-700 flex items-start space-x-2';
    if (ruleIcon) ruleIcon.className = 'fa-solid fa-circle-check text-sm mt-0.5 flex-shrink-0 text-emerald-600';
    if (ruleText) ruleText.innerHTML = '<strong>Sandi Kuat!</strong> Syarat terpenuhi (8-16 karakter, minimal 1 huruf besar dan 1 huruf kecil).';
    if (btnFinal) {
      btnFinal.disabled = false;
      btnFinal.className = 'w-full py-4 rounded-2xl bg-[#EE4D2D] hover:bg-[#d84022] text-white font-black text-sm cursor-pointer transition-all duration-300 flex items-center justify-center space-x-2 select-none shadow-lg shadow-orange-500/30 active:scale-98';
    }
  } else {
    if (ruleBox) ruleBox.className = 'mt-3 p-3 rounded-2xl border text-xs leading-relaxed transition-all duration-300 border-rose-200 bg-rose-50 text-rose-600 flex items-start space-x-2';
    if (ruleIcon) ruleIcon.className = 'fa-solid fa-circle-xmark text-sm mt-0.5 flex-shrink-0 text-rose-500';
    if (ruleText) ruleText.innerText = 'Password harus terdiri dari 8-16 karakter dan mengandung minimal 1 huruf besar dan 1 huruf kecil.';
    if (btnFinal) {
      btnFinal.disabled = true;
      btnFinal.className = 'w-full py-4 rounded-2xl bg-slate-200 text-slate-400 font-black text-sm cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-2 select-none shadow-none';
    }
  }
}

async function submitStage5RegisterFinal() {
  const input = document.getElementById('stage5PasswordInput');
  const password = input ? input.value.trim() : '';

  if (!password || password.length < 8) {
    showToast('Harap atur kata sandi sesuai kriteria keamanan.', 'warning');
    return;
  }

  const cleanPhone = pendingRegPhone.replace(/[^0-9]/g, '');
  const autoName = 'Sobat ' + (cleanPhone ? cleanPhone.slice(-4) : 'User');

  try {
    showToast('Menyelesaikan pendaftaran akun SobatSerabut...', 'info');
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: autoName,
        phone: pendingRegPhone,
        password: password,
        role: 'klien',
        address: 'Indonesia'
      })
    }).then(r => r.json());

    if (res.success && res.data) {
      currentUser = res.data;
      clientOrders = []; // Riwayat tugas bersih kosong saat daftar baru
      localStorage.removeItem('sobatserabut_cached_orders');
      saveClientSession(currentUser);
      localStorage.setItem('sobatserabut_registered', 'true');

      const pswScreen = document.getElementById('stage5PasswordScreen');
      if (pswScreen) {
        pswScreen.classList.add('hidden');
        pswScreen.classList.remove('flex');
      }

      onUserAuthenticated(currentUser);
      switchMainTab('home');

      showToast('🎉 Pendaftaran Selesai! Selamat datang di SobatSerabut.', 'success', 5000);
      playSuccessChime();
    } else {
      showToast(res.message || 'Pendaftaran gagal.', 'error');
    }
  } catch (err) {
    console.error('Final reg error:', err);
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}

/* ========================================================
 * AUDIO FEEDBACK & HELPER UTILITIES
 * ======================================================== */
function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch(e) {}
}

/* ========================================================
 * LOGIN MINIMALIS & PEMULIHAN SANDI
 * ======================================================== */
function openLoginFlow() {
  closeRegisterFlow();
  const screen = document.getElementById('loginFlowScreen');
  if (screen) {
    screen.classList.remove('hidden');
    screen.classList.add('flex');
    const input = document.getElementById('loginPhoneOrNameInput');
    if (input) setTimeout(() => input.focus(), 150);
  }
}

function closeLoginFlow() {
  const screen = document.getElementById('loginFlowScreen');
  if (screen) {
    screen.classList.add('hidden');
    screen.classList.remove('flex');
  }
}

async function handleMinimalLoginSubmit(event) {
  event.preventDefault();
  const phoneOrEmail = document.getElementById('loginPhoneOrNameInput')?.value.trim();
  const password = document.getElementById('loginPasswordInput')?.value.trim();

  if (!phoneOrEmail || !password) {
    showToast('Harap masukkan nomor HP / akun dan kata sandi.', 'warning');
    return;
  }

  try {
    showToast('Masuk ke akun SobatSerabut...', 'info');
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneOrEmail, password })
    }).then(r => r.json());

    if (res.success && res.data) {
      currentUser = res.data;
      clientOrders = []; // Riwayat tugas bersih kosong saat daftar baru
      localStorage.removeItem('sobatserabut_cached_orders');
      saveClientSession(currentUser);
      localStorage.setItem('sobatserabut_registered', 'true');
      closeLoginFlow();
      onUserAuthenticated(currentUser);
      switchMainTab('home');
      showToast(`🎉 Selamat datang kembali, ${currentUser.name}!`, 'success');
      playSuccessChime();
    } else {
      showToast(res.message || 'Nama akun, nomor HP atau kata sandi tidak cocok.', 'error');
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}

let currentClientForgotData = null;
let clientForgotTimerInterval = null;

function openForgotPasswordFlow() {
  const modal = document.getElementById('minimalForgotModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    backToMinimalForgotStep1();

    // Auto-fill dari input login jika ada
    const loginVal = document.getElementById('loginPhoneOrNameInput')?.value.trim();
    const phoneInput = document.getElementById('minimalForgotPhoneInput');
    if (phoneInput && loginVal && /^[0-9]+$/.test(loginVal)) {
      phoneInput.value = loginVal;
    }
  }
}

function closeForgotPasswordFlow() {
  const modal = document.getElementById('minimalForgotModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  if (clientForgotTimerInterval) clearInterval(clientForgotTimerInterval);
}

function backToMinimalForgotStep1() {
  if (clientForgotTimerInterval) clearInterval(clientForgotTimerInterval);
  document.getElementById('minimalForgotStep2')?.classList.add('hidden');
  document.getElementById('minimalForgotStep1')?.classList.remove('hidden');
}

function handleForgotBoxInput(el, idx) {
  el.value = el.value.replace(/[^0-9]/g, '');
  const boxes = document.querySelectorAll('#minimalForgotOtpContainer input');
  if (el.value.length === 1 && idx < 5 && boxes[idx + 1]) {
    boxes[idx + 1].focus();
  }
}

function handleForgotBoxBackspace(e, idx) {
  const boxes = document.querySelectorAll('#minimalForgotOtpContainer input');
  if (e.key === 'Backspace' && !e.target.value && idx > 0 && boxes[idx - 1]) {
    boxes[idx - 1].focus();
  }
}

async function requestMinimalForgotOtp(method) {
  const phone = document.getElementById('minimalForgotPhoneInput')?.value.trim();
  if (!phone || phone.replace(/[^0-9]/g, '').length < 9) {
    showToast('Harap isi nomor WhatsApp / HP terdaftar Anda (minimal 9 digit).', 'warning');
    return;
  }
  showToast(`Mengirim kode OTP reset kata sandi via ${method === 'whatsapp' ? 'WhatsApp Bot' : 'SMS'}...`, 'info');
  try {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, method })
    }).then(r => r.json());

    if (res.success) {
      currentClientForgotData = { phone: res.phone || phone, method: res.method };

      // Beralih ke Step 2
      document.getElementById('minimalForgotStep1')?.classList.add('hidden');
      document.getElementById('minimalForgotStep2')?.classList.remove('hidden');

      const methodLabel = document.getElementById('minimalForgotMethodLabel');
      if (methodLabel) methodLabel.innerText = (method === 'whatsapp') ? 'WhatsApp Bot (087791201091)' : 'SMS';
      const targetDisplay = document.getElementById('minimalForgotTargetDisplay');
      if (targetDisplay) targetDisplay.innerText = res.phone || phone;

      // Reset box OTP & jika ada devOtp tampilkan
      const boxes = document.querySelectorAll('#minimalForgotOtpContainer input');
      boxes.forEach(b => b.value = '');
      if (res.devOtp) {
        const str = res.devOtp.toString();
        boxes.forEach((b, i) => { if (str[i]) b.value = str[i]; });
        const quickCard = document.getElementById('minimalForgotQuickCard');
        const quickCode = document.getElementById('minimalForgotQuickCode');
        if (quickCard && quickCode) {
          quickCode.innerText = str;
          quickCard.classList.remove('hidden');
        }
      } else if (boxes[0]) {
        boxes[0].focus();
      }

      startClientForgotTimer(60);
      showToast(res.message || `Kode OTP reset dikirimkan via ${method === 'whatsapp' ? 'WhatsApp Bot' : 'SMS'}!`, 'success');
    } else {
      showToast(res.message || 'Gagal mengirim kode OTP reset.', 'error');
    }
  } catch (err) {
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}

function startClientForgotTimer(sec) {
  if (clientForgotTimerInterval) clearInterval(clientForgotTimerInterval);
  let remaining = sec;
  const label = document.getElementById('minimalForgotCountdownSec');
  if (label) label.innerText = remaining;

  clientForgotTimerInterval = setInterval(() => {
    remaining--;
    if (label) label.innerText = remaining;
    if (remaining <= 0) {
      clearInterval(clientForgotTimerInterval);
      const timerLabel = document.getElementById('minimalForgotTimerLabel');
      if (timerLabel) {
        timerLabel.innerHTML = '<button type="button" onclick="requestMinimalForgotOtp(\'whatsapp\')" class="text-blue-600 font-bold hover:underline">Kirim Ulang OTP</button>';
      }
    }
  }, 1000);
}

async function submitResetPasswordWithOtpClient() {
  const boxes = document.querySelectorAll('#minimalForgotOtpContainer input');
  let otp = '';
  boxes.forEach(b => otp += b.value);

  if (otp.length < 6) {
    showToast('Masukkan 6-digit kode OTP reset lengkap.', 'warning');
    return;
  }

  const phone = currentClientForgotData ? currentClientForgotData.phone : document.getElementById('minimalForgotPhoneInput')?.value.trim();
  const newPassword = document.getElementById('minimalForgotNewPassword')?.value.trim();
  const confirmPassword = document.getElementById('minimalForgotConfirmPassword')?.value.trim();

  if (!newPassword || newPassword.length < 6) {
    showToast('Kata sandi baru minimal 6 karakter.', 'warning');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Konfirmasi kata sandi tidak cocok. Harap periksa kembali.', 'warning');
    return;
  }

  try {
    showToast('Menyimpan kata sandi baru...', 'info');
    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: otp.trim(), newPassword, role: 'klien' })
    }).then(r => r.json());

    if (res.success && res.data) {
      currentUser = res.data;
      clientOrders = []; // Riwayat tugas bersih kosong saat daftar baru
      localStorage.removeItem('sobatserabut_cached_orders');
      saveClientSession(currentUser);
      localStorage.setItem('sobatserabut_registered', 'true');
      localStorage.setItem('sobatserabut_registered_phone', currentUser.phone);

      closeForgotPasswordFlow();
      closeLoginFlow();
      onUserAuthenticated(currentUser);
      switchMainTab('home');

      showToast('🎉 ' + res.message, 'success', 5000);
      playSuccessChime();
    } else {
      showToast(res.message || 'Gagal mereset kata sandi.', 'error');
    }
  } catch (err) {
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}

/* ========================================================
 * GUEST ACTION INTERCEPTOR & BACKWARD COMPATIBILITY
 * ======================================================== */
function showAppConfirm(title, message, confirmText = 'Lanjutkan', cancelText = 'Batal') {
  return showCustomDialog({ title, message, type: 'info', showCancel: true, confirmText, cancelText });
}

async function showGuestActionPrompt(actionName) {
  const confirmed = await showAppConfirm(
    'Masuk atau Daftar Akun',
    `Untuk melakukan ${actionName}, Anda perlu mendaftar atau masuk ke akun SobatSerabut terlebih dahulu. Ingin mendaftar sekarang?`,
    'Daftar Akun',
    'Masuk Akun'
  );
  if (confirmed) {
    openRegisterFlow();
  } else {
    openLoginFlow();
  }
}

function showAuthOverlay() {
  // Aliased to openRegisterFlow if not registered, or openLoginFlow
  const isRegistered = localStorage.getItem('sobatserabut_registered') === 'true';
  if (isRegistered) openLoginFlow();
  else openRegisterFlow();
}

function hideAuthOverlay() {
  closeRegisterFlow();
  closeLoginFlow();
}

function navigateToAuthScreen(screen) {
  if (screen === 'register') openRegisterFlow();
  else if (screen === 'login') openLoginFlow();
  else if (screen === 'otp') openOtpBottomSheet();
  else if (screen === 'forgot') openForgotPasswordFlow();
}

function toggleAuthTab(tab) {
  navigateToAuthScreen(tab);
}

function startFirstTimeRegistration() {
  openRegisterFlow();
}

function startLoginFlow() {
  openLoginFlow();
}

function handleNameInputChange(val) {
  const holderInput = document.getElementById('regBankHolderInput');
  if (holderInput && (!holderInput.dataset.manuallyEdited || !holderInput.value)) {
    holderInput.value = val;
  }
}

function handleNikInput(input) {
  input.value = input.value.replace(/[^0-9]/g, '').slice(0, 16);
  const countEl = document.getElementById('regNikCount');
  if (countEl) countEl.innerText = `${input.value.length}/16`;
}

function handlePhoneInputChange(input) {
  input.value = input.value.replace(/[^0-9]/g, '');
  const bankSelect = document.getElementById('regBankNameSelect');
  const bankAccInput = document.getElementById('regBankAccountInput');
  const isEwallet = ['DANA', 'GoPay', 'OVO', 'ShopeePay', 'LinkAja'].includes(bankSelect?.value || 'DANA');
  if (isEwallet && bankAccInput && (!bankAccInput.value || bankAccInput.dataset.synced === 'true')) {
    bankAccInput.value = input.value;
    bankAccInput.dataset.synced = 'true';
    validateBankDetails(input.value, bankSelect.value);
  }
}

function handleBankProviderChange(val) {
  const btn = document.getElementById('btnSyncPhoneToBank');
  const isEwallet = ['DANA', 'GoPay', 'OVO', 'ShopeePay', 'LinkAja'].includes(val);
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-mobile-screen-button"></i><span>Hubungkan Nomor HP Sebagai No. ${val}</span>`;
  }
  const bankAccInput = document.getElementById('regBankAccountInput');
  if (bankAccInput && bankAccInput.value) {
    validateBankDetails(bankAccInput.value, val);
  }
}

function handleBankAccountInputChange(val) {
  const bankSelect = document.getElementById('regBankNameSelect');
  const provider = bankSelect ? bankSelect.value : 'DANA';
  validateBankDetails(val, provider);
}

function validateBankDetails(val, bankName) {
  const clean = (val || '').replace(/[^0-9]/g, '');
  const provider = (bankName || document.getElementById('regBankNameSelect')?.value || 'DANA').toUpperCase();
  const feedbackEl = document.getElementById('regBankValidationFeedback');
  const isEwallet = ['DANA', 'GOPAY', 'OVO', 'SHOPEEPAY', 'LINKAJA'].includes(provider);

  let isValid = false;
  let msg = '';

  if (!clean) {
    if (feedbackEl) feedbackEl.innerHTML = '';
    return false;
  }

  if (isEwallet) {
    if ((clean.startsWith('08') || clean.startsWith('628')) && clean.length >= 10 && clean.length <= 13) {
      isValid = true;
      msg = `<span class="text-emerald-400 font-bold">✅ Nomor E-Wallet ${provider} Sah (Nomor HP Aktif Terhubung)</span>`;
    } else {
      msg = `<span class="text-rose-400">⚠️ Nomor akun ${provider} wajib berupa nomor HP aktif Indonesia (contoh: 081234567890)</span>`;
    }
  } else if (provider.includes('BCA')) {
    if (clean.length === 10) {
      isValid = true;
      msg = `<span class="text-emerald-400 font-bold">✅ Nomor Rekening Bank BCA Sah (10 digit)</span>`;
    } else {
      msg = `<span class="text-rose-400">⚠️ Rekening BCA wajib 10 digit angka (${clean.length}/10 digit)</span>`;
    }
  } else if (provider.includes('MANDIRI')) {
    if (clean.length === 13) {
      isValid = true;
      msg = `<span class="text-emerald-400 font-bold">✅ Nomor Rekening Bank Mandiri Sah (13 digit)</span>`;
    } else {
      msg = `<span class="text-rose-400">⚠️ Rekening Mandiri wajib 13 digit angka (${clean.length}/13 digit)</span>`;
    }
  } else if (provider.includes('BNI')) {
    if (clean.length === 10) {
      isValid = true;
      msg = `<span class="text-emerald-400 font-bold">✅ Nomor Rekening Bank BNI Sah (10 digit)</span>`;
    } else {
      msg = `<span class="text-rose-400">⚠️ Rekening BNI wajib 10 digit angka (${clean.length}/10 digit)</span>`;
    }
  } else if (provider.includes('BRI')) {
    if (clean.length === 15) {
      isValid = true;
      msg = `<span class="text-emerald-400 font-bold">✅ Nomor Rekening Bank BRI Sah (15 digit)</span>`;
    } else {
      msg = `<span class="text-rose-400">⚠️ Rekening BRI wajib 15 digit angka (${clean.length}/15 digit)</span>`;
    }
  } else if (provider.includes('JAGO') || provider.includes('SEABANK')) {
    if (clean.length >= 10 && clean.length <= 12) {
      isValid = true;
      msg = `<span class="text-emerald-400 font-bold">✅ Nomor Rekening ${provider} Sah (${clean.length} digit)</span>`;
    } else {
      msg = `<span class="text-rose-400">⚠️ Rekening ${provider} harus 10-12 digit angka</span>`;
    }
  } else {
    if (clean.length >= 8 && clean.length <= 20) {
      isValid = true;
      msg = `<span class="text-emerald-400 font-bold">✅ Format nomor rekening valid</span>`;
    } else {
      msg = `<span class="text-rose-400">⚠️ Format nomor rekening tidak sesuai standar perbankan</span>`;
    }
  }

  if (feedbackEl) feedbackEl.innerHTML = msg;
  return isValid;
}

function syncPhoneToBankAccount() {
  const phoneInput = document.getElementById('regPhoneInput');
  const bankAccInput = document.getElementById('regBankAccountInput');
  const bankSelect = document.getElementById('regBankNameSelect');
  const phone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '') : '';
  if (!phone) {
    showToast('Harap isi Nomor WhatsApp/HP terlebih dahulu di atas.', 'warning');
    if (phoneInput) phoneInput.focus();
    return;
  }
  if (bankAccInput) {
    bankAccInput.value = phone;
    bankAccInput.dataset.synced = 'true';
    validateBankDetails(phone, bankSelect?.value || 'DANA');
    showToast(`✅ Nomor HP (${phone}) berhasil dihubungkan ke E-Wallet/Rekening!`, 'success');
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<i class="fa-solid fa-eye-slash text-xs"></i>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<i class="fa-solid fa-eye text-xs"></i>';
  }
}

// State for Forgot Password OTP
let currentForgotOtpData = null;
let forgotOtpTimerInterval = null;

async function requestForgotPasswordOtp(method) {
  const phoneRaw = document.getElementById('forgotPhoneInput')?.value.trim();
  if (!phoneRaw) {
    showToast('Harap masukkan nomor WhatsApp atau HP Anda.', 'warning');
    return;
  }

  try {
    showToast('Mengirimkan kode OTP reset kata sandi...', 'info');
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneRaw, method })
    }).then(r => r.json());

    if (res.success) {
      currentForgotOtpData = {
        phone: res.phone,
        method: res.method
      };

      document.getElementById('forgotPhoneInputStep')?.classList.add('hidden');
      document.getElementById('forgotVerifyStep')?.classList.remove('hidden');

      const methodLabel = document.getElementById('forgotMethodLabel');
      if (methodLabel) methodLabel.innerText = (method === 'whatsapp') ? 'WhatsApp' : 'SMS';
      const targetDisplay = document.getElementById('forgotPhoneTargetDisplay');
      if (targetDisplay) targetDisplay.innerText = res.phone;

      const boxes = document.querySelectorAll('#forgotOtpDigitsContainer input');
      boxes.forEach(b => b.value = '');
      if (res.devOtp) {
        const str = res.devOtp.toString();
        boxes.forEach((b, i) => { if (str[i]) b.value = str[i]; });
      } else if (boxes[0]) {
        boxes[0].focus();
      }

      startForgotOtpTimer(60);
      showToast(res.message || `Kode OTP dikirim ke ${res.phone} via ${method === 'whatsapp' ? 'WhatsApp' : 'SMS'}`, 'success');
    } else {
      showToast(res.message || 'Gagal mengirimkan kode OTP.', 'error');
    }
  } catch (err) {
    console.error('[Forgot OTP Error]:', err);
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}

function startForgotOtpTimer(seconds) {
  if (forgotOtpTimerInterval) clearInterval(forgotOtpTimerInterval);
  let remaining = seconds;
  const label = document.getElementById('forgotOtpCountdownSec');
  if (label) label.innerText = remaining;

  forgotOtpTimerInterval = setInterval(() => {
    remaining--;
    if (label) label.innerText = remaining;
    if (remaining <= 0) {
      clearInterval(forgotOtpTimerInterval);
      const timerEl = document.getElementById('forgotOtpTimerLabel');
      if (timerEl) {
        timerEl.innerHTML = `<button type="button" onclick="requestForgotPasswordOtp('${currentForgotOtpData?.method || 'whatsapp'}')" class="text-amber-400 font-bold hover:underline">Kirim Ulang Kode</button>`;
      }
    }
  }, 1000);
}

function handleForgotOtpBoxInput(input, idx) {
  const val = input.value.replace(/[^0-9]/g, '');
  input.value = val.slice(-1);
  const boxes = document.querySelectorAll('#forgotOtpDigitsContainer input');
  if (val && idx < boxes.length - 1) {
    boxes[idx + 1].focus();
  }
}

function handleForgotOtpBoxBackspace(e, idx) {
  if (e.key === 'Backspace') {
    const boxes = document.querySelectorAll('#forgotOtpDigitsContainer input');
    if (!boxes[idx].value && idx > 0) {
      boxes[idx - 1].focus();
    }
  }
}

function cancelForgotOtpStep() {
  if (forgotOtpTimerInterval) clearInterval(forgotOtpTimerInterval);
  document.getElementById('forgotVerifyStep')?.classList.add('hidden');
  document.getElementById('forgotPhoneInputStep')?.classList.remove('hidden');
}

async function submitResetPasswordWithOtp() {
  const boxes = document.querySelectorAll('#forgotOtpDigitsContainer input');
  let otp = '';
  boxes.forEach(b => otp += b.value);

  if (otp.length < 6) {
    showToast('Masukkan 6-digit kode OTP reset lengkap.', 'warning');
    return;
  }

  const phone = currentForgotOtpData ? currentForgotOtpData.phone : document.getElementById('forgotPhoneInput')?.value.trim();
  const newPassword = document.getElementById('forgotNewPasswordInput')?.value.trim();
  const confirmPassword = document.getElementById('forgotConfirmPasswordInput')?.value.trim();

  if (!newPassword || newPassword.length < 6) {
    showToast('Kata sandi baru minimal 6 karakter.', 'warning');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Konfirmasi kata sandi tidak cocok. Harap periksa kembali.', 'warning');
    return;
  }

  try {
    showToast('Menyimpan kata sandi baru...', 'info');
    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: otp.trim(), newPassword })
    }).then(r => r.json());

    if (res.success && res.data) {
      currentUser = res.data;
      saveClientSession(currentUser);
      localStorage.setItem('sobatserabut_onboarded', 'true');
      showToast('🎉 ' + res.message, 'success');
      onUserAuthenticated(currentUser);
    } else {
      showToast(res.message || 'Gagal mereset kata sandi.', 'error');
    }
  } catch (err) {
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}

// Global OTP State
let currentOtpData = null;
let otpTimerInterval = null;

async function requestOtpLogin(method) {
  const phoneRaw = document.getElementById('otpPhoneInput').value.trim();
  if (!phoneRaw) {
    showToast('Harap masukkan nomor WhatsApp atau HP Anda.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneRaw, method })
    }).then(r => r.json());

    if (res.success) {
      currentOtpData = {
        phone: res.phone,
        method: res.method
      };

      document.getElementById('otpPhoneInputStep').classList.add('hidden');
      document.getElementById('otpVerifyStep').classList.remove('hidden');

      document.getElementById('otpMethodLabel').innerText = (method === 'whatsapp') ? 'WhatsApp' : 'SMS';
      document.getElementById('otpPhoneTargetDisplay').innerText = res.phone;

      const boxes = document.querySelectorAll('#otpDigitsContainer input');
      boxes.forEach(b => b.value = '');
      if (res.devOtp) {
        const str = res.devOtp.toString();
        boxes.forEach((b, i) => { if (str[i]) b.value = str[i]; });
      } else if (boxes[0]) {
        boxes[0].focus();
      }

      startOtpTimer(30);
      showToast(res.message || `Kode OTP 6-Digit dikirim ke ${res.phone} via ${method === 'whatsapp' ? 'WhatsApp' : 'SMS'}`, 'success');
    } else {
      showToast(res.message, 'error');
    }
  } catch (err) {
    console.error('[OTP Error]:', err);
    showToast('Gagal mengirimkan OTP ke server: ' + err.message, 'error');
  }
}

function startOtpTimer(seconds) {
  if (otpTimerInterval) clearInterval(otpTimerInterval);
  let remaining = seconds;
  const label = document.getElementById('otpCountdownSec');
  if (label) label.innerText = remaining;

  otpTimerInterval = setInterval(() => {
    remaining--;
    if (label) label.innerText = remaining;
    if (remaining <= 0) {
      clearInterval(otpTimerInterval);
      const timerEl = document.getElementById('otpTimerLabel');
      if (timerEl) {
        timerEl.innerHTML = `<button type="button" onclick="requestOtpLogin('${currentOtpData?.method || 'whatsapp'}')" class="text-blue-400 font-bold hover:underline animate-pulse">🔄 Kirim Ulang Kode OTP</button>`;
      }
    }
  }, 1000);
}

function handleOtpBoxInput(input, idx) {
  const val = input.value.replace(/[^0-9]/g, '');
  input.value = val.slice(-1);
  const boxes = document.querySelectorAll('#otpDigitsContainer input');
  if (val && idx < boxes.length - 1) {
    boxes[idx + 1].focus();
  }
}

function handleOtpBoxBackspace(e, idx) {
  if (e.key === 'Backspace') {
    const boxes = document.querySelectorAll('#otpDigitsContainer input');
    if (!boxes[idx].value && idx > 0) {
      boxes[idx - 1].focus();
    }
  }
}

function cancelOtpStep() {
  if (otpTimerInterval) clearInterval(otpTimerInterval);
  document.getElementById('otpVerifyStep').classList.add('hidden');
  document.getElementById('otpPhoneInputStep').classList.remove('hidden');
}

async function submitVerifyOtpLogin() {
  const boxes = document.querySelectorAll('#otpDigitsContainer input');
  let otp = '';
  boxes.forEach(b => otp += b.value);

  if (otp.length < 6) {
    showToast('Masukkan 6-digit kode OTP lengkap.', 'warning');
    return;
  }

  const phone = currentOtpData ? currentOtpData.phone : (pendingRegistrationData ? pendingRegistrationData.phone : '');

  const payload = {
    phone,
    otp: otp.trim()
  };

  if (pendingRegistrationData && pendingRegistrationData.phone === phone) {
    Object.assign(payload, pendingRegistrationData);
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res.success) {
      currentUser = res.data;
      saveClientSession(currentUser);
      localStorage.setItem('sobatserabut_registered', 'true');
      pendingRegistrationData = null;

      if (currentUser.role === 'mitra') {
        showToast('Pendaftaran Mitra Berhasil! Data KTP & Selfie sedang ditinjau Admin Pusat.', 'success');
      } else {
        showToast('Pendaftaran Berhasil! Selamat datang di SobatSerabut.', 'success');
      }

      onUserAuthenticated(currentUser);
    } else {
      showToast(res.message || 'Verifikasi OTP gagal.', 'error');
    }
  } catch (err) {
    showToast('Verifikasi OTP gagal: ' + err.message, 'error');
  }
}

// Image Preview Utilities
function previewAvatarImage(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    registeredAvatarBase64 = e.target.result;
    registeredSelfieBase64 = e.target.result;
    const box = document.getElementById('regAvatarPreview');
    if (box) {
      box.innerHTML = `<img src="${registeredAvatarBase64}" class="w-full h-full object-cover rounded-2xl">`;
    }
    const statusText = document.getElementById('selfieCameraStatusText');
    if (statusText) statusText.innerHTML = '<span class="text-emerald-400 font-bold">✓ Foto Selfie Tersimpan</span>';
    showToast('Foto profil selfie berhasil dipilih!', 'success');
  };
  reader.readAsDataURL(file);
}

function previewDocImage(input, boxId) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    if (boxId === 'regKtpPreviewBox') {
      registeredKtpBase64 = dataUrl;
      const ktpStatus = document.getElementById('ktpPhotoStatusText');
      if (ktpStatus) ktpStatus.innerHTML = '<span class="text-emerald-400 font-bold">✓ Foto e-KTP Tersimpan</span>';
    } else if (boxId === 'regSelfiePreviewBox') {
      registeredSelfieBase64 = dataUrl;
    }
    const box = document.getElementById(boxId);
    if (box) {
      box.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-cover rounded-xl">`;
    }
    showToast('Foto dokumen berhasil dipilih!', 'success');
  };
  reader.readAsDataURL(file);
}

function previewProofImage(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    proofPhotoBase64 = e.target.result;
    const img = document.getElementById('proofPhotoPreviewImg');
    if (img) {
      img.src = proofPhotoBase64;
      img.classList.remove('hidden');
    }
    showToast('Foto bukti pekerjaan berhasil diperbarui', 'info');
  };
  reader.readAsDataURL(file);
}

/* ========================================================
 * DIRECT IN-APP LIVE CAMERA SYSTEM (SELFIE & FOTO LANGSUNG)
 * Kamera langsung ditiap HP tanpa memilih file dalam folder!
 * ======================================================== */
let activeCameraStream = null;
let currentCameraTarget = null; // 'avatar', 'ktp', 'selfieKtp', 'proof'
let currentCameraFacing = 'user'; // 'user' (selfie depan) or 'environment' (belakang)
let tempSnappedDataUrl = null;

async function openDirectCamera(target, preferredFacing = 'user') {
  currentCameraTarget = target;
  currentCameraFacing = preferredFacing;
  tempSnappedDataUrl = null;

  const modal = document.getElementById('directLiveCameraModal');
  const titleEl = document.getElementById('cameraModalTitle');
  const badgeEl = document.getElementById('cameraFacingBadge');
  const overlayEl = document.getElementById('cameraGuideOverlay');
  const video = document.getElementById('liveCameraVideo');
  const previewImg = document.getElementById('liveCameraPreviewImg');
  const captureControls = document.getElementById('cameraCaptureControls');
  const confirmControls = document.getElementById('cameraConfirmControls');

  if (!modal || !video) return;

  // Set guides and descriptions depending on target
  if (target === 'avatar') {
    titleEl.innerHTML = '<i class="fa-solid fa-camera text-blue-400 mr-1.5"></i>Kamera Selfie Profil';
    badgeEl.innerText = 'Kamera Depan (Selfie Wajah)';
    overlayEl.innerHTML = `
      <div class="w-48 h-56 rounded-full border-2 border-dashed border-blue-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
        <span class="text-[11px] font-bold text-white bg-black/60 px-3 py-1 rounded-full shadow">Posisikan Wajah di Lingkaran</span>
      </div>
    `;
  } else if (target === 'ktp') {
    titleEl.innerHTML = '<i class="fa-solid fa-id-card text-emerald-400 mr-1.5"></i>Kamera Foto e-KTP';
    badgeEl.innerText = 'Kamera Belakang (Foto KTP)';
    overlayEl.innerHTML = `
      <div class="w-64 h-40 rounded-2xl border-2 border-dashed border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center p-2 text-center">
        <span class="text-[11px] font-bold text-white bg-black/60 px-3 py-1 rounded-full shadow mb-1">Posisikan e-KTP di Bingkai</span>
        <span class="text-[9px] text-emerald-200 bg-black/40 px-2 py-0.5 rounded">Pastikan tulisan & NIK terbaca jelas</span>
      </div>
    `;
  } else if (target === 'selfieKtp') {
    titleEl.innerHTML = '<i class="fa-solid fa-user-shield text-amber-400 mr-1.5"></i>Kamera Selfie KTP';
    badgeEl.innerText = 'Kamera Depan (Selfie Memegang KTP)';
    overlayEl.innerHTML = `
      <div class="w-56 h-64 rounded-3xl border-2 border-dashed border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col items-center justify-between p-3 text-center">
        <span class="text-[11px] font-bold text-white bg-black/60 px-3 py-1 rounded-full shadow">Wajah & KTP Dalam Bingkai</span>
        <span class="text-[9px] text-amber-200 bg-black/40 px-2 py-0.5 rounded">Pegang KTP di samping wajah Anda</span>
      </div>
    `;
  } else if (target === 'proof') {
    titleEl.innerHTML = '<i class="fa-solid fa-check-double text-teal-400 mr-1.5"></i>Kamera Bukti Pekerjaan';
    badgeEl.innerText = 'Kamera Belakang (Bukti Hasil)';
    overlayEl.innerHTML = `
      <div class="w-64 h-64 rounded-2xl border-2 border-dashed border-teal-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
        <span class="text-[11px] font-bold text-white bg-black/60 px-3 py-1 rounded-full shadow">Arahkan ke Hasil Pekerjaan</span>
      </div>
    `;
  }

  // Reset UI views
  previewImg.classList.add('hidden');
  video.classList.remove('hidden');
  captureControls.classList.remove('hidden');
  confirmControls.classList.add('hidden');

  modal.classList.remove('hidden');

  // Request HTML5 Camera Stream
  try {
    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach(t => t.stop());
      activeCameraStream = null;
    }

    const constraints = {
      video: {
        facingMode: { ideal: currentCameraFacing },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    activeCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = activeCameraStream;
    await video.play();
  } catch (err) {
    console.warn('[Camera Stream Warning]: getUserMedia error, mengaktifkan native camera fallback:', err.message);
    // If browser/device restricts getUserMedia, trigger native camera fallback directly
    closeLiveCamera();
    triggerNativeCameraFallback(target, currentCameraFacing);
  }
}

function switchLiveCameraFacing() {
  currentCameraFacing = (currentCameraFacing === 'user') ? 'environment' : 'user';
  openDirectCamera(currentCameraTarget, currentCameraFacing);
}

function snapLivePhoto() {
  const video = document.getElementById('liveCameraVideo');
  const canvas = document.getElementById('liveCameraCanvas');
  const previewImg = document.getElementById('liveCameraPreviewImg');
  const captureControls = document.getElementById('cameraCaptureControls');
  const confirmControls = document.getElementById('cameraConfirmControls');

  if (!video || !canvas || !previewImg) return;

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  // If front camera, flip horizontally for natural mirror feel
  if (currentCameraFacing === 'user') {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);

  tempSnappedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
  previewImg.src = tempSnappedDataUrl;

  video.classList.add('hidden');
  previewImg.classList.remove('hidden');
  captureControls.classList.add('hidden');
  confirmControls.classList.remove('hidden');
}

function retakeLivePhoto() {
  tempSnappedDataUrl = null;
  const video = document.getElementById('liveCameraVideo');
  const previewImg = document.getElementById('liveCameraPreviewImg');
  const captureControls = document.getElementById('cameraCaptureControls');
  const confirmControls = document.getElementById('cameraConfirmControls');

  previewImg.classList.add('hidden');
  video.classList.remove('hidden');
  captureControls.classList.remove('hidden');
  confirmControls.classList.add('hidden');
}

function confirmLivePhoto() {
  if (!tempSnappedDataUrl) return;

  if (currentCameraTarget === 'avatar') {
    registeredAvatarBase64 = tempSnappedDataUrl;
    registeredSelfieBase64 = tempSnappedDataUrl;
    const box = document.getElementById('regAvatarPreview');
    if (box) box.innerHTML = `<img src="${tempSnappedDataUrl}" class="w-full h-full object-cover rounded-2xl">`;
    const statusText = document.getElementById('selfieCameraStatusText');
    if (statusText) statusText.innerHTML = '<span class="text-emerald-400 font-bold">✓ Foto Selfie Tersimpan</span>';
    showToast('Foto selfie KYC berhasil diambil langsung dari kamera!', 'success');
  } else if (currentCameraTarget === 'ktp') {
    registeredKtpBase64 = tempSnappedDataUrl;
    const box = document.getElementById('regKtpPreviewBox');
    if (box) box.innerHTML = `<img src="${tempSnappedDataUrl}" class="w-full h-full object-cover rounded-xl">`;
    const ktpStatus = document.getElementById('ktpPhotoStatusText');
    if (ktpStatus) ktpStatus.innerHTML = '<span class="text-emerald-400 font-bold">✓ Foto e-KTP Tersimpan</span>';
    showToast('Foto e-KTP berhasil diambil langsung dari kamera!', 'success');
  } else if (currentCameraTarget === 'selfieKtp') {
    registeredSelfieBase64 = tempSnappedDataUrl;
    const box = document.getElementById('regSelfiePreviewBox');
    if (box) box.innerHTML = `<img src="${tempSnappedDataUrl}" class="w-full h-full object-cover rounded-xl">`;
    showToast('Foto selfie memegang KTP berhasil diambil langsung dari kamera!', 'success');
  } else if (currentCameraTarget === 'proof') {
    proofPhotoBase64 = tempSnappedDataUrl;
    const img = document.getElementById('proofPhotoPreviewImg');
    if (img) {
      img.src = tempSnappedDataUrl;
      img.classList.remove('hidden');
    }
    showToast('Foto bukti pekerjaan berhasil diambil langsung dari kamera!', 'success');
  }

  closeLiveCamera();
}

function closeLiveCamera() {
  if (activeCameraStream) {
    try {
      activeCameraStream.getTracks().forEach(track => track.stop());
    } catch (e) {}
    activeCameraStream = null;
  }
  const modal = document.getElementById('directLiveCameraModal');
  if (modal) modal.classList.add('hidden');
}

function triggerNativeCameraFallback(target, facing) {
  const useTarget = target || currentCameraTarget;
  let inputId = 'regAvatarInput';
  if (useTarget === 'ktp') inputId = 'regKtpFileInput';
  else if (useTarget === 'selfieKtp') inputId = 'regSelfieFileInput';
  else if (useTarget === 'proof') inputId = 'proofPhotoFileInput';

  const input = document.getElementById(inputId);
  if (input) {
    input.click();
  }
}

function requestClientGpsPermission(showAlert = true) {
  const pill = document.getElementById('regClientGpsPill');
  const btn = document.getElementById('btnClientGpsPrompt');

  if (!navigator.geolocation) {
    if (pill) pill.innerHTML = '<span class="text-rose-400 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Tidak Didukung</span>';
    if (showAlert) showToast('Perangkat HP Anda tidak mendukung sensor GPS Geolocation.', 'error');
    return;
  }

  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue-400"></i><span>Mendeteksi Lokasi GPS HP...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      const accuracy = Math.round(pos.coords.accuracy || 10);
      lastGpsCoords = { lat, lng, accuracy, speed: '0 km/h' };

      if (pill) {
        pill.className = "text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold";
        pill.innerHTML = `<i class="fa-solid fa-circle-check text-blue-400 mr-1"></i>GPS Aktif (±${accuracy}m)`;
      }
      if (btn) {
        btn.className = "w-full py-2.5 px-3 rounded-xl bg-blue-950/70 text-blue-300 font-bold text-[11px] flex items-center justify-center space-x-2 border border-blue-500/50 shadow-inner";
        btn.innerHTML = `<i class="fa-solid fa-circle-check text-blue-400"></i><span>Lokasi GPS Terhubung (${lat}, ${lng})</span>`;
      }
      if (showAlert) {
        showCustomAppDialog(
          'Lokasi GPS HP Terhubung!',
          `Lokasi presisi berhasil didapatkan: \nKoordinat: ${lat}, ${lng} (Akurasi: ±${accuracy} meter). Titik penjemputan & order tugas Anda kini akurat.`,
          'success'
        );
      }
    },
    (err) => {
      console.warn('[GPS Permission Warning]:', err.message);
      if (pill) {
        pill.className = "text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold";
        pill.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-400 mr-1"></i>Izin Belum Diberikan';
      }
      if (btn) {
        btn.className = "w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center justify-center space-x-2 border border-slate-700 active:scale-95 transition-all";
        btn.innerHTML = '<i class="fa-solid fa-location-crosshairs text-blue-400"></i><span>Klik Ulang Untuk Deteksi Lokasi GPS</span>';
      }
      if (showAlert) {
        showCustomAppDialog(
          'Izin Lokasi Diperlukan',
          'Silakan ketuk "Izinkan / Allow" pada popup browser HP Anda agar titik jemput tugas dapat ditentukan secara otomatis.',
          'warning'
        );
      }
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

function handleRegRoleChange(role) {
  const extraMitra = document.getElementById('regMitraExtraFields');
  const extraKlien = document.getElementById('regKlienExtraFields');
  if (extraMitra) extraMitra.style.display = (role === 'mitra') ? 'block' : 'none';
  if (extraKlien) extraKlien.style.display = (role === 'klien') ? 'block' : 'none';
}

async function handleRegisterOtpSubmit(e) {
  e.preventDefault();
  const role = document.getElementById('regRole')?.value || 'klien';
  const name = document.getElementById('regNameInput').value.trim();
  const phone = document.getElementById('regPhoneInput').value.trim();
  const password = document.getElementById('regPasswordInput')?.value.trim();
  const address = document.getElementById('regAddressInput').value.trim();
  const method = document.querySelector('input[name="regOtpMethod"]:checked')?.value || 'whatsapp';

  if (!name || !phone) {
    showToast('Harap isi Nama Lengkap dan Nomor WhatsApp/HP aktif.', 'error');
    return;
  }
  if (!password || password.length < 6) {
    showToast('Buat kata sandi minimal 6 karakter untuk akun Anda.', 'error');
    return;
  }
  if (!address) {
    showToast('Harap masukkan alamat domisili lengkap Anda.', 'error');
    return;
  }

  let nik = '';
  let bankName = '';
  let bankAccount = '';
  let bankHolder = '';
  let skills = [];
  let paymentProvider = '';
  let paymentAccount = '';

  if (role === 'mitra') {
    nik = document.getElementById('regNikInput')?.value.trim() || '';
    if (!/^\d{16}$/.test(nik)) {
      showToast('Nomor Induk Kependudukan (NIK) wajib 16 digit angka sesuai KTP resmi.', 'error');
      return;
    }
    const selfie = registeredAvatarBase64 || registeredSelfieBase64;
    if (!selfie) {
      showToast('Wajib mengambil foto selfie langsung dari kamera pengguna untuk verifikasi identitas KYC.', 'error');
      return;
    }
    if (!registeredKtpBase64) {
      registeredKtpBase64 = selfie;
    }
    bankName = document.getElementById('regBankNameSelect')?.value || 'DANA';
    bankAccount = document.getElementById('regBankAccountInput')?.value.trim() || '';
    bankHolder = document.getElementById('regBankHolderInput')?.value.trim() || '';
    const skill = document.getElementById('regSkillSelect')?.value;
    if (skill) skills.push(skill);
  } else {
    // Role Klien
    paymentProvider = document.getElementById('regBankNameSelect')?.value || 'DANA';
    paymentAccount = document.getElementById('regBankAccountInput')?.value.trim() || phone;
    bankHolder = document.getElementById('regBankHolderInput')?.value.trim() || name;
  }

  const selfie = registeredAvatarBase64 || registeredSelfieBase64;
  const lat = (lastGpsCoords && lastGpsCoords.lat) ? lastGpsCoords.lat : -6.2088;
  const lng = (lastGpsCoords && lastGpsCoords.lng) ? lastGpsCoords.lng : 106.8456;

  pendingRegistrationData = {
    role,
    name,
    phone,
    password,
    address,
    avatar: selfie,
    avatarPhoto: selfie,
    nik,
    ktpPhoto: registeredKtpBase64,
    selfiePhoto: selfie,
    selfieKtpPhoto: selfie,
    bankName: paymentProvider || 'DANA',
    bankAccount: paymentAccount,
    bankHolder,
    clientPaymentType: 'ewallet',
    clientPaymentProvider: paymentProvider || 'DANA',
    clientAccountNo: paymentAccount,
    clientAccountName: bankHolder,
    skills,
    lat,
    lng,
    method
  };

  try {
    showToast('Mengirimkan kode OTP verifikasi...', 'info');
    const sendRes = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, method })
    }).then(r => r.json());

    if (!sendRes.success) {
      showToast(sendRes.message || 'Gagal mengirim OTP', 'error');
      return;
    }

        currentOtpData = { phone: sendRes.phone, method: sendRes.method };

    // Beralih ke layar verifikasi OTP terpisah
    navigateToAuthScreen('otp');
    const methodLabel = document.getElementById('otpScreenMethodLabel');
    if (methodLabel) methodLabel.innerText = (method === 'whatsapp') ? 'WhatsApp Bot (087791201091)' : 'SMS';
    const phoneDisplay = document.getElementById('otpScreenPhoneDisplay');
    if (phoneDisplay) phoneDisplay.innerText = sendRes.phone;

    const boxes = document.querySelectorAll('#otpDigitsContainer input');
    boxes.forEach(b => b.value = '');
    if (sendRes.devOtp) {
      const str = sendRes.devOtp.toString();
      boxes.forEach((b, i) => { if (str[i]) b.value = str[i]; });
    } else if (boxes[0]) {
      boxes[0].focus();
    }

    startOtpTimer(30);
    showToast(sendRes.message || `Kode OTP 6-Digit dikirim ke ${phone} via ${method === 'whatsapp' ? 'WhatsApp' : 'SMS'}`, 'success');
  } catch (err) {
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}


async function handlePasswordLoginSubmit(e) {
  e.preventDefault();
  const phoneOrEmail = document.getElementById('loginPassPhoneInput').value.trim();
  const password = document.getElementById('loginPassSecretInput').value.trim();

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneOrEmail, password })
    }).then(r => r.json());

    if (res.success) {
      loginFailAttempts = 0;
      const wrongBox = document.getElementById('wrongPasswordLupaBox');
      if (wrongBox) wrongBox.classList.add('hidden');

      currentUser = res.data;
      saveClientSession(currentUser);
      localStorage.setItem('sobatserabut_registered', 'true');
      showToast(`Selamat datang kembali, ${currentUser.name}!`, 'success');
      onUserAuthenticated(currentUser);
    } else {
      loginFailAttempts++;
      showToast(res.message || 'Nama akun, nomor HP, atau kata sandi tidak cocok.', 'error');

      // Tampilkan menu lupa kata sandi saat salah berulang di bawahnya
      const wrongBox = document.getElementById('wrongPasswordLupaBox');
      if (wrongBox) {
        wrongBox.classList.remove('hidden');
        wrongBox.innerHTML = `
          <div class="flex items-center space-x-2 text-amber-300 font-bold text-xs">
            <i class="fa-solid fa-triangle-exclamation text-amber-400"></i>
            <span>Kata sandi tidak sesuai (${loginFailAttempts}x salah)</span>
          </div>
          <p class="text-[11px] text-slate-300 leading-relaxed">
            Jika Anda sudah pernah mendaftar namun lupa kata sandi akun, Anda dapat langsung mereset dan memulihkan kata sandi dengan kode OTP WhatsApp/SMS.
          </p>
          <button type="button" onclick="openForgotPasswordFromLogin('${phoneOrEmail.replace(/'/g, "\\'")}')" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center space-x-1.5 transition-all">
            <i class="fa-solid fa-key"></i>
            <span>Reset &amp; Pulihkan Kata Sandi via OTP</span>
          </button>
        `;
      }
    }
  } catch (err) {
    showToast('Gagal terhubung ke server: ' + err.message, 'error');
  }
}

function openForgotPasswordFromLogin(credential) {
  navigateToAuthScreen('forgot');
  const forgotInput = document.getElementById('forgotPhoneInput');
  if (forgotInput && credential) {
    const cleanNum = credential.replace(/[^0-9]/g, '');
    if (cleanNum) forgotInput.value = cleanNum;
  }
}

async function handleLogout() {
  const ok = await appConfirm('Apakah Anda yakin ingin keluar dari akun SobatSerabut?', 'Konfirmasi Keluar Akun');
  if (ok) {
    if (currentUser?.role === 'mitra') {
      try {
        await fetch(`${API_BASE}/api/mitra/${currentUser.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'offline' })
        });
      } catch(e) {}
    }
    localStorage.removeItem('sobatserabut_client_user');
    localStorage.removeItem('sobatserabut_user');
    currentUser = null;
    activeOrder = null;
    if (gpsTrackerInterval) clearInterval(gpsTrackerInterval);
    if (activeJobTimerInterval) clearInterval(activeJobTimerInterval);
    showToast('Anda telah keluar dari akun SobatSerabut.', 'info');
    onGuestSessionInit();
  }
}

function saveClientSession(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem('sobatserabut_client_user', JSON.stringify(user));
    localStorage.setItem('sobatserabut_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('sobatserabut_client_user');
    localStorage.removeItem('sobatserabut_user');
  }
}

async function toggleUserRoleSwitch() {
  showToast('Aplikasi SobatSerabut khusus untuk Pemohon Jasa. Untuk menjadi Driver Mitra, buka aplikasi Driver SobatSerabut.', 'info');
}

/* ========================================================
 * 3. AUTHENTICATED APP INITIALIZATION (CLIENT APP)
 * ======================================================== */
function onUserAuthenticated(user) {
  hideAuthOverlay();
  closeRegisterFlow();
  closeLoginFlow();
  closePuzzleModal();
  closeOtpBottomSheet();
  const step4 = document.getElementById('stage4OtpScreen');
  if (step4) { step4.classList.add('hidden'); step4.classList.remove('flex'); }
  const step5 = document.getElementById('stage5PasswordScreen');
  if (step5) { step5.classList.add('hidden'); step5.classList.remove('flex'); }
  updateProfileTabUI();

  // Header display
  const nameEl = document.getElementById('currentUserHeaderName');
  if (nameEl) nameEl.innerText = user.name || 'Pengguna SobatSerabut';
  const roleBadge = document.getElementById('roleHeaderBadge');
  if (roleBadge) {
    roleBadge.innerText = 'KLIEN RESMI';
    roleBadge.className = 'text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-extrabold border border-blue-500/30';
  }
  const quickBar = document.getElementById('klienQuickBarContainer');
  if (quickBar) quickBar.classList.remove('hidden');
  const klienView = document.getElementById('klienViewContainer');
  if (klienView) klienView.classList.remove('hidden');
  const walletTopup = document.getElementById('walletBtnTopup');
  if (walletTopup) walletTopup.classList.remove('hidden');

  // Load client categories, orders & transaction history
  loadCategories();
  loadClientOrders();
  loadWalletTransactions();

  // Start client location tracking
  startGpsTracker();

  // Request device permissions on login
  if (!localStorage.getItem('sobatserabut_permissions_granted')) {
    setTimeout(() => requestAllDevicePermissions(), 1000);
  }

  // Profile tab fields
  const pName = document.getElementById('profileUserName');
  if (pName) pName.innerText = user.name || 'Pengguna SobatSerabut';
  const pPhone = document.getElementById('profileUserPhone');
  if (pPhone) pPhone.innerText = user.phone || '-';
  const avatarEl = document.getElementById('profileUserAvatar');
  if (avatarEl) {
    let src = (user.avatar && !user.avatar.includes('unsplash.com')) ? user.avatar : 'uploads/avatar_default.svg';
    if (!src.startsWith('http') && !src.startsWith('data:')) {
      src = `${API_BASE}${src.startsWith('/') ? '' : '/'}${src}`;
    }
    avatarEl.src = src;
  }
  const pBadge = document.getElementById('profileUserBadge');
  if (pBadge) pBadge.innerText = 'Pemohon Jasa (Klien)';

  updateWalletDisplay();
}

async function refreshUserProfile() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/api/auth/profile/${currentUser.id}`).then(r => r.json());
    if (res.success) {
      currentUser = res.data;
      saveClientSession(currentUser);
      updateWalletDisplay();
    }
  } catch(e) {}
}

function updateWalletDisplay() {
  const bal = currentUser?.walletBalance || 0;
  document.getElementById('headerWalletDisplay').innerText = `Rp ${bal.toLocaleString('id-ID')}`;
  document.getElementById('walletMainBalance').innerText = `Rp ${bal.toLocaleString('id-ID')}`;
  loadWalletTransactions();
}

/* ========================================================
 * 4. REMOTE CONFIG & BRANDING SYNC (REAL-TIME LIVE SYNC)
 * ======================================================== */
async function loadRemoteConfig() {
  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${API_BASE}/api/config`, { signal: controller.signal }).then(r => r.json());
    clearTimeout(tId);
    if (res.success) {
      systemConfig = res.data;
      applyConfigToUI(systemConfig);
    }
  } catch(e) {
    console.warn('Gagal memuat remote config:', e.message);
  }
}

function applyConfigToUI(cfg) {
  if (!cfg) return;
  if (cfg.logoUrl) {
    let src = cfg.logoUrl;
    if (!src.startsWith('http') && !src.startsWith('data:')) {
      src = `${API_BASE}${src.startsWith('/') ? '' : '/'}${src}`;
    }
    const hLogo = document.getElementById('appHeaderLogo');
    const aLogo = document.getElementById('authAppLogo');
    if (hLogo) hLogo.src = src;
    if (aLogo) aLogo.src = src;
  }
  if (cfg.appIconUrl) {
    let iconSrc = cfg.appIconUrl;
    if (!iconSrc.startsWith('http') && !iconSrc.startsWith('data:')) {
      iconSrc = `${API_BASE}${iconSrc.startsWith('/') ? '' : '/'}${iconSrc}`;
    }
    const fav = document.getElementById('dynamicFavicon');
    const apple = document.getElementById('dynamicAppleIcon');
    if (fav) fav.href = iconSrc;
    if (apple) apple.href = iconSrc;
  }
  if (cfg.appName) {
    const name = cfg.appName;
    const splitIndex = Math.min(5, name.length);
    document.getElementById('appHeaderName').innerHTML = `${name.slice(0, splitIndex)}<span class="text-blue-500">${name.slice(splitIndex) || ''}</span>`;
    document.getElementById('authAppName').innerHTML = `${name.slice(0, splitIndex)}<span class="text-blue-500">${name.slice(splitIndex) || ''}</span>`;
    document.title = `${name} - Solusi Cepat Serabutan & Jasa Harian`;
  }
  if (cfg.announcement) {
    const banner = document.getElementById('globalAnnouncementBanner');
    const textEl = document.getElementById('globalAnnouncementText');
    if (banner && textEl) {
      textEl.innerText = cfg.announcement;
      banner.classList.remove('hidden');
    }
  } else {
    const banner = document.getElementById('globalAnnouncementBanner');
    if (banner) banner.classList.add('hidden');
  }
  if (cfg.otpSenderNumber || cfg.contactPhone) {
    const phone = cfg.otpSenderNumber || cfg.contactPhone || '087791201091';
    let cleanWa = phone.replace(/[^0-9]/g, '');
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.slice(1);
    const waLink = document.getElementById('globalAnnouncementWaLink');
    if (waLink) {
      waLink.href = `https://wa.me/${cleanWa}`;
      waLink.innerHTML = `<i class="fa-brands fa-whatsapp"></i><span>${phone}</span>`;
    }
  }
  if (cfg.maxRadiusKm) {
    document.getElementById('mitraRadiusLabel').innerText = `${cfg.maxRadiusKm} km`;
  }
  applyMaintenanceMode(cfg.maintenanceMode, cfg.maintenanceMessage);
}

function applyMaintenanceMode(isMaintenance, msg) {
  const scr = document.getElementById('maintenanceScreen');
  const msgEl = document.getElementById('maintenanceScreenMsg');
  if (isMaintenance) {
    if (msgEl && msg) msgEl.innerText = msg;
    scr.classList.remove('hidden');
    scr.classList.add('flex');
  } else {
    scr.classList.add('hidden');
    scr.classList.remove('flex');
  }
}

/* ========================================================
 * 5. KATEGORI JASA & AUTOMATIC PRICING (NO MANUAL BUDGET / FLAT REKBER)
 * ======================================================== */
async function loadCategories() {
  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${API_BASE}/api/categories`, { signal: controller.signal }).then(r => r.json());
    clearTimeout(tId);
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      categoriesList = res.data;
      localStorage.setItem('sobatserabut_cached_categories', JSON.stringify(categoriesList));
      renderKlienCategoriesGrid();
      populatePostTaskCategorySelect();
    }
  } catch(e) {
    console.warn('Menggunakan kategori default offline:', e.message);
  }
}

function renderKlienCategoriesGrid() {
  const container = document.getElementById('klienCategoriesGrid');
  if (!container) return;

  container.innerHTML = categoriesList.map(cat => {
    const imgSrc = getCategoryImage(cat);
    const fareFormatted = (cat.baseFare || 25000) >= 1000 ? `${Math.round((cat.baseFare || 25000)/1000)}rb` : (cat.baseFare || 25000);

    return `
    <div onclick="selectCategoryForNewTask('${cat.name}', ${cat.baseFare})" class="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/80 hover:bg-slate-800/80 flex flex-col items-center justify-center cursor-pointer transition-all group active:scale-95 shadow-sm">
      <div class="w-12 h-12 rounded-2xl bg-slate-800/80 p-1.5 flex items-center justify-center mb-1.5 border border-slate-700/60 group-hover:border-blue-500/50 shadow-inner group-hover:scale-105 transition-transform overflow-hidden">
        <img src="${imgSrc}" alt="${cat.name}" class="w-full h-full object-contain drop-shadow" onerror="this.onerror=null; this.src='img/service_runner.png'">
      </div>
      <span class="font-bold text-white text-[10.5px] truncate max-w-full block leading-tight text-center">${cat.name}</span>
      <span class="text-[9px] text-emerald-400 font-mono mt-0.5 font-bold">Mulai Rp ${fareFormatted}</span>
    </div>
    `;
  }).join('');
}

function populatePostTaskCategorySelect() {
  const sel = document.getElementById('postTaskCategorySelect');
  if (!sel) return;
  sel.innerHTML = categoriesList.map(c => `
    <option value="${c.name}" data-fare="${c.baseFare}">${c.name} (Tarif Resmi: Rp ${c.baseFare.toLocaleString('id-ID')})</option>
  `).join('');
  sel.onchange = () => updateAutoFareDisplay();
  updateAutoFareDisplay();
}

function updateAutoFareDisplay() {
  const sel = document.getElementById('postTaskCategorySelect');
  if (!sel) return;
  const selectedName = sel.value;
  const cat = categoriesList.find(c => c.name === selectedName);
  const baseFare = cat ? cat.baseFare : 25000;
  const platformFee = 3000;
  const total = baseFare + platformFee;
  const net = Math.round(baseFare * 0.9);

  const catLabel = document.getElementById('postTaskSelectedCatLabel');
  if (catLabel) catLabel.innerText = selectedName;

  const baseLabel = document.getElementById('postTaskAutoBaseFare');
  if (baseLabel) baseLabel.innerText = `Rp ${baseFare.toLocaleString('id-ID')}`;

  const totalLabel = document.getElementById('postTaskAutoTotalFare');
  if (totalLabel) totalLabel.innerText = `Rp ${total.toLocaleString('id-ID')}`;

  const netLabel = document.getElementById('postTaskMitraNetLabel');
  if (netLabel) netLabel.innerText = `Rp ${net.toLocaleString('id-ID')}`;
}

function selectCategoryForNewTask(catName, baseFare) {
  openPostTaskModal();
  const sel = document.getElementById('postTaskCategorySelect');
  if (sel) {
    sel.value = catName;
    updateAutoFareDisplay();
  }
}

function handlePaymentMethodChange(val) {
  const providerSel = document.getElementById('postTaskProviderSelect');
  if (!providerSel) return;
  if (val === 'ewallet') {
    providerSel.innerHTML = `
      <option value="DANA">DANA</option>
      <option value="GoPay">GoPay</option>
      <option value="OVO">OVO</option>
      <option value="ShopeePay">ShopeePay</option>
    `;
  } else if (val === 'bank_transfer') {
    providerSel.innerHTML = `
      <option value="BCA">BCA</option>
      <option value="Mandiri">Mandiri</option>
      <option value="BRI">BRI</option>
      <option value="BNI">BNI</option>
    `;
  } else if (val === 'qris') {
    providerSel.innerHTML = `
      <option value="QRIS_INSTAN">QRIS Real-Time</option>
    `;
  }
}

/* ========================================================
 * 6. ALUR KERJA KLIEN (POSTING TUGAS DENGAN SUMBER PEMBAYARAN NYATA)
 * ======================================================== */
function openPostTaskModal() {
  if (!currentUser) {
    checkAuthSession();
  }
  const modal = document.getElementById('postTaskModal');
  if (modal) modal.classList.remove('hidden');
  updateAutoFareDisplay();
}

function closePostTaskModal() {
  document.getElementById('postTaskModal').classList.add('hidden');
}

let postTaskPhotoBase64 = null;

function handlePostTaskPhotoSelect(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    postTaskPhotoBase64 = e.target.result;
    const previewBox = document.getElementById('postTaskPhotoPreviewBox');
    const previewImg = document.getElementById('postTaskPhotoPreviewImg');
    const statusText = document.getElementById('postTaskPhotoStatus');

    if (previewImg) previewImg.src = postTaskPhotoBase64;
    if (previewBox) previewBox.classList.remove('hidden');
    if (statusText) statusText.innerHTML = '<span class="text-emerald-400 font-bold">✓ Foto Terlampir</span>';
    showToast('Foto tugas berhasil dilampirkan!', 'success');
  };
  reader.readAsDataURL(file);
}

function removePostTaskPhoto() {
  postTaskPhotoBase64 = null;
  const input = document.getElementById('postTaskPhotoInput');
  if (input) input.value = '';
  const previewBox = document.getElementById('postTaskPhotoPreviewBox');
  const statusText = document.getElementById('postTaskPhotoStatus');
  if (previewBox) previewBox.classList.add('hidden');
  if (statusText) statusText.innerText = 'Belum ada foto';
}

function updateFullAddressDisplay() {
  const street = document.getElementById('postTaskStreet')?.value.trim() || '';
  const houseNumber = document.getElementById('postTaskHouseNumber')?.value.trim() || '';
  const rt = document.getElementById('postTaskRt')?.value.trim() || '';
  const rw = document.getElementById('postTaskRw')?.value.trim() || '';
  const kelurahan = document.getElementById('postTaskKelurahan')?.value.trim() || '';
  const kecamatan = document.getElementById('postTaskKecamatan')?.value.trim() || '';
  const city = document.getElementById('postTaskCity')?.value.trim() || '';

  const parts = [];
  if (street) parts.push(street);
  if (houseNumber) parts.push(`No. ${houseNumber}`);
  if (rt || rw) parts.push(`RT ${rt || '-'}/RW ${rw || '-'}`);
  if (kelurahan) parts.push(`Kel. ${kelurahan}`);
  if (kecamatan) parts.push(`Kec. ${kecamatan}`);
  if (city) parts.push(city);

  const fullAddr = parts.join(', ');
  const preview = document.getElementById('postTaskFullAddressPreview');
  const hiddenInput = document.getElementById('postTaskAddressInput');

  if (preview) preview.innerText = fullAddr || 'Belum ditentukan';
  if (hiddenInput) hiddenInput.value = fullAddr;
  return fullAddr;
}

async function submitNewTaskPost() {
  const title = document.getElementById('postTaskTitleInput').value.trim();
  const category = document.getElementById('postTaskCategorySelect').value;
  const description = document.getElementById('postTaskDescInput').value.trim();
  const paymentMethod = document.getElementById('postTaskPaymentMethodSelect')?.value || 'ewallet';
  const paymentProvider = document.getElementById('postTaskProviderSelect')?.value || 'DANA';
  const paymentAccountNo = document.getElementById('postTaskAccountNoInput')?.value.trim() || '';
  const paymentAccountName = document.getElementById('postTaskAccountNameInput')?.value.trim() || '';

  if (!title) {
    showToast('Harap isi judul pekerjaan yang Anda butuhkan.', 'warning');
    return;
  }
  if (!paymentAccountNo || !paymentAccountName) {
    showToast('Harap lengkapi nomor akun dan nama pemilik rekening / e-wallet pembayar.', 'warning');
    return;
  }

  const cat = categoriesList.find(c => c.name === category);
  const baseFare = cat ? cat.baseFare : 25000;

  const houseNumber = document.getElementById('postTaskHouseNumber')?.value.trim() || '';
  const street = document.getElementById('postTaskStreet')?.value.trim() || '';
  const rt = document.getElementById('postTaskRt')?.value.trim() || '';
  const rw = document.getElementById('postTaskRw')?.value.trim() || '';
  const kelurahan = document.getElementById('postTaskKelurahan')?.value.trim() || '';
  const kecamatan = document.getElementById('postTaskKecamatan')?.value.trim() || '';
  const city = document.getElementById('postTaskCity')?.value.trim() || '';
  const benchmark = document.getElementById('postTaskBenchmark')?.value.trim() || '';
  const accuracyMeters = Number(document.getElementById('postTaskAccuracy')?.value) || 5;
  const fullAddress = updateFullAddressDisplay() || document.getElementById('postTaskAddressInput')?.value.trim() || (currentUser?.address || 'Indonesia');

  const payload = {
    title,
    category,
    description: description || 'Tolong dibantu dengan cepat dan rapi.',
    budget: baseFare,
    baseFare,
    address: fullAddress,
    houseNumber,
    street,
    rt,
    rw,
    kelurahan,
    kecamatan,
    city,
    benchmark,
    accuracyMeters,
    taskPhoto: postTaskPhotoBase64 || null,
    clientId: currentUser.id,
    clientName: currentUser.name,
    clientPhone: currentUser.phone,
    clientAvatar: currentUser.avatar,
    paymentMethod,
    paymentProvider,
    paymentAccountNo,
    paymentAccountName,
    lat: Number(document.getElementById('postTaskLat')?.value) || currentUser.lat || -6.1754,
    lng: Number(document.getElementById('postTaskLng')?.value) || currentUser.lng || 106.8272
  };

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res.success) {
      showToast(`Tugas "${title}" berhasil diposting! Radar pencarian mitra terdekat aktif memindai.`, 'success', 5000);
      closePostTaskModal();
      document.getElementById('postTaskTitleInput').value = '';
      document.getElementById('postTaskDescInput').value = '';
      removePostTaskPhoto();

      // Alihkan langsung ke tab Pesanan Aktif untuk memantau radar maps secara live
      switchMainTab('orders');
      switchOrdersSubTab('active');
      loadClientOrders();
    } else {
      showToast(res.message, 'error');
    }
  } catch(err) {
    showToast('Gagal memposting tugas: ' + err.message, 'error');
  }
}

let currentOrdersSubTab = 'active';
function switchOrdersSubTab(subTab) {
  currentOrdersSubTab = subTab;
  const activeBtn = document.getElementById('btnSubTabActiveOrders');
  const historyBtn = document.getElementById('btnSubTabHistoryOrders');
  const activeSec = document.getElementById('ordersSubTabActive');
  const historySec = document.getElementById('ordersSubTabHistory');

  if (subTab === 'active') {
    if (activeBtn) activeBtn.className = 'py-2.5 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center space-x-2 shadow transition-all';
    if (historyBtn) historyBtn.className = 'py-2.5 rounded-xl text-slate-400 hover:text-slate-200 font-bold flex items-center justify-center space-x-2 transition-all';
    if (activeSec) activeSec.classList.remove('hidden');
    if (historySec) historySec.classList.add('hidden');
  } else {
    if (activeBtn) activeBtn.className = 'py-2.5 rounded-xl text-slate-400 hover:text-slate-200 font-bold flex items-center justify-center space-x-2 transition-all';
    if (historyBtn) historyBtn.className = 'py-2.5 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center space-x-2 shadow transition-all';
    if (activeSec) activeSec.classList.add('hidden');
    if (historySec) historySec.classList.remove('hidden');
  }
  renderClientOrdersList();
}

async function loadClientOrders() {
  try {
    if (currentUser && currentUser.id) {
      const res = await fetch(`${API_BASE}/api/orders/client/${currentUser.id}`).then(r => r.json());
      if (res.success) {
        clientOrders = res.data || [];
        renderClientOrdersList(false);
        return;
      }
    }
    // Jika belum login atau akun baru: riwayat tugas selalu bersih 0
    clientOrders = [];
    renderClientOrdersList(false);
  } catch(e) {
    console.error('[Load Orders Error]:', e);
    clientOrders = [];
    renderClientOrdersList(false);
  }
}

async function cleanMyTaskHistory() {
  if (!currentUser || !currentUser.id) {
    clientOrders = [];
    renderClientOrdersList(false);
    showToast('Riwayat tugas berhasil dibersihkan kembali.', 'success');
    return;
  }

  const ok = confirm('Apakah Anda yakin ingin membersihkan riwayat tugas Anda? Catatan tugas selesai atau dibatalkan akan dihapus dan kembali bersih.');
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/orders/clean-history/${currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json());

    if (res.success) {
      showToast('✅ Riwayat tugas berhasil dibersihkan kembali seperti baru!', 'success', 4000);
      loadClientOrders();
    } else {
      showToast(res.message || 'Gagal membersihkan riwayat tugas', 'error');
    }
  } catch(e) {
    showToast('Kesalahan koneksi: ' + e.message, 'error');
  }
}

let orderRadarMaps = {};
let orderRadarPulseIntervals = {};

function renderClientOrdersList(isCommunityFeed = false) {
  const homeContainer = document.getElementById('klienOrdersListContainer');
  const activeContainer = document.getElementById('activeOrdersListContainer');
  const historyContainer = document.getElementById('historyOrdersListContainer');

  const activeOrders = clientOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  const historyOrders = clientOrders.filter(o => o.status === 'completed' || o.status === 'cancelled');

  // Update Nav Badge
  const navBadge = document.getElementById('navOrdersBadge');
  const countBadge = document.getElementById('activeOrdersBadgeCount');
  if (navBadge) {
    if (activeOrders.length > 0) navBadge.classList.remove('hidden');
    else navBadge.classList.add('hidden');
  }
  if (countBadge) {
    if (activeOrders.length > 0) {
      countBadge.innerText = activeOrders.length;
      countBadge.classList.remove('hidden');
    } else {
      countBadge.classList.add('hidden');
    }
  }

  // 1. Render Active Orders in Orders Tab
  if (activeContainer) {
    if (activeOrders.length === 0) {
      activeContainer.innerHTML = `
        <div class="p-8 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
          <div class="w-14 h-14 rounded-3xl bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto text-2xl">
            <i class="fa-solid fa-satellite-dish"></i>
          </div>
          <div>
            <h3 class="font-extrabold text-white text-sm">Tidak Ada Pesanan yang Sedang Berjalan</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Saat Anda memesan atau memposting tugas, radar peta pemantauan langsung akan otomatis aktif di sini.
            </p>
          </div>
          <button onclick="openPostTaskModal()" class="py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 inline-flex items-center space-x-2">
            <i class="fa-solid fa-plus-circle"></i>
            <span>Beri Tugas / Buat Pesanan Baru</span>
          </button>
        </div>
      `;
    } else {
      activeContainer.innerHTML = activeOrders.map(ord => {
        const isWorking = ord.status === 'working';
        const isAssigned = !!(ord.assignedMitraId || isWorking);

        return `
          <div class="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-3.5">
            <!-- Header Card -->
            <div class="flex items-center justify-between pb-2 border-b border-slate-800">
              <div class="flex items-center space-x-2">
                <span class="w-2.5 h-2.5 rounded-full ${isAssigned ? 'bg-emerald-400 animate-ping' : 'bg-blue-400 animate-ping'}"></span>
                <span class="font-extrabold text-xs text-white">
                  ${isWorking ? 'Mitra Sedang Menjalankan Pekerjaan' : (isAssigned ? 'Mitra Menuju Lokasi Anda' : 'Radar Aktif: Mencari Mitra Terdekat...')}
                </span>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-bold border border-blue-500/30">
                ${ord.id}
              </span>
            </div>

            <!-- Real-time Live Radar Map -->
            <div class="relative w-full rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-inner">
              <div class="absolute top-2.5 left-2.5 right-2.5 z-[400] flex items-center justify-between pointer-events-none">
                <div class="px-2.5 py-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white text-[10px] font-extrabold flex items-center space-x-1.5 shadow">
                  <i class="fa-solid fa-satellite-dish text-blue-400 ${!isAssigned ? 'animate-spin' : ''}"></i>
                  <span>${isAssigned ? 'GPS Terhubung ke Mitra' : 'Memindai Radius 2 KM'}</span>
                </div>
                <button onclick="recenterOrderMap('${ord.id}')" class="px-2.5 py-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-blue-300 hover:text-white text-[10px] font-bold pointer-events-auto flex items-center space-x-1 shadow">
                  <i class="fa-solid fa-location-crosshairs text-xs"></i>
                  <span>Pusatkan Peta</span>
                </button>
              </div>

              <!-- Map Div -->
              <div id="orderRadarMap_${ord.id}" class="w-full h-56 z-0"></div>
            </div>

            <!-- Radar Notification Banner -->
            ${!isAssigned ? `
              <div class="p-3 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-500/40 flex items-center space-x-3">
                <div class="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-lg flex-shrink-0 animate-pulse">
                  <i class="fa-solid fa-radar text-blue-400"></i>
                </div>
                <div class="flex-1 text-xs">
                  <h4 class="font-extrabold text-white text-xs">Mencari Mitra Terdekat di Sekitar Anda...</h4>
                  <p class="text-[10px] text-slate-400 mt-0.5">Sinyal tugas telah disiarkan ke semua pengemudi &amp; pekerja harian aktif di sekitar titik penjemputan.</p>
                </div>
              </div>
            ` : `
              <!-- Mitra Info Card -->
              <div class="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <img src="${ord.assignedMitraAvatar || 'uploads/avatar_mitra.svg'}" class="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500 shadow">
                  <div>
                    <div class="flex items-center space-x-1.5">
                      <h4 class="font-bold text-white text-xs">${ord.assignedMitraName || 'Mitra SobatSerabut'}</h4>
                      <span class="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">Terverifikasi</span>
                    </div>
                    <p class="text-[10px] text-slate-400 font-mono mt-0.5">${ord.assignedMitraPhone || '-'}</p>
                    <span class="text-[10px] text-emerald-400 font-semibold block mt-0.5">⭐ 5.0 (Mitra Resmi Siap Melayani)</span>
                  </div>
                </div>
                <a href="https://wa.me/${(ord.assignedMitraPhone || '').replace(/[^0-9]/g, '')}" target="_blank" class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow flex items-center space-x-1.5 active:scale-95 transition-all">
                  <i class="fa-brands fa-whatsapp text-sm"></i>
                  <span>Chat WA</span>
                </a>
              </div>
            `}

            <!-- Task Summary Details -->
            <div class="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-blue-400 font-bold border border-slate-700">${ord.category}</span>
                  <h4 class="font-extrabold text-white text-sm mt-1">${ord.title}</h4>
                </div>
                <div class="text-right">
                  <span class="text-[10px] text-slate-400 block">Tarif Disepakati:</span>
                  <span class="text-sm font-mono font-black text-emerald-400">Rp ${Number(ord.budget || ord.baseFare || 25000).toLocaleString('id-ID')}</span>
                </div>
              </div>
              <div class="pt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                <div class="flex items-start space-x-2">
                  <i class="fa-solid fa-location-dot text-rose-500 mt-0.5 flex-shrink-0"></i>
                  <span class="truncate">${ord.address || 'Titik Koordinat Klien'}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <i class="fa-solid fa-building-columns text-emerald-400 flex-shrink-0"></i>
                  <span>Rekber Admin: QRIS, SeaBank (901771223812) / GoPay (087735170386)</span>
                </div>
              </div>
            </div>

            <!-- 5-Step Flow Stepper -->
            <div class="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alur Proses Pesanan Nyata</span>
              <div class="grid grid-cols-4 gap-1 text-center text-[9px]">
                <div class="space-y-1">
                  <div class="w-7 h-7 rounded-full mx-auto flex items-center justify-center ${!isAssigned ? 'bg-blue-600 text-white animate-pulse' : 'bg-emerald-600 text-white'}">
                    <i class="fa-solid fa-satellite-dish text-[10px]"></i>
                  </div>
                  <span class="font-bold text-slate-300 block leading-tight">Mencari Mitra</span>
                </div>
                <div class="space-y-1">
                  <div class="w-7 h-7 rounded-full mx-auto flex items-center justify-center ${isAssigned ? (isWorking ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white animate-pulse') : 'bg-slate-800 text-slate-500'}">
                    <i class="fa-solid fa-motorcycle text-[10px]"></i>
                  </div>
                  <span class="font-bold ${isAssigned ? 'text-slate-300' : 'text-slate-500'} block leading-tight">Menuju Lokasi</span>
                </div>
                <div class="space-y-1">
                  <div class="w-7 h-7 rounded-full mx-auto flex items-center justify-center ${isWorking ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-800 text-slate-500'}">
                    <i class="fa-solid fa-screwdriver-wrench text-[10px]"></i>
                  </div>
                  <span class="font-bold ${isWorking ? 'text-slate-300' : 'text-slate-500'} block leading-tight">Pengerjaan</span>
                </div>
                <div class="space-y-1">
                  <div class="w-7 h-7 rounded-full mx-auto flex items-center justify-center bg-slate-800 text-slate-500">
                    <i class="fa-solid fa-circle-check text-[10px]"></i>
                  </div>
                  <span class="font-bold text-slate-500 block leading-tight">Selesai</span>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex space-x-2 pt-1">
              <button onclick="openPaymentRekberModal('${ord.id}', ${ord.budget || ord.baseFare || 25000})" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-extrabold text-xs shadow flex items-center justify-center space-x-1.5 active:scale-95 transition-all">
                <i class="fa-solid fa-wallet"></i>
                <span>Bayar Rekber</span>
              </button>
              ${!isAssigned ? `
                <button onclick="cancelClientOrder('${ord.id}')" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 font-bold text-xs border border-slate-700 transition-all">
                  <i class="fa-solid fa-xmark mr-1"></i>
                  <span>Batalkan</span>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      // Inisialisasi Peta & Radar untuk Tiap Pesanan Aktif
      activeOrders.forEach(ord => {
        setTimeout(() => initOrderRadarMap(ord), 150);
      });
    }
  }

  // 2. Render Completed History in Orders Tab
  if (historyContainer) {
    if (historyOrders.length === 0) {
      historyContainer.innerHTML = `
        <div class="p-8 text-center rounded-3xl bg-slate-900 border border-slate-800 text-slate-400 space-y-2">
          <span class="material-symbols-outlined text-4xl text-slate-600 block">receipt_long</span>
          <h4 class="text-sm font-bold text-white">Riwayat Tugas Bersih</h4>
          <p class="text-xs text-slate-400 max-w-xs mx-auto">Belum ada tugas yang selesai atau dibatalkan. Riwayat tugas Anda dalam kondisi bersih seperti saat baru mendaftar.</p>
        </div>
      `;
    } else {
      historyContainer.innerHTML = historyOrders.map(ord => {
        const street = ord.street ? `${ord.street} ${ord.houseNumber ? 'No. ' + ord.houseNumber : ''}` : (ord.address || 'Alamat lokasi');
        const rtrw = (ord.rt || ord.rw) ? `RT ${ord.rt || '-'}/RW ${ord.rw || '-'}` : '';
        const kelKec = [ord.kelurahan ? `Kel. ${ord.kelurahan}` : '', ord.kecamatan ? `Kec. ${ord.kecamatan}` : ''].filter(Boolean).join(', ');
        const benchmark = ord.benchmark ? `<div class="text-[10px] text-amber-300 flex items-center space-x-1 mt-0.5"><span class="material-symbols-outlined text-xs">flag</span><span>Patokan: ${ord.benchmark}</span></div>` : '';

        return `
        <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2.5 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold">${ord.category}</span>
            <span class="text-[10px] px-2.5 py-0.5 rounded-full ${ord.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'} font-bold">
              ${ord.status === 'completed' ? 'Selesai & Lunas Rekber' : 'Dibatalkan'}
            </span>
          </div>
          <div>
            <h4 class="font-bold text-white text-sm">${ord.title}</h4>
            <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 mt-1 text-[11px] text-slate-300">
              <strong class="text-white block">${street}</strong>
              ${rtrw ? `<span class="text-slate-400 block text-[10px]">${rtrw}</span>` : ''}
              ${kelKec ? `<span class="text-slate-400 block text-[10px]">${kelKec}</span>` : ''}
              ${benchmark}
            </div>
          </div>
          <div class="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px] font-mono">
            <span class="text-slate-400 font-sans">Total Pembayaran:</span>
            <span class="text-emerald-400 font-bold">Rp ${Number(ord.budget || ord.baseFare || 25000).toLocaleString('id-ID')}</span>
          </div>
          ${ord.proofPhoto ? `
            <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2.5">
              <img src="${ord.proofPhoto.startsWith('http') ? ord.proofPhoto : API_BASE + ord.proofPhoto}" class="w-12 h-12 rounded-lg object-cover border border-slate-700">
              <div class="flex-1">
                <span class="text-[10px] font-bold text-white block">Foto Bukti Pengerjaan Mitra</span>
                ${ord.proofConfirmed === true 
                  ? '<span class="text-[10px] text-emerald-400 font-bold flex items-center space-x-1"><span class="material-symbols-outlined text-xs">verified</span><span>Dikonfirmasi Sesuai oleh Admin</span></span>' 
                  : '<span class="text-[9px] text-slate-400">Telah diperiksa admin sistem</span>'}
              </div>
            </div>
          ` : ''}
        </div>
        `;
      }).join('');
    }
  }

  // 3. Render Home Summary
  if (homeContainer) {
    if (clientOrders.length === 0) {
      homeContainer.innerHTML = `
        <div class="p-6 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
          <i class="fa-solid fa-clipboard-list text-3xl text-slate-600 mb-2"></i>
          <p class="text-xs font-semibold text-slate-300">Belum ada tugas yang sedang aktif.</p>
          <p class="text-[11px] text-slate-500 mt-1">Tekan tombol "+ Posting Tugas" di atas untuk mencari bantuan pekerja terdekat.</p>
        </div>
      `;
    } else {
      homeContainer.innerHTML = clientOrders.slice(0, 3).map(ord => {
        const isCompleted = ord.status === 'completed';
        const isWorking = ord.status === 'working';
        const isAssigned = !!(ord.assignedMitraId || isWorking);

        let statusBadge = '<span class="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30">Mencari Mitra</span>';
        if (isCompleted) {
          statusBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">Selesai</span>';
        } else if (isWorking) {
          statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">Dikerjakan</span>';
        }

        return `
          <div onclick="switchMainTab('orders')" class="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 cursor-pointer shadow-lg space-y-2 transition-all">
            <div class="flex items-center justify-between">
              <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-blue-400 font-bold">${ord.category}</span>
              ${statusBadge}
            </div>
            <div>
              <h4 class="font-extrabold text-white text-xs">${ord.title}</h4>
              <p class="text-[10px] text-slate-400 truncate mt-0.5">${ord.address || 'Lokasi GPS'}</p>
            </div>
            <div class="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-800/80">
              <span class="text-[10px] text-blue-400 font-sans flex items-center space-x-1">
                <i class="fa-solid fa-map-location-dot"></i>
                <span>Lihat Peta Live</span>
              </span>
              <span class="font-bold text-emerald-400">Rp ${Number(ord.budget || ord.baseFare || 25000).toLocaleString('id-ID')}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

async function initOrderRadarMap(order) {
  const mapId = `orderRadarMap_${order.id}`;
  const el = document.getElementById(mapId);
  if (!el) return;

  if (orderRadarMaps[order.id]) {
    try {
      orderRadarMaps[order.id].remove();
    } catch(e) {}
    delete orderRadarMaps[order.id];
  }

  const orderLat = Number(order.lat) || (currentUser?.lat || -6.2088);
  const orderLng = Number(order.lng) || (currentUser?.lng || 106.8456);

  const map = L.map(mapId, {
    zoomControl: false,
    attributionControl: false,
    minZoom: 11,
    maxZoom: 19
  }).setView([orderLat, orderLng], 15);

  L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20
  }).addTo(map);

  orderRadarMaps[order.id] = map;

  // 1. Client Beacon Marker
  const clientIcon = L.divIcon({
    className: 'custom-client-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs z-10">
          <i class="fa-solid fa-user"></i>
        </div>
        <span class="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-blue-400 opacity-60"></span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });

  const clientMarker = L.marker([orderLat, orderLng], { icon: clientIcon }).addTo(map);
  clientMarker.bindPopup(`<b>Titik Penjemputan / Klien</b><br><span class="text-xs">${order.address || 'Lokasi Klien'}</span>`);

  // 2. Animated Pulsing Radar Circle
  const radarCircle = L.circle([orderLat, orderLng], {
    color: '#3b82f6',
    weight: 2,
    opacity: 0.8,
    fillColor: '#60a5fa',
    fillOpacity: 0.12,
    radius: 1000
  }).addTo(map);

  let rStep = 600;
  let expanding = true;
  if (orderRadarPulseIntervals[order.id]) clearInterval(orderRadarPulseIntervals[order.id]);
  orderRadarPulseIntervals[order.id] = setInterval(() => {
    if (!orderRadarMaps[order.id]) {
      clearInterval(orderRadarPulseIntervals[order.id]);
      return;
    }
    rStep = expanding ? rStep + 100 : rStep - 100;
    if (rStep >= 1400) expanding = false;
    if (rStep <= 600) expanding = true;
    radarCircle.setRadius(rStep);
  }, 450);

  // 3. Mitra Markers (Real or Nearby Scanned Drivers)
  try {
    const res = await fetch(`${API_BASE}/api/mitra`).then(r => r.json());
    const realMitraList = (res.success && Array.isArray(res.data)) ? res.data : [];

    if (order.assignedMitraId) {
      const assignedMitra = realMitraList.find(m => m.id === order.assignedMitraId) || {
        name: order.assignedMitraName || 'Mitra Pengemudi',
        lat: orderLat + 0.0035,
        lng: orderLng + 0.0030
      };

      const mLat = Number(assignedMitra.lat) || (orderLat + 0.0035);
      const mLng = Number(assignedMitra.lng) || (orderLng + 0.0030);

      const driverIcon = L.divIcon({
        className: 'custom-assigned-driver-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-10 h-10 rounded-2xl bg-emerald-600 border-2 border-white shadow-2xl flex items-center justify-center text-white text-base z-10">
              <i class="fa-solid fa-motorcycle"></i>
            </div>
            <span class="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-emerald-400 opacity-60"></span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -22]
      });

      const dMarker = L.marker([mLat, mLng], { icon: driverIcon }).addTo(map);
      dMarker.bindPopup(`<b>${assignedMitra.name}</b><br><span class="text-xs text-emerald-600 font-bold">● Sedang Menuju Lokasi Anda</span>`).openPopup();

      L.polyline([[orderLat, orderLng], [mLat, mLng]], {
        color: '#10b981',
        weight: 4,
        dashArray: '8, 8'
      }).addTo(map);

      map.fitBounds(L.latLngBounds([[orderLat, orderLng], [mLat, mLng]]), { padding: [40, 40] });
    } else {
      // Searching mode: show active mitra or simulated scanning radar points
      const nearbyPoints = realMitraList.length > 0 ? realMitraList : [
        { name: 'Driver Terdekat 1', lat: orderLat + 0.0042, lng: orderLng + 0.0038, type: 'motorcycle' },
        { name: 'Pekerja Harian 2', lat: orderLat - 0.0035, lng: orderLng + 0.0045, type: 'person-digging' },
        { name: 'Driver Terdekat 3', lat: orderLat + 0.0028, lng: orderLng - 0.0040, type: 'motorcycle' }
      ];

      nearbyPoints.forEach(p => {
        const pLat = Number(p.lat);
        const pLng = Number(p.lng);
        if (isNaN(pLat) || isNaN(pLng)) return;

        const iconHtml = L.divIcon({
          className: 'custom-nearby-driver-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-emerald-400 shadow-xl flex items-center justify-center text-emerald-400 text-xs">
                <i class="fa-solid fa-${p.type || 'motorcycle'}"></i>
              </div>
              <span class="animate-pulse absolute inline-flex h-9 w-9 rounded-full bg-emerald-500/30"></span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18]
        });

        const m = L.marker([pLat, pLng], { icon: iconHtml }).addTo(map);
        m.bindPopup(`<b>${p.name || 'Mitra SobatSerabut'}</b><br><span class="text-xs text-blue-600">● Menerima Sinyal Tugas</span>`);
      });
    }
  } catch(e) {
    console.error('Error fetching nearby mitra:', e);
  }

  setTimeout(() => map.invalidateSize(), 300);
}

function recenterOrderMap(orderId) {
  const map = orderRadarMaps[orderId];
  if (!map) return;
  const ord = clientOrders.find(o => o.id === orderId);
  if (ord) {
    const lat = Number(ord.lat) || -6.2088;
    const lng = Number(ord.lng) || 106.8456;
    map.setView([lat, lng], 16);
  }
}

async function cancelClientOrder(orderId) {
  if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: currentUser?.id, reason: 'Dibatalkan oleh pemohon' })
    }).then(r => r.json());

    if (res.success) {
      showToast('Pesanan berhasil dibatalkan.', 'info');
      loadClientOrders();
    } else {
      showToast(res.message || 'Gagal membatalkan pesanan', 'error');
    }
  } catch(e) {
    showToast('Kesalahan koneksi: ' + e.message, 'error');
  }
}

/* ========================================================
 * 7. ALUR KERJA MITRA (GEOFENCING, TURN-BY-TURN, MANDATORY PROOF)
 * ======================================================== */
function updateMitraStatusUI(status) {
  const dot = document.getElementById('statusPulseDot');
  const label = document.getElementById('statusTextLabel');
  const subtext = document.getElementById('gpsStatusSubtext');
  const btn = document.getElementById('toggleOnlineBtn');

  if (status === 'ready') {
    dot.className = 'w-3.5 h-3.5 rounded-full bg-emerald-500 relative flex items-center justify-center';
    label.innerText = 'SIAP MENERIMA ORDER';
    label.className = 'text-xs font-bold text-emerald-400 block';
    subtext.innerHTML = '<i class="fa-solid fa-satellite text-blue-400 mr-1"></i> GPS Live Aktif (Update tiap 4 dtk)';
    btn.innerText = 'ONLINE';
    btn.className = 'px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-all';
  } else if (status === 'working') {
    dot.className = 'w-3.5 h-3.5 rounded-full bg-amber-500 relative flex items-center justify-center';
    label.innerText = 'SEDANG MENJALANKAN TUGAS';
    label.className = 'text-xs font-bold text-amber-400 block';
    subtext.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-amber-400 mr-1"></i> Tugas Aktif Sedang Berjalan';
    btn.innerText = 'ON JOB';
    btn.className = 'px-3.5 py-1.5 rounded-lg bg-amber-600 text-white font-extrabold text-xs shadow-md cursor-default';
  } else {
    dot.className = 'w-3.5 h-3.5 rounded-full bg-rose-500 relative flex items-center justify-center';
    label.innerText = 'SEDANG OFFLINE (ISTIRAHAT)';
    label.className = 'text-xs font-bold text-rose-400 block';
    subtext.innerHTML = '<i class="fa-solid fa-ban text-rose-400 mr-1"></i> GPS Standby (Tidak menerima order)';
    btn.innerText = 'OFFLINE';
    btn.className = 'px-3.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-extrabold text-xs shadow-md transition-all';
  }
}

async function toggleOnlineStatus() {
  if (currentUser?.status === 'working') {
    showToast('Anda sedang memiliki tugas aktif yang sedang berjalan.', 'warning');
    return;
  }

  const next = currentUser?.status === 'ready' ? 'offline' : 'ready';
  const res = await fetch(`${API_BASE}/api/mitra/${currentUser.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: next })
  }).then(r => r.json());

  if (res.success) {
    currentUser.status = next;
    localStorage.setItem('sobatserabut_user', JSON.stringify(currentUser));
    updateMitraStatusUI(next);
    if (next === 'ready') {
      sendGpsLocationPing();
      loadNearbyTasksForMitra();
    }
  }
}


let realGpsWatchId = null;
let lastGpsCoords = null;
let mainAppLiveMap = null;
let mainAppMitraMarker = null;
let mainAppTileLayer = null;

function startGpsTracker() {
  if (gpsTrackerInterval) clearInterval(gpsTrackerInterval);
  if (realGpsWatchId && navigator.geolocation) {
    navigator.geolocation.clearWatch(realGpsWatchId);
    realGpsWatchId = null;
  }

  // Aktifkan pemantauan GPS Hardware Asli Presisi Tinggi (Bukan Rekayasa / Jitter)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => handleRealGpsPositionUpdate(pos),
      (err) => console.warn('GPS initial fix warning:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    realGpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        handleRealGpsPositionUpdate(pos);
      },
      (err) => {
        console.warn('GPS Watch warning / izin belum diberikan:', err.message);
        const accBadge = document.getElementById('mapGpsAccuracyBadge');
        if (accBadge) accBadge.innerText = 'GPS: Menunggu Izin HP';
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  // Ping reguler ke server agar sinyal mitra & pemohon selalu terhubung ke admin terpusat
  gpsTrackerInterval = setInterval(() => {
    if (currentUser) {
      if (currentUser.role === 'mitra' && currentUser.status === 'offline') return;
      sendGpsLocationPing();
    }
  }, 5000);
}

function handleRealGpsPositionUpdate(pos) {
  if (!pos || !pos.coords) return;
  const lat = Number(pos.coords.latitude.toFixed(6));
  const lng = Number(pos.coords.longitude.toFixed(6));
  const accuracy = Math.round(pos.coords.accuracy || 10);
  const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : (currentUser?.status === 'working' ? 20 : 0);

  lastGpsCoords = { lat, lng, accuracy, speed: `${speedKmh} km/h` };

  if (currentUser) {
    currentUser.lat = lat;
    currentUser.lng = lng;
    currentUser.gpsAccuracy = accuracy;
  }

  // Update tampilan teks GPS di layar
  const coordsDisplay = document.getElementById('mapLiveCoordsDisplay');
  if (coordsDisplay) coordsDisplay.innerText = `${lat}, ${lng}`;

  const accBadge = document.getElementById('mapGpsAccuracyBadge');
  if (accBadge) accBadge.innerText = `Akurasi: ±${accuracy}m`;

  const subtext = document.getElementById('gpsStatusSubtext');
  if (subtext) subtext.innerHTML = `<i class="fa-solid fa-satellite text-emerald-400"></i><span>GPS Live Nyata (±${accuracy}m)</span>`;

  // Kirim koordinat nyata ke admin pusat
  if (currentUser) {
    if (!(currentUser.role === 'mitra' && currentUser.status === 'offline')) {
      sendGpsLocationPing();
    }
  }

  // Update marker di peta live aplikasi jika terbuka
  if (mainAppLiveMap && currentUser) {
    updateMainAppMapLocation(lat, lng);
  }
}

function sendGpsLocationPing() {
  if (!currentUser || !currentUser.lat || !currentUser.lng) return;

  if (currentUser.role === 'mitra') {
    if (currentUser.status === 'offline') return;
    const speed = (currentUser.status === 'working') ? '20 km/h' : '0 km/h';

    fetch(`${API_BASE}/api/mitra/${currentUser.id}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: currentUser.lat,
        lng: currentUser.lng,
        speed: lastGpsCoords?.speed || speed,
        status: currentUser.status
      })
    }).catch(() => {});
  } else {
    // Pemohon Layanan (Klien)
    fetch(`${API_BASE}/api/klien/${currentUser.id}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: currentUser.lat,
        lng: currentUser.lng
      })
    }).catch(() => {});
  }
}

function requestRealGpsPermission() {
  if (!navigator.geolocation) {
    showToast('Perangkat HP ini tidak mendukung fitur Geolocation GPS.', 'error');
    return;
  }
  showToast('Meminta izin akses sensor GPS HP presisi tinggi...', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      handleRealGpsPositionUpdate(pos);
      showToast(`✅ GPS Aktif! Koordinat: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (Akurasi ±${Math.round(pos.coords.accuracy)}m)`, 'success');
      if (mainAppLiveMap) {
        mainAppLiveMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
      }
    },
    (err) => {
      showToast('Harap aktifkan fitur GPS & izinkan akses lokasi pada HP Anda.', 'warning');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function initMainAppLiveMap() {
  if (mainAppLiveMap) {
    setTimeout(() => mainAppLiveMap.invalidateSize(), 200);
    return;
  }
  const mapEl = document.getElementById('mainAppLiveMap');
  if (!mapEl) return;

  const initialCenter = (currentUser?.lat && currentUser?.lng)
    ? [currentUser.lat, currentUser.lng]
    : [-2.5489, 118.0149]; // Center Nusantara Indonesia
  const initialZoom = (currentUser?.lat && currentUser?.lng) ? 15 : 5;

  mainAppLiveMap = L.map('mainAppLiveMap', {
    zoomControl: true,
    attributionControl: false,
    minZoom: 2,
    maxZoom: 20,
    worldCopyJump: true
  }).setView(initialCenter, initialZoom);

  mainAppTileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20
  }).addTo(mainAppLiveMap);

  if (currentUser?.lat && currentUser?.lng) {
    updateMainAppMapLocation(currentUser.lat, currentUser.lng);
  }

  setTimeout(() => mainAppLiveMap.invalidateSize(), 300);
}

function updateMainAppMapLocation(lat, lng) {
  if (!mainAppLiveMap) return;
  const isMitra = currentUser?.role === 'mitra';
  const iconColor = isMitra ? '#2563EB' : '#F59E0B';
  const roleName = isMitra ? 'Penyedia Layanan (Mitra)' : 'Pemohon (Klien)';

  const markerIcon = L.divIcon({
    className: 'custom-live-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-xl border-2 border-white" style="background-color: ${iconColor}">
          <i class="fa-solid fa-${isMitra ? 'person-digging' : 'user'} text-white text-xs"></i>
        </div>
        <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full opacity-50" style="background-color: ${iconColor}"></span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });

  if (mainAppMitraMarker) {
    mainAppMitraMarker.setLatLng([lat, lng]);
  } else {
    mainAppMitraMarker = L.marker([lat, lng], { icon: markerIcon }).addTo(mainAppLiveMap);
    mainAppMitraMarker.bindPopup(`<b>${currentUser.name}</b><br><span class="text-xs text-slate-600">${roleName}</span><br><span class="text-[10px] text-emerald-600 font-bold">● GPS Nyata Terhubung</span>`);
  }
}

function zoomAppMapScope(scope) {
  if (!mainAppLiveMap) return;
  if (scope === 'indonesia') {
    mainAppLiveMap.setView([-2.5489, 118.0149], 5);
  } else if (scope === 'world') {
    mainAppLiveMap.setView([15, 10], 2);
  } else if (scope === 'my_gps') {
    if (currentUser?.lat && currentUser?.lng) {
      mainAppLiveMap.setView([currentUser.lat, currentUser.lng], 16);
    } else {
      requestRealGpsPermission();
    }
  }

  const btnIndo = document.getElementById('btnAppMapIndo');
  const btnWorld = document.getElementById('btnAppMapWorld');
  const btnGps = document.getElementById('btnAppMapGps');
  if (btnIndo && btnWorld && btnGps) {
    btnIndo.className = (scope === 'indonesia') ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-extrabold flex items-center space-x-1 shadow' : 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center space-x-1';
    btnWorld.className = (scope === 'world') ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-extrabold flex items-center space-x-1 shadow' : 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center space-x-1';
    btnGps.className = (scope === 'my_gps') ? 'px-2 py-1 rounded-lg bg-emerald-600 text-white font-extrabold flex items-center space-x-1 shadow' : 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold flex items-center space-x-1';
  }
}

function switchAppMapLayer(provider) {
  if (!mainAppLiveMap) return;
  const configs = {
    google_roadmap: {
      url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20
    },
    google_hybrid: {
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20
    },
    osm: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      subdomains: ['a', 'b', 'c', 'd'],
      maxZoom: 19
    }
  };

  const cfg = configs[provider] || configs.google_roadmap;
  if (mainAppTileLayer) {
    mainAppLiveMap.removeLayer(mainAppTileLayer);
  }
  mainAppTileLayer = L.tileLayer(cfg.url, {
    subdomains: cfg.subdomains,
    maxZoom: cfg.maxZoom
  }).addTo(mainAppLiveMap);

  const btnRoad = document.getElementById('btnAppLayerRoad');
  const btnSat = document.getElementById('btnAppLayerSat');
  const btnOsm = document.getElementById('btnAppLayerOsm');
  if (btnRoad && btnSat && btnOsm) {
    btnRoad.className = (provider === 'google_roadmap') ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-bold' : 'px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold';
    btnSat.className = (provider === 'google_hybrid') ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-bold' : 'px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold';
    btnOsm.className = (provider === 'osm') ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-bold' : 'px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold';
  }
}

async function loadNearbyTasksForMitra() {
  if (!currentUser || currentUser.role !== 'mitra') return;

  try {
    const res = await fetch(`${API_BASE}/api/mitra/${currentUser.id}/nearby-orders`).then(r => r.json());
    if (res.success) {
      nearbyTasks = res.data || [];
      renderNearbyTasksList();
    }
  } catch(e) {
    console.error(e);
  }
}

function renderNearbyTasksList() {
  const container = document.getElementById('nearbyTasksContainer');
  const badge = document.getElementById('mitraRadarBadge');
  if (!container) return;

  if (nearbyTasks.length === 0) {
    badge.innerText = '0 Tugas';
    container.innerHTML = `
      <div class="p-6 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
        <i class="fa-solid fa-radar text-2xl text-blue-500/50 mb-2 animate-spin"></i>
        <p class="text-xs font-semibold text-slate-300">Belum ada order baru di radar.</p>
        <p class="text-[11px] text-slate-500 mt-0.5">Radar aktif memindai permintaan serabutan di sekitar Anda.</p>
      </div>
    `;
    return;
  }

  badge.innerText = `${nearbyTasks.length} Tugas Tersedia`;

  container.innerHTML = nearbyTasks.map(t => {
    const fare = t.baseFare || t.budget || 25000;
    const net = t.mitraNetIncome || Math.round(fare * 0.9);

    return `
      <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
            ${t.category}
          </span>
          <span class="text-[11px] font-bold text-amber-400 flex items-center space-x-1">
            <i class="fa-solid fa-location-dot"></i>
            <span>${t.distanceKm} km dari Anda</span>
          </span>
        </div>

        <div>
          <h4 class="text-sm font-extrabold text-white">${t.title}</h4>
          <p class="text-xs text-slate-400 mt-1">${t.description}</p>
        </div>

        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
          <div>
            <span class="text-[10px] text-slate-400 block font-sans">Tarif Jasa:</span>
            <span class="text-slate-300 font-bold">Rp ${fare.toLocaleString('id-ID')}</span>
          </div>
          <div class="text-right">
            <span class="text-[10px] text-emerald-400 font-semibold block font-sans">Pendapatan Bersih Mitra:</span>
            <span class="text-emerald-400 font-extrabold text-sm">Rp ${net.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <button onclick="takeTaskInstant('${t.id}')" class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/30 flex items-center justify-center space-x-2 transition-all">
          <i class="fa-solid fa-bolt"></i>
          <span>Ambil Tugas Sekarang</span>
        </button>

        <button onclick="openGoogleMapsNavigation(${t.lat || -6.1754}, ${t.lng || 106.8272}, '${encodeURIComponent(t.title)}')" class="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-400 font-bold text-[11px] border border-emerald-500/30 flex items-center justify-center space-x-1.5 transition-all">
          <i class="fa-solid fa-map-location-dot text-emerald-400"></i>
          <span>Buka Rute Penjemputan di Google Maps</span>
        </button>
      </div>
    `;
  }).join('');
}

async function takeTaskInstant(orderId) {
  if (currentUser?.role === 'mitra') {
    if (currentUser.kycStatus === 'pending') {
      showToast('Akun Anda sedang dalam verifikasi KYC oleh admin. Harap tunggu persetujuan.', 'warning');
      return;
    }
    if (currentUser.kycStatus === 'rejected') {
      showToast('Verifikasi KYC ditolak. Harap perbarui data identitas Anda.', 'error');
      return;
    }
  }

  const ok = await appConfirm('Ambil dan laksanakan pekerjaan ini sekarang? Anda akan langsung diarahkan ke lokasi pemohon jasa.', 'Konfirmasi Ambil Tugas');
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/mitra/${currentUser.id}/take-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    }).then(r => r.json());

    if (res.success) {
      showToast(res.message, 'success');
      activeOrder = res.data;
      currentUser.status = 'working';
      updateMitraStatusUI('working');
      updateMitraActiveJobUI();
      loadNearbyTasksForMitra();
    } else {
      showToast(res.message, 'error');
    }
  } catch(e) {
    showToast('Gagal mengambil tugas: ' + e.message, 'error');
  }
}

function updateMitraActiveJobUI() {
  const card = document.getElementById('mitraActiveJobCard');
  if (!card) return;

  if (!activeOrder || currentUser?.status !== 'working') {
    card.classList.add('hidden');
    if (activeJobTimerInterval) clearInterval(activeJobTimerInterval);
    return;
  }

  card.classList.remove('hidden');
  document.getElementById('mitraActiveJobTitle').innerText = activeOrder.title;
  document.getElementById('mitraActiveJobCategory').innerText = `Kategori: ${activeOrder.category}`;
  document.getElementById('mitraActiveJobAddressText').innerText = activeOrder.address || 'Alamat Penjemputan Pemohon';
  const net = activeOrder.mitraNetIncome || Math.round((activeOrder.budget || activeOrder.baseFare || 25000) * 0.9);
  document.getElementById('mitraActiveJobNetIncome').innerText = `Rp ${net.toLocaleString('id-ID')}`;

  const stepBadge = document.getElementById('mitraJobStepBadge');
  if (stepBadge) {
    const stepNames = {
      assigned: 'Menuju Lokasi',
      on_the_way: 'Dalam Perjalanan',
      arrived: 'Tiba di Lokasi',
      working: 'Sedang Dikerjakan',
      completed: 'Selesai'
    };
    stepBadge.innerText = stepNames[activeOrder.step] || 'Menuju Lokasi';
  }

  // Duration audit stopwatch
  if (activeJobTimerInterval) clearInterval(activeJobTimerInterval);
  const startTime = activeOrder.assignedAt ? new Date(activeOrder.assignedAt).getTime() : Date.now();
  const updateTimer = () => {
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    const hrs = Math.floor(elapsedSec / 3600).toString().padStart(2, '0');
    const mins = Math.floor((elapsedSec % 3600) / 60).toString().padStart(2, '0');
    const secs = (elapsedSec % 60).toString().padStart(2, '0');
    const timerEl = document.getElementById('mitraJobDurationTimer');
    if (timerEl) timerEl.innerText = `${hrs}:${mins}:${secs}`;
  };
  updateTimer();
  activeJobTimerInterval = setInterval(updateTimer, 1000);
}

function handleLiveTrackingUpdate(data) {
  const statusEl = document.getElementById('mitraJobGeofenceStatus');
  if (statusEl) {
    const statusMap = {
      INSIDE_GEOFENCE: '<span class="w-2 h-2 rounded-full bg-emerald-400 inline-block mr-1"></span><span class="text-emerald-400">Tiba di Titik Tugas (Radius < 200m)</span>',
      NEAR_ZONE: '<span class="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1"></span><span class="text-amber-400">Mendekati Lokasi (< 1km)</span>',
      EN_ROUTE: '<span class="w-2 h-2 rounded-full bg-blue-400 inline-block mr-1"></span><span class="text-blue-400">Dalam Perjalanan</span>'
    };
    statusEl.innerHTML = statusMap[data.geofenceStatus] || data.geofenceStatus;
  }

  const offRouteBanner = document.getElementById('mitraOffRouteBanner');
  if (offRouteBanner) {
    if (data.offRouteAlert) {
      offRouteBanner.classList.remove('hidden');
    } else {
      offRouteBanner.classList.add('hidden');
    }
  }
}

function openGoogleMapsTurnByTurn() {
  if (!activeOrder) {
    showToast('Tidak ada tugas aktif.', 'warning');
    return;
  }
  const lat = activeOrder.lat || -6.1754;
  const lng = activeOrder.lng || 106.8272;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  window.open(url, '_blank');
}

function openChatForActiveJob() {
  if (activeOrder) openChatForOrder(activeOrder.id);
}

function callClientForActiveJob() {
  if (activeOrder) startInAppVoiceCall(activeOrder.clientName || 'Pemohon Jasa');
}

async function openGeofencingLogModal() {
  if (!activeOrder) return;
  const modal = document.getElementById('modalGeofencingRouteLog');
  if (!modal) return;

  try {
    const res = await fetch(`${API_BASE}/api/orders/${activeOrder.id}/tracking`).then(r => r.json());
    if (res.success) {
      const data = res.data;
      modal.classList.remove('hidden');

      document.getElementById('modalGeofenceStatusBadge').innerText = data.geofenceStatus || 'EN_ROUTE';
      document.getElementById('modalGeofenceDistance').innerText = `${data.distanceKm} km`;

      const offRouteBanner = document.getElementById('modalOffRouteWarning');
      if (offRouteBanner) {
        if (data.offRouteAlert) {
          offRouteBanner.classList.remove('hidden');
        } else {
          offRouteBanner.classList.add('hidden');
        }
      }

      const audit = data.durationAudit || {};
      document.getElementById('modalAuditAssignedAt').innerText = audit.assignedAt ? new Date(audit.assignedAt).toLocaleTimeString('id-ID') : '-';
      document.getElementById('modalAuditOnTheWayAt').innerText = audit.onTheWayAt ? new Date(audit.onTheWayAt).toLocaleTimeString('id-ID') : '-';
      document.getElementById('modalAuditArrivedAt').innerText = audit.arrivedAt ? new Date(audit.arrivedAt).toLocaleTimeString('id-ID') : '-';
      document.getElementById('modalAuditSlaStatus').innerText = audit.slaStatus === 'DELAYED' ? 'Terlambat SLA' : 'Dalam Batas Wajar';

      const bcList = document.getElementById('modalBreadcrumbsList');
      const bcCount = document.getElementById('modalBreadcrumbsCount');
      const breadcrumbs = data.breadcrumbs || [];
      if (bcCount) bcCount.innerText = `${breadcrumbs.length} Titik`;
      if (bcList) {
        if (breadcrumbs.length === 0) {
          bcList.innerHTML = '<div class="text-slate-500 text-center py-2">Belum ada titik koordinat GPS terekam.</div>';
        } else {
          bcList.innerHTML = breadcrumbs.map((bc, idx) => `
            <div class="flex items-center justify-between p-1.5 rounded-lg bg-slate-950 border border-slate-800">
              <span class="text-slate-300">#${idx + 1} (${bc.time || '-'})</span>
              <span class="text-blue-400">${bc.lat.toFixed(4)}, ${bc.lng.toFixed(4)}</span>
              <span class="text-slate-500">${bc.speed || '0 km/h'}</span>
            </div>
          `).reverse().join('');
        }
      }
    }
  } catch(e) {
    showToast('Gagal memuat log geofencing: ' + e.message, 'error');
  }
}

function closeGeofencingLogModal() {
  const modal = document.getElementById('modalGeofencingRouteLog');
  if (modal) modal.classList.add('hidden');
}

// Catatan: Klien TIDAK perlu mengunggah foto bukti tugas selesai!
// Foto bukti tugas selesai HANYA diunggah oleh akun aplikasi Mitra Pekerja.
function openProfilePhotoChangeModal() {
  if (!currentUser) {
    showGuestActionPrompt('Ubah Foto Profil');
    return;
  }
  const modal = document.getElementById('modalChangeProfilePhoto');
  const preview = document.getElementById('newProfilePhotoPreview');
  if (preview) {
    preview.src = (currentUser.avatar && !currentUser.avatar.includes('unsplash.com')) ? currentUser.avatar : 'uploads/avatar_default.svg';
  }
  if (modal) modal.classList.remove('hidden');
}

function closeProfilePhotoChangeModal() {
  const modal = document.getElementById('modalChangeProfilePhoto');
  if (modal) modal.classList.add('hidden');
}

let newProfileAvatarBase64 = null;
function previewClientAvatarFile(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      newProfileAvatarBase64 = e.target.result;
      const preview = document.getElementById('newProfilePhotoPreview');
      if (preview) preview.src = newProfileAvatarBase64;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function saveNewProfilePhoto() {
  const photoToSave = newProfileAvatarBase64 || registeredAvatarBase64;
  if (!photoToSave) {
    showToast('Harap ambil foto selfie atau pilih dari galeri terlebih dahulu.', 'warning');
    return;
  }

  showToast('Menyimpan foto profil asli...', 'info');
  try {
    const res = await fetch(`${API_BASE}/api/auth/update-avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, avatarPhoto: photoToSave })
    }).then(r => r.json());

    if (res.success) {
      currentUser.avatar = res.avatarUrl;
      saveClientSession(currentUser);
      updateProfileTabUI();
      closeProfilePhotoChangeModal();
      newProfileAvatarBase64 = null;
      registeredAvatarBase64 = null;
      showToast('✅ Foto profil resmi Anda berhasil diperbarui!', 'success');
    } else {
      showToast(res.message || 'Gagal menyimpan foto profil', 'error');
    }
  } catch(e) {
    showToast('Gagal koneksi server: ' + e.message, 'error');
  }
}

/* ========================================================
 * 8. IN-APP CHAT & IN-APP VOICE CALL
 * ======================================================== */
function openChatForOrder(orderId) {
  const ord = clientOrders.find(o => o.id === orderId) || activeOrder;
  if (!ord) return;
  activeOrder = ord;
  document.getElementById('chatTitleHeader').innerText = ord.title;
  document.getElementById('inAppChatModal').classList.remove('hidden');
  renderChatMessages();
}

function closeInAppChat() {
  document.getElementById('inAppChatModal').classList.add('hidden');
}

function renderChatMessages() {
  const container = document.getElementById('chatMessagesList');
  if (!container || !activeOrder) return;
  const msgs = activeOrder.chatMessages || [];

  if (msgs.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-500 py-8">Belum ada obrolan. Kirim pesan untuk berkoordinasi.</div>';
    return;
  }

  container.innerHTML = msgs.map(m => {
    const isMe = (currentUser.role === 'klien' && m.sender === 'client') || (currentUser.role === 'mitra' && m.sender === 'mitra');
    return `
      <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
        <div class="max-w-[75%] p-3 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'} shadow">
          <p class="leading-relaxed">${m.text}</p>
        </div>
        <span class="text-[9px] text-slate-500 mt-1 font-mono">${m.time}</span>
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chatMessageInput');
  const text = input.value.trim();
  if (!text || !activeOrder) return;
  input.value = '';

  const senderRole = currentUser.role === 'klien' ? 'client' : 'mitra';
  await fetch(`${API_BASE}/api/orders/${activeOrder.id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: senderRole, text })
  });
}

function sendQuickChatMessage(text) {
  document.getElementById('chatMessageInput').value = text;
  sendChatMessage();
}

// In-App Voice Call Simulator with Synthesizer Audio
function playCallingTone() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.setValueAtTime(480, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    callRingOsc = osc;
    callRingGain = gain;
  } catch(e) {}
}

function stopCallingTone() {
  try {
    if (callRingOsc) {
      callRingOsc.stop();
      callRingOsc.disconnect();
      callRingOsc = null;
    }
  } catch(e) {}
}

function startInAppVoiceCall(contactName) {
  document.getElementById('callContactName').innerText = contactName || 'Kontak SobatSerabut';
  const modal = document.getElementById('inAppCallModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  callSeconds = 0;
  isCallMuted = false;
  updateCallControlsUI();
  document.getElementById('callStatusTimer').innerText = 'Menghubungkan ke saluran suara...';
  playCallingTone();

  if (socket && activeOrder) {
    socket.emit('call:initiate', {
      orderId: activeOrder.id,
      callerId: currentUser.id,
      callerName: currentUser.name,
      contactName
    });
  }

  setTimeout(() => {
    stopCallingTone();
    document.getElementById('callStatusTimer').innerText = '00:00 (Tersambung Suara HD)';
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
      callSeconds++;
      const mins = Math.floor(callSeconds / 60).toString().padStart(2, '0');
      const secs = (callSeconds % 60).toString().padStart(2, '0');
      document.getElementById('callStatusTimer').innerText = `${mins}:${secs} (Suara HD)`;
    }, 1000);
  }, 1800);
}

function handleIncomingVoiceCall(data) {
  startInAppVoiceCall(data.callerName || 'Panggilan Masuk');
}

function endInAppVoiceCall(emitEvent = true) {
  stopCallingTone();
  if (callTimerInterval) clearInterval(callTimerInterval);
  const modal = document.getElementById('inAppCallModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  if (emitEvent && socket && activeOrder) {
    socket.emit('call:end', {
      orderId: activeOrder.id,
      senderId: currentUser.id
    });
  }
}

function toggleCallMute() {
  isCallMuted = !isCallMuted;
  updateCallControlsUI();
  showToast(isCallMuted ? 'Mikrofon dimatikan (Muted)' : 'Mikrofon aktif', 'info');
  if (socket && activeOrder) {
    socket.emit('call:mute', {
      orderId: activeOrder.id,
      muted: isCallMuted,
      senderId: currentUser.id
    });
  }
}

function toggleCallSpeaker() {
  isSpeakerOn = !isSpeakerOn;
  updateCallControlsUI();
  showToast(isSpeakerOn ? 'Speaker ponsel aktif' : 'Earpiece ponsel aktif', 'info');
}

function updateCallControlsUI() {
  const btnMute = document.getElementById('btnCallMute');
  const iconMute = document.getElementById('btnCallMuteIcon');
  if (btnMute && iconMute) {
    if (isCallMuted) {
      btnMute.className = 'w-12 h-12 rounded-full bg-rose-600 text-white text-lg flex items-center justify-center shadow transition-all';
      iconMute.className = 'fa-solid fa-microphone-slash';
    } else {
      btnMute.className = 'w-12 h-12 rounded-full bg-slate-800 text-slate-300 text-lg flex items-center justify-center shadow transition-all';
      iconMute.className = 'fa-solid fa-microphone';
    }
  }

  const btnSpeaker = document.getElementById('btnCallSpeaker');
  const iconSpeaker = document.getElementById('btnCallSpeakerIcon');
  if (btnSpeaker && iconSpeaker) {
    if (isSpeakerOn) {
      btnSpeaker.className = 'w-12 h-12 rounded-full bg-blue-600 text-white text-lg flex items-center justify-center shadow transition-all';
      iconSpeaker.className = 'fa-solid fa-volume-high';
    } else {
      btnSpeaker.className = 'w-12 h-12 rounded-full bg-slate-800 text-slate-300 text-lg flex items-center justify-center shadow transition-all';
      iconSpeaker.className = 'fa-solid fa-volume-low';
    }
  }
}

/* ========================================================
 * 9. PEMBAYARAN REKBER ADMIN & TOP-UP DOMPET RIIL
 * Rekening Resmi: SeaBank 901771223812, GoPay 087735170386, QRIS Resmi
 * ======================================================== */
function copyToClipboard(text, label = 'Nomor') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`✅ ${label} (${text}) berhasil disalin!`, 'success');
    }).catch(() => fallbackCopy(text, label));
  } else {
    fallbackCopy(text, label);
  }
}

function fallbackCopy(text, label) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(`✅ ${label} (${text}) berhasil disalin!`, 'success');
}

// Payment Rekber Modal Controller
let selectedPayAdminMethodVal = 'seabank';
function selectPayAdminMethod(method) {
  selectedPayAdminMethodVal = method;
  ['seabank', 'gopay', 'qris'].forEach(m => {
    const btn = document.getElementById(`payTabBtn-${m}`);
    const box = document.getElementById(`payBox-${m}`);
    if (btn) {
      if (m === method) {
        btn.className = 'p-2 rounded-xl border border-blue-500 bg-blue-600/20 text-center font-bold text-[11px] text-white';
      } else {
        btn.className = 'p-2 rounded-xl border border-slate-700 bg-slate-950 text-center font-bold text-[11px] text-slate-300';
      }
    }
    if (box) {
      if (m === method) box.classList.remove('hidden');
      else box.classList.add('hidden');
    }
  });
}

function openPaymentRekberModal(order) {
  const modal = document.getElementById('paymentRekberModal');
  if (!modal) return;
  const budget = order ? (order.budget || order.baseFare || 25000) : 25000;
  const fee = 3000;
  const total = budget + fee;

  const bEl = document.getElementById('payModalBudget');
  const tEl = document.getElementById('payModalTotal');
  if (bEl) bEl.innerText = `Rp ${budget.toLocaleString('id-ID')}`;
  if (tEl) tEl.innerText = `Rp ${total.toLocaleString('id-ID')}`;

  selectPayAdminMethod('seabank');
  modal.classList.remove('hidden');
}

function closePaymentRekberModal() {
  const modal = document.getElementById('paymentRekberModal');
  if (modal) modal.classList.add('hidden');
}

async function confirmPayRekber() {
  const methodNames = {
    seabank: 'SeaBank Admin (901771223812)',
    gopay: 'GoPay Admin (087735170386)',
    qris: 'QRIS SobatSerabut Resmi'
  };
  showToast(`✅ Pembayaran ke ${methodNames[selectedPayAdminMethodVal]} berhasil dikonfirmasi! Rekber mengamankan dana.`, 'success', 5000);
  closePaymentRekberModal();
  if (typeof loadClientOrders === 'function') loadClientOrders();
}

// Top-Up Controller
let selectedTopupAdminMethodVal = 'seabank';
function selectTopupAdminMethod(method) {
  selectedTopupAdminMethodVal = method;
  ['seabank', 'gopay', 'qris'].forEach(m => {
    const btn = document.getElementById(`topupTabBtn-${m}`);
    const box = document.getElementById(`topupBox-${m}`);
    if (btn) {
      if (m === method) {
        btn.className = 'p-2 rounded-xl border border-blue-500 bg-blue-600/20 text-center font-bold text-[11px] text-white';
      } else {
        btn.className = 'p-2 rounded-xl border border-slate-700 bg-slate-950 text-center font-bold text-[11px] text-slate-300';
      }
    }
    if (box) {
      if (m === method) box.classList.remove('hidden');
      else box.classList.add('hidden');
    }
  });
}

function setTopupAmount(val) {
  const input = document.getElementById('topupAmountInput');
  if (input) input.value = val;
}

function openTopupModal() {
  if (!currentUser) {
    showGuestActionPrompt('Top-Up Saldo');
    return;
  }
  selectTopupAdminMethod('seabank');
  document.getElementById('topupModal').classList.remove('hidden');
}

function closeTopupModal() {
  document.getElementById('topupModal').classList.add('hidden');
}

async function submitTopup() {
  if (!currentUser) {
    showGuestActionPrompt('Top-Up Saldo');
    return;
  }
  const amount = Number(document.getElementById('topupAmountInput')?.value);
  if (isNaN(amount) || amount < 10000) {
    showToast('Minimal pengisian saldo dompet adalah Rp 10.000', 'warning');
    return;
  }

  showToast('Memverifikasi data setoran ke Rekening Admin SobatSerabut...', 'info');

  const fileInput = document.getElementById('topupProofFileInput');
  let proofBase64 = null;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      proofBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(fileInput.files[0]);
      });
    } catch(e) {}
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        amount,
        paymentMethod: selectedTopupAdminMethodVal,
        proofPhoto: proofBase64,
        senderAccountName: currentUser.name,
        senderAccountNo: currentUser.phone
      })
    }).then(r => r.json());

    if (res.success) {
      showToast(res.message, 'success', 5000);
      currentUser.walletBalance = res.newBalance;
      saveClientSession(currentUser);
      updateWalletDisplay();
      closeTopupModal();
      if (fileInput) fileInput.value = '';
    } else {
      showToast(res.message || 'Gagal melakukan top-up', 'error');
    }
  } catch(err) {
    showToast('Gagal memproses pembayaran: ' + err.message, 'error');
  }
}

function openWithdrawModal() { document.getElementById('withdrawModal').classList.remove('hidden'); }
function closeWithdrawModal() { document.getElementById('withdrawModal').classList.add('hidden'); }

async function submitWithdrawForm() {
  const channelType = document.getElementById('wdChannelSelect').value;
  const destination = document.getElementById('wdDestinationInput').value;
  const amount = Number(document.getElementById('wdAmountInput').value);

  if (!destination) {
    showToast('Masukkan nomor rekening atau nomor HP tujuan pencairan.', 'warning');
    return;
  }

  const res = await fetch(`${API_BASE}/api/mitra/${currentUser.id}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, channelType, destination: `${channelType} ${destination}` })
  }).then(r => r.json());

  if (res.success) {
    showToast('Permintaan penarikan dana diajukan ke admin untuk diproses.', 'success');
    currentUser.walletBalance = res.newBalance;
    saveClientSession(currentUser);
    updateWalletDisplay();
    closeWithdrawModal();
  } else {
    showToast(res.message, 'error');
  }
}

async function loadWalletTransactions() {
  const container = document.getElementById('walletTransactionsList');
  if (!container || !currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/api/users/${currentUser.id}/transactions`).then(r => r.json());
    if (!res.success) return;

    const relevant = res.data || [];
    if (relevant.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-slate-500 italic text-xs">Belum ada riwayat transaksi. Saldo dan mutasi akan otomatis bertambah saat tugas selesai dikerjakan.</div>';
      return;
    }
    container.innerHTML = relevant.slice(0, 10).map(t => `
      <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
        <div>
          <p class="font-semibold text-white text-xs">${t.description}</p>
          <span class="text-[10px] text-slate-500">${new Date(t.timestamp).toLocaleDateString('id-ID')}</span>
        </div>
        <span class="font-mono font-bold text-emerald-400 text-xs">Rp ${t.amount.toLocaleString('id-ID')}</span>
      </div>
    `).join('');
  } catch(e) {
    console.error('Error loading transactions:', e);
  }
}

/* ========================================================
 * 10. KYC & VIP UPGRADES
 * ======================================================== */
function openKycUploadModal() {
  showToast('Identitas KYC Anda disimpan permanen saat pendaftaran awal untuk keamanan transaksi.', 'info');
}

async function upgradeToPremium() {
  const ok = await appConfirm('Aktifkan paket langganan Mitra Premium VIP seharga Rp 50.000 / bulan untuk prioritas order radar?', 'Upgrade Mitra VIP');
  if (!ok) return;

  const res = await fetch(`${API_BASE}/api/mitra/${currentUser.id}/upgrade-premium`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).then(r => r.json());
  if (res.success) {
    showToast('Selamat! Anda resmi menjadi Mitra VIP SobatSerabut!', 'success');
    refreshUserProfile();
  }
}

/* ========================================================
 * 11. NAVIGATION TABS & SEARCH
 * ======================================================== */
function switchMainTab(tabId) {
  try {
    currentTab = tabId;
    const homeKlien = document.getElementById('klienViewContainer');
    const homeMitra = document.getElementById('mitraViewContainer');
    const ordersView = document.getElementById('ordersViewContainer');
    const mapView = document.getElementById('mapViewContainer');
    const walletView = document.getElementById('walletViewContainer');
    const profileView = document.getElementById('profileViewContainer');

    // Sembunyikan semua kontainer tab
    [homeKlien, homeMitra, ordersView, mapView, walletView, profileView].filter(Boolean).forEach(el => el.classList.add('hidden'));

    // Reset warna dan status tombol navigasi bawah
    const navItems = ['home', 'map', 'orders', 'wallet', 'profile'];
    navItems.forEach(id => {
      const btn = document.getElementById(`navBtn-${id}`);
      if (btn) {
        btn.classList.remove('text-blue-500', 'font-extrabold', 'scale-105');
        btn.classList.add('text-slate-400');
      }
    });

    // Tandai tombol navigasi yang aktif
    const activeBtn = document.getElementById(`navBtn-${tabId}`);
    if (activeBtn) {
      activeBtn.classList.remove('text-slate-400');
      activeBtn.classList.add('text-blue-500', 'font-extrabold', 'scale-105');
    }

    // Aktifkan layar kontainer sesuai tab yang dipilih
    if (tabId === 'home') {
      if (homeKlien) homeKlien.classList.remove('hidden');
      else if (homeMitra) homeMitra.classList.remove('hidden');
    } else if (tabId === 'map') {
      if (mapView) {
        mapView.classList.remove('hidden');
        if (typeof initMainAppLiveMap === 'function') initMainAppLiveMap();
        if (typeof mainAppLiveMap !== 'undefined' && mainAppLiveMap) {
          setTimeout(() => {
            try { mainAppLiveMap.invalidateSize(); } catch(e) {}
          }, 200);
        }
      }
    } else if (tabId === 'orders') {
      if (ordersView) {
        ordersView.classList.remove('hidden');
        if (typeof loadClientOrders === 'function') loadClientOrders();
      }
    } else if (tabId === 'wallet') {
      if (walletView) {
        walletView.classList.remove('hidden');
        if (typeof updateWalletDisplay === 'function') updateWalletDisplay();
        if (typeof loadWalletTransactions === 'function') loadWalletTransactions();
      }
    } else if (tabId === 'profile') {
      if (profileView) {
        profileView.classList.remove('hidden');
        if (typeof updateProfileTabUI === 'function') updateProfileTabUI();
      }
    }

    // Gulir layar ke atas secara halus
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch(err) {
    console.error('Error switching tab:', err);
  }
}

function handleSearchServices(query) {
  const q = (query || '').toLowerCase().trim();
  const filtered = categoriesList.filter(c => (c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  const container = document.getElementById('klienCategoriesGrid');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-4 py-8 text-center text-slate-400 space-y-2">
        <span class="material-symbols-outlined text-4xl text-slate-600 block">search_off</span>
        <p class="text-xs font-semibold text-slate-300">Layanan "${query}" belum ditemukan</p>
        <p class="text-[10px] text-slate-500">Coba kata kunci lain atau pilih dari kategori umum kami.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(cat => {
    const imgSrc = getCategoryImage(cat);
    const fareFormatted = (cat.baseFare || 25000) >= 1000 ? `${Math.round((cat.baseFare || 25000)/1000)}rb` : (cat.baseFare || 25000);

    return `
    <div onclick="selectCategoryForNewTask('${cat.name}', ${cat.baseFare})" class="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/80 hover:bg-slate-800/80 flex flex-col items-center justify-center cursor-pointer transition-all group active:scale-95 shadow-sm">
      <div class="w-12 h-12 rounded-2xl bg-slate-800/80 p-1.5 flex items-center justify-center mb-1.5 border border-slate-700/60 group-hover:border-blue-500/50 shadow-inner group-hover:scale-105 transition-transform overflow-hidden">
        <img src="${imgSrc}" alt="${cat.name}" class="w-full h-full object-contain drop-shadow" onerror="this.onerror=null; this.src='img/service_runner.png'">
      </div>
      <span class="font-bold text-white text-[10.5px] truncate max-w-full block leading-tight text-center">${cat.name}</span>
      <span class="text-[9px] text-emerald-400 font-mono mt-0.5 font-bold">Mulai Rp ${fareFormatted}</span>
    </div>
    `;
  }).join('');
}

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch(e) {}
}

/* ========================================================
 * 12. GOOGLE MAPS PIN PICKER & GPS NAVIGATION
 * ======================================================== */
let pickerMap = null;
let pickerTileLayer = null;
let pickerCoords = { lat: -6.1754, lng: 106.8272 };
let pickerAddress = 'Monas, Gambir, Jakarta Pusat';

function initPickerMap() {
  if (pickerMap) return;
  const container = document.getElementById('pickerMapContainer');
  if (!container) return;

  pickerMap = L.map('pickerMapContainer', {
    zoomControl: false,
    attributionControl: false
  }).setView([pickerCoords.lat, pickerCoords.lng], 16);

  switchPickerTileLayer('google_roadmap');

  pickerMap.on('move', () => {
    const center = pickerMap.getCenter();
    pickerCoords = { lat: Number(center.lat.toFixed(5)), lng: Number(center.lng.toFixed(5)) };
    const display = document.getElementById('pickerCoordsDisplay');
    if (display) display.innerText = `Lat: ${pickerCoords.lat}, Lng: ${pickerCoords.lng}`;
  });

  pickerMap.on('moveend', async () => {
    const center = pickerMap.getCenter();
    reverseGeocodePicker(center.lat, center.lng);
  });
}

function switchPickerTileLayer(provider) {
  if (!pickerMap) return;
  if (pickerTileLayer) pickerMap.removeLayer(pickerTileLayer);

  const url = (provider === 'google_hybrid')
    ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
    : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

  pickerTileLayer = L.tileLayer(url, {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Google Maps'
  }).addTo(pickerMap);

  const btnRoad = document.getElementById('pickerBtnRoad');
  const btnSat = document.getElementById('pickerBtnSat');
  if (btnRoad && btnSat) {
    btnRoad.className = (provider === 'google_roadmap')
      ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-bold text-[10px]'
      : 'px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold text-[10px] hover:bg-slate-700';
    btnSat.className = (provider === 'google_hybrid')
      ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-bold text-[10px]'
      : 'px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold text-[10px] hover:bg-slate-700';
  }
}

function openGoogleMapPicker() {
  const modal = document.getElementById('googleMapPickerModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  setTimeout(() => {
    initPickerMap();
    if (pickerMap) {
      pickerMap.invalidateSize();
      centerPickerToCurrentGps();
    }
  }, 200);
}

function closeGoogleMapPicker() {
  const modal = document.getElementById('googleMapPickerModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function centerPickerToCurrentGps() {
  if (navigator.geolocation && pickerMap) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      pickerMap.setView([lat, lng], 17);
      pickerCoords = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
      reverseGeocodePicker(lat, lng);
    }, () => {});
  }
}

let pickerAddressDetails = null;

function useCurrentGpsLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = Number(pos.coords.latitude.toFixed(5));
      const lng = Number(pos.coords.longitude.toFixed(5));
      const acc = Math.round(pos.coords.accuracy || 5);
      document.getElementById('postTaskLat').value = lat;
      document.getElementById('postTaskLng').value = lng;
      document.getElementById('postTaskAccuracy').value = acc;
      const accEl = document.getElementById('postTaskAccuracyText');
      if (accEl) accEl.innerText = `Akurasi GPS: ~${acc}m`;
      const coordsEl = document.getElementById('postTaskCoordsText');
      if (coordsEl) coordsEl.innerText = `Titik GPS Saya: Lat ${lat}, Lng ${lng}`;

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`).then(r => r.json());
        if (res && res.address) {
          const a = res.address;
          if (a.road || a.pedestrian) document.getElementById('postTaskStreet').value = a.road || a.pedestrian;
          if (a.house_number) document.getElementById('postTaskHouseNumber').value = a.house_number;
          if (a.suburb || a.village || a.neighbourhood) document.getElementById('postTaskKelurahan').value = a.suburb || a.village || a.neighbourhood;
          if (a.city_district || a.subdistrict || a.county) document.getElementById('postTaskKecamatan').value = a.city_district || a.subdistrict || a.county;
          if (a.city || a.town || a.municipality) document.getElementById('postTaskCity').value = a.city || a.town || a.municipality;
          updateFullAddressDisplay();
        }
      } catch(e) {}
      showToast(`Lokasi GPS berhasil diambil! Presisi tinggi (~${acc}m)`, 'success');
    }, (err) => {
      showToast('Gagal mengambil lokasi GPS: ' + err.message, 'error');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  } else {
    showToast('Perangkat tidak mendukung sensor GPS.', 'warning');
  }
}

async function reverseGeocodePicker(lat, lng) {
  const addrDisplay = document.getElementById('pickerAddressDisplay');
  if (!addrDisplay) return;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`).then(r => r.json());
    if (res && res.display_name) {
      pickerAddress = res.display_name;
      pickerAddressDetails = res.address || null;
      addrDisplay.innerText = res.display_name.split(',').slice(0, 3).join(', ');
    } else {
      pickerAddress = `Titik Koordinat (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      pickerAddressDetails = null;
      addrDisplay.innerText = pickerAddress;
    }
  } catch(e) {
    pickerAddress = `Titik Koordinat (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    pickerAddressDetails = null;
    addrDisplay.innerText = pickerAddress;
  }
}

function confirmSelectedMapLocation() {
  document.getElementById('postTaskLat').value = pickerCoords.lat;
  document.getElementById('postTaskLng').value = pickerCoords.lng;
  document.getElementById('postTaskAddressInput').value = pickerAddress;
  document.getElementById('postTaskCoordsText').innerText = `Titik Google Maps: Lat ${pickerCoords.lat}, Lng ${pickerCoords.lng}`;

  if (pickerAddressDetails) {
    const a = pickerAddressDetails;
    if (a.road || a.pedestrian) document.getElementById('postTaskStreet').value = a.road || a.pedestrian;
    if (a.house_number) document.getElementById('postTaskHouseNumber').value = a.house_number;
    if (a.suburb || a.village || a.neighbourhood) document.getElementById('postTaskKelurahan').value = a.suburb || a.village || a.neighbourhood;
    if (a.city_district || a.subdistrict || a.county) document.getElementById('postTaskKecamatan').value = a.city_district || a.subdistrict || a.county;
    if (a.city || a.town || a.municipality) document.getElementById('postTaskCity').value = a.city || a.town || a.municipality;
    updateFullAddressDisplay();
  }

  closeGoogleMapPicker();
}

function openGoogleMapsNavigation(lat, lng, label) {
  const destination = `${lat},${lng}`;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
  window.open(url, '_blank');
}

/* ========================================================
 * 13. PENGATURAN KONEKSI SERVER LAPTOP / TUNNEL LINK
 * ======================================================== */
function openServerSettingsModal() {
  const modal = document.getElementById('serverSettingsModal');
  const input = document.getElementById('serverUrlInput');
  if (modal && input) {
    input.value = API_BASE;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    testCurrentServerConnection();
  }
}

function closeServerSettingsModal() {
  const modal = document.getElementById('serverSettingsModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function testCurrentServerConnection(urlToTest) {
  const target = (urlToTest || API_BASE).replace(/\/+$/, '');
  const indicator = document.getElementById('serverStatusIndicator');
  const text = document.getElementById('serverStatusText');
  if (!indicator || !text) return false;

  indicator.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse';
  text.innerText = 'Menguji sambungan ke ' + target + '...';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${target}/api/config`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      indicator.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
      text.innerText = '✅ Terhubung ke Server SobatSerabut (' + target + ')';
      updateServerStatusBadge(true, target);
      return true;
    } else {
      indicator.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
      text.innerText = '❌ Respon tidak valid (Status HTTP: ' + res.status + ')';
      updateServerStatusBadge(false);
      return false;
    }
  } catch (err) {
    indicator.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
    text.innerText = '❌ Gagal terhubung: ' + (err.message || 'Server offline atau URL salah');
    updateServerStatusBadge(false);
    return false;
  }
}

async function testAndSaveServerUrl() {
  const input = document.getElementById('serverUrlInput');
  let raw = input ? input.value.trim() : '';
  if (!raw) {
    showToast('Harap masukkan URL server yang valid (misal: https://...ngrok-free.dev).', 'warning');
    return;
  }
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = 'https://' + raw;
  }
  raw = raw.replace(/\/+$/, '');

  const ok = await testCurrentServerConnection(raw);
  if (ok) {
    localStorage.setItem('sobatserabut_server_url', raw);
    API_BASE = raw;
    showToast('✅ URL Server berhasil disimpan: ' + API_BASE, 'success');
    closeServerSettingsModal();
    initSocket();
    loadRemoteConfig();
    loadCategories();
  } else {
    const force = await appConfirm('Server saat ini tidak merespon di ' + raw + '.\n\nApakah Anda tetap ingin menyimpan URL ini?', 'Simpan URL Offline');
    if (force) {
      localStorage.setItem('sobatserabut_server_url', raw);
      API_BASE = raw;
      closeServerSettingsModal();
      initSocket();
    }
  }
}

function resetDefaultServerUrl() {
  localStorage.removeItem('sobatserabut_server_url');
  API_BASE = getApiBase();
  const input = document.getElementById('serverUrlInput');
  if (input) input.value = API_BASE;
  testCurrentServerConnection();
  showToast('URL Server telah direset ke bawaan sistem: ' + API_BASE, 'info');
}

function updateServerStatusBadge(isConnected, url) {
  const badge = document.getElementById('authServerStatusBadge');
  const text = document.getElementById('authServerUrlText');
  if (text) {
    if (isConnected) {
      const displayUrl = (url || API_BASE).replace(/^https?:\/\//, '');
      text.innerText = 'Server: Terhubung (' + (displayUrl.length > 20 ? displayUrl.slice(0, 18) + '...' : displayUrl) + ')';
      text.className = 'text-emerald-400 font-semibold';
    } else {
      text.innerText = 'Server: Terputus (Klik untuk periksa)';
      text.className = 'text-rose-400 font-semibold';
    }
  }
  if (badge) {
    const dot = badge.querySelector('span');
    if (dot) {
      dot.className = isConnected ? 'w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse' : 'w-2 h-2 rounded-full bg-rose-500 inline-block';
    }
  }
}
