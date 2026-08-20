import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { theme } from '../constants/theme';
import { SPRINGS } from '../constants/motion';

// Hero stat values count up from 0 when they're a plain number (entry counts,
// streak days); anything else (a theme name, a quote) just pops in. Re-runs
// whenever `value` changes so each Wrapped slide gets its own reveal.
//
// §11.4 "arrival" treatment: once the value settles, it scale-bounces
// (1 → 1.15 → 1, same spring energy as §11.3's celebration badge) with an
// accentBurst glow ring expanding from its center and fading over ~400ms,
// behind the text — Didit's "big numbers" only land if they visibly land.
export const AnimatedStat = ({ value, style }) => {
  const isNumeric = /^\d+$/.test(value);
  const anim = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(isNumeric ? '0' : value);
  const [glowSize, setGlowSize] = useState(0);

  const fireArrival = () => {
    pop.setValue(1);
    glow.setValue(0);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.15, ...SPRINGS.pop, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, ...SPRINGS.pop, useNativeDriver: true }),
    ]).start();
    Animated.timing(glow, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  useEffect(() => {
    anim.setValue(0);

    if (isNumeric) {
      const target = parseInt(value, 10);
      const listenerId = anim.addListener(({ value: v }) => {
        setDisplayValue(String(Math.round(v * target)));
      });
      Animated.timing(anim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: false,
      }).start(fireArrival);
      return () => anim.removeListener(listenerId);
    }

    setDisplayValue(value);
    Animated.spring(anim, {
      toValue: 1,
      ...SPRINGS.reveal,
      useNativeDriver: true,
    }).start(fireArrival);
  }, [value]);

  const scale = isNumeric ? 1 : anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const opacity = isNumeric ? 1 : anim;
  const glowOpacity = glow.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 0] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] });

  return (
    <View style={styles.wrap}>
      {glowSize > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />
      )}
      <Animated.Text
        onLayout={(e) => setGlowSize(Math.max(e.nativeEvent.layout.width, e.nativeEvent.layout.height) * 1.3)}
        style={[style, { opacity, transform: [{ scale: Animated.multiply(scale, pop) }] }]}
      >
        {displayValue}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: theme.colors.accentBurst,
  },
});
