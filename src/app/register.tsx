import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { T } from '../constants/theme';
import { getProvincesForCountry, getProvinceLabel, getMunicipalityLabel } from '../data/country-locations';
import Logo from '../assets/images/logo.jpeg';

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

// Quatro tipos de conta — os mesmos do registo web (agricultor, agente,
// comprador, motorista). O motorista tinha ficado de fora do mobile.
const userTypeOptions = [
  { id: 'agricultor', label: 'Fornecedor', icon: 'leaf-outline' as const },
  { id: 'agente', label: 'Agente', icon: 'briefcase-outline' as const },
  { id: 'comprador', label: 'Comprador', icon: 'business-outline' as const },
  { id: 'motorista', label: 'Motorista', icon: 'car-outline' as const },
];

export default function Register() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
    availableProvinces.find(p => p.id === selectedProvince)?.municipalities || [];

  const validateAgentCode = async (code: string) => {
    if (code.length !== 6) { setAgentCodeValid(null); return; }
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
    setCurrentStep(s => Math.min(s + 1, steps.length - 1));
  };

  const handleSubmit = async () => {
    if (currentStep < steps.length - 1) { goNext(); return; }
    if (!validateCurrentStep()) return;

    setLoading(true);
    setErrorMessage('');
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            phone,
            // Se o utilizador não preencheu o NIF, gera um aleatório
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

  const progressPercent = ((currentStep + 1) / steps.length) * 100;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <Image
          source={Logo}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Cria a tua conta</Text>
        <Text style={styles.subtitle}>Leva menos de dois minutos.</Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="close" size={15} color="#B91C1C" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={{ marginBottom: 20 }}>
          <View style={styles.stepRow}>
            <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>Passo {currentStep + 1} de {steps.length}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.stepHint}>{steps[currentStep].hint}</Text>
        </View>

        {currentStep === 0 && (
          <View style={{ gap: 18 }}>
            <View>
              <Text style={styles.label}>Tipo de Conta</Text>
              <View style={styles.userTypeRow}>
                {userTypeOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setUserType(opt.id)}
                    style={[styles.userTypeBtn, userType === opt.id && styles.userTypeBtnActive]}
                  >
                    <Ionicons name={opt.icon} size={20} color={userType === opt.id ? T.g700 : T.muted} />
                    <Text style={[styles.userTypeLabel, userType === opt.id && { color: T.g700 }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={styles.label}>Nome Completo</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nome completo"
                placeholderTextColor={T.muted}
                style={styles.input}
              />
            </View>

            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Documento de Identidade (NIF)</Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalText}>Opcional</Text>
                </View>
              </View>
              <TextInput
                value={identityDocument}
                onChangeText={setIdentityDocument}
                placeholder="000000000AA000 (opcional)"
                placeholderTextColor={T.muted}
                style={styles.input}
              />
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                  Não tens o número à mão? Deixa em branco — preenchemos automaticamente. Podes atualizar depois no perfil.
                </Text>
              </View>
            </View>

            {/* Capacidade de carga — só para motoristas, tal como no registo web */}
            {userType === 'motorista' && (
              <View>
                <Text style={styles.label}>Capacidade de carga (kg)</Text>
                <View style={{ position: 'relative' }}>
                  <Ionicons
                    name="car-outline"
                    size={17}
                    color={T.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={loadCapacity}
                    onChangeText={setLoadCapacity}
                    placeholder="Ex.: 8000"
                    placeholderTextColor={T.muted}
                    keyboardType="numeric"
                    style={[styles.input, { paddingLeft: 42 }]}
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

        {currentStep === 1 && (
          <View style={{ gap: 18 }}>
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={T.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
            <View>
              <Text style={styles.label}>Telefone</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="9XX XXX XXX"
                placeholderTextColor={T.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>
            <View>
              <Text style={styles.label}>{provinceLabel || 'Província'}</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={selectedProvince}
                  onValueChange={v => { setSelectedProvince(v); setSelectedMunicipality(''); }}
                >
                  <Picker.Item label="Selecionar província" value="" />
                  {availableProvinces.map(p => (
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
                  {availableMunicipalities.map(m => (
                    <Picker.Item key={m.id} label={m.name} value={m.id} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        )}

        {currentStep === 2 && (
          <View style={{ gap: 18 }}>
            <View>
              <Text style={styles.label}>Senha</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={T.muted}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={T.muted} />
                </TouchableOpacity>
              </View>
            </View>
            <View>
              <Text style={styles.label}>Confirmar Senha</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  placeholderTextColor={T.muted}
                  secureTextEntry={!showConfirmPassword}
                  style={styles.input}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={T.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text style={styles.label}>Foi indicado por um agente AgriLink?</Text>
              <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
                {(['nao', 'sim'] as const).map(v => (
                  <TouchableOpacity key={v} onPress={() => setWasReferred(v)} style={styles.radioRow}>
                    <View style={[styles.radioOuter, wasReferred === v && { borderColor: T.g600 }]}>
                      {wasReferred === v && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioLabel}>{v === 'nao' ? 'Não' : 'Sim'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {wasReferred === 'sim' && (
                <View style={{ marginTop: 14 }}>
                  <TextInput
                    placeholder="Código de 6 dígitos"
                    placeholderTextColor={T.muted}
                    value={agentCode}
                    onChangeText={v => {
                      const val = v.toUpperCase().slice(0, 6);
                      setAgentCode(val);
                      if (val.length === 6) validateAgentCode(val);
                      else setAgentCodeValid(null);
                    }}
                    autoCapitalize="characters"
                    style={styles.input}
                  />
                  {validatingCode && <ActivityIndicator style={{ marginTop: 6 }} color={T.g600} />}
                  {agentCodeValid === false && (
                    <Text style={styles.invalidCode}>Código inválido</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.actionsRow}>
          {currentStep > 0 && (
            <TouchableOpacity
              onPress={() => { setErrorMessage(''); setCurrentStep(s => s - 1); }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={18} color={T.ink} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.submitBtn, loading && { backgroundColor: T.muted }]}
          >
            {loading ? (
              <ActivityIndicator color={T.white} />
            ) : (
              <>
                <Text style={styles.submitText}>
                  {currentStep === steps.length - 1 ? 'Criar conta' : 'Continuar'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={T.white} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
          <Text style={{ color: T.muted, fontSize: 13 }}>Já tem uma conta? </Text>
          <Link href="/login" style={{ color: T.g600, fontWeight: '700', fontSize: 13 }}>
            Faça Login
          </Link>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 160,
    height: 60,
    alignSelf: 'center',
    marginBottom: 20,
  },
  container: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: '800', color: T.ink, marginBottom: 6 },
  subtitle: { fontSize: 14, color: T.muted, marginBottom: 24 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 14, padding: 12, marginBottom: 18,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600', flex: 1 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  stepTitle: { fontSize: 12, fontWeight: '800', color: T.ink },
  stepBadge: { backgroundColor: T.goldBg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
  stepBadgeText: { fontSize: 10, fontWeight: '800', color: T.gold },
  progressTrack: { height: 5, borderRadius: 999, backgroundColor: T.rule, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: T.g600 },
  stepHint: { fontSize: 12, color: T.muted, marginTop: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: T.muted, marginBottom: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  optionalBadge: { backgroundColor: T.goldBg, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
  optionalText: { fontSize: 9, fontWeight: '800', color: T.gold },
  input: {
    height: 50, borderRadius: 14, borderWidth: 1, borderColor: T.rule,
    backgroundColor: T.white, paddingHorizontal: 16, fontSize: 15, color: T.ink,
  },
  inputIcon: { position: 'absolute', left: 14, top: 16, zIndex: 1 },
  eyeBtn: { position: 'absolute', right: 14, top: 16 },
  hintBox: { marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: T.goldBg, borderWidth: 1, borderColor: 'rgba(229,160,32,0.28)' },
  hintText: { fontSize: 11.5, color: T.mid, lineHeight: 17 },
  pickerWrap: { borderWidth: 1, borderColor: T.rule, borderRadius: 14, backgroundColor: T.white, overflow: 'hidden' },
  // Grelha 2x2 — com 4 tipos de conta, uma única fila (flex:1 cada) ficava
  // demasiado apertada; agora cada botão ocupa ~48% da largura e quebra linha.
  userTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  userTypeBtn: {
    width: '48%', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: T.rule,
    backgroundColor: T.white, alignItems: 'center', gap: 6,
  },
  userTypeBtnActive: { borderColor: T.g600, backgroundColor: T.g50 },
  userTypeLabel: { fontSize: 11, fontWeight: '700', color: T.mid },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: T.rule, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.g600 },
  radioLabel: { fontSize: 14, fontWeight: '600', color: T.mid },
  invalidCode: { fontSize: 11, fontWeight: '700', color: '#dc2626', marginTop: 6 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 26 },
  backBtn: { width: 52, height: 52, borderRadius: 999, borderWidth: 1, borderColor: T.rule, backgroundColor: T.white, alignItems: 'center', justifyContent: 'center' },
  submitBtn: {
    flex: 1, height: 52, borderRadius: 999, backgroundColor: T.g600,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitText: { color: T.white, fontSize: 15, fontWeight: '700' },
});