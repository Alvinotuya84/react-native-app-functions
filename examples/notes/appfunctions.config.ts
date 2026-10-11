import { defineAppFunctions } from 'react-native-app-functions/config';

export default defineAppFunctions({
  android: {
    kotlinPackage: 'io.github.alvinotuya.notes.appfunctions',
    serviceName: 'NotesAppFunctionService',
    appDescription:
      "Notes: the user's personal notes, stored on this device. Agents can create notes, search them, list recent ones and add text to an existing note. Use searchNotes or listRecentNotes before answering questions about the user's notes, and to find a note's id before calling appendToNote. Notes cannot be deleted through these functions.",
    appDisplayDescription: 'Lets assistants create, find and update your notes',
  },
  types: {
    Note: {
      description: 'A note written by the user or created for them.',
      fields: {
        id: {
          type: 'string',
          description: 'Unique note id. Pass it to appendToNote to update this note.',
        },
        title: { type: 'string', description: 'Short title of the note.' },
        body: { type: 'string', description: 'Full text of the note.' },
        tags: {
          type: 'list',
          of: 'string',
          description: 'Lowercase tags without "#", e.g. "site-b" or "shopping".',
        },
        createdAt: { type: 'instant', description: 'When the note was created (UTC).' },
        updatedAt: { type: 'instant', description: 'When the note was last changed (UTC).' },
      },
    },
  },
  functions: {
    createNote: {
      description:
        'Creates a new note and returns it. Use when the user asks to note, write down, remember, save or jot something.\nGive it a short, specific title (about 2-6 words) and put the details in the body. To add to a note that already exists, use appendToNote instead.',
      handler: 'js',
      params: {
        title: { type: 'string', description: 'Short, specific title.' },
        body: { type: 'string', description: 'The full content of the note.' },
        tags: {
          type: 'list',
          of: 'string',
          nullable: true,
          description: 'Optional lowercase tags, e.g. ["site-b", "todo"].',
        },
      },
      returns: { type: 'Note', description: 'The created note.' },
    },
    searchNotes: {
      description:
        "Searches the user's notes for words in the title, body or tags, best matches first. Use it to answer questions about what the user has noted, and to find a note before updating it.\nPass 1-3 key words, not a whole sentence.",
      handler: 'js',
      params: {
        query: { type: 'string', description: 'Key words to look for, e.g. "site b cement".' },
      },
      returns: {
        type: 'list',
        of: 'Note',
        description: 'Matching notes. Empty if nothing matches.',
      },
    },
    listRecentNotes: {
      description:
        "Lists the user's most recently updated notes, newest first. Use when the user asks what notes they have or wants their latest notes.",
      handler: 'js',
      params: {
        limit: {
          type: 'int',
          nullable: true,
          description: 'How many notes to return, 1 to 50. Defaults to 10.',
        },
      },
      returns: { type: 'list', of: 'Note', description: 'Notes, newest first.' },
    },
    appendToNote: {
      description:
        'Adds text to the end of an existing note, on a new line, and returns the updated note. Use when the user wants to add to or update a note they already have.\nGet the note id from searchNotes or listRecentNotes first.',
      handler: 'js',
      params: {
        id: { type: 'string', description: 'Id of the note to update.' },
        text: { type: 'string', description: 'Text to add to the end of the note.' },
      },
      returns: { type: 'Note', description: 'The updated note.' },
    },
  },
});
