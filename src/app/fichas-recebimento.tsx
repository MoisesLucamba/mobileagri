// app/fichas-recebimento.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';
import RoleGuard from '../components/RoleGuard';
import MapPicker, { Coords, PickedLocation } from '../components/MapPicker';

// Paleta partilhada com Home, ProductCard, Pesquisa, Perfil e Pagamento
const T = {
  green: '#2E8B4F',
  greenDark: '#25703F',
  greenPale: '#E9F5EC',
  charcoal: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  border: '#E8ECE6',
  cream: '#F6F8F5',
  field: '#F9FAF8',
  white: '#FFFFFF',
};

const STEPS = [
  { id: 0, label: 'Negócio', icon: 'business-outline' },
  { id: 1, label: 'Produto', icon: 'cube-outline' },
  { id: 2, label: 'Entrega', icon: 'car-outline' },
  { id: 3, label: 'Contacto', icon: 'call-outline' },
  { id: 4, label: 'Resumo', icon: 'document-text-outline' },
] as const;

const TIPOS_NEGOCIO = [
  'Restaurante', 'Bar', 'Supermercado', 'Minimercado', 'Armazém',
  'Mercado Informal', 'Hotel', 'Fábrica', 'Exportação', 'Distribuição',
];

const PRODUTOS = [
  'Batata', 'Mandioca', 'Inhame', 'Alface', 'Couve', 'Espinafre',
  'Manga', 'Banana', 'Laranja', 'Milho', 'Feijão', 'Arroz',
  'Trigo', 'Carne Bovina', 'Carne Suína', 'Frango', 'Peixe',
];

const EMBALAGENS = [
  { v: 'saco30', l: 'Saco 30kg' },
  { v: 'saco50', l: 'Saco 50kg' },
  { v: 'saco1t', l: 'Saco 1 ton' },
  { v: 'cesta10', l: 'Cesta 10kg' },
  { v: 'caixa20', l: 'Caixa 20kg' },
  { v: 'vacuo', l: 'Embalagem a vácuo' },
  { v: 'granel', l: 'A granel' },
];

interface LocalEntrega {
  descricao: string;
  coordenadas: { lat: number; lng: number } | null;
}

function FichaRecebimentoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    nomeFicha: '',
    tipoNegocio: '',
    produto: '',
    qualidade: '',
    embalagem: '',
    transporte: '',
    locaisEntrega: [] as LocalEntrega[],
    telefone: '',
    descricaoFinal: '',
    observacoes: '',
  });

  const [localTemp, setLocalTemp] = useState<LocalEntrega>({
    descricao: '',
    coordenadas: null,
  });

  const set = (key: keyof typeof formData, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const canAdvance = () => {
    switch (step) {
      case 0:
        return formData.nomeFicha.trim() && formData.tipoNegocio;
      case 1:
        return !!formData.produto;
      default:
        return true;
    }
  };

  // O mapa vem do componente MapPicker (o mesmo usado no pagamento)
  const handlePicked = ({ lat, lng, address }: PickedLocation) => {
    setLocalTemp((p) => ({
      descricao: p.descricao.trim() ? p.descricao : address || p.descricao,
      coordenadas: { lat, lng },
    }));
    setPickerOpen(false);
  };

  const addLocal = () => {
    if (localTemp.descricao.trim() && localTemp.coordenadas) {
      set('locaisEntrega', [...formData.locaisEntrega, localTemp]);
      setLocalTemp({ descricao: '', coordenadas: null });
    } else {
      Alert.alert('Faltam dados', 'Preenche a descrição e marca o local no mapa.');
    }
  };

  const removeLocal = (index: number) => {
    set('locaisEntrega', formData.locaisEntrega.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Sessão necessária',
          'Cria a tua conta para enviar esta ficha aos fornecedores.',
          [{ text: 'Iniciar sessão', onPress: () => router.push('/login') }]
        );
        return;
      }

      const { data: inserted, error } = await supabase
        .from('fichas_recebimento')
        .insert([
          {
            user_id: user.id,
            nome_ficha: formData.nomeFicha,
            tipo_negocio: formData.tipoNegocio,
            produto: formData.produto,
            qualidade: formData.qualidade,
            embalagem: formData.embalagem,
            transporte: formData.transporte,
            locais_entrega: formData.locaisEntrega,
            telefone: formData.telefone,
            descricao_final: formData.descricaoFinal,
            observacoes: formData.observacoes,
          },
        ])
        .select('id')
        .single();

      if (error) throw error;

      if (inserted?.id) {
        supabase.functions
          .invoke('verify-product-ficha', { body: { ficha_id: inserted.id } })
          .catch((e) => console.warn('verify error', e));
      }

      Alert.alert('Ficha criada', 'A ficha de recebimento foi criada com sucesso.');
      router.back();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erro ao salvar', err.message ?? 'Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View>
            <Field label="Nome da Ficha *" hint="Um nome descritivo para identificar esta ficha.">
              <TextInput
                style={styles.input}
                placeholder="Ex.: Milho Premium Luanda"
                placeholderTextColor={T.faint}
                value={formData.nomeFicha}
                onChangeText={(v) => set('nomeFicha', v)}
              />
            </Field>
            <Field label="Tipo de Negócio *">
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.tipoNegocio}
                  onValueChange={(v) => set('tipoNegocio', v)}
                >
                  <Picker.Item label="Selecionar" value="" />
                  {TIPOS_NEGOCIO.map((t) => (
                    <Picker.Item key={t} label={t} value={t.toLowerCase()} />
                  ))}
                </Picker>
              </View>
            </Field>
          </View>
        );

      case 1:
        return (
          <View>
            <Field label="Produto Principal *">
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.produto}
                  onValueChange={(v) => set('produto', v)}
                >
                  <Picker.Item label="Selecionar" value="" />
                  {PRODUTOS.map((p) => (
                    <Picker.Item key={p} label={p} value={p.toLowerCase()} />
                  ))}
                </Picker>
              </View>
            </Field>

            <View style={styles.row}>
              <Field label="Padrões de Qualidade" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Ex.: Fresco, sem defeitos"
                  placeholderTextColor={T.faint}
                  value={formData.qualidade}
                  onChangeText={(v) => set('qualidade', v)}
                />
              </Field>
              <Field label="Embalagem" style={{ flex: 1 }}>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={formData.embalagem}
                    onValueChange={(v) => set('embalagem', v)}
                  >
                    <Picker.Item label="Selecionar" value="" />
                    {EMBALAGENS.map((o) => (
                      <Picker.Item key={o.v} label={o.l} value={o.v} />
                    ))}
                  </Picker>
                </View>
              </Field>
            </View>

            <Field label="Transporte Preferido">
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.transporte}
                  onValueChange={(v) => set('transporte', v)}
                >
                  <Picker.Item label="Selecionar" value="" />
                  <Picker.Item label="Próprio" value="proprio" />
                  <Picker.Item label="Terceiros" value="terceiros" />
                  <Picker.Item label="Via AgriLink" value="agrilink" />
                  <Picker.Item label="A combinar" value="combinar" />
                </Picker>
              </View>
            </Field>
          </View>
        );

      case 2:
        return (
          <View>
            <Field label="Descrição do Local">
              <TextInput
                style={styles.input}
                placeholder="Ex.: Armazém Viana, Luanda Sul"
                placeholderTextColor={T.faint}
                value={localTemp.descricao}
                onChangeText={(v) => setLocalTemp((p) => ({ ...p, descricao: v }))}
              />
            </Field>

            {/* Mapa através do componente MapPicker */}
            <TouchableOpacity
              style={[styles.mapBtn, localTemp.coordenadas && styles.mapBtnOn]}
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.85}
            >
              <View style={[styles.mapBtnIcon, localTemp.coordenadas && styles.mapBtnIconOn]}>
                <Ionicons
                  name={localTemp.coordenadas ? 'checkmark' : 'location-outline'}
                  size={18}
                  color={localTemp.coordenadas ? '#fff' : T.green}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapBtnTitle}>
                  {localTemp.coordenadas ? 'Local marcado no mapa' : 'Escolher no mapa'}
                </Text>
                <Text style={styles.mapBtnSub} numberOfLines={1}>
                  {localTemp.coordenadas
                    ? `${localTemp.coordenadas.lat.toFixed(5)}, ${localTemp.coordenadas.lng.toFixed(5)} · toca para alterar`
                    : 'Marca ou pesquisa o local exato da entrega'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={T.faint} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.addLocalBtn} onPress={addLocal} activeOpacity={0.85}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addLocalBtnText}>Adicionar Local de Entrega</Text>
            </TouchableOpacity>

            {formData.locaisEntrega.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.fieldLabel}>
                  Locais adicionados ({formData.locaisEntrega.length})
                </Text>
                {formData.locaisEntrega.map((local, i) => (
                  <View key={i} style={styles.localRow}>
                    <Ionicons name="location-outline" size={16} color={T.green} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: T.charcoal }}>
                        {local.descricao}
                      </Text>
                      <Text style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>
                        {local.coordenadas?.lat.toFixed(4)}, {local.coordenadas?.lng.toFixed(4)}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeLocal(i)} hitSlop={10}>
                      <Ionicons name="close" size={18} color={T.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      case 3:
        return (
          <View>
            <Field label="Telefone para Contacto">
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="+244 999 999 999"
                placeholderTextColor={T.faint}
                value={formData.telefone}
                onChangeText={(v) => set('telefone', v)}
              />
            </Field>
            <Field label="Descrição Final">
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Requisitos adicionais para o fornecedor..."
                placeholderTextColor={T.faint}
                multiline
                value={formData.descricaoFinal}
                onChangeText={(v) => set('descricaoFinal', v)}
              />
            </Field>
            <Field label="Observações">
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Informações complementares, links úteis..."
                placeholderTextColor={T.faint}
                multiline
                value={formData.observacoes}
                onChangeText={(v) => set('observacoes', v)}
              />
            </Field>
          </View>
        );

      case 4:
        return (
          <View>
            <Text style={styles.hint}>Revê os dados antes de submeter.</Text>

            {[
              { label: 'Nome da Ficha', value: formData.nomeFicha },
              { label: 'Tipo de Negócio', value: formData.tipoNegocio },
              { label: 'Produto', value: formData.produto },
              { label: 'Qualidade', value: formData.qualidade || '—' },
              { label: 'Embalagem', value: formData.embalagem || '—' },
              { label: 'Transporte', value: formData.transporte || '—' },
              { label: 'Telefone', value: formData.telefone || '—' },
            ].map((item) => (
              <View key={item.label} style={styles.summaryRow}>
                <Text style={{ fontSize: 13, color: T.muted }}>{item.label}</Text>
                <Text
                  style={{ fontSize: 13, fontWeight: '700', color: T.charcoal, flexShrink: 1, textAlign: 'right', marginLeft: 12 }}
                >
                  {item.value}
                </Text>
              </View>
            ))}

            {formData.locaisEntrega.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.fieldLabel}>
                  Locais de Entrega ({formData.locaisEntrega.length})
                </Text>
                {formData.locaisEntrega.map((local, i) => (
                  <View key={i} style={styles.summaryLocalRow}>
                    <Ionicons name="location-outline" size={14} color={T.green} />
                    <Text style={{ fontSize: 13, color: T.charcoal, marginLeft: 6, flex: 1 }}>
                      {local.descricao}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {!!formData.descricaoFinal && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.fieldLabel}>Descrição Final</Text>
                <Text style={{ fontSize: 13, color: T.muted, lineHeight: 19 }}>{formData.descricaoFinal}</Text>
              </View>
            )}
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <StatusBar barStyle="dark-content" backgroundColor={T.white} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color={T.greenDark} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Nova Ficha de Recebimento</Text>
          <Text style={styles.headerSubtitle}>
            Passo {step + 1} de {STEPS.length}
          </Text>
        </View>
      </View>

      {/* Step indicators */}
      <View style={styles.stepsRow}>
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <React.Fragment key={s.id}>
              <TouchableOpacity
                onPress={() => i <= step && setStep(i)}
                disabled={i > step}
                style={styles.stepItem}
              >
                <View
                  style={[
                    styles.stepCircle,
                    {
                      backgroundColor: isDone ? T.green : isActive ? T.greenPale : T.cream,
                      borderWidth: isActive ? 1.5 : 0,
                      borderColor: T.green,
                    },
                  ]}
                >
                  <Ionicons
                    name={isDone ? 'checkmark' : (s.icon as any)}
                    size={14}
                    color={isDone ? '#fff' : isActive ? T.green : T.muted}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 9.5,
                    fontWeight: '700',
                    marginTop: 4,
                    color: isActive ? T.greenDark : isDone ? T.charcoal : T.muted,
                  }}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
              {i < STEPS.length - 1 && (
                <View
                  style={{
                    flex: 1,
                    height: 2,
                    marginHorizontal: 2,
                    marginBottom: 14,
                    borderRadius: 1,
                    backgroundColor: i < step ? T.green : T.border,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>{renderStep()}</View>
        </ScrollView>

        {/* Bottom nav — sobe acima dos botões/gestos do dispositivo */}
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
          {step > 0 && (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnOutline]}
              onPress={() => setStep(step - 1)}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back" size={16} color={T.charcoal} />
              <Text style={[styles.navBtnText, { color: T.charcoal }]}>Anterior</Text>
            </TouchableOpacity>
          )}

          {step < STEPS.length - 1 ? (
            <TouchableOpacity
              style={[
                styles.navBtn,
                { backgroundColor: canAdvance() ? T.green : T.border, flex: 1 },
              ]}
              onPress={() => canAdvance() && setStep(step + 1)}
              disabled={!canAdvance()}
              activeOpacity={0.85}
            >
              <Text style={[styles.navBtnText, !canAdvance() && { color: T.muted }]}>Próximo</Text>
              <Ionicons name="arrow-forward" size={16} color={canAdvance() ? '#fff' : T.muted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: T.green, flex: 1 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
              <Text style={styles.navBtnText}>{loading ? 'A submeter…' : 'Submeter Ficha'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <MapPicker
        visible={pickerOpen}
        initialCoords={localTemp.coordenadas as Coords | null}
        initialQuery={localTemp.descricao}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePicked}
      />
    </View>
  );
}

function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: T.white,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.greenPale,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: T.charcoal },
  headerSubtitle: { fontSize: 11.5, color: T.muted, marginTop: 1 },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: T.white,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: T.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: T.charcoal, marginBottom: 4 },
  hint: { fontSize: 11.5, color: T.muted, marginBottom: 8, lineHeight: 16 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    color: T.charcoal,
    backgroundColor: T.field,
  },
  textArea: { height: 96, textAlignVertical: 'top', paddingTop: 12 },
  row: { flexDirection: 'row', gap: 12 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: T.field,
  },

  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.field,
  },
  mapBtnOn: { borderColor: T.green, backgroundColor: T.greenPale },
  mapBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.greenPale,
  },
  mapBtnIconOn: { backgroundColor: T.green },
  mapBtnTitle: { fontSize: 13.5, fontWeight: '800', color: T.charcoal },
  mapBtnSub: { fontSize: 11.5, color: T.muted, marginTop: 2 },

  addLocalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 10,
    backgroundColor: T.green,
    marginTop: 12,
  },
  addLocalBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  localRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: T.greenPale,
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  summaryLocalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 9,
    borderRadius: 8,
    backgroundColor: T.greenPale,
    marginTop: 4,
  },
  bottomNav: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: T.white,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 18,
  },
  navBtnOutline: { borderWidth: 1, borderColor: T.border, backgroundColor: T.white },
  navBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

export default function FichaRecebimentoRoute() {
  return (
    <RoleGuard allow={['comprador']}>
      <FichaRecebimentoScreen />
    </RoleGuard>
  );
}