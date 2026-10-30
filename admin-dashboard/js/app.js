/**
 * SobatSerabut - Admin Dashboard & Real-Time Automation Script
 */

const API_BASE = window.location.origin;
let socket = null;

// Admin Authentication State
let adminToken = localStorage.getItem('sobatserabut_admin_token') || '';

// Intercept fetch to attach admin token & handle 401
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
  options = options || {};
  options.headers = options.headers || {};
  if (adminToken && typeof url === 'string') {
    if (options.headers instanceof Headers) {
      if (!options.headers.has('Authorization')) options.headers.set('Authorization', `Bearer ${adminToken}`);
    } else if (Array.isArray(options.headers)) {
      options.headers.push(['Authorization', `Bearer ${adminToken}`]);
    } else {
      if (!options.headers['Authorization'] && !options.headers['authorization']) {
        options.headers['Authorization'] = `Bearer ${adminToken}`;
      }
    }
  }
  const response = await originalFetch(url, options);
  if (response.status === 401 && typeof url === 'string' && url.includes('/api/admin/')) {
    showAdminLoginModal();
  }
  return response;
};

function showDashboardContent() {
  const app = document.getElementById('adminDashboardApp');
  const modal = document.getElementById('adminLoginModal');
  if (app) {
    app.style.setProperty('display', 'flex', 'important');
    app.classList.remove('hidden');
    app.classList.add('flex');
  }
  if (modal) {
    modal.style.setProperty('display', 'none', 'important');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function hideDashboardContent() {
  const app = document.getElementById('adminDashboardApp');
  const modal = document.getElementById('adminLoginModal');
  if (app) {
    app.style.setProperty('display', 'none', 'important');
    app.classList.add('hidden');
    app.classList.remove('flex');
  }
  // Hancurkan map secara total: Fitur maps HANYA tersedia setelah login admin terpusat!
  if (liveMap) {
    try { liveMap.remove(); } catch(e) {}
    liveMap = null;
  }
  if (routeMap) {
    try { routeMap.remove(); } catch(e) {}
    routeMap = null;
  }
  mapMarkers = {};
  if (typeof klienMarkers !== 'undefined') klienMarkers = {};
  orderMarkers = {};

  if (modal) {
    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const input = document.getElementById('adminPasswordInput');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

function showAdminLoginModal() {
  hideDashboardContent();
}

function hideAdminLoginModal() {
  showDashboardContent();
}

async function checkAdminAuth() {
  if (!adminToken) {
    hideDashboardContent();
    return false;
  }
  try {
    const res = await originalFetch(`${API_BASE}/api/admin/verify-token`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    if (res.success && res.valid) {
      showDashboardContent();
      return true;
    }
  } catch (e) {
    console.warn('Verifikasi token gagal:', e);
  }
  localStorage.removeItem('sobatserabut_admin_token');
  adminToken = '';
  hideDashboardContent();
  return false;
}

async function handleAdminLogin(e) {
  if (e) e.preventDefault();
  const passwordInput = document.getElementById('adminPasswordInput');
  const errorMsg = document.getElementById('adminLoginErrorMsg');
  const password = passwordInput ? passwordInput.value.trim() : '';
  if (!password) return;

  try {
    const res = await originalFetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    }).then(r => r.json());

    if (res.success && res.token) {
      adminToken = res.token;
      localStorage.setItem('sobatserabut_admin_token', adminToken);
      if (errorMsg) errorMsg.classList.add('hidden');
      if (passwordInput) passwordInput.value = '';
      showDashboardContent();
      if (!liveMap) {
        initLiveMap();
      } else {
        setTimeout(() => liveMap.invalidateSize(), 200);
      }
      if (!revenueChartInstance) initCharts();
      await loadInitialData();
    } else {
      if (errorMsg) {
        errorMsg.innerText = res.message || 'Kata sandi admin salah!';
        errorMsg.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (errorMsg) {
      errorMsg.innerText = 'Gagal menghubungi server: ' + err.message;
      errorMsg.classList.remove('hidden');
    }
  }
}

function handleAdminLogout() {
  if (confirm('Keluar dari Dashboard Admin?')) {
    localStorage.removeItem('sobatserabut_admin_token');
    adminToken = '';
    if (liveMap) {
      liveMap.remove();
      liveMap = null;
    }
    if (routeMap) {
      routeMap.remove();
      routeMap = null;
    }
    hideDashboardContent();
  }
}

function toggleAdminChangePasswordView(showChange) {
  const loginView = document.getElementById('adminLoginFormView');
  const changeView = document.getElementById('adminChangePasswordView');
  const msg = document.getElementById('adminChangePasswordMsg');
  if (msg) msg.classList.add('hidden');

  if (showChange) {
    if (loginView) loginView.classList.add('hidden');
    if (changeView) changeView.classList.remove('hidden');
  } else {
    if (changeView) changeView.classList.add('hidden');
    if (loginView) loginView.classList.remove('hidden');
  }
}

function openAdminChangePasswordModal() {
  showAdminLoginModal();
  toggleAdminChangePasswordView(true);
}

async function handleAdminChangePassword(e) {
  if (e) e.preventDefault();
  const oldPassword = document.getElementById('adminOldPasswordInput')?.value.trim();
  const newPassword = document.getElementById('adminNewPasswordInput')?.value.trim();
  const confirmPassword = document.getElementById('adminConfirmNewPasswordInput')?.value.trim();
  const msg = document.getElementById('adminChangePasswordMsg');

  if (!oldPassword || !newPassword) {
    if (msg) {
      msg.innerText = 'Harap isi kata sandi lama dan kata sandi baru.';
      msg.className = 'text-xs text-rose-400 font-medium block';
      msg.classList.remove('hidden');
    }
    return;
  }

  if (newPassword.length < 6) {
    if (msg) {
      msg.innerText = 'Kata sandi baru minimal 6 karakter.';
      msg.className = 'text-xs text-rose-400 font-medium block';
      msg.classList.remove('hidden');
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (msg) {
      msg.innerText = 'Konfirmasi kata sandi baru tidak cocok.';
      msg.className = 'text-xs text-rose-400 font-medium block';
      msg.classList.remove('hidden');
    }
    return;
  }

  try {
    const res = await originalFetch(`${API_BASE}/api/admin/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
      },
      body: JSON.stringify({ oldPassword, newPassword })
    }).then(r => r.json());

    if (res.success) {
      if (res.token) {
        adminToken = res.token;
        localStorage.setItem('sobatserabut_admin_token', adminToken);
      }
      alert('✅ ' + (res.message || 'Kata sandi master admin berhasil diperbarui!'));
      toggleAdminChangePasswordView(false);
      hideAdminLoginModal();
      await loadInitialData();
    } else {
      if (msg) {
        msg.innerText = res.message || 'Gagal mengubah kata sandi.';
        msg.className = 'text-xs text-rose-400 font-medium block';
        msg.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (msg) {
      msg.innerText = 'Kesalahan jaringan: ' + err.message;
      msg.className = 'text-xs text-rose-400 font-medium block';
      msg.classList.remove('hidden');
    }
  }
}

// Global State
let systemConfig = {};
let mitraList = [];
let ordersList = [];
let categoriesList = [];
let kycList = [];
let withdrawalsList = [];
let currentFilter = 'all';

// Leaflet Map instances
let liveMap = null;
let routeMap = null;
let mapMarkers = {}; // { [mitraId]: LeafletMarker }
let klienMarkers = {}; // { [klienId]: LeafletMarker }
let orderMarkers = {};
let geofenceCircle = null;
let routePolyline = null;
let routeMarkersGroup = null;

// Chart instances
let revenueChartInstance = null;
let categoryChartInstance = null;

// Auto-clear stale/fake cached data — hanya simpan token admin yang valid
(function clearStaleBrowserCache() {
  const DATA_VERSION = 'sobatserabut_v2';
  const savedVersion = localStorage.getItem('_cache_version');
  if (savedVersion !== DATA_VERSION) {
    // Hapus semua cache lama (data palsu/simulasi yang tersimpan sebelumnya)
    const adminToken = localStorage.getItem('adminToken');
    localStorage.clear();
    sessionStorage.clear();
    // Kembalikan token admin agar tidak perlu login ulang
    if (adminToken) localStorage.setItem('adminToken', adminToken);
    localStorage.setItem('_cache_version', DATA_VERSION);
    console.log('[SobatSerabut] Cache lama dibersihkan — hanya data nyata yang akan ditampilkan.');
  }
})();

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  initSocket();
  setupEventListeners();
  const isAuthed = await checkAdminAuth();
  if (isAuthed) {
    showDashboardContent();
    if (!liveMap) initLiveMap();
    if (!revenueChartInstance) initCharts();
    await loadInitialData();
  } else {
    hideDashboardContent();
  }
});

// 1. Socket.IO Setup
function initSocket() {
  const statusText = document.getElementById('socketStatusText');
  try {
    socket = io(API_BASE);

    socket.on('connect', () => {
      console.log('Connected to SobatSerabut Real-time Socket Server');
      if (statusText) statusText.innerText = 'Live Socket Connected';
    });

    socket.on('app:force_reload', (data) => {
      console.log('[System] Menerima sinyal refresh otomatis:', data);
      showToast('Dashboard diperbarui otomatis...', 'info');
      setTimeout(() => { window.location.reload(true); }, 600);
    });

    socket.on('disconnect', () => {
      console.warn('Disconnected from Real-time Socket Server');
      if (statusText) statusText.innerText = 'Socket Disconnected';
    });

    // Real-time location updates (Only processed if admin is authenticated)
    socket.on('mitra:location_update', (data) => {
      if (!adminToken) return;
      console.log('Mitra GPS Update received:', data);
      handleLiveGpsUpdate(data);
    });

    socket.on('driver:location_update', (data) => {
      if (!adminToken) return;
      console.log('Driver GPS Update received:', data);
      handleLiveGpsUpdate({ ...data, id: data.driverId || data.id });
    });

    socket.on('klien:location_update', (data) => {
      if (!adminToken) return;
      console.log('Klien GPS Update received:', data);
      handleKlienGpsUpdate(data);
    });

    socket.on('user:location_update', (data) => {
      if (!adminToken) return;
      if (data.role === 'mitra') handleLiveGpsUpdate(data);
      else handleKlienGpsUpdate(data);
    });

    // Mitra status change (ready/working/offline)
    socket.on('mitra:status_change', (data) => {
      if (!adminToken) return;
      console.log('Status change received:', data);
      handleMitraStatusChange(data);
    });

    socket.on('driver:status_change', (data) => {
      if (!adminToken) return;
      console.log('Driver Status change received:', data);
      handleMitraStatusChange({ ...data, id: data.driverId || data.id });
    });

    // Mitra just logged in / came online
    socket.on('mitra:online', (mitra) => {
      if (!adminToken) return;
      console.log('Mitra online received:', mitra);
      const existing = mitraList.find(m => m.id === mitra.id);
      if (existing) {
        existing.status = 'ready';
        existing.lat = mitra.lat;
        existing.lng = mitra.lng;
      } else {
        mitraList.unshift(mitra);
      }
      renderMitraOnMap();
      renderMitraListSidebar();
      renderDashboardCounters();
    });

    // New User registered
    socket.on('user:registered', (data) => {
      if (!adminToken) return;
      console.log('User registered received:', data);
      loadInitialData();
    });

    // New Order received
    socket.on('order:new', (newOrder) => {
      console.log('New order received:', newOrder);
      ordersList.unshift(newOrder);
      addOrderMarker(newOrder);
      renderDashboardCounters();
      playNotificationSound();
    });

    // Order step/assignment
    socket.on('order:assigned', (data) => {
      loadInitialData();
    });

    socket.on('order:completed', (data) => {
      loadInitialData();
    });

    socket.on('order:proof_confirmed', (data) => {
      const o = ordersList.find(x => x.id === data.orderId);
      if (o) {
        o.proofConfirmed = (data.status === 'approved');
        o.proofNotes = data.notes;
        renderOrdersAuditTable();
      }
    });

    // Config updates
    socket.on('config:update', (updatedConfig) => {
      systemConfig = updatedConfig;
      applyConfigToUI(updatedConfig);
    });

    // Maintenance Alert
    socket.on('maintenance:alert', (alert) => {
      updateMaintenanceUI(alert.maintenanceMode, alert.maintenanceMessage);
    });

    // KYC and Withdrawal notifications
    socket.on('kyc:new', (kyc) => {
      kycList.unshift(kyc);
      renderKycTable();
      renderDashboardCounters();
    });

    socket.on('withdrawal:new', (wd) => {
      withdrawalsList.unshift(wd);
      renderWithdrawalsList();
      renderDashboardCounters();
    });
  } catch (err) {
    console.error('Socket initialization failed:', err);
  }
}

// 2. Initial Data Loading
async function loadInitialData() {
  try {
    const [cfgRes, mRes, ordRes, catRes, kycRes, wdRes, trxRes] = await Promise.all([
      fetch(`${API_BASE}/api/config`).then(r => r.json()),
      fetch(`${API_BASE}/api/mitra`).then(r => r.json()),
      fetch(`${API_BASE}/api/orders`).then(r => r.json()),
      fetch(`${API_BASE}/api/categories`).then(r => r.json()),
      fetch(`${API_BASE}/api/admin/kyc`).then(r => r.json()),
      fetch(`${API_BASE}/api/admin/withdrawals`).then(r => r.json()),
      fetch(`${API_BASE}/api/admin/transactions`).then(r => r.json())
    ]);

    if (cfgRes.success) {
      systemConfig = cfgRes.data;
      applyConfigToUI(systemConfig);
    }
    if (mRes.success) {
      mitraList = mRes.data;
      renderMitraOnMap();
      renderMitraListSidebar();
      renderLeaderboard();
      populateMitraRouteSelect();
    }
    if (ordRes.success) {
      ordersList = ordRes.data;
      renderOrdersOnMap();
      renderOrdersAuditTable();
    }
    if (catRes.success) {
      categoriesList = catRes.data || [];
      renderCategoriesGrid();
      populateCategorySelects();
      console.log('[SobatSerabut Admin] Kategori dimuat:', catRes.data?.length, 'kategori');
    } else {
      categoriesList = [];
      renderCategoriesGrid();
    }

    // Force reload categories langsung sebagai fallback
    setTimeout(async () => {
      try {
        const catRes = await fetch(`${API_BASE}/api/categories`).then(r => r.json());
        if (catRes.success && catRes.data) {
          categoriesList = catRes.data;
          renderCategoriesGrid();
          populateCategorySelects();
          console.log('[Admin] Kategori berhasil dimuat:', categoriesList.length);
        }
      } catch(e) { console.error('Error loading categories:', e); }
    }, 500);
    if (kycRes.success) {
      kycList = kycRes.data;
      renderKycTable();
    }
    if (wdRes.success) {
      withdrawalsList = wdRes.data;
      renderWithdrawalsList();
    }
    if (trxRes.success) {
      renderTransactionsList(trxRes.data);
    }

    loadMarketplaceUsers();
    renderDashboardCounters();
    await refreshMetrics();
  } catch (e) {
    console.error('Failed to load initial data:', e);
  }
}

async function loadMarketplaceUsers() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users`).then(r => r.json());
    if (!res.success) return;
    const allUsers = res.data || [];
    const klienUsers = allUsers.filter(u => u.role === 'klien');
    const mitraUsers = allUsers.filter(u => u.role === 'mitra');

    const totalCountBadge = document.getElementById('badgeTotalUsersCount');
    if (totalCountBadge) totalCountBadge.innerText = `${allUsers.length} Akun`;

    const klienBadge = document.getElementById('klienCountBadge');
    if (klienBadge) klienBadge.innerText = `${klienUsers.length} Klien`;

    const mitraBadge = document.getElementById('mitraCountBadge');
    if (mitraBadge) mitraBadge.innerText = `${mitraUsers.length} Mitra`;

    const klienTbody = document.getElementById('adminKlienTbody');
    if (klienTbody) {
      klienTbody.innerHTML = klienUsers.map(k => `
        <tr class="hover:bg-slate-700/40">
          <td class="p-2.5 font-bold text-white flex items-center space-x-2">
            <img src="${k.avatar || '/uploads/logo_icon.svg'}" class="w-7 h-7 rounded-full object-cover border border-slate-600">
            <div>
              <span>${k.name}</span>
              <span class="text-[10px] text-slate-500 font-mono block">${k.id}</span>
            </div>
          </td>
          <td class="p-2.5 font-mono text-slate-300">${k.phone}</td>
          <td class="p-2.5 text-slate-400 truncate max-w-[150px]">${k.address || 'Jakarta'}</td>
          <td class="p-2.5 font-mono font-bold text-emerald-400">Rp ${(k.walletBalance || 0).toLocaleString('id-ID')}</td>
          <td class="p-2.5 font-mono text-blue-400 font-bold">${k.totalOrdersPosted || 0} tugas</td>
        </tr>
      `).join('');
    }

    const mitraTbody = document.getElementById('adminMitraTbody');
    if (mitraBadge) mitraBadge.innerText = `${mitraUsers.length} Mitra`;

    if (mitraTbody) {
      if (mitraUsers.length === 0) {
        mitraTbody.innerHTML = `
          <tr>
            <td colspan="6" class="p-6 text-center text-slate-400">
              <i class="fa-solid fa-person-digging text-2xl mb-1.5 block text-slate-600"></i>
              <span class="font-semibold text-slate-300 block text-xs">Belum Ada Mitra Terdaftar</span>
              <span class="text-[11px] text-slate-500">Mitra baru akan otomatis tercatat di sini saat mengunduh aplikasi dan mendaftar dengan rekening bank/e-wallet.</span>
            </td>
          </tr>
        `;
      } else {
        mitraTbody.innerHTML = mitraUsers.map(m => {
          const statusBadge = m.status === 'ready' 
            ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Siap Order</span>'
            : m.status === 'working'
            ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">Bekerja</span>'
            : '<span class="px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 text-[10px] font-bold">Off</span>';

          const accountStatusBadge = m.accountStatus === 'suspended'
            ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black text-[9px] border border-amber-500/40 inline-block animate-pulse">SUSPENDED</span>'
            : m.accountStatus === 'terminated'
            ? '<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-black text-[9px] border border-rose-500/40 inline-block">TERMINATED</span>'
            : '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[9px] border border-emerald-500/30 inline-block">AKTIF</span>';

          const currentPts = typeof m.points === 'number' ? m.points : 100;

          const avatarSrc = m.avatar && !m.avatar.includes('unsplash.com') 
            ? (m.avatar.startsWith('http') ? m.avatar : `${API_BASE}${m.avatar}`) 
            : '/uploads/avatar_mitra.svg';

          const ktpImg = m.ktpPhoto ? (m.ktpPhoto.startsWith('http') ? m.ktpPhoto : `${API_BASE}${m.ktpPhoto}`) : null;
          const selfieImg = m.selfieKtpPhoto ? (m.selfieKtpPhoto.startsWith('http') ? m.selfieKtpPhoto : `${API_BASE}${m.selfieKtpPhoto}`) : null;

          const bank = m.bankDetails || { bankName: m.bankName || 'DANA', bankAccount: m.bankAccount || m.phone, bankHolder: m.bankHolder || m.name };

          const isSuspended = m.accountStatus === 'suspended';
          const isTerminated = m.accountStatus === 'terminated';

          return `
            <tr class="hover:bg-slate-700/40">
              <td class="p-2.5 font-bold text-white flex items-center space-x-2">
                <img src="${avatarSrc}" onclick="openKycPreview('${avatarSrc}', 'Foto Profil Mitra: ${m.name}')" class="w-8 h-8 rounded-full object-cover border border-slate-600 cursor-pointer hover:scale-110 shadow" title="Klik perbesar">
                <div>
                  <span class="flex items-center space-x-1">
                    <span>${m.name}</span>
                    ${m.isPremium ? '<i class="fa-solid fa-crown text-amber-400 text-[10px]"></i>' : ''}
                  </span>
                  <span class="text-[10px] text-slate-400 font-mono block">${m.phone}</span>
                  <span class="text-[9px] text-slate-500 font-mono block">${m.id}</span>
                </div>
              </td>
              <td class="p-2.5">
                ${statusBadge}
                <div class="mt-1 flex items-center space-x-1">
                  <button type="button" onclick="openDriverPointsModal('${m.id}', '${m.name.replace(/'/g, "\\'")}', ${currentPts})" class="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 text-[10px] font-black flex items-center space-x-1 shadow transition-all" title="Kelola Poin Kinerja">
                    <i class="fa-solid fa-medal text-amber-400"></i>
                    <span>${currentPts} Poin</span>
                  </button>
                </div>
                <span class="text-[10px] text-amber-400 font-bold block mt-1"><i class="fa-solid fa-star text-[9px] mr-0.5"></i>${(m.completedOrders || 0) > 0 ? (m.rating || 5.0) : '0.0'} (${m.completedOrders || 0})</span>
              </td>
              <td class="p-2.5">
                ${accountStatusBadge}
                ${m.suspendReason ? `<span class="text-[9px] text-amber-300/80 block mt-0.5 truncate max-w-[110px]" title="${m.suspendReason}">${m.suspendReason}</span>` : ''}
              </td>
              <td class="p-2.5">
                <div class="font-mono text-xs">
                  <span class="font-bold text-emerald-400 block">Rp ${(m.walletBalance || 0).toLocaleString('id-ID')}</span>
                  <span class="text-white text-[11px]">${bank.bankName}: ${bank.bankAccount}</span>
                  <span class="text-[10px] text-slate-400 block font-sans">a.n. ${bank.bankHolder}</span>
                </div>
              </td>
              <td class="p-2.5">
                <div class="flex items-center space-x-1.5">
                  ${ktpImg ? `<img src="${ktpImg}" onclick="openKycPreview('${ktpImg}', 'KTP Asli Mitra: ${m.name}')" class="w-9 h-6 rounded border border-slate-600 object-cover cursor-pointer hover:scale-110 transition-transform" title="KTP Asli">` : '<span class="text-[9px] text-slate-500 italic">No KTP</span>'}
                  ${selfieImg ? `<img src="${selfieImg}" onclick="openKycPreview('${selfieImg}', 'Selfie Kamera Asli: ${m.name}')" class="w-9 h-6 rounded border border-slate-600 object-cover cursor-pointer hover:scale-110 transition-transform" title="Selfie Kamera">` : '<span class="text-[9px] text-slate-500 italic">No Selfie</span>'}
                  ${m.kycStatus === 'approved' || m.kycStatus === 'verified'
                    ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Terverifikasi</span>'
                    : '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">Pending</span>'}
                </div>
              </td>
              <td class="p-2.5 text-right">
                <div class="flex flex-col items-end space-y-1">
                  <!-- Baris 1: Poin & Suspen -->
                  <div class="flex items-center space-x-1">
                    <button onclick="openDriverPointsModal('${m.id}', '${m.name.replace(/'/g, "\\'")}', ${currentPts})" class="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[10px] shadow" title="Tambah / Kurangi Poin Driver">
                      <i class="fa-solid fa-plus-minus mr-0.5"></i>Poin
                    </button>
                    ${isSuspended ? `
                      <button onclick="confirmUnsuspendDriver('${m.id}', '${m.name.replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] shadow" title="Buka Suspen">
                        <i class="fa-solid fa-lock-open mr-0.5"></i>Buka Suspen
                      </button>
                    ` : !isTerminated ? `
                      <button onclick="openSuspendDriverModal('${m.id}', '${m.name.replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10px] shadow" title="Tangguhkan Driver">
                        <i class="fa-solid fa-user-lock mr-0.5"></i>Suspen
                      </button>
                    ` : ''}
                    ${!isTerminated ? `
                      <button onclick="confirmTerminateDriver('${m.id}', '${m.name.replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-[10px] shadow" title="Putus Kemitraan Permanen">
                        <i class="fa-solid fa-ban"></i>
                      </button>
                    ` : ''}
                  </div>
                  <!-- Baris 2: Verifikasi & Transfer -->
                  <div class="flex items-center space-x-1">
                    <button onclick="openMitraDetailModal('${m.id}')" class="px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] shadow flex items-center space-x-1">
                      <i class="fa-solid fa-id-card-clip"></i>
                      <span>Detail</span>
                    </button>
                    <button onclick="quickTransferSaldoToMitra('${m.id}', '${m.name}', '${bank.bankName}', '${bank.bankAccount}')" class="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow flex items-center space-x-1" title="Transfer Saldo / Payout ke Mitra">
                      <i class="fa-solid fa-paper-plane"></i>
                      <span>Transfer</span>
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch(e) {
    console.error('Error loading users:', e);
  }
}

// 3. Leaflet Live Tracking Map with Google Maps Integration
let currentLiveTileLayer = null;
let currentMapProvider = 'osm';

const MAP_TILE_CONFIGS = {
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
  google_terrain: {
    url: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19
  },
  carto: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19
  }
};

function switchAdminMapLayer(provider) {
  if (!liveMap) return;
  const cfg = MAP_TILE_CONFIGS[provider] || MAP_TILE_CONFIGS.google_roadmap;
  currentMapProvider = provider;

  if (currentLiveTileLayer) {
    liveMap.removeLayer(currentLiveTileLayer);
  }
  currentLiveTileLayer = L.tileLayer(cfg.url, {
    subdomains: cfg.subdomains,
    maxZoom: cfg.maxZoom,
    attribution: provider === 'osm' ? '&copy; OpenStreetMap &amp; SobatSerabut' : 'Google Maps &amp; SobatSerabut'
  }).addTo(liveMap);

  // Update button active states
  const btnRoad = document.getElementById('mapLayerBtnGoogleRoad');
  const btnSat = document.getElementById('mapLayerBtnGoogleSat');
  const btnOsm = document.getElementById('mapLayerBtnOsm');

  if (btnRoad && btnSat && btnOsm) {
    btnRoad.className = (provider === 'google_roadmap') 
      ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-bold flex items-center space-x-1 transition-all'
      : 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center space-x-1 transition-all';
    btnSat.className = (provider === 'google_hybrid') 
      ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-bold flex items-center space-x-1 transition-all'
      : 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center space-x-1 transition-all';
    btnOsm.className = (provider === 'osm') 
      ? 'px-2 py-1 rounded-lg bg-blue-600 text-white font-bold flex items-center space-x-1 transition-all'
      : 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center space-x-1 transition-all';
  }
}

function zoomMapScope(scope) {
  if (!liveMap) return;
  if (scope === 'indonesia') {
    // Zoom seluruh peta kepulauan Indonesia (Sabang sampai Merauke)
    liveMap.setView([-2.5489, 118.0149], 5);
  } else if (scope === 'world') {
    // Zoom seluruh peta dunia internasional
    liveMap.setView([15, 10], 2);
  } else if (scope === 'mitra') {
    const allMarkers = [...Object.values(mapMarkers), ...Object.values(klienMarkers || {})];
    if (allMarkers.length > 0) {
      const group = L.featureGroup(allMarkers);
      liveMap.fitBounds(group.getBounds().pad(0.25));
    } else {
      liveMap.setView([-2.5489, 118.0149], 5);
      alert('Belum ada mitra atau pemohon yang sedang aktif memancarkan sinyal GPS.');
    }
  }
}

function initLiveMap() {
  if (liveMap) {
    setTimeout(() => liveMap.invalidateSize(), 200);
    return;
  }
  const defaultCenter = [-2.5489, 118.0149]; // Cakupan Nusantara Indonesia & Dunia
  liveMap = L.map('liveTrackingMap', {
    zoomControl: true,
    attributionControl: false,
    minZoom: 2,
    maxZoom: 20
  }).setView(defaultCenter, 5);

  // Default ke OSM (tanpa API key, selalu berfungsi).
  // Hanya beralih ke Google Maps jika ada API key valid di systemConfig.
  const savedProvider = (systemConfig && systemConfig.mapProvider) || 'osm';
  const hasGoogleKey = systemConfig && systemConfig.googleMapsApiKey && systemConfig.googleMapsApiKey.length > 20;
  const isGoogleProvider = ['google_roadmap','google_hybrid','google_terrain'].includes(savedProvider);
  switchAdminMapLayer((isGoogleProvider && hasGoogleKey) ? savedProvider : 'osm');

  liveMap.on('mousemove', (e) => {
    const coordsEl = document.getElementById('mapCenterCoords');
    if (coordsEl) {
      coordsEl.innerText = `Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`;
    }
  });

  setTimeout(() => liveMap.invalidateSize(), 300);
}

function createMarkerIcon(status, isPremium) {
  let bgColor = '#10B981'; // Ready: Hijau
  let pulseClass = 'pulse-marker-green';
  let iconHtml = '<i class="fa-solid fa-user-check text-white text-[10px]"></i>';

  if (status === 'working') {
    bgColor = '#F59E0B'; // Working: Kuning
    pulseClass = 'pulse-marker-yellow';
    iconHtml = '<i class="fa-solid fa-screwdriver-wrench text-slate-900 text-[10px]"></i>';
  } else if (status === 'offline') {
    bgColor = '#EF4444'; // Offline: Merah
    pulseClass = '';
    iconHtml = '<i class="fa-solid fa-power-off text-white text-[10px]"></i>';
  }

  const crownHtml = isPremium ? '<span class="absolute -top-1 -right-1 text-amber-300 text-[10px] z-20"><i class="fa-solid fa-crown"></i></span>' : '';

  // Icon Orang Mengendarai Sepeda Motor dengan Helm (Motorcycle Rider with Helmet)
  const riderSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="46" height="46" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
      <!-- Lingkaran Dasar & Glow -->
      <circle cx="32" cy="32" r="30" fill="${bgColor}" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-dasharray="3,2"/>
      
      <!-- Grafik Sepeda Motor & Pengendara Berhelm -->
      <g transform="translate(4, 4)">
        <!-- Roda Belakang -->
        <circle cx="14" cy="38" r="7.5" fill="#0f172a" stroke="#e2e8f0" stroke-width="2"/>
        <circle cx="14" cy="38" r="3.5" fill="#64748b"/>
        <!-- Roda Depan -->
        <circle cx="42" cy="38" r="7.5" fill="#0f172a" stroke="#e2e8f0" stroke-width="2"/>
        <circle cx="42" cy="38" r="3.5" fill="#64748b"/>
        <!-- Rangka & Knalpot Motor -->
        <path d="M14 38 L24 38 L30 30 L42 38" stroke="#f1f5f9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M22 38 L26 27 L36 27 L40 34" fill="#fbbf24" stroke="#ffffff" stroke-width="1.2"/>
        <!-- Garpu Depan & Setang -->
        <path d="M42 38 L35 22 L32 20" stroke="#f8fafc" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Lampu Depan Motor -->
        <path d="M37 25 L45 27 L43 31 Z" fill="#fef08a" opacity="0.9"/>
        <!-- Kaki & Badan Pengendara (Jaket) -->
        <path d="M23 29 L28 35 L33 35" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M20 28 C20 23, 24 20, 29 22 L33 27 L25 30 Z" fill="#047857" stroke="#ffffff" stroke-width="1.2"/>
        <!-- Lengan Memegang Setang -->
        <path d="M27 23 L34 22" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
        <!-- HELM PENGENDARA DENGAN KACA VISOR -->
        <ellipse cx="26" cy="15" rx="7" ry="6.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/>
        <path d="M20 15 C20 11, 24 9, 29 10 C33 11, 34 14, 33 17 C31 18, 28 19, 23 18 Z" fill="#ef4444"/>
        <!-- Kaca Helm (Visor) -->
        <path d="M28 13 C32 13, 33 15, 33 17 L27 17 C26 15, 27 13, 28 13 Z" fill="#0284c7" stroke="#0f172a" stroke-width="0.8"/>
        <line x1="28" y1="14" x2="31" y2="15" stroke="#38bdf8" stroke-width="0.8" stroke-linecap="round"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    className: 'custom-motorcycle-rider-marker',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer select-none">
        <span class="${pulseClass} absolute inline-flex h-12 w-12 rounded-full opacity-60"></span>
        <div class="relative z-10">
          ${riderSvg}
        </div>
        ${crownHtml}
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -25]
  });
}

function renderMitraOnMap() {
  if (!liveMap) return;
  // Clear existing markers
  Object.values(mapMarkers).forEach(m => liveMap.removeLayer(m));
  mapMarkers = {};

  mitraList.forEach(m => {
    if (currentFilter !== 'all' && m.status !== currentFilter) return;

    const markerIcon = createMarkerIcon(m.status, m.isPremium);
    const marker = L.marker([m.lat, m.lng], { icon: markerIcon }).addTo(liveMap);

    const statusBadge = m.status === 'ready' 
      ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Siap Order (Hijau)</span>'
      : m.status === 'working'
      ? '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">Sedang Bertugas (Kuning)</span>'
      : '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">Offline (Merah)</span>';

    const popupHtml = `
      <div class="p-4 w-64 bg-slate-900 text-white rounded-xl">
        <div class="flex items-center space-x-3 mb-2">
          <img src="${m.avatar || '/uploads/logo_icon.svg'}" class="w-10 h-10 rounded-full border border-slate-700 object-cover">
          <div>
            <div class="font-bold text-sm flex items-center space-x-1">
              <span>${m.name}</span>
              ${m.isPremium ? '<i class="fa-solid fa-crown text-amber-400 text-xs"></i>' : ''}
            </div>
            <div class="text-[11px] text-slate-400 font-mono">${m.phone}</div>
          </div>
        </div>
        <div class="mb-2">${statusBadge}</div>
        <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-800 p-2 rounded-lg mb-2 text-slate-300">
          <div><i class="fa-solid fa-star text-amber-400 mr-1"></i>Rating: <strong>${(m.completedOrders || 0) > 0 ? (m.rating || 5.0) : '0.0'}</strong></div>
          <div><i class="fa-solid fa-check-circle text-blue-400 mr-1"></i>Selesai: <strong>${m.completedOrders || 0}</strong></div>
          <div class="col-span-2 text-[10px] text-slate-400">Kendaraan: ${m.vehicle || '-'}</div>
        </div>
        <div class="flex space-x-2">
          <button onclick="inspectMitra('${m.id}')" class="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition-all">Lihat Jejak Rute</button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    mapMarkers[m.id] = marker;
  });

  // Tampilkan titik GPS Pemohon Layanan (Klien) aktif di peta pemantauan admin pusat
  if (typeof klienMarkers === 'undefined') window.klienMarkers = {};
  Object.values(klienMarkers).forEach(k => liveMap.removeLayer(k));
  klienMarkers = {};

  if (Array.isArray(klienUsers)) {
    klienUsers.forEach(k => {
      if (!k.lat || !k.lng) return;
      const klienIcon = L.divIcon({
        className: 'custom-klien-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 border-white bg-amber-500 text-white">
              <i class="fa-solid fa-user text-[10px]"></i>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      const kMarker = L.marker([k.lat, k.lng], { icon: klienIcon }).addTo(liveMap);
      kMarker.bindPopup(`
        <div class="p-3 w-52 bg-slate-900 text-white rounded-xl text-xs">
          <div class="font-bold text-amber-400 mb-0.5">${k.name}</div>
          <div class="text-[10px] text-slate-300">Peran: <strong>Pemohon Jasa (Klien)</strong></div>
          <div class="text-[10px] text-slate-400 font-mono">${k.phone || '-'}</div>
          <div class="text-[10px] text-emerald-400 font-mono mt-1">● GPS Nyata Terhubung</div>
        </div>
      `);
      klienMarkers[k.id] = kMarker;
    });
  }

  updateGeofenceCircle();
}

function updateGeofenceCircle() {
  const radiusKm = systemConfig.maxRadiusKm || 10;
  const radiusMeters = radiusKm * 1000;

  if (geofenceCircle) {
    liveMap.removeLayer(geofenceCircle);
  }

  const isChecked = document.getElementById('toggleGeofenceRadius')?.checked ?? true;
  if (isChecked) {
    // Center geofence on active area
    geofenceCircle = L.circle([-6.1754, 106.8272], {
      color: '#3B82F6',
      fillColor: '#3B82F6',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '6, 6',
      radius: radiusMeters
    }).addTo(liveMap);
  }
}

function toggleGeofenceCircle(show) {
  if (geofenceCircle) {
    if (show) liveMap.addLayer(geofenceCircle);
    else liveMap.removeLayer(geofenceCircle);
  }
}

function filterMapMarkers(filter) {
  currentFilter = filter;
  renderMitraOnMap();
}

function renderOrdersOnMap() {
  Object.values(orderMarkers).forEach(m => liveMap.removeLayer(m));
  orderMarkers = {};

  ordersList.forEach(ord => {
    if (ord.status === 'completed' || ord.status === 'cancelled') return;

    addOrderMarker(ord);
  });
}

function addOrderMarker(ord) {
  const flagIcon = L.divIcon({
    className: 'order-flag-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
          <i class="fa-solid fa-cart-shopping text-xs"></i>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });

  const marker = L.marker([ord.lat, ord.lng], { icon: flagIcon }).addTo(liveMap);
  const street = ord.street ? `${ord.street} ${ord.houseNumber ? 'No. ' + ord.houseNumber : ''}` : (ord.address || 'Alamat Belum Terinci');
  const rtrw = (ord.rt || ord.rw) ? `RT ${ord.rt || '-'}/RW ${ord.rw || '-'}` : '';
  const area = [ord.kelurahan ? `Kel. ${ord.kelurahan}` : '', ord.kecamatan ? `Kec. ${ord.kecamatan}` : ''].filter(Boolean).join(', ');
  const benchmark = ord.benchmark ? `<div class="text-[10px] text-amber-300 italic mt-1 flex items-center space-x-1"><span class="material-symbols-outlined text-[10px]">flag</span><span>Patokan: ${ord.benchmark}</span></div>` : '';

  const popupHtml = `
    <div class="p-3 w-64 bg-slate-900 text-white rounded-xl text-xs space-y-1.5">
      <div class="font-bold text-sm text-blue-400 mb-0.5">${ord.title}</div>
      <div class="text-[11px] text-slate-300">Klien: <strong>${ord.clientName || 'Klien'}</strong> &bull; <span class="font-mono text-slate-400">${ord.clientPhone || ''}</span></div>
      <div class="text-[11px] text-emerald-400 font-bold">Biaya: Rp ${(ord.budget || 25000).toLocaleString('id-ID')} (Rekber Admin)</div>
      <div class="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-300">
        <strong class="text-white block">${street}</strong>
        ${rtrw ? `<span class="text-slate-400 block">${rtrw}</span>` : ''}
        ${area ? `<span class="text-slate-400 block">${area}</span>` : ''}
        ${benchmark}
      </div>
      <button onclick="openAdminOrderDetailModal('${ord.id}')" class="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] shadow transition-all">
        Audit &amp; Konfirmasi Foto
      </button>
    </div>
  `;
  marker.bindPopup(popupHtml);
  orderMarkers[ord.id] = marker;
}

// 4. Live GPS Updates Handler
function handleLiveGpsUpdate(data) {
  const mIndex = mitraList.findIndex(m => m.id === data.mitraId);
  if (mIndex !== -1) {
    mitraList[mIndex].lat = data.lat;
    mitraList[mIndex].lng = data.lng;
    mitraList[mIndex].status = data.status;
  }

  // If marker exists, animate pan
  if (mapMarkers[data.mitraId]) {
    mapMarkers[data.mitraId].setLatLng([data.lat, data.lng]);
    mapMarkers[data.mitraId].setIcon(createMarkerIcon(data.status, mitraList[mIndex]?.isPremium));
  } else {
    renderMitraOnMap();
  }

  renderMitraListSidebar();
}

function handleKlienGpsUpdate(data) {
  if (!liveMap) return;
  const kId = data.klienId || data.userId;
  if (!kId) return;

  if (Array.isArray(klienUsers)) {
    const kIndex = klienUsers.findIndex(k => k.id === kId);
    if (kIndex !== -1) {
      klienUsers[kIndex].lat = data.lat;
      klienUsers[kIndex].lng = data.lng;
    }
  }

  if (klienMarkers && klienMarkers[kId]) {
    klienMarkers[kId].setLatLng([data.lat, data.lng]);
  } else {
    renderMitraOnMap();
  }
}

function handleMitraStatusChange(data) {
  const mIndex = mitraList.findIndex(m => m.id === data.mitraId);
  if (mIndex !== -1) {
    mitraList[mIndex].status = data.status;
  } else {
    // Mitra baru mendaftar / online
    loadInitialData();
    return;
  }
  renderMitraOnMap();
  renderMitraListSidebar();
  renderDashboardCounters();
}

// 5. Sidebar & UI Renders
function renderMitraListSidebar() {
  const container = document.getElementById('mitraListContainer');
  if (!container) return;

  if (mitraList.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-400 space-y-2.5">
        <div class="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto text-xl">
          <i class="fa-solid fa-person-digging"></i>
        </div>
        <p class="text-xs font-bold text-slate-200">Belum Ada Mitra Aktif</p>
        <p class="text-[11px] text-slate-400 leading-relaxed">
          Mitra aktif akan otomatis muncul di peta dan daftar ini begitu pekerja mengunduh aplikasi, mendaftar, dan masuk (login).
        </p>
      </div>
    `;
    const countBadge = document.getElementById('activeMitraCountBadge');
    if (countBadge) countBadge.innerText = `0 Mitra`;
    return;
  }

  container.innerHTML = mitraList.map(m => {
    const statusDot = m.status === 'ready' ? 'bg-emerald-500' : m.status === 'working' ? 'bg-amber-500' : 'bg-rose-500';
    const statusText = m.status === 'ready' ? 'Siap Order' : m.status === 'working' ? 'Sedang Bertugas' : 'Offline';

    return `
      <div onclick="focusMitraOnMap('${m.id}')" class="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-700/60 border border-slate-700/80 cursor-pointer transition-all">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full ${statusDot}"></span>
            <span class="font-bold text-slate-200 text-xs">${m.name}</span>
            ${m.isPremium ? '<i class="fa-solid fa-crown text-amber-400 text-[10px]" title="Mitra Premium VIP"></i>' : ''}
          </div>
          <span class="text-[10px] text-slate-400 font-mono">${statusText}</span>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span><i class="fa-solid fa-star text-amber-400 mr-1"></i>${m.rating} (${m.completedOrders} ord)</span>
          <span class="text-blue-400 font-mono">Rp ${(m.walletBalance || 0).toLocaleString('id-ID')}</span>
        </div>
      </div>
    `;
  }).join('');

  const countBadge = document.getElementById('activeMitraCountBadge');
  if (countBadge) countBadge.innerText = `${mitraList.length} Mitra`;
}

function focusMitraOnMap(mitraId) {
  const m = mitraList.find(x => x.id === mitraId);
  if (m && liveMap) {
    liveMap.flyTo([m.lat, m.lng], 16, { duration: 1.2 });
    if (mapMarkers[mitraId]) {
      mapMarkers[mitraId].openPopup();
    }
  }
}

function renderDashboardCounters() {
  const ready = mitraList.filter(m => m.status === 'ready').length;
  const working = mitraList.filter(m => m.status === 'working').length;
  const offline = mitraList.filter(m => m.status === 'offline').length;

  document.getElementById('statReadyCount').innerText = ready;
  document.getElementById('statWorkingCount').innerText = working;
  document.getElementById('statOfflineCount').innerText = offline;
  document.getElementById('badgeOnlineCount').innerText = `${ready + working} Aktif`;

  const radius = systemConfig.maxRadiusKm || 10;
  document.getElementById('statRadiusDisplay').innerText = `${radius} KM`;

  document.getElementById('statTotalOrders').innerText = ordersList.length;

  // Revenue calculation
  const platformFee = systemConfig.platformFee || 3000;
  const commPercent = systemConfig.serviceFeePercentage || 10;
  const completedOrders = ordersList.filter(o => o.status === 'completed');
  let estRev = completedOrders.length * platformFee;
  completedOrders.forEach(o => {
    if (o.budget) {
      estRev += (o.budget * commPercent) / 100;
    }
  });
  document.getElementById('statPlatformRevenue').innerText = `Rp ${Math.round(estRev).toLocaleString('id-ID')}`;

  // KYC badge
  const pendingKyc = kycList.filter(k => k.status === 'pending').length;
  document.getElementById('badgeKycCount').innerText = pendingKyc;
  document.getElementById('kycPendingCountLabel').innerText = `${pendingKyc} Menunggu Persetujuan`;

  // Withdraw badge
  const pendingWd = withdrawalsList.filter(w => w.status === 'pending').length;
  document.getElementById('badgeWdCount').innerText = pendingWd;
  document.getElementById('withdrawPendingBadge').innerText = `${pendingWd} Pending`;
}

// 6. Navigation Tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('border-blue-500', 'text-blue-400');
    btn.classList.add('border-transparent');
  });

  const targetTab = document.getElementById(`tab-${tabId}`);
  const targetBtn = document.getElementById(`tabBtn-${tabId}`);
  if (targetTab) targetTab.classList.remove('hidden');
  if (targetBtn) {
    targetBtn.classList.remove('border-transparent');
    targetBtn.classList.add('border-blue-500', 'text-blue-400');
  }

  // Refresh Leaflet maps when visible
  if (tabId === 'tracking') {
    if (!liveMap) initLiveMap();
    else setTimeout(() => liveMap.invalidateSize(), 200);
  }
  if (tabId === 'route-history') {
    // Inisialisasi atau aktifkan kembali Google Maps Live rute
    initRouteMap();
    populateMitraRouteSelect();
    [50, 150, 350, 800].forEach(delay => {
      setTimeout(() => {
        if (routeMap) routeMap.invalidateSize();
        const lo = document.getElementById('routeMapLoading');
        if (lo) lo.style.display = 'none';
      }, delay);
    });
  }
  if (tabId === 'metrics') {
    if (!revenueChartInstance) initCharts();
    refreshMetrics();
  }
  if (tabId === 'broadcast') {
    loadBroadcastHistory();
  }
  // Re-render categories setiap kali tab dibuka agar selalu fresh
  if (tabId === 'categories') {
    // Jika belum ada data, fetch dulu
    if (!categoriesList || categoriesList.length === 0) {
      fetch(`${API_BASE}/api/categories`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data) {
            categoriesList = res.data;
            renderCategoriesGrid();
            populateCategorySelects();
          }
        })
        .catch(e => console.error('Gagal muat kategori:', e));
    } else {
      renderCategoriesGrid();
    }
  }
}

// 7. Route History & Geofencing
// Tile configs untuk routeMap (Google Maps Live Permanen Tanpa Blank Hitam)
const ROUTE_MAP_TILES = [
  { name: 'Google Maps Live', url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', sub: ['mt0','mt1','mt2','mt3'], zoom: 20 },
  { name: 'Google Satelit Hybrid', url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', sub: ['mt0','mt1','mt2','mt3'], zoom: 20 },
  { name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', sub: ['a','b','c'], zoom: 19 }
];

let routeMapTileLayer = null;
let routeMapTileIdx = 0;

function _applyRouteTile(idx) {
  const cfg = ROUTE_MAP_TILES[idx % ROUTE_MAP_TILES.length];
  if (routeMapTileLayer && routeMap) {
    try { routeMap.removeLayer(routeMapTileLayer); } catch(e) {}
  }
  const opts = { maxZoom: cfg.zoom, attribution: `© ${cfg.name} | SobatSerabut Terpusat` };
  if (cfg.sub) opts.subdomains = cfg.sub;
  routeMapTileLayer = L.tileLayer(cfg.url, opts);
  if (routeMap) routeMapTileLayer.addTo(routeMap);

  // Jika gagal load tile, coba provider berikutnya
  routeMapTileLayer.on('tileerror', () => {
    console.warn(`[RouteMap] Tile error pada ${cfg.name}, mencoba fallback...`);
    const nextIdx = (idx + 1) % ROUTE_MAP_TILES.length;
    if (nextIdx !== routeMapTileIdx) {
      routeMapTileIdx = nextIdx;
      setTimeout(() => _applyRouteTile(nextIdx), 400);
    }
  });
  routeMapTileIdx = idx;

  // Sembunyikan loading overlay
  const lo = document.getElementById('routeMapLoading');
  if (lo) lo.style.display = 'none';

  // Update switcher label jika ada
  const lbl = document.getElementById('routeTileLabel');
  if (lbl) lbl.textContent = cfg.name;
}

function switchRouteTile() {
  const next = (routeMapTileIdx + 1) % ROUTE_MAP_TILES.length;
  _applyRouteTile(next);
}

function initRouteMap() {
  const mapEl = document.getElementById('routeMap');
  if (!mapEl) return;

  // Bersihkan instance lama jika ada (cegah error "Map already initialized")
  if (routeMap) {
    try {
      setTimeout(() => {
        routeMap.invalidateSize();
        const lo = document.getElementById('routeMapLoading');
        if (lo) lo.style.display = 'none';
      }, 100);
      setTimeout(() => { if (routeMap) routeMap.invalidateSize(); }, 400);
    } catch(e) {}
    return;
  }

  // Simpan loading overlay sebelum reset innerHTML
  const loadingEl = document.getElementById('routeMapLoading');
  const loadingHTML = loadingEl ? loadingEl.outerHTML : '';

  // Reset elemen agar Leaflet dapat attach ulang
  mapEl.innerHTML = '';
  if (mapEl._leaflet_id) { delete mapEl._leaflet_id; }

  // Restore loading overlay agar tampil saat peta memuat
  if (loadingHTML) {
    mapEl.insertAdjacentHTML('beforeend', loadingHTML);
  }

  routeMap = L.map('routeMap', {
    zoomControl: true,
    attributionControl: true,
    minZoom: 3,
    maxZoom: 20,
    preferCanvas: true
  }).setView([-6.2088, 106.8456], 12); // Default: Jabodetabek / Indonesia

  // Google Maps Live permanen default
  _applyRouteTile(0);

  routeMarkersGroup = L.layerGroup().addTo(routeMap);

  // Sembunyikan loading overlay secara aman
  function _hideRouteMapLoading() {
    const lo = document.getElementById('routeMapLoading');
    if (lo) lo.style.display = 'none';
  }

  if (routeMapTileLayer) {
    routeMapTileLayer.once('load', _hideRouteMapLoading);
  }
  setTimeout(_hideRouteMapLoading, 800);

  // Invalidate size setelah render DOM selesai agar tidak blank hitam
  [100, 300, 700, 1200].forEach(delay => {
    setTimeout(() => {
      if (routeMap) {
        routeMap.invalidateSize();
        _hideRouteMapLoading();
      }
    }, delay);
  });

  // Auto-load mitra pertama jika ada
  const select = document.getElementById('mitraRouteSelect') || document.getElementById('routeMitraSelect');
  if (select && select.value) {
    loadMitraRoute(select.value);
  } else if (mitraList && mitraList.length > 0) {
    loadMitraRoute(mitraList[0].id);
    if (select) select.value = mitraList[0].id;
  }
}

function populateMitraRouteSelect() {
  const optionsHtml = mitraList.map(m =>
    `<option value="${m.id}">${m.name} (${m.status === 'ready' ? 'Siap' : m.status === 'working' ? 'Bekerja' : 'Offline'})</option>`
  ).join('');

  // Populate legacy select (kept for backward compatibility)
  const select = document.getElementById('routeMitraSelect');
  if (select) select.innerHTML = optionsHtml;

  // Populate new enhanced select
  const newSelect = document.getElementById('mitraRouteSelect');
  if (newSelect) {
    newSelect.innerHTML = '<option value="">-- Pilih Mitra --</option>' + optionsHtml;
  }
}

async function loadMitraRoute(mitraId) {
  if (!routeMap) initRouteMap();

  try {
    const res = await fetch(`${API_BASE}/api/admin/route-history/${mitraId}`).then(r => r.json());
    const waypoints = res.data || [];

    if (routePolyline) routeMap.removeLayer(routePolyline);
    routeMarkersGroup.clearLayers();

    // Fetch geofencing logs to update UI status cards
    let geofenceItem = null;
    try {
      const geoRes = await fetch(`${API_BASE}/api/admin/geofencing-logs`).then(r => r.json());
      if (geoRes.success && geoRes.data) {
        geofenceItem = geoRes.data.find(g => g.mitraId === mitraId);
      }
    } catch(e) {}

    // Update Geofence Badge & Description
    const geoStatus = geofenceItem ? geofenceItem.geofenceStatus : (waypoints.length > 0 && waypoints[waypoints.length - 1].geofenceStatus ? waypoints[waypoints.length - 1].geofenceStatus : 'IDLE');
    const badgeZone = document.getElementById('adminGeofenceZoneBadge');
    const descZone = document.getElementById('adminGeofenceDesc');
    const distTask = document.getElementById('adminDistToTask');

    if (badgeZone) {
      badgeZone.innerText = geoStatus;
      if (geoStatus === 'INSIDE_GEOFENCE') {
        badgeZone.className = 'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]';
        if (descZone) descZone.innerText = 'Mitra telah tiba di titik tugas klien (< 200m).';
      } else if (geoStatus === 'NEAR_ZONE') {
        badgeZone.className = 'px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px]';
        if (descZone) descZone.innerText = 'Mitra mendekati radius area tugas (< 1 km).';
      } else if (geoStatus === 'EN_ROUTE') {
        badgeZone.className = 'px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]';
        if (descZone) descZone.innerText = 'Mitra sedang dalam perjalanan meluncur ke lokasi.';
      } else {
        badgeZone.className = 'px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 font-bold text-[10px]';
        if (descZone) descZone.innerText = 'Mitra standby / belum dalam penugasan aktif.';
      }
    }

    if (distTask) {
      if (waypoints.length > 0 && waypoints[waypoints.length - 1].distToTaskKm) {
        distTask.innerText = `${waypoints[waypoints.length - 1].distToTaskKm.toFixed(2)} km`;
      } else {
        distTask.innerText = '-';
      }
    }

    // Off-route alert card
    const offRouteBadge = document.getElementById('adminOffRouteBadge');
    const offRouteDesc = document.getElementById('adminOffRouteDesc');
    const hasOffRoute = (geofenceItem && geofenceItem.hasOffRouteAlert) || waypoints.some(w => w.isOffRoute);
    if (offRouteBadge) {
      if (hasOffRoute) {
        offRouteBadge.innerText = 'Peringatan Melenceng';
        offRouteBadge.className = 'px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px]';
        if (offRouteDesc) offRouteDesc.innerText = 'Terdeteksi pergerakan menjauhi rute tugas klien!';
      } else {
        offRouteBadge.innerText = 'Normal';
        offRouteBadge.className = 'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]';
        if (offRouteDesc) offRouteDesc.innerText = 'Rute mitra mengarah langsung ke tujuan tugas klien.';
      }
    }

    // SLA & Duration
    const slaBadge = document.getElementById('adminSlaStatusBadge');
    const totalDurationText = document.getElementById('adminTotalDurationText');
    const completedStatus = document.getElementById('adminCompletedStatus');
    if (geofenceItem && geofenceItem.durationAudit) {
      const dur = geofenceItem.durationAudit;
      if (totalDurationText) totalDurationText.innerText = `${dur.totalMinutes} Menit`;
      if (completedStatus) completedStatus.innerText = dur.statusLabel || dur.status;
      if (slaBadge) {
        slaBadge.innerText = dur.status === 'NORMAL_ON_TIME' ? 'SLA OK' : 'AUDIT FLAG';
        slaBadge.className = dur.status === 'NORMAL_ON_TIME'
          ? 'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]'
          : 'px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px]';
      }
    } else {
      if (totalDurationText) totalDurationText.innerText = waypoints.length > 0 ? `${waypoints.length * 2} mnt (est)` : '-';
      if (completedStatus) completedStatus.innerText = 'Dalam Pemantauan';
    }

    if (waypoints.length === 0) {
      document.getElementById('routePointsCount').innerText = '0 Titik Jejak Terekam';
      document.getElementById('routeWaypointsList').innerHTML = '<div class="p-4 text-center text-slate-500">Belum ada riwayat koordinat GPS untuk mitra ini.</div>';
      return;
    }

    const latLngs = waypoints.map(w => [w.lat, w.lng]);
    routePolyline = L.polyline(latLngs, { color: '#3B82F6', weight: 4, opacity: 0.8 }).addTo(routeMap);

    // Start marker
    const startIcon = L.divIcon({
      html: '<div class="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow"></div>',
      iconSize: [16, 16]
    });
    L.marker(latLngs[0], { icon: startIcon }).addTo(routeMarkersGroup).bindPopup('Titik Mulai Rute');

    // End marker
    const endIcon = L.divIcon({
      html: '<div class="w-5 h-5 rounded-full bg-rose-500 border-2 border-white shadow flex items-center justify-center text-[10px] text-white"><i class="fa-solid fa-flag"></i></div>',
      iconSize: [20, 20]
    });
    L.marker(latLngs[latLngs.length - 1], { icon: endIcon }).addTo(routeMarkersGroup).bindPopup('Lokasi Terkini / Selesai');

    routeMap.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    document.getElementById('routePointsCount').innerText = `${waypoints.length} Titik Jejak Terekam`;

    // Enhanced: update stats panel & audit log
    updateGeoStats(waypoints);

    // Render list
    document.getElementById('routeWaypointsList').innerHTML = waypoints.map((w, idx) => `
      <div class="p-3 bg-slate-900 rounded-xl border border-slate-700/80">
        <div class="flex justify-between items-center mb-1">
          <span class="font-bold text-slate-200">Titik #${idx + 1} (${w.time})</span>
          <span class="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 font-mono text-[10px]">${w.speed || '0 km/h'}</span>
        </div>
        <p class="text-[11px] text-slate-400 mb-1">${w.status || (w.isOffRoute ? '<span class="text-rose-400 font-semibold">Rute Melenceng</span>' : 'Sesuai Jalur')}</p>
        <span class="font-mono text-[10px] text-slate-500">Lat: ${w.lat}, Lng: ${w.lng}</span>
      </div>
    `).reverse().join('');
  } catch (e) {
    console.error('Error loading route history:', e);
  }
}

// ── New enhanced route-history functions ──────────────────────────────────────

// loadRouteHistory: called by the new mitraRouteSelect dropdown & Refresh button
async function loadRouteHistory() {
  const select = document.getElementById('mitraRouteSelect');
  const mitraId = select ? select.value : '';
  if (!mitraId) return;
  await loadMitraRoute(mitraId);
}

// clearRouteHistory: clears the map and resets stats / audit log
function clearRouteHistory() {
  if (routeMap) {
    if (routePolyline) { routeMap.removeLayer(routePolyline); routePolyline = null; }
    if (routeMarkersGroup) routeMarkersGroup.clearLayers();
  }
  const sp = document.getElementById('statTotalPoints');
  const sd = document.getElementById('statDeviated');
  const sdur = document.getElementById('statDuration');
  const sgs = document.getElementById('statGeoStatus');
  if (sp) sp.textContent = '0';
  if (sd) sd.textContent = '0';
  if (sdur) sdur.textContent = '0m';
  if (sgs) sgs.textContent = 'IDLE';

  const auditEl = document.getElementById('routeAuditLog');
  if (auditEl) auditEl.innerHTML = '<div class="text-center py-8 text-slate-500"><i class="fa-solid fa-satellite-dish text-2xl mb-2 block"></i><p class="text-xs">Pilih mitra untuk melihat riwayat GPS</p></div>';

  const tbody = document.getElementById('taskAuditTable');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500"><i class="fa-solid fa-calendar-xmark text-xl mb-1 block"></i>Belum ada data audit tugas</td></tr>';
}

// Enhanced: Update geofence stats dari route data
function updateGeoStats(waypoints) {
  const totalPoints = waypoints.length;
  const deviated = waypoints.filter(w => w.geofenceStatus === 'EN_ROUTE' || w.geofenceStatus === 'IDLE').length;

  let duration = '0m';
  if (totalPoints > 1) {
    const first = new Date(waypoints[0].timestamp);
    const last = new Date(waypoints[totalPoints - 1].timestamp);
    const diffMs = last - first;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    duration = diffHr > 0 ? `${diffHr}j ${diffMin % 60}m` : `${diffMin}m`;
  }

  const lastStatus = totalPoints > 0 ? (waypoints[totalPoints - 1].geofenceStatus || 'IDLE') : 'IDLE';
  const statusMap = {
    'INSIDE_GEOFENCE': '✅ DI ZONA',
    'NEAR_ZONE': '🟡 DEKAT ZONA',
    'EN_ROUTE': '🔵 DI JALAN',
    'IDLE': '⚪ IDLE'
  };

  const sp = document.getElementById('statTotalPoints');
  const sd = document.getElementById('statDeviated');
  const sdur = document.getElementById('statDuration');
  const sgs = document.getElementById('statGeoStatus');
  if (sp) sp.textContent = totalPoints;
  if (sd) sd.textContent = deviated;
  if (sdur) sdur.textContent = duration;
  if (sgs) sgs.textContent = statusMap[lastStatus] || lastStatus;

  // Render audit log
  const auditEl = document.getElementById('routeAuditLog');
  if (auditEl && totalPoints > 0) {
    const statusColors = {
      'INSIDE_GEOFENCE': 'emerald',
      'NEAR_ZONE': 'amber',
      'EN_ROUTE': 'blue',
      'IDLE': 'slate'
    };
    auditEl.innerHTML = waypoints.slice().reverse().map(pt => {
      const color = statusColors[pt.geofenceStatus] || 'slate';
      const ts = new Date(pt.timestamp);
      const timeStr = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = ts.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      return `
        <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40 hover:border-${color}-500/30 transition-all">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-mono text-${color}-400 font-bold">${pt.geofenceStatus || 'IDLE'}</span>
            <span class="text-[10px] text-slate-500">${dateStr} ${timeStr}</span>
          </div>
          <div class="font-mono text-[10px] text-slate-300">
            <i class="fa-solid fa-crosshairs text-${color}-400 mr-1"></i>
            ${typeof pt.lat === 'number' ? pt.lat.toFixed(5) : (pt.lat || '-')},
            ${typeof pt.lng === 'number' ? pt.lng.toFixed(5) : (pt.lng || '-')}
          </div>
          ${pt.distanceToTask ? `<div class="text-[10px] text-slate-500 mt-0.5"><i class="fa-solid fa-ruler mr-1"></i>${(pt.distanceToTask / 1000).toFixed(2)} km dari tugas</div>` : ''}
        </div>
      `;
    }).join('');
  } else if (auditEl) {
    auditEl.innerHTML = '<div class="text-center py-8 text-slate-500"><i class="fa-solid fa-satellite-dish text-2xl mb-2 block"></i><p class="text-xs">Belum ada riwayat GPS untuk mitra ini</p></div>';
  }

  // Render task audit table dari orders
  renderTaskAuditTable();
}

function renderTaskAuditTable() {
  const tbody = document.getElementById('taskAuditTable');
  if (!tbody) return;

  const completedOrders = (ordersList || []).filter(o => o.status === 'completed' || o.status === 'working');

  if (completedOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500"><i class="fa-solid fa-calendar-xmark text-xl mb-1 block"></i>Belum ada data audit tugas</td></tr>';
    return;
  }

  tbody.innerHTML = completedOrders.slice(0, 20).map(o => {
    const startTime = o.acceptedAt || o.createdAt;
    const endTime = o.completedAt || o.updatedAt;
    let duration = '-';
    if (startTime && endTime) {
      const diffMs = new Date(endTime) - new Date(startTime);
      const diffMin = Math.floor(Math.abs(diffMs) / 60000);
      const diffHr = Math.floor(diffMin / 60);
      duration = diffHr > 0 ? `${diffHr}j ${diffMin % 60}m` : `${diffMin}m`;
    }

    const statusBadge = o.status === 'completed'
      ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">✅ Selesai</span>'
      : o.status === 'working'
      ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">🔧 Berjalan</span>'
      : `<span class="px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-semibold">${o.status}</span>`;

    const startStr = startTime ? new Date(startTime).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
    const endStr = endTime ? new Date(endTime).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

    return `<tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
      <td class="px-4 py-2.5 font-mono text-blue-400 font-bold">${o.id}</td>
      <td class="px-4 py-2.5 text-slate-200">${o.serviceType || o.category || '-'}</td>
      <td class="px-4 py-2.5 text-slate-300">${o.mitraName || o.mitraId || '-'}</td>
      <td class="px-4 py-2.5 text-slate-400 font-mono text-[10px]">${startStr}</td>
      <td class="px-4 py-2.5 text-slate-400 font-mono text-[10px]">${endStr}</td>
      <td class="px-4 py-2.5 font-bold text-white">${duration}</td>
      <td class="px-4 py-2.5">${statusBadge}</td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────

function inspectMitra(mitraId) {
  switchTab('route-history');
  const sel = document.getElementById('routeMitraSelect');
  if (sel) {
    sel.value = mitraId;
    loadMitraRoute(mitraId);
  }
}

let currentInspectedOrder = null;

function renderOrdersAuditTable() {
  const tbody = document.getElementById('ordersAuditTbody');
  const countEl = document.getElementById('adminOrdersAuditCount');
  if (!tbody) return;

  if (countEl) countEl.innerText = `${ordersList.length} Tugas Terekam`;

  if (ordersList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-slate-500 italic">Belum ada data tugas untuk diaudit.</td></tr>';
    return;
  }

  tbody.innerHTML = ordersList.map(o => {
    // Bukti Foto Selesai & Foto Kebutuhan Klien
    const proofUrl = o.proofPhoto ? (o.proofPhoto.startsWith('http') ? o.proofPhoto : `${API_BASE}${o.proofPhoto}`) : null;
    const taskPhotoUrl = o.taskPhoto ? (o.taskPhoto.startsWith('http') ? o.taskPhoto : `${API_BASE}${o.taskPhoto}`) : null;

    let proofBadge = '';
    if (o.proofConfirmed === true) {
      proofBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30 flex items-center space-x-1 mt-1"><span class="material-symbols-outlined text-[11px]">verified</span><span>Foto Sesuai</span></span>';
    } else if (o.proofConfirmed === false) {
      proofBadge = '<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/30 flex items-center space-x-1 mt-1"><span class="material-symbols-outlined text-[11px]">error</span><span>Diragukan</span></span>';
    } else if (proofUrl) {
      proofBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30 flex items-center space-x-1 mt-1"><span class="material-symbols-outlined text-[11px]">hourglass_empty</span><span>Menunggu Konfirmasi</span></span>';
    }

    const proofHtml = `
      <div class="flex items-center space-x-1.5">
        ${proofUrl 
          ? `<img src="${proofUrl}" onclick="openKycPreview('${proofUrl}', 'Bukti Foto Tugas Selesai: ${o.title}')" class="w-11 h-9 rounded-lg border border-slate-600 object-cover cursor-pointer hover:scale-110 shadow transition-transform" title="Klik perbesar bukti foto mitra">` 
          : `<span class="text-[10px] text-slate-500 italic">No Bukti</span>`}
        ${taskPhotoUrl 
          ? `<img src="${taskPhotoUrl}" onclick="openKycPreview('${taskPhotoUrl}', 'Foto Kebutuhan Pemohon: ${o.title}')" class="w-11 h-9 rounded-lg border border-blue-500/50 object-cover cursor-pointer hover:scale-110 shadow transition-transform" title="Klik perbesar foto kebutuhan klien">` 
          : ''}
      </div>
      ${proofBadge}
    `;

    // Alamat Presisi & Titik Akurat (Jalan, No. Rumah, RT/RW, Kelurahan, Kecamatan, Patokan)
    const street = o.street ? `${o.street} ${o.houseNumber ? 'No. ' + o.houseNumber : ''}` : (o.address || '-');
    const rtrw = (o.rt || o.rw) ? `RT ${o.rt || '-'}/RW ${o.rw || '-'}` : '';
    const kelKec = [o.kelurahan ? `Kel. ${o.kelurahan}` : '', o.kecamatan ? `Kec. ${o.kecamatan}` : '', o.city || ''].filter(Boolean).join(', ');
    const benchmark = o.benchmark ? `<div class="text-[10px] text-amber-300 flex items-center space-x-1 mt-0.5"><span class="material-symbols-outlined text-[11px]">flag</span><span>Patokan: ${o.benchmark}</span></div>` : '';
    const mapsLink = (o.lat && o.lng) 
      ? `<a href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" class="inline-flex items-center space-x-1 text-[10px] text-blue-400 hover:text-blue-300 font-mono mt-0.5"><span class="material-symbols-outlined text-xs">pin_drop</span><span>${Number(o.lat).toFixed(4)}, ${Number(o.lng).toFixed(4)}</span></a>` 
      : '';

    const addressHtml = `
      <div class="text-xs">
        <strong class="text-white block">${street}</strong>
        ${rtrw ? `<span class="text-[10px] text-slate-300 block">${rtrw}</span>` : ''}
        ${kelKec ? `<span class="text-[10px] text-slate-400 block">${kelKec}</span>` : ''}
        ${benchmark}
        ${mapsLink}
      </div>
    `;

    // Durasi pengerjaan
    let durationHtml = '<span class="text-slate-500">-</span>';
    if (o.durationAudit) {
      const dur = o.durationAudit;
      durationHtml = `
        <div class="font-mono text-xs">
          <span class="font-bold text-white">${dur.totalMinutes} mnt</span>
          <span class="text-[10px] text-slate-400 block">Jalan: ${dur.travelMinutes}m | Kerja: ${dur.workMinutes}m</span>
        </div>
      `;
    } else if (o.completedAt && o.createdAt) {
      const mins = Math.max(1, Math.round((new Date(o.completedAt) - new Date(o.createdAt)) / 60000));
      durationHtml = `<span class="font-mono text-xs text-white font-bold">${mins} menit</span>`;
    } else if (o.status === 'working') {
      durationHtml = `<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">Sedang dikerjakan</span>`;
    }

    // Status Badge
    const statusBadge = o.status === 'completed'
      ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">Selesai</span>'
      : o.status === 'working'
      ? '<span class="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">Dikerjakan</span>'
      : o.status === 'assigned'
      ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">Menuju Lokasi</span>'
      : '<span class="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 font-bold">Mencari Mitra</span>';

    // Mitra Penyedia
    const mitraObj = mitraList.find(m => m.id === o.assignedMitraId);
    const mitraDisplayName = mitraObj ? mitraObj.name : (o.assignedMitraName || o.assignedMitraId || '<span class="text-slate-500 italic">Belum Ada</span>');

    // Pencairan Rekening
    let payoutHtml = '<span class="text-slate-500">-</span>';
    if (o.payoutDetails) {
      const p = o.payoutDetails;
      payoutHtml = `
        <div class="font-mono text-xs">
          <div class="font-bold text-emerald-400">Rp ${(p.amount || 0).toLocaleString('id-ID')}</div>
          <div class="text-[10px] text-slate-300 font-semibold">${p.bankName || 'BANK'}: ${p.accountNumber || '-'}</div>
          <span class="text-[9px] text-emerald-500/80 block">Otomatis Ditransfer</span>
        </div>
      `;
    } else if (o.status === 'completed') {
      const net = Math.round((o.budget || 25000) * 0.9);
      payoutHtml = `
        <div class="font-mono text-xs">
          <div class="font-bold text-emerald-400">Rp ${net.toLocaleString('id-ID')}</div>
          <span class="text-[9px] text-emerald-500/80 block">Ditransfer ke Rekening Mitra</span>
        </div>
      `;
    } else {
      payoutHtml = `<span class="text-[11px] text-slate-500 font-mono">Rp ${(o.budget || 0).toLocaleString('id-ID')} (Tertahan)</span>`;
    }

    return `
      <tr class="hover:bg-slate-800/60 transition-all">
        <td class="p-3">
          <span class="font-mono text-[10px] text-slate-400 block">${o.id}</span>
          <strong class="text-white text-xs">${o.title}</strong>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 font-medium text-[11px]">${o.category || 'Umum'}</span>
        </td>
        <td class="p-3">
          <div class="font-semibold text-white text-xs">${o.clientName || 'Klien'}</div>
          <span class="font-mono text-[10px] text-slate-400">${o.clientPhone || '-'}</span>
        </td>
        <td class="p-3">${addressHtml}</td>
        <td class="p-3">
          <div class="font-semibold text-slate-200 text-xs">${mitraDisplayName}</div>
        </td>
        <td class="p-3">${proofHtml}</td>
        <td class="p-3">${durationHtml}</td>
        <td class="p-3">${payoutHtml}</td>
        <td class="p-3 text-right">
          <div class="flex items-center justify-end space-x-1.5">
            <button onclick="openAdminOrderDetailModal('${o.id}')" class="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow flex items-center space-x-1 transition-all" title="Lihat Foto & Detail Lengkap">
              <span class="material-symbols-outlined text-xs">visibility</span>
              <span>Detail &amp; Foto</span>
            </button>
            ${proofUrl ? `
              <button onclick="confirmTaskProofInline('${o.id}', 'approved')" class="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 font-bold transition-all" title="Konfirmasi Foto Valid & Sesuai">
                <span class="material-symbols-outlined text-xs">check</span>
              </button>
              <button onclick="confirmTaskProofInline('${o.id}', 'disputed')" class="p-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-bold transition-all" title="Tolak / Foto Diragukan">
                <span class="material-symbols-outlined text-xs">close</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAdminOrderDetailModal(orderId) {
  const o = ordersList.find(ord => ord.id === orderId);
  if (!o) return;
  currentInspectedOrder = o;

  document.getElementById('adminOrderModalTitle').innerText = `Audit Tugas: ${o.title} (${o.id})`;

  const proofUrl = o.proofPhoto ? (o.proofPhoto.startsWith('http') ? o.proofPhoto : `${API_BASE}${o.proofPhoto}`) : null;
  const taskPhotoUrl = o.taskPhoto ? (o.taskPhoto.startsWith('http') ? o.taskPhoto : `${API_BASE}${o.taskPhoto}`) : null;
  const mitraObj = mitraList.find(m => m.id === o.assignedMitraId);
  const mitraName = mitraObj ? mitraObj.name : (o.assignedMitraName || o.assignedMitraId || 'Belum Ditugaskan');
  const mitraPhone = mitraObj ? mitraObj.phone : '-';

  const street = o.street ? `${o.street} ${o.houseNumber ? 'No. ' + o.houseNumber : ''}` : (o.address || '-');
  const rtrw = (o.rt || o.rw) ? `RT ${o.rt || '-'}/RW ${o.rw || '-'}` : '-';
  const kel = o.kelurahan || '-';
  const kec = o.kecamatan || '-';
  const city = o.city || 'Indonesia';
  const benchmark = o.benchmark || '-';

  const modalContent = document.getElementById('adminOrderDetailContent');
  modalContent.innerHTML = `
    <!-- Status & Konfirmasi Bar -->
    <div class="p-3.5 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-between">
      <div>
        <span class="text-[10px] text-slate-400 uppercase font-mono block">Status Pesanan:</span>
        <span class="font-extrabold text-sm text-white capitalize">${o.status} &bull; ${o.category || 'Umum'}</span>
      </div>
      <div>
        ${o.proofConfirmed === true 
          ? '<span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center space-x-1"><span class="material-symbols-outlined text-sm">verified</span><span>Foto Dikonfirmasi Valid & Sesuai</span></span>' 
          : (o.proofConfirmed === false 
            ? '<span class="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center space-x-1"><span class="material-symbols-outlined text-sm">error</span><span>Foto Ditolak / Diragukan</span></span>' 
            : '<span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center space-x-1"><span class="material-symbols-outlined text-sm">hourglass_empty</span><span>Menunggu Verifikasi Admin</span></span>')}
      </div>
    </div>

    <!-- Foto Kebutuhan vs Foto Bukti Selesai (Side by Side Comparison) -->
    <div class="grid grid-cols-2 gap-3">
      <!-- Foto Bukti Selesai dari Mitra -->
      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-700 text-center space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-300 text-xs flex items-center space-x-1">
            <span class="material-symbols-outlined text-emerald-400 text-sm">photo_camera</span>
            <span>Bukti Foto Selesai (Mitra)</span>
          </span>
          <span class="text-[10px] text-emerald-400 font-mono font-bold">Kamera Asli</span>
        </div>
        ${proofUrl ? `
          <div onclick="openKycPreview('${proofUrl}', 'Bukti Hasil Pekerjaan Selesai: ${o.title}')" class="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-700 bg-black">
            <img src="${proofUrl}" class="h-40 w-full object-cover group-hover:scale-105 transition-transform">
            <span class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white font-bold text-xs transition-opacity">Klik untuk Perbesar</span>
          </div>
        ` : '<div class="h-40 rounded-xl bg-slate-950 flex items-center justify-center text-slate-500 text-xs italic">Mitra belum mengunggah bukti foto</div>'}
        <span class="text-[10px] text-slate-400 block">${o.proofNotes || 'Foto hasil tugas nyata dari perangkat mitra.'}</span>
      </div>

      <!-- Foto Kebutuhan / Masalah dari Klien -->
      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-700 text-center space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-300 text-xs flex items-center space-x-1">
            <span class="material-symbols-outlined text-blue-400 text-sm">add_photo_alternate</span>
            <span>Foto Kebutuhan Awal (Klien)</span>
          </span>
          <span class="text-[10px] text-blue-400 font-mono font-bold">Permintaan</span>
        </div>
        ${taskPhotoUrl ? `
          <div onclick="openKycPreview('${taskPhotoUrl}', 'Foto Kebutuhan Awal Pemohon: ${o.title}')" class="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-700 bg-black">
            <img src="${taskPhotoUrl}" class="h-40 w-full object-cover group-hover:scale-105 transition-transform">
            <span class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white font-bold text-xs transition-opacity">Klik untuk Perbesar</span>
          </div>
        ` : '<div class="h-40 rounded-xl bg-slate-950 flex items-center justify-center text-slate-500 text-xs italic">Klien tidak melampirkan foto awal</div>'}
        <span class="text-[10px] text-slate-400 block">Lampiran kondisi/barang oleh klien saat posting.</span>
      </div>
    </div>

    <!-- Data Alamat Sangat Akurat (RT/RW, No Rumah, Kelurahan, Kecamatan, Patokan) -->
    <div class="p-3.5 rounded-2xl bg-slate-900 border border-slate-700 space-y-2">
      <div class="flex items-center justify-between text-xs font-bold text-emerald-400">
        <div class="flex items-center space-x-1.5">
          <span class="material-symbols-outlined text-sm">pin_drop</span>
          <span>Data Alamat &amp; Titik Lokasi Akurat</span>
        </div>
        ${(o.lat && o.lng) ? `
          <a href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold flex items-center space-x-1 transition-all">
            <span class="material-symbols-outlined text-xs">navigation</span>
            <span>Buka di Google Maps</span>
          </a>
        ` : ''}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
        <div class="col-span-2">
          <span class="text-[10px] text-slate-400 block">Jalan &amp; No. Rumah:</span>
          <span class="font-bold text-white">${street}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">RT / RW:</span>
          <span class="font-mono font-bold text-slate-200">${rtrw}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Kelurahan:</span>
          <span class="font-bold text-slate-200">${kel}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Kecamatan:</span>
          <span class="font-bold text-slate-200">${kec}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Kota / Kabupaten:</span>
          <span class="font-bold text-slate-200">${city}</span>
        </div>
        <div class="col-span-2 sm:col-span-3 p-2 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs">
          <strong class="font-bold flex items-center space-x-1 mb-0.5">
            <span class="material-symbols-outlined text-xs">flag</span>
            <span>Catatan Patokan Pemohon:</span>
          </strong>
          <span>${benchmark}</span>
        </div>
      </div>
    </div>

    <!-- Data Para Pihak & Finansial -->
    <div class="grid grid-cols-2 gap-3 text-xs">
      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-700 space-y-1">
        <span class="text-[10px] text-slate-400 uppercase font-mono block">Pemohon (Klien)</span>
        <div class="font-bold text-white">${o.clientName || 'Klien'}</div>
        <div class="text-[11px] text-slate-300 font-mono">${o.clientPhone || '-'}</div>
        <div class="text-[10px] text-emerald-400 pt-1">Total Pembayaran: Rp ${(o.totalPayment || o.budget || 25000).toLocaleString('id-ID')}</div>
      </div>

      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-700 space-y-1">
        <span class="text-[10px] text-slate-400 uppercase font-mono block">Mitra Pelaksana</span>
        <div class="font-bold text-white">${mitraName}</div>
        <div class="text-[11px] text-slate-300 font-mono">${mitraPhone}</div>
        <div class="text-[10px] text-emerald-400 pt-1">Hak Bersih Mitra: Rp ${(o.mitraNetEarnings || Math.round((o.budget||25000)*0.9)).toLocaleString('id-ID')}</div>
      </div>
    </div>
  `;

  document.getElementById('adminOrderDetailModal').classList.remove('hidden');
}

function closeAdminOrderDetailModal() {
  document.getElementById('adminOrderDetailModal').classList.add('hidden');
  currentInspectedOrder = null;
}

async function submitAdminProofConfirmation(status) {
  if (!currentInspectedOrder) return;
  const isApproved = (status === 'approved');
  const promptNotes = prompt(
    isApproved 
      ? 'Konfirmasi Bukti Foto Sesuai:\nMasukkan catatan konfirmasi verifikasi (opsional):'
      : 'Tolak Bukti Foto:\nMasukkan alasan mengapa foto ditolak / diragukan:',
    isApproved ? 'Bukti foto pengerjaan tugas valid dan sesuai konfirmasi Admin.' : 'Bukti foto kurang jelas / tidak sesuai kebutuhan.'
  );

  if (promptNotes === null) return; // user cancelled

  try {
    const res = await fetch(`${API_BASE}/api/admin/orders/${currentInspectedOrder.id}/confirm-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken || localStorage.getItem('sobatserabut_admin_token') || ''}`
      },
      body: JSON.stringify({ status, notes: promptNotes })
    }).then(r => r.json());

    if (res.success) {
      alert(res.message);
      // update local
      const idx = ordersList.findIndex(x => x.id === currentInspectedOrder.id);
      if (idx !== -1) {
        ordersList[idx].proofConfirmed = isApproved;
        ordersList[idx].proofNotes = promptNotes;
      }
      closeAdminOrderDetailModal();
      renderOrdersAuditTable();
    } else {
      alert(res.message || 'Gagal mengonfirmasi bukti foto tugas.');
    }
  } catch(e) {
    alert('Kesalahan koneksi: ' + e.message);
  }
}

async function confirmTaskProofInline(orderId, status) {
  const isApproved = (status === 'approved');
  if (!confirm(`Apakah Anda yakin ingin menandai bukti foto tugas ${orderId} sebagai ${isApproved ? 'VALID & SESUAI' : 'DITOLAK / DIRAGUKAN'}?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/confirm-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken || localStorage.getItem('sobatserabut_admin_token') || ''}`
      },
      body: JSON.stringify({
        status,
        notes: isApproved ? 'Bukti foto pengerjaan tugas valid dan sesuai konfirmasi Admin.' : 'Bukti foto diragukan oleh admin.'
      })
    }).then(r => r.json());

    if (res.success) {
      const idx = ordersList.findIndex(x => x.id === orderId);
      if (idx !== -1) {
        ordersList[idx].proofConfirmed = isApproved;
      }
      renderOrdersAuditTable();
    } else {
      alert(res.message || 'Gagal mengubah status foto.');
    }
  } catch(e) {
    alert('Kesalahan koneksi: ' + e.message);
  }
}

// 8. CMS & Dynamic Pricing Configuration
function applyConfigToUI(cfg) {
  if (!cfg) return;

  // Header info
  document.getElementById('headerAppName').innerHTML = `${cfg.appName.slice(0, 5)}<span class="text-blue-500">${cfg.appName.slice(5) || ''}</span>`;
  document.getElementById('headerAppTagline').innerText = cfg.appTagline || '';
  
  if (cfg.logoUrl) {
    document.getElementById('appHeaderLogo').src = cfg.logoUrl.startsWith('http') ? cfg.logoUrl : `${API_BASE}${cfg.logoUrl}`;
    document.getElementById('cmsLogoPreview').src = cfg.logoUrl.startsWith('http') ? cfg.logoUrl : `${API_BASE}${cfg.logoUrl}`;
  }
  if (cfg.appIconUrl) {
    const iconPreview = document.getElementById('cmsIconPreview');
    if (iconPreview) iconPreview.src = cfg.appIconUrl.startsWith('http') ? cfg.appIconUrl : `${API_BASE}${cfg.appIconUrl}`;
  }

  // Inputs
  document.getElementById('cmsAppNameInput').value = cfg.appName || '';
  document.getElementById('cmsAppTaglineInput').value = cfg.appTagline || '';
  const rVal = cfg.radarRadiusMeters || ((cfg.maxRadiusKm || 2) * 1000);
  const rSlider = document.getElementById('cmsRadiusSlider');
  if (rSlider) rSlider.value = rVal;
  updateRadarSliderVal(rVal);
  document.getElementById('cmsBaseFareInput').value = cfg.baseFare || 25000;
  document.getElementById('cmsFarePerKmInput').value = cfg.farePerKm || 3500;
  document.getElementById('cmsPlatformFeeInput').value = cfg.platformFee || 3000;
  document.getElementById('cmsCommissionInput').value = cfg.serviceFeePercentage || 10;
  document.getElementById('cmsPremiumPriceInput').value = cfg.premiumSubscriptionPrice || 50000;
  document.getElementById('cmsMaintenanceMessageInput').value = cfg.maintenanceMessage || '';

  if (document.getElementById('cmsOtpSenderInput')) {
    document.getElementById('cmsOtpSenderInput').value = cfg.otpSenderNumber || '087791201091';
  }
  if (document.getElementById('cmsFonnteTokenInput')) {
    document.getElementById('cmsFonnteTokenInput').value = cfg.fonnteToken || '';
  }
  if (document.getElementById('cmsOtpMessageFormatInput')) {
    document.getElementById('cmsOtpMessageFormatInput').value = cfg.otpMessageFormat || 
      '🤖 [BOT RESMI SOBATSERABUT - 087791201091]\nKODE VERIFIKASI OTP ANDA: *{otpCode}*\n\n⚠️ PERINGATAN RESMI:\n"jangan berikan kode otp ini kepada siapapun"\n\nKode rahasia ini bersifat pribadi untuk keamanan akun Anda dan berlaku selama 5 menit.';
  }
  if (document.getElementById('cmsAnnouncementInput')) {
    document.getElementById('cmsAnnouncementInput').value = cfg.announcement || '';
  }
  if (document.getElementById('cmsContactPhoneInput')) {
    document.getElementById('cmsContactPhoneInput').value = cfg.contactPhone || '087791201091';
  }

  const apiKeyInput = document.getElementById('cmsGoogleMapsApiKeyInput');
  if (apiKeyInput) apiKeyInput.value = cfg.googleMapsApiKey || '';
  const providerSelect = document.getElementById('cmsMapProviderSelect');
  if (providerSelect) {
    providerSelect.value = cfg.mapProvider || 'google_roadmap';
    switchAdminMapLayer(cfg.mapProvider || 'google_roadmap');
  }

  updateMaintenanceUI(cfg.maintenanceMode, cfg.maintenanceMessage);
  updateGeofenceCircle();
}

function updateRadarSliderVal(val) {
  const num = Number(val) || 2000;
  const el = document.getElementById('radiusSliderVal');
  if (el) {
    if (num >= 1000) {
      el.innerText = `${(num / 1000).toFixed(1)} KM (${num.toLocaleString('id-ID')} Meter)`;
    } else {
      el.innerText = `${num.toLocaleString('id-ID')} Meter`;
    }
  }
}

function updateMaintenanceUI(isMaintenance, message) {
  const badge = document.getElementById('maintenanceBannerBadge');
  const statusLabel = document.getElementById('cmsMaintenanceStatusLabel');
  const toggleBtn = document.getElementById('cmsMaintenanceToggleBtn');

  if (isMaintenance) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
    statusLabel.innerText = 'MODE PEMELIHARAAN AKTIF (MITRA DIBATASI)';
    statusLabel.className = 'text-xs text-rose-400 font-semibold';
    toggleBtn.innerText = 'Matikan Mode Maintenance';
    toggleBtn.className = 'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow';
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
    statusLabel.innerText = 'Sistem Berjalan Normal (Aktif)';
    statusLabel.className = 'text-xs text-emerald-400 font-semibold';
    toggleBtn.innerText = 'Aktifkan Mode Maintenance';
    toggleBtn.className = 'px-4 py-2 rounded-xl bg-slate-700 hover:bg-rose-600 text-white font-bold text-xs transition-all shadow';
  }
}

async function toggleServerMaintenance() {
  try {
    const isCurrentlyMaintenance = systemConfig.maintenanceMode;
    const msg = document.getElementById('cmsMaintenanceMessageInput').value;
    const res = await fetch(`${API_BASE}/api/config/toggle-maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maintenanceMode: !isCurrentlyMaintenance,
        maintenanceMessage: msg
      })
    }).then(r => r.json());

    if (res.success) {
      alert(res.message);
    }
  } catch (err) {
    alert('Gagal mengubah mode maintenance: ' + err.message);
  }
}

async function saveAllCmsConfig() {
  const sliderMeters = Number(document.getElementById('cmsRadiusSlider').value) || 2000;
  const payload = {
    appName: document.getElementById('cmsAppNameInput').value,
    appTagline: document.getElementById('cmsAppTaglineInput').value,
    radarRadiusMeters: sliderMeters,
    maxRadiusKm: Number((sliderMeters / 1000).toFixed(2)),
    baseFare: Number(document.getElementById('cmsBaseFareInput').value),
    farePerKm: Number(document.getElementById('cmsFarePerKmInput').value),
    platformFee: Number(document.getElementById('cmsPlatformFeeInput').value),
    serviceFeePercentage: Number(document.getElementById('cmsCommissionInput').value),
    premiumSubscriptionPrice: Number(document.getElementById('cmsPremiumPriceInput').value),
    maintenanceMessage: document.getElementById('cmsMaintenanceMessageInput').value,
    googleMapsApiKey: (document.getElementById('cmsGoogleMapsApiKeyInput')?.value || '').trim(),
    mapProvider: document.getElementById('cmsMapProviderSelect')?.value || 'google_roadmap',
    otpSenderNumber: (document.getElementById('cmsOtpSenderInput')?.value || '087791201091').trim(),
    fonnteToken: (document.getElementById('cmsFonnteTokenInput')?.value || '').trim(),
    otpMessageFormat: document.getElementById('cmsOtpMessageFormatInput')?.value || '',
    announcement: document.getElementById('cmsAnnouncementInput')?.value || '',
    contactPhone: (document.getElementById('cmsContactPhoneInput')?.value || '087791201091').trim()
  };

  try {
    // 1. Handle Header Logo upload if selected
    const fileInput = document.getElementById('cmsLogoFileInput');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('logo', fileInput.files[0]);
      await fetch(`${API_BASE}/api/config/upload-logo`, { method: 'POST', body: formData });
    }

    // 2. Handle App Icon sobatserabut.com upload if selected
    const iconInput = document.getElementById('cmsIconFileInput');
    if (iconInput && iconInput.files && iconInput.files.length > 0) {
      const iconFormData = new FormData();
      iconFormData.append('icon', iconInput.files[0]);
      await fetch(`${API_BASE}/api/config/upload-icon`, { method: 'POST', body: iconFormData });
    }

    // 3. Save full configuration to server database
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res.success) {
      // 4. Trigger build APK Android if checked
      const buildApkCb = document.getElementById('cmsTriggerBuildApkCheckbox');
      if (buildApkCb && buildApkCb.checked) {
        fetch(`${API_BASE}/api/admin/trigger-build-apk`, { method: 'POST' });
      }

      alert('🎉 BERHASIL DISIMPAN & DISINKRONKAN!\n\nSeluruh konfigurasi, icon aplikasi sobatserabut.com, nomor bot OTP (087791201091), tarif, dan pengumuman berhasil disimpan ke server dan langsung aktif secara real-time ke seluruh aplikasi mitra & pemohon jasa!');
    }
  } catch (err) {
    alert('Gagal menyimpan konfigurasi: ' + err.message);
  }
}

async function uploadDedicatedAppIcon(target) {
  const inputId = target === 'driver' ? 'cmsDriverIconFileInput' : 'cmsClientIconFileInput';
  const fileInput = document.getElementById(inputId);

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert(`Pilih file ikon baru (.svg, .png, .jpg) untuk aplikasi ${target} terlebih dahulu.`);
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('target', target);

  try {
    const res = await fetch(`${API_BASE}/api/admin/config/icon`, {
      method: 'POST',
      body: formData
    }).then(r => r.json());

    if (res.success) {
      alert(`🎉 ${res.message}\nIkon baru berhasil diunggah dan langsung disiarkan secara real-time ke semua perangkat!`);
      if (document.getElementById('cmsIconPreview')) {
        document.getElementById('cmsIconPreview').src = res.iconUrl + '?t=' + Date.now();
      }
    } else {
      alert(res.message || 'Gagal mengunggah ikon.');
    }
  } catch(e) {
    alert('Koneksi server gagal: ' + e.message);
  }
}

async function setLogoPreset(preset) {
  let url = '/uploads/logo_sobatserabut.svg';
  if (preset === 'icon') url = '/uploads/logo_icon.svg';
  
  try {
    const res = await fetch(`${API_BASE}/api/config/upload-logo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl: url, logoPreset: preset })
    }).then(r => r.json());
    if (res.success) {
      alert(`Logo header aplikasi diganti ke preset "${preset}"`);
      if (document.getElementById('cmsLogoPreview')) {
        document.getElementById('cmsLogoPreview').src = url;
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function setAppIconPreset(preset) {
  let url = '/uploads/logo_icon.svg';
  if (preset === 'shield') url = '/uploads/logo_sobatserabut.svg';
  
  try {
    const res = await fetch(`${API_BASE}/api/config/upload-icon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iconUrl: url, iconPreset: preset })
    }).then(r => r.json());
    if (res.success) {
      alert(`Ikon aplikasi sobatserabut.com diganti ke preset "${preset}"`);
      if (document.getElementById('cmsIconPreview')) {
        document.getElementById('cmsIconPreview').src = url;
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function testFonnteBotConnection() {
  const token = document.getElementById('cmsFonnteTokenInput')?.value.trim();
  const badge = document.getElementById('fonnteStatusBadge');
  if (badge) {
    badge.innerText = 'Menguji...';
    badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30';
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/test-fonnte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    }).then(r => r.json());

    if (res.success) {
      if (badge) {
        badge.innerText = '✅ Aktif';
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30';
      }
      alert(res.message);
    } else {
      if (badge) {
        badge.innerText = '⚠️ Cek Token';
        badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30';
      }
      alert(res.message);
    }
  } catch (err) {
    if (badge) {
      badge.innerText = '❌ Gagal';
      badge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30';
    }
    alert('Gagal menghubungi server untuk uji Fonnte: ' + err.message);
  }
}

function getCategoryIconUrl(cat) {
  if (cat && typeof cat === 'object' && cat.image) {
    if (cat.image.startsWith('http')) return cat.image;
    if (cat.image.startsWith('/')) return `${API_BASE}${cat.image}`;
    return `${API_BASE}/uploads/${cat.image}`;
  }
  const name = ((cat && typeof cat === 'object') ? (cat.name || '') : String(cat || '')).toLowerCase();
  if (name.includes('ac')) return `${API_BASE}/uploads/service_ac.png`;
  if (name.includes('bersih') || name.includes('clean')) return `${API_BASE}/uploads/service_clean.png`;
  if (name.includes('angkat') || name.includes('pindah') || name.includes('truck')) return `${API_BASE}/uploads/service_lifting.png`;
  if (name.includes('ledeng') || name.includes('pipa') || name.includes('plumber') || name.includes('pompa')) return `${API_BASE}/uploads/service_plumber.png`;
  if (name.includes('listrik') || name.includes('instalasi') || name.includes('electric') || name.includes('bolt') || name.includes('korslet')) return `${API_BASE}/uploads/service_electric.png`;
  if (name.includes('runner') || name.includes('belanja') || name.includes('pasar') || name.includes('titip')) return `${API_BASE}/uploads/service_runner.png`;
  if (name.includes('kayu') || name.includes('pertukangan') || name.includes('carpentry') || name.includes('kusen') || name.includes('cat')) return `${API_BASE}/uploads/service_carpentry.png`;
  if (name.includes('ban') || name.includes('tambal') || name.includes('darurat') || name.includes('tire')) return `${API_BASE}/uploads/service_tire.png`;
  if (name.includes('cuci') || name.includes('mesin') || name.includes('washer')) return `${API_BASE}/uploads/service_washing.png`;
  return `${API_BASE}/uploads/service_runner.png`;
}

// 9. Categories Management CMS
function renderCategoriesGrid() {
  const container = document.getElementById('categoryGrid');
  if (!container) return;

  if (!categoriesList || categoriesList.length === 0) {
    container.innerHTML = `
      <div class="col-span-4 flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <div class="w-20 h-20 rounded-3xl flex items-center justify-center" style="background:linear-gradient(135deg,rgba(220,38,38,0.15),rgba(30,41,59,0.8));border:1px solid rgba(220,38,38,0.25);">
          <i class="fa-solid fa-boxes-stacked text-3xl" style="color:#DC2626;"></i>
        </div>
        <div>
          <p class="text-base font-extrabold text-white mb-1">Memuat Kategori Jasa...</p>
          <p class="text-xs text-slate-400 max-w-xs">Menghubungi server, harap tunggu sebentar.</p>
        </div>
        <button onclick="fetch(API_BASE+'/api/categories').then(r=>r.json()).then(res=>{if(res.success){categoriesList=res.data;renderCategoriesGrid();}})" 
          class="px-4 py-2 rounded-xl text-xs font-bold text-white" style="background:linear-gradient(135deg,#DC2626,#991B1B);">
          <i class="fa-solid fa-rotate-right mr-1"></i> Muat Ulang Kategori
        </button>
      </div>`;

    // Auto-fetch jika kosong
    setTimeout(() => {
      if (!categoriesList || categoriesList.length === 0) {
        fetch(`${API_BASE}/api/categories`)
          .then(r => r.json())
          .then(res => {
            if (res.success && res.data && res.data.length > 0) {
              categoriesList = res.data;
              renderCategoriesGrid();
            }
          }).catch(() => {});
      }
    }, 800);
    return;
  }

  const colorPalette = [
    { bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.3)', accent: '#EF4444' },
    { bg: 'rgba(37,99,235,0.12)', border: 'rgba(37,99,235,0.3)', accent: '#3B82F6' },
    { bg: 'rgba(5,150,105,0.12)', border: 'rgba(5,150,105,0.3)', accent: '#10B981' },
    { bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.3)', accent: '#8B5CF6' },
    { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', accent: '#F59E0B' },
    { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)', accent: '#EC4899' },
    { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)', accent: '#0EA5E9' },
    { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', accent: '#F97316' },
    { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', accent: '#10B981' },
  ];

  container.innerHTML = categoriesList.map((cat, i) => {
    const pal = colorPalette[i % colorPalette.length];
    const isActive = cat.active !== false;
    return `
    <div class="relative rounded-2xl overflow-hidden flex flex-col justify-between group cursor-default"
         style="background:linear-gradient(145deg,${pal.bg},rgba(15,23,42,0.9));border:1px solid ${pal.border};padding:1rem;transition:all 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.3);"
         onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 12px 35px rgba(0,0,0,0.45)'"
         onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 20px rgba(0,0,0,0.3)'">
      <!-- Top line accent -->
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,${pal.accent},transparent);opacity:${isActive?'1':'0.3'};"></div>

      <!-- Header: icon + toggle -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0.75rem;">
        <div style="width:52px;height:52px;border-radius:14px;background:rgba(15,23,42,0.7);border:1px solid ${pal.border};padding:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          <img src="${getCategoryIconUrl(cat)}" alt="${cat.name}" style="width:100%;height:100%;object-fit:contain;" 
               onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<i class=\\'fa-solid fa-screwdriver-wrench\\' style=\\'color:${pal.accent};font-size:22px;\\'></i>'">
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <label style="position:relative;display:inline-flex;align-items:center;cursor:pointer;">
            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleCategory('${cat.id}', this.checked)" style="position:absolute;opacity:0;width:0;height:0;" id="catToggle_${cat.id}">
            <div onclick="document.getElementById('catToggle_${cat.id}').click()" style="width:38px;height:21px;background:${isActive?pal.accent:'#334155'};border-radius:99px;position:relative;transition:background 0.3s;cursor:pointer;">
              <div style="position:absolute;top:3px;left:${isActive?'18px':'3px'};width:15px;height:15px;background:white;border-radius:50%;transition:left 0.3s;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
            </div>
          </label>
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;${isActive?`background:rgba(16,185,129,0.15);color:#10B981;border:1px solid rgba(16,185,129,0.3);`:`background:rgba(100,116,139,0.15);color:#64748B;border:1px solid rgba(100,116,139,0.2);`}">${isActive ? '● Aktif' : '○ Nonaktif'}</span>
        </div>
      </div>

      <!-- Content -->
      <div style="flex:1;">
        <h4 style="font-size:14px;font-weight:800;color:white;margin-bottom:4px;line-height:1.3;">${cat.name}</h4>
        <p style="font-size:11px;color:#94A3B8;line-height:1.5;min-height:32px;">${cat.description || 'Layanan profesional tersedia di ekosistem SobatSerabut'}</p>
      </div>

      <!-- Footer: harga + aksi -->
      <div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:10px;padding-top:10px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <p style="font-size:9px;color:#64748B;font-weight:600;margin-bottom:1px;text-transform:uppercase;letter-spacing:0.5px;">Tarif Dasar</p>
          <span style="font-size:14px;font-weight:800;color:${pal.accent};">Rp ${(cat.baseFare||0).toLocaleString('id-ID')}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="deleteCategory('${cat.id}')" 
                  style="width:30px;height:30px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#EF4444;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;transition:all 0.2s;"
                  onmouseover="this.style.background='rgba(239,68,68,0.25)'"
                  onmouseout="this.style.background='rgba(239,68,68,0.1)'">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function toggleCategory(catId, active) {
  await fetch(`${API_BASE}/api/categories/${catId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active })
  });
}

async function deleteCategory(catId) {
  if (!confirm('Hapus kategori ini?')) return;
  await fetch(`${API_BASE}/api/categories/${catId}`, { method: 'DELETE' });
  loadInitialData();
}

function openAddCategoryModal() {
  const name = prompt('Nama Kategori Jasa Baru: (misal: "Servis Mesin Cuci")');
  if (!name) return;
  const baseFare = prompt('Tarif Dasar (Rp):', '60000');
  const desc = prompt('Deskripsi Layanan:', 'Perbaikan & perawatan langsung di rumah');

  fetch(`${API_BASE}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, baseFare, description: desc, icon: 'wrench' })
  }).then(r => r.json()).then(res => {
    if (res.success) {
      alert('Kategori berhasil ditambahkan!');
      loadInitialData();
    }
  });
}

function populateCategorySelects() {
  const simSelect = document.getElementById('simCategorySelect');
  if (!simSelect) return;
  simSelect.innerHTML = categoriesList.map(c => `
    <option value="${c.name}">${c.name} (Dasar: Rp ${c.baseFare.toLocaleString('id-ID')})</option>
  `).join('');
}

// 10. KYC Management
function renderKycTable() {
  const tbody = document.getElementById('kycTbody');
  if (!tbody) return;

  if (kycList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-slate-500 italic">Belum ada permohonan KYC pendaftaran mitra baru.</td></tr>';
    return;
  }

  tbody.innerHTML = kycList.map(k => {
    const statusBadge = k.status === 'approved' 
      ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">Terverifikasi</span>'
      : k.status === 'rejected'
      ? '<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">Ditolak</span>'
      : '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">Menunggu Tinjauan</span>';

    const ktpThumb = k.ktpImageUrl?.startsWith('http') ? k.ktpImageUrl : `${API_BASE}${k.ktpImageUrl}`;
    const selfieThumb = k.selfieImageUrl?.startsWith('http') ? k.selfieImageUrl : `${API_BASE}${k.selfieImageUrl}`;

    const actions = k.status === 'pending' ? `
      <div class="flex justify-end space-x-2">
        <button onclick="reviewKyc('${k.id}', 'approved')" class="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow">Setujui</button>
        <button onclick="reviewKyc('${k.id}', 'rejected')" class="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow">Tolak</button>
      </div>
    ` : `<span class="text-[11px] text-slate-500 text-right block">Selesai diperiksa</span>`;

    return `
      <tr class="hover:bg-slate-800/60 transition-all">
        <td class="p-3 font-mono text-[11px] text-slate-400">${k.id}<br><span class="text-[10px] text-slate-500">${new Date(k.submittedAt).toLocaleDateString('id-ID')}</span></td>
        <td class="p-3 font-bold text-white">${k.mitraName}</td>
        <td class="p-3 font-mono text-slate-400">${k.phone || '-'}</td>
        <td class="p-3 font-mono text-slate-300 font-semibold">${k.nik}</td>
        <td class="p-3">
          <img src="${ktpThumb}" onclick="openKycPreview('${ktpThumb}', 'Foto KTP - ${k.mitraName}')" class="w-12 h-8 rounded border border-slate-600 object-cover cursor-pointer hover:scale-110 transition-transform">
        </td>
        <td class="p-3">
          <img src="${selfieThumb}" onclick="openKycPreview('${selfieThumb}', 'Foto Selfie KTP - ${k.mitraName}')" class="w-12 h-8 rounded border border-slate-600 object-cover cursor-pointer hover:scale-110 transition-transform">
        </td>
        <td class="p-3">
          ${(k.bankAccount || k.bankDetails?.bankAccount) ? `
            <div class="font-mono text-xs">
              <span class="font-bold text-emerald-400">${k.bankDetails?.bankName || k.bankName || 'BANK'}:</span> ${k.bankDetails?.bankAccount || k.bankAccount}
              <span class="text-[10px] text-slate-400 block font-sans">${k.bankDetails?.bankHolder || k.bankHolder || ''}</span>
            </div>
          ` : '<span class="text-slate-500 font-mono text-[11px]">-</span>'}
        </td>
        <td class="p-3">${statusBadge}</td>
        <td class="p-3 text-right">${actions}</td>
      </tr>
    `;
  }).join('');
}

async function reviewKyc(kycId, status) {
  const notes = status === 'approved' ? 'Dokumen KTP & Selfie valid.' : prompt('Alasan penolakan:', 'Foto KTP buram / tidak terbaca');
  if (status === 'rejected' && notes === null) return;

  const res = await fetch(`${API_BASE}/api/admin/kyc/${kycId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reviewNotes: notes })
  }).then(r => r.json());

  if (res.success) {
    alert(res.message);
    loadInitialData();
  }
}

function openKycPreview(imgUrl, title) {
  document.getElementById('kycModalImage').src = imgUrl;
  document.getElementById('kycModalTitle').innerText = title;
  document.getElementById('kycPreviewModal').classList.remove('hidden');
}

function closeKycPreviewModal() {
  document.getElementById('kycPreviewModal').classList.add('hidden');
}

// 10B. Verifikasi Detail Dokumen Mitra & Transfer Saldo oleh Admin
let currentInspectedMitra = null;

function openMitraDetailModal(mitraId) {
  const mitra = mitraList.find(m => m.id === mitraId);
  if (!mitra) return;
  currentInspectedMitra = mitra;

  document.getElementById('mitraDetailModalTitle').innerText = `Verifikasi Identitas: ${mitra.name}`;
  
  const ktpImg = mitra.ktpPhoto ? (mitra.ktpPhoto.startsWith('http') ? mitra.ktpPhoto : `${API_BASE}${mitra.ktpPhoto}`) : null;
  const selfieImg = mitra.selfieKtpPhoto ? (mitra.selfieKtpPhoto.startsWith('http') ? mitra.selfieKtpPhoto : `${API_BASE}${mitra.selfieKtpPhoto}`) : null;
  const avatarImg = mitra.avatar && !mitra.avatar.includes('unsplash.com') ? (mitra.avatar.startsWith('http') ? mitra.avatar : `${API_BASE}${mitra.avatar}`) : '/uploads/avatar_mitra.svg';
  const bank = mitra.bankDetails || { bankName: mitra.bankName || 'SeaBank/E-Wallet', bankAccount: mitra.bankAccount || mitra.phone, bankHolder: mitra.bankHolder || mitra.name };

  const content = document.getElementById('mitraDetailContent');
  content.innerHTML = `
    <!-- Header Ringkas -->
    <div class="p-3 rounded-2xl bg-slate-900 border border-slate-700 flex items-center space-x-3">
      <img src="${avatarImg}" onclick="openKycPreview('${avatarImg}', 'Foto Profil: ${mitra.name}')" class="w-12 h-12 rounded-2xl object-cover border border-blue-500 cursor-pointer">
      <div class="flex-1">
        <h4 class="font-extrabold text-white text-sm">${mitra.name}</h4>
        <span class="text-slate-400 font-mono text-[11px] block">${mitra.phone} • ID: ${mitra.id}</span>
        <span class="text-emerald-400 font-mono font-bold text-xs">Saldo Dompet: Rp ${(mitra.walletBalance || 0).toLocaleString('id-ID')}</span>
      </div>
      <div>
        ${mitra.kycStatus === 'approved' || mitra.kycStatus === 'verified'
          ? '<span class="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">VERIFIKASI DITERIMA</span>'
          : '<span class="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px]">MENUNGGU PERSETUJUAN</span>'}
      </div>
    </div>

    <!-- Data Rekening & E-Wallet Mitra (Tujuan Transfer dari Klien -> Admin -> Mitra) -->
    <div class="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-1.5">
      <div class="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs">
        <i class="fa-solid fa-wallet"></i>
        <span>Rekening Bank / E-Wallet Pencairan Mitra (Wajib Ada Saat Daftar)</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs pt-1">
        <div>
          <span class="text-[10px] text-slate-400 block">Bank / E-Wallet:</span>
          <span class="font-bold text-white">${bank.bankName}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Nomor Rekening / No HP:</span>
          <span class="font-mono font-bold text-emerald-300 tracking-wider text-sm">${bank.bankAccount}</span>
        </div>
        <div class="col-span-2">
          <span class="text-[10px] text-slate-400 block">Nama Pemilik Akun:</span>
          <span class="font-bold text-white">${bank.bankHolder}</span>
        </div>
      </div>
      <div class="pt-2 flex justify-end">
        <button onclick="quickTransferSaldoToMitra('${mitra.id}', '${mitra.name}', '${bank.bankName}', '${bank.bankAccount}')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow flex items-center space-x-1">
          <i class="fa-solid fa-paper-plane"></i>
          <span>Kirim / Transfer Saldo ke Mitra Sekarang</span>
        </button>
      </div>
    </div>

    <!-- Foto KTP & Selfie Asli untuk Verifikasi Admin -->
    <div class="grid grid-cols-2 gap-3">
      <!-- Foto KTP -->
      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-700 space-y-2 text-center">
        <span class="font-bold text-slate-300 block text-[11px] flex items-center justify-center space-x-1">
          <i class="fa-solid fa-id-card text-blue-400"></i>
          <span>Foto Dokumen e-KTP</span>
        </span>
        ${ktpImg ? `
          <div onclick="openKycPreview('${ktpImg}', 'KTP Asli: ${mitra.name}')" class="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-700">
            <img src="${ktpImg}" class="h-28 w-full object-cover group-hover:scale-105 transition-transform">
            <span class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white font-bold text-[10px] transition-opacity">Klik Perbesar</span>
          </div>
        ` : '<div class="h-28 rounded-xl bg-slate-950 flex items-center justify-center text-slate-500 text-[11px] italic">KTP belum diunggah</div>'}
        <span class="text-[10px] text-slate-400 font-mono block">NIK: ${mitra.nik || '-'}</span>
      </div>

      <!-- Foto Selfie Kamera Langsung -->
      <div class="p-3 rounded-2xl bg-slate-900 border border-slate-700 space-y-2 text-center">
        <span class="font-bold text-slate-300 block text-[11px] flex items-center justify-center space-x-1">
          <i class="fa-solid fa-camera text-emerald-400"></i>
          <span>Foto Selfie Kamera Asli</span>
        </span>
        ${selfieImg ? `
          <div onclick="openKycPreview('${selfieImg}', 'Selfie Kamera Asli: ${mitra.name}')" class="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-700">
            <img src="${selfieImg}" class="h-28 w-full object-cover group-hover:scale-105 transition-transform">
            <span class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white font-bold text-[10px] transition-opacity">Klik Perbesar</span>
          </div>
        ` : '<div class="h-28 rounded-xl bg-slate-950 flex items-center justify-center text-slate-500 text-[11px] italic">Selfie belum diunggah</div>'}
        <span class="text-[10px] text-emerald-400 font-semibold block">Verifikasi Wajah Langsung</span>
      </div>
    </div>
  `;

  document.getElementById('mitraDetailModal').classList.remove('hidden');
}

function closeMitraDetailModal() {
  document.getElementById('mitraDetailModal').classList.add('hidden');
  currentInspectedMitra = null;
}

async function handleApproveCurrentMitra() {
  if (!currentInspectedMitra) return;
  try {
    const res = await fetch(`${API_BASE}/api/admin/mitra/${currentInspectedMitra.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', reviewNotes: 'Dokumen KTP, Selfie, dan Rekening sah diverifikasi admin.' })
    }).then(r => r.json());

    if (res.success) {
      alert(res.message);
      closeMitraDetailModal();
      loadInitialData();
    } else {
      alert(res.message || 'Gagal memverifikasi mitra');
    }
  } catch(e) {
    alert('Terjadi kesalahan: ' + e.message);
  }
}

async function quickTransferSaldoToMitra(mitraId, mitraName, bankName, bankAcc) {
  const nominalStr = prompt(`Transfer Saldo ke Mitra:\n\nNama: ${mitraName}\nTujuan: ${bankName} - ${bankAcc}\n\nMasukkan nominal saldo yang akan ditransfer (Rp):`, '50000');
  if (!nominalStr) return;
  const amount = Number(nominalStr.replace(/[^0-9]/g, ''));
  if (isNaN(amount) || amount <= 0) {
    alert('Nominal yang dimasukkan tidak valid.');
    return;
  }

  const catatan = prompt(`Catatan transfer untuk ${mitraName}:`, `Pencairan hasil kerja via ${bankName}`);

  try {
    const res = await fetch(`${API_BASE}/api/admin/mitra/${mitraId}/transfer-saldo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, notes: catatan })
    }).then(r => r.json());

    if (res.success) {
      alert(res.message);
      loadInitialData();
    } else {
      alert(res.message || 'Gagal melakukan transfer saldo');
    }
  } catch(e) {
    alert('Kesalahan jaringan: ' + e.message);
  }
}

// 11. Withdrawals & Escrow Ledger
function renderWithdrawalsList() {
  const container = document.getElementById('withdrawalsList');
  if (!container) return;

  if (!withdrawalsList || withdrawalsList.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-slate-500 italic text-xs">Belum ada permintaan penarikan dana.</div>';
    return;
  }

  container.innerHTML = withdrawalsList.map(w => {
    const isPending = w.status === 'pending';
    return `
      <div class="p-3 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
        <div>
          <div class="flex items-center space-x-2">
            <span class="font-bold text-white text-xs">${w.mitraName}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full ${isPending ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'} font-semibold">${w.status}</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5">${w.channelType}: <strong>${w.destination}</strong></div>
          <div class="text-[10px] text-slate-500">${new Date(w.requestedAt).toLocaleString('id-ID')}</div>
        </div>
        <div class="text-right">
          <div class="font-bold text-emerald-400 text-sm">Rp ${w.amount.toLocaleString('id-ID')}</div>
          ${isPending ? `
            <button onclick="processWithdraw('${w.id}', 'approved')" class="mt-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow">Transfer &amp; Selesaikan</button>
          ` : `
            <span class="text-[10px] text-slate-500">Telah Dicairkan</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

async function processWithdraw(wdId, status) {
  if (!confirm('Konfirmasi transfer penarikan dana ke rekening mitra ini?')) return;
  const res = await fetch(`${API_BASE}/api/admin/withdrawals/${wdId}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }).then(r => r.json());

  if (res.success) {
    alert('Penarikan dana berhasil diproses!');
    loadInitialData();
  }
}

function renderTransactionsList(transactions) {
  const container = document.getElementById('transactionsList');
  if (!container) return;

  if (!transactions || transactions.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-slate-500 italic text-xs">Belum ada riwayat transaksi masuk.</div>';
    return;
  }

  container.innerHTML = transactions.map(t => {
    const isIncome = t.type === 'platform_fee' || t.type === 'premium_subscription' || t.type === 'order_escrow';
    const amountColor = isIncome ? 'text-emerald-400' : 'text-blue-400';
    const proofUrl = t.proofPhoto ? (t.proofPhoto.startsWith('http') ? t.proofPhoto : `${API_BASE}${t.proofPhoto}`) : null;

    return `
      <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between text-xs hover:border-slate-600 transition-all">
        <div class="flex items-center space-x-2.5">
          ${proofUrl ? `
            <img src="${proofUrl}" onclick="openKycPreview('${proofUrl}', 'Bukti Slip Transfer Top-Up: ${t.userName || t.id}')" class="w-10 h-10 rounded-lg border border-emerald-500/40 object-cover cursor-pointer hover:scale-110 shadow transition-transform" title="Klik untuk verifikasi slip transfer">
          ` : `
            <div class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center text-xs">
              <span class="material-symbols-outlined text-sm">receipt</span>
            </div>
          `}
          <div>
            <div class="font-semibold text-slate-200 text-[11px]">${t.description}</div>
            <div class="text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5">
              <span>${new Date(t.timestamp).toLocaleTimeString('id-ID')} &bull; ${t.id}</span>
              ${proofUrl ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">Ada Bukti Transfer</span>' : ''}
            </div>
          </div>
        </div>
        <div class="font-mono font-bold ${amountColor} text-xs text-right">
          Rp ${t.amount.toLocaleString('id-ID')}
        </div>
      </div>
    `;
  }).join('');
}

// 12. Leaderboard
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboardTbody');
  if (!tbody) return;

  const sorted = [...mitraList].sort((a, b) => (b.completedOrders || 0) - (a.completedOrders || 0));
  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-6 text-center text-slate-400">
          <i class="fa-solid fa-trophy text-2xl mb-1.5 block text-slate-600"></i>
          <span class="font-semibold text-slate-300 block text-xs">Belum Ada Tugas yang Dikerjakan</span>
          <span class="text-[11px] text-slate-500">Peringkat dan metrik performa mitra akan otomatis terisi saat ada tugas nyata selesai dikerjakan.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sorted.map((m, idx) => `
    <tr class="hover:bg-slate-800/60">
      <td class="p-3 font-semibold text-white flex items-center space-x-2">
        <span class="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300 font-bold">${idx + 1}</span>
        <span>${m.name}</span>
      </td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${m.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400' : m.status === 'working' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}">${m.status}</span>
      </td>
      <td class="p-3 font-bold text-amber-400"><i class="fa-solid fa-star text-xs mr-1"></i>${(m.completedOrders || 0) > 0 ? m.rating : '0.0'}</td>
      <td class="p-3 font-mono text-blue-400">${m.completedOrders || 0} tugas</td>
      <td class="p-3 font-mono text-rose-400">${m.cancelRate || 0}%</td>
      <td class="p-3 font-mono text-emerald-400 font-semibold">Rp ${(m.earnings || 0).toLocaleString('id-ID')}</td>
      <td class="p-3 font-mono text-slate-300">Rp ${(m.walletBalance || 0).toLocaleString('id-ID')}</td>
      <td class="p-3">
        ${m.isPremium ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">VIP Premium</span>' : '<span class="text-slate-500 text-[10px]">Reguler</span>'}
      </td>
    </tr>
  `).join('');
}

// 13. Charts (Semua Metrik Finansial Dimulai dari 0, Berubah Saat Ada Tugas Dikerjakan)
function initCharts() {
  const ctxRev = document.getElementById('revenueChart')?.getContext('2d');
  if (ctxRev && !revenueChartInstance) {
    revenueChartInstance = new Chart(ctxRev, {
      type: 'bar',
      data: {
        labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
        datasets: [
          {
            label: 'Platform Fee Flat (Rp3k/order)',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: '#3B82F6'
          },
          {
            label: 'Komisi Jasa (10%)',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: '#10B981'
          },
          {
            label: 'Langganan VIP Premium',
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: '#F59E0B'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94A3B8', font: { size: 10 } } }
        },
        scales: {
          x: { ticks: { color: '#94A3B8' }, grid: { color: '#334155' } },
          y: { ticks: { color: '#94A3B8' }, grid: { color: '#334155' }, beginAtZero: true }
        }
      }
    });
  }

  const ctxCat = document.getElementById('categoryChart')?.getContext('2d');
  if (ctxCat && !categoryChartInstance) {
    categoryChartInstance = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: ['Belum Ada Tugas Selesai'],
        datasets: [{
          data: [1],
          backgroundColor: ['#334155']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#94A3B8', font: { size: 10 } } }
        }
      }
    });
  }
}

// Update grafik secara dinamis dari data tugas yang benar-benar selesai dikerjakan
function updateChartsFromOrders() {
  if (!revenueChartInstance || !categoryChartInstance) return;

  const completed = (ordersList || []).filter(o => o.status === 'completed');
  const pFeeUnit = systemConfig?.platformFee || 3000;
  const commPct = systemConfig?.serviceFeePercentage || 10;

  // Days index: Sen(0), Sel(1), Rab(2), Kam(3), Jum(4), Sab(5), Min(6)
  const feeByDay = [0, 0, 0, 0, 0, 0, 0];
  const commByDay = [0, 0, 0, 0, 0, 0, 0];
  const vipByDay = [0, 0, 0, 0, 0, 0, 0];
  const catCounts = {};

  completed.forEach(o => {
    const d = new Date(o.completedAt || o.createdAt || Date.now());
    const jsDay = d.getDay(); // 0: Sun, 1: Mon, ... 6: Sat
    const dayIdx = jsDay === 0 ? 6 : jsDay - 1; // 0=Sen, 1=Sel ... 6=Min

    feeByDay[dayIdx] += (o.platformFee || pFeeUnit);
    commByDay[dayIdx] += Math.round((o.budget || 0) * (commPct / 100));

    const cat = o.category || 'Lainnya';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  revenueChartInstance.data.datasets[0].data = feeByDay;
  revenueChartInstance.data.datasets[1].data = commByDay;
  revenueChartInstance.data.datasets[2].data = vipByDay;
  revenueChartInstance.update();

  const catKeys = Object.keys(catCounts);
  if (catKeys.length > 0) {
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308'];
    categoryChartInstance.data.labels = catKeys;
    categoryChartInstance.data.datasets[0].data = catKeys.map(k => catCounts[k]);
    categoryChartInstance.data.datasets[0].backgroundColor = catKeys.map((_, i) => palette[i % palette.length]);
  } else {
    categoryChartInstance.data.labels = ['Belum Ada Tugas Selesai'];
    categoryChartInstance.data.datasets[0].data = [1];
    categoryChartInstance.data.datasets[0].backgroundColor = ['#334155'];
  }
  categoryChartInstance.update();
}

async function refreshMetrics() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/metrics`).then(r => r.json());
    if (res.success && res.data) {
      const d = res.data;
      const netRevEl = document.getElementById('metricPlatformNetRev');
      if (netRevEl) netRevEl.innerText = `Rp ${(d.platformRevenue || 0).toLocaleString('id-ID')}`;

      const escrowEl = document.getElementById('metricEscrowBalance');
      if (escrowEl) escrowEl.innerText = `Rp ${(d.escrowBalance || 0).toLocaleString('id-ID')}`;

      const compRateEl = document.getElementById('metricCompletionRate');
      if (compRateEl) compRateEl.innerText = `${d.completionRate || '0'}%`;

      const avgRatEl = document.getElementById('metricAvgRatingText');
      if (avgRatEl) avgRatEl.innerText = `${d.avgRating || '0.0'} / 5.0`;

      const cancelRateEl = document.getElementById('metricCancelRate');
      if (cancelRateEl) cancelRateEl.innerText = `${d.cancelRate || '0'}%`;
    }
  } catch (e) {
    console.error('Failed to refresh metrics:', e);
  }

  updateChartsFromOrders();
  renderLeaderboard();
  renderOrdersAuditTable();
}

function searchMitraList(q) {
  const term = q.toLowerCase();
  const filtered = mitraList.filter(m => 
    m.name.toLowerCase().includes(term) || 
    (m.skills || []).some(s => s.toLowerCase().includes(term))
  );

  const container = document.getElementById('mitraListContainer');
  if (!container) return;

  container.innerHTML = filtered.map(m => {
    const statusDot = m.status === 'ready' ? 'bg-emerald-500' : m.status === 'working' ? 'bg-amber-500' : 'bg-rose-500';
    return `
      <div onclick="focusMitraOnMap('${m.id}')" class="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-700/60 border border-slate-700/80 cursor-pointer">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full ${statusDot}"></span>
            <span class="font-bold text-slate-200 text-xs">${m.name}</span>
          </div>
          <span class="text-[10px] text-slate-400">${m.status}</span>
        </div>
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
    osc.frequency.value = 587.33; // D5
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch(e) {}
}

function setupEventListeners() {}

/* ========================================================
 * 12. ADMIN DRIVER MANAGEMENT: POINTS, SUSPEND, TERMINATE & BROADCAST
 * ======================================================== */

// A. Kelola Poin Kinerja Driver
function openDriverPointsModal(driverId, driverName, currentPoints) {
  const idInput = document.getElementById('pointsModalDriverId');
  const nameEl = document.getElementById('pointsModalDriverName');
  const curEl = document.getElementById('pointsModalCurrentPoints');
  const amtInput = document.getElementById('pointsModalAmountInput');
  const rsnInput = document.getElementById('pointsModalReasonInput');

  if (idInput) idInput.value = driverId;
  if (nameEl) nameEl.innerText = `Driver: ${driverName} (${driverId})`;
  if (curEl) curEl.innerText = `${currentPoints || 100} Poin`;
  if (amtInput) amtInput.value = '25';
  if (rsnInput) rsnInput.value = 'Bonus ketekunan & kedisiplinan kerja driver';

  const modal = document.getElementById('driverPointsModal');
  if (modal) modal.classList.remove('hidden');
}

function closeDriverPointsModal() {
  const modal = document.getElementById('driverPointsModal');
  if (modal) modal.classList.add('hidden');
}

async function submitDriverPointsChange() {
  const driverId = document.getElementById('pointsModalDriverId')?.value;
  const amount = document.getElementById('pointsModalAmountInput')?.value;
  const reason = document.getElementById('pointsModalReasonInput')?.value.trim();
  const action = document.querySelector('input[name="pointActionRadio"]:checked')?.value || 'add';

  if (!driverId) {
    showToast('Driver ID tidak valid.', 'error');
    return;
  }
  if (!amount || Number(amount) <= 0) {
    showToast('Masukkan jumlah poin yang sah.', 'warning');
    return;
  }
  if (!reason) {
    showToast('Wajib memasukkan alasan pemberian/pengurangan poin.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/driver/${driverId}/points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuthToken}`,
        'x-admin-token': adminAuthToken
      },
      body: JSON.stringify({ amount: Number(amount), action, reason })
    }).then(r => r.json());

    if (res.success) {
      showToast(res.message, 'success');
      closeDriverPointsModal();
      loadMarketplaceUsers();
    } else {
      showToast(res.message || 'Gagal mengubah poin driver', 'error');
    }
  } catch(e) {
    showToast('Koneksi server gagal: ' + e.message, 'error');
  }
}

// B. Suspend & Unsuspend & Terminate Driver
function openSuspendDriverModal(driverId, driverName) {
  const idInput = document.getElementById('suspendModalDriverId');
  const nameEl = document.getElementById('suspendModalDriverName');
  const rsnInput = document.getElementById('suspendModalReasonInput');

  if (idInput) idInput.value = driverId;
  if (nameEl) nameEl.innerText = `Driver: ${driverName} (${driverId})`;
  if (rsnInput) rsnInput.value = 'Laporan pembatalan order berulang & ketidaksesuaian SOP layanan.';

  const modal = document.getElementById('driverSuspendModal');
  if (modal) modal.classList.remove('hidden');
}

function closeDriverSuspendModal() {
  const modal = document.getElementById('driverSuspendModal');
  if (modal) modal.classList.add('hidden');
}

async function submitDriverSuspendAction() {
  const driverId = document.getElementById('suspendModalDriverId')?.value;
  const reason = document.getElementById('suspendModalReasonInput')?.value.trim();
  if (!driverId) return;
  if (!reason) {
    showToast('Harap isi alasan penangguhan driver.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/driver/${driverId}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuthToken}`,
        'x-admin-token': adminAuthToken
      },
      body: JSON.stringify({ reason })
    }).then(r => r.json());

    if (res.success) {
      showToast(res.message, 'success');
      closeDriverSuspendModal();
      loadMarketplaceUsers();
    } else {
      showToast(res.message || 'Gagal menangguhkan driver', 'error');
    }
  } catch(e) {
    showToast('Koneksi gagal: ' + e.message, 'error');
  }
}

async function confirmUnsuspendDriver(driverId, driverName) {
  if (!confirm(`Buka status suspen untuk Driver ${driverName}? Driver akan dapat kembali online dan menerima tugas pesanan.`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/driver/${driverId}/unsuspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuthToken}`,
        'x-admin-token': adminAuthToken
      }
    }).then(r => r.json());

    if (res.success) {
      showToast(res.message, 'success');
      loadMarketplaceUsers();
    } else {
      showToast(res.message || 'Gagal membuka suspen driver', 'error');
    }
  } catch(e) {
    showToast('Koneksi gagal: ' + e.message, 'error');
  }
}

async function confirmTerminateDriver(driverId, driverName) {
  const reason = prompt(`PERINGATAN: Pemutusan kemitraan bersifat permanen!\nMasukkan alasan pemutusan kemitraan untuk Driver ${driverName}:`, 'Pelanggaran berat terhadap standar operasional & etika kemitraan');
  if (!reason) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/driver/${driverId}/terminate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuthToken}`,
        'x-admin-token': adminAuthToken
      },
      body: JSON.stringify({ reason })
    }).then(r => r.json());

    if (res.success) {
      showToast(res.message, 'success');
      loadMarketplaceUsers();
    } else {
      showToast(res.message || 'Gagal menghentikan kemitraan driver', 'error');
    }
  } catch(e) {
    showToast('Koneksi gagal: ' + e.message, 'error');
  }
}

// C. Siaran Promo & Broadcast Notification
function openBroadcastPromoModal() {
  const modal = document.getElementById('broadcastPromoModal');
  if (modal) modal.classList.remove('hidden');
}

function closeBroadcastPromoModal() {
  const modal = document.getElementById('broadcastPromoModal');
  if (modal) modal.classList.add('hidden');
}

function handleBroadcastTypeChange(type) {
  const vContainer = document.getElementById('broadcastVersionContainer');
  const titleInput = document.getElementById('broadcastTitleInput');
  const messageInput = document.getElementById('broadcastMessageInput');

  if (type === 'app_update') {
    if (vContainer) vContainer.classList.remove('hidden');
    if (titleInput) titleInput.value = '🚀 Pembaruan Aplikasi SobatSerabut v6.2.0 Siap!';
    if (messageInput) messageInput.value = 'Versi terbaru SobatSerabut telah dirilis dengan performa lebih cepat, animasi halus tanpa lag, peta penjemputan motor real-time, dan fitur audio suara notifikasi orderan!';
  } else {
    if (vContainer) vContainer.classList.add('hidden');
    if (type === 'promo') {
      if (titleInput) titleInput.value = '🔥 PROMO PRIORITAS ORDER HARI INI!';
      if (messageInput) messageInput.value = 'Tingkatkan performa kerja dan raih poin maksimal hari ini langsung di akun mitra Anda!';
    } else if (type === 'announcement') {
      if (titleInput) titleInput.value = '📢 Pengumuman Resmi SobatSerabut';
      if (messageInput) messageInput.value = 'Harap periksa kembali nomor rekening dan detail alamat profil Anda demi kelancaran pencairan saldo dan tugas harian.';
    }
  }
  updateBroadcastPreview();
}

function updateBroadcastPreview() {
  const title = document.getElementById('broadcastTitleInput')?.value || 'Pemberitahuan Resmi SobatSerabut';
  const message = document.getElementById('broadcastMessageInput')?.value || 'Tetap aktifkan GPS dan pantau radar untuk menerima tugas serabutan terdekat.';
  const type = document.getElementById('broadcastTypeSelect')?.value || 'promo';

  const previewTitle = document.getElementById('previewTitle');
  const previewMessage = document.getElementById('previewMessage');
  const previewTypeLabel = document.getElementById('previewTypeLabel');
  const previewTypeIcon = document.getElementById('previewTypeIcon');
  const titleCount = document.getElementById('broadcastTitleCount');
  const messageCount = document.getElementById('broadcastMessageCount');

  if (previewTitle) previewTitle.innerText = title;
  if (previewMessage) previewMessage.innerText = message;
  if (titleCount) titleCount.innerText = `${document.getElementById('broadcastTitleInput')?.value.length || 0}/60`;
  if (messageCount) messageCount.innerText = `${document.getElementById('broadcastMessageInput')?.value.length || 0}/250`;

  if (previewTypeLabel) {
    previewTypeLabel.innerText = (type === 'app_update') ? 'UPDATE APLIKASI' : (type === 'promo') ? 'PROMO SPESIAL' : (type === 'urgent') ? 'PERINGATAN PENTING' : 'PENGUMUMAN RESMI';
  }
  if (previewTypeIcon) {
    previewTypeIcon.innerHTML = (type === 'app_update') ? '<i class="fa-solid fa-rocket text-emerald-400"></i>' : (type === 'promo') ? '<i class="fa-solid fa-fire text-amber-400"></i>' : (type === 'urgent') ? '<i class="fa-solid fa-triangle-exclamation text-rose-400"></i>' : '<i class="fa-solid fa-bullhorn text-blue-400"></i>';
  }
}

async function handleSendBroadcastSubmit(e) {
  e.preventDefault();
  const target = document.getElementById('broadcastTargetSelect')?.value || 'all';
  const type = document.getElementById('broadcastTypeSelect')?.value || 'promo';
  const title = document.getElementById('broadcastTitleInput')?.value.trim();
  const message = document.getElementById('broadcastMessageInput')?.value.trim();
  const version = document.getElementById('broadcastVersionInput')?.value.trim() || '6.2.0';
  const forceReload = document.getElementById('broadcastForceReloadCheck')?.checked || false;

  if (!title || !message) {
    showToast('Harap lengkapi judul dan isi pesan notifikasi siaran.', 'warning');
    return;
  }

  const btn = document.getElementById('btnSubmitBroadcast');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i><span>Menyiarkan ke seluruh perangkat...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/broadcast-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuthToken}`,
        'x-admin-token': adminAuthToken
      },
      body: JSON.stringify({ target, type, title, message, version, forceReload })
    }).then(r => r.json());

    if (res.success) {
      showToast('🎉 ' + res.message, 'success');
      document.getElementById('broadcastTitleInput').value = '';
      document.getElementById('broadcastMessageInput').value = '';
      updateBroadcastPreview();
      loadBroadcastHistory();
    } else {
      showToast(res.message || 'Gagal mengirim siaran notifikasi', 'error');
    }
  } catch(e) {
    showToast('Koneksi gagal: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane text-xs mr-1"></i><span>Kirim Siaran Notifikasi Promo Sekarang</span>';
    }
  }
}

async function handleQuickBroadcastSubmit(e) {
  e.preventDefault();
  const target = document.getElementById('quickModalTarget')?.value || 'all';
  const type = document.getElementById('quickModalType')?.value || 'promo';
  const title = document.getElementById('quickModalTitle')?.value.trim();
  const message = document.getElementById('quickModalMessage')?.value.trim();

  if (!title || !message) {
    showToast('Harap lengkapi judul dan isi pesan notifikasi siaran.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/broadcast-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAuthToken}`,
        'x-admin-token': adminAuthToken
      },
      body: JSON.stringify({ target, type, title, message })
    }).then(r => r.json());

    if (res.success) {
      showToast('🎉 ' + res.message, 'success');
      closeBroadcastPromoModal();
      document.getElementById('quickModalTitle').value = '';
      document.getElementById('quickModalMessage').value = '';
      loadBroadcastHistory();
    } else {
      showToast(res.message || 'Gagal mengirim notifikasi siaran', 'error');
    }
  } catch(e) {
    showToast('Koneksi gagal: ' + e.message, 'error');
  }
}

