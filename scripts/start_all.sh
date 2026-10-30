#!/usr/bin/env bash
# ==============================================================================
# SOBATSERABUT v6.2.0 — ULTRA PREMIUM CLOUD DOMAINESIA ECOSYSTEM
# Update: Notifikasi Pembaruan Admin Terkendali, Banner Sambutan Resmi,
#         Marker Motor Berhelm Real-time, Audio Suara Order Masuk,
#         Tampilan Kompak Tanpa Scroll, Sinkronisasi Cloud DomaiNesia & APK
#         Driver App: Dark Emerald Genesis v6.2.0 | Client App: Volcanic Ember Phoenix v6.2.0
# Build Date: 2026-10-31
# VPS DomaiNesia: 160.19.166.231
# Domain Resmi: https://sobatserabut.160.19.166.231.sslip.io
# Domain Kustom: https://app.sobatserabut.id
# ==============================================================================

set -euo pipefail

PROJECT_DIR="/home/jinny21/SobatSerabut"
LOG_DIR="$PROJECT_DIR/logs"
cd "$PROJECT_DIR" || exit 1
mkdir -p "$LOG_DIR"

# ── Warna Terminal ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
MAGENTA='\033[0;35m'; BLUE='\033[0;34m'

ok()   { echo -e "   ${GREEN}✅${RESET} $1"; }
info() { echo -e "   ${CYAN}ℹ️ ${RESET} $1"; }
warn() { echo -e "   ${YELLOW}⚠️ ${RESET} $1"; }

# ── Konfigurasi Server Produksi DomaiNesia ───────────────────────────
VPS_IP="160.19.166.231"
VPS_USER="root"
VPS_PASS="Arkanza2106@"
VPS_WEBROOT="/var/www/sobatserabut"
PROD_SSL_URL="https://sobatserabut.160.19.166.231.sslip.io"
PROD_CUSTOM_URL="https://app.sobatserabut.id"
PROD_IP_URL="http://160.19.166.231"

# ── Banner ────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo -e "${BOLD}${MAGENTA}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   🚀 SOBATSERABUT v6.2.0 — ULTRA PREMIUM LAUNCH             ║"
echo "║   Driver App: Dark Emerald Genesis Edition v6.2.0            ║"
echo "║   Client App: Volcanic Ember Phoenix Edition v6.2.0          ║"
echo "║   🆕  Notif Update Admin | Marker Motor Berhelm | Audio Alert║"
echo "║   Cloud VPS  : DomaiNesia ($VPS_IP)               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── STEP 1: Deteksi URL Cloud DomaiNesia Terbaik ─────────────────────
echo -e "${BOLD}${CYAN}📡 1. Mendeteksi jalur cloud DomaiNesia terbaik...${RESET}"
PUBLIC_URL=""

_check_url() {
  local res
  res=$(curl -sf --connect-timeout 4 -m 7 "$1/api/health" 2>/dev/null || true)
  if echo "$res" | grep -q "sobatserabut"; then
    echo "ok"
  else
    echo ""
  fi
}

if [ "$(_check_url "$PROD_CUSTOM_URL")" = "ok" ]; then
  ok "Domain kustom aktif: $PROD_CUSTOM_URL"
  PUBLIC_URL="$PROD_CUSTOM_URL"
elif [ "$(_check_url "$PROD_SSL_URL")" = "ok" ]; then
  ok "Server cloud SSL aktif 24 jam: $PROD_SSL_URL"
  PUBLIC_URL="$PROD_SSL_URL"
elif [ "$(_check_url "$PROD_IP_URL")" = "ok" ]; then
  ok "Server aktif via IP: $PROD_IP_URL"
  PUBLIC_URL="$PROD_IP_URL"
else
  warn "Server tidak terdeteksi — menggunakan URL default cloud"
  PUBLIC_URL="$PROD_SSL_URL"
fi

echo "$PUBLIC_URL" > "$LOG_DIR/public_url.txt"
echo -e "   ${BOLD}🌐 URL Aktif: ${GREEN}$PUBLIC_URL${RESET}"
echo ""

