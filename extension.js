const vscode = require('vscode');
const StatusNotifier = require('./src/statusNotifier');
const ModuleResolver = require('./src/moduleResolver');
const ModuleFinder = require('./src/moduleFinder');
const ModuleAnalyser = require('./src/moduleAnalyser');
const FolderCrawler = require('./src/folderCrawler');
const DefinitionProvider = require('./src/definitionProvider');
const ReferenceProvider = require('./src/referenceProvider');
const CompletionItemProvider = require('./src/completionItemProvider');
const goToDefinitionModule = require('./src/goToDefinitionModule');

module.exports = {
	activate (context) {
		const subscriptions = context.subscriptions;
		const statusNotifier = new StatusNotifier();
		const moduleResolver = new ModuleResolver();
		const moduleFinder = new ModuleFinder(statusNotifier);
		const moduleAnalyser = new ModuleAnalyser();
		const folderCrawler = new FolderCrawler(statusNotifier);
		const definitionProvider = new DefinitionProvider(moduleResolver, moduleAnalyser);
		const referenceProvider = new ReferenceProvider(moduleResolver, moduleFinder, moduleAnalyser, statusNotifier);
		const completionItemProvider = new CompletionItemProvider(moduleResolver, folderCrawler);

		subscriptions.push(
			statusNotifier, moduleResolver, moduleFinder, moduleAnalyser,
			folderCrawler, definitionProvider, referenceProvider, completionItemProvider,
			vscode.languages.registerDefinitionProvider(
				'javascript', definitionProvider),
			vscode.languages.registerReferenceProvider(
				'javascript', referenceProvider),
			vscode.languages.registerCompletionItemProvider(
				['javascript'], completionItemProvider, ['/']),
			vscode.commands.registerTextEditorCommand(
				'requireModuleSupport.goToDefinitionModule',
				goToDefinitionModule.bind(null, definitionProvider)));
	}
};
