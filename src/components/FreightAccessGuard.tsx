import { useEffect, useState, type ReactNode } from 'react';

import ProcessingScreen from './ProcessingScreen';
import RoleGuard from './RoleGuard';
import { isAgrilinkAdmin } from '../lib/agrilinkAds';

export default function FreightAccessGuard({ children }: { children: ReactNode }) {
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    void isAgrilinkAdmin()
      .then((allowed) => {
        if (active) setIsAdmin(allowed);
      })
      .catch((error) => {
        console.error('[FreightAccess] Não foi possível verificar o acesso administrativo:', error);
      })
      .finally(() => {
        if (active) setAdminChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!adminChecked) return <ProcessingScreen />;
  if (isAdmin) return <>{children}</>;
  return <RoleGuard allow={['motorista', 'comprador', 'agricultor']}>{children}</RoleGuard>;
}
