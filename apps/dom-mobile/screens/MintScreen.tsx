// ========== ЭКРАН MINT ==========
// Ручной минт через Minter (OP_MINT)
// Placeholder — интеграция с DomMinter позже
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Mint'>;

export default function MintScreen({}: Props) {
  return (
    <View style={s.container}>
      <Text style={s.title}>Manual Mint</Text>
      <Text style={s.subtitle}>
        Placeholder: отправка OP_MINT на Minter
      </Text>
      <Text style={s.hint}>
        Требуется Minter контракт и сид-фраза
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