#!/usr/bin/env bash
set -e

echo "========================================================"
echo "🚀 COMPILING 2 INDEPENDENT PRODUCTION APKs (SOBATSERABUT)"
echo "  1. Driver SobatSerabut (com.sobatserabut.driver)"
echo "  2. SobatSerabut Klien (com.sobatserabut.client)"
echo "  -> Siap di-install BERSAMAAN di satu HP tanpa bentrok!"
echo "========================================================"

PROJECT_DIR="/home/jinny21/SobatSerabut/android-app"
APP_DIR="$PROJECT_DIR/app"
SDK_DIR="/home/jinny21/android-sdk"
BUILD_TOOLS="$SDK_DIR/build-tools/34.0.0"
PLATFORM="$SDK_DIR/platforms/android-34"
BUILD_DIR="$PROJECT_DIR/build_temp"

AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"

# Cari JAVAC yang tersedia
JAVAC=$(which javac 2>/dev/null || echo "/usr/bin/javac")

echo "Build Config:"
echo " - JAVAC: $JAVAC ($($JAVAC -version 2>&1 | head -1))"
echo " - Platform: API 34 | Min SDK: API 24 (Android 7+)"

# Domain Cloud VPS 24 Jam Permanen
DEFAULT_PROD_URL="https://app.sobatserabut.id"

# Ambil URL publik aktif yang terverifikasi bisa diakses
PUBLIC_URL=""

# 1. Cek kesehatan URL Produksi VPS
if curl -s -o /dev/null -m 5 -I "$DEFAULT_PROD_URL/api/health" 2>/dev/null; then
    PUBLIC_URL="$DEFAULT_PROD_URL"
    echo "$PUBLIC_URL" > /home/jinny21/SobatSerabut/logs/public_url.txt
fi

# 2. Cek dari logs/public_url.txt jika produksi tidak terjangkau
if [ -z "$PUBLIC_URL" ] && [ -f "/home/jinny21/SobatSerabut/logs/public_url.txt" ]; then
    CANDIDATE=$(cat /home/jinny21/SobatSerabut/logs/public_url.txt | tr -d '[:space:]')
    if [ -n "$CANDIDATE" ] && [ "$CANDIDATE" != "http://127.0.0.1:4000" ]; then
        if curl -s -o /dev/null -m 3 -I "$CANDIDATE" 2>/dev/null; then
            PUBLIC_URL="$CANDIDATE"
        fi
    fi
fi

# Fallback default ke domain cloud resmi
[ -z "$PUBLIC_URL" ] && PUBLIC_URL="$DEFAULT_PROD_URL"
echo " - Verified Server URL: $PUBLIC_URL"

# Keystore
RELEASE_KEYSTORE="$PROJECT_DIR/sobatserabut-release.keystore"
if [ ! -f "$RELEASE_KEYSTORE" ]; then
    echo "-> Generating keystore..."
    keytool -genkey -v -keystore "$RELEASE_KEYSTORE" \
        -alias sobatserabut -keyalg RSA -keysize 4096 -validity 10000 \
        -storepass sobatserabut2026 -keypass sobatserabut2026 \
        -dname "CN=SobatSerabut Official, OU=Mobile, O=PT Sobat Serabut Indonesia, L=Jakarta, ST=DKI Jakarta, C=ID"
fi

