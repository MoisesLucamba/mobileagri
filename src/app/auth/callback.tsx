import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { supabase } from '../../lib/supabase';

// Rota de retorno do login com Google (agrilink://auth/callback).
// A sessão é criada no ecrã de login; aqui só se espera por ela
// e segue-se para a home. Se nada acontecer, volta ao login.
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let done = false;

    const go = (path: '/home' | '/login') => {
      if (done) return;
      done = true;
      router.replace(path);
    };

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) go('/home');
      }
    );

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go('/home');
    });

    const timeout = setTimeout(() => go('/login'), 10000);

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#2E7D32" />
    </View>
  );
}