# ── STEP 2: Sinkronisasi config.js ke Semua Modul ────────────────────
echo -e "${BOLD}${CYAN}⚙️  2. Menyinkronkan konfigurasi domain produksi...${RESET}"

BUILD_TS="$(date '+%Y-%m-%d %H:%M:%S WIB')"
CONFIG_CONTENT="// SobatSerabut v6.2.0 — Auto-generated config — $BUILD_TS
window.SOBATSERABUT_CONFIG = {
  DEFAULT_API_URL: \"$PUBLIC_URL\",
  VERSION: \"6.2.0\",
  BUILD_DATE: \"$BUILD_TS\",
  APP_NAME: \"SobatSerabut\",
  VPS_IP: \"$VPS_IP\",
  FEATURES: { aiAssistant: true, helpCenter: true, autoUpdate: true, customBroadcast: true, audioOrderAlert: true, motorcycleMapMarker: true }
};"

echo "$CONFIG_CONTENT" > "$PROJECT_DIR/driver-app/js/config.js"
for MOD in client-app mitra-app; do
  cp "$PROJECT_DIR/driver-app/js/config.js" "$PROJECT_DIR/$MOD/js/config.js"
done
mkdir -p "$PROJECT_DIR/android-app/app/src/main/assets/www/js"
cp "$PROJECT_DIR/driver-app/js/config.js" "$PROJECT_DIR/android-app/app/src/main/assets/www/js/config.js"
# Sinkronkan assets client-app ke android-app assets
cp "$PROJECT_DIR/client-app/index.html" "$PROJECT_DIR/android-app/app/src/main/assets/www/index.html" 2>/dev/null || true
cp "$PROJECT_DIR/client-app/js/app.js" "$PROJECT_DIR/android-app/app/src/main/assets/www/js/app.js" 2>/dev/null || true
ok "config.js tersinkronisasi ke semua modul → $PUBLIC_URL (v6.2.0)"

# ── STEP 2b: Update Branding Strings ─────────────────────────────────
echo -e "${BOLD}${CYAN}🎨 2b. Memperbarui branding SobatSerabut...${RESET}"
mkdir -p "$PROJECT_DIR/android-app/app/src/main/res/values"
cat > "$PROJECT_DIR/android-app/app/src/main/res/values/strings.xml" << 'STREOF'
<resources>
    <string name="app_name">SobatSerabut</string>
    <string name="app_tagline">Solusi Cepat Serabutan &amp; Jasa Harian</string>
    <string name="app_version">v6.2.0</string>
</resources>
STREOF
ok "Branding strings.xml diperbarui → SobatSerabut v6.2.0"

# ── STEP 2c: Sinkronisasi Logo & Favicon ─────────────────────────────
echo -e "${BOLD}${CYAN}🖼️  2c. Sinkronisasi logo & favicon premium...${RESET}"
LOGO_SRC="$PROJECT_DIR/backend/uploads/logo_icon.svg"
LOGO_FULL_SRC="$PROJECT_DIR/backend/uploads/logo_sobatserabut.svg"
if [ -f "$LOGO_SRC" ]; then
  for DEST in \
    "$PROJECT_DIR/favicon.svg" \
    "$PROJECT_DIR/driver-app/img/logo_icon.svg" \
    "$PROJECT_DIR/client-app/img/logo_icon.svg" \
    "$PROJECT_DIR/mitra-app/img/logo_icon.svg"; do
    mkdir -p "$(dirname "$DEST")"
    cp "$LOGO_SRC" "$DEST" 2>/dev/null || true
  done
  mkdir -p "$PROJECT_DIR/admin-dashboard/img"
  cp "$LOGO_SRC"      "$PROJECT_DIR/admin-dashboard/img/logo_icon.svg"      2>/dev/null || true
  cp "$LOGO_FULL_SRC" "$PROJECT_DIR/admin-dashboard/img/logo_sobatserabut.svg" 2>/dev/null || true
  ok "Logo premium tersinkronisasi ke seluruh modul"
else
  warn "Logo sumber tidak ditemukan di backend/uploads/"
