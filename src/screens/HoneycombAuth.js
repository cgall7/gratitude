import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { theme } from '../constants/theme';
import { HoneycombStore } from '../services/HoneycombStore';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';
import { Bee } from '../components/Bee';

// Gate screen shown when there's no Supabase session yet. Same email +
// password Colin turned on in Auth → Providers — one form, one toggle
// between sign in and sign up, no separate "forgot password" flow yet.
export const HoneycombAuth = () => {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const isSignUp = mode === 'signup';
  const canSubmit = email.trim() && password.length >= 6 && (!isSignUp || displayName.trim()) && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        const result = await HoneycombStore.signUp(email.trim(), password, displayName.trim());
        if (!result.session) {
          setConfirmSent(true);
        }
      } else {
        await HoneycombStore.signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Bee size={32} />
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to {email.trim()}. Tap it, then come back and sign in.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Bee size={32} />
        <Text style={styles.title}>Honeycomb</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'Create an account to connect and share.' : 'Sign in to see what your people are grateful for.'}
        </Text>

        <View style={styles.form}>
          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={theme.colors.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              editable={!busy}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={theme.colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (6+ characters)"
            placeholderTextColor={theme.colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!busy}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton onPress={handleSubmit} disabled={!canSubmit} style={styles.submit}>
          {busy ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
        </PrimaryButton>

        <PressableScale onPress={() => setMode(isSignUp ? 'signin' : 'signup')} haptic={null}>
          <Text style={styles.switchText}>
            {isSignUp ? 'Already have an account? Sign in' : "New here? Create an account"}
          </Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 100,
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
    marginBottom: 32,
  },
  form: {
    gap: 12,
    marginBottom: 8,
  },
  input: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  error: {
    ...theme.type.bodySm,
    color: theme.colors.danger,
    marginTop: 12,
  },
  submit: {
    marginTop: 20,
    marginBottom: 16,
  },
  switchText: {
    ...theme.type.bodySm,
    color: theme.colors.accentDeep,
    textAlign: 'center',
  },
});
