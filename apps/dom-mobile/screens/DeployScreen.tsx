// ========== ЭКРАН DEPLOY ==========
// Кнопки управления контрактами + инструкции
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { fetchContracts, type StoredContracts } from '../services/api';
import { getConfig, getContracts } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Deploy'>;

const TONSCAN = 'https://testnet.tonscan.org/address/';

const CONTRACT_ACTIONS: {
  key: keyof StoredContracts;
  label: string;
  primary?: 'mint' | 'monitor';
}[] = [
  { key: 'master', label: 'Master', primary: 'mint' },
  { key: 'gasPool', label: 'Gas Pool' },
  { key: 'gasProxy', label: 'Gas Proxy' },
  { key: 'giverAllodium', label: 'Giver Allodium' },
  { key: 'giverDefi', label: 'Giver DeFi' },
  { key: 'giverDao', label: 'Giver DAO' },
  { key: 'giverDominum', label: 'Giver Dominum' },
];

export default function DeployScreen({ navigation }: Props) {
  const [contracts, setContracts] = useState<StoredContracts>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await getConfig();
      const data = await fetchContracts(cfg.apiUrl || undefined);
      setContracts(data);
    } catch {
      const local = (await getContracts()) as StoredContracts;
      setContracts(local);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const openTonscan = (addr: string) => {
    if (addr?.startsWith('EQ')) Linking.openURL(`${TONSCAN}${addr}`);
  };

  const hasAny = Object.values(contracts).some(
    (v) => typeof v === 'string' && v.startsWith('EQ')
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Deploy DOM Core</Text>
      <Text style={s.subtitle}>
        Управление контрактами
      </Text>

      {loading ? (
        <ActivityIndicator color="#6366f1" style={s.loader} />
      ) : hasAny ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Контракты</Text>
          {CONTRACT_ACTIONS.map(({ key, label, primary }) => {
            const addr = contracts[key];
            if (!addr || !addr.startsWith('EQ')) return null;
            const short = `${addr.slice(0, 8)}...${addr.slice(-6)}`;
            return (
              <View key={key} style={s.card}>
                <Text style={s.cardLabel}>{label}</Text>
                <Text style={s.cardAddr} numberOfLines={1}>{short}</Text>
                <View style={s.row}>
                  <TouchableOpacity
                    style={s.btn}
                    onPress={() => openTonscan(addr)}
                  >
                    <Text style={s.btnText}>Tonscan</Text>
                  </TouchableOpacity>
                  {primary === 'mint' && (
                    <TouchableOpacity
                      style={[s.btn, s.btnPrimary, s.btnMargin]}
                      onPress={() => navigation.navigate('Mint')}
                    >
                      <Text style={s.btnText}>Mint</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
          <TouchableOpacity
            style={[s.btn, s.btnWide]}
            onPress={() => navigation.navigate('Monitor')}
          >
            <Text style={s.btnText}>Monitor — адреса</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.section}>
          <Text style={s.hint}>
            Контракты не найдены. Задеплой через терминал, затем сохрани адреса в Monitor.
          </Text>
          <TouchableOpacity
            style={[s.btn, s.btnPrimary]}
            onPress={() => navigation.navigate('Monitor')}
          >
            <Text style={s.btnText}>Monitor — вставить адреса</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={s.refresh} onPress={load}>
        <Text style={s.refreshText}>Обновить</Text>
      </TouchableOpacity>

      <View style={s.collapse}>
        <Text style={s.collapseTitle}>Как задеплоить</Text>
        <Text style={s.collapseStep}>1. cd c:\projects\DAO</Text>
        <Text style={s.collapseStep}>2. npx blueprint build --all</Text>
        <Text style={s.collapseStep}>3. npm run deploy → deployDomCoreTestnet</Text>
        <Text style={s.collapseStep}>4. QR/TonConnect, подтвердить транзакции</Text>
        <Text style={s.collapseStep}>5. Monitor → сохранить адреса</Text>
      </View>
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
    marginBottom: 20,
  },
  loader: {
    marginVertical: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#e2e8f0',
    marginBottom: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1e1e2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 14,
    color: '#e2e8f0',
    fontWeight: '500',
  },
  cardAddr: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    marginTop: 12,
  },
  btn: {
    backgroundColor: '#2d2d3d',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnPrimary: {
    backgroundColor: '#6366f1',
  },
  btnMargin: {
    marginLeft: 12,
  },
  btnWide: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
  },
  hint: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  refresh: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  refreshText: {
    color: '#6366f1',
    fontSize: 14,
  },
  collapse: {
    borderTopWidth: 1,
    borderTopColor: '#2d2d3d',
    paddingTop: 20,
  },
  collapseTitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  collapseStep: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
});
