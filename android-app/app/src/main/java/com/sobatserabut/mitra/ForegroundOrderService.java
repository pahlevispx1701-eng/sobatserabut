package com.sobatserabut.mitra;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import java.util.Locale;

/**
 * Foreground Service SobatSerabut
 * Memastikan aplikasi tetap siaga berjalan di latar belakang (background)
 * sehingga meskipun aplikasi diminimalkan / dikeluarkan, notifikasi dan suara orderan tetap berbunyi!
 */
public class ForegroundOrderService extends Service {

    public static final String ACTION_START = "com.sobatserabut.mitra.START_FOREGROUND";
    public static final String ACTION_STOP = "com.sobatserabut.mitra.STOP_FOREGROUND";
    public static final String ACTION_PLAY_ORDER_SOUND = "com.sobatserabut.mitra.PLAY_ORDER_SOUND";
    public static final String EXTRA_SOUND_TEXT = "sound_text";

    public static final String CHANNEL_ID = "sobatserabut_background_service";
    public static final int NOTIF_ID = 9001;

    private PowerManager.WakeLock wakeLock;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        initWakeLock();
        initTts();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Layanan Siaga Order SobatSerabut",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Menjaga koneksi tetap aktif di latar belakang untuk menerima pesanan");
                channel.setShowBadge(false);
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.createNotificationChannel(channel);
                }
            } catch (Throwable t) {
                t.printStackTrace();
            }
        }
    }

    private void initWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SobatSerabut:OrderKeepAliveLock");
                wakeLock.setReferenceCounted(false);
            }
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }

    private void initTts() {
        try {
            tts = new TextToSpeech(getApplicationContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    try {
                        Locale indo = new Locale("id", "ID");
                        int result = tts.setLanguage(indo);
                        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                            tts.setLanguage(Locale.getDefault());
                        }
                        ttsReady = true;
                    } catch (Throwable ex) {
                        ttsReady = false;
                    }
                }
            });
        } catch (Throwable t) {
            ttsReady = false;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                stopForegroundService();
                return START_NOT_STICKY;
            } else if (ACTION_PLAY_ORDER_SOUND.equals(action)) {
                String text = intent.getStringExtra(EXTRA_SOUND_TEXT);
                playOrderAlert(text);
                return START_STICKY;
            }
        }

        startForegroundWithNotification();

        if (wakeLock != null && !wakeLock.isHeld()) {
            try {
                wakeLock.acquire(10 * 60 * 1000L); // 10 menit keepalive per trigger
            } catch (Throwable t) {}
        }

        return START_STICKY;
    }

    private void startForegroundWithNotification() {
        try {
            Intent mainIntent = new Intent(this, MainActivity.class);
            mainIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getActivity(this, 0, mainIntent, pendingFlags);

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }

            builder.setContentTitle("SobatSerabut Siaga 24 Jam")
                   .setContentText("Aplikasi aktif di latar belakang — siap menerima orderan")
                   .setSmallIcon(R.mipmap.ic_launcher)
                   .setContentIntent(pi)
                   .setOngoing(true);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                builder.setVisibility(Notification.VISIBILITY_PUBLIC);
            }

            Notification notification = builder.build();
            startForeground(NOTIF_ID, notification);
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }

    public void playOrderAlert(String message) {
        try {
            // 1. Getar HP
            Vibrator vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null) {
                long[] pattern = {0, 400, 200, 400, 200, 600};
                vibrator.vibrate(pattern, -1);
            }

            // 2. Bunyi Nada Dering (Ringtone Kringgg HP Asli)
            Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (alertUri == null) {
                alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (alertUri != null) {
                Ringtone r = RingtoneManager.getRingtone(getApplicationContext(), alertUri);
                if (r != null) {
                    r.play();
                }
            }

            // 3. Suara TTS lantang: "ADA ORDERAN MASUK"
            final String voiceText = (message != null && !message.isEmpty()) ? message : "ADA ORDERAN MASUK";
            if (ttsReady && tts != null) {
                try {
                    tts.setPitch(1.25f); // Nada wanita
                    tts.setSpeechRate(1.0f); // Kecepatan normal
                } catch (Throwable t) {}
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    tts.speak(voiceText, TextToSpeech.QUEUE_FLUSH, null, "ORDER_TTS_ID");
                } else {
                    tts.speak(voiceText, TextToSpeech.QUEUE_FLUSH, null);
                }
            }
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }

    private void stopForegroundService() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            stopForeground(true);
            stopSelf();
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            if (tts != null) {
                tts.stop();
                tts.shutdown();
            }
        } catch (Throwable t) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
