const { normalize } = require('path');
const rootPath = __dirname.replace('test', '').replace(/\\/g, '/');
const assert = require('assert');
const { DefinitionProvider } = require('../extension');
const definitionProvider = new DefinitionProvider();

suite('searchModule', () => {
	test('should resolve with path for moduleA.js', () => {
		return definitionProvider.searchModule('../testFiles/test1.js', './moduleA', '')
			.then(result => {
				assert.equal(normalize(result.uri._fsPath), normalize(`/${rootPath}testFiles/moduleA.js`));
			});
	});

	test('should find method foo in moduleA.js', () => {
		return definitionProvider.searchModule('../testFiles/test3.js', './moduleA', 'foo')
			.then(result => {
				assert.equal(normalize(result.uri.path), normalize(`/${rootPath}testFiles/moduleA.js`));
				assert.equal(result.range._start._line, 2);
				assert.equal(result.range._start._character, 8);
			});
	});
});
