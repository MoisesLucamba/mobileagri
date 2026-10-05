import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
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

type Channel = 'email' | 'phone' | 'both';
type Stage = 'primary' | 'email';

const isChannel = (value: string | undefined): value is Channel =>
  value === 'email' || value === 'phone' || value === 'both';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ channel?: string; email?: string; phone?: string }>();
  const channel = isChannel(params.channel) ? params.channel : null;
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const phone = Array.isArray(params.phone) ? params.phone[0] : params.phone;

  const [stage, setStage] = useState<Stage>('primary');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);

  const primaryIsEmail = channel === 'email';
  const currentAddress = stage === 'email' ? email : primaryIsEmail ? email : phone;
  const destinationLabel = useMemo(() => {
    if (stage === 'email') return email || 'o seu e-mail';
    return primaryIsEmail ? email || 'o seu e-mail' : phone || 'o seu telefone';
  }, [email, phone, primaryIsEmail, stage]);

  useEffect(() => {
    if (!channel || (channel !== 'email' && !phone) || (channel !== 'phone' && !email)) {
      router.replace('/register');
    }
  }, [channel, email, phone, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const goToApp = () => router.replace('/home');

  const verify = async () => {
    const token = code.replace(/\D/g, '');
    if (token.length !== 6) {
      setError('Introduza o código de 6 dígitos.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (stage === 'email') {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: email!,
          token,
          type: 'email_change',
        });
        if (verifyError) throw verifyError;
        if (!data.session) throw new Error('Não foi possível iniciar a sessão após a confirmação.');
        goToApp();
        return;
      }

      if (primaryIsEmail) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: email!,
          token,
          type: 'signup',
        });
        if (verifyError) throw verifyError;
        if (!data.session) throw new Error('Não foi possível iniciar a sessão após a confirmação.');
        goToApp();
        return;
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: phone!,
        token,
        type: 'sms',
      });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error('Não foi possível iniciar a sessão após a confirmação.');

      setPhoneVerified(true);
      if (channel === 'both') {
        const { error: emailError } = await supabase.auth.updateUser({ email: email! });
        if (emailError) {
          setNotice('Telefone confirmado. A sua conta já está ativa; pode tentar confirmar o e-mail mais tarde.');
          return;
        }
        setStage('email');
        setCode('');
        setCooldown(60);
        setNotice('Telefone confirmado. Enviámos também um código para o e-mail; pode verificá-lo agora ou continuar com o telefone.');
        return;
      }

      goToApp();
    } catch (verificationError: any) {
      setError(verificationError?.message || 'Código inválido ou expirado. Peça um novo código.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setError('');
    setNotice('');
    try {
      if (stage === 'email') {
        const { error: resendError } = await supabase.auth.resend({ type: 'email_change', email: email! });
        if (resendError) throw resendError;
      } else if (primaryIsEmail) {
        const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email! });
        if (resendError) throw resendError;
      } else {
        const { error: resendError } = await supabase.auth.resend({ type: 'sms', phone: phone! });
        if (resendError) throw resendError;
      }
      setCooldown(60);
      setNotice('Enviámos um novo código.');
    } catch (resendError: any) {
      setError(resendError?.message || 'Não foi possível reenviar o código. Tente novamente mais tarde.');
    } finally {
      setResending(false);
    }
  };

  if (!channel) return null;

  const isPhonePrimary = !primaryIsEmail && stage === 'primary';
  const canFinishWithPhone = phoneVerified && channel === 'both';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 24) + 24, paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/register')}>
          <Icon name="chevron-left" size={20} color={COLORS.text} />
          <Text style={styles.backText}>Voltar ao cadastro</Text>
        </TouchableOpacity>

        <View style={styles.iconBadge}>
          <Icon name={stage === 'email' || primaryIsEmail ? 'mail' : 'phone'} size={26} color={COLORS.primary} />
        </View>
        <Text style={styles.eyebrow}>SEGURANÇA DA CONTA</Text>
        <Text style={styles.title}>{stage === 'email' ? 'Confirme o seu e-mail' : 'Confirme o seu contacto'}</Text>
        <Text style={styles.description}>
          Enviámos um código de 6 dígitos para{' '}
          <Text style={styles.address}>{destinationLabel}</Text>.
        </Text>

        {(error || notice) && (
          <View style={[styles.messageBox, error ? styles.errorBox : styles.noticeBox]}>
            <Icon name={error ? 'alert-circle' : 'info'} size={17} color={error ? COLORS.danger : COLORS.primary} />
            <Text style={[styles.messageText, error && styles.errorText]}>{error || notice}</Text>
          </View>
        )}

        {!(phoneVerified && channel === 'both' && !email) && (
          <>
            <Text style={styles.fieldLabel}>Código de verificação</Text>
            <TextInput
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={COLORS.faint}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
              editable={!busy}
              style={styles.codeInput}
              accessibilityLabel={`Código enviado para ${currentAddress}`}
            />

            <Pressable style={[styles.verifyButton, busy && styles.disabled]} onPress={verify} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.verifyText}>Verificar código</Text>}
            </Pressable>

            <TouchableOpacity onPress={resend} disabled={busy || resending || cooldown > 0} style={styles.resendButton}>
              {resending ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <Text style={[styles.resendText, (cooldown > 0 || busy) && styles.resendDisabled]}>
                  {cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {canFinishWithPhone && (
          <Pressable style={styles.finishButton} onPress={goToApp}>
            <Text style={styles.finishText}>Continuar com telefone confirmado</Text>
            <Icon name="arrow-right" size={18} color={COLORS.primary} />
          </Pressable>
        )}

        {isPhonePrimary && (
          <View style={styles.securityNote}>
            <Icon name="shield" size={16} color={COLORS.primary} />
            <Text style={styles.securityText}>
              O telefone confirmado já ativa a sua conta. A confirmação do e-mail é opcional.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24 },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10 },
  backText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  iconBadge: {
    width: 64,
    height: 64,
    marginTop: 56,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: COLORS.soft,
  },
  eyebrow: { marginTop: 26, color: COLORS.primary, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  title: { marginTop: 8, color: COLORS.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  description: { marginTop: 10, color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  address: { color: COLORS.text, fontWeight: '700' },
  messageBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 24, padding: 12, borderRadius: 12 },
  errorBox: { backgroundColor: COLORS.dangerSoft },
  noticeBox: { backgroundColor: COLORS.soft },
  messageText: { flex: 1, color: COLORS.text, fontSize: 12.5, lineHeight: 18 },
  errorText: { color: COLORS.danger },
  fieldLabel: { marginTop: 32, marginBottom: 8, color: COLORS.text, fontSize: 13, fontWeight: '700' },
  codeInput: {
    height: 62,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  verifyButton: {
    height: 54,
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  resendButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  resendText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  resendDisabled: { color: COLORS.faint },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 28, padding: 13, borderRadius: 12, backgroundColor: COLORS.soft },
  securityText: { flex: 1, color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  finishButton: {
    minHeight: 52,
    marginTop: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  finishText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
});