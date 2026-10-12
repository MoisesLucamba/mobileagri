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
  green: '#218B4A',
  greenDark: '#218B4A',
  greenPale: '#E9F5EC',
  charcoal: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  border: '#E8ECE6',
  cream: '#F6F8F5',
  field: '#F9FAF8',
  white: '#FFFEFC',
};

const STEPS = [
  { id: 0, label: 'O teu negócio', description: 'Identifica o negócio que vai receber os produtos.', icon: 'business-outline' },
  { id: 1, label: 'Produtos', description: 'Escolhe um ou mais produtos e indica como os pretendes receber.', icon: 'cube-outline' },
  { id: 2, label: 'Local de entrega', description: 'Indica onde os fornecedores devem entregar.', icon: 'car-outline' },
  { id: 3, label: 'Contacto', description: 'Deixa um contacto e acrescenta instruções, se necessário.', icon: 'call-outline' },
  { id: 4, label: 'Confirmar pedido', description: 'Revê os dados antes de enviar o pedido aos fornecedores.', icon: 'document-text-outline' },
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

const createEmptyFormData = () => ({
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

const createEmptyLocal = (): LocalEntrega => ({
  descricao: '',
  coordenadas: null,
});

function FichaRecebimentoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedProductIndex, setExpandedProductIndex] = useState<number | null>(0);
  const [fichas, setFichas] = useState([createEmptyFormData()]);
  const [localTemps, setLocalTemps] = useState([createEmptyLocal()]);
  const formData = fichas[0];
  const localTemp = localTemps[0];
  const sharedFields: (keyof ReturnType<typeof createEmptyFormData>)[] = [
    'nomeFicha',
    'tipoNegocio',
    'locaisEntrega',
    'telefone',
    'descricaoFinal',
    'observacoes',
  ];

  const set = (key: keyof ReturnType<typeof createEmptyFormData>, value: string) => {
    setFichas((current) =>
      current.map((ficha, index) =>
        sharedFields.includes(key) || index === 0 ? { ...ficha, [key]: value } : ficha,
      ),
    );
  };

  const setLocalTemp = (update: LocalEntrega | ((current: LocalEntrega) => LocalEntrega)) => {
    setLocalTemps((current) =>
      current.map((local, index) => index === 0
        ? typeof update === 'function' ? update(local) : update
        : local),
    );
  };

  const addFicha = () => {
    const shared = fichas[0];
    setFichas((current) => [
      ...current,
      {
        ...createEmptyFormData(),
        nomeFicha: shared.nomeFicha,
        tipoNegocio: shared.tipoNegocio,
        locaisEntrega: [...shared.locaisEntrega],
        telefone: shared.telefone,
        descricaoFinal: shared.descricaoFinal,
        observacoes: shared.observacoes,
      },
    ]);
    setExpandedProductIndex(fichas.length);
  };

  const updateFicha = (
    index: number,
    key: keyof ReturnType<typeof createEmptyFormData>,
    value: string,
  ) => {
    setFichas((current) =>
      current.map((ficha, fichaIndex) =>
        fichaIndex === index ? { ...ficha, [key]: value } : ficha,
      ),
    );
  };

  const removeFicha = (index: number) => {
    if (fichas.length <= 1) return;
    setFichas((current) => current.filter((_, fichaIndex) => fichaIndex !== index));
    setExpandedProductIndex((current) => {
      if (current === null) return null;
      if (current === index) return index > 0 ? index - 1 : 0;
      return current > index ? current - 1 : current;
    });
  };

  const canAdvance = () => {
    if (!formData) return false;
    switch (step) {
      case 0:
        return formData.nomeFicha.trim() && formData.tipoNegocio;
      case 1:
        return fichas.every((ficha) => !!ficha.produto);
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
      setFichas((current) =>
        current.map((ficha) => ({ ...ficha, locaisEntrega: [...ficha.locaisEntrega, localTemp] })),
      );
      setLocalTemp({ descricao: '', coordenadas: null });
    } else {
      Alert.alert('Faltam dados', 'Preenche a descrição e marca o local no mapa.');
    }
  };

  const removeLocal = (index: number) => {
    setFichas((current) =>
      current.map((ficha) => ({
        ...ficha,
        locaisEntrega: ficha.locaisEntrega.filter((_, i) => i !== index),
      })),
    );
  };

  const handleSubmit = async () => {
    const incompleteFicha = fichas.findIndex(
      (ficha) => !ficha.nomeFicha.trim() || !ficha.tipoNegocio || !ficha.produto,
    );
    if (incompleteFicha >= 0) {
      setStep(!fichas[incompleteFicha].nomeFicha.trim() || !fichas[incompleteFicha].tipoNegocio ? 0 : 1);
      Alert.alert(
        'Ficha incompleta',
        `Preenche o produto ${incompleteFicha + 1} antes de submeter as fichas.`,
      );
      return;
    }

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
        .insert(
          fichas.map((ficha) => ({
            user_id: user.id,
            nome_ficha: ficha.nomeFicha,
            tipo_negocio: ficha.tipoNegocio,
            produto: ficha.produto,
            qualidade: ficha.qualidade,
            embalagem: ficha.embalagem,
            transporte: ficha.transporte,
            locais_entrega: ficha.locaisEntrega,
            telefone: ficha.telefone,
            descricao_final: ficha.descricaoFinal,
            observacoes: ficha.observacoes,
          })),
        )
        .select('id')
        ;

      if (error) throw error;

      (inserted || []).forEach(({ id }) => {
        void supabase.functions
          .invoke('verify-product-ficha', { body: { ficha_id: id } })
          .then(({ error: verifyError }) => {
            if (verifyError) console.warn('Não foi possível verificar a ficha:', verifyError);
          })
          .catch((verifyError) => console.warn('Não foi possível verificar a ficha:', verifyError));
      });

      Alert.alert(
        'Fichas criadas',
        `${inserted?.length ?? fichas.length} ficha(s) de recebimento criada(s) com sucesso.`,
      );
      router.back();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erro ao salvar', err.message ?? 'Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    if (!formData || !localTemp) return null;
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
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionTitle}>O que precisas?</Text>
              <Text style={styles.sectionDescription}>
                Adiciona cada produto e os respetivos requisitos. O negócio e o local de entrega serão comuns.
              </Text>
              <View style={styles.productCountPill}>
                <Ionicons name="checkmark-circle" size={15} color={T.greenDark} />
                <Text style={styles.productCountText}>
                  {fichas.filter((ficha) => ficha.produto).length} de {fichas.length} selecionados
                </Text>
              </View>
            </View>
            {fichas.map((ficha, index) => (
              <View key={`produto-${index}`} style={[styles.productCard, ficha.produto && styles.productCardComplete]}>
                <View style={styles.productCardHeader}>
                  <TouchableOpacity
                    style={styles.productCardHeading}
                    onPress={() => setExpandedProductIndex(expandedProductIndex === index ? null : index)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`${expandedProductIndex === index ? 'Fechar' : 'Editar'} produto ${index + 1}`}
                  >
                    <View style={[styles.productNumber, ficha.produto && styles.productNumberComplete]}>
                      {ficha.produto
                        ? <Ionicons name="checkmark" size={15} color={T.white} />
                        : <Text style={styles.productNumberText}>{index + 1}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productCardTitle}>
                        {ficha.produto
                          ? PRODUTOS.find((produto) => produto.toLowerCase() === ficha.produto) || ficha.produto
                          : `Produto ${index + 1}`}
                      </Text>
                      <Text style={styles.productCardSubTitle}>
                        {ficha.produto
                          ? [ficha.qualidade, EMBALAGENS.find((opcao) => opcao.v === ficha.embalagem)?.l]
                              .filter(Boolean).join(' · ') || 'Toque para adicionar detalhes'
                          : 'Toque para escolher um produto'}
                      </Text>
                    </View>
                    <Ionicons
                      name={expandedProductIndex === index ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={T.muted}
                    />
                  </TouchableOpacity>
                  {fichas.length > 1 ? (
                    <TouchableOpacity
                      style={styles.removeProductButton}
                      onPress={() => removeFicha(index)}
                      hitSlop={8}
                      accessibilityLabel={`Remover produto ${index + 1}`}
                    >
                      <Ionicons name="trash-outline" size={17} color="#B54747" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {expandedProductIndex === index ? (
                  <View style={styles.productFields}>
                    <Field label="Produto *">
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={ficha.produto}
                          onValueChange={(value) => updateFicha(index, 'produto', value)}
                        >
                          <Picker.Item label="Selecionar produto" value="" />
                          {PRODUTOS.map((produto) => (
                            <Picker.Item key={produto} label={produto} value={produto.toLowerCase()} />
                          ))}
                        </Picker>
                      </View>
                    </Field>
                    <Field label="Qualidade pretendida">
                      <TextInput
                        style={styles.input}
                        placeholder="Ex.: Fresco, sem defeitos"
                        placeholderTextColor={T.faint}
                        value={ficha.qualidade}
                        onChangeText={(value) => updateFicha(index, 'qualidade', value)}
                      />
                    </Field>
                    <Field label="Embalagem">
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={ficha.embalagem}
                          onValueChange={(value) => updateFicha(index, 'embalagem', value)}
                        >
                          <Picker.Item label="Selecionar embalagem" value="" />
                          {EMBALAGENS.map((opcao) => (
                            <Picker.Item key={opcao.v} label={opcao.l} value={opcao.v} />
                          ))}
                        </Picker>
                      </View>
                    </Field>
                    <Field label="Transporte preferido">
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={ficha.transporte}
                          onValueChange={(value) => updateFicha(index, 'transporte', value)}
                        >
                          <Picker.Item label="Selecionar transporte" value="" />
                          <Picker.Item label="Próprio" value="proprio" />
                          <Picker.Item label="Terceiros" value="terceiros" />
                          <Picker.Item label="Via AgriLink" value="agrilink" />
                          <Picker.Item label="A combinar" value="combinar" />
                        </Picker>
                      </View>
                    </Field>
                  </View>
                ) : null}
              </View>
            ))}
            <TouchableOpacity style={styles.addProductButton} onPress={addFicha} disabled={loading} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={20} color={T.greenDark} />
              <Text style={styles.addProductButtonText}>Adicionar outro produto</Text>
            </TouchableOpacity>
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

            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>Produtos ({fichas.length})</Text>
              {fichas.map((ficha, index) => (
                <View key={`resumo-produto-${index}`} style={styles.summaryProductRow}>
                  <View style={styles.summaryProductNumber}>
                    <Text style={styles.summaryProductNumberText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryProductName}>
                      {PRODUTOS.find((product) => product.toLowerCase() === ficha.produto) || ficha.produto}
                    </Text>
                    <Text style={styles.summaryProductDetails}>
                      {[ficha.qualidade, EMBALAGENS.find((option) => option.v === ficha.embalagem)?.l, ficha.transporte]
                        .filter(Boolean)
                        .join(' · ') || 'Sem requisitos adicionais'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

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
          <Text style={styles.headerTitle}>Novo pedido</Text>
          <Text style={styles.headerSubtitle}>
            Pedido de compra · {fichas.length} {fichas.length === 1 ? 'produto' : 'produtos'}
          </Text>
        </View>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeading}>
          <View style={styles.progressIcon}>
            <Ionicons name={STEPS[step].icon as any} size={19} color={T.greenDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.progressEyebrow}>PASSO {step + 1} DE {STEPS.length}</Text>
            <Text style={styles.progressTitle}>{STEPS[step].label}</Text>
          </View>
          <Text style={styles.progressCount}>{Math.round(((step + 1) / STEPS.length) * 100)}%</Text>
        </View>
        <Text style={styles.progressDescription}>{STEPS[step].description}</Text>
        <View style={styles.progressTrack}>
          {STEPS.map((item, index) => (
            <View
              key={item.id}
              style={[styles.progressSegment, index <= step && styles.progressSegmentDone]}
            />
          ))}
        </View>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
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
              <Text style={[styles.navBtnText, { color: T.charcoal }]}>Voltar</Text>
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
              <Text style={styles.navBtnText}>{loading ? 'A enviar…' : `Enviar ${fichas.length > 1 ? `${fichas.length} fichas` : 'pedido'}`}</Text>
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
    paddingBottom: 14,
    backgroundColor: T.white,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.field,
    borderWidth: 1,
    borderColor: T.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: T.charcoal, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, color: T.muted, marginTop: 3 },
  progressCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 15,
    borderRadius: 16,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.border,
  },
  progressHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  progressIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.greenPale,
  },
  progressEyebrow: { color: T.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  progressTitle: { color: T.charcoal, fontSize: 16, fontWeight: '900', marginTop: 2 },
  progressCount: { color: T.greenDark, fontSize: 13, fontWeight: '900' },
  progressDescription: { color: T.muted, fontSize: 12, lineHeight: 17, marginTop: 11 },
  progressTrack: { flexDirection: 'row', gap: 5, marginTop: 14 },
  progressSegment: { flex: 1, height: 4, borderRadius: 4, backgroundColor: T.border },
  progressSegmentDone: { backgroundColor: T.green },
  sectionIntro: { marginBottom: 15 },
  sectionTitle: { color: T.charcoal, fontSize: 18, fontWeight: '900', marginBottom: 5 },
  sectionDescription: { color: T.muted, fontSize: 12.5, lineHeight: 18 },
  productCountPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: T.greenPale,
  },
  productCountText: { color: T.greenDark, fontSize: 11, fontWeight: '800' },
  card: {
    backgroundColor: T.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: '#16231C',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: T.charcoal, marginBottom: 7 },
  hint: { fontSize: 12, color: T.muted, marginBottom: 8, lineHeight: 18 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    color: T.charcoal,
    backgroundColor: T.white,
    fontSize: 14,
  },
  textArea: { height: 96, textAlignVertical: 'top', paddingTop: 12 },
  productCard: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.white,
  },
  productCardComplete: { borderColor: '#D7EBDD' },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productCardHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  productNumber: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.field,
  },
  productNumberComplete: { backgroundColor: T.green },
  productNumberText: { color: T.muted, fontSize: 12, fontWeight: '900' },
  productCardTitle: { color: T.charcoal, fontSize: 14, fontWeight: '900' },
  productCardSubTitle: { color: T.muted, fontSize: 11, marginTop: 3 },
  removeProductButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#FBEDEC',
  },
  productFields: {
    paddingTop: 15,
    paddingHorizontal: 2,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginTop: 2,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.green,
    backgroundColor: T.greenPale,
  },
  addProductButtonText: { fontSize: 13, fontWeight: '800', color: T.greenDark },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: T.white,
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
  summaryProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: T.greenPale,
  },
  summaryProductNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.green,
  },
  summaryProductNumberText: { color: T.white, fontSize: 12, fontWeight: '800' },
  summaryProductName: { color: T.charcoal, fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  summaryProductDetails: { color: T.muted, fontSize: 11, marginTop: 2 },
  bottomNav: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: T.white,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  navBtnOutline: { borderWidth: 1, borderColor: T.border, backgroundColor: T.field },
  navBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});

export default function FichaRecebimentoRoute() {
  return (
    <RoleGuard allow={['comprador']}>
      <FichaRecebimentoScreen />
    </RoleGuard>
  );
}