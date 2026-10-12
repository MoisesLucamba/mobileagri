// app/publicar-produto.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import MapView, { Marker } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';
import RoleGuard from '../components/RoleGuard';
import Icon from '../components/Icon';
import { PRODUCT_CATEGORIES } from '../constants/productCategories';
import { angolaProvinces } from '../constants/angolaLocations';

// Mesma paleta do ProductCard
const T = {
  primary: '#218B4A',
  primaryDark: '#218B4A',
  tint: '#EAF5ED',
  text: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  line: '#E8ECE6',
  background: '#F3F6F2',
  white: '#FFFEFC',
  danger: '#DD5138',
};

interface FormData {
  product_type: string;
  category: string;
  quantity: string;
  unit: string;
  harvest_date: Date | null;
  price: string;
  province_id: string;
  municipality_id: string;
  farmer_name: string;
  contact: string;
  description: string;
  logistics_access: 'sim' | 'parcial' | 'nao';
}

const PRODUCT_UNITS = ['kg', 'unidade', 'dúzia', 'bandeja', 'caixa', 'pacote', 'saco', 'litro', 'garrafa'] as const;

const PRODUCT_SUGGESTIONS = {
  fresh: [
    { label: 'Ovos', category: 'aves', unit: 'dúzia' },
    { label: 'Trigo', category: 'cereais', unit: 'kg' },
    { label: 'Milho', category: 'cereais', unit: 'kg' },
    { label: 'Arroz', category: 'cereais', unit: 'kg' },
    { label: 'Tomate', category: 'horticolas', unit: 'kg' },
    { label: 'Batata', category: 'tuberculos', unit: 'kg' },
    { label: 'Frango', category: 'aves', unit: 'kg' },
    { label: 'Leite fresco', category: 'lacteos', unit: 'litro' },
  ],
  processed: [
    { label: 'Farinha de trigo', category: 'processados', unit: 'kg' },
    { label: 'Farinha de milho', category: 'processados', unit: 'kg' },
    { label: 'Pão', category: 'processados', unit: 'unidade' },
    { label: 'Massa', category: 'processados', unit: 'kg' },
    { label: 'Óleo alimentar', category: 'processados', unit: 'litro' },
    { label: 'Arroz embalado', category: 'processados', unit: 'saco' },
    { label: 'Leite pasteurizado', category: 'lacteos', unit: 'litro' },
    { label: 'Iogurte', category: 'lacteos', unit: 'unidade' },
    { label: 'Queijo', category: 'lacteos', unit: 'kg' },
    { label: 'Fuba', category: 'processados', unit: 'kg' },
    { label: 'Açúcar', category: 'processados', unit: 'kg' },
    { label: 'Conserva de peixe', category: 'processados', unit: 'caixa' },
    { label: 'Feijão enlatado', category: 'processados', unit: 'caixa' },
  ],
};

function PublicarProdutoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState<FormData>({
    product_type: '',
    category: '',
    quantity: '',
    unit: 'kg',
    harvest_date: null,
    price: '',
    province_id: '',
    municipality_id: '',
    farmer_name: '',
    contact: '',
    description: '',
    logistics_access: 'sim',
  });

  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isProcessed, setIsProcessed] = useState<boolean | null>(null);
  const [minimumHarvestDate] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 30);
    return date;
  });

  const availableMunicipalities =
    angolaProvinces.find((p) => p.id === formData.province_id)?.municipalities || [];

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Autoriza o acesso às fotos para continuar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.7,
    });

    if (result.canceled) return;

    if (result.assets.length < 3) {
      Alert.alert('Imagens insuficientes', 'Escolhe pelo menos 3 imagens do produto.');
      return;
    }

    setImages(result.assets.slice(0, 10));
  };

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((img) => img.uri !== uri));
  };

  const uploadImages = async (userId: string) => {
    const urls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const asset = images[i];
      const ext = asset.uri.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}-${i}.${ext}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(path, arrayBuffer, {
          contentType: asset.mimeType ?? 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('product-photos').getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return urls;
  };

  const validate = (): string | null => {
    if (!formData.product_type.trim()) return 'Indica o tipo de produto.';
    if (!formData.category) return 'Seleciona uma categoria.';
    if (!formData.quantity) return 'Indica a quantidade.';
    if (!formData.price) return 'Indica o preço.';
    if (isProcessed === null) return 'Indica se o produto é processado ou não processado.';
    if (!isProcessed && !formData.harvest_date) return 'Seleciona a data de colheita prevista.';
    if (images.length < 3) return 'Adiciona pelo menos 3 imagens do produto.';

    if (!isProcessed && formData.harvest_date) {
      const minDate = new Date();
      minDate.setHours(0, 0, 0, 0);
      minDate.setDate(minDate.getDate() + 30);
      if (formData.harvest_date < minDate) {
        return 'A colheita deve ser prevista para pelo menos 30 dias a partir de hoje.';
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      Alert.alert('Faltam dados', error);
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
          'Cria a tua conta ou inicia sessão para publicar este produto.',
          [{ text: 'Iniciar sessão', onPress: () => router.push('/login') }]
        );
        return;
      }

      const photoUrls = await uploadImages(user.id);

      const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          product_type: formData.product_type,
          category: formData.category,
          is_processed: isProcessed,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          harvest_date: formData.harvest_date?.toISOString().split('T')[0] ?? null,
          price: parseFloat(formData.price),
          province_id: formData.province_id,
          municipality_id: formData.municipality_id,
          farmer_name: formData.farmer_name,
          contact: formData.contact,
          description: formData.description,
          logistics_access: formData.logistics_access,
          status: 'pending_approval',
          photos: photoUrls,
          location_lat: location?.lat ?? null,
          location_lng: location?.lng ?? null,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (inserted?.id) {
        supabase.functions
          .invoke('verify-product-ficha', { body: { product_id: inserted.id } })
          .catch((e) => console.warn('verify error', e));
      }

      Alert.alert('Enviado', 'O produto foi enviado para aprovação e aparecerá no feed em breve.');
      router.replace('/home');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erro ao publicar', err.message ?? 'Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 32 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Icon name="arrow-left" size={19} color={T.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Publicar produto</Text>
        </View>

        <View style={styles.card}>
          {isProcessed === null ? (
            <View style={styles.processingQuestion}>
              <View style={styles.questionIcon}>
                <Ionicons name="nutrition-outline" size={22} color={T.primary} />
              </View>
              <Text style={styles.questionTitle}>Que tipo de produto vais publicar?</Text>
              <Text style={styles.questionDescription}>
                Esta escolha adapta os campos e ajuda os compradores a encontrar o produto certo.
              </Text>
              <TouchableOpacity
                style={styles.processingOption}
                onPress={() => {
                  setIsProcessed(false);
                  set('product_type', '');
                  set('category', '');
                  set('unit', 'kg');
                  set('harvest_date', null);
                }}
                activeOpacity={0.82}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="leaf-outline" size={20} color={T.primary} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>Não processado</Text>
                  <Text style={styles.optionDescription}>
                    Produtos frescos ou colhidos, como ovos, trigo e hortícolas.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={T.muted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.processingOption}
                onPress={() => {
                  setIsProcessed(true);
                  set('product_type', '');
                  set('category', 'processados');
                  set('unit', 'kg');
                  set('harvest_date', null);
                }}
                activeOpacity={0.82}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="cube-outline" size={20} color={T.primary} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>Processado</Text>
                  <Text style={styles.optionDescription}>
                    Alimentos preparados ou embalados, como farinha, pão e óleo.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={T.muted} />
              </TouchableOpacity>
            </View>
          ) : (
          <>
          <TouchableOpacity
            style={styles.changeTypeButton}
            onPress={() => setIsProcessed(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={15} color={T.primary} />
            <Text style={styles.changeTypeText}>
              {isProcessed ? 'Produto processado' : 'Produto não processado'} · Alterar
            </Text>
          </TouchableOpacity>

          {/* Tipo de produto */}
          <Field label="Tipo de produto">
            <TextInput
              style={styles.input}
              placeholder={isProcessed ? 'Ex: Farinha, pão, óleo alimentar...' : 'Ex: Ovos, trigo, tomate...'}
              placeholderTextColor={T.faint}
              value={formData.product_type}
              onChangeText={(v) => set('product_type', v)}
            />
          </Field>
          <View style={styles.suggestionWrap}>
            {(isProcessed ? PRODUCT_SUGGESTIONS.processed : PRODUCT_SUGGESTIONS.fresh).map((suggestion) => (
              <TouchableOpacity
                key={suggestion.label}
                style={[
                  styles.suggestionChip,
                  formData.product_type === suggestion.label && styles.suggestionChipActive,
                ]}
                onPress={() => {
                  set('product_type', suggestion.label);
                  set('category', suggestion.category);
                  set('unit', suggestion.unit);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.suggestionText,
                    formData.product_type === suggestion.label && styles.suggestionTextActive,
                  ]}
                >
                  {suggestion.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Categoria */}
          <Field label="Categoria" hint="Define em que filtro o produto aparece no feed.">
            <View style={styles.categoryGrid}>
              {PRODUCT_CATEGORIES.map((c) => {
                const active = formData.category === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => set('category', c.id)}
                    activeOpacity={0.8}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                  >
                    <Ionicons
                      name={c.icon as any}
                      size={16}
                      color={active ? T.primary : T.text}
                    />
                    <Text style={[styles.categoryLabel, active && { color: T.primaryDark }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* Quantidade e preço */}
          <View style={styles.row}>
            <Field label={`Quantidade (${formData.unit})`} style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="1000"
                placeholderTextColor={T.faint}
                value={formData.quantity}
                onChangeText={(v) => set('quantity', v)}
              />
            </Field>
            <Field label="Preço (Kz)" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="150.00"
                placeholderTextColor={T.faint}
                value={formData.price}
                onChangeText={(v) => set('price', v)}
              />
            </Field>
          </View>

          <Field label="Unidade de venda">
            <View style={styles.unitOptions}>
              {PRODUCT_UNITS.map((unit) => {
                const active = formData.unit === unit;
                return (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => set('unit', unit)}
                    style={[styles.unitChip, active && styles.unitChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>{unit}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          {/* Data de colheita */}
          {!isProcessed ? (
          <Field label="Data de colheita prevista" hint="Mínimo 30 dias a partir de hoje.">
            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
              <Text style={{ fontSize: 14.5, color: formData.harvest_date ? T.text : T.faint }}>
                {formData.harvest_date
                  ? formData.harvest_date.toLocaleDateString('pt-PT')
                  : 'Selecionar data'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={formData.harvest_date ?? new Date()}
                mode="date"
                minimumDate={minimumHarvestDate}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) set('harvest_date', date);
                }}
              />
            )}
          </Field>
          ) : null}

          {/* Descrição */}
          <Field label="Descrição do produto">
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Qualidade, variedade, métodos de cultivo, certificações..."
              placeholderTextColor={T.faint}
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(v) => set('description', v)}
            />
          </Field>

          {/* Província / Município */}
          <View style={styles.row}>
            <Field label="Província" style={{ flex: 1 }}>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.province_id}
                  onValueChange={(v) => {
                    set('province_id', v);
                    set('municipality_id', '');
                  }}
                >
                  <Picker.Item label="Selecionar" value="" />
                  {angolaProvinces.map((p) => (
                    <Picker.Item key={p.id} label={p.name} value={p.id} />
                  ))}
                </Picker>
              </View>
            </Field>
            <Field label="Município" style={{ flex: 1 }}>
              <View style={[styles.pickerWrapper, !formData.province_id && { opacity: 0.6 }]}>
                <Picker
                  enabled={!!formData.province_id}
                  selectedValue={formData.municipality_id}
                  onValueChange={(v) => set('municipality_id', v)}
                >
                  <Picker.Item label="Selecionar" value="" />
                  {availableMunicipalities.map((m) => (
                    <Picker.Item key={m.id} label={m.name} value={m.id} />
                  ))}
                </Picker>
              </View>
            </Field>
          </View>

          {/* Mapa */}
          <Field label="Localização no mapa" hint="Toca no mapa para marcar a localização exata.">
            <View style={styles.mapWrapper}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: -8.839,
                  longitude: 13.234,
                  latitudeDelta: 5,
                  longitudeDelta: 5,
                }}
                onPress={(e) =>
                  setLocation({
                    lat: e.nativeEvent.coordinate.latitude,
                    lng: e.nativeEvent.coordinate.longitude,
                  })
                }
              >
                {location && (
                  <Marker
                    coordinate={{ latitude: location.lat, longitude: location.lng }}
                    pinColor={T.danger}
                  />
                )}
              </MapView>
            </View>
            {location && (
              <Text style={styles.coords}>
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </Text>
            )}
          </Field>

          {/* Produtor / contacto */}
          <View style={styles.row}>
            <Field label="Nome do produtor" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                placeholderTextColor={T.faint}
                value={formData.farmer_name}
                onChangeText={(v) => set('farmer_name', v)}
              />
            </Field>
            <Field label="Contacto" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                placeholder="Telefone ou email"
                placeholderTextColor={T.faint}
                value={formData.contact}
                onChangeText={(v) => set('contact', v)}
              />
            </Field>
          </View>

          {/* Logística */}
          <Field label="Acesso à logística">
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={formData.logistics_access}
                onValueChange={(v) => set('logistics_access', v)}
              >
                <Picker.Item label="Sim - Tenho transporte" value="sim" />
                <Picker.Item label="Parcial - Preciso de apoio" value="parcial" />
                <Picker.Item label="Não - Preciso de transporte" value="nao" />
              </Picker>
            </View>
          </Field>

          {/* Fotos */}
          <Field label="Fotos do produto (mínimo 3, máximo 10)">
            <TouchableOpacity style={styles.uploadBox} onPress={pickImages} activeOpacity={0.8}>
              <View style={styles.uploadIcon}>
                <Ionicons name="cloud-upload-outline" size={22} color={T.primary} />
              </View>
              <Text style={styles.uploadText}>Toca para selecionar imagens</Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <View style={styles.imageGrid}>
                {images.map((img) => (
                  <View key={img.uri} style={styles.imageThumbWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.imageThumb} />
                    <TouchableOpacity
                      style={styles.imageRemove}
                      onPress={() => removeImage(img.uri)}
                      hitSlop={6}
                    >
                      <Icon name="close" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {images.length > 0 && (
              <Text style={styles.imageCount}>{images.length} imagem(ns) selecionada(s)</Text>
            )}
          </Field>

          {/* Submeter */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>{loading ? 'A publicar…' : 'Publicar produto'}</Text>
          </TouchableOpacity>
          </>
          )}
        </View>
      </ScrollView>
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
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  // Mesmo botão do ícone de mapa do ProductCard
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.tint,
  },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: '900', color: T.text },

  // Cartão plano: igual ao ProductCard
  card: {
    marginHorizontal: 18,
    padding: 14,
    backgroundColor: T.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.line,
    shadowColor: '#16231C',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  processingQuestion: { alignItems: 'center', paddingVertical: 12 },
  questionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.tint,
    marginBottom: 12,
  },
  questionTitle: { fontSize: 18, fontWeight: '900', color: T.text, textAlign: 'center' },
  questionDescription: {
    marginTop: 7,
    marginBottom: 18,
    fontSize: 12.5,
    lineHeight: 18,
    color: T.muted,
    textAlign: 'center',
  },
  processingOption: {
    width: '100%',
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    backgroundColor: T.white,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.tint,
  },
  optionCopy: { flex: 1 },
  optionTitle: { fontSize: 13.5, fontWeight: '800', color: T.text },
  optionDescription: { marginTop: 3, fontSize: 11.5, lineHeight: 16, color: T.muted },
  changeTypeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 5,
    paddingRight: 8,
  },
  changeTypeText: { fontSize: 11.5, fontWeight: '800', color: T.primary },
  suggestionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: -7, marginBottom: 16 },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 999,
    backgroundColor: T.white,
  },
  suggestionChipActive: { borderColor: T.primary, backgroundColor: T.tint },
  suggestionText: { color: T.muted, fontSize: 11.5, fontWeight: '700' },
  suggestionTextActive: { color: T.primary, fontWeight: '800' },
  unitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitChip: {
    minHeight: 36,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 999,
    backgroundColor: T.white,
  },
  unitChipActive: { borderColor: T.primary, backgroundColor: T.tint },
  unitChipText: { color: T.muted, fontSize: 12, fontWeight: '700' },
  unitChipTextActive: { color: T.primary, fontWeight: '800' },

  fieldLabel: { fontSize: 12.5, fontWeight: '800', color: T.text, marginBottom: 6 },
  fieldHint: { fontSize: 11.5, color: T.muted, marginBottom: 6, marginTop: -2 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 10,
    backgroundColor: T.white,
    paddingHorizontal: 12,
    justifyContent: 'center',
    fontSize: 14.5,
    color: T.text,
  },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
  row: { flexDirection: 'row', gap: 12 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 10,
    backgroundColor: T.white,
    overflow: 'hidden',
  },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.white,
  },
  categoryChipActive: { borderColor: T.primary, backgroundColor: T.tint },
  categoryLabel: { fontSize: 12.5, fontWeight: '800', color: T.text },

  mapWrapper: {
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.line,
  },
  coords: { fontSize: 11.5, color: T.primaryDark, marginTop: 6, fontVariant: ['tabular-nums'] },

  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.line,
    borderRadius: 10,
    backgroundColor: T.background,
    paddingVertical: 22,
    alignItems: 'center',
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: T.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: { color: T.muted, marginTop: 8, fontSize: 12.5, fontWeight: '700' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  imageThumbWrapper: { width: 84, height: 84, borderRadius: 8, overflow: 'hidden' },
  imageThumb: { width: '100%', height: '100%' },
  imageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(22,35,28,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCount: { color: T.muted, fontSize: 12, marginTop: 8 },

  // Botão igual ao "Comprar" do ProductCard
  submitBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});

export default function PublicarProdutoRoute() {
  return (
    <RoleGuard allow={['agricultor', 'agente']}>
      <PublicarProdutoScreen />
    </RoleGuard>
  );
}