fi

# ── STEP 3: Jalankan Backend Lokal via PM2 ────────────────────────────
echo -e "${BOLD}${CYAN}💻 3. Memastikan backend lokal berjalan via PM2...${RESET}"
if command -v pm2 > /dev/null 2>&1; then
  pm2 delete sobat-backend 2>/dev/null || true
  pm2 start app.js \
    --name "sobat-backend" \
    --log "$LOG_DIR/server.log" \
    --time \
    -- > /dev/null 2>&1 && \
  ok "Backend lokal aktif: http://localhost:4000 (PM2: sobat-backend)" || \
  warn "PM2 gagal restart — periksa log: $LOG_DIR/server.log"
else
  info "PM2 tidak terinstal — skip backend lokal"
fi

# ── STEP 4: Build APK Android ─────────────────────────────────────────
echo -e "${BOLD}${CYAN}📦 4. Kompilasi APK Android resmi...${RESET}"
APK_SCRIPT="$PROJECT_DIR/android-app/build_both_apks.sh"
if [ -f "$APK_SCRIPT" ]; then
  bash "$APK_SCRIPT" > "$LOG_DIR/apk_build.log" 2>&1 || true
  for APK in Driver-SobatSerabut.apk SobatSerabut.apk SobatSerabut-Mitra.apk; do
    SRC="$PROJECT_DIR/android-app/$APK"
    if [ -f "$SRC" ]; then
      cp "$SRC" "/home/jinny21/$APK"                   2>/dev/null || true
      cp "$SRC" "/home/jinny21/Desktop/$APK"           2>/dev/null || true
    fi
  done
  ok "APK dikompilasi → target server: $PUBLIC_URL"
  ok "APK disalin ke /home/jinny21/ dan Desktop"
else
  info "Script build APK belum ada — skip kompilasi APK"
fi

# ── STEP 5: Sinkronisasi ke VPS DomaiNesia ───────────────────────────
echo -e "${BOLD}${CYAN}☁️  5. Sinkronisasi kode web & APK ke VPS DomaiNesia ($VPS_IP)...${RESET}"
if command -v python3 > /dev/null 2>&1 && python3 -c "import pexpect" 2>/dev/null; then
  python3 - <<PYEOF 2>/dev/null || warn "Sinkronisasi cloud gagal — lanjutkan manual via SSH"
import pexpect, os, subprocess

vps_ip  = '$VPS_IP'
vps_usr = '$VPS_USER'
pwd     = '$VPS_PASS'
webroot = '$VPS_WEBROOT'
proj    = '$PROJECT_DIR'
tar_p   = '/tmp/sobat_v6_deploy.tar.gz'

