// Makes room for the on-screen keyboard.
//
// iPhone: scrolling pages do this natively (see KeyboardScroll), so this is a
// plain container there. Android: the page is padded by however much the
// keyboard covers; if Android has already resized the window, that is zero.
//
// Must be the outermost view of a screen or sheet, starting at the very top
// of the window, because it measures from there.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

export function KeyboardSpace({ children }: { children: ReactNode }) {
  if (Platform.OS === 'android') {
    return (
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
