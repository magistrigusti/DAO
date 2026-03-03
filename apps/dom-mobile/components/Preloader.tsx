// ========== ПРЕЛОАДЕР ==========
// Placeholder — в RN используем ActivityIndicator
// Путь @/components/Preloader для совместимости с веб-проектом
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

function PreloaderPair() {
  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}

export default PreloaderPair;
export { PreloaderPair };

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});