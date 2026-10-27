const axios = require('axios');
const twilio = require('twilio');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./database');

// Default Bot OTP Identity
const DEFAULT_OTP_NUMBER = '087791201091';

function getOtpSenderNumber() {
  const cfg = (db && typeof db.get === 'function') ? (db.get('config') || {}) : {};
  return cfg.otpSenderNumber || process.env.OTP_SENDER_NUMBER || DEFAULT_OTP_NUMBER;
}

function getFonnteToken() {
  const cfg = (db && typeof db.get === 'function') ? (db.get('config') || {}) : {};
  return cfg.fonnteToken || process.env.FONNTE_TOKEN || '8H6JfKCSA2ov9ZEi6GTd';
}

function getOtpBootMessage(otpCode) {
  const senderNumber = getOtpSenderNumber();

  return `🤖 [BOT RESMI SOBATSERABUT - ${senderNumber}]\n\n` +
         `KODE VERIFIKASI OTP ANDA: *${otpCode}*\n\n` +
         `⚠️ PERINGATAN RESMI:\n` +
         `"jangan berikan kode otp ini kepada siapapun"\n\n` +
         `Kode rahasia ini bersifat pribadi untuk keamanan akun Anda dan berlaku selama 5 menit. Petugas SobatSerabut tidak pernah meminta kode ini.`;
}

// Inisialisasi Twilio Client jika kredensial tersedia
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn('Inisialisasi Twilio gagal:', err.message);
  }
}

/**
 * Mengirim OTP Nyata via WhatsApp Gateway Fonnte
 * Nomor Pengirim Resmi Bot: 087791201091
 * Format Boot: "jangan berikan kode otp ini kepada siapapun"
 */
async function sendOtpWhatsApp(targetNumber, otpCode) {
  const senderNumber = getOtpSenderNumber();
  const token = getFonnteToken();
  const message = getOtpBootMessage(otpCode);

  let clean = (targetNumber || '').toString().replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }

  console.log(`====================================================`);
  console.log(`🤖 [BOT WHATSAPP FONNTE DISPATCH]`);
  console.log(`📱 Nomor Bot Pengirim: ${senderNumber}`);
  console.log(`🎯 Nomor Tujuan: ${clean} (HP Penerima)`);
  console.log(`🔑 Kode OTP: ${otpCode}`);
  console.log(`💬 Format Boot: "jangan berikan kode otp ini kepada siapapun"`);
  console.log(`====================================================`);

  try {
    const response = await axios.post('https://api.fonnte.com/send', {
      target: clean,
      message: message,
      countryCode: '0'
    }, {
      headers: {
        'Authorization': token
      },
      timeout: 10000
    });

    if (response.data && response.data.status === false) {
      console.warn(`⚠️ Fonnte Gateway menolak pengiriman (${senderNumber}):`, response.data);
      return { 
        success: false, 
        error: response.data.reason || 'Token Fonnte tidak valid atau perangkat WhatsApp belum terhubung', 
        sender: senderNumber, 
        phone: clean, 
        method: 'whatsapp',
        data: response.data,
        messagePreview: message 
      };
    }

    console.log(`📱 WhatsApp OTP sukses dikirim ke ${clean} via Bot ${senderNumber}:`, response.data);
    return { 
      success: true, 
      data: response.data, 
      phone: clean, 
      sender: senderNumber, 
      method: 'whatsapp',
      messagePreview: message 
    };
  } catch (error) {
    const errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error(`❌ Gagal mengirim WhatsApp OTP ke ${targetNumber} via Fonnte (${senderNumber}):`, errMsg);
    return { 
      success: false, 
      error: errMsg, 
      sender: senderNumber, 
      phone: clean, 
      method: 'whatsapp',
      messagePreview: message 
    };
  }
}

/**
 * Mengirim OTP via SMS dengan fallback otomatis ke WhatsApp Fonnte Bot 087791201091
 */
async function sendOtpSMS(targetNumber, otpCode) {
  const senderNumber = getOtpSenderNumber();
  let clean = (targetNumber || '').toString().replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  const formattedE164 = '+' + clean;

  const smsBody = `[BOT SOBATSERABUT - ${senderNumber}]\n` +
                  `KODE OTP: ${otpCode}\n` +
                  `"jangan berikan kode otp ini kepada siapapun"\n` +
                  `Kode berlaku 5 menit.`;

  // 1. Coba kirim via Twilio SMS jika terkonfigurasi
  if (twilioClient && (process.env.TWILIO_PHONE_NUMBER || senderNumber)) {
    try {
      let fromNumber = (process.env.TWILIO_PHONE_NUMBER || senderNumber).trim();
      if (!fromNumber.startsWith('+')) {
        if (fromNumber.startsWith('0')) fromNumber = '+62' + fromNumber.slice(1);
        else fromNumber = '+' + fromNumber;
      }

      const message = await twilioClient.messages.create({
        body: smsBody,
        from: fromNumber,
        to: formattedE164
      });

      console.log(`💬 SMS OTP sukses dikirim ke ${formattedE164} dari ${fromNumber}, SID: ${message.sid}`);
      return { success: true, sid: message.sid, method: 'sms', sender: senderNumber };
    } catch (error) {
      console.warn(`⚠️ SMS Gateway Twilio terkendala (${error.message}). Mengalihkan ke Bot WhatsApp Fonnte ${senderNumber}...`);
    }
  }

  // 2. Fallback Otomatis ke WhatsApp Gateway (Fonnte Bot 087791201091)
  try {
    const token = getFonnteToken();
    const waMessage = getOtpBootMessage(otpCode);

    const response = await axios.post('https://api.fonnte.com/send', {
      target: clean,
      message: waMessage,
      countryCode: '0'
    }, {
      headers: {
        'Authorization': token
      },
      timeout: 10000
    });

    if (response.data && response.data.status === false) {
      console.warn(`⚠️ Fonnte WhatsApp Fallback ditolak (${senderNumber}):`, response.data);
      return { success: false, error: response.data.reason || 'Token Fonnte tidak valid', sender: senderNumber, phone: clean };
    }

    console.log(`📱 [FALLBACK] OTP sukses dikirim via WhatsApp Bot ${senderNumber} ke ${clean}:`, response.data);
    return { success: true, fallback: true, method: 'whatsapp', data: response.data, sender: senderNumber };
  } catch (fallbackError) {
    const errMsg = fallbackError.response ? JSON.stringify(fallbackError.response.data) : fallbackError.message;
    console.error(`❌ Gagal mengirimkan fallback OTP ke WhatsApp Bot ${senderNumber} (${clean}):`, errMsg);
    return { success: false, error: errMsg, sender: senderNumber, phone: clean };
  }
}

/**
 * Memeriksa status koneksi Fonnte
 */
async function testFonnteDeviceStatus(customToken) {
  const token = customToken || getFonnteToken();
  try {
    const response = await axios.post('https://api.fonnte.com/device', {}, {
      headers: { 'Authorization': token },
      timeout: 8000
    });
    return { success: true, data: response.data };
  } catch (err) {
    const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    return { success: false, error: errMsg };
  }
}

module.exports = { 
  sendOtpWhatsApp, 
  sendOtpSMS, 
  getOtpSenderNumber, 
  getFonnteToken, 
  getOtpBootMessage,
  testFonnteDeviceStatus 
};
