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
let currentUser = null; // Logged-in user object
let systemConfig = {};
let categoriesList = [];

// Fungsi pemilihan gambar kategori jasa berdasarkan nama
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
  if (name.includes('listrik') || name.includes('instalasi') || name.includes('electric') || name.includes('korslet')) return 'img/service_electric.png';
  if (name.includes('runner') || name.includes('belanja') || name.includes('pasar') || name.includes('titip')) return 'img/service_runner.png';
  if (name.includes('kayu') || name.includes('pertukangan') || name.includes('carpentry') || name.includes('kusen') || name.includes('cat')) return 'img/service_carpentry.png';
  if (name.includes('ban') || name.includes('tambal') || name.includes('darurat') || name.includes('tire')) return 'img/service_tire.png';
  if (name.includes('cuci') || name.includes('mesin') || name.includes('washer')) return 'img/service_washing.png';
  return 'img/service_runner.png';
}
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
// Aplikasi Mitra Pekerja hanya bisa diakses & digunakan saat internet aktif
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
  const prompted = sessionStorage.getItem('sobatserabut_driver_perm_prompted');
  if (!prompted) {
    setTimeout(() => {
      const modal = document.getElementById('devicePermissionsModal');
      if (modal) modal.classList.remove('hidden');
    }, 1500);
  }
}

function closeDevicePermissionsModal() {
  sessionStorage.setItem('sobatserabut_driver_perm_prompted', 'true');
  const modal = document.getElementById('devicePermissionsModal');
  if (modal) modal.classList.add('hidden');
}

