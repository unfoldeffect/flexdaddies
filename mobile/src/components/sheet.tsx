// A page that slides up over the app (a native sheet on iPhone, a full
// screen on Android) with a title and a close button.
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '../theme';
import { KeyboardSpace } from './keyboard-space';

export function Sheet({
  visible,
  title,
  onClose,
  closeLabel = 'Close',
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* A sheet is its own window, so it needs its own safe-area measurements
          and its own gesture root (for drag-to-reorder inside a sheet). */}
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <KeyboardSpace>
            <SafeAreaView
              style={styles.root}
              edges={Platform.OS === 'ios' ? ['bottom'] : undefined}
            >
              <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  hitSlop={10}
                  onPress={onClose}
                  style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.closeText}>{closeLabel}</Text>
                </Pressable>
              </View>
              {visible ? children : null}
            </SafeAreaView>
          </KeyboardSpace>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 12,
  },
  title: { flex: 1, fontFamily: fonts.headingBold, fontSize: 22, color: colors.ink },
  close: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  closeText: { fontSize: 17, fontWeight: '600', color: colors.goldDeep },
});
