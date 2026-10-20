import type {
  AppFunctionsModel,
  FieldModel,
  FunctionModel,
  Scalar,
  TypeModel,
  ValueModel,
} from '../model';
import { handlerInterfaceName, titleCase } from '../validate';
import { GENERATED_NOTE } from './shared';

/** File name of the generated Swift source in the iOS app target. */
export const SWIFT_FILE_NAME = 'AppFunctions.generated.swift';

const SWIFT_HEADER = `// ${GENERATED_NOTE}`;

const SCALAR_SWIFT: Record<Scalar, string> = {
  string: 'String',
  int: 'Int',
  long: 'Int',
  double: 'Double',
  boolean: 'Bool',
  // Time-zone dependent: a local date/time becomes the matching instant in the device's zone.
  localDate: 'Date',
  localDateTime: 'Date',
  instant: 'Date',
};

const SWIFT_KEYWORDS = new Set([
  'associatedtype',
  'class',
  'deinit',
  'enum',
  'extension',
  'fileprivate',
  'func',
  'import',
  'init',
  'inout',
  'internal',
  'let',
  'open',
  'operator',
  'private',
  'precedencegroup',
  'protocol',
  'public',
  'rethrows',
  'static',
  'struct',
  'subscript',
  'typealias',
  'var',
  'break',
  'case',
  'catch',
  'continue',
  'default',
  'defer',
  'do',
  'else',
  'fallthrough',
  'for',
  'guard',
  'if',
  'in',
  'repeat',
  'return',
  'throw',
  'switch',
  'where',
  'while',
  'as',
  'await',
  'false',
  'is',
  'nil',
  'super',
  'throws',
  'true',
  'try',
]);

/** Swift/Foundation names a declared type must not shadow in the generated file. */
const SWIFT_RESERVED_TYPE_NAMES = new Set([
  'Any',
  'Array',
  'Bool',
  'Character',
  'Data',
  'Date',
  'Decimal',
  'Dictionary',
  'Double',
  'Error',
  'Float',
  'Int',
  'Never',
  'Optional',
  'Result',
  'Set',
  'String',
  'URL',
  'UUID',
  'Void',
]);

/** Members of `TransientAppEntity` that a field with the same name would clash with. */
const ENTITY_MEMBERS = new Set(['id', 'displayRepresentation']);
/** Members of `AppIntent` that a parameter with the same name would clash with. */
const INTENT_MEMBERS = new Set(['perform', 'parameterSummary']);

const isIosFunction = (f: FunctionModel) => f.handler === 'native';
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Identifier, backtick-escaped when it is a Swift keyword. */
const ident = (name: string) =>
  SWIFT_KEYWORDS.has(name) ? `\`${name}\`` : name;

/** Argument label: only `inout`, `var` and `let` need escaping there. */
const label = (name: string) =>
  ['inout', 'var', 'let'].includes(name) ? `\`${name}\`` : name;

const entityName = (type: string) => `${type}Entity`;
const intentName = (f: FunctionModel) => `${upperFirst(f.name)}Intent`;

/** Swift property name of a field inside its entity (renamed when it clashes with an entity member). */
function entityProperty(t: TypeModel, field: string): string {
  return ENTITY_MEMBERS.has(field)
    ? `${lowerFirst(t.name)}${upperFirst(field)}`
    : field;
}