async function requestAllDevicePermissions() {
  closeDevicePermissionsModal();

  // 1. Izin Lokasi GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        driverLat = pos.coords.latitude;
        driverLng = pos.coords.longitude;
        console.log('📍 [Driver GPS Diizinkan]:', driverLat, driverLng);
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
          fetch(`${API_BASE}/api/mitra/${currentUser.id}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: driverLat, lng: driverLng })
          }).catch(() => {});
        }
      },
      (err) => console.warn('📍 Lokasi driver ditolak/timeout:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // 2. Izin Kamera & Mikrofon
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('📷 & 🎙️ [Kamera & Mikrofon Driver Diizinkan]');
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
  // First install check: Bersihkan riwayat tugas lama agar bersih saat pertama kali install
  if (!localStorage.getItem('sobatserabut_driver_installed_v2')) {
    localStorage.removeItem('sobatserabut_driver_cached_orders');
    localStorage.setItem('sobatserabut_driver_installed_v2', 'true');
    driverOrders = [];
  }

  // Inisialisasi sesi auth driver langsung frame 0 (Anti-stuck)
  checkAuthSession();

  // Sinkronisasi jaringan di latar belakang (Non-blocking)
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
        loadDriverOrders();
      }
    });

    socket.on('order:step_change', (data) => {
      if (currentUser?.role === 'klien') loadClientOrders();
      if (activeOrder && activeOrder.id === data.orderId) {
        activeOrder.step = data.step;
        updateMitraActiveJobUI();
      }
      loadDriverOrders();
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
        loadDriverOrders();
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


let currentAuthScreen = 'register';
let loginFailAttempts = 0;

/* ========================================================
 * 2. AUTH SESSION & CLEAN SCREEN NAVIGATION (DRIVER MITRA)
 * ======================================================== */
function saveDriverSession(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem('sobatserabut_driver_user', JSON.stringify(user));
    localStorage.setItem('sobatserabut_driver_registered', 'true');
  } else {
    localStorage.removeItem('sobatserabut_driver_user');
  }
}

function checkAuthSession() {
  const saved = localStorage.getItem('sobatserabut_driver_user');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.role === 'mitra') {
        currentUser = parsed;
        onUserAuthenticated(currentUser);
        return;
      }
    } catch(e) {}
  }

  // Cek apakah sudah terdaftar sebagai driver
  const isRegistered = localStorage.getItem('sobatserabut_driver_registered') === 'true';
  showAuthOverlay();
  if (isRegistered) {
    // Pengguna yang sudah terdaftar: langsung minta Login Akun & Kata Sandi Driver
    navigateToAuthScreen('login');
  } else {
    // Baru pertama kali daftar: langsung tampilkan form pendaftaran mitra & KYC kamera selfie
    navigateToAuthScreen('register');
  }
}

function showAuthOverlay() {
  const el = document.getElementById('authContainer');
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('flex');
  }
}

function hideAuthOverlay() {
  const el = document.getElementById('authContainer');
  if (el) {
    el.classList.add('hidden');
    el.classList.remove('flex');
  }
}

function navigateToAuthScreen(screen) {
  currentAuthScreen = screen;
  const screenReg = document.getElementById('authScreenRegister');
  const screenOtp = document.getElementById('authScreenOtp');
  const screenLogin = document.getElementById('authScreenLogin');
  const screenForgot = document.getElementById('authScreenForgot');

  [screenReg, screenOtp, screenLogin, screenForgot].filter(Boolean).forEach(el => el.classList.add('hidden'));

  if (screen === 'register') {
    if (screenReg) screenReg.classList.remove('hidden');
  } else if (screen === 'otp') {
    if (screenOtp) screenOtp.classList.remove('hidden');
    const boxes = document.querySelectorAll('#otpDigitsContainer input');
    if (boxes[0]) setTimeout(() => boxes[0].focus(), 150);
  } else if (screen === 'login') {
    if (screenLogin) screenLogin.classList.remove('hidden');
    const input = document.getElementById('loginPassPhoneInput');
    if (input) setTimeout(() => input.focus(), 150);
  } else if (screen === 'forgot') {
    if (screenForgot) screenForgot.classList.remove('hidden');
    cancelForgotOtpStep();
  }
}

function toggleAuthTab(tab) {
  // Backward compatibility alias
  if (tab === 'register') navigateToAuthScreen('register');
  else if (tab === 'login' || tab === 'password') navigateToAuthScreen('login');
  else if (tab === 'forgot') navigateToAuthScreen('forgot');
  else navigateToAuthScreen('login');
}

function startFirstTimeRegistration() {
  navigateToAuthScreen('register');
}

function startLoginFlow() {
  navigateToAuthScreen('login');
}

/* ========================================================
 * SAMBUNGKAN AKUN GOOGLE DENGAN NOMOR HP DRIVER PERANGKAT
 * ======================================================== */
function handleDriverGoogleAuth() {
  let detectedPhone = '';
  try {
    const saved = JSON.parse(localStorage.getItem('sobatserabut_driver_user') || '{}');
    if (saved && saved.phone) detectedPhone = saved.phone;
  } catch(e) {}

  if (!detectedPhone) {
    const loginInput = document.getElementById('loginPassPhoneInput')?.value.trim();
    if (loginInput && /^[0-9]+$/.test(loginInput) && loginInput.length >= 9) {
      detectedPhone = loginInput;
    }
  }

  if (detectedPhone && detectedPhone.length >= 9) {
    connectDriverGoogleWithPhone(detectedPhone, 'Driver Google');
    return;
  }

  const phoneInput = document.getElementById('driverGoogleConnectPhoneInput');
  if (phoneInput) phoneInput.value = '';
  const modal = document.getElementById('driverGoogleConnectModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeDriverGoogleConnectModal() {
  const modal = document.getElementById('driverGoogleConnectModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function confirmDriverGooglePhoneConnect() {
  const phoneInput = document.getElementById('driverGoogleConnectPhoneInput');
  const emailInput = document.getElementById('driverGoogleConnectEmailInput');
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';

  if (!phone || phone.replace(/[^0-9]/g, '').length < 9) {
    showToast('Harap masukkan nomor WhatsApp / HP Driver Anda (minimal 9 digit).', 'warning');
    return;
  }

  closeDriverGoogleConnectModal();
  await connectDriverGoogleWithPhone(phone, email ? email.split('@')[0] : 'Mitra Driver Google', email);
}

async function connectDriverGoogleWithPhone(phone, name, email) {
  showToast(`Menghubungkan akun Google ke nomor HP Driver ${phone}...`, 'info');
  try {
    const res = await fetch(`${API_BASE}/api/auth/google-connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone,
        name: name || 'Mitra Driver Google',
        email: email || `${phone.replace(/[^0-9]/g, '')}@gmail.com`,
        role: 'mitra'
      })
    }).then(r => r.json());

    if (res.success && res.data) {
      currentUser = res.data;
      driverOrders = []; // Riwayat tugas bersih kosong saat daftar baru
      localStorage.removeItem('sobatserabut_driver_cached_orders');
      saveDriverSession(currentUser);
      localStorage.setItem('sobatserabut_driver_registered', 'true');

      onUserAuthenticated(currentUser);
      showToast(`🎉 ${res.message}`, 'success', 5000);
    } else {
      showToast(res.message || 'Gagal menyambungkan akun Google Driver.', 'error');
    }
  } catch (err) {
    console.error('Driver Google connect err:', err);
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
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
        const quickCard = document.getElementById('forgotOtpScreenQuickCard');
        const quickCode = document.getElementById('forgotOtpScreenQuickCode');
        if (quickCard && quickCode) {
          quickCode.innerText = str;
          quickCard.classList.remove('hidden');
        }
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
      saveDriverSession(currentUser);
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
        const quickCard = document.getElementById('otpScreenQuickCard');
        const quickCode = document.getElementById('otpScreenQuickCode');
        if (quickCard && quickCode) {
          quickCode.innerText = str;
          quickCard.classList.remove('hidden');
        }
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
        const method = currentOtpData?.method || 'whatsapp';
        const resendFn = pendingRegistrationData ? `resendDriverOtpToOtherPhone('${method}')` : `requestOtpLogin('${method}')`;
        timerEl.innerHTML = `<button type="button" onclick="${resendFn}" class="text-blue-400 font-bold hover:underline animate-pulse">🔄 Kirim Ulang Kode OTP</button>`;
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
      driverOrders = []; // Riwayat tugas bersih kosong saat daftar baru
      localStorage.removeItem('sobatserabut_driver_cached_orders');
      saveDriverSession(currentUser);
      pendingRegistrationData = null;
      showToast('Pendaftaran Driver Mitra Berhasil! Akun Anda langsung aktif dan siap menerima tugas.', 'success');
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

function requestDriverGpsPermission(showAlert = true) {
  const pill = document.getElementById('regGpsStatusPill');
  const btn = document.getElementById('btnRegGpsPrompt');

  if (!navigator.geolocation) {
    if (pill) pill.innerHTML = '<span class="text-rose-400 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Browser Tidak Mendukung GPS</span>';
    if (showAlert) showToast('Perangkat HP atau peramban Anda tidak mendukung sensor GPS Geolocation.', 'error');
    return;
  }

  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-emerald-400"></i><span>Menghubungkan Sensor GPS HP...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      const accuracy = Math.round(pos.coords.accuracy || 10);
      lastGpsCoords = { lat, lng, accuracy, speed: '0 km/h' };

      if (pill) {
        pill.className = "text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold";
        pill.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i>GPS Aktif (±${accuracy}m)`;
      }
      if (btn) {
        btn.className = "w-full py-2.5 px-3 rounded-xl bg-emerald-950/70 text-emerald-300 font-bold text-[11px] flex items-center justify-center space-x-2 border border-emerald-500/50 shadow-inner";
        btn.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i><span>GPS HP Terhubung (${lat}, ${lng})</span>`;
      }
      if (showAlert) {
        showCustomAppDialog(
          'Sensor GPS HP Terhubung!',
          `Lokasi presisi perangkat Anda berhasil didapatkan: \nKoordinat: ${lat}, ${lng} (Akurasi: ±${accuracy} meter). Aplikasi Driver SobatSerabut siap menerima tugas klien terdekat di sekitar Anda.`,
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
        btn.innerHTML = '<i class="fa-solid fa-location-crosshairs text-amber-400"></i><span>Klik Ulang Untuk Izinkan Lokasi GPS</span>';
      }
      if (showAlert) {
        showCustomAppDialog(
          'Izin Lokasi GPS Diperlukan',
          'Untuk menjadi Driver SobatSerabut resmi, silakan ketuk "Izinkan / Allow" pada popup izin lokasi HP di peramban Anda agar orderan terdekat dapat disalurkan.',
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

function setupOtpScreenUI(otpData, devOtp) {
  const method = otpData.method || 'whatsapp';
  const phone = otpData.deliveryPhone || otpData.phone;
  const methodLabel = document.getElementById('otpScreenMethodLabel');
  if (methodLabel) methodLabel.innerText = (method === 'whatsapp') ? 'WhatsApp Bot (087791201091)' : 'SMS';
  const phoneDisplay = document.getElementById('otpScreenPhoneDisplay');
  if (phoneDisplay) phoneDisplay.innerText = phone;

  const resendOtherInput = document.getElementById('driverResendOtherPhoneInput');
  if (resendOtherInput) resendOtherInput.value = phone;

  const boxes = document.querySelectorAll('#otpDigitsContainer input');
  boxes.forEach(b => b.value = '');
  if (devOtp) {
    const str = devOtp.toString();
    boxes.forEach((b, i) => { if (str[i]) b.value = str[i]; });
    const quickCard = document.getElementById('otpScreenQuickCard');
    const quickCode = document.getElementById('otpScreenQuickCode');
    if (quickCard && quickCode) {
      quickCode.innerText = str;
      quickCard.classList.remove('hidden');
    }
  } else if (boxes[0]) {
    boxes[0].focus();
  }

  startOtpTimer(30);
}

async function quickRequestOtp(method) {
  const regPhone = document.getElementById('regPhoneInput')?.value.trim();
  const deliveryPhone = document.getElementById('regOtpDeliveryPhoneInput')?.value.trim();
  const target = deliveryPhone || regPhone;
  if (!target) {
    showToast('Masukkan nomor HP atau WhatsApp terlebih dahulu.', 'warning');
    document.getElementById('regOtpDeliveryPhoneInput')?.focus();
    return;
  }

  showToast(`Meminta kode OTP via ${method === 'whatsapp' ? 'WhatsApp' : 'SMS'}...`, 'info');
  try {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: regPhone || target,
        deliveryPhone: target,
        method: method
      })
    }).then(r => r.json());

    if (res.success) {
      currentOtpData = {
        phone: regPhone || target,
        deliveryPhone: target,
        method: method,
        code: res.devOtp
      };
      pendingRegistrationData = {
        name: document.getElementById('regNameInput')?.value.trim() || 'Driver ' + target.slice(-4),
        phone: regPhone || target,
        deliveryPhone: target,
        password: document.getElementById('regPasswordInput')?.value.trim() || 'Driver2026#',
        address: document.getElementById('regAddressInput')?.value.trim() || 'Indonesia',
        role: 'mitra',
        skills: [document.getElementById('regSkillsSelect')?.value || 'Runner / Belanja Kilat'],
        vehicle: document.getElementById('regVehicleSelect')?.value || 'Sepeda Motor',
        nik: document.getElementById('regNikInput')?.value.trim() || '',
        ktpPhoto: registeredKtpBase64 || '',
        selfieKtpPhoto: registeredSelfieBase64 || '',
        avatarPhoto: registeredAvatarBase64 || registeredSelfieBase64 || '',
        bankName: document.getElementById('regBankSelect')?.value || 'DANA',
        bankAccount: document.getElementById('regBankAccountInput')?.value.trim() || target,
        bankHolder: document.getElementById('regBankHolderInput')?.value.trim() || 'Driver'
      };

      navigateToAuthScreen('otp');
      setupOtpScreenUI(currentOtpData, res.devOtp);
      showToast(res.message, 'success');
    } else {
      showToast(res.message || 'Gagal mengirim OTP', 'error');
    }
  } catch(err) {
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}

async function requestLoginOtp(method) {
  const input = document.getElementById('loginPassPhoneInput')?.value.trim();
  if (!input) {
    showToast('Masukkan nomor WhatsApp atau HP Anda pada kolom di atas.', 'warning');
    document.getElementById('loginPassPhoneInput')?.focus();
    return;
  }

  showToast(`Mengirim kode OTP login via ${method === 'whatsapp' ? 'WhatsApp' : 'SMS'}...`, 'info');
  try {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: input, method: method })
    }).then(r => r.json());

    if (res.success) {
      currentOtpData = {
        phone: input,
        deliveryPhone: input,
        method: method,
        code: res.devOtp
      };
      pendingRegistrationData = null; // direct login
      navigateToAuthScreen('otp');
      setupOtpScreenUI(currentOtpData, res.devOtp);
      showToast(res.message, 'success');
    } else {
      showToast(res.message || 'Gagal mengirim OTP login', 'error');
    }
  } catch(err) {
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}

