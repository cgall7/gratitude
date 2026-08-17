import React from 'react';
import { StyleSheet, View, Text, SafeAreaView } from 'react-native';
import { theme } from '../constants/theme';
import { PrimaryButton } from './PrimaryButton';
import { CrashBreadcrumb } from '../services/crashBreadcrumb';

// An uncaught render throw unmounts React Native's entire tree — no red
// box in production, just a blank screen the user can only escape by
// force-quitting. This is the one boundary in the app, wrapping the whole
// navigator in App.js, so any screen's render crash lands here instead.
//
// A class component on purpose: getDerivedStateFromError/componentDidCatch
// have no hook equivalent — a boundary IS a class component in React.
export class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // No crash reporter is wired today (matches the rest of the app —
    // there's no analytics/Sentry call anywhere in src/). console.error
    // plus a durable breadcrumb is the whole story until one is.
    console.error('ErrorBoundary caught a render error:', error, errorInfo);
    CrashBreadcrumb.record(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    // Remounts the crashed subtree fresh. If the same state that caused
    // the throw is still in a store/context above this boundary, this can
    // throw again immediately — the fallback is stateless and safe to
    // reach on every retry, so that's a repeat of this screen, not a
    // second crash mode.
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            Your entries are saved. Tap below to pick up where you left off.
          </Text>
          <PrimaryButton
            onPress={this.handleReset}
            containerStyle={styles.button}
            accessibilityLabel="Reload the app"
          >
            Reload
          </PrimaryButton>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  title: {
    ...theme.type.h1,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...theme.type.bodyLg,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  button: {
    alignSelf: 'stretch',
  },
});
