import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const parseUrlParams = (url: string) => {
  const params: Record<string, string> = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';

  [query, hash].forEach((part) =>
    new URLSearchParams(part).forEach((value, key) => {
      params[key] = value;
    })
  );

  return params;
};

const createSessionFromUrl = async (url: string) => {
  const params = parseUrlParams(url);

  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error);
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session;
  }

  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return data.session;
  }

  return null;
};

export async function signInWithGoogle(userType?: string) {
  const redirectTo = makeRedirectUri({
    scheme: 'agrilink',
    path: 'auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Não foi possível iniciar o Google.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return null;

  const session = await createSessionFromUrl(result.url);
  if (!session) return null;

  if (userType) {
    const metadata = session.user.user_metadata ?? {};
    const hasRole =
      metadata.user_type || metadata.role || metadata.user_role || metadata.type || metadata.account_type;

    if (!hasRole) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { user_type: userType },
      });
      if (updateError) throw updateError;
      return session;
    }
  }

  return session;
}