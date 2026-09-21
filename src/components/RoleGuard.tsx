// components/RoleGuard.tsx

import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useUserRole } from '../context/RoleContext';
import { UserRole } from '../constants/roleActions';

interface RoleGuardProps {
  allow: UserRole[];
  children: ReactNode;
}

export default function RoleGuard({
  allow,
  children,
}: RoleGuardProps) {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.text}>A verificar o teu perfil...</Text>
      </View>
    );
  }

  const normalizedRole = role
    ? String(role).trim().toLowerCase()
    : '';

  console.log('Role atual:', role);
  console.log('Role normalizado:', normalizedRole);
  console.log('Roles permitidos:', allow);

  if (!normalizedRole) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Perfil sem função</Text>
        <Text style={styles.text}>
          Não foi encontrada uma função para este utilizador.
        </Text>
        <Text style={styles.text}>
          A função deve ser agricultor, agente ou comprador.
        </Text>
      </View>
    );
  }

  if (!allow.includes(normalizedRole as UserRole)) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Acesso não autorizado</Text>
        <Text style={styles.text}>
          O teu perfil atual é: {normalizedRole}
        </Text>
        <Text style={styles.text}>
          Esta página permite: {allow.join(', ')}
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FAFAF7',
  },
  title: {
    color: '#1C2B1E',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  text: {
    color: '#6B7C6E',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
});