function resendCurrentDriverOtp() {
  if (!currentOtpData || !currentOtpData.phone) {
    showToast('Silakan masukkan nomor HP terlebih dahulu.', 'warning');
    return;
  }
  quickRequestOtp(currentOtpData.method || 'whatsapp');
}

async function handleRegisterOtpSubmit(e) {
  e.preventDefault();
  const role = document.getElementById('regRole')?.value || document.querySelector('input[name="regRole"]:checked')?.value || 'mitra';
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
    if (!bankAccount) {
      showToast('Wajib mengisi nomor rekening bank atau e-wallet nyata untuk pencairan saldo.', 'error');
      return;
    }
    if (!validateBankDetails(bankAccount, bankName)) {
      showToast(`Nomor akun ${bankName} tidak sesuai standar nomor Indonesia yang sah.`, 'error');
      return;
    }
    if (!bankHolder) {
      showToast('Wajib mengisi nama pemilik rekening / e-wallet sesuai KTP.', 'error');
      return;
    }
    const skill = document.getElementById('regSkillSelect')?.value;
    if (skill) skills.push(skill);
  } else {
    paymentProvider = document.getElementById('regKlienPayProviderSelect')?.value || 'DANA';
    paymentAccount = document.getElementById('regKlienPayAccountInput')?.value.trim() || '';
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
    bankName,
    bankAccount,
    bankHolder,
    skills,
    paymentProvider,
    paymentAccount,
    lat,
    lng,
    method
  };

  const deliveryPhoneRaw = document.getElementById('regOtpDeliveryPhoneInput')?.value.trim();
  const deliveryPhone = (deliveryPhoneRaw && deliveryPhoneRaw.replace(/[^0-9]/g, '').length >= 9)
    ? deliveryPhoneRaw
    : phone;

  try {
    showToast(`Mengirimkan kode OTP verifikasi ke ${deliveryPhone}...`, 'info');
    const sendRes = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, deliveryPhone, method })
    }).then(r => r.json());

    if (!sendRes.success) {
      showToast(sendRes.message || 'Gagal mengirim OTP', 'error');
      return;
    }

    currentOtpData = {
      phone: sendRes.phone,
      deliveryPhone: sendRes.deliveryPhone || deliveryPhone,
      method: sendRes.method
    };

    // Beralih ke layar verifikasi OTP terpisah
    navigateToAuthScreen('otp');
    const methodLabel = document.getElementById('otpScreenMethodLabel');
    if (methodLabel) methodLabel.innerText = (method === 'whatsapp') ? 'WhatsApp Bot (087791201091)' : 'SMS';
    const phoneDisplay = document.getElementById('otpScreenPhoneDisplay');
    if (phoneDisplay) phoneDisplay.innerText = sendRes.deliveryPhone || deliveryPhone;

    const resendOtherInput = document.getElementById('driverResendOtherPhoneInput');
    if (resendOtherInput) resendOtherInput.value = sendRes.deliveryPhone || deliveryPhone;

    const boxes = document.querySelectorAll('#otpDigitsContainer input');
    boxes.forEach(b => b.value = '');
    if (sendRes.devOtp) {
      const str = sendRes.devOtp.toString();
      boxes.forEach((b, i) => { if (str[i]) b.value = str[i]; });
      const quickCard = document.getElementById('otpScreenQuickCard');
      const quickCode = document.getElementById('otpScreenQuickCode');
      if (quickCard && quickCode) {
        quickCode.innerText = str;
        quickCard.classList.remove('hidden');
      }
    } else if (boxes[0]) {
      boxes[0].focus();
    }

    startOtpTimer(30);
    showToast(sendRes.devOtp ? `Kode OTP: ${sendRes.devOtp} (dikirim via WhatsApp Bot ke ${sendRes.deliveryPhone || deliveryPhone})` : (sendRes.message || 'Kode OTP dikirim!'), 'success', 8000);
  } catch (err) {
    showToast('Koneksi server gagal: ' + err.message, 'error');
  }
}

function syncRegPhoneToOtpDelivery() {
  const regPhone = document.getElementById('regPhoneInput')?.value.trim();
  const deliveryInput = document.getElementById('regOtpDeliveryPhoneInput');
  if (deliveryInput) {
    deliveryInput.value = regPhone || '';
    showToast('Nomor HP akun disinkronkan ke nomor penerima OTP.', 'info');
  }
}

