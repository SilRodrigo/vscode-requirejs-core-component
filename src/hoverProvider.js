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
		 * Provide the resolved path of the module name, which the mouse hovers above.
		 * @param {TextDocument} document The document in which the command was invoked.
		 * @param {Position} position The position at which the command was invoked.
		 * @param {CancellationToken} cancellationToken A cancellation token.
		 * @returns {Promise} Resolves with the hover content or `undefined`.
		 */
	provideHover (document, position /* cancellationToken */) {
		const currentLine = document.getText(document.lineAt(position).range);
		const currentCharacter = position.character;

		if (!modulePath.isInsideString(currentLine, currentCharacter)) {
			return undefined;
		}

		const filePath = this.getFocusedFilePath(document.fileName, currentLine, currentCharacter);

		return filePath ? new Hover(filePath) : undefined;
	}

	/**
		 * Builds a file-system path based on the focused string content interpreted as a module path.
		 * and the path from the current line.
		 * @param {String} currentFilePath The file-system path to the currently opened file.
		 * @param {Number} currentLine The current line of the cursor.
		 * @param {Number} currentPosition The current position of the cursor.
		 * @returns {String} The file-system path or `undefined`, if the string cannot be interpreted as a module path.
		 */
	getFocusedFilePath (currentFilePath, currentLine, currentPosition) {
		const userPath = modulePath.getSurroundingModulePath(currentLine, currentPosition);

		return modulePath.startsLikeModulePath(userPath)
			&& this.moduleResolver.resolveModulePath(userPath, currentFilePath);
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
