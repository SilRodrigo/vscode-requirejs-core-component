const sinon = require('sinon')
const proxyquire = require('proxyquire')
const test = require('tehanu')(__filename)
const assert = require('assert')
const StatusNotifier = require('../src/statusNotifier')
const ModuleResolver = require('../src/moduleResolver')
const ModuleAnalyser = require('../src/moduleAnalyser')
const FolderCrawler = require('../src/folderCrawler')
const DefinitionProvider = require('../src/definitionProvider')
const ReferenceProvider = require('../src/referenceProvider')
const CompletionItemProvider = require('../src/completionItemProvider')
const HoverProvider = require('../src/hoverProvider')
const RenameProvider = require('../src/renameProvider')
const registerDefinitionProviderStub = sinon.stub()
const registerReferenceProviderStub = sinon.stub()
const registerCompletionItemProviderStub = sinon.stub()
const registerHoverProviderStub = sinon.stub()
const registerRenameProviderStub = sinon.stub()
const registerTextEditorCommandStub = sinon.stub()
const vscodeStub = {
  languages: {
    registerDefinitionProvider: registerDefinitionProviderStub,
    registerReferenceProvider: registerReferenceProviderStub,
    registerCompletionItemProvider: registerCompletionItemProviderStub,
    registerHoverProvider: registerHoverProviderStub,
    registerRenameProvider: registerRenameProviderStub
  },
  commands: {
    registerTextEditorCommand: registerTextEditorCommandStub,
    executeCommand: function () {
      return undefined
    }
  }
}
const extension = proxyquire('../src/extension', { vscode: vscodeStub })

test('should export activate method', () => {
  assert.ok('activate' in extension)
})

test('activate should register expected objects', () => {
  const subscriptions = []
  const context = { subscriptions: subscriptions }
  const language = [
    { scheme: 'file', language: 'javascript' },
    { scheme: 'file', language: 'javascriptreact' }
  ]

  extension.activate(context)

  // Registering the RequireJS definition provider,
  // registering the RequireJS reference provider,
  // registering the RequireJS completion item provider,
  // registering the RequireJS hover provider,
  // adding the "Go To Definition Module" command,
  // adding the "Rename Module Export" command,
  // adding the "Show Applied Mixins" command,
  // tracking active editor/context changes,
  // registering for configuration changes and the following
  // objects (moduleResolver, moduleAnalyser, folderCrawler,
  // definitionProvider, referenceProvider, completionItemProvider,
  // hoverProvider and renameProvider).
  assert.equal(subscriptions.length, 20)
  assert.ok(subscriptions[0] instanceof StatusNotifier)
  assert.ok(subscriptions[1] instanceof ModuleResolver)
  assert.ok(subscriptions[2] instanceof ModuleAnalyser)
  assert.ok(subscriptions[3] instanceof FolderCrawler)
  assert.ok(subscriptions[4] instanceof DefinitionProvider)
  assert.ok(subscriptions[5] instanceof ReferenceProvider)
  assert.ok(subscriptions[6] instanceof CompletionItemProvider)
  assert.ok(subscriptions[7] instanceof HoverProvider)
  assert.ok(subscriptions[8] instanceof RenameProvider)

  const definitionProviderArgs = registerDefinitionProviderStub.getCall(0).args

  assert.ok(Array.isArray(definitionProviderArgs))
  assert.equal(definitionProviderArgs.length, 2)
  assert.deepEqual(definitionProviderArgs[0], language)
  assert.ok(definitionProviderArgs[1] instanceof DefinitionProvider)

  const referenceProviderArgs = registerReferenceProviderStub.getCall(0).args

  assert.ok(Array.isArray(referenceProviderArgs))
  assert.equal(referenceProviderArgs.length, 2)
  assert.deepEqual(referenceProviderArgs[0], language)
  assert.ok(referenceProviderArgs[1] instanceof ReferenceProvider)

  const completionItemProviderArgs = registerCompletionItemProviderStub.getCall(0).args

  assert.ok(Array.isArray(completionItemProviderArgs))
  assert.equal(completionItemProviderArgs.length, 3)
  assert.deepEqual(completionItemProviderArgs[0], language)
  assert.ok(completionItemProviderArgs[1] instanceof CompletionItemProvider)
  assert.deepEqual(completionItemProviderArgs[2], '/')

  const hoverProviderArgs = registerHoverProviderStub.getCall(0).args

  assert.ok(Array.isArray(hoverProviderArgs))
  assert.equal(hoverProviderArgs.length, 2)
  assert.deepEqual(hoverProviderArgs[0], language)
  assert.ok(hoverProviderArgs[1] instanceof HoverProvider)

  const renameProviderArgs = registerRenameProviderStub.getCall(0).args

  assert.ok(Array.isArray(renameProviderArgs))
  assert.equal(renameProviderArgs.length, 2)
  assert.deepEqual(renameProviderArgs[0], language)
  assert.ok(renameProviderArgs[1] instanceof RenameProvider)

  const goToDefinitionModuleArgs = registerTextEditorCommandStub.getCall(0).args

  assert.ok(Array.isArray(goToDefinitionModuleArgs))
  assert.equal(goToDefinitionModuleArgs.length, 2)
  assert.equal(goToDefinitionModuleArgs[0], 'requireModuleSupport.goToDefinitionModule')
  assert.equal(typeof goToDefinitionModuleArgs[1], 'function')
  assert.equal(goToDefinitionModuleArgs[1].name, 'bound goToDefinitionModule')

  const renameExportedSymbolArgs = registerTextEditorCommandStub.getCall(1).args

  assert.ok(Array.isArray(renameExportedSymbolArgs))
  assert.equal(renameExportedSymbolArgs.length, 2)
  assert.equal(renameExportedSymbolArgs[0], 'requireModuleSupport.renameExportedSymbol')
  assert.equal(typeof renameExportedSymbolArgs[1], 'function')
  assert.equal(renameExportedSymbolArgs[1].name, 'bound renameExportedSymbol')

  const showAppliedMixinsArgs = registerTextEditorCommandStub.getCall(2).args

  assert.ok(Array.isArray(showAppliedMixinsArgs))
  assert.equal(showAppliedMixinsArgs.length, 2)
  assert.equal(showAppliedMixinsArgs[0], 'requireModuleSupport.showAppliedMixins')
  assert.equal(typeof showAppliedMixinsArgs[1], 'function')
  assert.equal(showAppliedMixinsArgs[1].name, 'bound showAppliedMixins')
})
