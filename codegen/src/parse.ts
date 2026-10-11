import * as path from 'node:path';
import ts from 'typescript';
import { ConfigError } from './errors';

/** A plain value extracted from the config literal. */
export type Literal =
  string | number | boolean | Literal[] | { [key: string]: Literal };

/**
 * Extracts the default export of `appfunctions.config.ts` as plain data, without executing it.
 *
 * Accepted: `export default defineAppFunctions({...})` or `export default {...}`, optionally with
 * `as const` / `satisfies`. Values may only be string and number literals, booleans, arrays and
 * object literals.
 */
export function parseConfigSource(source: string, fileName: string): Literal {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const problems: string[] = [];
  const where = (node: ts.Node) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(
      node.getStart(sf)
    );
    return `${path.basename(fileName)}:${line + 1}:${character + 1}`;
  };

  const exportDefault = sf.statements.find(ts.isExportAssignment);
  if (!exportDefault || exportDefault.isExportEquals) {
    throw new ConfigError([
      `${path.basename(fileName)}: expected \`export default defineAppFunctions({...})\``,
    ]);
  }

  let root = unwrap(exportDefault.expression);
  if (ts.isCallExpression(root)) {
    const callee = root.expression;
    const arg = root.arguments[0];
    if (
      !ts.isIdentifier(callee) ||
      callee.text !== 'defineAppFunctions' ||
      root.arguments.length !== 1 ||
      arg === undefined
    ) {
      throw new ConfigError([
        `${where(root)}: expected \`defineAppFunctions({...})\` with a single object literal`,
      ]);
    }
    root = unwrap(arg);
  }

  const toLiteral = (node: ts.Expression): Literal | undefined => {
    node = unwrap(node);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text;
    }
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isArrayLiteralExpression(node)) {
      const items: Literal[] = [];
      for (const el of node.elements) {
        const v = toLiteral(el);
        if (v !== undefined) items.push(v);
      }
      return items;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const obj: { [key: string]: Literal } = {};
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop)) {
          problems.push(
            `${where(prop)}: only \`key: value\` properties are allowed (no shorthand, spreads or methods)`
          );
          continue;
        }
        const key =
          ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
            ? prop.name.text
            : undefined;
        if (key === undefined) {
          problems.push(
            `${where(prop.name)}: property names must be plain identifiers or strings`
          );
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          problems.push(`${where(prop.name)}: duplicate key "${key}"`);
          continue;
        }
        const v = toLiteral(prop.initializer);
        if (v !== undefined) obj[key] = v;
      }
      return obj;
    }
    problems.push(
      `${where(node)}: only literal values are allowed (strings, numbers, booleans, objects, arrays); found ${describe(node)}. The config is read at build time and never executed.`
    );
    return undefined;
  };

  const result = toLiteral(root);
  if (problems.length > 0) throw new ConfigError(problems);
  if (
    result === undefined ||
    typeof result !== 'object' ||
    Array.isArray(result)
  ) {
    throw new ConfigError([
      `${where(root)}: the default export must be an object literal`,
    ]);
  }
  return result;
}

function unwrap(node: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

function describe(node: ts.Expression): string {
  if (ts.isIdentifier(node)) return `a variable (\`${node.text}\`)`;
  if (ts.isNumericLiteral(node)) return 'a number';
  if (ts.isTemplateExpression(node)) return 'a template string with ${...}';
  if (ts.isCallExpression(node)) return 'a function call';
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
  return ts.SyntaxKind[node.kind] ?? 'an expression';
}
