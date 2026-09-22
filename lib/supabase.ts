import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  'https://ugstgbcrnuonvciytuth.supabase.co';

const supabaseKey =
  'sb_publishable_THJMYy81n37OjNbN2RitLA_s9QJhswW';

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);