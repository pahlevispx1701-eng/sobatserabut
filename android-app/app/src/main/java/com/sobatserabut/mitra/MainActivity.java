package com.sobatserabut.mitra;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.ProgressBar;
import android.widget.Toast;
import java.util.ArrayList;

public class MainActivity extends Activity {

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private static final int PERMISSION_REQUEST_CODE = 2001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            setContentView(R.layout.activity_main);

            webView = findViewById(R.id.webView);
            progressBar = findViewById(R.id.progressBar);

            createNotificationChannel();
            requestAppPermissions();
            setupWebView();

            webView.loadUrl("file:///android_asset/www/index.html");
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationChannel channel = new NotificationChannel(
                    AndroidBridge.CHANNEL_ID,
                    "Notifikasi SobatSerabut",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notifikasi pesanan, obrolan, dan informasi tugas");
                channel.enableVibration(true);
                channel.enableLights(true);
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.createNotificationChannel(channel);
                }
            } catch (Throwable t) {
                t.printStackTrace();
            }
        }
    }

    private void requestAppPermissions() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                ArrayList<String> permList = new ArrayList<>();
                permList.add(Manifest.permission.ACCESS_FINE_LOCATION);
                permList.add(Manifest.permission.ACCESS_COARSE_LOCATION);
                permList.add(Manifest.permission.CAMERA);
                permList.add(Manifest.permission.RECORD_AUDIO);
                permList.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                permList.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);

                if (Build.VERSION.SDK_INT >= 33) {
                    permList.add("android.permission.POST_NOTIFICATIONS");
                }

                ArrayList<String> needRequest = new ArrayList<>();
                for (String perm : permList) {
                    if (checkSelfPermission(perm) != PackageManager.PERMISSION_GRANTED) {
                        needRequest.add(perm);
                    }
                }

                if (!needRequest.isEmpty()) {
                    requestPermissions(needRequest.toArray(new String[0]), PERMISSION_REQUEST_CODE);
                }
            }
        } catch (Throwable t) {
            t.printStackTrace();
        }
    }

    private void setupWebView() {
        if (webView == null) return;
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            settings.setMediaPlaybackRequiresUserGesture(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebViewClient(new AppWebViewClient(this));
        webView.setWebChromeClient(new AppWebChromeClient(this, progressBar));

        // Daftarkan Android JS Bridge → dapat diakses via window.Android di JS
        webView.addJavascriptInterface(new AndroidBridge(this), "Android");

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "Gagal mengunduh pembaruan berkas: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    public boolean handleFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams fileChooserParams) {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
        }
        filePathCallback = callback;

        try {
            Intent intent = fileChooserParams.createIntent();
            startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
            return true;
        } catch (Exception e) {
            filePathCallback = null;
            Toast.makeText(this, "Gagal membuka pengunggah berkas", Toast.LENGTH_SHORT).show();
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getDataString() != null) {
                        results = new Uri[]{Uri.parse(data.getDataString())};
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
