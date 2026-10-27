#!/usr/bin/env bash
# ============================================================
# SobatSerabut - Start Backend Server + Cloudflare Public Tunnel
# Akses dari semua HP (Android/iOS) dan Laptop di mana saja
# ============================================================

PROJECT_DIR="/home/jinny21/SobatSerabut"
cd "$PROJECT_DIR" || exit 1
mkdir -p "$PROJECT_DIR/logs"

echo "========================================================"
echo "🚀 MEMULAI EKOSISTEM SOBATSERABUT..."
echo "========================================================"

# 1. Hentikan instance lama jika ada
command -v pm2 >/dev/null 2>&1 && pm2 delete sobat-backend sobat-tunnel 2>/dev/null || true
PID=$(lsof -ti:4000 2>/dev/null || true)
if [ -n "$PID" ]; then
    echo "-> Menghentikan server lama (PID: $PID)..."
    kill -9 $PID 2>/dev/null || true
    sleep 1
fi
pkill cloudflared 2>/dev/null || true
pkill ngrok 2>/dev/null || true

# 2. Jalankan Server Backend Node.js via PM2
echo "-> Menjalankan Backend Node.js pada port 4000 via PM2..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 start app.js --name "sobat-backend" --log "$PROJECT_DIR/logs/server.log" > /dev/null 2>&1
else
    nohup node app.js > "$PROJECT_DIR/logs/server.log" 2>&1 &
fi
sleep 2

# Verifikasi server berjalan
if ! lsof -ti:4000 >/dev/null 2>&1; then
    echo "❌ Gagal menjalankan server backend! Periksa logs/server.log"
    cat "$PROJECT_DIR/logs/server.log" | tail -n 20
    exit 1
fi
echo "   ✅ Backend berjalan normal di port 4000"

# 3. Jalankan Cloudflare Tunnel untuk Akses Semua HP
echo "-> Menghubungkan Cloudflare Public Tunnel (Protokol HTTP/2 Stabil)..."
rm -f "$PROJECT_DIR/logs/tunnel.log"
# Pastikan tidak ada config.yml lama yang memblokir quick tunnel trycloudflare
if [ -f "$HOME/.cloudflared/config.yml" ]; then
    mv "$HOME/.cloudflared/config.yml" "$HOME/.cloudflared/config.yml.disabled" 2>/dev/null || true
fi

if command -v pm2 >/dev/null 2>&1; then
    pm2 start cloudflared --name "sobat-tunnel" -- tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:4000 --logfile "$PROJECT_DIR/logs/tunnel.log" > /dev/null 2>&1
else
    nohup cloudflared tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:4000 --logfile "$PROJECT_DIR/logs/tunnel.log" > /dev/null 2>&1 &
fi

PUBLIC_URL=""
echo "-> Memindai & memverifikasi sambungan Cloudflare Edge (hingga 45 detik untuk propagasi DNS)..."
for i in {1..45}; do
    CANDIDATE=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "$PROJECT_DIR/logs/tunnel.log" 2>/dev/null | tail -n 1)
    if [ -n "$CANDIDATE" ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 4 "$CANDIDATE" 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "304" ]; then
            PUBLIC_URL="$CANDIDATE"
            echo "   ✅ Cloudflare Tunnel terverifikasi aktif & siap diakses (HTTP $HTTP_CODE): $PUBLIC_URL"
            break
        else
            echo "   ⏳ Menunggu propagasi DNS Cloudflare Edge ($CANDIDATE: status $HTTP_CODE)... [$i/45]"
        fi
    fi
    sleep 1
done

# Fallback ke Ngrok Tunnel jika Cloudflare bermasalah / timeout
if [ -z "$PUBLIC_URL" ]; then
    echo "-> Cloudflare tunnel belum aktif, otomatis beralih ke cadangan Ngrok Tunnel..."
    pkill -f ngrok 2>/dev/null || true
    nohup ngrok http 4000 --log=stdout > "$PROJECT_DIR/logs/ngrok.log" 2>&1 &
    for j in {1..15}; do
        sleep 1
        NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o 'https://[a-zA-Z0-9.-]*\.ngrok[a-zA-Z0-9.-]*' | head -n 1)
        if [ -n "$NGROK_URL" ]; then
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 4 "$NGROK_URL" 2>/dev/null || echo "000")
            if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
                PUBLIC_URL="$NGROK_URL"
                echo "   ✅ Ngrok Tunnel terverifikasi aktif & siap diakses (HTTP $HTTP_CODE): $PUBLIC_URL"
                break
            fi
        fi
    done
