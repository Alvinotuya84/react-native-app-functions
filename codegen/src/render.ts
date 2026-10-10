import type { AppFunctionsModel } from './model';
import {
  APP_METADATA_RES,
  appMetadataFile,
  hasAppMetadata,
  manifestFile,
  stringsFile,
} from './templates/android';
import { handlersFile, serviceFile, typeFile } from './templates/kotlin';
import { kotlinPackagePath } from './templates/shared';

export type OutputRoot = 'kotlin' | 'res' | 'manifest';

export type GeneratedFile = {
  root: OutputRoot;
  /** Path relative to its root, with `/` separators. */
  path: string;
  contents: string;
};

/** All generated files for a validated config. Pure: same model in, same files out. */
export function render(m: AppFunctionsModel): GeneratedFile[] {
  const pkg = kotlinPackagePath(m);
  const files: GeneratedFile[] = [
    {
      root: 'kotlin',
      path: `${pkg}/${m.baseClassName}.kt`,
      contents: serviceFile(m),
    },
    ...m.types.map((t) => ({
      root: 'kotlin' as const,
      path: `${pkg}/${t.name}.kt`,
      contents: typeFile(m, t),
    })),
    {
      root: 'kotlin',
      path: `${pkg}/AppFunctionsHandlers.kt`,
      contents: handlersFile(m),
    },
    {
      root: 'manifest',
      path: 'AndroidManifest.xml',
      contents: manifestFile(m),
    },
  ];
  if (hasAppMetadata(m)) {
    files.push({
      root: 'res',
      path: `xml/${APP_METADATA_RES}.xml`,
      contents: appMetadataFile(m),
    });
  }
  if (m.appDisplayDescription !== undefined) {
    files.push({
      root: 'res',
      path: 'values/appfunctions_strings.xml',
      contents: stringsFile(m),
    });
  }
  return files;
}