async function loadBroadcastHistory() {
  const container = document.getElementById('broadcastHistoryList');
  const countBadge = document.getElementById('broadcastHistoryCount');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/notifications/active`).then(r => r.json());
    if (res.success && Array.isArray(res.data)) {
      if (countBadge) countBadge.innerText = `${res.data.length} Siaran`;
      if (res.data.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-slate-500 italic">Belum ada riwayat siaran notifikasi promo yang dikirim.</div>';
        return;
      }
      container.innerHTML = res.data.map(b => {
        const timeStr = new Date(b.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
        const targetBadge = b.target === 'driver' ? '<span class="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Khusus Driver</span>' : b.target === 'client' ? '<span class="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">Khusus Klien</span>' : '<span class="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">Semua Pengguna</span>';
        const typeBadge = b.type === 'promo' ? '🔥 PROMO' : b.type === 'urgent' ? '⚠️ PERINGATAN' : '📢 PENGUMUMAN';
        return `
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-1.5 hover:border-slate-600 transition-all">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="text-[10px] font-black text-amber-400">${typeBadge}</span>
                ${targetBadge}
              </div>
              <span class="text-[10px] text-slate-500 font-mono">${timeStr}</span>
            </div>
            <h4 class="font-extrabold text-white text-xs">${b.title}</h4>
            <p class="text-slate-300 text-[11px] leading-relaxed">${b.message}</p>
          </div>
        `;
      }).join('');
    }
  } catch(e) {
    console.warn('Gagal memuat riwayat siaran:', e);
  }
}


// ============================================================
// MANAJEMEN UPDATE VERSI APLIKASI — ADMIN DASHBOARD
// ============================================================
async function loadCurrentAppVersion() {
  try {
    const res = await fetch(`${API_BASE}/api/app-version`).then(r => r.json());
    if (res.success && res.data) {
      const badge = document.getElementById('currentVersionBadge');
      if (badge) badge.textContent = `Versi Aktif: v${res.data.latestVersion}`;
      const newVersionInput = document.getElementById('newVersionInput');
      const minVersionInput = document.getElementById('minVersionInput');
      const releaseNotesInput = document.getElementById('releaseNotesInput');
      const driverApkUrlInput = document.getElementById('driverApkUrlInput');
      const clientApkUrlInput = document.getElementById('clientApkUrlInput');
      if (newVersionInput && !newVersionInput.value) newVersionInput.value = res.data.latestVersion || '';
      if (minVersionInput && !minVersionInput.value) minVersionInput.value = res.data.minRequiredVersion || '';
      if (releaseNotesInput && !releaseNotesInput.value) releaseNotesInput.value = res.data.releaseNotes || '';
      if (driverApkUrlInput && !driverApkUrlInput.value) driverApkUrlInput.value = res.data.driverApkUrl || '';
      if (clientApkUrlInput && !clientApkUrlInput.value) clientApkUrlInput.value = res.data.clientApkUrl || '';
    }
  } catch(e) { /* silent */ }
}

async function handlePublishAppUpdate() {
  const latestVersion = document.getElementById('newVersionInput')?.value?.trim();
  const minRequiredVersion = document.getElementById('minVersionInput')?.value?.trim();
  const releaseNotes = document.getElementById('releaseNotesInput')?.value?.trim();
  const driverApkUrl = document.getElementById('driverApkUrlInput')?.value?.trim();
  const clientApkUrl = document.getElementById('clientApkUrlInput')?.value?.trim();
  const forceUpdate = document.getElementById('forceUpdateCheck')?.checked || false;

  if (!latestVersion) {
    showToast('Harap masukkan nomor versi terbaru!', 'warning');
    return;
  }

  const btn = document.getElementById('btnPublishUpdate');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i><span>Menerbitkan update...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/app-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latestVersion, minRequiredVersion, releaseNotes, driverApkUrl, clientApkUrl, forceUpdate })
    }).then(r => r.json());

    if (res.success) {
      showToast(`✅ Notifikasi update v${latestVersion} berhasil dikirim ke semua pengguna!`, 'success');
      const badge = document.getElementById('currentVersionBadge');
      if (badge) badge.textContent = `Versi Aktif: v${latestVersion}`;
    } else {
      showToast(res.message || 'Gagal menerbitkan update', 'error');
    }
  } catch(e) {
    showToast('Gagal terhubung ke server: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-mobile-screen-button text-sm"></i><span>🚀 Kirim Notifikasi Update ke Semua Pengguna Sekarang</span>';
    }
  }
}

// Auto-load versi saat tab broadcast aktif
const _origAdminSwitchTab = typeof switchTab === 'function' ? switchTab : null;
document.addEventListener('DOMContentLoaded', () => {
  // Muat versi aplikasi saat halaman admin dibuka
  setTimeout(loadCurrentAppVersion, 1500);
});
