import { ConfigError } from '../src/errors';
import type { Literal } from '../src/parse';
import { render } from '../src/render';
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

  it('js handlers (not implemented yet) and missing descriptions', () => {
    expect(
      problemsOf(base({ f: { handler: 'js', returns: { type: 'string' } } }))
    ).toEqual([
      'function "f", field "description": required: agents choose functions by their description',
      'function "f", field "handler": "js" handlers are not supported yet; use "native"',
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
      'function "f": unknown key "retruns" (allowed: description, handler, params, returns)',
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
