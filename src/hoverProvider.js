const { Hover } = require('vscode');
const ModuleResolver = require('./moduleResolver');
const modulePath = require('./modulePath');
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost');

class HoverProvider {
	/**
		 * Initializes a new instance.
		 * @param {ModuleResolver} moduleResolver Module to file path resolution helper.
		 */
	constructor (moduleResolver) {
		hostOrCreateDisposable(this, 'moduleResolver', ModuleResolver, moduleResolver);
	}

	/**
		 * Provide the list of completion file items for the folder path entered by the user.
		 * @param {TextDocument} document The document in which the command was invoked.
		 * @param {Position} position The position at which the command was invoked.
		 * @param {CancellationToken} cancellationToken A cancellation token.
		 * @returns {Promise} Resolves with an array of file completion items.
		 */
	provideHover (document, position /* cancellationToken */) {
		const currentLine = document.getText(document.lineAt(position).range);
		const currentCharacter = position.character;

		if (!modulePath.isInsideModulePath(currentLine, currentCharacter)) {
			return undefined;
		}

		const filePath = this.getFilePath(document.fileName, currentLine, currentCharacter);

		return new Hover(filePath);
	}

	/**
		 * Builds the resolved module path based on the current file.
		 * and the path from the current line.
		 * @param {String} currentFilePath The file-system path to the currently opened file.
		 * @param {Number} currentLine The current line of the cursor.
		 * @param {Number} currentPosition The current position of the cursor.
		 * @returns {String} The resolved module path.
		 */
	getFilePath (currentFilePath, currentLine, currentPosition) {
		const userPath = modulePath.getSurroundingModulePath(currentLine, currentPosition);

		return this.moduleResolver.resolveModulePath(userPath, currentFilePath);
	}

	/**
		 * Disposes of disposable child objects.
		 * @returns {Void} Nothing.
		 */
	dispose () {
		disposeAll(this);
	}
}

module.exports = HoverProvider;
