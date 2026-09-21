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
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';
import { useUserRole } from '../context/RoleContext';
import RoleGuard from '../components/RoleGuard';
import { PRODUCT_CATEGORIES } from '../constants/productCategories';
import { angolaProvinces } from '../constants/angolaLocations';

const T = {
  green: '#2c863b',
  gold: '#B07D0A',
  charcoal: '#111714',
  muted: '#6B7C6E',
  border: '#E5EDE6',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  danger: '#DC2626',
};

interface FormData {
  product_type: string;
  category: string;
  quantity: string;
  harvest_date: Date | null;
  price: string;
  province_id: string;
  municipality_id: string;
  farmer_name: string;
  contact: string;
  description: string;
  logistics_access: 'sim' | 'parcial' | 'nao';
}

function PublicarProdutoScreen() {
  const router = useRouter();
  const { role } = useUserRole();

  const [formData, setFormData] = useState<FormData>({
    product_type: '',
    category: '',
    quantity: '',
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
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(path, blob, { contentType: asset.mimeType ?? `image/${ext}` });

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
    if (!formData.harvest_date) return 'Seleciona a data de colheita prevista.';
    if (images.length < 3) return 'Adiciona pelo menos 3 imagens do produto.';

    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 30);
    if (formData.harvest_date < minDate) {
      return 'A colheita deve ser prevista para pelo menos 30 dias a partir de hoje.';
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
          quantity: parseFloat(formData.quantity),
          harvest_date: formData.harvest_date!.toISOString().split('T')[0],
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
      router.back();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Erro ao publicar', err.message ?? 'Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={T.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📦 Publicar Produto</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.card}>
        {/* Tipo de produto */}
        <Field label="Tipo de Produto">
          <TextInput
            style={styles.input}
            placeholder="Ex: Milho, Feijão, Tomate..."
            value={formData.product_type}
            onChangeText={(v) => set('product_type', v)}
          />
        </Field>

        {/* Categoria */}
        <Field label="Categoria" hint="Define em que filtro o produto aparece no feed.">
          <View style={styles.categoryGrid}>
            {PRODUCT_CATEGORIES.map((c) => {
              const active = formData.category === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => set('category', c.id)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? c.color : T.white,
                      borderColor: active ? c.color : T.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={16}
                    color={active ? T.white : c.color}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      { color: active ? T.white : T.charcoal },
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        {/* Quantidade e preço */}
        <View style={styles.row}>
          <Field label="Quantidade (kg)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="1000"
              value={formData.quantity}
              onChangeText={(v) => set('quantity', v)}
            />
          </Field>
          <Field label="Preço (Kz)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="150.00"
              value={formData.price}
              onChangeText={(v) => set('price', v)}
            />
          </Field>
        </View>

        {/* Data de colheita */}
        <Field label="Data de Colheita Prevista" hint="Mínimo 30 dias a partir de hoje.">
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={{ color: formData.harvest_date ? T.charcoal : '#9CA3AF' }}>
              {formData.harvest_date
                ? formData.harvest_date.toLocaleDateString('pt-PT')
                : 'Selecionar data'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={formData.harvest_date ?? new Date()}
              mode="date"
              minimumDate={new Date()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) set('harvest_date', date);
              }}
            />
          )}
        </Field>

        {/* Descrição */}
        <Field label="Descrição do Produto">
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Qualidade, variedade, métodos de cultivo, certificações..."
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
            <View style={styles.pickerWrapper}>
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
        <Field label="Localização no Mapa" hint="Toca no mapa para marcar a localização exata.">
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
          <Field label="Nome do Produtor" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={formData.farmer_name}
              onChangeText={(v) => set('farmer_name', v)}
            />
          </Field>
          <Field label="Contacto" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder="Telefone ou email"
              value={formData.contact}
              onChangeText={(v) => set('contact', v)}
            />
          </Field>
        </View>

        {/* Logística */}
        <Field label="Acesso à Logística">
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
        <Field label="Fotos do Produto (mínimo 3, máximo 10)">
          <TouchableOpacity style={styles.uploadBox} onPress={pickImages}>
            <Ionicons name="cloud-upload-outline" size={28} color={T.muted} />
            <Text style={{ color: T.muted, marginTop: 6, fontSize: 13 }}>
              Toca para selecionar imagens
            </Text>
          </TouchableOpacity>

          {images.length > 0 && (
            <View style={styles.imageGrid}>
              {images.map((img) => (
                <View key={img.uri} style={styles.imageThumbWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.imageThumb} />
                  <TouchableOpacity
                    style={styles.imageRemove}
                    onPress={() => removeImage(img.uri)}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {images.length > 0 && (
            <Text style={{ color: T.muted, fontSize: 12, marginTop: 6 }}>
              {images.length} imagem(ns) selecionada(s)
            </Text>
          )}
        </Field>

        {/* Submeter */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Publicar Produto</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    <View style={[{ marginBottom: 18 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: T.white,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: T.charcoal },
  card: { margin: 16, padding: 18, backgroundColor: T.white, borderRadius: 18, borderWidth: 1, borderColor: T.border },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: T.charcoal, marginBottom: 4 },
  fieldHint: { fontSize: 11, color: T.muted, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    color: T.charcoal,
  },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 10 },
  row: { flexDirection: 'row', gap: 12 },
  pickerWrapper: { borderWidth: 1, borderColor: T.border, borderRadius: 10, overflow: 'hidden' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryLabel: { fontSize: 12, fontWeight: '600' },
  mapWrapper: { height: 220, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  coords: { fontSize: 11, color: T.green, marginTop: 6, fontVariant: ['tabular-nums'] },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: T.border,
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
  },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  imageThumbWrapper: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden' },
  imageThumb: { width: '100%', height: '100%' },
  imageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 3,
  },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: T.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default function PublicarProdutoRoute() {
  return (
    <RoleGuard allow={['agricultor', 'agente']}>
      <PublicarProdutoScreen />
    </RoleGuard>
  );
}