#!/bin/bash
# ==============================================================================
# SOBATSERABUT - AUTO SETUP PRODUCTION SERVER (UBUNTU / DEBIAN / KALI VPS)
# ==============================================================================

set -e

echo "===================================================="
echo "🚀 MEMULAI SETUP OTOMATIS SOBATSERABUT DI VPS"
echo "===================================================="

# 1. Update paket sistem
echo "📦 1. Memperbarui paket sistem..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw nginx

# 2. Install Node.js (v20 LTS) jika belum terpasang
if ! command -v node &> /dev/null || [ $(node -v | cut -d'.' -f1 | sed 's/v//') -lt 18 ]; then
    echo "📦 2. Menginstal Node.js v20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "✅ Node.js: $(node -v)"
echo "✅ NPM: $(npm -v)"

# 3. Install PM2 (Process Manager agar selalu aktif 24 jam)
echo "⚙️ 3. Menginstal PM2 Process Manager..."
npm install -g pm2

# 4. Clone atau Update Repository SobatSerabut
APP_DIR="/var/www/sobatserabut"
REPO_URL="https://github.com/pahlevispx1701-eng/sobatserabut.git"

if [ -d "$APP_DIR" ]; then
    echo "🔄 4. Direktori aplikasi sudah ada, memperbarui dari GitHub..."
    cd "$APP_DIR"
    git reset --hard origin/main 2>/dev/null || true
    git pull origin main
else
    echo "📥 4. Meng-clone repositori SobatSerabut dari GitHub..."
    mkdir -p /var/www
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 5. Install Dependencies
echo "📦 5. Menginstal dependensi proyek..."
npm install --production
cd "$APP_DIR/backend"
npm install --production
cd "$APP_DIR"

# 6. Buat folder data, uploads, logs
mkdir -p "$APP_DIR/backend/data" "$APP_DIR/backend/uploads" "$APP_DIR/logs"
chmod -R 755 "$APP_DIR"

# 7. Jalankan dengan PM2
echo "🚀 7. Menjalankan SobatSerabut dengan PM2..."
pm2 delete sobatserabut 2>/dev/null || true
pm2 start app.js --name "sobatserabut" --env PORT=4000
pm2 save
STARTUP_CMD=$(pm2 startup systemd -u root --hp /root 2>/dev/null | grep -E 'sudo|env PATH' | tail -n 1)
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD" || true
fi

# 8. Setup Nginx Reverse Proxy (agar bisa diakses via Port 80 langsung tanpa :4000)
echo "🌐 8. Mengonfigurasi Nginx Reverse Proxy..."
cat << 'EOF' > /etc/nginx/sites-available/sobatserabut
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/sobatserabut /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 9. Buka Firewall
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp || true
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
fi

# Ambil IP Publik Server
PUBLIC_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')

echo ""
echo "===================================================="
echo "🎉 SOBATSERABUT BERHASIL DIAKTIFKAN 24 JAM DI VPS!"
echo "===================================================="
echo "🌐 URL Utama: http://$PUBLIC_IP"
echo "📱 Portal Download APK: http://$PUBLIC_IP/portal"
echo "🛵 Web Driver / Mitra: http://$PUBLIC_IP/driver"
echo "👤 Web Klien: http://$PUBLIC_IP/client"
echo "⚙️ Dashboard Admin: http://$PUBLIC_IP/admin"
echo "===================================================="
echo "Server sekarang berjalan 24 jam non-stop menggunakan PM2."
echo "Laptop Kali Linux Anda aman dimatikan kapan saja!"
