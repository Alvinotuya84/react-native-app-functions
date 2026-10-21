import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { main, parseArgs, writeOutputs } from '../src/cli';

const FIXTURE_CONFIG = path.join(
  __dirname,
  '../__fixtures__/handwritten/appfunctions.config.ts'
);

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'appfunctions-codegen-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const outDirs = () => ({
  kotlin: path.join(tmp, 'kotlin'),
  res: path.join(tmp, 'res'),
  manifest: path.join(tmp, 'manifest'),
});

const args = (config: string) => {
  const d = outDirs();
  return [
    '--config',
    config,
    '--kotlin-out',
    d.kotlin,
    '--res-out',
    d.res,
    '--manifest-out',
    d.manifest,
  ];
};

describe('cli', () => {
  it('writes all outputs for a valid config', () => {
    expect(main(args(FIXTURE_CONFIG))).toBe(0);
    expect(fs.existsSync(path.join(tmp, 'manifest/AndroidManifest.xml'))).toBe(
      true
    );
    expect(
      fs.existsSync(path.join(tmp, 'res/xml/appfunctions_app_metadata.xml'))
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          tmp,
          'kotlin/io/github/alvinotuya/appfunctions/example/appfunctions/FieldRecord.kt'
        )
      )
    ).toBe(true);
  });

  it('writes only the Swift file with --swift-out, and only when it changed', () => {
    const swift = path.join(tmp, 'ios/App/AppFunctions.generated.swift');
    const sibling = path.join(tmp, 'ios/App/AppDelegate.swift');
    fs.mkdirSync(path.dirname(sibling), { recursive: true });
    fs.writeFileSync(sibling, 'keep');
    expect(main(['--config', FIXTURE_CONFIG, '--swift-out', swift])).toBe(0);
    expect(fs.readFileSync(swift, 'utf8')).toContain(
      'struct ListTodaysRecordsIntent'
    );
    const old = new Date(2000, 0, 1);
    fs.utimesSync(swift, old, old);
    expect(main(['--config', FIXTURE_CONFIG, '--swift-out', swift])).toBe(0);
    expect(fs.statSync(swift).mtime.getTime()).toBe(old.getTime());
    expect(fs.readFileSync(sibling, 'utf8')).toBe('keep');
    expect(fs.existsSync(path.join(tmp, 'manifest'))).toBe(false);
  });

  it('rejects partial Android flags and unknown flags', () => {
    expect(() =>
      parseArgs(['--config', 'c', '--kotlin-out', 'k', '--swift-out', 's'])
    ).toThrow(/usage/);
    expect(() => parseArgs(['--config', 'c', '--ios-out', 's'])).toThrow(
      /usage/
    );
  });

  it('deletes stale files and leaves unchanged files untouched', () => {
    const d = outDirs();
    writeOutputs(
      [
        { root: 'kotlin', path: 'a/Keep.kt', contents: 'keep' },
        { root: 'kotlin', path: 'a/Gone.kt', contents: 'gone' },
      ],
      d
    );
    const keep = path.join(d.kotlin, 'a/Keep.kt');
    const old = new Date(2000, 0, 1);
    fs.utimesSync(keep, old, old);
    writeOutputs([{ root: 'kotlin', path: 'a/Keep.kt', contents: 'keep' }], d);
    expect(fs.existsSync(path.join(d.kotlin, 'a/Gone.kt'))).toBe(false);
    expect(fs.statSync(keep).mtime.getTime()).toBe(old.getTime());
  });

  it('exits 1 and prints every problem for an invalid config', () => {
    const config = path.join(tmp, 'appfunctions.config.ts');
    fs.writeFileSync(
      config,
      `export default { android: { kotlinPackage: 'a.b', serviceName: 'S' },
        functions: { f: { description: 'x', handler: 'native', returns: { type: 'list', of: 'int' } } } };`
    );
    const stderr = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    expect(main(args(config))).toBe(1);
    expect(stderr.mock.calls.map((c) => c[0]).join('')).toBe(
      'react-native-app-functions: invalid appfunctions.config.ts\n' +
        '  - function "f", field "returns": lists of "int" are not supported by AppFunctions (supported: string, localDate, localDateTime, instant and declared types); wrap the value in a declared type\n'
    );
    stderr.mockRestore();
    expect(fs.existsSync(path.join(tmp, 'manifest'))).toBe(false);
  });

  it('fails clearly when the config file is missing', () => {
    const stderr = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    expect(main(args(path.join(tmp, 'nope.ts')))).toBe(1);
    expect(stderr.mock.calls.map((c) => c[0]).join('')).toContain(
      'config file not found'
    );
    stderr.mockRestore();
  });
});
