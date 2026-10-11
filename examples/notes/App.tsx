import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { createNote, useNotes, type Note } from './src/notesStore';

const C = {
  paper: '#F5F3EE',
  card: '#FFFFFF',
  ink: '#1D1B20',
  muted: '#6B6870',
  line: '#E7E3DA',
  accent: '#6B4EFF',
  accentSoft: '#EDE8FF',
  chip: '#F1EEE6',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NotesScreen />
    </SafeAreaProvider>
  );
}

function NotesScreen() {
  const insets = useSafeAreaInsets();
  const notes = useNotes();
  const now = useNow(30_000);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </Text>
        </View>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NoteCard note={item} now={now} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No notes yet. Write one below, or ask your assistant.
          </Text>
        }
      />

      <Composer bottomInset={insets.bottom} />
    </KeyboardAvoidingView>
  );
}

function NoteCard({ note, now }: { note: Note; now: number }) {
  const glow = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(1)).current;
  const isFresh =
    note.viaAssistant && now - Date.parse(note.updatedAt) < 15_000;

  useEffect(() => {
    if (!isFresh) return;
    enter.setValue(0);
    glow.setValue(1);
    Animated.sequence([
      Animated.spring(enter, {
        toValue: 1,
        useNativeDriver: false,
        friction: 7,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: 2600,
        delay: 600,
        useNativeDriver: false,
      }),
    ]).start();
    // Re-run when the note changes (created or appended to).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.updatedAt]);

  const backgroundColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [C.card, C.accentSoft],
  });
  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [C.line, C.accent],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor,
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [-16, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {note.title || 'Untitled'}
        </Text>
      </View>
      {note.body ? (
        <Text style={styles.cardBody} numberOfLines={6}>
          {note.body}
        </Text>
      ) : null}
      <View style={styles.cardFooter}>
        <View style={styles.tags}>
          {note.tags.map((t) => (
            <View key={t} style={styles.chip}>
              <Text style={styles.chipText}>#{t}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.time}>{relativeTime(note.updatedAt, now)}</Text>
      </View>
    </Animated.View>
  );
}

function Composer({ bottomInset }: { bottomInset: number }) {
  const [text, setText] = useState('');
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    const [first = '', ...rest] = value.split('\n');
    createNote({ title: first.slice(0, 60), body: rest.join('\n') });
    setText('');
  };
  return (
    <View
      style={[styles.composer, { paddingBottom: Math.max(bottomInset, 12) }]}
    >
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Write a note…"
        placeholderTextColor={C.muted}
        multiline
      />
      <Pressable
        onPress={submit}
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.addText}>Add</Text>
      </Pressable>
    </View>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  const notes = useNotes();
  // Refresh "now" whenever notes change so fresh notes animate right away.
  useEffect(() => setNow(Date.now()), [notes]);
  return now;
}

function relativeTime(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 34, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  subtitle: { fontSize: 15, color: C.muted },
  list: { padding: 16, paddingTop: 8, gap: 12 },
  empty: { textAlign: 'center', color: C.muted, marginTop: 48 },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: C.ink },
  cardBody: { fontSize: 15, lineHeight: 21, color: '#3A3740' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  chip: {
    backgroundColor: C.chip,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  time: { fontSize: 12, color: C.muted },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.paper,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: C.ink,
  },
  add: {
    backgroundColor: C.ink,
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 44,
    justifyContent: 'center',
  },
  addText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
