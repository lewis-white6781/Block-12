// Email OTP sign-in gate — wraps App.tsx's HashRouter tree so no tab is
// reachable while signed out. Uses a typed 6-digit code, not a magic-link
// redirect, since a magic-link's #access_token=... fragment would collide
// with HashRouter's own use of location.hash. See SPEC-V2.0.md section 4.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

type AuthState = 'checking' | 'signed-out' | 'code-sent' | 'signed-in';

const inputClass =
  'min-h-11 w-full rounded border border-line bg-surface-2 px-3 text-base text-text';

export default function Auth({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setAuthState(data.session ? 'signed-in' : 'signed-out');
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setAuthState(session ? 'signed-in' : 'signed-out');
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSendCode() {
    setError(null);
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setAuthState('code-sent');
  }

  async function handleVerifyCode() {
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    setBusy(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    // onAuthStateChange handles the transition to signed-in
  }

  if (authState === 'checking') {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (authState === 'signed-in') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full flex-col justify-center bg-bg p-4">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-display text-2xl text-text">BLOCK 12</h1>
        <p className="mt-1 text-sm text-muted">Sign in to sync your training data.</p>

        {authState === 'signed-out' && (
          <div className="mt-6 space-y-3">
            <label className="block">
              <div className="text-xs uppercase tracking-wide text-muted">Email</div>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                className={`${inputClass} mt-1`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button
              type="button"
              disabled={busy || !email}
              onClick={handleSendCode}
              className="min-h-11 w-full rounded bg-good text-base font-medium text-bg disabled:opacity-40"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </div>
        )}

        {authState === 'code-sent' && (
          <div className="mt-6 space-y-3">
            <p className="text-xs text-muted">
              A 6-digit code was sent to <span className="text-text">{email}</span>.
            </p>
            <label className="block">
              <div className="text-xs uppercase tracking-wide text-muted">Code</div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className={`${inputClass} mt-1 tracking-widest`}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
              />
            </label>
            <button
              type="button"
              disabled={busy || code.length !== 6}
              onClick={handleVerifyCode}
              className="min-h-11 w-full rounded bg-good text-base font-medium text-bg disabled:opacity-40"
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthState('signed-out');
                setCode('');
                setError(null);
              }}
              className="min-h-11 w-full rounded border border-line text-sm text-text"
            >
              Use a different email
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-bad">{error}</p>}
      </div>
    </div>
  );
}