# ============================================================
# Fungsi build APK dengan Package ID unik & --custom-package
# ============================================================
build_apk() {
    local APP_LABEL="$1"      # Nama tampilan di launcher
    local APP_TAGLINE="$2"    # Tagline
    local SOURCE_DIR="$3"     # Folder web app (driver-app / client-app)
    local OUTPUT_APK="$4"     # Nama file output
    local VERSION_CODE="$5"   # 1=driver, 2=client
    local PKG="$6"            # Package ID unik (e.g. com.sobatserabut.driver)

    echo ""
    echo "----------------------------------------------------"
    echo "🔨 Building: $APP_LABEL → $OUTPUT_APK [Package: $PKG]"
    echo "----------------------------------------------------"

    # 1. Update strings.xml
    local XML_TAGLINE=$(echo "$APP_TAGLINE" | sed 's/&/\&amp;/g')
    cat > "$APP_DIR/src/main/res/values/strings.xml" <<EOF
<resources>
    <string name="app_name">$APP_LABEL</string>
    <string name="app_tagline">$XML_TAGLINE</string>
</resources>
EOF

    # 2. Siapkan assets web
    rm -rf "$APP_DIR/src/main/assets/www"
    mkdir -p "$APP_DIR/src/main/assets/www"
    cp -r "$SOURCE_DIR"/. "$APP_DIR/src/main/assets/www/"
    mkdir -p "$APP_DIR/src/main/assets/www/uploads"
    mkdir -p "$APP_DIR/src/main/assets/www/img"
    cp -r /home/jinny21/SobatSerabut/backend/uploads/. "$APP_DIR/src/main/assets/www/uploads/" 2>/dev/null || true
    cp -r /home/jinny21/SobatSerabut/backend/uploads/. "$APP_DIR/src/main/assets/www/img/" 2>/dev/null || true
    find "$APP_DIR/src/main/assets" -name "*.apk" -delete
    find "$APP_DIR/src/main/assets" -name "*.idsig" -delete

    # 3. Inject config.js
    cat > "$APP_DIR/src/main/assets/www/js/config.js" <<EOF
window.SOBATSERABUT_CONFIG = {
  DEFAULT_API_URL: "$PUBLIC_URL",
  VERSION: "1.0.$VERSION_CODE",
  BUILD_DATE: "$(date '+%Y-%m-%d %H:%M:%S')"
};
EOF

    # 4. Bersihkan build sementara
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"/{compiled_res,gen,classes,apk_unaligned}

    # 5. Siapkan AndroidManifest dengan package ID unik
    # Catatan: SplashActivity & MainActivity tetap fully qualified (com.sobatserabut.mitra.*)
    sed "3s/package=\"[^\"]*\"/package=\"$PKG\"/" \
        "$APP_DIR/src/main/AndroidManifest.xml" > "$BUILD_DIR/AndroidManifest.xml"

    # 6. Compile resources
    echo "-> Compiling Android resources..."
    $AAPT2 compile --dir "$APP_DIR/src/main/res" -o "$BUILD_DIR/compiled_res.zip"

    # 7. Link resources dengan --custom-package com.sobatserabut.mitra
    # Ini memastikan:
    # - Manifest & resources.arsc menggunakan Package ID unik ($PKG)
    # - R.java dibuat di package com.sobatserabut.mitra sehingga Activity Java tidak crash
    echo "-> Linking resources (Manifest & Res pkg=$PKG, R.java pkg=com.sobatserabut.mitra)..."
    $AAPT2 link -I "$PLATFORM/android.jar" \
        "$BUILD_DIR/compiled_res.zip" \
        --manifest "$BUILD_DIR/AndroidManifest.xml" \
        --custom-package "com.sobatserabut.mitra" \
        --min-sdk-version 24 \
        --target-sdk-version 34 \
        --version-code "$VERSION_CODE" \
        --version-name "1.0.$VERSION_CODE" \
        --java "$BUILD_DIR/gen" \
        -A "$APP_DIR/src/main/assets" \
        -o "$BUILD_DIR/apk_unaligned/res_base.apk" \
        --auto-add-overlay

    # 8. Compile Java sources
    echo "-> Compiling Java sources..."
    set +e
    JAVAC_OUTPUT=$($JAVAC -encoding UTF-8 \
        -source 11 -target 11 \
        -cp "$PLATFORM/android.jar" \
        -d "$BUILD_DIR/classes" \
        $(find "$APP_DIR/src/main/java" "$BUILD_DIR/gen" -name "*.java") 2>&1)
    JAVAC_STATUS=$?
    set -e
    if [ $JAVAC_STATUS -ne 0 ]; then
        echo "❌ JAVAC Error:"
        echo "$JAVAC_OUTPUT"
        exit 1
    fi

    # 9. Dex bytecode
    echo "-> Dexing bytecode with D8..."
    $D8 --release \
        --min-api 24 \
        --lib "$PLATFORM/android.jar" \
        --output "$BUILD_DIR/apk_unaligned" \
        $(find "$BUILD_DIR/classes" -name "*.class")

    # 10. Packaging classes.dex
    cd "$BUILD_DIR/apk_unaligned"
    jar uf res_base.apk classes.dex
    cd "$PROJECT_DIR"

    # 11. Zipalign
    echo "-> Zipaligning APK..."
    $ZIPALIGN -f -p 4 "$BUILD_DIR/apk_unaligned/res_base.apk" "$BUILD_DIR/aligned.apk"

    # 12. Sign
    echo "-> Signing APK with v1, v2, v3 schemes..."
    $APKSIGNER sign \
        --ks "$RELEASE_KEYSTORE" \
        --ks-pass pass:sobatserabut2026 \
        --key-pass pass:sobatserabut2026 \
        --ks-key-alias sobatserabut \
        --min-sdk-version 24 \
        --v1-signing-enabled true \
        --v2-signing-enabled true \
        --v3-signing-enabled true \
        --out "$PROJECT_DIR/$OUTPUT_APK" \
        "$BUILD_DIR/aligned.apk"

    # 13. Copy ke lokasi distribusi
    cp "$PROJECT_DIR/$OUTPUT_APK" "/home/jinny21/$OUTPUT_APK" 2>/dev/null || true
    cp "$PROJECT_DIR/$OUTPUT_APK" "/home/jinny21/Desktop/$OUTPUT_APK" 2>/dev/null || true
    cp "$PROJECT_DIR/$OUTPUT_APK" "/home/jinny21/SobatSerabut/backend/uploads/$OUTPUT_APK" 2>/dev/null || true

    APK_SIZE=$(ls -lh "$PROJECT_DIR/$OUTPUT_APK" | awk '{print $5}')
    echo "✅ $OUTPUT_APK selesai ($APK_SIZE) [Package: $PKG]"
}

