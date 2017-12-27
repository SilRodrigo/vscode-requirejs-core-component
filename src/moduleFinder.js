const vscode = require('vscode');
const workspace = vscode.workspace;
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

	configure () {
		this.batchSize = workspace
			.getConfiguration('requireModuleSupport')
			.get('moduleProcessingBatchSize');
	}

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

	openModuleDocuments (urls, cancellationToken, documents) {
		const outputDocuments = documents || [];

		this.statusNotifier.notify('unfold', 'Opening ' + urls.length + '...',
			'Opening documents... (remaining ' + urls.length + ')');

		return Promise.all(urls.splice(0, this.batchSize).map(url => workspace.openTextDocument(url)))
			.then(batch => {
				push.apply(outputDocuments, batch);
				if (!urls.length || cancellationToken.isCancellationRequested) {
					return documents;
				}

				return this.openModuleDocuments(urls, cancellationToken, outputDocuments);
			});
	}

	dispose () {
		disposeAll(this);
	}
}

module.exports = ModuleFinder;