async function resendDriverOtpToOtherPhone(method) {
  const otherInput = document.getElementById('driverResendOtherPhoneInput');
  const targetPhone = (otherInput && otherInput.value.trim().length >= 9)
    ? otherInput.value.trim()
    : (currentOtpData?.deliveryPhone || currentOtpData?.phone);

  if (!targetPhone) {
    showToast('Harap masukkan nomor HP / WhatsApp penerima kode OTP.', 'warning');
    return;
  }

  showToast(`Mengirim ulang kode OTP ke ${targetPhone} via ${method === 'whatsapp' ? 'WhatsApp Bot' : 'SMS'}...`, 'info');
  try {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: (pendingRegistrationData?.phone || currentOtpData?.phone || targetPhone),
        deliveryPhone: targetPhone,
        method
      })
    }).then(r => r.json());

    if (res.success) {
      currentOtpData = {
        phone: pendingRegistrationData?.phone || currentOtpData?.phone || targetPhone,
        deliveryPhone: res.deliveryPhone || targetPhone,
        method: res.method
      };
      startOtpTimer(30);
      const phoneDisplay = document.getElementById('otpScreenPhoneDisplay');
      if (phoneDisplay) phoneDisplay.innerText = res.deliveryPhone || targetPhone;
      const methodLabel = document.getElementById('otpScreenMethodLabel');
      if (methodLabel) methodLabel.innerText = (method === 'whatsapp') ? 'WhatsApp Bot (087791201091)' : 'SMS';

      if (res.devOtp) {
        const str = res.devOtp.toString();
        const boxes = document.querySelectorAll('#otpDigitsContainer input');
        boxes.forEach((b, i) => { if (str[i]) b.value = str[i]; });
        const quickCard = document.getElementById('otpScreenQuickCard');
        const quickCode = document.getElementById('otpScreenQuickCode');
        if (quickCard && quickCode) {
          quickCode.innerText = str;
          quickCard.classList.remove('hidden');
        }
      }
      showToast(res.message || `Kode OTP berhasil dikirim ke ${targetPhone}`, 'success');
    } else {
      showToast(res.message || 'Gagal mengirim kode OTP', 'error');
    }
  } catch(e) {
    showToast('Kesalahan koneksi: ' + e.message, 'error');
  }
}

function applyQuickDriverOtp() {
  const quickCode = document.getElementById('otpScreenQuickCode')?.innerText.trim();
  if (!quickCode || quickCode.includes('-')) return;
  const boxes = document.querySelectorAll('#otpDigitsContainer input');
  boxes.forEach((b, i) => { if (quickCode[i]) b.value = quickCode[i]; });
  submitVerifyOtpLogin();
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
      if (res.data.role === 'klien') {
        showToast('Akun ini adalah Akun Klien. Gunakan aplikasi SobatSerabut.', 'warning');
        return;
      }
      loginFailAttempts = 0;
      const wrongBox = document.getElementById('wrongPasswordLupaBox');
      if (wrongBox) wrongBox.classList.add('hidden');

      currentUser = res.data;
      saveDriverSession(currentUser);
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
  const ok = await appConfirm('Apakah Anda yakin ingin keluar dari akun Driver SobatSerabut?', 'Konfirmasi Keluar Akun');
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
    saveDriverSession(null);
    currentUser = null;
    activeOrder = null;
    if (gpsTrackerInterval) clearInterval(gpsTrackerInterval);
    if (activeJobTimerInterval) clearInterval(activeJobTimerInterval);
    showAuthOverlay();
    navigateToAuthScreen('login');
  }
}

async function toggleUserRoleSwitch() {
  showToast('Aplikasi Driver SobatSerabut khusus untuk Mitra Driver & Pengemudi. Untuk memesan jasa, buka aplikasi SobatSerabut.', 'info');
}

/* ========================================================
 * 3. AUTHENTICATED APP INITIALIZATION (DRIVER MITRA)
 * ======================================================== */
function onUserAuthenticated(user) {
  if (user.role === 'klien') {
    showToast('Akun ini adalah Akun Klien. Gunakan aplikasi SobatSerabut untuk memesan jasa.', 'warning');
    saveDriverSession(null);
    currentUser = null;
    showAuthOverlay();
    navigateToAuthScreen('login');
    return;
  }

  hideAuthOverlay();

  // Header display
  const nameEl = document.getElementById('currentUserHeaderName');
  if (nameEl) nameEl.innerText = user.name || 'Mitra Driver';
  const roleBadge = document.getElementById('roleHeaderBadge');
  if (roleBadge) {
    roleBadge.innerText = 'MITRA RESMI';
    roleBadge.className = 'text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/30';
  }
  const statusBar = document.getElementById('mitraStatusBarContainer');
  if (statusBar) statusBar.classList.remove('hidden');
  const mitraView = document.getElementById('mitraViewContainer');
  if (mitraView) mitraView.classList.remove('hidden');

  updateMitraStatusUI(user.status || 'ready');

  // Tampilkan KYC Pending Notice jika mitra belum disetujui admin terpusat
  const kycBanner = document.getElementById('mitraKycNoticeBanner');
  if (kycBanner) {
    if (user.kycStatus === 'pending') {
      kycBanner.classList.remove('hidden');
    } else {
      kycBanner.classList.add('hidden');
    }
  }

  loadNearbyTasksForMitra();
  updateMitraActiveJobUI();
  loadDriverOrders();

  // Aktifkan sensor GPS HP presisi tinggi untuk memantau pergerakan driver
  startGpsTracker();

  // Request device permissions on login
  if (!localStorage.getItem('sobatserabut_permissions_granted')) {
    setTimeout(() => requestAllDevicePermissions(), 1000);
  }

  // Profile tab fields
  const pName = document.getElementById('profileUserName');
  if (pName) pName.innerText = user.name;
  const pPhone = document.getElementById('profileUserPhone');
  if (pPhone) pPhone.innerText = user.phone;
  const avatarEl = document.getElementById('profileUserAvatar');
  if (avatarEl) {
    let src = (user.avatar && !user.avatar.includes('unsplash.com')) ? user.avatar : 'uploads/avatar_mitra.svg';
    if (!src.startsWith('http') && !src.startsWith('data:')) {
      src = `${API_BASE}${src.startsWith('/') ? '' : '/'}${src}`;
    }
    avatarEl.src = src;
  }
  const pBadge = document.getElementById('profileUserBadge');
  if (pBadge) {
    pBadge.innerText = 'Mitra Kerja (Driver)';
    pBadge.className = 'text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30';
  }

  updateWalletDisplay();
}

async function refreshUserProfile() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/api/auth/profile/${currentUser.id}`).then(r => r.json());
    if (res.success) {
      currentUser = res.data;
      saveDriverSession(currentUser);
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

// Ubah Foto Profil Resmi Driver / Mitra
let newDriverAvatarBase64 = null;
function openProfilePhotoChangeModal() {
  if (!currentUser) {
    showToast('Silakan masuk akun terlebih dahulu.', 'warning');
    return;
  }
  const modal = document.getElementById('modalChangeProfilePhoto');
  const preview = document.getElementById('newProfilePhotoPreview');
  if (preview) {
    preview.src = (currentUser.avatar && !currentUser.avatar.includes('unsplash.com')) ? currentUser.avatar : 'uploads/avatar_mitra.svg';
  }
  if (modal) modal.classList.remove('hidden');
}

function closeProfilePhotoChangeModal() {
  const modal = document.getElementById('modalChangeProfilePhoto');
  if (modal) modal.classList.add('hidden');
}

function previewDriverAvatarFile(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      newDriverAvatarBase64 = e.target.result;
      const preview = document.getElementById('newProfilePhotoPreview');
      if (preview) preview.src = newDriverAvatarBase64;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function saveNewProfilePhoto() {
  const photoToSave = newDriverAvatarBase64 || registeredAvatarBase64;
  if (!photoToSave) {
    showToast('Harap ambil foto selfie atau pilih dari galeri terlebih dahulu.', 'warning');
    return;
  }

  showToast('Menyimpan foto profil asli driver...', 'info');
  try {
    const res = await fetch(`${API_BASE}/api/auth/update-avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, avatarPhoto: photoToSave })
    }).then(r => r.json());

    if (res.success) {
      currentUser.avatar = res.avatarUrl;
      saveDriverSession(currentUser);
      onUserAuthenticated(currentUser);
      closeProfilePhotoChangeModal();
      newDriverAvatarBase64 = null;
      registeredAvatarBase64 = null;
      showToast('✅ Foto profil resmi driver berhasil diperbarui!', 'success');
    } else {
      showToast(res.message || 'Gagal menyimpan foto profil', 'error');
    }
  } catch(e) {
    showToast('Gagal koneksi server: ' + e.message, 'error');
  }
}

