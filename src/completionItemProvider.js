const { CompletionItem, CompletionItemKind, workspace } = require('vscode')
const nls = require('vscode-nls')
const ModuleResolver = require('./moduleResolver')
const FolderCrawler = require('./folderCrawler')
const { isInsideString, startsLikeModulePath, getModulePathUpToPosition } = require('./modulePath')
const { basename, extname } = require('path')
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost')

const localize = nls.loadMessageBundle()

/**
 * Creates completion items for file-system nodes.
 * @param {Array} items Information about file-system items: {name, path, stats}.
 * @returns {Array} Completion items for the file-system nodes.
 * @memberof CompletionItemProvider
 */
function createCompletionItems (items) {
  const cutExtensions = workspace
    .getConfiguration('requireModuleSupport')
    .get('cutFileCompletionExtensions')
  const result = items.map(file => {
    const name = file.name
    const completion = new CompletionItem(name)

    if (file.directory) {
      completion.insertText = name
      completion.label += '/'
      // Make the directory completion start another child completion.
      completion.command = {
        command: 'default:type',
        title: 'triggerSuggest',
        arguments: [{ text: '/' }]
      }
      // Show directories before files.
      completion.sortText = 'd'
    } else {
      // Remove the extension of files, if needed.
      if (cutExtensions.some(extension => name.endsWith(extension))) {
        completion.insertText = basename(name, extname(name))
      } else {
        completion.insertText = name
      }
      // Show files after directories.
      completion.sortText = 'f'
    }
    completion.kind = CompletionItemKind.File

    return completion
  })

  // Add the parent directory to the completion list.
  result.unshift(new CompletionItem('..'))

  return Promise.resolve(result)
}

/**
 * Provides autocompletion of RequireJS module paths in module dependencies.
 * When typing "/" after a directory name, the child modules will be offered
 * in a drop-down list.
 */
class CompletionItemProvider {
  /**
   * Initializes a new instance.
   * @param {ModuleResolver} moduleResolver Module to file path resolution helper.
   * @param {FolderCrawler} folderCrawler Folder checker and enumerator.
   */
  constructor (moduleResolver, folderCrawler) {
    hostOrCreateDisposable(this, 'moduleResolver', ModuleResolver, moduleResolver)
    hostOrCreateDisposable(this, 'folderCrawler', FolderCrawler, folderCrawler)
  }

  /**
   * Provide the list of completion file items for the folder path entered by the user.
   * @param {TextDocument} document The document in which the command was invoked.
   * @param {Position} position The position at which the command was invoked.
   * @param {CancellationToken} cancellationToken A cancellation token.
   * @returns {Promise} Resolves with an array of file completion items.
   */
  provideCompletionItems (document, position, cancellationToken) {
    const statusNotifier = this.folderCrawler.statusNotifier
    const currentLine = document.getText(document.lineAt(position).range)
    const currentCharacter = position.character

    // Module paths can be only within string literals.
    if (!isInsideString(currentLine, currentCharacter)) {
      return Promise.resolve([])
    }

    // Extract the absolute file paths path from the string on the current
    // position, which appears to contain a module path.
    const folderPath = this.getFocusedFolderPath(document.fileName,
      currentLine, currentCharacter)

    if (!folderPath) {
      return Promise.resolve([])
    }
    statusNotifier.show()

    // Offer the child modules for directories only.
    return this.folderCrawler.checkDirectory(folderPath)
      .then(() => {
        return this.folderCrawler.listFolderChildren(folderPath, cancellationToken)
          .then(items => this.folderCrawler.inspectFileItems(items, cancellationToken))
          .then(items => createCompletionItems(items))
      }, () => [])
      .then(items => {
        statusNotifier.notify('check',
          localize('crawlSucceeded.title', '{0} items found.', items.length),
          localize('crawlSucceeded.message', 'File and directory inspection finished. {0} completion items found.', items.length))
        statusNotifier.hide()

        return items
      }, error => {
        statusNotifier.notify('alert',
          localize('crawlFailed.title', 'Items unavailable.'),
          localize('crawlFailed.message', 'File and directory inspection failed: {0}', error.message))
        statusNotifier.hide()
        throw error
      })
  }

  /**
   * Builds a file-system path based on the focused string content content interpreted as a module path.
   * @param {string} currentFilePath The file-system path to the currently opened file.
   * @param {number} currentLine The current line of the cursor.
   * @param {number} currentPosition The current position of the cursor.
   * @returns {string} The file-system path or `undefined`, if the string cannot be interpreted as a module path.
   */
  getFocusedFolderPath (currentFilePath, currentLine, currentPosition) {
    let userPath = getModulePathUpToPosition(currentLine, currentPosition)
    const pluginSeparator = userPath.indexOf('!')

    // Do not let the plugin add the plugin-specific file extension.
    if (pluginSeparator > 0) {
      userPath = userPath.substr(pluginSeparator + 1)
    }
    if (!startsLikeModulePath(userPath)) {
      return undefined
    }

    const filePath = this.moduleResolver.resolveModulePath(userPath, currentFilePath)

    // Without a plugin, every resolved path is handled as a JavaScript
    // module and gets the extension ".js" appended.
    return filePath.substr(0, filePath.length - 3)
  }

  /**
   * Disposes of disposable child objects.
   * @returns {void} Nothing.
   */
  dispose () {
    disposeAll(this)
  }
}

module.exports = CompletionItemProvider
