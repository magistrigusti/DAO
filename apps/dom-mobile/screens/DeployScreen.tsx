// ========== ЭКРАН DEPLOY ==========
// Деплой DOM core (Master, Givers, Gas Pool, Proxy)
// После деплоя через Blueprint — сохрани адреса в Monitor
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Deploy'>;

const STEPS = [
  '1. Терминал: cd c:\\projects\\DAO',
  '2. npx blueprint build --all',
  '3. npm run deploy → выбрать deployDomCoreTestnet',
  '4. Подключить кошелёк (QR/TonConnect)',
  '5. Подтвердить все транзакции в кошельке',
  '6. Подождать 1 мин → npx blueprint run confirmGasProxyPool EQ... --testnet --tonconnect',
  '7. Monitor → сохранить адреса Master, GasProxy, GasPool',
];

export default function DeployScreen({ navigation }: Props) {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Deploy DOM Core</Text>
      <Text style={s.subtitle}>
        Деплой через Blueprint (QR / TonConnect)
      </Text>

      <View style={s.steps}>
        {STEPS.map((step, i) => (
          <Text key={i} style={s.step}>
            {step}
          </Text>
        ))}
      </View>

      <Text style={s.hint}>
        Подробно: DEPLOY_STEPS.md в корне проекта.
      </Text>

      <Text
        style={s.link}
        onPress={() => navigation.navigate('Monitor')}
      >
        → Monitor
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
  steps: {
    marginBottom: 24,
  },
  step: {
    fontSize: 14,
    color: '#e2e8f0',
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  link: {
    fontSize: 14,
    color: '#6366f1',
  },
});