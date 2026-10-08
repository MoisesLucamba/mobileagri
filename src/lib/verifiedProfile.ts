import type { User } from '@supabase/supabase-js';

import { supabase } from './supabase';

export async function saveVerifiedUserProfile(user: User): Promise<void> {
  const metadata = user.user_metadata ?? {};
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : '';
  const phone = typeof metadata.phone === 'string' ? metadata.phone : user.phone ?? '';
  const email = user.email ?? (typeof metadata.contact_email === 'string' ? metadata.contact_email : '');
  const userType = typeof metadata.user_type === 'string' ? metadata.user_type : null;

  const { error } = await supabase.from('users').upsert(
    {
      id: user.id,
      full_name: fullName,
      phone,
      email,
      user_type: userType,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Não foi possível guardar os dados do perfil: ${error.message}`);
  }
}
