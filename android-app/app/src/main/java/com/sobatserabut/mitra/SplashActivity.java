package com.sobatserabut.mitra;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

public class SplashActivity extends Activity {

    private static final int SPLASH_DELAY_MS = 1000;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean isFinished = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            setContentView(R.layout.activity_splash);
        } catch (Throwable t) {
            // Failsafe: Jika layout/resource mengalami kendala, langsung buka MainActivity agar aplikasi tidak crash
            proceedToMain();
            return;
        }

        handler.postDelayed(this::proceedToMain, SPLASH_DELAY_MS);
    }

    private void proceedToMain() {
        if (isFinished) return;
        isFinished = true;
        try {
            Intent intent = new Intent(SplashActivity.this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Throwable t) {
            t.printStackTrace();
        } finally {
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
    }
}
