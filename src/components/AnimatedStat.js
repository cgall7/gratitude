import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

// Hero stat values count up from 0 when they're a plain number (entry counts,
// streak days); anything else (a theme name, a quote) just pops in. Re-runs
// whenever `value` changes so each Wrapped slide gets its own reveal.
export const AnimatedStat = ({ value, style }) => {
  const isNumeric = /^\d+$/.test(value);
  const anim = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(isNumeric ? '0' : value);

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
      }).start();
      return () => anim.removeListener(listenerId);
    }

    setDisplayValue(value);
    Animated.spring(anim, {
      toValue: 1,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [value]);

  const scale = isNumeric ? 1 : anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const opacity = isNumeric ? 1 : anim;

  return (
    <Animated.Text style={[style, { opacity, transform: [{ scale }] }]}>
      {displayValue}
    </Animated.Text>
  );
};
