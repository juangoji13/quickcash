import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // During build/SSG, create a dummy client that won't be used
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
  if (typeof window !== 'undefined') {
    console.warn(
      '⚠️ QuickCash: Supabase no configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local'
    );
  }
}

export { supabase };
