package com.junyoung.voca;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 폰 내장 음성(TextToSpeech)으로 영어 문장을 읽는다.
 * 안드로이드 WebView 에는 웹의 speechSynthesis 가 없어서(2026-11-11 플립에서 확인: 'speechSynthesis' in window === false)
 * APK 에서는 문장 듣기·다시 듣기가 전혀 소리가 나지 않았다. 유료 API 없이 기기에 들어 있는 음성 엔진을 쓴다.
 *   speak({ text, rate, lang, volume, voice }) → 다 읽으면 { done: true }, 끊기면 { done: false }
 *   stop()
 *   voices() → { ready, voices: [{ name, lang }] } (기기에 내려받아진 음성만)
 */
@CapacitorPlugin(name = "Tts")
public class TtsPlugin extends Plugin {
    private TextToSpeech tts;
    private volatile boolean ready = false;
    private final ConcurrentHashMap<String, PluginCall> calls = new ConcurrentHashMap<>();

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            ready = status == TextToSpeech.SUCCESS;
            if (!ready) return;
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String id) {}

                @Override
                public void onDone(String id) {
                    finish(id, true);
                }

                @Override
                public void onError(String id) {
                    finish(id, false);
                }

                @Override
                public void onStop(String id, boolean interrupted) {
                    finish(id, false);
                }
            });
        });
    }

    private void finish(String id, boolean done) {
        PluginCall c = calls.remove(id);
        if (c == null) return;
        JSObject r = new JSObject();
        r.put("done", done);
        c.resolve(r);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        if (!ready || tts == null) {
            call.reject("tts-not-ready");
            return;
        }
        String text = call.getString("text", "");
        float rate = call.getFloat("rate", 1f);
        float volume = call.getFloat("volume", 1f);
        String lang = call.getString("lang", "en-US");
        String voiceName = call.getString("voice");
        try {
            tts.setLanguage(Locale.forLanguageTag(lang));
            if (voiceName != null) {
                for (Voice v : tts.getVoices()) {
                    if (v.getName().equals(voiceName)) {
                        tts.setVoice(v);
                        break;
                    }
                }
            }
            tts.setSpeechRate(rate);
            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0f, Math.min(1f, volume)));
            String id = UUID.randomUUID().toString();
            calls.put(id, call);
            if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, id) != TextToSpeech.SUCCESS) {
                calls.remove(id);
                call.reject("tts-failed");
            }
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }

    @PluginMethod
    public void voices(PluginCall call) {
        JSArray arr = new JSArray();
        if (ready && tts != null) {
            try {
                for (Voice v : tts.getVoices()) {
                    if (v.isNetworkConnectionRequired()) continue;
                    if (v.getFeatures() != null && v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                    JSObject o = new JSObject();
                    o.put("name", v.getName());
                    o.put("lang", v.getLocale().toLanguageTag());
                    arr.put(o);
                }
            } catch (Exception ignored) {
                // 음성 목록을 못 얻어도 기본 음성으로 읽을 수 있다
            }
        }
        JSObject r = new JSObject();
        r.put("ready", ready);
        r.put("voices", arr);
        call.resolve(r);
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
    }
}
