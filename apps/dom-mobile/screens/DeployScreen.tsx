// ========== ЭКРАН DEPLOY ==========
// Деплой DOM core (Master, Minter, Givers, Treasury, Gas Pool)
// Placeholder — интеграция с wrappers позже
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Deploy'>;

export default function DeployScreen({}: Props) {
  return (
    <View style={s.container}>
      <Text style={s.title}>Deploy DOM Core</Text>
      <Text style={s.subtitle}>
        Placeholder: интеграция с deployDomCoreTestnet
      </Text>
      <Text style={s.hint}>
        Подключи кошелёк — деплой будет доступен
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#0f0f1a',
  },
  title: {
    fontSize: 24,
    color: '#e2e8f0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
  },
});