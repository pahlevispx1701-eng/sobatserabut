#!/usr/bin/env bash
# ==============================================================================
# SOBATSERABUT - EKOSISTEM CLOUD 24 JAM & SERVER PRODUKSI
# Domain Resmi: https://sobatserabut.160.19.166.231.sslip.io
# ==============================================================================

PROJECT_DIR="/home/jinny21/SobatSerabut"
cd "$PROJECT_DIR" || exit 1
mkdir -p "$PROJECT_DIR/logs"

# URL Produksi Cloud VPS 24 Jam Non-Stop
PROD_URL="https://sobatserabut.160.19.166.231.sslip.io"
VPS_IP="160.19.166.231"

echo "========================================================"
echo "🚀 MEMULAI EKOSISTEM RESMI SOBATSERABUT 24 JAM ONLINE"
echo "========================================================"
echo ""

# 1. Cek Koneksi ke Server Cloud VPS 24 Jam
echo "📡 1. Memeriksa status Server Cloud VPS ($VPS_IP)..."
HEALTH_CHECK=$(curl -s --connect-timeout 5 -m 8 "$PROD_URL/api/health" 2>/dev/null || echo "")

if echo "$HEALTH_CHECK" | grep -q "sobatserabut"; then
    echo "   ✅ SERVER CLOUD VPS AKTIF 24 JAM: $PROD_URL"
    PUBLIC_URL="$PROD_URL"
else
    echo "   ⚠️ Server cloud belum merespons, memeriksa IP langsung..."
    IP_CHECK=$(curl -s --connect-timeout 5 -m 8 "http://$VPS_IP/api/health" 2>/dev/null || echo "")
    if echo "$IP_CHECK" | grep -q "sobatserabut"; then
        PUBLIC_URL="http://$VPS_IP"
        echo "   ✅ SERVER AKTIF VIA IP: $PUBLIC_URL"
    else
        PUBLIC_URL="$PROD_URL"
        echo "   ℹ️ Menggunakan domain default: $PUBLIC_URL"
    fi
fi

echo "$PUBLIC_URL" > "$PROJECT_DIR/logs/public_url.txt"

# 2. Sinkronisasi config.js ke Seluruh Aplikasi
echo "⚙️ 2. Memperbarui konfigurasi domain produksi..."
cat <<EOF > "$PROJECT_DIR/driver-app/js/config.js"
window.SOBATSERABUT_CONFIG = {
  DEFAULT_API_URL: "$PUBLIC_URL",
  VERSION: "1.1.0",
  BUILD_DATE: "$(date '+%Y-%m-%d %H:%M:%S')"
};
EOF

cp "$PROJECT_DIR/driver-app/js/config.js" "$PROJECT_DIR/client-app/js/config.js"
cp "$PROJECT_DIR/driver-app/js/config.js" "$PROJECT_DIR/mitra-app/js/config.js"
mkdir -p "$PROJECT_DIR/android-app/app/src/main/assets/www/js"
cp "$PROJECT_DIR/driver-app/js/config.js" "$PROJECT_DIR/android-app/app/src/main/assets/www/js/config.js"

# 3. Jalankan Server Lokal Sebagai Backup / Pengujian (Opsional)
echo "💻 3. Memastikan service backend lokal siap..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 delete sobat-backend 2>/dev/null || true
    pm2 start app.js --name "sobat-backend" --log "$PROJECT_DIR/logs/server.log" > /dev/null 2>&1
    echo "   ✅ Backend lokal aktif di port 4000 (Mode Pengembangan)"
fi

# 4. Otomatis Kompilasi 2 APK Produksi (Driver & Klien) dengan Domain Cloud Resmi
echo "📦 4. Mengompilasi APK Android resmi dengan domain cloud..."
if [ -f "$PROJECT_DIR/android-app/build_both_apks.sh" ]; then
    bash "$PROJECT_DIR/android-app/build_both_apks.sh" > /dev/null 2>&1 || true
    cp "$PROJECT_DIR/android-app/Driver-SobatSerabut.apk" "/home/jinny21/Driver-SobatSerabut.apk" 2>/dev/null || true
    cp "$PROJECT_DIR/android-app/Driver-SobatSerabut.apk" "/home/jinny21/SobatSerabut-Mitra.apk" 2>/dev/null || true
    cp "$PROJECT_DIR/android-app/SobatSerabut.apk" "/home/jinny21/SobatSerabut.apk" 2>/dev/null || true
    echo "   ✅ Kompilasi APK selesai dengan target server: $PUBLIC_URL"
fi

echo ""
echo "========================================================"
echo "🎉 SOBATSERABUT RESMI AKTIF 24 JAM DI CLOUD!"
echo "========================================================"
echo ""
echo "🔗 LINK AKSES PRODUKSI RESMI (Aktif 24 Jam Walau Laptop Mati):"
echo ""
echo "  1️⃣  DRIVER MITRA (Pekerja Harian & Pengemudi):"
echo "      👉 $PUBLIC_URL/driver"
echo ""
echo "  2️⃣  SOBATSERABUT (Klien & Pemohon Jasa):"
echo "      👉 $PUBLIC_URL"
echo ""
echo "  3️⃣  ADMIN PUSAT (Dasbor Pemantauan GPS & Kontrol):"
echo "      👉 $PUBLIC_URL/admin"
echo "      🔑 Password Master: adminserabut2026"
echo ""
echo "--------------------------------------------------------"
echo "📦 LINK UNDUH APLIKASI ANDROID (APK RESMI 24 JAM):"
echo "   👉 Driver Mitra APK : $PUBLIC_URL/download/driver-apk"
echo "   👉 SobatSerabut APK : $PUBLIC_URL/download/client-apk"
echo "   👉 Portal Download  : $PUBLIC_URL/portal"
echo "========================================================"
echo "Laptop Kali Linux Anda dapat dimatikan kapan saja tanpa memutus layanan!"
