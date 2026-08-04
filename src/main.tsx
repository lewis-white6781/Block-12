import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { supabase } from './lib/supabaseClient'
import { startUpdateWatcher } from './pwa/updates'

// A magic-link sign-in redirects back here with tokens in the URL hash
// (#access_token=...&type=magiclink), but HashRouter also reads location.hash
// for routing. If we let HashRouter mount first, it treats the token string as
// a bogus route. So: wait for Supabase to consume the hash and establish the
// session, THEN wipe the hash back to a clean "/" before the router ever mounts.
async function bootstrap() {
  const hash = window.location.hash;
  const isAuthRedirect = /access_token|type=magiclink|type=recovery|error=/.test(hash);

  if (isAuthRedirect) {
    await supabase.auth.getSession(); // waits for detectSessionInUrl's processing to finish
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();

// v3.0 (SPEC-V3.0.md section 5): registration moves into startUpdateWatcher,
// which also keeps the worker checked and decides when it is safe to swap.
// The bare register() this replaces had no updatefound listener, no periodic
// check and no way to reload into a new build, so a deployed update could sit
// undetected on an installed PWA indefinitely.
if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    startUpdateWatcher();
  });
}