/* ========================================================
 * 4. REMOTE CONFIG & BRANDING SYNC (REAL-TIME LIVE SYNC)
 * ======================================================== */
async function loadRemoteConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`).then(r => r.json());
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
    const res = await fetch(`${API_BASE}/api/categories`).then(r => r.json());
    if (res.success) {
      categoriesList = res.data || [];
      renderKlienCategoriesGrid();
      populatePostTaskCategorySelect();
    }
  } catch(e) {
    console.warn('Gagal memuat kategori:', e.message);
  }
}

function renderKlienCategoriesGrid() {
  const container = document.getElementById('klienCategoriesGrid');
  if (!container) return;

  container.innerHTML = categoriesList.map(cat => {
    const imgSrc = getCategoryImage(cat);
    return `
    <div onclick="selectCategoryForNewTask('${cat.name}', ${cat.baseFare})" class="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/80 hover:bg-slate-800/80 flex flex-col items-center justify-center cursor-pointer transition-all group active:scale-95 shadow-sm">
      <div class="w-12 h-12 rounded-2xl bg-slate-800/80 p-1.5 flex items-center justify-center mb-1.5 border border-slate-700/60 group-hover:border-blue-500/50 shadow-inner group-hover:scale-105 transition-transform overflow-hidden">
        <img src="${imgSrc}" alt="${cat.name}" class="w-full h-full object-contain drop-shadow" onerror="this.onerror=null; this.src='img/service_runner.png'">
      </div>
      <span class="font-bold text-white text-[10.5px] truncate max-w-full block leading-tight text-center">${cat.name}</span>
      <span class="text-[9px] text-emerald-400 font-mono mt-0.5 font-bold">Mulai Rp ${cat.baseFare.toLocaleString('id-ID')}</span>
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
  document.getElementById('postTaskModal').classList.remove('hidden');
  updateAutoFareDisplay();
}

function closePostTaskModal() {
  document.getElementById('postTaskModal').classList.add('hidden');
}

async function submitNewTaskPost() {
  const title = document.getElementById('postTaskTitleInput').value.trim();
  const category = document.getElementById('postTaskCategorySelect').value;
  const description = document.getElementById('postTaskDescInput').value.trim();
  const address = document.getElementById('postTaskAddressInput').value.trim();
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

  const payload = {
    title,
    category,
    description: description || 'Tolong dibantu dengan cepat dan rapi.',
    budget: baseFare,
    baseFare,
    address: address || (currentUser?.address || 'Jakarta Pusat'),
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
      showToast(`Tugas "${title}" berhasil diposting! Notifikasi telah dipancarkan ke mitra sekitar.`, 'success');
      closePostTaskModal();
      document.getElementById('postTaskTitleInput').value = '';
      document.getElementById('postTaskDescInput').value = '';
      loadClientOrders();
    } else {
      showToast(res.message, 'error');
    }
  } catch(err) {
    showToast('Gagal memposting tugas: ' + err.message, 'error');
  }
}

async function loadClientOrders() {
  if (!currentUser || currentUser.role !== 'klien') return;

  try {
    const res = await fetch(`${API_BASE}/api/orders/client/${currentUser.id}`).then(r => r.json());
    if (res.success) {
      clientOrders = res.data || [];
      renderClientOrdersList();
    }
  } catch(e) {
    console.error(e);
  }
}