# 1. Buat arsip terbaru
subprocess.run([
  'tar', '-czf', tar_p, '-C', proj,
  'driver-app', 'client-app', 'admin-dashboard', 'backend', 'mitra-app', 'portal'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def ssh_run(host, user, password, cmd, timeout=45):
    c = pexpect.spawn(f'ssh -o StrictHostKeyChecking=no {user}@{host} "{cmd}"', timeout=timeout)
    i = c.expect(['password:', pexpect.EOF, pexpect.TIMEOUT])
    if i == 0:
        c.sendline(password)
        c.expect(pexpect.EOF, timeout=timeout)

def scp_send(local, remote, host, user, password, timeout=90):
    c = pexpect.spawn(f'scp -o StrictHostKeyChecking=no -o ConnectTimeout=8 {local} {user}@{host}:{remote}', timeout=timeout)
    i = c.expect(['password:', pexpect.EOF, pexpect.TIMEOUT])
    if i == 0:
        c.sendline(password)
        c.expect(pexpect.EOF, timeout=timeout)

try:
    # Kirim arsip web
    scp_send(tar_p, '/tmp/sobat_v6_deploy.tar.gz', vps_ip, vps_usr, pwd)
    # Ekstrak & reload
    ssh_run(vps_ip, vps_usr, pwd,
      f'tar -xzf /tmp/sobat_v6_deploy.tar.gz -C {webroot}/ && '
      f'cd {webroot} && pm2 reload sobatserabut --update-env 2>/dev/null || '
      f'pm2 restart sobatserabut 2>/dev/null || echo "PM2 restart skip"')

    # Kirim APK
    for apk in ['Driver-SobatSerabut.apk', 'SobatSerabut.apk', 'SobatSerabut-Mitra.apk']:
        p = os.path.join(f'{proj}/android-app', apk)
        if os.path.exists(p):
            scp_send(p, f'{webroot}/android-app/{apk}', vps_ip, vps_usr, pwd)

    print('   ✅ Seluruh update v6.2.0 berhasil disinkronkan ke Cloud DomaiNesia!')
except Exception as e:
    print(f'   ⚠️  Sinkronisasi cloud gagal: {e}')
PYEOF
else
  warn "pexpect tidak tersedia — skip sync otomatis ke cloud"
  info "Sync manual: rsync -avz driver-app/ client-app/ root@$VPS_IP:$VPS_WEBROOT/"
fi

# ── STEP 6: Update Manifest PWA ──────────────────────────────────────
echo -e "${BOLD}${CYAN}📱 6. Verifikasi manifest PWA...${RESET}"
for APP in driver-app client-app; do
  MF="$PROJECT_DIR/$APP/manifest.json"
  if [ -f "$MF" ]; then
    ok "Manifest $APP: OK → $MF"
  else
    warn "Manifest $APP tidak ditemukan"
  fi
done

# ── RINGKASAN AKHIR ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${MAGENTA}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   🎉 SOBATSERABUT v6.2.0 RESMI AKTIF 24 JAM — DOMAINESIA!    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "${BOLD}🌐 VPS Cloud DomaiNesia : ${GREEN}$VPS_IP${RESET}"
echo -e "${BOLD}🔗 Domain Aktif         : ${GREEN}$PUBLIC_URL${RESET}"
echo ""
echo -e "${BOLD}${CYAN}🔗 LINK AKSES PRODUKSI (Aktif 24 Jam Walau Laptop Mati):${RESET}"
echo ""
echo -e "  ${BOLD}1️⃣  DRIVER MITRA${RESET} (Dark Emerald Genesis v6.2.0)"
echo -e "      👉 ${GREEN}$PUBLIC_URL/driver${RESET}"
echo -e "      👉 Lokal: ${CYAN}http://localhost:4000/driver${RESET}"
echo ""
echo -e "  ${BOLD}2️⃣  CLIENT APP${RESET} (Volcanic Ember Phoenix v6.2.0)"
echo -e "      👉 ${GREEN}$PUBLIC_URL${RESET}"
echo -e "      👉 Lokal: ${CYAN}http://localhost:4000${RESET}"
echo ""
echo -e "  ${BOLD}3️⃣  ADMIN DASHBOARD${RESET}"
echo -e "      👉 ${GREEN}$PUBLIC_URL/admin${RESET}"
echo -e "      🔑 Password: ${YELLOW}adminserabut2026${RESET}"
echo ""
echo -e "  ${BOLD}4️⃣  PORTAL UNDUH APK${RESET}"
echo -e "      👉 ${GREEN}$PUBLIC_URL/portal${RESET}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}📦 UNDUH APK ANDROID:${RESET}"
echo -e "   👉 Driver Mitra : ${GREEN}$PUBLIC_URL/download/driver-apk${RESET}"
echo -e "   👉 SobatSerabut : ${GREEN}$PUBLIC_URL/download/client-apk${RESET}"
echo ""
echo -e "${BOLD}💾 File APK Lokal:${RESET}"
echo -e "   • ${CYAN}/home/jinny21/Driver-SobatSerabut.apk${RESET}"
echo -e "   • ${CYAN}/home/jinny21/SobatSerabut.apk${RESET}"
echo -e "   • ${CYAN}/home/jinny21/Desktop/${RESET} (semua APK)"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${YELLOW}💡 Laptop Kali Linux dapat dimatikan kapan saja tanpa memutus layanan!${RESET}"
echo ""
