// ========== ЭКРАН DEPLOY ==========
// Деплой DOM core (Master, Givers, Gas Pool, Proxy)
// После деплоя через Blueprint — сохрани адреса в Monitor
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Deploy'>;

const STEPS = [
  '1. Подключи кошелёк (TonConnect)',
  '2. Запусти deployDomCoreTestnet через Blueprint',
  '3. Подтверди Gas Pool через 48ч (confirmGasProxyPool)',
  '4. Сохрани адреса в Monitor → «Сохранить контракты»',
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
        После деплоя перейди в Monitor и сохрани адреса Master, GasProxy, GasPool.
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