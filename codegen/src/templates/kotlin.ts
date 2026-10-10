import type { AppFunctionsModel, FunctionModel, TypeModel } from '../model';
import { handlerInterfaceName } from '../validate';
import {
  KOTLIN_HEADER,
  importBlock,
  kdoc,
  kotlinImportsFor,
  kotlinType,
} from './shared';

/** `Base<serviceName>.kt`: the `@AppFunctionServiceEntryPoint` class KSP turns into the service. */
export function serviceFile(m: AppFunctionsModel): string {
  const imports = [
    'androidx.annotation.RequiresApi',
    'androidx.appfunctions.AppFunctionAppUnknownException',
    'androidx.appfunctions.AppFunctionDeclaration',
    'androidx.appfunctions.AppFunctionService',
    'androidx.appfunctions.AppFunctionServiceEntryPoint',
    'kotlinx.coroutines.Dispatchers',
    'kotlinx.coroutines.withContext',
    ...kotlinImportsFor(
      m.functions.flatMap((f) => [f.returns, ...f.params.map((p) => p.value)])
    ),
  ];
  return `${KOTLIN_HEADER}
package ${m.kotlinPackage}

${importBlock(imports)}${kdoc(
    [
      `AppFunctions entry point. KSP generates the concrete \`${m.serviceName}\` subclass and`,
      `\`assets/${m.xmlFileName}.xml\` (plus \`${m.xmlFileName}-v1.xml\`) from this class.`,
    ],
    ''
  )}@RequiresApi(36)
@AppFunctionServiceEntryPoint(
  serviceName = "${m.serviceName}",
  appFunctionXmlFileName = "${m.xmlFileName}",
)
abstract class ${m.baseClassName} : AppFunctionService() {

  private val handlers: AppFunctionsHandlers
    get() =
      applicationContext as? AppFunctionsHandlers
        ?: throw AppFunctionAppUnknownException(
          "Application does not implement AppFunctionsHandlers"
        )
${m.functions.map(declaration).join('')}}
`;
}

function declaration(f: FunctionModel): string {
  const tags = [
    ...f.params
      .filter((p) => p.value.description !== undefined)
      .map((p) => `@param ${p.name} ${p.value.description}`),
    ...(f.returns.description !== undefined
      ? [`@return ${f.returns.description}`]
      : []),
  ];
  const doc = kdoc(
    tags.length ? [f.description, '', ...tags] : [f.description],
    '  '
  );
  const signature = f.params.length
    ? `(\n${f.params
        .map(
          (p) =>
            `    ${p.name}: ${kotlinType(p.value)}${p.value.nullable ? ' = null' : ''},\n`
        )
        .join('')}  )`
    : '()';
  const args = f.params.map((p) => p.name).join(', ');
  return `
${doc}  @AppFunctionDeclaration(isDescribedByKDoc = true)
  suspend fun ${f.name}${signature}: ${kotlinType(f.returns)} =
    withContext(Dispatchers.IO) { handlers.${f.name}Handler.${f.name}(${args}) }
`;
}

/** `<TypeName>.kt`: one `@AppFunctionSerializable` data class. */
export function typeFile(m: AppFunctionsModel, t: TypeModel): string {
  const imports = [
    'androidx.appfunctions.AppFunctionSerializable',
    ...kotlinImportsFor(t.fields.map((f) => f.value)),
  ];
  const props = t.fields
    .map(
      (f) =>
        (f.value.description !== undefined
          ? kdoc([f.value.description], '  ')
          : '') + `  val ${f.name}: ${kotlinType(f.value)},\n`
    )
    .join('');
  return `${KOTLIN_HEADER}
package ${m.kotlinPackage}

${importBlock(imports)}${t.description !== undefined ? kdoc([t.description], '') : ''}@AppFunctionSerializable(isDescribedByKDoc = true)
data class ${t.name}(
${props})
`;
}

/** `AppFunctionsHandlers.kt`: what the app implements for `native` functions. */
export function handlersFile(m: AppFunctionsModel): string {
  const imports = kotlinImportsFor(
    m.functions.flatMap((f) => [f.returns, ...f.params.map((p) => p.value)])
  );
  const interfaces = m.functions
    .map((f) => {
      const params = f.params
        .map((p) => `${p.name}: ${kotlinType(p.value)}`)
        .join(', ');
      return `${kdoc([`Native implementation of the \`${f.name}\` AppFunction, provided by the app.`], '')}fun interface ${handlerInterfaceName(f.name)} {
  suspend fun ${f.name}(${params}): ${kotlinType(f.returns)}
}
`;
    })
    .join('\n');
  const props = m.functions
    .map((f) => `  val ${f.name}Handler: ${handlerInterfaceName(f.name)}\n`)
    .join('');
  return `${KOTLIN_HEADER}
package ${m.kotlinPackage}

${importBlock(imports)}${interfaces}
${kdoc(
  [
    "Implemented by the app's [android.app.Application] so the AppFunction service can reach the",
    'handlers without depending on React Native or a DI framework.',
  ],
  ''
)}interface AppFunctionsHandlers {
${props}}
`;
}
