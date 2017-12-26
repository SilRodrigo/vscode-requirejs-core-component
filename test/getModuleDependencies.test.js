const assert = require('assert');
const ModuleAnalyser = require('../src/moduleAnalyser');
const moduleAnalyser = new ModuleAnalyser();

suite('getModuleDependencies', () => {
	test('should return object with module path and name', () => {
		const input = 'define([\'./path/to/a\', \'./path/to/b\'], function (moduleA, moduleB) {});';
		const expected = {
			moduleA: './path/to/a',
			moduleB: './path/to/b'
		};

		assert.deepEqual(moduleAnalyser.getModuleDependencies({
			fileName: '1',
			version: 1
		}, input), expected);
	});

	test('should return object with module path and name for multiline define', () => {
		const input = `define([
                'moduleA',
                'moduleB'
            ], function(a, b) {});`;
		const expected = {
			a: 'moduleA',
			b: 'moduleB'
		};

		assert.deepEqual(moduleAnalyser.getModuleDependencies({
			fileName: '2',
			version: 1
		}, input), expected);
	});

	test('should return object with module path and name for multiline define', () => {
		const input = `require([
                'moduleA',
                'moduleB'
            ], function(a, b) {});`;
		const expected = {
			a: 'moduleA',
			b: 'moduleB'
		};

		assert.deepEqual(moduleAnalyser.getModuleDependencies({
			fileName: '3',
			version: 1
		}, input), expected);
	});

	test('should return object with module path and name for named module', () => {
		const input = 'define(\'myName\', [\'moduleA\', \'moduleB\'], function(a, b) {});';
		const expected = {
			a: 'moduleA',
			b: 'moduleB'
		};

		assert.deepEqual(moduleAnalyser.getModuleDependencies({
			fileName: '4',
			version: 1
		}, input), expected);
	});
});
