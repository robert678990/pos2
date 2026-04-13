import { createClient, SupabaseClient } from '@supabase/supabase-js';

const initialUrl = import.meta.env.VITE_SUPABASE_URL || '';
const initialAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export let supabase = isValidUrl(initialUrl) && initialAnonKey
  ? createClient(initialUrl, initialAnonKey)
  : null as any;

export const updateSupabaseClient = (url: string, key: string) => {
  if (isValidUrl(url) && key) {
    supabase = createClient(url, key);
  } else {
    console.warn('Invalid Supabase configuration provided to updateSupabaseClient');
  }
};