function renderClientOrdersList() {
  const container = document.getElementById('klienOrdersListContainer');
  if (!container) return;

  if (clientOrders.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
        <i class="fa-solid fa-clipboard-list text-3xl text-slate-600 mb-2"></i>
        <p class="text-xs font-semibold text-slate-300">Belum ada tugas yang sedang aktif.</p>
        <p class="text-[11px] text-slate-500 mt-1">Tekan tombol "+ Posting Tugas" di atas untuk mencari bantuan pekerja terdekat.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = clientOrders.map(ord => {
    const isCompleted = ord.status === 'completed';
    const isWorking = ord.status === 'working';
    const isAssigned = ord.status === 'assigned' || isWorking;

    let statusBadge = '<span class="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30">Mencari Mitra Terdekat</span>';
    if (isCompleted) {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">Selesai &amp; Terverifikasi</span>';
    } else if (isWorking) {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">Sedang Dikerjakan</span>';
    }

    const proofThumbnail = ord.proofPhoto ? `
      <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <img src="${ord.proofPhoto.startsWith('http') || ord.proofPhoto.startsWith('data:') ? ord.proofPhoto : API_BASE + ord.proofPhoto}" class="w-12 h-12 rounded-lg object-cover border border-slate-700">
          <div>
            <span class="text-[10px] font-bold text-white block">Foto Bukti Tugas Selesai</span>
            <span class="text-[9px] text-emerald-400 font-mono">Tervalidasi Kamera Mitra</span>
          </div>
        </div>
        <a href="${ord.proofPhoto.startsWith('http') || ord.proofPhoto.startsWith('data:') ? ord.proofPhoto : API_BASE + ord.proofPhoto}" target="_blank" class="px-2.5 py-1 rounded-lg bg-slate-800 text-blue-400 text-[10px] font-bold hover:bg-slate-700">Lihat Foto</a>
      </div>
    ` : '';

    return `
      <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-blue-400 font-bold border border-slate-700">${ord.category}</span>
          ${statusBadge}
        </div>

        <div>
          <h4 class="text-sm font-extrabold text-white">${ord.title}</h4>
          <p class="text-xs text-slate-400 mt-0.5">${ord.description || ''}</p>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
          <div>
            <span class="text-[10px] text-slate-400 block font-sans">Tarif Jasa Resmi:</span>
            <span class="text-white font-bold">Rp ${(ord.baseFare || ord.budget).toLocaleString('id-ID')}</span>
          </div>
          <div class="text-right">
            <span class="text-[10px] text-slate-400 block font-sans">Rekber Diamankan:</span>
            <span class="text-emerald-400 font-bold">Rp ${(ord.totalCharge || ((ord.baseFare || ord.budget) + 3000)).toLocaleString('id-ID')}</span>
          </div>
        </div>

        ${isAssigned ? `
          <div class="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <div class="w-8 h-8 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                <i class="fa-solid fa-person-digging"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-white block">Mitra: ${ord.assignedMitraName || 'Mitra Ditugaskan'}</span>
                <span class="text-[10px] text-emerald-400 font-mono"><i class="fa-solid fa-phone mr-1"></i>${ord.assignedMitraPhone || '-'}</span>
              </div>
            </div>
            <div class="flex space-x-1.5">
              <button onclick="openChatForOrder('${ord.id}')" class="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center space-x-1">
                <i class="fa-solid fa-comments"></i>
                <span>Chat</span>
              </button>
              <button onclick="startInAppVoiceCall('${ord.assignedMitraName || 'Mitra'}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center space-x-1">
                <i class="fa-solid fa-phone"></i>
                <span>Telepon</span>
              </button>
            </div>
          </div>
        ` : ''}

        ${proofThumbnail}

        <button onclick="openGoogleMapsNavigation(${ord.lat || -6.1754}, ${ord.lng || 106.8272}, '${encodeURIComponent(ord.title)}')" class="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-blue-400 font-bold text-[11px] border border-blue-500/30 flex items-center justify-center space-x-1.5 transition-all">
          <i class="fa-solid fa-map-location-dot text-blue-400"></i>
          <span>Lihat Lokasi di Google Maps</span>
        </button>
      </div>
    `;
  }).join('');
}

let driverOrders = [];
let currentDriverOrdersSubTab = 'active';

function switchDriverOrdersSubTab(subTab) {
  currentDriverOrdersSubTab = subTab;
  const activeBtn = document.getElementById('btnDriverSubTabActive');
  const historyBtn = document.getElementById('btnDriverSubTabHistory');
  const activeSec = document.getElementById('driverOrdersSubTabActive');
  const historySec = document.getElementById('driverOrdersSubTabHistory');

  if (subTab === 'active') {
    if (activeBtn) activeBtn.className = 'py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center space-x-2 shadow transition-all';
    if (historyBtn) historyBtn.className = 'py-2.5 rounded-xl text-slate-400 hover:text-slate-200 font-bold flex items-center justify-center space-x-2 transition-all';
    if (activeSec) activeSec.classList.remove('hidden');
    if (historySec) historySec.classList.add('hidden');
  } else {
    if (activeBtn) activeBtn.className = 'py-2.5 rounded-xl text-slate-400 hover:text-slate-200 font-bold flex items-center justify-center space-x-2 transition-all';
    if (historyBtn) historyBtn.className = 'py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center space-x-2 shadow transition-all';
    if (activeSec) activeSec.classList.add('hidden');
    if (historySec) historySec.classList.remove('hidden');
  }
  renderDriverOrdersList();
}

async function loadDriverOrders() {
  try {
    if (currentUser && currentUser.id) {
      const res = await fetch(`${API_BASE}/api/orders/mitra/${currentUser.id}`).then(r => r.json());
      if (res.success && res.data) {
        driverOrders = res.data;
        renderDriverOrdersList();
        return;
      }
    }
    const allRes = await fetch(`${API_BASE}/api/orders`).then(r => r.json());
    if (allRes.success) {
      const allOrders = allRes.data || [];
      if (currentUser && currentUser.id) {
        driverOrders = allOrders.filter(o => o.assignedMitraId === currentUser.id);
      } else {
        driverOrders = allOrders;
      }
      renderDriverOrdersList();
    }
  } catch (e) {
    console.error('[Load Driver Orders Error]:', e);
  }
}

function renderDriverOrdersList() {
  const activeContainer = document.getElementById('driverActiveTasksContainer');
  const historyContainer = document.getElementById('driverHistoryTasksContainer');

  const activeTasks = driverOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  if (activeOrder && !activeTasks.some(o => o.id === activeOrder.id)) {
    activeTasks.unshift(activeOrder);
  }

  const historyTasks = driverOrders.filter(o => o.status === 'completed' || o.status === 'cancelled');

  // Update Badges
  const countBadge = document.getElementById('driverActiveBadgeCount');
  const navBadge = document.getElementById('navOrdersBadge');
  if (countBadge) {
    if (activeTasks.length > 0) {
      countBadge.innerText = activeTasks.length;
      countBadge.classList.remove('hidden');
    } else {
      countBadge.classList.add('hidden');
    }
  }
  if (navBadge) {
    if (activeTasks.length > 0) {
      navBadge.classList.remove('hidden');
    } else {
      navBadge.classList.add('hidden');
    }
  }

  // 1. Render Active Tasks SubTab
  if (activeContainer) {
    if (activeTasks.length === 0) {
      activeContainer.innerHTML = `
        <div class="p-8 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
          <div class="w-14 h-14 rounded-3xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl">
            <i class="fa-solid fa-motorcycle"></i>
          </div>
          <div>
            <h3 class="font-extrabold text-white text-sm">Tidak Ada Tugas yang Sedang Aktif</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Anda sedang tidak menjalankan tugas. Pantau radar Beranda untuk menerima orderan tugas terdekat dengan bayaran tunai nyata!
            </p>
          </div>
          <button onclick="switchMainTab('home')" class="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 inline-flex items-center space-x-2">
            <i class="fa-solid fa-radar"></i>
            <span>Pantau Radar Beranda</span>
          </button>
        </div>
      `;
    } else {
      activeContainer.innerHTML = activeTasks.map(task => {
        const net = task.mitraNetIncome || Math.round((task.budget || task.baseFare || 25000) * 0.9);
        const lat = task.lat || -6.1754;
        const lng = task.lng || 106.8272;
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        const waPhone = (task.clientPhone || '').replace(/[^0-9]/g, '');

        return `
          <div class="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-3.5">
            <div class="flex items-center justify-between pb-2 border-b border-slate-800">
              <div class="flex items-center space-x-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span class="font-extrabold text-xs text-white">
                  ${task.status === 'working' ? 'Tugas Sedang Berjalan' : 'Tugas Aktif Diambil'}
                </span>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                ${task.id}
              </span>
            </div>

            <div class="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-emerald-400 font-bold border border-slate-700">${task.category}</span>
                  <h4 class="font-extrabold text-white text-sm mt-1">${task.title}</h4>
                </div>
                <div class="text-right">
                  <span class="text-[10px] text-slate-400 block font-sans">Pendapatan Bersih:</span>
                  <span class="text-sm font-mono font-black text-emerald-400">Rp ${net.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div class="pt-1.5 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                <div class="flex items-start space-x-2">
                  <i class="fa-solid fa-location-dot text-rose-500 mt-0.5 flex-shrink-0"></i>
                  <div class="flex-1">
                    <span class="text-slate-200 font-semibold block">${task.address || 'Alamat Penjemputan / Lokasi Tugas'}</span>
                    ${(() => {
                      const addr = formatTaskAccurateAddress(task);
                      return (addr.detailStr || addr.benchmarkStr) ? `
                        <div class="mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-[10px] space-y-0.5">
                          ${addr.detailStr ? `<div class="text-emerald-400 font-medium flex items-center space-x-1"><i class="fa-solid fa-map-pin text-[9px]"></i><span>${addr.detailStr}</span></div>` : ''}
                          ${addr.benchmarkStr ? `<div class="text-amber-400 italic">🚩 ${addr.benchmarkStr}</div>` : ''}
                        </div>
                      ` : '';
                    })()}
                  </div>
                </div>
                ${task.description ? `<p class="text-[11px] text-slate-400 italic">"${task.description}"</p>` : ''}
              </div>
            </div>

            <div class="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
              <div class="flex items-center space-x-2.5">
                <div class="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                  <i class="fa-solid fa-user"></i>
                </div>
                <div>
                  <h5 class="text-xs font-bold text-white">${task.clientName || 'Pemohon Jasa'}</h5>
                  <p class="text-[10px] text-slate-400 font-mono">${task.clientPhone || '-'}</p>
                </div>
              </div>
              <div class="flex items-center space-x-1.5">
                ${waPhone ? `
                  <a href="https://wa.me/${waPhone}" target="_blank" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow flex items-center space-x-1">
                    <i class="fa-brands fa-whatsapp text-sm"></i>
                    <span>WA</span>
                  </a>
                ` : ''}
                <button onclick="startInAppVoiceCall('${task.clientName || 'Pemohon'}')" class="px-2.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-extrabold text-xs border border-blue-500/30 flex items-center space-x-1">
                  <i class="fa-solid fa-phone"></i>
                  <span>Telp</span>
                </button>
              </div>
            </div>

            <div class="space-y-2 pt-1">
              <a href="${gmapsUrl}" target="_blank" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 active:scale-95 transition-all">
                <i class="fa-solid fa-diamond-turn-right text-sm"></i>
                <span>Buka Petunjuk Arah (Google Maps)</span>
              </a>

              <div class="grid grid-cols-2 gap-2 text-xs">
                <button onclick="openChatForOrder('${task.id}')" class="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold border border-slate-700 flex items-center justify-center space-x-1.5">
                  <i class="fa-solid fa-comments"></i>
                  <span>Chat In-App</span>
                </button>
                <button onclick="openProofModalForTask('${task.id}')" class="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-1.5 active:scale-95 transition-all">
                  <i class="fa-solid fa-camera"></i>
                  <span>Selesaikan & Foto</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Render Completed History SubTab
  if (historyContainer) {
    if (historyTasks.length === 0) {
      historyContainer.innerHTML = `
        <div class="p-6 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
          <i class="fa-solid fa-box-archive text-3xl text-slate-600 mb-2"></i>
          <p class="text-xs font-semibold text-slate-300">Belum ada riwayat tugas yang selesai.</p>
          <p class="text-[11px] text-slate-500 mt-1">Selesaikan tugas aktif dengan bukti foto kamera untuk menerima saldo otomatis.</p>
        </div>
      `;
    } else {
      historyContainer.innerHTML = historyTasks.map(task => {
        const net = task.mitraNetIncome || Math.round((task.budget || task.baseFare || 25000) * 0.9);
        const isDone = task.status === 'completed';

        return `
          <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-2.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-emerald-400 font-bold">${task.category}</span>
              <span class="text-[10px] px-2.5 py-0.5 rounded-full ${isDone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'} font-bold">
                ${isDone ? 'Selesai & Saldo Masuk' : 'Dibatalkan'}
              </span>
            </div>

            <div>
              <h4 class="font-bold text-white text-sm">${task.title}</h4>
              <p class="text-[11px] text-slate-300 font-medium mt-0.5">${task.address || 'Alamat lokasi penugasan'}</p>
              ${(() => {
                const addr = formatTaskAccurateAddress(task);
                return addr.detailStr ? `<p class="text-[10px] text-slate-400 mt-0.5"><i class="fa-solid fa-map-pin text-[9px] text-emerald-400 mr-1"></i>${addr.detailStr}</p>` : '';
              })()}
            </div>

            <div class="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px] font-mono">
              <span class="text-slate-400 font-sans">Penghasilan Bersih Mitra:</span>
              <span class="text-emerald-400 font-bold">Rp ${net.toLocaleString('id-ID')}</span>
            </div>

            ${task.proofPhoto ? `
              <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2.5">
                <img src="${task.proofPhoto.startsWith('http') || task.proofPhoto.startsWith('data:') ? task.proofPhoto : API_BASE + task.proofPhoto}" class="w-10 h-10 rounded-lg object-cover border border-slate-700">
                <div class="flex-1">
                  <span class="text-[10px] font-bold text-white block">Foto Bukti Tugas Selesai</span>
                  <span class="text-[9px] text-emerald-400 font-mono">Tervalidasi Kamera Mitra</span>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  }
}

function formatTaskAccurateAddress(task) {
  if (!task) return { mainAddress: '', detailStr: '', benchmarkStr: '' };
  const parts = [];
  if (task.houseNumber) parts.push(`No. ${task.houseNumber}`);
  if (task.rt || task.rw) parts.push(`RT ${task.rt || '-'}/RW ${task.rw || '-'}`);
  if (task.kelurahan) parts.push(`Kel. ${task.kelurahan}`);
  if (task.kecamatan) parts.push(`Kec. ${task.kecamatan}`);
  if (task.city) parts.push(task.city);
  const detailStr = parts.join(', ');
  const benchmarkStr = task.benchmark ? `Patokan: ${task.benchmark}` : '';
  return {
    mainAddress: task.address || 'Alamat lokasi penugasan',
    detailStr,
    benchmarkStr
  };
}

async function cleanMyTaskHistory() {
  if (!currentUser || !currentUser.id) {
    driverOrders = [];
    renderDriverOrdersList();
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
      loadDriverOrders();
    } else {
      showToast(res.message || 'Gagal membersihkan riwayat tugas', 'error');
    }
  } catch(e) {
    showToast('Kesalahan koneksi: ' + e.message, 'error');
  }
}

function openProofModalForTask(taskId) {
  const task = driverOrders.find(o => o.id === taskId) || activeOrder;
  if (task) {
    activeOrder = task;
  }
  openProofPhotoModal();
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
    saveDriverSession(currentUser);
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

  mainAppTileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
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
      url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20
    },
    google_hybrid: {
      url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
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

        <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div class="flex items-start space-x-2 text-xs">
            <i class="fa-solid fa-location-dot text-rose-500 mt-0.5 flex-shrink-0"></i>
            <div class="flex-1">
              <span class="text-slate-200 font-semibold block">${t.address || 'Titik Penjemputan / Lokasi Tugas'}</span>
              ${(() => {
                const addr = formatTaskAccurateAddress(t);
                return (addr.detailStr || addr.benchmarkStr) ? `
                  <div class="mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-[10px] space-y-0.5">
                    ${addr.detailStr ? `<div class="text-emerald-400 font-medium flex items-center space-x-1"><i class="fa-solid fa-map-pin text-[9px]"></i><span>${addr.detailStr}</span></div>` : ''}
                    ${addr.benchmarkStr ? `<div class="text-amber-400 italic">🚩 ${addr.benchmarkStr}</div>` : ''}
                  </div>
                ` : '';
              })()}
            </div>
          </div>
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
      loadDriverOrders();
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

function openProofPhotoModal() {
  if (!activeOrder) {
    showToast('Tidak ada tugas aktif.', 'warning');
    return;
  }
  const modal = document.getElementById('modalProofPhotoUpload');
  if (modal) modal.classList.remove('hidden');
}

function closeProofPhotoModal() {
  const modal = document.getElementById('modalProofPhotoUpload');
  if (modal) modal.classList.add('hidden');
}

async function submitCompletedTaskWithProof() {
  if (!activeOrder) return;
  if (!proofPhotoBase64) {
    showToast('Wajib melampirkan foto hasil pekerjaan nyata yang telah Anda selesaikan!', 'warning');
    return;
  }

  const btn = document.getElementById('btnSubmitProofComplete');
  if (btn) btn.disabled = true;

  try {
    showToast('Mengunggah bukti foto dan menyelesaikan tugas...', 'info');
    const res = await fetch(`${API_BASE}/api/orders/${activeOrder.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proofPhoto: proofPhotoBase64,
        notes: 'Pekerjaan telah selesai dengan bukti foto nyata terlampir.'
      })
    }).then(r => r.json());

    if (res.success) {
      closeProofPhotoModal();
      proofPhotoBase64 = null;
      const order = res.data;
      const payout = order.payoutDetails || {};
      const net = (order.mitraNetIncome || payout.netIncome || 0).toLocaleString('id-ID');
      const dest = payout.destination || 'Rekening / E-Wallet Terdaftar';

      await showCustomDialog({
        title: 'Tugas Selesai & Dana Otomatis Masuk!',
        message: `Bukti pekerjaan berhasil diverifikasi.\n\nDana bersih sebesar Rp ${net} telah otomatis ditransfer ke akun Anda:\n${dest}\nNomor Bukti Transfer: ${payout.payoutId || 'PO-' + Date.now().toString().slice(-4)}`,
        type: 'success',
        confirmText: 'Selesai & Tutup'
      });

      activeOrder = null;
      if (activeJobTimerInterval) clearInterval(activeJobTimerInterval);
      currentUser.status = 'ready';
      updateMitraStatusUI('ready');
      updateMitraActiveJobUI();
      refreshUserProfile();
      loadNearbyTasksForMitra();
      loadDriverOrders();
    } else {
      showToast(res.message || 'Gagal menyelesaikan tugas', 'error');
    }
  } catch(e) {
    showToast('Gagal memproses penyelesaian tugas: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
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
 * 9. E-WALLET TOP-UP & WITHDRAW
 * ======================================================== */
function openTopupModal() { document.getElementById('topupModal').classList.remove('hidden'); }
function closeTopupModal() { document.getElementById('topupModal').classList.add('hidden'); }

async function submitTopup() {
  const amount = Number(document.getElementById('topupAmountInput').value);
  const res = await fetch(`${API_BASE}/api/auth/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id, amount })
  }).then(r => r.json());

  if (res.success) {
    showToast(res.message, 'success');
    currentUser.walletBalance = res.newBalance;
    saveDriverSession(currentUser);
    updateWalletDisplay();
    closeTopupModal();
  }
}

function openWithdrawModal() {
  const modal = document.getElementById('withdrawModal');
  if (!modal) return;
  if (currentUser) {
    const bank = currentUser.bankDetails || {};
    if (bank.bankName && document.getElementById('wdChannelSelect')) {
      document.getElementById('wdChannelSelect').value = bank.bankName;
    }
    if (bank.bankAccount && document.getElementById('wdDestinationInput')) {
      document.getElementById('wdDestinationInput').value = `${bank.bankAccount} (a.n. ${bank.bankHolder || currentUser.name})`;
    }
  }
  modal.classList.remove('hidden');
}
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
    saveDriverSession(currentUser);
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
  currentTab = tabId;
  const homeKlien = document.getElementById('klienViewContainer');
  const homeMitra = document.getElementById('mitraViewContainer');
  const ordersView = document.getElementById('ordersViewContainer');
  const mapView = document.getElementById('mapViewContainer');
  const walletView = document.getElementById('walletViewContainer');
  const profileView = document.getElementById('profileViewContainer');

  [homeKlien, homeMitra, ordersView, mapView, walletView, profileView].filter(Boolean).forEach(el => el.classList.add('hidden'));

  document.querySelectorAll('[id^="navBtn-"]').forEach(btn => {
    btn.className = 'flex flex-col items-center space-y-1 text-slate-400 hover:text-slate-200 transition-all';
  });

  const activeBtn = document.getElementById(`navBtn-${tabId}`);
  if (activeBtn) activeBtn.className = 'flex flex-col items-center space-y-1 text-emerald-400 font-bold transition-all';

  if (tabId === 'home') {
    if (currentUser?.role === 'klien') homeKlien?.classList.remove('hidden');
    else homeMitra?.classList.remove('hidden');
  } else if (tabId === 'map') {
    if (mapView) {
      mapView.classList.remove('hidden');
      initMainAppLiveMap();
    }
  } else if (tabId === 'orders') {
    if (ordersView) {
      ordersView.classList.remove('hidden');
      loadDriverOrders();
    }
  } else if (tabId === 'wallet') {
    if (walletView) walletView.classList.remove('hidden');
  } else if (tabId === 'profile') {
    if (profileView) profileView.classList.remove('hidden');
  }
}


function handleSearchServices(query) {
  const q = query.toLowerCase();
  const filtered = categoriesList.filter(c => c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
  const container = document.getElementById('klienCategoriesGrid');
  if (!container) return;
  container.innerHTML = filtered.map(cat => {
    const imgSrc = getCategoryImage(cat);
    return `
    <div onclick="selectCategoryForNewTask('${cat.name}', ${cat.baseFare})" class="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/80 hover:bg-slate-800/80 flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95">
      <div class="w-12 h-12 rounded-2xl bg-slate-800/80 p-1.5 flex items-center justify-center mb-1.5 border border-slate-700/60 shadow-inner overflow-hidden">
        <img src="${imgSrc}" alt="${cat.name}" class="w-full h-full object-contain drop-shadow" onerror="this.onerror=null; this.src='img/service_runner.png'">
      </div>
      <span class="font-bold text-white text-[10px] truncate max-w-full block leading-tight text-center">${cat.name}</span>
      <span class="text-[9px] text-emerald-400 font-mono mt-0.5 font-bold">Mulai Rp ${cat.baseFare.toLocaleString('id-ID')}</span>
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
    ? 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
    : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

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

function useCurrentGpsLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = Number(pos.coords.latitude.toFixed(5));
      const lng = Number(pos.coords.longitude.toFixed(5));
      document.getElementById('postTaskLat').value = lat;
      document.getElementById('postTaskLng').value = lng;
      document.getElementById('postTaskCoordsText').innerText = `Titik GPS Saya: Lat ${lat}, Lng ${lng}`;

      let addr = `Titik GPS (${lat}, ${lng})`;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`).then(r => r.json());
        if (res && res.display_name) {
          addr = res.display_name.split(',').slice(0, 3).join(', ');
        }
      } catch(e) {}
      document.getElementById('postTaskAddressInput').value = addr;
      showToast(`Lokasi GPS berhasil diambil! (${lat}, ${lng})`, 'success');
    }, (err) => {
      showToast('Gagal mengambil lokasi GPS: ' + err.message, 'error');
    });
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
      addrDisplay.innerText = res.display_name.split(',').slice(0, 3).join(', ');
    } else {
      pickerAddress = `Titik Koordinat (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      addrDisplay.innerText = pickerAddress;
    }
  } catch(e) {
    pickerAddress = `Titik Koordinat (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    addrDisplay.innerText = pickerAddress;
  }
}

function confirmSelectedMapLocation() {
  document.getElementById('postTaskLat').value = pickerCoords.lat;
  document.getElementById('postTaskLng').value = pickerCoords.lng;
  document.getElementById('postTaskAddressInput').value = pickerAddress;
  document.getElementById('postTaskCoordsText').innerText = `Titik Google Maps: Lat ${pickerCoords.lat}, Lng ${pickerCoords.lng}`;
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
