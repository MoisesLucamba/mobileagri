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

export async function isAgrilinkAdmin() {
  const { data, error } = await supabase.rpc('is_agrilink_admin');
  return !error && data === true;
}

async function requireAdminUser() {
  const [{ data: auth, error: authError }, allowed] = await Promise.all([
    supabase.auth.getUser(),
    isAgrilinkAdmin(),
  ]);

  if (authError || !auth.user || !allowed) {
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
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const mimeType = asset.mimeType || 'image/jpeg';
      const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'jpg';
      const path = `${userId}/${adId}/${index + 1}-${Crypto.randomUUID()}.${extension}`;
      const { error } = await bucket.upload(path, blob, { contentType: mimeType, upsert: false });
      if (error) throw error;

      paths.push(path);
      urls.push(bucket.getPublicUrl(path).data.publicUrl);
    }
  } catch (error) {
    if (paths.length) await bucket.remove(paths);
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
    if (paths.length) await supabase.storage.from(AD_BUCKET).remove(paths);
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

  if (ratingsError) return ads;
  const ratingByAd = new Map((ratings || []).map((rating: any) => [rating.ad_id, rating.rating]));
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