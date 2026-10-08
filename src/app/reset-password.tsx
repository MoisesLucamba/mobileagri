import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { supabase } from '../lib/supabase';
import ProcessingScreen from '../components/ProcessingScreen';

const COLORS = {
  primary: '#16834A',
  dark: '#143529',
  text: '#1C3428',
  muted: '#687A6C',
  faint: '#9AA99D',
  border: '#DCE8DD',
  background: '#F4F9F2',
  soft: '#EAF5E8',
  danger: '#B54747',
  dangerSoft: '#FCECEC',
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const routeParams = useLocalSearchParams<{
    code?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const incomingUrl = Linking.useLinkingURL();

  const [sessionReady, setSessionReady] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const processedLink = useRef('');

  const linkParams = useMemo(() => {
    const query: Record<string, string> = {};
    const hash: Record<string, string> = {};
    if (!incomingUrl) return { query, hash };

    try {
      const url = new URL(incomingUrl);
      url.searchParams.forEach((value, key) => { query[key] = value; });
      new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => { hash[key] = value; });
    } catch {
      return { query, hash };
    }

    return { query, hash };
  }, [incomingUrl]);

  const code = firstParam(routeParams.code) || linkParams.query.code;
  const tokenHash = firstParam(routeParams.token_hash) || linkParams.query.token_hash;
  const tokenType = firstParam(routeParams.type) || linkParams.query.type;
  const accessToken = linkParams.query.access_token || linkParams.hash.access_token;
  const refreshToken = linkParams.query.refresh_token || linkParams.hash.refresh_token;
  const linkError = firstParam(routeParams.error_description) || firstParam(routeParams.error) || linkParams.query.error_description || linkParams.query.error;

  useEffect(() => {
    const fingerprint = [code, tokenHash, tokenType, accessToken, refreshToken, linkError].join('|');
    if (!fingerprint.replace(/\|/g, '') || processedLink.current === fingerprint) return;
    processedLink.current = fingerprint;

    const completeRecovery = async () => {
      setCheckingLink(true);
      setError('');
      try {
        if (linkError) throw new Error(linkError);

        if (tokenHash && tokenType === 'recovery') {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (verifyError) throw verifyError;
          if (!data.session) throw new Error('O link não criou uma sessão de recuperação.');
          setSessionReady(true);
          return;
        }

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          if (!data.session) throw new Error('O link não criou uma sessão de recuperação.');
          setSessionReady(true);
          return;
        }

        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          if (!data.session) throw new Error('O link não criou uma sessão de recuperação.');
          setSessionReady(true);
          return;
        }

        throw new Error('O link de recuperação é inválido ou expirou. Peça um novo e-mail.');
      } catch (linkFailure: any) {
        setError(linkFailure?.message || 'Não foi possível validar o link de recuperação.');
      } finally {
        setCheckingLink(false);
      }
    };

    completeRecovery();
  }, [accessToken, code, linkError, refreshToken, tokenHash, tokenType]);

  const savePassword = async () => {
    if (password.length < 8) {
      setError('A nova palavra-passe deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message || 'Não foi possível atualizar a palavra-passe.');
      return;
    }

    setSuccess('Palavra-passe atualizada. A sua conta já está pronta para usar.');
    setTimeout(() => router.replace('/home'), 900);
  };

  if (checkingLink) return <ProcessingScreen />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 24) + 24, paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/login')}>
          <Icon name="chevron-left" size={20} color={COLORS.text} />
          <Text style={styles.backText}>Voltar ao login</Text>
        </TouchableOpacity>

        <View style={styles.iconBadge}>
          <Icon name="lock" size={25} color={COLORS.primary} />
        </View>
        <Text style={styles.eyebrow}>SEGURANÇA DA CONTA</Text>
        <Text style={styles.title}>Criar nova palavra-passe</Text>
        <Text style={styles.subtitle}>Defina uma palavra-passe nova para voltar a aceder à AgriLink.</Text>

        {error ? (
          <View style={[styles.messageBox, styles.errorBox]}>
            <Icon name="alert-circle" size={17} color={COLORS.danger} />
            <Text style={[styles.messageText, styles.errorText]}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={[styles.messageBox, styles.successBox]}>
            <Icon name="check-circle" size={17} color={COLORS.primary} />
            <Text style={styles.messageText}>{success}</Text>
          </View>
        ) : null}

        {sessionReady && !success ? (
          <>
            <Text style={styles.label}>Nova palavra-passe</Text>
            <View style={styles.inputRow}>
              <Icon name="lock" size={18} color={COLORS.muted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={COLORS.faint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
                style={styles.input}
                textContentType="newPassword"
              />
              <TouchableOpacity onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}>
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={19} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirmar palavra-passe</Text>
            <View style={styles.inputRow}>
              <Icon name="lock" size={18} color={COLORS.muted} />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repita a palavra-passe"
                placeholderTextColor={COLORS.faint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
                style={styles.input}
                textContentType="newPassword"
                onSubmitEditing={savePassword}
              />
            </View>

            <TouchableOpacity style={[styles.submitButton, saving && styles.disabled]} onPress={savePassword} disabled={saving}>
              <Text style={styles.submitText}>{saving ? 'A guardar…' : 'Guardar palavra-passe'}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {!checkingLink && !sessionReady && !error ? (
          <TouchableOpacity style={styles.submitButton} onPress={() => router.replace('/login')}>
            <Text style={styles.submitText}>Pedir novo link</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24 },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10 },
  backText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  iconBadge: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 56, borderRadius: 20, backgroundColor: COLORS.soft },
  eyebrow: { marginTop: 26, color: COLORS.primary, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  title: { marginTop: 8, color: COLORS.text, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 8, color: COLORS.muted, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  label: { marginTop: 21, marginBottom: 7, color: COLORS.text, fontSize: 12.5, fontWeight: '700' },
  inputRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 13, backgroundColor: '#FFFFFF' },
  input: { flex: 1, minHeight: 48, color: COLORS.text, fontSize: 14 },
  messageBox: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 24, padding: 12, borderRadius: 12, backgroundColor: COLORS.soft },
  errorBox: { backgroundColor: COLORS.dangerSoft },
  successBox: { backgroundColor: COLORS.soft },
  messageText: { flex: 1, color: COLORS.text, fontSize: 12.5, lineHeight: 18 },
  errorText: { color: COLORS.danger },
  submitButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 22, borderRadius: 13, backgroundColor: COLORS.primary },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});