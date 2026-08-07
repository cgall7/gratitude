import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Dimensions, 
  Animated, 
  TouchableOpacity 
} from 'react-native';
import { theme } from '../constants/theme';

const { width, height } = Dimensions.get('window');

export const GratitudeWrapped = ({ userData, onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = new Animated.Value(0);

  const slides = [
    {
      title: "Your Year in Gratitude",
      subtitle: "2026",
      value: "312",
      label: "Moments of reflection",
      color: theme.colors.accent
    },
    {
      title: "Your North Star",
      subtitle: "Top Theme",
      value: "Family",
      label: "The heart of your year",
      color: theme.colors.pop
    },
    {
      title: "Pure Consistency",
      subtitle: "Longest Streak",
      value: "42 Days",
      label: "Unstoppable positivity",
      color: theme.colors.gold
    },
    {
      title: "A Random Memory",
      subtitle: "October 12th",
      value: '"The way the sunlight hit the trees during my morning walk."',
      label: "A spark of joy",
      color: theme.colors.accent
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      onComplete();
    }
  };

  return (
    <TouchableOpacity 
      activeOpacity={1} 
      style={styles.container} 
      onPress={nextSlide}
    >
      <View style={styles.progressContainer}>
        {slides.map((_, i) => (
          <View 
            key={i} 
            style={[styles.progressBar, { backgroundColor: i <= currentSlide ? theme.colors.textPrimary : 'rgba(34,27,3,0.15)' }]}
          />
        ))}
      </View>

      <View style={[styles.slideContent, { backgroundColor: slides[currentSlide].color + '20' }]}>
        <Text style={styles.subtitle}>{slides[currentSlide].subtitle}</Text>
        <Text style={styles.title}>{slides[currentSlide].title}</Text>
        
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{slides[currentSlide].value}</Text>
          <Text style={styles.label}>{slides[currentSlide].label}</Text>
        </View>

        <Text style={styles.tapHint}>Tap to continue →</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  progressContainer: {
    flexDirection: 'row',
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    height: 4,
    gap: 8,
    zIndex: 10,
  },
  progressBar: {
    flex: 1,
    borderRadius: 2,
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 10,
    textAlign: 'center',
  },
  title: {
    fontFamily: theme.fonts.header,
    color: theme.colors.textPrimary,
    fontSize: 42,
    textAlign: 'center',
    marginBottom: 60,
  },
  valueContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: theme.borderRadius.large,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: '100%',
  },
  value: {
    fontFamily: theme.fonts.header,
    color: '#FFFFFF',
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 10,
  },
  label: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 20,
    textAlign: 'center',
  },
  tapHint: {
    position: 'absolute',
    bottom: 60,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 14,
    opacity: 0.6,
  },
});
