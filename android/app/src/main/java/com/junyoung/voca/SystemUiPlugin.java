package com.junyoung.voca;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 화면 아래 시스템 내비게이션 바(제스처 막대 자리)의 색을 바꾼다.
 * 말해보카는 자판·하단 탭의 배경색이 화면 맨 아래까지 이어져 보이므로, 화면마다 아래쪽 배경색과 같은 색으로 맞춘다.
 */
@CapacitorPlugin(name = "SystemUi")
public class SystemUiPlugin extends Plugin {
    /**
     * 시스템 표준 터치 진동(자판 키 등). 말해보카는 키를 누를 때마다 시스템 햅틱(삼성 기기에서 SemHaptic 패턴)을 낸다 —
     * 임의 길이의 진동(Vibrator.vibrate)과 느낌이 달라서, 같은 시스템 햅틱을 View.performHapticFeedback 으로 낸다.
     * type: android.view.HapticFeedbackConstants 값 (기본 KEYBOARD_TAP = 3)
     */
    @PluginMethod
    public void haptic(PluginCall call) {
        final int type = call.getInt("type", android.view.HapticFeedbackConstants.KEYBOARD_TAP);
        getActivity().runOnUiThread(() -> {
            try {
                View v = getBridge().getWebView();
                boolean ok = v.performHapticFeedback(type);
                com.getcapacitor.JSObject r = new com.getcapacitor.JSObject();
                r.put("performed", ok);
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void setNavigationBarColor(PluginCall call) {
        final String color = call.getString("color", "#000000");
        final boolean lightIcons = Boolean.TRUE.equals(call.getBoolean("lightBackground", false));
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                w.setNavigationBarColor(Color.parseColor(color));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    View d = w.getDecorView();
                    int flags = d.getSystemUiVisibility();
                    if (lightIcons) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    else flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    d.setSystemUiVisibility(flags);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) w.setNavigationBarContrastEnforced(false);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }
}
