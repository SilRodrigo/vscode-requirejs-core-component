const { workspace } = require('vscode');
const { readdir, lstat, stat } = require('fs');
const { join } = require('path');
const StatusNotifier = require('../src/statusNotifier');
const { addDisposable, hostOrCreateDisposable, disposeAll } = require('./disposableHost');
const push = Array.prototype.push;

class FolderCrawler {
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
		 * Reads configuration from vscode settings.
		 * @returns {Void} Nothing.
		 */
	configure () {
		this.batchSize = workspace
			.getConfiguration('requireModuleSupport')
			.get('moduleProcessingBatchSize');
		this.includedExtensions = workspace
			.getConfiguration('requireModuleSupport')
			.get('includeFileCompletionExtensions');
		this.excludedExtensions = workspace
			.getConfiguration('requireModuleSupport')
			.get('excludeFileCompletionExtensions');
	}

	/**
		 * Checks if the path points to an existing folder.
		 * @param {String} folderPath The file-system path to check.
		 * @returns {Promise} Resolves with the directory stats if the path
		 * points to a directory. Rejected with `null` if the path is valid,
		 * but does not point to a directory. If the path is invalid or the
		 * access otherwise fails, the promise will be rejected with the error.
		 */
	checkDirectory (folderPath) {
		return new Promise((resolve, reject) => {
			lstat(folderPath, (error, stats) => {
				if (error || !stats.isDirectory()) {
					reject(error);
				} else {
					resolve(stats);
				}
			});
		});
	}

	/**
		 * Builds a list of the available files and folders from the provided path.
		 * @param {String} folderPath The path to a folder.
		 * @returns {Promise} Resolves with an array of items describing the
		 * folder children: {name, path}.
		 */
	listFolderChildren (folderPath) {
		return new Promise((resolve, reject) => {
			readdir(folderPath, (error, items) => {
				if (error) {
					reject(error);
				} else {
					const children = items.map(name => {
						return {
							name: name,
							path: join(folderPath, name)
						};
					});

					resolve(children);
				}
			});
		});
	}

	/**
		 * Fetches information about files and folders.
		 * @param {Array} items The path to a folder.
		 * @param {CancellationToken} cancellationToken A cancellation token.
		 * @param {Array} resultItems Output parameter for gathering module references.
		 * @returns {Promise} Resolves with an array of items describing the
		 * folder children: {name, path, stats}.
		 */
	inspectFileItems (items, cancellationToken, resultItems) {
		const outputItems = resultItems || [];

		this.statusNotifier.notify('search', 'Inspecting ' + items.length + '...',
			'Inspecting files and directories... (remaining ' + items.length + ')');

		const inspections = items.splice(0, this.batchSize).map(item => {
			return new Promise(resolve => {
				// silently ignore permissions errors
				stat(item.path, (ignoredError, stats) => {
					item.directory = stats && stats.isDirectory();
					resolve(item);
				});
			});
		});

		function endsWith (hay, needle) {
			return hay.lastIndexOf(needle) === hay.length - needle.length;
		}

		return Promise.all(inspections)
			.then(batch => {
				push.apply(outputItems, batch.filter(item => {
					if (item.directory === null) {
						return false;
					}

					const name = item.name;

					return item.directory
						|| ((!this.includedExtensions.length
						|| this.includedExtensions.some(
							extension => endsWith(name, extension)))
						&& !this.excludedExtensions.some(
							extension => endsWith(name, extension)));
				}));
				if (!items.length || cancellationToken.isCancellationRequested) {
					return outputItems;
				}

				return this.inspectFileItems(items, cancellationToken, outputItems);
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

module.exports = FolderCrawler;
