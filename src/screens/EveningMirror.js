import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, useWindowDimensions } from 'react-native';
import { theme } from '../constants/theme';
import { GlowOrb } from '../components/GlowOrb';
import { PressableScale } from '../components/PressableScale';
import { DURATIONS, SPRINGS, useReducedMotion } from '../constants/motion';

export const EveningMirror = ({ gratitudeText, onClose }) => {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (reduced) {
      scaleAnim.setValue(1);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: DURATIONS.reducedMotionFade,
        useNativeDriver: true,
      }).start();
      return;
    }
    // Slow, settling entrance — this is the wind-down screen, so it takes
    // its time where the rest of the app snaps.
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...SPRINGS.glide,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduced]);

  return (
    <View style={styles.container}>
      {/* Ambient evening light, rising from the bottom for a sunset feel.
          A gradient orb rather than the flat 10%-opacity disc this used to
          be — that left a hard circular edge across the cream. */}
      <GlowOrb
        size={width * 1.4}
        intensity={0.4}
        style={{ bottom: -width * 0.5, left: -width * 0.2 }}
      />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.header}>Tonight's Reflection</Text>
        
        <View style={styles.quoteCard}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.gratitudeText}>
            {gratitudeText || "You didn't record anything today, but you are still worthy of gratitude."}
          </Text>
          <Text style={styles.quoteMarkEnd}>”</Text>
        </View>

        <PressableScale style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Rest well</Text>
        </PressableScale>
      </Animated.View>
    </View>
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
    width: '80%',
    alignItems: 'center',
  },
  header: {
    ...theme.type.label,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 40,
    textAlign: 'center',
  },
  quoteCard: {
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 60,
  },
  quoteMark: {
    fontFamily: theme.fonts.logo,
    fontSize: 80,
    color: theme.colors.accent,
    position: 'absolute',
    top: -40,
    left: 0,
    opacity: 0.5,
  },
  quoteMarkEnd: {
    fontFamily: theme.fonts.logo,
    fontSize: 80,
    color: theme.colors.accent,
    position: 'absolute',
    bottom: -40,
    right: 0,
    opacity: 0.5,
  },
  gratitudeText: {
    fontFamily: theme.fonts.bodyItalic,
    fontSize: 28,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
  },
  closeButton: {
    marginTop: 40,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.ink,
  },
  closeButtonText: {
    ...theme.type.button,
    fontSize: 16,
    color: theme.colors.background,
  },
});
