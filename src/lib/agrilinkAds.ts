import * as Crypto from 'expo-crypto';
import type { ImagePickerAsset } from 'expo-image-picker';
import { supabase } from './supabase';

export type AgrilinkAd = {
  id: string;
  title: string;
  description: string;
  target_url: string;
  image_urls: string[];
  status: 'draft' | 'active' | 'paused';
  created_by: string;
  created_at: string;
  updated_at: string;
  rating_average: number;
  rating_count: number;
  current_rating?: number | null;
};

const AD_BUCKET = 'agrilink-ads';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE = 12 * 1024 * 1024;

function decodeBase64(base64: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(Math.floor(base64.length * 3 / 4) - padding);
  let outputIndex = 0;

  for (let index = 0; index < base64.length; index += 4) {
    const a = alphabet.indexOf(base64[index]);
    const b = alphabet.indexOf(base64[index + 1]);
    const c = base64[index + 2] === '=' ? 0 : alphabet.indexOf(base64[index + 2]);
    const d = base64[index + 3] === '=' ? 0 : alphabet.indexOf(base64[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('O conteúdo da imagem está inválido.');

    const chunk = (a << 18) | (b << 12) | (c << 6) | d;
    if (outputIndex < bytes.length) bytes[outputIndex++] = (chunk >> 16) & 0xff;
    if (outputIndex < bytes.length) bytes[outputIndex++] = (chunk >> 8) & 0xff;
    if (outputIndex < bytes.length) bytes[outputIndex++] = chunk & 0xff;
  }
  return bytes;
}

export function getAgrilinkAdErrorCode(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (
    message.includes('bucket not found') ||
    message.includes('agrilink_ads') && (message.includes('does not exist') || message.includes('schema cache'))
  ) {
    return 'migrationRequired';
  }
  if (message.includes('row-level security') || message.includes('permission denied') || message.includes('403')) {
    return 'permissionsRequired';
  }
  if (message.includes('network request failed') || message.includes('failed to fetch')) {
    return 'networkUnavailable';
  }
  return null;
}

async function removeUploadedImages(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(AD_BUCKET).remove(paths);
  if (error) console.error('[Ads] Não foi possível remover imagens de um anúncio incompleto:', error);
}

export async function isAgrilinkAdmin() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.warn('[Admin] Não foi possível verificar a conta autenticada:', userError);
    return false;
  }

  if (!userData.user) return false;

  const { data, error } = await supabase.rpc('is_agrilink_admin');
  if (error) {
    console.warn('[Admin] Não foi possível verificar a função administrativa:', error);
  }
  return !error && data === true;
}

async function requireAdminUser() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Inicie sessão com uma conta de administrador para gerir anúncios.');

  const { data: allowed, error: adminError } = await supabase.rpc('is_agrilink_admin');
  if (adminError) {
    throw new Error(`Não foi possível validar as permissões administrativas. Aplique as migrações do Supabase: ${adminError.message}`);
  }
  if (!allowed) {
    throw new Error('Apenas administradores podem gerir anúncios.');
  }

  return auth.user;
}

async function uploadAdImages(userId: string, adId: string, images: ImagePickerAsset[]) {
  const bucket = supabase.storage.from(AD_BUCKET);
  const paths: string[] = [];
  const urls: string[] = [];

  try {
    for (const [index, asset] of images.entries()) {
      if (!asset.base64) {
        throw new Error(`Não foi possível ler a imagem ${index + 1}. Selecione-a novamente.`);
      }
      if (asset.base64.length > Math.ceil(MAX_IMAGE_SIZE * 4 / 3) + 4) {
        throw new Error(`A imagem ${index + 1} excede o limite de 12 MB.`);
      }
      const imageBytes = decodeBase64(asset.base64);
      const mimeType = asset.mimeType ||
        (asset.fileName?.toLowerCase().endsWith('.png') ? 'image/png' :
          asset.fileName?.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg');
      if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
        throw new Error(`A imagem ${index + 1} deve estar em JPEG, PNG ou WebP.`);
      }
      if (imageBytes.byteLength > MAX_IMAGE_SIZE) {
        throw new Error(`A imagem ${index + 1} excede o limite de 12 MB.`);
      }
      const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice('image/'.length);
      const path = `${userId}/${adId}/${index + 1}-${Crypto.randomUUID()}.${extension}`;
      const { error } = await bucket.upload(path, imageBytes, { contentType: mimeType, upsert: false });
      if (error) throw error;

      paths.push(path);
      urls.push(bucket.getPublicUrl(path).data.publicUrl);
    }
  } catch (error) {
    await removeUploadedImages(paths);
    throw error;
  }

  return { paths, urls };
}

export async function publishAgrilinkAd(input: {
  title: string;
  description: string;
  targetUrl: string;
  images: ImagePickerAsset[];
}) {
  if (input.images.length < 3) throw new Error('Cada anúncio precisa de pelo menos 3 imagens.');

  const user = await requireAdminUser();
  const adId = Crypto.randomUUID();
  const { paths, urls } = await uploadAdImages(user.id, adId, input.images);
  const { data, error } = await supabase
    .from('agrilink_ads')
    .insert({
      id: adId,
      title: input.title.trim(),
      description: input.description.trim(),
      target_url: input.targetUrl.trim(),
      image_urls: urls,
      status: 'active',
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) {
    await removeUploadedImages(paths);
    throw error;
  }

  return data as AgrilinkAd;
}

export async function loadAgrilinkAds(options: { activeOnly?: boolean; userId?: string | null } = {}) {
  let query = supabase.from('agrilink_ads').select('*').order('created_at', { ascending: false });
  if (options.activeOnly) query = query.eq('status', 'active');

  const { data, error } = await query.limit(60);
  if (error) throw error;
  const ads = (data || []) as AgrilinkAd[];

  if (!options.userId || ads.length === 0) return ads;
  const { data: ratings, error: ratingsError } = await supabase
    .from('agrilink_ad_ratings')
    .select('ad_id, rating')
    .eq('user_id', options.userId)
    .in('ad_id', ads.map((ad) => ad.id));

  if (ratingsError) {
    console.warn('[Ads] Não foi possível carregar as avaliações do utilizador:', ratingsError);
    return ads;
  }
  const ratingByAd = new Map<string, number>(
    (ratings || []).map((rating) => [rating.ad_id, rating.rating]),
  );
  return ads.map((ad) => ({ ...ad, current_rating: ratingByAd.get(ad.id) ?? null }));
}

export async function setAgrilinkAdStatus(id: string, status: AgrilinkAd['status']) {
  await requireAdminUser();
  const { data, error } = await supabase
    .from('agrilink_ads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as AgrilinkAd;
}

export async function rateAgrilinkAd(id: string, rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('A avaliação deve ser entre 1 e 5 estrelas.');
  }
  const { data, error } = await supabase.rpc('rate_agrilink_ad', {
    p_ad_id: id,
    p_rating: rating,
  });
  if (error) throw error;
  return data?.[0] as { rating_average: number; rating_count: number } | undefined;
}