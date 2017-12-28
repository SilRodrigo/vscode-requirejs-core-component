const { CompletionItem, CompletionItemKind, workspace } = require('vscode');
const CompletionItemFileKind = CompletionItemKind.File;
const ModuleResolver = require('./moduleResolver');
const FolderCrawler = require('./folderCrawler');
const modulePath = require('./modulePath');
const { basename, extname } = require('path');
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost');

/**
	 * Creates completion items for file-system nodes.
	 * @param {Array} items Information about file-system items: {name, path, stats}.
	 * @returns {Array} Completion items for the file-system nodes.
	 */
function createCompletionItems (items) {
	const cutExtensions = workspace
		.getConfiguration('requireModuleSupport')
		.get('cutFileCompletionExtensions');
	const result = items.map(file => {
		const name = file.name;
		const completion = new CompletionItem(name);

		// Show folders before files.
		if (file.directory) {
			completion.insertText = name;
			completion.label += '/';
			completion.command = {
				command: 'default:type',
				title: 'triggerSuggest',
				arguments: [{ text: '/' }]
			};
			completion.sortText = 'd';
		} else {
			// Remove the extension of files, if needed.
			if (cutExtensions.some(extension => name.endsWith(extension))) {
				completion.insertText = basename(name, extname(name));
			} else {
				completion.insertText = name;
			}
			completion.sortText = 'f';
		}
		completion.kind = CompletionItemFileKind;

		return completion;
	});

	// Add the parent directory to the completion list.
	result.unshift(new CompletionItem('..'));

	return Promise.resolve(result);
}

class CompletionItemProvider {
	/**
		 * Initializes a new instance.
		 * @param {ModuleResolver} moduleResolver Module to file path resolution helper.
		 * @param {FolderCrawler} folderCrawler Folder checker and enumerator.
		 */
	constructor (moduleResolver, folderCrawler) {
		hostOrCreateDisposable(this, 'moduleResolver', ModuleResolver, moduleResolver);
		hostOrCreateDisposable(this, 'folderCrawler', FolderCrawler, folderCrawler);
	}

	/**
		 * Provide the list of completion file items for the folder path entered by the user.
		 * @param {TextDocument} document The document in which the command was invoked.
		 * @param {Position} position The position at which the command was invoked.
		 * @param {CancellationToken} cancellationToken A cancellation token.
		 * @returns {Promise} Resolves with an array of file completion items.
		 */
	provideCompletionItems (document, position, cancellationToken) {
		const currentLine = document.getText(document.lineAt(position).range);
		const currentCharacter = position.character;

		if (!modulePath.isInsideString(currentLine, currentCharacter)) {
			return Promise.resolve([]);
		}

		const folderPath = this.getFocusedFolderPath(document.fileName, currentLine, currentCharacter);

		if (!folderPath) {
			return Promise.resolve([]);
		}

		const statusNotifier = this.folderCrawler.statusNotifier;

		statusNotifier.show();

		return this.folderCrawler.checkDirectory(folderPath)
			.then(() => {
				return this.folderCrawler.listFolderChildren(folderPath, cancellationToken)
					.then(items => this.folderCrawler.inspectFileItems(items, cancellationToken))
					.then(items => createCompletionItems(items));
			}, () => [])
			.then(items => {
				statusNotifier.notify('check', items.length + ' items found.',
					'File and directory inspection finished. ' + items.length + ' completion items found.');
				statusNotifier.hide();

				return items;
			}, error => {
				statusNotifier.notify('alert', 'Items unavailable.',
					'File and directory inspection failed: ' + error.message);
				statusNotifier.hide();
				throw error;
			});
	}

	/**
		 * Builds a file-system path based on the focused string content content interpreted as a module path.
		 * @param {String} currentFilePath The file-system path to the currently opened file.
		 * @param {Number} currentLine The current line of the cursor.
		 * @param {Number} currentPosition The current position of the cursor.
		 * @returns {String} The file-system path or `undefined`, if the string cannot be interpreted as a module path.
		 */
	getFocusedFolderPath (currentFilePath, currentLine, currentPosition) {
		let userPath = modulePath.getModulePathUpToPosition(currentLine, currentPosition);
		const pluginSeparator = userPath.indexOf('!');

		// Do not let the plugin add the plugin-specific file extension.
		if (pluginSeparator > 0) {
			userPath = userPath.substr(pluginSeparator + 1);
		}
		if (!modulePath.startsLikeModulePath(userPath)) {
			return undefined;
		}

		const filePath = this.moduleResolver.resolveModulePath(userPath, currentFilePath);

		// Without a plugin, every resolved path is handled as a JavaScript
		// module and gets the extension ".js" appended.
		return filePath.substr(0, filePath.length - 3);
	}

	/**
		 * Disposes of disposable child objects.
		 * @returns {Void} Nothing.
		 */
	dispose () {
		disposeAll(this);
	}
}

module.exports = CompletionItemProvider;
