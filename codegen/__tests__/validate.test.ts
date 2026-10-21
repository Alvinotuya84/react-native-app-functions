import { ConfigError } from '../src/errors';
import type { Literal } from '../src/parse';
import { render, renderSwift } from '../src/render';
import { snakeCase, validateConfig } from '../src/validate';

type Config = { [key: string]: Literal };

const base = (functions: Config, types: Config = {}): Config => ({
  android: {
    kotlinPackage: 'com.example.app.appfunctions',
    serviceName: 'MyAppFunctionService',
  },
  types,
  functions,
});

const fn = (extra: Config = {}): Config => ({
  description: 'Does a thing.',
  handler: 'native',
  returns: { type: 'string' },
  ...extra,
});

function problemsOf(config: Config): string[] {
  try {
    validateConfig(config);
  } catch (e) {
    if (e instanceof ConfigError) return e.problems;
    throw e;
  }
  throw new Error('expected a ConfigError');
}

function kotlinOf(config: Config, file: string): string {
  const out = render(validateConfig(config)).find((f) => f.path.endsWith(file));
  if (!out) throw new Error(`no ${file}`);
  return out.contents;
}

describe('type mapping', () => {
  it.each([
    [{ type: 'string' }, 'String'],
    [{ type: 'int' }, 'Int'],
    [{ type: 'long' }, 'Long'],
    [{ type: 'double' }, 'Double'],
    [{ type: 'boolean' }, 'Boolean'],
    [{ type: 'localDate' }, 'LocalDate'],
    [{ type: 'localDateTime' }, 'LocalDateTime'],
    [{ type: 'instant' }, 'Instant'],
    [{ type: 'string', nullable: true }, 'String?'],
    [{ type: 'list', of: 'string' }, 'List<String>'],
    [{ type: 'list', of: 'instant', nullable: true }, 'List<Instant>?'],
    [{ type: 'list', of: 'Thing' }, 'List<Thing>'],
    [{ type: 'Thing', nullable: true }, 'Thing?'],
  ])('%j → %s', (returns, kotlin) => {
    const config = base(
      { f: fn({ returns }) },
      { Thing: { fields: { a: { type: 'string' } } } }
    );
    expect(kotlinOf(config, 'AppFunctionsHandlers.kt')).toContain(
      `suspend fun f(): ${kotlin}\n`
    );
  });

  it('imports java.time types only where used', () => {
    const config = base(
      { f: fn({ returns: { type: 'Thing' } }) },
      {
        Thing: {
          fields: { at: { type: 'instant' }, on: { type: 'localDate' } },
        },
      }
    );
    expect(kotlinOf(config, 'Thing.kt')).toContain(
      'import androidx.appfunctions.AppFunctionSerializable\nimport java.time.Instant\nimport java.time.LocalDate\n'
    );
    expect(kotlinOf(config, 'BaseMyAppFunctionService.kt')).not.toContain(
      'java.time'
    );
  });
});

describe('functions with params', () => {
  const config = base({
    searchRecords: fn({
      description: 'Searches records.',
      params: {
        query: { type: 'string', description: 'Free text.' },
        limit: { type: 'int', nullable: true },
        since: {
          type: 'localDate',
          nullable: true,
          description: 'Earliest date.',
        },
      },
      returns: { type: 'list', of: 'string', description: 'Matching ids.' },
    }),
  });

  it('renders the declaration with KDoc, optional params defaulting to null', () => {
    expect(kotlinOf(config, 'BaseMyAppFunctionService.kt')).toMatchSnapshot();
  });

  it('renders the handler interface', () => {
    expect(kotlinOf(config, 'AppFunctionsHandlers.kt')).toMatchSnapshot();
  });
});

