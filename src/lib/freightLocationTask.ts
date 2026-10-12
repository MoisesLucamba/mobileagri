import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { supabase } from './supabase';

export const FREIGHT_LOCATION_TASK = 'agrilink-freight-location';

type FreightLocationTaskData = {
  locations?: Location.LocationObject[];
};

if (!TaskManager.isTaskDefined(FREIGHT_LOCATION_TASK)) {
  TaskManager.defineTask<FreightLocationTaskData>(FREIGHT_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('[FreightLocationTask] O sistema não conseguiu obter a localização:', error.message);
      return;
    }

    const locations = data?.locations ?? [];
    if (!locations.length) return;

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const driverId = authData.user?.id;
      if (!driverId) {
        if (await Location.hasStartedLocationUpdatesAsync(FREIGHT_LOCATION_TASK)) {
          await Location.stopLocationUpdatesAsync(FREIGHT_LOCATION_TASK);
        }
        return;
      }

      const { data: activeLoads, error: loadError } = await supabase
        .from('freight_loads')
        .select('id')
        .eq('driver_id', driverId)
        .eq('status', 'in_transit');
      if (loadError) throw loadError;

      if (!activeLoads?.length) {
        if (await Location.hasStartedLocationUpdatesAsync(FREIGHT_LOCATION_TASK)) {
          await Location.stopLocationUpdatesAsync(FREIGHT_LOCATION_TASK);
        }
        return;
      }

      for (const position of locations) {
        for (const load of activeLoads) {
          const { error: trackingError } = await supabase.rpc('update_freight_tracking_location', {
            p_freight_load_id: load.id,
            p_latitude: position.coords.latitude,
            p_longitude: position.coords.longitude,
          });
          if (trackingError) {
            console.error('[FreightLocationTask] Não foi possível guardar uma posição:', trackingError);
          }
        }
      }
    } catch (taskError) {
      console.error('[FreightLocationTask] Falha ao atualizar o rastreio:', taskError);
    }
  });
}
