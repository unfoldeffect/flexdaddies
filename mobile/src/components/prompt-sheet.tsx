// Asks for one line of text (used for "Name this plan").
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '../theme';
import { OutlineButton, PrimaryButton } from './ui';

type Props = {
  visible: boolean;
  title: string;
  initialValue: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

export function PromptSheet(props: Props) {
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onCancel}
      statusBarTranslucent>
      {/* Mounted fresh each time it opens, so it always starts from the suggested text. */}
      {props.visible && <PromptBody {...props} />}
    </Modal>
  );
}

function PromptBody({ title, initialValue, confirmLabel = 'Save', onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  return (
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Cancel" />
        <View style={styles.card} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={() => trimmed && onSubmit(trimmed)}
            accessibilityLabel={title}
          />
          <View style={styles.actions}>
            <OutlineButton label="Cancel" onPress={onCancel} style={styles.action} />
            <PrimaryButton
              compact
              label={confirmLabel.toUpperCase()}
              disabled={!trimmed}
              onPress={() => onSubmit(trimmed)}
              style={styles.action}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,37,69,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bg,
    borderRadius: 22,
    padding: 20,
    gap: 14,
  },
  title: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.ink },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
  },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
