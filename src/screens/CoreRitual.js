import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { getDailyPrompt } from '../constants/prompts';
import { EntryStore } from '../services/EntryStore';
import { tagEntry } from '../utils/themeTagger';
import { PressableScale } from '../components/PressableScale';
import { SparkChips } from '../components/SparkChips';
import { WelcomeBee } from '../components/WelcomeBee';

const { width, height } = Dimensions.get('window');

// --- COMPONENT: LockScreen ---
export const LockScreen = ({ onEnterRitual }) => {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.32] });

  return (
    <View style={[styles.container, styles.lockContainer]}>
      {/* Depth glow on top of the solid canvas, not instead of it — a
          deeper amber breathing underneath ink content so the screen still
          reads as one confident field of Golden Honey, not accent-on-cream. */}
      <Animated.View
        style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      />

      <View style={styles.content}>
        <WelcomeBee size={104} />
        <Text style={styles.logo}>gratitude</Text>
        <Text style={styles.prompt}>Pause.{"\n"}What are you grateful for today?</Text>

        <PressableScale style={styles.primaryButton} onPress={onEnterRitual} haptic={Haptics.ImpactFeedbackStyle.Medium}>
          <Text style={styles.buttonText}>Enter Ritual</Text>
        </PressableScale>
      </View>
    </View>
  );
};

// --- COMPONENT: InputScreen ---
export const InputScreen = ({ onUnlock }) => {
  const [text, setText] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const formAnim = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const dailyPrompt = getDailyPrompt();

  const handleSave = () => {
    if (!text.trim() || unlocking) return;
    const themeTag = tagEntry(text);
    EntryStore.saveEntry(new Date(), text, themeTag);
    setUnlocking(true);

    Animated.timing(formAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.spring(badgeScale, {
          toValue: 1,
          friction: 5,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.timing(badgeOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => onUnlock(text), 900);
      });
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {unlocking && (
        <View style={styles.unlockOverlay} pointerEvents="none">
          <Animated.View
            style={[
              styles.unlockBadge,
              { opacity: badgeOpacity, transform: [{ scale: badgeScale }] },
            ]}
          >
            <Text style={styles.unlockCheck}>✓</Text>
          </Animated.View>
          <Animated.Text style={[styles.unlockingText, { opacity: badgeOpacity }]}>
            Unlocked. Enjoy your day.
          </Animated.Text>
        </View>
      )}

      <Animated.View style={[styles.content, { opacity: formAnim }]}>
        <Text style={styles.logoSmall}>gratitude</Text>
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
          />
        </View>

        <PressableScale
          style={[styles.primaryButton, { backgroundColor: theme.colors.ink }]}
          onPress={handleSave}
          disabled={!text.trim() || unlocking}
          haptic={Haptics.ImpactFeedbackStyle.Medium}
        >
          <Text style={[styles.buttonText, { color: theme.colors.background }]}>Unlock Apps</Text>
        </PressableScale>
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
  // Full solid Golden Honey canvas for the ritual gate specifically — this
  // is the one moment the app should feel unmistakably vibrant, not
  // cream-with-an-accent. InputScreen (the actual writing surface) stays
  // on `container`'s cream base: comfortable to read/write on, and every
  // nested piece there (SparkChips label, etc.) is already tuned for
  // cream contrast rather than gold.
  lockContainer: {
    backgroundColor: theme.colors.accent,
  },
  glow: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    backgroundColor: theme.colors.accentDeep,
    borderRadius: width,
    top: -width * 0.3,
  },
  content: {
    width: '85%',
    alignItems: 'center',
    zIndex: 1,
  },
  logo: {
    ...theme.type.logo,
    fontSize: 68,
    color: theme.colors.ink,
    marginTop: 12,
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
    // Full ink, not textSecondary — inkSoft only clears ~3.5:1 against the
    // solid Golden Honey canvas (fails AA). Hierarchy here comes from size
    // and weight, not a lighter tint.
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: 50,
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
  primaryButton: {
    // Ink pill, not accent-filled — on a solid Golden Honey canvas an
    // accent button disappears into the background. Matches the Sunbeam
    // rule that yellow never fills the CTA anyway.
    backgroundColor: theme.colors.ink,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: theme.borderRadius.full,
    width: '100%',
    alignItems: 'center',
    ...theme.shadows.tinted(theme.colors.accentDeep),
  },
  buttonText: {
    ...theme.type.button,
    color: theme.colors.background,
  },
  unlockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  unlockBadge: {
    // Ink, not accent — the ritual screen's canvas is now solid Golden
    // Honey (see `container`), so an accent-filled badge would vanish
    // into the background it's celebrating on top of.
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...theme.shadows.tinted(theme.colors.accentDeep),
  },
  unlockCheck: {
    fontSize: 44,
    color: theme.colors.background,
    fontFamily: theme.fonts.headerExtraBold,
  },
  unlockingText: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.ink,
    fontSize: 18,
    textAlign: 'center',
  }
});
