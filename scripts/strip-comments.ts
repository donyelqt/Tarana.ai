import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

const SKIP = new Set(['node_modules', '.next', 'coverage', '.git', 'dist']);
const ROOTS = process.argv.slice(2);
const targets = ROOTS.length > 0 ? ROOTS : ['src', 'tests', 'scripts', 'public', 'tarana-mobile'];

function walk(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (/\.tsx?$/.test(entry.name) && entry.name !== 'next-env.d.ts') {
      out.push(join(dir, entry.name));
    }
  }
}

const files: string[] = [];
for (const root of targets) walk(root, files);

const DIRECTIVE =
  /@ts-(nocheck|check|ignore|expect-error)|eslint-(disable|enable)|prettier-ignore|@jest-environment|istanbul ignore|@license|@preserve|webpack(ChunkName|Prefetch|Preload)|@vite-ignore|@__PURE__|^\/\/\/ <reference/;

function collectLiteralRanges(sourceFile: ts.SourceFile): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  const visit = (node: ts.Node): void => {
    const isLiteral =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isRegularExpressionLiteral(node) ||
      ts.isJsxText(node);

    if (isLiteral) ranges.push([node.getStart(sourceFile), node.getEnd()]);

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}

function findCommentRanges(text: string, literalRanges: Array<[number, number]>) {
  const comments: Array<[number, number]> = [];
  let li = 0;
  let i = 0;

  while (i < text.length) {
    while (li < literalRanges.length && literalRanges[li][1] <= i) li++;

    if (li < literalRanges.length && i >= literalRanges[li][0] && i < literalRanges[li][1]) {
      i = literalRanges[li][1];
      continue;
    }

    if (text[i] === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      const end = nl === -1 ? text.length : nl;
      comments.push([i, end]);
      i = end;
      continue;
    }

    if (text[i] === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? text.length : close + 2;
      comments.push([i, end]);
      i = end;
      continue;
    }

    i++;
  }

  return comments;
}

function stripCommentsFromSource(sourceText: string, fileName: string) {
  let shebang = '';
  let text = sourceText;
  if (sourceText.startsWith('#!')) {
    const nl = sourceText.indexOf('\n');
    shebang = sourceText.slice(0, nl + 1);
    text = sourceText.slice(nl + 1);
  }

  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile('file', text, ts.ScriptTarget.Latest, true, scriptKind);
  const literalRanges = collectLiteralRanges(sourceFile);
  const comments = findCommentRanges(text, literalRanges);

  const removable = comments
    .filter(([start, end]) => !DIRECTIVE.test(text.slice(start, end)))
    .map(([start, end]) => {
      let e = end;
      while (e > start && (text[e - 1] === '\n' || text[e - 1] === '\r')) e--;
      while (e > start && (text[e - 1] === ' ' || text[e - 1] === '\t')) e--;
      return [start, e] as [number, number];
    })
    .sort((a, b) => b[0] - a[0]);

  let result = text;

  for (const [start, end] of removable) {
    const lineStart = result.lastIndexOf('\n', start - 1) + 1;
    const nextNl = result.indexOf('\n', end);
    const before = result.slice(lineStart, start);
    const after = nextNl === -1 ? '' : result.slice(end, nextNl);
    const standalone = /^[ \t]*$/.test(before) && /^[ \t]*$/.test(after);

    if (standalone) {
      const removalEnd = nextNl === -1 ? result.length : nextNl + 1;
      result = result.slice(0, lineStart) + result.slice(removalEnd);
    } else {
      result = result.slice(0, start) + result.slice(end);
    }
  }

  result = shebang + result;

  if (/\r\n/.test(sourceText) && !/\r\n/.test(result)) {
    result = result.replace(/\n/g, '\r\n');
  }

  return { result, removed: removable.length };
}

let filesChanged = 0;
let totalRemoved = 0;

for (const filePath of files) {
  const sourceText = readFileSync(filePath, 'utf-8');
  const { result, removed } = stripCommentsFromSource(sourceText, filePath);

  if (removed > 0) {
    writeFileSync(filePath, result, 'utf-8');
    filesChanged++;
    totalRemoved += removed;
  }
}

console.log(`${filesChanged} files changed, ${totalRemoved} comments removed`);