fi

if [ -z "$PUBLIC_URL" ] || [ "$PUBLIC_URL" = "http://127.0.0.1:4000" ]; then
    CF_PREV=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "$PROJECT_DIR/logs/tunnel.log" 2>/dev/null | tail -n 1)
    if [ -n "$CF_PREV" ]; then
        PUBLIC_URL="$CF_PREV"
    else
        PUBLIC_URL="http://127.0.0.1:4000"
        echo "⚠️ Tunnel publik belum siap, gunakan akses lokal."
    fi
fi

echo "$PUBLIC_URL" > "$PROJECT_DIR/logs/public_url.txt"

# Update config.js dengan URL aktif di semua aplikasi
cat <<EOF > "$PROJECT_DIR/driver-app/js/config.js"
window.SOBATSERABUT_CONFIG = {
  DEFAULT_API_URL: "$PUBLIC_URL",
  VERSION: "1.0.0",
  BUILD_DATE: "$(date '+%Y-%m-%d %H:%M:%S')"
};
EOF
cp "$PROJECT_DIR/driver-app/js/config.js" "$PROJECT_DIR/client-app/js/config.js"
cp "$PROJECT_DIR/driver-app/js/config.js" "$PROJECT_DIR/mitra-app/js/config.js"
mkdir -p "$PROJECT_DIR/android-app/app/src/main/assets/www/js"
cp "$PROJECT_DIR/driver-app/js/config.js" "$PROJECT_DIR/android-app/app/src/main/assets/www/js/config.js"

# Otomatis Kompilasi 2 APK Produksi (Driver & Klien) dengan URL terbaru
echo "-> Menyusun & mengompilasi APK Android terbaru..."
if [ -f "$PROJECT_DIR/android-app/build_both_apks.sh" ]; then
    bash "$PROJECT_DIR/android-app/build_both_apks.sh" > /dev/null 2>&1 || true
    cp "$PROJECT_DIR/android-app/Driver-SobatSerabut.apk" "/home/jinny21/Driver-SobatSerabut.apk" 2>/dev/null || true
    cp "$PROJECT_DIR/android-app/Driver-SobatSerabut.apk" "/home/jinny21/SobatSerabut-Mitra.apk" 2>/dev/null || true
    cp "$PROJECT_DIR/android-app/SobatSerabut.apk" "/home/jinny21/SobatSerabut.apk" 2>/dev/null || true
elif [ -f "$PROJECT_DIR/android-app/build_apk.sh" ]; then
    bash "$PROJECT_DIR/android-app/build_apk.sh" > /dev/null 2>&1 || true
fi

echo ""
echo "========================================================"
echo "🎉 SOBATSERABUT AKTIF & SIAP DIAKSES DARI SEMUA PERANGKAT!"
echo "========================================================"
echo ""
echo "🔗 3 LINK AKSES TERPISAH (Buka di Browser HP / Laptop):"
echo ""
echo "  1️⃣  DRIVER MITRA (Pekerja Harian & Pengemudi):"
echo "      👉 Publik : $PUBLIC_URL/driver"
echo "      👉 Lokal  : http://localhost:4000/driver"
echo ""
echo "  2️⃣  SOBATSERABUT (Klien & Pemohon Jasa):"
echo "      👉 Publik : $PUBLIC_URL"
echo "      👉 Lokal  : http://localhost:4000"
echo ""
echo "  3️⃣  ADMIN PUSAT (Dasbor Pemantauan GPS & Kontrol):"
echo "      👉 Publik : $PUBLIC_URL/admin"
echo "      👉 Lokal  : http://localhost:4000/admin"
echo "      🔑 Kata Sandi Master Admin: adminserabut2026"
echo ""
echo "--------------------------------------------------------"
echo "📦 LINK UNDUH APLIKASI ANDROID (APK RESMI):"
echo "   👉 Driver Mitra APK : $PUBLIC_URL/download/driver-apk"
echo "   👉 SobatSerabut APK : $PUBLIC_URL/download/client-apk"
echo "   👉 Portal Download  : $PUBLIC_URL/portal"
echo "========================================================"
