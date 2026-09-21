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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';
import RoleGuard from '../components/RoleGuard';

const T = {
  green: '#2c863b',
  greenPale: '#E8F5E9',
  charcoal: '#1C2B1E',
  muted: '#6B7C6E',
  border: '#D4E8D1',
  cream: '#FAFAF7',
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
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

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

  const addLocal = () => {
    if (localTemp.descricao && localTemp.coordenadas) {
      set('locaisEntrega', [...formData.locaisEntrega, localTemp]);
      setLocalTemp({ descricao: '', coordenadas: null });
    } else {
      Alert.alert('Faltam dados', 'Preenche a descrição e toca no mapa para marcar o local.');
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
                value={localTemp.descricao}
                onChangeText={(v) => setLocalTemp((p) => ({ ...p, descricao: v }))}
              />
            </Field>

            <Text style={styles.hint}>Toca no mapa para marcar a localização exata.</Text>

            <View style={styles.mapWrapper}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: -8.838,
                  longitude: 13.235,
                  latitudeDelta: 0.5,
                  longitudeDelta: 0.5,
                }}
                onPress={(e) =>
                  setLocalTemp((p) => ({
                    ...p,
                    coordenadas: {
                      lat: e.nativeEvent.coordinate.latitude,
                      lng: e.nativeEvent.coordinate.longitude,
                    },
                  }))
                }
              >
                {localTemp.coordenadas && (
                  <Marker
                    coordinate={{
                      latitude: localTemp.coordenadas.lat,
                      longitude: localTemp.coordenadas.lng,
                    }}
                    pinColor={T.green}
                  />
                )}
              </MapView>
            </View>

            {localTemp.coordenadas && (
              <Text style={styles.coords}>
                {localTemp.coordenadas.lat.toFixed(5)}, {localTemp.coordenadas.lng.toFixed(5)}
              </Text>
            )}

            <TouchableOpacity style={styles.addLocalBtn} onPress={addLocal}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addLocalBtnText}>Adicionar Local de Entrega</Text>
            </TouchableOpacity>

            {formData.locaisEntrega.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>
                  Locais adicionados ({formData.locaisEntrega.length})
                </Text>
                {formData.locaisEntrega.map((local, i) => (
                  <View key={i} style={styles.localRow}>
                    <Ionicons name="location-outline" size={16} color={T.green} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: T.charcoal }}>
                        {local.descricao}
                      </Text>
                      <Text style={{ fontSize: 10, color: T.muted }}>
                        {local.coordenadas?.lat.toFixed(4)}, {local.coordenadas?.lng.toFixed(4)}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeLocal(i)}>
                      <Ionicons name="close" size={16} color={T.muted} />
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
                value={formData.telefone}
                onChangeText={(v) => set('telefone', v)}
              />
            </Field>
            <Field label="Descrição Final">
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Requisitos adicionais para o fornecedor..."
                multiline
                value={formData.descricaoFinal}
                onChangeText={(v) => set('descricaoFinal', v)}
              />
            </Field>
            <Field label="Observações">
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Informações complementares, links úteis..."
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
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.charcoal }}>
                  {item.value}
                </Text>
              </View>
            ))}

            {formData.locaisEntrega.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>
                  Locais de Entrega ({formData.locaisEntrega.length})
                </Text>
                {formData.locaisEntrega.map((local, i) => (
                  <View key={i} style={styles.summaryLocalRow}>
                    <Ionicons name="location-outline" size={14} color={T.green} />
                    <Text style={{ fontSize: 13, color: T.charcoal, marginLeft: 6 }}>
                      {local.descricao}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {!!formData.descricaoFinal && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Descrição Final</Text>
                <Text style={{ fontSize: 13, color: T.muted }}>{formData.descricaoFinal}</Text>
              </View>
            )}
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={T.charcoal} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
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
                      backgroundColor: isDone ? T.green : isActive ? T.greenPale : '#F0F0F0',
                      borderWidth: isActive ? 2 : 0,
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
                    fontSize: 9,
                    fontWeight: '700',
                    marginTop: 4,
                    color: isActive ? T.green : isDone ? T.charcoal : T.muted,
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
                    backgroundColor: i < step ? T.green : T.border,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>{renderStep()}</View>
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {step > 0 && (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnOutline]}
            onPress={() => setStep(step - 1)}
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
          >
            <Text style={styles.navBtnText}>Próximo</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: T.green, flex: 1 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={styles.navBtnText}>Submeter Ficha</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
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
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: T.white,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: T.charcoal },
  headerSubtitle: { fontSize: 11, color: T.muted, marginTop: 1 },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: T.white,
  },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: T.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: T.border,
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: T.charcoal, marginBottom: 4 },
  hint: { fontSize: 11, color: T.muted, marginBottom: 8 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    color: T.charcoal,
  },
  textArea: { height: 90, textAlignVertical: 'top', paddingTop: 10 },
  row: { flexDirection: 'row', gap: 12 },
  pickerWrapper: { borderWidth: 1, borderColor: T.border, borderRadius: 10, overflow: 'hidden' },
  mapWrapper: { height: 240, borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: T.border },
  coords: { fontSize: 11, color: T.green, marginTop: 6 },
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
  addLocalBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
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
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  summaryLocalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: T.greenPale,
    marginTop: 4,
  },
  bottomNav: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    paddingHorizontal: 16,
  },
  navBtnOutline: { borderWidth: 1, borderColor: T.border, backgroundColor: 'transparent' },
  navBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default function FichaRecebimentoRoute() {
  return (
    <RoleGuard allow={['comprador']}>
      <FichaRecebimentoScreen />
    </RoleGuard>
  );
}