const test = require('tehanu')(__filename)
const assert = require('assert')
const { readdirSync } = require('fs')
const { join, parse } = require('path')
const { workspace, Location, Position } = require('vscode')
const rootPath = workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath
  || process.env.VSCODE_REQUIREJS_WORKSPACE
const DefinitionProvider = require('../src/definitionProvider')
const definitionProvider = new DefinitionProvider()

const globalRequire = require
const suites = readdirSync(join(rootPath, '../test/provideDefinition'))
  .map(file => {
    const suite = parse(file)
    const name = suite.name
    const sourceFile = name + '.js'
    const specs = globalRequire('./provideDefinition/' + name + '.json')

    return {
      sourceFile: sourceFile,
      specs: specs.map(spec => {
        spec.source.file = sourceFile

        return spec
      })
    }
  })

function openDocumentAtLocation (location) {
  return workspace.openTextDocument(location.uri)
}

function provideDefinitionAtPosition (document, position) {
  return definitionProvider.provideDefinition(document,
    new Position(position.line, position.character))
}

function checkDefinitionAtLocation (expectedLocation, actualLocation) {
  if (expectedLocation === null) {
    return assert.equal(actualLocation, null)
  }
  assert.ok(typeof actualLocation === 'object', 'location')

  const actualUri = actualLocation.uri
  const expectedFile = join(rootPath, expectedLocation.file)

  assert.ok(typeof actualUri === 'object', 'URL')
  assert.equal(actualUri.fsPath, expectedFile, 'file path')

  const actualRange = actualLocation.range

  assert.ok(typeof actualRange === 'object', 'selection')

  const actualStart = actualRange.start
  const actualEnd = actualRange.end
  const expectedRange = expectedLocation.range
  const expectedStart = expectedRange.start
  const expectedEnd = expectedRange.end

  assert.ok(typeof actualStart === 'object', 'selection start')
  assert.ok(typeof actualEnd === 'object', 'selection end')
  assert.equal(actualStart.line, expectedStart.line, 'first selected line')
  assert.equal(actualStart.character, expectedStart.character, 'first selected character')
  assert.equal(actualEnd.line, expectedEnd.line, 'last selected line')
  assert.equal(actualEnd.character, expectedEnd.character, 'last selected character')
}

function createSpec (suite, spec) {
  test(`${suite.sourceFile.substr(0, suite.sourceFile.length - 3)}: ${spec.name}`, () => {
    const source = spec.source

    return openDocumentAtLocation(new Location(join(rootPath, source.file)))
      .then(document => provideDefinitionAtPosition(document, source.position))
      .then(location => checkDefinitionAtLocation(spec.target, location))
  })
}

function createSuite (singleSuite) {
  singleSuite.specs.forEach(createSpec.bind(null, singleSuite))
}

let singleSpec
const singleSuite = suites.find(suite => {
  singleSpec = suite.specs.find(spec => spec.single)

  return singleSpec
})

if (singleSuite) {
  singleSuite.specs = [singleSpec]
  createSuite(singleSuite)
} else {
  suites.forEach(createSuite)
}
