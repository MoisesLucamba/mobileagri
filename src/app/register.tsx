// src/app/register.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  StatusBar,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getProvincesForCountry, getProvinceLabel, getMunicipalityLabel } from '../data/country-locations';

const LOGO = require('../../assets/images/Agrilink_SD.png');
const HERO = require('../../assets/images/agricultor.jpg');

// Substitui pelos links reais da plataforma
const TERMS_URL = 'https://agrilink.ao/termos';
const PRIVACY_URL = 'https://agrilink.ao/privacidade';

const { height } = Dimensions.get('window');
const HERO_HEIGHT = Math.max(140, height * 0.18);
const LOGO_SIZE = 84;

const COLORS = {
  primary: '#1F6B3A',
  secondary: '#79C267',
  dark: '#173D24',
  text: '#173D24',
  mid: '#34503B',
  muted: '#627264',
  border: '#DCE5DD',
  field: '#F6F9F6',
  background: '#FFFFFF',
  tint: '#EAF5E6',
  gold: '#B5670F',
  goldBg: '#FFF6E5',
  goldBorder: 'rgba(229,160,32,0.28)',
};

// Gera um NIF aleatório (13 dígitos, nunca começa por 0)
// para quem não preencher o campo no registo.
const generateRandomNif = () => {
  let nif = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < 13; i++) nif += Math.floor(Math.random() * 10);
  return nif;
};

const steps = [
  { title: 'Perfil', hint: 'Quem és tu na plataforma' },
  { title: 'Contacto', hint: 'Como te encontramos' },
  { title: 'Segurança', hint: 'Protege a tua conta' },
];

