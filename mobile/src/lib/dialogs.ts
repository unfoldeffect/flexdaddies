// "Are you sure?" pop-ups, using each phone's own native alert.
import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message?: string;
  /** The button that goes ahead, e.g. "Delete". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shows the go-ahead button in red on iPhone. */
  destructive?: boolean;
};

export function confirm({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    // The browser preview has no native alert.
    const ask = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    return Promise.resolve(ask ? ask([title, message].filter(Boolean).join('\n\n')) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
