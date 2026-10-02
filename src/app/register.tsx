// src/app/register.tsx
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from '../components/Icon';
import { getMunicipalityLabel, getProvinceLabel, getProvincesForCountry } from '../data/country-locations';
import { signInWithGoogle } from '../lib/googleAuth';
import { supabase } from '../lib/supabase';

const LOGO = require('../../assets/images/Agrilink_SD.png');

// Mesma palette da página de Segurança
const COLORS = {
  primary: '#1F6B3A',
  secondary: '#79C267',
  dark: '#465044',
  text: '#3D403A',
  mid: '#5A5E54',
  muted: '#77796F',
  faint: '#A3A398',
  border: '#E8E5DC',
  field: '#F5F3EC',
  background: '#FBFAF6',
  soft: '#EEF0E9',
  gold: '#B7833D',
  goldSoft: '#F5EEDF',
  danger: '#B95E54',
  dangerSoft: '#F6ECE9',
};

const SHADOW_SOFT = {
  shadowColor: COLORS.dark,
  shadowOpacity: 0.22,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 6,
};

const MIN_PASSWORD = 8;

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);

// Gera um NIF aleatório (13 dígitos, nunca começa por 0)
// para quem não preencher o campo no registo.
const generateRandomNif = () => {
  let nif = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < 13; i++) nif += Math.floor(Math.random() * 10);
  return nif;
};

const steps: { title: string; hint: string; icon: IconName }[] = [
  { title: 'Perfil', hint: 'Quem és tu na plataforma', icon: 'user' },
  { title: 'Contacto', hint: 'Como te encontramos', icon: 'phone' },
  { title: 'Segurança', hint: 'Protege a tua conta', icon: 'lock' },
];

const userTypeOptions: { id: string; label: string; icon: IconName }[] = [
  { id: 'agricultor', label: 'Fornecedor', icon: 'leaf' },
  { id: 'agente', label: 'Agente', icon: 'users' },
  { id: 'comprador', label: 'Comprador', icon: 'cart' },
  { id: 'motorista', label: 'Motorista', icon: 'truck' },
];

// ================================
// COMPONENTES ANIMADOS
// ================================

// Toque que encolhe com mola
function PressScale({
  onPress,
  disabled,
  style,
  containerStyle,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[anim, containerStyle]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => (scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 12, stiffness: 240 }))}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// Campo com borda que anima a cor ao focar
