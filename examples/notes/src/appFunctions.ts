// AppFunction handlers. Imported at the top of index.js so they're registered even when an
// agent call starts the app headless (no UI mounted).
import {
  AppFunctionError,
  registerAppFunctionHandler,
} from 'react-native-app-functions';
import type config from '../appfunctions.config';
import * as store from './notesStore';

type Config = typeof config;

registerAppFunctionHandler<Config, 'createNote'>(
  'createNote',
  ({ title, body, tags }) => {
    if (!title.trim() && !body.trim()) {
      throw new AppFunctionError(
        'INVALID_ARGUMENT',
        'A note needs a title or a body.'
      );
    }
    return store.toAgentNote(
      store.createNote({ title, body, tags, viaAssistant: true })
    );
  }
);

registerAppFunctionHandler<Config, 'searchNotes'>('searchNotes', ({ query }) =>
  store.searchNotes(query).map(store.toAgentNote)
);

registerAppFunctionHandler<Config, 'listRecentNotes'>(
  'listRecentNotes',
  ({ limit }) => {
    const n = Math.min(Math.max(limit ?? 10, 1), 50);
    return store.listRecentNotes(n).map(store.toAgentNote);
  }
);

registerAppFunctionHandler<Config, 'appendToNote'>(
  'appendToNote',
  ({ id, text }) => {
    const updated = store.appendToNote(id, text, true);
    if (!updated) {
      throw new AppFunctionError(
        'NOT_FOUND',
        `No note with id "${id}". Use searchNotes or listRecentNotes to find the right id.`
      );
    }
    return store.toAgentNote(updated);
  }
);
