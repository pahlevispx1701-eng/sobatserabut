package com.sobatserabut.mitra;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

/**
 * JavaScript Bridge — bisa dipanggil dari JS via window.Android.*
 * Didaftarkan di MainActivity: webView.addJavascriptInterface(new AndroidBridge(activity), "Android")
 */
public class AndroidBridge {

    private final Activity activity;
    private static int notificationId = 2000;
    public static final String CHANNEL_ID = "sobatserabut_notifications";

    public AndroidBridge(Activity activity) {
        this.activity = activity;
    }

    /** Buka langsung halaman Pengaturan → Notifikasi aplikasi ini di sistem Android */
    @JavascriptInterface
    public void openNotificationSettings() {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Android 8+ (API 26+) → langsung ke pengaturan notifikasi aplikasi ini
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName());
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                // Android 5–7 (API 21–25) → ke detail notifikasi app
                intent = new Intent("android.settings.APP_NOTIFICATION_SETTINGS");
                intent.putExtra("app_package", activity.getPackageName());
                intent.putExtra("app_uid", activity.getApplicationInfo().uid);
            } else {
                // Android < 5 → ke halaman detail aplikasi umum
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + activity.getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + activity.getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(fallback);
            } catch (Exception ex) {
                Toast.makeText(activity,
                    "Buka: Pengaturan \u2192 Aplikasi \u2192 Notifikasi untuk mengaktifkan",
                    Toast.LENGTH_LONG).show();
            }
        }
    }

    /** Minta izin notifikasi langsung (Android 13+) atau buka pengaturan HP */
    @JavascriptInterface
    public void requestNotificationPermission() {
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                if (activity.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    activity.requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 2002);
                    return;
                }
            }
            if (!isNotificationEnabled()) {
                openNotificationSettings();
            } else {
                Toast.makeText(activity, "Izin notifikasi aktif di pengaturan HP", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            openNotificationSettings();
        }
    }

    /** Cek apakah notifikasi sudah diizinkan di pengaturan HP */
    @JavascriptInterface
    public boolean isNotificationEnabled() {
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                if (activity.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    return false;
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager nm =
                    (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
                return nm != null && nm.areNotificationsEnabled();
            }
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    /** Kirim dan munculkan notifikasi sistem di status bar HP langsung */
    @JavascriptInterface
    public void showNotification(String title, String message) {
        try {
            NotificationManager nm =
                (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Notifikasi SobatSerabut",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notifikasi pesanan, obrolan, dan informasi tugas");
                channel.enableVibration(true);
                channel.enableLights(true);
                nm.createNotificationChannel(channel);
            }

            Intent intent = new Intent(activity, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(activity, 0, intent, flags);

            android.app.Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new android.app.Notification.Builder(activity, CHANNEL_ID);
            } else {
                builder = new android.app.Notification.Builder(activity);
            }

            builder.setContentTitle(title)
                   .setContentText(message)
                   .setSmallIcon(R.mipmap.ic_launcher)
                   .setAutoCancel(true)
                   .setContentIntent(pendingIntent);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                builder.setPriority(android.app.Notification.PRIORITY_HIGH);
            }

            nm.notify(notificationId++, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /** Ambil nama package unik APK */
    @JavascriptInterface
    public String getPackageName() {
        return activity.getPackageName();
    }

    /** Buka langsung pengaturan lokasi HP */
    @JavascriptInterface
    public void openLocationSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(activity, "Buka Pengaturan HP \u2192 Lokasi", Toast.LENGTH_SHORT).show();
        }
    }

    /** Tampilkan Toast dari JavaScript */
    @JavascriptInterface
    public void showToast(String message) {
        try {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
        } catch (Exception e) { /* abaikan */ }
    }

    /** Jalankan Foreground Service agar tetap aktif di latar belakang */
    @JavascriptInterface
    public void startBackgroundService() {
        try {
            Intent intent = new Intent(activity, ForegroundOrderService.class);
            intent.setAction(ForegroundOrderService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(intent);
            } else {
                activity.startService(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /** Hentikan Foreground Service */
    @JavascriptInterface
    public void stopBackgroundService() {
        try {
            Intent intent = new Intent(activity, ForegroundOrderService.class);
            intent.setAction(ForegroundOrderService.ACTION_STOP);
            activity.startService(intent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /** Bunyikan notifikasi order masuk: ringtone + getar + suara 'Kring.. ada orderan masuk ni!' */
    @JavascriptInterface
    public void playOrderAlertSound(String voiceText) {
        try {
            Intent intent = new Intent(activity, ForegroundOrderService.class);
            intent.setAction(ForegroundOrderService.ACTION_PLAY_ORDER_SOUND);
            intent.putExtra(ForegroundOrderService.EXTRA_SOUND_TEXT,
                (voiceText != null && !voiceText.isEmpty()) ? voiceText : "Kring.. ada orderan masuk ni!");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(intent);
            } else {
                activity.startService(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /** Pilih akun Google yang tersimpan di HP real pengguna */
    @JavascriptInterface
    public void pickGoogleAccount() {
        try {
            if (activity instanceof MainActivity) {
                activity.runOnUiThread(() -> {
                    ((MainActivity) activity).pickGoogleAccount();
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
