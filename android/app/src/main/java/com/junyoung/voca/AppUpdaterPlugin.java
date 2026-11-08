package com.junyoung.voca;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 앱 안에서 새 APK 를 내려받아 안드로이드 설치 화면을 띄우는 플러그인 (스토어 없이 배포하는 앱의 "자동 업데이트").
 * - canInstall: 이 앱에 '출처를 알 수 없는 앱 설치' 권한이 있는지
 * - openInstallSettings: 그 권한을 켜는 설정 화면 열기
 * - downloadAndInstall({url}): 캐시 폴더에 내려받고(progress 이벤트) 패키지 설치 화면을 연다. 설치 버튼은 안드로이드 정책상 사용자가 누른다.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean ok = Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url 이 없어요");
            return;
        }
        new Thread(() -> {
            try {
                File out = new File(getContext().getCacheDir(), "update.apk");
                download(url, out);
                install(out);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? e.toString() : e.getMessage());
            }
        }).start();
    }

    private void download(String url, File out) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "junyoung-voca-updater");
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.connect();
        // GitHub 릴리스 다운로드는 다른 호스트로 한 번 더 넘어간다 (HttpURLConnection 은 호스트가 바뀌면 자동으로 따라가지 않음)
        int hops = 0;
        while ((c.getResponseCode() == 301 || c.getResponseCode() == 302 || c.getResponseCode() == 303 || c.getResponseCode() == 307 || c.getResponseCode() == 308) && hops < 5) {
            String next = c.getHeaderField("Location");
            c.disconnect();
            c = (HttpURLConnection) new URL(next).openConnection();
            c.setRequestProperty("User-Agent", "junyoung-voca-updater");
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.connect();
            hops++;
        }
        if (c.getResponseCode() != 200) throw new Exception("다운로드 실패 (HTTP " + c.getResponseCode() + ")");
        long total = c.getContentLengthLong();
        try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(out)) {
            byte[] buf = new byte[64 * 1024];
            long done = 0;
            int n;
            int lastPct = -1;
            while ((n = in.read(buf)) > 0) {
                fo.write(buf, 0, n);
                done += n;
                int pct = total > 0 ? (int) (done * 100 / total) : -1;
                if (pct != lastPct) {
                    lastPct = pct;
                    JSObject ev = new JSObject();
                    ev.put("percent", pct);
                    ev.put("bytes", done);
                    notifyListeners("progress", ev);
                }
            }
        } finally {
            c.disconnect();
        }
    }

    private void install(File apk) {
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }
}
