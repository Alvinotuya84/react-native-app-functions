import * as fs from 'node:fs';
import * as path from 'node:path';
import { generate } from '../src/cli';
import type { OutputRoot } from '../src/render';

const FIXTURE = path.join(__dirname, '../__fixtures__/handwritten');

function fixtureFiles(root: OutputRoot): Map<string, string> {
  const dir = path.join(FIXTURE, root);
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else
        out.set(
          path.relative(dir, p).split(path.sep).join('/'),
          fs.readFileSync(p, 'utf8')
        );
    }
  };
  walk(dir);
  return out;
}

describe('codegen reproduces the hand-written Phase 1 reference', () => {
  const generated = generate(path.join(FIXTURE, 'appfunctions.config.ts'));

  it.each<OutputRoot>(['kotlin', 'manifest', 'res'])(
    '%s output matches byte for byte',
    (root) => {
      const expected = fixtureFiles(root);
      const actual = new Map(
        generated
          .filter((f) => f.root === root)
          .map((f) => [f.path, f.contents])
      );
      expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
      for (const [file, contents] of expected) {
        expect({ file, contents: actual.get(file) }).toEqual({
          file,
          contents,
        });
      }
    }
  );

  it('example app config is the reference config', () => {
    const example = path.join(
      __dirname,
      '../../example/appfunctions.config.ts'
    );
    expect(fs.readFileSync(example, 'utf8')).toBe(
      fs.readFileSync(path.join(FIXTURE, 'appfunctions.config.ts'), 'utf8')
    );
  });
});
