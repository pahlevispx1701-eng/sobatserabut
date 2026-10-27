#!/usr/bin/env bash
# ============================================================
# SobatSerabut - Stop Backend Server & Tunnels
# ============================================================

echo "========================================================"
echo "🛑 MENGHENTIKAN EKOSISTEM SOBATSERABUT..."
echo "========================================================"

command -v pm2 >/dev/null 2>&1 && pm2 delete sobat-backend sobat-tunnel 2>/dev/null || true
PID=$(lsof -ti:4000 2>/dev/null || true)
if [ -n "$PID" ]; then
    echo "-> Menghentikan server Node.js pada port 4000 (PID: $PID)..."
    kill -9 $PID 2>/dev/null || true
    echo "   ✅ Server berhasil dihentikan."
else
    echo "ℹ️  Tidak ada server yang sedang berjalan pada port 4000."
fi

pkill cloudflared 2>/dev/null || true
pkill ngrok 2>/dev/null || true
echo "   ✅ Semua tunnel publik (Cloudflare/Ngrok) telah dimatikan."
echo "========================================================"
