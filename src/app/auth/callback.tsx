import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import ProcessingScreen from '../../components/ProcessingScreen';

import { supabase } from '../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

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

  return <ProcessingScreen />;
}