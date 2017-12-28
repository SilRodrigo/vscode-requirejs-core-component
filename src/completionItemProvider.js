const { CompletionItem, CompletionItemKind, workspace } = require('vscode');
const CompletionItemFileKind = CompletionItemKind.File;
const ModuleResolver = require('./moduleResolver');
const FolderCrawler = require('./folderCrawler');
const { basename, extname } = require('path');
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost');

/**
	 * Determine if we should provide path completion.
	 * @param {Number} currentLine The current line of the cursor.
	 * @param {Number} currentPosition The current position of the cursor.
	 * @returns {Boolean} If there should be completion items provided for the text on the cursor.
	 */
function shouldProvideCompletionItems (currentLine, currentPosition) {
	let singleQuotes = false;
	let doubleQuotes = false;
	let backticks = false;
	let previousChar;

	// check if we are inside quotes
	for (let i = 0; i < currentPosition; ++i) {
		const currentChar = currentLine.charAt(i);

		if (previousChar !== '\\') {
			if (currentChar === '\'') {
				singleQuotes = !singleQuotes;
			} else if (currentChar === '"') {
				doubleQuotes = !doubleQuotes;
			} else if (currentChar === '`') {
				backticks = !backticks;
			}
		}
		previousChar = currentChar;
	}

	return singleQuotes || doubleQuotes || backticks;
}

/**
	 * Retrieves the path inserted by the user. This is taken based
	 * on the last quote or last white space character.
	 * @param {Number} currentLine The current line of the cursor.
	 * @param {Number} currentPosition The current position of the cursor.
	 * @returns {String} The path entered by the user.
	 */
function getPathEnteredByUser (currentLine, currentPosition) {
	let lastQuote = -1;
	let lastWhiteSpace = -1;

	for (let i = 0; i < currentPosition; ++i) {
		const currentChar = currentLine[i];

		if (currentChar === '\\') {
			// skip next character if escaped
			++i;
		} else if (currentChar === ' ' || currentChar === '\t') {
			// handle space
			lastWhiteSpace = i;
		} else if (currentChar === '\'' || currentChar === '"' || currentChar === '`') {
			// handle quotes
			lastQuote = i;
		}
	}

	return currentLine.substring(
		(lastQuote !== -1 ? lastQuote : lastWhiteSpace) + 1, currentPosition);
}

/**
	 * Creates completion items for file-system nodes.
	 * @param {Array} items Information about file-system items: {name, path, stats}.
	 * @returns {Array} Completion items for the file-system nodes.
	 */
function createCompletionItems (items) {
	function endsWith (hay, needle) {
		return hay.lastIndexOf(needle) === hay.length - needle.length;
	}

	const cutExtensions = workspace
		.getConfiguration('requireModuleSupport')
		.get('cutFileCompletionExtensions');
	// build the list of the completion items
	const result = items.map(file => {
		const name = file.name;
		const completion = new CompletionItem(name);

		// show folders before files
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
			// remove the extension of files, if required
			if (cutExtensions.some(extension => endsWith(name, extension))) {
				completion.insertText = basename(name, extname(name));
			} else {
				completion.insertText = name;
			}
			completion.sortText = 'f';
		}
		completion.kind = CompletionItemFileKind;

		return completion;
	});

	// add up one folder item
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

		if (!shouldProvideCompletionItems(currentLine, currentCharacter)) {
			return Promise.resolve([]);
		}

		const folderPath = this.getParentFolderPath(document.fileName, currentLine, currentCharacter);
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
		 * Builds the current folder path based on the current file.
		 * and the path from the current line.
		 * @param {String} currentFilePath The file-system path to the currently opened file.
		 * @param {Number} currentLine The current line of the cursor.
		 * @param {Number} currentPosition The current position of the cursor.
		 * @returns {String} The path to the parent folder of the currently opened file.
		 */
	getParentFolderPath (currentFilePath, currentLine, currentPosition) {
		const userPath = getPathEnteredByUser(currentLine, currentPosition);
		const pluginSeparator = userPath.indexOf('!');
		const modulePath = pluginSeparator > 0 ? userPath.substr(pluginSeparator + 1) : userPath;
		const filePath = this.moduleResolver.resolveModulePath(modulePath, currentFilePath);

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