describe('validation fails loudly, naming the function and field', () => {
  it('unknown types, with the list of valid ones', () => {
    expect(
      problemsOf(base({ f: fn({ returns: { type: 'Recrod' } }) }))
    ).toEqual([
      expect.stringMatching(
        /^function "f", field "returns": unknown type "Recrod" \(built-in: string, int/
      ),
    ]);
  });

  it('lists of primitives AppFunctions cannot serialize', () => {
    expect(
      problemsOf(
        base({ f: fn({ params: { ids: { type: 'list', of: 'int' } } }) })
      )
    ).toEqual([
      expect.stringMatching(
        /^function "f", param "ids": lists of "int" are not supported by AppFunctions/
      ),
    ]);
  });

  it('nested lists', () => {
    expect(
      problemsOf(base({ f: fn({ returns: { type: 'list', of: 'list' } }) }))
    ).toEqual([
      expect.stringMatching(
        /^function "f", field "returns": nested lists are not supported/
      ),
    ]);
  });

  it('missing descriptions and unknown handlers', () => {
    expect(
      problemsOf(
        base({ f: { handler: 'python', returns: { type: 'string' } } })
      )
    ).toEqual([
      'function "f", field "description": required: agents choose functions by their description',
      'function "f", field "handler": must be "native" or "js"',
    ]);
  });

  it('timeoutMs: js only, whole milliseconds in range', () => {
    expect(
      problemsOf(
        base({
          a: fn({ timeoutMs: 5000 }),
          b: fn({ handler: 'js', timeoutMs: 50 }),
          c: fn({ handler: 'js', timeoutMs: 1.5 }),
          d: fn({ handler: 'js', timeoutMs: '5000' }),
        })
      )
    ).toEqual([
      'function "a", field "timeoutMs": only applies to "js" handlers',
      'function "b", field "timeoutMs": must be a whole number of milliseconds between 100 and 600000',
      'function "c", field "timeoutMs": must be a whole number of milliseconds between 100 and 600000',
      'function "d", field "timeoutMs": must be a whole number of milliseconds between 100 and 600000',
    ]);
  });

  it('type fields', () => {
    const problems = problemsOf(
      base({ f: fn() }, { Thing: { fields: { class: { type: 'map' } } } })
    );
    expect(problems).toEqual([
      'type "Thing", field "class": names must be lowerCamelCase and not a Kotlin keyword',
      expect.stringMatching(/^type "Thing", field "class": unknown type "map"/),
    ]);
  });

  it('typos in keys', () => {
    expect(
      problemsOf(base({ f: fn({ retruns: { type: 'string' } }) }))
    ).toEqual([
      'function "f": unknown key "retruns" (allowed: description, title, handler, timeoutMs, params, returns)',
    ]);
  });

  it('reserved and generated type names', () => {
    expect(
      problemsOf(
        base(
          { f: fn() },
          {
            String: { fields: { a: { type: 'string' } } },
            FHandler: { fields: { a: { type: 'string' } } },
          }
        )
      )
    ).toEqual([
      'type "String": this name is reserved (Kotlin built-in or a generated class); pick another',
      'type "FHandler": this name is reserved (Kotlin built-in or a generated class); pick another',
    ]);
  });

  it('android section', () => {
    expect(
      problemsOf({
        android: { kotlinPackage: 'Com.Example', serviceName: 'svc' },
        functions: { f: fn() },
      })
    ).toEqual([
      'android.kotlinPackage: "Com.Example" is not a valid Kotlin package (lowercase segments separated by dots, no keywords)',
      'android.serviceName: "svc" must be an UpperCamelCase class name',
    ]);
  });

  it('comment delimiters in descriptions', () => {
    expect(
      problemsOf(base({ f: fn({ description: 'ends */ here' }) }))
    ).toEqual([
      'function "f", field "description": must not contain "/*" or "*/"',
    ]);
  });

  it('reports every problem at once', () => {
    expect(problemsOf({ functions: {} })).toEqual([
      'android: required object is missing',
      'functions: declare at least one function',
    ]);
  });
});

describe('naming', () => {
  it.each([
    ['FieldAppFunctionService', 'field_app_function_service'],
    ['ChatAppFunctionService', 'chat_app_function_service'],
    ['HTTPAppFunctionService', 'http_app_function_service'],
  ])('%s → %s', (input, expected) => {
    expect(snakeCase(input)).toBe(expected);
  });
});

describe('android resources', () => {
  it('escapes descriptions for XML attributes and string resources', () => {
    const config: Config = {
      ...base({ f: fn() }),
      android: {
        kotlinPackage: 'com.example',
        serviceName: 'S',
        appDescription: 'Use "f" & <g>\nthen h',
        appDisplayDescription: '@home: it\'s "fine"',
      },
    };
    const files = render(validateConfig(config));
    const metadata = files.find(
      (f) => f.path === 'xml/appfunctions_app_metadata.xml'
    )?.contents;
    const strings = files.find(
      (f) => f.path === 'values/appfunctions_strings.xml'
    )?.contents;
    expect(metadata).toContain(
      'appfn:description="Use &quot;f&quot; &amp; &lt;g&gt;&#10;then h"'
    );
    expect(strings).toContain('>\\@home: it\\\'s \\"fine\\"</string>');
  });

  it('omits app metadata when no descriptions are given', () => {
    const files = render(validateConfig(base({ f: fn() })));
    expect(files.map((f) => f.path)).not.toContain(
      'xml/appfunctions_app_metadata.xml'
    );
    expect(files.find((f) => f.root === 'manifest')?.contents).not.toContain(
      'app_metadata'
    );
  });
});

describe('js handlers', () => {
  const types: Config = {
    Visit: {
      fields: {
        id: { type: 'string' },
        count: { type: 'int' },
        total: { type: 'long', nullable: true },
        tags: { type: 'list', of: 'string' },
        at: { type: 'list', of: 'instant', nullable: true },
        on: { type: 'localDate', nullable: true },
        child: { type: 'Child', nullable: true },
        children: { type: 'list', of: 'Child' },
      },
    },
    Child: { fields: { ok: { type: 'boolean' }, ratio: { type: 'double' } } },
  };
  const config = base(
    {
      saveVisits: fn({
        handler: 'js',
        timeoutMs: 2500,
        params: {
          visits: { type: 'list', of: 'Visit' },
          day: { type: 'localDate' },
          note: { type: 'string', nullable: true },
          since: { type: 'instant', nullable: true },
        },
        returns: { type: 'list', of: 'Visit', nullable: true },
      }),
    },
    types
  );

  it('encodes params, calls JsBridge with the timeout, decodes the result', () => {
    expect(kotlinOf(config, 'BaseMyAppFunctionService.kt')).toMatchSnapshot();
  });

  it('generates encoders and strict decoders for every type shape', () => {
    expect(kotlinOf(config, 'AppFunctionsJson.kt')).toMatchSnapshot();
  });

  it('js-only configs have no handler interfaces and no native dispatch', () => {
    const files = render(validateConfig(config)).map((f) => f.path);
    expect(files).not.toContainEqual(
      expect.stringContaining('AppFunctionsHandlers.kt')
    );
    const service = kotlinOf(config, 'BaseMyAppFunctionService.kt');
    expect(service).not.toContain('AppFunctionsHandlers');
    expect(service).not.toContain('Dispatchers');
    expect(service).toContain('callJs("saveVisits", args, 2500L)');
  });

  it('defaults timeoutMs to 10000', () => {
    expect(
      kotlinOf(
        base({ f: fn({ handler: 'js' }) }),
        'BaseMyAppFunctionService.kt'
      )
    ).toContain('callJs("f", args, 10000L)');
  });

  it('native-only configs do not generate the JSON codec', () => {
    const files = render(validateConfig(base({ f: fn() }))).map((f) => f.path);
    expect(files).not.toContainEqual(
      expect.stringContaining('AppFunctionsJson.kt')
    );
  });
});

describe('title', () => {
  it('derives a title from the function name, or uses the config title', () => {
    const m = validateConfig(
      base({ listTodaysRecords: fn(), createNote: fn({ title: 'New Note' }) })
    );
    expect(m.functions.map((f) => f.title)).toEqual([
      'List Todays Records',
      'New Note',
    ]);
  });

  it('must be a non-empty single line', () => {
    expect(
      problemsOf(base({ a: fn({ title: '' }), b: fn({ title: 'x\ny' }) }))
    ).toEqual([
      'function "a", field "title": must be a non-empty single line',
      'function "b", field "title": must be a non-empty single line',
    ]);
  });
});

describe('iOS (Swift)', () => {
  const iosProblemsOf = (config: Config): string[] => {
    try {
      renderSwift(validateConfig(config));
    } catch (e) {
      if (e instanceof ConfigError) return e.problems;
      throw e;
    }
    throw new Error('expected a ConfigError');
  };

  it('rejects names that clash on iOS and declared-type params', () => {
    expect(
      iosProblemsOf(
        base(
          {
            f: fn({
              params: {
                perform: { type: 'string' },
                rec: { type: 'Rec' },
              },
            }),
          },
          {
            Date: { fields: { a: { type: 'string' } } },
            Rec: {
              fields: { id: { type: 'string' }, recId: { type: 'string' } },
            },
          }
        )
      )
    ).toEqual([
      'type "Date": this name is reserved on iOS (Swift built-in or a generated type); pick another',
      'type "Rec", field "id": on iOS it becomes "recId", which is already a field; rename one of them',
      'function "f", param "perform": this name is reserved on iOS; pick another',
      'function "f", param "rec": declared types as parameters are not supported on iOS yet; pass scalar fields instead',
    ]);
  });

  it('maps types, escapes keywords and strings, and bridges js functions', () => {
    const swift = renderSwift(
      validateConfig(
        base(
          {
            find: fn({
              title: 'Find "it"',
              params: {
                default: { type: 'boolean' },
                day: { type: 'localDate', nullable: true },
                tags: { type: 'list', of: 'string' },
              },
              returns: { type: 'Item', nullable: true },
            }),
            later: fn({ handler: 'js' }),
            jsArgs: fn({
              handler: 'js',
              params: {
                day: { type: 'localDate' },
                at: { type: 'instant', nullable: true },
                words: { type: 'list', of: 'string' },
              },
              returns: { type: 'list', of: 'Item', nullable: true },
            }),
          },
          {
            Item: {
              fields: {
                id: { type: 'string' },
                count: { type: 'long' },
                kids: { type: 'list', of: 'Item', nullable: true },
              },
            },
          }
        )
      )
    );
    expect(swift).toContain('import AppFunctions\n');
    expect(swift).toContain('struct LaterIntent: AppIntent {');
    expect(swift).toContain(
      'let value: String = try await AppFunctionsJson.call(\n      "later", args, timeoutMs: 10000\n    )'
    );
    expect(swift).toContain(
      'func find(`default`: Bool, day: Date?, tags: [String]) async throws -> Item?'
    );
    expect(swift).toContain(
      'static let title: LocalizedStringResource = "Find \\"it\\""'
    );
    expect(swift).toContain('  var itemId: String\n');
    expect(swift).toContain('    kids = value.kids?.map(ItemEntity.init)\n');
    expect(swift).toContain('DisplayRepresentation(title: "Item")');
    expect(swift).toContain('find(default: `default`, day: day, tags: tags)');
    expect(swift).toContain(
      'return .result(value: value.map(ItemEntity.init))'
    );
  });
});
