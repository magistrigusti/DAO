// ========== ЭКРАН MINT ==========
// Ручной минт через Master (OP_MINT от minterAddress)
// Phase-1 testnet: minter = deployer wallet
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Mint'>;

export default function MintScreen({}: Props) {
  const [amount, setAmount] = useState('');

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Manual Mint</Text>
      <Text style={s.subtitle}>
        Отправка OP_MINT на Master (Phase-1: minter = твой кошелёк)
      </Text>

      <Text style={s.label}>Сумма (DOM, 6 decimals)</Text>
      <TextInput
        style={s.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="1000000"
        placeholderTextColor="#64748b"
        keyboardType="numeric"
      />

      <TouchableOpacity style={s.btn} disabled>
        <Text style={s.btnText}>Mint (скоро)</Text>
      </TouchableOpacity>

      <Text style={s.hint}>
        Интеграция: TonConnect sendTransaction + payload OP_MINT
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    color: '#e2e8f0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e1e2e',
    color: '#e2e8f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    opacity: 0.7,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 16,
  },
});