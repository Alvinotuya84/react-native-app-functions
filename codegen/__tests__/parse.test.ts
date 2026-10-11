import { ConfigError } from '../src/errors';
import { parseConfigSource } from '../src/parse';

const parse = (src: string) =>
  parseConfigSource(src, '/app/appfunctions.config.ts');

function problemsOf(src: string): string[] {
  try {
    parse(src);
  } catch (e) {
    if (e instanceof ConfigError) return e.problems;
    throw e;
  }
  throw new Error('expected a ConfigError');
}

describe('parseConfigSource', () => {
  it('reads defineAppFunctions({...}) without executing it', () => {
    const src = `
      import { defineAppFunctions } from 'react-native-app-functions/config';
      export default defineAppFunctions({ a: 'x', b: true, c: { d: [\`e\`] }, 'quoted-key': false, n: 1500 });
    `;
    expect(parse(src)).toEqual({
      'a': 'x',
      'b': true,
      'c': { d: ['e'] },
      'quoted-key': false,
      'n': 1500,
    });
  });

  it('accepts a plain object default export with as const / satisfies', () => {
    expect(
      parse(`export default ({ a: 'x' } as const) satisfies object;`)
    ).toEqual({ a: 'x' });
  });

  it('rejects non-literal values with file:line:col', () => {
    const problems = problemsOf(`
const desc = 'x';
export default defineAppFunctions({
  a: desc,
  b: \`t\${desc}\`,
  c: null,
  ...{},
  d,
});`);
    expect(problems).toEqual([
      expect.stringMatching(
        /^appfunctions\.config\.ts:4:6: only literal values .*found a variable \(`desc`\)/
      ),
      expect.stringMatching(
        /^appfunctions\.config\.ts:5:6: only literal values .*found a template string/
      ),
      expect.stringMatching(
        /^appfunctions\.config\.ts:6:6: only literal values .*found null/
      ),
      expect.stringMatching(
        /^appfunctions\.config\.ts:7:3: only `key: value` properties/
      ),
      expect.stringMatching(
        /^appfunctions\.config\.ts:8:3: only `key: value` properties/
      ),
    ]);
  });

  it('rejects duplicate keys', () => {
    expect(problemsOf(`export default { a: 'x', a: 'y' };`)).toEqual([
      expect.stringMatching(/duplicate key "a"/),
    ]);
  });

  it('requires a default export', () => {
    expect(problemsOf(`export const config = {};`)).toEqual([
      expect.stringMatching(/expected `export default defineAppFunctions/),
    ]);
  });

  it('rejects other function calls', () => {
    expect(problemsOf(`export default makeConfig({});`)).toEqual([
      expect.stringMatching(/expected `defineAppFunctions\(\{\.\.\.\}\)`/),
    ]);
  });
});
