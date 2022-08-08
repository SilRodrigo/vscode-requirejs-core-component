const { workspace, Uri, Location, Range, Position } = require('vscode')
const { findIdentifier } = require('./codeParser')
const ModuleAnalyser = require('./moduleAnalyser')
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost')

/**
 * Provides the location of the definition of a selected identifier, if it is
 * located in a separate RequireJS module.
 */
class DefinitionProvider {
  /**
   * Initializes a new instance.
   * @param {ModuleAnalyser} moduleAnalyser Caching module analysis helper.
   */
  constructor (moduleAnalyser) {
    hostOrCreateDisposable(this, 'moduleAnalyser', ModuleAnalyser, moduleAnalyser)
  }

  /**
   * Diverges the search to the given module
   * @param {string} filePath File-system path of the target module
   * @param {string} searchFor The identifier to search for inside the module
   * @returns {Promise} Resolves with a file location
   */
  searchModule (filePath, searchFor) {
    const newUri = Uri.file(filePath)
    const newDocument = workspace.openTextDocument(newUri)

    return newDocument.then(document => {
      const onlyNavigateToFile = workspace
        .getConfiguration('requireModuleSupport')
        .get('onlyNavigateToFile')

      // Some modules are source for RequireJS plugins and need not be written in JavaScript.
      if (!onlyNavigateToFile && searchFor &&
          (document.languageId === 'javascript' || document.languageId === 'javascriptreact')) {
        const astRoot = this.moduleAnalyser.getParsedModule(document)
        const range = findIdentifier(astRoot, searchFor)

        if (range) {
          return new Location(newUri, new Range(
            // Range is zero-based, esprima is one-based
            new Position(range.start.line - 1, range.start.column),
            new Position(range.end.line - 1, range.end.column)
          ))
        }
      }

      return new Location(newUri, new Position(0, 0))
    })
  }

  /**
   * Provide the definition of the symbol at the given position and document.
   * @param {TextDocument} document The document in which the command was invoked.
   * @param {Position} position The position at which the command was invoked.
   * @returns {Promise} Resolves with a file location.
   */
  async provideDefinition (document, position) {
    this.moduleAnalyser.startCollectingErrors()

    try {
      const moduleDependency = await this.moduleAnalyser.getOriginatingModuleDependency(document, position)

      // If the selected identifier cannot be tracked to other module,
      // let the built-in definition lookup handle it. The symbol definition
      // can be found, only if its originating module could be found.
      if (moduleDependency) {
        const filePath = moduleDependency.filePath

        if (filePath) {
          return await this.searchModule(filePath, moduleDependency.selected)
        }
      }
    } finally {
      this.moduleAnalyser.reportErrors()
    }
  }

  /**
   * Disposes of disposable child objects.
   * @returns {void} Nothing.
   */
  dispose () {
    disposeAll(this)
  }
}

module.exports = DefinitionProvider
