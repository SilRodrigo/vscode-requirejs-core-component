const { workspace, Location, Range, Position } = require('vscode');
const { findAllIdentifiers, findIdentifier } = require('./codeParser');
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
		 * Finds modules, which use the same identifier.
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
	findModuleReferences (originatingModule, documents, cancellationToken, references) {
		const { modulePath, filePath, identifier, isExport } = originatingModule;
		const moduleAnalyser = this.moduleAnalyser;
		const outputReferences = references || [];

		// Convert ESTree text range object to Range instances.
		function convertRanges (ranges) {
			const positions = ranges.map(range => {
				const start = range.start;
				const end = range.end;

				return new Range(
					// Range is zero-based, esprima is one-based
					new Position(start.line - 1, start.column),
					new Position(end.line - 1, end.column)
				);
			});

			// If the identifier was not found, but the current module depends
			// on the originating module, open it too and put the cursor to the
			// first line and character.
			if (!positions.length) {
				positions.push(new Position(0, 0));
			}

			return positions;
		}

		// For the originating module, return all occurrences of the identifier.
		function getOriginatingModuleReferences (document) {
			const astRoot = moduleAnalyser.getParsedModule(document);

			return findAllIdentifiers(astRoot, identifier);
		}

		// For other than originating modules, check, if they depend on the
		// originating module and if they do, find all occurrences of the
		// identifier there.
		function getDependentModuleReferences (document) {
			const astRoot = moduleAnalyser.getParsedModule(document);
			const moduleDependencies = moduleAnalyser.getModuleDependencies(document, astRoot) || {};
			let ranges;

			// Find the dependency on the originating module; the first one is enough.
			// As soon as it is found, find all occurrences of the identifier there.
			Object.keys(moduleDependencies).some(formalParameter => {
				if (modulePath === moduleDependencies[formalParameter]) {
					ranges = findAllIdentifiers(astRoot, identifier);

					// If the identifier was not found, but the current module
					// depends on the originating module, its formal parameter
					// probably uses a different name. If the identifier itself
					// was an export represented by a formal parameter, let us
					// return the other formal parameter as an occurrence of
					// the same export. If not, better not guess what the
					// identifer might mean in the current module.
					if (!ranges.length) {
						if (isExport) {
							ranges.push(findIdentifier(astRoot, formalParameter));
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

		// Limit the number of documents being analysed. When working
		// by batches, the operation will be stoppable after every batch.
		documents.splice(0, this.batchSize).forEach(document => {
			// The currently opened module is the originating module. It does
			// not need the check, if it depends on the originating module.
			const getModuleReferences = filePath === document.fileName
				? getOriginatingModuleReferences
				: getDependentModuleReferences;
			const ranges = getModuleReferences(document);

			if (ranges) {
				push.apply(outputReferences,
					convertRanges(ranges).map(position =>
						new Location(document.uri, position)));
			}
		});

		// Stop processing if this was the last batch or the operation has been cancelled.
		if (!documents.length || cancellationToken.isCancellationRequested) {
			return Promise.resolve(outputReferences);
		}

		// Process the rest of items after cutting off the batch above.
		// Pump the event loop to allow other components cancel the
		// operation by forcing asynchronous processing.
		return new Promise((resolve, reject) => {
			setImmediate(() => {
				this.findModuleReferences(originatingModule, documents,
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

		// If the selected identifier cannot be tracked to other module,
		// let the built-in reference lookup handle it. Only references
		// connected by their common originating module ought to be trusted.
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

						// Remember the fresh value of the batch of documents to process
						// concurrently; it is used by `getDependentModuleReferences`
						// in `findModuleReferences`.
						this.batchSize = workspace
							.getConfiguration('requireModuleSupport')
							.get('moduleProcessingBatchSize');

						return this.findModuleReferences({
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

	/**
		 * Disposes of disposable child objects.
		 * @returns {Void} Nothing.
		 */
	dispose () {
		disposeAll(this);
	}
}

module.exports = ReferenceProvider;
