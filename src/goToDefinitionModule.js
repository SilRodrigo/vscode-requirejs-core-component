const { workspace, window, commands, Selection } = require('vscode');

/**
	 * Opens the specified document in an editor window and selects
	 * the specified range of characters there.
	 * @param {Location} location Document URI and selected range
	 * @returns {Promise} Operation finish
	 */
function openDocumentAtLocation (location) {
	return workspace.openTextDocument(location.uri)
		.then(window.showTextDocument)
		.then(editor => {
			const range = location.range;

			editor.selection = new Selection(range.end, range.start);
			editor.revealRange(range);
		});
}

/**
	 * Implements the "Go to Definition Module" editor command.
	 * @param {ReferenceProvider} referenceProvider An instance of this definition provider
	 * @param {TextEditor} editor The current editor
	 * @returns {Promise} Command finish
	 */
function goToDefinitionModule (referenceProvider, editor) {
	// Default to "Go to Definition" for non-JavaScript files.
	if (editor.document.languageId !== 'javascript') {
		return commands.executeCommand('editor.action.goToDeclaration');
	}

	return referenceProvider.provideDefinition(editor.document, editor.selection.active)
		.then(location => {
			// Prefer opening the found module right away to showing the peek view
			// for multiple symbol occurrences. There are always multiple of them;
			// the first one is the formal parameter for the dependent module
			// and the second one is the identifier in the originating module.
			if (location && !Array.isArray(location)) {
				return openDocumentAtLocation(location);
			}

			// Default to "Go to Definition", if this provider did not find anything.
			return commands.executeCommand('editor.action.goToDeclaration');
		});
}

module.exports = goToDefinitionModule;