function Field({
  icon,
  focused,
  children,
}: {
  icon: IconName;
  focused: boolean;
  children: React.ReactNode;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(focused ? 1 : 0, { duration: 220 });
  }, [focused]);

  const anim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.value, [0, 1], [COLORS.border, COLORS.primary]),
    backgroundColor: interpolateColor(p.value, [0, 1], [COLORS.field, '#FFFFFF']),
    transform: [{ scale: 1 + p.value * 0.008 }],
  }));

  return (
    <Animated.View style={[styles.inputWrapper, anim]}>
      <View style={styles.inputIcon}>
        <Icon name={icon} size={19} color={focused ? COLORS.primary : COLORS.muted} />
      </View>
      {children}
    </Animated.View>
  );
}

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const [userType, setUserType] = useState('');
  const [fullName, setFullName] = useState('');
  const [identityDocument, setIdentityDocument] = useState('');
  const [loadCapacity, setLoadCapacity] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [wasReferred, setWasReferred] = useState<'nao' | 'sim'>('nao');
  const [agentCode, setAgentCode] = useState('');
  const [agentCodeValid, setAgentCodeValid] = useState<boolean | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);

  const countryCode = 'AO';
  const availableProvinces = getProvincesForCountry(countryCode);
  const provinceLabel = getProvinceLabel(countryCode);
  const municipalityLabel = getMunicipalityLabel(countryCode);
  const availableMunicipalities =
    availableProvinces.find((p) => p.id === selectedProvince)?.municipalities || [];
  const busy = loading || googleLoading;

  // Logo: entra com mola e flutua suavemente
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const logoFloat = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withSpring(1, { damping: 10, stiffness: 110 });
    logoFloat.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }, { translateY: logoFloat.value }],
  }));

  // Barra de progresso animada
  const progressPercent = ((currentStep + 1) / steps.length) * 100;
  const progress = useSharedValue(progressPercent);

  useEffect(() => {
    progress.value = withTiming(progressPercent, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [progressPercent]);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  const validateAgentCode = async (code: string) => {
    if (code.length !== 6) {
      setAgentCodeValid(null);
      return;
    }
    setValidatingCode(true);
    try {
      const { data, error } = await supabase.rpc('validate_agent_code', { p_code: code });
      if (error) throw error;
      setAgentCodeValid(data === true);
    } catch {
      setAgentCodeValid(false);
    } finally {
      setValidatingCode(false);
    }
  };

  const validateCurrentStep = () => {
    if (currentStep === 0 && (!userType || !fullName.trim())) {
      setErrorMessage('Preencha o tipo de conta e o nome completo.');
      return false;
    }
    if (currentStep === 0 && userType === 'motorista' && (!loadCapacity || Number(loadCapacity) <= 0)) {
      setErrorMessage('Indique a capacidade de carga do seu veículo (kg).');
      return false;
    }
    if (currentStep === 1 && (!email.trim() || !phone.trim() || !selectedProvince || !selectedMunicipality)) {
      setErrorMessage('Preencha email, telefone, província e município.');
      return false;
    }
    if (currentStep === 2) {
      if (password.length < MIN_PASSWORD) {
        setErrorMessage(`A senha deve ter pelo menos ${MIN_PASSWORD} caracteres.`);
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMessage('As senhas não coincidem.');
        return false;
      }
      if (wasReferred === 'sim' && !agentCodeValid) {
        setErrorMessage('Código de agente inválido.');
        return false;
      }
    }
    setErrorMessage('');
    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleSubmit = async () => {
    if (currentStep < steps.length - 1) {
      goNext();
      return;
    }
    if (!validateCurrentStep()) return;

    setLoading(true);
    setErrorMessage('');
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();

      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            phone,
            identity_document: identityDocument.trim() || generateRandomNif(),
            user_type: userType,
            load_capacity_kg: userType === 'motorista' && loadCapacity ? Number(loadCapacity) : null,
            province_id: selectedProvince,
            municipality_id: selectedMunicipality,
            referred_by_agent_id: wasReferred === 'sim' && agentCode ? agentCode.toUpperCase() : null,
          },
        },
      });

      if (error) {
        setErrorMessage(
          error.message?.includes('already registered')
            ? 'Este email já está registrado. Tente fazer login.'
            : error.message || 'Não foi possível criar a conta.'
        );
        return;
      }

      Alert.alert('Conta criada!', `Enviámos um link de confirmação para ${cleanEmail}.`);
      router.replace('/login');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro inesperado ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const goPrev = () => {
    setErrorMessage('');
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleGoogleRegister = async () => {
    if (!userType) {
      setErrorMessage('Escolha o tipo de conta antes de continuar com o Google.');
      return;
    }

    try {
      setGoogleLoading(true);
      setErrorMessage('');
      const session = await signInWithGoogle(userType);
      if (session) router.replace('/home');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível criar a conta com o Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleTopBack = () => {
    if (currentStep > 0) goPrev();
    else router.replace('/login');
  };

  const focusProps = (name: string) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top, 24) + 4,
          paddingBottom: Math.max(insets.bottom, 16) + 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        <View style={styles.content}>
          {/* Voltar */}
          <Animated.View entering={FadeIn.duration(500)}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleTopBack}
              disabled={loading}
              activeOpacity={0.5}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Icon name="chevron-left" size={22} color={COLORS.text} />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Logo */}
          <View style={styles.header}>
            <Animated.Image source={LOGO} style={[styles.logo, logoStyle]} resizeMode="contain" />
            <Animated.Text entering={enter(250)} style={styles.title}>
              Cria a tua conta
            </Animated.Text>
            <Animated.Text entering={enter(330)} style={styles.subtitle}>
              Leva menos de dois minutos.
            </Animated.Text>
          </View>

          {errorMessage ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBox}>
              <Icon name="alert-circle" size={17} color={COLORS.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </Animated.View>
          ) : null}

          {/* PROGRESSO */}
          <Animated.View entering={enter(400)} style={styles.progressBlock}>
            <View style={styles.stepper}>
              {steps.map((s, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <View key={s.title} style={styles.stepperItem}>
                    <View
                      style={[
                        styles.stepDot,
                        (done || active) && styles.stepDotOn,
                        active && styles.stepDotActive,
                      ]}
                    >
                      <Icon
                        name={done ? 'check' : s.icon}
                        size={16}
                        color={done || active ? '#FFFFFF' : COLORS.faint}
                      />
                    </View>
                    <Text style={[styles.stepDotLabel, (done || active) && { color: COLORS.primary }]}>
                      {s.title}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepHint}>{steps[currentStep].hint}</Text>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  Passo {currentStep + 1} de {steps.length}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* PASSO 1 */}
          {currentStep === 0 && (
            <Animated.View key="step-0" entering={FadeInRight.duration(350)} style={styles.stepBody}>
              <View>
                <Text style={styles.label}>Tipo de conta</Text>
                <View style={styles.userTypeRow}>
                  {userTypeOptions.map((opt) => {
                    const active = userType === opt.id;
                    return (
                      <PressScale
                        key={opt.id}
                        onPress={() => setUserType(opt.id)}
                        containerStyle={styles.userTypeCell}
                        style={[styles.userTypeBtn, active && styles.userTypeBtnActive]}
                      >
                        <View style={[styles.userTypeIcon, active && styles.userTypeIconActive]}>
                          <Icon name={opt.icon} size={20} color={active ? '#FFFFFF' : COLORS.primary} />
                        </View>
                        <Text style={[styles.userTypeLabel, active && styles.userTypeLabelActive]}>
                          {opt.label}
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleGoogleRegister}
                disabled={busy}
                style={[styles.googleButton, busy && styles.disabled]}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={COLORS.dark} />
                ) : (
                  <>
                    <Text style={styles.googleMark}>G</Text>
                    <Text style={styles.googleButtonText}>Continuar com o Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View>
                <Text style={styles.label}>Nome completo</Text>
                <Field icon="user" focused={focused === 'name'}>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Nome completo"
                    placeholderTextColor={COLORS.faint}
                    style={styles.input}
                    {...focusProps('name')}
                  />
                </Field>
              </View>

              <View>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>Documento de identidade (NIF)</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>Opcional</Text>
                  </View>
                </View>
                <Field icon="card" focused={focused === 'nif'}>
                  <TextInput
                    value={identityDocument}
                    onChangeText={setIdentityDocument}
                    placeholder="000000000AA000"
                    placeholderTextColor={COLORS.faint}
                    autoCapitalize="characters"
                    style={styles.input}
                    {...focusProps('nif')}
                  />
                </Field>
                <View style={styles.hintBox}>
                  <Icon name="info" size={15} color={COLORS.gold} />
                  <Text style={styles.hintText}>
                    Não tens o número à mão? Deixa em branco, preenchemos automaticamente. Podes atualizar depois no perfil.
                  </Text>
                </View>
              </View>

              {userType === 'motorista' && (
                <Animated.View entering={FadeInDown.duration(350)}>
                  <Text style={styles.label}>Capacidade de carga (kg)</Text>
                  <Field icon="truck" focused={focused === 'load'}>
                    <TextInput
                      value={loadCapacity}
                      onChangeText={setLoadCapacity}
                      placeholder="Ex.: 8000"
                      placeholderTextColor={COLORS.faint}
                      keyboardType="numeric"
                      style={styles.input}
                      {...focusProps('load')}
                    />
                  </Field>
                  <View style={styles.hintBox}>
                    <Icon name="info" size={15} color={COLORS.gold} />
                    <Text style={styles.hintText}>
                      Usamos esta capacidade para mostrar apenas cargas compatíveis com o seu veículo.
                    </Text>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* PASSO 2 */}
          {currentStep === 1 && (
            <Animated.View key="step-1" entering={FadeInRight.duration(350)} style={styles.stepBody}>
              <View>
                <Text style={styles.label}>Email</Text>
                <Field icon="mail" focused={focused === 'email'}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="seu@email.com"
                    placeholderTextColor={COLORS.faint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    {...focusProps('email')}
                  />
                </Field>
              </View>

              <View>
                <Text style={styles.label}>Telefone</Text>
                <Field icon="phone" focused={focused === 'phone'}>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="9XX XXX XXX"
                    placeholderTextColor={COLORS.faint}
                    keyboardType="phone-pad"
                    style={styles.input}
                    {...focusProps('phone')}
                  />
                </Field>
              </View>

              <View>
                <Text style={styles.label}>{provinceLabel || 'Província'}</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={selectedProvince}
                    onValueChange={(v) => {
                      setSelectedProvince(v);
                      setSelectedMunicipality('');
                    }}
                  >
                    <Picker.Item label="Selecionar província" value="" />
                    {availableProvinces.map((p) => (
                      <Picker.Item key={p.id} label={p.name} value={p.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View>
                <Text style={styles.label}>{municipalityLabel || 'Município'}</Text>
                <View style={[styles.pickerWrap, !selectedProvince && { opacity: 0.6 }]}>
                  <Picker
                    enabled={!!selectedProvince}
                    selectedValue={selectedMunicipality}
                    onValueChange={setSelectedMunicipality}
                  >
                    <Picker.Item label="Selecionar município" value="" />
                    {availableMunicipalities.map((m) => (
                      <Picker.Item key={m.id} label={m.name} value={m.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </Animated.View>
          )}

          {/* PASSO 3 */}
          {currentStep === 2 && (
            <Animated.View key="step-2" entering={FadeInRight.duration(350)} style={styles.stepBody}>
              <View>
                <Text style={styles.label}>Senha</Text>
                <Field icon="lock" focused={focused === 'pass'}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
                    placeholderTextColor={COLORS.faint}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={styles.input}
                    {...focusProps('pass')}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={19} color={COLORS.muted} />
                  </TouchableOpacity>
                </Field>
              </View>

              <View>
                <Text style={styles.label}>Confirmar senha</Text>
                <Field icon="lock" focused={focused === 'confirm'}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repita a senha"
                    placeholderTextColor={COLORS.faint}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    style={styles.input}
                    {...focusProps('confirm')}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={19} color={COLORS.muted} />
                  </TouchableOpacity>
                </Field>
              </View>

              <View>
                <Text style={styles.label}>Foi indicado por um agente AgriLink?</Text>
                <View style={styles.radioGroup}>
                  {(['nao', 'sim'] as const).map((v) => {
                    const active = wasReferred === v;
                    return (
                      <PressScale
                        key={v}
                        onPress={() => setWasReferred(v)}
                        containerStyle={{ flex: 1 }}
                        style={[styles.radioChip, active && styles.radioChipActive]}
                      >
                        <View style={[styles.radioOuter, active && { borderColor: COLORS.primary }]}>
                          {active && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.radioLabel, active && { color: COLORS.primary }]}>
                          {v === 'nao' ? 'Não' : 'Sim'}
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>

                {wasReferred === 'sim' && (
                  <Animated.View entering={FadeInDown.duration(350)} style={{ marginTop: 14 }}>
                    <Field icon="key" focused={focused === 'agent'}>
                      <TextInput
                        placeholder="Código de 6 dígitos"
                        placeholderTextColor={COLORS.faint}
                        value={agentCode}
                        onChangeText={(v) => {
                          const val = v.toUpperCase().slice(0, 6);
                          setAgentCode(val);
                          if (val.length === 6) validateAgentCode(val);
                          else setAgentCodeValid(null);
                        }}
                        autoCapitalize="characters"
                        style={styles.input}
                        {...focusProps('agent')}
                      />
                    </Field>
                    {validatingCode && <ActivityIndicator style={{ marginTop: 8 }} color={COLORS.primary} />}
                    {agentCodeValid === false && (
                      <View style={styles.codeRow}>
                        <Icon name="close-circle" size={15} color={COLORS.danger} />
                        <Text style={styles.invalidCode}>Código inválido</Text>
                      </View>
                    )}
                    {agentCodeValid === true && (
                      <View style={styles.codeRow}>
                        <Icon name="check-circle" size={15} color={COLORS.primary} />
                        <Text style={styles.validCode}>Código válido</Text>
                      </View>
                    )}
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          )}

          {/* ACÇÕES */}
          <View style={styles.actionsRow}>
            {currentStep > 0 && (
              <PressScale onPress={goPrev} style={styles.prevBtn}>
                <Icon name="arrow-left" size={19} color={COLORS.text} />
              </PressScale>
            )}
            <PressScale
              onPress={handleSubmit}
              disabled={loading}
              containerStyle={{ flex: 1 }}
              style={[styles.submitBtn, loading && styles.disabled]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitText}>
                    {currentStep === steps.length - 1 ? 'Criar conta' : 'Continuar'}
                  </Text>
                  <Icon name="arrow-right" size={18} color="#FFFFFF" />
                </>
              )}
            </PressScale>
          </View>

          {/* LOGIN */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Já tem uma conta?</Text>
            <TouchableOpacity onPress={() => router.replace('/login')} disabled={loading} hitSlop={8}>
              <Text style={styles.loginLink}>Faça login</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, minHeight: 24 }} />

          {/* TERMOS E FOOTER */}
          <View style={styles.legalCard}>
            <Icon name="shield" size={16} color={COLORS.primary} />
            <Text style={styles.legalText}>
              Ao criar conta, aceita os nossos{' '}
              <Text style={styles.legalLink} onPress={() => router.push('/termos')}>
                Termos de Utilização
              </Text>{' '}
              e a{' '}
              <Text style={styles.legalLink} onPress={() => router.push('/privacidade')}>
                Política de Privacidade
              </Text>
              .
            </Text>
          </View>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} AgriLink · Desenvolvida pela{' '}
            <Text style={styles.footerBrand}>THE TEAM</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =====================================================
// ESTILOS
// =====================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: -4,
    paddingVertical: 8,
    paddingRight: 12,
    gap: 2,
  },
  backText: { fontSize: 15.5, fontWeight: '600', color: COLORS.text },

  header: { alignItems: 'center', marginTop: 4, marginBottom: 24 },
  logo: { width: 96, height: 96 },
  title: {
    marginTop: 14,
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14.5, color: COLORS.muted, textAlign: 'center', marginTop: 6 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: COLORS.danger, fontSize: 13, fontWeight: '700', flex: 1 },

  progressBlock: { marginBottom: 22 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  stepperItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.field,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepDotActive: { ...SHADOW_SOFT, shadowOpacity: 0.18, elevation: 4 },
  stepDotLabel: { fontSize: 11.5, fontWeight: '700', color: COLORS.faint },

  progressTrack: { height: 6, borderRadius: 999, backgroundColor: COLORS.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.primary },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  stepHint: { flex: 1, fontSize: 12.5, color: COLORS.muted },
  stepBadge: { backgroundColor: COLORS.soft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  stepBadgeText: { fontSize: 10.5, fontWeight: '800', color: COLORS.primary },

  stepBody: { gap: 16 },

  label: { fontSize: 13.5, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optionalBadge: { backgroundColor: COLORS.goldSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  optionalText: { fontSize: 10, fontWeight: '800', color: COLORS.gold },

  inputWrapper: {
    height: 54,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: { marginLeft: 16 },
  input: { flex: 1, height: '100%', fontSize: 15.5, color: COLORS.text, paddingHorizontal: 12 },
  eyeButton: { paddingHorizontal: 16, height: '100%', justifyContent: 'center', alignItems: 'center' },

  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.goldSoft,
  },
  hintText: { flex: 1, fontSize: 11.5, color: COLORS.mid, lineHeight: 17 },

  pickerWrap: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.field,
    overflow: 'hidden',
  },

  userTypeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  userTypeCell: { width: '48%' },
  userTypeBtn: {
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.field,
    alignItems: 'center',
    gap: 8,
  },
  userTypeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.soft },
  userTypeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTypeIconActive: { backgroundColor: COLORS.primary },
  userTypeLabel: { fontSize: 12.5, fontWeight: '700', color: COLORS.mid },
  userTypeLabelActive: { color: COLORS.primary },

  googleButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleMark: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  radioGroup: { flexDirection: 'row', gap: 10, marginTop: 2 },
  radioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.field,
  },
  radioChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.soft },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  radioLabel: { fontSize: 14, fontWeight: '700', color: COLORS.mid },

  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  invalidCode: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  validCode: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 26 },
  prevBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    height: 54,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOW_SOFT,
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },

  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  loginText: { fontSize: 14, color: COLORS.muted },
  loginLink: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginLeft: 6 },

  legalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.field,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  legalText: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.muted },
  legalLink: { color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },

  footerText: { fontSize: 11.5, color: '#8A968C', textAlign: 'center', marginTop: 14 },
  footerBrand: { fontWeight: '800', color: COLORS.dark, letterSpacing: 0.5 },
});