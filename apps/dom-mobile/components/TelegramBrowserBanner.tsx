// ========== БАННЕР: ОТКРЫТЬ В БРАУЗЕРЕ ==========
// TonConnect не работает в Telegram WebView — нужен Chrome/Safari
import React from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

export function TelegramBrowserBanner() {
  if (Platform.OS !== 'web') return null;

  const isTelegram =
    typeof window !== 'undefined' &&
    (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;

  if (!isTelegram) return null;

  const openInBrowser = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <View style={s.banner}>
      <Text style={s.text}>
        TonConnect не работает внутри Telegram. Откройте в браузере (Chrome/Safari) для подключения кошелька.
      </Text>
      <TouchableOpacity style={s.btn} onPress={openInBrowser}>
        <Text style={s.btnText}>Открыть в браузере</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: '#1e3a5f',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  text: {
    color: '#e2e8f0',
    fontSize: 14,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
  },
});