/** Problems that only matter for the iOS output. Checked when the Swift file is generated. */
export function iosProblems(m: AppFunctionsModel): string[] {
  const problems: string[] = [];
  const typeNames = new Set(m.types.map((t) => t.name));
  const generated = new Set([
    'AppFunctionsHandlers',
    'AppFunctionsRegistry',
    'AppFunctionsIntentError',
    ...m.types.map((t) => entityName(t.name)),
    ...m.functions.flatMap((f) => [
      intentName(f),
      handlerInterfaceName(f.name),
    ]),
  ]);
  for (const t of m.types) {
    if (SWIFT_RESERVED_TYPE_NAMES.has(t.name) || generated.has(t.name)) {
      problems.push(
        `type "${t.name}": this name is reserved on iOS (Swift built-in or a generated type); pick another`
      );
    }
    const names = new Set(t.fields.map((f) => f.name));
    for (const f of t.fields) {
      if (f.name === 'self') {
        problems.push(
          `type "${t.name}", field "self": not a valid name on iOS`
        );
      }
      const prop = entityProperty(t, f.name);
      if (prop !== f.name && names.has(prop)) {
        problems.push(
          `type "${t.name}", field "${f.name}": on iOS it becomes "${prop}", which is already a field; rename one of them`
        );
      }
    }
  }
  for (const f of m.functions.filter(isIosFunction)) {
    for (const p of f.params) {
      const where = `function "${f.name}", param "${p.name}"`;
      if (p.name === 'self' || INTENT_MEMBERS.has(p.name)) {
        problems.push(`${where}: this name is reserved on iOS; pick another`);
      }
      if (p.value.item.kind === 'named' && typeNames.has(p.value.item.name)) {
        problems.push(
          `${where}: declared types as parameters are not supported on iOS yet; pass scalar fields instead`
        );
      }
    }
  }
  return problems;
}

/** `AppFunctions.generated.swift`: App Intents for the iOS app target. */
export function swiftFile(m: AppFunctionsModel): string {
  const fns = m.functions.filter(isIosFunction);
  const skipped = m.functions.filter((f) => !isIosFunction(f));
  const parts: string[] = [
    `${SWIFT_HEADER}\nimport AppIntents\nimport Foundation\n`,
  ];
  if (skipped.length) {
    parts.push(
      `// Not exposed on iOS yet ("js" handlers): ${skipped.map((f) => f.name).join(', ')}.\n`
    );
  }
  parts.push(...m.types.map(structDecl));
  if (fns.length) {
    parts.push(...fns.map(handlerProtocol), registry(fns), ERROR_TYPE);
  }
  parts.push(...m.types.map(entityDecl));
  parts.push(...fns.map(intentDecl));
  return parts.join('\n');
}

function docComment(text: string | undefined, indent: string): string {
  if (text === undefined) return '';
  return text
    .split('\n')
    .map((l) => (l === '' ? `${indent}///\n` : `${indent}/// ${l}\n`))
    .join('');
}

function swiftString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Plain value type used by native handlers. */
function swiftType(v: ValueModel): string {
  const item =
    v.item.kind === 'named' ? v.item.name : SCALAR_SWIFT[v.item.scalar];
  return (v.list ? `[${item}]` : item) + (v.nullable ? '?' : '');
}

/** Type the intent exposes to the system: declared types become their entities. */
function intentType(v: ValueModel): string {
  const item =
    v.item.kind === 'named'
      ? entityName(v.item.name)
      : SCALAR_SWIFT[v.item.scalar];
  return (v.list ? `[${item}]` : item) + (v.nullable ? '?' : '');
}

/** Converts `expr` (a `swiftType(v)` value) to `intentType(v)`. */
function toIntent(v: ValueModel, expr: string): string {
  if (v.item.kind !== 'named') return expr;
  const init = `${entityName(v.item.name)}.init`;
  if (v.list)
    return v.nullable ? `${expr}?.map(${init})` : `${expr}.map(${init})`;
  return v.nullable
    ? `${expr}.map(${init})`
    : `${entityName(v.item.name)}(${expr})`;
}

function structDecl(t: TypeModel): string {
  const fields = t.fields
    .map(
      (f) =>
        `${docComment(f.value.description, '  ')}  var ${ident(f.name)}: ${swiftType(f.value)}\n`
    )
    .join('');
  return `${docComment(t.description, '')}struct ${t.name} {\n${fields}}\n`;
}

function handlerProtocol(f: FunctionModel): string {
  const params = f.params
    .map((p) => `${ident(p.name)}: ${swiftType(p.value)}`)
    .join(', ');
  return `/// Native implementation of the \`${f.name}\` AppFunction, provided by the app.
protocol ${handlerInterfaceName(f.name)} {
  func ${ident(f.name)}(${params}) async throws -> ${swiftType(f.returns)}
}
`;
}

