import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Animated, 
  Dimensions, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { theme } from '../constants/theme';
import { getDailyPrompt } from '../constants/prompts';
import { EntryStore } from '../services/EntryStore';
import { tagEntry } from '../utils/themeTagger';

const { width, height } = Dimensions.get('window');

// --- COMPONENT: LockScreen ---
export const LockScreen = ({ onEnterRitual }) => {
  return (
    <View style={styles.container}>
      {/* Background Glow */}
      <View style={styles.glow} />
      
      <View style={styles.content}>
        <Text style={styles.logo}>gratitude</Text>
        <Text style={styles.prompt}>Pause.{"\n"}What are you grateful for today?</Text>
        
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={onEnterRitual}
        >
          <Text style={styles.buttonText}>Enter Ritual</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- COMPONENT: InputScreen ---
export const InputScreen = ({ onUnlock }) => {
  const [text, setText] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const dailyPrompt = getDailyPrompt();

  const handleSave = () => {
    const themeTag = tagEntry(text);
    EntryStore.saveEntry(new Date(), text, themeTag);
    // Trigger unlock animation/logic
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: 'opacity',
    }).start(() => onUnlock(text));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.logoSmall}>gratitude</Text>
        <Text style={styles.promptHint}>Not sure where to start? {dailyPrompt}</Text>

        <View style={styles.inputCard}>
          <TextInput
            style={styles.textInput}
            placeholder="I am grateful for..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            value={text}
            onChangeText={setText}
            autoFocus
          />
        </View>

        <Animated.View style={[styles.buttonWrapper, { opacity: fadeAnim }]}>
          <Text style={styles.unlockingText}>Unlocking your world...</Text>
        </Animated.View>

        <TouchableOpacity 
          style={[styles.primaryButton, { backgroundColor: theme.colors.pop }]} 
          onPress={handleSave}
        >
          <Text style={[styles.buttonText, { color: theme.colors.textInverse }]}>Unlock Apps</Text>
        </TouchableOpacity>
      </View>
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
  glow: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    backgroundColor: theme.colors.accent,
    borderRadius: width,
    opacity: 0.15,
    top: -width * 0.2,
    filter: 'blur(60px)', // Note: blur varies by platform, usually handled via a library like react-native-blur
  },
  content: {
    width: '85%',
    alignItems: 'center',
    zIndex: 1,
  },
  logo: {
    fontFamily: theme.fonts.logo,
    fontSize: 64,
    color: theme.colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  logoSmall: {
    fontFamily: theme.fonts.logo,
    fontSize: 32,
    color: theme.colors.textPrimary,
    marginBottom: 40,
    textAlign: 'center',
  },
  prompt: {
    fontFamily: theme.fonts.body,
    fontSize: 24,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 50,
  },
  promptHint: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontStyle: 'italic',
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
  },
  textInput: {
    fontFamily: theme.fonts.body,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: theme.borderRadius.full,
    width: '100%',
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonText: {
    fontFamily: theme.fonts.header,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  buttonWrapper: {
    position: 'absolute',
    top: '40%',
    width: '100%',
    alignItems: 'center',
  },
  unlockingText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.pop,
    fontSize: 16,
    fontWeight: '500',
  }
});
