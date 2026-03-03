// ========== ЭКРАН DASHBOARD ==========
// Обзор: статус кошелька, контракты, быстрые действия
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  return (
    <View style={s.container}>
      <Text style={s.title}>DOM Mobile</Text>
      <Text style={s.subtitle}>Обзор экосистемы DOM</Text>

      <View style={s.actions}>
        <TouchableOpacity
          style={s.btn}
          onPress={() => navigation.navigate('Deploy')}
        >
          <Text style={s.btnText}>Deploy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btn}
          onPress={() => navigation.navigate('Mint')}
        >
          <Text style={s.btnText}>Mint</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btn}
          onPress={() => navigation.navigate('Monitor')}
        >
          <Text style={s.btnText}>Monitor</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={s.btnText}>Settings</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 28,
    color: '#e2e8f0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  actions: {
    gap: 12,
  },
  btn: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
  },
});