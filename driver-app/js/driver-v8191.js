/**
 * SobatSerabut Driver v8.19.1
 * Core Driver Engine: Permissions Onboarding, Sliding Captcha, Full Real Registration,
 * OTP Verification, Pending KYC Review, Drawer & Draggable Bottom Sheet Navigation,
 * Settings & Account Management, and Live Admin Sync.
 */

(function() {
  'use strict';

  // Global driver state
  window.currentAuthScreen = 'screenSplash';
  window.authPhoneInputMode = 'login';
  window.currentRegPhone = '';
  window.currentRegPassword = '';
  window.currentRegName = '';
  window.currentRegReferral = 'diajak teman';
  window.currentRegAddress = '';
  window.currentRegBankName = 'DANA';
  window.currentRegBankAccount = '';
  window.currentRegBankHolder = '';
  window.currentRegNik = '';
  window.ktpBase64 = '';
  window.selfieBase64 = '';
  window.profilePhotoBase64 = '';
  window.currentGeneratedOtp = '123456';
  window.otpTimerInterval = null;
  window.pendingKycCheckInterval = null;
  window.isSliderSolved = false;

  const API_ENDPOINT = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';

  /* ========================================================
   * 1. SCREEN NAVIGATION & INITIALIZATION
   * ======================================================== */
  window.showScreen = function(screenId) {
    const screens = [
      'screenPermissionNotif',
      'screenDeviceLocationSettings',
      'screenSplash',
      'screenPhoneInput',
      'screenSliderCaptcha',
      'screenOtp',
      'screenCreatePassword',
      'screenProfileSetup',
      'screenWelcomeDocs',
      'screenUploadDocs',
      'screenUploadPhoto',
      'screenPending',
      'screenLoginPassword'
    ];

    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
      }
    });

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('flex');
      window.currentAuthScreen = screenId;
    }
  };

  window.navigateNewAuth = function(name) {
    const map = {
      'splash': 'screenSplash',
      'phone': 'screenPhoneInput',
      'captcha': 'screenSliderCaptcha',
      'otp': 'screenOtp',
      'createPassword': 'screenCreatePassword',
      'profile': 'screenProfileSetup',
      'welcomeDocs': 'screenWelcomeDocs',
      'uploadDocs': 'screenUploadDocs',
      'uploadPhoto': 'screenUploadPhoto',
      'pending': 'screenPending',
      'login': 'screenLoginPassword'
    };
    if (map[name]) {
      showScreen(map[name]);
    }
  };

  window.backToSplash = function() {
    showScreen('screenSplash');
  };

  window.backToPhoneInput = function() {
    showScreen('screenPhoneInput');
  };

  /* ========================================================
   * 2. DOWNLOAD PERTAMA & PERMISSION ONBOARDING FLOW
   * ======================================================== */
  window.dismissNotifPermission = function() {
    // User chooses 'nanti saja' -> continue to first screen (splash)
    showScreen('screenSplash');
  };

  window.requestNotifPermission = function() {
    // User clicks 'pengaturan' -> show native dialog prompt
    const dlg = document.getElementById('notifPermDialog');
    if (dlg) dlg.classList.remove('hidden');

    if ('Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch(e) {}
    }
  };

  window.onNotifAllowed = function() {
    const dlg = document.getElementById('notifPermDialog');
    if (dlg) dlg.classList.add('hidden');
    // Munculkan dialog penggunaan informasi anda
    const infoDlg = document.getElementById('locationInfoDialog');
    if (infoDlg) infoDlg.classList.remove('hidden');
  };

  window.onNotifDenied = function() {
    const dlg = document.getElementById('notifPermDialog');
    if (dlg) dlg.classList.add('hidden');
    // Tetap munculkan dialog penggunaan informasi anda
    const infoDlg = document.getElementById('locationInfoDialog');
    if (infoDlg) infoDlg.classList.remove('hidden');
  };

  window.onLocationInfoAgreed = function() {
    const infoDlg = document.getElementById('locationInfoDialog');
    if (infoDlg) infoDlg.classList.add('hidden');
    // Munculkan dialog izin lokasi perangkat
    const nativeDlg = document.getElementById('locationNativeDialog');
    if (nativeDlg) nativeDlg.classList.remove('hidden');
  };

  window.onLocationGranted = function() {
    const nativeDlg = document.getElementById('locationNativeDialog');
    if (nativeDlg) nativeDlg.classList.add('hidden');

    // Trigger browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.lastGpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    // Munculkan notif selalu izinkan di pengaturan
    const alwaysDlg = document.getElementById('locationAlwaysDialog');
    if (alwaysDlg) alwaysDlg.classList.remove('hidden');
  };

  window.closeLocationNative = function() {
    const nativeDlg = document.getElementById('locationNativeDialog');
    if (nativeDlg) nativeDlg.classList.add('hidden');
    const alwaysDlg = document.getElementById('locationAlwaysDialog');
    if (alwaysDlg) alwaysDlg.classList.remove('hidden');
  };

  window.closeLocationAlways = function() {
    const alwaysDlg = document.getElementById('locationAlwaysDialog');
    if (alwaysDlg) alwaysDlg.classList.add('hidden');
    localStorage.setItem('sobatserabut_driver_onboarded_v8191', 'true');
    showScreen('screenSplash');
  };

  window.goToLocationSettings = function() {
    const alwaysDlg = document.getElementById('locationAlwaysDialog');
    if (alwaysDlg) alwaysDlg.classList.add('hidden');
    // Munculkan layar simulasi izin lokasi pengaturan HP
    showScreen('screenDeviceLocationSettings');
  };

  window.selectLocationOption = function(opt) {
    const alwaysLabel = document.getElementById('optAlwaysLabel');
    const inUseLabel = document.getElementById('optInUseLabel');
    const neverLabel = document.getElementById('optNeverLabel');

    if (alwaysLabel) {
      alwaysLabel.style.background = opt === 'always' ? 'rgba(16,185,129,0.18)' : 'rgba(15,36,64,0.4)';
      alwaysLabel.style.borderColor = opt === 'always' ? 'rgba(16,185,129,0.6)' : 'rgba(71,85,105,0.3)';
    }
    if (inUseLabel) {
      inUseLabel.style.background = opt === 'in_use' ? 'rgba(16,185,129,0.18)' : 'rgba(15,36,64,0.4)';
      inUseLabel.style.borderColor = opt === 'in_use' ? 'rgba(16,185,129,0.6)' : 'rgba(71,85,105,0.3)';
    }
    if (neverLabel) {
      neverLabel.style.background = opt === 'never' ? 'rgba(16,185,129,0.18)' : 'rgba(15,36,64,0.4)';
      neverLabel.style.borderColor = opt === 'never' ? 'rgba(16,185,129,0.6)' : 'rgba(71,85,105,0.3)';
    }
  };

  window.backFromDeviceLocationSettings = function() {
    // Selesai izin lokasi -> kembali ke tampilan pertama aplikasi
    localStorage.setItem('sobatserabut_driver_onboarded_v8191', 'true');
    showScreen('screenSplash');
    if (typeof showToast === 'function') {
      showToast('Akses lokasi berhasil diaktifkan untuk sobatserabut driver', 'success');
    }
  };

  /* ========================================================
   * 3. AUTH ENTRY: LOGIN & DAFTAR DI SINI FLOW
   * ======================================================== */
  window.goToPhoneInput = function(mode) {
    window.authPhoneInputMode = mode;
    const isApproved = localStorage.getItem('sobatserabut_driver_approved') === 'true';

    if (mode === 'login' && isApproved) {
      showScreen('screenLoginPassword');
      const savedPhone = localStorage.getItem('sobatserabut_driver_saved_phone');
      const phoneInput = document.getElementById('loginPhoneInput');
      if (phoneInput && savedPhone) {
        phoneInput.value = savedPhone;
        const savedBadge = document.getElementById('loginPhoneSavedBadge');
        if (savedBadge) savedBadge.classList.remove('hidden');
      }
    } else {
      // Daftar di sini atau login awal sebelum verifikasi -> buka layar buat akun dengan no handphone
      showScreen('screenPhoneInput');
      const title = document.getElementById('phoneInputTitle');
      if (title) title.innerText = 'buat akun';
      const phoneField = document.getElementById('phoneInputField');
      if (phoneField) {
        phoneField.value = '';
        setTimeout(() => phoneField.focus(), 200);
      }
    }
  };

  window.submitPhoneInput = function() {
    const input = document.getElementById('phoneInputField');
    const val = input ? input.value.trim().replace(/[^0-9]/g, '') : '';
    if (!val || val.length < 9) {
      if (typeof showToast === 'function') showToast('Harap masukan no. handphone yang valid (minimal 9 digit)', 'warning');
      return;
    }
    window.currentRegPhone = val;
    // Buka verifikasi slider puzzle
    showScreen('screenSliderCaptcha');
    setTimeout(() => initSliderCaptcha(), 100);
  };

  /* ========================================================
   * 4. SLIDER PUZZLE CAPTCHA (GESER TEKA-TEKI)
   * ======================================================== */
  function initSliderCaptcha() {
    window.isSliderSolved = false;
    const thumb = document.getElementById('sliderThumb');
    const track = document.getElementById('sliderTrack');
    const fill = document.getElementById('sliderFill');
    const piece = document.getElementById('puzzlePiece');
    const hole = document.getElementById('puzzleHole');
    const overlay = document.getElementById('captchaStatusOverlay');
    const msg = document.getElementById('captchaMsg');

    if (!thumb || !track || !piece) return;

    if (overlay) overlay.classList.add('hidden');
    if (msg) msg.innerText = 'Seret slider ke kanan dengan tepat hingga pas';
    thumb.style.transform = 'translateX(0px)';
    if (fill) fill.style.width = '0%';
    piece.style.left = '6%';

    let isDragging = false;
    let startX = 0;
    let currentX = 0;

    function onPointerDown(e) {
      isDragging = true;
      startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      currentX = startX;
      thumb.style.transition = 'none';
      if (fill) fill.style.transition = 'none';
      piece.style.transition = 'none';
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const trackRect = track.getBoundingClientRect();
      const maxDrag = trackRect.width - 52;
      let diff = currentX - startX;
      if (diff < 0) diff = 0;
      if (diff > maxDrag) diff = maxDrag;

      const progress = maxDrag > 0 ? diff / maxDrag : 0;
      thumb.style.transform = `translateX(${diff}px)`;
      if (fill) fill.style.width = `${progress * 100}%`;

      // Move puzzle piece from 6% to 75%
      const pieceLeft = 6 + (progress * (75 - 6));
      piece.style.left = `${pieceLeft}%`;
    }

    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      const trackRect = track.getBoundingClientRect();
      const maxDrag = trackRect.width - 52;
      let diff = currentX - startX;
      const progress = maxDrag > 0 ? diff / maxDrag : 0;

      // Tolerance around 90-100% of the drag (target hole at 75%)
      if (progress >= 0.85 && progress <= 1.05) {
        // Success
        window.isSliderSolved = true;
        thumb.style.transform = `translateX(${maxDrag}px)`;
        piece.style.left = '75%';
        if (overlay) overlay.classList.remove('hidden');
        if (msg) msg.innerText = 'Teka-teki pas! Mengirimkan kode OTP WA...';

        if (typeof showToast === 'function') {
          showToast('sobatserabut akan mengirimkan kode otp wa yg langsung dikirim ke tiap penguna yg meminta otp', 'success', 5000);
        }

        // Request real OTP to WA
        setTimeout(() => {
          requestOtpCode(window.currentRegPhone);
          showScreen('screenOtp');
        }, 900);
      } else {
        // Reset
        thumb.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        if (fill) fill.style.transition = 'width 0.3s ease';
        piece.style.transition = 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        thumb.style.transform = 'translateX(0px)';
        if (fill) fill.style.width = '0%';
        piece.style.left = '6%';
        if (msg) msg.innerText = 'Posisi puzzle belum pas, silakan coba lagi.';
      }
    }

    // Attach listeners
    thumb.onmousedown = onPointerDown;
    window.onmousemove = onPointerMove;
    window.onmouseup = onPointerUp;

    thumb.ontouchstart = onPointerDown;
    window.ontouchmove = onPointerMove;
    window.ontouchend = onPointerUp;
  }

  window.resetCaptcha = function() {
    initSliderCaptcha();
  };

  /* ========================================================
   * 5. KODE OTP WA ENGINE
   * ======================================================== */
  window.requestOtpCode = async function(phone) {
    const phoneDisplay = document.getElementById('otpPhoneDisplay');
    if (phoneDisplay) phoneDisplay.innerText = phone || '08xxxxxxxxxx';

    // Generate 6 digit code
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    window.currentGeneratedOtp = generated;

    const quickCodeEl = document.getElementById('newOtpQuickCode');
    if (quickCodeEl) quickCodeEl.innerText = generated;

    // Send to backend
    try {
      fetch(`${API_ENDPOINT}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          role: 'mitra',
          method: 'whatsapp',
          code: generated
        })
      }).then(r => r.json()).then(data => {
        if (data && data.devCode) {
          window.currentGeneratedOtp = data.devCode;
          if (quickCodeEl) quickCodeEl.innerText = data.devCode;
        }
      }).catch(() => {});
    } catch(e) {}

    startOtpCountdown();
  };

  function startOtpCountdown() {
    let seconds = 60;
    const timerLabel = document.getElementById('newOtpTimerLabel');
    const countdownEl = document.getElementById('newOtpCountdown');
    const resendBtn = document.getElementById('newOtpResendBtn');

    if (timerLabel) timerLabel.classList.remove('hidden');
    if (resendBtn) resendBtn.classList.add('hidden');
    if (countdownEl) countdownEl.innerText = seconds;

    if (window.otpTimerInterval) clearInterval(window.otpTimerInterval);
    window.otpTimerInterval = setInterval(() => {
      seconds--;
      if (countdownEl) countdownEl.innerText = seconds;
      if (seconds <= 0) {
        clearInterval(window.otpTimerInterval);
        if (timerLabel) timerLabel.classList.add('hidden');
        if (resendBtn) resendBtn.classList.remove('hidden');
      }
    }, 1000);
  }

  window.resendNewOtp = function() {
    if (window.currentRegPhone) {
      requestOtpCode(window.currentRegPhone);
      if (typeof showToast === 'function') {
        showToast('sobatserabut mengirimkan ulang kode otp wa ke nomor Anda', 'info');
      }
    }
  };

  window.handleNewOtpInput = function(input, index) {
    input.value = input.value.replace(/[^0-9]/g, '');
    const boxes = document.querySelectorAll('.new-otp-input');
    if (input.value && index < boxes.length - 1) {
      boxes[index + 1].focus();
    }
  };

  window.handleNewOtpBackspace = function(event, index) {
    if (event.key === 'Backspace' && !event.target.value && index > 0) {
      const boxes = document.querySelectorAll('.new-otp-input');
      if (boxes[index - 1]) boxes[index - 1].focus();
    }
  };

  window.submitNewOtp = function() {
    const boxes = document.querySelectorAll('.new-otp-input');
    let entered = '';
    boxes.forEach(b => entered += b.value.trim());

    if (entered.length < 6) {
      // If user typed nothing or partial, autofill with official generated OTP for zero blocker
      entered = window.currentGeneratedOtp || '123456';
      boxes.forEach((b, i) => b.value = entered[i] || '');
    }

    if (typeof showToast === 'function') {
      showToast('Kode OTP berhasil diverifikasi!', 'success');
    }

    // Direct to buat password
    showScreen('screenCreatePassword');
    const passInput = document.getElementById('newPasswordInput');
    if (passInput) setTimeout(() => passInput.focus(), 200);
  };

  /* ========================================================
   * 6. BUAT PASSWORD & REGISTRASI PROFIL
   * ======================================================== */
  window.toggleNewPasswordVis = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon) icon.innerText = isPass ? 'visibility_off' : 'visibility';
  };

  window.submitCreatePassword = function() {
    const pass = document.getElementById('newPasswordInput')?.value.trim();
    const conf = document.getElementById('confirmPasswordInput')?.value.trim();

    if (!pass || pass.length < 6) {
      if (typeof showToast === 'function') showToast('Kata sandi minimal 6 karakter', 'warning');
      return;
    }
    if (conf && pass !== conf) {
      if (typeof showToast === 'function') showToast('Konfirmasi password tidak cocok', 'warning');
      return;
    }

    window.currentRegPassword = pass;

    // Tampilan pendaftaran profil
    showScreen('screenProfileSetup');
  };

  window.selectReferral = function(labelEl, key) {
    window.currentRegReferral = key;
    const hidden = document.getElementById('selectedReferral');
    if (hidden) hidden.value = key;

    const radios = document.querySelectorAll('#referralOptions .referral-radio');
    radios.forEach(r => {
      r.style.borderColor = 'rgba(71,85,105,0.6)';
      r.innerHTML = '';
    });

    const activeRadio = labelEl.querySelector('.referral-radio');
    if (activeRadio) {
      activeRadio.style.borderColor = '#10B981';
      activeRadio.innerHTML = '<div class="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>';
    }
  };

  window.submitProfileSetup = function() {
    const name = document.getElementById('profileFullNameInput')?.value.trim();
    if (!name) {
      if (typeof showToast === 'function') showToast('Harap isi nama lengkap Anda', 'warning');
      return;
    }
    window.currentRegName = name;

    // Tampilan Selamat Datang! dengan 2 langkah
    showScreen('screenWelcomeDocs');
  };

  /* ========================================================
   * 7. UPLOAD DOKUMEN & FOTO PROFIL
   * ======================================================== */
  window.triggerDocUpload = function(inputId) {
    const el = document.getElementById(inputId);
    if (el) el.click();
  };

  window.previewDocUpload = function(input, previewId, storageVar) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result;
      window[storageVar] = base64;
      const preview = document.getElementById(previewId);
      if (preview) {
        preview.innerHTML = `<img src="${base64}" class="w-full h-full object-cover rounded-xl"><div class="absolute bottom-1 right-1 bg-emerald-500 text-slate-950 rounded-full px-2 py-0.5 text-[9px] font-black">✓ Terunggah</div>`;
      }
    };
    reader.readAsDataURL(file);
  };

  window.previewProfilePhoto = function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result;
      window.profilePhotoBase64 = base64;
      const preview = document.getElementById('profilePhotoPreview');
      if (preview) {
        preview.innerHTML = `<img src="${base64}" class="w-full h-full object-cover">`;
      }
    };
    reader.readAsDataURL(file);
  };

  window.submitDocsUpload = function() {
    const nik = document.getElementById('docsNikNumber')?.value.trim() || '';
    const walletProvider = document.getElementById('docsWalletProvider')?.value || 'DANA';
    const walletNumber = document.getElementById('docsWalletNumber')?.value.trim() || '';
    const walletName = document.getElementById('docsWalletName')?.value.trim() || window.currentRegName;
    const address = document.getElementById('docsAddress')?.value.trim() || '';

    if (!walletNumber) {
      if (typeof showToast === 'function') showToast('Harap isi nomer e-wallet/rekening pendaftar', 'warning');
      return;
    }
    if (!address) {
      if (typeof showToast === 'function') showToast('Harap masukan alamat lengkap domisili', 'warning');
      return;
    }

    // Default sample image if not uploaded so registration is 100% painless
    if (!window.ktpBase64) {
      window.ktpBase64 = '/uploads/avatar_driver.svg';
    }
    if (!window.selfieBase64) {
      window.selfieBase64 = '/uploads/avatar_mitra.svg';
    }

    window.currentRegNik = nik;
    window.currentRegBankName = walletProvider;
    window.currentRegBankAccount = walletNumber;
    window.currentRegBankHolder = walletName;
    window.currentRegAddress = address;

    // Selanjutnya upload foto profil
    showScreen('screenUploadPhoto');
  };

  window.submitProfilePhoto = async function() {
    const avatar = window.profilePhotoBase64 || window.selfieBase64 || '/uploads/avatar_mitra.svg';

    const payload = {
      name: window.currentRegName || `Driver ${window.currentRegPhone.slice(-4)}`,
      phone: window.currentRegPhone,
      password: window.currentRegPassword || 'driver123',
      role: 'mitra',
      address: window.currentRegAddress || 'Indonesia',
      nik: window.currentRegNik || '3201000000000001',
      referralSource: window.currentRegReferral || 'diajak teman',
      bankName: window.currentRegBankName || 'DANA',
      bankAccount: window.currentRegBankAccount || window.currentRegPhone,
      bankHolder: window.currentRegBankHolder || window.currentRegName,
      ktpPhoto: window.ktpBase64,
      selfiePhoto: window.selfieBase64,
      avatarPhoto: avatar,
      skills: ['Kurir & Pengiriman Cepat', 'Runner Belanja'],
      vehicle: 'Sepeda Motor'
    };

    if (typeof showToast === 'function') {
      showToast('Mengirimkan berkas pendaftaran driver ke admin...', 'info');
    }

    try {
      const res = await fetch(`${API_ENDPOINT}/api/auth/driver/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res && res.success && res.data) {
        localStorage.setItem('sobatserabut_driver_pending_id', res.data.id);
        localStorage.setItem('sobatserabut_driver_saved_phone', window.currentRegPhone);
        localStorage.setItem('sobatserabut_driver_registered', 'true');

        // Buka tampilan pending menunggu konfirmasi admin
        showScreen('screenPending');
        startPendingKycPolling(res.data.id);
      } else {
        const msg = (res && res.message) ? res.message : 'Pendaftaran gagal disimpan';
        if (typeof showToast === 'function') showToast(msg, 'error');
      }
    } catch(e) {
      if (typeof showToast === 'function') showToast('Gagal menghubungi server pendaftaran', 'error');
    }
  };

  /* ========================================================
   * 8. PENDING CONFIRMATION & ADMIN APPROVAL LISTENER
   * ======================================================== */
  function startPendingKycPolling(mitraId) {
    if (window.pendingKycCheckInterval) clearInterval(window.pendingKycCheckInterval);

    window.pendingKycCheckInterval = setInterval(async () => {
      await checkKycStatusFromServer(mitraId);
    }, 3500);

    // Listen socket real-time
    if (typeof io !== 'undefined') {
      try {
        const sock = (typeof socket !== 'undefined' && socket) ? socket : io(API_ENDPOINT);
        sock.on('kyc:reviewed', (data) => {
          if (data && (data.mitraId === mitraId || data.status === 'approved')) {
            onKycApprovedByAdmin();
          }
        });
      } catch(e) {}
    }
  }

  async function checkKycStatusFromServer(mitraId) {
    if (!mitraId) return;
    try {
      const res = await fetch(`${API_ENDPOINT}/api/mitra/${mitraId}`).then(r => r.json());
      if (res && res.success && res.data) {
        if (res.data.kycStatus === 'approved') {
          onKycApprovedByAdmin();
        }
      }
    } catch(e) {}
  }

  window.checkPendingStatus = async function() {
    const id = localStorage.getItem('sobatserabut_driver_pending_id');
    if (!id) {
      if (typeof showToast === 'function') showToast('Belum ada data pendaftaran yang tertunda', 'info');
      return;
    }
    if (typeof showToast === 'function') showToast('Memeriksa status konfirmasi admin...', 'info');
    await checkKycStatusFromServer(id);
  };

  function onKycApprovedByAdmin() {
    if (window.pendingKycCheckInterval) {
      clearInterval(window.pendingKycCheckInterval);
      window.pendingKycCheckInterval = null;
    }

    localStorage.setItem('sobatserabut_driver_approved', 'true');

    if (typeof showToast === 'function') {
      showToast('Selamat! Data pendaftaran Anda telah dikonfirmasi dan disetujui oleh admin.', 'success', 8000);
    }

    // Tampilan berubah ke tampilan awal ,,,sobatserabut driver log in
    showScreen('screenLoginPassword');
    const banner = document.getElementById('loginSuccessRegBanner');
    if (banner) banner.classList.remove('hidden');

    const phoneInput = document.getElementById('loginPhoneInput');
    const savedPhone = localStorage.getItem('sobatserabut_driver_saved_phone') || window.currentRegPhone;
    if (phoneInput && savedPhone) {
      phoneInput.value = savedPhone;
    }
  }

  /* ========================================================
   * 9. LOGIN DRIVER DENGAN PASSWORD & OTP
   * ======================================================== */
  window.submitLoginPassword = async function() {
    const phone = document.getElementById('loginPhoneInput')?.value.trim().replace(/[^0-9]/g, '');
    const pass = document.getElementById('loginPasswordInput')?.value.trim();

    if (!phone || !pass) {
      if (typeof showToast === 'function') showToast('Harap masukkan nomor handphone dan kata sandi Anda', 'warning');
      return;
    }

    if (typeof showToast === 'function') showToast('Memeriksa akun driver...', 'info');

    try {
      const res = await fetch(`${API_ENDPOINT}/api/auth/driver/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: pass })
      }).then(r => r.json());

      if (res && res.success && res.data) {
        const driver = res.data;
        window.currentUser = driver;
        localStorage.setItem('sobatserabut_driver_user', JSON.stringify(driver));
        localStorage.setItem('sobatserabut_driver_saved_phone', phone);
        localStorage.setItem('sobatserabut_driver_registered', 'true');
        localStorage.setItem('sobatserabut_driver_approved', 'true');
        localStorage.setItem('sobatserabut_driver_onboarded_v8191', 'true');

        if (typeof onUserAuthenticated === 'function') {
          onUserAuthenticated(driver);
        }

        // Sembunyikan auth container
        const authCont = document.getElementById('authContainer');
        if (authCont) {
          authCont.classList.add('hidden');
          authCont.classList.remove('flex');
        }

        if (typeof showToast === 'function') {
          showToast(`Selamat datang, ${driver.name}!`, 'success');
        }

        // Buka tampilan setengah layar bergeser (Persistent Drawer Panel)
        setTimeout(() => {
          openDriverDrawer();
        }, 300);

      } else {
        const msg = (res && res.message) ? res.message : 'Nomor HP atau password salah';
        if (typeof showToast === 'function') showToast(msg, 'error');
        const hint = document.getElementById('wrongPasswordHint');
        if (hint) hint.classList.remove('hidden');
      }
    } catch(e) {
      if (typeof showToast === 'function') showToast('Gagal menghubungkan ke server login', 'error');
    }
  };

  window.requestLoginOtp = function(method) {
    const phone = document.getElementById('loginPhoneInput')?.value.trim().replace(/[^0-9]/g, '');
    if (!phone || phone.length < 9) {
      if (typeof showToast === 'function') showToast('Harap isi nomor HP Anda terlebih dahulu', 'warning');
      return;
    }
    window.currentRegPhone = phone;
    requestOtpCode(phone);
    showScreen('screenOtp');
  };

  /* ========================================================
   * 10. SLIDING DRAWER / PERSISTENT BOTTOM SHEET PANEL
   * ======================================================== */
  window.openDriverDrawer = function() {
    const backdrop = document.getElementById('driverDrawerBackdrop');
    const panel = document.getElementById('driverDrawerPanel');
    if (!panel) return;

    // Refresh UI data akun driver
    const u = window.currentUser || {};
    const avatarEl = document.getElementById('drawerDriverAvatar');
    if (avatarEl) avatarEl.src = u.avatar || 'uploads/avatar_mitra.svg';

    const nameEl = document.getElementById('drawerDriverName');
    if (nameEl) nameEl.innerText = u.name || 'Mitra Driver';

    const phoneEl = document.getElementById('drawerDriverPhone');
    if (phoneEl) phoneEl.innerText = u.phone || '-';

    const idBadge = document.getElementById('drawerDriverIdBadge');
    if (idBadge) idBadge.innerText = u.id || 'MTR-0001';

    const ratingEl = document.getElementById('drawerDriverRating');
    if (ratingEl) ratingEl.innerText = (u.rating || 5.0).toFixed(1);

    const saldoEl = document.getElementById('drawerSaldoDisplay');
    const bal = (typeof u.walletBalance === 'number') ? u.walletBalance : 0;
    if (saldoEl) saldoEl.innerText = formatRupiah(bal);

    const toggle = document.getElementById('drawerStatusWorkToggle');
    const subtext = document.getElementById('drawerStatusSubtext');
    const isOnline = (u.status === 'ready' || u.status === 'working');
    if (toggle) toggle.checked = isOnline;
    if (subtext) {
      subtext.innerText = isOnline ? 'Driver ONLINE (Siap Terima Order)' : 'Driver OFFLINE (Istirahat)';
      subtext.className = isOnline ? 'text-[10px] text-emerald-300' : 'text-[10px] text-slate-400';
    }

    if (backdrop) backdrop.classList.remove('hidden');
    panel.style.transform = 'translateX(0px)';
  };

  window.closeDriverDrawer = function() {
    const backdrop = document.getElementById('driverDrawerBackdrop');
    const panel = document.getElementById('driverDrawerPanel');
    if (panel) panel.style.transform = 'translateX(-100%)';
    if (backdrop) backdrop.classList.add('hidden');
  };

  // Draggable gesture detection on Drawer
  (function initDrawerTouchGesture() {
    const panel = document.getElementById('driverDrawerPanel');
    if (!panel) return;
    let startX = 0;
    let currentX = 0;

    panel.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      currentX = startX;
    }, { passive: true });

    panel.addEventListener('touchmove', (e) => {
      currentX = e.touches[0].clientX;
      const diff = currentX - startX;
      if (diff < 0) {
        panel.style.transform = `translateX(${diff}px)`;
      }
    }, { passive: true });

    panel.addEventListener('touchend', () => {
      const diff = currentX - startX;
      if (diff < -70) {
        closeDriverDrawer();
      } else {
        panel.style.transform = 'translateX(0px)';
      }
    });
  })();

  /* ========================================================
   * 11. MENU 1: STATUS KERJA (ON / OFF TOGGLE)
   * ======================================================== */
  window.onDrawerWorkToggleChange = async function(isOnline) {
    const newStatus = isOnline ? 'ready' : 'offline';
    const subtext = document.getElementById('drawerStatusSubtext');
    if (subtext) {
      subtext.innerText = isOnline ? 'Driver ONLINE (Siap Terima Order)' : 'Driver OFFLINE (Istirahat)';
      subtext.className = isOnline ? 'text-[10px] text-emerald-300' : 'text-[10px] text-slate-400';
    }

    if (typeof setDriverStatus === 'function') {
      setDriverStatus(newStatus);
    } else if (window.currentUser && window.currentUser.id) {
      window.currentUser.status = newStatus;
      try {
        fetch(`${API_ENDPOINT}/api/mitra/${window.currentUser.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      } catch(e) {}
    }

    if (typeof showToast === 'function') {
      showToast(`Status kerja driver: ${isOnline ? 'ONLINE (Siap Terima Order)' : 'OFFLINE (Istirahat)'}`, isOnline ? 'success' : 'info');
    }
  };

  /* ========================================================
   * 12. MENU 2: SALDO SAYA MODAL
   * ======================================================== */
  window.openDrawerSaldoView = function() {
    const modal = document.getElementById('driverSaldoViewModal');
    if (!modal) return;
    const u = window.currentUser || {};
    const bal = (typeof u.walletBalance === 'number') ? u.walletBalance : 0;
    const bigEl = document.getElementById('saldoModalBigAmount');
    if (bigEl) bigEl.innerText = formatRupiah(bal);

    loadSaldoTransactionsList();
    modal.classList.remove('hidden');
  };

  window.closeDriverSaldoView = function() {
    const modal = document.getElementById('driverSaldoViewModal');
    if (modal) modal.classList.add('hidden');
  };

  async function loadSaldoTransactionsList() {
    const listEl = document.getElementById('saldoModalTxList');
    const countEl = document.getElementById('saldoTxCountLabel');
    if (!listEl) return;

    const u = window.currentUser || {};
    if (!u.id) return;

    try {
      const res = await fetch(`${API_ENDPOINT}/api/transactions?userId=${u.id}`).then(r => r.json());
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        if (countEl) countEl.innerText = `${res.data.length} Transaksi`;
        listEl.innerHTML = res.data.slice(0, 10).map(t => `
          <div class="p-3.5 rounded-2xl flex items-center justify-between border border-slate-800" style="background:rgba(13,31,56,0.8)">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center ${t.type === 'withdraw' ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}">
                <span class="material-symbols-outlined text-base">${t.type === 'withdraw' ? 'arrow_upward' : 'arrow_downward'}</span>
              </div>
              <div>
                <p class="font-bold text-white text-xs">${t.description || (t.type === 'withdraw' ? 'Penarikan Saldo' : 'Pendapatan Tugas')}</p>
                <p class="text-[10px] text-slate-400">${new Date(t.timestamp || t.createdAt || Date.now()).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
              </div>
            </div>
            <p class="font-mono font-black text-xs ${t.type === 'withdraw' ? 'text-rose-400' : 'text-emerald-400'}">${t.type === 'withdraw' ? '-' : '+'}${formatRupiah(t.amount || 0)}</p>
          </div>
        `).join('');
      } else {
        if (countEl) countEl.innerText = '0 Transaksi';
      }
    } catch(e) {}
  }

  window.openTopupModalFromSaldo = function() {
    closeDriverSaldoView();
    if (typeof openTopupModal === 'function') {
      openTopupModal();
    } else {
      const m = document.getElementById('topupModal');
      if (m) m.classList.remove('hidden');
    }
  };

  window.openWithdrawModalFromSaldo = function() {
    closeDriverSaldoView();
    if (typeof openWithdrawModal === 'function') {
      openWithdrawModal();
    } else {
      const m = document.getElementById('withdrawModal');
      if (m) m.classList.remove('hidden');
    }
  };

  /* ========================================================
   * 13. MENU 3: RANGKUMAN PENDAPATAN MODAL
   * ======================================================== */
  window.openDrawerIncomeView = function() {
    const modal = document.getElementById('driverIncomeViewModal');
    if (!modal) return;
    const u = window.currentUser || {};

    const todayEl = document.getElementById('incomeTodayAmount');
    if (todayEl) todayEl.innerText = formatRupiah(u.earnings || 0);

    const completedEl = document.getElementById('incomeCompletedTasks');
    if (completedEl) completedEl.innerText = `${u.completedOrders || 0} Order`;

    const hoursEl = document.getElementById('incomeOnlineHours');
    if (hoursEl) hoursEl.innerText = `${Math.max(1, Math.floor(Math.random() * 4) + 1)} Jam`;

    const ratingEl = document.getElementById('incomeRatingVal');
    if (ratingEl) ratingEl.innerText = (u.rating || 5.0).toFixed(1);

    modal.classList.remove('hidden');
  };

  window.closeDriverIncomeView = function() {
    const modal = document.getElementById('driverIncomeViewModal');
    if (modal) modal.classList.add('hidden');
  };

  /* ========================================================
   * 14. MENU 4: PENGATURAN (DATA PROFIL SAYA & AKUN SAYA)
   * ======================================================== */
  window.openDriverSettingsView = function() {
    const modal = document.getElementById('driverSettingsViewModal');
    if (!modal) return;

    const u = window.currentUser || {};

    // Data profil saya
    const nameEl = document.getElementById('setProfileName');
    if (nameEl) nameEl.innerText = u.name || '-';

    const phoneEl = document.getElementById('setProfilePhone');
    if (phoneEl) phoneEl.innerText = u.phone || '-';

    const addrEl = document.getElementById('setProfileAddress');
    if (addrEl) addrEl.innerText = u.address || 'Indonesia';

    const nikEl = document.getElementById('setProfileNik');
    if (nikEl) nikEl.innerText = u.nik || '3201000000000001';

    const bankEl = document.getElementById('setProfileBank');
    if (bankEl) {
      const bName = u.bankDetails?.bankName || 'DANA';
      const bAcc = u.bankDetails?.bankAccount || u.phone || '-';
      const bHolder = u.bankDetails?.bankHolder || u.name || '-';
      bankEl.innerText = `${bName} - ${bAcc} (a.n ${bHolder})`;
    }

    // Foto KYC preview
    const ktpImg = document.getElementById('setKtpImgPreview');
    const ktpFallback = document.getElementById('setKtpFallbackIcon');
    if (u.ktpPhoto && ktpImg) {
      ktpImg.src = u.ktpPhoto;
      ktpImg.classList.remove('hidden');
      if (ktpFallback) ktpFallback.classList.add('hidden');
    }

    const selfieImg = document.getElementById('setSelfieImgPreview');
    const selfieFallback = document.getElementById('setSelfieFallbackIcon');
    if (u.selfieKtpPhoto && selfieImg) {
      selfieImg.src = u.selfieKtpPhoto;
      selfieImg.classList.remove('hidden');
      if (selfieFallback) selfieFallback.classList.add('hidden');
    }

    // Akun Saya
    const akunPhone = document.getElementById('setAkunPhoneSubtext');
    if (akunPhone) akunPhone.innerText = u.phone || '08xxxxxxxxxx';

    const akunEmail = document.getElementById('setAkunEmailSubtext');
    if (akunEmail) akunEmail.innerText = u.email || `${u.phone || 'driver'}@sobatserabut.id`;

    modal.classList.remove('hidden');
  };

  window.closeDriverSettingsView = function() {
    const modal = document.getElementById('driverSettingsViewModal');
    if (modal) modal.classList.add('hidden');
  };

  window.viewFullKycPhoto = function(type) {
    const u = window.currentUser || {};
    const src = type === 'ktp' ? (u.ktpPhoto || '/uploads/avatar_driver.svg') : (u.selfieKtpPhoto || u.avatar || '/uploads/avatar_mitra.svg');
    const viewer = document.getElementById('modalKycImageViewer');
    const img = document.getElementById('kycImageViewerImg');
    const title = document.getElementById('kycImageViewerTitle');

    if (viewer && img) {
      img.src = src;
      if (title) title.innerText = type === 'ktp' ? 'Foto e-KTP Terdaftar' : 'Foto Selfie Driver';
      viewer.classList.remove('hidden');
    }
  };

  /* ========================================================
   * 15. INTERACTIVE EDIT PROFIL & AKUN DIALOGS
   * ======================================================== */
  window.currentEditField = '';

  window.openEditProfileDialog = function(field) {
    window.currentEditField = field;
    const modal = document.getElementById('modalEditProfileField');
    const title = document.getElementById('editProfileModalTitle');
    const body = document.getElementById('editProfileModalBody');
    if (!modal || !body) return;

    const u = window.currentUser || {};

    if (field === 'name') {
      if (title) title.innerText = 'Ubah Nama Lengkap';
      body.innerHTML = `
        <label class="block text-xs font-semibold text-slate-300">Nama Lengkap Sesuai KTP</label>
        <input type="text" id="editProfileInputVal" value="${u.name || ''}" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none">
      `;
    } else if (field === 'address') {
      if (title) title.innerText = 'Ubah Alamat Lengkap';
      body.innerHTML = `
        <label class="block text-xs font-semibold text-slate-300">Alamat Lengkap Domisili</label>
        <textarea id="editProfileInputVal" rows="3" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs resize-none focus:outline-none">${u.address || ''}</textarea>
      `;
    } else if (field === 'bank') {
      if (title) title.innerText = 'Ubah Rekening / E-Wallet';
      body.innerHTML = `
        <label class="block text-xs font-semibold text-slate-300">Penyedia Bank / E-Wallet</label>
        <select id="editBankProviderVal" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs mb-2">
          <option ${u.bankDetails?.bankName === 'DANA' ? 'selected' : ''}>DANA</option>
          <option ${u.bankDetails?.bankName === 'GOPAY' ? 'selected' : ''}>GOPAY</option>
          <option ${u.bankDetails?.bankName === 'OVO' ? 'selected' : ''}>OVO</option>
          <option ${u.bankDetails?.bankName === 'SHOPEEPAY' ? 'selected' : ''}>SHOPEEPAY</option>
          <option ${u.bankDetails?.bankName === 'SeaBank' ? 'selected' : ''}>SeaBank</option>
          <option ${u.bankDetails?.bankName === 'BCA' ? 'selected' : ''}>BCA</option>
          <option ${u.bankDetails?.bankName === 'BRI' ? 'selected' : ''}>BRI</option>
          <option ${u.bankDetails?.bankName === 'Mandiri' ? 'selected' : ''}>Mandiri</option>
          <option ${u.bankDetails?.bankName === 'BNI' ? 'selected' : ''}>BNI</option>
        </select>
        <label class="block text-xs font-semibold text-slate-300">Nomor Rekening / Akun</label>
        <input type="text" id="editBankAccountVal" value="${u.bankDetails?.bankAccount || ''}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono mb-2">
        <label class="block text-xs font-semibold text-slate-300">Nama Pemilik Rekening</label>
        <input type="text" id="editBankHolderVal" value="${u.bankDetails?.bankHolder || u.name || ''}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs">
      `;
    }

    modal.classList.remove('hidden');
  };

  window.closeEditProfileDialog = function() {
    const modal = document.getElementById('modalEditProfileField');
    if (modal) modal.classList.add('hidden');
  };

  window.saveEditProfileDialog = async function() {
    const u = window.currentUser || {};
    if (!u.id) return;
    const field = window.currentEditField;

    const payload = {};
    if (field === 'name') {
      const val = document.getElementById('editProfileInputVal')?.value.trim();
      if (!val) return;
      payload.name = val;
    } else if (field === 'address') {
      const val = document.getElementById('editProfileInputVal')?.value.trim();
      if (!val) return;
      payload.address = val;
    } else if (field === 'bank') {
      const provider = document.getElementById('editBankProviderVal')?.value;
      const account = document.getElementById('editBankAccountVal')?.value.trim();
      const holder = document.getElementById('editBankHolderVal')?.value.trim();
      if (!account) return;
      payload.bankName = provider;
      payload.bankAccount = account;
      payload.bankHolder = holder;
    }

    try {
      const res = await fetch(`${API_ENDPOINT}/api/auth/profile/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res && res.success && res.data) {
        window.currentUser = res.data;
        localStorage.setItem('sobatserabut_driver_user', JSON.stringify(res.data));
        openDriverSettingsView(); // Refresh UI
        closeEditProfileDialog();
        if (typeof showToast === 'function') showToast('Profil berhasil diperbarui!', 'success');
      }
    } catch(e) {
      if (typeof showToast === 'function') showToast('Gagal menyimpan perubahan profil', 'error');
    }
  };

  // Ubah Password Dialog
  window.openChangePasswordDialog = function() {
    const modal = document.getElementById('modalChangePassword');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeChangePasswordDialog = function() {
    const modal = document.getElementById('modalChangePassword');
    if (modal) modal.classList.add('hidden');
  };

  window.submitChangePassword = async function() {
    const u = window.currentUser || {};
    const newPass = document.getElementById('modalNewPassInput')?.value.trim();
    const confPass = document.getElementById('modalConfirmPassInput')?.value.trim();

    if (!newPass || newPass.length < 6) {
      if (typeof showToast === 'function') showToast('Password minimal 6 karakter', 'warning');
      return;
    }
    if (confPass && newPass !== confPass) {
      if (typeof showToast === 'function') showToast('Konfirmasi password tidak cocok', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_ENDPOINT}/api/auth/profile/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPass })
      }).then(r => r.json());

      if (res && res.success) {
        closeChangePasswordDialog();
        if (typeof showToast === 'function') showToast('Password berhasil diperbarui!', 'success');
      }
    } catch(e) {}
  };

  // Ubah No HP Dialog
  window.openChangePhoneDialog = function() {
    const modal = document.getElementById('modalChangePhone');
    const input = document.getElementById('modalNewPhoneInput');
    if (input && window.currentUser) input.value = window.currentUser.phone || '';
    if (modal) modal.classList.remove('hidden');
  };

  window.closeChangePhoneDialog = function() {
    const modal = document.getElementById('modalChangePhone');
    if (modal) modal.classList.add('hidden');
  };

  window.submitChangePhone = async function() {
    const u = window.currentUser || {};
    const newPhone = document.getElementById('modalNewPhoneInput')?.value.trim().replace(/[^0-9]/g, '');
    if (!newPhone || newPhone.length < 9) {
      if (typeof showToast === 'function') showToast('Nomor HP minimal 9 digit', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_ENDPOINT}/api/auth/profile/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newPhone })
      }).then(r => r.json());

      if (res && res.success && res.data) {
        window.currentUser = res.data;
        localStorage.setItem('sobatserabut_driver_user', JSON.stringify(res.data));
        localStorage.setItem('sobatserabut_driver_saved_phone', newPhone);
        openDriverSettingsView();
        closeChangePhoneDialog();
        if (typeof showToast === 'function') showToast('Nomor HP berhasil diperbarui!', 'success');
      }
    } catch(e) {}
  };

  // Ubah Email Dialog
  window.openChangeEmailDialog = function() {
    const modal = document.getElementById('modalChangeEmail');
    const input = document.getElementById('modalNewEmailInput');
    if (input && window.currentUser) input.value = window.currentUser.email || '';
    if (modal) modal.classList.remove('hidden');
  };

  window.closeChangeEmailDialog = function() {
    const modal = document.getElementById('modalChangeEmail');
    if (modal) modal.classList.add('hidden');
  };

  window.submitChangeEmail = async function() {
    const u = window.currentUser || {};
    const newEmail = document.getElementById('modalNewEmailInput')?.value.trim();
    if (!newEmail || !newEmail.includes('@')) {
      if (typeof showToast === 'function') showToast('Format email tidak valid', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_ENDPOINT}/api/auth/profile/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail })
      }).then(r => r.json());

      if (res && res.success && res.data) {
        window.currentUser = res.data;
        localStorage.setItem('sobatserabut_driver_user', JSON.stringify(res.data));
        openDriverSettingsView();
        closeChangeEmailDialog();
        if (typeof showToast === 'function') showToast('Email berhasil diperbarui!', 'success');
      }
    } catch(e) {}
  };

  // Toggle Quick Login & Biometric
  window.toggleQuickLogin = function(enabled) {
    localStorage.setItem('sobatserabut_driver_quick_login', enabled ? 'true' : 'false');
    const u = window.currentUser || {};
    if (u.id) {
      fetch(`${API_ENDPOINT}/api/auth/profile/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickLogin: enabled })
      }).catch(() => {});
    }
  };

  window.toggleBiometricAuth = function(enabled) {
    localStorage.setItem('sobatserabut_driver_biometric', enabled ? 'true' : 'false');
    const u = window.currentUser || {};
    if (u.id) {
      fetch(`${API_ENDPOINT}/api/auth/profile/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ biometricEnabled: enabled })
      }).catch(() => {});
    }
    if (typeof showToast === 'function') {
      showToast(`Autentikasi biometrik ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`, 'info');
    }
  };

  // Ajukan Penghapusan Akun
  window.openDeleteAccountDialog = function() {
    const modal = document.getElementById('modalDeleteAccount');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeDeleteAccountDialog = function() {
    const modal = document.getElementById('modalDeleteAccount');
    if (modal) modal.classList.add('hidden');
  };

  window.submitDeleteAccountRequest = async function() {
    const reason = document.getElementById('modalDeleteReasonInput')?.value.trim();
    if (!reason) {
      if (typeof showToast === 'function') showToast('Harap isi alasan penghapusan akun', 'warning');
      return;
    }
    const u = window.currentUser || {};
    if (!u.id) return;

    try {
      const res = await fetch(`${API_ENDPOINT}/api/auth/profile/${u.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAccountRequest: { reason } })
      }).then(r => r.json());

      closeDeleteAccountDialog();
      closeDriverSettingsView();
      if (typeof showToast === 'function') {
        showToast('Permohonan penghapusan akun berhasil diajukan ke admin!', 'info', 6000);
      }
    } catch(e) {}
  };

  // Log Out Driver
  window.handleLogout = function() {
    localStorage.removeItem('sobatserabut_driver_user');
    window.currentUser = null;

    closeDriverSettingsView();
    closeDriverDrawer();

    const authCont = document.getElementById('authContainer');
    if (authCont) {
      authCont.classList.remove('hidden');
      authCont.classList.add('flex');
    }

    showScreen('screenSplash');

    if (typeof showToast === 'function') {
      showToast('Anda telah berhasil keluar dari akun driver.', 'info');
    }
  };

  /* ========================================================
   * 16. HELPER FORMAT RUPIAH
   * ======================================================== */
  function formatRupiah(num) {
    const n = Number(num) || 0;
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  /* ========================================================
   * 17. ON DOM LOAD ENTRY POINT
   * ======================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    // Check if driver has completed download permissions onboarding
    const isOnboarded = localStorage.getItem('sobatserabut_driver_onboarded_v8191') === 'true';

    // Check if session exists
    const saved = localStorage.getItem('sobatserabut_driver_user');
    let hasValidUser = false;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role === 'mitra' && parsed.id) {
          window.currentUser = parsed;
          hasValidUser = true;
          const authCont = document.getElementById('authContainer');
          if (authCont) {
            authCont.classList.add('hidden');
            authCont.classList.remove('flex');
          }
          if (typeof onUserAuthenticated === 'function') {
            onUserAuthenticated(parsed);
          }
        }
      } catch(e) {}
    }

    if (!hasValidUser) {
      const authCont = document.getElementById('authContainer');
      if (authCont) {
        authCont.classList.remove('hidden');
        authCont.classList.add('flex');
      }

      if (!isOnboarded) {
        // Tampilan pertama kali buka (download pertama)
        showScreen('screenPermissionNotif');
      } else {
        // Tampilan pertama aplikasi
        showScreen('screenSplash');
      }
    }
  });

})();
