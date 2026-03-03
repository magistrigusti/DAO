// ========== ЭКРАН DASHBOARD ==========
// Обзор: сначала Connect Wallet, после подключения — действия по whitelist
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTonConnect } from '../services/TonConnectProvider';
import {
  fetchAllowedActions,
  filterActionsByRoles,
} from '../services/api';
import { getConfig } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const ALL_ACTIONS = [
  { key: 'Deploy', label: 'Deploy', route: 'Deploy' as const },
  { key: 'Mint', label: 'Mint', route: 'Mint' as const },
  { key: 'Monitor', label: 'Monitor', route: 'Monitor' as const },
  { key: 'Assets', label: 'Активы', route: 'Assets' as const },
  { key: 'Settings', label: 'Settings', route: 'Settings' as const },
];

export default function DashboardScreen({ navigation }: Props) {
  const { connected, address, connectWallet, disconnect } = useTonConnect();
  const [allowedActions, setAllowedActions] = useState<typeof ALL_ACTIONS>(ALL_ACTIONS);

  const loadAllowedActions = useCallback(async () => {
    if (!address) return;
    const cfg = await getConfig();
    const roles = await fetchAllowedActions(address, cfg.apiUrl || undefined);
    setAllowedActions(filterActionsByRoles(ALL_ACTIONS, roles));
  }, [address]);

  React.useEffect(() => {
    if (connected && address) loadAllowedActions();
  }, [connected, address, loadAllowedActions]);

  return (
    <View style={s.container}>
      <Text style={s.title}>DOM Mobile</Text>
      <Text style={s.subtitle}>Обзор экосистемы DOM</Text>

      <View style={s.wallet}>
        <Text style={s.label}>
          Кошелёк: {connected ? address ?? '—' : 'не подключен'}
        </Text>
        <TouchableOpacity
          style={s.connectBtn}
          onPress={connected ? disconnect : connectWallet}
        >
          <Text style={s.btnText}>
            {connected ? 'Отключить' : 'Подключить кошелёк'}
          </Text>
        </TouchableOpacity>
      </View>

      {connected && (
        <View style={s.actions}>
          {allowedActions.map(({ key, label, route }) => (
            <TouchableOpacity
              key={key}
              style={s.btn}
              onPress={() => navigation.navigate(route)}
            >
              <Text style={s.btnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
    marginBottom: 24,
  },
  wallet: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  connectBtn: {
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
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