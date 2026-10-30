package com.sobatserabut.mitra;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class AppWebViewClient extends WebViewClient {
    private final Context context;

    public AppWebViewClient(Context context) {
        this.context = context;
    }

    private boolean handleExternalUri(String url) {
        if (url == null || url.trim().isEmpty()) return false;

        // 1. WhatsApp link (whatsapp://, wa.me, api.whatsapp.com)
        if (url.startsWith("whatsapp:") || url.contains("wa.me") || url.contains("api.whatsapp.com")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return true;
            } catch (Exception e) {
                try {
                    Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url.startsWith("whatsapp:") ? "https://wa.me/6287791201091" : url));
                    webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(webIntent);
                    return true;
                } catch (Exception ex) {
                    Toast.makeText(context, "Aplikasi WhatsApp tidak terpasang di perangkat ini.", Toast.LENGTH_SHORT).show();
                    return true;
                }
            }
        }

        // 2. SMS direct link (sms:, smsto:)
        if (url.startsWith("sms:") || url.startsWith("smsto:")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return true;
            } catch (Exception e) {
                Toast.makeText(context, "Tidak dapat membuka aplikasi SMS", Toast.LENGTH_SHORT).show();
                return true;
            }
        }

        // 3. Telepon (tel:)
        if (url.startsWith("tel:")) {
            try {
                Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        // 4. Email (mailto:)
        if (url.startsWith("mailto:")) {
            try {
                Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        // 5. Google Maps & Navigasi (geo:, maps.google.com, google.com/maps)
        if (url.startsWith("geo:") || url.contains("maps.google.com") || url.contains("google.com/maps")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        // 6. Custom Android Intent URI (intent://)
        if (url.startsWith("intent:")) {
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    return true;
                }
            } catch (Exception e) {
                return true;
            }
        }

        // 7. Unduhan Berkas APK & Pembaruan Versi Aplikasi Otomatis
        if (url.endsWith(".apk") || url.contains("/download/") || url.contains("download-apk") || url.contains("driver-apk") || url.contains("client-apk") || url.contains("Driver-SobatSerabut") || url.contains("SobatSerabut.apk")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        return false;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (request != null && request.getUrl() != null) {
            String url = request.getUrl().toString();
            if (handleExternalUri(url)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (handleExternalUri(url)) {
            return true;
        }
        return false;
    }

    @Override
    public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
        handler.proceed();
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        // Abaikan galat koneksi internal aset lokal agar aplikasi tetap berjalan mulus
    }
}
