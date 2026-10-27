package com.sobatserabut.mitra;

import android.app.AlertDialog;
import android.content.DialogInterface;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.ProgressBar;

public class AppWebChromeClient extends WebChromeClient {
    private final MainActivity activity;
    private final ProgressBar progressBar;

    public AppWebChromeClient(MainActivity activity, ProgressBar progressBar) {
        this.activity = activity;
        this.progressBar = progressBar;
    }

    @Override
    public void onProgressChanged(WebView view, int newProgress) {
        if (progressBar != null) {
            if (newProgress < 100) {
                progressBar.setVisibility(View.VISIBLE);
                progressBar.setProgress(newProgress);
            } else {
                progressBar.setVisibility(View.GONE);
            }
        }
    }

    @Override
    public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        callback.invoke(origin, true, false);
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && request != null) {
            request.grant(request.getResources());
        }
    }

    @Override
    public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
        new AlertDialog.Builder(activity)
            .setTitle("SobatSerabut")
            .setMessage(message)
            .setPositiveButton("OK", (dialog, which) -> result.confirm())
            .setCancelable(false)
            .create()
            .show();
        return true;
    }

    @Override
    public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
        new AlertDialog.Builder(activity)
            .setTitle("SobatSerabut")
            .setMessage(message)
            .setPositiveButton("Ya / Lanjutkan", (dialog, which) -> result.confirm())
            .setNegativeButton("Batal", (dialog, which) -> result.cancel())
            .setCancelable(false)
            .create()
            .show();
        return true;
    }

    @Override
    public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, final JsPromptResult result) {
        final EditText input = new EditText(activity);
        input.setText(defaultValue != null ? defaultValue : "");
        new AlertDialog.Builder(activity)
            .setTitle("SobatSerabut")
            .setMessage(message)
            .setView(input)
            .setPositiveButton("Kirim", (dialog, which) -> result.confirm(input.getText().toString()))
            .setNegativeButton("Batal", (dialog, which) -> result.cancel())
            .setCancelable(false)
            .create()
            .show();
        return true;
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams fileChooserParams) {
        return activity.handleFileChooser(callback, fileChooserParams);
    }
}
