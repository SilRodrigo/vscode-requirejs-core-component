const test = require('tehanu')(__filename)
const assert = require('assert');
const ModuleAnalyser = require('../src/moduleAnalyser');
const { parseModule } = require('../src/codeParser');
const moduleAnalyser = new ModuleAnalyser();

function parseTest(input, options = {}) {
  return parseModule(input, { loc: true, ...options });
}

test('should return object with module path and name', () => {
  const input = 'define([\'./path/to/a\', \'./path/to/b\'], function (moduleA, moduleB) {});';
  const expected = {
    moduleA: { source: './path/to/a' },
    moduleB: { source: './path/to/b' }
  };

  assert.deepEqual(moduleAnalyser.getModuleDependencies({
    fileName: '1',
    version: 1
  }, parseTest(input)), expected);
});

test('should return object with module path and name for multiline define', () => {
  const input = `define([
      'moduleA',
      'moduleB'
    ], function(a, b) {});`;
  const expected = {
    a: { source: 'moduleA' },
    b: { source: 'moduleB' }
  };

  assert.deepEqual(moduleAnalyser.getModuleDependencies({
    fileName: '2',
    version: 1
  }, parseTest(input)), expected);
});

test('should return object with module path and name for multiline require', () => {
  const input = `require([
      'moduleA',
      'moduleB'
    ], function(a, b) {});`;
  const expected = {
    a: { source: 'moduleA' },
    b: { source: 'moduleB' }
  };

  assert.deepEqual(moduleAnalyser.getModuleDependencies({
    fileName: '3',
    version: 1
  }, parseTest(input)), expected);
});

test('should return object with module path and name for named module', () => {
  const input = 'define(\'myName\', [\'moduleA\', \'moduleB\'], function(a, b) {});';
  const expected = {
    a: { source: 'moduleA' },
    b: { source: 'moduleB' }
  };

  assert.deepEqual(moduleAnalyser.getModuleDependencies({
    fileName: '4',
    version: 1
  }, parseTest(input)), expected);
});

test('should return object with destructured parameters', () => {
  const input = 'define([\'moduleA\'], function({ foo }) {});';
  const expected = {
    foo: { property: 'foo', source: 'moduleA' }
  };

  assert.deepEqual(moduleAnalyser.getModuleDependencies({
    fileName: '5',
    version: 1
  }, parseTest(input)), expected);
});

test('should return object with destructured renamed parameters', () => {
  const input = 'define([\'moduleA\'], function({ foo: bar }) {});';
  const expected = {
    bar: { property: 'foo', source: 'moduleA' }
  };

  assert.deepEqual(moduleAnalyser.getModuleDependencies({
    fileName: '6',
    version: 1
  }, parseTest(input)), expected);
});

test('should return object with an esm module and default imports', () => {
  const input = 'import a from \'moduleA\';';
  const expected = {
    a: { source: 'moduleA' }
  };

  assert.deepEqual(moduleAnalyser.getModuleDependencies({
    fileName: '7',
    version: 1
  }, parseTest(input, { module: true })), expected);
});

test('should return object with an esm module and named imports', () => {
  const input = 'import { foo } from \'moduleA\';';
  const expected = {
    foo: { property: 'foo', source: 'moduleA' }
  };

  assert.deepEqual(moduleAnalyser.getModuleDependencies({
    fileName: '8',
    version: 1
  }, parseTest(input, { module: true })), expected);
});

test('should return object with an esm module and renamed imports', () => {
  const input = 'import { foo as bar } from \'moduleA\';';
  const expected = {
    bar: { property: 'foo', source: 'moduleA' }
  };

  assert.deepEqual(moduleAnalyser.getModuleDependencies({
    fileName: '9',
    version: 1
  }, parseTest(input, { module: true })), expected);
});
