#!/bin/bash
LOG="/home/jinny21/SobatSerabut/logs/tunnel.log"
CF="/home/jinny21/.local/bin/cloudflared"
URL_FILE="/home/jinny21/SobatSerabut/logs/public_url.txt"
PID_FILE="/home/jinny21/SobatSerabut/logs/cloudflared.pid"

echo "🚀 Memulai Cloudflare Quick Tunnel (HTTP/2)..."

while true; do
    # Bersihkan log lama
    > "$LOG"

    # Jalankan cloudflared
    $CF tunnel --no-autoupdate --protocol http2 --url http://localhost:4000 >> "$LOG" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    echo "🔗 cloudflared PID: $PID"

    # Tunggu URL muncul di log (maks 30 detik)
    URL=""
    for i in $(seq 1 30); do
        sleep 1
        URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$LOG" 2>/dev/null | tail -n 1)
        if [ -n "$URL" ]; then
            echo "📡 URL ditemukan: $URL (detik ke-$i)"
            break
        fi
    done

    if [ -z "$URL" ]; then
        echo "❌ URL tidak muncul dalam 30 detik, restart..."
        kill $PID 2>/dev/null
        sleep 5
        continue
    fi

    # Tunggu propagasi DNS Cloudflare Edge (paling lambat ~15 detik setelah URL muncul)
    echo "⏳ Menunggu propagasi DNS Cloudflare (maks 30 detik)..."
    HTTP_CODE="000"
    for i in $(seq 1 30); do
        sleep 2
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 --connect-timeout 8 "$URL" 2>/dev/null)
        echo "   [${i}] HTTP $HTTP_CODE"
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "301" ]; then
            echo "$URL" > "$URL_FILE"
            echo ""
            echo "✅ TUNNEL AKTIF (HTTP $HTTP_CODE): $URL"
            echo "📦 Download APK: $URL/download/apk"
            break
        fi
    done

    if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "302" ] && [ "$HTTP_CODE" != "301" ]; then
        echo "⚠️  Tunnel tidak bisa diakses (HTTP $HTTP_CODE), URL tetap disimpan: $URL"
        echo "$URL" > "$URL_FILE"
    fi

    # Tunggu sampai cloudflared mati sendiri
    wait $PID
    echo ""
    echo "⚠️  Tunnel mati (PID $PID), restart dalam 5 detik..."
    sleep 5
done
