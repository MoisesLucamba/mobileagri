import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminOnly from '../components/AdminOnly';
import Icon from '../components/Icon';
import {
    AgrilinkAd,
    loadAgrilinkAds,
    publishAgrilinkAd,
    setAgrilinkAdStatus,
} from '../lib/agrilinkAds';

const COLORS = {
  primary: '#1F6B3A',
  text: '#16231C',
  muted: '#78877D',
  faint: '#AEB8AC',
  border: '#EAE4D6',
  canvas: '#FAF8F3',
  surface: '#FFFFFF',
  gold: '#D79427',
  danger: '#B54747',
  dangerSoft: '#FCECEC',
};

const MAX_IMAGES = 8;

function AdsManagerContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [ads, setAds] = useState<AgrilinkAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAdId, setBusyAdId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setError('');
      setAds(await loadAgrilinkAds());
    } catch (loadError: any) {
      setError(loadError?.message || 'Não foi possível carregar os anúncios.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pickImages = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limite de imagens', `Cada anúncio aceita até ${MAX_IMAGES} imagens.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
      orderedSelection: true,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled) return;

    setImages((current) => {
      const existing = new Set(current.map((image) => image.uri));
      return [...current, ...result.assets.filter((image) => !existing.has(image.uri))].slice(0, MAX_IMAGES);
    });
  };

  const publish = async () => {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanUrl = targetUrl.trim();
    if (cleanTitle.length < 3) return setError('O título deve ter pelo menos 3 caracteres.');
    if (cleanDescription.length < 10) return setError('A descrição deve ter pelo menos 10 caracteres.');
    if (images.length < 3) return setError('Adicione pelo menos 3 imagens ao anúncio.');
    if (images.some((image) => Number(image.fileSize || 0) > 12 * 1024 * 1024)) {
      return setError('Cada imagem deve ter no máximo 12 MB.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cleanUrl);
    } catch {
      return setError('Introduza um link válido começado por https:// ou http://.');
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return setError('O link deve começar por https:// ou http://.');
    }

    setSaving(true);
    setError('');
    try {
      await publishAgrilinkAd({ title: cleanTitle, description: cleanDescription, targetUrl: parsedUrl.toString(), images });
      setTitle('');
      setDescription('');
      setTargetUrl('');
      setImages([]);
      await refresh();
      Alert.alert('Anúncio publicado', 'O anúncio está ativo e pode aparecer no feed.');
    } catch (publishError: any) {
      setError(publishError?.message || 'Não foi possível publicar o anúncio.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (ad: AgrilinkAd) => {
    setBusyAdId(ad.id);
    try {
      const updated = await setAgrilinkAdStatus(ad.id, ad.status === 'active' ? 'paused' : 'active');
      setAds((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (statusError: any) {
      Alert.alert('Não foi possível alterar o anúncio', statusError?.message || 'Tente novamente.');
    } finally {
      setBusyAdId(null);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 34 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh(); }} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/dashboard')} accessibilityLabel="Voltar ao dashboard">
            <Icon name="chevron-left" size={21} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>DASHBOARD · PUBLICIDADE</Text>
            <Text style={styles.title}>Agrilink Ads</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Novo anúncio</Text>
          <Text style={styles.sectionCaption}>Os anúncios aparecem no feed com identificação própria e avaliação por estrelas.</Text>

          <Text style={styles.label}>Título</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="Ex.: Feira agrícola de Luanda"
            placeholderTextColor={COLORS.faint}
            style={styles.input}
          />

          <Text style={styles.label}>Descrição</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={3000}
            placeholder="Apresente a campanha ou o serviço…"
            placeholderTextColor={COLORS.faint}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.descriptionInput]}
          />

          <Text style={styles.label}>Link de destino</Text>
          <TextInput
            value={targetUrl}
            onChangeText={setTargetUrl}
            maxLength={2048}
            placeholder="https://exemplo.ao"
            placeholderTextColor={COLORS.faint}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={styles.imagesHeading}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { marginBottom: 3 }]}>Imagens</Text>
              <Text style={styles.imageCount}>{images.length} de {MAX_IMAGES} · mínimo 3</Text>
            </View>
            <TouchableOpacity style={styles.addImagesButton} onPress={pickImages} disabled={saving}>
              <Icon name="image" size={16} color={COLORS.primary} />
              <Text style={styles.addImagesText}>Selecionar</Text>
            </TouchableOpacity>
          </View>

          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageStrip}>
              {images.map((image, index) => (
                <View key={`${image.uri}-${index}`} style={styles.imagePreviewWrap}>
                  <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImage}
                    onPress={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}
                    accessibilityLabel="Remover imagem"
                  >
                    <Icon name="close" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity style={[styles.publishButton, saving && styles.disabled]} onPress={publish} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Icon name="send" size={16} color="#FFFFFF" />
              <Text style={styles.publishText}>Publicar anúncio</Text>
            </>}
          </TouchableOpacity>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>Campanhas</Text>
          <Text style={styles.imageCount}>{ads.length}</Text>
        </View>

        {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} /> : null}
        {!loading && ads.length === 0 ? (
          <Text style={styles.emptyText}>Os anúncios criados aparecerão aqui.</Text>
        ) : null}
        {ads.map((ad) => (
          <View key={ad.id} style={styles.campaignRow}>
            {ad.image_urls[0] ? <Image source={{ uri: ad.image_urls[0] }} style={styles.campaignImage} /> : null}
            <View style={styles.campaignCopy}>
              <Text style={styles.campaignTitle} numberOfLines={1}>{ad.title}</Text>
              <Text style={styles.campaignMeta} numberOfLines={1}>
                {ad.status === 'active' ? 'Ativo' : ad.status === 'paused' ? 'Pausado' : 'Rascunho'} · {ad.image_urls.length} imagens · {Number(ad.rating_average || 0).toFixed(1)} ★ ({ad.rating_count})
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.statusButton, ad.status === 'active' && styles.statusButtonActive]}
              onPress={() => toggleStatus(ad)}
              disabled={busyAdId === ad.id}
            >
              {busyAdId === ad.id ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
                <Text style={[styles.statusButtonText, ad.status === 'active' && styles.statusButtonTextActive]}>
                  {ad.status === 'active' ? 'Pausar' : 'Ativar'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function AgrilinkAdsScreen() {
  return (
    <AdminOnly>
      <AdsManagerContent />
    </AdminOnly>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: COLORS.surface },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  title: { marginTop: 3, color: COLORS.text, fontSize: 24, fontWeight: '800' },
  formSection: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  sectionCaption: { marginTop: 5, marginBottom: 14, color: COLORS.muted, fontSize: 11.5, lineHeight: 17 },
  label: { marginTop: 13, marginBottom: 7, color: COLORS.text, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, backgroundColor: COLORS.canvas, color: COLORS.text, fontSize: 13 },
  descriptionInput: { minHeight: 102, paddingTop: 11 },
  imagesHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  imageCount: { color: COLORS.muted, fontSize: 10.5 },
  addImagesButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EAF3EA' },
  addImagesText: { color: COLORS.primary, fontSize: 11.5, fontWeight: '800' },
  imageStrip: { gap: 9, paddingVertical: 12 },
  imagePreviewWrap: { position: 'relative' },
  imagePreview: { width: 82, height: 82, borderRadius: 11, backgroundColor: COLORS.canvas },
  removeImage: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: 'rgba(22,35,28,0.78)' },
  errorText: { marginTop: 12, color: COLORS.danger, fontSize: 12, lineHeight: 18 },
  publishButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 15, borderRadius: 12, backgroundColor: COLORS.primary },
  publishText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 8 },
  emptyText: { paddingVertical: 22, color: COLORS.muted, fontSize: 12, textAlign: 'center' },
  campaignRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  campaignImage: { width: 52, height: 52, borderRadius: 9, backgroundColor: COLORS.border },
  campaignCopy: { flex: 1 },
  campaignTitle: { color: COLORS.text, fontSize: 12.5, fontWeight: '800' },
  campaignMeta: { marginTop: 4, color: COLORS.muted, fontSize: 10 },
  statusButton: { minWidth: 58, minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: COLORS.border },
  statusButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusButtonText: { color: COLORS.text, fontSize: 10.5, fontWeight: '800' },
  statusButtonTextActive: { color: '#FFFFFF' },
});