function registry(fns: FunctionModel[]): string {
  const props = fns
    .map(
      (f) => `  var ${f.name}Handler: ${handlerInterfaceName(f.name)} { get }\n`
    )
    .join('');
  return `/// Implemented by the app and registered in \`AppFunctionsRegistry.handlers\` at launch, so the
/// App Intents can reach the handlers without depending on React Native.
protocol AppFunctionsHandlers {
${props}}

enum AppFunctionsRegistry {
  /// Set this in \`application(_:didFinishLaunchingWithOptions:)\`.
  static var handlers: AppFunctionsHandlers?
}
`;
}

const ERROR_TYPE = `/// An error whose message Shortcuts and Siri show to the user.
@available(iOS 16.0, *)
struct AppFunctionsIntentError: Error, CustomLocalizedStringResourceConvertible {
  let message: String
  var localizedStringResource: LocalizedStringResource {
    LocalizedStringResource(stringLiteral: message)
  }
}
`;

/** Title and subtitle: the first two non-null, non-list string fields other than `id`. */
function displayRepresentation(t: TypeModel): string {
  const shown = t.fields
    .filter(
      (f) =>
        f.name !== 'id' &&
        !f.value.list &&
        !f.value.nullable &&
        f.value.item.kind === 'scalar' &&
        f.value.item.scalar === 'string'
    )
    .slice(0, 2)
    .map((f) => `"\\(${ident(entityProperty(t, f.name))})"`);
  const args =
    shown.length === 0
      ? `title: ${swiftString(titleCase(t.name))}`
      : shown.length === 1
        ? `title: ${shown[0]}`
        : `title: ${shown[0]}, subtitle: ${shown[1]}`;
  return `  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(${args})
  }
`;
}

function entityDecl(t: TypeModel): string {
  const props = t.fields
    .map(
      (f) =>
        `  @Property(title: ${swiftString(titleCase(f.name))})\n  var ${ident(entityProperty(t, f.name))}: ${intentType(f.value)}\n`
    )
    .join('');
  const assigns = t.fields
    .map(
      (f) =>
        `    ${ident(entityProperty(t, f.name))} = ${toIntent(f.value, `value.${ident(f.name)}`)}\n`
    )
    .join('');
  return `@available(iOS 16.0, *)
struct ${entityName(t.name)}: TransientAppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = ${swiftString(titleCase(t.name))}

${props}
${displayRepresentation(t)}
  init() {}

  init(_ value: ${t.name}) {
${assigns}  }
}
`;
}

function parameterDecl(p: FieldModel): string {
  const description =
    p.value.description !== undefined
      ? `, description: ${swiftString(p.value.description.replace(/\n/g, ' '))}`
      : '';
  return `  @Parameter(title: ${swiftString(titleCase(p.name))}${description})
  var ${ident(p.name)}: ${swiftType(p.value)}
`;
}

function intentDecl(f: FunctionModel): string {
  const params = f.params.map(parameterDecl).join('');
  const args = f.params
    .map((p) => `${label(p.name)}: ${ident(p.name)}`)
    .join(', ');
  return `@available(iOS 16.0, *)
struct ${intentName(f)}: AppIntent {
  static let title: LocalizedStringResource = ${swiftString(f.title)}
  static let description = IntentDescription(
    ${swiftString(f.description.replace(/\n/g, ' '))}
  )
${params ? `\n${params}` : ''}
  func perform() async throws -> some IntentResult & ReturnsValue<${intentType(f.returns)}> {
    guard let handlers = AppFunctionsRegistry.handlers else {
      throw AppFunctionsIntentError(message: "The app did not register AppFunctionsHandlers")
    }
    let value = try await handlers.${f.name}Handler.${ident(f.name)}(${args})
    return .result(value: ${toIntent(f.returns, 'value')})
  }
}
`;
}
