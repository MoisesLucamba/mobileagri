import * as ImagePicker from 'expo-image-picker';
import { type Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Image,
    InteractionManager,
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
import ProcessingScreen from '../components/ProcessingScreen';
import {
    AgrilinkAd,
    getAgrilinkAdErrorCode,
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
  const { t } = useTranslation();
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
      const loadedAds = await loadAgrilinkAds();
      setAds(loadedAds);
      setError('');
    } catch (loadError) {
      const errorCode = getAgrilinkAdErrorCode(loadError);
      setError(errorCode
        ? t(`ads.${errorCode}`)
        : loadError instanceof Error ? loadError.message : t('ads.publishError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void refresh();
    });
    return () => task.cancel();
  }, [refresh]);

  const pickImages = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(t('ads.maxImagesTitle'), t('ads.maxImagesMessage', { maximum: MAX_IMAGES }));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
      base64: true,
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
    if (cleanTitle.length < 3) return setError(t('ads.invalidTitle'));
    if (cleanDescription.length < 10) return setError(t('ads.invalidDescription'));
    if (images.length < 3) return setError(t('ads.missingImages'));
    if (images.some((image) => Number(image.fileSize || 0) > 12 * 1024 * 1024)) {
      return setError(t('ads.imageTooLarge'));
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cleanUrl);
    } catch {
      return setError(t('ads.invalidUrl'));
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return setError(t('ads.httpUrl'));
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
      Alert.alert(t('ads.publishedTitle'), t('ads.publishedMessage'));
    } catch (publishError) {
      const errorCode = getAgrilinkAdErrorCode(publishError);
      setError(errorCode
        ? t(`ads.${errorCode}`)
        : publishError instanceof Error ? publishError.message : t('ads.publishError'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (ad: AgrilinkAd) => {
    setBusyAdId(ad.id);
    try {
      const updated = await setAgrilinkAdStatus(ad.id, ad.status === 'active' ? 'paused' : 'active');
      setAds((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (statusError) {
      const errorCode = getAgrilinkAdErrorCode(statusError);
      Alert.alert(
        t('ads.statusError'),
        errorCode
          ? t(`ads.${errorCode}`)
          : statusError instanceof Error ? statusError.message : t('ads.tryAgain'),
      );
    } finally {
      setBusyAdId(null);
    }
  };

  if (loading) return <ProcessingScreen />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 34 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refresh(); }} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/dashboard' as Href)} accessibilityLabel="Voltar ao dashboard">
            <Icon name="chevron-left" size={21} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{t('ads.eyebrow')}</Text>
            <Text style={styles.title}>{t('ads.title')}</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>{t('ads.newAd')}</Text>
          <Text style={styles.sectionCaption}>{t('ads.formCaption')}</Text>

          <Text style={styles.label}>{t('ads.adTitle')}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder={t('ads.titlePlaceholder')}
            placeholderTextColor={COLORS.faint}
            style={styles.input}
          />

          <Text style={styles.label}>{t('ads.description')}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={3000}
            placeholder={t('ads.descriptionPlaceholder')}
            placeholderTextColor={COLORS.faint}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.descriptionInput]}
          />

          <Text style={styles.label}>{t('ads.targetLink')}</Text>
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
              <Text style={[styles.label, { marginBottom: 3 }]}>{t('ads.images')}</Text>
              <Text style={styles.imageCount}>{t('ads.minimumImages', { count: images.length, maximum: MAX_IMAGES })}</Text>
            </View>
            <TouchableOpacity style={styles.addImagesButton} onPress={pickImages} disabled={saving}>
              <Icon name="image" size={16} color={COLORS.primary} />
              <Text style={styles.addImagesText}>{t('ads.selectImages')}</Text>
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
                    accessibilityLabel={t('ads.removeImage')}
                  >
                    <Icon name="close" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity style={[styles.publishButton, saving && styles.disabled]} onPress={publish} disabled={saving}>
            <Icon name="send" size={16} color="#FFFFFF" />
            <Text style={styles.publishText}>{saving ? t('ads.publishing') : t('ads.publish')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>{t('ads.campaigns')}</Text>
          <Text style={styles.imageCount}>{ads.length}</Text>
        </View>

        {ads.length === 0 ? (
          <Text style={styles.emptyText}>{t('ads.noAds')}</Text>
        ) : null}
        {ads.map((ad) => (
          <View key={ad.id} style={styles.campaignRow}>
            {ad.image_urls[0] ? <Image source={{ uri: ad.image_urls[0] }} style={styles.campaignImage} /> : null}
            <View style={styles.campaignCopy}>
              <Text style={styles.campaignTitle} numberOfLines={1}>{ad.title}</Text>
              <Text style={styles.campaignDescription} numberOfLines={1}>{ad.description}</Text>
              <Text style={styles.campaignMeta} numberOfLines={1}>
                {ad.status === 'active' ? t('ads.active') : ad.status === 'paused' ? t('ads.paused') : t('ads.draft')} · {ad.image_urls.length} {t('ads.images').toLowerCase()} · {Number(ad.rating_average || 0).toFixed(1)} ★ ({ad.rating_count})
              </Text>
              <Text style={styles.campaignLink} numberOfLines={1}>{ad.target_url}</Text>
            </View>
            <TouchableOpacity
              style={[styles.statusButton, ad.status === 'active' && styles.statusButtonActive]}
              onPress={() => toggleStatus(ad)}
              disabled={busyAdId === ad.id}
            >
              <Text style={[styles.statusButtonText, ad.status === 'active' && styles.statusButtonTextActive]}>
                {busyAdId === ad.id ? t('ads.updating') : ad.status === 'active' ? t('ads.pause') : t('ads.activate')}
              </Text>
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
  title: { marginTop: 3, color: COLORS.text, fontSize: 21, fontWeight: '800' },
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
  campaignRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  campaignImage: { width: 58, height: 68, borderRadius: 10, backgroundColor: COLORS.border },
  campaignCopy: { flex: 1 },
  campaignTitle: { color: COLORS.text, fontSize: 12.5, fontWeight: '800' },
  campaignDescription: { marginTop: 3, color: COLORS.muted, fontSize: 10.5 },
  campaignMeta: { marginTop: 3, color: COLORS.muted, fontSize: 9.5 },
  campaignLink: { marginTop: 3, color: COLORS.primary, fontSize: 9.5, fontWeight: '600' },
  statusButton: { minWidth: 58, minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: COLORS.border },
  statusButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusButtonText: { color: COLORS.text, fontSize: 10.5, fontWeight: '800' },
  statusButtonTextActive: { color: '#FFFFFF' },
});