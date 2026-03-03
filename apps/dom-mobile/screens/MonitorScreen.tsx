// ========== ЭКРАН MONITOR ==========
// Адреса контрактов из API (MongoDB). Сохранение после деплоя.
// Позже: totalSupply, balance через TON API
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { fetchContracts, saveContracts, type StoredContracts } from '../services/api';
import { getConfig } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Monitor'>;

const FIELDS: { key: keyof StoredContracts; label: string }[] = [
  { key: 'master', label: 'Master' },
  { key: 'gasProxy', label: 'Gas Proxy' },
  { key: 'gasPool', label: 'Gas Pool' },
  { key: 'giverAllodium', label: 'Giver Allodium' },
  { key: 'giverDefi', label: 'Giver DeFi' },
  { key: 'giverDao', label: 'Giver DAO' },
  { key: 'giverDominum', label: 'Giver Dominum' },
];

export default function MonitorScreen({}: Props) {
  const [contracts, setContracts] = useState<StoredContracts>({});
  const [edit, setEdit] = useState<StoredContracts>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await getConfig();
      const data = await fetchContracts(cfg.apiUrl || undefined);
      setContracts(data);
      setEdit(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const cfg = await getConfig();
      const saved = await saveContracts(edit, cfg.apiUrl || undefined);
      setContracts(saved);
      setEdit(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Contract Monitor</Text>
      <Text style={s.subtitle}>
        Адреса после деплоя. Сохраняются в MongoDB.
      </Text>

      {error && <Text style={s.error}>{error}</Text>}
      {loading && <ActivityIndicator color="#6366f1" style={s.loader} />}

      <TouchableOpacity style={s.btn} onPress={loadContracts} disabled={loading}>
        <Text style={s.btnText}>Обновить</Text>
      </TouchableOpacity>

      {FIELDS.map(({ key, label }) => (
        <View key={key} style={s.field}>
          <Text style={s.label}>{label}</Text>
          <TextInput
            style={s.input}
            value={edit[key] ?? ''}
            onChangeText={(v) => setEdit((prev) => ({ ...prev, [key]: v }))}
            placeholder="EQ..."
            placeholderTextColor="#64748b"
          />
        </View>
      ))}

      <TouchableOpacity
        style={[s.btn, s.btnPrimary]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={s.btnText}>
          {saving ? 'Сохранение...' : 'Сохранить контракты'}
        </Text>
      </TouchableOpacity>

      {contracts.network && (
        <Text style={s.hint}>Network: {contracts.network}</Text>
      )}
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
    marginBottom: 16,
  },
  error: {
    color: '#ef4444',
    marginBottom: 8,
  },
  loader: {
    marginVertical: 8,
  },
  btn: {
    backgroundColor: '#1e1e2e',
    padding: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  btnPrimary: {
    backgroundColor: '#6366f1',
    marginTop: 8,
    alignSelf: 'stretch',
    padding: 16,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
  },
  field: {
    marginBottom: 16,
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
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 16,
  },
});