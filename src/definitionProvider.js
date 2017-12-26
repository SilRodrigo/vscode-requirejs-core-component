const vscode = require('vscode');
const codeParser = require('./codeParser');
const ModuleAnalyser = require('./moduleAnalyser');
const moduleResolver = require('./moduleResolver');

class DefinitionProvider {
	/**
		 * Initializes a new instance.
		 */
	constructor () {
		this.moduleAnalyser = new ModuleAnalyser();
	}

	/**
		 * Diverges the search to the given module
		 * @param {String} currentFilePath Current file path to start search from
		 * @param {String} modulePath Require path of the target module
		 * @param {String} searchFor The identifier to search for inside the module
		 * @returns {Promise} Resolves with a file location
		 */
	searchModule (currentFilePath, modulePath, searchFor) {
		const filePath = moduleResolver.resolveModulePath(modulePath, currentFilePath);
		const newUri = vscode.Uri.file(filePath);
		const newDocument = vscode.workspace.openTextDocument(newUri);

		return newDocument.then(document => {
			const onlyNavigateToFile = vscode.workspace
				.getConfiguration('requireModuleSupport')
				.get('onlyNavigateToFile');

			// Some modules are source for RequireJS plugins and need not be written in JavaScript.
			if (!onlyNavigateToFile && searchFor && document.languageId === 'javascript') {
				const astRoot = this.moduleAnalyser.getParsedModule(document);
				const range = codeParser.findIdentifier(astRoot, searchFor);

				if (range) {
					return new vscode.Location(newUri, new vscode.Range(
						// vscode.Range is zero-based, esprima is one-based
						new vscode.Position(range.start.line - 1, range.start.column),
						new vscode.Position(range.end.line - 1, range.end.column)
					));
				}
			}

			return new vscode.Location(newUri, new vscode.Position(0, 0));
		});
	}

	provideDefinition (document, position) {
		const currentFilePath = document.fileName;
		const range = document.getWordRangeAtPosition(position);

		if (range) {
			const astRoot = this.moduleAnalyser.getParsedModule(document);
			const identifier = codeParser.findIdentifierWithinRange(astRoot, range);

			if (identifier) {
				const moduleDependencies = this.moduleAnalyser.getModuleDependencies(document, astRoot);
				const moduleDependency = codeParser.findOriginatingModuleDependency(
					astRoot, identifier, moduleDependencies);
				const modulePath = moduleDependency.modulePath;

				if (modulePath) {
					return this.searchModule(currentFilePath, modulePath, moduleDependency.selected);
				}
			}
		}

		return Promise.resolve(undefined);
	}
}

module.exports = DefinitionProvider;
