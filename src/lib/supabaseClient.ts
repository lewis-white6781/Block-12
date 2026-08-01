import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in environment. ' +
    'Create a .env file with these values from your Supabase project.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Magic-link sign-in puts tokens in the URL hash, which HashRouter also reads
    // for routing. main.tsx's bootstrap() waits for Supabase to consume the hash
    // and cleans it BEFORE the router ever mounts, so this is safe.
    detectSessionInUrl: true,
  },
});
