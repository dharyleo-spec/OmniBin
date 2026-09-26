import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl =
  'https://ugstgbcrnuonvciytuth.supabase.co';

const supabasePublishableKey =
  'sb_publishable_THJMYy81n37OjNbN2RitLA_s9QJhswW';

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage:
        Platform.OS === 'web'
          ? undefined
          : AsyncStorage,

      autoRefreshToken: true,

      persistSession: true,

      detectSessionInUrl: false,
    },
  }
);

// --------------------------------------------------
// SUPABASE AUTH AUTO REFRESH
// --------------------------------------------------

if (Platform.OS !== 'web') {
  AppState.addEventListener(
    'change',
    (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    }
  );
}