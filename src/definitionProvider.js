const vscode = require('vscode');
const workspace = vscode.workspace;
const codeParser = require('./codeParser');
const ModuleResolver = require('./moduleResolver');
const ModuleAnalyser = require('./moduleAnalyser');
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost');

class DefinitionProvider {
	/**
		 * Initializes a new instance.
		 * @param {ModuleResolver} moduleResolver Module to file path resolution helper.
		 * @param {ModuleAnalyser} moduleAnalyser Caching module analysis helper.
		 */
	constructor (moduleResolver, moduleAnalyser) {
		hostOrCreateDisposable(this, 'moduleResolver', ModuleResolver, moduleResolver);
		hostOrCreateDisposable(this, 'moduleAnalyser', ModuleAnalyser, moduleAnalyser);
	}

	/**
		 * Diverges the search to the given module
		 * @param {String} currentFilePath Current file path to start search from
		 * @param {String} modulePath Require path of the target module
		 * @param {String} searchFor The identifier to search for inside the module
		 * @returns {Promise} Resolves with a file location
		 */
	searchModule (currentFilePath, modulePath, searchFor) {
		const filePath = this.moduleResolver.resolveModulePath(modulePath, currentFilePath);
		const newUri = vscode.Uri.file(filePath);
		const newDocument = workspace.openTextDocument(newUri);

		return newDocument.then(document => {
			const onlyNavigateToFile = workspace
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

	/**
		 * Provide the definition of the symbol at the given position and document.
		 * @param {TextDocument} document The document in which the command was invoked.
		 * @param {Position} position The position at which the command was invoked.
		 * @returns {Promise} Resolves with a file location.
		 */
	provideDefinition (document, position) {
		const moduleDependency = this.moduleAnalyser.getOriginatingModuleDependency(document, position);

		if (moduleDependency) {
			const modulePath = moduleDependency.modulePath;

			if (modulePath) {
				return this.searchModule(document.fileName, modulePath, moduleDependency.selected);
			}
		}

		return Promise.resolve(undefined);
	}

	dispose () {
		disposeAll(this);
	}
}

module.exports = DefinitionProvider;