const userTypeOptions = [
  { id: 'agricultor', label: 'Fornecedor', icon: 'leaf-outline' as const },
  { id: 'agente', label: 'Agente', icon: 'briefcase-outline' as const },
  { id: 'comprador', label: 'Comprador', icon: 'business-outline' as const },
  { id: 'motorista', label: 'Motorista', icon: 'car-outline' as const },
];

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
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

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o link.')
    );
  };

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
      if (password.length < 6) {
        setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
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

  const handleTopBack = () => {
    if (currentStep > 0) {
      setErrorMessage('');
      setCurrentStep((s) => s - 1);
    } else {
      router.replace('/login');
    }
  };

  const progressPercent = ((currentStep + 1) / steps.length) * 100;
  const fieldStyle = (name: string) => [styles.inputWrapper, focused === name && styles.inputFocused];
  const focusProps = (name: string) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Imagem no topo */}
      <View style={styles.hero}>
        <Image source={HERO} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.heroOverlay} />
      </View>

      <TouchableOpacity
        style={[styles.topBackBtn, { top: Math.max(insets.top, 24) + 8 }]}
        onPress={handleTopBack}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Painel */}
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.logoWrap}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Cria a tua conta</Text>
          <Text style={styles.subtitle}>Leva menos de dois minutos.</Text>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={17} color="#B91C1C" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* PROGRESSO */}
          <View style={styles.progressBlock}>
            <View style={styles.stepRow}>
              <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  Passo {currentStep + 1} de {steps.length}
                </Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.stepHint}>{steps[currentStep].hint}</Text>
          </View>

          {/* PASSO 1 */}
          {currentStep === 0 && (
            <View style={styles.stepBody}>
              <View>
                <Text style={styles.label}>Tipo de conta</Text>
                <View style={styles.userTypeRow}>
                  {userTypeOptions.map((opt) => {
                    const active = userType === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => setUserType(opt.id)}
                        activeOpacity={0.85}
                        style={[styles.userTypeBtn, active && styles.userTypeBtnActive]}
                      >
                        <View style={[styles.userTypeIcon, active && styles.userTypeIconActive]}>
                          <Ionicons
                            name={opt.icon}
                            size={20}
                            color={active ? '#FFFFFF' : COLORS.primary}
                          />
                        </View>
                        <Text style={[styles.userTypeLabel, active && styles.userTypeLabelActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={styles.label}>Nome completo</Text>
                <View style={fieldStyle('name')}>
                  <Ionicons name="person-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Nome completo"
                    placeholderTextColor="#9AA79C"
                    style={styles.input}
                    {...focusProps('name')}
                  />
                </View>
              </View>

              <View>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>Documento de identidade (NIF)</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>Opcional</Text>
                  </View>
                </View>
                <View style={fieldStyle('nif')}>
                  <Ionicons name="card-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
                  <TextInput
                    value={identityDocument}
                    onChangeText={setIdentityDocument}
                    placeholder="000000000AA000"
                    placeholderTextColor="#9AA79C"
                    autoCapitalize="characters"
                    style={styles.input}
                    {...focusProps('nif')}
                  />
                </View>
                <View style={styles.hintBox}>
                  <Text style={styles.hintText}>
                    Não tens o número à mão? Deixa em branco, preenchemos automaticamente. Podes atualizar depois no perfil.
                  </Text>
                </View>
              </View>

              {userType === 'motorista' && (
                <View>
                  <Text style={styles.label}>Capacidade de carga (kg)</Text>
                  <View style={fieldStyle('load')}>
                    <Ionicons name="car-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
                    <TextInput
                      value={loadCapacity}
                      onChangeText={setLoadCapacity}
                      placeholder="Ex.: 8000"
                      placeholderTextColor="#9AA79C"
                      keyboardType="numeric"
                      style={styles.input}
                      {...focusProps('load')}
                    />
                  </View>
                  <View style={styles.hintBox}>
                    <Text style={styles.hintText}>
                      Usamos esta capacidade para mostrar apenas cargas compatíveis com o seu veículo.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* PASSO 2 */}
          {currentStep === 1 && (
            <View style={styles.stepBody}>
              <View>
                <Text style={styles.label}>Email</Text>
                <View style={fieldStyle('email')}>
                  <Ionicons name="mail-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="seu@email.com"
                    placeholderTextColor="#9AA79C"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    {...focusProps('email')}
                  />
                </View>
              </View>

              <View>
                <Text style={styles.label}>Telefone</Text>
                <View style={fieldStyle('phone')}>
                  <Ionicons name="call-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="9XX XXX XXX"
                    placeholderTextColor="#9AA79C"
                    keyboardType="phone-pad"
                    style={styles.input}
                    {...focusProps('phone')}
                  />
                </View>
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
                <View style={styles.pickerWrap}>
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
            </View>
          )}

          {/* PASSO 3 */}
          {currentStep === 2 && (
            <View style={styles.stepBody}>
              <View>
                <Text style={styles.label}>Senha</Text>
                <View style={fieldStyle('pass')}>
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor="#9AA79C"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={styles.input}
                    {...focusProps('pass')}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={21}
                      color={COLORS.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text style={styles.label}>Confirmar senha</Text>
                <View style={fieldStyle('confirm')}>
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repita a senha"
                    placeholderTextColor="#9AA79C"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    style={styles.input}
                    {...focusProps('confirm')}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={21}
                      color={COLORS.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text style={styles.label}>Foi indicado por um agente AgriLink?</Text>
                <View style={styles.radioGroup}>
                  {(['nao', 'sim'] as const).map((v) => {
                    const active = wasReferred === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        onPress={() => setWasReferred(v)}
                        activeOpacity={0.85}
                        style={[styles.radioChip, active && styles.radioChipActive]}
                      >
                        <View style={[styles.radioOuter, active && { borderColor: COLORS.primary }]}>
                          {active && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.radioLabel, active && { color: COLORS.primary }]}>
                          {v === 'nao' ? 'Não' : 'Sim'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {wasReferred === 'sim' && (
                  <View style={{ marginTop: 14 }}>
                    <View style={fieldStyle('agent')}>
                      <Ionicons name="key-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
                      <TextInput
                        placeholder="Código de 6 dígitos"
                        placeholderTextColor="#9AA79C"
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
                    </View>
                    {validatingCode && <ActivityIndicator style={{ marginTop: 8 }} color={COLORS.primary} />}
                    {agentCodeValid === false && <Text style={styles.invalidCode}>Código inválido</Text>}
                    {agentCodeValid === true && <Text style={styles.validCode}>Código válido</Text>}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ACÇÕES */}
          <View style={styles.actionsRow}>
            {currentStep > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setErrorMessage('');
                  setCurrentStep((s) => s - 1);
                }}
                style={styles.prevBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={19} color={COLORS.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              style={[styles.submitBtn, loading && styles.disabled]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitText}>
                    {currentStep === steps.length - 1 ? 'Criar conta' : 'Continuar'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* LOGIN */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Já tem uma conta?</Text>
            <TouchableOpacity onPress={() => router.replace('/login')} disabled={loading}>
              <Text style={styles.loginLink}>Faça login</Text>
            </TouchableOpacity>
          </View>

          {/* TERMOS E POLÍTICAS */}
          <Text style={styles.legalText}>
            Ao criar conta, aceita os nossos{' '}
            <Text style={styles.legalLink} onPress={() => openLink(TERMS_URL)}>
              Termos de Utilização
            </Text>{' '}
            e a{' '}
            <Text style={styles.legalLink} onPress={() => openLink(PRIVACY_URL)}>
              Política de Privacidade
            </Text>
            .
          </Text>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>© {new Date().getFullYear()} AgriLink</Text>
            <Text style={styles.footerText}>
              Desenvolvida pela <Text style={styles.footerBrand}>THE TEAM</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// =====================================================
// ESTILOS
// =====================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT + 40,
    overflow: 'hidden',
    backgroundColor: '#0A2814',
  },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 40, 20, 0.28)' },

  topBackBtn: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 40, 20, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 10,
  },

  sheet: {
    position: 'absolute',
    top: HERO_HEIGHT,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    shadowColor: '#0A2814',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },

  logoWrap: {
    position: 'absolute',
    top: -LOGO_SIZE / 2,
    alignSelf: 'center',
    zIndex: 5,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: `${COLORS.secondary}55`,
    shadowColor: '#0A2814',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  logo: { width: LOGO_SIZE - 24, height: LOGO_SIZE - 24 },

  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: LOGO_SIZE / 2 + 14,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  title: { fontSize: 25, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 14.5, color: COLORS.muted, textAlign: 'center', marginTop: 6, marginBottom: 20 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600', flex: 1 },

  progressBlock: { marginBottom: 20 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stepTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  stepBadge: { backgroundColor: COLORS.tint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  stepBadgeText: { fontSize: 10.5, fontWeight: '800', color: COLORS.primary },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: COLORS.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.primary },
  stepHint: { fontSize: 12, color: COLORS.muted, marginTop: 8 },

  stepBody: { gap: 16 },

  label: { fontSize: 13.5, fontWeight: '700', color: COLORS.text, marginBottom: 7 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  optionalBadge: { backgroundColor: COLORS.goldBg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  optionalText: { fontSize: 10, fontWeight: '800', color: COLORS.gold },

  inputWrapper: {
    height: 54,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.field,
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: '#FFFFFF' },
  inputIcon: { marginLeft: 15 },
  input: { flex: 1, height: '100%', fontSize: 15, color: COLORS.text, paddingHorizontal: 12 },
  eyeButton: { paddingHorizontal: 15, height: '100%', justifyContent: 'center', alignItems: 'center' },

  hintBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.goldBg,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  hintText: { fontSize: 11.5, color: COLORS.mid, lineHeight: 17 },

  pickerWrap: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.field,
    overflow: 'hidden',
  },

  userTypeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  userTypeBtn: {
    width: '48%',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.field,
    alignItems: 'center',
    gap: 8,
  },
  userTypeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.tint },
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

  radioGroup: { flexDirection: 'row', gap: 10, marginTop: 2 },
  radioChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.field,
  },
  radioChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.tint },
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

  invalidCode: { fontSize: 12, fontWeight: '700', color: '#DC2626', marginTop: 8 },
  validCode: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginTop: 8 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 26 },
  prevBtn: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    flex: 1,
    height: 56,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#173D24',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.65 },

  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  loginText: { fontSize: 14, color: COLORS.muted },
  loginLink: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginLeft: 5 },

  legalText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 8,
  },
  legalLink: { color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },

  footer: { alignItems: 'center', marginTop: 22, gap: 3 },
  footerText: { fontSize: 11.5, color: '#8A968C' },
  footerBrand: { fontWeight: '800', color: COLORS.dark, letterSpacing: 0.5 },
});