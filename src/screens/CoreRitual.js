import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Animated,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { theme } from '../constants/theme';
import { getDailyPrompt } from '../constants/prompts';
import { EntryStore } from '../services/EntryStore';
import * as Haptics from 'expo-haptics';
import { SparkChips } from '../components/SparkChips';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';
import { GlowOrb } from '../components/GlowOrb';
import { WelcomeBee } from '../components/WelcomeBee';
import { CelebrationBadge } from '../components/CelebrationBadge';
import { CelebrationRays } from '../components/CelebrationRays';

// --- COMPONENT: LockScreen ---
export const LockScreen = ({ onOpen }) => {
  const { width } = useWindowDimensions();

  // Visible demo trigger (Colin, 2026-08-10: wants a real button, not the
  // old hidden 5-tap gesture) — seeds 180 days of realistic demo entries so
  // Wrapped and Recap have something worth showing.
  const handleLoadDemoData = () => {
    EntryStore.seedDemoData(180)
      .then((count) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Demo data loaded', `Filled the last ${count} days with entries.`);
      })
      .catch(() => {
        Alert.alert('Couldn\'t load demo data', 'Something went wrong — try again.');
      });
  };

  return (
    <View style={styles.container}>
      {/* Was a flat 1.5x-screen accent disc at 15-25% opacity, which left a
          hard circular edge visible across the cream. GlowOrb runs the same
          light out to fully transparent, so it reads as light instead of a
          pale yellow shape. */}
      <GlowOrb size={width * 1.6} breathe intensity={0.55} style={{ top: -width * 0.35 }} />

      <View style={styles.content}>
        {/* Sits inside the orb, unlit by anything of its own — the light is
            GlowOrb's job. Gives the gate a face to arrive at instead of
            opening on a wordmark and a question. */}
        <WelcomeBee size={132} />
        <Text style={styles.logo}>Pollinate</Text>
        <Text style={styles.prompt}>Pause.{"\n"}What are you grateful for today?</Text>

        {/* Medium, not the default Light: this is the one tap in the app
            that crosses a threshold rather than adjusting something. */}
        <PrimaryButton onPress={onOpen} haptic={Haptics.ImpactFeedbackStyle.Medium}>
          Begin
        </PrimaryButton>

        {/* Lumen's design assessment (thread 37fb8ef6, WP-10a): a dev
            affordance sitting on the ritual gate ships to every tester.
            Colin's 2026-08-10 note ("wants a real button, not the old
            hidden 5-tap gesture") was about discoverability during
            development, not about shipping it past __DEV__. */}
        {__DEV__ && (
          <PressableScale onPress={handleLoadDemoData} style={styles.demoDataLink}>
            <Text style={styles.demoDataLinkText}>Load demo data</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
};

// --- COMPONENT: InputScreen ---
export const InputScreen = ({ onUnlock }) => {
  const [text, setText] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const formAnim = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const dailyPrompt = getDailyPrompt();

  const handleSave = () => {
    if (!text.trim() || unlocking) return;
    // Does not call EntryStore.saveEntry here — during onboarding (Flow C)
    // there is no session yet and the write would throw 'Not signed in'
    // (Sage, thread 19e90cf8: identical shape to Onboarding.js's own
    // pre-auth entry step). onUnlock hands the raw text to the caller,
    // which buffers it and saves once an account exists.
    setUnlocking(true);

    Animated.timing(formAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // CelebrationBadge + CelebrationRays run their own spring, haptic and
      // burst on mount (spec §4/§11.3) — this used to be a second,
      // hand-rolled 96pt badge drawing a "✓" as a text character while the
      // real component sat unused. Fade the overlay in and let them land.
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          // Bumble caught this (thread 19e90cf8, 2026-08-13): the signed-in
          // caller's onUnlock (App.js) now does a real EntryStore.saveEntry
          // before navigating, so it can reject — a discarded setTimeout
          // return used to mean a failure left the celebration overlay up
          // forever with unlocking stuck true and no way to retry.
          // Promise.resolve wraps the demo-mode caller too (Onboarding.js's
          // LockDemoStep.onSave is synchronous), so this is safe either way.
          Promise.resolve(onUnlock(text)).catch(() => {
            Alert.alert("Couldn't save", "Your entry didn't save — try again.");
            Animated.parallel([
              Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(formAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => setUnlocking(false));
          });
        }, 1400);
      });
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.backgroundWriting }]}
    >
      {unlocking && (
        <Animated.View
          style={[styles.unlockOverlay, { opacity: overlayOpacity }]}
          pointerEvents="none"
        >
          <View style={styles.badgeStage}>
            <CelebrationRays />
            <CelebrationBadge />
          </View>
          <Text style={styles.unlockingText}>Your day is open. Enjoy it.</Text>
        </Animated.View>
      )}

      <Animated.View style={[styles.content, { opacity: formAnim }]}>
        <Text style={styles.logoSmall}>Pollinate</Text>
        <Text style={styles.promptQuestion}>{dailyPrompt.question}</Text>

        <SparkChips
          sparks={dailyPrompt.sparks}
          visible={!text.trim()}
          onPick={(spark) => setText(`I am grateful for ${spark}.`)}
        />

        <View style={styles.inputCard}>
          <TextInput
            style={styles.textInput}
            placeholder="I am grateful for..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            value={text}
            onChangeText={setText}
            autoFocus
            editable={!unlocking}
            maxLength={10000}
          />
        </View>

        <PrimaryButton onPress={handleSave} disabled={!text.trim() || unlocking}>
          Open my day
        </PrimaryButton>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '85%',
    alignItems: 'center',
    zIndex: 1,
  },
  logo: {
    ...theme.type.logo,
    fontSize: 68,
    color: theme.colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  logoSmall: {
    ...theme.type.logo,
    fontSize: 32,
    color: theme.colors.textPrimary,
    marginBottom: 40,
    textAlign: 'center',
  },
  prompt: {
    ...theme.type.bodyLg,
    fontSize: 24,
    lineHeight: 32,
    fontFamily: theme.fonts.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 50,
  },
  demoDataLink: {
    alignSelf: 'center',
    marginTop: 16,
  },
  demoDataLinkText: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    textDecorationLine: 'underline',
  },
  promptQuestion: {
    ...theme.type.h3,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 24,
    marginBottom: 40,
    minHeight: 200,
    ...theme.shadows.card,
  },
  textInput: {
    fontFamily: theme.fonts.body,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
  unlockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.washYellow,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  // CelebrationRays anchors to the center of a 96pt box (its documented
  // pairing), so the badge needs that exact stage to burst around.
  badgeStage: {
    width: 96,
    height: 96,
    marginBottom: 32,
  },
  unlockingText: {
    ...theme.type.h3,
    color: theme.colors.ink,
    textAlign: 'center',
  },
});
