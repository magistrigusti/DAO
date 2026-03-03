// ========== ЭКРАН АКТИВЫ ==========
// Крипто-активы из MongoDB: jetton, NFT (позже)
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { fetchAssets, createAsset, type CryptoAsset } from '../services/api';
import { getConfig } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Assets'>;

export default function AssetsScreen({}: Props) {
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await getConfig();
      const base = cfg.apiUrl || undefined;
      const list = await fetchAssets(base);
      setAssets(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  return (
    <View style={s.container}>
      <Text style={s.title}>Крипто-активы</Text>
      <Text style={s.subtitle}>DOM, ALLOD, NFT (позже)</Text>

      {error && <Text style={s.error}>{error}</Text>}
      {loading && <ActivityIndicator color="#6366f1" style={s.loader} />}

      <TouchableOpacity style={s.btn} onPress={loadAssets}>
        <Text style={s.btnText}>Обновить</Text>
      </TouchableOpacity>

      <FlatList
        data={assets}
        keyExtractor={(item) => item._id ?? item.masterAddress}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.symbol}>{item.symbol}</Text>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.addr} numberOfLines={1}>
              {item.masterAddress}
            </Text>
            <Text style={s.network}>{item.network}</Text>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={s.empty}>Нет активов. Добавьте через Deploy.</Text>
          ) : null
        }
      />
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
  error: {
    color: '#ef4444',
    marginBottom: 8,
  },
  loader: {
    marginVertical: 8,
  },
  btn: {
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#1e1e2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  symbol: {
    fontSize: 18,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  name: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  addr: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  network: {
    fontSize: 12,
    color: '#6366f1',
    marginTop: 4,
  },
  empty: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 24,
  },
});
