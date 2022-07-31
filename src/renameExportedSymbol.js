/**
 * Supplies the "Rename Exported Symbol" editor command.
 * @module renameExportedSymbol
 */
const { commands, workspace, window, CancellationTokenSource } = require('vscode')

/**
 * Implements the "Rename Exported Symbol" editor command.
 * @param {RenameProvider} renameProvider An instance of this definition provider
 * @param {TextEditor} editor The current editor
 * @returns {Promise} Command finish
 */
module.exports = function renameExportedSymbol (renameProvider, editor) {
  // Default to "Go to Definition" for non-JavaScript files.
  const { languageId } = editor.document
  if (languageId !== 'javascript' && languageId !== 'javascriptreact') {
    return commands.executeCommand('editor.action.rename')
  }

  const document = editor.document
  const position = editor.selection.active
  const range = document.getWordRangeAtPosition(position)
  const oldName = document.getText(range)
  let newName
  const cancellationTokenSource = new CancellationTokenSource()
  const cancellationToken = cancellationTokenSource.token

  return window.showInputBox({
    prompt: 'Enter the new name.',
    value: oldName,
    valueSelection: [0, oldName.length]
  })
    .then(value => {
      newName = value

      return newName && renameProvider.provideRenameEdits(document,
        position, newName, cancellationToken)
    })
    .then(edit => {
      // Prefer opening the found module right away to showing the peek view
      // for multiple symbol occurrences. There are always multiple of them
      // the first one is the formal parameter for the dependent module
      // and the second one is the identifier in the originating module.
      if (edit) {
        return workspace.applyEdit(edit)
      }

      // Default to "Rename Symbol", if this provider did not find anything.
      return newName && commands.executeCommand('vscode.executeDocumentRenameProvider',
        document.uri, position, newName, cancellationToken)
        .then(defaultEdit => {
          if (!defaultEdit) {
            return false
          }

          return workspace.applyEdit(defaultEdit)
        })
    })
    .then(() => cancellationTokenSource.dispose(),
      () => cancellationTokenSource.dispose())
}
