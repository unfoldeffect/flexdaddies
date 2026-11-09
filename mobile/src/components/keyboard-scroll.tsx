// A scrolling page that behaves well with the keyboard: tapping a button
// while typing works first time, dragging the page puts the keyboard away,
// and the box being typed in is kept clear of the keyboard.
import type { ComponentProps, ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';

export function KeyboardScroll({
  children,
  bottomSpace = 32,
  contentContainerStyle,
  ...rest
}: ComponentProps<typeof ScrollView> & { children: ReactNode; bottomSpace?: number }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }, contentContainerStyle]}
      {...rest}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, width: '100%', maxWidth: 620, alignSelf: 'center' },
});
