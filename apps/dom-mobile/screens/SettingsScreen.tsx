// ========== ЭКРАН SETTINGS ==========
// Metadata URL, Network (mainnet/testnet), адреса контрактов
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getConfig, setConfig } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({}: Props) {
  const [metadataUrl, setMetadataUrl] = useState('');
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('testnet');

  const loadConfig = useCallback(async () => {
    const cfg = await getConfig();
    setMetadataUrl(cfg.metadataUrl);
    setNetwork(cfg.network);
  }, []);

  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async () => {
    await setConfig({ metadataUrl, network });
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Settings</Text>

      <Text style={s.label}>Metadata URL</Text>
      <TextInput
        style={s.input}
        value={metadataUrl}
        onChangeText={setMetadataUrl}
        placeholder="https://dominum.vercel.app"
        placeholderTextColor="#64748b"
      />

      <Text style={s.label}>Network</Text>
      <View style={s.row}>
        <TouchableOpacity
          style={[s.toggle, network === 'mainnet' && s.toggleActive]}
          onPress={() => setNetwork('mainnet')}
        >
          <Text style={s.toggleText}>mainnet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggle, network === 'testnet' && s.toggleActive]}
          onPress={() => setNetwork('testnet')}
        >
          <Text style={s.toggleText}>testnet</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.btn} onPress={saveConfig}>
        <Text style={s.btnText}>Save</Text>
      </TouchableOpacity>
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
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  toggle: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1e1e2e',
  },
  toggleActive: {
    backgroundColor: '#6366f1',
  },
  toggleText: {
    color: '#e2e8f0',
  },
  btn: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
  },
});