const vscode = require('vscode');
const moduleResolver = require('./src/moduleResolver');
const DefinitionProvider = require('./src/definitionProvider');
const goToDefinitionModule = require('./src/goToDefinitionModule');

module.exports = {
	activate (context) {
		const definitionProvider = new DefinitionProvider();

		moduleResolver.initializeRequireJs();
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(() => {
				moduleResolver.initializeRequireJs();
				definitionProvider.moduleAnalyser.clearObjectCaches();
			}));
		context.subscriptions.push(
			vscode.languages.registerDefinitionProvider(
				'javascript', definitionProvider));
		context.subscriptions.push(
			vscode.commands.registerTextEditorCommand('requireModuleSupport.goToDefinitionModule',
				goToDefinitionModule.bind(null, definitionProvider)));
	}
};
