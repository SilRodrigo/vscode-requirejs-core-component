const { workspace } = require('vscode');
const StatusNotifier = require('./statusNotifier');
const { addDisposable, hostOrCreateDisposable, disposeAll } = require('./disposableHost');
const push = Array.prototype.push;

class ModuleFinder {
	/**
		 * Initializes a new instance.
		 * @param {StatusNotifier} statusNotifier Status bar notification helper.
		 */
	constructor (statusNotifier) {
		this.configure();
		addDisposable(workspace.onDidChangeConfiguration(() => this.configure()));
		hostOrCreateDisposable(this, 'statusNotifier', StatusNotifier, statusNotifier);
	}

	/**
		 * Refreshes the configuration.
		 * @returns {void} Nothing.
		 */
	configure () {
		this.batchSize = workspace
			.getConfiguration('requireModuleSupport')
			.get('moduleProcessingBatchSize');
	}

	/**
		 * Lists all JavaScript modules in the project.
		 * @param {CancellationToken} cancellationToken A cancellation token.
		 * @returns {Promise} Resolves with an array of file paths to the JavaScript modules.
		 */
	findModulePaths (cancellationToken) {
		const includeModulePattern = workspace
			.getConfiguration('requireModuleSupport')
			.get('includeModulePattern');
		const excludeModulePattern = workspace
			.getConfiguration('requireModuleSupport')
			.get('findReferences.excludeModulePattern');

		this.statusNotifier.notify('telescope', 'Globbing...',
			'Looking up all modules...');

		return workspace.findFiles(includeModulePattern, excludeModulePattern,
			undefined, cancellationToken);
	}

	/**
		 * Creates `TextDocument` instances for the specified files.
		 * @param {Array} urls File paths to open as documents.
		 * @param {CancellationToken} cancellationToken A cancellation token.
		 * @param {Array} documents Output parameter for gathering documents.
		 * @returns {Promise} Resolves with an array of opened documents.
		 */
	openModuleDocuments (urls, cancellationToken, documents) {
		const outputDocuments = documents || [];

		this.statusNotifier.notify('unfold', 'Opening ' + urls.length + '...',
			'Opening documents... (remaining ' + urls.length + ')');

		// Limit the number of files being opened concurrently. When working
		// by batches, the operation will be stoppable after every batch.
		return Promise.all(urls.splice(0, this.batchSize).map(url => workspace.openTextDocument(url)))
			.then(batch => {
				push.apply(outputDocuments, batch);

				// Stop processing if this was the last batch or the operation has been cancelled.
				if (!urls.length || cancellationToken.isCancellationRequested) {
					return documents;
				}

				// Process the rest of items after cutting off the batch above.
				return this.openModuleDocuments(urls, cancellationToken, outputDocuments);
			});
	}

	/**
		 * Disposes of disposable child objects.
		 * @returns {Void} Nothing.
		 */
	dispose () {
		disposeAll(this);
	}
}

module.exports = ModuleFinder;
