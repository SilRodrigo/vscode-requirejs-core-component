const vscode = require('vscode');
const StatusNotifier = require('./src/statusNotifier');
const ModuleResolver = require('./src/moduleResolver');
const ModuleFinder = require('./src/moduleFinder');
const ModuleAnalyser = require('./src/moduleAnalyser');
const DefinitionProvider = require('./src/definitionProvider');
const ReferenceProvider = require('./src/referenceProvider');
const goToDefinitionModule = require('./src/goToDefinitionModule');

module.exports = {
	activate (context) {
		const subscriptions = context.subscriptions;
		const statusNotifier = new StatusNotifier();
		const moduleResolver = new ModuleResolver();
		const moduleFinder = new ModuleFinder(statusNotifier);
		const moduleAnalyser = new ModuleAnalyser();
		const definitionProvider = new DefinitionProvider(moduleResolver, moduleAnalyser);
		const referenceProvider = new ReferenceProvider(moduleResolver, moduleFinder, moduleAnalyser, statusNotifier);

		subscriptions.push(
			statusNotifier, moduleResolver, moduleFinder,
			moduleAnalyser, definitionProvider, referenceProvider,
			vscode.languages.registerDefinitionProvider(
				'javascript', definitionProvider),
			vscode.languages.registerReferenceProvider(
				'javascript', referenceProvider),
			vscode.commands.registerTextEditorCommand(
				'requireModuleSupport.goToDefinitionModule',
				goToDefinitionModule.bind(null, definitionProvider)));
	}
};
