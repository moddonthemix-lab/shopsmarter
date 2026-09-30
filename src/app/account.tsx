import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform } from 'react-native';

import { useTheme } from '@/components/theme';
import { Button, Card, Field, Label, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAppState } from '@/state/AppState';

WebBrowser.maybeCompleteAuthSession();

type Provider = 'google' | 'apple';

async function signInWithProvider(provider: Provider) {
  if (!supabase) return;
  if (Platform.OS === 'web') {
    // Full-page redirect; the client picks the session up from the URL.
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) throw error;
    return;
  }
  const redirectTo = Linking.createURL('account');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;
  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Sign-in was cancelled.');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export default function AccountScreen() {
  const t = useTheme();
  const { session } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Something went wrong.', error: true });
    } finally {
      setBusy(null);
    }
  };

  if (!supabase) {
    return (
      <Screen>
        <Label variant="muted">
          Accounts need a Supabase backend. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see README).
        </Label>
      </Screen>
    );
  }
  const client = supabase;

  if (session) {
    return (
      <Screen>
        <Card>
          <Label variant="heading">Signed in</Label>
          <Label variant="muted">{session.user.email}</Label>
          <Button
            title="Sign out"
            kind="danger"
            loading={busy === 'out'}
            onPress={() =>
              run('out', async () => {
                await client.auth.signOut();
                router.back();
              })
            }
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Label variant="heading">Sign in with email</Label>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        <Button
          title="Sign in"
          loading={busy === 'in'}
          disabled={!email || !password}
          onPress={() =>
            run('in', async () => {
              const { error } = await client.auth.signInWithPassword({ email, password });
              if (error) throw error;
              router.back();
            })
          }
        />
        <Button
          title="Create account"
          kind="secondary"
          loading={busy === 'up'}
          disabled={!email || password.length < 6}
          onPress={() =>
            run('up', async () => {
              const { data, error } = await client.auth.signUp({ email, password });
              if (error) throw error;
              if (!data.session) setMessage({ text: 'Check your email to confirm your account.' });
              else router.back();
            })
          }
        />
      </Card>

      <Card>
        <Button
          title="Continue with Google"
          kind="secondary"
          loading={busy === 'google'}
          onPress={() => run('google', () => signInWithProvider('google'))}
        />
        {Platform.OS !== 'android' ? (
          <Button
            title="Continue with Apple"
            kind="secondary"
            loading={busy === 'apple'}
            onPress={() => run('apple', () => signInWithProvider('apple'))}
          />
        ) : null}
      </Card>

      {message ? <Label style={{ color: message.error ? t.danger : t.primary }}>{message.text}</Label> : null}
    </Screen>
  );
}
