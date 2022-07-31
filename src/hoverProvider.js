const { workspace, Hover } = require('vscode')
const ModuleResolver = require('./moduleResolver')
const {  isInsideString, startsLikeModulePath, getSurroundingModulePath } = require('./modulePath')
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost')

/**
 * Provides the actual path of a module, relative to the workspace root, which
 * path in the module dependency array the mouse cursor hovers above.
 */
class HoverProvider {
  /**
   * Initializes a new instance.
   * @param {ModuleResolver} moduleResolver Module to file path resolution helper.
   */
  constructor (moduleResolver) {
    hostOrCreateDisposable(this, 'moduleResolver', ModuleResolver, moduleResolver)
  }

  /**
   * Provide the resolved path of the module name, which the mouse hovers above.
   * @param {TextDocument} document The document in which the command was invoked.
   * @param {Position} position The position at which the command was invoked.
   * @returns {Promise} Resolves with the hover content or `undefined`.
   */
  provideHover (document, position) {
    const currentLine = document.getText(document.lineAt(position).range)
    const currentCharacter = position.character

    if (isInsideString(currentLine, currentCharacter)) {
      const filePath = this.getFocusedFilePath(document.fileName, currentLine, currentCharacter)

      if (filePath) {
        return new Hover(filePath)
      }
    }

    return undefined
  }

  /**
   * Builds a file-system path based on the focused string content interpreted as a module path.
   * and the path from the current line.
   * @param {string} currentFilePath The file-system path to the currently opened file.
   * @param {number} currentLine The current line of the cursor.
   * @param {number} currentPosition The current position of the cursor.
   * @returns {string} The file-system path or `undefined`, if the string cannot be interpreted as a module path.
   */
  getFocusedFilePath (currentFilePath, currentLine, currentPosition) {
    const userPath = getSurroundingModulePath(currentLine, currentPosition)

    if (!startsLikeModulePath(userPath)) {
      return undefined
    }

    const filePath = this.moduleResolver.resolveModulePath(userPath, currentFilePath)
    return workspace.asRelativePath(filePath, false)
  }

  /**
   * Disposes of disposable child objects.
   * @returns {void} Nothing.
   */
  dispose () {
    disposeAll(this)
  }
}

module.exports = HoverProvider
