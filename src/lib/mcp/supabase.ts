import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
function configuredEnv(names: string[]): string | undefined {
  for (const n of names) { const value = process.env[n]?.trim(); if (value) return value; }
}
export function supabaseAnon() {
  const url = configuredEnv(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
  let key = configuredEnv(['SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_PUBLISHABLE_KEY']);
  if (!key) {
    try { const keys: unknown = JSON.parse(process.env['SUPABASE_PUBLISHABLE_KEYS'] ?? '{}');
      if (keys && typeof keys === 'object' && !Array.isArray(keys)) { const values = keys as Record<string, unknown>; key = [values.default,...Object.values(values)].find((v): v is string => typeof v === 'string' && v.trim().startsWith('sb_publishable_'))?.trim(); }
    } catch { /* A legacy key may still be available. */ }
  }
  key ??= configuredEnv(['SUPABASE_ANON_KEY','VITE_SUPABASE_ANON_KEY']);
  if (!url || !key) throw new Error('Public database configuration missing');
  return createClient<Database>(url,key,{ auth: {persistSession:false,autoRefreshToken:false} });
}
