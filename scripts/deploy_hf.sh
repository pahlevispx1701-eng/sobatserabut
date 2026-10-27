#!/bin/bash
# ==============================================================================
# SOBATSERABUT - AUTO DEPLOY KE HUGGING FACE SPACES (24/7 ONLINE GRATIS)
# ==============================================================================

set -e

PROJECT_DIR="/home/jinny21/SobatSerabut"
cd "$PROJECT_DIR"

echo "===================================================="
echo "🚀 OTOMASI DEPLOY SOBATSERABUT KE CLOUD 24 JAM"
echo "===================================================="
echo ""

HF_USERNAME="$1"
HF_TOKEN="$2"

if [ -z "$HF_USERNAME" ]; then
    read -p "Masukkan Username Hugging Face Anda: " HF_USERNAME
fi

if [ -z "$HF_TOKEN" ]; then
    echo "Dapatkan token di: https://huggingface.co/settings/tokens (pilih role 'Write')"
    read -sp "Masukkan Access Token Hugging Face Anda: " HF_TOKEN
    echo ""
fi

if [ -z "$HF_USERNAME" ] || [ -z "$HF_TOKEN" ]; then
    echo "❌ Error: Username dan Token Hugging Face wajib diisi!"
    exit 1
fi

SPACE_NAME="sobatserabut"
echo ""
echo "📦 1. Mendaftarkan Space '$SPACE_NAME' di Hugging Face via API..."

CREATE_RESP=$(curl -s -w "\n%{http_code}" -X POST "https://huggingface.co/api/repos/create" \
    -H "Authorization: Bearer $HF_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$SPACE_NAME\", \"type\": \"space\", \"sdk\": \"docker\", \"private\": false}")

HTTP_STATUS=$(echo "$CREATE_RESP" | tail -n1)
RESP_BODY=$(echo "$CREATE_RESP" | sed '$d')

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo "✅ Space baru berhasil dibuat di Hugging Face!"
elif echo "$RESP_BODY" | grep -qi "already exists"; then
    echo "ℹ️ Space '$SPACE_NAME' sudah ada sebelumnya, melanjutkan proses update..."
else
    echo "⚠️ Respon API ($HTTP_STATUS): $RESP_BODY"
    echo "Melanjutkan proses push git..."
fi

HF_REMOTE_URL="https://${HF_USERNAME}:${HF_TOKEN}@huggingface.co/spaces/${HF_USERNAME}/${SPACE_NAME}"

echo ""
echo "📤 2. Menyiapkan Git Remote & Mengunggah File ke Hugging Face..."
git remote remove hf 2>/dev/null || true
git remote add hf "$HF_REMOTE_URL"

git add -A
git commit -m "Auto deploy SobatSerabut ke Hugging Face Spaces 24/7" 2>/dev/null || true

echo "🚀 Mengunggah kode..."
git push -u hf main --force

PUBLIC_URL="https://${HF_USERNAME}-${SPACE_NAME}.hf.space"

echo ""
echo "===================================================="
echo "🎉 DEPLOY BERHASIL! APLIKASI AKTIF 24 JAM ONLINE"
echo "===================================================="
echo "🌐 Link Publik Utama: $PUBLIC_URL"
echo "📱 Portal Download APK: $PUBLIC_URL/portal"
echo "🛵 Web Driver / Mitra: $PUBLIC_URL/driver"
echo "👤 Web Klien Pemohon: $PUBLIC_URL/client"
echo "⚙️ Admin Dashboard: $PUBLIC_URL/admin"
echo "===================================================="
echo "Sekarang laptop Anda bisa dimatikan, dan SobatSerabut tetap bisa diakses kapan saja!"
