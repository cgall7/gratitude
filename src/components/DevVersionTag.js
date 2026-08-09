import React, { useRef } from 'react';
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { DevSettings } from '../services/devSettings';
import appJson from '../../app.json';

const TAP_THRESHOLD = 5;
const TAP_WINDOW_MS = 1500;

// 5 taps on the version label → hidden flow picker + replay-onboarding
// reset (Pixel §9 gate plan). Never in copy, never a visible setting.
export const DevVersionTag = () => {
  const navigation = useNavigation();
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const openPicker = () => {
    Alert.alert('Demo: onboarding flow', 'Pick the opener to replay onboarding with.', [
      { text: 'Flow A — screen lock', onPress: () => replayWith('A') },
      { text: 'Flow B — why it matters', onPress: () => replayWith('B') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const replayWith = async (flow) => {
    await DevSettings.setOnboardingFlow(flow);
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current > TAP_WINDOW_MS) {
      tapCountRef.current = 0;
    }
    lastTapRef.current = now;
    tapCountRef.current += 1;

    if (tapCountRef.current >= TAP_THRESHOLD) {
      tapCountRef.current = 0;
      openPicker();
    }
  };

  return (
    <TouchableOpacity onPress={handleTap} activeOpacity={1} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={styles.label}>v{appJson.expo.version}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  label: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    opacity: 0.5,
    marginTop: 8,
    marginBottom: 24,
  },
});
