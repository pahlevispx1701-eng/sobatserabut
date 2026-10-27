#!/bin/bash
PROJECT_DIR="/home/jinny21/SobatSerabut"
cd "$PROJECT_DIR" || exit 1
mkdir -p "$PROJECT_DIR/logs"

# 1. Kill any stale processes
pkill -f "node app.js" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
sleep 1

# 2. Start Node server in background
node app.js > "$PROJECT_DIR/logs/server.log" 2>&1 &
NODE_PID=$!

# Wait for server port 4000
for i in {1..10}; do
  if lsof -ti:4000 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 3. Start Cloudflare Tunnel
rm -f "$PROJECT_DIR/logs/tunnel.log"
if [ -f "$HOME/.cloudflared/config.yml" ]; then
    mv "$HOME/.cloudflared/config.yml" "$HOME/.cloudflared/config.yml.disabled" 2>/dev/null || true
fi

cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4000 --logfile "$PROJECT_DIR/logs/tunnel.log" > /dev/null 2>&1 &
CF_PID=$!

# 4. Wait for public URL
PUBLIC_URL=""
for i in {1..20}; do
    PUBLIC_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "$PROJECT_DIR/logs/tunnel.log" 2>/dev/null | tail -n 1)
    if [ -n "$PUBLIC_URL" ]; then
        break
    fi
    sleep 1
done

if [ -n "$PUBLIC_URL" ]; then
    echo "$PUBLIC_URL" > "$PROJECT_DIR/logs/public_url.txt"
    echo "========================================================"
    echo "✅ SOBATSERABUT ONLINE: $PUBLIC_URL"
    echo "========================================================"
    
    # Update config.js
    cat <<EOF > "$PROJECT_DIR/mitra-app/js/config.js"
window.SOBATSERABUT_CONFIG = {
  DEFAULT_API_URL: "$PUBLIC_URL",
  VERSION: "1.0.0",
  BUILD_DATE: "$(date '+%Y-%m-%d %H:%M:%S')"
};
EOF
    cp "$PROJECT_DIR/mitra-app/js/config.js" "$PROJECT_DIR/android-app/app/src/main/assets/www/js/config.js"

    # Build production APK
    echo "-> Compiling production APK with active URL..."
    bash "$PROJECT_DIR/android-app/build_apk.sh" > /dev/null 2>&1 || true
    echo "✅ APK ready at: $PUBLIC_URL/download/apk"
fi

# 5. Keep running indefinitely
wait $NODE_PID $CF_PID
