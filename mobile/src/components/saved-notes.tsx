// The running list of saved notes for one person and one exercise, with edit
// and delete.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { NotesApi } from '../data/store';
import { confirm } from '../lib/dialogs';
import { buzzWarning } from '../lib/haptics';
import { formatNoteDate } from '../lib/stats';
import type { WorkoutUser } from '../lib/workout-data';
import { colors, fonts } from '../theme';
import { IconButton, OutlineButton, SmallButton } from './ui';

export function SavedNotesList({
  api,
  user,
  exerciseName,
}: {
  api: NotesApi;
  user: WorkoutUser;
  exerciseName: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!exerciseName) return null;
  const mine = api.notes.filter(
    (n) => n.user === user && n.exerciseName.toLowerCase() === exerciseName.toLowerCase(),
  );
  if (!mine.length) return null;

  const saveEdit = async (id: string) => {
    const text = editText.trim();
    if (!text) return;
    setBusy(true);
    const ok = await api.update(id, text);
    setBusy(false);
    if (ok) setEditingId(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>SAVED NOTES</Text>
      {mine.map((n) => (
        <View style={styles.note} key={n.id}>
          {editingId === n.id ? (
            <View style={styles.edit}>
              <TextInput
                style={styles.input}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
                accessibilityLabel="Edit note"
              />
              <View style={styles.editActions}>
                <SmallButton
                  label={busy ? 'Saving...' : 'Save'}
                  disabled={busy || !editText.trim()}
                  onPress={() => saveEdit(n.id)}
                />
                <OutlineButton compact label="Cancel" onPress={() => setEditingId(null)} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.body}>
                <Text style={styles.text}>{n.text}</Text>
                <Text style={styles.date}>{formatNoteDate(n.createdAt)}</Text>
              </View>
              <View style={styles.actions}>
                <IconButton
                  icon="pencil-outline"
                  label="Edit note"
                  size={36}
                  iconSize={17}
                  color={colors.ink}
                  onPress={() => {
                    setEditingId(n.id);
                    setEditText(n.text);
                  }}
                />
                <IconButton
                  icon="trash-can-outline"
                  label="Delete note"
                  size={36}
                  iconSize={17}
                  color={colors.danger}
                  onPress={async () => {
                    buzzWarning();
                    if (
                      await confirm({
                        title: 'Delete this note?',
                        confirmLabel: 'Delete',
                        destructive: true,
                      })
                    ) {
                      void api.remove(n.id);
                    }
                  }}
                />
              </View>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12, gap: 6 },
  label: { fontFamily: fonts.headingBold, fontSize: 12, letterSpacing: 0.9, color: colors.goldNote },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 8,
    paddingRight: 8,
    paddingLeft: 10,
  },
  body: { flex: 1 },
  text: { fontSize: 15, color: colors.text },
  date: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6 },
  edit: { flex: 1, gap: 8 },
  editActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    minHeight: 60,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
});
