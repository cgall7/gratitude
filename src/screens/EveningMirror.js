import React, { useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Animated, 
  Dimensions 
} from 'react-native';
import { theme } from '../constants/theme';

const { width, height } = Dimensions.get('window');

export const EveningMirror = ({ gratitudeText, onClose }) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Smooth entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Ambient background glow for evening vibe */}
      <View style={styles.eveningGlow} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.header}>Tonight's Reflection</Text>
        
        <View style={styles.quoteCard}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.gratitudeText}>
            {gratitudeText || "You didn't record anything today, but you are still worthy of gratitude."}
          </Text>
          <Text style={styles.quoteMarkEnd}>”</Text>
        </View>

        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={onClose}
        >
          <Text style={styles.closeButtonText}>Rest Well</Text>
        </TouchableOpacity>
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
  eveningGlow: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    backgroundColor: theme.colors.accent,
    borderRadius: width,
    opacity: 0.1,
    bottom: -width * 0.3, // Glow comes from bottom for a "sunset/moonrise" feel
  },
  content: {
    width: '80%',
    alignItems: 'center',
  },
  header: {
    fontFamily: theme.fonts.body,
    fontSize: 18,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
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
    fontFamily: theme.fonts.body,
    fontSize: 28,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
    fontStyle: 'italic',
    fontWeight: '300',
  },
  closeButton: {
    marginTop: 40,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: 'transparent',
  },
  closeButtonText: {
    fontFamily: theme.fonts.header,
    fontSize: 16,
    color: theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