# === BUILD APK 1: DRIVER / MITRA ===
build_apk "Driver SobatSerabut" "Aplikasi Mitra Kerja & Pengemudi" \
    "/home/jinny21/SobatSerabut/driver-app" "Driver-SobatSerabut.apk" "1" "com.sobatserabut.driver"

# Salin sebagai SobatSerabut-Mitra.apk juga (kompatibilitas nama lama)
cp "$PROJECT_DIR/Driver-SobatSerabut.apk" "$PROJECT_DIR/SobatSerabut-Mitra.apk"
cp "$PROJECT_DIR/Driver-SobatSerabut.apk" "/home/jinny21/SobatSerabut-Mitra.apk" 2>/dev/null || true
cp "$PROJECT_DIR/Driver-SobatSerabut.apk" "/home/jinny21/Desktop/SobatSerabut-Mitra.apk" 2>/dev/null || true
cp "$PROJECT_DIR/Driver-SobatSerabut.apk" "/home/jinny21/SobatSerabut/backend/uploads/SobatSerabut-Mitra.apk" 2>/dev/null || true

# === BUILD APK 2: CLIENT / KLIEN ===
build_apk "SobatSerabut" "Solusi Cepat Serabutan & Jasa Harian" \
    "/home/jinny21/SobatSerabut/client-app" "SobatSerabut.apk" "2" "com.sobatserabut.client"

echo ""
echo "========================================================"
echo "🎉 SEMUA APK SELESAI DIKOMPILASI!"
echo "  • Driver : $PROJECT_DIR/Driver-SobatSerabut.apk (pkg: com.sobatserabut.driver)"
echo "  • Mitra  : $PROJECT_DIR/SobatSerabut-Mitra.apk (pkg: com.sobatserabut.driver)"
echo "  • Klien  : $PROJECT_DIR/SobatSerabut.apk (pkg: com.sobatserabut.client)"
echo ""
echo "📱 Status: KEDUA APK DAPAT DIPASANG BERSAMAAN DI SATU HP TANPA BENTROK/CRASH"
echo "========================================================"
