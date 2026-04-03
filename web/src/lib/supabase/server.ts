import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client.
 * Uses the service role key for admin operations.
 * NEVER expose this client to the browser.
 */
export function createServerClient() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ QuickCash Server: Supabase no configurado.');
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
