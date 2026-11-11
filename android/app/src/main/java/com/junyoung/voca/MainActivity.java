package com.junyoung.voca;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안 업데이트(APK 내려받기 + 설치 화면) 플러그인
        registerPlugin(AppUpdaterPlugin.class);
        // 내비게이션 바 색 맞추기
        registerPlugin(SystemUiPlugin.class);
        super.onCreate(savedInstanceState);
        fixTextZoom();
    }

    @Override
    public void onResume() {
        super.onResume();
        fixTextZoom();
    }

    /**
     * 안드로이드 WebView 는 시스템 '글자 크기' 설정(font_scale)만큼 글자를 키우거나 줄인다(예: 0.9 → 모든 글자가 90%).
     * 말해보카는 캔버스 앱이라 그 설정을 따르지 않으므로, 실측 치수대로 보이게 항상 100% 로 고정한다.
     * (2026-11-11: 플립의 font_scale 0.9 때문에 글자가 10% 작게 나오던 문제)
     */
    private void fixTextZoom() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            android.webkit.WebSettings s = getBridge().getWebView().getSettings();
            s.setTextZoom(100);
            // index.html 이 폰에서 viewport 를 width=360 으로 바꾼다(말해보카처럼 화면 폭에 맞춰 통째로 확대).
            // 안드로이드 WebView 는 이 설정이 켜져 있어야 viewport 메타 태그의 폭을 따른다
            s.setUseWideViewPort(true);
            s.setLoadWithOverviewMode(true);
        }
    }
}
