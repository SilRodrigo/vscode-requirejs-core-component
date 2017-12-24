const sinon = require('sinon');
const proxyquire = require('proxyquire');
const assert = require('assert');
const registerDefinitionProviderStub = sinon.stub();
const vscodeStub = { languages: { registerDefinitionProvider: registerDefinitionProviderStub } };
const extension = proxyquire('../extension', { vscode: vscodeStub });

suite('extension', () => {
	test('should export activate method', () => {
		assert.ok('activate' in extension);
	});

	test('activate should register definition provider', () => {
		const context = { subscriptions: [] };

		extension.activate(context);

		// Reinitializing RequireJS on configuration change,
		// registering the RequireJS definition provider
		// and adding the "Go To Definition Module" command
		assert.equal(context.subscriptions.length, 3);
		assert.deepEqual(
			registerDefinitionProviderStub.getCall(0).args,
			[
				'javascript',
				new extension.ReferenceProvider()
			]
		);
	});
});
