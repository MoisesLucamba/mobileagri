import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isAgrilinkAdmin } from '../lib/agrilinkAds';
import Icon from './Icon';

export default function AdminOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let mounted = true;
    isAgrilinkAdmin().then((allowed) => {
      if (mounted) setStatus(allowed ? 'allowed' : 'denied');
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (status === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.body}>A confirmar permissões de administrador…</Text>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={styles.center}>
        <View style={styles.icon}>
          <Icon name="shield" size={25} color={COLORS.danger} />
        </View>
        <Text style={styles.title}>Área reservada</Text>
        <Text style={styles.body}>Esta página está disponível apenas para administradores AgriLink.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/home')}>
          <Text style={styles.buttonText}>Voltar ao feed</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const COLORS = {
  primary: '#1F6B3A',
  text: '#16231C',
  muted: '#78877D',
  danger: '#B54747',
  dangerSoft: '#FCECEC',
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#FAF8F3' },
  icon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: COLORS.dangerSoft },
  title: { marginTop: 18, color: COLORS.text, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  body: { maxWidth: 320, marginTop: 9, color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  button: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 22, paddingHorizontal: 18, borderRadius: 12, backgroundColor: COLORS.primary },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});