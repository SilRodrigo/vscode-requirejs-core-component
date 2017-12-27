const vscode = require('vscode');
const workspace = vscode.workspace;
const codeParser = require('./codeParser');
const ModuleResolver = require('./moduleResolver');
const ModuleAnalyser = require('./moduleAnalyser');
const ModuleFinder = require('./moduleFinder');
const StatusNotifier = require('./statusNotifier');
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost');
const push = Array.prototype.push;

class ReferenceProvider {
	/**
		 * Initializes a new instance.
		 * @param {ModuleResolver} moduleResolver Module to file path resolution helper.
		 * @param {ModuleFinder} moduleFinder Module lookup and opening helper.
		 * @param {ModuleAnalyser} moduleAnalyser Caching module analysis helper.
		 * @param {StatusNotifier} statusNotifier Status bar notification helper.
		 */
	constructor (moduleResolver, moduleFinder, moduleAnalyser, statusNotifier) {
		hostOrCreateDisposable(this, 'moduleResolver', ModuleResolver, moduleResolver);
		hostOrCreateDisposable(this, 'moduleFinder', ModuleFinder, moduleFinder);
		hostOrCreateDisposable(this, 'moduleAnalyser', ModuleAnalyser, moduleAnalyser);
		hostOrCreateDisposable(this, 'statusNotifier', StatusNotifier, statusNotifier);
	}

	/**
		 * Diverges the search to the given module
		 * @param {Object} originatingModule Information about the originating module of the identifier to look up.
		 * - {String} modulePath RequireJS path of the target module.
		 * - {String} filePath Full file-system path of the target module.
		 * - {String} identifier The identifier to search for inside the module.
		 * - {Boolean} isExport If the search is for a module export or for a member of the module export.
		 * @param {Array} documents All JavaScript modules in this project.
		 * @param {CancellationToken} cancellationToken A cancellation token.
		 * @param {Array} references Output parameter for gathering module references.
		 * @returns {Promise} Resolves with all usage references of the selected identifier.
		 */
	getModuleReferences (originatingModule, documents, cancellationToken, references) {
		const { modulePath, filePath, identifier, isExport } = originatingModule;
		const moduleAnalyser = this.moduleAnalyser;
		const outputReferences = references || [];

		function convertRanges (ranges) {
			const positions = ranges.map(range => {
				const start = range.start;
				const end = range.end;

				return new vscode.Range(
					// vscode.Range is zero-based, esprima is one-based
					new vscode.Position(start.line - 1, start.column),
					new vscode.Position(end.line - 1, end.column)
				);
			});

			if (!positions.length) {
				positions.push(new vscode.Position(0, 0));
			}

			return positions;
		}

		function getOriginatingModuleReferences (document) {
			const astRoot = moduleAnalyser.getParsedModule(document);

			return codeParser.findAllIdentifiers(astRoot, identifier);
		}

		function getDependentModuleReferences (document) {
			const astRoot = moduleAnalyser.getParsedModule(document);
			const moduleDependencies = moduleAnalyser.getModuleDependencies(document, astRoot) || {};
			let ranges;

			Object.keys(moduleDependencies).some(formalParameter => {
				if (modulePath === moduleDependencies[formalParameter]) {
					ranges = codeParser.findAllIdentifiers(astRoot, identifier);

					if (!ranges.length) {
						if (isExport) {
							ranges.push(codeParser.findIdentifier(astRoot, formalParameter));
						} else {
							ranges = undefined;
						}
					}

					return true;
				}

				return false;
			});

			return ranges;
		}

		this.statusNotifier.notify('search', 'Analysing ' + documents.length + '...',
			'Analysing documents... (remaining ' + documents.length + ')');
		documents.splice(0, this.batchSize).forEach(document => {
			const getModuleReferences = filePath === document.fileName
				? getOriginatingModuleReferences
				: getDependentModuleReferences;
			const ranges = getModuleReferences(document);

			if (ranges) {
				push.apply(outputReferences,
					convertRanges(ranges).map(position =>
						new vscode.Location(document.uri, position)));
			}
		});
		if (!documents.length || cancellationToken.isCancellationRequested) {
			return Promise.resolve(outputReferences);
		}

		return new Promise((resolve, reject) => {
			setImmediate(() => {
				this.getModuleReferences(originatingModule, documents,
					cancellationToken, outputReferences)
					.then(resolve)
					.catch(reject);
			});
		});
	}

	/**
		 * Provide a set of project-wide references for the given position and document.
		 * @param {TextDocument} document The document in which the command was invoked.
		 * @param {Position} position The position at which the command was invoked.
		 * @param {Object} options Contextual command options.
		 * @param {CancellationToken} cancellationToken A cancellation token.
		 * @returns {Promise} Resolves with a file location.
		 */
	provideReferences (document, position, options, cancellationToken) {
		const moduleDependency = this.moduleAnalyser.getOriginatingModuleDependency(document, position);

		if (moduleDependency) {
			const modulePath = moduleDependency.modulePath;

			if (modulePath) {
				this.statusNotifier.show();

				return this.moduleFinder.findModulePaths(cancellationToken)
					.then(urls => {
						if (cancellationToken.isCancellationRequested) {
							return [document];
						}

						return this.moduleFinder.openModuleDocuments(urls, cancellationToken);
					})
					.then(documents => {
						const filePath = this.moduleResolver.resolveModulePath(modulePath, document.fileName);
						const selected = moduleDependency.selected;

						this.batchSize = workspace
							.getConfiguration('requireModuleSupport')
							.get('moduleProcessingBatchSize');

						return this.getModuleReferences({
							modulePath: modulePath,
							filePath: filePath,
							identifier: selected,
							isExport: selected === moduleDependency.imported
						}, documents, cancellationToken);
					})
					.then(references => {
						this.statusNotifier.notify('check', references.length + ' refs found.',
							'Document analysis finished. ' + references.length + ' references found.');
						this.statusNotifier.hide();

						return references;
					}, error => {
						this.statusNotifier.notify('alert', 'Refs unavailable.',
							'Document analysis failed: ' + error.message);
						this.statusNotifier.hide();
						throw error;
					});
			}
		}

		this.statusNotifier.show();
		this.statusNotifier.notify('stop', 'No module.',
			'No originating module found.');
		this.statusNotifier.hide();

		return Promise.resolve(undefined);
	}

	dispose () {
		disposeAll(this);
	}
}

module.exports = ReferenceProvider;
