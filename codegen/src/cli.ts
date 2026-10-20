import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfigError } from './errors';
import { parseConfigSource } from './parse';
import type { AppFunctionsModel } from './model';
import {
  render,
  renderSwift,
  type GeneratedFile,
  type OutputRoot,
} from './render';
import { validateConfig } from './validate';

const USAGE =
  'usage: react-native-app-functions-codegen --config <appfunctions.config.ts> ' +
  '[--kotlin-out <dir> --res-out <dir> --manifest-out <dir>] [--swift-out <file.swift>]';

type Args = {
  config: string;
  /** Android output dirs. All three or none. */
  android?: Record<OutputRoot, string>;
  /** The iOS `AppFunctions.generated.swift` path. */
  swift?: string;
};

export function parseArgs(argv: string[]): Args {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (!flag?.startsWith('--') || val === undefined) throw new Error(USAGE);
    flags[flag.slice(2)] = val;
  }
  const {
    config,
    'kotlin-out': kotlin,
    'res-out': res,
    'manifest-out': manifest,
    'swift-out': swift,
    ...unknown
  } = flags;
  const androidFlags = [kotlin, res, manifest].filter((v) => v !== undefined);
  if (
    !config ||
    Object.keys(unknown).length > 0 ||
    (androidFlags.length !== 0 && androidFlags.length !== 3) ||
    (androidFlags.length === 0 && !swift)
  ) {
    throw new Error(USAGE);
  }
  return {
    config,
    ...(kotlin && res && manifest && { android: { kotlin, res, manifest } }),
    ...(swift && { swift }),
  };
}

/** Parses and validates the config file. Throws `ConfigError` on invalid config. */
export function loadModel(configPath: string): AppFunctionsModel {
  if (!fs.existsSync(configPath)) {
    throw new ConfigError([`config file not found: ${configPath}`]);
  }
  const source = fs.readFileSync(configPath, 'utf8');
  return validateConfig(parseConfigSource(source, configPath));
}

/** Android files for the config file. Throws `ConfigError` on invalid config. */
export function generate(configPath: string): GeneratedFile[] {
  return render(loadModel(configPath));
}

/** Writes `contents` to `file` only when it changed (keeps Xcode from recompiling). */
export function writeFileIfChanged(file: string, contents: string) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === contents) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

/**
 * Makes each output dir contain exactly the generated files: writes changed files only (keeps
 * timestamps stable for Gradle/KSP) and deletes stale ones. The dirs are owned by the codegen.
 */
export function writeOutputs(
  files: GeneratedFile[],
  outDirs: Record<OutputRoot, string>
) {
  for (const root of Object.keys(outDirs) as OutputRoot[]) {
    const dir = outDirs[root];
    const wanted = new Map(
      files
        .filter((f) => f.root === root)
        .map((f) => [path.join(dir, f.path), f.contents])
    );
    for (const existing of listFiles(dir)) {
      if (!wanted.has(existing)) fs.rmSync(existing);
    }
    for (const [file, contents] of wanted) {
      if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === contents)
        continue;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, contents);
    }
    removeEmptyDirs(dir);
  }
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : [p];
  });
}

function removeEmptyDirs(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    removeEmptyDirs(p);
    if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
  }
}

export function main(argv: string[]): number {
  try {
    const args = parseArgs(argv);
    const model = loadModel(args.config);
    // Render everything before writing anything, so an invalid config leaves outputs untouched.
    const android = args.android ? render(model) : undefined;
    const swift = args.swift ? renderSwift(model) : undefined;
    if (args.android && android) writeOutputs(android, args.android);
    if (args.swift && swift !== undefined)
      writeFileIfChanged(args.swift, swift);
    return 0;
  } catch (e) {
    if (e instanceof ConfigError) {
      process.stderr.write(
        `react-native-app-functions: invalid appfunctions.config.ts\n${e.problems
          .map((p) => `  - ${p}`)
          .join('\n')}\n`
      );
      return 1;
    }
    process.stderr.write(
      `react-native-app-functions: ${(e as Error).message}\n`
    );
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
