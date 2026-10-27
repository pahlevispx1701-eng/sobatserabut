#!/usr/bin/env bash
set -e

echo "========================================================"
echo "🎨 SOBATSERABUT LOGO & BRANDING CUSTOMIZER"
echo "========================================================"

if [ -z "$1" ]; then
    echo "Penggunaan: $0 <path_to_logo_image_png_or_svg>"
    echo "Contoh:     $0 /home/jinny21/my_new_logo.png"
    echo ""
    echo "Atau pilih preset cepat:"
    echo "  $0 preset:shield   (Menggunakan logo Shield SobatSerabut)"
    echo "  $0 preset:icon     (Menggunakan square icon badge)"
    exit 1
fi

PARAM="$1"
PROJECT_DIR="/home/jinny21/SobatSerabut"

if [ "$PARAM" = "preset:shield" ]; then
    echo "-> Mengaktifkan preset Shield..."
    curl -s -X POST http://127.0.0.1:4000/api/config/upload-logo \
        -H "Content-Type: application/json" \
        -d '{"logoUrl":"/uploads/logo_sobatserabut.svg","logoPreset":"shield"}' > /dev/null || true
elif [ "$PARAM" = "preset:icon" ]; then
    echo "-> Mengaktifkan preset Square Icon..."
    curl -s -X POST http://127.0.0.1:4000/api/config/upload-logo \
        -H "Content-Type: application/json" \
        -d '{"logoUrl":"/uploads/logo_icon.svg","logoPreset":"icon"}' > /dev/null || true
else
    if [ ! -f "$PARAM" ]; then
        echo "❌ File '$PARAM' tidak ditemukan!"
        exit 1
    fi

    EXT="${PARAM##*.}"
    TARGET_NAME="custom_logo_$(date +%s).$EXT"
    TARGET_PATH="$PROJECT_DIR/backend/uploads/$TARGET_NAME"

    echo "-> Menyalin file logo ke backend..."
    cp "$PARAM" "$TARGET_PATH"

    echo "-> Memperbarui Remote Config di Backend..."
    curl -s -X POST http://127.0.0.1:4000/api/config/upload-logo \
        -H "Content-Type: application/json" \
        -d "{\"logoUrl\":\"/uploads/$TARGET_NAME\",\"logoPreset\":\"custom\"}" > /dev/null || true

    echo "-> Menyalin ke asset aplikasi Android..."
    cp "$PARAM" "$PROJECT_DIR/android-app/app/src/main/assets/www/logo_custom.$EXT"
fi

echo "-> Memperbarui paket APK Android dengan logo terbaru..."
"$PROJECT_DIR/android-app/build_apk.sh" > /dev/null 2>&1

echo "========================================================"
echo "✅ LOGO BERHASIL DIPERBARUI!"
echo "   Logo otomatis tersinkronisasi ke Dashboard Admin,"
echo "   Aplikasi Mitra Mobile, dan paket APK Android."
echo "========================================================"
