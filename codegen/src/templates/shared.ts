import type { AppFunctionsModel, Scalar, TypeRef, ValueModel } from '../model';

export const GENERATED_NOTE =
  'GENERATED — do not edit. Source: appfunctions.config.ts (react-native-app-functions).';
export const KOTLIN_HEADER = `// ${GENERATED_NOTE}`;
export const XML_HEADER = `<!-- ${GENERATED_NOTE} -->`;

const SCALAR_KOTLIN: Record<Scalar, { type: string; import?: string }> = {
  string: { type: 'String' },
  int: { type: 'Int' },
  long: { type: 'Long' },
  double: { type: 'Double' },
  boolean: { type: 'Boolean' },
  localDate: { type: 'LocalDate', import: 'java.time.LocalDate' },
  localDateTime: { type: 'LocalDateTime', import: 'java.time.LocalDateTime' },
  instant: { type: 'Instant', import: 'java.time.Instant' },
};

export function kotlinType(v: ValueModel): string {
  const item = typeRefKotlin(v.item);
  return (v.list ? `List<${item}>` : item) + (v.nullable ? '?' : '');
}

function typeRefKotlin(t: TypeRef): string {
  return t.kind === 'named' ? t.name : SCALAR_KOTLIN[t.scalar].type;
}

/** `java.time` imports needed to reference these values. */
export function kotlinImportsFor(values: ValueModel[]): string[] {
  const imports = new Set<string>();
  for (const v of values) {
    if (v.item.kind === 'scalar') {
      const imp = SCALAR_KOTLIN[v.item.scalar].import;
      if (imp) imports.add(imp);
    }
  }
  return [...imports];
}

export function importBlock(imports: string[]): string {
  const sorted = [...new Set(imports)].sort();
  return sorted.length
    ? sorted.map((i) => `import ${i}`).join('\n') + '\n\n'
    : '';
}

/** KDoc block. A single short line becomes `/** text *\/`. */
export function kdoc(lines: string[], indent: string): string {
  const flat = lines.flatMap((l) => l.split('\n'));
  if (flat.length === 1) return `${indent}/** ${flat[0]} */\n`;
  const body = flat
    .map((l) => (l === '' ? `${indent} *` : `${indent} * ${l}`))
    .join('\n');
  return `${indent}/**\n${body}\n${indent} */\n`;
}

export function kotlinPackagePath(model: AppFunctionsModel): string {
  return model.kotlinPackage.split('.').join('/');
}

export function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;');
}

/** Android string resource escaping (aapt2) on top of XML escaping. */
export function escapeAndroidString(s: string): string {
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
  return /^[@?]/.test(escaped) ? `\\${escaped}` : escaped;
}
