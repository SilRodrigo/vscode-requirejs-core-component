const sinon = require('sinon');
const proxyquire = require('proxyquire');
const assert = require('assert');
const StatusNotifier = require('../src/statusNotifier');
const ModuleResolver = require('../src/moduleResolver');
const ModuleFinder = require('../src/moduleFinder');
const ModuleAnalyser = require('../src/moduleAnalyser');
const FolderCrawler = require('../src/folderCrawler');
const DefinitionProvider = require('../src/definitionProvider');
const ReferenceProvider = require('../src/referenceProvider');
const CompletionItemProvider = require('../src/completionItemProvider');
const HoverProvider = require('../src/hoverProvider');
const registerDefinitionProviderStub = sinon.stub();
const registerReferenceProviderStub = sinon.stub();
const registerCompletionItemProviderStub = sinon.stub();
const registerHoverProviderStub = sinon.stub();
const registerTextEditorCommandStub = sinon.stub();
const vscodeStub = {
	languages: {
		registerDefinitionProvider: registerDefinitionProviderStub,
		registerReferenceProvider: registerReferenceProviderStub,
		registerCompletionItemProvider: registerCompletionItemProviderStub,
		registerHoverProvider: registerHoverProviderStub
	},
	commands: { registerTextEditorCommand: registerTextEditorCommandStub }
};
const extension = proxyquire('../extension', { vscode: vscodeStub });

suite('extension', () => {
	test('should export activate method', () => {
		assert.ok('activate' in extension);
	});

	test('activate should register expected objects', () => {
		const subscriptions = [];
		const context = { subscriptions: subscriptions };

		extension.activate(context);

		// Registering the RequireJS definition provider,
		// registering the RequireJS reference provider,
		// registering the RequireJS completion item provider,
		// registering the RequireJS hover provider,
		// adding the "Go To Definition Module" command,
		// reinitializing RequireJS on configuration change and four
		// objects (moduleResolver, moduleAnalyser, folderCrawler,
		// definitionProvider, referenceProvider, completionItemProvider
		// and hoverProvider).
		assert.equal(subscriptions.length, 14);
		assert.ok(subscriptions[0] instanceof StatusNotifier);
		assert.ok(subscriptions[1] instanceof ModuleResolver);
		assert.ok(subscriptions[2] instanceof ModuleFinder);
		assert.ok(subscriptions[3] instanceof ModuleAnalyser);
		assert.ok(subscriptions[4] instanceof FolderCrawler);
		assert.ok(subscriptions[5] instanceof DefinitionProvider);
		assert.ok(subscriptions[6] instanceof ReferenceProvider);
		assert.ok(subscriptions[7] instanceof CompletionItemProvider);
		assert.ok(subscriptions[8] instanceof HoverProvider);

		const definitionProviderArgs = registerDefinitionProviderStub.getCall(0).args;

		assert.ok(Array.isArray(definitionProviderArgs));
		assert.equal(definitionProviderArgs.length, 2);
		assert.equal(definitionProviderArgs[0], 'javascript');
		assert.ok(definitionProviderArgs[1] instanceof DefinitionProvider);

		const referenceProviderArgs = registerReferenceProviderStub.getCall(0).args;

		assert.ok(Array.isArray(referenceProviderArgs));
		assert.equal(referenceProviderArgs.length, 2);
		assert.equal(referenceProviderArgs[0], 'javascript');
		assert.ok(referenceProviderArgs[1] instanceof ReferenceProvider);

		const completionItemProviderArgs = registerCompletionItemProviderStub.getCall(0).args;

		assert.ok(Array.isArray(completionItemProviderArgs));
		assert.equal(completionItemProviderArgs.length, 3);
		assert.deepEqual(completionItemProviderArgs[0], ['javascript']);
		assert.ok(completionItemProviderArgs[1] instanceof CompletionItemProvider);
		assert.deepEqual(completionItemProviderArgs[2], ['/']);

		const hoverProviderArgs = registerHoverProviderStub.getCall(0).args;

		assert.ok(Array.isArray(hoverProviderArgs));
		assert.equal(hoverProviderArgs.length, 2);
		assert.deepEqual(hoverProviderArgs[0], ['javascript']);
		assert.ok(hoverProviderArgs[1] instanceof HoverProvider);

		const goToDefinitionModuleArgs = registerTextEditorCommandStub.getCall(0).args;

		assert.ok(Array.isArray(goToDefinitionModuleArgs));
		assert.equal(goToDefinitionModuleArgs.length, 2);
		assert.equal(goToDefinitionModuleArgs[0], 'requireModuleSupport.goToDefinitionModule');
		assert.equal(typeof goToDefinitionModuleArgs[1], 'function');
		assert.equal(goToDefinitionModuleArgs[1].name, 'bound goToDefinitionModule');
	});
});
