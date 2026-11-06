import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';

// Function under test (matching build.mjs)
function stripModuleSyntax(source, filename = 'test.js') {
  let code = source
    .replace(/^\s*import\s+(?:['"][^'"]+['"]|[\s\S]*?from\s+['"][^'"]+['"]);?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+async\s+function\b/gm, 'async function')
    .replace(/^\s*export\s+default\s+function\b/gm, 'function')
    .replace(/^\s*export\s+default\s+class\b/gm, 'class')
    .replace(/^\s*export\s+async\s+function\b/gm, 'async function')
    .replace(/^\s*export\s+function\b/gm, 'function')
    .replace(/^\s*export\s+class\b/gm, 'class')
    .replace(/^\s*export\s+(const|let|var)\b/gm, '$1')
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');
  try {
    new Script(code, { filename });
  } catch (err) {
    throw new Error(`[build.mjs] Module syntax validation failed for ${filename}: ${err.message}\nCode:\n${code}`);
  }
  return code;
}

test('stripModuleSyntax handles export function and async function', () => {
  const src = `
export function hello(name) { return 'Hello ' + name; }
export async function fetchGreeting() { return hello('world'); }
  `;
  const res = stripModuleSyntax(src);
  assert.ok(!res.includes('export'));
  assert.ok(res.includes('function hello('));
  assert.ok(res.includes('async function fetchGreeting('));
});

test('stripModuleSyntax handles export class and declarations', () => {
  const src = `
export class MyService {
  constructor(val) { this.val = val; }
}
export const DEFAULT_TIMEOUT = 5000;
export let counter = 0;
export var globalFlag = true;
  `;
  const res = stripModuleSyntax(src);
  assert.ok(!res.includes('export'));
  assert.ok(res.includes('class MyService'));
  assert.ok(res.includes('const DEFAULT_TIMEOUT = 5000;'));
  assert.ok(res.includes('let counter = 0;'));
  assert.ok(res.includes('var globalFlag = true;'));
});

test('stripModuleSyntax handles single-line and multiline export clauses', () => {
  const src = `
function a() {}
function b() {}
export { a, b };
function c() {}
function d() {}
export {
  c,
  d
};
  `;
  const res = stripModuleSyntax(src);
  assert.ok(!res.includes('export'));
  assert.ok(res.includes('function a()'));
  assert.ok(res.includes('function c()'));
});

test('stripModuleSyntax handles export default functions and classes', () => {
  const src = `
export default function defaultHelper() { return 42; }
export default class DefaultWorker { run() {} }
  `;
  const res = stripModuleSyntax(src);
  assert.ok(!res.includes('export'));
  assert.ok(!res.includes('default function'));
  assert.ok(!res.includes('default class'));
  assert.ok(res.includes('function defaultHelper('));
  assert.ok(res.includes('class DefaultWorker'));
});

test('stripModuleSyntax handles single-line and multiline imports and side-effect imports', () => {
  const src = `
import { foo } from './foo.mjs';
import * as bar from './bar.mjs';
import def from './def.mjs';
import './side-effect.mjs';
import {
  alpha,
  beta
} from './greek.mjs';

function main() { return 1; }
export function run() { return main(); }
  `;
  const res = stripModuleSyntax(src);
  assert.ok(!res.includes('import'));
  assert.ok(!res.includes('export'));
  assert.ok(res.includes('function main()'));
  assert.ok(res.includes('function run()'));
});

test('stripModuleSyntax preserves comments and internal logic without corrupting strings', () => {
  const src = `
// This is an internal export comment
/* Another comment about imports */
export function calculate(val) {
  const msg = "don't export this string";
  return val * 2;
}
  `;
  const res = stripModuleSyntax(src);
  assert.ok(res.includes('calculate(val)'));
  assert.ok(res.includes("don't export this string"));
});
