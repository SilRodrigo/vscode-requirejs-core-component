const assert = require('assert');
const fs = require('fs');
const { join, parse } = require('path');
const vscode = require('vscode');
const workspace = vscode.workspace;
const rootPath = workspace.rootPath;
const { initializeRequireJs } = require('../src/moduleResolver');
const { DefinitionProvider } = require('../extension');
const definitionProvider = new DefinitionProvider();

const globalRequire = require;
const suites = fs.readdirSync(join(rootPath, '../test/provideDefinition'))
	.map(file => {
		const suite = parse(file);
		const name = suite.name;
		const sourceFile = name + '.js';
		const specs = globalRequire('./provideDefinition/' + name + '.json');

		return {
			sourceFile: sourceFile,
			specs: specs.map(spec => {
				spec.source.file = sourceFile;

				return spec;
			})
		};
	});

initializeRequireJs();

function openDocumentAtLocation (location) {
	return workspace.openTextDocument(location.uri);
}

function provideDefinitionAtPosition (document, position) {
	return definitionProvider.provideDefinition(document,
		new vscode.Position(position.line, position.character));
}

function checkDefinitionAtLocation (expectedLocation, actualLocation) {
	assert.ok(typeof actualLocation === 'object', 'location');

	const actualUri = actualLocation.uri;
	const expectedFile = join(rootPath, expectedLocation.file);

	assert.ok(typeof actualUri === 'object', 'URL');
	assert.equal(actualUri.fsPath, expectedFile, 'file path');

	const actualRange = actualLocation.range;

	assert.ok(typeof actualRange === 'object', 'selection');

	const actualStart = actualRange.start;
	const actualEnd = actualRange.end;
	const expectedRange = expectedLocation.range;
	const expectedStart = expectedRange.start;
	const expectedEnd = expectedRange.end;

	assert.ok(typeof actualStart === 'object', 'selection start');
	assert.ok(typeof actualEnd === 'object', 'selection end');
	assert.equal(actualStart.line, expectedStart.line, 'first selected line');
	assert.equal(actualStart.character, expectedStart.character, 'first selected character');
	assert.equal(actualEnd.line, expectedEnd.line, 'last selected line');
	assert.equal(actualEnd.character, expectedEnd.character, 'last selected character');
}

function createSpec (spec) {
	test(spec.name, () => {
		const source = spec.source;

		return openDocumentAtLocation(new vscode.Location(join(rootPath, source.file)))
			.then(document => provideDefinitionAtPosition(document, source.position))
			.then(location => checkDefinitionAtLocation(spec.target, location));
	});
}

function createSuite (singleSuite) {
	suite(singleSuite.sourceFile, () => {
		singleSuite.specs.forEach(createSpec);
	});
}

suite('provideDefinition', () => {
	let singleSpec;
	const singleSuite = suites.find(suite => {
		singleSpec = suite.specs.find(spec => spec.single);

		return singleSpec;
	});

	if (singleSuite) {
		singleSuite.specs = [singleSpec];
		createSuite(singleSuite);
	} else {
		suites.forEach(createSuite);
	}
});
