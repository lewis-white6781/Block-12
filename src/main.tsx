import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { supabase } from './lib/supabaseClient'

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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline install still works without the SW on repeat visits via HTTP cache;
      // nothing user-facing to do if registration itself fails.
    });
  });
}
